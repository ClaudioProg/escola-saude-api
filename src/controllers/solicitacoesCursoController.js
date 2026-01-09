/* eslint-disable no-console */
// ✅ src/controllers/solicitacoesCursoController.js
const { db, getClient } = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const rid = () => `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function logDev(rid, ...a) {
  if (IS_DEV) console.log("[solicitacoesCurso]", rid, ...a);
}
function logErr(rid, ...a) {
  console.error("[solicitacoesCurso][ERR]", rid, ...a);
}

/* ───────────────────────── Helpers de auth/perfil ───────────────────────── */

function getUsuarioId(req) {
  return Number(req.user?.id ?? req.usuario?.id ?? req.userId ?? 0) || null;
}

function normalizarPerfil(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p || "").toLowerCase().trim()).filter(Boolean);
  }
  return String(raw || "")
    .split(",")
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean);
}

function isAdmin(req) {
  const raw = req.user?.perfil || req.usuario?.perfil || req.perfil;
  const arr = normalizarPerfil(raw);
  return arr.includes("administrador") || arr.includes("admin");
}

function toIntOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toBool(v) {
  return v === true;
}

function cleanStr(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function isYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHHMM(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}

function normalizeDatas(datas) {
  const arr = Array.isArray(datas) ? datas : [];
  const out = [];

  for (const d of arr) {
    const data = cleanStr(d?.data);
    const hi = cleanStr(d?.horario_inicio);
    const hf = cleanStr(d?.horario_fim);

    if (!data || !isYMD(data)) continue;

    out.push({
      data,
      horario_inicio: hi && isHHMM(hi) ? hi : null,
      horario_fim: hf && isHHMM(hf) ? hf : null,
    });
  }

  // dedup por data + hi + hf
  const seen = new Set();
  const unique = [];
  for (const x of out) {
    const k = `${x.data}|${x.horario_inicio || ""}|${x.horario_fim || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(x);
  }

  // ordena por data/horário
  unique.sort((a, b) => {
    const ak = `${a.data} ${a.horario_inicio || "00:00"}`;
    const bk = `${b.data} ${b.horario_inicio || "00:00"}`;
    return ak.localeCompare(bk);
  });

  return unique;
}

function normalizePalestrantes(palestrantes) {
  const arr = Array.isArray(palestrantes) ? palestrantes : [];
  const out = [];

  for (const p of arr) {
    if (!p) continue;

    // string => externo
    if (typeof p === "string") {
      const nome = cleanStr(p);
      if (nome) out.push({ palestrante_id: null, nome_externo: nome });
      continue;
    }

    const palestranteId = toIntOrNull(p.usuario_id ?? p.id);
    const nomeExterno = cleanStr(p.nome_externo ?? p.nome ?? p.label ?? p.value);

    // se tem ID, nome_externo é opcional (podemos preencher por join na listagem)
    // se não tem ID, nome_externo é obrigatório
    if (!palestranteId && !nomeExterno) continue;

    out.push({ palestrante_id: palestranteId, nome_externo: nomeExterno });
  }

  // dedup por id ou nome
  const seen = new Set();
  const unique = [];
  for (const x of out) {
    const k = x.palestrante_id ? `id:${x.palestrante_id}` : `n:${(x.nome_externo || "").toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(x);
  }

  // ordena por nome “resolvido”
  unique.sort((a, b) => {
    const an = (a.nome_externo || "").toLowerCase();
    const bn = (b.nome_externo || "").toLowerCase();
    return an.localeCompare(bn);
  });

  return unique;
}

async function assertPodeEditar({ client, solicitacaoId, usuarioId, admin }) {
  const q = await client.query(
    `SELECT criador_id FROM solicitacoes_curso WHERE id = $1`,
    [Number(solicitacaoId)]
  );
  if (!q.rowCount) {
    const err = new Error("SOLICITACAO_NAO_ENCONTRADA");
    err.httpStatus = 404;
    throw err;
  }

  const criadorId = Number(q.rows[0].criador_id);
  const pode = admin || criadorId === Number(usuarioId);
  if (!pode) {
    const err = new Error("SEM_PERMISSAO");
    err.httpStatus = 403;
    throw err;
  }

  return { criadorId };
}

/* ───────────────────────── Listagem principal ───────────────────────── */

async function listarSolicitacoes(req, res) {
  const requestId = rid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });

  const admin = isAdmin(req);
  logDev(requestId, "listarSolicitacoes", { usuarioId, admin });

  try {
    // ✅ Evita efeito “multiplicativo” (datas x palestrantes)
    // Fazemos 1 query base + 2 subqueries agregadas por solicitacao_id
    const sql = `
      WITH base AS (
        SELECT
          s.id,
          s.titulo,
          s.descricao,
          s.publico_alvo,
          s.local,
          s.tipo,
          s.unidade_id,
          u.nome AS unidade_nome,
          s.modalidade,
          s.restrito,
          s.restricao_descricao,
          s.carga_horaria_total,
          s.gera_certificado,
          s.status,
          s.criador_id,
          uc.nome AS criador_nome,
          s.criado_em,
          s.atualizado_em
        FROM solicitacoes_curso s
        LEFT JOIN unidades u  ON u.id  = s.unidade_id
        LEFT JOIN usuarios uc ON uc.id = s.criador_id
        WHERE 1=1
          ${admin ? "" : "AND s.criador_id = $1"}
      ),
      datas AS (
        SELECT
          d.solicitacao_id,
          json_agg(
            jsonb_build_object(
              'id', d.id,
              'data', to_char(d.data::date, 'YYYY-MM-DD'),
              'horario_inicio', CASE WHEN d.horario_inicio IS NULL THEN NULL ELSE to_char(d.horario_inicio::time, 'HH24:MI') END,
              'horario_fim',    CASE WHEN d.horario_fim    IS NULL THEN NULL ELSE to_char(d.horario_fim::time,    'HH24:MI') END
            )
            ORDER BY d.data ASC, d.horario_inicio ASC NULLS LAST, d.id ASC
          ) AS datas
        FROM solicitacao_curso_datas d
        GROUP BY d.solicitacao_id
      ),
      pales AS (
        SELECT
          p.solicitacao_id,
          json_agg(
            jsonb_build_object(
              'id', p.id,
              'usuario_id', pu.id,
              'nome', COALESCE(NULLIF(trim(p.nome_externo), ''), pu.nome)
            )
            ORDER BY COALESCE(NULLIF(trim(p.nome_externo), ''), pu.nome) ASC, p.id ASC
          ) AS palestrantes
        FROM solicitacao_curso_palestrantes p
        LEFT JOIN usuarios pu ON pu.id = p.palestrante_id
        GROUP BY p.solicitacao_id
      )
      SELECT
        b.*,
        COALESCE(d.datas, '[]'::json) AS datas,
        COALESCE(p.palestrantes, '[]'::json) AS palestrantes
      FROM base b
      LEFT JOIN datas d ON d.solicitacao_id = b.id
      LEFT JOIN pales p ON p.solicitacao_id = b.id
      ORDER BY b.criado_em DESC NULLS LAST, b.id DESC
    `;

    const params = admin ? [] : [Number(usuarioId)];
    const result = await db.query(sql, params);

    const data = result.rows.map((row) => ({
      ...row,
      pode_editar: admin || Number(row.criador_id) === Number(usuarioId),
    }));

    return res.status(200).json(data);
  } catch (err) {
    logErr(requestId, "Erro ao listar:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    return res.status(500).json({ erro: "Erro ao listar solicitações de curso." });
  }
}

/* ───────────────────────── Listar tipos ───────────────────────── */

async function listarTipos(req, res) {
  const requestId = rid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "Não autenticado." });

  try {
    const sql = `
      SELECT DISTINCT tipo
      FROM solicitacoes_curso
      WHERE tipo IS NOT NULL AND trim(tipo) <> ''
      ORDER BY tipo ASC
    `;
    const result = await db.query(sql);
    return res.status(200).json(result.rows.map((r) => r.tipo));
  } catch (err) {
    logErr(requestId, "Erro ao listar tipos:", err?.message);
    return res.status(500).json({ erro: "Erro ao listar tipos de curso." });
  }
}

/* ───────────────────────── Criação ───────────────────────── */

async function criarSolicitacao(req, res) {
  const requestId = rid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  const body = req.body || {};

  const titulo = cleanStr(body.titulo);
  const descricao = cleanStr(body.descricao);
  const publico_alvo = cleanStr(body.publico_alvo);
  const local = cleanStr(body.local);
  const tipo = cleanStr(body.tipo);
  const unidade_id = toIntOrNull(body.unidade_id);
  const modalidade = cleanStr(body.modalidade);
  const restrito = toBool(body.restrito);
  const restricao_descricao = cleanStr(body.restricao_descricao);
  const carga_horaria_total = body.carga_horaria_total != null ? Number(body.carga_horaria_total) : null;
  const gera_certificado = toBool(body.gera_certificado);
  const status = cleanStr(body.status); // se vier, respeita; senão default
  const datas = normalizeDatas(body.datas);
  const palestrantes = normalizePalestrantes(body.palestrantes);

  if (!titulo) return res.status(400).json({ erro: "Informe o título do curso." });
  if (!Array.isArray(datas) || datas.length === 0) {
    return res.status(400).json({ erro: "Informe ao menos uma data para a solicitação." });
  }

  // valida coerência quando restrito=true
  if (restrito && !restricao_descricao) {
    return res.status(400).json({ erro: "Informe a descrição da restrição." });
  }

  // valida carga horária
  if (carga_horaria_total != null && (!Number.isFinite(carga_horaria_total) || carga_horaria_total < 0)) {
    return res.status(400).json({ erro: "Carga horária total inválida." });
  }

  let client;
  try {
    client = await getClient();
    await client.query("BEGIN");

    const ins = await client.query(
      `
      INSERT INTO solicitacoes_curso (
        titulo, descricao, publico_alvo, local, tipo, unidade_id,
        modalidade, restrito, restricao_descricao,
        carga_horaria_total, gera_certificado, status,
        criador_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,COALESCE($12,'planejado'),
        $13
      )
      RETURNING id
      `,
      [
        titulo,
        descricao,
        publico_alvo,
        local,
        tipo,
        unidade_id,
        modalidade,
        restrito,
        restricao_descricao,
        carga_horaria_total,
        gera_certificado,
        status,
        Number(usuarioId),
      ]
    );

    const solicitacaoId = Number(ins.rows[0]?.id);
    if (!solicitacaoId) throw new Error("FALHA_CRIAR_SOLICITACAO");

    // datas
    for (const d of datas) {
      await client.query(
        `
        INSERT INTO solicitacao_curso_datas
          (solicitacao_id, data, horario_inicio, horario_fim)
        VALUES ($1, $2::date, $3::time, $4::time)
        `,
        [solicitacaoId, d.data, d.horario_inicio, d.horario_fim]
      );
    }

    // palestrantes
    for (const p of palestrantes) {
      await client.query(
        `
        INSERT INTO solicitacao_curso_palestrantes
          (solicitacao_id, palestrante_id, nome_externo)
        VALUES ($1, $2, $3)
        `,
        [solicitacaoId, p.palestrante_id, p.nome_externo]
      );
    }

    await client.query("COMMIT");
    logDev(requestId, "Solicitação criada", { solicitacaoId, usuarioId });

    return res.status(201).json({ ok: true, id: solicitacaoId });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {}
    logErr(requestId, "Erro ao criar:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });
    return res.status(500).json({ erro: "Erro ao criar solicitação de curso." });
  } finally {
    if (client) client.release();
  }
}

/* ───────────────────────── Atualização ───────────────────────── */

async function atualizarSolicitacao(req, res) {
  const requestId = rid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  const solicitacaoId = Number(req.params.id);
  if (!Number.isFinite(solicitacaoId) || solicitacaoId <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  const admin = isAdmin(req);
  const body = req.body || {};

  const titulo = cleanStr(body.titulo);
  const descricao = cleanStr(body.descricao);
  const publico_alvo = cleanStr(body.publico_alvo);
  const local = cleanStr(body.local);
  const tipo = cleanStr(body.tipo);
  const unidade_id = body.unidade_id !== undefined ? toIntOrNull(body.unidade_id) : undefined;
  const modalidade = cleanStr(body.modalidade);
  const restrito = body.restrito !== undefined ? toBool(body.restrito) : undefined;
  const restricao_descricao = body.restricao_descricao !== undefined ? cleanStr(body.restricao_descricao) : undefined;
  const carga_horaria_total = body.carga_horaria_total !== undefined
    ? (body.carga_horaria_total == null ? null : Number(body.carga_horaria_total))
    : undefined;
  const gera_certificado = body.gera_certificado !== undefined ? toBool(body.gera_certificado) : undefined;
  const status = body.status !== undefined ? cleanStr(body.status) : undefined;

  const datas = body.datas !== undefined ? normalizeDatas(body.datas) : undefined;
  const palestrantes = body.palestrantes !== undefined ? normalizePalestrantes(body.palestrantes) : undefined;

  // validações rápidas se vierem campos
  if (titulo !== undefined && !titulo) {
    return res.status(400).json({ erro: "Informe o título do curso." });
  }
  if (restrito === true && (restricao_descricao === undefined || !restricao_descricao)) {
    return res.status(400).json({ erro: "Informe a descrição da restrição." });
  }
  if (carga_horaria_total !== undefined && carga_horaria_total != null) {
    if (!Number.isFinite(carga_horaria_total) || carga_horaria_total < 0) {
      return res.status(400).json({ erro: "Carga horária total inválida." });
    }
  }
  if (datas !== undefined && datas.length === 0) {
    return res.status(400).json({ erro: "Informe ao menos uma data para a solicitação." });
  }

  let client;
  try {
    client = await getClient();

    // permissão (criador/admin)
    await assertPodeEditar({ client, solicitacaoId, usuarioId, admin });

    await client.query("BEGIN");

    // UPDATE dinâmico (só o que veio)
    const sets = [];
    const vals = [];
    const push = (col, val) => {
      sets.push(`${col} = $${vals.length + 1}`);
      vals.push(val);
    };

    if (titulo !== undefined) push("titulo", titulo);
    if (descricao !== undefined) push("descricao", descricao);
    if (publico_alvo !== undefined) push("publico_alvo", publico_alvo);
    if (local !== undefined) push("local", local);
    if (tipo !== undefined) push("tipo", tipo);
    if (unidade_id !== undefined) push("unidade_id", unidade_id);
    if (modalidade !== undefined) push("modalidade", modalidade);
    if (restrito !== undefined) push("restrito", restrito);
    if (restricao_descricao !== undefined) push("restricao_descricao", restricao_descricao);
    if (carga_horaria_total !== undefined) push("carga_horaria_total", carga_horaria_total);
    if (gera_certificado !== undefined) push("gera_certificado", gera_certificado);
    if (status !== undefined) push("status", status);

    // sempre atualiza atualizado_em
    sets.push(`atualizado_em = NOW()`);

    vals.push(solicitacaoId);
    await client.query(
      `
      UPDATE solicitacoes_curso
         SET ${sets.join(", ")}
       WHERE id = $${vals.length}
      `,
      vals
    );

    // datas (se veio no payload, substitui)
    if (datas !== undefined) {
      await client.query(`DELETE FROM solicitacao_curso_datas WHERE solicitacao_id = $1`, [solicitacaoId]);
      for (const d of datas) {
        await client.query(
          `
          INSERT INTO solicitacao_curso_datas
            (solicitacao_id, data, horario_inicio, horario_fim)
          VALUES ($1, $2::date, $3::time, $4::time)
          `,
          [solicitacaoId, d.data, d.horario_inicio, d.horario_fim]
        );
      }
    }

    // palestrantes (se veio no payload, substitui)
    if (palestrantes !== undefined) {
      await client.query(`DELETE FROM solicitacao_curso_palestrantes WHERE solicitacao_id = $1`, [solicitacaoId]);
      for (const p of palestrantes) {
        await client.query(
          `
          INSERT INTO solicitacao_curso_palestrantes
            (solicitacao_id, palestrante_id, nome_externo)
          VALUES ($1, $2, $3)
          `,
          [solicitacaoId, p.palestrante_id, p.nome_externo]
        );
      }
    }

    await client.query("COMMIT");
    logDev(requestId, "Solicitação atualizada", { solicitacaoId });

    return res.status(200).json({ ok: true });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {}

    const httpStatus = err?.httpStatus || 500;
    const msg =
      err?.message === "SOLICITACAO_NAO_ENCONTRADA"
        ? "Solicitação não encontrada."
        : err?.message === "SEM_PERMISSAO"
        ? "Sem permissão para editar esta solicitação."
        : "Erro ao atualizar solicitação de curso.";

    logErr(requestId, "Erro ao atualizar:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });

    return res.status(httpStatus).json({ erro: msg });
  } finally {
    if (client) client.release();
  }
}

/* ───────────────────────── Exclusão ───────────────────────── */

async function excluirSolicitacao(req, res) {
  const requestId = rid();
  const usuarioId = getUsuarioId(req);
  if (!usuarioId) return res.status(401).json({ erro: "Usuário não autenticado." });

  const solicitacaoId = Number(req.params.id);
  if (!Number.isFinite(solicitacaoId) || solicitacaoId <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  const admin = isAdmin(req);

  let client;
  try {
    client = await getClient();

    // permissão (criador/admin)
    await assertPodeEditar({ client, solicitacaoId, usuarioId, admin });

    await client.query("BEGIN");

    // se não houver ON DELETE CASCADE, garantimos limpeza
    await client.query(`DELETE FROM solicitacao_curso_palestrantes WHERE solicitacao_id = $1`, [solicitacaoId]);
    await client.query(`DELETE FROM solicitacao_curso_datas        WHERE solicitacao_id = $1`, [solicitacaoId]);
    await client.query(`DELETE FROM solicitacoes_curso             WHERE id = $1`, [solicitacaoId]);

    await client.query("COMMIT");
    logDev(requestId, "Solicitação excluída", { solicitacaoId });

    return res.status(200).json({ ok: true });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {}

    const httpStatus = err?.httpStatus || 500;
    const msg =
      err?.message === "SOLICITACAO_NAO_ENCONTRADA"
        ? "Solicitação não encontrada."
        : err?.message === "SEM_PERMISSAO"
        ? "Sem permissão para excluir esta solicitação."
        : "Erro ao excluir solicitação de curso.";

    logErr(requestId, "Erro ao excluir:", {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
    });

    return res.status(httpStatus).json({ erro: msg });
  } finally {
    if (client) client.release();
  }
}

module.exports = {
  listarSolicitacoes,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
};
