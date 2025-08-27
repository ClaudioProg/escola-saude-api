// scripts/run-migration.js
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

(async function main() {
  const file = path.join(__dirname, '..', 'db', 'migrations', '2025-08-27-inscricoes-multipla-congresso.sql');
  const sql = fs.readFileSync(file, 'utf8');

  // Pegamos a URL do banco do ambiente (Render tem DATABASE_URL)
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.RENDER_EXTERNAL_DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL não encontrada no ambiente (Render).');
  }

  // SSL apenas quando necessário (Render exige; local geralmente não)
  let ssl = false;
  const mustSSL =
    /render\.com/i.test(connectionString) ||
    /sslmode=require/i.test(connectionString) ||
    String(process.env.DATABASE_SSL).toLowerCase() === 'true';

  if (mustSSL) {
    ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool({ connectionString, ssl });

  const client = await pool.connect();
  try {
    console.log('▶️  Aplicando migração:', file);
    await client.query(sql); // arquivo já contém BEGIN/COMMIT
    console.log('✅ Migração aplicada com sucesso!');
  } catch (err) {
    console.error('❌ Falha na migração:', err?.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
