/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/utils/assinaturaAuto.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Gerar imagem PNG de assinatura automática a partir do nome do usuário.
 *
 * Uso oficial:
 *   const { renderSignaturePng } = require("../utils/assinaturaAuto");
 *
 * Regra oficial:
 * - Este utilitário não valida perfil.
 * - Qualquer usuário válido pode ter assinatura automática.
 * - A regra de autenticação/usuário pertence ao service/controller.
 *
 * Observações:
 * - Não manipula datas.
 * - Não há risco de fuso horário.
 * - Não exporta helpers internos.
 * - Falha de canvas/fonte retorna null de forma controlada.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* ─────────────────────────────────────────
   Helpers base
───────────────────────────────────────── */

function toInt(value, fallback) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return Math.trunc(number);
  }

  const fallbackNumber = Number(fallback);

  return Number.isFinite(fallbackNumber) ? Math.trunc(fallbackNumber) : 0;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, number));
}

function uniqPreserveOrder(lista) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(lista) ? lista : []) {
    const value = String(item || "").trim();

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    out.push(value);
  }

  return out;
}

/* ─────────────────────────────────────────
   Configuração oficial
───────────────────────────────────────── */

const SIGNATURE_FONT_PATH = path.resolve(
  process.env.SIGNATURE_FONT_TTF ||
    path.join(process.cwd(), "fonts", "GreatVibes-Regular.ttf")
);

const SIGNATURE_FONT_FAMILY =
  process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto";

const SIGNATURE_WIDTH = clamp(
  toInt(process.env.SIGNATURE_WIDTH, 900),
  300,
  2400
);

const SIGNATURE_HEIGHT = clamp(
  toInt(process.env.SIGNATURE_HEIGHT, 300),
  120,
  900
);

const SIGNATURE_PADDING = clamp(
  toInt(process.env.SIGNATURE_PADDING, 40),
  0,
  200
);

const FONT_MIN = clamp(
  toInt(process.env.SIGNATURE_FONT_MIN, 72),
  16,
  300
);

const FONT_MAX = clamp(
  toInt(process.env.SIGNATURE_FONT_MAX, 180),
  FONT_MIN,
  600
);

const FONT_HARD_MIN = clamp(
  toInt(process.env.SIGNATURE_FONT_HARD_MIN, 12),
  8,
  FONT_MIN
);

const SIGNATURE_STROKE = process.env.SIGNATURE_STROKE || "#111827";
const SIGNATURE_FILL = process.env.SIGNATURE_FILL || "#111827";
const SIGNATURE_SHADOW =
  process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)";

const CACHE_TTL_MS = clamp(
  toInt(process.env.SIGNATURE_CACHE_TTL_MS, 60_000),
  0,
  10 * 60 * 1000
);

const CACHE_MAX_ITEMS = clamp(
  toInt(process.env.SIGNATURE_CACHE_MAX_ITEMS, 300),
  20,
  5000
);

const MAX_NAME_LENGTH = clamp(
  toInt(process.env.SIGNATURE_MAX_NAME_LENGTH, 120),
  20,
  240
);

const cache = new Map();

let fontRegistered = false;
let canvasModule = null;

/* ─────────────────────────────────────────
   Canvas / fonte
───────────────────────────────────────── */

function getCanvasModule() {
  if (canvasModule) {
    return canvasModule;
  }

  try {
    // eslint-disable-next-line global-require
    canvasModule = require("canvas");
    return canvasModule;
  } catch (error) {
    console.warn("[assinaturaAuto] Pacote canvas indisponível.", {
      message: error?.message,
    });

    return null;
  }
}

function ensureFont() {
  if (fontRegistered) {
    return;
  }

  try {
    const canvas = getCanvasModule();

    if (!canvas?.registerFont) {
      return;
    }

    if (fs.existsSync(SIGNATURE_FONT_PATH)) {
      canvas.registerFont(SIGNATURE_FONT_PATH, {
        family: SIGNATURE_FONT_FAMILY,
      });
    } else {
      console.warn("[assinaturaAuto] Fonte não encontrada; usando fallback.", {
        path: SIGNATURE_FONT_PATH,
      });
    }
  } catch (error) {
    console.warn("[assinaturaAuto] Falha ao registrar fonte.", {
      message: error?.message,
    });
  } finally {
    fontRegistered = true;
  }
}

/* ─────────────────────────────────────────
   Nome / variantes
───────────────────────────────────────── */

function cleanName(fullName = "") {
  return String(fullName || "")
    .replace(/[^\p{L}\p{M}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

function getSignatureVariants(fullName = "") {
  const clean = cleanName(fullName);

  if (!clean) {
    return ["Assinatura"];
  }

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) {
    return [parts[0]];
  }

  const first = parts[0];
  const last = parts[parts.length - 1];
  const middle = parts.length > 2 ? parts[1] : null;

  const variants = [
    `${first} ${last}`,
    middle ? `${first} ${middle[0].toUpperCase()}. ${last}` : null,
    clean,
    `${first} ${last[0].toUpperCase()}.`,
    `${first[0].toUpperCase()}. ${last}`,
    `${first[0].toUpperCase()}. ${last[0].toUpperCase()}.`,
    first,
  ];

  return uniqPreserveOrder(variants);
}

/* ─────────────────────────────────────────
   Cache
───────────────────────────────────────── */

function getCacheKey(name) {
  const clean = cleanName(name) || "Assinatura";

  const configKey = [
    SIGNATURE_WIDTH,
    SIGNATURE_HEIGHT,
    SIGNATURE_PADDING,
    FONT_MIN,
    FONT_MAX,
    FONT_HARD_MIN,
    SIGNATURE_FONT_FAMILY,
    SIGNATURE_STROKE,
    SIGNATURE_FILL,
    SIGNATURE_SHADOW,
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(`${clean.toLowerCase()}|${configKey}`)
    .digest("hex");
}

function pruneCache() {
  if (cache.size <= CACHE_MAX_ITEMS) {
    return;
  }

  const entries = Array.from(cache.entries()).sort(
    (a, b) => (a[1]?.ts || 0) - (b[1]?.ts || 0)
  );

  while (entries.length > CACHE_MAX_ITEMS) {
    const oldest = entries.shift();

    if (oldest) {
      cache.delete(oldest[0]);
    }
  }
}

/* ─────────────────────────────────────────
   Medição / fonte
───────────────────────────────────────── */

function setFont(ctx, fontPx) {
  ctx.font = `${fontPx}px "${SIGNATURE_FONT_FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
}

function measureWidth(ctx, text, fontPx) {
  setFont(ctx, fontPx);
  return ctx.measureText(String(text || "")).width;
}

function fitFontForText(ctx, text, maxWidth, minPx, maxPx) {
  if (!text || maxWidth <= 0) {
    return null;
  }

  if (measureWidth(ctx, text, minPx) > maxWidth) {
    return null;
  }

  let low = minPx;
  let high = maxPx;
  let best = minPx;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (measureWidth(ctx, text, middle) <= maxWidth) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return best;
}

function pickBestTextAndFont(ctx, variants, maxWidth) {
  let best = null;

  for (const text of variants) {
    const fitted = fitFontForText(ctx, text, maxWidth, FONT_MIN, FONT_MAX);

    if (fitted == null) {
      continue;
    }

    if (!best || fitted > best.fontPx) {
      best = {
        text,
        fontPx: fitted,
      };
    }
  }

  if (best) {
    return best;
  }

  const shortest =
    [...variants].sort((a, b) => a.length - b.length)[0] || "Assinatura";

  for (let fontPx = FONT_MIN; fontPx >= FONT_HARD_MIN; fontPx -= 2) {
    if (measureWidth(ctx, shortest, fontPx) <= maxWidth) {
      return {
        text: shortest,
        fontPx,
      };
    }
  }

  return {
    text: shortest,
    fontPx: FONT_HARD_MIN,
  };
}

/* ─────────────────────────────────────────
   Render oficial
───────────────────────────────────────── */

function renderSignaturePng(name) {
  try {
    const clean = cleanName(name);
    const cacheKey = getCacheKey(clean);

    if (CACHE_TTL_MS > 0) {
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
        return cached.value;
      }
    }

    const canvas = getCanvasModule();

    if (!canvas?.createCanvas) {
      return null;
    }

    ensureFont();

    const assinaturaCanvas = canvas.createCanvas(
      SIGNATURE_WIDTH,
      SIGNATURE_HEIGHT
    );

    const ctx = assinaturaCanvas.getContext("2d");

    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);

    const variants = getSignatureVariants(clean);
    const maxTextWidth = SIGNATURE_WIDTH - SIGNATURE_PADDING * 2;

    const { text, fontPx } = pickBestTextAndFont(
      ctx,
      variants,
      maxTextWidth
    );

    setFont(ctx, fontPx);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = SIGNATURE_SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.03));
    ctx.strokeStyle = SIGNATURE_STROKE;
    ctx.fillStyle = SIGNATURE_FILL;

    const centerX = SIGNATURE_WIDTH / 2;
    const centerY = SIGNATURE_HEIGHT / 2 + Math.round(fontPx * 0.08);

    ctx.strokeText(text, centerX, centerY);
    ctx.fillText(text, centerX, centerY);

    const buffer = assinaturaCanvas.toBuffer("image/png");

    const value = {
      buffer,
      text,
      fontPx,
      width: SIGNATURE_WIDTH,
      height: SIGNATURE_HEIGHT,
      mime: "image/png",
    };

    if (CACHE_TTL_MS > 0) {
      cache.set(cacheKey, {
        ts: Date.now(),
        value,
      });

      pruneCache();
    }

    return value;
  } catch (error) {
    console.warn("[assinaturaAuto] renderSignaturePng falhou.", {
      message: error?.message,
    });

    return null;
  }
}

/* ─────────────────────────────────────────
   Export oficial
───────────────────────────────────────── */

module.exports = {
  renderSignaturePng,
};