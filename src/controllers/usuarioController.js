// ✅ src/controllers/usuarioController.js (UNIFICADO • singular • premium)
/* eslint-disable no-console */
"use strict";

/* ──────────────────────────────────────────────────────────────
   DB adapter resiliente
   - aceita: module.exports = db
   - ou:     module.exports = { db, query, getClient }
────────────────────────────────────────────────────────────── */
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;
const query = dbModule?.query ?? db?.query?.bind?.(db);
const getClient = dbModule?.getClient ?? null;

/* ──────────────────────────────────────────────────────────────
   Deps públicas (auth/email)
────────────────────────────────────────────────────────────── */
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { send: enviarEmail } = require("../services/mailer");

/* ──────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */
// Base do Frontend para links de e-mail (Vercel em prod; localhost no dev)
const FRONTEND_URL_STATIC =
  (process.env.FRONTEND_URL && String(process.env.FRONTEND_URL).trim()) ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173");

// JWT extras opcionais (não quebra se ausentes)
const JWT_ISS = process.env.JWT_ISSUER || undefined;
const JWT_AUD = process.env.JWT_AUDIENCE || undefined;

/* ──────────────────────────────────────────────────────────────
   Regex / Regras
────────────────────────────────────────────────────────────── */
const SENHA_FORTE_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const REGISTRO_MASK_RE = /^\d{2}\.\d{3}-\d$/; // ex.: 28.053-7 (opcional)

const PERFIS_VALIDOS = ["usuario", "instrutor", "administrador"];

const REQUIRED_PROFILE_FIELDS = [
  "cargo_id",
  "unidade_id",
  "genero_id",
  "orientacao_sexual_id",
  "cor_raca_id",
  "escolaridade_id",
  "deficiencia_id",
  "data_nascimento",
];

/* ──────────────────────────────────────────────────────────────
   Helpers / Normalizações (unificados)
────────────────────────────────────────────────────────────── */
function normStr(v) {
  return String(v || "").trim();
}
function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}
function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function normNome(v) {
  return String(v || "").trim();
}
function toDateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return DATE_ONLY_RE.test(s) ? s : "";
}
function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}
function isEmail(v) {
  return EMAIL_RE.test(String(v || "").trim());
}

/** string CSV ou array -> array padronizado */
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
function isAdmin(perfil) {
  return toPerfilArray(perfil).includes("administrador");
}

/** Array -> CSV sem "usuario"; string/undefined -> "usuario" por padrão */
function toPerfilString(perfil) {
  if (Array.isArray(perfil)) {
    const arr = perfil.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
    const semUsuario = arr.filter((p) => p !== "usuario");
    const finalArr = semUsuario.length ? semUsuario : ["usuario"];
    return finalArr.join(",");
  }
  return String(perfil || "usuario").toLowerCase().trim() || "usuario";
}
/** CSV -> array minúsculo, sem vazios */
function perfilToArray(perfilStr) {
  return String(perfilStr || "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/** Sempre formata o registro como 00.000-0 (usa somente os 6 primeiros dígitos) */
function toRegistroMasked(v) {
  const d = onlyDigits(v).slice(0, 6);
  if (d.length !== 6) return "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}-${d.slice(5)}`;
}

function camposFaltantes(u = {}) {
  return REQUIRED_PROFILE_FIELDS.filter((k) => u[k] === null || u[k] === undefined || u[k] === "");
}
function isPerfilIncompleto(u = {}) {
  return camposFaltantes(u).length > 0;
}

/** Mapeia constraint -> campo provável (para 23514) */
const CHECK_TO_FIELD = {
  chk_cpf_valido: "cpf",
  chk_data_nascimento: "data_nascimento",
  chk_registro: "registro",
};

/** Erros PG -> mensagens amigáveis (unificado) */
function traduzPgError(err) {
  // (1) Variante simples (admin) + variante rica (público) — retorna sempre { message|erro, fieldErrors? }
  const base = { message: "Erro ao processar solicitação.", fieldErrors: {} };
  if (!err) return { ...base, erro: "Erro desconhecido." };

  const code = err?.code;

  if (code === "23505") {
    const c = String(err.constraint || "").toLowerCase();
    const detail = String(err.detail || "").toLowerCase();
    if (c.includes("cpf") || detail.includes("cpf")) {
      return { message: "CPF já cadastrado.", erro: "Registro duplicado.", fieldErrors: { cpf: "Este CPF já está em uso." } };
    }
    if (c.includes("email") || detail.includes("email")) {
      return { message: "E-mail já cadastrado.", erro: "Registro duplicado.", fieldErrors: { email: "Este e-mail já está em uso." } };
    }
    return { ...base, erro: "Registro duplicado.", message: "Registro já existente." };
  }

  if (code === "23502") {
    const col = err?.column || "";
    const fe = {};
    if (col) fe[col] = "Campo obrigatório.";
    return { ...base, erro: "Campo obrigatório.", message: "Há campos obrigatórios não preenchidos.", fieldErrors: fe };
  }

  if (code === "22P02") {
    const msg = String(err.message || "").toLowerCase();
    const fe = {};
    if (msg.includes("date")) fe.data_nascimento = "Data inválida.";
    return { ...base, erro: "Valor inválido.", message: "Valor inválido em um ou mais campos.", fieldErrors: fe };
  }

  if (code === "23514") {
    const check = String(err.constraint || "").toLowerCase();
    for (const k in CHECK_TO_FIELD) {
      if (check.includes(k)) {
        const campo = CHECK_TO_FIELD[k];
        const fieldErrors = {};
        fieldErrors[campo] =
          campo === "registro" ? "Formato inválido. Use 00.000-0." : "Valor inválido.";
        return {
          message: "Algum campo não atende às regras de validação.",
          erro: "Restrição de validação violada.",
          fieldErrors,
        };
      }
    }
    return { ...base, erro: "Restrição de validação violada.", message: "Algum campo não atende às regras de validação." };
  }

  if (code === "23503") {
    const d = String(err.detail || "").toLowerCase();
    const fieldErrors = {};
    ["unidade_id", "cargo_id", "genero_id", "orientacao_sexual_id", "cor_raca_id", "escolaridade_id", "deficiencia_id"].forEach(
      (k) => {
        if (d.includes(k)) fieldErrors[k] = "ID inexistente na referência.";
      }
    );
    return { message: "Alguma referência informada não existe.", erro: "Violação de integridade referencial.", fieldErrors };
  }

  if (code === "42703") {
    return { ...base, erro: "Erro de configuração no servidor.", message: "Erro de configuração no servidor." };
  }

  return { ...base, erro: err.message || "Erro de banco de dados." };
}

/** Verifica se um id existe em uma tabela (FK friendly) */
async function assertExists(table, id, field = "id") {
  if (id == null) return true;
  const r = await db.query(`SELECT 1 FROM ${table} WHERE ${field} = $1 LIMIT 1`, [id]);
  return r.rowCount > 0;
}

/** Valida conjunto de campos do perfil complementar e retorna {ok, fieldErrors, message} */
async function validarPerfilComplementar(payload) {
  const {
    unidade_id,
    cargo_id,
    genero_id,
    orientacao_sexual_id,
    cor_raca_id,
    escolaridade_id,
    deficiencia_id,
    data_nascimento,
    registro,
  } = payload;

  const fieldErrors = {};

  // obrigatórios
  const obrig = {
    unidade_id,
    cargo_id,
    genero_id,
    orientacao_sexual_id,
    cor_raca_id,
    escolaridade_id,
    deficiencia_id,
    data_nascimento,
  };
  Object.entries(obrig).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") fieldErrors[k] = "Campo obrigatório.";
  });

  // data
  if (data_nascimento) {
    const d = toDateOnly(data_nascimento);
    if (!DATE_ONLY_RE.test(d)) {
      fieldErrors.data_nascimento = "Data inválida (use YYYY-MM-DD).";
    } else {
      const hoje = new Date();
      const dt = new Date(`${d}T00:00:00Z`);
      if (isNaN(dt.getTime())) fieldErrors.data_nascimento = "Data inválida.";
      else if (dt > hoje) fieldErrors.data_nascimento = "Data não pode ser futura.";
      else if (dt.getUTCFullYear() < 1900) fieldErrors.data_nascimento = "Ano inválido.";
    }
  }

  // registro (opcional): aceita máscara 00.000-0 ou somente dígitos (6–7)
  if (registro) {
    const masked = String(registro).trim();
    const digits = onlyDigits(registro);
    if (!(REGISTRO_MASK_RE.test(masked) || /^\d{6,7}$/.test(digits))) {
      fieldErrors.registro = "Formato inválido. Ex.: 28.053-7 (ou somente 6–7 dígitos).";
    }
  }

  // FKs
  const checks = [
    ["unidades", "unidade_id", unidade_id],
    ["cargos", "cargo_id", cargo_id],
    ["generos", "genero_id", genero_id],
    ["orientacoes_sexuais", "orientacao_sexual_id", orientacao_sexual_id],
    ["cores_racas", "cor_raca_id", cor_raca_id],
    ["escolaridades", "escolaridade_id", escolaridade_id],
    ["deficiencias", "deficiencia_id", deficiencia_id],
  ];
  for (const [table, key, value] of checks) {
    if (value != null) {
      const ok = await assertExists(table, value);
      if (!ok) fieldErrors[key] = "ID inexistente na referência.";
    }
  }

  const ok = Object.keys(fieldErrors).length === 0;
  return { ok, fieldErrors, message: ok ? null : "Erros de validação no formulário." };
}

/* ──────────────────────────────────────────────────────────────
   (A) ADMIN — listar (com filtros/paginação)
   GET /api/usuario?q=&perfil=&unidade_id=&cargo_nome=&page=&pageSize=
────────────────────────────────────────────────────────────── */
async function listar(req, res) {
  try {
    const page = clamp(numOrNull(req.query.page) ?? 1, 1, 1000000);
    const pageSize = clamp(numOrNull(req.query.pageSize) ?? 50, 1, 200);

    const q = normStr(req.query.q);
    const unidadeId = numOrNull(req.query.unidade_id);
    const cargoNome = normStr(req.query.cargo_nome);
    const perfisFiltro = toPerfilArray(req.query.perfil);

    const where = [];
    const params = [];
    let i = 1;

    if (q) {
      where.push(
        `(u.nome ILIKE $${i} OR u.email ILIKE $${i} OR u.cpf ILIKE $${i} OR u.registro ILIKE $${i})`
      );
      params.push(`%${q}%`);
      i++;
    }

    if (unidadeId != null) {
      where.push(`u.unidade_id = $${i++}`);
      params.push(unidadeId);
    }

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

    const rowsQ = await db.query(
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
      ${whereSql}
      ORDER BY u.nome ASC
      LIMIT $${i++} OFFSET $${i++}
      `,
      [...params, pageSize, offset]
    );

    const data = rowsQ.rows || [];
    const pages = Math.max(1, Math.ceil(total / pageSize));

    res.setHeader("X-Usuarios-Shape", "meta+data+usuarios");

    return res.json({
      ok: true,
      meta: { total, page, pageSize, pages },
      data,
      usuarios: data,
      items: data,
      rows: data,
    });
  } catch (err) {
    console.error("❌ Erro ao listar usuários:", err);
    return res.status(500).json({ erro: "Erro ao listar usuários." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (B) ADMIN/SELF — obter por id
   GET /api/usuario/:id
────────────────────────────────────────────────────────────── */
async function obter(req, res) {
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

/* ──────────────────────────────────────────────────────────────
   (C) ADMIN/SELF — atualizar (nome/email/perfil)
   PATCH/PUT /api/usuario/:id
────────────────────────────────────────────────────────────── */
async function atualizar(req, res) {
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
    if (!ehAdmin) return res.status(403).json({ erro: "Apenas administradores podem alterar perfil." });
    const csv = toPerfilCsv(toPerfilArray(perfil).filter((p) => PERFIS_VALIDOS.includes(p)));
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
    const isClientErr = ["23505", "23514", "23503", "23502", "22P02"].includes(err?.code);
    return res.status(isClientErr ? 400 : 500).json(payload.erro ? payload : { erro: "Erro ao atualizar usuário." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (D) ADMIN — excluir
   DELETE /api/usuario/:id
────────────────────────────────────────────────────────────── */
async function excluir(req, res) {
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

/* ──────────────────────────────────────────────────────────────
   (E) ADMIN — listar instrutor (métricas)
────────────────────────────────────────────────────────────── */
async function listarInstrutor(req, res) {
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

    const data = (rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      eventosMinistrados: Number(r.eventos_ministrados) || 0,
      mediaAvaliacao: r.media_avaliacao !== null ? Number(r.media_avaliacao) : null,
      possuiAssinatura: !!r.possui_assinatura,
    }));

    return res.json({ ok: true, data, instrutores: data });
  } catch (err) {
    console.error("❌ Erro ao listar instrutores:", err);
    return res.status(500).json({ erro: "Erro ao listar instrutores." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (F) ADMIN — atualizar perfil (endpoint específico)
   PATCH /api/usuario/:id/perfil
────────────────────────────────────────────────────────────── */
async function atualizarPerfil(req, res) {
  const { id } = req.params;
  const { perfil } = req.body;

  if (!isAdmin(req.user?.perfil)) {
    return res.status(403).json({ erro: "Acesso negado." });
  }

  const perfilCsv = toPerfilCsv(toPerfilArray(perfil).filter((p) => PERFIS_VALIDOS.includes(p)));
  if (!perfilCsv) return res.status(400).json({ erro: "Perfil inválido ou vazio." });

  try {
    let rows;
  
    try {
      // ✅ tenta com atualizado_em (se existir)
      const r1 = await db.query(
        "UPDATE usuarios SET perfil = $1, atualizado_em = NOW() WHERE id = $2 RETURNING id, nome, email, perfil",
        [perfilCsv, id]
      );
      rows = r1.rows;
    } catch (err) {
      // ✅ fallback: se a coluna não existir, tenta sem ela
      if (err?.code === "42703") {
        const r2 = await db.query(
          "UPDATE usuarios SET perfil = $1 WHERE id = $2 RETURNING id, nome, email, perfil",
          [perfilCsv, id]
        );
        rows = r2.rows;
      } else {
        throw err;
      }
    }
  
    if (!rows?.length) return res.status(404).json({ erro: "Usuário não encontrado." });
  
    const u = rows[0];
    return res.json({ ok: true, data: { ...u, perfil: toPerfilArray(u.perfil) } });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    const payload = traduzPgError(err);
    const isClientErr = ["23505", "23514", "23503", "23502", "22P02"].includes(err?.code);
    return res.status(isClientErr ? 400 : 500).json(payload.erro ? payload : { erro: "Erro ao atualizar perfil." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (G) ADMIN — resumo por usuário (cursos ≥75% e certificados)
   GET /api/usuario/:id/resumo
────────────────────────────────────────────────────────────── */
async function obterResumo(req, res) {
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

    const [cursosQ, certsQ] = await Promise.all([db.query(sqlCursos75, [id]), db.query(sqlCerts, [id])]);

    const cursos75 = Number(cursosQ?.rows?.[0]?.n || 0);
    const certificados = Number(certsQ?.rows?.[0]?.n || 0);
    const cursos_concluidos_75 = Math.max(cursos75, certificados);

    return res.json({
      ok: true,
      data: { cursos_concluidos_75, certificados_emitidos: certificados },
    });
  } catch (err) {
    console.error("❌ [obterResumo] erro:", err);
    return res.status(500).json({ erro: "Erro ao obter resumo do usuário." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (H) ADMIN — listar avaliador elegível
   GET /api/usuario/avaliador?roles=instrutor,administrador
────────────────────────────────────────────────────────────── */
async function listarAvaliador(req, res) {
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

/* ──────────────────────────────────────────────────────────────
   (I) PÚBLICO — cadastrar
────────────────────────────────────────────────────────────── */
async function cadastrar(req, res) {
  const nome = normNome(req.body?.nome);
  const cpf = onlyDigits(req.body?.cpf);
  const email = normEmail(req.body?.email);
  const senha = String(req.body?.senha || "");
  const perfil = req.body?.perfil;

  const unidade_id = req.body?.unidade_id ?? null;
  const cargo_id = req.body?.cargo_id ?? null;
  const genero_id = req.body?.genero_id ?? null;
  const orientacao_sexual_id = req.body?.orientacao_sexual_id ?? null;
  const cor_raca_id = req.body?.cor_raca_id ?? null;
  const escolaridade_id = req.body?.escolaridade_id ?? null;
  const deficiencia_id = req.body?.deficiencia_id ?? null;
  const data_nascimento = req.body?.data_nascimento ? toDateOnly(req.body.data_nascimento) : null;
  const registro = req.body?.registro ? toRegistroMasked(req.body.registro) : null;

  const fieldErrors = {};
  if (!nome) fieldErrors.nome = "Nome é obrigatório.";
  if (!cpf) fieldErrors.cpf = "CPF é obrigatório.";
  if (!email) fieldErrors.email = "E-mail é obrigatório.";
  if (email && !EMAIL_RE.test(email)) fieldErrors.email = "E-mail inválido.";
  if (!senha) fieldErrors.senha = "Senha é obrigatória.";
  if (senha && !SENHA_FORTE_RE.test(senha)) {
    fieldErrors.senha = "Mín. 8 caracteres com maiúscula, minúscula, número e símbolo.";
  }
  if (Object.keys(fieldErrors).length) {
    return res.status(422).json({ message: "Erros de validação.", fieldErrors });
  }

  try {
    const existente = await db.query("SELECT id FROM usuarios WHERE cpf = $1 OR LOWER(email) = LOWER($2)", [cpf, email]);
    if (existente.rows.length > 0) {
      return res.status(409).json({
        message: "CPF ou e-mail já cadastrado.",
        fieldErrors: { cpf: "Verifique o CPF.", email: "Verifique o e-mail." },
      });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const perfilFinal = toPerfilString(perfil);

    const insertSql = `
      INSERT INTO usuarios (
        nome, cpf, email, senha, perfil,
        unidade_id, cargo_id, genero_id, orientacao_sexual_id,
        cor_raca_id, escolaridade_id, deficiencia_id,
        data_nascimento, registro
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING
        id, nome, cpf, email, perfil,
        unidade_id, cargo_id, genero_id, orientacao_sexual_id,
        cor_raca_id, escolaridade_id, deficiencia_id, data_nascimento, registro
    `;

    const values = [
      nome,
      cpf,
      email,
      senhaCriptografada,
      perfilFinal,
      unidade_id,
      cargo_id,
      genero_id,
      orientacao_sexual_id,
      cor_raca_id,
      escolaridade_id,
      deficiencia_id,
      data_nascimento,
      registro,
    ];

    const result = await db.query(insertSql, values);
    const row = result.rows[0];

    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(201).json({
      ...row,
      perfil: perfilToArray(perfilFinal),
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao cadastrar usuário:", err);
    const payload = traduzPgError(err);
    const status = err?.code === "23505" ? 409 : 500;
    return res.status(status).json(payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   (J) PÚBLICO — login (CPF + senha)
────────────────────────────────────────────────────────────── */
async function login(req, res) {
  const cpf = onlyDigits(req.body?.cpf);
  const senha = String(req.body?.senha || "");
  if (!cpf || !senha) {
    const fieldErrors = {};
    if (!cpf) fieldErrors.cpf = "Informe o CPF.";
    if (!senha) fieldErrors.senha = "Informe a senha.";
    return res.status(422).json({ message: "Erros de validação.", fieldErrors });
  }

  try {
    const result = await db.query("SELECT * FROM usuarios WHERE cpf = $1", [cpf]);
    const usuario = result.rows[0];
    if (!usuario) {
      return res.status(401).json({ message: "Usuário não encontrado.", fieldErrors: { cpf: "Verifique o CPF." } });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ message: "Senha incorreta.", fieldErrors: { senha: "Senha inválida." } });
    }

    const perfilArray = perfilToArray(usuario.perfil);
    if (!process.env.JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      return res.status(500).json({ message: "Configuração do servidor ausente." });
    }

    const incompleto = isPerfilIncompleto(usuario);
    const faltantes = camposFaltantes(usuario);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    const token = jwt.sign({ id: usuario.id, perfil: perfilArray }, process.env.JWT_SECRET, {
      expiresIn: "4h",
      issuer: JWT_ISS,
      audience: JWT_AUD,
    });

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: { id: usuario.id, nome: usuario.nome, cpf: usuario.cpf, email: usuario.email, perfil: perfilArray },
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao realizar login:", err);
    return res.status(500).json({ message: "Erro ao realizar login." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (K) PÚBLICO — recuperar senha (idempotente)
────────────────────────────────────────────────────────────── */
async function recuperarSenha(req, res) {
  const email = normEmail(req.body?.email);
  if (!email) return res.status(422).json({ message: "Erros de validação.", fieldErrors: { email: "Informe o e-mail." } });
  if (!EMAIL_RE.test(email)) return res.status(422).json({ message: "Erros de validação.", fieldErrors: { email: "Formato inválido." } });

  try {
       // ✅ Segurança: não revela se o e-mail existe
    const okMsg = { mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções." };

const result = await db.query("SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)", [email]);
if (result.rows.length === 0) {
  return res.status(200).json(okMsg);
}

    const usuarioId = result.rows[0].id;

    const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
    if (!JWT_SECRET) {
      console.error("⚠️ JWT_SECRET ausente no ambiente.");
      // Premium: ainda assim não revela nada ao usuário
      return res.status(200).json(okMsg);
    }

    // ✅ Sanitiza issuer/audience (evita "must be a string")
    const ISSUER = String((process.env.JWT_ISSUER ?? process.env.JWT_ISS ?? "") || "").trim();
    const AUDIENCE = String((process.env.JWT_AUDIENCE ?? process.env.JWT_AUD ?? "") || "").trim();

    const signOpts = { expiresIn: "1h" };
    if (ISSUER) signOpts.issuer = ISSUER;
    if (AUDIENCE) signOpts.audience = AUDIENCE;

    const token = jwt.sign(
      { sub: String(usuarioId), typ: "pwd-reset" }, // payload mais padrão (sub)
      JWT_SECRET,
      signOpts
    );

    const reqOrigin = String(req.headers.origin || "").trim();
    const baseUrl =
      String(process.env.FRONTEND_URL_STATIC || "").trim() ||
      (process.env.NODE_ENV === "production" && /^https:\/\/.+/i.test(reqOrigin)
        ? reqOrigin
        : "http://localhost:5173"); // ✅ melhor default em DEV

    const safeBase = String(baseUrl).replace(/\/+$/, "");
    const link = `${safeBase}/redefinir-senha/${encodeURIComponent(token)}`;

    try {
      await enviarEmail({
        to: email,
        subject: "Recuperação de Senha - Escola da Saúde",
        text: `Você solicitou redefinição de senha. Acesse: ${link} (válido por 1h).`,
      });
    } catch (mailErr) {
      // ✅ Premium: não quebra o fluxo do usuário (evita enumeração por falha de envio)
      console.error("❌ Erro ao enviar e-mail de recuperação:", mailErr);
    }

    return res.status(200).json(okMsg);
  } catch (err) {
    console.error("❌ Erro ao solicitar recuperação de senha:", err);
    // ✅ premium: não vaza e mantém UX
    return res.status(200).json({ mensagem: "Se o e-mail estiver cadastrado, enviaremos as instruções." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (L) PÚBLICO — redefinir senha
────────────────────────────────────────────────────────────── */
async function redefinirSenha(req, res) {
  const tokenRaw =
  req.body?.token ||
  req.params?.token ||
  req.query?.token ||
  "";

let token = String(tokenRaw || "").trim();
try {
  token = decodeURIComponent(token);
} catch {
  // se não estiver encoded, segue
}
  const novaSenha = String(req.body?.novaSenha || "");
  if (!token || !novaSenha) {
    return res.status(422).json({
      message: "Erros de validação.",
      fieldErrors: {
        token: !token ? "Token ausente." : undefined,
        novaSenha: !novaSenha ? "Informe a nova senha." : undefined,
      },
    });
  }
  if (!SENHA_FORTE_RE.test(novaSenha)) {
    return res.status(422).json({
      message: "Erros de validação.",
      fieldErrors: {
        novaSenha: "A nova senha deve conter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.",
      },
    });
  }
  if (!process.env.JWT_SECRET) {
    console.error("⚠️ JWT_SECRET ausente no ambiente.");
    return res.status(500).json({ message: "Configuração do servidor ausente." });
  }

  try {
    const JWT_SECRET = String(process.env.JWT_SECRET || "").trim();
if (!JWT_SECRET) {
  console.error("⚠️ JWT_SECRET ausente no ambiente.");
  return res.status(500).json({ message: "Configuração do servidor ausente." });
}

const ISSUER = String((process.env.JWT_ISSUER ?? process.env.JWT_ISS ?? "") || "").trim();
const AUDIENCE = String((process.env.JWT_AUDIENCE ?? process.env.JWT_AUD ?? "") || "").trim();

const verifyOpts = {};
if (ISSUER) verifyOpts.issuer = ISSUER;
if (AUDIENCE) verifyOpts.audience = AUDIENCE;

const decoded = jwt.verify(token, JWT_SECRET, verifyOpts);

// ✅ compatível com tokens antigos (id) e novos (sub)
const usuarioId = decoded?.id ?? decoded?.sub;

if (decoded?.typ !== "pwd-reset" || !usuarioId) {
  return res.status(400).json({ message: "Token inválido." });
}

    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);
    await db.query("UPDATE usuarios SET senha = $1 WHERE id = $2", [senhaCriptografada, usuarioId]);

    return res.status(200).json({ mensagem: "Senha atualizada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao redefinir senha:", err);
    return res.status(400).json({ message: "Token inválido ou expirado." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (M) PÚBLICO/SELF — obter usuário por id (fallback assinatura)
────────────────────────────────────────────────────────────── */
async function obterPorId(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");

  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para acessar este usuário." });
  }

  const baseSelect = `
    id, nome, cpf, email, perfil,
    unidade_id, cargo_id, genero_id, orientacao_sexual_id,
    cor_raca_id, escolaridade_id, deficiencia_id,
    data_nascimento, registro, assinatura
  `;

  try {
    let result;
    try {
      result = await db.query(`SELECT ${baseSelect} FROM usuarios WHERE id = $1`, [id]);
    } catch (e) {
      if (e?.code === "42703") {
        result = await db.query(
          `
          SELECT id, nome, cpf, email, perfil,
                 unidade_id, cargo_id, genero_id, orientacao_sexual_id,
                 cor_raca_id, escolaridade_id, deficiencia_id,
                 data_nascimento, registro
          FROM usuarios WHERE id = $1
        `,
          [id]
        );
      } else {
        throw e;
      }
    }

    if (result.rows.length === 0) return res.status(404).json({ message: "Usuário não encontrado." });

    const row = result.rows[0];
    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({
      ...row,
      perfil: perfilToArray(row.perfil),
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao obter usuário:", err);
    return res.status(500).json({ message: "Erro ao buscar dados." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (N) PÚBLICO/SELF — atualizar dados básicos (nome/email/senha)
────────────────────────────────────────────────────────────── */
async function atualizarBasico(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");

  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para alterar este usuário." });
  }

  const nome = req.body?.nome != null ? normNome(req.body.nome) : undefined;
  const email = req.body?.email != null ? normEmail(req.body.email) : undefined;
  const senha = req.body?.senha != null ? String(req.body.senha) : undefined;

  const fieldErrors = {};
  if (email != null && email !== "" && !EMAIL_RE.test(email)) fieldErrors.email = "E-mail inválido.";
  if (senha != null && senha !== "" && !SENHA_FORTE_RE.test(senha)) {
    fieldErrors.senha = "Mín. 8 caracteres com maiúscula, minúscula, número e símbolo.";
  }
  if (Object.keys(fieldErrors).length) return res.status(422).json({ message: "Erros de validação.", fieldErrors });

  const campos = [];
  const valores = [];
  let index = 1;

  if (nome != null && nome !== "") {
    campos.push(`nome = $${index++}`);
    valores.push(nome);
  }
  if (email != null && email !== "") {
    campos.push(`email = $${index++}`);
    valores.push(email);
  }
  if (senha != null && senha !== "") {
    const senhaHash = await bcrypt.hash(senha, 10);
    campos.push(`senha = $${index++}`);
    valores.push(senhaHash);
  }

  if (campos.length === 0) {
    return res.status(422).json({ message: "Erros de validação.", fieldErrors: { _global: "Nenhum dado para atualizar." } });
  }

  valores.push(id);
  const queryStr = `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${index}`;

  try {
    await db.query(queryStr, valores);

    const { rows } = await db.query(
      `SELECT unidade_id, cargo_id, genero_id, orientacao_sexual_id,
              cor_raca_id, escolaridade_id, deficiencia_id, data_nascimento
         FROM usuarios WHERE id = $1`,
      [id]
    );
    const u = rows[0] || {};
    const incompleto = isPerfilIncompleto(u);
    const faltantes = camposFaltantes(u);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({
      mensagem: "Usuário atualizado com sucesso.",
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar usuário:", err);
    const payload = traduzPgError(err);
    const status = err?.code === "23505" ? 409 : 500;
    return res.status(status).json(payload);
  }
}

/* ──────────────────────────────────────────────────────────────
   (O) PÚBLICO/SELF — atualizar perfil completo (cadastro complementar)
────────────────────────────────────────────────────────────── */
async function atualizarPerfilCompleto(req, res) {
  const { id } = req.params;
  const usuarioLogado = req.user || {};
  const perfilArr = Array.isArray(usuarioLogado.perfil) ? usuarioLogado.perfil : perfilToArray(usuarioLogado.perfil);
  const ehAdmin = perfilArr.includes("administrador");

  if (Number(id) !== Number(usuarioLogado.id) && !ehAdmin) {
    return res.status(403).json({ message: "Sem permissão para alterar este usuário." });
  }

  const payload = {
    unidade_id: req.body?.unidade_id ?? null,
    cargo_id: req.body?.cargo_id ?? null,
    genero_id: req.body?.genero_id ?? null,
    orientacao_sexual_id: req.body?.orientacao_sexual_id ?? null,
    cor_raca_id: req.body?.cor_raca_id ?? null,
    escolaridade_id: req.body?.escolaridade_id ?? null,
    deficiencia_id: req.body?.deficiencia_id ?? null,
    data_nascimento: req.body?.data_nascimento ? toDateOnly(req.body.data_nascimento) : "",
    registro: req.body?.registro ? req.body.registro : "",
  };

  const { ok, fieldErrors, message } = await validarPerfilComplementar(payload);
  if (!ok) return res.status(422).json({ message, fieldErrors });

  const toSave = { ...payload, registro: payload.registro ? toRegistroMasked(payload.registro) : null };

  const campos = [];
  const valores = [];
  let i = 1;

  Object.entries(toSave).forEach(([k, v]) => {
    campos.push(`${k} = $${i++}`);
    valores.push(v === "" ? null : v);
  });

  valores.push(id);
  const sql = `UPDATE usuarios SET ${campos.join(", ")} WHERE id = $${i}`;

  try {
    await db.query(sql, valores);

    const { rows } = await db.query(
      `SELECT id, nome, cpf, email, perfil,
              unidade_id, cargo_id, genero_id, orientacao_sexual_id,
              cor_raca_id, escolaridade_id, deficiencia_id,
              data_nascimento, registro
         FROM usuarios WHERE id = $1`,
      [id]
    );

    const row = rows[0];
    const incompleto = isPerfilIncompleto(row);
    const faltantes = camposFaltantes(row);
    res.set("X-Perfil-Incompleto", incompleto ? "1" : "0");

    return res.status(200).json({
      mensagem: "Perfil atualizado com sucesso.",
      usuario: { ...row, perfil: perfilToArray(row.perfil) },
      perfilIncompleto: incompleto,
      camposFaltantes: faltantes,
    });
  } catch (err) {
    console.error("❌ Erro ao atualizar perfil:", err);
    const payload2 = traduzPgError(err);
    let status = 500;
    if (["23503", "23514", "23502", "22P02"].includes(err?.code)) status = 422;
    if (err?.code === "23505") status = 409;
    return res.status(status).json(payload2);
  }
}

/* ──────────────────────────────────────────────────────────────
   (P) PÚBLICO — obter assinatura (instrutor/admin)
────────────────────────────────────────────────────────────── */
async function obterAssinatura(req, res) {
  const usuarioId = req.user?.id;
  const perfilArr = Array.isArray(req.user?.perfil) ? req.user.perfil : perfilToArray(req.user?.perfil);

  if (!usuarioId) return res.status(401).json({ message: "Usuário não autenticado." });
  if (!perfilArr.includes("instrutor") && !perfilArr.includes("administrador")) {
    return res.status(403).json({ message: "Acesso restrito a instrutor ou administradores." });
  }

  try {
    const result = await db.query("SELECT assinatura FROM usuarios WHERE id = $1", [usuarioId]);
    const assinatura = result.rows[0]?.assinatura || null;
    return res.status(200).json({ assinatura });
  } catch (err) {
    console.error("❌ Erro ao buscar assinatura:", err);
    return res.status(500).json({ message: "Erro ao buscar assinatura." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (Q) PÚBLICO — buscar (autocomplete)
   GET /usuario/busca?search=...&roles=instrutor,administrador&unidade_id=#
────────────────────────────────────────────────────────────── */
async function buscar(req, res) {
  const search = String(req.query.search || "").trim();

  if (!search || search.length < 3) {
    return res.status(400).json({
      message: "Envie ao menos 3 caracteres para busca.",
      fieldErrors: { search: "Mínimo de 3 caracteres." },
    });
  }

  try {
    const like = `%${search}%`;

    const rolesCsv = String(req.query.roles || "").trim();
    const roles = rolesCsv ? rolesCsv.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean) : null;

    const unidadeId = req.query.unidade_id != null ? Number(req.query.unidade_id) : null;
    const filtros = ["(nome ILIKE $1 OR email ILIKE $1)"];
    const params = [like];
    let idx = 2;

    if (unidadeId && Number.isFinite(unidadeId)) {
      filtros.push(`unidade_id = $${idx++}`);
      params.push(unidadeId);
    }

    const { rows } = await db.query(
      `
      SELECT id, nome, email, perfil, unidade_id
        FROM usuarios
       WHERE ${filtros.join(" AND ")}
       ORDER BY nome
       LIMIT 20
      `,
      params
    );

    const filtrado =
      roles && roles.length
        ? rows.filter((u) => {
            const p = perfilToArray(u.perfil);
            return roles.some((r) => p.includes(r));
          })
        : rows;

    const resultado = filtrado.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: perfilToArray(u.perfil),
      unidade_id: u.unidade_id,
    }));

    return res.status(200).json(resultado);
  } catch (err) {
    console.error("❌ Erro ao buscar usuários:", err);
    return res.status(500).json({ message: "Erro ao buscar usuários." });
  }
}

/* ──────────────────────────────────────────────────────────────
   (R) ESTATÍSTICAS — (era usuarioController)
   GET /usuario/estatistica
────────────────────────────────────────────────────────────── */

/* Compat com pg-promise (one/none/manyOrNone) e node-postgres (query) */
async function dbOneCompat(dbx, sql, params) {
  if (typeof dbx.one === "function") return dbx.one(sql, params);
  const resx = await dbx.query(sql, params);
  if (!resx?.rows?.length) throw new Error("Registro não encontrado");
  return resx.rows[0];
}
async function dbManyOrNoneCompat(dbx, sql, params) {
  if (typeof dbx.manyOrNone === "function") return dbx.manyOrNone(sql, params);
  const resx = await dbx.query(sql, params);
  return resx?.rows ?? [];
}
function getDbFromReq(req) {
  const base = req?.db ?? (dbModule?.db ?? dbModule);
  if (!base) throw new Error("DB não inicializado");
  return base;
}
async function aggWithJoin(dbx, {
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
  const computedOrder = order ?? (labelMode === "extra-only" ? "4 DESC, 3 ASC" : "4 DESC, 2 ASC");

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

  const rows = await dbManyOrNoneCompat(dbx, sql);

  return rows.map((r) => {
    const base = r?.label_base ? String(r.label_base).trim() : "";
    const extra = r?.extra ? String(r.extra).trim() : "";
    let label;
    if (labelMode === "extra-only") label = extra || base || nullLabel;
    else if (labelMode === "base-only") label = base || extra || nullLabel;
    else label = extra && base ? `${extra} — ${base}` : extra || base || nullLabel;
    return { id: r.id, label, value: r.value };
  });
}

async function obterEstatistica(req, res, opts = {}) {
  const internal = !!opts.internal || !!opts.preview;

  try {
    const dbx = getDbFromReq(req);
    console.log("📊 Iniciando cálculo de estatísticas de usuários...");

    const totalRow = await dbOneCompat(dbx, `SELECT COUNT(*)::int AS total FROM usuarios`);
    const total = totalRow?.total ?? 0;

    const rowsIdade = await dbManyOrNoneCompat(dbx, `
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
      { label: "<20", value: faixaMap.get("<20") || 0 },
      { label: "20-29", value: faixaMap.get("20-29") || 0 },
      { label: "30-39", value: faixaMap.get("30-39") || 0 },
      { label: "40-49", value: faixaMap.get("40-49") || 0 },
      { label: "50-59", value: faixaMap.get("50-59") || 0 },
      { label: "60+", value: faixaMap.get("60+") || 0 },
      { label: "Sem data", value: faixaMap.get("Sem data") || 0 },
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
      aggWithJoin(dbx, {
        table: "unidades",
        joinCol: "unidade_id",
        labelCol: "nome",
        extraLabel: "sigla",
        labelMode: "extra-only",
      }),
      aggWithJoin(dbx, {
        table: "escolaridades",
        joinCol: "escolaridade_id",
        labelCol: "nome",
        textCol: "escolaridade",
        labelMode: "base-only",
      }),
      aggWithJoin(dbx, {
        table: "cargos",
        joinCol: "cargo_id",
        labelCol: "nome",
        textCol: "cargo",
        labelMode: "base-only",
      }),
      aggWithJoin(dbx, {
        table: "orientacoes_sexuais",
        joinCol: "orientacao_sexual_id",
        labelCol: "nome",
        textCol: "orientacao_sexual",
        labelMode: "base-only",
      }),
      aggWithJoin(dbx, {
        table: "generos",
        joinCol: "genero_id",
        labelCol: "nome",
        textCol: "genero",
        labelMode: "base-only",
      }),
      aggWithJoin(dbx, {
        table: "deficiencias",
        joinCol: "deficiencia_id",
        labelCol: "nome",
        textCol: "deficiencia",
        labelMode: "base-only",
      }),
      aggWithJoin(dbx, {
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

    if (internal) return payload;
    return res.status(200).json(payload);
  } catch (err) {
    console.error("❌ /usuario/estatistica erro:", err);
    if (opts.preview) return null;
    if (!res.headersSent) res.status(500).json({ error: "Falha ao calcular estatísticas" });
    return null;
  }
}
async function obterEstatisticaDetalhada(req, res) {
  const data = await obterEstatistica(req, res, { internal: true });
  return data;
}

/* ──────────────────────────────────────────────────────────────
   EXPORTS (singular) + retrocompat (nomes antigos)
────────────────────────────────────────────────────────────── */
module.exports = {
  // ✅ singular (novo padrão)
  listar,
  obter,                 // admin/self com joins de exibição
  atualizar,             // admin/self (nome/email/perfil)
  excluir,

  listarInstrutor,       // lista instrutores (métricas)
  atualizarPerfil,       // patch perfil (admin)
  obterResumo,           // resumo por usuário
  listarAvaliador,       // avaliadores elegíveis

  cadastrar,
  login,
  recuperarSenha,
  redefinirSenha,
  obterPorId,            // público/self (fallback assinatura)
  atualizarBasico,       // público/self (nome/email/senha)
  atualizarPerfilCompleto,
  obterAssinatura,
  buscar,                // autocomplete

  obterEstatistica,
  obterEstatisticaDetalhada,

  // ♻️ aliases retrocompat (pra não quebrar rotas antigas)
  listarUsuarios: listar,
  buscarUsuarioPorId: obter,
  atualizarUsuario: atualizar,
  excluirUsuario: excluir,

  listarInstrutores: listarInstrutor,
  listarinstrutor: listarInstrutor,

  getResumoUsuario: obterResumo,
  listarAvaliadoresElegiveis: listarAvaliador,

  cadastrarUsuario: cadastrar,
  loginUsuario: login,
  obterUsuarioPorId: obterPorId,
  // (antigo) atualizarUsuario do público: mantém por alias separado
  atualizarUsuarioPublico: atualizarBasico,
  atualizarUsuarioBasico: atualizarBasico,

  getEstatisticasUsuarios: obterEstatistica,
  getEstatisticasUsuariosDetalhadas: obterEstatisticaDetalhada,
};
