// src/controllers/certificadosController.js
const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

/**
 * 🔢 Formata CPF para padrão xxx.xxx.xxx-xx
 */
function formatarCPF(cpf) {
  if (!cpf) return '';
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * 📄 Gera certificado em PDF para usuario ou instrutor
 */
async function gerarCertificado(req, res) {
  const { usuario_id, evento_id, turma_id, tipo } = req.body;

  try {
    // 🔎 Valida evento
    const eventoResult = await db.query(
      'SELECT titulo, carga_horaria FROM eventos WHERE id = $1',
      [evento_id]
    );
    if (eventoResult.rowCount === 0) {
      return res.status(404).json({ erro: 'Evento não encontrado' });
    }
    const { titulo, carga_horaria } = eventoResult.rows[0];

    // 🔎 Busca usuário (usuario ou instrutor)
    let nomeUsuario = '', cpfUsuario = '', assinaturaBase64 = null;

    if (tipo === 'instrutor') {
      const instrutor = await db.query(
        `SELECT nome, cpf, assinatura_base64 FROM usuarios 
         WHERE id = $1 AND id IN (
           SELECT instrutor_id FROM turmas WHERE id = $2
         )`,
        [usuario_id, turma_id]
      );
      if (instrutor.rowCount === 0) {
        return res.status(404).json({ erro: 'instrutor não encontrado para esta turma' });
      }
      const u = instrutor.rows[0];
      nomeUsuario = u.nome;
      cpfUsuario = formatarCPF(u.cpf);
      assinaturaBase64 = u.assinatura_base64;
    } else {
      const usuario = await db.query('SELECT nome, cpf FROM usuarios WHERE id = $1', [usuario_id]);
      if (usuario.rowCount === 0) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
      }
      const u = usuario.rows[0];
      nomeUsuario = u.nome;
      cpfUsuario = formatarCPF(u.cpf);
    }

    // 🗓️ Datas do evento
    const datas = await db.query(
      'SELECT MIN(data) AS data_inicio, MAX(data) AS data_fim FROM datas_evento WHERE evento_id = $1',
      [evento_id]
    );
    const dataInicio = datas.rows[0].data_inicio
      ? new Date(datas.rows[0].data_inicio).toLocaleDateString('pt-BR')
      : '';
    const dataFim = datas.rows[0].data_fim
      ? new Date(datas.rows[0].data_fim).toLocaleDateString('pt-BR')
      : '';

    // 📅 Data de hoje
    const hoje = new Date();
    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dataHoje = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    // 📁 Preparação de arquivo
    const nomeArquivo = tipo === 'instrutor'
      ? `certificado_instrutor_usuario${usuario_id}_evento${evento_id}_turma${turma_id}.pdf`
      : `certificado_usuario${usuario_id}_evento${evento_id}.pdf`;
    const pasta = path.join(__dirname, '..', 'certificados');
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta);
    const caminho = path.join(pasta, nomeArquivo);

    // 🖨️ Geração do PDF
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    doc.pipe(fs.createWriteStream(caminho));

    // 🖋️ Fontes e imagem de fundo
    doc.registerFont('AlegreyaSans-Regular', path.join(__dirname, '..', 'fonts', 'AlegreyaSans-Regular.ttf'));
    doc.registerFont('AlegreyaSans-Bold', path.join(__dirname, '..', 'fonts', 'AlegreyaSans-Bold.ttf'));
    doc.registerFont('BreeSerif', path.join(__dirname, '..', 'fonts', 'BreeSerif-Regular.ttf'));
    doc.registerFont('AlexBrush', path.join(__dirname, '..', 'fonts', 'AlexBrush-Regular.ttf'));

    const fundo = path.join(pasta, 'fundo_certificado.png');
    if (fs.existsSync(fundo)) {
      doc.image(fundo, 0, 0, { width: 842, height: 595 });
    }

    // 📝 Texto principal
    doc.font('AlegreyaSans-Bold').fontSize(20).text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center', lineGap: 4 });
    doc.font('AlegreyaSans-Regular').fontSize(15).text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center' });
    doc.moveDown(1);
    doc.font('AlexBrush').fontSize(45).text(nomeUsuario, { align: 'center' });
    doc.font('BreeSerif').fontSize(16).text(`CPF: ${cpfUsuario}`, { align: 'center' });
    doc.moveDown(1);

    const corpoTexto = tipo === 'instrutor'
      ? `Participou como instrutor do evento "${titulo}", realizado de ${dataInicio} a ${dataFim}, com carga horária total de ${carga_horaria} horas.`
      : `Participou do evento "${titulo}", realizado de ${dataInicio} a ${dataFim}, com carga horária total de ${carga_horaria} horas.`;

    doc.font('AlegreyaSans-Regular').fontSize(15).text(corpoTexto, { align: 'justify', lineGap: 4 });
    doc.moveDown(2);
    doc.font('AlegreyaSans-Regular').fontSize(14).text(`Santos, ${dataHoje}.`, { align: 'right', width: 700 });

    // ✍️ Assinatura (instrutor)
    if (tipo === 'instrutor' && assinaturaBase64) {
      const imgBuffer = Buffer.from(assinaturaBase64.split(",")[1], 'base64');
      doc.image(imgBuffer, 330, 400, { width: 150 });
      doc.font('AlegreyaSans-Bold').fontSize(14).text(nomeUsuario, 330, 460, { align: 'center', width: 150 });
      doc.font('AlegreyaSans-Regular').fontSize(12).text("Instrutor", 330, 475, { align: 'center', width: 150 });
    }

    // 📱 QR Code de validação
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const linkValidacao = `${baseUrl}/validar-certificado.html?usuario_id=${usuario_id}&evento_id=${evento_id}`;
    const qrImage = await QRCode.toDataURL(linkValidacao);
    doc.image(qrImage, 740, 420, { width: 80 });
    doc.fontSize(7).text('Escaneie este QR Code', 740, 505);
    doc.text('para validar o certificado.', 740, 515);

    doc.end();

    // 💾 Grava registro no banco
    await db.query(
      `INSERT INTO certificados (usuario_id, evento_id, arquivo_pdf)
       VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, evento_id) DO UPDATE
       SET arquivo_pdf = EXCLUDED.arquivo_pdf, gerado_em = NOW()`,
      [usuario_id, evento_id, nomeArquivo]
    );

    res.status(201).json({ mensagem: 'Certificado gerado com sucesso', arquivo: nomeArquivo });

  } catch (err) {
    console.error('❌ Erro ao gerar certificado:', err);
    res.status(500).json({ erro: 'Erro ao gerar certificado' });
  }
}

/**
 * 📋 Lista os certificados do usuário autenticado
 */
async function listarCertificadosDoUsuario(req, res) {
  try {
    const usuario_id = req.usuario.id;

    const result = await db.query(
      `SELECT c.id, c.evento_id, c.arquivo_pdf, e.titulo AS evento
 FROM certificados c
 JOIN eventos e ON e.id = c.evento_id
 WHERE c.usuario_id = $1
 ORDER BY c.id DESC`,
      [usuario_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao listar certificados:', err);
    res.status(500).json({ erro: 'Erro ao listar certificados do usuário.' });
  }
}

/**
 * ⬇️ Faz download do certificado em PDF
 */
async function baixarCertificado(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT arquivo_pdf FROM certificados WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Certificado não encontrado.' });
    }

    const nomeArquivo = result.rows[0].arquivo_pdf;
    const caminhoArquivo = path.join(__dirname, '..', 'certificados', nomeArquivo);

    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).json({ erro: 'Arquivo do certificado não encontrado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    fs.createReadStream(caminhoArquivo).pipe(res);

  } catch (err) {
    console.error('❌ Erro ao baixar certificado:', err);
    res.status(500).json({ erro: 'Erro ao baixar certificado.' });
  }
}

async function revalidarCertificado(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE certificados
       SET revalidado_em = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    res.json({ mensagem: "✅ Certificado revalidado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao revalidar certificado:", error.message);
    res.status(500).json({ erro: "Erro ao revalidar certificado." });
  }
}

module.exports = {
  gerarCertificado,
  listarCertificadosDoUsuario,
  baixarCertificado,
  revalidarCertificado,
};
