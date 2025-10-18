// ✅ src/pages/HistoricoEventos.jsx
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, RefreshCcw } from "lucide-react";

import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";

// 🔵 cabeçalho compacto (três cores via variant="azul") + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

import { formatarDataBrasileira } from "../utils/data";
import { apiGet, apiGetFile } from "../services/api";

/* ---------------- helpers anti-fuso (sem Date/UTC) ---------------- */
const ymd = (s) => {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};
const yearFromYMD = (s) => {
  const m = ymd(s).match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
};
const cmpDescByYMD = (a, b, key) => {
  const A = ymd(a?.[key]) || ymd(a?.data_fim) || "0000-00-00";
  const B = ymd(b?.[key]) || ymd(b?.data_fim) || "0000-00-00";
  return A < B ? 1 : A > B ? -1 : 0;
};
/* ------------------------------------------------------------------ */

export default function HistoricoEventos() {
  const [eventos, setEventos] = useState([]);
  const [erro, setErro] = useState(null);
  const [anoSelecionado, setAnoSelecionado] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const liveRef = useRef(null);

  const navigate = useNavigate();
  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  const fetchEventos = async () => {
    try {
      setCarregando(true);
      setErro(null);
      setLive("Carregando histórico…");
      const data = await apiGet("/api/usuarios/historico");
      const lista = Array.isArray(data) ? data : [];
      setEventos(lista);
      setLive(`Histórico carregado: ${lista.length} item(ns).`);
    } catch {
      setErro("Erro ao carregar histórico");
      toast.error("❌ Erro ao carregar histórico.");
      setEventos([]);
      setLive("Falha ao carregar histórico.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { fetchEventos(); }, []);

  // 🔢 anos disponíveis
  const anosDisponiveis = useMemo(() => {
    const anos = new Set();
    for (const ev of eventos) {
      const y = yearFromYMD(ev?.data_inicio);
      if (y) anos.add(y);
    }
    return Array.from(anos).sort((a, b) => b - a);
  }, [eventos]);

  // 🧮 aplica filtro por ano e ordena do mais recente p/ o mais antigo (por data_fim)
  const eventosFiltrados = useMemo(() => {
    const base = anoSelecionado === "todos"
      ? eventos
      : eventos.filter((ev) => String(yearFromYMD(ev?.data_inicio)) === String(anoSelecionado));
    return base.slice().sort((a, b) => cmpDescByYMD(a, b, "data_fim"));
  }, [eventos, anoSelecionado]);

  async function baixarCertificado(id) {
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados/${id}/download`);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("Arquivo inválido.");
      }
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
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Faixa de título (três cores – variant azul) */}
      <PageHeader
        title="Histórico de Eventos"
        icon={CalendarDays}
        variant="azul"
        rightSlot={
          <button
            type="button"
            onClick={fetchEventos}
            disabled={carregando}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white
              ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"}`}
            aria-label="Atualizar histórico de eventos"
            aria-busy={carregando ? "true" : "false"}
          >
            <RefreshCcw className="h-4 w-4" />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
        subtitle={
          typeof eventosFiltrados?.length === "number"
            ? `${eventosFiltrados.length} registro${eventosFiltrados.length === 1 ? "" : "s"}`
            : undefined
        }
      />

      <main role="main" className="flex-1 px-2 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Histórico de Eventos" }]} />

        {/* Filtro por ano + contador */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between">
          <div>
            <label htmlFor="filtro-ano" className="mr-2 font-medium text-sm text-lousa dark:text-white">
              Filtrar por ano:
            </label>
            <select
              id="filtro-ano"
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(e.target.value)}
              className="px-3 py-1 border rounded text-sm dark:bg-zinc-800 dark:text-white"
              aria-label="Filtrar eventos por ano"
            >
              <option value="todos">Todos</option>
              {anosDisponiveis.map((ano) => (
                <option key={ano} value={ano}>{ano}</option>
              ))}
            </select>
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-300">
            {eventosFiltrados.length} resultado{eventosFiltrados.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Conteúdo */}
        <section aria-label="Lista de eventos históricos">
          {carregando ? (
            <CarregandoSkeleton linhas={4} />
          ) : erro ? (
            <p className="text-red-500 text-center" aria-live="polite">{erro}</p>
          ) : eventosFiltrados.length === 0 ? (
            <NadaEncontrado
              mensagem="Nenhum evento encontrado para o filtro selecionado."
              sugestao="Experimente selecionar outro ano ou participe de novos eventos."
            />
          ) : (
            <ul className="space-y-4" role="list" aria-label="Histórico de eventos">
              <AnimatePresence>
                {eventosFiltrados.map((evento) => {
                  const key =
                    evento.evento_id ??
                    evento.id ??
                    `${evento.titulo}-${ymd(evento.data_inicio)}-${ymd(evento.data_fim)}`;

                  const dataInicio = formatarDataBrasileira(evento.data_inicio);
                  const dataFim = formatarDataBrasileira(evento.data_fim);

                  return (
                    <motion.li
                      key={key}
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

                      <div className="mt-2 flex gap-3 flex-wrap">
                        {!evento.avaliado && (evento.evento_id || evento.id) && (
                          <BotaoSecundario
                            onClick={() => navigate(`/avaliar/${evento.evento_id ?? evento.id}`)}
                            aria-label={`Avaliar evento ${evento.titulo}`}
                          >
                            Avaliar evento
                          </BotaoSecundario>
                        )}

                        {evento.certificado_disponivel && evento.certificado_id ? (
                          <BotaoPrimario
                            onClick={() => baixarCertificado(evento.certificado_id)}
                            aria-label={`Baixar certificado de ${evento.titulo}`}
                          >
                            Ver Certificado
                          </BotaoPrimario>
                        ) : (
                          <span className="text-xs text-zinc-500 italic">
                            {evento.avaliado ? "Certificado indisponível." : "Avalie o evento para liberar o certificado, se aplicável."}
                          </span>
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

      <Footer />
    </div>
  );
}
