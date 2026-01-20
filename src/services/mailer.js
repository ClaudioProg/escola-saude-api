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

/**
 * Suporta novo formato (EMAIL_SMTP_USER/PASS) e legado (EMAIL_REMETENTE/SENHA).
 */
function isConfigured() {
  const hasNew = process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS;
  const hasLegacy = process.env.EMAIL_REMETENTE && process.env.EMAIL_SENHA;
  return !!(hasNew || hasLegacy);
}

/** Remetente exibido (From) */
function getFrom() {
  const name = process.env.EMAIL_FROM_NAME || "Escola da Saúde";
  const addr =
    process.env.EMAIL_FROM_ADDR || // preferido (no-reply)
    process.env.EMAIL_REMETENTE || // legado
    "";
  return addr ? `"${name}" <${addr}>` : `"${name}"`;
}

/* =========================
   Transport (lazy)
========================= */
let transporter = null;
let verifiedAt = 0;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.EMAIL_SMTP_PORT || 465);
  const secure = String(process.env.EMAIL_SMTP_SECURE || "true").toLowerCase() === "true"; // 465=true, 587=false

  // Login SMTP (preferir variáveis novas; cair para legado se necessário)
  const SMTP_USER = process.env.EMAIL_SMTP_USER || process.env.EMAIL_REMETENTE || "";
  const SMTP_PASS_RAW = process.env.EMAIL_SMTP_PASS || process.env.EMAIL_SENHA || "";
  const SMTP_PASS = String(SMTP_PASS_RAW).replace(/\s+/g, ""); // limpa espaços (App Password do Gmail)

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("⚠️ [email] SMTP_USER/SMTP_PASS não configurados (verifique .env).");
  } else if (process.env.LOG_EMAIL === "true") {
    console.log("[email] cfg", {
      host,
      port,
      secure,
      user: SMTP_USER,
      pass: SMTP_PASS ? `OK (${SMTP_PASS.length} chars)` : "MISSING",
      from: getFrom(),
      replyTo: process.env.EMAIL_REPLY_TO ? "OK" : "OFF",
    });
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    // Pool para estabilidade em produção
    pool: process.env.NODE_ENV === "production",
    maxConnections: Number(process.env.EMAIL_POOL_MAX_CONNECTIONS || 5),
    maxMessages: Number(process.env.EMAIL_POOL_MAX_MESSAGES || 50),
    // Timeouts para evitar travas
    connectionTimeout: Number(process.env.EMAIL_CONNECTION_TIMEOUT || 20000),
    greetingTimeout: Number(process.env.EMAIL_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.EMAIL_SOCKET_TIMEOUT || 30000),
    // TLS opcional (apenas se precisar contornar CA/self-signed)
    tls:
      process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === "false"
        ? { rejectUnauthorized: false, servername: host }
        : { servername: host },
  });

  return transporter;
}

/** Verifica o transporter (cache 60s) */
async function verifyTransporter() {
  const t = getTransporter();
  const now = Date.now();
  if (now - verifiedAt < 60_000) return true;

  try {
    await t.verify();
    verifiedAt = now;
    console.log("[email] Transporter verificado com sucesso.");
    return true;
  } catch (e) {
    console.warn("⚠️ [email] verify falhou:", e?.message || e);
    return false;
  }
}

/**
 * Envia e-mail.
 * Formato 1: send({ to, subject, html, text, attachments, cc, bcc, replyTo, headers })
 * Formato 2 (legado): send(to, subject, html, text)
 */
async function send(a, b, c, d) {
  if (!isConfigured()) {
    const err = new Error("Serviço de e-mail não configurado.");
    err.code = "EMAIL_NOT_CONFIGURED";
    throw err;
  }

  let to, subject, html, text, attachments, cc, bcc, replyTo, headers;

  if (typeof a === "object" && a !== null) {
    ({
      to,
      subject,
      html,
      text,
      attachments = [],
      cc,
      bcc,
      replyTo,
      headers,
    } = a);
    if (!text && html) text = stripHtml(html);
    if (!html && text) html = text;
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

  const mailOptions = {
    from: getFrom(),
    sender: String(process.env.EMAIL_SMTP_USER || "").trim() || undefined, // ✅ premium: alinha com SMTP
  
    to: destinatario,
    subject: String(subject || "").trim(),
    text: text || stripHtml(html),
    html: html || undefined,
    attachments,
    ...(cc ? { cc: asRecipients(cc) } : {}),
    ...(bcc ? { bcc: asRecipients(bcc) } : {}),
    ...(replyTo ? { replyTo } : (process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {})),
    ...(headers ? { headers } : {}),
  };

  const t = getTransporter();

  try {
    if (process.env.EMAIL_VERIFY === "true") {
      const ok = await verifyTransporter();
      if (!ok) {
        const e = new Error("SMTP indisponível (verify falhou).");
        e.code = "EMAIL_VERIFY_FAILED";
        throw e;
      }
    }

    const info = await t.sendMail(mailOptions);

    if (process.env.LOG_EMAIL === "true") {
      console.log(`📧 E-mail enviado -> ${destinatario} (${info?.messageId || "-"})`);
    }

    return info;
  } catch (err) {
    console.error("✉️ [email] Falha ao enviar:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      responseCode: err?.responseCode,
    });
    throw err;
  }
}

module.exports = { send, verifyTransporter };
