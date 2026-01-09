/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

/* =========================
   Helpers de config
========================= */
function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* =========================
   Config: fontes e limites
========================= */
const SIGNATURE_FONT_PATH = path.resolve(
  process.env.SIGNATURE_FONT_TTF || path.join(process.cwd(), "fonts", "GreatVibes-Regular.ttf")
);

const SIGNATURE_FONT_FAMILY = process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto";

const SIGNATURE_WIDTH = clamp(toInt(process.env.SIGNATURE_WIDTH, 900), 300, 2400);
const SIGNATURE_HEIGHT = clamp(toInt(process.env.SIGNATURE_HEIGHT, 300), 120, 900);
const SIGNATURE_PADDING = clamp(toInt(process.env.SIGNATURE_PADDING, 40), 0, 200);

const FONT_MIN = clamp(toInt(process.env.SIGNATURE_FONT_MIN, 72), 16, 300);
const FONT_MAX = clamp(toInt(process.env.SIGNATURE_FONT_MAX, 180), FONT_MIN, 600);

const STROKE = process.env.SIGNATURE_STROKE || "#111827"; // zinc-900
const FILL   = process.env.SIGNATURE_FILL   || "#111827";
const SHADOW = process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)";

// Cache leve (evita render repetido)
const CACHE_TTL_MS = clamp(toInt(process.env.SIGNATURE_CACHE_TTL_MS, 60_000), 0, 10 * 60_000);
const _cache = new Map(); // key -> { ts, value }

let _fontRegistered = false;
function ensureFont() {
  if (_fontRegistered) return;
  try {
    if (fs.existsSync(SIGNATURE_FONT_PATH)) {
      registerFont(SIGNATURE_FONT_PATH, { family: SIGNATURE_FONT_FAMILY });
      _fontRegistered = true;
    } else {
      console.warn("[signature] Fonte não encontrada:", SIGNATURE_FONT_PATH, "→ fallback sistema.");
      _fontRegistered = true;
    }
  } catch (e) {
    console.warn("[signature] Falha ao registrar fonte:", e?.message || e);
    _fontRegistered = true;
  }
}

function _cleanName(fullName = "") {
  return String(fullName).replace(/\s+/g, " ").trim();
}

/**
 * Gera variantes de texto para assinatura (da mais completa para a mais curta).
 */
function variantsForSignature(fullName = "") {
  const clean = _cleanName(fullName);
  if (!clean) return ["Assinatura"];

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return [parts[0]];

  const first = parts[0];
  const last = parts[parts.length - 1];

  // meio (se houver)
  const middle = parts.length > 2 ? parts[1] : null;

  const v = [];

  // Mais “bonito” em assinatura: Nome Sobrenome
  v.push(`${first} ${last}`);

  // Se tem nome do meio: Nome M. Sobrenome (às vezes cabe melhor)
  if (middle) v.push(`${first} ${middle[0].toUpperCase()}. ${last}`);

  // Nome S.
  v.push(`${first} ${last[0].toUpperCase()}.`);

  // N. Sobrenome
  v.push(`${first[0].toUpperCase()}. ${last}`);

  // N. S.
  v.push(`${first[0].toUpperCase()}. ${last[0].toUpperCase()}.`);

  // fallback: nome completo
  v.push(clean);

  // remove duplicados e vazios, preservando ordem
  const seen = new Set();
  return v.filter((x) => {
    const s = String(x || "").trim();
    if (!s || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

function setFont(ctx, fontPx) {
  ctx.font = `${fontPx}px "${SIGNATURE_FONT_FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
}

function measureWidth(ctx, text, fontPx) {
  setFont(ctx, fontPx);
  return ctx.measureText(text).width;
}

/**
 * Escolhe a melhor variante e tamanho de fonte que cabem no maxWidth.
 * Estratégia:
 * - tenta cada variante
 * - para cada variante, acha o maior fontPx possível (binsearch)
 * - escolhe a que resulta em maior fontPx (mais “bonita”)
 */
function pickBestTextAndFont(ctx, variants, maxWidth) {
  let best = { text: variants[0], fontPx: FONT_MIN };

  for (const text of variants) {
    // se não cabe nem no mínimo, tenta próxima variante
    if (measureWidth(ctx, text, FONT_MIN) > maxWidth) continue;

    // binsearch font
    let lo = FONT_MIN, hi = FONT_MAX, ok = FONT_MIN;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (measureWidth(ctx, text, mid) <= maxWidth) {
        ok = mid;
        lo = mid + 2;
      } else {
        hi = mid - 2;
      }
    }

    // preferir maior fonte; em empate, preferir variante “mais completa” (primeiras)
    if (ok > best.fontPx) best = { text, fontPx: ok };
  }

  return best;
}

/** Gera PNG (Buffer) com fundo transparente e assinatura cursiva */
function renderSignaturePng(name) {
  try {
    const clean = _cleanName(name);
    const cacheKey = clean.toLowerCase();

    if (CACHE_TTL_MS > 0) {
      const cached = _cache.get(cacheKey);
      if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) return cached.value;
    }

    ensureFont();

    const canvas = createCanvas(SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    const ctx = canvas.getContext("2d");

    // fundo transparente
    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);

    const variants = variantsForSignature(clean);
    const maxTextWidth = SIGNATURE_WIDTH - SIGNATURE_PADDING * 2;

    const { text, fontPx } = pickBestTextAndFont(ctx, variants, maxTextWidth);

    // estiliza
    setFont(ctx, fontPx);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // sombra sutil
    ctx.shadowColor = SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // traçado fino + preenchido
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

    if (CACHE_TTL_MS > 0) _cache.set(cacheKey, { ts: Date.now(), value });

    return value;
  } catch (e) {
    console.warn("[signature] renderSignaturePng falhou:", e?.message || e);
    return null;
  }
}

module.exports = {
  renderSignaturePng,
  abbrevForSignature: variantsForSignature, // mantém export antigo, agora retorna array de variantes
};
