// ✅ src/pages/MinhasInscricoes.jsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Clock, CheckCircle, XCircle, RefreshCw, User, LineChart, CalendarClock
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
   Header Hero  — gradiente 3 cores exclusivo
   ────────────────────────────────────────────────────────────── */
function MinhasInscricoesHero({ onRefresh, total, programados, andamento, updatedAt }) {
  return (
    <header
      role="banner"
      className="bg-gradient-to-br from-emerald-900 via-emerald-700 to-emerald-600 text-white"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center gap-2">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Meus Cursos
          </h1>
        </div>

        <p className="text-sm text-white/90 max-w-xl">
          Visualize suas inscrições <strong>ativas</strong> (eventos programados ou em andamento).
        </p>

        {/* Mini-stats (não removem nada existente) */}
        <section
          aria-label="Resumo de inscrições"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl"
        >
          <StatCard
            icon={<LineChart className="w-4 h-4" aria-hidden="true" />}
            label="Ativas"
            value={total}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" aria-hidden="true" />}
            label="Programados"
            value={programados}
            // Programado = Verde (padrão global memorizado)
            tone="success"
          />
          <StatCard
            icon={<CalendarClock className="w-4 h-4" aria-hidden="true" />}
            label="Em andamento"
            value={andamento}
            // Em andamento = Amarelo (padrão global memorizado)
            tone="warning"
          />
          <StatCard
            icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            label="Atualizado"
            value={updatedAt ? updatedAt : "—"}
            small
          />
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

/* Mini card reutilizável para stats */
function StatCard({ icon, label, value, small = false, tone = "default" }) {
  const toneClasses =
    tone === "success"
      ? "bg-white/10 border-emerald-400/50"
      : tone === "warning"
      ? "bg-white/10 border-amber-400/50"
      : "bg-white/10 border-white/20";

  return (
    <div
      className={`rounded-2xl border ${toneClasses} px-3 py-3 text-left backdrop-blur-sm`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/80">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className={`mt-1 font-bold ${small ? "text-base" : "text-2xl"}`}>
        {value}
      </div>
    </div>
  );
}

/* ───────────── Helpers anti-fuso (datas locais) ───────────── */
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

/* ───────────── Google Agenda (string-safe) ───────────── */
function buildAgendaHref(item) {
  try {
    const inicioStr = `${item?.data_inicio ?? ""} ${item?.horario_inicio ?? "00:00"}`.trim();
    const fimStr = item?.data_fim
      ? `${item.data_fim} ${item?.horario_fim ?? "23:59"}`.trim()
      : undefined;

    return gerarLinkGoogleAgenda({
      titulo: item?.titulo ?? "",
      dataInicio: inicioStr,
      dataFim: fimStr,
      descricao: `Evento: ${item?.titulo ?? ""} organizado pela Escola da Saúde.`,
      local: item?.local || "Santos/SP",
    });
  } catch {
    return null;
  }
}

/* ───────────── Status do evento (com cores padrão global) ───────────── */
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

  // Fallback robusto
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
  // Padrão global memorizado:
  // Programado → verde, Em andamento → amarelo, Encerrado → vermelho
  if (status === "Programado") {
    return {
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <Clock className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />,
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    };
  }
  if (status === "Em andamento") {
    return {
      text: "text-amber-700 dark:text-amber-400",
      icon: <CheckCircle className="w-4 h-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />,
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    };
  }
  return {
    text: "text-red-700 dark:text-red-400",
    icon: <XCircle className="w-4 h-4 text-red-700 dark:text-red-400" aria-hidden="true" />,
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  };
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
  const nome = usuario?.nome || "";

  useEffect(() => {
    buscarInscricoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarInscricoes() {
    setCarregando(true);
    try {
      const data = await apiGet("/api/inscricoes/minhas");
      const arr = Array.isArray(data) ? data : [];

      // Ordena pelo término (desc)
      const ordenadas = [...arr].sort((a, b) => {
        const aEnd = safeTs(a.data_fim || a.data_inicio, a.horario_fim || a.horario_inicio || "23:59:59");
        const bEnd = safeTs(b.data_fim || b.data_inicio, b.horario_fim || b.horario_inicio || "23:59:59");
        return bEnd - aEnd;
      });

      // Apenas ativas
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
      if (status === 401) {
        toast.info("Sua sessão pode ter expirado. Abra no navegador e refaça o login.");
      }
    } finally {
      setCancelandoId(null);
    }
  }

  // Contagens para mini-stats
  const totalAtivas = inscricoes.length;
  const contProgramados = useMemo(
    () =>
      inscricoes.filter((it) => obterStatusEvento(it.data_inicio, it.data_fim, it.horario_inicio, it.horario_fim) === "Programado").length,
    [inscricoes]
  );
  const contAndamento = totalAtivas - contProgramados;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 💡 Hero + stats */}
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
              <Skeleton key={i} height={110} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div className="text-center space-y-3">
            <p className="text-red-600 dark:text-red-400" aria-live="assertive">
              {erro}
            </p>
            <div className="flex justify-center">
              <BotaoSecundario onClick={buscarInscricoes} aria-label="Tentar novamente">
                Tentar novamente
              </BotaoSecundario>
            </div>
          </div>
        ) : inscricoes.length === 0 ? (
          <NadaEncontrado
            mensagem="📭 Você não possui inscrições ativas."
            sugestao="Acesse a página de eventos para se inscrever."
          />
        ) : (
          <ul className="space-y-4 w-full sm:max-w-2xl mx-auto" role="list" aria-label="Lista de inscrições ativas">
            <AnimatePresence>
              {inscricoes.map((item) => {
                const status = obterStatusEvento(
                  item.data_inicio,
                  item.data_fim,
                  item.horario_inicio,
                  item.horario_fim
                );
                const agendaHref = buildAgendaHref(item);
                const podeAgendar = Boolean(agendaHref);

                const instrutores = Array.isArray(item.instrutor)
                  ? item.instrutor.map((i) => i?.nome || String(i)).filter(Boolean)
                  : String(item.instrutor || "")
                      .split(",")
                      .map((n) => n.trim())
                      .filter(Boolean);

                const periodoFmt = [formatarDataBrasileira(item.data_inicio), formatarDataBrasileira(item.data_fim)]
                  .filter(Boolean)
                  .join(" até ");

                const s = statusClasses(status);

                return (
                  <motion.li
                    key={item.inscricao_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    tabIndex={0}
                    className="border p-4 rounded-2xl shadow bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 transition"
                    aria-label={`Inscrição em ${item.titulo}`}
                    role="listitem"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="flex items-center gap-2 text-lg font-semibold text-lousa dark:text-white">
                        <BookOpen className="w-5 h-5" aria-hidden="true" />
                        {item.titulo}
                      </h4>

                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${s.badge}`}
                        aria-label={`Status do evento: ${status}`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="text-sm italic text-gray-600 dark:text-gray-300 mt-2 flex items-start gap-2">
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

                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      <strong>Período:</strong><br />
                      {periodoFmt} {item.local ? `– ${item.local}` : ""}
                    </p>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Inscrição realizada em: {formatarDataBrasileira(item.data_inscricao)}
                    </p>

                    <p className={`text-sm mt-2 font-semibold flex items-center gap-1 ${s.text}`}>
                      {s.icon}
                      <span>Status: {status}</span>
                    </p>

                    <div className="flex flex-wrap gap-3 mt-4">
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
