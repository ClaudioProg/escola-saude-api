// src/pages/AgendaInstrutor.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "react-loading-skeleton";

import useperfilPermitidos from "../hooks/useperfilPermitidos";
import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira } from "../utils/data"; // ✅

export default function AgendaInstrutor() {
  const { temAcesso, carregando } = useperfilPermitidos(["administrador", "instrutor"]);
  const navigate = useNavigate();
  const [agenda, setAgenda] = useState([]);
  const [erro, setErro] = useState("");
  const [carregandoAgenda, setCarregandoAgenda] = useState(true);

  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const nome = usuario?.nome || "";
  const hojeISO = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!carregando && !temAcesso) navigate("/login", { replace: true });
  }, [carregando, temAcesso, navigate]);

  useEffect(() => {
    if (temAcesso) {
      const buscarAgenda = async () => {
        setCarregandoAgenda(true);
        try {
          const token = localStorage.getItem("token");
          const res = await fetch("/api/agenda/instrutor", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) throw new Error("Erro ao buscar agenda");
          const data = await res.json();
          setAgenda(data.sort((a, b) => new Date(a.data) - new Date(b.data)));
          setErro("");
        } catch (error) {
          setErro("Erro ao carregar agenda");
          toast.error("❌ Erro ao carregar agenda.");
        } finally {
          setCarregandoAgenda(false);
        }
      };

      buscarAgenda();
    }
  }, [temAcesso]);

  const definirStatus = (dataISO) => {
    if (dataISO === hojeISO) return "🟡 Hoje";
    if (dataISO > hojeISO) return "🟢 Programado";
    return "🔴 Realizado";
  };

  if (carregando) {
    return (
      <div className="p-4 text-center text-gray-700 dark:text-white">
        🔄 Carregando permissões de acesso...
      </div>
    );
  }

  if (!temAcesso) return null;

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6 text-black dark:text-white">
      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do Instrutor</span>
      </div>

      <h2 className="text-2xl font-bold mb-6 text-center text-[#1b4332] dark:text-white">
        🗓️ Minha Agenda de Aulas / Eventos
      </h2>

      <section>
        {carregandoAgenda ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={110} className="rounded-xl" />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center">{erro}</p>
        ) : agenda.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhuma aula agendada no momento."
            sugestao="Acesse seus eventos para mais opções."
          />
        ) : (
          <ul className="space-y-4">
            <AnimatePresence>
              {agenda.map((item, i) => {
                const dataISO = item.data.split("T")[0];
                const status = definirStatus(dataISO);

                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    tabIndex={0}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-green-300 dark:border-green-600 focus:outline-none focus:ring-2 focus:ring-lousa"
                    aria-label={`Aula em ${formatarDataBrasileira(item.data)}`}
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-200"><strong>📅 Data:</strong> {formatarDataBrasileira(item.data)}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200"><strong>🕒 Horário:</strong> {item.horario}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200"><strong>🏫 Turma:</strong> {item.turma}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200"><strong>🧾 Evento:</strong> {item.evento}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400"><strong>📍 Período:</strong> {formatarDataBrasileira(item.data_inicio)} até {formatarDataBrasileira(item.data_fim)}</p>
                    <p className={`text-sm font-semibold mt-2 ${
                      status === "🔴 Realizado" ? "text-red-600" :
                      status === "🟡 Hoje" ? "text-yellow-700" :
                      "text-green-700"
                    }`}>
                      {status}
                    </p>
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
