'use strict';

const amqp   = require('amqplib');
const logger = require('./logger');

// =============================================================================
// RabbitMQ Publisher — Order Service
//
// El Order Service publica eventos cuando ocurren acciones importantes.
// Payment Service y Email Service escuchan estos eventos.
//
// Exchanges y eventos:
//   Exchange: bookstore.orders (type: topic)
//   Routing keys:
//     order.created  → Payment Service lo consume para procesar el pago
//     order.cancelled → Email Service notifica al usuario
//
// Por qué topic exchange:
//   Permite que múltiples servicios consuman el mismo evento con
//   diferentes routing keys. Más flexible que direct o fanout.
// =============================================================================

const EXCHANGE_NAME = 'bookstore.orders';
const EXCHANGE_TYPE = 'topic';

let connection = null;
let channel    = null;

async function connect() {
  const url = process.env.RABBITMQ_URL;
  if (!url) throw new Error('RABBITMQ_URL no está definida en el entorno');

  connection = await amqp.connect(url);
  channel    = await connection.createChannel();

  // Declarar el exchange (idempotente — no falla si ya existe)
  await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
    durable: true, // Sobrevive reinicios de RabbitMQ
  });

  logger.info(`[RabbitMQ] Conectado — exchange: ${EXCHANGE_NAME}`);

  // Manejar errores de conexión
  connection.on('error', (err) => {
    logger.error('[RabbitMQ] Error de conexión:', { error: err.message });
  });

  connection.on('close', () => {
    logger.warn('[RabbitMQ] Conexión cerrada, reintentando en 5s...');
    setTimeout(connect, 5000);
  });
}

// =============================================================================
// Publicar un evento
// =============================================================================

/**
 * Publica un mensaje en el exchange de órdenes.
 * @param {string} routingKey  — ej: 'order.created'
 * @param {object} payload     — datos del evento
 */
async function publish(routingKey, payload) {
  if (!channel) {
    throw new Error('[RabbitMQ] Canal no disponible — ¿se llamó connect()?');
  }

  const message = Buffer.from(JSON.stringify({
    ...payload,
    timestamp:  new Date().toISOString(),
    routingKey,
  }));

  channel.publish(EXCHANGE_NAME, routingKey, message, {
    persistent:  true,         // El mensaje sobrevive reinicios
    contentType: 'application/json',
  });

  logger.info(`[RabbitMQ] Evento publicado: ${routingKey}`, {
    orderId: payload.orderId || payload.order_id,
  });
}

async function disconnect() {
  try {
    if (channel)    await channel.close();
    if (connection) await connection.close();
    logger.info('[RabbitMQ] Conexión cerrada correctamente');
  } catch (err) {
    logger.error('[RabbitMQ] Error al cerrar conexión:', err);
  }
}

// =============================================================================
// Eventos que publica el Order Service
// Centraliza los routing keys para evitar typos
// =============================================================================

const Events = {
  ORDER_CREATED:   'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_CONFIRMED: 'order.confirmed',
};

module.exports = { connect, publish, disconnect, Events };