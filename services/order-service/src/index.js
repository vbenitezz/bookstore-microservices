'use strict';

require('dotenv').config();

const { startRestServer } = require('./rest');
const db                  = require('./config/database');
const rabbitmq            = require('./config/rabbitmq');
const logger              = require('./config/logger');

// =============================================================================
// Order Service — Arranque
//
// Secuencia de inicio:
//   1. Conectar a PostgreSQL (schema: orders)
//   2. Ejecutar migraciones (crear tablas si no existen)
//   3. Conectar a RabbitMQ (publisher de eventos)
//   4. Arrancar servidor REST
//
// No expone servidor gRPC propio — actúa solo como cliente gRPC
// de Auth, Catalog y Cart Service.
// =============================================================================

async function main() {
  try {
    // 1. Conectar a PostgreSQL
    await db.connect();

    // 2. Migraciones
    await db.runMigrations();

    // 3. Conectar a RabbitMQ (opcional)
    try {
      await rabbitmq.connect();
      logger.info('[STARTUP] RabbitMQ conectado');
    } catch (err) {
      logger.warn('[STARTUP] RabbitMQ no disponible — continuando sin mensajería:', err.message);
    }

    // 4. Arrancar REST
    const restPort = parseInt(process.env.PORT || '3004', 10);
    await startRestServer(restPort);
    logger.info(`[REST] Order Service escuchando en :${restPort}`);

  } catch (err) {
    logger.error('[STARTUP] Error fatal al arrancar Order Service:', err);
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