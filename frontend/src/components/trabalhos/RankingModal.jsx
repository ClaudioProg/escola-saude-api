// 📁 src/components/trabalhos/RankingModal.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal administrativo de ranking da avaliação escrita/geral.
//
// Contratos oficiais usados:
// - PATCH /api/submissao/admin/:id/status
//
// Função:
// - exibir ranking de submissões por nota;
// - filtrar por chamada, linha temática e busca textual;
// - aprovar para exposição;
// - reprovar submissão;
// - preservar aprovação oral já existente quando alterar status escrito.
//
// Diretrizes v2.0:
// - sem /admin/submissao/:id/status;
// - sem toast direto;
// - sem confirm nativo;
// - sem status legado submetido/aprovado_exposicao/reprovado;
// - status oficial: submetida, aprovada_exposicao, aprovada_oral, aprovada, reprovada;
// - contrato oficial de atualização administrativa via PATCH;
// - UX/UI premium real;
// - acessível;
// - mobile-first;
// - dark mode.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  Filter,
  Loader2,
  Medal,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

import api from "../../services/api";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function fmt(value, fallback = "—") {
  return value === 0 || value ? String(value) : fallback;
}

function fmtNum(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
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

function isReprovada(item) {
  return normalizarStatus(item?.status) === "reprovada";
}

function hasAprovacaoExposicao(item) {
  const status = normalizarStatus(item?.status);
  const escrita = String(item?.status_escrita || "").toLowerCase();

  return (
    escrita === "aprovado" ||
    status === "aprovada_exposicao" ||
    status === "aprovada" ||
    Boolean(item?._exposicao_aprovada)
  );
}

function hasAprovacaoOral(item) {
  const status = normalizarStatus(item?.status);
  const oral = String(item?.status_oral || "").toLowerCase();

  return (
    oral === "aprovado" ||
    status === "aprovada_oral" ||
    status === "aprovada" ||
    Boolean(item?._oral_aprovada)
  );
}

function lerNota(item) {
  const candidatos = [
    item?.nota_final,
    item?.nota_media,
    item?.nota_escrita,
    item?.media_escrita,
  ];

  for (const candidato of candidatos) {
    const n = Number(candidato);
    if (Number.isFinite(n)) return n;
  }

  return 0;
}

function medalTone(rank) {
  if (rank === 1) return "amber";
  if (rank === 2) return "slate";
  if (rank === 3) return "rose";
  return "violet";
}

function patchStatusPayload(action, item) {
  const oralJaAprovada = hasAprovacaoOral(item);

  if (action === "aprovar_exposicao") {
    return {
      payload: {
        status: oralJaAprovada ? "aprovada" : "aprovada_exposicao",
        status_escrita: "aprovado",
        status_oral: oralJaAprovada ? "aprovado" : item?.status_oral || null,
        observacao_admin: null,
      },
      optimistic: {
        status: oralJaAprovada ? "aprovada" : "aprovada_exposicao",
        status_escrita: "aprovado",
        ...(oralJaAprovada ? { status_oral: "aprovado" } : {}),
        _exposicao_aprovada: true,
        _oral_aprovada: oralJaAprovada,
      },
      message: "Submissão aprovada para exposição.",
    };
  }

  return {
    payload: {
      status: "reprovada",
      status_escrita: "reprovado",
      status_oral: "reprovado",
      observacao_admin: null,
    },
    optimistic: {
      status: "reprovada",
      status_escrita: "reprovado",
      status_oral: "reprovado",
      _exposicao_aprovada: false,
      _oral_aprovada: false,
    },
    message: "Submissão reprovada.",
  };
}

/* =========================================================================
   UI
=========================================================================== */

function Button({
  children,
  icon: Icon,
  tone = "slate",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-500 text-white shadow-lg shadow-amber-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    emerald:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    rose:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
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
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
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
    rascunho: { tone: "slate" },
    submetida: { tone: "blue" },
    em_avaliacao: { tone: "amber" },
    aprovada_exposicao: { tone: "emerald" },
    aprovada_oral: { tone: "emerald" },
    aprovada: { tone: "emerald" },
    reprovada: { tone: "rose" },
    cancelada: { tone: "rose" },
    indefinido: { tone: "slate" },
  };

  return <Badge tone={config[value]?.tone || "slate"}>{statusLabel(value)}</Badge>;
}

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 dark:border-slate-800",
    amber: "border-amber-200 dark:border-amber-900/50",
    emerald: "border-emerald-200 dark:border-emerald-900/50",
    rose: "border-rose-200 dark:border-rose-900/50",
    violet: "border-violet-200 dark:border-violet-900/50",
  };

  return (
    <div
      className={cx(
        "rounded-3xl border bg-white p-4 shadow-sm dark:bg-slate-900/70",
        tones[tone] || tones.slate
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank }) {
  const tone = medalTone(rank);

  return (
    <div
      className={cx(
        "inline-flex h-10 min-w-10 items-center justify-center rounded-2xl px-2 text-sm font-black",
        tone === "amber" && "bg-amber-500 text-white",
        tone === "slate" && "bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-white",
        tone === "rose" && "bg-rose-500 text-white",
        tone === "violet" && "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
      )}
    >
      {rank <= 3 ? <Medal className="h-4 w-4" aria-hidden="true" /> : null}
      <span className={rank <= 3 ? "ml-1" : ""}>{rank}</span>
    </div>
  );
}

function ConfirmBox({ item, action, busy, onCancel, onConfirm }) {
  if (!item || !action) return null;

  const approve = action === "aprovar_exposicao";

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="font-black">
            {approve ? "Aprovar para exposição?" : "Reprovar submissão?"}
          </p>
          <p className="mt-1 break-words">
            {item.titulo || `Submissão #${item.id}`}
          </p>
          <p className="mt-2 text-xs opacity-80">
            {approve
              ? "A submissão ficará marcada como aprovada na avaliação escrita/exposição."
              : "A submissão será marcada como reprovada e removida do ranking ativo."}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button tone="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button
            tone={approve ? "emerald" : "rose"}
            icon={approve ? CheckCircle2 : XCircle}
            loading={busy}
            onClick={onConfirm}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function RankingModal({ open, onClose, itens = [], onStatusChange }) {
  const titleId = useId();
  const descId = useId();

  const closeRef = useRef(null);
  const searchRef = useRef(null);

  const [busca, setBusca] = useState("");
  const [filtroChamada, setFiltroChamada] = useState("__all__");
  const [filtroLinha, setFiltroLinha] = useState("__all__");

  const [workingId, setWorkingId] = useState(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [confirmacao, setConfirmacao] = useState({
    item: null,
    action: null,
  });

  const base = useMemo(
    () => (Array.isArray(itens) ? itens.filter((item) => !isReprovada(item)) : []),
    [itens]
  );

  const chamadas = useMemo(() => {
    const set = new Set();

    for (const item of base) {
      const value = String(item?.chamada_titulo || "").trim();
      if (value) set.add(value);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [base]);

  const linhas = useMemo(() => {
    const set = new Set();

    for (const item of base) {
      const chamada = String(item?.chamada_titulo || "").trim();
      if (filtroChamada !== "__all__" && chamada !== filtroChamada) continue;

      const value = String(item?.linha_tematica_nome || item?.linha_tematica_codigo || "").trim();
      if (value) set.add(value);
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );
  }, [base, filtroChamada]);

  const ordenados = useMemo(() => {
    const term = norm(busca);

    const rows = base
      .filter((item) => {
        const chamada = String(item?.chamada_titulo || "").trim();
        const linha = String(item?.linha_tematica_nome || item?.linha_tematica_codigo || "").trim();

        const matchChamada = filtroChamada === "__all__" || chamada === filtroChamada;
        const matchLinha = filtroLinha === "__all__" || linha === filtroLinha;

        const matchBusca =
          !term ||
          [
            item?.titulo,
            item?.autor_nome,
            item?.autor_email,
            item?.chamada_titulo,
            item?.linha_tematica_nome,
            item?.linha_tematica_codigo,
          ]
            .filter(Boolean)
            .some((value) => norm(value).includes(term));

        return matchChamada && matchLinha && matchBusca;
      })
      .map((item) => ({
        ...item,
        _nota: lerNota(item),
      }))
      .sort((a, b) => b._nota - a._nota || Number(a.id || 0) - Number(b.id || 0));

    return rows.map((item, index) => ({
      ...item,
      _rank: index + 1,
    }));
  }, [base, busca, filtroChamada, filtroLinha]);

  const stats = useMemo(() => {
    const total = ordenados.length;
    const aprovadasExposicao = ordenados.filter(hasAprovacaoExposicao).length;
    const aprovadasOral = ordenados.filter(hasAprovacaoOral).length;
    const media =
      total > 0
        ? ordenados.reduce((sum, item) => sum + Number(item._nota || 0), 0) / total
        : null;

    return {
      total,
      aprovadasExposicao,
      aprovadasOral,
      media,
    };
  }, [ordenados]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }

      const typing = ["input", "textarea", "select"].includes(
        document.activeElement?.tagName?.toLowerCase()
      );

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => closeRef.current?.focus?.(), 80);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;

    setBusca("");
    setFiltroChamada("__all__");
    setFiltroLinha("__all__");
    setWorkingId(null);
    setErro("");
    setMensagem("");
    setConfirmacao({ item: null, action: null });
  }, [open]);

  async function executarAcao() {
    const item = confirmacao.item;
    const action = confirmacao.action;

    if (!item?.id || !action) return;

    const config = patchStatusPayload(action, item);

    setWorkingId(item.id);
    setErro("");
    setMensagem("");

    try {
      await api.patch(`/submissao/admin/${item.id}/status`, config.payload);

      onStatusChange?.(item.id, config.optimistic);
      setMensagem(config.message);
      setConfirmacao({ item: null, action: null });
    } catch (error) {
      setErro(getMessage(error, "Não foi possível atualizar o status da submissão."));
    } finally {
      setWorkingId(null);
    }
  }

  function limparFiltros() {
    setBusca("");
    setFiltroChamada("__all__");
    setFiltroLinha("__all__");
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(249,115,22,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(234,179,8,.22),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone="amber" icon={ShieldCheck}>
                    Ranking administrativo
                  </Badge>
                  <Badge tone="violet" icon={Trophy}>
                    Avaliação escrita
                  </Badge>
                </div>

                <h3
                  id={titleId}
                  className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                  Ranking por nota
                </h3>

                <p id={descId} className="mt-2 max-w-4xl text-sm leading-relaxed text-white/75">
                  Ordene submissões por nota, filtre por chamada/linha temática e defina aprovação para exposição.
                </p>

                <div className="mt-4 grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                    <input
                      ref={searchRef}
                      value={busca}
                      onChange={(event) => setBusca(event.target.value)}
                      placeholder="Buscar por título, autor, e-mail ou linha..."
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/60 focus:ring-2 focus:ring-amber-300"
                      aria-label="Buscar no ranking"
                    />
                  </div>

                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                    <select
                      value={filtroChamada}
                      onChange={(event) => {
                        setFiltroChamada(event.target.value);
                        setFiltroLinha("__all__");
                      }}
                      className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-11 pr-4 text-sm text-white outline-none focus:ring-2 focus:ring-amber-300"
                      aria-label="Filtrar por chamada"
                    >
                      <option className="text-slate-900" value="__all__">
                        Todas as chamadas
                      </option>
                      {chamadas.map((chamada) => (
                        <option className="text-slate-900" key={chamada} value={chamada}>
                          {chamada}
                        </option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={filtroLinha}
                    onChange={(event) => setFiltroLinha(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none focus:ring-2 focus:ring-amber-300"
                    aria-label="Filtrar por linha temática"
                  >
                    <option className="text-slate-900" value="__all__">
                      Todas as linhas
                    </option>
                    {linhas.map((linha) => (
                      <option className="text-slate-900" key={linha} value={linha}>
                        {linha}
                      </option>
                    ))}
                  </select>

                  <Button tone="ghost" icon={RefreshCw} onClick={limparFiltros}>
                    Limpar
                  </Button>
                </div>
              </div>

              <button
                type="button"
                ref={closeRef}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                aria-label="Fechar ranking"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {erro || mensagem || `${stats.total} submissões no ranking.`}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniStat icon={Trophy} label="Resultados" value={stats.total} tone="amber" />
              <MiniStat
                icon={Star}
                label="Média"
                value={stats.media == null ? "—" : fmtNum(stats.media, 1)}
                tone="violet"
              />
              <MiniStat
                icon={Award}
                label="Exposição"
                value={stats.aprovadasExposicao}
                tone="emerald"
              />
              <MiniStat
                icon={CheckCircle2}
                label="Oral"
                value={stats.aprovadasOral}
                tone="emerald"
              />
            </div>

            <div className="mt-4 space-y-3">
              <ConfirmBox
                item={confirmacao.item}
                action={confirmacao.action}
                busy={Boolean(workingId)}
                onCancel={() => setConfirmacao({ item: null, action: null })}
                onConfirm={executarAcao}
              />

              {erro ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  <div className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                    <span>{erro}</span>
                  </div>
                </div>
              ) : null}

              {mensagem ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <div className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                    <span>{mensagem}</span>
                  </div>
                </div>
              ) : null}
            </div>

            {ordenados.length === 0 ? (
              <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Nenhuma submissão encontrada para os filtros atuais.
              </div>
            ) : (
              <>
                <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1180px] text-sm">
                      <caption className="sr-only">Ranking de submissões por nota</caption>

                      <thead className="bg-slate-950 text-white">
                        <tr>
                          <th className="w-20 p-4 text-left">#</th>
                          <th className="p-4 text-left">Título</th>
                          <th className="p-4 text-left">Autor</th>
                          <th className="p-4 text-left">Chamada</th>
                          <th className="p-4 text-left">Linha</th>
                          <th className="w-28 p-4 text-center">Nota</th>
                          <th className="w-56 p-4 text-center">Status</th>
                          <th className="w-72 p-4 text-center">Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ordenados.map((item) => {
                          const okExpo = hasAprovacaoExposicao(item);
                          const okOral = hasAprovacaoOral(item);
                          const busy = workingId === item.id;

                          return (
                            <tr
                              key={item.id}
                              className="border-b border-slate-100 transition hover:bg-amber-50/60 dark:border-slate-800 dark:hover:bg-slate-800/40"
                            >
                              <td className="p-4 align-top">
                                <RankBadge rank={item._rank} />
                              </td>

                              <td className="p-4 align-top">
                                <p className="line-clamp-2 font-black text-slate-900 dark:text-white">
                                  {fmt(item.titulo)}
                                </p>
                              </td>

                              <td className="p-4 align-top">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  {fmt(item.autor_nome)}
                                </p>
                                <p className="mt-1 break-all text-xs text-slate-500">
                                  {fmt(item.autor_email)}
                                </p>
                              </td>

                              <td className="p-4 align-top text-slate-700 dark:text-slate-300">
                                {fmt(item.chamada_titulo)}
                              </td>

                              <td className="p-4 align-top text-slate-700 dark:text-slate-300">
                                {fmt(item.linha_tematica_nome || item.linha_tematica_codigo)}
                              </td>

                              <td className="p-4 text-center align-top">
                                <span className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-3 py-1.5 text-sm font-black text-white">
                                  {fmtNum(item._nota, 1)}
                                </span>
                              </td>

                              <td className="p-4 text-center align-top">
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  <StatusBadge status={item.status} />
                                  {okExpo ? (
                                    <Badge tone="emerald" icon={CheckCircle2}>
                                      Exposição
                                    </Badge>
                                  ) : null}
                                  {okOral ? (
                                    <Badge tone="emerald" icon={CheckCircle2}>
                                      Oral
                                    </Badge>
                                  ) : null}
                                </div>
                              </td>

                              <td className="p-4 align-top">
                                <div className="flex flex-wrap justify-center gap-2">
                                  <Button
                                    tone="emerald"
                                    icon={CheckCircle2}
                                    loading={busy && confirmacao.action === "aprovar_exposicao"}
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirmacao({
                                        item,
                                        action: "aprovar_exposicao",
                                      })
                                    }
                                  >
                                    Exposição
                                  </Button>

                                  <Button
                                    tone="rose"
                                    icon={XCircle}
                                    loading={busy && confirmacao.action === "reprovar"}
                                    disabled={busy}
                                    onClick={() =>
                                      setConfirmacao({
                                        item,
                                        action: "reprovar",
                                      })
                                    }
                                  >
                                    Reprovar
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 lg:hidden">
                  {ordenados.map((item) => {
                    const okExpo = hasAprovacaoExposicao(item);
                    const okOral = hasAprovacaoOral(item);
                    const busy = workingId === item.id;

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400" />

                        <div className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <RankBadge rank={item._rank} />

                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Nota
                              </p>
                              <p className="text-3xl font-black text-slate-900 dark:text-white">
                                {fmtNum(item._nota, 1)}
                              </p>
                            </div>
                          </div>

                          <div>
                            <h4 className="line-clamp-3 font-black text-slate-900 dark:text-white">
                              {fmt(item.titulo)}
                            </h4>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                              {fmt(item.chamada_titulo)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {fmt(item.linha_tematica_nome || item.linha_tematica_codigo)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {fmt(item.autor_nome)}
                            </p>
                            <p className="break-all text-xs text-slate-500">
                              {fmt(item.autor_email)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <StatusBadge status={item.status} />
                            {okExpo ? (
                              <Badge tone="emerald" icon={CheckCircle2}>
                                Exposição
                              </Badge>
                            ) : null}
                            {okOral ? (
                              <Badge tone="emerald" icon={CheckCircle2}>
                                Oral
                              </Badge>
                            ) : null}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button
                              tone="emerald"
                              icon={CheckCircle2}
                              loading={busy && confirmacao.action === "aprovar_exposicao"}
                              disabled={busy}
                              onClick={() =>
                                setConfirmacao({
                                  item,
                                  action: "aprovar_exposicao",
                                })
                              }
                              className="w-full"
                            >
                              Aprovar exposição
                            </Button>

                            <Button
                              tone="rose"
                              icon={XCircle}
                              loading={busy && confirmacao.action === "reprovar"}
                              disabled={busy}
                              onClick={() =>
                                setConfirmacao({
                                  item,
                                  action: "reprovar",
                                })
                              }
                              className="w-full"
                            >
                              Reprovar
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </div>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              A aprovação para apresentação oral é tratada no ranking oral, para manter separação clara entre etapas.
            </p>

            <Button tone="ghost" onClick={onClose}>
              Fechar
            </Button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

RankingModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  itens: PropTypes.arrayOf(PropTypes.object),
  onStatusChange: PropTypes.func,
};