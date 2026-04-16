/* eslint-disable no-console */
// ✅ controllers/votacaoController.js (versão premium++ unificada)
"use strict";

const dbMod = require("../db");

// compat: pode exportar { query, pool } ou { db } ou o próprio pool
const pool =
  dbMod?.pool ||
  dbMod?.Pool ||
  dbMod?.db?.pool ||
  dbMod?.db ||
  dbMod;

const query =
  dbMod?.query ||
  dbMod?.db?.query?.bind?.(dbMod.db) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[votacaoController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em votacaoController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/*
  Rotas esperadas:
  GET /api/votacao                       → listarVotacaoAdmin
  GET /api/votacao/:id                   → obterVotacaoAdmin
  POST /api/votacao                      → criarVotacao
  PUT /api/votacao/:id                   → atualizarVotacao
  PATCH /api/votacao/:id/status          → atualizarStatus
  POST /api/votacao/:id/opcao            → criarOpcao
  PUT /api/votacao/:id/opcao/:opcaoId    → atualizarOpcao
  GET /api/votacao/:id/ranking           → ranking

  // uso do usuário
  GET /api/votacao/abertas/mine          → listarVotacaoElegiveis
  POST /api/votacao/:id/votar            → votar

  // util para QR
  GET /api/votacao/:id/url               → getUrl
*/

// ───────────────────────────────── Logs ─────────────────────────────────
function mkRid() {
  return `vot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[VOTACAO][RID=${rid}]`;
  if (level === "error") {
    return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  }
  if (!IS_DEV) return;
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

// ───────────────────────────────── Helpers ─────────────────────────────────
function buildCanonicalUrl(req, votacaoId) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  return `${proto}://${host}/votar/${votacaoId}`;
}

function asInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function isPositiveId(v) {
  const n = asInt(v, -1);
  return Number.isInteger(n) && n > 0;
}

function clamp(num, min, max) {
  return Math.min(max, Math.max(min, Number(num)));
}

function normRaio(v) {
  return clamp(v ?? 200, 0, 200);
}

function ensureArrayOfInts(arr) {
  if (!Array.isArray(arr)) return null;
  const parsed = arr.map((x) => asInt(x)).filter((n) => Number.isInteger(n));
  return parsed.length === arr.length ? parsed : null;
}

function dedupeInts(arr = []) {
  return [...new Set(arr.map((n) => Number(n)).filter((n) => Number.isInteger(n)))];
}

function badRequest(res, erro, extra = {}) {
  return res.status(400).json({ erro, ...extra });
}

function forbidden(res, erro, extra = {}) {
  return res.status(403).json({ erro, ...extra });
}

function notFound(res, erro, extra = {}) {
  return res.status(404).json({ erro, ...extra });
}

function serverError(res, erro, extra = {}) {
  return res.status(500).json({ erro, ...extra });
}

function normalizeStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return ["rascunho", "ativa", "encerrada"].includes(s) ? s : null;
}

function normalizeTipoSelecao(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  return ["unica", "multipla"].includes(t) ? t : null;
}

function normalizeEscopo(escopo) {
  const e = String(escopo || "").trim().toLowerCase();
  return ["global", "evento", "turma"].includes(e) ? e : null;
}

function normalizeRegraElegibilidade(regra) {
  const r = String(regra || "").trim().toLowerCase();
  return ["logado", "inscrito", "presente_hoje", "presenca_minima"].includes(r) ? r : null;
}

function normalizeNullableNumber(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getClient() {
  if (typeof pool?.connect === "function") return pool.connect();
  throw new Error("Pool não suporta connect().");
}

async function getVotacaoById(votacaoId) {
  const r = await query(`SELECT * FROM votacao WHERE id = $1`, [votacaoId]);
  return r.rows?.[0] || null;
}

async function getOpcoesByVotacaoId(votacaoId) {
  const r = await query(
    `SELECT * FROM votacao_opcao WHERE votacao_id = $1 ORDER BY ordem ASC, id ASC`,
    [votacaoId]
  );
  return r.rows || [];
}

// ───────────────────────────── Elegibilidade ─────────────────────────────
async function checarElegibilidade({ userId, votacao, cliLat, cliLng }) {
  // Restrição por unidade
  if (votacao.unidade_id) {
    const u = await query(`SELECT unidade_id FROM usuarios WHERE id = $1`, [userId]);
    const unidadeUsuario = u.rows?.[0]?.unidade_id ?? null;
    const doMesmoLocal =
      unidadeUsuario != null &&
      String(unidadeUsuario) === String(votacao.unidade_id);

    if (!doMesmoLocal) {
      return { ok: false, motivo: "Somente pessoas desta unidade/local podem votar." };
    }
  }

  // Geofence
  if (
    votacao.endereco_lat != null &&
    votacao.endereco_lng != null &&
    votacao.endereco_raio_m != null
  ) {
    if (cliLat == null || cliLng == null) {
      return {
        ok: false,
        motivo: "É necessário permitir a localização para votar nesta pergunta.",
      };
    }

    const lat1 = Number(votacao.endereco_lat);
    const lng1 = Number(votacao.endereco_lng);
    const lat2 = Number(cliLat);
    const lng2 = Number(cliLng);

    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) {
      return {
        ok: false,
        motivo: "Localização inválida para validar a votação.",
      };
    }

    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    const dist = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const raio = normRaio(votacao.endereco_raio_m);

    if (dist > raio) {
      return {
        ok: false,
        motivo: "Você não está no local autorizado para esta votação.",
      };
    }
  }

  if (votacao.escopo === "evento" && votacao.evento_id) {
    if (votacao.regra_elegibilidade === "inscrito") {
      const r = await query(
        `
        SELECT 1
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
          AND t.evento_id = $2
        LIMIT 1
        `,
        [userId, votacao.evento_id]
      );
      if (!r.rowCount) {
        return { ok: false, motivo: "Somente inscritos no evento podem votar." };
      }
    }

    if (votacao.regra_elegibilidade === "presente_hoje") {
      const r = await query(
        `
        SELECT 1
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.usuario_id = $1
          AND t.evento_id = $2
          AND p.presente = TRUE
          AND p.data_presenca = CURRENT_DATE
        LIMIT 1
        `,
        [userId, votacao.evento_id]
      );
      if (!r.rowCount) {
        return { ok: false, motivo: "Somente presentes hoje no evento podem votar." };
      }
    }

    if (votacao.regra_elegibilidade === "presenca_minima") {
      const r = await query(
        `
        WITH total AS (
          SELECT COUNT(DISTINCT p2.data_presenca) AS tot
          FROM presencas p2
          JOIN turmas t2 ON t2.id = p2.turma_id
          WHERE t2.evento_id = $2
        ),
        pres AS (
          SELECT COUNT(*) AS ok
          FROM (
            SELECT
              p.usuario_id,
              p.turma_id,
              COUNT(*)::numeric / NULLIF((SELECT tot FROM total), 0)::numeric AS freq
            FROM presencas p
            JOIN turmas t ON t.id = p.turma_id
            WHERE t.evento_id = $2
              AND p.usuario_id = $1
              AND p.presente = TRUE
            GROUP BY p.usuario_id, p.turma_id
          ) s
          WHERE freq >= 0.75
        )
        SELECT ok FROM pres
        `,
        [userId, votacao.evento_id]
      );

      if (!r.rowCount || Number(r.rows?.[0]?.ok || 0) <= 0) {
        return {
          ok: false,
          motivo: "Somente quem atingiu presença mínima pode votar.",
        };
      }
    }
  }

  if (votacao.escopo === "turma" && votacao.turma_id) {
    if (votacao.regra_elegibilidade === "inscrito") {
      const r = await query(
        `
        SELECT 1
        FROM inscricoes
        WHERE usuario_id = $1
          AND turma_id = $2
        LIMIT 1
        `,
        [userId, votacao.turma_id]
      );
      if (!r.rowCount) {
        return { ok: false, motivo: "Somente inscritos na turma podem votar." };
      }
    }

    if (votacao.regra_elegibilidade === "presente_hoje") {
      const r = await query(
        `
        SELECT 1
        FROM presencas
        WHERE usuario_id = $1
          AND turma_id = $2
          AND presente = TRUE
          AND data_presenca = CURRENT_DATE
        LIMIT 1
        `,
        [userId, votacao.turma_id]
      );
      if (!r.rowCount) {
        return { ok: false, motivo: "Somente presentes hoje na turma podem votar." };
      }
    }

    if (votacao.regra_elegibilidade === "presenca_minima") {
      const r = await query(
        `
        WITH total AS (
          SELECT COUNT(DISTINCT data_presenca) AS tot
          FROM presencas
          WHERE turma_id = $2
        ),
        freq AS (
          SELECT COUNT(*)::numeric / NULLIF((SELECT tot FROM total), 0)::numeric AS f
          FROM presencas
          WHERE usuario_id = $1
            AND turma_id = $2
            AND presente = TRUE
        )
        SELECT 1 FROM freq WHERE f >= 0.75
        `,
        [userId, votacao.turma_id]
      );
      if (!r.rowCount) {
        return {
          ok: false,
          motivo: "Somente quem atingiu presença mínima pode votar.",
        };
      }
    }
  }

  if (votacao.status !== "ativa") {
    return { ok: false, motivo: "Votação não está ativa." };
  }

  return { ok: true };
}

// ───────────────────────────── CRUD ADMIN ─────────────────────────────
exports.criarVotacao = async (req, res) => {
  const rid = mkRid();
  try {
    const {
      titulo,
      tipo_selecao = "unica",
      max_escolhas = 1,
      status = "rascunho",
      escopo = "global",
      evento_id = null,
      turma_id = null,
      unidade_id = null,
      endereco_texto = null,
      endereco_lat = null,
      endereco_lng = null,
      endereco_raio_m = 200,
      regra_elegibilidade = "logado",
    } = req.body || {};

    const tituloFinal = String(titulo || "").trim();
    const tipoFinal = normalizeTipoSelecao(tipo_selecao);
    const statusFinal = normalizeStatus(status);
    const escopoFinal = normalizeEscopo(escopo);
    const regraFinal = normalizeRegraElegibilidade(regra_elegibilidade);
    const maxSel = asInt(max_escolhas, 1);
    const raio = normRaio(endereco_raio_m);

    if (!tituloFinal || tituloFinal.length < 3) {
      return badRequest(res, "Título é obrigatório (mín. 3 caracteres).");
    }
    if (!tipoFinal) return badRequest(res, "tipo_selecao inválido.");
    if (!statusFinal) return badRequest(res, "status inválido.");
    if (!escopoFinal) return badRequest(res, "escopo inválido.");
    if (!regraFinal) return badRequest(res, "regra_elegibilidade inválida.");
    if (!Number.isInteger(maxSel) || maxSel <= 0) {
      return badRequest(res, "max_escolhas inválido.");
    }
    if (tipoFinal === "unica" && maxSel !== 1) {
      return badRequest(res, "Para seleção única, max_escolhas deve ser 1.");
    }
    if (escopoFinal === "evento" && !isPositiveId(evento_id)) {
      return badRequest(res, "evento_id é obrigatório para escopo='evento'.");
    }
    if (escopoFinal === "turma" && !isPositiveId(turma_id)) {
      return badRequest(res, "turma_id é obrigatório para escopo='turma'.");
    }

    const { rows } = await query(
      `
      INSERT INTO votacao
        (titulo, tipo_selecao, max_escolhas, status, escopo,
         evento_id, turma_id, unidade_id,
         endereco_texto, endereco_lat, endereco_lng, endereco_raio_m,
         regra_elegibilidade, criado_por)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
      `,
      [
        tituloFinal,
        tipoFinal,
        maxSel,
        statusFinal,
        escopoFinal,
        normalizeNullableNumber(evento_id),
        normalizeNullableNumber(turma_id),
        normalizeNullableNumber(unidade_id),
        endereco_texto != null ? String(endereco_texto).trim() : null,
        normalizeNullableNumber(endereco_lat),
        normalizeNullableNumber(endereco_lng),
        raio,
        regraFinal,
        req.user?.id || null,
      ]
    );

    log(rid, "info", "Votação criada", {
      id: rows?.[0]?.id,
      criadoPor: req.user?.id,
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    log(rid, "error", "Erro ao criar votação", err);
    return serverError(res, "Erro ao criar votação.");
  }
};

exports.atualizarVotacao = async (req, res) => {
  const rid = mkRid();
  try {
    const id = req.params.id;
    if (!isPositiveId(id)) return badRequest(res, "ID inválido.");

    const atual = await getVotacaoById(id);
    if (!atual) return notFound(res, "Não encontrada.");

    const campos = [
      "titulo",
      "tipo_selecao",
      "max_escolhas",
      "status",
      "escopo",
      "evento_id",
      "turma_id",
      "unidade_id",
      "endereco_texto",
      "endereco_lat",
      "endereco_lng",
      "endereco_raio_m",
      "regra_elegibilidade",
    ];

    const set = [];
    const vals = [];

    for (const c of campos) {
      if (!Object.prototype.hasOwnProperty.call(req.body || {}, c)) continue;

      let v = req.body[c];

      if (c === "titulo") {
        v = String(v || "").trim();
        if (!v || v.length < 3) {
          return badRequest(res, "Título é obrigatório (mín. 3 caracteres).");
        }
      }

      if (c === "tipo_selecao") {
        v = normalizeTipoSelecao(v);
        if (!v) return badRequest(res, "tipo_selecao inválido.");
      }

      if (c === "status") {
        v = normalizeStatus(v);
        if (!v) return badRequest(res, "status inválido.");
      }

      if (c === "escopo") {
        v = normalizeEscopo(v);
        if (!v) return badRequest(res, "escopo inválido.");
      }

      if (c === "regra_elegibilidade") {
        v = normalizeRegraElegibilidade(v);
        if (!v) return badRequest(res, "regra_elegibilidade inválida.");
      }

      if (c === "endereco_raio_m") {
        v = normRaio(v);
      }

      if (c === "max_escolhas") {
        v = asInt(v, 1);
        if (!Number.isInteger(v) || v <= 0) {
          return badRequest(res, "max_escolhas inválido.");
        }
      }

      if (["evento_id", "turma_id", "unidade_id", "endereco_lat", "endereco_lng"].includes(c)) {
        v = normalizeNullableNumber(v);
      }

      if (c === "endereco_texto" && v != null) {
        v = String(v).trim() || null;
      }

      set.push(`${c} = $${set.length + 1}`);
      vals.push(v);
    }

    const tipoFinal =
      Object.prototype.hasOwnProperty.call(req.body || {}, "tipo_selecao")
        ? normalizeTipoSelecao(req.body.tipo_selecao)
        : atual.tipo_selecao;

    const maxSelFinal =
      Object.prototype.hasOwnProperty.call(req.body || {}, "max_escolhas")
        ? asInt(req.body.max_escolhas, 1)
        : asInt(atual.max_escolhas, 1);

    const escopoFinal =
      Object.prototype.hasOwnProperty.call(req.body || {}, "escopo")
        ? normalizeEscopo(req.body.escopo)
        : atual.escopo;

    const eventoFinal =
      Object.prototype.hasOwnProperty.call(req.body || {}, "evento_id")
        ? normalizeNullableNumber(req.body.evento_id)
        : atual.evento_id;

    const turmaFinal =
      Object.prototype.hasOwnProperty.call(req.body || {}, "turma_id")
        ? normalizeNullableNumber(req.body.turma_id)
        : atual.turma_id;

    if (tipoFinal === "unica" && maxSelFinal !== 1) {
      return badRequest(res, "Para seleção única, max_escolhas deve ser 1.");
    }
    if (escopoFinal === "evento" && !isPositiveId(eventoFinal)) {
      return badRequest(res, "evento_id é obrigatório para escopo='evento'.");
    }
    if (escopoFinal === "turma" && !isPositiveId(turmaFinal)) {
      return badRequest(res, "turma_id é obrigatório para escopo='turma'.");
    }

    if (set.length === 0) {
      return badRequest(res, "Nenhum campo para atualizar.");
    }

    set.push(`atualizado_em = NOW()`);
    const q = `UPDATE votacao SET ${set.join(", ")} WHERE id = $${set.length + 1} RETURNING *`;
    vals.push(id);

    const { rows } = await query(q, vals);
    if (!rows.length) return notFound(res, "Não encontrada.");

    log(rid, "info", "Votação atualizada", { id, por: req.user?.id });
    return res.json(rows[0]);
  } catch (err) {
    log(rid, "error", "Erro ao atualizar votação", err);
    return serverError(res, "Erro ao atualizar votação.");
  }
};

exports.atualizarStatus = async (req, res) => {
  const rid = mkRid();
  try {
    const { id } = req.params;
    if (!isPositiveId(id)) return badRequest(res, "ID inválido.");

    const status = normalizeStatus(req.body?.status);
    if (!status) return badRequest(res, "Status inválido.");

    const { rows } = await query(
      `UPDATE votacao SET status = $2, atualizado_em = NOW() WHERE id = $1 RETURNING *`,
      [id, status]
    );

    if (!rows.length) return notFound(res, "Não encontrada.");

    log(rid, "info", "Status da votação alterado", { id, status, por: req.user?.id });
    return res.json(rows[0]);
  } catch (err) {
    log(rid, "error", "Erro ao atualizar status", err);
    return serverError(res, "Erro ao atualizar status da votação.");
  }
};

exports.listarVotacaoAdmin = async (req, res, opts = {}) => {
  const rid = mkRid();
  try {
    const { rows } = await query(`SELECT * FROM votacao ORDER BY criado_em DESC, id DESC`, []);
    if (opts.internal) return rows;
    return res.json(rows);
  } catch (err) {
    log(rid, "error", "Erro ao listar votações admin", err);
    if (opts.internal) return [];
    return serverError(res, "Erro ao listar votações.");
  }
};

exports.obterVotacaoAdmin = async (req, res, opts = {}) => {
  const rid = mkRid();
  try {
    const { id } = req.params;
    if (!isPositiveId(id)) {
      if (opts.internal) return null;
      return badRequest(res, "ID inválido.");
    }

    const v = await query(`SELECT * FROM votacao WHERE id = $1`, [id]);
    if (!v.rowCount) {
      if (opts.internal) return null;
      return notFound(res, "Não encontrada.");
    }

    const op = await query(
      `SELECT * FROM votacao_opcao WHERE votacao_id = $1 ORDER BY ordem ASC, id ASC`,
      [id]
    );

    const payload = { ...v.rows[0], opcao: op.rows || [] };

    if (opts.internal) return payload;
    return res.json(payload);
  } catch (err) {
    log(rid, "error", "Erro ao obter votação admin", err);
    if (opts.internal) return null;
    return serverError(res, "Erro ao obter votação.");
  }
};

// ───────────────────────────── Opções ─────────────────────────────
exports.criarOpcao = async (req, res) => {
  const rid = mkRid();
  try {
    const { id } = req.params;
    const { titulo, ordem = 0, ativo = true } = req.body || {};

    if (!isPositiveId(id)) return badRequest(res, "ID inválido.");

    const tituloFinal = String(titulo || "").trim();
    if (!tituloFinal) return badRequest(res, "Título da opção é obrigatório.");

    const votacao = await getVotacaoById(id);
    if (!votacao) return notFound(res, "Votação não encontrada.");

    const { rows } = await query(
      `
      INSERT INTO votacao_opcao (votacao_id, titulo, ordem, ativo)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [id, tituloFinal, asInt(ordem, 0), !!ativo]
    );

    log(rid, "info", "Opção criada", {
      opcaoId: rows?.[0]?.id,
      votacaoId: id,
    });

    return res.status(201).json(rows[0]);
  } catch (err) {
    log(rid, "error", "Erro ao criar opção", err);
    return serverError(res, "Erro ao criar opção.");
  }
};

exports.atualizarOpcao = async (req, res) => {
  const rid = mkRid();
  try {
    const { id, opcaoId } = req.params;
    if (!isPositiveId(id) || !isPositiveId(opcaoId)) {
      return badRequest(res, "Parâmetros inválidos.");
    }

    const updates = [];
    const vals = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "titulo")) {
      const titulo = String(req.body.titulo || "").trim();
      if (!titulo) return badRequest(res, "Título da opção é obrigatório.");
      updates.push(`titulo = $${updates.length + 3}`);
      vals.push(titulo);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "ordem")) {
      updates.push(`ordem = $${updates.length + 3}`);
      vals.push(asInt(req.body.ordem, 0));
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "ativo")) {
      updates.push(`ativo = $${updates.length + 3}`);
      vals.push(!!req.body.ativo);
    }

    if (!updates.length) {
      return badRequest(res, "Nenhum campo para atualizar.");
    }

    const sql = `
      UPDATE votacao_opcao
         SET ${updates.join(", ")}
       WHERE votacao_id = $1
         AND id = $2
      RETURNING *
    `;

    const { rows } = await query(sql, [id, opcaoId, ...vals]);
    if (!rows.length) return notFound(res, "Não encontrada.");

    log(rid, "info", "Opção atualizada", { votacaoId: id, opcaoId });
    return res.json(rows[0]);
  } catch (err) {
    log(rid, "error", "Erro ao atualizar opção", err);
    return serverError(res, "Erro ao atualizar opção.");
  }
};

// ───────────────────────────── Resultado ─────────────────────────────
exports.ranking = async (req, res, opts = {}) => {
  const rid = mkRid();
  try {
    const { id } = req.params;
    if (!isPositiveId(id)) {
      if (opts.internal) return [];
      return badRequest(res, "ID inválido.");
    }

    const { rows } = await query(
      `
      SELECT opcao_id, opcao_titulo, votos
      FROM vw_resultados_votacao
      WHERE votacao_id = $1
      ORDER BY votos DESC, opcao_titulo ASC
      `,
      [id]
    );

    if (opts.internal) return rows;
    return res.json(rows);
  } catch (err) {
    log(rid, "error", "Erro ao obter ranking", err);
    if (opts.internal) return [];
    return serverError(res, "Erro ao obter ranking da votação.");
  }
};

// ───────────────────────────── Fluxo do usuário ─────────────────────────────
exports.listarVotacaoElegiveis = async (req, res, opts = {}) => {
  const rid = mkRid();
  try {
    const { rows } = await query(
      `
      SELECT v.*
      FROM votacao v
      LEFT JOIN voto_submissao vs
        ON vs.votacao_id = v.id
       AND vs.usuario_id = $1
      WHERE v.status = 'ativa'
        AND vs.id IS NULL
      ORDER BY v.criado_em DESC, v.id DESC
      `,
      [req.user.id]
    );

    if (opts.internal) return rows;
    return res.json(rows);
  } catch (err) {
    log(rid, "error", "Erro ao listar votações elegíveis", err);
    if (opts.internal) return [];
    return serverError(res, "Erro ao listar votações disponíveis.");
  }
};

exports.votar = async (req, res) => {
  const rid = mkRid();
  let client;

  try {
    const votacaoId = asInt(req.params.id);
    const { opcao = [], cliLat = null, cliLng = null } = req.body || {};

    if (!isPositiveId(votacaoId)) return badRequest(res, "ID inválido.");

    const arr = ensureArrayOfInts(opcao);
    if (!arr || arr.length === 0) {
      return badRequest(res, "Selecione pelo menos uma opção.");
    }

    const arrDedupe = dedupeInts(arr);

    const votacao = await getVotacaoById(votacaoId);
    if (!votacao) return notFound(res, "Votação não encontrada.");

    const maxSel = asInt(votacao.max_escolhas, 1);

    if (votacao.tipo_selecao === "unica" && arrDedupe.length !== 1) {
      return badRequest(res, "Esta pergunta permite apenas uma opção.");
    }

    if (votacao.tipo_selecao === "multipla" && arrDedupe.length > maxSel) {
      return badRequest(
        res,
        `Você pode escolher no máximo ${maxSel} opção(ões).`
      );
    }

    const eleg = await checarElegibilidade({
      userId: req.user.id,
      votacao,
      cliLat,
      cliLng,
    });

    if (!eleg.ok) return forbidden(res, eleg.motivo);

    const { rows: validOps } = await query(
      `
      SELECT id
      FROM votacao_opcao
      WHERE votacao_id = $1
        AND ativo = TRUE
        AND id = ANY($2::bigint[])
      `,
      [votacaoId, arrDedupe]
    );

    if (validOps.length !== arrDedupe.length) {
      return badRequest(res, "Há opções inválidas para esta votação.");
    }

    client = await getClient();
    await client.query("BEGIN");

    const ip = String(req.headers["x-forwarded-for"] || req.ip || "")
      .split(",")[0]
      .trim();
    const ua = String(req.headers["user-agent"] || "").slice(0, 1000);

    const ins = await client.query(
      `
      INSERT INTO voto_submissao
        (votacao_id, usuario_id, ip, user_agent, cli_lat, cli_lng)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (votacao_id, usuario_id) DO NOTHING
      RETURNING id
      `,
      [votacaoId, req.user.id, ip || null, ua || null, cliLat, cliLng]
    );

    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ erro: "Você já votou nesta pergunta." });
    }

    const votoId = ins.rows[0].id;
    const values = arrDedupe.map((_, i) => `($1, $${i + 2})`).join(", ");

    await client.query(
      `
      INSERT INTO voto_submissao_opcao (voto_id, opcao_id)
      VALUES ${values}
      `,
      [votoId, ...arrDedupe]
    );

    await client.query("COMMIT");

    log(rid, "info", "Voto registrado", {
      votacaoId,
      votoId,
      userId: req.user?.id,
      escolhas: arrDedupe,
    });

    return res.status(201).json({ ok: true, voto_id: votoId });
  } catch (e) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    log(rid, "error", "Falha ao registrar voto", e);
    return serverError(res, "Falha ao registrar voto.");
  } finally {
    if (client) client.release();
  }
};

// ───────────────────────────── Util: URL canônica ─────────────────────────────
exports.getUrl = async (req, res) => {
  const rid = mkRid();
  try {
    const { id } = req.params;
    if (!isPositiveId(id)) return badRequest(res, "ID inválido.");

    const r = await query(`SELECT 1 FROM votacao WHERE id = $1`, [id]);
    if (!r.rowCount) return notFound(res, "Votação não encontrada.");

    const url = buildCanonicalUrl(req, id);
    return res.json({ url });
  } catch (err) {
    log(rid, "error", "Erro ao gerar URL da votação", err);
    return serverError(res, "Erro ao gerar URL da votação.");
  }
};