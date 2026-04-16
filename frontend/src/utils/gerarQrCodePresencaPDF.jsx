// ✅ src/utils/gerarQrCodePresencaPDF.jsx — PREMIUM++
import React from "react";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { createRoot } from "react-dom/client";

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */
function sanitizeFilename(name = "", fallback = "arquivo.pdf") {
  const clean = String(name || "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ");

  return clean || fallback;
}

function isNumericId(v) {
  return /^\d+$/.test(String(v || "").trim());
}

function getBaseUrl(customBaseUrl) {
  const envBase =
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.VITE_FRONTEND_URL || import.meta.env?.VITE_APP_URL)) ||
    "";

  const origem =
    customBaseUrl ||
    envBase ||
    (typeof window !== "undefined" && window.location?.origin) ||
    "https://escoladasaude.vercel.app";

  try {
    const u = new URL(origem);
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u.host);
    if (!isLocal && u.protocol === "http:") u.protocol = "https:";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return "https://escoladasaude.vercel.app";
  }
}

async function waitForCanvas(container, tries = 12, delay = 25) {
  for (let i = 0; i < tries; i++) {
    const canvas = container.querySelector("canvas");
    if (canvas?.toDataURL) return canvas;
    await new Promise((r) => setTimeout(r, delay));
  }
  return null;
}

function truncateLines(doc, text, maxWidth, maxLines = 2) {
  let lines = doc.splitTextToSize(String(text || ""), maxWidth);

  if (lines.length <= maxLines) return lines;

  lines = lines.slice(0, maxLines);

  while (lines[maxLines - 1] && doc.getTextWidth(`${lines[maxLines - 1]}…`) > maxWidth) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
  }

  lines[maxLines - 1] += "…";
  return lines;
}

/* ──────────────────────────────────────────────────────────────
   API pública
   ────────────────────────────────────────────────────────────── */
/**
 * Gera um PDF com o QR Code de confirmação de presença.
 *
 * @param {Object} turma                         - { id, nome? }
 * @param {string} [nomeEvento="Evento"]
 * @param {string} [nomeInstrutor="Instrutor"]
 * @param {Object} [opcao]
 * @param {string} [opcao.baseUrl]
 * @param {number} [opcao.qrSize=320]
 * @param {"L"|"M"|"Q"|"H"} [opcao.errorCorrectionLevel="M"]
 * @param {boolean} [opcao.includeMargin=true]
 * @param {"portrait"|"landscape"} [opcao.orientacao="landscape"]
 * @param {string} [opcao.nomeArquivo]
 * @param {number} [opcao.qrLarguraPdf=120]
 * @param {number} [opcao.margemPdf=10]
 * @param {string} [opcao.qrFgColor="#000000"]
 * @param {string} [opcao.qrBgColor="#ffffff"]
 */
export async function gerarQrCodePresencaPDF(
  turma,
  nomeEvento = "Evento",
  nomeInstrutor = "Instrutor",
  opcao = {}
) {
  const {
    baseUrl,
    qrSize = 320,
    errorCorrectionLevel = "M",
    includeMargin = true,
    orientacao = "landscape",
    nomeArquivo,
    qrLarguraPdf = 120,
    margemPdf = 10,
    qrFgColor = "#000000",
    qrBgColor = "#ffffff",
  } = opcao || {};

  if (typeof window === "undefined" || typeof document === "undefined") {
    console.error("[QR Presença] Ambiente sem DOM.");
    toast?.error?.("Não é possível gerar o PDF fora do navegador.");
    return false;
  }

  try {
    if (!turma?.id || !isNumericId(turma.id)) {
      toast.error("Turma não encontrada ou inválida.");
      return false;
    }

    const turmaId = String(turma.id).trim();
    const base = getBaseUrl(baseUrl);
    const url = `${base}/presenca?turma=${encodeURIComponent(turmaId)}`;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const canvasSize = Math.floor(qrSize * dpr);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    container.style.width = `${canvasSize}px`;
    container.style.height = `${canvasSize}px`;
    container.style.background = "#fff";
    container.style.pointerEvents = "none";
    container.setAttribute("aria-hidden", "true");
    document.body.appendChild(container);

    let root = null;

    try {
      root = createRoot(container);
      root.render(
        React.createElement(QRCodeCanvas, {
          value: url,
          size: canvasSize,
          includeMargin,
          level: errorCorrectionLevel,
          bgColor: qrBgColor,
          fgColor: qrFgColor,
        })
      );

      const canvas = await waitForCanvas(container);
      const dataUrl = canvas?.toDataURL?.("image/png");

      if (!dataUrl) {
        toast.error("Erro ao gerar imagem do QR Code.");
        return false;
      }

      const doc = new jsPDF({ orientation: orientacao });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const contentW = Math.max(0, pageW - 2 * margemPdf);
      let y = margemPdf;

      const titulo = String(nomeEvento || "Evento").trim() || "Evento";
      const turmaNome = String(turma?.nome || `Turma #${turmaId}`).trim();
      const instrutor = String(nomeInstrutor || "").trim();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);

      const tituloLines = truncateLines(doc, titulo, contentW, 2);
      tituloLines.forEach((line) => {
        doc.text(line, margemPdf + contentW / 2, y, { align: "center" });
        y += 8;
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(18);
      doc.text(turmaNome, margemPdf + contentW / 2, y, { align: "center" });
      y += 12;

      if (instrutor) {
        doc.setFontSize(11);
        doc.text(`Instrutor: ${instrutor}`, margemPdf + contentW / 2, y, {
          align: "center",
        });
        y += 10;
      }

      const restoH = Math.max(0, pageH - margemPdf - y);
      let qrWmm = Math.min(qrLarguraPdf, restoH - 20);
      if (!Number.isFinite(qrWmm) || qrWmm < 60) qrWmm = 60;
      if (qrWmm > contentW) qrWmm = contentW;

      const qrX = margemPdf + (contentW - qrWmm) / 2;
      const qrY = y;

      doc.addImage(dataUrl, "PNG", qrX, qrY, qrWmm, qrWmm);

      doc.setFontSize(13);
      doc.setTextColor(60);
      doc.text(
        "Faça login na Plataforma e escaneie este QR para confirmar presença",
        margemPdf + contentW / 2,
        qrY + qrWmm + 10,
        { align: "center" }
      );

      doc.setFontSize(9);
      doc.setTextColor(100);

      const urlY = qrY + qrWmm + 18;
      const urlXCenter = margemPdf + contentW / 2;
      const urlLines = doc.splitTextToSize(url, contentW);

      if (typeof doc.textWithLink === "function" && urlLines.length === 1) {
        const textWidth = doc.getTextWidth(urlLines[0]);
        const linkX = urlXCenter - textWidth / 2;
        doc.textWithLink(urlLines[0], linkX, urlY, { url });
      } else {
        doc.text(urlLines, urlXCenter, urlY, { align: "center" });
      }

      const nomePdf = sanitizeFilename(
        nomeArquivo || `qr_presenca_turma_${turmaId}.pdf`,
        `qr_presenca_turma_${turmaId}.pdf`
      );

      doc.save(nomePdf);
      toast.success("🔳 QR Code gerado!");
      return true;
    } finally {
      try {
        root?.unmount?.();
      } catch {}
      try {
        container?.remove?.();
      } catch {}
    }
  } catch (err) {
    console.error("[QR Presença] Erro ao gerar QR Code:", err);
    toast.error("Erro ao gerar QR Code.");
    return false;
  }
}