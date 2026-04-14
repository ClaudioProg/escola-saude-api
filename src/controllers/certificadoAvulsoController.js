/* eslint-disable no-console */
const dbFallback = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const nodemailer = require("nodemailer");

/* ========================= Config & Utils ========================= */

const IS_DEV = process.env.NODE_ENV !== "production";

function getDb(req) {
  return req?.db ?? dbFallback;
}

const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");
const safeFilename = (s = "") =>
  String(s).replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_");

function validarEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ✅ date-only safe: "YYYY-MM-DD" -> Date local, sem risco de timezone shift
function ymdToLocalDate(ymd) {
  if (!isYmd(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function formatarDataCurtaBR(data) {
  if (!data) return "";

  const s = String(data).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function dataHojePorExtenso() {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(agora);

  const dd = partes.find((p) => p.type === "day")?.value || "";
  const mes = partes.find((p) => p.type === "month")?.value || "";
  const ano = partes.find((p) => p.type === "year")?.value || "";

  return `${dd} de ${mes} de ${ano}`;
}

function formatarPeriodo(dataInicio, dataFim) {
  const di = dataInicio ? formatarDataCurtaBR(dataInicio) : null;
  const df = dataFim ? formatarDataCurtaBR(dataFim) : di;
  if (di && df) {
    if (di === df) return `realizado em ${di}`;
    return `realizado de ${di} a ${df}`;
  }
  if (di) return `realizado em ${di}`;
  return "";
}

function formatarIdentificador(valor) {
  if (!valor) return "";
  const onlyNum = onlyDigits(valor);

  if (/^\d{11}$/.test(onlyNum)) {
    return `CPF: ${onlyNum.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      "$1.$2.$3-$4"
    )}`;
  }

  if (/^\d{6}$/.test(onlyNum)) {
    const corpo = onlyNum.slice(0, 5);
    const digito = onlyNum.slice(5);
    const registroFormatado =
      corpo.replace(/(\d{2})(\d{3})/, "$1.$2") + "-" + digito;
    return `Registro: ${registroFormatado}`;
  }

  return "";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logCert(scope, payload = {}) {
  console.log(`[CERT_AVULSO][${scope}]`, payload);
}

function logCertError(scope, error, extra = {}) {
  console.error(`[CERT_AVULSO][${scope}][ERRO]`, {
    ...extra,
    message: error?.message || String(error),
    code: error?.code || null,
    stack: IS_DEV ? error?.stack || null : undefined,
  });
}

/* ========================= Modalidades ========================= */

const MODALIDADES = [
  "participante",
  "instrutor",
  "banca_avaliadora",
  "oficineiro",
  "mediador",
  "banca_tcr_medica",
  "banca_tcr_multi",
  "residente_medica",
  "residente_multi",
  "mostra_banner",
  "mostra_oral",
  "comissao_organizadora",
];

const NORMALIZAR_MAP = new Map([
  ["palestrante", "instrutor"],
  ["instructor", "instrutor"],
  ["banca_tcr_mfc", "banca_tcr_medica"],
  ["residente_mfc", "residente_medica"],
  ["banner", "mostra_banner"],
  ["oral", "mostra_oral"],
]);

function normalizarModalidade(v) {
  let s = String(v || "").trim().toLowerCase();
  if (NORMALIZAR_MAP.has(s)) s = NORMALIZAR_MAP.get(s);
  if (!MODALIDADES.includes(s)) s = "participante";
  return s;
}

function modalidadeNaoTemCarga(modalidade) {
  return (
    modalidade === "banca_avaliadora" ||
    modalidade === "comissao_organizadora"
  );
}

function modalidadeExigeTitulo(modalidade) {
  return (
    modalidade === "residente_medica" ||
    modalidade === "residente_multi" ||
    modalidade === "mostra_banner" ||
    modalidade === "mostra_oral" ||
    modalidade === "oficineiro"
  );
}

/* ========================= Fundo / Fontes ========================= */

function getCandidateRoots() {
  return [
    ...(process.env.CERT_FUNDO_DIR ? [process.env.CERT_FUNDO_DIR] : []),
    ...(process.env.CERT_ASSETS_DIR ? [process.env.CERT_ASSETS_DIR] : []),
    path.resolve(__dirname, "../../certificados"),
    path.resolve(__dirname, "../../assets"),
    path.resolve(__dirname, "../../public"),
    path.resolve(process.cwd(), "certificados"),
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "public"),
  ];
}

function getFundoPath({ temAssinatura2 = false } = {}) {
  const roots = getCandidateRoots();

  const orderedNames = temAssinatura2
    ? [
        "fundo_certificado.png",
        "fundo_certificado_instrutor.png",
        "fundo-certificado.png",
        "fundo-certificado-instrutor.png",
      ]
    : [
        "fundo_certificado_instrutor.png",
        "fundo_certificado.png",
        "fundo-certificado-instrutor.png",
        "fundo-certificado.png",
      ];

  for (const root of roots) {
    for (const nome of orderedNames) {
      const candidate = path.join(root, nome);
      try {
        if (fs.existsSync(candidate)) {
          if (IS_DEV) {
            logCert("FUNDO_ENCONTRADO", {
              temAssinatura2,
              arquivo: candidate,
            });
          }
          return candidate;
        }
      } catch {}
    }
  }

  console.warn("[CERT_AVULSO][FUNDO_AUSENTE]", {
    temAssinatura2,
    roots,
    nomes: orderedNames,
  });

  return null;
}

function getFontCandidates() {
  return [
    path.resolve(__dirname, "../../fonts"),
    path.resolve(process.cwd(), "fonts"),
    path.resolve(process.cwd(), "assets/fonts"),
    path.resolve(__dirname, "../../assets/fonts"),
  ];
}

function registerFonts(doc) {
  const fontRoots = getFontCandidates();

  const fontFiles = {
    "AlegreyaSans-Bold": "AlegreyaSans-Bold.ttf",
    "AlegreyaSans-Regular": "AlegreyaSans-Regular.ttf",
    BreeSerif: "BreeSerif-Regular.ttf",
    AlexBrush: "AlexBrush-Regular.ttf",
  };

  const registered = new Set();

  for (const [fontName, fileName] of Object.entries(fontFiles)) {
    let foundPath = null;

    for (const root of fontRoots) {
      const candidate = path.join(root, fileName);
      if (fs.existsSync(candidate)) {
        foundPath = candidate;
        break;
      }
    }

    if (!foundPath) {
      console.warn("[CERT_AVULSO][FONTE_AUSENTE]", {
        fonte: fontName,
        arquivo: fileName,
        roots: fontRoots,
      });
      continue;
    }

    try {
      doc.registerFont(fontName, foundPath);
      registered.add(fontName);
      if (IS_DEV) {
        logCert("FONTE_REGISTRADA", { fonte: fontName, caminho: foundPath });
      }
    } catch (e) {
      console.warn("[CERT_AVULSO][FONTE_FALHOU]", {
        fonte: fontName,
        caminho: foundPath,
        message: e?.message || String(e),
      });
    }
  }

  return registered;
}

function pickFont(registeredFonts, desired, fallback = "Helvetica") {
  return registeredFonts?.has(desired) ? desired : fallback;
}

/* ========================= Texto por modalidade ========================= */

function montarTextoModalidade({
  modalidade,
  tituloEvento,
  dataInicio,
  dataFim,
  carga,
  tituloTrabalho,
}) {
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const ev = tituloEvento || "";

  const temCarga =
    !!(carga && Number(carga) > 0) && !modalidadeNaoTemCarga(modalidade);
  const trechoCarga = temCarga
    ? `, com carga horária total de ${Number(carga)} horas.`
    : ".";

  switch (modalidade) {
    case "instrutor":
      return periodo
        ? `Participou como instrutor do evento "${ev}", ${periodo}${trechoCarga}`
        : `Participou como instrutor do evento "${ev}"${trechoCarga}`;

    case "banca_avaliadora":
      return periodo
        ? `Participou como Banca Avaliadora do evento "${ev}", ${periodo}.`
        : `Participou como Banca Avaliadora do evento "${ev}".`;

    case "oficineiro": {
      const titulo = (tituloTrabalho || "").trim();
      const trechoTitulo = titulo ? ` na oficina intitulada "${titulo}"` : "";
      return periodo
        ? `Participou como oficineiro do evento "${ev}"${trechoTitulo}, ${periodo}${trechoCarga}`
        : `Participou como oficineiro do evento "${ev}"${trechoTitulo}${trechoCarga}`;
    }

    case "mediador":
      return periodo
        ? `Participou como mediador do evento "${ev}", ${periodo}${trechoCarga}`
        : `Participou como mediador do evento "${ev}"${trechoCarga}`;

    case "banca_tcr_medica":
      return periodo
        ? `Participou como Banca Avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${ev}", ${periodo}.`
        : `Participou como Banca Avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${ev}".`;

    case "banca_tcr_multi":
      return periodo
        ? `Participou como Banca Avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${ev}", ${periodo}.`
        : `Participou como Banca Avaliadora do Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${ev}".`;

    case "residente_medica": {
      const titulo = (tituloTrabalho || "").trim();
      return periodo
        ? `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${ev}" intitulado "${titulo}", ${periodo}.`
        : `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Médica em Medicina de Família e Comunidade do evento "${ev}" intitulado "${titulo}".`;
    }

    case "residente_multi": {
      const titulo = (tituloTrabalho || "").trim();
      return periodo
        ? `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${ev}" intitulado "${titulo}", ${periodo}.`
        : `Apresentou o Trabalho de Conclusão de Residência (TCR) do Programa de Residência Multiprofissional do evento "${ev}" intitulado "${titulo}".`;
    }

    case "mostra_banner": {
      const titulo = (tituloTrabalho || "").trim();
      return periodo
        ? `Apresentou o trabalho intitulado "${titulo}" na Modalidade Banner do evento "${ev}", ${periodo}.`
        : `Apresentou o trabalho intitulado "${titulo}" na Modalidade Banner do evento "${ev}".`;
    }

    case "mostra_oral": {
      const titulo = (tituloTrabalho || "").trim();
      return periodo
        ? `Apresentou o trabalho intitulado "${titulo}" na Modalidade Apresentação Oral do evento "${ev}", ${periodo}.`
        : `Apresentou o trabalho intitulado "${titulo}" na Modalidade Apresentação Oral do evento "${ev}".`;
    }

    case "comissao_organizadora":
      return periodo
        ? `Participou como Comissão Organizadora do evento "${ev}", ${periodo}.`
        : `Participou como Comissão Organizadora do evento "${ev}".`;

    case "participante":
    default:
      return periodo
        ? `Participou do evento "${ev}", ${periodo}${trechoCarga}`
        : `Participou do evento "${ev}"${trechoCarga}`;
  }
}

/* ========================= Assinatura2 (helper único) ========================= */

async function carregarAssinatura2(req, assinatura2_id) {
  const db = getDb(req);
  const id = toIntId(assinatura2_id);

  if (!id) return null;

  try {
    const a = await db.query(
      `
      SELECT a.imagem_base64, u.nome, u.cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.usuario_id = $1
        AND a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      LIMIT 1
      `,
      [id]
    );

    if (!a.rowCount) {
      logCert("ASSINATURA2_NAO_ENCONTRADA", { assinatura2_id: id });
      return null;
    }

    const row = a.rows[0];
    let imgBuffer = null;

    if (row.imagem_base64 && row.imagem_base64.startsWith("data:image")) {
      try {
        imgBuffer = Buffer.from(row.imagem_base64.split(",")[1], "base64");
      } catch (e) {
        logCertError("ASSINATURA2_BASE64", e, { assinatura2_id: id });
      }
    }

    return {
      id,
      nome: row.nome || "—",
      cargo: row.cargo || null,
      imgBuffer,
    };
  } catch (e) {
    logCertError("ASSINATURA2_QUERY", e, { assinatura2_id: id });
    return null;
  }
}

/* ========================= PDF ========================= */

function desenharCertificado(doc, certificado, opts = {}) {
  const { assinatura2 = null, registeredFonts = new Set() } = opts;
  const temAssinatura2 = Boolean(assinatura2);

  const FONT_BREE = pickFont(registeredFonts, "BreeSerif", "Helvetica-Bold");
  const FONT_REG = pickFont(
    registeredFonts,
    "AlegreyaSans-Regular",
    "Helvetica"
  );
  const FONT_BOLD = pickFont(
    registeredFonts,
    "AlegreyaSans-Bold",
    "Helvetica-Bold"
  );
  const FONT_SCRIPT = pickFont(registeredFonts, "AlexBrush", "Times-Italic");

  const fundo = getFundoPath({ temAssinatura2 });
  if (fundo) {
    try {
      doc.image(fundo, 0, 0, {
        width: doc.page.width,
        height: doc.page.height,
      });
    } catch (e) {
      logCertError("FUNDO_RENDER", e, { fundo });
      doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
    }
  } else {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  }

  doc.fillColor("#0b3d2e").font(FONT_BREE).fontSize(63).text("CERTIFICADO", {
    align: "center",
  });

  doc.fillColor("black");
  doc.font(FONT_BOLD).fontSize(20).text("SECRETARIA MUNICIPAL DE SAÚDE", {
    align: "center",
    lineGap: 4,
  });

  doc.font(FONT_REG).fontSize(15).text(
    "A Escola Municipal de Saúde Pública certifica que:",
    { align: "center" }
  );

  doc.moveDown(2.5);

  const nome = certificado.nome || "";
  const nomeMaxWidth = 680;
  let nomeFontSize = 45;

  doc.font(FONT_SCRIPT).fontSize(nomeFontSize);
  while (doc.widthOfString(nome) > nomeMaxWidth && nomeFontSize > 20) {
    nomeFontSize -= 1;
    doc.fontSize(nomeFontSize);
  }
  doc.text(nome, { align: "center" });

  const idFmt = formatarIdentificador(
    certificado.cpf || certificado.registro || ""
  );

  if (idFmt) {
    doc.font(FONT_BREE).fontSize(16).text(idFmt, 0, doc.y - 5, {
      align: "center",
      width: doc.page.width,
    });
  }

  const texto = montarTextoModalidade({
    modalidade: certificado.modalidade || "participante",
    tituloEvento: certificado.curso || "",
    dataInicio: certificado.data_inicio,
    dataFim: certificado.data_fim,
    carga: certificado.carga_horaria,
    tituloTrabalho: certificado.titulo_trabalho,
  });

  doc.moveDown(1);
  doc.font(FONT_REG).fontSize(15).text(texto, 70, doc.y, {
    align: "justify",
    lineGap: 4,
    width: 680,
  });

  doc.moveDown(1);
  doc.font(FONT_REG).fontSize(14).text(
    `Santos, ${dataHojePorExtenso()}.`,
    100,
    doc.y + 10,
    {
      align: "right",
      width: 680,
    }
  );

  const baseY = 470;
  const assinatura1X = temAssinatura2 ? 120 : 270;
  const assinatura1W = 300;

  doc.font(FONT_BOLD).fontSize(20).text(
    "Rafaella Pitol Corrêa",
    assinatura1X,
    baseY,
    {
      align: "center",
      width: assinatura1W,
    }
  );

  doc.font(FONT_REG).fontSize(14).text(
    "Chefe da Escola da Saúde",
    assinatura1X,
    baseY + 25,
    {
      align: "center",
      width: assinatura1W,
    }
  );

  if (temAssinatura2) {
    const areaX = 440;
    const areaW = 300;

    if (assinatura2.imgBuffer) {
      try {
        const assinaturaWidth = 150;
        const assinaturaX = areaX + (areaW - assinaturaWidth) / 2;
        const assinaturaY = baseY - 50;
        doc.image(assinatura2.imgBuffer, assinaturaX, assinaturaY, {
          width: assinaturaWidth,
        });
      } catch (e) {
        logCertError("ASSINATURA2_RENDER", e, {
          assinatura2_id: assinatura2.id,
        });
      }
    }

    const nome2 = assinatura2.nome || "—";
    const cargo2 = assinatura2.cargo || "Instrutor(a)";

    doc.font(FONT_BOLD).fontSize(20).text(nome2, areaX, baseY, {
      align: "center",
      width: areaW,
    });

    doc.font(FONT_REG).fontSize(14).text(cargo2, areaX, baseY + 25, {
      align: "center",
      width: areaW,
    });
  }
}

async function gerarPdfTemporario(certificado, filenamePrefix = "certificado", opts = {}) {
  const tempDir = path.join(__dirname, "..", "..", "temp");
  await ensureDir(tempDir);

  const filename = `${filenamePrefix}_${safeFilename(
    String(certificado.id || Date.now())
  )}.pdf`;

  const caminho = path.join(tempDir, filename);
  const tmpPath = caminho + ".tmp";

  logCert("PDF_INICIO", {
    certificado_id: certificado?.id || null,
    caminho,
    modalidade: certificado?.modalidade || null,
    assinatura2: Boolean(opts?.assinatura2),
  });

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      layout: "landscape",
      bufferPages: false,
    });

    const stream = fs.createWriteStream(tmpPath);
    const registeredFonts = registerFonts(doc);

    const onError = (err) => {
      try {
        stream.destroy();
      } catch {}
      reject(err);
    };

    stream.on("error", onError);
    doc.on("error", onError);

    doc.pipe(stream);

    try {
      desenharCertificado(doc, certificado, {
        ...opts,
        registeredFonts,
      });
      doc.end();
    } catch (e) {
      onError(e);
      return;
    }

    stream.on("finish", resolve);
  });

  await fsp.rename(tmpPath, caminho).catch(async () => {
    await fsp.copyFile(tmpPath, caminho);
    await fsp.unlink(tmpPath).catch(() => {});
  });

  logCert("PDF_OK", {
    certificado_id: certificado?.id || null,
    caminho,
  });

  return caminho;
}

/* ========================= Email ========================= */

function montarTransporter() {
  if (process.env.SMTP_HOST) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error(
        "Configuração SMTP incompleta: SMTP_HOST definido sem SMTP_USER/SMTP_PASS."
      );
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure:
        String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (!process.env.EMAIL_REMETENTE || !process.env.EMAIL_SENHA) {
    throw new Error(
      "Configuração de e-mail ausente: defina SMTP_* ou EMAIL_REMETENTE/EMAIL_SENHA."
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_REMETENTE,
      pass: process.env.EMAIL_SENHA,
    },
  });
}

/* ========================= Handlers ========================= */

/**
 * POST /api/certificados-avulsos
 */
async function criarCertificadoAvulso(req, res) {
  const db = getDb(req);

  try {
    let {
      nome,
      cpf,
      email,
      curso,
      carga_horaria,
      data_inicio,
      data_fim,
      modalidade,
      titulo_trabalho,
    } = req.body || {};

    nome = (nome || "").trim();
    curso = (curso || "").trim();
    email = (email || "").trim();
    cpf = onlyDigits(cpf || "");
    modalidade = normalizarModalidade(modalidade);
    titulo_trabalho =
      titulo_trabalho && String(titulo_trabalho).trim() !== ""
        ? String(titulo_trabalho).trim()
        : null;

    let carga = null;
    if (
      carga_horaria !== undefined &&
      String(carga_horaria).trim() !== ""
    ) {
      const n = Number(carga_horaria);
      if (Number.isFinite(n) && n > 0) carga = n;
    }

    if (modalidadeNaoTemCarga(modalidade)) carga = null;

    if (!nome || !curso || !email) {
      return res.status(400).json({
        erro: "Campos obrigatórios: nome, e-mail e curso.",
      });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({ erro: "E-mail inválido." });
    }

    if (modalidadeExigeTitulo(modalidade) && !titulo_trabalho) {
      return res.status(400).json({
        erro: "Título do trabalho é obrigatório para a modalidade selecionada.",
      });
    }

    const di = data_inicio ? String(data_inicio).trim() : null;
    const df =
      data_fim && String(data_fim).trim() !== ""
        ? String(data_fim).trim()
        : di;

    if (di && !isYmd(di)) {
      return res.status(400).json({
        erro: "data_inicio inválida. Use AAAA-MM-DD.",
      });
    }

    if (df && !isYmd(df)) {
      return res.status(400).json({
        erro: "data_fim inválida. Use AAAA-MM-DD.",
      });
    }

    if (di && df) {
      const d1 = ymdToLocalDate(di);
      const d2 = ymdToLocalDate(df);
      if (d1 && d2 && d1.getTime() > d2.getTime()) {
        return res.status(400).json({
          erro: "data_fim deve ser maior ou igual a data_inicio.",
        });
      }
    }

    logCert("CRIAR_INICIO", {
      nome,
      email,
      curso,
      modalidade,
      possuiCpf: Boolean(cpf),
      possuiCarga: Boolean(carga),
      data_inicio: di,
      data_fim: df,
    });

    const { rows } = await db.query(
      `
      INSERT INTO certificados_avulsos
        (nome, cpf, email, curso, carga_horaria, data_inicio, data_fim, enviado, modalidade, titulo_trabalho)
      VALUES
        ($1,   $2,  $3,   $4,    $5,            $6::date,   $7::date,  false,    $8,         $9)
      RETURNING *
      `,
      [nome, cpf || null, email, curso, carga, di, df, modalidade, titulo_trabalho]
    );

    logCert("CRIAR_OK", {
      certificado_id: rows?.[0]?.id || null,
      modalidade,
    });

    return res.status(201).json(rows[0]);
  } catch (erro) {
    logCertError("CRIAR", erro);
    return res.status(500).json({ erro: "Erro ao criar certificado avulso." });
  }
}

/**
 * GET /api/certificados-avulsos
 */
async function listarCertificadosAvulsos(req, res) {
  const db = getDb(req);

  try {
    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos ORDER BY id DESC"
    );

    logCert("LISTAR_OK", { total: rows.length });

    return res.json(rows);
  } catch (erro) {
    logCertError("LISTAR", erro);
    return res.status(500).json({ erro: "Erro ao listar certificados avulsos." });
  }
}

/**
 * GET /api/assinatura/lista
 * ✅ premium: não busca imagem_base64 (só metadados)
 */
async function listarAssinaturas(req, res) {
  const db = getDb(req);

  try {
    const q = await db.query(
      `
      SELECT a.usuario_id AS id, u.nome, u.cargo
      FROM assinaturas a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE a.imagem_base64 IS NOT NULL
        AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = (q.rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: true,
    }));

    logCert("ASSINATURAS_OK", { total: lista.length });

    return res.json(lista);
  } catch (erro) {
    logCertError("ASSINATURAS_LISTAR", erro);
    return res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
}

/**
 * GET /api/certificados-avulsos/:id/pdf
 */
async function gerarPdfCertificado(req, res) {
  const db = getDb(req);

  const id = toIntId(req.params.id);
  const assinatura2_id = toIntId(req.query.assinatura2_id);

  let caminhoTemp = null;

  try {
    if (!id) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    logCert("PDF_ROUTE_INICIO", {
      certificado_id: id,
      assinatura2_id,
      modalidade_override: req.query.modalidade || null,
    });

    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    const certificado = { ...rows[0] };

    if (req.query.modalidade) {
      certificado.modalidade = normalizarModalidade(req.query.modalidade);
      if (modalidadeNaoTemCarga(certificado.modalidade)) {
        certificado.carga_horaria = null;
      }
    }

    const assinatura2 = await carregarAssinatura2(req, assinatura2_id);
    const opts = assinatura2 ? { assinatura2 } : {};

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado", opts);

    const outName = safeFilename(`certificado_${id}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${outName}"`
    );
    res.setHeader("Cache-Control", "no-store");

    const stream = fs.createReadStream(caminhoTemp);

    const cleanup = async () => {
      if (caminhoTemp) {
        await fsp.unlink(caminhoTemp).catch(() => {});
      }
    };

    stream.on("close", cleanup);
    stream.on("error", async (err) => {
      logCertError("PDF_STREAM", err, { certificado_id: id, caminhoTemp });
      await cleanup();
      if (!res.headersSent) res.status(500).end();
    });

    res.on("close", cleanup);

    logCert("PDF_ROUTE_OK", {
      certificado_id: id,
      caminhoTemp,
    });

    return stream.pipe(res);
  } catch (erro) {
    logCertError("PDF_ROUTE", erro, {
      certificado_id: id,
      assinatura2_id,
      caminhoTemp,
    });

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
  const db = getDb(req);

  const id = toIntId(req.params.id);
  const assinatura2_id = toIntId(req.query.assinatura2_id);

  let caminhoTemp = null;

  try {
    if (!id) {
      console.error("[CERT_AVULSO][EMAIL][VALIDACAO] ID inválido:", req.params.id);
      return res.status(400).json({ erro: "ID inválido." });
    }

    console.log("[CERT_AVULSO][EMAIL][INICIO]", {
      id,
      assinatura2_id,
      query: req.query,
    });

    const { rows } = await db.query(
      "SELECT * FROM certificados_avulsos WHERE id = $1",
      [id]
    );

    console.log("[CERT_AVULSO][EMAIL][BUSCA_CERTIFICADO]", {
      id,
      encontrados: rows.length,
    });

    if (!rows.length) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    const certificado = { ...rows[0] };

    console.log("[CERT_AVULSO][EMAIL][CERTIFICADO]", {
      id: certificado.id,
      nome: certificado.nome,
      email: certificado.email,
      modalidade: certificado.modalidade,
      data_inicio: certificado.data_inicio,
      data_fim: certificado.data_fim,
      carga_horaria: certificado.carga_horaria,
    });

    if (!validarEmail(certificado.email)) {
      console.error("[CERT_AVULSO][EMAIL][EMAIL_INVALIDO]", {
        id,
        email: certificado.email,
      });
      return res.status(400).json({
        erro: "O registro possui e-mail inválido.",
      });
    }

    if (req.query.modalidade) {
      certificado.modalidade = normalizarModalidade(req.query.modalidade);
      if (modalidadeNaoTemCarga(certificado.modalidade)) {
        certificado.carga_horaria = null;
      }
    }

    console.log("[CERT_AVULSO][EMAIL][ASSINATURA2][ANTES]", {
      assinatura2_id,
    });

    const assinatura2 = await carregarAssinatura2(req, assinatura2_id);

    console.log("[CERT_AVULSO][EMAIL][ASSINATURA2][DEPOIS]", {
      assinatura2_id,
      encontrada: !!assinatura2,
      nome: assinatura2?.nome || null,
      cargo: assinatura2?.cargo || null,
      temImgBuffer: !!assinatura2?.imgBuffer,
    });

    const opts = assinatura2 ? { assinatura2 } : {};

    console.log("[CERT_AVULSO][EMAIL][PDF][INICIO]", {
      id,
      assinatura2: !!assinatura2,
    });

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado", opts);

    console.log("[CERT_AVULSO][EMAIL][PDF][OK]", {
      id,
      caminhoTemp,
      exists: !!caminhoTemp,
    });

    const textoPrincipal = montarTextoModalidade({
      modalidade: certificado.modalidade || "participante",
      tituloEvento: certificado.curso || "",
      dataInicio: certificado.data_inicio,
      dataFim: certificado.data_fim,
      carga: certificado.carga_horaria,
      tituloTrabalho: certificado.titulo_trabalho,
    });

    console.log("[CERT_AVULSO][EMAIL][SMTP][CONFIG]", {
      usandoSMTPHost: !!process.env.SMTP_HOST,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT || null,
      smtpUserPresent: !!process.env.SMTP_USER,
      smtpPassPresent: !!process.env.SMTP_PASS,
      emailRemetentePresent: !!process.env.EMAIL_REMETENTE,
      emailSenhaPresent: !!process.env.EMAIL_SENHA,
      emailFrom: process.env.EMAIL_FROM || null,
    });

    const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || 587;
const SMTP_SECURE =
  (process.env.SMTP_SECURE || process.env.EMAIL_SMTP_SECURE || "false")
    .toString()
    .toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS;

const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  (
    process.env.EMAIL_FROM_NAME && process.env.EMAIL_FROM_ADDR
      ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDR}>`
      : null
  ) ||
  (SMTP_USER ? `"Escola da Saúde" <${SMTP_USER}>` : null);

const EMAIL_REMETENTE =
  process.env.EMAIL_REMETENTE || process.env.EMAIL_FROM_ADDR || SMTP_USER;
const EMAIL_SENHA =
  process.env.EMAIL_SENHA || process.env.EMAIL_SMTP_PASS || SMTP_PASS;

if (SMTP_HOST) {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configurado sem usuário/senha. Verifique SMTP_USER/SMTP_PASS ou EMAIL_SMTP_USER/EMAIL_SMTP_PASS.");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
} else {
  if (!EMAIL_REMETENTE || !EMAIL_SENHA) {
    throw new Error("Envio por Gmail sem credenciais. Verifique EMAIL_REMETENTE/EMAIL_SENHA.");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_REMETENTE,
      pass: EMAIL_SENHA,
    },
  });
}

    try {
      await transporter.verify();
      console.log("[CERT_AVULSO][EMAIL][SMTP][VERIFY_OK]", { id });
    } catch (smtpErr) {
      console.error("[CERT_AVULSO][EMAIL][SMTP][VERIFY_ERRO]", {
        id,
        message: smtpErr?.message,
        code: smtpErr?.code,
        command: smtpErr?.command,
        response: smtpErr?.response,
        responseCode: smtpErr?.responseCode,
      });
      throw smtpErr;
    }

    const remetente =
      process.env.EMAIL_FROM ||
      (process.env.EMAIL_REMETENTE
        ? `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>`
        : "Escola da Saúde <no-reply@escolasaude.local>");

    const subject =
      process.env.CERT_AVULSO_SUBJECT ||
      "Seu Certificado — Escola Municipal de Saúde";

    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; color:#111;">
        <p>Prezado(a) <strong>${certificado.nome}</strong>,</p>
        <p>${textoPrincipal}</p>
        <p>Em anexo, segue o seu certificado em PDF.</p>
        <p style="font-size:14px; color:#444;">
          Caso tenha dúvidas ou precise de suporte, entre em contato com a equipe da Escola da Saúde.
        </p>
        <p>Atenciosamente,<br><strong>Equipe da Escola da Saúde</strong></p>
      </div>
    `;

    console.log("[CERT_AVULSO][EMAIL][SENDMAIL][INICIO]", {
      id,
      to: certificado.email,
      from: remetente,
      subject,
      caminhoTemp,
    });

    const info = await transporter.sendMail({
      from: remetente,
      to: certificado.email,
      subject,
      text: `Prezado(a) ${certificado.nome},

${textoPrincipal}

Em anexo, segue o seu certificado em PDF.

Caso tenha dúvidas ou precise de suporte, entre em contato com a equipe da Escola da Saúde.

Atenciosamente,
Equipe da Escola da Saúde
`,
      html,
      attachments: [
        {
          filename: "certificado.pdf",
          path: caminhoTemp,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("[CERT_AVULSO][EMAIL][SENDMAIL][OK]", {
      id,
      messageId: info?.messageId || null,
      accepted: info?.accepted || [],
      rejected: info?.rejected || [],
      response: info?.response || null,
    });

    await db.query(
      "UPDATE certificados_avulsos SET enviado = true WHERE id = $1",
      [id]
    );

    console.log("[CERT_AVULSO][EMAIL][UPDATE_OK]", { id });

    return res.status(200).json({
      mensagem: "Certificado enviado com sucesso.",
    });
  } catch (erro) {
    console.error("[CERT_AVULSO][EMAIL][ERRO_FINAL]", {
      id,
      assinatura2_id,
      caminhoTemp,
      message: erro?.message || String(erro),
      code: erro?.code || null,
      command: erro?.command || null,
      response: erro?.response || null,
      responseCode: erro?.responseCode || null,
      stack: IS_DEV ? erro?.stack || null : undefined,
    });

    return res.status(500).json({
      erro: IS_DEV
        ? `Erro ao enviar certificado: ${erro?.message || "falha desconhecida"}`
        : "Erro ao enviar certificado.",
    });
  } finally {
    if (caminhoTemp) {
      try {
        await fsp.unlink(caminhoTemp).catch(() => {});
        console.log("[CERT_AVULSO][EMAIL][CLEANUP_OK]", { caminhoTemp });
      } catch (cleanupErr) {
        console.error("[CERT_AVULSO][EMAIL][CLEANUP_ERRO]", {
          caminhoTemp,
          message: cleanupErr?.message || String(cleanupErr),
        });
      }
    }
  }
}

module.exports = {
  criarCertificadoAvulso,
  listarCertificadosAvulsos,
  gerarPdfCertificado,
  enviarPorEmail,
  listarAssinaturas,
};