// ✅ src/pages/Ajuda.jsx — premium++ (busca filtrável, chips, URL ?q=, atalhos)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Keyboard,
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
  // paleta fixa (âmbar → amarelo)
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

/* ───────── Chips de busca comuns ───────── */
const CHIPS = ["certificado", "presença", "avaliação", "login", "inscrição", "turmas", "instrutor"];

export default function Ajuda() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, isDark } = useEscolaTheme();

  // lê ?q= da URL para preencher a busca
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const initialQ = searchParams.get("q") || "";

  const [q, setQ] = useState(initialQ);
  const inputRef = useRef(null);
  const liveRef = useRef(null);
  const [matchCount, setMatchCount] = useState(null); // retorno do Accordion

  useEffect(() => {
    document.title = "Central de Ajuda — Escola da Saúde";
  }, []);

  // sincronia: atualiza ?q= na URL sem recarregar
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (q) sp.set("q", q);
    else sp.delete("q");
    const newUrl = `${location.pathname}?${sp.toString()}`;
    // evita empilhar histórico se igual
    if (newUrl !== `${location.pathname}${location.search ? `?${location.search}` : ""}`) {
      navigate(newUrl, { replace: true });
    }
  }, [q, navigate, location.pathname]); // não depende de location.search para evitar loop

  // atalhos: "/" foca busca, "Enter" vai para FAQ
  useEffect(() => {
    const handler = (e) => {
      // ignora quando um input já está focado
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea"].includes(tag);
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Enter" && document.activeElement === inputRef.current) {
        const el = document.getElementById("faq");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // rolar para seção com hash (#faq / #manual) se vier linkado
  useEffect(() => {
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const irParaManual = useCallback(() => navigate("/usuario/manual"), [navigate]);
  const irParaFaq = useCallback(() => {
    const el = document.getElementById("faq");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // dica da busca + contagem
  const dicaBusca = useMemo(() => {
    const s = String(q || "").trim();
    if (!s) return "Dica: digite palavras como “certificado”, “presença”, “avaliação”, “login”…";
    if (matchCount === 0) return `Nenhum tópico encontrado para “${s}”. Tente outra palavra-chave.`;
    if (typeof matchCount === "number") return `Encontrados ${matchCount} tópico(s) para “${s}”. Role até o FAQ.`;
    return `Buscando por: “${s}”. Role até o FAQ e procure os tópicos relacionados.`;
  }, [q, matchCount]);

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

      {/* Subnav sticky — dica de atalho */}
      <div className="sticky top-0 z-20 -mt-px bg-white/70 dark:bg-zinc-950/70 backdrop-blur border-b border-white/30 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-2 text-[11px] sm:text-xs text-slate-600 dark:text-zinc-300 flex items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            <span>
              Atalhos: <kbd className="px-1 rounded border">/</kbd> foca a busca • <kbd className="px-1 rounded border">Enter</kbd> vai ao FAQ
            </span>
          </div>
          <div aria-live="polite" ref={liveRef} className="truncate">{/* mensagens dinâmicas se necessário */}</div>
        </div>
      </div>

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
                  <div className="relative">
                    <input
                      id="busca-ajuda"
                      ref={inputRef}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      className={inputCls(false)}
                      placeholder="Ex.: certificado, presença, avaliação, login…"
                      autoComplete="off"
                      inputMode="search"
                      aria-describedby="ajuda-dica"
                    />
                    {q && (
                      <button
                        type="button"
                        onClick={() => setQ("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded-md bg-black/5 dark:bg-white/10"
                        aria-label="Limpar busca"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <p id="ajuda-dica" className={["text-[11px] mt-2", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
                    {dicaBusca}
                  </p>

                  {/* chips de buscas comuns */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setQ(c)}
                        className={[
                          "px-3 py-1 rounded-full text-xs border transition",
                          isDark
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                        aria-label={`Buscar por ${c}`}
                        title={`Buscar por ${c}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
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

                {/* atalhos visuais */}
                <div className="mt-4 rounded-2xl border text-[11px] px-3 py-2
                                border-amber-200/60 bg-amber-50/60 text-amber-900
                                dark:border-amber-300/20 dark:bg-amber-500/10 dark:text-amber-200">
                  Dica: pressione <kbd className="px-1 rounded border">/</kbd> para focar a busca e
                  <kbd className="ml-1 px-1 rounded border">Enter</kbd> para ir ao FAQ.
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

                {/* 
                  Passamos filterQuery e onMatchCount para o Accordion:
                  - Se o componente suportar, ele filtra e devolve a contagem.
                  - Se ignorar, seguimos com o comportamento atual (retrocompatível).
                */}
                <AccordionAjuda
                  filterQuery={(q || "").trim()}
                  onMatchCount={(n) => setMatchCount(typeof n === "number" ? n : null)}
                />

                {/* estado vazio quando o Accordion reportar 0 matches */}
                {q && matchCount === 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 text-sm">
                    <p className="font-semibold">Nada encontrado para “{q}”.</p>
                    <p className="text-slate-600 dark:text-zinc-300 mt-1">
                      Tente termos como <em>“certificado”</em>, <em>“login”</em>, <em>“presença”</em>,{" "}
                      <em>“avaliação”</em>…
                    </p>
                  </div>
                )}
              </motion.section>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
