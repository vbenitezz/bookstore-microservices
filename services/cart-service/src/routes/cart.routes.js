'use strict';

const router         = require('express').Router();
const cartController = require('../controllers/cart.controller');
const { requireAuth }                     = require('../middlewares/auth.middleware');
const { validateBody, addItemSchema, updateItemSchema } = require('../middlewares/validate.middleware');

// Todas las rutas del carrito requieren autenticación
// requireAuth llama a Auth Service via gRPC para verificar el JWT

// GET  /cart          → obtener carrito del usuario autenticado
router.get('/', requireAuth, cartController.getCart);

// POST /cart/items    → agregar libro al carrito
router.post('/items', requireAuth, validateBody(addItemSchema), cartController.addItem);

// PUT  /cart/items/:bookId → actualizar cantidad de un libro
router.put('/items/:bookId', requireAuth, validateBody(updateItemSchema), cartController.updateItem);

// DELETE /cart/items/:bookId → quitar libro del carrito
router.delete('/items/:bookId', requireAuth, cartController.removeItem);

// DELETE /cart        → vaciar carrito completo
router.delete('/', requireAuth, cartController.clearCart);

module.exports = router;