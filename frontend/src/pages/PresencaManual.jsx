// ✅ src/pages/PresencaManual.jsx
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate, Navigate } from "react-router-dom";
import { toast } from "react-toastify";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { CheckSquare } from "lucide-react";
import { formatarCPF } from "../utils/data";

// helper local yyyy-mm-dd (anti-UTC)
const hojeLocalISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function PresencaManual() {
  const [params] = useSearchParams();
  const turmaId = params.get("turma");
  const navigate = useNavigate();

  const [inscritos, setInscritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // calcula uma vez por render
  const hojeISO = useMemo(() => hojeLocalISO(), []);

  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;

  useEffect(() => {
    if (!turmaId || Number.isNaN(Number(turmaId))) {
      setErro("Turma inválida.");
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/turmas/${turmaId}/inscritos`);
        setInscritos(Array.isArray(data) ? data : []);
        setErro("");
      } catch (e) {
        console.error(e);
        toast.error("❌ Erro ao carregar inscritos.");
        setErro("Erro ao carregar inscritos.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [turmaId]);

  const registrarPresenca = async (usuario_id) => {
    try {
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: Number(turmaId),
        usuario_id,
        // 🔧 padronizado com o resto do app: backend esperando 'data' (sem fuso)
        data: hojeISO,
      });

      toast.success("✅ Presença registrada.");

      // atualização otimista
      setInscritos((prev) =>
        prev.map((i) => {
          if (i.usuario_id !== usuario_id) return i;
          const lista = Array.isArray(i.data_presenca) ? i.data_presenca : [];
          if (lista.includes(hojeISO)) return i;
          return { ...i, data_presenca: [...lista, hojeISO] };
        })
      );
    } catch (e) {
      console.error(e);
      toast.warning("⚠️ Presença já registrada ou erro no servidor.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 🟧 Cabeçalho (família Presenças) */}
      <PageHeader title="Presença Manual" icon={CheckSquare} variant="laranja" />

      <main role="main" className="flex-1 px-4 py-6 max-w-3xl mx-auto">
        <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Presença Manual" }]} />

        {carregando ? (
          <CarregandoSkeleton />
        ) : erro ? (
          <ErroCarregamento mensagem={erro} />
        ) : (
          <section aria-label={`Lista de inscritos da turma ${turmaId}`}>
            <ul className="space-y-2">
              {inscritos.map((inscrito) => {
                const presencas = Array.isArray(inscrito.data_presenca)
                  ? inscrito.data_presenca
                  : [];
                const presenteHoje = presencas.includes(hojeISO);

                return (
                  <li
                    key={inscrito.usuario_id}
                    className="flex justify-between items-center border p-3 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"
                  >
                    <div className="flex flex-col text-black dark:text-white">
                      <span className="font-medium">
                        {inscrito.nome}{" "}
                        {inscrito.cpf ? `(${formatarCPF(inscrito.cpf)})` : ""}
                      </span>
                      <span
                        className={`text-sm ${
                          presenteHoje
                            ? "text-green-700 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        {presenteHoje ? "✅ Presente hoje" : "❌ Ausente hoje"}
                      </span>
                    </div>

                    <button
                      onClick={() => registrarPresenca(inscrito.usuario_id)}
                      className="text-sm px-3 py-1.5 bg-lousa text-white rounded hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-700 disabled:opacity-50"
                      aria-label={`Marcar presença para ${inscrito.nome}`}
                      disabled={presenteHoje}
                    >
                      {presenteHoje ? "✔️ Registrado" : "Marcar Presença"}
                    </button>
                  </li>
                );
              })}
              {!inscritos?.length && (
                <li className="text-sm text-gray-600 dark:text-gray-300 text-center py-6">
                  Nenhum inscrito encontrado.
                </li>
              )}
            </ul>
          </section>
        )}
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
