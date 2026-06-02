'use strict';

const { EmailSender }  = require('../config/sendgrid');
const templates        = require('../templates/email.templates');
const logger           = require('../config/logger');

// =============================================================================
// Payment Event Consumer
//
// Escucha eventos del exchange bookstore.payments:
//   payment.success  → email de confirmación de compra
//   payment.failed   → email de pago fallido
//   payment.refunded → email de reembolso procesado
// =============================================================================

async function handlePaymentEvent(payload, routingKey) {
  logger.info('[EMAIL] Procesando evento de pago', {
    routingKey,
    orderId: payload.orderId,
    email:   payload.email,
  });

  // Determinar qué template usar según el routing key
  let emailData;

  switch (routingKey) {

    case 'payment.success':
      emailData = templates.orderConfirmation({
        orderId:      payload.orderId,
        shippingName: payload.shippingName,
        email:        payload.email,
        amount:       payload.amount,
        items:        payload.items || [],
      });
      break;

    case 'payment.failed':
      emailData = templates.paymentFailed({
        orderId:      payload.orderId,
        shippingName: payload.shippingName,
        email:        payload.email,
        amount:       payload.amount,
        reason:       payload.reason,
      });
      break;

    case 'payment.refunded':
      emailData = templates.paymentRefunded({
        orderId:      payload.orderId,
        shippingName: payload.shippingName,
        email:        payload.email,
        amount:       payload.amount,
      });
      break;

    default:
      logger.warn('[EMAIL] Routing key no manejado:', { routingKey });
      return;
  }

  // Verificar que tenemos un email destinatario
  if (!payload.email) {
    logger.error('[EMAIL] No hay email destinatario en el payload', { orderId: payload.orderId });
    return;
  }

  await EmailSender.send({
    to:      payload.email,
    subject: emailData.subject,
    html:    emailData.html,
    text:    emailData.text,
  });

  logger.info('[EMAIL] Email enviado correctamente', {
    routingKey,
    to:      payload.email,
    orderId: payload.orderId,
  });
}

module.exports = { handlePaymentEvent };