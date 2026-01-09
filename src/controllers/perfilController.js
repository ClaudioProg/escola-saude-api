/* eslint-disable no-console */
// 📁 src/controllers/perfilController.js — PREMIUM (date-only safe, DB compat, validação, fallback de schema)
const dbMod = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

// Compat: alguns lugares exportam { pool, query }, outros exportam direto
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[perfilController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em perfilController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Helpers premium
   ──────────────────────────────────────────────────────────────── */
function setPerfilHeader(res, incompleto) {
  try {
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");
  } catch {}
}

function isMissingColumnOrRelation(err) {
  // 42703 = undefined_column, 42P01 = undefined_table
  const code = err?.code || err?.original?.code;
  return code === "42703" || code === "42P01";
}

function isYmd(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function normStr(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normId(v) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

function badRequest(res, msg) {
  return res.status(400).json({ erro: msg });
}

/* ────────────────────────────────────────────────────────────────
   GET /api/perfil/opcoes
   - tenta colunas "modernas" (is_active/display_order/sigla)
   - fallback sem quebrar base antiga
   ──────────────────────────────────────────────────────────────── */
async function listarOpcoesPerfil(req, res) {
  try {
    const fetchCargos = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM cargos
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, nome ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM cargos ORDER BY nome ASC`);
      }
    };

    const fetchUnidades = async () => {
      try {
        return await query(`SELECT id, nome, sigla FROM unidades ORDER BY nome ASC`);
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM unidades ORDER BY nome ASC`);
      }
    };

    const fetchGeneros = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM generos
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, id ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM generos ORDER BY nome ASC`);
      }
    };

    const fetchOrientacoes = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM orientacoes_sexuais
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, id ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM orientacoes_sexuais ORDER BY nome ASC`);
      }
    };

    const fetchCores = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM cores_racas
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, id ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM cores_racas ORDER BY nome ASC`);
      }
    };

    const fetchEscolaridades = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM escolaridades
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, id ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM escolaridades ORDER BY nome ASC`);
      }
    };

    const fetchDeficiencias = async () => {
      try {
        return await query(
          `SELECT id, nome, display_order
             FROM deficiencias
            WHERE is_active = TRUE
            ORDER BY display_order NULLS LAST, id ASC`
        );
      } catch (e) {
        if (!isMissingColumnOrRelation(e)) throw e;
        return await query(`SELECT id, nome FROM deficiencias ORDER BY nome ASC`);
      }
    };

    const [cargos, unidades, generos, orientacoes, cores, escolaridades, deficiencias] =
      await Promise.all([
        fetchCargos(),
        fetchUnidades(),
        fetchGeneros(),
        fetchOrientacoes(),
        fetchCores(),
        fetchEscolaridades(),
        fetchDeficiencias(),
      ]);

    // garante shape estável mesmo nos fallbacks
    const cargosRows = (cargos.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));
    const unidadesRows = (unidades.rows || []).map((x) => ({ ...x, sigla: x.sigla ?? null }));
    const generosRows = (generos.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));
    const orientRows = (orientacoes.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));
    const coresRows = (cores.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));
    const escolRows = (escolaridades.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));
    const defRows = (deficiencias.rows || []).map((x) => ({ ...x, display_order: x.display_order ?? null }));

    return res.json({
      cargos: cargosRows,
      unidades: unidadesRows,
      generos: generosRows,
      orientacoesSexuais: orientRows,
      coresRacas: coresRows,
      escolaridades: escolRows,
      deficiencias: defRows,
    });
  } catch (err) {
    console.error("listarOpcoesPerfil:", err?.message || err);
    return res.status(500).json({ erro: "Falha ao listar opções." });
  }
}

/* ────────────────────────────────────────────────────────────────
   GET /api/perfil/me
   - retorna date-only em YYYY-MM-DD sem fuso
   ──────────────────────────────────────────────────────────────── */
async function meuPerfil(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ erro: "Não autorizado" });

    const { rows } = await query(
      `
      SELECT id, nome, email, registro,
             cargo_id, unidade_id,
             to_char(data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
             genero_id, orientacao_sexual_id, cor_raca_id, escolaridade_id,
             deficiencia_id
        FROM usuarios
       WHERE id = $1
      `,
      [userId]
    );

    const u = rows?.[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    const incompleto = isPerfilIncompleto(u);
    setPerfilHeader(res, incompleto);

    return res.json({ ...u, perfil_incompleto: incompleto });
  } catch (err) {
    console.error("meuPerfil:", err?.message || err);
    return res.status(500).json({ erro: "Falha ao carregar perfil." });
  }
}

/* ────────────────────────────────────────────────────────────────
   PUT/PATCH /api/perfil/me
   - update parcial seguro
   - string vazia -> NULL
   - data_nascimento: exige YYYY-MM-DD ou NULL
   - ids: valida inteiro > 0 ou NULL
   ──────────────────────────────────────────────────────────────── */
async function atualizarMeuPerfil(req, res) {
  try {
    const userId = Number(req.user?.id);
    if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ erro: "Não autorizado" });

    const body = req.body || {};

    const registro = normStr(body.registro);

    const cargo_id = normId(body.cargo_id);
    const unidade_id = normId(body.unidade_id);

    const genero_id = normId(body.genero_id);
    const orientacao_sexual_id = normId(body.orientacao_sexual_id);
    const cor_raca_id = normId(body.cor_raca_id);
    const escolaridade_id = normId(body.escolaridade_id);
    const deficiencia_id = normId(body.deficiencia_id);

    // data_nascimento: aceita undefined (não altera), null (limpa), ou YYYY-MM-DD
    let data_nascimento = body.data_nascimento;
    if (data_nascimento === undefined) {
      // ok
    } else if (data_nascimento === null || data_nascimento === "") {
      data_nascimento = null;
    } else {
      data_nascimento = String(data_nascimento).trim();
      if (!isYmd(data_nascimento)) {
        return badRequest(res, "data_nascimento inválida. Use YYYY-MM-DD.");
      }
    }

    // Monta SET dinâmico
    const sets = [];
    const vals = [];
    const push = (col, val) => {
      sets.push(`${col} = $${vals.length + 1}`);
      vals.push(val);
    };

    // 👇 apenas fields presentes no payload (undefined = ignora)
    if (registro !== undefined) push("registro", registro);

    if (cargo_id !== undefined) push("cargo_id", cargo_id);
    if (unidade_id !== undefined) push("unidade_id", unidade_id);

    if (data_nascimento !== undefined) {
      // date-only safe: manda string YYYY-MM-DD ou null, banco converte
      push("data_nascimento", data_nascimento);
      // força cast no SQL depois (ver abaixo)
      sets[sets.length - 1] = `data_nascimento = $${vals.length}::date`;
    }

    if (genero_id !== undefined) push("genero_id", genero_id);
    if (orientacao_sexual_id !== undefined) push("orientacao_sexual_id", orientacao_sexual_id);
    if (cor_raca_id !== undefined) push("cor_raca_id", cor_raca_id);
    if (escolaridade_id !== undefined) push("escolaridade_id", escolaridade_id);
    if (deficiencia_id !== undefined) push("deficiencia_id", deficiencia_id);

    if (!sets.length) return res.status(400).json({ erro: "Nada para atualizar." });

    vals.push(userId);

    const { rows } = await query(
      `
      UPDATE usuarios
         SET ${sets.join(", ")}
       WHERE id = $${vals.length}
   RETURNING id, nome, email, registro,
             cargo_id, unidade_id,
             to_char(data_nascimento::date, 'YYYY-MM-DD') AS data_nascimento,
             genero_id, orientacao_sexual_id,
             cor_raca_id, escolaridade_id, deficiencia_id
      `,
      vals
    );

    const u = rows?.[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    const incompleto = isPerfilIncompleto(u);
    setPerfilHeader(res, incompleto);

    return res.json({ ...u, perfil_incompleto: incompleto });
  } catch (err) {
    // melhora mensagem em dev, mas não vaza detalhes em produção
    console.error("atualizarMeuPerfil:", err?.message || err);
    return res.status(500).json({
      erro: "Falha ao atualizar perfil.",
      detalhe: IS_DEV ? err?.message : undefined,
    });
  }
}

module.exports = { listarOpcoesPerfil, meuPerfil, atualizarMeuPerfil };
