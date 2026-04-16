/* eslint-disable no-console */
"use strict";

/**
 * ✅ Controlador Único de Submissões (Admin + Avaliador + Usuário)
 * - Consolida submissões/admin/avaliador/autor
 * - Compatível com pg e pg-promise
 * - Resiliente a drift de schema/tabelas
 * - Mantém aliases legados
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* ───────────────── DB compat ───────────────── */
const dbModule = require("../db");
const pool =
  dbModule?.pool ||
  dbModule?.Pool ||
  dbModule?.db?.pool ||
  dbModule;

const query =
  dbModule?.query ||
  dbModule?.db?.query?.bind?.(dbModule.db) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[submissaoController] DB inválido:", Object.keys(dbModule || {}));
  throw new Error("DB inválido em submissaoController.js (query ausente)");
}

const rootDb = {
  query,
  oneOrNone: async (sql, params = []) => {
    const r = await query(sql, params);
    return r?.rows?.[0] || null;
  },
  one: async (sql, params = []) => {
    const r = await query(sql, params);
    if (!r?.rows?.[0]) throw new Error("ROW_NOT_FOUND");
    return r.rows[0];
  },
  any: async (sql, params = []) => {
    const r = await query(sql, params);
    return r?.rows || [];
  },
  none: async (sql, params = []) => {
    await query(sql, params);
  },
  result: async (sql, params = []) => {
    const r = await query(sql, params);
    return { rowCount: r?.rowCount || 0, rows: r?.rows || [] };
  },
};

async function getClientCompat() {
  const reqPool =
    dbModule?.pool ||
    dbModule?.Pool ||
    dbModule?.db?.pool ||
    null;

  if (reqPool?.connect && typeof reqPool.connect === "function") {
    return reqPool.connect();
  }

  return {
    query,
    release() {},
  };
}

async function withTx(fn) {
  const client = await getClientCompat();
  try {
    await client.query("BEGIN");

    const tx = {
      query: client.query.bind(client),
      oneOrNone: async (sql, params = []) => {
        const r = await client.query(sql, params);
        return r?.rows?.[0] || null;
      },
      one: async (sql, params = []) => {
        const r = await client.query(sql, params);
        if (!r?.rows?.[0]) throw new Error("ROW_NOT_FOUND");
        return r.rows[0];
      },
      any: async (sql, params = []) => {
        const r = await client.query(sql, params);
        return r?.rows || [];
      },
      none: async (sql, params = []) => {
        await client.query(sql, params);
      },
      result: async (sql, params = []) => {
        const r = await client.query(sql, params);
        return { rowCount: r?.rowCount || 0, rows: r?.rows || [] };
      },
    };

    const out = await fn(tx);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    throw e;
  } finally {
    try {
      client.release?.();
    } catch {}
  }
}

/* ───────────────── Schema discovery ───────────────── */
let _schemaCache = null;

async function tableExists(tableName, dbConn = rootDb) {
  const r = await dbConn.query(
    `
    SELECT to_regclass($1) IS NOT NULL AS ok
    `,
    [`public.${tableName}`]
  );
  return r?.rows?.[0]?.ok === true;
}

async function resolveSchema(dbConn = rootDb) {
  if (_schemaCache) return _schemaCache;

  const avaliadoresPlural = await tableExists("trabalhos_submissoes_avaliadores", dbConn);
  const avaliadoresSing = await tableExists("trabalhos_submissao_avaliadores", dbConn);

  const submissaoPlural = await tableExists("trabalhos_submissoes", dbConn);
  const submissaoSing = await tableExists("trabalhos_submissao", dbConn);

  _schemaCache = {
    submissoes: submissaoPlural ? "trabalhos_submissoes" : submissaoSing ? "trabalhos_submissao" : "trabalhos_submissoes",
    submissoesAvaliadores: avaliadoresPlural
      ? "trabalhos_submissoes_avaliadores"
      : avaliadoresSing
      ? "trabalhos_submissao_avaliadores"
      : "trabalhos_submissoes_avaliadores",
  };

  return _schemaCache;
}

/* ───────────────── Logs/Utils ───────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";
const DBG = String(process.env.DEBUG_submissao || "").trim() === "1";

function dbg(...a) {
  if (DBG) console.log("[submissao]", ...a);
}
function warn(...a) {
  console.warn("[submissao][WARN]", ...a);
}
function errlog(...a) {
  console.error("[submissao][ERR]", ...a);
}
const asInt = (v) => Number.parseInt(String(v ?? "").trim(), 10);
const isPosInt = (n) => Number.isInteger(n) && n > 0;

function httpError(status, message, extra) {
  const e = new Error(message);
  e.status = status;
  if (extra) e.extra = extra;
  return e;
}
function sendError(res, error, fallbackMsg = "Erro interno.") {
  const status = Number(error?.status) || 500;
  const payload = { error: error?.message || fallbackMsg };
  if (IS_DEV && error?.extra) payload.extra = error.extra;
  return res.status(status).json(payload);
}

function normPerfis(p) {
  if (Array.isArray(p)) return p.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof p === "string") return p.split(",").map((x) => x.toLowerCase().trim()).filter(Boolean);
  return [];
}
function getUserIdOptional(req) {
  const raw = req?.user?.id ?? req?.usuario?.id ?? req?.auth?.userId ?? req?.userId ?? null;
  const uid = Number(String(raw ?? "").trim());
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}
function getUserIdOrThrow(req) {
  const raw = req?.user?.id ?? req?.usuario?.id ?? req?.auth?.userId ?? req?.userId ?? null;
  if (raw == null) throw httpError(401, "Não autenticado.");
  const uid = Number(String(raw).trim());
  if (!Number.isFinite(uid) || uid <= 0) throw httpError(400, "id inválido.");
  return uid;
}

/* ───────────────── Permissões ───────────────── */
async function isAdmin(userOrId, dbConn = rootDb) {
  try {
    if (userOrId && typeof userOrId === "object") {
      const perfis = normPerfis(userOrId.perfil ?? userOrId.perfis);
      if (perfis.includes("administrador")) return true;
      const uid = Number(userOrId.id);
      if (!Number.isFinite(uid)) return false;
      userOrId = uid;
    }

    const userId = Number(userOrId);
    if (!Number.isFinite(userId) || userId <= 0) return false;

    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1
           FROM usuarios
          WHERE id=$1
            AND 'administrador' = ANY(string_to_array(LOWER(COALESCE(perfil,'')), ','))`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1 FROM usuarios WHERE id=$1 AND 'administrador' = ANY(perfis)`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1
           FROM usuarios u
           JOIN perfis p ON p.id = u.perfil_id
          WHERE u.id=$1 AND LOWER(p.nome)='administrador'`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    return false;
  } catch (e) {
    errlog("[isAdmin] erro:", e?.message || e);
    return false;
  }
}

async function canUserReviewOrView(userOrId, submissaoId, dbConn = rootDb) {
  try {
    if (await isAdmin(userOrId, dbConn)) return true;

    const uid = typeof userOrId === "object" ? Number(userOrId.id) : Number(userOrId);
    if (!Number.isFinite(uid) || uid <= 0) return false;

    const schema = await resolveSchema(dbConn);

    const variants = [
      `SELECT 1
         FROM ${schema.submissoesAvaliadores}
        WHERE submissao_id=$1
          AND avaliador_id=$2
          AND revoked_at IS NULL
        LIMIT 1`,
      `SELECT 1
         FROM ${schema.submissoesAvaliadores}
        WHERE submissao_id=$1
          AND avaliador_id=$2
        LIMIT 1`,
    ];

    for (const sql of variants) {
      try {
        const vinc = await dbConn.oneOrNone(sql, [submissaoId, uid]);
        if (vinc) return true;
      } catch (e) {
        if (["42703", "42P01"].includes(e?.code)) continue;
        throw e;
      }
    }

    return false;
  } catch (e2) {
    errlog("[canUserReviewOrView] erro:", e2?.message || e2);
    return false;
  }
}

/* ───────────────── Flags derivadas ───────────────── */
function deriveAprovFlags(row) {
  const st = String(row?.status || "").toLowerCase();
  const se = String(row?.status_escrita || "").toLowerCase();
  const so = String(row?.status_oral || "").toLowerCase();
  const exposicaoAprovada = se === "aprovado" || st === "aprovado_exposicao" || st === "aprovado_escrita";
  const oralAprovada = so === "aprovado" || st === "aprovado_oral";
  return { _exposicao_aprovada: exposicaoAprovada, _oral_aprovada: oralAprovada };
}

/* ───────────────── Arquivos (poster/modelos) ───────────────── */
function guessMimeByExt(filename = "") {
  const ext = String(filename).toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  return "application/octet-stream";
}
function safeBasename(name) {
  const base = String(name || "arquivo").normalize("NFKD").replace(/[^\w.\-]+/g, "_");
  return base || "arquivo";
}
async function fileExistsAndStat(filePath) {
  try {
    const st = await fs.promises.stat(filePath);
    return { ok: st.isFile(), size: st.size };
  } catch {
    return { ok: false, size: 0 };
  }
}
async function ensureDirLocal(dir) {
  return fs.promises.mkdir(dir, { recursive: true });
}
function modelosBaseDir() {
  try {
    const p = require("../paths");
    return p.MODELOS_CHAMADAS_DIR || path.resolve("uploads", "modelos_chamadas");
  } catch {
    return path.resolve("uploads", "modelos_chamadas");
  }
}
function sanitizeFilename(name = "") {
  const base = String(name).normalize("NFKD").replace(/[^\w.\-]+/g, "_");
  return base || `arquivo_${Date.now()}`;
}
async function persistUploadedFile(reqFile, finalPath) {
  if (!reqFile) throw new Error("UPLOAD_AUSENTE");

  if (reqFile.path) {
    await fs.promises.rename(reqFile.path, finalPath);
    return;
  }

  if (reqFile.buffer) {
    await fs.promises.writeFile(finalPath, reqFile.buffer);
    return;
  }

  throw new Error("UPLOAD_INVALIDO");
}

/* ───────────────── ADMIN: Avaliadores por submissão (flex) ───────────────── */
function normalizeTipoAvaliacao(tipo) {
  const t = String(tipo || "").toLowerCase();
  return t === "oral" || t === "escrita" ? t : null;
}

async function listarAvaliadoresFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const tipo = String(req.query.tipo || "todos").toLowerCase();

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!isPosInt(submissaoId)) return res.status(400).json({ error: "ID inválido" });

    const schema = await resolveSchema(rootDb);
    const tipoNorm = normalizeTipoAvaliacao(tipo);

    const baseV1 = `
      SELECT a.submissao_id,
             a.avaliador_id,
             a.tipo,
             a.assigned_by,
             a.created_at,
             u.nome  AS avaliador_nome,
             u.email AS avaliador_email
        FROM ${schema.submissoesAvaliadores} a
        JOIN usuarios u ON u.id = a.avaliador_id
       WHERE a.submissao_id = $1
         AND a.revoked_at IS NULL
    `;
    const baseV2 = `
      SELECT a.submissao_id,
             a.avaliador_id,
             a.tipo,
             a.assigned_by,
             a.created_at,
             u.nome  AS avaliador_nome,
             u.email AS avaliador_email
        FROM ${schema.submissoesAvaliadores} a
        JOIN usuarios u ON u.id = a.avaliador_id
       WHERE a.submissao_id = $1
    `;

    const variants = [
      {
        sql: tipoNorm
          ? baseV1 + ` AND a.tipo = $2::tipo_avaliacao ORDER BY a.tipo, u.nome ASC`
          : baseV1 + ` ORDER BY a.tipo, u.nome ASC`,
        params: tipoNorm ? [submissaoId, tipoNorm] : [submissaoId],
      },
      {
        sql: tipoNorm
          ? baseV1 + ` AND a.tipo = $2 ORDER BY a.tipo, u.nome ASC`
          : baseV1 + ` ORDER BY a.tipo, u.nome ASC`,
        params: tipoNorm ? [submissaoId, tipoNorm] : [submissaoId],
      },
      {
        sql: tipoNorm
          ? baseV2 + ` AND a.tipo = $2 ORDER BY a.tipo, u.nome ASC`
          : baseV2 + ` ORDER BY a.tipo, u.nome ASC`,
        params: tipoNorm ? [submissaoId, tipoNorm] : [submissaoId],
      },
    ];

    let rows = null;
    let last = null;

    for (const v of variants) {
      try {
        rows = await rootDb.any(v.sql, v.params);
        break;
      } catch (e) {
        last = e;
        if (["42P01", "42703", "42883", "22P02"].includes(e?.code)) continue;
        throw e;
      }
    }

    if (!rows) throw last || new Error("Falha ao listar avaliadores.");
    return res.json(rows);
  } catch (e) {
    errlog("[listarAvaliadoresFlex]", e?.code, e?.message);
    return sendError(res, e, "Erro ao listar avaliadores da submissão.");
  }
}

async function incluirAvaliadores(req, res) {
  const submissaoId = asInt(req.params.id);

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!isPosInt(submissaoId)) return res.status(400).json({ error: "ID inválido" });

    const schema = await resolveSchema(rootDb);

    let itens = [];
    if (Array.isArray(req.body?.itens)) itens = req.body.itens;
    else if (req.body && (req.body.avaliadorId || req.body.id)) itens = [req.body];
    else if (Array.isArray(req.body?.avaliadores)) {
      const tipoCompat = normalizeTipoAvaliacao(req.body.tipo || "escrita") || "escrita";
      itens = req.body.avaliadores.map((id) => ({ avaliadorId: Number(id), tipo: tipoCompat }));
    } else {
      return res.status(400).json({ error: "Envie {avaliadorId, tipo} ou {itens:[...]}." });
    }

    itens = itens
      .map((r) => ({ avaliadorId: Number(r.avaliadorId ?? r.id), tipo: normalizeTipoAvaliacao(r.tipo) }))
      .filter((r) => isPosInt(r.avaliadorId) && !!r.tipo);

    if (!itens.length) return res.status(400).json({ error: "Itens inválidos." });

    const ids = Array.from(new Set(itens.map((r) => r.avaliadorId)));

    const elegiveis = await rootDb.any(
      `SELECT id
         FROM usuarios
        WHERE id = ANY($1)
          AND (
            'instrutor' = ANY(string_to_array(LOWER(COALESCE(perfil,'')), ',')) OR
            'administrador' = ANY(string_to_array(LOWER(COALESCE(perfil,'')), ','))
          )`,
      [ids]
    );

    const okIds = new Set(elegiveis.map((x) => Number(x.id)));
    const invalidos = ids.filter((id) => !okIds.has(Number(id)));
    if (invalidos.length) {
      return res.status(400).json({ error: `Usuário(s) sem perfil elegível: ${invalidos.join(", ")}` });
    }

    const assignedBy = uid || null;
    const results = [];

    await withTx(async (t) => {
      for (const it of itens) {
        let row = null;
        const sqls = [
          `INSERT INTO ${schema.submissoesAvaliadores}
             (submissao_id, avaliador_id, tipo, assigned_by, created_at)
           VALUES ($1,$2,$3::tipo_avaliacao,$4, NOW())
           ON CONFLICT (submissao_id, avaliador_id, tipo)
           DO UPDATE SET revoked_at = NULL, assigned_by = EXCLUDED.assigned_by
           RETURNING submissao_id, avaliador_id, tipo, assigned_by, created_at`,
          `INSERT INTO ${schema.submissoesAvaliadores}
             (submissao_id, avaliador_id, tipo, assigned_by, created_at)
           VALUES ($1,$2,$3,$4, NOW())
           ON CONFLICT (submissao_id, avaliador_id, tipo)
           DO UPDATE SET revoked_at = NULL, assigned_by = EXCLUDED.assigned_by
           RETURNING submissao_id, avaliador_id, tipo, assigned_by, created_at`,
          `INSERT INTO ${schema.submissoesAvaliadores}
             (submissao_id, avaliador_id, tipo, assigned_by, created_at)
           VALUES ($1,$2,$3,$4, NOW())
           ON CONFLICT (submissao_id, avaliador_id, tipo)
           DO UPDATE SET assigned_by = EXCLUDED.assigned_by
           RETURNING submissao_id, avaliador_id, tipo, assigned_by, created_at`,
        ];

        let lastErr = null;
        for (const sql of sqls) {
          try {
            row = await t.one(sql, [submissaoId, it.avaliadorId, it.tipo, assignedBy]);
            break;
          } catch (e) {
            lastErr = e;
            if (["42704", "42883", "22P02", "42703"].includes(e?.code)) continue;
            throw e;
          }
        }
        if (!row) throw lastErr || new Error("Falha ao inserir avaliador.");
        results.push(row);
      }
    });

    return res.status(201).json({ ok: true, inseridos: results.length, itens: results });
  } catch (e) {
    errlog("[incluirAvaliadores]", e?.code, e?.message);
    const devMsg = IS_DEV && (e?.detail || e?.message || e?.code);
    return res.status(500).json({ error: devMsg || "Falha ao incluir avaliadores." });
  }
}

async function revogarAvaliadorFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const avaliadorId = asInt(req.body?.avaliadorId ?? req.body?.id);
  const tipo = normalizeTipoAvaliacao(req.body?.tipo);

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!isPosInt(submissaoId) || !isPosInt(avaliadorId) || !tipo) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const schema = await resolveSchema(rootDb);

    const variants = [
      {
        sql: `UPDATE ${schema.submissoesAvaliadores}
                SET revoked_at = NOW()
              WHERE submissao_id = $1
                AND avaliador_id = $2
                AND tipo = $3::tipo_avaliacao
                AND revoked_at IS NULL`,
        params: [submissaoId, avaliadorId, tipo],
      },
      {
        sql: `UPDATE ${schema.submissoesAvaliadores}
                SET revoked_at = NOW()
              WHERE submissao_id = $1
                AND avaliador_id = $2
                AND tipo = $3
                AND revoked_at IS NULL`,
        params: [submissaoId, avaliadorId, tipo],
      },
      {
        sql: `DELETE FROM ${schema.submissoesAvaliadores}
              WHERE submissao_id = $1 AND avaliador_id = $2 AND tipo = $3`,
        params: [submissaoId, avaliadorId, tipo],
      },
    ];

    let rowCount = 0;
    let last = null;

    for (const v of variants) {
      try {
        const r = await rootDb.result(v.sql, v.params);
        rowCount = r.rowCount || 0;
        break;
      } catch (e) {
        last = e;
        if (["42703", "42P01", "42704", "42883"].includes(e?.code)) continue;
        throw e;
      }
    }

    if (!rowCount) return res.status(404).json({ error: "Vínculo ativo não encontrado." });
    return res.json({ ok: true });
  } catch (e) {
    errlog("[revogarAvaliadorFlex]", e?.code, e?.message);
    return res.status(500).json({ error: "Falha ao revogar avaliador." });
  }
}

async function restaurarAvaliadorFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const avaliadorId = asInt(req.body?.avaliadorId ?? req.body?.id);
  const tipo = normalizeTipoAvaliacao(req.body?.tipo);

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!isPosInt(submissaoId) || !isPosInt(avaliadorId) || !tipo) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const schema = await resolveSchema(rootDb);

    const variants = [
      {
        sql: `WITH alvo AS (
                SELECT ctid
                  FROM ${schema.submissoesAvaliadores}
                 WHERE submissao_id = $1
                   AND avaliador_id = $2
                   AND tipo = $3::tipo_avaliacao
                 ORDER BY revoked_at DESC NULLS LAST, created_at DESC
                 LIMIT 1
              )
              UPDATE ${schema.submissoesAvaliadores} a
                 SET revoked_at = NULL
               WHERE a.ctid IN (SELECT ctid FROM alvo)`,
        params: [submissaoId, avaliadorId, tipo],
      },
      {
        sql: `WITH alvo AS (
                SELECT ctid
                  FROM ${schema.submissoesAvaliadores}
                 WHERE submissao_id = $1
                   AND avaliador_id = $2
                   AND tipo = $3
                 ORDER BY revoked_at DESC NULLS LAST, created_at DESC
                 LIMIT 1
              )
              UPDATE ${schema.submissoesAvaliadores} a
                 SET revoked_at = NULL
               WHERE a.ctid IN (SELECT ctid FROM alvo)`,
        params: [submissaoId, avaliadorId, tipo],
      },
    ];

    let rowCount = 0;
    let last = null;

    for (const v of variants) {
      try {
        const r = await rootDb.result(v.sql, v.params);
        rowCount = r.rowCount || 0;
        break;
      } catch (e) {
        last = e;
        if (["42703", "42P01", "42704", "42883"].includes(e?.code)) continue;
        throw e;
      }
    }

    if (!rowCount) return res.status(404).json({ error: "Nada para restaurar." });
    return res.json({ ok: true });
  } catch (e) {
    if (e?.code === "23505") return res.status(409).json({ error: "Já existe vínculo ativo idêntico." });
    errlog("[restaurarAvaliadorFlex]", e?.code, e?.message);
    return res.status(500).json({ error: "Falha ao restaurar avaliador." });
  }
}

/* ───────────────── Admin: Avaliações/Notas ───────────────── */
async function listarAvaliacaoDaSubmissao(req, res) {
  const id = asInt(req.params.id);
  if (!isPosInt(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const schema = await resolveSchema(rootDb);

    let meta = null;
    try {
      meta = await rootDb.oneOrNone(
        `SELECT s.chamada_id, COALESCE(s.nota_visivel,false) AS nota_visivel,
                s.linha_tematica_id, tcl.nome AS linha_tematica_nome
           FROM ${schema.submissoes} s
           LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
          WHERE s.id = $1`,
        [id]
      );
    } catch (e) {
      if (e?.code === "42703") {
        meta = await rootDb.oneOrNone(
          `SELECT s.chamada_id, s.linha_tematica_id, tcl.nome AS linha_tematica_nome
             FROM ${schema.submissoes} s
             LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
            WHERE s.id = $1`,
          [id]
        );
        meta = meta ? { ...meta, nota_visivel: false } : null;
      } else {
        throw e;
      }
    }

    if (!meta) return res.status(404).json({ error: "Submissão não encontrada." });

    const criterios = await rootDb.any(
      `SELECT id, ordem::int AS ordem
         FROM trabalhos_chamada_criterios
        WHERE chamada_id = $1
        ORDER BY ordem ASC
        LIMIT 4`,
      [meta.chamada_id]
    );

    const idxByCriterioId = new Map();
    for (const c of criterios) {
      if (Number.isFinite(c.ordem) && c.ordem >= 1 && c.ordem <= 4) {
        idxByCriterioId.set(c.id, c.ordem - 1);
      }
    }

    const itens = await rootDb.any(
      `SELECT a.avaliador_id, u.nome AS avaliador_nome, a.criterio_id, a.nota, a.comentarios, a.criado_em
         FROM trabalhos_avaliacoes_itens a
         LEFT JOIN usuarios u ON u.id = a.avaliador_id
        WHERE a.submissao_id = $1
        ORDER BY u.nome NULLS LAST, a.criado_em ASC`,
      [id]
    );

    const NOTAS_LEN = 4;
    const byAvaliador = new Map();

    for (const r of itens) {
      const avalId = Number(r.avaliador_id);
      if (!byAvaliador.has(avalId)) {
        byAvaliador.set(avalId, {
          avaliador_id: avalId,
          avaliador_nome: r.avaliador_nome || `#${avalId}`,
          notas: Array.from({ length: NOTAS_LEN }, () => 0),
          comentarios: [],
          __extras: 0,
        });
      }

      const item = byAvaliador.get(avalId);
      const notaVal = Number(r.nota ?? 0);

      if (!Number.isNaN(notaVal)) {
        const idx = idxByCriterioId.has(r.criterio_id) ? idxByCriterioId.get(r.criterio_id) : null;
        if (idx !== null && idx >= 0 && idx < NOTAS_LEN) item.notas[idx] += notaVal;
        else {
          item.__extras += notaVal;
          if (r.criterio_id) item.comentarios.push(`[critério ${r.criterio_id} sem ordem] +${notaVal}`);
        }
      }

      const cmt = String(r.comentarios || "").trim();
      if (cmt) item.comentarios.push(cmt);
    }

    let totalGeral = 0;
    const resposta = [];

    for (const it of byAvaliador.values()) {
      const total = it.notas.reduce((a, n) => a + Number(n || 0), 0) + Number(it.__extras || 0);
      totalGeral += total;
      resposta.push({
        avaliador_id: it.avaliador_id,
        avaliador_nome: it.avaliador_nome,
        notas: it.notas,
        total_do_avaliador: total,
        comentarios: it.comentarios.length ? it.comentarios.join(" | ") : null,
      });
    }

    return res.json({
      itens: resposta,
      total_geral: totalGeral,
      nota_dividida_por_4: totalGeral / 4,
      qtd_avaliadores: resposta.length,
      nota_visivel: !!meta.nota_visivel,
      linha_tematica_nome: meta.linha_tematica_nome || null,
    });
  } catch (e) {
    errlog("[listarAvaliacaoDaSubmissao] code:", e?.code, "message:", e?.message);
    return res.status(500).json({ error: "Erro ao listar avaliações da submissão." });
  }
}

async function definirNotaVisivel(req, res) {
  const id = asInt(req.params.id);
  const { visivel } = req.body || {};
  if (!isPosInt(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const schema = await resolveSchema(rootDb);

    async function doUpdate() {
      await rootDb.none(`UPDATE ${schema.submissoes} SET nota_visivel=$1 WHERE id=$2`, [!!visivel, id]);
    }

    try {
      await doUpdate();
      return res.json({ ok: true, visivel: !!visivel });
    } catch (e) {
      if (e?.code === "42703") {
        await rootDb.none(
          `ALTER TABLE ${schema.submissoes}
             ADD COLUMN IF NOT EXISTS nota_visivel boolean NOT NULL DEFAULT false`
        );
        await doUpdate();
        return res.json({ ok: true, visivel: !!visivel, created_column: true });
      }
      throw e;
    }
  } catch (e) {
    errlog("[definirNotaVisivel]", e?.code, e?.message);
    return res.status(500).json({ error: "Erro ao atualizar visibilidade da nota." });
  }
}

/* ───────────────── Arquivo do pôster (download público) ───────────────── */
async function baixarBanner(req, res) {
  const started = Date.now();
  try {
    res.setHeader("X-Handler", "submissaoController/baixarBanner");
    const id = asInt(req.params.id);
    if (!isPosInt(id)) return res.status(400).json({ error: "ID inválido" });

    const schema = await resolveSchema(rootDb);

    const row = await rootDb.oneOrNone(
      `SELECT a.caminho, a.nome_original, a.mime_type
         FROM ${schema.submissoes} s
         JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
        WHERE s.id = $1`,
      [id]
    );

    if (!row) return res.status(404).json({ error: "Nenhum arquivo associado a esta submissão." });

    const raw = String(row.caminho || "");
    if (!raw) return res.status(404).json({ error: "Arquivo ausente no servidor." });

    const normalizedRel = raw.replace(/^uploads[\\/]/i, "");
    const resolved = path.normalize(path.isAbsolute(raw) ? raw : path.resolve("uploads", normalizedRel));

    if (!path.isAbsolute(raw)) {
      const uploadsRoot = path.resolve("uploads") + path.sep;
      if (!resolved.startsWith(uploadsRoot)) {
        warn("Path traversal bloqueado:", { raw, resolved });
        return res.status(400).json({ error: "Caminho de arquivo inválido." });
      }
    }

    const { ok } = await fileExistsAndStat(resolved);
    if (!ok) return res.status(404).json({ error: "Arquivo ausente no servidor." });

    const mime = row.mime_type || guessMimeByExt(row.nome_original || resolved);
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${safeBasename(row.nome_original || `poster_${id}`)}"`);

    const stream = fs.createReadStream(resolved);
    stream.on("error", (e) => {
      errlog("[baixarBanner][stream]", e?.message || e);
      if (!res.headersSent) return res.status(500).json({ error: "Falha ao ler o arquivo." });
      return res.end();
    });
    stream.on("close", () => {
      if (DBG) dbg("baixarBanner: OK em", Date.now() - started, "ms");
    });

    stream.pipe(res);
  } catch (e) {
    errlog("[baixarBanner]", e?.code, e?.message);
    return res.status(500).json({ error: "Erro interno ao baixar arquivo." });
  }
}

/* ───────────────── Modelos PPTX (banner/oral) ───────────────── */
async function upsertModeloArquivo({ chamadaId, filePath, original, mime, size, tipo }, dbConn = rootDb) {
  const row = await dbConn.oneOrNone(
    `SELECT a.id
       FROM trabalhos_arquivos a
      WHERE a.ref_table = 'trabalhos_chamadas'
        AND a.ref_id = $1
        AND a.tipo = $2
      ORDER BY a.id DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );

  if (row) {
    await dbConn.none(
      `UPDATE trabalhos_arquivos
          SET caminho=$2, nome_original=$3, mime_type=$4, tamanho=$5, atualizado_em=NOW(), tipo=$6
        WHERE id=$1`,
      [row.id, filePath, original, mime, size, tipo]
    );
    return row.id;
  }

  const rs = await dbConn.one(
    `INSERT INTO trabalhos_arquivos (ref_table, ref_id, caminho, nome_original, mime_type, tamanho, tipo, criado_em)
     VALUES ('trabalhos_chamadas', $1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [chamadaId, filePath, original, mime, size, tipo]
  );

  return rs.id;
}

async function getModeloMeta(chamadaId, tipo, dbConn = rootDb) {
  const row = await dbConn.oneOrNone(
    `SELECT id, caminho, nome_original, mime_type, tamanho, atualizado_em AS mtime
       FROM trabalhos_arquivos
      WHERE ref_table='trabalhos_chamadas'
        AND ref_id=$1
        AND tipo=$2
      ORDER BY id DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );

  if (!row) return { exists: false };

  const raw = String(row.caminho || "");
  const normalizedRel = raw.replace(/^uploads[\\/]/i, "");
  const resolved = path.normalize(path.isAbsolute(raw) ? raw : path.resolve("uploads", normalizedRel));
  const { ok, size } = await fileExistsAndStat(resolved);

  return {
    exists: ok,
    id: row.id,
    filename: row.nome_original || null,
    size: Number(row.tamanho) || size || null,
    mime: row.mime_type || null,
    mtime: row.mtime || null,
  };
}

async function getModeloBannerMeta(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    const meta = await getModeloMeta(chamadaId, "template_banner", rootDb);
    return res.json(meta);
  } catch (e) {
    errlog("[getModeloBannerMeta]", e?.message || e);
    return res.status(500).json({ error: "Falha ao obter modelo de banner." });
  }
}

async function downloadModeloBanner(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });

    const row = await rootDb.oneOrNone(
      `SELECT caminho, nome_original, mime_type
         FROM trabalhos_arquivos
        WHERE ref_table='trabalhos_chamadas'
          AND ref_id=$1
          AND tipo='template_banner'
        ORDER BY id DESC
        LIMIT 1`,
      [chamadaId]
    );

    if (!row) return res.status(404).json({ error: "Modelo não encontrado." });

    const raw = String(row.caminho || "");
    const normalizedRel = raw.replace(/^uploads[\\/]/i, "");
    const resolved = path.normalize(path.isAbsolute(raw) ? raw : path.resolve("uploads", normalizedRel));
    const { ok } = await fileExistsAndStat(resolved);

    if (!ok) return res.status(404).json({ error: "Modelo ausente no servidor." });

    res.setHeader("Content-Type", row.mime_type || guessMimeByExt(row.nome_original || resolved));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizeFilename(row.nome_original || `modelo-banner-${chamadaId}.pptx`)}"`
    );

    return fs.createReadStream(resolved).pipe(res);
  } catch (e) {
    errlog("[downloadModeloBanner]", e?.message || e);
    return res.status(500).json({ error: "Falha ao baixar modelo de banner." });
  }
}

async function uploadModeloBanner(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });

    const original = req.file.originalname || "modelo.pptx";
    const mime = req.file.mimetype || guessMimeByExt(original);
    const size = req.file.size || req.file.buffer?.length || 0;

    if (!/\.pptx?$|powerpoint/i.test(original)) {
      return res.status(400).json({ error: "Arquivo inválido: envie .ppt ou .pptx." });
    }

    const baseDir = modelosBaseDir();
    const dir = path.resolve(baseDir, String(chamadaId));
    await ensureDirLocal(dir);

    const safeName = sanitizeFilename(original);
    const stamp = crypto.randomBytes(4).toString("hex");
    const finalPath = path.resolve(dir, `${stamp}__${safeName}`);

    await persistUploadedFile(req.file, finalPath);
    await upsertModeloArquivo({
      chamadaId,
      filePath: finalPath,
      original,
      mime,
      size,
      tipo: "template_banner",
    });

    return res.json({ ok: true });
  } catch (e) {
    errlog("[uploadModeloBanner]", e?.message || e);
    return res.status(500).json({ error: "Falha ao enviar modelo de banner." });
  }
}

async function getModeloOralMeta(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    const meta = await getModeloMeta(chamadaId, "template_slide_oral", rootDb);
    return res.json(meta);
  } catch (e) {
    errlog("[getModeloOralMeta]", e?.message || e);
    return res.status(500).json({ error: "Falha ao obter modelo de slides (oral)." });
  }
}

async function downloadModeloOral(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });

    const row = await rootDb.oneOrNone(
      `SELECT caminho, nome_original, mime_type
         FROM trabalhos_arquivos
        WHERE ref_table='trabalhos_chamadas'
          AND ref_id=$1
          AND tipo='template_slide_oral'
        ORDER BY id DESC
        LIMIT 1`,
      [chamadaId]
    );

    if (!row) return res.status(404).json({ error: "Modelo não encontrado." });

    const raw = String(row.caminho || "");
    const normalizedRel = raw.replace(/^uploads[\\/]/i, "");
    const resolved = path.normalize(path.isAbsolute(raw) ? raw : path.resolve("uploads", normalizedRel));
    const { ok } = await fileExistsAndStat(resolved);

    if (!ok) return res.status(404).json({ error: "Modelo ausente no servidor." });

    res.setHeader("Content-Type", row.mime_type || guessMimeByExt(row.nome_original || resolved));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizeFilename(row.nome_original || `modelo-oral-${chamadaId}.pptx`)}"`
    );

    return fs.createReadStream(resolved).pipe(res);
  } catch (e) {
    errlog("[downloadModeloOral]", e?.message || e);
    return res.status(500).json({ error: "Falha ao baixar modelo de slides (oral)." });
  }
}

async function uploadModeloOral(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!isPosInt(chamadaId)) return res.status(400).json({ error: "ID inválido" });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });
    if (!req.file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });

    const original = req.file.originalname || "modelo-oral.pptx";
    const mime = req.file.mimetype || guessMimeByExt(original);
    const size = req.file.size || req.file.buffer?.length || 0;

    if (!/\.pptx?$|powerpoint/i.test(original)) {
      return res.status(400).json({ error: "Arquivo inválido: envie .ppt ou .pptx." });
    }

    const baseDir = modelosBaseDir();
    const dir = path.resolve(baseDir, String(chamadaId));
    await ensureDirLocal(dir);

    const safeName = sanitizeFilename(original);
    const stamp = crypto.randomBytes(4).toString("hex");
    const finalPath = path.resolve(dir, `${stamp}__${safeName}`);

    await persistUploadedFile(req.file, finalPath);
    await upsertModeloArquivo({
      chamadaId,
      filePath: finalPath,
      original,
      mime,
      size,
      tipo: "template_slide_oral",
    });

    return res.json({ ok: true });
  } catch (e) {
    errlog("[uploadModeloOral]", e?.message || e);
    return res.status(500).json({ error: "Falha ao enviar modelo de slides (oral)." });
  }
}

/* ───────────────── Admin: notas materializadas + listagens ───────────────── */
async function calcularTotaisDaSubmissao(submissaoId, dbConn = rootDb) {
  const rs = await dbConn.one(
    `
    WITH por_avaliador AS (
      SELECT avaliador_id, SUM(nota)::int AS total
      FROM trabalhos_avaliacoes_itens
      WHERE submissao_id = $1
      GROUP BY avaliador_id
    )
    SELECT
      COALESCE(SUM(total),0)::int                    AS total_geral,
      ROUND(COALESCE(SUM(total),0)::numeric / 4, 1) AS nota_dividida_por_4
    FROM por_avaliador
    `,
    [submissaoId]
  );

  return {
    totalGeral: Number(rs?.total_geral || 0),
    nota10: Number(rs?.nota_dividida_por_4 || 0),
  };
}

async function atualizarNotaMediaMaterializada(submissaoId, dbConn = rootDb) {
  const schema = await resolveSchema(dbConn);
  const { nota10 } = await calcularTotaisDaSubmissao(submissaoId, dbConn);

  await dbConn.none(
    `UPDATE ${schema.submissoes}
        SET nota_media = $2,
            atualizado_em = NOW()
      WHERE id = $1`,
    [submissaoId, nota10]
  );

  return nota10;
}

async function listarsubmissaoAdmin(req, res) {
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });

    const schema = await resolveSchema(rootDb);

    const SQL_V1 = `
      WITH base AS (
        SELECT
          s.id, s.titulo, s.status, s.status_escrita, s.status_oral, s.chamada_id,
          s.criado_em AS submetido_em,
          u.nome  AS autor_nome, u.email AS autor_email,
          c.titulo AS chamada_titulo,
          COALESCE(s.nota_visivel, false) AS nota_visivel,
          tcl.nome AS linha_tematica_nome,
          (
            WITH por_avaliador AS (
              SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
              FROM trabalhos_avaliacoes_itens ai
              WHERE ai.submissao_id = s.id
              GROUP BY ai.avaliador_id
            )
            SELECT ROUND(COALESCE(SUM(total), 0)::numeric / 4, 1)
            FROM por_avaliador
          ) AS nota_media,
          (
            WITH por_avaliador AS (
              SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
              FROM trabalhos_avaliacoes_itens ai
              WHERE ai.submissao_id = s.id
              GROUP BY ai.avaliador_id
            ),
            vinc AS (
              SELECT DISTINCT ON (submissao_id, avaliador_id) submissao_id, avaliador_id, tipo
              FROM ${schema.submissoesAvaliadores}
              WHERE submissao_id = s.id AND revoked_at IS NULL
              ORDER BY submissao_id, avaliador_id, created_at DESC NULLS LAST
            )
            SELECT ROUND(COALESCE(SUM(p.total) FILTER (WHERE v.tipo='escrita'),0)::numeric / 4, 1)
            FROM por_avaliador p
            JOIN vinc v ON v.avaliador_id = p.avaliador_id
          ) AS nota_escrita_calc,
          (
            WITH por_avaliador AS (
              SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
              FROM trabalhos_avaliacoes_itens ai
              WHERE ai.submissao_id = s.id
              GROUP BY ai.avaliador_id
            ),
            vinc AS (
              SELECT DISTINCT ON (submissao_id, avaliador_id) submissao_id, avaliador_id, tipo
              FROM ${schema.submissoesAvaliadores}
              WHERE submissao_id = s.id AND revoked_at IS NULL
              ORDER BY submissao_id, avaliador_id, created_at DESC NULLS LAST
            )
            SELECT ROUND(COALESCE(SUM(p.total) FILTER (WHERE v.tipo='oral'),0)::numeric / 4, 1)
            FROM por_avaliador p
            JOIN vinc v ON v.avaliador_id = p.avaliador_id
          ) AS nota_oral_calc,
          s.nota_escrita AS nota_escrita_col,
          s.nota_oral    AS nota_oral_col,
          s.nota_final   AS nota_final_col
        FROM ${schema.submissoes} s
        LEFT JOIN usuarios                 u   ON u.id  = s.usuario_id
        LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
        LEFT JOIN trabalhos_chamadas       c   ON c.id  = s.chamada_id
        ORDER BY s.id DESC
      )
      SELECT
        b.id, b.titulo, b.status, b.status_escrita, b.status_oral, b.chamada_id,
        b.submetido_em,
        b.autor_nome, b.autor_email, b.chamada_titulo,
        b.nota_visivel, b.linha_tematica_nome,
        b.nota_media,
        COALESCE(b.nota_escrita_col, b.nota_escrita_calc) AS nota_escrita,
        COALESCE(b.nota_oral_col,    b.nota_oral_calc)    AS nota_oral,
        COALESCE(
          b.nota_final_col,
          CASE
            WHEN b.nota_escrita_col IS NULL AND b.nota_oral_col IS NULL
              THEN CASE
                     WHEN b.nota_escrita_calc IS NULL THEN b.nota_oral_calc
                     WHEN b.nota_oral_calc    IS NULL THEN b.nota_escrita_calc
                     ELSE ROUND((b.nota_escrita_calc + b.nota_oral_calc)/2.0, 1)
                   END
            ELSE CASE
                   WHEN b.nota_escrita_col IS NULL THEN b.nota_oral_col
                   WHEN b.nota_oral_col    IS NULL THEN b.nota_escrita_col
                   ELSE ROUND((b.nota_escrita_col + b.nota_oral_col)/2.0, 1)
                 END
          END
        ) AS nota_final
      FROM base b
    `;

    const SQL_V2 = SQL_V1.replaceAll(" AND revoked_at IS NULL", "");

    const SQL_V3 = `
      SELECT
        s.id, s.titulo, s.status, s.status_escrita, s.status_oral, s.chamada_id,
        s.criado_em AS submetido_em,
        u.nome  AS autor_nome, u.email AS autor_email,
        c.titulo AS chamada_titulo,
        COALESCE(s.nota_visivel, false) AS nota_visivel,
        tcl.nome AS linha_tematica_nome,
        (
          WITH por_avaliador AS (
            SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = s.id
            GROUP BY ai.avaliador_id
          )
          SELECT ROUND(COALESCE(SUM(total), 0)::numeric / 4, 1)
        ) AS nota_media,
        s.nota_escrita AS nota_escrita,
        s.nota_oral    AS nota_oral,
        s.nota_final   AS nota_final
      FROM ${schema.submissoes} s
      LEFT JOIN usuarios                 u   ON u.id  = s.usuario_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN trabalhos_chamadas       c   ON c.id  = s.chamada_id
      ORDER BY s.id DESC
    `;

    let rows = null;
    let last = null;

    for (const sql of [SQL_V1, SQL_V2, SQL_V3]) {
      try {
        rows = await rootDb.any(sql);
        break;
      } catch (e) {
        last = e;
        if (["42703", "42P01"].includes(e?.code)) continue;
      }
    }

    if (!rows) throw last || new Error("Falha ao listar.");

    const enriched = rows.map((r) => ({ ...r, ...deriveAprovFlags(r) }));
    return res.json(enriched);
  } catch (e) {
    errlog("[listarsubmissaoAdmin]", e?.code, e?.message);
    return res.status(500).json({ error: "Erro ao listar submissões." });
  }
}

async function resumoAvaliadores(req, res) {
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, rootDb))) return res.status(403).json({ error: "Acesso negado." });

    const schema = await resolveSchema(rootDb);

    async function tryMany(sqlList) {
      let lastErr = null;
      for (const sql of sqlList) {
        try {
          return await rootDb.any(sql);
        } catch (e) {
          lastErr = e;
          if (["42P01", "42703"].includes(e?.code)) continue;
          throw e;
        }
      }
      if (lastErr) throw lastErr;
      return [];
    }

    const SQLs = [
      `
      WITH tsa_ativos AS (
        SELECT DISTINCT tsa.avaliador_id, tsa.submissao_id
        FROM ${schema.submissoesAvaliadores} tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliou AS (
        SELECT DISTINCT ai.avaliador_id, ai.submissao_id
        FROM trabalhos_avaliacoes_itens ai
      )
      SELECT
        u.id, COALESCE(u.nome,'') AS nome, COALESCE(u.email,'') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)     AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL) AS avaliados
      FROM tsa_ativos t
      JOIN usuarios u ON u.id = t.avaliador_id
      LEFT JOIN avaliou av
        ON av.avaliador_id = t.avaliador_id
       AND av.submissao_id = t.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC, u.nome ASC
      `,
      `
      WITH tsa_ativos AS (
        SELECT DISTINCT tsa.avaliador_id, tsa.submissao_id
        FROM ${schema.submissoesAvaliadores} tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliou AS (
        SELECT DISTINCT ai.avaliador_id, ai.trabalho_id AS submissao_id
        FROM trabalhos_avaliacoes_itens ai
      )
      SELECT
        u.id, COALESCE(u.nome,'') AS nome, COALESCE(u.email,'') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)     AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL) AS avaliados
      FROM tsa_ativos t
      JOIN usuarios u ON u.id = t.avaliador_id
      LEFT JOIN avaliou av
        ON av.avaliador_id = t.avaliador_id
       AND av.submissao_id = t.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC, u.nome ASC
      `,
    ];

    const rows = await tryMany(SQLs);
    const avaliadores = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      pendentes: Number(r.pendentes || 0),
      avaliados: Number(r.avaliados || 0),
      total: Number(r.pendentes || 0) + Number(r.avaliados || 0),
    }));

    return res.json({ avaliadores });
  } catch (e) {
    errlog("[resumoAvaliadores]", e?.code, e?.message);
    return res.status(500).json({ error: "Erro ao gerar resumo de avaliadores." });
  }
}

/* ───────────────── Usuário/Autor: detalhe + minhas ───────────────── */
async function obterSubmissao(req, res) {
  try {
    const id = asInt(req.params.id);
    if (!isPosInt(id)) return res.status(400).json({ error: "ID inválido" });

    const uid = getUserIdOptional(req);
    const schema = await resolveSchema(rootDb);

    const row = await rootDb.oneOrNone(
      `SELECT s.*, c.titulo AS chamada_titulo
         FROM ${schema.submissoes} s
         LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id = $1`,
      [id]
    );

    if (!row) return res.status(404).json({ error: "Submissão não encontrada." });

    const autorId = Number(row.usuario_id ?? row.autor_id ?? null);
    const allowed =
      (await isAdmin(uid, rootDb)) ||
      (await canUserReviewOrView(uid, id, rootDb)) ||
      Number(autorId) === Number(uid);

    if (!allowed) return res.status(403).json({ error: "Acesso negado." });
    return res.json({ ...row, ...deriveAprovFlags(row) });
  } catch (e) {
    errlog("[obterSubmissao]", e?.message || e);
    return res.status(500).json({ error: "Erro ao obter submissão." });
  }
}

async function listarMinhas(req, res) {
  try {
    const uid = getUserIdOrThrow(req);
    const schema = await resolveSchema(rootDb);

    const SQL_V1 = `
      WITH por_avaliador AS (
        SELECT ai.submissao_id, ai.avaliador_id, SUM(ai.nota)::int AS total
        FROM trabalhos_avaliacoes_itens ai
        GROUP BY ai.submissao_id, ai.avaliador_id
      )
      SELECT
        s.id, s.titulo, s.status, s.status_escrita, s.status_oral,
        s.chamada_id, s.criado_em AS submetido_em,
        c.titulo AS chamada_titulo,
        COALESCE(s.nota_visivel, false) AS nota_visivel,
        tcl.nome AS linha_tematica_nome,
        c.modalidade AS modalidade,
        (
          SELECT ROUND(COALESCE(SUM(p.total),0)::numeric / 4, 1)
          FROM por_avaliador p
          WHERE p.submissao_id = s.id
        ) AS nota_media
      FROM ${schema.submissoes} s
      LEFT JOIN trabalhos_chamadas       c   ON c.id  = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      WHERE s.usuario_id = $1
      ORDER BY s.id DESC
    `;

    const SQL_V2 = `
      WITH por_avaliador AS (
        SELECT ai.submissao_id, ai.avaliador_id, SUM(ai.nota)::int AS total
        FROM trabalhos_avaliacoes_itens ai
        GROUP BY ai.submissao_id, ai.avaliador_id
      )
      SELECT
        s.id, s.titulo, s.status, s.status_escrita, s.status_oral,
        s.chamada_id, s.criado_em AS submetido_em,
        c.titulo AS chamada_titulo,
        false AS nota_visivel,
        NULL::text AS linha_tematica_nome,
        c.modalidade AS modalidade,
        (
          SELECT ROUND(COALESCE(SUM(p.total),0)::numeric / 4, 1)
          FROM por_avaliador p
          WHERE p.submissao_id = s.id
        ) AS nota_media
      FROM ${schema.submissoes} s
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.usuario_id = $1
      ORDER BY s.id DESC
    `;

    const SQL_V3 = `
      SELECT
        s.id, s.titulo, s.status, s.status_escrita, s.status_oral,
        s.chamada_id, s.criado_em AS submetido_em,
        NULL::text AS chamada_titulo,
        false AS nota_visivel,
        NULL::text AS linha_tematica_nome,
        NULL::text AS modalidade,
        NULL::numeric AS nota_media
      FROM ${schema.submissoes} s
      WHERE s.usuario_id = $1
      ORDER BY s.id DESC
    `;

    const SQLS = [SQL_V1, SQL_V2, SQL_V3];

    let rows = null;
    let lastErr = null;

    for (const sql of SQLS) {
      try {
        rows = await rootDb.any(sql, [uid]);
        break;
      } catch (e) {
        lastErr = e;
        if (["42703", "42P01"].includes(e?.code)) continue;
        throw e;
      }
    }

    if (!rows) throw lastErr || new Error("Falha ao listar submissões.");

    const out = rows.map((r) => ({ ...r, ...deriveAprovFlags(r) }));
    return res.json(out);
  } catch (e) {
    errlog("[listarMinhas]", e?.code, e?.message);
    return sendError(res, e, "Erro ao listar suas submissões.");
  }
}

/* ───────────────── Avaliador (minhas atribuições) ───────────────── */
function getUserId(req) {
  return req.userId ?? req.user?.id ?? req.usuario?.id ?? req.auth?.id ?? null;
}

function ensureAuth(req, res) {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ ok: false, erro: "Não autenticado.", requestId: req.requestId });
    return null;
  }
  return uid;
}

function ok(res, payload) {
  return res.status(200).json({ ok: true, ...payload });
}

async function listarAtribuidas(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  try {
    const schema = await resolveSchema(rootDb);

    const sql = `
      SELECT a.*
      FROM ${schema.submissoesAvaliadores} a
      WHERE a.avaliador_id = $1
      ORDER BY COALESCE(a.updated_at, a.created_at) DESC NULLS LAST
      LIMIT 500
    `;

    const r = await rootDb.query(sql, [avaliadorId]);
    return ok(res, { itens: r.rows || [], submissao: r.rows || [], total: r.rowCount || 0 });
  } catch (e) {
    if (IS_DEV) console.warn("[listarAtribuidas] SQL falhou, retornando vazio. Detalhe:", e?.message);
    return ok(res, { itens: [], submissao: [], total: 0, warn: "schema_mismatch" });
  }
}

async function listarPendentes(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  try {
    const schema = await resolveSchema(rootDb);

    const sql = `
      SELECT a.*
      FROM ${schema.submissoesAvaliadores} a
      WHERE a.avaliador_id = $1
        AND (
          COALESCE(a.status, '') ILIKE 'pendente'
          OR a.nota IS NULL
          OR a.avaliacao_id IS NULL
        )
      ORDER BY COALESCE(a.updated_at, a.created_at) DESC NULLS LAST
      LIMIT 500
    `;

    const r = await rootDb.query(sql, [avaliadorId]);
    return ok(res, { itens: r.rows || [], total: r.rowCount || 0 });
  } catch (e) {
    if (IS_DEV) console.warn("[listarPendentes] SQL falhou, retornando vazio:", e?.message);
    return ok(res, { itens: [], total: 0, warn: "schema_mismatch" });
  }
}

async function minhasContagens(req, res) {
  const avaliadorId = ensureAuth(req, res);
  if (!avaliadorId) return;

  try {
    const schema = await resolveSchema(rootDb);

    const sql = `
      SELECT
        COUNT(*)::int AS total,
        SUM(
          CASE
            WHEN (COALESCE(status,'') ILIKE 'pendente' OR nota IS NULL OR avaliacao_id IS NULL) THEN 1
            ELSE 0
          END
        )::int AS pendentes,
        SUM(
          CASE
            WHEN NOT (COALESCE(status,'') ILIKE 'pendente' OR nota IS NULL OR avaliacao_id IS NULL) THEN 1
            ELSE 0
          END
        )::int AS finalizadas
      FROM ${schema.submissoesAvaliadores}
      WHERE avaliador_id = $1
    `;

    const r = await rootDb.query(sql, [avaliadorId]);
    const row = r.rows?.[0] || { total: 0, pendentes: 0, finalizadas: 0 };
    return ok(res, row);
  } catch (e) {
    if (IS_DEV) console.warn("[minhasContagens] SQL falhou, zeros:", e?.message);
    return ok(res, { total: 0, pendentes: 0, finalizadas: 0, warn: "schema_mismatch" });
  }
}

async function paraMim(req, res) {
  return listarAtribuidas(req, res);
}

/* ───────────────── Exports (único) ───────────────── */
module.exports = {
  // Helpers expostos
  getUserIdOptional,
  getUserIdOrThrow,
  isAdmin,
  canUserReviewOrView,

  // Admin - avaliadores
  listarAvaliadoresFlex,
  incluirAvaliadores,
  revogarAvaliadorFlex,
  restaurarAvaliadorFlex,
  resumoAvaliadores,

  // Admin - avaliações/nota visível
  listarAvaliacaoDaSubmissao,
  definirNotaVisivel,

  // Arquivo público (poster)
  baixarBanner,

  // Modelos (banner/oral)
  getModeloBannerMeta,
  downloadModeloBanner,
  uploadModeloBanner,
  getModeloOralMeta,
  downloadModeloOral,
  uploadModeloOral,

  // Notas materializadas
  calcularTotaisDaSubmissao,
  atualizarNotaMediaMaterializada,

  // Listagem Admin
  listarsubmissaoAdmin,

  // Usuário/Autor
  obterSubmissao,
  listarMinhas,

  // Avaliador
  listarAtribuidas,
  listarPendentes,
  minhasContagens,
  paraMim,

  // Aliases de compatibilidade
  listarAvaliadoresDaSubmissao: listarAvaliadoresFlex,
  atribuirAvaliadores: incluirAvaliadores,
};