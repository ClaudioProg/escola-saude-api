/* eslint-disable no-console */
"use strict";

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;

/* =========================
   Helpers
========================= */

function normalizeNullableString(value, maxLength = null) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLength ? text.slice(0, maxLength) : text;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["true", "1", "sim", "on"].includes(v)) return true;
    if (["false", "0", "nao", "não", "off"].includes(v)) return false;
  }

  if (typeof value === "number") return value === 1;

  return fallback;
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeTipoExibicao(value) {
  return value === "comunicado" ? "comunicado" : "destaque";
}

function normalizeDateOnly(value) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  return text;
}

function validatePeriodo(dataInicio, dataFim) {
  if (!dataInicio) throw new Error("Data inicial inválida.");
  if (!dataFim) throw new Error("Data final inválida.");
  if (dataFim < dataInicio) throw new Error("Período inválido.");
}

function logError(context, error) {
  console.error("[informacoes][service][erro]", {
    context,
    error: error?.message,
    stack: error?.stack
  });
}

/* =========================
   Mapper
========================= */

function mapRow(row) {
  const hoje = new Date().toISOString().slice(0, 10);

  let status = "inativa";

  if (row.ativo) {
    if (hoje < row.data_inicio_exibicao) status = "agendada";
    else if (hoje > row.data_fim_exibicao) status = "expirada";
    else status = "ativa";
  }

  return {
    id: row.id,
    titulo: row.titulo,
    subtitulo: row.subtitulo,
    badge: row.badge,
    resumo: row.resumo,
    conteudo_html: row.conteudo_html,
    tipo_exibicao: row.tipo_exibicao,
    imagem_url: row.imagem_url,
    imagem_nome_original: row.imagem_nome_original,
    imagem_mime_type: row.imagem_mime_type,
    imagem_tamanho_bytes: row.imagem_tamanho_bytes,
    ativo: row.ativo,
    ordem: row.ordem,
    data_inicio_exibicao: row.data_inicio_exibicao,
    data_fim_exibicao: row.data_fim_exibicao,
    criado_por: row.criado_por,
    atualizado_por: row.atualizado_por,
    criado_em: row.criado_em,
    atualizado_em: row.atualizado_em,
    status
  };
}

/* =========================
   LISTAGENS
========================= */

async function listarInformacoesAdmin() {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        titulo,
        subtitulo,
        badge,
        resumo,
        conteudo_html,
        tipo_exibicao,
        imagem_url,
        imagem_nome_original,
        imagem_mime_type,
        imagem_tamanho_bytes,
        ativo,
        ordem,
        data_inicio_exibicao::text,
        data_fim_exibicao::text,
        criado_por,
        atualizado_por,
        criado_em,
        atualizado_em
      FROM informacoes_institucionais
      ORDER BY ordem ASC, criado_em DESC
    `);

    return rows.map(mapRow);
  } catch (error) {
    logError("listarInformacoesAdmin", error);
    throw error;
  }
}

async function listarInformacoesPublicadas() {
  try {
    const { rows } = await db.query(`
      SELECT
        id,
        titulo,
        subtitulo,
        badge,
        resumo,
        conteudo_html,
        tipo_exibicao,
        imagem_url,
        ativo,
        ordem,
        data_inicio_exibicao::text,
        data_fim_exibicao::text,
        criado_em
      FROM informacoes_institucionais
      WHERE ativo = TRUE
        AND CURRENT_DATE BETWEEN data_inicio_exibicao AND data_fim_exibicao
      ORDER BY ordem ASC, criado_em DESC
    `);

    return rows.map(mapRow);
  } catch (error) {
    logError("listarInformacoesPublicadas", error);
    throw error;
  }
}

/* =========================
   BUSCA
========================= */

async function buscarInformacaoPorId(id) {
  try {
    const { rows } = await db.query(
      `
      SELECT
        *
      FROM informacoes_institucionais
      WHERE id = $1
      LIMIT 1
    `,
      [id]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  } catch (error) {
    logError("buscarInformacaoPorId", error);
    throw error;
  }
}

/* =========================
   CREATE
========================= */

async function criarInformacao(payload) {
  try {
    const titulo = normalizeNullableString(payload.titulo, 200);
    const conteudoHtml = normalizeNullableString(payload.conteudo_html);
    const dataInicio = normalizeDateOnly(payload.data_inicio_exibicao);
    const dataFim = normalizeDateOnly(payload.data_fim_exibicao);

    if (!titulo) throw new Error("Título é obrigatório.");
    if (!conteudoHtml) throw new Error("Conteúdo é obrigatório.");

    validatePeriodo(dataInicio, dataFim);

    const { rows } = await db.query(
      `
      INSERT INTO informacoes_institucionais (
        titulo,
        subtitulo,
        badge,
        resumo,
        conteudo_html,
        tipo_exibicao,
        imagem_url,
        imagem_nome_original,
        imagem_mime_type,
        imagem_tamanho_bytes,
        ativo,
        ordem,
        data_inicio_exibicao,
        data_fim_exibicao,
        criado_por,
        atualizado_por
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$15
      )
      RETURNING id
    `,
      [
        titulo,
        normalizeNullableString(payload.subtitulo, 300),
        normalizeNullableString(payload.badge, 100),
        normalizeNullableString(payload.resumo, 500),
        conteudoHtml,
        normalizeTipoExibicao(payload.tipo_exibicao),
        normalizeNullableString(payload.imagem_url),
        normalizeNullableString(payload.imagem_nome_original, 255),
        normalizeNullableString(payload.imagem_mime_type, 120),
        payload.imagem_tamanho_bytes || null,
        normalizeBoolean(payload.ativo, true),
        normalizeInteger(payload.ordem, 0),
        dataInicio,
        dataFim,
        payload.criado_por ?? null
      ]
    );

    return buscarInformacaoPorId(rows[0].id);
  } catch (error) {
    logError("criarInformacao", error);
    throw error;
  }
}

/* =========================
   UPDATE
========================= */

async function atualizarInformacao(id, payload) {
  try {
    const atual = await buscarInformacaoPorId(id);
    if (!atual) return null;

    const dataInicio =
      payload.data_inicio_exibicao !== undefined
        ? normalizeDateOnly(payload.data_inicio_exibicao)
        : atual.data_inicio_exibicao;

    const dataFim =
      payload.data_fim_exibicao !== undefined
        ? normalizeDateOnly(payload.data_fim_exibicao)
        : atual.data_fim_exibicao;

    validatePeriodo(dataInicio, dataFim);

    await db.query(
      `
      UPDATE informacoes_institucionais
      SET
        titulo = $1,
        subtitulo = $2,
        badge = $3,
        resumo = $4,
        conteudo_html = $5,
        tipo_exibicao = $6,
        imagem_url = $7,
        imagem_nome_original = $8,
        imagem_mime_type = $9,
        imagem_tamanho_bytes = $10,
        ativo = $11,
        ordem = $12,
        data_inicio_exibicao = $13,
        data_fim_exibicao = $14,
        atualizado_por = $15
      WHERE id = $16
    `,
      [
        normalizeNullableString(payload.titulo, 200) ?? atual.titulo,
        normalizeNullableString(payload.subtitulo, 300),
        normalizeNullableString(payload.badge, 100),
        normalizeNullableString(payload.resumo, 500),
        normalizeNullableString(payload.conteudo_html),
        normalizeTipoExibicao(payload.tipo_exibicao),
        normalizeNullableString(payload.imagem_url),
        normalizeNullableString(payload.imagem_nome_original, 255),
        normalizeNullableString(payload.imagem_mime_type, 120),
        payload.imagem_tamanho_bytes || null,
        normalizeBoolean(payload.ativo, atual.ativo),
        normalizeInteger(payload.ordem, atual.ordem),
        dataInicio,
        dataFim,
        payload.atualizado_por ?? null,
        id
      ]
    );

    return buscarInformacaoPorId(id);
  } catch (error) {
    logError("atualizarInformacao", error);
    throw error;
  }
}

/* =========================
   ATIVO
========================= */

async function atualizarAtivoInformacao(id, ativo, atualizadoPor = null) {
  try {
    const { rowCount } = await db.query(
      `
      UPDATE informacoes_institucionais
      SET ativo = $1, atualizado_por = $2
      WHERE id = $3
    `,
      [!!ativo, atualizadoPor, id]
    );

    if (!rowCount) return null;
    return buscarInformacaoPorId(id);
  } catch (error) {
    logError("atualizarAtivoInformacao", error);
    throw error;
  }
}

/* =========================
   DELETE
========================= */

async function excluirInformacao(id) {
  try {
    const atual = await buscarInformacaoPorId(id);
    if (!atual) return null;

    await db.query(
      `DELETE FROM informacoes_institucionais WHERE id = $1`,
      [id]
    );

    return atual;
  } catch (error) {
    logError("excluirInformacao", error);
    throw error;
  }
}

/* =========================
   EXPORT
========================= */

module.exports = {
  listarInformacoesAdmin,
  listarInformacoesPublicadas,
  buscarInformacaoPorId,
  criarInformacao,
  atualizarInformacao,
  atualizarAtivoInformacao,
  excluirInformacao
};