'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { CartRedis } = require('../config/redis');
const logger      = require('../config/logger');

// =============================================================================
// Servidor gRPC del Cart Service
//
// Expone dos métodos para que Order Service los consuma:
//   - GetCart   → retorna el contenido del carrito de un usuario
//   - ClearCart → vacía el carrito tras crear una orden exitosa
//
// Order Service llama GetCart para construir la orden,
// luego llama ClearCart para limpiar el carrito.
// =============================================================================

// const PROTO_PATH = process.env.PROTO_DIR
//   ? path.join(process.env.PROTO_DIR, 'auth.proto')
//   : path.join(__dirname, '../../../proto/auth.proto');
const PROTO_PATH = path.join(__dirname, '../../proto/cart.proto');


const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const cartProto = grpc.loadPackageDefinition(packageDef).cart;

// --- Implementaciones ---

async function getCart(call, callback) {
  const { user_id } = call.request;

  try {
    const items = await CartRedis.getCart(user_id);

    if (!items.length) {
      return callback(null, {
        found:   false,
        user_id,
        items:   [],
        total:   0,
      });
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const grpcItems = items.map(item => ({
      book_id:  item.bookId,
      title:    item.title,
      price:    item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity,
    }));

    return callback(null, {
      found:   true,
      user_id,
      items:   grpcItems,
      total:   Math.round(total * 100) / 100,
    });

  } catch (err) {
    logger.error('[gRPC Cart] GetCart error:', err);
    return callback({
      code:    grpc.status.INTERNAL,
      message: 'Error al obtener carrito',
    });
  }
}

async function clearCart(call, callback) {
  const { user_id, order_id } = call.request;

  try {
    await CartRedis.clearCart(user_id);
    logger.info('[gRPC Cart] Carrito vaciado', { userId: user_id, orderId: order_id });

    return callback(null, { success: true });

  } catch (err) {
    logger.error('[gRPC Cart] ClearCart error:', err);
    return callback(null, {
      success: false,
      error:   err.message,
    });
  }
}

// --- Arranque ---

function startGrpcServer(port) {
  return new Promise((resolve, reject) => {
    const server = new grpc.Server();

    server.addService(cartProto.CartService.service, {
      GetCart:   getCart,
      ClearCart: clearCart,
    });

    const address = `0.0.0.0:${port}`;

    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error('[gRPC Cart] Error al arrancar servidor:', err);
        return reject(err);
      }
      logger.info(`[gRPC Cart] Servidor en ${address}`);
      resolve({ server, port: boundPort });
    });
  });
}

module.exports = { startGrpcServer };