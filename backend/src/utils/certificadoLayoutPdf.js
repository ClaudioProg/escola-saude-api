"use strict";

/**
 * ✅ backend/src/utils/certificadoLayoutPdf.js — v2.1
 * Atualizado em: 18/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Template programático oficial para certificados PDF.
 * - Desenha layout institucional sem depender de wallpaper/fundo externo.
 *
 * Diretrizes:
 * - Layout vetorial via PDFKit.
 * - Sem dependência obrigatória de imagem de fundo.
 * - Identidade institucional EMSP-SMS.
 * - Número oficial do certificado sempre destacado.
 * - QR Code e código de validação sempre destacados.
 * - Compatível com certificados regulares e avulsos.
 * - Suporta de 1 a 3 assinaturas oficiais.
 * - Preparado para validação pública e rastreabilidade documental.
 *
 * Contrato de assinaturas:
 * - Recebe assinaturas já ordenadas pelo controller/service.
 * - A ordem final vem de turma_certificado_assinante.ordem.
 * - Rafaella Pitol é obrigatória no fluxo regular.
 * - Fábio Lopez, quando selecionado, deve vir como última assinatura.
 * - Este utilitário apenas desenha; não decide regra documental.
 */

const CORES = {
  verdeProfundo: "#0f3d2e",
  verde: "#1b5e47",
  verdeClaro: "#dcefe7",
  verdeMuitoClaro: "#f3faf6",
  dourado: "#b7791f",
  douradoClaro: "#f8e6bd",
  cinzaTexto: "#1f2933",
  cinzaMedio: "#64748b",
  cinzaClaro: "#e5e7eb",
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

function drawFitText(doc, text, options = {}) {
  const {
    x,
    y,
    width,
    height,
    font,
    fallbackFont = "Helvetica",
    maxSize = 30,
    minSize = 10,
    align = "center",
    color = CORES.preto,
    lineGap = 2,
    continued = false,
  } = options;

  const clean = safeText(text);

  if (!clean) return { fontSize: maxSize, height: 0 };

  let size = maxSize;

  setFont(doc, font, fallbackFont);
  doc.fontSize(size);

  while (size > minSize) {
    doc.fontSize(size);

    const measuredHeight = doc.heightOfString(clean, {
      width,
      align,
      lineGap,
    });

    const measuredWidth = doc.widthOfString(clean);

    if (
      (!height || measuredHeight <= height) &&
      (align !== "center" || measuredWidth <= width || measuredHeight <= height)
    ) {
      break;
    }

    size -= 1;
  }

  doc.fillColor(color).fontSize(size).text(clean, x, y, {
    width,
    height,
    align,
    lineGap,
    continued,
  });

  return {
    fontSize: size,
    height: doc.heightOfString(clean, {
      width,
      align,
      lineGap,
    }),
  };
}

function desenharMoldura(doc, options = {}) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;

  const modelo = options.modelo || "padrao";

  doc.save();

  doc.rect(0, 0, pageW, pageH).fill(CORES.branco);

  doc.fillColor(CORES.verdeMuitoClaro);
  doc.roundedRect(22, 22, pageW - 44, pageH - 44, 22).fill();

  doc.fillColor(CORES.verdeProfundo);
  doc.roundedRect(34, 34, pageW - 68, 70, 18).fill();

  doc.fillColor(CORES.dourado);
  doc.roundedRect(54, 96, pageW - 108, 5, 3).fill();

  doc.lineWidth(2.2).strokeColor(CORES.verdeProfundo);
  doc.roundedRect(30, 30, pageW - 60, pageH - 60, 20).stroke();

  doc.lineWidth(0.8).strokeColor("#9fb8ad");
  doc.roundedRect(48, 48, pageW - 96, pageH - 96, 14).stroke();

  doc.lineWidth(2).strokeColor(CORES.dourado);

  const corner = 48;
  const len = 55;

  doc
    .moveTo(corner, corner + len)
    .lineTo(corner, corner)
    .lineTo(corner + len, corner)
    .stroke();

  doc
    .moveTo(pageW - corner - len, corner)
    .lineTo(pageW - corner, corner)
    .lineTo(pageW - corner, corner + len)
    .stroke();

  doc
    .moveTo(corner, pageH - corner - len)
    .lineTo(corner, pageH - corner)
    .lineTo(corner + len, pageH - corner)
    .stroke();

  doc
    .moveTo(pageW - corner - len, pageH - corner)
    .lineTo(pageW - corner, pageH - corner)
    .lineTo(pageW - corner, pageH - corner - len)
    .stroke();

  doc.save();
  doc.opacity(0.035);
  setFont(doc, options.fonts?.serif || "BreeSerif", "Helvetica-Bold");
  doc.fillColor(CORES.verdeProfundo).fontSize(148).text("EMSP", 0, 220, {
    width: pageW,
    align: "center",
  });
  doc.restore();

  const seloTexto =
    modelo === "organizador"
      ? "ORGANIZADOR"
      : modelo === "palestrante"
        ? "PALESTRANTE"
        : modelo === "avulso"
          ? "CERTIFICADO AVULSO"
          : "EMSP-SMS";

  doc.save();
  doc.rotate(-90, { origin: [pageW - 22, pageH / 2] });
  setFont(doc, options.fonts?.bold || "AlegreyaSans-Bold", "Helvetica-Bold");
  doc
    .fillColor("#6b7c73")
    .fontSize(8)
    .text(seloTexto, pageW - 260, pageH / 2 - 9, {
      width: 220,
      align: "center",
      characterSpacing: 1.3,
    });
  doc.restore();

  doc.restore();
}

function desenharTopoInstitucional(doc, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc
    .fillColor(CORES.branco)
    .fontSize(12)
    .text("PREFEITURA MUNICIPAL DE SANTOS", 60, 46, {
      width: pageW - 120,
      align: "center",
      characterSpacing: 1,
    });

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc
    .fillColor(CORES.branco)
    .fontSize(16)
    .text("SECRETARIA MUNICIPAL DE SAÚDE", 60, 63, {
      width: pageW - 120,
      align: "center",
    });

  setFont(doc, fonts.regular, "Helvetica");
  doc
    .fillColor("#d7ede3")
    .fontSize(10)
    .text("Escola Municipal de Saúde Pública — EMSP-SMS", 60, 84, {
      width: pageW - 120,
      align: "center",
      characterSpacing: 0.8,
    });

  doc.restore();
}

function desenharTitulo(doc, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  setFont(doc, fonts.serif, "Helvetica-Bold");
  doc
    .fillColor(CORES.verdeProfundo)
    .fontSize(58)
    .text("CERTIFICADO", 65, 116, {
      width: pageW - 130,
      align: "center",
      characterSpacing: 1.4,
    });

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.cinzaMedio).fontSize(11).text(
    options.subtitulo ||
      "Documento eletrônico emitido pela Plataforma Escola da Saúde",
    80,
    177,
    {
      width: pageW - 160,
      align: "center",
    }
  );

  doc.restore();
}

function desenharNome(doc, nome, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  const cleanName = safeText(nome, 180);

  drawFitText(doc, cleanName, {
    x: 86,
    y: 215,
    width: pageW - 172,
    height: 62,
    font: fonts.script,
    fallbackFont: "Times-Italic",
    maxSize: 52,
    minSize: 24,
    align: "center",
    color: CORES.preto,
  });

  doc.strokeColor("#b7c8bf").lineWidth(0.9);
  doc.moveTo(180, 278).lineTo(pageW - 180, 278).stroke();

  if (options.identificadorTexto) {
    setFont(doc, fonts.serif, "Helvetica-Bold");
    doc
      .fillColor(CORES.cinzaMedio)
      .fontSize(10)
      .text(options.identificadorTexto, 80, 284, {
        width: pageW - 160,
        align: "center",
      });
  }

  doc.restore();
}

function desenharTextoPrincipal(doc, textoPrincipal, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  drawFitText(doc, textoPrincipal, {
    x: 92,
    y: 312,
    width: pageW - 184,
    height: 78,
    font: fonts.regular,
    fallbackFont: "Helvetica",
    maxSize: 15,
    minSize: 10,
    align: "justify",
    color: CORES.cinzaTexto,
    lineGap: 4,
  });

  doc.restore();
}

function desenharData(doc, dataTexto, options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  doc.save();

  setFont(doc, fonts.regular, "Helvetica");
  doc.fillColor(CORES.cinzaTexto).fontSize(13).text(dataTexto || "", 140, 402, {
    width: pageW - 220,
    align: "right",
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
        imageW: 145,
        nomeSize: 15,
        cargoSize: 10,
      },
    ];
  }

  if (total === 2) {
    return [
      {
        x: 112,
        w: 300,
        imageW: 138,
        nomeSize: 14,
        cargoSize: 9.5,
      },
      {
        x: pageW - 412,
        w: 300,
        imageW: 138,
        nomeSize: 14,
        cargoSize: 9.5,
      },
    ];
  }

  const margin = 74;
  const gap = 16;
  const w = (pageW - margin * 2 - gap * 2) / 3;

  return [
    {
      x: margin,
      w,
      imageW: 118,
      nomeSize: 12.2,
      cargoSize: 8.3,
    },
    {
      x: margin + w + gap,
      w,
      imageW: 118,
      nomeSize: 12.2,
      cargoSize: 8.3,
    },
    {
      x: margin + (w + gap) * 2,
      w,
      imageW: 118,
      nomeSize: 12.2,
      cargoSize: 8.3,
    },
  ];
}

function desenharAssinaturas(doc, assinaturas = [], options = {}) {
  const pageW = doc.page.width;
  const fonts = fontSet(options.fonts);

  const lista = normalizarAssinaturasLayout(assinaturas);

  if (!lista.length) return;

  const baseY = lista.length === 3 ? 480 : 478;
  const slots = slotsAssinaturas(pageW, lista.length);

  lista.forEach((assinatura, index) => {
    const slot = slots[index];
    const imgBuffer = assinatura.imgBuffer || assinatura.imagemBuffer || null;

    doc.save();

    if (imgBuffer) {
      try {
        const imageW = clamp(slot.imageW, 90, 150);
        const imageX = slot.x + (slot.w - imageW) / 2;

        doc.image(imgBuffer, imageX, baseY - 66, {
          width: imageW,
          height: 56,
          fit: [imageW, 56],
        });
      } catch {
        // imagem inválida não bloqueia emissão
      }
    }

    doc.strokeColor("#8ca49a").lineWidth(0.8);
    doc
      .moveTo(slot.x + 16, baseY - 4)
      .lineTo(slot.x + slot.w - 16, baseY - 4)
      .stroke();

    drawFitText(doc, assinatura.nome, {
      x: slot.x,
      y: baseY + 3,
      width: slot.w,
      height: 23,
      font: fonts.bold,
      fallbackFont: "Helvetica-Bold",
      maxSize: slot.nomeSize,
      minSize: 8.5,
      align: "center",
      color: CORES.preto,
      lineGap: 0,
    });

    drawFitText(doc, assinatura.cargo, {
      x: slot.x,
      y: baseY + 26,
      width: slot.w,
      height: 25,
      font: fonts.regular,
      fallbackFont: "Helvetica",
      maxSize: slot.cargoSize,
      minSize: 6.8,
      align: "center",
      color: CORES.cinzaMedio,
      lineGap: 1,
    });

    doc.restore();
  });
}

function desenharValidacao(doc, options = {}) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const fonts = fontSet(options.fonts);

  const numero = safeText(options.numeroCertificado, 140);
  const codigo = safeText(options.codigoValidacao, 140);
  const url = safeText(options.validacaoUrl, 500);

  doc.save();

  doc
    .roundedRect(46, pageH - 68, pageW - 92, 34, 8)
    .fillColor("#eef7f2")
    .fill();
  doc
    .strokeColor("#c7ddd2")
    .lineWidth(0.7)
    .roundedRect(46, pageH - 68, pageW - 92, 34, 8)
    .stroke();

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc.fillColor(CORES.verdeProfundo).fontSize(8).text(
    "Documento eletrônico validável — Escola Municipal de Saúde Pública / SMS",
    154,
    pageH - 62,
    {
      width: pageW - 230,
      align: "left",
    }
  );

  setFont(doc, fonts.bold, "Helvetica-Bold");
  doc
    .fillColor(CORES.cinzaTexto)
    .fontSize(7.5)
    .text(
      numero ? `Certificado nº: ${numero}` : "Certificado nº: —",
      154,
      pageH - 50,
      {
        width: pageW - 230,
        align: "left",
      }
    );

  setFont(doc, fonts.regular, "Helvetica");
  doc
    .fillColor(CORES.cinzaTexto)
    .fontSize(7.2)
    .text(`Código de validação: ${codigo}`, 154, pageH - 40, {
      width: pageW - 230,
      align: "left",
    });

  if (url) {
    doc.fillColor(CORES.cinzaMedio).fontSize(6.5).text(url, 154, pageH - 31, {
      width: pageW - 230,
      align: "left",
    });
  }

  if (options.qrDataUrl) {
    try {
      doc.image(options.qrDataUrl, 60, pageH - 139, {
        width: 82,
      });

      setFont(doc, fonts.regular, "Helvetica");
      doc
        .fillColor(CORES.cinzaMedio)
        .fontSize(6.5)
        .text("Valide pelo QR Code", 54, pageH - 55, {
          width: 94,
          align: "center",
        });
    } catch {
      // QR inválido não deve derrubar layout
    }
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