import Modal from "react-modal";
import { useState } from "react";
import { toast } from "react-toastify";

const opcoes = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const camposNotasBase = [
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
];

const obrigatorios = [
  "divulgacao_evento", "recepcao", "credenciamento", "material_apoio", "pontualidade",
  "sinalizacao_local", "conteudo_temas", "estrutura_local", "acessibilidade", "limpeza",
  "inscricao_online", "exposicao_trabalhos", "desempenho_instrutor"
];

export default function ModalAvaliacaoFormulario({ isOpen, onClose, evento, turma_id, recarregar }) {
  const [comentarios_finais, setComentariosFinais] = useState("");
  const [gostou_mais, setGostouMais] = useState("");
  const [sugestoes_melhoria, setSugestoesMelhoria] = useState("");
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);

  if (!evento) return null;

  const tipo = (evento.tipo || "").toLowerCase();

  const camposNotas = [
    ...camposNotasBase,
    ...(["congresso", "simpósio"].includes(tipo)
      ? [{ chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" }]
      : []),
    ...(tipo === "congresso"
      ? [
          { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
          { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
          { chave: "oficinas", rotulo: "Oficinas" },
        ]
      : []),
  ];

  function handleNotaChange(campo, valor) {
    setNotas((prev) => ({ ...prev, [campo]: valor }));
  }

  async function enviarAvaliacao() {
    const token = localStorage.getItem("token");
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

    if (!usuario?.id) {
      toast.error("Usuário não identificado.");
      return;
    }

    const faltando = obrigatorios.filter((campo) => {
      if (
        campo === "exposicao_trabalhos" &&
        !["congresso", "simpósio"].includes(tipo)
      ) return false;
      return !notas[campo];
    });

    if (faltando.length > 0) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setEnviando(true);
      const res = await fetch("http://escola-saude-api.onrender.com/api/avaliacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          evento_id: evento.id,
          turma_id,
          ...notas,
          gostou_mais,
          sugestoes_melhoria,
          comentarios_finais,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao enviar avaliação");

      toast.success("✅ Avaliação enviada com sucesso!");
      onClose();
      if (recarregar) recarregar();
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      ariaHideApp={false}
      className="modal w-[95%] max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white dark:bg-gray-900 rounded-lg shadow-lg"
      overlayClassName="overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
      <h2 className="text-2xl font-bold text-lousa dark:text-green-100 mb-4">
        ✍️ Avaliar: {evento.nome}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
        {camposNotas.map(({ chave, rotulo }) => (
          <div key={chave}>
            <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
              {rotulo}{obrigatorios.includes(chave) &&
                (chave !== "exposicao_trabalhos" || ["congresso", "simpósio"].includes(tipo))
                ? " *" : ""}
            </label>
            <select
              className="w-full border rounded-md px-2 py-1 dark:bg-gray-800 dark:text-white"
              value={notas[chave] || ""}
              onChange={(e) => handleNotaChange(chave, e.target.value)}
            >
              <option value="">Selecione</option>
              {opcoes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
          O que você mais gostou?
        </label>
        <textarea
          className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-white"
          rows={2}
          value={gostou_mais}
          onChange={(e) => setGostouMais(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
          Sugestões de melhoria
        </label>
        <textarea
          className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-white"
          rows={2}
          value={sugestoes_melhoria}
          onChange={(e) => setSugestoesMelhoria(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
          Comentários finais
        </label>
        <textarea
          className="w-full border rounded-md px-3 py-2 dark:bg-gray-800 dark:text-white"
          rows={3}
          value={comentarios_finais}
          onChange={(e) => setComentariosFinais(e.target.value)}
        />
      </div>

      <div className="flex justify-end mt-6 space-x-3">
        <button
          className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-black dark:text-white hover:bg-gray-400"
          onClick={onClose}
          disabled={enviando}
        >
          Cancelar
        </button>
        <button
          className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700"
          onClick={enviarAvaliacao}
          disabled={enviando}
        >
          {enviando ? "Enviando..." : "Enviar Avaliação"}
        </button>
      </div>
    </Modal>
  );
}
