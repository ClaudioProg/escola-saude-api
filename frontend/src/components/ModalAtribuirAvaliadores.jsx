// src/components/ModalAtribuirAvaliadores.jsx
import { useEffect, useMemo, useState } from "react";
import {
  listarAtribuicoes,
  incluirAvaliadoresFlex,
  revogarAvaliadorFlex,
  restaurarAvaliadorFlex,
  listarElegiveis,
} from "../services/submissoesAvaliadores";
import { Loader2, Users, X, PlusCircle, Undo2, Trash2 } from "lucide-react";

const TABS = [
  { key: "escrita", label: "Escrita" },
  { key: "oral", label: "Oral" },
];

export default function ModalAtribuirAvaliadores({ submissaoId, isOpen, onClose, onChanged }) {
  const [tab, setTab] = useState("escrita");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [elegiveis, setElegiveis] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);
  const [selecionado, setSelecionado] = useState("");

  const ativos = useMemo(() => atribuicoes.filter((a) => !a.revogado), [atribuicoes]);
  const totalAtivos = ativos.length;
  const ativosDoTipo = useMemo(
    () => ativos.filter((a) => a.tipo === tab),
    [ativos, tab]
  );

  useEffect(() => {
    if (!isOpen || !submissaoId) return;
    let on = true;
    (async () => {
      setLoading(true);
      try {
        const [cands, todos] = await Promise.all([
          listarElegiveis(),
          listarAtribuicoes(submissaoId, "todos"),
        ]);
        const rowsC = Array.isArray(cands) ? cands : cands?.data ?? [];
        const rowsA = Array.isArray(todos) ? todos : todos?.data ?? [];
        if (on) {
          setElegiveis(rowsC);
        
          // mapear avaliadores -> trazer nome e email
          const map = new Map(rowsC.map((u) => [String(u.id), u]));
        
          const norm = rowsA.map((a) => {
            const id = a.avaliador_id || a.id;
            const info = map.get(String(id));
            return {
              ...a,
              avaliador_id: id,
              nome: info?.nome || a.nome || `#${id}`,
              email: info?.email || a.email || "",
            };
          });
        
          setAtribuicoes(norm);
        }
        
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [isOpen, submissaoId]);

  if (!isOpen) return null;

  const refresh = async () => {
    const todos = await listarAtribuicoes(submissaoId, "todos");
    const rowsA = Array.isArray(todos) ? todos : todos?.data ?? [];
    const map = new Map(elegiveis.map((u) => [String(u.id), u]));
const norm = rowsA.map((a) => {
  const id = a.avaliador_id || a.id;
  const info = map.get(String(id));
  return {
    ...a,
    avaliador_id: id,
    nome: info?.nome || a.nome || `#${id}`,
    email: info?.email || a.email || "",
  };
});
setAtribuicoes(norm);
    onChanged?.();
  };

  const incluir = async () => {
    if (!selecionado) return;
    setSaving(true);
    try {
      await incluirAvaliadoresFlex(submissaoId, [{ avaliadorId: Number(selecionado), tipo: tab }]);
      setSelecionado("");
      await refresh();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Falha ao incluir avaliador.");
    } finally {
      setSaving(false);
    }
  };

  const revogar = async (avaliadorId, tipo) => {
    setSaving(true);
    try {
      await revogarAvaliadorFlex(submissaoId, { avaliadorId, tipo });
      await refresh();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Falha ao revogar.");
    } finally {
      setSaving(false);
    }
  };

  const restaurar = async (avaliadorId, tipo) => {
    setSaving(true);
    try {
      await restaurarAvaliadorFlex(submissaoId, { avaliadorId, tipo });
      await refresh();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Falha ao restaurar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> Incluir avaliadores
          </h3>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 pt-4">
          {/* Abas */}
          <div role="tablist" className="flex gap-2">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  tab === key ? "bg-amber-700 text-white" : "bg-zinc-100 dark:bg-zinc-800"
                }`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-6 text-sm text-zinc-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {/* Seleção */}
              <div className="mt-4 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
                <label className="text-sm">
                  <span className="block mb-1 text-zinc-600 dark:text-zinc-300">
                    Selecionar avaliador para {TABS.find(t=>t.key===tab)?.label}
                  </span>
                  <select
                    value={selecionado}
                    onChange={(e) => setSelecionado(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <option value="">Selecione…</option>
                    {elegiveis.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome} — {u.email}</option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={incluir}
                  disabled={saving || !selecionado}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Incluir
                </button>
              </div>

              {/* Lista do tipo atual */}
              <div className="mt-5">
                <h4 className="font-semibold">Atribuídos em {TABS.find(t=>t.key===tab)?.label}</h4>
                <ul className="mt-2 space-y-2">
                  {atribuicoes.filter((a)=>a.tipo===tab).map((a) => (
                    <li key={`${a.tipo}-${a.avaliador_id}`} className="flex items-center justify-between rounded-lg border dark:border-zinc-800 px-3 py-2">
                      <div>
                      <p className="font-medium">{a.nome}</p>
                        {a.revogado && <p className="text-xs text-rose-600">Revogado</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {a.revogado ? (
                          <button
                          onClick={() => restaurar(a.avaliador_id, a.tipo)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white"
                          >
                            <Undo2 className="h-4 w-4" /> Restaurar
                          </button>
                        ) : (
                          <button
                          onClick={() => revogar(a.avaliador_id, a.tipo)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-rose-600 text-white"
                          >
                            <Trash2 className="h-4 w-4" /> Revogar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {atribuicoes.filter((a)=>a.tipo===tab).length === 0 && (
                    <li className="text-sm text-zinc-600">Nenhum atribuído.</li>
                  )}
                </ul>
              </div>

              {/* Rodapé */}
              <div className="py-5 flex justify-end">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800">
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
