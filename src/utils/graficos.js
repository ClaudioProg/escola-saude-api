// utils/graficos.js

/**
 * 📊 Formata dados para gráficos de barras/pizza
 * @param {Array} dados - Array de objetos com propriedades "campo" e "total"
 * @param {string} campo - Nome do campo que será usado como rótulo
 * @returns {Object} Objeto formatado para gráfico
 */
function formatarGrafico(dados, campo) {
    const cores = [
      "#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488", "#e11d48",
      "#3b82f6", "#9333ea", "#ef4444", "#10b981", "#f97316"
    ];
  
    return {
      labels: dados.map((d) => d[campo] ?? "Não informado"),
      datasets: [
        {
          label: "Total",
          data: dados.map((d) => parseInt(d.total)),
          backgroundColor: dados.map((_, i) => cores[i % cores.length]),
        },
      ],
    };
  }
  
  /**
   * 📈 Formata dados de presença para gráfico de percentual por evento
   * @param {Array} dados - Array com { titulo, total_presentes, total_inscritos }
   * @returns {Object} Objeto formatado para gráfico
   */
  function formatarGraficoPresenca(dados) {
    const cores = [
      "#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed", "#0d9488", "#e11d48",
    ];
  
    return {
      labels: dados.map((d) => d.titulo ?? "Evento"),
      datasets: [
        {
          label: "Presenças (%)",
          data: dados.map((d) =>
            d.total_inscritos ? Math.round((d.total_presentes / d.total_inscritos) * 100) : 0
          ),
          backgroundColor: dados.map((_, i) => cores[i % cores.length]),
        },
      ],
    };
  }
  
  /**
   * 🧮 Calcula média percentual de presença entre eventos
   * @param {Array} linhas - Array com { total_presentes, total_inscritos }
   * @returns {number} Média percentual
   */
  function calcularMediaPresenca(linhas) {
    if (!linhas.length) return 0;
    const somatorio = linhas.reduce((soma, l) => soma + (l.total_presentes / l.total_inscritos || 0), 0);
    return Math.round((somatorio / linhas.length) * 100);
  }
  
  module.exports = {
    formatarGrafico,
    formatarGraficoPresenca,
    calcularMediaPresenca,
  };
  