// ✅ src/pages/HomeEscola.jsx — PREMIUM++
/*
  Melhorias desta versão:
  - Premiumização visual completa da home
  - Badges/meta chips reestruturados com hierarquia real
  - Hero institucional mais elegante
  - Resumo do usuário com section shell premium
  - Faixa institucional (InfoRibbon) integrada
  - Publicações com toolbar, status chips e recarregamento
  - Cards de publicação mais sofisticados
  - Melhor loading / empty / erro
  - Mobile-first / PWA-ready
  - Mantém sanitização com DOMPurify
  - Mantém navegação leve e segura
*/

import { useEffect, useMemo, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import DOMPurify from "dompurify";
import {
  Sparkles,
  FileText,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Star,
  RefreshCw,
  Megaphone,
  Newspaper,
  CalendarDays,
  AlertTriangle,
  Image as ImageIcon,
  BellRing,
  ShieldCheck,
  Activity,
  BadgeCheck,
  Clock3,
  LayoutPanelTop,
  ArrowUpRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Footer from "../components/Footer";
import HeaderHero from "../components/HeaderHero";
import { apiGet } from "../services/api";

/* ────────────────────────────────────────────────────────────── */
/* Utils                                                          */
/* ────────────────────────────────────────────────────────────── */
function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function fmtData(value) {
  const v = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function getHojeLocalYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function useIsDarkClass() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));

    update();

    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

function getStatusInformacao(item) {
  const hoje = getHojeLocalYMD();

  if (!item?.ativo) return "inativa";
  if (item?.data_inicio_exibicao && hoje < item.data_inicio_exibicao) return "agendada";
  if (item?.data_fim_exibicao && hoje > item.data_fim_exibicao) return "expirada";
  return "ativa";
}

function sanitizeHtmlFrontend(html = "") {
  return DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true },
  });
}

function getTipoConfig(tipo) {
  if (tipo === "comunicado") {
    return {
      label: "Comunicado",
      icon: Newspaper,
      accent: "from-sky-500 via-cyan-500 to-teal-500",
      soft:
        "bg-sky-500/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200 border-sky-200/70 dark:border-sky-400/20",
      glow:
        "shadow-[0_0_0_1px_rgba(14,165,233,0.10)]",
    };
  }

  return {
    label: "Destaque",
    icon: Sparkles,
    accent: "from-emerald-500 via-teal-500 to-cyan-500",
    soft:
      "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-400/20",
    glow:
      "shadow-[0_0_0_1px_rgba(16,185,129,0.10)]",
  };
}

function getStatusConfig(status) {
  const map = {
    ativa: {
      label: "Ativa",
      icon: BadgeCheck,
      className:
        "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
    },
    agendada: {
      label: "Agendada",
      icon: Clock3,
      className:
        "border-amber-200/70 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
    },
    expirada: {
      label: "Expirada",
      icon: AlertTriangle,
      className:
        "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
    },
    inativa: {
      label: "Inativa",
      icon: XCircle,
      className:
        "border-slate-200/70 bg-slate-50/80 backdrop-blur-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300",
    },
  };

  return map[status] || map.inativa;
}

function getPeriodoExibicao(item) {
  if (!item?.data_inicio_exibicao && !item?.data_fim_exibicao) return "";

  if (item?.data_inicio_exibicao && item?.data_fim_exibicao) {
    return `${fmtData(item.data_inicio_exibicao)} até ${fmtData(item.data_fim_exibicao)}`;
  }

  if (item?.data_inicio_exibicao) {
    return `A partir de ${fmtData(item.data_inicio_exibicao)}`;
  }

  return `Até ${fmtData(item.data_fim_exibicao)}`;
}

/* ────────────────────────────────────────────────────────────── */
/* Blocos visuais premium                                          */
/* ────────────────────────────────────────────────────────────── */
function SectionShell({
  title,
  subtitle,
  action,
  icon: Icon = Activity,
  gradient = "from-emerald-600 via-teal-500 to-sky-600",
  children,
}) {
  return (
    <section
      className="mt-8 overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-zinc-900/55"
      aria-label={title}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <Icon className="h-3.5 w-3.5" />
              Painel
            </div>

            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100 sm:text-2xl">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-zinc-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

function InfoRibbon() {
  return (
    <div className="rounded-[26px] border border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-4 shadow-sm dark:border-emerald-400/15 dark:from-emerald-950/30 dark:via-zinc-900/40 dark:to-sky-950/20 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-emerald-600/10 p-3 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
          <ShieldCheck className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
            Ambiente institucional, seguro e orientado por dados
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Acompanhe seus principais indicadores de participação e acesse as publicações
            oficiais disponibilizadas pela administração da plataforma.
          </p>
        </div>
      </div>
    </div>
  );
}

function MetaBadge({ icon: Icon, children, className = "" }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide",
        className,
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </span>
  );
}

function GhostAction({ icon: Icon, children, onClick, loading = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5"
    >
      {Icon ? (
        <Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Publicação / destaque                                           */
/* ────────────────────────────────────────────────────────────── */
function DestaqueLongo({
  imgSrc,
  imgAlt,
  titulo,
  subtitulo,
  badge,
  children,
  periodo,
  tipo = "destaque",
  status = "ativa",
}) {
  const reduceMotion = useReducedMotion();
  const [ok, setOk] = useState(true);

  const tipoConfig = getTipoConfig(tipo);
  const statusConfig = getStatusConfig(status);

  const TipoIcon = tipoConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={[
        "group overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-zinc-900/55",
        tipoConfig.glow,
      ].join(" ")}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${tipoConfig.accent}`} />

      <div className="relative">
        {imgSrc && ok ? (
          <img
            src={imgSrc}
            alt={imgAlt}
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] sm:h-64"
            loading="lazy"
            decoding="async"
            onError={() => setOk(false)}
          />
        ) : (
          <div className="grid h-56 w-full place-items-center bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 sm:h-64">
            <div className="px-4 text-center font-semibold text-zinc-600 dark:text-zinc-300">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
              Imagem indisponível
            </div>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <MetaBadge className="border-slate-300/70 bg-slate-100/80 text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            {badge || "Escola da Saúde"}
          </MetaBadge>

          <MetaBadge
            className={
              tipo === "comunicado"
                ? "border-orange-200/80 bg-orange-50/80 text-orange-800 backdrop-blur-sm dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200"
                : "border-sky-200/80 bg-sky-50/80 text-sky-800 backdrop-blur-sm dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200"
            }
          >
            <TipoIcon className="h-3.5 w-3.5" />
            {tipoConfig.label}
          </MetaBadge>

          <MetaBadge className={statusConfig.className}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig.label}
          </MetaBadge>

          {periodo ? (
            <MetaBadge
              icon={CalendarDays}
              className="border-slate-200 bg-slate-50/80 text-slate-700 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
            >
              {periodo}
            </MetaBadge>
          ) : null}
        </div>

        {(titulo || subtitulo) && (
          <div className="mt-5">
            <h3 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.35rem]">
              {titulo}
            </h3>

            {subtitulo ? (
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600 dark:text-zinc-400">
                {subtitulo}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />

        <div className="mt-5 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          {children}
        </div>
      </div>
    </motion.article>
  );
}

function PublicacaoCard({ item }) {
  const htmlSeguro = useMemo(
    () => sanitizeHtmlFrontend(item?.conteudo_html || ""),
    [item?.conteudo_html]
  );

  const status = getStatusInformacao(item);
  const periodo = getPeriodoExibicao(item);

  return (
    <DestaqueLongo
      imgSrc={item?.imagem_url || ""}
      imgAlt={item?.titulo || "Publicação institucional"}
      titulo={item?.titulo || "Informação institucional"}
      subtitulo={item?.subtitulo || ""}
      badge={item?.badge || "Escola da Saúde"}
      periodo={periodo}
      tipo={item?.tipo_exibicao || "destaque"}
      status={status}
    >
      <div
        className="prose prose-sm max-w-none dark:prose-invert prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-headings:font-extrabold prose-a:break-all"
        dangerouslySetInnerHTML={{ __html: htmlSeguro }}
      />
    </DestaqueLongo>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* MiniStat                                                        */
/* ────────────────────────────────────────────────────────────── */
function MiniStat({ icon: Icon, label, value, hint, tone = "emerald", onClick }) {
  const toneMap = {
    emerald: {
      soft: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
      bar: "from-emerald-500 via-teal-500 to-cyan-500",
    },
    sky: {
      soft: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
      bar: "from-sky-500 via-cyan-500 to-blue-500",
    },
    violet: {
      soft: "bg-violet-600/10 text-violet-700 dark:text-violet-200 dark:bg-violet-400/10",
      bar: "from-violet-500 via-fuchsia-500 to-pink-500",
    },
    amber: {
      soft: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
      bar: "from-amber-400 via-orange-400 to-amber-500",
    },
    rose: {
      soft: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
      bar: "from-rose-500 via-red-500 to-orange-500",
    },
    slate: {
      soft: "bg-slate-600/10 text-slate-800 dark:text-slate-200 dark:bg-white/10",
      bar: "from-slate-400 via-slate-500 to-slate-600",
    },
  };

  const clickable = typeof onClick === "function";
  const cfg = toneMap[tone] || toneMap.emerald;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={[
        "group overflow-hidden rounded-[26px] border border-slate-200/80 bg-white text-left shadow-sm transition-all dark:border-white/10 dark:bg-zinc-900/55",
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          : "cursor-default opacity-95",
      ].join(" ")}
      aria-label={`${label}: ${value ?? "—"}`}
      title={clickable ? "Abrir" : undefined}
    >
      <div className={`h-1.5 w-full bg-gradient-to-r ${cfg.bar}`} />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              {label}
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {value}
            </div>

            {hint ? (
              <div className="mt-2 text-[12px] leading-relaxed text-slate-600 dark:text-zinc-400 sm:text-[13px]">
                {hint}
              </div>
            ) : null}
          </div>

          <div className={`shrink-0 rounded-2xl p-3 ${cfg.soft}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        {clickable ? (
          <div className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-slate-500 transition group-hover:text-slate-700 dark:text-zinc-400 dark:group-hover:text-zinc-200">
            Ver área
            <ArrowUpRight className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Nota do usuário                                                 */
/* ────────────────────────────────────────────────────────────── */
function NotaUsuarioCard({ nota, loading }) {
  const n = Number(nota);
  const clamp10 = Number.isFinite(n) ? clamp(n, 0, 10) : null;
  const percent = clamp10 === null ? 0 : (clamp10 / 10) * 100;

  const corBarra =
    clamp10 === null
      ? "bg-slate-400"
      : clamp10 >= 9
      ? "bg-emerald-500"
      : clamp10 >= 7
      ? "bg-lime-500"
      : clamp10 >= 5
      ? "bg-amber-500"
      : clamp10 >= 3
      ? "bg-orange-500"
      : "bg-rose-600";

  const labelStatus =
    clamp10 === null
      ? "Sem nota"
      : clamp10 >= 9
      ? "Excelente"
      : clamp10 >= 7
      ? "Bom"
      : clamp10 >= 5
      ? "Regular"
      : clamp10 >= 3
      ? "Atenção"
      : "Crítico";

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900/55 lg:col-span-2">
      <div className="h-1.5 w-full bg-gradient-to-r from-slate-500 via-slate-600 to-slate-700" />

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              Nota do usuário
            </div>

            <div className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-zinc-100 sm:text-[1.75rem]">
              {loading ? "…" : clamp10 === null ? "—" : clamp10.toFixed(1)}
            </div>

            <div className="mt-2 text-[12px] text-slate-600 dark:text-zinc-400 sm:text-[13px]">
              Visão consolidada do seu desempenho e participação.
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-800 dark:bg-zinc-800 dark:text-zinc-100">
            <Star className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${corBarra}`}
              style={{ width: loading ? "35%" : `${percent}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[12px]">
            <span className="text-slate-600 dark:text-zinc-400">Status</span>
            <span className="font-extrabold text-slate-900 dark:text-zinc-100">
              {loading ? "Carregando…" : labelStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DestaquesSkeleton() {
  return (
    <div className="mt-3 grid grid-cols-1 gap-6 xl:grid-cols-2">
      {[1, 2].map((n) => (
        <div
          key={n}
          className="overflow-hidden rounded-[30px] bg-white shadow-sm ring-1 ring-black/5 dark:bg-zinc-900/55 dark:ring-white/10"
        >
          <div className="h-56 w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-3 p-5 sm:p-6">
            <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPublicacoes() {
  return (
    <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/55 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
          <BellRing className="h-7 w-7" />
        </div>

        <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-zinc-100">
          Nenhuma publicação disponível
        </h3>

        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
          Quando a administração cadastrar novos conteúdos em{" "}
          <strong>Gestão de Informações</strong>, eles aparecerão aqui automaticamente
          conforme o período de exibição configurado.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Página                                                          */
/* ────────────────────────────────────────────────────────────── */
export default function HomeEscola() {
  const navigate = useNavigate();
  const isDark = useIsDarkClass();

  useEffect(() => {
    document.title = "Escola da Saúde — Painel";
  }, []);

  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);

  const [publicacoes, setPublicacoes] = useState([]);
  const [loadingPublicacoes, setLoadingPublicacoes] = useState(true);
  const [erroPublicacoes, setErroPublicacoes] = useState("");

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true);
      const data = await apiGet("/dashboard-usuario");
      setResumo(data || {});
    } catch (err) {
      console.error("❌ Erro ao carregar resumo:", err);
      setResumo(null);
      toast.error("Faça LOGIN na plataforma");
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  const carregarPublicacoes = useCallback(async () => {
    try {
      setLoadingPublicacoes(true);
      setErroPublicacoes("");

      const data = await apiGet("/informacoes/publicadas");
      const itens = Array.isArray(data?.itens) ? data.itens : [];
      const ativos = itens.filter((item) => getStatusInformacao(item) === "ativa");

      setPublicacoes(ativos);
    } catch (err) {
      console.error("❌ Erro ao carregar publicações:", err);
      setPublicacoes([]);
      setErroPublicacoes("Não foi possível carregar as publicações institucionais.");
      toast.error("Falha ao carregar publicações institucionais.");
    } finally {
      setLoadingPublicacoes(false);
    }
  }, []);

  useEffect(() => {
    carregarResumo();
    carregarPublicacoes();
  }, [carregarResumo, carregarPublicacoes]);

  const stats = useMemo(() => {
    const inscricao = Number(resumo?.inscricaoFuturas ?? resumo?.proximosEventos ?? 0) || 0;
    const certEmit = Number(resumo?.certificadosEmitidos ?? resumo?.certificados ?? 0) || 0;
    const presencas = Number(resumo?.presencasTotal ?? 0) || 0;
    const faltas = Number(resumo?.faltasTotal ?? 0) || 0;
    const nota = resumo?.notaUsuario ?? resumo?.nota ?? null;

    return { inscricao, certEmit, presencas, faltas, nota };
  }, [resumo]);

  const go = useCallback(
    (path) => {
      if (!path) return;
      try {
        navigate(path);
      } catch {
        toast.info("Em breve 🙂");
      }
    },
    [navigate]
  );

  return (
    <>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <HeaderHero
          title="Painel do Usuário"
          subtitle="Seu resumo de inscrições, presenças, certificados e publicações institucionais."
          badge="Escola da Saúde • Oficial • Ambiente Seguro"
          icon={Sparkles}
          gradient="from-emerald-700 via-teal-600 to-sky-700"
          isDark={isDark}
          rightSlot={null}
        />

        <div className="mt-6">
          <InfoRibbon />
        </div>

        <SectionShell
          title="Seu resumo"
          subtitle="Indicadores consolidados da sua participação na plataforma, com acesso rápido às áreas mais importantes."
          icon={LayoutPanelTop}
          gradient="from-emerald-600 via-teal-500 to-cyan-600"
          action={
            <GhostAction
              icon={RefreshCw}
              onClick={carregarResumo}
              loading={loadingResumo}
            >
              {loadingResumo ? "Atualizando…" : "Atualizar"}
            </GhostAction>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              icon={ClipboardList}
              label="Inscrições"
              value={loadingResumo ? "…" : stats.inscricao}
              hint="Cursos que você ainda vai realizar"
              tone="emerald"
              onClick={() => go("/eventos")}
            />

            <MiniStat
              icon={FileText}
              label="Certificados emitidos"
              value={loadingResumo ? "…" : stats.certEmit}
              hint="Documentos já disponíveis para download"
              tone="violet"
              onClick={() => go("/certificados")}
            />

            <MiniStat
              icon={CheckCircle2}
              label="Presenças"
              value={loadingResumo ? "…" : stats.presencas}
              hint="Registros confirmados em cursos concluídos"
              tone="amber"
              onClick={() => go("/minhas-presencas")}
            />

            <MiniStat
              icon={XCircle}
              label="Faltas"
              value={loadingResumo ? "…" : stats.faltas}
              hint="Ocorrências registradas em cursos concluídos"
              tone="rose"
              onClick={() => go("/minhas-presencas")}
            />

            <NotaUsuarioCard nota={stats.nota} loading={loadingResumo} />
          </div>
        </SectionShell>

        <SectionShell
          title="Informações institucionais"
          subtitle="Comunicados, campanhas e publicações oficiais cadastradas pela administração."
          icon={Megaphone}
          gradient="from-sky-600 via-cyan-500 to-emerald-500"
          action={
            <div className="flex flex-wrap items-center gap-2.5">
              {!loadingPublicacoes && publicacoes.length > 0 ? (
                <MetaBadge className="border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <Megaphone className="h-3.5 w-3.5" />
                  {publicacoes.length} ativa(s)
                </MetaBadge>
              ) : null}

              <GhostAction
                icon={RefreshCw}
                onClick={carregarPublicacoes}
                loading={loadingPublicacoes}
              >
                {loadingPublicacoes ? "Atualizando…" : "Recarregar"}
              </GhostAction>
            </div>
          }
        >
          {loadingPublicacoes ? <DestaquesSkeleton /> : null}

          {!loadingPublicacoes && erroPublicacoes ? (
            <div
              className="mt-1 rounded-[26px] border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar as publicações
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    {erroPublicacoes}
                  </p>

                  <div className="mt-3">
                    <GhostAction icon={RefreshCw} onClick={carregarPublicacoes}>
                      Tentar novamente
                    </GhostAction>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!loadingPublicacoes && publicacoes.length > 0 ? (
            <div className="mt-1 grid grid-cols-1 gap-6 xl:grid-cols-2">
              {publicacoes.map((item) => (
                <PublicacaoCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}

          {!loadingPublicacoes && !erroPublicacoes && publicacoes.length === 0 ? (
            <EmptyPublicacoes />
          ) : null}
        </SectionShell>
      </div>

      <Footer />
    </>
  );
}