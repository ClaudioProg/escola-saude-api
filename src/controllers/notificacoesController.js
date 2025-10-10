// 📁 src/controllers/notificacoesController.js
const db = require("../db");

const IS_DEV = process.env.NODE_ENV !== "production";
const log = (...a) => IS_DEV && console.log("[notif]", ...a);

/* ------------------------------------------------------------------ */
/* Utils de data (sem 'pulo' de fuso)                                  */
/* ------------------------------------------------------------------ */
let toBrDate = null;
let toBrDateOnlyString = null;

try {
  ({ toBrDate, toBrDateOnlyString } = require("../utils/data"));
} catch {
  // Fallbacks simples (mantêm o app funcionando, mas prefira utils/data)
  toBrDate = (v) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d)) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
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
/* (Opcional) serviço de avaliações pendentes                         */
/* ------------------------------------------------------------------ */
let buscarAvaliacoesPendentes = null;
try {
  ({ buscarAvaliacoesPendentes } = require("./avaliacoesService"));
} catch {
  buscarAvaliacoesPendentes = async () => [];
}

/* ------------------------------------------------------------------ */
/* Descoberta de colunas da tabela `notificacoes` (cache)             */
/* ------------------------------------------------------------------ */
let _notifColsCache = null;

async function getNotifColumns() {
  if (_notifColsCache) return _notifColsCache;

  const q = await db.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'notificacoes'
  `);
  const cols = q.rows.map((r) => r.column_name);
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
  log("colunas notificacoes:", _notifColsCache);
  return _notifColsCache;
}

/* helper: retorna o nome de coluna se existir, senão null */
async function colIf(name) {
  const meta = await getNotifColumns();
  return meta.cols.includes(name) ? name : null;
}

/* ============================================================ */
/* 📥 Listar notificações NÃO LIDAS do usuário logado           */
/* ============================================================ */
async function listarNotificacoes(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();

    const msgCol = meta.hasMensagem ? "mensagem" : (meta.hasCorpo ? "corpo" : null);
    const tsCol  = meta.hasCriadoEm ? "criado_em" : (meta.hasCriadaEm ? "criada_em" : null);

    // Montagem dinâmica do SELECT
    const selectParts = [
      "id",
      meta.hasTipo ? "tipo" : "NULL AS tipo",
      meta.hasTitulo ? "titulo" : "NULL AS titulo",
      msgCol ? `${msgCol} AS msg` : "NULL AS msg",
      meta.hasLida ? "lida" : "false AS lida",
      tsCol ? `${tsCol} AS tstamp` : "NULL AS tstamp",
    ];

    // WHERE dinâmico
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

    const result = await db.query(sql, params);

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      tipo: n.tipo || null,
      titulo: n.titulo || null,
      mensagem: n.msg || "",
      lida: n.lida === true,
      data: n.tstamp ? toBrDate(n.tstamp) : "",
    }));

    return res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/* ============================================================ */
/* 📌 Criar notificação (usa apenas colunas existentes)         */
/* ============================================================ */
async function criarNotificacao(usuario_id, mensagem, extra) {
  try {
    if (!usuario_id || !mensagem) return;

    const meta = await getNotifColumns();
    const data = {};

    if (meta.hasUsuarioId) data.usuario_id = Number(usuario_id);
    if (meta.hasMensagem)  data.mensagem   = String(mensagem);
    else if (meta.hasCorpo) data.corpo     = String(mensagem);
    if (meta.hasLida)      data.lida       = false;
    if (meta.hasCriadoEm)  data.criado_em  = new Date();
    else if (meta.hasCriadaEm) data.criada_em = new Date();

    const safeExtra = extra && typeof extra === "object" ? extra : {};
    if (meta.hasTipo && safeExtra.tipo !== undefined)       data.tipo     = safeExtra.tipo;
    if (meta.hasTitulo && safeExtra.titulo !== undefined)   data.titulo   = safeExtra.titulo;
    if (meta.hasTurmaId && safeExtra.turma_id !== undefined) data.turma_id = Number(safeExtra.turma_id);
    if (meta.hasEventoId && safeExtra.evento_id !== undefined) data.evento_id = Number(safeExtra.evento_id);

    const cols = Object.keys(data);
    if (!cols.length) return;

    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const params = cols.map((c) => data[c]);

    const sql = `INSERT INTO notificacoes (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await db.query(sql, params);
    log("notificação criada:", { usuario_id, titulo: data.titulo, tipo: data.tipo });
  } catch (err) {
    console.error("❌ Erro ao criar notificação:", err.message);
  }
}

/* ============================================================ */
/* 🔢 Contar notificações não lidas                             */
/* ============================================================ */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.json({ totalNaoLidas: 0, total: 0 });
    }

    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS total FROM notificacoes WHERE usuario_id = $1 AND lida = false`,
      [Number(usuario_id)]
    );

    const total = rows[0]?.total || 0;
    // retrocompat
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
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const { id } = req.params;
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const meta = await getNotifColumns();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.status(400).json({ erro: "Tabela de notificações não suporta marcação de leitura." });
    }

    const upd = await db.query(
      `UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2`,
      [Number(id), Number(usuario_id)]
    );

    if (upd.rowCount === 0) return res.status(404).json({ erro: "Notificação não encontrada." });
    return res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

/* ============================================================ */
/* 📝 Notificações de avaliação pendente (pós-evento)           */
/* ============================================================ */
async function gerarNotificacoesDeAvaliacao(usuario_id) {
  try {
    const pendentes = await buscarAvaliacoesPendentes(usuario_id);
    for (const av of pendentes) {
      // evita duplicidade por turma
      const meta = await getNotifColumns();
      const where = [];
      const params = [ Number(usuario_id) ];
      let p = 2;

      if (meta.hasTipo) where.push(`tipo = 'avaliacao'`);
      if (meta.hasTurmaId) { where.push(`turma_id = $${p++}`); params.push(Number(av.turma_id)); }

      const dupSql = `
        SELECT 1 FROM notificacoes
        WHERE usuario_id = $1
          ${where.length ? "AND " + where.join(" AND ") : ""}
      `;
      const dup = await db.query(dupSql, params);
      if (dup.rowCount > 0) continue;

      const nomeEvento = av.nome_evento || av.titulo || "evento";
      await criarNotificacao(
        usuario_id,
        `Já está disponível a avaliação do evento "${nomeEvento}". Acesse o menu Usuário e clique em Certificados Pendentes.`,
        {
          tipo: "avaliacao",
          titulo: `Avaliação disponível para "${nomeEvento}"`,
          turma_id: av.turma_id,
          evento_id: av.evento_id || null,
        }
      );
    }
  } catch (err) {
    console.error("❌ Erro ao gerar notificações de avaliação:", err.message);
  }
}

/* ============================================================ */
/* 🎓 Notificações de certificado                               */
/* Assinaturas suportadas:
 *   gerarNotificacoesDeCertificado(usuario_id, turma_id)
 *   gerarNotificacoesDeCertificado(usuario_id, { turma_id, evento_id, evento_titulo })
 * ============================================================ */
async function gerarNotificacoesDeCertificado(usuario_id, turmaOrOpts = null) {
  try {
    const meta = await getNotifColumns();

    // Normaliza argumentos (overload compatível com seu controller atual)
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

    // Se veio turma/evento, cria notificação específica idempotente
    if (turma_id || evento_id) {
      const where = [];
      const params = [ Number(usuario_id) ];
      let p = 2;

      if (meta.hasTipo) where.push(`tipo = 'certificado'`);
      if (meta.hasTurmaId && turma_id != null) { where.push(`turma_id = $${p++}`); params.push(Number(turma_id)); }
      if (meta.hasEventoId && evento_id != null) { where.push(`evento_id = $${p++}`); params.push(Number(evento_id)); }
      if (meta.hasLida) where.push(`lida = false`);

      const dupSql = `
        SELECT 1 FROM notificacoes
        WHERE ${meta.hasUsuarioId ? "usuario_id = $1" : "1=1"}
          ${where.length ? "AND " + where.join(" AND ") : ""}
      `;
      const dup = await db.query(dupSql, meta.hasUsuarioId ? params : params.slice(1));
      if (dup.rowCount > 0) return;

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

    // Caso contrário, gera notificações para todos os elegíveis sem certificado
    const { rows } = await db.query(
      `
      SELECT
        e.id     AS evento_id,
        e.titulo AS nome_evento,
        t.id     AS turma_id
      FROM turmas t
      JOIN eventos e    ON e.id = t.evento_id
      JOIN inscricoes i ON i.turma_id = t.id AND i.usuario_id = $1
      LEFT JOIN certificados c
        ON c.usuario_id = $1 AND c.evento_id = e.id AND c.turma_id = t.id AND c.tipo = 'usuario'
      WHERE (t.data_fim::text || ' ' || COALESCE(t.horario_fim,'23:59'))::timestamp < NOW()
        AND c.id IS NULL
      ORDER BY t.data_fim DESC
      `,
      [ Number(usuario_id) ]
    );

    for (const row of rows) {
      const where = [];
      const params = [ Number(usuario_id) ];
      let p = 2;

      if (meta.hasTipo) where.push(`tipo = 'certificado'`);
      if (meta.hasTurmaId) { where.push(`turma_id = $${p++}`); params.push(Number(row.turma_id)); }
      if (meta.hasEventoId) { where.push(`evento_id = $${p++}`); params.push(Number(row.evento_id)); }
      if (meta.hasLida) where.push(`lida = false`);

      const dupSql = `
        SELECT 1 FROM notificacoes
        WHERE ${meta.hasUsuarioId ? "usuario_id = $1" : "1=1"}
          ${where.length ? "AND " + where.join(" AND ") : ""}
      `;
      const dup = await db.query(dupSql, meta.hasUsuarioId ? params : params.slice(1));
      if (dup.rowCount > 0) continue;

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
    console.error("❌ Erro em gerarNotificacoesDeCertificado:", err.message);
  }
}

/* ============================================================ */
/* 📣 Notificações — Submissões de Trabalhos                     */
/* ============================================================ */

/** Autor foi bem-sucedido ao criar uma submissão. */
async function notificarSubmissaoCriada({ usuario_id, chamada_titulo, trabalho_titulo, submissao_id }) {
  try {
    await criarNotificacao(
      Number(usuario_id),
      `Sua submissão "${trabalho_titulo}" foi enviada para a chamada "${chamada_titulo}".`,
      { tipo: "submissao", titulo: `Submissão criada: ${trabalho_titulo}` }
    );
  } catch (err) {
    console.error("❌ notificarSubmissaoCriada:", err.message);
  }
}

/** Autor atualizou/enviou pôster (PPT/PPTX). */
async function notificarPosterAtualizado({ usuario_id, chamada_titulo, trabalho_titulo, arquivo_nome }) {
  try {
    await criarNotificacao(
      Number(usuario_id),
      `O pôster "${arquivo_nome}" foi anexado/atualizado na submissão "${trabalho_titulo}" da chamada "${chamada_titulo}".`,
      { tipo: "submissao", titulo: `Pôster anexado: ${trabalho_titulo}` }
    );
  } catch (err) {
    console.error("❌ notificarPosterAtualizado:", err.message);
  }
}

/** Mudança de status de uma submissão para o autor. */
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

    await criarNotificacao(
      Number(usuario_id),
      mapaMsg[status] || `Status atualizado: ${status} — "${trabalho_titulo}"`,
      { tipo: "submissao", titulo: mapaTit[status] || `Status: ${status}` }
    );
  } catch (err) {
    console.error("❌ notificarStatusSubmissao:", err.message);
  }
}

/** Pós-classificação: notifica o autor pelo status final da chamada. */
async function notificarClassificacaoDaChamada(chamada_id) {
  try {
    const { rows } = await db.query(`
      SELECT s.id AS submissao_id,
             s.usuario_id,
             s.titulo AS trabalho_titulo,
             s.status,
             c.titulo AS chamada_titulo
      FROM trabalhos_submissoes s
      JOIN trabalhos_chamadas c ON c.id = s.chamada_id
      WHERE s.chamada_id = $1
    `, [ Number(chamada_id) ]);

    for (const row of rows) {
      await notificarStatusSubmissao({
        usuario_id: row.usuario_id,
        chamada_titulo: row.chamada_titulo,
        trabalho_titulo: row.trabalho_titulo,
        status: row.status,
      });
    }
  } catch (err) {
    console.error("❌ notificarClassificacaoDaChamada:", err.message);
  }
}

/* ───────────────── Exports ───────────────── */
module.exports = {
  listarNotificacoes,
  criarNotificacao,
  contarNaoLidas,
  marcarComoLida,
  gerarNotificacoesDeAvaliacao,
  gerarNotificacoesDeCertificado,
  notificarSubmissaoCriada,
  notificarPosterAtualizado,
  notificarStatusSubmissao,
  notificarClassificacaoDaChamada,
};
