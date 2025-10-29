/* eslint-disable no-console */
// ✅ src/controllers/eventosController.js
const { pool, query } = require("../db");
const {
  normalizeRegistro,
  normalizeListaRegistros,
} = require("../utils/registro");

/* =====================================================================
   Helpers de datas/horários (sem “pulo” de fuso)
   ===================================================================== */
function hhmm(s, fb = "") {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : fb || "";
}
function iso(s) {
  return typeof s === "string" ? s.slice(0, 10) : "";
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
  const d2 = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d2}`;
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

/* =====================================================================
   Helpers de restrição
   ===================================================================== */
const MODO_TODOS = "todos_servidores";
const MODO_LISTA = "lista_registros";
const ALLOWED_MODOS = new Set([MODO_TODOS, MODO_LISTA]);

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
function isInstrutorPerfil(req) {
  const p = getPerfisFromReq(req);
  return p.includes("instrutor") || p.includes("administrador");
}
const getUsuarioId = (req) => req.user?.id ?? req.user?.id ?? null;

/* =====================================================================
   🔐 Núcleo de checagem por REGISTRO (reuso interno)
   ===================================================================== */
async function podeVerPorRegistro({ client, usuarioId, eventoId, req }) {
  console.group(
    "🔐[podeVerPorRegistro] usuarioId:",
    usuarioId,
    "eventoId:",
    eventoId
  );

  const admin = isAdmin(req);
  console.log("→ admin?", admin);

  // busca evento
  const evQ = await client.query(
    `SELECT id, restrito, restrito_modo, publicado
       FROM eventos
      WHERE id = $1`,
    [eventoId]
  );
  const evento = evQ.rows[0];
  console.log("evento base:", evento);

  if (!evento) {
    console.warn("⛔ evento não encontrado");
    console.groupEnd();
    return { ok: false, motivo: "EVENTO_NAO_ENCONTRADO" };
  }

  // Não publicado: só admin enxerga
  if (!admin && !evento.publicado) {
    console.warn("⛔ evento rascunho e usuário não é admin");
    console.groupEnd();
    return { ok: false, motivo: "NAO_PUBLICADO" };
  }

  // Admin = liberado
  if (admin) {
    console.log("✅ admin liberado");
    console.groupEnd();
    return { ok: true };
  }

  // evento público
  if (!evento.restrito) {
    console.log("✅ evento não restrito");
    console.groupEnd();
    return { ok: true };
  }

  // precisa estar autenticado pra validar restrição
  if (!usuarioId) {
    console.warn("⛔ usuário não autenticado e evento restrito");
    console.groupEnd();
    return { ok: false, motivo: "NAO_AUTENTICADO" };
  }

  // pega registro do usuário
  const uQ = await client.query(
    `SELECT registro FROM usuarios WHERE id = $1`,
    [usuarioId]
  );
  const regNorm = normalizeRegistro(uQ.rows?.[0]?.registro || "");

  console.log("registro normalizado do usuário:", regNorm);

  if (evento.restrito_modo === MODO_TODOS) {
    const final = regNorm
      ? { ok: true }
      : { ok: false, motivo: "SEM_REGISTRO" };
    console.log("res MODO_TODOS:", final);
    console.groupEnd();
    return final;
  }

  if (evento.restrito_modo === MODO_LISTA) {
    if (!regNorm) {
      console.warn("⛔ sem registro normalizado para modo LISTA");
      console.groupEnd();
      return { ok: false, motivo: "SEM_REGISTRO" };
    }

    const hit = await client.query(
      `SELECT 1 FROM evento_registros WHERE evento_id = $1 AND registro_norm = $2 LIMIT 1`,
      [eventoId, regNorm]
    );
    const final =
      hit.rowCount > 0
        ? { ok: true }
        : { ok: false, motivo: "REGISTRO_NAO_AUTORIZADO" };
    console.log("res MODO_LISTA:", final);
    console.groupEnd();
    return final;
  }

  console.error("⛔ restrito_modo inválido:", evento.restrito_modo);
  console.groupEnd();
  return { ok: false, motivo: "MODO_RESTRICAO_INVALIDO" };
}

/* =====================================================================
   🚀 Publicar / Despublicar evento (admin)
   ===================================================================== */
async function publicarEvento(req, res) {
  console.group("📢[publicarEvento] params:", req.params);
  if (!isAdmin(req)) {
    console.warn("⛔ tentativa de publicar sem permissão");
    console.groupEnd();
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const id = Number(req.params.id);
  console.log("id normalizado:", id);
  if (!Number.isFinite(id)) {
    console.warn("⛔ id inválido");
    console.groupEnd();
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  try {
    const r = await query(
      `UPDATE eventos SET publicado = TRUE WHERE id = $1 RETURNING id, publicado`,
      [id]
    );
    console.log("update retorno:", r.rows);

    if (r.rowCount === 0) {
      console.warn("⛔ evento não encontrado ao publicar");
      console.groupEnd();
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    }

    console.log("✅ evento publicado");
    console.groupEnd();
    return res.json({
      ok: true,
      mensagem: "Evento publicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    console.error("❌ publicarEvento erro:", e);
    console.groupEnd();
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

async function despublicarEvento(req, res) {
  console.group("📢[despublicarEvento] params:", req.params);
  if (!isAdmin(req)) {
    console.warn("⛔ tentativa de despublicar sem permissão");
    console.groupEnd();
    return res.status(403).json({ erro: "PERMISSAO_NEGADA" });
  }

  const id = Number(req.params.id);
  console.log("id normalizado:", id);
  if (!Number.isFinite(id)) {
    console.warn("⛔ id inválido");
    console.groupEnd();
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  try {
    const r = await query(
      `UPDATE eventos SET publicado = FALSE WHERE id = $1 RETURNING id, publicado`,
      [id]
    );
    console.log("update retorno:", r.rows);

    if (r.rowCount === 0) {
      console.warn("⛔ evento não encontrado ao despublicar");
      console.groupEnd();
      return res.status(404).json({ erro: "EVENTO_NAO_ENCONTRADO" });
    }

    console.log("✅ evento despublicado");
    console.groupEnd();
    return res.json({
      ok: true,
      mensagem: "Evento despublicado.",
      evento: r.rows[0],
    });
  } catch (e) {
    console.error("❌ despublicarEvento erro:", e);
    console.groupEnd();
    return res.status(500).json({ erro: "ERRO_INTERNO" });
  }
}

/* =====================================================================
   📄 Listar todos os eventos (com resumo)
   ===================================================================== */
async function listarEventos(req, res) {
  console.group("📃[listarEventos]");
  try {
    const usuarioId = getUsuarioId(req);
    const admin = isAdmin(req);

    console.log("usuarioId:", usuarioId, "admin:", admin);

    const sql = `
  WITH sou_instrutor AS (
    SELECT DISTINCT evento_id FROM evento_instrutor WHERE instrutor_id = $2
  )
  SELECT 
    e.*,
    COALESCE((
      SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
      FROM evento_registros er
      WHERE er.evento_id = e.id
    ), '{}'::text[]) AS registros_permitidos,
    (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id)
      AS count_registros_permitidos,
    COALESCE(
      json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
      FILTER (WHERE u.id IS NOT NULL),
      '[]'
    ) AS instrutor,
    (SELECT MIN(t.data_inicio)    FROM turmas t WHERE t.evento_id = e.id) AS data_inicio_geral,
    (SELECT MAX(t.data_fim)       FROM turmas t WHERE t.evento_id = e.id) AS data_fim_geral,
    (SELECT MIN(t.horario_inicio) FROM turmas t WHERE t.evento_id = e.id) AS horario_inicio_geral,
    (SELECT MAX(t.horario_fim)    FROM turmas t WHERE t.evento_id = e.id) AS horario_fim_geral,
      CASE
  WHEN CURRENT_TIMESTAMP::timestamp < (
    SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time, '00:00'::time))
    FROM turmas t WHERE t.evento_id = e.id
  ) THEN 'programado'
  WHEN CURRENT_TIMESTAMP::timestamp <= (
    SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time, '23:59'::time))
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
      FROM evento_instrutor ei
      WHERE ei.evento_id = e.id
        AND ei.instrutor_id = $2
    ) AS ja_instrutor
  FROM eventos e
  LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
  LEFT JOIN usuarios u         ON u.id  = ei.instrutor_id
  WHERE ${admin ? "TRUE" : "(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM sou_instrutor))"}
  GROUP BY e.id
  ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
         e.id DESC;
`;

    const params = [usuarioId, usuarioId];
    console.log("SQL listarEventos params:", params);
    const result = await query(sql, params);

    console.log("retornando", result.rowCount, "eventos");
    console.groupEnd();
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar eventos:", err.stack || err.message);
    console.groupEnd();
    res.status(500).json({ erro: "Erro ao listar eventos" });
  }
}

/* =====================================================================
   🆕 Listar eventos "para mim" (aplica regra por registro no SQL)
   ===================================================================== */
async function listarEventosParaMim(req, res) {
  console.group("🙋[listarEventosParaMim]");
  const usuarioId = req.user?.id ?? null;
  console.log("usuarioId:", usuarioId);

  if (!usuarioId) {
    console.warn("⛔ não autenticado");
    console.groupEnd();
    return res
      .status(401)
      .json({ ok: false, erro: "NAO_AUTENTICADO" });
  }

  const client = await pool.connect();
  try {
    const uQ = await client.query(
      `SELECT registro FROM usuarios WHERE id = $1`,
      [usuarioId]
    );
    const regNorm = normalizeRegistro(uQ.rows?.[0]?.registro || "");
    console.log("registro normalizado do usuário:", regNorm);

    const sql = `
      WITH base AS (
        SELECT
          e.id, e.titulo, e.descricao, e.local, e.tipo, e.unidade_id,
          e.publico_alvo, e.restrito, e.restrito_modo, e.publicado
        FROM eventos e
        WHERE
          e.publicado = TRUE
          AND (
               e.restrito = FALSE
            OR (e.restrito = TRUE  AND e.restrito_modo = $3 AND $4 <> '')
            OR (e.restrito = TRUE  AND e.restrito_modo = $5 AND EXISTS (
                  SELECT 1 FROM evento_registros er
                   WHERE er.evento_id = e.id AND er.registro_norm = $4
                ))
          )
      )
      SELECT 
        e.id, e.titulo, e.descricao, e.local, e.tipo, e.unidade_id,
        e.publico_alvo, e.restrito, e.restrito_modo, e.publicado,

        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos,

        (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id)
          AS count_registros_permitidos,

        COALESCE((
          SELECT json_agg(DISTINCT jsonb_build_object('id', u.id, 'nome', u.nome))
          FROM evento_instrutor ei
          JOIN usuarios u ON u.id = ei.instrutor_id
          WHERE ei.evento_id = e.id
        ), '[]'::json) AS instrutor,

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
          FROM evento_instrutor ei
          WHERE ei.evento_id = e.id AND ei.instrutor_id = $2
        ) AS ja_instrutor

      FROM base e
      ORDER BY
  (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
     FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
  e.id DESC;
    `;

    const params = [usuarioId, usuarioId, MODO_TODOS, regNorm, MODO_LISTA];
    console.log("params:", params);

    const { rows } = await client.query(sql, params);
    console.log("rows obtidas:", rows.length);

    console.groupEnd();
    return res.json({ ok: true, eventos: rows });
  } catch (err) {
    console.error("❌ listarEventosParaMim erro:", err);
    console.groupEnd();
    return res
      .status(500)
      .json({ ok: false, erro: "ERRO_INTERNO" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ➕ Criar evento (persiste turmas + datas_turma + restrição)
   ===================================================================== */
async function criarEvento(req, res) {
  console.group("🆕[criarEvento] body recebido:", req.body);

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    instrutor = [],
    turmas = [],
    restrito = false,
    restrito_modo = null,
    // aceita ambos os nomes:
    registros,
    registros_permitidos,
  } = req.body || {};

  // validações básicas do evento
  if (!titulo?.trim()) {
    console.warn("⛔ titulo ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'titulo' é obrigatório." });
  }
  if (!descricao?.trim()) {
    console.warn("⛔ descricao ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'descricao' é obrigatório." });
  }
  if (!local?.trim()) {
    console.warn("⛔ local ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'local' é obrigatório." });
  }
  if (!tipo?.trim()) {
    console.warn("⛔ tipo ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'tipo' é obrigatório." });
  }
  if (!publico_alvo?.trim()) {
    console.warn("⛔ publico_alvo ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'publico_alvo' é obrigatório." });
  }
  if (!unidade_id) {
    console.warn("⛔ unidade_id ausente");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Campo 'unidade_id' é obrigatório." });
  }

  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    console.warn("⛔ nenhum instrutor");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Ao menos um instrutor deve ser selecionado." });
  }

  if (!Array.isArray(turmas) || turmas.length === 0) {
    console.warn("⛔ nenhuma turma enviada");
    console.groupEnd();
    return res
      .status(400)
      .json({ erro: "Ao menos uma turma deve ser criada." });
  }

  // validação da regra de restrição
  let restritoVal = !!restrito;
  let modoVal = null;
  let regList = [];
  if (restritoVal) {
    if (!ALLOWED_MODOS.has(String(restrito_modo))) {
      console.warn("⛔ restrito_modo inválido:", restrito_modo);
      console.groupEnd();
      return res.status(400).json({
        erro:
          "restrito_modo inválido. Use 'todos_servidores' ou 'lista_registros'.",
      });
    }
    modoVal = String(restrito_modo);

    if (modoVal === MODO_LISTA) {
      const input =
        typeof registros_permitidos !== "undefined"
          ? registros_permitidos
          : registros;
      regList = normalizeListaRegistros(input);
      console.log("regList normalizada:", regList);

      if (regList.length === 0) {
        console.warn("⛔ lista de registros vazia/ruim no modo LISTA");
        console.groupEnd();
        return res
          .status(400)
          .json({ erro: "Registros informados são inválidos." });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Cria o evento base
    const eventoResult = await client.query(
      `
        INSERT INTO eventos (
          titulo, descricao, local, tipo, unidade_id, publico_alvo,
          restrito, restrito_modo, publicado
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
        RETURNING *
        `,
      [
        titulo,
        descricao,
        local,
        tipo,
        unidade_id,
        publico_alvo,
        restritoVal,
        modoVal,
      ]
    );
    const evento = eventoResult.rows[0];
    const eventoId = evento.id;
    console.log("✅ evento criado ID:", eventoId);

    // 2. Instrutores
    for (const instrutorId of instrutor) {
      console.log("→ vinculando instrutor", instrutorId, "ao evento", eventoId);
      await client.query(
        `INSERT INTO evento_instrutor (evento_id, instrutor_id) VALUES ($1,$2)`,
        [eventoId, instrutorId]
      );
    }

    // helper para extrair datas/encontros de cada turma
    const extrairDatas = (t) => {
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
            ? {
                data: toYmd(e),
                horario_inicio: null,
                horario_fim: null,
              }
            : {
                data: toYmd(e?.data),
                horario_inicio: hhmm(e?.inicio || ""),
                horario_fim: hhmm(e?.fim || ""),
              }
        );
      }
      return [];
    };

    // 3. Cria cada turma e respectivas datas_turma
    const bloqueios = [];

    for (const t of turmas) {
      console.group("➕ criando turma:", t);

      const nome = String(t.nome || "Turma").trim();

      const vagas_total = Number.isFinite(Number(t.vagas_total))
        ? Number(t.vagas_total)
        : Number.isFinite(Number(t.vagas))
        ? Number(t.vagas)
        : null;

      const carga_horaria = Number.isFinite(Number(t.carga_horaria))
        ? Number(t.carga_horaria)
        : null;

      const baseDatas = extrairDatas(t);
      console.log("datas extraídas:", baseDatas);

      if (!baseDatas.length) {
        console.warn("⛔ turma SEM datas:", nome);
        bloqueios.push({ id: null, nome, motivo: "TURMA_SEM_DATAS" });
        console.groupEnd();
        continue;
      }

      // ordena encontros por data e calcula período
      const ordenadas = [...baseDatas]
        .filter((d) => d.data)
        .sort((a, b) => String(a.data).localeCompare(String(b.data)));

      const data_inicio = ordenadas[0].data;
      const data_fim = ordenadas.at(-1).data;

      const hiPayload = hhmm(t?.horario_inicio || "") || null;
      const hfPayload = hhmm(t?.horario_fim || "") || null;

      // valida mínimos obrigatórios da turma
      if (
        !nome ||
        !data_inicio ||
        !data_fim ||
        vagas_total == null ||
        carga_horaria == null
      ) {
        console.warn("⛔ turma faltando campos obrigatórios:", nome);
        bloqueios.push({
          id: null,
          nome,
          motivo: "TURMA_CAMPOS_OBRIGATORIOS",
        });
        console.groupEnd();
        continue;
      }

      // cria turma
      const turmaIns = await client.query(
        `
          INSERT INTO turmas (
            evento_id,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            horario_inicio,
            horario_fim
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING id
          `,
        [
          eventoId,
          nome,
          vagas_total,
          carga_horaria,
          data_inicio,
          data_fim,
          hiPayload,
          hfPayload,
        ]
      );
      const turmaId = turmaIns.rows[0].id;
      console.log("✅ turma criada ID:", turmaId);

      // cria datas_turma
      for (const d of ordenadas) {
        if (!d.data) continue;
        const inicioSeguro = d.horario_inicio || hiPayload || "08:00";
        const fimSeguro = d.horario_fim || hfPayload || "17:00";

        console.log("→ datas_turma", d.data, inicioSeguro, fimSeguro);
        await client.query(
          `
            INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
            VALUES ($1,$2,$3,$4)
            `,
          [turmaId, d.data, inicioSeguro, fimSeguro]
        );
      }

      console.groupEnd();
    }

    // se alguma turma falhou validação básica, aborta tudo
    if (bloqueios.length) {
      console.warn(
        "⛔ bloqueios ao criar turmas. rollback total:",
        bloqueios
      );
      await client.query("ROLLBACK");
      console.groupEnd();
      return res.status(400).json({
        erro: "TURMA_INVALIDA",
        detalhe:
          "Algumas turmas não têm datas ou campos obrigatórios.",
        turmas_bloqueadas: bloqueios,
      });
    }

    // 4. restrição por lista (modo LISTA)
    if (restritoVal && modoVal === MODO_LISTA && regList.length) {
      console.log("↳ inserindo registros_permitidos:", regList);
      for (const r of regList) {
        await client.query(
          `
            INSERT INTO evento_registros (evento_id, registro_norm)
            VALUES ($1,$2)
            ON CONFLICT DO NOTHING
            `,
          [eventoId, r]
        );
      }
    }

    await client.query("COMMIT");
    console.log("✅ Evento criado com sucesso, id:", eventoId);
    console.groupEnd();

    res.status(201).json({
      mensagem: "Evento criado com sucesso",
      evento,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao criar evento:", err.message, err.stack);
    console.groupEnd();
    res.status(500).json({ erro: "Erro ao criar evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar evento por ID (com checagem de visibilidade)
   ===================================================================== */
async function buscarEventoPorId(req, res) {
  console.group("🔎[buscarEventoPorId] params:", req.params);

  const { id } = req.params;
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);

  console.log("usuarioId:", usuarioId, "admin:", admin);

  const client = await pool.connect();

  try {
    // evento
    const eventoResult = await client.query(
      `SELECT * FROM eventos WHERE id = $1`,
      [id]
    );
    if (eventoResult.rows.length === 0) {
      console.warn("⛔ evento não encontrado:", id);
      console.groupEnd();
      return res.status(404).json({ erro: "Evento não encontrado" });
    }
    const evento = eventoResult.rows[0];
    console.log("evento base:", evento);

    // status calculado
    const { rows: stEv } = await client.query(
      `
      SELECT
        CASE
          WHEN CURRENT_TIMESTAMP::timestamp < (
            SELECT MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time))
            FROM turmas t
            WHERE t.evento_id = $1
          ) THEN 'programado'
          WHEN CURRENT_TIMESTAMP::timestamp <= (
            SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
            FROM turmas t
            WHERE t.evento_id = $1
          ) THEN 'andamento'
          ELSE 'encerrado'
        END AS status
      `,
      [id]
    );
    const status_evento = stEv[0]?.status || "programado";
    console.log("status_evento:", status_evento);

    // não-admin não vê rascunho
    if (!isAdmin(req) && !evento.publicado) {
      console.warn(
        "⛔ tentativa de acessar rascunho não publicado por não-admin"
      );
      console.groupEnd();
      return res.status(404).json({ erro: "NAO_PUBLICADO" });
    }

    // checa visibilidade para não-admin
    if (!admin) {
      const isInstrutorDoEvento = usuarioId
        ? (
            await client.query(
              `SELECT 1 FROM evento_instrutor WHERE evento_id=$1 AND instrutor_id=$2 LIMIT 1`,
              [id, usuarioId]
            )
          ).rowCount > 0
        : false;

      console.log(
        "isInstrutorDoEvento?",
        isInstrutorDoEvento,
        "restrito?",
        evento.restrito
      );

      if (!isInstrutorDoEvento) {
        let podeVer = false;
        if (!evento.restrito) {
          podeVer = true;
        } else if (usuarioId) {
          const { rows } = await client.query(
            `SELECT registro FROM usuarios WHERE id=$1`,
            [usuarioId]
          );
          const regNorm = normalizeRegistro(
            rows?.[0]?.registro || ""
          );
          console.log("registro normalizado do usuário:", regNorm);

          if (evento.restrito_modo === MODO_TODOS && regNorm) {
            podeVer = true;
          } else if (evento.restrito_modo === MODO_LISTA && regNorm) {
            const hit = await client.query(
              `SELECT 1 FROM evento_registros WHERE evento_id=$1 AND registro_norm=$2 LIMIT 1`,
              [id, regNorm]
            );
            podeVer = hit.rowCount > 0;
          }
        }

        if (!podeVer) {
          console.warn("⛔ acesso negado por restrição");
          console.groupEnd();
          return res
            .status(403)
            .json({ erro: "Evento restrito." });
        }
      }
    }

    // instrutores
    const instrutorResult = await client.query(
      `SELECT u.id, u.nome, u.email
         FROM evento_instrutor ei
         JOIN usuarios u ON u.id = ei.instrutor_id
        WHERE ei.evento_id = $1
        ORDER BY u.nome`,
      [id]
    );
    console.log(
      "instrutores:",
      instrutorResult.rows.map((i) => i.id)
    );

    // lista de registros
    const regsQ = await client.query(
      `SELECT registro_norm FROM evento_registros WHERE evento_id = $1 ORDER BY registro_norm`,
      [id]
    );
    const registros_permitidos = regsQ.rows.map((r) => r.registro_norm);
    const count_registros_permitidos = regsQ.rowCount;
    console.log("count_registros_permitidos:", count_registros_permitidos);

    // turmas
    const turmasBase = await client.query(
      `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria
         FROM turmas
        WHERE evento_id = $1
        ORDER BY id`,
      [id]
    );

    const turmas = [];
    for (const t of turmasBase.rows) {
      console.group("→ turma detalhada id:", t.id);

      const per = await client.query(
        `SELECT MIN(data) AS di, MAX(data) AS df
           FROM datas_turma
          WHERE turma_id = $1`,
        [t.id]
      );
      const data_inicio = toYmd(per.rows[0]?.di) || toYmd(t.data_inicio);
      const data_fim = toYmd(per.rows[0]?.df) || toYmd(t.data_fim);

      const h = await client.query(
        `SELECT horario_inicio, horario_fim, COUNT(*) AS c
           FROM datas_turma
          WHERE turma_id = $1
       GROUP BY horario_inicio, horario_fim
       ORDER BY c DESC, horario_inicio NULLS LAST, horario_fim NULLS LAST
          LIMIT 1`,
        [t.id]
      );

      let horario_inicio = "";
      let horario_fim = "";
      if (h.rowCount > 0) {
        horario_inicio = toHm(h.rows[0].horario_inicio);
        horario_fim = toHm(h.rows[0].horario_fim);
      } else {
        horario_inicio = toHm(t.horario_inicio);
        horario_fim = toHm(t.horario_fim);
      }

      const datasQ = await client.query(
        `SELECT data, horario_inicio, horario_fim
           FROM datas_turma
          WHERE turma_id = $1
          ORDER BY data`,
        [t.id]
      );
      let datas = datasQ.rows
        .map((r) => ({
          data: toYmd(r.data),
          horario_inicio: toHm(r.horario_inicio),
          horario_fim: toHm(r.horario_fim),
        }))
        .filter((d) => d.data);

      if (datas.length === 0) {
        console.warn(
          "⚠️ turma sem datas_turma, tentando fallback presenças"
        );
        try {
          const presA = await client.query(
            `SELECT DISTINCT (p.data::date) AS d
               FROM presencas p
              WHERE p.turma_id = $1
              ORDER BY d`,
            [t.id]
          );
          datas = presA.rows
            .map((r) => ({
              data: toYmd(r.d),
              horario_inicio,
              horario_fim,
            }))
            .filter((d) => d.data);
        } catch {
          const presB = await client.query(
            `SELECT DISTINCT (p.data_presenca::date) AS d
               FROM presencas p
              WHERE p.turma_id = $1
              ORDER BY d`,
            [t.id]
          );
          datas = presB.rows
            .map((r) => ({
              data: toYmd(r.d),
              horario_inicio,
              horario_fim,
            }))
            .filter((d) => d.data);
        }
      }

      const inscritosQ = await client.query(
        `SELECT COUNT(*) AS total FROM inscricoes WHERE turma_id = $1`,
        [t.id]
      );
      const inscritos = Number(inscritosQ.rows[0]?.total || 0);

      const hiCalc =
        horario_inicio && horario_inicio.length
          ? horario_inicio
          : "00:00";
      const hfCalc =
        horario_fim && horario_fim.length ? horario_fim : "23:59";

      const { rows: stT } = await client.query(
        `
  SELECT
  CASE
    WHEN CURRENT_TIMESTAMP::timestamp < ($1::date + $2::time) THEN 'programado'
    WHEN CURRENT_TIMESTAMP::timestamp <= ($3::date + $4::time) THEN 'andamento'
    ELSE 'encerrado'
  END AS status
  `,
        [data_inicio, hiCalc, data_fim, hfCalc]
      );
      const status_turma = stT[0]?.status || "programado";

      console.log("turma status:", status_turma, "inscritos:", inscritos);

      turmas.push({
        id: t.id,
        evento_id: t.evento_id,
        nome: t.nome,
        data_inicio,
        data_fim,
        horario_inicio: horario_inicio || null,
        horario_fim: horario_fim || null,
        vagas_total: t.vagas_total,
        carga_horaria: t.carga_horaria,
        inscritos,
        inscritos_confirmados: inscritos,
        vagas_preenchidas: inscritos,
        datas,
        status: status_turma,
      });

      console.groupEnd();
    }

    const jaInstrutorResult = await client.query(
      `SELECT COUNT(*) > 0 AS eh
         FROM evento_instrutor
        WHERE evento_id = $1 AND instrutor_id = $2`,
      [id, usuarioId]
    );
    const jaInscritoResult = await client.query(
      `SELECT COUNT(*) > 0 AS eh
         FROM inscricoes i
         JOIN turmas t ON t.id = i.turma_id
        WHERE i.usuario_id = $1
          AND t.evento_id = $2`,
      [usuarioId, id]
    );

    const eventoCompleto = {
      ...evento,
      status: status_evento,
      registros_permitidos,
      count_registros_permitidos,
      instrutor: instrutorResult.rows,
      turmas,
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    };

    console.log("✅ respondendo eventoCompleto.id:", eventoCompleto.id);
    console.groupEnd();
    res.json(eventoCompleto);
  } catch (err) {
    console.error(
      "❌ Erro ao buscar evento por ID:",
      err.message,
      err.stack
    );
    console.groupEnd();
    res
      .status(500)
      .json({ erro: "Erro ao buscar evento por ID" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🆕 Checagem rápida de visibilidade (/:id/visivel)
   ===================================================================== */
async function verificarVisibilidadeEvento(req, res) {
  console.group(
    "👀[verificarVisibilidadeEvento] params:",
    req.params
  );
  const usuarioId = getUsuarioId(req);
  console.log("usuarioId:", usuarioId);

  if (!usuarioId) {
    console.warn("⛔ não autenticado");
    console.groupEnd();
    return res
      .status(401)
      .json({ ok: false, erro: "NAO_AUTENTICADO" });
  }

  const eventoId = Number(req.params.id);
  console.log("eventoId:", eventoId);
  if (!Number.isFinite(eventoId)) {
    console.warn("⛔ EVENTO_ID_INVALIDO");
    console.groupEnd();
    return res
      .status(400)
      .json({ ok: false, erro: "EVENTO_ID_INVALIDO" });
  }

  const client = await pool.connect();
  try {
    const r = await podeVerPorRegistro({
      client,
      usuarioId,
      eventoId,
      req,
    });
    console.log("resultado podeVerPorRegistro:", r);

    if (!r.ok) {
      // rascunho retorna 404
      const code = r.motivo === "NAO_PUBLICADO" ? 404 : 403;
      console.warn(
        "⛔ acesso negado ao evento:",
        eventoId,
        "motivo:",
        r.motivo,
        "status:",
        code
      );
      console.groupEnd();
      return res.status(code).json({ ok: false, motivo: r.motivo });
    }

    console.log("✅ permitido");
    console.groupEnd();
    return res.json({ ok: true });
  } catch (e) {
    console.error("❌ verificarVisibilidadeEvento erro:", e);
    console.groupEnd();
    return res
      .status(500)
      .json({ ok: false, erro: "ERRO_INTERNO" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🆕 Detalhes do evento condicionado ao acesso (/:id/detalhes)
   ===================================================================== */
async function obterDetalhesEventoComRestricao(req, res) {
  console.group(
    "🔍[obterDetalhesEventoComRestricao] params:",
    req.params
  );
  const usuarioId = getUsuarioId(req);
  console.log("usuarioId:", usuarioId);

  if (!usuarioId) {
    console.warn("⛔ não autenticado");
    console.groupEnd();
    return res
      .status(401)
      .json({ ok: false, erro: "NAO_AUTENTICADO" });
  }

  const eventoId = Number(req.params.id);
  console.log("eventoId:", eventoId);
  if (!Number.isFinite(eventoId)) {
    console.warn("⛔ EVENTO_ID_INVALIDO");
    console.groupEnd();
    return res
      .status(400)
      .json({ ok: false, erro: "EVENTO_ID_INVALIDO" });
  }

  const client = await pool.connect();
  try {
    const r = await podeVerPorRegistro({
      client,
      usuarioId,
      eventoId,
      req,
    });
    console.log("resultado podeVerPorRegistro:", r);
    if (!r.ok) {
      console.warn("⛔ acesso negado:", r.motivo);
      console.groupEnd();
      return res
        .status(403)
        .json({ ok: false, motivo: r.motivo });
    }

    console.log("✅ permitido, delegando para buscarEventoPorId");
    console.groupEnd();
    // reaproveita a resposta detalhada já existente
    return buscarEventoPorId(req, res);
  } catch (e) {
    console.error("❌ obterDetalhesEventoComRestricao erro:", e);
    console.groupEnd();
    return res
      .status(500)
      .json({ ok: false, erro: "ERRO_INTERNO" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas de um evento (com datas reais)
   ===================================================================== */
async function listarTurmasDoEvento(req, res) {
  console.group("📚[listarTurmasDoEvento] params:", req.params);
  const { id } = req.params;
  const admin = isAdmin(req);
  console.log("isAdmin:", admin, "evento:", id);

  try {
    const result = await query(
      `
        SELECT 
          t.id, t.nome, t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,
          e.titulo, e.descricao, e.local,
          COALESCE(array_agg(DISTINCT u.nome) FILTER (WHERE u.nome IS NOT NULL), '{}') AS instrutor
        FROM eventos e
        JOIN turmas t ON t.evento_id = e.id
        LEFT JOIN evento_instrutor ei ON ei.evento_id = e.id
        LEFT JOIN usuarios u ON u.id = ei.instrutor_id
        WHERE e.id = $1
        ${admin ? "" : "AND e.publicado = TRUE"}
        GROUP BY t.id, e.id
        ORDER BY t.data_inicio, t.id
        `,
      [id]
    );

    console.log("turmas brutas:", result.rowCount);

    const turmas = [];
    for (const r of result.rows) {
      console.group("→ turma id:", r.id);
      const datasQ = await query(
        `SELECT data, horario_inicio, horario_fim 
           FROM datas_turma
          WHERE turma_id = $1
          ORDER BY data ASC`,
        [r.id]
      );
      const datas = (datasQ.rows || [])
        .map((d) => ({
          data: toYmd(d.data),
          horario_inicio: toHm(d.horario_inicio),
          horario_fim: toHm(d.horario_fim),
        }))
        .filter((x) => x.data);

      // calcula status
      const data_ini =
        toYmd(r.data_inicio) || datas[0]?.data || null;
      const data_fim =
        toYmd(r.data_fim) || datas.at(-1)?.data || null;
      const hiCalc =
        toHm(r.horario_inicio) ||
        datas[0]?.horario_inicio ||
        "00:00";
      const hfCalc =
        toHm(r.horario_fim) ||
        datas.at(-1)?.horario_fim ||
        "23:59";

      let status_turma = "programado";
      if (data_ini && data_fim) {
        const st = await query(
          `
          SELECT
            CASE
              WHEN CURRENT_TIMESTAMP::timestamp < ($1::date + $2::time) THEN 'programado'
              WHEN CURRENT_TIMESTAMP::timestamp <= ($3::date + $4::time) THEN 'andamento'
              ELSE 'encerrado'
            END AS status
          `,
          [data_ini, hiCalc, data_fim, hfCalc]
        );
        status_turma = st.rows?.[0]?.status || "programado";
      }

      console.log("status_turma:", status_turma);

      turmas.push({ ...r, datas, status: status_turma });
      console.groupEnd();
    }

    console.log("✅ respondendo", turmas.length, "turmas");
    console.groupEnd();
    res.json(turmas);
  } catch (err) {
    console.error(
      "❌ Erro ao buscar turmas do evento:",
      err.message
    );
    console.groupEnd();
    res
      .status(500)
      .json({ erro: "Erro ao buscar turmas do evento." });
  }
}

// ======================================================================
// 🔄 Atualizar evento (metadados, restrição e turmas) — COMPLETO
// ======================================================================
async function atualizarEvento(req, res) {
  console.group(
    "✏️[atualizarEvento] params:",
    req.params,
    "body:",
    req.body
  );

  const eventoId = Number(req.params.id);
  console.log("eventoId:", eventoId);
  if (!eventoId) {
    console.warn("⛔ EVENTO_ID_INVALIDO");
    console.groupEnd();
    return res.status(400).json({ erro: "EVENTO_ID_INVALIDO" });
  }

  const {
    titulo,
    descricao,
    local,
    tipo,
    unidade_id,
    publico_alvo,
    instrutor, // [ids]
    turmas, // opcional
    restrito,
    restrito_modo,
    registros,
    registros_permitidos,
  } = req.body || {};

  // flags: cliente tentou mexer na lista de registros?
  const listaFoiEnviada =
    Object.prototype.hasOwnProperty.call(req.body || {}, "registros") ||
    Object.prototype.hasOwnProperty.call(
      req.body || {},
      "registros_permitidos"
    );

  console.log("listaFoiEnviada:", listaFoiEnviada);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // estado atual do evento
    const curQ = await client.query(
      `SELECT restrito, restrito_modo FROM eventos WHERE id = $1`,
      [eventoId]
    );
    if (curQ.rowCount === 0) {
      console.warn("⛔ evento não encontrado:", eventoId);
      await client.query("ROLLBACK");
      console.groupEnd();
      return res.status(404).json({ erro: "Evento não encontrado" });
    }
    const atual = curQ.rows[0];
    console.log("estado atual restrito:", atual);

    // determina estado final de restrição
    const restritoFinal =
      typeof restrito !== "undefined" ? !!restrito : !!atual.restrito;

    let modoFinal;
    if (typeof restrito_modo !== "undefined") {
      if (restritoFinal && !ALLOWED_MODOS.has(String(restrito_modo))) {
        console.warn("⛔ restrito_modo inválido:", restrito_modo);
        await client.query("ROLLBACK");
        console.groupEnd();
        return res.status(400).json({
          erro:
            "restrito_modo inválido. Use 'todos_servidores' ou 'lista_registros'.",
        });
      }
      modoFinal = restritoFinal ? String(restrito_modo || "") : null;
    } else {
      modoFinal = restritoFinal ? atual.restrito_modo || null : null;
    }

    console.log("restritoFinal:", restritoFinal, "modoFinal:", modoFinal);

    // 1) Atualiza campos simples do evento
    await client.query(
      `
      UPDATE eventos SET
        titulo        = COALESCE($2, titulo),
        descricao     = COALESCE($3, descricao),
        local         = COALESCE($4, local),
        tipo          = COALESCE($5, tipo),
        unidade_id    = COALESCE($6, unidade_id),
        publico_alvo  = COALESCE($7, publico_alvo),
        restrito      = $8,
        restrito_modo = $9
      WHERE id = $1
      `,
      [
        eventoId,
        titulo ?? null,
        descricao ?? null,
        local ?? null,
        tipo ?? null,
        unidade_id ?? null,
        publico_alvo ?? null,
        restritoFinal,
        typeof modoFinal === "string" ? modoFinal || null : null,
      ]
    );
    console.log("✅ evento base atualizado");

    // 2) Instrutores (se enviado, substitui)
    if (Array.isArray(instrutor)) {
      console.log(
        "→ atualizando instrutor(es), substituindo lista inteira:",
        instrutor
      );
      await client.query(
        `DELETE FROM evento_instrutor WHERE evento_id = $1`,
        [eventoId]
      );
      for (const instrutor_id of instrutor) {
        console.log("→ vinculando instrutor", instrutor_id);
        await client.query(
          `INSERT INTO evento_instrutor (evento_id, instrutor_id)
           VALUES ($1,$2)`,
          [eventoId, instrutor_id]
        );
      }
    }

    // 2.1) Lista de registros por restrição
    if (!restritoFinal || modoFinal === MODO_TODOS) {
      console.log(
        "→ restrição OFF ou modo TODOS. Limpando evento_registros"
      );
      await client.query(
        `DELETE FROM evento_registros WHERE evento_id = $1`,
        [eventoId]
      );
    } else if (modoFinal === MODO_LISTA) {
      if (listaFoiEnviada) {
        console.log(
          "→ modo LISTA, nova lista foi enviada. Atualizando registros."
        );
        const input =
          typeof registros_permitidos !== "undefined"
            ? registros_permitidos
            : registros;
        const regList = normalizeListaRegistros(input);
        console.log("regList normalizada:", regList);

        if (regList.length === 0) {
          console.warn("⛔ regList vazia/ruim");
          await client.query("ROLLBACK");
          console.groupEnd();
          return res
            .status(400)
            .json({ erro: "Registros inválidos." });
        }

        await client.query(
          `DELETE FROM evento_registros WHERE evento_id = $1`,
          [eventoId]
        );
        for (const r of regList) {
          await client.query(
            `INSERT INTO evento_registros (evento_id, registro_norm)
             VALUES ($1,$2)
             ON CONFLICT DO NOTHING`,
            [eventoId, r]
          );
        }
      } else {
        console.log(
          "→ modo LISTA mas listaFoiEnviada=FALSE, mantendo vínculos atuais"
        );
      }
    }

    // 3) Se turmas NÃO veio no body, paramos aqui
    if (!Array.isArray(turmas)) {
      console.log(
        "turmas não enviada no body. Finalizando somente metadados/restrição."
      );
      await client.query("COMMIT");
      console.groupEnd();
      return res.json({
        ok: true,
        mensagem: "Evento atualizado (metadados e restrição).",
      });
    }

    console.log("→ sincronizando turmas:", turmas.length);

    // estado atual das turmas
    const { rows: atuais } = await client.query(
      `
      SELECT
        t.id,
        t.nome,
        t.vagas_total,
        t.carga_horaria,
        (SELECT COUNT(*)::int FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos
      FROM turmas t
      WHERE t.evento_id = $1
      ORDER BY t.id
      `,
      [eventoId]
    );

    console.log("turmas atuais:", atuais);

    const mapaAtuais = new Map(atuais.map((t) => [t.id, t]));
    const idsPayload = new Set(
      turmas
        .filter((t) => Number.isFinite(Number(t.id)))
        .map((t) => Number(t.id))
    );

    // turmas que sumiram = remoção
    const remover = atuais.filter((t) => !idsPayload.has(t.id));
    const bloqueadasRemocao = remover.filter(
      (t) => (t.inscritos || 0) > 0
    );

    if (bloqueadasRemocao.length) {
      console.warn(
        "⛔ tentativa de remover turma com inscritos:",
        bloqueadasRemocao
      );
      await client.query("ROLLBACK");
      console.groupEnd();
      return res.status(409).json({
        erro: "TURMA_COM_INSCRITOS",
        detalhe:
          "Não é permitido REMOVER turmas que já possuem inscritos.",
        turmas_bloqueadas: bloqueadasRemocao.map((t) => ({
          id: t.id,
          nome: t.nome,
          inscritos: t.inscritos,
        })),
      });
    }

    const bloqueios = [];

    // helper normalizar datas vindas do front
    const extrairDatas = (t) => {
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
            ? {
                data: toYmd(e),
                horario_inicio: null,
                horario_fim: null,
              }
            : {
                data: toYmd(e?.data),
                horario_inicio: hhmm(e?.inicio || ""),
                horario_fim: hhmm(e?.fim || ""),
              }
        );
      }
      return [];
    };

    for (const t of turmas) {
      console.group("📝 sync turma payload:", t);

      const id = Number(t.id);

      // 3.a) NOVA TURMA
      if (!Number.isFinite(id)) {
        console.log("→ nova turma (sem id)");

        const nome = String(t.nome || "Turma").trim();
        const vagas_total = Number.isFinite(Number(t.vagas_total))
          ? Number(t.vagas_total)
          : null;
        const carga_horaria = Number.isFinite(Number(t.carga_horaria))
          ? Number(t.carga_horaria)
          : null;

        const baseDatas = extrairDatas(t);
        console.log("baseDatas:", baseDatas);

        if (!baseDatas.length) {
          console.warn("⛔ nova turma sem datas:", nome);
          bloqueios.push({
            id: null,
            nome,
            motivo: "TURMA_SEM_DATAS",
          });
          console.groupEnd();
          continue;
        }

        const ordenadas = [...baseDatas]
          .filter((d) => d.data)
          .sort((a, b) =>
            String(a.data).localeCompare(String(b.data))
          );

        const data_inicio = ordenadas[0].data;
        const data_fim = ordenadas.at(-1).data;

        const hiPayload = hhmm(t?.horario_inicio || "") || null;
        const hfPayload = hhmm(t?.horario_fim || "") || null;

        const insTurma = await client.query(
          `INSERT INTO turmas (
             evento_id,
             nome,
             vagas_total,
             carga_horaria,
             data_inicio,
             data_fim,
             horario_inicio,
             horario_fim
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id`,
          [
            eventoId,
            nome,
            vagas_total,
            carga_horaria,
            data_inicio,
            data_fim,
            hiPayload,
            hfPayload,
          ]
        );
        const turmaId = insTurma.rows[0].id;
        console.log("✅ nova turma criada ID:", turmaId);

        for (const d of ordenadas) {
          if (!d.data) continue;
          const inicioSeguro =
            d.horario_inicio || hiPayload || "08:00";
          const fimSeguro =
            d.horario_fim || hfPayload || "17:00";

          console.log(
            "→ datas_turma nova:",
            turmaId,
            d.data,
            inicioSeguro,
            fimSeguro
          );

          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1,$2,$3,$4)`,
            [turmaId, d.data, inicioSeguro, fimSeguro]
          );
        }

        console.groupEnd();
        continue;
      }

      // 3.b) TURMA EXISTENTE
      console.log("→ turma existente id:", id);
      const atualT = mapaAtuais.get(id);
      if (!atualT) {
        console.warn(
          "⚠️ turma não pertence ao evento ou não encontrada:",
          id
        );
        console.groupEnd();
        continue;
      }

      const inscritos = atualT.inscritos || 0;
      console.log("inscritos:", inscritos);

      const veioDatas =
        Array.isArray(t?.datas) || Array.isArray(t?.encontros);

      const novoVagas = Number.isFinite(Number(t?.vagas_total))
        ? Number(t.vagas_total)
        : null;

      const vaiDiminuirAbaixoInscritos =
        novoVagas != null && novoVagas < inscritos;

      if (inscritos > 0 && (veioDatas || vaiDiminuirAbaixoInscritos)) {
        console.warn(
          "⛔ alteração bloqueada em turma com inscritos:",
          id,
          "veioDatas?",
          veioDatas,
          "vaiDiminuirAbaixoInscritos?",
          vaiDiminuirAbaixoInscritos
        );
        bloqueios.push({
          id,
          nome: atualT.nome,
          inscritos,
          motivo: veioDatas
            ? "ALTERACAO_DE_DATAS"
            : "DIMINUICAO_DE_VAGAS_ABAIXO_INSCRITOS",
        });
        console.groupEnd();
        continue;
      }

      const cargaHorariaNumero = Number.isFinite(
        Number(t?.carga_horaria)
      )
        ? Number(t.carga_horaria)
        : null;

      const hiPayload = hhmm(t?.horario_inicio || "") || null;
      const hfPayload = hhmm(t?.horario_fim || "") || null;

      console.log("→ UPDATE turmas (campos simples) id:", id);
      await client.query(
        `UPDATE turmas
           SET nome           = COALESCE($2, nome),
               vagas_total    = COALESCE($3, vagas_total),
               carga_horaria  = COALESCE($4, carga_horaria),
               horario_inicio = COALESCE($5, horario_inicio),
               horario_fim    = COALESCE($6, horario_fim)
         WHERE id = $1`,
        [
          id,
          t.nome ?? null,
          novoVagas != null ? novoVagas : null,
          cargaHorariaNumero,
          hiPayload,
          hfPayload,
        ]
      );

      // se não há inscritos e o payload trouxe novas datas,
      // substitui datas_turma
      if (inscritos === 0 && veioDatas) {
        console.log(
          "→ turma sem inscritos e veioDatas=TRUE. Recriando datas_turma id:",
          id
        );

        const baseDatas = extrairDatas(t);
        const ordenadas = [...baseDatas]
          .filter((d) => d.data)
          .sort((a, b) =>
            String(a.data).localeCompare(String(b.data))
          );

        const di =
          ordenadas[0]?.data || t.data_inicio || null;
        const df =
          ordenadas.at(-1)?.data ||
          t.data_fim ||
          ordenadas[0]?.data ||
          t.data_inicio ||
          null;

        console.log("→ limpando datas_turma antigas da turma", id);
        await client.query(
          `DELETE FROM datas_turma WHERE turma_id=$1`,
          [id]
        );

        for (const d of ordenadas) {
          if (!d.data) continue;
          const inicioSeguro =
            d.horario_inicio || hiPayload || "08:00";
          const fimSeguro =
            d.horario_fim || hfPayload || "17:00";

          console.log(
            "→ criando datas_turma:",
            id,
            d.data,
            inicioSeguro,
            fimSeguro
          );

          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1,$2,$3,$4)`,
            [id, d.data, inicioSeguro, fimSeguro]
          );
        }

        if (di && df) {
          console.log(
            "→ atualizando período da turma id:",
            id,
            "di:",
            di,
            "df:",
            df
          );
          await client.query(
            `UPDATE turmas
                SET data_inicio=$2,
                    data_fim=$3
              WHERE id=$1`,
            [id, di, df]
          );
        }
      }

      console.groupEnd();
    }

    // Se houve bloqueios, aborta
    if (bloqueios.length) {
      console.warn(
        "⛔ bloqueios durante atualização de turmas. rollback.",
        bloqueios
      );
      await client.query("ROLLBACK");
      console.groupEnd();
      return res.status(409).json({
        erro: "TURMA_COM_INSCRITOS",
        detalhe:
          "Algumas turmas possuem inscritos: não é permitido alterar grade de datas ou reduzir vagas abaixo do total de inscritos.",
        turmas_bloqueadas: bloqueios,
      });
    }

    // remove turmas (sem inscritos) que sumiram
    for (const t of remover) {
      console.log(
        "🗑 removendo turma sem inscritos e que sumiu do payload:",
        t.id
      );
      await client.query(
        `DELETE FROM datas_turma WHERE turma_id=$1`,
        [t.id]
      );
      await client.query(`DELETE FROM turmas WHERE id=$1`, [t.id]);
    }

    await client.query("COMMIT");
    console.log("✅ Evento atualizado com sucesso:", eventoId);
    console.groupEnd();
    return res.json({
      ok: true,
      mensagem: "Evento atualizado com sucesso.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ atualizarEvento erro:", err);
    console.groupEnd();
    return res.status(500).json({
      erro: "Erro ao atualizar evento com turmas",
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ❌ Excluir evento (sem cascata, removendo vínculos explicitamente)
   ===================================================================== */
async function excluirEvento(req, res) {
  console.group("🗑[excluirEvento] params:", req.params);

  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    console.log("→ limpando presencas de turmas do evento:", id);
    await client.query(
      `DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );

    console.log("→ limpando datas_turma do evento:", id);
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );

    console.log("→ limpando turmas do evento:", id);
    await client.query("DELETE FROM turmas WHERE evento_id = $1", [id]);

    console.log("→ limpando evento_instrutor do evento:", id);
    await client.query(
      "DELETE FROM evento_instrutor WHERE evento_id = $1",
      [id]
    );

    console.log("→ limpando evento_registros do evento:", id);
    await client.query(
      "DELETE FROM evento_registros WHERE evento_id = $1",
      [id]
    );

    console.log("→ deletando próprio evento:", id);
    const result = await client.query(
      "DELETE FROM eventos WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      console.warn("⛔ evento não encontrado ao excluir:", id);
      await client.query("ROLLBACK");
      console.groupEnd();
      return res.status(404).json({ erro: "Evento não encontrado" });
    }

    await client.query("COMMIT");
    console.log("✅ Evento excluído com sucesso:", id);
    console.groupEnd();
    res.json({
      mensagem: "Evento excluído com sucesso",
      evento: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao excluir evento:", err.message);
    console.groupEnd();
    res
      .status(500)
      .json({ erro: "Erro ao excluir evento" });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Agenda (ocorrências = datas reais)
   ===================================================================== */
async function getAgendaEventos(req, res) {
  console.group("🗓[getAgendaEventos]");
  const sqlBase = (useDataPresenca = false) => `
    SELECT 
      e.id,
      e.titulo,

      MIN(t.data_inicio)    AS data_inicio,
      MAX(t.data_fim)       AS data_fim,
      MIN(t.horario_inicio) AS horario_inicio,
      MAX(t.horario_fim)    AS horario_fim,

      CASE 
  WHEN CURRENT_TIMESTAMP::timestamp < MIN(t.data_inicio::date + COALESCE(t.horario_inicio::time,'00:00'::time)) THEN 'programado'
  WHEN CURRENT_TIMESTAMP::timestamp <= MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time)) THEN 'andamento'
  ELSE 'encerrado'
END AS status,

      CASE
        WHEN EXISTS (
          SELECT 1 FROM turmas tx JOIN datas_turma dt ON dt.turma_id = tx.id WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d)
            FROM (
              SELECT DISTINCT to_char(dt.data::date, 'YYYY-MM-DD') AS d
                FROM turmas tx
                JOIN datas_turma dt ON dt.turma_id = tx.id
               WHERE tx.evento_id = e.id
               ORDER BY 1
            ) z1
        )
        WHEN EXISTS (
          SELECT 1 FROM turmas tx JOIN presencas p ON p.turma_id = tx.id WHERE tx.evento_id = e.id
        ) THEN (
          SELECT json_agg(d ORDER BY d)
            FROM (
              SELECT DISTINCT to_char(p.${
                useDataPresenca ? "data_presenca" : "data"
              }::date, 'YYYY-MM-DD') AS d
                FROM turmas tx
                JOIN presencas p ON p.turma_id = tx.id
               WHERE tx.evento_id = e.id
               ORDER BY 1
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
      console.log("→ tentando agenda com presencas.data");
      ({ rows } = await query(sqlBase(false), []));
    } catch (errA) {
      console.warn(
        "⚠️ falhou com p.data, tentando p.data_presenca:",
        errA.message
      );
      ({ rows } = await query(sqlBase(true), []));
    }

    const out = rows.map((r) => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias)
        ? r.ocorrencias
        : [],
    }));

    console.log("✅ agenda size:", out.length);
    console.groupEnd();

    res.set(
      "X-Agenda-Handler",
      "eventosController:getAgendaEventos@estrita"
    );
    res.json(out);
  } catch (err) {
    console.error("❌ Erro ao buscar agenda:", err);
    console.groupEnd();
    res.status(500).json({ erro: "Erro ao buscar agenda" });
  }
}

/* =====================================================================
   🔎 Listar eventos do instrutor (sem filtro de visibilidade)
   ===================================================================== */
async function listarEventosDoinstrutor(req, res) {
  console.group("👨‍🏫[listarEventosDoinstrutor]");
  const usuarioId = getUsuarioId(req);
  console.log("usuarioId:", usuarioId);

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

        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos,

        (SELECT COUNT(*) FROM evento_registros er WHERE er.evento_id = e.id)
          AS count_registros_permitidos

      FROM eventos e
JOIN evento_instrutor ei ON ei.evento_id = e.id
WHERE ei.instrutor_id = $1
  AND e.publicado = TRUE  
      ORDER BY e.id
      `,
      [usuarioId]
    );

    console.log(
      "eventosResult.rowCount:",
      eventosResult.rowCount
    );

    const eventos = [];
    for (const evento of eventosResult.rows) {
      console.group("→ evento instrutor id:", evento.id);

      const turmasResult = await client.query(
        `
        SELECT 
          t.id, t.nome, t.data_inicio, t.data_fim,
          t.horario_inicio, t.horario_fim,
          t.vagas_total, t.carga_horaria,

          (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos,
          (SELECT COUNT(*) FROM inscricoes i WHERE i.turma_id = t.id) AS inscritos_confirmados

        FROM turmas t
        WHERE t.evento_id = $1
        ORDER BY t.data_inicio
        `,
        [evento.id]
      );

      console.log(
        "→ turmasResult.rowCount:",
        turmasResult.rowCount
      );

      const instrutorResult = await client.query(
        `SELECT u.id, u.nome
           FROM evento_instrutor ei
           JOIN usuarios u ON u.id = ei.instrutor_id
          WHERE ei.evento_id = $1`,
        [evento.id]
      );
      console.log(
        "→ instrutores vinculados:",
        instrutorResult.rows.map((i) => i.id)
      );

      const turmas = [];
      for (const t of turmasResult.rows) {
        const datasQ = await client.query(
          `SELECT data, horario_inicio, horario_fim 
             FROM datas_turma
            WHERE turma_id = $1
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

        turmas.push({ ...t, datas });
      }

      eventos.push({
        ...evento,
        instrutor: instrutorResult.rows,
        turmas,
      });

      console.groupEnd();
    }

    console.log("✅ respondendo", eventos.length, "eventos");
    console.groupEnd();
    res.json(eventos);
  } catch (err) {
    console.error(
      "❌ Erro ao buscar eventos do instrutor:",
      err.message
    );
    console.groupEnd();
    res.status(500).json({
      erro: "Erro ao buscar eventos do instrutor",
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📌 Listar datas da turma (endpoint utilitário)
   ===================================================================== */
async function listarDatasDaTurma(req, res) {
  console.group("🗓[listarDatasDaTurma] params:", req.params, "query:", req.query);

  const turmaId = Number(req.params.id);
  const via = String(req.query.via || "datas").toLowerCase();

  console.log("turmaId:", turmaId, "via:", via);

  if (!Number.isFinite(turmaId)) {
    console.warn("⛔ turma_id inválido");
    console.groupEnd();
    return res.status(400).json({ erro: "turma_id inválido" });
  }

  try {
    if (via === "datas") {
      console.log("→ via=datas");
      const sql = `
        SELECT 
          to_char(dt.data, 'YYYY-MM-DD') AS data,
          to_char(dt.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(dt.horario_fim,   'HH24:MI') AS horario_fim
        FROM datas_turma dt
        WHERE dt.turma_id = $1
        ORDER BY dt.data ASC;
      `;
      const { rows } = await query(sql, [turmaId]);
      console.log("rows:", rows.length);
      console.groupEnd();
      return res.json(rows);
    }

    if (via === "presencas") {
      console.log("→ via=presencas (tentando colunas diferentes)");
      const sqlA = `
        SELECT DISTINCT
          to_char(p.data::date, 'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,   'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC;
      `;
      const sqlB = `
        SELECT DISTINCT
          to_char(p.data_presenca::date, 'YYYY-MM-DD') AS data,
          to_char(t.horario_inicio, 'HH24:MI') AS horario_inicio,
          to_char(t.horario_fim,   'HH24:MI') AS horario_fim
        FROM presencas p
        JOIN turmas t ON t.id = p.turma_id
        WHERE p.turma_id = $1
        ORDER BY data ASC;
      `;

      try {
        const { rows } = await query(sqlA, [turmaId]);
        console.log("rows via.sqlA:", rows.length);
        console.groupEnd();
        return res.json(rows);
      } catch (errA) {
        console.warn("⚠️ falha sqlA, tentando sqlB:", errA.message);
        try {
          const { rows } = await query(sqlB, [turmaId]);
          console.log("rows via.sqlB:", rows.length);
          console.groupEnd();
          return res.json(rows);
        } catch (errB) {
          console.error("❌ falha sqlB também:", errB.message);
          console.groupEnd();
          return res.json([]);
        }
      }
    }

    console.log("→ via=intervalo (generate_series)");
    const sql = `
      WITH t AS (
        SELECT
          data_inicio::date AS di,
          data_fim::date    AS df,
          to_char(horario_inicio, 'HH24:MI') AS hi,
          to_char(horario_fim,   'HH24:MI') AS hf
        FROM turmas
        WHERE id = $1
      )
      SELECT
        to_char(gs::date, 'YYYY-MM-DD') AS data,
        t.hi AS horario_inicio,
        t.hf AS horario_fim
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data ASC;
    `;
    const { rows } = await query(sql, [turmaId]);
    console.log("rows generate_series:", rows.length);
    console.groupEnd();
    return res.json(rows);
  } catch (erro) {
    console.error("❌ Erro ao buscar datas da turma:", erro);
    console.groupEnd();
    return res.status(500).json({
      erro: "Erro ao buscar datas da turma.",
      detalhe: erro.message,
    });
  }
}

/* ===================================================================== */
module.exports = {
  // existentes
  listarEventos,
  criarEvento,
  buscarEventoPorId,
  atualizarEvento,
  excluirEvento,
  listarTurmasDoEvento,
  getAgendaEventos,
  listarEventosDoinstrutor,
  listarDatasDaTurma,

  // novos
  listarEventosParaMim,
  verificarVisibilidadeEvento,
  obterDetalhesEventoComRestricao,

  publicarEvento,
  despublicarEvento,
};
