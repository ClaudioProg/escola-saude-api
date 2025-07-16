const db = require('../db');
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');
const ptBR = require('date-fns/locale/pt-BR');

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
      `INSERT INTO presencas (usuario_id, evento_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [usuario_id, evento_id, turma_id, data]
    );

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
      `INSERT INTO presencas (usuario_id, evento_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [usuario_id, evento_id, turma_id, hoje]
    );

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
      `INSERT INTO presencas (usuario_id, evento_id, turma_id, data_presenca, presente)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [usuario_id, evento_id, turma_id, data_presenca]
    );

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

    res.json({ mensagem: 'Presença presente com sucesso.', presenca: result.rows[0] });
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
      `INSERT INTO presencas (usuario_id, turma_id, evento_id, data_presenca, presente)
       VALUES ($1, $2, (SELECT evento_id FROM turmas WHERE id = $2), $3, TRUE)
       RETURNING *`,
      [usuario_id, turma_id, hoje]
    );

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
    const result = await db.query(
      `SELECT usuario_id, COUNT(*) > 0 AS presente
FROM presencas
WHERE turma_id = $1 AND presente = TRUE
GROUP BY usuario_id`,
      [turma_id]
    );

    res.json(result.rows);
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
        return { data, presente: !!p, presente: p ? p.presente : false };
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
async function exportarPresencasPDF (req, res) {
  const { turma_id } = req.params;

  try {
    // Busca turma, evento e datas
    const turmaResult = await db.query(
      `SELECT t.nome AS turma_nome, e.titulo AS evento_titulo, t.data_inicio, t.data_fim
       FROM turmas t JOIN eventos e ON t.evento_id = e.id WHERE t.id = $1`, [turma_id]);
    if (turmaResult.rowCount === 0) return res.status(404).json({ erro: 'Turma não encontrada' });
    const turma = turmaResult.rows[0];

    const eventoIdResult = await db.query('SELECT evento_id FROM turmas WHERE id = $1', [turma_id]);
    const evento_id = eventoIdResult.rows[0].evento_id;

    const datasResult = await db.query(
      'SELECT data FROM datas_evento WHERE evento_id = $1 ORDER BY data', [evento_id]);
    const datasArr = datasResult.rows.map(d => d.data);

    // Busca usuários inscritos
    const usuariosResult = await db.query(
      `SELECT u.id, u.nome, u.cpf
         FROM inscricoes i
         JOIN usuarios u ON u.id = i.usuario_id
         WHERE i.turma_id = $1
         ORDER BY u.nome`, [turma_id]);
    const usuariosArr = usuariosResult.rows;

    // Busca presenças
    const presencasResult = await db.query(
      `SELECT usuario_id, data_presenca FROM presencas WHERE turma_id = $1`, [turma_id]);
    const presencasArr = presencasResult.rows;

    // Começa a gerar o PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });

    // Cabeçalhos HTTP
    res.setHeader('Content-disposition', `attachment; filename=presencas_turma_${turma_id}.pdf`);
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    // Título
doc.fontSize(18).text(`Relatório de Presenças - ${turma.evento_titulo}`, { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(13).text(`Turma: ${turma.turma_nome}`, { align: 'center' });
doc.text(
  `Período: ${format(new Date(turma.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(turma.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`,
  { align: 'center' }
);

    doc.moveDown();

    // Tabela (nome, CPF, datas...)
    const tableTop = doc.y + 10;
    const colWidthNome = 200;
    const colWidthCpf = 110;
    const colWidthPresenca = 38;
    const startX = 40;

    // Cabeçalho da tabela
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Nome', startX, tableTop, { width: colWidthNome });
    doc.text('CPF', startX + colWidthNome, tableTop, { width: colWidthCpf });
    datasArr.forEach((data, idx) => {
      doc.text(format(new Date(data), 'dd/MM', { locale: ptBR }), startX + colWidthNome + colWidthCpf + (idx * colWidthPresenca), tableTop, { width: colWidthPresenca, align: 'center' });
    });

    // Dados dos alunos
    let rowY = tableTop + 16;
    doc.font('Helvetica');
    usuariosArr.forEach((user, rowIdx) => {
      doc.text(user.nome, startX, rowY, { width: colWidthNome });
      doc.text(user.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"), startX + colWidthNome, rowY, { width: colWidthCpf });

      datasArr.forEach((data, idx) => {
        const presente = presencasArr.some(
          p => p.usuario_id === user.id && p.data_presenca === data
        );
        doc.text(presente ? '✔️' : '', startX + colWidthNome + colWidthCpf + (idx * colWidthPresenca) + 12, rowY, { width: colWidthPresenca, align: 'center' });
      });

      rowY += 16;
      // Quebra de página se necessário
      if (rowY > 550) {
        doc.addPage();
        rowY = 40;
      }
    });

    doc.end();
  } catch (err) {
    console.error('❌ Erro ao exportar PDF:', err);
    res.status(500).json({ erro: 'Erro ao exportar PDF.' });
  }
};

// Confirmar presença simples (administrador ou painel)
// Confirmar presença simples (administrador ou painel)
async function confirmarPresencaSimples(req, res) {
  try {
    const { turma_id, usuario_id, data_presenca } = req.body;

    if (!turma_id || !usuario_id) {
      return res.status(400).json({ erro: "turma_id e usuario_id são obrigatórios." });
    }

    const dataHoje = new Date().toISOString().split("T")[0];
    const dataFinal = data_presenca ?? dataHoje;

    const hoje = new Date();
    const dataAlvo = new Date(dataFinal);

    // Impede confirmação futura
    if (dataAlvo > hoje) {
      return res.status(400).json({ erro: 'Não é possível registrar presenças para datas futuras.' });
    }

    // Limita confirmação para até 15 dias atrás
    const diffDias = Math.floor((hoje - dataAlvo) / (1000 * 60 * 60 * 24));
    if (diffDias > 15) {
      return res.status(400).json({ erro: 'Presenças só podem ser confirmadas até 15 dias após a data do evento.' });
    }

    // Busca evento_id da turma
    const evento = await db.query('SELECT evento_id FROM turmas WHERE id = $1', [turma_id]);
    if (evento.rowCount === 0) {
      return res.status(404).json({ erro: 'Turma não encontrada.' });
    }
    const evento_id = evento.rows[0].evento_id;

    // Verifica se já existe presença para essa data
    const registro = await db.query(
      `SELECT id FROM presencas WHERE turma_id = $1 AND usuario_id = $2 AND data_presenca = $3`,
      [turma_id, usuario_id, dataFinal]
    );

    if (registro.rows.length > 0) {
      await db.query(
        `UPDATE presencas SET presente = true WHERE id = $1`,
        [registro.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO presencas (turma_id, usuario_id, evento_id, data_presenca, presente)
         VALUES ($1, $2, $3, $4, true)`,
        [turma_id, usuario_id, evento_id, dataFinal]
      );
    }

    return res.status(200).json({ mensagem: "Presença confirmada com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao confirmar presença:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

// GET /api/relatorio-presencas/turma/:turma_id
async function presencasDetalhadasPorTurma(req, res) {
  const { turma_id } = req.params;

  try {
    // 🔍 Busca a data de início e fim da turma
    const turmaRes = await db.query(`
      SELECT data_inicio, data_fim FROM turmas WHERE id = $1
    `, [turma_id]);

    if (turmaRes.rowCount === 0) {
      return res.status(404).json({ erro: "Turma não encontrada." });
    }

    const { data_inicio, data_fim } = turmaRes.rows[0];

    // 🔁 Gera todas as datas entre início e fim
    const datasTurma = [];
    let atual = new Date(data_inicio);
    const fim = new Date(data_fim);

    while (atual <= fim) {
      datasTurma.push(atual.toISOString().split("T")[0]);
      atual.setDate(atual.getDate() + 1);
    }

    // 👥 Busca todos os inscritos da turma
    const inscritosRes = await db.query(`
      SELECT u.id AS usuario_id, u.nome, u.cpf, u.email
      FROM usuarios u
      JOIN inscricoes i ON i.usuario_id = u.id
      WHERE i.turma_id = $1
    `, [turma_id]);

    const inscritos = inscritosRes.rows;

    // 🗓️ Busca todas as presenças registradas dessa turma
    const presencasRes = await db.query(`
      SELECT usuario_id, data_presenca, presente
      FROM presencas
      WHERE turma_id = $1
    `, [turma_id]);

    const presencas = presencasRes.rows;

    // 🧠 Monta a resposta detalhada
    const resultado = inscritos.map(inscrito => {
      const presencasUsuario = datasTurma.map(data => {
        const registro = presencas.find(
          p =>
            String(p.usuario_id) === String(inscrito.usuario_id) &&
            p.data_presenca.toISOString().split("T")[0] === data
        );

        return {
          data,
          presente: registro ? registro.presente : false,
        };
      });

      return {
        usuario_id: inscrito.usuario_id,
        nome: inscrito.nome,
        cpf: inscrito.cpf,
        email: inscrito.email,
        presencas: presencasUsuario,
      };
    });

    return res.json(resultado);
  } catch (err) {
    console.error("❌ Erro ao listar presenças detalhadas:", err);
    return res.status(500).json({ erro: "Erro interno do servidor." });
  }
}

 module.exports = {
  registrarPresenca,
  confirmarPresencaViaQR,
  registrarManual,
  validarPresenca,
  confirmarHojeManual,
  listaPresencasTurma,
  presencasDetalhadasPorTurma,
  exportarPresencasPDF,
  confirmarPresencaSimples,
};