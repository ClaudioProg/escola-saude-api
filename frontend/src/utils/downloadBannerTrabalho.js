// 📁 src/utils/downloadBannerTrabalho.js — v2.0
import { apiGetResponse, downloadBlob } from "../services/api";
import {
  ensureFilenameExtension,
  parseFilenameFromContentDisposition,
  sanitizeFilename,
} from "./downloadArquivo";

/**
 * Baixa o banner de um trabalho/submissão.
 *
 * @param {number|string} submissaoId
 * @param {string} [nomeSugestao]
 * @returns {Promise<boolean>}
 */
export async function baixarBannerTrabalho(submissaoId, nomeSugestao) {
  const id =
    typeof submissaoId === "number"
      ? submissaoId
      : typeof submissaoId === "string" && /^\d+$/.test(submissaoId.trim())
        ? Number(submissaoId.trim())
        : null;

  if (!Number.isInteger(id) || id <= 0) {
    console.error("[baixarBannerTrabalho] submissaoId inválido.", {
      submissaoId,
    });

    return false;
  }

  try {
    const response = await apiGetResponse(`/trabalhos/submissao/${id}/banner`, {
      auth: true,
      on401: "silent",
      on403: "silent",
    });

    const contentType =
      response.headers.get("Content-Type") || "application/octet-stream";

    const contentDisposition =
      response.headers.get("Content-Disposition") || "";

    const filenameFromHeader =
      parseFilenameFromContentDisposition(contentDisposition);

    const filenameBase = sanitizeFilename(
      filenameFromHeader || nomeSugestao || `banner-${id}`,
      `banner-${id}`
    );

    const filename = ensureFilenameExtension(filenameBase, contentType);

    const blob = await response.blob();

    if (!blob || blob.size <= 0) {
      console.error("[baixarBannerTrabalho] arquivo vazio.", {
        submissaoId: id,
        contentType,
      });

      return false;
    }

    downloadBlob(filename, blob);

    return true;
  } catch (error) {
    console.error("[baixarBannerTrabalho] erro ao baixar banner.", {
      message: error?.message || String(error),
      status: error?.status,
      code: error?.code,
      submissaoId: id,
    });

    return false;
  }
}