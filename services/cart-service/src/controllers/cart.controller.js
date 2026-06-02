'use strict';

const { CartRedis }  = require('../config/redis');
const { getBook, checkStock } = require('../grpc/catalog.client');
const logger         = require('../config/logger');

// =============================================================================
// Cart Controller
//
// Operaciones del carrito:
//   getCart     → obtener carrito completo con totales
//   addItem     → agregar libro (verifica stock en Catalog via gRPC)
//   updateItem  → cambiar cantidad (verifica stock en Catalog via gRPC)
//   removeItem  → quitar un libro del carrito
//   clearCart   → vaciar el carrito completo
//
// Cada operación de escritura (add/update) verifica stock en Catalog Service
// via gRPC antes de modificar Redis. Esto evita carritos con items sin stock.
// =============================================================================

// --- getCart ---
async function getCart(req, res, next) {
  const { userId } = req.user;

  try {
    const items = await CartRedis.getCart(userId);

    if (!items.length) {
      return res.json({
        user_id: userId,
        items:   [],
        total:   0,
        count:   0,
      });
    }

    const total = items.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );

    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    return res.json({
      user_id: userId,
      items:   items.map(item => ({
        book_id:   item.bookId,
        title:     item.title,
        author:    item.author,
        cover_url: item.coverUrl,
        price:     item.price,
        quantity:  item.quantity,
        subtotal:  Math.round(parseFloat(item.price) * item.quantity * 100) / 100,
        added_at:  item.addedAt,
      })),
      total:   Math.round(total * 100) / 100,
      count,
    });

  } catch (err) {
    next(err);
  }
}

// --- addItem ---
async function addItem(req, res, next) {
  const { userId }          = req.user;
  const { book_id, quantity } = req.body;

  try {
    // 1. Obtener datos del libro en Catalog Service via gRPC
    const bookData = await getBook(book_id);

    if (!bookData.found) {
      return res.status(404).json({
        error:   'book_not_found',
        message: 'El libro no existe o no está disponible',
      });
    }

    // 2. Verificar si el libro ya está en el carrito
    const existing = await CartRedis.getItem(userId, book_id);
    const newQuantity = existing
      ? existing.quantity + quantity   // sumar al existente
      : quantity;

    // 3. Verificar stock suficiente para la cantidad total
    const stockResult = await checkStock(book_id, newQuantity);

    if (!stockResult.available) {
      return res.status(409).json({
        error:         'insufficient_stock',
        message:       `Stock insuficiente. Disponible: ${stockResult.current_stock}, solicitado: ${newQuantity}`,
        current_stock: stockResult.current_stock,
        requested:     newQuantity,
      });
    }

    // 4. Guardar en Redis
    const item = {
      bookId:   book_id,
      title:    bookData.title,
      author:   bookData.author,
      coverUrl: bookData.cover_url || '',
      price:    bookData.price,
      quantity: newQuantity,
      addedAt:  existing ? existing.addedAt : new Date().toISOString(),
    };

    await CartRedis.setItem(userId, book_id, item);

    logger.info('[CART] Item agregado', { userId, bookId: book_id, quantity: newQuantity });

    return res.status(201).json({
      message:  existing ? 'Cantidad actualizada en el carrito' : 'Libro agregado al carrito',
      item: {
        book_id:  item.bookId,
        title:    item.title,
        price:    item.price,
        quantity: item.quantity,
        subtotal: Math.round(item.price * item.quantity * 100) / 100,
      },
    });

  } catch (err) {
    // Diferenciar errores de gRPC de errores internos
    if (err.message.includes('Error al obtener') || err.message.includes('Error al verificar')) {
      return res.status(503).json({
        error:   'catalog_service_unavailable',
        message: err.message,
      });
    }
    next(err);
  }
}

// --- updateItem ---
async function updateItem(req, res, next) {
  const { userId }    = req.user;
  const { bookId }    = req.params;
  const { quantity }  = req.body;

  try {
    // Verificar que el item está en el carrito
    const existing = await CartRedis.getItem(userId, bookId);

    if (!existing) {
      return res.status(404).json({
        error:   'item_not_found',
        message: 'El libro no está en el carrito',
      });
    }

    // Verificar stock para la nueva cantidad
    const stockResult = await checkStock(bookId, quantity);

    if (!stockResult.available) {
      return res.status(409).json({
        error:         'insufficient_stock',
        message:       `Stock insuficiente. Disponible: ${stockResult.current_stock}`,
        current_stock: stockResult.current_stock,
        requested:     quantity,
      });
    }

    // Actualizar en Redis
    const updatedItem = { ...existing, quantity };
    await CartRedis.setItem(userId, bookId, updatedItem);

    logger.info('[CART] Item actualizado', { userId, bookId, quantity });

    return res.json({
      message:  'Cantidad actualizada',
      item: {
        book_id:  bookId,
        title:    updatedItem.title,
        price:    updatedItem.price,
        quantity: updatedItem.quantity,
        subtotal: Math.round(updatedItem.price * quantity * 100) / 100,
      },
    });

  } catch (err) {
    if (err.message.includes('Error al verificar')) {
      return res.status(503).json({
        error:   'catalog_service_unavailable',
        message: err.message,
      });
    }
    next(err);
  }
}

// --- removeItem ---
async function removeItem(req, res, next) {
  const { userId } = req.user;
  const { bookId } = req.params;

  try {
    const existing = await CartRedis.getItem(userId, bookId);

    if (!existing) {
      return res.status(404).json({
        error:   'item_not_found',
        message: 'El libro no está en el carrito',
      });
    }

    await CartRedis.removeItem(userId, bookId);

    logger.info('[CART] Item eliminado', { userId, bookId });

    return res.json({
      message: 'Libro eliminado del carrito',
      book_id: bookId,
    });

  } catch (err) {
    next(err);
  }
}

// --- clearCart ---
async function clearCart(req, res, next) {
  const { userId } = req.user;

  try {
    await CartRedis.clearCart(userId);

    logger.info('[CART] Carrito vaciado', { userId });

    return res.json({ message: 'Carrito vaciado correctamente' });

  } catch (err) {
    next(err);
  }
}

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };