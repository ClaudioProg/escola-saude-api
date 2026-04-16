// utils/graficos.js
"use strict";

/* =========================
   Paletas (premium)
   - Vibrantes, variadas e reutilizáveis
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
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback = 0) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toLabel(v, fallback = "Não informado") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function clamp(n, min = 0, max = 100) {
  const num = toNumber(n, min);
  return Math.min(Math.max(num, min), max);
}

function roundTo(n, decimals = 0) {
  const num = toNumber(n, 0);
  const d = Math.max(0, toInt(decimals, 0));
  const factor = 10 ** d;
  return Math.round(num * factor) / factor;
}

function buildColors(len, palette = PALETA_PADRAO, opts = {}) {
  const { repeat = true, singleColor = false } = opts;
  const pal = Array.isArray(palette) && palette.length ? palette : PALETA_PADRAO;

  if (len <= 0) return [];
  if (singleColor) return Array.from({ length: len }, () => pal[0]);

  if (!repeat && len > pal.length) {
    return [...pal, ...Array.from({ length: len - pal.length }, () => pal[pal.length - 1])];
  }

  return Array.from({ length: len }, (_, i) => pal[i % pal.length]);
}

function normalizeArray(dados) {
  return Array.isArray(dados) ? dados : [];
}

function calcPercent(numerador, denominador, opts = {}) {
  const { decimals = 0, clampResult = true } = opts;

  const num = toNumber(numerador, 0);
  const den = toNumber(denominador, 0);

  if (!den) return 0;

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
  const values = normalizeArray(data).map((v) => toNumber(v, 0));
  const colors = buildColors(values.length, palette, { singleColor });

  return {
    label,
    data: values,
    backgroundColor: colors,
    borderColor: colors,
    borderWidth,
    fill,
  };
}

/* =========================
   📊 Formata dados genéricos para gráficos
   Chart.js friendly
========================= */
/**
 * @param {Array} dados
 * @param {string} campo
 * @param {Object} [opts]
 * @param {string} [opts.label='Total']
 * @param {string} [opts.valorField='total']
 * @param {string[]} [opts.cores]
 * @param {string} [opts.fallbackLabel='Não informado']
 * @param {boolean} [opts.singleColor=false]
 * @param {number} [opts.decimals=0]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGrafico(dados, campo, opts = {}) {
  const {
    label = "Total",
    valorField = "total",
    cores = PALETA_PADRAO,
    fallbackLabel = "Não informado",
    singleColor = false,
    decimals = 0,
  } = opts;

  const arr = normalizeArray(dados);

  const labels = arr.map((d) => toLabel(d?.[campo], fallbackLabel));
  const values = arr.map((d) => roundTo(toNumber(d?.[valorField], 0), decimals));

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
   📈 Presença por evento
========================= */
/**
 * @param {Array} dados - Array com { titulo, total_presentes, total_inscritos }
 * @param {Object} [opts]
 * @param {string} [opts.label='Presenças (%)']
 * @param {string[]} [opts.cores]
 * @param {number} [opts.decimals=0]
 * @param {boolean} [opts.singleColor=false]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGraficoPresenca(dados, opts = {}) {
  const {
    label = "Presenças (%)",
    cores = PALETA_PRESENCA,
    decimals = 0,
    singleColor = false,
  } = opts;

  const arr = normalizeArray(dados);

  const labels = arr.map((d) => toLabel(d?.titulo, "Evento"));

  const values = arr.map((d) =>
    calcPercent(d?.total_presentes, d?.total_inscritos, {
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
   🍰 Distribuição percentual
   Útil para pizza/donut com base em totais absolutos
========================= */
/**
 * @param {Array} dados
 * @param {string} campo
 * @param {Object} [opts]
 * @param {string} [opts.valorField='total']
 * @param {string} [opts.label='Distribuição (%)']
 * @param {string[]} [opts.cores]
 * @param {string} [opts.fallbackLabel='Não informado']
 * @param {number} [opts.decimals=1]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGraficoDistribuicao(dados, campo, opts = {}) {
  const {
    valorField = "total",
    label = "Distribuição (%)",
    cores = PALETA_PADRAO,
    fallbackLabel = "Não informado",
    decimals = 1,
  } = opts;

  const arr = normalizeArray(dados);
  const labels = arr.map((d) => toLabel(d?.[campo], fallbackLabel));
  const totais = arr.map((d) => toNumber(d?.[valorField], 0));
  const soma = totais.reduce((acc, v) => acc + v, 0);

  const values = totais.map((v) => {
    if (!soma) return 0;
    return roundTo((v / soma) * 100, decimals);
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
   🧮 Média percentual de presença
========================= */
/**
 * Modos:
 * - "simples": média dos percentuais por item
 * - "ponderada" (padrão): soma presentes / soma inscritos
 *
 * @param {Array} linhas
 * @param {Object} [opts]
 * @param {'simples'|'ponderada'} [opts.modo='ponderada']
 * @param {number} [opts.decimals=0]
 * @returns {number}
 */
function calcularMediaPresenca(linhas, opts = {}) {
  const { modo = "ponderada", decimals = 0 } = opts;

  const arr = normalizeArray(linhas);
  if (!arr.length) return 0;

  if (modo === "simples") {
    const percentuais = arr.map((l) =>
      calcPercent(l?.total_presentes, l?.total_inscritos, {
        decimals: 6,
        clampResult: true,
      })
    );

    const soma = percentuais.reduce((acc, v) => acc + v, 0);
    return roundTo(soma / arr.length, decimals);
  }

  const totais = arr.reduce(
    (acc, l) => {
      acc.presentes += toNumber(l?.total_presentes, 0);
      acc.inscritos += toNumber(l?.total_inscritos, 0);
      return acc;
    },
    { presentes: 0, inscritos: 0 }
  );

  return calcPercent(totais.presentes, totais.inscritos, {
    decimals,
    clampResult: true,
  });
}

/* =========================
   🧮 Soma segura de campo
========================= */
function somarCampo(linhas, campo) {
  return normalizeArray(linhas).reduce((acc, item) => acc + toNumber(item?.[campo], 0), 0);
}

/* =========================
   🔢 Resumo de presença
========================= */
/**
 * Retorna um resumo pronto para cards/ministats
 * @param {Array} linhas
 * @param {Object} [opts]
 * @returns {{
 *   totalPresentes:number,
 *   totalInscritos:number,
 *   mediaPresenca:number,
 *   eventos:number
 * }}
 */
function resumirPresenca(linhas, opts = {}) {
  const arr = normalizeArray(linhas);

  return {
    totalPresentes: somarCampo(arr, "total_presentes"),
    totalInscritos: somarCampo(arr, "total_inscritos"),
    mediaPresenca: calcularMediaPresenca(arr, opts),
    eventos: arr.length,
  };
}

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