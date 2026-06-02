'use strict';

const db             = require('../config/database');
const { StripeService } = require('../config/stripe');
const { publish, Events } = require('../config/rabbitmq');
const logger         = require('../config/logger');

// =============================================================================
// Payment Controller — endpoints REST
//
// GET  /payments/intent/:orderId → retorna client_secret para que el
//      frontend confirme el pago con Stripe.js
//
// GET  /payments/:orderId        → estado del pago de una orden
//
// GET  /payments                 → historial de pagos del usuario
//
// POST /payments/webhook         → webhook de Stripe (firma verificada)
//      Stripe llama aquí cuando:
//        - payment_intent.succeeded → pago confirmado
//        - payment_intent.payment_failed → pago fallido
//        - charge.refunded → reembolso procesado
// =============================================================================

// --- getPaymentIntent ---
// El frontend llama esto para obtener el client_secret y confirmar el pago
async function getPaymentIntent(req, res, next) {
  const { userId } = req.user;
  const { orderId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, order_id, amount, status, stripe_payment_id, stripe_client_secret, created_at
       FROM payment_intents
       WHERE order_id = $1 AND user_id = $2`,
      [orderId, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error:   'payment_not_found',
        message: 'No se encontró un pago para esta orden',
      });
    }

    const intent = result.rows[0];

    return res.json({
      payment_id:    intent.id,
      order_id:      intent.order_id,
      amount:        intent.amount,
      status:        intent.status,
      client_secret: intent.stripe_client_secret,
      created_at:    intent.created_at,
    });

  } catch (err) {
    next(err);
  }
}

// --- getPaymentByOrder ---
async function getPaymentByOrder(req, res, next) {
  const { userId, role } = req.user;
  const { orderId }      = req.params;

  try {
    const result = await db.query(
      `SELECT id, order_id, user_id, amount, currency, status,
              stripe_payment_id, failure_reason, created_at, updated_at
       FROM payment_intents
       WHERE order_id = $1`,
      [orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error:   'payment_not_found',
        message: 'No se encontró pago para esta orden',
      });
    }

    const payment = result.rows[0];

    // Solo el dueño o un admin pueden ver el pago
    if (role !== 'admin' && payment.user_id !== userId) {
      return res.status(403).json({
        error:   'forbidden',
        message: 'No tienes permiso para ver este pago',
      });
    }

    return res.json(payment);

  } catch (err) {
    next(err);
  }
}

// --- listPayments ---
async function listPayments(req, res, next) {
  const { userId, role } = req.user;
  const page     = parseInt(req.query.page      || '1', 10);
  const pageSize = parseInt(req.query.page_size || '10', 10);
  const offset   = (page - 1) * pageSize;

  try {
    // Admin puede ver todos los pagos
    const whereClause = role === 'admin' ? '' : 'WHERE user_id = $1';
    const params      = role === 'admin' ? [] : [userId];

    const countResult = await db.query(
      `SELECT COUNT(*) FROM payment_intents ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(pageSize, offset);
    const result = await db.query(
      `SELECT id, order_id, amount, currency, status,
              stripe_payment_id, failure_reason, created_at, updated_at
       FROM payment_intents
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      items:     result.rows,
      total,
      page,
      page_size: pageSize,
      pages:     Math.ceil(total / pageSize),
    });

  } catch (err) {
    next(err);
  }
}

// --- handleWebhook ---
// Stripe envía eventos a este endpoint para notificar cambios en pagos.
// El body debe llegar RAW (sin parsear) para verificar la firma.
async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = StripeService.constructWebhookEvent(req.body, signature);
  } catch (err) {
    logger.error('[WEBHOOK] Firma inválida:', { error: err.message });
    return res.status(400).json({ error: 'invalid_signature' });
  }

  logger.info('[WEBHOOK] Evento recibido de Stripe', { type: event.type });

  try {
    switch (event.type) {

      // Pago confirmado exitosamente por el usuario
      case 'payment_intent.succeeded': {
        const intent = event.data.object;
        const orderId = intent.metadata?.order_id;

        await db.query(
          `UPDATE payment_intents
           SET status = 'succeeded', updated_at = NOW()
           WHERE stripe_payment_id = $1`,
          [intent.id]
        );

        await publish(Events.PAYMENT_SUCCESS, {
          orderId,
          stripePaymentId: intent.id,
          amount: intent.amount / 100,
        });

        logger.info('[WEBHOOK] Pago exitoso', { orderId, stripeId: intent.id });
        break;
      }

      // Pago fallido
      case 'payment_intent.payment_failed': {
        const intent  = event.data.object;
        const orderId = intent.metadata?.order_id;
        const reason  = intent.last_payment_error?.message || 'Pago rechazado';

        await db.query(
          `UPDATE payment_intents
           SET status = 'failed', failure_reason = $1, updated_at = NOW()
           WHERE stripe_payment_id = $2`,
          [reason, intent.id]
        );

        await publish(Events.PAYMENT_FAILED, {
          orderId,
          stripePaymentId: intent.id,
          reason,
        });

        logger.warn('[WEBHOOK] Pago fallido', { orderId, reason });
        break;
      }

      // Reembolso procesado
      case 'charge.refunded': {
        const charge  = event.data.object;
        const intentId = charge.payment_intent;

        await db.query(
          `UPDATE payment_intents
           SET status = 'refunded', updated_at = NOW()
           WHERE stripe_payment_id = $1`,
          [intentId]
        );

        await publish(Events.PAYMENT_REFUNDED, {
          stripePaymentId: intentId,
          amount: charge.amount_refunded / 100,
        });

        logger.info('[WEBHOOK] Reembolso procesado', { intentId });
        break;
      }

      default:
        logger.debug(`[WEBHOOK] Evento ignorado: ${event.type}`);
    }

    // Responder 200 a Stripe inmediatamente para que no reintente
    return res.json({ received: true });

  } catch (err) {
    logger.error('[WEBHOOK] Error procesando evento:', {
      type:  event.type,
      error: err.message,
    });
    // Retornar 200 de todas formas — si retornamos error, Stripe reintenta
    return res.json({ received: true, warning: 'Error interno procesando evento' });
  }
}

module.exports = { getPaymentIntent, getPaymentByOrder, listPayments, handleWebhook };