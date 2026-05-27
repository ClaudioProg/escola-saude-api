// ✅ src/components/layout/CabecalhoPagina.jsx — v2.0
// Plataforma Escola da Saúde
//
// Cabeçalho compacto oficial de página.
//
// Revisão premium:
// - componente estrutural de layout;
// - usado em páginas internas, listas, formulários e áreas administrativas;
// - não substitui HeaderHero.jsx;
// - contrato oficial em português;
// - sem aliases;
// - sem compatibilidade legada;
// - sem gradiente livre por string;
// - largura controlada por enum;
// - tons controlados;
// - mobile-first;
// - acessível;
// - sticky com glass effect;
// - loading skeleton;
// - print-safe;
// - reduced motion via framer-motion.

import { useId } from "react";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

const TOM_CLASSES = {
  petroleo: {
    fundo: "from-slate-950 via-cyan-950 to-teal-800",
    solido: "bg-cyan-950",
    borda: "border-cyan-900/30",
    brilho: "bg-cyan-300/14",
    icone: "bg-white/14 text-white ring-white/20",
  },
  saude: {
    fundo: "from-emerald-900 via-emerald-800 to-teal-700",
    solido: "bg-emerald-800",
    borda: "border-emerald-900/30",
    brilho: "bg-emerald-300/16",
    icone: "bg-white/14 text-white ring-white/20",
  },
  violeta: {
    fundo: "from-violet-950 via-indigo-900 to-fuchsia-800",
    solido: "bg-violet-800",
    borda: "border-violet-900/30",
    brilho: "bg-violet-300/14",
    icone: "bg-white/14 text-white ring-white/20",
  },
  dourado: {
    fundo: "from-amber-900 via-orange-800 to-yellow-700",
    solido: "bg-amber-800",
    borda: "border-amber-900/30",
    brilho: "bg-amber-200/16",
    icone: "bg-white/14 text-white ring-white/20",
  },
  laranja: {
    fundo: "from-orange-900 via-orange-800 to-rose-700",
    solido: "bg-orange-800",
    borda: "border-orange-900/30",
    brilho: "bg-orange-200/16",
    icone: "bg-white/14 text-white ring-white/20",
  },
  rosa: {
    fundo: "from-rose-900 via-fuchsia-900 to-pink-800",
    solido: "bg-rose-800",
    borda: "border-rose-900/30",
    brilho: "bg-pink-200/14",
    icone: "bg-white/14 text-white ring-white/20",
  },
  cinza: {
    fundo: "from-zinc-950 via-slate-900 to-stone-800",
    solido: "bg-slate-800",
    borda: "border-slate-900/30",
    brilho: "bg-white/10",
    icone: "bg-white/14 text-white ring-white/20",
  },
};

const TAMANHO_CLASSES = {
  sm: {
    painel: "px-3 py-3 md:px-4 md:py-3.5",
    titulo: "text-base md:text-lg",
    subtitulo: "text-xs md:text-sm",
    iconeBox: "h-10 w-10 rounded-2xl",
    icone: "h-5 w-5",
  },
  md: {
    painel: "px-4 py-4 md:px-5 md:py-4.5",
    titulo: "text-lg md:text-xl",
    subtitulo: "text-sm",
    iconeBox: "h-11 w-11 rounded-2xl",
    icone: "h-5 w-5",
  },
  lg: {
    painel: "px-4 py-5 md:px-6 md:py-5",
    titulo: "text-xl md:text-2xl",
    subtitulo: "text-sm md:text-base",
    iconeBox: "h-12 w-12 rounded-3xl",
    icone: "h-6 w-6",
  },
};

const LARGURA_CLASSES = {
  conteudo: "max-w-7xl",
  leitura: "max-w-5xl",
  total: "max-w-none",
};

const ALINHAMENTO_CLASSES = {
  esquerda: {
    bloco: "text-left",
    linha: "justify-start",
    acoes: "justify-start md:justify-end",
  },
  centro: {
    bloco: "text-center",
    linha: "justify-center",
    acoes: "justify-center",
  },
};

const NIVEL_TITULO = {
  1: "h1",
  2: "h2",
  3: "h3",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getTom(tom) {
  return TOM_CLASSES[tom] || TOM_CLASSES.petroleo;
}

function getTamanho(tamanho) {
  return TAMANHO_CLASSES[tamanho] || TAMANHO_CLASSES.md;
}

function getLargura(largura) {
  return LARGURA_CLASSES[largura] || LARGURA_CLASSES.conteudo;
}

function getAlinhamento(alinhamento) {
  return ALINHAMENTO_CLASSES[alinhamento] || ALINHAMENTO_CLASSES.centro;
}

function getTituloTag(nivelTitulo) {
  return NIVEL_TITULO[nivelTitulo] || "h1";
}

function SkeletonTitulo({ subtitulo }) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2" aria-hidden="true">
      <div className="h-5 w-2/3 animate-pulse rounded-xl bg-white/35" />

      {subtitulo && (
        <div className="h-3 w-1/2 animate-pulse rounded-xl bg-white/25" />
      )}
    </div>
  );
}

function SkeletonAcoes() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <div className="h-10 w-24 animate-pulse rounded-2xl bg-white/25" />
      <div className="h-10 w-20 animate-pulse rounded-2xl bg-white/25" />
    </div>
  );
}

export default function CabecalhoPagina({
  titulo,
  icone: Icone = Sparkles,
  subtitulo,
  acoes,
  trilha,
  alinhamento = "centro",
  nivelTitulo = 1,
  tom = "petroleo",
  gradiente = true,
  carregando = false,
  fixo = false,
  compacto = false,
  ocultarImpressao = true,
  className = "",
  iconeClassName = "",
  intensidade = "suave",
  comBorda = true,
  largura = "conteudo",
}) {
  const headingId = useId();
  const subtitleId = useId();
  const reduzirMovimento = useReducedMotion();

  const HeadingTag = getTituloTag(nivelTitulo);
  const tema = getTom(tom);
  const tamanho = getTamanho(compacto ? "sm" : "md");
  const alinhamentoClasse = getAlinhamento(alinhamento);
  const larguraClasse = getLargura(largura);

  const usarSolido = intensidade === "solido" || !gradiente;
  const fundoClasse = usarSolido ? tema.solido : classNames("bg-gradient-to-br", tema.fundo);

  const motionProps = reduzirMovimento
    ? {}
    : {
        initial: { opacity: 0, y: -6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, ease: "easeOut" },
      };

  return (
    <motion.header
      {...motionProps}
      aria-labelledby={headingId}
      aria-describedby={subtitulo ? subtitleId : undefined}
      aria-busy={carregando || undefined}
      aria-live={carregando ? "polite" : undefined}
      className={classNames(
        ocultarImpressao && "print:hidden",
        fixo &&
          "sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md dark:border-white/10 dark:bg-slate-950/75",
        className
      )}
    >
      <div className={classNames("mx-auto w-full px-4", larguraClasse)}>
        {trilha && (
          <div className="mb-2 text-slate-700 dark:text-slate-300">
            {trilha}
          </div>
        )}

        <div
          className={classNames(
            "relative overflow-hidden rounded-3xl text-white shadow-[0_18px_58px_-44px_rgba(2,6,23,.75)]",
            comBorda && "border ring-1 ring-black/5 dark:ring-white/10",
            comBorda && tema.borda,
            fundoClasse,
            tamanho.painel
          )}
        >
          <div className="absolute inset-0 bg-slate-950/12 dark:bg-slate-950/24" aria-hidden="true" />

          <div
            aria-hidden="true"
            className={classNames(
              "pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl",
              tema.brilho
            )}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/0 via-white/60 to-white/0"
          />

          <div className="relative">
            <div
              className={classNames(
                "flex flex-col gap-3 md:flex-row md:items-center md:justify-between",
                alinhamento === "centro" && !acoes && "md:justify-center"
              )}
            >
              <div
                className={classNames(
                  "flex min-w-0 items-center gap-3",
                  alinhamentoClasse.linha
                )}
              >
                {Icone && !carregando && (
                  <span
                    className={classNames(
                      "grid shrink-0 place-items-center shadow-sm ring-1 backdrop-blur",
                      tema.icone,
                      tamanho.iconeBox
                    )}
                    aria-hidden="true"
                  >
                    <Icone
                      className={classNames(tamanho.icone, iconeClassName)}
                    />
                  </span>
                )}

                {carregando ? (
                  <SkeletonTitulo subtitulo={subtitulo} />
                ) : (
                  <div className={classNames("min-w-0", alinhamentoClasse.bloco)}>
                    <HeadingTag
                      id={headingId}
                      className={classNames(
                        "font-black leading-tight tracking-tight",
                        tamanho.titulo
                      )}
                    >
                      {titulo}
                    </HeadingTag>

                    {subtitulo && (
                      <p
                        id={subtitleId}
                        className={classNames(
                          "mt-1 max-w-2xl font-medium leading-relaxed text-white/90",
                          tamanho.subtitulo
                        )}
                      >
                        {subtitulo}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {(acoes || carregando) && (
                <div
                  className={classNames(
                    "flex shrink-0 flex-wrap items-center gap-2",
                    alinhamentoClasse.acoes
                  )}
                >
                  {carregando ? <SkeletonAcoes /> : acoes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

SkeletonTitulo.propTypes = {
  subtitulo: PropTypes.node,
};

CabecalhoPagina.propTypes = {
  titulo: PropTypes.string.isRequired,
  icone: PropTypes.elementType,
  subtitulo: PropTypes.node,
  acoes: PropTypes.node,
  trilha: PropTypes.node,
  alinhamento: PropTypes.oneOf(["centro", "esquerda"]),
  nivelTitulo: PropTypes.oneOf([1, 2, 3]),
  tom: PropTypes.oneOf([
    "petroleo",
    "saude",
    "violeta",
    "dourado",
    "laranja",
    "rosa",
    "cinza",
  ]),
  gradiente: PropTypes.bool,
  carregando: PropTypes.bool,
  fixo: PropTypes.bool,
  compacto: PropTypes.bool,
  ocultarImpressao: PropTypes.bool,
  className: PropTypes.string,
  iconeClassName: PropTypes.string,
  intensidade: PropTypes.oneOf(["suave", "solido"]),
  comBorda: PropTypes.bool,
  largura: PropTypes.oneOf(["conteudo", "leitura", "total"]),
};