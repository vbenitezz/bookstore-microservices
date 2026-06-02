'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/database');
const logger = require('../config/logger');

// =============================================================================
// Auth Controller
// Implementa el ciclo completo de autenticación:
//   register → login → refresh → logout
//
// Tokens:
//   - Access token:  JWT de corta vida (15m), enviado en header Authorization
//   - Refresh token: opaco de larga vida (7d), guardado en DB hasheado
// =============================================================================

const BCRYPT_ROUNDS = 12;

// Genera el par de tokens (access + refresh)
function generateTokens(userId, email, role) {
  const accessToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  // El refresh token es un string aleatorio opaco (no JWT)
  const refreshToken = crypto.randomBytes(64).toString('hex');

  return { accessToken, refreshToken };
}

// Guarda el refresh token hasheado en la DB
async function saveRefreshToken(userId, rawToken) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  return tokenHash;
}

// --- register ---
async function register(req, res, next) {
  const { email, password, first_name, last_name } = req.body;

  try {
    // Verificar si el email ya existe
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        error:   'email_taken',
        message: 'Ya existe una cuenta con ese email',
      });
    }

    // Hash del password
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Crear usuario
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), password_hash, first_name, last_name]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[AUTH] Usuario registrado', { userId: user.id, email: user.email });

    return res.status(201).json({
      user: {
        id:         user.id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role:       user.role,
      },
      access_token:  accessToken,
      refresh_token: refreshToken,
    });

  } catch (err) {
    next(err);
  }
}

// --- login ---
async function login(req, res, next) {
  const { email, password } = req.body;

  try {
    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];

    // Comparar siempre (evitar timing attacks) aunque el usuario no exista
    const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attacks.xxxxxxxxxx';
    const passwordMatch = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyHash
    );

    if (!user || !passwordMatch || !user.is_active) {
      return res.status(401).json({
        error:   'invalid_credentials',
        message: 'Email o contraseña incorrectos',
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
    await saveRefreshToken(user.id, refreshToken);

    logger.info('[AUTH] Login exitoso', { userId: user.id });

    return res.json({
      user: {
        id:         user.id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role:       user.role,
      },
      access_token:  accessToken,
      refresh_token: refreshToken,
    });

  } catch (err) {
    next(err);
  }
}

// --- refresh ---
async function refresh(req, res, next) {
  const { refresh_token } = req.body;

  try {
    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    const result = await db.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.email, u.role, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1`,
      [tokenHash]
    );

    const record = result.rows[0];

    if (!record || record.revoked || new Date() > record.expires_at || !record.is_active) {
      return res.status(401).json({
        error:   'invalid_refresh_token',
        message: 'Refresh token inválido o expirado',
      });
    }

    // Rotar el refresh token (revocar el viejo, emitir uno nuevo)
    await db.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [record.id]);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      record.user_id,
      record.email,
      record.role
    );
    await saveRefreshToken(record.user_id, newRefreshToken);

    logger.info('[AUTH] Token rotado', { userId: record.user_id });

    return res.json({
      access_token:  accessToken,
      refresh_token: newRefreshToken,
    });

  } catch (err) {
    next(err);
  }
}

// --- logout ---
async function logout(req, res, next) {
  try {
    // Revocar todos los refresh tokens del usuario
    await db.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false',
      [req.user.userId]
    );

    logger.info('[AUTH] Logout', { userId: req.user.userId });
    return res.json({ message: 'Sesión cerrada correctamente' });

  } catch (err) {
    next(err);
  }
}

// --- me ---
async function me(req, res, next) {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'not_found', message: 'Usuario no encontrado' });
    }

    return res.json({ user: result.rows[0] });

  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me };