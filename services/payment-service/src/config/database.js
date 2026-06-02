'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

// =============================================================================
// PostgreSQL — schema: payments
//
// Tablas:
//   - payment_intents  → registro de cada intento de pago
//   - payment_methods  → métodos de pago guardados (para el futuro)
//
// Principio de idempotencia:
//   El campo order_id tiene UNIQUE constraint.
//   Si llega el mismo evento order.created dos veces (duplicado de RabbitMQ),
//   el INSERT falla y el consumer lo detecta sin procesar el pago dos veces.
// =============================================================================

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'payment_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'bookstore_main',
  options:  `-c search_path=${process.env.DB_SCHEMA || 'payments'},public`,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('[DB] Error en pool PostgreSQL:', err);
});

const db = {
  query: (text, params) => pool.query(text, params),

  getClient: () => pool.connect(),

  connect: async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      const res = await client.query('SELECT current_schema(), current_user');
      logger.info(`[DB] Conectado — schema: ${res.rows[0].current_schema}, usuario: ${res.rows[0].current_user}`);
    } finally {
      client.release();
    }
  },

  runMigrations: async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id            UUID NOT NULL UNIQUE,
        user_id             UUID NOT NULL,
        amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
        currency            VARCHAR(3) NOT NULL DEFAULT 'usd',
        status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','processing','succeeded','failed','refunded','cancelled')),
        stripe_payment_id   VARCHAR(255),
        stripe_client_secret VARCHAR(500),
        failure_reason      TEXT,
        metadata            JSONB DEFAULT '{}',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_payment_intents_order_id
        ON payment_intents(order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id
        ON payment_intents(user_id);
      CREATE INDEX IF NOT EXISTS idx_payment_intents_status
        ON payment_intents(status);
    `);

    logger.info('[DB] Migraciones ejecutadas — tabla payment_intents verificada');
  },

  disconnect: async () => {
    await pool.end();
    logger.info('[DB] Pool PostgreSQL cerrado');
  },
};

module.exports = db;