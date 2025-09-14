// 📁 src/components/ModalAvaliacoes.jsx
import PropTypes from "prop-types";
import Modal from "./Modal"; // ✅ usa o Modal padrão do projeto
import { formatarDataBrasileira } from "../utils/data";

const CAMPOS_NOTAS = [
  { chave: "divulgacao_evento", rotulo: "Divulgação do evento" },
  { chave: "recepcao", rotulo: "Recepção" },
  { chave: "credenciamento", rotulo: "Credenciamento" },
  { chave: "material_apoio", rotulo: "Material de apoio" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "sinalizacao_local", rotulo: "Sinalização do local" },
  { chave: "conteudo_temas", rotulo: "Conteúdo / Temas" },
  { chave: "desempenho_instrutor", rotulo: "Desempenho do instrutor" },
  { chave: "estrutura_local", rotulo: "Estrutura do local" },
  { chave: "acessibilidade", rotulo: "Acessibilidade" },
  { chave: "limpeza", rotulo: "Limpeza" },
  { chave: "inscricao_online", rotulo: "Inscrição online" },
  // extras (só mostramos se vier valor)
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

const CAMPOS_TEXTO = [
  { chave: "gostou_mais", rotulo: "O que mais gostou" },
  { chave: "sugestoes_melhoria", rotulo: "Sugestões de melhoria" },
  { chave: "comentarios_finais", rotulo: "Comentários finais" },
];

const corNota = (valor) => {
  const v = (valor || "").toString().toLowerCase();
  if (v.includes("ótimo") || v.includes("otimo")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v.includes("bom")) return "bg-sky-100 text-sky-800 border-sky-200";
  if (v.includes("regular")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (v.includes("ruim")) return "bg-rose-100 text-rose-800 border-rose-200";
  if (v.includes("péssimo") || v.includes("pessimo")) return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

export default function ModalAvaliacoes({ isOpen, onClose, avaliacao }) {
  if (!avaliacao) return null;

  const dataAval =
    avaliacao.data_avaliacao ||
    avaliacao.criado_em ||
    avaliacao.atualizado_em ||
    null;

  const notasVisiveis = CAMPOS_NOTAS.filter(({ chave }) => !!avaliacao[chave]);
  const textosVisiveis = CAMPOS_TEXTO.filter(({ chave }) => avaliacao[chave]);

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <h2 id="titulo-avaliacao" className="text-xl font-bold text-lousa dark:text-white">
          📋 Avaliação do Evento
        </h2>

        {dataAval && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Data da avaliação: <strong>{formatarDataBrasileira(dataAval)}</strong>
          </p>
        )}

        {/* Bloco de notas */}
        {notasVisiveis.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notasVisiveis.map(({ chave, rotulo }) => {
              const valor = avaliacao[chave];
              return (
                <div
                  key={chave}
                  className="p-3 rounded-md border bg-white dark:bg-gray-800 dark:border-gray-700"
                >
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                    {rotulo}
                  </div>
                  <span
                    className={`inline-block text-xs font-bold px-2 py-1 rounded-full border ${corNota(
                      valor
                    )}`}
                  >
                    {valor}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            (Sem notas registradas)
          </p>
        )}

        {/* Campos textuais */}
        {CAMPOS_TEXTO.map(({ chave, rotulo }) => (
          <div key={chave}>
            <strong className="block text-gray-700 dark:text-gray-200 mb-1">
              {rotulo}:
            </strong>
            <p className="bg-white dark:bg-gray-800 border dark:border-gray-700 p-2 rounded-md text-sm text-gray-700 dark:text-gray-200 min-h-[2.5rem]">
              {avaliacao[chave] || "—"}
            </p>
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}

ModalAvaliacoes.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  avaliacao: PropTypes.object, // estrutura flexível
};
