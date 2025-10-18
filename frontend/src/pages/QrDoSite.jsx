// ✅ src/pages/QrDoSite.jsx
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
} from "lucide-react";

import QrSiteEscola from "../components/QrSiteEscola";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

/* ───────── Header hero (padronizado) ───────── */
function HeaderHero({ onOpenSite, onCopySite, onOpenInsta, onShare }) {
  // gradiente exclusivo desta página (teal)
  const grad = "from-teal-900 via-teal-800 to-teal-700";

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Pular para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            QR Codes Oficiais
          </h1>
        </div>
        <p className="text-sm text-white/90 max-w-lg">
          Escaneie para acessar o site ou o Instagram oficial da Escola da Saúde
          de Santos.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-1">
          <BotaoPrimario
            onClick={onOpenSite}
            variante="secundario"
            icone={<ExternalLink className="w-4 h-4" />}
            aria-label="Abrir site oficial da Escola"
          >
            Abrir site
          </BotaoPrimario>

          <BotaoPrimario
            onClick={onCopySite}
            variante="secundario"
            icone={<Copy className="w-4 h-4" />}
            aria-label="Copiar link do site"
          >
            Copiar link
          </BotaoPrimario>

          <BotaoPrimario
            onClick={onOpenInsta}
            variante="secundario"
            icone={<Instagram className="w-4 h-4" />}
            aria-label="Abrir Instagram da Escola"
          >
            Instagram
          </BotaoPrimario>

          <BotaoPrimario
            onClick={onShare}
            variante="secundario"
            icone={<Share2 className="w-4 h-4" />}
            aria-label="Compartilhar links oficiais"
          >
            Compartilhar
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

/* ───────── Mini-stats ───────── */
function MiniStats({ stats, loading }) {
  const reduce = useReducedMotion();
  return (
    <section
      className="max-w-5xl mx-auto grid grid-cols-2 gap-3 mt-6 px-4 text-center"
      aria-label="Mini estatísticas do aplicativo"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-4 shadow-sm"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={reduce ? false : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          role="status"
          aria-live="polite"
          aria-busy={loading}
        >
          <s.icon className="mx-auto w-6 h-6 text-teal-600 mb-1" aria-hidden="true" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
          <p
            className={`text-lg font-semibold ${
              loading ? "text-gray-400 dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
            }`}
          >
            {s.value}
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

  // título da aba consistente
  useEffect(() => {
    document.title = "QR Codes Oficiais | Escola da Saúde";
  }, []);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  /* Ações principais */
  const abrirSite = useCallback(() => {
    window.open(SITE_URL, "_blank", "noopener,noreferrer");
  }, []);

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      toast.success("🔗 Link copiado para a área de transferência!");
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
          text: "Acesse os links oficiais da Escola da Saúde de Santos",
          url: SITE_URL,
        });
      } else {
        await navigator.clipboard.writeText(SITE_URL);
        toast.success("📎 Link do site copiado (share indisponível).");
      }
    } catch {
      // usuário pode cancelar o share; não mostrar erro nesse caso
    }
  }, []);

  /* ✅ Conta uma visita por sessão */
  useEffect(() => {
    const key = "qrdoSite_visitado_v2";
    if (!sessionStorage.getItem(key)) {
      fetch("/api/metricas/contar-visita", { method: "POST" }).catch(() => {});
      sessionStorage.setItem(key, "1");
    }
  }, []);

  /* ✅ Busca métricas reais */
  useEffect(() => {
    let alive = true;
    setLoadingStats(true);
    setLive("Carregando estatísticas públicas…");

    (async () => {
      try {
        const r = await fetch("/api/metricas/publica", { cache: "no-store" });
        if (!r.ok) throw new Error("Falha ao consultar métricas");
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
        // mantém fallback silenciosamente
        setLive("Exibindo estatísticas offline.");
      } finally {
        if (alive) setLoadingStats(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* Tamanhos de QR responsivos */
  const qrSize = useMemo(() => {
    // 260 em telas muito pequenas, 300 no restante
    if (typeof window !== "undefined" && window.innerWidth < 360) return 260;
    return 300;
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 text-gray-800 dark:text-gray-100">
      <HeaderHero
        onOpenSite={abrirSite}
        onCopySite={copiarLink}
        onOpenInsta={abrirInstagram}
        onShare={ compartilhar }
      />

      {/* Live region acessível para mensagens curtas */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Mini estatísticas */}
      <MiniStats stats={stats} loading={loadingStats} />

      <main id="conteudo" role="main" className="flex-1 px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-2">
          {/* 🟩 QR do Site */}
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-md p-6 text-center flex flex-col items-center"
            role="region"
            aria-labelledby="qr-site"
          >
            <h2 id="qr-site" className="text-lg font-semibold mb-2 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-600" aria-hidden="true" />
              Site Oficial da Escola
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Escaneie para acessar{" "}
              <span className="font-medium">escoladasaude.vercel.app</span>
            </p>

            <figure aria-label="Código QR do site oficial">
              <QrSiteEscola size={qrSize} showLogo={false} />
              <figcaption className="sr-only">
                Código QR que direciona para o site oficial da Escola da Saúde de Santos.
              </figcaption>
            </figure>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <a
                href={SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline text-teal-700 dark:text-teal-300"
              >
                Abrir site em nova aba
              </a>
            </div>
          </motion.section>

          {/* 🟣 QR do Instagram */}
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={reduce ? false : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: reduce ? 0 : 0.15 }}
            className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-md p-6 text-center flex flex-col items-center"
            role="region"
            aria-labelledby="qr-instagram"
          >
            <h2 id="qr-instagram" className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" aria-hidden="true" />
              Instagram da Escola
            </h2>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Siga <span className="font-medium">@escoladasaudesms</span> para novidades e eventos.
            </p>

            <figure aria-label="Código QR do Instagram da Escola">
              <QrSiteEscola size={qrSize} showLogo={false} url={INSTAGRAM_URL} />
              <figcaption className="sr-only">
                Código QR que direciona para o perfil do Instagram da Escola da Saúde de Santos.
              </figcaption>
            </figure>

            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline text-teal-700 dark:text-teal-300"
              >
                Abrir Instagram em nova aba
              </a>
            </div>
          </motion.section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
