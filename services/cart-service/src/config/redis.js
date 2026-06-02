'use strict';

const Redis  = require('ioredis');
const logger = require('./logger');

// =============================================================================
// Conexión a Redis — Cart Service
//
// Redis almacena los carritos como hashes con TTL.
// Estructura de cada carrito en Redis:
//
//   Key:   cart:{userId}
//   Type:  Hash
//   Field: {bookId}
//   Value: JSON con { bookId, title, price, quantity, addedAt }
//
// TTL: 7 días para usuarios autenticados
//      1 día  para usuarios anónimos (si se implementa en el futuro)
// =============================================================================

const CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días

const redis = new Redis({
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  // Reintentar conexión automáticamente
  retryStrategy: (times) => {
    const delay = Math.min(times * 500, 5000); // máx 5 segundos entre reintentos
    logger.warn(`[Redis] Reintentando conexión (intento ${times}), esperando ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info('[Redis] Conectado correctamente');
});

redis.on('error', (err) => {
  logger.error('[Redis] Error de conexión:', { error: err.message });
});

redis.on('close', () => {
  logger.warn('[Redis] Conexión cerrada');
});

// =============================================================================
// Helpers de carrito
// Encapsulan las operaciones Redis específicas del carrito
// =============================================================================

const cartKey = (userId) => `cart:${userId}`;

const CartRedis = {

  // Obtener todos los items del carrito de un usuario
  async getCart(userId) {
    const data = await redis.hgetall(cartKey(userId));
    if (!data || Object.keys(data).length === 0) return [];

    return Object.values(data).map(item => JSON.parse(item));
  },

  // Agregar o actualizar un item en el carrito
  async setItem(userId, bookId, itemData) {
    const key = cartKey(userId);
    await redis.hset(key, bookId, JSON.stringify(itemData));
    // Renovar el TTL cada vez que se modifica el carrito
    await redis.expire(key, CART_TTL_SECONDS);
  },

  // Eliminar un item específico del carrito
  async removeItem(userId, bookId) {
    await redis.hdel(cartKey(userId), bookId);
    // Si el carrito quedó vacío, eliminar la key
    const remaining = await redis.hlen(cartKey(userId));
    if (remaining === 0) await redis.del(cartKey(userId));
  },

  // Obtener un item específico
  async getItem(userId, bookId) {
    const data = await redis.hget(cartKey(userId), bookId);
    return data ? JSON.parse(data) : null;
  },

  // Vaciar el carrito completo (llamado por Order Service via gRPC)
  async clearCart(userId) {
    await redis.del(cartKey(userId));
  },

  // Verificar si el carrito existe
  async cartExists(userId) {
    return await redis.exists(cartKey(userId)) === 1;
  },

  // Obtener el TTL restante del carrito en segundos
  async getTTL(userId) {
    return await redis.ttl(cartKey(userId));
  },
};

module.exports = { redis, CartRedis, CART_TTL_SECONDS };