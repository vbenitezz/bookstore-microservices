'use strict';

const Joi = require('joi');

const registerSchema = Joi.object({
  email:      Joi.string().email().lowercase().max(255).required()
                .messages({ 'string.email': 'Formato de email inválido' }),
  password:   Joi.string().min(8).max(128).required()
                .messages({ 'string.min': 'La contraseña debe tener al menos 8 caracteres' }),
  first_name: Joi.string().trim().min(1).max(100).required(),
  last_name:  Joi.string().trim().min(1).max(100).required(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refresh_token: Joi.string().hex().length(128).required()
    .messages({ 'any.required': 'refresh_token es requerido' }),
});

module.exports = { registerSchema, loginSchema, refreshSchema };