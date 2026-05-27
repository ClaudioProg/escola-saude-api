// ✅ src/components/layout/HeaderHero.jsx — v2.2
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde

import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { getCampanhaSaudeVisual } from "../../utils/campanhaSaudeVisual";

const TAMANHO_CLASSES = {
  sm: {
    padding: "py-4 md:py-5",
    titulo: "text-xl md:text-2xl",
    subtitulo: "text-xs md:text-sm",
    iconeBox: "h-11 w-11 rounded-2xl",
    icone: "h-5 w-5",
  },
  md: {
    padding: "py-5 md:py-7",
    titulo: "text-2xl md:text-3xl",
    subtitulo: "text-sm md:text-[15px]",
    iconeBox: "h-12 w-12 rounded-2xl",
    icone: "h-6 w-6",
  },
  lg: {
    padding: "py-7 md:py-9",
    titulo: "text-3xl md:text-4xl",
    subtitulo: "text-base md:text-[17px]",
    iconeBox: "h-14 w-14 rounded-3xl",
    icone: "h-7 w-7",
  },
};

const RAIO_CLASSES = {
  md: "rounded-2xl",
  lg: "rounded-3xl",
  xl: "rounded-[2rem]",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getTamanho(tamanho) {
  return TAMANHO_CLASSES[tamanho] || TAMANHO_CLASSES.md;
}

function getRaio(raio) {
  return RAIO_CLASSES[raio] || RAIO_CLASSES.lg;
}

function isTemaClaro(campanha) {
  return campanha.textoContraste === "escuro";
}

function getGradeStyle(claro) {
  return {
    backgroundImage: claro
      ? "linear-gradient(to right, rgba(15,23,42,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,.06) 1px, transparent 1px)"
      : "linear-gradient(to right, rgba(255,255,255,.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px)",
    backgroundSize: "38px 38px",
  };
}

function getPontosStyle(claro) {
  return {
    backgroundImage: claro
      ? "radial-gradient(circle at 1px 1px, rgba(15,23,42,.18) 1px, transparent 1px)"
      : "radial-gradient(circle at 1px 1px, rgba(255,255,255,.32) 1px, transparent 1px)",
    backgroundSize: "20px 20px",
  };
}

export default function HeaderHero({
  titulo,
  subtitulo,
  icone: Icone = Sparkles,
  campanhaMes,
  tamanho = "md",
  trilha,
  acoes,
  children,
  mostrarGrade = true,
  mostrarPontos = true,
  mostrarBrilhos = true,
  raio = "lg",
  sombra = true,
  className = "",
}) {
  const reduzirMovimento = useReducedMotion();

  const campanha = getCampanhaSaudeVisual(campanhaMes);
  const claro = isTemaClaro(campanha);

  const tamanhoClasse = getTamanho(tamanho);
  const raioClasse = getRaio(raio);

  const motionProps = reduzirMovimento
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.22, ease: "easeOut" },
      };

  const chipClass = claro
    ? "border-white/70 bg-white/58 text-slate-800 shadow-sm backdrop-blur-md"
    : "border-white/25 bg-white/10 text-white/92 shadow-sm backdrop-blur-md";

  const acoesClass = claro
    ? "border-white/70 bg-white/62 shadow-sm backdrop-blur-md"
    : "border-white/20 bg-white/10 shadow-[0_14px_36px_rgba(0,0,0,.16)] backdrop-blur-md";

  return (
    <motion.header
      {...motionProps}
      className={classNames(
        "relative isolate overflow-hidden border ring-1 ring-black/5 dark:ring-white/10",
        raioClasse,
        campanha.bordaHero,
        sombra &&
          "shadow-[0_20px_64px_-50px_rgba(2,6,23,.55)] dark:shadow-[0_24px_80px_-50px_rgba(0,0,0,.75)]",
        className
      )}
      aria-labelledby="header-hero-titulo"
    >
      <div
        className={classNames(
          "absolute inset-0 bg-gradient-to-br",
          campanha.gradienteHero
        )}
        aria-hidden="true"
      />

      <div
        className={classNames("absolute inset-0", campanha.overlayHero)}
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 top-0" aria-hidden="true">
        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 -top-2 h-8 bg-gradient-to-r from-transparent via-white/24 to-transparent blur-2xl" />
      </div>

      {mostrarGrade && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.13] dark:opacity-[0.18]"
          style={getGradeStyle(claro)}
        />
      )}

      {mostrarPontos && (
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08] dark:opacity-[0.12]"
          style={getPontosStyle(claro)}
        />
      )}

      {mostrarBrilhos && (
        <>
          <div
            aria-hidden="true"
            className={classNames(
              "absolute -left-20 -top-24 h-56 w-56 rounded-full blur-3xl",
              campanha.brilhoPrimario
            )}
          />

          <div
            aria-hidden="true"
            className={classNames(
              "absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-3xl",
              campanha.brilhoSecundario
            )}
          />

          {!reduzirMovimento && (
            <div
              aria-hidden="true"
              className="absolute right-16 top-8 h-32 w-32 rounded-full bg-white/8 blur-3xl"
            />
          )}
        </>
      )}

      <div className="relative">
        <div
          className={classNames(
            "mx-auto max-w-7xl px-4 sm:px-6",
            tamanhoClasse.padding
          )}
        >
          {trilha && (
            <div className="mb-3">
              <div
                className={classNames(
                  "inline-flex max-w-full items-center gap-2 rounded-2xl border px-3 py-1.5 text-[11px] font-black",
                  chipClass
                )}
              >
                {trilha}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {Icone && (
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 rounded-[inherit] bg-white/20 blur-xl"
                    aria-hidden="true"
                  />

                  <div
                    className={classNames(
                      "relative grid place-items-center shadow-[0_12px_30px_rgba(0,0,0,.16)] backdrop-blur-md ring-1",
                      claro
                        ? "bg-white/62 text-slate-950"
                        : "bg-white/16 text-white",
                      campanha.anelHero,
                      tamanhoClasse.iconeBox
                    )}
                  >
                    <Icone className={tamanhoClasse.icone} aria-hidden="true" />
                  </div>
                </div>
              )}

              <div className="min-w-0">
                <h1
                  id="header-hero-titulo"
                  className={classNames(
                    "font-black leading-tight tracking-tight",
                    campanha.textoHero,
                    tamanhoClasse.titulo
                  )}
                >
                  {titulo}
                </h1>

                {subtitulo && (
                  <p
                    className={classNames(
                      "mt-1.5 max-w-3xl font-medium leading-relaxed",
                      campanha.textoSuaveHero,
                      tamanhoClasse.subtitulo
                    )}
                  >
                    {subtitulo}
                  </p>
                )}

                {children && <div className="mt-3">{children}</div>}
              </div>
            </div>

            {acoes && (
              <div className="w-full shrink-0 sm:w-auto">
                <div className={classNames("rounded-3xl border p-2", acoesClass)}>
                  {acoes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

HeaderHero.propTypes = {
  titulo: PropTypes.string.isRequired,
  subtitulo: PropTypes.string,
  icone: PropTypes.elementType,
  campanhaMes: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tamanho: PropTypes.oneOf(["sm", "md", "lg"]),
  trilha: PropTypes.node,
  acoes: PropTypes.node,
  children: PropTypes.node,
  mostrarGrade: PropTypes.bool,
  mostrarPontos: PropTypes.bool,
  mostrarBrilhos: PropTypes.bool,
  raio: PropTypes.oneOf(["md", "lg", "xl"]),
  sombra: PropTypes.bool,
  className: PropTypes.string,
};