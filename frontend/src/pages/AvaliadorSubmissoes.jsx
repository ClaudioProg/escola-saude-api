// 📁 src/pages/AvaliadorSubmissoes.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ClipboardList, Filter, Search, FileText, Check } from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* utils */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);

/* Badge simples de status */
function StatusBadge({ status }) {
  const base = "px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 justify-center";
  switch (status) {
    case "submetido":
      return <span className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200`}><FileText className="w-3 h-3" /> Submetido</span>;
    case "em_avaliacao":
      return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200`}>Em avaliação</span>;
    case "aprovado_exposicao":
      return <span className={`${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200`}>Exposição</span>;
    case "aprovado_oral":
      return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200`}>Oral</span>;
    case "reprovado":
      return <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200`}>Reprovado</span>;
    default:
      return <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{status || "—"}</span>;
  }
}

/* Drawer de avaliação */
function DrawerAvaliacao({ open, onClose, submissaoId }) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);               // submissão (cego) + textos
  const [criterios, setCriterios] = useState([]);       // [{id,criterio,escala_min,escala_max,peso}]
  const [itens, setItens] = useState([]);               // [{criterio_id, nota, comentarios}]

  useEffect(() => {
    if (!open || !submissaoId) return;
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const r = await api.get(`/avaliador/submissoes/${submissaoId}`, { signal: ac.signal });
        const data = r?.data ?? r;
        setMeta(data.submissao);
        setCriterios(data.criterios || []);
        const m = new Map((data.avaliacaoAtual || []).map(x => [x.criterio_id, x]));
        setItens((data.criterios || []).map(c => ({
          criterio_id: c.id,
          nota: m.get(c.id)?.nota ?? "",
          comentarios: m.get(c.id)?.comentarios ?? ""
        })));
      } catch (e) {
        if (e?.name !== "AbortError") console.error("Falha ao carregar avaliação:", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, submissaoId]);

  async function salvar() {
    try {
      const payload = {
        itens: itens
          .filter(x => x.nota !== "" && x.nota !== null && x.nota !== undefined)
          .map(x => ({ criterio_id: x.criterio_id, nota: Number(x.nota), comentarios: x.comentarios || null })),
      };
      if (!payload.itens.length) return alert("Preencha ao menos uma nota.");

      await api.post(`/avaliador/submissoes/${submissaoId}/avaliar`, payload);
      onClose?.({ saved: true });
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.erro || "Falha ao salvar avaliação.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50">
                Avaliação — {fmt(meta?.titulo)}
              </h3>
              <p className="text-xs text-zinc-500">
   {fmt(meta?.chamada_titulo)} · Linha {fmt(meta?.linha_tematica_nome)}
   {meta?.linha_tematica_codigo ? ` (${meta.linha_tematica_codigo})` : ""} ·
   Início {fmt(meta?.inicio_experiencia)}
 </p>
            </div>
            <StatusBadge status={meta?.status} />
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            {/* 🔎 Conteúdo textual do trabalho (sem banner/poster) */}
            <section className="space-y-4">
              <h4 className="text-center font-semibold text-zinc-800 dark:text-zinc-100">Conteúdo do trabalho</h4>
              {[
                ["Introdução", meta?.introducao],
                ["Objetivos", meta?.objetivos],
                ["Método", meta?.metodo],
                ["Resultados", meta?.resultados],
                ["Considerações Finais", meta?.consideracoes],
                ["Bibliografia", meta?.bibliografia],
              ].map(([label, value]) => (
                <div key={label} className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4">
                  <h5 className="font-semibold mb-1">{label}</h5>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {value || "—"}
                  </p>
                </div>
              ))}
            </section>

            {/* 📝 Formulário de critérios (nota + comentários) */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Critérios de avaliação</h4>
              <div className="mt-3 space-y-4">
                {criterios.map((c, idx) => (
                  <div key={c.id} className="rounded-xl border dark:border-zinc-800 p-3 sm:p-4">
                    <p className="font-medium text-zinc-800 dark:text-zinc-50">{c.criterio}</p>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-6 gap-3 items-start">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-zinc-500">Nota ({c.escala_min}–{c.escala_max})</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={c.escala_min}
                          max={c.escala_max}
                          step={1}
                          className="mt-1 w-full border rounded-md px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          value={itens[idx]?.nota ?? ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? "" : Number(e.target.value);
                            setItens((old) => {
                              const arr = [...old];
                              arr[idx] = { ...arr[idx], criterio_id: c.id, nota: v };
                              return arr;
                            });
                          }}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="text-xs text-zinc-500">Comentários (opcional)</label>
                        <textarea
                          rows={2}
                          className="mt-1 w-full border rounded-md px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          value={itens[idx]?.comentarios ?? ""}
                          onChange={(e) =>
                            setItens((old) => {
                              const arr = [...old];
                              arr[idx] = { ...arr[idx], criterio_id: c.id, comentarios: e.target.value };
                              return arr;
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {criterios.length === 0 && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Nenhum critério configurado para esta chamada.</p>
                )}
              </div>
            </section>
          </div>
        )}

        <div className="p-4 sm:p-5 border-t dark:border-zinc-800 flex gap-3 justify-end">
          <button onClick={() => onClose?.()} className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            Fechar
          </button>
          <button onClick={salvar} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2">
            <Check className="w-4 h-4" /> Salvar avaliação
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* =================== PÁGINA LISTA =================== */
export default function AvaliadorSubmissoes() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [debounced, setDebounced] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusId, setFocusId] = useState(null);

  useOnceEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const r = await api.get("/avaliador/submissoes", { signal: ac.signal });
        setLista(Array.isArray(r?.data) ? r.data : r);
      } catch (e) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(busca.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [busca]);

  const filtradas = useMemo(() => {
    if (!debounced) return lista;
    return lista.filter((s) =>
         [s.titulo, s.chamada_titulo, s.linha_tematica_nome, s.linha_tematica_codigo, s.status]
        .map(v => (v ? String(v).toLowerCase() : ""))
        .some(t => t.includes(debounced))
    );
  }, [lista, debounced]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 to-yellow-100">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-950">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 text-white">
          <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12 text-center">
            <div className="flex items-center justify-center gap-3">
              <ClipboardList className="h-8 w-8" />
              <h1 className="text-2xl sm:text-3xl font-extrabold">Trabalhos para avaliar</h1>
            </div>
            <p className="opacity-90 text-sm sm:text-base mt-1">Você só vê informações necessárias à avaliação. Os dados do autor ficam ocultos.</p>
          </div>
        </div>
      </motion.header>

      {/* Conteúdo */}
      <main className="flex-1 px-4 sm:px-8 py-10 max-w-7xl mx-auto w-full space-y-8">
        {/* Filtro de busca */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-5 border dark:border-zinc-800 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Filtrar</h2>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, chamada, código..."
              className="border rounded-md pl-9 pr-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
        </section>

        {/* Tabela */}
        <section className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-emerald-600 text-white">
              <tr>
                <th className="p-3 text-left">Título</th>
                <th className="p-3 text-left">Chamada</th>
                <th className="p-3 text-left">Linha temática</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Meu status</th>
                <th className="p-3 text-center">Avaliar</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-zinc-600">Nada encontrado.</td></tr>
              )}
              {filtradas.map((s) => (
                <tr key={s.id} className="border-b dark:border-zinc-800 hover:bg-emerald-50/60 dark:hover:bg-zinc-800/40 transition">
                  <td className="p-3 max-w-[36ch] truncate" title={s.titulo}>{s.titulo}</td>
                  <td className="p-3">{s.chamada_titulo}</td>
                  <td className="p-3">
  <span className="block">{fmt(s.linha_tematica_nome)}</span>
   <span className="block text-xs text-zinc-500">{fmt(s.linha_tematica_codigo)}</span>
 </td>
                  <td className="p-3 text-center"><StatusBadge status={s.status} /></td>
                  <td className="p-3 text-center">
                    {s.ja_avaliado ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><Check className="w-4 h-4"/> enviado</span> : "—"}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => { setFocusId(s.id); setDrawerOpen(true); }}
                      className="px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      <Footer />

      <AnimatePresence>
        {drawerOpen && (
          <DrawerAvaliacao
            open={drawerOpen}
            submissaoId={focusId}
            onClose={(ev) => {
              setDrawerOpen(false);
              if (ev?.saved) {
                // refresh “meu status”
                api.get("/avaliador/submissoes").then((r) => setLista(Array.isArray(r?.data) ? r.data : r));
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
