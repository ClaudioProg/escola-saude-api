// 📁 src/controllers/inscricaoController.js — PREMIUM (robusto, seguro, date-only safe)
/* eslint-disable no-console */
const db = require("../db");
const { send: enviarEmail } = require("../services/mailer");
const { formatarDataBR } = require("../utils/dateTime");
const { criarNotificacao } = require("./notificacaoController");

const IS_DEV = process.env.NODE_ENV !== "production";

const { normalizeRegistro } = require("../utils/registro");

/* ────────────────────────────────────────────────────────────────
   Logger util (RID) — sem barulho em produção
   ──────────────────────────────────────────────────────────────── */
function mkRid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function log(rid, level, msg, extra) {
  const prefix = `[INS][RID=${rid}]`;
  if (level === "error") return console.error(`${prefix} ✖ ${msg}`, extra?.stack || extra?.message || extra);
  if (!IS_DEV && level !== "error") return; // reduz ruído em produção
  if (level === "warn") return console.warn(`${prefix} ⚠ ${msg}`, extra || "");
  return console.log(`${prefix} • ${msg}`, extra || "");
}

/* ────────────────────────────────────────────────────────────────
   Helpers date-only safe
   ──────────────────────────────────────────────────────────────── */
const asPositiveInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};
const safeText = (v, fb = "") => (v == null ? fb : String(v));
const safeHHMM = (v, fb = "") => {
  const s = safeText(v, "").trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : fb;
};
const safeYMD = (v, fb = null) => {
  const s = safeText(v, "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fb;
};

/* ────────────────────────────────────────────────────────────────
   Helpers de datas/horários (datas_turma) — sem new Date()
   ──────────────────────────────────────────────────────────────── */
/**
 * Retorna um “resumo” consistente da turma:
 *  - data_inicio/data_fim: MIN/MAX datas_turma; fallback presencas; fallback colunas da turma
 *  - horario_inicio/horario_fim: par mais frequente em datas_turma; fallback colunas da turma; fallback 08:00–17:00
 */
async function getResumoTurma(turmaId) {
  const sql = `
    SELECT
      t.id,

      COALESCE(
        (SELECT to_char(MIN(dt.data)::date, 'YYYY-MM-DD') FROM datas_turma dt WHERE dt.turma_id = t.id),
        (SELECT to_char(MIN(p.data_presenca)::date, 'YYYY-MM-DD') FROM presencas p WHERE p.turma_id = t.id),
        to_char(t.data_inicio, 'YYYY-MM-DD')
      ) AS data_inicio,

      COALESCE(
        (SELECT to_char(MAX(dt.data)::date, 'YYYY-MM-DD') FROM datas_turma dt WHERE dt.turma_id = t.id),
        (SELECT to_char(MAX(p.data_presenca)::date, 'YYYY-MM-DD') FROM presencas p WHERE p.turma_id = t.id),
        to_char(t.data_fim, 'YYYY-MM-DD')
      ) AS data_fim,

      COALESCE(
        (
          SELECT to_char(z.hi, 'HH24:MI') FROM (
            SELECT dt.horario_inicio AS hi, COUNT(*) c
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_inicio
            ORDER BY COUNT(*) DESC, hi
            LIMIT 1
          ) z
        ),
        to_char(t.horario_inicio, 'HH24:MI'),
        '08:00'
      ) AS horario_inicio,

      COALESCE(
        (
          SELECT to_char(z.hf, 'HH24:MI') FROM (
            SELECT dt.horario_fim AS hf, COUNT(*) c
            FROM datas_turma dt
            WHERE dt.turma_id = t.id
            GROUP BY dt.horario_fim
            ORDER BY COUNT(*) DESC, hf
            LIMIT 1
          ) z
        ),
        to_char(t.horario_fim, 'HH24:MI'),
        '17:00'
      ) AS horario_fim

    FROM turmas t
    WHERE t.id = $1
  `;
  const { rows } = await db.query(sql, [turmaId]);
  return rows?.[0] || null;
}

/* ────────────────────────────────────────────────────────────────
   🔒 Checagens de conflito — 100% SQL (sem fuso, sem Date())
   ──────────────────────────────────────────────────────────────── */

/**
 * Usa a função SQL: fn_tem_conflito_inscricao_mesmo_evento(usuario_id, turma_id)
 * Retorna boolean.
 */
async function conflitoMesmoEventoSQL(usuarioId, turmaId) {
  const q = `SELECT fn_tem_conflito_inscricao_mesmo_evento($1, $2) AS conflito`;
  const { rows } = await db.query(q, [usuarioId, turmaId]);
  return !!rows?.[0]?.conflito;
}

/**
 * Conflito GLOBAL (turma-alvo x qualquer outra inscrição do usuário).
 * - Compara SOMENTE no mesmo dia (datas_turma)
 * - Intervalo meia-aberto [início, fim) com tsrange => bordas contíguas NÃO conflitam
 * - Fallback: se turma-alvo não tem datas_turma, usa (data_inicio/data_fim+horários) apenas se di=df
 */
async function conflitoGlobalSQL(usuarioId, turmaIdAlvo) {
  // 1) turma-alvo tem datas_turma?
  const { rows: alvoTemDatas } = await db.query(
    `SELECT EXISTS(SELECT 1 FROM datas_turma WHERE turma_id = $1) AS tem;`,
    [turmaIdAlvo]
  );
  const temDatasAlvo = !!alvoTemDatas?.[0]?.tem;

  if (temDatasAlvo) {
    const q = `
      WITH alvo AS (
        SELECT
          dt.data::date AS data,
          dt.horario_inicio::time AS hi,
          dt.horario_fim::time  AS hf
        FROM datas_turma dt
        WHERE dt.turma_id = $2
      ),
      slots_alvo AS (
        SELECT tsrange(
                 (a.data + a.hi)::timestamp,
                 (a.data + a.hf)::timestamp,
                 '[)'
               ) AS rng
        FROM alvo a
        WHERE a.hi IS NOT NULL AND a.hf IS NOT NULL
      ),
      outras AS (
        SELECT i.turma_id
        FROM inscricoes i
        WHERE i.usuario_id = $1
          AND i.turma_id <> $2
      ),
      slots_outras AS (
        SELECT tsrange(
                 (d2.data + d2.horario_inicio)::timestamp,
                 (d2.data + d2.horario_fim)::timestamp,
                 '[)'
               ) AS rng
        FROM datas_turma d2
        JOIN outras o ON o.turma_id = d2.turma_id
        WHERE d2.horario_inicio IS NOT NULL AND d2.horario_fim IS NOT NULL
      )
      SELECT EXISTS (
        SELECT 1
        FROM slots_alvo sa
        JOIN slots_outras so ON sa.rng && so.rng
      ) AS conflito;
    `;

    try {
      const { rows } = await db.query(q, [usuarioId, turmaIdAlvo]);
      const conflito = !!rows?.[0]?.conflito;
      if (IS_DEV) log(mkRid(), "info", "CONFLITO-GLOBAL/DT", { usuarioId, turmaIdAlvo, conflito });
      return conflito;
    } catch (err) {
      log(mkRid(), "error", "Erro em conflitoGlobalSQL (datas_turma)", err);
      return false;
    }
  }

  // 2) fallback: turma-alvo SEM datas_turma
  const qFallback = `
    WITH alvo AS (
      SELECT
        to_char(t.data_inicio, 'YYYY-MM-DD') AS di,
        to_char(t.data_fim,    'YYYY-MM-DD') AS df,
        left(t.horario_inicio::text, 5)      AS hi,
        left(t.horario_fim::text,    5)      AS hf
      FROM turmas t
      WHERE t.id = $2
    ),
    outras AS (
      SELECT i.turma_id
      FROM inscricoes i
      WHERE i.usuario_id = $1
        AND i.turma_id <> $2
    ),
    slots_alvo AS (
      SELECT
        CASE
          WHEN a.di IS NOT NULL AND a.df IS NOT NULL
               AND a.di = a.df
               AND a.hi ~ '^[0-9]{2}:[0-9]{2}$'
               AND a.hf ~ '^[0-9]{2}:[0-9]{2}$'
          THEN tsrange(
                 (a.di || 'T' || a.hi)::timestamp,
                 (a.df || 'T' || a.hf)::timestamp,
                 '[)'
               )
          ELSE NULL
        END AS rng
      FROM alvo a
    ),
    slots_outras AS (
      SELECT tsrange(
               (d2.data::date + d2.horario_inicio::time)::timestamp,
               (d2.data::date + d2.horario_fim::time)::timestamp,
               '[)'
             ) AS rng
      FROM datas_turma d2
      JOIN outras o ON o.turma_id = d2.turma_id
      WHERE d2.horario_inicio IS NOT NULL AND d2.horario_fim IS NOT NULL
    )
    SELECT EXISTS (
      SELECT 1
      FROM slots_alvo sa
      JOIN slots_outras so ON sa.rng && so.rng
      WHERE sa.rng IS NOT NULL
    ) AS conflito;
  `;

  try {
    const { rows } = await db.query(qFallback, [usuarioId, turmaIdAlvo]);
    const conflito = !!rows?.[0]?.conflito;
    if (IS_DEV) log(mkRid(), "info", "CONFLITO-GLOBAL/FALLBACK", { usuarioId, turmaIdAlvo, conflito });
    return conflito;
  } catch (err) {
    log(mkRid(), "error", "Erro em conflitoGlobalSQL (fallback)", err);
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────
   ➕ Inscrever-se em uma turma
   ──────────────────────────────────────────────────────────────── */
async function inscreverEmTurma(req, res) {
  const rid = mkRid();

  const usuarioId = asPositiveInt(req.user?.id);
  const turmaId = asPositiveInt(req.body?.turma_id ?? req.body?.turmaId);

  if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });
  if (!turmaId) return res.status(400).json({ erro: "ID da turma é obrigatório." });

  log(rid, "info", "inscreverEmTurma:start", { usuarioId, turmaId });

  const client = await db.connect ? await db.connect() : null; // se db for Pool
  const q = client?.query ? client.query.bind(client) : db.query.bind(db);

  try {
    // Transação para evitar corrida (vagas / duplicidade)
    await q("BEGIN");

    // 1) Turma (lock)
    const { rows: turmaRows } = await q(`SELECT * FROM turmas WHERE id = $1 FOR UPDATE`, [turmaId]);
    if (!turmaRows.length) {
      await q("ROLLBACK");
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const turma = turmaRows[0];

    // Resumo calculado (para exibição/e-mail)
    const resumo = await getResumoTurma(turmaId);

    // 2) Evento (tipo + dados p/ notificação/e-mail)
    const { rows: evRows } = await q(
      `SELECT 
          id,
          (tipo::text) AS tipo,
          CASE WHEN tipo::text ILIKE 'congresso' THEN TRUE ELSE FALSE END AS is_congresso,
          COALESCE(titulo, 'Evento') AS titulo,
          COALESCE(local,  'A definir') AS local,

          restrito,
          restrito_modo,
          COALESCE(cargos_permitidos_ids, '{}')   AS cargos_permitidos_ids,
          COALESCE(unidades_permitidas_ids, '{}') AS unidades_permitidas_ids
       FROM eventos
       WHERE id = $1`,
      [turma.evento_id]
    );

    if (!evRows.length) {
      await q("ROLLBACK");
      return res.status(404).json({ erro: "Evento da turma não encontrado." });
    }
    const evento = evRows[0];
    const isCongresso = !!evento.is_congresso;

        // ✅ Permissão (mesma regra de visibilidade/inscrição)
        if (evento.restrito) {
          const { rows: uRows } = await q(
            `SELECT registro, cargo_id, unidade_id
               FROM usuarios
              WHERE id = $1`,
            [usuarioId]
          );
          const u = uRows?.[0] || {};
          const regNorm = normalizeRegistro(u.registro || "");
          const cargoId = Number(u.cargo_id) || null;
          const unidadeId = Number(u.unidade_id) || null;
    
          const cargosPermitidos = Array.isArray(evento.cargos_permitidos_ids)
            ? evento.cargos_permitidos_ids.map(Number).filter(Number.isFinite)
            : [];
    
          const unidadesPermitidas = Array.isArray(evento.unidades_permitidas_ids)
            ? evento.unidades_permitidas_ids.map(Number).filter(Number.isFinite)
            : [];
    
          // regras por cargo/unidade
          const okCargo = Number.isFinite(cargoId) && cargosPermitidos.includes(cargoId);
const okUnidade = Number.isFinite(unidadeId) && unidadesPermitidas.includes(unidadeId);
    
          // regra por lista de registros (se usada)
          let okRegistro = false;
          if (String(evento.restrito_modo || "") === "lista_registros" && regNorm) {
            const hit = await q(
              `SELECT 1 FROM evento_registros WHERE evento_id=$1 AND registro_norm=$2 LIMIT 1`,
              [evento.id, regNorm]
            );
            okRegistro = hit.rowCount > 0;
          }
    
          if (!okCargo && !okUnidade && !okRegistro) {
            await q("ROLLBACK");
            log(rid, "warn", "inscreverEmTurma:403 restrito", {
              usuarioId,
              turmaId,
              eventoId: evento.id,
              cargoId,
              unidadeId,
              regNorm,
              cargosPermitidos,
              unidadesPermitidas,
              restrito_modo: evento.restrito_modo,
            });
            return res.status(403).json({
              erro: "Sem permissão (evento restrito).",
              motivo: "EVENTO_RESTRITO",
              rid,
            });
          }
        }
    

    // 3) Bloqueio: instrutor do evento
    const ehInstrutor = await q(
      `SELECT 1 
         FROM evento_instrutor 
        WHERE evento_id = $1 AND instrutor_id = $2 
        LIMIT 1`,
      [turma.evento_id, usuarioId]
    );
    if (ehInstrutor.rowCount > 0) {
      await q("ROLLBACK");
      return res.status(409).json({
        erro: "Você é instrutor deste evento e não pode se inscrever como participante.",
      });
    }

    // 4) Duplicidade na MESMA turma
    const duplicado = await q(
      `SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
      [usuarioId, turmaId]
    );
    if (duplicado.rowCount > 0) {
      await q("ROLLBACK");
      return res.status(409).json({ erro: "Usuário já inscrito nesta turma." });
    }

    // 5) Regra: uma turma por evento (exceto congresso)
    if (!isCongresso) {
      const ja = await q(
        `SELECT 1
           FROM inscricoes i
           JOIN turmas t2 ON t2.id = i.turma_id
          WHERE i.usuario_id = $1
            AND t2.evento_id = $2
          LIMIT 1`,
        [usuarioId, turma.evento_id]
      );
      if (ja.rowCount > 0) {
        await q("ROLLBACK");
        return res.status(409).json({ erro: "Você já está inscrito em uma turma deste evento." });
      }
    }

    // 5A) Congresso: conflito dentro do mesmo evento
    if (isCongresso) {
      const conflitoMesmoEvento = await conflitoMesmoEventoSQL(usuarioId, turmaId);
      if (conflitoMesmoEvento) {
        await q("ROLLBACK");
        return res.status(409).json({
          erro: "Conflito de horário dentro deste evento com outra turma já inscrita.",
        });
      }
    }

    // 5B) Conflito global
    const conflitoGlobal = await conflitoGlobalSQL(usuarioId, turmaId);
    if (conflitoGlobal) {
      await q("ROLLBACK");
      return res.status(409).json({
        erro: "Conflito de horário com outra turma já inscrita em seu histórico.",
      });
    }

    // 6) Vagas (contagem na transação)
    const { rows: cntRows } = await q(
      `SELECT COUNT(*)::int AS total FROM inscricoes WHERE turma_id = $1`,
      [turmaId]
    );
    const totalInscritos = Number(cntRows?.[0]?.total || 0);
    const totalVagas = Number(turma.vagas_total);

    if (!Number.isFinite(totalVagas) || totalVagas <= 0) {
      await q("ROLLBACK");
      return res.status(500).json({ erro: "Número de vagas inválido para a turma." });
    }
    if (totalInscritos >= totalVagas) {
      await q("ROLLBACK");
      return res.status(400).json({ erro: "Turma lotada. Vagas esgotadas." });
    }

    // 7) Inserir inscrição (pode existir trigger)
let insert;
try {
  insert = await q(
    `INSERT INTO inscricoes (usuario_id, turma_id, data_inscricao) 
     VALUES ($1, $2, NOW()) 
     RETURNING id`,
    [usuarioId, turmaId]
  );
} catch (e) {
  // trigger de conflito
  if (e?.code === "P0001") {
    await q("ROLLBACK");
    return res.status(409).json({ erro: e?.message || "Inscrição bloqueada por conflito de horário." });
  }
  // unique (usuario_id,turma_id)
  if (e?.code === "23505") {
    await q("ROLLBACK");
    return res.status(409).json({ erro: "Usuário já inscrito nesta turma." });
  }
  log(rid, "error", "Erro no INSERT (inscricoes)", e);
  throw e;
}

    if (!insert?.rowCount) {
      await q("ROLLBACK");
      return res.status(500).json({ erro: "Erro ao registrar inscrição no banco." });
    }

    await q("COMMIT");

    // 8) Dados do usuário (para e-mail)
    const { rows: userRows } = await db.query(`SELECT nome, email FROM usuarios WHERE id = $1`, [usuarioId]);
    const usuario = userRows?.[0] || null;

    // 9) Datas legíveis (sem Date)
    const dataIni = resumo?.data_inicio ? formatarDataBR(safeYMD(resumo.data_inicio, "") || "") : "";
    const dataFim = resumo?.data_fim ? formatarDataBR(safeYMD(resumo.data_fim, "") || "") : "";
    const hi = safeHHMM(resumo?.horario_inicio, "");
    const hf = safeHHMM(resumo?.horario_fim, "");
    const periodoStr =
      dataIni && dataFim ? `${dataIni} a ${dataFim}` :
      dataIni || dataFim ? (dataIni || dataFim) :
      "a definir";

    // 10) Notificação (best-effort)
    try {
      const mensagem = [
        `✅ Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".`,
        "",
        `- Turma: ${turma.nome}`,
        `- Período: ${periodoStr}`,
        `- Horário: ${hi && hf ? `${hi} às ${hf}` : "a definir"}`,
        `- Carga horária: ${turma.carga_horaria ?? "—"} horas`,
        `- Local: ${evento.local}`,
      ].join("\n");

      await criarNotificacao(usuarioId, mensagem, null);
    } catch (e) {
      log(rid, "warn", "Falha ao criar notificação (não bloqueante)", { message: e?.message });
    }

    // 11) E-mail (best-effort)
    try {
      if (usuario?.email) {
        const nomeUser = safeText(usuario.nome, "participante");
        const carga = turma.carga_horaria ?? "—";
        const html = `
          <h2>Olá, ${nomeUser}!</h2>
          <p>Sua inscrição foi confirmada com sucesso.</p>
          <h3>📌 Detalhes da Inscrição</h3>
          <p>
            <strong>Evento:</strong> ${evento.titulo}<br/>
            <strong>Turma:</strong> ${turma.nome}<br/>
            <strong>Período:</strong> ${periodoStr}<br/>
            <strong>Horário:</strong> ${hi && hf ? `${hi} às ${hf}` : "a definir"}<br/>
            <strong>Carga horária:</strong> ${carga} horas<br/>
            <strong>Local:</strong> ${evento.local}
          </p>
          <p>📍 Em caso de dúvidas, entre em contato com a equipe da Escola da Saúde.</p>
          <p>Atenciosamente,<br/><strong>Equipe da Escola da Saúde</strong></p>
        `;

        const texto = `Olá, ${nomeUser}!

Sua inscrição foi confirmada com sucesso no evento "${evento.titulo}".

Turma: ${turma.nome}
Período: ${periodoStr}
Horário: ${hi && hf ? `${hi} às ${hf}` : "a definir"}
Carga horária: ${carga} horas
Local: ${evento.local}

Atenciosamente,
Equipe da Escola da Saúde`;

        await enviarEmail({
          to: usuario.email,
          subject: "✅ Inscrição Confirmada – Escola da Saúde",
          text: texto,
          html,
        });
      } else {
        log(rid, "warn", "E-mail do usuário ausente — pulando envio");
      }
    } catch (e) {
      log(rid, "warn", "Falha ao enviar e-mail (não bloqueante)", { message: e?.message });
    }

    log(rid, "info", "inscreverEmTurma:ok", { usuarioId, turmaId, eventoId: turma.evento_id });
    return res.status(201).json({ mensagem: "Inscrição realizada com sucesso" });
  } catch (err) {
    try {
      await q("ROLLBACK");
    } catch {}

    // conflitos conhecidos
    if (err?.code === "P0001") {
      return res.status(409).json({ erro: err?.message || "Inscrição bloqueada por conflito." });
    }
    if (err?.code === "23505") {
      return res.status(409).json({ erro: "Usuário já inscrito nesta turma." });
    }

    log(rid, "error", "Erro ao processar inscrição", err);
    return res.status(500).json({ erro: "Erro ao processar inscrição." });
  } finally {
    try {
      client?.release?.();
    } catch {}
  }
}

/* ────────────────────────────────────────────────────────────────
   ❌ Cancelar inscrição (usuário cancela a PRÓPRIA, por turmaId)
   ──────────────────────────────────────────────────────────────── */
async function cancelarMinhaInscricao(req, res) {
  const rid = mkRid();
  const usuarioId = asPositiveInt(req.user?.id);
  const turmaId = asPositiveInt(req.params?.turmaId ?? req.params?.id);

  if (!usuarioId || !turmaId) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  const client = await db.connect ? await db.connect() : null;
  const q = client?.query ? client.query.bind(client) : db.query.bind(db);

  try {
    const sel = await q(
      `SELECT id FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );
    if (!sel.rowCount) {
      return res.status(404).json({ erro: "Inscrição não encontrada para este usuário nesta turma." });
    }

    await q("BEGIN");

    await q(`DELETE FROM presencas WHERE usuario_id = $1 AND turma_id = $2`, [usuarioId, turmaId]);
    await q(`DELETE FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`, [usuarioId, turmaId]);

    await q("COMMIT");

    log(rid, "info", "cancelarMinhaInscricao:ok", { usuarioId, turmaId });
    return res.json({ mensagem: "Inscrição cancelada com sucesso." });
  } catch (err) {
    try {
      await q("ROLLBACK");
    } catch {}
    log(rid, "error", "Erro ao cancelar inscrição (minha)", err);
    return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
  } finally {
    try {
      client?.release?.();
    } catch {}
  }
}

/* ────────────────────────────────────────────────────────────────
   ❌ Cancelar inscrição (ADMIN cancela de QUALQUER usuário)
   ──────────────────────────────────────────────────────────────── */
async function cancelarInscricaoAdmin(req, res) {
  const rid = mkRid();
  const usuarioId = asPositiveInt(req.params?.usuarioId);
  const turmaId = asPositiveInt(req.params?.turmaId);

  if (!usuarioId || !turmaId) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  const client = await db.connect ? await db.connect() : null;
  const q = client?.query ? client.query.bind(client) : db.query.bind(db);

  try {
    const sel = await q(
      `SELECT id FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuarioId, turmaId]
    );
    if (!sel.rowCount) {
      return res.status(404).json({ erro: "Inscrição não encontrada." });
    }

    await q("BEGIN");

    await q(`DELETE FROM presencas WHERE usuario_id = $1 AND turma_id = $2`, [usuarioId, turmaId]);
    await q(`DELETE FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`, [usuarioId, turmaId]);

    await q("COMMIT");

    log(rid, "info", "cancelarInscricaoAdmin:ok", { usuarioId, turmaId });
    return res.json({ mensagem: "Inscrição cancelada (admin)." });
  } catch (err) {
    try {
      await q("ROLLBACK");
    } catch {}
    log(rid, "error", "Erro ao cancelar inscrição (admin)", err);
    return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
  } finally {
    try {
      client?.release?.();
    } catch {}
  }
}

/* ────────────────────────────────────────────────────────────────
   🔍 Minhas inscrições (com período/horário calculados)
   ──────────────────────────────────────────────────────────────── */
async function obterMinhasInscricao(req, res) {
  const rid = mkRid();
  const usuarioId = asPositiveInt(req.user?.id);
  if (!usuarioId) return res.status(401).json({ erro: "NAO_AUTENTICADO" });

  try {
    const resultado = await db.query(
      `
      SELECT 
        i.id AS inscricao_id, 
        e.id AS evento_id, 
        t.id AS turma_id,
        t.nome AS turma_nome,
        e.titulo, 
        e.local,
    
        to_char(
          COALESCE(
            (SELECT MIN(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            (SELECT MIN(p.data_presenca)::date FROM presencas p WHERE p.turma_id = t.id),
            t.data_inicio
          )::date,
          'YYYY-MM-DD'
        ) AS data_inicio,
    
        to_char(
          COALESCE(
            (SELECT MAX(dt.data)::date FROM datas_turma dt WHERE dt.turma_id = t.id),
            (SELECT MAX(p.data_presenca)::date FROM presencas p WHERE p.turma_id = t.id),
            t.data_fim
          )::date,
          'YYYY-MM-DD'
        ) AS data_fim,
    
        COALESCE(
          (
            SELECT to_char(z.hi, 'HH24:MI') FROM (
              SELECT dt.horario_inicio AS hi, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, hi
              LIMIT 1
            ) z
          ),
          to_char(t.horario_inicio, 'HH24:MI'),
          '08:00'
        ) AS horario_inicio,
    
        COALESCE(
          (
            SELECT to_char(z.hf, 'HH24:MI') FROM (
              SELECT dt.horario_fim AS hf, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = t.id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, hf
              LIMIT 1
            ) z
          ),
          to_char(t.horario_fim, 'HH24:MI'),
          '17:00'
        ) AS horario_fim,
    
        i.data_inscricao,
        string_agg(DISTINCT u.nome, ', ' ORDER BY u.nome) AS instrutor
    
      FROM inscricoes i
      JOIN turmas t ON i.turma_id = t.id
      JOIN eventos e ON t.evento_id = e.id
      LEFT JOIN evento_instrutor tp ON t.evento_id = tp.evento_id
      LEFT JOIN usuarios u ON u.id = tp.instrutor_id
      WHERE i.usuario_id = $1
      GROUP BY i.id, e.id, t.id
      ORDER BY COALESCE(
               (SELECT MAX(dt.data) FROM datas_turma dt WHERE dt.turma_id = t.id),
               t.data_fim
             ) DESC, 
             t.horario_fim DESC NULLS LAST;
      `,
      [usuarioId]
    );

    log(rid, "info", "obterMinhasInscricao:ok", { count: resultado.rowCount });
    return res.json(resultado.rows);
  } catch (err) {
    log(rid, "error", "Erro ao buscar inscrições", err);
    return res.status(500).json({ erro: "Erro ao buscar inscrições." });
  }
}

/* ────────────────────────────────────────────────────────────────
   📋 Inscritos por turma (com frequência)
   ──────────────────────────────────────────────────────────────── */
async function listarInscritosPorTurma(req, res) {
  const rid = mkRid();
  const turmaId = asPositiveInt(req.params.turma_id ?? req.params.turmaId);
  if (!turmaId) return res.status(400).json({ erro: "turmaId inválido" });

  try {
    // total de encontros (datas_turma)
    const { rows: diasRows } = await db.query(
      `SELECT COUNT(*)::int AS total_dias
         FROM datas_turma
        WHERE turma_id = $1`,
      [turmaId]
    );
    const totalDias = Number(diasRows?.[0]?.total_dias || 0);

    // presentes por usuário
    const { rows: presRows } = await db.query(
      `
      SELECT usuario_id,
             SUM(CASE WHEN presente THEN 1 ELSE 0 END)::int AS presentes
        FROM presencas
       WHERE turma_id = $1
       GROUP BY usuario_id
      `,
      [turmaId]
    );
    const presentesMap = new Map(presRows.map((r) => [Number(r.usuario_id), Number(r.presentes)]));

    // inscritos + dados extras
    const { rows } = await db.query(
      `
      SELECT 
        u.id  AS usuario_id,
        u.nome,
        u.cpf,
        u.registro,
        u.data_nascimento,
        u.deficiencia,

        CASE
          WHEN u.data_nascimento IS NULL THEN NULL
          ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, u.data_nascimento))::int
        END AS idade,

        CASE WHEN u.deficiencia ILIKE '%visual%'                        THEN TRUE ELSE FALSE END AS pcd_visual,
        CASE WHEN u.deficiencia ILIKE '%auditiva%' OR u.deficiencia ILIKE '%surdez%' OR u.deficiencia ILIKE '%surdo%' THEN TRUE ELSE FALSE END AS pcd_auditiva,
        CASE WHEN u.deficiencia ILIKE '%fisic%' OR u.deficiencia ILIKE '%locomot%'                                  THEN TRUE ELSE FALSE END AS pcd_fisica,
        CASE WHEN u.deficiencia ILIKE '%intelectual%' OR u.deficiencia ILIKE '%mental%'                             THEN TRUE ELSE FALSE END AS pcd_intelectual,
        CASE WHEN u.deficiencia ILIKE '%múltipla%' OR u.deficiencia ILIKE '%multipla%'                              THEN TRUE ELSE FALSE END AS pcd_multipla,
        CASE WHEN u.deficiencia ILIKE '%tea%' OR u.deficiencia ILIKE '%autis%'                                      THEN TRUE ELSE FALSE END AS pcd_autismo

      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome ASC
      `,
      [turmaId]
    );

    const lista = rows.map((r) => {
      const presentes = presentesMap.get(Number(r.usuario_id)) || 0;
      const freqNum = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : null;

      return {
        usuario_id: r.usuario_id,
        nome: r.nome,
        cpf: r.cpf,

        idade: Number.isFinite(r.idade) ? r.idade : null,
        registro: r.registro || null,

        deficiencia: r.deficiencia || null,
        pcd_visual: !!r.pcd_visual,
        pcd_auditiva: !!r.pcd_auditiva,
        pcd_fisica: !!r.pcd_fisica,
        pcd_intelectual: !!r.pcd_intelectual,
        pcd_multipla: !!r.pcd_multipla,
        pcd_autismo: !!r.pcd_autismo,

        frequencia_num: freqNum,
        frequencia: freqNum != null ? `${freqNum}%` : null,
      };
    });

    log(rid, "info", "listarInscritosPorTurma:ok", { turmaId, total: lista.length, totalDias });
    return res.json(lista);
  } catch (err) {
    log(rid, "error", "Erro ao buscar inscritos", err);
    return res.status(500).json({ erro: "Erro ao buscar inscritos." });
  }
}

/* ────────────────────────────────────────────────────────────────
   🔎 Checagem de conflito (frontend) — uma turma específica
   ──────────────────────────────────────────────────────────────── */
async function conflitoPorTurma(req, res) {
  const rid = mkRid();

  const usuarioId = asPositiveInt(req.user?.id);
  const turmaId = asPositiveInt(req.params?.turmaId ?? req.params?.turma_id);

  if (!usuarioId || !turmaId) {
    return res.status(400).json({ erro: "Parâmetros inválidos." });
  }

  try {
    const { rows: trows } = await db.query(`SELECT evento_id FROM turmas WHERE id = $1`, [turmaId]);
    if (!trows.length) return res.status(404).json({ erro: "Turma não encontrada." });

    const eventoId = trows[0].evento_id;

    const conflitoMesmoEvento = await conflitoMesmoEventoSQL(usuarioId, turmaId);
    const conflitoGlobal = await conflitoGlobalSQL(usuarioId, turmaId);
    const conflito = conflitoMesmoEvento || conflitoGlobal;

    log(rid, "info", "conflitoPorTurma:ok", {
      usuarioId,
      turmaId,
      eventoId,
      conflitoMesmoEvento,
      conflitoGlobal,
      conflito,
    });

    return res.json({
      usuario_id: usuarioId,
      turma_id: turmaId,
      evento_id: eventoId,
      conflitoMesmoEvento,
      conflitoGlobal,
      conflito,
    });
  } catch (err) {
    log(rid, "error", "Erro em conflitoPorTurma", err);
    return res.status(500).json({ erro: "Erro ao verificar conflito de horários." });
  }
}

/* ✅ Exportar */
module.exports = {
  inscreverEmTurma,
  cancelarMinhaInscricao,
  cancelarInscricaoAdmin,
  obterMinhasInscricao,
  listarInscritosPorTurma,
  conflitoPorTurma,
};
