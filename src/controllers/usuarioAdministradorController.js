// src/controllers/usuarioAdministradorController.js
const db = require("../db");

/* util: normaliza vetor/CSV de perfis para array minúsculo */
function toPerfilArray(perfil) {
  if (Array.isArray(perfil)) {
    return perfil.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
  }
  if (typeof perfil === "string") {
    return perfil
      .split(",")
      .map((p) => p.toLowerCase().trim())
      .filter(Boolean);
  }
  return [];
}

/* =============== LISTAR TODOS OS USUÁRIOS (ADMIN) =============== */
async function listarUsuarios(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT id, nome, cpf, email, perfil FROM usuarios ORDER BY nome ASC"
    );
    const data = rows.map((u) => ({ ...u, perfil: toPerfilArray(u.perfil) }));
    res.json(data);
  } catch (err) {
    console.error("❌ Erro ao listar usuários:", err);
    res.status(500).json({ erro: "Erro ao listar usuários." });
  }
}

/* ======= BUSCAR USUÁRIO POR ID (ADMIN OU O PRÓPRIO) ======= */
async function buscarUsuarioPorId(req, res) {
  const { id } = req.params;
  const solicitante = req.usuario;
  const isAdministrador = toPerfilArray(solicitante?.perfil).includes("administrador");

  if (!isAdministrador && Number(id) !== Number(solicitante?.id)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  try {
    const { rows } = await db.query(
      "SELECT id, nome, cpf, email, perfil FROM usuarios WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }
    const u = rows[0];
    res.json({ ...u, perfil: toPerfilArray(u.perfil) });
  } catch (err) {
    console.error("❌ Erro ao buscar usuário:", err);
    res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
}

/* ======= ATUALIZAR USUÁRIO (ADMIN OU O PRÓPRIO) ======= */
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const { nome, email, perfil } = req.body;

  const solicitante = req.usuario;
  const isAdministrador = toPerfilArray(solicitante?.perfil).includes("administrador");

  if (!isAdministrador && Number(id) !== Number(solicitante?.id)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  if (!nome || !email) {
    return res.status(400).json({ erro: "Nome e e-mail são obrigatórios." });
  }

  // Só admin pode alterar perfil
  let perfilFinalCsv;
  if (perfil !== undefined && isAdministrador) {
    const perfilValido = ["usuario", "instrutor", "administrador"];
    const arr = toPerfilArray(perfil).filter((p) => perfilValido.includes(p));
    perfilFinalCsv = arr.join(",");
  }

  try {
    // Monta query dinamicamente
    const sets = ["nome = $1", "email = $2"];
    const values = [nome, email];
    let idx = 3;

    if (perfilFinalCsv !== undefined) {
      sets.push(`perfil = $${idx++}`);
      values.push(perfilFinalCsv);
    }

    values.push(id);

    const { rows } = await db.query(
      `UPDATE usuarios
         SET ${sets.join(", ")}
       WHERE id = $${idx}
       RETURNING id, nome, cpf, email, perfil`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    const u = rows[0];
    res.json({ ...u, perfil: toPerfilArray(u.perfil) });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    res.status(500).json({ erro: "Erro ao atualizar usuário." });
  }
}

/* =============== EXCLUIR USUÁRIO (ADMIN) =============== */
async function excluirUsuario(req, res) {
  const { id } = req.params;
  const isAdministrador = toPerfilArray(req.usuario?.perfil).includes("administrador");

  if (!isAdministrador) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  try {
    const { rows } = await db.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, cpf, email, perfil",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }
    const u = rows[0];
    res.json({
      mensagem: "Usuário excluído com sucesso.",
      usuario: { ...u, perfil: toPerfilArray(u.perfil) },
    });
  } catch (err) {
    console.error("❌ Erro ao excluir usuário:", err);
    res.status(500).json({ erro: "Erro ao excluir usuário." });
  }
}

/* =============== LISTAR INSTRUTORES ===============
   - inclui:
     a) quem tem perfil contendo 'instrutor'
     b) e/ou quem já ministrou algum evento
   - retorna métricas agregadas quando existirem
*/
async function listarInstrutoresCore(req, res) {
  try {
    const { rows } = await db.query(
      `
      WITH instrutores_base AS (
        SELECT DISTINCT u.id, u.nome, u.email
        FROM usuarios u
        LEFT JOIN evento_instrutor ei ON ei.instrutor_id = u.id
        WHERE LOWER(u.perfil) LIKE '%instrutor%'
           OR ei.instrutor_id IS NOT NULL
      )
      SELECT
        b.id,
        b.nome,
        b.email,
        COALESCE(e_stats.eventos_ministrados, 0) AS eventos_ministrados,
        e_stats.media_avaliacao,
        (s.id IS NOT NULL) AS possui_assinatura
      FROM instrutores_base b
      LEFT JOIN (
        SELECT
          u.id AS uid,
          COUNT(DISTINCT ei.evento_id) AS eventos_ministrados,
          ROUND(AVG(
            CASE a.desempenho_instrutor
              WHEN 'Ótimo'  THEN 5
              WHEN 'Bom'    THEN 4
              WHEN 'Regular'THEN 3
              WHEN 'Ruim'   THEN 2
              WHEN 'Péssimo'THEN 1
              ELSE NULL
            END
          )::numeric, 1) AS media_avaliacao
        FROM usuarios u
        LEFT JOIN evento_instrutor ei ON ei.instrutor_id = u.id
        LEFT JOIN turmas t ON t.evento_id = ei.evento_id
        LEFT JOIN avaliacoes a ON a.turma_id = t.id AND a.instrutor_id = u.id
        GROUP BY u.id
      ) e_stats ON e_stats.uid = b.id
      LEFT JOIN assinaturas s ON s.usuario_id = b.id
      ORDER BY b.nome ASC;
      `
    );

    const instrutores = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      eventosMinistrados: Number(r.eventos_ministrados) || 0,
      mediaAvaliacao: r.media_avaliacao !== null ? Number(r.media_avaliacao) : null, // ✅ fix
      possuiAssinatura: !!r.possui_assinatura,
    }));

    res.json(instrutores);
  } catch (err) {
    console.error("❌ Erro ao listar instrutores:", err);
    res.status(500).json({ erro: "Erro ao listar instrutores." });
  }
}

/* ===== aliases para compatibilidade com nomes usados no router ===== */
const listarInstrutores = listarInstrutoresCore;   // plural
const listarInstrutor   = listarInstrutoresCore;   // singular
const listarinstrutor   = listarInstrutoresCore;   // caso o router tenha ficado minúsculo

/* =============== ATUALIZAR PERFIL (ADMIN) =============== */
async function atualizarPerfil(req, res) {
  const { id } = req.params;
  const { perfil } = req.body;

  if (!toPerfilArray(req.usuario?.perfil).includes("administrador")) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const perfilValido = ["usuario", "instrutor", "administrador"];
  const arr = toPerfilArray(perfil).filter((p) => perfilValido.includes(p));
  const perfilCsv = arr.join(",");

  if (!perfilCsv) {
    return res.status(400).json({ erro: "Perfil inválido ou vazio." });
  }

  try {
    const { rows } = await db.query(
      "UPDATE usuarios SET perfil = $1 WHERE id = $2 RETURNING id, nome, email, perfil",
      [perfilCsv, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }
    const u = rows[0];
    res.json({ ...u, perfil: toPerfilArray(u.perfil) });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    res.status(500).json({ erro: "Erro ao atualizar perfil." });
  }
}

module.exports = {
  listarUsuarios,
  buscarUsuarioPorId,
  atualizarUsuario,
  excluirUsuario,
  // instrutores (múltiplos aliases p/ evitar crash por nome diferente no router)
  listarInstrutores,
  listarInstrutor,
  listarinstrutor,
  atualizarPerfil,
};
