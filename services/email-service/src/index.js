'use strict';

require('dotenv').config();

const { startRestServer }    = require('./rest');
const rabbitmq               = require('./config/rabbitmq');
const { handlePaymentEvent } = require('./consumers/payment.consumer');
const { handleOrderEvent }   = require('./consumers/order.consumer');
const logger                 = require('./config/logger');

// =============================================================================
// Email Service — Arranque
//
// Secuencia de inicio:
//   1. Conectar a RabbitMQ
//   2. Registrar consumer de eventos de pago (payment.success, failed, refunded)
//   3. Registrar consumer de eventos de orden (order.cancelled)
//   4. Arrancar servidor REST (solo health check)
//
// Este servicio no tiene base de datos propia.
// No expone endpoints de negocio al frontend.
// Su única responsabilidad: escuchar eventos y enviar emails.
// =============================================================================

async function main() {
  try {
    // 1. Conectar a RabbitMQ y configurar colas
    await rabbitmq.connect();

    // 2. Consumer de eventos de pago
    await rabbitmq.consume(
      rabbitmq.QUEUES.PAYMENT_EVENTS,
      handlePaymentEvent
    );
    logger.info('[STARTUP] Consumer de eventos de pago activo');

    // 3. Consumer de eventos de orden
    await rabbitmq.consume(
      rabbitmq.QUEUES.ORDER_EVENTS,
      handleOrderEvent
    );
    logger.info('[STARTUP] Consumer de eventos de orden activo');

    // 4. Servidor REST
    const port = parseInt(process.env.PORT || '3006', 10);
    await startRestServer(port);
    logger.info(`[REST] Email Service escuchando en :${port}`);
    logger.info(`[STARTUP] Modo: ${process.env.SENDGRID_API_KEY ? 'SendGrid LIVE' : 'MOCK (logs)'}`);

  } catch (err) {
    logger.error('[STARTUP] Error fatal al arrancar Email Service:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('[SHUTDOWN] SIGTERM recibido...');
  await rabbitmq.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[SHUTDOWN] SIGINT recibido...');
  await rabbitmq.disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[ERROR] Unhandled Rejection:', reason);
  process.exit(1);
});

main();