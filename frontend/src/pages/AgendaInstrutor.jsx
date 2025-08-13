// 📁 src/pages/AgendaInstrutor.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "react-loading-skeleton";

import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet } from "../services/api"; // ✅ serviço centralizado

// ---------- helpers anti-fuso ----------
function todayYMD() {
  const d = new Date(); // horário local do cliente
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ymd(input) {
  if (!input) return "";
  const s = String(input);
  // aceita YYYY-MM-DD e YYYY-MM-DDTHH:mm[:ss]
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function toLocalDate(ymdStr) {
  if (!ymdStr) return null;
  // fixa meio-dia local para evitar pulo de dia
  return new Date(`${ymdStr}T12:00:00`);
}
// ---------------------------------------

export default function AgendaInstrutor() {
  const [agenda, setAgenda] = useState([]);
  const [erro, setErro] = useState("");
  const [carregandoAgenda, setCarregandoAgenda] = useState(true);

  let usuario = {};
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}
  const nome = usuario?.nome || "";
  const hojeYMD = todayYMD(); // ✅ local, não UTC

  useEffect(() => {
    (async () => {
      setCarregandoAgenda(true);
      try {
        // 👇 Não redireciona em 403; só mostra mensagem
        const data = await apiGet("/api/agenda/instrutor", { on403: "silent" });

        // garante array e ordena por data de referência (local)
        const arr = Array.isArray(data) ? data : [];
        const ordenada = arr.slice().sort((a, b) => {
          const ay = ymd(a.data_referencia || a.data_inicio);
          const by = ymd(b.data_referencia || b.data_inicio);
          const aDT = toLocalDate(ay);
          const bDT = toLocalDate(by);
          if (!aDT && !bDT) return 0;
          if (!aDT) return 1;
          if (!bDT) return -1;
          return aDT - bDT;
        });

        setAgenda(ordenada);
        setErro("");
      } catch (e) {
        setErro("Erro ao carregar agenda");
        toast.error(`❌ ${e?.message || "Erro ao carregar agenda."}`);
      } finally {
        setCarregandoAgenda(false);
      }
    })();
  }, []);

  const definirStatus = (dataISO) => {
    if (!dataISO) return "🟢 Programado";
    // Comparação lexicográfica funciona para yyyy-mm-dd
    if (dataISO === hojeYMD) return "🟡 Hoje";
    if (dataISO > hojeYMD) return "🟢 Programado";
    return "🔴 Realizado";
  };

  const formatarHorario = (horario) => {
    if (!horario || typeof horario !== "string") return "";
    const partes = horario.split(" às ");
    const inicio = partes[0]?.slice(0, 5) || "";
    const fim = partes[1]?.slice(0, 5) || "";
    return `${inicio} às ${fim}`;
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6 text-black dark:text-white">
      <Breadcrumbs />

      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Agenda do Instrutor</span>
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
                const dataIniISO = ymd(item.data_inicio);
                const dataFimISO = ymd(item.data_fim);
                const dataRefISO = ymd(item.data_referencia || dataIniISO);
                const status = definirStatus(dataRefISO);

                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    tabIndex={0}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-green-300 dark:border-green-600 focus:outline-none focus:ring-2 focus:ring-lousa"
                    aria-label={`Aula de ${formatarDataBrasileira(
                      item.data_inicio
                    )} a ${formatarDataBrasileira(item.data_fim)}`}
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <strong>📅 Data:</strong> {formatarDataBrasileira(item.data_inicio)} até{" "}
                      {formatarDataBrasileira(item.data_fim)}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <strong>🕒 Horário:</strong> {formatarHorario(item.horario)}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <strong>🏫 Turma:</strong> {item.turma}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">
                      <strong>🧾 Evento:</strong> {item.evento?.nome || item.evento?.titulo}
                    </p>
                    <p
                      className={`text-sm font-semibold mt-2 ${
                        status === "🟢 Programado"
                          ? "text-green-600"
                          : status === "🔴 Realizado"
                          ? "text-red-600"
                          : status === "🟡 Hoje"
                          ? "text-yellow-700"
                          : "text-green-700"
                      }`}
                    >
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
