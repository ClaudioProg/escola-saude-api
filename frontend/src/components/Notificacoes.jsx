// src/components/Notificacoes.jsx
import { useEffect, useState } from "react";
import { CalendarDays, FileText, Star } from "lucide-react";
import { toast } from "react-toastify";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet } from "../services/api";

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);

  useEffect(() => {
    async function carregarNotificacoes() {
      try {
        const data = await apiGet("/api/notificacoes"); // ✅ sem token aqui
        setNotificacoes(data);
      } catch {
        toast.error("❌ Erro ao carregar notificações.");
      }
    }
    carregarNotificacoes();
  }, []); // ✅ não precisa depender de token

  if (notificacoes.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-lousa dark:text-white mb-4">
        🔔 Minhas Notificações
      </h3>
      <ul className="space-y-3">
        {notificacoes.map((n, i) => (
          <li
            key={i}
            className={`p-4 rounded-lg shadow-md border-l-4 ${
              n.tipo === "evento"
                ? "border-blue-600 bg-blue-50 dark:bg-zinc-800"
                : n.tipo === "avaliacao"
                ? "border-yellow-500 bg-yellow-50 dark:bg-zinc-800"
                : "border-green-600 bg-green-50 dark:bg-zinc-800"
            }`}
          >
            <div className="flex items-start gap-3">
              {n.tipo === "evento" && <CalendarDays className="mt-1 text-blue-600" />}
              {n.tipo === "avaliacao" && <Star className="mt-1 text-yellow-500" />}
              {n.tipo === "certificado" && <FileText className="mt-1 text-green-600" />}
              <div>
                <p className="font-medium text-gray-800 dark:text-white">{n.mensagem}</p>
                {n.data && (
                  <p className="text-sm text-gray-500 mt-1 dark:text-gray-300">
                    📅 {formatarDataBrasileira(n.data)}
                  </p>
                )}
                {n.link && (
                  <a
                    href={n.link}
                    className="text-sm text-blue-700 dark:text-blue-400 underline mt-1 inline-block"
                  >
                    Ver mais
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
