// 📁 src/pages/HistoricoEventos.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import CabecalhoPainel from "../components/CabecalhoPainel";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet, apiGetFile } from "../services/api"; // ✅ serviço centralizado

export default function HistoricoEventos() {
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState("todos");
  const [carregando, setCarregando] = useState(true);

  const nome = localStorage.getItem("nome") || "";
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchEventos() {
      setCarregando(true);
      try {
        const data = await apiGet("/api/usuarios/historico");
        setEventos(Array.isArray(data) ? data : []);
        setErro(null);
      } catch {
        setErro("Erro ao carregar histórico");
        toast.error("❌ Erro ao carregar histórico.");
      } finally {
        setCarregando(false);
      }
    }
    fetchEventos();
  }, []);

  const anosDisponiveis = Array.from(
    new Set(
      eventos
        .map((ev) => {
          const d = ev?.data_inicio ? new Date(ev.data_inicio) : null;
          return d && !isNaN(d) ? d.getFullYear() : null;
        })
        .filter(Boolean)
    )
  ).sort((a, b) => b - a);

  const eventosFiltrados =
    anoSelecionado === "todos"
      ? eventos
      : eventos.filter((ev) => {
          const d = ev?.data_inicio ? new Date(ev.data_inicio) : null;
          return d && !isNaN(d) && String(d.getFullYear()) === String(anoSelecionado);
        });

  async function baixarCertificado(id) {
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados/${id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `certificado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("❌ Não foi possível baixar o certificado.");
    }
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Histórico de Eventos" }]} />
      <CabecalhoPainel nome={nome} perfil="Painel do Usuário" />

      <h1 className="text-2xl font-bold mb-4 text-center text-lousa dark:text-white">
        📆 Histórico de Eventos
      </h1>

      {/* Filtro por ano */}
      <div className="mb-6 text-center">
        <label className="mr-2 font-medium text-sm text-lousa dark:text-white">
          Filtrar por ano:
        </label>
        <select
          value={anoSelecionado}
          onChange={(e) => setAnoSelecionado(e.target.value)}
          className="px-3 py-1 border rounded text-sm dark:bg-zinc-800 dark:text-white"
          aria-label="Filtrar eventos por ano"
        >
          <option value="todos">Todos</option>
          {anosDisponiveis.map((ano) => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
      </div>

      {/* Conteúdo */}
      <section aria-label="Lista de eventos históricos">
        {carregando ? (
          <CarregandoSkeleton linhas={4} />
        ) : erro ? (
          <p className="text-red-500 text-center">{erro}</p>
        ) : eventosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum evento encontrado para o filtro selecionado."
            sugestao="Experimente selecionar outro ano ou participe de novos eventos."
          />
        ) : (
          <ul className="space-y-4" role="list" aria-label="Histórico de eventos">
            <AnimatePresence>
              {eventosFiltrados.map((evento) => {
                const dataInicio = formatarDataBrasileira(evento.data_inicio);
                const dataFim = formatarDataBrasileira(evento.data_fim);

                return (
                  <motion.li
                    key={evento.evento_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    tabIndex={0}
                    role="listitem"
                    className="border p-4 rounded-xl shadow bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-lousa transition"
                    aria-label={`Evento: ${evento.titulo}`}
                  >
                    <h3 className="text-lg font-semibold text-lousa dark:text-white">
                      {evento.titulo}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Período: {dataInicio} até {dataFim}
                    </p>
                    <div className="mt-2 flex gap-4 flex-wrap">
                      {!evento.avaliado && (
                        <BotaoSecundario
                          onClick={() => navigate(`/avaliar/${evento.evento_id}`)}
                          aria-label={`Avaliar evento ${evento.titulo}`}
                        >
                          Avaliar evento
                        </BotaoSecundario>
                      )}
                      {evento.certificado_disponivel && evento.certificado_id && (
                        <BotaoPrimario
                          onClick={() => baixarCertificado(evento.certificado_id)}
                          aria-label={`Baixar certificado de ${evento.titulo}`}
                        >
                          Ver Certificado
                        </BotaoPrimario>
                      )}
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
