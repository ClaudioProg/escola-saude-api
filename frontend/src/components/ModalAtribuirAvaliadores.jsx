// src/components/ModalAtribuirAvaliadores.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Modal from "./Modal";
import { toast } from "react-toastify";
import {
  listarAtribuicoes,
  incluirAvaliadoresFlex,
  revogarAvaliadorFlex,
  restaurarAvaliadorFlex,
  listarElegiveis,
} from "../services/submissoesAvaliadores";
import {
  Loader2,
  Users,
  PlusCircle,
  Undo2,
  Trash2,
  Search,
  BadgeCheck,
  ShieldAlert,
} from "lucide-react";

const TABS = [
  { key: "escrita", label: "Escrita" },
  { key: "oral", label: "Oral" },
];

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function MiniStatPill({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: "bg-zinc-50 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-200 dark:border-zinc-800",
    emerald:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800",
    rose: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800",
    amber:
      "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800",
    indigo:
      "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-900/25 dark:text-indigo-200 dark:border-indigo-800",
  };

  return (
    <div
      className={cls(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 shadow-sm",
        tones[tone] || tones.zinc
      )}
    >
      <span className="grid place-items-center h-9 w-9 rounded-2xl bg-white/70 dark:bg-zinc-950/30 border border-white/40 dark:border-zinc-800">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-sm font-extrabold">{value}</div>
      </div>
    </div>
  );
}

export default function ModalAtribuirAvaliadores({
  submissaoId,
  isOpen,
  onClose,
  onChanged,
}) {
  const [tab, setTab] = useState("escrita");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [elegiveis, setElegiveis] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);

  const [selecionado, setSelecionado] = useState("");
  const [query, setQuery] = useState("");

  // loading por item (revogar/restaurar)
  const [actionKey, setActionKey] = useState(null);

  const tabLabel = useMemo(() => TABS.find((t) => t.key === tab)?.label || tab, [tab]);

  const ativos = useMemo(() => atribuicoes.filter((a) => !a.revogado), [atribuicoes]);
  const revogados = useMemo(() => atribuicoes.filter((a) => !!a.revogado), [atribuicoes]);

  const ativosDoTipo = useMemo(
    () => ativos.filter((a) => a.tipo === tab),
    [ativos, tab]
  );

  const atribuicoesDoTipo = useMemo(
    () => atribuicoes.filter((a) => a.tipo === tab),
    [atribuicoes, tab]
  );

  // Set para impedir duplicidade no tipo
  const idsAtribuidosNoTipo = useMemo(() => {
    const s = new Set();
    for (const a of atribuicoesDoTipo) s.add(String(a.avaliador_id));
    return s;
  }, [atribuicoesDoTipo]);

  // Elegíveis filtrados por busca (nome/email)
  const elegiveisFiltrados = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const base = Array.isArray(elegiveis) ? elegiveis : [];
    if (!q) return base;

    return base.filter((u) => {
      const nome = String(u?.nome || "").toLowerCase();
      const email = String(u?.email || "").toLowerCase();
      return nome.includes(q) || email.includes(q);
    });
  }, [elegiveis, query]);

  // Normaliza atribuições usando elegíveis como “fonte de nome/email”
  const normalizeAtribuicoes = useCallback(
    (rowsA) => {
      const rows = Array.isArray(rowsA) ? rowsA : [];
      const map = new Map((elegiveis || []).map((u) => [String(u.id), u]));

      return rows.map((a) => {
        const id = a.avaliador_id || a.id;
        const info = map.get(String(id));
        return {
          ...a,
          avaliador_id: id,
          nome: info?.nome || a.nome || `#${id}`,
          email: info?.email || a.email || "",
          tipo: a.tipo || a.modalidade || a.categoria || "escrita",
          revogado: !!a.revogado,
        };
      });
    },
    [elegiveis]
  );

  const refresh = useCallback(async () => {
    try {
      const todos = await listarAtribuicoes(submissaoId, "todos");
      const rowsA = Array.isArray(todos) ? todos : todos?.data ?? [];
      setAtribuicoes(normalizeAtribuicoes(rowsA));
      onChanged?.();
    } catch (e) {
      console.error(e);
      toast.error("❌ Falha ao atualizar atribuições.");
    }
  }, [submissaoId, normalizeAtribuicoes, onChanged]);

  // Carrega ao abrir
  useEffect(() => {
    if (!isOpen || !submissaoId) return;
    let on = true;

    (async () => {
      setLoading(true);
      setSaving(false);
      setActionKey(null);
      setSelecionado("");
      setQuery("");

      try {
        const [cands, todos] = await Promise.all([
          listarElegiveis(),
          listarAtribuicoes(submissaoId, "todos"),
        ]);

        const rowsC = Array.isArray(cands) ? cands : cands?.data ?? [];
        const rowsA = Array.isArray(todos) ? todos : todos?.data ?? [];

        if (!on) return;

        setElegiveis(rowsC);
        // normaliza usando o map de elegíveis (feito via normalizeAtribuicoes)
        // mas normalize usa estado elegiveis, então fazemos um normalize local aqui
        const map = new Map(rowsC.map((u) => [String(u.id), u]));
        const norm = rowsA.map((a) => {
          const id = a.avaliador_id || a.id;
          const info = map.get(String(id));
          return {
            ...a,
            avaliador_id: id,
            nome: info?.nome || a.nome || `#${id}`,
            email: info?.email || a.email || "",
            tipo: a.tipo || a.modalidade || a.categoria || "escrita",
            revogado: !!a.revogado,
          };
        });
        setAtribuicoes(norm);
      } catch (e) {
        console.error(e);
        toast.error("❌ Não foi possível carregar avaliadores/atribuições.");
      } finally {
        if (on) setLoading(false);
      }
    })();

    return () => {
      on = false;
    };
  }, [isOpen, submissaoId]);

  const incluir = async () => {
    if (!selecionado) return;

    // evita duplicar no mesmo tipo
    if (idsAtribuidosNoTipo.has(String(selecionado))) {
      toast.info("Esse avaliador já está atribuído nesta modalidade.");
      return;
    }

    setSaving(true);
    try {
      await incluirAvaliadoresFlex(submissaoId, [
        { avaliadorId: Number(selecionado), tipo: tab },
      ]);
      setSelecionado("");
      toast.success("✅ Avaliador incluído.");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Falha ao incluir avaliador.");
    } finally {
      setSaving(false);
    }
  };

  const revogar = async (avaliadorId, tipo) => {
    const k = `revogar#${tipo}#${avaliadorId}`;
    setActionKey(k);
    try {
      await revogarAvaliadorFlex(submissaoId, { avaliadorId, tipo });
      toast.success("✅ Avaliador revogado.");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Falha ao revogar.");
    } finally {
      setActionKey(null);
    }
  };

  const restaurar = async (avaliadorId, tipo) => {
    const k = `restaurar#${tipo}#${avaliadorId}`;
    setActionKey(k);
    try {
      await restaurarAvaliadorFlex(submissaoId, { avaliadorId, tipo });
      toast.success("✅ Avaliador restaurado.");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "❌ Falha ao restaurar.");
    } finally {
      setActionKey(null);
    }
  };

  // UI helpers
  const selectedInfo = useMemo(() => {
    const id = String(selecionado || "");
    return elegiveis.find((u) => String(u.id) === id) || null;
  }, [selecionado, elegiveis]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-atribuir-avaliadores"
      describedBy="desc-atribuir-avaliadores"
      className="max-w-3xl w-[min(920px,92vw)]"
    >
      {/* Header hero */}
      <div className="rounded-3xl -m-1 mb-4 p-[1px] bg-gradient-to-br from-amber-500 via-fuchsia-500 to-emerald-500">
        <div className="rounded-3xl p-5 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id="titulo-atribuir-avaliadores"
                className="text-lg sm:text-xl font-extrabold flex items-center gap-2"
              >
                <Users className="h-5 w-5" aria-hidden="true" />
                Atribuir avaliadores
              </h3>
              <p id="desc-atribuir-avaliadores" className="mt-1 text-xs sm:text-sm text-white/80">
                Selecione e gerencie avaliadores por modalidade (Escrita / Oral). Você pode revogar e restaurar.
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15 px-3 py-2 text-sm font-bold"
              aria-label="Fechar modal"
              type="button"
            >
              Fechar
            </button>
          </div>

          {/* ministats */}
          <div className="mt-4 flex flex-wrap gap-2">
            <MiniStatPill icon={BadgeCheck} label="Ativos (total)" value={ativos.length} tone="emerald" />
            <MiniStatPill icon={Users} label={`Ativos em ${tabLabel}`} value={ativosDoTipo.length} tone="amber" />
            <MiniStatPill icon={ShieldAlert} label="Revogados" value={revogados.length} tone="rose" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Modalidades" className="flex flex-wrap gap-2">
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${key}`}
              id={`tab-${key}`}
              className={cls(
                "px-3 py-2 rounded-full text-sm font-extrabold border transition",
                active
                  ? "bg-amber-700 text-white border-amber-700"
                  : "bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200/70 dark:bg-zinc-900/40 dark:text-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900/70"
              )}
              onClick={() => setTab(key)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-6 text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className="mt-4"
        >
          {/* Seleção + busca */}
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-[1fr_1fr] gap-3">
              <label className="text-sm">
                <span className="block mb-1 text-zinc-600 dark:text-zinc-300 font-semibold">
                  Buscar avaliador
                </span>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome ou e-mail…"
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40
                               px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-600/40"
                  />
                </div>
              </label>

              <label className="text-sm">
                <span className="block mb-1 text-zinc-600 dark:text-zinc-300 font-semibold">
                  Selecionar para {tabLabel}
                </span>
                <select
                  value={selecionado}
                  onChange={(e) => setSelecionado(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/40
                             px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-600/40"
                >
                  <option value="">Selecione…</option>
                  {elegiveisFiltrados.map((u) => {
                    const jaNoTipo = idsAtribuidosNoTipo.has(String(u.id));
                    return (
                      <option key={u.id} value={u.id} disabled={jaNoTipo}>
                        {u.nome} — {u.email}
                        {jaNoTipo ? " (já atribuído)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            {/* preview do selecionado */}
            {selectedInfo ? (
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/30 p-3">
                <div className="text-sm font-extrabold text-zinc-900 dark:text-white">{selectedInfo.nome}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300">{selectedInfo.email}</div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                onClick={incluir}
                disabled={saving || !selecionado}
                type="button"
                className={cls(
                  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-extrabold",
                  "bg-amber-700 text-white hover:bg-amber-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "focus:outline-none focus:ring-2 focus:ring-amber-700/40"
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Incluir
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="mt-6">
            <h4 className="font-extrabold text-zinc-900 dark:text-white">
              Atribuídos em {tabLabel}
            </h4>

            <ul className="mt-3 space-y-2">
              {atribuicoesDoTipo.map((a) => {
                const isRev = !!a.revogado;
                const kRestore = `restaurar#${a.tipo}#${a.avaliador_id}`;
                const kRevoke = `revogar#${a.tipo}#${a.avaliador_id}`;
                const isBusy = actionKey === kRestore || actionKey === kRevoke;

                return (
                  <li
                    key={`${a.tipo}-${a.avaliador_id}`}
                    className={cls(
                      "rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3",
                      "border-zinc-200 dark:border-zinc-800",
                      "bg-white/70 dark:bg-zinc-950/30"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-zinc-900 dark:text-white truncate">
                        {a.nome}
                      </p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                        {a.email || "—"}
                      </p>

                      {isRev ? (
                        <p className="mt-1 text-xs font-bold text-rose-600 dark:text-rose-300">
                          Revogado
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          Ativo
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      {isRev ? (
                        <button
                          onClick={() => restaurar(a.avaliador_id, a.tipo)}
                          disabled={isBusy}
                          type="button"
                          className={cls(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-extrabold",
                            "bg-emerald-600 text-white hover:bg-emerald-700",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                          Restaurar
                        </button>
                      ) : (
                        <button
                          onClick={() => revogar(a.avaliador_id, a.tipo)}
                          disabled={isBusy}
                          type="button"
                          className={cls(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-extrabold",
                            "bg-rose-600 text-white hover:bg-rose-700",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                          )}
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Revogar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}

              {atribuicoesDoTipo.length === 0 && (
                <li className="text-sm text-zinc-600 dark:text-zinc-300">
                  Nenhum atribuído.
                </li>
              )}
            </ul>
          </div>

          {/* Rodapé */}
          <div className="pt-6 flex justify-end">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-2xl font-extrabold bg-zinc-200 hover:bg-zinc-300
                         dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
