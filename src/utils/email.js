// 📁 src/utils/email.js
const nodemailer = require("nodemailer");

// 🔐 Verificações básicas de env
if (!process.env.EMAIL_REMETENTE || !process.env.EMAIL_SENHA) {
  console.error("❌ As variáveis EMAIL_REMETENTE e EMAIL_SENHA são obrigatórias no .env");
  process.exit(1);
}

// 💡 App Password do Gmail costuma vir com espaços; removemos por segurança
const CLEAN_PASS = String(process.env.EMAIL_SENHA).replace(/\s+/g, "");

// ✉️ Configuração do transporte SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_SMTP_PORT || 465),
  secure: String(process.env.EMAIL_SMTP_SECURE || "true").toLowerCase() === "true", // 465=true
  auth: {
    user: process.env.EMAIL_REMETENTE,
    pass: CLEAN_PASS,
  },
});

// Util simples para gerar texto a partir do HTML
function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Envia e-mail (compatível com chamadas antigas e novas).
 *
 * Formato 1 (objeto):
 *   send({ to, subject, html, text, attachments })
 *
 * Formato 2 (posicional LEGADO):
 *   send(to, subject, html, text)
 */
async function send(a, b, c, d) {
  let to, subject, html, text, attachments;

  if (typeof a === "object" && a !== null) {
    // Novo formato (objeto)
    to = a.to;
    subject = a.subject;
    html = a.html || a.text; // permite passar só text
    text = a.text || stripHtml(a.html);
    attachments = Array.isArray(a.attachments) ? a.attachments : [];
  } else {
    // Formato legado (posicional)
    to = a;
    subject = b;
    html = c;
    text = d || stripHtml(c);
    attachments = [];
  }

  const destinatario = String(to || "").trim();
  if (!destinatario) {
    const err = new Error("Destinatário (to) vazio");
    err.code = "EENVELOPE";
    throw err;
  }

  const mailOptions = {
    from: `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>`,
    to: destinatario,
    subject: subject || "",
    text: text || stripHtml(html),
    html: html || undefined,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);

  if (process.env.LOG_EMAIL === "true") {
    console.log(`📧 E-mail enviado para: ${destinatario} (${info?.messageId || "-"})`);
  }

  return info;
}

module.exports = { send };
