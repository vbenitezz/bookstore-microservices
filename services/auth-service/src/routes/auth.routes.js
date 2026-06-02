'use strict';

const router             = require('express').Router();
const authController     = require('../controllers/auth.controller');
const { validateBody }   = require('../middlewares/validate.middleware');
const { requireAuth }    = require('../middlewares/auth.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require('../middlewares/auth.schemas');

// POST /auth/register
router.post('/register', validateBody(registerSchema), authController.register);

// POST /auth/login
router.post('/login', validateBody(loginSchema), authController.login);

// POST /auth/refresh
router.post('/refresh', validateBody(refreshSchema), authController.refresh);

// POST /auth/logout  (requiere autenticación)
router.post('/logout', requireAuth, authController.logout);

// GET /auth/me  (retorna datos del usuario autenticado)
router.get('/me', requireAuth, authController.me);

module.exports = router;