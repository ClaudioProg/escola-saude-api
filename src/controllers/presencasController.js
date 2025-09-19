// ✅ src/controllers/presencasController.js
/* eslint-disable no-console */
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

/** Datas reais da turma (prioriza datas_turma; fallback: período da turma) -> array 'YYYY-MM-DD' ordenado */
async function obterDatasDaTurma(turma_id) {
  // 1) Tenta datas_turma
  const datasQ = await db.query(
    `SELECT data::date AS d FROM datas_turma WHERE turma_id = $1 ORDER BY data`,
    [turma_id]
  );
  if (datasQ.rowCount > 0) {
    return datasQ.rows.map((r) => ymd(r.d)).filter(Boolean);
  }

  // 2) Fallback: período da turma
  const t = await db.query(
    `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
    [turma_id]
  );
  if (t.rowCount === 0) return [];

  const di = ymd(t.rows[0].di);
  const df = ymd(t.rows[0].df);
  if (!di || !df) return [];

  const out = [];
  for (
    let d = localDateFromYMD(di);
    d <= localDateFromYMD(df);
    d.setDate(d.getDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Mapa de presenças TRUE por (usuario|data) para a turma */
async function mapearPresencasTrue(turma_id) {
  const presQ = await db.query(
    `SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`,
    [turma_id]
  );
  const map = new Map();
  for (const r of presQ.rows || []) {
    if (r.presente === true) {
      const k = `${String(r.usuario_id)}|${ymd(r.data_presenca)}`;
      map.set(k, true);
    }
  }
  return map;
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

    // prazo 48h após horário_fim do dia confirmado (em horário local)
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

    // monta a data local e aplica a hora de término
    const fimAula = localDateFromYMD(dataISO);
    const [h, m] = horario_fim.split(":").map((n) => parseInt(n, 10) || 0);
    fimAula.setHours(h, m, 0, 0);
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
    const datasTurmaQ = await db.query(
      `SELECT data::date AS d FROM datas_turma WHERE turma_id = $1 ORDER BY data`,
      [turma_id]
    );

    let permitidoHoje = false;
    const hoje = hojeYMD(); // yyyy-mm-dd em America/Sao_Paulo

    if (datasTurmaQ.rowCount > 0) {
      permitidoHoje = datasTurmaQ.rows.some((r) => ymd(r.d) === hoje);
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
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
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
    // Datas reais da turma
    const datas = await obterDatasDaTurma(turma_id);
    if (datas.length === 0) {
      return res.status(400).json({ erro: "Turma sem datas válidas." });
    }

    // Inscritos
    const insc = await db.query(
      `SELECT u.id AS usuario_id, u.nome, u.cpf
         FROM inscricoes i
         JOIN usuarios u ON u.id = i.usuario_id
        WHERE i.turma_id = $1
        ORDER BY u.nome`,
      [turma_id]
    );

    // Presenças TRUE
    const presMap = await mapearPresencasTrue(turma_id);

    const resultado = insc.rows.map((u) => {
      const presentes = datas.filter((d) =>
        presMap.get(`${String(u.usuario_id)}|${d}`)
      ).length;
      const total = datas.length;
      const freqPct = total > 0 ? (presentes / total) * 100 : 0;

      return {
        usuario_id: u.usuario_id,
        nome: u.nome,
        cpf: u.cpf,
        total_encontros: total,
        presentes,
        ausencias: Math.max(0, total - presentes),
        frequencia: `${Math.round(freqPct)}%`,
        presente: freqPct >= 75,
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

  try {
    log("⇢ INÍCIO", { turma_id });

    const turmaQ = await db.query(
      `SELECT id, evento_id FROM turmas WHERE id = $1 LIMIT 1`,
      [turma_id]
    );
    if (turmaQ.rowCount === 0) {
      warn("Turma não encontrada:", turma_id);
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const eventoId = turmaQ.rows[0].evento_id || null;

    // datas reais da turma (ordenadas)
    const datasArr = await obterDatasDaTurma(turma_id);

    // inscritos
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

    // presenças TRUE
    const presMap = await mapearPresencasTrue(turma_id);

    const usuariosArr = usuariosQ.rows.map((u) => {
      const presentesDatas = [];
      const presencas = datasArr.map((data) => {
        const presente = !!presMap.get(`${String(u.id)}|${data}`);
        if (presente) presentesDatas.push(data);
        return { data, presente };
      });

      // ausências = todas as datas - presentes
      const presentesSet = new Set(presentesDatas);
      const ausenciasDatas = datasArr.filter((d) => !presentesSet.has(d));

      return {
        id: u.id,
        nome: u.nome,
        cpf: u.cpf,
        presencas,
        datas_presentes: presentesDatas,
        datas_ausencias: ausenciasDatas,
      };
    });

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
      `SELECT nome, horario_inicio
         FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const turma = turmaRes.rows[0];

    // datas reais da turma (yyyy-mm-dd)
    const datasTurma = await obterDatasDaTurma(turma_id);

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
          // aguardando até +60min do início (quando ainda não marcado)
          const limite = new Date(`${data}T${horarioInicio}:00`);
          limite.setMinutes(limite.getMinutes() + 60);
          if (agora < limite && !hit) simbolo = "...";
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
    // usa o período; a checagem de elegibilidade só acontece após o fim
    const turmaRes = await db.query(
      `SELECT data_inicio::date AS di, data_fim::date AS df FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) return;

    const dataFim = localDateFromYMD(ymd(turmaRes.rows[0].df));
    if (new Date() < dataFim) return;

    // total de encontros reais
    const datas = await obterDatasDaTurma(turma_id);
    const totalDatas = datas.length;
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

/* ------------------------------------------------------------------ *
 * GET /api/presencas/minhas
 * Retorna, por turma do usuário logado:
 * - total_encontros, presentes, ausencias
 * - datas.presentes[], datas.ausencias[] (YYYY-MM-DD)
 * - frequencia (%), status, elegivel_avaliacao
 * - periodo: data_inicio/data_fim + horarios (mais frequentes)
 * ------------------------------------------------------------------ */
async function obterMinhasPresencas(req, res) {
  const usuario_id = req.usuario?.id;
  if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });

  try {
    const sql = `
      WITH minhas_turmas AS (
        SELECT
          t.id AS turma_id,
          t.nome AS turma_nome,
          t.evento_id,
          e.titulo AS evento_titulo,
          t.data_inicio::date AS di_raw,
          t.data_fim::date     AS df_raw,
          t.horario_inicio,
          t.horario_fim
        FROM inscricoes i
        JOIN turmas t  ON t.id = i.turma_id
        JOIN eventos e ON e.id = t.evento_id
        WHERE i.usuario_id = $1
      ),
      datas_base AS (
        -- 1) Preferir datas_turma
        SELECT
          mt.turma_id,
          (dt.data::date) AS d
        FROM minhas_turmas mt
        JOIN datas_turma dt ON dt.turma_id = mt.turma_id

        UNION ALL

        -- 2) Fallback: janela di..df quando NÃO existem datas_turma
        SELECT
          mt.turma_id,
          gs::date AS d
        FROM minhas_turmas mt
        LEFT JOIN datas_turma dt ON dt.turma_id = mt.turma_id
        CROSS JOIN LATERAL generate_series(mt.di_raw, mt.df_raw, interval '1 day') AS gs
        WHERE dt.turma_id IS NULL
      ),
      horarios_calc AS (
        SELECT
          mt.turma_id,
          -- hora mais frequente em datas_turma; se nulo, cai para colunas da turma
          (
            SELECT to_char(x.hi, 'HH24:MI') FROM (
              SELECT dt.horario_inicio AS hi, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = mt.turma_id
              GROUP BY dt.horario_inicio
              ORDER BY COUNT(*) DESC, hi
              LIMIT 1
            ) x
          ) AS hi_freq,
          (
            SELECT to_char(x.hf, 'HH24:MI') FROM (
              SELECT dt.horario_fim AS hf, COUNT(*) c
              FROM datas_turma dt
              WHERE dt.turma_id = mt.turma_id
              GROUP BY dt.horario_fim
              ORDER BY COUNT(*) DESC, hf
              LIMIT 1
            ) x
          ) AS hf_freq
        FROM minhas_turmas mt
      ),
      pres AS (
        SELECT p.turma_id, p.data_presenca::date AS d, BOOL_OR(p.presente) AS presente
        FROM presencas p
        WHERE p.usuario_id = $1
        GROUP BY p.turma_id, p.data_presenca::date
      ),
            agregada AS (
        SELECT
          mt.turma_id,
          mt.turma_nome,
          mt.evento_id,
          mt.evento_titulo,

          -- período real com base nas datas
          MIN(db.d) AS di,
          MAX(db.d) AS df,

          -- horários
          COALESCE(hc.hi_freq, to_char(mt.horario_inicio, 'HH24:MI'), '08:00') AS hi,
          COALESCE(hc.hf_freq, to_char(mt.horario_fim, 'HH24:MI'), '17:00') AS hf,

          -- totais
          COUNT(*) AS total_encontros,
          COUNT(*) FILTER (WHERE db.d <= CURRENT_DATE) AS realizados,

          -- presenças (todas e só passadas)
          COUNT(*) FILTER (WHERE p.presente IS TRUE) AS presentes_total,
          COUNT(*) FILTER (WHERE p.presente IS TRUE AND db.d <= CURRENT_DATE) AS presentes_passados,

          -- ausências só contam datas passadas/hoje sem presença
          COUNT(*) FILTER (
            WHERE (db.d <= CURRENT_DATE) AND COALESCE(p.presente, FALSE) IS NOT TRUE
          ) AS ausencias,

          -- arrays de datas
          ARRAY_AGG( to_char(db.d, 'YYYY-MM-DD') ORDER BY db.d )
            FILTER (WHERE p.presente IS TRUE) AS datas_presentes,

          ARRAY_AGG( to_char(db.d, 'YYYY-MM-DD') ORDER BY db.d )
            FILTER (WHERE (db.d <= CURRENT_DATE) AND COALESCE(p.presente, FALSE) IS NOT TRUE)
            AS datas_ausentes
        FROM minhas_turmas mt
        JOIN datas_base   db ON db.turma_id = mt.turma_id
        LEFT JOIN pres     p ON p.turma_id  = mt.turma_id AND p.d = db.d
        LEFT JOIN horarios_calc hc ON hc.turma_id = mt.turma_id
        GROUP BY
          mt.turma_id, mt.turma_nome, mt.evento_id, mt.evento_titulo,
          hc.hi_freq, hc.hf_freq, mt.horario_inicio, mt.horario_fim
      )
      SELECT
        turma_id,
        turma_nome,
        evento_id,
        evento_titulo,
        to_char(di, 'YYYY-MM-DD') AS data_inicio,
        to_char(df, 'YYYY-MM-DD') AS data_fim,
        hi AS horario_inicio,
        hf AS horario_fim,
        total_encontros,
        realizados,
        presentes_passados,
        ausencias,
        -- frequência ATUAL (base nos encontros já realizados)
        ROUND(
          CASE WHEN realizados > 0
               THEN (presentes_passados::numeric / realizados) * 100
               ELSE 0 END, 1
        ) AS frequencia_atual,
        -- frequência TOTAL (informativa; base no total da turma)
        ROUND(
          CASE WHEN total_encontros > 0
               THEN (presentes_passados::numeric / total_encontros) * 100
               ELSE 0 END, 1
        ) AS frequencia_total,
        CASE
          WHEN CURRENT_DATE < to_date(to_char(di,'YYYY-MM-DD'),'YYYY-MM-DD') THEN 'agendado'
          WHEN CURRENT_DATE > to_date(to_char(df,'YYYY-MM-DD'),'YYYY-MM-DD') THEN 'encerrado'
          ELSE 'andamento'
        END AS status,
        (CURRENT_DATE > to_date(to_char(df,'YYYY-MM-DD'),'YYYY-MM-DD'))
          AND (presentes_passados::numeric / NULLIF(total_encontros,0) >= 0.75) AS elegivel_avaliacao,
        COALESCE(datas_presentes, '{}') AS datas_presentes,
        COALESCE(datas_ausentes,  '{}') AS datas_ausentes
      FROM agregada
      ORDER BY df DESC, turma_id DESC
    `;

    const { rows } = await db.query(sql, [usuario_id]);

    const payload = {
      usuario_id,
      total_turmas: rows.length,
      turmas: rows.map(r => ({
        turma_id: r.turma_id,
        turma_nome: r.turma_nome,
        evento_id: r.evento_id,
        evento_titulo: r.evento_titulo,
        periodo: {
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          horario_inicio: r.horario_inicio,
          horario_fim: r.horario_fim,
        },
        total_encontros: Number(r.total_encontros) || 0,
        encontros_realizados: Number(r.realizados) || 0,
        presentes: Number(r.presentes_passados) || 0,
        ausencias: Number(r.ausencias) || 0, // já é só do passado
        frequencia: Number(r.frequencia_atual) || 0, // base nos realizados
        frequencia_total: Number(r.frequencia_total) || 0,
        status: r.status,
        elegivel_avaliacao: !!r.elegivel_avaliacao,
        datas: {
          presentes: r.datas_presentes || [],
          ausencias: r.datas_ausentes || [],
        },
        base: {
          atual: Number(r.realizados) || 0,
          total: Number(r.total_encontros) || 0,
        },
      })),
    };

    return res.json(payload);
  } catch (err) {
    console.error("❌ [obterMinhasPresencas]", err);
    return res.status(500).json({ erro: "Erro ao carregar suas presenças." });
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
  obterMinhasPresencas,
};
