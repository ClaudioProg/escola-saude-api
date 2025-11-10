/* eslint-disable no-console */
// ✅ src/controllers/eventosController.js
const path = require("path");
const fs = require("fs");
const { pool, query } = require("../db");
const multer = require("multer");
const {
  normalizeRegistro,
  normalizeListaRegistros,
} = require("../utils/registro");

/* =====================================================================
   Upload (folder.png/jpg e programacao.pdf)
   ===================================================================== */
   const { EVENTOS_DIR } = require("../paths");
   const UP_BASE = EVENTOS_DIR;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UP_BASE),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "arquivo", ext)
      .replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (file.fieldname === "folder" && ![".png", ".jpg", ".jpeg"].includes(ext)) {
      return cb(new Error("Imagem do folder deve ser PNG/JPG"));
    }
    if (file.fieldname === "programacao" && ext !== ".pdf") {
      return cb(new Error("Arquivo de programação deve ser PDF"));
    }
    cb(null, true);
  },
});
/** Use este middleware nas rotas de criar/atualizar */
const uploadEventos = upload.fields([
  { name: "folder", maxCount: 1 },
  { name: "programacao", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// 🔓 Visibilidade 100% livre (sem validações de combinação)
function sanitizeVisibilidade(body) {
  const restrito = !!body.restrito;
  const modo = restrito ? (body.restrito_modo ?? null) : null;

  // Se NÃO restrito: tudo vira NULL
  if (!restrito) {
    return {
      restrito: false,
      restrito_modo: null,
      registros_permitidos: null,
      cargos_permitidos: null,
      unidades_permitidas: null,
    };
  }

  // Se restrito: só repasse o que vier, sem impor defaults
  return {
    restrito: true,
    restrito_modo: modo, // pode ser null, 'lista_registros', 'cargos', 'unidades'… tanto faz
    registros_permitidos: Array.isArray(body.registros_permitidos) ? body.registros_permitidos : null,
    cargos_permitidos:    Array.isArray(body.cargos_permitidos)    ? body.cargos_permitidos    : null,
    unidades_permitidas:  Array.isArray(body.unidades_permitidas)  ? body.unidades_permitidas  : null,
  };
}

/* =====================================================================
   Helpers resilientes ao schema
   ===================================================================== */
function isMissingRelationOrColumn(err) {
  const c = err && (err.code || err?.original?.code);
  return c === "42P01" /* relation not found */ || c === "42703" /* column not found */;
}
async function execIgnoreMissing(client, sql, params = []) {
  try {
    return await client.query(sql, params);
  } catch (e) {
    if (isMissingRelationOrColumn(e)) return { rows: [], rowCount: 0 };
    throw e;
  }
}
async function tryQueryWithFallback(client, primary, fallback) {
  try {
    return await client.query(primary.text, primary.values || []);
  } catch (e) {
    if (e.code === "42703") {
      return await client.query(fallback.text, fallback.values || []);
    }
    throw e;
  }
}

/* =====================================================================
   Helpers de datas/horários (sem “pulo” de fuso)
   ===================================================================== */
function hhmm(s, fb = "") {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || "";
}
function toYmd(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}
function toHm(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 5);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
const toIntArray = (v) =>
  Array.isArray(v) ? v.map((n) => Number(n)).filter(Number.isFinite) : [];

/* =====================================================================
   Helpers de perfis e usuário
   ===================================================================== */
const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";

function getPerfisFromReq(req) {
  const raw = req.user?.perfil ?? req.user?.perfis ?? [];
  if (Array.isArray(raw)) return raw.map((p) => String(p).toLowerCase());
  return String(raw)
    .split(",")
    .map((p) => p.replace(/[\[\]"]/g, "").trim().toLowerCase())
    .filter(Boolean);
}
function isAdmin(req) {
  return getPerfisFromReq(req).includes("administrador");
}
const getUsuarioId = (req) => req.user?.id ?? null;

/* =====================================================================
   🔐 Regra de visibilidade
   ===================================================================== */
async function podeVerEvento({ client, usuarioId, eventoId, req }) {
  const admin = isAdmin(req);

  const evQ = await client.query(
    `SELECT id, restrito, restrito_modo, publicado,
            COALESCE(cargos_permitidos_ids, '{}')   AS cargos_permitidos_ids,
            COALESCE(unidades_permitidas_ids, '{}') AS unidades_permitidas_ids
       FROM eventos
      WHERE id=$1`,
    [eventoId]
  );
  const evento = evQ.rows[0];
  if (!evento) return { ok: false, motivo: "EVENTO_NAO_ENCONTRADO" };
  if (!admin && !evento.publicado) return { ok: false, motivo: "NAO_PUBLICADO" };
  if (admin || !evento.restrito) return { ok: true };
  if (!usuarioId) return { ok: false, motivo: "NAO_AUTENTICADO" };

  const uQ = await client.query(
    `SELECT registro, cargo_id, unidade_id
       FROM usuarios
      WHERE id=$1`,
    [usuarioId]
  );
  const usuario = uQ.rows?.[0] || {};
  const regNorm = normalizeRegistro(usuario.registro || "");
  const cargoId = Number(usuario.cargo_id) || null;
  const unidadeId = usuario.unidade_id ?? null;

  // Retrocompat: registro
  if (evento.restrito_modo === MODO_TODOS) {
    if (regNorm) return { ok: true };
  }
  if (evento.restrito_modo === MODO_LISTA) {
    if (regNorm) {
      const hit = await client.query(
        `SELECT 1 FROM evento_registros WHERE evento_id=$1 AND registro_norm=$2 LIMIT 1`,
        [eventoId, regNorm]
      );
      if (hit.rowCount > 0) return { ok: true };
    }
  }

  // Arrays (modelo novo)
  const cargosIdsPermitidos = evento.cargos_permitidos_ids || [];
  const unidadesIdsPermitidas = evento.unidades_permitidas_ids || [];

  if (cargoId && cargosIdsPermitidos.includes(cargoId)) return { ok: true };
  if (unidadeId != null && unidadesIdsPermitidas.includes(unidadeId)) return { ok: true };

  return { ok: false, motivo: "SEM_PERMISSAO" };
}

/* =====================================================================
   🚀 Publicar / Despublicar
   ===================================================================== */
async function publicarEvento(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  try {
    const r = await query(
      `UPDATE eventos SET publicado=TRUE WHERE id=$1 RETURNING id, publicado`,
      [id]
    );
    if (r.rowCount === 0)
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    return res.json({
      ok: true,
      mensagem: "Evento publicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    console.error("publicarEvento erro:", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}
async function despublicarEvento(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  const id = Number(req.params.id);
  if (!Number.isFinite(id))
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  try {
    const r = await query(
      `UPDATE eventos SET publicado=FALSE WHERE id=$1 RETURNING id, publicado`,
      [id]
    );
    if (r.rowCount === 0)
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    return res.json({
      ok: true,
      mensagem: "Evento despublicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    console.error("despublicarEvento erro:", e);
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

/* =====================================================================
   Utilitários de extração / upload
   ===================================================================== */
function extrairDatasDaTurma(t) {
  if (Array.isArray(t?.datas) && t.datas.length) {
    return t.datas.map((d) => ({
      data: toYmd(d?.data),
      horario_inicio: hhmm(d?.horario_inicio || ""),
      horario_fim: hhmm(d?.horario_fim || ""),
    }));
  }
  if (Array.isArray(t?.encontros) && t.encontros.length) {
    return t.encontros.map((e) =>
      typeof e === "string"
        ? { data: toYmd(e), horario_inicio: null, horario_fim: null }
        : {
            data: toYmd(e?.data),
            horario_inicio: hhmm(e?.inicio || ""),
            horario_fim: hhmm(e?.fim || ""),
          }
    );
  }
  return [];
}
function pegarUploadUrl(req, field) {
  const f = req.files?.[field]?.[0] || req.files?.file?.[0];
  if (!f) return null;
  return `/uploads/eventos/${path.basename(f.path)}`;
}

/* =====================================================================
   📄 Listar todos os eventos (resumo)
   ===================================================================== */
async function listarEventos(req, res) {
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  const richSQL = `
    WITH minhas_turmas AS (
      SELECT DISTINCT t.evento_id
      FROM turmas t
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      WHERE ti.instrutor_id = $2
    )
    SELECT 
      e.*,

      COALESCE((
        SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
        FROM evento_registros er WHERE er.evento_id = e.id
      ), '{}'::text[]) AS registros_permitidos,
      (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id) AS count_registros_permitidos,

      e.cargos_permitidos_ids,
      e.unidades_permitidas_ids,

      COALESCE((
        SELECT json_agg(json_build_object('id', c.id, 'nome', c.nome) ORDER BY c.nome)
        FROM cargos c
        WHERE c.id = ANY(e.cargos_permitidos_ids)
      ), '[]'::json) AS cargos_permitidos,

      COALESCE((
        SELECT json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
        FROM turmas t2
        JOIN turma_instrutor ti2 ON ti2.turma_id = t2.id
        JOIN usuarios u ON u.id = ti2.instrutor_id
        WHERE t2.evento_id = e.id
      ), '[]'::json) AS instrutor,

      COALESCE((
        SELECT json_agg(json_build_object('id', u2.id, 'nome', u2.nome) ORDER BY u2.nome)
        FROM unidades u2
        WHERE u2.id = ANY(e.unidades_permitidas_ids)
      ), '[]'::json) AS unidades_permitidas,

      (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
      (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
      (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
      (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,

      CASE
        WHEN CURRENT_TIMESTAMP::timestamp < (
          SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= (
          SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,

      (
        SELECT COUNT(*) > 0
        FROM inscricoes i
        JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1 AND t.evento_id = e.id
      ) AS ja_inscrito,

      (
        SELECT COUNT(*) > 0
        FROM turmas t
        JOIN turma_instrutor ti ON ti.turma_id = t.id
        WHERE t.evento_id = e.id AND ti.instrutor_id = $2
      ) AS ja_instrutor

    FROM eventos e
    WHERE ${admin ? "TRUE" : "(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM minhas_turmas))"}
    ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
              FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
             e.id DESC;
  `;

  const compatSQL = `
    SELECT
      e.*,
      (SELECT MIN(t.data_inicio) FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
      (SELECT MAX(t.data_fim)    FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
      (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
      (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
      CASE
        WHEN CURRENT_TIMESTAMP::timestamp < (
          SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= (
          SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id
        ) THEN 'andamento'
        ELSE 'encerrado'
      END AS status
    FROM eventos e
    ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
              FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
             e.id DESC;
  `;

  try {
    const r = await query(richSQL, [usuarioId, usuarioId]);
    return res.json(r.rows);
  } catch (err) {
    const pgCode = err && (err.code || err?.original?.code);
    const isMissingRel = pgCode === "42P01";
    const isMissingCol = pgCode === "42703";
    if (isMissingRel || isMissingCol) {
      try {
        const r2 = await query(compatSQL, []);
        return res.json(r2.rows);
      } catch (err2) {
        console.error("listarEventos compat erro:", err2.stack || err2.message);
        return res
          .status(500)
          .json({ erro: "Erro ao listar eventos (compat)" });
      }
    }
    console.error("listarEventos erro:", err.stack || err.message);
    return res.status(500).json({ erro: "Erro ao listar eventos" });
  }
}

/* =====================================================================
   🆕 Listar “para mim”
   ===================================================================== */
async function listarEventosParaMim(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId)
    return res.status(401).json({ ok: false, erro: "NAO_AUTENTICADO" });

  const client = await pool.connect();
  try {
    const { rows: base } = await client.query(
      `SELECT id FROM eventos WHERE publicado = TRUE`
    );

    const visiveis = [];
    for (const r of base) {
      const pode = await podeVerEvento({
        client,
        usuarioId,
        eventoId: r.id,
        req,
      });
      if (pode.ok) visiveis.push(r.id);
    }
    if (visiveis.length === 0) return res.json({ ok: true, eventos: [] });

    const sql = `
      SELECT 
        e.*,

        COALESCE((SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
                  FROM evento_registros er WHERE er.evento_id = e.id),'{}'::text[]) AS registros_permitidos,
        (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id) AS count_registros_permitidos,

        e.cargos_permitidos_ids,
        e.unidades_permitidas_ids,
        COALESCE((
          SELECT json_agg(json_build_object('id', c.id, 'nome', c.nome) ORDER BY c.nome)
          FROM cargos c
          WHERE c.id = ANY(e.cargos_permitidos_ids)
        ), '[]'::json) AS cargos_permitidos,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'nome', u.nome) ORDER BY u.nome)
          FROM unidades u
          WHERE u.id = ANY(e.unidades_permitidas_ids)
        ), '[]'::json) AS unidades_permitidas,

        (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
        (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
        (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
        (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,

        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < (
            SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= (
            SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status

      FROM eventos e
      WHERE e.id = ANY($1::int[])
      ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
                FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
               e.id DESC;
    `;
    const { rows } = await client.query(sql, [visiveis]);
    return res.json({ ok: true, eventos: rows });
  } catch (err) {
    console.error("listarEventosParaMim erro:", err);
    return res.status(500).json({ ok: false, erro: "ERRO_INTERNO" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ➕ Criar evento
   ===================================================================== */
async function criarEvento(req, res) {
  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,

    turmas = [], // [{ nome, vagas_total, carga_horaria, datas|encontros, instrutores: [id,...], instrutor_assinante_id }]
    restrito = false,
    restrito_modo = null, // 'todos_servidores' | 'lista_registros'
    registros,
    registros_permitidos, // retrocompat

    cargos_permitidos, // [cargo_id,...]
    unidades_permitidas, // [unidade_id,...]
  } = req.body || {};

  if (!titulo?.trim())
    return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  if (!local?.trim())
    return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  if (!tipo?.trim())
    return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  if (!unidade_id)
    return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });
  if (!Array.isArray(turmas) || turmas.length === 0)
    return res
      .status(400)
      .json({ erro: "Ao menos uma turma deve ser criada." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const folderUrl = pegarUploadUrl(req, "folder"); // png/jpg
    const progPdfUrl = pegarUploadUrl(req, "programacao"); // pdf

    const evIns = await client.query(
      `INSERT INTO eventos (
         titulo, descricao, local, tipo, unidade_id, publico_alvo,
         restrito, restrito_modo, publicado, folder_url, programacao_pdf_url,
         cargos_permitidos_ids, unidades_permitidas_ids
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12)
       RETURNING *`,
      [
        titulo.trim(),
        (descricao || "").trim(),
        local.trim(),
        tipo.trim(),
        unidade_id,
        (publico_alvo || "").trim(),
        !!restrito,
        restrito ? restrito_modo || null : null,
        folderUrl,
        progPdfUrl,
        toIntArray(cargos_permitidos),
        toIntArray(unidades_permitidas),
      ]
    );
    const evento = evIns.rows[0];
    const eventoId = evento.id;

    // Retrocompat: registros (modo lista)
    if (restrito && restrito_modo === MODO_LISTA) {
      const input =
        typeof registros_permitidos !== "undefined"
          ? registros_permitidos
          : registros;
      const regList = normalizeListaRegistros(input);
      for (const r of regList) {
        await client.query(
          `INSERT INTO evento_registros (evento_id, registro_norm)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [eventoId, r]
        );
      }
    }

    // Sincroniza tabelas legadas (se existirem)
    await execIgnoreMissing(
      client,
      `DELETE FROM evento_cargos WHERE evento_id=$1`,
      [eventoId]
    );
    for (const cid of toIntArray(cargos_permitidos)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_cargos (evento_id, cargo)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, String(cid)]
      );
    }
    await execIgnoreMissing(
      client,
      `DELETE FROM evento_unidades WHERE evento_id=$1`,
      [eventoId]
    );
    for (const uid of toIntArray(unidades_permitidas)) {
      await execIgnoreMissing(
        client,
        `INSERT INTO evento_unidades (evento_id, unidade_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [eventoId, uid]
      );
    }

    // Turmas
    for (const t of turmas) {
      const nome = String(t.nome || "Turma").trim();
      const vagas_total = Number.isFinite(Number(t.vagas_total))
        ? Number(t.vagas_total)
        : null;
      const carga_horaria = Number.isFinite(Number(t.carga_horaria))
        ? Number(t.carga_horaria)
        : null;

      const baseDatas = extrairDatasDaTurma(t);
      const ordenadas = [...baseDatas]
        .filter((d) => d.data)
        .sort((a, b) => a.data.localeCompare(b.data));
      const data_inicio = ordenadas[0]?.data || null;
      const data_fim = ordenadas.at(-1)?.data || data_inicio || null;

      const hiPayload = hhmm(t?.horario_inicio || "") || null;
      const hfPayload = hhmm(t?.horario_fim || "") || null;

      // INSERT turmas com fallback para ausência de coluna instrutor_assinante_id
      const tryIns = await tryQueryWithFallback(
        client,
        {
          text: `INSERT INTO turmas (
                   evento_id, nome, vagas_total, carga_horaria,
                   data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                 RETURNING id`,
          values: [
            eventoId,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            hiPayload,
            hfPayload,
            null,
          ],
        },
        {
          text: `INSERT INTO turmas (
                   evento_id, nome, vagas_total, carga_horaria,
                   data_inicio, data_fim, horario_inicio, horario_fim
                 )
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 RETURNING id`,
          values: [
            eventoId,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            hiPayload,
            hfPayload,
          ],
        }
      );
      const turmaId = tryIns.rows[0].id;

      for (const d of ordenadas) {
        const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
        const fimSeguro = d.horario_fim || hfPayload || "17:00";
        await client.query(
          `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
           VALUES ($1,$2,$3,$4)`,
          [turmaId, d.data, inicioSeguro, fimSeguro]
        );
      }

      const instrutores = Array.isArray(t?.instrutores) ? t.instrutores : [];
      for (const instrutorId of instrutores) {
        await client.query(
          `INSERT INTO turma_instrutor (turma_id, instrutor_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [turmaId, instrutorId]
        );
      }

      // Definir assinante (se a coluna existir)
      if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
        const assinanteId = Number(t.instrutor_assinante_id);
        if (instrutores.includes(assinanteId)) {
          await execIgnoreMissing(
            client,
            `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
            [turmaId, assinanteId]
          );
        }
      }
    }

    await client.query("COMMIT");
    return res
      .status(201)
      .json({ mensagem: "Evento criado com sucesso", evento });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("criarEvento erro:", err);
    return res.status(500).json({ erro: "Erro ao criar evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar por ID (com listas, turmas e flags)
   ===================================================================== */
async function buscarEventoPorId(req, res) {
  const { id } = req.params;
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);
  const client = await pool.connect();

  try {
    const eventoResult = await client.query(
      `SELECT * FROM eventos WHERE id=$1`,
      [id]
    );
    if (eventoResult.rowCount === 0)
      return res.status(404).json({ erro: "Evento não encontrado" });
    const evento = eventoResult.rows[0];

    if (!admin && !evento.publicado)
      return res.status(404).json({ erro: "NAO_PUBLICADO" });

    if (!admin && usuarioId) {
      const isInstrutorEv =
        (
          await client.query(
            `SELECT 1
               FROM turmas t
               JOIN turma_instrutor ti ON ti.turma_id = t.id
              WHERE t.evento_id = $1 AND ti.instrutor_id = $2
              LIMIT 1`,
            [id, usuarioId]
          )
        ).rowCount > 0;
      if (!isInstrutorEv) {
        const can = await podeVerEvento({
          client,
          usuarioId,
          eventoId: Number(id),
          req,
        });
        if (!can.ok) return res.status(403).json({ erro: "Evento restrito." });
      }
    }

    const [regsQ, cargosRows, unidadesRows, instrEventoQ] = await Promise.all([
      client.query(
        `SELECT registro_norm FROM evento_registros WHERE evento_id=$1 ORDER BY registro_norm`,
        [id]
      ),
      client.query(
        `SELECT id, nome, codigo FROM cargos WHERE id = ANY($1) ORDER BY nome`,
        [Array.isArray(evento.cargos_permitidos_ids) ? evento.cargos_permitidos_ids : []]
      ),
      client.query(
        `SELECT id, nome FROM unidades WHERE id = ANY($1) ORDER BY nome`,
        [Array.isArray(evento.unidades_permitidas_ids) ? evento.unidades_permitidas_ids : []]
      ),
      client.query(
        `SELECT DISTINCT u.id, u.nome
           FROM turmas t
           JOIN turma_instrutor ti ON ti.turma_id = t.id
           JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE t.evento_id = $1
          ORDER BY u.nome`,
        [id]
      ),
    ]);

    // Turmas detalhadas (com fallback p/ coluna ausente)
    const turmasResult = await tryQueryWithFallback(
      client,
      {
        text: `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                      vagas_total, carga_horaria, instrutor_assinante_id
                 FROM turmas
                WHERE evento_id=$1
                ORDER BY data_inicio NULLS LAST, id`,
        values: [id],
      },
      {
        text: `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                      vagas_total, carga_horaria
                 FROM turmas
                WHERE evento_id=$1
                ORDER BY data_inicio NULLS LAST, id`,
        values: [id],
      }
    );

    const turmas = [];
    for (const t of turmasResult.rows) {
      const datasQ = await client.query(
        `SELECT data, horario_inicio, horario_fim
           FROM datas_turma
          WHERE turma_id=$1
          ORDER BY data ASC`,
        [t.id]
      );
      const datas = (datasQ.rows || [])
        .map((d) => ({
          data: toYmd(d.data),
          horario_inicio: toHm(d.horario_inicio),
          horario_fim: toHm(d.horario_fim),
        }))
        .filter((x) => x.data);

      const instrT = await client.query(
        `SELECT u.id, u.nome, u.email
           FROM turma_instrutor ti
           JOIN usuarios u ON u.id = ti.instrutor_id
          WHERE ti.turma_id=$1
          ORDER BY u.nome`,
        [t.id]
      );

      const assinanteId =
        Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")
          ? t.instrutor_assinante_id
          : null;
      const assinante = assinanteId
        ? instrT.rows.find((i) => i.id === assinanteId) || null
        : null;

      turmas.push({
        ...t,
        data_inicio: toYmd(t.data_inicio),
        data_fim: toYmd(t.data_fim),
        horario_inicio: toHm(t.horario_inicio),
        horario_fim: toHm(t.horario_fim),
        instrutores: instrT.rows,
        instrutor_assinante: assinante,
        instrutor_assinante_id: assinante ? assinante.id : null,
        datas,
      });
    }

    // Flags
    const [jaInstrutorResult, jaInscritoResult] = await Promise.all([
      client.query(
        `SELECT EXISTS(
           SELECT 1
             FROM turmas t
             JOIN turma_instrutor ti ON ti.turma_id = t.id
            WHERE t.evento_id = $1
              AND ti.instrutor_id = $2
        ) AS eh`,
        [id, usuarioId || 0]
      ),
      client.query(
        `SELECT EXISTS(
           SELECT 1
             FROM inscricoes i
             JOIN turmas t ON t.id = i.turma_id
            WHERE t.evento_id = $1
              AND i.usuario_id = $2
        ) AS eh`,
        [id, usuarioId || 0]
      ),
    ]);

    return res.json({
      ...evento,
      registros_permitidos: regsQ.rows.map((r) => r.registro_norm),
      cargos_permitidos_ids: Array.isArray(evento.cargos_permitidos_ids)
        ? evento.cargos_permitidos_ids
        : [],
      unidades_permitidas_ids: Array.isArray(evento.unidades_permitidas_ids)
        ? evento.unidades_permitidas_ids
        : [],
      cargos_permitidos: cargosRows.rows,
      unidades_permitidas: unidadesRows.rows,
      instrutor: instrEventoQ.rows,
      turmas,
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    });
  } catch (err) {
    console.error("buscarEventoPorId erro:", err);
    res.status(500).json({ erro: "Erro ao buscar evento por ID" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas de um evento (inclui assinante)
   ===================================================================== */
async function listarTurmasDoEvento(req, res) {
  const { id } = req.params;
  const admin = isAdmin(req);

  try {
    const base = await query(
      `
      SELECT 
        t.id, t.evento_id, t.nome,
        t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
        t.vagas_total, t.carga_horaria, t.instrutor_assinante_id,
        e.titulo, e.descricao, e.local
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      WHERE e.id = $1
        ${admin ? "" : "AND e.publicado = TRUE"}
      ORDER BY t.data_inicio NULLS LAST, t.id
      `,
      [id]
    ).catch(async (e) => {
      if (e.code !== "42703") throw e;
      // Fallback sem a coluna
      return query(
        `
        SELECT 
          t.id, t.evento_id, t.nome,
          t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          e.titulo, e.descricao, e.local
        FROM eventos e
        JOIN turmas t ON t.evento_id = e.id
        WHERE e.id = $1
          ${admin ? "" : "AND e.publicado = TRUE"}
        ORDER BY t.data_inicio NULLS LAST, t.id
        `,
        [id]
      );
    });

    const turmas = [];
    for (const r of base.rows) {
      const datasQ = await query(
        `SELECT data, horario_inicio, horario_fim FROM datas_turma
          WHERE turma_id=$1 ORDER BY data ASC`,
        [r.id]
      );
      const datas = (datasQ.rows || [])
  .map((d) => ({
    data: toYmd(d.data),
    horario_inicio: toHm(d.horario_inicio),
    horario_fim: toHm(d.horario_fim),
  }))
  .filter((x) => x.data);

/* +++ INÍCIO: contadores de vagas +++ */
const { rows: vQ } = await query(
  `SELECT COUNT(*)::int AS inscritos FROM inscricoes WHERE turma_id = $1`,
  [r.id]
);
const inscritos = vQ?.[0]?.inscritos ?? 0;
const vagasTotal = Number.isFinite(Number(r.vagas_total)) ? Number(r.vagas_total) : 0;
const vagasPreenchidas = inscritos;
const vagasDisponiveis = Math.max(vagasTotal - inscritos, 0);
/* +++ FIM: contadores de vagas +++ */

const instrQ = await query(
  `SELECT u.id, u.nome, u.email
     FROM turma_instrutor ti
     JOIN usuarios u ON u.id = ti.instrutor_id
    WHERE ti.turma_id = $1
    ORDER BY u.nome`,
  [r.id]
);

      const hasAssCol = Object.prototype.hasOwnProperty.call(r, "instrutor_assinante_id");
      const assinante =
        hasAssCol && r.instrutor_assinante_id
          ? instrQ.rows.find((i) => i.id === r.instrutor_assinante_id) || null
          : null;

      turmas.push({
        id: r.id,
        evento_id: r.evento_id,
        nome: r.nome,
        titulo: r.titulo,
        descricao: r.descricao,
        local: r.local,
        vagas_total: r.vagas_total,
        carga_horaria: r.carga_horaria,
        data_inicio: toYmd(r.data_inicio),
        data_fim: toYmd(r.data_fim),
        horario_inicio: toHm(r.horario_inicio),
        horario_fim: toHm(r.horario_fim),
        instrutores: instrQ.rows,
        instrutor_assinante_id: hasAssCol ? r.instrutor_assinante_id || null : null,
        instrutor_assinante: assinante,
        datas,
        vagas_preenchidas: vagasPreenchidas,
vagas_disponiveis: vagasDisponiveis,
inscritos: vagasPreenchidas,
      });
    }

    res.json(turmas);
  } catch (err) {
    console.error("listarTurmasDoEvento erro:", err);
    res.status(500).json({ erro: "Erro ao buscar turmas do evento." });
  }
}

/* =====================================================================
   🔄 Atualizar evento (sem bloqueios) — resiliente a schema legado
   ===================================================================== */
async function atualizarEvento(req, res) {
  const eventoId = Number(req.params.id);
  if (!eventoId) return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,

    turmas, // opcional
    restrito,
    restrito_modo, // retrocompat
    registros,
    registros_permitidos, // retrocompat

    cargos_permitidos, // array de IDs
    unidades_permitidas, // array de IDs
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const folderUrl = pegarUploadUrl(req, "folder");
    const progPdfUrl = pegarUploadUrl(req, "programacao");

    const setCols = [
      `titulo        = COALESCE($2, titulo)`,
      `descricao     = COALESCE($3, descricao)`,
      `local         = COALESCE($4, local)`,
      `tipo          = COALESCE($5, tipo)`,
      `unidade_id    = COALESCE($6, unidade_id)`,
      `publico_alvo  = COALESCE($7, publico_alvo)`,
    ];
    const params = [
      eventoId,
      titulo ?? null,
      descricao ?? null,
      local ?? null,
      tipo ?? null,
      unidade_id ?? null,
      publico_alvo ?? null,
    ];

    if (typeof restrito !== "undefined") {
      setCols.push(`restrito = $${params.length + 1}`);
      params.push(!!restrito);
    }
    if (typeof restrito_modo !== "undefined") {
      setCols.push(`restrito_modo = $${params.length + 1}`);
      params.push(restrito ? restrito_modo || null : null);
    }
    // 🔓 Se restrito = false → limpa totalmente visibilidade
if (typeof restrito !== "undefined" && !restrito) {
  setCols.push(`cargos_permitidos_ids = NULL`);
  setCols.push(`unidades_permitidas_ids = NULL`);
}
    if (folderUrl) {
      setCols.push(`folder_url = $${params.length + 1}`);
      params.push(folderUrl);
    }
    if (progPdfUrl) {
      setCols.push(`programacao_pdf_url = $${params.length + 1}`);
      params.push(progPdfUrl);
    }
    if (typeof cargos_permitidos !== "undefined") {
      setCols.push(`cargos_permitidos_ids = $${params.length + 1}`);
      params.push(toIntArray(cargos_permitidos));
    }
    if (typeof unidades_permitidas !== "undefined") {
      setCols.push(`unidades_permitidas_ids = $${params.length + 1}`);
      params.push(toIntArray(unidades_permitidas));
    }

    await client.query(
      `UPDATE eventos SET ${setCols.join(", ")} WHERE id = $1`,
      params
    );

    // Listas retrocompat (registros)
    if (typeof restrito !== "undefined" && !restrito) {
      await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [
        eventoId,
      ]);
      await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
      await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [eventoId]);
    } else {
      if (
        restrito_modo === MODO_LISTA ||
        typeof registros !== "undefined" ||
        typeof registros_permitidos !== "undefined"
      ) {
        await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [
          eventoId,
        ]);
        const input =
          typeof registros_permitidos !== "undefined"
            ? registros_permitidos
            : registros;
        const regList = normalizeListaRegistros(input);
        for (const r of regList) {
          await client.query(
            `INSERT INTO evento_registros (evento_id, registro_norm)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, r]
          );
        }
      }

      // Sincroniza tabelas legadas com os arrays atuais (se vierem)
      if (typeof cargos_permitidos !== "undefined") {
        await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [eventoId]);
        for (const cid of toIntArray(cargos_permitidos)) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_cargos (evento_id, cargo)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, String(cid)]
          );
        }
      }
      if (typeof unidades_permitidas !== "undefined") {
        await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [eventoId]);
        for (const uid of toIntArray(unidades_permitidas)) {
          await execIgnoreMissing(
            client,
            `INSERT INTO evento_unidades (evento_id, unidade_id)
             VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventoId, uid]
          );
        }
      }
    }

    // Turmas (SEM BLOQUEIOS)
    if (Array.isArray(turmas)) {
      const { rows: atuais } = await client.query(
        `SELECT id FROM turmas WHERE evento_id=$1`,
        [eventoId]
      );
      const payloadIds = new Set(
        turmas
          .filter((t) => Number.isFinite(Number(t.id)))
          .map((t) => Number(t.id))
      );

      // Remover ausentes
      for (const t of atuais) {
        if (!payloadIds.has(t.id)) {
          await client.query(`DELETE FROM presencas WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [
            t.id,
          ]);
          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [
            t.id,
          ]);
          await client.query(`DELETE FROM inscricoes WHERE turma_id=$1`, [t.id]);
          await client.query(`DELETE FROM turmas WHERE id=$1`, [t.id]);
        }
      }

      // Criar/Atualizar
      for (const t of turmas) {
        const id = Number(t.id);
        const baseDatas = extrairDatasDaTurma(t);
        const ordenadas = [...baseDatas]
          .filter((d) => d.data)
          .sort((a, b) => a.data.localeCompare(b.data));
        const data_inicio = ordenadas[0]?.data || null;
        const data_fim = ordenadas.at(-1)?.data || data_inicio || null;

        const nome = String(t.nome || "Turma").trim();
        const vagas_total = Number.isFinite(Number(t.vagas_total))
          ? Number(t.vagas_total)
          : null;
        const carga_horaria = Number.isFinite(Number(t.carga_horaria))
          ? Number(t.carga_horaria)
          : null;
        const hiPayload = hhmm(t?.horario_inicio || "") || null;
        const hfPayload = hhmm(t?.horario_fim || "") || null;

        if (!Number.isFinite(id)) {
          // NOVA
          const ins = await tryQueryWithFallback(
            client,
            {
              text: `INSERT INTO turmas (
                       evento_id, nome, vagas_total, carga_horaria,
                       data_inicio, data_fim, horario_inicio, horario_fim, instrutor_assinante_id
                     )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     RETURNING id`,
              values: [
                eventoId,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
                null,
              ],
            },
            {
              text: `INSERT INTO turmas (
                       evento_id, nome, vagas_total, carga_horaria,
                       data_inicio, data_fim, horario_inicio, horario_fim
                     )
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                     RETURNING id`,
              values: [
                eventoId,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
              ],
            }
          );
          const turmaId = ins.rows[0].id;

          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [
            turmaId,
          ]);
          for (const d of ordenadas) {
            const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
            const fimSeguro = d.horario_fim || hfPayload || "17:00";
            await client.query(
              `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
               VALUES ($1,$2,$3,$4)`,
              [turmaId, d.data, inicioSeguro, fimSeguro]
            );
          }

          await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [
            turmaId,
          ]);
          const instrutores = Array.isArray(t?.instrutores) ? t.instrutores : [];
          for (const instrutorId of instrutores) {
            await client.query(
              `INSERT INTO turma_instrutor (turma_id, instrutor_id)
               VALUES ($1,$2) ON CONFLICT DO NOTHING`,
              [turmaId, instrutorId]
            );
          }

          if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
            const assinanteId = Number(t.instrutor_assinante_id);
            if (instrutores.includes(assinanteId)) {
              await execIgnoreMissing(
                client,
                `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
                [turmaId, assinanteId]
              );
            }
          }
        } else {
          // EXISTENTE
          await tryQueryWithFallback(
            client,
            {
              text: `UPDATE turmas
                       SET nome=$2, vagas_total=$3, carga_horaria=$4,
                           data_inicio=$5, data_fim=$6,
                           horario_inicio=$7, horario_fim=$8
                     WHERE id=$1`,
              values: [
                id,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
              ],
            },
            {
              // fallback é idêntico (não atualiza coluna extra aqui)
              text: `UPDATE turmas
                       SET nome=$2, vagas_total=$3, carga_horaria=$4,
                           data_inicio=$5, data_fim=$6,
                           horario_inicio=$7, horario_fim=$8
                     WHERE id=$1`,
              values: [
                id,
                nome,
                vagas_total,
                carga_horaria,
                data_inicio,
                data_fim,
                hiPayload,
                hfPayload,
              ],
            }
          );

          await client.query(`DELETE FROM datas_turma WHERE turma_id=$1`, [id]);
          for (const d of ordenadas) {
            const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
            const fimSeguro = d.horario_fim || hfPayload || "17:00";
            await client.query(
              `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
               VALUES ($1,$2,$3,$4)`,
              [id, d.data, inicioSeguro, fimSeguro]
            );
          }

          if (Array.isArray(t?.instrutores)) {
            await client.query(`DELETE FROM turma_instrutor WHERE turma_id=$1`, [
              id,
            ]);
            for (const instrutorId of t.instrutores) {
              await client.query(
                `INSERT INTO turma_instrutor (turma_id, instrutor_id)
                 VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                [id, instrutorId]
              );
            }
          }

          // Atualiza assinante se a coluna existir
          if (Number.isFinite(Number(t?.instrutor_assinante_id))) {
            const assinanteId = Number(t.instrutor_assinante_id);
            const chk = await client.query(
              `SELECT 1 FROM turma_instrutor WHERE turma_id=$1 AND instrutor_id=$2 LIMIT 1`,
              [id, assinanteId]
            );
            await execIgnoreMissing(
              client,
              `UPDATE turmas SET instrutor_assinante_id=$2 WHERE id=$1`,
              [id, chk.rowCount > 0 ? assinanteId : null]
            );
          } else if (
            t &&
            Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")
          ) {
            await execIgnoreMissing(
              client,
              `UPDATE turmas SET instrutor_assinante_id=NULL WHERE id=$1`,
              [id]
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    return res.json({ ok: true, mensagem: "Evento atualizado com sucesso." });
  } catch (err) {
    console.error("atualizarEvento erro:", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return res.status(500).json({
      erro: "Erro ao atualizar evento",
      detalhe: err?.message || null,
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ❌ Excluir evento (cascata manual)
   ===================================================================== */
async function excluirEvento(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM inscricoes WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM turma_instrutor WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id=$1)`,
      [id]
    );
    await client.query(`DELETE FROM turmas WHERE evento_id=$1`, [id]);
    await client.query(`DELETE FROM evento_registros WHERE evento_id=$1`, [id]);
    await execIgnoreMissing(client, `DELETE FROM evento_cargos WHERE evento_id=$1`, [id]);
    await execIgnoreMissing(client, `DELETE FROM evento_unidades WHERE evento_id=$1`, [id]);
    const result = await client.query(
      `DELETE FROM eventos WHERE id=$1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Evento não encontrado" });
    }
    await client.query("COMMIT");
    return res.json({
      mensagem: "Evento excluído com sucesso",
      evento: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("excluirEvento erro:", err.message);
    return res.status(500).json({ erro: "Erro ao excluir evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   Agenda, datas, turmas simples
   ===================================================================== */
async function getAgendaEventos(req, res) {
  const sqlBase = (useDataPresenca = false) => `
    SELECT 
      e.id, e.titulo,
      MIN(t.data_inicio) AS data_inicio,
      MAX(t.data_fim)    AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim)    AS horario_fim,
      CASE 
        WHEN CURRENT_TIMESTAMP::timestamp < MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time)) THEN 'programado'
        WHEN CURRENT_TIMESTAMP::timestamp <= MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) THEN 'andamento'
        ELSE 'encerrado'
      END AS status,
      CASE
        WHEN EXISTS (SELECT 1 FROM turmas tx JOIN datas_turma dt ON dt.turma_id = tx.id WHERE tx.evento_id = e.id) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(dt.data::date,'YYYY-MM-DD') AS d
            FROM turmas tx JOIN datas_turma dt ON dt.turma_id=tx.id
            WHERE tx.evento_id=e.id ORDER BY 1
          ) z1
        )
        WHEN EXISTS (SELECT 1 FROM turmas tx JOIN presencas p ON p.turma_id = tx.id WHERE tx.evento_id = e.id) THEN (
          SELECT json_agg(d ORDER BY d) FROM (
            SELECT DISTINCT to_char(p.${useDataPresenca ? "data_presenca" : "data"}::date,'YYYY-MM-DD') AS d
            FROM turmas tx JOIN presencas p ON p.turma_id=tx.id
            WHERE tx.evento_id=e.id ORDER BY 1
          ) z2
        )
        ELSE '[]'::json
      END AS ocorrencias
    FROM eventos e
    JOIN turmas t ON t.evento_id = e.id
    GROUP BY e.id, e.titulo
    ORDER BY MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) DESC NULLS LAST;
  `;
  try {
    let rows;
    try {
      ({ rows } = await query(sqlBase(false), []));
    } catch {
      ({ rows } = await query(sqlBase(true), []));
    }
    const out = rows.map((r) => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));
    res.set("X-Agenda-Handler", "eventosController:getAgendaEventos@livre");
    res.json(out);
  } catch (err) {
    console.error("getAgendaEventos erro:", err);
    res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
}

async function listarEventosDoinstrutor(req, res) {
  const usuarioId = getUsuarioId(req);
  const client = await pool.connect();
  try {
    const eventosResult = await client.query(
      `
      SELECT DISTINCT 
        e.*,
        CASE 
          WHEN CURRENT_TIMESTAMP::timestamp < (
            SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= (
            SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
            FROM turmas t WHERE t.evento_id = e.id
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status,
        COALESCE((SELECT array_agg(er.registro_norm) FROM evento_registros er WHERE er.evento_id=e.id),'{}'::text[]) AS registros_permitidos
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      JOIN turma_instrutor ti ON ti.turma_id = t.id
      WHERE ti.instrutor_id=$1 AND e.publicado=TRUE
      ORDER BY e.id`,
      [usuarioId]
    );

    const eventos = [];
    for (const evento of eventosResult.rows) {
      const turmasResult = await tryQueryWithFallback(
        client,
        {
          text: `SELECT id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                        vagas_total, carga_horaria, instrutor_assinante_id
                   FROM turmas WHERE evento_id=$1 ORDER BY data_inicio`,
          values: [evento.id],
        },
        {
          text: `SELECT id, nome, data_inicio, data_fim, horario_inicio, horario_fim,
                        vagas_total, carga_horaria
                   FROM turmas WHERE evento_id=$1 ORDER BY data_inicio`,
          values: [evento.id],
        }
      );
      const instrutorResult = await client.query(
        `SELECT DISTINCT u.id, u.nome
           FROM turmas t
           JOIN turma_instrutor ti ON ti.turma_id=t.id
           JOIN usuarios u ON u.id=ti.instrutor_id
          WHERE t.evento_id=$1`,
        [evento.id]
      );

      const turmas = [];
      for (const t of turmasResult.rows) {
        const datasQ = await client.query(
          `SELECT data, horario_inicio, horario_fim FROM datas_turma
            WHERE turma_id=$1 ORDER BY data ASC`,
          [t.id]
        );
        const datas = (datasQ.rows || [])
          .map((d) => ({
            data: toYmd(d.data),
            horario_inicio: toHm(d.horario_inicio),
            horario_fim: toHm(d.horario_fim),
          }))
          .filter((x) => x.data);

        const instrT = await client.query(
          `SELECT u.id, u.nome FROM turma_instrutor ti
            JOIN usuarios u ON u.id = ti.instrutor_id
           WHERE ti.turma_id=$1 ORDER BY u.nome`,
          [t.id]
        );

        turmas.push({
          ...t,
          instrutor_assinante_id: Object.prototype.hasOwnProperty.call(t, "instrutor_assinante_id")
            ? t.instrutor_assinante_id
            : null,
          datas,
          instrutores: instrT.rows,
        });
      }

      eventos.push({ ...evento, instrutor: instrutorResult.rows, turmas });
    }

    res.json(eventos);
  } catch (err) {
    console.error("listarEventosDoinstrutor erro:", err.message);
    res.status(500).json({ erro: "Erro ao buscar eventos do instrutor" });
  } finally {
    client.release();
  }
}

async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "datas").toLowerCase();
  if (!Number.isFinite(turmaId))
    return res.status(400).json({ erro: "turma_id inválido" });

  try {
    if (via === "datas") {
      const sql = `
        SELECT 
          to_char(dt.data,'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim,'HH24:MI')   AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id=$1
        ORDER BY dt.data ASC`;
      const { rows } = await query(sql, [turmaId]);
      return res.json(rows);
    }

    if (via === "presencas") {
      const sqlA = `
        SELECT DISTINCT
          to_char(p.data::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI')   AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id=$1
        ORDER BY data ASC`;
      const sqlB = `
        SELECT DISTINCT
          to_char(p.data_presenca::date,'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio,'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,'HH24:MI')   AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id=$1
        ORDER BY data ASC`;
      try {
        const { rows } = await query(sqlA, [turmaId]);
        return res.json(rows);
      } catch {
        try {
          const { rows } = await query(sqlB, [turmaId]);
          return res.json(rows);
        } catch {
          return res.json([]);
        }
      }
    }

    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date    AS df,
          to_char(horario_inicio,'HH24:MI') AS hi,
          to_char(horario_fim,'HH24:MI')   AS hf
        FROM turmas WHERE id=$1
      )
      SELECT to_char(gs::date,'YYYY-MM-DD') AS data, t.hi AS horario_inicio, t.hf AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC`;
    const { rows } = await query(sql, [turmaId]);
    return res.json(rows);
  } catch (erro) {
    console.error("listarDatasDaTurma erro:", erro);
    return res
      .status(500)
      .json({ erro: "Erro ao buscar datas da turma.", detalhe: erro.message });
  }
}

async function listarTurmasSimples(req, res) {
  const { id } = req.params;
  const admin = isAdmin(req);

  try {
    const turmasQ = await query(
      `
       SELECT 
         t.id                AS id,
         t.evento_id         AS evento_id,
         t.nome              AS nome,
         t.data_inicio       AS data_inicio,
         t.data_fim          AS data_fim,
         t.horario_inicio    AS horario_inicio,
         t.horario_fim       AS horario_fim,
         t.vagas_total       AS vagas_total,
         t.carga_horaria     AS carga_horaria,
         t.instrutor_assinante_id AS instrutor_assinante_id
       FROM turmas t
       JOIN eventos e ON e.id = t.evento_id
       WHERE t.evento_id = $1 ${admin ? "" : "AND e.publicado = TRUE"}
       ORDER BY t.data_inicio NULLS LAST, t.id
       `,
      [id]
    ).catch(async (e) => {
      if (e.code !== "42703") throw e;
      // fallback sem a coluna
      return query(
        `
         SELECT 
           t.id                AS id,
           t.evento_id         AS evento_id,
           t.nome              AS nome,
           t.data_inicio       AS data_inicio,
           t.data_fim          AS data_fim,
           t.horario_inicio    AS horario_inicio,
           t.horario_fim       AS horario_fim,
           t.vagas_total       AS vagas_total,
           t.carga_horaria     AS carga_horaria
         FROM turmas t
         JOIN eventos e ON e.id = t.evento_id
         WHERE t.evento_id = $1 ${admin ? "" : "AND e.publicado = TRUE"}
         ORDER BY t.data_inicio NULLS LAST, t.id
        `,
        [id]
      );
    });

    const turmas = [];
    for (const r of turmasQ.rows) {
      const datasQ = await query(
        `SELECT data, horario_inicio, horario_fim FROM datas_turma
          WHERE turma_id=$1 ORDER BY data ASC`,
        [r.id]
      );
      const datas = (datasQ.rows || [])
        .map((d) => ({
          data: toYmd(d.data),
          horario_inicio: toHm(d.horario_inicio),
          horario_fim: toHm(d.horario_fim),
        }))
        .filter((x) => x.data);

        /* +++ INÍCIO: contadores de vagas +++ */
const { rows: vQ } = await query(
  `SELECT COUNT(*)::int AS inscritos FROM inscricoes WHERE turma_id = $1`,
  [r.id]
);
const inscritos = vQ?.[0]?.inscritos ?? 0;
const vagasTotal = Number.isFinite(Number(r.vagas_total)) ? Number(r.vagas_total) : 0;
const vagasPreenchidas = inscritos;
const vagasDisponiveis = Math.max(vagasTotal - inscritos, 0);
/* +++ FIM: contadores de vagas +++ */

turmas.push({
  id: r.id,
  evento_id: r.evento_id,
  nome: r.nome,
  data_inicio: toYmd(r.data_inicio) || datas[0]?.data || null,
  data_fim: toYmd(r.data_fim) || datas.at(-1)?.data || null,
  horario_inicio:
    toHm(r.horario_inicio) || datas[0]?.horario_inicio || null,
  horario_fim: toHm(r.horario_fim) || datas.at(-1)?.horario_fim || null,
  vagas_total: r.vagas_total,
  carga_horaria: r.carga_horaria,
  instrutor_assinante_id: Object.prototype.hasOwnProperty.call(r, "instrutor_assinante_id")
    ? r.instrutor_assinante_id || null
    : null,
  _datas: datas,

  /* Novos campos */
  vagas_preenchidas: vagasPreenchidas,
  vagas_disponiveis: vagasDisponiveis,
  inscritos: vagasPreenchidas, // (alias opcional)
});
    }

    res.json(turmas);
  } catch (err) {
    console.error("listarTurmasSimples erro:", err);
    res.status(500).json({ erro: "Erro ao buscar turmas." });
  }
}

/* =====================================================================
   🔎 Sugestão de cargos (auto-complete a partir de usuarios.cargo)
   ===================================================================== */
async function sugerirCargos(req, res) {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 20), 50);

  try {
    if (!q) {
      const sql = `
        SELECT cargo
        FROM (
          SELECT trim(cargo) AS cargo, COUNT(*) AS c
          FROM usuarios
          WHERE cargo IS NOT NULL AND trim(cargo) <> ''
          GROUP BY trim(cargo)
        ) x
        ORDER BY c DESC, cargo ASC
        LIMIT $1
      `;
      const { rows } = await query(sql, [limit]);
      return res.json(rows.map((r) => r.cargo));
    }

    const sql = `
      SELECT trim(cargo) AS cargo
      FROM usuarios
      WHERE cargo ILIKE $1
      GROUP BY trim(cargo)
      ORDER BY cargo ASC
      LIMIT $2
    `;
    const { rows } = await query(sql, [`%${q}%`, limit]);
    return res.json(rows.map((r) => r.cargo));
  } catch (err) {
    console.error("sugerirCargos erro:", err);
    return res.status(500).json({ erro: "Erro ao sugerir cargos" });
  }
}

/* =====================================================================
   📎 Atualizar somente arquivos (banner_url e programacao_pdf_url)
   ===================================================================== */
   async function atualizarArquivosDoEvento(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
      }
  
      // arquivos (já processados por uploadEventos)
      const folderUrl = pegarUploadUrl(req, "folder");        // png/jpg/jpeg
      const progPdfUrl = pegarUploadUrl(req, "programacao");  // pdf
  
      if (!folderUrl && !progPdfUrl) {
        return res.status(400).json({ erro: "Nenhum arquivo enviado." });
      }
  
      const setCols = [];
      const params = [id];
  
      if (folderUrl) {
        setCols.push(`folder_url = $${params.length + 1}`);
        params.push(folderUrl);
      }
      if (progPdfUrl) {
        setCols.push(`programacao_pdf_url = $${params.length + 1}`);
        params.push(progPdfUrl);
      }
  
      const r = await query(
        `UPDATE eventos
            SET ${setCols.join(", ")}
          WHERE id = $1
          RETURNING id, folder_url, programacao_pdf_url`,
        params
      );
  
      if (r.rowCount === 0) {
        return res.status(404).json({ erro: "Evento não encontrado." });
      }
  
      return res.json({
        ok: true,
        mensagem: "Arquivos do evento atualizados.",
        arquivos: r.rows[0],
      });
    } catch (err) {
      console.error("atualizarArquivosDoEvento erro:", err);
      return res.status(500).json({ erro: "Erro ao atualizar arquivos do evento." });
    }
  }

/* ===================================================================== */
module.exports = {
  uploadEventos,

  listarEventos,
  criarEvento,
  buscarEventoPorId,
  atualizarEvento,
  excluirEvento,
  listarTurmasDoEvento,
  listarTurmasSimples,
  getAgendaEventos,
  listarEventosDoinstrutor,
  listarDatasDaTurma,

  listarEventosParaMim,
  publicarEvento,
  despublicarEvento,
  sugerirCargos,
  atualizarArquivosDoEvento,
};
