import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

const CAMPOS_ENUM = [
  { campo: "desempenho_instrutor", label: "Desempenho do Instrutor" },
  { campo: "divulgacao_evento", label: "Divulgação do Evento" },
  { campo: "recepcao", label: "Recepção" },
  { campo: "credenciamento", label: "Credenciamento" },
  { campo: "material_apoio", label: "Material de Apoio" },
  { campo: "pontualidade", label: "Pontualidade" },
  { campo: "sinalizacao_local", label: "Sinalização do Local" },
  { campo: "conteudo_temas", label: "Conteúdo dos Temas" },
  { campo: "estrutura_local", label: "Estrutura do Local" },
  { campo: "acessibilidade", label: "Acessibilidade" },
  { campo: "limpeza", label: "Limpeza" },
  { campo: "inscricao_online", label: "Inscrição Online" },
  { campo: "exposicao_trabalhos", label: "Exposição de Trabalhos" },
  { campo: "apresentacao_oral_mostra", label: "Apresentação Oral da Mostra" },
  { campo: "apresentacao_tcrs", label: "Apresentação de TCRs" },
  { campo: "oficinas", label: "Oficinas" },
];

const OPCOES_NOTA = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

export default function AvaliacaoEvento() {
  const { turma_id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [comentarios, setComentarios] = useState("");
  const [carregando, setCarregando] = useState(false);

  function handleChange(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");

    const corpo = {
      ...form,
      turma_id,
      evento_id: form.evento_id, // opcional, pode ser omitido se já estiver embutido no backend
      comentarios_finais: comentarios,
    };

    try {
      setCarregando(true);
      const res = await fetch("http://localhost:3000/api/avaliacoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(corpo),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || "Erro ao enviar avaliação");

      toast.success("✅ Avaliação enviada com sucesso!");
      navigate("/painel"); // Redireciona para o painel do usuário
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto p-6 bg-white dark:bg-gray-900 rounded-xl shadow-md mt-6"
    >
      <h2 className="text-2xl font-bold mb-4 text-lousa dark:text-green-200">
        📝 Avaliação do Evento
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {CAMPOS_ENUM.map(({ campo, label }) => (
          <div key={campo} className="flex flex-col">
            <label htmlFor={campo} className="font-medium text-sm mb-1 dark:text-white">
              {label}:
            </label>
            <select
              id={campo}
              required
              value={form[campo] || ""}
              onChange={(e) => handleChange(campo, e.target.value)}
              className="p-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Selecione</option>
              {OPCOES_NOTA.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao.charAt(0).toUpperCase() + opcao.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="flex flex-col">
          <label htmlFor="comentarios" className="font-medium text-sm mb-1 dark:text-white">
            Comentários finais (opcional):
          </label>
          <textarea
            id="comentarios"
            rows={4}
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Escreva aqui sua sugestão ou impressão..."
            className="p-2 rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="bg-lousa dark:bg-green-700 hover:bg-green-800 dark:hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
        >
          {carregando ? "Enviando..." : "Enviar Avaliação"}
        </button>
      </form>
    </motion.div>
  );
}
