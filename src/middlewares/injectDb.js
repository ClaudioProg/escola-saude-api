// src/middlewares/injectDb.js
let dbInstance = null;

module.exports = function injectDb(dbArg) {
  // Aceita injeção explícita (ex.: require('./db').db) ou tenta resolver sozinho
  if (!dbInstance) {
    dbInstance = dbArg;
    if (!dbInstance) {
      try {
        const dbModule = require("../db");
        dbInstance = dbModule?.db ?? dbModule;
      } catch (e) {
        // vai revelar erro quando o primeiro request chegar
      }
    }
  }

  return function injectDbMiddleware(req, _res, next) {
    if (!dbInstance) {
      const err = new Error(
        "DB não inicializado no middleware injectDb. Verifique src/db/index.js e a ordem de app.use()."
      );
      err.status = 500;
      return next(err);
    }
    req.db = dbInstance;
    next();
  };
};
