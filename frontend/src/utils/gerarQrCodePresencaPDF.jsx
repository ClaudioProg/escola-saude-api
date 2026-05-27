// ✅ frontend/src/utils/gerarQrCodePresencaPDF.js — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Utilitário para gerar PDF com QR Code de confirmação de presença.
//
// Contratos aplicados:
// - QR oficial baseado em turma_id;
// - URL frontend oficial padrão: /presenca?turma_id=:turma_id;
// - Sem query antiga "turma";
// - Sem /api no QR;
// - Sem /presencas;
// - Sem path/payload livre;
// - Sem react-toastify direto;
// - AppToast oficial em src/components/ui/AppToast;
// - Env oficial: VITE_FRONTEND_URL;
// - Sem VITE_APP_URL;
// - Sem fallback hardcoded de domínio;
// - Sem render React oculto para gerar QR;
// - Sem manipulação de datas;
// - Sem risco de fuso horário.

import QRCode from "qrcode";
import jsPDF from "jspdf";

import {
  notifyError,
  notifySuccess,
} from "../components/ui/AppToast";

/* ─────────────────────────────────────────
   Constantes
───────────────────────────────────────── */

const QR_ERROR_LEVEL = new Set(["L", "M", "Q", "H"]);
const ORIENTACAO_PDF = new Set(["portrait", "landscape"]);

const PDF_MIN_QR_MM = 60;
const PDF_DEFAULT_QR_MM = 120;
const PDF_DEFAULT_MARGIN_MM = 10;

const PRESENCA_FRONTEND_PATH = "/presenca";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

function sanitizeFilename(name = "", fallback = "arquivo.pdf") {
  const clean = String(name || "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean || fallback;
}

function toPositiveInt(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function getTurmaId(turma) {
  return (
    toPositiveInt(turma?.turma_id) ||
    toPositiveInt(turma?.id) ||
    toPositiveInt(turma?.qr_payload?.turma_id)
  );
}

function normalizePositiveNumber(value, fallback, min = 1, max = 5000) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(number, min), max);
}

function normalizeColor(value, fallback) {
  const color = String(value || "").trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }

  return fallback;
}

function normalizeOrientacao(value) {
  const orientacao = String(value || "").trim().toLowerCase();

  return ORIENTACAO_PDF.has(orientacao) ? orientacao : "landscape";
}

function normalizeErrorCorrectionLevel(value) {
  const level = String(value || "").trim().toUpperCase();

  return QR_ERROR_LEVEL.has(level) ? level : "M";
}

function getFrontendBaseUrl(customBaseUrl) {
  const explicitBase =
    customBaseUrl || String(import.meta.env.VITE_FRONTEND_URL || "").trim();

  const origin =
    explicitBase ||
    (typeof window !== "undefined" ? window.location?.origin : "");

  if (!origin) {
    return "";
  }

  try {
    const url = new URL(origin);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";

    if (!isLocal && url.protocol === "http:") {
      url.protocol = "https:";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function buildPresencaUrl({ baseUrl, turma_id, frontendPath }) {
  const base = getFrontendBaseUrl(baseUrl);

  if (!base) {
    throw new Error("URL base do frontend não configurada.");
  }

  const path = String(frontendPath || PRESENCA_FRONTEND_PATH).trim();

  if (!path.startsWith("/")) {
    throw new Error("frontendPath deve começar com '/'.");
  }

  const url = new URL(path, `${base}/`);
  url.searchParams.set("turma_id", String(turma_id));

  return url.toString();
}

function truncateLines(doc, text, maxWidth, maxLines = 2) {
  let lines = doc.splitTextToSize(String(text || ""), maxWidth);

  if (lines.length <= maxLines) {
    return lines;
  }

  lines = lines.slice(0, maxLines);

  while (
    lines[maxLines - 1] &&
    doc.getTextWidth(`${lines[maxLines - 1]}…`) > maxWidth
  ) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
  }

  lines[maxLines - 1] = `${lines[maxLines - 1]}…`;

  return lines;
}

async function gerarQrDataUrl(url, options = {}) {
  const {
    qrSize = 320,
    errorCorrectionLevel = "M",
    includeMargin = true,
    qrFgColor = "#000000",
    qrBgColor = "#ffffff",
  } = options;

  const width = normalizePositiveNumber(qrSize, 320, 128, 2048);
  const level = normalizeErrorCorrectionLevel(errorCorrectionLevel);

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: level,
    margin: includeMargin ? 4 : 0,
    width,
    color: {
      dark: normalizeColor(qrFgColor, "#000000"),
      light: normalizeColor(qrBgColor, "#ffffff"),
    },
  });
}

function addCenteredText(doc, text, x, y, options = {}) {
  doc.text(String(text || ""), x, y, {
    align: "center",
    ...options,
  });
}

/* ─────────────────────────────────────────
   API pública
───────────────────────────────────────── */

/**
 * Gera um PDF com QR Code de confirmação de presença.
 *
 * @param {Object} turma
 * @param {number|string} [turma.id]
 * @param {number|string} [turma.turma_id]
 * @param {Object} [turma.qr_payload]
 * @param {number|string} [turma.qr_payload.turma_id]
 * @param {string} [turma.nome]
 * @param {string} [nomeEvento="Evento"]
 * @param {string} [nomeorganizador="organizador"]
 * @param {Object} [opcao]
 * @param {string} [opcao.baseUrl]
 * @param {string} [opcao.frontendPath="/presenca"]
 * @param {number} [opcao.qrSize=320]
 * @param {"L"|"M"|"Q"|"H"} [opcao.errorCorrectionLevel="M"]
 * @param {boolean} [opcao.includeMargin=true]
 * @param {"portrait"|"landscape"} [opcao.orientacao="landscape"]
 * @param {string} [opcao.nomeArquivo]
 * @param {number} [opcao.qrLarguraPdf=120]
 * @param {number} [opcao.margemPdf=10]
 * @param {string} [opcao.qrFgColor="#000000"]
 * @param {string} [opcao.qrBgColor="#ffffff"]
 * @returns {Promise<boolean>}
 */
export async function gerarQrCodePresencaPDF(
  turma,
  nomeEvento = "Evento",
  nomeorganizador = "organizador",
  opcao = {}
) {
  if (typeof window === "undefined") {
    notifyError("Não é possível gerar o PDF fora do navegador.");
    return false;
  }

  const turma_id = getTurmaId(turma);

  if (!turma_id) {
    notifyError("Turma não encontrada ou inválida.");
    return false;
  }

  try {
    const {
      baseUrl,
      frontendPath = PRESENCA_FRONTEND_PATH,
      qrSize = 320,
      errorCorrectionLevel = "M",
      includeMargin = true,
      orientacao = "landscape",
      nomeArquivo,
      qrLarguraPdf = PDF_DEFAULT_QR_MM,
      margemPdf = PDF_DEFAULT_MARGIN_MM,
      qrFgColor = "#000000",
      qrBgColor = "#ffffff",
    } = opcao || {};

    const url = buildPresencaUrl({
      baseUrl,
      turma_id,
      frontendPath,
    });

    const qrDataUrl = await gerarQrDataUrl(url, {
      qrSize,
      errorCorrectionLevel,
      includeMargin,
      qrFgColor,
      qrBgColor,
    });

    const doc = new jsPDF({
      orientation: normalizeOrientacao(orientacao),
    });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const margem = normalizePositiveNumber(
      margemPdf,
      PDF_DEFAULT_MARGIN_MM,
      5,
      40
    );

    const contentW = Math.max(0, pageW - 2 * margem);
    let y = margem;

    const titulo = String(nomeEvento || "Evento").trim() || "Evento";
    const turmaNome =
      String(turma?.nome || `Turma #${turma_id}`).trim() || `Turma #${turma_id}`;
    const organizador = String(nomeorganizador || "").trim();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(20, 20, 20);

    const tituloLines = truncateLines(doc, titulo, contentW, 2);

    for (const line of tituloLines) {
      addCenteredText(doc, line, margem + contentW / 2, y);
      y += 8;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(18);
    doc.setTextColor(35, 35, 35);
    addCenteredText(doc, turmaNome, margem + contentW / 2, y);
    y += 12;

    if (organizador) {
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      addCenteredText(doc, `organizador: ${organizador}`, margem + contentW / 2, y);
      y += 10;
    }

    const availableH = Math.max(0, pageH - margem - y);
    let qrWmm = normalizePositiveNumber(
      qrLarguraPdf,
      PDF_DEFAULT_QR_MM,
      PDF_MIN_QR_MM,
      180
    );

    qrWmm = Math.min(qrWmm, Math.max(PDF_MIN_QR_MM, availableH - 22), contentW);

    const qrX = margem + (contentW - qrWmm) / 2;
    const qrY = y;

    doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrWmm, qrWmm);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(50, 50, 50);
    addCenteredText(
      doc,
      "Faça login na Plataforma e escaneie este QR para confirmar presença",
      margem + contentW / 2,
      qrY + qrWmm + 10
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);

    const urlY = qrY + qrWmm + 18;
    const urlCenterX = margem + contentW / 2;
    const urlLines = doc.splitTextToSize(url, contentW);

    if (typeof doc.textWithLink === "function" && urlLines.length === 1) {
      const textWidth = doc.getTextWidth(urlLines[0]);
      const linkX = urlCenterX - textWidth / 2;

      doc.textWithLink(urlLines[0], linkX, urlY, {
        url,
      });
    } else {
      doc.text(urlLines, urlCenterX, urlY, {
        align: "center",
      });
    }

    const nomePdf = sanitizeFilename(
      nomeArquivo || `qr_presenca_turma_${turma_id}.pdf`,
      `qr_presenca_turma_${turma_id}.pdf`
    );

    doc.save(nomePdf);

    notifySuccess("QR Code gerado com sucesso.");

    return true;
  } catch (error) {
    console.error("[QR Presença] Erro ao gerar QR Code.", {
      message: error?.message || String(error),
      turma_id,
    });

    notifyError("Erro ao gerar QR Code.");

    return false;
  }
}