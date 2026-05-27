/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/assinaturaController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Obter, salvar, autogerar e listar assinaturas digitais.
 *
 * Contrato oficial:
 * - req.user.id é o identificador oficial do usuário autenticado.
 * - req.user.perfil é string única:
 *   - usuario
 *   - organizador
 *   - administrador
 *
 * Tabela oficial:
 * - assinaturas.usuario_id
 * - assinaturas.imagem_base64
 *
 * Permissão:
 * - getAssinatura: qualquer usuário autenticado
 * - salvarAssinatura: qualquer usuário autenticado
 * - ensureAutoSignature: qualquer usuário autenticado
 * - listarAssinaturas: organizador ou administrador, conforme rota atual
 *
 * Padrão:
 * - Sem aliases.
 * - Sem userId/usuario_id no token.
 * - Sem req.usuario.
 * - Sem perfis array.
 * - Sem role/roles/perfis.
 * - Sem compat DB resiliente.
 * - Sem cargo textual legado em usuarios.
 * - Respostas ok/data/message/code.
 */

const path = require("path");
const fs = require("fs");

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  throw new Error("[assinaturaController] db.query indisponível.");
}

/* ─────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const MAX_DATAURL_TOTAL = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const PERFIS_AUTORIZADOS_LISTAGEM = new Set(["organizador", "administrador"]);

const DATA_IMAGE_URL_RE =
  /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i;

const IS_DEV = process.env.NODE_ENV !== "production";

/* ─────────────────────────────────────────────────────────────
   Helpers de resposta
────────────────────────────────────────────────────────────── */

function getRequestId(res) {
  try {
    return res?.getHeader?.("X-Request-Id") || undefined;
  } catch {
    return undefined;
  }
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    requestId: getRequestId(res),
    ...extra,
  });
}

function respostaOk(res, status, data = {}, extra = {}) {
  return res.status(status).json({
    ok: true,
    data,
    requestId: getRequestId(res),
    ...extra,
  });
}

/* ─────────────────────────────────────────────────────────────
   Helpers de autenticação/autorização
────────────────────────────────────────────────────────────── */

function getUsuarioId(req) {
  const id = Number(req?.user?.id);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getPerfil(req) {
  return String(req?.user?.perfil || "").trim();
}

function exigirUsuarioAutenticado(req, res) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    respostaErro(
      res,
      401,
      "ASSINATURA-401-NAO-AUTENTICADO",
      "Usuário autenticado não encontrado."
    );

    return null;
  }

  return usuarioId;
}

function exigirPerfilListagem(req, res) {
  const perfil = getPerfil(req);

  if (!PERFIS_AUTORIZADOS_LISTAGEM.has(perfil)) {
    respostaErro(
      res,
      403,
      "ASSINATURA-403-LISTAGEM-NAO-AUTORIZADA",
      "A listagem de assinaturas é restrita a organizador ou administrador.",
      {
        adminHint:
          "A assinatura própria é liberada para qualquer usuário autenticado; a listagem geral permanece restrita.",
      }
    );
    return false;
  }

  return true;
}

/* ─────────────────────────────────────────────────────────────
   Logs controlados
────────────────────────────────────────────────────────────── */

function logInfo(scope, extra = {}) {
  if (!IS_DEV) return;

  console.log(`[assinaturaController.${scope}]`, extra);
}

function logWarn(scope, extra = {}) {
  console.warn(`[assinaturaController.${scope}]`, extra);
}

function logError(scope, err, extra = {}) {
  console.error(`[assinaturaController.${scope}] ERRO`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    stack: err?.stack,
    ...extra,
  });
}

/* ─────────────────────────────────────────────────────────────
   Helpers de dataURL/base64
────────────────────────────────────────────────────────────── */

function isAllowedImageDataUrl(dataUrl) {
  return DATA_IMAGE_URL_RE.test(String(dataUrl || "").trim());
}

function extractBase64Payload(dataUrl) {
  const match = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);

  return match ? match[1] : null;
}

function base64ToBytesApprox(base64) {
  const clean = String(base64 || "").replace(/\s/g, "");

  if (!clean) return 0;

  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;

  return Math.floor((clean.length * 3) / 4) - padding;
}

function validarDataUrlAssinatura(assinatura) {
  if (!assinatura || typeof assinatura !== "string") {
    return {
      ok: false,
      status: 400,
      code: "ASSINATURA-400-AUSENTE",
      message: "Assinatura é obrigatória.",
    };
  }

  const trimmed = assinatura.trim();

  if (!isAllowedImageDataUrl(trimmed)) {
    return {
      ok: false,
      status: 400,
      code: "ASSINATURA-400-FORMATO-INVALIDO",
      message:
        "Assinatura inválida. Envie imagem PNG, JPG/JPEG ou WEBP em base64.",
    };
  }

  if (trimmed.length > MAX_DATAURL_TOTAL) {
    return {
      ok: false,
      status: 413,
      code: "ASSINATURA-413-DATAURL-GRANDE",
      message: "Imagem muito grande. Limite máximo: 6MB.",
    };
  }

  const base64 = extractBase64Payload(trimmed);

  if (!base64) {
    return {
      ok: false,
      status: 400,
      code: "ASSINATURA-400-DATAURL-INVALIDA",
      message: "DataURL inválida.",
    };
  }

  const bytes = base64ToBytesApprox(base64);

  if (bytes > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "ASSINATURA-413-IMAGEM-GRANDE",
      message: "Imagem muito grande. Payload máximo: 4MB.",
    };
  }

  return {
    ok: true,
    assinatura: trimmed.replace(/\s+/g, ""),
    bytes,
    mime:
      trimmed.match(/^data:(image\/[^;]+);base64,/i)?.[1] || "image/unknown",
  };
}

/* ─────────────────────────────────────────────────────────────
   Assinatura automática
────────────────────────────────────────────────────────────── */

function buildNameVariants(fullName = "") {
  const clean = String(fullName || "").replace(/\s+/g, " ").trim();

  if (!clean) {
    return { text: "Assinatura" };
  }

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return {
      clean: parts[0],
      text: parts[0],
    };
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

function resolveSignatureTtf() {
  const envTtf = String(process.env.SIGNATURE_FONT_TTF || "").trim();

  if (envTtf) return envTtf;

  const candidates = [
    path.join(process.cwd(), "fonts", "GreatVibes-Regular.ttf"),
    path.join(process.cwd(), "assets", "fonts", "GreatVibes-Regular.ttf"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

let canvasLib = null;

function requireCanvas() {
  if (canvasLib) return canvasLib;

  // eslint-disable-next-line global-require
  canvasLib = require("canvas");

  return canvasLib;
}

const SIGNATURE_CFG = {
  width: Number(process.env.SIGNATURE_WIDTH || 900),
  height: Number(process.env.SIGNATURE_HEIGHT || 300),
  padding: Number(process.env.SIGNATURE_PADDING || 40),
  fontMin: Number(process.env.SIGNATURE_FONT_MIN || 72),
  fontMax: Number(process.env.SIGNATURE_FONT_MAX || 180),
  family: process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto",
  ttf: resolveSignatureTtf(),
  stroke: process.env.SIGNATURE_STROKE || "#111827",
  fill: process.env.SIGNATURE_FILL || "#111827",
  shadow: process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)",
};

let fontRegistered = false;

function ensureFontRegistered() {
  if (fontRegistered) return;

  try {
    if (SIGNATURE_CFG.ttf) {
      const { registerFont } = requireCanvas();

      registerFont(SIGNATURE_CFG.ttf, {
        family: SIGNATURE_CFG.family,
      });

      logInfo("ensureFontRegistered", {
        fonte: SIGNATURE_CFG.ttf,
      });
    } else {
      logWarn("ensureFontRegistered", {
        message:
          "Fonte TTF não encontrada. Será usada fonte cursiva disponível no sistema.",
      });
    }
  } catch (err) {
    logWarn("ensureFontRegistered", {
      message: err?.message || String(err),
    });
  } finally {
    fontRegistered = true;
  }
}

let externalRenderSignaturePng = null;

try {
  // eslint-disable-next-line global-require
  const signatureUtil = require("../utils/signature");

  if (typeof signatureUtil?.renderSignaturePng === "function") {
    externalRenderSignaturePng = signatureUtil.renderSignaturePng;
  }
} catch {
  externalRenderSignaturePng = null;
}

function renderSignatureFallbackPng(nome) {
  const { createCanvas } = requireCanvas();

  ensureFontRegistered();

  const width = SIGNATURE_CFG.width;
  const height = SIGNATURE_CFG.height;
  const padding = SIGNATURE_CFG.padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);

  const variants = buildNameVariants(nome);
  const options = [
    variants.opt1,
    variants.opt2,
    variants.opt3,
    variants.opt4,
    variants.clean,
    variants.text,
  ].filter(Boolean);

  const maxTextWidth = width - padding * 2;

  function fontSpec(size) {
    return `${size}px "${SIGNATURE_CFG.family}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
  }

  function fits(text, size) {
    ctx.font = fontSpec(size);
    return ctx.measureText(text).width <= maxTextWidth;
  }

  function pickVariant() {
    for (const text of options) {
      if (fits(text, SIGNATURE_CFG.fontMin)) return text;
    }

    return options[options.length - 1] || "Assinatura";
  }

  function pickFontSize(text) {
    let min = SIGNATURE_CFG.fontMin;
    let max = SIGNATURE_CFG.fontMax;
    let best = min;

    while (min <= max) {
      const mid = Math.floor((min + max) / 2);

      if (fits(text, mid)) {
        best = mid;
        min = mid + 2;
      } else {
        max = mid - 2;
      }
    }

    return best;
  }

  const text = pickVariant();
  const fontPx = pickFontSize(text);

  ctx.font = fontSpec(fontPx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = SIGNATURE_CFG.shadow;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.03));
  ctx.strokeStyle = SIGNATURE_CFG.stroke;
  ctx.fillStyle = SIGNATURE_CFG.fill;

  const centerX = width / 2;
  const centerY = height / 2 + Math.round(fontPx * 0.08);

  ctx.strokeText(text, centerX, centerY);
  ctx.fillText(text, centerX, centerY);

  const buffer = canvas.toBuffer("image/png");

  return {
    buffer,
    text,
    fontPx,
    mime: "image/png",
  };
}

function renderSignaturePng(name) {
  if (typeof externalRenderSignaturePng === "function") {
    try {
      return externalRenderSignaturePng(name);
    } catch (err) {
      logWarn("renderSignaturePng", {
        message:
          "Falha no render externo de assinatura. Usando fallback interno.",
        detail: err?.message,
      });
    }
  }

  return renderSignatureFallbackPng(name);
}

/* ─────────────────────────────────────────────────────────────
   Persistência
────────────────────────────────────────────────────────────── */

async function obterAssinaturaPorUsuario(usuarioId) {
  const result = await db.query(
    `
    SELECT imagem_base64
    FROM assinaturas
    WHERE usuario_id = $1
    LIMIT 1
    `,
    [Number(usuarioId)]
  );

  return result.rows?.[0]?.imagem_base64 || null;
}

async function upsertAssinatura(usuarioId, imagemBase64) {
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

async function obterUsuarioParaAssinatura(usuarioId) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      email,
      perfil
    FROM usuarios
    WHERE id = $1
    LIMIT 1
    `,
    [Number(usuarioId)]
  );

  return result.rows?.[0] || null;
}

/* ─────────────────────────────────────────────────────────────
   Serviço interno de autogeração
────────────────────────────────────────────────────────────── */

async function ensureAutoSignature(usuarioId) {
  const id = Number(usuarioId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  const existing = await obterAssinaturaPorUsuario(id);

  if (existing) {
    logInfo("ensureAutoSignature", {
      usuarioId: id,
      status: "assinatura_existente",
    });

    return null;
  }

const usuario = await obterUsuarioParaAssinatura(id);

if (!usuario) {
  logInfo("ensureAutoSignature", {
    usuarioId: id,
    status: "usuario_nao_encontrado",
  });

  return null;
}

  const displayName = String(usuario.nome || usuario.email || `Usuario_${usuario.id}`)
    .replace(/\s+/g, " ")
    .trim();

  const { buffer } = renderSignaturePng(displayName);
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

  await upsertAssinatura(id, dataUrl);

  logInfo("ensureAutoSignature", {
    usuarioId: id,
    status: "assinatura_autogerada",
    bytes: buffer.length,
  });

  return dataUrl;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/assinatura
────────────────────────────────────────────────────────────── */

async function getAssinatura(req, res) {
  const usuarioId = exigirUsuarioAutenticado(req, res);

  if (!usuarioId) return null;

  try {
    let assinatura = await obterAssinaturaPorUsuario(usuarioId);
    let autogerada = false;

    if (!assinatura) {
      try {
        const nova = await ensureAutoSignature(usuarioId);

        if (nova) {
          assinatura = nova;
          autogerada = true;
          res.setHeader("X-Assinatura-Autogerada", "1");
        }
      } catch (err) {
        logWarn("getAssinatura.ensureAutoSignature", {
          usuarioId,
          message: err?.message,
        });
      }
    }

    logInfo("getAssinatura", {
      usuarioId,
      temAssinatura: !!assinatura,
      autogerada,
    });

    return respostaOk(
      res,
      200,
      {
        assinatura: assinatura || null,
        tem_assinatura: !!assinatura,
        autogerada,
      },
      {
        message: assinatura
          ? "Assinatura localizada."
          : "Nenhuma assinatura cadastrada.",
      }
    );
  } catch (err) {
    logError("getAssinatura", err, { usuarioId });

    return respostaErro(
      res,
      500,
      "ASSINATURA-500-BUSCAR",
      "Erro ao buscar assinatura."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/assinatura
────────────────────────────────────────────────────────────── */

async function salvarAssinatura(req, res) {
  const usuarioId = exigirUsuarioAutenticado(req, res);

  if (!usuarioId) return null;

  const validacao = validarDataUrlAssinatura(req.body?.assinatura);

  if (!validacao.ok) {
    return respostaErro(
      res,
      validacao.status,
      validacao.code,
      validacao.message,
      {
        fieldErrors: {
          assinatura: validacao.message,
        },
      }
    );
  }

  try {
    await upsertAssinatura(usuarioId, validacao.assinatura);

    logInfo("salvarAssinatura", {
      usuarioId,
      bytesAprox: validacao.bytes,
      mime: validacao.mime,
    });

    return respostaOk(
      res,
      200,
      {
        tem_assinatura: true,
      },
      {
        message: "Assinatura salva com sucesso.",
      }
    );
  } catch (err) {
    logError("salvarAssinatura", err, {
      usuarioId,
      bytesAprox: validacao.bytes,
    });

    return respostaErro(
      res,
      500,
      "ASSINATURA-500-SALVAR",
      "Erro ao salvar assinatura."
    );
  }
}

/* ─────────────────────────────────────────────────────────────
   GET /api/assinatura/lista
────────────────────────────────────────────────────────────── */

async function listarAssinaturas(req, res) {
  const usuarioId = exigirUsuarioAutenticado(req, res);

  if (!usuarioId) return null;

if (!exigirPerfilListagem(req, res)) return null;

  try {
    const result = await db.query(
      `
      SELECT
        a.usuario_id AS id,
        u.nome,
        c.nome AS cargo_nome
      FROM assinaturas a
      INNER JOIN usuarios u ON u.id = a.usuario_id
      LEFT JOIN cargos c ON c.id = u.cargo_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = (result.rows || []).map((row) => ({
      id: row.id,
      nome: row.nome,
      cargo_nome: row.cargo_nome || null,
      tem_assinatura: true,
    }));

    logInfo("listarAssinaturas", {
      solicitadoPor: usuarioId,
      perfil: getPerfil(req),
      total: lista.length,
    });

    return respostaOk(
      res,
      200,
      {
        lista,
        total: lista.length,
      },
      {
        message: "Assinaturas listadas com sucesso.",
      }
    );
  } catch (err) {
    logError("listarAssinaturas", err, { usuarioId });

    return respostaErro(
      res,
      500,
      "ASSINATURA-500-LISTAR",
      "Erro ao listar assinaturas."
    );
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
  listarAssinaturas,
  ensureAutoSignature,
};