// ✅ src/pages/HomeEscola.jsx
// Premium: home do usuário focada em stats + publicações dinâmicas
// - Remove QR Codes, links oficiais e destaques fixos
// - Remove atalhos/links de avaliações pendentes
// - Mantém stats principais
// - Exibe somente publicações da Gestão de Informações
// - Sanitiza HTML no frontend com DOMPurify
// - Loading, erro e empty state premium
// - Mobile-first / PWA-ready

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
  const hoje = new Date().toISOString().slice(0, 10);

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
}) {
  const reduceMotion = useReducedMotion();
  const [ok, setOk] = useState(true);

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/55 shadow-sm ring-1 ring-black/5 dark:ring-white/10 flex flex-col"
    >
      <div className="relative">
        {imgSrc && ok ? (
          <img
            src={imgSrc}
            alt={imgAlt}
            className="w-full h-56 object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setOk(false)}
          />
        ) : (
          <div className="w-full h-56 bg-gradient-to-br from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 grid place-items-center">
            <div className="text-center text-zinc-600 dark:text-zinc-300 font-semibold px-4">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-70" />
              Imagem indisponível
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          {badge ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 backdrop-blur px-3 py-1 text-xs font-extrabold text-white shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
              {badge}
            </span>
          ) : null}

          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur px-3 py-1 text-xs font-extrabold text-white shadow-sm">
            {tipo === "comunicado" ? <Newspaper className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            {tipo === "comunicado" ? "Comunicado" : "Destaque"}
          </span>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-3">
        <div className="space-y-1">
          <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            {titulo}
          </h3>

          {subtitulo ? (
            <p className="text-emerald-700 dark:text-emerald-300 text-sm font-bold">
              {subtitulo}
            </p>
          ) : null}
        </div>

        {periodo ? (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-400">
            <CalendarDays className="w-3.5 h-3.5" />
            {periodo}
          </div>
        ) : null}

        <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-3 text-justify">
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

  const periodo =
    item?.data_inicio_exibicao || item?.data_fim_exibicao
      ? `${fmtData(item?.data_inicio_exibicao)} até ${fmtData(item?.data_fim_exibicao)}`
      : "";

  return (
    <DestaqueLongo
      imgSrc={item?.imagem_url || ""}
      imgAlt={item?.titulo || "Publicação institucional"}
      titulo={item?.titulo || "Informação institucional"}
      subtitulo={item?.subtitulo || ""}
      badge={item?.badge || "Escola da Saúde"}
      periodo={periodo}
      tipo={item?.tipo_exibicao || "destaque"}
    >
      <div
        className="prose prose-sm max-w-none dark:prose-invert prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1"
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
    emerald: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10",
    sky: "bg-sky-600/10 text-sky-700 dark:text-sky-200 dark:bg-sky-400/10",
    violet: "bg-violet-600/10 text-violet-700 dark:text-violet-200 dark:bg-violet-400/10",
    amber: "bg-amber-600/10 text-amber-800 dark:text-amber-200 dark:bg-amber-400/10",
    rose: "bg-rose-600/10 text-rose-800 dark:text-rose-200 dark:bg-rose-400/10",
    slate: "bg-slate-600/10 text-slate-800 dark:text-slate-200 dark:bg-white/10",
  };

  const clickable = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={[
        "rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm text-left",
        clickable
          ? "hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 cursor-pointer"
          : "cursor-default opacity-95",
      ].join(" ")}
      aria-label={`${label}: ${value ?? "—"}`}
      title={clickable ? "Abrir" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400">
              {hint}
            </div>
          ) : null}
        </div>

        <div className={`shrink-0 rounded-2xl p-3 ${toneMap[tone] || toneMap.emerald}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
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
      ? "—"
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
    <div className="rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Nota do usuário
          </div>

          <div className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
            {loading ? "…" : clamp10 === null ? "—" : clamp10.toFixed(1)}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl p-3 bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-100">
          <Star className="w-5 h-5" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4">
        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
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
  );
}

function DestaquesSkeleton() {
  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
      {[1, 2].map((n) => (
        <div
          key={n}
          className="overflow-hidden rounded-3xl bg-white dark:bg-zinc-900/55 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        >
          <div className="w-full h-56 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="p-5 sm:p-6 space-y-3">
            <div className="h-6 w-2/3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-full bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyPublicacoes() {
  return (
    <div className="mt-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-900/55 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-200 dark:bg-emerald-400/10">
          <BellRing className="w-7 h-7" />
        </div>

        <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-zinc-100">
          Nenhuma publicação disponível
        </h3>

        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
          Quando a administração criar novas informações em <strong>Gestão de Informações</strong>,
          elas aparecerão aqui automaticamente durante o período configurado.
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
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <HeaderHero
          title="Painel do Usuário"
          subtitle="Seu resumo de inscrições, presenças, certificados e publicações institucionais."
          badge="Escola da Saúde • Oficial • Ambiente Seguro"
          icon={Sparkles}
          gradient="from-emerald-700 via-teal-600 to-sky-700"
          isDark={isDark}
          rightSlot={null}
        />

        {/* ✅ Resumo do usuário */}
        <section className="mt-6" aria-label="Resumo do usuário">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">Seu resumo</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Indicadores consolidados de participação na plataforma.
              </p>
            </div>

            <button
              type="button"
              onClick={carregarResumo}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition"
              aria-label="Atualizar resumo do usuário"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loadingResumo ? "animate-spin" : ""}`} aria-hidden="true" />
              {loadingResumo ? "Atualizando…" : "Atualizar"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MiniStat
              icon={ClipboardList}
              label="Inscrições"
              value={loadingResumo ? "…" : stats.inscricao}
              hint="Cursos que você ainda vai fazer"
              tone="emerald"
              onClick={() => go("/eventos")}
            />

            <MiniStat
              icon={FileText}
              label="Certificados emitidos"
              value={loadingResumo ? "…" : stats.certEmit}
              hint="Prontos para download"
              tone="violet"
              onClick={() => go("/certificados")}
            />

            <MiniStat
              icon={CheckCircle2}
              label="Presenças"
              value={loadingResumo ? "…" : stats.presencas}
              hint="Registros em cursos concluídos"
              tone="amber"
              onClick={() => go("/minhas-presencas")}
            />

            <MiniStat
              icon={XCircle}
              label="Faltas"
              value={loadingResumo ? "…" : stats.faltas}
              hint="Registros em cursos concluídos"
              tone="rose"
              onClick={() => go("/minhas-presencas")}
            />

            <NotaUsuarioCard nota={stats.nota} loading={loadingResumo} />
          </div>
        </section>

        {/* ✅ Publicações dinâmicas */}
        <section className="mt-8" aria-label="Informações institucionais">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">
                Informações institucionais
              </h2>
              <p className="mt-1 sm:mt-0 text-sm text-slate-600 dark:text-zinc-400">
                Comunicados, campanhas e publicações oficiais cadastradas pela administração.
              </p>
            </div>

            {!loadingPublicacoes && publicacoes.length > 0 ? (
              <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-400">
                <Megaphone className="w-4 h-4" />
                {publicacoes.length} publicação(ões) ativa(s)
              </div>
            ) : null}
          </div>

          {loadingPublicacoes ? <DestaquesSkeleton /> : null}

          {!loadingPublicacoes && erroPublicacoes ? (
            <div
              className="mt-4 rounded-3xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-4"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-extrabold text-amber-800 dark:text-amber-200">
                    Não foi possível carregar as publicações
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {erroPublicacoes}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!loadingPublicacoes && publicacoes.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
              {publicacoes.map((item) => (
                <PublicacaoCard key={item.id} item={item} />
              ))}
            </div>
          ) : null}

          {!loadingPublicacoes && !erroPublicacoes && publicacoes.length === 0 ? (
            <EmptyPublicacoes />
          ) : null}
        </section>
      </div>

      <Footer />
    </>
  );
}