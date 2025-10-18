// 📁 src/db/index.js
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida no .env');
  process.exit(1);
}

const sslOption =
  process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOption,
});

pool.on('error', (err) => {
  console.error('🔴 Erro inesperado no pool:', err);
});

async function query(text, params) {
  if (process.env.LOG_SQL === 'true') {
    console.log('🔎 SQL:', text, params || '');
  }
  return pool.query(text, params);
}

/* ──────────────────────────────────────────────────────────────
   Adapter tipo pg-promise: any / one / oneOrNone / none / tx / result
   ────────────────────────────────────────────────────────────── */
function makeExec(clientOrPool) {
  const exec = async (text, params) => {
    if (clientOrPool.query) return clientOrPool.query(text, params);
    return query(text, params);
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
      if (rows.length !== 1) {
        throw new Error(`Expected one row, got ${rows.length}`);
      }
      return rows[0];
    },

    oneOrNone: async (t, p) => {
      const { rows } = await exec(t, p);
      if (rows.length === 0) return null;
      if (rows.length > 1) {
        throw new Error(`Expected at most one row, got ${rows.length}`);
      }
      return rows[0];
    },

    none: async (t, p) => {
      await exec(t, p);
      return null;
    },

    // Compat com trechos que checam rowCount
    result: (t, p) => exec(t, p),
  };
}

// Instância “global” estilo db do pg-promise
const db = {
  ...makeExec(pool),

  // Transação estilo db.tx(async (t) => { ... })
  tx: async (cb) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // t herda os mesmos métodos, mas executa no client transacional
      const t = makeExec(client);

      const result = await cb(t);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      throw err;
    } finally {
      client.release();
    }
  },
};

async function getClient() {
  const client = await pool.connect();
  return client;
}

function shutdown() {
  return pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  shutdown,
  db, // 👈 importe `{ db }` no backend
};
