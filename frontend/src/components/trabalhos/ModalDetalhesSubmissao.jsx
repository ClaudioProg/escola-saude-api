// 📁 src/components/trabalhos/ModalDetalhesSubmissao.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal administrativo de detalhes de submissão.
//
// Contratos oficiais usados:
// - GET   /api/submissao/:id
// - GET   /api/submissao/:id/avaliacao
// - GET   /api/submissao/:id/poster
// - PATCH /api/submissao/admin/:id/nota-visivel
//
// Diretrizes v2.0:
// - sem /admin/submissao;
// - sem /submissao/:id/banner;
// - sem POST para nota-visivel;
// - sem status legado "submetido", "aprovado_exposicao", "reprovado";
// - campo textual oficial "consideracao";
// - arquivo principal via /submissao/:id/poster;
// - sem toast direto;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - anti-fuso sem new Date("YYYY-MM-DD").

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Layers3,
  Loader2,
  Paperclip,
  ShieldAlert,
  Star,
  UserRound,
  X,
} from "lucide-react";

import api, { apiGetFile, downloadBlob } from "../../services/api";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data ?? fallback;
  }

  if (
    response?.data &&
    typeof response.data === "object" &&
    "ok" in response.data &&
    "data" in response.data
  ) {
    return response.data.data ?? fallback;
  }

  return response?.data ?? response ?? fallback;
}

function getMessage(error, fallback) {
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

function fmtNum(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function fmtDateTimeBR(input) {
  const text = String(input || "").trim();

  if (!text) return "—";

  const dateTime = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/.exec(text);

  if (dateTime) {
    return `${dateTime[3]}/${dateTime[2]}/${dateTime[1]} ${dateTime[4]}:${dateTime[5]}`;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  return text;
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

function hasArquivo(row) {
  return Boolean(
      row?.poster_arquivo_id ||
      row?.poster_nome ||
      row?.arquivo_nome ||
      row?.nome_original ||
      row?._hasAnexo ||
      row?.has_anexo ||
      row?.tem_anexo ||
      row?.possui_anexo
  );
}

function okExposicao(row) {
  const status = normalizarStatus(row?.status);
  const escrita = String(row?.status_escrita || "").toLowerCase();

  return (
    escrita === "aprovado" ||
    status === "aprovada_exposicao" ||
    status === "aprovada" ||
    Boolean(row?._exposicao_aprovada)
  );
}

function okOral(row) {
  const status = normalizarStatus(row?.status);
  const oral = String(row?.status_oral || "").toLowerCase();

  return (
    oral === "aprovado" ||
    status === "aprovada_oral" ||
    status === "aprovada" ||
    Boolean(row?._oral_aprovada)
  );
}

function agruparAvaliacao(itens = []) {
  const map = new Map();

  for (const item of itens) {
    const avaliadorId = item.avaliador_id ?? "sem_avaliador";
    const tipo = item.tipo || "sem_tipo";
    const key = `${avaliadorId}-${tipo}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        avaliador_id: avaliadorId,
        avaliador_nome: item.avaliador_nome || `Avaliador #${avaliadorId}`,
        tipo,
        itens: [],
        total: 0,
        media: null,
      });
    }

    const group = map.get(key);
    const nota = Number(item.nota);

    group.itens.push(item);

    if (Number.isFinite(nota)) {
      group.total += nota;
    }
  }

  return Array.from(map.values()).map((group) => {
    const notas = group.itens
      .map((item) => Number(item.nota))
      .filter((nota) => Number.isFinite(nota));

    const media =
      notas.length > 0
        ? notas.reduce((sum, nota) => sum + nota, 0) / notas.length
        : null;

    return {
      ...group,
      total: Number(group.total.toFixed(2)),
      media: media == null ? null : Number(media.toFixed(2)),
    };
  });
}

function getArquivoNome(row) {
  return (
    row?.banner_nome ||
    row?.poster_nome ||
    row?.arquivo_nome ||
    row?.nome_original ||
    row?.banner?.nome_original ||
    row?.banner?.filename ||
    "Arquivo principal"
  );
}

/* =========================================================================
   UI
=========================================================================== */

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
      "bg-gradient-to-r from-violet-700 via-fuchsia-700 to-rose-700 text-white shadow-lg shadow-violet-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    amber:
      "bg-amber-600 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-700",
    violet:
      "bg-violet-700 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-800",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
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

function StatusBadge({ status }) {
  const value = normalizarStatus(status);

  const config = {
    rascunho: { tone: "slate", icon: FileText },
    submetida: { tone: "blue", icon: FileText },
    em_avaliacao: { tone: "amber", icon: Loader2 },
    aprovada_exposicao: { tone: "emerald", icon: CheckCircle2 },
    aprovada_oral: { tone: "emerald", icon: CheckCircle2 },
    aprovada: { tone: "emerald", icon: CheckCircle2 },
    reprovada: { tone: "rose", icon: AlertCircle },
    cancelada: { tone: "rose", icon: AlertCircle },
    indefinido: { tone: "slate", icon: AlertCircle },
  };

  const item = config[value] || config.indefinido;

  return (
    <Badge tone={item.tone} icon={item.icon}>
      {statusLabel(value)}
    </Badge>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 dark:border-slate-800",
    amber: "border-amber-200 dark:border-amber-900/50",
    blue: "border-blue-200 dark:border-blue-900/50",
    emerald: "border-emerald-200 dark:border-emerald-900/50",
    violet: "border-violet-200 dark:border-violet-900/50",
    rose: "border-rose-200 dark:border-rose-900/50",
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
          <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, tone = "violet" }) {
  const colors = {
    violet: "text-violet-700 dark:text-violet-300",
    amber: "text-amber-700 dark:text-amber-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    blue: "text-blue-700 dark:text-blue-300",
    rose: "text-rose-700 dark:text-rose-300",
    slate: "text-slate-700 dark:text-slate-300",
  };

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:p-5">
      <h4 className={cx("mb-4 flex items-center gap-2 text-lg font-black", colors[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {title}
      </h4>

      {children}
    </section>
  );
}

function TextBlock({ label, value }) {
  if (!value) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <h5 className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </h5>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {fmt(value)}
      </p>
    </div>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function ModalDetalhesSubmissao({
  open,
  onClose,
  submissao,
  onDetectAnexo,
}) {
  const titleId = useId();
  const descId = useId();
  const closeButtonRef = useRef(null);

  const [full, setFull] = useState(null);
  const [avaliacaoPayload, setAvaliacaoPayload] = useState(null);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [baixandoArquivo, setBaixandoArquivo] = useState(false);
  const [togglingNota, setTogglingNota] = useState(false);

  const data = useMemo(
    () => ({
      ...(submissao || {}),
      ...(full || {}),
    }),
    [submissao, full]
  );

  const avaliacaoItens = useMemo(() => {
    const itens = avaliacaoPayload?.itens;
    return Array.isArray(itens) ? itens : [];
  }, [avaliacaoPayload]);

  const avaliadoresAgrupados = useMemo(
    () => agruparAvaliacao(avaliacaoItens),
    [avaliacaoItens]
  );

  const notaVisivel = Boolean(
    avaliacaoPayload?.nota_visivel ??
      data?.nota_visivel ??
      false
  );

  const totais = avaliacaoPayload?.totais || {};

  const notaFinal = useMemo(() => {
    const candidatos = [
      data?.nota_final,
      data?.nota_media,
      totais?.nota_final,
      totais?.nota_media,
      avaliadoresAgrupados.length > 0
        ? avaliadoresAgrupados.reduce((sum, item) => sum + Number(item.media || 0), 0) /
          avaliadoresAgrupados.length
        : null,
    ];

    const value = candidatos.find((item) => Number.isFinite(Number(item)));

    return value == null ? null : Number(value);
  }, [data?.nota_final, data?.nota_media, totais, avaliadoresAgrupados]);

  const temArquivo = hasArquivo(data);
  const arquivoNome = getArquivoNome(data);
  const atualizadoEm =
    data?.atualizado_em ||
    data?.updated_at ||
    data?.criado_em ||
    data?.created_at ||
    null;

  const carregar = useCallback(async () => {
    if (!open || !submissao?.id) return;

    setLoading(true);
    setErro("");
    setMensagem("");

    try {
      const [detalheResponse, avaliacaoResponse] = await Promise.allSettled([
        api.get(`/submissao/${submissao.id}`),
        api.get(`/submissao/${submissao.id}/avaliacao`),
      ]);

      if (detalheResponse.status === "rejected") {
        throw detalheResponse.reason;
      }

      const detalhe = unwrap(detalheResponse.value, null);
      setFull(detalhe || {});

      if (hasArquivo(detalhe)) {
        onDetectAnexo?.(submissao.id, true);
      }

      if (avaliacaoResponse.status === "fulfilled") {
        setAvaliacaoPayload(unwrap(avaliacaoResponse.value, null));
      } else {
        setAvaliacaoPayload(null);
      }
    } catch (error) {
      setErro(getMessage(error, "Não foi possível carregar os detalhes da submissão."));
      setFull(null);
      setAvaliacaoPayload(null);
    } finally {
      setLoading(false);
    }
  }, [open, submissao?.id, onDetectAnexo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => {
      closeButtonRef.current?.focus?.();
    }, 80);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  async function baixarArquivoPrincipal() {
    if (!data?.id) return;

    setBaixandoArquivo(true);
    setErro("");
    setMensagem("");

    try {
      const { blob, filename } = await apiGetFile(`/submissao/${data.id}/poster`);
      downloadBlob(filename || arquivoNome || `arquivo-submissao-${data.id}`, blob);
      setMensagem("Arquivo baixado com sucesso.");
    } catch (error) {
      setErro(getMessage(error, "Não foi possível baixar o arquivo principal."));
    } finally {
      setBaixandoArquivo(false);
    }
  }

  async function toggleNotaVisivel() {
    if (!data?.id) return;

    setTogglingNota(true);
    setErro("");
    setMensagem("");

    try {
      const novo = !notaVisivel;

      await api.patch(`/submissao/admin/${data.id}/nota-visivel`, {
        visivel: novo,
      });

      setAvaliacaoPayload((current) => ({
        ...(current || {}),
        nota_visivel: novo,
      }));

      setFull((current) => ({
        ...(current || {}),
        nota_visivel: novo,
      }));

      setMensagem(
        novo
          ? "Nota liberada para visualização do autor."
          : "Nota ocultada da visualização do autor."
      );
    } catch (error) {
      setErro(getMessage(error, "Não foi possível alterar a visibilidade da nota."));
    } finally {
      setTogglingNota(false);
    }
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
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,.22),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <StatusBadge status={data?.status} />
                  {okExposicao(data) ? (
                    <Badge tone="emerald" icon={BadgeCheck}>
                      Exposição
                    </Badge>
                  ) : null}
                  {okOral(data) ? (
                    <Badge tone="emerald" icon={BadgeCheck}>
                      Oral
                    </Badge>
                  ) : null}
                </div>

                <h3
                  id={titleId}
                  className="line-clamp-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  {fmt(data?.titulo, "Detalhes da submissão")}
                </h3>

                <p
                  id={descId}
                  className="mt-2 max-w-4xl text-sm leading-relaxed text-white/75"
                >
                  ID #{fmt(data?.id)} · {fmt(data?.chamada_titulo || data?.chamada)} · Atualizado em{" "}
                  {fmtDateTimeBR(atualizadoEm)}
                </p>
              </div>

              <button
                type="button"
                ref={closeButtonRef}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                aria-label="Fechar detalhes da submissão"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {loading ? "Carregando detalhes." : erro ? erro : "Detalhes carregados."}
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Carregando detalhes da submissão...
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
                {erro ? (
                  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    <div className="flex gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{erro}</span>
                    </div>
                  </div>
                ) : null}

                {mensagem ? (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                      <span>{mensagem}</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat
                    icon={BadgeCheck}
                    label="Status"
                    value={<StatusBadge status={data?.status} />}
                    tone="blue"
                  />
                  <MiniStat
                    icon={Star}
                    label="Nota final"
                    value={notaFinal == null ? "—" : `${fmtNum(notaFinal, 1)} / 10`}
                    tone="amber"
                  />
                  <MiniStat
                    icon={UserRound}
                    label="Avaliadores"
                    value={avaliadoresAgrupados.length || "—"}
                    tone="violet"
                  />
                  <MiniStat
                    icon={Paperclip}
                    label="Arquivo"
                    value={temArquivo ? "Sim" : "Não"}
                    tone={temArquivo ? "emerald" : "slate"}
                  />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
                  <main className="space-y-5">
                    <Section title="Texto do trabalho" icon={FileText} tone="violet">
                      {[
                        ["Introdução", data?.introducao],
                        ["Objetivos", data?.objetivos],
                        ["Método / descrição da prática", data?.metodo],
                        ["Resultados / impactos", data?.resultados],
                        ["Considerações finais", data?.consideracao],
                        ["Bibliografia", data?.bibliografia],
                      ].some(([, value]) => Boolean(value)) ? (
                        <div className="space-y-3">
                          <TextBlock label="Introdução" value={data?.introducao} />
                          <TextBlock label="Objetivos" value={data?.objetivos} />
                          <TextBlock label="Método / descrição da prática" value={data?.metodo} />
                          <TextBlock label="Resultados / impactos" value={data?.resultados} />
                          <TextBlock label="Considerações finais" value={data?.consideracao} />
                          <TextBlock label="Bibliografia" value={data?.bibliografia} />
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Nenhum texto detalhado disponível para esta submissão.
                        </p>
                      )}
                    </Section>

                    <Section title="Avaliações" icon={BarChart3} tone="amber">
                      {avaliadoresAgrupados.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          Ainda não há notas registradas para esta submissão.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {avaliadoresAgrupados.map((grupo) => (
                            <div
                              key={grupo.key}
                              className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <h5 className="font-black text-slate-900 dark:text-white">
                                    {grupo.avaliador_nome}
                                  </h5>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge tone={grupo.tipo === "oral" ? "amber" : "violet"}>
                                      {grupo.tipo === "oral" ? "Avaliação oral" : "Avaliação escrita"}
                                    </Badge>
                                    <Badge tone="slate">
                                      Média {grupo.media == null ? "—" : fmtNum(grupo.media, 2)}
                                    </Badge>
                                    <Badge tone="slate">
                                      Total {fmtNum(grupo.total, 2)}
                                    </Badge>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-2">
                                {grupo.itens.map((item) => (
                                  <div
                                    key={item.id || `${grupo.key}-${item.criterio_id}`}
                                    className="rounded-2xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-100">
                                          {item.criterio_titulo || `Critério #${item.criterio_id}`}
                                        </p>
                                        {item.comentarios ? (
                                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500 dark:text-slate-400">
                                            {item.comentarios}
                                          </p>
                                        ) : null}
                                      </div>

                                      <div className="text-left sm:text-right">
                                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                                          Nota
                                        </p>
                                        <p className="text-xl font-black text-slate-900 dark:text-white">
                                          {fmtNum(item.nota, 2)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>
                  </main>

                  <aside className="space-y-4">
                    <Section title="Arquivo principal" icon={Paperclip} tone="emerald">
                      {temArquivo ? (
                        <div className="space-y-3">
                          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                            <p className="font-black text-emerald-800 dark:text-emerald-200">
                              Arquivo disponível
                            </p>
                            <p className="mt-1 break-words text-sm text-emerald-700 dark:text-emerald-300">
                              {arquivoNome}
                            </p>
                          </div>

                          <Button
                            tone="violet"
                            icon={Download}
                            loading={baixandoArquivo}
                            onClick={baixarArquivoPrincipal}
                            className="w-full"
                          >
                            Baixar arquivo
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          Nenhum arquivo principal detectado para esta submissão.
                        </div>
                      )}
                    </Section>

                    <Section title="Visibilidade da nota" icon={Eye} tone="blue">
                      {avaliadoresAgrupados.length > 0 ? (
                        <div className="space-y-3">
                          <div
                            className={cx(
                              "rounded-3xl border p-4 text-sm",
                              notaVisivel
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {notaVisivel ? (
                                <BadgeCheck className="mt-0.5 h-4 w-4 flex-none" />
                              ) : (
                                <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
                              )}
                              <span>
                                {notaVisivel
                                  ? "A nota está visível para o autor."
                                  : "A nota ainda está oculta para o autor."}
                              </span>
                            </div>
                          </div>

                          <Button
                            tone={notaVisivel ? "slate" : "amber"}
                            icon={notaVisivel ? EyeOff : Eye}
                            loading={togglingNota}
                            onClick={toggleNotaVisivel}
                            className="w-full"
                          >
                            {notaVisivel ? "Ocultar do autor" : "Liberar ao autor"}
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                          A liberação da nota ficará disponível após registro de avaliação.
                        </p>
                      )}
                    </Section>

                    <Section title="Resumo" icon={Layers3} tone="slate">
                      <dl className="space-y-3 text-sm">
                        <InfoRow label="ID" value={`#${fmt(data?.id)}`} />
                        <InfoRow label="Chamada" value={fmt(data?.chamada_titulo || data?.chamada)} />
                        <InfoRow label="Linha" value={fmt(data?.linha_tematica_nome || data?.linha_tematica_codigo)} />
                        <InfoRow label="Autor" value={fmt(data?.autor_nome)} />
                        <InfoRow label="E-mail" value={fmt(data?.autor_email)} />
                        <InfoRow label="Atualizado em" value={fmtDateTimeBR(atualizadoEm)} />
                      </dl>
                    </Section>
                  </aside>
                </div>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-end">
                <Button tone="ghost" onClick={onClose}>
                  Fechar
                </Button>

                {temArquivo ? (
                  <Button
                    tone="violet"
                    icon={Download}
                    loading={baixandoArquivo}
                    onClick={baixarArquivoPrincipal}
                  >
                    Baixar arquivo
                  </Button>
                ) : null}

                {avaliadoresAgrupados.length > 0 ? (
                  <Button
                    tone={notaVisivel ? "slate" : "amber"}
                    icon={notaVisivel ? EyeOff : Eye}
                    loading={togglingNota}
                    onClick={toggleNotaVisivel}
                  >
                    {notaVisivel ? "Ocultar nota" : "Liberar nota"}
                  </Button>
                ) : null}
              </footer>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0 dark:border-slate-800">
      <dt className="font-semibold text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-bold text-slate-800 dark:text-slate-100">
        {value || "—"}
      </dd>
    </div>
  );
}

ModalDetalhesSubmissao.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  submissao: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  }),
  onDetectAnexo: PropTypes.func,
};