// ✅ src/pages/DashboardUsuario.jsx (versão PARTICIPANTE — revisado)
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  BookOpen,
  FileText,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import GraficoEventos from "../components/GraficoEventos";
import { apiGet } from "../services/api";
import { formatarDataBrasileira } from "../utils/data";

/* ───────────────── HeaderHero (padronizado app-wide) ───────────────── */
function DashboardHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-sky-900 via-blue-800 to-indigo-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🎯</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Painel do Usuário
          </h1>
        </div>
        <p className="text-sm sm:text-base text-white/90 max-w-2xl">
          Acompanhe suas inscrições, presenças e certificados.
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={[
            "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold",
            "bg-white/15 hover:bg-white/25 border border-white/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            carregando ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
          aria-label="Atualizar painel do usuário"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

/* ───────────── helpers de nota ───────────── */
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const hojeYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
const isPastOrToday = (dYMD) => !!dYMD && ymd(dYMD) <= hojeYMD();

/**
 * Calcula a nota (0–10) com 1 casa:
 * - considera só encontros já ocorridos (data <= hoje)
 * - nota = (presenças / encontros_passados) * 10
 */
function calcularNotaParticipacao(dados) {
  const notaDireta = Number(dados?.nota);
  if (Number.isFinite(notaDireta)) return Math.max(0, Math.min(10, Number(notaDireta.toFixed(1))));

  const presencasAteHoje = Number(dados?.presencasAteHoje ?? dados?.presencas_passadas);
  const encontrosAteHoje = Number(dados?.encontrosAteHoje ?? dados?.encontros_passados);
  if (Number.isFinite(presencasAteHoje) && Number.isFinite(encontrosAteHoje) && encontrosAteHoje > 0) {
    const nota = (presencasAteHoje / encontrosAteHoje) * 10;
    return Math.max(0, Math.min(10, Number(nota.toFixed(1))));
  }

  const colecoesPossiveis = [
    dados?.inscricoes,
    dados?.minhasInscricoes,
    dados?.turmasInscrito,
    dados?.eventosInscrito,
    dados?.detalhesInscricoes,
  ].filter(Array.isArray);

  let encontrosPassados = 0;
  let totalPresencas = 0;

  for (const colecao of colecoesPossiveis) {
    for (const item of colecao) {
      const datas = Array.isArray(item?.datas)
        ? item.datas.map((d) => (typeof d === "string" ? { data: ymd(d) } : { data: ymd(d.data) }))
        : [];
      const presencas = Array.isArray(item?.presencas)
        ? item.presencas.map((p) => ({ data: ymd(p.data_presenca ?? p.data), presente: !!p.presente }))
        : [];

      const setPresencas = new Map();
      presencas.forEach((p) => { if (p.data) setPresencas.set(p.data, p.presente === true); });

      for (const d of datas) {
        const dia = ymd(d.data);
        if (!dia || !isPastOrToday(dia)) continue;
        encontrosPassados += 1;
        if (setPresencas.get(dia) === true) totalPresencas += 1;
      }
    }
  }

  if (encontrosPassados > 0) {
    const nota = (totalPresencas / encontrosPassados) * 10;
    return Math.max(0, Math.min(10, Number(nota.toFixed(1))));
  }

  return null;
}

export default function DashboardUsuario() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const usuarioNome = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}")?.nome || "";
    } catch {
      return "";
    }
  })();

  function setLive(msg) {
    if (liveRef.current) liveRef.current.textContent = msg;
  }

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando seu painel…");
      const data = await apiGet("/dashboard-usuario");
      setDados(data || {});
      setLive("Painel atualizado.");
    } catch (err) {
      console.error("❌ Erro ao buscar dados do dashboard:", err);
      setErro("Não foi possível carregar o painel.");
      setDados(null);
      setLive("Falha ao carregar o painel.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  // ── KPIs tolerantes
  const concluidos = Number(dados?.cursosRealizados ?? dados?.concluidos ?? 0) || 0;
  const inscricoesAtuais = Number(dados?.inscricoesAtuais ?? dados?.inscricoesAtivas ?? 0) || 0;
  const proximosEventos = Number(dados?.proximosEventos ?? dados?.proximos ?? 0) || 0;
  const certificadosDisponiveis =
    Number(dados?.certificadosDisponiveis ?? dados?.certificadosEmitidos ?? dados?.certificados ?? 0) || 0;
  const avaliacoesPendentes =
    Number(dados?.avaliacoesPendentes ?? dados?.pendenciasAvaliacao ?? dados?.notificacoesAvaliacao ?? 0) || 0;

  const nota = calcularNotaParticipacao(dados);
  const notaExibicao = nota == null ? "—" : nota.toFixed(1);

  return (
    <main id="conteudo" className="min-h-screen bg-gelo dark:bg-zinc-900">
      <DashboardHero onRefresh={carregar} carregando={carregando} />

      {/* Live region para leitores de tela */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className="px-3 sm:px-4 py-6">
        {erro && !carregando && <NadaEncontrado mensagem={erro} />}

        {carregando ? (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} height={110} className="rounded-2xl" />
              ))}
            </div>
            <Skeleton height={320} className="rounded-2xl" />
            <Skeleton height={120} className="rounded-2xl" />
          </div>
        ) : dados ? (
          <motion.div
            className="max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Saudação opcional */}
            {usuarioNome && (
              <p className="text-center text-sm text-slate-600 dark:text-slate-300 mb-4">
                Bem-vindo(a), <span className="font-medium">{usuarioNome}</span>
              </p>
            )}

            {/* 🔢 MINISTATS */}
            <section
              aria-label="Indicadores rápidos"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <MiniStat icon={BookOpen}        titulo="Eventos Concluídos"     valor={concluidos}           descricao="Concluídos no histórico"        accent="from-amber-600 to-orange-600" />
              <MiniStat icon={ClipboardList}   titulo="Inscrições em Andamento" valor={inscricoesAtuais}    descricao="Inscrições ativas"              accent="from-emerald-600 to-teal-600" />
              <MiniStat icon={CalendarDays}    titulo="Próximos Eventos"        valor={proximosEventos}     descricao="Agendados para você"            accent="from-indigo-600 to-violet-600" />
              <MiniStat icon={FileText}        titulo="Certificados Disponíveis" valor={certificadosDisponiveis} descricao="Prontos para download"       accent="from-rose-600 to-pink-600" />
              <MiniStat icon={CalendarDays}    titulo="Avaliações Pendentes"    valor={avaliacoesPendentes} descricao="Aguardando seu feedback"        accent="from-sky-600 to-cyan-600" />
              <MiniStat icon={ClipboardList}   titulo="Nota de Participação"    valor={notaExibicao}        descricao="Cálculo sobre encontros passados" accent="from-slate-600 to-gray-700" />
            </section>

            {/* 📈 Gráfico de Eventos (participante) */}
            <section className="mt-8 grid grid-cols-1 gap-4">
              <ChartCard title="Gráfico de Eventos" ariaLabel="Gráfico de eventos do usuário">
                <GraficoEventos
                  dados={dados?.graficoEventos ?? {}}
                  aria-label="Gráfico de eventos do usuário"
                />
              </ChartCard>
            </section>

            {/* 🔔 Notificações */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-lousa dark:text-white mb-2">
                ✨ Últimas Notificações
              </h2>
              {Array.isArray(dados?.ultimasNotificacoes) && dados.ultimasNotificacoes.length > 0 ? (
                <ul className="space-y-2">
                  {dados.ultimasNotificacoes.map((n, i) => (
                    <li
                      key={i}
                      className="bg-white dark:bg-zinc-800 rounded-xl shadow px-4 py-2 text-sm"
                    >
                      <p className="font-medium">{String(n.mensagem || "")}</p>
                      {n.data && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                          {formatarDataBrasileira(n.data)}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Nenhuma notificação recente.
                </p>
              )}
            </section>
          </motion.div>
        ) : (
          <NadaEncontrado mensagem="Sem dados para exibir." />
        )}
      </div>

      <Footer />
    </main>
  );
}

/* ───────────────── UI ───────────────── */
function MiniStat({ icon: Icon, titulo, valor, descricao, accent = "from-slate-600 to-slate-700" }) {
  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 rounded-2xl shadow p-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      role="group" aria-label={`${titulo}: ${valor}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`rounded-xl px-2 py-1 text-white text-xs font-medium bg-gradient-to-r ${accent}`}>
          {titulo}
        </div>
        <Icon className="w-5 h-5 text-black/60 dark:text-white/70" aria-hidden="true" />
      </div>
      <p className="text-3xl font-extrabold text-lousa dark:text-white leading-tight">{Number.isFinite(Number(valor)) ? valor : (valor ?? "—")}</p>
      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{descricao}</p>
    </motion.div>
  );
}

function ChartCard({ title, children, ariaLabel }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.4 }}
      className="bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow"
      role="group" aria-label={ariaLabel || title}
    >
      <figcaption className="text-center font-semibold mb-3">{title}</figcaption>
      {children}
    </motion.figure>
  );
}
