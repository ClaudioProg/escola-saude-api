// 📁 src/db/index.js
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL não está definida no .env");
  process.exit(1);
}

const sslOption =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOption,
});

pool.on("error", (err) => {
  console.error("🔴 Erro inesperado no pool:", err);
});

function shouldLog() {
  return process.env.LOG_SQL === "true";
}

async function baseQuery(text, params) {
  if (shouldLog()) console.log("🔎 SQL:", text, params ?? "");
  return pool.query(text, params);
}

/* ──────────────────────────────────────────────────────────────
   Adapter tipo pg-promise: any / one / oneOrNone / none / result
   ────────────────────────────────────────────────────────────── */
function makeExec(clientOrPool) {
  const exec = async (text, params) => {
    const q = clientOrPool?.query ? clientOrPool.query.bind(clientOrPool) : baseQuery;
    if (shouldLog()) console.log("🔎 SQL:", text, params ?? "");
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
      if (rows.length !== 1)
        throw new Error(`Expected one row, got ${rows.length}`);
      return rows[0];
    },
    oneOrNone: async (t, p) => {
      const { rows } = await exec(t, p);
      if (rows.length === 0) return null;
      if (rows.length > 1)
        throw new Error(`Expected at most one row, got ${rows.length}`);
      return rows[0];
    },
    none: async (t, p) => {
      await exec(t, p);
      return null;
    },
    result: (t, p) => exec(t, p),
  };
}

// ── Instância principal (compatível com o que você já usava)
const main = {
  ...makeExec(pool),

  // 🔑 Agora disponível (conserta “db.connect is not a function”)
  connect: () => pool.connect(),

  // Transação: await db.tx(async (t) => { await t.query(...); })
  tx: async (cb) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const t = {
        ...makeExec(client),
        // expoe query “pura” do client dentro da tx se precisar
        raw: client,
      };
      const ret = await cb(t);
      await client.query("COMMIT");
      return ret;
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch {}
      throw err;
    } finally {
      client.release();
    }
  },

  // Utilitários
  pool,
  getClient: () => pool.connect(),
  shutdown: () => pool.end(),
};

// ── Exports compat (default + nomeado)
module.exports = main;   // permite: const db = require("../db");
module.exports.db = main; // permite: const { db } = require("../db");
module.exports.pool = pool;
module.exports.query = main.query;
module.exports.tx = main.tx;
module.exports.connect = main.connect;
module.exports.getClient = main.getClient;
module.exports.shutdown = main.shutdown;
