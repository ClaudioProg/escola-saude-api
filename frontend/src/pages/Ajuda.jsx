// ✅ src/pages/Ajuda.jsx
import { useCallback } from "react";
import AccordionAjuda from "../components/AccordionAjuda";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import { HelpCircle, BookOpen, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ───────────────── HeaderHero (paleta fixa desta página) ─────────────────
   Regras aplicadas:
   • Ícone e título na MESMA linha
   • Paleta exclusiva (3 cores) para a página
   • Skip-link para acessibilidade
   • Sem variações/props de cor (padronização entre páginas)
--------------------------------------------------------------------------- */
function HeaderHero({ onManual, onFaq }) {
  // Paleta fixa da Central de Ajuda (3 cores)
  const gradient = "from-amber-900 via-amber-700 to-yellow-600";

  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      {/* Skip-link para navegação por teclado/leitores de tela */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <HelpCircle className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Central de Ajuda
          </h1>
        </div>

        <p className="text-sm text-white/90">
          Dúvidas rápidas no FAQ ou passo a passo ilustrado no Manual do Usuário.
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
      <HeaderHero onManual={irParaManual} onFaq={irParaFaq} />

      <main id="conteudo" role="main" className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        <section id="faq" aria-label="Perguntas frequentes e tutoriais" className="mt-2">
          <AccordionAjuda />
        </section>
      </main>

      <Footer />
    </div>
  );
}
