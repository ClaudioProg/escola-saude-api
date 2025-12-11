// ✅ src/pages/SolicitacaoCursoAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  CalendarDays,
  MapPin,
  Users,
  Lock,
  Clock,
  School,
  Filter,
  Edit2,
  Trash2,
  Globe2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import api from "../services/api";
import NadaEncontrado from "../components/NadaEncontrado";
import Footer from "../components/Footer";
import ModalSolicitacaoCurso from "../components/ModalSolicitacaoCurso";

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

/* -----------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------- */
function resumirDatas(datas = []) {
  if (!datas.length) return "Datas a definir";
  const ordenadas = [...datas].sort((a, b) => a.data.localeCompare(b.data));
  const primeira = ordenadas[0].data;
  const ultima = ordenadas[ordenadas.length - 1].data;
  if (primeira === ultima)
    return `Dia ${primeira.split("-").reverse().join("/")}`;
  return `De ${primeira.split("-").reverse().join("/")} a ${ultima
    .split("-")
    .reverse()
    .join("/")}`;
}

function resumirHorarios(datas = []) {
  const horarios = datas
    .map((d) => d.horario_inicio)
    .filter(Boolean)
    .slice(0, 2);
  if (!horarios.length) return "Horários a definir";
  if (horarios.length === 1) return `A partir das ${horarios[0]}h`;
  return `Início às ${horarios[0]}h (demais dias similares)`;
}

function badgeStatus(status) {
  switch (status) {
    case "planejado":
      return { label: "Planejado", className: "bg-amber-100 text-amber-800" };
    case "em_analise":
      return { label: "Em análise", className: "bg-sky-100 text-sky-800" };
    case "confirmado":
      return { label: "Confirmado", className: "bg-emerald-100 text-emerald-800" };
    case "cancelado":
      return {
        label: "Cancelado",
        className: "bg-rose-100 text-rose-800 line-through",
      };
    default:
      return { label: "Sem status", className: "bg-slate-100 text-slate-700" };
  }
}

/* -----------------------------------------------------------
 * COMPONENTE PRINCIPAL (ADMIN)
 * ----------------------------------------------------------- */
export default function SolicitacaoCursoAdmin() {
  const [cursos, setCursos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [unidades, setUnidades] = useState([]);
  const [tipos, setTipos] = useState([]);

  const hoje = new Date();
  const [currentMonthYear, setCurrentMonthYear] = useState({
    year: hoje.getFullYear(),
    month: hoje.getMonth(),
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [solicitacaoEmEdicao, setSolicitacaoEmEdicao] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  /* -----------------------------------------------------------
   * 🔄 Carregar dados (usando mesmas rotas da página usuário)
   * ----------------------------------------------------------- */
  async function carregarDados() {
    try {
      setCarregando(true);

      const [cursosRes, unidadesRes, tiposRes] = await Promise.all([
        api.get("/api/solicitacoes-curso"),
        api.get("/api/unidades"),
        api.get("/api/solicitacoes-curso/tipos"),
      ]);

      console.log("[SolicitacaoCursoAdmin] cursosRes =", cursosRes);
      console.log("[SolicitacaoCursoAdmin] unidadesRes =", unidadesRes);
      console.log("[SolicitacaoCursoAdmin] tiposRes =", tiposRes);

      setCursos(Array.isArray(cursosRes) ? cursosRes : cursosRes?.data || []);
      setUnidades(
        Array.isArray(unidadesRes) ? unidadesRes : unidadesRes?.data || []
      );
      setTipos(Array.isArray(tiposRes) ? tiposRes : tiposRes?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar as solicitações de curso.");
    } finally {
      setCarregando(false);
    }
  }

  /* ----------------------------------------------------------- */
  const cursosFiltrados = useMemo(() => {
    const { year, month } = currentMonthYear;
    const mesStr = String(month + 1).padStart(2, "0");

    return cursos.filter((curso) => {
      let ok = true;

      const temNoMes = (curso.datas || []).some((d) => {
        if (!d.data) return false;
        const [ano, mes] = d.data.split("-");
        return ano === String(year) && mes === mesStr;
      });

      if (!temNoMes) ok = false;

      if (filtroUnidade && String(curso.unidade_id) !== String(filtroUnidade)) {
        ok = false;
      }

      if (filtroTipo && curso.tipo !== filtroTipo) {
        ok = false;
      }

      if (filtroStatus && curso.status !== filtroStatus) {
        ok = false;
      }

      return ok;
    });
  }, [cursos, currentMonthYear, filtroUnidade, filtroTipo, filtroStatus]);

  const cursosPorDia = useMemo(() => {
    const map = {};
    const { year, month } = currentMonthYear;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

    for (const curso of cursosFiltrados) {
      for (const d of curso.datas || []) {
        if (!d.data?.startsWith(prefix)) continue;
        const dia = d.data.slice(-2);
        if (!map[dia]) map[dia] = [];
        map[dia].push(curso);
      }
    }

    return map;
  }, [cursosFiltrados, currentMonthYear]);

  const kpis = useMemo(() => {
    const total = cursos.length;
    const planejados = cursos.filter((c) => c.status === "planejado").length;
    const emAnalise = cursos.filter((c) => c.status === "em_analise").length;
    const confirmados = cursos.filter((c) => c.status === "confirmado").length;
    const cancelados = cursos.filter((c) => c.status === "cancelado").length;

    return { total, planejados, emAnalise, confirmados, cancelados };
  }, [cursos]);

  function handleEditar(curso) {
    setSolicitacaoEmEdicao(curso);
    setModalAberto(true);
  }

  async function handleExcluir(curso) {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir a solicitação do curso "${curso.titulo}"?`
    );
    if (!confirmar) return;

    try {
      await api.delete(`/api/solicitacoes-curso/${curso.id}`);
      toast.success("Solicitação excluída com sucesso.");
      setCursos((prev) => prev.filter((c) => c.id !== curso.id));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir solicitação. Tente novamente.");
    }
  }

  /* ----------------------------------------------------------- */
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* HeaderHero administrador */}
      <header className="bg-gradient-to-br from-sky-800 via-sky-700 to-indigo-800 text-white shadow-lg">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                <CalendarDays className="h-4 w-4" />
                <span>Painel do Administrador</span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
                Gestão do calendário de cursos
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-sky-100">
                Visualize, acompanhe e atualize o status das solicitações de
                cursos cadastradas por toda a rede de saúde.
              </p>
            </div>
          </div>

          {/* Ministats admin */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat
              label="Total de solicitações"
              value={kpis.total}
              icon={CalendarDays}
              variant="default"
            />
            <MiniStat
              label="Planejados"
              value={kpis.planejados}
              icon={Clock}
              variant="accent"
            />
            <MiniStat
              label="Em análise / Confirmados"
              value={`${kpis.emAnalise} / ${kpis.confirmados}`}
              icon={School}
              variant="success"
            />
            <MiniStat
              label="Cancelados"
              value={kpis.cancelados}
              icon={Lock}
              variant="warning"
            />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        {/* Agenda + filtros admin */}
        <section className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4" />
              <span>Agenda mensal de solicitações (admin)</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 0
                      ? { year: prev.year - 1, month: 11 }
                      : { year: prev.year, month: prev.month - 1 }
                  )
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[140px] text-center text-sm font-semibold text-slate-700">
                {MESES[currentMonthYear.month].label} de {currentMonthYear.year}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentMonthYear((prev) =>
                    prev.month === 11
                      ? { year: prev.year + 1, month: 0 }
                      : { year: prev.year, month: prev.month + 1 }
                  )
                }
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium text-slate-600">Unidade</label>
              <select
                value={filtroUnidade}
                onChange={(e) => setFiltroUnidade(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Todas</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium text-slate-600">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <label className="font-medium text-slate-600">Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="">Todos</option>
                <option value="planejado">Planejado</option>
                <option value="em_analise">Em análise</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <CalendarioMensalAdmin
            currentMonthYear={currentMonthYear}
            cursosPorDia={cursosPorDia}
            // 👇 clique no curso abre edição/detalhe
            onCursoClick={handleEditar}
          />
        </section>

        {/* Lista detalhada */}
        <section aria-label="Solicitações de curso (admin)" className="space-y-3">
          {carregando ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white p-4 shadow-sm">
                <Skeleton height={18} width="60%" />
                <div className="mt-2 space-y-2">
                  <Skeleton height={12} />
                  <Skeleton height={12} width="80%" />
                  <Skeleton height={12} width="50%" />
                </div>
              </div>
            ))
          ) : cursosFiltrados.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhuma solicitação encontrada nos filtros selecionados."
              descricao="Altere o mês, ajuste os filtros ou aguarde novas solicitações da rede."
            />
          ) : (
            cursosFiltrados.map((curso) => {
              const statusInfo = badgeStatus(curso.status);
              const palestrantesStr =
                (curso.palestrantes || []).map((p) => p.nome).join(", ") ||
                "A definir";

              return (
                <motion.article
                  key={curso.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="group rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:shadow-md hover:ring-sky-100"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-800">
                          {curso.titulo}
                        </h2>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                          Criado por: {curso.criador_nome || "Não informado"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {curso.descricao || "Sem descrição detalhada informada."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 sm:mt-1">
                      <button
                        type="button"
                        onClick={() => handleEditar(curso)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExcluir(curso)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-sky-600" />
                      <div>
                        <p className="font-medium">Datas</p>
                        <p>{resumirDatas(curso.datas)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Clock className="mt-0.5 h-4 w-4 text-sky-600" />
                      <div>
                        <p className="font-medium">Horários</p>
                        <p>{resumirHorarios(curso.datas)}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-sky-600" />
                      <div>
                        <p className="font-medium">Local / Unidade</p>
                        <p className="line-clamp-2">
                          {curso.local || "Local a definir"}
                          {curso.unidade_nome ? ` — ${curso.unidade_nome}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 text-sky-600" />
                      <div>
                        <p className="font-medium">Público-alvo</p>
                        <p className="line-clamp-2">
                          {curso.publico_alvo || "Público a definir"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-[2fr,1fr]">
                    <div className="flex items-start gap-2">
                      <School className="mt-0.5 h-4 w-4 text-sky-600" />
                      <div>
                        <p className="font-medium">Palestrantes</p>
                        <p className="line-clamp-2">{palestrantesStr}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {curso.restrito ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                          <Lock className="h-3.5 w-3.5" />
                          Restrito: {curso.restricao_descricao || "Acesso limitado"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                          <Globe2 className="h-3.5 w-3.5" />
                          Acesso livre na rede
                        </span>
                      )}

                      {curso.modalidade && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {curso.modalidade === "presencial"
                            ? "Presencial"
                            : curso.modalidade === "online"
                            ? "On-line"
                            : "Híbrido"}
                        </span>
                      )}

                      {typeof curso.carga_horaria_total === "number" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {curso.carga_horaria_total}h
                        </span>
                      )}
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </section>
      </main>

      <Footer />

      {/* Modal admin com edição de status liberada */}
      <ModalSolicitacaoCurso
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setSolicitacaoEmEdicao(null);
        }}
        onSaved={() => {
          setModalAberto(false);
          setSolicitacaoEmEdicao(null);
          carregarDados();
        }}
        solicitacao={solicitacaoEmEdicao}
        unidades={unidades}
        podeEditarStatus={true}
      />
    </div>
  );
}

/* ─────────── Calendário mensal admin ─────────── */

function CalendarioMensalAdmin({ currentMonthYear, cursosPorDia, onCursoClick }) {
  const { year, month } = currentMonthYear;

  const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
  const primeiroDiaSemana = new Date(year, month, 1).getDay();
  const diasNoMes = new Date(year, month + 1, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push({ tipo: "vazio", key: `blank-${i}` });
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const diaStr = String(dia).padStart(2, "0");
    const cursosDoDia = cursosPorDia[diaStr] || [];
    celulas.push({
      tipo: "dia",
      key: `dia-${dia}`,
      dia,
      cursos: cursosDoDia,
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100">
      <div className="grid grid-cols-7 bg-slate-50 text-center text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {diasSemana.map((d, idx) => (
          <div key={`${d}-${idx}`} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 bg-white text-xs">
        {celulas.map((cell) => {
          if (cell.tipo === "vazio") {
            return <div key={cell.key} className="h-20 border border-slate-50" />;
          }

          const { dia, cursos } = cell;

          return (
            <div
              key={cell.key}
              className="flex h-24 flex-col border border-slate-50 p-1.5 align-top"
            >
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">{dia}</span>
                {cursos.length > 0 && (
                  <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                    {cursos.length}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {cursos.slice(0, 3).map((curso) => (
                  <button
                    key={curso.id}
                    type="button"
                    onClick={() => onCursoClick && onCursoClick(curso)}
                    className="truncate rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 text-left hover:bg-sky-100 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    title={curso.titulo}
                  >
                    {curso.titulo}
                  </button>
                ))}
                {cursos.length > 3 && (
                  <div className="text-[10px] font-medium text-slate-500">
                    + {cursos.length - 3} curso(s)
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── MiniStat admin ─────────── */

function MiniStat({ label, value, icon: Icon, variant = "default" }) {
  const base =
    "flex items-center justify-between rounded-xl border px-3 py-2 text-xs shadow-sm";
  const variants = {
    default: "border-white/20 bg-white/10 text-sky-50",
    accent: "border-amber-200/70 bg-amber-50/20 text-amber-50",
    success: "border-emerald-200/70 bg-emerald-50/20 text-emerald-50",
    warning: "border-rose-200/70 bg-rose-50/20 text-rose-50",
  };

  return (
    <div className={`${base} ${variants[variant] || variants.default}`}>
      <div>
        <p className="text-[11px] opacity-80">{label}</p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </div>
      <div className="rounded-full bg-black/10 p-1.5">
        <Icon className="h-4 w-4 opacity-90" />
      </div>
    </div>
  );
}
