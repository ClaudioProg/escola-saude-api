//TurmasInstrutor
import { motion, AnimatePresence } from "framer-motion";
import ListaInscritos from "./ListaInscritos";
import AvaliacoesEvento from "./AvaliacoesEvento";
import { formatarDataBrasileira } from "../utils/data";
import { toast } from "react-toastify";

export default function TurmasInstrutor({
  turmas,
  inscritosPorTurma,
  avaliacoesPorTurma,
  presencasPorTurma,
  onVerInscritos,
  onVerAvaliacoes,
  onExportarListaAssinaturaPDF,
  onExportarQrCodePDF,
  token,
  carregarPresencas,
  carregando = false,
  turmaExpandidaInscritos,
  setTurmaExpandidaInscritos,
  turmaExpandidaAvaliacoes,
  setTurmaExpandidaAvaliacoes,
}) {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  async function confirmarPresencaManual(usuarioId, turmaId, dataReferencia) {
    try {
      const res = await fetch("http://localhost:3000/api/presencas/confirmar", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usuario_id: usuarioId, turma_id: turmaId, data: dataReferencia }),
      });

      if (!res.ok) throw new Error();
      toast.success("✅ Presença confirmada!");
      carregarPresencas(turmaId);
    } catch {
      toast.error("❌ Erro ao confirmar presença.");
    }
  }

  if (carregando) {
    return (
      <ul className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <li key={i} className="p-8 bg-gray-100 dark:bg-zinc-700 animate-pulse rounded-xl" />
        ))}
      </ul>
    );
  }

  const eventosAgrupados = {};
  for (const turma of turmas) {
    if (!turma || !turma.id || !turma.evento?.id) continue;
    const eventoId = turma.evento.id;
    if (!eventosAgrupados[eventoId]) {
      eventosAgrupados[eventoId] = {
        nome: turma.evento.nome,
        turmas: [],
      };
    }
    eventosAgrupados[eventoId].turmas.push(turma);
  }

  return (
    <ul className="space-y-6">
      <AnimatePresence>
        {Object.entries(eventosAgrupados).map(([eventoId, evento]) => (
          <motion.li
            key={eventoId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border p-4 rounded-xl bg-white dark:bg-zinc-800 shadow"
          >
            <h3 className="text-lg font-semibold text-lousa dark:text-white">
              {evento.nome}
            </h3>

            <div className="space-y-4 mt-2">
            {evento.turmas.map((turma) => {
  const idSeguro = parseInt(turma.id);
  const expandindoInscritos = turmaExpandidaInscritos === idSeguro;
  const expandindoAvaliacoes = turmaExpandidaAvaliacoes === idSeguro;

  const hojeISO = new Date().toISOString().split("T")[0];
  const dataInicio = new Date(turma.data_inicio);
  const dataFim = new Date(turma.data_fim);
  const turmaPresencas = presencasPorTurma[idSeguro];

  let statusBadge = null;
  if (Array.isArray(turmaPresencas)) {
    const instrutorPresencas = turmaPresencas.find((p) => p.usuario_id === usuario.id);
    const presencasInstrutor = instrutorPresencas?.presencas || [];

    const diasConfirmados = presencasInstrutor.filter((p) => p.presente === true).length;
    const totalDiasTurma = Math.floor((dataFim - dataInicio) / (1000 * 60 * 60 * 24)) + 1;

    const agora = new Date();
    const eventoEncerrado = new Date(`${turma.data_fim}T${turma.horario_fim}`) < agora;

    if (diasConfirmados === totalDiasTurma) {
      statusBadge = (
        <span className="inline-block bg-green-100 text-green-700 px-3 py-1 mt-2 rounded-full text-xs font-bold">
          ✅ Presente
        </span>
      );
    } else if (!eventoEncerrado) {
      statusBadge = (
        <span className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 mt-2 rounded-full text-xs font-bold">
          ⏳ Aguardando confirmação
        </span>
      );
    } else {
      statusBadge = (
        <span className="inline-block bg-red-100 text-red-700 px-3 py-1 mt-2 rounded-full text-xs font-bold">
          ❌ Faltou
        </span>
      );
    }
  }

  return (
    <div key={idSeguro} className="border-t pt-4">
      <p className="text-sm font-medium text-lousa dark:text-white text-left">
  Turma: {turma.nome || `Turma ${turma.id}`}
</p>     
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={() => {
                          onVerInscritos(idSeguro);
                          carregarPresencas(idSeguro);
                          setTurmaExpandidaInscritos(expandindoInscritos ? null : idSeguro);
                          setTurmaExpandidaAvaliacoes(null);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        👥 Ver inscritos
                      </button>

                      <button
                        onClick={() => {
                          onVerAvaliacoes(idSeguro);
                          setTurmaExpandidaAvaliacoes(expandindoAvaliacoes ? null : idSeguro);
                          setTurmaExpandidaInscritos(null);
                        }}
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                      >
                        ⭐ Avaliações
                      </button>

                      <button
                        onClick={() => onExportarListaAssinaturaPDF(idSeguro)}
                        className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-sm"
                      >
                        📄 Lista de Presença
                      </button>

                      <button
  onClick={() => onExportarQrCodePDF(idSeguro, evento.nome)}
  className="px-3 py-1 bg-green-700 text-white rounded hover:bg-green-800 text-sm"
>
  🔳 QR Code de Presença
</button>
                    </div>

                    <AnimatePresence>
  {expandindoInscritos && (
    <motion.div
      id={`painel-inscritos-${idSeguro}`}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
    >
      {(() => {
        const listaPresencas = Array.isArray(presencasPorTurma[idSeguro])
          ? presencasPorTurma[idSeguro]
          : presencasPorTurma[idSeguro]?.lista ?? [];

        return (
          <ListaInscritos
            inscritos={inscritosPorTurma[idSeguro] || []}
            turma={turma}
            presencas={listaPresencas}
            token={token}
            carregarPresencas={() => carregarPresencas(idSeguro)}
          />
        );
      })()}
    </motion.div>
  )}
</AnimatePresence>


                    <AnimatePresence>
  {expandindoAvaliacoes && (
    <motion.div
      id={`painel-avaliacoes-${idSeguro}`}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
    >
      {(() => {
  const avaliacoesTurma = avaliacoesPorTurma[idSeguro];
  console.log("📊 Avaliações recebidas para a turma:", idSeguro, avaliacoesTurma);

  if (avaliacoesTurma && Array.isArray(avaliacoesTurma.comentarios)) {
    return <AvaliacoesEvento avaliacoes={avaliacoesTurma.comentarios} />;

  } else if (avaliacoesTurma === undefined) {
    return (
      <p className="text-sm text-gray-600 italic dark:text-gray-300">
        Nenhuma avaliação registrada para esta turma.
      </p>
    );
  } else {
    return (
      <p className="text-red-500">Erro: avaliações não carregadas corretamente.</p>
    );
  }
})()}
    </motion.div>
  )}
</AnimatePresence>

                  </div>
                );
              })}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
