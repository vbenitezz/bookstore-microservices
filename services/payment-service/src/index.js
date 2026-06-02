'use strict';

require('dotenv').config();

const { startRestServer }   = require('./rest');
const db                    = require('./config/database');
const rabbitmq              = require('./config/rabbitmq');
const { handleOrderCreated } = require('./consumers/order.consumer');
const logger                = require('./config/logger');

// =============================================================================
// Payment Service — Arranque
//
// Secuencia de inicio:
//   1. Conectar a PostgreSQL (schema: payments)
//   2. Ejecutar migraciones
//   3. Conectar a RabbitMQ
//   4. Registrar consumer de order.created
//   5. Arrancar servidor REST (consultas + webhook)
//
// Este servicio es principalmente reactivo — vive escuchando eventos.
// El servidor REST solo expone endpoints de consulta y el webhook de Stripe.
// =============================================================================

async function main() {
  try {
    // 1 & 2. Base de datos
    await db.connect();
    await db.runMigrations();

    // 3. RabbitMQ
    await rabbitmq.connect();

    // 4. Registrar consumer — a partir de aquí procesa eventos order.created
    await rabbitmq.consumeOrders(handleOrderCreated);
    logger.info('[STARTUP] Consumer de order.created activo');

    // 5. Servidor REST
    const port = parseInt(process.env.PORT || '3005', 10);
    await startRestServer(port);
    logger.info(`[REST] Payment Service escuchando en :${port}`);

  } catch (err) {
    logger.error('[STARTUP] Error fatal al arrancar Payment Service:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('[SHUTDOWN] SIGTERM recibido...');
  await rabbitmq.disconnect();
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[SHUTDOWN] SIGINT recibido...');
  await rabbitmq.disconnect();
  await db.disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[ERROR] Unhandled Rejection:', reason);
  process.exit(1);
});

main();