// ✅ src/utils/gerarQrCodePresencaPDF.js (versão premium)
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { createRoot } from "react-dom/client";

/**
 * Gera um PDF com o QR Code de confirmação de presença.
 * - Renderiza o QR em offscreen com densidade adequada (retina friendly)
 * - Evita vazamento de nós no DOM (limpeza com try/finally)
 * - Base de URL dinâmica com validação e upgrade http→https (exceto localhost)
 * - Mantém parâmetros legados (nomeEvento, nomeInstrutor)
 * - Link da URL clicável no PDF (quando suportado)
 *
 * @param {Object} turma                         - { id, nome? }
 * @param {string} [nomeEvento="Evento"]
 * @param {string} [nomeInstrutor="Instrutor"]
 * @param {Object} [opcoes]
 * @param {string} [opcoes.baseUrl]              - força base customizada
 * @param {number} [opcoes.qrSize=320]          - pixels do canvas (antes de DPR)
 * @param {"L"|"M"|"Q"|"H"} [opcoes.errorCorrectionLevel="M"]
 * @param {boolean} [opcoes.includeMargin=true]
 * @param {"portrait"|"landscape"} [opcoes.orientacao="landscape"]
 * @param {string} [opcoes.nomeArquivo]
 * @param {number} [opcoes.qrLarguraPdf=120]     - largura do QR no PDF (mm)
 * @param {number} [opcoes.margemPdf=10]         - margem externa (mm)
 * @param {string} [opcoes.qrFgColor="#000000"]  - cor do QR
 * @param {string} [opcoes.qrBgColor="#ffffff"]  - fundo do QR
 */
export async function gerarQrCodePresencaPDF(
  turma,
  nomeEvento = "Evento",
  nomeInstrutor = "Instrutor",
  opcoes = {}
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
  } = opcoes || {};

  // ────────────────────────────────────────────────────────────
  // Guardas iniciais / ambiente
  // ────────────────────────────────────────────────────────────
  if (typeof window === "undefined" || typeof document === "undefined") {
    // SSR/Node
    console.error("[QR Presença] Ambiente sem DOM (SSR).");
    toast?.error?.("Não é possível gerar o PDF fora do navegador.");
    return;
  }

  try {
    if (!turma?.id) {
      toast.error("Turma não encontrada.");
      return;
    }
    const turmaId = String(turma.id).trim();
    if (!/^\d+$/.test(turmaId)) {
      toast.error("ID da turma inválido.");
      return;
    }

    // ────────────────────────────────────────────────────────────
    // Base dinâmica + saneamento
    // ────────────────────────────────────────────────────────────
    const origem =
      baseUrl ||
      (window.location && window.location.origin) ||
      "https://escoladasaude.vercel.app";

    let base;
    try {
      const u = new URL(origem);
      const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u.host);
      if (!isLocal && u.protocol === "http:") u.protocol = "https:"; // upgrade seguro
      base = u.toString().replace(/\/+$/, "");
    } catch {
      base = "https://escoladasaude.vercel.app";
    }

    // ✅ Querystring com turma evita problemas de leitores que re-encodam “/”
    const url = `${base}/presenca?turma=${encodeURIComponent(turmaId)}`;

    // ────────────────────────────────────────────────────────────
    // Renderização offscreen do QR (retina friendly)
    // ────────────────────────────────────────────────────────────
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const canvasSize = Math.floor(qrSize * dpr);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    container.style.background = "#fff";
    document.body.appendChild(container);

    let root = null;
    try {
      root = createRoot(container);
      root.render(
        <QRCodeCanvas
          value={url}
          size={canvasSize}
          includeMargin={includeMargin}
          level={errorCorrectionLevel}
          bgColor={qrBgColor}
          fgColor={qrFgColor}
        />
      );

      // aguarda renderização do frame
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0))
      );

      // coleta o canvas
      const canvas = container.querySelector("canvas");
      let dataUrl = canvas?.toDataURL?.("image/png");

      if (!dataUrl) {
        // fallback raro
        await new Promise((r) => setTimeout(r, 50));
        const c2 = container.querySelector("canvas");
        dataUrl = c2?.toDataURL?.("image/png");
      }

      if (!dataUrl) {
        toast.error("Erro ao gerar imagem do QR Code.");
        return;
      }

      // ────────────────────────────────────────────────────────────
      // Montagem do PDF (tipografia + layout responsivo)
      // ────────────────────────────────────────────────────────────
      const doc = new jsPDF({ orientation: orientacao });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const contentW = Math.max(0, pageW - 2 * margemPdf);
      let y = margemPdf;

      // Cabeçalho (evento)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      const titulo = String(nomeEvento || "Evento").trim() || "Evento";
      let tituloLines = doc.splitTextToSize(titulo, contentW);
      if (tituloLines.length > 2) {
        tituloLines = tituloLines.slice(0, 2);
        // adiciona reticências respeitando largura
        while (doc.getTextWidth(`${tituloLines[1]}…`) > contentW) {
          tituloLines[1] = tituloLines[1].slice(0, -1);
        }
        tituloLines[1] += "…";
      }
      tituloLines.forEach((line) => {
        doc.text(line, margemPdf + contentW / 2, y, { align: "center" });
        y += 8;
      });

      // Nome da turma
      const turmaNome = (turma?.nome || `Turma #${turmaId}`).toString();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(18);
      doc.text(turmaNome, margemPdf + contentW / 2, y, { align: "center" });
      y += 12;

      // Instrutor (opcional)
      if (nomeInstrutor && nomeInstrutor.trim()) {
        doc.setFontSize(11);
        doc.text(`Instrutor: ${nomeInstrutor}`, margemPdf + contentW / 2, y, {
          align: "center",
        });
        y += 10;
      }

      // Espaço disponível para QR
      const restoH = Math.max(0, pageH - margemPdf - y);
      let qrWmm = Math.min(qrLarguraPdf, restoH - 20); // 20mm para textos finais
      if (!Number.isFinite(qrWmm) || qrWmm < 60) qrWmm = 60; // piso mínimo
      if (qrWmm > contentW) qrWmm = contentW; // não ultrapassar largura útil

      const qrX = margemPdf + (contentW - qrWmm) / 2;
      const qrY = y;

      // QR
      doc.addImage(dataUrl, "PNG", qrX, qrY, qrWmm, qrWmm);

      // Mensagem
      doc.setFontSize(13);
      doc.setTextColor(60);
      const msg =
        "Faça login na Plataforma e escaneie este QR para confirmar presença";
      doc.text(msg, margemPdf + contentW / 2, qrY + qrWmm + 10, {
        align: "center",
      });

      // URL (exibe e, quando possível, torna clicável)
      const urlStr = url; // já saneado
      doc.setFontSize(9);
      doc.setTextColor(100);

      const urlY = qrY + qrWmm + 18;
      const urlXCenter = margemPdf + contentW / 2;

      // Linha de URL quebrada se muito longa
      const urlLines = doc.splitTextToSize(urlStr, contentW);
      doc.text(urlLines, urlXCenter, urlY, { align: "center" });

      // Link clicável (se disponível)
      if (typeof doc.textWithLink === "function" && urlLines.length === 1) {
        // tenta posicionar um link sobre o texto (melhor esforço)
        const textWidth = doc.getTextWidth(urlLines[0]);
        const linkX = urlXCenter - textWidth / 2;
        try {
          doc.textWithLink(urlLines[0], linkX, urlY, { url: urlStr });
        } catch {
          // ignora caso a build de jsPDF não suporte
        }
      }

      // Salvar PDF
      const nomePdf = (nomeArquivo || `qr_presenca_turma_${turmaId}.pdf`).trim();
      doc.save(nomePdf);

      toast.success("🔳 QR Code gerado!");
    } finally {
      // Limpeza SEMPRE (mesmo com erro)
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
  }
}
