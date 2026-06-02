'use strict';

const db              = require('../config/database');
const { publish, Events } = require('../config/rabbitmq');
const { getUser }     = require('../grpc/auth.client');
const { getCart, clearCart } = require('../grpc/cart.client');
const { deductStock, restoreStock } = require('../grpc/catalog.client');
const logger          = require('../config/logger');

// =============================================================================
// Order Controller
//
// createOrder — flujo principal (el más complejo del sistema):
//   1. Verificar que el carrito no está vacío (gRPC → Cart)
//   2. Obtener datos del usuario (gRPC → Auth)
//   3. Crear la orden en DB con status 'pending'
//   4. Descontar stock en Catalog (gRPC → Catalog)
//      → Si falla: cancelar la orden (compensación)
//   5. Vaciar el carrito (gRPC → Cart)
//   6. Publicar evento 'order.created' en RabbitMQ
//      → Payment Service lo consume para procesar el pago
//
// listOrders    — historial de órdenes del usuario autenticado
// getOrder      — detalle de una orden específica
// cancelOrder   — cancelar orden (solo si está en 'pending')
// updateStatus  — cambiar estado (solo admin)
// =============================================================================

// --- createOrder ---
async function createOrder(req, res, next) {
  const { userId, email } = req.user;
  const { shipping_name, shipping_email, shipping_address, notes } = req.body;

  const client = await db.getClient(); // Transacción manual para rollback si algo falla

  try {
    // 1. Obtener carrito via gRPC
    const cartData = await getCart(userId);

    if (!cartData.found || !cartData.items.length) {
      return res.status(400).json({
        error:   'empty_cart',
        message: 'El carrito está vacío. Agrega libros antes de crear una orden.',
      });
    }

    // 2. Obtener datos del usuario para la orden
    let userData = { first_name: '', last_name: '', email };
    try {
      const userResult = await getUser(userId);
      if (userResult.found) userData = userResult;
    } catch (err) {
      // No crítico — usamos los datos del token
      logger.warn('[ORDER] No se pudieron obtener datos del usuario via gRPC', { userId });
    }

    const orderTotal = cartData.total;
    const shippingName  = shipping_name  || `${userData.first_name} ${userData.last_name}`.trim();
    const shippingEmail = shipping_email || userData.email;

    // 3. Crear orden en DB (dentro de transacción)
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, status, total, shipping_name, shipping_email, shipping_address, notes)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, orderTotal, shippingName, shippingEmail, shipping_address || null, notes || null]
    );

    const order = orderResult.rows[0];

    // 4. Insertar items de la orden
    const itemsData = cartData.items.map(item => ({
      orderId:  order.id,
      bookId:   item.book_id,
      title:    item.title,
      author:   item.author || '',
      price:    item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    }));

    for (const item of itemsData) {
      await client.query(
        `INSERT INTO order_items
           (order_id, book_id, title, author, price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [item.orderId, item.bookId, item.title, item.author, item.price, item.quantity, item.subtotal]
      );
    }

    await client.query('COMMIT');
    logger.info('[ORDER] Orden creada en DB', { orderId: order.id, userId, total: orderTotal });

    // 5. Descontar stock en Catalog via gRPC
    // Si esto falla, compensamos cancelando la orden
    const stockItems = itemsData.map(i => ({ bookId: i.bookId, quantity: i.quantity }));
    const stockResult = await deductStock(order.id, stockItems);

    if (!stockResult.success) {
      // Compensación: cancelar la orden si no se pudo descontar el stock
      await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [order.id]
      );

      logger.error('[ORDER] Stock insuficiente al crear orden, orden cancelada', {
        orderId: order.id,
        error: stockResult.error,
      });

      return res.status(409).json({
        error:    'stock_error',
        message:  stockResult.error || 'No hay stock suficiente para completar la orden',
        order_id: order.id,
      });
    }

    // 6. Vaciar carrito (no crítico — si falla no afecta la orden)
    const clearResult = await clearCart(userId, order.id);
    if (!clearResult.success) {
      logger.warn('[ORDER] No se pudo vaciar el carrito (non-fatal)', { userId, orderId: order.id });
    }

    // 7. Publicar evento para que Payment Service procese el pago
    try {
      await publish(Events.ORDER_CREATED, {
        orderId:        order.id,
        userId,
        email:          shippingEmail,
        total:          orderTotal,
        shippingName,
        items:          itemsData.map(i => ({
          bookId:   i.bookId,
          title:    i.title,
          price:    i.price,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
      });

      logger.info('[ORDER] Evento order.created publicado', { orderId: order.id });
    } catch (err) {
      logger.warn('[ORDER] No se pudo publicar evento (RabbitMQ no disponible):', err.message);
    }

    return res.status(201).json({
      message:  'Orden creada exitosamente. Procesando pago...',
      order: {
        id:               order.id,
        status:           order.status,
        total:            order.total,
        shipping_name:    order.shipping_name,
        shipping_email:   order.shipping_email,
        shipping_address: order.shipping_address,
        items:            itemsData,
        created_at:       order.created_at,
      },
    });

  } catch (err) {
    // Rollback si la transacción estaba activa
    try { await client.query('ROLLBACK'); } catch (_) {}
    next(err);
  } finally {
    client.release();
  }
}

// --- listOrders ---
async function listOrders(req, res, next) {
  const { userId } = req.user;
  const page      = parseInt(req.query.page      || '1', 10);
  const pageSize  = parseInt(req.query.page_size || '10', 10);
  const status    = req.query.status;
  const offset    = (page - 1) * pageSize;

  try {
    let whereClause = 'WHERE o.user_id = $1';
    const params    = [userId];

    if (status) {
      params.push(status);
      whereClause += ` AND o.status = $${params.length}`;
    }

    // Total de órdenes
    const countResult = await db.query(
      `SELECT COUNT(*) FROM orders o ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Órdenes paginadas con sus items
    params.push(pageSize, offset);
    const ordersResult = await db.query(
      `SELECT o.*, 
              json_agg(json_build_object(
                'id', oi.id,
                'book_id', oi.book_id,
                'title', oi.title,
                'author', oi.author,
                'price', oi.price,
                'quantity', oi.quantity,
                'subtotal', oi.subtotal
              ) ORDER BY oi.created_at) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      items:     ordersResult.rows,
      total,
      page,
      page_size: pageSize,
      pages:     Math.ceil(total / pageSize),
    });

  } catch (err) {
    next(err);
  }
}

// --- getOrder ---
async function getOrder(req, res, next) {
  const { userId, role } = req.user;
  const { orderId }      = req.params;

  try {
    const result = await db.query(
      `SELECT o.*,
              json_agg(json_build_object(
                'id', oi.id,
                'book_id', oi.book_id,
                'title', oi.title,
                'author', oi.author,
                'price', oi.price,
                'quantity', oi.quantity,
                'subtotal', oi.subtotal
              ) ORDER BY oi.created_at) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error:   'order_not_found',
        message: 'Orden no encontrada',
      });
    }

    const order = result.rows[0];

    // Un usuario solo puede ver sus propias órdenes (admin puede ver todas)
    if (role !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({
        error:   'forbidden',
        message: 'No tienes permiso para ver esta orden',
      });
    }

    return res.json(order);

  } catch (err) {
    next(err);
  }
}

// --- cancelOrder ---
async function cancelOrder(req, res, next) {
  const { userId, role } = req.user;
  const { orderId }      = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'order_not_found', message: 'Orden no encontrada' });
    }

    const order = result.rows[0];

    // Verificar permisos
    if (role !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({ error: 'forbidden', message: 'No puedes cancelar esta orden' });
    }

    // Solo se puede cancelar si está en estado 'pending'
    if (order.status !== 'pending') {
      return res.status(409).json({
        error:   'cannot_cancel',
        message: `No se puede cancelar una orden en estado '${order.status}'`,
      });
    }

    // Actualizar estado
    await db.query(
      `UPDATE orders
       SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    // Restaurar stock en Catalog (compensación)
    const itemsResult = await db.query(
      'SELECT book_id, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );

    const stockItems = itemsResult.rows.map(r => ({
      bookId:   r.book_id,
      quantity: r.quantity,
    }));

    await restoreStock(orderId, stockItems);

    // Publicar evento de cancelación
    await publish(Events.ORDER_CANCELLED, {
      orderId,
      userId: order.user_id,
      email:  order.shipping_email,
      total:  order.total,
    });

    logger.info('[ORDER] Orden cancelada', { orderId, userId });

    return res.json({
      message:  'Orden cancelada correctamente',
      order_id: orderId,
      status:   'cancelled',
    });

  } catch (err) {
    next(err);
  }
}

// --- updateStatus (solo admin) ---
async function updateStatus(req, res, next) {
  const { orderId }     = req.params;
  const { status, notes } = req.body;

  try {
    const result = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'order_not_found', message: 'Orden no encontrada' });
    }

    // Campos de timestamp según el nuevo estado
    const timestampFields = {
      paid:      'paid_at',
      shipped:   'shipped_at',
      delivered: 'delivered_at',
      cancelled: 'cancelled_at',
    };

    const tsField     = timestampFields[status];
    const tsClause    = tsField ? `, ${tsField} = NOW()` : '';
    const notesClause = notes ? `, notes = $3` : '';
    const params      = notes ? [status, orderId, notes] : [status, orderId];

    await db.query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()${tsClause}${notesClause}
       WHERE id = $2`,
      params
    );

    logger.info('[ORDER] Estado actualizado', { orderId, status });

    return res.json({
      message:  'Estado actualizado correctamente',
      order_id: orderId,
      status,
    });

  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listOrders, getOrder, cancelOrder, updateStatus };