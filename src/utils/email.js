const nodemailer = require('nodemailer');

// 🔐 Verifica se as variáveis obrigatórias estão definidas
if (!process.env.EMAIL_REMETENTE || !process.env.EMAIL_SENHA) {
  console.error('❌ As variáveis EMAIL_REMETENTE e EMAIL_SENHA são obrigatórias no arquivo .env');
  process.exit(1);
}

// ✉️ Configuração do transporte SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_SMTP_PORT) || 465,
  secure: process.env.EMAIL_SMTP_SECURE === 'true', // true para 465, false para 587
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: process.env.EMAIL_SENHA,
  },
});

/**
 * Envia um e-mail com ou sem anexos.
 * @param {Object} options - Configurações do e-mail
 * @param {string|string[]} options.to - Destinatário(s)
 * @param {string} options.subject - Assunto do e-mail
 * @param {string} options.text - Corpo do e-mail (texto simples)
 * @param {Array} [options.attachments] - Lista de anexos (opcional)
 */
async function send({ to, subject, text, attachments = [] }) {
  const mailOptions = {
    from: `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>`,
    to,
    subject,
    text,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);

    if (process.env.LOG_EMAIL === 'true') {
      console.log(`📧 E-mail enviado com sucesso para: ${to}`);
    }
  } catch (erro) {
    console.error('❌ Erro ao enviar e-mail:', erro.message);
    throw erro;
  }
}

module.exports = { send };
