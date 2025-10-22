// ✅ src/components/ModalAvaliadores.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { Users, Loader2, Search, ArrowUpDown } from "lucide-react";
import ModalBase from "./ModalBase";
import api from "../services/api";

// Busca resumida (único endpoint padronizado)
async function fetchResumoAvaliadores() {
  const r = await api.get("/admin/avaliadores/resumo");
  const data = r?.data ?? r;
  if (Array.isArray(data?.avaliadores)) return data.avaliadores;
  if (Array.isArray(data)) return data;
  return [];
}

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
  const initialBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setErro("");
      try {
        const rows = await fetchResumoAvaliadores();
        if (!alive) return;
        const normalized = rows.map((r) => ({
          id: r.id,
          nome: r.nome || r.fullname || r.display_name || "—",
          email: r.email || r.mail || "—",
          pendentes: Number(r.pendentes ?? r.to_do ?? 0),
          avaliados: Number(r.avaliados ?? r.done ?? 0),
          total:
            Number(
              r.total ??
                (Number(r.pendentes ?? r.to_do ?? 0) +
                  Number(r.avaliados ?? r.done ?? 0))
            ) || 0,
        }));
        setLista(normalized);
      } catch (e) {
        if (!alive) return;
        setErro(
          e?.response?.data?.error ||
            "Não foi possível carregar o resumo dos avaliadores."
        );
        setLista([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOpen]);

  const debounced = useMemo(() => busca.trim().toLowerCase(), [busca]);

  const filtrada = useMemo(() => {
    let out = lista;
    if (debounced) {
      out = out.filter((a) =>
        [a.nome, a.email]
          .map((s) => (s ? String(s).toLowerCase() : ""))
          .some((t) => t.includes(debounced))
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const k = sort.key;
      if (k === "nome" || k === "email") {
        return String(a[k]).localeCompare(String(b[k])) * dir;
      }
      return (a[k] - b[k]) * dir;
    });
    return out;
  }, [lista, debounced, sort]);

  const thBtn =
    "inline-flex items-center gap-1 text-xs font-semibold tracking-wide uppercase";

  const toggleSort = (key) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      labelledBy="titulo-modal-avaliadores"
      initialFocusRef={initialBtnRef}
    >
      {/* Cabeçalho fixo */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b dark:border-zinc-800 p-4 sm:p-5 rounded-t-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            <h3 id="titulo-modal-avaliadores" className="text-lg font-bold">
              Avaliadores com trabalhos encaminhados
            </h3>
          </div>
          <button
            ref={initialBtnRef}
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm bg-zinc-200 dark:bg-zinc-800"
          >
            Fechar
          </button>
        </div>

        {/* Busca */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail…"
            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
          </div>
        ) : erro ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">{erro}</p>
        ) : filtrada.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Nenhum avaliador encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-emerald-700 text-white">
                <tr>
                  <th className="p-3 text-left">
                    <button onClick={() => toggleSort("nome")} className={thBtn}>
                      Nome <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="p-3 text-left hidden sm:table-cell">
                    <button onClick={() => toggleSort("email")} className={thBtn}>
                      E-mail <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="p-3 text-center">
                    <button onClick={() => toggleSort("pendentes")} className={thBtn}>
                      Pendentes <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="p-3 text-center">
                    <button onClick={() => toggleSort("avaliados")} className={thBtn}>
                      Avaliados <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                  <th className="p-3 text-center">
                    <button onClick={() => toggleSort("total")} className={thBtn}>
                      Total <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((a) => (
                  <tr
                    key={a.id || a.email || a.nome}
                    className="border-b last:border-0 dark:border-zinc-800 hover:bg-emerald-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="p-3 font-medium">{a.nome}</td>
                    <td className="p-3 hidden sm:table-cell text-zinc-600 dark:text-zinc-300">
                      {a.email}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        {a.pendentes}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                        {a.avaliados}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex min-w-[2.5rem] justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        {a.total}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
