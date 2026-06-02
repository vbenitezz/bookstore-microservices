'use strict';

// =============================================================================
// Templates de Email — BookStore
//
// Cada función retorna { subject, html, text } listo para enviar.
// Usamos HTML inline (sin archivos externos) para máxima compatibilidad
// con clientes de email como Gmail, Outlook, Apple Mail.
// =============================================================================

// Estilos base compartidos entre todos los templates
const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  background-color: #ffffff;
`;

const headerStyle = `
  background-color: #1a1a2e;
  padding: 24px 32px;
  text-align: center;
  border-radius: 8px 8px 0 0;
`;

const bodyStyle = `
  padding: 32px;
  background-color: #f8f9fa;
`;

const footerStyle = `
  padding: 20px 32px;
  text-align: center;
  font-size: 12px;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 0 0 8px 8px;
  border-top: 1px solid #dee2e6;
`;

const buttonStyle = `
  display: inline-block;
  padding: 12px 28px;
  background-color: #0d6efd;
  color: #ffffff;
  text-decoration: none;
  border-radius: 6px;
  font-weight: bold;
  font-size: 15px;
`;

// Componente de tabla de items
function buildItemsTable(items = []) {
  if (!items.length) return '';

  const rows = items.map(item => `
    <tr>
      <td style="padding: 10px 8px; border-bottom: 1px solid #dee2e6; font-size: 14px;">
        ${item.title || item.book_id}
      </td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #dee2e6; text-align: center; font-size: 14px;">
        ${item.quantity}
      </td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #dee2e6; text-align: right; font-size: 14px;">
        $${parseFloat(item.price || 0).toFixed(2)}
      </td>
      <td style="padding: 10px 8px; border-bottom: 1px solid #dee2e6; text-align: right; font-size: 14px; font-weight: bold;">
        $${parseFloat(item.subtotal || (item.price * item.quantity) || 0).toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #e9ecef;">
          <th style="padding: 10px 8px; text-align: left; font-size: 13px; color: #495057;">Libro</th>
          <th style="padding: 10px 8px; text-align: center; font-size: 13px; color: #495057;">Cant.</th>
          <th style="padding: 10px 8px; text-align: right; font-size: 13px; color: #495057;">Precio</th>
          <th style="padding: 10px 8px; text-align: right; font-size: 13px; color: #495057;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// =============================================================================
// Template 1 — Confirmación de compra (payment.success)
// =============================================================================

function orderConfirmation({ orderId, shippingName, email, amount, items = [] }) {
  const name    = shippingName || email || 'Cliente';
  const subject = `✅ Tu orden ha sido confirmada — BookStore`;
  const shortId = orderId?.substring(0, 8) || 'N/A';

  const html = `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📚 BookStore</h1>
        <p style="color: #adb5bd; margin: 8px 0 0; font-size: 14px;">Tu librería digital</p>
      </div>

      <div style="${bodyStyle}">
        <h2 style="color: #212529; margin: 0 0 16px;">¡Gracias por tu compra, ${name}!</h2>
        <p style="color: #495057; line-height: 1.6;">
          Tu orden ha sido confirmada y está siendo procesada.
          Te notificaremos cuando sea enviada.
        </p>

        <div style="background: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px;">
            Número de orden
          </p>
          <p style="margin: 0; font-size: 20px; font-weight: bold; color: #0d6efd; font-family: monospace;">
            #${shortId}
          </p>
        </div>

        ${buildItemsTable(items)}

        <div style="text-align: right; padding: 12px 8px; border-top: 2px solid #dee2e6; margin-top: 4px;">
          <span style="font-size: 16px; font-weight: bold; color: #212529;">
            Total: $${parseFloat(amount || 0).toFixed(2)} USD
          </span>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <p style="color: #495057; margin-bottom: 16px;">¿Tienes preguntas sobre tu orden?</p>
          <a href="mailto:soporte@bookstore.com" style="${buttonStyle}">
            Contactar soporte
          </a>
        </div>
      </div>

      <div style="${footerStyle}">
        <p style="margin: 0;">BookStore — Tu librería digital de confianza</p>
        <p style="margin: 4px 0 0;">© ${new Date().getFullYear()} BookStore. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  const text = `
¡Gracias por tu compra, ${name}!

Número de orden: #${shortId}
Total: $${parseFloat(amount || 0).toFixed(2)} USD

${items.map(i => `- ${i.title} x${i.quantity}: $${parseFloat(i.subtotal || 0).toFixed(2)}`).join('\n')}

¿Preguntas? Escríbenos a soporte@bookstore.com
  `.trim();

  return { subject, html, text };
}

// =============================================================================
// Template 2 — Pago fallido (payment.failed)
// =============================================================================

function paymentFailed({ orderId, shippingName, email, amount, reason }) {
  const name    = shippingName || email || 'Cliente';
  const subject = `❌ Tu pago no pudo procesarse — BookStore`;
  const shortId = orderId?.substring(0, 8) || 'N/A';

  const html = `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📚 BookStore</h1>
      </div>

      <div style="${bodyStyle}">
        <h2 style="color: #dc3545; margin: 0 0 16px;">Hubo un problema con tu pago</h2>
        <p style="color: #495057; line-height: 1.6;">
          Hola ${name}, lamentablemente no pudimos procesar el pago de tu orden
          <strong>#${shortId}</strong> por <strong>$${parseFloat(amount || 0).toFixed(2)} USD</strong>.
        </p>

        ${reason ? `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>Motivo:</strong> ${reason}
          </p>
        </div>
        ` : ''}

        <p style="color: #495057; line-height: 1.6;">
          Puedes intentarlo de nuevo con una tarjeta diferente.
          El stock de los libros ha sido restaurado.
        </p>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost'}/catalog" style="${buttonStyle}">
            Volver al catálogo
          </a>
        </div>
      </div>

      <div style="${footerStyle}">
        <p style="margin: 0;">¿Necesitas ayuda? Escríbenos a soporte@bookstore.com</p>
      </div>
    </div>
  `;

  const text = `
Hola ${name},

Lamentablemente no pudimos procesar el pago de tu orden #${shortId}.
${reason ? `Motivo: ${reason}` : ''}

El stock de los libros ha sido restaurado. Puedes intentarlo de nuevo.

¿Necesitas ayuda? Escríbenos a soporte@bookstore.com
  `.trim();

  return { subject, html, text };
}

// =============================================================================
// Template 3 — Orden cancelada (order.cancelled)
// =============================================================================

function orderCancelled({ orderId, shippingName, email, amount }) {
  const name    = shippingName || email || 'Cliente';
  const subject = `🚫 Tu orden ha sido cancelada — BookStore`;
  const shortId = orderId?.substring(0, 8) || 'N/A';

  const html = `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📚 BookStore</h1>
      </div>

      <div style="${bodyStyle}">
        <h2 style="color: #6c757d; margin: 0 0 16px;">Orden cancelada</h2>
        <p style="color: #495057; line-height: 1.6;">
          Hola ${name}, confirmamos que tu orden <strong>#${shortId}</strong>
          por <strong>$${parseFloat(amount || 0).toFixed(2)} USD</strong> ha sido cancelada.
        </p>
        <p style="color: #495057; line-height: 1.6;">
          El stock de los libros ha sido restaurado y no se realizó ningún cobro.
        </p>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost'}/catalog" style="${buttonStyle}">
            Seguir comprando
          </a>
        </div>
      </div>

      <div style="${footerStyle}">
        <p style="margin: 0;">¿Cancelaste por error? Escríbenos a soporte@bookstore.com</p>
      </div>
    </div>
  `;

  const text = `
Hola ${name},

Tu orden #${shortId} ha sido cancelada.
No se realizó ningún cobro y el stock fue restaurado.

¿Cancelaste por error? Escríbenos a soporte@bookstore.com
  `.trim();

  return { subject, html, text };
}

// =============================================================================
// Template 4 — Reembolso procesado (payment.refunded)
// =============================================================================

function paymentRefunded({ orderId, shippingName, email, amount }) {
  const name    = shippingName || email || 'Cliente';
  const subject = `💰 Tu reembolso ha sido procesado — BookStore`;
  const shortId = orderId?.substring(0, 8) || 'N/A';

  const html = `
    <div style="${baseStyle}">
      <div style="${headerStyle}">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📚 BookStore</h1>
      </div>

      <div style="${bodyStyle}">
        <h2 style="color: #198754; margin: 0 0 16px;">Reembolso procesado</h2>
        <p style="color: #495057; line-height: 1.6;">
          Hola ${name}, hemos procesado un reembolso de
          <strong>$${parseFloat(amount || 0).toFixed(2)} USD</strong>
          para tu orden <strong>#${shortId}</strong>.
        </p>
        <p style="color: #495057; line-height: 1.6;">
          El monto se reflejará en tu cuenta en 5-10 días hábiles
          dependiendo de tu banco.
        </p>
      </div>

      <div style="${footerStyle}">
        <p style="margin: 0;">¿Preguntas sobre tu reembolso? Escríbenos a soporte@bookstore.com</p>
      </div>
    </div>
  `;

  const text = `
Hola ${name},

Hemos procesado un reembolso de $${parseFloat(amount || 0).toFixed(2)} USD para tu orden #${shortId}.
El monto se reflejará en tu cuenta en 5-10 días hábiles.

¿Preguntas? Escríbenos a soporte@bookstore.com
  `.trim();

  return { subject, html, text };
}

module.exports = {
  orderConfirmation,
  paymentFailed,
  orderCancelled,
  paymentRefunded,
};