// 📁 src/controllers/trabalhosController.js
/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Usa o adaptador resiliente (db ou módulo inteiro)
const { db } = require("../db");

// Raiz persistente (para resolver caminhos legados/relativos)
const { UPLOADS_DIR } = require("../paths");

// Notificações
const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
} = require("./notificacoesController");

// ⬇️ helpers de autorização (admin/avaliador)
const { canUserReviewOrView, isAdmin } = require("./submissoesAdminController");

/* ───────────────── Helpers comuns ───────────────── */
function isYYYYMM(s) { return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function assert(cond, msg) { if (!cond) { const e = new Error(msg); e.status = 400; throw e; } }
function withinLen(s, max) { return typeof s === "string" && String(s).trim().length <= max; }
// ✅ aceita perfil como string ("administrador") ou array (["usuario","administrador"])
function hasRole(user, role) {
  if (!user) return false;
  const p = user.perfil;
  return Array.isArray(p) ? p.includes(role) : p === role;
}

/** Converte um caminho salvo no DB (pode ter \, /, ser relativo ou absoluto) em um caminho absoluto válido */
function normalizeStoragePath(dbPath) {
  if (!dbPath) return null;
  const norm = String(dbPath).trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (path.isAbsolute(norm)) return path.normalize(norm);

  // remove prefixo "uploads/" para resolver a partir da raiz persistente
  const relFromUploads = norm.replace(/^uploads\//i, "");
  const tries = [
    path.join(UPLOADS_DIR, relFromUploads),      // ex.: <FILES_BASE>/uploads/posters/...
    path.join(process.cwd(), norm),              // ex.: <CWD>/uploads/posters/...
    path.join(process.cwd(), relFromUploads),    // ex.: <CWD>/posters/...
  ];
  for (const cand of tries) {
    try { if (fs.existsSync(cand)) return cand; } catch {}
  }
  return null;
}

/** A partir do caminho absoluto salvo pelo multer, devolve o relativo padrão "uploads/<subdir>/<filename>" */
function toUploadsRelative(absPath, subdir) {
  const relFromUploads = path.relative(UPLOADS_DIR, absPath).replace(/\\/g, "/"); // "posters/xxx.pptx"
  if (!relFromUploads || relFromUploads.startsWith("..")) {
    return `uploads/${subdir}/${path.basename(absPath)}`;
  }
  return `uploads/${relFromUploads}`;
}

function logDownload(label, ctx) {
  const safe = {};
  for (const k of Object.keys(ctx || {})) {
    const v = ctx[k];
    safe[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v == null
      ? v
      : (Buffer.isBuffer(v) ? `Buffer(${v.length})` : JSON.stringify(v));
  }
  console.log(`[${new Date().toISOString()}][${label}]`, safe);
}

async function getChamadaValidacao(chamadaId) {
  const c = await db.oneOrNone(`
    SELECT * , (now() <= prazo_final_br) AS dentro_prazo
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
  if (status === "rascunho") return "rascunho";
  if (status === "enviado") return "submetido";
  return "submetido";
}

function podeExcluirOuEditarPeloAutor(sub, ch) {
  if (!ch.dentro_prazo) return { ok: false, msg: "Prazo encerrado para alterações." };
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

    assert(titulo && withinLen(titulo, lim.titulo), `Título obrigatório (até ${lim.titulo} caracteres).`);
    assert(isYYYYMM(inicio_experiencia), "Início da experiência deve ser YYYY-MM.");

    if (status === "submetido") {
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

    // Coautores
    assert(Array.isArray(coautores) && coautores.length <= ch.max_coautores, `Máximo de ${ch.max_coautores} coautores.`);
    for (const c of coautores) {
      if (!c?.nome) continue;
      await db.none(`
        INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel, cpf, vinculo)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [ins.id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null, c.cpf || null, c.vinculo || null]);
    }

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
    const ehAdmin = Array.isArray(req.user.perfil) && req.user.perfil.includes("administrador");
    const ehAutor = String(meta.usuario_id) === String(req.user.id);

    if (!ehAdmin && !ehAutor) {
      console.warn("[Submissão bloqueada]", {
        user_id: req.user.id,
        dono_submissao: meta.usuario_id,
        perfil: req.user.perfil,
      });
      const e = new Error("Sem permissão para editar esta submissão.");
      e.status = 403;
      throw e;
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

// ⬇️ gate específico para EXCLUSÃO (não depende do prazo)
function podeExcluirPeloAutor(sub, user) {
  const ehDono = String(sub.usuario_id) === String(user.id);
  const ehAdmin = hasRole(user, "administrador");
  if (!ehDono && !ehAdmin) return { ok: false, status: 403, msg: "Sem permissão." };

  const status = String(sub.status || "").toLowerCase();
  const permitido = status === "rascunho" || status === "submetido";
  if (!permitido && !ehAdmin) {
    return { ok: false, status: 400, msg: "Somente rascunho ou submetido podem ser excluídos." };
  }
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────
 * EXCLUIR SUBMISSÃO (autor) — DELETE /submissoes/:id
 * ──────────────────────────────────────────────────────────────── */
exports.removerSubmissao = async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const meta = await db.oneOrNone(`
      SELECT s.*, c.prazo_final_br, (now() <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
    `, [id]);

    if (!meta) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }

    const gate = podeExcluirPeloAutor(meta, req.user);
    if (!gate.ok) { const e = new Error(gate.msg); e.status = gate.status || 400; throw e; }

    // apaga coautores/arquivos e a submissão
    await db.tx(async (t) => {
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_arquivos  WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_submissoes WHERE id=$1`, [id]);
    });

    // Se você salva arquivo em disco além do BLOB, poderia buscar os caminhos antes e dar fs.unlink aqui.

    res.status(204).end(); // sem corpo
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * PÔSTER — upload + download inline
 * ──────────────────────────────────────────────────────────────── */
exports.atualizarPoster = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ erro: "Usuário não autenticado." });
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

    const ehAdmin = Array.isArray(req.user.perfil) && req.user.perfil.includes("administrador");
    const ehAutor = String(sub.usuario_id) === String(req.user.id);
    if (!ehAdmin && !ehAutor) {
      console.warn("[atualizarPoster] Bloqueado:", req.user.id, "=>", sub.id);
      return res.status(403).json({ erro: "Você não tem permissão para enviar o pôster desta submissão." });
    }

    assert(sub.aceita_poster, "Esta chamada não aceita envio de pôster.");
    assert(sub.dentro_prazo, "Prazo encerrado para alterações.");

    const okMime =
      /powerpoint|presentation/i.test(req.file.mimetype) ||
      /\.(pptx?|PPTX?)$/.test(req.file.originalname || "");
    assert(okMime, "Formato inválido. Envie .ppt ou .pptx.");

    const absPath = req.file.path;
    const relPath = toUploadsRelative(absPath, "posters");
    const buffer = fs.readFileSync(absPath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const arq = await db.one(
      `INSERT INTO trabalhos_arquivos
         (submissao_id, caminho, nome_original, mime_type, tamanho_bytes, hash_sha256, arquivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [sub.id, relPath, req.file.originalname, req.file.mimetype, buffer.length, hash, buffer] // ⬅ salva BLOB
    );

    await db.none(
      `UPDATE trabalhos_submissoes
          SET poster_arquivo_id=$1, atualizado_em=NOW()
        WHERE id=$2`,
      [arq.id, sub.id]
    );

    await notificarPosterAtualizado({
      usuario_id: req.user.id,
      chamada_titulo: sub.chamada_titulo,
      trabalho_titulo: sub.trabalho_titulo,
      arquivo_nome: req.file.originalname,
    });

    console.log("[Poster OK]", { usuario: req.user.id, submissao: sub.id, arquivo: req.file.originalname, relPath });
    res.json({ ok: true, arquivo_id: arq.id });
  } catch (err) {
    console.error("[atualizarPoster] erro:", err.message);
    next(err);
  }
};

// GET /submissoes/:id/poster — inline (prefere BLOB; cai para disco; 410 se ausente)
exports.baixarPoster = async (req, res, next) => {
  try {
    const subId = Number(req.params.id);

    const ehAdministrador = await isAdmin(req.user.id);
    let permitido = ehAdministrador || (await canUserReviewOrView(req.user.id, subId));
    if (!permitido) {
      const dono = await db.oneOrNone(`SELECT usuario_id FROM trabalhos_submissoes WHERE id=$1`, [subId]);
      permitido = String(dono?.usuario_id) === String(req.user.id);
    }
    if (!permitido) return res.status(403).json({ erro: "Acesso negado." });

    const row = await db.oneOrNone(`
      SELECT a.id, a.caminho, a.nome_original, a.mime_type, a.arquivo
        FROM trabalhos_submissoes s
        LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
       WHERE s.id=$1
    `, [subId]);

    if (!row) return res.status(404).json({ erro: "Pôster não encontrado." });

    const filename = row.nome_original || "poster.pptx";
    const mime = row.mime_type || "application/octet-stream";

    logDownload("poster:meta", {
      subId, temRow: !!row, caminhoDB: row.caminho || null, mime, temBlob: !!row.arquivo
    });

    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.setHeader("Content-Type", mime);

    // 1) Prefira servir o BLOB se existir
    if (row.arquivo && row.arquivo.length) {
      return res.end(row.arquivo);
    }

    // 2) Legados: tentar disco
    const abs = normalizeStoragePath(row.caminho);
    logDownload("poster:fs-check", { subId, caminhoResolvido: abs, exists: !!abs && fs.existsSync(abs) });
    if (abs && fs.existsSync(abs)) {
      return fs.createReadStream(abs).pipe(res);
    }

    // 3) Nada disponível → 410 (arquivo ausente no armazenamento)
    logDownload("poster:missing", { subId });
    return res.status(410).json({
      erro: "Arquivo do pôster não está disponível no momento.",
      acao_sugerida: "Envie novamente o arquivo do pôster."
    });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────
 * BANNER — enquanto não houver banner_arquivo_id, espelhamos no poster_arquivo_id
 * ──────────────────────────────────────────────────────────────── */

// POST /submissoes/:id/banner (campo 'banner' via multer)
exports.atualizarBanner = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ erro: "Usuário não autenticado." });
    assert(req.file, "Envie o arquivo do banner no campo 'banner'.");

    const sub = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
              c.id AS chamada_id, c.titulo AS chamada_titulo,
              (now() <= c.prazo_final_br) AS dentro_prazo
         FROM trabalhos_submissoes s
         JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id=$1`,
      [req.params.id]
    );
    assert(sub, "Submissão não encontrada.");

    const ehAdmin = Array.isArray(req.user.perfil) && req.user.perfil.includes("administrador");
    const ehAutor = String(sub.usuario_id) === String(req.user.id);
    if (!ehAdmin && !ehAutor) {
      console.warn("[atualizarBanner] Bloqueado:", req.user.id, "=>", sub.id);
      return res.status(403).json({ erro: "Você não tem permissão para enviar o banner desta submissão." });
    }

    assert(sub.dentro_prazo, "Prazo encerrado para alterações.");

    // aceita imagem, PDF e PPT/PPTX
    const okMime =
      /^image\//i.test(req.file.mimetype) ||
      /pdf/i.test(req.file.mimetype) ||
      /vnd\.ms-powerpoint|presentation/i.test(req.file.mimetype) ||
      /\.(png|jpe?g|gif|pdf|pptx?)$/i.test(req.file.originalname || "");
    assert(okMime, "Formato inválido. Envie PNG, JPG, GIF, PDF, PPT ou PPTX.");

    const absPath = req.file.path;
    const relPath = toUploadsRelative(absPath, "banners");
    const buffer = fs.readFileSync(absPath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    const arq = await db.one(
      `INSERT INTO trabalhos_arquivos
         (submissao_id, caminho, nome_original, mime_type, tamanho_bytes, hash_sha256, arquivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id`,
      [sub.id, relPath, req.file.originalname, req.file.mimetype, buffer.length, hash, buffer]
    );

    // ⚠️ usando poster_arquivo_id enquanto não existir banner_arquivo_id
    await db.none(
      `UPDATE trabalhos_submissoes
          SET poster_arquivo_id=$1, atualizado_em=NOW()
        WHERE id=$2`,
      [arq.id, sub.id]
    );

    console.log("[Banner OK - usando poster_arquivo_id]", { usuario: req.user.id, submissao: sub.id, arquivo: req.file.originalname, relPath });
    res.json({ ok: true, arquivo_id: arq.id });
  } catch (err) {
    console.error("[atualizarBanner] erro:", err.message);
    next(err);
  }
};

// GET /submissoes/:id/banner — inline (prefere BLOB; cai para disco)
exports.baixarBanner = async (req, res, next) => {
  try {
    const subId = Number(req.params.id);

    const ehAdministrador = await isAdmin(req.user.id);
    let permitido = ehAdministrador || (await canUserReviewOrView(req.user.id, subId));
    if (!permitido) {
      const dono = await db.oneOrNone(`SELECT usuario_id FROM trabalhos_submissoes WHERE id=$1`, [subId]);
      permitido = String(dono?.usuario_id) === String(req.user.id);
    }
    if (!permitido) return res.status(403).json({ erro: "Acesso negado." });

    const row = await db.oneOrNone(
      `SELECT a.id, a.caminho, a.nome_original, a.mime_type, a.arquivo
         FROM trabalhos_submissoes s
         LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
        WHERE s.id=$1`,
      [subId]
    );

    logDownload("banner:meta", { subId, temRow: !!row, caminhoDB: row?.caminho, mime: row?.mime_type, temBlob: !!row?.arquivo });
    assert(row && (row.caminho || row.arquivo), "Banner não encontrado.");

    const filename = row.nome_original || "banner";
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    if (row.arquivo && row.arquivo.length) {
      logDownload("banner:direct-blob", { subId, bytes: row.arquivo.length });
      return res.end(row.arquivo);
    }

    const abs = normalizeStoragePath(row.caminho);
    const exists = abs && fs.existsSync(abs);
    logDownload("banner:fs-check", { subId, caminhoResolvido: abs, exists });

    if (exists) return fs.createReadStream(abs).pipe(res);

    logDownload("banner:missing", { subId });
    return res.status(410).json({
      erro: "Arquivo do banner não está disponível no momento.",
      acao_sugerida: "Envie novamente o arquivo do banner."
    });
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
    const subId = Number(req.params.id);
    const s = await db.oneOrNone(`
      SELECT s.*,
             pa.nome_original AS poster_nome, pa.caminho AS poster_caminho,
             /* 🔁 Enquanto não há banner_arquivo_id, espelhamos do poster: */
             pa.nome_original AS banner_nome, pa.caminho AS banner_caminho,
             c.titulo AS chamada_titulo, c.max_coautores,
             (now() <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_arquivos pa ON pa.id = s.poster_arquivo_id
      WHERE s.id=$1
    `, [subId]);
    if (!s) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }

    // Permissão: admin, autor OU avaliador atribuído
    const ehAdmin = await isAdmin(req.user.id);
    const ehAutor = s.usuario_id === req.user.id;
    const ehAvaliadorVinculado = await canUserReviewOrView(req.user.id, subId);
    if (!ehAdmin && !ehAutor && !ehAvaliadorVinculado) {
      const e = new Error("Sem permissão."); e.status = 403; throw e;
    }

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
  const t0 = Date.now();
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

    console.log("[listarSubmissoesAdmin]", {
      chamadaId,
      total: rows.length,
      ms: Date.now() - t0,
    });
    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesAdmin][erro]", {
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

exports.avaliarEscrita = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { itens = [] } = req.body;
    const subId = Number(req.params.id);
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação.");

    const userId = req.user?.id;
    const isAdm   = await isAdmin(userId);
    const canView = await canUserReviewOrView(userId, subId);
    const permitido = isAdm || canView;

    console.log("[avaliarEscrita][perm]", { subId, userId, isAdm, canView, permitido });

    if (!permitido) return res.status(403).json({ erro: "Apenas avaliadores atribuídos ou administradores podem avaliar." });

    const lims = await db.any(`
      SELECT id, escala_min, escala_max
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
    `, [subId]);
    const byId = new Map(lims.map(x => [x.id, x]));

    let inseridos = 0;
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
      `, [subId, userId, it.criterio_id, nota, it.comentarios || null]);
      inseridos++;
    }

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
      await db.none?.(SQL_UPD, [subId]);
      rowCount = 0;
    }

    console.log("[avaliarEscrita][upsert]", { subId, userId, itens: itens.length, inseridos, mudouStatus: rowCount > 0 });

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

    console.log("[avaliarEscrita][OK]", { subId, userId, ms: Date.now() - t0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[avaliarEscrita][erro]", {
      subId: Number(req.params.id),
      userId: req.user?.id,
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

exports.avaliarOral = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { itens = [] } = req.body;
    const subId = Number(req.params.id);
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação oral.");

    const userId = req.user?.id;
    const isAdm   = await isAdmin(userId);
    const canView = await canUserReviewOrView(userId, subId);
    const permitido = isAdm || canView;

    console.log("[avaliarOral][perm]", { subId, userId, isAdm, canView, permitido });

    if (!permitido) return res.status(403).json({ erro: "Apenas avaliadores atribuídos ou administradores podem avaliar." });

    const lims = await db.any(`
      SELECT id, escala_min, escala_max FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
    `, [subId]);
    const byId = new Map(lims.map(x => [x.id, x]));

    let inseridos = 0;
    for (const it of itens) {
      const lim = byId.get(it.criterio_oral_id);
      assert(lim, "Critério oral inválido.");
      assert(Number.isInteger(it.nota) && it.nota >= lim.escala_min && it.nota <= lim.escala_max, `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`);
      await db.none(`
        INSERT INTO trabalhos_apresentacoes_orais_itens (submissao_id, avaliador_id, criterio_oral_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_oral_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
      `, [subId, userId, it.criterio_oral_id, it.nota, it.comentarios || null]);
      inseridos++;
    }

    console.log("[avaliarOral][OK]", { subId, userId, itens: itens.length, inseridos, ms: Date.now() - t0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[avaliarOral][erro]", {
      subId: Number(req.params.id),
      userId: req.user?.id,
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

exports.consolidarClassificacao = async (req, res, next) => {
  const t0 = Date.now();
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

    console.log("[consolidarClassificacao][OK]", {
      chamadaId,
      aprovados_exposicao: top40.length,
      aprovados_oral: aprovadosOral.length,
      ms: Date.now() - t0,
    });

    res.json({ ok: true, exposicao: top40.length, oral: aprovadosOral.length });
  } catch (err) {
    console.error("[consolidarClassificacao][erro]", {
      chamadaId: Number(req.params.chamadaId),
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

exports.definirStatusFinal = async (req, res, next) => {
  const t0 = Date.now();
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

    console.log("[definirStatusFinal][OK]", {
      submissaoId: id, status, ms: Date.now() - t0,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[definirStatusFinal][erro]", {
      submissaoId: Number(req.params.id),
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────
 * (ADMIN) — listar TODAS as submissões (sem filtrar por chamada)
 *   GET /api/admin/submissoes
 * ──────────────────────────────────────────────────────────────── */
exports.listarSubmissoesAdminTodas = async (_req, res, next) => {
  const t0 = Date.now();
  try {
    const rows = await db.any(`
      SELECT
        s.id,
        s.titulo,
        s.usuario_id,
        s.status,
        s.linha_tematica_codigo,
        s.linha_tematica_id,
        tcl.nome AS linha_tematica_nome,
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
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
      LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
      ORDER BY s.criado_em DESC, s.id ASC
    `);

    console.log("[listarSubmissoesAdminTodas]", {
      total: rows.length,
      ms: Date.now() - t0,
    });

    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesAdminTodas][erro]", {
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

// ========== LISTAR SUBMISSÕES ATRIBUÍDAS AO AVALIADOR ==========
exports.listarSubmissoesDoAvaliador = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const uid = req.user.id;

    const rows = await req.db.any(`
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.linha_tematica_codigo,
        s.linha_tematica_id,
        tcl.nome AS linha_tematica_nome,
        s.inicio_experiencia,
        c.titulo AS chamada_titulo,
        COALESCE(ve.total_ponderado,0) AS total_escrita,
        COALESCE(vo.total_oral_ponderado,0) AS total_oral,
        (COALESCE(ve.total_ponderado,0)+COALESCE(vo.total_oral_ponderado,0)) AS total_geral,
        EXISTS (
          SELECT 1 FROM trabalhos_avaliacoes_itens tai
          WHERE tai.submissao_id = s.id AND tai.avaliador_id = $1
        ) AS ja_avaliado
      FROM trabalhos_submissoes_avaliadores tsa
      JOIN trabalhos_submissoes s ON s.id = tsa.submissao_id
      JOIN trabalhos_chamadas c   ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
      LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
      WHERE tsa.avaliador_id = $1
      ORDER BY s.id DESC
    `, [uid]);

    console.log("[listarSubmissoesDoAvaliador]", {
      avaliador: uid,
      total: rows.length,
      ms: Date.now() - t0,
    });

    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesDoAvaliador][erro]", {
      avaliador: req.user?.id,
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

// ========== OBTÉM DADOS “CEGOS” + CRITÉRIOS PARA AVALIAÇÃO ==========
exports.obterParaAvaliacao = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const uid  = req.user.id;
    const sid  = Number(req.params.id);

    const isAdminUser = Array.isArray(req.user.perfil) && req.user.perfil.includes("administrador");
    const designado = await req.db.oneOrNone(
      `SELECT 1 FROM trabalhos_submissoes_avaliadores WHERE submissao_id=$1 AND avaliador_id=$2`,
      [sid, uid]
    );
    if (!isAdminUser && !designado) {
      const e = new Error("Sem permissão para avaliar este trabalho."); e.status = 403; throw e;
    }

    const s = await req.db.oneOrNone(`
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.inicio_experiencia,
        s.linha_tematica_codigo,
        s.linha_tematica_id,
        tcl.nome AS linha_tematica_nome,
        s.chamada_id,
        c.titulo AS chamada_titulo,
        a.nome_original AS poster_nome,
        /* ⬇️ textos que o autor digitou */
        s.introducao,
        s.objetivos,
        s.metodo,
        s.resultados,
        s.consideracoes,
        s.bibliografia
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
      WHERE s.id=$1
    `, [sid]);
    if (!s) { const e = new Error("Submissão não encontrada."); e.status = 404; throw e; }

    const criterios = await req.db.any(`
      SELECT
        id,
        titulo AS criterio,       -- ✅ usa a coluna existente
        COALESCE(escala_min, 0)  AS escala_min,
        COALESCE(escala_max, 10) AS escala_max,
        COALESCE(peso, 1)::int   AS peso,
        COALESCE(ordem, id)::int AS ordem
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = $1
      ORDER BY ordem ASC, id ASC
    `, [s.chamada_id]);

    const meusItens = await req.db.any(`
      SELECT criterio_id, nota, COALESCE(comentarios,'') AS comentarios
      FROM trabalhos_avaliacoes_itens
      WHERE submissao_id=$1 AND avaliador_id=$2
    `, [sid, uid]);

    console.log("[obterParaAvaliacao]", {
      subId: sid, avaliador: uid,
      criterios: criterios.length,
      itensExistentes: meusItens.length,
      ms: Date.now() - t0,
    });

    res.json({
      submissao: {
        id: s.id,
        titulo: s.titulo,
        status: s.status,
        inicio_experiencia: s.inicio_experiencia,
        linha_tematica_codigo: s.linha_tematica_codigo,
       linha_tematica_nome:   s.linha_tematica_nome,
        chamada_titulo: s.chamada_titulo,
        poster_nome: s.poster_nome,
        poster_url: `/api/submissoes/${s.id}/poster`,
        // ⬇️ textos para o avaliador ler
        introducao: s.introducao,
        objetivos: s.objetivos,
        metodo: s.metodo,
        resultados: s.resultados,
        consideracoes: s.consideracoes,
        bibliografia: s.bibliografia,
      },
      criterios,
      avaliacaoAtual: meusItens,
    });
  } catch (err) {
    console.error("[obterParaAvaliacao][erro]", {
      subId: Number(req.params.id),
      avaliador: req.user?.id,
      message: err.message, code: err.code, stack: err.stack,
      ms: Date.now() - t0,
    });
    next(err);
  }
};

// ========== PERMISSÃO FINA DENTRO DO AVALIAR ==========
const _isAdminOrDesignado = async (dbConn, user, submissaoId) => {
  const isAdminUser = Array.isArray(user.perfil) && user.perfil.includes("administrador");
  if (isAdminUser) return true;
  const r = await dbConn.oneOrNone(
    `SELECT 1 FROM trabalhos_submissoes_avaliadores WHERE submissao_id=$1 AND avaliador_id=$2`,
    [submissaoId, user.id]
  );
  return !!r;
};

const _oldAvaliarEscrita = exports.avaliarEscrita;
exports.avaliarEscrita = async (req, res, next) => {
  try {
    const subId = Number(req.params.id);
    if (!(await _isAdminOrDesignado(req.db, req.user, subId))) {
      const e = new Error("Sem permissão para avaliar esta submissão."); e.status = 403; throw e;
    }
    return _oldAvaliarEscrita(req, res, next);
  } catch (err) { next(err); }
};
