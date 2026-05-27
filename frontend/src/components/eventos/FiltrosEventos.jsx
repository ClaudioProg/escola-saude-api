// ✅ frontend/src/components/eventos/FiltrosEventos.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Filtros premium de eventos por status.
//
// Contratos aplicados:
// - Pasta do domínio: src/components/eventos/
// - Componente visual global: ../ui/FiltroToggleGroup
// - Status oficiais de evento:
//   - programado
//   - andamento
//   - encerrado
//   - sem_datas
// - "todos" é apenas opção de filtro da UI, não status real.
// - Sem status em_andamento.
// - Sem status desconhecido.
// - Sem aliases.
// - Acessível com aria-live para mudança de filtro.
//
// Observação:
// - A prop "opcao" do FiltroToggleGroup foi mantida conforme o arquivo atual.
// - Só deve ser alterada para "opcoes" se o componente FiltroToggleGroup confirmar esse contrato.

import { useMemo, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";

import FiltroToggleGroup from "../ui/FiltroToggleGroup";

const FILTROS_EVENTO = Object.freeze({
  TODOS: "todos",
  PROGRAMADO: "programado",
  ANDAMENTO: "andamento",
  ENCERRADO: "encerrado",
  SEM_DATAS: "sem_datas",
});

const FILTROS_ACEITOS = new Set(Object.values(FILTROS_EVENTO));

const OPCOES_BASE = [
  { valor: FILTROS_EVENTO.TODOS, rotulo: "Todos" },
  { valor: FILTROS_EVENTO.PROGRAMADO, rotulo: "Programados" },
  { valor: FILTROS_EVENTO.ANDAMENTO, rotulo: "Em andamento" },
  { valor: FILTROS_EVENTO.ENCERRADO, rotulo: "Encerrados" },
  { valor: FILTROS_EVENTO.SEM_DATAS, rotulo: "Sem datas" },
];

function normalizarFiltro(valor) {
  const filtro = String(valor || "")
    .trim()
    .toLowerCase();

  return FILTROS_ACEITOS.has(filtro) ? filtro : FILTROS_EVENTO.TODOS;
}

function normalizarQuantidade(value) {
  const quantidade = Number(value);

  if (!Number.isFinite(quantidade) || quantidade < 0) {
    return null;
  }

  return Math.trunc(quantidade);
}

export default function FiltrosEventos({
  filtroSelecionado = FILTROS_EVENTO.TODOS,
  onFiltroChange,
  contagens = null,
  className = "",
  ariaLabel = "Filtros de eventos por status",
}) {
  const valorSeguro = normalizarFiltro(filtroSelecionado);
  const liveRef = useRef(null);

  const opcoes = useMemo(() => {
    if (!contagens || typeof contagens !== "object") {
      return OPCOES_BASE;
    }

    return OPCOES_BASE.map((opcao) => {
      const quantidade = normalizarQuantidade(contagens[opcao.valor]);

      if (quantidade === null) {
        return opcao;
      }

      return {
        ...opcao,
        rotulo: `${opcao.rotulo} (${quantidade})`,
      };
    });
  }, [contagens]);

  const handleSelecionar = useCallback(
    (valor) => {
      const novoFiltro = normalizarFiltro(valor);

      if (novoFiltro === valorSeguro) return;

      if (typeof onFiltroChange === "function") {
        onFiltroChange(novoFiltro);
      }
    },
    [onFiltroChange, valorSeguro]
  );

  useEffect(() => {
    if (!liveRef.current) return;

    const labelAtual =
      opcoes.find((opcao) => opcao.valor === valorSeguro)?.rotulo || "Todos";

    liveRef.current.textContent = `Filtro selecionado: ${labelAtual}.`;
  }, [valorSeguro, opcoes]);

  return (
    <section
      className={[
        "mb-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-lime-50 p-2 shadow-sm",
        "dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
    >
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <FiltroToggleGroup
        opcao={opcoes}
        valorSelecionado={valorSeguro}
        aoSelecionar={handleSelecionar}
        ariaLabel="Filtrar eventos por status"
        className="w-full"
        data-testid="filtros-eventos"
      />
    </section>
  );
}

FiltrosEventos.propTypes = {
  filtroSelecionado: PropTypes.oneOf([
    FILTROS_EVENTO.TODOS,
    FILTROS_EVENTO.PROGRAMADO,
    FILTROS_EVENTO.ANDAMENTO,
    FILTROS_EVENTO.ENCERRADO,
    FILTROS_EVENTO.SEM_DATAS,
  ]),
  onFiltroChange: PropTypes.func.isRequired,
  contagens: PropTypes.shape({
    todos: PropTypes.number,
    programado: PropTypes.number,
    andamento: PropTypes.number,
    encerrado: PropTypes.number,
    sem_datas: PropTypes.number,
  }),
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
};