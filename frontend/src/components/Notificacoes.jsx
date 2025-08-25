// src/components/Notificacoes.jsx
import { useEffect, useState } from "react";
import { CalendarDays, FileText, Star, Check } from "lucide-react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../services/api"; // apiPost para marcar como lida (ajuste se for PUT)

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(null);

  async function carregarNotificacoes() {
    try {
      setLoading(true);
      const data = await apiGet("/api/notificacoes");
      setNotificacoes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("❌ Erro ao carregar notificações.");
      setNotificacoes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarNotificacoes();
  }, []);

  async function marcarComoLida(id) {
    try {
      setMarcando(id);
      // ajuste o método/rota conforme seu router:
      // ex.: PATCH /api/notificacoes/:id/lida ou POST idem
      await apiPost(`/api/notificacoes/${id}/lida`, {});
      // Remover localmente para experiência mais rápida
      setNotificacoes((prev) => prev.filter((n) => n.id !== id));
      toast.success("✅ Notificação marcada como lida.");
    } catch (e) {
      toast.error("❌ Não foi possível marcar como lida.");
    } finally {
      setMarcando(null);
    }
  }

  if (loading) return null;
  if (notificacoes.length === 0) return null;

  const badgeClasses = (tipo) =>
    tipo === "evento"
      ? "border-blue-600 bg-blue-50 dark:bg-zinc-800"
      : tipo === "avaliacao"
      ? "border-yellow-500 bg-yellow-50 dark:bg-zinc-800"
      : "border-green-600 bg-green-50 dark:bg-zinc-800";

  const Icone = ({ tipo }) =>
    tipo === "evento" ? (
      <CalendarDays className="mt-1 text-blue-600" />
    ) : tipo === "avaliacao" ? (
      <Star className="mt-1 text-yellow-500" />
    ) : (
      <FileText className="mt-1 text-green-600" />
    );

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-lousa dark:text-white mb-4">
        🔔 Minhas Notificações
      </h3>
      <ul className="space-y-3">
        {notificacoes.map((n) => (
          <li
            key={n.id ?? `${n.tipo}-${n.mensagem?.slice(0,20)}`}
            className={`p-4 rounded-lg shadow-md border-l-4 ${badgeClasses(n.tipo)}`}
          >
            <div className="flex items-start gap-3">
              <Icone tipo={n.tipo} />
              <div className="flex-1">
                {n.titulo && (
                  <p className="font-semibold text-gray-900 dark:text-white leading-tight">
                    {n.titulo}
                  </p>
                )}
                <p className="text-gray-800 dark:text-white">
                  {n.mensagem}
                </p>

                {/* n.data já vem formatada do backend (dd/MM/yyyy) */}
                {n.data && (
                  <p className="text-sm text-gray-500 mt-1 dark:text-gray-300">
                    📅 {n.data}
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

              {/* Botão marcar como lida */}
              <button
                onClick={() => marcarComoLida(n.id)}
                className="ml-2 inline-flex items-center gap-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-800 dark:text-gray-100 px-2 py-1 rounded"
                disabled={marcando === n.id}
                title="Marcar como lida"
              >
                <Check size={14} />
                {marcando === n.id ? "Salvando..." : "Lida"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
