// 📁 src/middlewares/injectDb.js
/* eslint-disable no-console */
const { db } = require("../db");

/**
 * Middleware que injeta a instância global do DB em req.db
 * Garante compatibilidade com controladores antigos que usam req.db
 */
function injectDbMiddleware(req, _res, next) {
  if (!db || typeof db.any !== "function") {
    console.error("[injectDb] Erro: DB não inicializado ou inválido.");
    const err = new Error(
      "DB não inicializado no middleware injectDb. Verifique src/db/index.js e a ordem de app.use()."
    );
    err.status = 500;
    return next(err);
  }

  req.db = db;
  next();
}

module.exports = injectDbMiddleware;
