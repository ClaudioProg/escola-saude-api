/* eslint-disable no-console */
"use strict";

const dbMod = require("../db");
const db = dbMod?.db ?? dbMod;

const IS_DEV = process.env.NODE_ENV !== "production";

/* ────────────────────────────────────────────────────────────────
   Notificação de certificado — import resiliente
   (aceita variações antigas/novas)
─────────────────────────────────────────────────────────────── */
let notifyCertFn = null;
try {
  const notif = require("./notificacaoController");
  notifyCertFn =
    notif?.gerarNotificacaoDeCertificado ||
    notif?.gerarNotificacoesDeCertificado ||
    notif?.gerarNotificacoesDeCertificado?.default ||
    null;
} catch (_) {
  notifyCertFn = null;
}

/* ────────────────────────────────────────────────────────────────
   Helpers — DB/ctx
─────────────────────────────────────────────────────────────── */
const getDb = (req) => req?.db ?? db;
const rid = (req) => req?.requestId;

const getUserId = (req) =>
  req?.user?.id ??
  req?.usuario?.id ??
  req?.user?.usuario_id ??
  req?.usuario?.usuario_id ??
  req?.auth?.userId ??
  null;

function getPerfis(user) {
  const raw = user?.perfis ?? user?.perfil ?? "";
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return String(raw).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/* ────────────────────────────────────────────────────────────────
   Helpers — date-only safe
─────────────────────────────────────────────────────────────── */
const isYmd = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function ymdToLocalDate(ymd) {
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function toYMDLocal(dateLike) {
  if (isYmd(dateLike)) return dateLike;
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function gerarIntervaloYMD(inicioLike, fimLike) {
  const ini = isYmd(inicioLike) ? ymdToLocalDate(inicioLike) : new Date(inicioLike);
  const fim = isYmd(fimLike) ? ymdToLocalDate(fimLike) : new Date(fimLike);
  if (!ini || !fim || Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return [];
  ini.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const out = [];
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) out.push(toYMDLocal(d));
  return out;
}

/* ────────────────────────────────────────────────────────────────
   Helpers — notas e regras
─────────────────────────────────────────────────────────────── */
function toScore(v) {
  if (v == null) return null;
  const s0 = String(v).trim();
  if (!s0) return null;
  const num = Number(s0.replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;

  const s = s0
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const map = {
    otimo: 5,
    excelente: 5,
    "muito bom": 5,
    bom: 4,
    regular: 3,
    medio: 3,
    ruim: 2,
    pessimo: 1,
    "muito ruim": 1,
  };
  return map[s] ?? null;
}

function mediaFromDist(dist) {
  const n1 = dist["1"] || 0,
    n2 = dist["2"] || 0,
    n3 = dist["3"] || 0,
    n4 = dist["4"] || 0,
    n5 = dist["5"] || 0;
  const total = n1 + n2 + n3 + n4 + n5;
  if (!total) return null;
  const soma = 1 * n1 + 2 * n2 + 3 * n3 + 4 * n4 + 5 * n5;
  return Number((soma / total).toFixed(2));
}

function pickText(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "object") {
    const t = v.texto ?? v.comentario ?? v.value ?? null;
    return typeof t === "string" && t.trim() ? t.trim() : null;
  }
  return null;
}

const NOTAS_EVENTO = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

const CAMPOS_MEDIA_OFICIAL = [...NOTAS_EVENTO];
const CAMPOS_OBJETIVOS = [
  ...NOTAS_EVENTO,
  "desempenho_instrutor",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];
const CAMPOS_TEXTOS = ["gostou_mais", "sugestoes_melhoria", "comentarios_finais"];

function mediaNotasEventoDe(aval) {
  let soma = 0,
    n = 0;
  for (const c of NOTAS_EVENTO) {
    const s = toScore(aval[c]);
    if (s != null) {
      soma += s;
      n++;
    }
  }
  return n ? soma / n : null;
}

const CAMPOS_OBRIGATORIOS = ["desempenho_instrutor", ...NOTAS_EVENTO];

function filtrarCamposPorTipoEvento(tipoEvento, payload) {
  const tipo = String(tipoEvento || "").toLowerCase();
  const allowExposicao = tipo === "congresso" || tipo === "simpósio" || tipo === "simposio";
  const allowCongressoOnly = tipo === "congresso";
  return {
    exposicao_trabalhos: allowExposicao ? payload.exposicao_trabalhos ?? null : null,
    apresentacao_oral_mostra: allowCongressoOnly ? payload.apresentacao_oral_mostra ?? null : null,
    apresentacao_tcrs: allowCongressoOnly ? payload.apresentacao_tcrs ?? null : null,
    oficinas: allowCongressoOnly ? payload.oficinas ?? null : null,
  };
}

/* ────────────────────────────────────────────────────────────────
   Helpers — SQL fallback (avaliacoes/avaliacao, inscricoes/inscricao)
─────────────────────────────────────────────────────────────── */
async function queryFirstWorking(dbConn, variants, params) {
  let lastErr = null;
  for (const sql of variants) {
    try {
      return await dbConn.query(sql, params);
    } catch (e) {
      lastErr = e;
      // tenta próximo em erros típicos de schema
      if (["42P01", "42703"].includes(e?.code)) continue; // table/column not found
      throw e;
    }
  }
  throw lastErr || new Error("Nenhuma variante de SQL funcionou.");
}

/* ────────────────────────────────────────────────────────────────
   Elegibilidade / contexto
─────────────────────────────────────────────────────────────── */
async function obterContextoTurma(dbConn, turmaId) {
  const { rows, rowCount } = await dbConn.query(
    `
    SELECT t.id, t.evento_id, t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
           e.tipo AS evento_tipo
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
     WHERE t.id = $1
     LIMIT 1
    `,
    [Number(turmaId)]
  );
  return rowCount ? rows[0] : null;
}

async function usuarioTemPresenca(dbConn, usuarioId, turmaId) {
  // conta apenas presente=true se existir, senão só existência
  const variants = [
    `SELECT 1 FROM presencas WHERE usuario_id=$1 AND turma_id=$2 AND presente=true LIMIT 1`,
    `SELECT 1 FROM presencas WHERE usuario_id=$1 AND turma_id=$2 LIMIT 1`,
  ];
  const r = await queryFirstWorking(dbConn, variants, [Number(usuarioId), Number(turmaId)]);
  return (r.rowCount || 0) > 0;
}

async function usuarioAtingiu75(dbConn, usuarioId, turmaId) {
  // calcula mínimo pela janela data_inicio..data_fim e conta dias distintos com presença
  const variants = [
    `
    SELECT
      (
        SELECT COUNT(DISTINCT p.data_presenca)::int
          FROM presencas p
         WHERE p.usuario_id = $1
           AND p.turma_id   = t.id
           AND p.presente   = true
      ) AS qtd_presencas,
      CEIL(0.75 * ((t.data_fim - t.data_inicio) + 1))::int AS minimo_75
      FROM turmas t
     WHERE t.id = $2
     LIMIT 1
    `,
    `
    SELECT
      (
        SELECT COUNT(DISTINCT p.data_presenca)::int
          FROM presencas p
         WHERE p.usuario_id = $1
           AND p.turma_id   = t.id
      ) AS qtd_presencas,
      CEIL(0.75 * ((t.data_fim - t.data_inicio) + 1))::int AS minimo_75
      FROM turmas t
     WHERE t.id = $2
     LIMIT 1
    `,
  ];

  const r = await queryFirstWorking(dbConn, variants, [Number(usuarioId), Number(turmaId)]);
  const row = r.rows?.[0];
  return !!row && Number(row.qtd_presencas) >= Number(row.minimo_75);
}

async function turmaEncerrada(dbConn, turmaId) {
  const r = await dbConn.query(
    `
    SELECT 1
      FROM turmas t
     WHERE t.id = $1
       AND (now() > (t.data_fim::timestamp + t.horario_fim))
     LIMIT 1
    `,
    [Number(turmaId)]
  );
  return (r.rowCount || 0) > 0;
}

/* ────────────────────────────────────────────────────────────────
   Endpoints — Usuário / Instrutor
─────────────────────────────────────────────────────────────── */
/** POST /api/avaliacao */
async function enviarAvaliacao(req, res) {
  const usuario_id = Number(getUserId(req));
  const dbConn = getDb(req);
  const payload = req.body || {};
  const turma_id = Number(payload.turma_id);
  const evento_id = payload.evento_id != null ? Number(payload.evento_id) : null;

  if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });
  if (!Number.isFinite(turma_id) || turma_id <= 0) return res.status(400).json({ erro: "turma_id inválido." });
  if (evento_id != null && (!Number.isFinite(evento_id) || evento_id <= 0))
    return res.status(400).json({ erro: "evento_id inválido." });

  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (payload[campo] == null || String(payload[campo]).trim() === "") {
      return res.status(400).json({ erro: `Campo obrigatório '${campo}' faltando.` });
    }
  }

  try {
    const ctx = await obterContextoTurma(dbConn, turma_id);
    if (!ctx) return res.status(404).json({ erro: "Turma não encontrada." });

    if (evento_id != null && evento_id !== Number(ctx.evento_id)) {
      return res.status(400).json({ erro: "evento_id não corresponde à turma_id." });
    }

    const participou = await usuarioTemPresenca(dbConn, usuario_id, turma_id);
    if (!participou) return res.status(403).json({ erro: "Você não participou desta turma." });

    const encerrada = await turmaEncerrada(dbConn, turma_id);
    if (!encerrada) return res.status(403).json({ erro: "A avaliação só fica disponível após o encerramento da turma." });

    const atingiu75 = await usuarioAtingiu75(dbConn, usuario_id, turma_id);
    if (!atingiu75) return res.status(403).json({ erro: "Você ainda não atingiu a frequência mínima (75%) para avaliar." });

    // já avaliou?
    const existeVariants = [
      `SELECT 1 FROM avaliacoes WHERE usuario_id=$1 AND turma_id=$2 LIMIT 1`,
      `SELECT 1 FROM avaliacao WHERE usuario_id=$1 AND turma_id=$2 LIMIT 1`,
    ];
    const existente = await queryFirstWorking(dbConn, existeVariants, [usuario_id, turma_id]);
    if ((existente.rowCount || 0) > 0) return res.status(400).json({ erro: "Você já avaliou esta turma." });

    const opcionais = filtrarCamposPorTipoEvento(ctx.evento_tipo, payload);

    const insertVariants = [
      `
      INSERT INTO avaliacoes (
        usuario_id, turma_id,
        desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas,
        estrutura_local, acessibilidade, limpeza, inscricao_online,
        exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        gostou_mais, sugestoes_melhoria, comentarios_finais, data_avaliacao
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, NOW()
      )
      RETURNING *
      `,
      `
      INSERT INTO avaliacao (
        usuario_id, turma_id,
        desempenho_instrutor, divulgacao_evento, recepcao, credenciamento,
        material_apoio, pontualidade, sinalizacao_local, conteudo_temas,
        estrutura_local, acessibilidade, limpeza, inscricao_online,
        exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
        gostou_mais, sugestoes_melhoria, comentarios_finais, data_avaliacao
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, NOW()
      )
      RETURNING *
      `,
    ];

    const insertRes = await queryFirstWorking(dbConn, insertVariants, [
      usuario_id,
      turma_id,

      payload.desempenho_instrutor,
      payload.divulgacao_evento,
      payload.recepcao,
      payload.credenciamento,

      payload.material_apoio,
      payload.pontualidade,
      payload.sinalizacao_local,
      payload.conteudo_temas,

      payload.estrutura_local,
      payload.acessibilidade,
      payload.limpeza,
      payload.inscricao_online,

      opcionais.exposicao_trabalhos,
      opcionais.apresentacao_oral_mostra,
      opcionais.apresentacao_tcrs,
      opcionais.oficinas,

      payload.gostou_mais || null,
      payload.sugestoes_melhoria || null,
      payload.comentarios_finais || null,
    ]);

    const avaliacao = insertRes.rows?.[0];

    console.log("[avaliacao] avaliação registrada", {
      rid: rid(req),
      avaliacao_id: avaliacao?.id,
      usuario_id,
      turma_id,
    });

    // notifica/gera certificado (se existir função)
    if (typeof notifyCertFn === "function") {
      try {
        // alguns códigos esperam (usuario_id, turma_id), outros só (usuario_id)
        const arity = notifyCertFn.length;
        if (arity >= 2) await notifyCertFn(usuario_id, turma_id);
        else await notifyCertFn(usuario_id);
      } catch (e) {
        console.warn("[avaliacao] ⚠️ erro ao notificar/gerar certificado:", {
          rid: rid(req),
          usuario_id,
          turma_id,
          msg: e?.message,
        });
      }
    }

    return res.status(201).json({
      mensagem: "Avaliação registrada com sucesso. Se elegível, seu certificado será liberado.",
      avaliacao,
    });
  } catch (err) {
    console.error("[avaliacao] ❌ erro ao registrar avaliação:", {
      rid: rid(req),
      msg: err?.message,
      stack: IS_DEV ? err?.stack : undefined,
    });
    return res.status(500).json({ erro: "Erro ao registrar avaliação." });
  }
}

/** GET /api/avaliacao/disponiveis/:usuario_id */
async function listarAvaliacaoDisponiveis(req, res) {
  const dbConn = getDb(req);
  const usuario_id = Number(req.params.usuario_id);

  if (!Number.isFinite(usuario_id) || usuario_id <= 0) return res.status(400).json({ erro: "usuario_id inválido." });

  try {
    const sqlVariants = [
      `
      SELECT 
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id,
        t.data_inicio,
        t.data_fim,
        t.horario_fim
      FROM inscricoes i
      INNER JOIN turmas  t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      LEFT  JOIN avaliacoes a 
             ON a.usuario_id = i.usuario_id
            AND a.turma_id   = t.id
      WHERE i.usuario_id = $1
        AND a.id IS NULL
        AND ( now() > (t.data_fim::timestamp + t.horario_fim) )
        AND (
          (
            SELECT COUNT(DISTINCT p.data_presenca)::int
              FROM presencas p
             WHERE p.usuario_id = i.usuario_id
               AND p.turma_id   = t.id
               AND (p.presente = true)
          ) >= CEIL(0.75 * ( (t.data_fim - t.data_inicio) + 1 ))
        )
      ORDER BY t.data_fim DESC
      `,
      // fallback: nomes antigos
      `
      SELECT 
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id,
        t.data_inicio,
        t.data_fim,
        t.horario_fim
      FROM inscricao i
      INNER JOIN turmas  t ON i.turma_id = t.id
      INNER JOIN eventos e ON t.evento_id = e.id
      LEFT  JOIN avaliacao a 
             ON a.usuario_id = i.usuario_id
            AND a.turma_id   = t.id
      WHERE i.usuario_id = $1
        AND a.id IS NULL
        AND ( now() > (t.data_fim::timestamp + t.horario_fim) )
      ORDER BY t.data_fim DESC
      `,
    ];

    const result = await queryFirstWorking(dbConn, sqlVariants, [usuario_id]);
    return res.status(200).json(result.rows || []);
  } catch (err) {
    console.error("[avaliacao] ❌ erro ao buscar avaliações disponíveis:", { rid: rid(req), msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações disponíveis." });
  }
}

/** GET /api/avaliacao/turma/:turma_id  (instrutor logado ou admin) */
async function listarPorTurmaParaInstrutor(req, res) {
  const dbConn = getDb(req);
  const user = req.user || req.usuario || {};
  const usuarioId = Number(getUserId(req));
  const perfis = getPerfis(user);
  const turma_id = Number(req.params.turma_id);

  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });
  if (!Number.isFinite(turma_id) || turma_id <= 0) return res.status(400).json({ erro: "ID de turma inválido." });

  try {
    const isAdmin = perfis.includes("administrador");

    if (!isAdmin) {
      const chk = await dbConn.query(
        `
        SELECT 1
          FROM turmas t
         WHERE t.id = $2
           AND (
             EXISTS (
               SELECT 1 FROM turma_instrutor ti
                WHERE ti.turma_id = t.id
                  AND ti.instrutor_id = $1
             )
             OR EXISTS (
               SELECT 1 FROM evento_instrutor ei
                WHERE ei.evento_id = t.evento_id
                  AND ei.instrutor_id = $1
             )
           )
         LIMIT 1
        `,
        [usuarioId, turma_id]
      );
      if (!chk.rowCount) return res.status(403).json({ erro: "Acesso negado à turma." });
    }

    const sqlVariants = [
      `
      SELECT
         id, turma_id, usuario_id,
         desempenho_instrutor,
         divulgacao_evento, recepcao, credenciamento, material_apoio,
         pontualidade, sinalizacao_local, conteudo_temas,
         estrutura_local, acessibilidade, limpeza, inscricao_online,
         exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
         gostou_mais, sugestoes_melhoria, comentarios_finais,
         data_avaliacao
       FROM avaliacoes
      WHERE turma_id = $1
      ORDER BY id DESC
      `,
      `
      SELECT
         id, turma_id, usuario_id,
         desempenho_instrutor,
         divulgacao_evento, recepcao, credenciamento, material_apoio,
         pontualidade, sinalizacao_local, conteudo_temas,
         estrutura_local, acessibilidade, limpeza, inscricao_online,
         exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
         gostou_mais, sugestoes_melhoria, comentarios_finais,
         data_avaliacao
       FROM avaliacao
      WHERE turma_id = $1
      ORDER BY id DESC
      `,
    ];

    const r = await queryFirstWorking(dbConn, sqlVariants, [turma_id]);
    const rows = r.rows || [];

    if (IS_DEV) {
      res.setHeader("X-Debug-User", String(usuarioId));
      res.setHeader("X-Debug-Perfis", perfis.join(","));
      res.setHeader("X-Debug-Avaliacao-Count", String(rows.length));
    }

    console.log(`[avaliacao] listarPorTurmaParaInstrutor turma=${turma_id} rows=${rows.length}`);
    return res.json(rows);
  } catch (err) {
    console.error("[avaliacao] ❌ listarPorTurmaParaInstrutor:", {
      rid: rid(req),
      msg: err?.message,
      stack: IS_DEV ? err?.stack : undefined,
    });
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/* ────────────────────────────────────────────────────────────────
   Endpoints — Administração / Analytics
─────────────────────────────────────────────────────────────── */
/** GET /api/avaliacao/turma/:turma_id/all  (admin) */
async function avaliacaoPorTurma(req, res) {
  const dbConn = getDb(req);
  const turma_id = Number(req.params.turma_id);
  if (!Number.isFinite(turma_id) || turma_id <= 0) return res.status(400).json({ erro: "ID de turma inválido." });

  try {
    const variants = [
      `
      SELECT u.nome,
             a.desempenho_instrutor,
             a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
             a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
             a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
             a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
             a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
        FROM avaliacoes a
        JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.turma_id = $1
      `,
      `
      SELECT u.nome,
             a.desempenho_instrutor,
             a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
             a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
             a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
             a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
             a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
        FROM avaliacao a
        JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.turma_id = $1
      `,
    ];

    const result = await queryFirstWorking(dbConn, variants, [turma_id]);
    const avaliacao = result.rows || [];

    const notasInstrutor = avaliacao.map((a) => toScore(a.desempenho_instrutor)).filter((v) => v != null);
    const media_instrutor = notasInstrutor.length
      ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
      : null;

    const notasEvento = avaliacao.map((a) => mediaNotasEventoDe(a)).filter((v) => v != null);
    const media_evento = notasEvento.length ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1) : null;

    const comentarios = avaliacao
      .filter(
        (a) =>
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    const inscritosRes = await dbConn.query(`SELECT COUNT(*)::int AS total FROM inscricoes WHERE turma_id = $1`, [turma_id]);
    const total_inscritos = inscritosRes.rows?.[0]?.total ?? 0;

    const turmaRes = await dbConn.query(`SELECT data_inicio, data_fim FROM turmas WHERE id = $1`, [turma_id]);
    if (!turmaRes.rowCount) return res.status(404).json({ erro: "Turma não encontrada." });

    const { data_inicio, data_fim } = turmaRes.rows[0];
    const datasTurma = gerarIntervaloYMD(data_inicio, data_fim);
    const totalDias = datasTurma.length;

    const presencasRes = await dbConn.query(`SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`, [turma_id]);
    const mapaPresencas = Object.create(null);

    for (const row of presencasRes.rows || []) {
      if (row.presente === false) continue;
      const ymd = toYMDLocal(row.data_presenca);
      if (!ymd) continue;
      const uid = String(row.usuario_id);
      if (!mapaPresencas[uid]) mapaPresencas[uid] = new Set();
      mapaPresencas[uid].add(ymd);
    }

    let total_presentes = 0;
    if (totalDias > 0) {
      for (const uid of Object.keys(mapaPresencas)) {
        const qtd = mapaPresencas[uid].size;
        const freq = (qtd / totalDias) * 100;
        if (freq >= 75) total_presentes++;
      }
    }

    const presenca_media = total_inscritos > 0 ? Math.round((total_presentes / total_inscritos) * 100) : 0;

    return res.json({
      turma_id,
      total_inscritos,
      total_presentes,
      presenca_media,
      total_avaliacao: avaliacao.length,
      media_evento,
      media_instrutor,
      comentarios,
      avaliacao,
    });
  } catch (err) {
    console.error("[avaliacao] ❌ erro ao buscar avaliações da turma:", { rid: rid(req), msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/** GET /api/avaliacao/evento/:evento_id  (admin) */
async function avaliacaoPorEvento(req, res) {
  const dbConn = getDb(req);
  const evento_id = Number(req.params.evento_id);
  if (!Number.isFinite(evento_id) || evento_id <= 0) return res.status(400).json({ erro: "evento_id inválido." });

  try {
    const variants = [
      `
      SELECT u.nome,
             a.desempenho_instrutor,
             a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
             a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
             a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
             a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
             a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
        FROM avaliacoes a
        JOIN usuarios u ON u.id = a.usuario_id
        JOIN turmas   t ON t.id = a.turma_id
       WHERE t.evento_id = $1
      `,
      `
      SELECT u.nome,
             a.desempenho_instrutor,
             a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
             a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
             a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
             a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
             a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
        FROM avaliacao a
        JOIN usuarios u ON u.id = a.usuario_id
        JOIN turmas   t ON t.id = a.turma_id
       WHERE t.evento_id = $1
      `,
    ];

    const result = await queryFirstWorking(dbConn, variants, [evento_id]);
    const avaliacao = result.rows || [];

    const notasInstrutor = avaliacao.map((a) => toScore(a.desempenho_instrutor)).filter((v) => v != null);
    const media_instrutor = notasInstrutor.length
      ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1)
      : null;

    const notasEvento = avaliacao.map((a) => mediaNotasEventoDe(a)).filter((v) => v != null);
    const media_evento = notasEvento.length ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1) : null;

    const comentarios = avaliacao
      .filter(
        (a) =>
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim())
      )
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    return res.json({
      evento_id,
      media_evento,
      media_instrutor,
      comentarios,
    });
  } catch (err) {
    console.error("[avaliacao] ❌ erro ao buscar avaliações do evento:", { rid: rid(req), msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações do evento." });
  }
}

/** GET /api/admin/avaliacao/eventos  (admin) */
async function listarEventosComAvaliacao(_req, res) {
  try {
    const sql = `
      WITH turmas_com_count AS (
        SELECT t.id, t.evento_id,
               COUNT(a.id) AS total_respostas,
               MIN(t.data_inicio) AS di, MAX(t.data_fim) AS df
          FROM turmas t
          LEFT JOIN avaliacoes a ON a.turma_id = t.id
         GROUP BY t.id
      ),
      eventos_agreg AS (
        SELECT e.id,
               e.titulo AS titulo,
               MIN(t.di) AS di,
               MAX(t.df) AS df,
               SUM(t.total_respostas)::int AS total_respostas
          FROM eventos e
          JOIN turmas_com_count t ON t.evento_id = e.id
         GROUP BY e.id, e.titulo
      )
      SELECT *
        FROM eventos_agreg
       WHERE total_respostas > 0
       ORDER BY di DESC NULLS LAST, id DESC;
    `;
    const { rows } = await db.query(sql, []);
    return res.json(rows || []);
  } catch (err) {
    console.error("[adminAvaliacao] listarEventosComAvaliacao:", err?.message || err);
    return res.status(500).json({ error: "Erro ao listar eventos com avaliações." });
  }
}

/** GET /api/admin/avaliacao/evento/:evento_id  (admin) */
async function obterAvaliacaoDoEvento(req, res) {
  const eventoId = Number(req.params.evento_id);
  if (!Number.isFinite(eventoId) || eventoId <= 0) return res.status(400).json({ error: "evento_id inválido" });

  try {
    const { rows: turmas } = await db.query(
      `
      SELECT t.id, t.nome, COUNT(a.id)::int AS total_respostas
        FROM turmas t
        LEFT JOIN avaliacoes a ON a.turma_id = t.id
       WHERE t.evento_id = $1
       GROUP BY t.id, t.nome
       ORDER BY t.id
      `,
      [eventoId]
    );

    const { rows: respostasRaw } = await db.query(
      `
      SELECT 
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE t.evento_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [eventoId]
    );

    const respostas = (respostasRaw || []).map((r) => ({
      ...r,
      __turmaId: r.turma_id,
      __turmaNome: r.turma_nome,
    }));

    const dist = {};
    const medias = {};
    for (const c of CAMPOS_OBJETIVOS) dist[c] = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    for (const r of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const s = toScore(r[campo]);
        if (s != null) dist[campo][String(Math.round(s))] += 1;
      }
    }
    for (const campo of CAMPOS_OBJETIVOS) medias[campo] = mediaFromDist(dist[campo]);

    const textos = {};
    for (const c of CAMPOS_TEXTOS) textos[c] = respostas.map((r) => pickText(r[c])).filter(Boolean);

    const mediasOficiais = CAMPOS_MEDIA_OFICIAL.map((c) => medias[c]).filter((x) => Number.isFinite(x));
    const mediaOficial = mediasOficiais.length
      ? Number((mediasOficiais.reduce((a, b) => a + b, 0) / mediasOficiais.length).toFixed(2))
      : null;

    return res.json({
      respostas,
      agregados: { total: respostas.length, dist, medias, textos, mediaOficial },
      turmas: turmas || [],
    });
  } catch (err) {
    console.error("[adminAvaliacao] obterAvaliacaoDoEvento:", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter avaliações do evento." });
  }
}

/** GET /api/admin/avaliacao/turma/:turma_id  (admin) */
async function obterAvaliacaoDaTurma(req, res) {
  const turmaId = Number(req.params.turma_id);
  if (!Number.isFinite(turmaId) || turmaId <= 0) return res.status(400).json({ error: "turma_id inválido" });

  try {
    const { rows } = await db.query(
      `
      SELECT 
        a.id,
        a.turma_id,
        t.nome AS turma_nome,
        a.usuario_id,
        u.nome AS usuario_nome,
        a.data_avaliacao AS criado_em,
        ${CAMPOS_OBJETIVOS.map((c) => `a.${c} AS ${c}`).join(", ")},
        ${CAMPOS_TEXTOS.map((c) => `a.${c} AS ${c}`).join(", ")}
      FROM avaliacoes a
      JOIN turmas t ON t.id = a.turma_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.turma_id = $1
      ORDER BY a.data_avaliacao DESC, a.id DESC
      `,
      [turmaId]
    );
    return res.json(rows || []);
  } catch (err) {
    console.error("[adminAvaliacao] obterAvaliacaoDaTurma:", err?.message || err);
    return res.status(500).json({ error: "Erro ao obter avaliações da turma." });
  }
}

/* ────────────────────────────────────────────────────────────────
   Exports
─────────────────────────────────────────────────────────────── */
module.exports = {
  // Usuário / Instrutor
  enviarAvaliacao,
  listarAvaliacaoDisponiveis,
  listarPorTurmaParaInstrutor,

  // Administração / Analytics
  avaliacaoPorTurma,
  avaliacaoPorEvento,

  // Admin legacy endpoints
  listarEventosComAvaliacao,
  obterAvaliacaoDoEvento,
  obterAvaliacaoDaTurma,
};
