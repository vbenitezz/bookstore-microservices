'use strict';

const { verifyToken } = require('../grpc/auth.client');
const logger          = require('../config/logger');

// =============================================================================
// Middleware de autenticación — Cart Service
//
// A diferencia del Auth Service (que verifica el JWT localmente),
// este servicio delega la verificación al Auth Service via gRPC.
//
// Por qué no verificar el JWT localmente aquí:
//   - Requeriría compartir el JWT_SECRET entre servicios
//   - Si el usuario se desactiva, el token local seguiría siendo válido
//   - El Auth Service es la única fuente de verdad de autenticación
// =============================================================================

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
    const result = await verifyToken(token);

    if (!result.valid) {
      return res.status(401).json({
        error:   'invalid_token',
        message: result.error || 'Token inválido o expirado',
      });
    }

    // Adjuntar datos del usuario al request para uso en controladores
    req.user = {
      userId: result.user_id,
      email:  result.email,
      role:   result.role,
    };

    logger.debug('[AUTH] Token verificado via gRPC', { userId: result.user_id });
    next();

  } catch (err) {
    // Si Auth Service no está disponible
    logger.error('[AUTH] Auth Service no disponible:', { error: err.message });
    return res.status(503).json({
      error:   'auth_service_unavailable',
      message: 'Servicio de autenticación no disponible temporalmente',
    });
  }
}

module.exports = { requireAuth };