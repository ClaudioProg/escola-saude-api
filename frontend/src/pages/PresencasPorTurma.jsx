// ✅ src/pages/PresencasPorTurma.jsx
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { parseISO, differenceInMinutes, isBefore } from "date-fns";

import { apiGet, apiPost } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";

export default function PresencasPorTurma() {
  const { turmaId } = useParams(); // /presencas/turma/:turmaId
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) return; // redireciono abaixo
    if (!turmaId || Number.isNaN(Number(turmaId))) {
      setErro("ID da turma inválido.");
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`);
        setDados(Array.isArray(data) ? data : []);
        setErro("");
      } catch {
        setErro("Erro ao carregar presenças da turma.");
        toast.error("❌ Erro ao carregar presenças da turma.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [token, turmaId]);

  if (!token) return <Navigate to="/login" replace />;

  async function confirmarPresencaManual(usuario_id, turma_id, data_referencia) {
    try {
      setConfirmandoId(`${usuario_id}-${data_referencia}`);
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: Number(turma_id),
        usuario_id,
        data_presenca: data_referencia, // 🔒 padrão
      });

      toast.success("✅ Presença confirmada!");

      // 🔄 Atualização otimista local
      setDados((prev) =>
        prev.map((item) =>
          item.usuario_id === usuario_id &&
          item.turma_id === turma_id &&
          item.data_referencia === data_referencia
            ? { ...item, data_presenca: data_referencia, presente: true }
            : item
        )
      );
    } catch {
      toast.error("❌ Erro ao confirmar presença.");
    } finally {
      setConfirmandoId(null);
    }
  }

  function renderStatus(p) {
    // calcula relativo ao "agora" a cada render
    const agora = new Date();
    const inicio = parseISO(`${p.data_referencia}T${p.horario_inicio || "00:00"}`);
    const fim = parseISO(`${p.data_referencia}T${p.horario_fim || "23:59"}`);
    const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
    const passou60min = differenceInMinutes(agora, inicio) > 60;

    if (p.data_presenca || p.presente) {
      return (
        <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-semibold text-xs">
          ✅ Presente
        </span>
      );
    }

    if (!passou60min) {
      return (
        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold text-xs">
          🟡 Aguardando confirmação
        </span>
      );
    }

    if (isBefore(agora, expiracao)) {
      const btnId = `${p.usuario_id}-${p.data_referencia}`;
      const loading = confirmandoId === btnId;

      return (
        <div className="flex items-center gap-2">
          <span className="bg-red-100 text-red-800 px-2 py-1 rounded font-semibold text-xs">
            🟥 Faltou
          </span>
          <button
            onClick={() =>
              confirmarPresencaManual(p.usuario_id, p.turma_id, p.data_referencia)
            }
            className={`text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-60`}
            disabled={loading}
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      );
    }

    return (
      <span className="bg-red-200 text-red-900 px-2 py-1 rounded font-semibold text-xs">
        🟥 Faltou (Expirado)
      </span>
    );
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
        <ErroCarregamento mensagem={erro} />
      ) : (
        <div className="space-y-4 max-w-5xl mx-auto">
          {dados.map((p, i) => (
            <div
              key={`${p.usuario_id}-${p.data_referencia}-${i}`}
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
