import { motion } from "framer-motion";

// Todos os campos de nota, EXCETO desempenho_instrutor
const CAMPOS_NOTA_EVENTO = [
  "divulgacao_evento", "recepcao", "credenciamento", "material_apoio", "pontualidade",
  "sinalizacao_local", "conteudo_temas", "estrutura_local", "acessibilidade", "limpeza",
  "inscricao_online", "exposicao_trabalhos", "apresentacao_oral_mostra",
  "apresentacao_tcrs", "oficinas"
];

// Conversão enum => número
function notaEnumParaNumero(valor) {
  switch ((valor || "").toLowerCase()) {
    case "ótimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "péssimo": return 1;
    default: return null;
  }
}

// Função para calcular médias no novo padrão
function calcularMediasAvaliacoes(avaliacoes) {
  if (!avaliacoes || !avaliacoes.length)
    return { mediaEvento: null, mediainstrutor: null, comentarios: [] };

  // MÉDIA instrutor
  const notasinstrutor = avaliacoes
    .map(a => notaEnumParaNumero(a.desempenho_instrutor))
    .filter(v => v != null);
  const mediainstrutor = notasinstrutor.length
    ? (notasinstrutor.reduce((acc, v) => acc + v, 0) / notasinstrutor.length).toFixed(1)
    : null;

  // MÉDIA EVENTO (todos os outros campos do tipo nota_enum)
  const notasEvento = avaliacoes.map(a => {
    let soma = 0, qtd = 0;
    for (const campo of CAMPOS_NOTA_EVENTO) {
      const v = notaEnumParaNumero(a[campo]);
      if (v != null) {
        soma += v;
        qtd++;
      }
    }
    return qtd ? soma / qtd : null;
  }).filter(v => v != null);
  const mediaEvento = notasEvento.length
    ? (notasEvento.reduce((acc, v) => acc + v, 0) / notasEvento.length).toFixed(1)
    : null;

  // Comentários
  const comentarios = avaliacoes
    .filter(a => a.comentarios_finais && a.comentarios_finais.trim())
    .map(a => ({
      nome: a.nome || a.usuario || null,
      comentario: a.comentarios_finais,
    }));

  return { mediaEvento, mediainstrutor, comentarios };
}

/**
 * Exibe as avaliações do evento, incluindo média do evento, média do instrutor e comentários.
 */
export default function AvaliacoesEvento({ avaliacoes }) {
  const { mediaEvento, mediainstrutor, comentarios } =
    calcularMediasAvaliacoes(avaliacoes);

  const nenhumaAvaliacao =
    (!mediaEvento || mediaEvento === "NaN") &&
    (!mediainstrutor || mediainstrutor === "NaN") &&
    comentarios.length === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-4 text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-sm"
      aria-label="Avaliações do evento"
      tabIndex={0}
      role="region"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📝</span>
        <h3 className="font-bold text-[#1b4332] dark:text-green-200 text-base">
          Avaliações do Evento
        </h3>
      </div>

      {/* Caso não existam avaliações */}
      {nenhumaAvaliacao ? (
        <p className="text-gray-500 dark:text-gray-300">
          Nenhuma avaliação registrada.
        </p>
      ) : (
        <>
          {/* Médias */}
          {mediaEvento && mediaEvento !== "NaN" && (
            <p className="mb-1">
              <strong>Nota média do evento:</strong>{" "}
              <span className="font-bold text-lousa dark:text-green-300">
                {mediaEvento}
              </span>
            </p>
          )}
          {mediainstrutor && mediainstrutor !== "NaN" && (
            <p className="mb-2">
              <strong>Nota média do instrutor:</strong>{" "}
              <span className="font-bold text-lousa dark:text-green-300">
                {mediainstrutor}
              </span>
            </p>
          )}

          {/* Comentários */}
          {comentarios.length > 0 ? (
            <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-200">
              {comentarios.map((c, idx) => (
                <li key={`${idx}-${c.nome ?? "anonimo"}`} tabIndex={0}>
                  💬 {c.comentario ?? "Comentário anônimo"}
                  {c.nome && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">
                      – {c.nome}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 italic mt-2">
              Nenhum comentário textual enviado.
            </p>
          )}
        </>
      )}
    </motion.section>
  );
}
