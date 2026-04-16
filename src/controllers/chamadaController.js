/* eslint-disable no-console */
// ✅ src/controllers/chamadasController.js — PREMIUM+++
// - DB compat robusto (req.db -> fallback)
// - Logs com RID
// - Transações seguras
// - Upload em memória com validação forte
// - Date/time estável para prazo_final_br
// - Compat com pg e pg-promise
// - Download/proxy de modelo com cache/etag/range-safe básico
// - CRUD mais consistente e resiliente
"use strict";

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const url = require("url");
const mime = require("mime-types");
const multer = require("multer");
const crypto = require("crypto");
const { Readable } = require("stream");

const { MODELOS_CHAMADAS_DIR } = require("../paths");
const rawDb = require("../db");

const DB_FALLBACK = rawDb?.db ?? rawDb;
const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Upload em memória
=========================================================================== */
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* =========================================================================
   Logger premium
=========================================================================== */
function mkRid(prefix = "CHAM") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "CHAM") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }

  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }

  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* =========================================================================
   DB helpers
=========================================================================== */
function getDB(req) {
  return req?.db ?? DB_FALLBACK;
}

function hasFn(obj, name) {
  return typeof obj?.[name] === "function";
}

async function runQuery(DB, sql, params = []) {
  if (hasFn(DB, "query")) {
    return DB.query(sql, params);
  }

  if (hasFn(DB, "any")) {
    const upper = String(sql).trim().toUpperCase();

    if (upper.startsWith("SELECT")) {
      const rows = await DB.any(sql, params);
      return { rows, rowCount: rows.length };
    }

    if (/RETURNING/i.test(sql)) {
      const row = await DB.oneOrNone(sql, params);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }

    await DB.none(sql, params);
    return { rows: [], rowCount: 0 };
  }

  throw new Error("DB inválido: sem query/any.");
}

async function runOne(DB, sql, params = []) {
  if (hasFn(DB, "one")) return DB.one(sql, params);
  const r = await runQuery(DB, sql, params);
  return r?.rows?.[0] || null;
}

async function runOneOrNone(DB, sql, params = []) {
  if (hasFn(DB, "oneOrNone")) return DB.oneOrNone(sql, params);
  const r = await runQuery(DB, sql, params);
  return r?.rows?.[0] || null;
}

async function runAny(DB, sql, params = []) {
  if (hasFn(DB, "any")) return DB.any(sql, params);
  const r = await runQuery(DB, sql, params);
  return r?.rows || [];
}

async function runNone(DB, sql, params = []) {
  if (hasFn(DB, "none")) return DB.none(sql, params);
  await runQuery(DB, sql, params);
}

async function withTx(DB, fn) {
  if (hasFn(DB, "tx")) {
    return DB.tx(fn);
  }

  if (hasFn(DB, "query")) {
    await DB.query("BEGIN");

    try {
      const t = {
        query: DB.query.bind(DB),
        one: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows?.[0] || null;
        },
        any: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows || [];
        },
        none: async (sql, params) => {
          await DB.query(sql, params);
        },
        oneOrNone: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows?.[0] || null;
        },
      };

      const out = await fn(t);
      await DB.query("COMMIT");
      return out;
    } catch (e) {
      try {
        await DB.query("ROLLBACK");
      } catch {}
      throw e;
    }
  }

  const err = new Error("DB não suporta transação: sem tx/query.");
  err.status = 500;
  throw err;
}

/* =========================================================================
   Helpers gerais
=========================================================================== */
function assert(cond, msg, status = 400) {
  if (!cond) {
    const e = new Error(msg);
    e.status = status;
    throw e;
  }
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function withinLen(s, max) {
  return (
    typeof s === "string" &&
    String(s).trim().length > 0 &&
    String(s).trim().length <= max
  );
}

function isYYYYMM(s) {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function isHttpUrl(u) {
  try {
    const x = new url.URL(String(u));
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/* =========================================================================
   Regras / limites
=========================================================================== */
const LIMIT_MIN = 1;
const LIMIT_MAX = 5000;

function isValidLimits(limites) {
  if (!limites) return true;

  const keys = [
    "titulo",
    "introducao",
    "objetivos",
    "metodo",
    "resultados",
    "consideracao",
  ];

  for (const k of keys) {
    const v = Number(limites[k]);
    if (!Number.isInteger(v) || v < LIMIT_MIN || v > LIMIT_MAX) return false;
  }

  return true;
}

function normalizePrazoFragment(prazo_final_br) {
  const s = String(prazo_final_br || "").trim();

  const isIsoWithTz = /[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s);
  if (isIsoWithTz) {
    return { fragment: `($$PRAZO$$)::timestamptz`, param: s };
  }

  assert(
    /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(s),
    "prazo_final_br inválido."
  );

  const withSec = s.length === 16 ? `${s}:00` : s;

  return {
    fragment: `( ($$PRAZO$$)::timestamp AT TIME ZONE 'America/Sao_Paulo')`,
    param: withSec,
  };
}

function normalizeBool(v, fallback = false) {
  if (v == null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(s)) return true;
    if (["false", "0", "nao", "não", "no"].includes(s)) return false;
  }
  return !!v;
}

/* =========================================================================
   Paths / modelo banner
=========================================================================== */
function modeloPathPorChamada(chamadaId) {
  const base = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
  const pptx = path.join(base, "banner.pptx");
  const ppt = path.join(base, "banner.ppt");

  if (fileExists(pptx)) {
    return {
      path: pptx,
      name: "modelo_banner.pptx",
      type:
        mime.lookup(pptx) ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  }

  if (fileExists(ppt)) {
    return {
      path: ppt,
      name: "modelo_banner.ppt",
      type: mime.lookup(ppt) || "application/vnd.ms-powerpoint",
    };
  }

  return null;
}

function resolveStoragePath(storageKey) {
  if (!storageKey) return null;

  const key = String(storageKey).replace(/^\/+/, "");
  const abs = path.isAbsolute(key)
    ? key
    : path.join(MODELOS_CHAMADAS_DIR, key);

  const root = path.resolve(MODELOS_CHAMADAS_DIR);
  const resolved = path.resolve(abs);

  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function resolveBannerPadraoPath() {
  const candidates = [
    path.join(process.cwd(), "assets", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "public", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "api", "assets", "modelos", "banner-padrao.pptx"),
    path.join(__dirname, "..", "..", "assets", "modelos", "banner-padrao.pptx"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  return null;
}

/* =========================================================================
   Cache helpers
=========================================================================== */
function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

function setPublicCache(res, stat, maxAgeSec = 60) {
  const etag = `"${crypto
    .createHash("sha1")
    .update(`${stat.size}:${stat.mtimeMs}`)
    .digest("hex")}"`;

  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Length, Last-Modified, ETag"
  );
}

function isNotModified(req, res, stat) {
  const inm = req.headers["if-none-match"];
  if (inm) {
    const now = res.getHeader("ETag");
    if (now && String(inm).trim() === String(now)) {
      res.status(304).end();
      return true;
    }
  }

  const ims = req.headers["if-modified-since"];
  if (ims) {
    const mod = new Date(ims);
    if (!Number.isNaN(mod.getTime()) && stat.mtime <= mod) {
      res.status(304).end();
      return true;
    }
  }

  return false;
}

/* =========================================================================
   Helpers SQL
=========================================================================== */
async function trySqlList(DB, sqls, params) {
  let last = null;

  for (const s of sqls) {
    try {
      return await runQuery(DB, s, params);
    } catch (e) {
      last = e;
      if (["42P01", "42703", "42883"].includes(e?.code)) continue;
      throw e;
    }
  }

  throw last || new Error("Falha ao executar SQL.");
}

/* =========================================================================
   Público
=========================================================================== */
exports.listarAtivas = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const SQL = `
      SELECT
        c.*,
        (
          (now() AT TIME ZONE 'America/Sao_Paulo')
          <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
        ) AS dentro_prazo
      FROM trabalhos_chamadas c
      WHERE c.publicado = TRUE
      ORDER BY c.prazo_final_br ASC, c.id ASC
    `;

    const rows = await runAny(DB, SQL);

    logInfo(rid, "listarAtivas OK", { total: rows.length });
    return res.json(rows);
  } catch (err) {
    logErr(rid, "listarAtivas erro", err);
    next(err);
  }
};

exports.obterChamada = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const chamada = await runOneOrNone(
      DB,
      `
      SELECT
        c.*,
        (
          (now() AT TIME ZONE 'America/Sao_Paulo')
          <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
        ) AS dentro_prazo
      FROM trabalhos_chamadas c
      WHERE c.id = $1
      `,
      [id]
    );

    if (!chamada) {
      const e = new Error("Chamada não encontrada.");
      e.status = 404;
      throw e;
    }

    const [linhas, criterios, criterios_orais] = await Promise.all([
      runAny(
        DB,
        `
        SELECT id, codigo, nome, descricao
        FROM trabalhos_chamada_linhas
        WHERE chamada_id = $1
        ORDER BY nome ASC, id ASC
        `,
        [id]
      ),
      runAny(
        DB,
        `
        SELECT id, ordem, titulo, escala_min, escala_max, peso
        FROM trabalhos_chamada_criterios
        WHERE chamada_id = $1
        ORDER BY ordem ASC, id ASC
        `,
        [id]
      ),
      runAny(
        DB,
        `
        SELECT id, ordem, titulo, escala_min, escala_max, peso
        FROM trabalhos_chamada_criterios_orais
        WHERE chamada_id = $1
        ORDER BY ordem ASC, id ASC
        `,
        [id]
      ),
    ]);

    logInfo(rid, "obterChamada OK", {
      id,
      linhas: linhas.length,
      criterios: criterios.length,
      criterios_orais: criterios_orais.length,
    });

    return res.json({
      chamada,
      linhas,
      criterios,
      criterios_orais,
      limites: chamada.limites ?? null,
      criterios_outros: chamada.criterios_outros ?? null,
      oral_outros: chamada.oral_outros ?? null,
      premiacao_texto: chamada.premiacao_texto ?? null,
      disposicao_finais_texto: chamada.disposicao_finais_texto ?? null,
      link_modelo_poster: chamada.link_modelo_poster ?? null,
      aceita_poster: !!chamada.aceita_poster,
    });
  } catch (err) {
    logErr(rid, "obterChamada erro", err);
    next(err);
  }
};

exports.listarTodas = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const SQL = `
      SELECT
        c.*,
        (
          (now() AT TIME ZONE 'America/Sao_Paulo')
          <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
        ) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.criado_em DESC, c.id DESC
    `;

    const rows = await runAny(DB, SQL);

    logInfo(rid, "listarTodas OK", { total: rows.length });
    return res.json(rows);
  } catch (err) {
    logErr(rid, "listarTodas erro", err);
    next(err);
  }
};

/* =========================================================================
   Admin (CRUD)
=========================================================================== */
exports.criar = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const body = req.body || {};

    const titulo = String(body.titulo || "").trim();
    const descricao_markdown = String(body.descricao_markdown || "").trim();
    const periodo_experiencia_inicio = body.periodo_experiencia_inicio;
    const periodo_experiencia_fim = body.periodo_experiencia_fim;
    const prazo_final_br = body.prazo_final_br;

    const aceita_poster = normalizeBool(body.aceita_poster, true);
    const link_modelo_poster = body.link_modelo_poster
      ? String(body.link_modelo_poster).trim()
      : null;

    const max_coautores = Number(body.max_coautores || 10);
    const publicado = normalizeBool(body.publicado, false);

    const linhas = Array.isArray(body.linhas) ? body.linhas : [];
    const criterios = Array.isArray(body.criterios) ? body.criterios : [];
    const criterios_orais_in = Array.isArray(body.criterios_orais)
      ? body.criterios_orais
      : Array.isArray(body["critérios_orais"])
      ? body["critérios_orais"]
      : [];

    const limites = body.limites ?? null;
    const criterios_outros = body.criterios_outros ?? null;
    const oral_outros = body.oral_outros ?? null;
    const premiacao_texto = body.premiacao_texto ?? null;
    const disposicao_finais_texto = body.disposicao_finais_texto ?? null;

    assert(withinLen(titulo, 200), "Título é obrigatório (≤ 200).");
    assert(
      descricao_markdown && descricao_markdown.length > 0,
      "Descrição é obrigatória."
    );
    assert(
      isYYYYMM(periodo_experiencia_inicio),
      "Período início deve ser YYYY-MM."
    );
    assert(isYYYYMM(periodo_experiencia_fim), "Período fim deve ser YYYY-MM.");
    assert(
      periodo_experiencia_inicio <= periodo_experiencia_fim,
      "Período inválido (início > fim)."
    );
    assert(prazo_final_br, "Prazo final é obrigatório.");
    assert(
      isValidLimits(limites),
      `Limites inválidos (${LIMIT_MIN}–${LIMIT_MAX}).`
    );

    const userId = req.user?.id ?? req.usuario?.id;
    assert(userId, "Autenticação necessária.");

    const norm = normalizePrazoFragment(prazo_final_br);

    logInfo(rid, "criar:start", {
      titulo,
      publicado,
      aceita_poster,
      linhas: linhas.length,
      criterios: criterios.length,
      criterios_orais: criterios_orais_in.length,
      userId,
    });

    const out = await withTx(DB, async (t) => {
      const nova = await t.one(
        `
        INSERT INTO trabalhos_chamadas
          (
            titulo,
            descricao_markdown,
            periodo_experiencia_inicio,
            periodo_experiencia_fim,
            prazo_final_br,
            aceita_poster,
            link_modelo_poster,
            max_coautores,
            publicado,
            criado_por,
            limites,
            criterios_outros,
            oral_outros,
            premiacao_texto,
            disposicao_finais_texto
          )
        VALUES
          (
            $1,$2,$3,$4,
            ${norm.fragment.replace("$$PRAZO$$", "$5")},
            $6,$7,$8,$9,$10,
            $11,$12,$13,$14,$15
          )
        RETURNING id
        `,
        [
          titulo,
          descricao_markdown,
          periodo_experiencia_inicio,
          periodo_experiencia_fim,
          norm.param,
          aceita_poster,
          link_modelo_poster,
          Number.isFinite(max_coautores) ? max_coautores : 10,
          publicado,
          userId,
          limites ? JSON.stringify(limites) : null,
          criterios_outros,
          oral_outros,
          premiacao_texto,
          disposicao_finais_texto,
        ]
      );

      for (const l of linhas) {
        assert(l?.nome, "Linha temática exige nome.");
        await t.none(
          `
          INSERT INTO trabalhos_chamada_linhas (chamada_id, codigo, nome, descricao)
          VALUES ($1,$2,$3,$4)
          `,
          [
            nova.id,
            l.codigo ? String(l.codigo).trim() : null,
            String(l.nome).trim(),
            l.descricao || null,
          ]
        );
      }

      for (const [idx, c] of criterios.entries()) {
        assert(c?.titulo, "Critério escrito requer título.");
        await t.none(
          `
          INSERT INTO trabalhos_chamada_criterios
            (chamada_id, ordem, titulo, escala_min, escala_max, peso)
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            nova.id,
            c.ordem || idx + 1,
            c.titulo,
            c.escala_min ?? 1,
            c.escala_max ?? 5,
            c.peso ?? 1,
          ]
        );
      }

      for (const [idx, c] of criterios_orais_in.entries()) {
        assert(c?.titulo, "Critério oral requer título.");
        await t.none(
          `
          INSERT INTO trabalhos_chamada_criterios_orais
            (chamada_id, ordem, titulo, escala_min, escala_max, peso)
          VALUES ($1,$2,$3,$4,$5,$6)
          `,
          [
            nova.id,
            c.ordem || idx + 1,
            c.titulo,
            c.escala_min ?? 1,
            c.escala_max ?? 3,
            c.peso ?? 1,
          ]
        );
      }

      return { id: nova.id };
    });

    logInfo(rid, "criar OK", { id: out.id });
    return res.status(201).json({ ok: true, id: out.id });
  } catch (err) {
    logErr(rid, "criar erro", err);
    next(err);
  }
};

exports.atualizar = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const body = req.body || {};
    const cols = [
      "titulo",
      "descricao_markdown",
      "periodo_experiencia_inicio",
      "periodo_experiencia_fim",
      "prazo_final_br",
      "aceita_poster",
      "link_modelo_poster",
      "max_coautores",
      "publicado",
      "limites",
      "criterios_outros",
      "oral_outros",
      "premiacao_texto",
      "disposicao_finais_texto",
    ];

    logInfo(rid, "atualizar:start", {
      id,
      bodyKeys: Object.keys(body || {}),
    });

    await withTx(DB, async (t) => {
      const set = [];
      const vals = [];

      for (const c of cols) {
        if (!Object.prototype.hasOwnProperty.call(body, c)) continue;

        if (c === "titulo") {
          assert(withinLen(body[c], 200), "Título deve ter até 200 caracteres.");
          vals.push(String(body[c]).trim());
          set.push(`titulo = $${vals.length}`);
          continue;
        }

        if (c === "descricao_markdown") {
          assert(
            String(body[c] || "").trim().length > 0,
            "Descrição é obrigatória."
          );
          vals.push(String(body[c]).trim());
          set.push(`descricao_markdown = $${vals.length}`);
          continue;
        }

        if (c === "periodo_experiencia_inicio" || c === "periodo_experiencia_fim") {
          assert(isYYYYMM(body[c]), `${c} deve ser YYYY-MM.`);
        }

        if (c === "limites") {
          assert(
            isValidLimits(body[c]),
            `Limites inválidos (${LIMIT_MIN}–${LIMIT_MAX}).`
          );
          vals.push(body[c] ? JSON.stringify(body[c]) : null);
          set.push(`limites = $${vals.length}`);
          continue;
        }

        if (c === "prazo_final_br" && body[c]) {
          const norm = normalizePrazoFragment(body[c]);
          vals.push(norm.param);
          set.push(
            `prazo_final_br = ${norm.fragment.replace("$$PRAZO$$", `$${vals.length}`)}`
          );
          continue;
        }

        if (c === "aceita_poster" || c === "publicado") {
          vals.push(normalizeBool(body[c], false));
          set.push(`${c} = $${vals.length}`);
          continue;
        }

        vals.push(body[c]);
        set.push(`${c} = $${vals.length}`);
      }

      if (
        Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_inicio") &&
        Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_fim")
      ) {
        assert(
          body.periodo_experiencia_inicio <= body.periodo_experiencia_fim,
          "Período inválido."
        );
      }

      if (set.length) {
        vals.push(id);
        await t.none(
          `
          UPDATE trabalhos_chamadas
             SET ${set.join(", ")},
                 atualizado_em = NOW()
           WHERE id = $${vals.length}
          `,
          vals
        );
      }

      if (Array.isArray(body.linhas)) {
        await t.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id = $1`, [id]);

        for (const l of body.linhas) {
          assert(l?.nome, "Linha temática exige nome.");
          await t.none(
            `
            INSERT INTO trabalhos_chamada_linhas (chamada_id, codigo, nome, descricao)
            VALUES ($1,$2,$3,$4)
            `,
            [
              id,
              l.codigo ? String(l.codigo).trim() : null,
              String(l.nome).trim(),
              l.descricao || null,
            ]
          );
        }
      }

      if (Array.isArray(body.criterios)) {
        await t.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id = $1`, [id]);

        for (const [idx, c] of body.criterios.entries()) {
          assert(c?.titulo, "Critério escrito requer título.");
          await t.none(
            `
            INSERT INTO trabalhos_chamada_criterios
              (chamada_id, ordem, titulo, escala_min, escala_max, peso)
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
              id,
              c.ordem || idx + 1,
              c.titulo,
              c.escala_min ?? 1,
              c.escala_max ?? 5,
              c.peso ?? 1,
            ]
          );
        }
      }

      if (Array.isArray(body.criterios_orais)) {
        await t.none(
          `DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id = $1`,
          [id]
        );

        for (const [idx, c] of body.criterios_orais.entries()) {
          assert(c?.titulo, "Critério oral requer título.");
          await t.none(
            `
            INSERT INTO trabalhos_chamada_criterios_orais
              (chamada_id, ordem, titulo, escala_min, escala_max, peso)
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
              id,
              c.ordem || idx + 1,
              c.titulo,
              c.escala_min ?? 1,
              c.escala_max ?? 3,
              c.peso ?? 1,
            ]
          );
        }
      }
    });

    logInfo(rid, "atualizar OK", { id });
    return res.json({ ok: true });
  } catch (err) {
    logErr(rid, "atualizar erro", err);
    next(err);
  }
};

exports.publicar = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const publicado =
      req.body?.publicado !== undefined
        ? normalizeBool(req.body.publicado, true)
        : true;

    if (publicado === true) {
      const row = await runOne(
        DB,
        `
        SELECT
          (SELECT COUNT(*) FROM trabalhos_chamada_linhas WHERE chamada_id = $1) AS linhas,
          (SELECT COUNT(*) FROM trabalhos_chamada_criterios WHERE chamada_id = $1) AS criterios
        `,
        [id]
      );

      assert(
        Number(row?.linhas || 0) > 0,
        "Inclua ao menos 1 linha temática antes de publicar."
      );
      assert(
        Number(row?.criterios || 0) > 0,
        "Inclua ao menos 1 critério de avaliação antes de publicar."
      );
    }

    await runNone(
      DB,
      `
      UPDATE trabalhos_chamadas
         SET publicado = $1,
             atualizado_em = NOW()
       WHERE id = $2
      `,
      [publicado, id]
    );

    logInfo(rid, "publicar OK", { id, publicado });
    return res.json({ ok: true, publicado });
  } catch (err) {
    logErr(rid, "publicar erro", err);
    next(err);
  }
};

exports.listarAdmin = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const SQL = `
      SELECT
        c.*,
        (
          (now() AT TIME ZONE 'America/Sao_Paulo')
          <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
        ) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.prazo_final_br ASC, c.id DESC
    `;

    const rows = await runAny(DB, SQL);

    logInfo(rid, "listarAdmin OK", { total: rows.length });
    return res.json(rows);
  } catch (err) {
    logErr(rid, "listarAdmin erro", err);
    next(err);
  }
};

exports.remover = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    await withTx(DB, async (t) => {
      await t.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id = $1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id = $1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id = $1`, [id]);

      const del = await t.oneOrNone(
        `DELETE FROM trabalhos_chamadas WHERE id = $1 RETURNING id`,
        [id]
      );

      if (!del) {
        const e = new Error("Chamada não encontrada.");
        e.status = 404;
        throw e;
      }
    });

    logInfo(rid, "remover OK", { id });
    return res.json({ ok: true, id });
  } catch (err) {
    logErr(rid, "remover erro", err);
    next(err);
  }
};

/* =========================================================================
   Exportação do modelo padrão (global)
=========================================================================== */
exports.exportarModeloBanner = async (req, res, next) => {
  const rid = reqRid(req);

  try {
    const filePath = resolveBannerPadraoPath();
    if (!filePath) {
      const e = new Error("Modelo de banner não encontrado no servidor.");
      e.status = 404;
      throw e;
    }

    const stat = await fsp.stat(filePath);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent("modelo_banner.pptx")}`
    );
    res.setHeader("Content-Length", String(stat.size));

    setPublicCache(res, stat, 3600);
    if (isNotModified(req, res, stat)) return;

    logInfo(rid, "exportarModeloBanner OK", { path: filePath, size: stat.size });

    const stream = fs.createReadStream(filePath);
    stream.on("error", (e) => {
      logErr(rid, "stream exportarModeloBanner", e);
      if (!res.headersSent) res.status(500).end();
    });

    return stream.pipe(res);
  } catch (err) {
    logErr(rid, "exportarModeloBanner erro", err);
    next(err);
  }
};

/* =========================================================================
   Modelo por chamada (meta)
=========================================================================== */
exports.modeloBannerMeta = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    setNoStore(res);

    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const metaDb = await runOneOrNone(
      DB,
      `
      SELECT nome_arquivo, mime, storage_key, tamanho_bytes
      FROM public.trabalhos_chamadas_modelos
      WHERE chamada_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [id]
    );

    if (metaDb?.storage_key) {
      const abs = resolveStoragePath(metaDb.storage_key);
      const exists = abs ? fs.existsSync(abs) : false;

      const bytes = (() => {
        try {
          return abs ? fs.statSync(abs).size : metaDb.tamanho_bytes || null;
        } catch {
          return metaDb.tamanho_bytes || null;
        }
      })();

      if (exists) {
        logInfo(rid, "modeloBannerMeta origem=db", { id, bytes });
        return res.json({
          exists: true,
          origin: "db",
          filename: metaDb.nome_arquivo || "modelo_banner.pptx",
          mime:
            metaDb.mime ||
            mime.lookup(metaDb.nome_arquivo || "") ||
            "application/octet-stream",
          bytes,
        });
      }
    }

    const local = modeloPathPorChamada(id);
    if (local) {
      const stat = fs.statSync(local.path);
      logInfo(rid, "modeloBannerMeta origem=fs", { id, bytes: stat.size });

      return res.json({
        exists: true,
        origin: "fs",
        filename: local.name,
        mime: local.type,
        bytes: stat.size,
      });
    }

    const rowLink = await runOneOrNone(
      DB,
      `SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id = $1`,
      [id]
    );

    const link = rowLink?.link_modelo_poster || null;
    if (isHttpUrl(link)) {
      logInfo(rid, "modeloBannerMeta origem=url", { id, href: link });
      return res.json({ exists: true, origin: "url", href: link });
    }

    logInfo(rid, "modeloBannerMeta inexistente", { id });
    return res.json({ exists: false });
  } catch (err) {
    logErr(rid, "modeloBannerMeta erro", err);
    next(err);
  }
};

/* =========================================================================
   Importar modelo por chamada
=========================================================================== */
exports.importarModeloBanner = [
  uploadMem.single("banner"),
  async (req, res, next) => {
    const rid = reqRid(req);
    const DB = getDB(req);

    try {
      setNoStore(res);

      const chamadaId = toIntId(req.params.id);
      assert(chamadaId, "ID inválido.");

      const f = req.file;
      assert(f, "Arquivo obrigatório (campo 'banner').");

      const nome = f.originalname || "modelo_banner.pptx";
      assert(/\.pptx?$/i.test(nome), "Envie arquivo .ppt ou .pptx.");

      const ext = path.extname(nome).toLowerCase();
      const mimeIn = f.mimetype || mime.lookup(nome) || "application/octet-stream";

      const dir = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
      fs.mkdirSync(dir, { recursive: true });

      const storageKey = `${chamadaId}/modelo_banner${ext || ".pptx"}`;
      const absPath = resolveStoragePath(storageKey);
      assert(absPath, "Caminho de armazenamento inválido.");

      const tmp = absPath + ".tmp";
      await fsp.writeFile(tmp, f.buffer);
      await fsp.rename(tmp, absPath);

      const tamanho = f.buffer.length;
      const hash = crypto.createHash("sha256").update(f.buffer).digest("hex");
      const userId = req.user?.id ?? req.usuario?.id ?? null;

      const sql = `
        INSERT INTO public.trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, updated_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT (chamada_id) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = NOW(),
            updated_by     = EXCLUDED.updated_by
        RETURNING id
      `;

      await runOne(DB, sql, [
        chamadaId,
        nome,
        mimeIn,
        storageKey,
        tamanho,
        hash,
        userId,
      ]);

      logInfo(rid, "importarModeloBanner OK", {
        chamadaId,
        nome,
        tamanho,
        mime: mimeIn,
      });

      return res.status(201).json({
        ok: true,
        chamada_id: chamadaId,
        nome,
        mime: mimeIn,
        tamanho,
      });
    } catch (err) {
      logErr(rid, "importarModeloBanner erro", err);
      next(err);
    }
  },
];

/* =========================================================================
   Baixar modelo por chamada
=========================================================================== */
exports.baixarModeloPorChamada = async (req, res, next) => {
  const rid = reqRid(req);
  const DB = getDB(req);

  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const rowMeta = await runOneOrNone(
      DB,
      `
      SELECT nome_arquivo, mime, storage_key
      FROM public.trabalhos_chamadas_modelos
      WHERE chamada_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [id]
    );

    if (rowMeta?.storage_key) {
      const absPath = resolveStoragePath(rowMeta.storage_key);

      if (absPath && fs.existsSync(absPath)) {
        const stat = await fsp.stat(absPath);
        const fname = rowMeta.nome_arquivo || path.basename(absPath);
        const mimeType =
          rowMeta.mime || mime.lookup(fname) || "application/octet-stream";

        res.setHeader("Content-Type", mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        );
        res.setHeader("Content-Length", String(stat.size));

        setPublicCache(res, stat, 60);
        if (isNotModified(req, res, stat)) return;

        logInfo(rid, "baixarModeloPorChamada origem=db/fs", {
          id,
          file: absPath,
          size: stat.size,
        });

        const stream = fs.createReadStream(absPath);
        stream.on("error", (e) => {
          logErr(rid, "stream baixarModeloPorChamada db/fs", e);
          if (!res.headersSent) res.status(500).end();
        });

        return stream.pipe(res);
      }
    }

    const local = modeloPathPorChamada(id);
    if (local) {
      const stat = await fsp.stat(local.path);

      res.setHeader("Content-Type", local.type);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(local.name)}`
      );
      res.setHeader("Content-Length", String(stat.size));

      setPublicCache(res, stat, 60);
      if (isNotModified(req, res, stat)) return;

      logInfo(rid, "baixarModeloPorChamada origem=fs legado", {
        id,
        file: local.path,
        size: stat.size,
      });

      const stream = fs.createReadStream(local.path);
      stream.on("error", (e) => {
        logErr(rid, "stream baixarModeloPorChamada fs legado", e);
        if (!res.headersSent) res.status(500).end();
      });

      return stream.pipe(res);
    }

    const rowLink = await runOneOrNone(
      DB,
      `SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id = $1`,
      [id]
    );

    const link = rowLink?.link_modelo_poster || null;

    if (isHttpUrl(link)) {
      const filenameFromUrl = (u) => {
        try {
          const x = new URL(String(u));
          const last = x.pathname.split("/").filter(Boolean).pop();
          return last || "modelo_banner.pptx";
        } catch {
          return "modelo_banner.pptx";
        }
      };

      if (req.method === "HEAD") {
        const fname = filenameFromUrl(link);
        const mimeType =
          mime.lookup(fname) ||
          "application/vnd.openxmlformats-officedocument.presentationml.presentation";

        res.setHeader("Content-Type", mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        );
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Disposition"
        );
        res.setHeader("Cache-Control", "public, max-age=60");

        logInfo(rid, "baixarModeloPorChamada HEAD origem=url", { id, link });
        return res.status(200).end();
      }

      try {
        const _fetch =
          typeof globalThis.fetch === "function"
            ? globalThis.fetch
            : (await import("node-fetch")).default;

        const upstream = await _fetch(link);
        if (!upstream.ok) {
          return res
            .status(upstream.status)
            .json({ erro: `Falha ao obter modelo (upstream ${upstream.status}).` });
        }

        const cd =
          typeof upstream.headers?.get === "function"
            ? upstream.headers.get("content-disposition") || ""
            : "";

        const m1 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
        const m2 = /filename="?([^"]+)"?/i.exec(cd);

        const fname = m1
          ? decodeURIComponent(m1[1].trim().replace(/^['"]|['"]$/g, ""))
          : m2
          ? m2[1].trim()
          : filenameFromUrl(link);

        const mimeType =
          (typeof upstream.headers?.get === "function" &&
            upstream.headers.get("content-type")) ||
          mime.lookup(fname) ||
          "application/octet-stream";

        const len =
          typeof upstream.headers?.get === "function"
            ? upstream.headers.get("content-length")
            : null;

        res.setHeader("Content-Type", mimeType);
        if (len) res.setHeader("Content-Length", String(len));
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        );
        res.setHeader(
          "Access-Control-Expose-Headers",
          "Content-Disposition, Content-Length"
        );
        res.setHeader("Cache-Control", "public, max-age=60");

        logInfo(rid, "baixarModeloPorChamada origem=url proxy", {
          id,
          link,
          fname,
          mimeType,
          len,
        });

        if (upstream.body && typeof Readable.fromWeb === "function") {
          Readable.fromWeb(upstream.body).pipe(res);
          return;
        }

        if (upstream.body && typeof upstream.body.pipe === "function") {
          upstream.body.pipe(res);
          return;
        }

        const buf = Buffer.from(await upstream.arrayBuffer());
        return res.end(buf);
      } catch (e) {
        logErr(rid, "proxy baixarModeloPorChamada erro", e);
        return res.status(502).json({ erro: "Falha ao proxyar o modelo externo." });
      }
    }

    if (req.method === "HEAD") return res.status(404).end();

    logWarn(rid, "baixarModeloPorChamada não encontrado", { id });
    return res.status(404).json({ erro: "Modelo não disponível para esta chamada." });
  } catch (err) {
    logErr(rid, "baixarModeloPorChamada erro", err);
    return next(err);
  }
};