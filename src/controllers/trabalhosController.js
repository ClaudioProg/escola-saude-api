/* eslint-disable no-console */
"use strict";

const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const crypto = require("crypto");

// Usa o adaptador resiliente (db ou módulo inteiro)
const { db } = require("../db");

// Raiz persistente (para resolver caminhos legados/relativos)
const { UPLOADS_DIR } = require("../paths");

// Fuso padrão do projeto (comparações de prazos)
const ZONA = "America/Sao_Paulo";
const TZ_SQL = `now() AT TIME ZONE '${ZONA}'`; // → timestamp sem tz no fuso

// Notificações
const {
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
} = require("./notificacoesController");

// ⬇️ helpers de autorização (admin/avaliador)
const {
  canUserReviewOrView,
  isAdmin,
  atualizarNotaMediaMaterializada,
} = require("./submissoesAdminController");

/* ──────────────────────────────────────────────────────────────
   Config / Helpers premium
────────────────────────────────────────────────────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";
const DBG = String(process.env.DEBUG_TRABALHOS || "").trim() === "1";
const log = (...a) => DBG && console.log("[TRABALHOS]", ...a);

function isYYYYMM(s) {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
function assert(cond, msg) {
  if (!cond) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }
}
function withinLen(s, max) {
  return typeof s === "string" && String(s).trim().length <= max;
}
function hasRole(user, role) {
  if (!user) return false;
  const p = user.perfil;
  return Array.isArray(p) ? p.includes(role) : p === role;
}
function toIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    await fsp.unlink(filePath);
  } catch {
    // ignore
  }
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function sanitizeFilename(name = "") {
  const base = String(name)
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `arquivo_${Date.now()}`;
}

function guessMimeByExt(filename = "") {
  const ext = String(filename).toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  if (ext === "pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return "application/octet-stream";
}

function logDownload(label, ctx) {
  const safe = {};
  for (const k of Object.keys(ctx || {})) {
    const v = ctx[k];
    safe[k] =
      typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v == null
        ? v
        : Buffer.isBuffer(v)
          ? `Buffer(${v.length})`
          : JSON.stringify(v);
  }
  console.log(`[${new Date().toISOString()}][${label}]`, safe);
}

/**
 * Converte um caminho salvo no DB (pode ter \, /, ser relativo ou absoluto)
 * em um caminho absoluto válido sem path traversal.
 */
function normalizeStoragePath(dbPath) {
  if (!dbPath) return null;

  const raw = String(dbPath).trim().replace(/\\/g, "/");
  const isAbs = path.isAbsolute(raw);

  if (isAbs) {
    const abs = path.normalize(raw);
    return abs;
  }

  // remove prefixo "./" ou "/" apenas se for relativo
  const rel = raw.replace(/^\.?\//, "");

  // remove prefixo "uploads/" se vier duplicado
  const relFromUploads = rel.replace(/^uploads\//i, "");

  const candidates = [
    path.join(UPLOADS_DIR, relFromUploads),
    path.join(process.cwd(), "uploads", relFromUploads),
    path.join(process.cwd(), relFromUploads),
  ];

  for (const cand of candidates) {
    try {
      const abs = path.normalize(cand);

      // hardening básico: impedir traversal saindo das bases esperadas
      const ok =
        abs.startsWith(path.normalize(UPLOADS_DIR)) ||
        abs.startsWith(path.normalize(path.join(process.cwd(), "uploads"))) ||
        abs.startsWith(path.normalize(process.cwd()));

      if (!ok) continue;

      if (fs.existsSync(abs)) return abs;
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * A partir do caminho absoluto FINAL (já dentro de UPLOADS_DIR),
 * devolve um relativo padrão "uploads/<subdir>/<filename>".
 */
function toUploadsRelative(absPath, subdir) {
  const abs = path.normalize(absPath);

  const relFromUploads = path
    .relative(UPLOADS_DIR, abs)
    .replace(/\\/g, "/");

  // se não dá pra relativizar (fora do UPLOADS_DIR), cai em fallback seguro
  if (!relFromUploads || relFromUploads.startsWith("..")) {
    return `uploads/${subdir}/${path.basename(abs)}`;
  }
  return `uploads/${relFromUploads}`;
}

/**
 * Move arquivo do tmp do multer para pasta final dentro de UPLOADS_DIR
 * e devolve { absFinal, relDb }.
 */
async function moveUploadedToFinal({ tmpPath, originalName, subdir }) {
  assert(tmpPath, "Arquivo temporário ausente.");
  assert(subdir, "subdir inválido.");

  const dirFinal = path.join(UPLOADS_DIR, subdir);
  await ensureDir(dirFinal);

  const safeName = sanitizeFilename(originalName || "arquivo");
  const stamp = crypto.randomBytes(6).toString("hex");
  const finalName = `${stamp}__${safeName}`;
  const absFinal = path.join(dirFinal, finalName);

  await fsp.rename(tmpPath, absFinal);

  const relDb = toUploadsRelative(absFinal, subdir);
  return { absFinal, relDb };
}

/**
 * Verifica se tabela/coluna existe para suporte a BLOB opcional.
 * (Evita quebrar em bancos que não têm coluna "arquivo")
 */
async function tableHasColumn(table, column) {
  try {
    const row = await db.oneOrNone(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = $1
        AND column_name = $2
      LIMIT 1
      `,
      [String(table), String(column)]
    );
    return !!row;
  } catch (e) {
    // se não der permissão pra information_schema, assume que não tem (modo seguro)
    log("tableHasColumn fallback:", e?.message);
    return false;
  }
}

async function getChamadaValidacao(chamadaId) {
  const c = await db.oneOrNone(
    `
    SELECT *, (${TZ_SQL} <= prazo_final_br) AS dentro_prazo
    FROM trabalhos_chamadas
    WHERE id=$1
    `,
    [chamadaId]
  );
  if (!c) {
    const e = new Error("Chamada inexistente.");
    e.status = 404;
    throw e;
  }
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
  const bloqueados = new Set(["em_avaliacao", "aprovado_exposicao", "aprovado_oral", "reprovado"]);
  if (bloqueados.has(String(sub.status || "").toLowerCase())) {
    return { ok: false, msg: "Submissão em avaliação ou finalizada." };
  }
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────
   Normalização 0–10 (mantida do seu código)
────────────────────────────────────────────────────────────── */
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function nota10Normalizada({ itens, criterios }) {
  const byId = new Map(criterios.map((c) => [c.id, c]));
  let num = 0, den = 0;
  for (const it of itens) {
    const c = byId.get(it.criterio_id);
    if (!c) continue;
    const min = Number(c.escala_min ?? 0);
    const max = Number(c.escala_max ?? 10);
    const w = Number.isFinite(c.peso) ? Number(c.peso) : 1;
    const r = Number(it.nota);
    if (!Number.isFinite(r) || max <= min) continue;
    const score = clamp01((r - min) / (max - min));
    num += w * score;
    den += w;
  }
  if (den === 0) return null;
  return Number((10 * (num / den)).toFixed(1));
}

async function atualizarNotasPersistidas50_50(subId) {
  // ===== ESCRITA =====
  try {
    const criteriosE = await db.any(
      `
      SELECT id,
             COALESCE(escala_min,0)  AS escala_min,
             COALESCE(escala_max,10) AS escala_max,
             COALESCE(peso,1)        AS peso
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
      ORDER BY id
      `,
      [subId]
    );

    const itensE = await db.any(
      `
      SELECT avaliador_id, criterio_id, nota
      FROM trabalhos_avaliacoes_itens
      WHERE submissao_id=$1
      ORDER BY avaliador_id
      `,
      [subId]
    );

    const porAvaliadorE = new Map();
    for (const row of itensE) {
      const arr = porAvaliadorE.get(row.avaliador_id) || [];
      arr.push({ criterio_id: row.criterio_id, nota: Number(row.nota) });
      porAvaliadorE.set(row.avaliador_id, arr);
    }

    const notasIndE = [];
    for (const arr of porAvaliadorE.values()) {
      const n10 = nota10Normalizada({ itens: arr, criterios: criteriosE });
      if (n10 != null) notasIndE.push(n10);
    }

    const mediaE = notasIndE.length
      ? Number((notasIndE.reduce((a, b) => a + b, 0) / notasIndE.length).toFixed(1))
      : null;

    await db.none(
      `
      UPDATE trabalhos_submissoes
         SET nota_escrita=$2,
             atualizado_em=NOW()
       WHERE id=$1
      `,
      [subId, mediaE]
    );
  } catch (e) {
    console.error("[atualizarNotasPersistidas50_50][escrita][erro]", e?.message || e);
  }

  // ===== ORAL =====
  try {
    const criteriosO = await db.any(
      `
      SELECT id,
             COALESCE(escala_min,0)  AS escala_min,
             COALESCE(escala_max,10) AS escala_max,
             COALESCE(peso,1)        AS peso
      FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
      ORDER BY id
      `,
      [subId]
    );

    const itensO = await db.any(
      `
      SELECT avaliador_id, criterio_oral_id AS criterio_id, nota
      FROM trabalhos_apresentacoes_orais_itens
      WHERE submissao_id=$1
      ORDER BY avaliador_id
      `,
      [subId]
    );

    const porAvaliadorO = new Map();
    for (const row of itensO) {
      const arr = porAvaliadorO.get(row.avaliador_id) || [];
      arr.push({ criterio_id: row.criterio_id, nota: Number(row.nota) });
      porAvaliadorO.set(row.avaliador_id, arr);
    }

    const notasIndO = [];
    for (const arr of porAvaliadorO.values()) {
      const n10 = nota10Normalizada({ itens: arr, criterios: criteriosO });
      if (n10 != null) notasIndO.push(n10);
    }

    const mediaO = notasIndO.length
      ? Number((notasIndO.reduce((a, b) => a + b, 0) / notasIndO.length).toFixed(1))
      : null;

    await db.none(
      `
      UPDATE trabalhos_submissoes
         SET nota_oral=$2,
             atualizado_em=NOW()
       WHERE id=$1
      `,
      [subId, mediaO]
    );
  } catch (e) {
    console.error("[atualizarNotasPersistidas50_50][oral][erro]", e?.message || e);
  }

  // ===== FINAL =====
  try {
    await db.none(
      `
      UPDATE trabalhos_submissoes
         SET nota_final = ROUND(
               CASE
                 WHEN nota_escrita IS NOT NULL AND nota_oral IS NOT NULL THEN (nota_escrita + nota_oral)/2.0
                 WHEN nota_escrita IS NOT NULL THEN nota_escrita
                 WHEN nota_oral    IS NOT NULL THEN nota_oral
                 ELSE NULL
               END, 1
             ),
             atualizado_em = NOW()
       WHERE id=$1
      `,
      [subId]
    );
  } catch (e) {
    console.error("[atualizarNotasPersistidas50_50][final][erro]", e?.message || e);
  }
}

/* ──────────────────────────────────────────────────────────────
   Helper: obtém usuário autenticado
────────────────────────────────────────────────────────────── */
function getAuthUser(req, res) {
  return res?.locals?.user ?? req.user ?? null;
}
function getAuthUserId(req, res) {
  const u = getAuthUser(req, res);
  const id = toIntOrNull(u?.id);
  return { user: u, userId: id };
}

/* ──────────────────────────────────────────────────────────────
   CRIAR SUBMISSÃO (autor)
────────────────────────────────────────────────────────────── */
exports.criarSubmissao = async (req, res, next) => {
  try {
    const chamadaId = toIntOrNull(req.params.chamadaId);
    if (chamadaId === null) {
      const e = new Error("chamadaId inválido.");
      e.status = 400;
      throw e;
    }

    const { user, userId } = getAuthUserId(req, res);
    if (userId === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const ch = await getChamadaValidacao(chamadaId);
    assert(ch.publicado, "Chamada não publicada.");
    assert(ch.dentro_prazo, "O prazo de submissão encerrou.");

    const {
      titulo,
      inicio_experiencia,
      linha_tematica_id,
      introducao,
      objetivos,
      metodo,
      resultados,
      consideracoes,
      bibliografia,
      coautores = [],
      status: statusIn,
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
      assert(
        consideracoes && withinLen(consideracoes, lim.consideracoes),
        `Considerações finais até ${lim.consideracoes} caracteres.`
      );
      if (bibliografia) assert(withinLen(bibliografia, 8000), "Bibliografia muito longa.");
    }

    const lt = await db.oneOrNone(
      `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
      [linha_tematica_id, chamadaId]
    );
    assert(lt, "Linha temática inválida para esta chamada.");

    const ins = await db.one(
      `
      INSERT INTO trabalhos_submissoes
      (usuario_id, chamada_id, titulo, inicio_experiencia, linha_tematica_id, linha_tematica_codigo,
       introducao, objetivos, metodo, resultados, consideracoes, bibliografia, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
      `,
      [
        userId,
        chamadaId,
        String(titulo).trim(),
        inicio_experiencia,
        lt.id,
        lt.codigo || null,
        introducao || null,
        objetivos || null,
        metodo || null,
        resultados || null,
        consideracoes || null,
        bibliografia || null,
        status,
      ]
    );

    assert(Array.isArray(coautores) && coautores.length <= ch.max_coautores, `Máximo de ${ch.max_coautores} coautores.`);
    for (const c of coautores) {
      if (!c?.nome) continue;
      await db.none(
        `
        INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel, cpf, vinculo)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [ins.id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null, c.cpf || null, c.vinculo || null]
      );
    }

    await notificarSubmissaoCriada({
      usuario_id: userId,
      chamada_titulo: ch.titulo,
      trabalho_titulo: String(titulo).trim(),
      submissao_id: ins.id,
    });

    if (status === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: userId,
        chamada_titulo: ch.titulo,
        trabalho_titulo: String(titulo).trim(),
        status: "submetido",
      });
    }

    res.status(201).json({ ok: true, id: ins.id, status });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   ATUALIZAR SUBMISSÃO (autor) — PUT /submissoes/:id
────────────────────────────────────────────────────────────── */
exports.atualizarSubmissao = async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) {
      const e = new Error("id inválido.");
      e.status = 400;
      throw e;
    }

    const { user: authUser, userId } = getAuthUserId(req, res);
    if (userId === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const meta = await db.oneOrNone(
      `
      SELECT s.*, c.id AS chamada_id, c.titulo AS chamada_titulo,
             c.periodo_experiencia_inicio, c.periodo_experiencia_fim,
             c.max_coautores, c.limites,
             (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
      `,
      [id]
    );

    if (!meta) {
      const e = new Error("Submissão não encontrada.");
      e.status = 404;
      throw e;
    }

    const ehAdmin = Array.isArray(authUser?.perfil) && authUser.perfil.includes("administrador");
    const ehAutor = String(meta.usuario_id) === String(userId);

    if (!ehAdmin && !ehAutor) {
      const e = new Error("Sem permissão para editar esta submissão.");
      e.status = 403;
      throw e;
    }

    const gate = podeExcluirOuEditarPeloAutor(meta, meta);
    assert(gate.ok, gate.msg);

    const {
      titulo,
      inicio_experiencia,
      linha_tematica_id,
      introducao,
      objetivos,
      metodo,
      resultados,
      consideracoes,
      bibliografia,
      coautores = [],
      status: statusIn,
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
      assert(
        consideracoes && withinLen(consideracoes, lim.consideracoes),
        `Considerações finais até ${lim.consideracoes} caracteres.`
      );
      if (bibliografia) assert(withinLen(bibliografia, 8000), "Bibliografia muito longa.");
    }

    const lt = await db.oneOrNone(
      `SELECT id, codigo FROM trabalhos_chamada_linhas WHERE id=$1 AND chamada_id=$2`,
      [linha_tematica_id, meta.chamada_id]
    );
    assert(lt, "Linha temática inválida para esta chamada.");

    await db.tx(async (t) => {
      await t.none(
        `
        UPDATE trabalhos_submissoes
           SET titulo=$1, inicio_experiencia=$2, linha_tematica_id=$3, linha_tematica_codigo=$4,
               introducao=$5, objetivos=$6, metodo=$7, resultados=$8, consideracoes=$9, bibliografia=$10,
               status=$11, atualizado_em=NOW()
         WHERE id=$12
        `,
        [
          String(titulo).trim(),
          inicio_experiencia,
          lt.id,
          lt.codigo || null,
          introducao || null,
          objetivos || null,
          metodo || null,
          resultados || null,
          consideracoes || null,
          bibliografia || null,
          status,
          id,
        ]
      );

      assert(Array.isArray(coautores) && coautores.length <= meta.max_coautores, `Máximo de ${meta.max_coautores} coautores.`);
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      for (const c of coautores) {
        if (!c?.nome) continue;
        await t.none(
          `
          INSERT INTO trabalhos_coautores (submissao_id, nome, email, unidade, papel, cpf, vinculo)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [id, String(c.nome).trim(), c.email || null, c.unidade || null, c.papel || null, c.cpf || null, c.vinculo || null]
        );
      }
    });

    if (meta.status !== "submetido" && status === "submetido") {
      await notificarStatusSubmissao({
        usuario_id: meta.usuario_id,
        chamada_titulo: meta.chamada_titulo,
        trabalho_titulo: String(titulo).trim(),
        status: "submetido",
      });
    }

    res.json({ ok: true, id, status });
  } catch (err) {
    next(err);
  }
};

// gate específico para EXCLUSÃO
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

/* ──────────────────────────────────────────────────────────────
   EXCLUIR SUBMISSÃO (autor) — DELETE /submissoes/:id
────────────────────────────────────────────────────────────── */
exports.removerSubmissao = async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (id === null) {
      const e = new Error("id inválido.");
      e.status = 400;
      throw e;
    }

    const { user: authUser, userId } = getAuthUserId(req, res);
    if (userId === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const meta = await db.oneOrNone(
      `
      SELECT s.*, c.prazo_final_br, (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
      `,
      [id]
    );

    if (!meta) {
      const e = new Error("Submissão não encontrada.");
      e.status = 404;
      throw e;
    }

    const gate = podeExcluirPeloAutor(meta, { ...(authUser || {}), id: userId });
    if (!gate.ok) {
      const e = new Error(gate.msg);
      e.status = gate.status || 400;
      throw e;
    }

    // apaga coautores/arquivos e a submissão
    await db.tx(async (t) => {
      await t.none(`DELETE FROM trabalhos_coautores WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_arquivos  WHERE submissao_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_submissoes WHERE id=$1`, [id]);
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   Upload helpers: inserir arquivo no DB (DISCO + BLOB opcional)
────────────────────────────────────────────────────────────── */
async function inserirArquivoSubmissao({
  submissaoId,
  relPathDb,
  absFinal,
  originalName,
  mimetype,
}) {
  const stat = await fsp.stat(absFinal);
  const size = stat.size;

  // hash do arquivo (stream é melhor, mas aqui está ok e simples)
  const fileBuf = await fsp.readFile(absFinal);
  const hash = crypto.createHash("sha256").update(fileBuf).digest("hex");

  const hasBlob = await tableHasColumn("trabalhos_arquivos", "arquivo");
  const hasBytes = await tableHasColumn("trabalhos_arquivos", "tamanho_bytes");
  const hasSizeAlt = await tableHasColumn("trabalhos_arquivos", "tamanho"); // compat

  const cols = ["submissao_id", "caminho", "nome_original", "mime_type", "hash_sha256"];
  const vals = ["$1", "$2", "$3", "$4", "$5"];
  const params = [submissaoId, relPathDb, originalName, mimetype, hash];

  if (hasBytes) {
    cols.push("tamanho_bytes");
    vals.push(`$${params.length + 1}`);
    params.push(size);
  } else if (hasSizeAlt) {
    cols.push("tamanho");
    vals.push(`$${params.length + 1}`);
    params.push(size);
  }

  if (hasBlob) {
    cols.push("arquivo");
    vals.push(`$${params.length + 1}`);
    params.push(fileBuf);
  }

  const sql = `
    INSERT INTO trabalhos_arquivos (${cols.join(", ")})
    VALUES (${vals.join(", ")})
    RETURNING id
  `;

  const arq = await db.one(sql, params);
  return { id: arq.id, size, hash, stored_blob: hasBlob };
}

/* ──────────────────────────────────────────────────────────────
   PÔSTER — upload + download inline
────────────────────────────────────────────────────────────── */
exports.atualizarPoster = async (req, res, next) => {
  let tmp = null;
  try {
    const { user: authUser, userId } = getAuthUserId(req, res);
    if (userId === null) return res.status(401).json({ erro: "Usuário não autenticado." });

    assert(req.file, "Envie o arquivo .ppt/.pptx no campo 'poster'.");
    tmp = req.file.path;

    const subId = toIntOrNull(req.params.id);
    assert(subId !== null, "Submissão inválida.");

    const sub = await db.oneOrNone(
      `
      SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
             c.id AS chamada_id, c.titulo AS chamada_titulo, c.aceita_poster,
             (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo,
             s.status
        FROM trabalhos_submissoes s
        JOIN trabalhos_chamadas c ON c.id = s.chamada_id
       WHERE s.id=$1
      `,
      [subId]
    );
    assert(sub, "Submissão não encontrada.");

    const ehAdmin = Array.isArray(authUser?.perfil) && authUser.perfil.includes("administrador");
    const ehAutor = String(sub.usuario_id) === String(userId);
    if (!ehAdmin && !ehAutor) {
      return res.status(403).json({ erro: "Você não tem permissão para enviar o pôster desta submissão." });
    }

    assert(sub.aceita_poster, "Esta chamada não aceita envio de pôster.");
    assert(sub.dentro_prazo, "Prazo encerrado para alterações.");

    const okMime =
      /powerpoint|presentation/i.test(req.file.mimetype) ||
      /\.(pptx?)$/i.test(req.file.originalname || "");
    assert(okMime, "Formato inválido. Envie .ppt ou .pptx.");

    // move do tmp -> final (evita arquivo “sumir”)
    const moved = await moveUploadedToFinal({
      tmpPath: req.file.path,
      originalName: req.file.originalname,
      subdir: "posters",
    });

    const mime = req.file.mimetype || guessMimeByExt(req.file.originalname);

    const arq = await inserirArquivoSubmissao({
      submissaoId: sub.id,
      relPathDb: moved.relDb,
      absFinal: moved.absFinal,
      originalName: req.file.originalname,
      mimetype: mime,
    });

    await db.none(
      `UPDATE trabalhos_submissoes SET poster_arquivo_id=$1, atualizado_em=NOW() WHERE id=$2`,
      [arq.id, sub.id]
    );

    await notificarPosterAtualizado({
      usuario_id: userId,
      chamada_titulo: sub.chamada_titulo,
      trabalho_titulo: sub.trabalho_titulo,
      arquivo_nome: req.file.originalname,
    });

    res.json({
      ok: true,
      arquivo_id: arq.id,
      stored_blob: arq.stored_blob,
      caminho: moved.relDb,
    });
  } catch (err) {
    next(err);
  } finally {
    // se algo falhar antes do rename, remove tmp
    await safeUnlink(tmp);
  }
};

exports.baixarPoster = async (req, res, next) => {
  try {
    const subId = toIntOrNull(req.params.id);
    if (subId === null) return res.status(400).json({ erro: "id inválido." });

    const { userId } = getAuthUserId(req, res);
    if (userId === null) return res.status(401).json({ erro: "Não autorizado." });

    const ehAdministrador = await isAdmin(userId);
    let permitido = ehAdministrador || (await canUserReviewOrView(userId, subId));
    if (!permitido) {
      const dono = await db.oneOrNone(`SELECT usuario_id FROM trabalhos_submissoes WHERE id=$1`, [subId]);
      permitido = String(dono?.usuario_id) === String(userId);
    }
    if (!permitido) return res.status(403).json({ erro: "Acesso negado." });

    const row = await db.oneOrNone(
      `
      SELECT a.id, a.caminho, a.nome_original, a.mime_type, a.arquivo
        FROM trabalhos_submissoes s
        LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
       WHERE s.id=$1
      `,
      [subId]
    );

    if (!row) return res.status(404).json({ erro: "Pôster não encontrado." });

    const filename = row.nome_original || "poster.pptx";
    const mime = row.mime_type || guessMimeByExt(filename);

    logDownload("poster:meta", {
      subId,
      caminhoDB: row.caminho || null,
      mime,
      temBlob: !!row.arquivo,
    });

    res.setHeader("Content-Disposition", `inline; filename="${sanitizeFilename(filename)}"`);
    res.setHeader("Content-Type", mime);

    // 1) Preferir BLOB se existir
    if (row.arquivo && row.arquivo.length) {
      return res.end(row.arquivo);
    }

    // 2) Senão, tenta disco
    const abs = normalizeStoragePath(row.caminho);
    logDownload("poster:fs-check", { subId, caminhoResolvido: abs, exists: !!abs && fs.existsSync(abs) });

    if (abs && fs.existsSync(abs)) return fs.createReadStream(abs).pipe(res);

    return res.status(410).json({
      erro: "Arquivo do pôster não está disponível no momento.",
      acao_sugerida: "Envie novamente o arquivo do pôster.",
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   BANNER — com banner_arquivo_id (se existir), fallback no poster_arquivo_id
────────────────────────────────────────────────────────────── */
async function getBannerArquivoJoinClause() {
  // Se existe coluna banner_arquivo_id, usa ela; senão, usa poster_arquivo_id
  const hasBannerFk = await tableHasColumn("trabalhos_submissoes", "banner_arquivo_id");
  return hasBannerFk ? "s.banner_arquivo_id" : "s.poster_arquivo_id";
}

exports.atualizarBanner = async (req, res, next) => {
  let tmp = null;
  try {
    const { user: authUser, userId } = getAuthUserId(req, res);
    if (userId === null) return res.status(401).json({ erro: "Usuário não autenticado." });

    assert(req.file, "Envie o arquivo do banner no campo 'banner'.");
    tmp = req.file.path;

    const subId = toIntOrNull(req.params.id);
    assert(subId !== null, "Submissão inválida.");

    const sub = await db.oneOrNone(
      `
      SELECT s.id, s.usuario_id, s.titulo AS trabalho_titulo,
             c.id AS chamada_id, c.titulo AS chamada_titulo,
             (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo
        FROM trabalhos_submissoes s
        JOIN trabalhos_chamadas c ON c.id = s.chamada_id
       WHERE s.id=$1
      `,
      [subId]
    );
    assert(sub, "Submissão não encontrada.");

    const ehAdmin = Array.isArray(authUser?.perfil) && authUser.perfil.includes("administrador");
    const ehAutor = String(sub.usuario_id) === String(userId);
    if (!ehAdmin && !ehAutor) {
      return res.status(403).json({ erro: "Você não tem permissão para enviar o banner desta submissão." });
    }

    assert(sub.dentro_prazo, "Prazo encerrado para alterações.");

    // aceita imagem, PDF e PPT/PPTX
    const okMime =
      /^image\//i.test(req.file.mimetype) ||
      /^application\/pdf$/i.test(req.file.mimetype) ||
      /powerpoint|presentation/i.test(req.file.mimetype) ||
      /\.(png|jpe?g|gif|webp|pdf|pptx?)$/i.test(req.file.originalname || "");
    assert(okMime, "Formato inválido. Envie PNG/JPG/GIF/WEBP, PDF, PPT ou PPTX.");

    const moved = await moveUploadedToFinal({
      tmpPath: req.file.path,
      originalName: req.file.originalname,
      subdir: "banners",
    });

    const mime = req.file.mimetype || guessMimeByExt(req.file.originalname);

    const arq = await inserirArquivoSubmissao({
      submissaoId: sub.id,
      relPathDb: moved.relDb,
      absFinal: moved.absFinal,
      originalName: req.file.originalname,
      mimetype: mime,
    });

    const hasBannerFk = await tableHasColumn("trabalhos_submissoes", "banner_arquivo_id");
    if (hasBannerFk) {
      await db.none(
        `UPDATE trabalhos_submissoes SET banner_arquivo_id=$1, atualizado_em=NOW() WHERE id=$2`,
        [arq.id, sub.id]
      );
    } else {
      // compat: enquanto não existir banner_arquivo_id, espelha no poster_arquivo_id
      await db.none(
        `UPDATE trabalhos_submissoes SET poster_arquivo_id=$1, atualizado_em=NOW() WHERE id=$2`,
        [arq.id, sub.id]
      );
    }

    res.json({
      ok: true,
      arquivo_id: arq.id,
      stored_blob: arq.stored_blob,
      caminho: moved.relDb,
      usando_banner_arquivo_id: hasBannerFk,
    });
  } catch (err) {
    next(err);
  } finally {
    await safeUnlink(tmp);
  }
};

exports.baixarBanner = async (req, res, next) => {
  try {
    const subId = toIntOrNull(req.params.id);
    if (subId === null) return res.status(400).json({ erro: "id inválido." });

    const { userId } = getAuthUserId(req, res);
    if (userId === null) return res.status(401).json({ erro: "Não autorizado." });

    // repositório: qualquer logado pode baixar
    logDownload("banner:auth", { subId, userId });

    const fk = await getBannerArquivoJoinClause();

    const row = await db.oneOrNone(
      `
      SELECT a.id, a.caminho, a.nome_original, a.mime_type, a.arquivo
        FROM trabalhos_submissoes s
        LEFT JOIN trabalhos_arquivos a ON a.id = ${fk}
       WHERE s.id=$1
      `,
      [subId]
    );

    assert(row && (row.caminho || row.arquivo), "Banner não encontrado.");

    const filename = row.nome_original || "banner";
    const mime = row.mime_type || guessMimeByExt(filename);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", `inline; filename="${sanitizeFilename(filename)}"`);

    if (row.arquivo && row.arquivo.length) {
      logDownload("banner:direct-blob", { subId, bytes: row.arquivo.length });
      return res.end(row.arquivo);
    }

    const abs = normalizeStoragePath(row.caminho);
    const exists = abs && fs.existsSync(abs);

    logDownload("banner:fs-check", { subId, caminhoResolvido: abs, exists });

    if (exists) return fs.createReadStream(abs).pipe(res);

    return res.status(410).json({
      erro: "Arquivo do banner não está disponível no momento.",
      acao_sugerida: "Envie novamente o arquivo do banner.",
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   LISTAS / OBTENÇÃO
────────────────────────────────────────────────────────────── */
exports.minhasSubmissoes = async (req, res, next) => {
  try {
    const { userId } = getAuthUserId(req, res);
    if (userId === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const rows = await db.any(
      `
      SELECT s.*, a.nome_original AS poster_nome,
             c.titulo AS chamada_titulo, c.prazo_final_br,
             (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
      WHERE s.usuario_id=$1
      ORDER BY s.criado_em DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// compat
exports.listarMinhas = exports.minhasSubmissoes;

exports.obterSubmissao = async (req, res, next) => {
  try {
    const subId = toIntOrNull(req.params.id);
    if (subId === null) {
      const e = new Error("id inválido.");
      e.status = 400;
      throw e;
    }

    const { userId } = getAuthUserId(req, res);
    if (userId === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const s = await db.oneOrNone(
      `
      SELECT s.*,
             pa.nome_original AS poster_nome, pa.caminho AS poster_caminho,
             /* banner fica pelo endpoint */
             c.titulo AS chamada_titulo, c.max_coautores,
             (${TZ_SQL} <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_arquivos pa ON pa.id = s.poster_arquivo_id
      WHERE s.id=$1
      `,
      [subId]
    );
    if (!s) {
      const e = new Error("Submissão não encontrada.");
      e.status = 404;
      throw e;
    }

    // Permissão: admin, autor OU avaliador atribuído
    const ehAdmin = await isAdmin(userId);
    const ehAutor = String(s.usuario_id) === String(userId);
    const ehAvaliadorVinculado = await canUserReviewOrView(userId, subId);
    if (!ehAdmin && !ehAutor && !ehAvaliadorVinculado) {
      const e = new Error("Sem permissão.");
      e.status = 403;
      throw e;
    }

    const coautores = await db.any(
      `
      SELECT id, nome, email, unidade, papel, cpf, vinculo
      FROM trabalhos_coautores
      WHERE submissao_id=$1
      ORDER BY id
      `,
      [s.id]
    );

    res.json({
      ...s,
      coautores,
      poster_url: s.poster_caminho ? `/api/trabalhos/submissoes/${s.id}/poster` : null,
      banner_url: `/api/trabalhos/submissoes/${s.id}/banner`,
    });
  } catch (err) {
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   ADMIN: listar por chamada / listar todas (mantido do seu código,
   só preservando e deixando como estava)
────────────────────────────────────────────────────────────── */
exports.listarSubmissoesAdmin = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const chamadaId = toIntOrNull(req.params.chamadaId);
    if (chamadaId === null) {
      const e = new Error("chamadaId inválido.");
      e.status = 400;
      throw e;
    }

    let rows;
    try {
      rows = await db.any(
        `
        WITH base AS (
          SELECT
            s.id,
            s.titulo,
            s.usuario_id,
            s.status,
            s.status_escrita,
            s.status_oral,
            s.nota_escrita,
            s.nota_oral,
            s.nota_final,
            s.linha_tematica_codigo,
            s.inicio_experiencia,
            s.criado_em,
            s.atualizado_em,
            u.nome  AS autor_nome,
            u.email AS autor_email,
            c.titulo AS chamada_titulo,
            COALESCE(ve.total_ponderado,0)      AS total_escrita,
            COALESCE(vo.total_oral_ponderado,0) AS total_oral,
            (COALESCE(ve.total_ponderado,0)+COALESCE(vo.total_oral_ponderado,0)) AS total_geral,
            COALESCE(n.soma_notas, 0)::numeric    AS soma_notas,
            COALESCE(n.qtd_itens, 0)              AS qtd_itens,
            COALESCE(n.qtd_avaliadores, 0)        AS qtd_avaliadores,
            COALESCE(
              s.nota_media,
              ROUND(COALESCE(n.soma_notas,0) / 4.0, 1)
            ) AS nota_media
          FROM trabalhos_submissoes s
          JOIN usuarios u              ON u.id = s.usuario_id
          JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
          LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
          LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
          LEFT JOIN LATERAL (
            SELECT
              SUM(tai.nota)                    AS soma_notas,
              COUNT(*)                         AS qtd_itens,
              COUNT(DISTINCT tai.avaliador_id) AS qtd_avaliadores
            FROM trabalhos_avaliacoes_itens tai
            WHERE tai.submissao_id = s.id
          ) n ON TRUE
          WHERE s.chamada_id = $1
        )
        SELECT
          ROW_NUMBER() OVER (
            ORDER BY nota_media DESC NULLS LAST,
                     total_geral DESC,
                     id ASC
          ) AS posicao,
          *
        FROM base
        ORDER BY nota_media DESC NULLS LAST, total_geral DESC, id ASC;
        `,
        [chamadaId]
      );
    } catch (errSelect) {
      if (errSelect?.code === "42703") {
        // fallback sem colunas novas
        rows = await db.any(
          `
          WITH base AS (
            SELECT
              s.id,
              s.titulo,
              s.usuario_id,
              s.status,
              NULL::text AS status_escrita,
              NULL::text AS status_oral,
              s.linha_tematica_codigo,
              s.inicio_experiencia,
              s.criado_em,
              s.atualizado_em,
              u.nome  AS autor_nome,
              u.email AS autor_email,
              c.titulo AS chamada_titulo,
              COALESCE(ve.total_ponderado,0)      AS total_escrita,
              COALESCE(vo.total_oral_ponderado,0) AS total_oral,
              (COALESCE(ve.total_ponderado,0)+COALESCE(vo.total_oral_ponderado,0)) AS total_geral,
              COALESCE(n.soma_notas, 0)::numeric    AS soma_notas,
              COALESCE(n.qtd_itens, 0)              AS qtd_itens,
              COALESCE(n.qtd_avaliadores, 0)        AS qtd_avaliadores,
              ROUND(COALESCE(n.soma_notas,0) / 4.0, 1) AS nota_media
            FROM trabalhos_submissoes s
            JOIN usuarios u              ON u.id = s.usuario_id
            JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
            LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
            LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
            LEFT JOIN LATERAL (
              SELECT
                SUM(tai.nota)                    AS soma_notas,
                COUNT(*)                         AS qtd_itens,
                COUNT(DISTINCT tai.avaliador_id) AS qtd_avaliadores
              FROM trabalhos_avaliacoes_itens tai
              WHERE tai.submissao_id = s.id
            ) n ON TRUE
            WHERE s.chamada_id = $1
          )
          SELECT
            ROW_NUMBER() OVER (
              ORDER BY nota_media DESC NULLS LAST,
                       total_geral DESC,
                       id ASC
            ) AS posicao,
            *
          FROM base
          ORDER BY nota_media DESC NULLS LAST, total_geral DESC, id ASC;
          `,
          [chamadaId]
        );
      } else {
        throw errSelect;
      }
    }

    console.log("[listarSubmissoesAdmin]", { chamadaId, total: rows.length, ms: Date.now() - t0 });
    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesAdmin][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

exports.listarSubmissoesAdminTodas = async (_req, res, next) => {
  const t0 = Date.now();
  try {
    let rows;
    try {
      rows = await db.any(
        `
        SELECT
          s.id,
          s.titulo,
          s.usuario_id,
          s.status,
          s.status_escrita,
          s.status_oral,
          s.nota_escrita,
          s.nota_oral,
          s.nota_final,
          s.linha_tematica_codigo,
          s.linha_tematica_id,
          tcl.nome AS linha_tematica_nome,
          s.inicio_experiencia,
          s.chamada_id,
          s.criado_em,
          s.atualizado_em,
          c.titulo AS chamada_titulo,
          u.nome  AS autor_nome,
          u.email AS autor_email,
          COALESCE(ve.total_ponderado, 0)      AS total_escrita,
          COALESCE(vo.total_oral_ponderado, 0) AS total_oral,
          (COALESCE(ve.total_ponderado,0) + COALESCE(vo.total_oral_ponderado,0)) AS total_geral,
          COALESCE(n.soma_notas, 0)::numeric    AS soma_notas,
          COALESCE(n.qtd_itens, 0)              AS qtd_itens,
          COALESCE(n.qtd_avaliadores, 0)        AS qtd_avaliadores,
          COALESCE(
            s.nota_media,
            ROUND(COALESCE(n.soma_notas,0) / 4.0, 1)
          ) AS nota_media
        FROM trabalhos_submissoes s
        JOIN usuarios u              ON u.id = s.usuario_id
        JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
        LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
        LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
        LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
        LEFT JOIN LATERAL (
          SELECT
            SUM(tai.nota)                    AS soma_notas,
            COUNT(*)                         AS qtd_itens,
            COUNT(DISTINCT tai.avaliador_id) AS qtd_avaliadores
          FROM trabalhos_avaliacoes_itens tai
          WHERE tai.submissao_id = s.id
        ) n ON TRUE
        ORDER BY s.criado_em DESC, s.id ASC
        `
      );
    } catch (errSelect) {
      if (errSelect?.code === "42703") {
        rows = await db.any(
          `
          SELECT
            s.id,
            s.titulo,
            s.usuario_id,
            s.status,
            NULL::text AS status_escrita,
            NULL::text AS status_oral,
            s.linha_tematica_codigo,
            s.linha_tematica_id,
            tcl.nome AS linha_tematica_nome,
            s.inicio_experiencia,
            s.chamada_id,
            s.criado_em,
            s.atualizado_em,
            c.titulo AS chamada_titulo,
            u.nome  AS autor_nome,
            u.email AS autor_email,
            COALESCE(ve.total_ponderado, 0)      AS total_escrita,
            COALESCE(vo.total_oral_ponderado, 0) AS total_oral,
            (COALESCE(ve.total_ponderado,0) + COALESCE(vo.total_oral_ponderado,0)) AS total_geral,
            COALESCE(n.soma_notas, 0)::numeric    AS soma_notas,
            COALESCE(n.qtd_itens, 0)              AS qtd_itens,
            COALESCE(n.qtd_avaliadores, 0)        AS qtd_avaliadores,
            ROUND(COALESCE(n.soma_notas,0) / 4.0, 1) AS nota_media
          FROM trabalhos_submissoes s
          JOIN usuarios u              ON u.id = s.usuario_id
          JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
          LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
          LEFT JOIN vw_submissao_total_escrita ve ON ve.submissao_id = s.id
          LEFT JOIN vw_submissao_total_oral   vo ON vo.submissao_id = s.id
          LEFT JOIN LATERAL (
            SELECT
              SUM(tai.nota)                    AS soma_notas,
              COUNT(*)                         AS qtd_itens,
              COUNT(DISTINCT tai.avaliador_id) AS qtd_avaliadores
            FROM trabalhos_avaliacoes_itens tai
            WHERE tai.submissao_id = s.id
          ) n ON TRUE
          ORDER BY s.criado_em DESC, s.id ASC
          `
        );
      } else {
        throw errSelect;
      }
    }

    console.log("[listarSubmissoesAdminTodas]", { total: rows.length, ms: Date.now() - t0 });
    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesAdminTodas][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   AVALIAÇÕES — mantidas, apenas garantindo persist 50/50
────────────────────────────────────────────────────────────── */
exports.avaliarEscrita = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { itens = [] } = req.body;
    const subId = toIntOrNull(req.params.id);
    assert(subId !== null, "id inválido.");
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação.");

    const { userId } = getAuthUserId(req, res);
    assert(userId !== null, "Não autorizado.");

    const isAdm = await isAdmin(userId);
    const canView = await canUserReviewOrView(userId, subId);
    if (!(isAdm || canView)) {
      return res.status(403).json({ erro: "Apenas avaliadores atribuídos ou administradores podem avaliar." });
    }

    const lims = await db.any(
      `
      SELECT id, escala_min, escala_max
      FROM trabalhos_chamada_criterios
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
      `,
      [subId]
    );
    const byId = new Map(lims.map((x) => [x.id, x]));

    for (const it of itens) {
      const lim = byId.get(it.criterio_id);
      assert(lim, "Critério inválido.");
      const nota = parseInt(it.nota, 10);
      assert(
        Number.isInteger(nota) && nota >= lim.escala_min && nota <= lim.escala_max,
        `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`
      );

      await db.none(
        `
        INSERT INTO trabalhos_avaliacoes_itens (submissao_id, avaliador_id, criterio_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
        `,
        [subId, userId, it.criterio_id, nota, it.comentarios || null]
      );
    }

    await db.none(
      `UPDATE trabalhos_submissoes SET status='em_avaliacao', atualizado_em=NOW() WHERE id=$1 AND status='submetido'`,
      [subId]
    );

    // ✅ persistência 50/50
    await atualizarNotasPersistidas50_50(subId);
    // ✅ manter também materializada antiga se você ainda usa em algum lugar
    try { await atualizarNotaMediaMaterializada(subId); } catch {}

    console.log("[avaliarEscrita][OK]", { subId, userId, ms: Date.now() - t0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[avaliarEscrita][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

exports.avaliarOral = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { itens = [] } = req.body;
    const subId = toIntOrNull(req.params.id);
    assert(subId !== null, "id inválido.");
    assert(Array.isArray(itens) && itens.length, "Envie itens para avaliação oral.");

    const { userId } = getAuthUserId(req, res);
    assert(userId !== null, "Não autorizado.");

    const isAdm = await isAdmin(userId);
    const canView = await canUserReviewOrView(userId, subId);
    if (!(isAdm || canView)) {
      return res.status(403).json({ erro: "Apenas avaliadores atribuídos ou administradores podem avaliar." });
    }

    const lims = await db.any(
      `
      SELECT id, escala_min, escala_max
      FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id = (SELECT chamada_id FROM trabalhos_submissoes WHERE id=$1)
      `,
      [subId]
    );
    const byId = new Map(lims.map((x) => [x.id, x]));

    for (const it of itens) {
      const criterioId = toIntOrNull(it?.criterio_id ?? it?.criterio_oral_id);
      assert(Number.isFinite(criterioId), "Critério oral inválido.");
      const lim = byId.get(criterioId);
      assert(lim, "Critério oral inválido.");

      const nota = toIntOrNull(it?.nota);
      assert(
        Number.isInteger(nota) && nota >= lim.escala_min && nota <= lim.escala_max,
        `Nota deve estar entre ${lim.escala_min} e ${lim.escala_max}.`
      );

      await db.none(
        `
        INSERT INTO trabalhos_apresentacoes_orais_itens
          (submissao_id, avaliador_id, criterio_oral_id, nota, comentarios)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (submissao_id, avaliador_id, criterio_oral_id)
        DO UPDATE SET nota=EXCLUDED.nota, comentarios=EXCLUDED.comentarios, criado_em=NOW()
        `,
        [subId, userId, criterioId, nota, it?.comentarios || null]
      );
    }

    await atualizarNotasPersistidas50_50(subId);
    try { await atualizarNotaMediaMaterializada(subId); } catch {}

    console.log("[avaliarOral][OK]", { subId, userId, ms: Date.now() - t0 });
    res.json({ ok: true });
  } catch (err) {
    console.error("[avaliarOral][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   CONSOLIDAÇÃO / STATUS FINAL (mantido do seu código)
────────────────────────────────────────────────────────────── */
exports.consolidarClassificacao = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const chamadaId = toIntOrNull(req.params.chamadaId);
    assert(chamadaId !== null, "chamadaId inválido.");

    const top40 = await db.any(
      `
      SELECT id FROM vw_submissoes_consolidadas
      WHERE chamada_id=$1
      ORDER BY total_ponderado DESC, inicio_experiencia DESC, id ASC
      LIMIT 40
      `,
      [chamadaId]
    );

    if (top40.length) {
      await db.none(
        `UPDATE trabalhos_submissoes SET status='aprovado_exposicao' WHERE chamada_id=$1 AND id = ANY($2::int[])`,
        [chamadaId, top40.map((x) => x.id)]
      );
    }

    const linhas = await db.any(`SELECT id FROM trabalhos_chamada_linhas WHERE chamada_id=$1`, [chamadaId]);
    const aprovadosOral = [];
    for (const l of linhas) {
      const rows = await db.any(
        `
        SELECT id FROM vw_submissoes_consolidadas
        WHERE chamada_id=$1 AND linha_tematica_id=$2
        ORDER BY total_ponderado DESC, inicio_experiencia DESC, id ASC
        LIMIT 6
        `,
        [chamadaId, l.id]
      );
      aprovadosOral.push(...rows.map((r) => r.id));
    }

    if (aprovadosOral.length) {
      await db.none(
        `UPDATE trabalhos_submissoes SET status='aprovado_oral' WHERE chamada_id=$1 AND id = ANY($2::int[])`,
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
    console.error("[consolidarClassificacao][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

exports.definirStatusFinal = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const id = toIntOrNull(req.params.id);
    assert(id !== null, "id inválido.");

    const novoStatus = String(req.body?.status || "").trim().toLowerCase();
    const observacoes_admin = req.body?.observacoes_admin || null;

    const permitidos = ["reprovado", "aprovado_exposicao", "aprovado_oral"];
    assert(permitidos.includes(novoStatus), "Status inválido.");

    let atual;
    try {
      atual = await db.oneOrNone(
        `SELECT id, status, status_escrita, status_oral FROM trabalhos_submissoes WHERE id=$1`,
        [id]
      );
    } catch (errSelect) {
      if (errSelect?.code === "42703") {
        atual = await db.oneOrNone(
          `SELECT id, status, NULL::text AS status_escrita, NULL::text AS status_oral FROM trabalhos_submissoes WHERE id=$1`,
          [id]
        );
      } else {
        throw errSelect;
      }
    }

    if (!atual) {
      const e = new Error("Submissão não encontrada.");
      e.status = 404;
      throw e;
    }

    let statusPrincipal = atual.status || null;
    let statusEscrita = atual.status_escrita || null;
    let statusOral = atual.status_oral || null;

    if (novoStatus === "aprovado_exposicao") {
      statusPrincipal = "aprovado_exposicao";
      statusEscrita = "aprovado";
    } else if (novoStatus === "aprovado_oral") {
      statusPrincipal = "aprovado_oral";
      statusOral = "aprovado";
    } else if (novoStatus === "reprovado") {
      statusPrincipal = "reprovado";
      statusEscrita = null;
      statusOral = null;
    }

    async function updateCompleto() {
      return db.none(
        `
        UPDATE trabalhos_submissoes
           SET status=$2,
               status_escrita=$3,
               status_oral=$4,
               observacoes_admin=$5,
               atualizado_em=NOW()
         WHERE id=$1
        `,
        [id, statusPrincipal, statusEscrita, statusOral, observacoes_admin]
      );
    }

    async function updateSomenteStatus() {
      return db.none(
        `
        UPDATE trabalhos_submissoes
           SET status=$2,
               observacoes_admin=$3,
               atualizado_em=NOW()
         WHERE id=$1
        `,
        [id, statusPrincipal, observacoes_admin]
      );
    }

    try {
      await updateCompleto();
    } catch (errUpd) {
      if (errUpd?.code === "42703") {
        await updateSomenteStatus();
      } else {
        throw errUpd;
      }
    }

    const meta = await db.one(
      `
      SELECT s.usuario_id, s.titulo AS trabalho_titulo, c.titulo AS chamada_titulo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.id=$1
      `,
      [id]
    );

    await notificarStatusSubmissao({
      usuario_id: meta.usuario_id,
      chamada_titulo: meta.chamada_titulo,
      trabalho_titulo: meta.trabalho_titulo,
      status: statusPrincipal,
    });

    console.log("[definirStatusFinal][OK]", {
      submissaoId: id,
      status: statusPrincipal,
      status_escrita: statusEscrita,
      status_oral: statusOral,
      ms: Date.now() - t0,
    });

    res.json({ ok: true, id, status: statusPrincipal, status_escrita: statusEscrita, status_oral: statusOral });
  } catch (err) {
    console.error("[definirStatusFinal][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   PAINEL DO AVALIADOR / CONTAGENS / REPOSITÓRIO
   (mantido e com banner_url seguro)
────────────────────────────────────────────────────────────── */
exports.contagemMinhasAvaliacoes = async (req, res, next) => {
  try {
    const { userId: uid } = getAuthUserId(req, res);
    if (!Number.isFinite(uid)) return res.status(401).json({ erro: "Não autorizado." });

    const row = await db.one(
      `
      WITH atrib AS (
        SELECT
          tsa.submissao_id,
          CASE
            WHEN tsa.tipo::text IS NULL OR tsa.tipo::text = '' THEN 'escrita'
            ELSE tsa.tipo::text
          END AS tipo_txt
        FROM trabalhos_submissoes_avaliadores tsa
        WHERE tsa.avaliador_id = $1
          AND tsa.revoked_at IS NULL
      ),
      done_escrita AS (
        SELECT DISTINCT submissao_id
        FROM trabalhos_avaliacoes_itens
        WHERE avaliador_id = $1
      ),
      done_oral AS (
        SELECT DISTINCT submissao_id
        FROM trabalhos_apresentacoes_orais_itens
        WHERE avaliador_id = $1
      ),
      pend AS (
        SELECT a.submissao_id
        FROM atrib a
        LEFT JOIN done_escrita de
          ON (a.tipo_txt <> 'oral') AND de.submissao_id = a.submissao_id
        LEFT JOIN done_oral dor
          ON (a.tipo_txt = 'oral')  AND dor.submissao_id = a.submissao_id
        WHERE (a.tipo_txt = 'oral'  AND dor.submissao_id IS NULL)
           OR (a.tipo_txt <> 'oral' AND de.submissao_id IS NULL)
      )
      SELECT
        (SELECT COUNT(*) FROM atrib) AS total,
        (SELECT COUNT(*) FROM pend)  AS pendentes,
        (SELECT COUNT(*) FROM atrib) - (SELECT COUNT(*) FROM pend) AS avaliados
      `,
      [uid]
    );

    res.json(row);
  } catch (err) {
    console.error("Erro inesperado em contagemMinhasAvaliacoes:", err);
    next(err);
  }
};

exports.listarRepositorioTrabalhos = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { userId: uid } = getAuthUserId(req, res);
    if (uid === null) {
      const e = new Error("Não autorizado.");
      e.status = 401;
      throw e;
    }

    const chamadaId = toIntOrNull(req.query?.chamadaId);
    const params = [];
    const where = [];

    where.push(`
      (
        s.nota_escrita IS NOT NULL
        OR s.nota_oral IS NOT NULL
        OR s.nota_final IS NOT NULL
        OR s.status IN ('aprovado_exposicao', 'aprovado_oral', 'reprovado')
      )
    `);

    if (chamadaId !== null) {
      params.push(chamadaId);
      where.push(`s.chamada_id = $${params.length}`);
    }

    const rows = await db.any(
      `
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
        u.nome  AS autor_nome,
        u.unidade_id,
        un.nome AS autor_unidade_nome,
        s.introducao,
        s.objetivos,
        s.metodo,
        s.resultados,
        s.consideracoes,
        s.bibliografia
      FROM trabalhos_submissoes s
      JOIN usuarios u              ON u.id = s.usuario_id
      JOIN trabalhos_chamadas c    ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN unidades un        ON un.id = u.unidade_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.titulo ASC, tcl.nome ASC NULLS LAST, s.titulo ASC, s.id ASC
      `,
      params
    );

    // banner_url seguro por endpoint (não expõe caminho em disco)
    const payload = rows.map((r) => ({
      ...r,
      banner_url: `/api/trabalhos/submissoes/${r.id}/banner`,
    }));

    console.log("[listarRepositorioTrabalhos]", {
      uid,
      chamadaId: chamadaId ?? null,
      total: payload.length,
      ms: Date.now() - t0,
    });

    res.json(payload);
  } catch (err) {
    console.error("[listarRepositorioTrabalhos][erro]", { message: err.message, code: err.code, ms: Date.now() - t0 });
    next(err);
  }
};

/* ──────────────────────────────────────────────────────────────
   AVALIADOR — listar submissões atribuídas
   GET /api/trabalhos/avaliador/submissoes
────────────────────────────────────────────────────────────── */
exports.listarSubmissoesDoAvaliador = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { userId: uid } = getAuthUserId(req, res);
    if (!Number.isFinite(uid)) return res.status(401).json({ erro: "Não autorizado." });

    const rows = await db.any(
      `
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.linha_tematica_codigo,
        s.linha_tematica_id,
        tcl.nome AS linha_tematica_nome,
        s.inicio_experiencia,
        s.chamada_id,
        c.titulo AS chamada_titulo,
        tsa.tipo,

        -- “já avaliado” depende do tipo
        CASE
          WHEN tsa.tipo = 'oral' THEN EXISTS (
            SELECT 1
            FROM trabalhos_apresentacoes_orais_itens tai
            WHERE tai.submissao_id = s.id
              AND tai.avaliador_id = $1
          )
          ELSE EXISTS (
            SELECT 1
            FROM trabalhos_avaliacoes_itens tae
            WHERE tae.submissao_id = s.id
              AND tae.avaliador_id = $1
          )
        END AS ja_avaliado

      FROM trabalhos_submissoes_avaliadores tsa
      JOIN trabalhos_submissoes s ON s.id = tsa.submissao_id
      JOIN trabalhos_chamadas   c ON c.id = s.chamada_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      WHERE tsa.avaliador_id = $1
        AND tsa.revoked_at IS NULL
      ORDER BY s.id DESC
      `,
      [uid]
    );

    if (DBG) console.log("[listarSubmissoesDoAvaliador]", { uid, total: rows.length, ms: Date.now() - t0 });
    res.json(rows);
  } catch (err) {
    console.error("[listarSubmissoesDoAvaliador][erro]", err?.message || err);
    next(err);
  }
};


/* ──────────────────────────────────────────────────────────────
   AVALIADOR — obter submissão para avaliar (texto + critérios + itens já salvos)
   GET /api/trabalhos/avaliador/submissoes/:id?tipo=oral|escrita
────────────────────────────────────────────────────────────── */
exports.obterParaAvaliacao = async (req, res, next) => {
  const t0 = Date.now();
  try {
    const { user: authUser, userId: uid } = getAuthUserId(req, res);
    assert(uid !== null, "Não autorizado.");

    const sid = toIntOrNull(req.params.id);
    assert(sid !== null, "id inválido.");

    const tipoReq = String(req.query?.tipo || "").toLowerCase();
    const TIPO = (tipoReq === "oral" || tipoReq === "escrita") ? tipoReq : "escrita";

    // admin ou designado (no tipo, se fornecido)
    const isAdminUser = Array.isArray(authUser?.perfil) && authUser.perfil.includes("administrador");

    const designado = await db.oneOrNone(
      `
      SELECT 1
      FROM trabalhos_submissoes_avaliadores
      WHERE submissao_id=$1
        AND avaliador_id=$2
        ${TIPO ? "AND tipo = $3" : ""}
        AND revoked_at IS NULL
      LIMIT 1
      `,
      TIPO ? [sid, uid, TIPO] : [sid, uid]
    );

    if (!isAdminUser && !designado) {
      const e = new Error("Sem permissão para avaliar este trabalho.");
      e.status = 403;
      throw e;
    }

    const s = await db.oneOrNone(
      `
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

        -- textos
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
      `,
      [sid]
    );

    if (!s) {
      const e = new Error("Submissão não encontrada.");
      e.status = 404;
      throw e;
    }

    let criterios = [];
    let meusItens = [];

    if (TIPO === "oral") {
      criterios = await db.any(
        `
        SELECT
          id,
          titulo AS criterio,
          COALESCE(escala_min, 0)  AS escala_min,
          COALESCE(escala_max, 10) AS escala_max,
          COALESCE(peso, 1)::int   AS peso,
          COALESCE(ordem, id)::int AS ordem
        FROM trabalhos_chamada_criterios_orais
        WHERE chamada_id = $1
        ORDER BY ordem ASC, id ASC
        `,
        [s.chamada_id]
      );

      meusItens = await db.any(
        `
        SELECT criterio_oral_id AS criterio_id, nota, COALESCE(comentarios,'') AS comentarios
        FROM trabalhos_apresentacoes_orais_itens
        WHERE submissao_id=$1 AND avaliador_id=$2
        `,
        [sid, uid]
      );
    } else {
      criterios = await db.any(
        `
        SELECT
          id,
          titulo AS criterio,
          COALESCE(escala_min, 0)  AS escala_min,
          COALESCE(escala_max, 10) AS escala_max,
          COALESCE(peso, 1)::int   AS peso,
          COALESCE(ordem, id)::int AS ordem
        FROM trabalhos_chamada_criterios
        WHERE chamada_id = $1
        ORDER BY ordem ASC, id ASC
        `,
        [s.chamada_id]
      );

      meusItens = await db.any(
        `
        SELECT criterio_id, nota, COALESCE(comentarios,'') AS comentarios
        FROM trabalhos_avaliacoes_itens
        WHERE submissao_id=$1 AND avaliador_id=$2
        `,
        [sid, uid]
      );
    }

    if (DBG) {
      console.log("[obterParaAvaliacao]", {
        subId: sid,
        avaliador: uid,
        tipo: TIPO,
        criterios: criterios.length,
        itensExistentes: meusItens.length,
        ms: Date.now() - t0,
      });
    }

    res.json({
      submissao: {
        id: s.id,
        titulo: s.titulo,
        status: s.status,
        inicio_experiencia: s.inicio_experiencia,
        linha_tematica_codigo: s.linha_tematica_codigo,
        linha_tematica_id: s.linha_tematica_id,
        linha_tematica_nome: s.linha_tematica_nome,
        chamada_id: s.chamada_id,
        chamada_titulo: s.chamada_titulo,

        poster_nome: s.poster_nome,
        poster_url: `/api/trabalhos/submissoes/${s.id}/poster`,

        introducao: s.introducao,
        objetivos: s.objetivos,
        metodo: s.metodo,
        resultados: s.resultados,
        consideracoes: s.consideracoes,
        bibliografia: s.bibliografia,
      },
      tipo: TIPO,
      criterios,
      avaliacaoAtual: meusItens,
    });
  } catch (err) {
    console.error("[obterParaAvaliacao][erro]", err?.message || err);
    next(err);
  }
};

