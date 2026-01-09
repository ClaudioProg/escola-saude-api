// ✅ src/controllers/minhasPresencasController.js — PREMIUM (date-only safe, SQL robusto, sem “pulos”, logs com RID)
const dbMod = require("../db");

// compat: db.query direto OU { db } (pg-promise)
const db = dbMod?.db ?? dbMod;
const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof dbMod?.query === "function"
      ? dbMod.query.bind(dbMod)
      : null;

if (typeof query !== "function") {
  // não derruba silenciosamente: esse arquivo é core
  throw new Error("DB inválido em minhasPresencasController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

function mkRid(prefix = "MP") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, ...args) {
  if (!IS_DEV) return;
  console.log(`[${rid}]`, ...args);
}
function logErr(rid, ...args) {
  console.error(`[${rid}]`, ...args);
}

/**
 * % com 1 casa decimal a partir do decimal (0..1)
 * ex.: 0.825 -> 82.5
 */
function percent1(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return 0;
  return Math.round(decimal * 1000) / 10;
}

/**
 * Normaliza HH:MM
 */
function hhmm(v, fallback = null) {
  if (!v) return fallback;
  const s = String(v).trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return fallback;
  const hh = String(Math.min(Math.max(Number(m[1]), 0), 23)).padStart(2, "0");
  const mm = String(Math.min(Math.max(Number(m[2]), 0), 59)).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Regras do projeto (mantidas):
 * - Datas "só data" como strings "YYYY-MM-DD"
 * - Total de encontros = COUNT(DISTINCT data_presenca) em presencas (sem datas_turma)
 * - Frequência = presentes_usuario / total_encontros
 * - Elegível p/ avaliação = ENCERRADA e >= 75%
 * - Status por data+hora (data_inicio+horario_inicio; data_fim+horario_fim)
 * - Comparação em America/Sao_Paulo (do lado do SQL)
 */
exports.listarMinhasPresencas = async (req, res) => {
  const rid = mkRid();
  try {
    const usuarioIdRaw = req?.usuario?.id ?? req?.user?.id;
    const usuarioId = Number(usuarioIdRaw);

    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    /**
     * ✅ SQL “premium”
     * - baseia-se em INSCRIÇÕES (sempre retorna turmas inscritas, mesmo sem presenças)
     * - total_encontros por turma = COUNT(DISTINCT data_presenca) em presencas (escopo turma)
     * - agregados do usuário por turma (presentes/ausências e arrays)
     * - status com timestamps “locais” via AT TIME ZONE (SP)
     * - datas retornam como 'YYYY-MM-DD' (to_char)
     */
    const sql = `
      WITH base AS (
        SELECT
          t.id AS turma_id,
          e.id AS evento_id,
          COALESCE(e.titulo, 'Evento') AS evento_titulo,
          COALESCE(t.nome, 'Turma')    AS turma_nome,

          -- date-only safe (strings)
          to_char(t.data_inicio::date, 'YYYY-MM-DD') AS data_inicio,
          to_char(t.data_fim::date,    'YYYY-MM-DD') AS data_fim,

          -- horários normalizados HH:MI (string); se null, fica null
          to_char(t.horario_inicio::time, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim::time,    'HH24:MI') AS horario_fim,

          -- timestamps de comparação em “hora local SP”
          (
            (
              (t.data_inicio::date)::text || ' ' ||
              COALESCE(to_char(t.horario_inicio::time,'HH24:MI'), '00:00')
            )::timestamp
          ) AS inicio_ts,

          (
            (
              (t.data_fim::date)::text || ' ' ||
              COALESCE(to_char(t.horario_fim::time,'HH24:MI'), '23:59')
            )::timestamp
          ) AS fim_ts,

          -- total encontros (datas distintas lançadas NA TURMA)
          COALESCE((
            SELECT COUNT(DISTINCT px.data_presenca::date)
              FROM presencas px
             WHERE px.turma_id = t.id
          ), 0) AS total_encontros,

          -- agregados do usuário (por turma)
          COALESCE(SUM(CASE WHEN p.presente IS TRUE  THEN 1 ELSE 0 END), 0) AS presentes_usuario,
          COALESCE(SUM(CASE WHEN p.presente IS FALSE THEN 1 ELSE 0 END), 0) AS ausencias_usuario,

          -- arrays date-only
          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.data_presenca IS NOT NULL
                THEN to_char(p.data_presenca::date, 'YYYY-MM-DD')
              END),
              NULL
            ),
            '{}'
          ) AS datas_registradas,

          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.presente IS TRUE
                THEN to_char(p.data_presenca::date, 'YYYY-MM-DD')
              END),
              NULL
            ),
            '{}'
          ) AS datas_presentes,

          COALESCE(
            ARRAY_REMOVE(
              ARRAY_AGG(DISTINCT CASE WHEN p.presente IS FALSE
                THEN to_char(p.data_presenca::date, 'YYYY-MM-DD')
              END),
              NULL
            ),
            '{}'
          ) AS datas_ausencias

        FROM inscricoes i
        JOIN turmas  t ON t.id = i.turma_id
        JOIN eventos e ON e.id = t.evento_id
        LEFT JOIN presencas p
               ON p.usuario_id = i.usuario_id
              AND p.turma_id   = t.id
        WHERE i.usuario_id = $1
        GROUP BY
          t.id, e.id, e.titulo, t.nome,
          t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim
      )
      SELECT
        b.*,
        (NOW() AT TIME ZONE '${TZ}')::timestamp AS agora_sp
      FROM base b
      ORDER BY b.data_inicio DESC, b.turma_id DESC;
    `;

    const { rows } = await query(sql, [usuarioId]);

    const turmas = (rows || []).map((r) => {
      const totalEncontros = Number(r.total_encontros || 0);
      const presentesUsuario = Number(r.presentes_usuario || 0);
      const ausenciasUsuario = Number(r.ausencias_usuario || 0);

      const inicioTs = r.inicio_ts;
      const fimTs = r.fim_ts;
      const agora = r.agora_sp;

      // ✅ status: programado | andamento | encerrado
      let status = "programado";
      if (agora >= inicioTs && agora <= fimTs) status = "andamento";
      if (agora > fimTs) status = "encerrado";

      // ✅ frequência: presentes / total_encontros
      const freqDecimal = totalEncontros > 0 ? presentesUsuario / totalEncontros : 0;
      const frequencia = percent1(freqDecimal);
      const elegivelAvaliacao = status === "encerrado" && freqDecimal >= 0.75;

      return {
        evento_id: Number(r.evento_id),
        evento_titulo: r.evento_titulo,
        turma_id: Number(r.turma_id),
        turma_nome: r.turma_nome,
        periodo: {
          data_inicio: r.data_inicio, // "YYYY-MM-DD"
          horario_inicio: hhmm(r.horario_inicio, null), // "HH:MM" | null
          data_fim: r.data_fim,
          horario_fim: hhmm(r.horario_fim, null),
        },
        status,
        total_encontros: totalEncontros,
        presentes: presentesUsuario,
        ausencias: ausenciasUsuario,
        frequencia, // número (ex.: 82.5)
        elegivel_avaliacao: elegivelAvaliacao,
        datas: {
          registradas: Array.isArray(r.datas_registradas) ? r.datas_registradas : [],
          presentes: Array.isArray(r.datas_presentes) ? r.datas_presentes : [],
          ausencias: Array.isArray(r.datas_ausencias) ? r.datas_ausencias : [],
        },
      };
    });

    log(rid, "OK", { usuarioId, total: turmas.length });

    return res.json({
      usuario_id: usuarioId,
      total_turmas: turmas.length,
      turmas,
    });
  } catch (err) {
    logErr(rid, "❌ listarMinhasPresencas erro:", {
      message: err?.message,
      detail: err?.detail,
      code: err?.code,
      stack: IS_DEV ? err?.stack : undefined,
    });
    return res.status(500).json({ erro: "Falha ao listar presenças do usuário." });
  }
};
