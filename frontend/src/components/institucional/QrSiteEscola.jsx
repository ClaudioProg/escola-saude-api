// ✅ src/components/institucional/QrSiteEscola.jsx — v2.0
// Plataforma Escola da Saúde
//
// QR Code institucional do site da Escola da Saúde.
//
// Revisão premium:
// - componente institucional, não genérico de UI;
// - contrato oficial único: siteUrl;
// - sem aliases url/value;
// - exportação SVG e PNG;
// - cópia de link;
// - mensagens claras via AppToast oficial;
// - validação de contraste;
// - acessibilidade com role img, aria-describedby e live region;
// - mobile-first;
// - dark mode;
// - visual premium consistente;
// - PropTypes completo.

import { useCallback, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, QrCode } from "lucide-react";

import {
  notifyError,
  notifySuccess,
  notifyWarn,
} from "../ui/AppToast";

const SITE_ESCOLA_SAUDE_URL = "https://escoladasaude.vercel.app/";

const QR_LEVELS = ["L", "M", "Q", "H"];

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function sanitizeFileName(value) {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/(^\w+:|^)\/\//, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "qr-code-escola-saude"
  );
}

function normalizeUrl(value) {
  const text = String(value || "").trim();

  if (!text) {
    return SITE_ESCOLA_SAUDE_URL;
  }

  try {
    const parsed = new URL(text);
    return parsed.toString();
  } catch {
    return text;
  }
}

function buildBaseName(siteUrl, fileName) {
  if (fileName) {
    return sanitizeFileName(fileName);
  }

  try {
    const parsed = new URL(siteUrl);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return sanitizeFileName(`${parsed.host}${path}`);
  } catch {
    return "qr-code-escola-saude";
  }
}

function triggerDownload(href, name) {
  const anchor = document.createElement("a");

  anchor.href = href;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);

  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

function hexToRgb(hex) {
  const clean = String(hex || "").replace("#", "").trim();

  if (![3, 6].includes(clean.length)) {
    return null;
  }

  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;

  const int = Number.parseInt(normalized, 16);

  if (!Number.isFinite(int)) {
    return null;
  }

  return {
    // eslint-disable-next-line no-bitwise
    r: (int >> 16) & 255,
    // eslint-disable-next-line no-bitwise
    g: (int >> 8) & 255,
    // eslint-disable-next-line no-bitwise
    b: int & 255,
  };
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const normalized = value / 255;

    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function hasReadableQrContrast(fgColor, bgColor) {
  const foreground = hexToRgb(fgColor);
  const background = hexToRgb(bgColor);

  if (!foreground || !background) {
    return true;
  }

  const l1 = luminance(foreground) + 0.05;
  const l2 = luminance(background) + 0.05;
  const ratio = l1 > l2 ? l1 / l2 : l2 / l1;

  return ratio >= 2.5;
}

function getSvgElement(container) {
  return container?.querySelector("svg") || null;
}

async function svgToPngBlob({
  svg,
  size,
  quietZone,
  pngScale,
  bgColor,
}) {
  const xml = new XMLSerializer().serializeToString(svg);

  const svgBlob = new Blob([xml], {
    type: "image/svg+xml;charset=utf-8",
  });

  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.crossOrigin = "anonymous";

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = svgUrl;
    });

    const devicePixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const scale = Math.max(1, Math.floor(Number(pngScale) || 2)) * devicePixelRatio;
    const outputSize = Math.round(size * scale);
    const padding = Math.max(0, Math.floor(Number(quietZone || 0) * scale));

    const canvas = document.createElement("canvas");

    canvas.width = outputSize + padding * 2;
    canvas.height = outputSize + padding * 2;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas indisponível.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = bgColor || "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, padding, padding, outputSize, outputSize);

    return await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png", 0.92);
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function QrSiteEscola({
  siteUrl = SITE_ESCOLA_SAUDE_URL,
  size = 512,
  level = "H",
  fgColor = "#000000",
  bgColor = "#FFFFFF",
  includeMargin = true,
  quietZone = 8,
  showLogo = false,
  logoUrl = "",
  logoPct = 0.16,
  fileName,
  showButtons = true,
  title = "QR Code do site da Escola da Saúde",
  description = "Aponte a câmera do celular para acessar o site.",
  pngScale = 2,
  enforceContrast = true,
  onDownload,
  className = "",
}) {
  const descriptionId = useId();
  const liveId = useId();

  const wrapperRef = useRef(null);

  const [exporting, setExporting] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  const finalUrl = useMemo(() => normalizeUrl(siteUrl), [siteUrl]);

  const baseName = useMemo(
    () => buildBaseName(finalUrl, fileName),
    [fileName, finalUrl]
  );

  const validLevel = QR_LEVELS.includes(level) ? level : "H";

  const contrastOk = useMemo(() => {
    if (!enforceContrast) {
      return true;
    }

    return hasReadableQrContrast(fgColor, bgColor);
  }, [bgColor, enforceContrast, fgColor]);

  const safeSize = useMemo(() => {
    const parsed = Number(size);
    return Number.isFinite(parsed) ? Math.min(1024, Math.max(128, parsed)) : 512;
  }, [size]);

  const imageSettings = useMemo(() => {
    if (!showLogo || !logoUrl) {
      return undefined;
    }

    const logoSide = Math.round(safeSize * Number(logoPct || 0.16));

    return {
      src: logoUrl,
      height: logoSide,
      width: logoSide,
      excavate: true,
    };
  }, [logoPct, logoUrl, safeSize, showLogo]);

  const announce = useCallback((message) => {
    setLiveMessage(message);
  }, []);

  const downloadSvg = useCallback(() => {
    const svg = getSvgElement(wrapperRef.current);

    if (!svg) {
      notifyError("Não foi possível localizar o QR Code para exportar em SVG.");
      announce("Falha ao localizar o QR Code.");
      return;
    }

    try {
      const xml = new XMLSerializer().serializeToString(svg);

      downloadBlob(
        `${baseName}.svg`,
        new Blob([xml], {
          type: "image/svg+xml;charset=utf-8",
        })
      );

      onDownload?.("svg");
      notifySuccess("QR Code exportado em SVG com sucesso.");
      announce("SVG baixado com sucesso.");
    } catch {
      notifyError(
        "Não foi possível gerar o arquivo SVG. Tente novamente e, se o problema persistir, acione o suporte."
      );
      announce("Falha ao gerar o SVG.");
    }
  }, [announce, baseName, onDownload]);

  const downloadPng = useCallback(async () => {
    const svg = getSvgElement(wrapperRef.current);

    if (!svg) {
      notifyError("Não foi possível localizar o QR Code para exportar em PNG.");
      announce("Falha ao localizar o QR Code.");
      return;
    }

    setExporting(true);

    try {
      const pngBlob = await svgToPngBlob({
        svg,
        size: safeSize,
        quietZone,
        pngScale,
        bgColor,
      });

      if (!pngBlob) {
        throw new Error("PNG não gerado.");
      }

      downloadBlob(`${baseName}.png`, pngBlob);

      onDownload?.("png");
      notifySuccess("QR Code exportado em PNG com sucesso.");
      announce("PNG baixado com sucesso.");
    } catch {
      notifyError(
        "Não foi possível gerar o PNG. Verifique o QR Code e tente novamente."
      );
      announce("Falha ao gerar o PNG.");
    } finally {
      setExporting(false);
    }
  }, [announce, baseName, bgColor, onDownload, pngScale, quietZone, safeSize]);

  const copyLink = useCallback(async () => {
    if (!finalUrl) {
      notifyError("Não há link disponível para copiar.");
      announce("Link vazio.");
      return;
    }

    try {
      await navigator.clipboard.writeText(finalUrl);

      notifySuccess("Link copiado para a área de transferência.");
      announce("Link copiado para a área de transferência.");
    } catch {
      notifyError(
        "Não foi possível copiar o link automaticamente. Copie o endereço manualmente e tente novamente."
      );
      announce("Falha ao copiar o link.");
    }
  }, [announce, finalUrl]);

  const actionDisabled = exporting || !contrastOk;

  return (
    <section
      className={classNames(
        "inline-flex max-w-full flex-col items-center gap-3",
        className
      )}
      aria-labelledby={`${descriptionId}-title`}
    >
      <span
        id={liveId}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </span>

      <div className="text-center">
        <h3
          id={`${descriptionId}-title`}
          className="text-sm font-black text-slate-900 dark:text-slate-100"
        >
          {title}
        </h3>

        {description && (
          <p
            id={descriptionId}
            className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400"
          >
            {description}
          </p>
        )}
      </div>

      <div
        ref={wrapperRef}
        className={classNames(
          "relative inline-block rounded-3xl shadow-[0_18px_55px_-40px_rgba(0,0,0,0.55)] ring-1 ring-black/5 dark:ring-white/10",
          exporting && "opacity-80"
        )}
        style={{
          padding: quietZone,
          background: bgColor,
        }}
        role="img"
        aria-label={`${title}. Link: ${finalUrl}`}
        aria-describedby={description ? descriptionId : undefined}
      >
        <QRCodeSVG
          value={finalUrl}
          size={safeSize}
          level={validLevel}
          includeMargin={includeMargin}
          bgColor={bgColor}
          fgColor={contrastOk ? fgColor : "#000000"}
          imageSettings={imageSettings}
          title={title}
        />

        <div className="absolute -left-2 -top-2">
          <span className="inline-flex items-center gap-1 rounded-2xl bg-black/70 px-2 py-1 text-[11px] font-black text-white ring-1 ring-white/15">
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
            QR
          </span>
        </div>
      </div>

      {showButtons && (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={downloadSvg}
            disabled={actionDisabled}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-black text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={!contrastOk ? "Ajuste as cores para melhorar a leitura do QR Code." : "Baixar QR Code em SVG"}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Baixar SVG
          </button>

          <button
            type="button"
            onClick={downloadPng}
            disabled={actionDisabled}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-black text-white ring-1 ring-emerald-900/30 transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={!contrastOk ? "Ajuste as cores para melhorar a leitura do QR Code." : `Baixar QR Code em PNG ${pngScale}x`}
            aria-busy={exporting || undefined}
          >
            <Download
              className={classNames("h-4 w-4", exporting && "animate-bounce")}
              aria-hidden="true"
            />
            {exporting ? "Gerando..." : "Baixar PNG"}
          </button>

          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10"
            title="Copiar link do site"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar link
          </button>
        </div>
      )}

      {!contrastOk && (
        <p
          className="max-w-[42ch] text-center text-xs font-semibold text-amber-700 dark:text-amber-300"
          role="alert"
        >
          O contraste entre as cores do QR Code está baixo e pode prejudicar a leitura.
          Ajuste as cores antes de exportar.
        </p>
      )}
    </section>
  );
}

QrSiteEscola.propTypes = {
  siteUrl: PropTypes.string,
  size: PropTypes.number,
  level: PropTypes.oneOf(["L", "M", "Q", "H"]),
  fgColor: PropTypes.string,
  bgColor: PropTypes.string,
  includeMargin: PropTypes.bool,
  quietZone: PropTypes.number,
  showLogo: PropTypes.bool,
  logoUrl: PropTypes.string,
  logoPct: PropTypes.number,
  fileName: PropTypes.string,
  showButtons: PropTypes.bool,
  title: PropTypes.string,
  description: PropTypes.string,
  pngScale: PropTypes.number,
  enforceContrast: PropTypes.bool,
  onDownload: PropTypes.func,
  className: PropTypes.string,
};