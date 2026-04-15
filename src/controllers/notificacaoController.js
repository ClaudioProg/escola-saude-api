/* eslint-disable no-console */
// 📁 src/controllers/notificacaoController.js — PREMIUM V3
// - Tabela oficial: notificacoes
// - Date-only safe
// - Idempotência melhorada
// - Resumo para badge / dashboard
// - Listagem premium com filtros / paginação
// - Marcar uma / todas como lidas
// - Notificações de reserva aprovada / rejeitada
// - Sem ambiguidade entre notificacao/notificacoes

const dbMod = require("../db");

/* ------------------------------------------------------------------ */
/* Compat de DB                                                       */
/* ------------------------------------------------------------------ */
const pgpDb = dbMod?.db ?? null;
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null) ||
  (pgpDb?.query ? pgpDb.query.bind(pgpDb) : null);

if (typeof query !== "function") {
  console.error("[notificacaoController] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em notificacaoController.js (query ausente)");
}

const IS_DEV = process.env.NODE_ENV !== "production";
const log = (...a) => IS_DEV && console.log("[notif]", ...a);
const warn = (...a) => console.warn("[notif][WARN]", ...a);
const errlog = (...a) => console.error("[notif][ERR]", ...a);

/* ------------------------------------------------------------------ */
/* Utils de data (sem pulo de fuso)                                   */
/* ------------------------------------------------------------------ */
let toBrDate = null;
let toBrDateOnlyString = null;

try {
  ({ toBrDate, toBrDateOnlyString } = require("../utils/dateTime"));
} catch {
  toBrDate = (v) => {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${da}/${m}/${y}`;
  };

  toBrDateOnlyString = (yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) return "";
    const [y, mo, d] = yyyyMmDd.split("-");
    return `${d}/${mo}/${y}`;
  };
}

/* ------------------------------------------------------------------ */
/* (Opcional) serviço de avaliações pendentes                         */
/* ------------------------------------------------------------------ */
let buscarAvaliacaoPendentes = null;
try {
  ({ buscarAvaliacaoPendentes } = require("./avaliacaoService"));
} catch {
  buscarAvaliacaoPendentes = async () => [];
}

/* ------------------------------------------------------------------ */
/* Helpers gerais                                                     */
/* ------------------------------------------------------------------ */
function asInt(v) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function normStr(v, { max = 500 } = {}) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function formatSalaLabel(sala) {
  if (String(sala || "").toLowerCase() === "auditorio") return "Auditório";
  if (String(sala || "").toLowerCase() === "sala_reuniao") return "Sala de Reunião";
  return "Sala";
}

function formatPeriodoLabel(periodo) {
  if (String(periodo || "").toLowerCase() === "manha") return "Manhã";
  if (String(periodo || "").toLowerCase() === "tarde") return "Tarde";
  return "Período";
}

function safeRows(result) {
  return result?.rows || result || [];
}

/* ------------------------------------------------------------------ */
/* Descoberta de colunas da tabela notificacoes (cache)               */
/* ------------------------------------------------------------------ */
let _notifMetaCache = null;

async function getNotifMeta() {
  if (_notifMetaCache) return _notifMetaCache;

  const colsQuery = await query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'notificacoes'
  `);

  const colsRows = safeRows(colsQuery);
  const cols = (colsRows || []).map((r) => r.column_name);
  const has = (c) => cols.includes(c);

  if (!cols.length) {
    throw new Error("Tabela 'notificacoes' não encontrada ou sem colunas acessíveis.");
  }

  _notifMetaCache = {
    tableName: "notificacoes",
    cols,
    hasMensagem: has("mensagem"),
    hasCorpo: has("corpo"),
    hasCriadoEm: has("criado_em"),
    hasCriadaEm: has("criada_em"),
    hasTipo: has("tipo"),
    hasTitulo: has("titulo"),
    hasTurmaId: has("turma_id"),
    hasEventoId: has("evento_id"),
    hasLida: has("lida"),
    hasUsuarioId: has("usuario_id"),
    hasReservaId: has("reserva_id"),
    hasLink: has("link"),
    hasMetadata: has("metadata"),
  };

  log("meta notificacoes:", _notifMetaCache);
  return _notifMetaCache;
}

/* ------------------------------------------------------------------ */
/* Map para a UI premium                                              */
/* ------------------------------------------------------------------ */
function mapNotifRowToDTO(n) {
  return {
    id: n.id,
    tipo: n.tipo || "sistema",
    titulo: n.titulo || null,
    mensagem: n.msg || "",
    lida: n.lida === true,
    data: n.tstamp ? toBrDate(n.tstamp) : "",
    criado_em: n.tstamp || null,
    turma_id: n.turma_id ?? null,
    evento_id: n.evento_id ?? null,
    reserva_id: n.reserva_id ?? null,
    link: n.link ?? null,
  };
}

/* ============================================================ */
/* 📥 Listar notificações                                       */
/* Query:
 *  - apenasNaoLidas=1|true
 *  - tipo=...
 *  - limit=...
 *  - offset=...
 * ============================================================ */
async function listarNotificacao(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifMeta();

    const msgCol = meta.hasMensagem ? "mensagem" : meta.hasCorpo ? "corpo" : null;
    const tsCol = meta.hasCriadoEm ? "criado_em" : meta.hasCriadaEm ? "criada_em" : null;

    const apenasNaoLidas =
      ["1", "true"].includes(String(req.query?.apenasNaoLidas || "").trim().toLowerCase());

    const tipoFiltro = normStr(req.query?.tipo, { max: 100 });
    const limit = Math.min(Math.max(asInt(req.query?.limit) || 20, 1), 100);
    const offset = Math.max(asInt(req.query?.offset) || 0, 0);

    const selectParts = [
      "id",
      meta.hasTipo ? "tipo" : "NULL AS tipo",
      meta.hasTitulo ? "titulo" : "NULL AS titulo",
      msgCol ? `${msgCol} AS msg` : "NULL AS msg",
      meta.hasLida ? "lida" : "false AS lida",
      tsCol ? `${tsCol} AS tstamp` : "NULL AS tstamp",
      meta.hasTurmaId ? "turma_id" : "NULL AS turma_id",
      meta.hasEventoId ? "evento_id" : "NULL AS evento_id",
      meta.hasReservaId ? "reserva_id" : "NULL AS reserva_id",
      meta.hasLink ? "link" : "NULL AS link",
    ];

    const whereParts = [];
    const params = [];
    let p = 1;

    if (meta.hasUsuarioId) {
      whereParts.push(`usuario_id = $${p++}`);
      params.push(Number(usuario_id));
    }

    if (apenasNaoLidas && meta.hasLida) {
      whereParts.push("lida = false");
    }

    if (tipoFiltro && meta.hasTipo) {
      whereParts.push(`tipo = $${p++}`);
      params.push(tipoFiltro);
    }

    params.push(limit);
    const limitParam = `$${p++}`;

    params.push(offset);
    const offsetParam = `$${p++}`;

    const sql = `
      SELECT ${selectParts.join(", ")}
        FROM ${meta.tableName}
        ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
       ORDER BY ${tsCol ? `${tsCol} DESC NULLS LAST, ` : ""}id DESC
       LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `;

    log("[listarNotificacao] filtros", {
      usuario_id,
      apenasNaoLidas,
      tipoFiltro,
      limit,
      offset,
    });

    const result = await query(sql, params);
    const rows = safeRows(result);

    const notificacoes = (rows || []).map(mapNotifRowToDTO);
    return res.status(200).json(notificacoes);
  } catch (err) {
    errlog("Erro ao buscar notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/* ============================================================ */
/* 📊 Resumo premium de notificações                            */
/* - para badge do sino / painel inicial                        */
/* ============================================================ */
async function resumoNotificacoes(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifMeta();

    if (!meta.hasUsuarioId) {
      return res.json({
        total: 0,
        naoLidas: 0,
        porTipo: {},
      });
    }

    const tipoExpr = meta.hasTipo ? "COALESCE(tipo, 'sistema')" : "'sistema'";

    const result = await query(
      `
      SELECT
        ${tipoExpr} AS tipo,
        COUNT(*)::int AS total,
        ${
          meta.hasLida
            ? "SUM(CASE WHEN lida = false THEN 1 ELSE 0 END)::int AS nao_lidas"
            : "COUNT(*)::int AS nao_lidas"
        }
      FROM ${meta.tableName}
      WHERE usuario_id = $1
      GROUP BY ${tipoExpr}
      `,
      [Number(usuario_id)]
    );

    const rows = safeRows(result);

    const porTipo = {};
    let total = 0;
    let naoLidas = 0;

    for (const row of rows || []) {
      const tipo = row.tipo || "sistema";
      const subtotal = Number(row.total) || 0;
      const subNaoLidas = Number(row.nao_lidas) || 0;

      porTipo[tipo] = {
        total: subtotal,
        naoLidas: subNaoLidas,
      };

      total += subtotal;
      naoLidas += subNaoLidas;
    }

    return res.json({
      total,
      naoLidas,
      porTipo,
    });
  } catch (err) {
    errlog("Erro ao montar resumo de notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar resumo das notificações." });
  }
}

/* ============================================================ */
/* 🔢 Contar notificações não lidas                             */
/* ============================================================ */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifMeta();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.json({ totalNaoLidas: 0, total: 0 });
    }

    const result = await query(
      `
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN lida = false THEN 1 ELSE 0 END)::int AS total_nao_lidas
      FROM ${meta.tableName}
      WHERE usuario_id = $1
      `,
      [Number(usuario_id)]
    );

    const rows = safeRows(result);
    const total = Number(rows?.[0]?.total) || 0;
    const totalNaoLidas = Number(rows?.[0]?.total_nao_lidas) || 0;

    return res.json({ totalNaoLidas, total });
  } catch (err) {
    errlog("Erro ao contar notificações não lidas:", err);
    return res.status(500).json({ erro: "Erro ao contar notificações." });
  }
}

/* ============================================================ */
/* 📌 Criar notificação                                         */
/* ============================================================ */
async function criarNotificacao(usuario_id, mensagem, extra) {
  try {
    if (!usuario_id || !mensagem) return null;

    const meta = await getNotifMeta();
    const data = {};
    const safeExtra = extra && typeof extra === "object" ? extra : {};

    if (meta.hasUsuarioId) data.usuario_id = Number(usuario_id);

    if (meta.hasMensagem) data.mensagem = String(mensagem);
    else if (meta.hasCorpo) data.corpo = String(mensagem);

    if (meta.hasLida) data.lida = false;
    if (meta.hasTipo && safeExtra.tipo !== undefined) data.tipo = safeExtra.tipo;
    if (meta.hasTitulo && safeExtra.titulo !== undefined) data.titulo = safeExtra.titulo;
    if (meta.hasTurmaId && safeExtra.turma_id !== undefined && safeExtra.turma_id !== null) {
      data.turma_id = Number(safeExtra.turma_id);
    }
    if (meta.hasEventoId && safeExtra.evento_id !== undefined && safeExtra.evento_id !== null) {
      data.evento_id = Number(safeExtra.evento_id);
    }
    if (meta.hasReservaId && safeExtra.reserva_id !== undefined && safeExtra.reserva_id !== null) {
      data.reserva_id = Number(safeExtra.reserva_id);
    }
    if (meta.hasLink && safeExtra.link !== undefined && safeExtra.link !== null) {
      data.link = String(safeExtra.link);
    }
    if (meta.hasMetadata && safeExtra.metadata !== undefined && safeExtra.metadata !== null) {
      data.metadata = safeExtra.metadata;
    }

    const tsCol = meta.hasCriadoEm ? "criado_em" : meta.hasCriadaEm ? "criada_em" : null;

    const cols = Object.keys(data);
    const colsFinal = tsCol ? cols.concat([tsCol]) : cols;
    if (!colsFinal.length) return null;

    const params = cols.map((c) => data[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).concat(tsCol ? ["now()"] : []);

    const sql = `
      INSERT INTO ${meta.tableName} (${colsFinal.join(", ")})
      VALUES (${placeholders.join(", ")})
      RETURNING id
    `;

    const result = await query(sql, params);
    const rows = safeRows(result);
    const id = rows?.[0]?.id || null;

    log("[criarNotificacao] criada", {
      id,
      usuario_id,
      tipo: data.tipo || null,
      titulo: data.titulo || null,
    });

    return id;
  } catch (err) {
    errlog("Erro ao criar notificação:", err?.message || err);
    return null;
  }
}

/* ============================================================ */
/* ✅ Marcar uma notificação como lida                          */
/* ============================================================ */
async function marcarComoLida(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const id = Number(req.params?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    const meta = await getNotifMeta();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.status(400).json({ erro: "Tabela de notificações não suporta marcação de leitura." });
    }

    const upd = await query(
      `
      UPDATE ${meta.tableName}
         SET lida = true
       WHERE id = $1
         AND usuario_id = $2
      `,
      [id, Number(usuario_id)]
    );

    const rowCount = upd?.rowCount ?? 0;
    if (rowCount === 0) {
      return res.status(404).json({ erro: "Notificação não encontrada." });
    }

    return res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    errlog("Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

/* ============================================================ */
/* ✅ Marcar todas como lidas                                   */
/* ============================================================ */
async function marcarTodasComoLidas(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifMeta();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.status(400).json({ erro: "Tabela de notificações não suporta marcação de leitura." });
    }

    const upd = await query(
      `
      UPDATE ${meta.tableName}
         SET lida = true
       WHERE usuario_id = $1
         AND lida = false
      `,
      [Number(usuario_id)]
    );

    const totalAtualizadas = upd?.rowCount ?? 0;

    log("[marcarTodasComoLidas]", {
      usuario_id,
      totalAtualizadas,
    });

    return res.status(200).json({
      mensagem: "Todas as notificações foram marcadas como lidas.",
      totalAtualizadas,
    });
  } catch (err) {
    errlog("Erro ao marcar todas notificações como lidas:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificações." });
  }
}

/* ============================================================ */
/* 📝 Notificações de avaliação pendente                        */
/* ============================================================ */
async function gerarNotificacaoDeAvaliacao(usuario_id) {
  try {
    if (!usuario_id) return;

    const meta = await getNotifMeta();
    const pendentes = await buscarAvaliacaoPendentes(usuario_id);

    for (const av of pendentes) {
      const turmaId = av?.turma_id != null ? Number(av.turma_id) : null;
      const eventoId = av?.evento_id != null ? Number(av.evento_id) : null;
      const nomeEvento = av.nome_evento || av.titulo || "evento";

      const where = [];
      const params = [];
      let p = 1;

      if (meta.hasUsuarioId) {
        where.push(`usuario_id = $${p++}`);
        params.push(Number(usuario_id));
      }
      if (meta.hasTipo) where.push(`tipo = 'avaliacao'`);
      if (meta.hasTurmaId && turmaId != null) {
        where.push(`turma_id = $${p++}`);
        params.push(turmaId);
      }
      if (meta.hasEventoId && eventoId != null) {
        where.push(`evento_id = $${p++}`);
        params.push(eventoId);
      }
      if (meta.hasLida) where.push(`lida = false`);

      if (where.length) {
        const dupSql = `SELECT 1 FROM ${meta.tableName} WHERE ${where.join(" AND ")} LIMIT 1`;
        const dup = await query(dupSql, params);
        if ((dup?.rowCount ?? safeRows(dup).length) > 0) continue;
      }

      await criarNotificacao(
        usuario_id,
        `Já está disponível a avaliação do evento "${nomeEvento}".`,
        {
          tipo: "avaliacao",
          titulo: `Avaliação disponível: ${nomeEvento}`,
          turma_id: turmaId,
          evento_id: eventoId,
        }
      );
    }
  } catch (err) {
    errlog("Erro ao gerar notificações de avaliação:", err?.message || err);
  }
}

/* ============================================================ */
/* 🎓 Notificações de certificado                               */
/* ============================================================ */
async function gerarNotificacaoDeCertificado(usuario_id, turmaOrOpts = null) {
  try {
    if (!usuario_id) return;
    const meta = await getNotifMeta();

    let turma_id = null;
    let evento_id = null;
    let evento_titulo = "evento";

    if (typeof turmaOrOpts === "number") {
      turma_id = turmaOrOpts;
    } else if (turmaOrOpts && typeof turmaOrOpts === "object") {
      turma_id = turmaOrOpts.turma_id ?? null;
      evento_id = turmaOrOpts.evento_id ?? null;
      evento_titulo = turmaOrOpts.evento_titulo || "evento";
    }

    if (turma_id != null || evento_id != null) {
      const where = [];
      const params = [];
      let p = 1;

      if (meta.hasUsuarioId) {
        where.push(`usuario_id = $${p++}`);
        params.push(Number(usuario_id));
      }
      if (meta.hasTipo) where.push(`tipo = 'certificado'`);
      if (meta.hasTurmaId && turma_id != null) {
        where.push(`turma_id = $${p++}`);
        params.push(Number(turma_id));
      }
      if (meta.hasEventoId && evento_id != null) {
        where.push(`evento_id = $${p++}`);
        params.push(Number(evento_id));
      }
      if (meta.hasLida) where.push(`lida = false`);

      if (where.length) {
        const dupSql = `SELECT 1 FROM ${meta.tableName} WHERE ${where.join(" AND ")} LIMIT 1`;
        const dup = await query(dupSql, params);
        if ((dup?.rowCount ?? safeRows(dup).length) > 0) return;
      }

      await criarNotificacao(
        Number(usuario_id),
        `Seu certificado do evento "${evento_titulo}" está disponível para download.`,
        {
          tipo: "certificado",
          titulo: `Certificado disponível: ${evento_titulo}`,
          turma_id: turma_id ?? undefined,
          evento_id: evento_id ?? undefined,
        }
      );
      return;
    }

    const result = await query(
      `
      SELECT
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id
      FROM turmas t
      JOIN eventos e    ON e.id = t.evento_id
      JOIN inscricoes i ON i.turma_id = t.id AND i.usuario_id = $1
      LEFT JOIN certificados c
        ON c.usuario_id = $1
       AND c.evento_id  = e.id
       AND c.turma_id   = t.id
       AND c.tipo       = 'usuario'
      WHERE (t.data_fim::text || ' ' || COALESCE(t.horario_fim,'23:59'))::timestamp < NOW()
        AND c.id IS NULL
      ORDER BY t.data_fim DESC
      `,
      [Number(usuario_id)]
    );

    const rows = safeRows(result);

    for (const row of rows || []) {
      const where = [];
      const params = [];
      let p = 1;

      if (meta.hasUsuarioId) {
        where.push(`usuario_id = $${p++}`);
        params.push(Number(usuario_id));
      }
      if (meta.hasTipo) where.push(`tipo = 'certificado'`);
      if (meta.hasTurmaId) {
        where.push(`turma_id = $${p++}`);
        params.push(Number(row.turma_id));
      }
      if (meta.hasEventoId) {
        where.push(`evento_id = $${p++}`);
        params.push(Number(row.evento_id));
      }
      if (meta.hasLida) where.push(`lida = false`);

      if (where.length) {
        const dupSql = `SELECT 1 FROM ${meta.tableName} WHERE ${where.join(" AND ")} LIMIT 1`;
        const dup = await query(dupSql, params);
        if ((dup?.rowCount ?? safeRows(dup).length) > 0) continue;
      }

      await criarNotificacao(
        Number(usuario_id),
        `Seu certificado do evento "${row.nome_evento}" já pode ser emitido.`,
        {
          tipo: "certificado",
          titulo: `Certificado disponível: ${row.nome_evento}`,
          turma_id: row.turma_id,
          evento_id: row.evento_id,
        }
      );
    }
  } catch (err) {
    errlog("Erro em gerarNotificacaoDeCertificado:", err?.message || err);
  }
}

/* ============================================================ */
/* 📣 Notificações de reserva                                   */
/* ============================================================ */
async function gerarNotificacaoDeReservaAprovada({
  usuario_id,
  reserva_id,
  sala,
  data,
  periodo,
  finalidade,
  observacao,
}) {
  try {
    if (!usuario_id || !reserva_id) return;
    const meta = await getNotifMeta();

    const where = [];
    const params = [];
    let p = 1;

    if (meta.hasUsuarioId) {
      where.push(`usuario_id = $${p++}`);
      params.push(Number(usuario_id));
    }
    if (meta.hasTipo) where.push(`tipo = 'reserva_aprovada'`);
    if (meta.hasReservaId) {
      where.push(`reserva_id = $${p++}`);
      params.push(Number(reserva_id));
    }
    if (meta.hasLida) where.push(`lida = false`);

    if (where.length) {
      const dupSql = `SELECT 1 FROM ${meta.tableName} WHERE ${where.join(" AND ")} LIMIT 1`;
      const dup = await query(dupSql, params);
      if ((dup?.rowCount ?? safeRows(dup).length) > 0) {
        log("[NOTIF_RESERVA][SKIP_DUPLICADA][APROVADA]", { usuario_id, reserva_id });
        return;
      }
    }

    const dataFmt = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? toBrDateOnlyString(data)
      : toBrDate(data);

    const salaLabel = formatSalaLabel(sala);
    const periodoLabel = formatPeriodoLabel(periodo);

    const mensagemBase = finalidade
      ? `Sua solicitação "${finalidade}" para ${salaLabel}, em ${dataFmt}, no período da ${periodoLabel}, foi aprovada.`
      : `Sua solicitação de uso da ${salaLabel}, em ${dataFmt}, no período da ${periodoLabel}, foi aprovada.`;

    const mensagemFinal = observacao
      ? `${mensagemBase} Observação: ${String(observacao).trim()}`
      : mensagemBase;

    await criarNotificacao(Number(usuario_id), mensagemFinal, {
      tipo: "reserva_aprovada",
      titulo: "Reserva aprovada",
      reserva_id: Number(reserva_id),
    });

    log("[NOTIF_RESERVA][CRIAR][APROVADA]", { usuario_id, reserva_id });
  } catch (err) {
    errlog("[NOTIF_RESERVA][ERRO][APROVADA]", err?.message || err);
  }
}

async function gerarNotificacaoDeReservaRejeitada({
  usuario_id,
  reserva_id,
  sala,
  data,
  periodo,
  finalidade,
  observacao,
}) {
  try {
    if (!usuario_id || !reserva_id) return;
    const meta = await getNotifMeta();

    const where = [];
    const params = [];
    let p = 1;

    if (meta.hasUsuarioId) {
      where.push(`usuario_id = $${p++}`);
      params.push(Number(usuario_id));
    }
    if (meta.hasTipo) where.push(`tipo = 'reserva_rejeitada'`);
    if (meta.hasReservaId) {
      where.push(`reserva_id = $${p++}`);
      params.push(Number(reserva_id));
    }
    if (meta.hasLida) where.push(`lida = false`);

    if (where.length) {
      const dupSql = `SELECT 1 FROM ${meta.tableName} WHERE ${where.join(" AND ")} LIMIT 1`;
      const dup = await query(dupSql, params);
      if ((dup?.rowCount ?? safeRows(dup).length) > 0) {
        log("[NOTIF_RESERVA][SKIP_DUPLICADA][REJEITADA]", { usuario_id, reserva_id });
        return;
      }
    }

    const dataFmt = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? toBrDateOnlyString(data)
      : toBrDate(data);

    const salaLabel = formatSalaLabel(sala);
    const periodoLabel = formatPeriodoLabel(periodo);

    const mensagemBase = finalidade
      ? `Sua solicitação "${finalidade}" para ${salaLabel}, em ${dataFmt}, no período da ${periodoLabel}, não foi aprovada.`
      : `Sua solicitação de uso da ${salaLabel}, em ${dataFmt}, no período da ${periodoLabel}, não foi aprovada.`;

    const mensagemFinal = observacao
      ? `${mensagemBase} Motivo/observação: ${String(observacao).trim()}`
      : mensagemBase;

    await criarNotificacao(Number(usuario_id), mensagemFinal, {
      tipo: "reserva_rejeitada",
      titulo: "Reserva não aprovada",
      reserva_id: Number(reserva_id),
    });

    log("[NOTIF_RESERVA][CRIAR][REJEITADA]", { usuario_id, reserva_id });
  } catch (err) {
    errlog("[NOTIF_RESERVA][ERRO][REJEITADA]", err?.message || err);
  }
}

/* ============================================================ */
/* 📣 Notificações — Submissões de Trabalhos                    */
/* ============================================================ */
async function notificarSubmissaoCriada({ usuario_id, chamada_titulo, trabalho_titulo }) {
  try {
    await criarNotificacao(
      Number(usuario_id),
      `Sua submissão "${trabalho_titulo}" foi enviada para a chamada "${chamada_titulo}".`,
      {
        tipo: "submissao",
        titulo: `Submissão criada: ${trabalho_titulo}`,
      }
    );
  } catch (err) {
    errlog("notificarSubmissaoCriada:", err?.message || err);
  }
}

async function notificarPosterAtualizado({
  usuario_id,
  chamada_titulo,
  trabalho_titulo,
  arquivo_nome,
}) {
  try {
    await criarNotificacao(
      Number(usuario_id),
      `O pôster "${arquivo_nome}" foi anexado/atualizado na submissão "${trabalho_titulo}" da chamada "${chamada_titulo}".`,
      {
        tipo: "submissao",
        titulo: `Pôster anexado: ${trabalho_titulo}`,
      }
    );
  } catch (err) {
    errlog("notificarPosterAtualizado:", err?.message || err);
  }
}

async function notificarStatusSubmissao({
  usuario_id,
  chamada_titulo,
  trabalho_titulo,
  status,
}) {
  try {
    const mapaTit = {
      submetido: "Submissão enviada",
      em_avaliacao: "Em avaliação",
      aprovado_exposicao: "Selecionado para Exposição (banner)",
      aprovado_oral: "Selecionado para Apresentação Oral",
      reprovado: "Não selecionado",
    };

    const mapaMsg = {
      submetido: `Sua submissão "${trabalho_titulo}" foi enviada e aguarda avaliação na chamada "${chamada_titulo}".`,
      em_avaliacao: `Sua submissão "${trabalho_titulo}" está em avaliação na chamada "${chamada_titulo}".`,
      aprovado_exposicao: `Parabéns! O trabalho "${trabalho_titulo}" foi selecionado para Exposição na chamada "${chamada_titulo}".`,
      aprovado_oral: `Parabéns! O trabalho "${trabalho_titulo}" foi selecionado para Apresentação Oral na chamada "${chamada_titulo}".`,
      reprovado: `O trabalho "${trabalho_titulo}" não foi selecionado na chamada "${chamada_titulo}".`,
    };

    await criarNotificacao(
      Number(usuario_id),
      mapaMsg[status] || `Status atualizado: ${status} — "${trabalho_titulo}"`,
      {
        tipo: "submissao",
        titulo: mapaTit[status] || `Status: ${status}`,
      }
    );
  } catch (err) {
    errlog("notificarStatusSubmissao:", err?.message || err);
  }
}

async function notificarClassificacaoDaChamada(chamada_id) {
  try {
    const result = await query(
      `
      SELECT
        s.id AS submissao_id,
        s.usuario_id,
        s.titulo AS trabalho_titulo,
        s.status,
        c.titulo AS chamada_titulo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.chamada_id = $1
      `,
      [Number(chamada_id)]
    );

    const rows = safeRows(result);

    for (const row of rows || []) {
      await notificarStatusSubmissao({
        usuario_id: row.usuario_id,
        chamada_titulo: row.chamada_titulo,
        trabalho_titulo: row.trabalho_titulo,
        status: row.status,
      });
    }
  } catch (err) {
    errlog("notificarClassificacaoDaChamada:", err?.message || err);
  }
}

module.exports = {
  listarNotificacao,
  resumoNotificacoes,
  criarNotificacao,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  gerarNotificacaoDeAvaliacao,
  gerarNotificacaoDeCertificado,
  gerarNotificacaoDeReservaAprovada,
  gerarNotificacaoDeReservaRejeitada,
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
};