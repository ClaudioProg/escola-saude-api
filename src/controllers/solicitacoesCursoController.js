/* eslint-disable no-console */
const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;

/**
 * Retorna métricas das solicitações de cursos/eventos
 * - emAnalise: quantas estão aguardando decisão
 * - aprovadas: quantas foram aprovadas
 * - rejeitadas: quantas foram indeferidas
 * - tempoMedioDias: média (simulada ou calculada)
 */
exports.getMetricas = async (_req, res) => {
  try {
    // 🧮 Se quiser usar SQL real depois:
    // const stats = await db.oneOrNone(`
    //   SELECT
    //     COUNT(*) FILTER (WHERE status='em_analise') AS em_analise,
    //     COUNT(*) FILTER (WHERE status='aprovada') AS aprovadas,
    //     COUNT(*) FILTER (WHERE status='rejeitada') AS rejeitadas,
    //     ROUND(AVG(EXTRACT(DAY FROM (decisao_em - criada_em)))) AS tempo_medio_dias
    //   FROM solicitacoes;
    // `);

    // Por enquanto: retorno estático para evitar 404
    const stats = {
      emAnalise: 3,
      aprovadas: 18,
      rejeitadas: 2,
      tempoMedioDias: 7,
    };

    return res.json(stats);
  } catch (err) {
    console.error("[solicitacoes][metricas]", err);
    return res.status(500).json({ error: "Falha ao obter métricas de solicitações" });
  }
};
