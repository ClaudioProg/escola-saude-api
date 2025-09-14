// 📁 src/components/QrSiteEscola.jsx
import { useMemo, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QrSiteEscola({
  size = 512,
  value = "https://escoladasaude.vercel.app/",
  level = "H",            // L, M, Q, H
  fgColor = "#000000",
  bgColor = "#FFFFFF",
  includeMargin = true,
  showLogo = false,
  logoUrl = "",           // ex.: "/logo-escola.png" (mesma origem é o ideal)
  logoPct = 0.16,         // 16% do lado (<= 0.18 p/ manter legibilidade)
  fileName = "qr-escola", // base do nome do arquivo ao baixar
  showButtons = true,     // exibir/ocultar botões de ação
  title = "QR Code do site da Escola da Saúde",
}) {
  const svgWrapRef = useRef(null);

  // Configura o logo embutido no PRÓPRIO SVG (e "escava" o fundo)
  const imageSettings = useMemo(() => {
    if (!showLogo || !logoUrl) return undefined;
    const side = Math.round(size * logoPct);
    return {
      src: logoUrl,
      height: side,
      width: side,
      excavate: true, // remove módulos atrás do logo (halo branco interno)
    };
  }, [showLogo, logoUrl, size, logoPct]);

  const baixarSVG = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;

    try {
      // Serializa o SVG (já contendo o <image> do logo, se configurado)
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback simples
      const a = document.createElement("a");
      a.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
      a.download = `${fileName}.svg`;
      a.click();
    }
  };

  const baixarPNG = async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;

    // Serializa o SVG (com o <image> do logo dentro do SVG)
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Cria uma imagem a partir do SVG serializado
    const img = new Image();
    // Ajuda quando o logo é mesma origem; se for cross-origin sem CORS, o canvas pode “taintar”
    img.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgUrl;
    });

    // Rasteriza no canvas
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor || "#FFFFFF";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    URL.revokeObjectURL(svgUrl);

    // Baixa PNG
    try {
      // toBlob tem melhor performance que dataURL e evita estouro de memória
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${fileName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      // fallback via dataURL
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${fileName}.png`;
      a.click();
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      // opcional: você pode integrar com seu sistema de toast aqui
      // toast.success("Link copiado!");
    } catch {
      // toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div
        ref={svgWrapRef}
        className="relative inline-block"
        style={{ width: size, height: size }}
        aria-label={title}
        role="img"
      >
        <QRCodeSVG
          value={String(value)}
          size={size}
          level={level}
          includeMargin={includeMargin}
          bgColor={bgColor}
          fgColor={fgColor}
          imageSettings={imageSettings} // 👈 logo embutido no SVG
          title={title}
        />
      </div>

      {showButtons && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button onClick={baixarSVG} className="px-3 py-1 rounded bg-green-700 text-white">
            Baixar SVG
          </button>
          <button onClick={baixarPNG} className="px-3 py-1 rounded bg-green-700 text-white">
            Baixar PNG
          </button>
          <button onClick={copiarLink} className="px-3 py-1 rounded bg-gray-200">
            Copiar link
          </button>
        </div>
      )}
    </div>
  );
}
