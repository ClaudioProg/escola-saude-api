// 📁 src/components/trabalhos/ModalVerEdital.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal público/autenticado de visualização da chamada/edital de trabalhos.
//
// Contratos oficiais usados:
// - GET /api/chamada/:id
// - GET /api/chamada/:id/modelo-banner
// - GET /api/chamada/:id/modelo-oral
//
// Diretrizes v2.0:
// - sem /api/chamadas;
// - sem /api/chamadas/:id/modelo-banner;
// - sem helper local duplicado de downloadBlob;
// - sem Modal antigo fora do padrão;
// - anti-fuso sem new Date("YYYY-MM-DD");
// - markdown seguro para textos institucionais;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - dark mode.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Info,
  Layers,
  ListChecks,
  Loader2,
  Mic,
  ScrollText,
  ShieldCheck,
  Sparkles,
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

function formatDateOnly(value) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!match) return text || "—";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTimeOnly(value) {
  const text = String(value || "").trim();
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(text);

  if (!match) return text || "";

  return `${match[1]}:${match[2]}`;
}

function formatYearMonth(value) {
  const text = String(value || "").trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text);

  if (!match) return text || "—";

  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

  return `${meses[Number(match[2]) - 1]}/${match[1]}`;
}

function formatDateTimeWall(value) {
  const text = String(value || "").trim();

  if (!text) return "—";

  const separatedDateTime = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/.exec(text);

  if (separatedDateTime) {
    return `${separatedDateTime[3]}/${separatedDateTime[2]}/${separatedDateTime[1]} às ${separatedDateTime[4]}:${separatedDateTime[5]}`;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  return text;
}

function buildPrazoFinal(chamada) {
  if (chamada?.prazo_final_date && chamada?.prazo_final_time) {
    const data = formatDateOnly(chamada.prazo_final_date);
    const hora = formatTimeOnly(chamada.prazo_final_time);

    return hora ? `${data} às ${hora}` : data;
  }

  return formatDateTimeWall(chamada?.prazo_final_br);
}

function normalizeDatesInsideText(text) {
  if (!text || typeof text !== "string") return text;

  return text
    .replace(
      /(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/g,
      (_, year, month, day, hour, minute) => `${day}/${month}/${year} ${hour}:${minute}`
    )
    .replace(
      /(\d{4})-(\d{2})-(\d{2})(?![\d:])/g,
      (_, year, month, day) => `${day}/${month}/${year}`
    )
    .replace(
      /(\d{4})-(0[1-9]|1[0-2])/g,
      (_, year, month) => `${month}/${year}`
    );
}

function formatLimitKey(key) {
  const labels = {
    titulo: "Título",
    introducao: "Introdução",
    objetivos: "Objetivos",
    metodo: "Método/descrição",
    resultados: "Resultados",
    consideracao: "Considerações finais",
    bibliografia: "Bibliografia",
  };

  return labels[key] || key;
}

function hasArrayItems(value) {
  return Array.isArray(value) && value.length > 0;
}

/* =========================================================================
   UI
=========================================================================== */

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  icon: Icon,
  loading = false,
  tone = "slate",
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-700 text-white shadow-lg shadow-violet-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    violet:
      "bg-violet-700 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-800",
    amber:
      "bg-amber-600 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-700",
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

function MiniStat({ label, value, icon: Icon, tone = "violet" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <Icon
          className={cx(
            "h-4 w-4",
            tone === "emerald" && "text-emerald-500",
            tone === "amber" && "text-amber-500",
            tone === "cyan" && "text-cyan-500",
            tone === "violet" && "text-violet-500"
          )}
          aria-hidden="true"
        />
      </div>

      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, tone = "violet" }) {
  const color = {
    violet: "text-violet-700 dark:text-violet-300",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-blue-700 dark:text-blue-300",
    rose: "text-rose-700 dark:text-rose-300",
    slate: "text-slate-700 dark:text-slate-300",
  }[tone];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h3 className={cx("mb-4 flex items-center gap-2 text-lg font-black", color)}>
        <Icon className="h-5 w-5" aria-hidden="true" />
        {title}
      </h3>

      {children}
    </section>
  );
}

function MarkdownBox({ children }) {
  return (
    <div
      className={cx(
        "prose prose-sm max-w-none dark:prose-invert sm:prose-base",
        "prose-headings:font-black prose-a:text-violet-700 dark:prose-a:text-violet-300",
        "prose-li:marker:text-violet-500"
      )}
    >
      <ReactMarkdown>{normalizeDatesInsideText(children || "")}</ReactMarkdown>
    </div>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function ModalVerEdital({ isOpen = true, chamadaId, onClose }) {
  const titleId = useId();
  const descId = useId();
  const closeButtonRef = useRef(null);

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [baixandoBanner, setBaixandoBanner] = useState(false);
  const [baixandoOral, setBaixandoOral] = useState(false);

  const chamada = dados?.chamada || dados || {};
  const linhas = Array.isArray(dados?.linhas) ? dados.linhas : [];
  const criterios = Array.isArray(dados?.criterios) ? dados.criterios : [];
  const criteriosOrais = Array.isArray(dados?.criterios_orais)
    ? dados.criterios_orais
    : [];
  const limites =
    dados?.limites && typeof dados.limites === "object"
      ? dados.limites
      : chamada?.limites && typeof chamada.limites === "object"
        ? chamada.limites
        : {};

  const prazoFinal = useMemo(() => buildPrazoFinal(chamada), [chamada]);

  const periodoExperiencia = useMemo(() => {
    const inicio = formatYearMonth(chamada?.periodo_experiencia_inicio);
    const fim = formatYearMonth(chamada?.periodo_experiencia_fim);

    if (inicio === "—" && fim === "—") return "—";

    return `${inicio} — ${fim}`;
  }, [chamada?.periodo_experiencia_inicio, chamada?.periodo_experiencia_fim]);

  const minis = useMemo(
    () => ({
      linhas: linhas.length,
      escrita: criterios.length,
      oral: criteriosOrais.length,
      coautores: chamada?.max_coautores ?? "—",
      aceitaPoster: Boolean(chamada?.aceita_poster),
    }),
    [linhas.length, criterios.length, criteriosOrais.length, chamada]
  );

  const carregar = useCallback(async () => {
    if (!chamadaId) return;

    setLoading(true);
    setErro("");

    try {
      const response = await api.get(`/chamada/${chamadaId}`);
      setDados(unwrap(response, null));
    } catch (error) {
      setErro(getMessage(error, "Não foi possível carregar o edital da chamada."));
    } finally {
      setLoading(false);
    }
  }, [chamadaId]);

  useEffect(() => {
    if (isOpen) {
      carregar();
    }
  }, [isOpen, carregar]);

  useEffect(() => {
    if (!isOpen) return undefined;

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
  }, [isOpen, onClose]);

  async function baixarModeloBanner() {
    if (!chamadaId) return;

    setBaixandoBanner(true);
    setErro("");

    try {
      const { blob, filename } = await apiGetFile(`/chamada/${chamadaId}/modelo-banner`);
      downloadBlob(filename || `modelo-banner-chamada-${chamadaId}.pptx`, blob);
    } catch (error) {
      setErro(getMessage(error, "Não foi possível baixar o modelo de pôster."));
    } finally {
      setBaixandoBanner(false);
    }
  }

  async function baixarModeloOral() {
    if (!chamadaId) return;

    setBaixandoOral(true);
    setErro("");

    try {
      const { blob, filename } = await apiGetFile(`/chamada/${chamadaId}/modelo-oral`);
      downloadBlob(filename || `modelo-oral-chamada-${chamadaId}.pptx`, blob);
    } catch (error) {
      setErro(getMessage(error, "Não foi possível baixar o modelo de apresentação oral."));
    } finally {
      setBaixandoOral(false);
    }
  }

  if (!isOpen) return null;

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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,.18),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone="violet">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Edital institucional
                  </Badge>
                  {chamada?.publicado ? (
                    <Badge tone="emerald">Publicado</Badge>
                  ) : (
                    <Badge tone="slate">Não publicado</Badge>
                  )}
                </div>

                <h2
                  id={titleId}
                  className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  <FileText className="h-5 w-5" aria-hidden="true" />
                  Edital da chamada
                </h2>

                <p
                  id={descId}
                  className="mt-2 line-clamp-2 max-w-4xl text-sm leading-relaxed text-white/75"
                >
                  {chamada?.titulo || "Carregando chamada..."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/80">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Prazo final: <strong>{prazoFinal}</strong>
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Experiência: <strong>{periodoExperiencia}</strong>
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Coautores: <strong>{minis.coautores}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                ref={closeButtonRef}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300"
                aria-label="Fechar edital"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {loading ? "Carregando edital." : erro ? erro : "Edital carregado."}
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
                <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Carregando edital...
                </p>
              </div>
            </div>
          ) : erro ? (
            <div className="bg-slate-50 p-5 dark:bg-slate-950 sm:p-6">
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <strong className="block text-base">Não foi possível carregar</strong>
                <span className="mt-1 block">{erro}</span>
              </div>

              <div className="mt-5 flex justify-end">
                <Button tone="primary" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniStat
                    label="Linhas temáticas"
                    value={minis.linhas}
                    icon={Layers}
                    tone="violet"
                  />
                  <MiniStat
                    label="Critérios escritos"
                    value={minis.escrita}
                    icon={CheckCircle2}
                    tone="emerald"
                  />
                  <MiniStat
                    label="Critérios orais"
                    value={minis.oral}
                    icon={Mic}
                    tone="amber"
                  />
                  <MiniStat
                    label="Arquivo/pôster"
                    value={minis.aceitaPoster ? "Sim" : "Não"}
                    icon={ClipboardList}
                    tone="cyan"
                  />
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                  <main className="space-y-5">
                    {chamada?.descricao_markdown ? (
                      <Section title="Normas e descrição" icon={ScrollText} tone="violet">
                        <MarkdownBox>{chamada.descricao_markdown}</MarkdownBox>
                      </Section>
                    ) : null}

                    {hasArrayItems(linhas) ? (
                      <Section title="Linhas temáticas" icon={Layers} tone="violet">
                        <div className="space-y-3">
                          {linhas.map((linha, index) => (
                            <div
                              key={linha?.id || `${linha?.nome || "linha"}-${index}`}
                              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <h4 className="font-black text-slate-900 dark:text-white">
                                {linha?.nome || `Linha ${index + 1}`}
                              </h4>
                              {linha?.descricao ? (
                                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                  {linha.descricao}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </Section>
                    ) : null}

                    {hasArrayItems(criterios) ? (
                      <Section
                        title="Critérios de avaliação escrita"
                        icon={CheckCircle2}
                        tone="emerald"
                      >
                        <CriteriaList criterios={criterios} />
                      </Section>
                    ) : null}

                    {hasArrayItems(criteriosOrais) ? (
                      <Section
                        title="Critérios de apresentação oral"
                        icon={Mic}
                        tone="amber"
                      >
                        <CriteriaList criterios={criteriosOrais} />
                      </Section>
                    ) : null}

                    {chamada?.premiacao_texto ? (
                      <Section title="Premiação" icon={Award} tone="rose">
                        <MarkdownBox>{chamada.premiacao_texto}</MarkdownBox>
                      </Section>
                    ) : null}

                    {chamada?.disposicao_finais_texto ? (
                      <Section title="Disposições finais" icon={FileText} tone="slate">
                        <MarkdownBox>{chamada.disposicao_finais_texto}</MarkdownBox>
                      </Section>
                    ) : null}
                  </main>

                  <aside className="space-y-4">
                    <Section title="Informações rápidas" icon={Info} tone="blue">
                      <dl className="space-y-3 text-sm">
                        <InfoRow label="Prazo final" value={prazoFinal} />
                        <InfoRow label="Período da experiência" value={periodoExperiencia} />
                        <InfoRow
                          label="Aceita arquivo/pôster"
                          value={minis.aceitaPoster ? "Sim" : "Não"}
                        />
                        <InfoRow label="Máximo de coautores" value={minis.coautores} />
                      </dl>
                    </Section>

                    {Object.keys(limites).length > 0 ? (
                      <Section title="Limites do formulário" icon={ListChecks} tone="violet">
                        <div className="grid gap-2">
                          {Object.entries(limites).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {formatLimitKey(key)}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {value} caracteres
                              </span>
                            </div>
                          ))}
                        </div>
                      </Section>
                    ) : null}

                    <Section title="Modelos oficiais" icon={Download} tone="violet">
                      <div className="space-y-2">
                        <Button
                          tone="violet"
                          icon={Download}
                          loading={baixandoBanner}
                          onClick={baixarModeloBanner}
                          className="w-full"
                        >
                          Modelo de pôster
                        </Button>

                        <Button
                          tone="amber"
                          icon={Download}
                          loading={baixandoOral}
                          onClick={baixarModeloOral}
                          className="w-full"
                        >
                          Modelo de apresentação oral
                        </Button>

                        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          Caso algum modelo ainda não tenha sido importado pela administração,
                          o sistema exibirá uma mensagem de indisponibilidade.
                        </p>
                      </div>
                    </Section>

                    <Section title="Orientação" icon={Sparkles} tone="cyan">
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        Leia as normas antes de submeter. Após o trabalho entrar em avaliação,
                        alterações pelo autor podem ficar bloqueadas para preservar a rastreabilidade.
                      </p>
                    </Section>
                  </aside>
                </div>
              </div>

              <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-end">
                <Button tone="ghost" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  tone="violet"
                  icon={Download}
                  loading={baixandoBanner}
                  onClick={baixarModeloBanner}
                >
                  Modelo pôster
                </Button>
                <Button
                  tone="amber"
                  icon={Download}
                  loading={baixandoOral}
                  onClick={baixarModeloOral}
                >
                  Modelo oral
                </Button>
              </footer>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CriteriaList({ criterios }) {
  return (
    <div className="space-y-3">
      {criterios.map((criterio, index) => (
        <div
          key={criterio?.id || `${criterio?.titulo || "criterio"}-${index}`}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <h4 className="font-black text-slate-900 dark:text-white">
              {criterio?.titulo || `Critério ${index + 1}`}
            </h4>

            <div className="flex flex-wrap gap-1.5">
              <Badge tone="slate">
                Escala {criterio?.escala_min ?? "—"}–{criterio?.escala_max ?? "—"}
              </Badge>
              <Badge tone="slate">
                Peso {criterio?.peso ?? 1}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
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

ModalVerEdital.propTypes = {
  isOpen: PropTypes.bool,
  chamadaId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onClose: PropTypes.func.isRequired,
};