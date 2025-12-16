// ✅ src/pages/Ajuda.jsx — premium (kit base Escola)
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HelpCircle,
  BookOpen,
  Search,
  Sparkles,
  LifeBuoy,
  ShieldCheck,
  Timer,
  ArrowRight,
} from "lucide-react";

import AccordionAjuda from "../components/AccordionAjuda";
import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── MiniStat (premium) ───────── */
function MiniStat({ icon: Icon, title, desc, isDark }) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 transition-all",
        isDark
          ? "bg-zinc-900/55 border-white/10 hover:bg-white/5"
          : "bg-white border-slate-200 shadow-sm hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "shrink-0 rounded-2xl p-2 border",
            isDark
              ? "bg-amber-500/10 border-white/10 text-amber-300"
              : "bg-amber-50 border-amber-100 text-amber-800",
          ].join(" ")}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-5">{title}</p>
          <p className={["text-sm mt-1", isDark ? "text-zinc-300" : "text-slate-600"].join(" ")}>
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── HeaderHero premium (paleta fixa da página) ───────── */
function HeaderHero({ onManual, onFaq, theme, setTheme, isDark }) {
  // ✅ paleta fixa (âmbar → amarelo)
  const gradient = "from-amber-900 via-amber-700 to-yellow-600";

  return (
    <header className="relative overflow-hidden" role="banner">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        {/* toggle */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills theme={theme} setTheme={setTheme} variant="glass" />
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" />
            <span>Portal oficial • suporte e orientações</span>
          </div>

          <div className="inline-flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-white" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Central de Ajuda
            </h1>
          </div>

          <p className="text-sm text-white/90 max-w-2xl">
            Dúvidas rápidas no FAQ ou passo a passo no Manual do Usuário.
          </p>

          <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-center">
            <BotaoPrimario
              onClick={onManual}
              variante="secundario"
              icone={<BookOpen className="w-4 h-4" />}
              aria-label="Ver Manual do Usuário"
              className="w-full sm:w-auto"
            >
              Ver Manual
            </BotaoPrimario>

            <BotaoPrimario
              onClick={onFaq}
              variante="secundario"
              icone={<Search className="w-4 h-4" />}
              aria-label="Ir para o FAQ"
              className="w-full sm:w-auto"
            >
              Ir para o FAQ
            </BotaoPrimario>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function Ajuda() {
  const navigate = useNavigate();
  const { theme, setTheme, isDark } = useEscolaTheme();

  const [q, setQ] = useState("");

  useEffect(() => {
    document.title = "Central de Ajuda — Escola da Saúde";
  }, []);

  const irParaManual = useCallback(() => navigate("/usuario/manual"), [navigate]);
  const irParaFaq = useCallback(() => {
    const el = document.getElementById("faq");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // 🔎 “busca” (UX): só guia o usuário + destaca que o FAQ está abaixo
  // (sem mexer no AccordionAjuda; se você quiser, eu adapto o Accordion para filtrar de verdade)
  const dicaBusca = useMemo(() => {
    const s = String(q || "").trim();
    if (!s) return "Dica: digite palavras como “certificado”, “presença”, “avaliação”, “login”…";
    return `Buscando por: “${s}”. Role até o FAQ e procure os tópicos relacionados.`;
  }, [q]);

  const inputCls = (hasErr) =>
    [
      "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
      "focus:ring-2 focus:ring-amber-500/70",
      isDark
        ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
        : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
      hasErr ? "ring-2 ring-red-500/60 border-red-500/60" : "",
    ].join(" ");

  return (
    <main
      className={[
        "min-h-screen flex flex-col transition-colors",
        isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      <HeaderHero
        onManual={irParaManual}
        onFaq={irParaFaq}
        theme={theme}
        setTheme={setTheme}
        isDark={isDark}
      />

      <section id="conteudo" role="main" className="flex-1">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-12">
          {/* ministats */}
          <section
            aria-label="Atalhos e compromissos de suporte"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6"
          >
            <MiniStat
              icon={LifeBuoy}
              title="Ajuda rápida"
              desc="FAQ com dúvidas comuns e orientações práticas."
              isDark={isDark}
            />
            <MiniStat
              icon={ShieldCheck}
              title="Conta & segurança"
              desc="Boas práticas para acesso, senha e dados."
              isDark={isDark}
            />
            <MiniStat
              icon={Timer}
              title="Economize tempo"
              desc="Manual com passo a passo para as rotinas mais usadas."
              isDark={isDark}
            />
          </section>

          {/* busca + card principal */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* card de busca/guia */}
            <aside className="lg:col-span-5">
              <div
                className={[
                  "rounded-3xl border p-6 transition-all",
                  isDark
                    ? "bg-zinc-900/55 border-white/10 hover:bg-white/5"
                    : "bg-white border-slate-200 shadow-sm hover:shadow-md",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "h-12 w-12 rounded-2xl flex items-center justify-center border",
                      isDark ? "bg-amber-500/10 border-white/10" : "bg-amber-50 border-amber-100",
                    ].join(" ")}
                  >
                    <Search className={["h-6 w-6", isDark ? "text-amber-300" : "text-amber-800"].join(" ")} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-extrabold">Pesquisar no FAQ</h2>
                    <p className={["text-xs", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                      Dica: use palavras-chave curtas.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold" htmlFor="busca-ajuda">
                    O que você precisa?
                  </label>
                  <input
                    id="busca-ajuda"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className={inputCls(false)}
                    placeholder="Ex.: certificado, presença, avaliação, login…"
                    autoComplete="off"
                    inputMode="search"
                  />
                  <p className={["text-[11px] mt-2", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                    {dicaBusca}
                  </p>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <BotaoPrimario
                    onClick={irParaFaq}
                    className="w-full"
                    aria-label="Abrir FAQ"
                    icone={<ArrowRight className="w-4 h-4" />}
                  >
                    Abrir FAQ
                  </BotaoPrimario>

                  <BotaoPrimario
                    onClick={irParaManual}
                    className="w-full"
                    variante="secundario"
                    aria-label="Abrir Manual do Usuário"
                    icone={<BookOpen className="w-4 h-4" />}
                  >
                    Manual
                  </BotaoPrimario>
                </div>
              </div>
            </aside>

            {/* FAQ */}
            <div className="lg:col-span-7">
              <motion.section
                id="faq"
                aria-label="Perguntas frequentes e tutoriais"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={[
                  "rounded-3xl border p-6 md:p-8",
                  isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white shadow-xl",
                ].join(" ")}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={[
                      "h-11 w-11 rounded-2xl flex items-center justify-center border",
                      isDark ? "bg-amber-500/10 border-white/10" : "bg-amber-50 border-amber-100",
                    ].join(" ")}
                  >
                    <HelpCircle className={["h-5 w-5", isDark ? "text-amber-300" : "text-amber-800"].join(" ")} />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-extrabold">FAQ</h3>
                    <p className={["text-xs", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
                      Perguntas frequentes e orientações rápidas.
                    </p>
                  </div>
                </div>

                <AccordionAjuda />
              </motion.section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
