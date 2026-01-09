// 📁 src/controllers/avaliacoesController.js
/* eslint-disable no-console */
const dbFallback = require("../db");
const { gerarNotificacoesDeCertificado } = require("./notificacoesController");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================
   Date-only safe helpers
   (evita new Date("YYYY-MM-DD"))
========================= */
function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function ymdToLocalDate(ymd) {
  // cria Date em timezone local sem parsing ISO
  const [y, m, d] = String(ymd).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function toYMDLocal(dateLike) {
  // Se já for "YYYY-MM-DD", devolve igual (não faz Date parsing)
  if (isYmd(dateLike)) return dateLike;

  // Se vier Date do Postgres, ok
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
  for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    out.push(toYMDLocal(d));
  }
  return out;
}

/* =========================
   DB helpers
========================= */
function getDb(req) {
  return req?.db ?? dbFallback;
}
function getUserId(req) {
  return req.user?.id ?? req.user?.usuario_id ?? null;
}
function getPerfis(user) {
  const raw = user?.perfis ?? user?.perfil ?? "";
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/* =========================
   Nota helpers
========================= */
// Converte enum/valor textual para número (1..5)
function notaEnumParaNumero(valor) {
  if (valor == null) return null;
  const raw = String(valor).trim();
  if (!raw) return null;

  // se já veio número (ou texto "1".."5")
  const n = Number(raw.replace(",", "."));
  if (Number.isFinite(n) && n >= 1 && n <= 5) return n;

  // normaliza para comparar textos
  const v = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove acentos

  switch (v) {
    case "otimo":
    case "excelente":
    case "muito bom":
      return 5;
    case "bom":
      return 4;
    case "regular":
    case "medio":
    case "médio":
      return 3;
    case "ruim":
      return 2;
    case "pessimo":
    case "péssimo":
    case "muito ruim":
      return 1;
    default:
      return null;
  }
}

// Campos de “notas de evento” (exclui desempenho do instrutor)
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

function mediaNotasEventoDe(aval) {
  let soma = 0;
  let n = 0;
  for (const campo of NOTAS_EVENTO) {
    const v = notaEnumParaNumero(aval[campo]);
    if (v != null) {
      soma += v;
      n++;
    }
  }
  return n ? soma / n : null;
}

/* =========================
   Regras de campos
========================= */
const CAMPOS_OBRIGATORIOS = [
  "desempenho_instrutor",
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

// opcionais por tipo
function filtrarCamposPorTipoEvento(tipoEvento, payload) {
  // aceita legado: se tipo não existe, não bloqueia nada
  const tipo = String(tipoEvento || "").toLowerCase();

  // exposicao_trabalhos: só congresso/simpósio
  const allowExposicao = tipo === "congresso" || tipo === "simpósio" || tipo === "simposio";

  // apresentacao_oral_mostra / apresentacao_tcrs / oficinas: só congresso
  const allowCongressoOnly = tipo === "congresso";

  return {
    exposicao_trabalhos: allowExposicao ? (payload.exposicao_trabalhos ?? null) : null,
    apresentacao_oral_mostra: allowCongressoOnly ? (payload.apresentacao_oral_mostra ?? null) : null,
    apresentacao_tcrs: allowCongressoOnly ? (payload.apresentacao_tcrs ?? null) : null,
    oficinas: allowCongressoOnly ? (payload.oficinas ?? null) : null,
  };
}

/* =========================
   Helpers de elegibilidade
========================= */
async function obterContextoTurma(db, turmaId) {
  const { rows, rowCount } = await db.query(
    `
    SELECT
      t.id,
      t.evento_id,
      t.data_inicio,
      t.data_fim,
      t.horario_inicio,
      t.horario_fim,
      e.tipo AS evento_tipo
    FROM turmas t
    JOIN eventos e ON e.id = t.evento_id
    WHERE t.id = $1
    LIMIT 1
    `,
    [Number(turmaId)]
  );
  if (!rowCount) return null;
  return rows[0];
}

async function usuarioTemPresenca(db, usuarioId, turmaId) {
  const r = await db.query(
    `SELECT 1 FROM presencas WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [Number(usuarioId), Number(turmaId)]
  );
  return r.rowCount > 0;
}

async function usuarioAtingiu75(db, usuarioId, turmaId) {
  const r = await db.query(
    `
    SELECT
      (
        SELECT COUNT(DISTINCT p.data_presenca)::int
        FROM presencas p
        WHERE p.usuario_id = $1
          AND p.turma_id = t.id
      ) AS qtd_presencas,
      CEIL(0.75 * ((t.data_fim - t.data_inicio) + 1))::int AS minimo_75
    FROM turmas t
    WHERE t.id = $2
    LIMIT 1
    `,
    [Number(usuarioId), Number(turmaId)]
  );
  const row = r.rows?.[0];
  if (!row) return false;
  return Number(row.qtd_presencas) >= Number(row.minimo_75);
}

async function turmaEncerrada(db, turmaId) {
  const r = await db.query(
    `
    SELECT 1
    FROM turmas t
    WHERE t.id = $1
      AND (now() > (t.data_fim::timestamp + t.horario_fim))
    LIMIT 1
    `,
    [Number(turmaId)]
  );
  return r.rowCount > 0;
}

/* =========================
   Handlers
========================= */

/**
 * ✅ Envia avaliação de um evento
 * @route POST /api/avaliacoes
 */
async function enviarAvaliacao(req, res) {
  const usuario_id = getUserId(req);
  const db = getDb(req);

  const payload = req.body || {};
  const turma_id = payload.turma_id;
  const evento_id = payload.evento_id;

  if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });
  if (!turma_id || Number.isNaN(Number(turma_id))) return res.status(400).json({ erro: "turma_id inválido." });
  if (evento_id && Number.isNaN(Number(evento_id))) return res.status(400).json({ erro: "evento_id inválido." });

  // obrigatórios
  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (payload[campo] == null || String(payload[campo]).trim() === "") {
      return res.status(400).json({ erro: `Campo obrigatório '${campo}' faltando.` });
    }
  }

  try {
    // contexto da turma/evento (para campos condicionais e regras)
    const ctx = await obterContextoTurma(db, Number(turma_id));
    if (!ctx) return res.status(404).json({ erro: "Turma não encontrada." });

    // Se evento_id veio, valida consistência
    if (evento_id && Number(evento_id) !== Number(ctx.evento_id)) {
      return res.status(400).json({ erro: "evento_id não corresponde à turma_id." });
    }

    // Elegibilidade para avaliar (alinhado com /disponiveis):
    // - precisa ter presença (participou)
    // - turma encerrada
    // - frequência >= 75%
    const participou = await usuarioTemPresenca(db, usuario_id, Number(turma_id));
    if (!participou) return res.status(403).json({ erro: "Você não participou desta turma." });

    const encerrada = await turmaEncerrada(db, Number(turma_id));
    if (!encerrada) {
      return res.status(403).json({ erro: "A avaliação só fica disponível após o encerramento da turma." });
    }

    const atingiu75 = await usuarioAtingiu75(db, usuario_id, Number(turma_id));
    if (!atingiu75) {
      return res.status(403).json({ erro: "Você ainda não atingiu a frequência mínima (75%) para avaliar." });
    }

    // Evita duplicidade
    const existente = await db.query(
      `SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
      [Number(usuario_id), Number(turma_id)]
    );
    if (existente.rowCount > 0) return res.status(400).json({ erro: "Você já avaliou esta turma." });

    // Campos opcionais por tipo de evento (congresso/simpósio)
    const opcionais = filtrarCamposPorTipoEvento(ctx.evento_tipo, payload);

    // Persiste avaliação
    const insertRes = await db.query(
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
      [
        Number(usuario_id),
        Number(turma_id),

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
      ]
    );

    const avaliacao = insertRes.rows?.[0];

    console.log("[avaliacoes] avaliação registrada", {
      rid: req.requestId,
      avaliacao_id: avaliacao?.id,
      usuario_id: Number(usuario_id),
      turma_id: Number(turma_id),
    });

    // 🔔 Gera notificação/certificado se elegível (best-effort)
    try {
      await gerarNotificacoesDeCertificado(Number(usuario_id), Number(turma_id));
    } catch (e) {
      console.warn("[avaliacoes] ⚠️ erro ao agendar/gerar certificado:", {
        rid: req.requestId,
        usuario_id: Number(usuario_id),
        turma_id: Number(turma_id),
        msg: e?.message,
      });
    }

    return res.status(201).json({
      mensagem: "Avaliação registrada com sucesso. Se elegível, seu certificado será liberado.",
      avaliacao,
    });
  } catch (err) {
    console.error("[avaliacoes] ❌ erro ao registrar avaliação:", { rid: req.requestId, msg: err?.message, stack: IS_DEV ? err?.stack : undefined });
    return res.status(500).json({ erro: "Erro ao registrar avaliação." });
  }
}

/**
 * 📋 Lista avaliações pendentes do usuário
 * @route GET /api/avaliacoes/disponiveis/:usuario_id
 */
async function listarAvaliacoesDisponiveis(req, res) {
  const db = getDb(req);
  const { usuario_id } = req.params;

  if (!usuario_id || Number.isNaN(Number(usuario_id))) {
    return res.status(400).json({ erro: "usuario_id inválido." });
  }

  try {
    const result = await db.query(
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
          ) >= CEIL(0.75 * ( (t.data_fim - t.data_inicio) + 1 ))
        )
      ORDER BY t.data_fim DESC
      `,
      [Number(usuario_id)]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("[avaliacoes] ❌ erro ao buscar avaliações disponíveis:", { rid: req.requestId, msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações disponíveis." });
  }
}

/**
 * 🧑‍🏫 Avaliações da turma **do instrutor logado** (para a página do instrutor)
 * @route GET /api/avaliacoes/turma/:turma_id
 */
async function listarPorTurmaParaInstrutor(req, res) {
  const db = getDb(req);
  const user = req.user || {};
  const usuarioId = Number(getUserId(req));
  const perfis = getPerfis(user);

  const { turma_id } = req.params;

  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });
  if (!turma_id || Number.isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  try {
    const isAdmin = perfis.includes("administrador");

    // Só exige vínculo se NÃO for admin
    if (!isAdmin) {
      const chk = await db.query(
        `
        SELECT 1
          FROM turmas t
         WHERE t.id = $2
           AND (
             EXISTS (
               SELECT 1
                 FROM turma_instrutor ti
                WHERE ti.turma_id = t.id
                  AND ti.instrutor_id = $1
             )
             OR
             EXISTS (
               SELECT 1
                 FROM evento_instrutor ei
                WHERE ei.evento_id = t.evento_id
                  AND ei.instrutor_id = $1
             )
           )
        LIMIT 1
        `,
        [usuarioId, Number(turma_id)]
      );

      if (chk.rowCount === 0) return res.status(403).json({ erro: "Acesso negado à turma." });
    }

    const { rows } = await db.query(
      `SELECT
         id,
         turma_id,
         usuario_id,
         desempenho_instrutor,
         divulgacao_evento, recepcao, credenciamento, material_apoio,
         pontualidade, sinalizacao_local, conteudo_temas,
         estrutura_local, acessibilidade, limpeza, inscricao_online,
         exposicao_trabalhos, apresentacao_oral_mostra, apresentacao_tcrs, oficinas,
         gostou_mais, sugestoes_melhoria, comentarios_finais,
         data_avaliacao
       FROM avaliacoes
      WHERE turma_id = $1
      ORDER BY id DESC`,
      [Number(turma_id)]
    );

    // headers de debug só em DEV
    if (IS_DEV) {
      res.setHeader("X-Debug-User", String(usuarioId));
      res.setHeader("X-Debug-Perfis", perfis.join(","));
      res.setHeader("X-Debug-Avaliacoes-Count", String(rows.length));
    }

    console.log(`[avaliacoes] listarPorTurmaParaInstrutor turma=${turma_id} rows=${rows.length}`);
    return res.json(rows);
  } catch (err) {
    console.error("[avaliacoes] ❌ listarPorTurmaParaInstrutor:", { rid: req.requestId, msg: err?.message, stack: IS_DEV ? err?.stack : undefined });
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/**
 * 📊 Avaliações de uma turma – Painel do administrador (todas as respostas)
 * @route GET /api/avaliacoes/turma/:turma_id/all
 *
 * Mantido para uso administrativo/analítico (retorna objeto com agregados).
 */
async function avaliacoesPorTurma(req, res) {
  const db = getDb(req);
  const { turma_id } = req.params;

  if (!turma_id || Number.isNaN(Number(turma_id))) {
    return res.status(400).json({ erro: "ID de turma inválido." });
  }

  try {
    // Todas as avaliações da turma (sem filtro de instrutor)
    const result = await db.query(
      `SELECT u.nome,
              a.desempenho_instrutor,
              a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
              a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
              a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
              a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
              a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
         FROM avaliacoes a
         JOIN usuarios u ON u.id = a.usuario_id
        WHERE a.turma_id = $1`,
      [Number(turma_id)]
    );

    const avaliacoes = result.rows || [];

    // ⭐ Médias
    const notasInstrutor = avaliacoes
      .map((a) => notaEnumParaNumero(a.desempenho_instrutor))
      .filter((v) => v != null);
    const media_instrutor =
      notasInstrutor.length ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1) : null;

    const notasEvento = avaliacoes.map((a) => mediaNotasEventoDe(a)).filter((v) => v != null);
    const media_evento =
      notasEvento.length ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1) : null;

    // 🗨️ Comentários
    const comentarios = avaliacoes
      .filter((a) => {
        const hasText =
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim());
        return Boolean(hasText);
      })
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    // 👥 Total de inscritos
    const inscritosRes = await db.query(`SELECT COUNT(*)::int AS total FROM inscricoes WHERE turma_id = $1`, [
      Number(turma_id),
    ]);
    const total_inscritos = inscritosRes.rows?.[0]?.total ?? 0;

    // 🗓️ Datas da turma
    const turmaRes = await db.query(`SELECT data_inicio, data_fim FROM turmas WHERE id = $1`, [Number(turma_id)]);
    if (turmaRes.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    const { data_inicio, data_fim } = turmaRes.rows[0];
    const datasTurma = gerarIntervaloYMD(data_inicio, data_fim);
    const totalDias = datasTurma.length;

    // ✅ Presenças (datas em YMD local)
    const presencasRes = await db.query(`SELECT usuario_id, data_presenca FROM presencas WHERE turma_id = $1`, [
      Number(turma_id),
    ]);

    const mapaPresencas = Object.create(null); // { usuario_id: Set<YMD> }
    for (const { usuario_id, data_presenca } of presencasRes.rows || []) {
      const ymd = toYMDLocal(data_presenca);
      if (!ymd) continue;
      if (!mapaPresencas[usuario_id]) mapaPresencas[usuario_id] = new Set();
      mapaPresencas[usuario_id].add(ymd);
    }

    // Presença “válida” (>= 75% dos dias)
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
      turma_id: Number(turma_id),
      total_inscritos,
      total_presentes,
      presenca_media, // %
      total_avaliacoes: avaliacoes.length,
      media_evento,
      media_instrutor,
      comentarios,
      avaliacoes,
    });
  } catch (err) {
    console.error("[avaliacoes] ❌ erro ao buscar avaliações da turma:", { rid: req.requestId, msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações da turma." });
  }
}

/**
 * 📈 Avaliações de um evento – Painel do administrador
 * @route GET /api/avaliacoes/evento/:evento_id
 */
async function avaliacoesPorEvento(req, res) {
  const db = getDb(req);
  const { evento_id } = req.params;

  if (!evento_id || Number.isNaN(Number(evento_id))) {
    return res.status(400).json({ erro: "evento_id inválido." });
  }

  try {
    const result = await db.query(
      `SELECT u.nome,
              a.desempenho_instrutor,
              a.divulgacao_evento, a.recepcao, a.credenciamento, a.material_apoio, a.pontualidade,
              a.sinalizacao_local, a.conteudo_temas, a.estrutura_local, a.acessibilidade,
              a.limpeza, a.inscricao_online, a.exposicao_trabalhos,
              a.apresentacao_oral_mostra, a.apresentacao_tcrs, a.oficinas,
              a.gostou_mais, a.sugestoes_melhoria, a.comentarios_finais
         FROM avaliacoes a
         JOIN usuarios u ON u.id = a.usuario_id
         JOIN turmas   t ON t.id = a.turma_id
        WHERE t.evento_id = $1`,
      [Number(evento_id)]
    );

    const avaliacoes = result.rows || [];

    const notasInstrutor = avaliacoes.map((a) => notaEnumParaNumero(a.desempenho_instrutor)).filter((v) => v != null);
    const media_instrutor =
      notasInstrutor.length ? (notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length).toFixed(1) : null;

    const notasEvento = avaliacoes.map((a) => mediaNotasEventoDe(a)).filter((v) => v != null);
    const media_evento =
      notasEvento.length ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1) : null;

    const comentarios = avaliacoes
      .filter((a) => {
        const hasText =
          (a.gostou_mais && String(a.gostou_mais).trim()) ||
          (a.sugestoes_melhoria && String(a.sugestoes_melhoria).trim()) ||
          (a.comentarios_finais && String(a.comentarios_finais).trim());
        return Boolean(hasText);
      })
      .map((a) => ({
        nome: a.nome,
        desempenho_instrutor: a.desempenho_instrutor,
        gostou_mais: a.gostou_mais,
        sugestoes_melhoria: a.sugestoes_melhoria,
        comentarios_finais: a.comentarios_finais,
      }));

    return res.json({
      evento_id: Number(evento_id),
      media_evento,
      media_instrutor,
      comentarios,
    });
  } catch (err) {
    console.error("[avaliacoes] ❌ erro ao buscar avaliações do evento:", { rid: req.requestId, msg: err?.message });
    return res.status(500).json({ erro: "Erro ao buscar avaliações do evento." });
  }
}

module.exports = {
  enviarAvaliacao,
  listarAvaliacoesDisponiveis,
  listarPorTurmaParaInstrutor,
  avaliacoesPorTurma,
  avaliacoesPorEvento,
};
