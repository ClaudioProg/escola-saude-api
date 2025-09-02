// ✅ src/controllers/presencasController.js
const db = require("../db");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");
const { gerarNotificacoesDeAvaliacao } = require("./notificacoesController");
const jwt = require("jsonwebtoken");

const PRESENCA_TOKEN_SECRET =
  process.env.PRESENCA_TOKEN_SECRET || "troque_em_producao";

/* ------------------------------------------------------------------ *
 * Helpers de data (sempre trabalhando em America/Sao_Paulo)
 * ------------------------------------------------------------------ */
const TZ = "America/Sao_Paulo";

/** yyyy-mm-dd do "agora" em America/Sao_Paulo */
function hojeYMD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((o, p) => ((o[p.type] = p.value), o), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** normaliza entrada "dd/mm/aaaa" | "yyyy-mm-dd" -> "yyyy-mm-dd" */
function normalizarDataEntrada(valor) {
  if (!valor) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dd, mm, yyyy] = valor.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

/** extrai yyyy-mm-dd de uma string/Date */
function ymd(val) {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** cria Date local fixando 12:00 (evita “pulo” de dia ao formatar) */
function localDateFromYMD(ymdStr) {
  return ymdStr ? new Date(`${ymdStr}T12:00:00`) : null;
}

/* ------------------------------------------------------------------ *
 * Utils diversos
 * ------------------------------------------------------------------ */
async function buscarEventoIdDaTurma(turma_id) {
  const rid = `rid=${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  try {
    const { rows } = await db.query(
      `SELECT evento_id FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (rows.length === 0) throw new Error("Turma não encontrada.");
    return rows[0].evento_id;
  } catch (e) {
    console.error("❌ [buscarEventoIdDaTurma]", rid, e?.message);
    throw e;
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/presencas/confirmar  (instrutor)
 * Body: { usuario_id, turma_id, data }
 * ------------------------------------------------------------------ */
async function confirmarPresencaInstrutor(req, res) {
  const { usuario_id, turma_id, data } = req.body;
  const instrutor_id = req.usuario?.id;

  if (!usuario_id || !turma_id || !data) {
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios não informados." });
  }

  try {
    // garante que este instrutor ministra a turma
    const okInstrutor = await db.query(
      `
      SELECT 1
      FROM evento_instrutor ei
      JOIN turmas t ON t.evento_id = ei.evento_id
      WHERE t.id = $1 AND ei.instrutor_id = $2
      `,
      [turma_id, instrutor_id]
    );
    if (okInstrutor.rowCount === 0) {
      return res
        .status(403)
        .json({ erro: "Acesso negado. Você não é instrutor desta turma." });
    }

    // prazo 48h após horário_fim do dia confirmado
    const turmaRes = await db.query(
      `SELECT horario_fim FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const horario_fim = (turmaRes.rows[0].horario_fim || "23:59").slice(0, 5);
    const dataISO = normalizarDataEntrada(data);
    if (!dataISO)
      return res
        .status(400)
        .json({ erro: "Data inválida. Use aaaa-mm-dd ou dd/mm/aaaa." });

    // construímos limite no fuso BR: yyyy-mm-ddTHH:mm
    const fimAula = new Date(`${dataISO}T${horario_fim}:00`);
    const limite = new Date(fimAula.getTime() + 48 * 60 * 60 * 1000);
    if (new Date() > limite) {
      return res
        .status(403)
        .json({ erro: "O prazo de 48h para confirmação já expirou." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
      `,
      [usuario_id, turma_id, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    return res
      .status(200)
      .json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença como instrutor:", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas  (aluno/monitor)
 * Body: { evento_id, data }
 * ------------------------------------------------------------------ */
async function registrarPresenca(req, res) {
  const { evento_id, data } = req.body;
  const usuario_id = req.usuario?.id;

  if (!evento_id || !data) {
    return res.status(400).json({ erro: "Evento e data são obrigatórios." });
  }

  try {
    const dataISO = normalizarDataEntrada(data);
    if (!dataISO) {
      return res
        .status(400)
        .json({ erro: "Data inválida. Use aaaa-mm-dd ou dd/mm/aaaa." });
    }

    // turma onde este usuário está inscrito
    const insc = await db.query(
      `
      SELECT i.turma_id, t.data_inicio::date AS di, t.data_fim::date AS df
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      WHERE i.usuario_id = $1 AND t.evento_id = $2
      `,
      [usuario_id, evento_id]
    );
    if (insc.rowCount === 0) {
      return res
        .status(403)
        .json({ erro: "Você não está inscrito neste evento." });
    }
    const turma_id = insc.rows[0].turma_id;
    const di = ymd(insc.rows[0].di);
    const df = ymd(insc.rows[0].df);

    if (dataISO < di || dataISO > df) {
      return res
        .status(400)
        .json({ erro: "Data fora do período desta turma." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
      `,
      [usuario_id, turma_id, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao registrar presença:", err);
    res.status(500).json({ erro: "Erro ao registrar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmarPresencaViaQR
 * Aceita body { turma_id } ou param :turma_id (rotas legadas)
 * Valida por datas_turma; se vazio, cai no intervalo da turma.
 * ------------------------------------------------------------------ */
async function confirmarPresencaViaQR(req, res) {
  const usuario_id = req.usuario?.id;
  const turma_id = parseInt(req.params.turma_id || req.body.turma_id, 10);

  try {
    if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });
    if (!turma_id) return res.status(400).json({ erro: "turma_id é obrigatório." });

    // precisa estar inscrito na turma
    const insc = await db.query(
      `SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuario_id, turma_id]
    );
    if (insc.rowCount === 0) {
      return res
        .status(403)
        .json({ erro: "Você não está inscrito nesta turma." });
    }

    // datas reais da turma
    const datasTurma = await db.query(
      `SELECT data::date AS d FROM datas_turma WHERE turma_id = $1 ORDER BY data`,
      [turma_id]
    );

    let permitidoHoje = false;
    const hoje = hojeYMD(); // yyyy-mm-dd em America/Sao_Paulo

    if (datasTurma.rowCount > 0) {
      permitidoHoje = datasTurma.rows.some(
        (r) => ymd(r.d) === hoje
      );
    } else {
      // fallback: janela da turma
      const t = await db.query(
        `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
        [turma_id]
      );
      if (t.rowCount === 0)
        return res.status(404).json({ erro: "Turma não encontrada." });
      const di = ymd(t.rows[0].di);
      const df = ymd(t.rows[0].df);
      permitidoHoje = hoje >= di && hoje <= df;
    }

    if (!permitidoHoje) {
      return res
        .status(409)
        .json({ erro: "Hoje não está dentro do período desta turma." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente, origem)
      VALUES ($1, $2, $3, TRUE, 'qr')
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente, origem='qr', atualizado_em = NOW()
      `,
      [usuario_id, turma_id, hoje]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    return res
      .status(201)
      .json({ sucesso: true, mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença via QR:", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-via-token  (token assinado)
 * Body: { token }
 * ------------------------------------------------------------------ */
async function confirmarViaToken(req, res) {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ erro: "Token ausente." });

    let payload;
    try {
      payload = jwt.verify(token, PRESENCA_TOKEN_SECRET); // { turmaId, usuarioId? }
    } catch (e) {
      return res.status(400).json({ erro: "Token inválido ou expirado." });
    }

    const usuario_id = payload.usuarioId || req.usuario?.id;
    if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });

    const turma_id = payload.turmaId;
    if (!turma_id) return res.status(400).json({ erro: "Token sem turma." });

    req.body.turma_id = turma_id;
    req.usuario = { id: usuario_id, ...(req.usuario || {}) };
    return confirmarPresencaViaQR(req, res);
  } catch (err) {
    console.error("❌ [confirmarViaToken] erro:", err);
    return res.status(500).json({ erro: "Erro ao confirmar via token." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/registrar-manual (instrutor/admin)
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function registrarManual(req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;
  if (!usuario_id || !turma_id || !data_presenca) {
    return res
      .status(400)
      .json({
        erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca.",
      });
  }

  try {
    const dataISO = normalizarDataEntrada(data_presenca);
    if (!dataISO) {
      return res
        .status(400)
        .json({
          erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa.",
        });
    }

    const t = await db.query(
      `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (t.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    const di = ymd(t.rows[0].di);
    const df = ymd(t.rows[0].df);
    if (dataISO < di || dataISO > df) {
      return res.status(400).json({ erro: "Data fora do período desta turma." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = FALSE
      `,
      [usuario_id, turma_id, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    res
      .status(201)
      .json({ mensagem: "Presença registrada manualmente como pendente." });
  } catch (err) {
    console.error("❌ Erro ao registrar manualmente:", err);
    res.status(500).json({ erro: "Erro ao registrar presença manual." });
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/presencas/validar
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function validarPresenca(req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;
  if (!usuario_id || !turma_id || !data_presenca) {
    return res
      .status(400)
      .json({
        erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca.",
      });
  }

  try {
    const upd = await db.query(
      `UPDATE presencas SET presente = TRUE
       WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3
       RETURNING *`,
      [usuario_id, turma_id, data_presenca]
    );
    if (upd.rowCount === 0) {
      return res
        .status(404)
        .json({ erro: "Presença não encontrada para validação." });
    }

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    res.json({
      mensagem: "Presença validada com sucesso.",
      presenca: upd.rows[0],
    });
  } catch (err) {
    console.error("❌ Erro ao validar presença:", err);
    res.status(500).json({ erro: "Erro ao validar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-hoje  (admin)
 * Body: { usuario_id, turma_id }
 * ------------------------------------------------------------------ */
async function confirmarHojeManual(req, res) {
  const { usuario_id, turma_id } = req.body;
  if (!usuario_id || !turma_id) {
    return res.status(400).json({ erro: "Dados incompletos." });
  }

  const hojeISO = hojeYMD(); // TZ BR

  try {
    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO NOTHING
      `,
      [usuario_id, turma_id, hojeISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar manualmente:", err);
    res.status(500).json({ erro: "Erro ao registrar presença manual." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/frequencias
 * ------------------------------------------------------------------ */
async function listaPresencasTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const t = await db.query(
      `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (t.rowCount === 0) return res.status(404).json({ erro: "Turma não encontrada." });

    // total de dias do período
    const totRes = await db.query(
      `
      WITH t AS (
        SELECT $1::date AS di, $2::date AS df
      )
      SELECT COUNT(*) AS total_dias
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs;
      `,
      [t.rows[0].di, t.rows[0].df]
    );
    const totalDias = Number(totRes.rows[0]?.total_dias || 0);
    if (totalDias === 0) {
      return res.status(400).json({ erro: "Período da turma inválido (0 dias)." });
    }

    // inscritos + presenças (distinct por dia)
    const presencas = await db.query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf,
             COUNT(DISTINCT p.data_presenca::date) FILTER (WHERE p.presente IS TRUE) AS presencas
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      LEFT JOIN presencas p ON p.usuario_id = u.id AND p.turma_id = i.turma_id
      WHERE i.turma_id = $1
      GROUP BY u.id, u.nome, u.cpf
      ORDER BY u.nome
      `,
      [turma_id]
    );

    const resultado = presencas.rows.map((u) => {
      const pres = Number(u.presencas || 0);
      const freq = totalDias > 0 ? pres / totalDias : 0;
      return {
        usuario_id: u.usuario_id,
        nome: u.nome,
        cpf: u.cpf,
        frequencia: `${Math.round(freq * 100)}%`,
        presente: freq >= 0.75,
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error("❌ Erro ao buscar presenças da turma:", err);
    res.status(500).json({ erro: "Erro ao buscar presenças da turma." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/detalhes
 * ------------------------------------------------------------------ */
async function relatorioPresencasPorTurma(req, res) {
  const { turma_id } = req.params;

  const rid = `rid=${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const isProd = process.env.NODE_ENV === "production";
  const log = (...a) => console.log("📊 [presenças/detalhes]", rid, ...a);
  const warn = (...a) => console.warn("⚠️ [presenças/detalhes]", rid, ...a);
  const errlg = (...a) => console.error("❌ [presenças/detalhes]", rid, ...a);

  const toYMD = (val) => {
    if (!val) return null;
    if (typeof val === "string") {
      const ymd = val.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  try {
    log("⇢ INÍCIO", { turma_id });

    const turmaQ = await db.query(
      `SELECT id, evento_id, data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1 LIMIT 1`,
      [turma_id]
    );
    if (turmaQ.rowCount === 0) {
      warn("Turma não encontrada:", turma_id);
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const eventoId = turmaQ.rows[0].evento_id || null;

    const usuariosQ = await db.query(
      `
      SELECT u.id, u.nome, u.cpf
      FROM inscricoes i
      JOIN usuarios u ON u.id = i.usuario_id
      WHERE i.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );

    const datasQ = await db.query(
      `
      WITH t AS (SELECT $1::date AS di, $2::date AS df)
      SELECT gs::date AS data
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      ORDER BY data
      `,
      [turmaQ.rows[0].di, turmaQ.rows[0].df]
    );
    const datasArr = (datasQ.rows || [])
      .map((r) => toYMD(r.data))
      .filter(Boolean);

    const presQ = await db.query(
      `SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`,
      [turma_id]
    );

    const presMap = new Map();
    for (const r of presQ.rows || []) {
      const uid = String(r.usuario_id);
      const dYMD = toYMD(r.data_presenca);
      if (!uid || !dYMD) continue;
      presMap.set(`${uid}|${dYMD}`, r.presente === true);
    }

    const usuariosArr = (usuariosQ.rows || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      cpf: u.cpf,
      presencas: datasArr.map((data) => {
        const key = `${String(u.id)}|${data}`;
        const presente = presMap.has(key) ? !!presMap.get(key) : false;
        return { data, presente };
      }),
    }));

    return res.json({
      turma_id: Number(turma_id),
      datas: datasArr,
      usuarios: usuariosArr,
      evento_id: eventoId,
    });
  } catch (err) {
    errlg("✗ ERRO GERAL", {
      turma_id,
      message: err?.message,
      stack: err?.stack?.split?.("\n")?.slice?.(0, 5)?.join("\n"),
    });
    return res.status(500).json({
      erro: "Erro ao gerar relatório de presenças.",
      ...(isProd ? {} : { detalhe: err?.message, rid }),
    });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/pdf
 * ------------------------------------------------------------------ */
async function exportarPresencasPDF(req, res) {
  const { turma_id } = req.params;

  try {
    const turmaRes = await db.query(
      `SELECT nome, data_inicio::date AS di, data_fim::date AS df, horario_inicio
         FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const turma = turmaRes.rows[0];

    // datas da turma (yyyy-mm-dd) usando generate_series no DB seria ótimo,
    // mas aqui montamos em memória com segurança:
    const datasTurma = [];
    for (
      let d = localDateFromYMD(ymd(turma.di));
      d <= localDateFromYMD(ymd(turma.df));
      d.setDate(d.getDate() + 1)
    ) {
      datasTurma.push(format(d, "yyyy-MM-dd"));
    }

    const agora = new Date();
    const horarioInicio = (turma.horario_inicio || "08:00").slice(0, 5);

    // inscritos
    const insc = await db.query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf
      FROM usuarios u
      JOIN inscricoes i ON i.usuario_id = u.id
      WHERE i.turma_id = $1
      ORDER BY u.nome
      `,
      [turma_id]
    );

    // presenças
    const pres = await db.query(
      `SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`,
      [turma_id]
    );

    // PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="presencas_turma_${turma_id}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.fontSize(16).text(`Relatório de Presenças – ${turma.nome}`, {
      align: "center",
    });
    doc.moveDown();

    // cabeçalho
    doc.fontSize(12).text("Nome", 50, doc.y, { continued: true });
    doc.text("CPF", 250, doc.y, { continued: true });
    datasTurma.forEach((data) => {
      const ddmm = format(localDateFromYMD(data), "dd/MM", { locale: ptBR });
      doc.text(ddmm, doc.x + 20, doc.y, { continued: true });
    });
    doc.moveDown();

    // linhas
    insc.rows.forEach((inscrito) => {
      doc.text(inscrito.nome, 50, doc.y, { width: 180, continued: true });
      doc.text(inscrito.cpf || "", 250, doc.y, { continued: true });

      datasTurma.forEach((data) => {
        const hit = pres.rows.find(
          (p) =>
            String(p.usuario_id) === String(inscrito.usuario_id) &&
            ymd(p.data_presenca) === data
        );

        let simbolo = "F"; // faltou
        if (hit && hit.presente === true) {
          simbolo = "P"; // presente
        } else {
          // aguardando até +60min do início
          const limite = new Date(`${data}T${horarioInicio}:00`);
          limite.setMinutes(limite.getMinutes() + 60);
          if (agora < limite) simbolo = "...";
        }

        doc.text(simbolo, doc.x + 20, doc.y, { continued: true });
      });

      doc.moveDown();
    });

    doc.end();
  } catch (err) {
    console.error("❌ Erro ao exportar PDF:", err);
    res.status(500).json({ erro: "Erro ao gerar relatório em PDF." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-simples
 * Body: { usuario_id, turma_id, data | data_presenca }
 * ------------------------------------------------------------------ */
async function confirmarPresencaSimples(req, res) {
  const { usuario_id, turma_id } = req.body;
  const perfil = String(req.usuario?.perfil || "").toLowerCase();

  const dataInput = req.body.data_presenca || req.body.data;
  if (!usuario_id || !turma_id || !dataInput) {
    return res
      .status(400)
      .json({ erro: "Dados obrigatórios não informados." });
  }

  const dataISO = normalizarDataEntrada(dataInput);
  if (!dataISO) {
    return res
      .status(400)
      .json({ erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  // retroatividade (admin): até 15 dias
  const hoje = localDateFromYMD(hojeYMD());
  const d = localDateFromYMD(dataISO);
  const diffDias = Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
  const limite = 15;
  if (perfil === "administrador" && diffDias > limite) {
    return res.status(403).json({
      erro: `Administradores só podem confirmar presenças retroativas em até ${limite} dias.`,
    });
  }

  try {
    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
      `,
      [usuario_id, turma_id, dataISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);
    return res
      .status(200)
      .json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença simples:", err);
    return res
      .status(500)
      .json({ erro: "Erro interno ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * Pós-presença: notificação de avaliação (≥ 75% e turma encerrada)
 * ------------------------------------------------------------------ */
async function verificarElegibilidadeParaAvaliacao(usuario_id, turma_id) {
  try {
    const turmaRes = await db.query(
      `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) return;

    const dataFim = localDateFromYMD(ymd(turmaRes.rows[0].df));
    if (new Date() < dataFim) return;

    const totRes = await db.query(
      `
      WITH t AS (SELECT $1::date AS di, $2::date AS df)
      SELECT COUNT(*) AS total_datas
      FROM t, generate_series(t.di, t.df, interval '1 day') AS gs
      `,
      [turmaRes.rows[0].di, turmaRes.rows[0].df]
    );
    const totalDatas = parseInt(totRes.rows[0]?.total_datas || "0", 10);
    if (totalDatas === 0) return;

    const presRes = await db.query(
      `
      SELECT COUNT(DISTINCT data_presenca::date) AS presentes
      FROM presencas
      WHERE turma_id = $1 AND usuario_id = $2 AND presente = TRUE
      `,
      [turma_id, usuario_id]
    );
    const presentes = parseInt(presRes.rows[0]?.presentes || "0", 10);

    if (presentes / totalDatas >= 0.75) {
      await gerarNotificacoesDeAvaliacao(usuario_id);
    }
  } catch (err) {
    console.error("❌ Erro ao verificar elegibilidade de avaliação:", err);
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/admin/listar-tudo
 * ------------------------------------------------------------------ */
async function listarTodasPresencasParaAdmin(req, res) {
  try {
    const result = await db.query(
      `
      SELECT 
        e.id   AS evento_id,
        e.titulo AS evento_titulo,
        t.id   AS turma_id,
        t.nome AS turma_nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ORDER BY e.titulo, t.data_inicio
      `
    );

    const eventosMap = {};
    for (const row of result.rows) {
      const eventoId = row.evento_id;
      if (!eventosMap[eventoId]) {
        eventosMap[eventoId] = {
          evento_id: eventoId,
          titulo: row.evento_titulo,
          turmas: [],
        };
      }
      eventosMap[eventoId].turmas.push({
        id: row.turma_id,
        nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        horario_inicio: row.horario_inicio,
        horario_fim: row.horario_fim,
      });
    }

    res.json({ eventos: Object.values(eventosMap) });
  } catch (err) {
    console.error("❌ Erro ao listar todas as presenças para admin:", err);
    res.status(500).json({ erro: "Erro ao listar presenças." });
  }
}

module.exports = {
  confirmarPresencaInstrutor,
  confirmarPresencaSimples,
  registrarPresenca,
  confirmarPresencaViaQR,
  confirmarViaToken,
  registrarManual,
  validarPresenca,
  confirmarHojeManual,
  listaPresencasTurma,
  relatorioPresencasPorTurma,
  exportarPresencasPDF,
  listarTodasPresencasParaAdmin,
};
