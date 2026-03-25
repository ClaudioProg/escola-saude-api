/* eslint-disable no-control-regex */
"use strict";

const sanitizeHtml = require("sanitize-html");

/* =========================
   Constantes
========================= */

const COLOR_PATTERNS = [
  /^#[0-9a-fA-F]{3,8}$/,
  /^rgb\((\s*\d+\s*,){2}\s*\d+\s*\)$/,
  /^rgba\((\s*\d+\s*,){3}\s*(0|1|0?\.\d+)\s*\)$/
];

const TEXT_ALIGN_PATTERNS = [/^left$/, /^right$/, /^center$/, /^justify$/];

/* =========================
   Helpers
========================= */

function normalizeHtmlInput(html = "") {
  if (html === undefined || html === null) return "";
  return String(html)
    .replace(/\u0000/g, "")
    .trim();
}

function stripDangerousInvisibleChars(text = "") {
  return String(text || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeWhitespace(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExternalHref(href = "") {
  return /^https?:\/\//i.test(String(href || "").trim());
}

/* =========================
   Sanitização principal
========================= */

function sanitizeInformacaoHtml(html = "") {
  const safeInput = normalizeHtmlInput(html);

  return sanitizeHtml(safeInput, {
    allowedTags: [
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
      "a"
    ],

    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      blockquote: ["style"]
    },

    allowedStyles: {
      "*": {
        color: COLOR_PATTERNS,
        "background-color": COLOR_PATTERNS,
        "text-align": TEXT_ALIGN_PATTERNS
      }
    },

    allowedSchemes: ["http", "https", "mailto"],

    allowedSchemesByTag: {
      a: ["http", "https", "mailto"]
    },

    allowProtocolRelative: false,

    transformTags: {
      a: (tagName, attribs) => {
        const href = String(attribs?.href || "").trim();

        if (!href) {
          return {
            tagName: "span",
            text: ""
          };
        }

        const nextAttribs = {
          href,
          rel: "noopener noreferrer"
        };

        if (isExternalHref(href)) {
          nextAttribs.target = "_blank";
        }

        return {
          tagName,
          attribs: nextAttribs
        };
      }
    },

    parser: {
      lowerCaseTags: true
    }
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
    .replace(/<\/h[1-4]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  return normalizeWhitespace(stripDangerousInvisibleChars(withoutTags));
}

function buildResumoFromHtml(html = "", max = 220) {
  const text = stripHtmlToText(html);

  if (!text) return "";

  const safeMax = Number.isFinite(Number(max)) ? Math.max(1, Number(max)) : 220;

  if (text.length <= safeMax) {
    return text;
  }

  return `${text.slice(0, safeMax).trim()}…`;
}

module.exports = {
  sanitizeInformacaoHtml,
  stripHtmlToText,
  buildResumoFromHtml
};