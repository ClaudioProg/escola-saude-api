// ✅ src/controllers/certificadosAvulsosController.js
/* eslint-disable no-console */
const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const nodemailer = require("nodemailer");

/* ========================= Utils ========================= */

const IS_DEV = process.env.NODE_ENV !== "production";

const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");
const boolish = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};
const safeFilename = (s = "") =>
  String(s).replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_");

function formatarIdentificador(valor) {
  if (!valor) return "";
  const onlyNum = onlyDigits(valor);

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
    "janeiro","fevereiro","março","abril","maio","junho",
    "julho","agosto","setembro","outubro","novembro","dezembro"
  ];
  const dd = String(hoje.getDate()).padStart(2, "0");
  return `${dd} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

function formatarDataCurtaBR(data) {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function validarEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/* ===== Fundo por tipo ===== */
function resolveFirstExisting(candidates = []) {
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}
function getFundoPath(tipo) {
  const nomes = [
    tipo === "palestrante" ? "fundo_certificado_instrutor.png" : null, // palestrante usa o mesmo do instrutor
    "fundo_certificado.png"
  ].filter(Boolean);

  const roots = [
    ...(process.env.CERT_FUNDO_DIR ? [process.env.CERT_FUNDO_DIR] : []),
    path.resolve(__dirname, "../../certificados"),
    path.resolve(__dirname, "../../assets"),
    path.resolve(__dirname, "../../public"),
    path.resolve(process.cwd(), "certificados"),
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "public"),
  ];
  const candidates = [];
  for (const nome of nomes) {
    for (const root of roots) candidates.push(path.join(root, nome));
    candidates.push(path.resolve(__dirname, nome));
  }
  const found = resolveFirstExisting(candidates);
  if (!found && IS_DEV) console.warn("⚠️ Fundo não encontrado. Procurado:", candidates);
  return found;
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
      try { doc.registerFont(nome, caminhoFonte); }
      catch (e) { if (IS_DEV) console.warn(`(certificados) Erro fonte ${nome}:`, e.message); }
    } else if (IS_DEV) {
      console.warn(`(certificados) Fonte ausente: ${caminhoFonte}`);
    }
  }
}

/**
 * Desenha o certificado.
 * @param {PDFDocument} doc
 * @param {object} certificado Linha de certificados_avulsos
 * @param {object} opts { palestrante?: boolean, assinatura2?: {nome, cargo, imgBuffer}? }
 */
function desenharCertificado(doc, certificado, opts = {}) {
  const { palestrante = false, assinatura2 = null } = opts;

  // Fundo
  const fundo = getFundoPath(palestrante ? "palestrante" : "usuario");
  if (fundo) {
    doc.image(fundo, 0, 0, { width: doc.page.width, height: doc.page.height }); // A4 landscape
  } else {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  }

  // Título
  doc.fillColor("#0b3d2e").font("BreeSerif").fontSize(63).text("CERTIFICADO", { align: "center" });

  // Cabeçalho institucional
  doc.fillColor("black");
  doc.font("AlegreyaSans-Bold").fontSize(20)
    .text("SECRETARIA MUNICIPAL DE SAÚDE", { align: "center", lineGap: 4 });
  doc.font("AlegreyaSans-Regular").fontSize(15)
    .text("A Escola Municipal de Saúde Pública certifica que:", { align: "center" });

  doc.moveDown(2.5);

  // Nome do participante
  const nome = certificado.nome || "";
  const nomeFont = "AlexBrush";
  const nomeMaxWidth = 680;
  let nomeFontSize = 45;
  doc.font(nomeFont).fontSize(nomeFontSize);
  while (doc.widthOfString(nome) > nomeMaxWidth && nomeFontSize > 20) {
    nomeFontSize -= 1;
    doc.fontSize(nomeFontSize);
  }
  doc.text(nome, { align: "center" });

  // Identificador (CPF / Registro)
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

  const fraseBase = palestrante
    ? `Participou como palestrante do evento "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas${periodoCurso}`
    : `Concluiu o curso "${certificado.curso}", com carga horária de ${certificado.carga_horaria} horas${periodoCurso}`;

  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(15).text(fraseBase, 70, doc.y, {
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

  // Área de assinaturas
  const baseY = 470;

  // Assinatura institucional (texto)
  doc.font("AlegreyaSans-Bold").fontSize(20)
    .text("Rafaella Pitol Corrêa", 270, baseY, { align: "center", width: 300 });
  doc.font("AlegreyaSans-Regular").fontSize(14)
    .text("Chefe da Escola da Saúde", 270, baseY + 25, { align: "center", width: 300 });

  // 2ª assinatura (se houver)
  if (assinatura2 && (assinatura2.imgBuffer || assinatura2.nome)) {
    const areaX = 440;
    const areaW = 300;

    if (assinatura2.imgBuffer) {
      try {
        const assinaturaWidth = 150;
        const assinaturaX = areaX + (areaW - assinaturaWidth) / 2;
        const assinaturaY = baseY - 50;
        doc.image(assinatura2.imgBuffer, assinaturaX, assinaturaY, { width: assinaturaWidth });
      } catch (e) {
        if (IS_DEV) console.warn("⚠️ Erro ao desenhar 2ª assinatura:", e.message);
      }
    }

    doc.font("AlegreyaSans-Bold").fontSize(20)
      .text(assinatura2.nome || "—", areaX, baseY, { align: "center", width: areaW });
    if (assinatura2.cargo) {
      doc.font("AlegreyaSans-Regular").fontSize(14)
        .text(assinatura2.cargo, areaX, baseY + 25, { align: "center", width: areaW });
    }
  }
}

/**
 * Gera o PDF para um arquivo temporário e retorna o caminho.
 * @param {object} certificado
 * @param {string} filenamePrefix
 * @param {object} opts { palestrante?: boolean, assinatura2?: {nome,cargo,imgBuffer}? }
 */
async function gerarPdfTemporario(certificado, filenamePrefix = "certificado", opts = {}) {
  const tempDir = path.join(__dirname, "..", "..", "temp");
  await ensureDir(tempDir);

  const filename = `${filenamePrefix}_${safeFilename(String(certificado.id || Date.now()))}.pdf`;
  const caminho = path.join(tempDir, filename);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, layout: "landscape" });
    const stream = fs.createWriteStream(caminho);

    const onError = (err) => {
      try { stream.destroy(); } catch {}
      reject(err);
    };
    stream.on("error", onError);
    doc.on("error", onError);

    doc.pipe(stream);
    registerFonts(doc);
    desenharCertificado(doc, certificado, opts);
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

    // Normalizações/validações
    nome = (nome || "").trim();
    curso = (curso || "").trim();
    email = (email || "").trim();
    cpf = onlyDigits(cpf || ""); // <- garante só números
    const carga = Number(carga_horaria);

    if (!nome || !curso || !email || !Number.isFinite(carga) || carga <= 0) {
      return res.status(400).json({ erro: "Dados obrigatórios inválidos." });
    }
    if (!validarEmail(email)) {
      return res.status(400).json({ erro: "E-mail inválido." });
    }

    const di = data_inicio ? String(data_inicio) : null;
    const df = data_fim && String(data_fim).trim() !== "" ? String(data_fim) : di;

    const { rows } = await db.query(
      `INSERT INTO certificados_avulsos
       (nome, cpf, email, curso, carga_horaria, data_inicio, data_fim, enviado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING *`,
      [nome, cpf, email, curso, carga, di, df]
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
 * GET /api/assinatura/lista
 * Lista pessoas com assinatura cadastrada para 2ª assinatura no certificado.
 * (alinhado ao front)
 */
async function listarAssinaturas(req, res) {
  try {
    const q = await db.query(
      `
      SELECT a.usuario_id AS id, u.nome, u.cargo, a.imagem_base64
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );
    const lista = q.rows.map(r => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: Boolean(r.imagem_base64),
    }));
    return res.json(lista);
  } catch (erro) {
    console.error("❌ Erro ao listar assinaturas:", erro);
    return res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
}

/**
 * GET /api/certificados-avulsos/:id/pdf
 * Suporta:
 *   ?palestrante=1|true       → usa modelo de palestrante/instrutor e texto apropriado
 *   ?assinatura2_id=<usuario> → imprime 2ª assinatura (imagem + nome/cargo) desta pessoa
 */
async function gerarPdfCertificado(req, res) {
  const { id } = req.params;
  const { palestrante, assinatura2_id } = req.query;
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

    // Monta opções
    const opts = { palestrante: boolish(palestrante) };

    // (opcional) carrega a 2ª assinatura
    if (assinatura2_id) {
      try {
        const a = await db.query(
          `
          SELECT a.imagem_base64, u.nome, u.cargo
          FROM assinaturas a
          JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.usuario_id = $1 AND a.imagem_base64 IS NOT NULL AND a.imagem_base64 <> ''
          LIMIT 1
          `,
          [assinatura2_id]
        );
        if (a.rowCount) {
          const row = a.rows[0];
          let imgBuffer = null;
          if (row.imagem_base64 && row.imagem_base64.startsWith("data:image")) {
            try {
              imgBuffer = Buffer.from(row.imagem_base64.split(",")[1], "base64");
            } catch {}
          }
          opts.assinatura2 = { nome: row.nome, cargo: row.cargo || null, imgBuffer };
        }
      } catch (e) {
        if (IS_DEV) console.warn("⚠️ Falha ao obter 2ª assinatura:", e.message);
      }
    }

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado", opts);

    // headers gentis de download
    const outName = safeFilename(`certificado_${id}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
    res.setHeader("Cache-Control", "no-store");

    const stream = fs.createReadStream(caminhoTemp);
    stream.on("close", async () => {
      try { await fsp.unlink(caminhoTemp).catch(() => {}); } catch {}
    });
    stream.on("error", async (err) => {
      console.error("❌ Erro ao ler PDF:", err);
      try { await fsp.unlink(caminhoTemp).catch(() => {}); } catch {}
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (erro) {
    console.error("❌ Erro no gerarPdfCertificado:", erro);
    try { if (caminhoTemp) await fsp.unlink(caminhoTemp).catch(() => {}); } catch {}
    return res.status(500).json({ erro: "Erro ao gerar PDF." });
  }
}

/**
 * POST /api/certificados-avulsos/:id/enviar
 * (se quiser, dá para aceitar ?palestrante e ?assinatura2_id aqui também)
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

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado");

    let transporter;
    if (process.env.SMTP_HOST) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_REMETENTE,
          pass: process.env.EMAIL_SENHA,
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

    await db.query("UPDATE certificados_avulsos SET enviado = true WHERE id = $1", [id]);
    return res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
  } catch (erro) {
    console.error("❌ Erro ao enviar certificado por e-mail:", erro);
    return res.status(500).json({ erro: "Erro ao enviar certificado." });
  } finally {
    if (caminhoTemp) { try { await fsp.unlink(caminhoTemp); } catch {} }
  }
}

module.exports = {
  criarCertificadoAvulso,
  listarCertificadosAvulsos,
  gerarPdfCertificado,
  enviarPorEmail,
  listarAssinaturas, // GET /api/assinatura/lista
};
