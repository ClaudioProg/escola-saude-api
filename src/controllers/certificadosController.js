// ✅ src/controllers/certificadosController.js
const db = require('../db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const QRCode = require('qrcode');
const { gerarNotificacoesDeCertificado } = require('./notificacoesController');

const IS_DEV = process.env.NODE_ENV !== 'production';

/** 🔢 Formata CPF */
function formatarCPF(cpf) {
  if (!cpf) return '';
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

async function gerarCertificado(req, res) {
  const { usuario_id, evento_id, turma_id, tipo, assinaturaBase64 } = req.body;

  if (!tipo || (tipo !== 'usuario' && tipo !== 'instrutor')) {
    return res.status(400).json({ erro: "Parâmetro 'tipo' inválido ou ausente." });
  }

  let nomeInstrutor = "Instrutor(a)";

  try {
    if (IS_DEV) console.log("🔍 Tipo recebido no gerarCertificado:", tipo);

    // 🔎 Evento + Turma
    const eventoResult = await db.query(
      `
      SELECT 
        e.titulo, 
        t.horario_inicio,
        t.horario_fim,
        t.data_inicio,
        t.data_fim,
        t.carga_horaria
      FROM eventos e
      JOIN turmas t ON t.evento_id = e.id
      WHERE e.id = $1 AND t.id = $2
      `,
      [evento_id, turma_id]
    );
    if (eventoResult.rowCount === 0) {
      return res.status(404).json({ erro: "Evento ou turma não encontrados." });
    }

    const { titulo, horario_inicio, horario_fim, data_inicio, data_fim, carga_horaria } = eventoResult.rows[0];
    if (IS_DEV) console.log(`⏱️ Carga horária obtida da turma: ${carga_horaria}h`);

    // 🔎 Usuário/Instrutor
    let nomeUsuario = '', cpfUsuario = '';
    if (tipo === 'instrutor') {
      const instrutor = await db.query(
        `SELECT nome, cpf FROM usuarios WHERE id = $1`,
        [usuario_id]
      );
      if (instrutor.rowCount === 0) {
        return res.status(404).json({ erro: 'Instrutor não encontrado' });
      }
      const u = instrutor.rows[0];
      nomeUsuario = u.nome;
      cpfUsuario = formatarCPF(u.cpf);
    } else {
      const usuario = await db.query(
        'SELECT nome, cpf FROM usuarios WHERE id = $1',
        [usuario_id]
      );
      if (usuario.rowCount === 0) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
      }
      const u = usuario.rows[0];
      nomeUsuario = u.nome;
      cpfUsuario = formatarCPF(u.cpf);
    }

    // 🗓️ Datas
    const fmt = (d) =>
      d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
    const dataInicioBR = fmt(data_inicio);
    const dataFimBR = fmt(data_fim);

    const hoje = new Date();
    const dataHoje = hoje.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // 📁 Arquivo
    const nomeArquivo = `certificado_${tipo}_usuario${usuario_id}_evento${evento_id}_turma${turma_id}.pdf`;
    const pasta = path.join(__dirname, '..', 'certificados');
    await fsp.mkdir(pasta, { recursive: true });
    const caminho = path.join(pasta, nomeArquivo);

    // 🖨️ PDF
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const writeStream = fs.createWriteStream(caminho);
    doc.pipe(writeStream);

    // 🖋️ Fontes
    try {
      doc.registerFont('AlegreyaSans-Regular', path.resolve(__dirname, '../../fonts/AlegreyaSans-Regular.ttf'));
      doc.registerFont('AlegreyaSans-Bold', path.resolve(__dirname, '../../fonts/AlegreyaSans-Bold.ttf'));
      doc.registerFont('BreeSerif', path.resolve(__dirname, '../../fonts/BreeSerif-Regular.ttf'));
      doc.registerFont('AlexBrush', path.resolve(__dirname, '../../fonts/AlexBrush-Regular.ttf'));
    } catch (erroFontes) {
      console.error("❌ Erro ao registrar fontes:", erroFontes.message);
    }

    // 🖼️ Fundo
    const nomeFundo = tipo === 'instrutor' ? 'fundo_certificado_instrutor.png' : 'fundo_certificado.png';
    const fundo = path.resolve(__dirname, '../../certificados', nomeFundo);
    if (fs.existsSync(fundo)) {
      try { doc.image(fundo, 0, 0, { width: 842, height: 595 }); }
      catch (erroFundo) { console.error(`❌ Erro ao carregar fundo (${nomeFundo}):`, erroFundo.message); }
    } else if (IS_DEV) {
      console.warn(`⚠️ Imagem de fundo não encontrada: ${nomeFundo}`);
    }

    // 🏷️ Título
    doc.fillColor('#0b3d2e').font('BreeSerif').fontSize(63).text('CERTIFICADO', { align: 'center' });
    doc.y += 20;

    // 🏛️ Cabeçalho
    doc.fillColor('black');
    doc.font('AlegreyaSans-Bold').fontSize(20).text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center', lineGap: 4 });
    doc.font('AlegreyaSans-Regular').fontSize(15).text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center' });
    doc.moveDown(1); doc.y += 20;

    // 👤 Nome
    const nomeFontName = 'AlexBrush';
    const maxNomeWidth = 680;
    let nomeFontSize = 45;
    doc.font(nomeFontName);
    while (doc.widthOfString(nomeUsuario, { font: nomeFontName, size: nomeFontSize }) > maxNomeWidth && nomeFontSize > 20) {
      nomeFontSize -= 1;
    }
    doc.fontSize(nomeFontSize).text(nomeUsuario, { align: 'center' });

    // CPF
    doc.font('BreeSerif').fontSize(16).text(`CPF: ${cpfUsuario}`, 0, doc.y - 5, {
      align: 'center',
      width: doc.page.width
    });

    // 📝 Corpo
    const corpoTexto =
      tipo === 'instrutor'
        ? `Participou como instrutor do evento "${titulo}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${carga_horaria} horas.`
        : `Participou do evento "${titulo}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${carga_horaria} horas.`;

    doc.moveDown(1);
    doc.font('AlegreyaSans-Regular').fontSize(15).text(corpoTexto, 70, doc.y, {
      align: 'justify',
      lineGap: 4,
      width: 680,
    });

    // Data
    doc.moveDown(1);
    doc.font('AlegreyaSans-Regular').fontSize(14).text(`Santos, ${dataHoje}.`, 100, doc.y + 10, {
      align: 'right',
      width: 680,
    });

    // ✍️ Assinaturas
    const baseY = 470;

    if (tipo === 'instrutor') {
      doc.font('AlegreyaSans-Bold').fontSize(20).text("Rafaella Pitol Corrêa", 270, baseY, { align: 'center', width: 300 });
      doc.font('AlegreyaSans-Regular').fontSize(14).text("Chefe da Escola da Saúde", 270, baseY + 25, { align: 'center', width: 300 });
    } else {
      doc.font('AlegreyaSans-Bold').fontSize(20).text("Rafaella Pitol Corrêa", 100, baseY, { align: 'center', width: 300 });
      doc.font('AlegreyaSans-Regular').fontSize(14).text("Chefe da Escola da Saúde", 100, baseY + 25, { align: 'center', width: 300 });
    }

    // Assinatura recebida (participante)
    if (tipo === 'usuario') {
      if (assinaturaBase64 && assinaturaBase64.startsWith("data:image")) {
        try {
          const base64Data = assinaturaBase64.split(',')[1];
          const imgBuffer = Buffer.from(base64Data, 'base64');
          const assinaturaWidth = 150;
          const assinaturaX = 440 + (300 - assinaturaWidth) / 2;
          const assinaturaBaseY = baseY - 25;
          doc.image(imgBuffer, assinaturaX, assinaturaBaseY, { width: assinaturaWidth });
        } catch (e) {
          console.error("❌ Erro ao processar assinatura enviada:", e.message);
        }
      } else if (IS_DEV) {
        console.warn("⚠️ Assinatura ausente ou inválida (tipo 'usuario').");
      }
    }

    // Assinatura do instrutor (se houver) para participante
    if (tipo !== 'instrutor') {
      try {
        const assinaturaInstrutor = await db.query(`
          SELECT a.imagem_base64, u.nome AS nome_instrutor
          FROM evento_instrutor ei
          JOIN usuarios u ON u.id = ei.instrutor_id
          JOIN assinaturas a ON a.usuario_id = ei.instrutor_id
          WHERE ei.evento_id = $1
          ORDER BY ei.instrutor_id ASC
          LIMIT 1
        `, [evento_id]);

        const base64Ass = assinaturaInstrutor.rows[0]?.imagem_base64;
        nomeInstrutor = assinaturaInstrutor.rows[0]?.nome_instrutor || "Instrutor(a)";

        if (base64Ass?.startsWith("data:image")) {
          const imgBuffer = Buffer.from(base64Ass.split(",")[1], 'base64');
          const assinaturaWidth = 150;
          const assinaturaX = 440 + (300 - assinaturaWidth) / 2;
          const assinaturaY = baseY - 50;
          doc.image(imgBuffer, assinaturaX, assinaturaY, { width: assinaturaWidth });
        } else if (IS_DEV) {
          console.warn("⚠️ Assinatura base64 do instrutor não encontrada/ inválida.");
        }
      } catch (e) {
        console.error("❌ Erro ao buscar assinatura do instrutor:", e.message);
      }
    }

    if (tipo === 'usuario') {
      doc.font('AlegreyaSans-Bold').fontSize(20).text(nomeInstrutor, 440, baseY, { align: 'center', width: 300 });
      doc.font('AlegreyaSans-Regular').fontSize(14).text("Instrutor(a)", 440, baseY + 25, { align: 'center', width: 300 });
    }

    // 📱 QR de validação → FRONTEND!
    const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'https://escoladasaude.vercel.app';
    const linkValidacao = `${FRONTEND_BASE_URL}/validar-certificado.html?usuario_id=${usuario_id}&evento_id=${evento_id}`;
    const qrImage = await QRCode.toDataURL(linkValidacao);
    doc.image(qrImage, 40, 420, { width: 80 });
    doc.fillColor("white").fontSize(7).text('Escaneie este QR Code', 40, 510);
    doc.text('para validar o certificado.', 40, 520);

    doc.end();
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // ✅ DB: INSERT/UPSERT
    const turmaFinal = turma_id ?? null;
    const insertResult = await db.query(
      `INSERT INTO certificados (usuario_id, evento_id, turma_id, tipo, arquivo_pdf)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT certificados_usuario_evento_tipo_unico DO UPDATE
         SET arquivo_pdf = EXCLUDED.arquivo_pdf, gerado_em = NOW()
       RETURNING id`,
      [usuario_id, evento_id, turmaFinal, tipo, nomeArquivo]
    );

    // 🔔 Notificação + e-mail (somente participante)
    await gerarNotificacoesDeCertificado(usuario_id);

    if (tipo !== 'instrutor') {
      const userRes = await db.query('SELECT email, nome FROM usuarios WHERE id = $1', [usuario_id]);
      const emailUsuario = userRes.rows[0]?.email;
      const nomeUsuarioEmail = userRes.rows[0]?.nome;
      if (emailUsuario) {
        const { send } = require('../utils/email');
        const link = `${FRONTEND_BASE_URL}/meus-certificados`;
        await send({
          to: emailUsuario,
          subject: `🎓 Certificado disponível do evento "${titulo}"`,
          text: `Olá, ${nomeUsuarioEmail}!\n\nSeu certificado do evento "${titulo}" já está disponível para download.\n\nAcesse: ${link}\n\nAtenciosamente,\nEquipe da Escola Municipal de Saúde`,
        });
      }
    }

    return res.status(201).json({
      mensagem: 'Certificado gerado com sucesso',
      arquivo: nomeArquivo,
      certificado_id: insertResult.rows[0].id,
    });

  } catch (error) {
    console.error("❌ Erro ao gerar certificado:", error);
    if (!res.headersSent) {
      return res.status(500).json({ erro: "Erro ao gerar certificado" });
    }
  }
}

/** 📋 Lista os certificados do usuário autenticado */
async function listarCertificadosDoUsuario(req, res) {
  try {
    const usuario_id = req.usuario.id;
    const result = await db.query(
      `SELECT 
         c.id AS certificado_id,
         c.evento_id,
         c.arquivo_pdf,
         c.turma_id,
         e.titulo AS evento,
         t.data_inicio,
         t.data_fim
       FROM certificados c
       JOIN eventos e ON e.id = c.evento_id
       JOIN turmas t ON t.id = c.turma_id
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

/** ⬇️ Download do certificado */
async function baixarCertificado(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT usuario_id, arquivo_pdf FROM certificados WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Certificado não encontrado.' });
    }

    const { /* usuario_id, */ arquivo_pdf } = result.rows[0];
    const caminhoArquivo = path.join(__dirname, '..', 'certificados', arquivo_pdf);
    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).json({ erro: 'Arquivo do certificado não encontrado.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo_pdf}"`);
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

async function listarCertificadosElegiveis(req, res) {
  try {
    const usuario_id = req.usuario.id;
    const result = await db.query(`
      SELECT 
        t.id AS turma_id,
        e.id AS evento_id,
        e.titulo AS evento,
        t.nome AS nome_turma,
        t.data_inicio,
        t.data_fim,
        c.id AS certificado_id,
        c.arquivo_pdf,
        CASE WHEN c.arquivo_pdf IS NOT NULL THEN true ELSE false END AS ja_gerado
      FROM turmas t
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN certificados c 
        ON c.evento_id = e.id 
       AND c.turma_id = t.id
       AND c.usuario_id = $1
       AND c.tipo = 'usuario'
      WHERE t.id IN (
        SELECT turma_id FROM presencas
        WHERE usuario_id = $1
        GROUP BY turma_id
        HAVING COUNT(*) FILTER (WHERE presente) * 1.0 / COUNT(*) >= 0.75
      )
      AND t.data_fim <= CURRENT_DATE
      ORDER BY t.data_fim DESC
    `, [usuario_id]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificados elegíveis:", err);
    res.status(500).json({ erro: "Erro ao buscar certificados elegíveis." });
  }
}

async function listarCertificadosInstrutorElegiveis(req, res) {
  try {
    const instrutor_id = req.usuario.id;
    const result = await db.query(`
      SELECT 
        t.id AS turma_id,
        e.id AS evento_id,
        e.titulo AS evento,
        t.nome AS nome_turma,
        t.data_inicio,
        t.data_fim,
        t.horario_fim,
        c.id AS certificado_id,
        c.arquivo_pdf,
        CASE WHEN c.arquivo_pdf IS NOT NULL THEN true ELSE false END AS ja_gerado
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN certificados c 
        ON c.usuario_id = $1
       AND c.evento_id = e.id
       AND c.turma_id = t.id
       AND c.tipo = 'instrutor'
      WHERE ei.instrutor_id = $1
        AND to_timestamp(t.data_fim || ' ' || t.horario_fim, 'YYYY-MM-DD HH24:MI:SS') < NOW()
      ORDER BY t.data_fim DESC
    `, [instrutor_id]);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificados de instrutor elegíveis:", err);
    res.status(500).json({ erro: "Erro ao buscar certificados de instrutor elegíveis." });
  }
}

module.exports = {
  gerarCertificado,
  listarCertificadosDoUsuario,
  baixarCertificado,
  revalidarCertificado,
  listarCertificadosElegiveis,
  listarCertificadosInstrutorElegiveis,
};
