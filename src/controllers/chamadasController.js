/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const url = require("url");
const mime = require("mime-types");
const multer = require("multer");
const crypto = require("crypto");

// ✅ usa o mesmo DB exportado pelo projeto
const { db } = require("../db");

// ✅ usa os paths centralizados (DATA_ROOT/FILES_BASE)
const { MODELOS_CHAMADAS_DIR } = require("../paths");

// ───────────────────────── Upload em memória ─────────────────────────
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ───────────────────────── Helpers ─────────────────────────
function isYYYYMM(s) { return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function assert(cond, msg) { if (!cond) { const e = new Error(msg); e.status = 400; throw e; } }
function withinLen(s, max) { return typeof s === "string" && String(s).trim().length <= max; }

// 🔢 Limites
const LIMIT_MIN = 1;
const LIMIT_MAX = 5000;

/**
 * Normaliza prazo_final_br:
 * - ISO com TZ: usa direto
 * - Sem TZ: interpreta em America/Sao_Paulo
 */
function normalizePrazoFragment(prazo_final_br) {
  const s = String(prazo_final_br || "").trim();
  const isIsoWithTz = /[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s);

  if (isIsoWithTz) {
    return { fragment: `($$PRAZO$$)::timestamptz`, param: s };
  }
  assert(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(s), "prazo_final_br inválido.");
  const withSec = s.length === 16 ? `${s}:00` : s;
  return {
    fragment: `(($$PRAZO$$)::timestamp AT TIME ZONE 'America/Sao_Paulo')`,
    param: withSec,
  };
}

function isValidLimits(limites) {
  if (!limites) return true;
  const keys = ["titulo","introducao","objetivos","metodo","resultados","consideracoes"];
  for (const k of keys) {
    const v = Number(limites[k]);
    if (!Number.isInteger(v) || v < LIMIT_MIN || v > LIMIT_MAX) return false;
  }
  return true;
}

function isHttpUrl(u) {
  try { const x = new url.URL(String(u)); return x.protocol === "http:" || x.protocol === "https:"; }
  catch { return false; }
}
function fileExists(p) { try { return fs.existsSync(p); } catch { return false; } }

/** Caminho do modelo por chamada (legado em disco, usando paths.js) */
function modeloPathPorChamada(chamadaId) {
  // MODELOS_CHAMADAS_DIR = DATA_ROOT/uploads/modelos/chamadas
  const base = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
  const pptx = path.join(base, "banner.pptx");
  const ppt  = path.join(base, "banner.ppt");
  if (fileExists(pptx)) return { path: pptx, name: "modelo_banner.pptx", type: mime.lookup(pptx) || "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
  if (fileExists(ppt))  return { path: ppt,  name: "modelo_banner.ppt",  type: mime.lookup(ppt)  || "application/vnd.ms-powerpoint" };
  return null;
}

/** storage_key relativo → caminho absoluto no FS */
function resolveStoragePath(storageKey) {
  if (!storageKey) return null;
  const key = String(storageKey).replace(/^\/+/, "");
  return path.isAbsolute(key) ? key : path.join(MODELOS_CHAMADAS_DIR, key);
}

// ✅ DB do req (se houver) ou fallback
const getDB = (req) => (req && req.db) ? req.db : db;

// Executa uma transação com fallback
async function withTx(DB, fn) {
  const hasTx = typeof DB?.tx === "function";
  const hasQuery = typeof DB?.query === "function";

  if (hasTx) return DB.tx(fn);

  if (hasQuery) {
    await DB.query("BEGIN");
    try {
      const t = {
        query: DB.query.bind(DB),
        one: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows?.[0];
        },
        any: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows || [];
        },
        none: async (sql, params) => {
          await DB.query(sql, params);
        },
      };
      const result = await fn(t);
      await DB.query("COMMIT");
      return result;
    } catch (e) {
      try { await DB.query("ROLLBACK"); } catch {}
      throw e;
    }
  }

  const err = new Error("DB não suporta transação: sem .tx e sem .query para fallback.");
  err.status = 500;
  throw err;
}

// ─────────────────────── Endpoints ───────────────────────

exports.listarAtivas = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const SQL = `
      SELECT c.*,
             ((now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_chamadas c
      WHERE c.publicado = TRUE
      ORDER BY c.prazo_final_br ASC, c.id ASC
    `;
    if (typeof DB.any === "function") {
      const rows = await DB.any(SQL);
      return res.json(rows);
    }
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) { console.error("[chamadas.listarAtivas] erro", err); next(err); }
};

exports.obterChamada = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = Number(req.params.id);

    const fetchOne = async (sql, params) => {
      if (typeof DB.oneOrNone === "function") return DB.oneOrNone(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0] || null;
      }
      throw new Error("DB não expõe métodos para one/oneOrNone/query.");
    };

    const chamada = await fetchOne(`
      SELECT c.*,
             ((now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_chamadas c WHERE c.id=$1
    `, [id]);

    if (!chamada) { const e = new Error("Chamada não encontrada."); e.status = 404; throw e; }

    const fetchAny = async (sql, params) => {
      if (typeof DB.any === "function") return DB.any(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows || [];
      }
      throw new Error("DB não expõe métodos para any/query.");
    };

    const linhas = await fetchAny(`
      SELECT id, codigo, nome, descricao
      FROM trabalhos_chamada_linhas
      WHERE chamada_id=$1
      ORDER BY nome ASC, id ASC
    `, [id]);

    const criterios = await fetchAny(`
      SELECT id, ordem, titulo, escala_min, escala_max, peso
      FROM trabalhos_chamada_criterios
      WHERE chamada_id=$1
      ORDER BY ordem
    `, [id]);

    const criterios_orais = await fetchAny(`
      SELECT id, ordem, titulo, escala_min, escala_max, peso
      FROM trabalhos_chamada_criterios_orais
      WHERE chamada_id=$1
      ORDER BY ordem
    `, [id]);

    const out = {
      chamada,
      linhas,
      criterios,
      criterios_orais,
      limites: chamada.limites ?? null,
      criterios_outros: chamada.criterios_outros ?? null,
      oral_outros: chamada.oral_outros ?? null,
      premiacao_texto: chamada.premiacao_texto ?? null,
      disposicoes_finais_texto: chamada.disposicoes_finais_texto ?? null,
      link_modelo_poster: chamada.link_modelo_poster ?? null,
      aceita_poster: !!chamada.aceita_poster,
    };

    res.json(out);
  } catch (err) { console.error("[chamadas.obterChamada] erro", err); next(err); }
};

exports.listarTodas = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const SQL = `
      SELECT c.*,
             ((now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.criado_em DESC, c.id DESC
    `;
    if (typeof DB.any === "function") {
      const rows = await DB.any(SQL);
      return res.json(rows);
    }
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) { console.error("[chamadas.listarTodas] erro", err); next(err); }
};

exports.criar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const {
      titulo,
      descricao_markdown,
      periodo_experiencia_inicio,
      periodo_experiencia_fim,
      prazo_final_br,
      aceita_poster = true,
      link_modelo_poster = null,
      max_coautores = 10,
      publicado = false,
      linhas = [],
      criterios = [],
      critérios_orais = [], // compat
      limites = null,
      criterios_outros = null,
      oral_outros = null,
      premiacao_texto = null,
      disposicoes_finais_texto = null,
    } = req.body;

    const criterios_orais_in = req.body.criterios_orais ?? critérios_orais ?? [];

    // ─── Validações ──────────────────────────────────────────────
    assert(titulo && withinLen(titulo, 200), "Título é obrigatório (≤ 200).");
    assert(descricao_markdown && String(descricao_markdown).trim().length, "Descrição é obrigatória.");
    assert(isYYYYMM(periodo_experiencia_inicio), "Período início deve ser YYYY-MM.");
    assert(isYYYYMM(periodo_experiencia_fim), "Período fim deve ser YYYY-MM.");
    assert(periodo_experiencia_inicio <= periodo_experiencia_fim, "Período inválido (início > fim).");
    assert(prazo_final_br, "Prazo final é obrigatório.");
    assert(isValidLimits(limites), `Limites inválidos (${LIMIT_MIN}–${LIMIT_MAX}).`);

    // ✅ aceita req.user OU req.usuario
    const userId = req.user?.id ?? req.usuario?.id;
    assert(userId, "Autenticação necessária.");

    const norm = normalizePrazoFragment(prazo_final_br);

    await withTx(DB, async (t) => {
      const nova = await t.one(
        `
        INSERT INTO trabalhos_chamadas
          (titulo, descricao_markdown, periodo_experiencia_inicio, periodo_experiencia_fim,
           prazo_final_br, aceita_poster, link_modelo_poster, max_coautores, publicado, criado_por,
           limites, criterios_outros, oral_outros, premiacao_texto, disposicoes_finais_texto)
        VALUES ($1,$2,$3,$4, ${norm.fragment.replace("$$PRAZO$$", "$5")} ,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15)
        RETURNING id
        `,
        [
          titulo.trim(),
          descricao_markdown,
          periodo_experiencia_inicio,
          periodo_experiencia_fim,
          norm.param,
          !!aceita_poster,
          link_modelo_poster || null,
          Number(max_coautores) || 10,
          !!publicado,
          userId,
          limites ? JSON.stringify(limites) : null,
          criterios_outros || null,
          oral_outros || null,
          premiacao_texto || null,
          disposicoes_finais_texto || null,
        ]
      );

      // Linhas temáticas
      for (const l of Array.isArray(linhas) ? linhas : []) {
        assert(l?.nome, "Linha temática exige nome.");
        await t.none(
          `INSERT INTO trabalhos_chamada_linhas (chamada_id, codigo, nome, descricao)
           VALUES ($1,$2,$3,$4)`,
          [
            nova.id,
            l.codigo ? String(l.codigo).trim() : null,
            String(l.nome).trim(),
            l.descricao || null,
          ]
        );
      }

      // Critérios (escritos)
      for (const [idx, c] of (Array.isArray(criterios) ? criterios : []).entries()) {
        assert(c?.titulo, "Critério escrito requer título.");
        await t.none(
          `INSERT INTO trabalhos_chamada_criterios
             (chamada_id, ordem, titulo, escala_min, escala_max, peso)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            nova.id,
            c.ordem || idx + 1,
            c.titulo,
            c.escala_min ?? 1,
            c.escala_max ?? 5,
            c.peso ?? 1,
          ]
        );
      }

      // Critérios (orais)
      for (const [idx, c] of (Array.isArray(criterios_orais_in) ? criterios_orais_in : []).entries()) {
        assert(c?.titulo, "Critério oral requer título.");
        await t.none(
          `INSERT INTO trabalhos_chamada_criterios_orais
             (chamada_id, ordem, titulo, escala_min, escala_max, peso)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            nova.id,
            c.ordem || idx + 1,
            c.titulo,
            c.escala_min ?? 1,
            c.escala_max ?? 3,
            c.peso ?? 1,
          ]
        );
      }

      return res.status(201).json({ ok: true, id: nova.id });
    });
  } catch (err) {
    console.error("[chamadas.criar] erro", err);
    next(err);
  }
};

exports.atualizar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = Number(req.params.id);
    const body = req.body;

    const cols = [
      "titulo","descricao_markdown","periodo_experiencia_inicio","periodo_experiencia_fim",
      "prazo_final_br","aceita_poster","link_modelo_poster","max_coautores","publicado",
      "limites","criterios_outros","oral_outros","premiacao_texto","disposicoes_finais_texto",
    ];

    await withTx(DB, async (t) => {
      const set = [];
      const vals = [];

      for (const c of cols) {
        if (!Object.prototype.hasOwnProperty.call(body, c)) continue;

        if (c === "titulo") assert(withinLen(body[c], 200), "Título deve ter até 200 caracteres.");
        if (c === "periodo_experiencia_inicio" || c === "periodo_experiencia_fim") {
          assert(isYYYYMM(body[c]), `${c} deve ser YYYY-MM.`);
        }
        if (c === "limites") {
          assert(isValidLimits(body[c]), `Limites inválidos (${LIMIT_MIN}–${LIMIT_MAX}).`);
          vals.push(body[c] ? JSON.stringify(body[c]) : null);
          set.push(`limites = $${vals.length}`);
          continue;
        }
        if (c === "prazo_final_br" && body[c]) {
          const norm = normalizePrazoFragment(body[c]);
          vals.push(norm.param);
          set.push(`prazo_final_br = ${norm.fragment.replace("$$PRAZO$$", `$${vals.length}`)}`);
          continue;
        }

        vals.push(body[c]);
        set.push(`${c}=$${vals.length}`);
      }

      if (Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_inicio") &&
          Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_fim")) {
        assert(body.periodo_experiencia_inicio <= body.periodo_experiencia_fim, "Período inválido.");
      }

      if (set.length) {
        vals.push(id);
        await t.none(
          `UPDATE trabalhos_chamadas SET ${set.join(", ")}, atualizado_em=NOW() WHERE id=$${vals.length}`,
          vals
        );
      }

      if (Array.isArray(body.linhas)) {
        await t.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id=$1`, [id]);
        for (const l of body.linhas) {
          assert(l?.nome, "Linha temática exige nome.");
          await t.none(
            `INSERT INTO trabalhos_chamada_linhas (chamada_id, codigo, nome, descricao)
             VALUES ($1,$2,$3,$4)`,
            [id, l.codigo ? String(l.codigo).trim() : null, String(l.nome).trim(), (l.descricao || null)]
          );
        }
      }

      if (Array.isArray(body.criterios)) {
        await t.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id=$1`, [id]);
        for (const [idx, c] of body.criterios.entries()) {
          assert(c?.titulo, "Critério escrito requer título.");
          await t.none(
            `INSERT INTO trabalhos_chamada_criterios (chamada_id, ordem, titulo, escala_min, escala_max, peso)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, c.ordem || idx + 1, c.titulo, c.escala_min ?? 1, c.escala_max ?? 5, c.peso ?? 1]
          );
        }
      }

      if (Array.isArray(body.criterios_orais)) {
        await t.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id=$1`, [id]);
        for (const [idx, c] of body.criterios_orais.entries()) {
          assert(c?.titulo, "Critério oral requer título.");
          await t.none(
            `INSERT INTO trabalhos_chamada_criterios_orais (chamada_id, ordem, titulo, escala_min, escala_max, peso)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, c.ordem || idx + 1, c.titulo, c.escala_min ?? 1, c.escala_max ?? 3, c.peso ?? 1]
          );
        }
      }

      res.json({ ok: true });
    });
  } catch (err) { console.error("[chamadas.atualizar] erro", err); next(err); }
};

exports.publicar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = Number(req.params.id);
    const { publicado = true } = req.body || {};

    const fetchOne = async (sql, params) => {
      if (typeof DB.one === "function") return DB.one(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0];
      }
      throw new Error("DB não expõe métodos para one/query.");
    };

    if (publicado === true) {
      const row = await fetchOne(`
        SELECT
          (SELECT COUNT(*) FROM trabalhos_chamada_linhas    WHERE chamada_id=$1) AS linhas,
          (SELECT COUNT(*) FROM trabalhos_chamada_criterios WHERE chamada_id=$1) AS criterios
      `, [id]);

      assert(Number(row.linhas) > 0, "Inclua ao menos 1 linha temática antes de publicar.");
      assert(Number(row.criterios) > 0, "Inclua ao menos 1 critério de avaliação antes de publicar.");
    }

    if (typeof DB.none === "function") {
      await DB.none(
        `UPDATE trabalhos_chamadas SET publicado=$1, atualizado_em=NOW() WHERE id=$2`,
        [!!publicado, id]
      );
    } else if (typeof DB.query === "function") {
      await DB.query(
        `UPDATE trabalhos_chamadas SET publicado=$1, atualizado_em=NOW() WHERE id=$2`,
        [!!publicado, id]
      );
    } else {
      throw new Error("DB não expõe método para UPDATE (none/query).");
    }

    res.json({ ok: true, publicado: !!publicado });
  } catch (err) { console.error("[chamadas.publicar] erro", err); next(err); }
};

// ── Listagem admin
exports.listarAdmin = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const SQL = `
      SELECT c.*,
             ((now() AT TIME ZONE 'America/Sao_Paulo') <= c.prazo_final_br) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.prazo_final_br ASC, c.id DESC
    `;
    if (typeof DB.any === "function") {
      const rows = await DB.any(SQL);
      return res.json(rows);
    }
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) { console.error("[chamadas.listarAdmin] erro", err); next(err); }
};

/** DELETE /api/admin/chamadas/:id */
exports.remover = async (req, res, next) => {
  const DB = getDB(req);
  const id = Number(req.params.id);

  try {
    await withTx(DB, async (t) => {
      await t.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_criterios      WHERE chamada_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_linhas         WHERE chamada_id=$1`, [id]);

      const r = await t.one?.(`DELETE FROM trabalhos_chamadas WHERE id=$1 RETURNING id`, [id]);
      if (!r) await t.query?.(`DELETE FROM trabalhos_chamadas WHERE id=$1`, [id]);

      res.json({ ok: true, id });
    });
  } catch (err) { console.error("[chamadas.remover] erro", err); next(err); }
};

// ── EXPORTAÇÃO DO MODELO PADRÃO (legado)
exports.exportarModeloBanner = async (_req, res, next) => {
  try {
    const filePath = path.join(process.cwd(), "api", "assets", "modelos", "banner-padrao.pptx");
    if (!fs.existsSync(filePath)) {
      const e = new Error("Modelo de banner não encontrado no servidor.");
      e.status = 404;
      throw e;
    }
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="modelo_banner.pptx"');
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.sendFile(filePath);
  } catch (err) {
    console.error("[chamadas.exportarModeloBanner] erro", err);
    next(err);
  }
};

/* =================================================================== */
/*  ADMIN: Modelo por CHAMADA                                          */
/*  - GET  /api/admin/chamadas/:id/modelo-banner  → META               */
/*  - POST /api/admin/chamadas/:id/modelo-banner  → UPLOAD (campo banner)
   =================================================================== */

// GET META (admin)
exports.modeloBannerMeta = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = Number(req.params.id);
    if (!id) { const e = new Error("ID inválido."); e.status = 400; throw e; }

    // 1) banco (tabela de storage em disco)
    const metaDb = (typeof DB.oneOrNone === "function")
      ? await DB.oneOrNone(
          `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
             FROM public.trabalhos_chamadas_modelos
            WHERE chamada_id=$1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [id]
        )
      : (await DB.query(
          `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
             FROM public.trabalhos_chamadas_modelos
            WHERE chamada_id=$1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [id]
        )).rows?.[0];

    if (metaDb?.storage_key) {
      const abs = resolveStoragePath(metaDb.storage_key);
      const bytes = (() => { try { return fs.statSync(abs).size; } catch { return metaDb.tamanho_bytes || null; } })();
      return res.json({
        exists: true, origin: "db",
        filename: metaDb.nome_arquivo || "modelo_banner.pptx",
        mime: metaDb.mime || mime.lookup(metaDb.nome_arquivo || "") || "application/octet-stream",
        bytes
      });
    }

    // 2) arquivo local (legado)
    const local = modeloPathPorChamada(id);
    if (local) {
      const stat = fs.statSync(local.path);
      return res.json({
        exists: true, origin: "fs",
        filename: local.name, mime: local.type, bytes: stat.size
      });
    }

    // 3) link externo
    const rowLink = (typeof DB.oneOrNone === "function")
      ? await DB.oneOrNone(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])
      : (await DB.query(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])).rows?.[0];

    const link = rowLink?.link_modelo_poster || null;
    if (isHttpUrl(link)) return res.json({ exists: true, origin: "url", href: link });

    return res.json({ exists: false });
  } catch (err) { console.error("[chamadas.modeloBannerMeta] erro", err); next(err); }
};

// POST UPLOAD (admin) → salva no FS e cadastra em trabalhos_chamadas_modelos
exports.importarModeloBanner = [
  uploadMem.single("banner"),
  async (req, res, next) => {
    const DB = getDB(req);
    try {
      const chamadaId = Number(req.params.id);
      const f = req.file;
      if (!chamadaId) { const e = new Error("ID inválido."); e.status = 400; throw e; }
      if (!f) { const e = new Error("Arquivo obrigatório (campo 'banner')."); e.status = 400; throw e; }

      const nome = f.originalname || "modelo_banner.pptx";
      const mimeIn = f.mimetype || mime.lookup(nome) || "application/octet-stream";
      if (!/\.pptx?$/i.test(nome)) { const e = new Error("Envie arquivo .ppt ou .pptx."); e.status = 400; throw e; }

      // grava no disco em MODELOS_CHAMADAS_DIR/<chamadaId>/modelo_banner.pptx
      const dir = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
      fs.mkdirSync(dir, { recursive: true });
      const storageKey = `${chamadaId}/modelo_banner${path.extname(nome).toLowerCase() || ".pptx"}`;
      const absPath = resolveStoragePath(storageKey);
      fs.writeFileSync(absPath, f.buffer);

      const tamanho = f.buffer.length;
      const hash = crypto.createHash("sha256").update(f.buffer).digest("hex");
      const userId = req.user?.id ?? req.usuario?.id ?? null;

      const sql = `
        INSERT INTO public.trabalhos_chamadas_modelos
          (chamada_id, nome_arquivo, mime, storage_key, tamanho_bytes, hash_sha256, updated_at, updated_by)
        VALUES
          ($1, $2, $3, $4, $5, $6, NOW(), $7)
        ON CONFLICT (chamada_id) DO UPDATE
        SET nome_arquivo   = EXCLUDED.nome_arquivo,
            mime           = EXCLUDED.mime,
            storage_key    = EXCLUDED.storage_key,
            tamanho_bytes  = EXCLUDED.tamanho_bytes,
            hash_sha256    = EXCLUDED.hash_sha256,
            updated_at     = NOW(),
            updated_by     = EXCLUDED.updated_by
        RETURNING id
      `;
      const params = [chamadaId, nome, mimeIn, storageKey, tamanho, hash, userId];

      if (typeof DB.one === "function") await DB.one(sql, params);
      else if (typeof DB.query === "function") await DB.query(sql, params);
      else throw new Error("DB sem one/query.");

      return res.status(201).json({ ok: true, chamada_id: chamadaId, nome, mime: mimeIn, tamanho });
    } catch (err) { console.error("[chamadas.importarModeloBanner] erro", err); next(err); }
  }
];

/**
 * GET/HEAD /api/chamadas/:id/modelo-banner
 * Ordem: Banco (trabalhos_chamadas_modelos em disco) → Arquivo local (legado) → Link externo (proxy)
 */
exports.baixarModeloPorChamada = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = Number(req.params.id);
    if (!id) { const e = new Error("ID inválido."); e.status = 400; throw e; }

    // ── META MODE (GET ?meta=1)
    if (req.method === "GET" && ("meta" in (req.query || {}))) {
      const metaDb = (typeof DB.oneOrNone === "function")
        ? await DB.oneOrNone(
            `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
               FROM public.trabalhos_chamadas_modelos
              WHERE chamada_id=$1
              ORDER BY updated_at DESC
              LIMIT 1`,
            [id]
          )
        : (await DB.query(
            `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
               FROM public.trabalhos_chamadas_modelos
              WHERE chamada_id=$1
              ORDER BY updated_at DESC
              LIMIT 1`,
            [id]
          )).rows?.[0];

      if (metaDb?.storage_key) {
        const abs = resolveStoragePath(metaDb.storage_key);
        const bytes = (() => { try { return fs.statSync(abs).size; } catch { return metaDb.tamanho_bytes || null; } })();
        return res.json({ exists: true, origin: "db", filename: metaDb.nome_arquivo, mime: metaDb.mime, bytes });
      }

      const local = modeloPathPorChamada(id);
      if (local) return res.json({ exists: true, origin: "fs", filename: local.name, mime: local.type });

      const row = (typeof DB.oneOrNone === "function")
        ? await DB.oneOrNone(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])
        : (await DB.query(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])).rows?.[0];
      const link = row?.link_modelo_poster || null;
      if (isHttpUrl(link)) return res.json({ exists: true, origin: "url", href: link });

      return res.json({ exists: false });
    }

    // ── 1) Banco (storage local)
    const rowDb = (typeof DB.oneOrNone === "function")
      ? await DB.oneOrNone(
          `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
             FROM public.trabalhos_chamadas_modelos
            WHERE chamada_id=$1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [id]
        )
      : (await DB.query(
          `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
             FROM public.trabalhos_chamadas_modelos
            WHERE chamada_id=$1
            ORDER BY updated_at DESC
            LIMIT 1`,
          [id]
        )).rows?.[0];

    if (rowDb?.storage_key) {
      const absPath = resolveStoragePath(rowDb.storage_key);
      try {
        const stat = fs.statSync(absPath);
        const filename = rowDb.nome_arquivo || "modelo_banner.pptx";
        const mimeType = rowDb.mime || mime.lookup(filename) || "application/octet-stream";

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
        res.setHeader("Cache-Control", "public, max-age=60");

        if (req.method === "HEAD") return res.status(200).end();

        const stream = fs.createReadStream(absPath);
        stream.on("error", (e) => {
          console.error("[stream modelo-banner banco] erro:", e);
          if (!res.headersSent) res.status(500).end();
        });
        return stream.pipe(res);
      } catch (e) {
        console.error("[modelo-banner banco] storage_key inválido ou inacessível:", { storage_key: rowDb.storage_key, absPath, err: e?.message });
        // segue para fallbacks
      }
    }

    // ── 2) Arquivo local (legado)
    const local = modeloPathPorChamada(id);
    if (local) {
      const stat = fs.statSync(local.path);
      res.setHeader("Content-Type", local.type);
      res.setHeader("Content-Disposition", `attachment; filename="${local.name}"`);
      res.setHeader("Content-Length", String(stat.size));
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
      res.setHeader("Cache-Control", "public, max-age=60");
      if (req.method === "HEAD") return res.status(200).end();
      const stream = fs.createReadStream(local.path);
      stream.on("error", (e) => {
        console.error("[stream modelobanner] erro:", e);
        if (!res.headersSent) res.status(500).end();
      });
      return stream.pipe(res);
    }

    // ── 3) Link externo (proxy para não violar CSP)
const rowLink = (typeof DB.oneOrNone === "function")
? await DB.oneOrNone(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])
: (await DB.query(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id])).rows?.[0];

const link = rowLink?.link_modelo_poster || null;

if (isHttpUrl(link)) {
// Extrai nome a partir da URL (fallback simples)
const filenameFromUrl = (u) => {
  try {
    const x = new URL(String(u));
    const last = x.pathname.split("/").filter(Boolean).pop();
    return last || "modelo_banner.pptx";
  } catch {
    return "modelo_banner.pptx";
  }
};

// HEAD → não chama o upstream; só devolve cabeçalhos coerentes
if (req.method === "HEAD") {
  const fname = filenameFromUrl(link);
  const mimeType =
    mime.lookup(fname) ||
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  res.setHeader("Content-Type", mimeType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
  );
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  res.setHeader("Cache-Control", "public, max-age=60");
  return res.status(200).end();
}

// GET → proxy do arquivo externo (streaming)
try {
  const _fetch =
    (typeof globalThis.fetch === "function"
      ? globalThis.fetch
      : (await import("node-fetch")).default);

  const upstream = await _fetch(link);
  if (!upstream.ok) {
    return res
      .status(upstream.status)
      .json({ erro: `Falha ao obter modelo (upstream ${upstream.status}).` });
  }

  // Tenta obter filename do header 'content-disposition'; fallback = path da URL
  const cd = typeof upstream.headers.get === "function"
    ? (upstream.headers.get("content-disposition") || "")
    : "";
  const m1 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
  const m2 = /filename="?([^"]+)"?/i.exec(cd);
  const fname = m1
    ? decodeURIComponent(m1[1].trim().replace(/^['"]|['"]$/g, ""))
    : (m2 ? m2[1].trim() : filenameFromUrl(link));

  const mimeType =
    (typeof upstream.headers.get === "function" && upstream.headers.get("content-type")) ||
    mime.lookup(fname) ||
    "application/octet-stream";
  const len = (typeof upstream.headers.get === "function" && upstream.headers.get("content-length")) || null;

  res.setHeader("Content-Type", mimeType);
  if (len) res.setHeader("Content-Length", String(len));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, Content-Length"
  );
  res.setHeader("Cache-Control", "public, max-age=60");

  const { Readable } = require("stream");

  // Node 18+/20/22: body é ReadableStream (web)
  if (upstream.body && typeof Readable.fromWeb === "function" && upstream.body[Symbol.asyncIterator]) {
    Readable.fromWeb(upstream.body).pipe(res);
    return;
  }
  // Caso o adaptador já exponha um stream Node
  if (upstream.body && typeof upstream.body.pipe === "function") {
    upstream.body.pipe(res);
    return;
  }

  // Último recurso: bufferizar (evite arquivos enormes)
  const buf = Buffer.from(await upstream.arrayBuffer());
  return res.end(buf);
} catch (e) {
  console.error("[proxy modelo-banner] erro:", e);
  return res.status(502).json({ erro: "Falha ao proxyar o modelo externo." });
}
}

// ── nada encontrado
if (req.method === "HEAD") return res.status(404).end();
return res.status(404).json({ erro: "Modelo não disponível para esta chamada." });
} catch (err) {
console.error("[chamadas.baixarModeloPorChamada] erro", err);
next(err);
}
};
