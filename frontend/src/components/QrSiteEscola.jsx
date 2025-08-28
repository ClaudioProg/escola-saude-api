// 📁 src/components/QrSiteEscola.jsx
import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QrSiteEscola({
  size = 512,
  value = "https://escoladasaude.vercel.app/",
  showLogo = false,
  logoUrl = "",          // ex.: "/logo-escola.png"
  logoPct = 0.16,        // 16% do lado (<= 0.18 p/ manter legibilidade)
}) {
  const svgWrapRef = useRef(null);

  const baixarSVG = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-escola.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarPNG = async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);

    // desenha em canvas para rasterizar
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; // fundo branco
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = "qr-escola.png";
    a.click();
  };

  // container relativo para opcional logo sobreposto (não apaga módulos do QR)
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div
        ref={svgWrapRef}
        className="relative inline-block"
        style={{ width: size, height: size }}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level="H"         // alta correção de erro
          includeMargin     // quiet zone
          bgColor="#FFFFFF"
          fgColor="#000000"
        />

        {showLogo && logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
            style={{
              width: size * logoPct,
              height: size * logoPct,
              objectFit: "contain",
              borderRadius: 6,
              background: "white", // halo branco mínimo ajuda na leitura
              padding: Math.max(2, Math.round(size * 0.01)),
            }}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={baixarSVG} className="px-3 py-1 rounded bg-green-700 text-white">
          Baixar SVG
        </button>
        <button onClick={baixarPNG} className="px-3 py-1 rounded bg-green-700 text-white">
          Baixar PNG
        </button>
      </div>
    </div>
  );
}
