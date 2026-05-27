/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/cursoOnlineController.js — v2.0
 * Atualizado em: 18/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo Cursos Online.
 *
 * Função:
 * - Listar cursos online publicados para usuários autenticados.
 * - Consultar curso online publicado por ID.
 * - Administrar cursos online: listar, criar, atualizar, alterar status e excluir.
 *
 * Contrato oficial de banco:
 * - cursos_online
 *
 * Status oficiais:
 * - rascunho
 * - publicado
 * - arquivado
 *
 * Plataformas oficiais:
 * - youtube
 * - govbr
 * - universidade
 * - escola_saude
 * - outra
 *
 * Rotas previstas:
 * - GET    /api/curso-online/publicado
 * - GET    /api/curso-online/:id
 * - GET    /api/curso-online/admin
 * - POST   /api/curso-online/admin
 * - PUT    /api/curso-online/admin/:id
 * - PATCH  /api/curso-online/admin/:id/status
 * - DELETE /api/curso-online/admin/:id
 *
 * Diretrizes v2.0:
 * - sem legado;
 * - sem aliases;
 * - sem resposta { erro };
 * - sem status livre;
 * - sem plataforma livre;
 * - sem URL vazia;
 * - req.user.id como usuário autenticado oficial;
 * - req.user.perfil como perfil oficial;
 * - envelope ok/data/message/code/meta;
 * - erros com requestId/adminHint/details;
 * - backend protege regra de negócio;
 * - banco protege integridade.
 */

const db = require("../db");

const TABELA = "cursos_online";

const PERFIL_ADMINISTRADOR = "administrador";

const STATUS = Object.freeze({
  rascunho: "rascunho",
  publicado: "publicado",
  arquivado: "arquivado",
});

const STATUS_OFICIAL = new Set(Object.values(STATUS));

const PLATAFORMA = Object.freeze({
  youtube: "youtube",
  govbr: "govbr",
  universidade: "universidade",
  escola_saude: "escola_saude",
  outra: "outra",
});

const PLATAFORMA_OFICIAL = new Set(Object.values(PLATAFORMA));

const PLATAFORMAS_LABEL = Object.freeze({
  youtube: "YouTube",
  govbr: "Gov.br",
  universidade: "Universidade",
  escola_saude: "Escola da Saúde",
  outra: "Outra",
});

const STATUS_LABEL = Object.freeze({
  rascunho: "Rascunho",
  publicado: "Publicado",
  arquivado: "Arquivado",
});

function getQuery() {
  if (typeof db?.query === "function") {
    return db.query.bind(db);
  }

  if (typeof db?.pool?.query === "function") {
    return db.pool.query.bind(db.pool);
  }

  return null;
}

const query = getQuery();

if (typeof query !== "function") {
  throw new Error(
    "DB inválido em cursoOnlineController.js: export oficial precisa expor query."
  );
}

function gerarRequestId() {
  return `curso-online-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sucesso(
  res,
  { status = 200, data = null, message = "OK", code = "OK", meta = null }
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

function logErro(requestId, contexto, err) {
  console.error(`[cursoOnlineController][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

function cleanStr(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  return text ? text : null;
}

function toBool(value, fallback = false) {
  if (value === undefined) return fallback;
  return value === true;
}

function toIntOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const n = Number(value);
  return Number.isInteger(n) ? n : Number.NaN;
}

function getUsuarioId(req) {
  const id = Number(req?.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getPerfis(req) {
  const perfil = req?.user?.perfil;

  if (Array.isArray(perfil)) {
    return perfil.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  const unico = String(perfil || "").trim().toLowerCase();
  return unico ? [unico] : [];
}

function isAdministrador(req) {
  return getPerfis(req).includes(PERFIL_ADMINISTRADOR);
}

function normalizarStatus(value, fallback = STATUS.rascunho) {
  const status = cleanStr(value);

  if (!status) return fallback;

  const normalized = String(status).toLowerCase();

  return STATUS_OFICIAL.has(normalized) ? normalized : null;
}

function normalizarPlataforma(value) {
  const plataforma = cleanStr(value);

  if (!plataforma) return null;

  const normalized = String(plataforma).toLowerCase();

  return PLATAFORMA_OFICIAL.has(normalized) ? normalized : null;
}

function validarUrl(value) {
  const url = cleanStr(value);

  if (!url) return null;

  if (url.length < 8 || url.length > 2048) return null;

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function decorarCurso(row) {
  if (!row) return null;

  return {
    ...row,
    plataforma_label: PLATAFORMAS_LABEL[row.plataforma] || row.plataforma,
    status_label: STATUS_LABEL[row.status] || row.status,
  };
}

function validarPayloadCriacao(body = {}) {
  const titulo = cleanStr(body.titulo);
  const descricao = cleanStr(body.descricao);
  const url = validarUrl(body.url);
  const plataforma = normalizarPlataforma(body.plataforma);
  const categoria = cleanStr(body.categoria);
  const carga_horaria = toIntOrNull(body.carga_horaria);
  const status = normalizarStatus(body.status, STATUS.rascunho);
  const imagem_url = body.imagem_url ? validarUrl(body.imagem_url) : null;
  const canal_ou_instituicao = cleanStr(body.canal_ou_instituicao);
  const gratuito = toBool(body.gratuito, true);
  const certificado_externo = toBool(body.certificado_externo, false);
  const ordem = body.ordem === undefined ? 0 : toIntOrNull(body.ordem);

  if (!titulo || titulo.length < 3) {
    return {
      ok: false,
      message: "Informe o título do curso online com pelo menos 3 caracteres.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (!url) {
    return {
      ok: false,
      message: "Informe uma URL válida para o curso online.",
      code: "URL_INVALIDA",
      adminHint:
        "A URL deve usar protocolo http ou https e possuir tamanho compatível.",
    };
  }

  if (!plataforma) {
    return {
      ok: false,
      message: "Selecione uma plataforma oficial para o curso online.",
      code: "PLATAFORMA_INVALIDA",
      adminHint:
        "Plataformas oficiais: youtube, govbr, universidade, escola_saude ou outra.",
    };
  }

  if (!status) {
    return {
      ok: false,
      message: "Status inválido para curso online.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicado ou arquivado.",
    };
  }

  if (Number.isNaN(carga_horaria) || Number.isNaN(ordem)) {
    return {
      ok: false,
      message: "Carga horária ou ordem inválida.",
      code: "NUMERO_INVALIDO",
    };
  }

  if (carga_horaria !== null && carga_horaria < 0) {
    return {
      ok: false,
      message: "Carga horária não pode ser negativa.",
      code: "CARGA_HORARIA_INVALIDA",
    };
  }

  if (ordem !== null && ordem < 0) {
    return {
      ok: false,
      message: "Ordem não pode ser negativa.",
      code: "ORDEM_INVALIDA",
    };
  }

  if (body.imagem_url && !imagem_url) {
    return {
      ok: false,
      message: "Informe uma URL de imagem válida ou deixe o campo vazio.",
      code: "IMAGEM_URL_INVALIDA",
    };
  }

  return {
    ok: true,
    data: {
      titulo,
      descricao,
      url,
      plataforma,
      categoria,
      carga_horaria,
      status,
      imagem_url,
      canal_ou_instituicao,
      gratuito,
      certificado_externo,
      ordem: ordem ?? 0,
    },
  };
}

function validarPayloadAtualizacao(body = {}) {
  const patch = {};

  if (body.titulo !== undefined) patch.titulo = cleanStr(body.titulo);
  if (body.descricao !== undefined) patch.descricao = cleanStr(body.descricao);
  if (body.url !== undefined) patch.url = validarUrl(body.url);
  if (body.plataforma !== undefined) {
    patch.plataforma = normalizarPlataforma(body.plataforma);
  }
  if (body.categoria !== undefined) patch.categoria = cleanStr(body.categoria);
  if (body.carga_horaria !== undefined) {
    patch.carga_horaria = toIntOrNull(body.carga_horaria);
  }
  if (body.status !== undefined) {
    patch.status = normalizarStatus(body.status, null);
  }
  if (body.imagem_url !== undefined) {
    patch.imagem_url = body.imagem_url ? validarUrl(body.imagem_url) : null;
  }
  if (body.canal_ou_instituicao !== undefined) {
    patch.canal_ou_instituicao = cleanStr(body.canal_ou_instituicao);
  }
  if (body.gratuito !== undefined) {
    patch.gratuito = toBool(body.gratuito, true);
  }
  if (body.certificado_externo !== undefined) {
    patch.certificado_externo = toBool(body.certificado_externo, false);
  }
  if (body.ordem !== undefined) {
    patch.ordem = toIntOrNull(body.ordem);
  }

  if (patch.titulo !== undefined && (!patch.titulo || patch.titulo.length < 3)) {
    return {
      ok: false,
      message: "Informe o título do curso online com pelo menos 3 caracteres.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (patch.url !== undefined && !patch.url) {
    return {
      ok: false,
      message: "Informe uma URL válida para o curso online.",
      code: "URL_INVALIDA",
      adminHint:
        "A URL deve usar protocolo http ou https e possuir tamanho compatível.",
    };
  }

  if (patch.plataforma !== undefined && !patch.plataforma) {
    return {
      ok: false,
      message: "Selecione uma plataforma oficial para o curso online.",
      code: "PLATAFORMA_INVALIDA",
      adminHint:
        "Plataformas oficiais: youtube, govbr, universidade, escola_saude ou outra.",
    };
  }

  if (patch.status !== undefined && !patch.status) {
    return {
      ok: false,
      message: "Status inválido para curso online.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicado ou arquivado.",
    };
  }

  if (
    patch.carga_horaria !== undefined &&
    (Number.isNaN(patch.carga_horaria) ||
      (patch.carga_horaria !== null && patch.carga_horaria < 0))
  ) {
    return {
      ok: false,
      message: "Carga horária inválida.",
      code: "CARGA_HORARIA_INVALIDA",
    };
  }

  if (
    patch.ordem !== undefined &&
    (Number.isNaN(patch.ordem) || (patch.ordem !== null && patch.ordem < 0))
  ) {
    return {
      ok: false,
      message: "Ordem inválida.",
      code: "ORDEM_INVALIDA",
    };
  }

  if (body.imagem_url !== undefined && body.imagem_url && !patch.imagem_url) {
    return {
      ok: false,
      message: "Informe uma URL de imagem válida ou deixe o campo vazio.",
      code: "IMAGEM_URL_INVALIDA",
    };
  }

  return {
    ok: true,
    data: patch,
  };
}

function validarIdParam(req) {
  const id = Number(req.params.id);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function validarPermissaoAdmin(req, res, requestId) {
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return {
      ok: false,
      response: falha(res, {
        status: 401,
        message: "Usuário não autenticado.",
        code: "NAO_AUTENTICADO",
        adminHint: "Middleware de autenticação não populou req.user.id.",
        requestId,
      }),
    };
  }

  if (!isAdministrador(req)) {
    return {
      ok: false,
      response: falha(res, {
        status: 403,
        message: "Acesso restrito a administradores.",
        code: "SEM_PERMISSAO",
        adminHint:
          "Somente perfil oficial administrador pode gerenciar cursos online.",
        requestId,
      }),
    };
  }

  return {
    ok: true,
    usuarioId,
  };
}

async function listarPublicados(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      adminHint: "Middleware de autenticação não populou req.user.id.",
      requestId,
    });
  }

  try {
    const params = [];
    const filtros = [`status = 'publicado'`];

    const plataforma = req.query?.plataforma
      ? normalizarPlataforma(req.query.plataforma)
      : null;

    if (req.query?.plataforma !== undefined && !plataforma) {
      return falha(res, {
        status: 400,
        message: "Plataforma inválida.",
        code: "PLATAFORMA_INVALIDA",
        adminHint:
          "Parâmetro plataforma deve ser: youtube, govbr, universidade, escola_saude ou outra.",
        details: {
          plataforma: req.query?.plataforma,
        },
        requestId,
      });
    }

    if (plataforma) {
      params.push(plataforma);
      filtros.push(`plataforma = $${params.length}`);
    }

    const categoria = cleanStr(req.query?.categoria);

    if (categoria) {
      params.push(categoria);
      filtros.push(`categoria = $${params.length}`);
    }

    const busca = cleanStr(req.query?.busca);

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(`
        (
          titulo ILIKE $${params.length}
          OR descricao ILIKE $${params.length}
          OR categoria ILIKE $${params.length}
          OR canal_ou_instituicao ILIKE $${params.length}
        )
      `);
    }

    const result = await query(
      `
        SELECT
          id,
          titulo,
          descricao,
          url,
          plataforma,
          categoria,
          carga_horaria,
          status,
          imagem_url,
          canal_ou_instituicao,
          gratuito,
          certificado_externo,
          ordem,
          criado_por,
          criado_em,
          atualizado_em,
          publicado_em,
          arquivado_em
        FROM ${TABELA}
        WHERE ${filtros.join(" AND ")}
        ORDER BY
          ordem ASC,
          publicado_em DESC NULLS LAST,
          criado_em DESC,
          id DESC
      `,
      params
    );

    const data = (result.rows || []).map(decorarCurso);

    return sucesso(res, {
      data,
      message: "Cursos online publicados listados com sucesso.",
      code: "CURSO_ONLINE_PUBLICADO_LISTADO",
      meta: {
        total: data.length,
        plataformas: Object.values(PLATAFORMA).map((value) => ({
          value,
          label: PLATAFORMAS_LABEL[value],
        })),
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar cursos online publicados", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar cursos online publicados.",
      code: "CURSO_ONLINE_PUBLICADO_LISTAR_ERRO",
      adminHint:
        "Verifique tabela cursos_online, índices de status/plataforma/categoria e filtros enviados.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function obterPublicadoPorId(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);
  const id = validarIdParam(req);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      adminHint: "Middleware de autenticação não populou req.user.id.",
      requestId,
    });
  }

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        id: req.params.id,
      },
      requestId,
    });
  }

  try {
    const result = await query(
      `
        SELECT
          id,
          titulo,
          descricao,
          url,
          plataforma,
          categoria,
          carga_horaria,
          status,
          imagem_url,
          canal_ou_instituicao,
          gratuito,
          certificado_externo,
          ordem,
          criado_por,
          criado_em,
          atualizado_em,
          publicado_em,
          arquivado_em
        FROM ${TABELA}
        WHERE id = $1
          AND status = 'publicado'
        LIMIT 1
      `,
      [id]
    );

    const curso = result.rows?.[0] ? decorarCurso(result.rows[0]) : null;

    if (!curso) {
      return falha(res, {
        status: 404,
        message: "Curso online não encontrado ou não publicado.",
        code: "CURSO_ONLINE_NAO_ENCONTRADO",
        requestId,
      });
    }

    return sucesso(res, {
      data: curso,
      message: "Curso online carregado com sucesso.",
      code: "CURSO_ONLINE_PUBLICADO_OBTIDO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter curso online publicado", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter curso online.",
      code: "CURSO_ONLINE_OBTER_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function listarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);

  if (!permissao.ok) return permissao.response;

  try {
    const params = [];
    const filtros = [];

    const status = req.query?.status
      ? normalizarStatus(req.query.status, null)
      : null;

    if (req.query?.status !== undefined && !status) {
      return falha(res, {
        status: 400,
        message: "Status inválido.",
        code: "STATUS_INVALIDO",
        adminHint: "Status oficiais: rascunho, publicado ou arquivado.",
        details: {
          status: req.query?.status,
        },
        requestId,
      });
    }

    if (status) {
      params.push(status);
      filtros.push(`co.status = $${params.length}`);
    }

    const plataforma = req.query?.plataforma
      ? normalizarPlataforma(req.query.plataforma)
      : null;

    if (req.query?.plataforma !== undefined && !plataforma) {
      return falha(res, {
        status: 400,
        message: "Plataforma inválida.",
        code: "PLATAFORMA_INVALIDA",
        details: {
          plataforma: req.query?.plataforma,
        },
        requestId,
      });
    }

    if (plataforma) {
      params.push(plataforma);
      filtros.push(`co.plataforma = $${params.length}`);
    }

    const categoria = cleanStr(req.query?.categoria);

    if (categoria) {
      params.push(categoria);
      filtros.push(`co.categoria = $${params.length}`);
    }

    const busca = cleanStr(req.query?.busca);

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(`
        (
          co.titulo ILIKE $${params.length}
          OR co.descricao ILIKE $${params.length}
          OR co.categoria ILIKE $${params.length}
          OR co.canal_ou_instituicao ILIKE $${params.length}
          OR u.nome ILIKE $${params.length}
        )
      `);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await query(
      `
        SELECT
          co.id,
          co.titulo,
          co.descricao,
          co.url,
          co.plataforma,
          co.categoria,
          co.carga_horaria,
          co.status,
          co.imagem_url,
          co.canal_ou_instituicao,
          co.gratuito,
          co.certificado_externo,
          co.ordem,
          co.criado_por,
          u.nome AS criado_por_nome,
          co.criado_em,
          co.atualizado_em,
          co.publicado_em,
          co.arquivado_em
        FROM ${TABELA} co
        LEFT JOIN usuarios u ON u.id = co.criado_por
        ${where}
        ORDER BY
          co.ordem ASC,
          co.status ASC,
          co.publicado_em DESC NULLS LAST,
          co.criado_em DESC,
          co.id DESC
      `,
      params
    );

    const data = (result.rows || []).map(decorarCurso);

    return sucesso(res, {
      data,
      message: "Cursos online listados com sucesso.",
      code: "CURSO_ONLINE_ADMIN_LISTADO",
      meta: {
        total: data.length,
        status: Object.values(STATUS).map((value) => ({
          value,
          label: STATUS_LABEL[value],
        })),
        plataformas: Object.values(PLATAFORMA).map((value) => ({
          value,
          label: PLATAFORMAS_LABEL[value],
        })),
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar cursos online no admin", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar cursos online.",
      code: "CURSO_ONLINE_ADMIN_LISTAR_ERRO",
      adminHint:
        "Verifique tabela cursos_online, FK criado_por e filtros enviados.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function criarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);

  if (!permissao.ok) return permissao.response;

  const validacao = validarPayloadCriacao(req.body || {});

  if (!validacao.ok) {
    return falha(res, {
      status: 400,
      message: validacao.message,
      code: validacao.code,
      adminHint: validacao.adminHint || null,
      requestId,
    });
  }

  try {
    const payload = validacao.data;
    const agoraStatusPublicado = payload.status === STATUS.publicado;

    const result = await query(
      `
        INSERT INTO ${TABELA} (
          titulo,
          descricao,
          url,
          plataforma,
          categoria,
          carga_horaria,
          status,
          imagem_url,
          canal_ou_instituicao,
          gratuito,
          certificado_externo,
          ordem,
          criado_por,
          publicado_em,
          arquivado_em
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13,
          CASE WHEN $7 = 'publicado' THEN now() ELSE NULL END,
          CASE WHEN $7 = 'arquivado' THEN now() ELSE NULL END
        )
        RETURNING *
      `,
      [
        payload.titulo,
        payload.descricao,
        payload.url,
        payload.plataforma,
        payload.categoria,
        payload.carga_horaria,
        payload.status,
        payload.imagem_url,
        payload.canal_ou_instituicao,
        payload.gratuito,
        payload.certificado_externo,
        payload.ordem,
        permissao.usuarioId,
      ]
    );

    const curso = decorarCurso(result.rows?.[0]);

    return sucesso(res, {
      status: 201,
      data: curso,
      message: agoraStatusPublicado
        ? "Curso online criado e publicado com sucesso."
        : "Curso online criado com sucesso.",
      code: "CURSO_ONLINE_CRIADO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao criar curso online", err);

    return falha(res, {
      status: 500,
      message: "Erro ao criar curso online.",
      code: "CURSO_ONLINE_CRIAR_ERRO",
      adminHint:
        "Verifique constraints cursos_online_status_check, cursos_online_plataforma_check, cursos_online_url_check e FK criado_por.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function atualizarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        id: req.params.id,
      },
      requestId,
    });
  }

  const validacao = validarPayloadAtualizacao(req.body || {});

  if (!validacao.ok) {
    return falha(res, {
      status: 400,
      message: validacao.message,
      code: validacao.code,
      adminHint: validacao.adminHint || null,
      requestId,
    });
  }

  const patch = validacao.data;
  const entradas = Object.entries(patch);

  if (entradas.length === 0) {
    return falha(res, {
      status: 400,
      message: "Nenhum campo válido informado para atualização.",
      code: "PAYLOAD_VAZIO",
      requestId,
    });
  }

  try {
    const atual = await query(
      `
        SELECT id, status
        FROM ${TABELA}
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

    if (!atual.rows?.[0]) {
      return falha(res, {
        status: 404,
        message: "Curso online não encontrado.",
        code: "CURSO_ONLINE_NAO_ENCONTRADO",
        requestId,
      });
    }

    const campos = [];
    const valores = [];

    function addCampo(nome, valor) {
      campos.push(`${nome} = $${valores.length + 1}`);
      valores.push(valor);
    }

    for (const [campo, valor] of entradas) {
      addCampo(campo, valor);
    }

    if (patch.status === STATUS.publicado) {
      campos.push("publicado_em = COALESCE(publicado_em, now())");
      campos.push("arquivado_em = NULL");
    }

    if (patch.status === STATUS.arquivado) {
      campos.push("arquivado_em = COALESCE(arquivado_em, now())");
    }

    if (patch.status === STATUS.rascunho) {
      campos.push("arquivado_em = NULL");
    }

    valores.push(id);

    const result = await query(
      `
        UPDATE ${TABELA}
           SET ${campos.join(", ")}
         WHERE id = $${valores.length}
         RETURNING *
      `,
      valores
    );

    const curso = decorarCurso(result.rows?.[0]);

    return sucesso(res, {
      data: curso,
      message: "Curso online atualizado com sucesso.",
      code: "CURSO_ONLINE_ATUALIZADO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao atualizar curso online", err);

    return falha(res, {
      status: 500,
      message: "Erro ao atualizar curso online.",
      code: "CURSO_ONLINE_ATUALIZAR_ERRO",
      adminHint:
        "Verifique constraints, campos enviados e existência do curso online.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function alterarStatusAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      details: {
        id: req.params.id,
      },
      requestId,
    });
  }

  const status = normalizarStatus(req.body?.status, null);

  if (!status) {
    return falha(res, {
      status: 400,
      message: "Status inválido.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicado ou arquivado.",
      details: {
        status: req.body?.status,
      },
      requestId,
    });
  }

  try {
    const result = await query(
      `
        UPDATE ${TABELA}
           SET status = $1,
               publicado_em = CASE
                 WHEN $1 = 'publicado' THEN COALESCE(publicado_em, now())
                 WHEN $1 = 'rascunho' THEN NULL
                 ELSE publicado_em
               END,
               arquivado_em = CASE
                 WHEN $1 = 'arquivado' THEN COALESCE(arquivado_em, now())
                 ELSE NULL
               END
         WHERE id = $2
         RETURNING *
      `,
      [status, id]
    );

    const curso = result.rows?.[0] ? decorarCurso(result.rows[0]) : null;

    if (!curso) {
      return falha(res, {
        status: 404,
        message: "Curso online não encontrado.",
        code: "CURSO_ONLINE_NAO_ENCONTRADO",
        requestId,
      });
    }

    return sucesso(res, {
      data: curso,
      message: "Status do curso online atualizado com sucesso.",
      code: "CURSO_ONLINE_STATUS_ATUALIZADO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao alterar status do curso online", err);

    return falha(res, {
      status: 500,
      message: "Erro ao alterar status do curso online.",
      code: "CURSO_ONLINE_STATUS_ERRO",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function excluirAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      details: {
        id: req.params.id,
      },
      requestId,
    });
  }

  try {
    const result = await query(
      `
        DELETE FROM ${TABELA}
        WHERE id = $1
        RETURNING id, titulo
      `,
      [id]
    );

    const removido = result.rows?.[0];

    if (!removido) {
      return falha(res, {
        status: 404,
        message: "Curso online não encontrado.",
        code: "CURSO_ONLINE_NAO_ENCONTRADO",
        requestId,
      });
    }

    return sucesso(res, {
      data: removido,
      message: "Curso online excluído com sucesso.",
      code: "CURSO_ONLINE_EXCLUIDO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao excluir curso online", err);

    return falha(res, {
      status: 500,
      message: "Erro ao excluir curso online.",
      code: "CURSO_ONLINE_EXCLUIR_ERRO",
      adminHint:
        "Se o curso online passar a ter histórico de acessos, trocar exclusão física por arquivamento.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

module.exports = {
  listarPublicados,
  obterPublicadoPorId,
  listarAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,
};