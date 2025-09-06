const nodemailer = require('nodemailer');

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendEmail(to, subject, text) {
  try {
    const transport = createTransport();
    if (!transport) {
      console.log(`DEV MAIL → ${to}: ${subject}\n${text}`);
      return { success: true, provider: 'dev' };
    }
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transport.sendMail({ from, to, subject, text });
    return { success: true };
  } catch (e) {
    console.error('Email send error:', e);
    return { success: false, error: e.message };
  }
}

module.exports = { sendEmail };


