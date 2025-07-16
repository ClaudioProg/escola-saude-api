// 📁 src/components/ModalAvaliacoes.jsx
import Modal from "react-modal";
import { formatarDataBrasileira } from "../utils/data";

export default function ModalAvaliacoes({ isOpen, onClose, avaliacao }) {
  if (!avaliacao) return null;

  const camposNotas = [
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
    { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
    { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
    { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
    { chave: "oficinas", rotulo: "Oficinas" },
  ];

  const camposTexto = [
    { chave: "gostou_mais", rotulo: "O que mais gostou" },
    { chave: "sugestoes_melhoria", rotulo: "Sugestões de melhoria" },
    { chave: "comentarios_finais", rotulo: "Comentários finais" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-lousa dark:text-white">📋 Avaliação do Evento</h2>

        <p className="text-sm text-gray-600">
          Data da avaliação: <strong>{formatarDataBrasileira(avaliacao.data_avaliacao)}</strong>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {camposNotas.map(({ chave, rotulo }) => (
            <div key={chave} className="bg-gray-50 p-3 rounded-md shadow-sm">
              <strong>{rotulo}:</strong>
              <div className="text-teal-700">{avaliacao[chave] || "—"}</div>
            </div>
          ))}
        </div>

        {camposTexto.map(({ chave, rotulo }) => (
          <div key={chave}>
            <strong>{rotulo}:</strong>
            <p className="bg-white border p-2 rounded-md text-sm text-gray-700">
              {avaliacao[chave] || "—"}
            </p>
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}
