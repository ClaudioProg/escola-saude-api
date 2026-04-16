/* eslint-disable no-console */
// ✅ src/controllers/debugPosCursoController.js — PREMIUM+++
// - Compat DB robusta
// - Logs com RID
// - Usa inscricoes como tabela oficial (fallback seguro para compat)
// - Fallback avaliacoes/avaliacao
// - Regras de pós-curso consistentes:
//   inscrito + turma encerrada + frequência >= 75% + avaliação/certificado
// - Date-only safe
// - Resposta administrativa detalhada
"use strict";

const dbMod = require("../db");
const dbFallback = dbMod?.db ?? dbMod;

const TZ = "America/Sao_Paulo";
const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Compat DB
=========================================================================== */
function getDb(req) {
  return req?.db ?? dbFallback;
}

async function runQuery(db, sql, params = []) {
  if (typeof db?.query === "function") return db.query(sql, params);
  throw new Error("DB inválido: query ausente.");
}

async function queryFirstWorking(db, variants, params = []) {
  let lastErr = null;

  for (const sql of variants) {
    try {
      return await runQuery(db, sql, params);
    } catch (e) {
      lastErr = e;
      if (["42P01", "42703"].includes(e?.code)) continue;
      throw e;
    }
  }

  throw lastErr || new Error("Nenhuma variante SQL funcionou.");
}

async function resolveInscricaoTable(db) {
  try {
    await runQuery(db, `SELECT 1 FROM inscricoes LIMIT 1`);
    return "inscricoes";
  } catch {
    return "inscricao";
  }
}

async function resolveAvaliacaoTable(db) {
  try {
    await runQuery(db, `SELECT 1 FROM avaliacoes LIMIT 1`);
    return "avaliacoes";
  } catch {
    return "avaliacao";
  }
}

/* =========================================================================
   Logger premium
=========================================================================== */
function mkRid(prefix = "DBGPOS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "DBGPOS") {
  return req?.requestId || req?.rid || mkRid(prefix);
}

function _log(rid, level, msg, extra) {
  const prefix = `[${rid}]`;

  if (level === "error") {
    return console.error(
      `${prefix} ✖ ${msg}`,
      extra?.stack || extra?.message || extra
    );
  }

  if (level === "warn") {
    return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  }

  if (IS_DEV) {
    return console.log(`${prefix} • ${msg}`, extra || "");
  }

  return undefined;
}

const logInfo = (rid, msg, extra) => _log(rid, "info", msg, extra);
const logWarn = (rid, msg, extra) => _log(rid, "warn", msg, extra);
const logErr = (rid, msg, err) => _log(rid, "error", msg, err);

/* =========================================================================
   Helpers
=========================================================================== */
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
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

function buildMotivoBloqueio(row) {
  if (!row.inscrito) return "Usuário não inscrito.";
  if (!row.turma_encerrada) return "Turma ainda não encerrada.";
  if (!row.atingiu_75) return "Frequência inferior a 75%.";
  if (!row.avaliou) return "Avaliação pendente.";
  if (row.certificado_gerado) return "Certificado já gerado.";
  return "";
}

/* =========================================================================
   Controller
=========================================================================== */
async function debugPosCursoPorUsuario(req, res) {
  const rid = reqRid(req);
  const db = getDb(req);

  const usuarioLogadoId = toIntId(getUserId(req));
  const perfis = getPerfis(req.user || req.usuario || {});
  const usuario_id = toIntId(req.params.usuario_id);

  if (!usuarioLogadoId) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  if (!perfis.includes("administrador")) {
    return res.status(403).json({ erro: "Acesso restrito a administradores." });
  }

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  try {
    const inscrTable = await resolveInscricaoTable(db);
    const avaliacaoTable = await resolveAvaliacaoTable(db);

    logInfo(rid, "debugPosCursoPorUsuario:start", {
      usuarioLogadoId,
      usuario_id,
      inscrTable,
      avaliacaoTable,
    });

    const sql = `
      WITH inscricoes_usuario AS (
        SELECT
          i.usuario_id,
          i.turma_id
        FROM ${inscrTable} i
        WHERE i.usuario_id = $1
      ),
      presencas_usuario AS (
        SELECT
          p.usuario_id,
          p.turma_id,
          COUNT(DISTINCT p.data_presenca::date) FILTER (WHERE p.presente = TRUE)::int AS presencas
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.usuario_id, p.turma_id
      ),
      avaliacoes_usuario AS (
        SELECT
          a.usuario_id,
          a.turma_id,
          COUNT(*)::int AS total_avaliacoes
        FROM ${avaliacaoTable} a
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
              SELECT 1
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
            ) THEN (
              SELECT COUNT(*)::int
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
            )
            WHEN t.data_inicio IS NOT NULL AND t.data_fim IS NOT NULL
              THEN GREATEST(1, ((t.data_fim::date - t.data_inicio::date) + 1))::int
            ELSE 0
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
        TRUE AS inscrito,
        COALESCE(pu.presencas, 0) AS presencas,
        b.total_aulas,
        CASE
          WHEN b.total_aulas > 0
            THEN ROUND((COALESCE(pu.presencas, 0)::numeric / b.total_aulas::numeric) * 100, 2)
          ELSE 0
        END AS percentual_presenca,
        CASE
          WHEN b.total_aulas > 0
            THEN (COALESCE(pu.presencas, 0)::numeric / b.total_aulas::numeric) >= 0.75
          ELSE FALSE
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
            ((b.data_fim)::date + COALESCE(b.horario_fim::time, '23:59'::time))
          )
        ) AS turma_encerrada,
        COALESCE(au.total_avaliacoes, 0) > 0 AS avaliou,
        (COALESCE(cu.certificado_id, NULL) IS NOT NULL) AS certificado_gerado,
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
      ORDER BY b.data_fim DESC, b.turma_id DESC
    `;

    const result = await runQuery(db, sql, [usuario_id]);

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

      return {
        ...row,
        tipo_vinculo: "usuario",
        pode_avaliar,
        pode_gerar_certificado,
        motivo_bloqueio: buildMotivoBloqueio(row),
      };
    });

    logInfo(rid, "debugPosCursoPorUsuario:ok", {
      usuario_id,
      total: saida.length,
      itens: saida.map((x) => ({
        turma_id: x.turma_id,
        evento_id: x.evento_id,
        percentual_presenca: x.percentual_presenca,
        turma_encerrada: x.turma_encerrada,
        avaliou: x.avaliou,
        certificado_gerado: x.certificado_gerado,
        pode_avaliar: x.pode_avaliar,
        pode_gerar_certificado: x.pode_gerar_certificado,
      })),
    });

    return res.status(200).json(saida);
  } catch (err) {
    logErr(rid, "debugPosCursoPorUsuario erro", err);
    return res.status(500).json({
      erro: "Erro ao gerar diagnóstico de pós-curso.",
      detalhe: IS_DEV ? err?.message : undefined,
    });
  }
}

module.exports = {
  debugPosCursoPorUsuario,
};