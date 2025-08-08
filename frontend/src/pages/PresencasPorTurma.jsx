//PresencasPorTurma
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { parseISO, differenceInMinutes, isBefore } from "date-fns";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";

export default function PresencasPorTurma() {
  const { turmaId } = useParams(); // Captura o ID da turma pela URL
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const token = localStorage.getItem("token");

  useEffect(() => {
    async function carregarPresencas() {
      if (!turmaId) return;

      try {
        const res = await fetch(`http://escola-saude-api.onrender.com/api/relatorio-presencas/turma/${turmaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error();
        const data = await res.json();
        setDados(data);
        setErro(false);
      } catch {
        setErro(true);
        toast.error("❌ Erro ao carregar presenças da turma.");
      } finally {
        setCarregando(false);
      }
    }

    carregarPresencas();
  }, [token, turmaId]);

  async function confirmarPresencaManual(usuarioId, turmaId, dataReferencia) {
    try {
      const res = await fetch("http://escola-saude-api.onrender.com/api/presencas/confirmar-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usuarioId, turmaId, data: dataReferencia }),
      });

      if (!res.ok) throw new Error();
      toast.success("✅ Presença confirmada!");
      // Atualizar presença localmente
      setDados((prev) =>
        prev.map((item) =>
          item.usuario_id === usuarioId &&
          item.turma_id === turmaId &&
          item.data_referencia === dataReferencia
            ? { ...item, data_presenca: dataReferencia }
            : item
        )
      );
    } catch {
      toast.error("❌ Erro ao confirmar presença.");
    }
  }

  const hoje = new Date();

  function renderStatus(p) {
    const inicio = parseISO(`${p.data_referencia}T${p.horario_inicio}`);
    const fim = parseISO(`${p.data_referencia}T${p.horario_fim}`);
    const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
    const passou60min = differenceInMinutes(hoje, inicio) > 60;

    if (p.data_presenca) {
      return <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold text-xs">✅ Presente</span>;
    }

    if (!passou60min) {
      return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold text-xs">🟡 Aguardando confirmação</span>;
    }

    if (isBefore(hoje, expiracao)) {
      return (
        <div className="flex items-center gap-2">
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-semibold text-xs">🟥 Faltou</span>
          <button
            onClick={() => confirmarPresencaManual(p.usuario_id, p.turma_id, p.data_referencia)}
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
          >
            Confirmar
          </button>
        </div>
      );
    }

    return <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold text-xs">🟥 Faltou (Expirado)</span>;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel titulo="📋 Presenças por Turma" />
      <h1 className="text-2xl font-bold mb-6 text-center text-black dark:text-white">
        📋 Presenças por Turma
      </h1>

      {carregando ? (
        <CarregandoSkeleton texto="Carregando presenças..." />
      ) : erro ? (
        <ErroCarregamento mensagem="Erro ao carregar presenças." />
      ) : (
        <div className="space-y-4 max-w-5xl mx-auto">
          {dados.map((p, i) => (
            <div
              key={i}
              className="border border-gray-200 dark:border-gray-600 p-4 rounded-lg bg-white dark:bg-zinc-800 shadow"
            >
              <p className="text-lousa dark:text-white font-semibold">{p.nome}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                CPF: {formatarCPF(p.cpf)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Data: {formatarDataBrasileira(p.data_referencia)} – {p.horario_inicio} às {p.horario_fim}
              </p>
              <div className="mt-2">{renderStatus(p)}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
