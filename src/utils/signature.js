/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

/* =========================
   Helpers base
========================= */
function toInt(v, fallback) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.trunc(n);

  const fb = Number(fallback);
  return Number.isFinite(fb) ? Math.trunc(fb) : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function uniqPreserveOrder(arr) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(arr) ? arr : []) {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

/* =========================
   Config
========================= */
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

// fallback duro para evitar overflow quando nada cabe
const FONT_HARD_MIN = clamp(
  toInt(process.env.SIGNATURE_FONT_HARD_MIN, 12),
  8,
  FONT_MIN
);

const STROKE = process.env.SIGNATURE_STROKE || "#111827";
const FILL = process.env.SIGNATURE_FILL || "#111827";
const SHADOW = process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)";

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

const _cache = new Map(); // key -> { ts, value }

let _fontRegistered = false;

/* =========================
   Fonte
========================= */
function ensureFont() {
  if (_fontRegistered) return;

  try {
    if (fs.existsSync(SIGNATURE_FONT_PATH)) {
      registerFont(SIGNATURE_FONT_PATH, {
        family: SIGNATURE_FONT_FAMILY,
      });
    } else {
      console.warn(
        "[signature] Fonte não encontrada:",
        SIGNATURE_FONT_PATH,
        "→ usando fallback do sistema."
      );
    }
  } catch (e) {
    console.warn(
      "[signature] Falha ao registrar fonte:",
      e?.message || e
    );
  } finally {
    _fontRegistered = true;
  }
}

/* =========================
   Cache
========================= */
function pruneCache() {
  if (_cache.size <= CACHE_MAX_ITEMS) return;

  const entries = Array.from(_cache.entries()).sort(
    (a, b) => (a[1]?.ts || 0) - (b[1]?.ts || 0)
  );

  while (entries.length > CACHE_MAX_ITEMS) {
    const oldest = entries.shift();
    if (oldest) _cache.delete(oldest[0]);
  }
}

/* =========================
   Nome / variantes
========================= */
function cleanName(fullName = "") {
  return String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gera variantes em ordem de preferência visual.
 */
function variantsForSignature(fullName = "") {
  const clean = cleanName(fullName);
  if (!clean) return ["Assinatura"];

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return [parts[0]];

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

/* =========================
   Medição / fonte
========================= */
function setFont(ctx, fontPx) {
  ctx.font = `${fontPx}px "${SIGNATURE_FONT_FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
}

function measureWidth(ctx, text, fontPx) {
  setFont(ctx, fontPx);
  return ctx.measureText(String(text || "")).width;
}

function fitFontForText(ctx, text, maxWidth, minPx, maxPx) {
  if (!text) return null;

  if (measureWidth(ctx, text, minPx) > maxWidth) {
    return null;
  }

  let lo = minPx;
  let hi = maxPx;
  let ok = minPx;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);

    if (measureWidth(ctx, text, mid) <= maxWidth) {
      ok = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return ok;
}

/**
 * Escolhe a melhor variante:
 * - prioriza a que permite maior tamanho de fonte
 * - em empate, mantém a que apareceu antes
 */
function pickBestTextAndFont(ctx, variants, maxWidth) {
  let best = null;

  for (const text of variants) {
    const fitted = fitFontForText(ctx, text, maxWidth, FONT_MIN, FONT_MAX);
    if (fitted == null) continue;

    if (!best || fitted > best.fontPx) {
      best = { text, fontPx: fitted };
    }
  }

  if (best) return best;

  // fallback duro: tenta a variante mais curta abaixo do FONT_MIN
  const shortest = [...variants].sort((a, b) => a.length - b.length)[0] || "Assinatura";

  for (let px = FONT_MIN; px >= FONT_HARD_MIN; px -= 2) {
    if (measureWidth(ctx, shortest, px) <= maxWidth) {
      return { text: shortest, fontPx: px };
    }
  }

  return { text: shortest, fontPx: FONT_HARD_MIN };
}

/* =========================
   Compat legado
========================= */
function abbrevForSignature(fullName = "") {
  const variants = variantsForSignature(fullName);
  return variants[0] || "Assinatura";
}

/* =========================
   Render
========================= */
function renderSignaturePng(name) {
  try {
    const clean = cleanName(name);
    const cacheKey = clean.toLowerCase();

    if (CACHE_TTL_MS > 0) {
      const cached = _cache.get(cacheKey);
      if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
        return cached.value;
      }
    }

    ensureFont();

    const canvas = createCanvas(SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);

    const variants = variantsForSignature(clean);
    const maxTextWidth = SIGNATURE_WIDTH - SIGNATURE_PADDING * 2;

    const { text, fontPx } = pickBestTextAndFont(
      ctx,
      variants,
      maxTextWidth
    );

    setFont(ctx, fontPx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.03));
    ctx.strokeStyle = STROKE;
    ctx.fillStyle = FILL;

    const cx = SIGNATURE_WIDTH / 2;
    const cy = SIGNATURE_HEIGHT / 2 + Math.round(fontPx * 0.08);

    ctx.strokeText(text, cx, cy);
    ctx.fillText(text, cx, cy);

    const buffer = canvas.toBuffer("image/png");

    const value = {
      buffer,
      text,
      fontPx,
      width: SIGNATURE_WIDTH,
      height: SIGNATURE_HEIGHT,
      mime: "image/png",
    };

    if (CACHE_TTL_MS > 0) {
      _cache.set(cacheKey, { ts: Date.now(), value });
      pruneCache();
    }

    return value;
  } catch (e) {
    console.warn(
      "[signature] renderSignaturePng falhou:",
      e?.message || e
    );
    return null;
  }
}

module.exports = {
  renderSignaturePng,
  abbrevForSignature,
  variantsForSignature,
};