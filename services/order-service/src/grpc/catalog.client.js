'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

const PROTO_PATH = path.join(__dirname, '../../proto/catalog.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const catalogProto = grpc.loadPackageDefinition(packageDef).catalog;

const catalogClient = new catalogProto.CatalogService(
  process.env.CATALOG_GRPC_URL || 'localhost:50052',
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': true,
  }
);

// Descuenta stock al confirmar una orden
function deductStock(orderId, items) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 10); // más tiempo para operación crítica

    const grpcItems = items.map(item => ({
      book_id:  item.bookId,
      quantity: item.quantity,
    }));

    catalogClient.DeductStock(
      { order_id: orderId, items: grpcItems },
      { deadline },
      (err, response) => {
        if (err) {
          logger.error('[gRPC Catalog] DeductStock error:', { error: err.message });
          return reject(new Error('Error al descontar stock'));
        }
        resolve(response);
      }
    );
  });
}

// Restaura stock si el pago falla (patrón de compensación)
function restoreStock(orderId, items) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 10);

    const grpcItems = items.map(item => ({
      book_id:  item.bookId,
      quantity: item.quantity,
    }));

    catalogClient.RestoreStock(
      { order_id: orderId, items: grpcItems },
      { deadline },
      (err, response) => {
        if (err) {
          logger.error('[gRPC Catalog] RestoreStock error:', { error: err.message });
          return reject(new Error('Error al restaurar stock'));
        }
        resolve(response);
      }
    );
  });
}

module.exports = { deductStock, restoreStock };