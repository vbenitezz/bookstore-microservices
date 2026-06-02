'use strict';

const { createLogger, format, transports } = require('winston');

// =============================================================================
// Logger — formato JSON estructurado
// Cada log incluye: timestamp, nivel, servicio, correlationId (si existe)
// El correlationId se propaga desde el request HTTP o gRPC para trazar
// un flujo completo entre servicios.
// =============================================================================

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'auth-service',
  },
  transports: [
    new transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? ' ' + JSON.stringify(meta)
                : '';
              return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
            })
          )
        : format.json(),
    }),
  ],
});

module.exports = logger;