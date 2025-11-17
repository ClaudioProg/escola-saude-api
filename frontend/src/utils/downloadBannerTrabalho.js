// ✅ src/utils/downloadBannerTrabalho.js
/* Util para baixar o banner de um trabalho já autenticado.
 * - Usa fetch com Authorization: Bearer <token> (igual ao axios)
 * - Faz GET /api/trabalhos/submissoes/:id/banner
 * - Cria um link temporário e dispara o download
 */

/** Recupera o token salvo no frontend */
function getAuthToken() {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem("token") ||          // 👈 ajuste aqui se usar outro nome
      localStorage.getItem("jwt") ||
      localStorage.getItem("authToken") ||
      null
    );
  } catch {
    return null;
  }
}

export async function baixarBannerTrabalho(submissaoId, nomeSugestao) {
  try {
    if (!submissaoId) {
      console.error("[baixarBannerTrabalho] submissaoId inválido:", submissaoId);
      return;
    }

    const token = getAuthToken();

    const resp = await fetch(`/api/trabalhos/submissoes/${submissaoId}/banner`, {
      method: "GET",
      credentials: "include", // se algum dia você usar cookie, continua valendo
      headers: token
        ? {
            Authorization: `Bearer ${token}`,   // 🔑 AQUI É O SEGREDO
          }
        : {},
    });

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      console.error(
        "[baixarBannerTrabalho] resposta não OK:",
        resp.status,
        texto
      );
      alert(
        `Não foi possível baixar o banner (código ${resp.status}). ` +
          "Tente novamente mais tarde."
      );
      return;
    }

    const contentType =
      resp.headers.get("Content-Type") || "application/octet-stream";
    const dispo = resp.headers.get("Content-Disposition") || "";

    // Tenta extrair o nome do arquivo do header, se existir
    let nomeArquivo =
      (dispo.match(/filename="?([^"]+)"?/i) || [])[1] ||
      nomeSugestao ||
      "banner";

    // Se não tiver extensão e for PPT/PPTX ou PDF, força uma
    if (!/\.[a-z0-9]{2,5}$/i.test(nomeArquivo)) {
      if (/presentation|powerpoint/i.test(contentType)) {
        nomeArquivo += ".pptx";
      } else if (/pdf/i.test(contentType)) {
        nomeArquivo += ".pdf";
      }
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    console.log("[baixarBannerTrabalho] download iniciado:", {
      submissaoId,
      nomeArquivo,
      contentType,
    });
  } catch (err) {
    console.error("[baixarBannerTrabalho] erro inesperado:", err);
    alert("Não foi possível baixar o banner. Tente novamente em instantes.");
  }
}
