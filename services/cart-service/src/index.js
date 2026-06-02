'use strict';

require('dotenv').config();

const { startRestServer }  = require('./rest');
const { startGrpcServer }  = require('./grpc/server');
const { redis }            = require('./config/redis');
const logger               = require('./config/logger');

// =============================================================================
// Cart Service — Arranque
//
// Levanta tres conexiones en paralelo:
//   1. Redis      — almacenamiento del carrito
//   2. REST       — API para el frontend via API Gateway
//   3. gRPC server — para que Order Service consuma GetCart y ClearCart
//
// También actúa como gRPC CLIENT de Auth y Catalog,
// pero esas conexiones se crean lazy al primer uso (no en el startup).
// =============================================================================

async function main() {
  try {
    // 1. Verificar conexión a Redis
    await redis.ping();
    logger.info('[Redis] Conexión verificada');

    // 2. Arrancar servidor REST
    const restPort = parseInt(process.env.PORT || '3003', 10);
    await startRestServer(restPort);
    logger.info(`[REST] Cart Service escuchando en :${restPort}`);

    // 3. Arrancar servidor gRPC (para que Order Service lo consuma)
    const grpcPort = parseInt(process.env.GRPC_PORT || '50053', 10);
    await startGrpcServer(grpcPort);
    logger.info(`[gRPC] Cart Service escuchando en :${grpcPort}`);

  } catch (err) {
    logger.error('[STARTUP] Error fatal al arrancar Cart Service:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('[SHUTDOWN] SIGTERM recibido...');
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[SHUTDOWN] SIGINT recibido...');
  await redis.quit();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('[ERROR] Unhandled Rejection:', reason);
  process.exit(1);
});

main();