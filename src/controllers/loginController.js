// 📁 src/controllers/loginController.js — PREMIUM (seguro, resiliente, anti-enumeração, cookie robusto)
/* eslint-disable no-console */
const dbMod = require("../db");
const bcrypt = require("bcrypt");
const generateToken = require("../auth/generateToken");
const formatarPerfil = require("../utils/formatarPerfil");
const { gerarNotificacaoDeAvaliacao } = require("./notificacaoController");

// Compat: db pode exportar { query } ou pool etc.
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[loginController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em loginController.js (query ausente)");
}

const IS_PROD = process.env.NODE_ENV === "production";

/* ────────────────────────────────────────────────────────────────
   Logger util (RID)
   ──────────────────────────────────────────────────────────────── */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[AUTH][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (!IS_PROD) {
    if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
    return console.log(`${prefix} • ${msg}`, extra || "");
  }
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */
const digitsOnly = (v) => String(v || "").replace(/\D/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizeUserForResponse(u, perfilArray) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    perfil: perfilArray,
    imagem_base64: u.imagem_base64 || null,
  };
}

/**
 * 🎯 Login de usuário via CPF e senha
 * @route POST /api/usuarios/login
 * - Mensagem genérica para evitar enumeração (CPF existe vs não existe)
 * - Pequeno delay em caso de falha para reduzir brute-force
 * - Cookie httpOnly com atributos consistentes
 */
async function loginUsuario(req, res) {
  const rid = mkRid();

  try {
    const cpfRaw = req.body?.cpf;
    const senhaRaw = req.body?.senha;

    const cpf = digitsOnly(cpfRaw);
    const senha = typeof senhaRaw === "string" ? senhaRaw : String(senhaRaw || "");

    // ✅ validação básica (não vaza detalhe)
    if (!cpf || !senha) {
      return res.status(400).json({ erro: "CPF e senha são obrigatórios." });
    }

    // regra de sanidade: CPF deve ter 11 dígitos
    if (cpf.length !== 11) {
      // pequena espera para reduzir tentativas “rápidas”
      await sleep(150);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // 🔎 busca usuário + assinatura (se houver)
    // IMPORTANTE: seleciona apenas o necessário (evita vazar colunas sensíveis sem querer)
    const result = await query(
      `
      SELECT
        u.id, u.nome, u.email, u.cpf, u.perfil, u.senha,
        a.imagem_base64
      FROM usuarios u
      LEFT JOIN assinaturas a ON a.usuario_id = u.id
      WHERE u.cpf = $1
      LIMIT 1
      `,
      [cpf]
    );

    const usuario = result.rows?.[0];

    // Se não achou, não revela: comparação com hash "dummy" para timing mais consistente
    if (!usuario) {
      // hash dummy (senha "errada") — custo ~ igual ao compare real
      try {
        const dummyHash =
          "$2b$10$CwTycUXWue0Thq9StjUM0uJ8N9YqvYQx8rU0lE8r1W3sQ8v7r8E2S"; // bcrypt de "invalid"
        await bcrypt.compare(senha, dummyHash);
      } catch {}
      await sleep(120);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // 🔐 valida senha
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      await sleep(120);
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    }

    // 👤 perfil sempre array
    const perfilArray = formatarPerfil(usuario.perfil);

    // 🔑 JWT (helper do projeto)
    const token = generateToken({
      id: usuario.id,
      cpf: usuario.cpf,
      nome: usuario.nome,
      perfil: perfilArray,
    });

    // 🍪 Cookie httpOnly (sem cache e com defaults seguros)
    // Observação: sameSite "lax" é ótimo quando front e API estão no mesmo site.
    // Se você usar domínios diferentes + CORS com credenciais, talvez precise "none" + secure=true.
    res.cookie("token", token, {
      httpOnly: true,
      secure: IS_PROD, // true em HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
      path: "/",
    });

    // Header anti-cache (importante em login)
    res.set("Cache-Control", "no-store");

    // 🛎️ notifs de avaliação (best-effort)
    try {
      await gerarNotificacaoDeAvaliacao(usuario.id);
    } catch (e) {
      log(rid, "warn", "Falha ao gerar notificações de avaliação (não bloqueante)", e?.message || e);
    }

    log(rid, "info", "login OK", { usuarioId: usuario.id });

    // 📦 resposta padronizada
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
