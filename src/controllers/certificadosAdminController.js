// 📁 src/controllers/certificadosAdminController.js
const db = require("../db");

/**
 * GET /api/certificados-admin/arvore
 * Retorna: [{ evento_id, evento_titulo, turmas: [{ turma_id, turma_nome, data_inicio, data_fim,
 *   totais: { presentes, emitidos, pendentes },
 *   participantes: [{ usuario_id, nome, email, emitido, certificado_id, arquivo_pdf }]
 * }]}]
 * - Participantes = usuários com pelo menos 1 presença (presente = true) na turma.
 * - "emitido" vem de certificados(tipo='usuario').
 * - Filtros opcionais: ?eventoId= & ?turmaId=
 */
exports.listarArvore = async (req, res) => {
  try {
    const eventoId = Number(req.query.eventoId) || null;
    const turmaId  = Number(req.query.turmaId)  || null;

    // 1) Eventos + Turmas
    const eventosTurmasSQL = `
      SELECT
        e.id   AS evento_id,   e.titulo AS evento_titulo,
        t.id   AS turma_id,    t.nome   AS turma_nome,
        t.data_inicio, t.data_fim
      FROM eventos e
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ($1::int IS NULL OR e.id = $1)
        AND ($2::int IS NULL OR t.id = $2)
      ORDER BY e.titulo ASC, t.data_inicio ASC, t.id ASC
    `;
    const et = await db.query(eventosTurmasSQL, [eventoId, turmaId]);
    if (et.rowCount === 0) return res.json([]);

    const turmaIds = et.rows.map(r => r.turma_id);

    // 2) Participantes presentes por turma + status de certificado
    const participantesSQL = `
      SELECT
        p.turma_id,
        u.id   AS usuario_id,
        u.nome,
        u.email,
        MAX( CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END )::int AS emitido,
        MAX(c.id)      AS certificado_id,
        MAX(c.arquivo_pdf) AS arquivo_pdf
      FROM presencas p
      JOIN usuarios u ON u.id = p.usuario_id
      LEFT JOIN certificados c
        ON c.usuario_id = u.id AND c.turma_id = p.turma_id AND c.tipo = 'usuario'
      WHERE p.presente = TRUE
        AND p.turma_id = ANY($1::int[])
      GROUP BY p.turma_id, u.id, u.nome, u.email
      ORDER BY u.nome ASC
    `;
    const part = await db.query(participantesSQL, [turmaIds]);

    // 3) Montagem {evento → turmas → participantes}
    const porTurma = new Map();
    for (const r of part.rows) {
      const arr = porTurma.get(r.turma_id) || [];
      arr.push({
        usuario_id: r.usuario_id,
        nome: r.nome,
        email: r.email,
        emitido: r.emitido === 1,
        certificado_id: r.certificado_id || null,
        arquivo_pdf: r.arquivo_pdf || null,
      });
      porTurma.set(r.turma_id, arr);
    }

    const eventosMap = new Map();
    for (const row of et.rows) {
      const evId = row.evento_id;
      if (!eventosMap.has(evId)) {
        eventosMap.set(evId, { evento_id: evId, evento_titulo: row.evento_titulo, turmas: [] });
      }
      const participantes = porTurma.get(row.turma_id) || [];
      const emitidos  = participantes.filter(p => p.emitido).length;
      const presentes = participantes.length;
      const pendentes = Math.max(0, presentes - emitidos);

      eventosMap.get(evId).turmas.push({
        turma_id: row.turma_id,
        turma_nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        totais: { presentes, emitidos, pendentes },
        participantes
      });
    }

    res.json(Array.from(eventosMap.values()));
  } catch (err) {
    console.error("Erro listarArvore:", err);
    res.status(500).json({ erro: "Falha ao carregar árvore de certificados." });
  }
};

/**
 * POST /api/certificados-admin/turmas/:turmaId/reset
 * Remove certificados (tipo='usuario') da turma informada.
 * ⚠️ Não apaga PDFs em disco aqui — apenas registros (comportamento seguro p/ teste).
 */
exports.resetTurma = async (req, res) => {
  const turmaId = Number(req.params.turmaId);
  if (!Number.isFinite(turmaId)) return res.status(400).json({ erro: "turmaId inválido." });

  try {
    const del = await db.query(
      "DELETE FROM certificados WHERE turma_id = $1 AND tipo = 'usuario' RETURNING id",
      [turmaId]
    );
    return res.json({ ok: true, apagados: del.rowCount });
  } catch (err) {
    console.error("Erro resetTurma (admin):", err);
    res.status(500).json({ erro: "Falha ao resetar certificados da turma." });
  }
};
