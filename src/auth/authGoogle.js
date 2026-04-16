/* eslint-disable no-console */
"use strict";

const express = require("express");
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const dbMod = require("../db");
const generateToken = require("./generateToken");

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   DB compat resiliente
────────────────────────────────────────────────────────────── */
const pool =
  dbMod?.pool ||
  dbMod?.Pool ||
  dbMod?.db?.pool ||
  dbMod?.db ||
  dbMod;

const query =
  dbMod?.query ||
  dbMod?.db?.query?.bind?.(dbMod.db) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[authGoogle] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em authGoogle.js (query ausente)");
}

/* ──────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
const IS_PROD = process.env.NODE_ENV === "production";

if (!GOOGLE_CLIENT_ID) {
  console.warn("⚠️ [authGoogle] GOOGLE_CLIENT_ID não definido no ambiente");
}
if (!JWT_SECRET) {
  console.warn("⚠️ [authGoogle] JWT_SECRET não definido no ambiente");
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ──────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */
function mkRid() {
  return `gauth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[authGoogle][RID=${rid}]`;

  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }

  if (!IS_PROD) {
    if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
}

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  const n = String(name || "").trim();
  return n || "Usuário";
}

function normalizePerfil(perfilRaw) {
  if (Array.isArray(perfilRaw)) {
    return [...new Set(
      perfilRaw
        .map((p) => String(p || "").trim().toLowerCase())
        .filter(Boolean)
    )];
  }

  if (typeof perfilRaw === "string") {
    return [...new Set(
      perfilRaw
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean)
    )];
  }

  return [];
}

function buildUsuarioResponse(usuario) {
  const perfil = normalizePerfil(usuario?.perfil);

  return {
    id: usuario?.id ?? null,
    nome: usuario?.nome ?? "Usuário",
    email: usuario?.email ?? null,
    cpf: usuario?.cpf ?? null,
    perfil,
  };
}

function buildTokenPayload(usuario) {
  const perfil = normalizePerfil(usuario?.perfil);

  return {
    id: usuario?.id ?? null,
    nome: usuario?.nome ?? "Usuário",
    email: usuario?.email ?? null,
    cpf: usuario?.cpf ?? null,
    perfil,
  };
}

function extractBearerToken(req) {
  const authHeader =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    "";

  if (typeof authHeader !== "string") return null;

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) return null;

  return token.trim();
}

function verifyJwtToken(token) {
  if (!JWT_SECRET) {
    const err = new Error("JWT_SECRET não configurado");
    err.code = "JWT_SECRET_MISSING";
    throw err;
  }

  return jwt.verify(token, JWT_SECRET);
}

async function findUsuarioByEmail(email) {
  const result = await query(
    `
    SELECT id, nome, email, cpf, perfil
    FROM usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );

  return result.rows?.[0] || null;
}

async function createUsuarioFromGoogle({ nome, email }) {
  try {
    const result = await query(
      `
      INSERT INTO usuarios (nome, email, cpf, senha, perfil)
      VALUES ($1, $2, NULL, NULL, 'usuario')
      RETURNING id, nome, email, cpf, perfil
      `,
      [nome, email]
    );

    return result.rows?.[0] || null;
  } catch (err) {
    // se houve corrida e o email já foi criado por outra requisição
    if (err?.code === "23505") {
      return findUsuarioByEmail(email);
    }
    throw err;
  }
}

async function ensureUsuarioGoogle({ nome, email }, rid) {
  let usuario = await findUsuarioByEmail(email);

  if (usuario) return usuario;

  log(rid, "info", "Usuário Google não encontrado; criando automaticamente", {
    email,
  });

  usuario = await createUsuarioFromGoogle({ nome, email });

  if (!usuario) {
    throw new Error("Falha ao criar usuário Google.");
  }

  return usuario;
}

/* ──────────────────────────────────────────────────────────────
   POST /api/auth/google
   Body: { credential }
────────────────────────────────────────────────────────────── */
router.post("/google", async (req, res) => {
  const rid = mkRid();

  try {
    const { credential } = req.body || {};

    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({ erro: "Credencial não fornecida." });
    }

    if (!GOOGLE_CLIENT_ID) {
      log(rid, "warn", "GOOGLE_CLIENT_ID ausente");
      return res.status(500).json({
        erro: "Configuração do Google indisponível.",
      });
    }

    if (!JWT_SECRET) {
      log(rid, "warn", "JWT_SECRET ausente");
      return res.status(500).json({
        erro: "Configuração de autenticação indisponível.",
      });
    }

    log(rid, "info", "Iniciando autenticação Google");

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() || {};

    const email = normalizeEmail(payload.email);
    const nome = normalizeName(payload.name || payload.given_name);
    const emailVerified = payload.email_verified === true;

    if (!email) {
      log(rid, "warn", "Payload Google sem e-mail válido");
      return res.status(401).json({
        erro: "Falha na autenticação com Google.",
      });
    }

    if (!emailVerified) {
      log(rid, "warn", "E-mail do Google não verificado", { email });
      return res.status(401).json({
        erro: "E-mail do Google não verificado.",
      });
    }

    const usuario = await ensureUsuarioGoogle({ nome, email }, rid);
    const usuarioResponse = buildUsuarioResponse(usuario);
    const token = generateToken(buildTokenPayload(usuario), "1d");

    log(rid, "info", "Login Google concluído", {
      usuarioId: usuario.id,
      email: usuario.email,
      perfis: usuarioResponse.perfil,
    });

    return res.status(200).json({
      token,
      perfil: usuarioResponse.perfil,
      usuario: usuarioResponse,
    });
  } catch (err) {
    log(rid, "error", "Erro ao autenticar com Google", err);
    return res.status(401).json({
      erro: "Falha na autenticação com Google.",
    });
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /api/auth/me
   Header: Authorization: Bearer <token>
────────────────────────────────────────────────────────────── */
router.get("/me", async (req, res) => {
  const rid = mkRid();

  try {
    const token = extractBearerToken(req);

    if (!token) {
      log(rid, "warn", "Token ausente em /me");
      return res.status(401).json({ erro: "Não autenticado." });
    }

    let decoded;
    try {
      decoded = verifyJwtToken(token);
    } catch (err) {
      const isExpired = err?.name === "TokenExpiredError";

      log(
        rid,
        "warn",
        `Token inválido${isExpired ? " ou expirado" : ""} em /me`,
        err?.message || err
      );

      return res.status(401).json({
        erro: isExpired ? "Sessão expirada." : "Token inválido.",
        sessionExpired: isExpired,
      });
    }

    const usuarioId = Number(decoded?.id ?? decoded?.sub);

    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      log(rid, "warn", "Token sem usuarioId válido");
      return res.status(401).json({ erro: "Token inválido." });
    }

    const result = await query(
      `
      SELECT id, nome, email, cpf, perfil
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    if (!result.rows?.length) {
      log(rid, "warn", "Usuário do token não encontrado", { usuarioId });
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    const usuario = result.rows[0];
    const usuarioResponse = buildUsuarioResponse(usuario);

    log(rid, "info", "Sessão válida em /me", {
      usuarioId: usuario.id,
      email: usuario.email,
      perfis: usuarioResponse.perfil,
    });

    return res.status(200).json({
      autenticado: true,
      usuario: usuarioResponse,
    });
  } catch (err) {
    log(rid, "error", "Erro ao validar sessão em /me", err);
    return res.status(500).json({
      erro: "Erro ao validar sessão.",
    });
  }
});

module.exports = router;