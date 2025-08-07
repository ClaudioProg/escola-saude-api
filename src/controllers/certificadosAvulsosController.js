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

  return "";
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
    const fundo = path.join(__dirname, '..', '..', 'certificados', 'fundo_certificado_instrutor.png');
    if (fs.existsSync(fundo)) {
      doc.image(fundo, 0, 0, { width: 842, height: 595 }); // A4 landscape em pts é 842x595
    } else {
      console.log("Arquivo de fundo não encontrado:", fundo);
    }

// 🏷️ Título principal
doc.fillColor('#0b3d2e') // verde lousa
   .font('BreeSerif')
   .fontSize(63)
   .text('CERTIFICADO', { align: 'center' });

// 🏛️ Cabeçalho institucional
doc.fillColor('black');
doc.font('AlegreyaSans-Bold').fontSize(20).text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center', lineGap: 4 });
doc.font('AlegreyaSans-Regular').fontSize(15).text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center' });

doc.moveDown(2.5);

// 👤 Nome do participante
const nomeFontName = 'AlexBrush';
const nomeMaxWidth = 680;
let nomeFontSize = 45;
doc.font(nomeFontName);
while (doc.widthOfString(certificado.nome, { font: nomeFontName, size: nomeFontSize }) > nomeMaxWidth && nomeFontSize > 20) {
  nomeFontSize -= 1;
}
doc.fontSize(nomeFontSize).text(certificado.nome, { align: 'center' });

// 📛 CPF abaixo do nome
doc.font('BreeSerif').fontSize(16).text(formatarIdentificador(certificado.cpf), 0, doc.y - 5, {
  align: 'center',
  width: doc.page.width
});

// ✍️ Texto principal
const formatarData = (data) => {
  return new Date(data).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
};
let periodoCurso = "";
if (certificado.data_inicio && certificado.data_fim && certificado.data_inicio !== certificado.data_fim) {
  periodoCurso = `realizado no período de ${formatarData(certificado.data_inicio)} a ${formatarData(certificado.data_fim)}.`;
} else if (certificado.data_inicio) {
  periodoCurso = `realizado em ${formatarData(certificado.data_inicio)}.`;
}
const textoCertificado = `Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas, ${periodoCurso}`;

doc.moveDown(1);
doc.font('AlegreyaSans-Regular').fontSize(15).text(textoCertificado, 70, doc.y, {
  align: 'justify',
  lineGap: 4,
  width: 680,
});

// 🗓️ Data
doc.moveDown(1);
doc.font('AlegreyaSans-Regular').fontSize(14).text(`Santos, ${dataHoje()}.`, 100, doc.y + 10, {
  align: 'right',
  width: 680,
});

// ✍️ Assinatura Rafaella (centralizado)
const baseY = 470;
doc.font('AlegreyaSans-Bold').fontSize(20).text("Rafaella Pitol Corrêa", 270, baseY, {
  align: 'center',
  width: 300,
});
doc.font('AlegreyaSans-Regular').fontSize(14).text("Chefe da Escola da Saúde", 270, baseY + 25, {
  align: 'center',
  width: 300,
});

// Finaliza o PDF
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
    const fundo = path.join(__dirname, '..', '..', 'certificados', 'fundo_certificado_instrutor.png');
    if (fs.existsSync(fundo)) {
      doc.image(fundo, 0, 0, { width: 842, height: 595 });
    } else {
      console.log("Arquivo de fundo não encontrado:", fundo);
    }

   // 🏷️ Título principal
doc.fillColor('#0b3d2e') // verde lousa
.font('BreeSerif')
.fontSize(63)
.text('CERTIFICADO', { align: 'center' });

// 🏛️ Cabeçalho institucional
doc.fillColor('black');
doc.font('AlegreyaSans-Bold').fontSize(20).text('SECRETARIA MUNICIPAL DE SAÚDE', { align: 'center', lineGap: 4 });
doc.font('AlegreyaSans-Regular').fontSize(15).text('A Escola Municipal de Saúde Pública certifica que:', { align: 'center' });

doc.moveDown(2.5);

// 👤 Nome do participante
const nomeFontName = 'AlexBrush';
const nomeMaxWidth = 680;
let nomeFontSize = 45;
doc.font(nomeFontName);
while (doc.widthOfString(certificado.nome, { font: nomeFontName, size: nomeFontSize }) > nomeMaxWidth && nomeFontSize > 20) {
nomeFontSize -= 1;
}
doc.fontSize(nomeFontSize).text(certificado.nome, { align: 'center' });

// 📛 CPF abaixo do nome
doc.font('BreeSerif').fontSize(16).text(formatarIdentificador(certificado.cpf), 0, doc.y - 5, {
align: 'center',
width: doc.page.width
});

// ✍️ Texto principal
const formatarData = (data) => {
return new Date(data).toLocaleDateString("pt-BR", {
 day: "2-digit", month: "2-digit", year: "numeric"
});
};
let periodoCurso = "";
if (certificado.data_inicio && certificado.data_fim && certificado.data_inicio !== certificado.data_fim) {
periodoCurso = `realizado no período de ${formatarData(certificado.data_inicio)} a ${formatarData(certificado.data_fim)}.`;
} else if (certificado.data_inicio) {
periodoCurso = `realizado em ${formatarData(certificado.data_inicio)}.`;
}
const textoCertificado = `Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas, ${periodoCurso}`;

doc.moveDown(1);
doc.font('AlegreyaSans-Regular').fontSize(15).text(textoCertificado, 70, doc.y, {
align: 'justify',
lineGap: 4,
width: 680,
});

// 🗓️ Data
doc.moveDown(1);
doc.font('AlegreyaSans-Regular').fontSize(14).text(`Santos, ${dataHoje()}.`, 100, doc.y + 10, {
align: 'right',
width: 680,
});

// ✍️ Assinatura Rafaella (centralizado)
const baseY = 470;
doc.font('AlegreyaSans-Bold').fontSize(20).text("Rafaella Pitol Corrêa", 270, baseY, {
align: 'center',
width: 300,
});
doc.font('AlegreyaSans-Regular').fontSize(14).text("Chefe da Escola da Saúde", 270, baseY + 25, {
align: 'center',
width: 300,
});

// Finaliza o PDF
doc.end();

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
          text: `
Prezado(a) ${certificado.nome},

Seu certificado foi gerado com sucesso referente ao curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas.

Caso tenha dúvidas ou precise de suporte, entre em contato com a equipe da Escola da Saúde.

Atenciosamente,
Equipe da Escola da Saúde
`,
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
