// 📁 src/components/QrSiteEscola.jsx
import { useId, useMemo, useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "react-toastify";
import { Download, Copy, QrCode } from "lucide-react";

/**
 * QrSiteEscola (Premium)
 * - ✅ aceita `url` (alias de `value`) para compatibilidade
 * - ✅ botão "Copiar link" + fallback (clipboard / execCommand)
 * - ✅ export SVG/PNG hi-dpi com cleanup robusto
 * - ✅ contraste mínimo (opcional) + aviso elegante
 * - ✅ A11y: aria-describedby + live region
 */
export default function QrSiteEscola({
  size = 512,

  // compat: aceita `url` ou `value`
  url,
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
  const wrapRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [a11yMsg, setA11yMsg] = useState("");

  const descId = useId();
  const liveId = useId();

  // fonte da verdade: se vier `url`, usa ele; senão `value`
  const finalValue = useMemo(() => String(url || value || "").trim(), [url, value]);

  /* ───────────── helpers ───────────── */

  const baseName = useMemo(() => {
    const sanitizeName = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/(^\w+:|^)\/\//, "")
        .replace(/[^\w.-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "qr-code";

    if (fileName) return sanitizeName(fileName);

    try {
      const u = new URL(finalValue);
      const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
      return sanitizeName(u.host + path);
    } catch {
      return "qr-code";
    }
  }, [finalValue, fileName]);

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

  const getSvgEl = () => wrapRef.current?.querySelector("svg") || null;

  /* ───────────── export: SVG ───────────── */

  const baixarSVG = useCallback(() => {
    const svg = getSvgEl();
    if (!svg) return;

    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const urlObj = URL.createObjectURL(blob);
      triggerDownload(urlObj, `${baseName}.svg`);
      URL.revokeObjectURL(urlObj);
      onDownload?.("svg");
      toast.success("⬇️ SVG baixado!");
      setA11yMsg("SVG baixado com sucesso.");
    } catch {
      const data = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
      triggerDownload(data, `${baseName}.svg`);
      onDownload?.("svg");
      toast.success("⬇️ SVG baixado!");
      setA11yMsg("SVG baixado com sucesso.");
    }
  }, [baseName, onDownload]);

  /* ───────────── export: PNG hi-dpi ───────────── */

  const baixarPNG = useCallback(async () => {
    const svg = getSvgEl();
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

      const out = Math.round(size * scale);
      const pad = Math.max(0, Math.floor(quietZone * scale));

      const canvas = document.createElement("canvas");
      canvas.width = out + pad * 2;
      canvas.height = out + pad * 2;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.fillStyle = bgColor || "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad, out, out);

      // cleanup após desenhar
      URL.revokeObjectURL(svgUrl);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.92));
      if (blob) {
        const urlObj = URL.createObjectURL(blob);
        triggerDownload(urlObj, `${baseName}.png`);
        URL.revokeObjectURL(urlObj);
        onDownload?.("png");
        toast.success("⬇️ PNG baixado!");
        setA11yMsg("PNG baixado com sucesso.");
      } else {
        // fallback dataURL
        const dataUrl = canvas.toDataURL("image/png");
        triggerDownload(dataUrl, `${baseName}.png`);
        onDownload?.("png");
        toast.success("⬇️ PNG baixado!");
        setA11yMsg("PNG baixado com sucesso.");
      }
    } catch {
      try {
        const dataUrl = await rasterizeFallback(wrapRef.current, size, bgColor);
        triggerDownload(dataUrl, `${baseName}.png`);
        onDownload?.("png");
        toast.success("⬇️ PNG baixado!");
        setA11yMsg("PNG baixado com sucesso.");
      } catch {
        toast.error("Não foi possível gerar o PNG.");
        setA11yMsg("Falha ao gerar o PNG.");
      }
    } finally {
      setExporting(false);
    }
  }, [baseName, bgColor, pngScale, quietZone, size, onDownload]);

  /* ───────────── copiar link ───────────── */

  const copiarLink = useCallback(async () => {
    const txt = finalValue;
    if (!txt) {
      toast.error("Link vazio.");
      setA11yMsg("Link vazio.");
      return;
    }

    // Clipboard API
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(txt);
        toast.success("🔗 Link copiado!");
        setA11yMsg("Link copiado para a área de transferência.");
        return;
      }
    } catch {
      // segue pro fallback
    }

    // Fallback: textarea + execCommand
    try {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();

      if (ok) {
        toast.success("🔗 Link copiado!");
        setA11yMsg("Link copiado para a área de transferência.");
      } else {
        throw new Error("copy_failed");
      }
    } catch {
      toast.error("Não foi possível copiar o link.");
      setA11yMsg("Falha ao copiar o link.");
    }
  }, [finalValue]);

  /* ───────────── render ───────────── */

  return (
    <div className="inline-flex flex-col items-center gap-3">
      {/* live region discreta */}
      <span id={liveId} className="sr-only" aria-live="polite" aria-atomic="true">
        {a11yMsg}
      </span>

      <div
        ref={wrapRef}
        className={classNames(
          "relative inline-block",
          "rounded-3xl",
          "shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)]",
          "ring-1 ring-black/5 dark:ring-white/10",
          exporting ? "opacity-90" : ""
        )}
        style={{ padding: quietZone, background: bgColor }}
        aria-label={title}
        aria-describedby={description ? descId : undefined}
        role="img"
      >
        <QRCodeSVG
          value={finalValue}
          size={size}
          level={level}
          includeMargin={includeMargin}
          bgColor={bgColor}
          fgColor={colorsOk ? fgColor : "#000000"}
          imageSettings={imageSettings}
          title={title}
        />

        {/* Logo rounded: aplica no último image (quando existir) */}
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

        {/* etiqueta “QR” discreta (premium) */}
        <div className="absolute -top-2 -left-2">
          <span className="inline-flex items-center gap-1 rounded-2xl bg-black/60 text-white text-[11px] font-extrabold px-2 py-1 ring-1 ring-white/15">
            <QrCode className="w-3.5 h-3.5" aria-hidden="true" />
            QR
          </span>
        </div>
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
            disabled={!colorsOk || exporting}
            className={classNames(
              "inline-flex items-center gap-2",
              "px-3 py-2 rounded-2xl text-xs font-extrabold",
              "bg-emerald-600 hover:bg-emerald-700 text-white",
              "ring-1 ring-emerald-800/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : "Baixar em SVG"}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Baixar SVG
          </button>

          <button
            type="button"
            onClick={baixarPNG}
            disabled={!colorsOk || exporting}
            className={classNames(
              "inline-flex items-center gap-2",
              "px-3 py-2 rounded-2xl text-xs font-extrabold",
              "bg-emerald-600 hover:bg-emerald-700 text-white",
              "ring-1 ring-emerald-800/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title={!colorsOk ? "Ajuste as cores para melhor contraste" : `Baixar PNG ${pngScale}x`}
          >
            <Download className={classNames("w-4 h-4", exporting ? "animate-bounce" : "")} aria-hidden="true" />
            {exporting ? "Gerando…" : "Baixar PNG"}
          </button>

          <button
            type="button"
            onClick={copiarLink}
            className={classNames(
              "inline-flex items-center gap-2",
              "px-3 py-2 rounded-2xl text-xs font-extrabold transition",
              "border border-slate-200 bg-white text-slate-800 hover:bg-slate-100",
              "dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-100 dark:hover:bg-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            )}
            title="Copiar link"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            Copiar link
          </button>
        </div>
      )}

      {!colorsOk && (
        <p className="text-xs text-amber-700 dark:text-amber-300 max-w-[42ch] text-center">
          Aviso: contraste fraco entre fg/bg pode prejudicar a leitura do QR.
        </p>
      )}
    </div>
  );
}

/* ───────────────── Utils locais ───────────────── */

function classNames(...arr) {
  return arr.filter(Boolean).join(" ");
}

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
  if (!ctx) throw new Error("Canvas indisponível");

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
