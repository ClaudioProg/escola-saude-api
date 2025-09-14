// 📁 src/components/ModalAvaliacaoFormulario.jsx
import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Modal from "./Modal"; // ✅ use o Modal da base
import { apiPost } from "../services/api";

const OPCOES = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

// normaliza strings p/ comparações sem acento/caixa
const norm = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const CAMPOS_BASE = [
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

export default function ModalAvaliacaoFormulario({
  isOpen,
  onClose,
  evento,
  turma_id,
  recarregar,
}) {
  const [comentarios_finais, setComentariosFinais] = useState("");
  const [gostou_mais, setGostouMais] = useState("");
  const [sugestoes_melhoria, setSugestoesMelhoria] = useState("");
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);

  if (!evento) return null;

  const tipoNorm = norm(evento.tipo);
  const isCongresso = tipoNorm === "congresso";
  const isSimposio = tipoNorm === "simposio"; // cobre “simpósio” e “simposio”

  const camposNotas = useMemo(() => {
    const extraSimposioOuCongresso = isCongresso || isSimposio
      ? [{ chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" }]
      : [];
    const extraCongresso = isCongresso
      ? [
          { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
          { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
          { chave: "oficinas", rotulo: "Oficinas" },
        ]
      : [];
    return [...CAMPOS_BASE, ...extraSimposioOuCongresso, ...extraCongresso];
  }, [isCongresso, isSimposio]);

  // obrigatórios dinâmicos
  const obrigatorios = useMemo(() => {
    const base = new Set(CAMPOS_BASE.map((c) => c.chave));
    if (isCongresso || isSimposio) base.add("exposicao_trabalhos");
    return base;
  }, [isCongresso, isSimposio]);

  const handleNotaChange = (campo, valor) =>
    setNotas((prev) => ({ ...prev, [campo]: valor }));

  const enviarAvaliacao = async () => {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (!usuario?.id) {
      toast.error("Usuário não identificado.");
      return;
    }

    // checagem de obrigatórios
    const faltando = [...obrigatorios].filter((c) => !notas[c]);
    if (faltando.length) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setEnviando(true);
      await apiPost("/api/avaliacoes", {
        evento_id: evento.id,
        turma_id,
        ...notas,
        gostou_mais,
        sugestoes_melhoria,
        comentarios_finais,
      });
      toast.success("✅ Avaliação enviada com sucesso!");
      onClose?.();
      recarregar?.();
      // opcional: limpar estado ao fechar
      setNotas({});
      setGostouMais("");
      setSugestoesMelhoria("");
      setComentariosFinais("");
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-avaliacao"
      describedBy="descricao-avaliacao"
      className="w-[95%] max-w-3xl"
    >
      <h2 id="titulo-avaliacao" className="text-2xl font-bold text-lousa dark:text-green-100 mb-4">
        ✍️ Avaliar: {evento.nome || evento.titulo}
      </h2>
      <p id="descricao-avaliacao" className="sr-only">
        Formulário de avaliação do evento. Selecione uma opção para cada critério.
      </p>

      {/* Campos de notas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
        {camposNotas.map(({ chave, rotulo }) => {
          const obrig = obrigatorios.has(chave);
          return (
            <fieldset
              key={chave}
              className="border rounded-md p-3 dark:border-gray-700"
              aria-required={obrig ? "true" : "false"}
            >
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {rotulo} {obrig ? <span className="text-red-600" title="Obrigatório">*</span> : null}
              </legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {OPCOES.map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={chave}
                      value={opt}
                      checked={notas[chave] === opt}
                      onChange={(e) => handleNotaChange(chave, e.target.value)}
                      className="accent-emerald-600"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      {/* Textos livres */}
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

      {/* Ações */}
      <div className="flex justify-end mt-6 gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-md bg-gray-300 dark:bg-gray-600 text-black dark:text-white hover:bg-gray-400 disabled:opacity-60"
          disabled={enviando}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={enviarAvaliacao}
          className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
          disabled={enviando}
        >
          {enviando ? "Enviando..." : "Enviar Avaliação"}
        </button>
      </div>
    </Modal>
  );
}
