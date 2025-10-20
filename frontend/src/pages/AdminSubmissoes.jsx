// 📁 src/pages/AdminSubmissoes.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Filter,
  ClipboardList,
  Award,
  CheckCircle,
  XCircle,
  FileText,
  Search,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import api, { apiGetFile, downloadBlob } from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* ————————————————— Utils ————————————————— */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 2) => Number(v ?? 0).toFixed(d);
const fmtMonthBR = (yyyyMm) => {
  const m = String(yyyyMm || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return fmt(yyyyMm);
  const [y, mo] = m.split("-");
  return `${mo}/${y}`;
};
// chave “estável” da linha temática para filtrar/deduplicar
const linhaKeyFromSub = (s) =>
  String(
    s?.linha_tematica_id ??
      s?.linhaTematicaId ??
      s?.linha_tematica_nome ??
      s?.linha_tematica_codigo ??
      ""
  );

// ——— Download seguro (funciona com/sem interceptor que retorna só data)
async function safeOpenBlobFromApi(getter, fallbackName = "arquivo") {
  try {
    const res = await getter({
      responseType: "blob",
      withCredentials: true,
      transformResponse: [(d) => d],
    });

    let blob,
      headers = {};
    if (res instanceof Blob) {
      blob = res;
    } else if (res && (res.data instanceof Blob || res.data)) {
      headers = res.headers || {};
      blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([res.data], {
              type: headers["content-type"] || "application/octet-stream",
            });
    } else {
      throw new Error("Resposta inesperada do servidor.");
    }

    const cd =
      headers["content-disposition"] || headers["Content-Disposition"] || "";
    const m = String(cd).match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
    const filename = m ? decodeURIComponent(m[1]) : fallbackName;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch (err) {
    const errBlob = err?.response?.data;
    if (errBlob instanceof Blob) {
      try {
        const txt = await errBlob.text();
        try {
          const j = JSON.parse(txt);
          const msg = j?.erro || j?.message || txt;
          throw new Error(msg);
        } catch {
          throw new Error(txt);
        }
      } catch {
        /* segue */
      }
    }
    throw err instanceof Error ? err : new Error(err?.message || "Falha no download.");
  }
}

function StatPill({ label, value, tone = "amber" }) {
  const tones = {
    amber: { text: "text-amber-50", bg: "bg-amber-500/20", border: "border-amber-300/40" },
    green: { text: "text-emerald-50", bg: "bg-emerald-500/20", border: "border-emerald-300/40" },
    blue:  { text: "text-blue-50", bg: "bg-blue-500/20", border: "border-blue-300/40" },
    red:   { text: "text-rose-50", bg: "bg-rose-500/20", border: "border-rose-300/40" },
    slate: { text: "text-slate-50", bg: "bg-slate-500/20", border: "border-slate-300/40" },
  }[tone] || { text: "text-slate-50", bg: "bg-slate-500/20", border: "border-slate-300/40" };

  return (
    <div className={`rounded-2xl border ${tones.border} ${tones.bg} backdrop-blur px-3 py-3 text-left`}>
      <p className="text-xs uppercase tracking-wide text-white/85">{label}</p>
      <p className={`mt-1 font-bold text-lg sm:text-2xl ${tones.text}`}>{value}</p>
    </div>
  );
}

function HeaderHero({ stats }) {
  const { total, aprovadas, emAvaliacao, reprovadas } = stats || {};
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full text-white"
    >
      <div className="bg-gradient-to-br from-amber-700 via-orange-600 to-yellow-600">
        <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
          <div className="flex items-center justify-center gap-3">
            <ClipboardList className="h-9 w-9" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
              Submissão de Trabalhos — Administração
            </h1>
          </div>
          <p className="mt-2 text-center text-sm sm:text-base opacity-90">
            Acompanhe, filtre e audite todos os trabalhos submetidos às chamadas.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total" value={fmt(total, "—")} tone="amber" />
            <StatPill label="Aprovadas" value={fmt(aprovadas, "—")} tone="green" />
            <StatPill label="Em avaliação" value={fmt(emAvaliacao, "—")} tone="blue" />
            <StatPill label="Reprovadas" value={fmt(reprovadas, "—")} tone="red" />
          </div>
        </div>
      </div>
    </motion.header>
  );
}

/* ————————————————— Badge de status ————————————————— */
function StatusBadge({ status }) {
  const base = "px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 justify-center";
  switch (status) {
    case "submetido":
      return <span className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200`}><FileText className="w-3 h-3" /> Submetido</span>;
    case "em_avaliacao":
      return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200`}><ClipboardList className="w-3 h-3" /> Em avaliação</span>;
    case "aprovado_exposicao":
      return <span className={`${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200`}><Award className="w-3 h-3" /> Exposição</span>;
    case "aprovado_oral":
      return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200`}><CheckCircle className="w-3 h-3" /> Oral</span>;
    case "reprovado":
      return <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200`}><XCircle className="w-3 h-3" /> Reprovado</span>;
    default:
      return <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{status || "—"}</span>;
  }
}

/* ————————————————— Drawer/Modal de detalhes ————————————————— */
function DetalhesSubmissao({ open, onClose, s }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);
  const dialogRef = useRef(null);
  const lastFocusRef = useRef(null);

  // novos estados: avaliadores
  const [avaliadoresElegiveis, setAvaliadoresElegiveis] = useState([]);
  const [avaliador1, setAvaliador1] = useState("");
  const [avaliador2, setAvaliador2] = useState("");
  const [savingAtrib, setSavingAtrib] = useState(false);
  const [carregandoAvaliadores, setCarregandoAvaliadores] = useState(false);
  const [atribuicoesAtuais, setAtribuicoesAtuais] = useState([]);

  // ➕ derivado: progresso das atribuições
  const qtdAtribuidos = (atribuicoesAtuais?.length || 0);
  const faltam = Math.max(0, 2 - qtdAtribuidos);

  // ➕ helper: montar payload com 1 ou 2 ids (sem duplicar)
  function buildAvaliadoresPayload(a1, a2) {
    const ids = [a1, a2].map(String).filter(Boolean);
    const uniq = Array.from(new Set(ids));
    return uniq.map(Number);
  }

  // notas dos avaliadores
  const [avaliacoes, setAvaliacoes] = useState([]); // normalizadas
  const [notaVisivel, setNotaVisivel] = useState(false);
  const [totalGeral, setTotalGeral] = useState(0); // 0–40
  const [notaDivididaPor4, setNotaDivididaPor4] = useState(0); // 0–10

  useEffect(() => {
    if (!open) return;
    lastFocusRef.current = document.activeElement;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    setTimeout(() => dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.(), 0);
    return () => { document.removeEventListener("keydown", onKey); lastFocusRef.current?.focus?.(); };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !s?.id) return;
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const r = await api.get(`/submissoes/${s.id}`, { signal: ac.signal });
        const sub = Array.isArray(r) ? r[0] : (r?.data ?? r);
        setFull(sub || {});

        try {
          const nr = await api.get(`/admin/submissoes/${s.id}/avaliacoes`, { signal: ac.signal });
          const payload = nr?.data || {};
          const itens = Array.isArray(payload.itens) ? payload.itens : [];
          const normalizados = itens.map((it) => {
            const nome = it.avaliador_nome ?? it.nome ?? `#${it.avaliador_id ?? ""}`;
            const notas = Array.isArray(it.notas)
              ? it.notas
              : [it.criterio1, it.criterio2, it.criterio3, it.criterio4].map((n) => Number(n || 0));
            const total = Number.isFinite(it.total_do_avaliador)
              ? it.total_do_avaliador
              : notas.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
            return { nome, notas, total };
          });

          setAvaliacoes(normalizados);
          setNotaVisivel(!!payload.nota_visivel);
          setTotalGeral(Number(payload.total_geral || 0));
          setNotaDivididaPor4(Number(payload.nota_dividida_por_4 || 0));
          if (payload?.linha_tematica_nome) {
            setFull((prev) => ({ ...(prev || {}), linha_tematica_nome: payload.linha_tematica_nome }));
          }
        } catch {
          /* silencioso, payload antigo/sem notas */
        }
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error("[Admin] Falha ao obter detalhes da submissão:", e);
          setFull({});
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, s?.id]);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    (async () => {
      try {
        setCarregandoAvaliadores(true);
        const r = await api.get("/usuarios/avaliadores?roles=instrutor,administrador", { signal: ac.signal });
        const arr = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
        setAvaliadoresElegiveis(arr);

        try {
          const ar = await api.get(`/admin/submissoes/${s.id}/avaliadores`, { signal: ac.signal });
          const list = Array.isArray(ar?.data) ? ar.data : (Array.isArray(ar) ? ar : []);
          setAtribuicoesAtuais(list);
          if (list.length >= 2) {
            setAvaliador1(String(list[0].id || list[0].avaliador_id || ""));
            setAvaliador2(String(list[1].id || list[1].avaliador_id || ""));
          }
        } catch {}
      } catch (e) {
        if (e?.name !== "AbortError") console.error("Falha ao listar avaliadores:", e);
      } finally {
        setCarregandoAvaliadores(false);
      }
    })();
    return () => ac.abort();
  }, [open, s?.id]);

  if (!open || !s) return null;

  const data = { ...s, ...(full || {}) };
  const titulo = data.titulo;
  const inicioExp = data.inicio_experiencia || data.inicioExperiencia;
  const linhaTemNome =
    data.linha_tematica_nome ||
    data.linhaTematicaNome ||
    data.linha_tematica_nome_normalizado ||
    null;

  const introducao = data.introducao;
  const objetivos = data.objetivos;
  const metodo = data.metodo;
  const resultados = data.resultados;
  const consideracoes = data.consideracoes;
  const bibliografia = data.bibliografia;
  const coautores = Array.isArray(data.coautores) ? data.coautores : [];
  const posterNome = data.poster_nome || data.posterNome || "";
  const bannerNome = data.banner_nome || data.bannerNome || "";
  const historico = Array.isArray(data.historico_status || data.historicoStatus)
    ? (data.historico_status || data.historicoStatus)
    : [];

  const handleBaixarPoster = async () => {
    if (!data?.id) return;
    try {
      const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/poster`);
      downloadBlob(filename || posterNome || `poster_${data.id}.pptx`, blob);
    } catch (e) {
      console.error("Falha ao baixar pôster:", e);
      alert("Não foi possível baixar o pôster.");
    }
  };

  const handleBaixarBanner = async () => {
    if (!data?.id) return;
    try {
      const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/banner`);
      downloadBlob(filename || bannerNome || `banner_${data.id}`, blob);
    } catch (e) {
      if (e?.status === 404) {
        console.warn("Banner não disponível para esta submissão.");
        return;
      }
      console.error("Falha ao baixar banner:", e);
      alert("Não foi possível baixar o banner.");
    }
  };

  const totalObtido = useMemo(() => {
    if (totalGeral > 0) return totalGeral;
    return (avaliacoes || []).reduce((acc, a) => acc + (Number(a.total || 0)), 0);
  }, [avaliacoes, totalGeral]);

  const mediaFinal = useMemo(() => {
    if (notaDivididaPor4 > 0) return notaDivididaPor4.toFixed(1);
    return (totalObtido / 4).toFixed(1);
  }, [notaDivididaPor4, totalObtido]);

  const toggleVisibilidadeNota = async () => {
    try {
      // regra: só permite liberar para o autor quando houver 2 avaliadores atribuídos
      if (!notaVisivel && qtdAtribuidos < 2) {
        alert("Para liberar a nota ao autor, é necessário ter 2 avaliadores atribuídos.");
        return;
      }
      const novo = !notaVisivel;
      await api.post(`/admin/submissoes/${data.id}/nota-visivel`, { visivel: novo });
      setNotaVisivel(novo);
    } catch (e) {
      console.error(e);
      alert("Não foi possível alterar a visibilidade da nota.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="detalhe-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <h3 id="detalhe-title" className="text-lg sm:text-xl font-bold text-lousa dark:text-white">{fmt(titulo)}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">ID #{fmt(data.id)} · {fmt(data.chamada_titulo || data.chamada)}</p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes…
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            <section className="grid sm:grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Status</p>
                <div className="mt-1"><StatusBadge status={data.status} /></div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Nota (média)</p>
                <p className="text-lg font-semibold">{fmtNum(mediaFinal, 1)} / 10</p>
                {avaliacoes?.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Soma dos avaliadores: {totalObtido} / 40 (2 avaliadores × 4 critérios)
                  </p>
                )}
              </div>
            </section>

            <section className="grid sm:grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Início da experiência</h5>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{fmtMonthBR(inicioExp)}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Linha temática</h5>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{fmt(linhaTemNome)}</p>
              </div>
            </section>

            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Coautores</h4>
              {coautores.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {coautores.map((c, i) => (
                    <li key={i} className="text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3">
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">{fmt(c.nome)}</p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        CPF: {fmt(c.cpf)} · {fmt(c.vinculo)}
                        {fmt(c.email, "") && (
                          <> · <a className="underline decoration-dotted" href={`mailto:${c.email}`}>{c.email}</a></>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {[
              ["Introdução", data.introducao],
              ["Objetivos", data.objetivos],
              ["Método", data.metodo],
              ["Resultados", data.resultados],
              ["Considerações finais", data.consideracoes],
              ["Bibliografia", data.bibliografia],
            ].map(([label, value]) => (
              <section key={label}>
                <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">{label}</h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">{fmt(value)}</p>
              </section>
            ))}

            {/* Arquivos */}
            <section className="grid sm:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Pôster (PPT/PPTX)</h4>
                {posterNome ? (
                  <p className="text-sm mt-1">
                    Arquivo: <strong>{posterNome}</strong>
                    <button
                      type="button"
                      onClick={handleBaixarPoster}
                      className="ml-3 inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                    >
                      <Upload className="h-4 w-4" /> baixar
                    </button>
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
                )}
              </div>
            </section>

            {/* Notas dos avaliadores */}
            {avaliacoes?.length > 0 && (
              <section className="bg-amber-50/40 dark:bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Notas dos avaliadores</h4>
                  <button
                    onClick={toggleVisibilidadeNota}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-700 text-white hover:bg-amber-800"
                  >
                    {notaVisivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {notaVisivel ? "Ocultar do autor" : "Liberar ao autor"}
                  </button>
                </div>

                <div className="overflow-x-auto mt-3">
                  <table className="min-w-full text-sm text-center border border-zinc-200 dark:border-zinc-700">
                    <thead className="bg-amber-100 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100">
                      <tr>
                        <th className="p-2">Avaliador</th>
                        <th className="p-2">Critério 1</th>
                        <th className="p-2">Critério 2</th>
                        <th className="p-2">Critério 3</th>
                        <th className="p-2">Critério 4</th>
                        <th className="p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avaliacoes.map((a, i) => {
                        const n = Array.isArray(a.notas) ? a.notas : [];
                        const [c1 = 0, c2 = 0, c3 = 0, c4 = 0] = n;
                        const tot = Number.isFinite(a.total) ? a.total : c1 + c2 + c3 + c4;
                        return (
                          <tr key={i} className="border-t dark:border-zinc-700">
                            <td className="p-2 font-medium">{a.nome}</td>
                            <td className="p-2">{c1}</td>
                            <td className="p-2">{c2}</td>
                            <td className="p-2">{c3}</td>
                            <td className="p-2">{c4}</td>
                            <td className="p-2 font-semibold">{tot}</td>
                          </tr>
                        );
                      })}
                      <tr className="font-bold bg-amber-100/40 dark:bg-zinc-700/40">
                        <td colSpan={5} className="p-2 text-right">Total Geral</td>
                        <td className="p-2">{totalObtido} / 40</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
                  A média final exibida acima é o total dividido por 4 (4 critérios × 2 avaliadores → máximo 40 ÷ 4 = 10).
                </p>
              </section>
            )}

            {/* Encaminhar (1 ou 2 avaliadores, completar depois) */}
            <section className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100 text-center">Encaminhar para avaliação</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 text-center">
                Você pode encaminhar com <strong>apenas 1 avaliador agora</strong> e adicionar o segundo depois.
                O sistema exige <strong>2 avaliadores ao final</strong> para a média oficial.
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  Atribuições: {qtdAtribuidos}/2
                </span>
                {faltam > 0 ? (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" aria-live="polite">
                    Faltam {faltam}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                    Pronto para média final
                  </span>
                )}
              </div>

              {atribuicoesAtuais?.length > 0 && (
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 text-center">
                  Já atribuídos:&nbsp;
                  {atribuicoesAtuais.map((u, i) => (
                    <span key={i} className="inline-block mr-2">
                      {u.nome || u.avaliador_nome || `#${u.id || u.avaliador_id}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Avaliador 1</span>
                  <select
                    value={avaliador1}
                    onChange={(e) => setAvaliador1(e.target.value)}
                    disabled={carregandoAvaliadores}
                    className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
                    aria-label="Selecionar primeiro avaliador"
                  >
                    <option value="">{carregandoAvaliadores ? "Carregando..." : "Selecione…"}</option>
                    {avaliadoresElegiveis.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} — {u.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="block mb-1 text-zinc-600 dark:text-zinc-300">Avaliador 2 (opcional agora)</span>
                  <select
                    value={avaliador2}
                    onChange={(e) => setAvaliador2(e.target.value)}
                    disabled={carregandoAvaliadores}
                    className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
                    aria-label="Selecionar segundo avaliador"
                  >
                    <option value="">{carregandoAvaliadores ? "Carregando..." : "Selecione…"}</option>
                    {avaliadoresElegiveis.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome} — {u.email}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={savingAtrib}
                  onClick={async () => {
                    if (!data?.id) return;

                    const payload = buildAvaliadoresPayload(avaliador1, avaliador2);
                    if (payload.length === 0) {
                      alert("Selecione pelo menos 1 avaliador.");
                      return;
                    }
                    if (payload.length === 2 && String(payload[0]) === String(payload[1])) {
                      alert("Os avaliadores devem ser distintos.");
                      return;
                    }

                    try {
                      setSavingAtrib(true);
                      await api.post(`/admin/submissoes/${data.id}/avaliadores`, { avaliadores: payload });

                      // Atualiza “já atribuídos” mesclando, sem duplicar
                      const novos = payload.map((id) => {
                        const found = avaliadoresElegiveis.find((u) => String(u.id) === String(id));
                        return found || { id, nome: `#${id}` };
                      });
                      setAtribuicoesAtuais((prev) => {
                        const map = new Map((prev || []).map((p) => [String(p.id || p.avaliador_id), p]));
                        for (const n of novos) map.set(String(n.id || n.avaliador_id), n);
                        return Array.from(map.values());
                      });

                      // limpa selects
                      setAvaliador1("");
                      setAvaliador2("");

                      alert(
                        payload.length === 2
                          ? "Encaminhado com sucesso para 2 avaliadores."
                          : "Encaminhado com sucesso. Você pode atribuir o segundo avaliador depois."
                      );
                    } catch (e) {
                      console.error("Falha ao encaminhar:", e);
                      alert("Não foi possível salvar as atribuições.");
                    } finally {
                      setSavingAtrib(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                >
                  {savingAtrib ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Encaminhar (1 ou 2 avaliadores)
                </button>

                <span
                  className={`text-xs px-3 py-1.5 rounded-full ${faltam > 0 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"}`}
                  role="status"
                  aria-live="polite"
                >
                  {faltam > 0 ? `Ainda faltam ${faltam} avaliador(es) para fechar a média.` : "Dois avaliadores atribuídos — pronto para consolidar nota oficial."}
                </span>
              </div>
            </section>

            {/* Histórico */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">Histórico de status</h4>
              {historico.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {historico.map((h, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-zinc-600 dark:text-zinc-400">{fmt(h.quem || h.usuario, "—")}</span>
                      <span className="text-zinc-500 text-xs">{fmt(h.em || h.data, "—")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <div className="p-4 sm:p-5 border-t dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            data-autofocus
            className="px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ————————————————— Página principal ————————————————— */
export default function AdminSubmissoes() {
  const [submissoes, setSubmissoes] = useState([]);
  const [filtroChamada, setFiltroChamada] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [chamadas, setChamadas] = useState([]);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);

  const unwrap = (r) => (Array.isArray(r) ? r : r?.data ?? []);

  useOnceEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const [subs, ch] = await Promise.all([
          api.get("/admin/submissoes", { signal: ac.signal }),
          api.get("/chamadas/ativas", { signal: ac.signal }),
        ]);
        setSubmissoes(unwrap(subs));
        setChamadas(unwrap(ch));
      } catch (err) {
        if (err?.name !== "AbortError") console.error("Erro ao carregar:", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusca(busca), 200);
    return () => clearTimeout(t);
  }, [busca]);

  // Opções de Linha Temática (únicas, ordenadas)
  const linhasTematicas = useMemo(() => {
    const map = new Map();
    for (const s of submissoes) {
      const key = linhaKeyFromSub(s);
      const nome = s?.linha_tematica_nome ?? s?.linhaTematicaNome ?? null;
      const codigo = s?.linha_tematica_codigo ?? s?.linhaTematicaCodigo ?? null;
      if (!key || !nome) continue;
      if (!map.has(key))
        map.set(key, { id: key, nome: String(nome), codigo: codigo ? String(codigo) : null });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
  }, [submissoes]);

  const filtradas = useMemo(() => {
    const termo = debouncedBusca.trim().toLowerCase();
    return submissoes.filter((s) => {
      const matchChamada = !filtroChamada || Number(s.chamada_id) === Number(filtroChamada);
      const matchStatus = !filtroStatus || s.status === filtroStatus;
      const matchLinha = !filtroLinha || linhaKeyFromSub(s) === String(filtroLinha);
      const matchBusca =
        !termo ||
        [
          s.titulo,
          s.autor_nome,
          s.autor_email,
          s.chamada_titulo,
          s.area_tematica,
          s.eixo,
          s.linha_tematica_nome,
          s.linha_tematica_codigo,
        ]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .some((t) => t.includes(termo));
      return matchChamada && matchStatus && matchLinha && matchBusca;
    });
  }, [submissoes, filtroChamada, filtroStatus, filtroLinha, debouncedBusca]);

  // Cards do topo
  const stats = useMemo(() => {
    const total = submissoes.length;
    const aprovadas = submissoes.filter((s) =>
      ["aprovado_oral", "aprovado_exposicao"].includes(s.status)
    ).length;
    const reprovadas = submissoes.filter((s) => s.status === "reprovado").length;
    const emAvaliacao = submissoes.filter((s) => s.status === "em_avaliacao").length;
    return { total, aprovadas, reprovadas, emAvaliacao };
  }, [submissoes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 to-yellow-100">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-950">
      <HeaderHero stats={stats} />

      <main className="flex-1 px-4 sm:px-8 py-10 max-w-7xl mx-auto w-full space-y-10">
        {/* Filtros */}
        <section
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-5 flex flex-wrap gap-4 items-center border dark:border-zinc-800"
          aria-label="Filtros"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-600" aria-hidden="true" />
            <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Filtros</h2>
          </div>

          <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Chamada */}
            <label className="sr-only" htmlFor="filtro-chamada">Filtrar por chamada</label>
            <select
              id="filtro-chamada"
              value={filtroChamada}
              onChange={(e) => setFiltroChamada(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por chamada"
            >
              <option value="">Todas as chamadas</option>
              {chamadas.map((c) => (
                <option key={c.id} value={c.id}>{c.titulo}</option>
              ))}
            </select>

            {/* Status */}
            <label className="sr-only" htmlFor="filtro-status">Filtrar por status</label>
            <select
              id="filtro-status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="submetido">Submetido</option>
              <option value="em_avaliacao">Em avaliação</option>
              <option value="aprovado_exposicao">Aprovado (Exposição)</option>
              <option value="aprovado_oral">Aprovado (Oral)</option>
              <option value="reprovado">Reprovado</option>
            </select>

            {/* Linha temática */}
            <label className="sr-only" htmlFor="filtro-linha">Filtrar por linha temática</label>
            <select
              id="filtro-linha"
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
              aria-label="Filtrar por linha temática"
            >
              <option value="">Todas as linhas</option>
              {linhasTematicas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}{l.codigo ? ` — ${l.codigo}` : ""}
                </option>
              ))}
            </select>

            {/* Busca */}
            <div className="relative">
              <label className="sr-only" htmlFor="busca">Buscar</label>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                id="busca"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="border rounded-md pl-9 pr-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
                placeholder="Buscar por título, autor, linha, eixo…"
                aria-label="Buscar"
              />
            </div>
          </div>
        </section>

        {/* Tabela (desktop) */}
        <section className="hidden md:block overflow-x-auto bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800" aria-label="Tabela de submissões">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Lista de submissões filtradas</caption>
            <thead className="bg-amber-600 text-white">
              <tr>
                <th scope="col" className="p-3 text-left">Título</th>
                <th scope="col" className="p-3 text-left">Autor</th>
                <th scope="col" className="p-3 text-left">Chamada</th>
                <th scope="col" className="p-3 text-left">Área / Eixo</th>
                <th scope="col" className="p-3 text-center">Status</th>
                <th scope="col" className="p-3 text-center">Nota (média)</th>
                <th scope="col" className="p-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-zinc-600">Nenhuma submissão encontrada.</td>
                </tr>
              )}

              {filtradas.map((s) => (
                <tr key={s.id} className="border-b dark:border-zinc-800 hover:bg-amber-50/60 dark:hover:bg-zinc-800/40 transition">
                  <td className="p-3 max-w-[28ch] truncate" title={s.titulo}>{s.titulo}</td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">{s.autor_nome}</span>
                      <span className="text-xs text-zinc-500">{s.autor_email}</span>
                    </div>
                  </td>
                  <td className="p-3 text-zinc-700 dark:text-zinc-300">{s.chamada_titulo}</td>
                  <td className="p-3 text-zinc-700 dark:text-zinc-300">
                    <span className="block">{fmt(s.area_tematica || s.area)}</span>
                    <span className="block text-xs text-zinc-500">{fmt(s.eixo)}</span>
                  </td>
                  <td className="p-3 text-center"><StatusBadge status={s.status} /></td>
                  <td className="p-3 text-center font-semibold text-zinc-800 dark:text-zinc-100">
                    {fmt(s.nota_media, "—")}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => { setSelecionada(s); setDetalheOpen(true); }}
                      className="px-3 py-1.5 rounded-full bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                      aria-label={`Abrir detalhes de ${s.titulo}`}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Cards (mobile) */}
        <section className="md:hidden grid grid-cols-1 gap-3" aria-label="Cards de submissões">
          {filtradas.length === 0 && (
            <div className="text-center py-6 text-zinc-600 bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800">
              Nenhuma submissão encontrada.
            </div>
          )}
          {filtradas.map((s) => (
            <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">{s.titulo}</p>
                  <p className="text-xs text-zinc-500">{s.chamada_titulo}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">{s.autor_nome}</span>
                <span className="text-zinc-500"> · {s.autor_email}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {fmt(s.area_tematica || s.area)} · {fmt(s.eixo)}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold">Nota: {fmt(s.nota_media, "—")}</span>
                <button
                  onClick={() => { setSelecionada(s); setDetalheOpen(true); }}
                  className="px-3 py-1.5 rounded-full bg-amber-700 text-white"
                  aria-label={`Abrir detalhes de ${s.titulo}`}
                >
                  Ver
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      <Footer />

      <AnimatePresence>
        {detalheOpen && (
          <DetalhesSubmissao open={detalheOpen} onClose={() => setDetalheOpen(false)} s={selecionada} />
        )}
      </AnimatePresence>
    </div>
  );
}
