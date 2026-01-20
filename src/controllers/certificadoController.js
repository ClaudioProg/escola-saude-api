/* eslint-disable no-console */
// ✅ src/controllers/certificadoController.js — UNIFICADO (singular + admin embutido)
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const dbFallback = require("../db");
const { gerarNotificacaoDeCertificado } = require("./notificacaoController");
const { CERT_DIR, ensureDir } = require("../paths");

const IS_DEV = process.env.NODE_ENV !== "production";

/* =========================================================================
   Helpers gerais (singular)
=========================================================================== */
function getDb(req) {
  return req?.db ?? dbFallback;
}
function logDev(...args) {
  if (IS_DEV) console.log("[certificado]", ...args);
}
function toIntId(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function ymdFromAny(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function ymdToLocalDate(ymd, hhmm = "00:00") {
  if (!isYmd(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const [hh, mm] = String(hhmm || "00:00").slice(0, 5).split(":").map((x) => Number(x || 0));
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
}
function formatarCPF(cpf) {
  if (!cpf) return "";
  const puro = String(cpf).replace(/\D/g, "");
  if (puro.length !== 11) return String(cpf);
  return puro.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
function dataBR(isoLike) {
  if (!isoLike) return "";
  if (isoLike instanceof Date) {
    const y = isoLike.getUTCFullYear();
    const m = String(isoLike.getUTCMonth() + 1).padStart(2, "0");
    const d = String(isoLike.getUTCDate()).padStart(2, "0");
    return `${d}/${m}/${y}`;
  }
  const s = String(isoLike);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}
function dataExtensoBR(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.day} de ${map.month} de ${map.year}`;
}
function registerFonts(doc) {
  const fontsRoot = path.resolve(__dirname, "../../fonts");
  const fonts = [
    ["AlegreyaSans-Regular", "AlegreyaSans-Regular.ttf"],
    ["AlegreyaSans-Bold", "AlegreyaSans-Bold.ttf"],
    ["BreeSerif", "BreeSerif-Regular.ttf"],
    ["AlexBrush", "AlexBrush-Regular.ttf"],
  ];
  for (const [name, file] of fonts) {
    const p = path.join(fontsRoot, file);
    if (fs.existsSync(p)) {
      try {
        doc.registerFont(name, p);
      } catch (e) {
        console.warn(`⚠️ Fonte ${file}:`, e.message);
      }
    } else {
      logDev(`Fonte ausente: ${file}`);
    }
  }
}
function drawSignatureText(
  doc,
  rawText,
  { x, y, w },
  { maxFont = 34, minFont = 16, font = "AlexBrush", color = "#111" } = {}
) {
  const text = String(rawText ?? "").replace(/\s+/g, " ").trim();
  doc.save().font(font);
  let size = maxFont;
  while (size > minFont) {
    doc.fontSize(size);
    const ww = doc.widthOfString(text);
    if (ww <= w) break;
    size -= 1;
  }
  const ww = doc.widthOfString(text);
  const xCentered = x + Math.max(0, (w - ww) / 2);
  const textY = y + 25 + Math.max(0, (maxFont - size) / 3);
  doc.fillColor(color).text(text, xCentered, textY, { lineBreak: false });
  doc.restore();
}

/* =========================================================================
   Assinante da turma
=========================================================================== */
async function obterAssinanteDaTurma(turmaId, req = null) {
  const db = getDb(req);
  const id = toIntId(turmaId);
  if (!id) return { id: null, nome: "", imagem_base64: null, origem: "turma.invalid" };

  // 1) turma.instrutor_assinante_id
  const qTurma = await db.query(
    `SELECT COALESCE(t.instrutor_assinante_id) AS assinante_id FROM turmas t WHERE t.id = $1`,
    [id]
  );
  const assinanteId = toIntId(qTurma.rows?.[0]?.assinante_id || 0);

  if (assinanteId) {
    const r = await db.query(
      `
      SELECT u.id, NULLIF(TRIM(u.nome), '') AS nome, a.imagem_base64
      FROM usuarios u
      LEFT JOIN assinaturas a ON a.usuario_id = u.id
      WHERE u.id = $1
      LIMIT 1
      `,
      [assinanteId]
    );
    if (r.rowCount > 0 && r.rows[0].nome) {
      return {
        id: r.rows[0].id,
        nome: r.rows[0].nome,
        imagem_base64: r.rows[0].imagem_base64 || null,
        origem: "turma.instrutor_assinante_id",
      };
    }
  }

  // 2) turma_instrutor (flags)
  try {
    const qTI = await db.query(
      `
      SELECT u.id, NULLIF(TRIM(u.nome), '') AS nome, a.imagem_base64
      FROM turma_instrutor ti
      JOIN usuarios u ON u.id = ti.instrutor_id
      LEFT JOIN assinaturas a ON a.usuario_id = ti.instrutor_id
      WHERE ti.turma_id = $1
      ORDER BY ti.is_assinante DESC NULLS LAST, ti.ordem_assinatura ASC NULLS LAST, u.nome ASC
      LIMIT 1
      `,
      [id]
    );
    if (qTI.rowCount > 0 && qTI.rows[0].nome) {
      return {
        id: qTI.rows[0].id,
        nome: qTI.rows[0].nome,
        imagem_base64: qTI.rows[0].imagem_base64 || null,
        origem: "turma_instrutor",
      };
    }
  } catch (e) {
    if (e?.code !== "42703") throw e;
  }

  return { id: null, nome: "", imagem_base64: null, origem: "turma.sem_assinante" };
}

/* =========================================================================
   Assets / QR
=========================================================================== */
function resolveFirstExisting(candidates = []) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}
function getFundoPath(tipo) {
  const nomes = [tipo === "instrutor" ? "fundo_certificado_instrutor.png" : null, "fundo_certificado.png"].filter(Boolean);
  const envRoot = process.env.CERT_FUNDO_DIR ? [process.env.CERT_FUNDO_DIR] : [];
  const roots = [
    ...envRoot,
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
  if (!found) logDev("⚠️ Fundo não encontrado.", candidates);
  else logDev("✅ Fundo encontrado:", found);
  return found;
}
async function tryQRCodeDataURL(texto) {
  try {
    return await QRCode.toDataURL(texto, { margin: 1, width: 140 });
  } catch (e) {
    console.warn("⚠️ Falha ao gerar QRCode:", e.message);
    return null;
  }
}
async function usuarioFezAvaliacao(usuario_id, turma_id, req = null) {
  const db = getDb(req);
  const q = await db.query(
    `SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [Number(usuario_id), Number(turma_id)]
  );
  return q.rowCount > 0;
}

/* =========================================================================
   Datas reais / resumo turma
=========================================================================== */
async function resumoDatasTurma(turma_id, usuario_id, req = null) {
  const db = getDb(req);
  try {
    const q = await db.query(
      `
      WITH base AS (
        SELECT
          MIN(dt.data::date) AS min_data,
          MAX(dt.data::date) AS max_data,
          COUNT(*)::int      AS total_aulas,
          SUM(
            EXTRACT(EPOCH FROM (
              COALESCE(dt.horario_fim::time,   '23:59'::time) -
              COALESCE(dt.horario_inicio::time,'00:00'::time)
            )) / 3600.0
          ) AS horas_total
        FROM datas_turma dt
        WHERE dt.turma_id = $1
      ),
      pres AS (
        SELECT COUNT(DISTINCT p.data_presenca::date)::int AS presencas_distintas
        FROM presencas p
        WHERE p.turma_id = $1 AND p.usuario_id = $2 AND p.presente = TRUE
      )
      SELECT
        base.min_data,
        base.max_data,
        COALESCE(base.total_aulas, 0)           AS total_aulas,
        COALESCE(base.horas_total,  0)          AS horas_total,
        COALESCE(pres.presencas_distintas, 0)   AS presencas_distintas
      FROM base
      LEFT JOIN pres ON TRUE
      `,
      [Number(turma_id), Number(usuario_id)]
    );
    return q.rows[0] || {};
  } catch (e) {
    console.error("[resumoDatasTurma] erro:", { msg: e?.message });
    const db2 = getDb(req);
    const r2 = await db2.query(
      `
      SELECT
        t.data_inicio::date AS min_data,
        t.data_fim::date    AS max_data,
        GREATEST(1, (t.data_fim::date - t.data_inicio::date) + 1)::int AS total_aulas,
        COALESCE(t.carga_horaria::numeric, 0) AS horas_total,
        (
          SELECT COUNT(DISTINCT p.data_presenca::date)::int
          FROM presencas p
          WHERE p.turma_id = $1 AND p.usuario_id = $2 AND p.presente = TRUE
        ) AS presencas_distintas
      FROM turmas t
      WHERE t.id = $1
      `,
      [turma_id, usuario_id]
    );
    return r2.rows[0] || {};
  }
}

/* =========================================================================
   Gerador físico do PDF
=========================================================================== */
async function _gerarPdfFisico({
  tipo,
  usuario_id,
  evento_id,
  turma_id,
  assinaturaBase64,
  TURMA,
  nomeUsuario,
  cpfUsuario,
  horasTotal,
  minData,
  maxData,
  req = null,
}) {
  await ensureDir(CERT_DIR);

  const nomeArquivo = `certificado_${tipo}_usuario${usuario_id}_evento${evento_id}_turma${turma_id}.pdf`;
  const caminho = path.join(CERT_DIR, nomeArquivo);

  const diYmd = ymdFromAny(minData || TURMA.data_inicio);
  const dfYmd = ymdFromAny(maxData || TURMA.data_fim);
  const mesmoDia = diYmd && diYmd === dfYmd;

  const dataInicioBR = dataBR(diYmd);
  const dataFimBR = dataBR(dfYmd);
  const dataHojeExtenso = dataExtensoBR(new Date());

  const cargaTexto = horasTotal > 0 ? horasTotal : TURMA.carga_horaria;
  const tituloEvento = TURMA.titulo || "evento";
  const turmaNome = TURMA.turma_nome || TURMA.nome_turma || TURMA.nome || `Turma #${turma_id}`;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  const tmpPath = caminho + ".tmp";
  const writeStream = fs.createWriteStream(tmpPath);
  const finished = new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });

  doc.pipe(writeStream);
  registerFonts(doc);

  const fundoPath = getFundoPath(tipo);
  if (fundoPath) {
    doc.save();
    doc.image(fundoPath, 0, 0, { width: doc.page.width, height: doc.page.height });
    doc.restore();
  } else {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  }

  // Título
  doc.fillColor("#0b3d2e").font("BreeSerif").fontSize(63).text("CERTIFICADO", { align: "center" });
  doc.y += 20;

  // Cabeçalho
  doc.fillColor("black");
  doc.font("AlegreyaSans-Bold").fontSize(20).text("SECRETARIA MUNICIPAL DE SAÚDE", { align: "center", lineGap: 4 });
  doc.font("AlegreyaSans-Regular").fontSize(15).text("A Escola Municipal de Saúde Pública certifica que:", {
    align: "center",
  });
  doc.moveDown(1);
  doc.y += 20;

  // Nome
  const nomeFontName = "AlexBrush";
  const maxNomeWidth = 680;
  let nomeFontSize = 45;
  doc.font(nomeFontName).fontSize(nomeFontSize);
  while (doc.widthOfString(nomeUsuario) > maxNomeWidth && nomeFontSize > 20) {
    nomeFontSize -= 1;
    doc.fontSize(nomeFontSize);
  }
  doc.text(nomeUsuario, { align: "center" });

  // CPF
  if (cpfUsuario) {
    doc.font("BreeSerif")
      .fontSize(16)
      .text(`CPF: ${cpfUsuario}`, 0, doc.y - 5, { align: "center", width: doc.page.width });
  }

  // Corpo
  const corpoTexto =
    tipo === "instrutor"
      ? mesmoDia
        ? `Participou como instrutor do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
        : `Participou como instrutor do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`
      : mesmoDia
        ? `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
        : `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`;

  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(15).text(corpoTexto, 70, doc.y, { align: "justify", lineGap: 4, width: 680 });

  // Data de emissão
  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(14).text(`Santos, ${dataHojeExtenso}.`, 100, doc.y + 10, {
    align: "right",
    width: 680,
  });

  /* Assinaturas / Identificação */
  const baseY = 470;

  if (tipo === "instrutor") {
    const CENTER_W = 360;
    const CENTER_X = (doc.page.width - CENTER_W) / 2;
    doc.font("AlegreyaSans-Bold").fontSize(20).text("Rafaella Pitol Corrêa", CENTER_X, baseY, { align: "center", width: CENTER_W });
    doc.font("AlegreyaSans-Regular").fontSize(14).text("Chefe da Escola da Saúde", CENTER_X, baseY + 25, { align: "center", width: CENTER_W });
  } else {
    const LEFT = { x: 100, w: 300 };
    doc.font("AlegreyaSans-Bold").fontSize(20).text("Rafaella Pitol Corrêa", LEFT.x, baseY, { align: "center", width: LEFT.w });
    doc.font("AlegreyaSans-Regular").fontSize(14).text("Chefe da Escola da Saúde", LEFT.x, baseY + 25, { align: "center", width: LEFT.w });

    const RIGHT = { x: 440, w: 300 };
    const SIGN_W = 150;
    const signX = RIGHT.x + (RIGHT.w - SIGN_W) / 2;
    const signY = baseY - 50;
    const SIGN_BOX = { x: signX, y: signY, w: SIGN_W };

    let nomeInstrutor = "";
    let assinaturaInstrutorBase64 = null;
    let instrutorAssinanteId = null;

    try {
      const assinante = await obterAssinanteDaTurma(Number(turma_id), req);
      instrutorAssinanteId = assinante?.id ? Number(assinante.id) : null;
      nomeInstrutor = (assinante?.nome || "").trim();
      assinaturaInstrutorBase64 = assinante?.imagem_base64 || null;

      logDev("Assinante TURMA:", assinante?.origem, instrutorAssinanteId, nomeInstrutor || "(vazio)");
    } catch (e) {
      console.warn("⚠️ Erro ao obter assinante da turma:", e.message);
    }

    if (nomeInstrutor || assinaturaInstrutorBase64) {
      let desenhouAssinatura = false;
      if (assinaturaInstrutorBase64 && /^data:image\/(png|jpe?g|webp);base64,/.test(assinaturaInstrutorBase64)) {
        try {
          const buf = Buffer.from(assinaturaInstrutorBase64.split(",")[1], "base64");
          doc.image(buf, SIGN_BOX.x, SIGN_BOX.y, { width: SIGN_BOX.w });
          desenhouAssinatura = true;
        } catch (e) {
          console.warn("⚠️ Assinatura do instrutor inválida:", e.message);
        }
      }
      if (!desenhouAssinatura && nomeInstrutor) {
        drawSignatureText(doc, nomeInstrutor, SIGN_BOX, { maxFont: 34, minFont: 16 });
      }
      if (nomeInstrutor) {
        const cargoInstrutor = instrutorAssinanteId === 2474 ? "Secretário de Saúde" : "Instrutor(a)";
        doc.font("AlegreyaSans-Bold").fontSize(20).text(nomeInstrutor, RIGHT.x, baseY, { align: "center", width: RIGHT.w });
        doc.font("AlegreyaSans-Regular").fontSize(14).text(cargoInstrutor, RIGHT.x, baseY + 25, { align: "center", width: RIGHT.w });
      }
    }
  }

  // QR
  const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "https://escoladasaude.vercel.app";
  const linkValidacao =
    `${FRONTEND_BASE_URL}/validar-certificado.html?usuario_id=${encodeURIComponent(usuario_id)}&evento_id=${encodeURIComponent(evento_id)}&turma_id=${encodeURIComponent(turma_id)}`;

  const qrDataURL = await tryQRCodeDataURL(linkValidacao);
  if (qrDataURL) {
    doc.image(qrDataURL, 40, 420, { width: 80 });
    doc.fillColor("#000").fontSize(7).text("Escaneie este QR Code", 40, 510);
    doc.text("para validar o certificado.", 40, 520);
  }

  doc.end();
  await finished;

  await fsp.rename(tmpPath, caminho).catch(async () => {
    await fsp.copyFile(tmpPath, caminho);
    await fsp.unlink(tmpPath).catch(() => {});
  });

  return { nomeArquivo, caminho };
}

/* =========================================================================
   Endpoints públicos (singular)
=========================================================================== */
async function gerarCertificado(req, res) {
  const db = getDb(req);

  const usuario_id = toIntId(req.body?.usuario_id);
  const evento_id = toIntId(req.body?.evento_id);
  const turma_id = toIntId(req.body?.turma_id);
  const tipo = String(req.body?.tipo || "").trim().toLowerCase();
  const assinaturaBase64 = req.body?.assinaturaBase64 ?? null;

  if (!usuario_id || !evento_id || !turma_id) {
    return res.status(400).json({ erro: "Parâmetros obrigatórios: usuario_id, evento_id, turma_id." });
  }
  if (!tipo || !["usuario", "instrutor"].includes(tipo)) {
    return res.status(400).json({ erro: "Parâmetro 'tipo' inválido (use 'usuario' ou 'instrutor')." });
  }

  try {
    logDev("Tipo do certificado:", tipo);

    const eventoResult = await db.query(
      `
      SELECT 
        e.titulo,
        t.nome AS turma_nome,
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
    if (eventoResult.rowCount === 0) return res.status(404).json({ erro: "Evento ou turma não encontrados." });
    const TURMA = eventoResult.rows[0];

    const pessoa = await db.query("SELECT nome, cpf, email FROM usuarios WHERE id = $1", [usuario_id]);
    if (pessoa.rowCount === 0) {
      return res.status(404).json({ erro: tipo === "instrutor" ? "Instrutor não encontrado." : "Usuário não encontrado." });
    }
    const nomeUsuario = pessoa.rows[0].nome;
    const cpfUsuario = formatarCPF(pessoa.rows[0].cpf || "");

    if (tipo === "instrutor") {
      const vinc = await db.query(
        `SELECT 1 FROM turma_instrutor WHERE turma_id = $1 AND instrutor_id = $2 LIMIT 1`,
        [turma_id, usuario_id]
      );
      if (vinc.rowCount === 0) return res.status(403).json({ erro: "Você não está vinculado como instrutor nesta turma." });

      const fimYmd = ymdFromAny(TURMA.data_fim);
      const hf = typeof TURMA.horario_fim === "string" ? TURMA.horario_fim.slice(0, 5) : "23:59";
      const fimDT = ymdToLocalDate(fimYmd, hf);
      if (fimDT && new Date() < fimDT) {
        return res.status(400).json({ erro: "A turma ainda não encerrou para emissão do certificado de instrutor." });
      }
    }

    const resumo = await resumoDatasTurma(turma_id, usuario_id, req);
    const minData = resumo.min_data || TURMA.data_inicio;
    const maxData = resumo.max_data || TURMA.data_fim;
    const totalAulas = Number(resumo.total_aulas || 0);
    const horasTotal = Number(resumo.horas_total || 0);
    const presencasDistintas = Number(resumo.presencas_distintas || 0);

    if (tipo === "usuario") {
      const fimYmd = ymdFromAny(maxData || TURMA.data_fim);
      const hf = typeof TURMA.horario_fim === "string" ? TURMA.horario_fim.slice(0, 5) : "23:59";
      const fimDT = ymdToLocalDate(fimYmd, hf);
      if (fimDT && new Date() < fimDT) {
        return res.status(400).json({ erro: "A turma ainda não encerrou. O certificado só pode ser gerado após o término." });
      }
      const taxa = totalAulas > 0 ? presencasDistintas / totalAulas : 0;
      if (!(taxa >= 0.75)) {
        return res.status(403).json({ erro: "Presença insuficiente (mínimo de 75%)." });
      }
      const fez = await usuarioFezAvaliacao(usuario_id, turma_id, req);
      if (!fez) {
        return res.status(403).json({
          erro: "É necessário enviar a avaliação do evento para liberar o certificado.",
          proximo_passo: "Preencha a avaliação disponível nas suas notificações.",
        });
      }
    }

    const { nomeArquivo } = await _gerarPdfFisico({
      tipo,
      usuario_id,
      evento_id,
      turma_id,
      assinaturaBase64,
      TURMA,
      nomeUsuario,
      cpfUsuario,
      horasTotal,
      minData,
      maxData,
      req,
    });

    const upsert = await db.query(
      `
      INSERT INTO certificados (usuario_id, evento_id, turma_id, tipo, arquivo_pdf, gerado_em)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (usuario_id, evento_id, turma_id, tipo)
      DO UPDATE SET arquivo_pdf = EXCLUDED.arquivo_pdf, gerado_em = NOW()
      RETURNING id
      `,
      [usuario_id, evento_id, turma_id, tipo, nomeArquivo]
    );

    try {
      await gerarNotificacaoDeCertificado(usuario_id, turma_id);
    } catch (e) {
      console.warn("⚠️ Notificação de certificado falhou:", e?.message || e);
    }

    if (tipo === "usuario") {
      try {
        const { rows } = await db.query("SELECT email, nome FROM usuarios WHERE id = $1", [usuario_id]);
        const emailUsuario = rows[0]?.email?.trim();
        const nomeUsuarioEmail = rows[0]?.nome?.trim() || "Aluno(a)";
        if (emailUsuario) {
          const { send } = require("../services/mailer");
          const titulo = TURMA.titulo || "evento";
          const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "https://escoladasaude.vercel.app";
          const link = `${FRONTEND_BASE_URL}/certificados`;
          await send({
            to: emailUsuario,
            subject: `🎓 Certificado disponível do evento "${titulo}"`,
            text: `Olá, ${nomeUsuarioEmail}!

Seu certificado do evento "${titulo}" já está disponível para download.

Baixe aqui: ${link}

Se o botão/link não abrir, copie e cole o endereço acima no seu navegador.

Atenciosamente,
Equipe da Escola Municipal de Saúde`,
            html: `
              <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height:1.6; color:#111;">
                <p>Olá, ${nomeUsuarioEmail}!</p>
                <p>Seu certificado do evento <strong>${titulo}</strong> já está disponível para download.</p>
                <p><a href="${link}" style="display:inline-block; padding:10px 16px; border-radius:8px; text-decoration:none; background:#1b4332; color:#fff;">Baixar certificado</a></p>
                <p style="font-size:14px; color:#444;">
                  Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                  <a href="${link}" style="color:#1b4332;">${link}</a>
                </p>
                <p>Atenciosamente,<br><strong>Equipe da Escola Municipal de Saúde</strong></p>
              </div>
            `,
          });
        } else {
          console.warn("⚠️ Usuário sem e-mail cadastrado:", { usuario_id });
        }
      } catch (e) {
        console.warn("⚠️ Envio de e-mail falhou (ignorado):", e.message);
      }
    }

    return res.status(201).json({
      mensagem: "Certificado gerado com sucesso",
      arquivo: nomeArquivo,
      certificado_id: upsert.rows[0].id,
    });
  } catch (error) {
    console.error("❌ Erro ao gerar certificado:", IS_DEV ? error?.stack || error : error?.message || error);
    if (!res.headersSent) return res.status(500).json({ erro: "Erro ao gerar certificado" });
  }
}

async function listarCertificadoDoUsuario(req, res) {
  const db = getDb(req);
  try {
    const usuario_id = toIntId(req?.usuario?.id ?? req?.user?.id);
    if (!usuario_id) return res.status(401).json({ erro: "Não autenticado." });

    const result = await db.query(
      `SELECT c.id AS certificado_id, c.evento_id, c.arquivo_pdf, c.turma_id, c.tipo,
              e.titulo AS evento, t.data_inicio, t.data_fim
       FROM certificados c
       JOIN eventos e ON e.id = c.evento_id
       JOIN turmas t  ON t.id = c.turma_id
       WHERE c.usuario_id = $1
       ORDER BY c.id DESC`,
      [usuario_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar certificado do usuário:", IS_DEV ? err?.stack || err : err?.message || err);
    return res.status(500).json({ erro: "Erro ao listar certificados do usuário." });
  }
}

async function baixarCertificado(req, res) {
  const db = getDb(req);
  try {
    const id = toIntId(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const q = await db.query(
      `SELECT id, usuario_id, evento_id, turma_id, tipo, arquivo_pdf
         FROM certificados WHERE id = $1`,
      [id]
    );
    if (q.rowCount === 0) return res.status(404).json({ erro: "Certificado não encontrado." });

    const cert = q.rows[0];

    await ensureDir(CERT_DIR);
    let nomeArquivo =
      cert.arquivo_pdf ||
      `certificado_${cert.tipo}_usuario${cert.usuario_id}_evento${cert.evento_id}_turma${cert.turma_id}.pdf`;
    let caminhoArquivo = path.join(CERT_DIR, nomeArquivo);

    if (!fs.existsSync(caminhoArquivo)) {
      logDev("Arquivo ausente; regenerando certificado", { id: cert.id });

      const eventoResult = await db.query(
        `SELECT e.titulo,
                t.nome AS turma_nome,
                t.horario_inicio,
                t.horario_fim,
                t.data_inicio,
                t.data_fim,
                t.carga_horaria
           FROM eventos e
           JOIN turmas t ON t.evento_id = e.id
          WHERE e.id = $1 AND t.id = $2`,
        [cert.evento_id, cert.turma_id]
      );
      if (eventoResult.rowCount === 0) return res.status(404).json({ erro: "Evento/Turma do certificado não encontrados." });

      const TURMA = eventoResult.rows[0];
      const pessoa = await db.query("SELECT nome, cpf FROM usuarios WHERE id = $1", [cert.usuario_id]);
      if (pessoa.rowCount === 0) return res.status(404).json({ erro: "Usuário do certificado não encontrado." });

      const nomeUsuario = pessoa.rows[0].nome;
      const cpfUsuario = formatarCPF(pessoa.rows[0].cpf || "");

      const r = await resumoDatasTurma(cert.turma_id, cert.usuario_id, req);
      const minData = r.min_data || TURMA.data_inicio;
      const maxData = r.max_data || TURMA.data_fim;
      const horasTotal = Number(r.horas_total || 0);

      const ret = await _gerarPdfFisico({
        tipo: cert.tipo,
        usuario_id: cert.usuario_id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        assinaturaBase64: null,
        TURMA,
        nomeUsuario,
        cpfUsuario,
        horasTotal,
        minData,
        maxData,
        req,
      });

      nomeArquivo = ret.nomeArquivo;
      caminhoArquivo = ret.caminho;

      await db.query(`UPDATE certificados SET arquivo_pdf = $1, gerado_em = NOW() WHERE id = $2`, [
        nomeArquivo,
        cert.id,
      ]);
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(caminhoArquivo)}"`);

    return fs.createReadStream(caminhoArquivo).pipe(res);
  } catch (err) {
    console.error("❌ Erro ao baixar certificado:", IS_DEV ? err?.stack || err : err?.message || err);
    return res.status(500).json({ erro: "Erro ao baixar certificado." });
  }
}

async function revalidarCertificado(req, res) {
  const db = getDb(req);
  try {
    const id = toIntId(req.params.id);
    if (!id) return res.status(400).json({ erro: "ID inválido." });

    const result = await db.query(
      `UPDATE certificados SET revalidado_em = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ erro: "Certificado não encontrado." });

    return res.json({ mensagem: "✅ Certificado revalidado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao revalidar certificado:", IS_DEV ? error?.stack || error : error?.message || error);
    return res.status(500).json({ erro: "Erro ao revalidar certificado." });
  }
}

/** 🎓 Elegível (aluno) — formato legado mantido (array) */
async function listarElegivel(req, res) {
  const db = getDb(req);
  try {
    const usuario_id = toIntId(req?.usuario?.id ?? req?.user?.id) || toIntId(req.query?.usuario_id);
    if (!usuario_id) return res.status(400).json({ erro: "usuario_id ausente" });

    const { rows } = await db.query(
      `
      WITH gerado AS (
        SELECT
          c.id                AS certificado_id,
          TRUE                AS ja_gerado,
          c.arquivo_pdf,
          t.id                AS turma_id,
          e.id                AS evento_id,
          e.titulo            AS evento,
          t.nome              AS nome_turma,
          t.data_inicio,
          t.data_fim,
          t.horario_fim
        FROM certificados c
        JOIN turmas   t ON t.id = c.turma_id
        JOIN eventos  e ON e.id = c.evento_id
        WHERE c.usuario_id = $1
          AND c.tipo = 'usuario'
      ),
      encerrada AS (
        SELECT
          t.id AS turma_id,
          t.evento_id,
          t.nome       AS nome_turma,
          t.data_inicio,
          t.data_fim,
          t.horario_fim,
          (now() > (t.data_fim::timestamp + COALESCE(t.horario_fim,'23:59'::time))) AS acabou
        FROM turmas t
      ),
      freq AS (
        SELECT
          p.usuario_id,
          p.turma_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
        FROM presencas p
        WHERE p.usuario_id = $1
          AND p.presente = TRUE
        GROUP BY p.usuario_id, p.turma_id
      ),
      aval AS (
        SELECT DISTINCT turma_id
        FROM avaliacoes
        WHERE usuario_id = $1
      ),
      base AS (
        SELECT
          e.id AS evento_id,
          e.titulo AS evento,
          en.turma_id,
          en.nome_turma,
          en.data_inicio,
          en.data_fim,
          en.horario_fim,
          en.acabou,
          COALESCE(f.dias_presentes,0) AS dias_presentes,
          GREATEST(1, ((en.data_fim::date - en.data_inicio::date) + 1))::int AS dias_total,
          (av.turma_id IS NOT NULL) AS fez_avaliacao
        FROM encerrada en
        JOIN eventos e ON e.id = en.evento_id
        LEFT JOIN freq f ON f.turma_id = en.turma_id AND f.usuario_id = $1
        LEFT JOIN aval av ON av.turma_id = en.turma_id
      ),
      elegivel AS (
        SELECT b.*
        FROM base b
        WHERE b.acabou = TRUE
          AND b.fez_avaliacao = TRUE
          AND (b.dias_presentes::decimal / b.dias_total) >= 0.75
      )
      SELECT
        g.turma_id,
        g.evento_id,
        g.evento,
        g.nome_turma,
        g.data_inicio,
        g.data_fim,
        g.horario_fim,
        g.certificado_id,
        g.ja_gerado,
        g.arquivo_pdf,
        TRUE AS pode_gerar
      FROM gerado g

      UNION ALL

      SELECT
        el.turma_id,
        el.evento_id,
        el.evento,
        el.nome_turma,
        el.data_inicio,
        el.data_fim,
        el.horario_fim,
        NULL::bigint         AS certificado_id,
        FALSE                AS ja_gerado,
        NULL::varchar(255)   AS arquivo_pdf,
        TRUE                 AS pode_gerar
      FROM elegivel el
      WHERE NOT EXISTS (
        SELECT 1 FROM gerado g
        WHERE g.turma_id = el.turma_id AND g.evento_id = el.evento_id
      )
      ORDER BY data_fim DESC, evento_id DESC;
      `,
      [usuario_id]
    );

    return res.json(rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificado elegível:", IS_DEV ? err?.stack || err : err?.message || err);
    return res.status(500).json({ erro: "Erro ao buscar certificados elegíveis." });
  }
}

/** 👩‍🏫 Elegível (instrutor) — turma encerrada */
async function listarInstrutorElegivel(req, res) {
  const db = getDb(req);
  try {
    const instrutor_id = toIntId(req?.usuario?.id ?? req?.user?.id);
    if (!instrutor_id) return res.status(400).json({ erro: "usuario_id ausente" });

    const result = await db.query(
      `
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
        (c.arquivo_pdf IS NOT NULL) AS ja_gerado
      FROM turma_instrutor ti
      JOIN turmas t ON t.id = ti.turma_id
      JOIN eventos e ON e.id = t.evento_id
      LEFT JOIN certificados c
        ON c.usuario_id = $1
       AND c.evento_id = e.id
       AND c.turma_id  = t.id
       AND c.tipo      = 'instrutor'
      WHERE ti.instrutor_id = $1
        AND (now() > (t.data_fim::timestamp + COALESCE(t.horario_fim,'23:59'::time)))
      ORDER BY t.data_fim DESC
      `,
      [instrutor_id]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificado de instrutor elegível:", IS_DEV ? err?.stack || err : err?.message || err);
    return res.status(500).json({ erro: "Erro ao buscar certificados de instrutor elegíveis." });
  }
}

/** ♻️ Reset PDFs/arquivos por turma (público da área técnica) */
async function resetTurma(req, res) {
  const db = getDb(req);
  const id = toIntId(req.params.turmaId);
  if (!id) return res.status(400).json({ erro: "turmaId inválido" });

  try {
    console.log(`[RESET] Limpando certificados da turma ${id}`);

    await ensureDir(CERT_DIR);
    const { rows } = await db.query(
      `SELECT arquivo_pdf FROM certificados WHERE turma_id = $1 AND arquivo_pdf IS NOT NULL`,
      [id]
    );

    for (const r of rows || []) {
      const nome = r.arquivo_pdf;
      if (!nome) continue;
      const p = path.join(CERT_DIR, nome);
      await fsp.unlink(p).catch(() => {});
    }

    await db.query(
      `UPDATE certificados
         SET arquivo_pdf = NULL,
             atualizado_em = NOW()
       WHERE turma_id = $1`,
      [id]
    );

    await db.query("DELETE FROM certificados_cache WHERE turma_id = $1", [id]).catch(() => {});

    console.log(`[RESET] Concluído para turma ${id}`);
    return res.json({ ok: true, turma_id: id, resetado: true });
  } catch (err) {
    console.error("Erro ao resetar certificados:", IS_DEV ? err?.stack || err : err?.message || err);
    return res.status(500).json({ erro: "Falha ao resetar certificados", detalhes: IS_DEV ? err.message : undefined });
  }
}

/* =========================================================================
   Endpoints ADMIN (singular) — incorporados neste controller
=========================================================================== */
/**
 * GET /api/certificado-admin/arvore
 * Retorna árvore: [{ evento_id, evento_titulo, turmas: [{ turma_id, turma_nome, data_inicio, data_fim,
 *   totais: { presentes, emitidos, pendentes },
 *   participantes: [{ usuario_id, nome, email, emitido, certificado_id, arquivo_pdf }] }]}]
 */
async function listarArvore(req, res) {
  const db = getDb(req);
  try {
    const eventoId = toIntId(req.query.eventoId);
    const turmaId = toIntId(req.query.turmaId);

    const eventosTurmasSQL = `
      SELECT
        e.id   AS evento_id,   e.titulo AS evento_titulo,
        t.id   AS turma_id,    t.nome   AS turma_nome,
        t.data_inicio, t.data_fim
      FROM eventos e
      JOIN turmas  t ON t.evento_id = e.id
      WHERE ($1::int IS NULL OR e.id = $1)
        AND ($2::int IS NULL OR t.id = $2)
      ORDER BY e.titulo ASC, t.data_inicio ASC, t.id ASC
    `;
    const et = await db.query(eventosTurmasSQL, [eventoId ?? null, turmaId ?? null]);
    if (et.rowCount === 0) return res.json([]);

    const turmaIds = et.rows.map((r) => r.turma_id);

    const participantesSQL = `
      WITH presente AS (
        SELECT DISTINCT p.turma_id, p.usuario_id
        FROM presencas p
        WHERE p.presente = TRUE
          AND p.turma_id = ANY($1::int[])
      )
      SELECT
        pr.turma_id,
        u.id    AS usuario_id,
        u.nome,
        u.email,
        (c1.id IS NOT NULL) AS emitido,
        c1.id               AS certificado_id,
        c1.arquivo_pdf      AS arquivo_pdf
      FROM presente pr
      JOIN usuarios u ON u.id = pr.usuario_id
      LEFT JOIN LATERAL (
        SELECT c.id, c.arquivo_pdf
        FROM certificados c
        WHERE c.usuario_id = pr.usuario_id
          AND c.turma_id   = pr.turma_id
          AND c.tipo       = 'usuario'
        ORDER BY c.gerado_em DESC NULLS LAST, c.id DESC
        LIMIT 1
      ) c1 ON TRUE
      ORDER BY pr.turma_id ASC, u.nome ASC
    `;
    const part = await db.query(participantesSQL, [turmaIds]);

    const porTurma = new Map();
    for (const r of part.rows || []) {
      const arr = porTurma.get(r.turma_id) || [];
      arr.push({
        usuario_id: r.usuario_id,
        nome: r.nome,
        email: r.email,
        emitido: Boolean(r.emitido),
        certificado_id: r.certificado_id || null,
        arquivo_pdf: r.arquivo_pdf || null,
      });
      porTurma.set(r.turma_id, arr);
    }

    const eventosMap = new Map();
    for (const row of et.rows) {
      const evId = row.evento_id;

      if (!eventosMap.has(evId)) {
        eventosMap.set(evId, {
          evento_id: evId,
          evento_titulo: row.evento_titulo,
          turmas: [],
        });
      }

      const participantes = porTurma.get(row.turma_id) || [];
      const presentes = participantes.length;
      const emitidos = participantes.reduce((acc, p) => acc + (p.emitido ? 1 : 0), 0);
      const pendentes = Math.max(0, presentes - emitidos);

      eventosMap.get(evId).turmas.push({
        turma_id: row.turma_id,
        turma_nome: row.turma_nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        totais: { presentes, emitidos, pendentes },
        participantes,
      });
    }

    return res.json(Array.from(eventosMap.values()));
  } catch (err) {
    console.error("Erro listarArvore:", IS_DEV ? err : err?.message);
    return res.status(500).json({ erro: "Falha ao carregar árvore de certificados." });
  }
}

/**
 * POST /api/certificado-admin/turma/:turmaId/reset
 * Remove PDFs (tipo='usuario') e registros do banco; retorna contagem.
 */
async function resetTurmaAdmin(req, res) {
  const db = getDb(req);
  const turmaId = toIntId(req.params.turmaId);
  if (!turmaId) return res.status(400).json({ erro: "turmaId inválido." });

  try {
    const arquivos = await db.query(
      `
      SELECT id, arquivo_pdf
      FROM certificados
      WHERE turma_id = $1
        AND tipo = 'usuario'
      `,
      [turmaId]
    );

    await ensureDir(CERT_DIR);

    let pdfsRemovidos = 0;
    for (const r of arquivos.rows || []) {
      const nome = r.arquivo_pdf;
      if (!nome) continue;
      const p = path.join(CERT_DIR, nome);
      if (!p.startsWith(path.resolve(CERT_DIR))) continue; // segurança
      const ok = await fsp.unlink(p).then(() => true).catch(() => false);
      if (ok) pdfsRemovidos += 1;
    }

    const del = await db.query(
      `DELETE FROM certificados WHERE turma_id = $1 AND tipo = 'usuario' RETURNING id`,
      [turmaId]
    );

    await db.query("DELETE FROM certificados_cache WHERE turma_id = $1", [turmaId]).catch(() => {});

    return res.json({
      ok: true,
      turma_id: turmaId,
      pdfs_removidos: pdfsRemovidos,
      registros_apagados: del.rowCount,
    });
  } catch (err) {
    console.error("Erro resetTurmaAdmin:", IS_DEV ? err : err?.message);
    return res.status(500).json({ erro: "Falha ao resetar certificados da turma." });
  }
}

/* =========================================================================
   Exports (todos em SINGULAR)
=========================================================================== */
module.exports = {
  // Público
  gerarCertificado,
  listarCertificadoDoUsuario,
  baixarCertificado,
  revalidarCertificado,
  listarElegivel,
  listarInstrutorElegivel,
  resetTurma,
  // Admin (singular)
  listarArvore,
  resetTurmaAdmin,
};
