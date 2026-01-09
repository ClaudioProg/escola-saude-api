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
  // Não derruba o app, mas deixa explícito no log
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
  // Aceita string, array, null (future-proof)
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
      return res.status(500).json({ erro: "Configuração do Google indisponível." });
    }
    if (!JWT_SECRET) {
      return res.status(500).json({ erro: "Configuração de autenticação indisponível." });
    }

    // 📥 Verifica token do Google
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() || {};

    // Checagens extras (boa prática)
    const email = normalizeEmail(payload.email);
    const nome = normalizeName(payload.name || payload.given_name);
    const emailVerified = payload.email_verified === true;

    if (!email) {
      return res.status(401).json({ erro: "Falha na autenticação com Google." });
    }

    // Em sistemas públicos, é recomendável exigir email verificado
    if (!emailVerified) {
      return res.status(401).json({ erro: "E-mail do Google não verificado." });
    }

    // 🔎 Busca usuário por email
    let result = await db.query(
      "SELECT id, nome, email, cpf, perfil FROM usuarios WHERE email = $1 LIMIT 1",
      [email]
    );

    // ➕ Se não existir, cria com defaults seguros
    if (result.rows.length === 0) {
      result = await db.query(
        `INSERT INTO usuarios (nome, email, cpf, senha, perfil)
         VALUES ($1, $2, NULL, NULL, 'usuario')
         RETURNING id, nome, email, cpf, perfil`,
        [nome, email]
      );
    } else {
      // Opcional premium: se o nome mudou no Google, você pode manter atualizado
      // sem sobrescrever nomes customizados (aqui mantemos simples e seguro).
      // Se quiser atualizar condicionalmente depois, eu preparo.
    }

    const usuario = result.rows[0];
    const perfil = normalizePerfil(usuario.perfil);

    // 🔐 JWT (inclui email para facilitar debug/auditoria)
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        cpf: usuario.cpf || null,
        nome: usuario.nome,
        perfil,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      perfil,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        cpf: usuario.cpf,
        perfil,
      },
    });
  } catch (err) {
    // Log com contexto, sem vazar token/credential
    console.error("🔴 [authGoogle] Erro ao autenticar:", err?.message || err);
    return res.status(401).json({ erro: "Falha na autenticação com Google." });
  }
});

module.exports = router;
