// 📁 src/db/index.js
/* eslint-disable no-console */
const { Pool } = require("pg");

// ✅ dotenv só em dev (em produção o host injeta env)
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line global-require
  require("dotenv").config();
}

/* =========================
   Env validation
========================= */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não está definida no ambiente.");
  process.exit(1);
}

// Se DATABASE_SSL não vier, tentamos inferir um default seguro:
const envSsl = process.env.DATABASE_SSL;
const inferredSsl =
  envSsl === "true"
    ? true
    : envSsl === "false"
      ? false
      : // fallback: em produção, normalmente precisa de SSL (Render/Neon/etc.)
        process.env.NODE_ENV === "production";

const sslOption = inferredSsl ? { rejectUnauthorized: false } : undefined;

// Logging SQL (com proteção básica)
function shouldLog() {
  return process.env.LOG_SQL === "true";
}

function redactParams(params) {
  if (!params) return params;
  try {
    // Redação simples: se for string grande (token), mascara
    return params.map((p) => {
      if (typeof p === "string" && p.length > 120) return "[REDACTED]";
      return p;
    });
  } catch {
    return params;
  }
}

/* =========================
   Pool
========================= */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslOption,
});

pool.on("error", (err) => {
  console.error("🔴 [db] Erro inesperado no pool:", err);
});

async function baseQuery(text, params) {
  if (shouldLog()) console.log("🔎 SQL:", text, redactParams(params ?? []));
  return pool.query(text, params);
}

/* ──────────────────────────────────────────────────────────────
   Adapter tipo pg-promise: any / one / oneOrNone / none / result
   ────────────────────────────────────────────────────────────── */
function makeExec(clientOrPool) {
  const q = clientOrPool?.query ? clientOrPool.query.bind(clientOrPool) : baseQuery;

  const exec = async (text, params) => {
    if (shouldLog()) console.log("🔎 SQL:", text, redactParams(params ?? []));
    return q(text, params);
  };

  return {
    // API pg “pura”
    query: (t, p) => exec(t, p),

    // API “pg-promise-like”
    any: async (t, p) => {
      const { rows } = await exec(t, p);
      return rows;
    },
    one: async (t, p) => {
      const { rows } = await exec(t, p);
      if (rows.length !== 1) throw new Error(`Expected one row, got ${rows.length}`);
      return rows[0];
    },
    oneOrNone: async (t, p) => {
      const { rows } = await exec(t, p);
      if (rows.length === 0) return null;
      if (rows.length > 1) throw new Error(`Expected at most one row, got ${rows.length}`);
      return rows[0];
    },
    none: async (t, p) => {
      await exec(t, p);
      return null;
    },
    result: (t, p) => exec(t, p),
  };
}

/* =========================
   Main DB (compat)
========================= */
const main = {
  ...makeExec(pool),

  // 🔑 compat: db.connect()
  connect: () => pool.connect(),

  // Transação: await db.tx(async (t) => { await t.query(...); })
  tx: async (cb) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const t = {
        ...makeExec(client),
        raw: client, // expõe o client se precisar
      };

      const ret = await cb(t);

      await client.query("COMMIT");
      return ret;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (e) {
        console.error("🔴 [db] Falha no ROLLBACK:", e?.message || e);
      }
      throw err;
    } finally {
      client.release();
    }
  },

  // utilitários
  pool,
  getClient: () => pool.connect(),
  shutdown: () => pool.end(),
};

// ── Exports compat (default + nomeado)
module.exports = main;     // const db = require("../db");
module.exports.db = main;  // const { db } = require("../db");
module.exports.pool = pool;

module.exports.query = main.query;
module.exports.tx = main.tx;
module.exports.connect = main.connect;
module.exports.getClient = main.getClient;
module.exports.shutdown = main.shutdown;
