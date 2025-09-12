// ✅ src/pages/AgendaInstrutor.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "react-loading-skeleton";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api";

// ---------- helpers anti-fuso ----------
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function ymd(input) {
  if (!input) return "";
  const s = String(input);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}
function toLocalDate(ymdStr) {
  if (!ymdStr) return null;
  return new Date(`${ymdStr}T12:00:00`);
}
function formatarBRdeYMD(ymdStr) {
  const s = ymd(ymdStr);
  if (!s) return "";
  const [a, m, d] = s.split("-");
  return `${d}/${m}/${a}`;
}
// ---------------------------------------

export default function AgendaInstrutor() {
  const [agenda, setAgenda] = useState([]);
  const [erro, setErro] = useState("");
  const [carregandoAgenda, setCarregandoAgenda] = useState(true);
  const liveRef = useRef(null);

  let usuario = {};
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}
  const nome = usuario?.nome || "";
  const hojeYMD = todayYMD();

  async function carregarAgenda() {
    setCarregandoAgenda(true);
    try {
      if (liveRef.current) liveRef.current.textContent = "Carregando agenda…";

      const data = await apiGet("/api/agenda/instrutor", { on403: "silent" });
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

      if (liveRef.current) {
        liveRef.current.textContent =
          ordenada.length
            ? `Foram encontradas ${ordenada.length} aulas/eventos.`
            : "Nenhuma aula agendada.";
      }
    } catch (e) {
      setErro("Erro ao carregar agenda");
      toast.error(`❌ ${e?.message || "Erro ao carregar agenda."}`);
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar agenda.";
    } finally {
      setCarregandoAgenda(false);
    }
  }

  useEffect(() => {
    carregarAgenda();
  }, []);

  const definirStatus = (dataISO) => {
    if (!dataISO) return "🟢 Programado";
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
    <>
      <PageHeader
        title="🗓️ Minha Agenda de Aulas / Eventos"
        subtitle="Agenda do Instrutor"
        leftPill={`Seja bem-vindo(a), ${nome || "instrutor(a)"}`}
        actions={
          <button
            type="button"
            onClick={carregarAgenda}
            disabled={carregandoAgenda}
            className={`px-3 py-1.5 text-sm rounded-md border transition
              ${carregandoAgenda
                ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                : "bg-lousa text-white hover:bg-green-800"}`}
            aria-label="Atualizar agenda"
          >
            {carregandoAgenda ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6 text-black dark:text-white">
        {/* feedback acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

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
                      aria-label={`Aula de ${formatarBRdeYMD(dataIniISO)} a ${formatarBRdeYMD(dataFimISO)}`}
                    >
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        <strong>📅 Data:</strong> {formatarBRdeYMD(dataIniISO)} até {formatarBRdeYMD(dataFimISO)}
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

      <Footer />
    </>
  );
}
