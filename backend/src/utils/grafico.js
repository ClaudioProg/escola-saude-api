// 📁 src/utils/grafico.js — v2.0
"use strict";

/**
 * Plataforma Escola da Saúde
 * Utilitário oficial para preparação de dados de gráficos.
 *
 * Função:
 * - Normalizar labels.
 * - Normalizar números.
 * - Gerar datasets compatíveis com Chart.js.
 * - Calcular percentuais de presença.
 * - Montar resumos para cards/ministats.
 *
 * Observação:
 * - Este arquivo não manipula datas.
 * - Portanto, não há risco direto de fuso horário aqui.
 */

/* =========================
   Paletas
========================= */

const PALETA_PADRAO = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0d9488",
  "#e11d48",
  "#3b82f6",
  "#9333ea",
  "#ef4444",
  "#10b981",
  "#f97316",
];

const PALETA_PRESENCA = [
  "#16a34a",
  "#2563eb",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0d9488",
  "#e11d48",
];

const PALETA_MONOCROMATICA = ["#2563eb"];

/* =========================
   Helpers base
========================= */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function toInt(value, fallback = 0) {
  const number = Number.parseInt(value, 10);

  return Number.isFinite(number) ? number : fallback;
}

function toLabel(value, fallback = "Não informado") {
  const text = String(value ?? "").trim();

  return text || fallback;
}

function clamp(number, min = 0, max = 100) {
  const normalized = toNumber(number, min);

  return Math.min(Math.max(normalized, min), max);
}

function roundTo(number, decimals = 0) {
  const normalized = toNumber(number, 0);
  const safeDecimals = Math.max(0, toInt(decimals, 0));
  const factor = 10 ** safeDecimals;

  return Math.round(normalized * factor) / factor;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildColors(length, palette = PALETA_PADRAO, options = {}) {
  const { repeat = true, singleColor = false } = options;

  const safeLength = Math.max(0, toInt(length, 0));
  const safePalette =
    Array.isArray(palette) && palette.length ? palette : PALETA_PADRAO;

  if (safeLength <= 0) {
    return [];
  }

  if (singleColor) {
    return Array.from({ length: safeLength }, () => safePalette[0]);
  }

  if (!repeat && safeLength > safePalette.length) {
    return [
      ...safePalette,
      ...Array.from(
        { length: safeLength - safePalette.length },
        () => safePalette[safePalette.length - 1]
      ),
    ];
  }

  return Array.from(
    { length: safeLength },
    (_item, index) => safePalette[index % safePalette.length]
  );
}

function calcPercent(numerador, denominador, options = {}) {
  const { decimals = 0, clampResult = true } = options;

  const num = toNumber(numerador, 0);
  const den = toNumber(denominador, 0);

  if (!den) {
    return 0;
  }

  const raw = (num / den) * 100;
  const safe = clampResult ? clamp(raw, 0, 100) : raw;

  return roundTo(safe, decimals);
}

/* =========================
   Dataset factory
========================= */

function createDataset({
  label = "Total",
  data = [],
  palette = PALETA_PADRAO,
  singleColor = false,
  borderWidth = 0,
  fill = true,
}) {
  const values = normalizeArray(data).map((value) => toNumber(value, 0));

  const colors = buildColors(values.length, palette, {
    singleColor,
  });

  return {
    label: toLabel(label, "Total"),
    data: values,
    backgroundColor: colors,
    borderColor: colors,
    borderWidth: toInt(borderWidth, 0),
    fill: Boolean(fill),
  };
}

/* =========================
   Formatação genérica
========================= */

/**
 * Formata dados genéricos para gráficos compatíveis com Chart.js.
 *
 * @param {Array} dados
 * @param {string} campo
 * @param {Object} [options]
 * @param {string} [options.label='Total']
 * @param {string} [options.valorField='total']
 * @param {string[]} [options.cores]
 * @param {string} [options.fallbackLabel='Não informado']
 * @param {boolean} [options.singleColor=false]
 * @param {number} [options.decimals=0]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGrafico(dados, campo, options = {}) {
  const {
    label = "Total",
    valorField = "total",
    cores = PALETA_PADRAO,
    fallbackLabel = "Não informado",
    singleColor = false,
    decimals = 0,
  } = options;

  const linhas = normalizeArray(dados);

  const labels = linhas.map((linha) => toLabel(linha?.[campo], fallbackLabel));

  const values = linhas.map((linha) =>
    roundTo(toNumber(linha?.[valorField], 0), decimals)
  );

  return {
    labels,
    datasets: [
      createDataset({
        label,
        data: values,
        palette: cores,
        singleColor,
      }),
    ],
  };
}

/* =========================
   Presença por evento
========================= */

/**
 * Formata percentual de presença por evento.
 *
 * Espera linhas com:
 * - titulo
 * - total_presentes
 * - total_inscritos
 *
 * @param {Array} dados
 * @param {Object} [options]
 * @param {string} [options.label='Presenças (%)']
 * @param {string[]} [options.cores]
 * @param {number} [options.decimals=0]
 * @param {boolean} [options.singleColor=false]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGraficoPresenca(dados, options = {}) {
  const {
    label = "Presenças (%)",
    cores = PALETA_PRESENCA,
    decimals = 0,
    singleColor = false,
  } = options;

  const linhas = normalizeArray(dados);

  const labels = linhas.map((linha) => toLabel(linha?.titulo, "Evento"));

  const values = linhas.map((linha) =>
    calcPercent(linha?.total_presentes, linha?.total_inscritos, {
      decimals,
      clampResult: true,
    })
  );

  return {
    labels,
    datasets: [
      createDataset({
        label,
        data: values,
        palette: cores,
        singleColor,
      }),
    ],
  };
}

/* =========================
   Distribuição percentual
========================= */

/**
 * Formata distribuição percentual para gráficos de pizza/donut.
 *
 * @param {Array} dados
 * @param {string} campo
 * @param {Object} [options]
 * @param {string} [options.valorField='total']
 * @param {string} [options.label='Distribuição (%)']
 * @param {string[]} [options.cores]
 * @param {string} [options.fallbackLabel='Não informado']
 * @param {number} [options.decimals=1]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGraficoDistribuicao(dados, campo, options = {}) {
  const {
    valorField = "total",
    label = "Distribuição (%)",
    cores = PALETA_PADRAO,
    fallbackLabel = "Não informado",
    decimals = 1,
  } = options;

  const linhas = normalizeArray(dados);

  const labels = linhas.map((linha) => toLabel(linha?.[campo], fallbackLabel));

  const totais = linhas.map((linha) => toNumber(linha?.[valorField], 0));

  const soma = totais.reduce((acc, value) => acc + value, 0);

  const values = totais.map((value) => {
    if (!soma) {
      return 0;
    }

    return roundTo((value / soma) * 100, decimals);
  });

  return {
    labels,
    datasets: [
      createDataset({
        label,
        data: values,
        palette: cores,
      }),
    ],
  };
}

/* =========================
   Média percentual de presença
========================= */

/**
 * Modos:
 * - simples: média dos percentuais por item.
 * - ponderada: soma presentes / soma inscritos.
 *
 * @param {Array} linhas
 * @param {Object} [options]
 * @param {'simples'|'ponderada'} [options.modo='ponderada']
 * @param {number} [options.decimals=0]
 * @returns {number}
 */
function calcularMediaPresenca(linhas, options = {}) {
  const { modo = "ponderada", decimals = 0 } = options;

  const dados = normalizeArray(linhas);

  if (!dados.length) {
    return 0;
  }

  if (modo === "simples") {
    const percentuais = dados.map((linha) =>
      calcPercent(linha?.total_presentes, linha?.total_inscritos, {
        decimals: 6,
        clampResult: true,
      })
    );

    const soma = percentuais.reduce((acc, value) => acc + value, 0);

    return roundTo(soma / dados.length, decimals);
  }

  const totais = dados.reduce(
    (acc, linha) => {
      acc.presentes += toNumber(linha?.total_presentes, 0);
      acc.inscritos += toNumber(linha?.total_inscritos, 0);

      return acc;
    },
    {
      presentes: 0,
      inscritos: 0,
    }
  );

  return calcPercent(totais.presentes, totais.inscritos, {
    decimals,
    clampResult: true,
  });
}

/* =========================
   Soma segura de campo
========================= */

function somarCampo(linhas, campo) {
  return normalizeArray(linhas).reduce(
    (acc, item) => acc + toNumber(item?.[campo], 0),
    0
  );
}

/* =========================
   Resumo de presença
========================= */

/**
 * Retorna resumo pronto para cards/ministats.
 *
 * @param {Array} linhas
 * @param {Object} [options]
 * @returns {{
 *   totalPresentes:number,
 *   totalInscritos:number,
 *   mediaPresenca:number,
 *   eventos:number
 * }}
 */
function resumirPresenca(linhas, options = {}) {
  const dados = normalizeArray(linhas);

  return {
    totalPresentes: somarCampo(dados, "total_presentes"),
    totalInscritos: somarCampo(dados, "total_inscritos"),
    mediaPresenca: calcularMediaPresenca(dados, options),
    eventos: dados.length,
  };
}

/* =========================
   Export oficial
========================= */

module.exports = {
  formatarGrafico,
  formatarGraficoPresenca,
  formatarGraficoDistribuicao,
  calcularMediaPresenca,
  resumirPresenca,
  somarCampo,

  PALETA_PADRAO,
  PALETA_PRESENCA,
  PALETA_MONOCROMATICA,

  toNumber,
  toLabel,
  buildColors,
  calcPercent,
  createDataset,
};