'use strict';

const path       = require('path');
const grpc       = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const jwt        = require('jsonwebtoken');
const db         = require('../config/database');
const logger     = require('../config/logger');

// =============================================================================
// Servidor gRPC del Auth Service
//
// Implementa los métodos definidos en /proto/auth.proto:
//   - VerifyToken: valida un JWT y retorna datos del usuario
//   - GetUser: retorna el perfil completo de un usuario por ID
//
// Este servidor escucha en un puerto diferente al REST (50051 vs 3001).
// SOLO es accesible desde dentro de la red Docker (no expuesto al exterior).
// =============================================================================

// Cargar el .proto
const PROTO_PATH = path.join(__dirname, '../../proto/auth.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const authProto = grpc.loadPackageDefinition(packageDefinition).auth;

// --- Implementaciones de los métodos ---

/**
 * VerifyToken — Verifica un JWT y retorna datos del usuario.
 * Llamado por: Cart Service, Order Service
 */
async function verifyToken(call, callback) {
  const { token } = call.request;

  if (!token) {
    return callback(null, {
      valid: false,
      error: 'Token no proporcionado',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario sigue activo en la DB
    const result = await db.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return callback(null, {
        valid: false,
        error: 'Usuario no encontrado o inactivo',
      });
    }

    const user = result.rows[0];
    logger.debug('[gRPC] VerifyToken OK', { userId: user.id });

    return callback(null, {
      valid:   true,
      user_id: user.id,
      email:   user.email,
      role:    user.role,
    });

  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    logger.debug('[gRPC] VerifyToken failed', { error: err.message });

    return callback(null, {
      valid: false,
      error: isExpired ? 'Token expirado' : 'Token inválido',
    });
  }
}

/**
 * GetUser — Retorna el perfil de un usuario por su ID.
 * Llamado por: Order Service (para datos del comprador)
 */
async function getUser(call, callback) {
  const { user_id } = call.request;

  try {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, created_at
       FROM users WHERE id = $1 AND is_active = true`,
      [user_id]
    );

    if (!result.rows.length) {
      return callback(null, { found: false });
    }

    const user = result.rows[0];
    return callback(null, {
      found:      true,
      user_id:    user.id,
      email:      user.email,
      first_name: user.first_name,
      last_name:  user.last_name,
      role:       user.role,
      created_at: user.created_at.toISOString(),
    });

  } catch (err) {
    logger.error('[gRPC] GetUser error:', err);
    return callback({
      code: grpc.status.INTERNAL,
      message: 'Error interno al obtener usuario',
    });
  }
}

// --- Arranque del servidor ---

function startGrpcServer(port) {
  return new Promise((resolve, reject) => {
    const server = new grpc.Server();

    server.addService(authProto.AuthService.service, {
      VerifyToken: verifyToken,
      GetUser:     getUser,
    });

    const address = `0.0.0.0:${port}`;

    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
      if (err) {
        logger.error('[gRPC] Error al arrancar servidor:', err);
        return reject(err);
      }
      logger.info(`[gRPC] Auth Service servidor en ${address}`);
      resolve({ server, port: boundPort });
    });
  });
}

module.exports = { startGrpcServer };