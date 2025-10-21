// ✅ src/utils/perfil.js
/**
 * Verifica se o perfil de um usuário está incompleto.
 * Um perfil é considerado incompleto se algum dos campos obrigatórios
 * estiver ausente, nulo ou vazio.
 */
function isPerfilIncompleto(u) {
  const obrigatorios = [
    "cargo_id",
    "unidade_id",
    "data_nascimento",
    "genero_id",
    "orientacao_sexual_id",
    "cor_raca_id",
    "escolaridade_id",
    "deficiencia_id",
  ];

  for (const campo of obrigatorios) {
    const v = u?.[campo];
    if (v === null || v === undefined || v === "" || v === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Extrai e normaliza a lista de perfis de um usuário autenticado.
 * Aceita `req.usuario.perfil` como string única, lista ou CSV.
 */
function extrairPerfis(req) {
  const candidato =
    req?.usuario?.perfis ??
    req?.usuario?.perfil ??
    req?.user?.perfis ??
    req?.user?.perfil ??
    [];

  if (Array.isArray(candidato)) {
    return candidato.map((p) => String(p).toLowerCase().trim()).filter(Boolean);
  }

  // "Administrador, Instrutor" → ["administrador", "instrutor"]
  return String(candidato)
    .split(/[;,]/)
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Middleware genérico para restringir acesso com base em perfis permitidos.
 * Exemplo:
 *   router.get("/rota", authMiddleware, permitirPerfis("administrador", "instrutor"), controller);
 */
function permitirPerfis(...perfisPermitidos) {
  const whitelist = perfisPermitidos.map((p) => String(p).toLowerCase().trim());
  return (req, res, next) => {
    try {
      const perfisUsuario = extrairPerfis(req);
      const autorizado = perfisUsuario.some((p) => whitelist.includes(p));
      if (!autorizado) {
        return res.status(403).json({ erro: "Acesso negado." });
      }
      next();
    } catch (err) {
      console.error("[permitirPerfis]", err);
      return res.status(500).json({ erro: "Erro de autorização." });
    }
  };
}

module.exports = {
  isPerfilIncompleto,
  extrairPerfis,
  permitirPerfis,
};
