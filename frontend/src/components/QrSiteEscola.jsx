// 📁 src/components/QrSiteEscola.jsx
import { useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "react-toastify";

/**
 * Upgrades:
 * - ✅ aceita `url` (alias de `value`) para compatibilidade com HomeEscola
 * - ✅ botão "Copiar link" com dark-mode correto (premium)
 * - ✅ feedback toast ao copiar
 */
export default function QrSiteEscola({
  size = 512,

  // ✅ compat: HomeEscola passou `url`, então aceitamos ambos
  url, // <- NOVO
  value = "https://escoladasaude.vercel.app/",

  level = "H", // L, M, Q, H
  fgColor = "#000000",
  bgColor = "#FFFFFF",
  includeMargin = true,
  quietZone = 8,

  showLogo = false,
  logoUrl = "",
  logoPct = 0.16,
  logoRounded = true,

  fileName,
  showButtons = true,
  title = "QR Code do site da Escola da Saúde",
  description = "Aponte a câmera do celular para acessar o site.",
  pngScale = 2,
  enforceContrast = true,
  onDownload,
}) {
  const svgWrapRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  // ✅ fonte da verdade: se vier `url`, usa ele; senão usa `value`
  const finalValue = useMemo(() => String(url || value || ""), [url, value]);

  /* ---------- Helpers ---------- */

  const sanitizeName = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/(^\w+:|^)\/\//, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "qr-code";

  const defaultBaseName = useMemo(() => {
    try {
      const u = new URL(finalValue);
      return sanitizeName(u.host + (u.pathname !== "/" ? u.pathname : ""));
    } catch {
      return "qr-code";
    }
  }, [finalValue]);

  const baseName = fileName ? sanitizeName(fileName) : defaultBaseName;

  // contraste simples para evitar fg==bg
  const colorsOk = useMemo(() => {
    if (!enforceContrast) return true;
    const a = hexToRgb(fgColor);
    const b = hexToRgb(bgColor);
    if (!a || !b) return true;
    const L1 = luminance(a) + 0.05;
    const L2 = luminance(b) + 0.05;
    const ratio = L1 > L2 ? L1 / L2 : L2 / L1;
    return ratio >= 2.5;
  }, [fgColor, bgColor, enforceContrast]);

  const imageSettings = useMemo(() => {
    if (!showLogo || !logoUrl) return undefined;
    const side = Math.round(size * logoPct);
    return { src: logoUrl, height: side, width: side, excavate: true };
  }, [showLogo, logoUrl, size, logoPct]);

  /* ---------- Export: SVG ---------- */
  const baixarSVG = () => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const urlObj = URL.createObjectURL(blob);
      triggerDownload(urlObj, `${baseName}.svg`);
      URL.revokeObjectURL(urlObj);
      onDownload?.("svg");
    } catch {
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
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

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
            const urlObj = URL.createObjectURL(blob);
            triggerDownload(urlObj, `${baseName}.png`);
            URL.revokeObjectURL(urlObj);
            onDownload?.("png");
            resolve();
          },
          "image/png",
          0.92
        )
      );
    } catch {
      try {
        const dataUrl = await rasterizeFallback(svgWrapRef.current, size, bgColor);
        triggerDownload(dataUrl, `${baseName}.png`);
        onDownload?.("png");
      } catch {
        // silencioso
      }
    } finally {
      setExporting(false);
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(finalValue);
      toast.success("🔗 Link copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const descId = useMemo(() => `qr-desc-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div
        ref={svgWrapRef}
        className="relative inline-block rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        style={{ padding: quietZone, background: bgColor }}
        aria-label={title}
        aria-describedby={description ? descId : undefined}
        role="img"
      >
        <QRCodeSVG
          value={finalValue}                 // ✅ usa o link correto (site/instagram)
          size={size}
          level={level}
          includeMargin={includeMargin}
          bgColor={bgColor}
          fgColor={colorsOk ? fgColor : "#000000"}
          imageSettings={imageSettings}
          title={title}
        />

        {showLogo && logoRounded && (
          <style
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
            type="button"
            onClick={baixarSVG}
            className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition disabled:opacity-50"
            disabled={!colorsOk || exporting}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : "Baixar em SVG"}
          >
            Baixar SVG
          </button>

          <button
            type="button"
            onClick={baixarPNG}
            className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-extrabold hover:bg-emerald-800 transition disabled:opacity-50"
            disabled={!colorsOk || exporting}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : `Baixar PNG ${pngScale}x`}
          >
            {exporting ? "Gerando..." : "Baixar PNG"}
          </button>

          {/* ✅ Copiar link (premium + dark ok) */}
          <button
            type="button"
            onClick={copiarLink}
            className={[
              "px-3 py-1.5 rounded-xl text-xs font-extrabold transition",
              "border border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
              "dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-white/10",
            ].join(" ")}
            title="Copiar link"
          >
            Copiar link
          </button>
        </div>
      )}

      {!colorsOk && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
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
  const R = chan(r),
    G = chan(g),
    B = chan(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

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
