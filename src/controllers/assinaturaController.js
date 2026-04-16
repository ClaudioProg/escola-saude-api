/* eslint-disable no-console */
// ✅ src/controllers/assinaturaController.js — PREMIUM+++
// - Compat DB robusta
// - Logs com RID
// - Autoassinatura resiliente para instrutor/administrador
// - Validação forte de dataURL/base64
// - Limites de payload
// - Persistência idempotente
// - Lista segura (sem imagem)
// - Date-safe / sem dependência de parsing ambíguo
"use strict";

const path = require("path");
const fs = require("fs");
const dbMod = require("../db");

/* ————————————————— Configs/tamanhos ————————————————— */
const MAX_DATAURL_TOTAL = 6 * 1024 * 1024; // 6MB total da string dataURL
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB do binário real
const IS_DEV = process.env.NODE_ENV !== "production";

/* ————————————————— Compat DB ————————————————— */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof query !== "function") {
  console.error("[assinaturaController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em assinaturaController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query };
}

/* ————————————————— Logger premium ————————————————— */
function mkRid(prefix = "ASS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "ASS") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;
  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }
  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* ————————————————— Helpers gerais ————————————————— */
function getRequestId(res) {
  try {
    return res?.getHeader?.("X-Request-Id") || undefined;
  } catch {
    return undefined;
  }
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getUserId(req) {
  return (
    toIntId(req?.user?.id) ||
    toIntId(req?.user?.usuario_id) ||
    toIntId(req?.user?.userId) ||
    toIntId(req?.usuario?.id) ||
    toIntId(req?.usuario?.usuario_id) ||
    null
  );
}

function normPerfis(p) {
  if (Array.isArray(p)) {
    return p
      .map((x) => String(x).toLowerCase().trim())
      .filter(Boolean);
  }
  if (typeof p === "string") {
    return p
      .split(",")
      .map((x) => x.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

function getPerfis(req) {
  return normPerfis(
    req?.user?.perfis ??
      req?.user?.perfil ??
      req?.usuario?.perfis ??
      req?.usuario?.perfil ??
      []
  );
}

function isInstrOuAdm(perfis) {
  const arr = normPerfis(perfis);
  return arr.includes("instrutor") || arr.includes("administrador");
}

function isAdmin(req) {
  return getPerfis(req).includes("administrador");
}

function extractBase64Payload(dataUrl) {
  const m = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);
  return m ? m[1] : null;
}

function base64ToBytesApprox(b64) {
  const s = String(b64 || "").replace(/\s/g, "");
  if (!s) return 0;
  const padding = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.floor((s.length * 3) / 4) - padding;
}

function isAllowedImageDataUrl(dataUrl) {
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(
    String(dataUrl || "")
  );
}

/* ————————————————— Abreviação do nome ————————————————— */
function buildNameVariants(fullName = "") {
  const clean = String(fullName || "").replace(/\s+/g, " ").trim();
  if (!clean) return { text: "Assinatura" };

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return { text: parts[0], clean: parts[0] };
  }

  const first = parts[0];
  const last = parts[parts.length - 1];

  return {
    clean,
    opt1: `${first} ${last}`,
    opt2: `${first} ${last[0].toUpperCase()}.`,
    opt3: `${first[0].toUpperCase()}. ${last}`,
    opt4: `${first[0].toUpperCase()}. ${last[0].toUpperCase()}.`,
    text: "Assinatura",
  };
}

/* ————————————————— Localiza o TTF da fonte ————————————————— */
function resolveSignatureTtf() {
  if (process.env.SIGNATURE_FONT_TTF) return process.env.SIGNATURE_FONT_TTF;

  const candidates = [
    path.join(process.cwd(), "fonts", "GreatVibes-Regular.ttf"),
    path.join(process.cwd(), "assets", "fonts", "GreatVibes-Regular.ttf"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

/* ————————————————— Renderização (node-canvas) ————————————————— */
let externalRenderSignaturePng = null;
try {
  externalRenderSignaturePng =
    require("../utils/signature")?.renderSignaturePng || null;
} catch {
  externalRenderSignaturePng = null;
}

let canvasLib = null;
function requireCanvas() {
  if (canvasLib) return canvasLib;
  // eslint-disable-next-line global-require
  canvasLib = require("canvas");
  return canvasLib;
}

const SIGNATURE_CFG = {
  WIDTH: Number(process.env.SIGNATURE_WIDTH || 900),
  HEIGHT: Number(process.env.SIGNATURE_HEIGHT || 300),
  PAD: Number(process.env.SIGNATURE_PADDING || 40),
  FONT_MIN: Number(process.env.SIGNATURE_FONT_MIN || 72),
  FONT_MAX: Number(process.env.SIGNATURE_FONT_MAX || 180),
  FAMILY: process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto",
  TTF: resolveSignatureTtf(),
  STROKE: process.env.SIGNATURE_STROKE || "#111827",
  FILL: process.env.SIGNATURE_FILL || "#111827",
  SHADOW: process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)",
};

let _fontRegistered = false;
function ensureFontRegistered() {
  if (_fontRegistered) return;

  try {
    const ttf = SIGNATURE_CFG.TTF;
    if (ttf) {
      const { registerFont } = requireCanvas();
      registerFont(ttf, { family: SIGNATURE_CFG.FAMILY });
      if (IS_DEV) console.log("[assinatura] Fonte cursiva registrada:", ttf);
    } else {
      console.warn(
        "[assinatura] TTF não encontrado — usando fonte cursiva do sistema."
      );
    }
  } catch (e) {
    console.warn(
      "[assinatura] Falha ao registrar fonte cursiva:",
      e?.message || e
    );
  } finally {
    _fontRegistered = true;
  }
}

function renderSignatureFallbackPng(nome) {
  const { createCanvas } = requireCanvas();
  ensureFontRegistered();

  const W = SIGNATURE_CFG.WIDTH;
  const H = SIGNATURE_CFG.HEIGHT;
  const PAD = SIGNATURE_CFG.PAD;

  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const variants = buildNameVariants(nome);
  const opts = [
    variants.opt1,
    variants.opt2,
    variants.opt3,
    variants.opt4,
    variants.clean,
    variants.text,
  ].filter(Boolean);

  const maxTextWidth = W - PAD * 2;

  function fontSpec(size) {
    return `${size}px "${SIGNATURE_CFG.FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
  }

  function fits(text, size) {
    ctx.font = fontSpec(size);
    return ctx.measureText(text).width <= maxTextWidth;
  }

  function pickVariant() {
    for (const t of opts) {
      if (fits(t, SIGNATURE_CFG.FONT_MIN)) return t;
    }
    return opts[opts.length - 1];
  }

  function pickFontSize(text) {
    let lo = SIGNATURE_CFG.FONT_MIN;
    let hi = SIGNATURE_CFG.FONT_MAX;
    let best = lo;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(text, mid)) {
        best = mid;
        lo = mid + 2;
      } else {
        hi = mid - 2;
      }
    }

    return best;
  }

  const text = pickVariant();
  const fontPx = pickFontSize(text);

  ctx.font = fontSpec(fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = SIGNATURE_CFG.SHADOW;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.03));
  ctx.strokeStyle = SIGNATURE_CFG.STROKE;
  ctx.fillStyle = SIGNATURE_CFG.FILL;

  const cx = W / 2;
  const cy = H / 2 + Math.round(fontPx * 0.08);

  ctx.strokeText(text, cx, cy);
  ctx.fillText(text, cx, cy);

  const buffer = c.toBuffer("image/png");
  return { buffer, text, fontPx, mime: "image/png" };
}

function renderSignaturePng(name) {
  if (typeof externalRenderSignaturePng === "function") {
    try {
      return externalRenderSignaturePng(name);
    } catch (_) {
      // fallback
    }
  }
  return renderSignatureFallbackPng(name);
}

/* ————————————————— Persistência / leitura ————————————————— */
async function obterAssinaturaPorUsuario(db, usuarioId) {
  const r = await db.query(
    `
    SELECT imagem_base64
    FROM assinaturas
    WHERE usuario_id = $1
    LIMIT 1
    `,
    [Number(usuarioId)]
  );

  return r.rows?.[0]?.imagem_base64 || null;
}

async function upsertAssinatura(db, usuarioId, imagemBase64) {
  await db.query(
    `
    INSERT INTO assinaturas (usuario_id, imagem_base64)
    VALUES ($1, $2)
    ON CONFLICT (usuario_id)
    DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
    `,
    [Number(usuarioId), imagemBase64]
  );
}

/* ————————————————— Auto-geração e persistência (idempotente) ————————————————— */
async function ensureAutoSignature(usuarioId, req = null) {
  const db = getDb(req);
  const rid = reqRid(req, "ASSAUTO");

  const uid = toIntId(usuarioId);
  if (!uid) return null;

  const existing = await obterAssinaturaPorUsuario(db, uid);
  if (existing) {
    logInfo(rid, "assinatura já existente; autogeração ignorada", { usuarioId: uid });
    return null;
  }

  const uRes = await db.query(
    `
    SELECT id, nome, email, perfil, perfis
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [uid]
  );

  const u = uRes.rows?.[0];
  if (!u) {
    logWarn(rid, "usuário não encontrado para autogeração", { usuarioId: uid });
    return null;
  }

if (!isInstrOuAdm(u.perfil)) {
  logInfo(rid, "usuário sem perfil elegível para autogeração", {
    usuarioId: uid,
    perfil: u.perfil ?? null,
  });
  return null;
}

  const displayName = String(u.nome || u.email || `Usuario_${u.id}`).trim();
  const { buffer } = renderSignaturePng(displayName);
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

  await upsertAssinatura(db, uid, dataUrl);

  logInfo(rid, "assinatura autogerada com sucesso", {
    usuarioId: uid,
    nomeBase: displayName,
    bytes: buffer.length,
  });

  return dataUrl;
}

/* ————————————————— Endpoints ————————————————— */

/** 🖋️ GET /api/assinatura */
async function getAssinatura(req, res) {
  const rid = reqRid(req);
  const usuario_id = getUserId(req);

  if (!usuario_id) {
    return res.status(401).json({
      ok: false,
      erro: "Usuário não autenticado.",
      requestId: getRequestId(res),
    });
  }

  const db = getDb(req);

  try {
    let assinatura = await obterAssinaturaPorUsuario(db, usuario_id);

    if (!assinatura) {
      try {
        const nova = await ensureAutoSignature(usuario_id, req);
        if (nova) {
          res.setHeader("X-Assinatura-Autogerada", "1");
          assinatura = nova;
        }
      } catch (e) {
        logWarn(rid, "falha ao autogerar assinatura", {
          usuario_id,
          msg: e?.message || e,
        });
      }
    }

    logInfo(rid, "getAssinatura OK", {
      usuario_id,
      temAssinatura: !!assinatura,
      autogerada: res.getHeader?.("X-Assinatura-Autogerada") === "1",
    });

    return res.status(200).json({
      ok: true,
      assinatura,
      requestId: getRequestId(res),
    });
  } catch (e) {
    logErr(rid, "Erro ao buscar assinatura", e);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao buscar assinatura.",
      requestId: getRequestId(res),
    });
  }
}

/** ✍️ POST /api/assinatura */
async function salvarAssinatura(req, res) {
  const rid = reqRid(req);
  const usuario_id = getUserId(req);
  const { assinatura } = req.body || {};

  if (!usuario_id) {
    return res.status(401).json({
      ok: false,
      erro: "Usuário não autenticado.",
      requestId: getRequestId(res),
    });
  }

  if (!assinatura || typeof assinatura !== "string") {
    return res.status(400).json({
      ok: false,
      erro: "Assinatura é obrigatória.",
      requestId: getRequestId(res),
    });
  }

  const trimmed = assinatura.trim();

  if (!isAllowedImageDataUrl(trimmed)) {
    return res.status(400).json({
      ok: false,
      erro: "Assinatura inválida. Envie PNG, JPG/JPEG ou WEBP em base64.",
      requestId: getRequestId(res),
    });
  }

  if (trimmed.length > MAX_DATAURL_TOTAL) {
    return res.status(413).json({
      ok: false,
      erro: "Imagem muito grande (limite 6MB).",
      requestId: getRequestId(res),
    });
  }

  const b64 = extractBase64Payload(trimmed);
  if (!b64) {
    return res.status(400).json({
      ok: false,
      erro: "Data URL inválida.",
      requestId: getRequestId(res),
    });
  }

  const bytes = base64ToBytesApprox(b64);
  if (bytes > MAX_IMAGE_BYTES) {
    return res.status(413).json({
      ok: false,
      erro: "Imagem muito grande (payload > 4MB).",
      requestId: getRequestId(res),
    });
  }

  const payload = trimmed.replace(/\s+/g, "");
  const db = getDb(req);

  try {
    await upsertAssinatura(db, usuario_id, payload);

    logInfo(rid, "salvarAssinatura OK", {
      usuario_id,
      bytesAprox: bytes,
      mime:
        trimmed.match(/^data:(image\/[^;]+);base64,/i)?.[1] || "image/unknown",
    });

    return res.status(200).json({
      ok: true,
      mensagem: "Assinatura salva com sucesso.",
      requestId: getRequestId(res),
    });
  } catch (e) {
    logErr(rid, "Erro ao salvar assinatura", e);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao salvar assinatura.",
      requestId: getRequestId(res),
    });
  }
}

/** 📜 GET /api/assinatura/lista */
async function listarAssinaturas(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  try {
    // Mantive livre como no seu código anterior.
    // Se quiser, no próximo passo eu posso endurecer para admin-only.
    const { rows } = await db.query(
      `
      SELECT
        a.usuario_id AS id,
        u.nome,
        COALESCE(u.cargo, NULL) AS cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = (rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: true,
    }));

    logInfo(rid, "listarAssinaturas OK", {
      total: lista.length,
      solicitadoPor: getUserId(req),
      admin: isAdmin(req),
    });

    return res.status(200).json({
      ok: true,
      lista,
      requestId: getRequestId(res),
    });
  } catch (e) {
    logErr(rid, "Erro ao listar assinaturas", e);
    return res.status(500).json({
      ok: false,
      erro: "Erro ao listar assinaturas.",
      requestId: getRequestId(res),
    });
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
  listarAssinaturas,
  ensureAutoSignature,
};