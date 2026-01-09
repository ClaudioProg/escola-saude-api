// 📁 src/middlewares/injectDb.js
/* eslint-disable no-console */

// ✅ compatível: module.exports = db  OU  module.exports = { db }
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/**
 * Middleware que injeta a instância do DB em req.db
 * - Não sobrescreve req.db se já estiver setado
 * - Valida pelo método `.query` (mais universal)
 */
function injectDbMiddleware(req, _res, next) {
  try {
    // se já existe (ex: tx middleware, testes), respeita
    if (req.db && typeof req.db.query === "function") return next();

    if (!db || typeof db.query !== "function") {
      console.error("[injectDb] Erro: DB não inicializado ou inválido.");
      const err = new Error(
        "DB não inicializado no middleware injectDb. Verifique src/db/index.js e a ordem de app.use()."
      );
      err.status = 500;
      return next(err);
    }

    req.db = db;
    return next();
  } catch (e) {
    console.error("[injectDb] erro inesperado:", e?.message || e);
    const err = new Error("Falha ao injetar DB.");
    err.status = 500;
    return next(err);
  }
}

module.exports = injectDbMiddleware;
