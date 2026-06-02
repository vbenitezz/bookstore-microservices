'use strict';

const Stripe = require('stripe');
const logger = require('./logger');

// =============================================================================
// Stripe — Payment Service
//
// En desarrollo usamos el modo TEST de Stripe.
// Nunca se cobran tarjetas reales en modo test.
//
// Tarjetas de prueba útiles:
//   4242 4242 4242 4242 → pago exitoso
//   4000 0000 0000 9995 → fondos insuficientes (falla)
//   4000 0025 0000 3155 → requiere autenticación 3D Secure
//
// Flujo de pago que implementamos:
//   1. Order Service publica order.created
//   2. Payment Service crea un PaymentIntent en Stripe
//   3. Retorna el client_secret al frontend (via REST)
//   4. El frontend confirma el pago con la tarjeta del usuario
//   5. Stripe llama al webhook cuando el pago se confirma
//   6. Payment Service actualiza el estado y publica payment.success
// =============================================================================

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY no está definida — usando modo mock');
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const StripeService = {

  /**
   * Crea un PaymentIntent en Stripe para una orden.
   * El client_secret resultante se envía al frontend para confirmar el pago.
   *
   * @param {object} params
   * @param {number} params.amount   — monto en USD (ej: 29.99)
   * @param {string} params.orderId  — UUID de la orden (para metadata)
   * @param {string} params.userId   — UUID del usuario
   * @param {string} params.email    — email del usuario
   */
  async createPaymentIntent({ amount, orderId, userId, email }) {
    if (!stripe) {
      // Modo mock para desarrollo sin clave de Stripe
      logger.warn('[Stripe] Modo MOCK — retornando PaymentIntent simulado');
      return {
        id:            `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_secret_${Date.now()}`,
        status:        'requires_payment_method',
      };
    }

    // Stripe trabaja con centavos (integers), no decimales
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountInCents,
      currency: 'usd',
      metadata: {
        order_id: orderId,
        user_id:  userId,
      },
      receipt_email: email,
      description:   `BookStore — Orden ${orderId}`,
    });

    logger.info('[Stripe] PaymentIntent creado', {
      paymentIntentId: paymentIntent.id,
      orderId,
      amount,
    });

    return paymentIntent;
  },

  /**
   * Verifica la firma del webhook de Stripe.
   * Garantiza que el evento realmente viene de Stripe y no de un atacante.
   *
   * @param {Buffer} rawBody    — body del request SIN parsear
   * @param {string} signature  — header Stripe-Signature
   */
  constructWebhookEvent(rawBody, signature) {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      logger.warn('[Stripe] Webhook en modo MOCK — evento no verificado');
      return JSON.parse(rawBody.toString());
    }

    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  },

  /**
   * Procesa un reembolso para un PaymentIntent.
   *
   * @param {string} stripePaymentId — ID del PaymentIntent en Stripe
   * @param {number} amount          — monto a reembolsar (null = reembolso total)
   */
  async createRefund(stripePaymentId, amount = null) {
    if (!stripe) {
      logger.warn('[Stripe] Modo MOCK — reembolso simulado');
      return { id: `re_mock_${Date.now()}`, status: 'succeeded' };
    }

    const params = { payment_intent: stripePaymentId };
    if (amount) params.amount = Math.round(amount * 100);

    const refund = await stripe.refunds.create(params);

    logger.info('[Stripe] Reembolso creado', {
      refundId: refund.id,
      stripePaymentId,
    });

    return refund;
  },
};

module.exports = { StripeService };