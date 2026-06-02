'use strict';

const { verifyToken } = require('../grpc/auth.client');
const logger          = require('../config/logger');

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