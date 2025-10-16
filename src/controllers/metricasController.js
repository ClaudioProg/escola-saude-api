// 📁 src/controllers/metricasController.js
// ✅ Versão simplificada: só conta acessos do APP (sem Instagram)

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb; // compatível com export default ou { db }

function log(...args) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[metricas]", ...args);
  }
}
function logErr(...args) {
  console.error("[metricas][ERR]", ...args);
}

async function incrementar(chave) {
  return db.tx(async (t) => {
    await t.none(
      `INSERT INTO metricas (chave, valor_numeric)
       VALUES ($1, 1)
       ON CONFLICT (chave)
       DO UPDATE SET valor_numeric = metricas.valor_numeric + 1,
                     atualizado_em = now()`,
      [chave]
    );
  });
}

async function obter(chave) {
  return db.oneOrNone(
    `SELECT valor_numeric, atualizado_em FROM metricas WHERE chave=$1`,
    [chave]
  );
}

/* ───── Endpoints ───── */

/**
 * Contar visita do APP
 * Mantém o mesmo nome da função/rota (contarVisita) por compatibilidade,
 * mas agora incrementa a chave 'acessos_app'.
 */
exports.contarVisita = async (_req, res) => {
  try {
    await incrementar("acessos_app");
    return res.status(204).end();
  } catch (e) {
    logErr("contarVisita:", e.message);
    return res.status(500).json({ error: "Falha ao contar visita" });
  }
};

/**
 * Retorna métricas públicas
 * - Apenas 'acessos_app'
 * - Fallback: se não existir 'acessos_app', tenta 'acessos_site' (legado)
 */
exports.getMetricasPublica = async (_req, res) => {
  try {
    let acessos = { valor_numeric: 0, atualizado_em: new Date().toISOString() };

    try {
      const app = await obter("acessos_app");
      if (app) {
        acessos = app;
      } else {
        // compat com bases antigas que só têm 'acessos_site'
        const site = await obter("acessos_site");
        if (site) acessos = site;
      }
    } catch (e) {
      logErr("Lendo acessos_app/site:", e.message);
    }

    return res.json({
      acessos_app: Number(acessos?.valor_numeric ?? 0),
      atualizado_em: new Date().toISOString(),
    });
  } catch (e) {
    logErr("getMetricasPublica FATAL:", e.stack || e.message);
    // Nunca derruba a página pública
    return res.json({
      acessos_app: 0,
      atualizado_em: new Date().toISOString(),
    });
  }
};
