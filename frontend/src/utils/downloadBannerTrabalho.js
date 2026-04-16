// ✅ src/utils/downloadBannerTrabalho.js — PREMIUM++
import { apiGetResponse, downloadBlob } from "../services/api";

/** Parser robusto para extrair nome de arquivo do Content-Disposition. */
function parseFilenameFromContentDisposition(cd = "") {
  if (typeof cd !== "string" || !cd.trim()) return undefined;

  // filename*=UTF-8''Relat%C3%B3rio%20Final.pdf
  const star =
    cd.match(/filename\*\s*=\s*UTF-8''([^;]+)/i) ||
    cd.match(/filename\*\s*=\s*([^;]+)/i);

  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^["']|["']$/g, ""));
    } catch {
      // segue para filename simples
    }
  }

  // filename="arquivo.ext" ou filename=arquivo.ext
  const normal = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (normal?.[2]) {
    return normal[2].trim();
  }

  return undefined;
}

/** Mapeia extensão por Content-Type. */
function inferExtFromContentType(ct = "") {
  const s = String(ct || "").toLowerCase();
  if (!s) return "";

  if (s.includes("pdf")) return ".pdf";
  if (s.includes("presentation") || s.includes("powerpoint")) return ".pptx";
  if (s.includes("zip")) return ".zip";
  if (s.includes("msword")) return ".doc";
  if (s.includes("wordprocessingml")) return ".docx";
  if (s.includes("spreadsheetml") || s.includes("excel")) return ".xlsx";
  if (s.includes("image/png")) return ".png";
  if (s.includes("image/jpeg")) return ".jpg";
  if (s.includes("image/webp")) return ".webp";

  return "";
}

/** Remove caracteres inválidos para nome de arquivo. */
function sanitizeFilename(name = "", fallback = "arquivo") {
  const clean = String(name || "")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return clean || fallback;
}

/**
 * Baixa o banner de um trabalho.
 * @param {number|string} submissaoId
 * @param {string} [nomeSugestao]
 */
export async function baixarBannerTrabalho(submissaoId, nomeSugestao) {
  try {
    const id =
      typeof submissaoId === "number"
        ? submissaoId
        : typeof submissaoId === "string" && /^\d+$/.test(submissaoId.trim())
        ? Number(submissaoId.trim())
        : null;

    if (!Number.isFinite(id) || id <= 0) {
      console.error("[baixarBannerTrabalho] submissaoId inválido:", submissaoId);
      return false;
    }

    const res = await apiGetResponse(`/trabalhos/submissao/${id}/banner`, {
      auth: true,
      on401: "silent",
      on403: "silent",
    });

    const contentType =
      res.headers.get("Content-Type") || "application/octet-stream";
    const cd = res.headers.get("Content-Disposition") || "";

    let filename =
      parseFilenameFromContentDisposition(cd) ||
      nomeSugestao ||
      `banner-${id}`;

    filename = sanitizeFilename(filename, `banner-${id}`);

    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
      const inferred = inferExtFromContentType(contentType);
      if (inferred) filename += inferred;
    }

    const blob = await res.blob();

    if (!blob || blob.size <= 0) {
      console.error("[baixarBannerTrabalho] arquivo vazio:", {
        submissaoId: id,
        contentType,
      });
      return false;
    }

    downloadBlob(filename, blob);

    console.log("[baixarBannerTrabalho] download iniciado:", {
      submissaoId: id,
      filename,
      contentType,
      size: blob.size,
    });

    return true;
  } catch (err) {
    console.error("[baixarBannerTrabalho] erro:", {
      message: err?.message || String(err),
      status: err?.status,
      code: err?.code,
      submissaoId,
    });
    return false;
  }
}