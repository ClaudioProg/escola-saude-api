// ✅ src/controllers/certificadosController.js
/* eslint-disable no-console */
const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const QRCode = require("qrcode");
// (removido) ensureAutoSignature não é necessário aqui
const { gerarNotificacoesDeCertificado } = require("./notificacoesController");
const { CERT_DIR, ensureDir } = require("../paths"); // usar a mesma pasta em gerar/baixar

const IS_DEV = process.env.NODE_ENV !== "production";

/* ========================= Helpers genéricos ========================= */
function logDev(...args) { if (IS_DEV) console.log(...args); }
function formatarCPF(cpf) {
  if (!cpf) return "";
  const puro = String(cpf).replace(/\D/g, "");
  if (puro.length !== 11) return String(cpf);
  return puro.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}
/** 📅 data BR segura (lida com Date, 'YYYY-MM-DD' ou ISO completo) */
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
  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) {
    const y = d2.getFullYear();
    const mm = String(d2.getMonth() + 1).padStart(2, "0");
    const dd = String(d2.getDate()).padStart(2, "0");
    return `${dd}/${mm}/${y}`;
  }
  return s;
}
/** 📅 data por extenso BR (ex.: 12 de maio de 2025) */
function dataExtensoBR(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
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
      try { doc.registerFont(name, p); } catch (e) { console.warn(`⚠️ Fonte ${file}:`, e.message); }
    } else { logDev(`(certificados) Fonte ausente: ${file}`); }
  }
}

function drawSignatureText(doc, rawText, { x, y, w }, {
  maxFont = 34, minFont = 16, font = "AlexBrush", color = "#111"
} = {}) {
  // força uma única linha (remove quebras/acúmulos de espaço)
  const text = String(rawText ?? "").replace(/\s+/g, " ").trim();

  doc.save().font(font);

  // 1) reduz a fonte até o texto caber em w
  let size = maxFont;
  while (size > minFont) {
    doc.fontSize(size);
    const ww = doc.widthOfString(text);
    if (ww <= w) break;
    size -= 1;
  }

  // ───────────────── Assinante da Turma ─────────────────
async function obterAssinanteDaTurma(turmaId) {
  // 1ª tentativa: usar turmas.instrutor_assinante_id (ou o alias legado assinante_instrutor_id)
  const q = await db.query(
    `
    SELECT 
      u.id,
      u.nome,
      a.imagem_base64
    FROM turmas t
    LEFT JOIN usuarios    u ON u.id = COALESCE(t.instrutor_assinante_id, t.assinante_instrutor_id)
    LEFT JOIN assinaturas a ON a.usuario_id = COALESCE(t.instrutor_assinante_id, t.assinante_instrutor_id)
    WHERE t.id = $1
    `,
    [Number(turmaId)]
  );

  if (q.rowCount && q.rows[0]?.id) {
    return {
      id: q.rows[0].id,
      nome: q.rows[0].nome || "Instrutor(a)",
      imagem_base64: q.rows[0].imagem_base64 || null,
      origem: "turma.instrutor_assinante_id",
    };
  }

  // Fallback (em último caso): pegar 1 instrutor da turma
  const fb = await db.query(
    `
    SELECT u.id, u.nome, a.imagem_base64
      FROM turma_instrutor ti
      JOIN usuarios u    ON u.id = ti.instrutor_id
 LEFT JOIN assinaturas a ON a.usuario_id = ti.instrutor_id
     WHERE ti.turma_id = $1
     ORDER BY u.nome
     LIMIT 1
    `,
    [Number(turmaId)]
  );

  if (fb.rowCount) {
    return {
      id: fb.rows[0].id,
      nome: fb.rows[0].nome || "Instrutor(a)",
      imagem_base64: fb.rows[0].imagem_base64 || null,
      origem: "fallback.turma_instrutor",
    };
  }

  // Sem instrutor definido
  return { id: null, nome: "Instrutor(a)", imagem_base64: null, origem: "nenhum" };
}

  // 2) centraliza manualmente dentro da caixa, SEM width e SEM line break
  const ww = doc.widthOfString(text);
  const xCentered = x + Math.max(0, (w - ww) / 2);

  // leve ajuste vertical para suavizar a “altura visual” da AlexBrush
  const textY = y + 25 + Math.max(0, (maxFont - size) / 3);

  // 3) escreve em UMA linha (lineBreak:false evita qualquer quebra)
  doc.fillColor(color).text(text, xCentered, textY, { lineBreak: false });

  doc.restore();
}

function safeImage(doc, absPath, opts = {}) {
  if (absPath && fs.existsSync(absPath)) {
    try { doc.image(absPath, opts); return true; }
    catch (e) { console.warn("⚠️ Erro ao desenhar imagem:", absPath, e.message); }
  } else { logDev("(certificados) Imagem ausente:", absPath); }
  return false;
}
function resolveFirstExisting(candidates = []) {
  for (const p of candidates) try { if (p && fs.existsSync(p)) return p; } catch (_) {}
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
  if (!found) logDev("⚠️ Fundo não encontrado. Procurado (em ordem):", candidates);
  else logDev("✅ Fundo encontrado em:", found);
  return found;
}
async function tryQRCodeDataURL(texto) {
  try { return await QRCode.toDataURL(texto, { margin: 1, width: 140 }); }
  catch (e) { console.warn("⚠️ Falha ao gerar QRCode:", e.message); return null; }
}
async function usuarioFezAvaliacao(usuario_id, turma_id) {
  const q = await db.query(`SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`, [usuario_id, turma_id]);
  return q.rowCount > 0;
}

/* ===== Helpers de “datas reais” (datas_eventos → presenças → intervalo) ===== */
async function _tabelaExiste(nome) {
  const q = await db.query(`SELECT to_regclass($1) IS NOT NULL AS ok;`, [`public.${nome}`]);
  return q?.rows?.[0]?.ok === true;
}
async function _datasDeDatasEventos(turmaId) {
  const has = await _tabelaExiste("datas_eventos");
  if (!has) return [];
  const r = await db.query(`SELECT de.data::date AS d FROM datas_eventos de WHERE de.turma_id = $1 ORDER BY d ASC`, [turmaId]);
  return r.rows.map(x => String(x.d).slice(0,10));
}
async function _datasDePresencas(turmaId) {
  const r = await db.query(`SELECT DISTINCT p.data_presenca::date AS d FROM presencas p WHERE p.turma_id = $1 ORDER BY d ASC`, [turmaId]);
  return r.rows.map(x => String(x.d).slice(0,10));
}
async function _datasDeIntervalo(turmaId) {
  const r = await db.query(`
    WITH t AS (SELECT data_inicio::date di, data_fim::date df FROM turmas WHERE id = $1)
    SELECT gs::date AS d FROM t, generate_series(t.di, t.df, interval '1 day') gs ORDER BY d ASC
  `, [turmaId]);
  return r.rows.map(x => String(x.d).slice(0,10));
}
async function getDatasReaisDaTurma(turmaId) {
  let datas = await _datasDeDatasEventos(turmaId);
  if (!datas.length) datas = await _datasDePresencas(turmaId);
  if (!datas.length) datas = await _datasDeIntervalo(turmaId);
  return Array.from(new Set(datas)).sort();
}
async function contarPresencasDistintasDoUsuario(turmaId, usuarioId) {
  const r = await db.query(
    `SELECT COUNT(DISTINCT p.data_presenca::date) AS c
     FROM presencas p WHERE p.turma_id = $1 AND p.usuario_id = $2 AND p.presente = TRUE`,
    [turmaId, usuarioId]
  );
  return Number(r.rows[0]?.c || 0);
}
function hhmmDiffHoras(hi = "00:00", hf = "23:59") {
  const [h1,m1] = (hi||"00:00").slice(0,5).split(":").map(n=>parseInt(n||"0",10));
  const [h2,m2] = (hf||"23:59").slice(0,5).split(":").map(n=>parseInt(n||"0",10));
  return Math.max(0, (h2*60+m2) - (h1*60+m1)) / 60;
}

/** 📊 Resumo usando datas reais (sem depender de datas_turma) */
async function resumoDatasTurma(turma_id, usuario_id) {
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
        SELECT
          COUNT(DISTINCT p.data_presenca::date)::int AS presencas_distintas
        FROM presencas p
        WHERE p.turma_id = $1
          AND p.usuario_id = $2
          AND p.presente   = TRUE
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
      [turma_id, usuario_id]
    );
    return q.rows[0] || {};
  } catch (e) {
    console.error("[resumoDatasTurma] erro:", e);
    return {};
  }
}

/* ============== Helper central: gerar o PDF fisicamente ============== */
async function _gerarPdfFisico({
  tipo, usuario_id, evento_id, turma_id, assinaturaBase64,
  TURMA, nomeUsuario, cpfUsuario, horasTotal, minData, maxData
}) {
  await ensureDir(CERT_DIR);

  const nomeArquivo = `certificado_${tipo}_usuario${usuario_id}_evento${evento_id}_turma${turma_id}.pdf`;
  const caminho = path.join(CERT_DIR, nomeArquivo);

  // Datas
  const ymd = (v) => {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  };
  const diYmd = ymd(minData || TURMA.data_inicio);
  const dfYmd = ymd(maxData || TURMA.data_fim);
  const mesmoDia = diYmd && diYmd === dfYmd;
  const dataInicioBR    = dataBR(diYmd);
  const dataFimBR       = dataBR(dfYmd);
  const dataHojeExtenso = dataExtensoBR(new Date());
  const cargaTexto      = horasTotal > 0 ? horasTotal : TURMA.carga_horaria;
  const tituloEvento    = TURMA.titulo || "evento";
  const turmaNome =
    TURMA.turma_nome || TURMA.nome_turma || TURMA.nome || `Turma #${turma_id}`;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  const writeStream = fs.createWriteStream(caminho);
  const finished = new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    doc.on("error", reject);
  });
  doc.pipe(writeStream);

  registerFonts(doc);

  // Fundo
  const fundoPath = getFundoPath(tipo);
  if (fundoPath) {
    doc.save();
    doc.image(fundoPath, 0, 0, { width: doc.page.width, height: doc.page.height });
    doc.restore();
  } else {
    doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
  }

  // Título
  doc.fillColor("#0b3d2e")
     .font("BreeSerif").fontSize(63)
     .text("CERTIFICADO", { align: "center" });
  doc.y += 20;

  // Cabeçalho
  doc.fillColor("black");
  doc.font("AlegreyaSans-Bold").fontSize(20)
     .text("SECRETARIA MUNICIPAL DE SAÚDE", { align: "center", lineGap: 4 });
  doc.font("AlegreyaSans-Regular").fontSize(15)
     .text("A Escola Municipal de Saúde Pública certifica que:", { align: "center" });
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
    doc.font("BreeSerif").fontSize(16)
       .text(`CPF: ${cpfUsuario}`, 0, doc.y - 5, { align: "center", width: doc.page.width });
  }

  // Corpo
  const corpoTexto =
    tipo === "instrutor"
      ? (mesmoDia
          ? `Participou como instrutor do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
          : `Participou como instrutor do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`)
      : (mesmoDia
          ? `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
          : `Participou do evento "${tituloEvento}" - "${turmaNome}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`);

  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(15)
     .text(corpoTexto, 70, doc.y, { align: "justify", lineGap: 4, width: 680 });

  // Data de emissão
  doc.moveDown(1);
  doc.font("AlegreyaSans-Regular").fontSize(14)
     .text(`Santos, ${dataHojeExtenso}.`, 100, doc.y + 10, { align: "right", width: 680 });

  /* ---------------- Assinaturas / Identificação ---------------- */
  const baseY = 470;

  if (tipo === "instrutor") {
    // ✅ INSTRUTOR: somente a identificação institucional CENTRALIZADA
    const CENTER_W = 360;
    const CENTER_X = (doc.page.width - CENTER_W) / 2;

    doc.font("AlegreyaSans-Bold").fontSize(20)
       .text("Rafaella Pitol Corrêa", CENTER_X, baseY, { align: "center", width: CENTER_W });
    doc.font("AlegreyaSans-Regular").fontSize(14)
       .text("Chefe da Escola da Saúde", CENTER_X, baseY + 25, { align: "center", width: CENTER_W });

    // (A assinatura dela já está no background; não desenhamos nenhuma outra)
  } else {
    // ✅ PARTICIPANTE: Rafaella à esquerda (somente texto) + instrutor à direita
    const LEFT  = { x: 100, w: 300 };
    const RIGHT = { x: 440, w: 300 };

    // Esquerda: Rafaella (apenas texto; a assinatura está no fundo)
    doc.font("AlegreyaSans-Bold").fontSize(20)
       .text("Rafaella Pitol Corrêa", LEFT.x, baseY, { align: "center", width: LEFT.w });
    doc.font("AlegreyaSans-Regular").fontSize(14)
       .text("Chefe da Escola da Saúde", LEFT.x, baseY + 25, { align: "center", width: LEFT.w });

   // Direita: instrutor-assinante da TURMA (fonte única oficial)
let nomeInstrutor = "Instrutor(a)";
let assinaturaInstrutorBase64 = null;
try {
  const assinante = await obterAssinanteDaTurma(Number(turma_id));
  nomeInstrutor = assinante.nome || nomeInstrutor;
  assinaturaInstrutorBase64 = assinante.imagem_base64 || null;
  logDev("[certificados] Assinante TURMA:", assinante.origem, nomeInstrutor ? "ok" : "vazio");
} catch (e) {
  console.warn("⚠️ Erro ao obter assinante da turma:", e.message);
}

    const SIGN_W = 150;
    const signX = RIGHT.x + (RIGHT.w - SIGN_W) / 2;
    const signY = baseY - 50;
    const SIGN_BOX = { x: signX, y: signY, w: SIGN_W };

    let desenhouAssinatura = false;
    if (assinaturaInstrutorBase64 && /^data:image\/(png|jpe?g|webp);base64,/.test(assinaturaInstrutorBase64)) {
      try {
        const buf = Buffer.from(assinaturaInstrutorBase64.split(",")[1], "base64");
        // imagem dentro do mesmo box (largura fixa)
        doc.image(buf, SIGN_BOX.x, SIGN_BOX.y, { width: SIGN_BOX.w });
        desenhouAssinatura = true;
      } catch (e) {
        console.warn("⚠️ Assinatura do instrutor inválida (fallback cursivo):", e.message);
      }
    }
    if (!desenhouAssinatura) {
      // ✍️ sempre caberá dentro do SIGN_W
      drawSignatureText(doc, nomeInstrutor, SIGN_BOX, { maxFont: 34, minFont: 16 });
    }

    // Nome impresso e cargo (sempre)
    doc.font("AlegreyaSans-Bold").fontSize(20)
       .text(nomeInstrutor, RIGHT.x, baseY, { align: "center", width: RIGHT.w });
    doc.font("AlegreyaSans-Regular").fontSize(14)
       .text("Instrutor(a)", RIGHT.x, baseY + 25, { align: "center", width: RIGHT.w });
  }

  // QR Code (validação)
  const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "https://escoladasaude.vercel.app";
  const linkValidacao =
    `${FRONTEND_BASE_URL}/validar-certificado.html` +
    `?usuario_id=${encodeURIComponent(usuario_id)}` +
    `&evento_id=${encodeURIComponent(evento_id)}` +
    `&turma_id=${encodeURIComponent(turma_id)}`;
  const qrDataURL = await tryQRCodeDataURL(linkValidacao);
  if (qrDataURL) {
    doc.image(qrDataURL, 40, 420, { width: 80 });
    doc.fillColor("#000").fontSize(7).text("Escaneie este QR Code", 40, 510);
    doc.text("para validar o certificado.", 40, 520);
  }

  doc.end();
  await finished;

  return { nomeArquivo, caminho };
}

/* ========================= Gerar Certificado ========================= */
async function gerarCertificado(req, res) {
  const { usuario_id, evento_id, turma_id, tipo, assinaturaBase64 } = req.body;

  // 🔐 validações básicas
  if (!usuario_id || !evento_id || !turma_id) {
    return res.status(400).json({ erro: "Parâmetros obrigatórios: usuario_id, evento_id, turma_id." });
  }
  if (!Number.isFinite(Number(usuario_id)) || !Number.isFinite(Number(evento_id)) || !Number.isFinite(Number(turma_id))) {
    return res.status(400).json({ erro: "IDs inválidos." });
  }
  if (!tipo || !["usuario", "instrutor"].includes(tipo)) {
    return res.status(400).json({ erro: "Parâmetro 'tipo' inválido (use 'usuario' ou 'instrutor')." });
  }

  try {
    logDev("🔍 Tipo do certificado:", tipo);

    // Evento + Turma
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
      [Number(evento_id), Number(turma_id)]
    );
    if (eventoResult.rowCount === 0) {
      return res.status(404).json({ erro: "Evento ou turma não encontrados." });
    }
    const TURMA = eventoResult.rows[0];

    // Usuário
    const pessoa = await db.query("SELECT nome, cpf, email FROM usuarios WHERE id = $1", [
      Number(usuario_id),
    ]);
    if (pessoa.rowCount === 0) {
      return res
        .status(404)
        .json({ erro: tipo === "instrutor" ? "Instrutor não encontrado." : "Usuário não encontrado." });
    }
    const nomeUsuario = pessoa.rows[0].nome;
    const cpfUsuario = formatarCPF(pessoa.rows[0].cpf || "");

    // 🔐 Regras/autorizações por tipo
    if (tipo === "instrutor") {
      // ✅ precisa estar vinculado à TURMA
      const vinc = await db.query(
        `SELECT 1 FROM turma_instrutor WHERE turma_id = $1 AND instrutor_id = $2 LIMIT 1`,
        [Number(turma_id), Number(usuario_id)]
      );
      if (vinc.rowCount === 0) {
        return res.status(403).json({ erro: "Você não está vinculado como instrutor nesta turma." });
      }
      // turma deve estar encerrada
      const fimTS = new Date(`${String(TURMA.data_fim).slice(0,10)}T${(TURMA.horario_fim || "23:59").slice(0,5)}:00`);
      if (Number.isFinite(fimTS.getTime()) && new Date() < fimTS) {
        return res.status(400).json({ erro: "A turma ainda não encerrou para emissão do certificado de instrutor." });
      }
    }

    // ---------- Resumo/datas/horas ----------
    async function getResumoTurmaSegura() {
      try {
        const r = await db.query(
          `
          WITH dt AS (
            SELECT 
              data::date            AS d,
              horario_inicio::time  AS hi,
              horario_fim::time     AS hf
            FROM datas_turma
            WHERE turma_id = $1
          ),
          base AS (
            SELECT
              MIN(d) AS min_data,
              MAX(d) AS max_data,
              COUNT(*)::int AS total_aulas,
              SUM(EXTRACT(EPOCH FROM (COALESCE(hf,'23:59'::time)-COALESCE(hi,'00:00'::time))) / 3600.0) AS horas_total
            FROM dt
          ),
          pres AS (
            SELECT COUNT(DISTINCT p.data_presenca::date)::int AS presencas_distintas
            FROM presencas p
            WHERE p.turma_id = $1 AND p.usuario_id = $2 AND p.presente = TRUE
          )
          SELECT
            COALESCE(base.min_data, NULL)         AS min_data,
            COALESCE(base.max_data, NULL)         AS max_data,
            COALESCE(base.total_aulas, 0)         AS total_aulas,
            COALESCE(base.horas_total, 0)         AS horas_total,
            COALESCE(pres.presencas_distintas,0)  AS presencas_distintas
          FROM base LEFT JOIN pres ON TRUE
          `,
          [Number(turma_id), Number(usuario_id)]
        );
        if (r.rows?.length && (r.rows[0].min_data || r.rows[0].max_data)) return r.rows[0];
      } catch (e) {
        if (e?.code !== "42P01") throw e;
      }
      const r2 = await db.query(
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
        [Number(turma_id), Number(usuario_id)]
      );
      return r2.rows[0] || {};
    }

    const resumo = await getResumoTurmaSegura();
    const minData = resumo.min_data || TURMA.data_inicio;
    const maxData = resumo.max_data || TURMA.data_fim;
    const totalAulas = Number(resumo.total_aulas || 0);
    const horasTotal = Number(resumo.horas_total || 0);
    const presencasDistintas = Number(resumo.presencas_distintas || 0);

    // ---------- Regras de negócio (participante) ----------
    if (tipo === "usuario") {
      const fimStr = (maxData || TURMA.data_fim ? String(maxData || TURMA.data_fim).slice(0,10) : null);
      const hf =
        typeof TURMA.horario_fim === "string" && /^\d{2}:\d{2}/.test(TURMA.horario_fim)
          ? TURMA.horario_fim.slice(0, 5)
          : "23:59";
      const fimDT = fimStr ? new Date(`${fimStr}T${hf}:00`) : null;

      if (fimDT && new Date() < fimDT) {
        return res.status(400).json({ erro: "A turma ainda não encerrou. O certificado só pode ser gerado após o término." });
      }

      const taxa = totalAulas > 0 ? presencasDistintas / totalAulas : 0;
      if (!(taxa >= 0.75)) {
        return res.status(403).json({ erro: "Presença insuficiente (mínimo de 75%)." });
      }

      const fez = await usuarioFezAvaliacao(Number(usuario_id), Number(turma_id));
      if (!fez) {
        return res.status(403).json({
          erro: "É necessário enviar a avaliação do evento para liberar o certificado.",
          proximo_passo: "Preencha a avaliação disponível nas suas notificações.",
        });
      }
    }

    // ---------- Geração física ----------
    const { nomeArquivo } = await _gerarPdfFisico({
      tipo, usuario_id, evento_id, turma_id, assinaturaBase64,
      TURMA, nomeUsuario, cpfUsuario, horasTotal, minData, maxData
    });

    // Upsert do certificado
    const upsert = await db.query(
      `
      INSERT INTO certificados (usuario_id, evento_id, turma_id, tipo, arquivo_pdf, gerado_em)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (usuario_id, evento_id, turma_id, tipo)
      DO UPDATE SET arquivo_pdf = EXCLUDED.arquivo_pdf, gerado_em = NOW()
      RETURNING id
      `,
      [Number(usuario_id), Number(evento_id), Number(turma_id), tipo, nomeArquivo]
    );

    // Notificação (focada na turma)
    try {
      await gerarNotificacoesDeCertificado(Number(usuario_id), Number(turma_id));
    } catch (e) {
      console.warn("⚠️ Notificação de certificado falhou (ignorada):", e?.message || e);
    }

    // E-mail (participante)
    if (tipo === "usuario") {
      try {
        const { rows } = await db.query(
          "SELECT email, nome FROM usuarios WHERE id = $1",
          [Number(usuario_id)]
        );
        const emailUsuario = rows[0]?.email?.trim();
        const nomeUsuarioEmail = rows[0]?.nome?.trim() || "Aluno(a)";
        if (emailUsuario) {
          const { send } = require("../utils/email");
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
    console.error("❌ Erro ao gerar certificado:", error?.stack || error);
    if (!res.headersSent) {
      return res.status(500).json({ erro: "Erro ao gerar certificado" });
    }
  }
}

/* ========================= Outros endpoints ========================= */
async function listarCertificadosDoUsuario(req, res) {
  try {
    const usuario_id = Number(req?.usuario?.id ?? req?.user?.id);
    const result = await db.query(
      `SELECT c.id AS certificado_id, c.evento_id, c.arquivo_pdf, c.turma_id, c.tipo,
              e.titulo AS evento, t.data_inicio, t.data_fim
       FROM certificados c
       JOIN eventos e ON e.id = c.evento_id
       JOIN turmas t  ON t.id = c.turma_id
       WHERE c.usuario_id = $1
       ORDER BY c.id DESC`, [Number(usuario_id)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar certificados:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao listar certificados do usuário." });
  }
}

/* 🔁 Baixar com autoreparo: se não houver arquivo, regera e atualiza */
async function baixarCertificado(req, res) {
  try {
    const { id } = req.params;

    const q = await db.query(
      `SELECT id, usuario_id, evento_id, turma_id, tipo, arquivo_pdf
         FROM certificados WHERE id = $1`,
      [Number(id)]
    );
    if (q.rowCount === 0) return res.status(404).json({ erro: "Certificado não encontrado." });

    const cert = q.rows[0];

    // Caminho físico atual
    await ensureDir(CERT_DIR);
    let nomeArquivo = cert.arquivo_pdf || `certificado_${cert.tipo}_usuario${cert.usuario_id}_evento${cert.evento_id}_turma${cert.turma_id}.pdf`;
    let caminhoArquivo = path.join(CERT_DIR, nomeArquivo);

    // Se não existe, regera usando as regras atuais
    if (!fs.existsSync(caminhoArquivo)) {
      logDev("📄 Arquivo ausente; regenerando certificado", { id: cert.id });

      // Carrega dados
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
      if (eventoResult.rowCount === 0) {
        return res.status(404).json({ erro: "Evento/Turma do certificado não encontrados." });
      }
      const TURMA = eventoResult.rows[0];

      const pessoa = await db.query("SELECT nome, cpf FROM usuarios WHERE id = $1", [cert.usuario_id]);
      if (pessoa.rowCount === 0) {
        return res.status(404).json({ erro: "Usuário do certificado não encontrado." });
      }
      const nomeUsuario = pessoa.rows[0].nome;
      const cpfUsuario = formatarCPF(pessoa.rows[0].cpf || "");

      // Resumo para horas/datas
      const r = await resumoDatasTurma(cert.turma_id, cert.usuario_id);
      const minData = r.min_data || TURMA.data_inicio;
      const maxData = r.max_data || TURMA.data_fim;
      const horasTotal = Number(r.horas_total || 0);

      // (assinatura institucional não é necessária para autoreparo)
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
      });

      nomeArquivo = ret.nomeArquivo;
      caminhoArquivo = ret.caminho;

      // Atualiza o banco com o nome correto
      await db.query(
        `UPDATE certificados SET arquivo_pdf = $1, gerado_em = NOW() WHERE id = $2`,
        [nomeArquivo, cert.id]
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(caminhoArquivo)}"`);
    fs.createReadStream(caminhoArquivo).pipe(res);
  } catch (err) {
    console.error("❌ Erro ao baixar certificado:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao baixar certificado." });
  }
}

async function revalidarCertificado(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE certificados SET revalidado_em = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`, [Number(id)]
    );
    if (result.rowCount === 0) return res.status(404).json({ erro: "Certificado não encontrado." });
    return res.json({ mensagem: "✅ Certificado revalidado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao revalidar certificado:", error?.stack || error);
    return res.status(500).json({ erro: "Erro ao revalidar certificado." });
  }
}

/** 🎓 Elegíveis (aluno) — mantém formato legado (array direto) */
async function listarCertificadosElegiveis(req, res) {
  try {
    // 🔧 Tolerante a req.usuario || req.user || ?usuario_id
    const usuario_id =
      Number(req?.usuario?.id ?? req?.user?.id) ||
      Number(req.query?.usuario_id);

    if (!usuario_id) {
      return res.status(400).json({ erro: "usuario_id ausente" });
    }

    const { rows } = await db.query(
      `
      /* ---------------------- JÁ GERADOS ---------------------- */
      WITH gerados AS (
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
      /* ---------------------- BASE / ELEGÍVEIS ---------------------- */
      encerradas AS (
        SELECT
          t.id AS turma_id,
          t.evento_id,
          t.nome       AS nome_turma,
          t.data_inicio,
          t.data_fim,
          t.horario_fim,
          ((t.data_fim::text || ' ' || COALESCE(t.horario_fim,'23:59'))::timestamp < NOW()) AS acabou
        FROM turmas t
      ),
      freq AS (
        SELECT
          p.usuario_id,
          p.turma_id,
          COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes,
          COUNT(DISTINCT p.data_presenca::date)::int AS encontros_realizados
        FROM presencas p
        WHERE p.usuario_id = $1
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
          COALESCE(f.dias_presentes,0)       AS dias_presentes,
          COALESCE(f.encontros_realizados,0) AS encontros_realizados,
          CASE WHEN COALESCE(f.encontros_realizados,0)=0
               THEN 0
               ELSE (f.dias_presentes::decimal / f.encontros_realizados) END AS freq_rel,
          (av.turma_id IS NOT NULL)          AS fez_avaliacao
        FROM encerradas en
        JOIN eventos e ON e.id = en.evento_id
        LEFT JOIN freq f ON f.turma_id = en.turma_id AND f.usuario_id = $1
        LEFT JOIN aval av ON av.turma_id = en.turma_id
      ),
      elegiveis AS (
        SELECT b.*
        FROM base b
        WHERE b.acabou = TRUE
          AND b.fez_avaliacao = TRUE
          AND b.freq_rel >= 0.75
      )

      /* --------------- RESULTADO FINAL --------------- */
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
      FROM gerados g

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
      FROM elegiveis el
      WHERE NOT EXISTS (
        SELECT 1 FROM gerados g
        WHERE g.turma_id = el.turma_id AND g.evento_id = el.evento_id
      )
      ORDER BY data_fim DESC, evento_id DESC;
      `,
      [usuario_id]
    );

    return res.json(rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificados elegíveis:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar certificados elegíveis." });
  }
}

/** 👩‍🏫 Elegíveis (instrutor) — turma encerrada */
async function listarCertificadosInstrutorElegiveis(req, res) {
  try {
    const instrutor_id =
      Number(req?.usuario?.id ?? req?.user?.id);
    if (!instrutor_id) {
      return res.status(400).json({ erro: "usuario_id ausente" });
    }
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
       AND (t.data_fim::text || ' ' || COALESCE(t.horario_fim,'23:59'))::timestamp < NOW()
     ORDER BY t.data_fim DESC
      `,
      [instrutor_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificados de instrutor elegíveis:", err?.stack || err);
    return res.status(500).json({ erro: "Erro ao buscar certificados de instrutor elegíveis." });
  }
}

/* =========================================================
   🔄 Resetar certificados gerados de uma turma
   ========================================================= */
async function resetTurma(req, res) {
  const { turmaId } = req.params;
  const id = Number(turmaId);
  if (!id) return res.status(400).json({ erro: "turmaId inválido" });

  try {
    console.log(`[RESET] Limpando certificados da turma ${id}`);

    // 🧹 1) Apaga PDFs físicos (se existirem)
    const pasta = path.join(CERT_DIR, "turmas", String(id));
    await fsp.rm(pasta, { recursive: true, force: true });

    // 🗑️ 2) Limpa registros do banco
    await db.query(
      `UPDATE certificados
         SET arquivo_pdf = NULL,
             atualizado_em = NOW()
       WHERE turma_id = $1`,
      [id]
    );

    // (opcional) limpa cache
    await db.query("DELETE FROM certificados_cache WHERE turma_id = $1", [id]).catch(() => {});

    console.log(`[RESET] Concluído para turma ${id}`);
    res.json({ ok: true, turma_id: id, resetado: true });
  } catch (err) {
    console.error("Erro ao resetar certificados:", err);
    res.status(500).json({ erro: "Falha ao resetar certificados", detalhes: err.message });
  }
}

module.exports = {
  gerarCertificado,
  listarCertificadosDoUsuario,
  baixarCertificado,
  revalidarCertificado,
  listarCertificadosElegiveis,
  listarCertificadosInstrutorElegiveis,
  resetTurma,
};
