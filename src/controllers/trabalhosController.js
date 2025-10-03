// api/controllers/trabalhosController.js
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { db } = require("../db");

// Notificações (novas)
const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
} = require("./notificacoesController");

// Helpers
function isYYYYMM(s) { return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function assert(cond, msg) { if (!cond) { const e = new Error(msg); e.status = 400; throw e; } }
function withinLen(s, max) { return typeof s === "string" && s.trim().length <= max; }

async function getChamadaValidacao(chamadaId) {
  const c = await db.oneOrNone(`
    SELECT * ,
      (now() AT TIME ZONE 'America/Sao_Paulo') <= prazo_final_br AS dentro_prazo
    FROM trabalhos_chamadas WHERE id=$1
  `, [chamadaId]);
  if (!c) { const e = new Error("Chamada inexistente."); e.status = 404; throw e; }
  return c;
}

exports.criarSubmissao = async (req, res, next) => {
  try {
    const chamadaId = Number(req.params.chamadaId);
    const ch = await getChamadaValidacao(chamadaId);
    assert(ch.publicado, "Chamada não publicada.");
    assert(ch.dentro_prazo, "O prazo de submissão encerrou.");

    const {
      titulo, inicio_experiencia, linha_tematica_id,
      introducao, objetivos, metodo, resultados,
      consideracoes, bibliografia, coautores = []
    } = req.body;

    // 🔢 Limites configuráveis (fallback para os padrões)
    const lim = {
      titulo: Number(ch?.limites?.titulo) || 100,
      introducao: Number(ch?.limites?.introducao) || 2000,
      objetivos: Number(ch?.limites?.objetivos) || 1000,
      metodo: Number(ch?.limites?.metodo) || 1500,
      resultados: Number(ch?.limites?.resultados) || 1500,
      consideracoes: Number(ch?.limites?.consideracoes) || 1000,
    };

    // Regras do edital
    assert(titulo && withinLen(titulo, lim.titulo), `Título obrigatório (até ${lim.titulo} caracteres).`);
    assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");
    assert(
      inicio_experiencia >= ch.periodo_experiencia_inicio &&
      inicio_experiencia <= ch.periodo_experiencia_fim,
      "Início fora do período permitido pela chamada."
    );

    // Limites de caracteres (dinâmicos)
    assert(introducao && withinLen(introducao, lim.introducao), `Introdução até ${lim.introducao} caracteres.`);
    assert(objetivos && withinLen(objetivos, lim.objetivos), `Objetivos até ${lim.objetivos} caracteres.`);
    assert(metodo && withinLen(metodo, lim.metodo), `Método/Descrição da prática até ${lim.metodo} caracteres.`);
    assert(resultados && withinLen(resultados, lim.resultados), `Resultados/Impactos até ${lim.resultados} caracteres.`);
    assert(consideracoes && withinLen(consideracoes, lim.consideracoes), `Considerações finais até ${lim.consideracoes} caracteres.`);
    if (bibliografia) assert(withinLen(bibliografia, 8000), "Bibliografia muito longa.");

    // Linha temática (agora 'codigo' pode ser nulo — tudo bem)
    const lt = await db.oneOrNone(
      `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
      [linha_tematica_id, chamadaId]
    );
    assert(lt, "Linha temática inválida para esta chamada.");

    // Cria submissão
    const ins = await db.one(`
      INSERT INTO trabalhos_submissoes
      (usuario_id, chamada_id, titulo, inicio_experiencia, linha_tematica_id, linha_tematica_codigo,
       introducao, objetivos, metodo, resultados, consideracoes, bibliografia, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'submetido')
      RETURNING id
    `, [
      req.user.id, chamadaId, titulo.trim(), inicio_experiencia,
      lt.id, lt.codigo || null,
      introducao, objetivos, metodo, resultados, consideracoes, bibliografia || null
    ]);

    // Coautores
    assert(Array.isArray(coautores) && coautores.length <= ch.max_coautores, `Máximo de ${ch.max_coautores} coautores.`);
    for (const c of coautores) {
      if (!c?.nome) continue;
      await db.none(`
        INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel)
        VALUES ($1,$2,$3,$4,$5)
      `, [ins.id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null]);
    }

    // Notificações (autor)
    await notificarSubmissaoCriada({
      usuario_id: req.user.id,
      chamada_titulo: ch.titulo,
      trabalho_titulo: titulo.trim(),
      submissao_id: ins.id,
    });
    await notificarStatusSubmissao({
      usuario_id: req.user.id,
      chamada_titulo: ch.titulo,
      trabalho_titulo: titulo.trim(),
      status: "submetido",
    });

    res.status(201).json({ ok: true, id: ins.id });
  } catch (err) { next(err); }
};

exports.atualizarPoster = async (req, res, next) => {
  try {
    assert(req.file, "Envie o arquivo .ppt/.pptx no campo 'poster'.");

    // pega submissão + chamada (para checar aceita_poster)
    const sub = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
              c.id AS chamada_id, c.titulo AS chamada_titulo, c.aceita_poster
         FROM trabalhos_submissoes s
         JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id=$1`,
      [req.params.id]
    );
    assert(sub, "Submissão não encontrada.");
    assert(req.user.perfil === "administrador" || sub.usuario_id === req.user.id, "Sem permissão.");
    assert(sub.aceita_poster, "Esta chamada não aceita envio de pôster.");

    const caminhoRel = path.relative(process.cwd(), req.file.path);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

    const arq = await db.one(`
      INSERT INTO trabalhos_arquivos (submissao_id, caminho, nome_original, mime_type, tamanho_bytes, hash_sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
    `, [sub.id, caminhoRel, req.file.originalname, req.file.mimetype, req.file.size, hash]);

    await db.none(`UPDATE trabalhos_submissoes SET poster_arquivo_id=$1, atualizado_em=NOW() WHERE id=$2`, [arq.id, sub.id]);

    // Notificação (autor)
    await notificarPosterAtualizado({
      usuario_id: req.user.id,
      chamada_titulo: sub.chamada_titulo,
      trabalho_titulo: sub.trabalho_titulo,
      arquivo_nome: req.file.originalname,
    });

    res.json({ ok: true, arquivo_id: arq.id });
  } catch (err) { next(err); }
};

exports.minhasSubmissoes = async (req, res, next) => {
  try {
    const rows = await db.any(`
      SELECT s.*, a.nome_original AS poster_nome,
             c.titulo AS chamada_titulo, c.prazo_final_br,
             (now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
      WHERE s.usuario_id=$1
      ORDER BY s.criado_em DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.obterSubmissao = async (req, res, next) => {
  try {
    const s = await db.oneOrNone(`
      SELECT s.*, a.nome_original AS poster_nome, a.caminho AS poster_caminho
      FROM trabalhos_submissoes s
      LEFT JOIN trabalhos_arquivos a ON a.id=s.poster_arquivo_id
      WHERE s.id=$1
    `, [req.params.id]);
    if (!s) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }
    if (req.user.perfil !== "administrador" && s.usuario_id !== req.user.id) { const e = new Error("Sem permissão."); e.status = 403; throw e; }

    const coautores = await db.any(`SELECT id, nome, email, unidade, papel FROM trabalhos_coautores WHERE submissao_id=$1 ORDER BY id`, [s.id]);
    res.json({ ...s, coautores });
  } catch (err) { next(err); }
};

exports.listarSubmissoesAdmin = async (req, res, next) => {
  try {
    const chamadaId = Number(req.params.chamadaId);
    const rows = await db.any(`
      SELECT s.id, s.titulo, s.usuario_id, s.status, s.linha_tematica_codigo, s.inicio_experiencia,
             u.nome AS autor_nome, u.email AS autor_email,
             COALESCE(ve.total_ponderado,0) AS total_escrita,
             COALESCE(vo.total_oral_ponderado,0) AS total_oral,
             (COALESCE(ve.total_ponderado,0)+COALESCE(vo.total_oral_ponderado,0)) AS total_geral
      FROM trabalhos_submissoes s
      JOIN usuarios u ON u.id = s.usuario_id
      LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
      LEFT JOIN vw_submissao_total_oral vo   ON vo.submissao_id = s.id
      WHERE s.chamada_id=$1
      ORDER BY total_geral DESC, s.id ASC
    `, [chamadaId]);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.avaliarEscrita = async (req, res, next) => {
  try {
    const { itens = [] } = req.body; // [{criterio_id, nota, comentarios}]
    const subId = Number(req.params.id);
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação.");

    // pega limites por critério
    const lims = await db.any(`
      SELECT id, escala_min, escala_max FROM trabalhos_chamada_criterios
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
    `, [subId]);
    const byId = new Map(lims.map(x => [x.id, x]));

    for (const it of itens) {
      const lim = byId.get(it.criterio_id);
      assert(lim, "Critério inválido.");
      assert(Number.isInteger(it.nota) && it.nota >= lim.escala_min && it.nota <= lim.escala_max, `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`);
      await db.none(`
        INSERT INTO trabalhos_avaliacoes_itens (submissao_id, avaliador_id, criterio_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
      `, [subId, req.user.id, it.criterio_id, it.nota, it.comentarios || null]);
    }

    // marca em avaliação (apenas se estava submetido)
    const upd = await db.result(
      `UPDATE trabalhos_submissoes SET status='em_avaliacao', atualizado_em=NOW() WHERE id=$1 AND status='submetido'`,
      [subId]
    );

    if (upd.rowCount > 0) {
      // notifica autor que entrou em avaliação
      const meta = await db.one(`
        SELECT s.usuario_id, s.titulo AS trabalho_titulo, c.titulo AS chamada_titulo
        FROM trabalhos_submissoes s
        JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id=$1
      `, [subId]);

      await notificarStatusSubmissao({
        usuario_id: meta.usuario_id,
        chamada_titulo: meta.chamada_titulo,
        trabalho_titulo: meta.trabalho_titulo,
        status: "em_avaliacao",
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.avaliarOral = async (req, res, next) => {
  try {
    const { itens = [] } = req.body; // [{criterio_oral_id, nota, comentarios}]
    const subId = Number(req.params.id);
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação oral.");

    const lims = await db.any(`
      SELECT id, escala_min, escala_max FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
    `, [subId]);
    const byId = new Map(lims.map(x => [x.id, x]));

    for (const it of itens) {
      const lim = byId.get(it.criterio_oral_id);
      assert(lim, "Critério oral inválido.");
      assert(Number.isInteger(it.nota) && it.nota >= lim.escala_min && it.nota <= lim.escala_max, `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`);
      await db.none(`
        INSERT INTO trabalhos_apresentacoes_orais_itens (submissao_id, avaliador_id, criterio_oral_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_oral_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
      `, [subId, req.user.id, it.criterio_oral_id, it.nota, it.comentarios || null]);
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

exports.consolidarClassificacao = async (req, res, next) => {
  try {
    const chamadaId = Number(req.params.chamadaId);

    // 1) Top 40 geral → exposição
    const top40 = await db.any(`
      SELECT id FROM vw_submissoes_consolidadas
      WHERE chamada_id=$1
      ORDER BY total_ponderado DESC, inicio_experiencia DESC, id ASC
      LIMIT 40
    `, [chamadaId]);

    if (top40.length) {
      await db.none(
        `UPDATE trabalhos_submissoes SET status='aprovado_exposicao'
         WHERE chamada_id=$1 AND id = ANY($2::int[])`,
        [chamadaId, top40.map(x => x.id)]
      );
    }

    // 2) Top 6 por linha → oral
    const linhas = await db.any(`SELECT id, codigo FROM trabalhos_chamada_linhas WHERE chamada_id=$1`, [chamadaId]);
    const aprovadosOral = [];
    for (const l of linhas) {
      const rows = await db.any(`
        SELECT id FROM vw_submissoes_consolidadas
        WHERE chamada_id=$1 AND linha_tematica_id=$2
        ORDER BY total_ponderado DESC, inicio_experiencia DESC, id ASC
        LIMIT 6
      `, [chamadaId, l.id]);
      aprovadosOral.push(...rows.map(r => r.id));
    }
    if (aprovadosOral.length) {
      await db.none(
        `UPDATE trabalhos_submissoes SET status='aprovado_oral'
         WHERE chamada_id=$1 AND id = ANY($2::int[])`,
        [chamadaId, aprovadosOral]
      );
    }

    // Notifica todo mundo conforme o status final
    await notificarClassificacaoDaChamada(chamadaId);

    res.json({ ok: true, exposicao: top40.length, oral: aprovadosOral.length });
  } catch (err) { next(err); }
};

exports.definirStatusFinal = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, observacoes_admin = null } = req.body;
    const permitidos = ['reprovado','aprovado_exposicao','aprovado_oral'];
    assert(permitidos.includes(status), "Status inválido.");

    await db.none(`
      UPDATE trabalhos_submissoes
      SET status=$1, observacoes_admin=$2, atualizado_em=NOW()
      WHERE id=$3
    `, [status, observacoes_admin, id]);

    // Notificação: pega metadados e avisa o autor
    const meta = await db.one(`
      SELECT s.usuario_id, s.titulo AS trabalho_titulo, c.titulo AS chamada_titulo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);

    await notificarStatusSubmissao({
      usuario_id: meta.usuario_id,
      chamada_titulo: meta.chamada_titulo,
      trabalho_titulo: meta.trabalho_titulo,
      status,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
};
