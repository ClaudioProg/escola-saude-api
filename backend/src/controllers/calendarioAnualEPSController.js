"use strict";

/**
 * ✅ backend/src/controllers/calendarioAnualEPS.js — v2.0
 * Atualizado em: 18/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Módulo:
 * - Calendário Anual de EPS.
 *
 * Função:
 * - Cadastrar, listar, atualizar e excluir programações anuais de EPS.
 * - Vincular cada programação a um departamento oficial.
 * - Exibir agenda com cor institucional por departamento.
 * - Gerar contagem mensal e anual por departamento.
 *
 * Importante:
 * - Este módulo NÃO é o módulo de cursos online.
 * - Este módulo NÃO usa campo livre para departamento.
 * - O departamento deve vir obrigatoriamente da lista oficial.
 *
 * Contrato oficial de banco:
 * - solicitacoes_curso
 * - solicitacao_curso_datas
 * - solicitacao_curso_palestrantes
 *
 * Coluna obrigatória:
 * - solicitacoes_curso.departamento
 *
 * Departamentos oficiais:
 * - GAB-SMS
 * - DESMEN
 * - DEAPS
 * - DEMAC
 * - DEVIG
 * - DEREG
 * - DEAFIN-SMS
 *
 * Diretrizes v2.0:
 * - sem descoberta dinâmica de tabela;
 * - sem plural/singular fallback;
 * - sem req.usuario;
 * - sem perfil "admin" como alias;
 * - sem resposta { erro };
 * - sem status livre;
 * - sem departamento livre;
 * - anti-fuso com date-only YYYY-MM-DD e horário HH:mm;
 * - respostas padronizadas ok/data/message/code/meta;
 * - erros com requestId/adminHint/details;
 * - transações explícitas em criação, atualização e exclusão;
 * - contagens por data real da programação em solicitacao_curso_datas.data.
 */

const db = require("../db");

const TABELA_PROGRAMACAO = "solicitacoes_curso";
const TABELA_DATAS = "solicitacao_curso_datas";
const TABELA_PALESTRANTES = "solicitacao_curso_palestrantes";

const PERFIL_ADMINISTRADOR = "administrador";

const STATUS_OFICIAL = new Set([
  "planejado",
  "solicitado",
  "em_analise",
  "aprovado",
  "rejeitado",
  "cancelado",
  "convertido_em_evento",
]);

const STATUS_PADRAO = "planejado";

const DEPARTAMENTOS_EPS = Object.freeze([
  {
    value: "GAB-SMS",
    label: "GAB-SMS",
    cor: "#7c3aed",
  },
  {
    value: "DESMEN",
    label: "DESMEN",
    cor: "#2563eb",
  },
  {
    value: "DEAPS",
    label: "DEAPS",
    cor: "#16a34a",
  },
  {
    value: "DEMAC",
    label: "DEMAC",
    cor: "#ea580c",
  },
  {
    value: "DEVIG",
    label: "DEVIG",
    cor: "#dc2626",
  },
  {
    value: "DEREG",
    label: "DEREG",
    cor: "#0891b2",
  },
  {
    value: "DEAFIN-SMS",
    label: "DEAFIN-SMS",
    cor: "#9333ea",
  },
]);

const DEPARTAMENTOS_OFICIAIS = new Set(
  DEPARTAMENTOS_EPS.map((departamento) => departamento.value)
);

const DEPARTAMENTO_META = new Map(
  DEPARTAMENTOS_EPS.map((departamento) => [departamento.value, departamento])
);

function gerarRequestId() {
  return `cal-eps-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getPool() {
  if (db?.pool?.connect && typeof db.pool.connect === "function") {
    return db.pool;
  }

  if (db?.connect && typeof db.connect === "function") {
    return db;
  }

  return null;
}

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
const pool = getPool();

if (typeof query !== "function") {
  throw new Error(
    "DB inválido em calendarioAnualEPS.js: export oficial precisa expor query."
  );
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
  console.error(`[calendarioAnualEPS][${requestId}] ${contexto}`, {
    message: err?.message,
    code: err?.code,
    detail: err?.detail,
    constraint: err?.constraint,
    table: err?.table,
    column: err?.column,
  });
}

async function abrirClient() {
  if (!pool) {
    throw new Error(
      "DB inválido em calendarioAnualEPS.js: pool.connect ausente para transações."
    );
  }

  return pool.connect();
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

function cleanStr(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();
  return text ? text : null;
}

function toBool(value) {
  return value === true;
}

function toIntOrNull(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toCargaHoraria(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const n = Number(value);

  if (!Number.isInteger(n) || n < 0) {
    return Number.NaN;
  }

  return n;
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHHMM(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function normalizarStatus(value, fallback = STATUS_PADRAO) {
  const status = cleanStr(value);

  if (!status) return fallback;

  const normalized = String(status).toLowerCase();

  return STATUS_OFICIAL.has(normalized) ? normalized : null;
}

function normalizarDepartamento(value) {
  const departamento = cleanStr(value);

  if (!departamento) return null;

  return DEPARTAMENTOS_OFICIAIS.has(departamento) ? departamento : null;
}

function decorarDepartamento(value) {
  const departamento = DEPARTAMENTO_META.get(value);

  if (!departamento) {
    return {
      value,
      label: value,
      cor: null,
    };
  }

  return departamento;
}

function normalizarDatas(datas) {
  const arr = Array.isArray(datas) ? datas : [];
  const out = [];

  for (const item of arr) {
    const data = cleanStr(item?.data);
    const horario_inicio = cleanStr(item?.horario_inicio);
    const horario_fim = cleanStr(item?.horario_fim);

    if (!data || !isYMD(data)) continue;

    out.push({
      data,
      horario_inicio: horario_inicio && isHHMM(horario_inicio) ? horario_inicio : null,
      horario_fim: horario_fim && isHHMM(horario_fim) ? horario_fim : null,
    });
  }

  const vistos = new Set();
  const unicos = [];

  for (const item of out) {
    const chave = `${item.data}|${item.horario_inicio || ""}|${
      item.horario_fim || ""
    }`;

    if (vistos.has(chave)) continue;

    vistos.add(chave);
    unicos.push(item);
  }

  unicos.sort((a, b) => {
    const aa = `${a.data} ${a.horario_inicio || "00:00"}`;
    const bb = `${b.data} ${b.horario_inicio || "00:00"}`;
    return aa.localeCompare(bb);
  });

  return unicos;
}

function normalizarPalestrantes(palestrantes) {
  const arr = Array.isArray(palestrantes) ? palestrantes : [];
  const out = [];

  for (const item of arr) {
    if (!item) continue;

    if (typeof item === "string") {
      const nome = cleanStr(item);

      if (nome) {
        out.push({
          palestrante_id: null,
          nome_externo: nome,
        });
      }

      continue;
    }

    const palestrante_id = toIntOrNull(
      item.palestrante_id ?? item.usuario_id ?? item.id
    );
    const nome_externo = cleanStr(item.nome_externo ?? item.nome);

    if (!palestrante_id && !nome_externo) continue;

    out.push({
      palestrante_id: palestrante_id ?? null,
      nome_externo,
    });
  }

  const vistos = new Set();
  const unicos = [];

  for (const item of out) {
    const chave = item.palestrante_id
      ? `id:${item.palestrante_id}`
      : `nome:${String(item.nome_externo || "").toLowerCase()}`;

    if (vistos.has(chave)) continue;

    vistos.add(chave);
    unicos.push(item);
  }

  unicos.sort((a, b) =>
    String(a.nome_externo || "").localeCompare(String(b.nome_externo || ""), "pt-BR", {
      sensitivity: "base",
    })
  );

  return unicos;
}

function validarAno(value) {
  const ano = Number(value);

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
    return null;
  }

  return ano;
}

function validarMes(value) {
  const mes = Number(value);

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return null;
  }

  return mes;
}

function dataInicioMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

function dataInicioAno(ano) {
  return `${ano}-01-01`;
}

function montarResumoZerado() {
  return DEPARTAMENTOS_EPS.map((departamento) => ({
    departamento: departamento.value,
    departamento_label: departamento.label,
    departamento_cor: departamento.cor,
    total: 0,
  }));
}

function preencherResumo(rows) {
  const mapa = new Map();

  for (const row of rows || []) {
    mapa.set(row.departamento, Number(row.total || 0));
  }

  return DEPARTAMENTOS_EPS.map((departamento) => ({
    departamento: departamento.value,
    departamento_label: departamento.label,
    departamento_cor: departamento.cor,
    total: mapa.get(departamento.value) || 0,
  }));
}

function decorarProgramacao(row) {
  const departamento = decorarDepartamento(row.departamento);

  return {
    ...row,
    departamento_label: departamento.label,
    departamento_cor: departamento.cor,
  };
}

function validarPayloadCriacao(body) {
  const titulo = cleanStr(body.titulo);
  const descricao = cleanStr(body.descricao);
  const publico_alvo = cleanStr(body.publico_alvo);
  const local = cleanStr(body.local);
  const tipo = cleanStr(body.tipo);
  const unidade_id = toIntOrNull(body.unidade_id);
  const modalidade = cleanStr(body.modalidade);
  const departamento = normalizarDepartamento(body.departamento);
  const restrito = body.restrito !== undefined ? toBool(body.restrito) : false;
  const restricao_descricao = cleanStr(body.restricao_descricao);
  const carga_horaria_total = toCargaHoraria(body.carga_horaria_total);
  const gera_certificado =
    body.gera_certificado !== undefined ? toBool(body.gera_certificado) : false;
  const status = normalizarStatus(body.status, STATUS_PADRAO);
  const datas = normalizarDatas(body.datas);
  const palestrantes = normalizarPalestrantes(body.palestrantes);

  if (!titulo) {
    return {
      ok: false,
      message: "Informe o título da programação.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (!departamento) {
    return {
      ok: false,
      message: "Selecione o departamento responsável pela programação.",
      code: "DEPARTAMENTO_OBRIGATORIO",
      adminHint:
        "O campo departamento deve respeitar o contrato oficial: GAB-SMS, DESMEN, DEAPS, DEMAC, DEVIG, DEREG ou DEAFIN-SMS.",
    };
  }

  if (!status) {
    return {
      ok: false,
      message: "Status inválido para programação de EPS.",
      code: "STATUS_INVALIDO",
    };
  }

  if (unidade_id !== undefined && unidade_id !== null && unidade_id <= 0) {
    return {
      ok: false,
      message: "Unidade inválida.",
      code: "UNIDADE_INVALIDA",
    };
  }

  if (Number.isNaN(carga_horaria_total)) {
    return {
      ok: false,
      message: "Carga horária total inválida.",
      code: "CARGA_HORARIA_INVALIDA",
    };
  }

  if (restrito && !restricao_descricao) {
    return {
      ok: false,
      message: "Informe a descrição da restrição.",
      code: "RESTRICAO_DESCRICAO_OBRIGATORIA",
    };
  }

  if (datas.length === 0) {
    return {
      ok: false,
      message: "Informe ao menos uma data para a programação.",
      code: "DATA_OBRIGATORIA",
    };
  }

  return {
    ok: true,
    data: {
      titulo,
      descricao,
      publico_alvo,
      local,
      tipo,
      unidade_id,
      modalidade,
      departamento,
      restrito,
      restricao_descricao,
      carga_horaria_total,
      gera_certificado,
      status,
      datas,
      palestrantes,
    },
  };
}

function validarPayloadAtualizacao(body) {
  const patch = {};

  if (body.titulo !== undefined) patch.titulo = cleanStr(body.titulo);
  if (body.descricao !== undefined) patch.descricao = cleanStr(body.descricao);
  if (body.publico_alvo !== undefined) patch.publico_alvo = cleanStr(body.publico_alvo);
  if (body.local !== undefined) patch.local = cleanStr(body.local);
  if (body.tipo !== undefined) patch.tipo = cleanStr(body.tipo);
  if (body.unidade_id !== undefined) patch.unidade_id = toIntOrNull(body.unidade_id);
  if (body.modalidade !== undefined) patch.modalidade = cleanStr(body.modalidade);

  if (body.departamento !== undefined) {
    patch.departamento = normalizarDepartamento(body.departamento);
  }

  if (body.restrito !== undefined) patch.restrito = toBool(body.restrito);

  if (body.restricao_descricao !== undefined) {
    patch.restricao_descricao = cleanStr(body.restricao_descricao);
  }

  if (body.carga_horaria_total !== undefined) {
    patch.carga_horaria_total = toCargaHoraria(body.carga_horaria_total);
  }

  if (body.gera_certificado !== undefined) {
    patch.gera_certificado = toBool(body.gera_certificado);
  }

  if (body.status !== undefined) {
    patch.status = normalizarStatus(body.status, null);
  }

  const datas = body.datas !== undefined ? normalizarDatas(body.datas) : undefined;

  const palestrantes =
    body.palestrantes !== undefined
      ? normalizarPalestrantes(body.palestrantes)
      : undefined;

  if (patch.titulo !== undefined && !patch.titulo) {
    return {
      ok: false,
      message: "Informe o título da programação.",
      code: "TITULO_OBRIGATORIO",
    };
  }

  if (patch.departamento !== undefined && !patch.departamento) {
    return {
      ok: false,
      message: "Departamento inválido. Selecione um departamento oficial da lista.",
      code: "DEPARTAMENTO_INVALIDO",
      adminHint:
        "O campo departamento deve respeitar o contrato oficial: GAB-SMS, DESMEN, DEAPS, DEMAC, DEVIG, DEREG ou DEAFIN-SMS.",
    };
  }

  if (patch.status !== undefined && !patch.status) {
    return {
      ok: false,
      message: "Status inválido para programação de EPS.",
      code: "STATUS_INVALIDO",
    };
  }

  if (
    patch.unidade_id !== undefined &&
    patch.unidade_id !== null &&
    patch.unidade_id <= 0
  ) {
    return {
      ok: false,
      message: "Unidade inválida.",
      code: "UNIDADE_INVALIDA",
    };
  }

  if (
    patch.carga_horaria_total !== undefined &&
    Number.isNaN(patch.carga_horaria_total)
  ) {
    return {
      ok: false,
      message: "Carga horária total inválida.",
      code: "CARGA_HORARIA_INVALIDA",
    };
  }

  if (
    patch.restrito === true &&
    patch.restricao_descricao !== undefined &&
    !patch.restricao_descricao
  ) {
    return {
      ok: false,
      message: "Informe a descrição da restrição.",
      code: "RESTRICAO_DESCRICAO_OBRIGATORIA",
    };
  }

  if (datas !== undefined && datas.length === 0) {
    return {
      ok: false,
      message: "Informe ao menos uma data para a programação.",
      code: "DATA_OBRIGATORIA",
    };
  }

  return {
    ok: true,
    data: {
      patch,
      datas,
      palestrantes,
    },
  };
}

async function obterProgramacaoBasica(client, programacaoId) {
  const result = await client.query(
    `
      SELECT id, criador_id, restrito, restricao_descricao
        FROM ${TABELA_PROGRAMACAO}
       WHERE id = $1
    `,
    [programacaoId]
  );

  return result.rows?.[0] || null;
}

async function assertPodeEditar(client, { programacaoId, usuarioId, administrador }) {
  const programacao = await obterProgramacaoBasica(client, programacaoId);

  if (!programacao) {
    const err = new Error("Programação não encontrada.");
    err.httpStatus = 404;
    err.code = "PROGRAMACAO_EPS_NAO_ENCONTRADA";
    throw err;
  }

  if (!administrador && Number(programacao.criador_id) !== Number(usuarioId)) {
    const err = new Error("Sem permissão para alterar esta programação.");
    err.httpStatus = 403;
    err.code = "SEM_PERMISSAO";
    throw err;
  }

  return programacao;
}

async function substituirDatas(client, programacaoId, datas) {
  await client.query(`DELETE FROM ${TABELA_DATAS} WHERE solicitacao_id = $1`, [
    programacaoId,
  ]);

  for (const item of datas) {
    await client.query(
      `
        INSERT INTO ${TABELA_DATAS}
          (solicitacao_id, data, horario_inicio, horario_fim)
        VALUES
          ($1, $2::date, $3::time, $4::time)
      `,
      [programacaoId, item.data, item.horario_inicio, item.horario_fim]
    );
  }
}

async function substituirPalestrantes(client, programacaoId, palestrantes) {
  await client.query(`DELETE FROM ${TABELA_PALESTRANTES} WHERE solicitacao_id = $1`, [
    programacaoId,
  ]);

  for (const item of palestrantes) {
    await client.query(
      `
        INSERT INTO ${TABELA_PALESTRANTES}
          (solicitacao_id, palestrante_id, nome_externo)
        VALUES
          ($1, $2, $3)
      `,
      [programacaoId, item.palestrante_id, item.nome_externo]
    );
  }
}

async function listarProgramacao(req, res) {
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

  const administrador = isAdministrador(req);

  try {
    const params = [];
    const filtros = [];

    if (!administrador) {
      params.push(usuarioId);
      filtros.push(`s.criador_id = $${params.length}`);
    }

    const departamento = normalizarDepartamento(req.query?.departamento);

    if (req.query?.departamento !== undefined && !departamento) {
      return falha(res, {
        status: 400,
        message: "Departamento inválido. Selecione um departamento oficial da lista.",
        code: "DEPARTAMENTO_INVALIDO",
        adminHint:
          "Parâmetro departamento deve ser um dos valores oficiais: GAB-SMS, DESMEN, DEAPS, DEMAC, DEVIG, DEREG ou DEAFIN-SMS.",
        details: {
          departamento: req.query?.departamento,
        },
        requestId,
      });
    }

    if (departamento) {
      params.push(departamento);
      filtros.push(`s.departamento = $${params.length}`);
    }

    const status = req.query?.status
      ? normalizarStatus(req.query.status, null)
      : null;

    if (req.query?.status !== undefined && !status) {
      return falha(res, {
        status: 400,
        message: "Status inválido para programação de EPS.",
        code: "STATUS_INVALIDO",
        details: {
          status: req.query?.status,
        },
        requestId,
      });
    }

    if (status) {
      params.push(status);
      filtros.push(`s.status = $${params.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const result = await query(
      `
        WITH base AS (
          SELECT
            s.id,
            s.titulo,
            s.descricao,
            s.publico_alvo,
            s.local,
            s.tipo,
            s.unidade_id,
            u.nome AS unidade_nome,
            s.modalidade,
            s.departamento,
            s.restrito,
            s.restricao_descricao,
            s.carga_horaria_total,
            s.gera_certificado,
            s.status,
            s.criador_id,
            uc.nome AS criador_nome,
            s.criado_em,
            s.atualizado_em
          FROM ${TABELA_PROGRAMACAO} s
          LEFT JOIN unidades u ON u.id = s.unidade_id
          LEFT JOIN usuarios uc ON uc.id = s.criador_id
          ${where}
        ),
        datas AS (
          SELECT
            d.solicitacao_id,
            MIN(d.data) AS primeira_data,
            MAX(d.data) AS ultima_data,
            json_agg(
              jsonb_build_object(
                'id', d.id,
                'data', to_char(d.data::date, 'YYYY-MM-DD'),
                'horario_inicio',
                  CASE
                    WHEN d.horario_inicio IS NULL THEN NULL
                    ELSE to_char(d.horario_inicio::time, 'HH24:MI')
                  END,
                'horario_fim',
                  CASE
                    WHEN d.horario_fim IS NULL THEN NULL
                    ELSE to_char(d.horario_fim::time, 'HH24:MI')
                  END
              )
              ORDER BY d.data ASC, d.horario_inicio ASC NULLS LAST, d.id ASC
            ) AS datas
          FROM ${TABELA_DATAS} d
          GROUP BY d.solicitacao_id
        ),
        palestrantes AS (
          SELECT
            p.solicitacao_id,
            json_agg(
              jsonb_build_object(
                'id', p.id,
                'palestrante_id', p.palestrante_id,
                'nome_externo', p.nome_externo,
                'nome',
                  COALESCE(NULLIF(trim(p.nome_externo), ''), u.nome),
                'email', u.email
              )
              ORDER BY COALESCE(NULLIF(trim(p.nome_externo), ''), u.nome) ASC, p.id ASC
            ) AS palestrantes
          FROM ${TABELA_PALESTRANTES} p
          LEFT JOIN usuarios u ON u.id = p.palestrante_id
          GROUP BY p.solicitacao_id
        )
        SELECT
          b.*,
          to_char(d.primeira_data::date, 'YYYY-MM-DD') AS primeira_data,
          to_char(d.ultima_data::date, 'YYYY-MM-DD') AS ultima_data,
          COALESCE(d.datas, '[]'::json) AS datas,
          COALESCE(p.palestrantes, '[]'::json) AS palestrantes
        FROM base b
        LEFT JOIN datas d ON d.solicitacao_id = b.id
        LEFT JOIN palestrantes p ON p.solicitacao_id = b.id
        ORDER BY d.primeira_data ASC NULLS LAST, b.criado_em DESC NULLS LAST, b.id DESC
      `,
      params
    );

    const data = (result.rows || []).map((row) =>
      decorarProgramacao({
        ...row,
        pode_editar: administrador || Number(row.criador_id) === Number(usuarioId),
      })
    );

    return sucesso(res, {
      data,
      message: "Programações do Calendário Anual de EPS listadas com sucesso.",
      code: "CALENDARIO_EPS_LISTADO",
      meta: {
        total: data.length,
        administrador,
        departamentos: DEPARTAMENTOS_EPS,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar programações do Calendário Anual de EPS", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar programações do Calendário Anual de EPS.",
      code: "CALENDARIO_EPS_LISTAR_ERRO",
      adminHint:
        "Verifique tabelas solicitacoes_curso, solicitacao_curso_datas, solicitacao_curso_palestrantes, coluna departamento e joins com usuarios/unidades.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function listarDepartamentos(req, res) {
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

  return sucesso(res, {
    data: DEPARTAMENTOS_EPS,
    message: "Departamentos oficiais do Calendário Anual de EPS listados com sucesso.",
    code: "CALENDARIO_EPS_DEPARTAMENTOS_LISTADOS",
    meta: {
      total: DEPARTAMENTOS_EPS.length,
    },
  });
}

async function listarTipos(req, res) {
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
    const result = await query(
      `
        SELECT DISTINCT tipo
          FROM ${TABELA_PROGRAMACAO}
         WHERE tipo IS NOT NULL
           AND trim(tipo) <> ''
         ORDER BY tipo ASC
      `
    );

    return sucesso(res, {
      data: (result.rows || []).map((row) => row.tipo),
      message: "Tipos de programação de EPS listados com sucesso.",
      code: "CALENDARIO_EPS_TIPOS_LISTADOS",
    });
  } catch (err) {
    logErro(requestId, "Erro ao listar tipos de programação de EPS", err);

    return falha(res, {
      status: 500,
      message: "Erro ao listar tipos de programação de EPS.",
      code: "CALENDARIO_EPS_TIPOS_ERRO",
      adminHint: "Verifique coluna solicitacoes_curso.tipo.",
      details: {
        dbCode: err?.code,
      },
      requestId,
    });
  }
}

async function criarProgramacao(req, res) {
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

  const validacao = validarPayloadCriacao(req.body || {});

  if (!validacao.ok) {
    return falha(res, {
      status: 400,
      message: validacao.message,
      code: validacao.code,
      adminHint: validacao.adminHint || null,
      details: {
        departamento: req.body?.departamento,
      },
      requestId,
    });
  }

  let client;

  try {
    client = await abrirClient();
    await client.query("BEGIN");

    const payload = validacao.data;

    const insert = await client.query(
      `
        INSERT INTO ${TABELA_PROGRAMACAO} (
          titulo,
          descricao,
          publico_alvo,
          local,
          tipo,
          unidade_id,
          modalidade,
          departamento,
          restrito,
          restricao_descricao,
          carga_horaria_total,
          gera_certificado,
          status,
          criador_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13, $14
        )
        RETURNING id
      `,
      [
        payload.titulo,
        payload.descricao,
        payload.publico_alvo,
        payload.local,
        payload.tipo,
        payload.unidade_id,
        payload.modalidade,
        payload.departamento,
        payload.restrito,
        payload.restricao_descricao,
        payload.carga_horaria_total,
        payload.gera_certificado,
        payload.status,
        usuarioId,
      ]
    );

    const programacaoId = Number(insert.rows?.[0]?.id);

    if (!Number.isInteger(programacaoId) || programacaoId <= 0) {
      throw new Error("Falha ao criar programação de EPS.");
    }

    await substituirDatas(client, programacaoId, payload.datas);
    await substituirPalestrantes(client, programacaoId, payload.palestrantes);

    await client.query("COMMIT");

    return sucesso(res, {
      status: 201,
      data: {
        id: programacaoId,
        departamento: payload.departamento,
        ...decorarDepartamento(payload.departamento),
      },
      message: "Programação de EPS criada com sucesso.",
      code: "CALENDARIO_EPS_CRIADO",
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    logErro(requestId, "Erro ao criar programação de EPS", err);

    const isDepartamentoCheck =
      err?.constraint === "solicitacoes_curso_departamento_check";

    return falha(res, {
      status: isDepartamentoCheck ? 400 : 500,
      message: isDepartamentoCheck
        ? "Departamento inválido. Selecione um departamento oficial da lista."
        : "Erro ao criar programação de EPS.",
      code: isDepartamentoCheck
        ? "DEPARTAMENTO_INVALIDO"
        : "CALENDARIO_EPS_CRIAR_ERRO",
      adminHint: isDepartamentoCheck
        ? "A constraint solicitacoes_curso_departamento_check bloqueou valor fora do contrato oficial."
        : "Verifique constraints, FKs de unidade_id/criador_id, coluna departamento e tabelas filhas de datas/palestrantes.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

async function atualizarProgramacao(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);
  const programacaoId = Number(req.params.id);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      adminHint: "Middleware de autenticação não populou req.user.id.",
      requestId,
    });
  }

  if (!Number.isInteger(programacaoId) || programacaoId <= 0) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
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
      details: {
        departamento: req.body?.departamento,
      },
      requestId,
    });
  }

  let client;

  try {
    client = await abrirClient();
    await client.query("BEGIN");

    const administrador = isAdministrador(req);

    await assertPodeEditar(client, {
      programacaoId,
      usuarioId,
      administrador,
    });

    const { patch, datas, palestrantes } = validacao.data;

    const campos = [];
    const valores = [];

    function addCampo(nome, valor) {
      campos.push(`${nome} = $${valores.length + 1}`);
      valores.push(valor);
    }

    for (const [campo, valor] of Object.entries(patch)) {
      addCampo(campo, valor);
    }

    if (campos.length > 0) {
      campos.push("atualizado_em = now()");
      valores.push(programacaoId);

      await client.query(
        `
          UPDATE ${TABELA_PROGRAMACAO}
             SET ${campos.join(", ")}
           WHERE id = $${valores.length}
        `,
        valores
      );
    } else {
      await client.query(
        `
          UPDATE ${TABELA_PROGRAMACAO}
             SET atualizado_em = now()
           WHERE id = $1
        `,
        [programacaoId]
      );
    }

    if (datas !== undefined) {
      await substituirDatas(client, programacaoId, datas);
    }

    if (palestrantes !== undefined) {
      await substituirPalestrantes(client, programacaoId, palestrantes);
    }

    await client.query("COMMIT");

    return sucesso(res, {
      data: {
        id: programacaoId,
      },
      message: "Programação de EPS atualizada com sucesso.",
      code: "CALENDARIO_EPS_ATUALIZADO",
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    const httpStatus = err?.httpStatus || 500;
    const code = err?.code || "CALENDARIO_EPS_ATUALIZAR_ERRO";
    const isDepartamentoCheck =
      err?.constraint === "solicitacoes_curso_departamento_check";

    logErro(requestId, "Erro ao atualizar programação de EPS", err);

    return falha(res, {
      status: isDepartamentoCheck ? 400 : httpStatus,
      message: isDepartamentoCheck
        ? "Departamento inválido. Selecione um departamento oficial da lista."
        : code === "PROGRAMACAO_EPS_NAO_ENCONTRADA"
          ? "Programação não encontrada."
          : code === "SEM_PERMISSAO"
            ? "Sem permissão para editar esta programação."
            : "Erro ao atualizar programação de EPS.",
      code: isDepartamentoCheck ? "DEPARTAMENTO_INVALIDO" : code,
      adminHint: isDepartamentoCheck
        ? "A constraint solicitacoes_curso_departamento_check bloqueou valor fora do contrato oficial."
        : httpStatus === 500
          ? "Verifique constraints, FKs, coluna departamento e payload enviado para atualização."
          : null,
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

async function excluirProgramacao(req, res) {
  const requestId = gerarRequestId();
  const usuarioId = getUsuarioId(req);
  const programacaoId = Number(req.params.id);

  if (!usuarioId) {
    return falha(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      adminHint: "Middleware de autenticação não populou req.user.id.",
      requestId,
    });
  }

  if (!Number.isInteger(programacaoId) || programacaoId <= 0) {
    return falha(res, {
      status: 400,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      requestId,
    });
  }

  let client;

  try {
    client = await abrirClient();
    await client.query("BEGIN");

    const administrador = isAdministrador(req);

    await assertPodeEditar(client, {
      programacaoId,
      usuarioId,
      administrador,
    });

    await client.query(`DELETE FROM ${TABELA_PALESTRANTES} WHERE solicitacao_id = $1`, [
      programacaoId,
    ]);

    await client.query(`DELETE FROM ${TABELA_DATAS} WHERE solicitacao_id = $1`, [
      programacaoId,
    ]);

    await client.query(`DELETE FROM ${TABELA_PROGRAMACAO} WHERE id = $1`, [
      programacaoId,
    ]);

    await client.query("COMMIT");

    return sucesso(res, {
      data: {
        id: programacaoId,
      },
      message: "Programação de EPS excluída com sucesso.",
      code: "CALENDARIO_EPS_EXCLUIDO",
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    const httpStatus = err?.httpStatus || 500;
    const code = err?.code || "CALENDARIO_EPS_EXCLUIR_ERRO";

    logErro(requestId, "Erro ao excluir programação de EPS", err);

    return falha(res, {
      status: httpStatus,
      message:
        code === "PROGRAMACAO_EPS_NAO_ENCONTRADA"
          ? "Programação não encontrada."
          : code === "SEM_PERMISSAO"
            ? "Sem permissão para excluir esta programação."
            : "Erro ao excluir programação de EPS.",
      code,
      adminHint:
        httpStatus === 500
          ? "Verifique FKs dependentes. Se a programação já gerar evento institucional, considerar cancelamento lógico em vez de exclusão física."
          : null,
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  } finally {
    if (client) client.release?.();
  }
}

async function resumoMensal(req, res) {
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

  const ano = validarAno(req.query?.ano);
  const mes = validarMes(req.query?.mes);

  if (!ano || !mes) {
    return falha(res, {
      status: 400,
      message: "Informe ano e mês válidos para o resumo mensal.",
      code: "PARAMETROS_INVALIDOS",
      details: {
        ano: req.query?.ano,
        mes: req.query?.mes,
      },
      requestId,
    });
  }

  const administrador = isAdministrador(req);
  const inicio = dataInicioMes(ano, mes);

  try {
    const params = [inicio];
    let filtroUsuario = "";

    if (!administrador) {
      params.push(usuarioId);
      filtroUsuario = `AND sc.criador_id = $${params.length}`;
    }

    const result = await query(
      `
        SELECT
          sc.departamento,
          COUNT(DISTINCT sc.id)::int AS total
        FROM ${TABELA_PROGRAMACAO} sc
        JOIN ${TABELA_DATAS} scd
          ON scd.solicitacao_id = sc.id
        WHERE scd.data >= $1::date
          AND scd.data < ($1::date + INTERVAL '1 month')
          ${filtroUsuario}
        GROUP BY sc.departamento
        ORDER BY sc.departamento ASC
      `,
      params
    );

    const data = preencherResumo(result.rows);

    return sucesso(res, {
      data,
      message: "Resumo mensal do Calendário Anual de EPS gerado com sucesso.",
      code: "CALENDARIO_EPS_RESUMO_MENSAL",
      meta: {
        ano,
        mes,
        inicio,
        total: data.reduce((acc, item) => acc + Number(item.total || 0), 0),
        administrador,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao gerar resumo mensal do Calendário Anual de EPS", err);

    return falha(res, {
      status: 500,
      message: "Erro ao gerar resumo mensal do Calendário Anual de EPS.",
      code: "CALENDARIO_EPS_RESUMO_MENSAL_ERRO",
      adminHint:
        "Verifique índices, tabela solicitacao_curso_datas, coluna data e coluna solicitacoes_curso.departamento.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

async function resumoAnual(req, res) {
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

  const ano = validarAno(req.query?.ano);

  if (!ano) {
    return falha(res, {
      status: 400,
      message: "Informe um ano válido para o resumo anual.",
      code: "ANO_INVALIDO",
      details: {
        ano: req.query?.ano,
      },
      requestId,
    });
  }

  const administrador = isAdministrador(req);
  const inicio = dataInicioAno(ano);

  try {
    const params = [inicio];
    let filtroUsuario = "";

    if (!administrador) {
      params.push(usuarioId);
      filtroUsuario = `AND sc.criador_id = $${params.length}`;
    }

    const result = await query(
      `
        SELECT
          sc.departamento,
          COUNT(DISTINCT sc.id)::int AS total
        FROM ${TABELA_PROGRAMACAO} sc
        JOIN ${TABELA_DATAS} scd
          ON scd.solicitacao_id = sc.id
        WHERE scd.data >= $1::date
          AND scd.data < ($1::date + INTERVAL '1 year')
          ${filtroUsuario}
        GROUP BY sc.departamento
        ORDER BY sc.departamento ASC
      `,
      params
    );

    const data = preencherResumo(result.rows);

    return sucesso(res, {
      data,
      message: "Resumo anual do Calendário Anual de EPS gerado com sucesso.",
      code: "CALENDARIO_EPS_RESUMO_ANUAL",
      meta: {
        ano,
        inicio,
        total: data.reduce((acc, item) => acc + Number(item.total || 0), 0),
        administrador,
      },
    });
  } catch (err) {
    logErro(requestId, "Erro ao gerar resumo anual do Calendário Anual de EPS", err);

    return falha(res, {
      status: 500,
      message: "Erro ao gerar resumo anual do Calendário Anual de EPS.",
      code: "CALENDARIO_EPS_RESUMO_ANUAL_ERRO",
      adminHint:
        "Verifique índices, tabela solicitacao_curso_datas, coluna data e coluna solicitacoes_curso.departamento.",
      details: {
        dbCode: err?.code,
        constraint: err?.constraint,
      },
      requestId,
    });
  }
}

module.exports = {
  listarProgramacao,
  listarDepartamentos,
  listarTipos,
  criarProgramacao,
  atualizarProgramacao,
  excluirProgramacao,
  resumoMensal,
  resumoAnual,
};