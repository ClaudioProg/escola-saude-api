// 📁 src/pages/AdminSubmissao.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página administrativa de SUBMISSÕES DE TRABALHOS.
//
// Contratos oficiais usados:
// - GET /api/submissao/admin
// - GET /api/chamada/ativa
// - GET /api/submissao/:id/poster
//
// Fora desta página:
// - CRUD de chamada;
// - criação/edição autoral de trabalho;
// - endpoints antigos /admin/submissao, /chamadas/ativas, /trabalhos/*.
//
// Observação:
// Os modais importados abaixo ainda devem ser revisados em seguida para garantir
// que também usem exclusivamente os contratos v2.0.

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  Layers3,
  Loader2,
  Mic,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import RankingModal from "../components/RankingModal";
import RankingOralModal from "../components/RankingOralModal";
import ModalAvaliadores from "../components/ModalAvaliadores";
import ModalDetalhesSubmissao from "../components/ModalDetalhesSubmissao";
import ModalAtribuirAvaliadores from "../components/ModalAtribuirAvaliadores";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.data?.submissoes)) return response.data.data.submissoes;
  if (Array.isArray(response?.submissoes)) return response.submissoes;
  return [];
}

function fmt(value, fallback = "—") {
  return value === 0 || value ? String(value) : fallback;
}

function fmtNum(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtNota(value) {
  return value === 0 || value ? fmtNum(value, 2) : "—";
}

function fmtDateTimeBR(value) {
  if (!value) return "—";

  const text = String(value);

  const wall = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text);
  if (wall) {
    return `${wall[3]}/${wall[2]}/${wall[1]} ${wall[4]}:${wall[5]}`;
  }

  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function normalizarStatusPrincipal(raw) {
  const status = String(raw || "").toLowerCase();

  if (status === "rascunho") return "rascunho";
  if (status === "submetida") return "submetida";
  if (status === "em_avaliacao") return "em_avaliacao";
  if (status === "aprovada_exposicao") return "aprovada_exposicao";
  if (status === "aprovada_oral") return "aprovada_oral";
  if (status === "aprovada") return "aprovada";
  if (status === "reprovada") return "reprovada";
  if (status === "cancelada") return "cancelada";

  return status || "indefinido";
}

function statusLabel(status) {
  const value = normalizarStatusPrincipal(status);

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

function linhaKeyFromSubmissao(item) {
  return String(
    item?.linha_tematica_id ??
      item?.linha_tematica_nome ??
      item?.linha_tematica_codigo ??
      ""
  );
}

function hasAprovacaoExposicao(item) {
  const status = normalizarStatusPrincipal(item?.status);
  const escrita = String(item?.status_escrita || "").toLowerCase();

  return (
    escrita === "aprovado" ||
    status === "aprovada_exposicao" ||
    status === "aprovada" ||
    Boolean(item?._exposicao_aprovada)
  );
}

function hasAprovacaoOral(item) {
  const status = normalizarStatusPrincipal(item?.status);
  const oral = String(item?.status_oral || "").toLowerCase();

  return (
    oral === "aprovado" ||
    status === "aprovada_oral" ||
    status === "aprovada" ||
    Boolean(item?._oral_aprovada)
  );
}

function hasAnexo(item) {
  return Boolean(
    item?._hasAnexo ||
      item?.poster_arquivo_id ||
      item?.poster_nome ||
      item?.has_anexo ||
      item?.tem_anexo ||
      item?.possui_anexo
  );
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

/* =========================================================================
   CSV
=========================================================================== */

function exportarCSV(items = []) {
  const sep = ";";
  const bom = "\uFEFF";

  function safe(value) {
    const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
    return `"${text.replace(/"/g, '""')}"`;
  }

  const header = [
    "Título",
    "Autor",
    "E-mail",
    "Chamada",
    "Linha temática",
    "Submetido em",
    "Status",
    "Exposição",
    "Apresentação oral",
    "Nota escrita",
    "Nota oral",
    "Nota final",
    "Anexo",
  ].join(sep);

  const rows = items.map((item) =>
    [
      safe(item.titulo),
      safe(item.autor_nome),
      safe(item.autor_email),
      safe(item.chamada_titulo),
      safe(item.linha_tematica_nome || item.linha_tematica_codigo || ""),
      safe(
        normalizarStatusPrincipal(item.status) === "rascunho"
          ? "—"
          : fmtDateTimeBR(item.submetido_em || item.criado_em)
      ),
      safe(statusLabel(item.status)),
      safe(hasAprovacaoExposicao(item) ? "Sim" : "Não"),
      safe(hasAprovacaoOral(item) ? "Sim" : "Não"),
      safe(fmtNota(item.nota_escrita)),
      safe(fmtNota(item.nota_oral)),
      safe(fmtNota(item.nota_final)),
      safe(hasAnexo(item) ? "Sim" : "Não"),
    ].join(sep)
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });

  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(
    d.getMinutes()
  ).padStart(2, "0")}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `submissoes_trabalhos_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* =========================================================================
   URL state
=========================================================================== */

function useUrlState() {
  const location = useLocation();
  const navigate = useNavigate();

  const get = useCallback(() => {
    const params = new URLSearchParams(location.search);

    return {
      chamada: params.get("chamada") || "",
      status: params.get("status") || "",
      linha: params.get("linha") || "",
      q: params.get("q") || "",
      sort: params.get("sort") || "",
      page: Number(params.get("page") || 1),
      per: Number(params.get("per") || 20),
    };
  }, [location.search]);

  const set = useCallback(
    (patch) => {
      const current = get();
      const next = { ...current, ...patch };
      const params = new URLSearchParams();

      if (next.chamada) params.set("chamada", next.chamada);
      if (next.status) params.set("status", next.status);
      if (next.linha) params.set("linha", next.linha);
      if (next.q) params.set("q", next.q);
      if (next.sort) params.set("sort", next.sort);
      if (next.page && next.page > 1) params.set("page", String(next.page));
      if (next.per && next.per !== 20) params.set("per", String(next.per));

      navigate({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    },
    [get, navigate]
  );

  return { get, set };
}

/* =========================================================================
   UI
=========================================================================== */

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950 dark:bg-slate-950">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute right-[-12%] top-24 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
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
      "bg-gradient-to-r from-amber-600 via-orange-600 to-violet-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    success:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    warning:
      "bg-amber-600 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-700",
    danger:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
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
        "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
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
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
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
  const value = normalizarStatusPrincipal(status);

  const config = {
    rascunho: { tone: "slate", icon: FileText },
    submetida: { tone: "cyan", icon: ClipboardList },
    em_avaliacao: { tone: "amber", icon: Loader2 },
    aprovada_exposicao: { tone: "emerald", icon: CheckCircle2 },
    aprovada_oral: { tone: "emerald", icon: Mic },
    aprovada: { tone: "emerald", icon: CheckCircle2 },
    reprovada: { tone: "rose", icon: XCircle },
    cancelada: { tone: "rose", icon: XCircle },
    indefinido: { tone: "slate", icon: AlertCircle },
  };

  const item = config[value] || config.indefinido;

  return (
    <Badge tone={item.tone} icon={item.icon}>
      {statusLabel(value)}
    </Badge>
  );
}

function Aprovacoes({ item }) {
  const exposicao = hasAprovacaoExposicao(item);
  const oral = hasAprovacaoOral(item);

  if (!exposicao && !oral) {
    return <span className="text-xs text-slate-400">Sem aprovação parcial</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {exposicao ? <Badge tone="emerald" icon={CheckCircle2}>Exposição</Badge> : null}
      {oral ? <Badge tone="emerald" icon={Mic}>Oral</Badge> : null}
    </div>
  );
}

/* =========================================================================
   Header
=========================================================================== */

function HeaderHero({ stats }) {
  return (
    <header className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(245,158,11,.28),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,.28),transparent_30%),radial-gradient(circle_at_55%_90%,rgba(16,185,129,.22),transparent_30%)]" />

      <div className="relative mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
              Submissões de trabalhos — painel administrativo v2.0
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Auditoria, acompanhamento e decisão sobre trabalhos submetidos.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
              Visualize submissões, acompanhe status, notas, anexos, avaliadores,
              rankings e classificações com rastreabilidade institucional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Total" value={stats.total} icon={ClipboardList} tone="amber" />
            <Metric label="Em avaliação" value={stats.emAvaliacao} icon={Loader2} tone="cyan" />
            <Metric label="Aprovadas" value={stats.aprovadas} icon={CheckCircle2} tone="emerald" />
            <Metric label="Reprovadas" value={stats.reprovadas} icon={XCircle} tone="rose" />
          </div>
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value, icon: Icon, tone = "amber" }) {
  const tones = {
    amber: "from-amber-400/25 to-white/5",
    cyan: "from-cyan-400/25 to-white/5",
    emerald: "from-emerald-400/25 to-white/5",
    rose: "from-rose-400/25 to-white/5",
  };

  return (
    <div className={cx("rounded-3xl border border-white/15 bg-gradient-to-br p-4 backdrop-blur", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/65">
          {label}
        </span>
        <Icon className="h-4 w-4 text-white/70" aria-hidden="true" />
      </div>
      <div className="mt-2 text-3xl font-black">{fmt(value)}</div>
    </div>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function AdminSubmissao() {
  const { get, set } = useUrlState();
  const url = get();

  const [submissoes, setSubmissoes] = useState([]);
  const [chamadas, setChamadas] = useState([]);

  const [filtroChamada, setFiltroChamada] = useState(url.chamada);
  const [filtroStatus, setFiltroStatus] = useState(url.status);
  const [filtroLinha, setFiltroLinha] = useState(url.linha);
  const [busca, setBusca] = useState(url.q);
  const [buscaDebounced, setBuscaDebounced] = useState(url.q);

  const [sortKey, setSortKey] = useState(url.sort.split(":")[0] || "");
  const [sortDir, setSortDir] = useState(url.sort.split(":")[1] || "asc");
  const [page, setPage] = useState(url.page || 1);
  const [perPage, setPerPage] = useState(url.per || 20);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);

  const [rankingOpen, setRankingOpen] = useState(false);
  const [oralOpen, setOralOpen] = useState(false);
  const [avaliadoresOpen, setAvaliadoresOpen] = useState(false);

  const [atribOpen, setAtribOpen] = useState(false);
  const [submissaoIdAtrib, setSubmissaoIdAtrib] = useState(null);

  const carregar = useCallback(async () => {
    const controller = new AbortController();

    setLoading(true);
    setErro("");

    try {
      const [subsResponse, chamadasResponse] = await Promise.all([
        api.get("/submissao/admin", { signal: controller.signal }),
        api.get("/chamada/ativa", { signal: controller.signal }),
      ]);

      const subs = unwrap(subsResponse).map((item) => ({
        ...item,
        _hasAnexo: hasAnexo(item),
      }));

      setSubmissoes(subs);
      setChamadas(unwrap(chamadasResponse));
    } catch (error) {
      if (error?.name !== "AbortError" && error?.code !== "ERR_CANCELED") {
        setErro(
          getErrorMessage(
            error,
            "Não foi possível carregar as submissões. Verifique sua conexão ou tente novamente."
          )
        );
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const abortPromise = carregar();
    return () => {
      Promise.resolve(abortPromise).then((cleanup) => {
        if (typeof cleanup === "function") cleanup();
      });
    };
  }, [carregar]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaDebounced(busca);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    const sort = sortKey ? `${sortKey}:${sortDir}` : "";

    set({
      chamada: filtroChamada,
      status: filtroStatus,
      linha: filtroLinha,
      q: buscaDebounced,
      sort,
      page,
      per: perPage,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroChamada, filtroStatus, filtroLinha, buscaDebounced, sortKey, sortDir, page, perPage]);

  const linhasTematicas = useMemo(() => {
    const map = new Map();

    for (const item of submissoes) {
      const key = linhaKeyFromSubmissao(item);
      const nome = item?.linha_tematica_nome || item?.linha_tematica_codigo || null;

      if (!key || !nome) continue;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nome: String(nome),
          codigo: item?.linha_tematica_codigo || null,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
  }, [submissoes]);

  const filtradas = useMemo(() => {
    const termo = String(buscaDebounced || "").trim().toLowerCase();

    return submissoes.filter((item) => {
      const matchChamada =
        !filtroChamada || Number(item.chamada_id) === Number(filtroChamada);

      const statusAtual = normalizarStatusPrincipal(item.status);

      const matchStatus =
        !filtroStatus ||
        (filtroStatus === "aprovada_exposicao" && hasAprovacaoExposicao(item)) ||
        (filtroStatus === "aprovada_oral" && hasAprovacaoOral(item)) ||
        statusAtual === filtroStatus;

      const matchLinha =
        !filtroLinha || linhaKeyFromSubmissao(item) === String(filtroLinha);

      const pool = [
        item.titulo,
        item.autor_nome,
        item.autor_email,
        item.chamada_titulo,
        item.linha_tematica_nome,
        item.linha_tematica_codigo,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      const matchBusca = !termo || pool.some((value) => value.includes(termo));

      return matchChamada && matchStatus && matchLinha && matchBusca;
    });
  }, [submissoes, filtroChamada, filtroStatus, filtroLinha, buscaDebounced]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtradas;

    const dir = sortDir === "desc" ? -1 : 1;

    function getValue(item) {
      switch (sortKey) {
        case "titulo":
          return String(item.titulo || "").toLowerCase();
        case "autor":
          return String(item.autor_nome || "").toLowerCase();
        case "chamada":
          return String(item.chamada_titulo || "").toLowerCase();
        case "linha":
          return String(item.linha_tematica_nome || item.linha_tematica_codigo || "").toLowerCase();
        case "submetido":
          return new Date(item.submetido_em || item.criado_em || 0).getTime() || 0;
        case "nota_escrita":
          return Number(item.nota_escrita ?? -Infinity);
        case "nota_oral":
          return Number(item.nota_oral ?? -Infinity);
        case "nota_final":
          return Number(item.nota_final ?? -Infinity);
        default:
          return "";
      }
    }

    return [...filtradas].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);

      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [filtradas, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (pageClamped - 1) * perPage;
    return sorted.slice(start, start + perPage);
  }, [sorted, pageClamped, perPage]);

  const stats = useMemo(() => {
    const totalAll = submissoes.length;
    const aprovadas = submissoes.filter((item) =>
      ["aprovada", "aprovada_exposicao", "aprovada_oral"].includes(
        normalizarStatusPrincipal(item.status)
      )
    ).length;
    const reprovadas = submissoes.filter(
      (item) => normalizarStatusPrincipal(item.status) === "reprovada"
    ).length;
    const emAvaliacao = submissoes.filter(
      (item) => normalizarStatusPrincipal(item.status) === "em_avaliacao"
    ).length;

    return { total: totalAll, aprovadas, reprovadas, emAvaliacao };
  }, [submissoes]);

  function setSort(key) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }

    setPage(1);
  }

  function limparFiltros() {
    setFiltroChamada("");
    setFiltroStatus("");
    setFiltroLinha("");
    setBusca("");
    setBuscaDebounced("");
    setSortKey("");
    setSortDir("asc");
    setPage(1);
    setPerPage(20);
  }

  function atualizarStatusLocal(id, patch) {
    setSubmissoes((current) =>
      current.map((item) => {
        if (item.id !== id) return item;

        const payload = typeof patch === "string" ? { status: patch } : patch || {};
        const next = { ...item, ...payload };

        if (hasAprovacaoExposicao(next)) next._exposicao_aprovada = true;
        if (hasAprovacaoOral(next)) next._oral_aprovada = true;

        return next;
      })
    );
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/90">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-600" />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Carregando submissões...
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <HeaderHero stats={stats} />

      <main className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Toolbar
          chamadas={chamadas}
          linhasTematicas={linhasTematicas}
          filtroChamada={filtroChamada}
          setFiltroChamada={setFiltroChamada}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          filtroLinha={filtroLinha}
          setFiltroLinha={setFiltroLinha}
          busca={busca}
          setBusca={setBusca}
          perPage={perPage}
          setPerPage={setPerPage}
          total={total}
          pageItems={pageItems}
          hasFilters={Boolean(filtroChamada || filtroStatus || filtroLinha || buscaDebounced)}
          onReload={carregar}
          onClear={limparFiltros}
          onRanking={() => setRankingOpen(true)}
          onRankingOral={() => setOralOpen(true)}
          onAvaliadores={() => setAvaliadoresOpen(true)}
          onExport={() => exportarCSV(sorted)}
          erro={erro}
        />

        <SubmissaoTable
          items={pageItems}
          sortKey={sortKey}
          sortDir={sortDir}
          setSort={setSort}
          onDetalhe={(item) => {
            setSelecionada(item);
            setDetalheOpen(true);
          }}
          onAtribuir={(id) => {
            setSubmissaoIdAtrib(id);
            setAtribOpen(true);
          }}
        />

        <SubmissaoCards
          items={pageItems}
          onDetalhe={(item) => {
            setSelecionada(item);
            setDetalheOpen(true);
          }}
          onAtribuir={(id) => {
            setSubmissaoIdAtrib(id);
            setAtribOpen(true);
          }}
        />

        <Paginacao
          page={pageClamped}
          totalPages={totalPages}
          setPage={setPage}
          perPage={perPage}
          setPerPage={setPerPage}
          total={total}
        />
      </main>

      <Footer />

      <AnimatePresence>
        {detalheOpen ? (
          <ModalDetalhesSubmissao
            open={detalheOpen}
            onClose={() => setDetalheOpen(false)}
            submissao={selecionada}
            onDetectAnexo={(id, has) => {
              if (!has) return;
              setSubmissoes((current) =>
                current.map((item) => (item.id === id ? { ...item, _hasAnexo: true } : item))
              );
            }}
          />
        ) : null}

        {atribOpen ? (
          <ModalAtribuirAvaliadores
            isOpen={atribOpen}
            submissaoId={submissaoIdAtrib}
            onClose={() => setAtribOpen(false)}
            onChanged={carregar}
          />
        ) : null}

        {rankingOpen ? (
          <RankingModal
            key="ranking-modal"
            open={rankingOpen}
            onClose={() => setRankingOpen(false)}
            itens={sorted}
            onStatusChange={atualizarStatusLocal}
          />
        ) : null}

        {oralOpen ? (
          <RankingOralModal
            open={oralOpen}
            onClose={() => setOralOpen(false)}
            itens={sorted}
          />
        ) : null}

        {avaliadoresOpen ? (
          <ModalAvaliadores
            key="avaliadores-modal"
            isOpen={avaliadoresOpen}
            onClose={() => setAvaliadoresOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </PageShell>
  );
}

/* =========================================================================
   Toolbar
=========================================================================== */

function Toolbar({
  chamadas,
  linhasTematicas,
  filtroChamada,
  setFiltroChamada,
  filtroStatus,
  setFiltroStatus,
  filtroLinha,
  setFiltroLinha,
  busca,
  setBusca,
  total,
  pageItems,
  hasFilters,
  onReload,
  onClear,
  onRanking,
  onRankingOral,
  onAvaliadores,
  onExport,
  erro,
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
            <SlidersHorizontal className="h-5 w-5 text-amber-600" />
            Painel de controle
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Filtre, audite, exporte e encaminhe submissões para avaliação.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button tone="warning" icon={Award} onClick={onRanking}>
            Ranking escrita
          </Button>
          <Button tone="slate" icon={Mic} onClick={onRankingOral}>
            Ranking oral
          </Button>
          <Button tone="success" icon={Users} onClick={onAvaliadores}>
            Avaliadores
          </Button>
          <Button tone="slate" icon={Download} onClick={onExport}>
            Exportar CSV
          </Button>
          <Button tone="ghost" icon={RefreshCw} onClick={onReload}>
            Recarregar
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
        <select
          value={filtroChamada}
          onChange={(event) => setFiltroChamada(event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Filtrar por chamada"
        >
          <option value="">Todas as chamadas</option>
          {chamadas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.titulo}
            </option>
          ))}
        </select>

        <select
          value={filtroStatus}
          onChange={(event) => setFiltroStatus(event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="submetida">Submetida</option>
          <option value="em_avaliacao">Em avaliação</option>
          <option value="aprovada_exposicao">Aprovada para exposição</option>
          <option value="aprovada_oral">Aprovada para oral</option>
          <option value="aprovada">Aprovada</option>
          <option value="reprovada">Reprovada</option>
          <option value="cancelada">Cancelada</option>
        </select>

        <select
          value={filtroLinha}
          onChange={(event) => setFiltroLinha(event.target.value)}
          className="h-12 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
          aria-label="Filtrar por linha temática"
        >
          <option value="">Todas as linhas</option>
          {linhasTematicas.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nome}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Buscar título, autor, e-mail, chamada..."
            aria-label="Buscar"
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

        <Button tone="ghost" icon={RotateCcw} onClick={onClear}>
          Limpar
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Exibindo <strong>{pageItems.length}</strong> de <strong>{total}</strong> resultados
          {hasFilters ? " após filtros." : "."}
        </span>
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
  );
}

/* =========================================================================
   Tabela desktop
=========================================================================== */

function SortButton({ label, active, dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 font-black"
      title={`Ordenar por ${label}`}
    >
      <span>{label}</span>
      {!active ? <ArrowUpDown className="h-4 w-4 opacity-70" /> : null}
      {active && dir === "asc" ? <ArrowUp className="h-4 w-4" /> : null}
      {active && dir === "desc" ? <ArrowDown className="h-4 w-4" /> : null}
    </button>
  );
}

function SubmissaoTable({ items, sortKey, sortDir, setSort, onDetalhe, onAtribuir }) {
  return (
    <GlassCard className="hidden overflow-hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1280px] text-sm">
          <caption className="sr-only">Lista administrativa de submissões de trabalhos</caption>

          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="p-4 text-left">
                <SortButton
                  label="Título"
                  active={sortKey === "titulo"}
                  dir={sortDir}
                  onClick={() => setSort("titulo")}
                />
              </th>
              <th className="p-4 text-left">
                <SortButton
                  label="Autor"
                  active={sortKey === "autor"}
                  dir={sortDir}
                  onClick={() => setSort("autor")}
                />
              </th>
              <th className="p-4 text-left">
                <SortButton
                  label="Chamada"
                  active={sortKey === "chamada"}
                  dir={sortDir}
                  onClick={() => setSort("chamada")}
                />
              </th>
              <th className="p-4 text-left">
                <SortButton
                  label="Linha"
                  active={sortKey === "linha"}
                  dir={sortDir}
                  onClick={() => setSort("linha")}
                />
              </th>
              <th className="p-4 text-center">
                <SortButton
                  label="Submetido"
                  active={sortKey === "submetido"}
                  dir={sortDir}
                  onClick={() => setSort("submetido")}
                />
              </th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">
                <SortButton
                  label="Escrita"
                  active={sortKey === "nota_escrita"}
                  dir={sortDir}
                  onClick={() => setSort("nota_escrita")}
                />
              </th>
              <th className="p-4 text-center">
                <SortButton
                  label="Oral"
                  active={sortKey === "nota_oral"}
                  dir={sortDir}
                  onClick={() => setSort("nota_oral")}
                />
              </th>
              <th className="p-4 text-center">
                <SortButton
                  label="Final"
                  active={sortKey === "nota_final"}
                  dir={sortDir}
                  onClick={() => setSort("nota_final")}
                />
              </th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-10 text-center text-slate-500">
                  Nenhuma submissão encontrada.
                </td>
              </tr>
            ) : null}

            {items.map((item) => (
              <tr
                key={item.id}
                className={cx(
                  "border-b border-slate-100 transition hover:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40",
                  hasAnexo(item) ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-slate-300"
                )}
              >
                <td className="p-4 align-top">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-black text-slate-900 dark:text-white">
                        {item.titulo || "—"}
                      </p>
                      <div className="mt-2">
                        <AnexoBadge item={item} />
                      </div>
                    </div>
                  </div>
                </td>

                <td className="p-4 align-top">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {item.autor_nome || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.autor_email || "—"}</p>
                </td>

                <td className="p-4 align-top text-slate-700 dark:text-slate-300">
                  {item.chamada_titulo || "—"}
                </td>

                <td className="p-4 align-top text-slate-700 dark:text-slate-300">
                  {item.linha_tematica_nome || item.linha_tematica_codigo || "—"}
                </td>

                <td className="p-4 text-center align-top">
                  {normalizarStatusPrincipal(item.status) === "rascunho"
                    ? "—"
                    : fmtDateTimeBR(item.submetido_em || item.criado_em)}
                </td>

                <td className="p-4 text-center align-top">
                  <div className="flex flex-col items-center gap-2">
                    <StatusBadge status={item.status} />
                    <Aprovacoes item={item} />
                  </div>
                </td>

                <td className="p-4 text-center align-top font-black">{fmtNota(item.nota_escrita)}</td>
                <td className="p-4 text-center align-top font-black">{fmtNota(item.nota_oral)}</td>
                <td className="p-4 text-center align-top font-black">{fmtNota(item.nota_final)}</td>

                <td className="p-4 align-top">
                  <div className="flex justify-center gap-2">
                    <Button tone="warning" size="sm" icon={Eye} onClick={() => onDetalhe(item)}>
                      Ver
                    </Button>
                    <Button tone="success" size="sm" icon={Users} onClick={() => onAtribuir(item.id)}>
                      Avaliadores
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function AnexoBadge({ item }) {
  return hasAnexo(item) ? (
    <Badge tone="emerald" icon={Paperclip}>Anexo</Badge>
  ) : (
    <Badge tone="slate" icon={Paperclip}>Sem anexo</Badge>
  );
}

/* =========================================================================
   Cards mobile/tablet
=========================================================================== */

function SubmissaoCards({ items, onDetalhe, onAtribuir }) {
  return (
    <section className="grid gap-3 lg:hidden" aria-label="Cards de submissões">
      {items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800">
            <Filter className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
            Nenhuma submissão encontrada
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ajuste os filtros ou atualize a listagem.
          </p>
        </GlassCard>
      ) : null}

      {items.map((item) => (
        <motion.article
          key={item.id}
          layout
          className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div
            className={cx(
              "h-1.5 bg-gradient-to-r",
              hasAnexo(item)
                ? "from-emerald-500 via-cyan-400 to-sky-500"
                : "from-slate-300 via-slate-400 to-slate-500"
            )}
          />

          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="line-clamp-3 font-black text-slate-900 dark:text-white">
                  {item.titulo || "—"}
                </h3>
                <p className="mt-1 text-xs text-slate-500">{item.chamada_titulo || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.linha_tematica_nome || item.linha_tematica_codigo || "—"}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={item.status} />
                <AnexoBadge item={item} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {item.autor_nome || "—"}
              </p>
              <p className="text-xs text-slate-500">{item.autor_email || "—"}</p>
              {normalizarStatusPrincipal(item.status) !== "rascunho" ? (
                <p className="mt-2 text-xs text-slate-500">
                  Submetido em: {fmtDateTimeBR(item.submetido_em || item.criado_em)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <NotaBox label="Escrita" value={fmtNota(item.nota_escrita)} />
              <NotaBox label="Oral" value={fmtNota(item.nota_oral)} />
              <NotaBox label="Final" value={fmtNota(item.nota_final)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button tone="warning" size="sm" icon={Eye} onClick={() => onDetalhe(item)}>
                Ver
              </Button>
              <Button tone="success" size="sm" icon={Users} onClick={() => onAtribuir(item.id)}>
                Avaliadores
              </Button>
            </div>
          </div>
        </motion.article>
      ))}
    </section>
  );
}

function NotaBox({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

/* =========================================================================
   Paginação
=========================================================================== */

function Paginacao({ page, totalPages, setPage, perPage, setPerPage, total }) {
  return (
    <GlassCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Total de <strong>{total}</strong> registros encontrados.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Itens por página
          <select
            value={perPage}
            onChange={(event) => {
              setPerPage(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <Button
            tone="slate"
            size="sm"
            icon={ChevronLeft}
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </Button>

          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Página {page} / {totalPages}
          </span>

          <Button
            tone="slate"
            size="sm"
            icon={ChevronRight}
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Próxima
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}