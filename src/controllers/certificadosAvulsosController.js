const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const nodemailer = require("nodemailer");

/* ========================= Utils ========================= */

function formatarIdentificador(valor) {
  if (!valor) return "";
  const onlyNum = String(valor).replace(/\D/g, "");

  // CPF: 11 dígitos
  if (/^\d{11}$/.test(onlyNum)) {
    return `CPF: ${onlyNum.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  }

  // Registro funcional (6 dígitos: 5 corpo + 1 dígito)
  if (/^\d{6}$/.test(onlyNum)) {
    const corpo = onlyNum.slice(0, 5);
    const digito = onlyNum.slice(5);
    const registroFormatado = corpo.replace(/(\d{2})(\d{3})/, "$1.$2") + "-" + digito;
    return `Registro: ${registroFormatado}`;
  }

  return "";
}

function dataHojePorExtenso() {
  const hoje = new Date();
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];
  return `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

function formatarDataCurtaBR(data) {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function validarEmail(email) {
  if (!email) return false;
  // Regex simples/aceitável para validação leve
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

// Garante diretório
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/* ========== Montagem de PDF (compartilhado) ========== */

function registerFonts(doc) {
  const fontsDir = path.join(__dirname, "..", "..", "fonts");
  const fontes = {
    "AlegreyaSans-Bold": path.join(fontsDir, "AlegreyaSans-Bold.ttf"),
    "AlegreyaSans-Regular": path.join(fontsDir, "AlegreyaSans-Regular.ttf"),
    "BreeSerif": path.join(fontsDir, "BreeSerif-Regular.ttf"),
    "AlexBrush": path.join(fontsDir, "AlexBrush-Regular.ttf"),
  };
  for (const [nome, caminhoFonte] of Object.entries(fontes)) {
    if (fs.existsSync(caminhoFonte)) {
      doc.registerFont(nome, caminhoFonte);
    } else {
      // Silencia em produção, mas loga em dev:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`(certificados) Fonte ausente: ${caminhoFonte}`);
      }
    }
  }
}

function desenharCertificado(doc, certificado) {
  // Fundo
  const fundo = path.join(__dirname, "..", "..", "certificados", "fundo_certificado_instrutor.png");
  if (fs.existsSync(fundo)) {
    // A4 landscape em pontos: 842 x 595
    doc.image(fundo, 0, 0, { width: 842, height: 595 });
  } else if (process.env.NODE_ENV !== "production") {
    console.warn("(certificados) Imagem de fundo não encontrada:", fundo);
  }

  // Título
  doc.fillColor("#0b3d2e") // verde lousa
    .font("BreeSerif")
    .fontSize(63)
    .text("CERTIFICADO", { align: "center" });

  // Cabeçalho institucional
  doc.fillColor("black");
  doc.font("AlegreyaSans-Bold").fontSize(20)
    .text("SECRETARIA MUNICIPAL DE SAÚDE", { align: "center", lineGap: 4 });
  doc.font("AlegreyaSans-Regular").fontSize(15)
    .text("A Escola Municipal de Saúde Pública certifica que:", { align: "center" });

  doc.moveDown(2.5);

  // Nome do participante (dinâmico)
  const nome = certificado.nome || "";
  const nomeFont = "AlexBrush";
  const nomeMaxWidth = 680;
  let nomeFontSize = 45;

  // Ajuste de tamanho: PDFKit mede pela font size corrente
  doc.font(nomeFont).fontSize(nomeFontSize);
  while (doc.widthOfString(nome) > nomeMaxWidth && nomeFontSize > 20) {
    nomeFontSize -= 1;
    doc.fontSize(nomeFontSize);
  }
  doc.text(nome, { align: "center" });

  // Identificador (CPF ou Registro) — centralizado
  const idFmt = formatarIdentificador(certificado.cpf || certificado.registro || "");
  if (idFmt) {
    doc.font("BreeSerif").fontSize(16)
      .text(idFmt, 0, doc.y - 5, { align: "center", width: doc.page.width });
  }

  // Texto principal
  const partesPeriodo = [];
  if (certificado.data_inicio && certificado.data_fim && certificado.data_inicio !== certificado.data_fim) {
    partesPeriodo.push(`no período de ${formatarDataCurtaBR(certificado.data_inicio)} a ${formatarDataCurtaBR(certificado.data_fim)}`);
  } else if (certificado.data_inicio) {
    partesPeriodo.push(`em ${formatarDataCurtaBR(certificado.data_inicio)}`);
  }
  const periodoCurso = partesPeriodo.length ? `, ${partesPeriodo.join(" ")}` : ".";

  const textoCertificado =
    `Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas${periodoCurso}`;

  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(15).text(textoCertificado, 70, doc.y, {
    align: "justify",
    lineGap: 4,
    width: 680,
  });

  // Data por extenso
  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular")
    .fontSize(14)
    .text(`Santos, ${dataHojePorExtenso()}.`, 100, doc.y + 10, {
      align: "right",
      width: 680,
    });

  // Assinatura
  const baseY = 470;
  doc.font("AlegreyaSans-Bold").fontSize(20)
    .text("Rafaella Pitol Corrêa", 270, baseY, { align: "center", width: 300 });
  doc.font("AlegreyaSans-Regular").fontSize(14)
    .text("Chefe da Escola da Saúde", 270, baseY + 25, { align: "center", width: 300 });
}

/**
 * Gera o PDF para um arquivo temporário e retorna o caminho.
 * Limpeza do arquivo é responsabilidade do chamador.
 */
async function gerarPdfTemporario(certificado, filenamePrefix = "certificado") {
  const tempDir = path.join(__dirname, "..", "..", "temp");
  await ensureDir(tempDir);

  const filename = `${filenamePrefix}_${certificado.id || Date.now()}.pdf`;
  const caminho = path.join(tempDir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, layout: "landscape" });
    const stream = fs.createWriteStream(caminho);

    // Tratamento de erros
    const onError = (err) => {
      try { stream.destroy(); } catch {}
      reject(err);
    };
    stream.on("error", onError);
    doc.on("error", onError);

    doc.pipe(stream);

    // Registra fontes (se existirem)
    registerFonts(doc);

    // Desenha conteúdo
    desenharCertificado(doc, certificado);

    doc.end();

    stream.on("finish", resolve);
  });

  return caminho;
}

/* ========================= Handlers ========================= */

/**
 * POST /api/certificados-avulsos
 */
async function criarCertificadoAvulso(req, res) {
  try {
    let { nome, cpf, email, curso, carga_horaria, data_inicio, data_fim } = req.body;

    // Normalizações/validações leves
    nome = (nome || "").trim();
    curso = (curso || "").trim();
    email = (email || "").trim();
    cpf = (cpf || "").trim();
    const carga = Number(carga_horaria);

    if (!nome || !curso || !email || !Number.isFinite(carga)) {
      return res.status(400).json({ erro: "Dados obrigatórios inválidos." });
    }
    if (!validarEmail(email)) {
      return res.status(400).json({ erro: "E-mail inválido." });
    }

    const dataFinalValida = data_fim && String(data_fim).trim() !== "" ? data_fim : null;

    const { rows } = await db.query(
      `INSERT INTO certificados_avulsos
       (nome, cpf, email, curso, carga_horaria, data_inicio, data_fim)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [nome, cpf, email, curso, carga, data_inicio || null, dataFinalValida]
    );

    return res.status(201).json(rows[0]);
  } catch (erro) {
    console.error("❌ Erro ao criar certificado avulso:", erro);
    return res.status(500).json({ erro: "Erro ao criar certificado avulso." });
  }
}

/**
 * GET /api/certificados-avulsos
 */
async function listarCertificadosAvulsos(req, res) {
  try {
    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos ORDER BY id DESC"
    );
    return res.json(rows);
  } catch (erro) {
    console.error("❌ Erro ao listar certificados avulsos:", erro);
    return res.status(500).json({ erro: "Erro ao listar certificados avulsos." });
  }
}

/**
 * GET /api/certificados-avulsos/:id/pdf
 */
async function gerarPdfCertificado(req, res) {
  const { id } = req.params;
  let caminhoTemp;

  try {
    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    const certificado = rows[0];
    caminhoTemp = await gerarPdfTemporario(certificado, "certificado");

    // Faz o download e, ao finalizar, remove o arquivo
    res.download(caminhoTemp, `certificado_${id}.pdf`, async (err) => {
      try {
        await fsp.unlink(caminhoTemp).catch(() => {});
      } catch {}
      if (err) {
        console.error("❌ Erro ao enviar PDF para download:", err);
      }
    });
  } catch (erro) {
    console.error("❌ Erro no gerarPdfCertificado:", erro);
    try {
      if (caminhoTemp) await fsp.unlink(caminhoTemp).catch(() => {});
    } catch {}
    return res.status(500).json({ erro: "Erro ao gerar PDF." });
  }
}

/**
 * POST /api/certificados-avulsos/:id/enviar
 */
async function enviarPorEmail(req, res) {
  const { id } = req.params;
  let caminhoTemp;

  try {
    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }
    const certificado = rows[0];

    // Gera o PDF temporário
    caminhoTemp = await gerarPdfTemporario(certificado, "certificado");

    // Configuração do transporte
    // Preferir SMTP genérico via env:
    // SMTP_HOST, SMTP_PORT, SMTP_SECURE (true/false), SMTP_USER, SMTP_PASS
    // Alternativa: service: "gmail" (requer App Password)
    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // fallback (ex.: Gmail)
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_REMETENTE,
          pass: process.env.EMAIL_SENHA, // App Password recomendado
        },
      });
    }

    const remetente =
      process.env.EMAIL_FROM ||
      (process.env.EMAIL_REMETENTE
        ? `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>`
        : "Escola da Saúde <no-reply@escolasaude.local>");

    await transporter.sendMail({
      from: remetente,
      to: certificado.email,
      subject: "Seu Certificado",
      text: `Prezado(a) ${certificado.nome},

Seu certificado foi gerado com sucesso referente ao curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas.

Caso tenha dúvidas ou precise de suporte, entre em contato com a equipe da Escola da Saúde.

Atenciosamente,
Equipe da Escola da Saúde
`,
      attachments: [
        {
          filename: `certificado.pdf`,
          path: caminhoTemp,
          contentType: "application/pdf",
        },
      ],
    });

    // Atualiza flag de enviado
    await db.query(
      "UPDATE certificados_avulsos SET enviado = true WHERE id = $1",
      [id]
    );

    return res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
  } catch (erro) {
    console.error("❌ Erro ao enviar certificado por e-mail:", erro);
    return res.status(500).json({ erro: "Erro ao enviar certificado." });
  } finally {
    // Limpeza do arquivo temporário
    if (caminhoTemp) {
      try {
        await fsp.unlink(caminhoTemp);
      } catch {}
    }
  }
}

module.exports = {
  criarCertificadoAvulso,
  listarCertificadosAvulsos,
  gerarPdfCertificado,
  enviarPorEmail,
};
