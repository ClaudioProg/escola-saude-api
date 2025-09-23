// 📁 src/pages/Teste.jsx
import Footer from "../components/Footer";
import { ClipboardCheck } from "lucide-react";

/* ───────────────── Hero padronizado ───────────────── */
function HeaderHero({ variant = "indigo" }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",
    amarelo: "from-yellow-900 via-amber-800 to-yellow-700",
    vermelho: "from-red-900 via-red-800 to-red-700",
    salmon: "from-rose-800 via-orange-700 to-amber-600",
    marrom: "from-stone-900 via-stone-800 to-amber-900",
    preto: "from-neutral-950 via-neutral-900 to-neutral-800",
    verde: "from-emerald-900 via-emerald-800 to-emerald-700",
    azul: "from-blue-900 via-blue-800 to-blue-700",
    rosa: "from-pink-900 via-rose-800 to-pink-700",
  };
  const grad = variants[variant] ?? variants.indigo;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Teste do Curso</h1>
        </div>
        <p className="text-sm text-white/90">
          Responda avaliações dos cursos que possuem testes habilitados.
        </p>
      </div>
    </header>
  );
}

export default function Teste() {
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero variant="indigo" />
      <main role="main" className="flex-1 px-4 py-8">
        <section className="max-w-3xl mx-auto">
          <div
            className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center bg-white dark:bg-zinc-800 shadow-sm"
            role="status"
            aria-live="polite"
          >
            <p className="text-lg font-semibold">Página em Desenvolvimento</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
