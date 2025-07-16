// ✅ src/pages/PresencaManual.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";

export default function PresencaManual() {
  const [params] = useSearchParams();
  const turmaId = params.get("turma");
  const [inscritos, setInscritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token || !turmaId) {
      toast.error("❌ Acesso não autorizado.");
      navigate("/");
      return;
    }

    const carregarInscritos = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/turmas/${turmaId}/inscritos`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Erro na resposta do servidor");

        const data = await res.json();
        setInscritos(data);
      } catch (e) {
        toast.error("❌ Erro ao carregar inscritos.");
        setErro("Erro ao carregar inscritos.");
      } finally {
        setCarregando(false);
      }
    };

    carregarInscritos();
  }, [token, turmaId, navigate]);

  const registrarPresenca = async (usuario_id) => {
    try {
      const res = await fetch(`http://localhost:3000/api/presencas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ turma_id: turmaId, usuario_id }),
      });

      if (res.ok) {
        toast.success("✅ Presença registrada.");
      } else {
        toast.warning("⚠️ Presença já registrada ou erro.");
      }
    } catch {
      toast.error("❌ Erro ao registrar presença.");
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
          {inscritos.map((inscrito) => (
            <li
              key={inscrito.usuario_id}
              className="flex justify-between items-center border p-2 rounded bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <span className="text-black dark:text-white">
                {inscrito.nome} ({inscrito.cpf})
              </span>
              <button
                onClick={() => registrarPresenca(inscrito.usuario_id)}
                className="text-sm px-3 py-1 bg-lousa text-white rounded hover:brightness-110 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lousa"
                aria-label={`Marcar presença para ${inscrito.nome}`}
                tabIndex={0}
              >
                Marcar Presença
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
