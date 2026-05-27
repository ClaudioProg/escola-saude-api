"use strict";

/**
 * ✅ backend/src/controllers/informacoesController.js — v2.1
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Módulo:
 * - Informações institucionais / publicações da página inicial.
 *
 * Contratos oficiais:
 * - req.user.id
 * - serviços oficiais de informacoesService
 * - imagem persistida no banco como data:image/...;base64,...
 * - HTML sanitizado por sanitizeInformacaoHtml
 * - resumo automático por buildResumoFromHtml
 *
 * Diretrizes v2.1:
 * - sem req.usuario;
 * - sem resposta { mensagem };
 * - sem retorno item/itens fora do padrão;
 * - sem fallback de imagem física/legada;
 * - sem remoção de arquivo físico legado;
 * - sem aliases de payload;
 * - date-only em YYYY-MM-DD;
 * - resposta padrão ok/data/message/code/meta;
 * - erro padrão ok:false/data:null/message/code/adminHint/details/requestId.
 */

const {
  buscarInformacaoPorId,
  criarInformacao,
  atualizarInformacao,
  atualizarAtivoInformacao,
  excluirInformacao,
  listarInformacoesAdmin,
  listarInformacoesPublicadas,
} = require("../services/informacoesService");

const {
  buildResumoFromHtml,
  sanitizeInformacaoHtml,
} = require("../utils/sanitizeInformacaoHtml");

const IS_PROD = process.env.NODE_ENV === "production";

/* =========================================================================
   Respostas / logs
=========================================================================== */

function gerarRequestId(prefix = "informacoes") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sucesso(
  res,
  {
    status = 200,
    data = null,
    message = "OK",
    code = "OK",
    meta = null,
  } = {}
) {
  return res.status(status).json({
    ok: true,
    data,
    message,
    code,
    ...(meta ? { meta } : {}),
  });
}

function falha(
  res,
  {
    status = 500,
    message = "Erro interno.",
    code = "ERRO_INTERNO",
    adminHint = null,
    details = null,
    requestId,
  }
) {
  return res.status(status).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId,
  });
}

function logErro(requestId, contexto, error) {
  console.error(`[informacoesController][${requestId}] ${contexto}`, {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
  });
}

function logInfo(requestId, contexto, payload = {}) {
  if (IS_PROD) return;

  console.log(`[informacoesController][${requestId}] ${contexto}`, payload);
}

/* =========================================================================
   Helpers gerais
=========================================================================== */

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getUsuarioId(req) {
  return toPositiveInt(req.user?.id);
}

function cleanText(value, { max = 2000 } = {}) {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.length > max ? text.slice(0, max) : text;
}

function cleanBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  return fallback;
}

function cleanInteger(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;

  const n = Number(value);

  if (!Number.isInteger(n)) return fallback;

  return n;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function cleanDateOnly(value) {
  if (value === undefined || value === null || value === "") return null;

  const text = String(value).trim().slice(0, 10);

  return isDateOnly(text) ? text : null;
}

function validarPeriodo(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return;

  if (!isDateOnly(dataInicio)) {
    const error = new Error("Data inicial de exibição inválida.");
    error.status = 400;
    error.code = "DATA_INICIO_INVALIDA";
    throw error;
  }

  if (!isDateOnly(dataFim)) {
    const error = new Error("Data final de exibição inválida.");
    error.status = 400;
    error.code = "DATA_FIM_INVALIDA";
    throw error;
  }

  if (dataFim < dataInicio) {
    const error = new Error("A data final não pode ser menor que a inicial.");
    error.status = 400;
    error.code = "PERIODO_INVALIDO";
    throw error;
  }
}

function validarConteudoHtml(conteudoHtml) {
  const html = String(conteudoHtml || "").trim();

  if (!html) {
    const error = new Error("Conteúdo é obrigatório.");
    error.status = 400;
    error.code = "CONTEUDO_OBRIGATORIO";
    throw error;
  }

  if (html.length > 20000) {
    const error = new Error("Conteúdo muito grande. Reduza o texto da publicação.");
    error.status = 400;
    error.code = "CONTEUDO_MUITO_GRANDE";
    throw error;
  }
}

function validarTitulo(titulo) {
  if (!titulo) {
    const error = new Error("Título é obrigatório.");
    error.status = 400;
    error.code = "TITULO_OBRIGATORIO";
    throw error;
  }

  if (titulo.length > 180) {
    const error = new Error("Título muito longo. Use até 180 caracteres.");
    error.status = 400;
    error.code = "TITULO_MUITO_LONGO";
    throw error;
  }
}

function validarImagemUpload(file) {
  if (!file) return null;

  const mime = String(file.mimetype || "").trim().toLowerCase();
  const size = Number(file.size || 0);

  const mimesPermitidos = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ]);

  if (!mimesPermitidos.has(mime)) {
    const error = new Error("Imagem inválida. Envie arquivo JPG, PNG ou WEBP.");
    error.status = 400;
    error.code = "IMAGEM_MIME_INVALIDO";
    throw error;
  }

  if (!Buffer.isBuffer(file.buffer)) {
    const error = new Error("Upload inválido. A imagem deve ser processada em memória.");
    error.status = 400;
    error.code = "IMAGEM_BUFFER_AUSENTE";
    throw error;
  }

  if (size <= 0) {
    const error = new Error("Imagem vazia ou inválida.");
    error.status = 400;
    error.code = "IMAGEM_VAZIA";
    throw error;
  }

  if (size > 2 * 1024 * 1024) {
    const error = new Error("Imagem muito grande. Envie arquivo de até 2 MB.");
    error.status = 400;
    error.code = "IMAGEM_MUITO_GRANDE";
    throw error;
  }

  return {
    mime,
    size,
  };
}

/* =========================================================================
   Imagem
=========================================================================== */

function buildImagePayloadFromFile(file) {
  if (!file) return {};

  const imageInfo = validarImagemUpload(file);
  const base64 = file.buffer.toString("base64");

  if (!base64) {
    const error = new Error("Falha ao processar imagem enviada.");
    error.status = 400;
    error.code = "IMAGEM_PROCESSAMENTO_ERRO";
    throw error;
  }

  return {
    imagem_url: `data:${imageInfo.mime};base64,${base64}`,
    imagem_nome_original: cleanText(file.originalname, { max: 255 }),
    imagem_mime_type: imageInfo.mime,
    imagem_tamanho_bytes: imageInfo.size,
  };
}

function manterImagemAtualSeNaoHouverNova(payload, atual = null) {
  const temNovaImagem = Boolean(String(payload?.imagem_url || "").trim());

  if (temNovaImagem) return payload;

  return {
    ...payload,
    imagem_url: atual?.imagem_url || null,
    imagem_nome_original: atual?.imagem_nome_original || null,
    imagem_mime_type: atual?.imagem_mime_type || null,
    imagem_tamanho_bytes: atual?.imagem_tamanho_bytes || null,
  };
}

/* =========================================================================
   Serialização
=========================================================================== */

function serializeInformacao(item, options = {}) {
  if (!item) return null;

  const { includeConteudoHtml = true } = options;

  return {
    id: item.id,
    titulo: item.titulo,
    subtitulo: item.subtitulo,
    badge: item.badge,
    resumo: item.resumo,
    conteudo_html: includeConteudoHtml ? item.conteudo_html : undefined,
    tipo_exibicao: item.tipo_exibicao,
    ativo: item.ativo,
    ordem: item.ordem,
    data_inicio_exibicao: item.data_inicio_exibicao,
    data_fim_exibicao: item.data_fim_exibicao,
    imagem_url: item.imagem_url || null,
    imagem_nome_original: item.imagem_nome_original || null,
    imagem_mime_type: item.imagem_mime_type || null,
    imagem_tamanho_bytes: item.imagem_tamanho_bytes || null,
    criado_por: item.criado_por,
    atualizado_por: item.atualizado_por,
    criado_em: item.criado_em,
    atualizado_em: item.atualizado_em,
  };
}

function serializeLista(itens, options = {}) {
  return Array.isArray(itens)
    ? itens.map((item) => serializeInformacao(item, options))
    : [];
}

/* =========================================================================
   Payload
=========================================================================== */

function buildPayloadFromRequest(req, { modo = "criar", atual = null } = {}) {
  const body = req.body || {};

  const titulo = cleanText(body.titulo, { max: 180 });
  validarTitulo(titulo);

  const conteudoSanitizado = sanitizeInformacaoHtml(body.conteudo_html || "");
  validarConteudoHtml(conteudoSanitizado);

  const resumoManual = cleanText(body.resumo, { max: 500 });
  const resumoFinal = resumoManual || buildResumoFromHtml(conteudoSanitizado);

  const dataInicio = cleanDateOnly(body.data_inicio_exibicao);
  const dataFim = cleanDateOnly(body.data_fim_exibicao);

  if (
    body.data_inicio_exibicao !== undefined &&
    body.data_inicio_exibicao !== "" &&
    !dataInicio
  ) {
    const error = new Error("Data inicial de exibição inválida.");
    error.status = 400;
    error.code = "DATA_INICIO_INVALIDA";
    throw error;
  }

  if (
    body.data_fim_exibicao !== undefined &&
    body.data_fim_exibicao !== "" &&
    !dataFim
  ) {
    const error = new Error("Data final de exibição inválida.");
    error.status = 400;
    error.code = "DATA_FIM_INVALIDA";
    throw error;
  }

  validarPeriodo(dataInicio, dataFim);

  const imagemPayload = buildImagePayloadFromFile(req.file);

  const payload = {
    titulo,
    subtitulo: cleanText(body.subtitulo, { max: 220 }),
    badge: cleanText(body.badge, { max: 80 }),
    resumo: resumoFinal,
    conteudo_html: conteudoSanitizado,
    tipo_exibicao: cleanText(body.tipo_exibicao, { max: 80 }),
    ativo: cleanBoolean(body.ativo, modo === "criar" ? true : Boolean(atual?.ativo)),
    ordem: cleanInteger(body.ordem, Number(atual?.ordem || 0)),
    data_inicio_exibicao: dataInicio,
    data_fim_exibicao: dataFim,
    ...imagemPayload,
  };

  return modo === "editar" ? manterImagemAtualSeNaoHouverNova(payload, atual) : payload;
}

async function buscarInformacaoObrigatoria(id) {
  const item = await buscarInformacaoPorId(id);

  if (!item) {
    const error = new Error("Informação não encontrada.");
    error.status = 404;
    error.code = "INFORMACAO_NAO_ENCONTRADA";
    throw error;
  }

  return item;
}

function tratarErroInformacao(res, requestId, error, contexto) {
  logErro(requestId, contexto, error);

  const status = error?.status || 500;

  if (status < 500) {
    return falha(res, {
      status,
      message: error?.message || "Não foi possível processar a informação.",
      code: error?.code || "INFORMACOES_REQUISICAO_INVALIDA",
      details: IS_PROD ? null : { detalhe: error?.message },
      requestId,
    });
  }

  return falha(res, {
    status: 500,
    message: "Erro interno ao processar informações institucionais.",
    code: error?.code || "INFORMACOES_ERRO_INTERNO",
    adminHint:
      "Verifique informacoesService, tabela de informações, campos de imagem, sanitização HTML e payload enviado.",
    details: {
      dbCode: error?.code,
      constraint: error?.constraint,
      ...(IS_PROD ? {} : { detalhe: error?.message }),
    },
    requestId,
  });
}

/* =========================================================================
   GET públicos/admin
=========================================================================== */

async function getInformacoesPublicadas(req, res) {
  const requestId = gerarRequestId("informacoes-publicadas");

  try {
    const itens = await listarInformacoesPublicadas();
    const data = serializeLista(itens, { includeConteudoHtml: true });

    logInfo(requestId, "getInformacoesPublicadas:ok", {
      total: data.length,
    });

    return sucesso(res, {
      data,
      message: "Publicações carregadas com sucesso.",
      code: "INFORMACOES_PUBLICADAS_LISTADAS",
      meta: {
        total: data.length,
      },
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao listar informações publicadas"
    );
  }
}

async function getInformacoesAdmin(req, res) {
  const requestId = gerarRequestId("informacoes-admin");

  try {
    const itens = await listarInformacoesAdmin();
    const data = serializeLista(itens, { includeConteudoHtml: true });

    logInfo(requestId, "getInformacoesAdmin:ok", {
      total: data.length,
      usuario_id: getUsuarioId(req),
    });

    return sucesso(res, {
      data,
      message: "Informações institucionais carregadas com sucesso.",
      code: "INFORMACOES_ADMIN_LISTADAS",
      meta: {
        total: data.length,
      },
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao listar informações admin"
    );
  }
}

async function getInformacaoById(req, res) {
  const requestId = gerarRequestId("informacoes-detalhe");

  try {
    const id = toPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id ?? null,
        },
        requestId,
      });
    }

    const item = await buscarInformacaoObrigatoria(id);

    return sucesso(res, {
      data: serializeInformacao(item, { includeConteudoHtml: true }),
      message: "Informação carregada com sucesso.",
      code: "INFORMACAO_DETALHE_OK",
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao buscar informação por ID"
    );
  }
}

/* =========================================================================
   POST
=========================================================================== */

async function postInformacao(req, res) {
  const requestId = gerarRequestId("informacoes-criar");

  try {
    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint:
          "O middleware de autenticação deve popular req.user.id antes de criar informação.",
        requestId,
      });
    }

    const payloadBase = buildPayloadFromRequest(req, {
      modo: "criar",
      atual: null,
    });

    const payload = {
      ...payloadBase,
      criado_por: usuarioId,
    };

    const item = await criarInformacao(payload);

    logInfo(requestId, "postInformacao:ok", {
      id: item?.id,
      titulo: item?.titulo,
      usuario_id: usuarioId,
      temImagem: Boolean(payload.imagem_url),
      imagemMime: payload.imagem_mime_type || null,
      imagemBytes: payload.imagem_tamanho_bytes || null,
    });

    return sucesso(res, {
      status: 201,
      data: serializeInformacao(item, { includeConteudoHtml: true }),
      message: "Informação criada com sucesso.",
      code: "INFORMACAO_CRIADA",
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao criar informação"
    );
  }
}

/* =========================================================================
   PUT
=========================================================================== */

async function putInformacao(req, res) {
  const requestId = gerarRequestId("informacoes-atualizar");

  try {
    const id = toPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id ?? null,
        },
        requestId,
      });
    }

    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint:
          "O middleware de autenticação deve popular req.user.id antes de atualizar informação.",
        requestId,
      });
    }

    const atual = await buscarInformacaoObrigatoria(id);

    const payloadBase = buildPayloadFromRequest(req, {
      modo: "editar",
      atual,
    });

    const payload = {
      ...payloadBase,
      atualizado_por: usuarioId,
    };

    const item = await atualizarInformacao(id, payload);

    logInfo(requestId, "putInformacao:ok", {
      id,
      tituloAnterior: atual?.titulo,
      tituloNovo: item?.titulo,
      usuario_id: usuarioId,
      trocouImagem: Boolean(req.file),
      imagemMime: payload.imagem_mime_type || null,
      imagemBytes: payload.imagem_tamanho_bytes || null,
    });

    return sucesso(res, {
      data: serializeInformacao(item, { includeConteudoHtml: true }),
      message: "Informação atualizada com sucesso.",
      code: "INFORMACAO_ATUALIZADA",
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao atualizar informação"
    );
  }
}

/* =========================================================================
   PATCH ativo
=========================================================================== */

async function patchAtivoInformacao(req, res) {
  const requestId = gerarRequestId("informacoes-ativo");

  try {
    const id = toPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id ?? null,
        },
        requestId,
      });
    }

    const usuarioId = getUsuarioId(req);

    if (!usuarioId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        requestId,
      });
    }

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "ativo")) {
      return falha(res, {
        status: 400,
        message: "O campo ativo é obrigatório.",
        code: "ATIVO_OBRIGATORIO",
        requestId,
      });
    }

    const ativo = cleanBoolean(req.body.ativo, false);
    const item = await atualizarAtivoInformacao(id, ativo, usuarioId);

    if (!item) {
      return falha(res, {
        status: 404,
        message: "Informação não encontrada.",
        code: "INFORMACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    logInfo(requestId, "patchAtivoInformacao:ok", {
      id,
      ativo: item?.ativo,
      usuario_id: usuarioId,
    });

    return sucesso(res, {
      data: serializeInformacao(item, { includeConteudoHtml: true }),
      message: `Informação ${item.ativo ? "ativada" : "desativada"} com sucesso.`,
      code: item.ativo ? "INFORMACAO_ATIVADA" : "INFORMACAO_DESATIVADA",
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao alterar status da informação"
    );
  }
}

/* =========================================================================
   DELETE
=========================================================================== */

async function deleteInformacao(req, res) {
  const requestId = gerarRequestId("informacoes-excluir");

  try {
    const id = toPositiveInt(req.params?.id);

    if (!id) {
      return falha(res, {
        status: 400,
        message: "ID inválido.",
        code: "ID_INVALIDO",
        adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
        details: {
          value: req.params?.id ?? null,
        },
        requestId,
      });
    }

    const excluida = await excluirInformacao(id);

    if (!excluida) {
      return falha(res, {
        status: 404,
        message: "Informação não encontrada.",
        code: "INFORMACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    logInfo(requestId, "deleteInformacao:ok", {
      id,
      titulo: excluida?.titulo,
      tinhaImagem: Boolean(excluida?.imagem_url),
    });

    return sucesso(res, {
      data: serializeInformacao(excluida, { includeConteudoHtml: false }),
      message: "Informação excluída com sucesso.",
      code: "INFORMACAO_EXCLUIDA",
    });
  } catch (error) {
    return tratarErroInformacao(
      res,
      requestId,
      error,
      "Erro ao excluir informação"
    );
  }
}

module.exports = {
  getInformacoesPublicadas,
  getInformacoesAdmin,
  getInformacaoById,
  postInformacao,
  putInformacao,
  patchAtivoInformacao,
  deleteInformacao,
};