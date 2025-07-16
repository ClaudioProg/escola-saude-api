// src/pages/HistoricoEventos.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import CabecalhoPainel from "../components/CabecalhoPainel";
import { formatarDataBrasileira } from "../utils/data";

export default function HistoricoEventos() {
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState("todos");
  const [carregando, setCarregando] = useState(true);

  const nome = localStorage.getItem("nome") || "";

  useEffect(() => {
    async function fetchEventos() {
      setCarregando(true);
      try {
        const token = localStorage.getItem("token");
        const resposta = await axios.get("http://localhost:3000/api/usuarios/historico", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEventos(resposta.data);
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

  const anosDisponiveis = Array.from(new Set(eventos.map(ev =>
    extrairAno(ev.data_inicio)
  ))).sort((a, b) => b - a);

  const eventosFiltrados = anoSelecionado === "todos"
    ? eventos
    : eventos.filter(ev =>
        new Date(ev.data_inicio).getFullYear().toString() === anoSelecionado
      );

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
          className="px-3 py-1 border rounded text-sm"
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
                          onClick={() =>
                            window.location.href = `/avaliar/${evento.evento_id}`
                          }
                          aria-label={`Avaliar evento ${evento.titulo}`}
                        >
                          Avaliar evento
                        </BotaoSecundario>
                      )}
                      {evento.certificado_disponivel && (
                        <BotaoPrimario
                          as="a"
                          href={`http://localhost:3000/api/certificados/${evento.certificado_id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver certificado de ${evento.titulo}`}
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
