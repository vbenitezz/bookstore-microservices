'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

// =============================================================================
// Cliente gRPC — Auth Service
//
// El Cart Service llama a Auth Service para verificar el JWT
// antes de permitir cualquier operación sobre el carrito.
//
// Flujo:
//   Request HTTP → Cart Service → gRPC VerifyToken → Auth Service
//                                                   ↓
//                               retorna { valid, userId, email, role }
// =============================================================================

// const PROTO_PATH = process.env.PROTO_DIR
//   ? path.join(process.env.PROTO_DIR, 'auth.proto')
//   : path.join(__dirname, '../../../proto/auth.proto');

const PROTO_PATH = path.join(__dirname, '../../proto/auth.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDef).auth;

// Crear el cliente gRPC apuntando al Auth Service
// La URL viene del .env: AUTH_GRPC_URL=auth-service:50051
const authClient = new authProto.AuthService(
  process.env.AUTH_GRPC_URL || 'localhost:50051',
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': true,
  }
);

// =============================================================================
// Promisify — convertir callbacks gRPC a Promises
// =============================================================================

/**
 * Verifica un JWT llamando al Auth Service via gRPC.
 * @param {string} token — JWT sin el prefijo "Bearer "
 * @returns {Promise<{valid, userId, email, role, error}>}
 */
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5); // timeout 5s

    authClient.VerifyToken({ token }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Auth] Error en VerifyToken:', { error: err.message });
        // Si el Auth Service no responde, rechazamos el request
        return reject(new Error('Error al verificar autenticación'));
      }
      resolve(response);
    });
  });
}

/**
 * Obtiene el perfil de un usuario por su ID.
 * @param {string} userId — UUID del usuario
 */
function getUser(userId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    authClient.GetUser({ user_id: userId }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Auth] Error en GetUser:', { error: err.message });
        return reject(new Error('Error al obtener usuario'));
      }
      resolve(response);
    });
  });
}

module.exports = { verifyToken, getUser };