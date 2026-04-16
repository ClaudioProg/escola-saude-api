// src/db/index.js
/* eslint-disable no-console */
"use strict";

const { Pool } = require("pg");

// ✅ dotenv só em dev
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line global-require
  require("dotenv").config();
}

/* ──────────────────────────────────────────────────────────────
   Env / Config
────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";
const DATABASE_URL = String(process.env.DATABASE_URL || "").trim();

if (!DATABASE_URL) {
  console.error("❌ [db] DATABASE_URL não está definida no ambiente.");
  process.exit(1);
}

function parseBoolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
}

const inferredSsl =
  process.env.DATABASE_SSL !== undefined
    ? parseBoolEnv(process.env.DATABASE_SSL, false)
    : IS_PROD;

const sslOption = inferredSsl ? { rejectUnauthorized: false } : undefined;

const POOL_MAX = Math.max(1, Number(process.env.DB_POOL_MAX || 20));
const IDLE_TIMEOUT_MS = Math.max(1000, Number(process.env.DB_IDLE_TIMEOUT_MS || 30000));
const CONNECTION_TIMEOUT_MS = Math.max(1000, Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000));

/* ──────────────────────────────────────────────────────────────
   Logging helpers
────────────────────────────────────────────────────────────── */
function shouldLogSql() {
  return String(process.env.LOG_SQL || "").trim().toLowerCase() === "true";
}

function shouldLogSlowSql() {
  return String(process.env.LOG_SLOW_SQL || "true").trim().toLowerCase() !== "false";
}

function getSlowSqlThresholdMs() {
  const n = Number(process.env.LOG_SLOW_SQL_MS || 700);
  return Number.isFinite(n) && n > 0 ? n : 700;
}

function shrinkWhitespace(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim();
}

function redactValue(value) {
  if (value === null || value === undefined) return value;

  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} bytes]`;
  }

  if (typeof value === "string") {
    const s = value.trim();

    if (!s) return s;

    // JWT / tokens / base64 longos / blobs textuais
    if (s.length > 120) return "[REDACTED_LONG_STRING]";

    // data URLs/base64
    if (/^data:.*;base64,/i.test(s)) return "[REDACTED_DATA_URL]";

    // bearer / token-like
    if (/^eyJ[A-Za-z0-9_\-]+=*\./.test(s) || s.toLowerCase().includes("bearer ")) {
      return "[REDACTED_TOKEN]";
    }

    return s;
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return "[REDACTED_OBJECT]";
    }
  }

  return value;
}

function redactParams(params) {
  if (!Array.isArray(params)) return params;
  try {
    return params.map(redactValue);
  } catch {
    return "[REDACTED_PARAMS]";
  }
}

function makeQueryError(message, extra = {}) {
  const err = new Error(message);
  Object.assign(err, extra);
  return err;
}

/* ──────────────────────────────────────────────────────────────
   Pool
────────────────────────────────────────────────────────────── */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslOption,
  max: POOL_MAX,
  idleTimeoutMillis: IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
});

pool.on("error", (err) => {
  console.error("🔴 [db] Erro inesperado no pool:", {
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });
});

/* ──────────────────────────────────────────────────────────────
   Query executor
────────────────────────────────────────────────────────────── */
async function executeQuery(clientOrPool, text, params) {
  const sql = String(text || "");
  const startedAt = Date.now();

  try {
    if (shouldLogSql()) {
      console.log("🔎 [db][sql]", {
        text: shrinkWhitespace(sql),
        params: redactParams(params ?? []),
      });
    }

    const runner =
      clientOrPool?.query && typeof clientOrPool.query === "function"
        ? clientOrPool.query.bind(clientOrPool)
        : pool.query.bind(pool);

    const result = await runner(sql, params);

    const elapsed = Date.now() - startedAt;

    if (shouldLogSlowSql() && elapsed >= getSlowSqlThresholdMs()) {
      console.warn(`🐢 [db][slow ${elapsed}ms]`, {
        text: shrinkWhitespace(sql),
        params: redactParams(params ?? []),
        rowCount: result?.rowCount ?? null,
      });
    }

    return result;
  } catch (err) {
    const elapsed = Date.now() - startedAt;

    console.error("🔴 [db][query-error]", {
      ms: elapsed,
      code: err?.code,
      message: err?.message,
      detail: err?.detail,
      constraint: err?.constraint,
      table: err?.table,
      column: err?.column,
      text: shrinkWhitespace(sql),
      params: redactParams(params ?? []),
    });

    throw err;
  }
}

/* ──────────────────────────────────────────────────────────────
   Adapter compatível
────────────────────────────────────────────────────────────── */
function makeExec(clientOrPool) {
  const exec = (text, params = []) => executeQuery(clientOrPool, text, params);

  return {
    // pg style
    query: (text, params = []) => exec(text, params),

    // pg-promise-like
    any: async (text, params = []) => {
      const { rows } = await exec(text, params);
      return rows || [];
    },

    manyOrNone: async (text, params = []) => {
      const { rows } = await exec(text, params);
      return rows || [];
    },

    one: async (text, params = []) => {
      const { rows } = await exec(text, params);
      const len = rows?.length || 0;

      if (len !== 1) {
        throw makeQueryError(`Expected one row, got ${len}`, {
          code: "DB_EXPECTED_ONE",
          rowCount: len,
        });
      }

      return rows[0];
    },

    oneOrNone: async (text, params = []) => {
      const { rows } = await exec(text, params);
      const len = rows?.length || 0;

      if (len === 0) return null;

      if (len > 1) {
        throw makeQueryError(`Expected at most one row, got ${len}`, {
          code: "DB_EXPECTED_ONE_OR_NONE",
          rowCount: len,
        });
      }

      return rows[0];
    },

    none: async (text, params = []) => {
      await exec(text, params);
      return null;
    },

    result: (text, params = []) => exec(text, params),
  };
}

/* ──────────────────────────────────────────────────────────────
   Helpers de conexão e transação
────────────────────────────────────────────────────────────── */
async function connect() {
  return pool.connect();
}

async function getClient() {
  return pool.connect();
}

async function tx(callback) {
  if (typeof callback !== "function") {
    throw new Error("db.tx requer um callback.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transaction = {
      ...makeExec(client),
      raw: client,
      client,
    };

    const result = await callback(transaction);

    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      console.error("🔴 [db] Falha no ROLLBACK:", {
        message: rollbackErr?.message,
        code: rollbackErr?.code,
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

async function shutdown() {
  return pool.end();
}

/* ──────────────────────────────────────────────────────────────
   Main export
────────────────────────────────────────────────────────────── */
const main = {
  ...makeExec(pool),

  pool,
  connect,
  getClient,
  tx,
  shutdown,
};

/* ──────────────────────────────────────────────────────────────
   Exports compat
────────────────────────────────────────────────────────────── */
module.exports = main;
module.exports.db = main;
module.exports.pool = pool;

module.exports.query = main.query;
module.exports.any = main.any;
module.exports.manyOrNone = main.manyOrNone;
module.exports.one = main.one;
module.exports.oneOrNone = main.oneOrNone;
module.exports.none = main.none;
module.exports.result = main.result;

module.exports.connect = connect;
module.exports.getClient = getClient;
module.exports.tx = tx;
module.exports.shutdown = shutdown;