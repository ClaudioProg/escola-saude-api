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

pool.connect()
  .then((client) => {
    if (process.env.LOG_DB === 'true') {
      console.log('🟢 Banco de dados conectado com sucesso!');
    }
    client.release();
  })
  .catch((err) => {
    console.error('🔴 Erro ao conectar com o banco de dados:', err.message);
    process.exit(1);
  });

const query = (text, params) => {
  if (process.env.LOG_SQL === 'true') {
    console.log('🔎 SQL:', text, params || '');
  }
  return pool.query(text, params);
};

// Exporte ambos!
module.exports = {
  pool,
  query,
};
