'use strict';

const Joi = require('joi');

// =============================================================================
// Middleware de validación de body con Joi
// Uso: router.post('/register', validateBody(registerSchema), controller)
// =============================================================================

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,   // Reportar todos los errores, no solo el primero
      stripUnknown: true,  // Eliminar campos no definidos en el schema
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

    req.body = value; // Usar el objeto validado y sanitizado
    next();
  };
}

module.exports = { validateBody };