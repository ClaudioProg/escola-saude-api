/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { createCanvas, registerFont } = require("canvas");

// Config: fontes e limites
const SIGNATURE_FONT_PATH = process.env.SIGNATURE_FONT_TTF || path.join(process.cwd(), "assets", "fonts", "GreatVibes-Regular.ttf");
const SIGNATURE_FONT_FAMILY = process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto";
const SIGNATURE_WIDTH = Number(process.env.SIGNATURE_WIDTH || 900);   // px
const SIGNATURE_HEIGHT = Number(process.env.SIGNATURE_HEIGHT || 300); // px
const SIGNATURE_PADDING = Number(process.env.SIGNATURE_PADDING || 40);
const FONT_MIN = Number(process.env.SIGNATURE_FONT_MIN || 72);
const FONT_MAX = Number(process.env.SIGNATURE_FONT_MAX || 180);
const STROKE = process.env.SIGNATURE_STROKE || "#111827";   // zinc-900
const FILL   = process.env.SIGNATURE_FILL   || "#111827";
const SHADOW = process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)";

let _fontRegistered = false;
function ensureFont() {
  if (_fontRegistered) return;
  try {
    if (fs.existsSync(SIGNATURE_FONT_PATH)) {
      registerFont(SIGNATURE_FONT_PATH, { family: SIGNATURE_FONT_FAMILY });
      _fontRegistered = true;
    } else {
      console.warn("[signature] Fonte não encontrada em", SIGNATURE_FONT_PATH, "→ usando fontes do sistema.");
      _fontRegistered = true; // ainda assim prossegue com fallback
    }
  } catch (e) {
    console.warn("[signature] Falha ao registrar fonte:", e.message);
    _fontRegistered = true;
  }
}

function abbrevForSignature(fullName = "") {
  // Estratégia:
  // - tenta: "Nome Sobrenome"
  // - se muito longo: "Nome S."
  // - se ainda longo: "N. Sobrenome"
  // - fallback: iniciais com último sobrenome "N. S."
  const clean = String(fullName).replace(/\s+/g, " ").trim();
  if (!clean) return "Assinatura";

  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const last = parts[parts.length - 1];

  const opt1 = `${first} ${last}`;        // Nome Sobrenome
  const opt2 = `${first} ${last[0].toUpperCase()}.`; // Nome S.
  const opt3 = `${first[0].toUpperCase()}. ${last}`; // N. Sobrenome
  const opt4 = `${first[0].toUpperCase()}. ${last[0].toUpperCase()}.`; // N. S.

  return { clean, parts, first, last, opt1, opt2, opt3, opt4 };
}

function measureFits(ctx, text, maxWidth, fontPx) {
  ctx.font = `${fontPx}px "${SIGNATURE_FONT_FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
  const m = ctx.measureText(text);
  return { width: m.width, fits: m.width <= maxWidth };
}

function pickTextVariantToFit(ctx, variants, maxWidth) {
  // tenta do mais completo pro mais curto
  const order = ["opt1","opt2","opt3","opt4"];
  for (const key of order) {
    const v = variants[key] || variants.clean || variants;
    const { fits } = measureFits(ctx, v, maxWidth, FONT_MIN); // testar com mínimo
    if (fits) return v;
  }
  // nenhum coube no min → fica opt4 como mínimo
  return variants.opt4 || variants.clean || variants;
}

function pickFontSizeToFit(ctx, text, maxWidth) {
  let lo = FONT_MIN, hi = FONT_MAX, best = FONT_MIN;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const { fits } = measureFits(ctx, text, maxWidth, mid);
    if (fits) { best = mid; lo = mid + 2; } else { hi = mid - 2; }
  }
  return best;
}

/** Gera PNG (Buffer) com fundo transparente e assinatura cursiva */
function renderSignaturePng(name) {
  ensureFont();

  const canvas = createCanvas(SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
  const ctx = canvas.getContext("2d");

  // fundo transparente
  ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);

  const variants = abbrevForSignature(name);
  const maxTextWidth = SIGNATURE_WIDTH - SIGNATURE_PADDING * 2;

  // escolhe variante que cabe ao menos no font MIN
  const text = typeof variants === "string" ? variants : pickTextVariantToFit(ctx, variants, maxTextWidth);
  const fontPx = pickFontSizeToFit(ctx, text, maxTextWidth);

  // estiliza
  ctx.font = `${fontPx}px "${SIGNATURE_FONT_FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
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
  return { buffer, text, fontPx, width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT, mime: "image/png" };
}

module.exports = {
  renderSignaturePng,
  abbrevForSignature,
};
