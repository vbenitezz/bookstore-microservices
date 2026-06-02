'use strict';

const amqp   = require('amqplib');
const logger = require('./logger');

// =============================================================================
// RabbitMQ — Email Service (solo consumer)
//
// El Email Service escucha eventos del exchange bookstore.payments:
//   payment.success  → enviar email de confirmación de compra
//   payment.failed   → enviar email de pago fallido
//   payment.refunded → enviar email de reembolso
//
// También escucha bookstore.orders para:
//   order.cancelled  → enviar email de cancelación
// =============================================================================

const PAYMENTS_EXCHANGE = 'bookstore.payments';
const ORDERS_EXCHANGE   = 'bookstore.orders';

const QUEUES = {
  PAYMENT_EVENTS: 'email-service.payment-events',
  ORDER_EVENTS:   'email-service.order-events',
};

let connection = null;
let channel    = null;

async function connect() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL no está definida');

  connection = await amqp.connect(url);
  channel    = await connection.createChannel();

  // Declarar exchanges (idempotente)
  await channel.assertExchange(PAYMENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(ORDERS_EXCHANGE,   'topic', { durable: true });

  // Cola para eventos de pago
  await channel.assertQueue(QUEUES.PAYMENT_EVENTS, { durable: true });
  await channel.bindQueue(QUEUES.PAYMENT_EVENTS, PAYMENTS_EXCHANGE, 'payment.success');
  await channel.bindQueue(QUEUES.PAYMENT_EVENTS, PAYMENTS_EXCHANGE, 'payment.failed');
  await channel.bindQueue(QUEUES.PAYMENT_EVENTS, PAYMENTS_EXCHANGE, 'payment.refunded');

  // Cola para eventos de órdenes
  await channel.assertQueue(QUEUES.ORDER_EVENTS, { durable: true });
  await channel.bindQueue(QUEUES.ORDER_EVENTS, ORDERS_EXCHANGE, 'order.cancelled');

  // Procesar un mensaje a la vez
  await channel.prefetch(1);

  logger.info('[RabbitMQ] Conectado y colas configuradas');

  connection.on('error', (err) => {
    logger.error('[RabbitMQ] Error:', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('[RabbitMQ] Conexión cerrada, reintentando en 5s...');
    setTimeout(connect, 5000);
  });
}

/**
 * Registra un handler para una cola específica.
 * @param {string}   queueName — nombre de la cola
 * @param {Function} handler   — async (payload, routingKey) => void
 */
async function consume(queueName, handler) {
  await channel.consume(queueName, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
      const routingKey = msg.fields.routingKey;

      logger.info('[RabbitMQ] Mensaje recibido', {
        queue:      queueName,
        routingKey,
        orderId:    payload.orderId,
      });

      await handler(payload, routingKey);
      channel.ack(msg);

    } catch (err) {
      logger.error('[RabbitMQ] Error procesando mensaje:', {
        error:   err.message,
        orderId: payload?.orderId,
      });
      // No reintentar — descartar el mensaje para no bloquear la cola
      channel.nack(msg, false, false);
    }
  });
}

async function disconnect() {
  try {
    if (channel)    await channel.close();
    if (connection) await connection.close();
    logger.info('[RabbitMQ] Desconectado');
  } catch (err) {
    logger.error('[RabbitMQ] Error al desconectar:', err);
  }
}

module.exports = { connect, consume, disconnect, QUEUES };