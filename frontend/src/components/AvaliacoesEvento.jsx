import { motion } from "framer-motion";

// Campos que entram no cálculo da nota do evento
const CAMPOS_NOTA_EVENTO = [
  "divulgacao_evento", "recepcao", "credenciamento", "material_apoio", "pontualidade",
  "sinalizacao_local", "conteudo_temas", "estrutura_local", "acessibilidade", "limpeza",
  "inscricao_online", "exposicao_trabalhos", "apresentacao_oral_mostra",
  "apresentacao_tcrs", "oficinas"
];

// Conversão enum => número
function notaEnumParaNumero(valor) {
  const normalizado = (valor || "")
    .toLowerCase()
    .normalize("NFD") // separa os acentos
    .replace(/[\u0300-\u036f]/g, ""); // remove os acentos

  switch (normalizado) {
    case "otimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "pessimo": return 1;
    default: return null;
  }
}

// Função de cálculo das médias e extração dos comentários
function calcularMediasAvaliacoes(avaliacoes) {
  if (!avaliacoes || !avaliacoes.length)
    return { mediaEvento: null, mediaInstrutor: null, detalhes: [] };

  // Média do instrutor
  const notasInstrutor = avaliacoes
    .map(a => notaEnumParaNumero(a.desempenho_instrutor))
    .filter(n => n != null);

  const mediaInstrutor = notasInstrutor.length
    ? (notasInstrutor.reduce((a, b) => a + b, 0) / notasInstrutor.length).toFixed(1)
    : null;

  // Média do evento (demais campos)
  const mediasEventoIndividuais = avaliacoes.map(avaliacao => {
    let soma = 0, qtd = 0;
    for (const campo of CAMPOS_NOTA_EVENTO) {
      const valor = notaEnumParaNumero(avaliacao[campo]);
      if (valor != null) {
        soma += valor;
        qtd++;
      }
    }
    return qtd ? soma / qtd : null;
  }).filter(n => n != null);

  const mediaEvento = mediasEventoIndividuais.length
    ? (mediasEventoIndividuais.reduce((a, b) => a + b, 0) / mediasEventoIndividuais.length).toFixed(1)
    : null;

  // Comentários detalhados
  const detalhes = avaliacoes
    .filter(a =>
      a.desempenho_instrutor?.trim() ||
      a.gostou_mais?.trim() ||
      a.sugestoes_melhoria?.trim() ||
      a.comentarios_finais?.trim()
    )
    .map(a => ({
      desempenho: a.desempenho_instrutor,
      gostou: a.gostou_mais,
      sugestao: a.sugestoes_melhoria,
      comentario: a.comentarios_finais
    }));

  return { mediaEvento, mediaInstrutor, detalhes };
}

// Componente principal
export default function AvaliacoesEvento({ avaliacoes }) {
  if (!Array.isArray(avaliacoes)) {
    return <p className="text-red-500">Erro: avaliações não carregadas corretamente.</p>;
  }

  const { mediaEvento, mediaInstrutor, detalhes } = calcularMediasAvaliacoes(avaliacoes);

  const nenhumaAvaliacao =
    !mediaEvento && !mediaInstrutor && detalhes.length === 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-4 text-sm bg-gray-100 dark:bg-zinc-800 p-4 rounded-xl shadow-sm"
      aria-label="Avaliações do evento"
    >
      {/* Título */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📝</span>
        <h3 className="font-bold text-[#1b4332] dark:text-green-200 text-base">
          Avaliações do Evento
        </h3>
      </div>

      {/* Nenhuma avaliação */}
      {nenhumaAvaliacao ? (
        <p className="text-gray-500 dark:text-gray-300">
          Nenhuma avaliação registrada.
        </p>
      ) : (
        <>
          {/* Médias */}
          {mediaEvento && (
            <p className="mb-1">
              <strong>Nota média do evento:</strong>{" "}
              <span className="font-bold text-lousa dark:text-green-300">{mediaEvento}</span>
            </p>
          )}
          {mediaInstrutor && (
  <p className="mb-3">
    <strong>Nota média do instrutor:</strong>{" "}
    <span className="font-bold text-lousa dark:text-green-300">
      {(parseFloat(mediaInstrutor) * 2).toFixed(1)}
    </span>
  </p>
)}

          {/* Comentários detalhados */}
          {detalhes.length > 0 && (
  <div className="mt-4 space-y-3">
    {detalhes.map((d, idx) => (
      <div key={idx} className="bg-white dark:bg-zinc-700 p-3 rounded shadow-sm">
        {/* ⚠️ Nome do avaliador removido */}
        {d.desempenho && (
          <p><strong>Desempenho do Instrutor:</strong> {d.desempenho}</p>
        )}
        {d.gostou && (
          <p><strong>O que mais gostou:</strong> {d.gostou}</p>
        )}
        {d.sugestao && (
          <p><strong>Sugestões de melhoria:</strong> {d.sugestao}</p>
        )}
        {d.comentario && (
          <p><strong>Comentários finais:</strong> {d.comentario}</p>
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
