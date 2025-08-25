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
  // max: Number(process.env.PGPOOL_MAX || 10),
  // idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('🔴 Erro inesperado no pool:', err);
});

// Consulta simples
async function query(text, params) {
  if (process.env.LOG_SQL === 'true') {
    console.log('🔎 SQL:', text, params || '');
  }
  return pool.query(text, params);
}

// ➕ Pega um client para transações (BEGIN/COMMIT/ROLLBACK)
async function getClient() {
  const client = await pool.connect();
  return client;
}

// (opcional) Encerrar pool com graça
function shutdown() {
  return pool.end();
}

module.exports = {
  pool,
  query,
  getClient,  // 👈 agora existe
  shutdown,   // opcional
};
