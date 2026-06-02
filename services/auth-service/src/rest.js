'use strict';

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const logger     = require('./config/logger');
const authRoutes = require('./routes/auth.routes');

// =============================================================================
// Servidor REST del Auth Service
// Maneja: /register, /login, /refresh, /logout, /health
// =============================================================================

function createApp() {
  const app = express();

  // --- Seguridad ---
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // --- Rate limiting en rutas de autenticación ---
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,                   // 20 intentos por ventana
    message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // --- Parsers ---
  app.use(express.json({ limit: '10kb' }));

  // --- Correlation ID: propagar el ID del request de Nginx ---
  app.use((req, res, next) => {
    req.correlationId = req.headers['x-request-id'] || `local-${Date.now()}`;
    res.setHeader('X-Request-ID', req.correlationId);
    next();
  });

  // --- Request logging ---
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('HTTP Request', {
        method:        req.method,
        path:          req.path,
        status:        res.statusCode,
        duration_ms:   Date.now() - start,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
    });
    next();
  });

  // --- Health check ---
  app.get('/health', (req, res) => {
    res.json({
      status:  'ok',
      service: 'auth-service',
      uptime:  process.uptime(),
      ts:      new Date().toISOString(),
    });
  });

  // --- Rutas de autenticación ---
  app.use('/auth', authLimiter, authRoutes);

  // --- Manejo de errores global ---
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      error:         err.message,
      stack:         err.stack,
      correlationId: req.correlationId,
    });

    const status = err.status || 500;
    res.status(status).json({
      error:   err.code || 'internal_error',
      message: process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message,
    });
  });

  // --- 404 ---
  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Ruta no encontrada' });
  });

  return app;
}

function startRestServer(port) {
  return new Promise((resolve, reject) => {
    const app    = createApp();
    const server = app.listen(port, '0.0.0.0', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = { createApp, startRestServer };