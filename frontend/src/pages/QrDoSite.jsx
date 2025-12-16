// ✅ src/pages/QrDoSite.jsx — premium (kit base Escola)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import {
  QrCode,
  ExternalLink,
  Copy,
  Instagram,
  BarChart3,
  Share2,
  Sparkles,
} from "lucide-react";

import QrSiteEscola from "../components/QrSiteEscola";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

/* ───────── HeaderHero premium ───────── */
function HeaderHero({ onOpenSite, onCopySite, onOpenInsta, onShare }) {
  return (
    <header className="relative overflow-hidden" role="banner">
      {/* gradiente exclusivo */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-700" />
      <div className="absolute inset-0 bg-black/25" />

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>Links oficiais • acesso rápido</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight inline-flex items-center gap-2">
            <QrCode className="w-6 h-6" aria-hidden="true" />
            QR Codes Oficiais
          </h1>

          <p className="text-sm text-white/90 max-w-2xl">
            Escaneie para acessar o site institucional ou o Instagram oficial da
            Escola Municipal de Saúde Pública de Santos.
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <BotaoPrimario
              onClick={onOpenSite}
              variante="secundario"
              icone={<ExternalLink className="w-4 h-4" />}
            >
              Abrir site
            </BotaoPrimario>

            <BotaoPrimario
              onClick={onCopySite}
              variante="secundario"
              icone={<Copy className="w-4 h-4" />}
            >
              Copiar link
            </BotaoPrimario>

            <BotaoPrimario
              onClick={onOpenInsta}
              variante="secundario"
              icone={<Instagram className="w-4 h-4" />}
            >
              Instagram
            </BotaoPrimario>

            <BotaoPrimario
              onClick={onShare}
              variante="secundario"
              icone={<Share2 className="w-4 h-4" />}
            >
              Compartilhar
            </BotaoPrimario>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ───────── Mini-stats premium ───────── */
function MiniStats({ stats, loading }) {
  const reduce = useReducedMotion();

  return (
    <section
      className="max-w-5xl mx-auto grid grid-cols-2 gap-3 mt-6 px-4"
      aria-label="Estatísticas públicas"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 text-center shadow-sm"
          role="status"
          aria-busy={loading}
        >
          <s.icon className="mx-auto h-6 w-6 text-teal-600 mb-1" aria-hidden="true" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
          <p className="text-lg font-extrabold">
            {loading ? "—" : s.value}
          </p>
        </motion.div>
      ))}
    </section>
  );
}

/* ───────── Página ───────── */
export default function QrDoSite() {
  const reduce = useReducedMotion();
  const liveRef = useRef(null);

  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState([
    { label: "Acessos ao app", value: "—", icon: BarChart3 },
    { label: "Atualizado em", value: "—", icon: QrCode },
  ]);

  useEffect(() => {
    document.title = "QR Codes Oficiais | Escola da Saúde";
  }, []);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  /* Ações */
  const abrirSite = useCallback(() => {
    window.open(SITE_URL, "_blank", "noopener,noreferrer");
  }, []);

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("🔗 Link copiado!");
      setLive("Link do site copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }, []);

  const abrirInstagram = useCallback(() => {
    window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer");
  }, []);

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
      /* cancelado pelo usuário */
    }
  }, []);

  /* Métricas públicas */
  useEffect(() => {
    let alive = true;
    setLoadingStats(true);
    setLive("Carregando estatísticas…");

    (async () => {
      try {
        const r = await fetch("/api/metricas/publica", { cache: "no-store" });
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (!alive) return;

        setStats([
          {
            label: "Acessos ao app",
            value: Number(data.acessos_app ?? 0).toLocaleString("pt-BR"),
            icon: BarChart3,
          },
          {
            label: "Atualizado em",
            value: new Date(data.atualizado_em ?? Date.now()).toLocaleDateString("pt-BR"),
            icon: QrCode,
          },
        ]);
        setLive("Estatísticas atualizadas.");
      } catch {
        setLive("Estatísticas indisponíveis.");
      } finally {
        if (alive) setLoadingStats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const qrSize = useMemo(() => {
    if (typeof window !== "undefined" && window.innerWidth < 360) return 260;
    return 300;
  }, []);

  return (
    <main className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <HeaderHero
        onOpenSite={abrirSite}
        onCopySite={copiarLink}
        onOpenInsta={abrirInstagram}
        onShare={compartilhar}
      />

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <MiniStats stats={stats} loading={loadingStats} />

      <section id="conteudo" role="main" className="flex-1 px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-2">
          {/* QR Site */}
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-6 text-center shadow-md"
          >
            <h2 className="text-lg font-extrabold mb-2 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5 text-teal-600" />
              Site Oficial
            </h2>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              escoladasaude.vercel.app
            </p>

            <QrSiteEscola size={qrSize} showLogo={false} />

            <a
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm underline text-teal-700 dark:text-teal-300"
            >
              Abrir site em nova aba
            </a>
          </motion.section>

          {/* QR Instagram */}
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0 : 0.15 }}
            className="rounded-3xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-6 text-center shadow-md"
          >
            <h2 className="text-lg font-extrabold mb-2 flex items-center justify-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" />
              Instagram
            </h2>

            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
              @escoladasaudesms
            </p>

            <QrSiteEscola size={qrSize} showLogo={false} url={INSTAGRAM_URL} />

            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm underline text-teal-700 dark:text-teal-300"
            >
              Abrir Instagram em nova aba
            </a>
          </motion.section>
        </div>
      </section>

      <Footer />
    </main>
  );
}
