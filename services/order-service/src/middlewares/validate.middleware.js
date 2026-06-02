'use strict';

const Joi = require('joi');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field:   d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        error:   'validation_error',
        message: 'Datos de entrada inválidos',
        details,
      });
    }

    req.body = value;
    next();
  };
}

// Schema para crear una orden desde el carrito
const createOrderSchema = Joi.object({
  // Datos de envío opcionales — si no se envían se usan los del perfil
  shipping_name:    Joi.string().max(200).optional(),
  shipping_email:   Joi.string().email().max(255).optional(),
  shipping_address: Joi.string().max(500).optional(),
  notes:            Joi.string().max(500).optional(),
});

// Schema para actualizar estado (solo admin)
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid('confirmed', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded')
    .required(),
  notes: Joi.string().max(500).optional(),
});

module.exports = { validateBody, createOrderSchema, updateStatusSchema };