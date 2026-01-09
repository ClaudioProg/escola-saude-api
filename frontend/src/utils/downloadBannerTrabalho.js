// ✅ src/utils/downloadBannerTrabalho.js
// -----------------------------------------------------------------------------
// Baixa o banner (arquivo) de uma submissão autenticada usando a nossa API
// central (com headers de fuso, CORS-safe, https upgrade, etc.).
//
// Compatibilidade mantida:
//   baixarBannerTrabalho(submissaoId, nomeSugestao?: string)
//
// Extras:
// - Usa apiGetResponse (para ler Content-Disposition) + downloadBlob
// - Parser robusto de filename (suporta filename* e filename="...")
// - Fallback de extensão por Content-Type
// -----------------------------------------------------------------------------

import { apiGetResponse, downloadBlob } from "../services/api";

/** Parser robusto para extrair nome de arquivo do Content-Disposition. */
function parseFilenameFromContentDisposition(cd = "") {
  if (typeof cd !== "string" || !cd) return undefined;

  // Preferência: filename* (RFC 5987)
  // Ex.: filename*=UTF-8''Relat%C3%B3rio%20Final.pdf
  const mStar = cd.match(/filename\*\s*=\s*([^']*)''([^;]+)/i);
  if (mStar && mStar[2]) {
    try {
      return decodeURIComponent(mStar[2].trim().replace(/^["']|["']$/g, ""));
    } catch {
      // segue para tentar o filename "simples"
    }
  }

  // Secundário: filename="arquivo.ext" OU filename=arquivo.ext
  const m = cd.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (m && m[2]) {
    return m[2].trim();
  }

  return undefined;
}

/** Mapeia uma extensão a partir do Content-Type (fallback). */
function inferExtFromContentType(ct = "") {
  const s = String(ct || "").toLowerCase();
  if (!s) return "";
  if (s.includes("pdf")) return ".pdf";
  if (s.includes("presentation") || s.includes("powerpoint")) return ".pptx";
  if (s.includes("zip")) return ".zip";
  if (s.includes("msword")) return ".doc";
  if (s.includes("wordprocessingml")) return ".docx";
  if (s.includes("excel")) return ".xlsx";
  if (s.includes("image/png")) return ".png";
  if (s.includes("image/jpeg")) return ".jpg";
  return "";
}

/**
 * Baixa o banner de um trabalho.
 * @param {number|string} submissaoId
 * @param {string} [nomeSugestao] - nome sugerido (fallback)
 */
export async function baixarBannerTrabalho(submissaoId, nomeSugestao) {
  try {
    if (!submissaoId && submissaoId !== 0) {
      console.error("[baixarBannerTrabalho] submissaoId inválido:", submissaoId);
      return false;
    }

    // Usamos a rota pública autenticada da API central.
    // apiGetResponse mantém os headers intactos para lermos Content-Disposition
    const res = await apiGetResponse(`/trabalhos/submissoes/${submissaoId}/banner`, {
      auth: true,
      on401: "silent",
      on403: "silent",
    });

    const contentType = res.headers.get("Content-Type") || "application/octet-stream";
    const cd = res.headers.get("Content-Disposition") || "";

    // 1) tenta extrair do header
    let filename =
      parseFilenameFromContentDisposition(cd) ||
      nomeSugestao ||
      `banner-${submissaoId}`;

    // 2) assegura extensão se não tiver
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
      const inferred = inferExtFromContentType(contentType);
      if (inferred) filename += inferred;
    }

    // 3) baixa o Blob e dispara download
    const blob = await res.blob();
    downloadBlob(filename, blob);

    console.log("[baixarBannerTrabalho] download iniciado:", {
      submissaoId,
      filename,
      contentType,
    });
    return true;
  } catch (err) {
    // apiGetResponse já trata 401/403 com as flags passadas; aqui registramos o erro.
    console.error("[baixarBannerTrabalho] erro:", err);
    // Evita alert bloqueante; deixe o chamador decidir exibir toast se quiser.
    return false;
  }
}
