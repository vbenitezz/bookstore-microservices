'use strict';

// =============================================================================
// Tests del Cart Service
// Mockean Redis y los clientes gRPC para no requerir servicios externos
// =============================================================================

// Mock de Redis antes de importar el módulo
jest.mock('../src/config/redis', () => ({
  redis: { ping: jest.fn().mockResolvedValue('PONG') },
  CartRedis: {
    getCart:    jest.fn(),
    setItem:    jest.fn(),
    getItem:    jest.fn(),
    removeItem: jest.fn(),
    clearCart:  jest.fn(),
    cartExists: jest.fn(),
  },
  CART_TTL_SECONDS: 604800,
}));

// Mock de clientes gRPC
jest.mock('../src/grpc/auth.client', () => ({
  verifyToken: jest.fn(),
  getUser:     jest.fn(),
}));

jest.mock('../src/grpc/catalog.client', () => ({
  getBook:    jest.fn(),
  checkStock: jest.fn(),
}));

// Mock del servidor gRPC
jest.mock('../src/grpc/server', () => ({
  startGrpcServer: jest.fn().mockResolvedValue({ server: {}, port: 50053 }),
}));

const request    = require('supertest');
const { createApp } = require('../src/rest');
const { CartRedis } = require('../src/config/redis');
const { verifyToken } = require('../src/grpc/auth.client');
const { getBook, checkStock } = require('../src/grpc/catalog.client');

const app = createApp();

// Token de prueba (el middleware lo valida via gRPC mockeado)
const TEST_TOKEN  = 'Bearer test-token-123';
const TEST_USER   = { user_id: 'user-uuid-123', email: 'test@test.com', role: 'customer', valid: true };
const TEST_BOOK   = {
  found: true, book_id: 'book-uuid-456', title: 'Clean Code',
  author: 'Robert C. Martin', price: 29.99, stock: 50, cover_url: '',
};

// Configurar mock de autenticación antes de cada test
beforeEach(() => {
  verifyToken.mockResolvedValue(TEST_USER);
  jest.clearAllMocks();
  verifyToken.mockResolvedValue(TEST_USER);
});

// =============================================================================
// Health check
// =============================================================================

describe('GET /health', () => {
  it('retorna status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('cart-service');
  });
});

// =============================================================================
// GET /cart
// =============================================================================

describe('GET /cart', () => {
  it('retorna carrito vacío cuando no hay items', async () => {
    CartRedis.getCart.mockResolvedValue([]);

    const res = await request(app)
      .get('/cart')
      .set('Authorization', TEST_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('retorna items del carrito con totales calculados', async () => {
    CartRedis.getCart.mockResolvedValue([
      { bookId: 'book-1', title: 'Clean Code', author: 'Martin', price: 29.99, quantity: 2, coverUrl: '', addedAt: new Date().toISOString() },
    ]);

    const res = await request(app)
      .get('/cart')
      .set('Authorization', TEST_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(59.98);
    expect(res.body.count).toBe(2);
  });

  it('retorna 401 sin token', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(401);
  });

  it('retorna 401 con token inválido', async () => {
    verifyToken.mockResolvedValue({ valid: false, error: 'Token inválido' });

    const res = await request(app)
      .get('/cart')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });
});

// =============================================================================
// POST /cart/items
// =============================================================================

describe('POST /cart/items', () => {
  it('agrega un libro al carrito correctamente', async () => {
    getBook.mockResolvedValue(TEST_BOOK);
    checkStock.mockResolvedValue({ available: true, current_stock: 50 });
    CartRedis.getItem.mockResolvedValue(null); // no existe aún
    CartRedis.setItem.mockResolvedValue('OK');

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', TEST_TOKEN)
      .send({ book_id: 'book-uuid-456', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.item.title).toBe('Clean Code');
    expect(res.body.item.quantity).toBe(2);
  });

  it('retorna 404 si el libro no existe en Catalog', async () => {
    getBook.mockResolvedValue({ found: false });

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', TEST_TOKEN)
      .send({ book_id: 'book-uuid-456', quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('book_not_found');
  });

  it('retorna 409 si no hay stock suficiente', async () => {
    getBook.mockResolvedValue(TEST_BOOK);
    CartRedis.getItem.mockResolvedValue(null);
    checkStock.mockResolvedValue({ available: false, current_stock: 1 });

    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', TEST_TOKEN)
      .send({ book_id: 'book-uuid-456', quantity: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('insufficient_stock');
  });

  it('retorna 400 con quantity inválida', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', TEST_TOKEN)
      .send({ book_id: 'book-uuid-456', quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('retorna 400 con book_id inválido', async () => {
    const res = await request(app)
      .post('/cart/items')
      .set('Authorization', TEST_TOKEN)
      .send({ book_id: 'not-a-uuid', quantity: 1 });

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// DELETE /cart/items/:bookId
// =============================================================================

describe('DELETE /cart/items/:bookId', () => {
  it('elimina un item del carrito', async () => {
    CartRedis.getItem.mockResolvedValue({
      bookId: 'book-uuid-456', title: 'Clean Code', price: 29.99, quantity: 1,
    });
    CartRedis.removeItem.mockResolvedValue(1);

    const res = await request(app)
      .delete('/cart/items/book-uuid-456')
      .set('Authorization', TEST_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('eliminado');
  });

  it('retorna 404 si el item no está en el carrito', async () => {
    CartRedis.getItem.mockResolvedValue(null);

    const res = await request(app)
      .delete('/cart/items/book-uuid-456')
      .set('Authorization', TEST_TOKEN);

    expect(res.status).toBe(404);
  });
});

// =============================================================================
// DELETE /cart
// =============================================================================

describe('DELETE /cart', () => {
  it('vacía el carrito completo', async () => {
    CartRedis.clearCart.mockResolvedValue(1);

    const res = await request(app)
      .delete('/cart')
      .set('Authorization', TEST_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('vaciado');
  });
});