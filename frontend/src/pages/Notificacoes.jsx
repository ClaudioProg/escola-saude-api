// pages/Notificacoes.jsx
import { useEffect, useState, useMemo } from "react";
import { Bell, CalendarDays, CheckCircle, Info, Star, Check } from "lucide-react";
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

  // ───────────────────────── helpers ─────────────────────────
  const isNaoLida = (n) => {
    if (typeof n?.lida === "boolean") return !n.lida;
    if (typeof n?.lido === "boolean") return !n.lido;
    if ("lida_em" in (n || {})) return !n.lida_em;
    if ("lidaEm" in (n || {})) return !n.lidaEm;
    // se não houver marcador, tratamos como não lida
    return true;
  };

  const obterIcone = (tipo) => {
    switch (String(tipo || "").toLowerCase()) {
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
  };

  // classes do cartão -> PRIORIDADE: estado de leitura
  const classesCartao = (n) =>
    isNaoLida(n)
      ? "bg-[#FFF7E6] ring-1 ring-amber-200 border-amber-400 dark:bg-amber-900/20 dark:ring-amber-700/40 dark:border-amber-600"
      : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700";

  async function handleMarcarLida(id, link) {
    try {
      setMarcando(id);
      await apiPatch(`/api/notificacoes/${id}/lida`);
      // atualiza visualmente
      setNotificacoes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, lida: true, lido: true, lida_em: new Date().toISOString() } : n
        )
      );
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

  // opcional: não lidas primeiro
  const lista = useMemo(
    () => [...notificacoes].sort((a, b) => (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0)),
    [notificacoes]
  );

  // ───────────────────────── render ─────────────────────────
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <Breadcrumbs paginas={[{ nome: "Início", link: "/" }, { nome: "Notificações" }]} />

      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Bell /> Notificações
      </h1>

      {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
      {!loading && lista.length === 0 && (
        <p className="text-sm text-zinc-500">Você não possui notificações.</p>
      )}

      {lista.map((n, index) => {
        const naoLida = isNaoLida(n);
        return (
          <motion.div
            key={n.id ?? index}
            role="listitem"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`rounded-xl shadow p-4 border-l-4 transition-all duration-200 ${classesCartao(
              n
            )}`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{obterIcone(n.tipo)}</div>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {n.titulo && (
                    <p className="text-zinc-900 dark:text-white font-semibold leading-tight">
                      {n.titulo}
                    </p>
                  )}
                  {naoLida && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">
                      • não lida
                    </span>
                  )}
                </div>

                <p className="text-zinc-800 dark:text-white">{String(n.mensagem)}</p>

                {n.data && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">📅 {n.data}</p>
                )}

                <div className="mt-2">
                  <button
                    onClick={() => handleMarcarLida(n.id, n.link)}
                    className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded
                      ${naoLida
                        ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-100"
                        : "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-100 cursor-default"}`}
                    disabled={!naoLida || marcando === n.id}
                  >
                    <Check size={14} />
                    {marcando === n.id ? "Salvando..." : naoLida ? (n.link ? "Ver mais" : "Marcar como lida") : "Lida"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
