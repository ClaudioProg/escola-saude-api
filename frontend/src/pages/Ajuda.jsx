// ✅ src/pages/Ajuda.jsx
import Breadcrumbs from "../components/Breadcrumbs";
import AccordionAjuda from "../components/AccordionAjuda";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { HelpCircle } from "lucide-react";

export default function Ajuda() {
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🔵 Faixa de título (azul petróleo, combinando com info/ajuda) */}
      <PageHeader title="Central de Ajuda" icon={HelpCircle} variant="azul" />

      <main role="main" className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        <Breadcrumbs trilha={[{ label: "Início", href: "/" }, { label: "Ajuda" }]} />

        <section aria-label="Perguntas frequentes e tutoriais" className="mt-6">
          <AccordionAjuda />
        </section>
      </main>

      <Footer />
    </div>
  );
}
