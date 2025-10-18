// 📁 src/components/AvaliacoesEvento.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useMemo, useState, useId } from "react";

/** ✅ Campos válidos para compor a MÉDIA DO EVENTO (11 campos) */
const CAMPOS_NOTA_EVENTO = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

/** Converte enums (Ótimo…Péssimo) → escala 1..5 */
function notaEnumParaNumero(valor) {
  const normalizado = String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  switch (normalizado) {
    case "otimo":
    case "ótimo":
      return 5;
    case "bom":
      return 4;
    case "regular":
      return 3;
    case "ruim":
      return 2;
    case "pessimo":
    case "péssimo":
      return 1;
    default:
      return null;
  }
}

/** Mapeia número 1..5 → rótulo */
const ROTULO_NOTA = {
  5: "Ótimo",
  4: "Bom",
  3: "Regular",
  2: "Ruim",
  1: "Péssimo",
};

/** Formata para "x.x / 5" ou "— / 5" */
function fmtMedia05(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "— / 5";
  return `${n.toFixed(1)} / 5`;
}

/** Calcula médias (evento + instrutor) e extrai comentários */
function calcularMediasAvaliacoes(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
    return { mediaEvento: null, mediaInstrutor: null, detalhes: [], distInstrutor: null };
  }

  // Média do instrutor + distribuição (escala 1..5)
  const notasInstrutor = avaliacoes
    .map((a) => notaEnumParaNumero(a?.desempenho_instrutor))
    .filter((n) => n != null);

  const mediaInstrutor =
    notasInstrutor.length > 0
      ? notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length
      : null;

  const distInstrutor = notasInstrutor.length
    ? [5, 4, 3, 2, 1].map((k) => ({
        nota: k,
        rotulo: ROTULO_NOTA[k],
        qtd: notasInstrutor.filter((n) => n === k).length,
      }))
    : null;

  // Média do evento (apenas 11 campos permitidos) — escala 1..5
  const mediasIndividuaisEvento = avaliacoes
    .map((av) => {
      let soma = 0;
      let qtd = 0;
      for (const campo of CAMPOS_NOTA_EVENTO) {
        const v = notaEnumParaNumero(av?.[campo]);
        if (v != null) {
          soma += v;
          qtd += 1;
        }
      }
      return qtd ? soma / qtd : null;
    })
    .filter((n) => n != null);

  const mediaEvento =
    mediasIndividuaisEvento.length > 0
      ? mediasIndividuaisEvento.reduce((a, b) => a + b, 0) / mediasIndividuaisEvento.length
      : null;

  // Comentários (só inclui se houver texto)
  const detalhes = avaliacoes
    .map((a) => ({
      desempenho: a?.desempenho_instrutor,
      gostou: a?.gostou_mais,
      sugestao: a?.sugestoes_melhoria,
      comentario: a?.comentarios_finais,
    }))
    .filter(
      (d) =>
        d?.desempenho?.toString().trim() ||
        d?.gostou?.toString().trim() ||
        d?.sugestao?.toString().trim() ||
        d?.comentario?.toString().trim()
    );

  return { mediaEvento, mediaInstrutor, detalhes, distInstrutor, totalRespostas: avaliacoes.length };
}

/** ⭐ Renderização simples de estrelas (0..5) */
function Stars({ value = 0, max = 5, className = "" }) {
  const full = Math.round(Number(value) || 0);
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${i < full ? "fill-yellow-400" : "fill-gray-300 dark:fill-gray-600"}`}
        >
          <path d="M10 15.27 15.18 18l-1.64-5.03L18 9.24l-5.19-.04L10 4 7.19 9.2 2 9.24l4.46 3.73L4.82 18z" />
        </svg>
      ))}
    </div>
  );
}

/** Barra compacta para distribuição de notas */
function DistBar({ dist = [], total = 0, accent = "lousa" }) {
  if (!total || !dist?.length) return null;

  const accents = {
    lousa: "bg-emerald-700",
    emerald: "bg-emerald-700",
    violet: "bg-violet-700",
    amber: "bg-amber-600",
    rose: "bg-rose-700",
    teal: "bg-teal-700",
    indigo: "bg-indigo-700",
    petroleo: "bg-slate-800",
    orange: "bg-orange-600",
    sky: "bg-sky-700",
  };
  const bar = accents[accent] ?? accents.lousa;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
        <span>Distribuição (Instrutor)</span>
        <span>{total} respostas</span>
      </div>
      <ul className="space-y-1">
        {dist.map((d) => {
          const pct = total ? Math.round((d.qtd / total) * 100) : 0;
          return (
            <li key={d.nota} className="grid grid-cols-12 items-center gap-2">
              <span className="col-span-2 text-xs text-gray-600 dark:text-gray-300">
                {d.rotulo}
              </span>
              <div className="col-span-8 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className={`h-full ${bar}`}
                  style={{ width: `${pct}%` }}
                  aria-hidden="true"
                />
              </div>
              <span className="col-span-2 text-right text-xs text-gray-600 dark:text-gray-300">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Componente principal */
export default function AvaliacoesEvento({
  avaliacoes,
  accent = "lousa",          // tema/gradiente
  showStars = true,          // exibir estrelas junto da média
  maxComentarios = 3,        // quantos comentários mostrar inicialmente
}) {
  const regionId = useId();
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const resultado = useMemo(
    () => calcularMediasAvaliacoes(avaliacoes),
    [avaliacoes]
  );

  if (!Array.isArray(avaliacoes)) {
    return (
      <p className="text-red-600 dark:text-red-400">
        Erro: avaliações não carregadas corretamente.
      </p>
    );
  }

  const { mediaEvento, mediaInstrutor, detalhes, distInstrutor, totalRespostas } = resultado;
  const nenhumaAvaliacao =
    (mediaEvento == null && mediaInstrutor == null) && (detalhes?.length ?? 0) === 0;

  // Gradientes 3 cores por accent
  const accents = {
    lousa: "from-[#0f2c1f] via-[#114b2d] to-[#166534]",
    emerald: "from-emerald-900 via-emerald-700 to-emerald-600",
    violet: "from-violet-900 via-violet-700 to-violet-600",
    amber: "from-amber-900 via-amber-700 to-amber-600",
    rose: "from-rose-900 via-rose-700 to-rose-600",
    teal: "from-teal-900 via-teal-700 to-teal-600",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    sky: "from-sky-900 via-sky-700 to-sky-600",
  };
  const grad = accents[accent] ?? accents.lousa;

  const comentarios = detalhes || [];
  const visiveis = mostrarTodos ? comentarios : comentarios.slice(0, maxComentarios);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-4 text-sm bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700"
      role="region"
      aria-labelledby={`${regionId}-title`}
      aria-describedby={`${regionId}-desc`}
    >
      {/* Título com gradiente */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden>📝</span>
        <h3
          id={`${regionId}-title`}
          className={`font-bold text-base bg-clip-text text-transparent bg-gradient-to-br ${grad}`}
        >
          Avaliações do Evento
        </h3>
      </div>
      <p id={`${regionId}-desc`} className="sr-only">
        Médias de satisfação do evento e do instrutor, além de comentários enviados pelos participantes.
      </p>

      {/* Nenhuma avaliação */}
      {nenhumaAvaliacao ? (
        <p className="text-gray-600 dark:text-gray-300">
          Nenhuma avaliação registrada.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Médias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mediaEvento != null && (
              <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    Nota média do evento
                  </p>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {fmtMedia05(mediaEvento)}
                  </span>
                </div>
                {showStars && (
                  <div className="mt-1 flex items-center gap-2">
                    <Stars value={mediaEvento} />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {mediaEvento?.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {mediaInstrutor != null && (
              <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    Nota média do instrutor
                  </p>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {fmtMedia05(mediaInstrutor)}
                  </span>
                </div>
                {showStars && (
                  <div className="mt-1 flex items-center gap-2">
                    <Stars value={mediaInstrutor} />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {mediaInstrutor?.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Distribuição do instrutor */}
          {distInstrutor && (
            <div className="rounded-xl bg-gray-50 dark:bg-zinc-700/60 p-3">
              <DistBar dist={distInstrutor} total={totalRespostas} accent={accent} />
            </div>
          )}

          {/* Comentários detalhados */}
          {comentarios.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Comentários ({comentarios.length})
              </h4>

              <div className="space-y-3">
                {visiveis.map((d, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-zinc-700 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
                  >
                    {/* ⚠️ Nome do avaliador não é exibido */}
                    {d.desempenho?.toString().trim() && (
                      <p className="mb-0.5">
                        <strong>Desempenho do Instrutor:</strong> {d.desempenho}
                      </p>
                    )}
                    {d.gostou?.toString().trim() && (
                      <p className="mb-0.5">
                        <strong>O que mais gostou:</strong> {d.gostou}
                      </p>
                    )}
                    {d.sugestao?.toString().trim() && (
                      <p className="mb-0.5">
                        <strong>Sugestões de melhoria:</strong> {d.sugestao}
                      </p>
                    )}
                    {d.comentario?.toString().trim() && (
                      <p>
                        <strong>Comentários finais:</strong> {d.comentario}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {comentarios.length > maxComentarios && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setMostrarTodos((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600/60"
                    aria-expanded={mostrarTodos}
                    aria-controls={`${regionId}-comments`}
                  >
                    {mostrarTodos ? "Mostrar menos" : `Ver mais (${comentarios.length - maxComentarios})`}
                  </button>
                </div>
              )}

              <div id={`${regionId}-comments`} className="sr-only">
                Lista de comentários {mostrarTodos ? "completa" : "parcial"}.
              </div>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

AvaliacoesEvento.propTypes = {
  avaliacoes: PropTypes.arrayOf(PropTypes.object),
  /** Tema/gradiente do componente */
  accent: PropTypes.oneOf([
    "lousa",
    "emerald",
    "violet",
    "amber",
    "rose",
    "teal",
    "indigo",
    "petroleo",
    "orange",
    "sky",
  ]),
  /** Exibir estrelas nas médias */
  showStars: PropTypes.bool,
  /** Quantidade inicial de comentários visíveis */
  maxComentarios: PropTypes.number,
};
