/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/lembreteEventoService.js — v2.0
 * Atualizado em: 15/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Executar e diagnosticar lembretes automáticos de véspera para usuários inscritos.
 *
 * Regra oficial:
 * - Se a turma inicia em D, os inscritos devem receber notificação interna e e-mail em D-1,
 *   a partir das 9h, informando que o curso começa no dia seguinte.
 *
 * Fontes oficiais:
 * - Data de início: turmas.data_inicio
 * - Horário: datas_turma.horario_inicio / datas_turma.horario_fim
 *   quando datas_turma.data = turmas.data_inicio
 * - Inscritos: inscricoes
 * - Usuário/e-mail: usuarios
 * - Evento/local: eventos
 *
 * Contratos:
 * - entidade_tipo: turma
 * - tipo programado: lembrete_inicio_evento
 * - tipo notificação interna: evento_lembrete_inicio
 *
 * Segurança/consistência:
 * - Sem fallback de endpoint.
 * - Sem alias de tipo/status.
 * - Sem envio duplicado.
 * - Sem inferir horário pelo título do evento.
 * - Anti-fuso: datas civis trafegam como YYYY-MM-DD.
 */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

const { sendEmail } = require("./mailer");

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const ENTIDADE_TIPO_TURMA = "turma";
const TIPO_PROGRAMADO = "lembrete_inicio_evento";
const TIPO_NOTIFICACAO = "evento_lembrete_inicio";

const STATUS_PENDENTE = "pendente";
const STATUS_ENVIADO = "enviado";
const STATUS_ERRO = "erro";
const STATUS_ERRO_PARCIAL = "erro_parcial";

const TIMEZONE_OFICIAL = "America/Sao_Paulo";

/* ──────────────────────────────────────────────────────────────
   Helpers de banco
────────────────────────────────────────────────────────────── */

async function dbOne(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows?.[0] || null;
}

async function dbMany(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows || [];
}

/* ──────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function limparTexto(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function somenteDataYmd(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const ano = value.getFullYear();
    const mes = String(value.getMonth() + 1).padStart(2, "0");
    const dia = String(value.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  return String(value).slice(0, 10);
}

function formatarDataBr(ymd) {
  const data = somenteDataYmd(ymd);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return "";
  }

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function normalizarHora(value) {
  if (!value) return "";

  const text = String(value).trim();

  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return "";

  const hora = String(match[1]).padStart(2, "0");
  const minuto = String(match[2]).padStart(2, "0");

  return `${hora}h${minuto}`;
}

function montarTextoHorario(inicio, fim) {
  const horaInicio = normalizarHora(inicio);
  const horaFim = normalizarHora(fim);

  if (horaInicio && horaFim) {
    return `das ${horaInicio} às ${horaFim}`;
  }

  if (horaInicio) {
    return `a partir das ${horaInicio}`;
  }

  return "";
}

function hojeYmdEmTimezone(timeZone = TIMEZONE_OFICIAL) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const ano = partes.find((parte) => parte.type === "year")?.value;
  const mes = partes.find((parte) => parte.type === "month")?.value;
  const dia = partes.find((parte) => parte.type === "day")?.value;

  return `${ano}-${mes}-${dia}`;
}

function adicionarDiasYmd(ymd, dias) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) {
    throw new Error(`Data inválida para cálculo civil: ${ymd}`);
  }

  const [ano, mes, dia] = ymd.split("-").map(Number);
  const baseUtc = Date.UTC(ano, mes - 1, dia, 12, 0, 0);
  const novaData = new Date(baseUtc + Number(dias) * 86_400_000);

  const novoAno = novaData.getUTCFullYear();
  const novoMes = String(novaData.getUTCMonth() + 1).padStart(2, "0");
  const novoDia = String(novaData.getUTCDate()).padStart(2, "0");

  return `${novoAno}-${novoMes}-${novoDia}`;
}

function resolverDataReferencia(options = {}) {
  const direta = somenteDataYmd(options.dataReferencia || options.data_inicio);

  if (direta) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(direta)) {
      throw new Error("dataReferencia deve estar no formato YYYY-MM-DD.");
    }

    return direta;
  }

  const hoje = hojeYmdEmTimezone(options.timezone || TIMEZONE_OFICIAL);
  return adicionarDiasYmd(hoje, 1);
}

function normalizarLimite(value) {
  const limite = Number.parseInt(value, 10);

  if (!Number.isFinite(limite) || limite <= 0) {
    return null;
  }

  return Math.min(limite, 1000);
}

function obterNomeCurso(row) {
  return limparTexto(row.evento_titulo || row.turma_nome || "Curso da Escola da Saúde");
}

function montarMensagem(row) {
  const nomeCurso = obterNomeCurso(row);
  const dataBr = formatarDataBr(row.data_inicio);
  const textoHorario = montarTextoHorario(row.horario_inicio, row.horario_fim);
  const local = limparTexto(row.evento_local);

  const trechoHorario = textoHorario ? `, ${textoHorario}` : "";

  const mensagemBase = `O curso “${nomeCurso}” em que você está inscrito começa amanhã, dia ${dataBr}${trechoHorario}.`;

  if (local) {
    return `${mensagemBase}\n\nLocal: ${local}.`;
  }

  return mensagemBase;
}

function montarTextoEmail(row) {
  const nomeUsuario = limparTexto(row.usuario_nome);
  const mensagem = montarMensagem(row);
  const turmaNome = limparTexto(row.turma_nome);

  const linhas = [
    nomeUsuario ? `Olá, ${nomeUsuario}.` : "Olá.",
    "",
    mensagem,
  ];

  if (turmaNome) {
    linhas.push("", `Turma: ${turmaNome}.`);
  }

  linhas.push(
    "",
    "Este é um lembrete automático da Plataforma Escola da Saúde.",
    "Em caso de dúvidas, acesse a plataforma ou entre em contato com a Escola da Saúde."
  );

  return linhas.join("\n");
}

function montarHtmlEmail(row) {
  const nomeUsuario = limparTexto(row.usuario_nome);
  const nomeCurso = obterNomeCurso(row);
  const dataBr = formatarDataBr(row.data_inicio);
  const textoHorario = montarTextoHorario(row.horario_inicio, row.horario_fim);
  const local = limparTexto(row.evento_local);
  const turmaNome = limparTexto(row.turma_nome);

  const urlPlataforma = limparTexto(process.env.VITE_FRONTEND_URL);

  const horarioHtml = textoHorario
    ? `<p style="margin:0 0 10px;"><strong>Horário:</strong> ${escapeHtml(textoHorario)}</p>`
    : "";

  const localHtml = local
    ? `<p style="margin:0 0 10px;"><strong>Local:</strong> ${escapeHtml(local)}</p>`
    : "";

  const turmaHtml = turmaNome
    ? `<p style="margin:0 0 10px;"><strong>Turma:</strong> ${escapeHtml(turmaNome)}</p>`
    : "";

  const botaoHtml = urlPlataforma
    ? `
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(urlPlataforma)}"
           style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">
          Acessar plataforma
        </a>
      </p>
    `
    : "";

  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <div style="background:#0f766e;padding:22px 26px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;">Lembrete de curso</h1>
            <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Escola da Saúde</p>
          </div>

          <div style="padding:26px;">
            <p style="margin:0 0 16px;font-size:16px;">
              ${nomeUsuario ? `Olá, <strong>${escapeHtml(nomeUsuario)}</strong>.` : "Olá."}
            </p>

            <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
              O curso em que você está inscrito começa <strong>amanhã</strong>.
            </p>

            <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:16px;padding:18px;margin:18px 0;">
              <p style="margin:0 0 10px;"><strong>Curso:</strong> ${escapeHtml(nomeCurso)}</p>
              ${turmaHtml}
              <p style="margin:0 0 10px;"><strong>Data:</strong> ${escapeHtml(dataBr)}</p>
              ${horarioHtml}
              ${localHtml}
            </div>

            <p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#4b5563;">
              Este é um lembrete automático da Plataforma Escola da Saúde. Em caso de dúvidas,
              acesse a plataforma ou entre em contato com a Escola da Saúde.
            </p>

            ${botaoHtml}
          </div>
        </div>

        <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#6b7280;">
          Secretaria Municipal de Saúde — Escola da Saúde
        </p>
      </div>
    </div>
  `;
}

function montarResumoRegistro(row) {
  return {
    usuario_id: row.usuario_id,
    usuario_nome: row.usuario_nome,
    usuario_email: row.usuario_email,
    turma_id: row.turma_id,
    turma_nome: row.turma_nome,
    evento_id: row.evento_id,
    evento_titulo: row.evento_titulo,
    data_inicio: somenteDataYmd(row.data_inicio),
    horario_inicio: row.horario_inicio || null,
    horario_fim: row.horario_fim || null,
    local: row.evento_local || null,
  };
}

/* ──────────────────────────────────────────────────────────────
   Consulta oficial dos destinatários
────────────────────────────────────────────────────────────── */

async function listarInscritosComCursoIniciandoEm(dataReferencia, options = {}) {
  const limite = normalizarLimite(options.limite);

  const sql = `
    SELECT
      i.usuario_id,
      u.nome AS usuario_nome,
      u.email AS usuario_email,

      t.id AS turma_id,
      t.nome AS turma_nome,
      t.data_inicio,

      COALESCE(dt.horario_inicio, t.horario_inicio) AS horario_inicio,
      COALESCE(dt.horario_fim, t.horario_fim) AS horario_fim,

      e.id AS evento_id,
      e.titulo AS evento_titulo,
      e.local AS evento_local

    FROM inscricoes i
    JOIN usuarios u
      ON u.id = i.usuario_id

    JOIN turmas t
      ON t.id = i.turma_id

    JOIN eventos e
      ON e.id = t.evento_id

    LEFT JOIN LATERAL (
      SELECT
        d.horario_inicio,
        d.horario_fim
      FROM datas_turma d
      WHERE d.turma_id = t.id
        AND d.data = t.data_inicio
      ORDER BY
        d.horario_inicio NULLS LAST,
        d.id
      LIMIT 1
    ) dt ON true

    WHERE t.data_inicio = $1
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''

    ORDER BY
      e.titulo,
      t.nome,
      u.nome

    ${limite ? `LIMIT ${limite}` : ""}
  `;

  return dbMany(sql, [dataReferencia]);
}

/* ──────────────────────────────────────────────────────────────
   Controle idempotente
────────────────────────────────────────────────────────────── */

async function registrarOuObterProgramacao(row) {
  const titulo = "Lembrete de curso";
  const mensagem = montarMensagem(row);
  const emailDestino = limparTexto(row.usuario_email);
  const dataReferencia = somenteDataYmd(row.data_inicio);

  const sql = `
    INSERT INTO notificacoes_programadas (
      usuario_id,
      entidade_tipo,
      entidade_id,
      tipo,
      data_referencia,
      titulo,
      mensagem,
      email_destino,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )
    ON CONFLICT (usuario_id, entidade_tipo, entidade_id, tipo, data_referencia)
    DO UPDATE SET
      atualizado_em = CURRENT_TIMESTAMP
    RETURNING
      id,
      usuario_id,
      entidade_tipo,
      entidade_id,
      tipo,
      data_referencia,
      email_enviado,
      email_enviado_em,
      notificacao_criada,
      notificacao_id,
      status
  `;

  return dbOne(sql, [
    row.usuario_id,
    ENTIDADE_TIPO_TURMA,
    row.turma_id,
    TIPO_PROGRAMADO,
    dataReferencia,
    titulo,
    mensagem,
    emailDestino,
    STATUS_PENDENTE,
  ]);
}

async function marcarNotificacaoCriada(programacaoId, notificacaoId) {
  await db.query(
    `
      UPDATE notificacoes_programadas
      SET
        notificacao_criada = true,
        notificacao_id = $2,
        atualizado_em = CURRENT_TIMESTAMP,
        status = CASE
          WHEN email_enviado = true THEN $3
          ELSE status
        END
      WHERE id = $1
    `,
    [programacaoId, notificacaoId, STATUS_ENVIADO]
  );
}

async function marcarEmailEnviado(programacaoId) {
  await db.query(
    `
      UPDATE notificacoes_programadas
      SET
        email_enviado = true,
        email_enviado_em = CURRENT_TIMESTAMP,
        email_erro = NULL,
        status = CASE
          WHEN notificacao_criada = true THEN $2
          ELSE $3
        END,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [programacaoId, STATUS_ENVIADO, STATUS_ERRO_PARCIAL]
  );
}

async function marcarErro(programacaoId, error, parcial = false) {
  await db.query(
    `
      UPDATE notificacoes_programadas
      SET
        status = $2,
        email_erro = $3,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [
      programacaoId,
      parcial ? STATUS_ERRO_PARCIAL : STATUS_ERRO,
      String(error?.message || error || "Erro não identificado.").slice(0, 2000),
    ]
  );
}

/* ──────────────────────────────────────────────────────────────
   Notificação interna
────────────────────────────────────────────────────────────── */

async function criarNotificacaoInterna(row) {
  const titulo = "Lembrete de curso";
  const mensagem = montarMensagem(row);

  const sql = `
    INSERT INTO notificacoes (
      usuario_id,
      titulo,
      mensagem,
      tipo,
      turma_id,
      lida,
      criado_em
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      false,
      CURRENT_TIMESTAMP
    )
    RETURNING id
  `;

  const created = await dbOne(sql, [
    row.usuario_id,
    titulo,
    mensagem,
    TIPO_NOTIFICACAO,
    row.turma_id,
  ]);

  return created?.id || null;
}

/* ──────────────────────────────────────────────────────────────
   Envio de e-mail
────────────────────────────────────────────────────────────── */

async function enviarEmailLembrete(row) {
  const nomeCurso = obterNomeCurso(row);

  return sendEmail({
    to: row.usuario_email,
    subject: "Lembrete: seu curso começa amanhã",
    html: montarHtmlEmail(row),
    text: montarTextoEmail(row),
    headers: {
      "X-Escola-Saude-Tipo": TIPO_PROGRAMADO,
      "X-Escola-Saude-Turma-Id": String(row.turma_id),
      "X-Escola-Saude-Evento-Id": String(row.evento_id),
      "X-Escola-Saude-Curso": limparTexto(nomeCurso).slice(0, 180),
    },
  });
}

/* ──────────────────────────────────────────────────────────────
   Execução individual
────────────────────────────────────────────────────────────── */

async function processarLembrete(row, options = {}) {
  const dryRun = !!options.dryRun;

  const base = montarResumoRegistro(row);

  if (dryRun) {
    return {
      ...base,
      dryRun: true,
      acao: "diagnostico",
      titulo: "Lembrete de curso",
      mensagem: montarMensagem(row),
      email_subject: "Lembrete: seu curso começa amanhã",
    };
  }

  const programacao = await registrarOuObterProgramacao(row);

  if (!programacao?.id) {
    return {
      ...base,
      acao: "ignorado",
      status: "sem_programacao",
      motivo: "Não foi possível criar ou obter a programação.",
    };
  }

  const jaCompleto =
    programacao.email_enviado === true &&
    programacao.notificacao_criada === true &&
    programacao.status === STATUS_ENVIADO;

  if (jaCompleto) {
    return {
      ...base,
      programacao_id: programacao.id,
      acao: "ignorado",
      status: STATUS_ENVIADO,
      motivo: "Lembrete já enviado anteriormente.",
    };
  }

  let notificacaoId = programacao.notificacao_id || null;
  let notificacaoCriada = programacao.notificacao_criada === true;
  let emailEnviado = programacao.email_enviado === true;

  try {
    if (!notificacaoCriada) {
      notificacaoId = await criarNotificacaoInterna(row);
      await marcarNotificacaoCriada(programacao.id, notificacaoId);
      notificacaoCriada = true;
    }

    if (!emailEnviado) {
      await enviarEmailLembrete(row);
      await marcarEmailEnviado(programacao.id);
      emailEnviado = true;
    }

    return {
      ...base,
      programacao_id: programacao.id,
      notificacao_id: notificacaoId,
      acao: "enviado",
      status: STATUS_ENVIADO,
      notificacao_criada: notificacaoCriada,
      email_enviado: emailEnviado,
    };
  } catch (error) {
    const parcial = notificacaoCriada || emailEnviado;

    await marcarErro(programacao.id, error, parcial);

    console.error("[lembreteEventoService.processarLembrete] ERRO", {
      message: error?.message,
      code: error?.code,
      usuario_id: row.usuario_id,
      turma_id: row.turma_id,
      evento_id: row.evento_id,
      programacao_id: programacao.id,
    });

    return {
      ...base,
      programacao_id: programacao.id,
      notificacao_id: notificacaoId,
      acao: "erro",
      status: parcial ? STATUS_ERRO_PARCIAL : STATUS_ERRO,
      notificacao_criada: notificacaoCriada,
      email_enviado: emailEnviado,
      erro: error?.message || "Erro ao processar lembrete.",
      erro_code: error?.code || null,
    };
  }
}

/* ──────────────────────────────────────────────────────────────
   API interna do service
────────────────────────────────────────────────────────────── */

async function executarLembretesInicioEvento(options = {}) {
  const dataReferencia = resolverDataReferencia(options);
  const dryRun = !!options.dryRun;

  const rows = await listarInscritosComCursoIniciandoEm(dataReferencia, {
    limite: options.limite,
  });

  const resultados = [];

  for (const row of rows) {
    // Envio sequencial intencional: evita rajada SMTP e facilita diagnóstico.
    // Se futuramente precisar paralelizar, fazer com fila controlada.
    // eslint-disable-next-line no-await-in-loop
    const resultado = await processarLembrete(row, { dryRun });
    resultados.push(resultado);
  }

  const resumo = resultados.reduce(
    (acc, item) => {
      acc.total += 1;

      if (item.acao === "diagnostico") acc.diagnostico += 1;
      if (item.acao === "enviado") acc.enviados += 1;
      if (item.acao === "ignorado") acc.ignorados += 1;
      if (item.acao === "erro") acc.erros += 1;

      if (item.status === STATUS_ERRO_PARCIAL) acc.erros_parciais += 1;

      return acc;
    },
    {
      total: 0,
      diagnostico: 0,
      enviados: 0,
      ignorados: 0,
      erros: 0,
      erros_parciais: 0,
    }
  );

  return {
    ok: true,
    code: dryRun
      ? "LEMBRETE-EVENTO-DIAGNOSTICO-OK"
      : "LEMBRETE-EVENTO-EXECUCAO-OK",
    message: dryRun
      ? "Diagnóstico de lembretes de início de evento concluído."
      : "Execução de lembretes de início de evento concluída.",
    data: {
      data_referencia: dataReferencia,
      dryRun,
      resumo,
      itens: resultados,
    },
    meta: {
      entidade_tipo: ENTIDADE_TIPO_TURMA,
      tipo_programado: TIPO_PROGRAMADO,
      tipo_notificacao: TIPO_NOTIFICACAO,
      timezone: options.timezone || TIMEZONE_OFICIAL,
    },
  };
}

async function diagnosticarLembretesInicioEvento(options = {}) {
  return executarLembretesInicioEvento({
    ...options,
    dryRun: true,
  });
}

module.exports = {
  executarLembretesInicioEvento,
  diagnosticarLembretesInicioEvento,
  listarInscritosComCursoIniciandoEm,

  // Exportados para testes controlados.
  _internals: {
    montarMensagem,
    montarTextoEmail,
    montarHtmlEmail,
    resolverDataReferencia,
    adicionarDiasYmd,
    hojeYmdEmTimezone,
    montarTextoHorario,
  },
};