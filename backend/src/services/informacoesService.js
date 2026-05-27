/* eslint-disable no-console */
"use strict";

/**
 * ✅ src/services/informacoesService.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Gerenciar informações institucionais exibidas na plataforma.
 *
 * Contrato oficial:
 * - db exportado diretamente por src/db/index.js
 * - db.many
 * - db.oneOrNone
 * - db.result
 * - db.none
 *
 * Observações:
 * - Tabela física atual: informacoes_institucionais.
 * - Imagem pode ser persistida no banco.
 * - Datas são tratadas como date-only.
 */

const db = require("../db");

/* =========================
   Config / Constantes
========================= */

const IS_DEV = process.env.NODE_ENV !== "production";
const TZ = "America/Sao_Paulo";

const TIPO_EXIBICAO = new Set(["destaque", "comunicado"]);

const SELECT_BASE = `
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
  data_inicio_exibicao::text AS data_inicio_exibicao,
  data_fim_exibicao::text AS data_fim_exibicao,
  criado_por,
  atualizado_por,
  criado_em,
  atualizado_em
`;

/* =========================
   Logs
========================= */

function logInfo(context, extra) {
  if (IS_DEV) {
    console.log("[informacao][service]", context, extra || "");
  }
}

function logError(context, error, extra) {
  console.error("[informacao][service][erro]", {
    context,
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
    ...(extra || {}),
  });
}

/* =========================
   Helpers
========================= */

function toPositiveIntOrNull(value) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizeNullableString(value, maxLength = null) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  return maxLength ? text.slice(0, maxLength) : text;
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "sim", "s", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "nao", "não", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return fallback;
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeTipoExibicao(value, fallback = "destaque") {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return TIPO_EXIBICAO.has(normalized) ? normalized : fallback;
}

function normalizeDateOnly(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  return text;
}

function validatePeriodo(dataInicio, dataFim) {
  if (!dataInicio) {
    throw new Error("Data inicial inválida.");
  }

  if (!dataFim) {
    throw new Error("Data final inválida.");
  }

  if (dataFim < dataInicio) {
    throw new Error("Período inválido.");
  }
}

function resolveNextStringField(payload, key, currentValue, maxLength = null) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  return normalizeNullableString(payload[key], maxLength);
}

function resolveNextBooleanField(payload, key, currentValue) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  return normalizeBoolean(payload[key], currentValue);
}

function resolveNextIntegerField(payload, key, currentValue) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  return normalizeInteger(payload[key], currentValue);
}

function resolveNextTipoExibicao(payload, key, currentValue) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  return normalizeTipoExibicao(payload[key], currentValue);
}

function resolveNextDateOnly(payload, key, currentValue) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  const normalized = normalizeDateOnly(payload[key]);

  if (!normalized) {
    throw new Error(`${key} inválida.`);
  }

  return normalized;
}

function resolveNextNullableNumber(payload, key, currentValue) {
  if (!Object.prototype.hasOwnProperty.call(payload, key)) {
    return currentValue;
  }

  const value = payload[key];

  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${key} inválido.`);
  }

  return Math.trunc(number);
}

function getTodayDateOnlyInSaoPaulo() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

/* =========================
   Mapper
========================= */

function mapRow(row) {
  if (!row) {
    return null;
  }

  const hoje = getTodayDateOnlyInSaoPaulo();

  let status = "inativa";

  if (row.ativo) {
    if (row.data_inicio_exibicao && hoje < row.data_inicio_exibicao) {
      status = "agendada";
    } else if (row.data_fim_exibicao && hoje > row.data_fim_exibicao) {
      status = "expirada";
    } else {
      status = "ativa";
    }
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
    status,
  };
}

/* =========================
   Listagens
========================= */

async function listarInformacaoAdmin() {
  try {
    const rows = await db.many(
      `
        SELECT
          ${SELECT_BASE}
        FROM informacoes_institucionais
        ORDER BY ordem ASC, criado_em DESC, id DESC
      `
    );

    const data = rows.map(mapRow);

    logInfo("listarInformacaoAdmin:ok", {
      total: data.length,
    });

    return data;
  } catch (error) {
    logError("listarInformacaoAdmin", error);
    throw error;
  }
}

async function listarInformacaoPublicada() {
  try {
    const rows = await db.many(
      `
        SELECT
          ${SELECT_BASE}
        FROM informacoes_institucionais
        WHERE ativo = TRUE
          AND CURRENT_DATE BETWEEN data_inicio_exibicao AND data_fim_exibicao
        ORDER BY ordem ASC, criado_em DESC, id DESC
      `
    );

    const data = rows.map(mapRow);

    logInfo("listarInformacaoPublicada:ok", {
      total: data.length,
    });

    return data;
  } catch (error) {
    logError("listarInformacaoPublicada", error);
    throw error;
  }
}

/* =========================
   Busca
========================= */

async function buscarInformacaoPorId(id) {
  try {
    const informacaoId = toPositiveIntOrNull(id);

    if (!informacaoId) {
      return null;
    }

    const row = await db.oneOrNone(
      `
        SELECT
          ${SELECT_BASE}
        FROM informacoes_institucionais
        WHERE id = $1
        LIMIT 1
      `,
      [informacaoId]
    );

    return row ? mapRow(row) : null;
  } catch (error) {
    logError("buscarInformacaoPorId", error, { id });
    throw error;
  }
}

/* =========================
   Create
========================= */

async function criarInformacao(payload = {}) {
  try {
    const titulo = normalizeNullableString(payload.titulo, 200);
    const subtitulo = normalizeNullableString(payload.subtitulo, 300);
    const badge = normalizeNullableString(payload.badge, 100);
    const resumo = normalizeNullableString(payload.resumo, 500);
    const conteudoHtml = normalizeNullableString(payload.conteudo_html);
    const tipoExibicao = normalizeTipoExibicao(payload.tipo_exibicao, "destaque");
    const imagemUrl = normalizeNullableString(payload.imagem_url);
    const imagemNomeOriginal = normalizeNullableString(
      payload.imagem_nome_original,
      255
    );
    const imagemMimeType = normalizeNullableString(
      payload.imagem_mime_type,
      120
    );
    const imagemTamanhoBytes = resolveNextNullableNumber(
      { imagem_tamanho_bytes: payload.imagem_tamanho_bytes },
      "imagem_tamanho_bytes",
      null
    );
    const ativo = normalizeBoolean(payload.ativo, true);
    const ordem = normalizeInteger(payload.ordem, 0);
    const dataInicio = normalizeDateOnly(payload.data_inicio_exibicao);
    const dataFim = normalizeDateOnly(payload.data_fim_exibicao);
    const criadoPor = toPositiveIntOrNull(payload.criado_por);

    if (!titulo) {
      throw new Error("Título é obrigatório.");
    }

    if (!conteudoHtml) {
      throw new Error("Conteúdo é obrigatório.");
    }

    validatePeriodo(dataInicio, dataFim);

    const created = await db.one(
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
        subtitulo,
        badge,
        resumo,
        conteudoHtml,
        tipoExibicao,
        imagemUrl,
        imagemNomeOriginal,
        imagemMimeType,
        imagemTamanhoBytes,
        ativo,
        ordem,
        dataInicio,
        dataFim,
        criadoPor,
      ]
    );

    const informacao = await buscarInformacaoPorId(created.id);

    logInfo("criarInformacao:ok", {
      id: created.id,
      titulo,
      tipo_exibicao: tipoExibicao,
      ativo,
    });

    return informacao;
  } catch (error) {
    logError("criarInformacao", error, {
      titulo: payload?.titulo,
    });
    throw error;
  }
}

/* =========================
   Update
========================= */

async function atualizarInformacao(id, payload = {}) {
  try {
    const informacaoId = toPositiveIntOrNull(id);

    if (!informacaoId) {
      return null;
    }

    const atual = await buscarInformacaoPorId(informacaoId);

    if (!atual) {
      return null;
    }

    const proximo = {
      titulo: resolveNextStringField(payload, "titulo", atual.titulo, 200),
      subtitulo: resolveNextStringField(payload, "subtitulo", atual.subtitulo, 300),
      badge: resolveNextStringField(payload, "badge", atual.badge, 100),
      resumo: resolveNextStringField(payload, "resumo", atual.resumo, 500),
      conteudo_html: resolveNextStringField(
        payload,
        "conteudo_html",
        atual.conteudo_html
      ),
      tipo_exibicao: resolveNextTipoExibicao(
        payload,
        "tipo_exibicao",
        atual.tipo_exibicao
      ),
      imagem_url: resolveNextStringField(payload, "imagem_url", atual.imagem_url),
      imagem_nome_original: resolveNextStringField(
        payload,
        "imagem_nome_original",
        atual.imagem_nome_original,
        255
      ),
      imagem_mime_type: resolveNextStringField(
        payload,
        "imagem_mime_type",
        atual.imagem_mime_type,
        120
      ),
      imagem_tamanho_bytes: resolveNextNullableNumber(
        payload,
        "imagem_tamanho_bytes",
        atual.imagem_tamanho_bytes
      ),
      ativo: resolveNextBooleanField(payload, "ativo", atual.ativo),
      ordem: resolveNextIntegerField(payload, "ordem", atual.ordem),
      data_inicio_exibicao: resolveNextDateOnly(
        payload,
        "data_inicio_exibicao",
        atual.data_inicio_exibicao
      ),
      data_fim_exibicao: resolveNextDateOnly(
        payload,
        "data_fim_exibicao",
        atual.data_fim_exibicao
      ),
      atualizado_por: Object.prototype.hasOwnProperty.call(
        payload,
        "atualizado_por"
      )
        ? toPositiveIntOrNull(payload.atualizado_por)
        : atual.atualizado_por,
    };

    if (!proximo.titulo) {
      throw new Error("Título é obrigatório.");
    }

    if (!proximo.conteudo_html) {
      throw new Error("Conteúdo é obrigatório.");
    }

    validatePeriodo(proximo.data_inicio_exibicao, proximo.data_fim_exibicao);

    await db.none(
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
          atualizado_por = $15,
          atualizado_em = NOW()
        WHERE id = $16
      `,
      [
        proximo.titulo,
        proximo.subtitulo,
        proximo.badge,
        proximo.resumo,
        proximo.conteudo_html,
        proximo.tipo_exibicao,
        proximo.imagem_url,
        proximo.imagem_nome_original,
        proximo.imagem_mime_type,
        proximo.imagem_tamanho_bytes,
        proximo.ativo,
        proximo.ordem,
        proximo.data_inicio_exibicao,
        proximo.data_fim_exibicao,
        proximo.atualizado_por,
        informacaoId,
      ]
    );

    const informacao = await buscarInformacaoPorId(informacaoId);

    logInfo("atualizarInformacao:ok", {
      id: informacaoId,
      titulo: informacao?.titulo,
      tipo_exibicao: informacao?.tipo_exibicao,
      ativo: informacao?.ativo,
    });

    return informacao;
  } catch (error) {
    logError("atualizarInformacao", error, { id });
    throw error;
  }
}

/* =========================
   Ativo
========================= */

async function atualizarAtivoInformacao(id, ativo, atualizadoPor = null) {
  try {
    const informacaoId = toPositiveIntOrNull(id);

    if (!informacaoId) {
      return null;
    }

    const result = await db.result(
      `
        UPDATE informacoes_institucionais
        SET
          ativo = $1,
          atualizado_por = $2,
          atualizado_em = NOW()
        WHERE id = $3
      `,
      [normalizeBoolean(ativo, false), toPositiveIntOrNull(atualizadoPor), informacaoId]
    );

    if (!result.rowCount) {
      return null;
    }

    const informacao = await buscarInformacaoPorId(informacaoId);

    logInfo("atualizarAtivoInformacao:ok", {
      id: informacaoId,
      ativo: informacao?.ativo,
    });

    return informacao;
  } catch (error) {
    logError("atualizarAtivoInformacao", error, {
      id,
      ativo,
    });
    throw error;
  }
}

/* =========================
   Delete físico
========================= */

async function excluirInformacao(id) {
  try {
    const informacaoId = toPositiveIntOrNull(id);

    if (!informacaoId) {
      return null;
    }

    const atual = await buscarInformacaoPorId(informacaoId);

    if (!atual) {
      return null;
    }

    await db.none(
      `
        DELETE FROM informacoes_institucionais
        WHERE id = $1
      `,
      [informacaoId]
    );

    logInfo("excluirInformacao:ok", {
      id: informacaoId,
      titulo: atual.titulo,
    });

    return atual;
  } catch (error) {
    logError("excluirInformacao", error, { id });
    throw error;
  }
}

/* =========================
   Export
========================= */

module.exports = {
  listarInformacaoAdmin,
  listarInformacaoPublicada,
  buscarInformacaoPorId,
  criarInformacao,
  atualizarInformacao,
  atualizarAtivoInformacao,
  excluirInformacao,

  // aliases temporários apenas se algum controller ainda estiver chamando plural
  listarInformacoesAdmin: listarInformacaoAdmin,
  listarInformacoesPublicadas: listarInformacaoPublicada,
};