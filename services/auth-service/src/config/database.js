'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'auth_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'bookstore_main',
  options:  `-c search_path=${process.env.DB_SCHEMA || 'auth'},public`,
  // SSL requerido para RDS en producción
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('[DB] Error inesperado en pool PostgreSQL:', err);
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
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name    VARCHAR(100) NOT NULL,
        last_name     VARCHAR(100) NOT NULL,
        role          VARCHAR(20)  NOT NULL DEFAULT 'customer'
                        CHECK (role IN ('customer', 'admin')),
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(255) UNIQUE NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        revoked     BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);
  },

  disconnect: async () => {
    await pool.end();
    logger.info('[DB] Pool PostgreSQL cerrado');
  },
};

module.exports = db;