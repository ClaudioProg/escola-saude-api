/* eslint-disable no-console */
"use strict";

const dbMod = require("../db");
const db = dbMod?.db ?? dbMod;

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

function getDb(req) {
  return req?.db ?? db;
}

function getUserId(req) {
  return (
    req?.user?.id ??
    req?.usuario?.id ??
    req?.user?.usuario_id ??
    req?.usuario?.usuario_id ??
    null
  );
}

function getPerfis(user) {
  const raw = user?.perfis ?? user?.perfil ?? "";
  if (Array.isArray(raw)) {
    return raw.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

async function debugPosCursoPorUsuario(req, res) {
  const dbConn = getDb(req);
  const usuarioLogadoId = Number(getUserId(req));
  const perfis = getPerfis(req.user || req.usuario || {});
  const usuario_id = Number(req.params.usuario_id);

  if (!usuarioLogadoId) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  if (!perfis.includes("administrador")) {
    return res.status(403).json({ erro: "Acesso restrito a administradores." });
  }

  if (!Number.isFinite(usuario_id) || usuario_id <= 0) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  try {
    const sql = `
      WITH inscricoes_usuario AS (
        SELECT
          i.usuario_id,
          i.turma_id
        FROM inscricoes i
        WHERE i.usuario_id = $1
      ),
      presencas_usuario AS (
        SELECT
          p.usuario_id,
          p.turma_id,
          COUNT(DISTINCT p.data_presenca::date) FILTER (WHERE p.presente = true)::int AS presencas
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.usuario_id, p.turma_id
      ),
      avaliacoes_usuario AS (
        SELECT
          a.usuario_id,
          a.turma_id,
          COUNT(*)::int AS total_avaliacoes
        FROM avaliacoes a
        WHERE a.usuario_id = $1
        GROUP BY a.usuario_id, a.turma_id
      ),
      certificados_usuario AS (
        SELECT
          c.usuario_id,
          c.turma_id,
          c.evento_id,
          c.tipo,
          c.id AS certificado_id,
          c.arquivo_pdf
        FROM certificados c
        WHERE c.usuario_id = $1
      ),
      base AS (
        SELECT
          u.id AS usuario_id,
          u.nome,
          t.id AS turma_id,
          e.id AS evento_id,
          e.titulo AS evento,
          t.nome AS turma,
          e.tipo AS tipo_evento,
          to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date, 'YYYY-MM-DD') AS data_fim,
          t.horario_inicio,
          t.horario_fim,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM datas_turma dt WHERE dt.turma_id = t.id
            ) THEN (
              SELECT COUNT(*)::int FROM datas_turma dt WHERE dt.turma_id = t.id
            )
            ELSE GREATEST(1, ((t.data_fim::date - t.data_inicio::date) + 1))::int
          END AS total_aulas
        FROM usuarios u
        JOIN inscricoes_usuario iu ON iu.usuario_id = u.id
        JOIN turmas t ON t.id = iu.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE u.id = $1
      )
      SELECT
        b.usuario_id,
        b.nome,
        b.turma_id,
        b.evento_id,
        b.evento,
        b.turma,
        b.tipo_evento,
        b.data_inicio,
        b.data_fim,
        b.horario_inicio,
        b.horario_fim,
        true AS inscrito,
        COALESCE(pu.presencas, 0) AS presencas,
        b.total_aulas,
        CASE
          WHEN b.total_aulas > 0
            THEN ROUND((COALESCE(pu.presencas, 0)::numeric / b.total_aulas::numeric) * 100, 2)
          ELSE 0
        END AS percentual_presenca,
        CASE
          WHEN b.total_aulas > 0
            THEN COALESCE(pu.presencas, 0)::numeric / b.total_aulas::numeric >= 0.75
          ELSE false
        END AS atingiu_75,
        (
          (NOW() AT TIME ZONE '${TZ}') >=
          COALESCE(
            (
              SELECT
                (dt.data::date + COALESCE(dt.horario_fim::time, b.horario_fim::time, '23:59'::time))
              FROM datas_turma dt
              WHERE dt.turma_id = b.turma_id
              ORDER BY dt.data DESC, COALESCE(dt.horario_fim, b.horario_fim) DESC
              LIMIT 1
            ),
            (b.data_fim::date + COALESCE(b.horario_fim::time, '23:59'::time))
          )
        ) AS turma_encerrada,
        COALESCE(au.total_avaliacoes, 0) > 0 AS avaliou,
        COALESCE(cu.certificado_id, NULL) IS NOT NULL AS certificado_gerado,
        cu.certificado_id,
        cu.arquivo_pdf
      FROM base b
      LEFT JOIN presencas_usuario pu
        ON pu.usuario_id = b.usuario_id
       AND pu.turma_id = b.turma_id
      LEFT JOIN avaliacoes_usuario au
        ON au.usuario_id = b.usuario_id
       AND au.turma_id = b.turma_id
      LEFT JOIN certificados_usuario cu
        ON cu.usuario_id = b.usuario_id
       AND cu.turma_id = b.turma_id
       AND cu.tipo = 'usuario'
      ORDER BY b.data_fim DESC, b.turma_id DESC;
    `;

    const result = await dbConn.query(sql, [usuario_id]);

    const saida = (result.rows || []).map((row) => {
      const pode_avaliar =
        row.inscrito === true &&
        row.turma_encerrada === true &&
        row.atingiu_75 === true &&
        row.avaliou === false;

      const pode_gerar_certificado =
        row.inscrito === true &&
        row.turma_encerrada === true &&
        row.atingiu_75 === true &&
        row.avaliou === true &&
        row.certificado_gerado === false;

      let motivo_bloqueio = "";

      if (!row.inscrito) {
        motivo_bloqueio = "Usuário não inscrito.";
      } else if (!row.turma_encerrada) {
        motivo_bloqueio = "Turma ainda não encerrada.";
      } else if (!row.atingiu_75) {
        motivo_bloqueio = "Frequência inferior a 75%.";
      } else if (!row.avaliou) {
        motivo_bloqueio = "Avaliação pendente.";
      } else if (row.certificado_gerado) {
        motivo_bloqueio = "Certificado já gerado.";
      }

      return {
        ...row,
        tipo_vinculo: "usuario",
        pode_avaliar,
        pode_gerar_certificado,
        motivo_bloqueio,
      };
    });

    if (IS_DEV) {
      console.log("[debug-pos-curso] diagnóstico gerado", {
        usuario_id,
        total: saida.length,
      });
    }

    return res.status(200).json(saida);
  } catch (err) {
    console.error("[debug-pos-curso] erro:", {
      usuario_id,
      msg: err?.message,
      stack: IS_DEV ? err?.stack : undefined,
    });
    return res.status(500).json({ erro: "Erro ao gerar diagnóstico de pós-curso." });
  }
}

module.exports = {
  debugPosCursoPorUsuario,
};