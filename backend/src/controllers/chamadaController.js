/* eslint-disable no-console */
"use strict";

/**
 * 📁 src/controllers/chamadaController.js
 * Atualizado em: 15/05/2026
 *
 * Plataforma Escola da Saúde — v2.0
 *
 * Controller exclusivo de CHAMADAS DE TRABALHOS.
 *
 * Responsabilidades deste arquivo:
 * - listar chamadas públicas ativas;
 * - obter detalhes públicos de uma chamada;
 * - listar chamadas para administração;
 * - criar chamada;
 * - atualizar chamada;
 * - publicar/despublicar chamada;
 * - remover chamada somente quando não houver submissões vinculadas;
 * - exportar modelo padrão de banner;
 * - gerenciar modelo de banner/oral vinculado à chamada.
 *
 * Fora deste arquivo:
 * - submissão de trabalho;
 * - avaliação escrita/oral de submissões;
 * - classificação;
 * - votação;
 * - certificados vinculados a trabalhos.
 *
 * Contratos v2.0:
 * - DB oficial via req.db.query;
 * - usuário autenticado via req.user.id;
 * - sem req.usuario;
 * - sem fallback pg-promise;
 * - sem aliases de payload;
 * - sem respostas { erro };
 * - sem compatibilidade plural/singular;
 * - date/time de parede em America/Sao_Paulo;
 * - prazo_final_br trafega como "YYYY-MM-DD HH:mm:ss" ou "YYYY-MM-DDTHH:mm:ss".
 */

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const mime = require("mime-types");
const multer = require("multer");
const crypto = require("crypto");

const { MODELOS_CHAMADAS_DIR } = require("../paths");

const IS_DEV = process.env.NODE_ENV !== "production";

const LIMITE_ARQUIVO_MODELO_BYTES = 50 * 1024 * 1024;
const LIMITE_TEXTO_MIN = 1;
const LIMITE_TEXTO_MAX = 5000;

const MODELO_TIPO = Object.freeze({
  banner: {
    tipo: "template_banner",
    campo: "arquivo",
    nomePadrao: "modelo-banner.pptx",
  },
  oral: {
    tipo: "template_slide_oral",
    campo: "arquivo",
    nomePadrao: "modelo-oral.pptx",
  },
});

const MIME_PPT = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

/* =========================================================================
   Upload oficial
=========================================================================== */

const uploadModelo = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: LIMITE_ARQUIVO_MODELO_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (MIME_PPT.has(file.mimetype) || ext === ".ppt" || ext === ".pptx") {
      return cb(null, true);
    }

    return cb(criarErro("Apenas arquivos .ppt ou .pptx são permitidos.", 400, {
      code: "MODELO_TIPO_INVALIDO",
      adminHint: "O arquivo enviado não possui extensão/MIME compatível com PPT/PPTX.",
    }));
  },
});

/* =========================================================================
   Logger
=========================================================================== */

function requestId(req) {
  return req?.requestId || req?.rid || `CHAMADA-${Date.now().toString(36)}`;
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
   Erros / respostas
=========================================================================== */

function criarErro(message, status = 400, extras = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = extras.code || "ERRO_REQUISICAO";
  err.adminHint = extras.adminHint || null;
  err.details = extras.details || null;
  return err;
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
   DB oficial
=========================================================================== */

function getDb(req) {
  const db = req?.db;

  if (!db || typeof db.query !== "function") {
    throw criarErro("Banco de dados indisponível na requisição.", 500, {
      code: "DB_INDISPONIVEL",
      adminHint:
        "O middleware injectDb deve popular req.db com uma instância que possua query(sql, params).",
    });
  }

  return db;
}

async function query(req, sql, params = []) {
  const db = getDb(req);
  return db.query(sql, params);
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
   Normalização / validação
=========================================================================== */

function toId(value, fieldName = "ID") {
  const id = Number(value);

  assert(Number.isInteger(id) && id > 0, `${fieldName} inválido.`, 400, {
    code: "ID_INVALIDO",
    adminHint: `${fieldName} precisa ser inteiro positivo.`,
  });

  return id;
}

function getUsuarioId(req) {
  const id = req.user?.id;

  assert(id, "Autenticação necessária.", 401, {
    code: "AUTH_OBRIGATORIA",
    adminHint: "req.user.id não foi encontrado após o middleware de autenticação.",
  });

  return id;
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

function booleanOficial(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalizado = value.trim().toLowerCase();

    if (normalizado === "true") return true;
    if (normalizado === "false") return false;
  }

  throw criarErro("Campo booleano inválido. Use true ou false.", 400, {
    code: "BOOLEAN_INVALIDO",
    adminHint: "Contrato v2.0 aceita boolean real ou string 'true'/'false'.",
  });
}

function intOpcional(value, fallback, fieldName, min = 0, max = 1000) {
  if (value == null || value === "") return fallback;

  const n = Number(value);

  assert(Number.isInteger(n) && n >= min && n <= max, `${fieldName} inválido.`, 400, {
    code: "NUMERO_INVALIDO",
    details: { field: fieldName, min, max },
  });

  return n;
}

function isYYYYMM(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function normalizarPeriodo(value, fieldName) {
  const text = String(value || "").trim();

  assert(isYYYYMM(text), `${fieldName} deve estar no formato YYYY-MM.`, 400, {
    code: "PERIODO_INVALIDO",
    details: { field: fieldName, expected: "YYYY-MM" },
  });

  return text;
}

function normalizarPrazoFinal(value) {
  const raw = String(value || "").trim();

  assert(raw.length > 0, "Prazo final é obrigatório.", 400, {
    code: "PRAZO_OBRIGATORIO",
  });

  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(raw);

  assert(match, "Prazo final deve estar no formato YYYY-MM-DD HH:mm:ss.", 400, {
    code: "PRAZO_INVALIDO",
    adminHint:
      "Use horário de parede, sem timezone: YYYY-MM-DD HH:mm:ss. Também é aceito YYYY-MM-DDTHH:mm vindo de input datetime-local.",
    details: { expected: "YYYY-MM-DD HH:mm:ss" },
  });

  const data = match[1];
  const hora = match[2];
  const segundos = match[3] || "00";

  return `${data} ${hora}:${segundos}`;
}

function normalizarLimites(limites) {
  if (limites == null) return null;

  assert(typeof limites === "object" && !Array.isArray(limites), "Limites inválidos.", 400, {
    code: "LIMITES_INVALIDOS",
  });

  const campos = [
    "titulo",
    "introducao",
    "objetivos",
    "metodo",
    "resultados",
    "consideracao",
  ];

  const normalizado = {};

  for (const campo of campos) {
    const valor = Number(limites[campo]);

    assert(
      Number.isInteger(valor) &&
        valor >= LIMITE_TEXTO_MIN &&
        valor <= LIMITE_TEXTO_MAX,
      `Limite de ${campo} inválido.`,
      400,
      {
        code: "LIMITE_TEXTO_INVALIDO",
        details: {
          field: campo,
          min: LIMITE_TEXTO_MIN,
          max: LIMITE_TEXTO_MAX,
        },
      }
    );

    normalizado[campo] = valor;
  }

  return normalizado;
}

function normalizarLinhas(linhas) {
  if (linhas == null) return [];
  assert(Array.isArray(linhas), "Linhas temáticas devem ser uma lista.", 400, {
    code: "LINHAS_INVALIDAS",
  });

  return linhas.map((linha, index) => {
    assert(linha && typeof linha === "object", "Linha temática inválida.", 400, {
      code: "LINHA_INVALIDA",
      details: { index },
    });

    return {
      codigo: textoOpcional(linha.codigo, 50, `linhas[${index}].codigo`),
      nome: textoObrigatorio(linha.nome, 200, `linhas[${index}].nome`),
      descricao: textoOpcional(linha.descricao, 2000, `linhas[${index}].descricao`),
    };
  });
}

function normalizarCriterios(criterios, tipo = "escrito") {
  if (criterios == null) return [];
  assert(Array.isArray(criterios), "Critérios devem ser uma lista.", 400, {
    code: "CRITERIOS_INVALIDOS",
  });

  const escalaPadraoMax = tipo === "oral" ? 3 : 5;

  return criterios.map((criterio, index) => {
    assert(criterio && typeof criterio === "object", "Critério inválido.", 400, {
      code: "CRITERIO_INVALIDO",
      details: { index, tipo },
    });

    const ordem =
      criterio.ordem == null || criterio.ordem === ""
        ? index + 1
        : intOpcional(criterio.ordem, index + 1, `criterios[${index}].ordem`, 1, 999);

    const escalaMin = intOpcional(
      criterio.escala_min,
      1,
      `criterios[${index}].escala_min`,
      0,
      100
    );

    const escalaMax = intOpcional(
      criterio.escala_max,
      escalaPadraoMax,
      `criterios[${index}].escala_max`,
      1,
      100
    );

    assert(escalaMax >= escalaMin, "Escala máxima deve ser maior ou igual à mínima.", 400, {
      code: "ESCALA_INVALIDA",
      details: { index, tipo },
    });

    const peso = Number(criterio.peso ?? 1);

    assert(Number.isFinite(peso) && peso > 0 && peso <= 100, "Peso inválido.", 400, {
      code: "PESO_INVALIDO",
      details: { index, tipo },
    });

    return {
      ordem,
      titulo: textoObrigatorio(criterio.titulo, 200, `criterios[${index}].titulo`),
      escala_min: escalaMin,
      escala_max: escalaMax,
      peso,
    };
  });
}

function normalizarChamadaPayload(body, parcial = false) {
  const payload = {};

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "titulo")) {
    payload.titulo = textoObrigatorio(body.titulo, 200, "Título");
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "descricao_markdown")) {
    payload.descricao_markdown = textoObrigatorio(
      body.descricao_markdown,
      50000,
      "Descrição"
    );
  }

  if (
    !parcial ||
    Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_inicio")
  ) {
    payload.periodo_experiencia_inicio = normalizarPeriodo(
      body.periodo_experiencia_inicio,
      "Período inicial"
    );
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_fim")) {
    payload.periodo_experiencia_fim = normalizarPeriodo(
      body.periodo_experiencia_fim,
      "Período final"
    );
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "prazo_final_br")) {
    payload.prazo_final_br = normalizarPrazoFinal(body.prazo_final_br);
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "aceita_poster")) {
    payload.aceita_poster = booleanOficial(body.aceita_poster, true);
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "link_modelo_poster")) {
    payload.link_modelo_poster = textoOpcional(
      body.link_modelo_poster,
      2000,
      "Link do modelo de pôster"
    );
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "max_coautores")) {
    payload.max_coautores = intOpcional(
      body.max_coautores,
      10,
      "Máximo de coautores",
      0,
      100
    );
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "publicado")) {
    payload.publicado = booleanOficial(body.publicado, false);
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "limites")) {
    payload.limites = normalizarLimites(body.limites);
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "criterios_outros")) {
    payload.criterios_outros = textoOpcional(
      body.criterios_outros,
      20000,
      "Critérios adicionais"
    );
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "oral_outros")) {
    payload.oral_outros = textoOpcional(body.oral_outros, 20000, "Critérios orais adicionais");
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "premiacao_texto")) {
    payload.premiacao_texto = textoOpcional(body.premiacao_texto, 20000, "Premiação");
  }

  if (!parcial || Object.prototype.hasOwnProperty.call(body, "disposicao_finais_texto")) {
    payload.disposicao_finais_texto = textoOpcional(
      body.disposicao_finais_texto,
      30000,
      "Disposições finais"
    );
  }

  if (
    payload.periodo_experiencia_inicio &&
    payload.periodo_experiencia_fim &&
    payload.periodo_experiencia_inicio > payload.periodo_experiencia_fim
  ) {
    throw criarErro("Período de experiência inválido: início maior que fim.", 400, {
      code: "PERIODO_INCONSISTENTE",
    });
  }

  return payload;
}

/* =========================================================================
   SQL compartilhado
=========================================================================== */

const SELECT_CHAMADA_BASE = `
  SELECT
    c.*,
    (
      timezone('America/Sao_Paulo', now()) <= c.prazo_final_br
    ) AS dentro_prazo
  FROM trabalhos_chamadas c
`;

async function carregarComplementosChamada(req, chamadaId) {
  const [linhas, criterios, criterios_orais] = await Promise.all([
    queryMany(
      req,
      `
      SELECT id, codigo, nome, descricao
      FROM trabalhos_chamada_linhas
      WHERE chamada_id = $1
      ORDER BY nome ASC, id ASC
      `,
      [chamadaId]
    ),
    queryMany(
      req,
      `
      SELECT id, ordem, titulo, escala_min, escala_max, peso
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = $1
      ORDER BY ordem ASC, id ASC
      `,
      [chamadaId]
    ),
    queryMany(
      req,
      `
      SELECT id, ordem, titulo, escala_min, escala_max, peso
      FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id = $1
      ORDER BY ordem ASC, id ASC
      `,
      [chamadaId]
    ),
  ]);

  return {
    linhas,
    criterios,
    criterios_orais,
  };
}

async function obterChamadaPorId(req, chamadaId) {
  return queryOne(
    req,
    `
    ${SELECT_CHAMADA_BASE}
    WHERE c.id = $1
    `,
    [chamadaId]
  );
}

async function verificarPublicacaoPossivel(req, chamadaId) {
  const row = await queryOne(
    req,
    `
    SELECT
      (SELECT COUNT(*)::int FROM trabalhos_chamada_linhas WHERE chamada_id = $1) AS linhas,
      (SELECT COUNT(*)::int FROM trabalhos_chamada_criterios WHERE chamada_id = $1) AS criterios
    `,
    [chamadaId]
  );

  assert(Number(row?.linhas || 0) > 0, "Inclua ao menos uma linha temática antes de publicar.", 400, {
    code: "CHAMADA_SEM_LINHA_TEMATICA",
  });

  assert(Number(row?.criterios || 0) > 0, "Inclua ao menos um critério escrito antes de publicar.", 400, {
    code: "CHAMADA_SEM_CRITERIO",
  });
}

/* =========================================================================
   Público / usuário autenticado
=========================================================================== */

exports.listarAtivas = async (req, res, next) => {
  try {
    const rows = await queryMany(
      req,
      `
      ${SELECT_CHAMADA_BASE}
      WHERE c.publicado = TRUE
      ORDER BY c.prazo_final_br ASC, c.id ASC
      `
    );

    logInfo(req, "Chamadas ativas listadas.", { total: rows.length });

    return responder(res, rows, {
      total: rows.length,
    });
  } catch (error) {
    logError(req, "Erro ao listar chamadas ativas.", error);
    return next(error);
  }
};

exports.obterChamada = async (req, res, next) => {
  try {
    const chamadaId = toId(req.params.id);

    const chamada = await obterChamadaPorId(req, chamadaId);

    assert(chamada, "Chamada não encontrada.", 404, {
      code: "CHAMADA_NAO_ENCONTRADA",
    });

    const complementos = await carregarComplementosChamada(req, chamadaId);

    const data = {
      chamada,
      ...complementos,
      limites: chamada.limites || null,
      criterios_outros: chamada.criterios_outros || null,
      oral_outros: chamada.oral_outros || null,
      premiacao_texto: chamada.premiacao_texto || null,
      disposicao_finais_texto: chamada.disposicao_finais_texto || null,
      link_modelo_poster: chamada.link_modelo_poster || null,
      aceita_poster: Boolean(chamada.aceita_poster),
    };

    logInfo(req, "Chamada obtida.", {
      chamadaId,
      linhas: complementos.linhas.length,
      criterios: complementos.criterios.length,
      criterios_orais: complementos.criterios_orais.length,
    });

    return responder(res, data);
  } catch (error) {
    logError(req, "Erro ao obter chamada.", error);
    return next(error);
  }
};

/* =========================================================================
   Admin — chamadas
=========================================================================== */

exports.listarAdmin = async (req, res, next) => {
  try {
    const rows = await queryMany(
      req,
      `
      ${SELECT_CHAMADA_BASE}
      ORDER BY c.criado_em DESC, c.id DESC
      `
    );

    logInfo(req, "Chamadas administrativas listadas.", { total: rows.length });

    return responder(res, rows, {
      total: rows.length,
    });
  } catch (error) {
    logError(req, "Erro ao listar chamadas administrativas.", error);
    return next(error);
  }
};

/**
 * Mantido como alias interno de função para não obrigar troca imediata
 * em imports já existentes do backend.
 *
 * Observação:
 * Não cria rota legada. Apenas reaproveita a mesma função JS.
 */
exports.listarTodas = exports.listarAdmin;

exports.criar = async (req, res, next) => {
  try {
    const usuarioId = getUsuarioId(req);
    const body = req.body || {};

    const payload = normalizarChamadaPayload(body, false);
    const linhas = normalizarLinhas(body.linhas);
    const criterios = normalizarCriterios(body.criterios, "escrito");
    const criteriosOrais = normalizarCriterios(body.criterios_orais, "oral");

    const nova = await transaction(req, async (tx) => {
      const chamada = await tx.one(
        `
        INSERT INTO trabalhos_chamadas
          (
            titulo,
            descricao_markdown,
            periodo_experiencia_inicio,
            periodo_experiencia_fim,
            prazo_final_br,
            aceita_poster,
            link_modelo_poster,
            max_coautores,
            publicado,
            criado_por,
            limites,
            criterios_outros,
            oral_outros,
            premiacao_texto,
            disposicao_finais_texto
          )
        VALUES
          ($1,$2,$3,$4,$5::timestamp,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
        RETURNING *
        `,
        [
          payload.titulo,
          payload.descricao_markdown,
          payload.periodo_experiencia_inicio,
          payload.periodo_experiencia_fim,
          payload.prazo_final_br,
          payload.aceita_poster,
          payload.link_modelo_poster,
          payload.max_coautores,
          payload.publicado,
          usuarioId,
          payload.limites ? JSON.stringify(payload.limites) : null,
          payload.criterios_outros,
          payload.oral_outros,
          payload.premiacao_texto,
          payload.disposicao_finais_texto,
        ]
      );

      for (const linha of linhas) {
        await tx.none(
          `
          INSERT INTO trabalhos_chamada_linhas
            (chamada_id, codigo, nome, descricao)
          VALUES
            ($1,$2,$3,$4)
          `,
          [chamada.id, linha.codigo, linha.nome, linha.descricao]
        );
      }

      for (const criterio of criterios) {
        await tx.none(
          `
          INSERT INTO trabalhos_chamada_criterios
            (chamada_id, ordem, titulo, escala_min, escala_max, peso)
          VALUES
            ($1,$2,$3,$4,$5,$6)
          `,
          [
            chamada.id,
            criterio.ordem,
            criterio.titulo,
            criterio.escala_min,
            criterio.escala_max,
            criterio.peso,
          ]
        );
      }

      for (const criterio of criteriosOrais) {
        await tx.none(
          `
          INSERT INTO trabalhos_chamada_criterios_orais
            (chamada_id, ordem, titulo, escala_min, escala_max, peso)
          VALUES
            ($1,$2,$3,$4,$5,$6)
          `,
          [
            chamada.id,
            criterio.ordem,
            criterio.titulo,
            criterio.escala_min,
            criterio.escala_max,
            criterio.peso,
          ]
        );
      }

      return chamada;
    });

    logInfo(req, "Chamada criada.", { chamadaId: nova.id, usuarioId });

    return responder(res, nova, null, 201);
  } catch (error) {
    logError(req, "Erro ao criar chamada.", error);
    return next(error);
  }
};

exports.atualizar = async (req, res, next) => {
  try {
    const chamadaId = toId(req.params.id);
    const body = req.body || {};

    const existente = await obterChamadaPorId(req, chamadaId);

    assert(existente, "Chamada não encontrada.", 404, {
      code: "CHAMADA_NAO_ENCONTRADA",
    });

    const payload = normalizarChamadaPayload(body, true);

    const linhas = Object.prototype.hasOwnProperty.call(body, "linhas")
      ? normalizarLinhas(body.linhas)
      : null;

    const criterios = Object.prototype.hasOwnProperty.call(body, "criterios")
      ? normalizarCriterios(body.criterios, "escrito")
      : null;

    const criteriosOrais = Object.prototype.hasOwnProperty.call(body, "criterios_orais")
      ? normalizarCriterios(body.criterios_orais, "oral")
      : null;

    const atualizado = await transaction(req, async (tx) => {
      const sets = [];
      const values = [];

      function addSet(column, value, cast = "") {
        values.push(value);
        sets.push(`${column} = $${values.length}${cast}`);
      }

      for (const [key, value] of Object.entries(payload)) {
        if (key === "limites") {
          addSet("limites", value ? JSON.stringify(value) : null, "::jsonb");
          continue;
        }

        if (key === "prazo_final_br") {
          addSet("prazo_final_br", value, "::timestamp");
          continue;
        }

        addSet(key, value);
      }

      if (sets.length > 0) {
        values.push(chamadaId);

        await tx.none(
          `
          UPDATE trabalhos_chamadas
             SET ${sets.join(", ")},
                 atualizado_em = NOW()
           WHERE id = $${values.length}
          `,
          values
        );
      }

      if (linhas) {
        await tx.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id = $1`, [
          chamadaId,
        ]);

        for (const linha of linhas) {
          await tx.none(
            `
            INSERT INTO trabalhos_chamada_linhas
              (chamada_id, codigo, nome, descricao)
            VALUES
              ($1,$2,$3,$4)
            `,
            [chamadaId, linha.codigo, linha.nome, linha.descricao]
          );
        }
      }

      if (criterios) {
        await tx.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id = $1`, [
          chamadaId,
        ]);

        for (const criterio of criterios) {
          await tx.none(
            `
            INSERT INTO trabalhos_chamada_criterios
              (chamada_id, ordem, titulo, escala_min, escala_max, peso)
            VALUES
              ($1,$2,$3,$4,$5,$6)
            `,
            [
              chamadaId,
              criterio.ordem,
              criterio.titulo,
              criterio.escala_min,
              criterio.escala_max,
              criterio.peso,
            ]
          );
        }
      }

      if (criteriosOrais) {
        await tx.none(
          `DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id = $1`,
          [chamadaId]
        );

        for (const criterio of criteriosOrais) {
          await tx.none(
            `
            INSERT INTO trabalhos_chamada_criterios_orais
              (chamada_id, ordem, titulo, escala_min, escala_max, peso)
            VALUES
              ($1,$2,$3,$4,$5,$6)
            `,
            [
              chamadaId,
              criterio.ordem,
              criterio.titulo,
              criterio.escala_min,
              criterio.escala_max,
              criterio.peso,
            ]
          );
        }
      }

      return tx.one(
        `
        ${SELECT_CHAMADA_BASE}
        WHERE c.id = $1
        `,
        [chamadaId]
      );
    });

    logInfo(req, "Chamada atualizada.", { chamadaId });

    return responder(res, atualizado);
  } catch (error) {
    logError(req, "Erro ao atualizar chamada.", error);
    return next(error);
  }
};

exports.publicar = async (req, res, next) => {
  try {
    const chamadaId = toId(req.params.id);

    const publicado = Object.prototype.hasOwnProperty.call(req.body || {}, "publicado")
      ? booleanOficial(req.body.publicado, true)
      : true;

    const chamada = await obterChamadaPorId(req, chamadaId);

    assert(chamada, "Chamada não encontrada.", 404, {
      code: "CHAMADA_NAO_ENCONTRADA",
    });

    if (publicado) {
      await verificarPublicacaoPossivel(req, chamadaId);
    }

    const atualizado = await queryOne(
      req,
      `
      UPDATE trabalhos_chamadas
         SET publicado = $1,
             atualizado_em = NOW()
       WHERE id = $2
       RETURNING *
      `,
      [publicado, chamadaId]
    );

    logInfo(req, "Publicação de chamada atualizada.", {
      chamadaId,
      publicado,
    });

    return responder(res, atualizado, {
      publicado,
    });
  } catch (error) {
    logError(req, "Erro ao publicar/despublicar chamada.", error);
    return next(error);
  }
};

exports.remover = async (req, res, next) => {
  try {
    const chamadaId = toId(req.params.id);

    const chamada = await obterChamadaPorId(req, chamadaId);

    assert(chamada, "Chamada não encontrada.", 404, {
      code: "CHAMADA_NAO_ENCONTRADA",
    });

    const vinculos = await queryOne(
      req,
      `
      SELECT COUNT(*)::int AS total
      FROM trabalhos_submissoes
      WHERE chamada_id = $1
      `,
      [chamadaId]
    );

    assert(
      Number(vinculos?.total || 0) === 0,
      "Esta chamada possui submissões vinculadas e não pode ser excluída fisicamente.",
      409,
      {
        code: "CHAMADA_COM_SUBMISSOES",
        adminHint:
          "Para chamadas com submissões, use despublicação/arquivamento quando o campo status existir no banco. Não destrua histórico institucional.",
        details: {
          submissao_total: Number(vinculos?.total || 0),
        },
      }
    );

    await transaction(req, async (tx) => {
      await tx.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id = $1`, [
        chamadaId,
      ]);

      await tx.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id = $1`, [
        chamadaId,
      ]);

      await tx.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id = $1`, [
        chamadaId,
      ]);

      await tx.none(`DELETE FROM trabalhos_chamadas_modelos WHERE chamada_id = $1`, [
        chamadaId,
      ]);

      await tx.none(`DELETE FROM trabalhos_chamadas WHERE id = $1`, [chamadaId]);
    });

    logInfo(req, "Chamada removida sem vínculos.", { chamadaId });

    return responder(res, {
      id: chamadaId,
      removida: true,
    });
  } catch (error) {
    logError(req, "Erro ao remover chamada.", error);
    return next(error);
  }
};

/* =========================================================================
   Modelo padrão global
=========================================================================== */

function localizarModeloPadraoBanner() {
  const candidatos = [
    path.join(process.cwd(), "assets", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "public", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "api", "assets", "modelos", "banner-padrao.pptx"),
    path.join(__dirname, "..", "..", "assets", "modelos", "banner-padrao.pptx"),
  ];

  return candidatos.find((p) => fs.existsSync(p)) || null;
}

function setCachePublico(res, stat, maxAge = 3600) {
  const etag = `"${crypto
    .createHash("sha1")
    .update(`${stat.size}:${stat.mtimeMs}`)
    .digest("hex")}"`;

  res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Length, Last-Modified, ETag"
  );
}

function recursoNaoModificado(req, res, stat) {
  const ifNoneMatch = req.headers["if-none-match"];
  const etagAtual = res.getHeader("ETag");

  if (ifNoneMatch && etagAtual && String(ifNoneMatch).trim() === String(etagAtual)) {
    res.status(304).end();
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];

  if (ifModifiedSince) {
    const data = new Date(ifModifiedSince);

    if (!Number.isNaN(data.getTime()) && stat.mtime <= data) {
      res.status(304).end();
      return true;
    }
  }

  return false;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

exports.exportarModeloBanner = async (req, res, next) => {
  try {
    const filePath = localizarModeloPadraoBanner();

    assert(filePath, "Modelo padrão de banner não encontrado no servidor.", 404, {
      code: "MODELO_PADRAO_NAO_ENCONTRADO",
      adminHint:
        "Verifique se banner-padrao.pptx existe em assets/modelos ou public/modelos.",
    });

    const stat = await fsp.stat(filePath);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent("banner-padrao.pptx")}`
    );
    res.setHeader("Content-Length", String(stat.size));

    setCachePublico(res, stat, 3600);

    if (recursoNaoModificado(req, res, stat)) return;

    logInfo(req, "Modelo padrão de banner exportado.", {
      filePath,
      size: stat.size,
    });

    const stream = fs.createReadStream(filePath);

    stream.on("error", (error) => {
      logError(req, "Falha no stream do modelo padrão.", error);

      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    return stream.pipe(res);
  } catch (error) {
    logError(req, "Erro ao exportar modelo padrão de banner.", error);
    return next(error);
  }
};

/* =========================================================================
   Modelos por chamada
=========================================================================== */

function normalizarTipoModelo(tipo) {
  const cfg = MODELO_TIPO[tipo];

  assert(cfg, "Tipo de modelo inválido.", 400, {
    code: "MODELO_TIPO_INVALIDO",
    adminHint: "Tipos oficiais: banner ou oral.",
  });

  return cfg;
}

function validarAssinaturaPpt(buffer, ext) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;

  const sig4 = buffer.subarray(0, 4).toString("hex");
  const sig8 = buffer.subarray(0, 8).toString("hex");

  if (ext === ".pptx") {
    return sig4 === "504b0304" || sig4 === "504b0506" || sig4 === "504b0708";
  }

  if (ext === ".ppt") {
    return sig8 === "d0cf11e0a1b11ae1";
  }

  return false;
}

function storagePathSeguro(storageKey) {
  if (!storageKey) return null;

  const key = String(storageKey).replace(/^\/+/, "");
  const root = path.resolve(MODELOS_CHAMADAS_DIR);
  const resolved = path.resolve(path.join(root, key));

  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
    return null;
  }

  return resolved;
}

async function obterModeloMaisRecente(req, chamadaId, tipo) {
  return queryOne(
    req,
    `
    SELECT
      id,
      chamada_id,
      nome_arquivo,
      mime,
      storage_key,
      tamanho_bytes,
      hash_sha256,
      tipo,
      updated_at
    FROM trabalhos_chamadas_modelos
    WHERE chamada_id = $1
      AND tipo = $2
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
    `,
    [chamadaId, tipo]
  );
}

async function salvarModelo(req, chamadaId, file, cfg) {
  const chamada = await obterChamadaPorId(req, chamadaId);

  assert(chamada, "Chamada não encontrada.", 404, {
    code: "CHAMADA_NAO_ENCONTRADA",
  });

  assert(file, "Arquivo obrigatório no campo 'arquivo'.", 400, {
    code: "ARQUIVO_OBRIGATORIO",
    adminHint: "Contrato v2.0: envie o multipart field com nome 'arquivo'.",
  });

  const nomeOriginal = file.originalname || cfg.nomePadrao;
  const ext = path.extname(nomeOriginal).toLowerCase();

  assert(ext === ".ppt" || ext === ".pptx", "Envie arquivo .ppt ou .pptx.", 400, {
    code: "MODELO_EXTENSAO_INVALIDA",
  });

  assert(
    MIME_PPT.has(file.mimetype) || ext === ".ppt" || ext === ".pptx",
    "Arquivo com MIME inválido para modelo.",
    400,
    {
      code: "MODELO_MIME_INVALIDO",
      details: { mimetype: file.mimetype },
    }
  );

  assert(
    validarAssinaturaPpt(file.buffer, ext),
    "Arquivo inválido: assinatura não compatível com PPT/PPTX.",
    400,
    {
      code: "MODELO_ASSINATURA_INVALIDA",
      adminHint:
        "A extensão do arquivo indica PowerPoint, mas a assinatura binária não corresponde.",
    }
  );

  const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const dirRelativa = String(chamadaId);
  const nomeArquivoStorage = `${cfg.tipo}${ext}`;
  const storageKey = `${dirRelativa}/${nomeArquivoStorage}`;
  const absPath = storagePathSeguro(storageKey);

  assert(absPath, "Caminho de armazenamento inválido.", 500, {
    code: "STORAGE_PATH_INVALIDO",
  });

  await fsp.mkdir(path.dirname(absPath), { recursive: true });

  const tmpPath = `${absPath}.tmp-${Date.now()}`;
  await fsp.writeFile(tmpPath, file.buffer);
  await fsp.rename(tmpPath, absPath);

  const usuarioId = req.user?.id || null;

  return queryOne(
    req,
    `
    INSERT INTO trabalhos_chamadas_modelos
      (
        chamada_id,
        nome_arquivo,
        mime,
        storage_key,
        tamanho_bytes,
        hash_sha256,
        tipo,
        updated_at
      )
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,NOW(),$8)
    ON CONFLICT (chamada_id, tipo) DO UPDATE
    SET nome_arquivo  = EXCLUDED.nome_arquivo,
        mime          = EXCLUDED.mime,
        storage_key   = EXCLUDED.storage_key,
        tamanho_bytes = EXCLUDED.tamanho_bytes,
        hash_sha256   = EXCLUDED.hash_sha256,
        updated_at    = NOW(),
    RETURNING
      id,
      chamada_id,
      nome_arquivo,
      mime,
      storage_key,
      tamanho_bytes,
      hash_sha256,
      tipo,
      updated_at
    `,
    [
      chamadaId,
      nomeOriginal,
      file.mimetype || mime.lookup(nomeOriginal) || "application/octet-stream",
      storageKey,
      file.size || file.buffer.length,
      hash,
      cfg.tipo,
      usuarioId,
    ]
  );
}

function criarMetaModelo(tipoModelo) {
  return async (req, res, next) => {
    try {
      setNoStore(res);

      const chamadaId = toId(req.params.id);
      const cfg = normalizarTipoModelo(tipoModelo);
      const row = await obterModeloMaisRecente(req, chamadaId, cfg.tipo);

      assert(row, "Modelo não encontrado.", 404, {
        code: "MODELO_NAO_ENCONTRADO",
      });

      const absPath = storagePathSeguro(row.storage_key);
      const exists = absPath ? fs.existsSync(absPath) : false;

      const data = {
        chamada_id: row.chamada_id,
        tipo: row.tipo,
        filename: row.nome_arquivo,
        mime: row.mime,
        size: row.tamanho_bytes,
        hash_sha256: row.hash_sha256,
        updated_at: row.updated_at,
        exists,
      };

      return responder(res, data);
    } catch (error) {
      logError(req, "Erro ao obter metadados do modelo.", error);
      return next(error);
    }
  };
}

function criarDownloadModelo(tipoModelo) {
  return async (req, res, next) => {
    try {
      const chamadaId = toId(req.params.id);
      const cfg = normalizarTipoModelo(tipoModelo);
      const row = await obterModeloMaisRecente(req, chamadaId, cfg.tipo);

      if (!row) {
        if (req.method === "HEAD") return res.status(404).end();

        throw criarErro("Modelo não encontrado.", 404, {
          code: "MODELO_NAO_ENCONTRADO",
        });
      }

      const absPath = storagePathSeguro(row.storage_key);

      if (!absPath || !fs.existsSync(absPath)) {
        if (req.method === "HEAD") return res.status(404).end();

        throw criarErro("Arquivo do modelo não está disponível.", 410, {
          code: "MODELO_ARQUIVO_INDISPONIVEL",
          adminHint:
            "Há metadado no banco, mas o arquivo físico não foi encontrado no storage oficial.",
        });
      }

      const stat = await fsp.stat(absPath);
      const nomeArquivo = row.nome_arquivo || cfg.nomePadrao;
      const mimeType = row.mime || mime.lookup(nomeArquivo) || "application/octet-stream";

      res.setHeader("Content-Type", mimeType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(nomeArquivo)}`
      );
      res.setHeader("Content-Length", String(stat.size));

      setCachePublico(res, stat, 3600);

      if (req.method === "HEAD") {
        return res.status(204).end();
      }

      if (recursoNaoModificado(req, res, stat)) return;

      const stream = fs.createReadStream(absPath);

      stream.on("error", (error) => {
        logError(req, "Falha no stream do modelo da chamada.", error);

        if (!res.headersSent) {
          res.status(500).end();
        }
      });

      logInfo(req, "Modelo da chamada baixado.", {
        chamadaId,
        tipo: cfg.tipo,
        size: stat.size,
      });

      return stream.pipe(res);
    } catch (error) {
      logError(req, "Erro ao baixar modelo da chamada.", error);
      return next(error);
    }
  };
}

function criarImportacaoModelo(tipoModelo) {
  const cfg = normalizarTipoModelo(tipoModelo);

  return [
    uploadModelo.single(cfg.campo),
    async (req, res, next) => {
      try {
        setNoStore(res);

        const chamadaId = toId(req.params.id);
        const data = await salvarModelo(req, chamadaId, req.file, cfg);

        logInfo(req, "Modelo importado para chamada.", {
          chamadaId,
          tipo: cfg.tipo,
          arquivo: data.nome_arquivo,
          tamanho: data.tamanho_bytes,
        });

        return responder(res, data, null, 201);
      } catch (error) {
        logError(req, "Erro ao importar modelo da chamada.", error);
        return next(error);
      }
    },
  ];
}

exports.modeloBannerMeta = criarMetaModelo("banner");
exports.modeloOralMeta = criarMetaModelo("oral");

exports.baixarModeloBanner = criarDownloadModelo("banner");
exports.baixarModeloOral = criarDownloadModelo("oral");

/**
 * Mantido temporariamente como nome de função para rota antiga interna.
 * A função em si baixa apenas o modelo de banner oficial.
 *
 * Quando reeditarmos chamadaRoute.js, usar diretamente:
 * - baixarModeloBanner
 * - baixarModeloOral
 */
exports.baixarModeloPorChamada = exports.baixarModeloBanner;

exports.importarModeloBanner = criarImportacaoModelo("banner");
exports.importarModeloOral = criarImportacaoModelo("oral");