//pages/Notificacoes
import { useEffect, useState } from "react";
import { Bell, CalendarDays, CheckCircle, Info, Star } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { formatarDataHoraBrasileira } from "../utils/data";

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);

  useEffect(() => {
    async function carregarNotificacoes() {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/notificacoes", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error("Erro ao carregar notificações");
        }

        const data = await response.json();
        setNotificacoes(data);
      } catch (error) {
        toast.error("❌ Erro ao carregar notificações.");
        console.error("Erro:", error);
      }
    }

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

  async function handleVerMais(id, link) {
    try {
      const token = localStorage.getItem("token");
  
      await fetch(`/api/notificacoes/${id}/lida`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      // ✅ Atualiza no estado local sem remover
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
      );
  
      // ✅ Atualiza o contador no sininho
      if (typeof window.atualizarContadorNotificacoes === "function") {
        window.atualizarContadorNotificacoes();
      }
  
      if (link) window.location.href = link;
    } catch (error) {
      toast.error("❌ Erro ao marcar como lida.");
      console.error("Erro ao marcar notificação como lida:", error);
    }
  }
  
  

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Breadcrumbs
        paginas={[{ nome: "Início", link: "/" }, { nome: "Notificações" }]}
      />

      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Bell /> Notificações
      </h1>

      {notificacoes.map((n, index) => {
  console.log("Notificação:", n);
  return (
    <motion.div
      key={index}
      role="listitem"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`rounded-xl shadow p-4 border-l-4 transition-all duration-200 ${
        n.lida
          ? "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700"
          : "bg-green-50 dark:bg-green-900 border-green-600 dark:border-green-400"
      }`}
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-start w-full">
  <div className="flex-1">
    <p className="text-zinc-800 dark:text-white font-medium">
      {String(n.mensagem)}
    </p>
    {n.data && (
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
      📅 {n.data}
    </p>
    )}
  </div>
  {!n.lida && (
    <button
      onClick={() => handleVerMais(n.id, n.link)}
      className="text-sm text-blue-700 dark:text-blue-400 hover:underline mt-2 md:mt-0 md:ml-4 self-end"
    >
      {n.link ? "Ver mais" : "Marcar como lida"}
    </button>
  )}
</div>
    </motion.div>
  );
})}

    </div>
  );
}
