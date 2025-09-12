// 📁 src/utils/perfis.js
// Utilidades para leitura e validação de perfis do usuário no localStorage.

/**
 * Normaliza qualquer entrada para um array de strings lowercase, limpando ruído.
 */
function normalizarPerfis(input) {
  const lista = [];

  if (Array.isArray(input)) {
    input.forEach((p) => {
      if (p != null) lista.push(String(p).replace(/[\[\]"]/g, "").trim().toLowerCase());
    });
    return lista;
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (input && typeof input === "object" && "toString" in input) {
    return [String(input).trim().toLowerCase()];
  }

  return [];
}

/**
 * Lê os perfis do localStorage de forma robusta.
 * Aceita tanto a chave `perfil` (string ou array)
 * quanto `usuario` com campos `perfil`/`perfis`.
 * Sempre retorna um array de strings lowercase, sem duplicatas.
 */
export function getPerfisRobusto() {
  const out = new Set();

  // --- 1) Chave direta: "perfil"
  const rawPerfil = localStorage.getItem("perfil");
  if (rawPerfil) {
    try {
      const parsed = JSON.parse(rawPerfil);
      normalizarPerfis(parsed).forEach((p) => out.add(p));
    } catch {
      // fallback: tratar como CSV bruto
      normalizarPerfis(rawPerfil).forEach((p) => out.add(p));
    }
  }

  // --- 2) Objeto "usuario"
  try {
    const rawUser = localStorage.getItem("usuario");
    if (rawUser) {
      const u = JSON.parse(rawUser);

      if (u?.perfil !== undefined) {
        normalizarPerfis(u.perfil).forEach((p) => out.add(p));
      }
      if (u?.perfis !== undefined) {
        normalizarPerfis(u.perfis).forEach((p) => out.add(p));
      }
    }
  } catch (err) {
    console.warn("[getPerfisRobusto] Falha ao ler 'usuario':", err);
  }

  // --- 3) Fallback
  if (out.size === 0) out.add("usuario");

  return Array.from(out);
}

/**
 * Verifica se o conjunto de perfis contém "administrador".
 * @param {string[]} perfis
 */
export function ehAdmin(perfis = []) {
  return perfis.some((p) => String(p).toLowerCase() === "administrador");
}

/**
 * Verifica se é instrutor ou administrador (admin é superusuário).
 * @param {string[]} perfis
 */
export function ehInstrutor(perfis = []) {
  const lower = perfis.map((p) => String(p).toLowerCase());
  return lower.includes("instrutor") || lower.includes("administrador");
}
