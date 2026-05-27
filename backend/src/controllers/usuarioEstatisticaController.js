/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/controllers/usuarioEstatisticaController.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Estatísticas administrativas de usuários.
 *
 * Mount via rota:
 * - GET  /api/usuario/estatistica
 * - HEAD /api/usuario/estatistica
 * - GET  /api/usuario/estatistica/detalhe
 *
 * Contrato oficial:
 * - Perfil é string única.
 * - Perfis oficiais: usuario, organizador, administrador.
 * - Estatísticas usam tabelas oficiais de referência.
 *
 * Padrão:
 * - Sem aliases.
 * - Sem fallback de nomes.
 * - Sem perfil array.
 * - Sem role/roles/perfis.
 * - Sem misturar com cadastro/edição de usuário.
 * - Respostas padronizadas.
 */

const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ──────────────────────────────────────────────────────────────
   Constantes oficiais
────────────────────────────────────────────────────────────── */

const PERFIS_VALIDOS = new Set(["usuario", "organizador", "administrador"]);

const AGG_CONFIGS = {
  unidades: {
    table: "unidades",
    joinCol: "unidade_id",
    labelCol: "nome",
    extraLabel: "sigla",
  },
  escolaridades: {
    table: "escolaridades",
    joinCol: "escolaridade_id",
    labelCol: "nome",
    extraLabel: null,
  },
  cargos: {
    table: "cargos",
    joinCol: "cargo_id",
    labelCol: "nome",
    extraLabel: null,
  },
  orientacoes_sexuais: {
    table: "orientacoes_sexuais",
    joinCol: "orientacao_sexual_id",
    labelCol: "nome",
    extraLabel: null,
  },
  generos: {
    table: "generos",
    joinCol: "genero_id",
    labelCol: "nome",
    extraLabel: null,
  },
  deficiencias: {
    table: "deficiencias",
    joinCol: "deficiencia_id",
    labelCol: "nome",
    extraLabel: null,
  },
  cores_racas: {
    table: "cores_racas",
    joinCol: "cor_raca_id",
    labelCol: "nome",
    extraLabel: null,
  },
};

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function perfilOficial(perfil) {
  const value = String(perfil || "").trim();

  if (!value) return "Não informado";
  if (!PERFIS_VALIDOS.has(value)) return "Não informado";

  return value;
}

async function dbOne(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows?.[0] || null;
}

async function dbMany(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows || [];
}

function getAggConfig(key) {
  const config = AGG_CONFIGS[key];

  if (!config) {
    throw new Error(`Configuração de agregação inválida: ${key}`);
  }

  return config;
}

async function aggWithJoin(configKey, options = {}) {
  const {
    nullLabel = "Não informado",
    labelMode = "base-only",
  } = options;

  const config = getAggConfig(configKey);

  const { table, joinCol, labelCol, extraLabel } = config;

  const order =
    labelMode === "extra-only"
      ? "value DESC, label_extra ASC NULLS LAST, label_base ASC NULLS LAST"
      : "value DESC, label_base ASC NULLS LAST, label_extra ASC NULLS LAST";

  const sql = `
    SELECT
      u.${joinCol} AS id,
      CASE
        WHEN d.${labelCol} IS NOT NULL AND btrim(d.${labelCol}) <> ''
          THEN d.${labelCol}
        ELSE NULL
      END AS label_base,
      ${extraLabel ? `d.${extraLabel}` : "NULL"} AS label_extra,
      COUNT(*)::int AS value
    FROM usuarios u
    LEFT JOIN ${table} d ON d.id = u.${joinCol}
    GROUP BY 1, 2, 3
    ORDER BY ${order}
  `;

  const rows = await dbMany(sql);

  return rows.map((row) => {
    const base = row.label_base ? String(row.label_base).trim() : "";
    const extra = row.label_extra ? String(row.label_extra).trim() : "";

    let label;

    if (labelMode === "extra-only") {
      label = extra || base || nullLabel;
    } else if (labelMode === "extra-first") {
      label = extra && base ? `${extra} — ${base}` : extra || base || nullLabel;
    } else {
      label = base || extra || nullLabel;
    }

    return {
      id: row.id,
      label,
      value: Number(row.value) || 0,
    };
  });
}

function mapPerfilRows(rows = []) {
  return rows
    .map((row) => ({
      label: perfilOficial(row.perfil),
      value: Number(row.total) || 0,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/* ──────────────────────────────────────────────────────────────
   Núcleo das estatísticas
────────────────────────────────────────────────────────────── */

async function montarEstatisticaUsuarios() {
  const totalRow = await dbOne(`
    SELECT COUNT(*)::int AS total
    FROM usuarios
  `);

  const totalUsuarios = Number(totalRow?.total || 0);

  const rowsIdade = await dbMany(`
    SELECT faixa, COUNT(*)::int AS value
    FROM (
      SELECT
        CASE
          WHEN u.data_nascimento IS NULL THEN 'Sem data'
          WHEN age(current_date, u.data_nascimento) < interval '20 years' THEN '<20'
          WHEN age(current_date, u.data_nascimento) < interval '30 years' THEN '20-29'
          WHEN age(current_date, u.data_nascimento) < interval '40 years' THEN '30-39'
          WHEN age(current_date, u.data_nascimento) < interval '50 years' THEN '40-49'
          WHEN age(current_date, u.data_nascimento) < interval '60 years' THEN '50-59'
          ELSE '60+'
        END AS faixa
      FROM usuarios u
    ) s
    GROUP BY faixa
    ORDER BY
      CASE faixa
        WHEN '<20' THEN 1
        WHEN '20-29' THEN 2
        WHEN '30-39' THEN 3
        WHEN '40-49' THEN 4
        WHEN '50-59' THEN 5
        WHEN '60+' THEN 6
        ELSE 7
      END
  `);

  const idadeMap = new Map(
    rowsIdade.map((row) => [row.faixa, Number(row.value) || 0])
  );

  const faixaEtaria = [
    { label: "<20", value: idadeMap.get("<20") || 0 },
    { label: "20-29", value: idadeMap.get("20-29") || 0 },
    { label: "30-39", value: idadeMap.get("30-39") || 0 },
    { label: "40-49", value: idadeMap.get("40-49") || 0 },
    { label: "50-59", value: idadeMap.get("50-59") || 0 },
    { label: "60+", value: idadeMap.get("60+") || 0 },
    { label: "Sem data", value: idadeMap.get("Sem data") || 0 },
  ];

  const [
    porUnidade,
    porEscolaridade,
    porCargo,
    porOrientacaoSexual,
    porGenero,
    porDeficiencia,
    porCorRaca,
  ] = await Promise.all([
    aggWithJoin("unidades", {
      labelMode: "extra-only",
    }),
    aggWithJoin("escolaridades"),
    aggWithJoin("cargos"),
    aggWithJoin("orientacoes_sexuais"),
    aggWithJoin("generos"),
    aggWithJoin("deficiencias"),
    aggWithJoin("cores_racas"),
  ]);

  return {
    total_usuarios: totalUsuarios,
    faixa_etaria: faixaEtaria,
    por_unidade: porUnidade,
    por_escolaridade: porEscolaridade,
    por_cargo: porCargo,
    por_orientacao_sexual: porOrientacaoSexual,
    por_genero: porGenero,
    por_deficiencia: porDeficiencia,
    por_cor_raca: porCorRaca,
  };
}

/* ──────────────────────────────────────────────────────────────
   GET /api/usuario/estatistica
────────────────────────────────────────────────────────────── */

async function obterEstatistica(req, res, opts = {}) {
  const internal = !!opts.internal || !!opts.preview;

  try {
    const payload = await montarEstatisticaUsuarios();

    if (internal) return payload;

    return res.status(200).json({
      ok: true,
      data: payload,
    });
  } catch (err) {
    console.error("[usuarioEstatisticaController.obterEstatistica] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
    });

    if (opts.preview) return null;
    if (internal) throw err;

    return respostaErro(
      res,
      500,
      "USUARIO-ESTATISTICA-500-GERAL",
      "Erro ao obter estatísticas de usuários."
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/usuario/estatistica/detalhe
────────────────────────────────────────────────────────────── */

async function obterEstatisticaDetalhada(req, res, opts = {}) {
  const internal = !!opts.internal || !!opts.preview;

  try {
    const base = await montarEstatisticaUsuarios();

    const perfilRows = await dbMany(`
      SELECT
        COALESCE(NULLIF(TRIM(perfil), ''), 'Não informado') AS perfil,
        COUNT(*)::int AS total
      FROM usuarios
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
    `);

    const usuariosRecentes = await dbMany(`
      SELECT
        id,
        nome,
        email,
        celular,
        perfil,
        criado_em
      FROM usuarios
      ORDER BY criado_em DESC NULLS LAST, id DESC
      LIMIT 10
    `);

    const payload = {
      ...base,
      por_perfil: mapPerfilRows(perfilRows),
      usuarios_recentes: usuariosRecentes.map((usuario) => ({
        ...usuario,
        perfil: perfilOficial(usuario.perfil),
      })),
    };

    if (internal) return payload;

    return res.status(200).json({
      ok: true,
      data: payload,
    });
  } catch (err) {
    console.error("[usuarioEstatisticaController.obterEstatisticaDetalhada] ERRO", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
    });

    if (opts.preview) return null;
    if (internal) throw err;

    return respostaErro(
      res,
      500,
      "USUARIO-ESTATISTICA-500-DETALHE",
      "Erro ao obter estatísticas detalhadas de usuários."
    );
  }
}

module.exports = {
  obterEstatistica,
  obterEstatisticaDetalhada,
};