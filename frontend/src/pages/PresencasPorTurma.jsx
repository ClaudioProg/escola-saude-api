// ✅ src/pages/PresencasPorTurma.jsx
import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { differenceInMinutes, isBefore } from "date-fns";

import { apiGet, apiPost } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";

// Cabeçalho compacto + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { CheckSquare } from "lucide-react";

// ---------- helpers de data locais (anti-UTC) ----------
const ymd = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
const hms = (s, fb = "00:00") => {
  const [hh, mm] = String(s || fb).split(":").map((n) => parseInt(n, 10) || 0);
  return { hh, mm };
};
const makeLocalDate = (ymdStr, hhmm = "00:00") => {
  const d = ymd(ymdStr);
  const t = hms(hhmm);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0) : new Date(NaN);
};
// -------------------------------------------------------

export default function PresencasPorTurma() {
  const { turmaId } = useParams(); // /presencas/turma/:turmaId
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);

  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;

  useEffect(() => {
    if (!turmaId || Number.isNaN(Number(turmaId))) {
      setErro("ID da turma inválido.");
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`);
        // aceita array direto ou objeto { lista: [...] }
        const lista = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];
        setDados(lista);
        setErro("");
      } catch {
        setErro("Erro ao carregar presenças da turma.");
        toast.error("❌ Erro ao carregar presenças da turma.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [turmaId]);

  async function confirmarPresencaManual(usuario_id, turma_id, data_referencia) {
    try {
      setConfirmandoId(`${usuario_id}-${data_referencia}`);
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: Number(turma_id),
        usuario_id,
        // 🔧 unificado com o resto do app
        data: data_referencia,
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
    // calcula relativo ao "agora" usando datas locais (anti-UTC)
    const agora = new Date();
    const inicio = makeLocalDate(p.data_referencia, p.horario_inicio || "00:00");
    const fim = makeLocalDate(p.data_referencia, p.horario_fim || "23:59");
    const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000); // +48h
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
            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700"
            disabled={loading}
            aria-label={`Confirmar presença de ${p.nome} em ${formatarDataBrasileira(p.data_referencia)}`}
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
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 🟧 Cabeçalho (família Presenças) */}
      <PageHeader title="Presenças por Turma" icon={CheckSquare} variant="laranja" />

      <main role="main" className="flex-1 px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Presenças por Turma" }]} />

        {carregando ? (
          <CarregandoSkeleton texto="Carregando presenças..." />
        ) : erro ? (
          <ErroCarregamento mensagem={erro} />
        ) : (
          <section
            className="space-y-4 max-w-5xl mx-auto"
            aria-label={`Lista de presenças da turma ${turmaId}`}
          >
            {dados.map((p) => (
              <article
                key={`${p.usuario_id}-${p.data_referencia}`}
                className="border border-gray-200 dark:border-gray-600 p-4 rounded-lg bg-white dark:bg-zinc-800 shadow"
                aria-label={`Registro de ${p.nome}`}
              >
                <p className="text-lousa dark:text-white font-semibold">{p.nome}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                  CPF: {formatarCPF(p.cpf)}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Data: {formatarDataBrasileira(p.data_referencia)} – {p.horario_inicio} às {p.horario_fim}
                </p>
                <div className="mt-2">{renderStatus(p)}</div>
              </article>
            ))}
            {!dados?.length && (
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Nenhum registro encontrado.
              </p>
            )}
          </section>
        )}
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
