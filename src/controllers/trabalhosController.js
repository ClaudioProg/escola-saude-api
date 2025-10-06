// api/controllers/trabalhosController.js
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { db } = require("../db");

// Notificações
const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
} = require("./notificacoesController");

// ───────────────────────── Helpers ─────────────────────────
function isYYYYMM(s) { return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function assert(cond, msg) { if (!cond) { const e = new Error(msg); e.status = 400; throw e; } }
function withinLen(s, max) { return typeof s === "string" && String(s).trim().length <= max; }
function isEmail(x=""){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x).trim()); }
function onlyDigits(x=""){ return String(x||"").replace(/\D+/g,""); }

// verifica se tabela trabalhos_coautores tem colunas novas
let COAUTORES_COLS = null;
async function detectCoautoresColumns() {
  if (COAUTORES_COLS) return COAUTORES_COLS;
  try {
    const rows = await db.any(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='trabalhos_coautores'
    `);
    const names = new Set(rows.map(r => r.column_name));
    COAUTORES_COLS = {
      hasCpf: names.has("cpf"),
      hasVinculo: names.has("vinculo_empregaticio") || names.has("vinculo_empregatício"),
      hasUnidade: names.has("unidade"),
      hasPapel: names.has("papel"),
      hasEmail: names.has("email"),
    };
  } catch {
    COAUTORES_COLS = { hasCpf:false, hasVinculo:false, hasUnidade:true, hasPapel:true, hasEmail:true };
  }
  return COAUTORES_COLS;
}

async function getChamadaValidacao(chamadaId) {
  const c = await db.oneOrNone(`
    SELECT * ,
      (now() AT TIME ZONE 'America/Sao_Paulo') <= prazo_final_br AS dentro_prazo
    FROM trabalhos_chamadas WHERE id=$1
  `, [chamadaId]);
  if (!c) { const e = new Error("Chamada inexistente."); e.status = 404; throw e; }
  return c;
}

function mapStatus(status) {
  if (status === "enviado") return "submetido";
  if (status === "rascunho") return "rascunho";
  return "submetido";
}

// Validação dos campos de texto conforme modo (rascunho vs enviado)
function validateCampos(payload, lim, modo) {
  const isFinal = modo === "submetido";
  // título
  if (isFinal) assert(payload.titulo && withinLen(payload.titulo, lim.titulo), `Título obrigatório (até ${lim.titulo} caracteres).`);
  else if (payload.titulo) assert(withinLen(payload.titulo, lim.titulo), `Título até ${lim.titulo} caracteres.`);
  // textos
  const checks = [
    ["introducao", lim.introducao, "Introdução"],
    ["objetivos", lim.objetivos, "Objetivos"],
    ["metodo", lim.metodo, "Método/Descrição da prática"],
    ["resultados", lim.resultados, "Resultados/Impactos"],
    ["consideracoes", lim.consideracoes, "Considerações finais"],
  ];
  for (const [k, max, label] of checks) {
    const v = String(payload[k] || "");
    if (isFinal) assert(v.trim().length, `${label} obrigatório.`);
    if (v) assert(withinLen(v, max), `${label} até ${max} caracteres.`);
  }
  if (payload.bibliografia) assert(withinLen(payload.bibliografia, 8000), "Bibliografia muito longa.");
}

function validateCoautor(c) {
  const nome = String(c?.nome || "").trim();
  const email = String(c?.email || "").trim();
  const cpf = onlyDigits(c?.cpf);
  const vinc = String(c?.vinculo_empregaticio || c?.vinculo_empregatício || c?.unidade || "").trim();

  assert(nome, "Coautor: nome completo é obrigatório.");
  if (cpf) assert(/^\d{11}$/.test(cpf), "Coautor: CPF deve ter 11 dígitos numéricos.");
  if (email) assert(isEmail(email), "Coautor: e-mail inválido.");
  if (vinc) assert(withinLen(vinc, 120), "Coautor: vínculo muito longo (máx. 120).");

  return { nome, email: email || null, cpf: cpf || null, vinculo: vinc || null };
}

async function upsertCoautores(submissaoId, coautores) {
  const cols = await detectCoautoresColumns();

  // limpa todos antes (simplifica)
  await db.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [submissaoId]);

  if (!Array.isArray(coautores) || !coautores.length) return;

  for (const raw of coautores) {
    const c = validateCoautor(raw);

    if (cols.hasCpf && cols.hasVinculo) {
      await db.none(`
        INSERT INTO trabalhos_coautores (submissao_id, nome, cpf, email, vinculo_empregaticio)
        VALUES ($1,$2,$3,$4,$5)
      `, [submissaoId, c.nome, c.cpf, c.email, c.vinculo]);
    } else {
      // fallback para esquemas antigos (unidade/papel)
      await db.none(`
        INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel)
        VALUES ($1,$2,$3,$4,$5)
      `, [submissaoId, c.nome, c.email, c.vinculo, null]);
    }
  }
}

// ─────────────────────── Endpoints ───────────────────────

/**
 * POST /api/chamadas/:chamadaId/submissoes
 * Body: { titulo, inicio_experiencia, linha_tematica_id, introducao, objetivos, metodo, resultados, consideracoes, bibliografia, status, coautores: [] }
 */
exports.criarSubmissao = async (req, res, next) => {
  try {
    const chamadaId = Number(req.params.chamadaId);
    const ch = await getChamadaValidacao(chamadaId);
    assert(ch.publicado, "Chamada não publicada.");
    assert(ch.dentro_prazo, "O prazo de submissão encerrou.");

    const {
      titulo, inicio_experiencia, linha_tematica_id,
      introducao, objetivos, metodo, resultados,
      consideracoes, bibliografia, status = "enviado",
      coautores = []
    } = req.body;

    const modo = mapStatus(status);

    // 🔢 Limites configuráveis (fallback para os padrões)
    const lim = {
      titulo: Number(ch?.limites?.titulo) || 100,
      introducao: Number(ch?.limites?.introducao) || 2000,
      objetivos: Number(ch?.limites?.objetivos) || 1000,
      metodo: Number(ch?.limites?.metodo) || 1500,
      resultados: Number(ch?.limites?.resultados) || 1500,
      consideracoes: Number(ch?.limites?.consideracoes) || 1000,
    };

    // Início/período
    if (modo === "submetido") {
      assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");
      assert(
        inicio_experiencia >= ch.periodo_experiencia_inicio &&
        inicio_experiencia <= ch.periodo_experiencia_fim,
        "Início fora do período permitido pela chamada."
      );
      assert(linha_tematica_id, "Linha temática é obrigatória.");
    } else {
      if (inicio_experiencia) {
        assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");
      }
    }

    // Limites de caracteres (modo-aware)
    validateCampos({ titulo, introducao, objetivos, metodo, resultados, consideracoes, bibliografia }, lim, modo);

    // Linha temática (se veio id, valida)
    let lt = null;
    if (linha_tematica_id) {
      lt = await db.oneOrNone(
        `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
        [linha_tematica_id, chamadaId]
      );
      assert(lt, "Linha temática inválida para esta chamada.");
    }

    // Coautores
    assert(Array.isArray(coautores) && coautores.length <= (Number(ch.max_coautores) || 10),
      `Máximo de ${ch.max_coautores} coautores.`);

    // Cria submissão
    const ins = await db.one(`
      INSERT INTO trabalhos_submissoes
      (usuario_id, chamada_id, titulo, inicio_experiencia, linha_tematica_id, linha_tematica_codigo,
       introducao, objetivos, metodo, resultados, consideracoes, bibliografia, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [
      req.user.id,
      chamadaId,
      (titulo || "").trim() || null,
      inicio_experiencia || null,
      lt ? lt.id : null,
      lt ? (lt.codigo || null) : null,
      introducao || null,
      objetivos || null,
      metodo || null,
      resultados || null,
      consideracoes || null,
      bibliografia || null,
      modo,
    ]);

    // grava coautores
    await upsertCoautores(ins.id, coautores);

    // Notificações básicas
    await notificarSubmissaoCriada({
      usuario_id: req.user.id,
      chamada_titulo: ch.titulo,
      trabalho_titulo: (titulo || "").trim(),
      submissao_id: ins.id,
    });
    if (modo === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: req.user.id,
        chamada_titulo: ch.titulo,
        trabalho_titulo: (titulo || "").trim(),
        status: "submetido",
      });
    }

    res.status(201).json({ ok: true, id: ins.id });
  } catch (err) { next(err); }
};

/**
 * PUT /api/submissoes/:id
 * Body: igual ao criar; respeita prazo e autor/admin.
 */
exports.atualizarSubmissao = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // carrega submissão + chamada para validar prazo e dono
    const meta = await db.oneOrNone(`
      SELECT s.*, 
             c.id AS chamada_id, c.titulo AS chamada_titulo, c.max_coautores,
             c.periodo_experiencia_inicio, c.periodo_experiencia_fim, c.limites,
             (now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);
    assert(meta, "Submissão não encontrada.");
    const isOwner = meta.usuario_id === req.user.id;
    const isAdmin = req.user.perfil === "administrador";
    assert(isOwner || isAdmin, "Sem permissão.");
    assert(meta.dentro_prazo, "Prazo encerrado: não é possível editar.");

    const {
      titulo, inicio_experiencia, linha_tematica_id,
      introducao, objetivos, metodo, resultados,
      consideracoes, bibliografia, status,
      coautores = []
    } = req.body;

    const modo = mapStatus(status || meta.status);

    const lim = {
      titulo: Number(meta?.limites?.titulo) || 100,
      introducao: Number(meta?.limites?.introducao) || 2000,
      objetivos: Number(meta?.limites?.objetivos) || 1000,
      metodo: Number(meta?.limites?.metodo) || 1500,
      resultados: Number(meta?.limites?.resultados) || 1500,
      consideracoes: Number(meta?.limites?.consideracoes) || 1000,
    };

    // valida início/período
    const ini = inicio_experiencia ?? meta.inicio_experiencia;
    if (modo === "submetido") {
      assert(isYYYYMM(ini), "Início da experiência deve ser YYYY-MM.");
      assert(
        ini >= meta.periodo_experiencia_inicio &&
        ini <= meta.periodo_experiencia_fim,
        "Início fora do período permitido pela chamada."
      );
      assert(linha_tematica_id || meta.linha_tematica_id, "Linha temática é obrigatória.");
    } else if (ini) {
      assert(isYYYYMM(ini), "Início da experiência deve ser YYYY-MM.");
    }

    validateCampos({
      titulo: titulo ?? meta.titulo,
      introducao: introducao ?? meta.introducao,
      objetivos: objetivos ?? meta.objetivos,
      metodo: metodo ?? meta.metodo,
      resultados: resultados ?? meta.resultados,
      consideracoes: consideracoes ?? meta.consideracoes,
      bibliografia: bibliografia ?? meta.bibliografia,
    }, lim, modo);

    // valida linha temática, se mudou
    let ltId = meta.linha_tematica_id;
    let ltCod = meta.linha_tematica_codigo;
    if (linha_tematica_id) {
      const lt = await db.oneOrNone(
        `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
        [linha_tematica_id, meta.chamada_id]
      );
      assert(lt, "Linha temática inválida para esta chamada.");
      ltId = lt.id; ltCod = lt.codigo || null;
    }

    assert(Array.isArray(coautores) && coautores.length <= (Number(meta.max_coautores) || 10),
      `Máximo de ${meta.max_coautores} coautores.`);

    await db.none(`
      UPDATE trabalhos_submissoes SET
        titulo=$1, inicio_experiencia=$2, linha_tematica_id=$3, linha_tematica_codigo=$4,
        introducao=$5, objetivos=$6, metodo=$7, resultados=$8, consideracoes=$9, bibliografia=$10,
        status=$11, atualizado_em=NOW()
      WHERE id=$12
    `, [
      (titulo ?? meta.titulo) ? String(titulo ?? meta.titulo).trim() : null,
      ini || null,
      ltId || null,
      ltCod || null,
      introducao ?? meta.introducao,
      objetivos ?? meta.objetivos,
      metodo ?? meta.metodo,
      resultados ?? meta.resultados,
      consideracoes ?? meta.consideracoes,
      bibliografia ?? meta.bibliografia,
      modo,
      id,
    ]);

    await upsertCoautores(id, coautores);

    // notificação quando vira submetido
    if (meta.status !== "submetido" && modo === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: meta.usuario_id,
        chamada_titulo: meta.chamada_titulo,
        trabalho_titulo: (titulo ?? meta.titulo) || "",
        status: "submetido",
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
};

/**
 * DELETE /api/submissoes/:id
 * Só autor (ou admin) e até o prazo.
 */
exports.removerSubmissao = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const meta = await db.oneOrNone(`
      SELECT s.id, s.usuario_id, c.titulo AS chamada_titulo,
             (now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);

    assert(meta, "Submissão não encontrada.");
    const isOwner = meta.usuario_id === req.user.id;
    const isAdmin = req.user.perfil === "administrador";
    assert(isOwner || isAdmin, "Sem permissão.");
    assert(meta.dentro_prazo, "Prazo encerrado: não é possível excluir.");

    await db.tx(async t => {
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_avaliacoes_itens WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_apresentacoes_orais_itens WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_submissoes WHERE id=$1`, [id]);
    });

    res.json({ ok: true, id });
  } catch (err) { next(err); }
};

exports.atualizarPoster = async (req, res, next) => {
  try {
    assert(req.file, "Envie o arquivo .ppt/.pptx no campo 'poster'.");

    // pega submissão + chamada (para checar aceita_poster)
    const sub = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
              c.id AS chamada_id, c.titulo AS chamada_titulo, c.aceita_poster,
              (now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br AS dentro_prazo
         FROM trabalhos_submissoes s
         JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id=$1`,
      [req.params.id]
    );
    assert(sub, "Submissão não encontrada.");
    assert(req.user.perfil === "administrador" || sub.usuario_id === req.user.id, "Sem permissão.");
    assert(sub.dentro_prazo, "Prazo encerrado: não é possível enviar/alterar o pôster.");
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

    const coautores = await db.any(`
      SELECT id, nome,
             COALESCE(cpf, NULL) AS cpf,
             COALESCE(email, NULL) AS email,
             COALESCE(vinculo_empregaticio, unidade) AS vinculo_empregaticio
      FROM trabalhos_coautores
      WHERE submissao_id=$1
      ORDER BY id
    `, [s.id]);

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
