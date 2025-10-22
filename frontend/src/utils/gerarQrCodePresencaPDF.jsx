// ✅ src/utils/gerarQrCodePresencaPDF.js
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { createRoot } from "react-dom/client";

/**
 * Gera um PDF com o QR Code de confirmação de presença.
 * - Renderiza o QR em offscreen com densidade adequada (retina friendly)
 * - Evita “vazamento” de nós no DOM (limpeza garantida em try/finally)
 * - Base de URL dinâmica (localhost, homolog, prod), com override opcional
 * - Parâmetros legados (nomeEvento, nomeInstrutor) preservados
 *
 * @param {Object} turma - objeto da turma (precisa de id; opcional: nome/horario)
 * @param {string} [nomeEvento="Evento"] - título a exibir no PDF
 * @param {string} [nomeInstrutor="Instrutor"] - nome do instrutor
 * @param {Object} [opcoes] - opções avançadas
 * @param {string} [opcoes.baseUrl] - força base customizada (senão usa window.location.origin)
 * @param {number} [opcoes.qrSize=300] - lado do QR no canvas (px, antes de DPR)
 * @param {"L"|"M"|"Q"|"H"} [opcoes.errorCorrectionLevel="M"] - nível ECC do QR
 * @param {boolean} [opcoes.includeMargin=true] - margem no QR
 * @param {"portrait"|"landscape"} [opcoes.orientacao="landscape"] - orientação do PDF
 * @param {string} [opcoes.nomeArquivo] - nome customizado do PDF
 * @param {number} [opcoes.qrLarguraPdf=110] - tamanho do QR no PDF (mm)
 */
export async function gerarQrCodePresencaPDF(
  turma,
  nomeEvento = "Evento",
  nomeInstrutor = "Instrutor",
  opcoes = {}
) {
  const {
    baseUrl,
    qrSize = 300,
    errorCorrectionLevel = "M",
    includeMargin = true,
    orientacao = "landscape",
    nomeArquivo,
    qrLarguraPdf = 110,
  } = opcoes || {};

  try {
    if (!turma?.id) {
      toast.error("Turma não encontrada.");
      return;
    }

    const turmaId = String(turma.id).trim();
    if (!/^\d+$/.test(turmaId)) {
      // evita surpresas de parâmetros malformados
      toast.error("ID da turma inválido.");
      return;
    }

    // Base dinâmica (funciona em dev/homolog/prod). Fallback: produção.
    const base =
      baseUrl ||
      (typeof window !== "undefined" && window.location?.origin) ||
      "https://escoladasaude.vercel.app";

    // ✅ querystring com turma evita problemas de leitores que re-encodam “/”
    const url = `${String(base).replace(/\/+$/, "")}/presenca?turma=${encodeURIComponent(
      turmaId
    )}`;

    // ────────────────────────────────────────────────────────────
    // Renderização offscreen do QR com qualidade retina
    // ────────────────────────────────────────────────────────────
    const dpr = Math.max(1, Math.min(3, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
    const canvasSize = Math.floor(qrSize * dpr);

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-99999px";
    container.style.top = "0";
    // garante contraste caso a lib considere background
    container.style.background = "#fff";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(
      <QRCodeCanvas
        value={url}
        size={canvasSize}
        includeMargin={includeMargin}
        level={errorCorrectionLevel}
        // bgColor e fgColor podem ser parametrizados; mantenho default preto/branco
      />
    );

    // Espera o frame de renderização e o canvas aparecer
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

    const canvas = container.querySelector("canvas");
    let dataUrl = canvas?.toDataURL?.("image/png");

    // Fallback muito raro: aguarda alguns ms se o canvas ainda não está pronto
    if (!dataUrl) {
      await new Promise((r) => setTimeout(r, 50));
      const canvas2 = container.querySelector("canvas");
      dataUrl = canvas2?.toDataURL?.("image/png");
    }

    if (!dataUrl) {
      toast.error("Erro ao gerar imagem do QR Code.");
      return;
    }

    // Limpeza garantida
    try {
      root.unmount();
    } catch (_) {}
    container.remove();

    // ────────────────────────────────────────────────────────────
    // Montagem do PDF
    // ────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: orientacao });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const centerX = pageW / 2;

    // Título do evento
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text(String(nomeEvento || "Evento"), centerX, 26, { align: "center" });

    // Instrutor
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Instrutor: ${nomeInstrutor || "—"}`, centerX, 36, { align: "center" });

    // QR centralizado
    const qrWmm = qrLarguraPdf; // largura/altura do QR no PDF (mm)
    const qrX = centerX - qrWmm / 2;
    const qrY = 48;
    doc.addImage(dataUrl, "PNG", qrX, qrY, qrWmm, qrWmm);

    // Mensagem
    doc.setFontSize(14);
    doc.setTextColor(60);
    doc.text(
      "Faça o Login na Plataforma e após, Escaneie este QR Code para confirmar sua presença",
      centerX,
      qrY + qrWmm + 14,
      { align: "center" }
    );

    // URL pequena (útil para digitar manualmente)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(url, centerX, qrY + qrWmm + 22, { align: "center" });

    const nomePdf = nomeArquivo || `qr_presenca_turma_${turmaId}.pdf`;
    doc.save(nomePdf);

    toast.success("🔳 QR Code gerado!");
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    toast.error("Erro ao gerar QR Code.");
  }
}
