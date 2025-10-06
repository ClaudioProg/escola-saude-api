/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Usa o adaptador resiliente (db ou módulo inteiro)
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

// Notificações
const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
} = require("./notificacoesController");

// Helpers
function isYYYYMM(s) { return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function assert(cond, msg) { if (!cond) { const e = new Error(msg); e.status = 400; throw e; } }
function withinLen(s, max) { return typeof s === "string" && String(s).trim().length <= max; }
// ✅ aceita perfil como string ("administrador") ou array (["usuario","administrador"])
function hasRole(user, role) {
  if (!user) return false;
  const p = user.perfil;
  return Array.isArray(p) ? p.includes(role) : p === role;
}

async function getChamadaValidacao(chamadaId) {
  const c = await db.oneOrNone(`
    SELECT * ,
      (now() <= prazo_final_br) AS dentro_prazo
    FROM trabalhos_chamadas WHERE id=$1
  `, [chamadaId]);
  if (!c) { const e = new Error("Chamada inexistente."); e.status = 404; throw e; }
  return c;
}

function limitesDaChamada(ch) {
  return {
    titulo: Number(ch?.limites?.titulo) || 100,
    introducao: Number(ch?.limites?.introducao) || 2000,
    objetivos: Number(ch?.limites?.objetivos) || 1000,
    metodo: Number(ch?.limites?.metodo) || 1500,
    resultados: Number(ch?.limites?.resultados) || 1500,
    consideracoes: Number(ch?.limites?.consideracoes) || 1000,
  };
}

function normalizarStatusEntrada(status) {
  // front manda "rascunho" | "enviado"
  if (status === "rascunho") return "rascunho";
  if (status === "enviado") return "submetido";
  return "submetido"; // fallback histórico
}

function podeExcluirOuEditarPeloAutor(sub, ch) {
  if (!ch.dentro_prazo) return { ok: false, msg: "Prazo encerrado para alterações." };
  // bloqueia se já entrou em avaliação ou foi classificado
  const bloqueados = new Set(["em_avaliacao","aprovado_exposicao","aprovado_oral","reprovado"]);
  if (bloqueados.has(sub.status)) return { ok: false, msg: "Submissão em avaliação ou finalizada." };
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────
 * CRIAR SUBMISSÃO (autor)
 * ────────────────────────────────────────────────────────────────── */
exports.criarSubmissao = async (req, res, next) => {
  try {
    const chamadaId = Number(req.params.chamadaId);
    const ch = await getChamadaValidacao(chamadaId);
    assert(ch.publicado, "Chamada não publicada.");
    assert(ch.dentro_prazo, "O prazo de submissão encerrou.");

    const {
      titulo, inicio_experiencia, linha_tematica_id,
      introducao, objetivos, metodo, resultados,
      consideracoes, bibliografia, coautores = [],
      status: statusIn
    } = req.body;

    const status = normalizarStatusEntrada(statusIn);
    const lim = limitesDaChamada(ch);

    // Validação condicional
    assert(titulo && withinLen(titulo, lim.titulo), `Título obrigatório (até ${lim.titulo} caracteres).`);
    assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");

    if (status === "submetido") {
      // exigências completas somente para envio
      assert(
        inicio_experiencia >= ch.periodo_experiencia_inicio &&
        inicio_experiencia <= ch.periodo_experiencia_fim,
        "Início fora do período permitido pela chamada."
      );
      assert(introducao && withinLen(introducao, lim.introducao), `Introdução até ${lim.introducao} caracteres.`);
      assert(objetivos && withinLen(objetivos, lim.objetivos), `Objetivos até ${lim.objetivos} caracteres.`);
      assert(metodo && withinLen(metodo, lim.metodo), `Método/Descrição da prática até ${lim.metodo} caracteres.`);
      assert(resultados && withinLen(resultados, lim.resultados), `Resultados/Impactos até ${lim.resultados} caracteres.`);
      assert(consideracoes && withinLen(consideracoes, lim.consideracoes), `Considerações finais até ${lim.consideracoes} caracteres.`);
      if (bibliografia) assert(withinLen(bibliografia, 8000), "Bibliografia muito longa.");
    }

    const lt = await db.oneOrNone(
      `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
      [linha_tematica_id, chamadaId]
    );
    assert(lt, "Linha temática inválida para esta chamada.");

    const ins = await db.one(`
      INSERT INTO trabalhos_submissoes
      (usuario_id, chamada_id, titulo, inicio_experiencia, linha_tematica_id, linha_tematica_codigo,
       introducao, objetivos, metodo, resultados, consideracoes, bibliografia, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [
      req.user.id, chamadaId, titulo?.trim(), inicio_experiencia,
      lt.id, lt.codigo || null,
      introducao || null, objetivos || null, metodo || null, resultados || null, consideracoes || null,
      bibliografia || null,
      status,
    ]);

    // Coautores (limite)
    assert(Array.isArray(coautores) && coautores.length <= ch.max_coautores, `Máximo de ${ch.max_coautores} coautores.`);
    for (const c of coautores) {
      if (!c?.nome) continue;
      await db.none(`
        INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel, cpf, vinculo)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [ins.id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null, c.cpf || null, c.vinculo || null]);
    }

    // Notificações
    await notificarSubmissaoCriada({
      usuario_id: req.user.id,
      chamada_titulo: ch.titulo,
      trabalho_titulo: titulo?.trim(),
      submissao_id: ins.id,
    });
    if (status === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: req.user.id,
        chamada_titulo: ch.titulo,
        trabalho_titulo: titulo?.trim(),
        status: "submetido",
      });
    }

    res.status(201).json({ ok: true, id: ins.id, status });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * ATUALIZAR SUBMISSÃO (autor) — PUT /submissoes/:id
 * ──────────────────────────────────────────────────────────────── */
exports.atualizarSubmissao = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const meta = await db.oneOrNone(`
      SELECT s.*, c.id AS chamada_id, c.titulo AS chamada_titulo,
             c.periodo_experiencia_inicio, c.periodo_experiencia_fim,
             c.max_coautores, c.limites,
             (now() <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);

    if (!meta) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }
    if (!hasRole(req.user, "administrador") && meta.usuario_id !== req.user.id) {
      const e = new Error("Sem permissão."); e.status = 403; throw e;
    }

    const gate = podeExcluirOuEditarPeloAutor(meta, meta);
    assert(gate.ok, gate.msg);

    const {
      titulo, inicio_experiencia, linha_tematica_id,
      introducao, objetivos, metodo, resultados, consideracoes, bibliografia,
      coautores = [],
      status: statusIn
    } = req.body;

    const status = normalizarStatusEntrada(statusIn || meta.status);
    const lim = limitesDaChamada(meta);

    // validações
    assert(titulo && withinLen(titulo, lim.titulo), `Título obrigatório (até ${lim.titulo} caracteres).`);
    assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");

    if (status === "submetido") {
      assert(
        inicio_experiencia >= meta.periodo_experiencia_inicio &&
        inicio_experiencia <= meta.periodo_experiencia_fim,
        "Início fora do período permitido pela chamada."
      );
      assert(introducao && withinLen(introducao, lim.introducao), `Introdução até ${lim.introducao} caracteres.`);
      assert(objetivos && withinLen(objetivos, lim.objetivos), `Objetivos até ${lim.objetivos} caracteres.`);
      assert(metodo && withinLen(metodo, lim.metodo), `Método/Descrição da prática até ${lim.metodo} caracteres.`);
      assert(resultados && withinLen(resultados, lim.resultados), `Resultados/Impactos até ${lim.resultados} caracteres.`);
      assert(consideracoes && withinLen(consideracoes, lim.consideracoes), `Considerações finais até ${lim.consideracoes} caracteres.`);
      if (bibliografia) assert(withinLen(bibliografia, 8000), "Bibliografia muito longa.");
    }

    // linha temática válida para esta chamada
    const lt = await db.oneOrNone(
      `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
      [linha_tematica_id, meta.chamada_id]
    );
    assert(lt, "Linha temática inválida para esta chamada.");

    await db.tx(async (t) => {
      await t.none(`
        UPDATE trabalhos_submissoes
           SET titulo=$1, inicio_experiencia=$2, linha_tematica_id=$3, linha_tematica_codigo=$4,
               introducao=$5, objetivos=$6, metodo=$7, resultados=$8, consideracoes=$9, bibliografia=$10,
               status=$11, atualizado_em=NOW()
         WHERE id=$12
      `, [
        titulo?.trim(), inicio_experiencia, lt.id, lt.codigo || null,
        introducao || null, objetivos || null, metodo || null, resultados || null, consideracoes || null,
        bibliografia || null, status, id
      ]);

      // coautores
      assert(Array.isArray(coautores) && coautores.length <= meta.max_coautores, `Máximo de ${meta.max_coautores} coautores.`);
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      for (const c of coautores) {
        if (!c?.nome) continue;
        await t.none(`
          INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel, cpf, vinculo)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, [id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null, c.cpf || null, c.vinculo || null]);
      }
    });

    // notificação apenas quando virar "submetido"
    if (meta.status !== "submetido" && status === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: meta.usuario_id,
        chamada_titulo: meta.chamada_titulo,
        trabalho_titulo: titulo?.trim(),
        status: "submetido",
      });
    }

    res.json({ ok: true, id, status });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * EXCLUIR SUBMISSÃO (autor) — DELETE /submissoes/:id
 * ──────────────────────────────────────────────────────────────── */
exports.removerSubmissao = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const meta = await db.oneOrNone(`
      SELECT s.*, c.prazo_final_br,
             (now() <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);

    if (!meta) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }
    if (!hasRole(req.user, "administrador") && meta.usuario_id !== req.user.id) {
      const e = new Error("Sem permissão."); e.status = 403; throw e;
    }

    const gate = podeExcluirOuEditarPeloAutor(meta, meta);
    assert(gate.ok, gate.msg);

    await db.tx(async (t) => {
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_arquivos  WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_submissoes WHERE id=$1`, [id]);
    });

    res.json({ ok: true, id });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * POSTER (com checagem de papel via hasRole)
 * ──────────────────────────────────────────────────────────────── */
exports.atualizarPoster = async (req, res, next) => {
  try {
    assert(req.file, "Envie o arquivo .ppt/.pptx no campo 'poster'.");

    const sub = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
              c.id AS chamada_id, c.titulo AS chamada_titulo, c.aceita_poster,
              (now() <= c.prazo_final_br) AS dentro_prazo,
              s.status
         FROM trabalhos_submissoes s
         JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id=$1`,
      [req.params.id]
    );
    assert(sub, "Submissão não encontrada.");

    const isAdmin = hasRole(req.user, "administrador");
    assert(isAdmin || sub.usuario_id === req.user.id, "Sem permissão.");

    assert(sub.aceita_poster, "Esta chamada não aceita envio de pôster.");
    assert(sub.dentro_prazo, "Prazo encerrado para alterações.");

    const caminhoRel = path.relative(process.cwd(), req.file.path);
    const hash = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

    const arq = await db.one(`
      INSERT INTO trabalhos_arquivos (submissao_id, caminho, nome_original, mime_type, tamanho_bytes, hash_sha256)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
    `, [sub.id, caminhoRel, req.file.originalname, req.file.mimetype, req.file.size, hash]);

    await db.none(`UPDATE trabalhos_submissoes SET poster_arquivo_id=$1, atualizado_em=NOW() WHERE id=$2`, [arq.id, sub.id]);

    await notificarPosterAtualizado({
      usuario_id: req.user.id,
      chamada_titulo: sub.chamada_titulo,
      trabalho_titulo: sub.trabalho_titulo,
      arquivo_nome: req.file.originalname,
    });

    res.json({ ok: true, arquivo_id: arq.id });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * LISTAS / OBTENÇÃO
 * ──────────────────────────────────────────────────────────────── */
exports.minhasSubmissoes = async (req, res, next) => {
  try {
    const rows = await db.any(`
      SELECT s.*, a.nome_original AS poster_nome,
             c.titulo AS chamada_titulo, c.prazo_final_br,
             (now() <= c.prazo_final_br) AS dentro_prazo
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
      SELECT s.*, a.nome_original AS poster_nome, a.caminho AS poster_caminho,
             c.titulo AS chamada_titulo, c.max_coautores,
             (now() <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_arquivos a ON a.id=s.poster_arquivo_id
      WHERE s.id=$1
    `, [req.params.id]);
    if (!s) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }

    const isAdmin = hasRole(req.user, "administrador");
    if (!isAdmin && s.usuario_id !== req.user.id) { const e = new Error("Sem permissão."); e.status = 403; throw e; }

    const coautores = await db.any(`
      SELECT id, nome, email, unidade, papel, cpf, vinculo
      FROM trabalhos_coautores
      WHERE submissao_id=$1
      ORDER BY id
    `, [s.id]);

    res.json({ ...s, coautores });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * (ADMIN) — mantidas
 * ──────────────────────────────────────────────────────────────── */
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
    const { itens = [] } = req.body;
    const subId = Number(req.params.id);
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação.");

    // Limites por critério (da chamada dessa submissão)
    const lims = await db.any(`
      SELECT id, escala_min, escala_max
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
    `, [subId]);
    const byId = new Map(lims.map(x => [x.id, x]));

    // Upsert de itens de avaliação
    for (const it of itens) {
      const lim = byId.get(it.criterio_id);
      assert(lim, "Critério inválido.");
      const nota = parseInt(it.nota, 10);
      assert(Number.isInteger(nota) && nota >= lim.escala_min && nota <= lim.escala_max,
        `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`);

      await db.none(`
        INSERT INTO trabalhos_avaliacoes_itens (submissao_id, avaliador_id, criterio_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
      `, [subId, req.user.id, it.criterio_id, nota, it.comentarios || null]);
    }

    // Atualiza status para "em_avaliacao" SE ainda estiver "submetido"
    let rowCount = 0;
    const SQL_UPD = `
      UPDATE trabalhos_submissoes
         SET status='em_avaliacao', atualizado_em=NOW()
       WHERE id=$1 AND status='submetido'
    `;

    if (typeof db.result === "function") {
      const r = await db.result(SQL_UPD, [subId]);
      rowCount = r?.rowCount || 0;
    } else if (typeof db.query === "function") {
      const r = await db.query(SQL_UPD, [subId]);
      rowCount = r?.rowCount || 0;
    } else {
      // Fallback sem rowCount disponível (pg-promise .none, por ex.)
      await db.none?.(SQL_UPD, [subId]);
      rowCount = 0; // sem como saber → só não notifica
    }

    // Notifica apenas se houve transição real de status
    if (rowCount > 0) {
      let meta;
      if (typeof db.one === "function") {
        meta = await db.one(`
          SELECT s.usuario_id, s.titulo AS trabalho_titulo, c.titulo AS chamada_titulo
          FROM trabalhos_submissoes s
          JOIN trabalhos_chamadas c ON c.id = s.chamada_id
          WHERE s.id=$1
        `, [subId]);
      } else {
        const r = await db.query(`
          SELECT s.usuario_id, s.titulo AS trabalho_titulo, c.titulo AS chamada_titulo
          FROM trabalhos_submissoes s
          JOIN trabalhos_chamadas c ON c.id = s.chamada_id
          WHERE s.id=$1
        `, [subId]);
        meta = r?.rows?.[0];
      }

      if (meta) {
        await notificarStatusSubmissao({
          usuario_id: meta.usuario_id,
          chamada_titulo: meta.chamada_titulo,
          trabalho_titulo: meta.trabalho_titulo,
          status: "em_avaliacao",
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

exports.avaliarOral = async (req, res, next) => {
  try {
    const { itens = [] } = req.body;
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

    const linhas = await db.any(`SELECT id FROM trabalhos_chamada_linhas WHERE chamada_id=$1`, [chamadaId]);
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

/* ────────────────────────────────────────────────────────────────
 * (ADMIN) — listar TODAS as submissões (sem filtrar por chamada)
 *   GET /api/admin/submissoes
 * ──────────────────────────────────────────────────────────────── */
exports.listarSubmissoesAdminTodas = async (_req, res, next) => {
  try {
    const rows = await db.any(`
      SELECT
        s.id,
        s.titulo,
        s.usuario_id,
        s.status,
        s.linha_tematica_codigo,
        s.inicio_experiencia,
        s.chamada_id,
        c.titulo AS chamada_titulo,
        u.nome  AS autor_nome,
        u.email AS autor_email,
        COALESCE(ve.total_ponderado, 0)        AS total_escrita,
        COALESCE(vo.total_oral_ponderado, 0)   AS total_oral,
        (COALESCE(ve.total_ponderado,0) + COALESCE(vo.total_oral_ponderado,0)) AS total_geral
      FROM trabalhos_submissoes s
      JOIN usuarios u              ON u.id = s.usuario_id
      JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
      LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
      LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
      ORDER BY s.criado_em DESC, s.id ASC
    `);

    res.json(rows);
  } catch (err) {
    next(err);
  }
};
