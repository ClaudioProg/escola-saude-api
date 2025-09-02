// ✅ src/utils/gerarQrCodePresencaPDF.js
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { createRoot } from "react-dom/client";

/**
 * Gera um PDF com o QR Code de confirmação de presença.
 * @param {Object} turma - objeto da turma (precisa de id; opcional: nome/horario)
 * @param {string} nomeEvento - título a exibir no PDF
 * @param {string} nomeInstrutor - nome do instrutor
 */
export async function gerarQrCodePresencaPDF(
  turma,
  nomeEvento = "Evento",
  nomeInstrutor = "Instrutor"
) {
  try {
    if (!turma?.id) {
      toast.error("Turma não encontrada.");
      return;
    }

    const turmaId = String(turma.id);

    // Base dinâmica (funciona em dev/homolog/prod). Fallback: produção.
    const base =
      (typeof window !== "undefined" && window.location?.origin) ||
      "https://escoladasaude.vercel.app";

    // ✅ formato em query evita problemas de leitores que re-encodam “/”
    const url = `${base.replace(/\/+$/, "")}/presenca?turma=${encodeURIComponent(
      turmaId
    )}`;

    // Renderiza o QR fora da tela e extrai como dataURL
    const container = document.createElement("div");
    // opcional: manter no DOM garante que o canvas exista quando buscarmos
    container.style.position = "fixed";
    container.style.left = "-99999px";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(<QRCodeCanvas value={url} size={300} includeMargin />);

    // aguarda o próximo “tick” de render
    await new Promise((r) => setTimeout(r, 50));

    const canvas = container.querySelector("canvas");
    const dataUrl = canvas?.toDataURL?.("image/png");

    // limpeza do DOM/React
    root.unmount();
    container.remove();

    if (!dataUrl) {
      toast.error("Erro ao gerar imagem do QR Code.");
      return;
    }

    // === PDF ===
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const centerX = pageW / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(nomeEvento || "Evento"), centerX, 26, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(`Instrutor: ${nomeInstrutor || "—"}`, centerX, 36, {
      align: "center",
    });

    // QR centralizado
    const qrW = 110; // largura/altura do QR no PDF
    const qrX = centerX - qrW / 2;
    const qrY = 48;
    doc.addImage(dataUrl, "PNG", qrX, qrY, qrW, qrW);

    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(
      "Escaneie este QR Code para confirmar sua presença",
      centerX,
      qrY + qrW + 14,
      { align: "center" }
    );

    // URL pequena (opcional, útil para digitar manualmente)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(url, centerX, qrY + qrW + 22, { align: "center" });

    doc.save(`qr_presenca_turma_${turmaId}.pdf`);
    toast.success("🔳 QR Code gerado!");
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    toast.error("Erro ao gerar QR Code.");
  }
}
