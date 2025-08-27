// scripts/run-migration.js
import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Render exige SSL
  });

  try {
    await client.connect();

    const migrationPath = path.resolve("db/migrations/2025-08-27-inscricoes-multipla-congresso.sql");
    console.log("▶️ Aplicando migração:", migrationPath);

    const sql = fs.readFileSync(migrationPath, "utf8");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("✅ Migração aplicada com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao aplicar migração:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
