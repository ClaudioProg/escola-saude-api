// 📁 src/controllers/lookupsPublicController.js
const db = require("../db");

// Helpers ----------------------------------------------------------
function orderByNome(alias = "") {
  const a = alias ? `${alias}.` : "";
  return ` ORDER BY ${a}nome ASC`;
}

async function tryQuery(sqlPrimary, sqlFallback, massageFallbackRows) {
  try {
    const { rows } = await db.query(sqlPrimary);
    return rows;
  } catch (e) {
    // coluna inexistente? cai para plano B
    try {
      const { rows } = await db.query(sqlFallback);
      return typeof massageFallbackRows === "function"
        ? massageFallbackRows(rows)
        : rows;
    } catch (e2) {
      // loga os dois erros para diagnóstico
      console.error("Lookup error:", {
        primary: e?.message,
        fallback: e2?.message,
      });
      throw e2;
    }
  }
}

// Endpoints --------------------------------------------------------
async function listCargos(req, res) {
  try {
    const rows = await tryQuery(
      // tenta com is_active + display_order
      `SELECT id, nome, display_order
         FROM cargos
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, nome ASC`,
      // fallback mínimo
      `SELECT id, nome FROM cargos${orderByNome()}`,
      // garante a chave no shape
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listCargos:", e);
    res.status(500).json({ erro: "Falha ao listar cargos." });
  }
}

async function listUnidades(req, res) {
  try {
    const rows = await tryQuery(
      // tenta com sigla
      `SELECT id, nome, sigla
         FROM unidades
        ORDER BY nome ASC`,
      // fallback sem sigla
      `SELECT id, nome FROM unidades${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, sigla: null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listUnidades:", e);
    res.status(500).json({ erro: "Falha ao listar unidades." });
  }
}

async function listGeneros(req, res) {
  try {
    const rows = await tryQuery(
      `SELECT id, nome, display_order
         FROM generos
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC`,
      `SELECT id, nome FROM generos${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listGeneros:", e);
    res.status(500).json({ erro: "Falha ao listar gêneros." });
  }
}

async function listOrientacoesSexuais(req, res) {
  try {
    const rows = await tryQuery(
      `SELECT id, nome, display_order
         FROM orientacoes_sexuais
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC`,
      `SELECT id, nome FROM orientacoes_sexuais${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listOrientacoesSexuais:", e);
    res.status(500).json({ erro: "Falha ao listar orientações sexuais." });
  }
}

async function listCoresRacas(req, res) {
  try {
    const rows = await tryQuery(
      `SELECT id, nome, display_order
         FROM cores_racas
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC`,
      `SELECT id, nome FROM cores_racas${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listCoresRacas:", e);
    res.status(500).json({ erro: "Falha ao listar cores/raças." });
  }
}

async function listEscolaridades(req, res) {
  try {
    const rows = await tryQuery(
      `SELECT id, nome, display_order
         FROM escolaridades
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC`,
      `SELECT id, nome FROM escolaridades${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listEscolaridades:", e);
    res.status(500).json({ erro: "Falha ao listar escolaridades." });
  }
}

async function listDeficiencias(req, res) {
  try {
    const rows = await tryQuery(
      `SELECT id, nome, display_order
         FROM deficiencias
        WHERE is_active = TRUE
        ORDER BY display_order NULLS LAST, id ASC`,
      `SELECT id, nome FROM deficiencias${orderByNome()}`,
      (r) => r.map((x) => ({ ...x, display_order: x.display_order ?? null }))
    );
    res.json(rows);
  } catch (e) {
    console.error("listDeficiencias:", e);
    res.status(500).json({ erro: "Falha ao listar deficiências." });
  }
}

module.exports = {
  listCargos,
  listUnidades,
  listGeneros,
  listOrientacoesSexuais,
  listCoresRacas,
  listEscolaridades,
  listDeficiencias,
};
