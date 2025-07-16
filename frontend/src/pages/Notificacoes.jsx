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

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Breadcrumbs
        paginas={[{ nome: "Início", link: "/" }, { nome: "Notificações" }]}
      />

      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Bell /> Notificações
      </h1>

      {notificacoes.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-10 text-zinc-500 dark:text-zinc-400"
        >
          <Info className="mx-auto w-8 h-8 mb-2" />
          Nenhuma notificação encontrada.
        </motion.div>
      ) : (
        <div className="space-y-4" role="list">
          {notificacoes.map((n, index) => (
            <motion.div
              key={index}
              role="listitem"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 border-l-4 border-green-600 dark:border-green-400"
            >
              <div className="flex items-start gap-3">
                {obterIcone(n.tipo)}
                <div>
                  <p className="text-zinc-800 dark:text-white font-medium">
                    {n.mensagem}
                  </p>
                  {n.data && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {formatarDataHoraBrasileira(n.data)}
                    </p>
                  )}
                  {n.link && (
                    <a
                      href={n.link}
                      className="inline-block mt-2 text-sm text-blue-700 dark:text-blue-400 hover:underline"
                    >
                      Ver mais
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
