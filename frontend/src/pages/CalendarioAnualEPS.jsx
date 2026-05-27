// ✅ frontend/src/pages/CalendarioAnualEPS.jsx — v2.1
// Atualizado em: 26/05/2026
//
// Plataforma Escola da Saúde
// Página institucional do usuário para o Calendário Anual de EPS.
//
// Contratos oficiais:
// - GET    /api/calendario-eps
// - GET    /api/calendario-eps/departamentos
// - GET    /api/calendario-eps/tipos
// - GET    /api/calendario-eps/resumo-mensal?ano=YYYY&mes=M
// - GET    /api/calendario-eps/resumo-anual?ano=YYYY
// - DELETE /api/calendario-eps/:id
// - GET    /api/unidade
//
// Regras preservadas:
// - usuário comum só edita/exclui quando pode_editar=true;
// - status oficial:
//   planejado | solicitado | em_analise | aprovado | rejeitado | cancelado | convertido_em_evento
// - anti-fuso: data civil YYYY-MM-DD sem new Date("YYYY-MM-DD").

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Filter,
  Globe2,
  GraduationCap,
  Info,
  Lock,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import HeaderHero from "../components/layout/HeaderHero";
import Footer from "../components/layout/Footer";
import ModalConfirmacao from "../components/ui/ModalConfirmacao";
import ModalCalendarioAnualEPS from "../components/calendarioAnual/ModalCalendarioAnualEPS";

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const DEPARTAMENTOS_FALLBACK = [
  { value: "GAB-SMS", label: "GAB-SMS", cor: "#7c3aed" },
  { value: "DESMEN", label: "DESMEN", cor: "#2563eb" },
  { value: "DEAPS", label: "DEAPS", cor: "#16a34a" },
  { value: "DEMAC", label: "DEMAC", cor: "#ea580c" },
  { value: "DEVIG", label: "DEVIG", cor: "#dc2626" },
  { value: "DEREG", label: "DEREG", cor: "#0891b2" },
  { value: "DEAFIN-SMS", label: "DEAFIN-SMS", cor: "#9333ea" },
];

const STORAGE_KEY = "escola:v2:calendario-eps:filtros";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrapArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function brDate(ymd) {
  if (!isYMD(String(ymd || ""))) return String(ymd || "—");

  const [year, month, day] = String(ymd).split("-");
  return `${day}/${month}/${year}`;
}

function resumirDatas(datas = []) {
  const ordenadas = Array.isArray(datas)
    ? [...datas]
        .filter((item) => isYMD(item?.data))
        .sort((a, b) => a.data.localeCompare(b.data))
    : [];

  if (ordenadas.length === 0) return "Datas a definir";

  const primeira = ordenadas[0].data;
  const ultima = ordenadas[ordenadas.length - 1].data;

  if (primeira === ultima) return `Dia ${brDate(primeira)}`;

  return `De ${brDate(primeira)} a ${brDate(ultima)}`;
}

function resumirHorarios(datas = []) {
  const horarios = Array.isArray(datas)
    ? datas.map((item) => item?.horario_inicio).filter(Boolean).slice(0, 2)
    : [];

  if (horarios.length === 0) return "Horários a definir";
  if (horarios.length === 1) return `A partir das ${horarios[0]}`;

  return `Início às ${horarios[0]} e ${horarios[1]}`;
}

function statusInfo(status) {
  const value = String(status || "").toLowerCase();

  const map = {
    planejado: { label: "Planejado", tone: "amber" },
    solicitado: { label: "Solicitado", tone: "blue" },
    em_analise: { label: "Em análise", tone: "sky" },
    aprovado: { label: "Aprovado", tone: "emerald" },
    rejeitado: { label: "Rejeitado", tone: "rose" },
    cancelado: { label: "Cancelado", tone: "rose" },
    convertido_em_evento: { label: "Convertido em evento", tone: "violet" },
  };

  return map[value] || { label: "Sem status", tone: "slate" };
}

function normalizeDepartamentoItem(item) {
  const value = String(item?.value || item?.departamento || "").trim();
  const label = String(
    item?.label ||
      item?.departamento_label ||
      item?.value ||
      item?.departamento ||
      ""
  ).trim();

  return {
    value,
    label: label || value,
    cor: item?.cor || item?.departamento_cor || "#64748b",
  };
}

function normalizeDepartamentos(lista = []) {
  const arr =
    Array.isArray(lista) && lista.length > 0 ? lista : DEPARTAMENTOS_FALLBACK;

  return arr
    .map(normalizeDepartamentoItem)
    .filter((item) => item.value && item.label);
}

function getDepartamentoMeta(departamentos, departamentoValue) {
  const value = String(departamentoValue || "").trim();

  return (
    departamentos.find((item) => String(item.value) === value) || {
      value,
      label: value || "Departamento",
      cor: "#64748b",
    }
  );
}

function readPersistedFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function monthLabel(currentMonthYear) {
  return `${MESES[currentMonthYear.month].label} de ${currentMonthYear.year}`;
}

function ymdFromCurrentMonth(currentMonthYear) {
  return {
    ano: currentMonthYear.year,
    mes: currentMonthYear.month + 1,
    mesStr: String(currentMonthYear.month + 1).padStart(2, "0"),
  };
}

export default function CalendarioAnualEPS() {
  const reduceMotion = useReducedMotion();
  const liveRef = useRef(null);

  const persisted = useMemo(() => readPersistedFilters(), []);
  const hoje = new Date();

  const [currentMonthYear, setCurrentMonthYear] = useState({
    year: hoje.getFullYear(),
    month: hoje.getMonth(),
  });

  const [programacoes, setProgramacoes] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [departamentos, setDepartamentos] = useState(DEPARTAMENTOS_FALLBACK);
  const [resumoMensal, setResumoMensal] = useState([]);
  const [resumoAnual, setResumoAnual] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [filtroDepartamento, setFiltroDepartamento] = useState(
    persisted.filtroDepartamento || ""
  );
  const [filtroUnidade, setFiltroUnidade] = useState(
    persisted.filtroUnidade || ""
  );
  const [filtroTipo, setFiltroTipo] = useState(persisted.filtroTipo || "");
  const [busca, setBusca] = useState(persisted.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(persisted.busca || "");

  const [modalAberto, setModalAberto] = useState(false);
  const [programacaoEmEdicao, setProgramacaoEmEdicao] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);

  const departamentosNormalizados = useMemo(
    () => normalizeDepartamentos(departamentos),
    [departamentos]
  );

  function setLive(message) {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }

  useEffect(() => {
    document.title = "Calendário Anual de EPS | Escola da Saúde";
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          filtroDepartamento,
          filtroUnidade,
          filtroTipo,
          busca,
        })
      );
    } catch {
      // localStorage indisponível não deve quebrar a página
    }
  }, [filtroDepartamento, filtroUnidade, filtroTipo, busca]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setMensagem("");
    setLive("Carregando Calendário Anual de EPS.");

    try {
      const { ano, mes } = ymdFromCurrentMonth(currentMonthYear);

      const [
        programacoesResponse,
        unidadesResponse,
        tiposResponse,
        departamentosResponse,
        resumoMensalResponse,
        resumoAnualResponse,
      ] = await Promise.all([
        api.calendarioEPS.listar(),
        api.get("/unidade"),
        api.calendarioEPS.tipos(),
        api.calendarioEPS.departamentos(),
        api.calendarioEPS.resumoMensal({ ano, mes }),
        api.calendarioEPS.resumoAnual({ ano }),
      ]);

      const programacoesData = unwrapArray(programacoesResponse);
      const unidadesData = unwrapArray(unidadesResponse);
      const tiposData = unwrapArray(tiposResponse);
      const departamentosData = normalizeDepartamentos(
        unwrapArray(departamentosResponse)
      );
      const resumoMensalData = unwrapArray(resumoMensalResponse);
      const resumoAnualData = unwrapArray(resumoAnualResponse);

      setProgramacoes(programacoesData);
      setUnidades(unidadesData);
      setTipos(tiposData);
      setDepartamentos(departamentosData);
      setResumoMensal(resumoMensalData);
      setResumoAnual(resumoAnualData);

      setLive(`Programações de EPS carregadas: ${programacoesData.length}.`);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar o Calendário Anual de EPS."
      );

      setErro(message);
      setLive("Falha ao carregar o Calendário Anual de EPS.");
    } finally {
      setCarregando(false);
    }
  }, [currentMonthYear]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const programacoesDecoradas = useMemo(() => {
    return programacoes.map((programacao) => {
      const meta = getDepartamentoMeta(
        departamentosNormalizados,
        programacao.departamento
      );

      return {
        ...programacao,
        departamento_label: programacao.departamento_label || meta.label,
        departamento_cor: programacao.departamento_cor || meta.cor,
      };
    });
  }, [programacoes, departamentosNormalizados]);

  const programacoesFiltradas = useMemo(() => {
    const { year, month } = currentMonthYear;
    const mesStr = String(month + 1).padStart(2, "0");
    const query = norm(buscaDebounced);

    return programacoesDecoradas.filter((programacao) => {
      const datas = Array.isArray(programacao?.datas) ? programacao.datas : [];

      const temNoMes = datas.some((item) => {
        if (!isYMD(item?.data)) return false;

        const [ano, mes] = item.data.split("-");
        return ano === String(year) && mes === mesStr;
      });

      if (!temNoMes) return false;

      if (
        filtroDepartamento &&
        String(programacao.departamento) !== String(filtroDepartamento)
      ) {
        return false;
      }

      if (
        filtroUnidade &&
        String(programacao.unidade_id) !== String(filtroUnidade)
      ) {
        return false;
      }

      if (filtroTipo && String(programacao.tipo) !== String(filtroTipo)) {
        return false;
      }

      if (query) {
        const palestrantes = (programacao.palestrantes || [])
          .map((item) => item?.nome)
          .filter(Boolean)
          .join(" ");

        const haystack = norm(
          [
            programacao.titulo,
            programacao.descricao,
            programacao.unidade_nome,
            programacao.local,
            programacao.publico_alvo,
            programacao.modalidade,
            programacao.tipo,
            programacao.status,
            programacao.departamento,
            programacao.departamento_label,
            programacao.restricao_descricao,
            palestrantes,
          ]
            .filter(Boolean)
            .join(" | ")
        );

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    programacoesDecoradas,
    currentMonthYear,
    filtroDepartamento,
    filtroUnidade,
    filtroTipo,
    buscaDebounced,
  ]);

  const programacoesPorDia = useMemo(() => {
    const map = {};
    const { year, month } = currentMonthYear;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

    for (const programacao of programacoesFiltradas) {
      for (const item of programacao.datas || []) {
        if (!String(item?.data || "").startsWith(prefix)) continue;

        const dia = String(item.data).slice(-2);

        if (!map[dia]) map[dia] = [];
        map[dia].push(programacao);
      }
    }

    return map;
  }, [programacoesFiltradas, currentMonthYear]);

  const kpis = useMemo(
    () => ({
      total: programacoesDecoradas.length,
      minhas: programacoesDecoradas.filter((item) => item.pode_editar).length,
      aprovadas: programacoesDecoradas.filter(
        (item) => item.status === "aprovado"
      ).length,
      emAnalise: programacoesDecoradas.filter(
        (item) => item.status === "em_analise"
      ).length,
    }),
    [programacoesDecoradas]
  );

  const temFiltrosAtivos = Boolean(
    filtroDepartamento || filtroUnidade || filtroTipo || buscaDebounced
  );

  const unidadeSelecionadaNome =
    unidades.find((item) => String(item.id) === String(filtroUnidade))?.nome ||
    filtroUnidade;

  function limparFiltros() {
    setFiltroDepartamento("");
    setFiltroUnidade("");
    setFiltroTipo("");
    setBusca("");
    setBuscaDebounced("");
    setLive("Filtros limpos.");
  }

  function removerChip(tipo) {
    if (tipo === "departamento") setFiltroDepartamento("");
    if (tipo === "unidade") setFiltroUnidade("");
    if (tipo === "tipo") setFiltroTipo("");

    if (tipo === "busca") {
      setBusca("");
      setBuscaDebounced("");
    }

    setLive("Filtro removido.");
  }

  function handleCriar() {
    setProgramacaoEmEdicao(null);
    setModalAberto(true);
  }

  function handleEditar(programacao) {
    if (!programacao?.pode_editar) return;

    setProgramacaoEmEdicao(programacao);
    setModalAberto(true);
  }

  function pedirExclusao(programacao) {
    if (!programacao?.pode_editar) return;

    setConfirmacao({
      id: programacao.id,
      titulo: programacao.titulo,
    });
  }

  async function confirmarExclusao() {
    if (!confirmacao?.id) return;

    setExcluindo(true);
    setErro("");
    setMensagem("");
    setLive("Excluindo programação de EPS.");

    try {
      await api.calendarioEPS.excluir(confirmacao.id);

      setProgramacoes((current) =>
        current.filter((item) => String(item.id) !== String(confirmacao.id))
      );

      setMensagem("Programação de EPS excluída com sucesso.");
      setLive("Programação de EPS excluída com sucesso.");
      setConfirmacao(null);
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Não foi possível excluir a programação. Verifique se ela ainda pode ser alterada."
      );

      setErro(message);
      setLive("Falha ao excluir programação de EPS.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <ModalConfirmacao
        open={Boolean(confirmacao)}
        onClose={() => {
          if (excluindo) return;
          setConfirmacao(null);
        }}
        onConfirm={confirmarExclusao}
        titulo="Excluir programação"
        confirmarTexto={excluindo ? "Excluindo..." : "Excluir"}
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Tem certeza que deseja excluir{" "}
          {confirmacao?.titulo ? (
            <strong>“{confirmacao.titulo}”</strong>
          ) : (
            "esta programação"
          )}
          ? Esta ação não pode ser desfeita.
        </p>
      </ModalConfirmacao>

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <HeaderHero
  titulo="Programações de Educação Permanente em Saúde"
  subtitulo="Cadastre, consulte e acompanhe as programações institucionais de EPS por mês, departamento, unidade, tipo e situação."
  icone={CalendarDays}
  tamanho="lg"
  raio="xl"
/>

<p className="inline-flex rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
  Visualizando: {monthLabel(currentMonthYear)}
</p>

        <ActionBar
          carregando={carregando}
          onRefresh={carregarDados}
          onCriar={handleCriar}
        />

        <KpiGrid kpis={kpis} totalVisiveisMes={programacoesFiltradas.length} />

        <ResumoDepartamentos
          resumoMensal={resumoMensal}
          resumoAnual={resumoAnual}
          mes={monthLabel(currentMonthYear)}
          ano={currentMonthYear.year}
        />

        {erro ? (
          <AlertBox tone="rose" icon={AlertCircle} title="Atenção" message={erro} />
        ) : null}

        {mensagem ? (
          <AlertBox
            tone="emerald"
            icon={CheckCircle2}
            title="Tudo certo"
            message={mensagem}
          />
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Filter className="h-5 w-5 text-emerald-600" />
                Agenda mensal de EPS
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Consulte as programações registradas no mês selecionado e acompanhe
                sua distribuição por departamento.
              </p>
            </div>

            <MonthNavigator
              currentMonthYear={currentMonthYear}
              setCurrentMonthYear={setCurrentMonthYear}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterSelect
              label="Departamento"
              value={filtroDepartamento}
              onChange={setFiltroDepartamento}
              placeholder="Todos"
              options={departamentosNormalizados.map((item) => ({
                value: String(item.value),
                label: String(item.label),
              }))}
            />

            <FilterSelect
              label="Unidade"
              value={filtroUnidade}
              onChange={setFiltroUnidade}
              placeholder="Todas"
              options={unidades.map((item) => ({
                value: String(item.id),
                label: item.nome,
              }))}
            />

            <FilterSelect
              label="Tipo"
              value={filtroTipo}
              onChange={setFiltroTipo}
              placeholder="Todos"
              options={tipos.map((item) => ({
                value: String(item),
                label: String(item),
              }))}
            />

            <SearchInput
              value={busca}
              onChange={setBusca}
              onClear={() => {
                setBusca("");
                setBuscaDebounced("");
              }}
            />

            <div className="flex flex-col justify-end gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando no mês:{" "}
                <strong className="font-black text-slate-900 dark:text-white">
                  {programacoesFiltradas.length}
                </strong>
              </p>

              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            </div>
          </div>

          {temFiltrosAtivos ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {filtroDepartamento ? (
                <Chip
                  text={`Departamento: ${filtroDepartamento}`}
                  onClear={() => removerChip("departamento")}
                />
              ) : null}

              {filtroUnidade ? (
                <Chip
                  text={`Unidade: ${unidadeSelecionadaNome}`}
                  onClear={() => removerChip("unidade")}
                />
              ) : null}

              {filtroTipo ? (
                <Chip
                  text={`Tipo: ${filtroTipo}`}
                  onClear={() => removerChip("tipo")}
                />
              ) : null}

              {buscaDebounced ? (
                <Chip
                  text={`Busca: “${buscaDebounced}”`}
                  onClear={() => removerChip("busca")}
                />
              ) : null}
            </div>
          ) : null}

          <div className="mt-5">
            <CalendarioMensal
              currentMonthYear={currentMonthYear}
              programacoesPorDia={programacoesPorDia}
              onProgramacaoClick={handleEditar}
            />
          </div>
        </section>

        <section
          aria-label="Programações do Calendário Anual de EPS"
          className="space-y-3"
        >
          <div>
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              Programações do mês
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Relação detalhada das atividades encontradas para o período e filtros
              selecionados.
            </p>
          </div>

          {carregando ? (
            <LoadingList />
          ) : programacoesFiltradas.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma programação encontrada"
              descricao="Altere o mês, ajuste os filtros ou cadastre uma nova programação de EPS."
            />
          ) : (
            programacoesFiltradas.map((programacao) => (
              <ProgramacaoCard
                key={programacao.id}
                programacao={programacao}
                reduceMotion={reduceMotion}
                onEditar={() => handleEditar(programacao)}
                onExcluir={() => pedirExclusao(programacao)}
              />
            ))
          )}
        </section>
      </main>

      <Footer />

      <ModalCalendarioAnualEPS
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setProgramacaoEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setProgramacaoEmEdicao(null);
          carregarDados();
        }}
        solicitacao={programacaoEmEdicao}
        unidades={unidades}
        departamentos={departamentosNormalizados}
        podeEditarStatus={false}
      />
    </div>
  );
}

function ActionBar({ carregando, onRefresh, onCriar }) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onCriar}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
      >
        <Plus className="h-4 w-4" />
        Nova programação
      </button>

      <button
        type="button"
        onClick={onRefresh}
        disabled={carregando}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
      >
        <RefreshCcw className={cx("h-4 w-4", carregando && "animate-spin")} />
        {carregando ? "Atualizando..." : "Atualizar dados"}
      </button>
    </section>
  );
}

function KpiGrid({ kpis, totalVisiveisMes }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={CalendarDays} label="Total anual" value={kpis.total} tone="cyan" />
      <KpiCard icon={Users} label="Minhas" value={kpis.minhas} tone="violet" />
      <KpiCard icon={Clock} label="Em análise" value={kpis.emAnalise} tone="amber" />
      <KpiCard icon={CheckCircle2} label="Aprovadas" value={kpis.aprovadas} tone="emerald" />
      <KpiCard icon={Filter} label="No mês" value={totalVisiveisMes} tone="sky" />
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, tone }) {
  const tones = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    sky: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/25 dark:text-sky-100",
  };

  return (
    <div className={cx("rounded-3xl border p-4 shadow-sm", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-75">
          {label}
        </p>
        <Icon className="h-5 w-5 opacity-80" />
      </div>

      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function ResumoDepartamentos({ resumoMensal = [], resumoAnual = [], mes, ano }) {
  const totalMensal = resumoMensal.reduce(
    (acc, item) => acc + Number(item.total || 0),
    0
  );

  const totalAnual = resumoAnual.reduce(
    (acc, item) => acc + Number(item.total || 0),
    0
  );

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Resumo por departamento">
      <ResumoCard
        icon={CalendarDays}
        title="Programações no mês"
        subtitle={`${mes} · ${totalMensal} programação(ões)`}
        itens={resumoMensal}
      />

      <ResumoCard
        icon={GraduationCap}
        title="Programações no ano"
        subtitle={`${ano} · ${totalAnual} programação(ões)`}
        itens={resumoAnual}
      />
    </section>
  );
}

function ResumoCard({ icon: Icon, title, subtitle, itens }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>

        <Icon className="h-5 w-5 text-emerald-600" />
      </div>

      <DepartamentoResumoLista itens={itens} />
    </div>
  );
}

function DepartamentoResumoLista({ itens = [] }) {
  if (!Array.isArray(itens) || itens.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
        Nenhum dado disponível para o período.
      </p>
    );
  }

  const maior = Math.max(...itens.map((item) => Number(item.total || 0)), 1);

  return (
    <div className="space-y-3">
      {itens.map((item) => {
        const total = Number(item.total || 0);
        const percentual = Math.round((total / maior) * 100);

        return (
          <div key={item.departamento} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.departamento_cor || "#64748b" }}
                  aria-hidden="true"
                />
                <span className="truncate font-bold text-slate-700 dark:text-slate-200">
                  {item.departamento_label || item.departamento}
                </span>
              </div>

              <span className="font-black text-slate-900 dark:text-white">
                {total}
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percentual}%`,
                  backgroundColor: item.departamento_cor || "#64748b",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertBox({ tone, icon: Icon, title, message }) {
  const tones = {
    rose:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  };

  return (
    <div className={cx("rounded-2xl border p-4 text-sm", tones[tone])}>
      <div className="flex gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" />
        <div>
          <p className="font-black">{title}</p>
          <p className="mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

function MonthNavigator({ currentMonthYear, setCurrentMonthYear }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
      <button
        type="button"
        onClick={() =>
          setCurrentMonthYear((previous) =>
            previous.month === 0
              ? { year: previous.year - 1, month: 11 }
              : { year: previous.year, month: previous.month - 1 }
          )
        }
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="min-w-[180px] text-center text-sm font-black text-slate-900 dark:text-white">
        {monthLabel(currentMonthYear)}
      </span>

      <button
        type="button"
        onClick={() =>
          setCurrentMonthYear((previous) =>
            previous.month === 11
              ? { year: previous.year + 1, month: 0 }
              : { year: previous.year, month: previous.month + 1 }
          )
        }
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
        aria-label={`Filtrar por ${label}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchInput({ value, onChange, onClear }) {
  return (
    <label className="block xl:col-span-1">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
        Busca
      </span>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Título, descrição, departamento, unidade, palestrante..."
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Buscar programações de EPS"
        />

        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </label>
  );
}

function Chip({ text, onClear }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
      {text}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-emerald-900/40"
        aria-label={`Remover filtro: ${text}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function CalendarioMensal({
  currentMonthYear,
  programacoesPorDia,
  onProgramacaoClick,
}) {
  const { year, month } = currentMonthYear;
  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
  const primeiroDiaSemana = new Date(year, month, 1).getDay();
  const diasNoMes = new Date(year, month + 1, 0).getDate();

  const celulas = [];

  for (let index = 0; index < primeiroDiaSemana; index += 1) {
    celulas.push({ tipo: "vazio", key: `blank-${index}` });
  }

  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    const diaStr = String(dia).padStart(2, "0");

    celulas.push({
      tipo: "dia",
      key: `dia-${dia}`,
      dia,
      programacoes: programacoesPorDia[diaStr] || [],
    });
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-700">
      <div className="grid grid-cols-7 bg-slate-100 text-center text-xs font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        {diasSemana.map((dia, index) => (
          <div key={`${dia}-${index}`} className="px-1 py-3">
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white text-xs dark:bg-slate-950">
        {celulas.map((cell) => {
          if (cell.tipo === "vazio") {
            return (
              <div
                key={cell.key}
                className="h-28 border border-slate-50 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-900/30"
              />
            );
          }

          return (
            <div
              key={cell.key}
              className="flex h-32 flex-col border border-slate-50 p-1.5 dark:border-slate-900"
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-black text-slate-700 dark:text-slate-200">
                  {cell.dia}
                </span>

                {cell.programacoes.length > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {cell.programacoes.length}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {cell.programacoes.slice(0, 3).map((programacao) => (
                  <button
                    key={`${cell.key}-${programacao.id}`}
                    type="button"
                    onClick={() => {
                      if (programacao.pode_editar) {
                        onProgramacaoClick(programacao);
                      }
                    }}
                    disabled={!programacao.pode_editar}
                    className={cx(
                      "truncate rounded-lg px-2 py-1 text-left text-[10px] font-bold text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-400",
                      programacao.pode_editar
                        ? "hover:brightness-110"
                        : "cursor-default opacity-80"
                    )}
                    style={{
                      backgroundColor: programacao.departamento_cor || "#64748b",
                    }}
                    title={`${programacao.departamento || "EPS"} · ${
                      programacao.titulo
                    }`}
                    aria-label={
                      programacao.pode_editar
                        ? `Abrir programação: ${programacao.titulo}`
                        : `Programação sem permissão de edição: ${programacao.titulo}`
                    }
                  >
                    {programacao.titulo}
                  </button>
                ))}

                {cell.programacoes.length > 3 ? (
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    + {cell.programacoes.length - 3} programação(ões)
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgramacaoCard({ programacao, reduceMotion, onEditar, onExcluir }) {
  const palestrantes =
    (programacao.palestrantes || [])
      .map((item) => item?.nome)
      .filter(Boolean)
      .join(", ") || "A definir";

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/80 sm:p-5"
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: programacao.departamento_cor || "#64748b" }}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {programacao.titulo}
            </h3>

            <StatusBadge status={programacao.status} />

            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black text-white"
              style={{
                backgroundColor: programacao.departamento_cor || "#64748b",
              }}
            >
              {programacao.departamento_label || programacao.departamento}
            </span>

            {programacao.pode_editar ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                Minha programação
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {programacao.descricao || "Sem descrição detalhada informada."}
          </p>
        </div>

        {programacao.pode_editar ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </button>

            <button
              type="button"
              onClick={onExcluir}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/60"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoBox
          icon={CalendarDays}
          title="Datas"
          value={resumirDatas(programacao.datas)}
        />
        <InfoBox
          icon={Clock}
          title="Horários"
          value={resumirHorarios(programacao.datas)}
        />
        <InfoBox
          icon={MapPin}
          title="Local / Unidade"
          value={`${programacao.local || "Local a definir"}${
            programacao.unidade_nome ? ` — ${programacao.unidade_nome}` : ""
          }`}
        />
        <InfoBox
          icon={Users}
          title="Público-alvo"
          value={programacao.publico_alvo || "Público a definir"}
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <InfoBox icon={GraduationCap} title="Palestrantes" value={palestrantes} />

        <div className="flex flex-wrap items-center gap-2">
          {programacao.restrito ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <Lock className="h-3.5 w-3.5" />
              Restrito: {programacao.restricao_descricao || "Acesso limitado"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <Globe2 className="h-3.5 w-3.5" />
              Acesso livre
            </span>
          )}

          {programacao.modalidade ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {programacao.modalidade}
            </span>
          ) : null}

          {typeof programacao.carga_horaria_total === "number" ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {programacao.carga_horaria_total}h
            </span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function StatusBadge({ status }) {
  const info = statusInfo(status);

  const tones = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
    sky:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200",
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black",
        tones[info.tone] || tones.slate
      )}
    >
      {info.label}
    </span>
  );
}

function InfoBox({ icon: Icon, title, value }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
          {title}
        </p>
        <p
          className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200"
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/80"
        >
          <Skeleton height={22} width="60%" />
          <div className="mt-3 space-y-2">
            <Skeleton height={14} />
            <Skeleton height={14} width="80%" />
            <Skeleton height={14} width="50%" />
          </div>
        </div>
      ))}
    </>
  );
}