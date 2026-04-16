/* eslint-disable no-console */
// 📁 src/controllers/loginController.js — PREMIUM++
// - Compat DB robusta (req.db + fallback)
// - Anti-enumeração / timing mais consistente
// - Cookie httpOnly robusto
// - Anti-cache completo
// - Resposta segura e padronizada
"use strict";

const dbMod = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../auth/generateToken");
const formatarPerfil = require("../utils/formatarPerfil");
const { gerarNotificacaoDeAvaliacao } = require("./notificacaoController");

/* ────────────────────────────────────────────────────────────────
   Compat DB
──────────────────────────────────────────────────────────────── */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;

const baseQuery =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof baseQuery !== "function") {
  console.error("[loginController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em loginController.js (query ausente)");
}

function getDb(req) {
  const reqDb = req?.db;
  if (reqDb?.query && typeof reqDb.query === "function") return reqDb;
  return { query: baseQuery };
}

async function queryDb(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
}

const IS_PROD = process.env.NODE_ENV === "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
──────────────────────────────────────────────────────────────── */
function mkRid(prefix = "AUTH") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function log(rid, level, msg, extra) {
  const prefix = `[AUTH][RID=${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (!IS_PROD) {
    if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
    return console.log(`${prefix} • ${msg}`, extra || "");
  }

  return undefined;
}

/* ────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
const digitsOnly = (v) => String(v || "").replace(/\D/g, "");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeUserForResponse(u, perfilArray) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    perfil: Array.isArray(perfilArray) ? perfilArray : [],
    imagem_base64: u.imagem_base64 || null,
  };
}

function resolveCookieSameSite() {
  // Se quiser forçar cross-site em produção, pode usar env:
  // AUTH_COOKIE_SAMESITE=none
  const raw = String(process.env.AUTH_COOKIE_SAMESITE || "").trim().toLowerCase();

  if (raw === "none") return "none";
  if (raw === "strict") return "strict";
  return "lax";
}

function buildCookieOptions() {
  const sameSite = resolveCookieSameSite();
  const secure = sameSite === "none" ? true : IS_PROD;

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: "/",
  };
}

function setNoStoreHeaders(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
}

/* ────────────────────────────────────────────────────────────────
   🎯 Login de usuário via CPF e senha
   @route POST /api/usuarios/login
──────────────────────────────────────────────────────────────── */
async function loginUsuario(req, res) {
  const rid = mkRid();

  try {
    const cpfRaw = req.body?.cpf;
    const senhaRaw = req.body?.senha;

    const cpf = digitsOnly(cpfRaw);
    const senha =
      typeof senhaRaw === "string" ? senhaRaw : String(senhaRaw || "");

    // validação básica
    if (!cpf || !senha) {
      return res.status(400).json({ erro: "CPF e senha são obrigatórios." });
    }

    // sanidade básica do CPF
    if (cpf.length !== 11) {
      await sleep(150);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // busca usuário + assinatura
    const result = await queryDb(
      req,
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.cpf,
        u.perfil,
        u.senha,
        a.imagem_base64
      FROM usuarios u
      LEFT JOIN assinaturas a ON a.usuario_id = u.id
      WHERE u.cpf = $1
      LIMIT 1
      `,
      [cpf]
    );

    const usuario = result.rows?.[0] || null;

    // não revela se existe ou não
    if (!usuario) {
      try {
        // bcrypt dummy compare para timing menos previsível
        const dummyHash =
          "$2b$10$CwTycUXWue0Thq9StjUM0uJ8N9YqvYQx8rU0lE8r1W3sQ8v7r8E2S";
        await bcrypt.compare(senha, dummyHash);
      } catch (_) {
        // noop
      }

      await sleep(120);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // se por algum motivo senha vier nula/vazia no banco
    if (!usuario.senha) {
      await sleep(120);
      log(rid, "warn", "Usuário sem hash de senha válido", { usuarioId: usuario.id });
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      await sleep(120);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // perfil sempre array
    const perfilFonte = usuario.perfis ?? usuario.perfil ?? [];
    const perfilArray = formatarPerfil(perfilFonte);

    // token
    const token = generateToken({
      id: usuario.id,
      cpf: usuario.cpf,
      nome: usuario.nome,
      perfil: perfilArray,
    });

    // cookie
    res.cookie("token", token, buildCookieOptions());

    // anti-cache
    setNoStoreHeaders(res);

    // notificações pós-login (best-effort)
    try {
      await gerarNotificacaoDeAvaliacao(usuario.id);
    } catch (e) {
      log(
        rid,
        "warn",
        "Falha ao gerar notificações de avaliação (não bloqueante)",
        e?.message || e
      );
    }

    log(rid, "info", "login OK", {
      usuarioId: usuario.id,
      perfis: perfilArray,
    });

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: sanitizeUserForResponse(usuario, perfilArray),
    });
  } catch (error) {
    log(rid, "error", "Erro no login", error);
    return res.status(500).json({ erro: "Erro interno no servidor." });
  }
}

module.exports = { loginUsuario };