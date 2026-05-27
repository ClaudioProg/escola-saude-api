/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/pesquisaController.js — v2.0
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo Pesquisas.
 *
 * Função:
 * - Administrar pesquisas externas e internas.
 * - Publicar, encerrar, arquivar e retornar pesquisa para rascunho.
 * - Listar pesquisas publicadas para usuários autenticados.
 * - Permitir resposta de pesquisa interna.
 * - Exibir respostas e resultados para administração.
 *
 * Contrato oficial de banco:
 * - pesquisas
 * - pesquisa_perguntas
 * - pesquisa_opcoes
 * - pesquisa_respostas
 * - pesquisa_resposta_itens
 *
 * Tipos oficiais:
 * - externa
 * - interna
 *
 * Status oficiais:
 * - rascunho
 * - publicada
 * - encerrada
 * - arquivada
 *
 * Contextos oficiais:
 * - geral
 * - evento
 * - turma
 *
 * Tipos oficiais de pergunta:
 * - opcao_unica
 * - multipla_escolha
 * - texto_curto
 * - texto_longo
 * - escala
 *
 * Rotas previstas:
 * - GET    /api/pesquisa/publicada
 * - GET    /api/pesquisa/:id
 * - POST   /api/pesquisa/:id/responder
 *
 * - GET    /api/pesquisa/admin
 * - POST   /api/pesquisa/admin
 * - GET    /api/pesquisa/admin/:id
 * - PUT    /api/pesquisa/admin/:id
 * - PATCH  /api/pesquisa/admin/:id/status
 * - GET    /api/pesquisa/admin/:id/resposta
 * - GET    /api/pesquisa/admin/:id/resultado
 * - DELETE /api/pesquisa/admin/:id
 *
 * Diretrizes v2.0:
 * - sem legado;
 * - sem aliases;
 * - sem resposta { erro };
 * - sem tipo/status/contexto livre;
 * - sem link externo em pesquisa interna;
 * - sem pesquisa externa sem link;
 * - req.user.id como usuário autenticado oficial;
 * - req.user.perfil como perfil oficial;
 * - envelope ok/data/message/code/meta;
 * - erros com requestId/adminHint/details;
 * - backend protege regra de negócio;
 * - banco protege integridade.
 */

const dbModule = require("../db");

const db = dbModule?.db ?? dbModule;

const TABELA_PESQUISA = "pesquisas";
const TABELA_PERGUNTA = "pesquisa_perguntas";
const TABELA_OPCAO = "pesquisa_opcoes";
const TABELA_RESPOSTA = "pesquisa_respostas";
const TABELA_RESPOSTA_ITEM = "pesquisa_resposta_itens";

const PERFIL_ADMINISTRADOR = "administrador";

const TIPO = Object.freeze({
  externa: "externa",
  interna: "interna",
});

const STATUS = Object.freeze({
  rascunho: "rascunho",
  publicada: "publicada",
  encerrada: "encerrada",
  arquivada: "arquivada",
});

const CONTEXTO = Object.freeze({
  geral: "geral",
  evento: "evento",
  turma: "turma",
});

const TIPO_PERGUNTA = Object.freeze({
  opcao_unica: "opcao_unica",
  multipla_escolha: "multipla_escolha",
  texto_curto: "texto_curto",
  texto_longo: "texto_longo",
  escala: "escala",
});

const TIPO_OFICIAL = new Set(Object.values(TIPO));
const STATUS_OFICIAL = new Set(Object.values(STATUS));
const CONTEXTO_OFICIAL = new Set(Object.values(CONTEXTO));
const TIPO_PERGUNTA_OFICIAL = new Set(Object.values(TIPO_PERGUNTA));

const TIPO_LABEL = Object.freeze({
  externa: "Externa",
  interna: "Interna",
});

const STATUS_LABEL = Object.freeze({
  rascunho: "Rascunho",
  publicada: "Publicada",
  encerrada: "Encerrada",
  arquivada: "Arquivada",
});

const CONTEXTO_LABEL = Object.freeze({
  geral: "Geral",
  evento: "Evento",
  turma: "Turma",
});

const TIPO_PERGUNTA_LABEL = Object.freeze({
  opcao_unica: "Opção única",
  multipla_escolha: "Múltipla escolha",
  texto_curto: "Texto curto",
  texto_longo: "Texto longo",
  escala: "Escala",
});

/* =========================================================================
   DB helpers
=========================================================================== */

function getQuery() {
  if (typeof db?.query === "function") {
    return db.query.bind(db);
  }

  if (typeof db?.pool?.query === "function") {
    return db.pool.query.bind(db.pool);
  }

  if (typeof dbModule?.pool?.query === "function") {
    return dbModule.pool.query.bind(dbModule.pool);
  }

  return null;
}

function getPool() {
  if (typeof db?.connect === "function") return db;
  if (typeof db?.pool?.connect === "function") return db.pool;
  if (typeof dbModule?.pool?.connect === "function") return dbModule.pool;
  return null;
}

const query = getQuery();

if (typeof query !== "function") {
  throw new Error(
    "DB inválido em pesquisaController.js: export oficial precisa expor query."
  );
}

async function withTransaction(callback) {
  const pool = getPool();

  if (!pool) {
    const pseudoClient = { query };
    return callback(pseudoClient);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================================
   Response helpers
=========================================================================== */

function gerarRequestId() {
  return `pesquisa-${Date.now().toString(36)}-${Math.random()
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
  console.error(`[pesquisaController][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

/* =========================================================================
   Normalização / validação
=========================================================================== */

function cleanStr(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  return text ? text : null;
}

function cleanRequiredStr(value) {
  const text = cleanStr(value);
  return text || "";
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

function normalizarEnum(value, oficiais, fallback = null) {
  const text = cleanStr(value);

  if (!text) return fallback;

  const normalized = String(text).toLowerCase();

  return oficiais.has(normalized) ? normalized : null;
}

function normalizarTipo(value, fallback = TIPO.interna) {
  return normalizarEnum(value, TIPO_OFICIAL, fallback);
}

function normalizarStatus(value, fallback = STATUS.rascunho) {
  return normalizarEnum(value, STATUS_OFICIAL, fallback);
}

function normalizarContexto(value, fallback = CONTEXTO.geral) {
  return normalizarEnum(value, CONTEXTO_OFICIAL, fallback);
}

function normalizarTipoPergunta(value) {
  return normalizarEnum(value, TIPO_PERGUNTA_OFICIAL, null);
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

function validarTimestampOuNull(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
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
        adminHint: "Somente perfil oficial administrador pode gerenciar pesquisas.",
        requestId,
      }),
    };
  }

  return {
    ok: true,
    usuarioId,
  };
}

function decorarPesquisa(row) {
  if (!row) return null;

  return {
    ...row,
    tipo_label: TIPO_LABEL[row.tipo] || row.tipo,
    status_label: STATUS_LABEL[row.status] || row.status,
    contexto_label: CONTEXTO_LABEL[row.contexto] || row.contexto,
  };
}

function decorarPergunta(row) {
  if (!row) return null;

  return {
    ...row,
    tipo_label: TIPO_PERGUNTA_LABEL[row.tipo] || row.tipo,
  };
}

function perguntaExigeOpcoes(tipo) {
  return tipo === TIPO_PERGUNTA.opcao_unica || tipo === TIPO_PERGUNTA.multipla_escolha;
}

function perguntaAceitaTexto(tipo) {
  return tipo === TIPO_PERGUNTA.texto_curto || tipo === TIPO_PERGUNTA.texto_longo;
}

function perguntaAceitaNumero(tipo) {
  return tipo === TIPO_PERGUNTA.escala;
}

function validarPerguntas(perguntas = []) {
  if (!Array.isArray(perguntas)) {
    return {
      ok: false,
      message: "Perguntas devem ser enviadas em formato de lista.",
      code: "PERGUNTAS_INVALIDAS",
    };
  }

  const normalizadas = [];

  for (let index = 0; index < perguntas.length; index += 1) {
    const item = perguntas[index] || {};
    const tipo = normalizarTipoPergunta(item.tipo);
    const enunciado = cleanRequiredStr(item.enunciado);
    const ordem =
      item.ordem === undefined || item.ordem === null || item.ordem === ""
        ? index
        : toIntOrNull(item.ordem);
    const obrigatoria = toBool(item.obrigatoria, true);
    const limite_caracteres = toIntOrNull(item.limite_caracteres);
    const opcoes = Array.isArray(item.opcoes) ? item.opcoes : [];

    if (!tipo) {
      return {
        ok: false,
        message: `Tipo inválido na pergunta ${index + 1}.`,
        code: "TIPO_PERGUNTA_INVALIDO",
        adminHint:
          "Tipos oficiais: opcao_unica, multipla_escolha, texto_curto, texto_longo ou escala.",
      };
    }

    if (!enunciado || enunciado.length < 3) {
      return {
        ok: false,
        message: `Informe o enunciado da pergunta ${index + 1}.`,
        code: "ENUNCIADO_OBRIGATORIO",
      };
    }

    if (Number.isNaN(ordem) || ordem < 0) {
      return {
        ok: false,
        message: `Ordem inválida na pergunta ${index + 1}.`,
        code: "ORDEM_PERGUNTA_INVALIDA",
      };
    }

    if (
      limite_caracteres !== null &&
      limite_caracteres !== undefined &&
      (Number.isNaN(limite_caracteres) || limite_caracteres <= 0)
    ) {
      return {
        ok: false,
        message: `Limite de caracteres inválido na pergunta ${index + 1}.`,
        code: "LIMITE_CARACTERES_INVALIDO",
      };
    }

    const opcoesNormalizadas = [];

    if (perguntaExigeOpcoes(tipo)) {
      if (opcoes.length < 2) {
        return {
          ok: false,
          message: `A pergunta ${index + 1} precisa ter pelo menos duas opções.`,
          code: "OPCOES_INSUFICIENTES",
        };
      }

      for (let optionIndex = 0; optionIndex < opcoes.length; optionIndex += 1) {
        const opcao = opcoes[optionIndex] || {};
        const texto = cleanRequiredStr(opcao.texto);
        const ordemOpcao =
          opcao.ordem === undefined || opcao.ordem === null || opcao.ordem === ""
            ? optionIndex
            : toIntOrNull(opcao.ordem);

        if (!texto) {
          return {
            ok: false,
            message: `Informe o texto da opção ${optionIndex + 1} da pergunta ${
              index + 1
            }.`,
            code: "OPCAO_TEXTO_OBRIGATORIO",
          };
        }

        if (Number.isNaN(ordemOpcao) || ordemOpcao < 0) {
          return {
            ok: false,
            message: `Ordem inválida na opção ${optionIndex + 1} da pergunta ${
              index + 1
            }.`,
            code: "ORDEM_OPCAO_INVALIDA",
          };
        }

        opcoesNormalizadas.push({
          texto,
          ordem: ordemOpcao,
        });
      }
    }

    normalizadas.push({
      tipo,
      enunciado,
      ordem,
      obrigatoria,
      limite_caracteres:
        limite_caracteres === undefined ? null : limite_caracteres,
      opcoes: opcoesNormalizadas,
    });
  }

  return {
    ok: true,
    data: normalizadas,
  };
}

function validarPesquisaPayload(body = {}, { parcial = false } = {}) {
  const titulo =
    body.titulo === undefined && parcial
      ? undefined
      : cleanRequiredStr(body.titulo);
  const descricao =
    body.descricao === undefined && parcial ? undefined : cleanStr(body.descricao);

  const tipo =
    body.tipo === undefined && parcial
      ? undefined
      : normalizarTipo(body.tipo, TIPO.interna);

  const status =
    body.status === undefined && parcial
      ? undefined
      : normalizarStatus(body.status, STATUS.rascunho);

  const contexto =
    body.contexto === undefined && parcial
      ? undefined
      : normalizarContexto(body.contexto, CONTEXTO.geral);

  const evento_id =
    body.evento_id === undefined && parcial ? undefined : toIntOrNull(body.evento_id);

  const turma_id =
    body.turma_id === undefined && parcial ? undefined : toIntOrNull(body.turma_id);

  const link_externo =
    body.link_externo === undefined && parcial
      ? undefined
      : body.link_externo
        ? validarUrl(body.link_externo)
        : null;

  const exibir_inicio =
    body.exibir_inicio === undefined && parcial
      ? undefined
      : toBool(body.exibir_inicio, true);

  const destaque =
    body.destaque === undefined && parcial ? undefined : toBool(body.destaque, false);

  const obrigatoria =
    body.obrigatoria === undefined && parcial
      ? undefined
      : toBool(body.obrigatoria, false);

  const permite_anonima =
    body.permite_anonima === undefined && parcial
      ? undefined
      : toBool(body.permite_anonima, true);

  const uma_resposta_por_usuario =
    body.uma_resposta_por_usuario === undefined && parcial
      ? undefined
      : toBool(body.uma_resposta_por_usuario, true);

  const abre_em =
    body.abre_em === undefined && parcial
      ? undefined
      : validarTimestampOuNull(body.abre_em);

  const fecha_em =
    body.fecha_em === undefined && parcial
      ? undefined
      : validarTimestampOuNull(body.fecha_em);

  if (titulo !== undefined && (!titulo || titulo.length < 3)) {
    return {
      ok: false,
      message: "Informe o título da pesquisa com pelo menos 3 caracteres.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (tipo !== undefined && !tipo) {
    return {
      ok: false,
      message: "Tipo de pesquisa inválido.",
      code: "TIPO_INVALIDO",
      adminHint: "Tipos oficiais: externa ou interna.",
    };
  }

  if (status !== undefined && !status) {
    return {
      ok: false,
      message: "Status de pesquisa inválido.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicada, encerrada ou arquivada.",
    };
  }

  if (contexto !== undefined && !contexto) {
    return {
      ok: false,
      message: "Contexto de pesquisa inválido.",
      code: "CONTEXTO_INVALIDO",
      adminHint: "Contextos oficiais: geral, evento ou turma.",
    };
  }

  if (
    evento_id !== undefined &&
    evento_id !== null &&
    (Number.isNaN(evento_id) || evento_id <= 0)
  ) {
    return {
      ok: false,
      message: "Evento inválido.",
      code: "EVENTO_INVALIDO",
    };
  }

  if (
    turma_id !== undefined &&
    turma_id !== null &&
    (Number.isNaN(turma_id) || turma_id <= 0)
  ) {
    return {
      ok: false,
      message: "Turma inválida.",
      code: "TURMA_INVALIDA",
    };
  }

  if (body.link_externo && link_externo === null) {
    return {
      ok: false,
      message: "Informe um link externo válido.",
      code: "LINK_EXTERNO_INVALIDO",
      adminHint: "O link deve usar protocolo http ou https.",
    };
  }

  if (abre_em === null && body.abre_em) {
    return {
      ok: false,
      message: "Data/hora de abertura inválida.",
      code: "ABRE_EM_INVALIDO",
    };
  }

  if (fecha_em === null && body.fecha_em) {
    return {
      ok: false,
      message: "Data/hora de fechamento inválida.",
      code: "FECHA_EM_INVALIDO",
    };
  }

  if (abre_em && fecha_em && new Date(fecha_em) <= new Date(abre_em)) {
    return {
      ok: false,
      message: "A data de fechamento deve ser posterior à data de abertura.",
      code: "PERIODO_INVALIDO",
    };
  }

  const data = {
    titulo,
    descricao,
    tipo,
    status,
    contexto,
    evento_id,
    turma_id,
    link_externo,
    exibir_inicio,
    destaque,
    obrigatoria,
    permite_anonima,
    uma_resposta_por_usuario,
    abre_em,
    fecha_em,
  };

  const tipoFinal = tipo;
  const contextoFinal = contexto;

  if (!parcial) {
    if (tipoFinal === TIPO.externa && !link_externo) {
      return {
        ok: false,
        message: "Pesquisa externa exige link externo válido.",
        code: "LINK_EXTERNO_OBRIGATORIO",
      };
    }

    if (tipoFinal === TIPO.interna && link_externo) {
      return {
        ok: false,
        message: "Pesquisa interna não deve possuir link externo.",
        code: "PESQUISA_INTERNA_COM_LINK",
      };
    }

    if (contextoFinal === CONTEXTO.geral && (evento_id || turma_id)) {
      return {
        ok: false,
        message: "Pesquisa geral não deve estar vinculada a evento ou turma.",
        code: "CONTEXTO_GERAL_INVALIDO",
      };
    }

    if (contextoFinal === CONTEXTO.evento && (!evento_id || turma_id)) {
      return {
        ok: false,
        message: "Pesquisa de evento exige evento e não deve ter turma.",
        code: "CONTEXTO_EVENTO_INVALIDO",
      };
    }

    if (contextoFinal === CONTEXTO.turma && !turma_id) {
      return {
        ok: false,
        message: "Pesquisa de turma exige turma.",
        code: "CONTEXTO_TURMA_INVALIDO",
      };
    }
  }

  return {
    ok: true,
    data,
  };
}

/* =========================================================================
   Queries de composição
=========================================================================== */

async function carregarPerguntasComOpcoes(client, pesquisaId) {
  const perguntasResult = await client.query(
    `
      SELECT
        id,
        pesquisa_id,
        tipo,
        enunciado,
        ordem,
        obrigatoria,
        limite_caracteres,
        criado_em,
        atualizado_em
      FROM ${TABELA_PERGUNTA}
      WHERE pesquisa_id = $1
      ORDER BY ordem ASC, id ASC
    `,
    [pesquisaId]
  );

  const perguntas = (perguntasResult.rows || []).map(decorarPergunta);

  if (perguntas.length === 0) {
    return [];
  }

  const ids = perguntas.map((item) => item.id);

  const opcoesResult = await client.query(
    `
      SELECT
        id,
        pergunta_id,
        texto,
        ordem,
        criado_em,
        atualizado_em
      FROM ${TABELA_OPCAO}
      WHERE pergunta_id = ANY($1::int[])
      ORDER BY pergunta_id ASC, ordem ASC, id ASC
    `,
    [ids]
  );

  const opcoesPorPergunta = new Map();

  for (const opcao of opcoesResult.rows || []) {
    if (!opcoesPorPergunta.has(opcao.pergunta_id)) {
      opcoesPorPergunta.set(opcao.pergunta_id, []);
    }

    opcoesPorPergunta.get(opcao.pergunta_id).push(opcao);
  }

  return perguntas.map((pergunta) => ({
    ...pergunta,
    opcoes: opcoesPorPergunta.get(pergunta.id) || [],
  }));
}

async function carregarPesquisaCompleta(client, pesquisaId) {
  const pesquisaResult = await client.query(
    `
      SELECT
        p.*,
        u.nome AS criado_por_nome,
        e.titulo AS evento_titulo,
        t.nome AS turma_nome
      FROM ${TABELA_PESQUISA} p
      LEFT JOIN usuarios u ON u.id = p.criado_por
      LEFT JOIN eventos e ON e.id = p.evento_id
      LEFT JOIN turmas t ON t.id = p.turma_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [pesquisaId]
  );

  const pesquisa = pesquisaResult.rows?.[0]
    ? decorarPesquisa(pesquisaResult.rows[0])
    : null;

  if (!pesquisa) return null;

  const perguntas = await carregarPerguntasComOpcoes(client, pesquisaId);

  return {
    ...pesquisa,
    perguntas,
  };
}

async function inserirPerguntas(client, pesquisaId, perguntas) {
  for (const pergunta of perguntas) {
    const perguntaResult = await client.query(
      `
        INSERT INTO ${TABELA_PERGUNTA} (
          pesquisa_id,
          tipo,
          enunciado,
          ordem,
          obrigatoria,
          limite_caracteres
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      [
        pesquisaId,
        pergunta.tipo,
        pergunta.enunciado,
        pergunta.ordem,
        pergunta.obrigatoria,
        pergunta.limite_caracteres,
      ]
    );

    const perguntaId = perguntaResult.rows[0].id;

    for (const opcao of pergunta.opcoes || []) {
      await client.query(
        `
          INSERT INTO ${TABELA_OPCAO} (
            pergunta_id,
            texto,
            ordem
          )
          VALUES ($1, $2, $3)
        `,
        [perguntaId, opcao.texto, opcao.ordem]
      );
    }
  }
}

async function validarPodePublicar(client, pesquisaId) {
  const pesquisa = await carregarPesquisaCompleta(client, pesquisaId);

  if (!pesquisa) {
    return {
      ok: false,
      status: 404,
      message: "Pesquisa não encontrada.",
      code: "PESQUISA_NAO_ENCONTRADA",
    };
  }

  if (pesquisa.tipo === TIPO.externa) {
    if (!validarUrl(pesquisa.link_externo)) {
      return {
        ok: false,
        status: 400,
        message: "Não foi possível publicar: pesquisa externa exige link válido.",
        code: "PESQUISA_EXTERNA_SEM_LINK",
      };
    }

    return { ok: true, pesquisa };
  }

  if (!Array.isArray(pesquisa.perguntas) || pesquisa.perguntas.length === 0) {
    return {
      ok: false,
      status: 400,
      message:
        "Não foi possível publicar: pesquisa interna precisa ter ao menos uma pergunta.",
      code: "PESQUISA_INTERNA_SEM_PERGUNTA",
    };
  }

  for (const pergunta of pesquisa.perguntas) {
    if (perguntaExigeOpcoes(pergunta.tipo) && pergunta.opcoes.length < 2) {
      return {
        ok: false,
        status: 400,
        message:
          "Não foi possível publicar: perguntas de opção precisam ter pelo menos duas opções.",
        code: "PESQUISA_PERGUNTA_SEM_OPCOES",
        details: {
          pergunta_id: pergunta.id,
          enunciado: pergunta.enunciado,
        },
      };
    }
  }

  return { ok: true, pesquisa };
}

function pesquisaEstaDisponivel(pesquisa) {
  const agora = new Date();

  if (pesquisa.status !== STATUS.publicada) return false;

  if (pesquisa.abre_em && new Date(pesquisa.abre_em) > agora) return false;
  if (pesquisa.fecha_em && new Date(pesquisa.fecha_em) < agora) return false;

  return true;
}

/* =========================================================================
   Admin
=========================================================================== */

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
        requestId,
      });
    }

    if (status) {
      params.push(status);
      filtros.push(`p.status = $${params.length}`);
    }

    const tipo = req.query?.tipo ? normalizarTipo(req.query.tipo, null) : null;

    if (req.query?.tipo !== undefined && !tipo) {
      return falha(res, {
        status: 400,
        message: "Tipo inválido.",
        code: "TIPO_INVALIDO",
        requestId,
      });
    }

    if (tipo) {
      params.push(tipo);
      filtros.push(`p.tipo = $${params.length}`);
    }

    const contexto = req.query?.contexto
      ? normalizarContexto(req.query.contexto, null)
      : null;

    if (req.query?.contexto !== undefined && !contexto) {
      return falha(res, {
        status: 400,
        message: "Contexto inválido.",
        code: "CONTEXTO_INVALIDO",
        requestId,
      });
    }

    if (contexto) {
      params.push(contexto);
      filtros.push(`p.contexto = $${params.length}`);
    }

    const busca = cleanStr(req.query?.busca);

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(`
        (
          p.titulo ILIKE $${params.length}
          OR p.descricao ILIKE $${params.length}
          OR p.link_externo ILIKE $${params.length}
          OR u.nome ILIKE $${params.length}
        )
      `);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await query(
      `
        SELECT
          p.*,
          u.nome AS criado_por_nome,
          e.titulo AS evento_titulo,
          t.nome AS turma_nome,
          COUNT(DISTINCT pr.id)::int AS total_respostas
        FROM ${TABELA_PESQUISA} p
        LEFT JOIN usuarios u ON u.id = p.criado_por
        LEFT JOIN eventos e ON e.id = p.evento_id
        LEFT JOIN turmas t ON t.id = p.turma_id
        LEFT JOIN ${TABELA_RESPOSTA} pr ON pr.pesquisa_id = p.id
        ${where}
        GROUP BY p.id, u.nome, e.titulo, t.nome
        ORDER BY
          p.destaque DESC,
          p.publicada_em DESC NULLS LAST,
          p.criado_em DESC,
          p.id DESC
      `,
      params
    );

    const data = (result.rows || []).map(decorarPesquisa);

    return sucesso(res, {
      data,
      message: "Pesquisas listadas com sucesso.",
      code: "PESQUISA_ADMIN_LISTADA",
      meta: {
        total: data.length,
        status: Object.values(STATUS).map((value) => ({
          value,
          label: STATUS_LABEL[value],
        })),
        tipos: Object.values(TIPO).map((value) => ({
          value,
          label: TIPO_LABEL[value],
        })),
        contextos: Object.values(CONTEXTO).map((value) => ({
          value,
          label: CONTEXTO_LABEL[value],
        })),
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar pesquisas no admin", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar pesquisas.",
      code: "PESQUISA_ADMIN_LISTAR_ERRO",
      adminHint:
        "Verifique tabelas pesquisas, pesquisa_respostas e joins com usuarios/eventos/turmas.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function obterAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const pesquisa = await carregarPesquisaCompleta({ query }, id);

    if (!pesquisa) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: pesquisa,
      message: "Pesquisa carregada com sucesso.",
      code: "PESQUISA_ADMIN_OBTIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter pesquisa no admin", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter pesquisa.",
      code: "PESQUISA_ADMIN_OBTER_ERRO",
      requestId,
    });
  }
}

async function criarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);

  if (!permissao.ok) return permissao.response;

  const validacao = validarPesquisaPayload(req.body || {});

  if (!validacao.ok) {
    return falha(res, {
      status: 400,
      message: validacao.message,
      code: validacao.code,
      adminHint: validacao.adminHint || null,
      requestId,
    });
  }

  const payload = validacao.data;
  const perguntasInput = Array.isArray(req.body?.perguntas) ? req.body.perguntas : [];
  const perguntasValidacao = validarPerguntas(perguntasInput);

  if (!perguntasValidacao.ok) {
    return falha(res, {
      status: 400,
      message: perguntasValidacao.message,
      code: perguntasValidacao.code,
      adminHint: perguntasValidacao.adminHint || null,
      requestId,
    });
  }

  if (payload.tipo === TIPO.externa && perguntasValidacao.data.length > 0) {
    return falha(res, {
      status: 400,
      message: "Pesquisa externa não deve possuir perguntas internas.",
      code: "PESQUISA_EXTERNA_COM_PERGUNTAS",
      requestId,
    });
  }

  if (
    payload.status === STATUS.publicada &&
    payload.tipo === TIPO.interna &&
    perguntasValidacao.data.length === 0
  ) {
    return falha(res, {
      status: 400,
      message:
        "Não foi possível publicar: pesquisa interna precisa ter ao menos uma pergunta.",
      code: "PESQUISA_INTERNA_SEM_PERGUNTA",
      requestId,
    });
  }

  try {
    const pesquisa = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO ${TABELA_PESQUISA} (
            titulo,
            descricao,
            tipo,
            status,
            contexto,
            evento_id,
            turma_id,
            link_externo,
            exibir_inicio,
            destaque,
            obrigatoria,
            permite_anonima,
            uma_resposta_por_usuario,
            abre_em,
            fecha_em,
            criado_por,
            publicada_em,
            encerrada_em,
            arquivada_em
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $16,
            CASE WHEN $4 = 'publicada' THEN now() ELSE NULL END,
            CASE WHEN $4 = 'encerrada' THEN now() ELSE NULL END,
            CASE WHEN $4 = 'arquivada' THEN now() ELSE NULL END
          )
          RETURNING id
        `,
        [
          payload.titulo,
          payload.descricao,
          payload.tipo,
          payload.status,
          payload.contexto,
          payload.evento_id,
          payload.turma_id,
          payload.link_externo,
          payload.exibir_inicio,
          payload.destaque,
          payload.obrigatoria,
          payload.permite_anonima,
          payload.uma_resposta_por_usuario,
          payload.abre_em,
          payload.fecha_em,
          permissao.usuarioId,
        ]
      );

      const pesquisaId = result.rows[0].id;

      if (payload.tipo === TIPO.interna && perguntasValidacao.data.length > 0) {
        await inserirPerguntas(client, pesquisaId, perguntasValidacao.data);
      }

      return carregarPesquisaCompleta(client, pesquisaId);
    });

    return sucesso(res, {
      status: 201,
      data: pesquisa,
      message: "Pesquisa criada com sucesso.",
      code: "PESQUISA_CRIADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao criar pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao criar pesquisa.",
      code: "PESQUISA_CRIAR_ERRO",
      adminHint:
        "Verifique constraints de pesquisas, perguntas, opções, contexto e FKs.",
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
      requestId,
    });
  }

  const validacao = validarPesquisaPayload(req.body || {});

  if (!validacao.ok) {
    return falha(res, {
      status: 400,
      message: validacao.message,
      code: validacao.code,
      adminHint: validacao.adminHint || null,
      requestId,
    });
  }

  const payload = validacao.data;
  const perguntasInput = Array.isArray(req.body?.perguntas) ? req.body.perguntas : [];
  const perguntasValidacao = validarPerguntas(perguntasInput);

  if (!perguntasValidacao.ok) {
    return falha(res, {
      status: 400,
      message: perguntasValidacao.message,
      code: perguntasValidacao.code,
      adminHint: perguntasValidacao.adminHint || null,
      requestId,
    });
  }

  if (payload.tipo === TIPO.externa && perguntasValidacao.data.length > 0) {
    return falha(res, {
      status: 400,
      message: "Pesquisa externa não deve possuir perguntas internas.",
      code: "PESQUISA_EXTERNA_COM_PERGUNTAS",
      requestId,
    });
  }

  if (
    payload.status === STATUS.publicada &&
    payload.tipo === TIPO.interna &&
    perguntasValidacao.data.length === 0
  ) {
    return falha(res, {
      status: 400,
      message:
        "Não foi possível publicar: pesquisa interna precisa ter ao menos uma pergunta.",
      code: "PESQUISA_INTERNA_SEM_PERGUNTA",
      requestId,
    });
  }

  try {
    const pesquisa = await withTransaction(async (client) => {
      const existente = await client.query(
        `
          SELECT id
          FROM ${TABELA_PESQUISA}
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );

      if (!existente.rows?.[0]) {
        return null;
      }

      await client.query(
        `
          UPDATE ${TABELA_PESQUISA}
             SET titulo = $1,
                 descricao = $2,
                 tipo = $3,
                 status = $4,
                 contexto = $5,
                 evento_id = $6,
                 turma_id = $7,
                 link_externo = $8,
                 exibir_inicio = $9,
                 destaque = $10,
                 obrigatoria = $11,
                 permite_anonima = $12,
                 uma_resposta_por_usuario = $13,
                 abre_em = $14,
                 fecha_em = $15,
                 publicada_em = CASE
                   WHEN $4 = 'publicada' THEN COALESCE(publicada_em, now())
                   WHEN $4 = 'rascunho' THEN NULL
                   ELSE publicada_em
                 END,
                 encerrada_em = CASE
                   WHEN $4 = 'encerrada' THEN COALESCE(encerrada_em, now())
                   ELSE NULL
                 END,
                 arquivada_em = CASE
                   WHEN $4 = 'arquivada' THEN COALESCE(arquivada_em, now())
                   ELSE NULL
                 END
           WHERE id = $16
        `,
        [
          payload.titulo,
          payload.descricao,
          payload.tipo,
          payload.status,
          payload.contexto,
          payload.evento_id,
          payload.turma_id,
          payload.link_externo,
          payload.exibir_inicio,
          payload.destaque,
          payload.obrigatoria,
          payload.permite_anonima,
          payload.uma_resposta_por_usuario,
          payload.abre_em,
          payload.fecha_em,
          id,
        ]
      );

      await client.query(
        `
          DELETE FROM ${TABELA_PERGUNTA}
          WHERE pesquisa_id = $1
        `,
        [id]
      );

      if (payload.tipo === TIPO.interna && perguntasValidacao.data.length > 0) {
        await inserirPerguntas(client, id, perguntasValidacao.data);
      }

      return carregarPesquisaCompleta(client, id);
    });

    if (!pesquisa) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: pesquisa,
      message: "Pesquisa atualizada com sucesso.",
      code: "PESQUISA_ATUALIZADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao atualizar pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao atualizar pesquisa.",
      code: "PESQUISA_ATUALIZAR_ERRO",
      adminHint:
        "Verifique constraints de pesquisas, perguntas, opções, contexto e FKs.",
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
      requestId,
    });
  }

  const status = normalizarStatus(req.body?.status, null);

  if (!status) {
    return falha(res, {
      status: 400,
      message: "Status inválido.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicada, encerrada ou arquivada.",
      details: {
        status: req.body?.status,
      },
      requestId,
    });
  }

  try {
    const pesquisa = await withTransaction(async (client) => {
      if (status === STATUS.publicada) {
        const podePublicar = await validarPodePublicar(client, id);

        if (!podePublicar.ok) {
          const error = new Error(podePublicar.message);
          error.publicacao = podePublicar;
          throw error;
        }
      }

      const result = await client.query(
        `
          UPDATE ${TABELA_PESQUISA}
             SET status = $1,
                 publicada_em = CASE
                   WHEN $1 = 'publicada' THEN COALESCE(publicada_em, now())
                   WHEN $1 = 'rascunho' THEN NULL
                   ELSE publicada_em
                 END,
                 encerrada_em = CASE
                   WHEN $1 = 'encerrada' THEN COALESCE(encerrada_em, now())
                   ELSE NULL
                 END,
                 arquivada_em = CASE
                   WHEN $1 = 'arquivada' THEN COALESCE(arquivada_em, now())
                   ELSE NULL
                 END
           WHERE id = $2
           RETURNING id
        `,
        [status, id]
      );

      if (!result.rows?.[0]) return null;

      return carregarPesquisaCompleta(client, id);
    });

    if (!pesquisa) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: pesquisa,
      message: "Status da pesquisa atualizado com sucesso.",
      code: "PESQUISA_STATUS_ATUALIZADO",
    });
  } catch (err) {
    if (err?.publicacao) {
      return falha(res, {
        status: err.publicacao.status || 400,
        message: err.publicacao.message,
        code: err.publicacao.code,
        details: err.publicacao.details || null,
        requestId,
      });
    }

    logErro(requestId, "Erro ao alterar status da pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao alterar status da pesquisa.",
      code: "PESQUISA_STATUS_ERRO",
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
      requestId,
    });
  }

  try {
    const result = await query(
      `
        DELETE FROM ${TABELA_PESQUISA}
        WHERE id = $1
        RETURNING id, titulo
      `,
      [id]
    );

    const removida = result.rows?.[0];

    if (!removida) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: removida,
      message: "Pesquisa excluída com sucesso.",
      code: "PESQUISA_EXCLUIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao excluir pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao excluir pesquisa.",
      code: "PESQUISA_EXCLUIR_ERRO",
      adminHint:
        "Se a pesquisa já tiver valor institucional, considerar arquivamento em vez de exclusão física.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

/* =========================================================================
   Admin — respostas e resultado
=========================================================================== */

async function listarRespostasAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const pesquisa = await carregarPesquisaCompleta({ query }, id);

    if (!pesquisa) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    const respostasResult = await query(
      `
        SELECT
          r.id,
          r.pesquisa_id,
          r.usuario_id,
          CASE WHEN r.anonima THEN NULL ELSE u.nome END AS usuario_nome,
          r.anonima,
          r.enviada_em,
          r.metadata
        FROM ${TABELA_RESPOSTA} r
        LEFT JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.pesquisa_id = $1
        ORDER BY r.enviada_em DESC, r.id DESC
      `,
      [id]
    );

    const respostas = respostasResult.rows || [];
    const respostaIds = respostas.map((item) => item.id);

    let itens = [];

    if (respostaIds.length > 0) {
      const itensResult = await query(
        `
          SELECT
            ri.id,
            ri.resposta_id,
            ri.pergunta_id,
            pp.enunciado,
            pp.tipo AS pergunta_tipo,
            ri.opcao_id,
            po.texto AS opcao_texto,
            ri.resposta_texto,
            ri.resposta_numero
          FROM ${TABELA_RESPOSTA_ITEM} ri
          JOIN ${TABELA_PERGUNTA} pp ON pp.id = ri.pergunta_id
          LEFT JOIN ${TABELA_OPCAO} po ON po.id = ri.opcao_id
          WHERE ri.resposta_id = ANY($1::int[])
          ORDER BY ri.resposta_id DESC, pp.ordem ASC, ri.id ASC
        `,
        [respostaIds]
      );

      itens = itensResult.rows || [];
    }

    const itensPorResposta = new Map();

    for (const item of itens) {
      if (!itensPorResposta.has(item.resposta_id)) {
        itensPorResposta.set(item.resposta_id, []);
      }

      itensPorResposta.get(item.resposta_id).push(item);
    }

    const data = respostas.map((resposta) => ({
      ...resposta,
      itens: itensPorResposta.get(resposta.id) || [],
    }));

    return sucesso(res, {
      data,
      message: "Respostas da pesquisa listadas com sucesso.",
      code: "PESQUISA_RESPOSTAS_LISTADAS",
      meta: {
        pesquisa,
        total: data.length,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar respostas da pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar respostas da pesquisa.",
      code: "PESQUISA_RESPOSTAS_LISTAR_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function resultadoAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);

  if (!permissao.ok) return permissao.response;

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const pesquisa = await carregarPesquisaCompleta({ query }, id);

    if (!pesquisa) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada.",
        code: "PESQUISA_NAO_ENCONTRADA",
        requestId,
      });
    }

    const totalResult = await query(
      `
        SELECT COUNT(*)::int AS total
        FROM ${TABELA_RESPOSTA}
        WHERE pesquisa_id = $1
      `,
      [id]
    );

    const itensResult = await query(
      `
        SELECT
          pp.id AS pergunta_id,
          pp.enunciado,
          pp.tipo AS pergunta_tipo,
          po.id AS opcao_id,
          po.texto AS opcao_texto,
          ri.resposta_texto,
          ri.resposta_numero,
          COUNT(*)::int AS total
        FROM ${TABELA_RESPOSTA_ITEM} ri
        JOIN ${TABELA_PERGUNTA} pp ON pp.id = ri.pergunta_id
        LEFT JOIN ${TABELA_OPCAO} po ON po.id = ri.opcao_id
        JOIN ${TABELA_RESPOSTA} r ON r.id = ri.resposta_id
        WHERE r.pesquisa_id = $1
        GROUP BY
          pp.id,
          pp.enunciado,
          pp.tipo,
          po.id,
          po.texto,
          ri.resposta_texto,
          ri.resposta_numero
        ORDER BY pp.id ASC, total DESC
      `,
      [id]
    );

    const perguntas = new Map();

    for (const pergunta of pesquisa.perguntas || []) {
      perguntas.set(pergunta.id, {
        pergunta_id: pergunta.id,
        enunciado: pergunta.enunciado,
        tipo: pergunta.tipo,
        tipo_label: pergunta.tipo_label,
        total_respostas: 0,
        opcoes: [],
        textos: [],
        numeros: [],
      });
    }

    for (const row of itensResult.rows || []) {
      if (!perguntas.has(row.pergunta_id)) {
        perguntas.set(row.pergunta_id, {
          pergunta_id: row.pergunta_id,
          enunciado: row.enunciado,
          tipo: row.pergunta_tipo,
          tipo_label: TIPO_PERGUNTA_LABEL[row.pergunta_tipo] || row.pergunta_tipo,
          total_respostas: 0,
          opcoes: [],
          textos: [],
          numeros: [],
        });
      }

      const bucket = perguntas.get(row.pergunta_id);
      bucket.total_respostas += Number(row.total || 0);

      if (row.opcao_id) {
        bucket.opcoes.push({
          opcao_id: row.opcao_id,
          texto: row.opcao_texto,
          total: Number(row.total || 0),
        });
      } else if (row.resposta_texto) {
        bucket.textos.push({
          texto: row.resposta_texto,
          total: Number(row.total || 0),
        });
      } else if (row.resposta_numero !== null && row.resposta_numero !== undefined) {
        bucket.numeros.push({
          numero: row.resposta_numero,
          total: Number(row.total || 0),
        });
      }
    }

    return sucesso(res, {
      data: {
        pesquisa,
        total_respostas: totalResult.rows?.[0]?.total || 0,
        perguntas: Array.from(perguntas.values()),
      },
      message: "Resultado da pesquisa carregado com sucesso.",
      code: "PESQUISA_RESULTADO_OBTIDO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter resultado da pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter resultado da pesquisa.",
      code: "PESQUISA_RESULTADO_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

/* =========================================================================
   Usuário
=========================================================================== */

async function listarPublicadas(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      requestId,
    });
  }

  try {
    const params = [usuarioId];
    const filtros = [
      `p.status = 'publicada'`,
      `(p.abre_em IS NULL OR p.abre_em <= now())`,
      `(p.fecha_em IS NULL OR p.fecha_em >= now())`,
      `p.exibir_inicio = true`,
    ];

    const contexto = req.query?.contexto
      ? normalizarContexto(req.query.contexto, null)
      : null;

    if (req.query?.contexto !== undefined && !contexto) {
      return falha(res, {
        status: 400,
        message: "Contexto inválido.",
        code: "CONTEXTO_INVALIDO",
        requestId,
      });
    }

    if (contexto) {
      params.push(contexto);
      filtros.push(`p.contexto = $${params.length}`);
    }

    const busca = cleanStr(req.query?.busca);

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(`
        (
          p.titulo ILIKE $${params.length}
          OR p.descricao ILIKE $${params.length}
        )
      `);
    }

    const result = await query(
      `
        SELECT
          p.*,
          EXISTS (
            SELECT 1
            FROM ${TABELA_RESPOSTA} pr
            WHERE pr.pesquisa_id = p.id
              AND pr.usuario_id = $1
          ) AS respondida,
          COUNT(DISTINCT pr_total.id)::int AS total_respostas
        FROM ${TABELA_PESQUISA} p
        LEFT JOIN ${TABELA_RESPOSTA} pr_total ON pr_total.pesquisa_id = p.id
        WHERE ${filtros.join(" AND ")}
        GROUP BY p.id
        ORDER BY
          p.destaque DESC,
          p.publicada_em DESC NULLS LAST,
          p.criado_em DESC,
          p.id DESC
      `,
      params
    );

    const data = (result.rows || []).map(decorarPesquisa);

    return sucesso(res, {
      data,
      message: "Pesquisas publicadas listadas com sucesso.",
      code: "PESQUISA_PUBLICADA_LISTADA",
      meta: {
        total: data.length,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar pesquisas publicadas", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar pesquisas publicadas.",
      code: "PESQUISA_PUBLICADA_LISTAR_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function obterPublicadaPorId(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);
  const id = validarIdParam(req);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      requestId,
    });
  }

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const pesquisa = await carregarPesquisaCompleta({ query }, id);

    if (!pesquisa || !pesquisaEstaDisponivel(pesquisa)) {
      return falha(res, {
        status: 404,
        message: "Pesquisa não encontrada ou indisponível.",
        code: "PESQUISA_INDISPONIVEL",
        requestId,
      });
    }

    const respondidaResult = await query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM ${TABELA_RESPOSTA}
          WHERE pesquisa_id = $1
            AND usuario_id = $2
        ) AS respondida
      `,
      [id, usuarioId]
    );

    return sucesso(res, {
      data: {
        ...pesquisa,
        respondida: Boolean(respondidaResult.rows?.[0]?.respondida),
      },
      message: "Pesquisa carregada com sucesso.",
      code: "PESQUISA_PUBLICADA_OBTIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter pesquisa publicada", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter pesquisa.",
      code: "PESQUISA_PUBLICADA_OBTER_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

function validarItensResposta(pesquisa, itensInput = []) {
  if (pesquisa.tipo !== TIPO.interna) {
    return {
      ok: false,
      message: "Pesquisa externa não recebe respostas internas na plataforma.",
      code: "PESQUISA_EXTERNA_NAO_RESPONDIVEL",
    };
  }

  if (!Array.isArray(itensInput)) {
    return {
      ok: false,
      message: "Respostas devem ser enviadas em formato de lista.",
      code: "RESPOSTAS_INVALIDAS",
    };
  }

  const perguntas = Array.isArray(pesquisa.perguntas) ? pesquisa.perguntas : [];
  const perguntaMap = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
  const itensPorPergunta = new Map();

  for (const item of itensInput) {
    const perguntaId = Number(item?.pergunta_id);

    if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
      return {
        ok: false,
        message: "Pergunta inválida na resposta.",
        code: "PERGUNTA_INVALIDA",
      };
    }

    const pergunta = perguntaMap.get(perguntaId);

    if (!pergunta) {
      return {
        ok: false,
        message: "Pergunta não pertence à pesquisa informada.",
        code: "PERGUNTA_NAO_PERTENCE",
      };
    }

    if (!itensPorPergunta.has(perguntaId)) {
      itensPorPergunta.set(perguntaId, []);
    }

    itensPorPergunta.get(perguntaId).push(item);
  }

  for (const pergunta of perguntas) {
    const enviados = itensPorPergunta.get(pergunta.id) || [];

    if (pergunta.obrigatoria && enviados.length === 0) {
      return {
        ok: false,
        message: `A pergunta "${pergunta.enunciado}" é obrigatória.`,
        code: "PERGUNTA_OBRIGATORIA",
      };
    }

    if (enviados.length === 0) continue;

    if (pergunta.tipo === TIPO_PERGUNTA.opcao_unica && enviados.length > 1) {
      return {
        ok: false,
        message: `A pergunta "${pergunta.enunciado}" aceita apenas uma opção.`,
        code: "OPCAO_UNICA_MULTIPLA",
      };
    }

    for (const enviado of enviados) {
      const opcaoId =
        enviado.opcao_id === undefined || enviado.opcao_id === null
          ? null
          : Number(enviado.opcao_id);
      const respostaTexto = cleanStr(enviado.resposta_texto);
      const respostaNumero =
        enviado.resposta_numero === undefined || enviado.resposta_numero === null
          ? null
          : Number(enviado.resposta_numero);

      if (perguntaExigeOpcoes(pergunta.tipo)) {
        if (!Number.isInteger(opcaoId) || opcaoId <= 0) {
          return {
            ok: false,
            message: `Selecione uma opção válida para "${pergunta.enunciado}".`,
            code: "OPCAO_INVALIDA",
          };
        }

        const existeOpcao = pergunta.opcoes.some(
          (opcao) => Number(opcao.id) === opcaoId
        );

        if (!existeOpcao) {
          return {
            ok: false,
            message: "Opção não pertence à pergunta informada.",
            code: "OPCAO_NAO_PERTENCE",
          };
        }
      }

      if (perguntaAceitaTexto(pergunta.tipo)) {
        if (!respostaTexto) {
          return {
            ok: false,
            message: `Informe uma resposta para "${pergunta.enunciado}".`,
            code: "RESPOSTA_TEXTO_OBRIGATORIA",
          };
        }

        if (
          pergunta.limite_caracteres &&
          respostaTexto.length > pergunta.limite_caracteres
        ) {
          return {
            ok: false,
            message: `A resposta de "${pergunta.enunciado}" excede o limite de caracteres.`,
            code: "RESPOSTA_TEXTO_LIMITE",
          };
        }
      }

      if (perguntaAceitaNumero(pergunta.tipo)) {
        if (
          !Number.isInteger(respostaNumero) ||
          respostaNumero < 1 ||
          respostaNumero > 5
        ) {
          return {
            ok: false,
            message: `Informe uma nota de 1 a 5 para "${pergunta.enunciado}".`,
            code: "RESPOSTA_ESCALA_INVALIDA",
          };
        }
      }
    }
  }

  const normalizados = [];

  for (const [perguntaId, enviados] of itensPorPergunta.entries()) {
    const pergunta = perguntaMap.get(perguntaId);

    for (const enviado of enviados) {
      normalizados.push({
        pergunta_id: perguntaId,
        opcao_id: perguntaExigeOpcoes(pergunta.tipo)
          ? Number(enviado.opcao_id)
          : null,
        resposta_texto: perguntaAceitaTexto(pergunta.tipo)
          ? cleanStr(enviado.resposta_texto)
          : null,
        resposta_numero: perguntaAceitaNumero(pergunta.tipo)
          ? Number(enviado.resposta_numero)
          : null,
      });
    }
  }

  return {
    ok: true,
    data: normalizados,
  };
}

async function responderPublicada(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);
  const id = validarIdParam(req);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      requestId,
    });
  }

  if (!id) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const resposta = await withTransaction(async (client) => {
      const pesquisa = await carregarPesquisaCompleta(client, id);

      if (!pesquisa || !pesquisaEstaDisponivel(pesquisa)) {
        const error = new Error("Pesquisa não encontrada ou indisponível.");
        error.status = 404;
        error.code = "PESQUISA_INDISPONIVEL";
        throw error;
      }

      if (pesquisa.tipo !== TIPO.interna) {
        const error = new Error(
          "Pesquisa externa deve ser respondida pelo link externo informado."
        );
        error.status = 400;
        error.code = "PESQUISA_EXTERNA_NAO_RESPONDIVEL";
        throw error;
      }

      const anonima = Boolean(req.body?.anonima);

      if (anonima && !pesquisa.permite_anonima) {
        const error = new Error("Esta pesquisa não permite resposta anônima.");
        error.status = 400;
        error.code = "ANONIMA_NAO_PERMITIDA";
        throw error;
      }

      if (pesquisa.uma_resposta_por_usuario) {
        const jaRespondeu = await client.query(
          `
            SELECT id
            FROM ${TABELA_RESPOSTA}
            WHERE pesquisa_id = $1
              AND usuario_id = $2
            LIMIT 1
          `,
          [id, usuarioId]
        );

        if (jaRespondeu.rows?.[0]) {
          const error = new Error("Você já respondeu esta pesquisa.");
          error.status = 409;
          error.code = "PESQUISA_JA_RESPONDIDA";
          throw error;
        }
      }

      const itensValidacao = validarItensResposta(pesquisa, req.body?.itens || []);

      if (!itensValidacao.ok) {
        const error = new Error(itensValidacao.message);
        error.status = 400;
        error.code = itensValidacao.code;
        throw error;
      }

      const respostaResult = await client.query(
        `
          INSERT INTO ${TABELA_RESPOSTA} (
            pesquisa_id,
            usuario_id,
            anonima,
            metadata
          )
          VALUES ($1, $2, $3, $4)
          RETURNING id, pesquisa_id, usuario_id, anonima, enviada_em, metadata
        `,
        [
          id,
          anonima ? null : usuarioId,
          anonima,
          req.body?.metadata && typeof req.body.metadata === "object"
            ? req.body.metadata
            : null,
        ]
      );

      const respostaCriada = respostaResult.rows[0];

      for (const item of itensValidacao.data) {
        await client.query(
          `
            INSERT INTO ${TABELA_RESPOSTA_ITEM} (
              resposta_id,
              pergunta_id,
              opcao_id,
              resposta_texto,
              resposta_numero
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            respostaCriada.id,
            item.pergunta_id,
            item.opcao_id,
            item.resposta_texto,
            item.resposta_numero,
          ]
        );
      }

      return respostaCriada;
    });

    return sucesso(res, {
      status: 201,
      data: resposta,
      message: "Resposta registrada com sucesso.",
      code: "PESQUISA_RESPOSTA_REGISTRADA",
    });
  } catch (err) {
    if (err?.status && err?.code) {
      return falha(res, {
        status: err.status,
        message: err.message,
        code: err.code,
        requestId,
      });
    }

    logErro(requestId, "Erro ao responder pesquisa", err);

    return falha(res, {
      status: 500,
      message: "Erro ao registrar resposta da pesquisa.",
      code: "PESQUISA_RESPONDER_ERRO",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

module.exports = {
  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,

  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  listarRespostasAdmin,
  resultadoAdmin,
  excluirAdmin,
};