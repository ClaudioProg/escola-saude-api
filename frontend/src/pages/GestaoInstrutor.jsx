import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Navigate } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";

import Breadcrumbs from "../components/Breadcrumbs";
import TabelaInstrutor from "../components/TabelaInstrutor";
import usePerfilPermitidos from "../hooks/usePerfilPermitidos";
import CabecalhoPainel from "../components/CabecalhoPainel";

Modal.setAppElement("#root");

export default function GestaoInstrutor() {
  const { temAcesso, carregando } = usePerfilPermitidos(["administrador"]);
  const [instrutor, setInstrutor] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [historico, setHistorico] = useState([]);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState(null);

  useEffect(() => {
    async function carregarInstrutores() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://escola-saude-api.onrender.com/api/instrutor", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar instrutores.");
        const data = await res.json();
        setInstrutor(data);
        setErro("");
      } catch {
        setErro("Erro ao carregar instrutores.");
        toast.error("Erro ao carregar instrutores.");
      } finally {
        setCarregandoDados(false);
      }
    }

    carregarInstrutores();
  }, []);

  const filtrados = instrutor.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.email.toLowerCase().includes(busca.toLowerCase())
  );

  async function abrirModalVisualizar(instrutor) {
    setInstrutorSelecionado(instrutor);
    setModalHistoricoAberto(true);
  
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://escola-saude-api.onrender.com/api/instrutor/${instrutor.id}/eventos-avaliacoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao buscar histórico.");
  
      const data = await res.json();
  
      // Aqui o backend já retorna os dados prontos
      const eventos = data.map(ev => ({
        id: ev.evento_id,
        titulo: ev.evento,
        data_inicio: ev.data_inicio ? new Date(ev.data_inicio) : null,
        data_fim: ev.data_fim ? new Date(ev.data_fim) : null,
        nota_media: ev.nota_media !== null ? Number(ev.nota_media) : null,
      }));
  
      setHistorico(eventos);
    } catch {
      toast.error("❌ Erro ao buscar histórico do instrutor.");
      setHistorico([]);
    }
  }
  
  if (carregando) return <p className="text-center mt-10 text-lousa dark:text-white">Verificando permissões...</p>;
  if (!temAcesso) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de instrutor" }]} />
      <CabecalhoPainel titulo="👩‍🏫 Gestão de instrutor" />

      <div className="mb-6 mt-4">
        <input
          type="text"
          placeholder="🔍 Buscar por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-lousa dark:bg-gray-800 dark:text-white"
        />
      </div>

      {carregandoDados ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={70} className="rounded-lg" />
          ))}
        </div>
      ) : erro ? (
        <p className="text-red-500 text-center">{erro}</p>
      ) : (
        <TabelaInstrutor
          instrutor={filtrados}
          onVisualizar={abrirModalVisualizar}
        />
      )}

      {/* Modal Histórico */}
      <Modal
        isOpen={modalHistoricoAberto}
        onRequestClose={() => setModalHistoricoAberto(false)}
        className="bg-white dark:bg-gray-800 max-w-xl mx-auto mt-20 p-6 rounded-xl shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
      >
        <h2 className="text-xl font-bold mb-4 text-black dark:text-white">
          Histórico de {instrutorSelecionado?.nome}
        </h2>

        {historico.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-300">Nenhum evento encontrado.</p>
        ) : (
          <div className="mt-4 max-h-[65vh] overflow-y-auto pr-2">
  <ul className="space-y-3">
    {historico.map((evento) => (
      <li
        key={evento.id}
        className="border p-3 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm"
      >
        <p className="font-semibold">{evento.titulo}</p>
        <p className="text-sm">
          Data:{" "}
          {evento.data_inicio
            ? evento.data_inicio.toLocaleDateString("pt-BR")
            : "—"}{" "}
          até{" "}
          {evento.data_fim
            ? evento.data_fim.toLocaleDateString("pt-BR")
            : "—"}
        </p>
        <p className="text-sm">
          Média de avaliação:{" "}
          <strong>
            {evento.nota_media !== null
              ? evento.nota_media.toFixed(1)
              : "N/A"}
          </strong>
        </p>
      </li>
    ))}
  </ul>
</div>


        )}

        <button
          onClick={() => setModalHistoricoAberto(false)}
          className="mt-6 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-800 text-white font-medium shadow transition-all"
        >
          ❌ Fechar
        </button>
      </Modal>
    </main>
  );
}
