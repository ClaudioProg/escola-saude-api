/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/controllers/trabalhoController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Controller exclusivo do fluxo de TRABALHO/AUTORIA.
 *
 * Responsabilidades deste arquivo:
 * - criar trabalho/submissão autoral;
 * - atualizar trabalho/submissão autoral;
 * - remover trabalho/submissão quando permitido;
 * - obter trabalho para edição/visualização do autor;
 * - enviar/atualizar banner/arquivo principal do trabalho;
 * - listar repositório institucional de trabalhos avaliados/aprovados.
 *
 * Fora deste arquivo:
 * - CRUD de chamada;
 * - modelos de chamada;
 * - avaliadores;
 * - avaliação escrita/oral;
 * - nota visível;
 * - status final administrativo;
 * - classificação;
 * - votação;
 * - certificados.
 *
 * Contratos v2.0:
 * - DB oficial via req.db.query;
 * - usuário autenticado via req.user.id;
 * - perfil oficial via req.user.perfil;
 * - sem req.usuario;
 * - sem req.auth;
 * - sem req.userId;
 * - sem import de submissaoController;
 * - sem db global/pg-promise;
 * - sem tabela singular trabalhos_submissao;
 * - sem aliases de status;
 * - sem respostas { erro } ou { error };
 * - sem schema discovery;
 * - sem fallback por coluna antiga.
 *
 * Tabelas oficiais esperadas:
 * - trabalhos_chamadas
 * - trabalhos_chamada_linhas
 * - trabalhos_submissoes
 * - trabalhos_coautores
 * - trabalhos_arquivos
 * - usuarios
 * - unidades
 *
 * Colunas oficiais esperadas em trabalhos_submissoes:
 * - id
 * - usuario_id
 * - chamada_id
 * - titulo
 * - inicio_experiencia
 * - linha_tematica_id
 * - linha_tematica_codigo
 * - introducao
 * - objetivos
 * - metodo
 * - resultados
 * - consideracao
 * - bibliografia
 * - status
 * - nota_media
 * - nota_escrita
 * - nota_oral
 * - nota_final
 * - criado_em
 * - atualizado_em
 */

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const crypto = require("crypto");

const { UPLOADS_DIR } = require("../paths");

const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
} = require("./notificacaoController");

/* =========================================================================
   Constantes oficiais
=========================================================================== */

const ZONA = "America/Sao_Paulo";

const STATUS_AUTOR = Object.freeze([
  "rascunho",
  "submetida",
]);

const STATUS_BLOQUEADOS_EDICAO_AUTOR = Object.freeze([
  "em_avaliacao",
  "aprovada_exposicao",
  "aprovada_oral",
  "aprovada",
  "reprovada",
  "cancelada",
]);

const MIME_BANNER_ACEITOS = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const EXT_BANNER_ACEITAS = Object.freeze([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".pdf",
  ".ppt",
  ".pptx",
]);

const TAMANHO_MAXIMO_BANNER_BYTES = 30 * 1024 * 1024;

/* =========================================================================
   Resposta / erros
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
  return req?.requestId || req?.rid || `TRABALHO-${Date.now().toString(36)}`;
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
   Normalização / autenticação
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

function textoObrigatorio(value, max, fieldName) {
  const text = String(value || "").trim();

  assert(text.length > 0, `${fieldName} é obrigatório.`, 400, {
    code: "CAMPO_OBRIGATORIO",
    details: { field: fieldName },
  });

  assert(text.length <= max, `${fieldName} deve ter até ${max} caracteres.`, 400, {
    code: "CAMPO_TAMANHO_INVALIDO",
    details: { field: fieldName, max },
  });

  return text;
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

function isYYYYMM(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizarPeriodoExperiencia(value) {
  const periodo = String(value || "").trim();

  assert(isYYYYMM(periodo), "Início da experiência deve estar no formato YYYY-MM.", 400, {
    code: "PERIODO_EXPERIENCIA_INVALIDO",
    details: { expected: "YYYY-MM" },
  });

  return periodo;
}

function normalizarStatusAutor(value) {
  const status = String(value || "submetida").trim().toLowerCase();

  assert(STATUS_AUTOR.includes(status), "Status de trabalho inválido.", 400, {
    code: "STATUS_TRABALHO_INVALIDO",
    details: { aceitos: STATUS_AUTOR },
  });

  return status;
}

function normalizarCoautores(value, maxCoautores) {
  const coautores = value == null ? [] : value;

  assert(Array.isArray(coautores), "Coautores devem ser enviados como lista.", 400, {
    code: "COAUTORES_INVALIDOS",
  });

  assert(
    coautores.length <= maxCoautores,
    `Máximo de ${maxCoautores} coautores permitido para esta chamada.`,
    400,
    {
      code: "COAUTORES_LIMITE_EXCEDIDO",
      details: {
        max_coautores: maxCoautores,
        total_enviado: coautores.length,
      },
    }
  );

  return coautores
    .map((coautor, index) => {
      if (!coautor?.nome || String(coautor.nome).trim() === "") return null;

      return {
        nome: textoObrigatorio(coautor.nome, 200, `coautores[${index}].nome`),
        email: textoOpcional(coautor.email, 255, `coautores[${index}].email`),
        unidade: textoOpcional(coautor.unidade, 255, `coautores[${index}].unidade`),
        papel: textoOpcional(coautor.papel, 255, `coautores[${index}].papel`),
        cpf: textoOpcional(coautor.cpf, 30, `coautores[${index}].cpf`),
        vinculo: textoOpcional(coautor.vinculo, 255, `coautores[${index}].vinculo`),
      };
    })
    .filter(Boolean);
}

function limiteDaChamada(chamada, campo, fallback) {
  const limites = chamada?.limites && typeof chamada.limites === "object"
    ? chamada.limites
    : {};

  const valor = Number(limites[campo]);

  return Number.isInteger(valor) && valor > 0 ? valor : fallback;
}

/* =========================================================================
   Chamada / regras de autoria
=========================================================================== */

async function obterChamadaParaSubmissao(req, chamadaId) {
  return queryOne(
    req,
    `
    SELECT
      c.*,
      (
        timezone($2, now()) <= c.prazo_final_br
      ) AS dentro_prazo
    FROM trabalhos_chamadas c
    WHERE c.id = $1
    `,
    [chamadaId, ZONA]
  );
}

async function obterTrabalhoComChamada(req, trabalhoId) {
  return queryOne(
    req,
    `
    SELECT
      s.*,
      c.titulo AS chamada_titulo,
      c.periodo_experiencia_inicio,
      c.periodo_experiencia_fim,
      c.max_coautores,
      c.limites,
      (
        timezone($2, now()) <= c.prazo_final_br
      ) AS dentro_prazo
    FROM trabalhos_submissoes s
    JOIN trabalhos_chamadas c ON c.id = s.chamada_id
    WHERE s.id = $1
    `,
    [trabalhoId, ZONA]
  );
}

function validarPermissaoAutorOuAdmin(req, trabalho, acao = "acessar") {
  const usuarioId = getUsuarioId(req);
  const ehAutor = Number(trabalho.usuario_id) === Number(usuarioId);
  const ehAdmin = isAdmin(req);

  assert(ehAutor || ehAdmin, `Sem permissão para ${acao} este trabalho.`, 403, {
    code: "ACESSO_NEGADO",
  });

  return {
    usuarioId,
    ehAutor,
    ehAdmin,
  };
}

function validarEdicaoPermitida(trabalho, ehAdmin = false) {
  if (ehAdmin) return;

  assert(Boolean(trabalho.dentro_prazo), "Prazo encerrado para alterações.", 409, {
    code: "PRAZO_ENCERRADO",
  });

  const status = String(trabalho.status || "").toLowerCase();

  assert(
    !STATUS_BLOQUEADOS_EDICAO_AUTOR.includes(status),
    "Trabalho em avaliação, aprovado, reprovado ou cancelado não pode ser editado pelo autor.",
    409,
    {
      code: "TRABALHO_EDICAO_BLOQUEADA",
      details: { status },
    }
  );
}

async function validarLinhaTematica(req, chamadaId, linhaTematicaId) {
  const linha = await queryOne(
    req,
    `
    SELECT id, codigo, nome
    FROM trabalhos_chamada_linhas
    WHERE id = $1
      AND chamada_id = $2
    `,
    [linhaTematicaId, chamadaId]
  );

  assert(linha, "Linha temática inválida para esta chamada.", 400, {
    code: "LINHA_TEMATICA_INVALIDA",
  });

  return linha;
}

function normalizarPayloadTrabalho(body, chamada, status) {
  const limTitulo = limiteDaChamada(chamada, "titulo", 100);
  const limIntroducao = limiteDaChamada(chamada, "introducao", 2000);
  const limObjetivos = limiteDaChamada(chamada, "objetivos", 1000);
  const limMetodo = limiteDaChamada(chamada, "metodo", 1500);
  const limResultados = limiteDaChamada(chamada, "resultados", 1500);
  const limConsideracao = limiteDaChamada(chamada, "consideracao", 1000);

  const payload = {
    titulo: textoObrigatorio(body.titulo, limTitulo, "Título"),
    inicio_experiencia: normalizarPeriodoExperiencia(body.inicio_experiencia),
    linha_tematica_id: toId(body.linha_tematica_id, "linha_tematica_id"),
    introducao: textoOpcional(body.introducao, limIntroducao, "Introdução"),
    objetivos: textoOpcional(body.objetivos, limObjetivos, "Objetivos"),
    metodo: textoOpcional(body.metodo, limMetodo, "Método/descrição da prática"),
    resultados: textoOpcional(body.resultados, limResultados, "Resultados/impactos"),
    consideracao: textoOpcional(body.consideracao, limConsideracao, "Considerações finais"),
    bibliografia: textoOpcional(body.bibliografia, 8000, "Bibliografia"),
  };

  if (status === "submetida") {
    assert(
      payload.inicio_experiencia >= chamada.periodo_experiencia_inicio &&
        payload.inicio_experiencia <= chamada.periodo_experiencia_fim,
      "Início da experiência fora do período permitido pela chamada.",
      400,
      {
        code: "PERIODO_FORA_DA_CHAMADA",
        details: {
          periodo_experiencia_inicio: chamada.periodo_experiencia_inicio,
          periodo_experiencia_fim: chamada.periodo_experiencia_fim,
        },
      }
    );

    payload.introducao = textoObrigatorio(body.introducao, limIntroducao, "Introdução");
    payload.objetivos = textoObrigatorio(body.objetivos, limObjetivos, "Objetivos");
    payload.metodo = textoObrigatorio(body.metodo, limMetodo, "Método/descrição da prática");
    payload.resultados = textoObrigatorio(body.resultados, limResultados, "Resultados/impactos");
    payload.consideracao = textoObrigatorio(
      body.consideracao,
      limConsideracao,
      "Considerações finais"
    );
  }

  return payload;
}

async function notificarSemBloquear(req, fn, payload, label) {
  if (typeof fn !== "function") return;

  try {
    await fn(payload);
  } catch (error) {
    logWarn(req, `Falha ao enviar notificação: ${label}.`, error);
  }
}

/* =========================================================================
   Criar / atualizar / obter / remover trabalho
=========================================================================== */

exports.criar = async (req, res, next) => {
  try {
    const chamadaId = toId(req.params.chamadaId, "chamadaId");
    const usuarioId = getUsuarioId(req);

    const chamada = await obterChamadaParaSubmissao(req, chamadaId);

    assert(chamada, "Chamada inexistente.", 404, {
      code: "CHAMADA_NAO_ENCONTRADA",
    });

    assert(Boolean(chamada.publicado), "Chamada não publicada.", 409, {
      code: "CHAMADA_NAO_PUBLICADA",
    });

    assert(Boolean(chamada.dentro_prazo), "O prazo de submissão encerrou.", 409, {
      code: "PRAZO_ENCERRADO",
    });

    const status = normalizarStatusAutor(req.body?.status);
    const payload = normalizarPayloadTrabalho(req.body || {}, chamada, status);
    const linha = await validarLinhaTematica(req, chamadaId, payload.linha_tematica_id);
    const coautores = normalizarCoautores(req.body?.coautores, Number(chamada.max_coautores || 0));

    const novo = await transaction(req, async (tx) => {
      const trabalho = await tx.one(
        `
        INSERT INTO trabalhos_submissoes
          (
            usuario_id,
            chamada_id,
            titulo,
            inicio_experiencia,
            linha_tematica_id,
            linha_tematica_codigo,
            introducao,
            objetivos,
            metodo,
            resultados,
            consideracao,
            bibliografia,
            status,
            criado_em,
            atualizado_em
          )
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
        RETURNING *
        `,
        [
          usuarioId,
          chamadaId,
          payload.titulo,
          payload.inicio_experiencia,
          linha.id,
          linha.codigo || null,
          payload.introducao,
          payload.objetivos,
          payload.metodo,
          payload.resultados,
          payload.consideracao,
          payload.bibliografia,
          status,
        ]
      );

      for (const coautor of coautores) {
        await tx.none(
          `
          INSERT INTO trabalhos_coautores
            (
              submissao_id,
              nome,
              email,
              unidade,
              papel,
              cpf,
              vinculo
            )
          VALUES
            ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            trabalho.id,
            coautor.nome,
            coautor.email,
            coautor.unidade,
            coautor.papel,
            coautor.cpf,
            coautor.vinculo,
          ]
        );
      }

      return trabalho;
    });

    await notificarSemBloquear(
      req,
      notificarSubmissaoCriada,
      {
        usuario_id: usuarioId,
        chamada_titulo: chamada.titulo,
        trabalho_titulo: novo.titulo,
        submissao_id: novo.id,
      },
      "submissão criada"
    );

    if (status === "submetida") {
      await notificarSemBloquear(
        req,
        notificarStatusSubmissao,
        {
          usuario_id: usuarioId,
          chamada_titulo: chamada.titulo,
          trabalho_titulo: novo.titulo,
          status: "submetida",
        },
        "status submetida"
      );
    }

    logInfo(req, "Trabalho criado.", {
      trabalhoId: novo.id,
      chamadaId,
      usuarioId,
      status,
    });

    return responder(res, novo, null, 201);
  } catch (error) {
    logError(req, "Erro ao criar trabalho.", error);
    return next(error);
  }
};

exports.atualizar = async (req, res, next) => {
  try {
    const trabalhoId = toId(req.params.id);
    const trabalhoAtual = await obterTrabalhoComChamada(req, trabalhoId);

    assert(trabalhoAtual, "Trabalho não encontrado.", 404, {
      code: "TRABALHO_NAO_ENCONTRADO",
    });

    const { usuarioId, ehAdmin } = validarPermissaoAutorOuAdmin(
      req,
      trabalhoAtual,
      "editar"
    );

    validarEdicaoPermitida(trabalhoAtual, ehAdmin);

    const chamada = {
      ...trabalhoAtual,
      id: trabalhoAtual.chamada_id,
    };

    const status = normalizarStatusAutor(req.body?.status || trabalhoAtual.status);
    const payload = normalizarPayloadTrabalho(req.body || {}, chamada, status);
    const linha = await validarLinhaTematica(
      req,
      trabalhoAtual.chamada_id,
      payload.linha_tematica_id
    );
    const coautores = normalizarCoautores(
      req.body?.coautores,
      Number(trabalhoAtual.max_coautores || 0)
    );

    const atualizado = await transaction(req, async (tx) => {
      const row = await tx.one(
        `
        UPDATE trabalhos_submissoes
           SET titulo = $1,
               inicio_experiencia = $2,
               linha_tematica_id = $3,
               linha_tematica_codigo = $4,
               introducao = $5,
               objetivos = $6,
               metodo = $7,
               resultados = $8,
               consideracao = $9,
               bibliografia = $10,
               status = $11,
               atualizado_em = NOW()
         WHERE id = $12
         RETURNING *
        `,
        [
          payload.titulo,
          payload.inicio_experiencia,
          linha.id,
          linha.codigo || null,
          payload.introducao,
          payload.objetivos,
          payload.metodo,
          payload.resultados,
          payload.consideracao,
          payload.bibliografia,
          status,
          trabalhoId,
        ]
      );

      await tx.none(`DELETE FROM trabalhos_coautores WHERE submissao_id = $1`, [
        trabalhoId,
      ]);

      for (const coautor of coautores) {
        await tx.none(
          `
          INSERT INTO trabalhos_coautores
            (
              submissao_id,
              nome,
              email,
              unidade,
              papel,
              cpf,
              vinculo
            )
          VALUES
            ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            trabalhoId,
            coautor.nome,
            coautor.email,
            coautor.unidade,
            coautor.papel,
            coautor.cpf,
            coautor.vinculo,
          ]
        );
      }

      return row;
    });

    if (trabalhoAtual.status !== "submetida" && status === "submetida") {
      await notificarSemBloquear(
        req,
        notificarStatusSubmissao,
        {
          usuario_id: trabalhoAtual.usuario_id,
          chamada_titulo: trabalhoAtual.chamada_titulo,
          trabalho_titulo: atualizado.titulo,
          status: "submetida",
        },
        "status submetida"
      );
    }

    logInfo(req, "Trabalho atualizado.", {
      trabalhoId,
      usuarioId,
      status,
    });

    return responder(res, atualizado);
  } catch (error) {
    logError(req, "Erro ao atualizar trabalho.", error);
    return next(error);
  }
};

exports.obter = async (req, res, next) => {
  try {
    const trabalhoId = toId(req.params.id);
    const trabalho = await obterTrabalhoComChamada(req, trabalhoId);

    assert(trabalho, "Trabalho não encontrado.", 404, {
      code: "TRABALHO_NAO_ENCONTRADO",
    });

    validarPermissaoAutorOuAdmin(req, trabalho, "visualizar");

    const coautores = await queryMany(
      req,
      `
      SELECT
        id,
        nome,
        email,
        unidade,
        papel,
        cpf,
        vinculo
      FROM trabalhos_coautores
      WHERE submissao_id = $1
      ORDER BY id ASC
      `,
      [trabalhoId]
    );

    const banner = await queryOne(
      req,
      `
      SELECT
        a.id,
        a.nome_original,
        a.mime_type,
        a.hash_sha256
      FROM trabalhos_arquivos a
      WHERE a.id = $1
      `,
      [trabalho.poster_arquivo_id]
    );

    return responder(res, {
      ...trabalho,
      coautores,
      banner,
      banner_url: banner ? `/api/submissao/${trabalho.id}/poster` : null,
    });
  } catch (error) {
    logError(req, "Erro ao obter trabalho.", error);
    return next(error);
  }
};

exports.remover = async (req, res, next) => {
  try {
    const trabalhoId = toId(req.params.id);
    const trabalho = await obterTrabalhoComChamada(req, trabalhoId);

    assert(trabalho, "Trabalho não encontrado.", 404, {
      code: "TRABALHO_NAO_ENCONTRADO",
    });

    const { ehAdmin } = validarPermissaoAutorOuAdmin(req, trabalho, "remover");

    if (!ehAdmin) {
      validarEdicaoPermitida(trabalho, false);

      assert(
        ["rascunho", "submetida"].includes(String(trabalho.status || "").toLowerCase()),
        "Somente trabalho em rascunho ou submetido pode ser removido pelo autor.",
        409,
        {
          code: "TRABALHO_REMOCAO_BLOQUEADA",
          details: { status: trabalho.status },
        }
      );
    }

    await transaction(req, async (tx) => {
      await tx.none(`DELETE FROM trabalhos_coautores WHERE submissao_id = $1`, [
        trabalhoId,
      ]);

      await tx.none(`DELETE FROM trabalhos_arquivos WHERE submissao_id = $1`, [
        trabalhoId,
      ]);

      await tx.none(`DELETE FROM trabalhos_submissoes WHERE id = $1`, [
        trabalhoId,
      ]);
    });

    logInfo(req, "Trabalho removido.", { trabalhoId });

    return res.status(204).end();
  } catch (error) {
    logError(req, "Erro ao remover trabalho.", error);
    return next(error);
  }
};

/* =========================================================================
   Upload do banner/arquivo principal
=========================================================================== */

function safeFilename(name = "") {
  const base = String(name || "arquivo")
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || `arquivo_${Date.now()}`;
}

function guessMimeByExt(filename = "") {
  const ext = path.extname(String(filename).toLowerCase());

  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  return "application/octet-stream";
}

function validarArquivoBanner(file) {
  assert(file, "Envie o arquivo no campo oficial 'arquivo'.", 400, {
    code: "ARQUIVO_OBRIGATORIO",
    adminHint: "Contrato v2.0: multipart field oficial = arquivo.",
  });

  assert(file.path, "Upload inválido: arquivo temporário ausente.", 400, {
    code: "UPLOAD_TEMP_AUSENTE",
    adminHint:
      "A rota deve usar multer.diskStorage ou middleware equivalente que disponibilize req.file.path.",
  });

  const originalName = file.originalname || "arquivo";
  const ext = path.extname(originalName).toLowerCase();
  const mime = file.mimetype || guessMimeByExt(originalName);
  const size = Number(file.size || 0);

  assert(EXT_BANNER_ACEITAS.includes(ext), "Formato inválido para banner.", 400, {
    code: "BANNER_EXTENSAO_INVALIDA",
    details: { extensoes_aceitas: EXT_BANNER_ACEITAS },
  });

  assert(
    MIME_BANNER_ACEITOS.includes(mime) ||
      mime.startsWith("image/"),
    "MIME inválido para banner.",
    400,
    {
      code: "BANNER_MIME_INVALIDO",
      details: { mime },
    }
  );

  assert(
    size > 0 && size <= TAMANHO_MAXIMO_BANNER_BYTES,
    "Arquivo excede o tamanho máximo permitido.",
    400,
    {
      code: "BANNER_TAMANHO_INVALIDO",
      details: {
        max_bytes: TAMANHO_MAXIMO_BANNER_BYTES,
        recebido_bytes: size,
      },
    }
  );

  return {
    originalName,
    ext,
    mime,
    size,
  };
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function caminhoDentroUploads(absPath) {
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(absPath);

  return (
    resolved === uploadsRoot ||
    resolved.startsWith(`${uploadsRoot}${path.sep}`)
  );
}

async function moverArquivoParaStorage(file, trabalhoId, ext) {
  const dir = path.join(UPLOADS_DIR, "trabalhos", String(trabalhoId), "banner");
  await ensureDir(dir);

  const finalName = `${crypto.randomBytes(8).toString("hex")}__${safeFilename(
    file.originalname || `banner${ext}`
  )}`;

  const finalPath = path.join(dir, finalName);

  assert(caminhoDentroUploads(finalPath), "Caminho de armazenamento inválido.", 500, {
    code: "STORAGE_PATH_INVALIDO",
  });

  await fsp.rename(file.path, finalPath);

  const relative = path
    .join("uploads", path.relative(UPLOADS_DIR, finalPath))
    .replace(/\\/g, "/");

  return {
    absPath: finalPath,
    relPath: relative,
  };
}

async function hashArquivo(absPath) {
  const buffer = await fsp.readFile(absPath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function removerArquivoFisicoSeguro(req, caminho) {
  if (!caminho) return;

  const raw = String(caminho).replace(/\\/g, "/");
  const rel = raw.replace(/^uploads\//i, "");
  const abs = path.resolve(UPLOADS_DIR, rel);

  if (!caminhoDentroUploads(abs)) {
    logWarn(req, "Remoção de arquivo físico bloqueada por path inválido.", {
      caminho,
    });
    return;
  }

  try {
    await fsp.unlink(abs);
  } catch {
    // arquivo já ausente: não quebra fluxo
  }
}

exports.atualizarBanner = async (req, res, next) => {
  let tempPath = null;

  try {
    const trabalhoId = toId(req.params.id);
    const trabalho = await obterTrabalhoComChamada(req, trabalhoId);

    assert(trabalho, "Trabalho não encontrado.", 404, {
      code: "TRABALHO_NAO_ENCONTRADO",
    });

    const { usuarioId, ehAdmin } = validarPermissaoAutorOuAdmin(
      req,
      trabalho,
      "enviar banner"
    );

    validarEdicaoPermitida(trabalho, ehAdmin);

    const info = validarArquivoBanner(req.file);
    tempPath = req.file.path;

    const moved = await moverArquivoParaStorage(req.file, trabalhoId, info.ext);
    tempPath = null;

    const sha256 = await hashArquivo(moved.absPath);

    const resultado = await transaction(req, async (tx) => {
      const anterior = trabalho.poster_arquivo_id
        ? await tx.one(
            `
            SELECT id, caminho
            FROM trabalhos_arquivos
            WHERE id = $1
            `,
            [trabalho.poster_arquivo_id]
          )
        : null;

      const arquivo = await tx.one(
        `
        INSERT INTO trabalhos_arquivos
          (
            submissao_id,
            caminho,
            nome_original,
            mime_type,
            tamanho,
            hash_sha256,
            criado_em
          )
        VALUES
          ($1,$2,$3,$4,$5,$6,NOW())
        RETURNING
          id,
          submissao_id,
          caminho,
          nome_original,
          mime_type,
          tamanho,
          hash_sha256,
          criado_em
        `,
        [
          trabalhoId,
          moved.relPath,
          info.originalName,
          info.mime,
          info.size,
          sha256,
        ]
      );

      await tx.none(
        `
        UPDATE trabalhos_submissoes
           SET poster_arquivo_id = $2,
               atualizado_em = NOW()
         WHERE id = $1
        `,
        [trabalhoId, arquivo.id]
      );

      return {
        arquivo,
        anterior,
      };
    });

    if (resultado.anterior?.caminho) {
      await removerArquivoFisicoSeguro(req, resultado.anterior.caminho);
    }

    await notificarSemBloquear(
      req,
      notificarPosterAtualizado,
      {
        usuario_id: usuarioId,
        chamada_titulo: trabalho.chamada_titulo,
        trabalho_titulo: trabalho.titulo,
        arquivo_nome: info.originalName,
      },
      "banner atualizado"
    );

    logInfo(req, "Banner do trabalho atualizado.", {
      trabalhoId,
      arquivoId: resultado.arquivo.id,
    });

    return responder(res, {
      ...resultado.arquivo,
      banner_url: `/api/submissao/${trabalhoId}/poster`,
    });
  } catch (error) {
    if (tempPath) {
      try {
        await fsp.unlink(tempPath);
      } catch {
        // ignore
      }
    }

    logError(req, "Erro ao atualizar banner do trabalho.", error);
    return next(error);
  }
};

/**
 * Nome alternativo removido como rota, mas mantido como referência interna
 * somente enquanto o frontend é ajustado. Não cria endpoint legado.
 */
exports.atualizarPoster = exports.atualizarBanner;

/* =========================================================================
   Repositório institucional de trabalhos
=========================================================================== */

exports.listarRepositorio = async (req, res, next) => {
  try {
    const chamadaId = req.query.chamada_id
      ? toId(req.query.chamada_id, "chamada_id")
      : null;

    const params = [];
    const where = [
      `
      (
        s.nota_escrita IS NOT NULL
        OR s.nota_oral IS NOT NULL
        OR s.nota_final IS NOT NULL
        OR s.status IN ('aprovada_exposicao', 'aprovada_oral', 'aprovada', 'reprovada')
      )
      `,
    ];

    if (chamadaId) {
      params.push(chamadaId);
      where.push(`s.chamada_id = $${params.length}`);
    }

    const rows = await queryMany(
      req,
      `
      SELECT
  s.id,
  s.titulo,
  CASE
  WHEN s.status_escrita = 'aprovado' AND s.status_oral = 'aprovado' THEN 'aprovada'
  WHEN s.status_oral = 'aprovado' THEN 'aprovada_oral'
  WHEN s.status_escrita = 'aprovado' THEN 'aprovada_exposicao'
  WHEN NULLIF(s.status, '') IS NOT NULL THEN s.status
  ELSE 'submetida'
END AS status,
  s.status_escrita,
  s.status_oral,
  s.inicio_experiencia,
  s.linha_tematica_codigo,
  s.linha_tematica_id,
  tcl.nome AS linha_tematica_nome,
  s.chamada_id,
  c.titulo AS chamada_titulo,
  u.nome AS autor_nome,
  u.unidade_id,
  un.nome AS autor_unidade_nome,
  s.introducao,
  s.objetivos,
  s.metodo,
  s.resultados,
  s.consideracoes,
  s.bibliografia,
  s.nota_escrita,
  s.nota_oral,
  s.nota_final,
  s.poster_arquivo_id,
  a.nome_original AS poster_nome,
  a.mime_type AS poster_mime
FROM trabalhos_submissoes s
JOIN usuarios u ON u.id = s.usuario_id
JOIN trabalhos_chamadas c ON c.id = s.chamada_id
LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
LEFT JOIN unidades un ON un.id = u.unidade_id
LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
WHERE COALESCE(NULLIF(s.status, ''), 'submetida') NOT IN ('rascunho', 'cancelada')
ORDER BY c.titulo ASC, tcl.nome ASC NULLS LAST, s.titulo ASC, s.id ASC
      `,
      params
    );

    const data = rows.map((row) => ({
      ...row,
      banner_url: row.poster_arquivo_id ? `/api/submissao/${row.id}/poster` : null,
    }));

    return responder(res, data, {
      total: data.length,
      chamada_id: chamadaId,
    });
  } catch (error) {
    logError(req, "Erro ao listar repositório de trabalhos.", error);
    return next(error);
  }
};

/* =========================================================================
   Exports de compatibilidade JS interna
=========================================================================== */

/**
 * Mantidos apenas como nomes JS temporários para facilitar transição de imports
 * enquanto a route oficial é reeditada.
 *
 * Não devem ser usados para criar rotas legadas.
 */
exports.criarSubmissao = exports.criar;
exports.atualizarSubmissao = exports.atualizar;
exports.removerSubmissao = exports.remover;
exports.listarRepositorioTrabalhos = exports.listarRepositorio;