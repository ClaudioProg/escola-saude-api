// ✅ src/pages/PresencaManual.jsx
import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";

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

  useEffect(() => {
    // ➜ se sua rota já está protegida por <PrivateRoute>, esta checagem pode sair
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("❌ Acesso não autorizado.");
      navigate("/login", { replace: true });
      return;
    }

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
  }, [turmaId, navigate]);

  const registrarPresenca = async (usuario_id) => {
    try {
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: Number(turmaId),
        usuario_id,
        // 🔧 padronizado com o resto do app: backend esperando 'data'
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
    <main className="p-4 max-w-3xl mx-auto bg-gelo dark:bg-zinc-900 min-h-screen">
      <h1 className="text-xl font-bold text-lousa dark:text-white mb-4">
        📝 Presença Manual
      </h1>

      {carregando ? (
        <CarregandoSkeleton />
      ) : erro ? (
        <ErroCarregamento mensagem={erro} />
      ) : (
        <ul className="space-y-2">
          {inscritos.map((inscrito) => {
            const presencas = Array.isArray(inscrito.data_presenca)
              ? inscrito.data_presenca
              : [];
            const presenteHoje = presencas.includes(hojeISO);

            return (
              <li
                key={inscrito.usuario_id}
                className="flex justify-between items-center border p-2 rounded bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <div className="flex flex-col text-black dark:text-white">
                  <span className="font-medium">
                    {inscrito.nome} {inscrito.cpf ? `(${inscrito.cpf})` : ""}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {presenteHoje ? "✅ Presente hoje" : "❌ Ausente hoje"}
                  </span>
                </div>

                <button
                  onClick={() => registrarPresenca(inscrito.usuario_id)}
                  className="text-sm px-3 py-1 bg-lousa text-white rounded hover:brightness-110 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lousa disabled:opacity-50"
                  aria-label={`Marcar presença para ${inscrito.nome}`}
                  tabIndex={0}
                  disabled={presenteHoje}
                >
                  {presenteHoje ? "✔️ Registrado" : "Marcar Presença"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
