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
    // dd/MM/aaaa com fuso local do servidor
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

async function col(name) {
  const meta = await getNotifColumns();
  return meta.cols.includes(name) ? name : "NULL";
}

/* ============================================================
 * 📥 Listar notificações NÃO LIDAS do usuário logado
 * ============================================================ */
async function listarNotificacoes(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();

    const msgExpr = meta.hasMensagem
      ? "mensagem"
      : meta.hasCorpo
      ? "corpo"
      : "NULL";

    const tsExpr = meta.hasCriadoEm
      ? "criado_em"
      : meta.hasCriadaEm
      ? "criada_em"
      : "NULL";

    const sql = `
      SELECT
        id,
        ${meta.hasTipo ? "tipo" : "NULL AS tipo"},
        ${meta.hasTitulo ? "titulo" : "NULL AS titulo"},
        ${msgExpr} AS msg,
        ${meta.hasLida ? "lida" : "false AS lida"},
        ${tsExpr} AS tstamp
      FROM notificacoes
      WHERE ${meta.hasUsuarioId ? "usuario_id" : "1"} = $1
        ${meta.hasLida ? "AND lida = false" : ""}
      ORDER BY ${tsExpr} DESC NULLS LAST, id DESC
    `;

    const result = await db.query(sql, [usuario_id]);

    const notificacoes = result.rows.map((n) => ({
      id: n.id,
      tipo: n.tipo || null,
      titulo: n.titulo || null,
      mensagem: n.msg || "",
      lida: n.lida === true,
      // ✅ usa util que respeita date-only e formata no TZ correto
      data: n.tstamp ? toBrDate(n.tstamp) : "",
    }));

    return res.status(200).json(notificacoes);
  } catch (err) {
    console.error("❌ Erro ao buscar notificações:", err);
    return res.status(500).json({ erro: "Erro ao buscar notificações." });
  }
}

/* ============================================================
 * 📌 Criar notificação (usa apenas colunas existentes)
 * ============================================================ */
async function criarNotificacao(usuario_id, mensagem, extra) {
  try {
    if (!usuario_id || !mensagem) return;

    const meta = await getNotifColumns();

    const data = {
      ...(meta.hasUsuarioId ? { usuario_id } : {}),
      ...(meta.hasMensagem
        ? { mensagem: String(mensagem) }
        : meta.hasCorpo
        ? { corpo: String(mensagem) }
        : {}),
      ...(meta.hasLida ? { lida: false } : {}),
    };

    const safeExtra = extra && typeof extra === "object" ? extra : {};
    if (meta.hasTipo && safeExtra.tipo !== undefined) data.tipo = safeExtra.tipo;
    if (meta.hasTitulo && safeExtra.titulo !== undefined) data.titulo = safeExtra.titulo;
    if (meta.hasTurmaId && safeExtra.turma_id !== undefined) data.turma_id = safeExtra.turma_id;
    if (meta.hasEventoId && safeExtra.evento_id !== undefined) data.evento_id = safeExtra.evento_id;

    if (meta.hasCriadoEm) data.criado_em = new Date();
    else if (meta.hasCriadaEm) data.criada_em = new Date();

    const cols = Object.keys(data);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const sql = `INSERT INTO notificacoes (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`;
    const params = cols.map((c) => data[c]);

    await db.query(sql, params);
    log("notificação criada:", { usuario_id, titulo: data.titulo, tipo: data.tipo });
  } catch (err) {
    console.error("❌ Erro ao criar notificação:", err.message);
  }
}

/* ============================================================
 * 🔢 Contar notificações não lidas
 * ============================================================ */
async function contarNaoLidas(req, res) {
  try {
    const usuario_id = req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autorizado" });

    const meta = await getNotifColumns();
    if (!meta.hasLida || !meta.hasUsuarioId) {
      return res.json({ totalNaoLidas: 0 });
    }

    const result = await db.query(
      `SELECT COUNT(*) FROM notificacoes WHERE usuario_id = $1 AND lida = false`,
      [usuario_id]
    );

    const totalNaoLidas = parseInt(result.rows[0]?.count || "0", 10);
    return res.json({ totalNaoLidas });
  } catch (err) {
    console.error("❌ Erro ao contar notificações não lidas:", err);
    return res.status(500).json({ erro: "Erro ao contar notificações." });
  }
}

/* ============================================================
 * ✅ Marcar uma notificação como lida
 * ============================================================ */
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
      [id, usuario_id]
    );

    if (upd.rowCount === 0) {
      return res.status(404).json({ erro: "Notificação não encontrada." });
    }
    return res.status(200).json({ mensagem: "Notificação marcada como lida." });
  } catch (err) {
    console.error("❌ Erro ao marcar notificação como lida:", err);
    return res.status(500).json({ erro: "Erro ao atualizar notificação." });
  }
}

/* ============================================================
 * 📝 Notificações de avaliação pendente (pós-evento)
 * ============================================================ */
async function gerarNotificacoesDeAvaliacao(usuario_id) {
  try {
    const pendentes = await buscarAvaliacoesPendentes(usuario_id);
    for (const av of pendentes) {
      // evita duplicidade por turma
      const dup = await db.query(
        `SELECT 1 FROM notificacoes 
         WHERE usuario_id = $1 AND ${await col("tipo")} = 'avaliacao' AND ${await col("turma_id")} = $2`,
        [usuario_id, av.turma_id]
      );
      if (dup.rowCount > 0) continue;

      const dataInicio = toBrDateOnlyString(av.data_inicio);
      const dataFim = toBrDateOnlyString(av.data_fim);
      const nomeEvento = av.nome_evento || av.titulo || "evento";

      await criarNotificacao(
        usuario_id,
        `Já está disponível a avaliação do evento "${nomeEvento}" Acesse o menu Usuário e clique em Certificados Pendentes.`,
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

/* ============================================================
 * 🎓 Notificações de certificado
 * ============================================================ */
async function gerarNotificacoesDeCertificado(usuario_id, opts = null) {
  try {
    if (opts && (opts.turma_id || opts.evento_id || opts.evento_titulo)) {
      const { turma_id = null, evento_id = null, evento_titulo = "evento" } = opts;

      const meta = await getNotifColumns();
      if (meta.hasUsuarioId && meta.hasLida && (meta.hasTurmaId || meta.hasEventoId)) {
        const whereTurma = meta.hasTurmaId ? "COALESCE(turma_id,0) = COALESCE($2,0)" : "1=1";
        const whereEvento = meta.hasEventoId ? "COALESCE(evento_id,0) = COALESCE($3,0)" : "1=1";

        const dup = await db.query(
          `SELECT 1 FROM notificacoes
           WHERE usuario_id = $1 AND ${meta.hasTipo ? "tipo" : "'certificado'"} = 'certificado'
             AND ${whereTurma}
             AND ${whereEvento}
             AND ${meta.hasLida ? "lida = false" : "1=1"}`,
          [usuario_id, turma_id, evento_id]
        );
        if (dup.rowCount > 0) return;
      }

      await criarNotificacao(
        usuario_id,
        `Seu certificado do evento "${evento_titulo}" está disponível para download.`,
        { tipo: "certificado", titulo: `Certificado disponível: ${evento_titulo}`, turma_id, evento_id }
      );
      return;
    }

    const elegiveis = await db.query(
      `
      SELECT
        e.id          AS evento_id,
        e.titulo      AS nome_evento,
        t.id          AS turma_id
      FROM turmas t
      JOIN eventos e    ON e.id = t.evento_id
      JOIN inscricoes i ON i.turma_id = t.id AND i.usuario_id = $1
      LEFT JOIN certificados c ON c.usuario_id = $1 AND c.evento_id = e.id AND c.turma_id = t.id AND c.tipo = 'usuario'
      WHERE t.data_fim <= CURRENT_DATE
        AND c.id IS NULL
      ORDER BY t.data_fim DESC
      `,
      [usuario_id]
    );

    for (const row of elegiveis.rows) {
      const meta = await getNotifColumns();
      const whereTurma = meta.hasTurmaId ? "turma_id = $2" : "1=0";
      const whereEvento = meta.hasEventoId ? "OR evento_id = $3" : "";

      const dup = await db.query(
        `SELECT 1 FROM notificacoes
         WHERE usuario_id = $1 AND ${meta.hasTipo ? "tipo" : "'certificado'"} = 'certificado'
           AND (${whereTurma} ${whereEvento})
           ${meta.hasLida ? "AND lida = false" : ""}`,
        [usuario_id, row.turma_id, row.evento_id]
      );
      if (dup.rowCount > 0) continue;

      await criarNotificacao(
        usuario_id,
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

module.exports = {
  listarNotificacoes,
  criarNotificacao,
  contarNaoLidas,
  marcarComoLida,
  gerarNotificacoesDeAvaliacao,
  gerarNotificacoesDeCertificado,
};
