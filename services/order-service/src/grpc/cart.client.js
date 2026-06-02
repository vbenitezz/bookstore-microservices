'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

const PROTO_PATH = path.join(__dirname, '../../proto/cart.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const cartProto = grpc.loadPackageDefinition(packageDef).cart;

const cartClient = new cartProto.CartService(
  process.env.CART_GRPC_URL || 'localhost:50053',
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': true,
  }
);

// Obtiene el contenido del carrito de un usuario
function getCart(userId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    cartClient.GetCart({ user_id: userId }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Cart] GetCart error:', { error: err.message });
        return reject(new Error('Error al obtener carrito'));
      }
      resolve(response);
    });
  });
}

// Vacía el carrito tras crear la orden exitosamente
function clearCart(userId, orderId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    cartClient.ClearCart(
      { user_id: userId, order_id: orderId },
      { deadline },
      (err, response) => {
        if (err) {
          // No fallar la orden si no se puede limpiar el carrito
          // Es mejor tener una orden creada con carrito sucio que perder la orden
          logger.error('[gRPC Cart] ClearCart error (non-fatal):', { error: err.message });
          return resolve({ success: false, error: err.message });
        }
        resolve(response);
      }
    );
  });
}

module.exports = { getCart, clearCart };