// ✅ src/controllers/assinaturaController.js
/* eslint-disable no-console */
const db = require("../db");

/* ————————————————— Configs/tamanhos ————————————————— */
const MAX_DATAURL_TOTAL = 6 * 1024 * 1024; // 6MB: limite para a string toda (prefixo + base64)
const MAX_BASE64_BYTES   = 4 * 1024 * 1024; // 4MB: tamanho só do payload base64 (ajuste se quiser)

/* ————————————————— Helpers gerais ————————————————— */
function getUserId(req) {
  return req.usuario?.id ?? req.user?.id ?? null;
}
function extractBase64Payload(dataUrl) {
  const m = String(dataUrl || "").match(/^data:[^;]+;base64,([\s\S]+)$/);
  return m ? m[1] : null;
}
function normPerfis(p) {
  if (Array.isArray(p)) return p.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  if (typeof p === "string") return p.split(",").map((x) => x.toLowerCase().trim()).filter(Boolean);
  return [];
}
function isInstrOuAdm(perfis) {
  const arr = normPerfis(perfis);
  return arr.includes("instrutor") || arr.includes("administrador");
}

/* ————————————————— Abreviação do nome ————————————————— */
function buildNameVariants(fullName = "") {
  const clean = String(fullName).replace(/\s+/g, " ").trim();
  if (!clean) return { text: "Assinatura" };
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return { text: parts[0] };

  const first = parts[0];
  const last = parts[parts.length - 1];
  return {
    clean,
    opt1: `${first} ${last}`,                     // Nome Sobrenome
    opt2: `${first} ${last[0].toUpperCase()}.`,   // Nome S.
    opt3: `${first[0].toUpperCase()}. ${last}`,   // N. Sobrenome
    opt4: `${first[0].toUpperCase()}. ${last[0].toUpperCase()}.`, // N. S.
  };
}

/* ————————————————— Renderização (node-canvas) —————————————————
   Tenta usar um util dedicado (../utils/signature); se não houver, usa fallback local.
----------------------------------------------------------------- */
let externalRenderSignaturePng = null;
try {
  // se você criou o util `api/utils/signature.js`, ele será usado aqui:
  externalRenderSignaturePng = require("../utils/signature")?.renderSignaturePng || null;
} catch {}

let canvasLib = null;
function requireCanvas() {
  if (canvasLib) return canvasLib;
  // carrega sob demanda (para evitar erro em ambientes sem canvas)
  // eslint-disable-next-line global-require
  canvasLib = require("canvas");
  return canvasLib;
}

const SIGNATURE_CFG = {
  WIDTH: Number(process.env.SIGNATURE_WIDTH || 900),
  HEIGHT: Number(process.env.SIGNATURE_HEIGHT || 300),
  PAD: Number(process.env.SIGNATURE_PADDING || 40),
  FONT_MIN: Number(process.env.SIGNATURE_FONT_MIN || 72),
  FONT_MAX: Number(process.env.SIGNATURE_FONT_MAX || 180),
  FAMILY: process.env.SIGNATURE_FONT_FAMILY || "GreatVibesAuto",
  TTF: process.env.SIGNATURE_FONT_TTF || null, // ex: assets/fonts/GreatVibes-Regular.ttf
  STROKE: process.env.SIGNATURE_STROKE || "#111827",
  FILL: process.env.SIGNATURE_FILL || "#111827",
  SHADOW: process.env.SIGNATURE_SHADOW || "rgba(0,0,0,0.12)",
};

let _fontRegistered = false;
function ensureFontRegistered() {
  if (_fontRegistered) return;
  try {
    if (SIGNATURE_CFG.TTF) {
      const { registerFont } = requireCanvas();
      registerFont(SIGNATURE_CFG.TTF, { family: SIGNATURE_CFG.FAMILY });
      _fontRegistered = true;
    } else {
      _fontRegistered = true; // sem TTF, usa fontes do sistema/fallback
    }
  } catch (e) {
    console.warn("[assinatura] Falha ao registrar fonte cursiva:", e.message);
    _fontRegistered = true;
  }
}

function renderSignatureFallbackPng(nome) {
  const { createCanvas } = requireCanvas();
  ensureFontRegistered();

  const W = SIGNATURE_CFG.WIDTH;
  const H = SIGNATURE_CFG.HEIGHT;
  const PAD = SIGNATURE_CFG.PAD;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const variants = buildNameVariants(nome);
  const opts = [variants.opt1, variants.opt2, variants.opt3, variants.opt4, variants.clean, variants.text].filter(Boolean);
  const maxTextWidth = W - PAD * 2;

  // medição/ajuste de fonte
  function fits(text, size) {
    ctx.font = `${size}px "${SIGNATURE_CFG.FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
    const m = ctx.measureText(text);
    return m.width <= maxTextWidth;
  }
  function pickVariant() {
    // testa com fonte mínima para escolher o mais completo que caiba
    for (const t of opts) { if (fits(t, SIGNATURE_CFG.FONT_MIN)) return t; }
    return opts[opts.length - 1]; // o mais curto
  }
  function pickFontSize(text) {
    let lo = SIGNATURE_CFG.FONT_MIN;
    let hi = SIGNATURE_CFG.FONT_MAX;
    let best = lo;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(text, mid)) { best = mid; lo = mid + 2; } else { hi = mid - 2; }
    }
    return best;
  }

  const text = pickVariant();
  const fontPx = pickFontSize(text);

  // estilo
  ctx.font = `${fontPx}px "${SIGNATURE_CFG.FAMILY}", "Segoe Script", "Snell Roundhand", "Brush Script MT", cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = SIGNATURE_CFG.SHADOW;
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.03));
  ctx.strokeStyle = SIGNATURE_CFG.STROKE;
  ctx.fillStyle = SIGNATURE_CFG.FILL;

  const cx = W / 2;
  const cy = H / 2 + Math.round(fontPx * 0.08);
  ctx.strokeText(text, cx, cy);
  ctx.fillText(text, cx, cy);

  const buffer = c.toBuffer("image/png");
  return { buffer, text, fontPx, mime: "image/png" };
}

function renderSignaturePng(name) {
  if (typeof externalRenderSignaturePng === "function") {
    try { return externalRenderSignaturePng(name); } catch (e) { /* cai no fallback */ }
  }
  return renderSignatureFallbackPng(name);
}

/* ————————————————— Auto-geração e persistência ————————————————— */
async function ensureAutoSignature(usuarioId) {
  // já existe?
  const exists = await db.query(
    "SELECT 1 FROM assinaturas WHERE usuario_id = $1 AND imagem_base64 IS NOT NULL AND imagem_base64 <> '' LIMIT 1",
    [usuarioId]
  );
  if (exists.rows.length > 0) return null; // nada a fazer

  // pega nome + perfis
  const uRes = await db.query(
    `SELECT id, nome, email, perfil, perfis
       FROM usuarios
      WHERE id = $1
      LIMIT 1`,
    [usuarioId]
  );
  const u = uRes.rows?.[0];
  if (!u) return null;

  if (!isInstrOuAdm(u.perfis ?? u.perfil)) {
    // não se aplica
    return null;
  }

  // renderiza PNG e salva como dataURL na sua tabela `assinaturas`
  const displayName = String(u.nome || u.email || `Usuario_${u.id}`).trim();
  const { buffer } = renderSignaturePng(displayName);
  const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

  await db.query(
    `
    INSERT INTO assinaturas (usuario_id, imagem_base64)
    VALUES ($1, $2)
    ON CONFLICT (usuario_id)
    DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
    `,
    [usuarioId, dataUrl]
  );

  return dataUrl;
}

/* ————————————————— Endpoints ————————————————— */

/** 🖋️ GET /api/assinatura — retorna a assinatura do usuário (e auto-gera se instrutor/adm sem assinatura) */
async function getAssinatura(req, res) {
  const usuario_id = getUserId(req);
  if (!usuario_id) return res.status(401).json({ erro: "Usuário não autenticado." });

  try {
    const r = await db.query(
      "SELECT imagem_base64 FROM assinaturas WHERE usuario_id = $1 LIMIT 1",
      [usuario_id]
    );
    let assinatura = r.rows?.[0]?.imagem_base64 || null;

    // se não existir e o usuário for instrutor/administrador → autogerar
    if (!assinatura) {
      try {
        const nova = await ensureAutoSignature(usuario_id);
        if (nova) {
          res.setHeader("X-Assinatura-Autogerada", "1");
          assinatura = nova;
        }
      } catch (e) {
        console.warn("[assinatura][auto] falha ao autogerar:", e?.message);
        // segue silenciosamente — apenas não retorna assinatura
      }
    }

    return res.status(200).json({ assinatura });
  } catch (e) {
    console.error("❌ Erro ao buscar assinatura:", e);
    return res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
}

/** ✍️ POST /api/assinatura — salva/atualiza dataURL enviada pelo usuário (continua igual) */
async function salvarAssinatura(req, res) {
  const usuario_id = getUserId(req);
  const { assinatura } = req.body;

  if (!usuario_id) {
    return res.status(401).json({ erro: "Usuário não autenticado." });
  }
  if (!assinatura || typeof assinatura !== "string") {
    return res.status(400).json({ erro: "Assinatura é obrigatória." });
  }

  // Bloqueia SVG; aceita PNG/JPG/JPEG/WEBP
  const isAllowedDataUrl =
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/.test(assinatura);
  if (!isAllowedDataUrl) {
    return res.status(400).json({
      erro:
        "Assinatura inválida. Envie uma imagem base64 nos formatos PNG, JPG/JPEG ou WEBP.",
    });
  }

  // Limites (string toda e payload base64)
  if (assinatura.length > MAX_DATAURL_TOTAL) {
    return res.status(413).json({ erro: "Imagem muito grande (limite 6MB)." });
  }
  const b64 = extractBase64Payload(assinatura);
  if (!b64) {
    return res.status(400).json({ erro: "Data URL inválida." });
  }
  if (b64.length > MAX_BASE64_BYTES * 1.37) {
    return res.status(413).json({ erro: "Imagem muito grande (payload > 4MB)." });
  }

  const payload = assinatura.trim();

  try {
    // UPSERT (de preferência com UNIQUE em assinaturas(usuario_id))
    try {
      await db.query(
        `
        INSERT INTO assinaturas (usuario_id, imagem_base64)
        VALUES ($1, $2)
        ON CONFLICT (usuario_id)
        DO UPDATE SET imagem_base64 = EXCLUDED.imagem_base64
        `,
        [usuario_id, payload]
      );
    } catch (upsertErr) {
      // Fallback (sem UNIQUE)
      const upd = await db.query(
        "UPDATE assinaturas SET imagem_base64 = $1 WHERE usuario_id = $2",
        [payload, usuario_id]
      );
      if (upd.rowCount === 0) {
        await db.query(
          "INSERT INTO assinaturas (usuario_id, imagem_base64) VALUES ($1, $2)",
          [usuario_id, payload]
        );
      }
    }

    return res.status(200).json({ mensagem: "Assinatura salva com sucesso." });
  } catch (e) {
    console.error("❌ Erro ao salvar assinatura:", {
      message: e?.message,
      code: e?.code,
      detail: e?.detail,
      table: e?.table,
      constraint: e?.constraint,
      stack: e?.stack,
    });
    return res.status(500).json({ erro: "Erro ao salvar assinatura." });
  }
}

/** 📜 GET /api/assinatura/lista — lista metadados (sem imagem) */
async function listarAssinaturas(req, res) {
  try {
    const { rows } = await db.query(
      `
      SELECT a.usuario_id AS id, u.nome, COALESCE(u.cargo, NULL) AS cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: true,
    }));

    return res.json(lista);
  } catch (e) {
    console.error("❌ Erro ao listar assinaturas:", e);
    return res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
}

module.exports = {
  getAssinatura,
  salvarAssinatura,
  listarAssinaturas,
};
