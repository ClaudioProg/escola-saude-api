// 📁 src/controllers/usuarioAdministradorController.js
/* eslint-disable no-console */
"use strict";

const rawDb = require("../db");
const db = rawDb?.db ?? rawDb;

/* ─────────────────────────────────────────────────────────────
   Helpers / Normalizações
───────────────────────────────────────────────────────────── */
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
function uniq(arr) {
  return Array.from(new Set(arr));
}
function toPerfilCsv(perfil) {
  return uniq(toPerfilArray(perfil)).join(",");
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}
function isAdmin(perfil) {
  return toPerfilArray(perfil).includes("administrador");
}
function normStr(v) {
  return String(v || "").trim();
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

// Map simples de erros PG
function traduzPgError(err) {
  if (!err) return { erro: "Erro desconhecido." };
  if (err.code === "23505") return { erro: "Registro duplicado." };
  if (err.code === "23503") return { erro: "Violação de integridade referencial." };
  if (err.code === "23514") return { erro: "Restrição de validação violada." };
  return { erro: err.message || "Erro de banco de dados." };
}

/* ─────────────────────────────────────────────────────────────
   LISTAR TODOS (ADMIN) — com filtros/paginação opcionais
   GET /api/usuarios?q=&perfil=&unidade_id=&cargo_nome=&page=&pageSize=
   Retorna:
     - { meta, data } (contrato atual)
     - + aliases: { ok, usuarios, items, rows } (compat)
───────────────────────────────────────────────────────────── */
async function listarUsuarios(req, res) {
  try {
    const page = clamp(numOrNull(req.query.page) ?? 1, 1, 1000000);
    const pageSize = clamp(numOrNull(req.query.pageSize) ?? 50, 1, 200);

    const q = normStr(req.query.q);
    const unidadeId = numOrNull(req.query.unidade_id);
    const cargoNome = normStr(req.query.cargo_nome); // ✅ novo (server-side filter)
    const perfisFiltro = toPerfilArray(req.query.perfil);

    const where = [];
    const params = [];
    let i = 1;

    if (q) {
      where.push(`(u.nome ILIKE $${i} OR u.email ILIKE $${i} OR u.cpf ILIKE $${i} OR u.registro ILIKE $${i})`);
      params.push(`%${q}%`);
      i++;
    }

    if (unidadeId != null) {
      where.push(`u.unidade_id = $${i++}`);
      params.push(unidadeId);
    }

    // ✅ filtro por cargo (nome) — precisa do JOIN no COUNT também
    if (cargoNome && cargoNome !== "todos") {
      where.push(`ca.nome = $${i++}`);
      params.push(cargoNome);
    }

    if (perfisFiltro.length) {
      const ors = perfisFiltro.map((r) => {
        params.push(`%${r}%`);
        return `LOWER(u.perfil) LIKE $${i++}`;
      });
      where.push(`(${ors.join(" OR ")})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ TOTAL (precisa dos JOINs usados nos filtros)
    const totalQ = await db.query(
      `
      SELECT COUNT(*)::int AS n
      FROM usuarios u
      LEFT JOIN cargos ca ON ca.id = u.cargo_id
      ${whereSql}
      `,
      params
    );

    const total = totalQ.rows?.[0]?.n || 0;
    const offset = (page - 1) * pageSize;

    // página
    const rowsQ = await db.query(
      `
      SELECT
        u.id,
        u.nome,
        u.cpf,
        u.email,
        u.registro,
        u.data_nascimento,
        u.perfil,           -- CSV por compat
        u.unidade_id,
        u.escolaridade_id,
        u.cargo_id,
        u.deficiencia_id,
        un.sigla AS unidade_sigla,
        un.nome  AS unidade_nome,
        es.nome  AS escolaridade_nome,
        ca.nome  AS cargo_nome,
        de.nome  AS deficiencia_nome
      FROM usuarios u
      LEFT JOIN unidades       un ON un.id = u.unidade_id
      LEFT JOIN escolaridades  es ON es.id = u.escolaridade_id
      LEFT JOIN cargos         ca ON ca.id = u.cargo_id
      LEFT JOIN deficiencias   de ON de.id = u.deficiencia_id
      ${whereSql}
      ORDER BY u.nome ASC
      LIMIT $${i++} OFFSET $${i++}
      `,
      [...params, pageSize, offset]
    );

    const data = rowsQ.rows || [];
    const pages = Math.max(1, Math.ceil(total / pageSize));

    // ✅ Compat premium: alguns fronts esperam `usuarios` ou array
    res.setHeader("X-Usuarios-Shape", "meta+data+usuarios");

    return res.json({
      ok: true,
      meta: { total, page, pageSize, pages },
      data,

      // aliases (compat total)
      usuarios: data,
      items: data,
      rows: data,
    });
  } catch (err) {
    console.error("❌ Erro ao listar usuários:", err);
    return res.status(500).json({ erro: "Erro ao listar usuários." });
  }
}

/* ─────────────────────────────────────────────────────────────
   BUSCAR POR ID (ADMIN ou o próprio)
   GET /api/usuarios/:id
───────────────────────────────────────────────────────────── */
async function buscarUsuarioPorId(req, res) {
  const { id } = req.params;
  const solicitante = req.user;

  if (!isAdmin(solicitante?.perfil) && Number(id) !== Number(solicitante?.id)) {
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
        un.sigla AS unidade_sigla,
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

    if (!rows.length) return res.status(404).json({ erro: "Usuário não encontrado." });
    const u = rows[0];
    return res.json({ ok: true, data: { ...u, perfil: toPerfilArray(u.perfil) } });
  } catch (err) {
    console.error("❌ Erro ao buscar usuário:", err);
    return res.status(500).json({ erro: "Erro ao buscar usuário." });
  }
}

/* ─────────────────────────────────────────────────────────────
   ATUALIZAR (ADMIN ou o próprio)
   PATCH/PUT /api/usuarios/:id
───────────────────────────────────────────────────────────── */
async function atualizarUsuario(req, res) {
  const { id } = req.params;
  const { nome, email, perfil } = req.body;

  const solicitante = req.user;
  const ehAdmin = isAdmin(solicitante?.perfil);

  if (!ehAdmin && Number(id) !== Number(solicitante?.id)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const updates = [];
  const vals = [];
  let i = 1;

  if (nome !== undefined) {
    const n = normStr(nome);
    if (!n) return res.status(400).json({ erro: "Nome é obrigatório." });
    updates.push(`nome = $${i++}`);
    vals.push(n);
  }

  if (email !== undefined) {
    const e = normStr(email);
    if (!e || !isEmail(e)) return res.status(400).json({ erro: "E-mail inválido." });
    updates.push(`email = $${i++}`);
    vals.push(e);
  }

  if (perfil !== undefined) {
    if (!ehAdmin) {
      return res.status(403).json({ erro: "Apenas administradores podem alterar perfil." });
    }
    const perfisValidos = ["usuario", "instrutor", "administrador"];
    const csv = toPerfilCsv(toPerfilArray(perfil).filter((p) => perfisValidos.includes(p)));
    if (!csv) return res.status(400).json({ erro: "Perfil inválido ou vazio." });
    updates.push(`perfil = $${i++}`);
    vals.push(csv);
  }

  if (!updates.length) {
    return res.status(400).json({ erro: "Nenhum campo válido para atualizar." });
  }

  vals.push(id);

  try {
    const { rows } = await db.query(
      `
      UPDATE usuarios
         SET ${updates.join(", ")}, atualizado_em = NOW()
       WHERE id = $${i}
       RETURNING id, nome, cpf, email, registro, data_nascimento, perfil,
                 unidade_id, escolaridade_id, cargo_id, deficiencia_id
      `,
      vals
    );

    if (!rows.length) return res.status(404).json({ erro: "Usuário não encontrado." });
    const u = rows[0];
    return res.json({ ok: true, data: { ...u, perfil: toPerfilArray(u.perfil) } });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    const payload = traduzPgError(err);
    const isClientErr = ["23505", "23514", "23503"].includes(err?.code);
    return res.status(isClientErr ? 400 : 500).json(payload);
  }
}

/* ─────────────────────────────────────────────────────────────
   EXCLUIR (ADMIN)
   DELETE /api/usuarios/:id
───────────────────────────────────────────────────────────── */
async function excluirUsuario(req, res) {
  const { id } = req.params;
  if (!isAdmin(req.user?.perfil)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  try {
    const { rows } = await db.query(
      "DELETE FROM usuarios WHERE id = $1 RETURNING id, nome, cpf, email, perfil",
      [id]
    );
    if (!rows.length) return res.status(404).json({ erro: "Usuário não encontrado." });

    const u = rows[0];
    return res.json({
      ok: true,
      mensagem: "Usuário excluído com sucesso.",
      usuario: { ...u, perfil: toPerfilArray(u.perfil) },
    });
  } catch (err) {
    console.error("❌ Erro ao excluir usuário:", err);
    return res.status(500).json({ erro: "Erro ao excluir usuário." });
  }
}

/* ─────────────────────────────────────────────────────────────
   LISTAR INSTRUTORES (com métricas)
───────────────────────────────────────────────────────────── */
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
              WHEN 'Otimo'  THEN 5
              WHEN 'Bom'    THEN 4
              WHEN 'Regular' THEN 3
              WHEN 'Ruim'   THEN 2
              WHEN 'Péssimo' THEN 1
              WHEN 'Pessimo' THEN 1
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

    const instrutores = (rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      eventosMinistrados: Number(r.eventos_ministrados) || 0,
      mediaAvaliacao: r.media_avaliacao !== null ? Number(r.media_avaliacao) : null,
      possuiAssinatura: !!r.possui_assinatura,
    }));

    return res.json({ ok: true, data: instrutores, instrutores });
  } catch (err) {
    console.error("❌ Erro ao listar instrutores:", err);
    return res.status(500).json({ erro: "Erro ao listar instrutores." });
  }
}

const listarInstrutores = listarInstrutoresCore;
const listarInstrutor = listarInstrutoresCore;
const listarinstrutor = listarInstrutoresCore;

/* ─────────────────────────────────────────────────────────────
   ATUALIZAR PERFIL (apenas ADMIN)
   PATCH /api/usuarios/:id/perfil
───────────────────────────────────────────────────────────── */
async function atualizarPerfil(req, res) {
  const { id } = req.params;
  const { perfil } = req.body;

  if (!isAdmin(req.user?.perfil)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const perfisValidos = ["usuario", "instrutor", "administrador"];
  const perfilCsv = toPerfilCsv(toPerfilArray(perfil).filter((p) => perfisValidos.includes(p)));
  if (!perfilCsv) return res.status(400).json({ erro: "Perfil inválido ou vazio." });

  try {
    const { rows } = await db.query(
      "UPDATE usuarios SET perfil = $1, atualizado_em=NOW() WHERE id = $2 RETURNING id, nome, email, perfil",
      [perfilCsv, id]
    );
    if (!rows.length) return res.status(404).json({ erro: "Usuário não encontrado." });
    const u = rows[0];
    return res.json({ ok: true, data: { ...u, perfil: toPerfilArray(u.perfil) } });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    return res.status(500).json({ erro: "Erro ao atualizar perfil." });
  }
}

/* ─────────────────────────────────────────────────────────────
   RESUMO POR USUÁRIO (cursos ≥75% e certificados)
   GET /api/usuarios/:id/resumo
───────────────────────────────────────────────────────────── */
async function getResumoUsuario(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ erro: "ID inválido." });

  try {
    const sqlCursos75 = `
      WITH minhas_turmas AS (
        SELECT t.id AS turma_id, t.data_inicio::date AS di_raw, t.data_fim::date AS df_raw
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        SELECT mt.turma_id, (dt.data::date) AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        SELECT mt.turma_id, gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      pres AS (
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
        JOIN datas_base db ON db.turma_id = mt.turma_id
        LEFT JOIN pres p ON p.turma_id = mt.turma_id AND p.d = db.d
        GROUP BY mt.turma_id
      )
      SELECT
        COALESCE(COUNT(*) FILTER (
          WHERE (CURRENT_DATE > df)
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
      db.query(sqlCerts, [id]),
    ]);

    const cursos75 = Number(cursosQ?.rows?.[0]?.n || 0);
    const certificados = Number(certsQ?.rows?.[0]?.n || 0);
    const cursos_concluidos_75 = Math.max(cursos75, certificados);

    return res.json({
      ok: true,
      data: {
        cursos_concluidos_75,
        certificados_emitidos: certificados,
      },
    });
  } catch (err) {
    console.error("❌ [getResumoUsuario] erro:", err);
    return res.status(500).json({ erro: "Erro ao obter resumo do usuário." });
  }
}

/* ─────────────────────────────────────────────────────────────
   LISTAR AVALIADORES ELEGÍVEIS
   GET /api/usuarios/avaliadores?roles=instrutor,administrador
───────────────────────────────────────────────────────────── */
async function listarAvaliadoresElegiveis(req, res) {
  try {
    const rolesQuery = String(req.query.roles || "instrutor,administrador")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const params = [];
    let i = 1;
    let whereSql = "";

    if (rolesQuery.length) {
      const ors = rolesQuery.map((role) => {
        params.push(`%${role}%`);
        return `LOWER(u.perfil) LIKE $${i++}`;
      });
      whereSql = `WHERE ${ors.join(" OR ")}`;
    }

    const { rows } = await db.query(
      `
      SELECT u.id, u.nome, u.email, u.perfil
      FROM usuarios u
      ${whereSql}
      ORDER BY u.nome ASC
      `,
      params
    );

    const data = (rows || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: toPerfilArray(u.perfil),
    }));

    return res.json({ ok: true, data, avaliadores: data });
  } catch (err) {
    console.error("❌ Erro ao listar avaliadores elegíveis:", err);
    return res.status(500).json({ erro: "Erro ao listar avaliadores." });
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
  listarAvaliadoresElegiveis,
};
