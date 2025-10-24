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
/**
 * Dado um row vindo do banco, deduz:
 *  - se exposição/escrita está aprovada
 *  - se apresentação oral está aprovada
 *
 * Isso replica exatamente a lógica do front:
 *   hasAprovExposicao / hasAprovOral
 */
function deriveAprovFlags(row) {
  const st = String(row?.status || "").toLowerCase();
  const se = String(row?.status_escrita || "").toLowerCase(); // pode não existir
  const so = String(row?.status_oral || "").toLowerCase();    // pode não existir

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

/* ===================== Avaliadores ===================== */
/** GET /api/admin/submissoes/:id/avaliadores */
async function listarAvaliadoresDaSubmissao(req, res) {
  const id = asInt(req.params.id);
  log("GET /admin/submissoes/:id/avaliadores →", { id });
  try {
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const rows = await db.any(
      `SELECT u.id, u.nome, u.email
         FROM trabalhos_submissoes_avaliadores tsa
         JOIN usuarios u ON u.id = tsa.avaliador_id
        WHERE tsa.submissao_id = $1
          AND tsa.revoked_at IS NULL
        ORDER BY u.nome ASC`,
      [id]
    );
    log("listarAvaliadoresDaSubmissao: qtd=", rows.length);
    res.json(rows);
  } catch (err) {
    console.error("[listarAvaliadoresDaSubmissao]", err);
    res.status(500).json({ error: "Erro ao listar avaliadores da submissão." });
  }
}

/** POST /api/admin/submissoes/:id/avaliadores
 *  Aceita 1 ou 2 IDs. Mescla com os atuais (sem duplicar).
 *  Só atualiza status para 'em_avaliacao' quando totalizar 2.
 *  Se body.replace === true, substitui os atuais pelos informados (1 ou 2).
 */
async function atribuirAvaliadores(req, res) {
  const id = asInt(req.params.id);
  const { avaliadores, replace = false } = req.body || {};
  log("POST /admin/submissoes/:id/avaliadores →", { id, avaliadores, replace });

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID inválido" });
  }
  if (!Array.isArray(avaliadores) || avaliadores.length < 1 || avaliadores.length > 2) {
    return res.status(400).json({ error: "Envie 1 ou 2 avaliadores." });
  }

  // normaliza para strings p/ Set e compara depois como número
  const incoming = Array.from(new Set(avaliadores.map(v => String(v).trim()))).filter(Boolean);
  if (incoming.length === 0) {
    return res.status(400).json({ error: "Nenhum avaliador informado." });
  }
  if (incoming.length > 2) {
    return res.status(400).json({ error: "Máximo de 2 avaliadores." });
  }

  try {
    // atuais não revogados
    const atuaisRows = await db.any(
      `SELECT avaliador_id
         FROM trabalhos_submissoes_avaliadores
        WHERE submissao_id=$1 AND revoked_at IS NULL
        ORDER BY avaliador_id`,
      [id]
    );
    const atuais = new Set(atuaisRows.map(r => String(r.avaliador_id)));

    // destino final (merge ou replace)
    let destinoSet;
    if (replace) {
      destinoSet = new Set(incoming);
    } else {
      destinoSet = new Set([...atuais, ...incoming]);
    }
    const destino = Array.from(destinoSet);

    if (destino.length > 2) {
      return res.status(400).json({ error: "O total de avaliadores não pode exceder 2." });
    }
    if (destino.length === 2 && destino[0] === destino[1]) {
      return res.status(400).json({ error: "Avaliadores devem ser distintos." });
    }

    // Valida elegibilidade apenas dos NOVOS (quem ainda não está atribuído)
    const novos = destino.filter(idStr => !atuais.has(idStr));
    if (novos.length > 0) {
      // valida perfis elegíveis
      const novosNums = novos.map(n => Number(n)).filter(Number.isFinite);
      const elegiveis = await db.any(
        `SELECT id
           FROM usuarios
          WHERE id = ANY($1)
            AND LOWER(COALESCE(perfil,'')) IN ('instrutor','administrador')`,
        [novosNums]
      );
      if (elegiveis.length !== novosNums.length) {
        return res.status(400).json({ error: "Usuários inválidos para avaliação." });
      }
    }

    await db.tx(async (t) => {
      const assignedBy = getUserIdOptional(req);

      if (replace) {
        // revoga quem não está no destino
        const destinoNums = destino.map(d => Number(d)).filter(Number.isFinite);
        await t.none(
          `UPDATE trabalhos_submissoes_avaliadores
              SET revoked_at = NOW()
            WHERE submissao_id=$1
              AND revoked_at IS NULL
              AND avaliador_id <> ALL($2::int[])`,
          [id, destinoNums.length ? destinoNums : [0]] // evita erro de array vazio
        );
      }
      // (modo merge): não revoga ninguém — apenas insere/reativa os novos

      // upsert/reativa cada id do destino
      for (const idStr of destino) {
        const uid = Number(idStr);
        await t.none(
          `INSERT INTO trabalhos_submissoes_avaliadores (submissao_id, avaliador_id, assigned_by)
           VALUES ($1,$2,$3)
           ON CONFLICT (submissao_id, avaliador_id)
           DO UPDATE SET revoked_at=NULL, assigned_by=EXCLUDED.assigned_by`,
          [id, uid, assignedBy]
        );
      }

      // só marca 'em_avaliacao' quando totalizar 2 ativos
      if (destino.length === 2) {
        await t.none(
          `UPDATE trabalhos_submissoes
              SET status='em_avaliacao', atualizado_em=NOW()
            WHERE id=$1 AND status IN ('submetido','em_avaliacao')`,
          [id]
        );
      }
    });

    log("atribuirAvaliadores: OK (total ativos =", destino.length, ")");
    return res.json({ ok: true, total_atribuidos: destino.length });
  } catch (err) {
    console.error("[atribuirAvaliadores]", err);
    return res.status(500).json({ error: "Erro ao atribuir avaliadores." });
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
        // sem a coluna nota_visivel → fallback, ainda trazendo o nome
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
          item.__extras += notaVal; // critério sem ordem mapeada
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
      linha_tematica_nome: meta.linha_tematica_nome || null, // ← aqui!
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
      `inline; filename="${path.basename(row.nome_original || "poster")}"`
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
async function listarSubmissoesAdmin(req, res) {
  async function queryComParciais() {
    return db.any(`
      SELECT
        s.id,
        s.titulo,
        s.status,
        s.status_escrita,
        s.status_oral,
        s.chamada_id,
        s.autor_nome,
        s.autor_email,
        s.area_tematica AS area,
        s.eixo,
        c.titulo AS chamada_titulo,
        COALESCE(
          s.nota_media,
          (
            WITH por_avaliador AS (
              SELECT a.avaliador_id, SUM(ai.nota)::int AS total
              FROM trabalhos_avaliacoes_itens ai
              JOIN trabalhos_avaliacoes a ON a.id = ai.avaliacao_id
              WHERE a.submissao_id = s.id
              GROUP BY a.avaliador_id
            )
            SELECT ROUND(COALESCE(SUM(total),0)::numeric / 4, 1)
            FROM por_avaliador
          )
        ) AS nota_media
      FROM trabalhos_submissoes s
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      ORDER BY s.id DESC
    `);
  }

  // fallback SEM as colunas parciais
  async function querySemParciais() {
    return db.any(`
      SELECT
        s.id,
        s.titulo,
        s.status,
        NULL::text AS status_escrita,
        NULL::text AS status_oral,
        s.chamada_id,
        s.autor_nome,
        s.autor_email,
        s.area_tematica AS area,
        s.eixo,
        c.titulo AS chamada_titulo,
        COALESCE(
          s.nota_media,
          (
            WITH por_avaliador AS (
              SELECT a.avaliador_id, SUM(ai.nota)::int AS total
              FROM trabalhos_avaliacoes_itens ai
              JOIN trabalhos_avaliacoes a ON a.id = ai.avaliacao_id
              WHERE a.submissao_id = s.id
              GROUP BY a.avaliador_id
            )
            SELECT ROUND(COALESCE(SUM(total),0)::numeric / 4, 1)
            FROM por_avaliador
          )
        ) AS nota_media
      FROM trabalhos_submissoes s
      LEFT JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      ORDER BY s.id DESC
    `);
  }

  try {
    let rows;
    try {
      // Tenta versão "rica"
      rows = await queryComParciais();
    } catch (errRich) {
      // 42703 = coluna não existe
      if (errRich?.code === "42703") {
        rows = await querySemParciais();
      } else {
        throw errRich;
      }
    }

    // Agora enriquecemos cada linha com as flags _exposicao_aprovada e _oral_aprovada
    const enriched = rows.map((r) => {
      const flags = deriveAprovFlags(r);
      return {
        ...r,
        ...flags,
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error("[listarSubmissoesAdmin]", err);
    return res.status(500).json({ error: "Erro ao listar submissões." });
  }
}

/* ===================== Resumo de Avaliadores ===================== */
/** GET /api/admin/avaliadores/resumo
 * Retorna, por avaliador com encaminhamentos ativos:
 *  - pendentes: submissões atribuídas a ele sem nenhuma nota dele ainda
 *  - avaliados: submissões atribuídas a ele com pelo menos 1 nota dele
 *  - total = pendentes + avaliados
 */
// Substitua toda a função por esta:
async function resumoAvaliadores(req, res) {
  try {
    // segurança: só admin
    const uid = getUserIdOptional(req);
    const admin = await isAdmin(uid, db);
    if (!admin) return res.status(403).json({ error: "Acesso negado." });

    // helper: tenta uma lista de SQLs até uma funcionar
    async function tryMany(sqlList) {
      let lastErr = null;
      for (const sql of sqlList) {
        try {
          return await db.any(sql);
        } catch (e) {
          // 42P01 = relation doesn't exist | 42703 = column doesn't exist
          if (e?.code === "42P01" || e?.code === "42703") {
            lastErr = e;
            continue;
          }
          throw e; // outros erros: relança
        }
      }
      if (lastErr) throw lastErr;
      return [];
    }

    // Variantes:
    //  - TSA nomeada como trabalhos_submissoes_avaliadores (mais comum)
    //  - Itens com submissao_id (mais comum) OU trabalho_id (varia)
    //  - fallback de prefixos: com/sem "trabalhos_"
    const SQLs = [
      // Variante A: nomes "trabalhos_*" + coluna submissao_id
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

      // Variante B: itens com trabalho_id (alguns schemas usam isso)
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

      // Variante C: sem prefixo "trabalhos_" nas tabelas
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

//** POST /api/admin/submissoes/:id/status
//* Atualiza status principal + parciais sem nunca apagar aprovações já dadas.
/* Aceita body como:
* {
*   status: "aprovado_exposicao" | "aprovado_oral" | "reprovado" | ...
*   status_escrita: "aprovado" | null | undefined
*   status_oral: "aprovado" | null | undefined
*   observacoes_admin: string|null (ignorado aqui por enquanto)
* }
*/

/* ===================== Exports ===================== */
module.exports = {
  // helpers
  getUserIdOptional,
  getUserIdOrThrow,

  // perms
  isAdmin,
  canUserReviewOrView,

  // avaliadores
  listarAvaliadoresDaSubmissao,
  atribuirAvaliadores,
  resumoAvaliadores,  // ✅ adicione esta linha

  // avaliações
  listarAvaliacoesDaSubmissao,
  definirNotaVisivel,

  // arquivos
  baixarBanner,

  // notas materializadas
  calcularTotaisDaSubmissao,
  atualizarNotaMediaMaterializada,
  listarSubmissoesAdmin,
};
