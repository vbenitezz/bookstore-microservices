'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

// =============================================================================
// Cliente gRPC — Catalog Service
//
// El Cart Service llama a Catalog Service para:
//   1. Obtener datos del libro (título, precio, portada) al agregar al carrito
//   2. Verificar que hay stock suficiente antes de agregar
//
// Por qué gRPC y no REST:
//   - Llamada interna entre servicios → no necesita pasar por Nginx
//   - Más eficiente que HTTP/JSON para comunicación síncrona frecuente
//   - Contrato fuertemente tipado definido en catalog.proto
// =============================================================================

// const PROTO_PATH = process.env.PROTO_DIR
//   ? path.join(process.env.PROTO_DIR, 'auth.proto')
//   : path.join(__dirname, '../../../proto/auth.proto');
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

// =============================================================================
// Métodos del cliente
// =============================================================================

/**
 * Obtiene los datos de un libro por su ID.
 * @param {string} bookId — UUID del libro
 * @returns {Promise<{found, bookId, title, author, price, stock, coverUrl, error}>}
 */
function getBook(bookId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    catalogClient.GetBook({ book_id: bookId }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Catalog] Error en GetBook:', { error: err.message, bookId });
        return reject(new Error('Error al obtener información del libro'));
      }
      resolve(response);
    });
  });
}

/**
 * Verifica si hay stock suficiente para una cantidad dada.
 * @param {string} bookId
 * @param {number} quantity
 * @returns {Promise<{available, currentStock, bookId, error}>}
 */
function checkStock(bookId, quantity) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    catalogClient.CheckStock(
      { book_id: bookId, quantity },
      { deadline },
      (err, response) => {
        if (err) {
          logger.error('[gRPC Catalog] Error en CheckStock:', { error: err.message, bookId });
          return reject(new Error('Error al verificar stock'));
        }
        resolve(response);
      }
    );
  });
}

module.exports = { getBook, checkStock };