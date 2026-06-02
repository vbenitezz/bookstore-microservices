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

// Schemas de validación
const addItemSchema = Joi.object({
  book_id:  Joi.string().uuid().required()
              .messages({ 'string.uuid': 'book_id debe ser un UUID válido' }),
  quantity: Joi.number().integer().min(1).max(99).required()
              .messages({ 'number.min': 'La cantidad mínima es 1', 'number.max': 'La cantidad máxima es 99' }),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(99).required(),
});

module.exports = { validateBody, addItemSchema, updateItemSchema };