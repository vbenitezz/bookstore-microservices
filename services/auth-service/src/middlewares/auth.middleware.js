'use strict';

const jwt = require('jsonwebtoken');

// =============================================================================
// Middleware de autenticación JWT
//
// requireAuth   → verifica que el request tenga un JWT válido.
//                 Adjunta req.user = { userId, email, role } si es válido.
//
// requireRole   → verifica que req.user tenga el rol requerido.
//                 Siempre debe usarse después de requireAuth.
//
// Uso en rutas:
//   router.get('/me', requireAuth, controller.me)
//   router.delete('/users/:id', requireAuth, requireRole('admin'), controller.delete)
// =============================================================================

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error:   'unauthorized',
      message: 'Token de autenticación requerido',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, email, role, iat, exp }
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      error:   isExpired ? 'token_expired' : 'invalid_token',
      message: isExpired ? 'El token ha expirado' : 'Token inválido',
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error:   'unauthorized',
        message: 'No autenticado',
      });
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