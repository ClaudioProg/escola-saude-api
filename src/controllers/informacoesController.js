/* eslint-disable no-console */
"use strict";

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
  getImageRelativePath,
  removeFileIfExists,
  resolveImageAbsolutePath,
} = require("../middlewares/uploadInformacoes");

const {
  buildResumoFromHtml,
  sanitizeInformacaoHtml,
} = require("../utils/informacoesHtml");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Helpers gerais
=========================================================================== */
function mkRid(prefix = "INFO") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function reqRid(req, prefix = "INFO") {
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

function getUsuarioId(req) {
  return req.usuario?.id ?? req.user?.id ?? null;
}

function getBaseUrl(req) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = forwardedProto
    ? String(forwardedProto).split(",")[0].trim()
    : req.protocol;

  return `${proto}://${req.get("host")}`;
}

function logContext(req) {
  return {
    method: req.method,
    originalUrl: req.originalUrl,
    ip: req.ip,
    usuarioId: getUsuarioId(req),
  };
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

/* =========================================================================
   Imagem — persistência no BANCO como fonte principal
=========================================================================== */

/**
 * Ordem de prioridade da imagem:
 * 1) imagem_base64 / imagem_data_url (persistida no banco)
 * 2) imagem_url absoluta
 * 3) imagem_url relativa -> vira URL pública
 */
function resolvePersistedImageForOutput(req, item) {
  if (!item) return null;

  const imagemBase64 =
    item.imagem_base64 ||
    item.imagem_data_url ||
    item.imagem_blob_base64 ||
    null;

  if (imagemBase64 && /^data:image\//i.test(String(imagemBase64))) {
    return imagemBase64;
  }

  const imagemUrl = item.imagem_url || item.imagem_relative_path || null;
  if (!imagemUrl) return null;

  if (/^https?:\/\//i.test(String(imagemUrl))) return imagemUrl;

  const cleanPath = String(imagemUrl).replace(/^\/+/, "");
  return `${getBaseUrl(req)}/${cleanPath}`;
}

function buildImagePersistencePayloadFromFile(req) {
  if (!req.file) return {};

  const mimeType = req.file.mimetype || "application/octet-stream";
  const base64 = req.file.buffer?.toString("base64");

  if (!base64) {
    throw new Error("Falha ao processar imagem enviada.");
  }

  const imagemDataUrl = `data:${mimeType};base64,${base64}`;

  return {
    imagem_nome_original: req.file.originalname || null,
    imagem_mime_type: mimeType,
    imagem_tamanho_bytes: req.file.size || null,

    // ✅ compat legado (caso ainda exista uso do caminho físico)
    imagem_relative_path: req.file.filename
      ? getImageRelativePath(req.file.filename)
      : null,

    // ✅ principal: persistência em banco
    imagem_base64: imagemDataUrl,
    imagem_data_url: imagemDataUrl,
  };
}

function cleanupUploadedFile(req) {
  if (req.file?.path) {
    removeFileIfExists(req.file.path);
  }
}

/* =========================================================================
   Serialização
=========================================================================== */
function serializeInformacao(req, item, options = {}) {
  if (!item) return null;

  const { includeConteudoHtml = true } = options;
  const imagemSerializada = resolvePersistedImageForOutput(req, item);

  return {
    ...item,
    imagem_url: imagemSerializada,
    conteudo_html: includeConteudoHtml ? item.conteudo_html : undefined,
  };
}

function serializeLista(req, itens, options = {}) {
  return Array.isArray(itens)
    ? itens.map((item) => serializeInformacao(req, item, options))
    : [];
}

/* =========================================================================
   Payload builders
=========================================================================== */
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

  const imagemPayload = buildImagePersistencePayloadFromFile(req);

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
    ...imagemPayload,
  };
}

function withImageFieldsForDb(payload, atual = null) {
  const hasNewDbImage =
    !!payload.imagem_base64 || !!payload.imagem_data_url;

  const hasNewRelativePath = !!payload.imagem_relative_path;

  const currentDbImage =
    atual?.imagem_base64 ||
    atual?.imagem_data_url ||
    atual?.imagem_blob_base64 ||
    null;

  const currentUrl = atual?.imagem_url || atual?.imagem_relative_path || null;

  return {
    ...payload,

    // ✅ fonte principal no banco
    imagem_base64: hasNewDbImage
      ? payload.imagem_base64 || payload.imagem_data_url
      : currentDbImage || null,

    imagem_data_url: hasNewDbImage
      ? payload.imagem_data_url || payload.imagem_base64
      : currentDbImage || null,

    // ✅ compat legado
    imagem_url: hasNewRelativePath
      ? payload.imagem_relative_path
      : currentUrl || null,
  };
}

/* =========================================================================
   Busca helper
=========================================================================== */
async function buscarInformacaoOu404(req, res, id) {
  const item = await buscarInformacaoPorId(id);

  if (!item) {
    res.status(404).json({
      ok: false,
      mensagem: "Informação não encontrada.",
    });
    return null;
  }

  return item;
}

/* =========================================================================
   GET públicos/admin
=========================================================================== */
async function getInformacoesPublicadas(req, res) {
  const rid = reqRid(req);

  try {
    const itens = await listarInformacoesPublicadas();

    const itensSerializados = serializeLista(req, itens, {
      includeConteudoHtml: true,
    });

    logInfo(rid, "getInformacoesPublicadas OK", {
      total: itensSerializados.length,
    });

    return res.status(200).json({
      ok: true,
      total: itensSerializados.length,
      itens: itensSerializados,
    });
  } catch (error) {
    logErr(rid, "[informacoes][publicadas][erro]", error);

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível carregar as publicações.",
    });
  }
}

async function getInformacoesAdmin(req, res) {
  const rid = reqRid(req);

  try {
    const itens = await listarInformacoesAdmin();

    const itensSerializados = serializeLista(req, itens, {
      includeConteudoHtml: true,
    });

    logInfo(rid, "getInformacoesAdmin OK", {
      total: itensSerializados.length,
    });

    return res.status(200).json({
      ok: true,
      total: itensSerializados.length,
      itens: itensSerializados,
    });
  } catch (error) {
    logErr(rid, "[informacoes][admin][erro]", error);

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível carregar as informações institucionais.",
    });
  }
}

async function getInformacaoById(req, res) {
  const rid = reqRid(req);

  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido.",
      });
    }

    const item = await buscarInformacaoOu404(req, res, id);
    if (!item) return;

    logInfo(rid, "getInformacaoById OK", { id });

    return res.status(200).json({
      ok: true,
      item: serializeInformacao(req, item, { includeConteudoHtml: true }),
    });
  } catch (error) {
    logErr(rid, "[informacoes][detalhe][erro]", error);

    return res.status(500).json({
      ok: false,
      mensagem: "Erro ao buscar informação.",
    });
  }
}

/* =========================================================================
   POST
=========================================================================== */
async function postInformacao(req, res) {
  const rid = reqRid(req);

  try {
    const usuarioId = getUsuarioId(req);
    const payloadBase = buildPayloadFromRequest(req);

    const payload = withImageFieldsForDb(
      {
        ...payloadBase,
        criado_por: usuarioId,
      },
      null
    );

    const item = await criarInformacao(payload);

    logInfo(rid, "[informacoes][criar][ok]", {
      ...logContext(req),
      id: item?.id,
      titulo: item?.titulo,
      temImagemUpload: !!req.file,
      imagemPersistidaEmBanco: !!payload.imagem_base64,
    });

    return res.status(201).json({
      ok: true,
      mensagem: "Informação criada com sucesso.",
      item: serializeInformacao(req, item, { includeConteudoHtml: true }),
    });
  } catch (error) {
    cleanupUploadedFile(req);

    logErr(rid, "[informacoes][criar][erro]", error);

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível criar a informação.",
    });
  }
}

/* =========================================================================
   PUT
=========================================================================== */
async function putInformacao(req, res) {
  const rid = reqRid(req);

  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      cleanupUploadedFile(req);
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido.",
      });
    }

    const atual = await buscarInformacaoOu404(req, res, id);
    if (!atual) {
      cleanupUploadedFile(req);
      return;
    }

    const usuarioId = getUsuarioId(req);
    const payloadBase = buildPayloadFromRequest(req);

    const payload = withImageFieldsForDb(
      {
        ...payloadBase,
        atualizado_por: usuarioId,
      },
      atual
    );

    const item = await atualizarInformacao(id, payload);

    // remove arquivo legado local só se houve troca de imagem
    if (req.file && atual.imagem_url?.startsWith("uploads/")) {
      removeFileIfExists(resolveImageAbsolutePath(atual.imagem_url));
    }

    logInfo(rid, "[informacoes][editar][ok]", {
      ...logContext(req),
      id,
      tituloAnterior: atual.titulo,
      tituloNovo: item?.titulo,
      trocouImagem: !!req.file,
      imagemPersistidaEmBanco: !!payload.imagem_base64,
    });

    return res.status(200).json({
      ok: true,
      mensagem: "Informação atualizada com sucesso.",
      item: serializeInformacao(req, item, { includeConteudoHtml: true }),
    });
  } catch (error) {
    cleanupUploadedFile(req);

    logErr(rid, "[informacoes][editar][erro]", error);

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível atualizar a informação.",
    });
  }
}

/* =========================================================================
   PATCH ativo
=========================================================================== */
async function patchAtivoInformacao(req, res) {
  const rid = reqRid(req);

  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido.",
      });
    }

    const usuarioId = getUsuarioId(req);
    const ativo = req.body?.ativo;

    if (ativo === undefined) {
      return res.status(400).json({
        ok: false,
        mensagem: "O campo 'ativo' é obrigatório.",
      });
    }

    const item = await atualizarAtivoInformacao(id, ativo, usuarioId);

    if (!item) {
      return res.status(404).json({
        ok: false,
        mensagem: "Informação não encontrada.",
      });
    }

    logInfo(rid, "[informacoes][ativo][ok]", {
      ...logContext(req),
      id,
      ativo: item.ativo,
    });

    return res.status(200).json({
      ok: true,
      mensagem: `Informação ${item.ativo ? "ativada" : "desativada"} com sucesso.`,
      item: serializeInformacao(req, item, { includeConteudoHtml: true }),
    });
  } catch (error) {
    logErr(rid, "[informacoes][ativo][erro]", error);

    return res.status(400).json({
      ok: false,
      mensagem: error?.message || "Não foi possível alterar o status.",
    });
  }
}

/* =========================================================================
   DELETE
=========================================================================== */
async function deleteInformacao(req, res) {
  const rid = reqRid(req);

  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id)) {
      return res.status(400).json({
        ok: false,
        mensagem: "ID inválido.",
      });
    }

    const excluida = await excluirInformacao(id);

    if (!excluida) {
      return res.status(404).json({
        ok: false,
        mensagem: "Informação não encontrada.",
      });
    }

    // remove arquivo físico legado, mas imagem persistida no banco segue sendo a fonte principal
    if (excluida.imagem_url?.startsWith("uploads/")) {
      removeFileIfExists(resolveImageAbsolutePath(excluida.imagem_url));
    }

    logInfo(rid, "[informacoes][excluir][ok]", {
      ...logContext(req),
      id,
      titulo: excluida.titulo,
      tinhaImagem: !!(
        excluida.imagem_url ||
        excluida.imagem_base64 ||
        excluida.imagem_data_url
      ),
    });

    return res.status(200).json({
      ok: true,
      mensagem: "Informação excluída com sucesso.",
    });
  } catch (error) {
    logErr(rid, "[informacoes][excluir][erro]", error);

    return res.status(500).json({
      ok: false,
      mensagem: "Não foi possível excluir a informação.",
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
  deleteInformacao,
};