// ✅ src/pages/HomeEscola.jsx (premium + mobile-first + a11y + robustez)
// - Corrige isDark (antes ficava “travado” no 1º render)
// - QR size responsivo com listener de resize (sem recalcular errado)
// - Ações (abrir/copiar/compartilhar) mais robustas + feedbacks
// - MiniStats clicáveis (quando houver rota) + estados de loading melhores
// - Destaques com fallback de imagem (onError)
// - Mantém sua “Mensagem 2026” + card de instalação PWA

import { useEffect, useMemo, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  FileText,
  ClipboardList,
  QrCode,
  ExternalLink,
  Copy,
  Instagram,
  Share2,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Star,
  RefreshCw,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import Footer from "../components/Footer";
import HeaderHero from "../components/HeaderHero";
import QrSiteEscola from "../components/QrSiteEscola";
import { apiGet } from "../services/api";

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

/* ────────────────────────────────────────────────────────────── */
/* Utils                                                          */
/* ────────────────────────────────────────────────────────────── */
function safeOpen(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
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

    // Observa mudanças no className do <html> (quando o usuário alternar tema)
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return isDark;
}

function useQrSize() {
  const [size, setSize] = useState(() => {
    if (typeof window === "undefined") return 260;
    const w = window.innerWidth;
    if (w < 360) return 220;
    if (w < 768) return 240;
    return 260;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const w = window.innerWidth;
      const next = w < 360 ? 220 : w < 768 ? 240 : 260;
      setSize(next);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

/* ────────────────────────────────────────────────────────────── */
/* Card de destaque (premium)                                      */
/* ────────────────────────────────────────────────────────────── */
function DestaqueLongo({ imgSrc, imgAlt, titulo, subtitulo, badge, children }) {
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
        {ok ? (
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
            <div className="text-sm text-zinc-600 dark:text-zinc-300 font-semibold">
              Imagem indisponível
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />

        {badge && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 backdrop-blur px-3 py-1 text-xs font-extrabold text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden="true" />
            {badge}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-2">
        <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-100">
          {titulo}
        </h3>
        {subtitulo && (
          <p className="text-emerald-700 dark:text-emerald-300 text-sm font-bold">
            {subtitulo}
          </p>
        )}
        <div className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed space-y-3 text-justify">
          {children}
        </div>
      </div>
    </motion.article>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* MiniStat (premium + acessível)                                  */
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
/* Card especial: Nota do usuário (sem /10 e sem fórmula)           */
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

/* ────────────────────────────────────────────────────────────── */
/* Quick card (atalhos)                                            */
/* ────────────────────────────────────────────────────────────── */
function QuickCard({ to, icon: Icon, title, subtitle, tone = "emerald" }) {
  const toneBar = {
    emerald: "from-emerald-500/45 via-emerald-500/20 to-transparent",
    sky: "from-sky-500/45 via-sky-500/20 to-transparent",
    violet: "from-violet-500/45 via-violet-500/20 to-transparent",
    amber: "from-amber-500/45 via-amber-500/20 to-transparent",
  };

  return (
    <Link
      to={to}
      className="group rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-4 sm:p-5 shadow-sm hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
    >
      <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${toneBar[tone] || toneBar.emerald}`} aria-hidden="true" />
      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/30 p-3 group-hover:bg-slate-100 dark:group-hover:bg-white/5 transition">
          <Icon className="w-5 h-5 text-slate-800 dark:text-zinc-100" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">{title}</div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400">{subtitle}</div>
        </div>
        <ArrowRight className="ml-auto w-5 h-5 text-slate-400 group-hover:text-slate-700 dark:text-zinc-500 dark:group-hover:text-zinc-200 transition" aria-hidden="true" />
      </div>
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* QR Card                                                         */
/* ────────────────────────────────────────────────────────────── */
function QrCard({ title, subtitle, icon: Icon, accent = "teal", url, qrSize }) {
  const accentMap = {
    teal: "text-teal-600 dark:text-teal-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    pink: "text-pink-600 dark:text-pink-300",
    sky: "text-sky-600 dark:text-sky-300",
  };
  const badgeBar = {
    teal: "from-teal-500/40 via-emerald-500/20 to-transparent",
    emerald: "from-emerald-500/40 via-sky-500/20 to-transparent",
    pink: "from-pink-500/40 via-rose-500/20 to-transparent",
    sky: "from-sky-500/40 via-violet-500/20 to-transparent",
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-zinc-900/55 border border-slate-200 dark:border-white/10 p-5 sm:p-6 shadow-sm">
      <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${badgeBar[accent] || badgeBar.teal}`} aria-hidden="true" />

      <div className="mt-4 flex items-start gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-zinc-950/30 p-3">
          <Icon className={`w-5 h-5 ${accentMap[accent] || accentMap.teal}`} aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">{title}</div>
          <div className="mt-1 text-[12px] text-slate-600 dark:text-zinc-400 break-words">{subtitle}</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center">
        <QrSiteEscola size={qrSize} showLogo={false} url={url} />
      </div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 transition"
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {children}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Página                                                          */
/* ────────────────────────────────────────────────────────────── */
export default function HomeEscola() {
  const navigate = useNavigate();
  const isDark = useIsDarkClass();
  const qrSize = useQrSize();

  useEffect(() => {
    document.title = "Escola da Saúde — Painel";
  }, []);

  // ✅ Resumo do usuário (stats do painel)
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);

  const carregarResumo = useCallback(async () => {
    try {
      setLoadingResumo(true);
      const data = await apiGet("/dashboard-usuario");
      setResumo(data || {});
    } catch (err) {
      console.error("❌ Erro ao carregar resumo:", err);
      setResumo(null);
      toast.error("Não foi possível carregar seu resumo agora.");
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  const stats = useMemo(() => {
    const inscricao = Number(resumo?.inscricaoFuturas ?? resumo?.proximosEventos ?? 0) || 0;
    const avalPend = Number(resumo?.avaliacaoPendentes ?? 0) || 0;
    const certEmit = Number(resumo?.certificadosEmitidos ?? resumo?.certificados ?? 0) || 0;

    const presencas = Number(resumo?.presencasTotal ?? 0) || 0;
    const faltas = Number(resumo?.faltasTotal ?? 0) || 0;
    const nota = resumo?.notaUsuario ?? resumo?.nota ?? null;

    return { inscricao, avalPend, certEmit, presencas, faltas, nota };
  }, [resumo]);

  // Ações QR
  const abrirSite = useCallback(() => safeOpen(SITE_URL), []);
  const copiarSite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("🔗 Link do site copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);
  const abrirInstagram = useCallback(() => safeOpen(INSTAGRAM_URL), []);
  const compartilhar = useCallback(async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Escola da Saúde de Santos",
          text: "Acesse os links oficiais da Escola da Saúde",
          url: SITE_URL,
        });
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        toast.success("📎 Link copiado (compartilhamento indisponível).");
      }
    } catch {
      // usuário cancelou / share não disponível
    }
  }, []);

  // helpers de navegação (evita quebrar caso rota não exista ainda)
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
        {/* HeaderHero premium */}
        <HeaderHero
          title="Painel do Usuário"
          subtitle="Seu resumo de inscrições, presenças, avaliações e certificados — em um só lugar."
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
                Indicadores consolidados de participação e pendências.
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
              icon={ClipboardCheck}
              label="Avaliações pendentes"
              value={loadingResumo ? "…" : stats.avalPend}
              hint="Complete para liberar certificado"
              tone="sky"
              onClick={() => go("/avaliacao")}
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

          {/* Atalhos rápidos (bem “premium”, opcional mas útil) */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Atalhos rápidos">
            <QuickCard
              to="/eventos"
              icon={ClipboardList}
              title="Ver eventos e turmas"
              subtitle="Inscreva-se e acompanhe suas inscrições"
              tone="emerald"
            />
            <QuickCard
              to="/avaliacao"
              icon={ClipboardCheck}
              title="Avaliações pendentes"
              subtitle="Finalize para liberar certificados"
              tone="sky"
            />
            <QuickCard
              to="/certificados"
              icon={FileText}
              title="Meus certificados"
              subtitle="Baixe PDFs emitidos e elegíveis"
              tone="violet"
            />
          </div>
        </section>

        {/* Links oficiais (QR do site + Instagram) */}
        <section className="mt-8" aria-label="Links oficiais">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">Links oficiais</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                QR Codes do site institucional e do Instagram oficial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={abrirSite} icon={ExternalLink}>Abrir site</ActionBtn>
              <ActionBtn onClick={copiarSite} icon={Copy}>Copiar link</ActionBtn>
              <ActionBtn onClick={abrirInstagram} icon={Instagram}>Instagram</ActionBtn>
              <ActionBtn onClick={compartilhar} icon={Share2}>Compartilhar</ActionBtn>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <QrCard
              title="Site oficial"
              subtitle="escoladasaude.vercel.app"
              icon={QrCode}
              accent="emerald"
              url={SITE_URL}
              qrSize={qrSize}
            />
            <QrCard
              title="Instagram"
              subtitle="@escoladasaudesms"
              icon={Instagram}
              accent="pink"
              url={INSTAGRAM_URL}
              qrSize={qrSize}
            />
          </div>
        </section>

        {/* Destaques */}
        <section className="mt-8" aria-label="Destaques">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-zinc-100">Destaques</h2>
            <p className="hidden sm:block text-sm text-slate-600 dark:text-zinc-400">
              Comunicados e campanhas oficiais
            </p>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1) ✅ Mensagem institucional — Boas-vindas a 2026 */}
            <DestaqueLongo
              imgSrc="/banners/mensagem-2026.jpg"
              imgAlt="Mensagem institucional da Escola da Saúde para 2026"
              titulo="✨ Bem-vindo, 2026 — um ano de realizações e cuidado"
              subtitulo="Educação, união e excelência no SUS"
              badge="Mensagem da Escola da Saúde"
            >
              <p>
                A <strong>Escola da Saúde</strong>, em nome da <strong>Secretaria Municipal de Saúde</strong>,
                deseja a todos os profissionais de saúde um <strong>2026 de muitas realizações</strong>,
                conquistas e crescimento — pessoal e coletivo.
              </p>

              <p>
                Que este novo ano fortaleça ainda mais nosso compromisso com a{" "}
                <strong>educação permanente</strong>, com a atualização constante e com o
                desenvolvimento de competências que se transformam em{" "}
                <strong>melhor assistência aos usuários do SUS</strong>.
              </p>

              <p>
                Seguiremos juntos, construindo diariamente uma rede mais{" "}
                <strong>humana</strong>, <strong>acolhedora</strong> e <strong>eficiente</strong>,
                onde o conhecimento não é apenas conteúdo — é prática, cuidado e transformação.
              </p>

              <p>
                <strong>
                  Que 2026 seja um ano de união, aprendizado e resultados concretos para a saúde pública.
                  Conte com a Escola da Saúde! 💚
                </strong>
              </p>
            </DestaqueLongo>

            {/* 2) Instalação do App PWA */}
            <DestaqueLongo
              imgSrc="/banners/app-escola-saude.jpg"
              imgAlt="Instale o App Escola da Saúde"
              titulo="📲 Instale o App Escola da Saúde!"
              subtitulo="Disponível como aplicativo PWA"
              badge="Instalação rápida"
            >
              <h3 className="font-extrabold mt-4">🍎 iPhone / iPad (iOS)</h3>
              <ul className="list-disc ml-6">
                <li><strong>Navegador obrigatório:</strong> Safari</li>
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Toque em <strong>Compartilhar</strong> (quadrado com seta)</li>
                <li>Selecione <strong>Adicionar à Tela de Início</strong></li>
                <li>Confirme em <strong>Adicionar</strong></li>
                <li>📌 O app aparecerá na tela como um aplicativo normal</li>
              </ul>

              <h3 className="font-extrabold mt-4">📱 Android – Chrome</h3>
              <ul className="list-disc ml-6">
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Toque no menu <strong>⋮</strong></li>
                <li>Selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong></li>
                <li>Confirme em <strong>Instalar</strong></li>
                <li>📌 O ícone aparecerá automaticamente na tela</li>
              </ul>

              <h3 className="font-extrabold mt-4">🌐 Computador (Windows / Chromebook / Linux)</h3>
              <ul className="list-disc ml-6">
                <li>Abra o <strong>Chrome</strong> ou <strong>Edge</strong></li>
                <li>Acesse: <strong>https://escola.santos.sp.gov.br</strong></li>
                <li>Clique no ícone <strong>Instalar</strong> na barra de endereço</li>
                <li>Confirme em <strong>Instalar</strong></li>
                <li>📌 O app abrirá em janela própria, como um programa</li>
              </ul>

              <h3 className="font-extrabold mt-4">❓ Como saber que foi instalado corretamente?</h3>
              <ul className="list-disc ml-6">
                <li>✔ Ícone na tela inicial do celular</li>
                <li>✔ Abre em tela cheia (sem barra do navegador)</li>
                <li>✔ Funciona offline em algumas funcionalidades</li>
                <li>✔ Notificações ativas (certificados, avaliações e presença)</li>
              </ul>

              <p className="mt-4 font-extrabold text-emerald-700 dark:text-emerald-300">
                Android: <strong>⋮ → Instalar app</strong>
              </p>
              <p className="font-extrabold text-sky-700 dark:text-sky-300">
                iPhone: <strong>Compartilhar → Adicionar à Tela de Início</strong>
              </p>

              <p className="mt-6 font-extrabold text-slate-900 dark:text-zinc-100">
                📍 Em breve, após finalização do programa, o app também estará disponível na{" "}
                <strong className="text-emerald-700 dark:text-emerald-300">Google Play Store</strong>.
              </p>
            </DestaqueLongo>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
