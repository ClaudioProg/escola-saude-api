// utils/graficos.js

/* =========================
   Paletas (premium)
   - Mantém cores vibrantes e variadas
========================= */
const PALETA_PADRAO = [
  "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488", "#e11d48",
  "#3b82f6", "#9333ea", "#ef4444", "#10b981", "#f97316",
];

const PALETA_PRESENCA = [
  "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488", "#e11d48",
];

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toLabel(v, fallback = "Não informado") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function buildColors(len, palette = PALETA_PADRAO) {
  const pal = Array.isArray(palette) && palette.length ? palette : PALETA_PADRAO;
  return Array.from({ length: len }, (_, i) => pal[i % pal.length]);
}

/**
 * 📊 Formata dados para gráficos de barras/pizza (Chart.js friendly)
 * @param {Array} dados - Array de objetos
 * @param {string} campo - Nome do campo para rótulo (ex: 'categoria')
 * @param {Object} [opts]
 * @param {string} [opts.label='Total'] - label do dataset
 * @param {string} [opts.valorField='total'] - campo numérico a somar/plotar
 * @param {string[]} [opts.cores] - paleta opcional
 * @param {string} [opts.fallbackLabel='Não informado']
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGrafico(dados, campo, opts = {}) {
  const {
    label = "Total",
    valorField = "total",
    cores = PALETA_PADRAO,
    fallbackLabel = "Não informado",
  } = opts;

  const arr = Array.isArray(dados) ? dados : [];
  const labels = arr.map((d) => toLabel(d?.[campo], fallbackLabel));
  const values = arr.map((d) => toNumber(d?.[valorField], 0));

  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: buildColors(labels.length, cores),
      },
    ],
  };
}

/**
 * 📈 Formata dados de presença para gráfico de percentual por evento
 * @param {Array} dados - Array com { titulo, total_presentes, total_inscritos }
 * @param {Object} [opts]
 * @param {string} [opts.label='Presenças (%)']
 * @param {string[]} [opts.cores]
 * @returns {{labels:string[], datasets:Array}}
 */
function formatarGraficoPresenca(dados, opts = {}) {
  const { label = "Presenças (%)", cores = PALETA_PRESENCA } = opts;

  const arr = Array.isArray(dados) ? dados : [];
  const labels = arr.map((d) => toLabel(d?.titulo, "Evento"));

  const values = arr.map((d) => {
    const presentes = toNumber(d?.total_presentes, 0);
    const inscritos = toNumber(d?.total_inscritos, 0);
    if (!inscritos) return 0;
    return Math.round((presentes / inscritos) * 100);
  });

  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: buildColors(labels.length, cores),
      },
    ],
  };
}

/**
 * 🧮 Calcula média percentual de presença entre eventos
 *
 * Modos:
 * - "simples" (padrão): média dos percentuais por evento
 * - "ponderada": (total_presentes somado / total_inscritos somado) * 100  ✅ mais fiel
 *
 * @param {Array} linhas - Array com { total_presentes, total_inscritos }
 * @param {Object} [opts]
 * @param {'simples'|'ponderada'} [opts.modo='ponderada']
 * @returns {number} Percentual inteiro (0..100)
 */
function calcularMediaPresenca(linhas, opts = {}) {
  const { modo = "ponderada" } = opts;

  const arr = Array.isArray(linhas) ? linhas : [];
  if (!arr.length) return 0;

  if (modo === "simples") {
    const somatorio = arr.reduce((soma, l) => {
      const presentes = toNumber(l?.total_presentes, 0);
      const inscritos = toNumber(l?.total_inscritos, 0);
      return soma + (inscritos ? presentes / inscritos : 0);
    }, 0);

    return Math.round((somatorio / arr.length) * 100);
  }

  // ✅ padrão premium: ponderada
  const tot = arr.reduce(
    (acc, l) => {
      acc.presentes += toNumber(l?.total_presentes, 0);
      acc.inscritos += toNumber(l?.total_inscritos, 0);
      return acc;
    },
    { presentes: 0, inscritos: 0 }
  );

  if (!tot.inscritos) return 0;
  return Math.round((tot.presentes / tot.inscritos) * 100);
}

module.exports = {
  formatarGrafico,
  formatarGraficoPresenca,
  calcularMediaPresenca,

  // exports extras úteis (opcional)
  PALETA_PADRAO,
  PALETA_PRESENCA,
};
