// 📁 src/components/ModalVerEdital.jsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X, FileText, CalendarDays, Download, Loader2,
  CheckCircle2, ListChecks, ScrollText, Award, Info, Layers
} from "lucide-react";
import api from "../services/api";
import ReactMarkdown from "react-markdown";

export default function ModalVerEdital({ chamadaId, onClose }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get(`/chamadas/${chamadaId}`);
        setDados(res);
      } catch (err) {
        console.error("Erro ao carregar edital:", err);
      } finally {
        setLoading(false);
      }
    }
    if (chamadaId) fetchData();
  }, [chamadaId]);

  if (loading || !dados) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  const { chamada, linhas = [], criterios = [], criterios_orais = [], limites, modelo_meta } = dados;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-indigo-700 via-violet-700 to-blue-500 p-5 text-white">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
              <FileText className="w-5 h-5" />
              Edital da Chamada
            </h2>
            <button onClick={onClose} className="hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="mt-1 text-sm opacity-90">{chamada.titulo}</p>
          <p className="text-xs mt-1">
            Prazo final:{" "}
            {chamada.prazo_final_br
              ? new Date(chamada.prazo_final_br).toLocaleString("pt-BR")
              : "—"}
          </p>
        </div>

        {/* Corpo */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] text-gray-700">
          {/* Descrição Markdown */}
          {chamada.descricao_markdown && (
            <section>
              <h3 className="flex items-center gap-2 text-violet-700 font-semibold text-lg mb-2">
                <ScrollText className="w-5 h-5" /> Normas e Descrição
              </h3>
              <div className="prose prose-sm sm:prose-base max-w-none text-gray-700">
                <ReactMarkdown>{chamada.descricao_markdown}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Período */}
          <section>
            <h3 className="flex items-center gap-2 text-violet-700 font-semibold text-lg mb-2">
              <CalendarDays className="w-5 h-5" /> Período da Experiência
            </h3>
            <p>
              <strong>Início:</strong> {chamada.periodo_experiencia_inicio} <br />
              <strong>Fim:</strong> {chamada.periodo_experiencia_fim}
            </p>
          </section>

          {/* Linhas temáticas */}
          {linhas.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-violet-700 font-semibold text-lg mb-2">
                <Layers className="w-5 h-5" /> Linhas Temáticas
              </h3>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                {linhas.map((l, i) => (
                  <li key={i}>
                    <strong>{l.nome}</strong>
                    {l.descricao && <span> — {l.descricao}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Limites */}
          {limites && (
            <section>
              <h3 className="flex items-center gap-2 text-violet-700 font-semibold text-lg mb-2">
                <ListChecks className="w-5 h-5" /> Limites de Caracteres
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {Object.entries(limites).map(([k, v]) => (
                  <div key={k} className="border rounded-lg p-2">
                    <strong>{k}</strong>
                    <p>{v} caracteres</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Critérios de escrita */}
          {criterios.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-emerald-700 font-semibold text-lg mb-2">
                <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Escrita
              </h3>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                {criterios.map((c, i) => (
                  <li key={i}>
                    {c.titulo} (Escala: {c.escala_min}–{c.escala_max}, Peso: {c.peso})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Critérios orais */}
          {criterios_orais.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-amber-700 font-semibold text-lg mb-2">
                <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Apresentação Oral
              </h3>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                {criterios_orais.map((c, i) => (
                  <li key={i}>
                    {c.titulo} (Escala: {c.escala_min}–{c.escala_max}, Peso: {c.peso})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Regras gerais */}
          <section>
            <h3 className="flex items-center gap-2 text-blue-700 font-semibold text-lg mb-2">
              <Info className="w-5 h-5" /> Regras Gerais
            </h3>
            <p>
              <strong>Aceita pôster:</strong>{" "}
              <span className={chamada.aceita_poster ? "text-green-700" : "text-red-700"}>
                {chamada.aceita_poster ? "Sim" : "Não"}
              </span>
            </p>
            <p>
              <strong>Máximo de coautores:</strong> {chamada.max_coautores}
            </p>
          </section>

          {/* Premiação */}
          {chamada.premiacao_texto && (
            <section>
              <h3 className="flex items-center gap-2 text-rose-700 font-semibold text-lg mb-2">
                <Award className="w-5 h-5" /> Premiação
              </h3>
              <div className="prose prose-sm sm:prose-base max-w-none text-gray-700">
                <ReactMarkdown>{chamada.premiacao_texto}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Disposições finais */}
          {chamada.disposicoes_finais_texto && (
            <section>
              <h3 className="flex items-center gap-2 text-gray-700 font-semibold text-lg mb-2">
                <FileText className="w-5 h-5" /> Disposições Finais
              </h3>
              <div className="prose prose-sm sm:prose-base max-w-none text-gray-700">
                <ReactMarkdown>{chamada.disposicoes_finais_texto}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* Downloads */}
          <section className="border-t pt-4 flex flex-col sm:flex-row gap-3">
            {chamada.arquivo_edital_url && (
              <a
                href={chamada.arquivo_edital_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-violet-700 text-white hover:bg-violet-800 transition"
              >
                <Download className="w-4 h-4" />
                Baixar edital
              </a>
            )}

            {modelo_meta?.exists && (
              <a
                href={`/api/chamadas/${chamadaId}/modelo-banner`}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" />
                Modelo de pôster
              </a>
            )}
          </section>
        </div>
      </motion.div>
    </div>
  );
}
