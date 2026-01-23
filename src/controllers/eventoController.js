/* eslint-disable no-console */
// ✅ src/controllers/eventoController.js — PREMIUM (robusto, seguro, sem duplicações)
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const dbMod = require("../db");
// Compat: alguns lugares exportam { pool, query }, outros { db } etc.
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function" || !pool?.connect) {
  console.error("[eventoController] db inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em src/controllers/eventoController.js (pool/query ausentes)");
}

const { EVENTOS_DIR } = require("../paths");
const { normalizeRegistro, normalizeListaRegistros } = require("../utils/registro");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ====================== Paths / Uploads ====================== */
const UP_BASE = EVENTOS_DIR;
try {
  fs.mkdirSync(UP_BASE, { recursive: true });
} catch (e) {
  console.error("[eventoController] Falha ao garantir diretório de uploads:", UP_BASE, e?.message);
}

/* ====================== Logger util (RID) ====================== */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function _log(rid, level, msg, extra) {
  const hasExtra = extra && Object.keys(extra).length;
  const prefix = `[EVT][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, hasExtra ? extra : "");
  if (level === "info") return console.log(`${prefix} • ${msg}`, hasExtra ? extra : "");
  return console.log(`${prefix} ▶ ${msg}`, hasExtra ? extra : "");
}
const logStart = (rid, msg, extra) => _log(rid, "start", msg, extra);
const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logError = (rid, msg, err) => _log(rid, "error", msg, err);

/* ====================== Datas/Horários (date-only safe) ====================== */
function hhmm(s, fb = "") {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || "";
}
function toYmd(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}
function toHm(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 5);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ====================== Helpers arrays ====================== */
const toIntArray = (v) =>
  Array.isArray(v) ? v.map((n) => Number(n)).filter(Number.isFinite) : [];

const toIdArray = (v) =>
  Array.isArray(v)
    ? v
        .map((x) => (typeof x === "object" && x !== null ? x.id : x))
        .map((n) => Number(n))
        .filter(Number.isFinite)
    : [];

/* ====================== Perfis/Usuário ====================== */
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
const getUsuarioId = (req) => req.user?.id ?? null;

/* ====================== DB defensive helpers ====================== */
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
        : { data: toYmd(e?.data), horario_inicio: hhmm(e?.inicio || ""), horario_fim: hhmm(e?.fim || "") }
    );
  }
  return [];
}

/* ====================== Uploads premium (Multer) ====================== */
const MAX_FILE_MB = 15;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

function sanitizeBaseName(name = "arquivo") {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext);
  return base.replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_").slice(0, 80) || "arquivo";
}

const allowedFolderExt = new Set([".png", ".jpg", ".jpeg"]);
const allowedFolderMime = new Set(["image/png", "image/jpeg"]);
const allowedPdfExt = new Set([".pdf"]);
const allowedPdfMime = new Set(["application/pdf"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UP_BASE),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = sanitizeBaseName(file.originalname || "arquivo");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (file.fieldname === "folder") {
    if (!allowedFolderExt.has(ext) || !allowedFolderMime.has(mime)) {
      return cb(new Error("Imagem do folder deve ser PNG/JPG"));
    }
    return cb(null, true);
  }

  if (file.fieldname === "programacao") {
    if (!allowedPdfExt.has(ext) || !allowedPdfMime.has(mime)) {
      return cb(new Error("Arquivo de programação deve ser PDF"));
    }
    return cb(null, true);
  }

  if (file.fieldname === "file") {
    const ok =
      (allowedFolderExt.has(ext) && allowedFolderMime.has(mime)) ||
      (allowedPdfExt.has(ext) && allowedPdfMime.has(mime));
    if (!ok) return cb(new Error("Arquivo inválido (use PNG/JPG ou PDF)."));
    return cb(null, true);
  }

  return cb(new Error("Campo de upload inválido."));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES },
});

const uploadEventos = (req, res, next) => {
  const rid = mkRid();
  const handler = upload.fields([
    { name: "folder", maxCount: 1 },
    { name: "programacao", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (!err) return next();
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `Arquivo excede o limite de ${MAX_FILE_MB}MB.`
        : err.message || "Falha no upload.";
    logWarn(rid, "uploadEventos erro", { message: msg, code: err.code });
    return res.status(400).json({ erro: msg });
  });
};

function pegarUploadUrl(req, field) {
  const fSpecific = req.files?.[field]?.[0];
  const fGeneric = req.files?.file?.[0];

  // ✅ (NOVO) — linha anterior incluída acima
  const fSingle =
    req.file && (req.file.fieldname === field || (field === "file" && req.file.fieldname === "file"))
      ? req.file
      : null;

  const f = fSpecific || fSingle || fGeneric;
  if (!f) return null;
  return `/uploads/eventos/${path.basename(f.path)}`;
}

/* ====================== Visibilidade ====================== */
const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

/* ====================== ACL: podeVerEvento ====================== */
async function podeVerEvento({ client, usuarioId, eventoId, req }) {
  const admin = isAdmin(req);

  const evQ = await client.query(
    `SELECT id, restrito, restrito_modo, publicado,
            COALESCE(cargos_permitidos_ids, '{}')   AS cargos_permitidos_ids,
            COALESCE(unidades_permitidas_ids, '{}') AS unidades_permitidas_ids
       FROM eventos
      WHERE id=$1`,
    [eventoId]
  );
  const evento = evQ.rows[0];
  if (!evento) return { ok: false, motivo: "EVENTO_NAO_ENCONTRADO" };
  if (!admin && !evento.publicado) return { ok: false, motivo: "NAO_PUBLICADO" };
  if (admin || !evento.restrito) return { ok: true };
  if (!usuarioId) return { ok: false, motivo: "NAO_AUTENTICADO" };

  const uQ = await client.query(
    `SELECT registro, cargo_id, unidade_id
       FROM usuarios
      WHERE id=$1`,
    [usuarioId]
  );
  const usuario = uQ.rows?.[0] || {};
  const regNorm = normalizeRegistro(usuario.registro || "");
  const cargoId = Number(usuario.cargo_id) || null;
  const unidadeId = usuario.unidade_id ?? null;

  if (evento.restrito_modo === MODO_TODOS) {
    if (regNorm) return { ok: true };
  }

  if (evento.restrito_modo === MODO_LISTA) {
    if (regNorm) {
      const hit = await client.query(
        `SELECT 1 FROM evento_registros WHERE evento_id=$1 AND registro_norm=$2 LIMIT 1`,
        [eventoId, regNorm]
      );
      if (hit.rowCount > 0) return { ok: true };
    }
  }

  const cargosIdsPermitidos = Array.isArray(evento.cargos_permitidos_ids) ? evento.cargos_permitidos_ids : [];
  const unidadesIdsPermitidas = Array.isArray(evento.unidades_permitidas_ids) ? evento.unidades_permitidas_ids : [];

  if (cargoId && cargosIdsPermitidos.includes(cargoId)) return { ok: true };
  if (unidadeId != null && unidadesIdsPermitidas.includes(unidadeId)) return { ok: true };

  return { ok: false, motivo: "SEM_PERMISSAO" };
}

/* =====================================================================
   📄 Listar todos os eventos (resumo)
   ===================================================================== */
async function listarEventos(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);
  logStart(rid, "listarEventos", { usuarioId, admin });

  const richSQL = `
    WITH minhas_turmas AS (
      SELECT DISTINCT t.evento_id
      FROM turmas t
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      WHERE ti.instrutor_id = $2
    )
    SELECT 
      e.*,
      COALESCE((
        SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
        FROM evento_registros er WHERE er.evento_id = e.id
      ), '{}'::text[]) AS registros_permitidos,
      (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id) AS count_registros_permitidos,
      e.cargos_permitidos_ids,
      e.unidades_permitidas_ids,
      COALESCE((
        SELECT json_agg(json_build_object('id', c.id, 'nome', c.nome) ORDER BY c.nome)
        FROM cargos c
        WHERE c.id = ANY(e.cargos_permitidos_ids)
      ), '[]'::json) AS cargos_permitidos,
      COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
        FROM turmas t2
        JOIN turma_instrutor ti2 ON ti2.turma_id = t2.id
        JOIN usuarios u ON u.id = ti2.instrutor_id
        WHERE t2.evento_id = e.id
      ), '[]'::json) AS instrutor,
      COALESCE((
        SELECT json_agg(json_build_object('id', u2.id, 'nome', u2.nome) ORDER BY u2.nome)
        FROM unidades u2
        WHERE u2.id = ANY(e.unidades_permitidas_ids)
      ), '[]'::json) AS unidades_permitidas,
      (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
      (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
      (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
      (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
      CASE
        WHEN CURRENT_TIMESTAMP::timestamp < (
          SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= (
          SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,
      (
        SELECT COUNT(*) > 0
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1 AND t.evento_id = e.id
      ) AS ja_inscrito,
      (
        SELECT COUNT(*) > 0
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE t.evento_id = e.id AND ti.instrutor_id = $2
      ) AS ja_instrutor
    FROM eventos e
    WHERE ${admin ? "TRUE" : "(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM minhas_turmas))"}
    ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
              FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
             e.id DESC;
  `;

  const compatSQL = `
    SELECT
      e.*,
      (SELECT MIN(t.data_inicio) FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
      (SELECT MAX(t.data_fim)    FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
      (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
      (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
      CASE
        WHEN CURRENT_TIMESTAMP::timestamp < (
          SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= (
          SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'andamento'
        ELSE 'encerrado'
      END AS status
    FROM eventos e
    ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
              FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
             e.id DESC;
  `;

  try {
    const r = await query(richSQL, [usuarioId, usuarioId]);
    logInfo(rid, "listarEventos OK", { count: r.rowCount });
    return res.json(r.rows);
  } catch (err) {
    const pgCode = err?.code;
    logWarn(rid, "listarEventos fallback", { pgCode });
    if (pgCode === "42P01" || pgCode === "42703") {
      const r2 = await query(compatSQL, []);
      logInfo(rid, "listarEventos compat OK", { count: r2.rowCount });
      return res.json(r2.rows);
    }
    logError(rid, "listarEventos erro", err);
    return res.status(500).json({ erro: "Erro ao listar eventos" });
  }
}

/* =====================================================================
   🆕 Listar “para mim” (respeita restrição)
   ===================================================================== */
async function listarEventosParaMim(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ ok: false, erro: "NAO_AUTENTICADO" });

  const client = await pool.connect();
  try {
    logStart(rid, "listarEventosParaMim", { usuarioId });

    const { rows: base } = await client.query(`SELECT id FROM eventos WHERE publicado = TRUE`);
    const visiveis = [];

    for (const r of base) {
      const pode = await podeVerEvento({ client, usuarioId, eventoId: r.id, req });
      if (pode.ok) visiveis.push(r.id);
    }

    if (!visiveis.length) {
      logInfo(rid, "listarEventosParaMim vazio");
      return res.json({ ok: true, eventos: [] });
    }

    const sql = `
      SELECT 
        e.*,
        (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
        (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
        (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
        (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < (
            SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= (
            SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      FROM eventos e
      WHERE e.id = ANY($1::int[])
      ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
                FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST, e.id DESC;
    `;
    const { rows } = await client.query(sql, [visiveis]);
    logInfo(rid, "listarEventosParaMim OK", { count: rows.length });
    return res.json({ ok: true, eventos: rows });
  } catch (err) {
    logError(rid, "listarEventosParaMim erro", err);
    return res.status(500).json({ ok: false, erro: "ERRO_INTERNO" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ➕ Criar evento
   ===================================================================== */
async function criarEvento(req, res) {
  const rid = mkRid();
  const body = req.body || {};

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

  if (!titulo?.trim()) return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  if (!local?.trim()) return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  if (!tipo?.trim()) return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  if (!unidade_id) return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });

  const turmasArr = Array.isArray(turmas) ? turmas : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const folderUrl = pegarUploadUrl(req, "folder");
    const progPdfUrl = pegarUploadUrl(req, "programacao");

    logInfo(rid, "criarEvento payload pós-curso", {
      pos_curso_tipo: body?.pos_curso_tipo,
      has_teste_config: !!body?.teste_config,
      teste_config_keys: body?.teste_config ? Object.keys(body.teste_config) : [],
    });

    const evIns = await client.query(
      `INSERT INTO eventos (
         titulo, descricao, local, tipo, unidade_id, publico_alvo,
         restrito, restrito_modo, publicado, folder_url, programacao_pdf_url,
         cargos_permitidos_ids, unidades_permitidas_ids
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12)
       RETURNING *`,
      [
        titulo.trim(),
        (descricao || "").trim(),
        local.trim(),
        tipo.trim(),
        unidade_id,
        (publico_alvo || "").trim(),
        !!restrito,
        restrito ? restrito_modo || null : null,
        folderUrl,
        progPdfUrl,
        toIntArray(cargos_permitidos),
        toIntArray(unidades_permitidas),
    
            ]
    );
    

    const evento = evIns.rows[0];
    const eventoId = evento.id;

    // Registros (lista)
    if (restrito && restrito_modo === MODO_LISTA) {
      const input = typeof registros_permitidos !== "undefined" ? registros_permitidos : registros;
      const regList = normalizeListaRegistros(input);
      for (const r of regList) {
        await client.query(
          `INSERT INTO evento_registros (evento_id, registro_norm)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [eventoId, r]
        );
      }
      logInfo(rid, "evento_registros sincronizados", { count: regList.length });
    }

    // Legados (não quebrar se não existir)
    await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
    for (const cid of toIntArray(cargos_permitidos)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_cargos (evento_id, cargo) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, String(cid)]
      );
    }

    await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [eventoId]);
    for (const uid of toIntArray(unidades_permitidas)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_unidades (evento_id, unidade_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, uid]
      );
    }

    // Turmas
    let turmasCriadas = 0;

    for (const t of turmasArr) {
      const nome = String(t.nome || "Turma").trim();

      const vagas_total = Number.isFinite(Number(t.vagas_total ?? t.vagas))
        ? Number(t.vagas_total ?? t.vagas)
        : null;

      const carga_horaria = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : null;

      const baseDatas = extrairDatasDaTurma(t);
      const ordenadas = [...baseDatas].filter((d) => d.data).sort((a, b) => a.data.localeCompare(b.data));

      const data_inicio = ordenadas[0]?.data ?? t.data_inicio ?? null;
      const data_fim = ordenadas.at(-1)?.data ?? t.data_fim ?? null;

      const hiPayload = hhmm(t?.horario_inicio || "") || null;
      const hfPayload = hhmm(t?.horario_fim || "") || null;

      const insTurma = await tryQueryWithFallback(
        client,
        {
          text: `INSERT INTO turmas (
                   evento_id, nome, vagas_total, carga_horaria,
                   data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 RETURNING id`,
          values: [eventoId, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload, null],
        },
        {
          text: `INSERT INTO turmas (
                   evento_id, nome, vagas_total, carga_horaria,
                   data_inicio, data_fim, horario_inicio, horario_fim
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 RETURNING id`,
          values: [eventoId, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload],
        }
      );

      const turmaId = insTurma.rows[0].id;

      // Datas (se vierem)
      for (const d of ordenadas) {
        const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
        const fimSeguro = d.horario_fim || hfPayload || "17:00";
        await client.query(
          `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
           VALUES ($1,$2,$3,$4)`,
          [turmaId, d.data, inicioSeguro, fimSeguro]
        );
      }

      // Instrutores
      const instrutores = toIdArray(Array.isArray(t?.instrutores) ? t.instrutores : []);
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turmaId, instrutorId]
        );
      }

      // Assinante (só se for instrutor da turma)
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

    return res.status(201).json({ mensagem: "Evento criado com sucesso", evento });
  } catch (err) {
    logError(rid, "criarEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(500).json({ erro: "Erro ao criar evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar por ID (com listas, turmas e flags)
   ===================================================================== */
async function buscarEventoPorId(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" });

  const client = await pool.connect();
  try {
    logStart(rid, "buscarEventoPorId", { id, usuarioId, admin });

    const eventoResult = await client.query(`SELECT * FROM eventos WHERE id=$1`, [id]);
    if (eventoResult.rowCount === 0) return res.status(404).json({ erro: "Evento não encontrado" });

    const evento = eventoResult.rows[0];

    if (!admin && !evento.publicado) return res.status(404).json({ erro: "NAO_PUBLICADO" });

    // ACL (se não for instrutor do evento)
    if (!admin && usuarioId) {
      const isInstrutorEv =
        (
          await client.query(
            `SELECT 1
               FROM turmas t
               JOIN turma_instrutor ti ON ti.turma_id = t.id
              WHERE t.evento_id = $1 AND ti.instrutor_id = $2
              LIMIT 1`,
            [id, usuarioId]
          )
        ).rowCount > 0;

      if (!isInstrutorEv) {
        const can = await podeVerEvento({ client, usuarioId, eventoId: id, req });
        if (!can.ok) return res.status(403).json({ erro: "Evento restrito." });
      }
    }

    const [regsQ, cargosRows, unidadesRows, instrEventoQ] = await Promise.all([
      client.query(`SELECT registro_norm FROM evento_registros WHERE evento_id=$1 ORDER BY registro_norm`, [id]),
      client.query(
        `SELECT id, nome, codigo FROM cargos WHERE id = ANY($1) ORDER BY nome`,
        [Array.isArray(evento.cargos_permitidos_ids) ? evento.cargos_permitidos_ids : []]
      ),
      client.query(
        `SELECT id, nome FROM unidades WHERE id = ANY($1) ORDER BY nome`,
        [Array.isArray(evento.unidades_permitidas_ids) ? evento.unidades_permitidas_ids : []]
      ),
      client.query(
        `SELECT DISTINCT u.id, u.nome
           FROM turmas t
           JOIN turma_instrutor ti ON ti.turma_id = t.id
           JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE t.evento_id = $1
          ORDER BY u.nome`,
        [id]
      ),
    ]);

    const turmasResult = await tryQueryWithFallback(
      client,
      {
        text: `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                      vagas_total, carga_horaria, instrutor_assinante_id
                 FROM turmas
                WHERE evento_id=$1
                ORDER BY data_inicio NULLS LAST, id`,
        values: [id],
      },
      {
        text: `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                      vagas_total, carga_horaria
                 FROM turmas
                WHERE evento_id=$1
                ORDER BY data_inicio NULLS LAST, id`,
        values: [id],
      }
    );

    const turmaIds = turmasResult.rows.map((t) => t.id);

    const [datasAll, instrAll, inscritosAll] = turmaIds.length
      ? await Promise.all([
          client.query(
            `SELECT turma_id,
                    to_char(data::date,'YYYY-MM-DD') AS data,
                    to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                    to_char(horario_fim,'HH24:MI')   AS horario_fim
               FROM datas_turma
              WHERE turma_id = ANY($1::int[])
              ORDER BY turma_id, data ASC`,
            [turmaIds]
          ),
          client.query(
            `SELECT ti.turma_id, u.id, u.nome, u.email
               FROM turma_instrutor ti
               JOIN usuarios u ON u.id = ti.instrutor_id
              WHERE ti.turma_id = ANY($1::int[])
              ORDER BY ti.turma_id, u.nome`,
            [turmaIds]
          ),
          client.query(
            `SELECT turma_id, COUNT(*)::int AS inscritos
               FROM inscricoes
              WHERE turma_id = ANY($1::int[])
              GROUP BY turma_id`,
            [turmaIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({ data: r.data, horario_inicio: r.horario_inicio, horario_fim: r.horario_fim });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrByTurma = new Map();
    for (const r of instrAll.rows) {
      const arr = instrByTurma.get(r.turma_id) || [];
      arr.push({ id: r.id, nome: r.nome, email: r.email });
      instrByTurma.set(r.turma_id, arr);
    }

    const inscritosByTurma = new Map();
    for (const r of inscritosAll.rows) inscritosByTurma.set(r.turma_id, Number(r.inscritos || 0));

    const turmas = turmasResult.rows.map((t) => {
      const datas = datasByTurma.get(t.id) || [];
      const instrutores = instrByTurma.get(t.id) || [];
      const inscritos = inscritosByTurma.get(t.id) || 0;

      const vagasTotal = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;

      const assinanteId =
        Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id") ? Number(t.instrutor_assinante_id) : null;

      const assinante =
        Number.isFinite(assinanteId) ? instrutores.find((i) => i.id === assinanteId) || null : null;

      return {
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),

        instrutores,
        instrutor_assinante: assinante,
        instrutor_assinante_id: assinante ? assinante.id : null,

        datas,
        encontros_count: datas.length,

        inscritos,
        vagas_preenchidas: inscritos,
        vagas_disponiveis: Math.max(vagasTotal - inscritos, 0),
      };
    });

    const [jaInstrutorResult, jaInscritoResult] = await Promise.all([
      client.query(
        `SELECT EXISTS(
           SELECT 1
             FROM turmas t
             JOIN turma_instrutor ti ON ti.turma_id = t.id
            WHERE t.evento_id = $1
              AND ti.instrutor_id = $2
        ) AS eh`,
        [id, usuarioId || 0]
      ),
      client.query(
        `SELECT EXISTS(
           SELECT 1
             FROM inscricoes i
             JOIN turmas t ON t.id = i.turma_id
            WHERE t.evento_id = $1
              AND i.usuario_id = $2
        ) AS eh`,
        [id, usuarioId || 0]
      ),
    ]);
    
    // ✅ (NOVO) — linha anterior incluída acima
    const qz = await client.query(
      `SELECT id, status, obrigatorio, min_nota, tentativas_max, tempo_minutos
         FROM questionarios_evento
        WHERE evento_id = $1
        ORDER BY id DESC
        LIMIT 1`,
      [id]
    );
    
    logInfo(rid, "buscarEventoPorId OK", {
      id,
      turmas: turmas.length,
      questionario_id: qz.rows?.[0]?.id ?? null,
    });
    
    return res.json({
      ...evento,
      registros_permitidos: regsQ.rows.map((r) => r.registro_norm),
      cargos_permitidos_ids: Array.isArray(evento.cargos_permitidos_ids) ? evento.cargos_permitidos_ids : [],
      unidades_permitidas_ids: Array.isArray(evento.unidades_permitidas_ids) ? evento.unidades_permitidas_ids : [],
      cargos_permitidos: cargosRows.rows,
      unidades_permitidas: unidadesRows.rows,
    
      // ✅ (NOVO)
      pos_curso: qz.rows?.[0]
        ? {
            questionario_id: qz.rows[0].id,
            status: qz.rows[0].status,
            obrigatorio: !!qz.rows[0].obrigatorio,
            min_nota: qz.rows[0].min_nota,
            tentativas_max: qz.rows[0].tentativas_max,
            tempo_minutos: qz.rows[0].tempo_minutos,
          }
        : null,
    
      instrutor: instrEventoQ.rows,
      turmas,
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    });
  
  } catch (err) {
    logError(rid, "buscarEventoPorId erro", err);
    return res.status(500).json({ erro: "Erro ao buscar evento por ID" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas do evento (inclui assinante, inscritos e datas)
   ===================================================================== */
async function listarTurmasDoEvento(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);
  const admin = isAdmin(req);

  if (!Number.isFinite(eventoId) || eventoId <= 0) return res.status(400).json({ erro: "evento_id inválido" });
  logStart(rid, "listarTurmasDoEvento", { eventoId, admin });

  try {
    const base = await query(
      `
      SELECT 
        t.id, t.evento_id, t.nome,
        t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria, t.instrutor_assinante_id,
        e.titulo, e.descricao, e.local
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      WHERE e.id = $1
        ${admin ? "" : "AND e.publicado = TRUE"}
      ORDER BY t.data_inicio NULLS LAST, t.id
      `,
      [eventoId]
    ).catch(async (e) => {
      if (e.code !== "42703") throw e;
      return query(
        `
        SELECT 
          t.id, t.evento_id, t.nome,
          t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          e.titulo, e.descricao, e.local
        FROM eventos e
        JOIN turmas t ON t.evento_id = e.id
        WHERE e.id = $1
          ${admin ? "" : "AND e.publicado = TRUE"}
        ORDER BY t.data_inicio NULLS LAST, t.id
        `,
        [eventoId]
      );
    });

    const turmaIds = base.rows.map((r) => r.id);

    const [datasAll, instrAll, inscritosAll] = turmaIds.length
      ? await Promise.all([
          query(
            `SELECT turma_id,
                    to_char(data::date,'YYYY-MM-DD') AS data,
                    to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                    to_char(horario_fim,'HH24:MI')   AS horario_fim
               FROM datas_turma
              WHERE turma_id = ANY($1::int[])
              ORDER BY turma_id, data ASC`,
            [turmaIds]
          ),
          query(
            `SELECT ti.turma_id, u.id, u.nome, u.email
               FROM turma_instrutor ti
               JOIN usuarios u ON u.id = ti.instrutor_id
              WHERE ti.turma_id = ANY($1::int[])
              ORDER BY ti.turma_id, u.nome`,
            [turmaIds]
          ),
          query(
            `SELECT turma_id, COUNT(*)::int AS inscritos
               FROM inscricoes
              WHERE turma_id = ANY($1::int[])
              GROUP BY turma_id`,
            [turmaIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({ data: r.data, horario_inicio: r.horario_inicio, horario_fim: r.horario_fim });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrByTurma = new Map();
    for (const r of instrAll.rows) {
      const arr = instrByTurma.get(r.turma_id) || [];
      arr.push({ id: r.id, nome: r.nome, email: r.email });
      instrByTurma.set(r.turma_id, arr);
    }

    const inscritosByTurma = new Map();
    for (const r of inscritosAll.rows) inscritosByTurma.set(r.turma_id, Number(r.inscritos || 0));

    const turmas = base.rows.map((r) => {
      const datas = datasByTurma.get(r.id) || [];
      const instrutores = instrByTurma.get(r.id) || [];
      const inscritos = inscritosByTurma.get(r.id) || 0;

      const vagasTotal = Number.isFinite(Number(r.vagas_total)) ? Number(r.vagas_total) : 0;
      const vagasDisponiveis = Math.max(vagasTotal - inscritos, 0);

      const hasAssCol = Object.prototype.hasOwnProperty.call(r, "instrutor_assinante_id");
      const assId = hasAssCol ? Number(r.instrutor_assinante_id) : null;
      const assinante = Number.isFinite(assId) ? instrutores.find((i) => i.id === assId) || null : null;

      return {
        id: r.id,
        evento_id: r.evento_id,
        nome: r.nome,
        titulo: r.titulo,
        descricao: r.descricao,
        local: r.local,
        vagas_total: r.vagas_total,
        carga_horaria: r.carga_horaria,
        data_inicio: toYmd(r.data_inicio),
        data_fim: toYmd(r.data_fim),
        horario_inicio: toHm(r.horario_inicio),
        horario_fim: toHm(r.horario_fim),

        instrutores,
        instrutor_assinante_id: hasAssCol ? (r.instrutor_assinante_id || null) : null,
        instrutor_assinante: assinante,

        datas,
        encontros_count: datas.length,

        inscritos,
        vagas_preenchidas: inscritos,
        vagas_disponiveis: vagasDisponiveis,
      };
    });

    logInfo(rid, "listarTurmasDoEvento OK", { turmas: turmas.length });
    return res.json(turmas);
  } catch (err) {
    logError(rid, "listarTurmasDoEvento erro", err);
    return res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}

/* =====================================================================
   🔁 Turmas simples (para cards/listas) — robusto a coluna opcional
   ===================================================================== */
async function listarTurmasSimples(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) {
    return res.status(400).json({ erro: "Parâmetro 'id' inválido." });
  }

  try {
    const primary = `
      SELECT
        t.id,
        t.nome,
        t.vagas_total,
        t.carga_horaria,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        COALESCE((SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id), 0) AS inscritos,
        COALESCE((SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id), 0) AS encontros_count,
        COALESCE((
          SELECT json_agg(json_build_object(
                   'data',          to_char(dt.data,'YYYY-MM-DD'),
                   'horario_inicio',to_char(dt.horario_inicio,'HH24:MI'),
                   'horario_fim',   to_char(dt.horario_fim,'HH24:MI')
                 ) ORDER BY dt.data)
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ), '[]'::json) AS datas,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome)
          FROM turma_instrutor ti
          JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE ti.turma_id = t.id
        ), '[]'::json) AS instrutores,
        t.instrutor_assinante_id
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
    `;

    const fallback = `
      SELECT
        t.id,
        t.nome,
        t.vagas_total,
        t.carga_horaria,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        COALESCE((SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id), 0) AS inscritos,
        COALESCE((SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id), 0) AS encontros_count,
        COALESCE((
          SELECT json_agg(json_build_object(
                   'data',          to_char(dt.data,'YYYY-MM-DD'),
                   'horario_inicio',to_char(dt.horario_inicio,'HH24:MI'),
                   'horario_fim',   to_char(dt.horario_fim,'HH24:MI')
                 ) ORDER BY dt.data)
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ), '[]'::json) AS datas,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome, 'email', u.email) ORDER BY u.nome)
          FROM turma_instrutor ti
          JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE ti.turma_id = t.id
        ), '[]'::json) AS instrutores,
        NULL::int AS instrutor_assinante_id
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.data_inicio NULLS LAST, t.id
    `;

    let rows;
    try {
      ({ rows } = await query(primary, [eventoId]));
    } catch (e) {
      if (e.code !== "42703") throw e;
      ({ rows } = await query(fallback, [eventoId]));
    }

    const out = (rows || []).map((t) => {
      const inscritos = Number(t.inscritos || 0);
      const vagasTotal = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
      return {
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),
        vagas_preenchidas: inscritos,
        vagas_disponiveis: Math.max(vagasTotal - inscritos, 0),
      };
    });

    return res.json(out);
  } catch (err) {
    logError(rid, "listarTurmasSimples erro", err);
    return res.status(500).json({ erro: "Falha ao listar turmas." });
  }
}

/* =====================================================================
   🔄 Atualizar evento (sem duplicações)
   ===================================================================== */
async function atualizarEvento(req, res) {
  const rid = mkRid();
  const eventoId = Number(req.params.id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  const body = req.body || {};
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
    logStart(rid, "atualizarEvento BEGIN", { eventoId, hasTurmas: Array.isArray(turmas), restrito, restrito_modo });
    await client.query("BEGIN");

    const folderUrl = pegarUploadUrl(req, "folder");
    const progPdfUrl = pegarUploadUrl(req, "programacao");

    const remover_folder = String(body?.remover_folder ?? "").toLowerCase() === "true";
    const remover_programacao = String(body?.remover_programacao ?? "").toLowerCase() === "true";

    const setCols = [
      `titulo       = COALESCE($2, titulo)`,
      `descricao    = COALESCE($3, descricao)`,
      `local        = COALESCE($4, local)`,
      `tipo         = COALESCE($5, tipo)`,
      `unidade_id   = COALESCE($6, unidade_id)`,
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

    if (folderUrl) {
      setCols.push(`folder_url = $${params.length + 1}`);
      params.push(folderUrl);
    } else if (remover_folder) {
      setCols.push(`folder_url = NULL`);
    }

    if (progPdfUrl) {
      setCols.push(`programacao_pdf_url = $${params.length + 1}`);
      params.push(progPdfUrl);
    } else if (remover_programacao) {
      setCols.push(`programacao_pdf_url = NULL`);
    }

    if (typeof cargos_permitidos !== "undefined") {
      setCols.push(`cargos_permitidos_ids = $${params.length + 1}`);
      params.push(toIntArray(cargos_permitidos));
    }
    
    // ✅ (NOVO) — linha anterior incluída acima
    // Pós-curso NÃO é coluna em eventos; só logamos e ignoramos o payload, sem tocar no SQL.
    const hasPosCursoTipo = Object.prototype.hasOwnProperty.call(body, "pos_curso_tipo");
    const hasTesteConfig = Object.prototype.hasOwnProperty.call(body, "teste_config");
    
    logInfo(rid, "atualizarEvento payload pós-curso (ignorado)", {
      has_pos_curso_tipo: hasPosCursoTipo,
      has_teste_config: hasTesteConfig,
      teste_config_type: hasTesteConfig ? typeof body.teste_config : null,
    });
    const upd = await client.query(`UPDATE eventos SET ${setCols.join(", ")} WHERE id = $1 RETURNING id`, params);
    if (!upd.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Evento não encontrado." });
    }

    // Sync restrições
    if (typeof restrito !== "undefined" && !restrito) {
      await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [eventoId]);
      await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
      await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [eventoId]);
    } else {
      if (restrito_modo === MODO_LISTA || typeof registros !== "undefined" || typeof registros_permitidos !== "undefined") {
        await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [eventoId]);
        const input = typeof registros_permitidos !== "undefined" ? registros_permitidos : registros;
        const regList = normalizeListaRegistros(input);
        for (const r of regList) {
          await client.query(
            `INSERT INTO evento_registros (evento_id, registro_norm)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, r]
          );
        }
      }

      if (typeof cargos_permitidos !== "undefined") {
        await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
        for (const cid of toIntArray(cargos_permitidos)) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_cargos (evento_id, cargo) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, String(cid)]
          );
        }
      }

      if (typeof unidades_permitidas !== "undefined") {
        await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [eventoId]);
        for (const uid of toIntArray(unidades_permitidas)) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_unidades (evento_id, unidade_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, uid]
          );
        }
      }
    }

    // Turmas (se vierem no payload)
    if (Array.isArray(turmas)) {
      const { rows: atuais } = await client.query(`SELECT id FROM turmas WHERE evento_id=$1`, [eventoId]);
      const payloadIds = new Set(turmas.filter((t) => Number.isFinite(Number(t.id))).map((t) => Number(t.id)));

      // Remove turmas ausentes (cascata manual)
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
        const ordenadas = [...baseDatas].filter((d) => d.data).sort((a, b) => a.data.localeCompare(b.data));

        const data_inicio = ordenadas[0]?.data ?? t.data_inicio ?? null;
        const data_fim = ordenadas.at(-1)?.data ?? t.data_fim ?? null;

        const nome = String(t.nome || "Turma").trim();
        const vagas_total = Number.isFinite(Number(t.vagas_total ?? t.vagas)) ? Number(t.vagas_total ?? t.vagas) : null;
        const carga_horaria = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : null;
        const hiPayload = hhmm(t?.horario_inicio || "") || null;
        const hfPayload = hhmm(t?.horario_fim || "") || null;

        // Nova turma
        if (!Number.isFinite(tid)) {
          const ins = await tryQueryWithFallback(
            client,
            {
              text: `INSERT INTO turmas (
                       evento_id, nome, vagas_total, carga_horaria,
                       data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
                     )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     RETURNING id`,
              values: [eventoId, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload, null],
            },
            {
              text: `INSERT INTO turmas (
                       evento_id, nome, vagas_total, carga_horaria,
                       data_inicio, data_fim, horario_inicio, horario_fim
                     )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     RETURNING id`,
              values: [eventoId, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload],
            }
          );
          const turmaId = ins.rows[0].id;

          if (ordenadas.length) {
            await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [turmaId]);
            for (const d of ordenadas) {
              await client.query(
                `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
                 VALUES ($1,$2,$3,$4)`,
                [turmaId, d.data, d.horario_inicio || hiPayload || "08:00", d.horario_fim || hfPayload || "17:00"]
              );
            }
          }

          const instrutores = toIdArray(t.instrutores);
          await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [turmaId]);
          for (const instrutorId of instrutores) {
            await client.query(
              `INSERT INTO turma_instrutor (turma_id, instrutor_id)
               VALUES ($1,$2) ON CONFLICT DO NOTHING`,
              [turmaId, instrutorId]
            );
          }

          if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
            const assinanteId = Number(t.instrutor_assinante_id);
            if (instrutores.includes(assinanteId)) {
              await execIgnoreMissing(client, `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`, [turmaId, assinanteId]);
            }
          }

          continue;
        }

        // Turma existente
        await client.query(
          `UPDATE turmas
              SET nome=$2, vagas_total=$3, carga_horaria=$4,
                  data_inicio=$5, data_fim=$6,
                  horario_inicio=$7, horario_fim=$8
            WHERE id=$1`,
          [tid, nome, vagas_total, carga_horaria, data_inicio, data_fim, hiPayload, hfPayload]
        );

        // Só mexe em datas_turma se veio algo
        if (ordenadas.length) {
          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [tid]);
          for (const d of ordenadas) {
            await client.query(
              `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
               VALUES ($1,$2,$3,$4)`,
              [tid, d.data, d.horario_inicio || hiPayload || "08:00", d.horario_fim || hfPayload || "17:00"]
            );
          }
        }

        // Instrutores: só sincroniza se veio no payload
        if (Array.isArray(t?.instrutores)) {
          const novos = new Set(toIdArray(t.instrutores));
          const { rows: atuaisRows } = await client.query(
            `SELECT instrutor_id FROM turma_instrutor WHERE turma_id=$1`,
            [tid]
          );
          const atuaisSet = new Set(atuaisRows.map((r) => Number(r.instrutor_id)));

          for (const oldId of atuaisSet) {
            if (!novos.has(oldId)) {
              await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1 AND instrutor_id=$2`, [tid, oldId]);
            }
          }
          for (const newId of novos) {
            if (!atuaisSet.has(newId)) {
              await client.query(
                `INSERT INTO turma_instrutor (turma_id, instrutor_id)
                 VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [tid, newId]
              );
            }
          }
        }

        // Assinante: só se veio
        if (Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")) {
          const raw = t.instrutor_assinante_id;
          if (raw === null) {
            await execIgnoreMissing(client, `UPDATE turmas SET instrutor_assinante_id=NULL WHERE id=$1`, [tid]);
          } else if (Number.isFinite(Number(raw))) {
            const assinanteId = Number(raw);
            const chk = await client.query(
              `SELECT 1 FROM turma_instrutor WHERE turma_id=$1 AND instrutor_id=$2 LIMIT 1`,
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
    return res.json({ ok: true, mensagem: "Evento atualizado com sucesso." });
  } catch (err) {
    logError(rid, "atualizarEvento erro", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(500).json({ erro: "Erro ao atualizar evento", detalhe: IS_DEV ? err?.message : undefined });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🗑️ Excluir evento
   ===================================================================== */
async function excluirEvento(req, res) {
  const rid = mkRid();
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" });

  logStart(rid, "excluirEvento", { id });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`, [id]);
    await client.query(`DELETE FROM inscricoes WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`, [id]);
    await client.query(`DELETE FROM turma_instrutor WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`, [id]);
    await client.query(`DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`, [id]);
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
    return res.json({ mensagem: "Evento excluído com sucesso", evento: result.rows[0] });
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
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  try {
    const r = await query(`UPDATE eventos SET publicado=TRUE WHERE id=$1 RETURNING id, publicado`, [id]);
    if (!r.rowCount) return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    return res.json({ ok: true, mensagem: "Evento publicado.", evento: r.rows[0] });
  } catch (e) {
    logError(rid, "publicarEvento erro", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

async function despublicarEvento(req, res) {
  const rid = mkRid();
  if (!isAdmin(req)) return res.status(403).json({ erro: "PERMISSAO_NEGADA" });

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  try {
    const r = await query(`UPDATE eventos SET publicado=FALSE WHERE id=$1 RETURNING id, publicado`, [id]);
    if (!r.rowCount) return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    return res.json({ ok: true, mensagem: "Evento despublicado.", evento: r.rows[0] });
  } catch (e) {
    logError(rid, "despublicarEvento erro", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

/* =====================================================================
   📆 Agenda (status por data+hora; ocorrências por prioridade)
   ===================================================================== */
async function getAgendaEventos(req, res) {
  const rid = mkRid();
  logStart(rid, "getAgendaEventos");

  const sql = `
    SELECT 
      e.id, e.titulo,
      MIN(t.data_inicio) AS data_inicio,
      MAX(t.data_fim)    AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim)    AS horario_fim,
      CASE 
        WHEN CURRENT_TIMESTAMP::timestamp < MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time)) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM turmas tx
          JOIN datas_turma dt ON dt.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(dt.data::date,'YYYY-MM-DD') AS d
            FROM turmas tx JOIN datas_turma dt ON dt.turma_id=tx.id
            WHERE tx.evento_id=e.id
          ) z1
        )
        WHEN EXISTS (
          SELECT 1 FROM turmas tx
          JOIN presencas p ON p.turma_id = tx.id
          WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(p.data_presenca::date,'YYYY-MM-DD') AS d
            FROM turmas tx JOIN presencas p ON p.turma_id=tx.id
            WHERE tx.evento_id=e.id
          ) z2
        )
        ELSE '[]'::json
      END AS ocorrencias
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    GROUP BY e.id, e.titulo
    ORDER BY MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) DESC NULLS LAST;
  `;

  try {
    const { rows } = await query(sql, []);
    const out = (rows || []).map((r) => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));
    logInfo(rid, "getAgendaEventos OK", { count: out.length });
    return res.json(out);
  } catch (err) {
    logError(rid, "getAgendaEventos erro", err);
    return res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
}

/* =====================================================================
   👩‍🏫 Eventos do instrutor (SEM N+1: turmas/datas/instrutores por lote)
   ===================================================================== */
async function listarEventosDoinstrutor(req, res) {
  const rid = mkRid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

  const client = await pool.connect();
  logStart(rid, "listarEventosDoinstrutor", { usuarioId });

  try {
    const eventosResult = await client.query(
      `
      SELECT DISTINCT
        e.*,
        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < (
            SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= (
            SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,
        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      WHERE ti.instrutor_id = $1
        AND e.publicado = TRUE
      ORDER BY e.id DESC
      `,
      [usuarioId]
    );

    const eventos = eventosResult.rows || [];
    if (!eventos.length) {
      logInfo(rid, "listarEventosDoinstrutor vazio");
      return res.json([]);
    }

    const eventoIds = eventos.map((e) => e.id);

    const turmasResult = await tryQueryWithFallback(
      client,
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria, instrutor_assinante_id
            FROM turmas
           WHERE evento_id = ANY($1::int[])
           ORDER BY evento_id, data_inicio NULLS LAST, id
        `,
        values: [eventoIds],
      },
      {
        text: `
          SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                 vagas_total, carga_horaria
            FROM turmas
           WHERE evento_id = ANY($1::int[])
           ORDER BY evento_id, data_inicio NULLS LAST, id
        `,
        values: [eventoIds],
      }
    );

    const turmas = turmasResult.rows || [];
    const turmaIds = turmas.map((t) => t.id);

    const [datasAll, instrByTurmaAll, instrEventoAll] = turmaIds.length
      ? await Promise.all([
          client.query(
            `SELECT turma_id,
                    to_char(data::date,'YYYY-MM-DD') AS data,
                    to_char(horario_inicio,'HH24:MI') AS horario_inicio,
                    to_char(horario_fim,'HH24:MI')   AS horario_fim
               FROM datas_turma
              WHERE turma_id = ANY($1::int[])
              ORDER BY turma_id, data ASC`,
            [turmaIds]
          ),
          client.query(
            `SELECT ti.turma_id, u.id, u.nome, u.email
               FROM turma_instrutor ti
               JOIN usuarios u ON u.id = ti.instrutor_id
              WHERE ti.turma_id = ANY($1::int[])
              ORDER BY ti.turma_id, u.nome`,
            [turmaIds]
          ),
          client.query(
            `SELECT t.evento_id, u.id, u.nome
               FROM turmas t
               JOIN turma_instrutor ti ON ti.turma_id = t.id
               JOIN usuarios u ON u.id = ti.instrutor_id
              WHERE t.evento_id = ANY($1::int[])
              GROUP BY t.evento_id, u.id, u.nome
              ORDER BY t.evento_id, u.nome`,
            [eventoIds]
          ),
        ])
      : [{ rows: [] }, { rows: [] }, { rows: [] }];

    const datasByTurma = new Map();
    for (const r of datasAll.rows) {
      const arr = datasByTurma.get(r.turma_id) || [];
      arr.push({ data: r.data, horario_inicio: r.horario_inicio, horario_fim: r.horario_fim });
      datasByTurma.set(r.turma_id, arr);
    }

    const instrTurmaMap = new Map();
    for (const r of instrByTurmaAll.rows) {
      const arr = instrTurmaMap.get(r.turma_id) || [];
      arr.push({ id: r.id, nome: r.nome, email: r.email });
      instrTurmaMap.set(r.turma_id, arr);
    }

    const instrEventoMap = new Map();
    for (const r of instrEventoAll.rows) {
      const arr = instrEventoMap.get(r.evento_id) || [];
      arr.push({ id: r.id, nome: r.nome });
      instrEventoMap.set(r.evento_id, arr);
    }

    const turmasByEvento = new Map();
    for (const t of turmas) {
      const arr = turmasByEvento.get(t.evento_id) || [];
      const instrutores = instrTurmaMap.get(t.id) || [];
      const assinanteId = Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")
        ? Number(t.instrutor_assinante_id)
        : null;
      const assinante = Number.isFinite(assinanteId) ? instrutores.find((i) => i.id === assinanteId) || null : null;

      arr.push({
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),
        datas: datasByTurma.get(t.id) || [],
        encontros_count: (datasByTurma.get(t.id) || []).length,
        instrutores,
        instrutor_assinante_id: assinante ? assinante.id : null,
        instrutor_assinante: assinante,
      });
      turmasByEvento.set(t.evento_id, arr);
    }

    const out = eventos.map((e) => ({
      ...e,
      instrutor: instrEventoMap.get(e.id) || [],
      turmas: turmasByEvento.get(e.id) || [],
    }));

    logInfo(rid, "listarEventosDoinstrutor OK", { eventos: out.length });
    return res.json(out);
  } catch (err) {
    logError(rid, "listarEventosDoinstrutor erro", err);
    return res.status(500).json({ erro: "Erro ao buscar eventos do instrutor" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📅 Datas da turma (3 vias: datas_turma | presencas | generate_series)
   ===================================================================== */
async function listarDatasDaTurma(req, res) {
  const rid = mkRid();
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "datas").toLowerCase();
  if (!Number.isFinite(turmaId) || turmaId <= 0) return res.status(400).json({ erro: "turma_id inválido" });

  logStart(rid, "listarDatasDaTurma", { turmaId, via });

  try {
    if (via === "datas") {
      const sql = `
        SELECT 
          to_char(dt.data,'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim,'HH24:MI')   AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id=$1
        ORDER BY dt.data ASC`;
      const { rows } = await query(sql, [turmaId]);
      logInfo(rid, "listarDatasDaTurma/datas OK", { count: rows.length });
      return res.json(rows);
    }

    if (via === "presencas") {
      // compat: alguns ambientes tinham p.data vs p.data_presenca
      const sqlA = `
        SELECT DISTINCT
          to_char(p.data::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI')   AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id=$1
        ORDER BY data ASC`;
      const sqlB = `
        SELECT DISTINCT
          to_char(p.data_presenca::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI')   AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id=$1
        ORDER BY data ASC`;

      try {
        const { rows } = await query(sqlA, [turmaId]);
        logInfo(rid, "listarDatasDaTurma/presencas A OK", { count: rows.length });
        return res.json(rows);
      } catch (e1) {
        try {
          const { rows } = await query(sqlB, [turmaId]);
          logInfo(rid, "listarDatasDaTurma/presencas B OK", { count: rows.length });
          return res.json(rows);
        } catch {
          logWarn(rid, "listarDatasDaTurma/presencas vazio");
          return res.json([]);
        }
      }
    }

    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date    AS df,
          to_char(horario_inicio,'HH24:MI') AS hi,
          to_char(horario_fim,'HH24:MI')   AS hf
        FROM turmas WHERE id=$1
      )
      SELECT to_char(gs::date,'YYYY-MM-DD') AS data, t.hi AS horario_inicio, t.hf AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC`;
    const { rows } = await query(sql, [turmaId]);
    logInfo(rid, "listarDatasDaTurma/generate_series OK", { count: rows.length });
    return res.json(rows);
  } catch (erro) {
    logError(rid, "listarDatasDaTurma erro", erro);
    return res.status(500).json({ erro: "Erro ao buscar datas da turma.", detalhe: IS_DEV ? erro.message : undefined });
  }
}

/* =====================================================================
   🔎 Sugestão de cargos
   ===================================================================== */
async function sugerirCargos(req, res) {
  const rid = mkRid();
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 20), 50);
  logStart(rid, "sugerirCargos", { q, limit });

  try {
    if (!q) {
      const sql = `
        SELECT cargo
        FROM (
          SELECT trim(cargo) AS cargo, COUNT(*) AS c
          FROM usuarios
          WHERE cargo IS NOT NULL AND trim(cargo) <> ''
          GROUP BY trim(cargo)
        ) x
        ORDER BY c DESC, cargo ASC
        LIMIT $1
      `;
      const { rows } = await query(sql, [limit]);
      logInfo(rid, "sugerirCargos sem q OK", { count: rows.length });
      return res.json(rows.map((r) => r.cargo));
    }

    const sql = `
      SELECT trim(cargo) AS cargo
      FROM usuarios
      WHERE cargo ILIKE $1
      GROUP BY trim(cargo)
      ORDER BY cargo ASC
      LIMIT $2
    `;
    const { rows } = await query(sql, [`%${q}%`, limit]);
    logInfo(rid, "sugerirCargos com q OK", { count: rows.length });
    return res.json(rows.map((r) => r.cargo));
  } catch (err) {
    logError(rid, "sugerirCargos erro", err);
    return res.status(500).json({ erro: "Erro ao sugerir cargos" });
  }
}

/* =====================================================================
   📎 Atualizar somente arquivos (folder/programação)
   ===================================================================== */
async function atualizarArquivosDoEvento(req, res) {
  const rid = mkRid();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
    }

    const folderUrl = pegarUploadUrl(req, "folder");
    const progPdfUrl = pegarUploadUrl(req, "programacao");

    if (!folderUrl && !progPdfUrl) {
      return res.status(400).json({ erro: "Nenhum arquivo enviado." });
    }

    const setCols = [];
    const params = [id];

    if (folderUrl) {
      setCols.push(`folder_url = $${params.length + 1}`);
      params.push(folderUrl);
    }
    if (progPdfUrl) {
      setCols.push(`programacao_pdf_url = $${params.length + 1}`);
      params.push(progPdfUrl);
    }

    const r = await query(
      `UPDATE eventos
          SET ${setCols.join(", ")}
        WHERE id = $1
        RETURNING id, folder_url, programacao_pdf_url`,
      params
    );

    logInfo(rid, "atualizarArquivosDoEvento", { id, rowCount: r.rowCount });
    if (r.rowCount === 0) {
      return res.status(404).json({ erro: "Evento não encontrado." });
    }

    return res.json({
      ok: true,
      mensagem: "Arquivos do evento atualizados.",
      arquivos: r.rows[0],
    });
  } catch (err) {
    logError(rid, "atualizarArquivosDoEvento erro", err);
    return res.status(500).json({ erro: "Erro ao atualizar arquivos do evento." });
  }
}

/* =====================================================================
   ✅ Export único (sem duplicações)
   ===================================================================== */
module.exports = {
  uploadEventos,

  listarEventos,
  listarEventosParaMim,

  criarEvento,
  buscarEventoPorId,
  atualizarEvento,
  excluirEvento,

  listarTurmasDoEvento,
  listarTurmasSimples,

  getAgendaEventos,
  listarEventosDoinstrutor,

  listarDatasDaTurma,
  publicarEvento,
  despublicarEvento,

  sugerirCargos,
  atualizarArquivosDoEvento,
};
