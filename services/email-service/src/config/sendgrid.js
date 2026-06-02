'use strict';

const sgMail = require('@sendgrid/mail');
const logger = require('./logger');

// =============================================================================
// SendGrid — Email Service
//
// En desarrollo sin API key, el servicio usa modo mock:
// imprime el email en los logs en lugar de enviarlo.
// Esto permite probar el flujo completo sin una cuenta de SendGrid.
//
// Para usar SendGrid real:
//   1. Crear cuenta en sendgrid.com
//   2. Generar API key con permisos de Mail Send
//   3. Agregar al .env: SENDGRID_API_KEY=SG.xxxxx
//   4. Verificar el email remitente en SendGrid (Sender Authentication)
// =============================================================================

const FROM_EMAIL = process.env.EMAIL_FROM      || 'noreply@bookstore.com';
const FROM_NAME  = process.env.EMAIL_FROM_NAME || 'BookStore';
const IS_MOCK    = !process.env.SENDGRID_API_KEY;

if (!IS_MOCK) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.info('[SendGrid] Configurado con API key real');
} else {
  logger.warn('[SendGrid] Modo MOCK — emails se imprimirán en logs');
}

const EmailSender = {

  /**
   * Envía un email usando SendGrid o lo imprime en logs (modo mock).
   *
   * @param {object} params
   * @param {string} params.to      — email del destinatario
   * @param {string} params.subject — asunto del email
   * @param {string} params.html    — contenido HTML del email
   * @param {string} params.text    — contenido texto plano (fallback)
   */
  async send({ to, subject, html, text }) {
    const msg = {
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      html,
      text: text || subject,
    };

    if (IS_MOCK) {
      // Modo mock: imprimir en logs en lugar de enviar
      logger.info('[EMAIL MOCK] ==========================================');
      logger.info(`[EMAIL MOCK] Para:    ${to}`);
      logger.info(`[EMAIL MOCK] Asunto:  ${subject}`);
      logger.info(`[EMAIL MOCK] Preview: ${text?.substring(0, 100) || 'Ver HTML'}...`);
      logger.info('[EMAIL MOCK] ==========================================');
      return { mock: true, to, subject };
    }

    try {
      const response = await sgMail.send(msg);
      logger.info('[SendGrid] Email enviado', {
        to,
        subject,
        statusCode: response[0]?.statusCode,
      });
      return response;
    } catch (err) {
      logger.error('[SendGrid] Error al enviar email', {
        to,
        subject,
        error: err.message,
        body:  err.response?.body,
      });
      throw err;
    }
  },
};

module.exports = { EmailSender };