/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/services/confirmacaoUsoSalaService.js — v2.0
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Gerenciar o fluxo de confirmação obrigatória de uso das salas.
 *
 * Regra oficial:
 * - Reservas aprovadas devem ser confirmadas entre 7 dias e 48 horas antes da data reservada.
 * - O sistema deve enviar e-mail e notificação interna quando a reserva entrar na janela.
 * - Se a confirmação não ocorrer dentro do prazo, a reserva poderá ser cancelada pela Escola da Saúde.
 *
 * Fontes oficiais:
 * - Reserva: reservas_salas
 * - Usuário: usuarios
 * - Notificação interna: notificacoes
 * - Controle anti-duplicidade: notificacoes_programadas
 *
 * Contratos:
 * - reservas_salas.status: pendente | aprovado | rejeitado | cancelado | bloqueado
 * - notificacoes_programadas.entidade_tipo: reserva_sala
 * - notificacoes_programadas.tipo: confirmacao_uso_sala
 *
 * Diretrizes:
 * - Sem alias de status.
 * - Sem status "confirmado" no enum de reserva.
 * - A confirmação fica registrada em confirmado_em/confirmado_por.
 * - O cancelamento por falta de confirmação usa status = cancelado + motivo_cancelamento.
 * - Anti-fuso: datas civis trafegam como YYYY-MM-DD.
 */

const { query, getClient } = require("../db");
const { sendEmail } = require("./mailer");

/* =========================================================================
   Constantes oficiais
=========================================================================== */

const TIMEZONE_OFICIAL = "America/Sao_Paulo";

const STATUS_RESERVA = Object.freeze({
  APROVADO: "aprovado",
  CANCELADO: "cancelado",
});

const ENTIDADE_TIPO = "reserva_sala";
const TIPO_PROGRAMADO = "confirmacao_uso_sala";
const TIPO_NOTIFICACAO_SOLICITACAO = "sala_confirmacao_uso";
const TIPO_NOTIFICACAO_CONFIRMADA = "sala_uso_confirmado";
const TIPO_NOTIFICACAO_CANCELADA = "sala_cancelada_sem_confirmacao";

const STATUS_PROGRAMADO = Object.freeze({
  PENDENTE: "pendente",
  ENVIADO: "enviado",
  ERRO: "erro",
  ERRO_PARCIAL: "erro_parcial",
});

const MOTIVO_CANCELAMENTO_PADRAO =
  "Cancelamento automático por ausência de confirmação de uso no prazo institucional de 7 dias a 48 horas antes da reserva.";

/* =========================================================================
   Helpers de banco
=========================================================================== */

async function dbOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows?.[0] || null;
}

async function dbMany(sql, params = []) {
  const result = await query(sql, params);
  return result.rows || [];
}

/* =========================================================================
   Helpers gerais
=========================================================================== */

function limparTexto(value, max = 1000) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();

  if (!text) return "";

  return text.length > max ? text.slice(0, max) : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asPositiveBigIntString(value) {
  const text = String(value ?? "").trim();

  if (!/^\d+$/.test(text)) return null;

  const n = BigInt(text);

  if (n <= 0n) return null;

  return text;
}

function asPositiveInt(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function somenteDataYmd(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const text = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function formatarDataBr(value) {
  const ymd = somenteDataYmd(value);

  if (!ymd) return "—";

  const [year, month, day] = ymd.split("-");
  return `${day}/${month}/${year}`;
}

function hojeYmdEmTimezone(timeZone = TIMEZONE_OFICIAL) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${map.year}-${map.month}-${map.day}`;
}

function adicionarDiasYmd(ymd, dias) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ymd || ""))) {
    throw new Error(`Data inválida para cálculo civil: ${ymd}`);
  }

  const [year, month, day] = ymd.split("-").map(Number);
  const baseUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const novaData = new Date(baseUtc + Number(dias) * 86_400_000);

  const y = novaData.getUTCFullYear();
  const m = String(novaData.getUTCMonth() + 1).padStart(2, "0");
  const d = String(novaData.getUTCDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function resolverHoje(options = {}) {
  const direto = somenteDataYmd(options.hoje || options.data_base);

  if (direto) return direto;

  return hojeYmdEmTimezone(options.timezone || TIMEZONE_OFICIAL);
}

function resolverJanelaConfirmacao(options = {}) {
  const hoje = resolverHoje(options);

  return {
    hoje,
    data_inicio: adicionarDiasYmd(hoje, 2),
    data_fim: adicionarDiasYmd(hoje, 7),
  };
}

function estaNaJanelaConfirmacao(dataReserva, hoje = hojeYmdEmTimezone()) {
  const data = somenteDataYmd(dataReserva);

  if (!data) return false;

  const inicio = adicionarDiasYmd(data, -7);
  const fim = adicionarDiasYmd(data, -2);

  return hoje >= inicio && hoje <= fim;
}

function jaPassouPrazoConfirmacao(dataReserva, hoje = hojeYmdEmTimezone()) {
  const data = somenteDataYmd(dataReserva);

  if (!data) return false;

  const ultimoDia = adicionarDiasYmd(data, -2);

  return hoje > ultimoDia;
}

function labelSala(sala) {
  if (sala === "auditorio") return "Auditório";
  if (sala === "sala_reuniao") return "Sala de Reunião";
  return "Sala";
}

function labelPeriodo(periodo) {
  if (periodo === "manha") return "Manhã";
  if (periodo === "tarde") return "Tarde";
  return "Período";
}

function montarLinkInternoReserva(reservaId) {
  const id = asPositiveBigIntString(reservaId);

  if (!id) return "/agenda-salas";

  return `/agenda-salas?reserva_id=${encodeURIComponent(id)}`;
}

function montarUrlPlataforma(path = "") {
  const base = limparTexto(process.env.VITE_FRONTEND_URL || process.env.FRONTEND_URL || "");

  if (!base) return "";

  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path || "")
    : `/${String(path || "")}`;

  return `${normalizedBase}${normalizedPath}`;
}

function montarResumoReserva(row) {
  return {
    reserva_id: row.id,
    usuario_id: row.solicitante_id,
    usuario_nome: row.solicitante_nome || null,
    usuario_email: row.solicitante_email || null,
    sala: row.sala,
    sala_label: labelSala(row.sala),
    data: somenteDataYmd(row.data),
    data_br: formatarDataBr(row.data),
    periodo: row.periodo,
    periodo_label: labelPeriodo(row.periodo),
    finalidade: row.finalidade || null,
    status: row.status,
    confirmacao_solicitada_em: row.confirmacao_solicitada_em || null,
    confirmado_em: row.confirmado_em || null,
    confirmado_por: row.confirmado_por || null,
  };
}

/* =========================================================================
   Mensagens
=========================================================================== */

function montarTituloSolicitacao() {
  return "Confirme o uso da sala";
}

function montarMensagemSolicitacao(row) {
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);

  return [
    `Sua reserva da ${sala} para o dia ${dataBr}, período ${periodo}, precisa ser confirmada.`,
    "A confirmação deve ser realizada entre 7 dias e 48 horas antes da data reservada.",
    "Caso não confirme dentro do prazo, a reserva poderá ser cancelada pela Escola da Saúde.",
  ].join(" ");
}

function montarTextoEmailSolicitacao(row) {
  const nome = limparTexto(row.solicitante_nome);
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);
  const finalidade = limparTexto(row.finalidade);
  const url = montarUrlPlataforma(montarLinkInternoReserva(row.id));

  const linhas = [
    nome ? `Olá, ${nome}.` : "Olá.",
    "",
    `Sua reserva da ${sala} para o dia ${dataBr}, período ${periodo}, precisa ser confirmada.`,
    "",
    "A confirmação deve ser realizada entre 7 dias e 48 horas antes da data reservada.",
    "Caso a confirmação não seja realizada dentro do prazo, a reserva poderá ser cancelada pela Escola da Saúde, com liberação do espaço para outras atividades institucionais.",
  ];

  if (finalidade) {
    linhas.push("", `Finalidade: ${finalidade}.`);
  }

  if (url) {
    linhas.push("", `Acesse a plataforma para confirmar: ${url}`);
  }

  linhas.push(
    "",
    "Este é um aviso automático da Plataforma Escola da Saúde."
  );

  return linhas.join("\n");
}

function montarHtmlEmailSolicitacao(row) {
  const nome = limparTexto(row.solicitante_nome);
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);
  const finalidade = limparTexto(row.finalidade);
  const url = montarUrlPlataforma(montarLinkInternoReserva(row.id));

  const finalidadeHtml = finalidade
    ? `<p style="margin:0 0 10px;"><strong>Finalidade:</strong> ${escapeHtml(finalidade)}</p>`
    : "";

  const botaoHtml = url
    ? `
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(url)}"
           style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">
          Confirmar uso da sala
        </a>
      </p>
    `
    : "";

  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <div style="background:#0f766e;padding:22px 26px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;">Confirmação de uso da sala</h1>
            <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Escola da Saúde</p>
          </div>

          <div style="padding:26px;">
            <p style="margin:0 0 16px;font-size:16px;">
              ${nome ? `Olá, <strong>${escapeHtml(nome)}</strong>.` : "Olá."}
            </p>

            <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
              Sua reserva está dentro do prazo obrigatório de confirmação.
            </p>

            <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:16px;padding:18px;margin:18px 0;">
              <p style="margin:0 0 10px;"><strong>Sala:</strong> ${escapeHtml(sala)}</p>
              <p style="margin:0 0 10px;"><strong>Data:</strong> ${escapeHtml(dataBr)}</p>
              <p style="margin:0 0 10px;"><strong>Período:</strong> ${escapeHtml(periodo)}</p>
              ${finalidadeHtml}
            </div>

            <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#374151;">
              A confirmação deve ser realizada entre <strong>7 dias e 48 horas antes</strong>
              da data reservada. Caso a confirmação não seja realizada dentro do prazo,
              a reserva poderá ser cancelada pela Escola da Saúde, com liberação do espaço
              para outras atividades institucionais.
            </p>

            ${botaoHtml}

            <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:#6b7280;">
              Este é um aviso automático da Plataforma Escola da Saúde.
            </p>
          </div>
        </div>

        <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#6b7280;">
          Secretaria Municipal de Saúde — Escola da Saúde
        </p>
      </div>
    </div>
  `;
}

function montarTextoEmailCancelamento(row) {
  const nome = limparTexto(row.solicitante_nome);
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);

  return [
    nome ? `Olá, ${nome}.` : "Olá.",
    "",
    `Sua reserva da ${sala} para o dia ${dataBr}, período ${periodo}, foi cancelada por ausência de confirmação dentro do prazo institucional.`,
    "",
    "A confirmação deveria ser realizada entre 7 dias e 48 horas antes da data reservada.",
    "",
    "Em caso de dúvidas, entre em contato com a Escola da Saúde.",
  ].join("\n");
}

function montarHtmlEmailCancelamento(row) {
  const nome = limparTexto(row.solicitante_nome);
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);

  return `
    <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
          <div style="background:#991b1b;padding:22px 26px;color:#ffffff;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;">Reserva cancelada</h1>
            <p style="margin:6px 0 0;font-size:14px;opacity:.95;">Escola da Saúde</p>
          </div>

          <div style="padding:26px;">
            <p style="margin:0 0 16px;font-size:16px;">
              ${nome ? `Olá, <strong>${escapeHtml(nome)}</strong>.` : "Olá."}
            </p>

            <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
              Sua reserva foi cancelada por ausência de confirmação dentro do prazo institucional.
            </p>

            <div style="border:1px solid #fecaca;background:#fef2f2;border-radius:16px;padding:18px;margin:18px 0;">
              <p style="margin:0 0 10px;"><strong>Sala:</strong> ${escapeHtml(sala)}</p>
              <p style="margin:0 0 10px;"><strong>Data:</strong> ${escapeHtml(dataBr)}</p>
              <p style="margin:0 0 10px;"><strong>Período:</strong> ${escapeHtml(periodo)}</p>
            </div>

            <p style="margin:18px 0 0;font-size:15px;line-height:1.6;color:#374151;">
              A confirmação deveria ser realizada entre <strong>7 dias e 48 horas antes</strong>
              da data reservada. Em caso de dúvidas, entre em contato com a Escola da Saúde.
            </p>
          </div>
        </div>

        <p style="text-align:center;margin:18px 0 0;font-size:12px;color:#6b7280;">
          Secretaria Municipal de Saúde — Escola da Saúde
        </p>
      </div>
    </div>
  `;
}

/* =========================================================================
   Consultas
=========================================================================== */

async function listarReservasParaSolicitarConfirmacao(options = {}) {
  const janela = resolverJanelaConfirmacao(options);

  const limite = asPositiveInt(options.limite);

  const sql = `
    SELECT
      rs.id,
      rs.sala,
      rs.data::date AS data,
      rs.periodo,
      rs.finalidade,
      rs.qtd_pessoas,
      rs.coffee_break,
      rs.solicitante_id,
      rs.status,
      rs.confirmacao_solicitada_em,
      rs.confirmado_em,
      rs.confirmado_por,
      u.nome AS solicitante_nome,
      u.email AS solicitante_email
    FROM reservas_salas rs
    JOIN usuarios u
      ON u.id = rs.solicitante_id
    WHERE rs.status::text = $1
      AND rs.data BETWEEN $2::date AND $3::date
      AND rs.confirmado_em IS NULL
      AND rs.cancelado_em IS NULL
    ORDER BY
      rs.data ASC,
      rs.sala ASC,
      rs.periodo ASC,
      rs.id ASC
    ${limite ? `LIMIT ${limite}` : ""}
  `;

  const rows = await dbMany(sql, [
    STATUS_RESERVA.APROVADO,
    janela.data_inicio,
    janela.data_fim,
  ]);

  return {
    janela,
    rows,
  };
}

async function listarReservasVencidasSemConfirmacao(options = {}) {
  const hoje = resolverHoje(options);
  const limiteCancelamento = adicionarDiasYmd(hoje, 1);

  const limite = asPositiveInt(options.limite);

  const sql = `
    SELECT
      rs.id,
      rs.sala,
      rs.data::date AS data,
      rs.periodo,
      rs.finalidade,
      rs.qtd_pessoas,
      rs.coffee_break,
      rs.solicitante_id,
      rs.status,
      rs.confirmacao_solicitada_em,
      rs.confirmado_em,
      rs.confirmado_por,
      u.nome AS solicitante_nome,
      u.email AS solicitante_email
    FROM reservas_salas rs
    JOIN usuarios u
      ON u.id = rs.solicitante_id
    WHERE rs.status::text = $1
      AND rs.data <= $2::date
      AND rs.confirmado_em IS NULL
      AND rs.cancelado_em IS NULL
      AND rs.confirmacao_solicitada_em IS NOT NULL
    ORDER BY
      rs.data ASC,
      rs.sala ASC,
      rs.periodo ASC,
      rs.id ASC
    ${limite ? `LIMIT ${limite}` : ""}
  `;

  const rows = await dbMany(sql, [STATUS_RESERVA.APROVADO, limiteCancelamento]);

  return {
    hoje,
    limite_cancelamento: limiteCancelamento,
    rows,
  };
}

/* =========================================================================
   Controle programado
=========================================================================== */

async function registrarOuObterProgramacaoConfirmacao(row) {
  const titulo = montarTituloSolicitacao();
  const mensagem = montarMensagemSolicitacao(row);
  const emailDestino = limparTexto(row.solicitante_email, 255) || null;

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
      $5::date,
      $6,
      $7,
      $8,
      $9
    )
    ON CONFLICT (usuario_id, entidade_tipo, entidade_id, tipo, data_referencia)
    DO UPDATE SET
      titulo = EXCLUDED.titulo,
      mensagem = EXCLUDED.mensagem,
      email_destino = EXCLUDED.email_destino,
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
    row.solicitante_id,
    ENTIDADE_TIPO,
    row.id,
    TIPO_PROGRAMADO,
    somenteDataYmd(row.data),
    titulo,
    mensagem,
    emailDestino,
    STATUS_PROGRAMADO.PENDENTE,
  ]);
}

async function marcarNotificacaoCriada(programacaoId, notificacaoId) {
  await query(
    `
      UPDATE notificacoes_programadas
         SET notificacao_criada = true,
             notificacao_id = $2,
             status = CASE
                        WHEN email_enviado = true THEN $3
                        ELSE status
                      END,
             atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
    `,
    [programacaoId, notificacaoId, STATUS_PROGRAMADO.ENVIADO]
  );
}

async function marcarEmailEnviado(programacaoId) {
  await query(
    `
      UPDATE notificacoes_programadas
         SET email_enviado = true,
             email_enviado_em = CURRENT_TIMESTAMP,
             email_erro = NULL,
             status = CASE
                        WHEN notificacao_criada = true THEN $2
                        ELSE $3
                      END,
             atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
    `,
    [
      programacaoId,
      STATUS_PROGRAMADO.ENVIADO,
      STATUS_PROGRAMADO.ERRO_PARCIAL,
    ]
  );
}

async function marcarErroProgramacao(programacaoId, error, parcial = false) {
  await query(
    `
      UPDATE notificacoes_programadas
         SET status = $2,
             email_erro = $3,
             atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
    `,
    [
      programacaoId,
      parcial ? STATUS_PROGRAMADO.ERRO_PARCIAL : STATUS_PROGRAMADO.ERRO,
      String(error?.message || error || "Erro não identificado.").slice(0, 2000),
    ]
  );
}

/* =========================================================================
   Notificações internas
=========================================================================== */

async function criarNotificacaoSolicitacao(row) {
  const titulo = montarTituloSolicitacao();
  const mensagem = montarMensagemSolicitacao(row);
  const link = montarLinkInternoReserva(row.id);

  const created = await dbOne(
    `
      INSERT INTO notificacoes (
        usuario_id,
        titulo,
        mensagem,
        tipo,
        reserva_id,
        link,
        metadata,
        lida,
        criado_em
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        false,
        CURRENT_TIMESTAMP
      )
      RETURNING id
    `,
    [
      row.solicitante_id,
      titulo,
      mensagem,
      TIPO_NOTIFICACAO_SOLICITACAO,
      row.id,
      link,
      JSON.stringify({
        sala: row.sala,
        data: somenteDataYmd(row.data),
        periodo: row.periodo,
        acao: "confirmar_uso_sala",
      }),
    ]
  );

  return created?.id || null;
}

async function criarNotificacaoConfirmada(row) {
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);

  await query(
    `
      INSERT INTO notificacoes (
        usuario_id,
        titulo,
        mensagem,
        tipo,
        reserva_id,
        link,
        metadata,
        lida,
        criado_em
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        false,
        CURRENT_TIMESTAMP
      )
    `,
    [
      row.solicitante_id,
      "Uso da sala confirmado",
      `O uso da ${sala} para o dia ${dataBr}, período ${periodo}, foi confirmado com sucesso.`,
      TIPO_NOTIFICACAO_CONFIRMADA,
      row.id,
      montarLinkInternoReserva(row.id),
      JSON.stringify({
        sala: row.sala,
        data: somenteDataYmd(row.data),
        periodo: row.periodo,
        acao: "uso_sala_confirmado",
      }),
    ]
  );
}

async function criarNotificacaoCancelamento(row) {
  const sala = labelSala(row.sala);
  const dataBr = formatarDataBr(row.data);
  const periodo = labelPeriodo(row.periodo);

  await query(
    `
      INSERT INTO notificacoes (
        usuario_id,
        titulo,
        mensagem,
        tipo,
        reserva_id,
        link,
        metadata,
        lida,
        criado_em
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        false,
        CURRENT_TIMESTAMP
      )
    `,
    [
      row.solicitante_id,
      "Reserva cancelada por falta de confirmação",
      `Sua reserva da ${sala} para o dia ${dataBr}, período ${periodo}, foi cancelada por ausência de confirmação dentro do prazo.`,
      TIPO_NOTIFICACAO_CANCELADA,
      row.id,
      montarLinkInternoReserva(row.id),
      JSON.stringify({
        sala: row.sala,
        data: somenteDataYmd(row.data),
        periodo: row.periodo,
        acao: "reserva_cancelada_sem_confirmacao",
      }),
    ]
  );
}

/* =========================================================================
   E-mails
=========================================================================== */

async function enviarEmailSolicitacao(row) {
  const email = limparTexto(row.solicitante_email, 255);

  if (!email) {
    const error = new Error("Usuário sem e-mail cadastrado.");
    error.code = "EMAIL_DESTINO_AUSENTE";
    throw error;
  }

  return sendEmail({
    to: email,
    subject: "Confirmação obrigatória de uso da sala",
    html: montarHtmlEmailSolicitacao(row),
    text: montarTextoEmailSolicitacao(row),
    headers: {
      "X-Escola-Saude-Tipo": TIPO_PROGRAMADO,
      "X-Escola-Saude-Reserva-Id": String(row.id),
    },
  });
}

async function enviarEmailCancelamento(row) {
  const email = limparTexto(row.solicitante_email, 255);

  if (!email) {
    return null;
  }

  return sendEmail({
    to: email,
    subject: "Reserva cancelada por falta de confirmação",
    html: montarHtmlEmailCancelamento(row),
    text: montarTextoEmailCancelamento(row),
    headers: {
      "X-Escola-Saude-Tipo": "cancelamento_sem_confirmacao_sala",
      "X-Escola-Saude-Reserva-Id": String(row.id),
    },
  });
}

/* =========================================================================
   Processamento: solicitação de confirmação
=========================================================================== */

async function processarSolicitacaoConfirmacao(row, options = {}) {
  const dryRun = !!options.dryRun;
  const base = montarResumoReserva(row);

  if (dryRun) {
    return {
      ...base,
      dryRun: true,
      acao: "diagnostico",
      titulo: montarTituloSolicitacao(),
      mensagem: montarMensagemSolicitacao(row),
      email_subject: "Confirmação obrigatória de uso da sala",
    };
  }

  const programacao = await registrarOuObterProgramacaoConfirmacao(row);

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
    programacao.status === STATUS_PROGRAMADO.ENVIADO;

  if (jaCompleto) {
    return {
      ...base,
      programacao_id: programacao.id,
      acao: "ignorado",
      status: STATUS_PROGRAMADO.ENVIADO,
      motivo: "Solicitação de confirmação já enviada anteriormente.",
    };
  }

  let notificacaoId = programacao.notificacao_id || null;
  let notificacaoCriada = programacao.notificacao_criada === true;
  let emailEnviado = programacao.email_enviado === true;

  try {
    if (!notificacaoCriada) {
      notificacaoId = await criarNotificacaoSolicitacao(row);
      await marcarNotificacaoCriada(programacao.id, notificacaoId);
      notificacaoCriada = true;
    }

    if (!emailEnviado) {
      await enviarEmailSolicitacao(row);
      await marcarEmailEnviado(programacao.id);
      emailEnviado = true;
    }

    await query(
      `
        UPDATE reservas_salas
           SET confirmacao_solicitada_em = COALESCE(confirmacao_solicitada_em, NOW()),
               updated_at = NOW()
         WHERE id = $1
      `,
      [row.id]
    );

    return {
      ...base,
      programacao_id: programacao.id,
      notificacao_id: notificacaoId,
      acao: "enviado",
      status: STATUS_PROGRAMADO.ENVIADO,
      notificacao_criada: notificacaoCriada,
      email_enviado: emailEnviado,
    };
  } catch (error) {
    const parcial = notificacaoCriada || emailEnviado;

    await marcarErroProgramacao(programacao.id, error, parcial);

    console.error("[confirmacaoUsoSalaService.processarSolicitacaoConfirmacao] ERRO", {
      message: error?.message,
      code: error?.code,
      reserva_id: row.id,
      usuario_id: row.solicitante_id,
      programacao_id: programacao.id,
    });

    return {
      ...base,
      programacao_id: programacao.id,
      notificacao_id: notificacaoId,
      acao: "erro",
      status: parcial ? STATUS_PROGRAMADO.ERRO_PARCIAL : STATUS_PROGRAMADO.ERRO,
      notificacao_criada: notificacaoCriada,
      email_enviado: emailEnviado,
      erro: error?.message || "Erro ao solicitar confirmação de uso da sala.",
      erro_code: error?.code || null,
    };
  }
}

async function executarSolicitacoesConfirmacaoUsoSala(options = {}) {
  const dryRun = !!options.dryRun;

  const { janela, rows } = await listarReservasParaSolicitarConfirmacao(options);

  const resultados = [];

  for (const row of rows) {
    // Execução sequencial: evita rajada SMTP e facilita auditoria.
    // eslint-disable-next-line no-await-in-loop
    const resultado = await processarSolicitacaoConfirmacao(row, { dryRun });
    resultados.push(resultado);
  }

  const resumo = resultados.reduce(
    (acc, item) => {
      acc.total += 1;

      if (item.acao === "diagnostico") acc.diagnostico += 1;
      if (item.acao === "enviado") acc.enviados += 1;
      if (item.acao === "ignorado") acc.ignorados += 1;
      if (item.acao === "erro") acc.erros += 1;
      if (item.status === STATUS_PROGRAMADO.ERRO_PARCIAL) acc.erros_parciais += 1;

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
      ? "SALA-CONFIRMACAO-USO-DIAGNOSTICO-OK"
      : "SALA-CONFIRMACAO-USO-EXECUCAO-OK",
    message: dryRun
      ? "Diagnóstico das solicitações de confirmação de uso de sala concluído."
      : "Solicitações de confirmação de uso de sala processadas.",
    data: {
      dryRun,
      janela,
      resumo,
      itens: resultados,
    },
    meta: {
      entidade_tipo: ENTIDADE_TIPO,
      tipo_programado: TIPO_PROGRAMADO,
      timezone: options.timezone || TIMEZONE_OFICIAL,
    },
  };
}

async function diagnosticarSolicitacoesConfirmacaoUsoSala(options = {}) {
  return executarSolicitacoesConfirmacaoUsoSala({
    ...options,
    dryRun: true,
  });
}

/* =========================================================================
   Confirmação pelo usuário
=========================================================================== */

async function confirmarUsoReservaSala({ reservaId, usuarioId, hoje = null } = {}) {
  const reservaIdStr = asPositiveBigIntString(reservaId);
  const userId = asPositiveInt(usuarioId);
  const hojeYmd = hoje ? somenteDataYmd(hoje) : hojeYmdEmTimezone();

  if (!reservaIdStr) {
    const error = new Error("ID da reserva inválido.");
    error.code = "RESERVA_ID_INVALIDO";
    error.httpStatus = 400;
    throw error;
  }

  if (!userId) {
    const error = new Error("Usuário não autenticado.");
    error.code = "USUARIO_NAO_AUTENTICADO";
    error.httpStatus = 401;
    throw error;
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const atualResult = await client.query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.finalidade,
          rs.solicitante_id,
          rs.status,
          rs.confirmacao_solicitada_em,
          rs.confirmado_em,
          rs.confirmado_por,
          rs.cancelado_em,
          u.nome AS solicitante_nome,
          u.email AS solicitante_email
        FROM reservas_salas rs
        JOIN usuarios u ON u.id = rs.solicitante_id
        WHERE rs.id = $1
        FOR UPDATE
      `,
      [reservaIdStr]
    );

    const atual = atualResult.rows?.[0];

    if (!atual) {
      const error = new Error("Reserva não encontrada.");
      error.code = "RESERVA_NAO_ENCONTRADA";
      error.httpStatus = 404;
      throw error;
    }

    if (Number(atual.solicitante_id) !== Number(userId)) {
      const error = new Error("Você não pode confirmar o uso desta reserva.");
      error.code = "RESERVA_SEM_PERMISSAO";
      error.httpStatus = 403;
      throw error;
    }

    if (String(atual.status) !== STATUS_RESERVA.APROVADO) {
      const error = new Error("Apenas reservas aprovadas podem ter uso confirmado.");
      error.code = "RESERVA_NAO_APROVADA";
      error.httpStatus = 400;
      throw error;
    }

    if (atual.cancelado_em) {
      const error = new Error("Esta reserva já foi cancelada.");
      error.code = "RESERVA_CANCELADA";
      error.httpStatus = 400;
      throw error;
    }

    if (atual.confirmado_em) {
      await client.query("COMMIT");

      return {
        reserva: montarResumoReserva(atual),
        ja_confirmada: true,
      };
    }

    if (!estaNaJanelaConfirmacao(atual.data, hojeYmd)) {
      const error = new Error(
        "A confirmação de uso deve ser realizada entre 7 dias e 48 horas antes da data reservada."
      );
      error.code = jaPassouPrazoConfirmacao(atual.data, hojeYmd)
        ? "PRAZO_CONFIRMACAO_ENCERRADO"
        : "PRAZO_CONFIRMACAO_NAO_INICIADO";
      error.httpStatus = 400;
      throw error;
    }

    const atualizadoResult = await client.query(
      `
        UPDATE reservas_salas
           SET confirmado_em = NOW(),
               confirmado_por = $2,
               updated_at = NOW()
         WHERE id = $1
         RETURNING
           id,
           sala,
           data::date AS data,
           periodo,
           finalidade,
           solicitante_id,
           status,
           confirmacao_solicitada_em,
           confirmado_em,
           confirmado_por
      `,
      [reservaIdStr, userId]
    );

    const reserva = atualizadoResult.rows?.[0];

    await client.query("COMMIT");

    await criarNotificacaoConfirmada({
      ...reserva,
      solicitante_nome: atual.solicitante_nome,
      solicitante_email: atual.solicitante_email,
    });

    return {
      reserva: montarResumoReserva({
        ...reserva,
        solicitante_nome: atual.solicitante_nome,
        solicitante_email: atual.solicitante_email,
      }),
      ja_confirmada: false,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release?.();
  }
}

/* =========================================================================
   Cancelamento por ausência de confirmação
=========================================================================== */

async function processarCancelamentoSemConfirmacao(row, options = {}) {
  const dryRun = !!options.dryRun;
  const base = montarResumoReserva(row);

  if (dryRun) {
    return {
      ...base,
      dryRun: true,
      acao: "diagnostico_cancelamento",
      motivo_cancelamento: MOTIVO_CANCELAMENTO_PADRAO,
    };
  }

  const client = await getClient();

  try {
    await client.query("BEGIN");

    const atualResult = await client.query(
      `
        SELECT
          rs.id,
          rs.sala,
          rs.data::date AS data,
          rs.periodo,
          rs.finalidade,
          rs.solicitante_id,
          rs.status,
          rs.confirmacao_solicitada_em,
          rs.confirmado_em,
          rs.confirmado_por,
          rs.cancelado_em,
          u.nome AS solicitante_nome,
          u.email AS solicitante_email
        FROM reservas_salas rs
        JOIN usuarios u ON u.id = rs.solicitante_id
        WHERE rs.id = $1
        FOR UPDATE
      `,
      [row.id]
    );

    const atual = atualResult.rows?.[0];

    if (!atual) {
      await client.query("ROLLBACK");

      return {
        ...base,
        acao: "ignorado",
        motivo: "Reserva não encontrada.",
      };
    }

    if (
      String(atual.status) !== STATUS_RESERVA.APROVADO ||
      atual.confirmado_em ||
      atual.cancelado_em
    ) {
      await client.query("ROLLBACK");

      return {
        ...base,
        acao: "ignorado",
        motivo: "Reserva não está mais apta a cancelamento automático.",
      };
    }

    const atualizadoResult = await client.query(
      `
        UPDATE reservas_salas
           SET status = $2,
               cancelado_em = NOW(),
               cancelado_por = NULL,
               motivo_cancelamento = $3,
               updated_at = NOW()
         WHERE id = $1
         RETURNING
           id,
           sala,
           data::date AS data,
           periodo,
           finalidade,
           solicitante_id,
           status,
           confirmacao_solicitada_em,
           confirmado_em,
           confirmado_por,
           cancelado_em,
           cancelado_por,
           motivo_cancelamento
      `,
      [row.id, STATUS_RESERVA.CANCELADO, MOTIVO_CANCELAMENTO_PADRAO]
    );

    const reserva = atualizadoResult.rows?.[0];

    await client.query("COMMIT");

    const payloadNotificacao = {
      ...reserva,
      solicitante_nome: atual.solicitante_nome,
      solicitante_email: atual.solicitante_email,
    };

    await criarNotificacaoCancelamento(payloadNotificacao);

    try {
      await enviarEmailCancelamento(payloadNotificacao);
    } catch (emailError) {
      console.warn("[confirmacaoUsoSalaService] Falha ao enviar e-mail de cancelamento.", {
        reserva_id: row.id,
        message: emailError?.message,
        code: emailError?.code,
      });
    }

    return {
      ...montarResumoReserva(payloadNotificacao),
      acao: "cancelado",
      motivo_cancelamento: MOTIVO_CANCELAMENTO_PADRAO,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error("[confirmacaoUsoSalaService.processarCancelamentoSemConfirmacao] ERRO", {
      message: error?.message,
      code: error?.code,
      reserva_id: row.id,
      usuario_id: row.solicitante_id,
    });

    return {
      ...base,
      acao: "erro",
      erro: error?.message || "Erro ao cancelar reserva sem confirmação.",
      erro_code: error?.code || null,
    };
  } finally {
    client.release?.();
  }
}

async function executarCancelamentosSemConfirmacaoUsoSala(options = {}) {
  const dryRun = !!options.dryRun;

  const { hoje, limite_cancelamento, rows } =
    await listarReservasVencidasSemConfirmacao(options);

  const resultados = [];

  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const resultado = await processarCancelamentoSemConfirmacao(row, { dryRun });
    resultados.push(resultado);
  }

  const resumo = resultados.reduce(
    (acc, item) => {
      acc.total += 1;

      if (item.acao === "diagnostico_cancelamento") acc.diagnostico += 1;
      if (item.acao === "cancelado") acc.cancelados += 1;
      if (item.acao === "ignorado") acc.ignorados += 1;
      if (item.acao === "erro") acc.erros += 1;

      return acc;
    },
    {
      total: 0,
      diagnostico: 0,
      cancelados: 0,
      ignorados: 0,
      erros: 0,
    }
  );

  return {
    ok: true,
    code: dryRun
      ? "SALA-CANCELAMENTO-SEM-CONFIRMACAO-DIAGNOSTICO-OK"
      : "SALA-CANCELAMENTO-SEM-CONFIRMACAO-EXECUCAO-OK",
    message: dryRun
      ? "Diagnóstico de cancelamentos por falta de confirmação concluído."
      : "Cancelamentos por falta de confirmação processados.",
    data: {
      dryRun,
      hoje,
      limite_cancelamento,
      resumo,
      itens: resultados,
    },
    meta: {
      timezone: options.timezone || TIMEZONE_OFICIAL,
    },
  };
}

async function diagnosticarCancelamentosSemConfirmacaoUsoSala(options = {}) {
  return executarCancelamentosSemConfirmacaoUsoSala({
    ...options,
    dryRun: true,
  });
}

/* =========================================================================
   Export oficial
=========================================================================== */

module.exports = {
  executarSolicitacoesConfirmacaoUsoSala,
  diagnosticarSolicitacoesConfirmacaoUsoSala,
  confirmarUsoReservaSala,

  executarCancelamentosSemConfirmacaoUsoSala,
  diagnosticarCancelamentosSemConfirmacaoUsoSala,

  listarReservasParaSolicitarConfirmacao,
  listarReservasVencidasSemConfirmacao,

  _internals: {
    resolverJanelaConfirmacao,
    estaNaJanelaConfirmacao,
    jaPassouPrazoConfirmacao,
    montarMensagemSolicitacao,
    montarTextoEmailSolicitacao,
    montarHtmlEmailSolicitacao,
    adicionarDiasYmd,
    hojeYmdEmTimezone,
  },
};