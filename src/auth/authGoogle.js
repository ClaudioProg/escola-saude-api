// src/auth/authGoogle.js
const express = require("express");
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const db = require("../db");

// ✅ Fail-fast: variáveis essenciais
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

if (!GOOGLE_CLIENT_ID) {
  console.warn("⚠️ [authGoogle] GOOGLE_CLIENT_ID não definido no .env");
}
if (!JWT_SECRET) {
  console.warn("⚠️ [authGoogle] JWT_SECRET não definido no .env");
}

// 🔑 Cliente OAuth com Client ID
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/* =========================
   Helpers (premium)
========================= */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  const n = String(name || "").trim();
  return n.length ? n : "Usuário";
}

function normalizePerfil(perfilRaw) {
  if (Array.isArray(perfilRaw)) {
    return perfilRaw
      .map((p) => String(p || "").trim().toLowerCase())
      .filter(Boolean);
  }

  if (typeof perfilRaw === "string") {
    const p = perfilRaw.trim().toLowerCase();
    return p ? [p] : [];
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
    id: usuario.id,
    email: usuario.email,
    cpf: usuario.cpf || null,
    nome: usuario.nome,
    perfil,
  };
}

function extractBearerToken(req) {
  const authHeader =
    req.headers?.authorization || req.headers?.Authorization || "";

  if (typeof authHeader !== "string") return null;

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token?.trim()) {
    return null;
  }

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

/* =========================
   Rotas de autenticação
========================= */

/**
 * 🔐 Autenticação com Google
 * POST /api/auth/google
 * Body: { credential }
 */
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({ erro: "Credencial não fornecida." });
    }

    if (!GOOGLE_CLIENT_ID) {
      return res
        .status(500)
        .json({ erro: "Configuração do Google indisponível." });
    }

    if (!JWT_SECRET) {
      return res
        .status(500)
        .json({ erro: "Configuração de autenticação indisponível." });
    }

    console.log("🔐 [authGoogle] Iniciando autenticação Google");

    // 📥 Verifica token do Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() || {};

    const email = normalizeEmail(payload.email);
    const nome = normalizeName(payload.name || payload.given_name);
    const emailVerified = payload.email_verified === true;

    if (!email) {
      console.warn("⚠️ [authGoogle] Payload do Google sem e-mail válido");
      return res.status(401).json({ erro: "Falha na autenticação com Google." });
    }

    if (!emailVerified) {
      console.warn("⚠️ [authGoogle] E-mail não verificado:", email);
      return res.status(401).json({ erro: "E-mail do Google não verificado." });
    }

    // 🔎 Busca usuário por email
    let result = await db.query(
      `
        SELECT id, nome, email, cpf, perfil
        FROM usuarios
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );

    // ➕ Se não existir, cria com defaults seguros
    if (result.rows.length === 0) {
      console.log("🆕 [authGoogle] Criando usuário automaticamente:", email);

      result = await db.query(
        `
          INSERT INTO usuarios (nome, email, cpf, senha, perfil)
          VALUES ($1, $2, NULL, NULL, 'usuario')
          RETURNING id, nome, email, cpf, perfil
        `,
        [nome, email]
      );
    }

    const usuario = result.rows[0];
    const usuarioResponse = buildUsuarioResponse(usuario);

    // 🔐 JWT
    const token = jwt.sign(buildTokenPayload(usuario), JWT_SECRET, {
      expiresIn: "1d",
    });

    console.log("✅ [authGoogle] Login concluído:", {
      usuarioId: usuario.id,
      email: usuario.email,
      perfis: usuarioResponse.perfil,
    });

    return res.json({
      token,
      perfil: usuarioResponse.perfil,
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error("🔴 [authGoogle] Erro ao autenticar:", err?.message || err);
    return res.status(401).json({ erro: "Falha na autenticação com Google." });
  }
});

/**
 * 👤 Validação silenciosa de sessão
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
router.get("/me", async (req, res) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      console.warn("⚠️ [authGoogle:/me] Token ausente");
      return res.status(401).json({ erro: "Não autenticado." });
    }

    let decoded;

    try {
      decoded = verifyJwtToken(token);
    } catch (err) {
      const isExpired = err?.name === "TokenExpiredError";

      console.warn(
        `⚠️ [authGoogle:/me] Token inválido${isExpired ? " ou expirado" : ""}:`,
        err?.message || err
      );

      return res.status(401).json({
        erro: isExpired ? "Sessão expirada." : "Token inválido.",
        sessionExpired: isExpired,
      });
    }

    const usuarioId = Number(decoded?.id);

    if (!usuarioId) {
      console.warn("⚠️ [authGoogle:/me] Token sem usuarioId válido");
      return res.status(401).json({ erro: "Token inválido." });
    }

    const result = await db.query(
      `
        SELECT id, nome, email, cpf, perfil
        FROM usuarios
        WHERE id = $1
        LIMIT 1
      `,
      [usuarioId]
    );

    if (result.rows.length === 0) {
      console.warn("⚠️ [authGoogle:/me] Usuário do token não encontrado:", {
        usuarioId,
      });

      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    const usuario = result.rows[0];
    const usuarioResponse = buildUsuarioResponse(usuario);

    console.log("✅ [authGoogle:/me] Sessão válida:", {
      usuarioId: usuario.id,
      email: usuario.email,
      perfis: usuarioResponse.perfil,
    });

    return res.status(200).json({
      autenticado: true,
      usuario: usuarioResponse,
    });
  } catch (err) {
    console.error("🔴 [authGoogle:/me] Erro ao validar sessão:", err?.message || err);
    return res.status(500).json({ erro: "Erro ao validar sessão." });
  }
});

module.exports = router;