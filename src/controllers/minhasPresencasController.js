// 📁 src/controllers/minhasPresencasController.js
const db = require("../db");

/**
 * Regras aplicadas (conforme decisões do projeto):
 * - Datas "só data" ficam como strings "YYYY-MM-DD" (sem new Date no frontend).
 * - Total de encontros por turma = COUNT(DISTINCT data_presenca) na tabela presencas (não usamos datas_turma).
 * - Frequência do usuário = presentes_usuario / total_encontros.
 * - Elegibilidade para avaliação = turma ENCERRADA E frequência >= 75%.
 * - Status de turma considera data+hora (data_inicio+horario_inicio; data_fim+horario_fim).
 * - Timezone para comparação: America/Sao_Paulo.
 */

function percent1(decimal) {
  if (!decimal || !isFinite(decimal)) return 0;
  return Math.round(decimal * 1000) / 10; // 1 casa decimal
}

exports.listarMinhasPresencas = async (req, res) => {
  try {
    const usuarioId = req?.usuario?.id || req?.user?.id;
    if (!usuarioId) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    // 🔎 Traz todas as turmas nas quais o usuário TEM INSCRIÇÃO,
    // mesmo que ainda não haja presenças registradas.
    const sql = `
      WITH base AS (
        SELECT
          t.id                                      AS turma_id,
          e.id                                      AS evento_id,
          e.titulo                                  AS evento_titulo,
          t.nome                                    AS turma_nome,
          t.data_inicio,
          t.data_fim,
          t.horario_inicio,
          t.horario_fim,
          -- timestamps para status, sem timezone (usaremos agora_sp também sem tz)
          (t.data_inicio || ' ' || COALESCE(t.horario_inicio, '00:00'))::timestamp AS inicio_ts,
          (t.data_fim   || ' ' || COALESCE(t.horario_fim,   '23:59'))::timestamp AS fim_ts,
          -- total de encontros da turma (datas distintas dessa turma na tabela presencas)
          COALESCE((
            SELECT COUNT(DISTINCT px.data_presenca)
            FROM presencas px
            WHERE px.turma_id = t.id
          ), 0) AS total_encontros,
          -- agregados do USUÁRIO
          COALESCE(SUM(CASE WHEN p.presente = TRUE  THEN 1 ELSE 0 END), 0) AS presentes_usuario,
          COALESCE(SUM(CASE WHEN p.presente = FALSE THEN 1 ELSE 0 END), 0) AS ausencias_usuario,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN p.data_presenca IS NOT NULL
            THEN TO_CHAR(p.data_presenca, 'YYYY-MM-DD') END), NULL)                       AS datas_registradas,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN p.presente = TRUE
            THEN TO_CHAR(p.data_presenca, 'YYYY-MM-DD') END), NULL)                       AS datas_presentes,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT CASE WHEN p.presente = FALSE
            THEN TO_CHAR(p.data_presenca, 'YYYY-MM-DD') END), NULL)                       AS datas_ausencias
        FROM inscricoes i
        JOIN turmas t   ON t.id = i.turma_id
        JOIN eventos e  ON e.id = t.evento_id
        LEFT JOIN presencas p
               ON p.usuario_id = i.usuario_id
              AND p.turma_id   = t.id
        WHERE i.usuario_id = $1
        GROUP BY
          t.id, e.id, e.titulo, t.nome, t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim
      )
      SELECT
        b.*,
        -- "agora" no fuso São Paulo para comparação coerente
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::timestamp AS agora_sp
      FROM base b
      ORDER BY b.data_inicio DESC, b.turma_id DESC;
    `;

    const { rows } = await db.query(sql, [usuarioId]);

    const resposta = rows.map((r) => {
      const totalEncontros = Number(r.total_encontros || 0);
      const presentesUsuario = Number(r.presentes_usuario || 0);
      const ausenciasUsuario = Number(r.ausencias_usuario || 0);

      // status por comparação de timestamps (ambos sem tz, comparados com agora_sp também sem tz)
      const inicioTs = r.inicio_ts;
      const fimTs = r.fim_ts;
      const agora = r.agora_sp;

      let status = "programado";
      if (agora >= inicioTs && agora <= fimTs) status = "andamento";
      if (agora > fimTs) status = "encerrado";

      // frequência: presentes / total_encontros
      const freqDecimal = totalEncontros > 0 ? presentesUsuario / totalEncontros : 0;
      const frequencia = percent1(freqDecimal); // em %
      const elegivelAvaliacao = status === "encerrado" && freqDecimal >= 0.75;

      // estrutura final
      return {
        evento_id: r.evento_id,
        evento_titulo: r.evento_titulo,
        turma_id: r.turma_id,
        turma_nome: r.turma_nome,
        periodo: {
          data_inicio: r.data_inicio,      // "YYYY-MM-DD"
          horario_inicio: r.horario_inicio || null, // "HH:MM"
          data_fim: r.data_fim,            // "YYYY-MM-DD"
          horario_fim: r.horario_fim || null,
        },
        status, // "programado" | "andamento" | "encerrado"
        total_encontros: totalEncontros,
        presentes: presentesUsuario,
        ausencias: ausenciasUsuario,
        frequencia, // número em %, 1 casa (ex.: 82.5)
        elegivel_avaliacao: elegivelAvaliacao,
        // datas do usuário (sempre strings "YYYY-MM-DD")
        datas: {
          registradas: r.datas_registradas || [],
          presentes: r.datas_presentes || [],
          ausencias: r.datas_ausencias || [],
        },
      };
    });

    return res.json({
      usuario_id: usuarioId,
      total_turmas: resposta.length,
      turmas: resposta,
    });
  } catch (err) {
    console.error("❌ listarMinhasPresencas erro:", err);
    return res.status(500).json({ erro: "Falha ao listar presenças do usuário." });
  }
};
