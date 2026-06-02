'use strict';

const path        = require('path');
const grpc        = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const logger      = require('../config/logger');

// =============================================================================
// Auth Middleware — Payment Service
//
// A diferencia de otros servicios, aquí cargamos el proto y creamos
// el cliente gRPC directamente en este archivo para mantener el
// Payment Service simple (no tiene carpeta grpc/ propia).
// =============================================================================

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
  }
);

function verifyTokenGrpc(token) {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);

    authClient.VerifyToken({ token }, { deadline }, (err, response) => {
      if (err) return reject(new Error('Error al verificar autenticación'));
      resolve(response);
    });
  });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error:   'unauthorized',
      message: 'Token de autenticación requerido',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const result = await verifyTokenGrpc(token);

    if (!result.valid) {
      return res.status(401).json({
        error:   'invalid_token',
        message: result.error || 'Token inválido o expirado',
      });
    }

    req.user = {
      userId: result.user_id,
      email:  result.email,
      role:   result.role,
    };

    next();
  } catch (err) {
    logger.error('[AUTH] Auth Service no disponible:', { error: err.message });
    return res.status(503).json({
      error:   'auth_service_unavailable',
      message: 'Servicio de autenticación no disponible temporalmente',
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized', message: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error:   'forbidden',
        message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };