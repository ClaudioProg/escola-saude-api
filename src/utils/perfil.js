// ✅ src/utils/perfil.js
/* eslint-disable no-console */
"use strict";

/* =========================
   Constantes
========================= */
const ROLE_ALIASES = {
  admin: "administrador",
};

const CAMPOS_OBRIGATORIOS_PERFIL = [
  "cargo_id",
  "unidade_id",
  "data_nascimento",
  "genero_id",
  "orientacao_sexual_id",
  "cor_raca_id",
  "escolaridade_id",
  "deficiencia_id",
];

/* =========================
   Helpers base
========================= */
function uniq(arr) {
  return [...new Set(arr)];
}

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "";
  return ROLE_ALIASES[value] || value;
}

function toArrayLower(value) {
  if (!value) return [];

  let arr = [];

  if (Array.isArray(value)) {
    arr = value;
  } else if (typeof value === "string") {
    arr = value.split(/[;,]/);
  } else {
    return [];
  }

  return uniq(
    arr
      .map((item) => normalizeRole(item))
      .filter(Boolean)
  );
}

function isEmptyValue(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && !v.trim()) return true;
  return false;
}

function isIsoDateOnly(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;

  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function isPositiveNumericId(v) {
  if (typeof v === "number") {
    return Number.isFinite(v) && v > 0;
  }

  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    return Number(v) > 0;
  }

  return false;
}

function getPerfilSource(input) {
  if (!input) return [];

  const isReqLike = !!(input.usuario || input.user || input.auth);

  if (isReqLike) {
    return (
      input?.usuario?.perfis ??
      input?.usuario?.perfil ??
      input?.usuario?.roles ??
      input?.user?.perfis ??
      input?.user?.perfil ??
      input?.user?.roles ??
      input?.auth?.perfis ??
      input?.auth?.perfil ??
      input?.auth?.roles ??
      []
    );
  }

  return (
    input?.perfis ??
    input?.perfil ??
    input?.roles ??
    input?.role ??
    []
  );
}

/* =========================
   Perfil completo
========================= */
function isPerfilIncompleto(usuario) {
  for (const campo of CAMPOS_OBRIGATORIOS_PERFIL) {
    const valor = usuario?.[campo];

    if (isEmptyValue(valor)) return true;

    if (campo !== "data_nascimento") {
      if (!isPositiveNumericId(valor)) return true;
      continue;
    }

    if (typeof valor === "string") {
      if (!isIsoDateOnly(valor)) return true;
      continue;
    }

    if (valor instanceof Date) {
      if (Number.isNaN(valor.getTime())) return true;
      continue;
    }

    return true;
  }

  return false;
}

function camposFaltantesPerfil(usuario) {
  return CAMPOS_OBRIGATORIOS_PERFIL.filter((campo) => {
    const valor = usuario?.[campo];

    if (isEmptyValue(valor)) return true;

    if (campo !== "data_nascimento") {
      return !isPositiveNumericId(valor);
    }

    if (typeof valor === "string") {
      return !isIsoDateOnly(valor);
    }

    if (valor instanceof Date) {
      return Number.isNaN(valor.getTime());
    }

    return true;
  });
}

/* =========================
   Perfis / roles
========================= */
function extrairPerfis(input) {
  return toArrayLower(getPerfilSource(input));
}

function hasPerfil(input, ...perfis) {
  const userRoles = extrairPerfis(input);
  const allowed = toArrayLower(perfis);

  if (!allowed.length) return true;
  return allowed.some((role) => userRoles.includes(role));
}

function hasTodosPerfis(input, ...perfis) {
  const userRoles = extrairPerfis(input);
  const allowed = toArrayLower(perfis);

  if (!allowed.length) return true;
  return allowed.every((role) => userRoles.includes(role));
}

function isAdminLike(input) {
  return hasPerfil(input, "administrador", "admin");
}

/* =========================
   Middleware
========================= */
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
        return res.status(403).json({
          erro: "Acesso negado.",
          detalhes: {
            necessario: allowed,
          },
        });
      }

      return next();
    } catch (err) {
      console.error("[permitirPerfis]", err?.message || err);
      return res.status(500).json({ erro: "Erro de autorização." });
    }
  };
}

module.exports = {
  CAMPOS_OBRIGATORIOS_PERFIL,

  isPerfilIncompleto,
  camposFaltantesPerfil,

  extrairPerfis,
  hasPerfil,
  hasTodosPerfis,
  isAdminLike,
  permitirPerfis,

  toArrayLower,
  normalizeRole,
  isIsoDateOnly,
};