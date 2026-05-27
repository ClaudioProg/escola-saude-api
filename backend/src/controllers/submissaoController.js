/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/controllers/submissaoController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Controller exclusivo de SUBMISSÕES DE TRABALHOS.
 *
 * Responsabilidades deste arquivo:
 * - listar submissões para administração;
 * - listar submissões por chamada;
 * - obter detalhe de submissão;
 * - listar submissões do usuário autenticado;
 * - baixar poster/arquivo da submissão;
 * - gerenciar avaliadores da submissão;
 * - listar avaliações/notas da submissão;
 * - registrar avaliação escrita/oral;
 * - definir visibilidade da nota;
 * - definir status final da submissão;
 * - consolidar classificação por chamada;
 * - listar atribuições do avaliador;
 * - listar pendências do avaliador;
 * - gerar contagens do avaliador;
 * - materializar notas.
 *
 * Fora deste arquivo:
 * - CRUD de chamada;
 * - modelos de chamada;
 * - modelo de banner/oral da chamada;
 * - certificado de trabalho;
 * - votação pública.
 *
 * Contratos v2.0:
 * - DB oficial via req.db.query;
 * - usuário autenticado via req.user.id;
 * - perfil oficial via req.user.perfil;
 * - sem req.usuario;
 * - sem req.auth;
 * - sem req.userId;
 * - sem rootDb global;
 * - sem schema discovery;
 * - sem aliases de tabelas;
 * - sem respostas { error } ou { erro };
 * - sem ALTER TABLE dentro do controller.
 *
 * Tabelas oficiais esperadas:
 * - trabalhos_submissoes
 * - trabalhos_submissoes_avaliadores
 * - trabalhos_avaliacoes_itens
 * - trabalhos_arquivos
 * - trabalhos_chamadas
 * - trabalhos_chamada_linhas
 * - trabalhos_chamada_criterios
 * - trabalhos_chamada_criterios_orais
 * - usuarios
 */

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

/* =========================================================================
   Constantes oficiais
=========================================================================== */

const STATUS_SUBMISSAO = Object.freeze([
  "rascunho",
  "submetida",
  "em_avaliacao",
  "aprovada_exposicao",
  "aprovada_oral",
  "aprovada",
  "reprovada",
  "cancelada",
]);

const STATUS_AVALIACAO = Object.freeze([
  "pendente",
  "em_avaliacao",
  "aprovado",
  "reprovado",
]);

const TIPO_AVALIACAO = Object.freeze([
  "escrita",
  "oral",
]);

const NOTA_MINIMA = 0;
const NOTA_MAXIMA = 10;

/* =========================================================================
   Erros / resposta padrão
=========================================================================== */

function criarErro(message, status = 400, extras = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = extras.code || "ERRO_REQUISICAO";
  error.adminHint = extras.adminHint || null;
  error.details = extras.details || null;
  return error;
}

function assert(condicao, message, status = 400, extras = {}) {
  if (!condicao) {
    throw criarErro(message, status, extras);
  }
}

function responder(res, data = null, meta = null, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    message: null,
    meta,
  });
}

/* =========================================================================
   Log
=========================================================================== */

const IS_DEV = process.env.NODE_ENV !== "production";

function requestId(req) {
  return req?.requestId || req?.rid || `SUBMISSAO-${Date.now().toString(36)}`;
}

function logInfo(req, message, extra = null) {
  if (!IS_DEV) return;
  console.log(`[${requestId(req)}] • ${message}`, extra || "");
}

function logWarn(req, message, extra = null) {
  console.warn(`[${requestId(req)}] ⚠ ${message}`, extra || "");
}

function logError(req, message, error) {
  console.error(
    `[${requestId(req)}] ✖ ${message}`,
    error?.stack || error?.message || error
  );
}

/* =========================================================================
   DB oficial
=========================================================================== */

function getDb(req) {
  const db = req?.db;

  if (!db || typeof db.query !== "function") {
    throw criarErro("Banco de dados indisponível na requisição.", 500, {
      code: "DB_INDISPONIVEL",
      adminHint:
        "O middleware injectDb deve popular req.db com instância oficial contendo query(sql, params).",
    });
  }

  return db;
}

async function query(req, sql, params = []) {
  return getDb(req).query(sql, params);
}

async function queryOne(req, sql, params = []) {
  const result = await query(req, sql, params);
  return result.rows?.[0] || null;
}

async function queryMany(req, sql, params = []) {
  const result = await query(req, sql, params);
  return result.rows || [];
}

async function transaction(req, callback) {
  const db = getDb(req);

  await db.query("BEGIN");

  try {
    const tx = {
      query: (sql, params = []) => db.query(sql, params),
      one: async (sql, params = []) => {
        const result = await db.query(sql, params);
        return result.rows?.[0] || null;
      },
      many: async (sql, params = []) => {
        const result = await db.query(sql, params);
        return result.rows || [];
      },
      none: async (sql, params = []) => {
        await db.query(sql, params);
      },
    };

    const output = await callback(tx);
    await db.query("COMMIT");
    return output;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch (rollbackError) {
      logWarn(req, "Falha ao executar ROLLBACK.", rollbackError);
    }

    throw error;
  }
}

/* =========================================================================
   Normalização / auth
=========================================================================== */

function toId(value, fieldName = "ID") {
  const id = Number(value);

  assert(Number.isInteger(id) && id > 0, `${fieldName} inválido.`, 400, {
    code: "ID_INVALIDO",
    details: { field: fieldName },
  });

  return id;
}

function getUsuarioId(req) {
  const id = Number(req.user?.id);

  assert(Number.isInteger(id) && id > 0, "Usuário não autenticado.", 401, {
    code: "AUTH_OBRIGATORIA",
    adminHint: "req.user.id não foi encontrado após o middleware de autenticação.",
  });

  return id;
}

function perfilArray(req) {
  const perfil = req.user?.perfil;

  if (Array.isArray(perfil)) {
    return perfil.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  if (typeof perfil === "string") {
    return perfil
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function isAdmin(req) {
  return perfilArray(req).includes("administrador");
}

function requireAdmin(req) {
  assert(isAdmin(req), "Acesso restrito a administradores.", 403, {
    code: "ACESSO_NEGADO",
  });
}

function textoOpcional(value, max, fieldName) {
  if (value == null || String(value).trim() === "") return null;

  const text = String(value).trim();

  assert(text.length <= max, `${fieldName} deve ter até ${max} caracteres.`, 400, {
    code: "CAMPO_TAMANHO_INVALIDO",
    details: { field: fieldName, max },
  });

  return text;
}

function normalizarTipoAvaliacao(value) {
  const tipo = String(value || "").trim().toLowerCase();

  assert(TIPO_AVALIACAO.includes(tipo), "Tipo de avaliação inválido.", 400, {
    code: "TIPO_AVALIACAO_INVALIDO",
    details: { aceitos: TIPO_AVALIACAO },
  });

  return tipo;
}

function normalizarStatusAvaliacao(value, fallback = "em_avaliacao") {
  const status = value == null ? fallback : String(value).trim().toLowerCase();

  assert(STATUS_AVALIACAO.includes(status), "Status de avaliação inválido.", 400, {
    code: "STATUS_AVALIACAO_INVALIDO",
    details: { aceitos: STATUS_AVALIACAO },
  });

  return status;
}

function normalizarStatusSubmissao(value) {
  const status = String(value || "").trim().toLowerCase();

  assert(STATUS_SUBMISSAO.includes(status), "Status de submissão inválido.", 400, {
    code: "STATUS_SUBMISSAO_INVALIDO",
    details: { aceitos: STATUS_SUBMISSAO },
  });

  return status;
}

function normalizarBoolean(value, fieldName = "booleano") {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalizado = value.trim().toLowerCase();

    if (normalizado === "true") return true;
    if (normalizado === "false") return false;
  }

  throw criarErro(`${fieldName} inválido. Use true ou false.`, 400, {
    code: "BOOLEAN_INVALIDO",
    details: { field: fieldName },
  });
}

function normalizarNota(value, fieldName = "nota") {
  const nota = Number(value);

  assert(
    Number.isFinite(nota) && nota >= NOTA_MINIMA && nota <= NOTA_MAXIMA,
    `${fieldName} inválida. Use valor entre ${NOTA_MINIMA} e ${NOTA_MAXIMA}.`,
    400,
    {
      code: "NOTA_INVALIDA",
      details: { field: fieldName, min: NOTA_MINIMA, max: NOTA_MAXIMA },
    }
  );

  return nota;
}

function normalizarNotas(body) {
  const itens = Array.isArray(body?.itens)
    ? body.itens
    : Array.isArray(body?.notas)
      ? body.notas
      : [];

  assert(itens.length > 0, "Informe ao menos uma nota de critério.", 400, {
    code: "AVALIACAO_SEM_ITENS",
    adminHint:
      "Contrato oficial: envie { itens: [{ criterio_id, nota, comentarios? }] }.",
  });

  return itens.map((item, index) => ({
    criterio_id: toId(item?.criterio_id, `itens[${index}].criterio_id`),
    nota: normalizarNota(item?.nota, `itens[${index}].nota`),
    comentarios: textoOpcional(item?.comentarios, 5000, `itens[${index}].comentarios`),
  }));
}

/* =========================================================================
   Helpers de submissão
=========================================================================== */

async function obterSubmissaoBase(req, submissaoId) {
  return queryOne(
    req,
    `
    SELECT
      s.*,
      c.titulo AS chamada_titulo,
      c.prazo_final_br,
      c.publicado AS chamada_publicada,
      tcl.nome AS linha_tematica_nome,
      u.nome AS autor_nome,
      u.email AS autor_email
    FROM trabalhos_submissoes s
    LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
    LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
    LEFT JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.id = $1
    `,
    [submissaoId]
  );
}

async function usuarioPodeAcessarSubmissao(req, submissao) {
  if (isAdmin(req)) return true;

  const usuarioId = getUsuarioId(req);

  if (Number(submissao.usuario_id) === Number(usuarioId)) return true;

  const vinculo = await queryOne(
    req,
    `
    SELECT 1
    FROM trabalhos_submissoes_avaliadores
    WHERE submissao_id = $1
      AND avaliador_id = $2
      AND revoked_at IS NULL
    LIMIT 1
    `,
    [submissao.id, usuarioId]
  );

  return Boolean(vinculo);
}

function derivarFlagsAprovacao(row) {
  const status = String(row?.status || "").toLowerCase();
  const escrita = String(row?.status_escrita || "").toLowerCase();
  const oral = String(row?.status_oral || "").toLowerCase();

  return {
    _exposicao_aprovada:
      escrita === "aprovado" ||
      status === "aprovada_exposicao" ||
      status === "aprovada",
    _oral_aprovada:
      oral === "aprovado" ||
      status === "aprovada_oral" ||
      status === "aprovada",
  };
}

function criterioTablePorTipo(tipo) {
  return tipo === "oral"
    ? "trabalhos_chamada_criterios_orais"
    : "trabalhos_chamada_criterios";
}

/* =========================================================================
   Notas
=========================================================================== */

async function calcularTotaisDaSubmissaoTx(submissaoId, tx) {
  const row = await tx.one(
    `
    WITH por_avaliador AS (
      SELECT
        avaliador_id,
        SUM(nota)::numeric AS total
      FROM trabalhos_avaliacoes_itens
      WHERE submissao_id = $1
      GROUP BY avaliador_id
    )
    SELECT
      COALESCE(SUM(total), 0)::numeric AS total_geral,
      ROUND(COALESCE(SUM(total), 0)::numeric / NULLIF(COUNT(*), 0), 2) AS media_por_avaliador,
      COUNT(*)::int AS qtd_avaliadores
    FROM por_avaliador
    `,
    [submissaoId]
  );

  const qtd = Number(row?.qtd_avaliadores || 0);

  return {
    total_geral: Number(row?.total_geral || 0),
    nota_media: qtd > 0 ? Number(row?.media_por_avaliador || 0) : null,
    qtd_avaliadores: qtd,
  };
}

async function calcularNotaPorTipoTx(submissaoId, tipo, tx) {
  const criterioTable = criterioTablePorTipo(tipo);

  const row = await tx.one(
    `
    WITH criterios_tipo AS (
      SELECT id
      FROM ${criterioTable}
      WHERE chamada_id = (
        SELECT chamada_id
        FROM trabalhos_submissoes
        WHERE id = $1
      )
    ),
    por_avaliador AS (
      SELECT
        ai.avaliador_id,
        AVG(ai.nota)::numeric AS media_avaliador
      FROM trabalhos_avaliacoes_itens ai
      JOIN criterios_tipo ct ON ct.id = ai.criterio_id
      WHERE ai.submissao_id = $1
      GROUP BY ai.avaliador_id
    )
    SELECT
      ROUND(AVG(media_avaliador), 2) AS nota
    FROM por_avaliador
    `,
    [submissaoId]
  );

  return row?.nota == null ? null : Number(row.nota);
}

exports.calcularTotaisDaSubmissao = async (req, res, next) => {
  try {
    const submissaoId = toId(req.params.id || req.params.submissaoId);

    const data = await transaction(req, async (tx) =>
      calcularTotaisDaSubmissaoTx(submissaoId, tx)
    );

    return responder(res, data);
  } catch (error) {
    logError(req, "Erro ao calcular totais da submissão.", error);
    return next(error);
  }
};

async function atualizarNotaMediaMaterializadaInterna(req, submissaoId, tx) {
  const totais = await calcularTotaisDaSubmissaoTx(submissaoId, tx);
  const notaEscrita = await calcularNotaPorTipoTx(submissaoId, "escrita", tx);
  const notaOral = await calcularNotaPorTipoTx(submissaoId, "oral", tx);

  let notaFinal = null;

  if (notaEscrita != null && notaOral != null) {
    notaFinal = Number(((notaEscrita + notaOral) / 2).toFixed(2));
  } else if (notaEscrita != null) {
    notaFinal = notaEscrita;
  } else if (notaOral != null) {
    notaFinal = notaOral;
  } else {
    notaFinal = totais.nota_media;
  }

  await tx.none(
    `
    UPDATE trabalhos_submissoes
       SET nota_media = $2,
           nota_escrita = $3,
           nota_oral = $4,
           nota_final = $5,
           atualizado_em = NOW()
     WHERE id = $1
    `,
    [submissaoId, totais.nota_media, notaEscrita, notaOral, notaFinal]
  );

  return {
    ...totais,
    nota_escrita: notaEscrita,
    nota_oral: notaOral,
    nota_final: notaFinal,
  };
}

exports.atualizarNotaMediaMaterializada = async (req, res, next) => {
  try {
    const submissaoId = toId(req.params.id || req.params.submissaoId);

    const data = await transaction(req, async (tx) =>
      atualizarNotaMediaMaterializadaInterna(req, submissaoId, tx)
    );

    return responder(res, data);
  } catch (error) {
    logError(req, "Erro ao atualizar nota materializada.", error);
    return next(error);
  }
};

/* =========================================================================
   Admin — listagens
=========================================================================== */

exports.listarAdmin = async (req, res, next) => {
  try {
    requireAdmin(req);

    const chamadaId = req.params.chamadaId
      ? toId(req.params.chamadaId, "chamadaId")
      : req.query.chamada_id
        ? toId(req.query.chamada_id, "chamada_id")
        : null;

    const status = req.query.status
      ? normalizarStatusSubmissao(req.query.status)
      : null;

    const params = [];
    const where = [];

    if (chamadaId) {
      params.push(chamadaId);
      where.push(`s.chamada_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`s.status = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await queryMany(
      req,
      `
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        s.usuario_id,
        s.criado_em AS submetido_em,
        s.atualizado_em,
        s.nota_escrita,
        s.nota_oral,
        s.nota_final,
        COALESCE(s.nota_visivel, false) AS nota_visivel,
        c.titulo AS chamada_titulo,
        tcl.nome AS linha_tematica_nome,
        u.nome AS autor_nome,
        u.email AS autor_email,
        (
          SELECT COUNT(*)::int
          FROM trabalhos_submissoes_avaliadores tsa
          WHERE tsa.submissao_id = s.id
            AND tsa.revoked_at IS NULL
        ) AS total_avaliadores,
        (
          SELECT COUNT(DISTINCT ai.avaliador_id)::int
          FROM trabalhos_avaliacoes_itens ai
          WHERE ai.submissao_id = s.id
        ) AS total_avaliadores_com_nota
      FROM trabalhos_submissoes s
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      ${whereSql}
      ORDER BY s.criado_em DESC NULLS LAST, s.id DESC
      `,
      params
    );

    const data = rows.map((row) => ({
      ...row,
      ...derivarFlagsAprovacao(row),
    }));

    return responder(res, data, {
      total: data.length,
      chamada_id: chamadaId,
      status,
    });
  } catch (error) {
    logError(req, "Erro ao listar submissões administrativas.", error);
    return next(error);
  }
};

exports.listarPorChamadaAdmin = async (req, res, next) => {
  try {
    req.query.chamada_id = req.params.chamadaId;
    return exports.listarAdmin(req, res, next);
  } catch (error) {
    return next(error);
  }
};

exports.resumoAvaliadores = async (req, res, next) => {
  try {
    requireAdmin(req);

    const rows = await queryMany(
      req,
      `
      WITH atribuicoes AS (
        SELECT DISTINCT
          tsa.avaliador_id,
          tsa.submissao_id
        FROM trabalhos_submissoes_avaliadores tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliacoes AS (
        SELECT DISTINCT
          ai.avaliador_id,
          ai.submissao_id
        FROM trabalhos_avaliacoes_itens ai
      )
      SELECT
        u.id,
        COALESCE(u.nome, '') AS nome,
        COALESCE(u.email, '') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)::int AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL)::int AS avaliados
      FROM atribuicoes at
      JOIN usuarios u ON u.id = at.avaliador_id
      LEFT JOIN avaliacoes av
        ON av.avaliador_id = at.avaliador_id
       AND av.submissao_id = at.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC,
        u.nome ASC
      `
    );

    const data = rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      email: row.email,
      pendentes: Number(row.pendentes || 0),
      avaliados: Number(row.avaliados || 0),
      total: Number(row.pendentes || 0) + Number(row.avaliados || 0),
    }));

    return responder(res, {
      avaliadores: data,
    });
  } catch (error) {
    logError(req, "Erro ao gerar resumo de avaliadores.", error);
    return next(error);
  }
};

/* =========================================================================
   Detalhe / usuário autor
=========================================================================== */

exports.obterSubmissao = async (req, res, next) => {
  try {
    const submissaoId = toId(req.params.id);
    const row = await obterSubmissaoBase(req, submissaoId);

    assert(row, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    const allowed = await usuarioPodeAcessarSubmissao(req, row);

    assert(allowed, "Acesso negado.", 403, {
      code: "ACESSO_NEGADO",
    });

    return responder(res, {
      ...row,
      ...derivarFlagsAprovacao(row),
    });
  } catch (error) {
    logError(req, "Erro ao obter submissão.", error);
    return next(error);
  }
};

exports.listarMinhas = async (req, res, next) => {
  try {
    const usuarioId = getUsuarioId(req);

    const rows = await queryMany(
      req,
      `
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        s.criado_em AS submetido_em,
        s.atualizado_em,
        s.nota_escrita,
        s.nota_oral,
        s.nota_final,
        COALESCE(s.nota_visivel, false) AS nota_visivel,
        c.titulo AS chamada_titulo,
        c.publicado AS chamada_publicada,
        tcl.nome AS linha_tematica_nome
      FROM trabalhos_submissoes s
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      WHERE s.usuario_id = $1
      ORDER BY s.criado_em DESC NULLS LAST, s.id DESC
      `,
      [usuarioId]
    );

    const data = rows.map((row) => ({
      ...row,
      nota_media: row.nota_visivel ? row.nota_media : null,
      nota_escrita: row.nota_visivel ? row.nota_escrita : null,
      nota_oral: row.nota_visivel ? row.nota_oral : null,
      nota_final: row.nota_visivel ? row.nota_final : null,
      ...derivarFlagsAprovacao(row),
    }));

    return responder(res, data, {
      total: data.length,
    });
  } catch (error) {
    logError(req, "Erro ao listar submissões do usuário.", error);
    return next(error);
  }
};

/* =========================================================================
   Arquivo / poster da submissão
=========================================================================== */

function guessMimeByExt(filename = "") {
  const ext = String(filename).toLowerCase().split(".").pop();

  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";

  return "application/octet-stream";
}

function safeBasename(name) {
  const base = String(name || "arquivo")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_");

  return base || "arquivo";
}

function resolverCaminhoUpload(rawPath) {
  const raw = String(rawPath || "").trim();

  if (!raw) return null;

  const normalizedRel = raw.replace(/^uploads[\\/]/i, "");
  const resolved = path.normalize(
    path.isAbsolute(raw) ? raw : path.resolve("uploads", normalizedRel)
  );

  if (!path.isAbsolute(raw)) {
    const uploadsRoot = path.resolve("uploads") + path.sep;

    if (!resolved.startsWith(uploadsRoot)) {
      return null;
    }
  }

  return resolved;
}

exports.baixarPoster = async (req, res, next) => {
  try {
    const submissaoId = toId(req.params.id);

    const submissao = await obterSubmissaoBase(req, submissaoId);

    assert(submissao, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    const allowed = await usuarioPodeAcessarSubmissao(req, submissao);

    assert(allowed, "Acesso negado.", 403, {
      code: "ACESSO_NEGADO",
    });

    const arquivo = await queryOne(
      req,
      `
      SELECT
        a.id,
        a.caminho,
        a.nome_original,
        a.mime_type
      FROM trabalhos_arquivos a
      WHERE a.id = $1
      `,
      [submissao.poster_arquivo_id]
    );

    assert(arquivo, "Nenhum arquivo associado a esta submissão.", 404, {
      code: "POSTER_NAO_ENCONTRADO",
    });

    const absPath = resolverCaminhoUpload(arquivo.caminho);

    assert(absPath, "Caminho de arquivo inválido.", 400, {
      code: "CAMINHO_ARQUIVO_INVALIDO",
      adminHint:
        "O caminho salvo em trabalhos_arquivos.caminho não está dentro do diretório uploads.",
    });

    const stat = await fsp.stat(absPath).catch(() => null);

    assert(stat?.isFile(), "Arquivo ausente no servidor.", 404, {
      code: "ARQUIVO_AUSENTE",
      adminHint:
        "Há registro em trabalhos_arquivos, mas o arquivo físico não foi localizado.",
    });

    const mime = arquivo.mime_type || guessMimeByExt(arquivo.nome_original || absPath);

    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(
        safeBasename(arquivo.nome_original || `poster_${submissaoId}`)
      )}`
    );
    res.setHeader("Content-Length", String(stat.size));

    const stream = fs.createReadStream(absPath);

    stream.on("error", (error) => {
      logError(req, "Erro no stream do poster.", error);

      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    return stream.pipe(res);
  } catch (error) {
    logError(req, "Erro ao baixar poster da submissão.", error);
    return next(error);
  }
};

/**
 * Nome funcional mantido porque o domínio anterior chamava "banner".
 * Não é alias de rota; é a mesma responsabilidade: baixar arquivo/poster da submissão.
 */
exports.baixarBanner = exports.baixarPoster;

/* =========================================================================
   Avaliadores da submissão
=========================================================================== */

exports.listarAvaliadores = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const tipo = req.query.tipo ? normalizarTipoAvaliacao(req.query.tipo) : null;

    const params = [submissaoId];
    const whereTipo = tipo ? "AND tsa.tipo = $2" : "";

    if (tipo) params.push(tipo);

    const rows = await queryMany(
      req,
      `
      SELECT
        tsa.submissao_id,
        tsa.avaliador_id,
        tsa.tipo,
        tsa.assigned_by,
        tsa.created_at,
        tsa.revoked_at,
        u.nome AS avaliador_nome,
        u.email AS avaliador_email,
        ub.nome AS atribuido_por_nome
      FROM trabalhos_submissoes_avaliadores tsa
      JOIN usuarios u ON u.id = tsa.avaliador_id
      LEFT JOIN usuarios ub ON ub.id = tsa.assigned_by
      WHERE tsa.submissao_id = $1
        AND tsa.revoked_at IS NULL
        ${whereTipo}
      ORDER BY tsa.tipo ASC, u.nome ASC
      `,
      params
    );

    return responder(res, rows, {
      total: rows.length,
      submissao_id: submissaoId,
      tipo,
    });
  } catch (error) {
    logError(req, "Erro ao listar avaliadores da submissão.", error);
    return next(error);
  }
};

exports.incluirAvaliadores = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const usuarioId = getUsuarioId(req);

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

    assert(itens.length > 0, "Informe os avaliadores a incluir.", 400, {
      code: "AVALIADORES_OBRIGATORIOS",
      adminHint:
        "Contrato oficial: envie { itens: [{ avaliador_id, tipo }] }, tipo escrita|oral.",
    });

    const normalizados = itens.map((item, index) => ({
      avaliador_id: toId(item?.avaliador_id, `itens[${index}].avaliador_id`),
      tipo: normalizarTipoAvaliacao(item?.tipo),
    }));

    const avaliadorIds = Array.from(
      new Set(normalizados.map((item) => Number(item.avaliador_id)))
    );

    const elegiveis = await queryMany(
      req,
      `
      SELECT id
      FROM usuarios
      WHERE id = ANY($1::int[])
        AND (
          'organizador' = ANY(string_to_array(LOWER(COALESCE(perfil, '')), ','))
          OR 'administrador' = ANY(string_to_array(LOWER(COALESCE(perfil, '')), ','))
        )
      `,
      [avaliadorIds]
    );

    const elegiveisSet = new Set(elegiveis.map((row) => Number(row.id)));
    const invalidos = avaliadorIds.filter((id) => !elegiveisSet.has(Number(id)));

    assert(invalidos.length === 0, "Há usuários sem perfil elegível para avaliação.", 400, {
      code: "AVALIADOR_NAO_ELEGIVEL",
      details: { usuarios: invalidos },
    });

    const inseridos = await transaction(req, async (tx) => {
      const output = [];

      for (const item of normalizados) {
        const row = await tx.one(
          `
          INSERT INTO trabalhos_submissoes_avaliadores
            (
              submissao_id,
              avaliador_id,
              tipo,
              assigned_by,
              created_at,
              revoked_at
            )
          VALUES
            ($1,$2,$3,$4,NOW(),NULL)
          ON CONFLICT (submissao_id, avaliador_id, tipo)
          DO UPDATE
             SET revoked_at = NULL,
                 assigned_by = EXCLUDED.assigned_by
          RETURNING
            submissao_id,
            avaliador_id,
            tipo,
            assigned_by,
            created_at,
            revoked_at
          `,
          [submissaoId, item.avaliador_id, item.tipo, usuarioId]
        );

        output.push(row);
      }

      await tx.none(
        `
        UPDATE trabalhos_submissoes
           SET status = CASE
                          WHEN status IN ('rascunho', 'submetida') THEN 'em_avaliacao'
                          ELSE status
                        END,
               atualizado_em = NOW()
         WHERE id = $1
        `,
        [submissaoId]
      );

      return output;
    });

    return responder(
      res,
      {
        inseridos: inseridos.length,
        itens: inseridos,
      },
      null,
      201
    );
  } catch (error) {
    logError(req, "Erro ao incluir avaliadores.", error);
    return next(error);
  }
};

exports.revogarAvaliador = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const avaliadorId = toId(req.body?.avaliador_id, "avaliador_id");
    const tipo = normalizarTipoAvaliacao(req.body?.tipo);

    const result = await query(
      req,
      `
      UPDATE trabalhos_submissoes_avaliadores
         SET revoked_at = NOW()
       WHERE submissao_id = $1
         AND avaliador_id = $2
         AND tipo = $3
         AND revoked_at IS NULL
      `,
      [submissaoId, avaliadorId, tipo]
    );

    assert(result.rowCount > 0, "Vínculo ativo não encontrado.", 404, {
      code: "AVALIADOR_VINCULO_NAO_ENCONTRADO",
    });

    return responder(res, {
      submissao_id: submissaoId,
      avaliador_id: avaliadorId,
      tipo,
      revogado: true,
    });
  } catch (error) {
    logError(req, "Erro ao revogar avaliador.", error);
    return next(error);
  }
};

exports.restaurarAvaliador = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const avaliadorId = toId(req.body?.avaliador_id, "avaliador_id");
    const tipo = normalizarTipoAvaliacao(req.body?.tipo);

    const result = await query(
      req,
      `
      UPDATE trabalhos_submissoes_avaliadores
         SET revoked_at = NULL
       WHERE submissao_id = $1
         AND avaliador_id = $2
         AND tipo = $3
         AND revoked_at IS NOT NULL
      `,
      [submissaoId, avaliadorId, tipo]
    );

    assert(result.rowCount > 0, "Vínculo revogado não encontrado.", 404, {
      code: "AVALIADOR_VINCULO_NAO_ENCONTRADO",
    });

    return responder(res, {
      submissao_id: submissaoId,
      avaliador_id: avaliadorId,
      tipo,
      restaurado: true,
    });
  } catch (error) {
    logError(req, "Erro ao restaurar avaliador.", error);
    return next(error);
  }
};

/* =========================================================================
   Avaliações / notas
=========================================================================== */

exports.listarAvaliacaoDaSubmissao = async (req, res, next) => {
  try {
    const submissaoId = toId(req.params.id);

    const submissao = await obterSubmissaoBase(req, submissaoId);

    assert(submissao, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    const allowed = await usuarioPodeAcessarSubmissao(req, submissao);

    assert(allowed, "Acesso negado.", 403, {
      code: "ACESSO_NEGADO",
    });

    const itens = await queryMany(
      req,
      `
      SELECT
        ai.id,
        ai.submissao_id,
        ai.avaliador_id,
        u.nome AS avaliador_nome,
        ai.criterio_id,
        COALESCE(ce.titulo, co.titulo) AS criterio_titulo,
        CASE
          WHEN ce.id IS NOT NULL THEN 'escrita'
          WHEN co.id IS NOT NULL THEN 'oral'
          ELSE NULL
        END AS tipo,
        ai.nota,
        ai.comentarios,
        ai.criado_em
      FROM trabalhos_avaliacoes_itens ai
      LEFT JOIN usuarios u ON u.id = ai.avaliador_id
      LEFT JOIN trabalhos_chamada_criterios ce ON ce.id = ai.criterio_id
      LEFT JOIN trabalhos_chamada_criterios_orais co ON co.id = ai.criterio_id
      WHERE ai.submissao_id = $1
      ORDER BY
        tipo ASC NULLS LAST,
        avaliador_nome ASC NULLS LAST,
        ai.criterio_id ASC,
        ai.criado_em ASC
      `,
      [submissaoId]
    );

    const totais = await transaction(req, async (tx) =>
      calcularTotaisDaSubmissaoTx(submissaoId, tx)
    );

    const data = {
      submissao_id: submissaoId,
      nota_visivel: Boolean(submissao.nota_visivel),
      linha_tematica_nome: submissao.linha_tematica_nome || null,
      itens,
      totais,
    };

    return responder(res, data);
  } catch (error) {
    logError(req, "Erro ao listar avaliação da submissão.", error);
    return next(error);
  }
};

async function registrarAvaliacao(req, res, next, tipo) {
  try {
    const submissaoId = toId(req.params.id);
    const avaliadorId = getUsuarioId(req);
    const tipoOficial = normalizarTipoAvaliacao(tipo);
    const statusResultado = normalizarStatusAvaliacao(
      req.body?.status_resultado,
      "em_avaliacao"
    );
    const itens = normalizarNotas(req.body);

    const submissao = await obterSubmissaoBase(req, submissaoId);

    assert(submissao, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    const allowed = await usuarioPodeAcessarSubmissao(req, submissao);

    assert(allowed, "Acesso negado.", 403, {
      code: "ACESSO_NEGADO",
    });

    const vinculo = await queryOne(
      req,
      `
      SELECT 1
      FROM trabalhos_submissoes_avaliadores
      WHERE submissao_id = $1
        AND avaliador_id = $2
        AND tipo = $3
        AND revoked_at IS NULL
      LIMIT 1
      `,
      [submissaoId, avaliadorId, tipoOficial]
    );

    assert(vinculo || isAdmin(req), "Você não está vinculado a esta avaliação.", 403, {
      code: "AVALIADOR_NAO_VINCULADO",
    });

    const criterioTable = criterioTablePorTipo(tipoOficial);
    const criterioIds = itens.map((item) => item.criterio_id);

    const criteriosValidos = await queryMany(
      req,
      `
      SELECT id
      FROM ${criterioTable}
      WHERE chamada_id = $1
        AND id = ANY($2::int[])
      `,
      [submissao.chamada_id, criterioIds]
    );

    const validosSet = new Set(criteriosValidos.map((row) => Number(row.id)));
    const invalidos = criterioIds.filter((id) => !validosSet.has(Number(id)));

    assert(invalidos.length === 0, "Há critérios inválidos para esta chamada.", 400, {
      code: "CRITERIO_INVALIDO",
      details: { criterios: invalidos, tipo: tipoOficial },
    });

    const resultado = await transaction(req, async (tx) => {
      await tx.none(
        `
        DELETE FROM trabalhos_avaliacoes_itens
        WHERE submissao_id = $1
          AND avaliador_id = $2
          AND criterio_id IN (
            SELECT id
            FROM ${criterioTable}
            WHERE chamada_id = $3
          )
        `,
        [submissaoId, avaliadorId, submissao.chamada_id]
      );

      for (const item of itens) {
        await tx.none(
          `
          INSERT INTO trabalhos_avaliacoes_itens
            (
              submissao_id,
              avaliador_id,
              criterio_id,
              nota,
              comentarios,
              criado_em
            )
          VALUES
            ($1,$2,$3,$4,$5,NOW())
          `,
          [
            submissaoId,
            avaliadorId,
            item.criterio_id,
            item.nota,
            item.comentarios,
          ]
        );
      }

      const colunaStatus =
        tipoOficial === "oral" ? "status_oral" : "status_escrita";

      await tx.none(
        `
        UPDATE trabalhos_submissoes
           SET ${colunaStatus} = $2,
               status = CASE
                          WHEN status IN ('rascunho', 'submetida') THEN 'em_avaliacao'
                          ELSE status
                        END,
               atualizado_em = NOW()
         WHERE id = $1
        `,
        [submissaoId, statusResultado]
      );

      const notas = await atualizarNotaMediaMaterializadaInterna(req, submissaoId, tx);

      return {
        submissao_id: submissaoId,
        avaliador_id: avaliadorId,
        tipo: tipoOficial,
        status_resultado: statusResultado,
        itens: itens.length,
        notas,
      };
    });

    logInfo(req, "Avaliação registrada.", resultado);

    return responder(res, resultado);
  } catch (error) {
    logError(req, `Erro ao registrar avaliação ${tipo}.`, error);
    return next(error);
  }
}

exports.avaliarEscrita = (req, res, next) =>
  registrarAvaliacao(req, res, next, "escrita");

exports.avaliarOral = (req, res, next) =>
  registrarAvaliacao(req, res, next, "oral");

exports.definirNotaVisivel = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const visivel = normalizarBoolean(req.body?.visivel, "visivel");

    const result = await query(
      req,
      `
      UPDATE trabalhos_submissoes
         SET nota_visivel = $2,
             atualizado_em = NOW()
       WHERE id = $1
      `,
      [submissaoId, visivel]
    );

    assert(result.rowCount > 0, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    return responder(res, {
      submissao_id: submissaoId,
      nota_visivel: visivel,
    });
  } catch (error) {
    logError(req, "Erro ao definir visibilidade da nota.", error);
    return next(error);
  }
};

exports.definirStatusFinal = async (req, res, next) => {
  try {
    requireAdmin(req);

    const submissaoId = toId(req.params.id);
    const status = normalizarStatusSubmissao(req.body?.status);
    const motivo = textoOpcional(req.body?.motivo, 5000, "motivo");

    const row = await queryOne(
      req,
      `
      UPDATE trabalhos_submissoes
         SET status = $2,
             motivo_status = $3,
             atualizado_em = NOW()
       WHERE id = $1
       RETURNING *
      `,
      [submissaoId, status, motivo]
    );

    assert(row, "Submissão não encontrada.", 404, {
      code: "SUBMISSAO_NAO_ENCONTRADA",
    });

    return responder(res, {
      ...row,
      ...derivarFlagsAprovacao(row),
    });
  } catch (error) {
    logError(req, "Erro ao definir status final da submissão.", error);
    return next(error);
  }
};

/* =========================================================================
   Classificação por chamada
=========================================================================== */

exports.consolidarClassificacao = async (req, res, next) => {
  try {
    requireAdmin(req);

    const chamadaId = toId(req.params.chamadaId, "chamadaId");

    const rows = await queryMany(
      req,
      `
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.nota_escrita,
        s.nota_oral,
        s.nota_final,
        s.usuario_id,
        u.nome AS autor_nome,
        tcl.nome AS linha_tematica_nome,
        ROW_NUMBER() OVER (
          ORDER BY
            s.nota_final DESC NULLS LAST,
            s.nota_media DESC NULLS LAST,
            s.criado_em ASC NULLS LAST,
            s.id ASC
        )::int AS classificacao_geral
      FROM trabalhos_submissoes s
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      WHERE s.chamada_id = $1
        AND s.status NOT IN ('rascunho', 'cancelada')
      ORDER BY
        classificacao_geral ASC
      `,
      [chamadaId]
    );

    return responder(res, rows, {
      chamada_id: chamadaId,
      total: rows.length,
    });
  } catch (error) {
    logError(req, "Erro ao consolidar classificação.", error);
    return next(error);
  }
};

/* =========================================================================
   Área do avaliador
=========================================================================== */

exports.listarAtribuidas = async (req, res, next) => {
  try {
    const avaliadorId = getUsuarioId(req);

    const rows = await queryMany(
      req,
      `
      SELECT
        tsa.submissao_id,
        tsa.tipo,
        tsa.created_at AS atribuida_em,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        c.titulo AS chamada_titulo,
        u.nome AS autor_nome,
        EXISTS (
          SELECT 1
          FROM trabalhos_avaliacoes_itens ai
          WHERE ai.submissao_id = tsa.submissao_id
            AND ai.avaliador_id = tsa.avaliador_id
        ) AS avaliada
      FROM trabalhos_submissoes_avaliadores tsa
      JOIN trabalhos_submissoes s ON s.id = tsa.submissao_id
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      WHERE tsa.avaliador_id = $1
        AND tsa.revoked_at IS NULL
      ORDER BY tsa.created_at DESC NULLS LAST, tsa.submissao_id DESC
      LIMIT 500
      `,
      [avaliadorId]
    );

    return responder(res, rows, {
      total: rows.length,
    });
  } catch (error) {
    logError(req, "Erro ao listar atribuições do avaliador.", error);
    return next(error);
  }
};

exports.listarPendentes = async (req, res, next) => {
  try {
    const avaliadorId = getUsuarioId(req);

    const rows = await queryMany(
      req,
      `
      SELECT
        tsa.submissao_id,
        tsa.tipo,
        tsa.created_at AS atribuida_em,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        c.titulo AS chamada_titulo,
        u.nome AS autor_nome
      FROM trabalhos_submissoes_avaliadores tsa
      JOIN trabalhos_submissoes s ON s.id = tsa.submissao_id
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN usuarios u ON u.id = s.usuario_id
      WHERE tsa.avaliador_id = $1
        AND tsa.revoked_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM trabalhos_avaliacoes_itens ai
          WHERE ai.submissao_id = tsa.submissao_id
            AND ai.avaliador_id = tsa.avaliador_id
        )
      ORDER BY tsa.created_at DESC NULLS LAST, tsa.submissao_id DESC
      LIMIT 500
      `,
      [avaliadorId]
    );

    return responder(res, rows, {
      total: rows.length,
    });
  } catch (error) {
    logError(req, "Erro ao listar pendências do avaliador.", error);
    return next(error);
  }
};

exports.minhasContagens = async (req, res, next) => {
  try {
    const avaliadorId = getUsuarioId(req);

    const row = await queryOne(
      req,
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = tsa.submissao_id
              AND ai.avaliador_id = tsa.avaliador_id
          )
        )::int AS pendentes,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = tsa.submissao_id
              AND ai.avaliador_id = tsa.avaliador_id
          )
        )::int AS finalizadas
      FROM trabalhos_submissoes_avaliadores tsa
      WHERE tsa.avaliador_id = $1
        AND tsa.revoked_at IS NULL
      `,
      [avaliadorId]
    );

    return responder(res, {
      total: Number(row?.total || 0),
      pendentes: Number(row?.pendentes || 0),
      finalizadas: Number(row?.finalizadas || 0),
    });
  } catch (error) {
    logError(req, "Erro ao obter contagens do avaliador.", error);
    return next(error);
  }
};

exports.paraMim = exports.listarAtribuidas;