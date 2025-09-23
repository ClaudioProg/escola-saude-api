// 📁 src/pages/QrDoSite.jsx
import { useCallback } from "react";
import QrSiteEscola from "../components/QrSiteEscola";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { QrCode, ExternalLink, Copy } from "lucide-react";
import { toast } from "react-toastify";

const SITE_URL = "https://escoladasaude.vercel.app";

/* ───────────────── Hero padronizado ───────────────── */
function HeaderHero({ variant = "teal", onOpen, onCopy }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",
  };
  const grad = variants[variant] ?? variants.teal;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <QrCode className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">QR do Site</h1>
        </div>
        <p className="text-sm text-white/90">
          Escaneie para acessar o site oficial da Escola da Saúde.
        </p>

        <div className="flex flex-wrap gap-2 justify-center">
          <BotaoPrimario
            onClick={onOpen}
            variante="secundario"
            icone={<ExternalLink className="w-4 h-4" />}
            aria-label="Abrir site em nova aba"
          >
            Abrir site
          </BotaoPrimario>
          <BotaoPrimario
            onClick={onCopy}
            variante="secundario"
            icone={<Copy className="w-4 h-4" />}
            aria-label="Copiar link do site"
          >
            Copiar link
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

export default function QrDoSite() {
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

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900">
      {/* 🟩 Hero em teal (variar cores entre páginas) */}
      <HeaderHero variant="teal" onOpen={abrirSite} onCopy={copiarLink} />

      <main role="main" className="flex-1">
        <section className="max-w-3xl mx-auto px-6 py-8 text-center">
          <h2 className="sr-only">QR Code oficial do site da Escola</h2>

          <div
            className="mx-auto max-w-fit bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-sm p-6"
            role="region"
            aria-label="Código QR do site"
          >
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Aponte a câmera do celular para acessar o site oficial da Escola.
            </p>

            {/* ▼ tamanho reduzido ~30% (512 → 360) */}
            <div className="mx-auto">
              <QrSiteEscola size={360} showLogo={false} />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
