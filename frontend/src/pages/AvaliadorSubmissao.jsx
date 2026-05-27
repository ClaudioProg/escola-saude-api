// 📁 src/pages/AvaliadorSubmissao.jsx
// Atualizado em: 27/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página do AVALIADOR de submissões de trabalhos.
//
// Contratos oficiais usados:
// - GET  /api/submissao/avaliador/atribuida
// - GET  /api/submissao/avaliador/pendente
// - GET  /api/submissao/avaliador/contagem
// - GET  /api/submissao/:id
// - GET  /api/submissao/:id/avaliacao
// - GET  /api/chamada/:id
// - POST /api/submissao/:id/avaliacao-escrita
// - POST /api/submissao/:id/avaliacao-oral
//
// Diretrizes v2.0:
// - sem rotas antigas /avaliador/submissao;
// - sem serviço fallback;
// - sem useOnceEffect;
// - sem status legado "submetido";
// - sem expor autor ao avaliador;
// - UI premium real;
// - acessibilidade;
// - mobile-first;
// - avaliação escrita/oral por contrato oficial.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  Info,
  Layers3,
  Loader2,
  Mic,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrapData(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data ?? fallback;
  }

  if (response?.data && typeof response.data === "object" && "ok" in response.data && "data" in response.data) {
    return response.data.data ?? fallback;
  }

  return response?.data ?? response ?? fallback;
}

function unwrapArray(response) {
  const data = unwrapData(response, []);
  return Array.isArray(data) ? data : [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function fmt(value, fallback = "—") {
  return value === 0 || value ? String(value) : fallback;
}

function fmtNota(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

function getSubmissaoId(item) {
  const raw =
    item?.id ??
    item?.submissao_id ??
    item?.submissaoId ??
    item?.trabalho_id ??
    item?.trabalhoId ??
    null;

  const number = Number(raw);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizarSubmissaoAvaliador(item = {}) {
  const id = getSubmissaoId(item);

  if (!id) return null;

  return {
    ...item,
    id,
    tipo: String(item?.tipo || "escrita").toLowerCase(),
    avaliada: Boolean(item?.avaliada),
  };
}

function normalizarStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value === "rascunho") return "rascunho";
  if (value === "submetida") return "submetida";
  if (value === "em_avaliacao") return "em_avaliacao";
  if (value === "aprovada_exposicao") return "aprovada_exposicao";
  if (value === "aprovada_oral") return "aprovada_oral";
  if (value === "aprovada") return "aprovada";
  if (value === "reprovada") return "reprovada";
  if (value === "cancelada") return "cancelada";

  return value || "indefinido";
}

function statusLabel(status) {
  const value = normalizarStatus(status);

  const labels = {
    rascunho: "Rascunho",
    submetida: "Submetida",
    em_avaliacao: "Em avaliação",
    aprovada_exposicao: "Aprovada para exposição",
    aprovada_oral: "Aprovada para oral",
    aprovada: "Aprovada",
    reprovada: "Reprovada",
    cancelada: "Cancelada",
    indefinido: "Indefinido",
  };

  return labels[value] || value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function nota10Normalizada({ itens = [], criterios = [] }) {
  if (!Array.isArray(itens) || !Array.isArray(criterios) || criterios.length === 0) {
    return null;
  }

  const criterioMap = new Map(criterios.map((criterio) => [Number(criterio.id), criterio]));

  let numerador = 0;
  let denominador = 0;

  for (const item of itens) {
    const criterio = criterioMap.get(Number(item.criterio_id));
    if (!criterio) continue;

    const min = Number(criterio.escala_min ?? 0);
    const max = Number(criterio.escala_max ?? 10);
    const peso = Number.isFinite(Number(criterio.peso)) ? Number(criterio.peso) : 1;
    const nota = Number(item.nota);

    if (!Number.isFinite(nota) || max <= min || peso <= 0) continue;

    const score01 = clamp01((nota - min) / (max - min));

    numerador += peso * score01;
    denominador += peso;
  }

  if (denominador <= 0) return null;

  return Number((10 * (numerador / denominador)).toFixed(1));
}

function csvCell(value) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/;/g, ",").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function baixarArquivo(nome, conteudo, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = nome;
  a.rel = "noopener";

  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportarCSV({ escopo, itens, notasMap }) {
  const linhas = [
    [
      "Título",
      "Chamada",
      "Linha temática",
      "Tipo",
      "Status",
      "Avaliada",
      "Nota escrita (/10)",
      "Nota oral (/10)",
    ].join(";"),
  ];

  for (const item of itens) {
    const tipo = String(item.tipo || "escrita").toLowerCase();
    const notaEscrita = notasMap[`${item.id}-escrita`];
    const notaOral = notasMap[`${item.id}-oral`];

    linhas.push(
      [
        csvCell(item.titulo),
        csvCell(item.chamada_titulo),
        csvCell(item.linha_tematica_nome),
        csvCell(tipo),
        csvCell(statusLabel(item.status)),
        csvCell(item.avaliada ? "Sim" : "Não"),
        csvCell(Number.isFinite(notaEscrita) ? notaEscrita.toFixed(1) : ""),
        csvCell(Number.isFinite(notaOral) ? notaOral.toFixed(1) : ""),
      ].join(";")
    );
  }

  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/\D/g, "");

  baixarArquivo(
    `avaliacoes_${escopo}_${stamp}.csv`,
    `\uFEFF${linhas.join("\r\n")}`,
    "text/csv;charset=utf-8"
  );
}

/* =========================================================================
   API
=========================================================================== */

async function listarAtribuidas() {
  return unwrapArray(await api.get("/submissao/avaliador/atribuida"))
    .map(normalizarSubmissaoAvaliador)
    .filter(Boolean);
}

async function listarPendentesApi() {
  return unwrapArray(await api.get("/submissao/avaliador/pendente"))
    .map((item) => normalizarSubmissaoAvaliador({ ...item, avaliada: false }))
    .filter(Boolean);
}

async function obterContagem() {
  const data = unwrapData(await api.get("/submissao/avaliador/contagem"), null);

  return {
    total: Number(data?.total || 0),
    pendentes: Number(data?.pendentes || 0),
    finalizadas: Number(data?.finalizadas || 0),
  };
}

async function obterSubmissao(id) {
  const safeId = Number(id);

  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("ID da submissão é obrigatório para carregar detalhes.");
  }

  return unwrapData(await api.get(`/submissao/${safeId}`), null);
}

async function obterAvaliacaoSubmissao(id) {
  const safeId = Number(id);

  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("ID da submissão é obrigatório para carregar avaliação.");
  }

  return unwrapData(await api.get(`/submissao/${safeId}/avaliacao`), null);
}

async function obterChamada(id) {
  const safeId = Number(id);

  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("ID da chamada é obrigatório para carregar critérios.");
  }

  return unwrapData(await api.get(`/chamada/${safeId}`), null);
}

async function salvarAvaliacao({ id, tipo, itens }) {
  const safeId = Number(id);

  if (!Number.isInteger(safeId) || safeId <= 0) {
    throw new Error("ID da submissão é obrigatório para salvar avaliação.");
  }

  const endpoint =
    tipo === "oral"
      ? `/submissao/${safeId}/avaliacao-oral`
      : `/submissao/${safeId}/avaliacao-escrita`;

  return unwrapData(
    await api.post(endpoint, {
      status_resultado: "em_avaliacao",
      itens,
    }),
    null
  );
}

/* =========================================================================
   UI primitives
=========================================================================== */

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950 dark:bg-slate-950">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute right-[-12%] top-24 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
      </div>

      <div className="min-h-screen bg-slate-50/95 dark:bg-slate-950/85 dark:text-slate-50">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  icon: Icon,
  tone = "slate",
  size = "md",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    success:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    warning:
      "bg-amber-600 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    teal:
      "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const value = normalizarStatus(status);

  const config = {
    rascunho: { label: "Rascunho", tone: "slate", icon: FileText },
    submetida: { label: "Submetida", tone: "blue", icon: ClipboardList },
    em_avaliacao: { label: "Em avaliação", tone: "amber", icon: Loader2 },
    aprovada_exposicao: { label: "Exposição", tone: "emerald", icon: CheckCircle2 },
    aprovada_oral: { label: "Oral", tone: "teal", icon: Mic },
    aprovada: { label: "Aprovada", tone: "emerald", icon: CheckCircle2 },
    reprovada: { label: "Reprovada", tone: "rose", icon: AlertCircle },
    cancelada: { label: "Cancelada", tone: "rose", icon: X },
    indefinido: { label: "Indefinido", tone: "slate", icon: AlertCircle },
  };

  const item = config[value] || config.indefinido;

  return (
    <Badge tone={item.tone} icon={item.icon}>
      {item.label}
    </Badge>
  );
}

/* =========================================================================
   Métricas da página
=========================================================================== */

function MetricCard({ label, value, icon: Icon, tone = "emerald", description = "" }) {
  const tones = {
    emerald:
      "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900",
    amber:
      "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900",
    teal:
      "bg-teal-50 text-teal-900 ring-teal-100 dark:bg-teal-950/40 dark:text-teal-100 dark:ring-teal-900",
    blue:
      "bg-blue-50 text-blue-900 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-100 dark:ring-blue-900",
  };

  return (
    <div className={cx("rounded-[1.5rem] p-4 shadow-sm ring-1", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-75">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{fmt(value)}</p>
          {description ? <p className="mt-1 text-xs opacity-75">{description}</p> : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Listagens
=========================================================================== */

function SubmissaoCard({ item, notasMap, onAbrir }) {
  const tipo = String(item.tipo || "escrita").toLowerCase();
  const notaEscrita = notasMap[`${item.id}-escrita`];
  const notaOral = notasMap[`${item.id}-oral`];

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/20"
    >
      <div
        className={cx(
          "h-1.5 bg-gradient-to-r",
          item.avaliada
            ? "from-emerald-500 via-teal-400 to-cyan-400"
            : "from-amber-500 via-orange-400 to-emerald-400"
        )}
      />

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-2">
              <StatusBadge status={item.status} />
              <Badge tone={tipo === "oral" ? "teal" : "emerald"} icon={tipo === "oral" ? Mic : FileText}>
                {tipo === "oral" ? "Avaliação oral" : "Avaliação escrita"}
              </Badge>
              {item.avaliada ? (
                <Badge tone="emerald" icon={CheckCircle2}>Finalizada</Badge>
              ) : (
                <Badge tone="amber" icon={Loader2}>Pendente</Badge>
              )}
            </div>

            <h3 className="line-clamp-3 text-lg font-black text-slate-900 dark:text-white">
              {item.titulo || "—"}
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {fmt(item.chamada_titulo)} · {fmt(item.linha_tematica_nome)}
            </p>
          </div>

          <Button
            tone={item.avaliada ? "slate" : "primary"}
            icon={Eye}
            onClick={() => onAbrir(item.id, tipo)}
          >
            {item.avaliada ? "Revisar" : "Avaliar"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NotaBox label="Escrita /10" value={fmtNota(notaEscrita)} />
          <NotaBox label="Oral /10" value={fmtNota(notaOral)} />
        </div>
      </div>
    </motion.article>
  );
}

function NotaBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function SubmissaoLista({ title, items, notasMap, onAbrir, emptyText }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
      </div>

      <div className="p-4">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
            {emptyText}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <SubmissaoCard
                key={`${item.id}-${item.tipo || "escrita"}`}
                item={item}
                notasMap={notasMap}
                onAbrir={onAbrir}
              />
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* =========================================================================
   Drawer de avaliação
=========================================================================== */

function DrawerAvaliacao({ open, onClose, submissaoId, tipo }) {
  const closeButtonRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [erro, setErro] = useState("");
  const [submissao, setSubmissao] = useState(null);
  const [criterios, setCriterios] = useState([]);
  const [itens, setItens] = useState([]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => closeButtonRef.current?.focus?.(), 0);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !submissaoId) return undefined;

    const controller = new AbortController();

    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        const detalhe = await obterSubmissao(submissaoId);
        const avaliacao = await obterAvaliacaoSubmissao(submissaoId);
        const chamadaId = detalhe?.chamada_id || avaliacao?.chamada_id;

        const chamadaDetalhe = chamadaId ? await obterChamada(chamadaId) : null;

        const listaCriterios =
          tipo === "oral"
            ? chamadaDetalhe?.criterios_orais || []
            : chamadaDetalhe?.criterios || [];

        const itensAtuais = Array.isArray(avaliacao?.itens)
          ? avaliacao.itens.filter((item) =>
              listaCriterios.some((criterio) => Number(criterio.id) === Number(item.criterio_id))
            )
          : [];

        const itemMap = new Map(
          itensAtuais.map((item) => [Number(item.criterio_id), item])
        );

        setSubmissao(detalhe);
        setCriterios(listaCriterios);

        setItens(
          listaCriterios.map((criterio) => ({
            criterio_id: criterio.id,
            nota: itemMap.get(Number(criterio.id))?.nota ?? "",
            comentarios: itemMap.get(Number(criterio.id))?.comentarios ?? "",
          }))
        );
      } catch (error) {
        if (error?.name !== "AbortError") {
          setErro(
            getErrorMessage(
              error,
              "Não foi possível carregar a avaliação. Verifique se você está vinculado a esta submissão."
            )
          );
        }
      } finally {
        setLoading(false);
      }
    }

    carregar();

    return () => controller.abort();
  }, [open, submissaoId, tipo]);

  const notaPreview = useMemo(
    () => nota10Normalizada({ itens: itens.filter((item) => item.nota !== ""), criterios }),
    [itens, criterios]
  );

  function atualizarItem(index, patch) {
    setItens((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function salvar() {
    setErro("");

    const payloadItens = itens
      .filter((item) => item.nota !== "" && item.nota != null)
      .map((item) => ({
        criterio_id: Number(item.criterio_id),
        nota: Number(item.nota),
        comentarios: item.comentarios?.trim() || null,
      }));

    if (payloadItens.length === 0) {
      setErro("Preencha ao menos uma nota antes de salvar a avaliação.");
      return;
    }

    for (const item of payloadItens) {
      const criterio = criterios.find((c) => Number(c.id) === Number(item.criterio_id));
      if (!criterio) continue;

      const min = Number(criterio.escala_min ?? 0);
      const max = Number(criterio.escala_max ?? 10);

      if (item.nota < min || item.nota > max) {
        setErro(`A nota do critério "${criterio.titulo}" deve estar entre ${min} e ${max}.`);
        return;
      }
    }

    setSaving(true);

    try {
      await salvarAvaliacao({
        id: submissaoId,
        tipo,
        itens: payloadItens,
      });

      onClose?.({ saved: true, tipo });
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível salvar a avaliação. Confira as notas e tente novamente."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avaliacao-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar"
        onClick={() => onClose?.()}
      />

      <motion.div
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
        initial={{ y: 32, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 32, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
      >
        <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.28),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.26),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(245,158,11,.22),transparent_35%)]" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone={tipo === "oral" ? "teal" : "emerald"} icon={tipo === "oral" ? Mic : FileText}>
                  {tipo === "oral" ? "Avaliação oral" : "Avaliação escrita"}
                </Badge>
                {submissao?.status ? <StatusBadge status={submissao.status} /> : null}
              </div>

              <h2 id="avaliacao-title" className="line-clamp-2 text-xl font-black tracking-tight sm:text-2xl">
                {fmt(submissao?.titulo, "Avaliação da submissão")}
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/70">
                {fmt(submissao?.chamada_titulo)} · {fmt(submissao?.linha_tematica_nome)} · Início {fmt(submissao?.inicio_experiencia)}
              </p>
            </div>

            <button
              type="button"
              ref={closeButtonRef}
              onClick={() => onClose?.()}
              className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Fechar avaliação"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center gap-3 p-8 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Carregando avaliação...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            {erro ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{erro}</span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <section className="space-y-4">
                <GlassCard className="p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                    <ClipboardList className="h-5 w-5 text-emerald-600" />
                    Conteúdo do trabalho
                  </h3>

                  <div className="space-y-3">
                    {[
                      ["Introdução", submissao?.introducao],
                      ["Objetivos", submissao?.objetivos],
                      ["Método / descrição da prática", submissao?.metodo],
                      ["Resultados / impactos", submissao?.resultados],
                      ["Considerações finais", submissao?.consideracao],
                      ["Bibliografia", submissao?.bibliografia],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                      >
                        <h4 className="font-black text-slate-800 dark:text-slate-100">
                          {label}
                        </h4>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {value || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                    <Layers3 className="h-5 w-5 text-teal-600" />
                    Critérios de avaliação
                  </h3>

                  {criterios.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum critério configurado para esta modalidade.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {criterios.map((criterio, index) => (
                        <div
                          key={criterio.id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 dark:text-white">
                                {criterio.titulo || criterio.criterio || `Critério ${index + 1}`}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Escala {criterio.escala_min}–{criterio.escala_max} · Peso {criterio.peso ?? 1}
                              </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-[140px_1fr] lg:w-[520px]">
                              <label className="block">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Nota
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={criterio.escala_min}
                                  max={criterio.escala_max}
                                  step="0.1"
                                  className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                                  value={itens[index]?.nota ?? ""}
                                  onChange={(event) => {
                                    atualizarItem(index, {
                                      criterio_id: criterio.id,
                                      nota: event.target.value === "" ? "" : Number(event.target.value),
                                    });
                                  }}
                                />
                              </label>

                              <label className="block">
                                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                  Comentários
                                </span>
                                <textarea
                                  rows={2}
                                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                                  value={itens[index]?.comentarios ?? ""}
                                  onChange={(event) => {
                                    atualizarItem(index, {
                                      criterio_id: criterio.id,
                                      comentarios: event.target.value,
                                    });
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </section>

              <aside className="space-y-4">
                <GlassCard className="sticky top-4 p-5">
                  <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                    <BarChart3 className="h-5 w-5 text-emerald-600" />
                    Resumo da avaliação
                  </h3>

                  <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Prévia normalizada /10
                    </p>
                    <p className="mt-2 text-5xl font-black text-emerald-700 dark:text-emerald-200">
                      {notaPreview == null ? "—" : notaPreview.toFixed(1)}
                    </p>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    A prévia considera a escala e o peso dos critérios. O backend salva as notas por critério e recalcula os totais oficiais.
                  </p>
                </GlassCard>
              </aside>
            </div>
          </div>
        )}

        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-end">
          <Button tone="ghost" onClick={() => onClose?.()}>
            Fechar
          </Button>
          <Button tone="primary" icon={Check} loading={saving} onClick={salvar}>
            Salvar avaliação
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

/* =========================================================================
   Página principal
=========================================================================== */

export default function AvaliadorSubmissao() {
  const searchRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [lista, setLista] = useState([]);
  const [contagens, setContagens] = useState({
    total: 0,
    pendentes: 0,
    finalizadas: 0,
  });

  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");

  const [notasMap, setNotasMap] = useState({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focus, setFocus] = useState({
    id: null,
    tipo: null,
  });

  useEffect(() => {
    document.title = "Trabalhos para avaliar | Escola da Saúde";
  }, []);

  const carregarNotas = useCallback(async (items) => {
    const nextNotas = {};

    const concorrencia = 4;
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const item = items[index];
        index += 1;

        try {
          const submissaoId = getSubmissaoId(item);

          if (!submissaoId) continue;

          const tipo = String(item.tipo || "escrita").toLowerCase();
          const detalhe = await obterSubmissao(submissaoId);
          const avaliacao = await obterAvaliacaoSubmissao(submissaoId);
          const chamadaId = detalhe?.chamada_id || item.chamada_id;

          if (!chamadaId) continue;

          const chamada = await obterChamada(chamadaId);
          const criterios =
            tipo === "oral"
              ? chamada?.criterios_orais || []
              : chamada?.criterios || [];

          const itens = Array.isArray(avaliacao?.itens)
            ? avaliacao.itens.filter((av) =>
                criterios.some((criterio) => Number(criterio.id) === Number(av.criterio_id))
              )
            : [];

          const nota = nota10Normalizada({ itens, criterios });

          if (nota != null) {
            nextNotas[`${submissaoId}-${tipo}`] = nota;
          }
        } catch {
          // Sem avaliação ainda ou sem permissão pontual: não bloqueia a listagem.
        }
      }
    }

    await Promise.allSettled(Array.from({ length: concorrencia }, worker));

    setNotasMap(nextNotas);
  }, []);

  const carregarTudo = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const [atribuidas, contagem] = await Promise.all([
        listarAtribuidas(),
        obterContagem(),
      ]);

      setLista(atribuidas);
      setContagens(contagem);

      await carregarNotas(atribuidas);
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível carregar suas avaliações. Verifique sua conexão ou tente novamente."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [carregarNotas]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedBusca(busca.trim().toLowerCase());
    }, 220);

    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    function onKeyDown(event) {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag);

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if ((event.key === "r" || event.key === "R") && !typing) {
        event.preventDefault();
        carregarTudo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [carregarTudo]);

  const filtradas = useMemo(() => {
    if (!debouncedBusca) return lista;

    return lista.filter((item) =>
      [
        item.titulo,
        item.chamada_titulo,
        item.linha_tematica_nome,
        item.status,
        item.tipo,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .some((value) => value.includes(debouncedBusca))
    );
  }, [lista, debouncedBusca]);

  const pendentes = useMemo(
    () => filtradas.filter((item) => !item.avaliada),
    [filtradas]
  );

  const realizadas = useMemo(
    () => filtradas.filter((item) => item.avaliada),
    [filtradas]
  );

  const mediaGeral = useMemo(() => {
    const notas = Object.values(notasMap).filter((nota) => Number.isFinite(nota));

    if (notas.length === 0) return null;

    return Number((notas.reduce((sum, nota) => sum + nota, 0) / notas.length).toFixed(1));
  }, [notasMap]);

  function abrirAvaliacao(id, tipo) {
    const submissaoId = Number(id);

    if (!Number.isInteger(submissaoId) || submissaoId <= 0) {
      setErro("Não foi possível abrir a avaliação: submissão sem identificador válido.");
      return;
    }

    setFocus({
      id: submissaoId,
      tipo: tipo || "escrita",
    });
    setDrawerOpen(true);
  }

  async function handleDrawerClose(event) {
    setDrawerOpen(false);

    if (!event?.saved) return;

    await carregarTudo();
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/90">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Carregando trabalhos atribuídos...
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
      >
        Ir para o conteúdo
      </a>

      <HeaderHero
        titulo="Avaliação de trabalhos"
        subtitulo="Acompanhe trabalhos atribuídos, pendências, avaliações finalizadas e notas técnicas em cards responsivos."
        icon={ClipboardList}
      />

      <main id="conteudo" className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Total"
            value={contagens.total}
            icon={ClipboardList}
            tone="emerald"
            description="Trabalhos atribuídos"
          />
          <MetricCard
            label="Pendentes"
            value={contagens.pendentes}
            icon={Loader2}
            tone="amber"
            description="Aguardando avaliação"
          />
          <MetricCard
            label="Finalizadas"
            value={contagens.finalizadas}
            icon={CheckCircle2}
            tone="teal"
            description="Avaliações realizadas"
          />
          <MetricCard
            label="Média"
            value={mediaGeral == null ? "—" : mediaGeral.toFixed(1)}
            icon={BarChart3}
            tone="blue"
            description="Nota técnica geral"
          />
        </section>

        <section className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-slate-900/85 dark:ring-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Info className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold">Legenda:</span>
              <StatusBadge status="submetida" />
              <StatusBadge status="em_avaliacao" />
              <StatusBadge status="aprovada_exposicao" />
              <StatusBadge status="aprovada_oral" />
              <StatusBadge status="reprovada" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                tone="slate"
                size="sm"
                icon={Download}
                onClick={() =>
                  exportarCSV({
                    escopo: "geral",
                    itens: filtradas,
                    notasMap,
                  })
                }
              >
                CSV geral
              </Button>
              <Button
                tone="slate"
                size="sm"
                icon={Download}
                onClick={() =>
                  exportarCSV({
                    escopo: "pendentes",
                    itens: pendentes,
                    notasMap,
                  })
                }
              >
                Pendentes
              </Button>
              <Button tone="ghost" size="sm" icon={RefreshCw} onClick={carregarTudo}>
                Recarregar
              </Button>
            </div>
          </div>
        </section>
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Filter className="h-5 w-5 text-emerald-600" />
                Buscar trabalhos atribuídos
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Filtre por título, chamada, linha temática, status ou tipo de avaliação.
              </p>
            </div>

            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por título, chamada ou linha..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                aria-label="Buscar submissões atribuídas"
              />
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {erro ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{erro}</span>
              </div>
            </div>
          ) : null}
        </GlassCard>

        <SubmissaoLista
          title={`Avaliações pendentes (${pendentes.length})`}
          items={pendentes}
          notasMap={notasMap}
          onAbrir={abrirAvaliacao}
          emptyText="Nenhuma pendência encontrada."
        />

        <SubmissaoLista
          title={`Avaliações realizadas (${realizadas.length})`}
          items={realizadas}
          notasMap={notasMap}
          onAbrir={abrirAvaliacao}
          emptyText="Nenhuma avaliação realizada ainda."
        />
      </main>

      <Footer />

      <AnimatePresence>
        {drawerOpen ? (
          <DrawerAvaliacao
            open={drawerOpen}
            submissaoId={focus.id}
            tipo={focus.tipo}
            onClose={handleDrawerClose}
          />
        ) : null}
      </AnimatePresence>
    </PageShell>
  );
}