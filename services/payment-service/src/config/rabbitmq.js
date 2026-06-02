'use strict';

const amqp   = require('amqplib');
const logger = require('./logger');

// =============================================================================
// RabbitMQ — Payment Service
//
// Actúa como CONSUMER del exchange bookstore.orders:
//   Escucha: order.created → procesar pago
//
// Actúa como PUBLISHER del exchange bookstore.payments:
//   Publica: payment.success → Email Service notifica al usuario
//            payment.failed  → Order Service cancela la orden
//            payment.refunded → Email Service notifica reembolso
// =============================================================================

const ORDERS_EXCHANGE   = 'bookstore.orders';
const PAYMENTS_EXCHANGE = 'bookstore.payments';
const QUEUE_NAME        = 'payment-service.order-events';

let connection      = null;
let consumerChannel = null;
let publisherChannel = null;

async function connect() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL no está definida');

  connection = await amqp.connect(url);

  // Canal para consumir mensajes
  consumerChannel  = await connection.createChannel();
  // Canal separado para publicar (buena práctica — evita conflictos)
  publisherChannel = await connection.createChannel();

  // Declarar exchanges (idempotente)
  await consumerChannel.assertExchange(ORDERS_EXCHANGE,   'topic', { durable: true });
  await publisherChannel.assertExchange(PAYMENTS_EXCHANGE, 'topic', { durable: true });

  // Declarar cola y binding
  // durable: true → la cola sobrevive reinicios de RabbitMQ
  // La cola escucha solo el routing key 'order.created'
  await consumerChannel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: {
      'x-message-ttl': 86400000, // mensajes expiran en 24h si no se procesan
    },
  });

  await consumerChannel.bindQueue(QUEUE_NAME, ORDERS_EXCHANGE, 'order.created');

  // prefetch(1) → procesar un mensaje a la vez
  // Garantiza que si el servicio está ocupado, RabbitMQ no le manda más
  await consumerChannel.prefetch(1);

  logger.info('[RabbitMQ] Conectado y configurado');
  logger.info(`[RabbitMQ] Escuchando cola: ${QUEUE_NAME}`);

  connection.on('error', (err) => {
    logger.error('[RabbitMQ] Error de conexión:', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('[RabbitMQ] Conexión cerrada, reintentando en 5s...');
    setTimeout(connect, 5000);
  });
}

// =============================================================================
// Consumer — procesar mensajes de la cola
// =============================================================================

/**
 * Registra el handler que procesa cada mensaje de order.created.
 * @param {Function} handler — async (message) => void
 */
async function consumeOrders(handler) {
  await consumerChannel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
      logger.info('[RabbitMQ] Mensaje recibido', {
        routingKey: msg.fields.routingKey,
        orderId:    payload.orderId,
      });

      await handler(payload);

      // ACK: mensaje procesado correctamente → RabbitMQ lo elimina de la cola
      consumerChannel.ack(msg);

    } catch (err) {
      logger.error('[RabbitMQ] Error procesando mensaje:', {
        error:   err.message,
        orderId: payload?.orderId,
      });

      // NACK con requeue: false → el mensaje va a la dead letter queue
      // (si está configurada) o se descarta. No reintentar infinitamente.
      consumerChannel.nack(msg, false, false);
    }
  });
}

// =============================================================================
// Publisher — publicar eventos de pago
// =============================================================================

const Events = {
  PAYMENT_SUCCESS:  'payment.success',
  PAYMENT_FAILED:   'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
};

async function publish(routingKey, payload) {
  if (!publisherChannel) {
    throw new Error('[RabbitMQ] Canal no disponible');
  }

  const message = Buffer.from(JSON.stringify({
    ...payload,
    timestamp:  new Date().toISOString(),
    routingKey,
  }));

  publisherChannel.publish(PAYMENTS_EXCHANGE, routingKey, message, {
    persistent:  true,
    contentType: 'application/json',
  });

  logger.info(`[RabbitMQ] Evento publicado: ${routingKey}`, {
    orderId: payload.orderId,
  });
}

async function disconnect() {
  try {
    if (consumerChannel)  await consumerChannel.close();
    if (publisherChannel) await publisherChannel.close();
    if (connection)       await connection.close();
    logger.info('[RabbitMQ] Desconectado correctamente');
  } catch (err) {
    logger.error('[RabbitMQ] Error al desconectar:', err);
  }
}

module.exports = { connect, consumeOrders, publish, disconnect, Events };