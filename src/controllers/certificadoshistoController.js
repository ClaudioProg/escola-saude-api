const db = require("../db");

/**
 * 📄 Lista o histórico de certificados emitidos, com filtros por nome, CPF, evento e período.
 * @route GET /api/certificados/historico
 */
async function listarHistoricoCertificados(req, res) {
  const { filtro, periodoInicio, periodoFim } = req.query;
  const params = [];
  let sql = `
    SELECT 
      c.id, 
      u.nome, 
      u.cpf, 
      e.titulo AS evento, 
      c.emitido_em, 
      c.status
    FROM certificados c
    JOIN usuarios u ON c.usuario_id = u.id
    JOIN eventos e ON c.evento_id = e.id
    WHERE 1 = 1
  `;

  if (filtro) {
    params.push(`%${filtro}%`);
    sql += ` AND (u.nome ILIKE $${params.length} OR u.cpf ILIKE $${params.length} OR e.titulo ILIKE $${params.length})`;
  }

  if (periodoInicio && periodoFim) {
    params.push(periodoInicio, periodoFim);
    sql += ` AND c.emitido_em BETWEEN $${params.length - 1} AND $${params.length}`;
  }

  sql += " ORDER BY c.emitido_em DESC";

  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Erro ao listar certificados:", error.message);
    res.status(500).json({ erro: "Erro ao buscar certificados." });
  }
}

/**
 * 🔄 Revalida um certificado definindo seu status como 'emitido'
 * @route PUT /api/certificados/revalidar/:id
 */
async function revalidarCertificado(req, res) {
  const { id } = req.params;

  try {
    await db.query(
      "UPDATE certificados SET status = 'emitido' WHERE id = $1",
      [id]
    );

    res.json({ mensagem: "✅ Certificado revalidado com sucesso." });
  } catch (error) {
    console.error("❌ Erro ao revalidar certificado:", error.message);
    res.status(500).json({ erro: "Erro ao revalidar certificado." });
  }
}

module.exports = {
  listarHistoricoCertificados,
  revalidarCertificado,
};
