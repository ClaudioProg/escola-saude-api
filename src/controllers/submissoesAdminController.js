/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");

// DB resiliente (aceita `module.exports = db` ou `module.exports = { db }`)
const dbModule = require("../db");
const db = dbModule?.db ?? dbModule;

/* ===================== Log helpers ===================== */
const DBG = String(process.env.DEBUG_SUBMISSOES || "").trim() === "1";
function j(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}
function log(...a) { if (DBG) console.log("[SUBMISSÕES]", ...a); }

/* ===================== Helpers ===================== */
function normPerfis(p) {
  if (Array.isArray(p)) return p.map(x => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof p === "string") {
    return p.split(",").map(x => x.toLowerCase().trim()).filter(Boolean);
  }
  return [];
}
const asInt = (v) => Number.parseInt(v, 10);

/** Obtém o ID do usuário autenticado, aceitando req.user, req.usuario e req.auth.userId. */
function getUserIdOptional(req) {
  const raw =
    req?.user?.id ??
    req?.usuario?.id ??
    req?.auth?.userId ??
    null;

  if (raw == null) return null;
  const uid = Number(String(raw).trim());
  if (!Number.isFinite(uid) || uid <= 0) return null;
  return uid;
}

/** Igual ao acima, mas lança 401 quando não houver usuário e 400 para ID inválido. */
function getUserIdOrThrow(req) {
  const raw =
    req?.user?.id ??
    req?.usuario?.id ??
    req?.auth?.userId ??
    null;

  if (raw == null) {
    const e = new Error("Não autenticado");
    e.status = 401;
    throw e;
  }
  const uid = Number(String(raw).trim());
  if (!Number.isFinite(uid) || uid <= 0) {
    const e = new Error("id inválido.");
    e.status = 400;
    throw e;
  }
  return uid;
}

async function isAdmin(userOrId, dbConn = db) {
  try {
    if (userOrId && typeof userOrId === "object") {
      const perfis = normPerfis(userOrId.perfil);
      if (perfis.includes("administrador")) return true;
      const uid = Number(userOrId.id);
      if (!Number.isFinite(uid)) return false;
      userOrId = uid;
    }
    const userId = Number(userOrId);
    if (!Number.isFinite(userId)) return false;

    // 1) usuarios.perfil (string)
    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1 FROM usuarios WHERE id=$1 AND LOWER(COALESCE(perfil,''))='administrador'`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    // 2) usuarios.perfis (array)
    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1 FROM usuarios WHERE id=$1 AND 'administrador' = ANY(perfis)`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    // 3) JOIN perfis (tabela separada)
    try {
      const row = await dbConn.oneOrNone(
        `SELECT 1
           FROM usuarios u
           JOIN perfis p ON p.id = u.perfil_id
          WHERE u.id=$1 AND LOWER(p.nome)='administrador'`,
        [userId]
      );
      if (row) return true;
    } catch (_) {}

    return false;
  } catch (err) {
    console.error("[isAdmin] erro:", err.message);
    return false;
  }
}

async function canUserReviewOrView(userOrId, submissaoId, dbConn = db) {
  try {
    if (await isAdmin(userOrId, dbConn)) return true;

    const uid = typeof userOrId === "object" ? Number(userOrId.id) : Number(userOrId);
    if (!Number.isFinite(uid)) return false;

    const vinc = await dbConn.oneOrNone(
      `SELECT 1
         FROM trabalhos_submissoes_avaliadores
        WHERE submissao_id=$1
          AND avaliador_id=$2
          AND revoked_at IS NULL`,
      [submissaoId, uid]
    );
    return !!vinc;
  } catch (err) {
    console.error("[canUserReviewOrView] erro:", err.message);
    return false;
  }
}

/* ===================== Flags de aprovação parcial ===================== */
function deriveAprovFlags(row) {
  const st = String(row?.status || "").toLowerCase();
  const se = String(row?.status_escrita || "").toLowerCase();
  const so = String(row?.status_oral || "").toLowerCase();

  const exposicaoAprovada =
    se === "aprovado" ||
    st === "aprovado_exposicao" ||
    st === "aprovado_escrita";

  const oralAprovada =
    so === "aprovado" ||
    st === "aprovado_oral";

  return {
    _exposicao_aprovada: exposicaoAprovada,
    _oral_aprovada: oralAprovada,
  };
}

/* =======================================================================
   🔶 Avaliadores FLEX (sem limite) — oral/escrita
   ======================================================================= */

/** GET /api/admin/submissoes/:id/avaliadores?tipo=oral|escrita|todos */
async function listarAvaliadoresFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const tipo = String(req.query.tipo || "todos").toLowerCase();

  log("GET /admin/submissoes/:id/avaliadores →", { submissaoId, tipo });

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!Number.isInteger(submissaoId) || submissaoId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const base = `
      SELECT a.submissao_id,
             a.avaliador_id,
             a.tipo,
             a.assigned_by,
             a.created_at,
             u.nome  AS avaliador_nome,
             u.email AS avaliador_email
        FROM trabalhos_submissoes_avaliadores a
        JOIN usuarios u ON u.id = a.avaliador_id
       WHERE a.submissao_id = $1
         AND a.revoked_at IS NULL
    `;
    const sql = (tipo === "oral" || tipo === "escrita")
      ? base + ` AND a.tipo = $2::tipo_avaliacao ORDER BY a.tipo, u.nome ASC`
      : base + ` ORDER BY a.tipo, u.nome ASC`;

    const params = (tipo === "oral" || tipo === "escrita") ? [submissaoId, tipo] : [submissaoId];
    const rows = await db.any(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("[listarAvaliadoresFlex]", err);
    return res.status(500).json({ error: "Erro ao listar avaliadores da submissão." });
  }
}

/** POST /api/admin/submissoes/:id/avaliadores
 * body:
 *   { avaliadorId, tipo } | { id, tipo }
 *   ou { itens: [{ avaliadorId|id, tipo }, ...] }
 */
async function incluirAvaliadores(req, res) {
  const submissaoId = asInt(req.params.id);

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!Number.isInteger(submissaoId) || submissaoId <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    // Normalização
    let itens = [];
    if (Array.isArray(req.body?.itens)) {
      itens = req.body.itens;
    } else if (req.body && (req.body.avaliadorId || req.body.id)) {
      itens = [req.body];
    } else if (Array.isArray(req.body?.avaliadores)) {
      // compat: { avaliadores:[id,id], tipo:'escrita'|'oral' }
      const tipoCompat = String(req.body.tipo || "escrita").toLowerCase();
      itens = req.body.avaliadores.map((id) => ({ avaliadorId: Number(id), tipo: tipoCompat }));
    } else {
      return res.status(400).json({ error: "Envie {avaliadorId, tipo} ou {itens:[...]}." });
    }

    itens = itens.map((r) => ({
      avaliadorId: Number(r.avaliadorId ?? r.id),
      tipo: String(r.tipo || "").toLowerCase(),
    }))
    .filter((r) => Number.isInteger(r.avaliadorId) && r.avaliadorId > 0 && (r.tipo === "oral" || r.tipo === "escrita"));

    if (!itens.length) {
      return res.status(400).json({ error: "Itens inválidos." });
    }

    // Elegibilidade
    const ids = Array.from(new Set(itens.map(r => r.avaliadorId)));
    const elegiveis = await db.any(
      `SELECT id FROM usuarios
        WHERE id = ANY($1)
          AND LOWER(COALESCE(perfil,'')) IN ('instrutor','administrador')`,
      [ids]
    );
    const okIds = new Set(elegiveis.map(x => x.id));
    const invalidos = ids.filter(id => !okIds.has(id));
    if (invalidos.length) {
      return res.status(400).json({ error: `Usuário(s) sem perfil elegível: ${invalidos.join(", ")}` });
    }

    const assignedBy = uid || null;
    const results = [];

    await db.tx(async (t) => {
      for (const it of itens) {
        try {
          const row = await t.one(
            `INSERT INTO trabalhos_submissoes_avaliadores
               (submissao_id, avaliador_id, tipo, assigned_by, created_at)
             VALUES ($1,$2,$3::tipo_avaliacao,$4, NOW())
             ON CONFLICT (submissao_id, avaliador_id, tipo)
             DO UPDATE SET revoked_at = NULL, assigned_by = EXCLUDED.assigned_by
             RETURNING submissao_id, avaliador_id, tipo, assigned_by, created_at`,
            [submissaoId, it.avaliadorId, it.tipo, assignedBy]
          );
          results.push(row);
        } catch (e) {
          if (e.code === "23505") continue; // já ativo por algum motivo
          throw e;
        }
      }
    });

    return res.status(201).json({ ok: true, inseridos: results.length, itens: results });
  } catch (err) {
    console.error("[incluirAvaliadores]", err);
  const devMsg = (process.env.NODE_ENV !== "production") && (err.detail || err.message || err.code);
  return res.status(500).json({ error: devMsg || "Falha ao incluir avaliadores." });
  }
}

/** DELETE /api/admin/submissoes/:id/avaliadores
 * body: { avaliadorId, tipo } (exclusão lógica)
 */
async function revogarAvaliadorFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const avaliadorId = asInt(req.body?.avaliadorId ?? req.body?.id);
  const tipo = String(req.body?.tipo || "").toLowerCase();

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!Number.isInteger(submissaoId) || submissaoId <= 0 ||
        !Number.isInteger(avaliadorId) || avaliadorId <= 0 ||
        !["oral","escrita"].includes(tipo)) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const { rowCount } = await db.result(
      `UPDATE trabalhos_submissoes_avaliadores
          SET revoked_at = NOW()
        WHERE submissao_id = $1
          AND avaliador_id = $2
          AND tipo = $3::tipo_avaliacao
          AND revoked_at IS NULL`,
      [submissaoId, avaliadorId, tipo]
    );

    if (!rowCount) return res.status(404).json({ error: "Vínculo ativo não encontrado." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[revogarAvaliadorFlex]", err);
    return res.status(500).json({ error: "Falha ao revogar avaliador." });
  }
}

/** PATCH /api/admin/submissoes/:id/avaliadores/restore
 * body: { avaliadorId, tipo } (restaura último vínculo dessa combinação)
 */
async function restaurarAvaliadorFlex(req, res) {
  const submissaoId = asInt(req.params.id);
  const avaliadorId = asInt(req.body?.avaliadorId ?? req.body?.id);
  const tipo = String(req.body?.tipo || "").toLowerCase();

  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!Number.isInteger(submissaoId) || submissaoId <= 0 ||
        !Number.isInteger(avaliadorId) || avaliadorId <= 0 ||
        !["oral","escrita"].includes(tipo)) {
      return res.status(400).json({ error: "Parâmetros inválidos." });
    }

    const { rowCount } = await db.result(
      `WITH alvo AS (
         SELECT ctid
           FROM trabalhos_submissoes_avaliadores
          WHERE submissao_id = $1
            AND avaliador_id = $2
            AND tipo = $3::tipo_avaliacao
          ORDER BY revoked_at DESC NULLS LAST, created_at DESC
          LIMIT 1
       )
       UPDATE trabalhos_submissoes_avaliadores a
          SET revoked_at = NULL
        WHERE a.ctid IN (SELECT ctid FROM alvo)`,
      [submissaoId, avaliadorId, tipo]
    );

    if (!rowCount) return res.status(404).json({ error: "Nada para restaurar." });
    return res.json({ ok: true });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Já existe vínculo ativo idêntico." });
    console.error("[restaurarAvaliadorFlex]", err);
    return res.status(500).json({ error: "Falha ao restaurar avaliador." });
  }
}

/* ===================== Avaliações (notas) ===================== */
/** GET /api/admin/submissoes/:id/avaliacoes */
async function listarAvaliacoesDaSubmissao(req, res) {
  const id = asInt(req.params.id);
  log("GET /admin/submissoes/:id/avaliacoes →", { id });

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  try {
    // 1) Meta (chamada_id + nota_visivel + linha_tematica_nome)
    let meta = null;
    try {
      meta = await db.oneOrNone(
        `
        SELECT
          s.chamada_id,
          COALESCE(s.nota_visivel,false) AS nota_visivel,
          s.linha_tematica_id,
          tcl.nome AS linha_tematica_nome
        FROM trabalhos_submissoes s
        LEFT JOIN trabalhos_chamada_linhas tcl
          ON tcl.id = s.linha_tematica_id
        WHERE s.id = $1
        `,
        [id]
      );
      log("avaliacoes.meta:", j(meta));
    } catch (e) {
      if (e?.code === "42703") {
        log("avaliacoes.meta: coluna nota_visivel ausente → fallback");
        meta = await db.oneOrNone(
          `
          SELECT
            s.chamada_id,
            s.linha_tematica_id,
            tcl.nome AS linha_tematica_nome
          FROM trabalhos_submissoes s
          LEFT JOIN trabalhos_chamada_linhas tcl
            ON tcl.id = s.linha_tematica_id
          WHERE s.id = $1
          `,
          [id]
        );
        meta = { ...meta, nota_visivel: false };
      } else {
        throw e;
      }
    }
    if (!meta) {
      log("avaliacoes.meta: submissao não encontrada");
      return res.status(404).json({ error: "Submissão não encontrada." });
    }

    // 2) Critérios (ordem 1..4)
    const criterios = await db.any(
      `SELECT id, ordem::int AS ordem
         FROM trabalhos_chamada_criterios
        WHERE chamada_id = $1
        ORDER BY ordem ASC
        LIMIT 4`,
      [meta.chamada_id]
    );
    log("avaliacoes.criterios: qtd=", criterios.length, "dados=", j(criterios));
    const idxByCriterioId = new Map();
    criterios.forEach((c) => {
      if (Number.isFinite(c.ordem) && c.ordem >= 1 && c.ordem <= 4) {
        idxByCriterioId.set(c.id, c.ordem - 1);
      }
    });

    // 3) Itens (notas) desta submissão
    const itens = await db.any(
      `
      SELECT a.avaliador_id,
             u.nome AS avaliador_nome,
             a.criterio_id,
             a.nota,
             a.comentarios,
             a.criado_em
        FROM trabalhos_avaliacoes_itens a
        LEFT JOIN usuarios u ON u.id = a.avaliador_id
       WHERE a.submissao_id = $1
       ORDER BY u.nome NULLS LAST, a.criado_em ASC
      `,
      [id]
    );
    log("avaliacoes.itens: qtd=", itens.length);

    // 4) Agregação em JS
    const byAvaliador = new Map();
    const NOTAS_LEN = 4;
    for (const r of itens) {
      const avalId = Number(r.avaliador_id);
      if (!byAvaliador.has(avalId)) {
        byAvaliador.set(avalId, {
          avaliador_id: avalId,
          avaliador_nome: r.avaliador_nome || `#${avalId}`,
          notas: Array.from({ length: NOTAS_LEN }, () => 0),
          comentarios: [],
          __extras: 0,
        });
      }
      const item = byAvaliador.get(avalId);

      const notaVal = Number(r.nota ?? 0);
      if (!Number.isNaN(notaVal)) {
        const idx = idxByCriterioId.has(r.criterio_id)
          ? idxByCriterioId.get(r.criterio_id)
          : null;
        if (idx !== null && idx >= 0 && idx < NOTAS_LEN) {
          item.notas[idx] += notaVal;
        } else {
          item.__extras += notaVal;
          if (r.criterio_id) item.comentarios.push(`[critério ${r.criterio_id} sem ordem] +${notaVal}`);
        }
      }

      const cmt = (r.comentarios || "").trim();
      if (cmt) item.comentarios.push(cmt);
    }

    let totalGeral = 0;
    const resposta = [];
    for (const it of byAvaliador.values()) {
      const total = it.notas.reduce((a, n) => a + Number(n || 0), 0) + Number(it.__extras || 0);
      totalGeral += total;
      resposta.push({
        avaliador_id: it.avaliador_id,
        avaliador_nome: it.avaliador_nome,
        notas: it.notas,
        total_do_avaliador: total,
        comentarios: it.comentarios.length ? it.comentarios.join(" | ") : null,
      });
    }
    log("avaliacoes.resumo:", { qtd_avaliadores: resposta.length, totalGeral, nota10: totalGeral / 4 });

    return res.json({
      itens: resposta,
      total_geral: totalGeral,
      nota_dividida_por_4: totalGeral / 4,
      qtd_avaliadores: resposta.length,
      nota_visivel: !!meta.nota_visivel,
      linha_tematica_nome: meta.linha_tematica_nome || null,
    });
  } catch (err) {
    console.error("[listarAvaliacoesDaSubmissao] code:", err?.code, "message:", err?.message);
    return res.status(500).json({ error: "Erro ao listar avaliações da submissão." });
  }
}

/** POST /api/admin/submissoes/:id/nota-visivel */
async function definirNotaVisivel(req, res) {
  const id = asInt(req.params.id);
  const { visivel } = req.body || {};
  log("POST /admin/submissoes/:id/nota-visivel →", { id, visivel });

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }

  async function doUpdate() {
    await db.none(
      `UPDATE trabalhos_submissoes SET nota_visivel=$1 WHERE id=$2`,
      [!!visivel, id]
    );
  }

  try {
    await doUpdate();
    log("nota-visivel: OK");
    return res.json({ ok: true, visivel: !!visivel });
  } catch (err) {
    if (err?.code === "42703") {
      log("nota-visivel: coluna ausente → criando");
      try {
        await db.none(
          `ALTER TABLE trabalhos_submissoes
             ADD COLUMN IF NOT EXISTS nota_visivel boolean NOT NULL DEFAULT false`
        );
        await doUpdate();
        log("nota-visivel: coluna criada e valor atualizado");
        return res.json({ ok: true, visivel: !!visivel, created_column: true });
      } catch (e2) {
        console.error("[definirNotaVisivel][migrate] code:", e2?.code, "message:", e2?.message);
        return res.status(500).json({ error: "Falha ao criar coluna nota_visivel." });
      }
    }
    console.error("[definirNotaVisivel] code:", err?.code, "message:", err?.message);
    return res.status(500).json({ error: "Erro ao atualizar visibilidade da nota." });
  }
}

/* ===================== Banner (download) ===================== */

// mime simples por extensão
function guessMimeByExt(filename = "") {
  const ext = String(filename).toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "application/octet-stream";
}

/** GET /api/submissoes/:id/poster  (também atende /banner via alias da rota) */
async function baixarBanner(req, res) {
  const started = Date.now();
  try {
    res.setHeader("X-Handler", "submissoesAdminController/baixarBanner@v2");
    const id = parseInt(req.params.id, 10);
    log("GET /submissoes/:id/poster|banner →", { id });

    if (!Number.isInteger(id) || id <= 0) {
      log("baixarBanner: id inválido");
      return res.status(400).json({ error: "ID inválido" });
    }

    const row = await db.oneOrNone(
      `SELECT a.caminho, a.nome_original, a.mime_type
         FROM trabalhos_submissoes s
         JOIN trabalhos_arquivos a ON a.id = s.poster_arquivo_id
        WHERE s.id = $1`,
      [id]
    );
    log("baixarBanner: query resultado =", j(row));

    if (!row) {
      log("baixarBanner: nenhum arquivo associado");
      return res.status(404).json({ error: "Nenhum arquivo associado a esta submissão." });
    }

    // Normaliza caminho: aceita absoluto ou relativo a /uploads
    const raw = String(row.caminho || "");
    const isAbs = path.isAbsolute(raw);
    const normalizedRel = raw.replace(/^uploads[\\/]/i, ""); // evita uploads/uploads/...
    const filePath = isAbs ? raw : path.resolve("uploads", normalizedRel);
    const exists = fs.existsSync(filePath);
    log("baixarBanner: caminho resolvido =", filePath, "exists=", exists);

    if (!exists) {
      return res.status(404).json({ error: "Arquivo ausente no servidor." });
    }

    const mime = row.mime_type || guessMimeByExt(row.nome_original || filePath);
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("X-File-Path", filePath); // help debug
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${path.basename(row.nome_original || "poster")}"`,
    );

    fs.createReadStream(filePath)
      .on("open", () => log("baixarBanner: streaming iniciado"))
      .on("error", (e) => {
        console.error("[baixarBanner][stream]", e);
        if (!res.headersSent) {
          res.status(500).json({ error: "Falha ao ler o arquivo." });
        } else {
          res.end();
        }
      })
      .on("close", () => log("baixarBanner: streaming finalizado em", (Date.now() - started) + "ms"))
      .pipe(res);
  } catch (err) {
    console.error("[baixarBanner]", err);
    res.status(500).json({ error: "Erro interno ao baixar arquivo." });
  }
}

// ── Helpers de consolidação de nota ───────────────────────────────────────────
async function calcularTotaisDaSubmissao(submissaoId, dbConn = db) {
  const rs = await dbConn.one(
    `
    WITH por_avaliador AS (
      SELECT avaliador_id, SUM(nota)::int AS total
      FROM trabalhos_avaliacoes_itens
      WHERE submissao_id = $1
      GROUP BY avaliador_id
    )
    SELECT
      COALESCE(SUM(total),0)::int                            AS total_geral,
      ROUND(COALESCE(SUM(total),0)::numeric / 4, 1)          AS nota_dividida_por_4
    FROM por_avaliador
    `,
    [submissaoId]
  );

  return {
    totalGeral: Number(rs?.total_geral || 0),
    nota10:     Number(rs?.nota_dividida_por_4 || 0),
  };
}

async function atualizarNotaMediaMaterializada(submissaoId, dbConn = db) {
  const { nota10 } = await calcularTotaisDaSubmissao(submissaoId, dbConn);
  await dbConn.none(
    `update trabalhos_submissoes set nota_media = $2, atualizado_em = now() where id = $1`,
    [submissaoId, nota10]
  );
  return nota10;
}

/** GET /api/admin/submissoes */
/** GET /api/admin/submissoes */
async function listarSubmissoesAdmin(req, res) {
  // ====== V1: com revoked_at ======
  const SQL_V1 = `
    WITH base AS (
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        s.criado_em AS submetido_em,   -- << usado no front
        u.nome  AS autor_nome,
        u.email AS autor_email,
        c.titulo AS chamada_titulo,
        COALESCE(s.nota_visivel, false) AS nota_visivel,
        tcl.nome AS linha_tematica_nome,

        /* média geral histórica (compat) */
        (
          WITH por_avaliador AS (
            SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = s.id
            GROUP BY ai.avaliador_id
          )
          SELECT ROUND(COALESCE(SUM(total), 0)::numeric / 4, 1)
          FROM por_avaliador
        ) AS nota_media,

        /* cálculos por tipo (podem ser NULL se não houver vínculos) */
        (
          WITH por_avaliador AS (
            SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = s.id
            GROUP BY ai.avaliador_id
          ),
          vinc AS (
            SELECT DISTINCT ON (submissao_id, avaliador_id)
                   submissao_id, avaliador_id, tipo
            FROM trabalhos_submissoes_avaliadores
            WHERE submissao_id = s.id AND revoked_at IS NULL
            ORDER BY submissao_id, avaliador_id, created_at DESC NULLS LAST
          )
          SELECT ROUND(COALESCE(SUM(p.total) FILTER (WHERE v.tipo='escrita'),0)::numeric / 4, 1)
          FROM por_avaliador p
          JOIN vinc v ON v.avaliador_id = p.avaliador_id
        ) AS nota_escrita_calc,

        (
          WITH por_avaliador AS (
            SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
            FROM trabalhos_avaliacoes_itens ai
            WHERE ai.submissao_id = s.id
            GROUP BY ai.avaliador_id
          ),
          vinc AS (
            SELECT DISTINCT ON (submissao_id, avaliador_id)
                   submissao_id, avaliador_id, tipo
            FROM trabalhos_submissoes_avaliadores
            WHERE submissao_id = s.id AND revoked_at IS NULL
            ORDER BY submissao_id, avaliador_id, created_at DESC NULLS LAST
          )
          SELECT ROUND(COALESCE(SUM(p.total) FILTER (WHERE v.tipo='oral'),0)::numeric / 4, 1)
          FROM por_avaliador p
          JOIN vinc v ON v.avaliador_id = p.avaliador_id
        ) AS nota_oral_calc,

        s.nota_escrita AS nota_escrita_col,
        s.nota_oral    AS nota_oral_col,
        s.nota_final   AS nota_final_col
      FROM trabalhos_submissoes s
      LEFT JOIN usuarios                 u   ON u.id  = s.usuario_id
      LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
      LEFT JOIN trabalhos_chamadas       c   ON c.id  = s.chamada_id
      ORDER BY s.id DESC
    )
    SELECT
      b.id, b.titulo, b.status, b.status_escrita, b.status_oral, b.chamada_id,
      b.submetido_em,
      b.autor_nome, b.autor_email, b.chamada_titulo,
      b.nota_visivel, b.linha_tematica_nome,
      b.nota_media,

      /* usa coluna se houver, senão cálculo */
      COALESCE(b.nota_escrita_col, b.nota_escrita_calc) AS nota_escrita,
      COALESCE(b.nota_oral_col,    b.nota_oral_calc)    AS nota_oral,

      /* final: usa coluna se houver; senão média das que existirem */
      COALESCE(
        b.nota_final_col,
        CASE
          WHEN b.nota_escrita_col IS NULL AND b.nota_oral_col IS NULL
            THEN CASE
                   WHEN b.nota_escrita_calc IS NULL THEN b.nota_oral_calc
                   WHEN b.nota_oral_calc    IS NULL THEN b.nota_escrita_calc
                   ELSE ROUND((b.nota_escrita_calc + b.nota_oral_calc)/2.0, 1)
                 END
          ELSE CASE
                 WHEN b.nota_escrita_col IS NULL THEN b.nota_oral_col
                 WHEN b.nota_oral_col    IS NULL THEN b.nota_escrita_col
                 ELSE ROUND((b.nota_escrita_col + b.nota_oral_col)/2.0, 1)
               END
        END
      ) AS nota_final
    FROM base b
  `;

  // ====== V2: igual, mas sem checar revoked_at ======
  const SQL_V2 = SQL_V1.replace(/ AND revoked_at IS NULL/g, "");

  // ====== V3: mínimo, ainda com linha_tematica_nome e submetido_em ======
  const SQL_V3 = `
    SELECT
      s.id, s.titulo, s.status, s.status_escrita, s.status_oral, s.chamada_id,
      s.criado_em AS submetido_em,
      u.nome  AS autor_nome, u.email AS autor_email,
      c.titulo AS chamada_titulo,
      COALESCE(s.nota_visivel, false) AS nota_visivel,
      tcl.nome AS linha_tematica_nome,
      (
        WITH por_avaliador AS (
          SELECT ai.avaliador_id, SUM(ai.nota)::int AS total
          FROM trabalhos_avaliacoes_itens ai
          WHERE ai.submissao_id = s.id
          GROUP BY ai.avaliador_id
        )
        SELECT ROUND(COALESCE(SUM(total), 0)::numeric / 4, 1)
      ) AS nota_media,
      s.nota_escrita AS nota_escrita,
      s.nota_oral    AS nota_oral,
      s.nota_final   AS nota_final
    FROM trabalhos_submissoes s
    LEFT JOIN usuarios                 u   ON u.id  = s.usuario_id
    LEFT JOIN trabalhos_chamada_linhas tcl ON tcl.id = s.linha_tematica_id
    LEFT JOIN trabalhos_chamadas       c   ON c.id  = s.chamada_id
    ORDER BY s.id DESC
  `;

  try {
    let rows;
    try {
      rows = await db.any(SQL_V1);
    } catch (e1) {
      if (e1?.code === "42703" || e1?.code === "42P01") {
        rows = await db.any(SQL_V2);
      } else {
        try { rows = await db.any(SQL_V2); }
        catch { rows = await db.any(SQL_V3); }
      }
    }
    const enriched = rows.map((r) => ({ ...r, ...deriveAprovFlags(r) }));
    return res.json(enriched);
  } catch (err) {
    console.error("[listarSubmissoesAdmin] code:", err?.code, "msg:", err?.message);
    return res.status(500).json({ error: "Erro ao listar submissões." });
  }
}

/* ===================== Resumo de Avaliadores ===================== */
/** GET /api/admin/avaliadores/resumo */
async function resumoAvaliadores(req, res) {
  try {
    const uid = getUserIdOptional(req);
    const admin = await isAdmin(uid, db);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    async function tryMany(sqlList) {
      let lastErr = null;
      for (const sql of sqlList) {
        try {
          return await db.any(sql);
        } catch (e) {
          if (e?.code === "42P01" || e?.code === "42703") {
            lastErr = e; continue;
          }
          throw e;
        }
      }
      if (lastErr) throw lastErr;
      return [];
    }

    const SQLs = [
      `
      WITH tsa_ativos AS (
        SELECT DISTINCT tsa.avaliador_id, tsa.submissao_id
        FROM trabalhos_submissoes_avaliadores tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliou AS (
        SELECT DISTINCT ai.avaliador_id, ai.submissao_id
        FROM trabalhos_avaliacoes_itens ai
      )
      SELECT
        u.id, COALESCE(u.nome,'') AS nome, COALESCE(u.email,'') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)     AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL) AS avaliados
      FROM tsa_ativos t
      JOIN usuarios u ON u.id = t.avaliador_id
      LEFT JOIN avaliou av
        ON av.avaliador_id = t.avaliador_id
       AND av.submissao_id = t.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC, u.nome ASC
      `,
      `
      WITH tsa_ativos AS (
        SELECT DISTINCT tsa.avaliador_id, tsa.submissao_id
        FROM trabalhos_submissoes_avaliadores tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliou AS (
        SELECT DISTINCT ai.avaliador_id, ai.trabalho_id AS submissao_id
        FROM trabalhos_avaliacoes_itens ai
      )
      SELECT
        u.id, COALESCE(u.nome,'') AS nome, COALESCE(u.email,'') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)     AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL) AS avaliados
      FROM tsa_ativos t
      JOIN usuarios u ON u.id = t.avaliador_id
      LEFT JOIN avaliou av
        ON av.avaliador_id = t.avaliador_id
       AND av.submissao_id = t.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC, u.nome ASC
      `,
      `
      WITH tsa_ativos AS (
        SELECT DISTINCT tsa.avaliador_id, tsa.submissao_id
        FROM submissoes_avaliadores tsa
        WHERE tsa.revoked_at IS NULL
      ),
      avaliou AS (
        SELECT DISTINCT ai.avaliador_id, ai.submissao_id
        FROM avaliacoes_itens ai
      )
      SELECT
        u.id, COALESCE(u.nome,'') AS nome, COALESCE(u.email,'') AS email,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NULL)     AS pendentes,
        COUNT(*) FILTER (WHERE av.avaliador_id IS NOT NULL) AS avaliados
      FROM tsa_ativos t
      JOIN usuarios u ON u.id = t.avaliador_id
      LEFT JOIN avaliou av
        ON av.avaliador_id = t.avaliador_id
       AND av.submissao_id = t.submissao_id
      GROUP BY u.id, u.nome, u.email
      ORDER BY COUNT(*) FILTER (WHERE av.avaliador_id IS NULL) DESC, u.nome ASC
      `,
    ];

    const rows = await tryMany(SQLs);

    const avaliadores = rows.map(r => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      pendentes: Number(r.pendentes || 0),
      avaliados: Number(r.avaliados || 0),
      total: Number(r.pendentes || 0) + Number(r.avaliados || 0),
    }));

    return res.json({ avaliadores });
  } catch (err) {
    console.error("[resumoAvaliadores]", err);
    return res.status(500).json({ error: "Erro ao gerar resumo de avaliadores." });
  }
}

/* ===================== Upload de modelo (banner/oral) ===================== */
const os = require("os");
const crypto = require("crypto");

// mini ensureDir local (fallback)
async function ensureDirLocal(dir) {
  return fs.promises.mkdir(dir, { recursive: true });
}

// pasta base para armazenar modelos de chamada
function modelosBaseDir() {
  try {
    const p = require("../paths");
    return p.MODELOS_CHAMADAS_DIR || path.resolve("uploads", "modelos_chamadas");
  } catch {
    return path.resolve("uploads", "modelos_chamadas");
  }
}

function sanitizeFilename(name = "") {
  const base = String(name).normalize("NFKD").replace(/[^\w.\-]+/g, "_");
  return base || `arquivo_${Date.now()}`;
}

// Salva/atualiza registro em trabalhos_arquivos para a chamada + tipo
async function upsertModeloArquivo({ chamadaId, filePath, original, mime, size, tipo }, dbConn = db) {
  const row = await dbConn.oneOrNone(
    `SELECT a.id
       FROM trabalhos_arquivos a
       JOIN trabalhos_chamadas c ON c.id = $1
      WHERE a.ref_table = 'trabalhos_chamadas'
        AND a.ref_id = $1
        AND a.tipo = $2
      ORDER BY a.id DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );

  if (row) {
    await dbConn.none(
      `UPDATE trabalhos_arquivos
          SET caminho=$2, nome_original=$3, mime_type=$4, tamanho=$5, atualizado_em=NOW(), tipo=$6
        WHERE id=$1`,
      [row.id, filePath, original, mime, size, tipo]
    );
    return row.id;
  }

  const rs = await dbConn.one(
    `INSERT INTO trabalhos_arquivos (ref_table, ref_id, caminho, nome_original, mime_type, tamanho, tipo, criado_em)
     VALUES ('trabalhos_chamadas', $1, $2, $3, $4, $5, $6, NOW())
     RETURNING id`,
    [chamadaId, filePath, original, mime, size, tipo]
  );
  return rs.id;
}

// Obtém meta do modelo de uma chamada por tipo
async function getModeloMeta(chamadaId, tipo, dbConn = db) {
  const row = await dbConn.oneOrNone(
    `SELECT id, caminho, nome_original, mime_type, tamanho, atualizado_em AS mtime
       FROM trabalhos_arquivos
      WHERE ref_table='trabalhos_chamadas'
        AND ref_id=$1
        AND tipo=$2
      ORDER BY id DESC
      LIMIT 1`,
    [chamadaId, tipo]
  );
  if (!row) return { exists: false };

  const filePath = path.isAbsolute(row.caminho)
    ? row.caminho
    : path.resolve("uploads", String(row.caminho || "").replace(/^uploads[\\/]/i, ""));

  const exists = fs.existsSync(filePath);
  return {
    exists,
    id: row.id,
    filename: row.nome_original || null,
    size: Number(row.tamanho) || null,
    mime: row.mime_type || null,
    mtime: row.mtime || null,
    resolved_path: filePath,
  };
}

/** GET /api/admin/chamadas/:id/modelo-banner */
async function getModeloBannerMeta(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    const meta = await getModeloMeta(chamadaId, "template_banner", db);
    return res.json(meta);
  } catch (err) {
    console.error("[getModeloBannerMeta]", err);
    return res.status(500).json({ error: "Falha ao obter modelo de banner." });
  }
}

/** GET /api/admin/chamadas/:id/modelo-banner/download */
async function downloadModeloBanner(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    const meta = await getModeloMeta(chamadaId, "template_banner", db);
    if (!meta.exists) return res.status(404).json({ error: "Modelo não encontrado." });

    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(meta.filename || `modelo-banner-${chamadaId}.pptx`)}"`);
    fs.createReadStream(meta.resolved_path).pipe(res);
  } catch (err) {
    console.error("[downloadModeloBanner]", err);
    return res.status(500).json({ error: "Falha ao baixar modelo de banner." });
  }
}

/** POST /api/chamadas/:id/modelo-banner  (multipart/form-data; field: file) */
async function uploadModeloBanner(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!req.file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });
    const original = req.file.originalname || "modelo.pptx";
    const mime = req.file.mimetype || "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const size = req.file.size || 0;
    if (!/\.pptx?$|powerpoint/i.test(original)) {
      return res.status(400).json({ error: "Arquivo inválido: envie .ppt ou .pptx." });
    }

    const baseDir = modelosBaseDir();
    const dir = path.resolve(baseDir, String(chamadaId));
    await ensureDirLocal(dir);
    const safeName = sanitizeFilename(original);
    const stamp = crypto.randomBytes(4).toString("hex");
    const finalPath = path.resolve(dir, `${stamp}__${safeName}`);

    await fs.promises.rename(req.file.path, finalPath);

    await upsertModeloArquivo({
      chamadaId,
      filePath: finalPath,
      original,
      mime,
      size,
      tipo: "template_banner",
    }, db);

    return res.json({ ok: true });
  } catch (err) {
    console.error("[uploadModeloBanner]", err);
    return res.status(500).json({ error: "Falha ao enviar modelo de banner." });
  }
}

/** GET /api/admin/chamadas/:id/modelo-oral */
async function getModeloOralMeta(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    const meta = await getModeloMeta(chamadaId, "template_slide_oral", db);
    return res.json(meta);
  } catch (err) {
    console.error("[getModeloOralMeta]", err);
    return res.status(500).json({ error: "Falha ao obter modelo de slides (oral)." });
  }
}

/** GET /api/admin/chamadas/:id/modelo-oral/download */
async function downloadModeloOral(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    const meta = await getModeloMeta(chamadaId, "template_slide_oral", db);
    if (!meta.exists) return res.status(404).json({ error: "Modelo não encontrado." });

    res.setHeader("Content-Type", meta.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(meta.filename || `modelo-oral-${chamadaId}.pptx`)}"`);
    fs.createReadStream(meta.resolved_path).pipe(res);
  } catch (err) {
    console.error("[downloadModeloOral]", err);
    return res.status(500).json({ error: "Falha ao baixar modelo de slides (oral)." });
  }
}

/** POST /api/chamadas/:id/modelo-oral  (multipart/form-data; field: file) */
async function uploadModeloOral(req, res) {
  const chamadaId = asInt(req.params.id);
  if (!Number.isInteger(chamadaId) || chamadaId <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  try {
    const uid = getUserIdOptional(req);
    if (!(await isAdmin(uid, db))) return res.status(403).json({ error: "Acesso negado." });

    if (!req.file) return res.status(400).json({ error: "Envie um arquivo no campo 'file'." });
    const original = req.file.originalname || "modelo-oral.pptx";
    const mime = req.file.mimetype || "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const size = req.file.size || 0;
    if (!/\.pptx?$|powerpoint/i.test(original)) {
      return res.status(400).json({ error: "Arquivo inválido: envie .ppt ou .pptx." });
    }

    const baseDir = modelosBaseDir();
    const dir = path.resolve(baseDir, String(chamadaId));
    await ensureDirLocal(dir);
    const safeName = sanitizeFilename(original);
    const stamp = crypto.randomBytes(4).toString("hex");
    const finalPath = path.resolve(dir, `${stamp}__${safeName}`);

    await fs.promises.rename(req.file.path, finalPath);

    await upsertModeloArquivo({
      chamadaId,
      filePath: finalPath,
      original,
      mime,
      size,
      tipo: "template_slide_oral",
    }, db);

    return res.json({ ok: true });
  } catch (err) {
    console.error("[uploadModeloOral]", err);
    return res.status(500).json({ error: "Falha ao enviar modelo de slides (oral)." });
  }
}

async function obterSubmissao(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const uid = getUserIdOptional(req);

    // Busca a submissão (ajuste colunas conforme seu schema)
    const row = await db.oneOrNone(
      `SELECT s.*,
              c.titulo AS chamada_titulo
         FROM trabalhos_submissoes s
         LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
        WHERE s.id = $1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: "Submissão não encontrada." });

    // Permissão: admin, avaliador vinculado ou autor
    const allowed =
      (await isAdmin(uid, db)) ||
      (await canUserReviewOrView(uid, id, db)) ||
      (Number(row.autor_id) === Number(uid));

    if (!allowed) return res.status(403).json({ error: "Acesso negado." });

    // Enriquecer com flags parciais (escrita/oral)
    const flags = deriveAprovFlags(row);
    return res.json({ ...row, ...flags });
  } catch (err) {
    console.error("[obterSubmissao]", err);
    return res.status(500).json({ error: "Erro ao obter submissão." });
  }
}

module.exports = {
  // helpers
  getUserIdOptional,
  getUserIdOrThrow,

  // perms
  isAdmin,
  canUserReviewOrView,

  // 🔶 avaliadores (novo fluxo)
  listarAvaliadoresFlex,
  incluirAvaliadores,
  revogarAvaliadorFlex,
  restaurarAvaliadorFlex,
  resumoAvaliadores,

  // compat: mantém nomes antigos apontando para o novo fluxo
  listarAvaliadoresDaSubmissao: listarAvaliadoresFlex,
  atribuirAvaliadores: incluirAvaliadores,

  // avaliações
  listarAvaliacoesDaSubmissao,
  definirNotaVisivel,

  // arquivos
  baixarBanner,

  // modelos
  getModeloBannerMeta,
  downloadModeloBanner,
  uploadModeloBanner,
  getModeloOralMeta,
  downloadModeloOral,
  uploadModeloOral,
  obterSubmissao,

  // notas materializadas
  calcularTotaisDaSubmissao,
  atualizarNotaMediaMaterializada,
  listarSubmissoesAdmin,
};
