// ✅ src/controllers/usuariosEstatisticasController.js
/* eslint-disable no-console */
const fallbackDb = require("../db"); // pool, client, ou objeto com .db

/* ----------------------- DB adapter compat ----------------------- */
function getDb(req) {
  // server.js injeta req.db = db; se não houver, cai no require("../db")
  const base = req?.db ?? (fallbackDb?.db ?? fallbackDb);
  if (!base) throw new Error("DB não inicializado");
  return base;
}

// Compat com pg-promise (one/none/manyOrNone) e node-postgres (query)
async function dbOne(db, sql, params) {
  if (typeof db.one === "function") return db.one(sql, params);
  const res = await db.query(sql, params);
  if (!res?.rows?.length) throw new Error("Registro não encontrado");
  return res.rows[0];
}
async function dbManyOrNone(db, sql, params) {
  if (typeof db.manyOrNone === "function") return db.manyOrNone(sql, params);
  const res = await db.query(sql, params);
  return res?.rows ?? [];
}

/* ----------------------- Helpers ----------------------- */
/**
 * Agregador genérico com fallback para coluna de texto na própria `usuarios`.
 *
 * labelMode:
 *  - "extra-only"  → usa apenas `extra` (ex.: SIGLA); se vazio, cai para `base`; senão "Não informado"
 *  - "base-only"   → usa apenas `base` (ex.: NOME); se vazio, cai para `extra`; senão "Não informado"
 *  - "extra-first" → "EXTRA — BASE" quando ambos, senão um só (default)
 *
 * Parâmetros:
 *  - table:            nome da tabela de domínio (ex.: 'unidades')
 *  - joinCol:          coluna FK em usuarios (ex.: 'unidade_id')
 *  - labelCol:         coluna de NOME na tabela de domínio (default: 'nome')
 *  - extraLabel:       coluna extra (ex.: 'sigla') na tabela de domínio
 *  - textCol:          fallback textual em `usuarios` quando o *_id for nulo (ex.: 'genero')
 *  - nullLabel:        rótulo para valores vazios/nulos (default: 'Não informado')
 *  - where:            cláusula opcional para filtrar `usuarios`
 *  - order:            ordenação SQL (se não informado, escolhe por labelMode)
 *  - labelMode:        ver descrição acima
 */
async function aggWithJoin(db, {
  table,
  joinCol,
  labelCol = "nome",
  extraLabel = null,
  textCol = null,
  nullLabel = "Não informado",
  where = "",
  order,
  labelMode = "extra-first",
}) {
  const computedOrder =
    order ?? (labelMode === "extra-only" ? "4 DESC, 3 ASC" : "4 DESC, 2 ASC");

  const sql = `
    SELECT
      u.${joinCol} AS id,
      CASE
        WHEN ${table ? `d.${labelCol} IS NOT NULL AND btrim(d.${labelCol}) <> ''` : "false"}
          THEN d.${labelCol}
        ${textCol ? `WHEN u.${textCol} IS NOT NULL AND btrim(u.${textCol}::text) <> '' THEN u.${textCol}::text` : ""}
        ELSE NULL
      END AS label_base,
      ${extraLabel ? (table ? `d.${extraLabel}` : "NULL") : "NULL"} AS extra,
      COUNT(*)::int AS value
    FROM usuarios u
    ${table ? `LEFT JOIN ${table} d ON d.id = u.${joinCol}` : ""}
    ${where ? `WHERE ${where}` : ""}
    GROUP BY 1, 2, 3
    ORDER BY ${computedOrder}
  `;

  const rows = await dbManyOrNone(db, sql);

  return rows.map((r) => {
    const base = r?.label_base ? String(r.label_base).trim() : "";
    const extra = r?.extra ? String(r.extra).trim() : "";
    let label;
    if (labelMode === "extra-only") {
      label = extra || base || nullLabel;
    } else if (labelMode === "base-only") {
      label = base || extra || nullLabel;
    } else {
      label = extra && base ? `${extra} — ${base}` : (extra || base || nullLabel);
    }
    return { id: r.id, label, value: r.value };
  });
}

/* ----------------- Controller principal ----------------- */
/**
 * Modo de uso:
 *  - Chamado pela rota "normal": responde com res.json(...)
 *  - Chamado pelo router premium com { internal: true } ou { preview: true }:
 *      retorna apenas o objeto de dados (não finaliza a resposta)
 */
async function getEstatisticasUsuarios(req, res, opts = {}) {
  const internal = !!opts.internal || !!opts.preview;
  try {
    const db = getDb(req);
    console.log("📊 Iniciando cálculo de estatísticas de usuários...");

    // (1) Total de usuários
    const totalRow = await dbOne(db, `SELECT COUNT(*)::int AS total FROM usuarios`);
    const total = totalRow?.total ?? 0;

    // (2) Faixas etárias (usa current_date para evitar timezone shift)
    const rowsIdade = await dbManyOrNone(db, `
      SELECT faixa, COUNT(*)::int AS qtde
      FROM (
        SELECT CASE
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
      GROUP BY 1
      ORDER BY
        CASE faixa
          WHEN '<20'  THEN 1
          WHEN '20-29' THEN 2
          WHEN '30-39' THEN 3
          WHEN '40-49' THEN 4
          WHEN '50-59' THEN 5
          WHEN '60+'   THEN 6
          ELSE 7
        END
    `);

    const faixaMap = new Map(rowsIdade.map((r) => [r.faixa, r.qtde]));
    const faixaArr = [
      { label: "<20",      value: faixaMap.get("<20")      || 0 },
      { label: "20-29",    value: faixaMap.get("20-29")    || 0 },
      { label: "30-39",    value: faixaMap.get("30-39")    || 0 },
      { label: "40-49",    value: faixaMap.get("40-49")    || 0 },
      { label: "50-59",    value: faixaMap.get("50-59")    || 0 },
      { label: "60+",      value: faixaMap.get("60+")      || 0 },
      { label: "Sem data", value: faixaMap.get("Sem data") || 0 },
    ];

    // (3) Agregações por domínio (com fallback textual quando *_id = NULL)
    const [
      porUnidade,
      porEscolaridade,
      porCargo,
      porOrientacaoSexual,
      porGenero,
      porDeficiencia,
      porCorRaca,
    ] = await Promise.all([
      // Unidades: exibe apenas SIGLA (se houver), caindo para nome
      aggWithJoin(db, {
        table: "unidades",
        joinCol: "unidade_id",
        labelCol: "nome",
        extraLabel: "sigla",
        labelMode: "extra-only",
      }),
      aggWithJoin(db, {
        table: "escolaridades",
        joinCol: "escolaridade_id",
        labelCol: "nome",
        textCol: "escolaridade",
        labelMode: "base-only",
      }),
      aggWithJoin(db, {
        table: "cargos",
        joinCol: "cargo_id",
        labelCol: "nome",
        textCol: "cargo",
        labelMode: "base-only",
      }),
      aggWithJoin(db, {
        table: "orientacoes_sexuais",
        joinCol: "orientacao_sexual_id",
        labelCol: "nome",
        textCol: "orientacao_sexual",
        labelMode: "base-only",
      }),
      aggWithJoin(db, {
        table: "generos",
        joinCol: "genero_id",
        labelCol: "nome",
        textCol: "genero",
        labelMode: "base-only",
      }),
      aggWithJoin(db, {
        table: "deficiencias",
        joinCol: "deficiencia_id",
        labelCol: "nome",
        textCol: "deficiencia",
        labelMode: "base-only",
      }),
      aggWithJoin(db, {
        table: "cores_racas",
        joinCol: "cor_raca_id",
        labelCol: "nome",
        textCol: "cor_raca",
        labelMode: "base-only",
      }),
    ]);

    const payload = {
      total_usuarios: total,
      faixa_etaria: faixaArr,
      por_unidade: porUnidade,
      por_escolaridade: porEscolaridade,
      por_cargo: porCargo,
      por_orientacao_sexual: porOrientacaoSexual,
      por_genero: porGenero,
      por_deficiencia: porDeficiencia,
      por_cor_raca: porCorRaca,
    };

    console.log("✅ Estatísticas calculadas com sucesso.");

    // Se a chamada é "interna/preview", retornamos os dados para o router montar ETag/Cache
    if (internal) return payload;

    // Caso contrário, respondemos aqui mesmo
    return res.status(200).json(payload);
  } catch (err) {
    console.error("❌ /usuarios/estatisticas erro:", err);
    if (opts.preview) return null; // para HEAD/preview
    if (!res.headersSent) {
      res.status(500).json({ error: "Falha ao calcular estatísticas" });
    }
    return null;
  }
}

/* (Opcional futuro) Estatísticas detalhadas com breakdown extra.
   Se for usar a rota /usuarios/estatisticas/detalhes do router premium,
   implemente aqui usando a mesma abordagem (retornar objeto em vez de res.json). */
async function getEstatisticasUsuariosDetalhadas(req, res) {
  // Exemplo de esqueleto (preparado para expansão futura):
  const data = await getEstatisticasUsuarios(req, res, { internal: true });
  // Aqui você pode acrescentar cruzamentos (ex.: por unidade x gênero, etc.)
  return data;
}

module.exports = {
  getEstatisticasUsuarios,
  getEstatisticasUsuariosDetalhadas,
};
