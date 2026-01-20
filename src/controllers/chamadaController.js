/* eslint-disable no-console */
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const url = require("url");
const mime = require("mime-types");
const multer = require("multer");
const crypto = require("crypto");
const { Readable } = require("stream");

// ✅ Paths centralizados
const { MODELOS_CHAMADAS_DIR } = require("../paths");

// ✅ DB robusto (req.db -> fallback)
const rawDb = require("../db");
const DB_FALLBACK = rawDb?.db ?? rawDb;

/* ───────────────────────── Upload em memória ───────────────────────── */
const uploadMem = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* ───────────────────────── Helpers ───────────────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";

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
  return typeof s === "string" && String(s).trim().length > 0 && String(s).trim().length <= max;
}
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isHttpUrl(u) {
  try {
    const x = new url.URL(String(u));
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}
function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// 🔢 Limites
const LIMIT_MIN = 1;
const LIMIT_MAX = 5000;

function isValidLimits(limites) {
  if (!limites) return true;
  const keys = ["titulo", "introducao", "objetivos", "metodo", "resultados", "consideracao"];
  for (const k of keys) {
    const v = Number(limites[k]);
    if (!Number.isInteger(v) || v < LIMIT_MIN || v > LIMIT_MAX) return false;
  }
  return true;
}

/**
 * Normaliza prazo_final_br para inserir no SQL
 * - Se vier com timezone (Z ou +/-hh:mm) -> usa timestamptz
 * - Se vier sem timezone -> interpreta como horário local SP e converte p/ timestamptz
 *
 * ⚠️ Mantém compatibilidade com o schema atual, mas evita ambiguidade
 */
function normalizePrazoFragment(prazo_final_br) {
  const s = String(prazo_final_br || "").trim();

  // ISO com TZ
  const isIsoWithTz = /[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s);
  if (isIsoWithTz) {
    return { fragment: `($$PRAZO$$)::timestamptz`, param: s };
  }

  // Sem TZ: YYYY-MM-DD [HH:MM[:SS]]
  assert(
    /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(s),
    "prazo_final_br inválido."
  );

  const withSec = s.length === 16 ? `${s}:00` : s;

  // Interpreta como local SP e converte para timestamptz
  // (timestamp "local" AT TIME ZONE 'America/Sao_Paulo' => timestamptz)
  return {
    fragment: `( ($$PRAZO$$)::timestamp AT TIME ZONE 'America/Sao_Paulo')`,
    param: withSec,
  };
}

/* =========================
   Paths / Modelo banner legado
========================= */

// MODELOS_CHAMADAS_DIR/<chamadaId>/banner.pptx|ppt
function modeloPathPorChamada(chamadaId) {
  const base = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
  const pptx = path.join(base, "banner.pptx");
  const ppt = path.join(base, "banner.ppt");

  if (fileExists(pptx)) {
    return {
      path: pptx,
      name: "modelo_banner.pptx",
      type:
        mime.lookup(pptx) ||
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  }
  if (fileExists(ppt)) {
    return {
      path: ppt,
      name: "modelo_banner.ppt",
      type: mime.lookup(ppt) || "application/vnd.ms-powerpoint",
    };
  }
  return null;
}

function resolveStoragePath(storageKey) {
  if (!storageKey) return null;
  const key = String(storageKey).replace(/^\/+/, "");
  const abs = path.isAbsolute(key) ? key : path.join(MODELOS_CHAMADAS_DIR, key);

  // hardening: garante que está dentro do MODELOS_CHAMADAS_DIR
  const root = path.resolve(MODELOS_CHAMADAS_DIR);
  const resolved = path.resolve(abs);
  if (!resolved.startsWith(root)) return null;

  return resolved;
}

/* =========================
   DB helpers
========================= */
const getDB = (req) => (req && req.db) ? req.db : DB_FALLBACK;

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
        oneOrNone: async (sql, params) => {
          const r = await DB.query(sql, params);
          return r?.rows?.[0] || null;
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

/* =========================
   Cache helpers
========================= */
function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}
function setPublicCache(res, stat, maxAgeSec = 60) {
  const etag = `"${crypto
    .createHash("sha1")
    .update(`${stat.size}:${stat.mtimeMs}`)
    .digest("hex")}"`;
  res.setHeader("Cache-Control", `public, max-age=${maxAgeSec}`);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length, Last-Modified, ETag");
}
function isNotModified(req, res, stat) {
  const inm = req.headers["if-none-match"];
  if (inm) {
    const now = res.getHeader("ETag");
    if (now && String(inm).trim() === String(now)) {
      res.status(304).end();
      return true;
    }
  }

  const ims = req.headers["if-modified-since"];
  if (ims) {
    const mod = new Date(ims);
    if (!Number.isNaN(mod.getTime()) && stat.mtime <= mod) {
      res.status(304).end();
      return true;
    }
  }
  return false;
}

/* =================================================================== */
/*  Público                                                            */
/* =================================================================== */

exports.listarAtivas = async (req, res, next) => {
  const DB = getDB(req);
  try {
    // ✅ dentro_prazo calculado em horário SP, de forma estável
    // Se prazo_final_br for timestamptz, comparo com now() AT TIME ZONE SP convertido para timestamptz.
    const SQL = `
      SELECT c.*,
             (
               (now() AT TIME ZONE 'America/Sao_Paulo')
               <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
             ) AS dentro_prazo
      FROM trabalhos_chamadas c
      WHERE c.publicado = TRUE
      ORDER BY c.prazo_final_br ASC, c.id ASC
    `;

    if (typeof DB.any === "function") return res.json(await DB.any(SQL));
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) {
    console.error("[chamadas.listarAtivas] erro", err);
    next(err);
  }
};

exports.obterChamada = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const fetchOne = async (sql, params) => {
      if (typeof DB.oneOrNone === "function") return DB.oneOrNone(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0] || null;
      }
      throw new Error("DB não expõe métodos para one/oneOrNone/query.");
    };

    const chamada = await fetchOne(
      `
      SELECT c.*,
             (
               (now() AT TIME ZONE 'America/Sao_Paulo')
               <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
             ) AS dentro_prazo
      FROM trabalhos_chamadas c
      WHERE c.id=$1
      `,
      [id]
    );

    if (!chamada) {
      const e = new Error("Chamada não encontrada.");
      e.status = 404;
      throw e;
    }

    const fetchAny = async (sql, params) => {
      if (typeof DB.any === "function") return DB.any(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows || [];
      }
      throw new Error("DB não expõe métodos para any/query.");
    };

    const [linhas, criterios, criterios_orais] = await Promise.all([
      fetchAny(
        `
        SELECT id, codigo, nome, descricao
        FROM trabalhos_chamada_linhas
        WHERE chamada_id=$1
        ORDER BY nome ASC, id ASC
        `,
        [id]
      ),
      fetchAny(
        `
        SELECT id, ordem, titulo, escala_min, escala_max, peso
        FROM trabalhos_chamada_criterios
        WHERE chamada_id=$1
        ORDER BY ordem
        `,
        [id]
      ),
      fetchAny(
        `
        SELECT id, ordem, titulo, escala_min, escala_max, peso
        FROM trabalhos_chamada_criterios_orais
        WHERE chamada_id=$1
        ORDER BY ordem
        `,
        [id]
      ),
    ]);

    return res.json({
      chamada,
      linhas,
      criterios,
      criterios_orais,
      limites: chamada.limites ?? null,
      criterios_outros: chamada.criterios_outros ?? null,
      oral_outros: chamada.oral_outros ?? null,
      premiacao_texto: chamada.premiacao_texto ?? null,
      disposicao_finais_texto: chamada.disposicao_finais_texto ?? null,
      link_modelo_poster: chamada.link_modelo_poster ?? null,
      aceita_poster: !!chamada.aceita_poster,
    });
  } catch (err) {
    console.error("[chamadas.obterChamada] erro", err);
    next(err);
  }
};

exports.listarTodas = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const SQL = `
      SELECT c.*,
             (
               (now() AT TIME ZONE 'America/Sao_Paulo')
               <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
             ) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.criado_em DESC, c.id DESC
    `;

    if (typeof DB.any === "function") return res.json(await DB.any(SQL));
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) {
    console.error("[chamadas.listarTodas] erro", err);
    next(err);
  }
};

/* =================================================================== */
/*  Admin (CRUD)                                                       */
/* =================================================================== */

exports.criar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const body = req.body || {};

    const titulo = String(body.titulo || "").trim();
    const descricao_markdown = body.descricao_markdown;
    const periodo_experiencia_inicio = body.periodo_experiencia_inicio;
    const periodo_experiencia_fim = body.periodo_experiencia_fim;

    const prazo_final_br = body.prazo_final_br;

    const aceita_poster = body.aceita_poster !== false; // default true
    const link_modelo_poster = body.link_modelo_poster || null;

    const max_coautores = Number(body.max_coautores || 10);
    const publicado = !!body.publicado;

    const linhas = Array.isArray(body.linhas) ? body.linhas : [];
    const criterios = Array.isArray(body.criterios) ? body.criterios : [];

    // compat: "critérios_orais" ou "criterios_orais"
    const criterios_orais_in =
      Array.isArray(body.criterios_orais) ? body.criterios_orais :
      Array.isArray(body["critérios_orais"]) ? body["critérios_orais"] :
      [];

    const limites = body.limites ?? null;
    const criterios_outros = body.criterios_outros ?? null;
    const oral_outros = body.oral_outros ?? null;
    const premiacao_texto = body.premiacao_texto ?? null;
    const disposicao_finais_texto = body.disposicao_finais_texto ?? null;

    // Validações
    assert(withinLen(titulo, 200), "Título é obrigatório (≤ 200).");
    assert(descricao_markdown && String(descricao_markdown).trim().length, "Descrição é obrigatória.");
    assert(isYYYYMM(periodo_experiencia_inicio), "Período início deve ser YYYY-MM.");
    assert(isYYYYMM(periodo_experiencia_fim), "Período fim deve ser YYYY-MM.");
    assert(periodo_experiencia_inicio <= periodo_experiencia_fim, "Período inválido (início > fim).");
    assert(prazo_final_br, "Prazo final é obrigatório.");
    assert(isValidLimits(limites), `Limites inválidos (${LIMIT_MIN}–${LIMIT_MAX}).`);

    const userId = req.user?.id ?? req.usuario?.id;
    assert(userId, "Autenticação necessária.");

    const norm = normalizePrazoFragment(prazo_final_br);

    await withTx(DB, async (t) => {
      const nova = await t.one(
        `
        INSERT INTO trabalhos_chamadas
          (titulo, descricao_markdown, periodo_experiencia_inicio, periodo_experiencia_fim,
           prazo_final_br, aceita_poster, link_modelo_poster, max_coautores, publicado, criado_por,
           limites, criterios_outros, oral_outros, premiacao_texto, disposicao_finais_texto)
        VALUES
          ($1,$2,$3,$4, ${norm.fragment.replace("$$PRAZO$$", "$5")} ,$6,$7,$8,$9,$10,
           $11,$12,$13,$14,$15)
        RETURNING id
        `,
        [
          titulo,
          descricao_markdown,
          periodo_experiencia_inicio,
          periodo_experiencia_fim,
          norm.param,
          !!aceita_poster,
          link_modelo_poster,
          Number.isFinite(max_coautores) ? max_coautores : 10,
          !!publicado,
          userId,
          limites ? JSON.stringify(limites) : null,
          criterios_outros,
          oral_outros,
          premiacao_texto,
          disposicao_finais_texto,
        ]
      );

      // Linhas
      for (const l of linhas) {
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

      // Critérios escritos
      for (const [idx, c] of criterios.entries()) {
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

      // Critérios orais
      for (const [idx, c] of criterios_orais_in.entries()) {
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

      res.status(201).json({ ok: true, id: nova.id });
    });
  } catch (err) {
    console.error("[chamadas.criar] erro", err);
    next(err);
  }
};

exports.atualizar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const body = req.body || {};

    const cols = [
      "titulo",
      "descricao_markdown",
      "periodo_experiencia_inicio",
      "periodo_experiencia_fim",
      "prazo_final_br",
      "aceita_poster",
      "link_modelo_poster",
      "max_coautores",
      "publicado",
      "limites",
      "criterios_outros",
      "oral_outros",
      "premiacao_texto",
      "disposicao_finais_texto",
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
        set.push(`${c} = $${vals.length}`);
      }

      if (
        Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_inicio") &&
        Object.prototype.hasOwnProperty.call(body, "periodo_experiencia_fim")
      ) {
        assert(body.periodo_experiencia_inicio <= body.periodo_experiencia_fim, "Período inválido.");
      }

      if (set.length) {
        vals.push(id);
        await t.none(
          `UPDATE trabalhos_chamadas SET ${set.join(", ")}, atualizado_em = NOW() WHERE id = $${vals.length}`,
          vals
        );
      }

      if (Array.isArray(body.linhas)) {
        await t.none(`DELETE FROM trabalhos_chamada_linhas WHERE chamada_id = $1`, [id]);
        for (const l of body.linhas) {
          assert(l?.nome, "Linha temática exige nome.");
          await t.none(
            `INSERT INTO trabalhos_chamada_linhas (chamada_id, codigo, nome, descricao)
             VALUES ($1,$2,$3,$4)`,
            [id, l.codigo ? String(l.codigo).trim() : null, String(l.nome).trim(), l.descricao || null]
          );
        }
      }

      if (Array.isArray(body.criterios)) {
        await t.none(`DELETE FROM trabalhos_chamada_criterios WHERE chamada_id = $1`, [id]);
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
        await t.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id = $1`, [id]);
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
  } catch (err) {
    console.error("[chamadas.atualizar] erro", err);
    next(err);
  }
};

exports.publicar = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const publicado = req.body?.publicado !== undefined ? !!req.body.publicado : true;

    const fetchOne = async (sql, params) => {
      if (typeof DB.one === "function") return DB.one(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0];
      }
      throw new Error("DB não expõe métodos para one/query.");
    };

    if (publicado === true) {
      const row = await fetchOne(
        `
        SELECT
          (SELECT COUNT(*) FROM trabalhos_chamada_linhas    WHERE chamada_id=$1) AS linhas,
          (SELECT COUNT(*) FROM trabalhos_chamada_criterios WHERE chamada_id=$1) AS criterios
        `,
        [id]
      );

      assert(Number(row.linhas) > 0, "Inclua ao menos 1 linha temática antes de publicar.");
      assert(Number(row.criterios) > 0, "Inclua ao menos 1 critério de avaliação antes de publicar.");
    }

    if (typeof DB.none === "function") {
      await DB.none(`UPDATE trabalhos_chamadas SET publicado=$1, atualizado_em=NOW() WHERE id=$2`, [publicado, id]);
    } else if (typeof DB.query === "function") {
      await DB.query(`UPDATE trabalhos_chamadas SET publicado=$1, atualizado_em=NOW() WHERE id=$2`, [publicado, id]);
    } else {
      throw new Error("DB não expõe método para UPDATE (none/query).");
    }

    res.json({ ok: true, publicado });
  } catch (err) {
    console.error("[chamadas.publicar] erro", err);
    next(err);
  }
};

exports.listarAdmin = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const SQL = `
      SELECT c.*,
             (
               (now() AT TIME ZONE 'America/Sao_Paulo')
               <= (c.prazo_final_br AT TIME ZONE 'America/Sao_Paulo')
             ) AS dentro_prazo
      FROM trabalhos_chamadas c
      ORDER BY c.prazo_final_br ASC, c.id DESC
    `;

    if (typeof DB.any === "function") return res.json(await DB.any(SQL));
    if (typeof DB.query === "function") {
      const r = await DB.query(SQL);
      return res.json(r?.rows || []);
    }
    throw new Error("DB não expõe métodos de leitura (any/query).");
  } catch (err) {
    console.error("[chamadas.listarAdmin] erro", err);
    next(err);
  }
};

exports.remover = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    await withTx(DB, async (t) => {
      await t.none(`DELETE FROM trabalhos_chamada_criterios_orais WHERE chamada_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_criterios      WHERE chamada_id=$1`, [id]);
      await t.none(`DELETE FROM trabalhos_chamada_linhas         WHERE chamada_id=$1`, [id]);

      const del = await t.oneOrNone(`DELETE FROM trabalhos_chamadas WHERE id=$1 RETURNING id`, [id]);
      if (!del) {
        const e = new Error("Chamada não encontrada.");
        e.status = 404;
        throw e;
      }

      res.json({ ok: true, id });
    });
  } catch (err) {
    console.error("[chamadas.remover] erro", err);
    next(err);
  }
};

/* =================================================================== */
/*  EXPORTAÇÃO DO MODELO PADRÃO (legado/global)                         */
/* =================================================================== */

function resolveBannerPadraoPath() {
  const candidates = [
    path.join(process.cwd(), "assets", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "public", "modelos", "banner-padrao.pptx"),
    path.join(process.cwd(), "api", "assets", "modelos", "banner-padrao.pptx"),
    path.join(__dirname, "..", "..", "assets", "modelos", "banner-padrao.pptx"),
  ];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

exports.exportarModeloBanner = async (req, res, next) => {
  try {
    const filePath = resolveBannerPadraoPath();
    if (!filePath) {
      const e = new Error("Modelo de banner não encontrado no servidor.");
      e.status = 404;
      throw e;
    }

    const stat = await fsp.stat(filePath);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent("modelo_banner.pptx")}`
    );
    res.setHeader("Content-Length", String(stat.size));

    // cache curto (public)
    setPublicCache(res, stat, 3600);
    if (isNotModified(req, res, stat)) return;

    const stream = fs.createReadStream(filePath);
    stream.on("error", (e) => {
      console.error("[exportarModeloBanner stream] erro:", e);
      if (!res.headersSent) res.status(500).end();
    });
    return stream.pipe(res);
  } catch (err) {
    console.error("[chamadas.exportarModeloBanner] erro", err);
    next(err);
  }
};

/* =================================================================== */
/*  LEGADO: Modelo por CHAMADA (mantido compat)                         */
/*  OBS: você já moveu para chamadasModeloRoutes.js                     */
/* =================================================================== */

exports.modeloBannerMeta = async (req, res, next) => {
  const DB = getDB(req);
  try {
    setNoStore(res);

    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const oneOrNone = async (sql, params) => {
      if (typeof DB.oneOrNone === "function") return DB.oneOrNone(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0] || null;
      }
      throw new Error("DB não expõe métodos para oneOrNone/query.");
    };

    // 1) banco
    const metaDb = await oneOrNone(
      `SELECT nome_arquivo, mime, storage_key, tamanho_bytes
         FROM public.trabalhos_chamadas_modelos
        WHERE chamada_id=$1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [id]
    );

    if (metaDb?.storage_key) {
      const abs = resolveStoragePath(metaDb.storage_key);
      const exists = abs ? fs.existsSync(abs) : false;
      const bytes = (() => {
        try { return abs ? fs.statSync(abs).size : null; } catch { return metaDb.tamanho_bytes || null; }
      })();

      if (exists) {
        return res.json({
          exists: true,
          origin: "db",
          filename: metaDb.nome_arquivo || "modelo_banner.pptx",
          mime: metaDb.mime || mime.lookup(metaDb.nome_arquivo || "") || "application/octet-stream",
          bytes,
        });
      }
    }

    // 2) fs (legado)
    const local = modeloPathPorChamada(id);
    if (local) {
      const stat = fs.statSync(local.path);
      return res.json({
        exists: true,
        origin: "fs",
        filename: local.name,
        mime: local.type,
        bytes: stat.size,
      });
    }

    // 3) link externo
    const rowLink = await oneOrNone(`SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`, [id]);
    const link = rowLink?.link_modelo_poster || null;
    if (isHttpUrl(link)) return res.json({ exists: true, origin: "url", href: link });

    return res.json({ exists: false });
  } catch (err) {
    console.error("[chamadas.modeloBannerMeta] erro", err);
    next(err);
  }
};

exports.importarModeloBanner = [
  uploadMem.single("banner"),
  async (req, res, next) => {
    const DB = getDB(req);
    try {
      setNoStore(res);

      const chamadaId = toIntId(req.params.id);
      assert(chamadaId, "ID inválido.");

      const f = req.file;
      assert(f, "Arquivo obrigatório (campo 'banner').");

      const nome = f.originalname || "modelo_banner.pptx";
      assert(/\.pptx?$/i.test(nome), "Envie arquivo .ppt ou .pptx.");

      const ext = path.extname(nome).toLowerCase();
      const mimeIn = f.mimetype || mime.lookup(nome) || "application/octet-stream";

      // grava no disco: MODELOS_CHAMADAS_DIR/<chamadaId>/modelo_banner(.pptx|.ppt)
      const dir = path.join(MODELOS_CHAMADAS_DIR, String(chamadaId));
      fs.mkdirSync(dir, { recursive: true });

      const storageKey = `${chamadaId}/modelo_banner${ext || ".pptx"}`;
      const absPath = resolveStoragePath(storageKey);
      assert(absPath, "Caminho de armazenamento inválido.");

      // write atômico (premium): tmp + rename
      const tmp = absPath + ".tmp";
      await fsp.writeFile(tmp, f.buffer);
      await fsp.rename(tmp, absPath);

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

      if (typeof DB.one === "function") await DB.one(sql, [chamadaId, nome, mimeIn, storageKey, tamanho, hash, userId]);
      else if (typeof DB.query === "function") await DB.query(sql, [chamadaId, nome, mimeIn, storageKey, tamanho, hash, userId]);
      else throw new Error("DB sem one/query.");

      return res.status(201).json({ ok: true, chamada_id: chamadaId, nome, mime: mimeIn, tamanho });
    } catch (err) {
      console.error("[chamadas.importarModeloBanner] erro", err);
      next(err);
    }
  },
];

/**
 * GET/HEAD /api/chamadas/:id/modelo-banner
 * Ordem: Banco -> Arquivo local -> Link externo (proxy)
 * ⚠️ LEGADO (você já moveu para chamadasModeloRoutes.js)
 */
exports.baixarModeloPorChamada = async (req, res, next) => {
  const DB = getDB(req);
  try {
    const id = toIntId(req.params.id);
    assert(id, "ID inválido.");

    const oneOrNone = async (sql, params) => {
      if (typeof DB.oneOrNone === "function") return DB.oneOrNone(sql, params);
      if (typeof DB.query === "function") {
        const r = await DB.query(sql, params);
        return r?.rows?.[0] || null;
      }
      throw new Error("DB não expõe métodos para oneOrNone/query.");
    };

    // 1) Banco
    const rowLink =
      typeof DB.oneOrNone === "function"
        ? await DB.oneOrNone(
            `SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`,
            [id]
          )
        : (await DB.query(
            `SELECT link_modelo_poster FROM trabalhos_chamadas WHERE id=$1`,
            [id]
          )).rows?.[0];

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

      // HEAD → não chama upstream; só devolve cabeçalhos coerentes
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
          typeof globalThis.fetch === "function"
            ? globalThis.fetch
            : (await import("node-fetch")).default;

        const upstream = await _fetch(link);
        if (!upstream.ok) {
          return res
            .status(upstream.status)
            .json({ erro: `Falha ao obter modelo (upstream ${upstream.status}).` });
        }

        // filename: tenta pegar do content-disposition; fallback = URL
        const cd =
          typeof upstream.headers?.get === "function"
            ? upstream.headers.get("content-disposition") || ""
            : "";

        const m1 = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
        const m2 = /filename="?([^"]+)"?/i.exec(cd);

        const fname = m1
          ? decodeURIComponent(m1[1].trim().replace(/^['"]|['"]$/g, ""))
          : m2
          ? m2[1].trim()
          : filenameFromUrl(link);

        const mimeType =
          (typeof upstream.headers?.get === "function" &&
            upstream.headers.get("content-type")) ||
          mime.lookup(fname) ||
          "application/octet-stream";

        const len =
          typeof upstream.headers?.get === "function"
            ? upstream.headers.get("content-length")
            : null;

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

        // Node 18+/20+/22: upstream.body é web ReadableStream
        if (upstream.body && typeof Readable.fromWeb === "function") {
          Readable.fromWeb(upstream.body).pipe(res);
          return;
        }

        // se já vier como stream Node
        if (upstream.body && typeof upstream.body.pipe === "function") {
          upstream.body.pipe(res);
          return;
        }

        // último recurso: buffer
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
    return next(err);
  }
};
