// ✅ src/pages/MinhasInscricoes.jsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  User,
  LineChart,
  CalendarClock,
  CalendarDays,
  MapPin,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiDelete } from "../services/api";
import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";
import { formatarDataBrasileira } from "../utils/data";

/* ──────────────────────────────────────────────────────────────
   Header Hero
   ────────────────────────────────────────────────────────────── */
function MinhasInscricoesHero({ onRefresh, total, programados, andamento, updatedAt }) {
  return (
    <header role="banner" className="bg-gradient-to-br from-emerald-900 via-emerald-700 to-emerald-600 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center gap-2">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Meus Cursos</h1>
        </div>

        <p className="text-sm text-white/90 max-w-xl">
          Visualize suas inscrições <strong>ativas</strong> (eventos programados ou em andamento).
        </p>

        <section aria-label="Resumo de inscrições" className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl">
          <StatCard icon={<LineChart className="w-4 h-4" />} label="Ativas" value={total} />
          <StatCard icon={<Clock className="w-4 h-4" />} label="Programados" value={programados} tone="success" />
          <StatCard icon={<CalendarClock className="w-4 h-4" />} label="Em andamento" value={andamento} tone="warning" />
          <StatCard icon={<RefreshCw className="w-4 h-4" />} label="Atualizado" value={updatedAt ? updatedAt : "—"} small />
        </section>

        <BotaoPrimario
          onClick={onRefresh}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          aria-label="Atualizar minhas inscrições"
        >
          Atualizar
        </BotaoPrimario>
      </div>
    </header>
  );
}

function StatCard({ icon, label, value, small = false, tone = "default" }) {
  const toneClasses =
    tone === "success"
      ? "bg-white/10 border-emerald-400/50"
      : tone === "warning"
      ? "bg-white/10 border-amber-400/50"
      : "bg-white/10 border-white/20";

  return (
    <div className={`rounded-2xl border ${toneClasses} px-3 py-3 text-left backdrop-blur-sm`} role="status" aria-live="polite">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/80">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className={`mt-1 font-bold ${small ? "text-base" : "text-2xl"}`}>{value}</div>
    </div>
  );
}

/* ───────────── Helpers anti-fuso ───────────── */
function ymd(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
}
function hms(s, fallback = "00:00:00") {
  const [hh, mm, ss] = String(s || fallback).split(":").map((n) => parseInt(n, 10) || 0);
  return { hh, mm, ss };
}
function makeLocalDate(yyyy_mm_dd, time = "00:00:00") {
  const d = ymd(yyyy_mm_dd);
  const t = hms(time);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, t.ss, 0) : new Date(NaN);
}
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
function safeTs(dateIso, time) {
  const d = makeLocalDate(dateIso, time);
  return isValidDate(d) ? d.getTime() : 0;
}
const fmtHora = (v) => (typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : "");

/* ───────────── Google Agenda ───────────── */
function buildAgendaHref(item) {
  try {
    const inicioStr = `${item?.data_inicio ?? ""} ${item?.horario_inicio ?? "00:00"}`.trim();
    const fimStr = item?.data_fim ? `${item.data_fim} ${item?.horario_fim ?? "23:59"}`.trim() : undefined;
    const descTurma = item?.turma_nome ? `\nTurma: ${item.turma_nome}` : "";
    return gerarLinkGoogleAgenda({
      titulo: item?.titulo ?? "",
      dataInicio: inicioStr,
      dataFim: fimStr,
      descricao: `Evento: ${item?.titulo ?? ""} organizado pela Escola da Saúde.${descTurma}`,
      local: item?.local || "Santos/SP",
    });
  } catch {
    return null;
  }
}

/* ───────────── Status + estilos ───────────── */
function obterStatusEvento(dataInicioISO, dataFimISO, horarioInicio, horarioFim) {
  const fimISO = dataFimISO || dataInicioISO;
  const inicio = makeLocalDate(dataInicioISO, horarioInicio || "00:00:00");
  const fim = makeLocalDate(fimISO, horarioFim || "23:59:59");
  const agora = new Date();
  if (isValidDate(inicio) && isValidDate(fim)) {
    if (agora < inicio) return "Programado";
    if (agora > fim) return "Encerrado";
    return "Em andamento";
  }
  const di = String(dataInicioISO || "").slice(0, 10);
  const df = String(fimISO || "").slice(0, 10);
  const hojeISO = new Date().toISOString().slice(0, 10);
  if (di && df) {
    if (hojeISO < di) return "Programado";
    if (hojeISO > df) return "Encerrado";
    return "Em andamento";
  }
  return "Programado";
}

function statusClasses(status) {
  if (status === "Programado") {
    return {
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />,
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
      bar: "from-emerald-500 via-emerald-400 to-emerald-600",
      ring: "focus:ring-emerald-500/70",
    };
  }
  if (status === "Em andamento") {
    return {
      text: "text-amber-700 dark:text-amber-400",
      icon: <CheckCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />,
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
      bar: "from-amber-500 via-amber-400 to-amber-600",
      ring: "focus:ring-amber-500/70",
    };
  }
  return {
    text: "text-red-700 dark:text-red-400",
    icon: <XCircle className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" />,
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    bar: "from-rose-500 via-rose-400 to-rose-600",
    ring: "focus:ring-rose-500/70",
  };
}

/* Mini componente genérico para “stat” */
function StatItem({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-zinc-800/60 px-3 py-2 flex items-center gap-2">
      {icon}
      <div className="text-xs">
        <div className="text-gray-500 dark:text-gray-400">{label}</div>
        <div className="font-medium text-gray-900 dark:text-white">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function MinhasInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState("");

  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario")) || {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    buscarInscricoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarInscricoes() {
    setCarregando(true);
    try {
      const data = await apiGet("/api/inscricoes/minhas");
      const arr = Array.isArray(data) ? data : [];

      const ordenadas = [...arr].sort((a, b) => {
        const aEnd = safeTs(a.data_fim || a.data_inicio, a.horario_fim || a.horario_inicio || "23:59:59");
        const bEnd = safeTs(b.data_fim || b.data_inicio, b.horario_fim || b.horario_inicio || "23:59:59");
        return bEnd - aEnd;
      });

      const ativas = ordenadas.filter((item) => {
        const status = obterStatusEvento(item.data_inicio, item.data_fim, item.horario_inicio, item.horario_fim);
        const fimISO = (item.data_fim || item.data_inicio || "").slice(0, 10);
        const hojeISO = new Date().toISOString().slice(0, 10);
        const encerradoPeloISO = fimISO && fimISO < hojeISO;
        return (status === "Programado" || status === "Em andamento") && !encerradoPeloISO;
      });

      setInscricoes(ativas);
      setErro("");
      setUpdatedAt(new Date().toLocaleString());
    } catch {
      setErro("Erro ao carregar inscrições");
      toast.error("❌ Erro ao carregar inscrições.");
    } finally {
      setCarregando(false);
    }
  }

  async function cancelarInscricao(id) {
    if (!window.confirm("Tem certeza que deseja cancelar sua inscrição?")) return;
    setCancelandoId(id);
    try {
      await apiDelete(`/api/inscricoes/${id}`);
      toast.success("✅ Inscrição cancelada com sucesso.");
      await buscarInscricoes();
    } catch (err) {
      const status = err?.status || err?.response?.status || 0;
      const data = err?.data || err?.response?.data || {};
      const msg = data?.mensagem || data?.message || err?.message || "Sem conexão";
      toast.error(`❌ Erro ao cancelar inscrição${status ? ` (${status})` : ""}. ${msg}`);
      if (status === 401) toast.info("Sua sessão pode ter expirado. Abra no navegador e refaça o login.");
    } finally {
      setCancelandoId(null);
    }
  }

  const totalAtivas = inscricoes.length;
  const contProgramados = useMemo(
    () => inscricoes.filter((it) => obterStatusEvento(it.data_inicio, it.data_fim, it.horario_inicio, it.horario_fim) === "Programado").length,
    [inscricoes]
  );
  const contAndamento = totalAtivas - contProgramados;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <MinhasInscricoesHero
        onRefresh={buscarInscricoes}
        total={totalAtivas}
        programados={contProgramados}
        andamento={contAndamento}
        updatedAt={updatedAt}
      />

      <main role="main" className="flex-1 px-3 sm:px-4 py-6">
        {carregando ? (
          <div className="space-y-4 max-w-md mx-auto" role="status" aria-live="polite">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={140} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div className="text-center space-y-3">
            <p className="text-red-600 dark:text-red-400" aria-live="assertive">{erro}</p>
            <div className="flex justify-center">
              <BotaoSecundario onClick={buscarInscricoes} aria-label="Tentar novamente">Tentar novamente</BotaoSecundario>
            </div>
          </div>
        ) : inscricoes.length === 0 ? (
          <NadaEncontrado mensagem="📭 Você não possui inscrições ativas." sugestao="Acesse a página de eventos para se inscrever." />
        ) : (
          <ul className="space-y-5 w-full sm:max-w-3xl mx-auto" role="list" aria-label="Lista de inscrições ativas">
            <AnimatePresence>
              {inscricoes.map((item) => {
                const status = obterStatusEvento(item.data_inicio, item.data_fim, item.horario_inicio, item.horario_fim);
                const agendaHref = buildAgendaHref(item);
                const podeAgendar = Boolean(agendaHref);

                const instrutores = Array.isArray(item.instrutor)
                  ? item.instrutor.map((i) => i?.nome || String(i)).filter(Boolean)
                  : String(item.instrutor || "").split(",").map((n) => n.trim()).filter(Boolean);

                const periodoFmt = [formatarDataBrasileira(item.data_inicio), formatarDataBrasileira(item.data_fim)]
                  .filter(Boolean)
                  .join(" até ");
                const hi = fmtHora(item.horario_inicio);
                const hf = fmtHora(item.horario_fim);
                const inscricaoFmt = formatarDataBrasileira(item.data_inscricao);

                const s = statusClasses(status);

                return (
                  <motion.li
                    key={item.inscricao_id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                    className={`group rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-neutral-900 shadow-sm hover:shadow-lg focus-within:shadow-lg transition overflow-hidden`}
                    role="listitem"
                  >
                    {/* barrinha colorida */}
                    <div className={`h-1 w-full bg-gradient-to-r ${s.bar}`} aria-hidden="true" />

                    <div className={`p-4 sm:p-5 focus:outline-none ${s.ring}`}>
                      {/* cabeçalho */}
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="flex-1 flex items-center gap-2 text-lg sm:text-xl font-semibold text-lousa dark:text-white">
                          <BookOpen className="w-5 h-5 opacity-80" aria-hidden="true" />
                          {item.titulo}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.badge}`} aria-label={`Status do evento: ${status}`}>
                          {status}
                        </span>
                      </div>

                      {/* turma (logo abaixo do título) */}
                      <div className="mt-1 text-sm font-bold text-orange-600">
                        {item.turma_nome ? `Turma: ${item.turma_nome}` : "Turma: —"}
                      </div>

                      {/* 3 stats: Período, Horário, Inscrição realizada */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <StatItem
                          icon={<CalendarDays className="w-4 h-4 text-gray-500 dark:text-gray-300" />}
                          label="Período"
                          value={periodoFmt || "—"}
                        />
                        <StatItem
                          icon={<Clock className="w-4 h-4 text-gray-500 dark:text-gray-300" />}
                          label="Horário"
                          value={hi && hf ? `${hi} às ${hf}` : "a definir"}
                        />
                        <StatItem
                          icon={<CheckCircle className="w-4 h-4 text-gray-500 dark:text-gray-300" />}
                          label="Inscrição realizada"
                          value={inscricaoFmt || "—"}
                        />
                      </div>

                      {/* separador */}
                      <div className="my-4 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                      {/* instrutores + local abaixo */}
                      <div className="text-sm italic text-gray-600 dark:text-gray-300">
                        <div className="flex items-start gap-2">
                          <User className="w-4 h-4 mt-0.5" aria-hidden="true" />
                          <div>
                            Instrutor(es):{" "}
                            {instrutores.length ? (
                              <ul className="list-disc list-inside">
                                {instrutores.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="italic text-gray-500">a definir</span>
                            )}
                          </div>
                        </div>

                        {/* Local abaixo do instrutor */}
                        <div className="mt-2 not-italic text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <MapPin className="w-4 h-4" aria-hidden="true" />
                          <span>
                            <strong>Local:</strong> {item.local || "A definir"}
                          </span>
                        </div>
                      </div>

                      {/* status textual */}
                      <p className={`text-sm mt-3 font-semibold inline-flex items-center gap-1 ${s.text}`}>
                        {s.icon}
                        <span>Status: {status}</span>
                      </p>

                      {/* ações */}
                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                        <BotaoSecundario
                          as="a"
                          href={agendaHref || "#"}
                          onClick={(e) => {
                            if (!podeAgendar) {
                              e.preventDefault();
                              toast.info("Não foi possível gerar o link da Google Agenda para este curso.");
                            }
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full sm:w-auto ${!podeAgendar ? "opacity-60" : ""}`}
                          aria-label="Adicionar curso à Google Agenda"
                          aria-disabled={!podeAgendar}
                          title={podeAgendar ? "Adicionar ao Google Agenda" : "Datas insuficientes para agendar"}
                        >
                          Adicionar ao Google Agenda
                        </BotaoSecundario>

                        <BotaoPrimario
                          className="w-full sm:w-auto"
                          aria-label="Cancelar inscrição no curso"
                          onClick={() => cancelarInscricao(item.inscricao_id)}
                          disabled={status !== "Programado" || cancelandoId === item.inscricao_id}
                        >
                          {cancelandoId === item.inscricao_id ? "Cancelando..." : "Cancelar Inscrição"}
                        </BotaoPrimario>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </main>

      <Footer />
    </div>
  );
}
