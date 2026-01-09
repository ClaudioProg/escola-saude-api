// 📁 src/utils/email.js
/* eslint-disable no-console */
const nodemailer = require("nodemailer");

/* =========================
   Helpers
========================= */
function stripHtml(s) {
  return String(s || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecipients(to) {
  if (!to) return "";
  if (Array.isArray(to)) {
    return to.map((x) => String(x || "").trim()).filter(Boolean).join(", ");
  }
  return String(to || "").trim();
}

function isConfigured() {
  return !!(process.env.EMAIL_REMETENTE && process.env.EMAIL_SENHA);
}

function getFrom() {
  const name = process.env.EMAIL_FROM_NAME || "Escola da Saúde";
  const addr = process.env.EMAIL_REMETENTE || "";
  return addr ? `"${name}" <${addr}>` : `"${name}"`;
}

/* =========================
   Transport (lazy)
========================= */
let transporter = null;
let verifiedAt = 0;

function getTransporter() {
  if (transporter) return transporter;

  const remetente = process.env.EMAIL_REMETENTE;
  const senha = process.env.EMAIL_SENHA;

  if (!remetente || !senha) {
    // ⚠️ Não derruba o app; apenas sinaliza quando tentar enviar
    console.warn("⚠️ [email] EMAIL_REMETENTE/EMAIL_SENHA não configurados.");
  }

  // App Password do Gmail costuma vir com espaços; removemos por segurança
  const CLEAN_PASS = String(senha || "").replace(/\s+/g, "");

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_SMTP_PORT || 465),
    secure: String(process.env.EMAIL_SMTP_SECURE || "true").toLowerCase() === "true", // 465=true
    auth: remetente
      ? {
          user: remetente,
          pass: CLEAN_PASS,
        }
      : undefined,
  });

  return transporter;
}

/**
 * (Opcional) Verifica o transporter (cache 60s) – útil em ambiente instável
 */
async function verifyTransporter() {
  const t = getTransporter();
  const now = Date.now();
  if (now - verifiedAt < 60_000) return true;

  try {
    await t.verify();
    verifiedAt = now;
    return true;
  } catch (e) {
    console.warn("⚠️ [email] verify falhou:", e?.message || e);
    return false;
  }
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
  // ✅ valida config no momento do envio (não no import)
  if (!isConfigured()) {
    const err = new Error("Serviço de e-mail não configurado.");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  let to, subject, html, text, attachments;

  if (typeof a === "object" && a !== null) {
    to = a.to;
    subject = a.subject;
    html = a.html || a.text;
    text = a.text || stripHtml(a.html);
    attachments = Array.isArray(a.attachments) ? a.attachments : [];
  } else {
    to = a;
    subject = b;
    html = c;
    text = d || stripHtml(c);
    attachments = [];
  }

  const destinatario = asRecipients(to);
  if (!destinatario) {
    const err = new Error("Destinatário (to) vazio");
    err.code = "EENVELOPE";
    throw err;
  }

  const safeSubject = String(subject || "").trim();

  const mailOptions = {
    from: getFrom(),
    to: destinatario,
    subject: safeSubject,
    text: text || stripHtml(html),
    html: html || undefined,
    attachments,
  };

  const t = getTransporter();

  // opcional: verifica conexão (pode desligar se quiser performance máxima)
  if (process.env.EMAIL_VERIFY === "true") {
    await verifyTransporter();
  }

  const info = await t.sendMail(mailOptions);

  if (process.env.LOG_EMAIL === "true") {
    console.log(`📧 E-mail enviado -> ${destinatario} (${info?.messageId || "-"})`);
  }

  return info;
}

module.exports = { send, verifyTransporter };
