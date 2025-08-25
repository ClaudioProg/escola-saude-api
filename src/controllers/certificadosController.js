// ✅ src/controllers/certificadosController.js
const db = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const QRCode = require("qrcode");
const { gerarNotificacoesDeCertificado } = require("./notificacoesController");

const IS_DEV = process.env.NODE_ENV !== "production";

/* ========================= Helpers ========================= */

function logDev(...args) {
  if (IS_DEV) console.log(...args);
}

/** 🔢 Formata CPF com segurança */
function formatarCPF(cpf) {
  if (!cpf) return "";
  const puro = String(cpf).replace(/\D/g, "");
  if (puro.length !== 11) return String(cpf);
  return puro.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** 📅 data BR (respeitando fuso São Paulo) */
function dataBR(isoLike) {
  if (!isoLike) return "";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** 📅 data por extenso BR (ex.: 12 de maio de 2025) */
function dataExtensoBR(dateLike = new Date()) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** 🗂️ garante diretório */
async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

/** 🖋️ registra fontes se existirem (não falha se faltarem) */
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
        console.warn(`⚠️ Falha ao registrar fonte ${file}:`, e.message);
      }
    } else {
      logDev(`(certificados) Fonte ausente: ${file}`);
    }
  }
}

/** 🖼️ desenha imagem se existir (não lança) */
function safeImage(doc, absPath, opts = {}) {
  if (absPath && fs.existsSync(absPath)) {
    try {
      doc.image(absPath, opts);
      return true;
    } catch (e) {
      console.warn("⚠️ Erro ao desenhar imagem:", absPath, e.message);
    }
  } else {
    logDev("(certificados) Imagem ausente:", absPath);
  }
  return false;
}

/** 🔎 tenta resolver o primeiro caminho existente dentre várias opções */
function resolveFirstExisting(candidates = []) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

/** 🖼️ resolve o fundo certo (com fallbacks por tipo e por pastas comuns) */
function getFundoPath(tipo) {
  const nomes = [
    tipo === "instrutor" ? "fundo_certificado_instrutor.png" : null,
    "fundo_certificado.png",
  ].filter(Boolean);

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
    for (const root of roots) {
      candidates.push(path.join(root, nome));
    }
    candidates.push(path.resolve(__dirname, nome));
  }

  const found = resolveFirstExisting(candidates);
  if (!found) {
    logDev("⚠️ Fundo não encontrado. Procurado (em ordem):", candidates);
  } else {
    logDev("✅ Fundo encontrado em:", found);
  }
  return found;
}

/** 🔳 gera dataURL de QRCode (retorna null se falhar) */
async function tryQRCodeDataURL(texto) {
  try {
    return await QRCode.toDataURL(texto, { margin: 1, width: 140 });
  } catch (e) {
    console.warn("⚠️ Falha ao gerar QRCode:", e.message);
    return null;
  }
}

/** ✅ checa se usuário fez avaliação da turma */
async function usuarioFezAvaliacao(usuario_id, turma_id) {
  const q = await db.query(
    `SELECT 1 FROM avaliacoes WHERE usuario_id = $1 AND turma_id = $2 LIMIT 1`,
    [usuario_id, turma_id]
  );
  return q.rowCount > 0;
}

/** 📊 resumo de datas da turma (min/max, horas totais, total de aulas e presenças distintas do usuário) */
async function resumoDatasTurma(turma_id, usuario_id) {
  const q = await db.query(
    `
    SELECT
      MIN(d.data) AS min_data,
      MAX(d.data) AS max_data,
      COUNT(d.data) AS total_aulas,
      SUM(
        EXTRACT(EPOCH FROM (
          COALESCE(d.horario_fim::time, '23:59'::time)
          - COALESCE(d.horario_inicio::time, '00:00'::time)
        )) / 3600.0
      ) AS horas_total,
      (
        SELECT COUNT(DISTINCT p.data)
        FROM presencas p
        WHERE p.turma_id = $1 AND p.usuario_id = $2 AND p.presente = TRUE
      ) AS presencas_distintas
    FROM datas_turma d
    WHERE d.turma_id = $1
    `,
    [turma_id, usuario_id]
  );
  return q.rows[0] || {};
}

/* ========================= Controller ========================= */

async function gerarCertificado(req, res) {
  const { usuario_id, evento_id, turma_id, tipo, assinaturaBase64 } = req.body;

  if (!tipo || !["usuario", "instrutor"].includes(tipo)) {
    return res
      .status(400)
      .json({ erro: "Parâmetro 'tipo' inválido (use 'usuario' ou 'instrutor')." });
  }

  try {
    logDev("🔍 Tipo do certificado:", tipo);

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
    const { titulo, horario_inicio, horario_fim, data_inicio, data_fim, carga_horaria } =
      eventoResult.rows[0];

    // 🔎 Usuário/Instrutor
    const pessoa = await db.query("SELECT nome, cpf, email FROM usuarios WHERE id = $1", [
      usuario_id,
    ]);
    if (pessoa.rowCount === 0) {
      return res
        .status(404)
        .json({ erro: tipo === "instrutor" ? "Instrutor não encontrado" : "Usuário não encontrado" });
    }
    const nomeUsuario = pessoa.rows[0].nome;
    const cpfUsuario = formatarCPF(pessoa.rows[0].cpf || "");

    // 📊 Resumo de datas da turma
    const resumo = await resumoDatasTurma(turma_id, usuario_id);
    const minData = resumo.min_data || data_inicio;
    const maxData = resumo.max_data || data_fim;
    const totalAulas = Number(resumo.total_aulas || 0);
    const horasTotal = Number(resumo.horas_total || 0);
    const presencasDistintas = Number(resumo.presencas_distintas || 0);

    // ✅ Garantias de negócio (apenas para tipo 'usuario')
    if (tipo === "usuario") {
      // 1) turma encerrada (usa maxData + horario_fim; se não houver horario_fim para o último dia, considera 23:59)
      const fimStr = maxData ? String(maxData).slice(0, 10) : (data_fim ? String(data_fim).slice(0,10) : null);
      const hf =
        typeof horario_fim === "string" && /^\d{2}:\d{2}/.test(horario_fim)
          ? horario_fim.slice(0, 5)
          : "23:59";
      const fimDT = fimStr ? new Date(`${fimStr}T${hf}:00`) : null;
      if (fimDT && new Date() < fimDT) {
        return res.status(400).json({
          erro: "A turma ainda não encerrou. O certificado só pode ser gerado após o término.",
        });
      }

      // 2) presença ≥ 75% baseada em datas_turma
      const taxa = totalAulas > 0 ? presencasDistintas / totalAulas : 0;
      if (!(taxa >= 0.75)) {
        return res.status(403).json({ erro: "Presença insuficiente (mínimo de 75%)." });
      }

      // 3) avaliação enviada
      const fez = await usuarioFezAvaliacao(usuario_id, turma_id);
      if (!fez) {
        return res.status(403).json({
          erro: "É necessário enviar a avaliação do evento para liberar o certificado.",
          proximo_passo: "Preencha a avaliação disponível nas suas notificações.",
        });
      }
    }

    // 🗓️ Datas (mostradas no certificado)
    const dataInicioBR = dataBR(minData || data_inicio);
    const dataFimBR = dataBR(maxData || data_fim);
    const dataHojeExtenso = dataExtensoBR(new Date());

    // ⏱️ Carga horária (prioriza soma real das datas_turma)
    const cargaTexto = horasTotal > 0 ? horasTotal : carga_horaria;
    const mesmoDia =
      (minData && maxData && String(minData).slice(0,10) === String(maxData).slice(0,10));

    // 📁 pasta de saída
    const pasta = path.join(__dirname, "..", "certificados");
    await ensureDir(pasta);
    const nomeArquivo = `certificado_${tipo}_usuario${usuario_id}_evento${evento_id}_turma${turma_id}.pdf`;
    const caminho = path.join(pasta, nomeArquivo);

    // 🖨️ PDF
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
    const writeStream = fs.createWriteStream(caminho);
    const finished = new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
      doc.on("error", reject);
    });
    doc.pipe(writeStream);

    // 🖋️ Fontes
    registerFonts(doc);

    // 🖼️ Fundo (full-bleed, antes de qualquer texto)
    const fundoPath = getFundoPath(tipo);
    if (fundoPath) {
      doc.save();
      doc.image(fundoPath, 0, 0, { width: doc.page.width, height: doc.page.height });
      doc.restore();
    } else {
      doc.save().rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff").restore();
    }

    // 🏷️ Título
    doc.fillColor("#0b3d2e").font("BreeSerif").fontSize(63).text("CERTIFICADO", { align: "center" });
    doc.y += 20;

    // 🏛️ Cabeçalho
    doc.fillColor("black");
    doc.font("AlegreyaSans-Bold").fontSize(20).text("SECRETARIA MUNICIPAL DE SAÚDE", {
      align: "center",
      lineGap: 4,
    });
    doc.font("AlegreyaSans-Regular").fontSize(15).text("A Escola Municipal de Saúde Pública certifica que:", {
      align: "center",
    });
    doc.moveDown(1);
    doc.y += 20;

    // 👤 Nome (ajuste dinâmico)
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
      doc.font("BreeSerif").fontSize(16).text(`CPF: ${cpfUsuario}`, 0, doc.y - 5, {
        align: "center",
        width: doc.page.width,
      });
    }

    // 📝 Corpo (singular/plural, com carga real)
    const corpoTexto =
      tipo === "instrutor"
        ? (mesmoDia
            ? `Participou como instrutor do evento "${titulo}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
            : `Participou como instrutor do evento "${titulo}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`)
        : (mesmoDia
            ? `Participou do evento "${titulo}", realizado em ${dataInicioBR}, com carga horária total de ${cargaTexto} horas.`
            : `Participou do evento "${titulo}", realizado de ${dataInicioBR} a ${dataFimBR}, com carga horária total de ${cargaTexto} horas.`);

    doc.moveDown(1);
    doc.font("AlegreyaSans-Regular").fontSize(15).text(corpoTexto, 70, doc.y, {
      align: "justify",
      lineGap: 4,
      width: 680,
    });

    // Data
    doc.moveDown(1);
    doc.font("AlegreyaSans-Regular").fontSize(14).text(`Santos, ${dataHojeExtenso}.`, 100, doc.y + 10, {
      align: "right",
      width: 680,
    });

    // ✍️ Assinaturas
    const baseY = 470;

    // Assinatura institucional (sempre)
    if (tipo === "instrutor") {
      doc.font("AlegreyaSans-Bold").fontSize(20).text("Rafaella Pitol Corrêa", 270, baseY, {
        align: "center",
        width: 300,
      });
      doc.font("AlegreyaSans-Regular").fontSize(14).text("Chefe da Escola da Saúde", 270, baseY + 25, {
        align: "center",
        width: 300,
      });
    } else {
      doc.font("AlegreyaSans-Bold").fontSize(20).text("Rafaella Pitol Corrêa", 100, baseY, {
        align: "center",
        width: 300,
      });
      doc.font("AlegreyaSans-Regular").fontSize(14).text("Chefe da Escola da Saúde", 100, baseY + 25, {
        align: "center",
        width: 300,
      });
    }

    // Assinatura enviada pelo usuário (se tipo=usuario)
    if (tipo === "usuario" && assinaturaBase64 && assinaturaBase64.startsWith("data:image")) {
      try {
        const imgBuffer = Buffer.from(assinaturaBase64.split(",")[1], "base64");
        const assinaturaWidth = 150;
        const assinaturaX = 440 + (300 - assinaturaWidth) / 2;
        const assinaturaY = baseY - 25;
        doc.image(imgBuffer, assinaturaX, assinaturaY, { width: assinaturaWidth });
      } catch (e) {
        console.warn("⚠️ Assinatura do usuário inválida:", e.message);
      }
    }

    // Assinatura do instrutor (em certificados de usuário)
    if (tipo === "usuario") {
      let nomeInstrutor = "Instrutor(a)";
      try {
        const assinaturaInstrutor = await db.query(
          `
          SELECT a.imagem_base64, u.nome AS nome_instrutor
          FROM evento_instrutor ei
          JOIN usuarios u ON u.id = ei.instrutor_id
          LEFT JOIN assinaturas a ON a.usuario_id = ei.instrutor_id
          WHERE ei.evento_id = $1
          ORDER BY ei.instrutor_id ASC
          LIMIT 1
        `,
          [evento_id]
        );

        nomeInstrutor = assinaturaInstrutor.rows[0]?.nome_instrutor || "Instrutor(a)";
        const base64Ass = assinaturaInstrutor.rows[0]?.imagem_base64;
        if (base64Ass?.startsWith("data:image")) {
          const imgBuffer = Buffer.from(base64Ass.split(",")[1], "base64");
          const assinaturaWidth = 150;
          const assinaturaX = 440 + (300 - assinaturaWidth) / 2;
          const assinaturaY = baseY - 50;
          doc.image(imgBuffer, assinaturaX, assinaturaY, { width: assinaturaWidth });
        } else {
          logDev("Assinatura Base64 do instrutor ausente.");
        }
      } catch (e) {
        console.warn("⚠️ Erro ao obter assinatura do instrutor:", e.message);
      }

      doc.font("AlegreyaSans-Bold").fontSize(20).text(nomeInstrutor, 440, baseY, {
        align: "center",
        width: 300,
      });
      doc.font("AlegreyaSans-Regular").fontSize(14).text("Instrutor(a)", 440, baseY + 25, {
        align: "center",
        width: 300,
      });
    }

    // 📱 QR de validação (aponta para o FRONTEND)
    const FRONTEND_BASE_URL =
      process.env.FRONTEND_BASE_URL || "https://escoladasaude.vercel.app";
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

    // ✅ UPSERT no banco
    const upsert = await db.query(
      `
      INSERT INTO certificados (usuario_id, evento_id, turma_id, tipo, arquivo_pdf, gerado_em)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (usuario_id, evento_id, turma_id, tipo)
      DO UPDATE SET arquivo_pdf = EXCLUDED.arquivo_pdf, gerado_em = NOW()
      RETURNING id
      `,
      [usuario_id, evento_id, turma_id ?? null, tipo, nomeArquivo]
    );

    // 🔔 Notificação + e-mail (apenas para participante)
    try {
      await gerarNotificacoesDeCertificado(usuario_id);
    } catch (e) {
      console.warn("⚠️ Notificação de certificado falhou (ignorada):", e.message);
    }

    if (tipo === "usuario") {
      try {
        const userRes = await db.query("SELECT email, nome FROM usuarios WHERE id = $1", [
          usuario_id,
        ]);
        const emailUsuario = userRes.rows[0]?.email;
        const nomeUsuarioEmail = userRes.rows[0]?.nome;
        if (emailUsuario) {
          const { send } = require("../utils/email");
          const link = `${FRONTEND_BASE_URL}/meus-certificados`;
          await send({
            to: emailUsuario,
            subject: `🎓 Certificado disponível do evento "${titulo}"`,
            text: `Olá, ${nomeUsuarioEmail}!\n\nSeu certificado do evento "${titulo}" já está disponível para download.\n\nAcesse: ${link}\n\nAtenciosamente,\nEquipe da Escola Municipal de Saúde`,
          });
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
      `
      SELECT 
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
      ORDER BY c.id DESC
      `,
      [usuario_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao listar certificados:", err);
    return res.status(500).json({ erro: "Erro ao listar certificados do usuário." });
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
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }

    const { arquivo_pdf } = result.rows[0];
    const caminhoArquivo = path.join(__dirname, "..", "certificados", arquivo_pdf);
    if (!fs.existsSync(caminhoArquivo)) {
      return res.status(404).json({ erro: "Arquivo do certificado não encontrado." });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${arquivo_pdf}"`);
    fs.createReadStream(caminhoArquivo).pipe(res);
  } catch (err) {
    console.error("❌ Erro ao baixar certificado:", err);
    return res.status(500).json({ erro: "Erro ao baixar certificado." });
  }
}

/** 🔁 Marca certificado como revalidado (auditoria simples) */
async function revalidarCertificado(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query(
      `
      UPDATE certificados
      SET revalidado_em = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: "Certificado não encontrado." });
    }
    return res.json({ mensagem: "✅ Certificado revalidado com sucesso!" });
  } catch (error) {
    console.error("❌ Erro ao revalidar certificado:", error.message);
    return res.status(500).json({ erro: "Erro ao revalidar certificado." });
  }
}

/** 🎓 Certificados elegíveis — presença ≥ 75%, turma encerrada e avaliação feita.
 *  Usa datas_turma quando existir; senão, cai em fallback por diferença de dias.
 */
async function listarCertificadosElegiveis(req, res) {
  const usuario_id = req.usuario.id;

  // ✅ versão usando datas_turma (dias intercalados)
  const queryComDatasTurma = `
    WITH turmas_base AS (
      SELECT t.id AS turma_id, t.evento_id, t.nome AS nome_turma, t.data_inicio, t.data_fim
      FROM turmas t
      WHERE t.data_fim <= CURRENT_DATE
    ),
    total_aulas AS (
      SELECT dt.turma_id, COUNT(*)::int AS total
      FROM datas_turma dt
      GROUP BY dt.turma_id
    ),
    presenca_user AS (
      SELECT p.turma_id,
             COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
      FROM presencas p
      WHERE p.usuario_id = $1 AND p.presente = TRUE
      GROUP BY p.turma_id
    ),
    aval AS (
      SELECT DISTINCT turma_id
      FROM avaliacoes
      WHERE usuario_id = $1
    )
    SELECT 
      tb.turma_id,
      e.id AS evento_id,
      e.titulo AS evento,
      tb.nome_turma,
      tb.data_inicio,
      tb.data_fim,
      c.id AS certificado_id,
      c.arquivo_pdf,
      (c.arquivo_pdf IS NOT NULL) AS ja_gerado,
      (pu.dias_presentes::float / NULLIF(ta.total,0)) >= 0.75 AS presenca_ok,
      (aval.turma_id IS NOT NULL) AS fez_avaliacao,
      ((pu.dias_presentes::float / NULLIF(ta.total,0)) >= 0.75) AND (aval.turma_id IS NOT NULL) AS pode_gerar
    FROM turmas_base tb
    JOIN eventos e ON e.id = tb.evento_id
    LEFT JOIN total_aulas ta    ON ta.turma_id = tb.turma_id
    LEFT JOIN presenca_user pu  ON pu.turma_id = tb.turma_id
    LEFT JOIN aval              ON aval.turma_id = tb.turma_id
    LEFT JOIN certificados c 
      ON c.usuario_id = $1
     AND c.evento_id = e.id
     AND c.turma_id  = tb.turma_id
     AND c.tipo      = 'usuario'
    WHERE ta.total > 0
      AND (pu.dias_presentes::float / NULLIF(ta.total,0)) >= 0.75
      AND aval.turma_id IS NOT NULL
    ORDER BY tb.data_fim DESC
  `;

  // 🛟 fallback: sem datas_turma, usa diferença data_inicio→data_fim (inclusiva)
  const queryFallback = `
    WITH turmas_base AS (
      SELECT t.id AS turma_id, t.evento_id, t.nome AS nome_turma, t.data_inicio, t.data_fim,
             (DATE_PART('day', (t.data_fim::timestamp - t.data_inicio::timestamp))::int + 1) AS total
      FROM turmas t
      WHERE t.data_fim <= CURRENT_DATE
    ),
    presenca_user AS (
      SELECT p.turma_id,
             COUNT(DISTINCT p.data_presenca::date)::int AS dias_presentes
      FROM presencas p
      WHERE p.usuario_id = $1 AND p.presente = TRUE
      GROUP BY p.turma_id
    ),
    aval AS (
      SELECT DISTINCT turma_id
      FROM avaliacoes
      WHERE usuario_id = $1
    )
    SELECT 
      tb.turma_id,
      e.id AS evento_id,
      e.titulo AS evento,
      tb.nome_turma,
      tb.data_inicio,
      tb.data_fim,
      c.id AS certificado_id,
      c.arquivo_pdf,
      (c.arquivo_pdf IS NOT NULL) AS ja_gerado,
      (pu.dias_presentes::float / NULLIF(tb.total,0)) >= 0.75 AS presenca_ok,
      (aval.turma_id IS NOT NULL) AS fez_avaliacao,
      ((pu.dias_presentes::float / NULLIF(tb.total,0)) >= 0.75) AND (aval.turma_id IS NOT NULL) AS pode_gerar
    FROM turmas_base tb
    JOIN eventos e ON e.id = tb.evento_id
    LEFT JOIN presenca_user pu  ON pu.turma_id = tb.turma_id
    LEFT JOIN aval              ON aval.turma_id = tb.turma_id
    LEFT JOIN certificados c 
      ON c.usuario_id = $1
     AND c.evento_id = e.id
     AND c.turma_id  = tb.turma_id
     AND c.tipo      = 'usuario'
    WHERE tb.total > 0
      AND (pu.dias_presentes::float / NULLIF(tb.total,0)) >= 0.75
      AND aval.turma_id IS NOT NULL
    ORDER BY tb.data_fim DESC
  `;

  try {
    try {
      const r = await db.query(queryComDatasTurma, [usuario_id]);
      return res.json(r.rows);
    } catch (e) {
      if (e && e.code === '42P01') {
        const r2 = await db.query(queryFallback, [usuario_id]);
        return res.json(r2.rows);
      }
      throw e;
    }
  } catch (err) {
    console.error("❌ Erro ao buscar certificados elegíveis:", err);
    return res.status(500).json({ erro: "Erro ao buscar certificados elegíveis." });
  }
}

/** 👩‍🏫 Certificados elegíveis (instrutor) — turma encerrada */
async function listarCertificadosInstrutorElegiveis(req, res) {
  try {
    const instrutor_id = req.usuario.id;
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
      FROM evento_instrutor ei
      JOIN eventos e ON e.id = ei.evento_id
      JOIN turmas t ON t.evento_id = e.id
      LEFT JOIN certificados c 
        ON c.usuario_id = $1
       AND c.evento_id = e.id
       AND c.turma_id = t.id
       AND c.tipo = 'instrutor'
      WHERE ei.instrutor_id = $1
        AND to_timestamp(t.data_fim || ' ' || COALESCE(t.horario_fim,'23:59:59'), 'YYYY-MM-DD HH24:MI:SS') < NOW()
      ORDER BY t.data_fim DESC
      `,
      [instrutor_id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar certificados de instrutor elegíveis:", err);
    return res.status(500).json({ erro: "Erro ao buscar certificados de instrutor elegíveis." });
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
