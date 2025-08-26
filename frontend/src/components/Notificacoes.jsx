// src/components/Notificacoes.jsx
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, Star, Check } from "lucide-react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../services/api";

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

  // ➕ util: determina se é NÃO lida aceitando vários nomes de campo
  const isNaoLida = (n) => {
    // se o backend já envia boolean:
    if (typeof n.lida === "boolean") return !n.lida;
    if (typeof n.lido === "boolean") return !n.lido;
    // se envia carimbo de data quando lida:
    if ("lida_em" in n) return !n.lida_em;
    if ("lidaEm" in n) return !n.lidaEm;
    // se não vier nenhum marcador, trate como NÃO lida
    return true;
  };

  async function marcarComoLida(id) {
    try {
      setMarcando(id);
      await apiPost(`/api/notificacoes/${id}/lida`, {});
      // atualiza somente o estilo localmente (não remove)
      setNotificacoes((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, lida: true, lido: true, lida_em: new Date().toISOString() }
            : n
        )
      );
      toast.success("✅ Notificação marcada como lida.");
    } catch {
      toast.error("❌ Não foi possível marcar como lida.");
    } finally {
      setMarcando(null);
    }
  }

  if (loading) return null;
  if (notificacoes.length === 0) return null;

  // mantém a borda colorida por tipo; o fundo é controlado pelo estado (lida/não lida)
  const bordaPorTipo = (tipo) =>
    tipo === "evento"
      ? "border-blue-600"
      : tipo === "avaliacao"
      ? "border-yellow-500"
      : "border-green-600";

  const Icone = ({ tipo }) =>
    tipo === "evento" ? (
      <CalendarDays className="mt-1 text-blue-600" />
    ) : tipo === "avaliacao" ? (
      <Star className="mt-1 text-yellow-500" />
    ) : (
      <FileText className="mt-1 text-green-600" />
    );

  // (opcional) mostra as NÃO lidas primeiro
  const listaOrdenada = useMemo(() => {
    return [...notificacoes].sort((a, b) => (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0));
  }, [notificacoes]);

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold text-lousa dark:text-white mb-4">
        🔔 Minhas Notificações
      </h3>
      <ul className="space-y-3">
        {listaOrdenada.map((n) => {
          const naoLida = isNaoLida(n);
          return (
            <li
              key={n.id ?? `${n.tipo}-${n.mensagem?.slice(0, 20)}`}
              className={[
                "p-4 rounded-lg shadow-md border-l-4 transition-colors",
                bordaPorTipo(n.tipo),
                // fundo diferente para NÃO lida (laranja claro)
                naoLida
                  ? "bg-[#FFF7E6] ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-700/40"
                  : "bg-white dark:bg-zinc-800",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <Icone tipo={n.tipo} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {n.titulo && (
                      <p className="font-semibold text-gray-900 dark:text-white leading-tight">
                        {n.titulo}
                      </p>
                    )}
                    {naoLida && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">
                        • não lida
                      </span>
                    )}
                  </div>

                  <p className="text-gray-800 dark:text-white">{n.mensagem}</p>

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
                  className={[
                    "ml-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded",
                    naoLida
                      ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-100"
                      : "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-100 cursor-default",
                  ].join(" ")}
                  disabled={!naoLida || marcando === n.id}
                  title={naoLida ? "Marcar como lida" : "Já lida"}
                >
                  <Check size={14} />
                  {marcando === n.id ? "Salvando..." : naoLida ? "Marcar como lida" : "Lida"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
