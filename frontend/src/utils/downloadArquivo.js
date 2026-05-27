// 📁 src/utils/downloadArquivo.js — v2.0

/**
 * Utilitários genéricos para download de arquivos no frontend.
 *
 * Função:
 * - Extrair nome de arquivo do Content-Disposition.
 * - Inferir extensão por Content-Type.
 * - Sanitizar nome de arquivo.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Não há risco de fuso horário.
 */

export function parseFilenameFromContentDisposition(contentDisposition = "") {
  if (typeof contentDisposition !== "string" || !contentDisposition.trim()) {
    return "";
  }

  const filenameStar =
    contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i) ||
    contentDisposition.match(/filename\*\s*=\s*([^;]+)/i);

  if (filenameStar?.[1]) {
    try {
      return decodeURIComponent(
        filenameStar[1].trim().replace(/^["']|["']$/g, "")
      );
    } catch {
      // segue para filename simples
    }
  }

  const filename = contentDisposition.match(/filename\s*=\s*("?)([^";]+)\1/i);

  if (filename?.[2]) {
    return filename[2].trim();
  }

  return "";
}

export function inferExtFromContentType(contentType = "") {
  const value = String(contentType || "").toLowerCase();

  if (!value) return "";

  if (value.includes("pdf")) return ".pdf";
  if (value.includes("presentation") || value.includes("powerpoint")) return ".pptx";
  if (value.includes("zip")) return ".zip";
  if (value.includes("msword")) return ".doc";
  if (value.includes("wordprocessingml")) return ".docx";
  if (value.includes("spreadsheetml") || value.includes("excel")) return ".xlsx";
  if (value.includes("image/png")) return ".png";
  if (value.includes("image/jpeg")) return ".jpg";
  if (value.includes("image/webp")) return ".webp";

  return "";
}

export function sanitizeFilename(filename = "", fallback = "arquivo") {
  const clean = String(filename || "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean || fallback;
}

export function ensureFilenameExtension(filename, contentType = "") {
  const safeName = sanitizeFilename(filename);

  if (/\.[a-z0-9]{2,8}$/i.test(safeName)) {
    return safeName;
  }

  const inferred = inferExtFromContentType(contentType);

  return inferred ? `${safeName}${inferred}` : safeName;
}

export function downloadBlob(filename, blob) {
  if (!(blob instanceof Blob)) {
    throw new Error("Arquivo inválido para download.");
  }

  const safeFilename = ensureFilenameExtension(
    sanitizeFilename(filename, "arquivo"),
    blob.type
  );

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = safeFilename;
  link.rel = "noopener noreferrer";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 500);
}