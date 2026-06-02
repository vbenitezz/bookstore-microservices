'use strict';

const router            = require('express').Router();
const paymentController = require('../controllers/payment.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

// =============================================================================
// Rutas del Payment Service
//
// IMPORTANTE sobre el webhook:
//   La ruta /webhook necesita el body RAW (Buffer), no JSON parseado.
//   Por eso se define ANTES de que el middleware express.json() se aplique.
//   En rest.js el webhook se monta con express.raw() específicamente.
// =============================================================================

// GET /payments/intent/:orderId → client_secret para confirmar pago en frontend
router.get('/intent/:orderId',
  requireAuth,
  paymentController.getPaymentIntent
);

// GET /payments → historial de pagos del usuario autenticado
router.get('/',
  requireAuth,
  paymentController.listPayments
);

// GET /payments/:orderId → estado del pago de una orden específica
router.get('/:orderId',
  requireAuth,
  paymentController.getPaymentByOrder
);

module.exports = router;