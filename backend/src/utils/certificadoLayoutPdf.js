"use strict";

/**
 * ✅ backend/src/utils/certificadoLayoutPdf.js — v2.7
 * Atualizado em: 28/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Template programático premium para certificados PDF.
 * - Certificado institucional oficial em 1 página A4 horizontal.
 *
 * Diretrizes v2.7:
 * - Layout premium refinado a partir da v2.6.
 * - Brasão de Santos no topo esquerdo.
 * - Logo da Escola da Saúde no topo direito.
 * - Cabeçalho centralizado, leve e institucional.
 * - Título menor, mais equilibrado e com respiro melhor.
 * - Nome com destaque nobre.
 * - Texto central com mais altura, leitura e presença.
 * - Assinaturas com área elegante, sem divisor vertical central.
 * - Rodapé verde premium com QR, número, código, URL e imagem institucional externa.
 * - Textos do rodapé compactados verticalmente para não encostar na borda.
 * - Sem desenho vetorial infantil no rodapé.
 * - Sem page-break automático.
 * - Compatível com certificados regulares, organizador, palestrante e avulso.
 * - Suporta de 1 a 3 assinaturas oficiais.
 *
 * Contrato preservado:
 * - desenharCertificadoCompletoV2(doc, options)
 * - desenharAssinaturas(doc, assinaturas, options)
 * - normalizarAssinaturasLayout(assinaturas)
 * - dataUrlToBuffer(value)
 */

const fs = require("fs");
const path = require("path");

const CORES = {
  verdeNoite: "#052e24",
  verdeProfundo: "#0b3b2e",
  verdeInstitucional: "#104936",
  verdeMedio: "#1e6f54",
  verdeSuave: "#e8f3ee",

  ouro: "#b8872b",
  ouroEscuro: "#80601f",
  ouroClaro: "#ead8a8",
  ouroPale: "#f4ead0",

  papel: "#fffaf0",
  papelClaro: "#fffdf7",
  papelSombra: "#f6edd9",

  texto: "#17231f",
  textoSuave: "#53645d",
  textoMuted: "#6f7e77",

  linha: "#c9b27d",
  linhaVerde: "#9fb9ad",

  branco: "#ffffff",
  preto: "#111827",
};

function safeText(value, max = 5000) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function dataUrlToBuffer(value) {
  const raw = String(value || "");

  if (!raw.startsWith("data:image")) return null;

  const parts = raw.split(",");

  if (parts.length < 2) return null;

  try {
    return Buffer.from(parts[1], "base64");
  } catch {
    return null;
  }
}

function setFont(doc, fontName, fallback = "Helvetica") {
  try {
    doc.font(fontName || fallback);
  } catch {
    doc.font(fallback);
  }
}

function fontSet(fonts = {}) {
  return {
    regular: fonts.regular || "AlegreyaSans-Regular",
    bold: fonts.bold || "AlegreyaSans-Bold",
    serif: fonts.serif || "BreeSerif",
    script: fonts.script || "AlexBrush",
  };
}

function drawNoBreakText(doc, text, x, y, options = {}) {
  const clean = safeText(text, options.max || 500);

  if (!clean) return;

  doc.text(clean, x, y, {
    ...options,
    lineBreak: false,
    ellipsis: true,
  });
}

function drawFitText(doc, text, options = {}) {
  const {
    x,
    y,
    width,
    height,
    font,
    fallbackFont = "Helvetica",
    maxSize = 30,
    minSize = 8,
    align = "center",
    color = CORES.preto,
    lineGap = 1.8,
    characterSpacing,
    ellipsis = false,
  } = options;

  const clean = safeText(text);

  if (!clean) return { fontSize: maxSize, height: 0 };

  let size = maxSize;

  setFont(doc, font, fallbackFont);

  while (size > minSize) {
    doc.fontSize(size);

    const measuredHeight = doc.heightOfString(clean, {
      width,
      align,
      lineGap,
      characterSpacing,
    });

    const measuredWidth = doc.widthOfString(clean, {
      characterSpacing,
    });

    const fitsHeight = !height || measuredHeight <= height;
    const fitsWidth =
      align !== "center" || measuredWidth <= width || measuredHeight <= height;

    if (fitsHeight && fitsWidth) break;

    size -= 0.8;
  }

  doc.fillColor(color).fontSize(size).text(clean, x, y, {
    width,
    height,
    align,
    lineGap,
    characterSpacing,
    ellipsis,
  });

  return {
    fontSize: size,
    height: doc.heightOfString(clean, {
      width,
      align,
      lineGap,
      characterSpacing,
    }),
  };
}

function maybeLoadImageBuffer(value) {
  if (!value) return null;

  if (Buffer.isBuffer(value)) return value;

  const fromDataUrl = dataUrlToBuffer(value);
  if (fromDataUrl) return fromDataUrl;

  const filePath = String(value || "").trim();
  if (!filePath) return null;

  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch {
    return null;
  }

  return null;
}

function resolveAssetPath(...segments) {
  return path.resolve(__dirname, ...segments);
}

function localizarImagem(options = {}, tipo = "brasao") {
  const envMap = {
    brasao: "CERT_BRASAO_PATH",
    escola: "CERT_ESCOLA_LOGO_PATH",
    rodape: "CERT_RODAPE_PATH",
  };

  const optionKeys = {
    brasao: ["brasaoBuffer", "brasaoPath", "logoBuffer", "logoPath"],
    escola: [
      "escolaLogoBuffer",
      "escolaLogoPath",
      "logoEscolaBuffer",
      "logoEscolaPath",
    ],
    rodape: ["rodapeBuffer", "rodapePath", "footerBuffer", "footerPath"],
  };

  for (const key of optionKeys[tipo] || []) {
    const buffer = maybeLoadImageBuffer(options[key]);
    if (buffer) return buffer;
  }

  const envPath = process.env[envMap[tipo]] || "";

  const candidatos = {
    brasao: [
      envPath,
      resolveAssetPath("../assets/brasao-santos.png"),
      resolveAssetPath("../../assets/brasao-santos.png"),
      path.resolve(process.cwd(), "backend/src/assets/brasao-santos.png"),
      path.resolve(process.cwd(), "src/assets/brasao-santos.png"),
    ],
    escola: [
      envPath,
      resolveAssetPath("../assets/escola-saude.png"),
      resolveAssetPath("../../assets/escola-saude.png"),
      resolveAssetPath("../assets/logo-escola-saude.png"),
      resolveAssetPath("../../assets/logo-escola-saude.png"),
      path.resolve(process.cwd(), "backend/src/assets/escola-saude.png"),
      path.resolve(process.cwd(), "backend/src/assets/logo-escola-saude.png"),
      path.resolve(process.cwd(), "src/assets/escola-saude.png"),
      path.resolve(process.cwd(), "src/assets/logo-escola-saude.png"),
    ],
    rodape: [
      envPath,
      resolveAssetPath("../assets/estacao.png"),
      resolveAssetPath("../../assets/estacao.png"),
      resolveAssetPath("../assets/rodape-santos.png"),
      resolveAssetPath("../../assets/rodape-santos.png"),
      path.resolve(process.cwd(), "backend/src/assets/estacao.png"),
      path.resolve(process.cwd(), "backend/src/assets/rodape-santos.png"),
      path.resolve(process.cwd(), "src/assets/estacao.png"),
      path.resolve(process.cwd(), "src/assets/rodape-santos.png"),
    ],
  }[tipo];

  for (const candidato of candidatos.filter(Boolean)) {
    const buffer = maybeLoadImageBuffer(candidato);
    if (buffer) return buffer;
  }

  return null;
}

function desenharPapel(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  doc.save();

  doc.rect(0, 0, pageW, pageH).fill(CORES.verdeNoite);

  doc
    .roundedRect(18, 18, pageW - 36, pageH - 36, 22)
    .fillColor(CORES.papelSombra)
    .fill();

  doc
    .roundedRect(26, 26, pageW - 52, pageH - 52, 18)
    .fillColor(CORES.papel)
    .fill();

  doc.save();
  doc.opacity(0.075);
  doc.strokeColor("#d9cda9").lineWidth(0.28);

  for (let y = 34; y < pageH - 34; y += 7) {
    doc
      .moveTo(34, y + Math.sin(y) * 0.45)
      .lineTo(pageW - 34, y + Math.cos(y) * 0.35)
      .stroke();
  }

  doc.restore();
  doc.restore();
}

function desenharCantosOrnamentais(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  doc.save();

  const x1 = 40;
  const y1 = 38;
  const x2 = pageW - 40;
  const y2 = pageH - 38;

  doc.strokeColor(CORES.ouro).lineWidth(1.3);

  function canto(x, y, sx, sy) {
    doc.save();
    doc.translate(x, y);
    doc.scale(sx, sy);

    doc
      .moveTo(0, 32)
      .bezierCurveTo(4, 17, 17, 4, 32, 0)
      .stroke();

    doc
      .moveTo(9, 35)
      .bezierCurveTo(12, 23, 23, 12, 35, 9)
      .stroke();

    doc.moveTo(6, 47).lineTo(0, 60).lineTo(14, 54).stroke();

    doc.circle(37, 5, 1.5).fillColor(CORES.ouro).fill();
    doc.circle(20, 19, 1.1).fillColor(CORES.ouro).fill();

    doc.restore();
  }

  canto(x1, y1, 1, 1);
  canto(x2, y1, -1, 1);
  canto(x1, y2, 1, -1);
  canto(x2, y2, -1, -1);

  doc.restore();
}

function desenharMoldura(doc, options = {}) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const fonts = fontSet(options.fonts);

  desenharPapel(doc);

  doc.save();

  doc
    .roundedRect(28, 24, pageW - 56, pageH - 48, 22)
    .strokeColor(CORES.ouro)
    .lineWidth(2.2)
    .stroke();

  doc
    .roundedRect(34, 30, pageW - 68, pageH - 60, 18)
    .strokeColor(CORES.verdeProfundo)
    .lineWidth(2.4)
    .stroke();

  doc
    .roundedRect(46, 42, pageW - 92, pageH - 84, 12)
    .strokeColor("#dbc487")
    .lineWidth(0.9)
    .stroke();

  doc.strokeColor("#efe1b8").lineWidth(0.6);
  doc.roundedRect(54, 50, pageW - 108, pageH - 100, 9).stroke();

  desenharCantosOrnamentais(doc);

  doc.save();
  doc.opacity(0.022);
  setFont(doc, fonts.serif, "Helvetica-Bold");
  doc.fillColor(CORES.verdeProfundo).fontSize(100).text("EMSP", 0, 296, {
    width: pageW,
    align: "center",
    lineBreak: false,
    characterSpacing: 4,
  });
  doc.restore();

  doc.save();
  doc.opacity(0.028);
  doc.strokeColor(CORES.verdeProfundo).lineWidth(1);
  doc.circle(pageW / 2, 336, 80).stroke();
  doc.circle(pageW / 2, 336, 60).stroke();
  doc.restore();

  const modelo = options.modelo || "padrao";
  const seloTexto =
    modelo === "organizador"
      ? "ORGANIZADOR"
      : modelo === "palestrante"
        ? "PALESTRANTE"
        : modelo === "avulso"
          ? "CERTIFICADO AVULSO"
          : "EMSP-SMS";

  doc.save();
  doc.rotate(-90, { origin: [pageW - 20, pageH / 2] });
  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc
    .fillColor("#718078")
    .fontSize(7.2)
    .text(seloTexto, pageW - 252, pageH / 2 - 8, {
      width: 210,
      align: "center",
      characterSpacing: 1.6,
      lineBreak: false,
    });
  doc.restore();

  doc.restore();
}

function desenharLogoImagem(doc, buffer, x, y, w, h, options = {}) {
  const { rounded = false, border = false, padding = 0 } = options;

  if (!buffer) return false;

  doc.save();

  if (border) {
    doc
      .roundedRect(x, y, w, h, rounded ? 12 : 6)
      .strokeColor("#e3d4a7")
      .lineWidth(0.6)
      .stroke();
  }

  try {
    doc.image(buffer, x + padding, y + padding, {
      width: w - padding * 2,
      height: h - padding * 2,
      fit: [w - padding * 2, h - padding * 2],
      align: "center",
      valign: "center",
    });

    doc.restore();
    return true;
  } catch {
    doc.restore();
    return false;
  }
}

function desenharLogoFallback(doc, x, y, w, h, label, fonts = {}) {
  doc.save();

  doc
    .roundedRect(x, y, w, h, 12)
    .strokeColor("#e3d4a7")
    .lineWidth(0.6)
    .stroke();

  setFont(doc, fonts.bold || "Helvetica-Bold", "Helvetica-Bold");
  doc
    .fillColor(CORES.verdeProfundo)
    .fontSize(10)
    .text(label, x + 6, y + h / 2 - 7, {
      width: w - 12,
      align: "center",
      lineBreak: false,
    });

  doc.restore();
}

function desenharTopoInstitucional(doc, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  const brasao = localizarImagem(options, "brasao");
  const logoEscola = localizarImagem(options, "escola");

  const logoSize = 74;
  const logoY = 42;
  const logoLeftX = 82;
  const logoRightX = pageW - 82 - logoSize;

  desenharLogoImagem(doc, brasao, logoLeftX, logoY, logoSize, logoSize, {
    border: false,
    padding: 0,
  }) ||
    desenharLogoFallback(
      doc,
      logoLeftX,
      logoY,
      logoSize,
      logoSize,
      "SANTOS",
      fonts
    );

  desenharLogoImagem(doc, logoEscola, logoRightX, logoY, logoSize, logoSize, {
    border: false,
    padding: 0,
  }) ||
    desenharLogoFallback(
      doc,
      logoRightX,
      logoY,
      logoSize,
      logoSize,
      "EMSP",
      fonts
    );

  doc.save();

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc.fillColor(CORES.verdeProfundo).fontSize(13.2).text(
    "PREFEITURA MUNICIPAL DE SANTOS",
    170,
    54,
    {
      width: pageW - 340,
      align: "center",
      characterSpacing: 0.65,
      lineBreak: false,
    }
  );

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc.fillColor(CORES.texto).fontSize(11).text(
    "SECRETARIA MUNICIPAL DE SAÚDE",
    170,
    74,
    {
      width: pageW - 340,
      align: "center",
      characterSpacing: 0.25,
      lineBreak: false,
    }
  );

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.textoSuave).fontSize(8.8).text(
    "Escola Municipal de Saúde Pública — EMSP-SMS",
    170,
    91,
    {
      width: pageW - 340,
      align: "center",
      lineBreak: false,
    }
  );

  const cy = 116;

  doc.strokeColor(CORES.ouro).lineWidth(0.75);
  doc.moveTo(pageW / 2 - 120, cy).lineTo(pageW / 2 - 24, cy).stroke();
  doc.moveTo(pageW / 2 + 24, cy).lineTo(pageW / 2 + 120, cy).stroke();

  doc.circle(pageW / 2, cy, 2.2).fillColor(CORES.ouro).fill();
  doc.circle(pageW / 2 - 12, cy, 1.2).fillColor(CORES.ouro).fill();
  doc.circle(pageW / 2 + 12, cy, 1.2).fillColor(CORES.ouro).fill();

  doc.restore();
}

function desenharTitulo(doc, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  const titulo = "CERTIFICADO";

  setFont(doc, fonts.serif, "Helvetica-Bold");

  doc.fillColor("#d2bd87").fontSize(44).text(titulo, 66, 134, {
    width: pageW - 132,
    align: "center",
    characterSpacing: 2.4,
    lineBreak: false,
  });

  doc.fillColor(CORES.verdeProfundo).fontSize(42).text(titulo, 66, 131, {
    width: pageW - 132,
    align: "center",
    characterSpacing: 2.4,
    lineBreak: false,
  });

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.ouroEscuro).fontSize(9.6).text(
    options.subtitulo ||
      "Documento eletrônico emitido pela Plataforma Escola da Saúde",
    90,
    179,
    {
      width: pageW - 180,
      align: "center",
      lineBreak: false,
    }
  );

  doc.strokeColor(CORES.ouro).lineWidth(0.7);
  doc.moveTo(pageW / 2 - 76, 200).lineTo(pageW / 2 - 16, 200).stroke();
  doc.moveTo(pageW / 2 + 16, 200).lineTo(pageW / 2 + 76, 200).stroke();
  doc.circle(pageW / 2, 200, 1.8).fillColor(CORES.ouro).fill();

  doc.restore();
}

function desenharNome(doc, nome, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  drawFitText(doc, safeText(nome, 180), {
    x: 86,
    y: 218,
    width: pageW - 172,
    height: 52,
    font: fonts.script,
    fallbackFont: "Times-Italic",
    maxSize: 44,
    minSize: 21,
    align: "center",
    color: CORES.verdeNoite,
    lineGap: 0,
  });

  doc.strokeColor(CORES.linha).lineWidth(0.75);
  doc.moveTo(236, 273).lineTo(pageW - 236, 273).stroke();

  if (options.identificadorTexto) {
    setFont(doc, fonts.regular, "Helvetica");
    doc.fillColor(CORES.textoSuave).fontSize(8.8).text(
      options.identificadorTexto,
      90,
      283,
      {
        width: pageW - 180,
        align: "center",
        lineBreak: false,
      }
    );
  }

  doc.restore();
}

function desenharTextoPrincipal(doc, textoPrincipal, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  const boxX = 104;
  const boxY = 310;
  const boxW = pageW - 208;
  const boxH = 76;

  doc
    .roundedRect(boxX - 10, boxY - 8, boxW + 20, boxH + 14, 10)
    .fillColor("#fffaf0")
    .fill();

  doc
    .roundedRect(boxX - 10, boxY - 8, boxW + 20, boxH + 14, 10)
    .strokeColor("#ead9a6")
    .lineWidth(0.55)
    .stroke();

  drawFitText(doc, textoPrincipal, {
    x: boxX,
    y: boxY + 3,
    width: boxW,
    height: boxH - 4,
    font: fonts.regular,
    fallbackFont: "Helvetica",
    maxSize: 13.3,
    minSize: 9.2,
    align: "center",
    color: CORES.texto,
    lineGap: 2.4,
  });

  doc.restore();
}

function desenharData(doc, dataTexto, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.texto).fontSize(10.4);

  drawNoBreakText(doc, dataTexto || "", pageW - 342, 401, {
    width: 255,
    height: 13,
    align: "right",
    max: 140,
  });

  doc.restore();
}

function normalizarAssinaturasLayout(assinaturas = []) {
  if (!Array.isArray(assinaturas)) return [];

  const mapa = new Map();

  for (const assinatura of assinaturas) {
    const nome = safeText(assinatura?.nome, 180);

    if (!nome) continue;

    const chave =
      assinatura?.usuario_id ||
      assinatura?.id ||
      `${nome}:${safeText(assinatura?.cargo, 140)}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        ...assinatura,
        nome,
        cargo: safeText(assinatura?.cargo, 140),
        imgBuffer: assinatura?.imgBuffer || assinatura?.imagemBuffer || null,
      });
    }
  }

  return [...mapa.values()].slice(0, 3);
}

function slotsAssinaturas(pageW, total) {
  if (total <= 1) {
    return [
      {
        x: (pageW - 330) / 2,
        w: 330,
        imageW: 138,
        imageH: 40,
        nomeSize: 12.8,
        cargoSize: 9,
      },
    ];
  }

  if (total === 2) {
    return [
      {
        x: 124,
        w: 292,
        imageW: 136,
        imageH: 42,
        nomeSize: 12.7,
        cargoSize: 8.8,
      },
      {
        x: pageW - 416,
        w: 292,
        imageW: 136,
        imageH: 42,
        nomeSize: 12.7,
        cargoSize: 8.8,
      },
    ];
  }

  const margin = 70;
  const gap = 18;
  const w = (pageW - margin * 2 - gap * 2) / 3;

  return [
    {
      x: margin,
      w,
      imageW: 108,
      imageH: 38,
      nomeSize: 10.6,
      cargoSize: 7.5,
    },
    {
      x: margin + w + gap,
      w,
      imageW: 108,
      imageH: 38,
      nomeSize: 10.6,
      cargoSize: 7.5,
    },
    {
      x: margin + (w + gap) * 2,
      w,
      imageW: 108,
      imageH: 38,
      nomeSize: 10.6,
      cargoSize: 7.5,
    },
  ];
}

function desenharAssinaturas(doc, assinaturas = [], options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);
  const lista = normalizarAssinaturasLayout(assinaturas);

  if (!lista.length) return;

  const baseY = lista.length === 3 ? 430 : 436;
  const slots = slotsAssinaturas(pageW, lista.length);

lista.forEach((assinatura, index) => {
  const slot = slots[index];
  const imgBuffer = assinatura.imgBuffer || assinatura.imagemBuffer || null;

  const cargoFinal = safeText(assinatura.cargo, 140);
  const cargoEhGenerico = ["assinante", "assina", "assinatura"].includes(
    cargoFinal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  );

  doc.save();

  const linhaY = baseY + 2;

  if (imgBuffer) {
    try {
      const nomeAssinante = String(assinatura?.nome || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      const isRafaellaPitol =
        nomeAssinante.includes("rafaella") &&
        nomeAssinante.includes("pitol");

      const imageW = clamp(
        isRafaellaPitol ? slot.imageW + 22 : slot.imageW,
        80,
        168
      );

      const imageH = clamp(
        isRafaellaPitol ? slot.imageH + 8 : slot.imageH,
        32,
        54
      );

      const imageX = slot.x + (slot.w - imageW) / 2;

      // Aproxima a assinatura manuscrita da linha.
      doc.image(imgBuffer, imageX, linhaY - imageH + 4, {
        width: imageW,
        height: imageH,
        fit: [imageW, imageH],
      });
    } catch {
      // imagem inválida não bloqueia emissão
    }
  }

  doc.strokeColor(CORES.ouro).lineWidth(0.8);
  doc.moveTo(slot.x + 8, linhaY).lineTo(slot.x + slot.w - 8, linhaY).stroke();

  const midX = slot.x + slot.w / 2;
  doc.circle(midX, linhaY, 1.5).fillColor(CORES.ouro).fill();

  drawFitText(doc, assinatura.nome, {
    x: slot.x,
    y: linhaY + 8,
    width: slot.w,
    height: 17,
    font: fonts.bold,
    fallbackFont: "Helvetica-Bold",
    maxSize: slot.nomeSize,
    minSize: 7.6,
    align: "center",
    color: CORES.texto,
    lineGap: 0,
  });

  if (!cargoEhGenerico && cargoFinal) {
    drawFitText(doc, cargoFinal, {
      x: slot.x,
      y: linhaY + 25,
      width: slot.w,
      height: 17,
      font: fonts.regular,
      fallbackFont: "Helvetica",
      maxSize: slot.cargoSize,
      minSize: 6.2,
      align: "center",
      color: CORES.ouroEscuro,
      lineGap: 0,
    });
  }

  doc.restore();
});
}

function desenharRodapeImagem(doc, options = {}, x, y, w, h) {
  const rodape = localizarImagem(options, "rodape");

  if (!rodape) return false;

  doc.save();

  try {
    doc.image(rodape, x, y, {
      width: w,
      height: h,
      fit: [w, h],
      align: "right",
      valign: "center",
    });

    doc.restore();
    return true;
  } catch {
    doc.restore();
    return false;
  }
}

function desenharValidacao(doc, options = {}) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const fonts = fontSet(options.fonts);

  const numero = safeText(options.numeroCertificado, 150);
  const codigo = safeText(options.codigoValidacao, 150);
  const url = safeText(options.validacaoUrl, 500);

  const footerX = 66;
  const footerY = pageH - 112;
  const footerW = pageW - 132;
  const footerH = 76;

  const qrSize = 56;
  const qrX = footerX + 18;
  const qrY = footerY + 10;

  const infoX = qrX + qrSize + 32;
  const infoY = footerY + 10;
  const artW = 285;
  const infoW = footerW - qrSize - artW - 72;

  doc.save();

  doc
    .roundedRect(footerX, footerY, footerW, footerH, 12)
    .fillColor(CORES.verdeProfundo)
    .fill();

  doc
    .roundedRect(footerX + 4, footerY + 4, footerW - 8, footerH - 8, 9)
    .strokeColor(CORES.ouro)
    .lineWidth(0.9)
    .stroke();

  doc
    .roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 6)
    .fillColor(CORES.branco)
    .fill();

  doc
    .roundedRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 6)
    .strokeColor("#d9cda9")
    .lineWidth(0.5)
    .stroke();

  if (options.qrDataUrl) {
    try {
      doc.image(options.qrDataUrl, qrX, qrY, {
        width: qrSize,
        height: qrSize,
        fit: [qrSize, qrSize],
      });
    } catch {
      // QR inválido não deve derrubar layout
    }
  }

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.ouroClaro).fontSize(5.9);
  drawNoBreakText(doc, "Valide pelo QR Code", qrX - 8, qrY + qrSize + 4, {
    width: qrSize + 16,
    height: 7,
    align: "center",
    max: 60,
  });

  doc.strokeColor(CORES.ouro).lineWidth(0.8);
  for (let yy = footerY + 13; yy <= footerY + footerH - 13; yy += 8) {
    doc.circle(qrX + qrSize + 18, yy, 0.9).fillColor(CORES.ouro).fill();
  }

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc.fillColor(CORES.branco).fontSize(7.8);
  drawNoBreakText(
    doc,
    "Documento eletrônico validável — Escola Municipal de Saúde Pública / SMS",
    infoX,
    infoY,
    {
      width: infoW,
      height: 9,
      max: 190,
    }
  );

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor("#f6edd0").fontSize(7.2);
  drawNoBreakText(
    doc,
    numero ? `Certificado nº: ${numero}` : "Certificado nº: —",
    infoX,
    infoY + 15,
    {
      width: infoW,
      height: 8,
      max: 190,
    }
  );

  drawNoBreakText(
    doc,
    codigo ? `Código de validação: ${codigo}` : "Código de validação: —",
    infoX,
    infoY + 30,
    {
      width: infoW,
      height: 8,
      max: 210,
    }
  );

  if (url) {
    doc.fillColor("#e6d6a6").fontSize(5.9);
    drawNoBreakText(doc, url, infoX, infoY + 45, {
      width: infoW + 80,
      height: 7,
      max: 270,
    });
  }

  const artX = footerX + footerW - artW - 14;
  const artY = footerY + 4;
  const artH = footerH - 8;

  const desenhouImagem = desenharRodapeImagem(
    doc,
    options,
    artX,
    artY,
    artW,
    artH
  );

  if (!desenhouImagem) {
    doc.save();
    setFont(doc, fonts.bold, "Helvetica-Bold");
    doc.opacity(0.22);
    doc.fillColor(CORES.ouroClaro).fontSize(24);
    doc.text("EMSP-SMS", artX, footerY + 24, {
      width: artW,
      align: "right",
      lineBreak: false,
      characterSpacing: 2,
    });
    doc.restore();
  }

  doc.restore();
}

function desenharCertificadoCompletoV2(doc, options = {}) {
  const fonts = fontSet(options.fonts);

  desenharMoldura(doc, {
    modelo: options.modelo || "padrao",
    fonts,
  });

  desenharTopoInstitucional(doc, {
    ...options,
    fonts,
  });

  desenharTitulo(doc, {
    subtitulo: options.subtitulo,
    fonts,
  });

  desenharNome(doc, options.nome, {
    identificadorTexto: options.identificadorTexto,
    fonts,
  });

  desenharTextoPrincipal(doc, options.textoPrincipal, {
    fonts,
  });

  desenharData(doc, options.dataTexto, {
    fonts,
  });

  desenharAssinaturas(doc, options.assinaturas, {
    fonts,
  });

  desenharValidacao(doc, {
    ...options,
    numeroCertificado: options.numeroCertificado,
    codigoValidacao: options.codigoValidacao,
    validacaoUrl: options.validacaoUrl,
    qrDataUrl: options.qrDataUrl,
    fonts,
  });
}

module.exports = {
  desenharCertificadoCompletoV2,
  desenharAssinaturas,
  normalizarAssinaturasLayout,
  dataUrlToBuffer,
};