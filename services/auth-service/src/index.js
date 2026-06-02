'use strict';
 
require('dotenv').config();
 
const { startRestServer }  = require('./rest');
const { startGrpcServer }  = require('./grpc/server');
const logger               = require('./config/logger');
const db                   = require('./config/database');
 
// =============================================================================
// Arranque del servicio
// El Auth Service expone dos servidores en paralelo:
//   1. REST (Express) — recibe llamadas desde el API Gateway (frontend)
//   2. gRPC           — recibe llamadas internas de Cart y Order Service
// =============================================================================
 
async function main() {
  try {
    // 1. Conectar a la base de datos
    await db.connect();
    logger.info('[DB] Conectado a PostgreSQL (schema: auth)');
 
    // 2. Ejecutar migraciones si las hay
    await db.runMigrations();
    logger.info('[DB] Migraciones ejecutadas');
 
    // 3. Arrancar servidor REST
    const restPort = parseInt(process.env.PORT || '3001', 10);
    await startRestServer(restPort);
    logger.info(`[REST] Auth Service escuchando en :${restPort}`);
 
    // 4. Arrancar servidor gRPC
    const grpcPort = parseInt(process.env.GRPC_PORT || '50051', 10);
    await startGrpcServer(grpcPort);
    logger.info(`[gRPC] Auth Service escuchando en :${grpcPort}`);
 
  } catch (err) {
    logger.error('[STARTUP] Error fatal al arrancar Auth Service:', err);
    process.exit(1);
  }
}
 
// Manejo de señales para shutdown graceful
process.on('SIGTERM', async () => {
  logger.info('[SHUTDOWN] SIGTERM recibido, cerrando conexiones...');
  await db.disconnect();
  process.exit(0);
});
 
process.on('SIGINT', async () => {
  logger.info('[SHUTDOWN] SIGINT recibido, cerrando conexiones...');
  await db.disconnect();
  process.exit(0);
});
 
process.on('unhandledRejection', (reason) => {
  logger.error('[ERROR] Unhandled Rejection:', reason);
  process.exit(1);
});
 
main();