// 📁 src/components/AvaliacoesEvento.jsx
import { motion } from "framer-motion";
import PropTypes from "prop-types";
import { useMemo } from "react";

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
      return 5;
    case "bom":
      return 4;
    case "regular":
      return 3;
    case "ruim":
      return 2;
    case "pessimo":
      return 1;
    default:
      return null;
  }
}

/** Formata para "x.x / 5" ou "— / 5" */
function fmtMedia05(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "— / 5";
  return `${n.toFixed(1)} / 5`;
}

/** Calcula médias (evento + instrutor) e extrai comentários */
function calcularMediasAvaliacoes(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
    return { mediaEvento: null, mediaInstrutor: null, detalhes: [] };
  }

  // Média do instrutor (desempenho_instrutor) — escala 1..5
  const notasInstrutor = avaliacoes
    .map((a) => notaEnumParaNumero(a?.desempenho_instrutor))
    .filter((n) => n != null);
  const mediaInstrutor =
    notasInstrutor.length > 0
      ? notasInstrutor.reduce((acc, v) => acc + v, 0) / notasInstrutor.length
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
      ? mediasIndividuaisEvento.reduce((a, b) => a + b, 0) /
        mediasIndividuaisEvento.length
      : null;

  // Comentários (só inclui se houver texto)
  const detalhes = avaliacoes
    .filter(
      (a) =>
        a?.desempenho_instrutor?.toString().trim() ||
        a?.gostou_mais?.toString().trim() ||
        a?.sugestoes_melhoria?.toString().trim() ||
        a?.comentarios_finais?.toString().trim()
    )
    .map((a) => ({
      desempenho: a?.desempenho_instrutor,
      gostou: a?.gostou_mais,
      sugestao: a?.sugestoes_melhoria,
      comentario: a?.comentarios_finais,
    }));

  return { mediaEvento, mediaInstrutor, detalhes };
}

/** Componente principal */
export default function AvaliacoesEvento({ avaliacoes }) {
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

  const { mediaEvento, mediaInstrutor, detalhes } = resultado;
  const nenhumaAvaliacao =
    (mediaEvento == null && mediaInstrutor == null) &&
    (detalhes?.length ?? 0) === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="mt-4 text-sm bg-gray-100 dark:bg-zinc-800 p-4 rounded-xl shadow-sm"
      aria-label="Avaliações do evento"
    >
      {/* Título */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📝</span>
        <h3 className="font-bold text-verde-900 dark:text-verde-900/80 text-base">
          Avaliações do Evento
        </h3>
      </div>

      {/* Nenhuma avaliação */}
      {nenhumaAvaliacao ? (
        <p className="text-gray-600 dark:text-gray-300">
          Nenhuma avaliação registrada.
        </p>
      ) : (
        <>
          {/* Médias */}
          {mediaEvento != null && (
            <p className="mb-1">
              <strong>Nota média do evento:</strong>{" "}
              <span className="font-bold text-verde-900 dark:text-verde-900/80">
                {fmtMedia05(mediaEvento)}
              </span>
            </p>
          )}
          {mediaInstrutor != null && (
            <p className="mb-3">
              <strong>Nota média do instrutor:</strong>{" "}
              <span className="font-bold text-verde-900 dark:text-verde-900/80">
                {fmtMedia05(mediaInstrutor)}
              </span>
            </p>
          )}

          {/* Comentários detalhados */}
          {detalhes?.length > 0 && (
            <div className="mt-4 space-y-3">
              {detalhes.map((d, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-zinc-700 p-3 rounded-lg shadow-sm"
                >
                  {/* ⚠️ Nome do avaliador não é exibido */}
                  {d.desempenho?.toString().trim() && (
                    <p>
                      <strong>Desempenho do Instrutor:</strong> {d.desempenho}
                    </p>
                  )}
                  {d.gostou?.toString().trim() && (
                    <p>
                      <strong>O que mais gostou:</strong> {d.gostou}
                    </p>
                  )}
                  {d.sugestao?.toString().trim() && (
                    <p>
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
          )}
        </>
      )}
    </motion.section>
  );
}

AvaliacoesEvento.propTypes = {
  avaliacoes: PropTypes.arrayOf(PropTypes.object),
};
