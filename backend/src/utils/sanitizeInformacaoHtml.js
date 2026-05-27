/* eslint-disable no-control-regex */
"use strict";

/**
 * 📁 src/utils/sanitizeInformacaoHtml.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Sanitizar HTML de informações institucionais.
 * - Gerar texto puro.
 * - Gerar resumo seguro a partir do HTML.
 *
 * Segurança:
 * - Bloqueia scripts, estilos perigosos e protocolos inseguros.
 * - Permite apenas tags e atributos controlados.
 * - Permite apenas http, https e mailto em links.
 * - Remove caracteres invisíveis perigosos.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário aqui.
 */

const sanitizeHtml = require("sanitize-html");

/* =========================
   Constantes
========================= */

const MAX_HTML_LENGTH = 80_000;

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;

const RGB_COLOR_PATTERN =
  /^rgb\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/;

const RGBA_COLOR_PATTERN =
  /^rgba\(\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(0|1|0?\.\d+)\s*\)$/;

const COLOR_PATTERNS = [
  HEX_COLOR_PATTERN,
  RGB_COLOR_PATTERN,
  RGBA_COLOR_PATTERN,
];

const TEXT_ALIGN_PATTERNS = [/^left$/, /^right$/, /^center$/, /^justify$/];

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "code",
  "pre",
  "a",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href"],
  span: ["style"],
  p: ["style"],
  h1: ["style"],
  h2: ["style"],
  h3: ["style"],
  h4: ["style"],
  blockquote: ["style"],
};

const ALLOWED_STYLES = {
  "*": {
    color: COLOR_PATTERNS,
    "background-color": COLOR_PATTERNS,
    "text-align": TEXT_ALIGN_PATTERNS,
  },
};

/* =========================
   Helpers
========================= */

function normalizeHtmlInput(html = "") {
  if (html === undefined || html === null) {
    return "";
  }

  return String(html)
    .replace(/\u0000/g, "")
    .slice(0, MAX_HTML_LENGTH)
    .trim();
}

function stripDangerousInvisibleChars(text = "") {
  return String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function normalizeWhitespace(text = "") {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isExternalHref(href = "") {
  return /^https?:\/\//i.test(String(href || "").trim());
}

function isAllowedHref(href = "") {
  const value = String(href || "").trim();

  if (!value) {
    return false;
  }

  if (/^(javascript|data|vbscript|file):/i.test(value)) {
    return false;
  }

  return /^(https?:\/\/|mailto:)/i.test(value);
}

/* =========================
   Sanitização principal
========================= */

function sanitizeInformacaoHtml(html = "") {
  const safeInput = normalizeHtmlInput(html);

  return sanitizeHtml(safeInput, {
    allowedTags: ALLOWED_TAGS,

    allowedAttributes: ALLOWED_ATTRIBUTES,

    allowedClasses: {},

    allowedStyles: ALLOWED_STYLES,

    allowedSchemes: ["http", "https", "mailto"],

    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
    },

    allowProtocolRelative: false,

    enforceHtmlBoundary: true,

    transformTags: {
      a: (_tagName, attribs = {}) => {
        const href = String(attribs.href || "").trim();

        if (!isAllowedHref(href)) {
          return {
            tagName: "span",
            text: "",
          };
        }

        const nextAttribs = {
          href,
          rel: "noopener noreferrer",
        };

        if (isExternalHref(href)) {
          nextAttribs.target = "_blank";
        }

        return {
          tagName: "a",
          attribs: nextAttribs,
        };
      },
    },

    parser: {
      lowerCaseTags: true,
    },
  });
}

/* =========================
   Texto puro / resumo
========================= */

function stripHtmlToText(html = "") {
  const safeInput = normalizeHtmlInput(html);

  const withoutTags = safeInput
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<\/pre>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, " ");

  return normalizeWhitespace(stripDangerousInvisibleChars(withoutTags));
}

function buildResumoFromHtml(html = "", max = 220) {
  const text = stripHtmlToText(html);

  if (!text) {
    return "";
  }

  const safeMax = Number.isFinite(Number(max))
    ? Math.max(1, Math.trunc(Number(max)))
    : 220;

  if (text.length <= safeMax) {
    return text;
  }

  const corte = text.slice(0, safeMax);
  const ultimoEspaco = corte.lastIndexOf(" ");

  if (ultimoEspaco > Math.max(20, Math.floor(safeMax * 0.5))) {
    return `${corte.slice(0, ultimoEspaco).trim()}…`;
  }

  return `${corte.trim()}…`;
}

module.exports = {
  sanitizeInformacaoHtml,
  stripHtmlToText,
  buildResumoFromHtml,

  MAX_HTML_LENGTH,
};