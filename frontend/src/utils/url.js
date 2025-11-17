// ✅ src/utils/url.js
export function resolveApiFile(url) {
    if (!url) return "";
    // se já for absoluta (http/https), retorna
    if (/^https?:\/\//i.test(url)) return url;
    // caso contrário, prefixa com a BASE da API
    const base = import.meta.env.VITE_API_BASE_URL || "";
    return `${base}${url}`;
  }
  