// ✅ src/pages/QrDoSite.jsx
import { useCallback, useState, useEffect } from "react";
import QrSiteEscola from "../components/QrSiteEscola";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { QrCode, ExternalLink, Copy, Instagram, BarChart3 } from "lucide-react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

const SITE_URL = "https://escoladasaude.vercel.app";
const INSTAGRAM_URL =
  "https://www.instagram.com/escoladasaudesms?igsh=Zzd5M3MyazZ0aXRm&utm_source=qr";

/* ───────── Header com gradiente ───────── */
function HeaderHero({ variant = "teal", onOpenSite, onCopySite, onOpenInsta }) {
  const grad =
    variant === "teal"
      ? "from-teal-900 via-teal-800 to-teal-700"
      : "from-slate-900 via-teal-900 to-slate-800";

  return (
    <header
      className={`bg-gradient-to-br ${grad} text-white shadow-md border-b border-teal-700`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            QR Codes Oficiais
          </h1>
        </div>
        <p className="text-sm sm:text-base text-white/90 max-w-lg">
          Escaneie para acessar o site ou o Instagram oficial da Escola da Saúde de Santos.
        </p>

        <div className="flex flex-wrap justify-center gap-2 mt-2">
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
        </div>
      </div>
    </header>
  );
}

/* ───────── Mini-stats (somente APP) ───────── */
function MiniStats({ stats }) {
  return (
    <section
      className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-2 gap-3 mt-6 px-4 text-center"
      aria-label="Mini estatísticas do aplicativo"
    >
      {stats.map((s) => (
        <motion.div
          key={s.label}
          className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-4 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <s.icon className="mx-auto w-6 h-6 text-teal-600 mb-1" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {s.value}
          </p>
        </motion.div>
      ))}
    </section>
  );
}

/* ───────── Página principal ───────── */
export default function QrDoSite() {
  // fallback inicial; será substituído pelo backend
  const [stats, setStats] = useState([
    { label: "Acessos ao app", value: "—", icon: BarChart3 },
    { label: "Atualizado em", value: "—", icon: QrCode },
  ]);

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

  /* ✅ Conta uma visita por sessão (evita inflar números) */
  useEffect(() => {
    const key = "qrdoSite_visitado_v2"; // nova chave p/ contar de novo só 1x por sessão
    if (!sessionStorage.getItem(key)) {
      fetch("/api/metricas/contar-visita", { method: "POST" }).catch(() => {});
      sessionStorage.setItem(key, "1");
    }
  }, []);

  /* ✅ Busca métricas reais do backend (apenas APP) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/metricas/publica", { cache: "no-store" });
        if (!r.ok) throw new Error("erro");
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
      } catch {
        // mantém fallback; opcional: toast discreto
        // toast.info("Mostrando métricas offline.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 text-gray-800 dark:text-gray-100">
      <HeaderHero
        variant="teal"
        onOpenSite={abrirSite}
        onCopySite={copiarLink}
        onOpenInsta={abrirInstagram}
      />

      {/* Mini estatísticas (somente APP) */}
      <MiniStats stats={stats} />

      <main role="main" className="flex-1 px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto grid gap-8 md:grid-cols-2">
          {/* 🟩 QR do Site */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-md p-6 text-center flex flex-col items-center"
            role="region"
            aria-labelledby="qr-site"
          >
            <h2 id="qr-site" className="text-lg font-semibold mb-2 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-teal-600" />
              Site Oficial da Escola
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Escaneie para acessar{" "}
              <span className="font-medium">escoladasaude.vercel.app</span>
            </p>
            <QrSiteEscola size={300} showLogo={false} />
          </motion.section>

          {/* 🟣 QR do Instagram (apenas QR, sem métricas) */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-md p-6 text-center flex flex-col items-center"
            role="region"
            aria-labelledby="qr-instagram"
          >
            <h2
              id="qr-instagram"
              className="text-lg font-semibold mb-2 flex items-center gap-2"
            >
              <Instagram className="w-5 h-5 text-pink-600" />
              Instagram da Escola
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Siga{" "}
              <span className="font-medium">@escoladasaudesms</span> para novidades e eventos.
            </p>
            {/* QR dinâmico apontando para o perfil */}
            <QrSiteEscola size={300} showLogo={false} url={INSTAGRAM_URL} />
          </motion.section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
