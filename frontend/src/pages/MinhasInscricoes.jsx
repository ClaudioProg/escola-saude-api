// src/pages/MinhasInscricoes.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiDelete } from "../services/api";

export default function MinhasInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);

  const navigate = useNavigate();

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
      // Ordena por data/hora de término (mais próximos do futuro primeiro)
      const ordenadas = [...data].sort((a, b) => {
        const aEnd = new Date(`${a.data_fim}T${a.horario_fim || "23:59:59"}`).getTime();
        const bEnd = new Date(`${b.data_fim}T${b.horario_fim || "23:59:59"}`).getTime();
        return bEnd - aEnd;
      });
      setInscricoes(ordenadas);
      setErro("");
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
      toast.error("❌ Erro ao cancelar inscrição.");
    } finally {
      setCancelandoId(null);
    }
  }

  function obterStatusEvento(dataInicioISO, dataFimISO, horarioInicio, horarioFim) {
    // horários de fallback seguros
    const [hIni, mIni, sIni] = (horarioInicio || "00:00:00").split(":").map(Number);
    const [hFim, mFim, sFim]   = (horarioFim || "23:59:59").split(":").map(Number);

    const inicio = new Date(dataInicioISO);
    const fim    = new Date(dataFimISO);
    inicio.setHours(hIni ?? 0, mIni ?? 0, sIni ?? 0, 0);
    fim.setHours(hFim ?? 23, mFim ?? 59, sFim ?? 59, 999);

    const agora = new Date();

    if (agora < inicio) return "Programado";
    if (agora > fim)    return "Encerrado";
    return "Em andamento";
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel nome={nome} perfil="Painel do Usuário" />

      <motion.h2
        className="text-2xl font-bold mb-6 text-black dark:text-white text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        📚 Meus Cursos
      </motion.h2>

      <section>
        {carregando ? (
          <div className="space-y-4 max-w-md mx-auto">
            {[...Array(4)].map((_, i) => (
              <Skeleton
                key={i}
                height={110}
                className="rounded-xl"
                baseColor="#cbd5e1"
                highlightColor="#e2e8f0"
              />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center" aria-live="polite">{erro}</p>
        ) : inscricoes.length === 0 ? (
          <NadaEncontrado
            mensagem="📭 Você ainda não está inscrito em nenhum evento."
            sugestao="Acesse a página de eventos para se inscrever."
          />
        ) : (
          <ul className="space-y-4 w-full sm:max-w-2xl mx-auto">
            <AnimatePresence>
              {inscricoes.map((item) => {
                const dataInicio = new Date(item.data_inicio);
                const dataFim = new Date(item.data_fim);
                const status = obterStatusEvento(
                  item.data_inicio,
                  item.data_fim,
                  item.horario_inicio,
                  item.horario_fim
                );

                return (
                  <motion.li
                    key={item.inscricao_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    tabIndex={0}
                    className="border p-4 rounded-xl shadow bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-lousa transition"
                    aria-label={`Inscrição em ${item.titulo}`}
                  >
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-lousa dark:text-white">
                      <BookOpen className="w-5 h-5" />
                      {item.titulo}
                    </h3>

                    <div className="text-sm italic text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Instrutor(es):{" "}
                      {item.instrutor ? (
                        <ul className="list-disc list-inside">
                          {item.instrutor.split(",").map((n, i) => (
                            <li key={i}>{n.trim()}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="italic text-gray-500">a definir</span>
                      )}
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      <strong>Período:</strong><br />
                      {formatarDataBrasileira(item.data_inicio)} até {formatarDataBrasileira(item.data_fim)} – {item.local}
                    </p>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Inscrição realizada em: {formatarDataBrasileira(item.data_inscricao)}
                    </p>

                    <p className="text-sm mt-1 font-semibold flex items-center gap-1">
                      {status === "Encerrado" && <XCircle className="w-4 h-4 text-red-600" />}
                      {status === "Programado" && <Clock className="w-4 h-4 text-yellow-700" />}
                      {status === "Em andamento" && <CheckCircle className="w-4 h-4 text-green-600" />}
                      <span
                        className={
                          status === "Encerrado"
                            ? "text-red-600"
                            : status === "Programado"
                            ? "text-yellow-700"
                            : "text-green-600"
                        }
                      >
                        Status: {status}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-3 mt-4">
                      <BotaoSecundario
                        as="a"
                        href={gerarLinkGoogleAgenda({
                          titulo: item.titulo,
                          dataInicio,
                          dataFim,
                          descricao: `Evento: ${item.titulo} organizado pela Escola da Saúde.`,
                          local: item.local || "Santos/SP",
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto"
                        aria-label="Adicionar curso à Google Agenda"
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
      </section>
    </main>
  );
}
