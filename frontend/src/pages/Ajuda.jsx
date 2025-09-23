// ✅ src/pages/Ajuda.jsx
import { useCallback } from "react";
import AccordionAjuda from "../components/AccordionAjuda";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { HelpCircle, BookOpen, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ───────────────── Hero padronizado (paleta ampliada) ───────────────── */
function HeaderHero({ variant = "amarelo", onManual, onFaq }) {
  const variants = {
    // já existentes
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",
    // novas variações pedidas
    amarelo: "from-yellow-900 via-amber-800 to-yellow-700",
    vermelho: "from-red-900 via-red-800 to-red-700",
    salmon: "from-rose-800 via-orange-700 to-amber-600",
    marrom: "from-stone-900 via-stone-800 to-amber-900",
    preto: "from-neutral-950 via-neutral-900 to-neutral-800",
    verde: "from-emerald-900 via-emerald-800 to-emerald-700",
    azul: "from-blue-900 via-blue-800 to-blue-700",
    rosa: "from-pink-900 via-rose-800 to-pink-700",
  };
  const grad = variants[variant] ?? variants.amarelo;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <HelpCircle className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Central de Ajuda</h1>
        </div>
        <p className="text-sm text-white/90">
          Tire dúvidas rápidas no FAQ ou acesse o Manual do Usuário com passo a passo ilustrado.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <BotaoPrimario
            onClick={onManual}
            variante="secundario"
            icone={<BookOpen className="w-4 h-4" />}
            aria-label="Ver Manual do Usuário"
          >
            Ver Manual
          </BotaoPrimario>
          <BotaoPrimario
            onClick={onFaq}
            variante="secundario"
            icone={<Search className="w-4 h-4" />}
            aria-label="Ir para o FAQ"
          >
            Ir para o FAQ
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

export default function Ajuda() {
  const navigate = useNavigate();
  const irParaManual = useCallback(() => navigate("/usuario/manual"), [navigate]);
  const irParaFaq = useCallback(() => {
    const el = document.getElementById("faq");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟨 Hero amarelo (variando a paleta conforme pedido) */}
      <HeaderHero variant="amarelo" onManual={irParaManual} onFaq={irParaFaq} />

      <main role="main" className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        {/* removemos Breadcrumbs para manter a padronização atual */}
        <section id="faq" aria-label="Perguntas frequentes e tutoriais" className="mt-2">
          <AccordionAjuda />
        </section>
      </main>

      <Footer />
    </div>
  );
}
