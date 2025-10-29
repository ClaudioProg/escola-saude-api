// ✅ src/controllers/eventosController.js
/* eslint-disable no-console */
const { pool, query } = require('../db');
const { normalizeRegistro, normalizeListaRegistros } = require('../utils/registro');

/* =====================================================================
   Helpers de datas/horários (sem “pulo” de fuso)
   ===================================================================== */
function hhmm(s, fb = '') {
  if (!s) return fb;
  const str = String(s).trim().slice(0, 5);
  return /^\d{2}:\d{2}$/.test(str) ? str : (fb || '');
}
function iso(s) {
  return typeof s === 'string' ? s.slice(0, 10) : '';
}
function toYmd(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d2}`;
}
function toHm(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 5);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* =====================================================================
   Helpers de restrição
   ===================================================================== */
const MODO_TODOS = 'todos_servidores';
const MODO_LISTA = 'lista_registros';
const ALLOWED_MODOS = new Set([MODO_TODOS, MODO_LISTA]);

function getPerfisFromReq(req) {
  const raw = req.user?.perfil ?? req.user?.perfis ?? [];
  if (Array.isArray(raw)) return raw.map((p) => String(p).toLowerCase());
  return String(raw).split(',').map((p) => p.replace(/[\[\]"]/g, '').trim().toLowerCase()).filter(Boolean);
}
function isAdmin(req) {
  return getPerfisFromReq(req).includes('administrador');
}
function isInstrutorPerfil(req) {
  const p = getPerfisFromReq(req);
  return p.includes('instrutor') || p.includes('administrador');
}
const getUsuarioId = (req) => (req.user?.id ?? req.user?.id ?? null);

/* =====================================================================
   🔐 Núcleo de checagem por REGISTRO (reuso interno)
   ===================================================================== */
   /* =====================================================================
   🔐 Núcleo de checagem por REGISTRO (reuso interno)
   ===================================================================== */
async function podeVerPorRegistro({ client, usuarioId, eventoId, req }) {
  const admin = isAdmin(req);

  const evQ = await client.query(
    `SELECT id, restrito, restrito_modo, publicado
       FROM eventos
      WHERE id = $1`,
    [eventoId]
  );
  const evento = evQ.rows[0];
  if (!evento) return { ok: false, motivo: 'EVENTO_NAO_ENCONTRADO' };

  // 🚫 Não publicado → só admin enxerga (páginas públicas não devem ver rascunho)
  if (!admin && !evento.publicado) {
    return { ok: false, motivo: 'NAO_PUBLICADO' };
  }

  // Admin pode ver qualquer coisa
  if (admin) return { ok: true };

  // 🔒 Regras de restrição por registro (para usuários não-admin)
  if (!evento.restrito) return { ok: true };

  if (!usuarioId) return { ok: false, motivo: 'NAO_AUTENTICADO' };
  const uQ = await client.query(`SELECT registro FROM usuarios WHERE id = $1`, [usuarioId]);
  const regNorm = normalizeRegistro(uQ.rows?.[0]?.registro || '');

  if (evento.restrito_modo === MODO_TODOS) {
    return regNorm ? { ok: true } : { ok: false, motivo: 'SEM_REGISTRO' };
  }

  if (evento.restrito_modo === MODO_LISTA) {
    if (!regNorm) return { ok: false, motivo: 'SEM_REGISTRO' };
    const hit = await client.query(
      `SELECT 1 FROM evento_registros WHERE evento_id = $1 AND registro_norm = $2 LIMIT 1`,
      [eventoId, regNorm]
    );
    return hit.rowCount > 0
      ? { ok: true }
      : { ok: false, motivo: 'REGISTRO_NAO_AUTORIZADO' };
  }

  return { ok: false, motivo: 'MODO_RESTRICAO_INVALIDO' };
}

/* =====================================================================
   🚀 Publicar / Despublicar evento (admin)
   ===================================================================== */
   async function publicarEvento(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ erro: 'PERMISSAO_NEGADA' });
  
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: 'EVENTO_ID_INVALIDO' });
  
    try {
      const r = await query(`UPDATE eventos SET publicado = TRUE WHERE id = $1 RETURNING id, publicado`, [id]);
      if (r.rowCount === 0) return res.status(404).json({ erro: 'EVENTO_NAO_ENCONTRADO' });
      return res.json({ ok: true, mensagem: 'Evento publicado.', evento: r.rows[0] });
    } catch (e) {
      console.error('❌ publicarEvento:', e);
      return res.status(500).json({ erro: 'ERRO_INTERNO' });
    }
  }
  
  async function despublicarEvento(req, res) {
    if (!isAdmin(req)) return res.status(403).json({ erro: 'PERMISSAO_NEGADA' });
  
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: 'EVENTO_ID_INVALIDO' });
  
    try {
      const r = await query(`UPDATE eventos SET publicado = FALSE WHERE id = $1 RETURNING id, publicado`, [id]);
      if (r.rowCount === 0) return res.status(404).json({ erro: 'EVENTO_NAO_ENCONTRADO' });
      return res.json({ ok: true, mensagem: 'Evento despublicado.', evento: r.rows[0] });
    } catch (e) {
      console.error('❌ despublicarEvento:', e);
      return res.status(500).json({ erro: 'ERRO_INTERNO' });
    }
  }

/* =====================================================================
   📄 Listar todos os eventos (com resumo)
   ===================================================================== */
async function listarEventos(req, res) {
  try {
    const usuarioId = getUsuarioId(req);
    const admin = isAdmin(req);

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
  WHERE ${admin ? 'TRUE' : '(e.publicado = TRUE OR e.id IN (SELECT evento_id FROM sou_instrutor))'}
  GROUP BY e.id
  ORDER BY (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
          FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
         e.id DESC;
`;

    const params = [usuarioId, usuarioId];
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar eventos:', err.stack || err.message);
    res.status(500).json({ erro: 'Erro ao listar eventos' });
  }
}

/* =====================================================================
   🆕 Listar eventos "para mim" (aplica regra por registro no SQL)
   ===================================================================== */
async function listarEventosParaMim(req, res) {
  const usuarioId = req.user?.id ?? null;
  if (!usuarioId) return res.status(401).json({ ok: false, erro: 'NAO_AUTENTICADO' });

  const client = await pool.connect();
  try {
    // registro normalizado do usuário
    const uQ = await client.query(`SELECT registro FROM usuarios WHERE id = $1`, [usuarioId]);
    const regNorm = normalizeRegistro(uQ.rows?.[0]?.registro || '');

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
          WHERE ei.evento_id = e.id AND ei.instrutor_id = $2
        ) AS ja_instrutor

      FROM base e
      ORDER BY
  (SELECT MAX(t.data_fim::date + COALESCE(t.horario_fim::time,'23:59'::time))
     FROM turmas t WHERE t.evento_id = e.id) DESC NULLS LAST,
  e.id DESC;
    `;

    const params = [usuarioId, usuarioId, MODO_TODOS, regNorm, MODO_LISTA];
    const { rows } = await client.query(sql, params);
    return res.json({ ok: true, eventos: rows });
  } catch (err) {
    console.error('❌ listarEventosParaMim:', err);
    return res.status(500).json({ ok: false, erro: 'ERRO_INTERNO' });
  } finally {
    client.release();
  }
}

  
/* =====================================================================
   ➕ Criar evento (persiste turmas + datas_turma + restrição)
   ===================================================================== */
async function criarEvento(req, res) {
  const {
    titulo, descricao, local, tipo, unidade_id, publico_alvo,
    instrutor = [], turmas = [],
    restrito = false, restrito_modo = null,
    // aceita ambos os nomes:
    registros,
    registros_permitidos,
  } = req.body || {};

  if (!titulo?.trim()) return res.status(400).json({ erro: "Campo 'titulo' é obrigatório." });
  if (!descricao?.trim()) return res.status(400).json({ erro: "Campo 'descricao' é obrigatório." });
  if (!local?.trim()) return res.status(400).json({ erro: "Campo 'local' é obrigatório." });
  if (!tipo?.trim()) return res.status(400).json({ erro: "Campo 'tipo' é obrigatório." });
  if (!publico_alvo?.trim()) return res.status(400).json({ erro: "Campo 'publico_alvo' é obrigatório." });
  if (!unidade_id) return res.status(400).json({ erro: "Campo 'unidade_id' é obrigatório." });
  if (!Array.isArray(instrutor) || instrutor.length === 0) {
    return res.status(400).json({ erro: 'Ao menos um instrutor deve ser selecionado.' });
  }
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return res.status(400).json({ erro: 'Ao menos uma turma deve ser criada.' });
  }

  // validação da regra de restrição
  let restritoVal = !!restrito;
  let modoVal = null;
  let regList = [];
  if (restritoVal) {
    if (!ALLOWED_MODOS.has(String(restrito_modo))) {
      return res.status(400).json({ erro: "restrito_modo inválido. Use 'todos_servidores' ou 'lista_registros'." });
    }
    modoVal = String(restrito_modo);
    if (modoVal === MODO_LISTA) {
      const input = typeof registros_permitidos !== 'undefined' ? registros_permitidos : registros;
      regList = normalizeListaRegistros(input);
      if (regList.length === 0) {
        return res.status(400).json({ erro: "Registros informados são inválidos." });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // evento
    const eventoResult = await client.query(
      `INSERT INTO eventos (
         titulo, descricao, local, tipo, unidade_id, publico_alvo,
         restrito, restrito_modo, publicado
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE)
       RETURNING *`,
      [titulo, descricao, local, tipo, unidade_id, publico_alvo, restritoVal, modoVal]
    );
    const evento = eventoResult.rows[0];
    const eventoId = evento.id;

    // instrutores
    for (const instrutorId of instrutor) {
      await client.query(
        `INSERT INTO evento_instrutor (evento_id, instrutor_id) VALUES ($1, $2)`,
        [eventoId, instrutorId]
      );
    }

    // turmas + datas
    for (const t of turmas) {
      const nome = (t?.nome || '').trim();
      const data_inicio = iso(t?.data_inicio);
      const data_fim = iso(t?.data_fim);
      const horario_inicio = hhmm(t?.horario_inicio || '08:00', '08:00');
      const horario_fim = hhmm(t?.horario_fim || '17:00', '17:00');
      const vagas_total = t?.vagas_total ?? t?.vagas ?? null;
      const carga_horaria = t?.carga_horaria != null ? Number(t.carga_horaria) : null;

      if (!nome || !data_inicio || !data_fim || vagas_total == null || carga_horaria == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Todos os campos da turma são obrigatórios.' });
      }

      const turmaIns = await client.query(
        `INSERT INTO turmas (evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [eventoId, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria]
      );
      const turmaId = turmaIns.rows[0].id;

      const baseHi = horario_inicio;
      const baseHf = horario_fim;
      const encontros = Array.isArray(t?.datas) && t.datas.length
        ? t.datas.map(e => ({ data: iso(e?.data || ''), inicio: hhmm(e?.horario_inicio, baseHi), fim: hhmm(e?.horario_fim, baseHf) }))
        : Array.isArray(t?.encontros) && t.encontros.length
          ? t.encontros.map(e => (typeof e === 'string'
              ? { data: iso(e), inicio: baseHi, fim: baseHf }
              : { data: iso(e?.data || ''), inicio: hhmm(e?.inicio, baseHi), fim: hhmm(e?.fim, baseHf) }))
          : [];

      for (const e of encontros.filter(x => x.data && x.inicio && x.fim)) {
        await client.query(
          `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
           VALUES ($1, $2, $3, $4)`,
          [turmaId, e.data, e.inicio, e.fim]
        );
      }
    }

    // restrição por lista
    if (restritoVal && modoVal === MODO_LISTA && regList.length) {
      for (const r of regList) {
        await client.query(
          `INSERT INTO evento_registros (evento_id, registro_norm) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [eventoId, r]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ mensagem: 'Evento criado com sucesso', evento });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar evento:', err.message, err.stack);
    res.status(500).json({ erro: 'Erro ao criar evento' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🔍 Buscar evento por ID (com checagem de visibilidade)
   ===================================================================== */
async function buscarEventoPorId(req, res) {
  const { id } = req.params;
  const usuarioId = getUsuarioId(req);
  const admin = isAdmin(req);
  const client = await pool.connect();

  try {
    // evento
    const eventoResult = await client.query(`SELECT * FROM eventos WHERE id = $1`, [id]);
    if (eventoResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }
    const evento = eventoResult.rows[0];

    // 🔄 Status do evento (mesma regra das listas)
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
const status_evento = stEv[0]?.status || 'programado';


    
// 🔒 não-admin não pode ver detalhes de rascunho
if (!isAdmin(req) && !evento.publicado) {
  return res.status(404).json({ erro: 'NAO_PUBLICADO' }); // 404 p/ não “denunciar”
}


    // checagem de visibilidade (se não-admin)
    if (!admin) {
      // instrutor deste evento enxerga
      const isInstrutorDoEvento = usuarioId
        ? (await client.query(
            `SELECT 1 FROM evento_instrutor WHERE evento_id=$1 AND instrutor_id=$2 LIMIT 1`,
            [id, usuarioId]
          )).rowCount > 0
        : false;

      if (!isInstrutorDoEvento) {
        let podeVer = false;
        if (!evento.restrito) {
          podeVer = true;
        } else if (usuarioId) {
          const { rows } = await client.query(`SELECT registro FROM usuarios WHERE id=$1`, [usuarioId]);
          const regNorm = normalizeRegistro(rows?.[0]?.registro || '');
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
        if (!podeVer) return res.status(403).json({ erro: 'Evento restrito.' });
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

    // lista de registros (sempre)
    const regsQ = await client.query(
      `SELECT registro_norm FROM evento_registros WHERE evento_id = $1 ORDER BY registro_norm`,
      [id]
    );
    const registros_permitidos = regsQ.rows.map(r => r.registro_norm);
    const count_registros_permitidos = regsQ.rowCount; // ✅

    // turmas (com datas reais)
    const turmasBase = await client.query(
      `SELECT id, evento_id, nome, data_inicio, data_fim, horario_inicio, horario_fim, vagas_total, carga_horaria
         FROM turmas
        WHERE evento_id = $1
        ORDER BY id`,
      [id]
    );

    const turmas = [];
    for (const t of turmasBase.rows) {
      const per = await client.query(
        `SELECT MIN(data) AS di, MAX(data) AS df
           FROM datas_turma
          WHERE turma_id = $1`,
        [t.id]
      );
      const data_inicio = toYmd(per.rows[0]?.di) || toYmd(t.data_inicio);
      const data_fim    = toYmd(per.rows[0]?.df) || toYmd(t.data_fim);

      const h = await client.query(
        `SELECT horario_inicio, horario_fim, COUNT(*) AS c
           FROM datas_turma
          WHERE turma_id = $1
       GROUP BY horario_inicio, horario_fim
       ORDER BY c DESC, horario_inicio NULLS LAST, horario_fim NULLS LAST
          LIMIT 1`,
        [t.id]
      );
      let horario_inicio = '';
      let horario_fim = '';
      if (h.rowCount > 0) {
        horario_inicio = toHm(h.rows[0].horario_inicio);
        horario_fim    = toHm(h.rows[0].horario_fim);
      } else {
        horario_inicio = toHm(t.horario_inicio);
        horario_fim    = toHm(t.horario_fim);
      }

      const datasQ = await client.query(
        `SELECT data, horario_inicio, horario_fim
           FROM datas_turma
          WHERE turma_id = $1
          ORDER BY data`,
        [t.id]
      );
      let datas = datasQ.rows.map(r => ({
        data: toYmd(r.data),
        horario_inicio: toHm(r.horario_inicio),
        horario_fim: toHm(r.horario_fim),
      })).filter(d => d.data);

      if (datas.length === 0) {
        try {
          const presA = await client.query(
            `SELECT DISTINCT (p.data::date) AS d
               FROM presencas p
              WHERE p.turma_id = $1
              ORDER BY d`,
            [t.id]
          );
          datas = presA.rows.map(r => ({ data: toYmd(r.d), horario_inicio, horario_fim })).filter(d => d.data);
        } catch {
          const presB = await client.query(
            `SELECT DISTINCT (p.data_presenca::date) AS d
               FROM presencas p
              WHERE p.turma_id = $1
              ORDER BY d`,
            [t.id]
          );
          datas = presB.rows.map(r => ({ data: toYmd(r.d), horario_inicio, horario_fim })).filter(d => d.data);
        }
      }

      const inscritosQ = await client.query(
        `SELECT COUNT(*) AS total FROM inscricoes WHERE turma_id = $1`,
        [t.id]
      );
      const inscritos = Number(inscritosQ.rows[0]?.total || 0);

      const hiCalc = (horario_inicio && horario_inicio.length) ? horario_inicio : '00:00';
const hfCalc = (horario_fim    && horario_fim.length)    ? horario_fim    : '23:59';

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
const status_turma = stT[0]?.status || 'programado';

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
  status: status_turma,            // ✅ status consistente por turma
});
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
      status: status_evento, // ✅ agora o detalhe também tem status
      registros_permitidos,
      count_registros_permitidos,
      instrutor: instrutorResult.rows,
      turmas,
      ja_instrutor: Boolean(jaInstrutorResult.rows?.[0]?.eh),
      ja_inscrito: Boolean(jaInscritoResult.rows?.[0]?.eh),
    };

    res.json(eventoCompleto);
  } catch (err) {
    console.error('❌ Erro ao buscar evento por ID:', err.message, err.stack);
    res.status(500).json({ erro: 'Erro ao buscar evento por ID' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   🆕 Checagem rápida de visibilidade (/:id/visivel)
   ===================================================================== */
async function verificarVisibilidadeEvento(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ ok: false, erro: 'NAO_AUTENTICADO' });

  const eventoId = Number(req.params.id);
  if (!Number.isFinite(eventoId)) return res.status(400).json({ ok: false, erro: 'EVENTO_ID_INVALIDO' });

  const client = await pool.connect();
  try {
    const r = await podeVerPorRegistro({ client, usuarioId, eventoId, req });
    if (!r.ok) {
      const code = r.motivo === 'NAO_PUBLICADO' ? 404 : 403; // ✅ rascunho responde 404
      return res.status(code).json({ ok: false, motivo: r.motivo });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('ERRO verificarVisibilidadeEvento:', e);
    return res.status(500).json({ ok: false, erro: 'ERRO_INTERNO' });
  }
}

/* =====================================================================
   🆕 Detalhes do evento condicionado ao acesso (/:id/detalhes)
   ===================================================================== */
async function obterDetalhesEventoComRestricao(req, res) {
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ ok: false, erro: 'NAO_AUTENTICADO' });

  const eventoId = Number(req.params.id);
  if (!Number.isFinite(eventoId)) return res.status(400).json({ ok: false, erro: 'EVENTO_ID_INVALIDO' });

  const client = await pool.connect();
  try {
    const r = await podeVerPorRegistro({ client, usuarioId, eventoId, req });
    if (!r.ok) return res.status(403).json({ ok: false, motivo: r.motivo });

    // Reaproveita a resposta detalhada já existente
    return buscarEventoPorId(req, res);
  } catch (e) {
    console.error('ERRO obterDetalhesEventoComRestricao:', e);
    return res.status(500).json({ ok: false, erro: 'ERRO_INTERNO' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📆 Listar turmas de um evento (com datas reais)
   ===================================================================== */
   async function listarTurmasDoEvento(req, res) {
    const { id } = req.params;
    const admin = isAdmin(req); // ⬅ já temos isAdmin no controller
  
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

    const turmas = [];
    for (const r of result.rows) {
      const datasQ = await query(
        `SELECT data, horario_inicio, horario_fim 
           FROM datas_turma
          WHERE turma_id = $1
          ORDER BY data ASC`,
        [r.id]
      );
      const datas = (datasQ.rows || []).map(d => ({
        data: toYmd(d.data),
        horario_inicio: toHm(d.horario_inicio),
        horario_fim: toHm(d.horario_fim),
      })).filter(x => x.data);
      
      // 🔄 calcula status da turma com a MESMA regra das listas
      const data_ini = toYmd(r.data_inicio) || (datas[0]?.data) || null;
      const data_fim = toYmd(r.data_fim)    || (datas.at(-1)?.data) || null;
      const hiCalc   = toHm(r.horario_inicio) || (datas[0]?.horario_inicio) || '00:00';
      const hfCalc   = toHm(r.horario_fim)    || (datas.at(-1)?.horario_fim) || '23:59';
      
      let status_turma = 'programado';
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
        status_turma = st.rows?.[0]?.status || 'programado';
      }
      
      turmas.push({ ...r, datas, status: status_turma });
    }

    res.json(turmas);
  } catch (err) {
    console.error('❌ Erro ao buscar turmas do evento:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar turmas do evento.' });
  }
}

// ======================================================================
// 🔄 Atualizar evento (metadados, restrição e turmas) — COMPLETO
// ======================================================================
async function atualizarEvento(req, res) {
  const eventoId = Number(req.params.id);
  if (!eventoId) return res.status(400).json({ erro: 'EVENTO_ID_INVALIDO' });

  const {
    titulo, descricao, local, tipo, unidade_id, publico_alvo,
    instrutor,            // [ids]
    turmas,               // opcional
    restrito, restrito_modo,
    registros,
    registros_permitidos,
  } = req.body || {};

  // flags: o cliente tentou mexer na lista de registros?
  const listaFoiEnviada =
    Object.prototype.hasOwnProperty.call(req.body || {}, 'registros') ||
    Object.prototype.hasOwnProperty.call(req.body || {}, 'registros_permitidos');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔎 estado atual do evento
    const curQ = await client.query(
      `SELECT restrito, restrito_modo FROM eventos WHERE id = $1`,
      [eventoId]
    );
    if (curQ.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }
    const atual = curQ.rows[0];

    // 🎛️ determina estado final de restrição
    const restritoFinal =
      (typeof restrito !== 'undefined') ? !!restrito : !!atual.restrito;

    let modoFinal;
    if (typeof restrito_modo !== 'undefined') {
      if (restritoFinal && !ALLOWED_MODOS.has(String(restrito_modo))) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          erro: "restrito_modo inválido. Use 'todos_servidores' ou 'lista_registros'."
        });
      }
      modoFinal = restritoFinal ? String(restrito_modo || '') : null;
    } else {
      modoFinal = restritoFinal ? (atual.restrito_modo || null) : null;
    }

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
        typeof modoFinal === 'string' ? (modoFinal || null) : null
      ]
    );

    // 2) Instrutores (substitui lista inteira, se enviada)
    if (Array.isArray(instrutor)) {
      await client.query(
        `DELETE FROM evento_instrutor WHERE evento_id = $1`,
        [eventoId]
      );
      for (const instrutor_id of instrutor) {
        await client.query(
          `INSERT INTO evento_instrutor (evento_id, instrutor_id)
           VALUES ($1,$2)`,
          [eventoId, instrutor_id]
        );
      }
    }

    // 2.1) Lista de registros por restrição
    if (!restritoFinal || modoFinal === MODO_TODOS) {
      // sem restrição ou "todos" → limpa vínculos
      await client.query(
        `DELETE FROM evento_registros WHERE evento_id = $1`,
        [eventoId]
      );
    } else if (modoFinal === MODO_LISTA) {
      if (listaFoiEnviada) {
        const input = (typeof registros_permitidos !== 'undefined')
          ? registros_permitidos
          : registros;
        const regList = normalizeListaRegistros(input);
        if (regList.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ erro: 'Registros inválidos.' });
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
      }
      // se não veio nova lista e modo continua 'lista', preserva vínculos atuais
    }

    // 3) Se turmas não veio no body, finaliza aqui
    if (!Array.isArray(turmas)) {
      await client.query('COMMIT');
      return res.json({
        ok: true,
        mensagem: 'Evento atualizado (metadados e restrição).'
      });
    }

    // -- A PARTIR DAQUI: sincronizar turmas ------------------

    // estado atual das turmas do evento
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

    const mapaAtuais = new Map(atuais.map(t => [t.id, t]));
    const idsPayload = new Set(
      turmas
        .filter(t => Number.isFinite(Number(t.id)))
        .map(t => Number(t.id))
    );

    // turmas que seriam removidas (sumiram do payload)
    const remover = atuais.filter(t => !idsPayload.has(t.id));
    const bloqueadasRemocao = remover.filter(t => (t.inscritos || 0) > 0);
    if (bloqueadasRemocao.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        erro: 'TURMA_COM_INSCRITOS',
        detalhe:
          'Não é permitido REMOVER turmas que já possuem inscritos.',
        turmas_bloqueadas: bloqueadasRemocao.map(t => ({
          id: t.id,
          nome: t.nome,
          inscritos: t.inscritos
        })),
      });
    }

    // bloqueios de alteração (ex.: tentar mudar datas com inscritos)
    const bloqueios = [];

    // helper pra normalizar array de datas/encontros vindo do front
    const extrairDatas = (t) => {
      if (Array.isArray(t?.datas) && t.datas.length) {
        return t.datas.map(d => ({
          data: toYmd(d?.data),
          horario_inicio: hhmm(d?.horario_inicio || ''),
          horario_fim:    hhmm(d?.horario_fim || ''),
        }));
      }
      if (Array.isArray(t?.encontros) && t.encontros.length) {
        return t.encontros.map(e =>
          (typeof e === 'string')
            ? {
                data: toYmd(e),
                horario_inicio: null,
                horario_fim: null
              }
            : {
                data: toYmd(e?.data),
                horario_inicio: hhmm(e?.inicio || ''),
                horario_fim:    hhmm(e?.fim || ''),
              }
        );
      }
      return [];
    };

    for (const t of turmas) {
      const id = Number(t.id);

      // -----------------------------------------
      // 3.a) NOVA TURMA (não tem id ainda)
      // -----------------------------------------
      if (!Number.isFinite(id)) {
        const nome = String(t.nome || 'Turma').trim();
        const vagas_total = Number.isFinite(Number(t.vagas_total))
          ? Number(t.vagas_total)
          : null;
        const carga_horaria = Number.isFinite(Number(t.carga_horaria))
          ? Number(t.carga_horaria)
          : null;

        const baseDatas = extrairDatas(t);
        if (!baseDatas.length) {
          bloqueios.push({ id: null, nome, motivo: 'TURMA_SEM_DATAS' });
          continue;
        }

        const ordenadas = [...baseDatas]
          .filter(d => d.data)
          .sort((a, b) => String(a.data).localeCompare(String(b.data)));

        const data_inicio = ordenadas[0].data;
        const data_fim    = ordenadas.at(-1).data;

        const hiPayload = hhmm(t?.horario_inicio || '') || null;
        const hfPayload = hhmm(t?.horario_fim    || '') || null;

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
            hfPayload
          ]
        );
        const turmaId = insTurma.rows[0].id;

        for (const d of ordenadas) {
          // horários sempre com fallback seguro
          const inicioSeguro =
            d.horario_inicio ||
            hiPayload ||
            '08:00';

          const fimSeguro =
            d.horario_fim ||
            hfPayload ||
            '17:00';

          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1,$2,$3,$4)`,
            [
              turmaId,
              d.data,
              inicioSeguro,
              fimSeguro
            ]
          );
        }

        continue;
      }

      // -----------------------------------------
      // 3.b) TURMA EXISTENTE
      // -----------------------------------------
      const atualT = mapaAtuais.get(id);
      if (!atualT) continue; // turma não pertence a este evento? ignora

      const inscritos = atualT.inscritos || 0;

      const veioDatas =
        Array.isArray(t?.datas) || Array.isArray(t?.encontros);

      const novoVagas = Number.isFinite(Number(t?.vagas_total))
        ? Number(t.vagas_total)
        : null;

      const vaiDiminuirAbaixoInscritos =
        (novoVagas != null) && (novoVagas < inscritos);

      // ❌ bloqueia se tem inscritos e quer mexer em DATAS
      // ou reduzir vagas abaixo do total de inscritos
      if (inscritos > 0 && (veioDatas || vaiDiminuirAbaixoInscritos)) {
        bloqueios.push({
          id,
          nome: atualT.nome,
          inscritos,
          motivo: veioDatas
            ? 'ALTERACAO_DE_DATAS'
            : 'DIMINUICAO_DE_VAGAS_ABAIXO_INSCRITOS'
        });
        continue;
      }

      const cargaHorariaNumero = Number.isFinite(Number(t?.carga_horaria))
        ? Number(t.carga_horaria)
        : null;

      const hiPayload = hhmm(t?.horario_inicio || '') || null;
      const hfPayload = hhmm(t?.horario_fim    || '') || null;

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
          (novoVagas != null) ? novoVagas : null,
          cargaHorariaNumero,
          hiPayload,
          hfPayload
        ]
      );

      // 📅 se não há inscritos e o payload trouxe novas datas,
      //    substitui o calendário da turma
      if (inscritos === 0 && veioDatas) {
        const baseDatas = extrairDatas(t);
        const ordenadas = [...baseDatas]
          .filter(d => d.data)
          .sort((a, b) => String(a.data).localeCompare(String(b.data)));

        // datas_inicio/fim com fallback pra não deixar NULL
        const di = ordenadas[0]?.data || t.data_inicio || null;
        const df =
          ordenadas.at(-1)?.data ||
          t.data_fim ||
          ordenadas[0]?.data ||
          t.data_inicio ||
          null;

        // limpa datas antigas
        await client.query(
          `DELETE FROM datas_turma WHERE turma_id=$1`,
          [id]
        );

        // recria datas com horários obrigatórios sempre presentes
        for (const d of ordenadas) {
          if (!d.data) continue;

          const inicioSeguro =
            d.horario_inicio ||
            hiPayload ||
            '08:00';

          const fimSeguro =
            d.horario_fim ||
            hfPayload ||
            '17:00';

          await client.query(
            `INSERT INTO datas_turma (turma_id, data, horario_inicio, horario_fim)
             VALUES ($1,$2,$3,$4)`,
            [
              id,
              d.data,
              inicioSeguro,
              fimSeguro
            ]
          );
        }

        // atualiza período da turma se temos início/fim
        if (di && df) {
          await client.query(
            `UPDATE turmas
                SET data_inicio=$2,
                    data_fim=$3
              WHERE id=$1`,
            [id, di, df]
          );
        }
      }
    } // fim for turmas

    // se houve bloqueios, aborta tudo e avisa
    if (bloqueios.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        erro: 'TURMA_COM_INSCRITOS',
        detalhe:
          'Algumas turmas possuem inscritos: não é permitido alterar grade de datas ou reduzir vagas abaixo do total de inscritos.',
        turmas_bloqueadas: bloqueios
      });
    }

    // remove turmas (sem inscritos) que sumiram do payload
    for (const t of remover) {
      await client.query(
        `DELETE FROM datas_turma WHERE turma_id=$1`,
        [t.id]
      );
      await client.query(
        `DELETE FROM turmas WHERE id=$1`,
        [t.id]
      );
    }

    await client.query('COMMIT');
    return res.json({ ok: true, mensagem: 'Evento atualizado com sucesso.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ atualizarEvento:', err);
    return res.status(500).json({
      erro: 'Erro ao atualizar evento com turmas'
    });
  } finally {
    client.release();
  }
}

/* =====================================================================
   ❌ Excluir evento (sem cascata, removendo vínculos explicitamente)
   ===================================================================== */
async function excluirEvento(req, res) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM presencas WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );
    await client.query(
      `DELETE FROM datas_turma WHERE turma_id IN (SELECT id FROM turmas WHERE evento_id = $1)`,
      [id]
    );
    await client.query('DELETE FROM turmas WHERE evento_id = $1', [id]);
    await client.query('DELETE FROM evento_instrutor WHERE evento_id = $1', [id]);
    await client.query('DELETE FROM evento_registros WHERE evento_id = $1', [id]);

    const result = await client.query('DELETE FROM eventos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }

    await client.query('COMMIT');
    res.json({ mensagem: 'Evento excluído com sucesso', evento: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao excluir evento:', err.message);
    res.status(500).json({ erro: 'Erro ao excluir evento' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📅 Agenda (ocorrências = datas reais) — com fallback p/ coluna de presenças
   ===================================================================== */
async function getAgendaEventos(req, res) {
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
              SELECT DISTINCT to_char(p.${useDataPresenca ? 'data_presenca' : 'data'}::date, 'YYYY-MM-DD') AS d
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
      ({ rows } = await query(sqlBase(false), [])); // tenta p.data (compat)
    } catch {
      ({ rows } = await query(sqlBase(true), []));  // fallback p.data_presenca (teu esquema)
    }

    res.set('X-Agenda-Handler', 'eventosController:getAgendaEventos@estrita');
    const out = rows.map(r => ({
      ...r,
      ocorrencias: Array.isArray(r.ocorrencias) ? r.ocorrencias : [],
    }));
    res.json(out);
  } catch (err) {
    console.error('Erro ao buscar agenda:', err);
    res.status(500).json({ erro: 'Erro ao buscar agenda' });
  }
}

/* =====================================================================
   🔎 Listar eventos do instrutor (sem filtro de visibilidade)
   ===================================================================== */
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

        /* também devolve a lista para UI de edição */
        COALESCE((
          SELECT array_agg(er.registro_norm ORDER BY er.registro_norm)
          FROM evento_registros er
          WHERE er.evento_id = e.id
        ), '{}'::text[]) AS registros_permitidos,

        /* ✅ nova contagem */
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

    const eventos = [];
    for (const evento of eventosResult.rows) {
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

      const instrutorResult = await client.query(
        `SELECT u.id, u.nome
           FROM evento_instrutor ei
           JOIN usuarios u ON u.id = ei.instrutor_id
          WHERE ei.evento_id = $1`,
        [evento.id]
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
        const datas = (datasQ.rows || []).map(d => ({
          data: toYmd(d.data),
          horario_inicio: toHm(d.horario_inicio),
          horario_fim: toHm(d.horario_fim),
        })).filter(x => x.data);

        turmas.push({ ...t, datas });
      }

      eventos.push({
        ...evento,
        instrutor: instrutorResult.rows,
        turmas,
      });
    }

    res.json(eventos);
  } catch (err) {
    console.error('❌ Erro ao buscar eventos do instrutor:', err.message);
    res.status(500).json({ erro: 'Erro ao buscar eventos do instrutor' });
  } finally {
    client.release();
  }
}

/* =====================================================================
   📌 Listar datas da turma (endpoint utilitário)
   via=datas | via=presencas | via=intervalo
   ===================================================================== */
async function listarDatasDaTurma(req, res) {
  const turmaId = Number(req.params.id);
  const via = String(req.query.via || 'datas').toLowerCase();

  if (!Number.isFinite(turmaId)) {
    return res.status(400).json({ erro: 'turma_id inválido' });
  }

  try {
    if (via === 'datas') {
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
      return res.json(rows);
    }

    if (via === 'presencas') {
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
    return res.json(rows);
  } catch (erro) {
    console.error('❌ Erro ao buscar datas da turma:', erro);
    return res.status(500).json({ erro: 'Erro ao buscar datas da turma.', detalhe: erro.message });
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

  // 🆕 novos (para rotas /para-mim/lista, /:id/visivel, /:id/detalhes)
  listarEventosParaMim,
  verificarVisibilidadeEvento,
  obterDetalhesEventoComRestricao,
  // 🆕 publicar/despublicar
  publicarEvento,
  despublicarEvento,
};
