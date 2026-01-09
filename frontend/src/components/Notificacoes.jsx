// 📁 src/components/Notificacoes.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, FileText, Star, Check, RefreshCw, Bell } from "lucide-react";
import { toast } from "react-toastify";
import { apiGet, apiPost } from "../services/api";

/* ────────────────────────────────────────────────────────────── */
/* Utils locais (SEM timezone shift)                              */
/* ────────────────────────────────────────────────────────────── */

function pickDateField(n) {
  return (
    n?.data ||
    n?.criada_em ||
    n?.criadaEm ||
    n?.created_at ||
    n?.createdAt ||
    n?.enviada_em ||
    n?.enviadaEm ||
    null
  );
}

// dd/mm/aaaa[ HH:mm[:ss]]
function parseBrDateTime(s) {
  const txt = String(s || "").trim();
  const m = txt.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  return {
    y: Number(yyyy),
    m: Number(mm),
    d: Number(dd),
    hh: Number(hh),
    mi: Number(mi),
  };
}

// yyyy-mm-dd[ T]hh:mm[:ss][.ms][Z|±hh:mm]  (IGNORA sufixo de TZ, sem shift)
function parseIsoLikeNoShift(s) {
  const txt = String(s || "").trim();
  const m = txt.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?)?(?:Z|[+-]\d{2}:\d{2})?$/
  );
  if (!m) return null;
  const [, yyyy, mm, dd, hh = "00", mi = "00"] = m;
  return {
    y: Number(yyyy),
    m: Number(mm),
    d: Number(dd),
    hh: Number(hh),
    mi: Number(mi),
  };
}

function parseAnyDateTimeNoShift(v) {
  if (!v) return null;
  const txt = String(v).trim();
  // BR
  const br = parseBrDateTime(txt);
  if (br) return br;

  // ISO-like (sem shift)
  const iso = parseIsoLikeNoShift(txt);
  if (iso) return iso;

  // fallback: tenta data-only yyyy-mm-dd mesmo se vier com coisa extra
  const m = txt.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]), hh: 0, mi: 0 };

  return null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateTimeBRNoShift(v) {
  const p = parseAnyDateTimeNoShift(v);
  if (!p) return "";
  const d = `${pad2(p.d)}/${pad2(p.m)}/${p.y}`;
  const t = `${pad2(p.hh)}:${pad2(p.mi)}`;
  // se for 00:00 e não veio hora, ok mostrar só data? (prefiro manter sempre data+hora por consistência)
  return `${d} ${t}`;
}

// chave numérica p/ ordenar desc (maior = mais recente), sem Date()
function sortKeyNoShift(v) {
  const p = parseAnyDateTimeNoShift(v);
  if (!p) return 0;
  // YYYYMMDDHHmm
  return (
    p.y * 100000000 +
    p.m * 1000000 +
    p.d * 10000 +
    p.hh * 100 +
    p.mi
  );
}

// aceita várias convenções de backend
function isNaoLida(n) {
  if (typeof n?.lida === "boolean") return !n.lida;
  if (typeof n?.lido === "boolean") return !n.lido;
  if ("lida_em" in n) return !n.lida_em;
  if ("lidaEm" in n) return !n.lidaEm;
  return true;
}

function tipoNorm(n) {
  const t = String(n?.tipo || "").toLowerCase();
  if (t === "evento") return "evento";
  if (t === "avaliacao" || t === "avaliação") return "avaliacao";
  if (t === "documento" || t === "doc" || t === "arquivo") return "documento";
  return "outros";
}

function bordaPorTipo(tipo) {
  return tipo === "evento"
    ? "border-sky-600"
    : tipo === "avaliacao"
    ? "border-amber-500"
    : tipo === "documento"
    ? "border-emerald-600"
    : "border-slate-400";
}

function topbarPorTipo(tipo) {
  return tipo === "evento"
    ? "from-sky-600 via-indigo-500 to-violet-500"
    : tipo === "avaliacao"
    ? "from-amber-500 via-orange-500 to-rose-500"
    : tipo === "documento"
    ? "from-emerald-600 via-teal-500 to-cyan-500"
    : "from-slate-500 via-zinc-500 to-stone-500";
}

function IconeTipo({ tipo }) {
  return tipo === "evento" ? (
    <CalendarDays className="mt-1 text-sky-700 dark:text-sky-300" aria-hidden="true" />
  ) : tipo === "avaliacao" ? (
    <Star className="mt-1 text-amber-600 dark:text-amber-300" aria-hidden="true" />
  ) : tipo === "documento" ? (
    <FileText className="mt-1 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
  ) : (
    <Bell className="mt-1 text-slate-600 dark:text-slate-300" aria-hidden="true" />
  );
}

function safeKey(n, idx) {
  return n?.id ?? `${tipoNorm(n)}-${(n?.titulo || n?.mensagem || "").slice(0, 24)}-${idx}`;
}

// ISO agora (para marcar lida) — isso não afeta exibição (exibição é no-shift)
function isoNow() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

/* ────────────────────────────────────────────────────────────── */
/* Componente                                                     */
/* ────────────────────────────────────────────────────────────── */

export default function Notificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcando, setMarcando] = useState(null); // id em progresso
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  // live region
  const [a11yMsg, setA11yMsg] = useState("");
  const a11yRef = useRef(null);

  const anunciar = useCallback((msg) => {
    setA11yMsg(msg);
    // não forçar foco sempre; apenas quando precisa (SR antigos)
    // a11yRef.current?.focus?.();
  }, []);

  const carregarNotificacoes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet("/api/notificacoes");
      const arr = Array.isArray(data) ? data : [];
      setNotificacoes(arr);
      anunciar(`Lista atualizada. ${arr.length} notificação(ões).`);
    } catch {
      toast.error("❌ Erro ao carregar notificações.");
      setNotificacoes([]);
      anunciar("Erro ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, [anunciar]);

  useEffect(() => {
    carregarNotificacoes();
  }, [carregarNotificacoes]);

  // ordena: não lidas primeiro; depois por data desc (sem timezone shift)
  const listaOrdenada = useMemo(() => {
    return [...notificacoes].sort((a, b) => {
      const unreadDelta = (isNaoLida(b) ? 1 : 0) - (isNaoLida(a) ? 1 : 0);
      if (unreadDelta !== 0) return unreadDelta;
      const ka = sortKeyNoShift(pickDateField(a));
      const kb = sortKeyNoShift(pickDateField(b));
      return kb - ka;
    });
  }, [notificacoes]);

  const totalNaoLidas = useMemo(
    () => notificacoes.reduce((acc, n) => acc + (isNaoLida(n) ? 1 : 0), 0),
    [notificacoes]
  );

  const porTipo = useMemo(() => {
    const base = { evento: 0, avaliacao: 0, documento: 0, outros: 0 };
    for (const n of notificacoes) base[tipoNorm(n)]++;
    return base;
  }, [notificacoes]);

  const marcarComoLida = useCallback(
    async (id) => {
      if (!id) return;
      try {
        setMarcando(id);
        await apiPost(`/api/notificacoes/${id}/lida`, {});
        const now = isoNow();
        setNotificacoes((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, lida: true, lido: true, lida_em: now, lidaEm: now }
              : n
          )
        );
        window.atualizarContadorNotificacoes?.();
        anunciar("Notificação marcada como lida.");
      } catch {
        toast.error("❌ Não foi possível marcar como lida.");
      } finally {
        setMarcando(null);
      }
    },
    [anunciar]
  );

  const marcarTodas = useCallback(async () => {
    const ids = notificacoes.filter(isNaoLida).map((n) => n.id).filter(Boolean);
    if (ids.length === 0) return;
    setMarcandoTodas(true);

    try {
      await Promise.allSettled(ids.map((id) => apiPost(`/api/notificacoes/${id}/lida`, {})));
      const now = isoNow();
      setNotificacoes((prev) =>
        prev.map((n) => (isNaoLida(n) ? { ...n, lida: true, lido: true, lida_em: now, lidaEm: now } : n))
      );
      window.atualizarContadorNotificacoes?.();
      toast.success("✅ Todas as não lidas foram marcadas como lidas.");
      anunciar("Todas as notificações não lidas foram marcadas como lidas.");
    } catch {
      toast.error("❌ Falha ao marcar todas como lidas.");
    } finally {
      setMarcandoTodas(false);
    }
  }, [notificacoes, anunciar]);

  /* ────────────── HeaderHero + Ministats ────────────── */
  const Header = (
    <header className="rounded-2xl overflow-hidden mb-4 border border-black/5 dark:border-white/10 shadow-sm">
      <div className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-amber-900 via-orange-800 to-yellow-700">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 shrink-0" aria-hidden />
              <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                Minhas Notificações
              </h3>
            </div>
            <p className="text-white/90 text-sm mt-1">
              Acompanhe atualizações de eventos, avaliações e documentos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={carregarNotificacoes}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/60"
              title="Atualizar lista"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>

            <button
              onClick={marcarTodas}
              disabled={totalNaoLidas === 0 || marcandoTodas}
              className={[
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-white/60 active:scale-[.99] transition",
                totalNaoLidas === 0 || marcandoTodas
                  ? "bg-white/10 text-white/60 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white",
              ].join(" ")}
              title={totalNaoLidas ? "Marcar todas como lidas" : "Nenhuma não lida"}
            >
              <Check className="w-4 h-4" />
              {marcandoTodas ? "Marcando..." : "Marcar todas"}
            </button>
          </div>
        </div>

        {/* Ministats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="rounded-xl bg-white/10 p-2">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Total</div>
            <div className="text-sm font-bold">{notificacoes.length}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Não lidas</div>
            <div className="text-sm font-bold">{totalNaoLidas}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Eventos</div>
            <div className="text-sm font-bold">{porTipo.evento}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Avaliações</div>
            <div className="text-sm font-bold">{porTipo.avaliacao}</div>
          </div>
          <div className="rounded-xl bg-white/10 p-2">
            <div className="text-[11px] uppercase tracking-wide opacity-80">Docs</div>
            <div className="text-sm font-bold">{porTipo.documento}</div>
          </div>
        </div>
      </div>
    </header>
  );

  /* ────────────── Loading ────────────── */
  if (loading) {
    return (
      <section className="mb-8">
        {Header}
        <ul className="space-y-3" aria-busy="true" aria-live="polite" role="list">
          {[...Array(4)].map((_, i) => (
            <li
              key={i}
              className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />
              <div className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-11/12" />
                  <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-1/3" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /* ────────────── Empty ────────────── */
  if (notificacoes.length === 0) {
    return (
      <section className="mb-8">
        {Header}
        <div
          className="rounded-2xl border border-black/5 dark:border-white/10 p-6 bg-white dark:bg-zinc-900 text-center text-gray-700 dark:text-gray-200 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <div className="h-1 rounded-t-xl bg-gradient-to-r from-slate-500 via-zinc-500 to-stone-500 -mt-6 -mx-6 mb-4" />
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-80" aria-hidden="true" />
          <p className="font-semibold">Nenhuma notificação por aqui.</p>
          <p className="text-sm opacity-80">Volte mais tarde ou clique em “Atualizar”.</p>
        </div>
      </section>
    );
  }

  /* ────────────────────────────────────────────────────────────── */
  return (
    <section className="mb-8">
      {/* região live discreta para leitores de tela */}
      <span
        ref={a11yRef}
        tabIndex={-1}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {a11yMsg}
      </span>

      {Header}

      <ul className="space-y-3" role="list" aria-live="polite">
        {listaOrdenada.map((n, idx) => {
          const tipo = tipoNorm(n);
          const naoLida = isNaoLida(n);
          const dataStr = formatDateTimeBRNoShift(pickDateField(n));
          const topbar = topbarPorTipo(tipo);

          return (
            <li
              key={safeKey(n, idx)}
              role="listitem"
              className={[
                "rounded-2xl border shadow-sm overflow-hidden transition-colors",
                "border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900",
                naoLida ? "ring-1 ring-amber-200/70 dark:ring-amber-700/40" : "",
              ].join(" ")}
            >
              {/* top bar */}
              <div className={`h-1 bg-gradient-to-r ${topbar}`} />

              <div
                className={[
                  "p-4 border-l-4",
                  bordaPorTipo(tipo),
                  naoLida
                    ? "bg-amber-50/70 dark:bg-amber-900/10"
                    : "bg-white dark:bg-zinc-900",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <IconeTipo tipo={tipo} />

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.titulo && (
                        <p className="font-semibold text-slate-900 dark:text-white leading-tight truncate">
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
                      <p className="text-slate-700 dark:text-slate-200 mt-0.5 break-words">
                        {n.mensagem}
                      </p>
                    )}

                    {(dataStr || n.link) && (
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {dataStr && (
                          <span className="text-xs text-slate-500 dark:text-slate-300">
                            📅 {dataStr}
                          </span>
                        )}

                        {n.link && (
                          <a
                            href={n.link}
                            className="text-xs font-semibold text-sky-700 dark:text-sky-300 underline underline-offset-2"
                            onClick={() => {
                              if (naoLida && n.id) marcarComoLida(n.id);
                            }}
                          >
                            Ver mais
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Botão marcar como lida */}
                  <button
                    onClick={() => marcarComoLida(n.id)}
                    className={[
                      "ml-2 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl transition",
                      "focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[.99]",
                      naoLida
                        ? "bg-amber-100 hover:bg-amber-200 text-amber-900 focus-visible:ring-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/40 dark:text-amber-100"
                        : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-300 cursor-default focus-visible:ring-slate-400",
                    ].join(" ")}
                    disabled={!naoLida || marcando === n.id}
                    title={naoLida ? "Marcar como lida" : "Já lida"}
                  >
                    <Check className="w-4 h-4" />
                    {marcando === n.id ? "Salvando..." : naoLida ? "Marcar" : "Lida"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
