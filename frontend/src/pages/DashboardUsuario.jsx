// ✅ src/pages/DashboardUsuario.jsx
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  BookOpen,
  FileText,
  Presentation,
  RefreshCw,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import GraficoEventos from "../components/GraficoEventos";
import GraficoAvaliacoes from "../components/GraficoAvaliacoes";
import { apiGet } from "../services/api";
import { formatarDataBrasileira } from "../utils/data";

/* ───────────── Hero centralizado (sem breadcrumbs) ───────────── */
function DashboardHero({ onRefresh, carregando }) {
  return (
    <header className="bg-gradient-to-br from-fuchsia-900 via-violet-800 to-indigo-700 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Painel do Usuário
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Acompanhe suas atividades, certificados e avaliações.
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={[
            "inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold",
            "bg-white/10 hover:bg-white/20 border border-white/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            carregando ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
          aria-label="Atualizar painel do usuário"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

export default function DashboardUsuario() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const liveRef = useRef(null);

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

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 💜 Header centralizado */}
      <DashboardHero onRefresh={carregar} carregando={carregando} />

      {/* Live region para leitores de tela */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className="px-3 sm:px-4 py-6">
        {erro && !carregando && <NadaEncontrado mensagem={erro} />}

        {carregando ? (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} height={110} className="rounded-xl" />
              ))}
            </div>
            <Skeleton height={320} className="rounded-xl" />
            <Skeleton height={320} className="rounded-xl" />
            <Skeleton height={120} className="rounded-xl" />
          </div>
        ) : dados ? (
          <motion.div
            className="max-w-6xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 👇 saudação pequena (opcional) */}
            {usuarioNome && (
              <p className="text-center text-sm text-slate-600 dark:text-slate-300 mb-4">
                Bem-vindo(a), <span className="font-medium">{usuarioNome}</span>
              </p>
            )}

            {/* Cards de KPI */}
            <section
              aria-label="Indicadores rápidos"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <CardInfo icon={BookOpen} titulo="Eventos Concluídos" valor={dados.cursosRealizados} />
              <CardInfo icon={Presentation} titulo="Eventos como Instrutor" valor={dados.eventosinstrutor} />
              <CardInfo icon={CalendarDays} titulo="Inscrições em Andamento" valor={dados.inscricoesAtuais} />
              <CardInfo icon={CalendarDays} titulo="Próximos eventos" valor={dados.proximosEventos} />
              <CardInfo icon={FileText} titulo="Certificados Emitidos" valor={dados.certificadosEmitidos} />
              <CardInfo icon={FileText} titulo="Média de Avaliação Recebida" valor={dados.mediaAvaliacao} media10 />
            </section>

            {/* Gráficos */}
            <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
                <h2 className="text-center font-semibold mb-2">Gráfico de Eventos</h2>
                <GraficoEventos
                  dados={dados?.graficoEventos ?? {}}
                  aria-label="Gráfico de eventos do usuário"
                />
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
                <h2 className="text-center font-semibold mb-2">Avaliações Recebidas</h2>
                <GraficoAvaliacoes
                  dados={dados?.graficoAvaliacoes ?? {}}
                  aria-label="Gráfico de avaliações do usuário"
                />
              </div>
            </section>

            {/* Notificações */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-lousa dark:text-white mb-2">
                ✨ Últimas Notificações
              </h2>
              {Array.isArray(dados.ultimasNotificacoes) && dados.ultimasNotificacoes.length > 0 ? (
                <ul className="space-y-2">
                  {dados.ultimasNotificacoes.map((n, i) => (
                    <li
                      key={i}
                      className="bg-white dark:bg-zinc-800 rounded-md shadow px-4 py-2 text-sm"
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

/* ---------- UI ---------- */
function CardInfo({ icon: Icon, titulo, valor, media10 = false }) {
  const n = Number(valor);
  const isNum = Number.isFinite(n);
  let exibicao = "—";

  if (media10) {
    // back-end costuma enviar média 0–5; exibimos 0.0–10.0
    exibicao = isNum ? (n * 2).toFixed(1) : "—";
  } else {
    exibicao = isNum ? n : (valor ?? "—");
  }

  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 flex flex-col items-center justify-center gap-2 text-center focus-within:ring-2 focus-within:ring-lousa"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      tabIndex={-1}
      aria-label={`${titulo}: ${exibicao}`}
    >
      <Icon className="w-8 h-8 text-lousa dark:text-white" aria-hidden="true" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white">{exibicao}</p>
      {media10 && <span className="text-xs text-gray-500 dark:text-gray-400">escala 0–10</span>}
    </motion.div>
  );
}
