// 📁 src/components/ModalAvaliacaoFormulario.jsx
import { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiPost } from "../services/api";

const OPCOES = [
  { label: "Ótimo", value: "Ótimo", nota: 5 },
  { label: "Bom", value: "Bom", nota: 4 },
  { label: "Regular", value: "Regular", nota: 3 },
  { label: "Ruim", value: "Ruim", nota: 2 },
  { label: "Péssimo", value: "Péssimo", nota: 1 },
];
const LABELS_VALIDAS = new Set(OPCOES.map((o) => o.value));

const NORM = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/* ───────────────── Campos ───────────────── */
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

// Condicionais (visuais; não obrigatórios; fora da média)
const COND_SIMPOSIO_OU_CONGRESSO = [
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
];
const COND_CONGRESSO = [
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

// Obrigatórios (fixos, conforme sua regra)
const OBRIGATORIOS = new Set([
  "desempenho_instrutor",
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
]); // ⚠️ sem 'exposicao_trabalhos'

export default function ModalAvaliacaoFormulario({
  isOpen,
  onClose,
  evento,
  turma_id,
  recarregar,
}) {
  // Hooks no topo
  const [comentarios_finais, setComentariosFinais] = useState("");
  const [gostou_mais, setGostouMais] = useState("");
  const [sugestoes_melhoria, setSugestoesMelhoria] = useState("");
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const primeiroCampoRef = useRef(null);

  // Derivados
  const tipoNorm = NORM(evento?.tipo);
  const isCongresso = tipoNorm === "congresso";
  const isSimposio = tipoNorm === "simposio" || tipoNorm === "simpósio";

  const camposNotas = useMemo(() => {
    const extras = [];
    if (isCongresso || isSimposio) extras.push(...COND_SIMPOSIO_OU_CONGRESSO);
    if (isCongresso) extras.push(...COND_CONGRESSO);
    return [...CAMPOS_BASE, ...extras];
  }, [isCongresso, isSimposio]);

  useEffect(() => {
    if (isOpen) {
      setNotas({});
      setGostouMais("");
      setSugestoesMelhoria("");
      setComentariosFinais("");
      setTimeout(() => primeiroCampoRef.current?.focus(), 30);
    }
  }, [isOpen, evento?.id, turma_id]);

  if (!isOpen || !evento) return null;

  const handleNotaChange = (campo, valorLabel) =>
    setNotas((prev) => ({ ...prev, [campo]: valorLabel })); // 👈 envia string (“Ótimo”, …)

  async function enviarAvaliacao() {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (!usuario?.id) {
      toast.error("Usuário não identificado.");
      return;
    }

    // checar obrigatórios: precisa existir e ser uma label válida
    const faltando = [...OBRIGATORIOS].filter(
      (c) => !notas[c] || !LABELS_VALIDAS.has(String(notas[c]))
    );
    if (faltando.length) {
      toast.warning("Preencha todas as notas obrigatórias.");
      return;
    }

    try {
      setEnviando(true);

      // payload com strings (compatível com seu controller e com a tabela)
      const payload = {
        evento_id: Number(evento.evento_id ?? evento.id),
        turma_id: Number(turma_id),
        gostou_mais,
        sugestoes_melhoria,
        comentarios_finais,
      };

      for (const { chave } of [
        ...CAMPOS_BASE,
        ...COND_SIMPOSIO_OU_CONGRESSO,
        ...COND_CONGRESSO,
      ]) {
        if (notas[chave]) payload[chave] = String(notas[chave]);
      }

      await apiPost("/api/avaliacoes", payload);

      toast.success("✅ Avaliação enviada com sucesso!");
      onClose?.();
      recarregar?.();
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-avaliacao"
      describedBy="descricao-avaliacao"
      className="w-[95%] max-w-3xl"
    >
      <h2
        id="titulo-avaliacao"
        className="text-2xl font-bold text-lousa dark:text-green-100 mb-4"
      >
        ✍️ Avaliar: {evento?.nome || evento?.titulo || "Evento"}
      </h2>
      <p id="descricao-avaliacao" className="sr-only">
        Formulário de avaliação do evento. Selecione uma opção para cada critério.
      </p>

      {/* Campos de notas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
        {camposNotas.map(({ chave, rotulo }, idx) => {
          const obrig = OBRIGATORIOS.has(chave);
          return (
            <fieldset
              key={chave}
              className="border rounded-md p-3 dark:border-gray-700"
              aria-required={obrig ? "true" : "false"}
            >
              <legend className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {rotulo}{" "}
                {obrig ? (
                  <span className="text-red-600" title="Obrigatório">
                    *
                  </span>
                ) : null}
              </legend>

              <div className="mt-2 flex flex-wrap gap-3">
                {OPCOES.map(({ label, value, nota }) => (
                  <label key={value} className="inline-flex items-center gap-2 text-sm">
                    <input
                      ref={idx === 0 && value === "Ótimo" ? primeiroCampoRef : undefined}
                      type="radio"
                      name={chave}
                      value={value}
                      checked={String(notas[chave]) === value}
                      onChange={(e) => handleNotaChange(chave, e.target.value)}
                      className="accent-emerald-600"
                    />
                    <span>
                      {label} <span className="text-xs text-gray-500">({nota})</span>
                    </span>
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
