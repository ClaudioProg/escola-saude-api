// ✅ src/pages/DashboardUsuario.jsx (versão PARTICIPANTE)
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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

/* ───────────── Hero centralizado (sem breadcrumbs) ───────────── */
function DashboardHero({ onRefresh, carregando }) {
  return (
    <header className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Painel do Usuário
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Acompanhe suas inscrições, presenças e certificados.
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
 * Tenta calcular a nota (0–10) a partir de diferentes formatos de payload.
 * Regras:
 * - considerar SOMENTE encontros que já aconteceram (data <= hoje)
 * - nota = (presenças / encontros_passados) * 10
 * - 1 casa decimal
 */
function calcularNotaParticipacao(dados) {
  // 1) Se o backend já enviar pronto
  const notaDireta = Number(dados?.nota);
  if (Number.isFinite(notaDireta)) {
    return Math.max(0, Math.min(10, Number(notaDireta.toFixed(1))));
  }

  // 2) Contadores simples (encontros e presenças até hoje)
  const presencasAteHoje = Number(dados?.presencasAteHoje ?? dados?.presencas_passadas);
  const encontrosAteHoje = Number(dados?.encontrosAteHoje ?? dados?.encontros_passados);
  if (Number.isFinite(presencasAteHoje) && Number.isFinite(encontrosAteHoje) && encontrosAteHoje > 0) {
    const nota = (presencasAteHoje / encontrosAteHoje) * 10;
    return Math.max(0, Math.min(10, Number(nota.toFixed(1))));
  }

  // 3) Derivar de coleções comuns
  // Procuramos por estruturas que contenham turmas/inscrições com `datas` e `presencas`
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
      // datas: [{data, horario_inicio, horario_fim}] OU array de strings "YYYY-MM-DD"
      const datas = Array.isArray(item?.datas)
        ? item.datas.map((d) => (typeof d === "string" ? { data: ymd(d) } : { data: ymd(d.data) }))
        : [];

      // presencas: [{data_presenca, presente}] ou [{data, presente}]
      const presencas = Array.isArray(item?.presencas)
        ? item.presencas.map((p) => ({
            data: ymd(p.data_presenca ?? p.data),
            presente: !!p.presente,
          }))
        : [];

      const setPresencas = new Map();
      presencas.forEach((p) => {
        if (p.data) setPresencas.set(p.data, p.presente === true);
      });

      for (const d of datas) {
        const dia = ymd(d.data);
        if (!dia || !isPastOrToday(dia)) continue; // só conta o que já passou
        encontrosPassados += 1;
        if (setPresencas.get(dia) === true) totalPresencas += 1;
      }
    }
  }

  if (encontrosPassados > 0) {
    const nota = (totalPresencas / encontrosPassados) * 10;
    return Math.max(0, Math.min(10, Number(nota.toFixed(1))));
  }

  // 4) Sem dados suficientes
  return null;
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

  // ── KPIs tolerantes
  const concluidos = Number(dados?.cursosRealizados ?? dados?.concluidos ?? 0) || 0;
  const inscricoesAtuais = Number(dados?.inscricoesAtuais ?? dados?.inscricoesAtivas ?? 0) || 0;
  const proximosEventos = Number(dados?.proximosEventos ?? dados?.proximos ?? 0) || 0;
  const certificadosDisponiveis =
    Number(dados?.certificadosDisponiveis ?? dados?.certificadosEmitidos ?? dados?.certificados ?? 0) || 0;
  const avaliacoesPendentes =
    Number(dados?.avaliacoesPendentes ?? dados?.pendenciasAvaliacao ?? dados?.notificacoesAvaliacao ?? 0) || 0;

  const nota = calcularNotaParticipacao(dados); // 👈 nova nota (0–10, 1 casa)
  const notaExibicao = nota == null ? "—" : nota.toFixed(1);

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 💚 Header centralizado */}
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

            {/* Cards de KPI (somente PARTICIPANTE) */}
            <section
              aria-label="Indicadores rápidos"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <CardInfo icon={BookOpen} titulo="Eventos Concluídos" valor={concluidos} />
              <CardInfo icon={ClipboardList} titulo="Inscrições em Andamento" valor={inscricoesAtuais} />
              <CardInfo icon={CalendarDays} titulo="Próximos eventos" valor={proximosEventos} />
              <CardInfo icon={FileText} titulo="Certificados Disponíveis" valor={certificadosDisponiveis} />
              <CardInfo icon={CalendarDays} titulo="Avaliações Pendentes" valor={avaliacoesPendentes} />
              {/* 🆕 6º KPI: Nota */}
              <CardInfo icon={ClipboardList} titulo="Nota de Participação" valor={notaExibicao} />
            </section>

            {/* Gráfico de Eventos (participante) */}
            <section className="mt-8 grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow">
                <h2 className="text-center font-semibold mb-2">Gráfico de Eventos</h2>
                <GraficoEventos
                  dados={dados?.graficoEventos ?? {}}
                  aria-label="Gráfico de eventos do usuário"
                />
              </div>
            </section>

            {/* Notificações */}
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-lousa dark:text-white mb-2">
                ✨ Últimas Notificações
              </h2>
              {Array.isArray(dados?.ultimasNotificacoes) && dados.ultimasNotificacoes.length > 0 ? (
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
function CardInfo({ icon: Icon, titulo, valor }) {
  const n = Number(valor);
  const exibicao = Number.isFinite(n) ? valor : (valor ?? "—");

  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 flex flex-col items-center justify-center gap-2 text-center focus-within:ring-2 focus-within:ring-lousa"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      tabIndex={-1}
      aria-label={`${titulo}: ${exibicao}`}
      title={titulo === "Nota de Participação" && exibicao !== "—" ? `Nota calculada sobre encontros já realizados (0–10)` : undefined}
    >
      <Icon className="w-8 h-8 text-lousa dark:text-white" aria-hidden="true" />
      <p className="text-sm text-gray-600 dark:text-gray-300">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white">{exibicao}</p>
    </motion.div>
  );
}
