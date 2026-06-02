'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

const PROTO_PATH = path.join(__dirname, '../../proto/auth.proto');

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDef).auth;

const authClient = new authProto.AuthService(
  process.env.AUTH_GRPC_URL || 'localhost:50051',
  grpc.credentials.createInsecure(),
  {
    'grpc.keepalive_time_ms': 10000,
    'grpc.keepalive_timeout_ms': 5000,
    'grpc.keepalive_permit_without_calls': true,
  }
);

// Verifica un JWT — usado en el middleware de autenticación
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    authClient.VerifyToken({ token }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Auth] VerifyToken error:', { error: err.message });
        return reject(new Error('Error al verificar autenticación'));
      }
      resolve(response);
    });
  });
}

// Obtiene datos del usuario — para incluir en la orden (nombre, email)
function getUser(userId) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    authClient.GetUser({ user_id: userId }, { deadline }, (err, response) => {
      if (err) {
        logger.error('[gRPC Auth] GetUser error:', { error: err.message });
        return reject(new Error('Error al obtener datos del usuario'));
      }
      resolve(response);
    });
  });
}

module.exports = { verifyToken, getUser };