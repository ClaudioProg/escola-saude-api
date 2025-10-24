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
} from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* ───────────────── utils ───────────────── */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);

/* ===== helpers de nota do avaliador (0–10) ===== */
function extrairQuatroCriterios(obj) {
  if (!obj) return [0, 0, 0, 0];
  if (Array.isArray(obj.notas) && obj.notas.length >= 4) {
    return obj.notas.slice(0, 4).map((n) => (Number.isFinite(+n) ? +n : 0));
  }
  if (Array.isArray(obj.itens) && obj.itens.length >= 4) {
    const notas = obj.itens
      .map((i) => Number(i?.nota))
      .filter((x) => Number.isFinite(x));
    if (notas.length >= 4) return notas.slice(0, 4);
  }
  const conj = ["criterio1", "criterio2", "criterio3", "criterio4"];
  const vals = conj.map((k) => Number(obj?.[k]));
  if (vals.some((v) => Number.isFinite(v)))
    return vals.map((v) => (Number.isFinite(v) ? v : 0));
  return [0, 0, 0, 0];
}
function calcularNota10De(av) {
  const [a, b, c, d] = extrairQuatroCriterios(av);
  const total20 = a + b + c + d;
  const n10 = total20 / 2;
  return Number.isFinite(n10) ? Number(n10.toFixed(1)) : null;
}

/* ───────────────── Badge de status ───────────────── */
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
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          Em avaliação
        </span>
      );
    case "aprovado_exposicao":
      return (
        <span className={`${base} bg-green-100 text-green-700`}>
          Exposição
        </span>
      );
    case "aprovado_oral":
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700`}>
          Apresentação Oral
        </span>
      );
    case "reprovado":
      return (
        <span className={`${base} bg-rose-100 text-rose-700`}>
          Reprovado
        </span>
      );
    default:
      return (
        <span
          className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}
        >
          {status || "—"}
        </span>
      );
  }
}

/* ───────────────── Card de submissão (AGORA É O PADRÃO ÚNICO) ───────────────── */
/*
  - Usado em todas as larguras.
  - Segue nossa identidade visual com a barrinha gradiente.
  - Em telas largas vamos usar grid para ficar 2-3 colunas e aproveitar espaço.
*/
function CardSubmissao({ item, nota, onAbrir }) {
  return (
    <div
      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col"
    >
      {/* Barrinha superior com degradê (verde → teal → âmbar) */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-400" />

      <div className="p-4 flex-1 flex flex-col gap-4">
        {/* Cabeçalho + status */}
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

        {/* Linhas de info rápidas */}
        <div className="flex flex-wrap gap-4 text-[13px] text-zinc-700 dark:text-zinc-300">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Meu status
            </span>
            <span className="font-medium inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              {item.ja_avaliado ? (
                <>
                  <Check className="w-4 h-4" /> enviado
                </>
              ) : (
                "—"
              )}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Minha nota (/10)
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {nota != null ? nota.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        {/* Botão Avaliar */}
        <div className="flex">
          <button
            onClick={onAbrir}
            className="w-full px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium text-center"
            aria-label="Avaliar ou editar esta submissão"
          >
            Avaliar / Editar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Drawer de avaliação ───────────────── */
function DrawerAvaliacao({ open, onClose, submissaoId }) {
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
        const r = await api.get(`/avaliador/submissoes/${submissaoId}`, {
          signal: ac.signal,
        });
        const data = r?.data ?? r;
        setMeta(data.submissao);
        setCriterios(data.criterios || []);
        const m = new Map(
          (data.avaliacaoAtual || []).map((x) => [x.criterio_id, x])
        );
        setItens(
          (data.criterios || []).map((c) => ({
            criterio_id: c.id,
            nota: m.get(c.id)?.nota ?? "",
            comentarios: m.get(c.id)?.comentarios ?? "",
          }))
        );
      } catch (e) {
        if (e?.name !== "AbortError")
          console.error("Falha ao carregar avaliação:", e);
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
          .filter(
            (x) => x.nota !== "" && x.nota !== null && x.nota !== undefined
          )
          .map((x) => ({
            criterio_id: x.criterio_id,
            nota: Number(x.nota),
            comentarios: x.comentarios || null,
          })),
      };
      if (!payload.itens.length)
        return alert("Preencha ao menos uma nota.");
      await api.post(`/avaliador/submissoes/${submissaoId}/avaliar`, payload);
      onClose?.({ saved: true });
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.erro || "Falha ao salvar avaliação.");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        {/* Cabeçalho Drawer */}
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 break-words">
                Avaliação — {fmt(meta?.titulo)}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 break-words">
                {fmt(meta?.chamada_titulo)} · {fmt(meta?.linha_tematica_nome)} ·{" "}
                Início {fmt(meta?.inicio_experiencia)}
              </p>
            </div>
            <div className="shrink-0">
              <StatusBadge status={meta?.status} />
            </div>
          </div>
        </div>

        {/* Corpo Drawer */}
        {loading ? (
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Sessão Conteúdo do trabalho */}
            <section className="space-y-4">
              <h4 className="text-center font-semibold text-zinc-800 dark:text-zinc-100">
                Conteúdo do trabalho
              </h4>
              {[
                ["Introdução", meta?.introducao],
                ["Objetivos", meta?.objetivos],
                ["Método", meta?.metodo],
                ["Resultados", meta?.resultados],
                ["Considerações Finais", meta?.consideracoes],
                ["Bibliografia", meta?.bibliografia],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4"
                >
                  <h5 className="font-semibold mb-1 text-zinc-800 dark:text-zinc-100">
                    {label}
                  </h5>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {value || "—"}
                  </p>
                </div>
              ))}
            </section>

            {/* Sessão Critérios */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">
                Critérios de avaliação
              </h4>
              <div className="mt-3 space-y-4">
                {criterios.map((c, idx) => (
                  <div
                    key={c.id}
                    className="rounded-xl border dark:border-zinc-800 p-3 sm:p-4"
                  >
                    <p className="font-medium text-zinc-800 dark:text-zinc-50 break-words">
                      {c.criterio}
                    </p>
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
                            const v =
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value);
                            setItens((old) => {
                              const arr = [...old];
                              arr[idx] = {
                                ...arr[idx],
                                criterio_id: c.id,
                                nota: v,
                              };
                              return arr;
                            });
                          }}
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="text-xs text-zinc-500 dark:text-zinc-400">
                          Comentários (opcional)
                        </label>
                        <textarea
                          rows={2}
                          className="mt-1 w-full border rounded-md px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                          value={itens[idx]?.comentarios ?? ""}
                          onChange={(e) =>
                            setItens((old) => {
                              const arr = [...old];
                              arr[idx] = {
                                ...arr[idx],
                                criterio_id: c.id,
                                comentarios: e.target.value,
                              };
                              return arr;
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {criterios.length === 0 && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Nenhum critério configurado para esta chamada.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Rodapé Drawer */}
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

/* ───────────────── Página principal ───────────────── */
export default function AvaliadorSubmissoes() {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState("");
  const [debounced, setDebounced] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [notasMap, setNotasMap] = useState({}); // id -> nota (/10)

  // Ministats
  const totalSubmissoes = lista.length;
  const totalPendentes = useMemo(
    () => lista.filter((s) => !s.ja_avaliado).length,
    [lista]
  );
  const totalAvaliadas = totalSubmissoes - totalPendentes;
  const mediaGeral = useMemo(() => {
    const notasValidas = Object.values(notasMap).filter((n) =>
      Number.isFinite(n)
    );
    if (!notasValidas.length) return null;
    const soma = notasValidas.reduce((acc, v) => acc + v, 0);
    const media = soma / notasValidas.length;
    return Number(media.toFixed(1));
  }, [notasMap]);

  // id do usuário logado (mantido pra você usar depois se precisar)
  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  }, []);
  const meuId = usuario?.id;
  void meuId;

  // Carga inicial + pré-busca notas
  useOnceEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const r = await api.get("/avaliador/submissoes", {
          signal: ac.signal,
        });
        const arr = Array.isArray(r?.data) ? r.data : r;
        setLista(arr);

        const ids = (arr || [])
          .filter((s) => s.ja_avaliado)
          .map((s) => s.id);

        const conc = 4;
        let i = 0;

        async function fetchNota(id) {
          try {
            const det = await api.get(`/avaliador/submissoes/${id}`, {
              signal: ac.signal,
            });
            const d = det?.data ?? det;
            const avAtual = Array.isArray(d?.avaliacaoAtual)
              ? d.avaliacaoAtual
              : [];
            let nota = null;
            if (avAtual.length >= 4) {
              const total20 = avAtual
                .map((x) => Number(x?.nota || 0))
                .reduce((a, b) => a + b, 0);
              nota = Number((total20 / 2).toFixed(1));
            }
            if (nota == null && d?.minha_avaliacao)
              nota = calcularNota10De(d.minha_avaliacao);

            if (nota != null) {
              setNotasMap((prev) =>
                prev[id] ? prev : { ...prev, [id]: nota }
              );
            }
          } catch {
            /* silencioso */
          }
        }

        const workers = Array.from({ length: conc }, async () => {
          while (i < ids.length) {
            const id = ids[i++];
            if (notasMap[id] != null) continue;
            await fetchNota(id);
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

  // debounce busca
  useEffect(() => {
    const t = setTimeout(
      () => setDebounced(busca.trim().toLowerCase()),
      200
    );
    return () => clearTimeout(t);
  }, [busca]);

  // filtrar lista
  const filtradas = useMemo(() => {
    if (!debounced) return lista;
    return lista.filter((s) =>
      [s.titulo, s.chamada_titulo, s.linha_tematica_nome, s.status]
        .map((v) => (v ? String(v).toLowerCase() : ""))
        .some((t) => t.includes(debounced))
    );
  }, [lista, debounced]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-emerald-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-950">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-950">
      {/* HeaderHero com degradê verde → teal → âmbar (mistura de verde e laranja como você pediu) */}
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full"
      >
        <div className="bg-gradient-to-br from-emerald-700 via-teal-600 to-amber-500 text-white">
          <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-8 w-8" />
                <h1 className="text-2xl sm:text-3xl font-extrabold">
                  Trabalhos para avaliar
                </h1>
              </div>
              <p className="opacity-90 text-sm sm:text-base max-w-2xl">
                Você só vê informações necessárias à avaliação. Os
                dados do autor ficam ocultos.
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="flex-1 px-4 sm:px-8 py-10 max-w-7xl mx-auto w-full space-y-8">
        {/* ───── Ministats ───── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Total recebidos
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {totalSubmissoes}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Pendentes p/ você
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalPendentes}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Já avaliados
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalAvaliadas}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium">
              Sua média (/10)
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {mediaGeral != null ? mediaGeral.toFixed(1) : "—"}
            </p>
          </div>
        </section>

        {/* ───── Filtro / busca ───── */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-5 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:flex-wrap gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">
              Filtrar
            </h2>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-xl w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, chamada ou linha temática..."
              className="border rounded-md pl-9 pr-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="Buscar submissões"
            />
          </div>
        </section>

        {/* ───── Lista de cards ───── */}
        <section className="rounded-2xl">
          {filtradas.length === 0 ? (
            <p className="text-center py-16 text-zinc-600 dark:text-zinc-400 text-sm bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl">
              Nada encontrado.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtradas.map((s) => {
                const nota = notasMap[s.id];
                return (
                  <CardSubmissao
                    key={s.id}
                    item={s}
                    nota={nota}
                    onAbrir={() => {
                      setFocusId(s.id);
                      setDrawerOpen(true);
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />

      {/* Drawer de avaliação */}
      <AnimatePresence>
        {drawerOpen && (
          <DrawerAvaliacao
            open={drawerOpen}
            submissaoId={focusId}
            onClose={async (ev) => {
              setDrawerOpen(false);

              if (ev?.saved) {
                // atualizar nota individual
                try {
                  const det = await api.get(
                    `/avaliador/submissoes/${focusId}`
                  );
                  const d = det?.data ?? det;
                  const avAtual = Array.isArray(d?.avaliacaoAtual)
                    ? d.avaliacaoAtual
                    : [];

                  if (avAtual.length >= 4) {
                    const total20 = avAtual
                      .map((x) => Number(x?.nota || 0))
                      .reduce((a, b) => a + b, 0);
                    setNotasMap((prev) => ({
                      ...prev,
                      [focusId]: Number(
                        (total20 / 2).toFixed(1)
                      ),
                    }));
                  } else if (d?.minha_avaliacao) {
                    const n = calcularNota10De(d.minha_avaliacao);
                    if (n != null)
                      setNotasMap((prev) => ({
                        ...prev,
                        [focusId]: n,
                      }));
                  }
                } catch (err) {
                  console.error(
                    "Falha ao atualizar nota pós-salvar:",
                    err
                  );
                }

                // atualizar lista para refletir ja_avaliado
                try {
                  const r2 = await api.get("/avaliador/submissoes");
                  setLista(Array.isArray(r2?.data) ? r2.data : r2);
                } catch (err) {
                  console.error(
                    "Falha ao atualizar lista pós-salvar:",
                    err
                  );
                }
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
