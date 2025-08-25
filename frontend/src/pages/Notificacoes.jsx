// pages/Notificacoes.jsx
import { useEffect, useState } from "react";
import { Bell, CalendarDays, CheckCircle, Info, Star } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { apiGet, apiPatch } from "../services/api";

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(null);

  async function carregarNotificacoes() {
    try {
      setLoading(true);
      const data = await apiGet("/api/notificacoes");
      setNotificacoes(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error("❌ Erro ao carregar notificações.");
      console.error("Erro:", error);
      setNotificacoes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarNotificacoes();
  }, []);

  function obterIcone(tipo) {
    switch (tipo?.toLowerCase()) {
      case "evento":
        return <CalendarDays className="text-blue-600 dark:text-blue-400" />;
      case "certificado":
        return <CheckCircle className="text-green-600 dark:text-green-400" />;
      case "aviso":
        return <Info className="text-yellow-600 dark:text-yellow-400" />;
      case "avaliacao":
        return <Star className="text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell className="text-gray-600 dark:text-gray-400" />;
    }
  }

  function classesPorTipo(tipo, lida) {
    if (lida) return "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700";
    switch (tipo?.toLowerCase()) {
      case "evento":
        return "bg-blue-50 dark:bg-zinc-800 border-blue-600 dark:border-blue-400";
      case "certificado":
        return "bg-green-50 dark:bg-green-900 border-green-600 dark:border-green-400";
      case "avaliacao":
        return "bg-yellow-50 dark:bg-zinc-800 border-yellow-500 dark:border-yellow-400";
      case "aviso":
        return "bg-orange-50 dark:bg-zinc-800 border-orange-500 dark:border-orange-400";
      default:
        return "bg-gray-50 dark:bg-zinc-800 border-gray-400 dark:border-gray-500";
    }
  }

  async function handleVerMais(id, link) {
    try {
      setMarcando(id);
      await apiPatch(`/api/notificacoes/${id}/lida`);

      setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));

      if (typeof window.atualizarContadorNotificacoes === "function") {
        window.atualizarContadorNotificacoes();
      }

      if (link) window.location.href = link;
    } catch (error) {
      toast.error("❌ Erro ao marcar como lida.");
      console.error("Erro ao marcar notificação como lida:", error);
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Breadcrumbs paginas={[{ nome: "Início", link: "/" }, { nome: "Notificações" }]} />

      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Bell /> Notificações
      </h1>

      {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
      {!loading && notificacoes.length === 0 && (
        <p className="text-sm text-zinc-500">Você não possui notificações.</p>
      )}

      {notificacoes.map((n, index) => (
        <motion.div
          key={n.id ?? index}
          role="listitem"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={`rounded-xl shadow p-4 border-l-4 transition-all duration-200 ${classesPorTipo(
            n.tipo,
            n.lida
          )}`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{obterIcone(n.tipo)}</div>

            <div className="flex-1">
              {n.titulo && (
                <p className="text-zinc-900 dark:text-white font-semibold leading-tight">
                  {n.titulo}
                </p>
              )}

              <p className="text-zinc-800 dark:text-white">{String(n.mensagem)}</p>

              {/* n.data já vem formatada pelo backend (dd/MM/yyyy) */}
              {n.data && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">📅 {n.data}</p>
              )}

              {!n.lida && (
                <button
                  onClick={() => handleVerMais(n.id, n.link)}
                  className="text-sm text-blue-700 dark:text-blue-400 hover:underline mt-2"
                  disabled={marcando === n.id}
                >
                  {marcando === n.id ? "Salvando..." : n.link ? "Ver mais" : "Marcar como lida"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
