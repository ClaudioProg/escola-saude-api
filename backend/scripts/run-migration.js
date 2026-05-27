// 📁 scripts/run-migration.js — v2.0
/* eslint-disable no-console */
"use strict";

/**
 * Plataforma Escola da Saúde
 * Runner oficial de migrações SQL PostgreSQL
 *
 * Uso:
 *   node scripts/run-migration.js --file db/migration/2026-05-11-ajuste.sql
 *   node scripts/run-migration.js --dir db/migration --pattern "2026-*.sql"
 *   node scripts/run-migration.js --file x.sql --dry-run
 *
 * Flags:
 *   --file, -f       Caminho para um .sql. Pode repetir.
 *   --dir, -d        Pasta com arquivos .sql.
 *   --pattern, -p    Glob simples aplicado ao nome do arquivo dentro de --dir.
 *   --timeout, -t    statement_timeout em ms. Default: 60000.
 *   --ssl            Força SSL relaxed.
 *   --no-ssl         Desativa SSL.
 *   --verbose, -v    Logs detalhados.
 *   --dry-run        Mostra o plano sem conectar e sem executar.
 *   --force          Executa mesmo se a migração já estiver registrada.
 *
 * Contrato operacional:
 *   - Sem fallback legado.
 *   - Sem alias de caminho antigo.
 *   - Sem execução implícita.
 *   - Toda migração aplicada é registrada em public.sistema_migracao.
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const DEFAULT_TIMEOUT_MS = 60000;
const MIGRATION_TABLE = "sistema_migracao";

(async function main() {
  const startedAt = Date.now();

  try {
    const args = parseArgs(process.argv.slice(2));
    const log = makeLogger(args.verbose);

    const files = await resolveFiles(args, log);

    if (files.length === 0) {
      fail(
        "Nenhum arquivo .sql encontrado. Use --file caminho.sql ou --dir db/migration."
      );
    }

    banner();

    console.log("🗂️  Arquivos encontrados:", files.length);
    files.forEach((file, index) => {
      console.log(`   ${String(index + 1).padStart(2, "0")} • ${file}`);
    });

    if (args.dryRun) {
      console.log("\n💡 Modo dry-run: nada será aplicado ao banco.");
      console.log("✅ Plano validado com sucesso.");
      return;
    }

    const connectionString = getConnectionString();

    if (!connectionString) {
      fail(
        "DATABASE_URL não encontrada no ambiente. Defina DATABASE_URL antes de executar migrações."
      );
    }

    const ssl = decideSSL(connectionString, args);
    const timeout = toInt(args.timeout, DEFAULT_TIMEOUT_MS);

    console.log("\n🔗 Alvo:", redactUrl(connectionString));
    console.log("🔒 SSL:", ssl ? "on (relaxed)" : "off");
    console.log("⏳ statement_timeout:", `${timeout}ms`);
    console.log("🧾 Registro:", `public.${MIGRATION_TABLE}`);
    console.log("⚙️  Force:", args.force ? "sim" : "não");

    const pool = new Pool({
      connectionString,
      ssl,
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 15000,
    });

    const client = await pool.connect();

    try {
      await client.query(`SET statement_timeout = $1;`, [timeout]);

      await printDatabaseDiagnostic(client, args.verbose);

      await ensureMigrationTable(client);

      for (const fullPath of files) {
        await applyFile(client, fullPath, {
          force: args.force,
          log,
        });
      }

      console.log("\n✅ Todas as migrações concluídas sem erros.");

      const secs = ((Date.now() - startedAt) / 1000).toFixed(2);
      console.log(`⏱️  Tempo total: ${secs}s`);
    } finally {
      client.release();
      await pool.end().catch(() => {});
    }
  } catch (err) {
    console.error("\n❌ Falha na migração:");
    prettyPgError(err);
    process.exitCode = 1;
  }
})();

/* ─────────────────────────────────────────
   Argumentos
───────────────────────────────────────── */

function parseArgs(argv) {
  const out = {
    file: [],
    dir: null,
    pattern: "*",
    timeout: undefined,
    verbose: false,
    dryRun: false,
    ssl: false,
    noSsl: false,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    const readNext = (flag) => {
      const value = argv[i + 1];

      if (!value || /^-.+/.test(value)) {
        fail(`A flag ${flag} exige um valor.`);
      }

      i += 1;
      return value;
    };

    if (arg === "--file" || arg === "-f") {
      out.file.push(readNext(arg));
    } else if (arg === "--dir" || arg === "-d") {
      out.dir = readNext(arg);
    } else if (arg === "--pattern" || arg === "-p") {
      out.pattern = readNext(arg);
    } else if (arg === "--timeout" || arg === "-t") {
      out.timeout = readNext(arg);
    } else if (arg === "--ssl") {
      out.ssl = true;
    } else if (arg === "--no-ssl") {
      out.noSsl = true;
    } else if (arg === "--verbose" || arg === "-v") {
      out.verbose = true;
    } else if (arg === "--dry-run") {
      out.dryRun = true;
    } else if (arg === "--force") {
      out.force = true;
    } else if (/^-.+/.test(arg)) {
      fail(`Flag desconhecida: ${arg}`);
    } else {
      out.file.push(arg);
    }
  }

  if (out.ssl && out.noSsl) {
    fail("Use apenas uma opção: --ssl ou --no-ssl.");
  }

  return out;
}

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);

  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }

  return n;
}

function makeLogger(verbose) {
  return {
    debug: (...args) => {
      if (verbose) {
        console.log("[debug]", ...args);
      }
    },
  };
}

/* ─────────────────────────────────────────
   Arquivos
───────────────────────────────────────── */

async function resolveFiles(args, log) {
  const files = new Set();

  for (const file of args.file || []) {
    if (!file) continue;

    const fullPath = path.resolve(process.cwd(), file);

    if (!(await exists(fullPath))) {
      fail(`Arquivo não encontrado: ${fullPath}`);
    }

    if (!(await isFile(fullPath))) {
      fail(`O caminho informado não é arquivo: ${fullPath}`);
    }

    if (!fullPath.toLowerCase().endsWith(".sql")) {
      fail(`O arquivo precisa ter extensão .sql: ${fullPath}`);
    }

    files.add(fullPath);
  }

  if (args.dir) {
    const dir = path.resolve(process.cwd(), args.dir);

    if (!(await exists(dir))) {
      fail(`Diretório não encontrado: ${dir}`);
    }

    if (!(await isDirectory(dir))) {
      fail(`O caminho informado não é diretório: ${dir}`);
    }

    const list = await fsp.readdir(dir);
    const regex = globToRegex(args.pattern || "*");

    const matched = list
      .filter((name) => regex.test(name))
      .filter((name) => name.toLowerCase().endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((name) => path.join(dir, name));

    log.debug("arquivos encontrados no diretório:", matched);

    matched.forEach((file) => files.add(file));
  }

  return Array.from(files);
}

function globToRegex(glob) {
  const safe = String(glob || "*")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${safe}$`, "i");
}

async function exists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function isFile(filePath) {
  const stat = await fsp.stat(filePath);
  return stat.isFile();
}

async function isDirectory(filePath) {
  const stat = await fsp.stat(filePath);
  return stat.isDirectory();
}

/* ─────────────────────────────────────────
   Banco
───────────────────────────────────────── */

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.RENDER_EXTERNAL_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ""
  );
}

function decideSSL(connectionString, args) {
  if (args.ssl) {
    return { rejectUnauthorized: false };
  }

  if (args.noSsl) {
    return false;
  }

  const envSSL = String(process.env.DATABASE_SSL || "").toLowerCase() === "true";

  const urlRequiresSSL =
    /sslmode=require/i.test(connectionString) ||
    /render\.com/i.test(connectionString) ||
    /neon\.tech/i.test(connectionString);

  return envSSL || urlRequiresSSL ? { rejectUnauthorized: false } : false;
}

async function printDatabaseDiagnostic(client, verbose) {
  const { rows } = await client.query(`
    SELECT
      version() AS version,
      current_database() AS database_name,
      current_schema() AS schema_name,
      now() AS server_time
  `);

  const diagnostic = rows?.[0] || {};

  console.log(
    `\n🧪 Conectado → db=${diagnostic.database_name} schema=${diagnostic.schema_name} at=${new Date(
      diagnostic.server_time
    ).toISOString()}`
  );

  if (verbose && diagnostic.version) {
    console.log(`   ${String(diagnostic.version).split("\n")[0]}`);
  }
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.${MIGRATION_TABLE} (
      id BIGSERIAL PRIMARY KEY,
      arquivo TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      aplicada_em TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
      tempo_ms INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT ${MIGRATION_TABLE}_arquivo_sha256_key UNIQUE (arquivo, sha256)
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_${MIGRATION_TABLE}_arquivo
      ON public.${MIGRATION_TABLE} (arquivo);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_${MIGRATION_TABLE}_aplicada_em
      ON public.${MIGRATION_TABLE} (aplicada_em DESC);
  `);
}

/* ─────────────────────────────────────────
   Aplicação
───────────────────────────────────────── */

async function applyFile(client, fullPath, options = {}) {
  const force = Boolean(options.force);
  const name = path.basename(fullPath);

  const sql = await fsp.readFile(fullPath, "utf8");
  const trimmed = sql.trim();

  if (!trimmed) {
    fail(`Arquivo SQL vazio: ${fullPath}`);
  }

  const sha256 = crypto.createHash("sha256").update(sql).digest("hex");
  const shortHash = sha256.slice(0, 12);

  console.log(`\n▶️  Migração: ${name}`);
  console.log(`   sha256: ${shortHash}`);

  const alreadyApplied = await findAppliedMigration(client, {
    arquivo: name,
    sha256,
  });

  if (alreadyApplied && !force) {
    console.log(
      `⏭️  Ignorada: já aplicada em ${formatDateTime(
        alreadyApplied.aplicada_em
      )}. Use --force para executar novamente.`
    );
    return;
  }

  const hasTransaction = sqlHasOwnTransaction(trimmed);
  const sqlToRun = hasTransaction ? trimmed : `BEGIN;\n${trimmed}\nCOMMIT;`;

  const startedAt = Date.now();

  try {
    await client.query(sqlToRun);

    const elapsedMs = Date.now() - startedAt;

    await registerAppliedMigration(client, {
      arquivo: name,
      sha256,
      tempo_ms: elapsedMs,
    });

    console.log(`✅ OK (${elapsedMs}ms)`);
  } catch (err) {
    console.error(`❌ Erro em ${name}`);
    prettyPgError(err);
    throw err;
  }
}

function sqlHasOwnTransaction(sql) {
  const hasBegin = /^\s*BEGIN\b/i.test(sql);
  const hasCommit = /\bCOMMIT\s*;?\s*$/i.test(sql);

  return hasBegin && hasCommit;
}

async function findAppliedMigration(client, { arquivo, sha256 }) {
  const { rows } = await client.query(
    `
      SELECT id, arquivo, sha256, aplicada_em, tempo_ms
      FROM public.${MIGRATION_TABLE}
      WHERE arquivo = $1
        AND sha256 = $2
      ORDER BY aplicada_em DESC
      LIMIT 1
    `,
    [arquivo, sha256]
  );

  return rows?.[0] || null;
}

async function registerAppliedMigration(client, { arquivo, sha256, tempo_ms }) {
  await client.query(
    `
      INSERT INTO public.${MIGRATION_TABLE} (
        arquivo,
        sha256,
        tempo_ms
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (arquivo, sha256)
      DO UPDATE SET
        aplicada_em = now(),
        tempo_ms = EXCLUDED.tempo_ms
    `,
    [arquivo, sha256, tempo_ms]
  );
}

/* ─────────────────────────────────────────
   Saída / diagnóstico
───────────────────────────────────────── */

function prettyPgError(err) {
  const status = err?.code ? `code: ${err.code}\n` : "";
  const message = err?.message ? `${err.message}\n` : `${String(err)}\n`;
  const position = err?.position ? `position: ${err.position}\n` : "";
  const detail = err?.detail ? `detail: ${err.detail}\n` : "";
  const hint = err?.hint ? `hint: ${err.hint}\n` : "";
  const constraint = err?.constraint ? `constraint: ${err.constraint}\n` : "";
  const table = err?.table ? `table: ${err.table}\n` : "";
  const column = err?.column ? `column: ${err.column}\n` : "";

  console.error(
    message + status + table + column + constraint + position + detail + hint
  );
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.username) {
      parsed.username = "****";
    }

    if (parsed.password) {
      parsed.password = "***";
    }

    return parsed.toString();
  } catch {
    return "(URL inválida)";
  }
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function banner() {
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "   🛠️  Runner Oficial de Migração SQL — Escola da Saúde       \n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}

function fail(message) {
  const error = new Error(message);
  error.isOperational = true;
  throw error;
}