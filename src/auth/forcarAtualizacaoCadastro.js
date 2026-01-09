// 📁 src/auth/forcarAtualizacaoCadastro.js
/* eslint-disable no-console */

const dbModule = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

// ✅ compatível com exports: module.exports = db  OU  module.exports = { db }
const defaultDb = dbModule?.db ?? dbModule;

// ✅ cache curto para reduzir hits no DB durante navegação
// key: userId -> { incompleto: boolean, ts: number }
const CACHE = new Map();
const TTL_MS = 15_000; // 15s (ajuste se quiser)

function setExposeHeader(res, headerName) {
  // Para o frontend conseguir ler o header (CORS)
  const prev = res.getHeader("Access-Control-Expose-Headers");
  const list = String(prev || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!list.includes(headerName)) list.push(headerName);
  res.setHeader("Access-Control-Expose-Headers", list.join(", "));
}

async function forcarAtualizacaoCadastro(req, res, next) {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    // ✅ cache
    const cached = CACHE.get(userId);
    const now = Date.now();
    if (cached && now - cached.ts <= TTL_MS) {
      const incompleto = !!cached.incompleto;

      setExposeHeader(res, "X-Perfil-Incompleto");
      res.setHeader("X-Perfil-Incompleto", incompleto ? "1" : "0");

      req.perfilIncompleto = incompleto;
      res.locals.perfilIncompleto = incompleto;
      return next();
    }

    const db = req.db ?? defaultDb;

    const { rows } = await db.query(
      `SELECT id, cargo_id, unidade_id, data_nascimento, genero_id,
              orientacao_sexual_id, cor_raca_id, escolaridade_id, deficiencia_id
         FROM usuarios
        WHERE id = $1
        LIMIT 1`,
      [userId]
    );

    const u = rows[0];
    if (!u) {
      // Não é “não autenticado”; é “não encontrado”
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const incompleto = !!isPerfilIncompleto(u);

    // ✅ expõe o header pro frontend
    setExposeHeader(res, "X-Perfil-Incompleto");
    res.setHeader("X-Perfil-Incompleto", incompleto ? "1" : "0");

    // ✅ salva para uso em outras camadas
    req.perfilIncompleto = incompleto;
    res.locals.perfilIncompleto = incompleto;

    // ✅ cache
    CACHE.set(userId, { incompleto, ts: now });

    return next();
  } catch (e) {
    console.error("[forcarAtualizacaoCadastro] erro:", e?.message || e);
    // premium: não derruba a requisição
    return next();
  }
}

module.exports = forcarAtualizacaoCadastro;
