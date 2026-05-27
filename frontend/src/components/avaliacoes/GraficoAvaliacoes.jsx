// ✅ frontend/src/components/avaliacoes/GraficoAvaliacoes.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Gráfico específico de avaliações.
//
// Contrato oficial único:
// - dados["Ótimo"]
// - dados["Bom"]
// - dados["Regular"]
// - dados["Ruim"]
// - dados["Péssimo"]
//
// Sem aliases.
// Sem compatibilidade legada.
// Sem normalização por achismo.
// Sem aceitar "otimo", "ótimo", "bom" minúsculo, "excelente", "muito bom", "5", "A", "pessimo" etc.

import { useMemo } from "react";
import PropTypes from "prop-types";

import DoughnutChart from "../charts/DoughnutChart";

const AVALIACAO_KEYS = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const DEFAULT_PALETTE = [
  "#059669", // Ótimo
  "#0ea5e9", // Bom
  "#f59e0b", // Regular
  "#dc2626", // Ruim
  "#7c3aed", // Péssimo
];

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function normalizeAvaliacao(dados) {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
    return {
      Ótimo: 0,
      Bom: 0,
      Regular: 0,
      Ruim: 0,
      Péssimo: 0,
    };
  }

  return {
    Ótimo: toSafeNumber(dados["Ótimo"]),
    Bom: toSafeNumber(dados["Bom"]),
    Regular: toSafeNumber(dados["Regular"]),
    Ruim: toSafeNumber(dados["Ruim"]),
    Péssimo: toSafeNumber(dados["Péssimo"]),
  };
}

function buildChartData(normalized) {
  return AVALIACAO_KEYS.map((key) => ({
    label: key,
    value: normalized[key],
  }));
}

export default function GraficoAvaliacoes({
  dados = {},
  title = "Distribuição das avaliações",
  height = 280,
  className = "",
  palette = DEFAULT_PALETTE,
  showLegend = true,
  showCenter = true,
  centerLabel,
  emptyMessage = "Sem dados de avaliação para exibir.",
  loading = false,
  error = "",
  actions = { exportPng: true, exportCsv: true },
  filename = "grafico-avaliacoes",
}) {
  const normalized = useMemo(() => normalizeAvaliacao(dados), [dados]);

  const chartData = useMemo(() => buildChartData(normalized), [normalized]);

  const total = useMemo(
    () => chartData.reduce((acc, item) => acc + Number(item.value || 0), 0),
    [chartData]
  );

  return (
    <DoughnutChart
      data={chartData}
      title={title}
      ariaDescription={`Gráfico de rosca com a distribuição de ${total} avaliações nas categorias oficiais: Ótimo, Bom, Regular, Ruim e Péssimo.`}
      height={height}
      colors={palette}
      showPercent
      showLabels={false}
      maxLegend={showLegend ? 5 : 0}
      maxSlices={5}
      centerTotal={showCenter}
      centerFormatter={() => centerLabel || String(total)}
      emptyMessage={emptyMessage}
      className={className}
      unit=""
      loading={loading}
      error={error}
      actions={actions}
      filename={filename}
    />
  );
}

GraficoAvaliacoes.propTypes = {
  dados: PropTypes.shape({
    Ótimo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Bom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Regular: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Ruim: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    Péssimo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  title: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  palette: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
  showCenter: PropTypes.bool,
  centerLabel: PropTypes.string,
  emptyMessage: PropTypes.string,
  loading: PropTypes.bool,
  error: PropTypes.string,
  actions: PropTypes.shape({
    exportPng: PropTypes.bool,
    exportCsv: PropTypes.bool,
  }),
  filename: PropTypes.string,
};