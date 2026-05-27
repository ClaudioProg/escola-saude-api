/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/inscricaoController.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo de inscrição.
 *
 * Contratos aplicados:
 * - Tabela oficial: inscricoes
 * - Sem tabela inscricao
 * - Sem resolveInscricaoTable
 * - Sem aliases de params: turmaId, usuarioId, inscricaoId
 * - Params oficiais:
 *   - inscricao_id
 *   - turma_id
 *   - usuario_id
 * - Body oficial:
 *   - turma_id
 * - Usuário autenticado oficial:
 *   - req.user.id
 *   - req.user.perfil
 * - Vínculo oficial de organizador:
 *   - turma_responsavel.usuario_id
 *   - turma_responsavel.turma_id
 *   - turma_responsavel.papel = 'organizador'
 * - Sem req.usuario
 * - Sem req.userId/auth.userId
 * - Sem perfil/perfis/roles/admin como múltiplas fontes
 * - Sem organizador_id em turma_responsavel
 * - Envelope oficial:
 *   - { ok, data, message }
 *   - { ok:false, message, details? }
 * - Date-only seguro em SQL via date/time nativos
 * - Transação com lock na turma ao inscrever
 * - Conflito de horário por SQL, sem função externa obrigatória
 * - Notificação/e-mail best-effort, sem bloquear inscrição se falhar
 *
 * Observação:
 * - Este controller assume como oficiais as tabelas:
 *   - inscricoes
 *   - turmas
 *   - eventos
 *   - datas_turma
 *   - presencas
 *   - usuarios
 *   - turma_responsavel
 */

const db = require("../db");
const { send: enviarEmail } = require("../services/mailer");
const { criarNotificacao } = require("./notificacaoController");
const {
  podeAcessarEvento,
} = require("../services/eventoAcessoRegistroService");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ─────────────────────────────────────────────────────────────
 * DB oficial
 * ───────────────────────────────────────────────────────────── */

if (!db || typeof db.query !== "function") {
  console.error("[inscricaoController] db.query inválido:", db);
  throw new Error("db.query deve existir em backend/src/db.js.");
}

const query = db.query.bind(db);
const pool = db.pool || null;

/* ─────────────────────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────────────────────── */

const TZ = "America/Sao_Paulo";
const PAPEL_ORGANIZADOR = "organizador";

/* ─────────────────────────────────────────────────────────────
 * Logger
 * ───────────────────────────────────────────────────────────── */

function mkRid(prefix = "INS") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function logDev(rid, message, extra) {
  if (IS_DEV) {
    console.log(`[${rid}] ${message}`, extra || "");
  }
}

function logWarn(rid, message, extra) {
  console.warn(`[${rid}] ${message}`, extra || "");
}

function logError(rid, message, error) {
  console.error(
    `[${rid}] ${message}`,
    error?.stack || error?.message || error || ""
  );
}

/* ─────────────────────────────────────────────────────────────
 * Envelope oficial
 * ───────────────────────────────────────────────────────────── */

function ok(res, data = null, message = "Operação realizada com sucesso.", status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    message,
  });
}

function fail(res, status, message, details = undefined) {
  const payload = {
    ok: false,
    message,
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return res.status(status).json(payload);
}

/* ─────────────────────────────────────────────────────────────
 * Transação
 * ───────────────────────────────────────────────────────────── */

async function safeRollback(q) {
  try {
    await q("ROLLBACK");
  } catch {
    // rollback não deve ocultar erro original
  }
}

async function withTransaction(fn) {
  if (!pool || typeof pool.connect !== "function") {
    await query("BEGIN");

    try {
      const result = await fn(query);
      await query("COMMIT");
      return result;
    } catch (error) {
      await safeRollback(query);
      throw error;
    }
  }

  const client = await pool.connect();

  try {
    const q = client.query.bind(client);

    await q("BEGIN");

    const result = await fn(q);

    await q("COMMIT");

    return result;
  } catch (error) {
    await safeRollback(client.query.bind(client));
    throw error;
  } finally {
    client.release();
  }
}

/* ─────────────────────────────────────────────────────────────
 * Helpers gerais
 * ───────────────────────────────────────────────────────────── */

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function getUserId(req) {
  return toPositiveInt(req?.user?.id);
}

function getUserPerfil(req) {
  return normalizeText(req?.user?.perfil).toLowerCase();
}

function isAdministrador(req) {
  return getUserPerfil(req) === "administrador";
}

function formatarDataBR(dateOnly) {
  const value = normalizeText(dateOnly).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function safeHHMM(value) {
  const raw = normalizeText(value);

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cpfProtegido(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) {
    return value ? String(value) : null;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.***-**`;
}

function motivoHttpConflito(error) {
  if (error?.code === "23505") {
    return {
      status: 409,
      message: "Usuário já inscrito nesta turma.",
    };
  }

  if (error?.code === "P0001") {
    return {
      status: 409,
      message: error?.message || "Inscrição bloqueada por regra do banco.",
    };
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
 * Helpers de turma/evento
 * ───────────────────────────────────────────────────────────── */

async function carregarTurmaCompleta(q, turmaId, { forUpdate = false } = {}) {
  const result = await q(
    `
    SELECT
      t.*,
      e.id AS evento_id,
      e.titulo AS evento_titulo,
      e.local AS evento_local,
      e.publico_alvo AS evento_publico_alvo,
      e.publicado AS evento_publicado,
      e.restrito AS evento_restrito,
      e.restrito_modo AS evento_restrito_modo,
      e.tipo::text AS evento_tipo,
      CASE WHEN e.tipo::text ILIKE 'congresso' THEN TRUE ELSE FALSE END AS evento_is_congresso
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    ${forUpdate ? "FOR UPDATE OF t" : ""}
    LIMIT 1
    `,
    [turmaId]
  );

  return result.rows?.[0] || null;
}

async function getResumoTurma(q, turmaId) {
  const result = await q(
    `
    SELECT
      t.id,

      COALESCE(
        (
          SELECT to_char(MIN(dt.data)::date, 'YYYY-MM-DD')
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ),
        to_char(t.data_inicio::date, 'YYYY-MM-DD')
      ) AS data_inicio,

      COALESCE(
        (
          SELECT to_char(MAX(dt.data)::date, 'YYYY-MM-DD')
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ),
        to_char(t.data_fim::date, 'YYYY-MM-DD')
      ) AS data_fim,

      COALESCE(
        (
          SELECT to_char(z.horario_inicio, 'HH24:MI')
          FROM (
            SELECT
              dt.horario_inicio,
              COUNT(*) AS total
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_inicio
            ORDER BY COUNT(*) DESC, dt.horario_inicio ASC
            LIMIT 1
          ) z
        ),
        to_char(t.horario_inicio::time, 'HH24:MI')
      ) AS horario_inicio,

      COALESCE(
        (
          SELECT to_char(z.horario_fim, 'HH24:MI')
          FROM (
            SELECT
              dt.horario_fim,
              COUNT(*) AS total
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_fim
            ORDER BY COUNT(*) DESC, dt.horario_fim ASC
            LIMIT 1
          ) z
        ),
        to_char(t.horario_fim::time, 'HH24:MI')
      ) AS horario_fim

    FROM turmas t
    WHERE t.id = $1
    LIMIT 1
    `,
    [turmaId]
  );

  return result.rows?.[0] || null;
}

async function totalDatasTurma(q, turmaId) {
  const result = await q(
    `
    WITH datas AS (
      SELECT COUNT(*)::int AS total
      FROM datas_turma
      WHERE turma_id = $1
    ),
    fallback AS (
      SELECT
        CASE
          WHEN data_inicio IS NOT NULL AND data_fim IS NOT NULL THEN 1
          ELSE 0
        END::int AS total
      FROM turmas
      WHERE id = $1
      LIMIT 1
    )
    SELECT
      CASE
        WHEN (SELECT total FROM datas) > 0 THEN (SELECT total FROM datas)
        ELSE COALESCE((SELECT total FROM fallback), 0)
      END AS total
    `,
    [turmaId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function usuarioEhOrganizadorDaTurma(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT 1
    FROM turma_responsavel tr
    WHERE tr.turma_id = $1
      AND tr.usuario_id = $2
      AND tr.papel = $3
    LIMIT 1
    `,
    [turmaId, usuarioId, PAPEL_ORGANIZADOR]
  );

  return result.rowCount > 0;
}

async function usuarioJaInscritoNaTurma(q, usuarioId, turmaId) {
  const result = await q(
    `
    SELECT id
    FROM inscricoes
    WHERE usuario_id = $1
      AND turma_id = $2
    LIMIT 1
    `,
    [usuarioId, turmaId]
  );

  return result.rows?.[0] || null;
}

async function usuarioJaInscritoNoEvento(q, usuarioId, eventoId) {
  const result = await q(
    `
    SELECT i.id
    FROM inscricoes i
    JOIN turmas t ON t.id = i.turma_id
    WHERE i.usuario_id = $1
      AND t.evento_id = $2
    LIMIT 1
    `,
    [usuarioId, eventoId]
  );

  return result.rows?.[0] || null;
}

async function contarInscritosDaTurma(q, turmaId) {
  const result = await q(
    `
    SELECT COUNT(*)::int AS total
    FROM inscricoes
    WHERE turma_id = $1
    `,
    [turmaId]
  );

  return Number(result.rows?.[0]?.total || 0);
}

async function checarAcessoEvento(usuarioId, eventoId) {
  const acesso = await podeAcessarEvento({
  usuarioId,
  eventoId,
  exigirPublicado: true,
  permitirAdministrador: true,
});

  return {
    ok: acesso?.ok === true,
    motivo: acesso?.motivo || null,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Conflito de horário
 * ───────────────────────────────────────────────────────────── */

async function conflitoHorario(q, usuarioId, turmaId, { somenteMesmoEvento = false } = {}) {
  const result = await q(
    `
    WITH turma_alvo AS (
      SELECT
        t.id,
        t.evento_id,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        EXISTS (
          SELECT 1
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ) AS tem_datas
      FROM turmas t
      WHERE t.id = $2
      LIMIT 1
    ),

    alvo_slots AS (
      SELECT
        tsrange(
          (dt.data::date + dt.horario_inicio::time)::timestamp,
          (dt.data::date + dt.horario_fim::time)::timestamp,
          '[)'
        ) AS periodo
      FROM datas_turma dt
      JOIN turma_alvo ta ON ta.id = dt.turma_id

      UNION ALL

      SELECT
        CASE
          WHEN ta.tem_datas = FALSE
           AND ta.data_inicio IS NOT NULL
           AND ta.data_fim IS NOT NULL
           AND ta.data_inicio = ta.data_fim
           AND ta.horario_inicio IS NOT NULL
           AND ta.horario_fim IS NOT NULL
          THEN tsrange(
            (ta.data_inicio::date + ta.horario_inicio::time)::timestamp,
            (ta.data_fim::date + ta.horario_fim::time)::timestamp,
            '[)'
          )
          ELSE NULL
        END AS periodo
      FROM turma_alvo ta
    ),

    outras_turmas AS (
      SELECT
        t.id,
        t.evento_id,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim,
        EXISTS (
          SELECT 1
          FROM datas_turma dt
          WHERE dt.turma_id = t.id
        ) AS tem_datas
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN turma_alvo ta ON TRUE
      WHERE i.usuario_id = $1
        AND i.turma_id <> $2
        AND (
          $3::boolean = FALSE
          OR t.evento_id = ta.evento_id
        )
    ),

    outras_slots AS (
      SELECT
        tsrange(
          (dt.data::date + dt.horario_inicio::time)::timestamp,
          (dt.data::date + dt.horario_fim::time)::timestamp,
          '[)'
        ) AS periodo
      FROM datas_turma dt
      JOIN outras_turmas ot ON ot.id = dt.turma_id

      UNION ALL

      SELECT
        CASE
          WHEN ot.tem_datas = FALSE
           AND ot.data_inicio IS NOT NULL
           AND ot.data_fim IS NOT NULL
           AND ot.data_inicio = ot.data_fim
           AND ot.horario_inicio IS NOT NULL
           AND ot.horario_fim IS NOT NULL
          THEN tsrange(
            (ot.data_inicio::date + ot.horario_inicio::time)::timestamp,
            (ot.data_fim::date + ot.horario_fim::time)::timestamp,
            '[)'
          )
          ELSE NULL
        END AS periodo
      FROM outras_turmas ot
    )

    SELECT EXISTS (
      SELECT 1
      FROM alvo_slots a
      JOIN outras_slots o ON a.periodo && o.periodo
      WHERE a.periodo IS NOT NULL
        AND o.periodo IS NOT NULL
    ) AS conflito
    `,
    [usuarioId, turmaId, Boolean(somenteMesmoEvento)]
  );

  return result.rows?.[0]?.conflito === true;
}

/* ─────────────────────────────────────────────────────────────
 * Notificação e e-mail best-effort
 * ───────────────────────────────────────────────────────────── */

async function notificarInscricaoConfirmada({
  rid,
  usuarioId,
  turmaId,
  inscricao,
  turma,
  resumo,
}) {
  try {
    const result = await query(
      `
      SELECT
        nome,
        email
      FROM usuarios
      WHERE id = $1
      LIMIT 1
      `,
      [usuarioId]
    );

    const usuario = result.rows?.[0] || null;

    const dataInicio = formatarDataBR(resumo?.data_inicio);
    const dataFim = formatarDataBR(resumo?.data_fim);
    const horarioInicio = safeHHMM(resumo?.horario_inicio);
    const horarioFim = safeHHMM(resumo?.horario_fim);

    const periodo =
      dataInicio && dataFim
        ? dataInicio === dataFim
          ? dataInicio
          : `${dataInicio} a ${dataFim}`
        : dataInicio || dataFim || "A definir";

    const horario =
      horarioInicio && horarioFim ? `${horarioInicio} às ${horarioFim}` : "A definir";

    const eventoTitulo = turma.evento_titulo || "Evento";
    const turmaNome = turma.nome || "Turma";
    const local = turma.evento_local || "A definir";
    const carga = turma.carga_horaria ?? "—";

    const mensagem = [
      `✅ Sua inscrição foi confirmada com sucesso no evento "${eventoTitulo}".`,
      "",
      `- Turma: ${turmaNome}`,
      `- Período: ${periodo}`,
      `- Horário: ${horario}`,
      `- Carga horária: ${carga} horas`,
      `- Local: ${local}`,
    ].join("\n");

    try {
      await criarNotificacao(usuarioId, mensagem, {
        tipo: "inscricao",
        titulo: `Inscrição confirmada: ${eventoTitulo}`,
        turma_id: turmaId,
        evento_id: turma.evento_id,
        inscricao_id: inscricao.id,
      });
    } catch (error) {
      logWarn(rid, "Falha ao criar notificação de inscrição.", {
        message: error?.message || String(error),
      });
    }

    if (!usuario?.email) {
      logWarn(rid, "Usuário sem e-mail para confirmação de inscrição.", {
        usuario_id: usuarioId,
      });
      return;
    }

    const nomeUser = usuario.nome || "participante";

    const html = `
      <h2>Olá, ${escapeHtml(nomeUser)}!</h2>
      <p>Sua inscrição foi confirmada com sucesso.</p>

      <h3>Detalhes da inscrição</h3>
      <p>
        <strong>Evento:</strong> ${escapeHtml(eventoTitulo)}<br/>
        <strong>Turma:</strong> ${escapeHtml(turmaNome)}<br/>
        <strong>Período:</strong> ${escapeHtml(periodo)}<br/>
        <strong>Horário:</strong> ${escapeHtml(horario)}<br/>
        <strong>Carga horária:</strong> ${escapeHtml(carga)} horas<br/>
        <strong>Local:</strong> ${escapeHtml(local)}
      </p>

      <p>Em caso de dúvidas, entre em contato com a equipe da Escola da Saúde.</p>
      <p>Atenciosamente,<br/><strong>Equipe da Escola da Saúde</strong></p>
    `;

    const text = `Olá, ${nomeUser}!

Sua inscrição foi confirmada com sucesso.

Evento: ${eventoTitulo}
Turma: ${turmaNome}
Período: ${periodo}
Horário: ${horario}
Carga horária: ${carga} horas
Local: ${local}

Atenciosamente,
Equipe da Escola da Saúde`;

    await enviarEmail({
      to: usuario.email,
      subject: "Inscrição Confirmada – Escola da Saúde",
      text,
      html,
    });
  } catch (error) {
    logWarn(rid, "Falha no pós-processamento da inscrição.", {
      message: error?.message || String(error),
    });
  }
}

/* ─────────────────────────────────────────────────────────────
 * POST /api/inscricao
 * ───────────────────────────────────────────────────────────── */

async function inscreverEmTurma(req, res) {
  const rid = mkRid();
  const usuarioId = getUserId(req);
  const turmaId = toPositiveInt(req.body?.turma_id || req.params?.turma_id);

  if (!usuarioId) {
    return fail(res, 401, "Não autenticado.");
  }

  if (!turmaId) {
    return fail(res, 400, "turma_id é obrigatório.");
  }

  logDev(rid, "inscreverEmTurma:start", {
    usuario_id: usuarioId,
    turma_id: turmaId,
  });

  try {
    const resultado = await withTransaction(async (q) => {
      const turma = await carregarTurmaCompleta(q, turmaId, { forUpdate: true });

      if (!turma) {
        return {
          status: 404,
          error: true,
          message: "Turma não encontrada.",
        };
      }

      if (turma.evento_publicado !== true) {
        return {
          status: 403,
          error: true,
          message: "Evento ainda não publicado.",
          details: {
            motivo: "EVENTO_NAO_PUBLICADO",
          },
        };
      }

      const acesso = await checarAcessoEvento(usuarioId, turma.evento_id);

      if (!acesso.ok) {
        return {
          status: 403,
          error: true,
          message: "Você não possui permissão para se inscrever neste evento.",
          details: {
            motivo: acesso.motivo || "SEM_PERMISSAO",
          },
        };
      }

      const ehOrganizador = await usuarioEhOrganizadorDaTurma(
        q,
        usuarioId,
        turmaId
      );

      if (ehOrganizador) {
        return {
          status: 409,
          error: true,
          message:
            "Você é organizador desta turma e não pode se inscrever como participante.",
          details: {
            motivo: "ORGANIZADOR_DA_TURMA",
          },
        };
      }

      const duplicada = await usuarioJaInscritoNaTurma(q, usuarioId, turmaId);

      if (duplicada) {
        return {
          status: 409,
          error: true,
          message: "Usuário já inscrito nesta turma.",
          details: {
            inscricao_id: duplicada.id,
          },
        };
      }

      if (!turma.evento_is_congresso) {
        const jaNoEvento = await usuarioJaInscritoNoEvento(
          q,
          usuarioId,
          turma.evento_id
        );

        if (jaNoEvento) {
          return {
            status: 409,
            error: true,
            message: "Você já está inscrito em uma turma deste evento.",
            details: {
              inscricao_id: jaNoEvento.id,
            },
          };
        }
      }

      const conflitoMesmoEvento = await conflitoHorario(q, usuarioId, turmaId, {
        somenteMesmoEvento: true,
      });

      if (turma.evento_is_congresso && conflitoMesmoEvento) {
        return {
          status: 409,
          error: true,
          message:
            "Conflito de horário dentro deste evento com outra turma já inscrita.",
          details: {
            motivo: "CONFLITO_MESMO_EVENTO",
          },
        };
      }

      const conflitoGlobal = await conflitoHorario(q, usuarioId, turmaId, {
        somenteMesmoEvento: false,
      });

      if (conflitoGlobal) {
        return {
          status: 409,
          error: true,
          message:
            "Conflito de horário com outra turma já inscrita em seu histórico.",
          details: {
            motivo: "CONFLITO_GLOBAL",
          },
        };
      }

      const totalInscritos = await contarInscritosDaTurma(q, turmaId);
      const totalVagas = Number(turma.vagas_total);

      if (!Number.isInteger(totalVagas) || totalVagas <= 0) {
        return {
          status: 500,
          error: true,
          message: "Número de vagas inválido para a turma.",
        };
      }

      if (totalInscritos >= totalVagas) {
        return {
          status: 409,
          error: true,
          message: "Turma lotada. Vagas esgotadas.",
          details: {
            vagas_total: totalVagas,
            vagas_preenchidas: totalInscritos,
          },
        };
      }

      const insert = await q(
        `
        INSERT INTO inscricoes (
          usuario_id,
          turma_id,
          data_inscricao
        )
        VALUES ($1, $2, NOW())
        RETURNING *
        `,
        [usuarioId, turmaId]
      );

      const inscricao = insert.rows[0];
      const resumo = await getResumoTurma(q, turmaId);

      return {
        status: 201,
        data: {
          inscricao,
          turma,
          resumo,
        },
        message: "Inscrição realizada com sucesso.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    const { inscricao, turma, resumo } = resultado.data;

    notificarInscricaoConfirmada({
      rid,
      usuarioId,
      turmaId,
      inscricao,
      turma,
      resumo,
    });

    logDev(rid, "inscreverEmTurma:ok", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      inscricao_id: inscricao.id,
    });

    return ok(
      res,
      {
        inscricao_id: inscricao.id,
        usuario_id: inscricao.usuario_id,
        turma_id: inscricao.turma_id,
        data_inscricao: inscricao.data_inscricao,
      },
      resultado.message,
      201
    );
  } catch (error) {
    const conhecido = motivoHttpConflito(error);

    if (conhecido) {
      return fail(res, conhecido.status, conhecido.message);
    }

    logError(rid, "Erro ao processar inscrição.", error);
    return fail(res, 500, "Erro ao processar inscrição.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * DELETE /api/inscricao/:inscricao_id
 * ───────────────────────────────────────────────────────────── */

async function cancelarInscricaoPorId(req, res) {
  const rid = mkRid();
  const usuarioAutenticadoId = getUserId(req);
  const inscricaoId = toPositiveInt(req.params?.inscricao_id);

  if (!usuarioAutenticadoId) {
    return fail(res, 401, "Não autenticado.");
  }

  if (!inscricaoId) {
    return fail(res, 400, "inscricao_id inválido.");
  }

  try {
    const resultado = await withTransaction(async (q) => {
      const existente = await q(
        `
        SELECT
          id,
          usuario_id,
          turma_id
        FROM inscricoes
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
        `,
        [inscricaoId]
      );

      const inscricao = existente.rows?.[0];

      if (!inscricao) {
        return {
          status: 404,
          error: true,
          message: "Inscrição não encontrada.",
        };
      }

      if (!isAdministrador(req) && Number(inscricao.usuario_id) !== usuarioAutenticadoId) {
        return {
          status: 403,
          error: true,
          message: "Sem permissão para cancelar esta inscrição.",
        };
      }

      await q(
        `
        DELETE FROM presencas
        WHERE usuario_id = $1
          AND turma_id = $2
        `,
        [inscricao.usuario_id, inscricao.turma_id]
      );

      await q(
        `
        DELETE FROM inscricoes
        WHERE id = $1
        `,
        [inscricaoId]
      );

      return {
        status: 200,
        data: inscricao,
        message: "Inscrição cancelada com sucesso.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "cancelarInscricaoPorId:ok", {
      inscricao_id: inscricaoId,
      usuario_autenticado_id: usuarioAutenticadoId,
    });

    return ok(
      res,
      {
        inscricao_id: resultado.data.id,
        usuario_id: resultado.data.usuario_id,
        turma_id: resultado.data.turma_id,
      },
      resultado.message
    );
  } catch (error) {
    logError(rid, "Erro ao cancelar inscrição por id.", error);
    return fail(res, 500, "Erro ao cancelar inscrição.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * DELETE /api/inscricao/minha/turma/:turma_id
 * ───────────────────────────────────────────────────────────── */

async function cancelarMinhaInscricaoPorTurma(req, res) {
  const rid = mkRid();
  const usuarioId = getUserId(req);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!usuarioId) {
    return fail(res, 401, "Não autenticado.");
  }

  if (!turmaId) {
    return fail(res, 400, "turma_id inválido.");
  }

  try {
    const resultado = await withTransaction(async (q) => {
      const existente = await q(
        `
        SELECT
          id,
          usuario_id,
          turma_id
        FROM inscricoes
        WHERE usuario_id = $1
          AND turma_id = $2
        LIMIT 1
        FOR UPDATE
        `,
        [usuarioId, turmaId]
      );

      const inscricao = existente.rows?.[0];

      if (!inscricao) {
        return {
          status: 404,
          error: true,
          message: "Inscrição não encontrada para este usuário nesta turma.",
        };
      }

      await q(
        `
        DELETE FROM presencas
        WHERE usuario_id = $1
          AND turma_id = $2
        `,
        [usuarioId, turmaId]
      );

      await q(
        `
        DELETE FROM inscricoes
        WHERE id = $1
        `,
        [inscricao.id]
      );

      return {
        status: 200,
        data: inscricao,
        message: "Inscrição cancelada com sucesso.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "cancelarMinhaInscricaoPorTurma:ok", {
      usuario_id: usuarioId,
      turma_id: turmaId,
    });

    return ok(
      res,
      {
        inscricao_id: resultado.data.id,
        usuario_id: resultado.data.usuario_id,
        turma_id: resultado.data.turma_id,
      },
      resultado.message
    );
  } catch (error) {
    logError(rid, "Erro ao cancelar minha inscrição por turma.", error);
    return fail(res, 500, "Erro ao cancelar inscrição.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * DELETE /api/inscricao/turma/:turma_id/usuario/:usuario_id
 * ───────────────────────────────────────────────────────────── */

async function cancelarInscricaoDoUsuarioNaTurma(req, res) {
  const rid = mkRid();
  const usuarioId = toPositiveInt(req.params?.usuario_id);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!usuarioId) {
    return fail(res, 400, "usuario_id inválido.");
  }

  if (!turmaId) {
    return fail(res, 400, "turma_id inválido.");
  }

  try {
    const resultado = await withTransaction(async (q) => {
      const existente = await q(
        `
        SELECT
          id,
          usuario_id,
          turma_id
        FROM inscricoes
        WHERE usuario_id = $1
          AND turma_id = $2
        LIMIT 1
        FOR UPDATE
        `,
        [usuarioId, turmaId]
      );

      const inscricao = existente.rows?.[0];

      if (!inscricao) {
        return {
          status: 404,
          error: true,
          message: "Inscrição não encontrada.",
        };
      }

      await q(
        `
        DELETE FROM presencas
        WHERE usuario_id = $1
          AND turma_id = $2
        `,
        [usuarioId, turmaId]
      );

      await q(
        `
        DELETE FROM inscricoes
        WHERE id = $1
        `,
        [inscricao.id]
      );

      return {
        status: 200,
        data: inscricao,
        message: "Inscrição cancelada pelo administrador.",
      };
    });

    if (resultado.error) {
      return fail(res, resultado.status, resultado.message, resultado.details);
    }

    logDev(rid, "cancelarInscricaoDoUsuarioNaTurma:ok", {
      usuario_id: usuarioId,
      turma_id: turmaId,
    });

    return ok(
      res,
      {
        inscricao_id: resultado.data.id,
        usuario_id: resultado.data.usuario_id,
        turma_id: resultado.data.turma_id,
      },
      resultado.message
    );
  } catch (error) {
    logError(rid, "Erro ao cancelar inscrição do usuário na turma.", error);
    return fail(res, 500, "Erro ao cancelar inscrição.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/inscricao/minha
 * ───────────────────────────────────────────────────────────── */

async function listarMinhasInscricoes(req, res) {
  const rid = mkRid();
  const usuarioId = getUserId(req);

  if (!usuarioId) {
    return fail(res, 401, "Não autenticado.");
  }

  try {
    const result = await query(
      `
      SELECT
        i.id AS inscricao_id,
        i.usuario_id,
        i.turma_id,
        i.data_inscricao,

        e.id AS evento_id,
        e.titulo,
        e.local,
        e.tipo::text AS tipo,

        t.nome AS turma_nome,
        t.vagas_total,
        t.carga_horaria,

        COALESCE(
          (
            SELECT to_char(MIN(dt.data)::date, 'YYYY-MM-DD')
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
          ),
          to_char(t.data_inicio::date, 'YYYY-MM-DD')
        ) AS data_inicio,

        COALESCE(
          (
            SELECT to_char(MAX(dt.data)::date, 'YYYY-MM-DD')
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
          ),
          to_char(t.data_fim::date, 'YYYY-MM-DD')
        ) AS data_fim,

        COALESCE(
          (
            SELECT to_char(z.horario_inicio, 'HH24:MI')
            FROM (
              SELECT
                dt.horario_inicio,
                COUNT(*) AS total
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, dt.horario_inicio ASC
              LIMIT 1
            ) z
          ),
          to_char(t.horario_inicio::time, 'HH24:MI')
        ) AS horario_inicio,

        COALESCE(
          (
            SELECT to_char(z.horario_fim, 'HH24:MI')
            FROM (
              SELECT
                dt.horario_fim,
                COUNT(*) AS total
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, dt.horario_fim ASC
              LIMIT 1
            ) z
          ),
          to_char(t.horario_fim::time, 'HH24:MI')
        ) AS horario_fim,

        COALESCE(organizadores.nomes, '') AS organizadores

      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      JOIN eventos e ON e.id = t.evento_id

      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome) AS nomes
        FROM turma_responsavel tr
        JOIN usuarios u ON u.id = tr.usuario_id
        WHERE tr.turma_id = t.id
          AND tr.papel = $2
      ) organizadores ON TRUE

      WHERE i.usuario_id = $1
      ORDER BY
        COALESCE(
          (
            SELECT MAX(dt.data)
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
          ),
          t.data_fim
        ) DESC,
        t.horario_fim DESC NULLS LAST,
        i.id DESC
      `,
      [usuarioId, PAPEL_ORGANIZADOR]
    );

    logDev(rid, "listarMinhasInscricoes:ok", {
      usuario_id: usuarioId,
      total: result.rowCount,
    });

    return ok(res, result.rows || [], "Inscrições carregadas.");
  } catch (error) {
    logError(rid, "Erro ao listar minhas inscrições.", error);
    return fail(res, 500, "Erro ao buscar inscrições.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/inscricao/turma/:turma_id
 * ───────────────────────────────────────────────────────────── */

async function listarInscritosPorTurma(req, res) {
  const rid = mkRid();
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!turmaId) {
    return fail(res, 400, "turma_id inválido.");
  }

  try {
    const totalDatas = await totalDatasTurma(query, turmaId);

    const presencas = await query(
      `
      SELECT
        usuario_id,
        COUNT(DISTINCT CASE WHEN presente THEN data_presenca::date END)::int AS presentes
      FROM presencas
      WHERE turma_id = $1
      GROUP BY usuario_id
      `,
      [turmaId]
    );

    const mapaPresencas = new Map(
      (presencas.rows || []).map((row) => [
        Number(row.usuario_id),
        Number(row.presentes || 0),
      ])
    );

    const result = await query(
      `
      SELECT
        i.id AS inscricao_id,
        i.data_inscricao,

        u.id AS usuario_id,
        u.nome,
        u.email,
        u.cpf,
        u.registro,
        u.data_nascimento,
        u.deficiencia::text AS deficiencia_descricao,

        CASE
          WHEN u.data_nascimento IS NULL THEN NULL
          ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, u.data_nascimento))::int
        END AS idade,

        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%visual%' THEN TRUE ELSE FALSE END AS pcd_visual,
        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%auditiva%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%surdez%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%surdo%'
             THEN TRUE ELSE FALSE END AS pcd_auditiva,
        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%fisic%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%locomot%'
             THEN TRUE ELSE FALSE END AS pcd_fisica,
        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%intelectual%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%mental%'
             THEN TRUE ELSE FALSE END AS pcd_intelectual,
        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%múltipla%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%multipla%'
             THEN TRUE ELSE FALSE END AS pcd_multipla,
        CASE WHEN COALESCE(u.deficiencia::text, '') ILIKE '%tea%'
               OR COALESCE(u.deficiencia::text, '') ILIKE '%autis%'
             THEN TRUE ELSE FALSE END AS pcd_autismo

      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC, i.id ASC
      `,
      [turmaId]
    );

    const lista = (result.rows || []).map((row) => {
      const presentes = mapaPresencas.get(Number(row.usuario_id)) || 0;
      const frequenciaNum =
        totalDatas > 0 ? Math.round((presentes / totalDatas) * 100) : null;

      const deficienciaDescricao = normalizeText(row.deficiencia_descricao);

      return {
        inscricao_id: row.inscricao_id,
        data_inscricao: row.data_inscricao,

        usuario_id: row.usuario_id,
        nome: row.nome,
        email: row.email || null,
        cpf: row.cpf || null,
        cpf_protegido: cpfProtegido(row.cpf),
        registro: row.registro || null,
        idade: Number.isInteger(Number(row.idade)) ? Number(row.idade) : null,

        deficiencia: Boolean(deficienciaDescricao),
        deficiencia_descricao: deficienciaDescricao || null,
        pcd_visual: row.pcd_visual === true,
        pcd_auditiva: row.pcd_auditiva === true,
        pcd_fisica: row.pcd_fisica === true,
        pcd_intelectual: row.pcd_intelectual === true,
        pcd_multipla: row.pcd_multipla === true,
        pcd_autismo: row.pcd_autismo === true,

        total_datas: totalDatas,
        total_encontros: totalDatas,
        presencas_confirmadas: presentes,
        presentes_ocorridos: presentes,
        total_ocorridos: totalDatas,
        frequencia_num: frequenciaNum,
        frequencia: frequenciaNum !== null ? `${frequenciaNum}%` : null,
        frequencia_minima_percentual: 75,
        atingiu_frequencia_minima:
          totalDatas > 0 ? presentes / totalDatas >= 0.75 : false,
      };
    });

    logDev(rid, "listarInscritosPorTurma:ok", {
      turma_id: turmaId,
      total: lista.length,
      total_datas: totalDatas,
    });

    return ok(res, lista, "Inscritos carregados.");
  } catch (error) {
    logError(rid, "Erro ao listar inscritos por turma.", error);
    return fail(res, 500, "Erro ao buscar inscritos.");
  }
}

/* ─────────────────────────────────────────────────────────────
 * GET /api/inscricao/conflito/:turma_id
 * ───────────────────────────────────────────────────────────── */

async function conflitoPorTurma(req, res) {
  const rid = mkRid();
  const usuarioId = getUserId(req);
  const turmaId = toPositiveInt(req.params?.turma_id);

  if (!usuarioId) {
    return fail(res, 401, "Não autenticado.");
  }

  if (!turmaId) {
    return fail(res, 400, "turma_id inválido.");
  }

  try {
    const turma = await carregarTurmaCompleta(query, turmaId);

    if (!turma) {
      return fail(res, 404, "Turma não encontrada.");
    }

    const conflitoMesmoEvento = await conflitoHorario(query, usuarioId, turmaId, {
      somenteMesmoEvento: true,
    });

    const conflitoGlobal = await conflitoHorario(query, usuarioId, turmaId, {
      somenteMesmoEvento: false,
    });

    const conflito = conflitoMesmoEvento || conflitoGlobal;

    logDev(rid, "conflitoPorTurma:ok", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      evento_id: turma.evento_id,
      conflito_mesmo_evento: conflitoMesmoEvento,
      conflito_global: conflitoGlobal,
      conflito,
    });

    return ok(
      res,
      {
        usuario_id: usuarioId,
        turma_id: turmaId,
        evento_id: turma.evento_id,
        conflito_mesmo_evento: conflitoMesmoEvento,
        conflito_global: conflitoGlobal,
        conflito,
      },
      "Conflito verificado."
    );
  } catch (error) {
    logError(rid, "Erro ao verificar conflito por turma.", error);
    return fail(res, 500, "Erro ao verificar conflito de horários.");
  }
}

module.exports = {
  inscreverEmTurma,
  cancelarInscricaoPorId,
  cancelarMinhaInscricaoPorTurma,
  cancelarInscricaoDoUsuarioNaTurma,
  listarMinhasInscricoes,
  listarInscritosPorTurma,
  conflitoPorTurma,
};