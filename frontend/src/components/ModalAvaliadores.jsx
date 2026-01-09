// ✅ src/components/ModalAvaliadores.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Users, Loader2, Search, ArrowUpDown, X, BarChart3, CheckCircle2, AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import api from "../services/api";

/* ====================== Data fetch ====================== */
async function fetchResumoAvaliadores() {
  const r = await api.get("/admin/avaliadores/resumo");
  const data = r?.data ?? r;
  if (Array.isArray(data?.avaliadores)) return data.avaliadores;
  if (Array.isArray(data)) return data;
  return [];
}

/* ====================== Helpers ====================== */
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function MiniStat({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/30 text-zinc-900 dark:text-white",
    amber:
      "border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/15 text-amber-900 dark:text-amber-200",
    emerald:
      "border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/15 text-emerald-900 dark:text-emerald-200",
    indigo:
      "border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-900/15 text-indigo-900 dark:text-indigo-200",
  };

  return (
    <div className={cls("rounded-2xl border p-3 shadow-sm", tones[tone] || tones.zinc)}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-9 h-9 rounded-2xl bg-white/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800">
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-70">{label}</div>
          <div className="text-xl font-extrabold leading-none">{value}</div>
        </div>
      </div>
    </div>
  );
}

function SortIndicator({ active, dir }) {
  return (
    <span className={cls("inline-flex items-center", active ? "opacity-100" : "opacity-60")}>
      <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="sr-only">{active ? `Ordenando ${dir === "asc" ? "crescente" : "decrescente"}` : "Ordenar"}</span>
    </span>
  );
}

/* ====================== Componente ====================== */
/**
 * Formato esperado:
 * [
 *   { id, nome, email, pendentes, avaliados, total }
 * ]
 */
export default function ModalAvaliadores({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState({ key: "pendentes", dir: "desc" });

  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErro("");
      setBusca("");

      try {
        const rows = await fetchResumoAvaliadores();
        if (!alive) return;

        const normalized = (rows || []).map((r) => {
          const pend = Number(r.pendentes ?? r.to_do ?? 0);
          const done = Number(r.avaliados ?? r.done ?? 0);
          const tot = Number(r.total ?? (pend + done)) || 0;

          return {
            id: r.id,
            nome: r.nome || r.fullname || r.display_name || "—",
            email: r.email || r.mail || "—",
            pendentes: pend,
            avaliados: done,
            total: tot,
          };
        });

        setLista(normalized);
      } catch (e) {
        if (!alive) return;
        setErro(e?.response?.data?.error || "Não foi possível carregar o resumo dos avaliadores.");
        setLista([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isOpen]);

  // foco no fechar
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => closeBtnRef.current?.focus?.());
  }, [isOpen]);

  const debounced = useMemo(() => norm(busca), [busca]);

  const filtrada = useMemo(() => {
    let out = lista;

    if (debounced) {
      out = out.filter((a) => norm(a.nome).includes(debounced) || norm(a.email).includes(debounced));
    }

    const dir = sort.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const k = sort.key;
      if (k === "nome" || k === "email") return String(a[k]).localeCompare(String(b[k])) * dir;
      return (Number(a[k]) - Number(b[k])) * dir;
    });

    return out;
  }, [lista, debounced, sort]);

  const toggleSort = useCallback((key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }, []);

  const totals = useMemo(() => {
    const totalPend = filtrada.reduce((acc, a) => acc + (Number(a.pendentes) || 0), 0);
    const totalDone = filtrada.reduce((acc, a) => acc + (Number(a.avaliados) || 0), 0);
    const totalAll = filtrada.reduce((acc, a) => acc + (Number(a.total) || 0), 0);
    const qtd = filtrada.length;

    return { qtd, totalPend, totalDone, totalAll };
  }, [filtrada]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-modal-avaliadores"
      describedBy="desc-modal-avaliadores"
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
      initialFocusRef={closeBtnRef}
    >
      {/* Header premium */}
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="titulo-modal-avaliadores" className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
              <Users className="w-5 h-5" aria-hidden="true" />
              Avaliadores — resumo
            </h3>
            <p id="desc-modal-avaliadores" className="text-white/90 text-sm mt-1">
              Quantidade de trabalhos pendentes e avaliados por avaliador.
            </p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/15 hover:bg-white/20 border border-white/20 px-3 py-2 text-sm font-extrabold"
            type="button"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            Fechar
          </button>
        </div>

        {/* Busca */}
        <div className="mt-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/70" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="w-full rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-white/70
                       pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/25"
          />
        </div>
      </header>

      {/* Corpo rolável único */}
      <div className="max-h-[72vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-24">
        {/* ministats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <MiniStat icon={BarChart3} label="Avaliadores" value={totals.qtd} tone="indigo" />
          <MiniStat icon={AlertTriangle} label="Pendentes" value={totals.totalPend} tone="amber" />
          <MiniStat icon={CheckCircle2} label="Avaliados" value={totals.totalDone} tone="emerald" />
          <MiniStat icon={Users} label="Total" value={totals.totalAll} tone="zinc" />
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : erro ? (
          <p className="mt-5 text-sm text-rose-600 dark:text-rose-400">{erro}</p>
        ) : filtrada.length === 0 ? (
          <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Nenhum avaliador encontrado.</p>
        ) : (
          <>
            {/* ===== Desktop: tabela ===== */}
            <div className="mt-5 hidden sm:block overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/40">
                  <tr className="text-zinc-700 dark:text-zinc-200">
                    <th className="p-3 text-left">
                      <button
                        onClick={() => toggleSort("nome")}
                        className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase"
                        type="button"
                      >
                        Nome <SortIndicator active={sort.key === "nome"} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button
                        onClick={() => toggleSort("email")}
                        className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase"
                        type="button"
                      >
                        E-mail <SortIndicator active={sort.key === "email"} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="p-3 text-center">
                      <button
                        onClick={() => toggleSort("pendentes")}
                        className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase"
                        type="button"
                      >
                        Pendentes <SortIndicator active={sort.key === "pendentes"} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="p-3 text-center">
                      <button
                        onClick={() => toggleSort("avaliados")}
                        className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase"
                        type="button"
                      >
                        Avaliados <SortIndicator active={sort.key === "avaliados"} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="p-3 text-center">
                      <button
                        onClick={() => toggleSort("total")}
                        className="inline-flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase"
                        type="button"
                      >
                        Total <SortIndicator active={sort.key === "total"} dir={sort.dir} />
                      </button>
                    </th>
                    <th className="p-3 text-center">
                      <span className="text-xs font-extrabold tracking-wide uppercase">Progresso</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filtrada.map((a) => {
                    const total = Number(a.total) || 0;
                    const done = Number(a.avaliados) || 0;
                    const pend = Number(a.pendentes) || 0;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                    return (
                      <tr
                        key={a.id || a.email || a.nome}
                        className="border-t dark:border-zinc-800 hover:bg-emerald-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="p-3 font-semibold text-zinc-900 dark:text-white">{a.nome}</td>
                        <td className="p-3 text-zinc-600 dark:text-zinc-300">{a.email}</td>

                        <td className="p-3 text-center">
                          <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-extrabold
                                           bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                            {pend}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-extrabold
                                           bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {done}
                          </span>
                        </td>

                        <td className="p-3 text-center">
                          <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-extrabold
                                           bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                            {total}
                          </span>
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                              <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-extrabold text-zinc-700 dark:text-zinc-200 w-12 text-right">
                              {pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== Mobile: cards (padrão do projeto) ===== */}
            <div className="mt-5 sm:hidden space-y-3">
              {filtrada.map((a) => {
                const total = Number(a.total) || 0;
                const done = Number(a.avaliados) || 0;
                const pend = Number(a.pendentes) || 0;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <article
                    key={a.id || a.email || a.nome}
                    className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-900 dark:text-white truncate">{a.nome}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 break-all">{a.email}</div>
                      </div>
                      <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {pct}%
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-900/15 p-2 text-center">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                          Pendentes
                        </div>
                        <div className="text-xl font-extrabold text-amber-900 dark:text-amber-200">{pend}</div>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/15 p-2 text-center">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                          Avaliados
                        </div>
                        <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{done}</div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/30 p-2 text-center">
                        <div className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                          Total
                        </div>
                        <div className="text-xl font-extrabold text-zinc-900 dark:text-white">{total}</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                        Progresso: <strong className="text-zinc-900 dark:text-white">{done}</strong> de{" "}
                        <strong className="text-zinc-900 dark:text-white">{total}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3 flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-2xl font-extrabold bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
          type="button"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}
