// ✅ src/pages/AvaliadorSubmissoes.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ClipboardList,
  Filter,
  Search,
  FileText,
  Check,
  Eye,
} from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* ───────────── utils ───────────── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);

/* ===== NOVA FUNÇÃO DE NOTA (0–10 NORMALIZADA) ===== */
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function nota10Normalizada({ itens = [], criterios = [] }) {
  if (!Array.isArray(itens) || !Array.isArray(criterios) || !criterios.length) return null;
  const byId = new Map(criterios.map(c => [c.id, c]));
  let num = 0, den = 0;
  for (const it of itens) {
    const c = byId.get(it.criterio_id);
    if (!c) continue;
    const min = Number(c.escala_min ?? 0);
    const max = Number(c.escala_max ?? 10);
    const w   = Number.isFinite(c.peso) ? Number(c.peso) : 1;
    const r   = Number(it.nota);
    if (!Number.isFinite(r) || max <= min) continue;
    const score01 = clamp01((r - min) / (max - min));
    num += w * score01;
    den += w;
  }
  if (den === 0) return null;
  return Number((10 * (num / den)).toFixed(1));
}

/* ───────────── Badge de status ───────────── */
function StatusBadge({ status }) {
  const base =
    "px-2 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 justify-center whitespace-nowrap";
  switch (status) {
    case "submetido":
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>
          <FileText className="w-3 h-3" /> Submetido
        </span>
      );
    case "em_avaliacao":
      return <span className={`${base} bg-amber-100 text-amber-700`}>Em avaliação</span>;
    case "aprovado_exposicao":
      return <span className={`${base} bg-green-100 text-green-700`}>Exposição</span>;
    case "aprovado_oral":
      return <span className={`${base} bg-emerald-100 text-emerald-700`}>Apresentação Oral</span>;
    case "reprovado":
      return <span className={`${base} bg-rose-100 text-rose-700`}>Reprovado</span>;
    default:
      return (
        <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>
          {status || "—"}
        </span>
      );
  }
}

/* ───────────── Card (mobile) ───────────── */
function CardSubmissao({ item, notaW, notaO, showEscrita, showOral, onAbrir }) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col">
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400" />
      <div className="p-4 flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 break-words leading-snug">
              {item.titulo || "—"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words leading-snug">
              {fmt(item.chamada_titulo)} · {fmt(item.linha_tematica_nome)}
            </p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-[13px] text-zinc-700 dark:text-zinc-300">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Escrita (/10)</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {Number.isFinite(notaW) ? notaW.toFixed(1) : "—"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Oral (/10)</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {Number.isFinite(notaO) ? notaO.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {showEscrita && (
            <button
              onClick={() => onAbrir("escrita")}
              className="w-1/2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium text-center"
            >
              Avaliar escrita
            </button>
          )}
          {showOral && (
            <button
              onClick={() => onAbrir("oral")}
              className="w-1/2 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium text-center"
            >
              Avaliar oral
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Tabela (desktop) ───────────── */
function TabelaSubmissoes({ itens, notasMap, onAbrir, variant = "pending" }) {
  const headClass = variant === "pending" ? "bg-green-800 text-white" : "bg-amber-500 text-white";

  return (
    <div className="hidden md:block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-sm table-auto">
              <thead>
                <tr className={headClass}>
                <th className="px-4 py-3 text-left w-[34%] min-w-[360px]">Título</th>
             <th className="px-4 py-3 text-left w-[16%] whitespace-nowrap">Chamada</th>
             <th className="px-4 py-3 text-left w-[18%]">Linha</th>
            <th className="px-4 py-3 text-left w-[10%] whitespace-nowrap">Status</th>
             <th className="px-4 py-3 text-left w-[8%] whitespace-nowrap">Nota escrita</th>
             <th className="px-4 py-3 text-left w-[8%] whitespace-nowrap">Nota oral</th>
             <th className="px-4 py-3 text-left w-[6%] whitespace-nowrap">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {itens.map((s) => {
            const notaW = notasMap[`${s.id}-escrita`];
            const notaO = notasMap[`${s.id}-oral`];
            const tipo = String(s.tipo || "escrita").toLowerCase();
            const showW = tipo !== "oral";
            const showO = tipo === "oral";
            return (
              <tr key={`${s.id}-${tipo}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{s.titulo || "—"}</td>
                <td className="px-4 py-3">{fmt(s.chamada_titulo)}</td>
                <td className="px-4 py-3">{fmt(s.linha_tematica_nome)}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3">{Number.isFinite(notaW) ? notaW.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">{Number.isFinite(notaO) ? notaO.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {showW && (
                      <button
                        onClick={() => onAbrir(s.id, "escrita")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Eye className="w-4 h-4" />
                        Escrita
                      </button>
                    )}
                    {showO && (
                      <button
                        onClick={() => onAbrir(s.id, "oral")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                      >
                        <Eye className="w-4 h-4" />
                        Oral
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}

/* ───────────── Drawer ───────────── */
function DrawerAvaliacao({ open, onClose, submissaoId, tipo }) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [criterios, setCriterios] = useState([]);
  const [itens, setItens] = useState([]);

  useEffect(() => {
    if (!open || !submissaoId) return;
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const url =
          tipo === "oral"
            ? `/avaliador/submissoes/${submissaoId}?tipo=oral`
            : `/avaliador/submissoes/${submissaoId}`;

        const r = await api.get(url, { signal: ac.signal });
        const data = r?.data ?? r;

        setMeta(data.submissao);
        setCriterios(data.criterios || []);

        const m = new Map((data.avaliacaoAtual || []).map((x) => [x.criterio_id, x]));
        setItens(
          (data.criterios || []).map((c) => ({
            criterio_id: c.id,
            nota: m.get(c.id)?.nota ?? "",
            comentarios: m.get(c.id)?.comentarios ?? "",
          }))
        );
      } catch (e) {
        if (e?.name !== "AbortError") console.error("Falha ao carregar avaliação:", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, submissaoId, tipo]);

  async function salvar() {
    try {
      const payload = {
        itens: itens
          .filter((x) => x.nota !== "" && x.nota != null)
          .map((x) => ({ criterio_id: x.criterio_id, nota: Number(x.nota), comentarios: x.comentarios || null })),
      };
      if (!payload.itens.length) return alert("Preencha ao menos uma nota.");

      const url =
        tipo === "oral"
          ? `/avaliador/submissoes/${submissaoId}/avaliar-oral`
          : `/avaliador/submissoes/${submissaoId}/avaliar`;

      await api.post(url, payload);
      onClose?.({ saved: true, tipo });
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
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 break-words">
                Avaliação — {fmt(meta?.titulo)}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-words">
                {fmt(meta?.chamada_titulo)} · {fmt(meta?.linha_tematica_nome)} · Início {fmt(meta?.inicio_experiencia)}
              </p>
            </div>
            <div className="shrink-0">
              <StatusBadge status={meta?.status} />
            </div>
          </div>
        </div>

        {/* Corpo */}
        {loading ? (
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
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
                  <h5 className="font-semibold mb-1 text-zinc-800 dark:text-zinc-100">{label}</h5>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{value || "—"}</p>
                </div>
              ))}
            </section>

            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Critérios de avaliação</h4>
              <div className="mt-3 space-y-4">
                {criterios.map((c, idx) => (
                  <div key={c.id} className="rounded-xl border dark:border-zinc-800 p-3 sm:p-4">
                    <p className="font-medium text-zinc-800 dark:text-zinc-50 break-words">{c.criterio}</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-6 gap-3 items-start">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">
                          Nota ({c.escala_min}–{c.escala_max})
                        </label>
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
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">Comentários (opcional)</label>
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

        {/* Rodapé */}
        <div className="p-4 sm:p-5 border-t dark:border-zinc-800 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={() => onClose?.()}
            className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm font-medium"
          >
            Fechar
          </button>
          <button
            onClick={salvar}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center justify-center gap-2 text-sm font-medium"
            aria-label="Salvar avaliação"
          >
            <Check className="w-4 h-4" /> Salvar avaliação
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────── Página principal ───────────── */
export default function AvaliadorSubmissoes() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState([]);          // lista crua do backend (uma linha por atribuição)
  const [busca, setBusca] = useState("");
  const [debounced, setDebounced] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focus, setFocus] = useState({ id: null, tipo: null }); // {id, tipo}
  const [notasMap, setNotasMap] = useState({});   // `${id}-escrita` | `${id}-oral` -> nota (/10)

  // Ministats
  const [contagens, setContagens] = useState({ total: null, pendentes: null, avaliados: null });

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => setDebounced(busca.trim().toLowerCase()), 200);
    return () => clearTimeout(t);
  }, [busca]);

  // Carga inicial + contagens + notas por linha (somente da modalidade daquela linha)
  useOnceEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);

        // 1) lista
        const r = await api.get("/avaliador/submissoes", { signal: ac.signal });
        const arr = Array.isArray(r?.data) ? r.data : r;
        setLista(arr);

        // 2) contagens
        try {
          const c = await api.get("/avaliador/minhas-contagens", { signal: ac.signal });
          const data = c?.data ?? {};
          if (typeof data?.total !== "undefined") setContagens(data);
          else {
            const pend = arr.filter((s) => !s.ja_avaliado).length;
            const done = arr.length - pend;
            setContagens({ total: arr.length, pendentes: pend, avaliados: done });
          }
        } catch {
          const pend = arr.filter((s) => !s.ja_avaliado).length;
          const done = arr.length - pend;
          setContagens({ total: arr.length, pendentes: pend, avaliados: done });
        }

        // 3) notas por linha (respeitando a modalidade da linha)
        const conc = 4;
        let i = 0;
        async function pegarNotaParaLinha(s) {
          try {
            const tipo = String(s.tipo || "escrita").toLowerCase();
            const url = tipo === "oral" ? `/avaliador/submissoes/${s.id}?tipo=oral` : `/avaliador/submissoes/${s.id}`;
            const det = await api.get(url, { signal: ac.signal });
            const d = det?.data ?? det;
            const criterios = d?.criterios || [];
            const itens = Array.isArray(d?.avaliacaoAtual) ? d.avaliacaoAtual : [];
            const nota = nota10Normalizada({ itens, criterios });
            if (nota != null) {
              const k = `${s.id}-${tipo}`;
              setNotasMap((prev) => (prev[k] != null ? prev : { ...prev, [k]: nota }));
            }
          } catch {
            /* sem avaliação ainda para esta modalidade — ok */
          }
        }

        const workers = Array.from({ length: conc }, async () => {
          while (i < arr.length) {
            const s = arr[i++];
            await pegarNotaParaLinha(s);
          }
        });
        await Promise.allSettled(workers);
      } catch (e) {
        if (e?.name !== "AbortError") console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    if (!debounced) return lista;
    return (lista || []).filter((s) =>
      [s.titulo, s.chamada_titulo, s.linha_tematica_nome, s.status]
        .map((v) => (v ? String(v).toLowerCase() : ""))
        .some((t) => t.includes(debounced))
    );
  }, [lista, debounced]);

  const pendentes = useMemo(() => filtradas.filter((s) => !s.ja_avaliado), [filtradas]);
  const realizadas = useMemo(() => filtradas.filter((s) => s.ja_avaliado), [filtradas]);

  const totalSubmissoes = contagens.total != null ? contagens.total : (lista || []).length;
  const totalPendentes = contagens.pendentes != null ? contagens.pendentes : pendentes.length;
  const totalAvaliadas = contagens.avaliados != null ? contagens.avaliados : realizadas.length;

  const mediaGeral = useMemo(() => {
    const notasValidas = Object.values(notasMap).filter((n) => Number.isFinite(n));
    if (!notasValidas.length) return null;
    const soma = notasValidas.reduce((acc, v) => acc + v, 0);
    return Number((soma / notasValidas.length).toFixed(1));
  }, [notasMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-950">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-950">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="bg-gradient-to-br from-emerald-700 via-teal-600 to-amber-500 text-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-10 sm:py-12 text-center 2xl:max-w-[1800px] xl:max-w-[1680px]">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8" />
                <h1 className="text-2xl sm:text-3xl font-extrabold">Trabalhos para avaliar</h1>
              </div>
              <p className="opacity-90 text-sm sm:text-base max-w-2xl">
                Você só vê informações necessárias à avaliação. Os dados do autor ficam ocultos.
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 mx-auto w-full space-y-8 xl:max-w-[1680px] 2xl:max-w-[1800px]">
        {/* Ministats */}
        <section className="grid grid-cols-2 md:grid-cols-4 2xl:grid-cols-4 gap-4 2xl:gap-6">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Total recebidos</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{totalSubmissoes}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Pendentes p/ você</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totalPendentes}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Já avaliados</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalAvaliadas}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">Sua média (/10)</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {mediaGeral != null ? mediaGeral.toFixed(1) : "—"}
            </p>
          </div>
        </section>

        {/* Filtro / busca */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:flex-wrap gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Filtrar</h2>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xl w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, chamada ou linha temática…"
              className="border rounded-md pl-9 pr-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="Buscar submissões"
            />
          </div>
        </section>

        {/* ───── Pendentes ───── */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Avaliações pendentes ({pendentes.length})</h3>

          {/* Desktop */}
          <TabelaSubmissoes
            variant="pending"
            itens={pendentes}
            notasMap={notasMap}
            onAbrir={(id, tipo) => {
              setFocus({ id, tipo: tipo || "escrita" });
              setDrawerOpen(true);
            }}
          />

          {/* Mobile */}
          <div className="grid gap-4 md:hidden">
            {pendentes.map((s) => {
              const kW = `${s.id}-escrita`;
              const kO = `${s.id}-oral`;
              const tipo = String(s.tipo || "escrita").toLowerCase();
              const showW = tipo !== "oral";
              const showO = tipo === "oral";
              return (
                <CardSubmissao
                  key={`${s.id}-${tipo}`}
                  item={s}
                  notaW={notasMap[kW]}
                  notaO={notasMap[kO]}
                  showEscrita={showW}
                  showOral={showO}
                  onAbrir={(t) => {
                    setFocus({ id: s.id, tipo: t });
                    setDrawerOpen(true);
                  }}
                />
              );
            })}
            {pendentes.length === 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Sem pendências por enquanto.</p>
            )}
          </div>
        </section>

        {/* ───── Realizadas ───── */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Avaliações realizadas ({realizadas.length})</h3>

          {/* Desktop */}
          <TabelaSubmissoes
            variant="done"
            itens={realizadas}
            notasMap={notasMap}
            onAbrir={(id, tipo) => {
              setFocus({ id, tipo: tipo || "escrita" });
              setDrawerOpen(true);
            }}
          />

          {/* Mobile */}
          <div className="grid gap-4 md:hidden">
            {realizadas.map((s) => {
              const kW = `${s.id}-escrita`;
              const kO = `${s.id}-oral`;
              const tipo = String(s.tipo || "escrita").toLowerCase();
              const showW = tipo !== "oral";
              const showO = tipo === "oral";
              return (
                <CardSubmissao
                  key={`${s.id}-${tipo}`}
                  item={s}
                  notaW={notasMap[kW]}
                  notaO={notasMap[kO]}
                  showEscrita={showW}
                  showOral={showO}
                  onAbrir={(t) => {
                    setFocus({ id: s.id, tipo: t });
                    setDrawerOpen(true);
                  }}
                />
              );
            })}
            {realizadas.length === 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Nenhuma avaliação enviada ainda.</p>
            )}
          </div>
        </section>
      </main>

      <Footer />

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <DrawerAvaliacao
            open={drawerOpen}
            submissaoId={focus.id}
            tipo={focus.tipo}
            onClose={async (ev) => {
              setDrawerOpen(false);

              if (ev?.saved) {
                try {
                  const t = ev.tipo || focus.tipo || "escrita";
                  const url =
                    t === "oral"
                      ? `/avaliador/submissoes/${focus.id}?tipo=oral`
                      : `/avaliador/submissoes/${focus.id}`;
                  const det = await api.get(url);
                  const d = det?.data ?? det;
                  const avAtual = Array.isArray(d?.avaliacaoAtual) ? d.avaliacaoAtual : [];
                  const k = `${focus.id}-${t}`;
                  if (avAtual.length >= 4) {
                    const total20 = avAtual.map((x) => Number(x?.nota || 0)).reduce((a, b) => a + b, 0);
                    setNotasMap((prev) => ({ ...prev, [k]: Number((total20 / 2).toFixed(1)) }));
                  } else if (d?.minha_avaliacao) {
                    const n = calcularNota10De(d.minha_avaliacao);
                    if (n != null) setNotasMap((prev) => ({ ...prev, [k]: n }));
                  }
                } catch (err) {
                  console.error("Falha ao atualizar nota pós-salvar:", err);
                }

                try {
                  const r2 = await api.get("/avaliador/submissoes");
                  const arr = Array.isArray(r2?.data) ? r2.data : r2;
                  setLista(arr);

                  try {
                    const c = await api.get("/avaliador/minhas-contagens");
                    const data = c?.data ?? {};
                    if (typeof data?.total !== "undefined") setContagens(data);
                    else {
                      const pend = arr.filter((s) => !s.ja_avaliado).length;
                      const done = arr.length - pend;
                      setContagens({ total: arr.length, pendentes: pend, avaliados: done });
                    }
                  } catch {
                    /* fallback ok */
                  }
                } catch (err) {
                  console.error("Falha ao atualizar lista pós-salvar:", err);
                }
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
