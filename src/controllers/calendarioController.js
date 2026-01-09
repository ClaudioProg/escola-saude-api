// ✅ src/controllers/calendarioController.js
/* eslint-disable no-console */
const dbFallback = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

// ✅ ajuste conforme seus tipos reais (exemplos comuns)
const TIPOS_PERMITIDOS = new Set([
  "bloqueio",
  "feriado",
  "manutencao",
  "evento",
]);

function getDb(req) {
  return req?.db ?? dbFallback;
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

function normTipo(tipo) {
  if (tipo == null) return "";
  return String(tipo).trim().toLowerCase();
}

function normDescricao(descricao) {
  if (descricao == null) return null;
  const t = String(descricao).trim();
  if (!t) return null;
  // limite “saudável” p/ evitar payloads enormes
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

module.exports = {
  /* ─────────────────── Listar ─────────────────── */
  async listar(req, res) {
    const db = getDb(req);

    try {
      const sql = `
        SELECT id, data, tipo, descricao, criado_em, atualizado_em
          FROM calendario_bloqueios
         ORDER BY data ASC, id ASC
      `;
      const { rows } = await db.query(sql);
      return res.json(rows || []);
    } catch (e) {
      console.error("[calendario] listar erro:", { rid: rid(req), msg: e?.message });
      return res.status(500).json({
        erro: "Erro ao listar datas.",
        detalhe: IS_DEV ? e?.message : undefined,
      });
    }
  },

  /* ─────────────────── Criar ─────────────────── */
  async criar(req, res) {
    const db = getDb(req);

    try {
      const { data, tipo, descricao } = req.body || {};
      const tipoNorm = normTipo(tipo);
      const descNorm = normDescricao(descricao);

      if (IS_DEV) {
        console.log("[calendario] criar body recebido:", { rid: rid(req), data, tipo: tipoNorm, hasDescricao: !!descNorm });
      }

      if (!data || !tipoNorm) {
        return res.status(400).json({ erro: "Data e tipo são obrigatórios." });
      }

      // valida formato "YYYY-MM-DD" (date-only safe)
      if (!isYmd(String(data).trim())) {
        return res.status(400).json({ erro: "Data em formato inválido. Use o padrão AAAA-MM-DD." });
      }

      // valida tipo
      if (TIPOS_PERMITIDOS.size && !TIPOS_PERMITIDOS.has(tipoNorm)) {
        return res.status(400).json({
          erro: "Tipo inválido.",
          tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
        });
      }

      const sql = `
        INSERT INTO calendario_bloqueios (data, tipo, descricao)
        VALUES ($1::date, $2, $3)
        RETURNING id, data, tipo, descricao, criado_em, atualizado_em;
      `;

      const params = [String(data).trim(), tipoNorm, descNorm];

      const { rows } = await db.query(sql, params);

      if (IS_DEV) console.log("[calendario] criar OK:", { rid: rid(req), id: rows?.[0]?.id });

      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error("[calendario] criar erro:", {
        rid: rid(req),
        message: e?.message,
        code: e?.code,
        detail: IS_DEV ? e?.detail : undefined,
        constraint: e?.constraint,
      });

      // duplicidade (unique)
      if (e?.code === "23505") {
        return res.status(400).json({ erro: "Esta data já foi cadastrada." });
      }

      // erro de formato de data
      if (e?.code === "22007") {
        return res.status(400).json({ erro: "Data em formato inválido. Use o padrão AAAA-MM-DD." });
      }

      return res.status(500).json({
        erro: "Erro ao criar data.",
        detalhe: IS_DEV ? e?.message : undefined,
      });
    }
  },

  /* ─────────────────── Atualizar ─────────────────── */
  async atualizar(req, res) {
    const db = getDb(req);

    try {
      const id = toIntId(req.params.id);
      if (!id) return res.status(400).json({ erro: "id inválido." });

      const { tipo, descricao } = req.body || {};
      const tipoNorm = tipo == null ? null : normTipo(tipo);
      const descNorm = descricao === undefined ? undefined : normDescricao(descricao);

      if (IS_DEV) console.log("[calendario] atualizar:", { rid: rid(req), id, tipo: tipoNorm, hasDescricao: !!descNorm });

      // não permite update vazio
      if (tipoNorm == null && descNorm === undefined) {
        return res.status(400).json({ erro: "Nada para atualizar. Envie 'tipo' e/ou 'descricao'." });
      }

      if (tipoNorm != null) {
        if (!tipoNorm) return res.status(400).json({ erro: "Tipo inválido." });
        if (TIPOS_PERMITIDOS.size && !TIPOS_PERMITIDOS.has(tipoNorm)) {
          return res.status(400).json({
            erro: "Tipo inválido.",
            tipos_permitidos: Array.from(TIPOS_PERMITIDOS),
          });
        }
      }

      // build update dinâmico (premium)
      const sets = [];
      const params = [];
      let idx = 1;

      if (tipoNorm != null) {
        sets.push(`tipo = $${idx++}`);
        params.push(tipoNorm);
      }

      if (descNorm !== undefined) {
        sets.push(`descricao = $${idx++}`);
        params.push(descNorm ?? null);
      }

      sets.push(`atualizado_em = NOW()`);

      params.push(id);

      const sql = `
        UPDATE calendario_bloqueios
           SET ${sets.join(", ")}
         WHERE id = $${idx}
         RETURNING id, data, tipo, descricao, criado_em, atualizado_em;
      `;

      const { rows } = await db.query(sql, params);

      if (!rows[0]) return res.status(404).json({ erro: "Registro não encontrado." });

      return res.json(rows[0]);
    } catch (e) {
      console.error("[calendario] atualizar erro:", { rid: rid(req), msg: e?.message });
      return res.status(500).json({
        erro: "Erro ao atualizar data.",
        detalhe: IS_DEV ? e?.message : undefined,
      });
    }
  },

  /* ─────────────────── Excluir ─────────────────── */
  async excluir(req, res) {
    const db = getDb(req);

    try {
      const id = toIntId(req.params.id);
      if (!id) return res.status(400).json({ erro: "id inválido." });

      if (IS_DEV) console.log("[calendario] excluir:", { rid: rid(req), id });

      const { rowCount } = await db.query(`DELETE FROM calendario_bloqueios WHERE id = $1`, [id]);

      if (!rowCount) return res.status(404).json({ erro: "Registro não encontrado." });

      return res.json({ ok: true });
    } catch (e) {
      console.error("[calendario] excluir erro:", { rid: rid(req), msg: e?.message });
      return res.status(500).json({
        erro: "Erro ao excluir data.",
        detalhe: IS_DEV ? e?.message : undefined,
      });
    }
  },
};
