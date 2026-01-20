// scripts/run-migration.js
/* eslint-disable no-console */
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { Pool } = require("pg");
const crypto = require("crypto");

/**
 * Uso:
 *  node scripts/run-migration.js --file db/migrations/2025-08-27-abc.sql
 *  node scripts/run-migration.js --dir db/migrations --pattern "2025-*.sql"
 *  node scripts/run-migration.js --file x.sql --dry-run
 *
 * Flags:
 *  --file, -f      Caminho para um .sql (pode repetir a flag)
 *  --dir, -d       Pasta com .sql
 *  --pattern, -p   Glob simples (asterisco *) aplicado ao nome do arquivo dentro de --dir
 *  --timeout, -t   statement_timeout em ms (default 60000)
 *  --ssl           força SSL (rejectUnauthorized=false)
 *  --no-ssl        desativa SSL mesmo se URL do Render
 *  --verbose, -v   logs detalhados
 *  --dry-run       não executa no banco; só mostra o plano
 */

(async function main() {
  const startedAt = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const log = makeLogger(args.verbose);

  const files = await resolveFiles(args, log);
  if (files.length === 0) {
    console.error("Nenhum arquivo .sql encontrado. Use --file ou --dir/--pattern.");
    process.exit(2);
  }

  // Conexão (Render usa DATABASE_URL / RENDER_EXTERNAL_DATABASE_URL)
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.RENDER_EXTERNAL_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    "";

  if (!connectionString) {
    console.error("❌ DATABASE_URL não encontrada no ambiente.");
    process.exit(2);
  }

  const ssl = decideSSL(connectionString, args);
  const timeout = toInt(args.timeout, 60000);

  banner();
  console.log("🔗 Alvo:", redactUrl(connectionString));
  console.log("🔒 SSL:", ssl ? "on (relaxed)" : "off");
  console.log("⏳ statement_timeout:", `${timeout}ms`);
  console.log("🗂️  Arquivos:", files.length);
  files.forEach((f, i) => console.log(`   ${String(i + 1).padStart(2, "0")} • ${f}`));
  if (args.dryRun) {
    console.log("\n💡 Modo dry-run: nada será aplicado ao banco.");
    process.exit(0);
  }

  const pool = new Pool({ connectionString, ssl });
  const client = await pool.connect();

  try {
    await client.query(`SET statement_timeout = ${timeout};`);

    // Peq. diagnóstico
    const { rows } = await client.query(
      `select version(), current_database() as db, current_schema() as schema, now() as ts`
    );
    const diag = rows?.[0] || {};
    console.log(
      `\n🧪 Conectado → db=${diag.db} schema=${diag.schema} at ${new Date(diag.ts).toISOString()}`
    );
    if (args.verbose) console.log(`   ${String(diag.version).split("\n")[0]}`);

    // Executa cada arquivo em ordem
    for (const full of files) {
      await applyFile(client, full, log);
    }

    console.log("\n✅ Todas as migrações concluídas sem erros.");
    const secs = ((Date.now() - startedAt) / 1000).toFixed(2);
    console.log(`⏱️  Tempo total: ${secs}s`);
  } catch (err) {
    console.error("\n❌ Falha na migração:");
    prettyPgError(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
})();

/* ───────────────────────────────────────── helpers ───────────────────────────────────────── */

function parseArgs(argv) {
  const out = { file: [], pattern: "*", timeout: undefined, verbose: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];

    if (a === "--file" || a === "-f") out.file.push(next());
    else if (a === "--dir" || a === "-d") out.dir = next();
    else if (a === "--pattern" || a === "-p") out.pattern = next();
    else if (a === "--timeout" || a === "-t") out.timeout = next();
    else if (a === "--ssl") out.ssl = true;
    else if (a === "--no-ssl") out.noSsl = true;
    else if (a === "--verbose" || a === "-v") out.verbose = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (/^-.+/.test(a)) {
      console.warn(`(ignorado) flag desconhecida: ${a}`);
    } else {
      // argumento posicional tratado como --file
      out.file.push(a);
    }
  }
  return out;
}

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function makeLogger(verbose) {
  return {
    debug: (...x) => verbose && console.log("[debug]", ...x),
  };
}

async function resolveFiles(args, log) {
  const files = new Set();

  // via --file (pode repetir)
  for (const f of args.file || []) {
    if (!f) continue;
    const full = path.resolve(process.cwd(), f);
    if (await exists(full)) {
      files.add(full);
    } else {
      console.warn(`(ignorado) arquivo não encontrado: ${full}`);
    }
  }

  // via --dir + --pattern
  if (args.dir) {
    const dir = path.resolve(process.cwd(), args.dir);
    if (!(await exists(dir))) {
      console.warn(`(ignorado) diretório não encontrado: ${dir}`);
    } else {
      const list = await fsp.readdir(dir);
      const re = globToRegex(args.pattern || "*");
      list
        .filter((n) => re.test(n) && n.toLowerCase().endsWith(".sql"))
        .sort()
        .forEach((n) => files.add(path.join(dir, n)));
    }
  }

  // fallback legado (compat): caminho padrão do exemplo do projeto
  if (files.size === 0 && !args.dir && (!args.file || args.file.length === 0)) {
    const legacy = path.join(
      __dirname,
      "..",
      "db",
      "migrations",
      "2025-08-27-inscricao-multipla-congresso.sql"
    );
    if (await exists(legacy)) {
      log.debug("usando caminho legado:", legacy);
      files.add(legacy);
    }
  }

  return Array.from(files);
}

function globToRegex(glob) {
  // suporte simples: * → qualquer sequência
  const safe = String(glob || "*").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${safe}$`, "i");
}

function decideSSL(connectionString, args) {
  if (args.ssl) return { rejectUnauthorized: false };
  if (args.noSsl) return false;
  const mustSSL =
    /render\.com/i.test(connectionString) ||
    /sslmode=require/i.test(connectionString) ||
    String(process.env.DATABASE_SSL || "").toLowerCase() === "true";
  return mustSSL ? { rejectUnauthorized: false } : false;
}

async function applyFile(client, full, log) {
  const name = path.basename(full);
  const sql = await fsp.readFile(full, "utf8");
  const digest = crypto.createHash("sha256").update(sql).digest("hex").slice(0, 12);

  console.log(`\n▶️  Aplicando: ${name}  (sha256:${digest})`);

  const trimmed = sql.trim();
  const hasBegin = /^\s*BEGIN\b/i.test(trimmed);
  const hasCommit = /\bCOMMIT\s*;?\s*$/i.test(trimmed);

  // Se o arquivo já contém transação, executa direto.
  // Caso contrário, envolve em BEGIN/COMMIT para garantir atomicidade.
  const toRun = hasBegin && hasCommit ? trimmed : `BEGIN;\n${trimmed}\nCOMMIT;`;

  try {
    const t0 = Date.now();
    await client.query(toRun);
    const ms = Date.now() - t0;
    console.log(`✅ OK (${ms}ms)`);
  } catch (err) {
    console.error(`❌ Erro em ${name}`);
    prettyPgError(err);
    // rethrow para parar o fluxo
    throw err;
  }
}

function prettyPgError(err) {
  // Mostra informações úteis sem vazar segredos
  const fields = err?.position || err?.detail || err?.hint ? "\n" : "";
  console.error(
    (err?.message || String(err)) + fields +
      (err?.position ? `pos: ${err.position}\n` : "") +
      (err?.detail ? `detail: ${err.detail}\n` : "") +
      (err?.hint ? `hint: ${err.hint}\n` : "")
  );
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = "****";
    return u.toString();
  } catch {
    return "(URL inválida)";
  }
}

async function exists(p) {
  try {
    await fsp.access(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function banner() {
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
      "   🛠️  Runner de Migrações SQL — Escola da Saúde (PG)        \n" +
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
}
