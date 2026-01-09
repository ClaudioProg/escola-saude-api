// ✅ src/controllers/certificadosAdminController.js
/* eslint-disable no-console */
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const dbFallback = require("../db");
const { CERT_DIR, ensureDir } = require("../paths");

const IS_DEV = process.env.NODE_ENV !== "production";

function getDb(req) {
  return req?.db ?? dbFallback;
}
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/**
 * GET /api/certificados-admin/arvore
 * Retorna: [{ evento_id, evento_titulo, turmas: [{ turma_id, turma_nome, data_inicio, data_fim,
 *   totais: { presentes, emitidos, pendentes },
 *   participantes: [{ usuario_id, nome, email, emitido, certificado_id, arquivo_pdf }]}
 * ]}]
 *
 * - Participantes = usuários com pelo menos 1 presença (presente=true) na turma.
 * - "emitido" vem de certificados(tipo='usuario') (pega o mais recente por turma/usuario).
 * - Filtros opcionais: ?eventoId= & ?turmaId=
 */
exports.listarArvore = async (req, res) => {
  const db = getDb(req);

  try {
    const eventoId = toIntId(req.query.eventoId);
    const turmaId = toIntId(req.query.turmaId);

    // ✅ 1) Eventos + Turmas (com filtros)
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
    const et = await db.query(eventosTurmasSQL, [eventoId ?? null, turmaId ?? null]);
    if (et.rowCount === 0) return res.json([]);

    const turmaIds = et.rows.map((r) => r.turma_id);

    // ✅ 2) Participantes (presentes) + certificado mais recente (LATERAL)
    // Premium:
    // - DISTINCT por (turma_id, usuario_id) para evitar inflar
    // - LATERAL pega 1 certificado (mais recente) por usuario/turma/tipo
    const participantesSQL = `
      WITH presentes AS (
        SELECT DISTINCT p.turma_id, p.usuario_id
        FROM presencas p
        WHERE p.presente = TRUE
          AND p.turma_id = ANY($1::int[])
      )
      SELECT
        pr.turma_id,
        u.id    AS usuario_id,
        u.nome,
        u.email,
        (c1.id IS NOT NULL) AS emitido,
        c1.id               AS certificado_id,
        c1.arquivo_pdf      AS arquivo_pdf
      FROM presentes pr
      JOIN usuarios u ON u.id = pr.usuario_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.arquivo_pdf
        FROM certificados c
        WHERE c.usuario_id = pr.usuario_id
          AND c.turma_id   = pr.turma_id
          AND c.tipo       = 'usuario'
        ORDER BY c.gerado_em DESC NULLS LAST, c.id DESC
        LIMIT 1
      ) c1 ON TRUE
      ORDER BY pr.turma_id ASC, u.nome ASC
    `;
    const part = await db.query(participantesSQL, [turmaIds]);

    // 3) Agrupa participantes por turma
    const porTurma = new Map();
    for (const r of part.rows || []) {
      const arr = porTurma.get(r.turma_id) || [];
      arr.push({
        usuario_id: r.usuario_id,
        nome: r.nome,
        email: r.email,
        emitido: Boolean(r.emitido),
        certificado_id: r.certificado_id || null,
        arquivo_pdf: r.arquivo_pdf || null,
      });
      porTurma.set(r.turma_id, arr);
    }

    // 4) Montagem {evento → turmas → participantes}
    const eventosMap = new Map();
    for (const row of et.rows) {
      const evId = row.evento_id;

      if (!eventosMap.has(evId)) {
        eventosMap.set(evId, {
          evento_id: evId,
          evento_titulo: row.evento_titulo,
          turmas: [],
        });
      }

      const participantes = porTurma.get(row.turma_id) || [];
      const presentes = participantes.length;
      const emitidos = participantes.reduce((acc, p) => acc + (p.emitido ? 1 : 0), 0);
      const pendentes = Math.max(0, presentes - emitidos);

      eventosMap.get(evId).turmas.push({
        turma_id: row.turma_id,
        turma_nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        totais: { presentes, emitidos, pendentes },
        participantes,
      });
    }

    return res.json(Array.from(eventosMap.values()));
  } catch (err) {
    console.error("Erro listarArvore:", IS_DEV ? err : err?.message);
    return res.status(500).json({ erro: "Falha ao carregar árvore de certificados." });
  }
};

/**
 * POST /api/certificados-admin/turmas/:turmaId/reset
 * Premium:
 * - apaga PDFs físicos associados (tipo='usuario') antes de deletar do banco
 * - retorna contagem de PDFs removidos + registros deletados
 */
exports.resetTurma = async (req, res) => {
  const db = getDb(req);

  const turmaId = toIntId(req.params.turmaId);
  if (!turmaId) return res.status(400).json({ erro: "turmaId inválido." });

  try {
    // ✅ lista arquivos (pra apagar no disco)
    const arquivos = await db.query(
      `
      SELECT id, arquivo_pdf
      FROM certificados
      WHERE turma_id = $1
        AND tipo = 'usuario'
      `,
      [turmaId]
    );

    await ensureDir(CERT_DIR);

    let pdfsRemovidos = 0;
    for (const r of arquivos.rows || []) {
      const nome = r.arquivo_pdf;
      if (!nome) continue;
      const p = path.join(CERT_DIR, nome);

      // segurança: garante que está dentro do CERT_DIR
      if (!p.startsWith(path.resolve(CERT_DIR))) continue;

      const ok = await fsp
        .unlink(p)
        .then(() => true)
        .catch(() => false);

      if (ok) pdfsRemovidos += 1;
    }

    // ✅ remove do banco (agora sim, reset completo)
    const del = await db.query(
      `DELETE FROM certificados WHERE turma_id = $1 AND tipo = 'usuario' RETURNING id`,
      [turmaId]
    );

    // (opcional) limpar cache
    await db.query("DELETE FROM certificados_cache WHERE turma_id = $1", [turmaId]).catch(() => {});

    return res.json({
      ok: true,
      turma_id: turmaId,
      pdfs_removidos: pdfsRemovidos,
      registros_apagados: del.rowCount,
    });
  } catch (err) {
    console.error("Erro resetTurma (admin):", IS_DEV ? err : err?.message);
    return res.status(500).json({ erro: "Falha ao resetar certificados da turma." });
  }
};
