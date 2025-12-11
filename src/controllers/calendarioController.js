const db = require("../db");

module.exports = {
  async listar(req, res) {
    try {
      const sql = `SELECT * FROM calendario_bloqueios ORDER BY data ASC`;
      const { rows } = await db.query(sql);
      res.json(rows);
    } catch (e) {
      console.error("[calendario] listar erro:", e);
      res.status(500).json({ erro: "Erro ao listar datas" });
    }
  },

  async criar(req, res) {
    try {
      const { data, tipo, descricao } = req.body;

      if (!data || !tipo) {
        return res.status(400).json({ erro: "Data e tipo são obrigatórios" });
      }

      const sql = `
        INSERT INTO calendario_bloqueios (data, tipo, descricao)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;

      const { rows } = await db.query(sql, [data, tipo, descricao || null]);

      res.json(rows[0]);
    } catch (e) {
      console.error("[calendario] criar erro:", e);

      if (e.code === "23505") {
        return res.status(400).json({ erro: "Esta data já foi cadastrada" });
      }

      res.status(500).json({ erro: "Erro ao criar data" });
    }
  },

  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { tipo, descricao } = req.body;

      const sql = `
        UPDATE calendario_bloqueios
        SET tipo = $1,
            descricao = $2,
            atualizado_em = NOW()
        WHERE id = $3
        RETURNING *;
      `;
      const { rows } = await db.query(sql, [tipo, descricao, id]);

      res.json(rows[0]);
    } catch (e) {
      console.error("[calendario] atualizar erro:", e);
      res.status(500).json({ erro: "Erro ao atualizar data" });
    }
  },

  async excluir(req, res) {
    try {
      const { id } = req.params;

      await db.query(`DELETE FROM calendario_bloqueios WHERE id = $1`, [id]);

      res.json({ ok: true });
    } catch (e) {
      console.error("[calendario] excluir erro:", e);
      res.status(500).json({ erro: "Erro ao excluir data" });
    }
  },
};
