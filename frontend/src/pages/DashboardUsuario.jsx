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

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import GraficoEventos from "../components/GraficoEventos";
import GraficoAvaliacoes from "../components/GraficoAvaliacoes";
import { apiGet } from "../services/api";
import { formatarDataBrasileira } from "../utils/data";

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

  function setLive(msg) {
    if (liveRef.current) liveRef.current.textContent = msg;
  }

  return (
    <>
      <PageHeader
        title="📊 Painel do Usuário"
        subtitle={usuarioNome ? `Bem-vindo(a), ${usuarioNome}` : "Acompanhe suas atividades, certificados e avaliações"}
        actions={
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition border
              ${carregando
                ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                : "bg-lousa text-white hover:bg-green-800"}`}
            aria-label="Atualizar painel do usuário"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-3 sm:px-4 py-6">
        {/* Live region para leitores de tela */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

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
                <GraficoEventos dados={dados?.graficoEventos ?? {}} aria-label="Gráfico de eventos do usuário" />
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
                <h2 className="text-center font-semibold mb-2">Avaliações Recebidas</h2>
                <GraficoAvaliacoes dados={dados?.graficoAvaliacoes ?? {}} aria-label="Gráfico de avaliações do usuário" />
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
      </main>

      <Footer />
    </>
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
