// ✅ src/controllers/calendarioController.js — PREMIUM (alinhado ao BANCO, sem mexer em schema)
// - Tipos permitidos = exatamente os 4 do CHECK do Postgres
// - Normaliza tipo (case/trim) e aceita tipo vindo como objeto {value,label}
// - Valida date-only "YYYY-MM-DD" (sem timezone shift)
// - Mensagens consistentes (ApiError-friendly)
// - Tratamento: duplicidade 23505, data inválida 22007, check 23514 (tipo inválido no banco)
// - Atualização dinâmica segura
// - getDb resiliente (pg + pg-promise)

"use strict";
/* eslint-disable no-console */
const dbFallback = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

// ✅ TIPOS REAIS DO BANCO (CHECK calendario_bloqueios_tipo_check)
const TIPOS_PERMITIDOS = new Set([
  "feriado_nacional",
  "feriado_municipal",
  "ponto_facultativo",
  "bloqueio_interno",
]);

function getDb(req) {
  // suporta:
  // - middleware injeta req.db (pg ou pg-promise)
  // - dbFallback = pool/query (pg) ou { db } / pg-promise
  return req?.db ?? dbFallback?.db ?? dbFallback;
}

function rid(req) {
  return req?.requestId;
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pickTipoInput(tipo) {
  // ✅ aceita:
  // - "feriado_nacional"
  // - { value: "feriado_nacional", label: "Feriado nacional" }
  // - { tipo: "feriado_nacional" } (casos esquisitos)
  if (tipo == null) return "";
  if (typeof tipo === "object") {
    if (tipo.value != null) return String(tipo.value);
    if (tipo.tipo != null) return String(tipo.tipo);
    return "";
  }
  return String(tipo);
}

function normTipo(tipo) {
  const raw = pickTipoInput(tipo);
  return raw.trim().toLowerCase();
}

function normDescricao(descricao) {
  if (descricao == null) return null;
  const t = String(descricao).trim();
  if (!t) return null;
  // limite “saudável” p/ evitar payloads enormes
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

// ✅ helper query compat (pg + pg-promise)
async function q(db, sql, params = []) {
  // pg: db.query
  if (db?.query) return db.query(sql, params);

  // pg-promise: db.any / oneOrNone / none
  if (db?.any) {
    // tenta inferir pelo SQL (bem simples)
    const op = String(sql).trim().slice(0, 6).toUpperCase();
    if (op.startsWith("SELECT")) {
      const rows = await db.any(sql, params);
      return { rows, rowCount: rows.length };
    }
    // INSERT/UPDATE/DELETE com RETURNING -> oneOrNone
    if (/RETURNING/i.test(sql)) {
      const row = await db.oneOrNone(sql, params);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    // sem returning -> none
    await db.none(sql, params);
    return { rows: [], rowCount: 0 };
  }

  throw new Error("DB inválido: não possui query/any.");
}

function badRequest(res, msg, extra) {
  return res.status(400).json({ erro: msg, ...(extra || {}) });
}

function conflict(res, msg, extra) {
  return res.status(409).json({ erro: msg, ...(extra || {}) });
}

function serverError(res, msg, e) {
  return res.status(500).json({
    erro: msg,
    detalhe: IS_DEV ? e?.message : undefined,
  });
}

// ✅ normaliza retorno de "data" sempre como YYYY-MM-DD (string)
function normalizeRowDateOnly(row) {
  if (!row) return row;
  // se vier Date, converte com toISOString (date-only)
  if (row.data instanceof Date) {
    const iso = row.data.toISOString().slice(0, 10);
    return { ...row, data: iso };
  }
  // se vier string "2026-01-26T00:00:00.000Z" etc
  if (typeof row.data === "string" && row.data.includes("T")) {
    return { ...row, data: row.data.slice(0, 10) };
  }
  return row;
}

module.exports = {
  /* ─────────────────── Listar ─────────────────── */
  async listar(req, res) {
    const db = getDb(req);
    try {
      // força data como YYYY-MM-DD já no SQL (evita variações do driver)
      const sql = `
        SELECT
          id,
          to_char(data::date,'YYYY-MM-DD') AS data,
          tipo,
          descricao,
          criado_em,
          atualizado_em
        FROM calendario_bloqueios
        ORDER BY data ASC, id ASC
      `;

      const r = await q(db, sql);
      const rows = (r.rows || []).map(normalizeRowDateOnly);

      res.set?.("X-Calendario-Handler", "calendarioController:listar@premium");
      return res.json(rows);
    } catch (e) {
      console.error("[calendario] listar erro:", { rid: rid(req), msg: e?.message, code: e?.code });
      return serverError(res, "Erro ao listar datas.", e);
    }
  },

  /* ─────────────────── Criar ─────────────────── */
  async criar(req, res) {
    const db = getDb(req);

    try {
      const body = req.body || {};
      const dataRaw = body.data;
      const tipoNorm = normTipo(body.tipo);
      const descNorm = normDescricao(body.descricao);

      const data = typeof dataRaw === "string" ? dataRaw.trim() : "";

      if (IS_DEV) {
        console.log("[calendario] criar body recebido:", {
          rid: rid(req),
          data,
          tipo: tipoNorm,
          hasDescricao: !!descNorm,
        });
      }

      if (!data || !tipoNorm) {
        return badRequest(res, "Data e tipo são obrigatórios.");
      }

      if (!isYmd(data)) {
        return badRequest(res, "Data em formato inválido. Use o padrão AAAA-MM-DD.");
      }

      if (TIPOS_PERMITIDOS.size && !TIPOS_PERMITIDOS.has(tipoNorm)) {
        return badRequest(res, "Tipo inválido.", {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
          recebido: tipoNorm,
        });
      }

      const sql = `
        INSERT INTO calendario_bloqueios (data, tipo, descricao)
        VALUES ($1::date, $2, $3)
        RETURNING
          id,
          to_char(data::date,'YYYY-MM-DD') AS data,
          tipo,
          descricao,
          criado_em,
          atualizado_em;
      `;

      const params = [data, tipoNorm, descNorm];

      const r = await q(db, sql, params);
      const row = normalizeRowDateOnly(r.rows?.[0]);

      if (IS_DEV) console.log("[calendario] criar OK:", { rid: rid(req), id: row?.id });

      return res.status(201).json(row);
    } catch (e) {
      console.error("[calendario] criar erro:", {
        rid: rid(req),
        message: e?.message,
        code: e?.code,
        detail: IS_DEV ? e?.detail : undefined,
        constraint: e?.constraint,
      });

      if (e?.code === "23505") {
        // duplicidade (unique)
        return conflict(res, "Esta data já foi cadastrada.");
      }

      if (e?.code === "23514") {
        return badRequest(res, "Tipo inválido (restrição do banco).", {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        });
      }

      if (e?.code === "22007") {
        return badRequest(res, "Data em formato inválido. Use o padrão AAAA-MM-DD.");
      }

      return serverError(res, "Erro ao criar data.", e);
    }
  },

  /* ─────────────────── Atualizar ─────────────────── */
  async atualizar(req, res) {
    const db = getDb(req);

    try {
      const id = toIntId(req.params.id);
      if (!id) return badRequest(res, "id inválido.");

      const body = req.body || {};

      const tipoEnviado = Object.prototype.hasOwnProperty.call(body, "tipo");
      const descEnviado = Object.prototype.hasOwnProperty.call(body, "descricao");

      const tipoNorm = tipoEnviado ? normTipo(body.tipo) : null;
      const descNorm = descEnviado ? normDescricao(body.descricao) : undefined;

      if (IS_DEV) {
        console.log("[calendario] atualizar:", {
          rid: rid(req),
          id,
          tipoEnviado,
          descEnviado,
          tipo: tipoNorm,
          hasDescricao: !!descNorm,
        });
      }

      if (!tipoEnviado && !descEnviado) {
        return badRequest(res, "Nada para atualizar. Envie 'tipo' e/ou 'descricao'.");
      }

      if (tipoEnviado) {
        // se enviou tipo, ele precisa ser válido (não permite vazio)
        if (!tipoNorm) return badRequest(res, "Tipo inválido.");
        if (TIPOS_PERMITIDOS.size && !TIPOS_PERMITIDOS.has(tipoNorm)) {
          return badRequest(res, "Tipo inválido.", {
            tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
            recebido: tipoNorm,
          });
        }
      }

      const sets = [];
      const params = [];
      let idx = 1;

      if (tipoEnviado) {
        sets.push(`tipo = $${idx++}`);
        params.push(tipoNorm);
      }

      if (descEnviado) {
        sets.push(`descricao = $${idx++}`);
        params.push(descNorm ?? null);
      }

      sets.push(`atualizado_em = NOW()`);
      params.push(id);

      const sql = `
        UPDATE calendario_bloqueios
           SET ${sets.join(", ")}
         WHERE id = $${idx}
         RETURNING
           id,
           to_char(data::date,'YYYY-MM-DD') AS data,
           tipo,
           descricao,
           criado_em,
           atualizado_em;
      `;

      const r = await q(db, sql, params);
      const row = normalizeRowDateOnly(r.rows?.[0]);

      if (!row) return res.status(404).json({ erro: "Registro não encontrado." });

      return res.json(row);
    } catch (e) {
      console.error("[calendario] atualizar erro:", {
        rid: rid(req),
        msg: e?.message,
        code: e?.code,
        detail: IS_DEV ? e?.detail : undefined,
        constraint: e?.constraint,
      });

      if (e?.code === "23514") {
        return badRequest(res, "Tipo inválido (restrição do banco).", {
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        });
      }

      return serverError(res, "Erro ao atualizar data.", e);
    }
  },

  /* ─────────────────── Excluir ─────────────────── */
  async excluir(req, res) {
    const db = getDb(req);

    try {
      const id = toIntId(req.params.id);
      if (!id) return badRequest(res, "id inválido.");

      if (IS_DEV) console.log("[calendario] excluir:", { rid: rid(req), id });

      const r = await q(db, `DELETE FROM calendario_bloqueios WHERE id = $1`, [id]);

      // pg usa rowCount; pg-promise no helper retorna 0 (mas aqui não temos returning)
      // então tentamos confirmar com SELECT quando for pg-promise (opcional, barato)
      const rowCount = Number(r.rowCount || 0);

      if (rowCount === 0 && db?.any) {
        // pg-promise: re-checa existência antes de dar 404? (pra manter comportamento)
        const check = await q(db, `SELECT 1 FROM calendario_bloqueios WHERE id = $1 LIMIT 1`, [id]);
        if (!check.rowCount) return res.status(404).json({ erro: "Registro não encontrado." });

        // existe, mas delete não reportou -> assume ok
        return res.json({ ok: true });
      }

      if (!rowCount) return res.status(404).json({ erro: "Registro não encontrado." });

      return res.json({ ok: true });
    } catch (e) {
      console.error("[calendario] excluir erro:", { rid: rid(req), msg: e?.message, code: e?.code });
      return serverError(res, "Erro ao excluir data.", e);
    }
  },
};
