// 📁 src/controllers/perfilController.js
const db = require("../db");
const { isPerfilIncompleto } = require("../utils/perfil");

// GET /api/perfil/opcoes
async function listarOpcoesPerfil(req, res) {
  try {
    const [
      cargos,
      unidades,
      generos,
      orientacoes,
      cores,
      escolaridades,
      deficiencias,
    ] = await Promise.all([
      db.query(
        `SELECT id, nome, display_order
           FROM cargos
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, nome ASC`
      ),
      db.query(
        `SELECT id, nome, sigla
           FROM unidades
          ORDER BY nome ASC`
      ),
      db.query(
        `SELECT id, nome, display_order
           FROM generos
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC`
      ),
      db.query(
        `SELECT id, nome, display_order
           FROM orientacoes_sexuais
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC`
      ),
      db.query(
        `SELECT id, nome, display_order
           FROM cores_racas
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC`
      ),
      db.query(
        `SELECT id, nome, display_order
           FROM escolaridades
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC`
      ),
      db.query(
        `SELECT id, nome, display_order
           FROM deficiencias
          WHERE is_active = TRUE
          ORDER BY display_order NULLS LAST, id ASC`
      ),
    ]);

    res.json({
      cargos: cargos.rows,
      unidades: unidades.rows,
      generos: generos.rows,
      orientacoesSexuais: orientacoes.rows,
      coresRacas: cores.rows,
      escolaridades: escolaridades.rows,
      deficiencias: deficiencias.rows,
    });
  } catch (err) {
    console.error("listarOpcoesPerfil:", err);
    res.status(500).json({ erro: "Falha ao listar opções." });
  }
}

// GET /api/perfil/me
async function meuPerfil(req, res) {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(
      `
      SELECT id, nome, email, registro,
             cargo_id, unidade_id, data_nascimento, genero_id,
             orientacao_sexual_id, cor_raca_id, escolaridade_id,
             deficiencia_id
        FROM usuarios
       WHERE id = $1
      `,
      [userId]
    );

    const u = rows[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    const incompleto = isPerfilIncompleto(u);
    res.json({ ...u, perfil_incompleto: incompleto });
  } catch (err) {
    console.error("meuPerfil:", err);
    res.status(500).json({ erro: "Falha ao carregar perfil." });
  }
}

// PUT/PATCH /api/perfil/me
async function atualizarMeuPerfil(req, res) {
  try {
    const userId = req.user.id;

    // Aceita campos parciais; valores ausentes ficam como estão.
    // Se vier string vazia, gravamos como NULL.
    const body = req.body || {};
    const norm = (v) => (v === "" ? null : v);

    const registro              = norm(body.registro);
    const cargo_id              = body.cargo_id              != null ? Number(body.cargo_id)              : undefined;
    const unidade_id            = body.unidade_id            != null ? Number(body.unidade_id)            : undefined;
    const data_nascimento       = norm(body.data_nascimento);
    const genero_id             = body.genero_id             != null ? Number(body.genero_id)             : undefined;
    const orientacao_sexual_id  = body.orientacao_sexual_id  != null ? Number(body.orientacao_sexual_id)  : undefined;
    const cor_raca_id           = body.cor_raca_id           != null ? Number(body.cor_raca_id)           : undefined;
    const escolaridade_id       = body.escolaridade_id       != null ? Number(body.escolaridade_id)       : undefined;
    const deficiencia_id        = body.deficiencia_id        != null ? Number(body.deficiencia_id)        : undefined;

    // Monta SET dinâmico apenas com colunas presentes no payload
    const sets = [];
    const vals = [];
    const push = (col, val) => { sets.push(`${col} = $${vals.length + 1}`); vals.push(val); };

    if (registro !== undefined)             push("registro", registro);
    if (cargo_id !== undefined)             push("cargo_id", cargo_id ?? null);
    if (unidade_id !== undefined)           push("unidade_id", unidade_id ?? null);
    if (data_nascimento !== undefined)      push("data_nascimento", data_nascimento ?? null);
    if (genero_id !== undefined)            push("genero_id", genero_id ?? null);
    if (orientacao_sexual_id !== undefined) push("orientacao_sexual_id", orientacao_sexual_id ?? null);
    if (cor_raca_id !== undefined)          push("cor_raca_id", cor_raca_id ?? null);
    if (escolaridade_id !== undefined)      push("escolaridade_id", escolaridade_id ?? null);
    if (deficiencia_id !== undefined)       push("deficiencia_id", deficiencia_id ?? null);

    if (sets.length === 0) {
      return res.status(400).json({ erro: "Nada para atualizar." });
    }

    vals.push(userId);

    const { rows } = await db.query(
      `
      UPDATE usuarios
         SET ${sets.join(", ")}
       WHERE id = $${vals.length}
   RETURNING id, nome, email, registro, data_nascimento,
             cargo_id, unidade_id, genero_id, orientacao_sexual_id,
             cor_raca_id, escolaridade_id, deficiencia_id
      `,
      vals
    );

    const u = rows[0];
    if (!u) return res.status(404).json({ erro: "Usuário não encontrado." });

    const incompleto = isPerfilIncompleto(u);
    res.json({ ...u, perfil_incompleto: incompleto });
  } catch (err) {
    console.error("atualizarMeuPerfil:", err);
    res.status(500).json({ erro: "Falha ao atualizar perfil." });
  }
}

module.exports = { listarOpcoesPerfil, meuPerfil, atualizarMeuPerfil };
