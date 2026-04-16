// 📁 src/middlewares/injectDb.js
/* eslint-disable no-console */
"use strict";

// ✅ compatível:
// module.exports = db
// OU
// module.exports = { db }
const dbModule = require("../db");
const defaultDb = dbModule?.db ?? dbModule;

function isValidDb(instance) {
  return !!instance && typeof instance.query === "function";
}

/**
 * Middleware que injeta a instância do DB em req.db
 * - Não sobrescreve req.db se já estiver válido
 * - Usa como padrão o adapter central de src/db/index.js
 */
function injectDb(req, _res, next) {
  try {
    // ✅ respeita req.db já injetado (ex.: transação, testes, middlewares específicos)
    if (isValidDb(req.db)) {
      return next();
    }

    if (!isValidDb(defaultDb)) {
      console.error("[injectDb] DB não inicializado ou inválido.");
      const err = new Error(
        "DB não inicializado no middleware injectDb. Verifique src/db/index.js e a ordem de app.use()."
      );
      err.status = 500;
      return next(err);
    }

    req.db = defaultDb;
    return next();
  } catch (error) {
    console.error("[injectDb] erro inesperado:", error?.message || error);
    const err = new Error("Falha ao injetar DB.");
    err.status = 500;
    return next(err);
  }
}

module.exports = injectDb;
module.exports.injectDb = injectDb;
module.exports.injectDbMiddleware = injectDb;