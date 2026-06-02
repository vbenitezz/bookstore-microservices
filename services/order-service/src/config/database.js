'use strict';

const { Pool } = require('pg');
const logger   = require('./logger');

// =============================================================================
// Conexión a PostgreSQL — schema: orders
//
// El Order Service se conecta con order_user que solo tiene permisos
// sobre el schema "orders". Nunca puede acceder a auth, catalog o payments.
//
// Tablas del schema orders:
//   - orders       → cabecera de la orden
//   - order_items  → detalle de libros por orden
// =============================================================================

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'order_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME     || 'bookstore_main',
  options:  `-c search_path=${process.env.DB_SCHEMA || 'orders'},public`,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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

  // Migraciones inline — crea tablas del schema orders
  runMigrations: async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','paid','shipped','delivered','cancelled','refunded')),
        total           NUMERIC(10,2) NOT NULL CHECK (total > 0),
        shipping_name   VARCHAR(200),
        shipping_email  VARCHAR(255),
        shipping_address TEXT,
        notes           TEXT,
        paid_at         TIMESTAMPTZ,
        shipped_at      TIMESTAMPTZ,
        delivered_at    TIMESTAMPTZ,
        cancelled_at    TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        book_id    UUID NOT NULL,
        title      VARCHAR(300) NOT NULL,
        author     VARCHAR(200) NOT NULL,
        price      NUMERIC(10,2) NOT NULL CHECK (price > 0),
        quantity   INTEGER NOT NULL CHECK (quantity > 0),
        subtotal   NUMERIC(10,2) NOT NULL CHECK (subtotal > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `);

    logger.info('[DB] Migraciones ejecutadas — tablas orders y order_items verificadas');
  },

  disconnect: async () => {
    await pool.end();
    logger.info('[DB] Pool PostgreSQL cerrado');
  },
};

module.exports = db;