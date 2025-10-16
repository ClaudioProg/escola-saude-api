// 📁 src/controllers/usuarioAdministradorController.js
const db = require("../db");

/* ---------------- utils ---------------- */
function toPerfilArray(perfil) {
  if (Array.isArray(perfil)) {
    return perfil.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
  }
  if (typeof perfil === "string") {
    return perfil.split(",").map((p) => p.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}

// opcional: se você já tem esse helper noutro arquivo, pode remover daqui
function traduzPgError(err) {
  // mapeia alguns erros comuns do Postgres para mensagens amigáveis
  if (!err) return { erro: "Erro desconhecido." };
  if (err.code === "23505") return { erro: "Registro duplicado." };
  if (err.code === "23503") return { erro: "Violação de integridade referencial." };
  if (err.code === "23514") return { erro: "Restrição de validação violada." };
  return { erro: err.message || "Erro de banco de dados." };
}

/* =============== LISTAR TODOS OS USUÁRIOS (ADMIN) =============== */
async function listarUsuarios(req, res) {
  try {
    const { rows } = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.cpf,
        u.email,
        u.registro,
        u.data_nascimento,
        u.perfil,
        u.unidade_id,
        u.escolaridade_id,
        u.cargo_id,
        u.deficiencia_id,
        -- nomes quando existirem nas tabelas de apoio (ajuste os nomes se forem diferentes)
        un.nome  AS unidade_nome,
        es.nome  AS escolaridade_nome,
        ca.nome  AS cargo_nome,
        de.nome  AS deficiencia_nome
      FROM usuarios u
      LEFT JOIN unidades       un ON un.id = u.unidade_id
      LEFT JOIN escolaridades  es ON es.id = u.escolaridade_id
      LEFT JOIN cargos         ca ON ca.id = u.cargo_id
      LEFT JOIN deficiencias   de ON de.id = u.deficiencia_id
      ORDER BY u.nome ASC
      `
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
      `
      SELECT
        u.id,
        u.nome,
        u.cpf,
        u.email,
        u.registro,
        u.data_nascimento,
        u.perfil,
        u.unidade_id,
        u.escolaridade_id,
        u.cargo_id,
        u.deficiencia_id,
        un.nome  AS unidade_nome,
        es.nome  AS escolaridade_nome,
        ca.nome  AS cargo_nome,
        de.nome  AS deficiencia_nome
      FROM usuarios u
      LEFT JOIN unidades       un ON un.id = u.unidade_id
      LEFT JOIN escolaridades  es ON es.id = u.escolaridade_id
      LEFT JOIN cargos         ca ON ca.id = u.cargo_id
      LEFT JOIN deficiencias   de ON de.id = u.deficiencia_id
      WHERE u.id = $1
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });
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
       RETURNING id, nome, cpf, email, registro, data_nascimento, perfil,
                 unidade_id, escolaridade_id, cargo_id, deficiencia_id`,
      values
    );

    if (rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });

    const u = rows[0];
    res.json({ ...u, perfil: toPerfilArray(u.perfil) });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    const payload = traduzPgError(err);
    const isClientErr = ["23505", "23514", "23503"].includes(err?.code);
    return res.status(isClientErr ? 400 : 500).json(payload);
  }
}

/* =============== EXCLUIR USUÁRIO (ADMIN) =============== */
async function excluirUsuario(req, res) {
  const { id } = req.params;
  const isAdministrador = toPerfilArray(req.usuario?.perfil).includes("administrador");

  if (!isAdministrador) return res.status(403).json({ erro: "Acesso negado." });

  try {
    const { rows } = await db.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, cpf, email, perfil",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });

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

/* =============== LISTAR INSTRUTORES (com métricas) =============== */
async function listarInstrutoresCore(_req, res) {
  try {
    const { rows } = await db.query(`
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
    `);

    const instrutores = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      eventosMinistrados: Number(r.eventos_ministrados) || 0,
      mediaAvaliacao: r.media_avaliacao !== null ? Number(r.media_avaliacao) : null,
      possuiAssinatura: !!r.possui_assinatura,
    }));

    res.json(instrutores);
  } catch (err) {
    console.error("❌ Erro ao listar instrutores:", err);
    res.status(500).json({ erro: "Erro ao listar instrutores." });
  }
}

const listarInstrutores = listarInstrutoresCore;
const listarInstrutor   = listarInstrutoresCore;
const listarinstrutor   = listarInstrutoresCore;

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

  if (!perfilCsv) return res.status(400).json({ erro: "Perfil inválido ou vazio." });

  try {
    const { rows } = await db.query(
      "UPDATE usuarios SET perfil = $1 WHERE id = $2 RETURNING id, nome, email, perfil",
      [perfilCsv, id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: "Usuário não encontrado." });
    const u = rows[0];
    res.json({ ...u, perfil: toPerfilArray(u.perfil) });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    res.status(500).json({ erro: "Erro ao atualizar perfil." });
  }
}

/* =============== RESUMO POR USUÁRIO (cursos ≥75% e certificados) =============== */
/* =============== RESUMO (cursos ≥75% e certificados) =============== */
async function getResumoUsuario(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  try {
    const sqlCursos75 = `
      WITH minhas_turmas AS (
        SELECT
          t.id              AS turma_id,
          t.data_inicio::date AS di_raw,
          t.data_fim::date    AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT mt.turma_id, (dt.data::date) AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT mt.turma_id, gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      pres AS (
        -- presença consolidada por dia
        SELECT p.turma_id, p.data_presenca::date AS d, BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
      agreg AS (
        SELECT
          mt.turma_id,
          MIN(db.d) AS di,
          MAX(db.d) AS df,
          COUNT(*)  AS total_encontros,
          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE) AS realizados,
          COUNT(*) FILTER (WHERE p.presente IS TRUE AND db.d <= CURRENT_DATE) AS presentes_passados
        FROM minhas_turmas mt
        JOIN datas_base   db ON db.turma_id = mt.turma_id
        LEFT JOIN pres     p ON p.turma_id  = mt.turma_id AND p.d = db.d
        GROUP BY mt.turma_id
      )
      SELECT
        COALESCE( COUNT(*) FILTER (
          WHERE (CURRENT_DATE > df)              -- turma encerrada
            AND total_encontros > 0
            AND (presentes_passados::numeric / total_encontros) >= 0.75
        ), 0)::int AS n
      FROM agreg;
    `;

    const sqlCerts = `
      SELECT COALESCE(COUNT(*)::int, 0) AS n
      FROM certificados
      WHERE usuario_id = $1 AND tipo = 'usuario';
    `;

    const [cursosQ, certsQ] = await Promise.all([
      db.query(sqlCursos75, [id]),
      db.query(sqlCerts,     [id]),
    ]);

    const cursos75 = Number(cursosQ?.rows?.[0]?.n || 0);
    const certificados = Number(certsQ?.rows?.[0]?.n || 0);

    // Por segurança: nunca reportar menos cursos que certificados (no seu fluxo, certificado implica ≥75%)
    const cursos_concluidos_75 = Math.max(cursos75, certificados);

    return res.json({
      cursos_concluidos_75,
      certificados_emitidos: certificados,
    });
  } catch (err) {
    console.error("❌ [getResumoUsuario] erro:", err);
    return res.status(500).json({ erro: "Erro ao obter resumo do usuário." });
  }
}

module.exports = {
  listarUsuarios,
  buscarUsuarioPorId,
  atualizarUsuario,
  excluirUsuario,
  listarInstrutores,
  listarInstrutor,
  listarinstrutor,
  atualizarPerfil,
  getResumoUsuario,          
};