'use strict';

const express         = require('express');
const helmet          = require('helmet');
const cors            = require('cors');
const logger          = require('./config/logger');
const paymentRoutes   = require('./routes/payment.routes');
const { handleWebhook } = require('./controllers/payment.controller');

// =============================================================================
// Servidor Express — Payment Service
//
// Detalle crítico del webhook de Stripe:
//   Stripe verifica la autenticidad del evento usando la firma HMAC del
//   body RAW. Si Express parsea el body como JSON antes de verificar,
//   la firma falla. Por eso el webhook usa express.raw() en lugar de
//   express.json(), y se monta ANTES del middleware global de JSON.
// =============================================================================

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'Stripe-Signature'],
  }));

  // Correlation ID
  app.use((req, res, next) => {
    req.correlationId = req.headers['x-request-id'] || `pay-${Date.now()}`;
    res.setHeader('X-Request-ID', req.correlationId);
    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('HTTP Request', {
        method:      req.method,
        path:        req.path,
        status:      res.statusCode,
        duration_ms: Date.now() - start,
      });
    });
    next();
  });

  // Health check (antes de cualquier parser)
  app.get('/health', (req, res) => {
    res.json({
      status:  'ok',
      service: 'payment-service',
      uptime:  process.uptime(),
    });
  });

  // ==========================================================================
  // WEBHOOK de Stripe — debe usar express.raw() para preservar el body sin parsear
  // Se monta ANTES del express.json() global
  // ==========================================================================
  app.post(
    '/payments/webhook',
    express.raw({ type: 'application/json' }),
    handleWebhook
  );

  // JSON parser para el resto de rutas
  app.use(express.json({ limit: '10kb' }));

  // Rutas REST normales
  app.use('/payments', paymentRoutes);

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