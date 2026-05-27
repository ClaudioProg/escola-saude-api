"use strict";

/**
 * 📁 backend/src/controllers/uploadController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Módulo:
 * - Upload/download do modelo de banner de trabalhos.
 *
 * Contrato oficial:
 * - tabela trabalhos_modelos
 * - tipo = 'banner'
 * - colunas oficiais:
 *   tipo
 *   nome
 *   mime
 *   tamanho
 *   arquivo
 *   atualizado_por
 *   atualizado_em
 *   criado_em
 *
 * Endpoints esperados:
 * - GET  /api/modelos/banner.pptx
 * - POST /api/admin/modelos/banner
 *
 * Diretrizes v2.0:
 * - sem req.usuario;
 * - sem compatibilidade pg-promise;
 * - sem fallback de colunas;
 * - sem detecção dinâmica de schema;
 * - sem resposta fora do padrão;
 * - sem next(err) para erro operacional previsto;
 * - arquivo persistido em BYTEA no banco;
 * - validação estrita de extensão e MIME;
 * - headers seguros de download;
 * - ETag e checksum SHA-256;
 * - resposta padrão ok/data/message/code/meta;
 * - erro padrão ok:false/data:null/message/code/adminHint/details/requestId.
 */

const crypto = require("crypto");
const db = require("../db");

/* =========================================================================
   DB oficial
=========================================================================== */

const query =
  typeof db?.query === "function"
    ? db.query.bind(db)
    : typeof db?.pool?.query === "function"
      ? db.pool.query.bind(db.pool)
      : null;

if (typeof query !== "function") {
  throw new Error(
    "[uploadController] DB inválido. O export oficial de ../db deve expor query."
  );
}

/* =========================================================================
   Constantes
=========================================================================== */

const MAX_BYTES = 50 * 1024 * 1024;

const DEFAULT_PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const PPT_MIMES_OFICIAIS = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
]);

/* =========================================================================
   Respostas / logs
=========================================================================== */

function gerarRequestId(prefix = "upload") {
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
  console.error(`[uploadController][${requestId}] ${contexto}`, {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint,
    table: error?.table,
    column: error?.column,
  });
}

function logInfo(requestId, contexto, payload = {}) {
  if (process.env.NODE_ENV === "production") return;

  console.log(`[uploadController][${requestId}] ${contexto}`, payload);
}

/* =========================================================================
   Helpers
=========================================================================== */

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function getActorId(req) {
  return toPositiveInt(req.user?.id);
}

function safeFilename(name, fallback = "modelo-banner.pptx") {
  const base = String(name || "").trim() || fallback;

  return base.replace(/[/\\?%*:|"<>]/g, "_");
}

function ensurePptxName(name, fallbackBase = "modelo-banner") {
  const clean = safeFilename(name || fallbackBase, `${fallbackBase}.pptx`);

  return clean.replace(/\.(ppt|pptx)$/i, "") + ".pptx";
}

function baseNameSemExt(filename) {
  return ensurePptxName(filename).replace(/\.pptx$/i, "");
}

function setDownloadSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Download-Options", "noopen");
}

function isPptFilename(name = "") {
  return /\.(ppt|pptx)$/i.test(String(name || "").trim());
}

function isPptMime(mime = "") {
  return PPT_MIMES_OFICIAIS.has(String(mime || "").toLowerCase().trim());
}

function validarArquivoModelo(file) {
  if (!file) {
    const error = new Error("Arquivo é obrigatório no campo file.");
    error.status = 400;
    error.code = "ARQUIVO_OBRIGATORIO";
    throw error;
  }

  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    const error = new Error("Arquivo vazio ou inválido.");
    error.status = 400;
    error.code = "ARQUIVO_INVALIDO";
    throw error;
  }

  const size = Number(file.size || file.buffer.length || 0);

  if (size <= 0) {
    const error = new Error("Arquivo vazio ou inválido.");
    error.status = 400;
    error.code = "ARQUIVO_VAZIO";
    throw error;
  }

  if (size > MAX_BYTES || file.buffer.length > MAX_BYTES) {
    const error = new Error("Arquivo excede o limite de 50 MB.");
    error.status = 413;
    error.code = "ARQUIVO_MUITO_GRANDE";
    throw error;
  }

  const originalname = String(file.originalname || "").trim();
  const mimetype = String(file.mimetype || "").trim().toLowerCase();

  if (!isPptFilename(originalname)) {
    const error = new Error("Formato inválido. Envie um arquivo .ppt ou .pptx.");
    error.status = 400;
    error.code = "EXTENSAO_INVALIDA";
    throw error;
  }

  if (!isPptMime(mimetype)) {
    const error = new Error("MIME inválido para apresentação PowerPoint.");
    error.status = 400;
    error.code = "MIME_INVALIDO";
    error.details = {
      mime_recebido: mimetype || null,
      mimes_permitidos: Array.from(PPT_MIMES_OFICIAIS),
    };
    throw error;
  }

  return {
    originalname,
    mimetype,
    size,
  };
}

function tratarErroUpload(res, requestId, error, contexto) {
  logErro(requestId, contexto, error);

  const status = error?.status || 500;

  if (status < 500) {
    return falha(res, {
      status,
      message: error?.message || "Requisição inválida.",
      code: error?.code || "UPLOAD_REQUISICAO_INVALIDA",
      details: error?.details || null,
      requestId,
    });
  }

  return falha(res, {
    status: 500,
    message: "Erro interno ao processar modelo de banner.",
    code: error?.code || "UPLOAD_MODELO_BANNER_ERRO",
    adminHint:
      "Verifique tabela trabalhos_modelos, colunas tipo/nome/mime/tamanho/arquivo/atualizado_por/atualizado_em/criado_em, constraint única em tipo e configuração do multer em memória.",
    details: {
      dbCode: error?.code,
      constraint: error?.constraint,
    },
    requestId,
  });
}

/* =========================================================================
   GET /api/modelos/banner.pptx
=========================================================================== */

async function baixarModeloBanner(req, res) {
  const requestId = gerarRequestId("modelo-banner-download");

  try {
    const result = await query(
      `
        SELECT
          nome,
          mime,
          tamanho,
          arquivo,
          COALESCE(atualizado_em, criado_em, NOW()) AS ts_ref
        FROM trabalhos_modelos
        WHERE tipo = 'banner'
        LIMIT 1
      `
    );

    const row = result.rows?.[0] || null;

    if (!row) {
      return falha(res, {
        status: 404,
        message: "Modelo de banner não encontrado.",
        code: "MODELO_BANNER_NAO_ENCONTRADO",
        requestId,
      });
    }

    const buffer = row.arquivo;

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return falha(res, {
        status: 500,
        message: "Arquivo inválido armazenado no banco.",
        code: "MODELO_BANNER_ARQUIVO_INVALIDO",
        adminHint:
          "A coluna trabalhos_modelos.arquivo deve conter BYTEA válido para tipo='banner'.",
        requestId,
      });
    }

    const filename = ensurePptxName(row.nome || "modelo-banner");
    const mime = isPptMime(row.mime) ? row.mime : DEFAULT_PPTX_MIME;
    const size = Number(row.tamanho) > 0 ? Number(row.tamanho) : buffer.length;
    const ts = row.ts_ref ? new Date(row.ts_ref) : new Date();
    const checksum = sha256(buffer);
    const digest = checksum.slice(0, 16);
    const tsSafe = Number.isNaN(ts.getTime()) ? new Date() : ts;

    const etag = `"pptx-${size.toString(16)}-${Number(
      tsSafe.getTime()
    ).toString(36)}-${digest}"`;

    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", tsSafe.toUTCString());
    res.setHeader(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300"
    );

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    setDownloadSecurityHeaders(res);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", String(size));
    res.setHeader("X-Checksum-SHA256", checksum);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`
    );

    logInfo(requestId, "baixarModeloBanner:ok", {
      nome: filename,
      tamanho: size,
      mime,
      checksum: checksum.slice(0, 12),
    });

    return res.send(buffer);
  } catch (error) {
    return tratarErroUpload(
      res,
      requestId,
      error,
      "Erro ao baixar modelo de banner"
    );
  }
}

/* =========================================================================
   POST /api/admin/modelos/banner
=========================================================================== */

async function subirModeloBanner(req, res) {
  const requestId = gerarRequestId("modelo-banner-upload");

  try {
    const actorId = getActorId(req);

    if (!actorId) {
      return falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint:
          "O middleware de autenticação deve popular req.user.id antes do upload.",
        requestId,
      });
    }

    const fileInfo = validarArquivoModelo(req.file);

    const nomeFinal = ensurePptxName(
      req.body?.nome || fileInfo.originalname || "modelo-banner"
    );

    const nomeBase = baseNameSemExt(nomeFinal);
    const mimeFinal = fileInfo.mimetype || DEFAULT_PPTX_MIME;
    const size = fileInfo.size;
    const checksum = sha256(req.file.buffer);

    await query(
      `
        INSERT INTO trabalhos_modelos
          (
            tipo,
            nome,
            mime,
            tamanho,
            arquivo,
            atualizado_por,
            atualizado_em,
            criado_em
          )
        VALUES
          (
            'banner',
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW(),
            NOW()
          )
        ON CONFLICT (tipo)
        DO UPDATE SET
          nome = EXCLUDED.nome,
          mime = EXCLUDED.mime,
          tamanho = EXCLUDED.tamanho,
          arquivo = EXCLUDED.arquivo,
          atualizado_por = EXCLUDED.atualizado_por,
          atualizado_em = NOW()
      `,
      [nomeBase, mimeFinal, size, req.file.buffer, actorId]
    );

    logInfo(requestId, "subirModeloBanner:ok", {
      nome: nomeFinal,
      tamanho: size,
      mime: mimeFinal,
      usuario_id: actorId,
      checksum: checksum.slice(0, 12),
    });

    return sucesso(res, {
      status: 201,
      data: {
        tipo: "banner",
        nome: nomeFinal,
        tamanho: size,
        mime: mimeFinal,
        checksum_sha256: checksum,
        persistido_em: "banco",
      },
      message: "Modelo de banner atualizado com sucesso.",
      code: "MODELO_BANNER_ATUALIZADO",
    });
  } catch (error) {
    return tratarErroUpload(
      res,
      requestId,
      error,
      "Erro ao subir modelo de banner"
    );
  }
}

module.exports = {
  baixarModeloBanner,
  subirModeloBanner,
};