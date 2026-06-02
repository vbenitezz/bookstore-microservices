'use strict';

const db             = require('../config/database');
const { StripeService } = require('../config/stripe');
const { publish, Events } = require('../config/rabbitmq');
const logger         = require('../config/logger');

// =============================================================================
// Order Event Consumer
//
// Escucha el evento 'order.created' publicado por Order Service.
//
// Flujo al recibir order.created:
//   1. Verificar idempotencia (¿ya procesamos esta orden?)
//   2. Registrar el intento de pago en DB (status: 'processing')
//   3. Crear PaymentIntent en Stripe
//   4. Actualizar DB con el stripe_payment_id y client_secret
//   5. Publicar payment.success o payment.failed según resultado
//
// Nota sobre el flujo de Stripe:
//   En un flujo completo, el frontend usa el client_secret para
//   confirmar el pago con la tarjeta. En esta implementación, el
//   PaymentIntent se crea aquí y el frontend lo confirma via el
//   endpoint REST GET /payments/intent/:orderId
// =============================================================================

async function handleOrderCreated(payload) {
  const { orderId, userId, email, total, shippingName, items } = payload;

  logger.info('[PAYMENT] Procesando order.created', { orderId, total });

  // 1. Verificar idempotencia — si ya existe un intento para esta orden, ignorar
  const existing = await db.query(
    'SELECT id, status FROM payment_intents WHERE order_id = $1',
    [orderId]
  );

  if (existing.rows.length) {
    logger.warn('[PAYMENT] Orden ya procesada (idempotencia)', {
      orderId,
      existingStatus: existing.rows[0].status,
    });
    return; // Ignorar duplicado silenciosamente
  }

  // 2. Registrar intento de pago en DB
  const intentResult = await db.query(
    `INSERT INTO payment_intents
       (order_id, user_id, amount, status, metadata)
     VALUES ($1, $2, $3, 'processing', $4)
     RETURNING id`,
    [
      orderId,
      userId,
      total,
      JSON.stringify({ shippingName, email, itemCount: items?.length || 0 }),
    ]
  );

  const paymentIntentDbId = intentResult.rows[0].id;

  try {
    // 3. Crear PaymentIntent en Stripe
    const stripeIntent = await StripeService.createPaymentIntent({
      amount:  total,
      orderId,
      userId,
      email,
    });

    // 4. Actualizar DB con los datos de Stripe
    await db.query(
      `UPDATE payment_intents
       SET stripe_payment_id    = $1,
           stripe_client_secret = $2,
           status               = 'pending',
           updated_at           = NOW()
       WHERE id = $3`,
      [stripeIntent.id, stripeIntent.client_secret, paymentIntentDbId]
    );

    logger.info('[PAYMENT] PaymentIntent creado en Stripe', {
      orderId,
      stripeId: stripeIntent.id,
    });

    // 5. Publicar evento de éxito
    // En un flujo real con Stripe, payment.success se publica desde el webhook
    // cuando Stripe confirma que el pago fue completado por el usuario.
    // Aquí publicamos que el intent fue CREADO exitosamente (listo para pagar).
    await publish(Events.PAYMENT_SUCCESS, {
      orderId,
      userId,
      email,
      amount:              total,
      stripePaymentId:     stripeIntent.id,
      stripeClientSecret:  stripeIntent.client_secret,
      shippingName,
    });

  } catch (err) {
    // Si Stripe falla, marcar como fallido
    logger.error('[PAYMENT] Error al crear PaymentIntent', {
      orderId,
      error: err.message,
    });

    await db.query(
      `UPDATE payment_intents
       SET status = 'failed', failure_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [err.message, paymentIntentDbId]
    );

    // Publicar evento de fallo para que Order Service cancele la orden
    await publish(Events.PAYMENT_FAILED, {
      orderId,
      userId,
      email,
      amount: total,
      reason: err.message,
    });
  }
}

module.exports = { handleOrderCreated };