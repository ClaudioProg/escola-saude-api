// ✅ src/controllers/calendarioController.js
const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";

module.exports = {
  /* ─────────────────── Listar ─────────────────── */
  async listar(req, res) {
    try {
      const sql = `
        SELECT id, data, tipo, descricao, criado_em, atualizado_em
        FROM calendario_bloqueios
        ORDER BY data ASC, id ASC
      `;
      const { rows } = await db.query(sql);
      return res.json(rows);
    } catch (e) {
      console.error("[calendario] listar erro:", e);
      return res.status(500).json({
        erro: "Erro ao listar datas.",
        detalhe: IS_DEV ? e.message : undefined,
      });
    }
  },

  /* ─────────────────── Criar ─────────────────── */
  async criar(req, res) {
    try {
      const { data, tipo, descricao } = req.body;

      console.log("[calendario] criar body recebido:", {
        data,
        tipo,
        descricao,
      });

      if (!data || !tipo) {
        return res
          .status(400)
          .json({ erro: "Data e tipo são obrigatórios." });
      }

      const sql = `
        INSERT INTO calendario_bloqueios (data, tipo, descricao)
        VALUES ($1::date, $2, $3)
        RETURNING id, data, tipo, descricao, criado_em, atualizado_em;
      `;

      const params = [data, tipo, descricao || null];

      const { rows } = await db.query(sql, params);
      console.log("[calendario] criar OK:", rows[0]);

      return res.status(201).json(rows[0]);
    } catch (e) {
      console.error("[calendario] criar erro:", {
        message: e.message,
        code: e.code,
        detail: e.detail,
        table: e.table,
        constraint: e.constraint,
      });

      // duplicidade de data (unique)
      if (e.code === "23505") {
        return res
          .status(400)
          .json({ erro: "Esta data já foi cadastrada." });
      }

      // erro de formato de data
      if (e.code === "22007") {
        return res.status(400).json({
          erro: "Data em formato inválido. Use o padrão AAAA-MM-DD.",
        });
      }

      return res.status(500).json({
        erro: "Erro ao criar data.",
        detalhe: IS_DEV ? e.message : undefined,
      });
    }
  },

  /* ─────────────────── Atualizar ─────────────────── */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { tipo, descricao } = req.body;

      console.log("[calendario] atualizar:", { id, tipo, descricao });

      const sql = `
        UPDATE calendario_bloqueios
        SET tipo = $1,
            descricao = $2,
            atualizado_em = NOW()
        WHERE id = $3
        RETURNING id, data, tipo, descricao, criado_em, atualizado_em;
      `;
      const { rows } = await db.query(sql, [tipo, descricao || null, id]);

      if (!rows[0]) {
        return res.status(404).json({ erro: "Registro não encontrado." });
      }

      return res.json(rows[0]);
    } catch (e) {
      console.error("[calendario] atualizar erro:", e);
      return res.status(500).json({
        erro: "Erro ao atualizar data.",
        detalhe: IS_DEV ? e.message : undefined,
      });
    }
  },

  /* ─────────────────── Excluir ─────────────────── */
  async excluir(req, res) {
    try {
      const { id } = req.params;
      console.log("[calendario] excluir id:", id);

      const { rowCount } = await db.query(
        `DELETE FROM calendario_bloqueios WHERE id = $1`,
        [id]
      );

      if (!rowCount) {
        return res.status(404).json({ erro: "Registro não encontrado." });
      }

      return res.json({ ok: true });
    } catch (e) {
      console.error("[calendario] excluir erro:", e);
      return res.status(500).json({
        erro: "Erro ao excluir data.",
        detalhe: IS_DEV ? e.message : undefined,
      });
    }
  },
};
