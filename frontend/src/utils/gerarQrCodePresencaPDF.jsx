// ✅ src/utils/gerarQrCodePresencaPDF.js
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";
import { toast } from "react-toastify";

// React 18: createRoot para render "offscreen"
import { createRoot } from "react-dom/client";

/**
 * Gera o mesmo PDF de QR Code já usado no painel do instrutor.
 * @param {Object} turma - objeto da turma (precisa de id e opcionalmente horario/nome/evento)
 * @param {string} nomeEvento - título no PDF
 * @param {string} nomeInstrutor - nome a exibir no PDF
 */
export async function gerarQrCodePresencaPDF(turma, nomeEvento = "Evento", nomeInstrutor = "Instrutor") {
  try {
    if (!turma?.id) {
      toast.error("Turma não encontrada.");
      return;
    }

    const url = `https://escoladasaude.vercel.app/presenca/${turma.id}`;

    // Renderiza QR "fora da tela" e extrai como dataURL
    const container = document.createElement("div");
    const root = createRoot(container);
    root.render(<QRCodeCanvas value={url} size={300} />);
    await new Promise((r) => setTimeout(r, 300)); // dá tempo de montar

    const canvas = container.querySelector("canvas");
    const dataUrl = canvas?.toDataURL("image/png");
    root.unmount();

    if (!dataUrl) {
      toast.error("Erro ao gerar imagem do QR Code.");
      return;
    }

    // **Mesmo layout do instrutor**
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(nomeEvento, 148, 30, { align: "center" });

    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.text(`Instrutor: ${nomeInstrutor}`, 148, 40, { align: "center" });

    doc.addImage(dataUrl, "PNG", 98, 50, 100, 100);
    doc.setFontSize(12);
    doc.setTextColor(60);
    doc.text(
      "Escaneie este QR Code para confirmar sua presença",
      148,
      160,
      { align: "center" }
    );

    doc.save(`qr_presenca_turma_${turma.id}.pdf`);
    toast.success("🔳 QR Code gerado!");
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    toast.error("Erro ao gerar QR Code.");
  }
}
