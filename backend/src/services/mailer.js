/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/services/mailer.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Envio oficial de e-mails da plataforma via SMTP.
 *
 * Contrato oficial:
 *   await sendEmail({
 *     to,
 *     subject,
 *     html,
 *     text,
 *     attachments,
 *     cc,
 *     bcc,
 *     replyTo,
 *     headers,
 *   });
 *
 * Variáveis oficiais:
 * - EMAIL_SMTP_HOST
 * - EMAIL_SMTP_PORT
 * - EMAIL_SMTP_SECURE
 * - EMAIL_SMTP_USER
 * - EMAIL_SMTP_PASS
 * - EMAIL_FROM_NAME
 * - EMAIL_FROM_ADDR
 * - EMAIL_REPLY_TO
 *
 * Não usar:
 * - EMAIL_REMETENTE
 * - EMAIL_SENHA
 * - send(to, subject, html, text)
 */

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
  if (!value) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(value || "").trim();
}

function normalizeBool(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "sim", "s", "yes", "y", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "nao", "não", "n", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return fallback;
}

function normalizeInt(value, fallback) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return number;
}

function sanitizeHeaderText(value, max = 255) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, max);
}

function createEmailError(message, code, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function redactEmailConfig(config) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.smtpUser || "MISSING",
    pass: config.smtpPass ? `OK (${config.smtpPass.length} chars)` : "MISSING",
    fromName: config.fromName,
    fromAddr: config.fromAddr || "MISSING",
    replyTo: config.replyTo || "OFF",
  };
}

/* =========================
   Config
========================= */

function getEmailConfig() {
  const host = String(process.env.EMAIL_SMTP_HOST || "smtp.gmail.com").trim();
  const port = normalizeInt(process.env.EMAIL_SMTP_PORT, 465);

  const secure =
    process.env.EMAIL_SMTP_SECURE != null
      ? normalizeBool(process.env.EMAIL_SMTP_SECURE, port === 465)
      : port === 465;

  const smtpUser = String(process.env.EMAIL_SMTP_USER || "").trim();

  const smtpPass = String(process.env.EMAIL_SMTP_PASS || "")
    .replace(/\s+/g, "")
    .trim();

  const fromName = sanitizeHeaderText(
    process.env.EMAIL_FROM_NAME || "Escola da Saúde",
    120
  );

  const fromAddr = String(process.env.EMAIL_FROM_ADDR || "").trim();

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
  const config = getEmailConfig();

  return Boolean(
    config.host &&
      config.port &&
      config.smtpUser &&
      config.smtpPass &&
      config.fromAddr
  );
}

function getFrom() {
  const config = getEmailConfig();

  if (!config.fromAddr) {
    return `"${config.fromName}"`;
  }

  return `"${config.fromName}" <${config.fromAddr}>`;
}

function getSender() {
  const config = getEmailConfig();

  return config.smtpUser || undefined;
}

function resolveReplyTo(customReplyTo) {
  const direct = String(customReplyTo || "").trim();

  if (direct) {
    return direct;
  }

  const config = getEmailConfig();

  return config.replyTo || undefined;
}

function logConfigPreview() {
  const config = getEmailConfig();

  console.log("[email] config", redactEmailConfig(config));
}

/* =========================
   Transporter
========================= */

let transporter = null;
let verifiedAt = 0;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const config = getEmailConfig();

  if (!isConfigured()) {
    console.warn("[email] SMTP não configurado completamente.", {
      host: config.host || "MISSING",
      port: config.port || "MISSING",
      user: config.smtpUser ? "OK" : "MISSING",
      pass: config.smtpPass ? "OK" : "MISSING",
      fromAddr: config.fromAddr || "MISSING",
    });
  } else if (process.env.LOG_EMAIL === "true") {
    logConfigPreview();
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    pool: process.env.NODE_ENV === "production",
    maxConnections: normalizeInt(process.env.EMAIL_POOL_MAX_CONNECTIONS, 5),
    maxMessages: normalizeInt(process.env.EMAIL_POOL_MAX_MESSAGES, 50),
    connectionTimeout: normalizeInt(process.env.EMAIL_CONNECTION_TIMEOUT, 20000),
    greetingTimeout: normalizeInt(process.env.EMAIL_GREETING_TIMEOUT, 10000),
    socketTimeout: normalizeInt(process.env.EMAIL_SOCKET_TIMEOUT, 30000),
    tls:
      process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === "false"
        ? {
            rejectUnauthorized: false,
            servername: config.host,
          }
        : {
            servername: config.host,
          },
  });

  return transporter;
}

async function verifyTransporter(force = false) {
  if (!isConfigured()) {
    return false;
  }

  const transport = getTransporter();
  const now = Date.now();

  if (!force && now - verifiedAt < 60_000) {
    return true;
  }

  try {
    await transport.verify();
    verifiedAt = now;

    console.log("[email] Transporter verificado com sucesso.");

    return true;
  } catch (error) {
    console.warn("[email] verify falhou:", {
      message: error?.message,
      code: error?.code,
      command: error?.command,
    });

    return false;
  }
}

/* =========================
   Normalização do envio
========================= */

function normalizeMailPayload(payload = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createEmailError(
      "Payload de e-mail inválido. Use sendEmail({ to, subject, html/text }).",
      "EMAIL_INVALID_PAYLOAD"
    );
  }

  const to = asRecipients(payload.to);
  const cc = asRecipients(payload.cc);
  const bcc = asRecipients(payload.bcc);
  const subject = sanitizeHeaderText(payload.subject, 255);

  const html =
    payload.html != null && String(payload.html).trim()
      ? String(payload.html)
      : undefined;

  const text =
    payload.text != null && String(payload.text).trim()
      ? String(payload.text)
      : html
        ? stripHtml(html)
        : "";

  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : [];

  const replyTo = resolveReplyTo(payload.replyTo);

  const headers =
    payload.headers && typeof payload.headers === "object"
      ? payload.headers
      : undefined;

  if (!to) {
    throw createEmailError("Destinatário (to) vazio.", "EMAIL_TO_REQUIRED");
  }

  if (!subject) {
    throw createEmailError(
      "Assunto do e-mail é obrigatório.",
      "EMAIL_SUBJECT_REQUIRED"
    );
  }

  if (!html && !text) {
    throw createEmailError(
      "Conteúdo do e-mail está vazio.",
      "EMAIL_BODY_EMPTY"
    );
  }

  return {
    to,
    cc,
    bcc,
    subject,
    html,
    text,
    attachments,
    replyTo,
    headers,
  };
}

/* =========================
   Send oficial
========================= */

async function sendEmail(payload = {}) {
  const normalized = normalizeMailPayload(payload);

  const emailEnabled = normalizeBool(process.env.EMAIL_ENABLED, false);
  const emailDryRun = normalizeBool(process.env.EMAIL_DRY_RUN, false);
  const isProduction = process.env.NODE_ENV === "production";

  /**
   * Segurança operacional:
   * - Por padrão, e-mail NÃO é enviado.
   * - Para envio real, EMAIL_ENABLED precisa ser true.
   * - EMAIL_DRY_RUN=true força simulação, mesmo com SMTP configurado.
   * - Em development, o recomendado é EMAIL_ENABLED=false e EMAIL_DRY_RUN=true.
   */
  if (!emailEnabled || emailDryRun) {
    const dryRunInfo = {
      accepted: [],
      rejected: [],
      messageId: `dry-run-${Date.now()}`,
      dryRun: true,
      envelope: {
        to: normalized.to,
        cc: normalized.cc || null,
        bcc: normalized.bcc ? "[HIDDEN]" : null,
      },
    };

    if (process.env.LOG_EMAIL === "true") {
      console.info("📧 [email] DRY-RUN: e-mail não enviado.", {
        nodeEnv: process.env.NODE_ENV || null,
        emailEnabled,
        emailDryRun,
        to: normalized.to,
        cc: normalized.cc || null,
        bcc: normalized.bcc ? "[HIDDEN]" : null,
        subject: normalized.subject,
        messageId: dryRunInfo.messageId,
      });
    }

    return dryRunInfo;
  }

  if (!isConfigured()) {
    throw createEmailError(
      "Serviço de e-mail não configurado.",
      "EMAIL_NOT_CONFIGURED"
    );
  }

  if (!isProduction) {
    console.warn("⚠️ [email] Envio real habilitado fora de produção.", {
      nodeEnv: process.env.NODE_ENV || null,
      to: normalized.to,
      subject: normalized.subject,
    });
  }

  const mailOptions = {
    from: getFrom(),
    ...(getSender() ? { sender: getSender() } : {}),
    to: normalized.to,
    subject: normalized.subject,
    ...(normalized.text ? { text: normalized.text } : {}),
    ...(normalized.html ? { html: normalized.html } : {}),
    ...(normalized.attachments.length
      ? { attachments: normalized.attachments }
      : {}),
    ...(normalized.cc ? { cc: normalized.cc } : {}),
    ...(normalized.bcc ? { bcc: normalized.bcc } : {}),
    ...(normalized.replyTo ? { replyTo: normalized.replyTo } : {}),
    ...(normalized.headers ? { headers: normalized.headers } : {}),
  };

  const transport = getTransporter();

  try {
    if (process.env.EMAIL_VERIFY === "true") {
      const ok = await verifyTransporter();

      if (!ok) {
        throw createEmailError(
          "SMTP indisponível. A verificação do transporter falhou.",
          "EMAIL_VERIFY_FAILED"
        );
      }
    }

    const info = await transport.sendMail(mailOptions);

    if (process.env.LOG_EMAIL === "true") {
      console.log("📧 [email] E-mail enviado.", {
        to: normalized.to,
        cc: normalized.cc || null,
        bcc: normalized.bcc ? "[HIDDEN]" : null,
        subject: normalized.subject,
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
      });
    }

    return info;
  } catch (error) {
    console.error("✉️ [email] Falha ao enviar.", {
      message: error?.message,
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      response: error?.response,
      to: normalized.to,
      subject: normalized.subject,
    });

    throw error;
  }
}

/* =========================
   Reset para testes
========================= */

function resetTransporter() {
  transporter = null;
  verifiedAt = 0;
}

/* =========================
   Export oficial
========================= */

module.exports = {
  sendEmail,
  verifyTransporter,
  isConfigured,
  getFrom,
  resetTransporter,
};