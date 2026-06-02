'use strict';

const router          = require('express').Router();
const orderController = require('../controllers/order.controller');
const { requireAuth, requireRole }  = require('../middlewares/auth.middleware');
const { validateBody, createOrderSchema, updateStatusSchema } = require('../middlewares/validate.middleware');

// POST   /orders              → crear orden desde el carrito
router.post('/',
  requireAuth,
  validateBody(createOrderSchema),
  orderController.createOrder
);

// GET    /orders              → listar mis órdenes (con paginación y filtro por status)
router.get('/',
  requireAuth,
  orderController.listOrders
);

// GET    /orders/:orderId     → detalle de una orden
router.get('/:orderId',
  requireAuth,
  orderController.getOrder
);

// DELETE /orders/:orderId     → cancelar orden (solo si está en 'pending')
router.delete('/:orderId',
  requireAuth,
  orderController.cancelOrder
);

// PATCH  /orders/:orderId/status → actualizar estado (solo admin)
router.patch('/:orderId/status',
  requireAuth,
  requireRole('admin'),
  validateBody(updateStatusSchema),
  orderController.updateStatus
);

module.exports = router;