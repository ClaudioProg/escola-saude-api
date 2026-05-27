// ✅ src/auth/authGoogle.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 *
 * Login Google oficial:
 * - Endpoint: POST /api/auth/google
 * - Não cria usuário automaticamente.
 * - Só autentica usuário já cadastrado no banco.
 * - Não expõe /auth/me. O endpoint oficial de sessão é /perfil/me.
 * - JWT gerado pelo contrato oficial de generateToken.js v2.0:
 *   {
 *     sub: string,
 *     perfil: string[]
 *   }
 */

const express = require("express");
const { OAuth2Client } = require("google-auth-library");

const dbModule = require("../db");
const generateToken = require("./generateToken");

const router = express.Router();

const db = dbModule?.db ?? dbModule;

if (!db?.query || typeof db.query !== "function") {
  console.error("[authGoogle] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em authGoogle.js: query ausente.");
}

/* ──────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */

const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const IS_PROD = process.env.NODE_ENV === "production";

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

if (!GOOGLE_CLIENT_ID) {
  console.warn("[authGoogle] GOOGLE_CLIENT_ID não definido no ambiente.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/* ──────────────────────────────────────────────────────────────
   Logs
────────────────────────────────────────────────────────────── */

function mkRid() {
  return `gauth-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, message, extra) {
  const prefix = `[authGoogle][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${message}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (!IS_PROD) {
    if (level === "warn") return console.warn(`${prefix} ⚠ ${message}`, extra || "");
    return console.log(`${prefix} • ${message}`, extra || "");
  }

  return undefined;
}

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function uniq(array) {
  return [...new Set(array)];
}

function normalizePerfil(perfilRaw) {
  const base = Array.isArray(perfilRaw)
    ? perfilRaw
    : typeof perfilRaw === "string"
      ? perfilRaw.split(",")
      : [];

  const normalizado = uniq(
    base
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
  );

  return normalizado.filter((perfil) => PERFIS_OFICIAIS.has(perfil));
}

function buildUsuarioResponse(usuario) {
  const perfis = normalizePerfil(usuario?.perfil);
  const perfil = perfis[0] || "";

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    cpf: usuario.cpf,
    perfil,
  };
}

function setNoStoreHeaders(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

async function findUsuarioByEmail(email) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      email,
      cpf,
      perfil
    FROM usuarios
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );

  return result.rows?.[0] || null;
}

async function verifyGoogleCredential(credential) {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload() || {};
}

/* ──────────────────────────────────────────────────────────────
   POST /api/auth/google
────────────────────────────────────────────────────────────── */

router.post("/google", async (req, res) => {
  const rid = mkRid();

  try {
    const credential = req.body?.credential;

    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({
        ok: false,
        code: "AUTH-GOOGLE-400-CREDENTIAL-AUSENTE",
        message: "Credencial do Google não fornecida.",
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      log(rid, "warn", "GOOGLE_CLIENT_ID ausente");

      return res.status(500).json({
        ok: false,
        code: "AUTH-GOOGLE-500-CONFIG-AUSENTE",
        message: "Configuração do Google indisponível.",
      });
    }

    log(rid, "info", "Iniciando autenticação Google");

    const googlePayload = await verifyGoogleCredential(credential);

    const email = normalizeEmail(googlePayload.email);
    const emailVerified = googlePayload.email_verified === true;

    if (!email) {
      log(rid, "warn", "Payload Google sem e-mail válido");

      return res.status(401).json({
        ok: false,
        code: "AUTH-GOOGLE-401-EMAIL-AUSENTE",
        message: "Falha na autenticação com Google.",
      });
    }

    if (!emailVerified) {
      log(rid, "warn", "E-mail Google não verificado", { email });

      return res.status(401).json({
        ok: false,
        code: "AUTH-GOOGLE-401-EMAIL-NAO-VERIFICADO",
        message: "E-mail do Google não verificado.",
      });
    }

    const usuario = await findUsuarioByEmail(email);

    if (!usuario) {
      log(rid, "warn", "Usuário Google não encontrado no cadastro", { email });

      return res.status(403).json({
        ok: false,
        code: "AUTH-GOOGLE-403-USUARIO-NAO-CADASTRADO",
        message:
          "E-mail não localizado. Faça o cadastro completo antes de entrar com Google.",
      });
    }

    const usuarioResponse = buildUsuarioResponse(usuario);

    if (!usuarioResponse.perfil) {
  log(rid, "warn", "Usuário sem perfil oficial válido", {
    usuarioId: usuario.id,
    perfil: usuario.perfil,
  });

  return res.status(403).json({
    ok: false,
    code: "AUTH-GOOGLE-403-PERFIL-INVALIDO",
    message: "Usuário sem perfil de acesso válido.",
  });
}

    const token = generateToken(
  {
    id: usuario.id,
    perfil: [usuarioResponse.perfil],
  },
  "1d"
);

    setNoStoreHeaders(res);

    log(rid, "info", "Login Google concluído", {
  usuarioId: usuario.id,
  email: usuario.email,
  perfil: usuarioResponse.perfil,
});

    return res.status(200).json({
      ok: true,
      code: "AUTH-GOOGLE-200-LOGIN",
      message: "Login com Google realizado com sucesso.",
      token,
      usuario: usuarioResponse,
    });
  } catch (error) {
    log(rid, "error", "Erro ao autenticar com Google", error);

    return res.status(401).json({
      ok: false,
      code: "AUTH-GOOGLE-401-FALHA",
      message: "Falha na autenticação com Google.",
    });
  }
});

module.exports = router;