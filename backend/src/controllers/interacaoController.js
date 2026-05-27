/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/interacaoController.js — v2.0
 * Atualizado em: 19/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Controller oficial do módulo Interações.
 *
 * Tipos oficiais:
 * - votacao
 * - quiz
 * - nuvem_palavras
 *
 * Regras centrais:
 * - Usuário precisa estar logado.
 * - Interação precisa estar publicada/em andamento conforme fluxo.
 * - Votação e nuvem respeitam janela de data/horário.
 * - Votação exige inscrição ou presença quando vinculada a evento/turma.
 * - Votação/nuvem bloqueiam repetição por usuário no backend.
 * - Quiz bloqueia repetição por pergunta pelo índice do banco.
 * - Geolocalização é opcional e validada no backend quando ativada.
 *
 * Contrato oficial:
 * - Tabelas:
 *   - interacoes
 *   - interacao_janelas
 *   - interacao_perguntas
 *   - interacao_opcoes
 *   - interacao_execucoes
 *   - interacao_respostas
 *
 * Diretrizes v2.0:
 * - sem legado;
 * - sem aliases;
 * - sem rota plural;
 * - sem resposta { erro };
 * - envelope ok/data/message/code/meta;
 * - adminHint/details/requestId em erro;
 * - contrato único;
 * - backend protege regra de negócio;
 * - banco protege integridade.
 */

const crypto = require("crypto");
const dbModule = require("../db");

const db = dbModule?.db ?? dbModule;

const TABELA_INTERACAO = "interacoes";
const TABELA_JANELA = "interacao_janelas";
const TABELA_PERGUNTA = "interacao_perguntas";
const TABELA_OPCAO = "interacao_opcoes";
const TABELA_EXECUCAO = "interacao_execucoes";
const TABELA_RESPOSTA = "interacao_respostas";

const PERFIL_ADMINISTRADOR = "administrador";

const TIPO = Object.freeze({
  votacao: "votacao",
  quiz: "quiz",
  nuvem_palavras: "nuvem_palavras",
});

const STATUS = Object.freeze({
  rascunho: "rascunho",
  publicada: "publicada",
  em_andamento: "em_andamento",
  encerrada: "encerrada",
  arquivada: "arquivada",
});

const CONTEXTO = Object.freeze({
  geral: "geral",
  evento: "evento",
  turma: "turma",
});

const STATUS_PERGUNTA = Object.freeze({
  aguardando: "aguardando",
  aberta: "aberta",
  fechada: "fechada",
  gabarito_exibido: "gabarito_exibido",
});

const STATUS_EXECUCAO = Object.freeze({
  aguardando: "aguardando",
  em_andamento: "em_andamento",
  pausada: "pausada",
  encerrada: "encerrada",
});

const TIPOS_OFICIAIS = new Set(Object.values(TIPO));
const STATUS_OFICIAIS = new Set(Object.values(STATUS));
const CONTEXTOS_OFICIAIS = new Set(Object.values(CONTEXTO));

const TIPO_LABEL = Object.freeze({
  votacao: "Votação",
  quiz: "Quiz",
  nuvem_palavras: "Nuvem de palavras",
});

const STATUS_LABEL = Object.freeze({
  rascunho: "Rascunho",
  publicada: "Publicada",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
  arquivada: "Arquivada",
});

const CONTEXTO_LABEL = Object.freeze({
  geral: "Geral",
  evento: "Evento",
  turma: "Turma",
});

/* =========================================================================
   DB helpers
=========================================================================== */

function getQuery() {
  if (typeof db?.query === "function") return db.query.bind(db);
  if (typeof db?.pool?.query === "function") return db.pool.query.bind(db.pool);
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
    "DB inválido em interacaoController.js: export oficial precisa expor query."
  );
}

async function withTransaction(callback) {
  const pool = getPool();

  if (!pool) {
    return callback({ query });
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
  return `interacao-${Date.now().toString(36)}-${Math.random()
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
  console.error(`[interacaoController][${requestId}] ${contexto}`, {
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
  return cleanStr(value) || "";
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

function toNumberOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function normalizarEnum(value, oficiais, fallback = null) {
  const text = cleanStr(value);

  if (!text) return fallback;

  const normalized = String(text).toLowerCase();

  return oficiais.has(normalized) ? normalized : null;
}

function normalizarTipo(value, fallback = TIPO.votacao) {
  return normalizarEnum(value, TIPOS_OFICIAIS, fallback);
}

function normalizarStatus(value, fallback = STATUS.rascunho) {
  return normalizarEnum(value, STATUS_OFICIAIS, fallback);
}

function normalizarContexto(value, fallback = CONTEXTO.geral) {
  return normalizarEnum(value, CONTEXTOS_OFICIAIS, fallback);
}

function validarIdParam(req) {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
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
        adminHint: "Somente perfil oficial administrador pode gerenciar interações.",
        requestId,
      }),
    };
  }

  return { ok: true, usuarioId };
}

function gerarTokenSeguro(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function normalizarPalavra(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decorarInteracao(row) {
  if (!row) return null;

  return {
    ...row,
    tipo_label: TIPO_LABEL[row.tipo] || row.tipo,
    status_label: STATUS_LABEL[row.status] || row.status,
    contexto_label: CONTEXTO_LABEL[row.contexto] || row.contexto,
  };
}

function validarLatitudeLongitude(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lon < -180 || lon > 180) return null;

  return { latitude: lat, longitude: lon };
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/* =========================================================================
   Payload admin
=========================================================================== */

function validarJanelas(janelasInput = []) {
  if (!Array.isArray(janelasInput)) {
    return {
      ok: false,
      message: "As janelas devem ser enviadas em formato de lista.",
      code: "JANELAS_INVALIDAS",
    };
  }

  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  const horaRegex = /^\d{2}:\d{2}(:\d{2})?$/;

  const janelas = [];

  for (let index = 0; index < janelasInput.length; index += 1) {
    const item = janelasInput[index] || {};
    const data = cleanStr(item.data);
    const horario_inicio = cleanStr(item.horario_inicio);
    const horario_fim = cleanStr(item.horario_fim);

    if (!dataRegex.test(data || "")) {
      return {
        ok: false,
        message: `Data inválida na janela ${index + 1}.`,
        code: "JANELA_DATA_INVALIDA",
      };
    }

    if (!horaRegex.test(horario_inicio || "") || !horaRegex.test(horario_fim || "")) {
      return {
        ok: false,
        message: `Horário inválido na janela ${index + 1}.`,
        code: "JANELA_HORARIO_INVALIDO",
      };
    }

    if (horario_fim <= horario_inicio) {
      return {
        ok: false,
        message: `Horário final deve ser posterior ao inicial na janela ${index + 1}.`,
        code: "JANELA_HORARIO_ORDEM_INVALIDA",
      };
    }

    janelas.push({
      data,
      horario_inicio,
      horario_fim,
    });
  }

  return { ok: true, data: janelas };
}

function validarPerguntasOpcoes(tipo, perguntasInput = []) {
  if (!Array.isArray(perguntasInput)) {
    return {
      ok: false,
      message: "Perguntas devem ser enviadas em formato de lista.",
      code: "PERGUNTAS_INVALIDAS",
    };
  }

  const perguntas = [];

  if (tipo === TIPO.nuvem_palavras && perguntasInput.length !== 1) {
    return {
      ok: false,
      message: "Nuvem de palavras deve possuir exatamente uma pergunta.",
      code: "NUVEM_PERGUNTA_UNICA",
    };
  }

  if ((tipo === TIPO.votacao || tipo === TIPO.quiz) && perguntasInput.length === 0) {
    return {
      ok: false,
      message: "Informe pelo menos uma pergunta.",
      code: "PERGUNTA_OBRIGATORIA",
    };
  }

  if (tipo === TIPO.votacao && perguntasInput.length !== 1) {
    return {
      ok: false,
      message: "Votação deve possuir exatamente uma pergunta.",
      code: "VOTACAO_PERGUNTA_UNICA",
    };
  }

  for (let index = 0; index < perguntasInput.length; index += 1) {
    const pergunta = perguntasInput[index] || {};
    const enunciado = cleanRequiredStr(pergunta.enunciado);
    const ordem =
      pergunta.ordem === undefined || pergunta.ordem === null || pergunta.ordem === ""
        ? index
        : toIntOrNull(pergunta.ordem);

    const obrigatoria = toBool(pergunta.obrigatoria, true);
    const peso =
      pergunta.peso === undefined || pergunta.peso === null || pergunta.peso === ""
        ? 1
        : toNumberOrNull(pergunta.peso);
    const limite_caracteres = toIntOrNull(pergunta.limite_caracteres);
    const tempo_segundos = toIntOrNull(pergunta.tempo_segundos);
    const feedback_correto = cleanStr(pergunta.feedback_correto);
    const feedback_incorreto = cleanStr(pergunta.feedback_incorreto);
    const opcoesInput = Array.isArray(pergunta.opcoes) ? pergunta.opcoes : [];

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
        code: "PERGUNTA_ORDEM_INVALIDA",
      };
    }

    if (Number.isNaN(peso) || peso < 0) {
      return {
        ok: false,
        message: `Peso inválido na pergunta ${index + 1}.`,
        code: "PERGUNTA_PESO_INVALIDO",
      };
    }

    if (
      limite_caracteres !== undefined &&
      limite_caracteres !== null &&
      (Number.isNaN(limite_caracteres) || limite_caracteres <= 0)
    ) {
      return {
        ok: false,
        message: `Limite de caracteres inválido na pergunta ${index + 1}.`,
        code: "PERGUNTA_LIMITE_INVALIDO",
      };
    }

    if (
      tempo_segundos !== undefined &&
      tempo_segundos !== null &&
      (Number.isNaN(tempo_segundos) || tempo_segundos <= 0)
    ) {
      return {
        ok: false,
        message: `Tempo inválido na pergunta ${index + 1}.`,
        code: "PERGUNTA_TEMPO_INVALIDO",
      };
    }

    const opcoes = [];

    if (tipo === TIPO.votacao || tipo === TIPO.quiz) {
      if (opcoesInput.length < 2) {
        return {
          ok: false,
          message: `A pergunta ${index + 1} precisa ter pelo menos duas opções.`,
          code: "OPCOES_INSUFICIENTES",
        };
      }

      let corretas = 0;

      for (let optionIndex = 0; optionIndex < opcoesInput.length; optionIndex += 1) {
        const opcao = opcoesInput[optionIndex] || {};
        const texto = cleanRequiredStr(opcao.texto);
        const ordemOpcao =
          opcao.ordem === undefined || opcao.ordem === null || opcao.ordem === ""
            ? optionIndex
            : toIntOrNull(opcao.ordem);
        const correta = Boolean(opcao.correta);

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
            message: `Ordem inválida na opção ${optionIndex + 1}.`,
            code: "OPCAO_ORDEM_INVALIDA",
          };
        }

        if (correta) corretas += 1;

        opcoes.push({
          texto,
          ordem: ordemOpcao,
          correta,
        });
      }

      if (tipo === TIPO.quiz && corretas < 1) {
        return {
          ok: false,
          message: `A pergunta ${index + 1} do quiz precisa ter ao menos uma opção correta.`,
          code: "QUIZ_SEM_OPCAO_CORRETA",
        };
      }
    }

    perguntas.push({
      enunciado,
      ordem,
      obrigatoria,
      peso,
      limite_caracteres:
        limite_caracteres === undefined ? null : limite_caracteres,
      tempo_segundos: tempo_segundos === undefined ? null : tempo_segundos,
      feedback_correto,
      feedback_incorreto,
      opcoes,
    });
  }

  return { ok: true, data: perguntas };
}

function validarPayloadInteracao(body = {}) {
  const titulo = cleanRequiredStr(body.titulo);
  const descricao = cleanStr(body.descricao);
  const tipo = normalizarTipo(body.tipo, null);
  const status = normalizarStatus(body.status, STATUS.rascunho);
  const contexto = normalizarContexto(body.contexto, CONTEXTO.geral);

  const evento_id = toIntOrNull(body.evento_id);
  const turma_id = toIntOrNull(body.turma_id);

  const exige_inscricao_ou_presenca = toBool(
    body.exige_inscricao_ou_presenca,
    true
  );
  const exige_geolocalizacao = toBool(body.exige_geolocalizacao, false);
  const latitude = toNumberOrNull(body.latitude);
  const longitude = toNumberOrNull(body.longitude);
  const raio_metros = toIntOrNull(body.raio_metros);

  const permite_anonima = toBool(body.permite_anonima, false);
  const uma_resposta_por_usuario = toBool(body.uma_resposta_por_usuario, true);
  const mostrar_resultado_usuario = toBool(body.mostrar_resultado_usuario, false);
  const mostrar_resultado_admin = toBool(body.mostrar_resultado_admin, true);
  const exibir_ranking = toBool(body.exibir_ranking, true);

  const tempo_por_pergunta_segundos = toIntOrNull(
    body.tempo_por_pergunta_segundos
  );
  const mostrar_gabarito = toBool(body.mostrar_gabarito, false);
  const embaralhar_opcoes = toBool(body.embaralhar_opcoes, false);
  const tentativas_max = toIntOrNull(body.tentativas_max);
  const nota_minima = toNumberOrNull(body.nota_minima);

  const atualizar_automaticamente = toBool(
    body.atualizar_automaticamente,
    true
  );
  const intervalo_atualizacao_segundos =
    body.intervalo_atualizacao_segundos === undefined
      ? 3
      : toIntOrNull(body.intervalo_atualizacao_segundos);
  const limite_palavra_caracteres = toIntOrNull(body.limite_palavra_caracteres);

  if (!titulo || titulo.length < 3) {
    return {
      ok: false,
      message: "Informe o título da interação com pelo menos 3 caracteres.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (!tipo) {
    return {
      ok: false,
      message: "Tipo de interação inválido.",
      code: "TIPO_INVALIDO",
      adminHint: "Tipos oficiais: votacao, quiz ou nuvem_palavras.",
    };
  }

  if (!status) {
    return {
      ok: false,
      message: "Status inválido.",
      code: "STATUS_INVALIDO",
    };
  }

  if (!contexto) {
    return {
      ok: false,
      message: "Contexto inválido.",
      code: "CONTEXTO_INVALIDO",
    };
  }

  if (contexto === CONTEXTO.geral && (evento_id || turma_id)) {
    return {
      ok: false,
      message: "Interação geral não deve estar vinculada a evento ou turma.",
      code: "CONTEXTO_GERAL_INVALIDO",
    };
  }

  if (contexto === CONTEXTO.evento && (!evento_id || turma_id)) {
    return {
      ok: false,
      message: "Interação de evento exige evento e não deve ter turma.",
      code: "CONTEXTO_EVENTO_INVALIDO",
    };
  }

  if (contexto === CONTEXTO.turma && !turma_id) {
    return {
      ok: false,
      message: "Interação de turma exige turma.",
      code: "CONTEXTO_TURMA_INVALIDO",
    };
  }

  if (tipo === TIPO.votacao && contexto === CONTEXTO.geral) {
    return {
      ok: false,
      message: "Votação deve estar vinculada a evento ou turma.",
      code: "VOTACAO_EXIGE_CONTEXTO",
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

  if (exige_geolocalizacao) {
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      Number.isNaN(raio_metros) ||
      raio_metros <= 0
    ) {
      return {
        ok: false,
        message:
          "Geolocalização exige latitude, longitude e raio em metros válidos.",
        code: "GEOLOCALIZACAO_INVALIDA",
      };
    }

    if (!validarLatitudeLongitude(latitude, longitude)) {
      return {
        ok: false,
        message: "Latitude ou longitude inválida.",
        code: "COORDENADAS_INVALIDAS",
      };
    }
  }

  for (const [campo, valor] of Object.entries({
    tempo_por_pergunta_segundos,
    tentativas_max,
    intervalo_atualizacao_segundos,
    limite_palavra_caracteres,
  })) {
    if (
      valor !== undefined &&
      valor !== null &&
      (Number.isNaN(valor) || valor <= 0)
    ) {
      return {
        ok: false,
        message: `Campo numérico inválido: ${campo}.`,
        code: "NUMERO_INVALIDO",
      };
    }
  }

  if (
    nota_minima !== undefined &&
    nota_minima !== null &&
    (Number.isNaN(nota_minima) || nota_minima < 0)
  ) {
    return {
      ok: false,
      message: "Nota mínima inválida.",
      code: "NOTA_MINIMA_INVALIDA",
    };
  }

  const janelasValidacao = validarJanelas(body.janelas || []);
  if (!janelasValidacao.ok) return janelasValidacao;

  const perguntasValidacao = validarPerguntasOpcoes(tipo, body.perguntas || []);
  if (!perguntasValidacao.ok) return perguntasValidacao;

  if ((tipo === TIPO.votacao || tipo === TIPO.nuvem_palavras) && janelasValidacao.data.length === 0) {
    return {
      ok: false,
      message: "Informe pelo menos uma janela de disponibilidade.",
      code: "JANELA_OBRIGATORIA",
    };
  }

  return {
    ok: true,
    data: {
      titulo,
      descricao,
      tipo,
      status,
      contexto,
      evento_id: contexto === CONTEXTO.evento ? evento_id : null,
      turma_id: contexto === CONTEXTO.turma ? turma_id : null,

      qr_token: cleanStr(body.qr_token) || gerarTokenSeguro(16),
      qr_token_expira_em: cleanStr(body.qr_token_expira_em),

      exige_inscricao_ou_presenca,
      exige_geolocalizacao,
      latitude: exige_geolocalizacao ? latitude : null,
      longitude: exige_geolocalizacao ? longitude : null,
      raio_metros: exige_geolocalizacao ? raio_metros : null,

      permite_anonima,
      uma_resposta_por_usuario,
      mostrar_resultado_usuario,
      mostrar_resultado_admin,
      exibir_ranking,

      tempo_por_pergunta_segundos:
        tempo_por_pergunta_segundos === undefined
          ? null
          : tempo_por_pergunta_segundos,
      mostrar_gabarito,
      embaralhar_opcoes,
      tentativas_max: tentativas_max === undefined ? null : tentativas_max,
      nota_minima: nota_minima === undefined ? null : nota_minima,

      atualizar_automaticamente,
      intervalo_atualizacao_segundos:
        intervalo_atualizacao_segundos === undefined
          ? 3
          : intervalo_atualizacao_segundos,
      limite_palavra_caracteres:
        limite_palavra_caracteres === undefined ? null : limite_palavra_caracteres,

      janelas: janelasValidacao.data,
      perguntas: perguntasValidacao.data,
    },
  };
}

/* =========================================================================
   Carregamento composto
=========================================================================== */

async function carregarPerguntasComOpcoes(client, interacaoId) {
  const perguntasResult = await client.query(
    `
      SELECT *
      FROM ${TABELA_PERGUNTA}
      WHERE interacao_id = $1
      ORDER BY ordem ASC, id ASC
    `,
    [interacaoId]
  );

  const perguntas = perguntasResult.rows || [];

  if (perguntas.length === 0) return [];

  const ids = perguntas.map((pergunta) => pergunta.id);

  const opcoesResult = await client.query(
    `
      SELECT *
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

async function carregarJanelas(client, interacaoId) {
  const result = await client.query(
    `
      SELECT *
      FROM ${TABELA_JANELA}
      WHERE interacao_id = $1
      ORDER BY data ASC, horario_inicio ASC, id ASC
    `,
    [interacaoId]
  );

  return result.rows || [];
}

async function carregarInteracaoCompleta(client, interacaoId) {
  const interacaoResult = await client.query(
    `
      SELECT
        i.*,
        u.nome AS criado_por_nome,
        e.titulo AS evento_titulo,
        t.nome AS turma_nome
      FROM ${TABELA_INTERACAO} i
      LEFT JOIN usuarios u ON u.id = i.criado_por
      LEFT JOIN eventos e ON e.id = i.evento_id
      LEFT JOIN turmas t ON t.id = i.turma_id
      WHERE i.id = $1
      LIMIT 1
    `,
    [interacaoId]
  );

  const interacao = interacaoResult.rows?.[0]
    ? decorarInteracao(interacaoResult.rows[0])
    : null;

  if (!interacao) return null;

  const [janelas, perguntas] = await Promise.all([
    carregarJanelas(client, interacaoId),
    carregarPerguntasComOpcoes(client, interacaoId),
  ]);

  return {
    ...interacao,
    janelas,
    perguntas,
  };
}

async function inserirJanelas(client, interacaoId, janelas) {
  for (const janela of janelas || []) {
    await client.query(
      `
        INSERT INTO ${TABELA_JANELA} (
          interacao_id,
          data,
          horario_inicio,
          horario_fim
        )
        VALUES ($1, $2, $3, $4)
      `,
      [interacaoId, janela.data, janela.horario_inicio, janela.horario_fim]
    );
  }
}

async function inserirPerguntasOpcoes(client, interacaoId, perguntas) {
  for (const pergunta of perguntas || []) {
    const perguntaResult = await client.query(
      `
        INSERT INTO ${TABELA_PERGUNTA} (
          interacao_id,
          enunciado,
          ordem,
          obrigatoria,
          peso,
          limite_caracteres,
          tempo_segundos,
          feedback_correto,
          feedback_incorreto
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
      [
        interacaoId,
        pergunta.enunciado,
        pergunta.ordem,
        pergunta.obrigatoria,
        pergunta.peso,
        pergunta.limite_caracteres,
        pergunta.tempo_segundos,
        pergunta.feedback_correto,
        pergunta.feedback_incorreto,
      ]
    );

    const perguntaId = perguntaResult.rows[0].id;

    for (const opcao of pergunta.opcoes || []) {
      await client.query(
        `
          INSERT INTO ${TABELA_OPCAO} (
            pergunta_id,
            texto,
            ordem,
            correta
          )
          VALUES ($1, $2, $3, $4)
        `,
        [perguntaId, opcao.texto, opcao.ordem, opcao.correta]
      );
    }
  }
}

/* =========================================================================
   Regras de participação
=========================================================================== */

async function verificarInscricaoOuPresenca(client, interacao, usuarioId) {
  if (!interacao.exige_inscricao_ou_presenca) return true;
  if (interacao.contexto === CONTEXTO.geral) return true;

  if (interacao.contexto === CONTEXTO.turma) {
    const turmaId = Number(interacao.turma_id);

    const result = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM inscricoes i
          WHERE i.usuario_id = $1
            AND i.turma_id = $2
        )
        OR EXISTS (
          SELECT 1
          FROM presencas p
          WHERE p.usuario_id = $1
            AND p.turma_id = $2
        ) AS autorizado
      `,
      [usuarioId, turmaId]
    );

    return Boolean(result.rows?.[0]?.autorizado);
  }

  if (interacao.contexto === CONTEXTO.evento) {
    const eventoId = Number(interacao.evento_id);

    const result = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
          WHERE i.usuario_id = $1
            AND t.evento_id = $2
        )
        OR EXISTS (
          SELECT 1
          FROM presencas p
          JOIN turmas t ON t.id = p.turma_id
          WHERE p.usuario_id = $1
            AND t.evento_id = $2
        ) AS autorizado
      `,
      [usuarioId, eventoId]
    );

    return Boolean(result.rows?.[0]?.autorizado);
  }

  return false;
}

async function verificarJanelaDisponivel(client, interacaoId) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM ${TABELA_JANELA}
        WHERE interacao_id = $1
          AND data = CURRENT_DATE
          AND CURRENT_TIME >= horario_inicio
          AND CURRENT_TIME <= horario_fim
      ) AS disponivel
    `,
    [interacaoId]
  );

  return Boolean(result.rows?.[0]?.disponivel);
}

async function usuarioJaRespondeuInteracao(client, interacaoId, usuarioId) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM ${TABELA_RESPOSTA}
        WHERE interacao_id = $1
          AND usuario_id = $2
      ) AS ja_respondeu
    `,
    [interacaoId, usuarioId]
  );

  return Boolean(result.rows?.[0]?.ja_respondeu);
}

function validarGeolocalizacaoInteracao(interacao, body = {}) {
  if (!interacao.exige_geolocalizacao) {
    return {
      ok: true,
      latitude_usuario: null,
      longitude_usuario: null,
      distancia_metros: null,
    };
  }

  const coordenadas = validarLatitudeLongitude(
    body.latitude_usuario,
    body.longitude_usuario
  );

  if (!coordenadas) {
    return {
      ok: false,
      message:
        "Esta interação exige localização. Autorize o acesso à localização e tente novamente.",
      code: "LOCALIZACAO_OBRIGATORIA",
    };
  }

  const distancia = calcularDistanciaMetros(
    Number(interacao.latitude),
    Number(interacao.longitude),
    coordenadas.latitude,
    coordenadas.longitude
  );

  if (distancia > Number(interacao.raio_metros)) {
    return {
      ok: false,
      message: "Você está fora da área permitida para responder esta interação.",
      code: "FORA_DA_AREA_PERMITIDA",
      details: {
        distancia_metros: distancia,
        raio_metros: Number(interacao.raio_metros),
      },
    };
  }

  return {
    ok: true,
    latitude_usuario: coordenadas.latitude,
    longitude_usuario: coordenadas.longitude,
    distancia_metros: distancia,
  };
}

function validarRespostaUsuario(interacao, body = {}) {
  const perguntaId = Number(body.pergunta_id);
  const opcaoId =
    body.opcao_id === undefined || body.opcao_id === null || body.opcao_id === ""
      ? null
      : Number(body.opcao_id);
  const respostaTexto = cleanStr(body.resposta_texto);

  if (!Number.isInteger(perguntaId) || perguntaId <= 0) {
    return {
      ok: false,
      message: "Pergunta inválida.",
      code: "PERGUNTA_INVALIDA",
    };
  }

  const pergunta = (interacao.perguntas || []).find(
    (item) => Number(item.id) === perguntaId
  );

  if (!pergunta) {
    return {
      ok: false,
      message: "Pergunta não pertence à interação informada.",
      code: "PERGUNTA_NAO_PERTENCE",
    };
  }

  if (interacao.tipo === TIPO.votacao || interacao.tipo === TIPO.quiz) {
    if (!Number.isInteger(opcaoId) || opcaoId <= 0) {
      return {
        ok: false,
        message: "Selecione uma opção válida.",
        code: "OPCAO_INVALIDA",
      };
    }

    const opcao = (pergunta.opcoes || []).find(
      (item) => Number(item.id) === opcaoId
    );

    if (!opcao) {
      return {
        ok: false,
        message: "Opção não pertence à pergunta informada.",
        code: "OPCAO_NAO_PERTENCE",
      };
    }

    return {
      ok: true,
      pergunta,
      opcao,
      opcao_id: opcaoId,
      resposta_texto: null,
      resposta_normalizada: null,
    };
  }

  if (interacao.tipo === TIPO.nuvem_palavras) {
    if (!respostaTexto) {
      return {
        ok: false,
        message: "Informe uma palavra para enviar.",
        code: "PALAVRA_OBRIGATORIA",
      };
    }

    const limite = Number(interacao.limite_palavra_caracteres || 40);

    if (respostaTexto.length > limite) {
      return {
        ok: false,
        message: `A palavra deve ter no máximo ${limite} caracteres.`,
        code: "PALAVRA_LIMITE_EXCEDIDO",
      };
    }

    const normalizada = normalizarPalavra(respostaTexto);

    if (!normalizada) {
      return {
        ok: false,
        message: "Informe uma palavra válida.",
        code: "PALAVRA_INVALIDA",
      };
    }

    return {
      ok: true,
      pergunta,
      opcao: null,
      opcao_id: null,
      resposta_texto: respostaTexto,
      resposta_normalizada: normalizada,
    };
  }

  return {
    ok: false,
    message: "Tipo de interação inválido.",
    code: "TIPO_INVALIDO",
  };
}

/* =========================================================================
   Admin — CRUD
=========================================================================== */

async function listarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);

  if (!permissao.ok) return permissao.response;

  try {
    const params = [];
    const filtros = [];

    const tipo = req.query?.tipo ? normalizarTipo(req.query.tipo, null) : null;
    const status = req.query?.status
      ? normalizarStatus(req.query.status, null)
      : null;

    if (req.query?.tipo !== undefined && !tipo) {
      return falha(res, {
        status: 400,
        message: "Tipo inválido.",
        code: "TIPO_INVALIDO",
        requestId,
      });
    }

    if (req.query?.status !== undefined && !status) {
      return falha(res, {
        status: 400,
        message: "Status inválido.",
        code: "STATUS_INVALIDO",
        requestId,
      });
    }

    if (tipo) {
      params.push(tipo);
      filtros.push(`i.tipo = $${params.length}`);
    }

    if (status) {
      params.push(status);
      filtros.push(`i.status = $${params.length}`);
    }

    const busca = cleanStr(req.query?.busca);

    if (busca) {
      params.push(`%${busca}%`);
      filtros.push(`
        (
          i.titulo ILIKE $${params.length}
          OR i.descricao ILIKE $${params.length}
          OR u.nome ILIKE $${params.length}
        )
      `);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await query(
      `
        SELECT
          i.*,
          u.nome AS criado_por_nome,
          e.titulo AS evento_titulo,
          t.nome AS turma_nome,
          COUNT(DISTINCT r.id)::int AS total_respostas
        FROM ${TABELA_INTERACAO} i
        LEFT JOIN usuarios u ON u.id = i.criado_por
        LEFT JOIN eventos e ON e.id = i.evento_id
        LEFT JOIN turmas t ON t.id = i.turma_id
        LEFT JOIN ${TABELA_RESPOSTA} r ON r.interacao_id = i.id
        ${where}
        GROUP BY i.id, u.nome, e.titulo, t.nome
        ORDER BY
          i.publicada_em DESC NULLS LAST,
          i.criado_em DESC,
          i.id DESC
      `,
      params
    );

    const data = (result.rows || []).map(decorarInteracao);

    return sucesso(res, {
      data,
      message: "Interações listadas com sucesso.",
      code: "INTERACAO_ADMIN_LISTADA",
      meta: {
        total: data.length,
        tipos: Object.values(TIPO).map((value) => ({
          value,
          label: TIPO_LABEL[value],
        })),
        status: Object.values(STATUS).map((value) => ({
          value,
          label: STATUS_LABEL[value],
        })),
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar interações", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar interações.",
      code: "INTERACAO_LISTAR_ERRO",
      details: { dbCode: err?.code },
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
    const interacao = await carregarInteracaoCompleta({ query }, id);

    if (!interacao) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: interacao,
      message: "Interação carregada com sucesso.",
      code: "INTERACAO_ADMIN_OBTIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter interação.",
      code: "INTERACAO_OBTER_ERRO",
      requestId,
    });
  }
}

async function criarAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);

  if (!permissao.ok) return permissao.response;

  const validacao = validarPayloadInteracao(req.body || {});

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

  try {
    const interacao = await withTransaction(async (client) => {
      const result = await client.query(
        `
          INSERT INTO ${TABELA_INTERACAO} (
            titulo,
            descricao,
            tipo,
            status,
            contexto,
            evento_id,
            turma_id,
            qr_token,
            qr_token_expira_em,
            exige_inscricao_ou_presenca,
            exige_geolocalizacao,
            latitude,
            longitude,
            raio_metros,
            permite_anonima,
            uma_resposta_por_usuario,
            mostrar_resultado_usuario,
            mostrar_resultado_admin,
            exibir_ranking,
            tempo_por_pergunta_segundos,
            mostrar_gabarito,
            embaralhar_opcoes,
            tentativas_max,
            nota_minima,
            atualizar_automaticamente,
            intervalo_atualizacao_segundos,
            limite_palavra_caracteres,
            criado_por,
            publicada_em,
            encerrada_em,
            arquivada_em
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13, $14,
            $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24,
            $25, $26, $27, $28,
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
          payload.qr_token,
          payload.qr_token_expira_em,
          payload.exige_inscricao_ou_presenca,
          payload.exige_geolocalizacao,
          payload.latitude,
          payload.longitude,
          payload.raio_metros,
          payload.permite_anonima,
          payload.uma_resposta_por_usuario,
          payload.mostrar_resultado_usuario,
          payload.mostrar_resultado_admin,
          payload.exibir_ranking,
          payload.tempo_por_pergunta_segundos,
          payload.mostrar_gabarito,
          payload.embaralhar_opcoes,
          payload.tentativas_max,
          payload.nota_minima,
          payload.atualizar_automaticamente,
          payload.intervalo_atualizacao_segundos,
          payload.limite_palavra_caracteres,
          permissao.usuarioId,
        ]
      );

      const interacaoId = result.rows[0].id;

      await inserirJanelas(client, interacaoId, payload.janelas);
      await inserirPerguntasOpcoes(client, interacaoId, payload.perguntas);

      return carregarInteracaoCompleta(client, interacaoId);
    });

    return sucesso(res, {
      status: 201,
      data: interacao,
      message: "Interação criada com sucesso.",
      code: "INTERACAO_CRIADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao criar interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao criar interação.",
      code: "INTERACAO_CRIAR_ERRO",
      adminHint:
        "Verifique constraints de interacoes, perguntas, opções, janelas e vínculos.",
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

  const validacao = validarPayloadInteracao(req.body || {});

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

  try {
    const interacao = await withTransaction(async (client) => {
      const existe = await client.query(
        `
          SELECT id
          FROM ${TABELA_INTERACAO}
          WHERE id = $1
          LIMIT 1
        `,
        [id]
      );

      if (!existe.rows?.[0]) return null;

      await client.query(
        `
          UPDATE ${TABELA_INTERACAO}
             SET titulo = $1,
                 descricao = $2,
                 tipo = $3,
                 status = $4,
                 contexto = $5,
                 evento_id = $6,
                 turma_id = $7,
                 qr_token = $8,
                 qr_token_expira_em = $9,
                 exige_inscricao_ou_presenca = $10,
                 exige_geolocalizacao = $11,
                 latitude = $12,
                 longitude = $13,
                 raio_metros = $14,
                 permite_anonima = $15,
                 uma_resposta_por_usuario = $16,
                 mostrar_resultado_usuario = $17,
                 mostrar_resultado_admin = $18,
                 exibir_ranking = $19,
                 tempo_por_pergunta_segundos = $20,
                 mostrar_gabarito = $21,
                 embaralhar_opcoes = $22,
                 tentativas_max = $23,
                 nota_minima = $24,
                 atualizar_automaticamente = $25,
                 intervalo_atualizacao_segundos = $26,
                 limite_palavra_caracteres = $27,
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
           WHERE id = $28
        `,
        [
          payload.titulo,
          payload.descricao,
          payload.tipo,
          payload.status,
          payload.contexto,
          payload.evento_id,
          payload.turma_id,
          payload.qr_token,
          payload.qr_token_expira_em,
          payload.exige_inscricao_ou_presenca,
          payload.exige_geolocalizacao,
          payload.latitude,
          payload.longitude,
          payload.raio_metros,
          payload.permite_anonima,
          payload.uma_resposta_por_usuario,
          payload.mostrar_resultado_usuario,
          payload.mostrar_resultado_admin,
          payload.exibir_ranking,
          payload.tempo_por_pergunta_segundos,
          payload.mostrar_gabarito,
          payload.embaralhar_opcoes,
          payload.tentativas_max,
          payload.nota_minima,
          payload.atualizar_automaticamente,
          payload.intervalo_atualizacao_segundos,
          payload.limite_palavra_caracteres,
          id,
        ]
      );

      await client.query(`DELETE FROM ${TABELA_JANELA} WHERE interacao_id = $1`, [
        id,
      ]);

      await client.query(
        `DELETE FROM ${TABELA_PERGUNTA} WHERE interacao_id = $1`,
        [id]
      );

      await inserirJanelas(client, id, payload.janelas);
      await inserirPerguntasOpcoes(client, id, payload.perguntas);

      await client.query(
        `
          UPDATE ${TABELA_INTERACAO}
             SET pergunta_atual_id = NULL
           WHERE id = $1
        `,
        [id]
      );

      return carregarInteracaoCompleta(client, id);
    });

    if (!interacao) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: interacao,
      message: "Interação atualizada com sucesso.",
      code: "INTERACAO_ATUALIZADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao atualizar interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao atualizar interação.",
      code: "INTERACAO_ATUALIZAR_ERRO",
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
      requestId,
    });
  }

  try {
    const interacao = await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE ${TABELA_INTERACAO}
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

      return carregarInteracaoCompleta(client, id);
    });

    if (!interacao) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: interacao,
      message: "Status da interação atualizado com sucesso.",
      code: "INTERACAO_STATUS_ATUALIZADO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao alterar status da interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao alterar status da interação.",
      code: "INTERACAO_STATUS_ERRO",
      details: {
        dbCode: err?.code,
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
        DELETE FROM ${TABELA_INTERACAO}
        WHERE id = $1
        RETURNING id, titulo
      `,
      [id]
    );

    const removida = result.rows?.[0];

    if (!removida) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data: removida,
      message: "Interação excluída com sucesso.",
      code: "INTERACAO_EXCLUIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao excluir interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao excluir interação.",
      code: "INTERACAO_EXCLUIR_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

/* =========================================================================
   Admin — execução ao vivo
=========================================================================== */

async function iniciarExecucaoAdmin(req, res) {
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
    const execucao = await withTransaction(async (client) => {
      const interacao = await carregarInteracaoCompleta(client, id);

      if (!interacao) return null;

      const result = await client.query(
        `
          INSERT INTO ${TABELA_EXECUCAO} (
            interacao_id,
            status,
            iniciada_em,
            criado_por
          )
          VALUES ($1, 'em_andamento', now(), $2)
          RETURNING *
        `,
        [id, permissao.usuarioId]
      );

      await client.query(
        `
          UPDATE ${TABELA_INTERACAO}
             SET status = 'em_andamento'
           WHERE id = $1
        `,
        [id]
      );

      return result.rows[0];
    });

    if (!execucao) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      status: 201,
      data: execucao,
      message: "Execução iniciada com sucesso.",
      code: "INTERACAO_EXECUCAO_INICIADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao iniciar execução", err);

    return falha(res, {
      status: 500,
      message: "Erro ao iniciar execução.",
      code: "INTERACAO_EXECUCAO_INICIAR_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function abrirPerguntaAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);
  const perguntaId = Number(req.body?.pergunta_id);

  if (!permissao.ok) return permissao.response;

  if (!id || !Number.isInteger(perguntaId) || perguntaId <= 0) {
    return falha(res, {
      status: 400,
      message: "ID de interação ou pergunta inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const data = await withTransaction(async (client) => {
      const interacao = await carregarInteracaoCompleta(client, id);

      if (!interacao) return null;

      const pertence = interacao.perguntas.some(
        (pergunta) => Number(pergunta.id) === perguntaId
      );

      if (!pertence) {
        const error = new Error("Pergunta não pertence à interação.");
        error.status = 400;
        error.code = "PERGUNTA_NAO_PERTENCE";
        throw error;
      }

      await client.query(
        `
          UPDATE ${TABELA_PERGUNTA}
             SET status = 'fechada',
                 fechada_em = COALESCE(fechada_em, now())
           WHERE interacao_id = $1
             AND status = 'aberta'
        `,
        [id]
      );

      await client.query(
        `
          UPDATE ${TABELA_PERGUNTA}
             SET status = 'aberta',
                 aberta_em = now(),
                 fechada_em = NULL,
                 gabarito_exibido_em = NULL
           WHERE id = $1
        `,
        [perguntaId]
      );

      await client.query(
        `
          UPDATE ${TABELA_INTERACAO}
             SET status = 'em_andamento',
                 pergunta_atual_id = $1
           WHERE id = $2
        `,
        [perguntaId, id]
      );

      return carregarInteracaoCompleta(client, id);
    });

    if (!data) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data,
      message: "Pergunta aberta com sucesso.",
      code: "INTERACAO_PERGUNTA_ABERTA",
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

    logErro(requestId, "Erro ao abrir pergunta", err);

    return falha(res, {
      status: 500,
      message: "Erro ao abrir pergunta.",
      code: "INTERACAO_PERGUNTA_ABRIR_ERRO",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function fecharPerguntaAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);
  const perguntaId = Number(req.body?.pergunta_id);

  if (!permissao.ok) return permissao.response;

  if (!id || !Number.isInteger(perguntaId) || perguntaId <= 0) {
    return falha(res, {
      status: 400,
      message: "ID de interação ou pergunta inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const data = await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE ${TABELA_PERGUNTA}
             SET status = 'fechada',
                 fechada_em = now()
           WHERE id = $1
             AND interacao_id = $2
        `,
        [perguntaId, id]
      );

      return carregarInteracaoCompleta(client, id);
    });

    if (!data) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data,
      message: "Pergunta fechada com sucesso.",
      code: "INTERACAO_PERGUNTA_FECHADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao fechar pergunta", err);

    return falha(res, {
      status: 500,
      message: "Erro ao fechar pergunta.",
      code: "INTERACAO_PERGUNTA_FECHAR_ERRO",
      requestId,
    });
  }
}

async function exibirGabaritoAdmin(req, res) {
  const requestId = gerarRequestId();
  const permissao = validarPermissaoAdmin(req, res, requestId);
  const id = validarIdParam(req);
  const perguntaId = Number(req.body?.pergunta_id);

  if (!permissao.ok) return permissao.response;

  if (!id || !Number.isInteger(perguntaId) || perguntaId <= 0) {
    return falha(res, {
      status: 400,
      message: "ID de interação ou pergunta inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  try {
    const data = await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE ${TABELA_PERGUNTA}
             SET status = 'gabarito_exibido',
                 gabarito_exibido_em = now()
           WHERE id = $1
             AND interacao_id = $2
        `,
        [perguntaId, id]
      );

      return carregarInteracaoCompleta(client, id);
    });

    if (!data) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    return sucesso(res, {
      data,
      message: "Gabarito exibido com sucesso.",
      code: "INTERACAO_GABARITO_EXIBIDO",
    });
  } catch (err) {
    logErro(requestId, "Erro ao exibir gabarito", err);

    return falha(res, {
      status: 500,
      message: "Erro ao exibir gabarito.",
      code: "INTERACAO_GABARITO_ERRO",
      requestId,
    });
  }
}

/* =========================================================================
   Admin — resultados
=========================================================================== */

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
    const interacao = await carregarInteracaoCompleta({ query }, id);

    if (!interacao) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada.",
        code: "INTERACAO_NAO_ENCONTRADA",
        requestId,
      });
    }

    if (interacao.tipo === TIPO.votacao) {
      const result = await query(
        `
          SELECT
            o.id AS opcao_id,
            o.texto,
            COUNT(r.id)::int AS total
          FROM ${TABELA_OPCAO} o
          JOIN ${TABELA_PERGUNTA} p ON p.id = o.pergunta_id
          LEFT JOIN ${TABELA_RESPOSTA} r ON r.opcao_id = o.id
          WHERE p.interacao_id = $1
          GROUP BY o.id, o.texto, o.ordem
          ORDER BY total DESC, o.ordem ASC, o.id ASC
        `,
        [id]
      );

      return sucesso(res, {
        data: {
          interacao,
          ranking: result.rows || [],
        },
        message: "Resultado da votação carregado com sucesso.",
        code: "INTERACAO_RESULTADO_VOTACAO",
      });
    }

    if (interacao.tipo === TIPO.quiz) {
      const result = await query(
        `
          SELECT
            u.id AS usuario_id,
            split_part(u.nome, ' ', 1) ||
              CASE
                WHEN array_length(regexp_split_to_array(trim(u.nome), '\\s+'), 1) >= 2
                THEN ' ' || split_part(u.nome, ' ', 2)
                ELSE ''
              END AS nome_exibicao,
            COUNT(r.id)::int AS respostas,
            COUNT(r.id) FILTER (WHERE r.correta = true)::int AS acertos,
            COALESCE(SUM(r.pontuacao), 0)::numeric AS pontuacao,
            COALESCE(SUM(r.tempo_resposta_ms), 0)::int AS tempo_total_ms
          FROM ${TABELA_RESPOSTA} r
          JOIN usuarios u ON u.id = r.usuario_id
          WHERE r.interacao_id = $1
          GROUP BY u.id, u.nome
          ORDER BY acertos DESC, pontuacao DESC, tempo_total_ms ASC, nome_exibicao ASC
        `,
        [id]
      );

      return sucesso(res, {
        data: {
          interacao,
          ranking: result.rows || [],
        },
        message: "Ranking do quiz carregado com sucesso.",
        code: "INTERACAO_RESULTADO_QUIZ",
      });
    }

    const result = await query(
      `
        SELECT
          resposta_normalizada AS palavra,
          COUNT(*)::int AS total
        FROM ${TABELA_RESPOSTA}
        WHERE interacao_id = $1
          AND resposta_normalizada IS NOT NULL
        GROUP BY resposta_normalizada
        ORDER BY total DESC, palavra ASC
      `,
      [id]
    );

    return sucesso(res, {
      data: {
        interacao,
        palavras: result.rows || [],
      },
      message: "Nuvem de palavras carregada com sucesso.",
      code: "INTERACAO_RESULTADO_NUVEM",
    });
  } catch (err) {
    logErro(requestId, "Erro ao carregar resultado", err);

    return falha(res, {
      status: 500,
      message: "Erro ao carregar resultado da interação.",
      code: "INTERACAO_RESULTADO_ERRO",
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
    const result = await query(
      `
        SELECT
          i.*,
          EXISTS (
            SELECT 1
            FROM ${TABELA_RESPOSTA} r
            WHERE r.interacao_id = i.id
              AND r.usuario_id = $1
          ) AS respondida,
          COUNT(DISTINCT r_total.id)::int AS total_respostas
        FROM ${TABELA_INTERACAO} i
        LEFT JOIN ${TABELA_RESPOSTA} r_total ON r_total.interacao_id = i.id
        WHERE i.status IN ('publicada', 'em_andamento')
        GROUP BY i.id
        ORDER BY
          i.publicada_em DESC NULLS LAST,
          i.criado_em DESC,
          i.id DESC
      `,
      [usuarioId]
    );

    return sucesso(res, {
      data: (result.rows || []).map(decorarInteracao),
      message: "Interações publicadas listadas com sucesso.",
      code: "INTERACAO_PUBLICADA_LISTADA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar interações publicadas", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar interações.",
      code: "INTERACAO_PUBLICADA_LISTAR_ERRO",
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
    const interacao = await carregarInteracaoCompleta({ query }, id);

    if (!interacao || !["publicada", "em_andamento"].includes(interacao.status)) {
      return falha(res, {
        status: 404,
        message: "Interação não encontrada ou indisponível.",
        code: "INTERACAO_INDISPONIVEL",
        requestId,
      });
    }

    const respondida = await usuarioJaRespondeuInteracao({ query }, id, usuarioId);

    return sucesso(res, {
      data: {
        ...interacao,
        respondida,
      },
      message: "Interação carregada com sucesso.",
      code: "INTERACAO_PUBLICADA_OBTIDA",
    });
  } catch (err) {
    logErro(requestId, "Erro ao obter interação publicada", err);

    return falha(res, {
      status: 500,
      message: "Erro ao obter interação.",
      code: "INTERACAO_PUBLICADA_OBTER_ERRO",
      requestId,
    });
  }
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
      const interacao = await carregarInteracaoCompleta(client, id);

      if (!interacao || !["publicada", "em_andamento"].includes(interacao.status)) {
        const error = new Error("Interação não encontrada ou indisponível.");
        error.status = 404;
        error.code = "INTERACAO_INDISPONIVEL";
        throw error;
      }

      const autorizado = await verificarInscricaoOuPresenca(
        client,
        interacao,
        usuarioId
      );

      if (!autorizado) {
        const error = new Error(
          "Você precisa estar inscrito ou presente no evento/turma para responder esta interação."
        );
        error.status = 403;
        error.code = "USUARIO_NAO_AUTORIZADO_CONTEXTO";
        throw error;
      }

      if (interacao.tipo === TIPO.votacao || interacao.tipo === TIPO.nuvem_palavras) {
        const janelaOk = await verificarJanelaDisponivel(client, id);

        if (!janelaOk) {
          const error = new Error(
            "Esta interação está fora da janela de data e horário permitida."
          );
          error.status = 403;
          error.code = "FORA_DA_JANELA_PERMITIDA";
          throw error;
        }

        if (interacao.uma_resposta_por_usuario) {
          const jaRespondeu = await usuarioJaRespondeuInteracao(
            client,
            id,
            usuarioId
          );

          if (jaRespondeu) {
            const error = new Error("Você já respondeu esta interação.");
            error.status = 409;
            error.code = "INTERACAO_JA_RESPONDIDA";
            throw error;
          }
        }
      }

      if (interacao.tipo === TIPO.quiz) {
        const pergunta = interacao.perguntas.find(
          (item) => Number(item.id) === Number(req.body?.pergunta_id)
        );

        if (!pergunta || pergunta.status !== STATUS_PERGUNTA.aberta) {
          const error = new Error("Esta pergunta não está aberta para resposta.");
          error.status = 403;
          error.code = "PERGUNTA_NAO_ABERTA";
          throw error;
        }
      }

      const geo = validarGeolocalizacaoInteracao(interacao, req.body || {});

      if (!geo.ok) {
        const error = new Error(geo.message);
        error.status = 403;
        error.code = geo.code;
        error.details = geo.details;
        throw error;
      }

      const respostaValidada = validarRespostaUsuario(interacao, req.body || {});

      if (!respostaValidada.ok) {
        const error = new Error(respostaValidada.message);
        error.status = 400;
        error.code = respostaValidada.code;
        throw error;
      }

      const anonima = Boolean(req.body?.anonima) && Boolean(interacao.permite_anonima);

      let correta = null;
      let pontuacao = null;

      if (interacao.tipo === TIPO.quiz && respostaValidada.opcao) {
        correta = Boolean(respostaValidada.opcao.correta);
        pontuacao = correta ? Number(respostaValidada.pergunta.peso || 1) : 0;
      }

      const result = await client.query(
        `
          INSERT INTO ${TABELA_RESPOSTA} (
            interacao_id,
            pergunta_id,
            opcao_id,
            usuario_id,
            resposta_texto,
            resposta_normalizada,
            anonima,
            correta,
            pontuacao,
            tempo_resposta_ms,
            latitude_usuario,
            longitude_usuario,
            distancia_metros,
            metadata
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13, $14
          )
          RETURNING *
        `,
        [
          id,
          respostaValidada.pergunta.id,
          respostaValidada.opcao_id,
          anonima ? null : usuarioId,
          respostaValidada.resposta_texto,
          respostaValidada.resposta_normalizada,
          anonima,
          correta,
          pontuacao,
          toIntOrNull(req.body?.tempo_resposta_ms),
          geo.latitude_usuario,
          geo.longitude_usuario,
          geo.distancia_metros,
          req.body?.metadata && typeof req.body.metadata === "object"
            ? req.body.metadata
            : null,
        ]
      );

      return result.rows[0];
    });

    return sucesso(res, {
      status: 201,
      data: resposta,
      message: "Resposta registrada com sucesso.",
      code: "INTERACAO_RESPOSTA_REGISTRADA",
    });
  } catch (err) {
    if (err?.status && err?.code) {
      return falha(res, {
        status: err.status,
        message: err.message,
        code: err.code,
        details: err.details || null,
        requestId,
      });
    }

    logErro(requestId, "Erro ao responder interação", err);

    return falha(res, {
      status: 500,
      message: "Erro ao registrar resposta.",
      code: "INTERACAO_RESPONDER_ERRO",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

module.exports = {
  listarAdmin,
  obterAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,

  iniciarExecucaoAdmin,
  abrirPerguntaAdmin,
  fecharPerguntaAdmin,
  exibirGabaritoAdmin,
  resultadoAdmin,

  listarPublicadas,
  obterPublicadaPorId,
  responderPublicada,
};