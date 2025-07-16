// src/pages/ListaPresencasTurma.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira } from "../utils/data";

export default function ListaPresencasTurma({
  turmas = [],
  hoje = new Date(),
  inscritosPorTurma = {},
  carregarInscritos,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [inscritosState, setInscritosState] = useState(inscritosPorTurma);
  const [loadingId, setLoadingId] = useState(null);

  useEffect(() => {
    setInscritosState(inscritosPorTurma);
  }, [inscritosPorTurma]);

  const confirmarPresenca = async (turmaId, usuarioId) => {
    const confirmar = confirm("Deseja realmente confirmar presença deste usuario?");
    if (!confirmar) return;

    setLoadingId(usuarioId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/presencas/confirmar-simples`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ turma_id: turmaId, usuario_id: usuarioId }),
      });

      if (!res.ok) throw new Error("Erro ao confirmar presença");

      toast.success("✅ Presença confirmada com sucesso.");

      setInscritosState((prev) => {
        const atualizados = { ...prev };
        const lista = atualizados[turmaId] || [];

        atualizados[turmaId] = lista.map((p) =>
          p.id === usuarioId ? { ...p, presente: true } : p
        );

        return atualizados;
      });

      if (carregarInscritos) await carregarInscritos(turmaId);
    } catch (err) {
      toast.error("❌ " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
        <Breadcrumbs />
        <CabecalhoPainel titulo="📋 Presenças por Turma" />
        <NadaEncontrado mensagem="Nenhuma turma encontrada." sugestao="Verifique os filtros ou cadastre uma nova turma." />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel titulo="📋 Presenças por Turma" />

      <div className="space-y-6">
        {turmas.map((turma) => (
          <div key={turma.id} className="border rounded-xl bg-white dark:bg-gray-800 shadow p-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-bold text-lg text-lousa dark:text-green-200">{turma.nome}</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
  {formatarDataBrasileira(turma.data_inicio)} até{" "}
  {formatarDataBrasileira(turma.data_fim)}
</p>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded-full">
                {turma.status || "Agendada"}
              </span>
            </div>

            <div className="mt-4">
              <button
                className="bg-lousa text-white px-4 py-2 rounded hover:bg-green-900 transition"
                onClick={() =>
                  setTurmaExpandidaId(turmaExpandidaId === turma.id ? null : turma.id)
                }
              >
                {turmaExpandidaId === turma.id ? "Recolher Detalhes" : "Ver Detalhes"}
              </button>
            </div>

            <AnimatePresence>
              {turmaExpandidaId === turma.id && (
                <motion.div
                  className="mt-6 space-y-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div>
                    <h3 className="font-semibold text-gray-700 dark:text-white mb-2">Inscritos:</h3>
                    {(inscritosState?.[turma.id] || []).map((pessoa) => (
                      <div
                        key={pessoa.id}
                        className="flex flex-wrap justify-between items-center p-2 border rounded bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="text-sm text-gray-800 dark:text-gray-200">
                          <strong>{pessoa.nome}</strong> – {pessoa.email}
                          <br />
                          CPF: {pessoa.cpf || "Não informado"}
                        </div>

                        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
                          <span
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                              pessoa.presente
                                ? "bg-yellow-300 text-yellow-900"
                                : "bg-red-300 text-red-900"
                            }`}
                          >
                            {pessoa.presente ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {pessoa.presente ? "Presente" : "Faltou"}
                          </span>

                          {!pessoa.presente && (
                            <button
                              disabled={loadingId === pessoa.id}
                              onClick={() => confirmarPresenca(turma.id, pessoa.id)}
                              className={`bg-blue-700 text-white text-xs px-3 py-1 rounded ${
                                loadingId === pessoa.id
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-blue-800"
                              }`}
                            >
                              {loadingId === pessoa.id ? "Confirmando..." : "Confirmar Presença"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </main>
  );
}
