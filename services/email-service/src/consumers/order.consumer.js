'use strict';

const { EmailSender }  = require('../config/sendgrid');
const templates        = require('../templates/email.templates');
const logger           = require('../config/logger');

// =============================================================================
// Order Event Consumer
//
// Escucha eventos del exchange bookstore.orders:
//   order.cancelled → email de cancelación de orden
// =============================================================================

async function handleOrderEvent(payload, routingKey) {
  logger.info('[EMAIL] Procesando evento de orden', {
    routingKey,
    orderId: payload.orderId,
    email:   payload.email,
  });

  let emailData;

  switch (routingKey) {

    case 'order.cancelled':
      emailData = templates.orderCancelled({
        orderId:      payload.orderId,
        shippingName: payload.shippingName || payload.email,
        email:        payload.email,
        amount:       payload.total || payload.amount,
      });
      break;

    default:
      logger.warn('[EMAIL] Routing key de orden no manejado:', { routingKey });
      return;
  }

  if (!payload.email) {
    logger.error('[EMAIL] No hay email destinatario', { orderId: payload.orderId });
    return;
  }

  await EmailSender.send({
    to:      payload.email,
    subject: emailData.subject,
    html:    emailData.html,
    text:    emailData.text,
  });

  logger.info('[EMAIL] Email de orden enviado', {
    routingKey,
    to:      payload.email,
    orderId: payload.orderId,
  });
}

module.exports = { handleOrderEvent };