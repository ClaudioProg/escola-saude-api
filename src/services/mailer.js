/* eslint-disable no-console */
"use strict";

const nodemailer = require("nodemailer");

/* =========================
   Helpers
========================= */
function stripHtml(input) {
  return String(input || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRecipients(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(value || "").trim();
}

function normalizeBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "sim", "yes", "on"].includes(v)) return true;
    if (["false", "0", "nao", "não", "no", "off"].includes(v)) return false;
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

function normalizeInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeHeaderText(value, max = 255) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

function getEnvConfig() {
  const smtpUser = String(
    process.env.EMAIL_SMTP_USER || process.env.EMAIL_REMETENTE || ""
  ).trim();

  const smtpPass = String(
    process.env.EMAIL_SMTP_PASS || process.env.EMAIL_SENHA || ""
  )
    .replace(/\s+/g, "")
    .trim();

  const host = String(process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const port = normalizeInt(process.env.EMAIL_SMTP_PORT, 465);

  const secure =
    process.env.EMAIL_SMTP_SECURE != null
      ? normalizeBool(process.env.EMAIL_SMTP_SECURE, port === 465)
      : port === 465;

  const fromName = sanitizeHeaderText(
    process.env.EMAIL_FROM_NAME || "Escola da Saúde",
    120
  );

  const fromAddr = String(
    process.env.EMAIL_FROM_ADDR || process.env.EMAIL_REMETENTE || smtpUser || ""
  ).trim();

  const replyTo = String(process.env.EMAIL_REPLY_TO || "").trim();

  return {
    host,
    port,
    secure,
    smtpUser,
    smtpPass,
    fromName,
    fromAddr,
    replyTo,
  };
}

function isConfigured() {
  const cfg = getEnvConfig();
  return !!(cfg.smtpUser && cfg.smtpPass);
}

function getFrom() {
  const cfg = getEnvConfig();
  return cfg.fromAddr
    ? `"${cfg.fromName}" <${cfg.fromAddr}>`
    : `"${cfg.fromName}"`;
}

function getSender() {
  const cfg = getEnvConfig();
  return cfg.smtpUser || undefined;
}

function safeReplyTo(customReplyTo) {
  const direct = String(customReplyTo || "").trim();
  if (direct) return direct;

  const cfg = getEnvConfig();
  return cfg.replyTo || undefined;
}

function logConfigPreview() {
  const cfg = getEnvConfig();

  console.log("[email] cfg", {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.smtpUser || "MISSING",
    pass: cfg.smtpPass ? `OK (${cfg.smtpPass.length} chars)` : "MISSING",
    from: getFrom(),
    replyTo: cfg.replyTo || "OFF",
  });
}

/* =========================
   Transport (lazy)
========================= */
let transporter = null;
let verifiedAt = 0;

function getTransporter() {
  if (transporter) return transporter;

  const cfg = getEnvConfig();

  if (!cfg.smtpUser || !cfg.smtpPass) {
    console.warn("⚠️ [email] SMTP_USER/SMTP_PASS não configurados corretamente.");
  } else if (process.env.LOG_EMAIL === "true") {
    logConfigPreview();
  }

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth:
      cfg.smtpUser && cfg.smtpPass
        ? {
            user: cfg.smtpUser,
            pass: cfg.smtpPass,
          }
        : undefined,
    pool: process.env.NODE_ENV === "production",
    maxConnections: normalizeInt(process.env.EMAIL_POOL_MAX_CONNECTIONS, 5),
    maxMessages: normalizeInt(process.env.EMAIL_POOL_MAX_MESSAGES, 50),
    connectionTimeout: normalizeInt(process.env.EMAIL_CONNECTION_TIMEOUT, 20000),
    greetingTimeout: normalizeInt(process.env.EMAIL_GREETING_TIMEOUT, 10000),
    socketTimeout: normalizeInt(process.env.EMAIL_SOCKET_TIMEOUT, 30000),
    tls:
      process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === "false"
        ? { rejectUnauthorized: false, servername: cfg.host }
        : { servername: cfg.host },
  });

  return transporter;
}

async function verifyTransporter(force = false) {
  const t = getTransporter();
  const now = Date.now();

  if (!force && now - verifiedAt < 60_000) return true;

  try {
    await t.verify();
    verifiedAt = now;
    console.log("[email] Transporter verificado com sucesso.");
    return true;
  } catch (err) {
    console.warn("⚠️ [email] verify falhou:", err?.message || err);
    return false;
  }
}

/* =========================
   Send
========================= */
/**
 * Formato novo:
 * send({
 *   to, subject, html, text, attachments, cc, bcc, replyTo, headers
 * })
 *
 * Formato legado:
 * send(to, subject, html, text)
 */
async function send(a, b, c, d) {
  if (!isConfigured()) {
    const err = new Error("Serviço de e-mail não configurado.");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  let to;
  let subject;
  let html;
  let text;
  let attachments = [];
  let cc;
  let bcc;
  let replyTo;
  let headers;

  if (typeof a === "object" && a !== null) {
    to = a.to;
    subject = a.subject;
    html = a.html;
    text = a.text;
    attachments = Array.isArray(a.attachments) ? a.attachments : [];
    cc = a.cc;
    bcc = a.bcc;
    replyTo = a.replyTo;
    headers = a.headers;
  } else {
    to = a;
    subject = b;
    html = c;
    text = d;
    attachments = [];
  }

  const destinatario = asRecipients(to);
  const ccRecipients = asRecipients(cc);
  const bccRecipients = asRecipients(bcc);
  const assunto = sanitizeHeaderText(subject, 255);

  if (!destinatario) {
    const err = new Error("Destinatário (to) vazio.");
    err.code = "EENVELOPE";
    throw err;
  }

  if (!assunto) {
    const err = new Error("Assunto do e-mail é obrigatório.");
    err.code = "EMAIL_SUBJECT_REQUIRED";
    throw err;
  }

  const finalHtml =
    html != null && String(html).trim() ? String(html) : undefined;

  const finalText =
    text != null && String(text).trim()
      ? String(text)
      : finalHtml
        ? stripHtml(finalHtml)
        : "";

  if (!finalHtml && !finalText) {
    const err = new Error("Conteúdo do e-mail está vazio.");
    err.code = "EMAIL_BODY_EMPTY";
    throw err;
  }

  const mailOptions = {
    from: getFrom(),
    ...(getSender() ? { sender: getSender() } : {}),
    to: destinatario,
    subject: assunto,
    ...(finalText ? { text: finalText } : {}),
    ...(finalHtml ? { html: finalHtml } : {}),
    ...(attachments.length ? { attachments } : {}),
    ...(ccRecipients ? { cc: ccRecipients } : {}),
    ...(bccRecipients ? { bcc: bccRecipients } : {}),
    ...(safeReplyTo(replyTo) ? { replyTo: safeReplyTo(replyTo) } : {}),
    ...(headers && typeof headers === "object" ? { headers } : {}),
  };

  const t = getTransporter();

  try {
    if (process.env.EMAIL_VERIFY === "true") {
      const ok = await verifyTransporter();
      if (!ok) {
        const err = new Error("SMTP indisponível (verify falhou).");
        err.code = "EMAIL_VERIFY_FAILED";
        throw err;
      }
    }

    const info = await t.sendMail(mailOptions);

    if (process.env.LOG_EMAIL === "true") {
      console.log("📧 E-mail enviado", {
        to: destinatario,
        cc: ccRecipients || null,
        bcc: bccRecipients ? "[HIDDEN]" : null,
        subject: assunto,
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
      });
    }

    return info;
  } catch (err) {
    console.error("✉️ [email] Falha ao enviar:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      responseCode: err?.responseCode,
      to: destinatario,
      subject: assunto,
    });
    throw err;
  }
}

/* =========================
   Reset util (opcional)
========================= */
function resetTransporter() {
  transporter = null;
  verifiedAt = 0;
}

module.exports = {
  send,
  verifyTransporter,
  isConfigured,
  getFrom,
  resetTransporter,
};