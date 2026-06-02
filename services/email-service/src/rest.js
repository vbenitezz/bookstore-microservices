'use strict';

const express = require('express');
const helmet  = require('helmet');
const logger  = require('./config/logger');

// =============================================================================
// Servidor Express del Email Service
//
// Este servicio es principalmente reactivo (consume eventos de RabbitMQ).
// El servidor REST solo expone el health check para Docker y Kubernetes.
// No tiene endpoints de negocio — no acepta requests del frontend.
// =============================================================================

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // Correlation ID
  app.use((req, res, next) => {
    req.correlationId = req.headers['x-request-id'] || `email-${Date.now()}`;
    res.setHeader('X-Request-ID', req.correlationId);
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status:  'ok',
      service: 'email-service',
      uptime:  process.uptime(),
      mode:    process.env.SENDGRID_API_KEY ? 'live' : 'mock',
    });
  });

  // 404
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