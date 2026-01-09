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
const safeFilename = (s = "") => String(s).replace(/[^a-z0-9._-]+/gi, "_").replace(/_+/g, "_");

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
  return new Date(y, m - 1, d, 12, 0, 0, 0); // meio-dia ajuda a evitar edge cases
}

function formatarDataCurtaBR(data) {
  if (!data) return "";

  // ✅ se vier "YYYY-MM-DD", não usar new Date("YYYY-MM-DD")
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
  const hoje = new Date();
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const dd = String(hoje.getDate()).padStart(2, "0");
  return `${dd} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
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
    return `CPF: ${onlyNum.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  }

  if (/^\d{6}$/.test(onlyNum)) {
    const corpo = onlyNum.slice(0, 5);
    const digito = onlyNum.slice(5);
    const registroFormatado = corpo.replace(/(\d{2})(\d{3})/, "$1.$2") + "-" + digito;
    return `Registro: ${registroFormatado}`;
  }

  return "";
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
  return modalidade === "banca_avaliadora" || modalidade === "comissao_organizadora";
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

function getFundoPath({ temAssinatura2 = false }) {
  const nomeArquivo = temAssinatura2 ? "fundo_certificado.png" : "fundo_certificado_instrutor.png";
  const roots = [
    ...(process.env.CERT_FUNDO_DIR ? [process.env.CERT_FUNDO_DIR] : []),
    path.resolve(__dirname, "../../certificados"),
    path.resolve(__dirname, "../../assets"),
    path.resolve(__dirname, "../../public"),
    path.resolve(process.cwd(), "certificados"),
    path.resolve(process.cwd(), "assets"),
    path.resolve(process.cwd(), "public"),
  ];
  const candidates = roots.map((root) => path.join(root, nomeArquivo));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  if (IS_DEV) console.warn("⚠️ Fundo não encontrado:", candidates);
  return null;
}

function registerFonts(doc) {
  const fontsDir = path.join(__dirname, "..", "..", "fonts");
  const fontes = {
    "AlegreyaSans-Bold": path.join(fontsDir, "AlegreyaSans-Bold.ttf"),
    "AlegreyaSans-Regular": path.join(fontsDir, "AlegreyaSans-Regular.ttf"),
    BreeSerif: path.join(fontsDir, "BreeSerif-Regular.ttf"),
    AlexBrush: path.join(fontsDir, "AlexBrush-Regular.ttf"),
  };
  for (const [nome, caminhoFonte] of Object.entries(fontes)) {
    if (fs.existsSync(caminhoFonte)) {
      try {
        doc.registerFont(nome, caminhoFonte);
      } catch (e) {
        if (IS_DEV) console.warn(`(certificados) Erro fonte ${nome}:`, e.message);
      }
    } else if (IS_DEV) {
      console.warn(`(certificados) Fonte ausente: ${caminhoFonte}`);
    }
  }
}

/* ========================= Texto por modalidade ========================= */

function montarTextoModalidade({ modalidade, tituloEvento, dataInicio, dataFim, carga, tituloTrabalho }) {
  const periodo = formatarPeriodo(dataInicio, dataFim);
  const ev = tituloEvento || "";

  const temCarga = !!(carga && Number(carga) > 0) && !modalidadeNaoTemCarga(modalidade);
  const trechoCarga = temCarga ? `, com carga horária total de ${Number(carga)} horas.` : ".";

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

    if (!a.rowCount) return null;

    const row = a.rows[0];
    let imgBuffer = null;

    if (row.imagem_base64 && row.imagem_base64.startsWith("data:image")) {
      try {
        imgBuffer = Buffer.from(row.imagem_base64.split(",")[1], "base64");
      } catch {}
    }

    return {
      id,
      nome: row.nome || "—",
      cargo: row.cargo || null,
      imgBuffer,
    };
  } catch (e) {
    if (IS_DEV) console.warn("⚠️ Falha ao obter 2ª assinatura:", e.message);
    return null;
  }
}

/* ========================= PDF ========================= */

function desenharCertificado(doc, certificado, opts = {}) {
  const temAssinatura2 = Boolean(opts.assinatura2);

  const fundo = getFundoPath({ temAssinatura2 });
  if (fundo) {
    doc.image(fundo, 0, 0, { width: doc.page.width, height: doc.page.height });
  } else {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  }

  doc.fillColor("#0b3d2e").font("BreeSerif").fontSize(63).text("CERTIFICADO", { align: "center" });

  doc.fillColor("black");
  doc
    .font("AlegreyaSans-Bold")
    .fontSize(20)
    .text("SECRETARIA MUNICIPAL DE SAÚDE", { align: "center", lineGap: 4 });
  doc
    .font("AlegreyaSans-Regular")
    .fontSize(15)
    .text("A Escola Municipal de Saúde Pública certifica que:", { align: "center" });

  doc.moveDown(2.5);

  // Nome (ajuste dinâmico)
  const nome = certificado.nome || "";
  const nomeMaxWidth = 680;
  let nomeFontSize = 45;
  doc.font("AlexBrush").fontSize(nomeFontSize);
  while (doc.widthOfString(nome) > nomeMaxWidth && nomeFontSize > 20) {
    nomeFontSize -= 1;
    doc.fontSize(nomeFontSize);
  }
  doc.text(nome, { align: "center" });

  // Identificador
  const idFmt = formatarIdentificador(certificado.cpf || certificado.registro || "");
  if (idFmt) {
    doc.font("BreeSerif").fontSize(16).text(idFmt, 0, doc.y - 5, { align: "center", width: doc.page.width });
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
  doc.font("AlegreyaSans-Regular").fontSize(15).text(texto, 70, doc.y, {
    align: "justify",
    lineGap: 4,
    width: 680,
  });

  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(14).text(`Santos, ${dataHojePorExtenso()}.`, 100, doc.y + 10, {
    align: "right",
    width: 680,
  });

  // Assinaturas
  const baseY = 470;
  const assinatura1X = temAssinatura2 ? 120 : 270;
  const assinatura1W = 300;

  doc.font("AlegreyaSans-Bold").fontSize(20).text("Rafaella Pitol Corrêa", assinatura1X, baseY, { align: "center", width: assinatura1W });
  doc.font("AlegreyaSans-Regular").fontSize(14).text("Chefe da Escola da Saúde", assinatura1X, baseY + 25, { align: "center", width: assinatura1W });

  if (temAssinatura2) {
    const areaX = 440;
    const areaW = 300;

    if (opts.assinatura2.imgBuffer) {
      try {
        const assinaturaWidth = 150;
        const assinaturaX = areaX + (areaW - assinaturaWidth) / 2;
        const assinaturaY = baseY - 50;
        doc.image(opts.assinatura2.imgBuffer, assinaturaX, assinaturaY, { width: assinaturaWidth });
      } catch (e) {
        if (IS_DEV) console.warn("⚠️ Erro ao desenhar 2ª assinatura:", e.message);
      }
    }

    const nome2 = opts.assinatura2.nome || "—";
    const cargo2 = opts.assinatura2.cargo || "Instrutor(a)";

    doc.font("AlegreyaSans-Bold").fontSize(20).text(nome2, areaX, baseY, { align: "center", width: areaW });
    doc.font("AlegreyaSans-Regular").fontSize(14).text(cargo2, areaX, baseY + 25, { align: "center", width: areaW });
  }
}

// ✅ atomic write também aqui
async function gerarPdfTemporario(certificado, filenamePrefix = "certificado", opts = {}) {
  const tempDir = path.join(__dirname, "..", "..", "temp");
  await ensureDir(tempDir);

  const filename = `${filenamePrefix}_${safeFilename(String(certificado.id || Date.now()))}.pdf`;
  const caminho = path.join(tempDir, filename);
  const tmpPath = caminho + ".tmp";

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, layout: "landscape" });
    const stream = fs.createWriteStream(tmpPath);

    const onError = (err) => {
      try {
        stream.destroy();
      } catch {}
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

  await fsp.rename(tmpPath, caminho).catch(async () => {
    await fsp.copyFile(tmpPath, caminho);
    await fsp.unlink(tmpPath).catch(() => {});
  });

  return caminho;
}

/* ========================= Handlers ========================= */

/**
 * POST /api/certificados-avulsos
 */
async function criarCertificadoAvulso(req, res) {
  const db = getDb(req);

  try {
    let { nome, cpf, email, curso, carga_horaria, data_inicio, data_fim, modalidade, titulo_trabalho } = req.body || {};

    nome = (nome || "").trim();
    curso = (curso || "").trim();
    email = (email || "").trim();
    cpf = onlyDigits(cpf || "");
    modalidade = normalizarModalidade(modalidade);

    let carga = null;
    if (carga_horaria !== undefined && String(carga_horaria).trim() !== "") {
      const n = Number(carga_horaria);
      if (Number.isFinite(n) && n > 0) carga = n;
    }
    if (modalidadeNaoTemCarga(modalidade)) carga = null;

    if (!nome || !curso || !email) {
      return res.status(400).json({ erro: "Campos obrigatórios: nome, e-mail e curso." });
    }
    if (!validarEmail(email)) {
      return res.status(400).json({ erro: "E-mail inválido." });
    }
    if (modalidadeExigeTitulo(modalidade)) {
      if (!titulo_trabalho || String(titulo_trabalho).trim() === "") {
        return res.status(400).json({ erro: "Título do trabalho é obrigatório para a modalidade selecionada." });
      }
    }

    // ✅ datas: se vierem em YYYY-MM-DD, mantém como string (date-only safe)
    const di = data_inicio ? String(data_inicio).trim() : null;
    const df = data_fim && String(data_fim).trim() !== "" ? String(data_fim).trim() : di;

    // valida formato (se informado)
    if (di && !isYmd(di)) return res.status(400).json({ erro: "data_inicio inválida. Use AAAA-MM-DD." });
    if (df && !isYmd(df)) return res.status(400).json({ erro: "data_fim inválida. Use AAAA-MM-DD." });

    // opcional: garante ordem di<=df
    if (di && df) {
      const d1 = ymdToLocalDate(di);
      const d2 = ymdToLocalDate(df);
      if (d1 && d2 && d1.getTime() > d2.getTime()) {
        return res.status(400).json({ erro: "data_fim deve ser maior ou igual a data_inicio." });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO certificados_avulsos
        (nome, cpf, email, curso, carga_horaria, data_inicio, data_fim, enviado, modalidade, titulo_trabalho)
       VALUES ($1,   $2,  $3,   $4,    $5,            $6::date,   $7::date,  false,    $8,         $9)
       RETURNING *`,
      [nome, cpf, email, curso, carga, di, df, modalidade, titulo_trabalho || null]
    );

    return res.status(201).json(rows[0]);
  } catch (erro) {
    console.error("❌ Erro ao criar certificado avulso:", IS_DEV ? erro : erro?.message);
    return res.status(500).json({ erro: "Erro ao criar certificado avulso." });
  }
}

/**
 * GET /api/certificados-avulsos
 */
async function listarCertificadosAvulsos(req, res) {
  const db = getDb(req);

  try {
    const { rows } = await db.query("SELECT * FROM certificados_avulsos ORDER BY id DESC");
    return res.json(rows);
  } catch (erro) {
    console.error("❌ Erro ao listar certificados avulsos:", IS_DEV ? erro : erro?.message);
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
      WHERE a.imagem_base64 IS NOT NULL AND a.imagem_base64 <> ''
      ORDER BY u.nome ASC
      `
    );

    const lista = (q.rows || []).map((r) => ({
      id: r.id,
      nome: r.nome,
      cargo: r.cargo || null,
      tem_assinatura: true,
    }));

    return res.json(lista);
  } catch (erro) {
    console.error("❌ Erro ao listar assinaturas:", IS_DEV ? erro : erro?.message);
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

  let caminhoTemp;

  try {
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const { rows } = await db.query("SELECT * FROM certificados_avulsos WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ erro: "Certificado não encontrado." });

    const certificado = { ...rows[0] };

    // Override opcional (debug)
    if (req.query.modalidade) {
      certificado.modalidade = normalizarModalidade(req.query.modalidade);
      if (modalidadeNaoTemCarga(certificado.modalidade)) certificado.carga_horaria = null;
    }

    const assinatura2 = await carregarAssinatura2(req, assinatura2_id);
    const opts = assinatura2 ? { assinatura2 } : {};

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado", opts);

    const outName = safeFilename(`certificado_${id}.pdf`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
    res.setHeader("Cache-Control", "no-store");

    const stream = fs.createReadStream(caminhoTemp);
    stream.on("close", async () => {
      await fsp.unlink(caminhoTemp).catch(() => {});
    });
    stream.on("error", async (err) => {
      console.error("❌ Erro ao ler PDF:", err);
      await fsp.unlink(caminhoTemp).catch(() => {});
      if (!res.headersSent) res.status(500).end();
    });

    return stream.pipe(res);
  } catch (erro) {
    console.error("❌ Erro no gerarPdfCertificado:", IS_DEV ? erro : erro?.message);
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

  let caminhoTemp;

  try {
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const { rows } = await db.query("SELECT * FROM certificados_avulsos WHERE id = $1", [id]);
    if (!rows.length) return res.status(404).json({ erro: "Certificado não encontrado." });

    const certificado = { ...rows[0] };

    if (!validarEmail(certificado.email)) {
      return res.status(400).json({ erro: "O registro possui e-mail inválido." });
    }

    // Override opcional (debug)
    if (req.query.modalidade) {
      certificado.modalidade = normalizarModalidade(req.query.modalidade);
      if (modalidadeNaoTemCarga(certificado.modalidade)) certificado.carga_horaria = null;
    }

    const assinatura2 = await carregarAssinatura2(req, assinatura2_id);
    const opts = assinatura2 ? { assinatura2 } : {};

    caminhoTemp = await gerarPdfTemporario(certificado, "certificado", opts);

    const textoPrincipal = montarTextoModalidade({
      modalidade: certificado.modalidade || "participante",
      tituloEvento: certificado.curso || "",
      dataInicio: certificado.data_inicio,
      dataFim: certificado.data_fim,
      carga: certificado.carga_horaria,
      tituloTrabalho: certificado.titulo_trabalho,
    });

    // Transport
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
        auth: { user: process.env.EMAIL_REMETENTE, pass: process.env.EMAIL_SENHA },
      });
    }

    if (IS_DEV) {
      transporter.verify().then(
        () => console.log("[email] SMTP OK"),
        (e) => console.warn("[email] SMTP verify falhou:", e?.message || e)
      );
    }

    const remetente =
      process.env.EMAIL_FROM ||
      (process.env.EMAIL_REMETENTE ? `"Escola da Saúde" <${process.env.EMAIL_REMETENTE}>` : "Escola da Saúde <no-reply@escolasaude.local>");

    const subject = process.env.CERT_AVULSO_SUBJECT || "Seu Certificado — Escola Municipal de Saúde";

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

    await transporter.sendMail({
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
      attachments: [{ filename: "certificado.pdf", path: caminhoTemp, contentType: "application/pdf" }],
    });

    await db.query("UPDATE certificados_avulsos SET enviado = true WHERE id = $1", [id]);

    return res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
  } catch (erro) {
    console.error("❌ Erro ao enviar certificado por e-mail:", IS_DEV ? erro : erro?.message);
    return res.status(500).json({ erro: "Erro ao enviar certificado." });
  } finally {
    if (caminhoTemp) {
      try {
        await fsp.unlink(caminhoTemp).catch(() => {});
      } catch {}
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
