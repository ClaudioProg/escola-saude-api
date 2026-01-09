// ✅ src/utils/perfil.js
/* eslint-disable no-console */

function toArrayLower(v) {
  if (!v) return [];
  const arr = Array.isArray(v)
    ? v
    : typeof v === "string"
      ? v.split(/[;,]/) // aceita CSV com , ou ;
      : [];
  return arr.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
}

function isEmptyValue(v) {
  // null/undefined/"" são vazios
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && !v.trim()) return true;
  return false;
}

function isIsoDateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Verifica se o perfil de um usuário está incompleto.
 * Regra: campo obrigatório é inválido se estiver null/undefined/"".
 * Observação: não tratamos 0 como inválido automaticamente porque alguns IDs podem ser 0 em legados,
 * mas se no seu banco IDs começam em 1, você pode ativar a checagem (ver comentário abaixo).
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

    if (isEmptyValue(v)) return true;

    // ✅ regra especial para IDs numéricos (se seu banco usa SERIAL/IDENTITY, IDs válidos são >= 1)
    if (campo !== "data_nascimento") {
      if (typeof v === "number" && Number.isFinite(v) && v <= 0) return true;
      if (typeof v === "string" && /^\d+$/.test(v) && Number(v) <= 0) return true;
    }

    // ✅ data_nascimento: aceita ISO date-only (YYYY-MM-DD) ou Date válido
    if (campo === "data_nascimento") {
      if (typeof v === "string") {
        if (!isIsoDateOnly(v)) return true;
      } else if (v instanceof Date) {
        if (isNaN(v)) return true;
      } else {
        // qualquer outro tipo é inválido
        return true;
      }
    }
  }

  return false;
}

/**
 * Extrai e normaliza a lista de perfis de um usuário autenticado.
 * Aceita req.usuario / req.user e perfil como string, lista ou CSV.
 */
function extrairPerfis(req) {
  const candidato =
    req?.usuario?.perfis ??
    req?.usuario?.perfil ??
    req?.user?.perfis ??
    req?.user?.perfil ??
    [];

  return toArrayLower(candidato);
}

/** Helper: verifica se req tem pelo menos um dos perfis */
function hasPerfil(req, ...perfis) {
  const userRoles = extrairPerfis(req);
  const allowed = toArrayLower(perfis);
  if (!allowed.length) return true;
  return allowed.some((p) => userRoles.includes(p));
}

/**
 * Middleware genérico para restringir acesso com base em perfis permitidos.
 * Exemplo:
 *   router.get("/rota", authMiddleware, permitirPerfis("administrador", "instrutor"), controller);
 *
 * Nota: isso é equivalente ao authorizeRoles("...") — mantenho aqui por compatibilidade.
 */
function permitirPerfis(...perfisPermitidos) {
  const allowed = toArrayLower(perfisPermitidos);

  return (req, res, next) => {
    try {
      if (!req.user && !req.usuario) {
        return res.status(401).json({ erro: "Não autenticado." });
      }

      if (!allowed.length) return next();

      const autorizado = hasPerfil(req, ...allowed);
      if (!autorizado) {
        return res.status(403).json({ erro: "Acesso negado." });
      }

      return next();
    } catch (err) {
      console.error("[permitirPerfis]", err?.message || err);
      return res.status(500).json({ erro: "Erro de autorização." });
    }
  };
}

module.exports = {
  isPerfilIncompleto,
  extrairPerfis,
  permitirPerfis,

  // extras premium (não quebram nada)
  hasPerfil,
  toArrayLower,
};
