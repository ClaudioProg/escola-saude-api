// 📁 src/components/QrSiteEscola.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Upgrades:
 * - A11y: title/desc no SVG e aria-describedby
 * - PNG hi-dpi: pngScale (ex.: 3 => 3x o tamanho)
 * - Quiet zone (margem branca) controlável
 * - Logo com clipPath opcional
 * - Guard de contraste (enforceContrast)
 * - Nome de arquivo saneado; default pela origem do link
 */
export default function QrSiteEscola({
  size = 512,
  value = "https://escoladasaude.vercel.app/",
  level = "H",                  // L, M, Q, H
  fgColor = "#000000",
  bgColor = "#FFFFFF",
  includeMargin = true,         // mantém compat, mas veja quietZone
  quietZone = 8,                // px adicionais de margem (além do includeMargin do lib)
  showLogo = false,
  logoUrl = "",
  logoPct = 0.16,               // 16% do lado (≤ 18% recomendado)
  logoRounded = true,           // aplica clipPath redondo no logo
  fileName,                     // se vazio, cai no domínio do link
  showButtons = true,
  title = "QR Code do site da Escola da Saúde",
  description = "Aponte a câmera do celular para acessar o site.",
  pngScale = 2,                 // multiplica resolução do PNG exportado
  enforceContrast = true,       // tenta evitar fg≈bg (melhora legibilidade)
  onDownload,                   // (type: 'svg'|'png') => void
}) {
  const svgWrapRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  /* ---------- Helpers ---------- */

  const sanitizeName = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/(^\w+:|^)\/\//, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      || "qr-code";

  const defaultBaseName = useMemo(() => {
    try {
      const u = new URL(String(value));
      return sanitizeName(u.host + (u.pathname !== "/" ? u.pathname : ""));
    } catch {
      return "qr-code";
    }
  }, [value]);

  const baseName = fileName ? sanitizeName(fileName) : defaultBaseName;

  // Checagem simples de contraste (não é WCAG completa, mas evita fg==bg)
  const colorsOk = useMemo(() => {
    if (!enforceContrast) return true;
    const a = hexToRgb(fgColor);
    const b = hexToRgb(bgColor);
    if (!a || !b) return true;
    const L1 = luminance(a) + 0.05;
    const L2 = luminance(b) + 0.05;
    const ratio = L1 > L2 ? L1 / L2 : L2 / L1;
    // QR lê bem com ~≥ 3:1; aqui pedimos 2.5 pra ser permissivo
    return ratio >= 2.5;
  }, [fgColor, bgColor, enforceContrast]);

  /* ---------- Logo settings embutidos no SVG ---------- */
  const imageSettings = useMemo(() => {
    if (!showLogo || !logoUrl) return undefined;
    const side = Math.round(size * logoPct);
    return {
      src: logoUrl,
      height: side,
      width: side,
      excavate: true,
    };
  }, [showLogo, logoUrl, size, logoPct]);

  /* ---------- Export: SVG ---------- */
  const baixarSVG = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${baseName}.svg`);
      URL.revokeObjectURL(url);
      onDownload?.("svg");
    } catch {
      // fallback data URI
      const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
      triggerDownload(data, `${baseName}.svg`);
      onDownload?.("svg");
    }
  };

  /* ---------- Export: PNG hi-dpi ---------- */
  const baixarPNG = async () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    setExporting(true);
    try {
      // Serializa SVG atual
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // Desenha em canvas (atenção a CORS se logoUrl for cross-origin sem CORS)
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = svgUrl;
      });

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const scale = Math.max(1, Math.floor(pngScale)) * dpr;
      const out = size * scale;

      const canvas = document.createElement("canvas");
      // quiet zone adicional: aumenta tela e centraliza
      const pad = Math.max(0, Math.floor(quietZone * scale));
      canvas.width = out + pad * 2;
      canvas.height = out + pad * 2;

      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.fillStyle = bgColor || "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad, out, out);

      URL.revokeObjectURL(svgUrl);

      await new Promise((resolve) =>
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve();
            const url = URL.createObjectURL(blob);
            triggerDownload(url, `${baseName}.png`);
            URL.revokeObjectURL(url);
            onDownload?.("png");
            resolve();
          },
          "image/png",
          0.92
        )
      );
    } catch {
      // fallback básico
      try {
        const dataUrl = rasterizeFallback(svgWrapRef.current, size, bgColor);
        triggerDownload(dataUrl, `${baseName}.png`);
        onDownload?.("png");
      } catch {
        // silente
      }
    } finally {
      setExporting(false);
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      // ignore
    }
  };

  /* ---------- A11y ids ---------- */
  const descId = useMemo(
    () => `qr-desc-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  /* ---------- Render ---------- */
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div
        ref={svgWrapRef}
        className="relative inline-block"
        style={{
          // soma quietZone visual no container, além do includeMargin interno
          padding: quietZone,
          background: bgColor,
        }}
        aria-label={title}
        aria-describedby={description ? descId : undefined}
        role="img"
      >
        {/* Clip opcional e elementos de acessibilidade dentro do SVG */}
        <QRCodeSVG
          value={String(value)}
          size={size}
          level={level}
          includeMargin={includeMargin}
          bgColor={bgColor}
          fgColor={colorsOk ? fgColor : "#000000"} // guard simples
          imageSettings={imageSettings}
          title={title}
        />
        {/* Aplica clipPath redondo no logo quando possível */}
        {showLogo && logoRounded && (
          <style
            // Aplica clip no <image> gerado pelo QRCodeSVG (ele usa href dentro do SVG)
            // Seleciona o último <image> do SVG (o do logo)
            dangerouslySetInnerHTML={{
              __html: `
                svg image:last-of-type {
                  rx: ${Math.round((size * logoPct) / 6)}px;
                  ry: ${Math.round((size * logoPct) / 6)}px;
                  overflow: hidden;
                }
              `,
            }}
          />
        )}
      </div>

      {description && (
        <p id={descId} className="sr-only">
          {description}
        </p>
      )}

      {showButtons && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={baixarSVG}
            className="px-3 py-1 rounded bg-green-700 text-white disabled:opacity-50"
            disabled={!colorsOk || exporting}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : "Baixar em SVG"}
          >
            Baixar SVG
          </button>
          <button
            onClick={baixarPNG}
            className="px-3 py-1 rounded bg-green-700 text-white disabled:opacity-50"
            disabled={!colorsOk || exporting}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : `Baixar PNG ${pngScale}x`}
          >
            {exporting ? "Gerando..." : `Baixar PNG`}
          </button>
          <button onClick={copiarLink} className="px-3 py-1 rounded bg-gray-200">
            Copiar link
          </button>
        </div>
      )}
      {!colorsOk && (
        <p className="text-xs text-amber-700">
          Aviso: contraste fraco entre fg/bg pode prejudicar a leitura do QR.
        </p>
      )}
    </div>
  );
}

/* ---------- Utils locais ---------- */

function triggerDownload(href, name) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function hexToRgb(hex) {
  const s = String(hex || "").replace("#", "").trim();
  if (![3, 6].includes(s.length)) return null;
  const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const int = parseInt(n, 16);
  // eslint-disable-next-line no-bitwise
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function luminance({ r, g, b }) {
  const chan = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = chan(r), G = chan(g), B = chan(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Fallback ultra simples para PNG caso o SVG não carregue via Image/CORS.
 * Faz um snapshot do nó via SVG serializado + drawImage (quando possível).
 * Mantém o bg sólido para evitar “buracos”.
 */
function rasterizeFallback(container, size, bgColor) {
  const svg = container?.querySelector("svg");
  if (!svg) throw new Error("SVG não encontrado");
  const xml = new XMLSerializer().serializeToString(svg);
  const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = bgColor || "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = data;
  });
}
