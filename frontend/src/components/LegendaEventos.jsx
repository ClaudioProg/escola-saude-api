export function LegendaEventos() {
  const legendas = [
    { cor: "bg-green-500", texto: "Programado" },
    { cor: "bg-yellow-400", texto: "Em andamento" },
    { cor: "bg-red-500", texto: "Encerrado" },
  ];

  return (
    <div className="flex items-center gap-4 mt-6 flex-wrap" role="list" aria-label="Legenda dos eventos">
      {legendas.map(({ cor, texto }) => (
        <div key={texto} className="flex items-center gap-2" role="listitem">
          <span
            className={`w-4 h-4 rounded-full shrink-0 ${cor}`}
            aria-hidden="true"
          ></span>
          <span className="text-sm text-gray-700 dark:text-gray-300 leading-tight">{texto}</span>
        </div>
      ))}
    </div>
  );
}

export default LegendaEventos;
