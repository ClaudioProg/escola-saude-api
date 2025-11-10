// controllers/votacoesController.js
const { query, pool } = require("../db");

// Helpers de elegibilidade
async function checarElegibilidade({ userId, votacao, cliLat, cliLng }) {
  // Regra base: logado já passou no middleware
  // Unidade/local
  if (votacao.unidade_id) {
    const u = await query("SELECT unidade_id FROM usuarios WHERE id=$1", [userId]);
    const doMesmoLocal = u.rows[0]?.unidade_id && String(u.rows[0].unidade_id) === String(votacao.unidade_id);
    if (!doMesmoLocal) return { ok: false, motivo: "Somente pessoas desta unidade/local podem votar." };
  }

  // Geofence (opcional)
  if (votacao.geo_lat != null && votacao.geo_lng != null && votacao.geo_raio_m != null) {
    if (cliLat == null || cliLng == null) {
      return { ok: false, motivo: "É necessário permitir a localização para votar nesta pergunta." };
    }
    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371000; // m
    const dLat = toRad(cliLat - Number(votacao.geo_lat));
    const dLng = toRad(cliLng - Number(votacao.geo_lng));
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(Number(votacao.geo_lat))) *
        Math.cos(toRad(Number(cliLat))) *
        Math.sin(dLng / 2) ** 2;
    const dist = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist > Number(votacao.geo_raio_m)) {
      return { ok: false, motivo: "Você não está no local do evento para esta votação." };
    }
  }

  // Escopo + regra_elegibilidade
  if (votacao.escopo === "evento" && votacao.evento_id) {
    if (votacao.regra_elegibilidade === "inscrito") {
      const r = await query(`
        SELECT 1
          FROM inscricoes i
          JOIN turmas t ON t.id = i.turma_id
         WHERE i.usuario_id=$1 AND t.evento_id=$2
        LIMIT 1`, [userId, votacao.evento_id]);
      if (!r.rowCount) return { ok: false, motivo: "Somente inscritos no evento podem votar." };
    }
    if (votacao.regra_elegibilidade === "presente_hoje") {
      const r = await query(`
        SELECT 1
          FROM presencas p
          JOIN turmas t ON t.id = p.turma_id
         WHERE p.usuario_id=$1
           AND t.evento_id=$2
           AND p.presente = true
           AND p.data_presenca = CURRENT_DATE
        LIMIT 1`, [userId, votacao.evento_id]);
      if (!r.rowCount) return { ok: false, motivo: "Somente presentes hoje no evento podem votar." };
    }
    if (votacao.regra_elegibilidade === "presenca_minima") {
      const r = await query(`
        WITH total AS (
          SELECT COUNT(DISTINCT p2.data_presenca) tot
            FROM presencas p2
            JOIN turmas t2 ON t2.id = p2.turma_id
           WHERE t2.evento_id=$2
        ),
        pres AS (
          SELECT COUNT(*) ok
            FROM (
              SELECT p.usuario_id, p.turma_id,
                     COUNT(*)::float / NULLIF((SELECT tot FROM total),0) AS freq
                FROM presencas p
                JOIN turmas t ON t.id = p.turma_id
               WHERE t.evento_id=$2 AND p.usuario_id=$1 AND p.presente=true
               GROUP BY p.usuario_id, p.turma_id
            ) s
           WHERE freq >= 0.75
        )
        SELECT ok FROM pres`, [userId, votacao.evento_id]);
      if (!r.rowCount || Number(r.rows[0].ok) <= 0) {
        return { ok: false, motivo: "Somente quem atingiu presença mínima pode votar." };
      }
    }
  }

  if (votacao.escopo === "turma" && votacao.turma_id) {
    if (votacao.regra_elegibilidade === "inscrito") {
      const r = await query(`SELECT 1 FROM inscricoes WHERE usuario_id=$1 AND turma_id=$2 LIMIT 1`, [userId, votacao.turma_id]);
      if (!r.rowCount) return { ok: false, motivo: "Somente inscritos na turma podem votar." };
    }
    if (votacao.regra_elegibilidade === "presente_hoje") {
      const r = await query(`
        SELECT 1 FROM presencas
         WHERE usuario_id=$1 AND turma_id=$2 AND presente=true AND data_presenca=CURRENT_DATE
        LIMIT 1`, [userId, votacao.turma_id]);
      if (!r.rowCount) return { ok: false, motivo: "Somente presentes hoje na turma podem votar." };
    }
    if (votacao.regra_elegibilidade === "presenca_minima") {
      const r = await query(`
        WITH total AS (
          SELECT COUNT(DISTINCT data_presenca) tot FROM presencas WHERE turma_id=$2
        ),
        freq AS (
          SELECT COUNT(*)::float / NULLIF((SELECT tot FROM total),0) AS f
            FROM presencas
           WHERE usuario_id=$1 AND turma_id=$2 AND presente=true
        )
        SELECT 1 FROM freq WHERE f >= 0.75`, [userId, votacao.turma_id]);
      if (!r.rowCount) return { ok: false, motivo: "Somente quem atingiu presença mínima pode votar." };
    }
  }

  // Janela ativa
  if (votacao.status !== "ativa") return { ok: false, motivo: "Votação não está ativa." };
  if (votacao.inicio && new Date(votacao.inicio) > new Date()) return { ok: false, motivo: "Votação ainda não começou." };
  if (votacao.fim && new Date(votacao.fim) < new Date()) return { ok: false, motivo: "Votação encerrada." };

  return { ok: true };
}

exports.criarVotacao = async (req, res) => {
  const {
    titulo, descricao, tipo_selecao='unica', max_escolhas=1,
    status='rascunho', inicio, fim,
    escopo='global', evento_id, turma_id,
    unidade_id, geo_lat, geo_lng, geo_raio_m,
    regra_elegibilidade='logado'
  } = req.body;

  const q = `
    INSERT INTO votacoes
    (titulo,descricao,tipo_selecao,max_escolhas,status,inicio,fim,escopo,evento_id,turma_id,unidade_id,geo_lat,geo_lng,geo_raio_m,regra_elegibilidade,criado_por)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING *`;
  const { rows } = await query(q, [
    titulo, descricao, tipo_selecao, max_escolhas, status, inicio, fim, escopo, evento_id, turma_id,
    unidade_id, geo_lat, geo_lng, geo_raio_m, regra_elegibilidade, req.user.id
  ]);
  res.status(201).json(rows[0]);
};

exports.atualizarVotacao = async (req, res) => {
  const id = req.params.id;
  const campos = [
    "titulo","descricao","tipo_selecao","max_escolhas","status","inicio","fim",
    "escopo","evento_id","turma_id",
    "unidade_id","geo_lat","geo_lng","geo_raio_m",
    "regra_elegibilidade"
  ];
  const set = [];
  const vals = [];
  campos.forEach((c, i) => {
    if (c in req.body) {
      set.push(`${c}=$${set.length+1}`);
      vals.push(req.body[c]);
    }
  });
  set.push(`atualizado_em=now()`);
  const q = `UPDATE votacoes SET ${set.join(", ")} WHERE id=$${set.length+1} RETURNING *`;
  vals.push(id);
  const { rows } = await query(q, vals);
  if (!rows.length) return res.status(404).json({ erro: "Não encontrado" });
  res.json(rows[0]);
};

exports.criarOpcao = async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, ordem=0, ativo=true } = req.body;
  const { rows } = await query(`
    INSERT INTO votacao_opcoes (votacao_id, titulo, descricao, ordem, ativo)
    VALUES ($1,$2,$3,$4,$5) RETURNING *`, [id, titulo, descricao, ordem, ativo]);
  res.status(201).json(rows[0]);
};

exports.atualizarOpcao = async (req, res) => {
  const { id, opcaoId } = req.params;
  const { titulo, descricao, ordem, ativo } = req.body;
  const { rows } = await query(`
    UPDATE votacao_opcoes
       SET titulo=COALESCE($3,titulo),
           descricao=COALESCE($4,descricao),
           ordem=COALESCE($5,ordem),
           ativo=COALESCE($6,ativo)
     WHERE id=$2 AND votacao_id=$1
   RETURNING *`, [id, opcaoId, titulo, descricao, ordem, ativo]);
  if (!rows.length) return res.status(404).json({ erro: "Não encontrada" });
  res.json(rows[0]);
};

exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'rascunho'|'ativa'|'encerrada'
  const { rows } = await query(`UPDATE votacoes SET status=$2, atualizado_em=now() WHERE id=$1 RETURNING *`, [id, status]);
  if (!rows.length) return res.status(404).json({ erro: "Não encontrada" });
  res.json(rows[0]);
};

exports.listarVotacoesAdmin = async (req, res) => {
  const { rows } = await query(`SELECT * FROM votacoes ORDER BY criado_em DESC`, []);
  res.json(rows);
};
exports.obterVotacaoAdmin = async (req, res) => {
  const { id } = req.params;
  const v = await query(`SELECT * FROM votacoes WHERE id=$1`, [id]);
  if (!v.rowCount) return res.status(404).json({ erro: "Não encontrada" });
  const op = await query(`SELECT * FROM votacao_opcoes WHERE votacao_id=$1 ORDER BY ordem, id`, [id]);
  res.json({ ...v.rows[0], opcoes: op.rows });
};

exports.ranking = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(`
    SELECT opcao_id, opcao_titulo, votos
      FROM vw_resultados_votacao
     WHERE votacao_id=$1
     ORDER BY votos DESC, opcao_titulo ASC`, [id]);
  res.json(rows);
};

exports.listarVotacoesElegiveis = async (req, res) => {
  // Lista só as que o usuário pode votar e que não votou ainda
  const { rows } = await query(`
    SELECT v.*
      FROM votacoes v
 LEFT JOIN voto_submissoes vs ON vs.votacao_id=v.id AND vs.usuario_id=$1
     WHERE v.status='ativa'
       AND (v.inicio IS NULL OR v.inicio <= now())
       AND (v.fim IS NULL OR v.fim >= now())
       AND vs.id IS NULL
  ORDER BY v.inicio NULLS FIRST, v.criado_em DESC`, [req.user.id]);
  res.json(rows);
};

exports.votar = async (req, res) => {
  const votacaoId = Number(req.params.id);
  const { opcoes = [], cliLat = null, cliLng = null } = req.body;
  if (!Array.isArray(opcoes) || opcoes.length === 0) {
    return res.status(400).json({ erro: "Selecione pelo menos uma opção." });
  }

  const vRes = await query(`SELECT * FROM votacoes WHERE id=$1`, [votacaoId]);
  if (!vRes.rowCount) return res.status(404).json({ erro: "Votação não encontrada." });
  const votacao = vRes.rows[0];

  // Regras tipo seleção
  if (votacao.tipo_selecao === "unica" && opcoes.length !== 1) {
    return res.status(400).json({ erro: "Esta pergunta permite apenas uma opção." });
  }
  if (votacao.tipo_selecao === "multipla" && opcoes.length > Number(votacao.max_escolhas)) {
    return res.status(400).json({ erro: `Você pode escolher no máximo ${votacao.max_escolhas} opção(ões).` });
  }

  // Elegibilidade
  const eleg = await checarElegibilidade({
    userId: req.user.id,
    votacao,
    cliLat, cliLng
  });
  if (!eleg.ok) return res.status(403).json({ erro: eleg.motivo });

  // Confere se as opções pertencem à votação e se estão ativas
  const { rows: validOps } = await query(
    `SELECT id FROM votacao_opcoes WHERE votacao_id=$1 AND ativo=TRUE AND id = ANY($2::bigint[])`,
    [votacaoId, opcoes]
  );
  if (validOps.length !== opcoes.length) {
    return res.status(400).json({ erro: "Há opções inválidas para esta votação." });
  }

  // Transação: cria submissão (1 por usuário) + itens
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.ip;
    const ua = req.headers["user-agent"] || "";

    const ins = await client.query(`
      INSERT INTO voto_submissoes (votacao_id, usuario_id, ip, user_agent, cli_lat, cli_lng)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (votacao_id, usuario_id) DO NOTHING
      RETURNING id`, [votacaoId, req.user.id, ip, ua, cliLat, cliLng]);

    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ erro: "Você já votou nesta pergunta." });
    }

    const votoId = ins.rows[0].id;
    const values = opcoes.map((oid, i) => `($1, $${i+2})`).join(", ");
    await client.query(
      `INSERT INTO voto_submissoes_opcoes (voto_id, opcao_id) VALUES ${values}`,
      [votoId, ...opcoes]
    );

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, voto_id: votoId });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.status(500).json({ erro: "Falha ao registrar voto." });
  } finally {
    client.release();
  }
};
