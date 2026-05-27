// 📁 src/middlewares/injectDb.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 * Middleware oficial de injeção do banco em req.db
 *
 * Contrato oficial:
 * - db é exportado diretamente por src/db/index.js
 * - req.db recebe a façade oficial do banco
 *
 * Uso:
 *   const injectDb = require("./middlewares/injectDb");
 *   app.use(injectDb);
 *
 * Não usar:
 * - module.exports = { db }
 * - dbModule.db
 * - injectDbMiddleware
 * - múltiplos aliases de exportação
 */

const db = require("../db");

function isValidDb(instance) {
  return Boolean(instance) && typeof instance.query === "function";
}

function buildInjectDbError(message) {
  const error = new Error(message);
  error.status = 500;
  error.code = "DB_INJECT_FAILED";
  return error;
}

/**
 * Injeta a instância oficial do banco em req.db.
 *
 * Observação:
 * - Não sobrescreve req.db válido para permitir testes ou transações controladas.
 */
function injectDb(req, _res, next) {
  try {
    if (isValidDb(req.db)) {
      return next();
    }

    if (!isValidDb(db)) {
      console.error("[injectDb] DB oficial inválido ou não inicializado.");

      return next(
        buildInjectDbError(
          "DB oficial inválido no middleware injectDb. Verifique src/db/index.js."
        )
      );
    }

    req.db = db;
    return next();
  } catch (error) {
    console.error("[injectDb] erro inesperado:", {
      message: error?.message,
      code: error?.code,
    });

    return next(buildInjectDbError("Falha ao injetar DB na requisição."));
  }
}

module.exports = injectDb;