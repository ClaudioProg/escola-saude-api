/* eslint-disable no-console */
"use strict";

const {
  buscarInformacaoPorId,
  criarInformacao,
  atualizarInformacao,
  atualizarAtivoInformacao,
  excluirInformacao,
  listarInformacoesAdmin,
  listarInformacoesPublicadas
} = require("../services/informacoesService");

const {
  getImageRelativePath,
  removeFileIfExists,
  resolveImageAbsolutePath
} = require("../middlewares/uploadInformacoes");

const {
  buildResumoFromHtml,
  sanitizeInformacaoHtml
} = require("../utils/informacoesHtml");

function getUsuarioId(req) {
  return req.usuario?.id ?? req.user?.id ?? null;
}

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto ? String(forwardedProto).split(",")[0].trim() : req.protocol;
  return `${proto}://${req.get("host")}`;
}

function toPublicImageUrl(req, imagemUrl) {
  if (!imagemUrl) return null;
  if (/^https?:\/\//i.test(imagemUrl)) return imagemUrl;

  const cleanPath = String(imagemUrl).replace(/^\/+/, "");
  return `${getBaseUrl(req)}/${cleanPath}`;
}

function serializeInformacao(req, item, options = {}) {
  if (!item) return null;

  const {
    includeConteudoHtml = true
  } = options;

  return {
    ...item,
    imagem_url: toPublicImageUrl(req, item.imagem_url),
    conteudo_html: includeConteudoHtml ? item.conteudo_html : undefined
  };
}

function serializeLista(req, itens, options = {}) {
  return Array.isArray(itens)
    ? itens.map((item) => serializeInformacao(req, item, options))
    : [];
}

function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function validatePeriodo(dataInicio, dataFim) {
  if (!isValidDateOnly(dataInicio)) {
    throw new Error("Data inicial de exibição inválida.");
  }

  if (!isValidDateOnly(dataFim)) {
    throw new Error("Data final de exibição inválida.");
  }

  if (dataFim < dataInicio) {
    throw new Error("A data final não pode ser menor que a inicial.");
  }
}

function validateConteudoHtml(conteudoHtml) {
  const html = String(conteudoHtml || "").trim();

  if (!html) {
    throw new Error("Conteúdo é obrigatório.");
  }

  if (html.length > 20000) {
    throw new Error("Conteúdo muito grande. Reduza o texto da publicação.");
  }
}

function buildPayloadFromRequest(req) {
  const body = req.body || {};

  const conteudoSanitizado = sanitizeInformacaoHtml(body.conteudo_html || "");
  validateConteudoHtml(conteudoSanitizado);

  const resumoFinal =
    String(body.resumo || "").trim() || buildResumoFromHtml(conteudoSanitizado);

  if (
    body.data_inicio_exibicao !== undefined ||
    body.data_fim_exibicao !== undefined
  ) {
    validatePeriodo(body.data_inicio_exibicao, body.data_fim_exibicao);
  }

  let imagemPayload = {};
  if (req.file) {
    imagemPayload = {
      imagem_nome_original: req.file.originalname,
      imagem_mime_type: req.file.mimetype,
      imagem_tamanho_bytes: req.file.size,
      imagem_relative_path: getImageRelativePath(req.file.filename)
    };
  }

  return {
    titulo: body.titulo,
    subtitulo: body.subtitulo,
    badge: body.badge,
    resumo: resumoFinal,
    conteudo_html: conteudoSanitizado,
    tipo_exibicao: body.tipo_exibicao,
    ativo: body.ativo,
    ordem: body.ordem,
    data_inicio_exibicao: body.data_inicio_exibicao,
    data_fim_exibicao: body.data_fim_exibicao,
    ...imagemPayload
  };
}

function withImagePathForDb(payload, fallbackImagemUrl = null) {
  return {
    ...payload,
    imagem_url: payload.imagem_relative_path || fallbackImagemUrl || null
  };
}

function cleanupUploadedFile(req) {
  if (req.file?.path) {
    removeFileIfExists(req.file.path);
  }
}

function logContext(req) {
  return {
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    usuarioId: getUsuarioId(req)
  };
}

async function buscarInformacaoOu404(req, res, id) {
  const item = await buscarInformacaoPorId(id);

  if (!item) {
    res.status(404).json({
      ok: false,
      mensagem: "Informação não encontrada."
    });
    return null;
  }

  return item;
}

async function getInformacoesPublicadas(req, res) {
  try {
    const itens = await listarInformacoesPublicadas();

    const itensSerializados = serializeLista(req, itens, {
      includeConteudoHtml: true
    });

    return res.status(200).json({
      ok: true,
      total: itensSerializados.length,
      itens: itensSerializados
    });
  } catch (error) {
    console.error("[informacoes][publicadas][erro]", {
      ...logContext(req),
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível carregar as publicações."
    });
  }
}

async function getInformacoesAdmin(req, res) {
  try {
    const itens = await listarInformacoesAdmin();

    const itensSerializados = serializeLista(req, itens, {
      includeConteudoHtml: true
    });

    return res.status(200).json({
      ok: true,
      total: itensSerializados.length,
      itens: itensSerializados
    });
  } catch (error) {
    console.error("[informacoes][admin][erro]", {
      ...logContext(req),
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível carregar as informações institucionais."
    });
  }
}

async function getInformacaoById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido."
      });
    }

    const item = await buscarInformacaoOu404(req, res, id);
    if (!item) return;

    return res.status(200).json({
      ok: true,
      item: serializeInformacao(req, item, { includeConteudoHtml: true })
    });
  } catch (error) {
    console.error("[informacoes][detalhe][erro]", {
      ...logContext(req),
      id: req.params.id,
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao buscar informação."
    });
  }
}

async function postInformacao(req, res) {
  try {
    const usuarioId = getUsuarioId(req);
    const payloadBase = buildPayloadFromRequest(req);

    const payload = withImagePathForDb(
      {
        ...payloadBase,
        criado_por: usuarioId
      },
      null
    );

    const item = await criarInformacao(payload);

    console.log("[informacoes][criar][ok]", {
      ...logContext(req),
      id: item?.id,
      titulo: item?.titulo,
      temImagem: !!req.file
    });

    return res.status(201).json({
      ok: true,
      mensagem: "Informação criada com sucesso.",
      item: serializeInformacao(req, item, { includeConteudoHtml: true })
    });
  } catch (error) {
    cleanupUploadedFile(req);

    console.error("[informacoes][criar][erro]", {
      ...logContext(req),
      body: {
        titulo: req.body?.titulo,
        tipo_exibicao: req.body?.tipo_exibicao,
        data_inicio_exibicao: req.body?.data_inicio_exibicao,
        data_fim_exibicao: req.body?.data_fim_exibicao
      },
      temImagem: !!req.file,
      error: error?.message,
      stack: error?.stack
    });

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível criar a informação."
    });
  }
}

async function putInformacao(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      cleanupUploadedFile(req);
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido."
      });
    }

    const atual = await buscarInformacaoOu404(req, res, id);
    if (!atual) {
      cleanupUploadedFile(req);
      return;
    }

    const usuarioId = getUsuarioId(req);
    const payloadBase = buildPayloadFromRequest(req);

    const payload = withImagePathForDb(
      {
        ...payloadBase,
        atualizado_por: usuarioId
      },
      atual.imagem_url
    );

    const item = await atualizarInformacao(id, payload);

    if (req.file && atual.imagem_url?.startsWith("uploads/")) {
      removeFileIfExists(resolveImageAbsolutePath(atual.imagem_url));
    }

    console.log("[informacoes][editar][ok]", {
      ...logContext(req),
      id,
      tituloAnterior: atual.titulo,
      tituloNovo: item?.titulo,
      trocouImagem: !!req.file
    });

    return res.status(200).json({
      ok: true,
      mensagem: "Informação atualizada com sucesso.",
      item: serializeInformacao(req, item, { includeConteudoHtml: true })
    });
  } catch (error) {
    cleanupUploadedFile(req);

    console.error("[informacoes][editar][erro]", {
      ...logContext(req),
      id: req.params.id,
      body: {
        titulo: req.body?.titulo,
        tipo_exibicao: req.body?.tipo_exibicao,
        data_inicio_exibicao: req.body?.data_inicio_exibicao,
        data_fim_exibicao: req.body?.data_fim_exibicao
      },
      temImagem: !!req.file,
      error: error?.message,
      stack: error?.stack
    });

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível atualizar a informação."
    });
  }
}

async function patchAtivoInformacao(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido."
      });
    }

    const usuarioId = getUsuarioId(req);
    const ativo = req.body?.ativo;

    if (ativo === undefined) {
      return res.status(400).json({
        ok: false,
        mensagem: "O campo 'ativo' é obrigatório."
      });
    }

    const item = await atualizarAtivoInformacao(id, ativo, usuarioId);

    if (!item) {
      return res.status(404).json({
        ok: false,
        mensagem: "Informação não encontrada."
      });
    }

    console.log("[informacoes][ativo][ok]", {
      ...logContext(req),
      id,
      ativo: item.ativo
    });

    return res.status(200).json({
      ok: true,
      mensagem: `Informação ${item.ativo ? "ativada" : "desativada"} com sucesso.`,
      item: serializeInformacao(req, item, { includeConteudoHtml: true })
    });
  } catch (error) {
    console.error("[informacoes][ativo][erro]", {
      ...logContext(req),
      id: req.params.id,
      body: {
        ativo: req.body?.ativo
      },
      error: error?.message,
      stack: error?.stack
    });

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível alterar o status."
    });
  }
}

async function deleteInformacao(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido."
      });
    }

    const excluida = await excluirInformacao(id);

    if (!excluida) {
      return res.status(404).json({
        ok: false,
        mensagem: "Informação não encontrada."
      });
    }

    if (excluida.imagem_url?.startsWith("uploads/")) {
      removeFileIfExists(resolveImageAbsolutePath(excluida.imagem_url));
    }

    console.log("[informacoes][excluir][ok]", {
      ...logContext(req),
      id,
      titulo: excluida.titulo,
      tinhaImagem: !!excluida.imagem_url
    });

    return res.status(200).json({
      ok: true,
      mensagem: "Informação excluída com sucesso."
    });
  } catch (error) {
    console.error("[informacoes][excluir][erro]", {
      ...logContext(req),
      id: req.params.id,
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível excluir a informação."
    });
  }
}

module.exports = {
  getInformacoesPublicadas,
  getInformacoesAdmin,
  getInformacaoById,
  postInformacao,
  putInformacao,
  patchAtivoInformacao,
  deleteInformacao
};