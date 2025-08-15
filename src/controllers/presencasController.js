// ✅ src/controllers/presencasController.js
const db = require("../db");
const PDFDocument = require("pdfkit");
const { format } = require("date-fns");
const { ptBR } = require("date-fns/locale");
const { gerarNotificacoesDeAvaliacao } = require("./notificacoesController");

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
async function buscarEventoIdDaTurma(turma_id) {
  const { rows } = await db.query(`SELECT evento_id FROM turmas WHERE id = $1`, [turma_id]);
  if (rows.length === 0) throw new Error("Turma não encontrada.");
  return rows[0].evento_id;
}

function normalizarDataEntrada(valor) {
  if (!valor) return null;
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  // dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dd, mm, yyyy] = valor.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * PATCH /api/presencas/confirmar
 * (Instrutor confirma presença de um aluno numa data)
 * Body: { usuario_id, turma_id, data }
 * ------------------------------------------------------------------ */
async function confirmarPresencaInstrutor(req, res) {
  const { usuario_id, turma_id, data } = req.body;
  const instrutor_id = req.usuario?.id;

  if (!usuario_id || !turma_id || !data) {
    return res.status(400).json({ erro: "Campos obrigatórios não informados." });
  }

  try {
    // 🔐 Garante que este instrutor ministra a turma
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
      return res.status(403).json({ erro: "Acesso negado. Você não é instrutor desta turma." });
    }

    // 🕐 Verifica prazo de 48h após horário_fim
    const turmaRes = await db.query(
      `SELECT horario_fim FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const horario_fim = turmaRes.rows[0].horario_fim || "23:59:59";

    const dataISO = normalizarDataEntrada(data);
    if (!dataISO) return res.status(400).json({ erro: "Data inválida. Use aaaa-mm-dd ou dd/mm/aaaa." });

    const dataHoraFim = new Date(`${dataISO}T${horario_fim}`);
    const limite = new Date(dataHoraFim.getTime() + 48 * 60 * 60 * 1000);
    if (new Date() > limite) {
      return res.status(403).json({ erro: "O prazo de 48h para confirmação já expirou." });
    }

    // ✅ Upsert presença
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

    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença como instrutor:", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas
 * Registra presença do próprio usuário num dia do evento (monitor/usuário)
 * Body: { evento_id, data }
 * ------------------------------------------------------------------ */
async function registrarPresenca(req, res) {
  const { evento_id, data } = req.body;
  const usuario_id = req.usuario?.id;

  if (!evento_id || !data) {
    return res.status(400).json({ erro: "Evento e data são obrigatórios." });
    }
  try {
    // Verifica se a data pertence ao evento
    const dataOk = await db.query(
      `SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2`,
      [evento_id, data]
    );
    if (dataOk.rowCount === 0) {
      return res.status(400).json({ erro: "Data inválida para este evento." });
    }

    // Descobre a turma do usuário nesse evento
    const insc = await db.query(
      `
      SELECT i.turma_id
      FROM inscricoes i
      JOIN turmas t ON t.id = i.turma_id
      WHERE i.usuario_id = $1 AND t.evento_id = $2
      `,
      [usuario_id, evento_id]
    );
    if (insc.rowCount === 0) {
      return res.status(403).json({ erro: "Você não está inscrito neste evento." });
    }
    const turma_id = insc.rows[0].turma_id;

    // Upsert na presença
    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
      `,
      [usuario_id, turma_id, data]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao registrar presença:", err);
    res.status(500).json({ erro: "Erro ao registrar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-qr/:turma_id
 * Confirma presença via QR (usuário logado)
 * ------------------------------------------------------------------ */
async function confirmarPresencaViaQR(req, res) {
  const usuario_id = req.usuario?.id;
  const turma_id = req.params.turma_id;

  try {
    // Verifica inscrição nessa turma
    const insc = await db.query(
      `SELECT 1 FROM inscricoes WHERE usuario_id = $1 AND turma_id = $2`,
      [usuario_id, turma_id]
    );
    if (insc.rowCount === 0) {
      return res.status(403).json({ erro: "Você não está inscrito nesta turma." });
    }

    // Hoje precisa ser uma data do evento
    const evento_id = await buscarEventoIdDaTurma(turma_id);
    const hojeISO = new Date().toISOString().split("T")[0];

    const dataOk = await db.query(
      `SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2`,
      [evento_id, hojeISO]
    );
    if (dataOk.rowCount === 0) {
      return res.status(400).json({ erro: "Hoje não é um dia válido para este evento." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
      `,
      [usuario_id, turma_id, hojeISO]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: "Presença registrada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença via QR:", err);
    res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/registrar-manual
 * (instrutor/administrador) marca presença como pendente (presente = FALSE)
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function registrarManual(req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;
  if (!usuario_id || !turma_id || !data_presenca) {
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca." });
  }

  try {
    const evento_id = await buscarEventoIdDaTurma(turma_id);

    // Valida data no calendário do evento
    const okData = await db.query(
      `SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2`,
      [evento_id, data_presenca]
    );
    if (okData.rowCount === 0) {
      return res.status(400).json({ erro: "Data inválida para este evento." });
    }

    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = FALSE
      `,
      [usuario_id, turma_id, data_presenca]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: "Presença registrada manualmente como pendente." });
  } catch (err) {
    console.error("❌ Erro ao registrar manualmente:", err);
    res.status(500).json({ erro: "Erro ao registrar presença manual." });
  }
}

/* ------------------------------------------------------------------ *
 * PATCH /api/presencas/validar
 * Valida uma presença pendente -> presente = TRUE
 * Body: { usuario_id, turma_id, data_presenca }
 * ------------------------------------------------------------------ */
async function validarPresenca(req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;
  if (!usuario_id || !turma_id || !data_presenca) {
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios: usuario_id, turma_id, data_presenca." });
  }

  try {
    const upd = await db.query(
      `UPDATE presencas SET presente = TRUE
       WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3
       RETURNING *`,
      [usuario_id, turma_id, data_presenca]
    );
    if (upd.rowCount === 0) {
      return res.status(404).json({ erro: "Presença não encontrada para validação." });
    }

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.json({ mensagem: "Presença validada com sucesso.", presenca: upd.rows[0] });
  } catch (err) {
    console.error("❌ Erro ao validar presença:", err);
    res.status(500).json({ erro: "Erro ao validar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * POST /api/presencas/confirmar-hoje
 * (admin) confirma presença do dia atual
 * Body: { usuario_id, turma_id }
 * ------------------------------------------------------------------ */
async function confirmarHojeManual(req, res) {
  const { usuario_id, turma_id } = req.body;
  if (!usuario_id || !turma_id) {
    return res.status(400).json({ erro: "Dados incompletos." });
  }

  const hojeISO = new Date().toISOString().split("T")[0];

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
 * Lista inscritos da turma com frequência e se atingiu 75%
 * ------------------------------------------------------------------ */
async function listaPresencasTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const evento_id = await buscarEventoIdDaTurma(turma_id);

    // total de dias do evento
    const totRes = await db.query(
      `SELECT COUNT(*) AS total_dias FROM datas_evento WHERE evento_id = $1`,
      [evento_id]
    );
    const totalDias = Number(totRes.rows[0].total_dias || 0);
    if (totalDias === 0) {
      return res.status(400).json({ erro: "Este evento não possui datas cadastradas." });
    }

    // inscritos e presenças
    const presencas = await db.query(
      `
      SELECT u.id AS usuario_id, u.nome, u.cpf,
             COUNT(*) FILTER (WHERE p.presente = TRUE) AS presencas
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
      const freq = totalDias > 0 ? Number(u.presencas || 0) / totalDias : 0;
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
 * Matriz usuários x datas (true/false)
 * ------------------------------------------------------------------ */
// 🔁 substitua a função inteira por esta versão robusta
async function relatorioPresencasPorTurma(req, res) {
  const { turma_id } = req.params;

  // Normaliza qualquer coisa em "YYYY-MM-DD" (ou null se inválido)
  const toYMD = (val) => {
    if (!val) return null;
    if (typeof val === "string") {
      // aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..." -> pega os 10 primeiros
      const ymd = val.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  try {
    // 1) Usuários da turma
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
    const usuarios = usuariosQ.rows || [];

    // 2) Datas do evento associado a essa turma
    const evento_id = await buscarEventoIdDaTurma(turma_id);
    const datasQ = await db.query(
      `SELECT data FROM datas_evento WHERE evento_id = $1 ORDER BY data`,
      [evento_id]
    );

    // Sempre devolver array (pode ser vazio, sem 500)
    const datasArr = (datasQ.rows || [])
      .map((r) => toYMD(r.data))
      .filter(Boolean);

    // 3) Presenças já registradas para a turma
    const presQ = await db.query(
      `SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`,
      [turma_id]
    );

    // Index rápido: chave `${usuario_id}|${YYYY-MM-DD}` → boolean
    const presMap = new Map();
    for (const r of presQ.rows || []) {
      const uid = String(r.usuario_id);
      const dYMD = toYMD(r.data_presenca);
      if (!uid || !dYMD) continue;
      presMap.set(`${uid}|${dYMD}`, r.presente === true);
    }

    // 4) Monta matriz usuários × datas
    const usuariosArr = usuarios.map((u) => {
      const linhas = datasArr.map((data) => {
        const key = `${String(u.id)}|${data}`;
        const presente = presMap.has(key) ? !!presMap.get(key) : false;
        return { data, presente };
      });
      return { id: u.id, nome: u.nome, cpf: u.cpf, presencas: linhas };
    });

    return res.json({
      turma_id: Number(turma_id),
      datas: datasArr,
      usuarios: usuariosArr,
    });
  } catch (err) {
    console.error("❌ Erro ao gerar relatório detalhado:", {
      turma_id,
      erro: err?.message || err,
      stack: err?.stack,
    });
    return res.status(500).json({ erro: "Erro ao gerar relatório de presenças." });
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/turma/:turma_id/pdf
 * PDF simplificado com P/F/...
 * ------------------------------------------------------------------ */
async function exportarPresencasPDF(req, res) {
  const { turma_id } = req.params;

  try {
    const turmaRes = await db.query(
      `SELECT nome, data_inicio, data_fim, horario_inicio FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }
    const turma = turmaRes.rows[0];

    // Datas da turma (intervalo linear)
    const datasTurma = [];
    let atual = new Date(turma.data_inicio);
    const fim = new Date(turma.data_fim);
    while (atual <= fim) {
      datasTurma.push(format(atual, "yyyy-MM-dd"));
      atual.setDate(atual.getDate() + 1);
    }

    const agora = new Date();
    const horarioInicio = turma.horario_inicio || "08:00:00";

    // Inscritos
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

    // Presenças
    const pres = await db.query(
      `SELECT usuario_id, data_presenca, presente FROM presencas WHERE turma_id = $1`,
      [turma_id]
    );

    // Inicia PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="presencas_turma_${turma_id}.pdf"`
    );
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Título
    doc.fontSize(16).text(`Relatório de Presenças – ${turma.nome}`, { align: "center" });
    doc.moveDown();

    // Cabeçalho
    doc.fontSize(12).text("Nome", 50, doc.y, { continued: true });
    doc.text("CPF", 250, doc.y, { continued: true });
    datasTurma.forEach((data) => {
      const ddmm = format(new Date(data), "dd/MM", { locale: ptBR });
      doc.text(ddmm, doc.x + 20, doc.y, { continued: true });
    });
    doc.moveDown();

    // Linhas
    insc.rows.forEach((inscrito) => {
      doc.text(inscrito.nome, 50, doc.y, { width: 180, continued: true });
      doc.text(inscrito.cpf || "", 250, doc.y, { continued: true });

      datasTurma.forEach((data) => {
        const hit = pres.rows.find(
          (p) =>
            String(p.usuario_id) === String(inscrito.usuario_id) &&
            format(new Date(p.data_presenca), "yyyy-MM-dd") === data
        );

        let simbolo = "F"; // Faltou
        if (hit && hit.presente === true) {
          simbolo = "P"; // Presente
        } else {
          // Aguardando confirmação até +60min do início
          const limite = new Date(`${data}T${horarioInicio}`);
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
 * Admin pode retroagir até 15 dias
 * ------------------------------------------------------------------ */
async function confirmarPresencaSimples(req, res) {
  const { usuario_id, turma_id } = req.body;
  const perfil = String(req.usuario?.perfil || "").toLowerCase();

  // aceita 'data' ou 'data_presenca'
  const dataInput = req.body.data_presenca || req.body.data;
  if (!usuario_id || !turma_id || !dataInput) {
    return res.status(400).json({ erro: "Dados obrigatórios não informados." });
  }

  const dataISO = normalizarDataEntrada(dataInput);
  if (!dataISO) {
    return res
      .status(400)
      .json({ erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  // Regra de retroatividade (apenas admin)
  const hoje = new Date();
  const d = new Date(dataISO);
  const diffDias = Math.floor((hoje - d) / (1000 * 60 * 60 * 24));
  const limite = 15;
  if (perfil === "administrador" && diffDias > limite) {
    return res
      .status(403)
      .json({ erro: `Administradores só podem confirmar presenças retroativas em até ${limite} dias.` });
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

    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença simples:", err);
    return res.status(500).json({ erro: "Erro interno ao confirmar presença." });
  }
}

/* ------------------------------------------------------------------ *
 * Após registrar presença, se a turma terminou e o aluno tem ≥ 75%,
 * gera notificação de avaliação disponível.
 * ------------------------------------------------------------------ */
async function verificarElegibilidadeParaAvaliacao(usuario_id, turma_id) {
  try {
    // Turma já terminou?
    const turmaRes = await db.query(`SELECT data_fim FROM turmas WHERE id = $1`, [turma_id]);
    if (turmaRes.rowCount === 0) return;
    const dataFim = new Date(turmaRes.rows[0].data_fim);
    if (new Date() < dataFim) return;

    // Total de dias da turma = DISTINCT datas_evento do evento
    const evento_id = await buscarEventoIdDaTurma(turma_id);
    const totRes = await db.query(
      `SELECT COUNT(*) AS total FROM datas_evento WHERE evento_id = $1`,
      [evento_id]
    );
    const totalDatas = parseInt(totRes.rows[0].total || "0", 10);
    if (totalDatas === 0) return;

    // Quantos dias presente?
    const presRes = await db.query(
      `
      SELECT COUNT(DISTINCT data_presenca) AS presentes
      FROM presencas
      WHERE turma_id = $1 AND usuario_id = $2 AND presente = TRUE
      `,
      [turma_id, usuario_id]
    );
    const presentes = parseInt(presRes.rows[0].presentes || "0", 10);

    if (presentes / totalDatas >= 0.75) {
      await gerarNotificacoesDeAvaliacao(usuario_id);
    }
  } catch (err) {
    console.error("❌ Erro ao verificar elegibilidade de avaliação:", err);
  }
}

/* ------------------------------------------------------------------ *
 * GET /api/presencas/admin/listar-tudo
 * Estrutura: { eventos: [{ evento_id, titulo, turmas: [...] }]}
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
  registrarManual,
  validarPresenca,
  confirmarHojeManual,
  listaPresencasTurma,
  relatorioPresencasPorTurma,
  exportarPresencasPDF,
  listarTodasPresencasParaAdmin,
};
