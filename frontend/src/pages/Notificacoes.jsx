// 📁 src/pages/Notificacoes.jsx
import { useState, useMemo } from "react";
import { Bell, CalendarDays, CheckCircle, Info, Star, Check } from "lucide-react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { apiGet, apiPatch } from "../services/api";
import { useOnceEffect } from "../hooks/useOnceEffect";

import Breadcrumbs from "../components/Breadcrumbs";
import Footer from "../components/Footer";

/* =======================
   Helpers de data (anti-UTC)
   ======================= */
function formatarDataLocalLegivel(s) {
  if (!s) return "";
  const str = String(s);
  const mDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) return `${mDate[3]}/${mDate[2]}/${mDate[1]}`;
  const mDateTime = str.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (mDateTime) {
    const [, y, mo, d, hh, mm] = mDateTime;
    return `${d}/${mo}/${y} ${hh}:${mm}`;
  }
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return str;
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${d}/${mo}/${y} ${hh}:${mm}`;
}

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  async function carregarNotificacoes(signal) {
    try {
      setLoading(true);
      const data = await apiGet("/api/notificacoes", { signal });
      setNotificacoes(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error?.name !== "AbortError") {
        toast.error("❌ Erro ao carregar notificações.");
        console.error("Erro:", error);
        setNotificacoes([]);
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ evita duplo carregamento (StrictMode)
  useOnceEffect(() => {
    const ac = new AbortController();
    carregarNotificacoes(ac.signal);
    return () => ac.abort();
  }, []);

  // ───────────── Helpers ─────────────
  const isNaoLida = (n) => {
    if (typeof n?.lida === "boolean") return !n.lida;
    if (typeof n?.lido === "boolean") return !n.lido;
    if ("lida_em" in (n || {})) return !n.lida_em;
    if ("lidaEm" in (n || {})) return !n.lidaEm;
    return true;
  };

  const obterIcone = (tipo) => {
    switch (String(tipo || "").toLowerCase()) {
      case "evento":
        return <CalendarDays className="text-blue-600 dark:text-blue-400" aria-hidden="true" />;
      case "certificado":
        return <CheckCircle className="text-green-600 dark:text-green-400" aria-hidden="true" />;
      case "aviso":
        return <Info className="text-yellow-600 dark:text-yellow-400" aria-hidden="true" />;
      case "avaliacao":
        return <Star className="text-purple-600 dark:text-purple-400" aria-hidden="true" />;
      default:
        return <Bell className="text-gray-600 dark:text-gray-400" aria-hidden="true" />;
    }
  };

  const classesCartao = (n) =>
    isNaoLida(n)
      ? "bg-[#FFF7E6] ring-1 ring-amber-200 border-amber-400 dark:bg-amber-900/20 dark:ring-amber-700/40 dark:border-amber-600"
      : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700";

  async function handleMarcarLida(id, link) {
    try {
      setMarcando(id);
      await apiPatch(`/api/notificacoes/${id}/lida`);
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
      console.error(error);
    } finally {
      setMarcando(null);
    }
  }

  async function marcarTodas() {
    const ids = notificacoes.filter(isNaoLida).map((n) => n.id).filter(Boolean);
    if (!ids.length) return;
    try {
      setMarcandoTodas(true);
      for (const id of ids) {
        try {
          await apiPatch(`/api/notificacoes/${id}/lida`);
        } catch (e) {
          console.warn("Falha ao marcar:", id, e);
        }
      }
      toast.success("✅ Notificações marcadas como lidas.");
      setNotificacoes((prev) =>
        prev.map((n) => ({ ...n, lida: true, lido: true, lida_em: n.lida_em ?? new Date().toISOString() }))
      );
      if (typeof window.atualizarContadorNotificacoes === "function") {
        window.atualizarContadorNotificacoes();
      }
    } finally {
      setMarcandoTodas(false);
    }
  }

  const lista = useMemo(
    () => [...notificacoes].sort((a, b) => (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0)),
    [notificacoes]
  );

  // ───────────── Render ─────────────
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 🟣 HeaderHero exclusivo desta página (violeta → fúcsia → rosa) */}
      <header
        className="relative w-full text-white bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 py-10 px-6 sm:py-16 sm:px-8 shadow-lg"
        aria-labelledby="header-notificacoes-title"
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto text-center flex flex-col items-center justify-center"
        >
          <Bell size={48} strokeWidth={1.5} className="mb-3 animate-pulse drop-shadow-md" aria-hidden="true" />
          <h1 id="header-notificacoes-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
            Minhas Notificações
          </h1>
          <p className="mt-2 text-base sm:text-lg text-white/90 max-w-2xl">
            Acompanhe avisos, certificados e atualizações da Escola da Saúde.
          </p>
        </motion.div>
      </header>

      <main role="main" className="flex-1">
        <section className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
          <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Notificações" }]} />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-lousa dark:text-white">
              <Bell aria-hidden="true" /> Notificações
            </h2>

            <button
              onClick={marcarTodas}
              disabled={marcandoTodas || !lista.some(isNaoLida)}
              className="text-sm px-3 py-1.5 rounded-full bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
              aria-label="Marcar todas as notificações como lidas"
            >
              {marcandoTodas ? "Marcando..." : "Marcar todas"}
            </button>
          </div>

          {loading && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
              Carregando...
            </p>
          )}

          {!loading && lista.length === 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Você não possui notificações.
            </p>
          )}

          <div role="list" className="space-y-3">
            {lista.map((n, index) => {
              const naoLida = isNaoLida(n);
              return (
                <motion.div
                  key={n.id ?? index}
                  role="listitem"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`rounded-xl shadow p-4 border-l-4 transition-all duration-200 ${classesCartao(n)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">{obterIcone(n.tipo)}</div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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

                      {n.mensagem && (
                        <p className="text-zinc-800 dark:text-white mt-0.5">
                          {String(n.mensagem)}
                        </p>
                      )}

                      {(n.data || n.criada_em || n.criadaEm) && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          📅 {formatarDataLocalLegivel(n.data || n.criada_em || n.criadaEm)}
                        </p>
                      )}

                      <div className="mt-2">
                        <button
                          onClick={() => handleMarcarLida(n.id, n.link)}
                          className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700
                            ${
                              naoLida
                                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-100"
                                : "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-100 cursor-default"
                            }`}
                          disabled={!naoLida || marcando === n.id}
                          aria-label={
                            naoLida
                              ? (n.link ? "Ver mais e marcar como lida" : "Marcar como lida")
                              : "Notificação já lida"
                          }
                        >
                          <Check size={14} />
                          {marcando === n.id
                            ? "Salvando..."
                            : naoLida
                            ? n.link
                              ? "Ver mais"
                              : "Marcar como lida"
                            : "Lida"}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
