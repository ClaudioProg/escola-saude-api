/* eslint-disable no-console */
// 📁 src/controllers/notificacaoController.js — PREMIUM (compat DB, date-only safe, idempotência, menos queries)
const dbMod = require("../db");

// Compat: alguns projetos exportam { pool, query }, outros { db } (pg-promise), outros exportam direto.
const pgpDb = dbMod?.db ?? null; // pg-promise costuma expor { db }
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

/* ------------------------------------------------------------------ */
/* Utils de data (sem 'pulo' de fuso)                                  */
/* ------------------------------------------------------------------ */
let toBrDate = null;
let toBrDateOnlyString = null;

try {
  ({ toBrDate, toBrDateOnlyString } = require("../utils/dateTime"));
} catch {
  // Fallbacks simples (mantêm o app funcionando, mas prefira utils/dateTime)
  toBrDate = (v) => {
    if (!v) return "";
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    // usa UTC pra evitar “pulo”
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${da}/${m}/${y}`;
  };
  toBrDateOnlyString = (yyyyMmDd) => {
    if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
    const m = /^\d{4}-\d{2}-\d{2}$/.exec(yyyyMmDd);
    if (!m) return "";
    const [y, mo, d] = yyyyMmDd.split("-");
    return `${d}/${mo}/${y}`;
  };
}

/* ------------------------------------------------------------------ */
/* (Opcional) serviço de avaliações pendentes                          */
/* ------------------------------------------------------------------ */
let buscarAvaliacaoPendentes = null;
try {
  ({ buscarAvaliacaoPendentes } = require("./avaliacaoService"));
} catch {
  buscarAvaliacaoPendentes = async () => [];
}

/* ------------------------------------------------------------------ */
/* Descoberta de colunas da tabela `notificacao` (cache)              */
/* ------------------------------------------------------------------ */
let _notifColsCache = null;

async function getNotifColumns() {
  if (_notifColsCache) return _notifColsCache;

  const q = await query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'notificacao'
  `);

  const rows = q?.rows || q; // compat caso db retorne rows direto (pg-promise)
  const cols = (rows || []).map((r) => r.column_name);
  const has = (c) => cols.includes(c);

  _notifColsCache = {
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
  };

  log("colunas notificacao:", _notifColsCache);
  return _notifColsCache;
}

/* ============================================================ */
/* 📥 Listar notificações NÃO LIDAS do usuário logado           */
/* ============================================================ */
async function listarNotificacao(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();

    const msgCol = meta.hasMensagem ? "mensagem" : meta.hasCorpo ? "corpo" : null;
    const tsCol = meta.hasCriadoEm ? "criado_em" : meta.hasCriadaEm ? "criada_em" : null;

    const selectParts = [
      "id",
      meta.hasTipo ? "tipo" : "NULL AS tipo",
      meta.hasTitulo ? "titulo" : "NULL AS titulo",
      msgCol ? `${msgCol} AS msg` : "NULL AS msg",
      meta.hasLida ? "lida" : "false AS lida",
      tsCol ? `${tsCol} AS tstamp` : "NULL AS tstamp",
    ];

    const whereParts = [];
    const params = [];
    let p = 1;

    if (meta.hasUsuarioId) {
      whereParts.push(`usuario_id = $${p++}`);
      params.push(Number(usuario_id));
    }
    if (meta.hasLida) {
      whereParts.push("lida = false");
    }

    const sql = `
      SELECT ${selectParts.join(", ")}
        FROM notificacoes
        ${whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : ""}
       ORDER BY ${tsCol ? `${tsCol} DESC NULLS LAST, ` : ""}id DESC
    `;

    const result = await query(sql, params);
    const rows = result?.rows || result;

    const notificacao = (rows || []).map((n) => ({
      id: n.id,
      tipo: n.tipo || null,
      titulo: n.titulo || null,
      mensagem: n.msg || "",
      lida: n.lida === true,
      data: n.tstamp ? toBrDate(n.tstamp) : "",
    }));

    return res.status(200).json(notificacao);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/* ============================================================ */
/* 📌 Criar notificação (usa apenas colunas existentes)         */
/* - Agora com timestamp via SQL (now()) quando possível        */
/* ============================================================ */
async function criarNotificacao(usuario_id, mensagem, extra) {
  try {
    if (!usuario_id || !mensagem) return;

    const meta = await getNotifColumns();
    const data = {};

    if (meta.hasUsuarioId) data.usuario_id = Number(usuario_id);

    if (meta.hasMensagem) data.mensagem = String(mensagem);
    else if (meta.hasCorpo) data.corpo = String(mensagem);

    if (meta.hasLida) data.lida = false;

    // ✅ Evita Date() no JS: deixa o banco preencher (now()) quando existir coluna
    // Se não houver coluna de timestamp, simplesmente não seta.
    const tsCol = meta.hasCriadoEm ? "criado_em" : meta.hasCriadaEm ? "criada_em" : null;

    const safeExtra = extra && typeof extra === "object" ? extra : {};
    if (meta.hasTipo && safeExtra.tipo !== undefined) data.tipo = safeExtra.tipo;
    if (meta.hasTitulo && safeExtra.titulo !== undefined) data.titulo = safeExtra.titulo;

    if (meta.hasTurmaId && safeExtra.turma_id !== undefined && safeExtra.turma_id !== null) {
      data.turma_id = Number(safeExtra.turma_id);
    }
    if (meta.hasEventoId && safeExtra.evento_id !== undefined && safeExtra.evento_id !== null) {
      data.evento_id = Number(safeExtra.evento_id);
    }

    const cols = Object.keys(data);

    // Adiciona tsCol com now() (sem passar param)
    const colsFinal = tsCol ? cols.concat([tsCol]) : cols;
    if (!colsFinal.length) return;

    const params = cols.map((c) => data[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).concat(tsCol ? ["now()"] : []);

    const sql = `INSERT INTO notificacao (${colsFinal.join(", ")})
                 VALUES (${placeholders.join(", ")})`;

    await query(sql, params);
    log("notificação criada:", { usuario_id, tipo: data.tipo, titulo: data.titulo });
  } catch (err) {
    console.error("❌ Erro ao criar notificação:", err?.message || err);
  }
}

/* ============================================================ */
/* 🔢 Contar notificações não lidas                             */
/* ============================================================ */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.user?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.json({ totalNaoLidas: 0, total: 0 });
    }

    const result = await query(
      `SELECT COUNT(*)::int AS total
         FROM notificacoes
        WHERE usuario_id = $1 AND lida = false`,
      [Number(usuario_id)]
    );
    const rows = result?.rows || result;

    const total = rows?.[0]?.total || 0;
    return res.json({ totalNaoLidas: total, total });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err);
    return res.status(500).json({ erro: "Erro ao contar notificações." });
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
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ erro: "ID inválido." });

    const meta = await getNotifColumns();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.status(400).json({ erro: "Tabela de notificações não suporta marcação de leitura." });
    }

    const upd = await query(
      `UPDATE notificacao
          SET lida = true
        WHERE id = $1 AND usuario_id = $2`,
      [id, Number(usuario_id)]
    );

    // pg: upd.rowCount, pg-promise: upd pode ser result ou rows
    const rowCount = upd?.rowCount ?? 0;

    if (rowCount === 0) return res.status(404).json({ erro: "Notificação não encontrada." });
    return res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

/* ============================================================ */
/* 📝 Notificações de avaliação pendente (pós-evento)           */
/* - Idempotência com query única (quando possível)             */
/* ============================================================ */
async function gerarNotificacaoDeAvaliacao(usuario_id) {
  try {
    if (!usuario_id) return;

    const meta = await getNotifColumns();
    const pendentes = await buscarAvaliacaoPendentes(usuario_id);

    for (const av of pendentes) {
      const turmaId = av?.turma_id != null ? Number(av.turma_id) : null;
      const eventoId = av?.evento_id != null ? Number(av.evento_id) : null;
      const nomeEvento = av.nome_evento || av.titulo || "evento";

      // Se não tem colunas pra idempotência, ainda cria “best-effort”
      if (!meta.hasUsuarioId || !meta.hasTipo) {
        await criarNotificacao(
          usuario_id,
          `Já está disponível a avaliação do evento "${nomeEvento}". Acesse o menu Usuário e clique em Certificados Pendentes.`,
          { tipo: "avaliacao", titulo: `Avaliação disponível para "${nomeEvento}"`, turma_id: turmaId, evento_id: eventoId }
        );
        continue;
      }

      // Checa duplicidade: tipo + turma_id (se existir) + usuario
      const where = [`usuario_id = $1`, `tipo = 'avaliacao'`];
      const params = [Number(usuario_id)];
      let p = 2;

      if (meta.hasTurmaId && turmaId != null) {
        where.push(`turma_id = $${p++}`);
        params.push(turmaId);
      }

      const dupSql = `SELECT 1 FROM notificacoes WHERE ${where.join(" AND ")} LIMIT 1`;
      const dup = await query(dupSql, params);
      if ((dup?.rowCount ?? (dup?.rows?.length || 0)) > 0) continue;

      await criarNotificacao(
        usuario_id,
        `Já está disponível a avaliação do evento "${nomeEvento}". Acesse o menu Usuário e clique em Certificados Pendentes.`,
        {
          tipo: "avaliacao",
          titulo: `Avaliação disponível para "${nomeEvento}"`,
          turma_id: turmaId,
          evento_id: eventoId,
        }
      );
    }
  } catch (err) {
    console.error("❌ Erro ao gerar notificações de avaliação:", err?.message || err);
  }
}

/* ============================================================ */
/* 🎓 Notificações de certificado                               */
/* Assinaturas suportadas:
 *   gerarNotificacaoDeCertificado(usuario_id, turma_id)
 *   gerarNotificacaoDeCertificado(usuario_id, { turma_id, evento_id, evento_titulo })
 * ============================================================ */
async function gerarNotificacaoDeCertificado(usuario_id, turmaOrOpts = null) {
  try {
    if (!usuario_id) return;
    const meta = await getNotifColumns();

    // Normaliza argumentos (overload compatível)
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

    // 1) Notificação específica idempotente
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
        const dupSql = `SELECT 1 FROM notificacoes WHERE ${where.join(" AND ")} LIMIT 1`;
        const dup = await query(dupSql, params);
        if ((dup?.rowCount ?? (dup?.rows?.length || 0)) > 0) return;
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

    // 2) Varre elegíveis sem certificado (somente participante tipo 'usuario')
    const result = await query(
      `
      SELECT
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id
      FROM turmas t
      JOIN eventos e    ON e.id = t.evento_id
      JOIN inscricao i ON i.turma_id = t.id AND i.usuario_id = $1
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

    const rows = result?.rows || result;

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
        const dupSql = `SELECT 1 FROM notificacoes WHERE ${where.join(" AND ")} LIMIT 1`;
        const dup = await query(dupSql, params);
        if ((dup?.rowCount ?? (dup?.rows?.length || 0)) > 0) continue;
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
    console.error("❌ Erro em gerarNotificacaoDeCertificado:", err?.message || err);
  }
}

/* ============================================================ */
/* 📣 Notificações — Submissões de Trabalhos                     */
/* ============================================================ */
async function notificarSubmissaoCriada({ usuario_id, chamada_titulo, trabalho_titulo }) {
  try {
    await criarNotificacao(Number(usuario_id), `Sua submissão "${trabalho_titulo}" foi enviada para a chamada "${chamada_titulo}".`, {
      tipo: "submissao",
      titulo: `Submissão criada: ${trabalho_titulo}`,
    });
  } catch (err) {
    console.error("❌ notificarSubmissaoCriada:", err?.message || err);
  }
}

async function notificarPosterAtualizado({ usuario_id, chamada_titulo, trabalho_titulo, arquivo_nome }) {
  try {
    await criarNotificacao(
      Number(usuario_id),
      `O pôster "${arquivo_nome}" foi anexado/atualizado na submissão "${trabalho_titulo}" da chamada "${chamada_titulo}".`,
      { tipo: "submissao", titulo: `Pôster anexado: ${trabalho_titulo}` }
    );
  } catch (err) {
    console.error("❌ notificarPosterAtualizado:", err?.message || err);
  }
}

async function notificarStatusSubmissao({ usuario_id, chamada_titulo, trabalho_titulo, status }) {
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
      aprovado_exposicao: `Parabéns! O trabalho "${trabalho_titulo}" foi selecionado para **Exposição** na chamada "${chamada_titulo}".`,
      aprovado_oral: `Parabéns! O trabalho "${trabalho_titulo}" foi selecionado para **Apresentação Oral** na chamada "${chamada_titulo}".`,
      reprovado: `O trabalho "${trabalho_titulo}" não foi selecionado na chamada "${chamada_titulo}".`,
    };

    await criarNotificacao(Number(usuario_id), mapaMsg[status] || `Status atualizado: ${status} — "${trabalho_titulo}"`, {
      tipo: "submissao",
      titulo: mapaTit[status] || `Status: ${status}`,
    });
  } catch (err) {
    console.error("❌ notificarStatusSubmissao:", err?.message || err);
  }
}

async function notificarClassificacaoDaChamada(chamada_id) {
  try {
    const result = await query(
      `
      SELECT s.id AS submissao_id,
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
    const rows = result?.rows || result;

    for (const row of rows || []) {
      await notificarStatusSubmissao({
        usuario_id: row.usuario_id,
        chamada_titulo: row.chamada_titulo,
        trabalho_titulo: row.trabalho_titulo,
        status: row.status,
      });
    }
  } catch (err) {
    console.error("❌ notificarClassificacaoDaChamada:", err?.message || err);
  }
}

/* ───────────────── Exports ───────────────── */
module.exports = {
  listarNotificacao,
  criarNotificacao,
  contarNaoLidas,
  marcarComoLida,
  gerarNotificacaoDeAvaliacao,
  gerarNotificacaoDeCertificado,
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
};
