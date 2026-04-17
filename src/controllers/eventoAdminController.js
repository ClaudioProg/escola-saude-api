/* eslint-disable no-console */
"use strict";

// ✅ src/controllers/eventoAdminController.js
// - Controller administrativo de eventos
// - Separado do controller público
// - Criação/edição/exclusão/publicação
// - Upload de folder/programação
// - Compatível com schema atual
// - Date-only safe
// - Logs robustos

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const dbMod = require("../db");
const { EVENTOS_DIR } = require("../paths");
const { normalizeListaRegistros } = require("../utils/registro");

const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function" || !pool?.connect) {
  console.error("[eventoAdminController] db inválido:", Object.keys(dbMod || {}));
  throw new Error(
    "DB inválido em src/controllers/eventoAdminController.js (pool/query ausentes)"
  );
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ====================== Paths / Uploads ====================== */
const UP_BASE = EVENTOS_DIR;
try {
  fs.mkdirSync(UP_BASE, { recursive: true });
} catch (e) {
  console.error(
    "[eventoAdminController] Falha ao garantir diretório de uploads:",
    UP_BASE,
    e?.message
  );
}

/* ====================== Logger util (RID) ====================== */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function _log(rid, level, msg, extra) {
  const hasExtra = extra && Object.keys(extra).length;
  const prefix = `[EVT:ADMIN][RID=${rid}]`;

  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }
  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, hasExtra ? extra : "");
  }
  if (level === "info") {
    return console.log(`${prefix} • ${msg}`, hasExtra ? extra : "");
  }
  return console.log(`${prefix} ▶ ${msg}`, hasExtra ? extra : "");
}

const logStart = (rid, msg, extra) => _log(rid, "start", msg, extra);
const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

/* ====================== Helpers gerais ====================== */
function hhmm(s, fb = "") {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || "";
}

function toYmd(v) {
  if (v == null) return null;

  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return null;
  }

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

const toIntArray = (v) =>
  Array.isArray(v) ? v.map((n) => Number(n)).filter(Number.isFinite) : [];

const toIdArray = (v) =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "object" && x !== null ? x.id : x))
        .map((n) => Number(n))
        .filter(Number.isFinite)
    : [];

function getPerfisFromReq(req) {
  const raw = req.user?.perfil ?? req.user?.perfis ?? [];
  if (Array.isArray(raw)) return raw.map((p) => String(p).toLowerCase());

  return String(raw)
    .split(",")
    .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(req) {
  return getPerfisFromReq(req).includes("administrador");
}

function isMissingRelationOrColumn(err) {
  const c = err && (err.code || err?.original?.code);
  return c === "42P01" || c === "42703";
}

async function execIgnoreMissing(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (e) {
    if (isMissingRelationOrColumn(e)) return { rows: [], rowCount: 0 };
    throw e;
  }
}

async function tryQueryWithFallback(client, primary, fallback) {
  try {
    return await client.query(primary.text, primary.values || []);
  } catch (e) {
    if (e.code === "42703") return await client.query(fallback.text, fallback.values || []);
    throw e;
  }
}

/* ====================== Turma datas parser ====================== */
function extrairDatasDaTurma(t) {
  if (Array.isArray(t?.datas) && t.datas.length) {
    return t.datas.map((d) => ({
      data: toYmd(d?.data),
      horario_inicio: hhmm(d?.horario_inicio || ""),
      horario_fim: hhmm(d?.horario_fim || ""),
    }));
  }

  if (Array.isArray(t?.encontros) && t.encontros.length) {
    return t.encontros.map((e) =>
      typeof e === "string"
        ? { data: toYmd(e), horario_inicio: null, horario_fim: null }
        : {
            data: toYmd(e?.data),
            horario_inicio: hhmm(e?.inicio || ""),
            horario_fim: hhmm(e?.fim || ""),
          }
    );
  }

  return [];
}

/* ====================== Multipart safe ====================== */
function parseMaybeJson(v, fallback) {
  if (v == null) return fallback;

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return fallback;

    if (
      (s.startsWith("{") && s.endsWith("}")) ||
      (s.startsWith("[") && s.endsWith("]"))
    ) {
      try {
        return JSON.parse(s);
      } catch {
        return fallback;
      }
    }

    return fallback;
  }

  return v;
}

function normalizeBodyMultipart(body = {}) {
  const out = { ...body };

  out.turmas = parseMaybeJson(body.turmas, body.turmas);

  if (Array.isArray(out.turmas)) {
    out.turmas = out.turmas.map((t) => {
      const tt = { ...t };
      tt.instrutores = parseMaybeJson(t?.instrutores, t?.instrutores);
      tt.datas = parseMaybeJson(t?.datas, t?.datas);
      tt.encontros = parseMaybeJson(t?.encontros, t?.encontros);
      return tt;
    });
  }

  out.registros_permitidos = parseMaybeJson(
    body.registros_permitidos,
    body.registros_permitidos
  );
  out.cargos_permitidos = parseMaybeJson(body.cargos_permitidos, body.cargos_permitidos);
  out.unidades_permitidas = parseMaybeJson(
    body.unidades_permitidas,
    body.unidades_permitidas
  );

  const b = (x) =>
    String(x).toLowerCase() === "true"
      ? true
      : String(x).toLowerCase() === "false"
        ? false
        : x;

  out.restrito = b(body.restrito);
  out.remover_folder = b(body.remover_folder);
  out.remover_programacao = b(body.remover_programacao);

  return out;
}

/* ====================== Restrição ====================== */
const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

/* ====================== Resolve cargos ====================== */
async function resolveCargoIds(client, cargos_permitidos) {
  const arr = Array.isArray(cargos_permitidos) ? cargos_permitidos : [];

  const idsDiretos = arr
    .map((x) => (typeof x === "object" && x !== null ? x.id : x))
    .map((n) => Number(n))
    .filter(Number.isFinite);

  if (idsDiretos.length) return [...new Set(idsDiretos)];

  const nomes = arr
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);

  if (!nomes.length) return [];

  const { rows } = await client.query(
    `SELECT id FROM cargos WHERE lower(nome) = ANY($1::text[])`,
    [nomes.map((s) => s.toLocaleLowerCase("pt-BR"))]
  );

  return [...new Set((rows || []).map((r) => Number(r.id)).filter(Number.isFinite))];
}

/* ====================== Uploads ====================== */
const MAX_FOLDER_MB = 2;
const MAX_FOLDER_BYTES = MAX_FOLDER_MB * 1024 * 1024;

const MAX_PDF_MB = 15;
const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

function sanitizeBaseName(name = "arquivo") {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext);
  return (
    base.replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_").slice(0, 80) || "arquivo"
  );
}

const allowedFolderExt = new Set([".png", ".jpg", ".jpeg"]);
const allowedFolderMime = new Set(["image/png", "image/jpeg"]);
const allowedPdfExt = new Set([".pdf"]);
const allowedPdfMime = new Set(["application/pdf"]);

const storagePdf = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UP_BASE),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = sanitizeBaseName(file.originalname || "arquivo");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const uploadFolderMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOLDER_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (file.fieldname !== "folder") return cb(new Error("Campo inválido para folder."));
    if (!allowedFolderExt.has(ext) || !allowedFolderMime.has(mime)) {
      return cb(new Error("Imagem do folder deve ser PNG/JPG"));
    }
    return cb(null, true);
  },
});

const uploadPdfDisk = multer({
  storage: storagePdf,
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (file.fieldname !== "programacao") {
      return cb(new Error("Campo inválido para PDF."));
    }
    if (!allowedPdfExt.has(ext) || !allowedPdfMime.has(mime)) {
      return cb(new Error("Arquivo de programação deve ser PDF"));
    }
    return cb(null, true);
  },
});

const uploadGenericMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FOLDER_BYTES },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const mime = String(file.mimetype || "").toLowerCase();

    if (file.fieldname !== "file") return cb(new Error("Campo inválido."));
    const ok = allowedFolderExt.has(ext) && allowedFolderMime.has(mime);
    if (!ok) return cb(new Error("Arquivo inválido para 'file' (use PNG/JPG)."));
    return cb(null, true);
  },
});

const uploadEventos = (req, res, next) => {
  const rid = mkRid();

  const folderHandler = uploadFolderMem.single("folder");
  folderHandler(req, res, (err1) => {
    if (err1) {
      const msg =
        err1.code === "LIMIT_FILE_SIZE"
          ? `Folder excede o limite de ${MAX_FOLDER_MB}MB.`
          : err1.message || "Falha no upload do folder.";
      logWarn(rid, "uploadEventos/folder erro", { msg, code: err1.code });
      return res.status(400).json({ erro: msg });
    }

    const fileHandler = uploadGenericMem.single("file");
    fileHandler(req, res, (errF) => {
      if (errF) {
        const hasFileAttempt = Boolean(
          req.headers["content-type"]?.includes("multipart/form-data")
        );

        if (errF && (errF.message || errF.code)) {
          const msg =
            errF.code === "LIMIT_FILE_SIZE"
              ? `Imagem excede o limite de ${MAX_FOLDER_MB}MB.`
              : errF.message || "Falha no upload do arquivo.";

          logWarn(rid, "uploadEventos/file erro", {
            msg,
            code: errF.code,
            hasFileAttempt,
          });
          return res.status(400).json({ erro: msg });
        }
      }

      if (req.file && (req.file.fieldname === "folder" || req.file.fieldname === "file")) {
        req._folderFile = req.file;
        req.file = undefined;
      }

      const pdfHandler = uploadPdfDisk.single("programacao");
      pdfHandler(req, res, (err2) => {
        if (err2) {
          const msg =
            err2.code === "LIMIT_FILE_SIZE"
              ? `PDF excede o limite de ${MAX_PDF_MB}MB.`
              : err2.message || "Falha no upload do PDF.";
          logWarn(rid, "uploadEventos/programacao erro", { msg, code: err2.code });
          return res.status(400).json({ erro: msg });
        }

        return next();
      });
    });
  });
};

const uploadFolderOnly = (req, res, next) => {
  const rid = mkRid();

  const folderHandler = uploadFolderMem.single("folder");
  folderHandler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `Folder excede o limite de ${MAX_FOLDER_MB}MB.`
          : err.message || "Falha no upload do folder.";
      logWarn(rid, "uploadFolderOnly erro", { msg, code: err.code });
      return res.status(400).json({ erro: msg });
    }

    if (req.file && req.file.fieldname === "folder") {
      req._folderFile = req.file;
      req.file = undefined;
    }

    return next();
  });
};

const uploadProgramacaoOnly = (req, res, next) => {
  const rid = mkRid();

  const pdfHandler = uploadPdfDisk.single("programacao");
  pdfHandler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `PDF excede o limite de ${MAX_PDF_MB}MB.`
          : err.message || "Falha no upload do PDF.";
      logWarn(rid, "uploadProgramacaoOnly erro", { msg, code: err.code });
      return res.status(400).json({ erro: msg });
    }

    return next();
  });
};

function pegarUploadUrl(req, field) {
  if (field === "programacao") {
    const f = req.file && req.file.fieldname === "programacao" ? req.file : null;
    if (!f?.path) return null;
    return `/uploads/eventos/${path.basename(f.path)}`;
  }

  return null;
}

async function salvarFolderNoEvento(client, eventoId, file) {
  if (!file?.buffer?.length) return;

  const mime = String(file.mimetype || "").toLowerCase();
  if (!allowedFolderMime.has(mime)) {
    throw Object.assign(new Error("MIME inválido para folder."), { status: 400 });
  }
  if (file.size > MAX_FOLDER_BYTES) {
    throw Object.assign(new Error(`Folder excede ${MAX_FOLDER_MB}MB.`), { status: 400 });
  }

  await client.query(
    `
    UPDATE eventos
    SET folder_blob = $2,
        folder_mime = $3,
        folder_size = $4,
        folder_updated_at = NOW(),
        folder_url = NULL
    WHERE id = $1
    `,
    [eventoId, file.buffer, mime, Number(file.size || 0)]
  );
}

async function limparFolderDoEvento(client, eventoId) {
  await client.query(
    `
    UPDATE eventos
    SET folder_blob = NULL,
        folder_mime = NULL,
        folder_size = NULL,
        folder_updated_at = NOW(),
        folder_url = NULL
    WHERE id = $1
    `,
    [eventoId]
  );
}

/* =====================================================================
   📄 Listar eventos admin
===================================================================== */
async function listarEventosAdmin(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  logStart(rid, "listarEventosAdmin");

  const client = await pool.connect();
  try {
    const sqlWithBlob = `
      WITH agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      )
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.local,
        e.tipo,
        e.unidade_id,
        e.publico_alvo,
        e.publicado,
        e.restrito,
        e.restrito_modo,
        e.folder_url,
        e.programacao_pdf_url,
        e.cargos_permitidos_ids,
        e.unidades_permitidas_ids,
        e.criado_em,

        ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
        CASE
          WHEN e.folder_blob IS NOT NULL THEN 'blob'
          WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
          ELSE 'none'
        END AS folder_kind,

        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM eventos e
      LEFT JOIN agg_turmas at ON at.evento_id = e.id
      LEFT JOIN agg_datas ad ON ad.evento_id = e.id
      ORDER BY COALESCE(
        ad.fim_real,
        at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
      ) DESC NULLS LAST,
      e.id DESC
    `;

    const sqlWithoutBlob = `
      WITH agg_turmas AS (
        SELECT
          t.evento_id,
          MIN(t.data_inicio) AS data_inicio_geral,
          MAX(t.data_fim) AS data_fim_geral,
          MIN(t.horario_inicio) AS horario_inicio_geral,
          MAX(t.horario_fim) AS horario_fim_geral
        FROM turmas t
        GROUP BY t.evento_id
      ),
      agg_datas AS (
        SELECT
          t.evento_id,
          MIN(dt.data::date + COALESCE(dt.horario_inicio, '00:00'::time)) AS inicio_real,
          MAX(dt.data::date + COALESCE(dt.horario_fim, '23:59'::time)) AS fim_real
        FROM turmas t
        JOIN datas_turma dt ON dt.turma_id = t.id
        GROUP BY t.evento_id
      )
      SELECT
        e.id,
        e.titulo,
        e.descricao,
        e.local,
        e.tipo,
        e.unidade_id,
        e.publico_alvo,
        e.publicado,
        e.restrito,
        e.restrito_modo,
        e.folder_url,
        e.programacao_pdf_url,
        e.cargos_permitidos_ids,
        e.unidades_permitidas_ids,
        e.criado_em,

        ('/api/eventos/' || e.id || '/folder') AS folder_blob_url,
        CASE
          WHEN NULLIF(e.folder_url,'') IS NOT NULL THEN 'url'
          ELSE 'none'
        END AS folder_kind,

        at.data_inicio_geral,
        at.data_fim_geral,
        at.horario_inicio_geral,
        at.horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < COALESCE(
            ad.inicio_real,
            at.data_inicio_geral::date + COALESCE(at.horario_inicio_geral, '00:00'::time)
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= COALESCE(
            ad.fim_real,
            at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM eventos e
      LEFT JOIN agg_turmas at ON at.evento_id = e.id
      LEFT JOIN agg_datas ad ON ad.evento_id = e.id
      ORDER BY COALESCE(
        ad.fim_real,
        at.data_fim_geral::date + COALESCE(at.horario_fim_geral, '23:59'::time)
      ) DESC NULLS LAST,
      e.id DESC
    `;

    let rows;
    try {
      ({ rows } = await client.query(sqlWithBlob));
    } catch (err) {
      if (err?.code !== "42703") throw err;
      ({ rows } = await client.query(sqlWithoutBlob));
    }

    logInfo(rid, "listarEventosAdmin OK", { count: rows.length });
    return res.json(rows);
  } catch (err) {
    logError(rid, "listarEventosAdmin erro", err);
    return res.status(500).json({
      erro: "Erro ao listar eventos admin",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ➕ Criar evento
===================================================================== */
async function criarEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const body = normalizeBodyMultipart(req.body || {});

  logInfo(rid, "criarEvento tipos", {
    contentType: req.headers["content-type"],
    turmasType: typeof body.turmas,
    turmasIsArray: Array.isArray(body.turmas),
    firstInstrIsArray: Array.isArray(body.turmas)
      ? Array.isArray(body.turmas?.[0]?.instrutores)
      : null,
  });

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    turmas = [],
    restrito = false,
    restrito_modo = null,
    registros,
    registros_permitidos,
    cargos_permitidos,
    unidades_permitidas,
  } = body;

  logStart(rid, "criarEvento", {
    titulo,
    local,
    tipo,
    unidade_id,
    restrito,
    restrito_modo,
    turmas_count: Array.isArray(turmas) ? turmas.length : 0,
  });

  if (!titulo?.trim()) {
    return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  }
  if (!local?.trim()) {
    return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  }
  if (!tipo?.trim()) {
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  }
  if (!unidade_id) {
    return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });
  }

  const turmasArr = Array.isArray(turmas) ? turmas : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const folderFile =
      req._folderFile ||
      ((req.file &&
        (req.file.fieldname === "folder" || req.file.fieldname === "file"))
        ? req.file
        : null);

    const progPdfUrl = pegarUploadUrl(req, "programacao");

    logInfo(rid, "criarEvento payload pós-curso", {
      pos_curso_tipo: body?.pos_curso_tipo,
      has_teste_config: !!body?.teste_config,
      teste_config_keys: body?.teste_config ? Object.keys(body.teste_config) : [],
    });

    const cargosIds = await resolveCargoIds(client, cargos_permitidos);

    const evIns = await client.query(
      `
      INSERT INTO eventos (
        titulo, descricao, local, tipo, unidade_id, publico_alvo,
        restrito, restrito_modo, publicado, folder_url, programacao_pdf_url,
        cargos_permitidos_ids, unidades_permitidas_ids
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12)
      RETURNING *
      `,
      [
        titulo.trim(),
        (descricao || "").trim(),
        local.trim(),
        tipo.trim(),
        unidade_id,
        (publico_alvo || "").trim(),
        !!restrito,
        restrito ? restrito_modo || null : null,
        null,
        progPdfUrl,
        cargosIds,
        toIntArray(unidades_permitidas),
      ]
    );

    const evento = evIns.rows[0];
    const eventoId = evento.id;

    if (folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, eventoId, folderFile);
    }

    if (restrito && restrito_modo === MODO_LISTA) {
      const input =
        typeof registros_permitidos !== "undefined" ? registros_permitidos : registros;
      const regList = normalizeListaRegistros(input);

      for (const r of regList) {
        await client.query(
          `
          INSERT INTO evento_registros (evento_id, registro_norm)
          VALUES ($1,$2) ON CONFLICT DO NOTHING
          `,
          [eventoId, r]
        );
      }

      logInfo(rid, "evento_registros sincronizados", { count: regList.length });
    }

    await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
    for (const cid of toIntArray(cargos_permitidos)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_cargos (evento_id, cargo) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, String(cid)]
      );
    }

    await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [
      eventoId,
    ]);
    for (const uid of toIntArray(unidades_permitidas)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_unidades (evento_id, unidade_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, uid]
      );
    }

    let turmasCriadas = 0;

    for (const t of turmasArr) {
      const nome = String(t.nome || "Turma").trim();

      const vagas_total = Number.isFinite(Number(t.vagas_total ?? t.vagas))
        ? Number(t.vagas_total ?? t.vagas)
        : null;

      const carga_horaria = Number.isFinite(Number(t.carga_horaria))
        ? Number(t.carga_horaria)
        : null;

      const baseDatas = extrairDatasDaTurma(t);
      const ordenadas = [...baseDatas]
        .filter((d) => d.data)
        .sort((a, b) => a.data.localeCompare(b.data));

      const data_inicio = ordenadas[0]?.data ?? t.data_inicio ?? null;
      const data_fim = ordenadas.at(-1)?.data ?? t.data_fim ?? null;

      const hiPayload = hhmm(t?.horario_inicio || "") || null;
      const hfPayload = hhmm(t?.horario_fim || "") || null;

      const insTurma = await tryQueryWithFallback(
        client,
        {
          text: `
            INSERT INTO turmas (
              evento_id, nome, vagas_total, carga_horaria,
              data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING id
          `,
          values: [
            eventoId,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            hiPayload,
            hfPayload,
            null,
          ],
        },
        {
          text: `
            INSERT INTO turmas (
              evento_id, nome, vagas_total, carga_horaria,
              data_inicio, data_fim, horario_inicio, horario_fim
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING id
          `,
          values: [
            eventoId,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            hiPayload,
            hfPayload,
          ],
        }
      );

      const turmaId = insTurma.rows[0].id;

      for (const d of ordenadas) {
        const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
        const fimSeguro = d.horario_fim || hfPayload || "17:00";

        await client.query(
          `
          INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
          VALUES ($1,$2,$3,$4)
          `,
          [turmaId, d.data, inicioSeguro, fimSeguro]
        );
      }

      const instrutores = toIdArray(Array.isArray(t?.instrutores) ? t.instrutores : []);
      for (const instrutorId of instrutores) {
        await client.query(
          `
          INSERT INTO turma_instrutor (turma_id, instrutor_id)
          VALUES ($1,$2) ON CONFLICT DO NOTHING
          `,
          [turmaId, instrutorId]
        );
      }

      if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
        const assinanteId = Number(t.instrutor_assinante_id);
        if (instrutores.includes(assinanteId)) {
          await execIgnoreMissing(
            client,
            `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
            [turmaId, assinanteId]
          );
        }
      }

      turmasCriadas++;
    }

    await client.query("COMMIT");
    logInfo(rid, "criarEvento OK", { eventoId, turmasCriadas });

    return res.status(201).json({
      mensagem: "Evento criado com sucesso",
      evento,
    });
  } catch (err) {
    logError(rid, "criarEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}

    return res.status(500).json({
      erro: "Erro ao criar evento",
      rid,
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            pg: {
              code: err?.code,
              constraint: err?.constraint,
              detail: err?.detail,
              where: err?.where,
            },
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔄 Atualizar evento
===================================================================== */
async function atualizarEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const eventoId = Number(req.params.id);
  const body = normalizeBodyMultipart(req.body || {});

  logInfo(rid, "atualizarEvento tipos", {
    contentType: req.headers["content-type"],
    turmasType: typeof body.turmas,
    turmasIsArray: Array.isArray(body.turmas),
    firstInstrIsArray: Array.isArray(body.turmas)
      ? Array.isArray(body.turmas?.[0]?.instrutores)
      : null,
  });

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    turmas,
    restrito,
    restrito_modo,
    registros,
    registros_permitidos,
    cargos_permitidos,
    unidades_permitidas,
  } = body;

  const client = await pool.connect();
  try {
    logStart(rid, "atualizarEvento BEGIN", {
      eventoId,
      hasTurmas: Array.isArray(turmas),
      restrito,
      restrito_modo,
    });

    await client.query("BEGIN");

    const folderFile =
      req._folderFile ||
      ((req.file &&
        (req.file.fieldname === "folder" || req.file.fieldname === "file"))
        ? req.file
        : null);

    const progPdfUrl = pegarUploadUrl(req, "programacao");
    const remover_folder = body?.remover_folder === true;
    const remover_programacao = body?.remover_programacao === true;

    const setCols = [
      `titulo = COALESCE($2, titulo)`,
      `descricao = COALESCE($3, descricao)`,
      `local = COALESCE($4, local)`,
      `tipo = COALESCE($5, tipo)`,
      `unidade_id = COALESCE($6, unidade_id)`,
      `publico_alvo = COALESCE($7, publico_alvo)`,
    ];

    const params = [
      eventoId,
      titulo ?? null,
      descricao ?? null,
      local ?? null,
      tipo ?? null,
      unidade_id ?? null,
      publico_alvo ?? null,
    ];

    if (typeof restrito !== "undefined") {
      setCols.push(`restrito = $${params.length + 1}`);
      params.push(!!restrito);
    }

    if (typeof restrito_modo !== "undefined") {
      setCols.push(`restrito_modo = $${params.length + 1}`);
      params.push(restrito ? restrito_modo || null : null);
    }

    if (folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, eventoId, folderFile);
      setCols.push(`folder_url = NULL`);
    } else if (remover_folder) {
      await limparFolderDoEvento(client, eventoId);
      setCols.push(`folder_url = NULL`);
    }

    if (progPdfUrl) {
      setCols.push(`programacao_pdf_url = $${params.length + 1}`);
      params.push(progPdfUrl);
    } else if (remover_programacao) {
      setCols.push(`programacao_pdf_url = NULL`);
    }

    if (typeof cargos_permitidos !== "undefined") {
      const cargosIds = await resolveCargoIds(client, cargos_permitidos);
      setCols.push(`cargos_permitidos_ids = $${params.length + 1}`);
      params.push(cargosIds);
    }

    if (typeof unidades_permitidas !== "undefined") {
      setCols.push(`unidades_permitidas_ids = $${params.length + 1}`);
      params.push(toIntArray(unidades_permitidas));
    }

    const hasPosCursoTipo = Object.prototype.hasOwnProperty.call(body, "pos_curso_tipo");
    const hasTesteConfig = Object.prototype.hasOwnProperty.call(body, "teste_config");

    logInfo(rid, "atualizarEvento payload pós-curso (ignorado)", {
      has_pos_curso_tipo: hasPosCursoTipo,
      has_teste_config: hasTesteConfig,
      teste_config_type: hasTesteConfig ? typeof body.teste_config : null,
    });

    const upd = await client.query(
      `UPDATE eventos SET ${setCols.join(", ")} WHERE id = $1 RETURNING id`,
      params
    );

    if (!upd.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Evento não encontrado." });
    }

    if (typeof restrito !== "undefined" && !restrito) {
      await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [eventoId]);
      await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [
        eventoId,
      ]);
      await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [
        eventoId,
      ]);
    } else {
      if (
        restrito_modo === MODO_LISTA ||
        typeof registros !== "undefined" ||
        typeof registros_permitidos !== "undefined"
      ) {
        await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [eventoId]);

        const input =
          typeof registros_permitidos !== "undefined" ? registros_permitidos : registros;
        const regList = normalizeListaRegistros(input);

        for (const r of regList) {
          await client.query(
            `
            INSERT INTO evento_registros (evento_id, registro_norm)
            VALUES ($1,$2) ON CONFLICT DO NOTHING
            `,
            [eventoId, r]
          );
        }
      }

      if (typeof cargos_permitidos !== "undefined") {
        const cargosIds = await resolveCargoIds(client, cargos_permitidos);

        await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [
          eventoId,
        ]);

        for (const cid of cargosIds) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_cargos (evento_id, cargo) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, String(cid)]
          );
        }
      }

      if (typeof unidades_permitidas !== "undefined") {
        await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [
          eventoId,
        ]);

        for (const uid of toIntArray(unidades_permitidas)) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_unidades (evento_id, unidade_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, uid]
          );
        }
      }
    }

    if (Array.isArray(turmas)) {
      const { rows: atuais } = await client.query(
        `SELECT id FROM turmas WHERE evento_id=$1`,
        [eventoId]
      );

      const payloadIds = new Set(
        turmas.filter((t) => Number.isFinite(Number(t.id))).map((t) => Number(t.id))
      );

      for (const t of atuais) {
        if (!payloadIds.has(t.id)) {
          await client.query(`DELETE FROM presencas WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM inscricoes WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM turmas WHERE id=$1`, [t.id]);
        }
      }

      for (const t of turmas) {
        const tid = Number(t.id);

        const baseDatas = extrairDatasDaTurma(t);
        const ordenadas = [...baseDatas]
          .filter((d) => d.data)
          .sort((a, b) => a.data.localeCompare(b.data));

        const data_inicio = ordenadas[0]?.data ?? t.data_inicio ?? null;
        const data_fim = ordenadas.at(-1)?.data ?? t.data_fim ?? null;

        const nome = String(t.nome || "Turma").trim();
        const vagas_total = Number.isFinite(Number(t.vagas_total ?? t.vagas))
          ? Number(t.vagas_total ?? t.vagas)
          : null;
        const carga_horaria = Number.isFinite(Number(t.carga_horaria))
          ? Number(t.carga_horaria)
          : null;
        const hiPayload = hhmm(t?.horario_inicio || "") || null;
        const hfPayload = hhmm(t?.horario_fim || "") || null;

        if (!Number.isFinite(tid)) {
          const ins = await tryQueryWithFallback(
            client,
            {
              text: `
                INSERT INTO turmas (
                  evento_id, nome, vagas_total, carga_horaria,
                  data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                RETURNING id
              `,
              values: [
                eventoId,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
                null,
              ],
            },
            {
              text: `
                INSERT INTO turmas (
                  evento_id, nome, vagas_total, carga_horaria,
                  data_inicio, data_fim, horario_inicio, horario_fim
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                RETURNING id
              `,
              values: [
                eventoId,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
              ],
            }
          );

          const turmaId = ins.rows[0].id;

          if (ordenadas.length) {
            await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [turmaId]);

            for (const d of ordenadas) {
              await client.query(
                `
                INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
                VALUES ($1,$2,$3,$4)
                `,
                [
                  turmaId,
                  d.data,
                  d.horario_inicio || hiPayload || "08:00",
                  d.horario_fim || hfPayload || "17:00",
                ]
              );
            }
          }

          const instrutores = toIdArray(t.instrutores);
          await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [turmaId]);

          for (const instrutorId of instrutores) {
            await client.query(
              `
              INSERT INTO turma_instrutor (turma_id, instrutor_id)
              VALUES ($1,$2) ON CONFLICT DO NOTHING
              `,
              [turmaId, instrutorId]
            );
          }

          if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
            const assinanteId = Number(t.instrutor_assinante_id);
            if (instrutores.includes(assinanteId)) {
              await execIgnoreMissing(
                client,
                `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
                [turmaId, assinanteId]
              );
            }
          }

          continue;
        }

        await client.query(
          `
          UPDATE turmas
          SET nome=$2, vagas_total=$3, carga_horaria=$4,
              data_inicio=$5, data_fim=$6,
              horario_inicio=$7, horario_fim=$8
          WHERE id=$1
          `,
          [tid, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload]
        );

        if (ordenadas.length) {
          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [tid]);

          for (const d of ordenadas) {
            await client.query(
              `
              INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
              VALUES ($1,$2,$3,$4)
              `,
              [
                tid,
                d.data,
                d.horario_inicio || hiPayload || "08:00",
                d.horario_fim || hfPayload || "17:00",
              ]
            );
          }
        }

        if (Array.isArray(t?.instrutores)) {
          const novos = new Set(toIdArray(t.instrutores));

          const { rows: atuaisRows } = await client.query(
            `SELECT instrutor_id FROM turma_instrutor WHERE turma_id=$1`,
            [tid]
          );

          const atuaisSet = new Set(atuaisRows.map((r) => Number(r.instrutor_id)));

          for (const oldId of atuaisSet) {
            if (!novos.has(oldId)) {
              await client.query(
                `DELETE FROM turma_instrutor WHERE turma_id=$1 AND instrutor_id=$2`,
                [tid, oldId]
              );
            }
          }

          for (const newId of novos) {
            if (!atuaisSet.has(newId)) {
              await client.query(
                `
                INSERT INTO turma_instrutor (turma_id, instrutor_id)
                VALUES ($1,$2) ON CONFLICT DO NOTHING
                `,
                [tid, newId]
              );
            }
          }
        }

        if (Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")) {
          const raw = t.instrutor_assinante_id;

          if (raw === null) {
            await execIgnoreMissing(
              client,
              `UPDATE turmas SET instrutor_assinante_id=NULL WHERE id=$1`,
              [tid]
            );
          } else if (Number.isFinite(Number(raw))) {
            const assinanteId = Number(raw);

            const chk = await client.query(
              `
              SELECT 1
              FROM turma_instrutor
              WHERE turma_id=$1 AND instrutor_id=$2
              LIMIT 1
              `,
              [tid, assinanteId]
            );

            await execIgnoreMissing(
              client,
              `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
              [tid, chk.rowCount > 0 ? assinanteId : null]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    logInfo(rid, "atualizarEvento OK", { eventoId });

    return res.json({
      ok: true,
      mensagem: "Evento atualizado com sucesso.",
    });
  } catch (err) {
    logError(rid, "atualizarEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}

    return res.status(500).json({
      erro: "Erro ao atualizar evento",
      ...(IS_DEV
        ? {
            detalhe: err?.message,
            code: err?.code,
            constraint: err?.constraint,
            detail: err?.detail,
            where: err?.where,
          }
        : {}),
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🗑️ Excluir evento
===================================================================== */
async function excluirEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "ID inválido" });
  }

  logStart(rid, "excluirEvento", { id });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM inscricoes WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM turma_instrutor WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(`DELETE FROM turmas WHERE evento_id=$1`, [id]);

    await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [id]);
    await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [id]);
    await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [id]);

    const result = await client.query(`DELETE FROM eventos WHERE id=$1 RETURNING *`, [id]);
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Evento não encontrado" });
    }

    await client.query("COMMIT");
    logInfo(rid, "excluirEvento OK");

    return res.json({
      mensagem: "Evento excluído com sucesso",
      evento: result.rows[0],
    });
  } catch (err) {
    logError(rid, "excluirEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}

    return res.status(500).json({ erro: "Erro ao excluir evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📣 Publicar / Despublicar
===================================================================== */
async function publicarEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) return res.status(403).json({ erro: "PERMISSAO_NEGADA" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  try {
    const r = await query(
      `UPDATE eventos SET publicado=TRUE WHERE id=$1 RETURNING id, publicado`,
      [id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    }

    return res.json({
      ok: true,
      mensagem: "Evento publicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    logError(rid, "publicarEvento erro", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

async function despublicarEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) return res.status(403).json({ erro: "PERMISSAO_NEGADA" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  try {
    const r = await query(
      `UPDATE eventos SET publicado=FALSE WHERE id=$1 RETURNING id, publicado`,
      [id]
    );

    if (!r.rowCount) {
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    }

    return res.json({
      ok: true,
      mensagem: "Evento despublicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    logError(rid, "despublicarEvento erro", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

/* =====================================================================
   📎 Atualizar somente arquivos
===================================================================== */
async function atualizarArquivosDoEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  const folderFile =
    req._folderFile ||
    ((req.file && (req.file.fieldname === "folder" || req.file.fieldname === "file"))
      ? req.file
      : null);

  const progPdfUrl = pegarUploadUrl(req, "programacao");

  if (!folderFile?.buffer?.length && !progPdfUrl) {
    return res.status(400).json({ erro: "Nenhum arquivo enviado." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const setCols = [];
    const params = [id];

    if (folderFile?.buffer?.length) {
      await salvarFolderNoEvento(client, id, folderFile);
      setCols.push(`folder_url = NULL`);
    }

    if (progPdfUrl) {
      setCols.push(`programacao_pdf_url = $${params.length + 1}`);
      params.push(progPdfUrl);
    }

    const sql = setCols.length
      ? `UPDATE eventos SET ${setCols.join(", ")} WHERE id = $1 RETURNING id, folder_url, programacao_pdf_url`
      : `SELECT id, folder_url, programacao_pdf_url FROM eventos WHERE id = $1`;

    const r = await client.query(sql, params);

    if (!r.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Evento não encontrado." });
    }

    await client.query("COMMIT");
    logInfo(rid, "atualizarArquivosDoEvento OK", { id });

    return res.json({
      ok: true,
      mensagem: "Arquivos do evento atualizados.",
      arquivos: r.rows[0],
    });
  } catch (err) {
    logError(rid, "atualizarArquivosDoEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}

    return res.status(500).json({ erro: "Erro ao atualizar arquivos do evento." });
  } finally {
    client.release();
  }
}

/* =====================================================================
   👥 Listar instrutores disponíveis
===================================================================== */
async function listarInstrutoresDisponiveis(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) {
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  logStart(rid, "listarInstrutoresDisponiveis");

  try {
    const sqlPerfisArray = `
      SELECT id, nome, email
      FROM usuarios
      WHERE
        ('instrutor' = ANY(perfis))
        OR ('administrador' = ANY(perfis))
      ORDER BY nome ASC
    `;

    const sqlPerfilString = `
      SELECT id, nome, email
      FROM usuarios
      WHERE
        lower(coalesce(perfil,'')) IN ('instrutor','administrador')
        OR lower(coalesce(perfil,'')) LIKE '%instrutor%'
        OR lower(coalesce(perfil,'')) LIKE '%administrador%'
      ORDER BY nome ASC
    `;

    const sqlPorVinculoTurmaInstrutor = `
      SELECT DISTINCT u.id, u.nome, u.email
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      ORDER BY u.nome ASC
    `;

    let rows = [];

    try {
      ({ rows } = await query(sqlPerfisArray, []));
      if (rows?.length) {
        logInfo(rid, "listarInstrutoresDisponiveis via usuarios.perfis", {
          count: rows.length,
        });
        return res.json(rows);
      }
    } catch (e) {
      if (e?.code !== "42703") throw e;
      logWarn(rid, "usuarios.perfis não existe (ok, fallback)", { code: e?.code });
    }

    try {
      ({ rows } = await query(sqlPerfilString, []));
      if (rows?.length) {
        logInfo(rid, "listarInstrutoresDisponiveis via usuarios.perfil", {
          count: rows.length,
        });
        return res.json(rows);
      }
    } catch (e) {
      if (e?.code !== "42703") throw e;
      logWarn(rid, "usuarios.perfil não existe (ok, fallback)", { code: e?.code });
    }

    ({ rows } = await query(sqlPorVinculoTurmaInstrutor, []));
    logInfo(rid, "listarInstrutoresDisponiveis via turma_instrutor", {
      count: rows.length,
    });

    return res.json(rows || []);
  } catch (err) {
    logError(rid, "listarInstrutoresDisponiveis erro", err);
    return res.status(500).json({ erro: "Erro ao listar instrutores disponíveis." });
  }
}

/* =====================================================================
   ✅ Exports do controller admin
===================================================================== */
module.exports = {
  uploadEventos,
  uploadFolderOnly,
  uploadProgramacaoOnly,

  listarEventosAdmin,
  criarEvento,
  atualizarEvento,
  excluirEvento,
  publicarEvento,
  despublicarEvento,
  atualizarArquivosDoEvento,
  listarInstrutoresDisponiveis,

  // helpers úteis
  normalizeBodyMultipart,
  resolveCargoIds,
  salvarFolderNoEvento,
  limparFolderDoEvento,
  pegarUploadUrl,
};