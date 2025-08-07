//presencasController
const db = require('../db');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const ptBR = require('date-fns/locale/pt-BR');
const { gerarNotificacoesDeAvaliacao } = require('./notificacoesController');

// 📌 Função auxiliar para buscar evento_id pela turma
async function buscarEventoIdDaTurma(turma_id) {
  const { rows } = await db.query(`SELECT evento_id FROM turmas WHERE id = $1`, [turma_id]);
  if (rows.length === 0) throw new Error("Turma não encontrada.");
  return rows[0].evento_id;
}

// PATCH /api/presencas/confirmar
async function confirmarPresencaInstrutor(req, res) {
  const { usuario_id, turma_id, data } = req.body;
  const instrutor_id = req.usuario?.id; // <- vem do token

  if (!usuario_id || !turma_id || !data) {
    return res.status(400).json({ erro: 'Campos obrigatórios não informados.' });
  }
  console.log("🔍 Confirmando presença como instrutor:", {
    turma_id,
    instrutor_id
  });
  try {
    // 🔐 Verifica se o instrutor realmente ministra o evento dessa turma
    const instrutorRes = await db.query(`
      SELECT 1
      FROM evento_instrutor ei
      INNER JOIN eventos e ON e.id = ei.evento_id
      INNER JOIN turmas t ON t.evento_id = e.id
      WHERE t.id = $1 AND ei.instrutor_id = $2
    `, [turma_id, instrutor_id]);

    if (instrutorRes.rowCount === 0) {
      console.log("❌ Não encontrou vínculo com evento_instrutor");
      return res.status(403).json({ erro: 'Acesso negado. Você não é instrutor desta turma.' });
    } else {
      console.log("✅ Instrutor vinculado corretamente ao evento");
    }

    // 🕐 Busca horário_fim da turma
    const turmaRes = await db.query(`
      SELECT horario_fim
      FROM turmas
      WHERE id = $1
    `, [turma_id]);

    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    const horario_fim = turmaRes.rows[0].horario_fim;

    const dataHoraFim = new Date(`${data}T${horario_fim}`);
    const limiteConfirmacao = new Date(dataHoraFim.getTime() + 48 * 60 * 60 * 1000);
    const agora = new Date();

    if (agora > limiteConfirmacao) {
      return res.status(403).json({ erro: 'O prazo de 48h para confirmação já expirou.' });
    }

    // ✅ Registra ou atualiza presença
    await db.query(`
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, TRUE)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
    `, [usuario_id, turma_id, data]);

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    return res.status(200).json({ mensagem: 'Presença confirmada com sucesso.' });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença como instrutor:", err);
    return res.status(500).json({ erro: "Erro ao confirmar presença." });
  }
}

const { Turma, Presenca } = require('../db');
const { Op } = require('sequelize');


// 🔹 REGISTRAR PRESENÇA - Monitor/administrador
async function registrarPresenca(req, res) {
  const { evento_id, data } = req.body;
  const usuario_id = req.usuario.id;

  if (!evento_id || !data) {
    return res.status(400).json({ erro: 'Evento e data são obrigatórios.' });
  }

  try {
    const dataValida = await db.query(
      'SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2',
      [evento_id, data]
    );
    if (dataValida.rowCount === 0) {
      return res.status(400).json({ erro: 'Data inválida para este evento.' });
    }

    const inscricao = await db.query(
      `SELECT i.turma_id FROM inscricoes i JOIN turmas t ON i.turma_id = t.id WHERE i.usuario_id = $1 AND t.evento_id = $2`,
      [usuario_id, evento_id]
    );
    if (inscricao.rowCount === 0) {
      return res.status(403).json({ erro: 'Você não está inscrito neste evento.' });
    }

    const turma_id = inscricao.rows[0].turma_id;

    const jaExiste = await db.query(
      'SELECT 1 FROM presencas WHERE usuario_id = $1 AND evento_id = $2 AND data_presenca = $3',
      [usuario_id, evento_id, data]
    );
    if (jaExiste.rowCount > 0) {
      return res.status(400).json({ erro: 'Presença já registrada para este dia.' });
    }

    const result = await db.query(
      `INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [usuario_id, turma_id, data]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: 'Presença registrada com sucesso.', presenca: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao registrar presença:', err);
    res.status(500).json({ erro: 'Erro ao registrar presença.' });
  }
}

// 🔹 CONFIRMAR PRESENÇA VIA QR - usuario
async function confirmarPresencaViaQR(req, res) {
  const usuario_id = req.usuario.id;
  const turma_id = req.params.turma_id;

  try {
    const inscricao = await db.query(
      `SELECT t.evento_id FROM inscricoes i JOIN turmas t ON i.turma_id = t.id WHERE i.usuario_id = $1 AND i.turma_id = $2`,
      [usuario_id, turma_id]
    );
    if (inscricao.rowCount === 0) {
      return res.status(403).json({ erro: 'Você não está inscrito nesta turma.' });
    }

    const evento_id = inscricao.rows[0].evento_id;
    const hoje = new Date().toISOString().split('T')[0];

    const dataValida = await db.query(
      'SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2',
      [evento_id, hoje]
    );
    if (dataValida.rowCount === 0) {
      return res.status(400).json({ erro: 'Hoje não é um dia válido para este evento.' });
    }

    const jaExiste = await db.query(
      'SELECT 1 FROM presencas WHERE usuario_id = $1 AND evento_id = $2 AND data_presenca = $3',
      [usuario_id, evento_id, hoje]
    );
    if (jaExiste.rowCount > 0) {
      return res.status(400).json({ erro: 'Presença já registrada para hoje.' });
    }

    const result = await db.query(
      `INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [usuario_id, evento_id, turma_id, hoje]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: 'Presença registrada com sucesso.', presenca: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao confirmar presença via QR:', err);
    res.status(500).json({ erro: 'Erro ao confirmar presença.' });
  }
}

// Registrar presença manual (instrutor/administrador)
async function registrarManual (req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;

  if (!usuario_id || !turma_id || !data_presenca) {
    return res.status(400).json({ erro: 'Campos obrigatórios: usuario_id, turma_id, data_presenca.' });
  }

  try {
    const evento = await db.query('SELECT evento_id FROM turmas WHERE id = $1', [turma_id]);
    if (evento.rowCount === 0) return res.status(404).json({ erro: 'Turma não encontrada.' });

    const evento_id = evento.rows[0].evento_id;

    const dataValida = await db.query(
      'SELECT 1 FROM datas_evento WHERE evento_id = $1 AND data = $2',
      [evento_id, data_presenca]
    );
    if (dataValida.rowCount === 0) {
      return res.status(400).json({ erro: 'Data inválida para este evento.' });
    }

    const jaExiste = await db.query(
      'SELECT 1 FROM presencas WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3',
      [usuario_id, turma_id, data_presenca]
    );
    if (jaExiste.rowCount > 0) {
      return res.status(400).json({ erro: 'Presença já registrada.' });
    }

    const result = await db.query(
      `INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [usuario_id, evento_id, turma_id, data_presenca]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: 'Presença registrada manualmente como pendente.', presenca: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao registrar manualmente:', err);
    res.status(500).json({ erro: 'Erro ao registrar presença manual.' });
  }
};

// Validar presença (administrador)
async function validarPresenca (req, res) {
  const { usuario_id, turma_id, data_presenca } = req.body;

  if (!usuario_id || !turma_id || !data_presenca) {
    return res.status(400).json({ erro: 'Campos obrigatórios: usuario_id, turma_id, data_presenca.' });
  }

  try {
    const result = await db.query(
      `UPDATE presencas SET presente = TRUE
       WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3
       RETURNING *`,
      [usuario_id, turma_id, data_presenca]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Presença não encontrada para validação.' });
    }

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.json({ mensagem: 'Presença validada com sucesso.', presenca: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao validar presença:', err);
    res.status(500).json({ erro: 'Erro ao validar presença.' });
  }
};

// Registrar manualmente para o dia atual (administrador)
async function confirmarHojeManual (req, res) {
  const { usuario_id, turma_id } = req.body;

  if (!usuario_id || !turma_id) {
    return res.status(400).json({ erro: 'Dados incompletos' });
  }

  const hoje = new Date().toISOString().split("T")[0];

  try {
    const check = await db.query(
      'SELECT 1 FROM presencas WHERE usuario_id = $1 AND turma_id = $2 AND data_presenca = $3',
      [usuario_id, turma_id, hoje]
    );
    if (check.rowCount > 0) {
      return res.status(200).json({ mensagem: 'Presença já confirmada para hoje' });
    }

    const result = await db.query(
      `INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, (SELECT evento_id FROM turmas WHERE id = $2), $3, TRUE)
       RETURNING *`,
      [usuario_id, turma_id, hoje]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    res.status(201).json({ mensagem: 'Presença registrada com sucesso', presenca: result.rows[0] });
  } catch (err) {
    console.error('❌ Erro ao confirmar manualmente:', err);
    res.status(500).json({ erro: 'Erro ao registrar presença manual.' });
  }
};

// Obter lista de presenças por turma
async function listaPresencasTurma(req, res) {
  const { turma_id } = req.params;

  try {
    // Pega o evento dessa turma
    const turmaRes = await db.query('SELECT evento_id FROM turmas WHERE id = $1', [turma_id]);
    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }

    const evento_id = turmaRes.rows[0].evento_id;

    // Datas válidas do evento
    const datasRes = await db.query(
      'SELECT COUNT(*) AS total_dias FROM datas_evento WHERE evento_id = $1',
      [evento_id]
    );
    const totalDias = Number(datasRes.rows[0].total_dias);

    if (totalDias === 0) {
      return res.status(400).json({ erro: 'Este evento não possui datas cadastradas.' });
    }

    // Lista de inscritos e quantas presenças válidas possuem
    const presencas = await db.query(
      `SELECT u.id AS usuario_id, u.nome, u.cpf,
              COUNT(p.*) FILTER (WHERE p.presente = TRUE) AS presencas
       FROM inscricoes i
       JOIN usuarios u ON u.id = i.usuario_id
       LEFT JOIN presencas p ON p.usuario_id = u.id AND p.turma_id = i.turma_id
       WHERE i.turma_id = $1
       GROUP BY u.id, u.nome, u.cpf`,
      [turma_id]
    );

    // Cálculo da frequência
    const resultado = presencas.rows.map(u => {
      const frequencia = u.presencas / totalDias;
      return {
        usuario_id: u.usuario_id,
        nome: u.nome,
        cpf: u.cpf,
        frequencia: `${Math.round(frequencia * 100)}%`,
        presente: frequencia >= 0.75
      };
    });

    res.json(resultado);
  } catch (err) {
    console.error('❌ Erro ao buscar presenças da turma:', err);
    res.status(500).json({ erro: 'Erro ao buscar presenças da turma.' });
  }
}


// GET /api/presencas/turma/:turma_id/detalhes
async function relatorioPresencasPorTurma(req, res) {
  const { turma_id } = req.params;

  try {
    // Pega todos os usuários da turma
    const usuarios = await db.query(
      `SELECT u.id, u.nome, u.cpf
         FROM inscricoes i
         JOIN usuarios u ON u.id = i.usuario_id
         WHERE i.turma_id = $1
         ORDER BY u.nome`,
      [turma_id]
    );
    // Pega todas as datas do evento dessa turma
    const turma = await db.query('SELECT evento_id FROM turmas WHERE id = $1', [turma_id]);
    if (turma.rowCount === 0) return res.status(404).json({ erro: 'Turma não encontrada' });

    const evento_id = turma.rows[0].evento_id;
    const datas = await db.query(
      'SELECT data FROM datas_evento WHERE evento_id = $1 ORDER BY data',
      [evento_id]
    );

    // Pega todas as presenças da turma
    const presencas = await db.query(
      `SELECT usuario_id, data_presenca, presente
         FROM presencas
         WHERE turma_id = $1`,
      [turma_id]
    );

    // Monta o relatório (matriz usuários x datas)
    const datasArr = datas.rows.map(d => d.data);
    const usuariosArr = usuarios.rows.map(u => ({
      ...u,
      presencas: datasArr.map(data => {
        const p = presencas.rows.find(pr =>
          pr.usuario_id === u.id && pr.data_presenca === data
        );
        return { data, presente: p ? p.presente : false };
      })
    }));

    res.json({
      turma_id: Number(turma_id),
      datas: datasArr,
      usuarios: usuariosArr
    });
  } catch (err) {
    console.error('❌ Erro ao gerar relatório detalhado:', err);
    res.status(500).json({ erro: 'Erro ao gerar relatório de presenças.' });
  }
};

// GET /api/presencas/turma/:turma_id/pdf
async function exportarPresencasPDF(req, res) {
  const { turma_id } = req.params;

  try {
    // Busca dados da turma
    const turmaRes = await db.query(`
      SELECT nome, data_inicio, data_fim, horario_inicio
      FROM turmas
      WHERE id = $1
    `, [turma_id]);

    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const turma = turmaRes.rows[0];
    const datasTurma = [];
    let atual = new Date(turma.data_inicio);
    const fim = new Date(turma.data_fim);

    while (atual <= fim) {
      datasTurma.push(format(atual, "yyyy-MM-dd"));
      atual.setDate(atual.getDate() + 1);
    }

    const agora = new Date();
    const horarioInicio = turma.horario_inicio;

    // Busca inscritos
    const inscritosRes = await db.query(`
      SELECT u.id AS usuario_id, u.nome, u.cpf
      FROM usuarios u
      JOIN inscricoes i ON i.usuario_id = u.id
      WHERE i.turma_id = $1
      ORDER BY u.nome
    `, [turma_id]);

    const inscritos = inscritosRes.rows;

    // Busca presenças
    const presencasRes = await db.query(`
      SELECT usuario_id, data_presenca, presente
      FROM presencas
      WHERE turma_id = $1
    `, [turma_id]);

    const presencas = presencasRes.rows;

    // Inicia o PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    res.setHeader("Content-Disposition", `attachment; filename="presencas_turma_${turma_id}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Título
    doc.fontSize(16).text(`Relatório de Presenças – ${turma.nome}`, { align: "center" });
    doc.moveDown();

    // Cabeçalho da tabela
    doc.fontSize(12).text("Nome", 50, doc.y, { continued: true });
    doc.text("CPF", 250, doc.y, { continued: true });

    datasTurma.forEach((data) => {
      const dataFormatada = format(new Date(data), "dd/MM", { locale: pt });
      doc.text(dataFormatada, doc.x + 20, doc.y, { continued: true });
    });

    doc.moveDown();

    // Conteúdo da tabela
    inscritos.forEach((inscrito) => {
      doc.text(inscrito.nome, 50, doc.y, { width: 180, continued: true });
      doc.text(inscrito.cpf, 250, doc.y, { continued: true });

      datasTurma.forEach((data) => {
        const registro = presencas.find(
          (p) =>
            String(p.usuario_id) === String(inscrito.usuario_id) &&
            String(p.data_presenca).substring(0, 10) === data
        );

        let simbolo = "F"; // faltou
        if (registro && registro.presente === true) {
          simbolo = "P";
        } else {
          const dataHoraLimite = new Date(`${data}T${horarioInicio}`);
          dataHoraLimite.setMinutes(dataHoraLimite.getMinutes() + 60);

          if (agora < dataHoraLimite) {
            simbolo = "..."; // aguardando
          }
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

// ✅ Confirmação simples de presença (sem QR, sem data fixa)
async function confirmarPresencaSimples(req, res) {
  const { usuario_id, turma_id, data } = req.body;
  const perfil = req.usuario.perfil;

  // 🛡️ Proteção básica
  if (!usuario_id || !turma_id || !data) {
    return res.status(400).json({ erro: "Dados obrigatórios não informados." });
  }

  // ✅ Determina o formato da data
  let dataFormatada = "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    // Formato ISO (aaaa-mm-dd)
    dataFormatada = data;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
    // Formato brasileiro (dd/mm/aaaa)
    const [dia, mes, ano] = data.split("/");
    dataFormatada = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  } else {
    return res.status(400).json({ erro: "Formato de data inválido. Use aaaa-mm-dd ou dd/mm/aaaa." });
  }

  const dataHoje = new Date();
  const dataPresenca = new Date(dataFormatada);

  // 📌 Limite de 15 dias para administrador
  const limiteDias = 15;
  const diffMs = dataHoje - dataPresenca;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (perfil === "administrador" && diffDias > limiteDias) {
    return res.status(403).json({
      erro: `Administradores só podem confirmar presenças retroativas em até ${limiteDias} dias.`,
    });
  }

  try {
    await db.query(
      `
      INSERT INTO presencas (usuario_id, turma_id, data_presenca, presente)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (usuario_id, turma_id, data_presenca)
      DO UPDATE SET presente = EXCLUDED.presente
    `,
      [usuario_id, turma_id, dataFormatada, true]
    );

    await verificarElegibilidadeParaAvaliacao(usuario_id, turma_id);

    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (erro) {
    console.error("❌ Erro ao confirmar presença simples:", erro);
    return res.status(500).json({ erro: "Erro interno ao confirmar presença." });
  }
}

async function verificarElegibilidadeParaAvaliacao(usuario_id, turma_id) {
  try {
    // 1. Verifica se a turma já terminou
    const turmaRes = await db.query(
      `SELECT data_fim FROM turmas WHERE id = $1`,
      [turma_id]
    );
    if (turmaRes.rowCount === 0) return;
    const dataFim = new Date(turmaRes.rows[0].data_fim);
    const hoje = new Date();
    if (hoje < dataFim) return;

    // 2. Calcula total de datas da turma com base nas datas de presença registradas
    const totalDatasRes = await db.query(
      `SELECT COUNT(DISTINCT data_presenca) AS total FROM presencas WHERE turma_id = $1`,
      [turma_id]
    );
    const totalDatas = parseInt(totalDatasRes.rows[0].total, 10);

    if (totalDatas === 0) return;

    // 3. Conta quantas datas o usuário foi marcado como presente
    const presencasRes = await db.query(
      `SELECT COUNT(DISTINCT data_presenca) AS presentes FROM presencas 
       WHERE turma_id = $1 AND usuario_id = $2 AND presente = TRUE`,
      [turma_id, usuario_id]
    );
    const totalPresentes = parseInt(presencasRes.rows[0].presentes, 10);

    // 4. Verifica se possui >= 75% de presença
    const frequencia = totalPresentes / totalDatas;
    if (frequencia >= 0.75) {
      await gerarNotificacoesDeAvaliacao(usuario_id);
    }
  } catch (err) {
    console.error("❌ Erro ao verificar elegibilidade de avaliação:", err);
  }
}

// GET /api/relatorio-presencas/turma/:turma_id
async function presencasDetalhadasPorTurma(req, res) {
  const { turma_id } = req.params;

  try {
    const turmaRes = await db.query(`
      SELECT data_inicio, data_fim
      FROM turmas
      WHERE id = $1
    `, [turma_id]);

    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const { data_inicio, data_fim } = turmaRes.rows[0];

    const datasTurma = [];
    let atual = new Date(data_inicio);
    const fim = new Date(data_fim);
    while (atual <= fim) {
      datasTurma.push(atual.toISOString().split("T")[0]);
      atual.setDate(atual.getDate() + 1);
    }

    const inscritosRes = await db.query(`
      SELECT u.id AS usuario_id
      FROM usuarios u
      JOIN inscricoes i ON i.usuario_id = u.id
      WHERE i.turma_id = $1
    `, [turma_id]);
    const inscritos = inscritosRes.rows;

    const presencasRes = await db.query(`
      SELECT usuario_id, to_char((data_presenca AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS data_presenca, presente
      FROM presencas
      WHERE turma_id = $1
    `, [turma_id]);

    const presencasRegistradas = presencasRes.rows;

    const resultado = [];
    for (const inscrito of inscritos) {
      for (const data of datasTurma) {
        const registro = presencasRegistradas.find(
          p =>
            String(p.usuario_id) === String(inscrito.usuario_id) &&
            p.data_presenca === data
        );

        resultado.push({
          usuario_id: inscrito.usuario_id,
          data_presenca: data,
data_formatada: data,
          presente: registro?.presente === true,
        });
      }
    }
console.log("📦 Enviando ao frontend:", resultado);
    return res.json({ lista: resultado });
  } catch (err) {
    console.error("❌ Erro ao listar presenças detalhadas:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}


async function listarTodasPresencasParaAdmin(req, res) {
  try {
    const result = await db.query(`
      SELECT 
        e.id AS evento_id,
        e.titulo AS evento_titulo,
        t.id AS turma_id,
        t.nome AS turma_nome,
        t.data_inicio,
        t.data_fim,
        t.horario_inicio,
        t.horario_fim
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      ORDER BY e.titulo, t.data_inicio
    `);

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

    const eventos = Object.values(eventosMap);

    res.json({ eventos });
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
  presencasDetalhadasPorTurma,
  listarTodasPresencasParaAdmin
};