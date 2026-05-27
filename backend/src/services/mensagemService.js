"use strict";

/**
 * ✅ backend/src/services/mensagemService.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Service oficial da Caixa de Mensagens Institucional.
 *
 * Responsabilidades:
 * - Abrir conversa institucional.
 * - Registrar primeira mensagem do usuário.
 * - Listar conversas do próprio usuário.
 * - Listar conversas para administradores.
 * - Obter conversa com respostas.
 * - Responder conversa.
 * - Alterar status/prioridade/atribuição.
 * - Encerrar ou arquivar conversa respeitando integridade do banco.
 *
 * Contratos aplicados:
 * - Tabelas oficiais:
 *   - mensagem_conversas
 *   - mensagem_respostas
 * - Perfis oficiais:
 *   - usuario
 *   - organizador
 *   - administrador
 * - Categorias oficiais:
 *   - duvida
 *   - sugestao
 *   - problema
 *   - certificado
 *   - inscricao
 *   - presenca
 *   - reserva
 *   - curso
 *   - pesquisa
 *   - interacao
 *   - outro
 * - Status oficiais:
 *   - aberta
 *   - em_atendimento
 *   - respondida
 *   - encerrada
 *   - arquivada
 * - Prioridades oficiais:
 *   - baixa
 *   - normal
 *   - alta
 *   - urgente
 * - Sem aliases
 * - Sem legado
 */

const db = require("../db");
const auditoriaService = require("./auditoriaService");

/* ─────────────────────────────────────────────────────────────
 * Contratos oficiais
 * ───────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = new Set(["usuario", "organizador", "administrador"]);

const CATEGORIAS_OFICIAIS = new Set([
  "duvida",
  "sugestao",
  "problema",
  "certificado",
  "inscricao",
  "presenca",
  "reserva",
  "curso",
  "pesquisa",
  "interacao",
  "outro",
]);

const STATUS_OFICIAIS = new Set([
  "aberta",
  "em_atendimento",
  "respondida",
  "encerrada",
  "arquivada",
]);

const PRIORIDADES_OFICIAIS = new Set(["baixa", "normal", "alta", "urgente"]);

const STATUS_FINAIS = new Set(["encerrada", "arquivada"]);

/* ─────────────────────────────────────────────────────────────
 * Helpers internos
 * ───────────────────────────────────────────────────────────── */

function textoOuNull(valor) {
  if (valor === undefined || valor === null) return null;

  const texto = String(valor).trim();
  return texto.length > 0 ? texto : null;
}

function textoObrigatorio(valor, minimo, campo, codigo) {
  const texto = textoOuNull(valor);

  if (!texto || texto.length < minimo) {
    const error = new Error(`${campo} inválido.`);
    error.code = codigo;
    error.status = 400;
    throw error;
  }

  return texto;
}

function numeroIdObrigatorio(valor, campo, codigo) {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    const error = new Error(`${campo} inválido.`);
    error.code = codigo;
    error.status = 400;
    throw error;
  }

  return numero;
}

function numeroIdOpcional(valor) {
  if (valor === undefined || valor === null || valor === "") return null;

  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function perfilPrincipal(perfil) {
  if (Array.isArray(perfil)) {
    const perfilValido = perfil.find((item) =>
      PERFIS_OFICIAIS.has(String(item).trim())
    );

    return perfilValido || null;
  }

  const texto = textoOuNull(perfil);
  return texto && PERFIS_OFICIAIS.has(texto) ? texto : null;
}

function obterUsuarioId(req) {
  return numeroIdObrigatorio(
    req?.user?.id,
    "Usuário autenticado",
    "USUARIO_AUTENTICADO_INVALIDO"
  );
}

function obterPerfilUsuario(req) {
  const perfil = perfilPrincipal(req?.user?.perfil);

  if (!perfil) {
    const error = new Error("Perfil do usuário autenticado inválido.");
    error.code = "PERFIL_AUTENTICADO_INVALIDO";
    error.status = 403;
    throw error;
  }

  return perfil;
}

function usuarioEhAdministrador(req) {
  const perfil = req?.user?.perfil;

  if (Array.isArray(perfil)) {
    return perfil.includes("administrador");
  }

  return perfil === "administrador";
}

function exigirAdministrador(req) {
  if (!usuarioEhAdministrador(req)) {
    const error = new Error("Você não tem permissão para acessar este recurso.");
    error.code = "SEM_PERMISSAO_MENSAGEM_ADMIN";
    error.status = 403;
    throw error;
  }
}

function normalizarCategoria(categoria) {
  const texto = textoOuNull(categoria) || "duvida";

  if (!CATEGORIAS_OFICIAIS.has(texto)) {
    const error = new Error("Categoria da mensagem inválida.");
    error.code = "MENSAGEM_CATEGORIA_INVALIDA";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarStatus(status) {
  const texto = textoOuNull(status);

  if (!texto || !STATUS_OFICIAIS.has(texto)) {
    const error = new Error("Status da conversa inválido.");
    error.code = "MENSAGEM_STATUS_INVALIDO";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarPrioridade(prioridade) {
  const texto = textoOuNull(prioridade) || "normal";

  if (!PRIORIDADES_OFICIAIS.has(texto)) {
    const error = new Error("Prioridade da conversa inválida.");
    error.code = "MENSAGEM_PRIORIDADE_INVALIDA";
    error.status = 400;
    throw error;
  }

  return texto;
}

function normalizarBoolean(valor, padrao = true) {
  if (typeof valor === "boolean") return valor;
  return padrao;
}

function montarWhereConversasAdmin(filtros = {}) {
  const where = [];
  const values = [];

  function add(sql, valor) {
    values.push(valor);
    where.push(sql.replace("?", `$${values.length}`));
  }

  if (textoOuNull(filtros.status)) {
    const status = normalizarStatus(filtros.status);
    add("c.status = ?", status);
  }

  if (textoOuNull(filtros.categoria)) {
    const categoria = normalizarCategoria(filtros.categoria);
    add("c.categoria = ?", categoria);
  }

  if (textoOuNull(filtros.prioridade)) {
    const prioridade = normalizarPrioridade(filtros.prioridade);
    add("c.prioridade = ?", prioridade);
  }

  if (filtros.usuario_id !== undefined && filtros.usuario_id !== null && filtros.usuario_id !== "") {
    add("c.usuario_id = ?", numeroIdObrigatorio(filtros.usuario_id, "Usuário", "MENSAGEM_USUARIO_ID_INVALIDO"));
  }

  if (filtros.atribuido_para !== undefined && filtros.atribuido_para !== null && filtros.atribuido_para !== "") {
    add("c.atribuido_para = ?", numeroIdObrigatorio(filtros.atribuido_para, "Responsável", "MENSAGEM_ATRIBUIDO_PARA_INVALIDO"));
  }

  if (textoOuNull(filtros.busca)) {
    add(
      "(unaccent(lower(c.assunto)) ILIKE unaccent(lower(?)) OR unaccent(lower(u.nome)) ILIKE unaccent(lower(?)) OR unaccent(lower(u.email)) ILIKE unaccent(lower(?)))",
      `%${textoOuNull(filtros.busca)}%`
    );

    const busca = `%${textoOuNull(filtros.busca)}%`;
    values[values.length - 1] = busca;
    values.push(busca);
    values.push(busca);

    const indiceInicial = values.length - 2;
    where[where.length - 1] =
      `(unaccent(lower(c.assunto)) ILIKE unaccent(lower($${indiceInicial})) OR unaccent(lower(u.nome)) ILIKE unaccent(lower($${indiceInicial + 1})) OR unaccent(lower(u.email)) ILIKE unaccent(lower($${indiceInicial + 2})))`;
  }

  if (textoOuNull(filtros.data_inicio)) {
    add("c.criado_em >= ?", textoOuNull(filtros.data_inicio));
  }

  if (textoOuNull(filtros.data_fim)) {
    add("c.criado_em <= ?", textoOuNull(filtros.data_fim));
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    values,
  };
}

function montarPaginacao({ pagina = 1, limite = 50 } = {}) {
  const limiteSeguro = Math.min(Math.max(Number(limite) || 50, 1), 200);
  const paginaSegura = Math.max(Number(pagina) || 1, 1);
  const offset = (paginaSegura - 1) * limiteSeguro;

  return {
    limite: limiteSeguro,
    pagina: paginaSegura,
    offset,
  };
}

async function buscarConversaPorId(client, conversa_id) {
  const conversaId = numeroIdObrigatorio(
    conversa_id,
    "Conversa",
    "MENSAGEM_CONVERSA_ID_INVALIDO"
  );

  const { rows } = await client.query(
    `
      SELECT
        c.id,
        c.usuario_id,
        c.assunto,
        c.categoria,
        c.status,
        c.prioridade,
        c.atribuido_para,
        c.ultima_resposta_por,
        c.criado_em,
        c.atualizado_em,
        c.ultima_resposta_em,
        c.respondida_em,
        c.encerrado_em,
        c.encerrado_por,
        c.motivo_encerramento
      FROM mensagem_conversas c
      WHERE c.id = $1
      LIMIT 1
    `,
    [conversaId]
  );

  return rows[0] || null;
}

function garantirAcessoConversa(req, conversa) {
  if (!conversa) {
    const error = new Error("Conversa não encontrada.");
    error.code = "MENSAGEM_CONVERSA_NAO_ENCONTRADA";
    error.status = 404;
    throw error;
  }

  if (usuarioEhAdministrador(req)) {
    return;
  }

  const usuarioId = obterUsuarioId(req);

  if (Number(conversa.usuario_id) !== Number(usuarioId)) {
    const error = new Error("Você não tem permissão para acessar esta conversa.");
    error.code = "SEM_PERMISSAO_CONVERSA";
    error.status = 403;
    throw error;
  }
}

function garantirConversaAtiva(conversa) {
  if (STATUS_FINAIS.has(conversa.status)) {
    const error = new Error(
      "Esta conversa já foi encerrada ou arquivada e não aceita novas respostas."
    );
    error.code = "MENSAGEM_CONVERSA_FINALIZADA";
    error.status = 409;
    throw error;
  }
}

async function registrarAuditoriaMensagem({
  req,
  acao,
  entidade_id,
  sucesso = true,
  severidade = "info",
  dados_anteriores = null,
  dados_novos = null,
  detalhes = null,
  mensagem = null,
  admin_hint = null,
}) {
  await auditoriaService.registrarAuditoria({
    req,
    acao,
    modulo: "mensagem",
    entidade: "mensagem_conversa",
    entidade_id,
    sucesso,
    severidade,
    dados_anteriores,
    dados_novos,
    detalhes,
    mensagem,
    admin_hint,
  });
}

/* ─────────────────────────────────────────────────────────────
 * Usuário: abrir e consultar próprias conversas
 * ───────────────────────────────────────────────────────────── */

async function abrirConversa(req, payload = {}) {
  const usuarioId = obterUsuarioId(req);
  const perfilAutorInicial = "usuario";

  const assunto = textoObrigatorio(
    payload.assunto,
    5,
    "Assunto",
    "MENSAGEM_ASSUNTO_INVALIDO"
  );

  const mensagem = textoObrigatorio(
    payload.mensagem,
    2,
    "Mensagem",
    "MENSAGEM_TEXTO_INVALIDO"
  );

  const categoria = normalizarCategoria(payload.categoria);
  const prioridade = normalizarPrioridade(payload.prioridade || "normal");

  const client = db;

  try {
    await client.query("BEGIN");

    const conversaResult = await client.query(
      `
        INSERT INTO mensagem_conversas (
          usuario_id,
          assunto,
          categoria,
          status,
          prioridade
        )
        VALUES ($1, $2, $3, 'aberta', $4)
        RETURNING
          id,
          usuario_id,
          assunto,
          categoria,
          status,
          prioridade,
          atribuido_para,
          ultima_resposta_por,
          criado_em,
          atualizado_em,
          ultima_resposta_em,
          respondida_em,
          encerrado_em,
          encerrado_por,
          motivo_encerramento
      `,
      [usuarioId, assunto, categoria, prioridade]
    );

    const conversa = conversaResult.rows[0];

    await client.query(
      `
        INSERT INTO mensagem_respostas (
          conversa_id,
          autor_id,
          perfil_autor,
          mensagem,
          visivel_usuario
        )
        VALUES ($1, $2, $3, $4, true)
      `,
      [conversa.id, usuarioId, perfilAutorInicial, mensagem]
    );

    await client.query("COMMIT");

    await registrarAuditoriaMensagem({
      req,
      acao: "criar",
      entidade_id: conversa.id,
      dados_novos: {
        conversa_id: conversa.id,
        usuario_id: usuarioId,
        categoria,
        status: "aberta",
        prioridade,
      },
      mensagem: "Conversa institucional criada pelo usuário.",
      admin_hint:
        "Nova mensagem institucional aberta e primeira resposta registrada.",
    });

    return {
      ok: true,
      data: conversa,
      message: "Mensagem enviada com sucesso. A equipe administrativa poderá responder por este canal.",
      code: "MENSAGEM_CONVERSA_CRIADA",
    };
  } catch (error) {
    await client.query("ROLLBACK");

    await registrarAuditoriaMensagem({
      req,
      acao: "criar",
      entidade_id: null,
      sucesso: false,
      severidade: "erro",
      detalhes: {
        errorMessage: error.message,
        errorCode: error.code,
      },
      mensagem: "Falha ao criar conversa institucional.",
      admin_hint:
        "Verifique payload, constraints de mensagem_conversas/mensagem_respostas e logs do servidor.",
    });

    throw error;
  }
}

async function listarMinhasConversas(req, filtros = {}) {
  const usuarioId = obterUsuarioId(req);

  const { pagina, limite, offset } = montarPaginacao(filtros);
  const values = [usuarioId];
  const where = ["c.usuario_id = $1"];

  if (textoOuNull(filtros.status)) {
    values.push(normalizarStatus(filtros.status));
    where.push(`c.status = $${values.length}`);
  }

  if (textoOuNull(filtros.categoria)) {
    values.push(normalizarCategoria(filtros.categoria));
    where.push(`c.categoria = $${values.length}`);
  }

  values.push(limite);
  const limiteParam = `$${values.length}`;

  values.push(offset);
  const offsetParam = `$${values.length}`;

  const whereSql = `WHERE ${where.join(" AND ")}`;

  const { rows } = await db.query(
    `
      SELECT
        c.id,
        c.usuario_id,
        c.assunto,
        c.categoria,
        c.status,
        c.prioridade,
        c.atribuido_para,
        c.ultima_resposta_por,
        c.criado_em,
        c.atualizado_em,
        c.ultima_resposta_em,
        c.respondida_em,
        c.encerrado_em,
        c.encerrado_por,
        c.motivo_encerramento,
        COUNT(r.id)::INTEGER AS total_respostas
      FROM mensagem_conversas c
      LEFT JOIN mensagem_respostas r
        ON r.conversa_id = c.id
       AND r.visivel_usuario = true
      ${whereSql}
      GROUP BY c.id
      ORDER BY c.atualizado_em DESC, c.id DESC
      LIMIT ${limiteParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM mensagem_conversas c
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    ok: true,
    data: rows,
    message: "Conversas carregadas com sucesso.",
    code: "MENSAGEM_MINHAS_CONVERSAS_LISTADAS",
    meta: {
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    },
  };
}

/* ─────────────────────────────────────────────────────────────
 * Consulta de conversa
 * ───────────────────────────────────────────────────────────── */

async function obterConversa(req, conversa_id) {
  const client = db;

  const conversa = await buscarConversaPorId(client, conversa_id);
  garantirAcessoConversa(req, conversa);

  const admin = usuarioEhAdministrador(req);

  const respostasResult = await client.query(
    `
      SELECT
        r.id,
        r.conversa_id,
        r.autor_id,
        r.perfil_autor,
        r.mensagem,
        r.visivel_usuario,
        r.criado_em,
        u.nome AS autor_nome,
        u.email AS autor_email
      FROM mensagem_respostas r
      JOIN usuarios u ON u.id = r.autor_id
      WHERE r.conversa_id = $1
        AND (
          $2::BOOLEAN = true
          OR r.visivel_usuario = true
        )
      ORDER BY r.criado_em ASC, r.id ASC
    `,
    [conversa.id, admin]
  );

  return {
    ok: true,
    data: {
      conversa,
      respostas: respostasResult.rows,
    },
    message: "Conversa carregada com sucesso.",
    code: "MENSAGEM_CONVERSA_CARREGADA",
  };
}

/* ─────────────────────────────────────────────────────────────
 * Responder conversa
 * ───────────────────────────────────────────────────────────── */

async function responderConversa(req, conversa_id, payload = {}) {
  const usuarioId = obterUsuarioId(req);
  const perfil = obterPerfilUsuario(req);

  const mensagem = textoObrigatorio(
    payload.mensagem,
    2,
    "Mensagem",
    "MENSAGEM_TEXTO_INVALIDO"
  );

  const visivelUsuario =
    perfil === "administrador"
      ? normalizarBoolean(payload.visivel_usuario, true)
      : true;

  const client = db;

  try {
    await client.query("BEGIN");

    const conversa = await buscarConversaPorId(client, conversa_id);
    garantirAcessoConversa(req, conversa);
    garantirConversaAtiva(conversa);

    const respostaResult = await client.query(
      `
        INSERT INTO mensagem_respostas (
          conversa_id,
          autor_id,
          perfil_autor,
          mensagem,
          visivel_usuario
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          conversa_id,
          autor_id,
          perfil_autor,
          mensagem,
          visivel_usuario,
          criado_em
      `,
      [conversa.id, usuarioId, perfil, mensagem, visivelUsuario]
    );

    const resposta = respostaResult.rows[0];

    await client.query("COMMIT");

    await registrarAuditoriaMensagem({
      req,
      acao: "responder",
      entidade_id: conversa.id,
      dados_anteriores: {
        status: conversa.status,
        ultima_resposta_por: conversa.ultima_resposta_por,
        ultima_resposta_em: conversa.ultima_resposta_em,
      },
      dados_novos: {
        resposta_id: resposta.id,
        autor_id: usuarioId,
        perfil_autor: perfil,
        visivel_usuario: visivelUsuario,
      },
      mensagem: "Resposta registrada em conversa institucional.",
      admin_hint:
        "A trigger do banco atualiza status, última resposta e primeira resposta administrativa quando aplicável.",
    });

    return {
      ok: true,
      data: resposta,
      message: "Resposta enviada com sucesso.",
      code: "MENSAGEM_RESPOSTA_CRIADA",
    };
  } catch (error) {
    await client.query("ROLLBACK");

    await registrarAuditoriaMensagem({
      req,
      acao: "responder",
      entidade_id: conversa_id,
      sucesso: false,
      severidade: "erro",
      detalhes: {
        errorMessage: error.message,
        errorCode: error.code,
      },
      mensagem: "Falha ao responder conversa institucional.",
      admin_hint:
        "Verifique se a conversa existe, se está ativa e se o usuário tem permissão.",
    });

    throw error;
  }
}

/* ─────────────────────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────────────────────── */

async function listarConversasAdmin(req, filtros = {}) {
  exigirAdministrador(req);

  const { pagina, limite, offset } = montarPaginacao(filtros);
  const { whereSql, values } = montarWhereConversasAdmin(filtros);

  values.push(limite);
  const limiteParam = `$${values.length}`;

  values.push(offset);
  const offsetParam = `$${values.length}`;

  const { rows } = await db.query(
    `
      SELECT
        c.id,
        c.usuario_id,
        u.nome AS usuario_nome,
        u.email AS usuario_email,
        c.assunto,
        c.categoria,
        c.status,
        c.prioridade,
        c.atribuido_para,
        responsavel.nome AS atribuido_para_nome,
        c.ultima_resposta_por,
        ultimo.nome AS ultima_resposta_por_nome,
        c.criado_em,
        c.atualizado_em,
        c.ultima_resposta_em,
        c.respondida_em,
        c.encerrado_em,
        c.encerrado_por,
        encerrador.nome AS encerrado_por_nome,
        c.motivo_encerramento,
        COUNT(r.id)::INTEGER AS total_respostas
      FROM mensagem_conversas c
      JOIN usuarios u ON u.id = c.usuario_id
      LEFT JOIN usuarios responsavel ON responsavel.id = c.atribuido_para
      LEFT JOIN usuarios ultimo ON ultimo.id = c.ultima_resposta_por
      LEFT JOIN usuarios encerrador ON encerrador.id = c.encerrado_por
      LEFT JOIN mensagem_respostas r ON r.conversa_id = c.id
      ${whereSql}
      GROUP BY
        c.id,
        u.nome,
        u.email,
        responsavel.nome,
        ultimo.nome,
        encerrador.nome
      ORDER BY
        CASE c.prioridade
          WHEN 'urgente' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'baixa' THEN 4
          ELSE 5
        END ASC,
        c.atualizado_em DESC,
        c.id DESC
      LIMIT ${limiteParam}
      OFFSET ${offsetParam}
    `,
    values
  );

  const countResult = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS total
      FROM mensagem_conversas c
      JOIN usuarios u ON u.id = c.usuario_id
      ${whereSql}
    `,
    values.slice(0, values.length - 2)
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    ok: true,
    data: rows,
    message: "Conversas administrativas carregadas com sucesso.",
    code: "MENSAGEM_ADMIN_CONVERSAS_LISTADAS",
    meta: {
      total,
      pagina,
      limite,
      total_paginas: Math.ceil(total / limite),
    },
  };
}

async function atualizarConversaAdmin(req, conversa_id, payload = {}) {
  exigirAdministrador(req);

  const adminId = obterUsuarioId(req);

  const conversaId = numeroIdObrigatorio(
    conversa_id,
    "Conversa",
    "MENSAGEM_CONVERSA_ID_INVALIDO"
  );

  const client = db;

  try {
    await client.query("BEGIN");

    const anterior = await buscarConversaPorId(client, conversaId);

    if (!anterior) {
      const error = new Error("Conversa não encontrada.");
      error.code = "MENSAGEM_CONVERSA_NAO_ENCONTRADA";
      error.status = 404;
      throw error;
    }

    const novoStatus = payload.status ? normalizarStatus(payload.status) : anterior.status;
    const novaPrioridade = payload.prioridade
      ? normalizarPrioridade(payload.prioridade)
      : anterior.prioridade;

    const atribuidoPara =
      payload.atribuido_para !== undefined
        ? numeroIdOpcional(payload.atribuido_para)
        : anterior.atribuido_para;

    const motivoEncerramento =
      payload.motivo_encerramento !== undefined
        ? textoOuNull(payload.motivo_encerramento)
        : anterior.motivo_encerramento;

    const vaiFinalizar = STATUS_FINAIS.has(novoStatus);
    const estavaFinalizada = STATUS_FINAIS.has(anterior.status);

    const encerradoEm = vaiFinalizar
      ? anterior.encerrado_em || new Date()
      : null;

    const encerradoPor = vaiFinalizar
      ? anterior.encerrado_por || adminId
      : null;

    if (!vaiFinalizar && estavaFinalizada) {
      const error = new Error(
        "Conversa encerrada ou arquivada não pode ser reaberta por esta ação."
      );
      error.code = "MENSAGEM_REABERTURA_NAO_PERMITIDA";
      error.status = 409;
      throw error;
    }

    const updateResult = await client.query(
      `
        UPDATE mensagem_conversas
        SET
          status = $1,
          prioridade = $2,
          atribuido_para = $3,
          encerrado_em = $4,
          encerrado_por = $5,
          motivo_encerramento = $6
        WHERE id = $7
        RETURNING
          id,
          usuario_id,
          assunto,
          categoria,
          status,
          prioridade,
          atribuido_para,
          ultima_resposta_por,
          criado_em,
          atualizado_em,
          ultima_resposta_em,
          respondida_em,
          encerrado_em,
          encerrado_por,
          motivo_encerramento
      `,
      [
        novoStatus,
        novaPrioridade,
        atribuidoPara,
        encerradoEm,
        encerradoPor,
        motivoEncerramento,
        conversaId,
      ]
    );

    const atualizada = updateResult.rows[0];

    await client.query("COMMIT");

    await registrarAuditoriaMensagem({
      req,
      acao: "atualizar",
      entidade_id: conversaId,
      dados_anteriores: anterior,
      dados_novos: atualizada,
      mensagem: "Conversa institucional atualizada por administrador.",
      admin_hint:
        "Atualização administrativa de status, prioridade, atribuição ou encerramento.",
    });

    return {
      ok: true,
      data: atualizada,
      message: "Conversa atualizada com sucesso.",
      code: "MENSAGEM_CONVERSA_ATUALIZADA",
    };
  } catch (error) {
    await client.query("ROLLBACK");

    await registrarAuditoriaMensagem({
      req,
      acao: "atualizar",
      entidade_id: conversaId,
      sucesso: false,
      severidade: "erro",
      detalhes: {
        errorMessage: error.message,
        errorCode: error.code,
      },
      mensagem: "Falha ao atualizar conversa institucional.",
      admin_hint:
        "Verifique status final, constraint de encerramento e permissões administrativas.",
    });

    throw error;
  }
}

async function resumoMensagensAdmin(req) {
  exigirAdministrador(req);

  const { rows } = await db.query(
    `
      SELECT
        COUNT(*)::INTEGER AS total_conversas,
        COUNT(*) FILTER (WHERE status = 'aberta')::INTEGER AS abertas,
        COUNT(*) FILTER (WHERE status = 'em_atendimento')::INTEGER AS em_atendimento,
        COUNT(*) FILTER (WHERE status = 'respondida')::INTEGER AS respondidas,
        COUNT(*) FILTER (WHERE status = 'encerrada')::INTEGER AS encerradas,
        COUNT(*) FILTER (WHERE status = 'arquivada')::INTEGER AS arquivadas,
        COUNT(*) FILTER (WHERE prioridade = 'urgente')::INTEGER AS urgentes,
        COUNT(*) FILTER (
          WHERE status IN ('aberta', 'em_atendimento')
            AND criado_em <= now() - interval '3 days'
        )::INTEGER AS abertas_ha_mais_de_3_dias,
        COUNT(*) FILTER (
          WHERE status = 'respondida'
            AND atualizado_em <= now() - interval '7 days'
        )::INTEGER AS respondidas_sem_encerramento_ha_mais_de_7_dias,
        MIN(criado_em) AS primeira_conversa,
        MAX(criado_em) AS ultima_conversa
      FROM mensagem_conversas
    `
  );

  const porCategoria = await db.query(
    `
      SELECT
        categoria,
        COUNT(*)::INTEGER AS total
      FROM mensagem_conversas
      GROUP BY categoria
      ORDER BY total DESC, categoria ASC
    `
  );

  const porPrioridade = await db.query(
    `
      SELECT
        prioridade,
        COUNT(*)::INTEGER AS total
      FROM mensagem_conversas
      GROUP BY prioridade
      ORDER BY
        CASE prioridade
          WHEN 'urgente' THEN 1
          WHEN 'alta' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'baixa' THEN 4
          ELSE 5
        END ASC
    `
  );

  return {
    ok: true,
    data: {
      geral: rows[0],
      por_categoria: porCategoria.rows,
      por_prioridade: porPrioridade.rows,
    },
    message: "Resumo da caixa de mensagens carregado com sucesso.",
    code: "MENSAGEM_ADMIN_RESUMO",
  };
}

module.exports = {
  abrirConversa,
  listarMinhasConversas,
  obterConversa,
  responderConversa,
  listarConversasAdmin,
  atualizarConversaAdmin,
  resumoMensagensAdmin,
};