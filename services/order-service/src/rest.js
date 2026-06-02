'use strict';

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const rateLimit    = require('express-rate-limit');
const logger       = require('./config/logger');
const orderRoutes  = require('./routes/order.routes');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'too_many_requests', message: 'Demasiadas solicitudes' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  app.use(express.json({ limit: '10kb' }));

  // Correlation ID
  app.use((req, res, next) => {
    req.correlationId = req.headers['x-request-id'] || `order-${Date.now()}`;
    res.setHeader('X-Request-ID', req.correlationId);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('HTTP Request', {
        method:        req.method,
        path:          req.path,
        status:        res.statusCode,
        duration_ms:   Date.now() - start,
        correlationId: req.correlationId,
      });
    });
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status:  'ok',
      service: 'order-service',
      uptime:  process.uptime(),
    });
  });

  // Rutas
  app.use('/orders', orderRoutes);

  // Error handler global
  app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
      error:         err.message,
      stack:         err.stack,
      correlationId: req.correlationId,
    });
    res.status(err.status || 500).json({
      error:   err.code || 'internal_error',
      message: process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message,
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Ruta no encontrada' });
  });

  return app;
}

function startRestServer(port) {
  return new Promise((resolve, reject) => {
    const app    = createApp();
    const server = app.listen(port, '0.0.0.0', () => resolve(server));
    server.on('error', reject);
  });
}

module.exports = { createApp, startRestServer };