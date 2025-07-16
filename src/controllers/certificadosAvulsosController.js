const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

function formatarIdentificador(valor) {
  if (/^\d{11}$/.test(valor)) {
    // CPF: 11 dígitos
    return `CPF: ${valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  }

  if (/^\d{5}\d$/.test(valor)) {
    // Registro funcional: 6 dígitos
    const digito = valor.slice(-1);
    const corpo = valor.slice(0, -1).padStart(5, '0');
    const registroFormatado = corpo.replace(/(\d{2})(\d{3})/, "$1.$2") + '-' + digito;
    return `Registro: ${registroFormatado}`;
  }

  return "Identificador inválido";
}

// Função para retornar data formatada por extenso
function dataHoje() {
  const hoje = new Date();
  const meses = [
    'janeiro','fevereiro','março','abril','maio','junho',
    'julho','agosto','setembro','outubro','novembro','dezembro'
  ];
  return `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

async function criarCertificadoAvulso(req, res) {
  const { nome, cpf, email, curso, carga_horaria, data_inicio, data_fim } = req.body;
  const dataFinalValida = data_fim && data_fim.trim() !== '' ? data_fim : null;

  try {
    const resultado = await db.query(
      `INSERT INTO certificados_avulsos (nome, cpf, email, curso, carga_horaria, data_inicio, data_fim)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nome, cpf, email, curso, carga_horaria, data_inicio, dataFinalValida]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao criar certificado avulso." });
  }
}

async function gerarPdfCertificado(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    const certificado = rows[0];

    // Garante que a pasta temp existe
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const caminho = path.join(tempDir, `certificado_${id}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
    const stream = fs.createWriteStream(caminho);

    stream.on("error", (error) => {
      console.error("Erro ao escrever arquivo PDF:", error);
      return res.status(500).json({ erro: "Erro ao gerar PDF." });
    });

    doc.pipe(stream);

    // Registro seguro das fontes, verifica se os arquivos existem
    const fontsDir = path.join(__dirname, '..', '..', 'fonts');
    const fontes = {
      'AlegreyaSans-Bold': path.join(fontsDir, 'AlegreyaSans-Bold.ttf'),
      'AlegreyaSans-Regular': path.join(fontsDir, 'AlegreyaSans-Regular.ttf'),
      'BreeSerif': path.join(fontsDir, 'BreeSerif-Regular.ttf'),
      'AlexBrush': path.join(fontsDir, 'AlexBrush-Regular.ttf')
    };
    for (const [nome, caminhoFonte] of Object.entries(fontes)) {
      if (fs.existsSync(caminhoFonte)) {
        doc.registerFont(nome, caminhoFonte);
      } else {
        console.warn(`Fonte não encontrada: ${caminhoFonte}, não será registrada.`);
      }
    }

    // Imagem de fundo (caminho correto para a pasta certificados na raiz)
    const fundo = path.join(__dirname, '..', '..', 'certificados', 'fundo_certificado.png');
    if (fs.existsSync(fundo)) {
      doc.image(fundo, 0, 0, { width: 842, height: 595 }); // A4 landscape em pts é 842x595
    } else {
      console.log("Arquivo de fundo não encontrado:", fundo);
    }

    // Corpo do certificado
    doc.moveDown(10);
    doc.fillColor('#000')
      .font('AlegreyaSans-Regular')
      .fontSize(16)
      .text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center', lineGap: 6 });

    doc.moveDown(1.5);

    doc.font('AlexBrush')
      .fontSize(48)
      .fillColor('#000')
      .text(certificado.nome, { align: 'center' });

    doc.font('BreeSerif')
      .fontSize(18)
      .text(formatarIdentificador(certificado.cpf), { align: 'center' });

    doc.moveDown(0.5);

    doc.font('AlegreyaSans-Regular')
      .fontSize(16)
      .text(`Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas.`, {
        align: 'center', indent: 30, height: 100, width: 740
      });

    const formatarData = (data) => {
      return new Date(data).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric"
      });
    };
    
    let periodoCurso = "";
    if (certificado.data_inicio && certificado.data_fim && certificado.data_inicio !== certificado.data_fim) {
      periodoCurso = `Realizado no período de ${formatarData(certificado.data_inicio)} a ${formatarData(certificado.data_fim)}.`;
    } else if (certificado.data_inicio) {
      periodoCurso = `Realizado em ${formatarData(certificado.data_inicio)}.`;
    }
    
    doc.font('AlegreyaSans-Regular')
      .fontSize(16)
      .text(periodoCurso, { align: 'center' });
    
    doc.moveDown(2);
    doc.text(`Santos, ${dataHoje()}.`, { align: 'right', width: 700 });
    

    doc.end();

    stream.on("finish", () => {
      res.download(caminho, `certificado_${id}.pdf`, () => {
        fs.unlinkSync(caminho);
      });
    });

  } catch (erro) {
    console.error("Erro no gerarPdfCertificado:", erro);
    res.status(500).json({ erro: "Erro ao gerar PDF." });
  }
}

async function listarCertificadosAvulsos(req, res) {
  try {
    const { rows } = await db.query("SELECT * FROM certificados_avulsos ORDER BY id DESC");
    res.json(rows);
  } catch (erro) {
    res.status(500).json({ erro: "Erro ao listar certificados avulsos." });
  }
}

async function enviarPorEmail(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await db.query("SELECT * FROM certificados_avulsos WHERE id = $1", [id]);
    if (rows.length === 0) return res.status(404).json({ erro: "Certificado não encontrado." });

    const certificado = rows[0];

    // Garantir que a pasta temp existe
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const caminho = path.join(tempDir, `certificado_${id}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margin: 50, layout: 'landscape' });
    const stream = fs.createWriteStream(caminho);

    stream.on("error", (error) => {
      console.error("Erro ao escrever arquivo PDF:", error);
      return res.status(500).json({ erro: "Erro ao gerar PDF." });
    });

    doc.pipe(stream);

    // Registro seguro das fontes
    const fontsDir = path.join(__dirname, '..', '..', 'fonts');
    const fontes = {
      'AlegreyaSans-Bold': path.join(fontsDir, 'AlegreyaSans-Bold.ttf'),
      'AlegreyaSans-Regular': path.join(fontsDir, 'AlegreyaSans-Regular.ttf'),
      'BreeSerif': path.join(fontsDir, 'BreeSerif-Regular.ttf'),
      'AlexBrush': path.join(fontsDir, 'AlexBrush-Regular.ttf')
    };
    for (const [nome, caminhoFonte] of Object.entries(fontes)) {
      if (fs.existsSync(caminhoFonte)) {
        doc.registerFont(nome, caminhoFonte);
      } else {
        console.warn(`Fonte não encontrada: ${caminhoFonte}, não será registrada.`);
      }
    }

    // Imagem de fundo
    const fundo = path.join(__dirname, '..', '..', 'certificados', 'fundo_certificado.png');
    if (fs.existsSync(fundo)) {
      doc.image(fundo, 0, 0, { width: 842, height: 595 });
    } else {
      console.log("Arquivo de fundo não encontrado:", fundo);
    }

    // Corpo do certificado
    doc.moveDown(10);
    doc.fillColor('#000')
      .font('AlegreyaSans-Regular')
      .fontSize(16)
      .text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center', lineGap: 6 });

    doc.moveDown(1.5);

    doc.font('AlexBrush')
      .fontSize(48)
      .fillColor('#000')
      .text(certificado.nome, { align: 'center' });

    doc.font('BreeSerif')
      .fontSize(18)
      .text(formatarIdentificador(certificado.cpf), { align: 'center' });

    doc.moveDown(0.5);

    doc.font('AlegreyaSans-Regular')
      .fontSize(16)
      .text(`Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas.`, {
        align: 'center', indent: 30, height: 100, width: 740
      });

    const formatarData = (data) => {
      return new Date(data).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric"
      });
    };
    
    let periodoCurso = "";
    if (certificado.data_inicio && certificado.data_fim && certificado.data_inicio !== certificado.data_fim) {
      periodoCurso = `Realizado no período de ${formatarData(certificado.data_inicio)} a ${formatarData(certificado.data_fim)}.`;
    } else if (certificado.data_inicio) {
      periodoCurso = `Realizado em ${formatarData(certificado.data_inicio)}.`;
    }
    
    doc.font('AlegreyaSans-Regular')
      .fontSize(16)
      .text(periodoCurso, { align: 'center' });
    
    doc.moveDown(2);
    doc.text(`Santos, ${dataHoje()}.`, { align: 'right', width: 700 });
    

    doc.end(); // FINALIZA a geração do PDF e dispara o evento finish no stream

    stream.on("finish", async () => {
      try {
        // Configura transporte de envio
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_REMETENTE,
            pass: process.env.EMAIL_SENHA,
          },
        });

        // Envia o e-mail com o PDF anexado
        await transporter.sendMail({
          from: `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>`,
          to: certificado.email,
          subject: "Seu Certificado",
          text: "Segue em anexo o seu certificado.",
          attachments: [
            {
              filename: `certificado.pdf`,
              path: caminho,
            },
          ],
        });

        // Atualiza status no banco
        await db.query("UPDATE certificados_avulsos SET enviado = true WHERE id = $1", [id]);

        // Remove arquivo temporário
        fs.unlinkSync(caminho);

        // Responde sucesso
        res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
      } catch (erroEnvio) {
        console.error("Erro no envio do e-mail:", erroEnvio);
        res.status(500).json({ erro: "Erro ao enviar certificado." });
      }
    });

  } catch (erro) {
    console.error("Erro ao enviar certificado:", erro);
    res.status(500).json({ erro: "Erro ao enviar certificado." });
  }
}


module.exports = {
  criarCertificadoAvulso,
  listarCertificadosAvulsos,
  gerarPdfCertificado,
  enviarPorEmail,
};
