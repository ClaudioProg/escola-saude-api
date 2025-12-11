/* eslint-disable no-console */
// ✅ src/controllers/solicitacoesCursoController.js
const { db, getClient } = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const logDev = (...a) => IS_DEV && console.log("[solicitacoesCurso]", ...a);

/* ───────────────────────── Helpers de auth/perfil ───────────────────────── */

function getUsuarioId(req) {
  // middleware padrão: req.user.id com { id, perfil: [...] }
  return req.user?.id || req.usuario?.id || req.userId || null;
}

function normalizarPerfil(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
  }
  return String(raw || "")
    .split(",")
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);
}

function isAdmin(req) {
  const raw = req.user?.perfil || req.usuario?.perfil || req.perfil;
  const arr = normalizarPerfil(raw);
  return arr.includes("administrador") || arr.includes("admin");
}

/* ───────────────────────── Listagem principal ───────────────────────── */

async function listarSolicitacoes(req, res) {
  const usuarioId = getUsuarioId(req);

  try {
    const sql = `
      SELECT
        s.id,
        s.titulo,
        s.descricao,
        s.publico_alvo,
        s.local,
        s.tipo,
        s.unidade_id,
        u.nome AS unidade_nome,
        s.modalidade,
        s.restrito,
        s.restricao_descricao,
        s.carga_horaria_total,
        s.gera_certificado,
        s.status,
        s.criador_id,
        uc.nome AS criador_nome,
        s.criado_em,
        s.atualizado_em,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', d.id,
              'data', to_char(d.data, 'YYYY-MM-DD'),
              'horario_inicio', to_char(d.horario_inicio, 'HH24:MI'),
              'horario_fim', to_char(d.horario_fim, 'HH24:MI')
            )
          ) FILTER (WHERE d.id IS NOT NULL),
          '[]'
        ) AS datas,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'usuario_id', pu.id,
              'nome', COALESCE(p.nome_externo, pu.nome)
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS palestrantes

      FROM solicitacoes_curso s
      LEFT JOIN unidades u ON u.id = s.unidade_id
      LEFT JOIN usuarios uc ON uc.id = s.criador_id
      LEFT JOIN solicitacao_curso_datas d ON d.solicitacao_id = s.id
      LEFT JOIN solicitacao_curso_palestrantes p ON p.solicitacao_id = s.id
      LEFT JOIN usuarios pu ON pu.id = p.palestrante_id
      GROUP BY s.id, u.nome, uc.nome
      ORDER BY s.criado_em DESC NULLS LAST
    `;

    const result = await db.query(sql);
    const uid = Number(usuarioId);

    const data = result.rows.map((row) => ({
      ...row,
      pode_editar: isAdmin(req) || row.criador_id === uid,
    }));

    return res.status(200).json(data);
  } catch (err) {
    console.error("[solicitacoesCurso] Erro ao listar:", err);
    return res
      .status(500)
      .json({ message: "Erro ao listar solicitações de curso." });
  }
}

/* ───────────────────────── Listar tipos ───────────────────────── */

async function listarTipos(_req, res) {
  try {
    const sql = `
      SELECT DISTINCT tipo
      FROM solicitacoes_curso
      WHERE tipo IS NOT NULL AND tipo <> ''
      ORDER BY tipo
    `;
    const result = await db.query(sql);
    const tipos = result.rows.map((r) => r.tipo);
    return res.status(200).json(tipos);
  } catch (err) {
    console.error("[solicitacoesCurso] Erro ao listar tipos:", err);
    return res
      .status(500)
      .json({ message: "Erro ao listar tipos de curso." });
  }
}

/* ───────────────────────── Criação ───────────────────────── */

async function criarSolicitacao(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  const {
    titulo,
    descricao,
    publico_alvo,
    local,
    tipo,
    unidade_id,
    modalidade,
    restrito,
    restricao_descricao,
    carga_horaria_total,
    gera_certificado,
    status,
    datas = [],
    palestrantes = [],
  } = req.body || {};

  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ message: "Informe o título do curso." });
  }

  if (!Array.isArray(datas) || datas.length === 0) {
    return res.status(400).json({
      message: "Informe ao menos uma data para a solicitação.",
    });
  }

  let client;
  try {
    client = await getClient(); // ✅ pega client do pool
    await client.query("BEGIN");

    const insertSql = `
      INSERT INTO solicitacoes_curso (
        titulo, descricao, publico_alvo, local, tipo, unidade_id,
        modalidade, restrito, restricao_descricao,
        carga_horaria_total, gera_certificado, status,
        criador_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,COALESCE($12,'planejado'),
        $13
      )
      RETURNING *
    `;

    const insertParams = [
      titulo.trim(),
      descricao ?? null,
      publico_alvo ?? null,
      local ?? null,
      tipo ?? null,
      unidade_id ? Number(unidade_id) : null,
      modalidade ?? null,
      !!restrito,
      restricao_descricao ?? null,
      carga_horaria_total != null ? Number(carga_horaria_total) : null,
      !!gera_certificado,
      status,
      Number(usuarioId),
    ];

    const { rows } = await client.query(insertSql, insertParams);
    const solicitacao = rows[0];

    // datas
    const insertDataSql = `
      INSERT INTO solicitacao_curso_datas
        (solicitacao_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datas) {
      if (!d || !d.data) continue;
      await client.query(insertDataSql, [
        solicitacao.id,
        d.data, // "YYYY-MM-DD"
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    // palestrantes — aceita string simples OU objeto
    const insertPalesSql = `
      INSERT INTO solicitacao_curso_palestrantes
        (solicitacao_id, palestrante_id, nome_externo)
      VALUES ($1, $2, $3)
    `;
    for (const p of palestrantes) {
      if (!p) continue;

      if (typeof p === "string") {
        await client.query(insertPalesSql, [
          solicitacao.id,
          null,
          p.trim() || null,
        ]);
        continue;
      }

      const palestranteId = p.usuario_id || p.id || null;
      const nomeExterno =
        p.nome_externo ||
        p.nome ||
        p.label ||
        p.value ||
        null;

      await client.query(insertPalesSql, [
        solicitacao.id,
        palestranteId ? Number(palestranteId) : null,
        nomeExterno,
      ]);
    }

    await client.query("COMMIT");

    logDev("Solicitação criada:", solicitacao.id);
    return res.status(201).json({ id: solicitacao.id });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("[solicitacoesCurso] Erro ao criar:", err);
    return res
      .status(500)
      .json({ message: "Erro ao criar solicitação de curso." });
  } finally {
    if (client) client.release();
  }
}

/* ───────────────────────── Atualização ───────────────────────── */

async function atualizarSolicitacao(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  const { id } = req.params;
  const solicitacaoId = Number(id);

  const {
    titulo,
    descricao,
    publico_alvo,
    local,
    tipo,
    unidade_id,
    modalidade,
    restrito,
    restricao_descricao,
    carga_horaria_total,
    gera_certificado,
    status,
    datas = [],
    palestrantes = [],
  } = req.body || {};

  let client;
  try {
    client = await getClient();

    // verifica permissão
    const checkSql = `
      SELECT criador_id
      FROM solicitacoes_curso
      WHERE id = $1
    `;
    const check = await client.query(checkSql, [solicitacaoId]);
    if (check.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Solicitação não encontrada." });
    }

    const criadorId = check.rows[0].criador_id;
    if (!isAdmin(req) && criadorId !== Number(usuarioId)) {
      return res.status(403).json({
        message: "Sem permissão para editar esta solicitação.",
      });
    }

    await client.query("BEGIN");

    const updateSql = `
      UPDATE solicitacoes_curso SET
        titulo = $1,
        descricao = $2,
        publico_alvo = $3,
        local = $4,
        tipo = $5,
        unidade_id = $6,
        modalidade = $7,
        restrito = $8,
        restricao_descricao = $9,
        carga_horaria_total = $10,
        gera_certificado = $11,
        status = COALESCE($12, status),
        atualizado_em = NOW()
      WHERE id = $13
    `;

    const params = [
      titulo?.trim() || null,
      descricao ?? null,
      publico_alvo ?? null,
      local ?? null,
      tipo ?? null,
      unidade_id ? Number(unidade_id) : null,
      modalidade ?? null,
      !!restrito,
      restricao_descricao ?? null,
      carga_horaria_total != null ? Number(carga_horaria_total) : null,
      !!gera_certificado,
      status,
      solicitacaoId,
    ];

    await client.query(updateSql, params);

    // zera datas e cadastra novamente
    await client.query(
      "DELETE FROM solicitacao_curso_datas WHERE solicitacao_id = $1",
      [solicitacaoId]
    );

    const insertDataSql = `
      INSERT INTO solicitacao_curso_datas
        (solicitacao_id, data, horario_inicio, horario_fim)
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of datas) {
      if (!d || !d.data) continue;
      await client.query(insertDataSql, [
        solicitacaoId,
        d.data,
        d.horario_inicio || null,
        d.horario_fim || null,
      ]);
    }

    // zera palestrantes e cadastra novamente
    await client.query(
      "DELETE FROM solicitacao_curso_palestrantes WHERE solicitacao_id = $1",
      [solicitacaoId]
    );

    const insertPalesSql = `
      INSERT INTO solicitacao_curso_palestrantes
        (solicitacao_id, palestrante_id, nome_externo)
      VALUES ($1, $2, $3)
    `;
    for (const p of palestrantes) {
      if (!p) continue;

      if (typeof p === "string") {
        await client.query(insertPalesSql, [
          solicitacaoId,
          null,
          p.trim() || null,
        ]);
        continue;
      }

      const palestranteId = p.usuario_id || p.id || null;
      const nomeExterno =
        p.nome_externo ||
        p.nome ||
        p.label ||
        p.value ||
        null;

      await client.query(insertPalesSql, [
        solicitacaoId,
        palestranteId ? Number(palestranteId) : null,
        nomeExterno,
      ]);
    }

    await client.query("COMMIT");
    logDev("Solicitação atualizada:", solicitacaoId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {}
    }
    console.error("[solicitacoesCurso] Erro ao atualizar:", err);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar solicitação de curso." });
  } finally {
    if (client) client.release();
  }
}

/* ───────────────────────── Exclusão ───────────────────────── */

async function excluirSolicitacao(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  const { id } = req.params;
  const solicitacaoId = Number(id);

  try {
    const checkSql = `
      SELECT criador_id
      FROM solicitacoes_curso
      WHERE id = $1
    `;
    const check = await db.query(checkSql, [solicitacaoId]);
    if (check.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Solicitação não encontrada." });
    }

    const criadorId = check.rows[0].criador_id;
    if (!isAdmin(req) && criadorId !== Number(usuarioId)) {
      return res.status(403).json({
        message: "Sem permissão para excluir esta solicitação.",
      });
    }

    await db.query("DELETE FROM solicitacoes_curso WHERE id = $1", [
      solicitacaoId,
    ]);
    logDev("Solicitação excluída:", solicitacaoId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[solicitacoesCurso] Erro ao excluir:", err);
    return res
      .status(500)
      .json({ message: "Erro ao excluir solicitação de curso." });
  }
}

module.exports = {
  listarSolicitacoes,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
};
