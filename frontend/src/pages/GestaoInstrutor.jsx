// src/pages/Gestaoinstrutor.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Navigate } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import Modal from "react-modal";

import Breadcrumbs from "../components/Breadcrumbs";
import TabelaInstrutor from "../components/TabelaInstrutor";
import useperfilPermitidos from "../hooks/useperfilPermitidos";
import CabecalhoPainel from "../components/CabecalhoPainel";

Modal.setAppElement("#root");

export default function GestaoInstrutor() {
  const { temAcesso, carregando } = useperfilPermitidos(["administrador"]);
  const [instrutor, setinstrutor] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  // Modais
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false);
  const [instrutorelecionado, setinstrutorelecionado] = useState(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");

  useEffect(() => {
    async function carregarinstrutor() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:3000/api/usuarios/instrutor", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao buscar instrutor");
        const data = await res.json();
        setinstrutor(data);
        setErro("");
      } catch {
        setErro("Erro ao carregar instrutor.");
        toast.error("Erro ao carregar instrutor.");
      } finally {
        setCarregandoDados(false);
      }
    }

    carregarinstrutor();
  }, []);

  const filtrados = instrutor.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.email.toLowerCase().includes(busca.toLowerCase())
  );

  function abrirModalVisualizar(instrutor) {
    setinstrutorelecionado(instrutor);
    setModalHistoricoAberto(true);
  }

  function abrirModalEditar(instrutor) {
    setinstrutorelecionado(instrutor);
    setNovoNome(instrutor.nome);
    setNovoEmail(instrutor.email);
    setModalEdicaoAberto(true);
  }

  async function salvarEdicao() {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:3000/api/usuarios/${instrutorelecionado.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome: novoNome, email: novoEmail }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar dados");

      toast.success("✅ Dados atualizados com sucesso!");
      setModalEdicaoAberto(false);
      setinstrutor((prev) =>
        prev.map((p) =>
          p.id === instrutorelecionado.id ? { ...p, nome: novoNome, email: novoEmail } : p
        )
      );
    } catch {
      toast.error("❌ Erro ao atualizar instrutor.");
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
          onEditar={abrirModalEditar}
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
          Histórico de {instrutorelecionado?.nome}
        </h2>
        <p className="text-sm dark:text-gray-300">
          Total de eventos: {instrutorelecionado?.eventosMinistrados?.length ?? 0}
        </p>
        <ul className="mt-4 list-disc pl-5 text-gray-700 dark:text-gray-200">
          {instrutorelecionado?.eventosMinistrados?.map((evento, i) => (
            <li key={i}>{evento}</li>
          ))}
        </ul>
        <button
          onClick={() => setModalHistoricoAberto(false)}
          className="mt-6 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-800 text-white font-medium shadow transition-all"
        >
          ❌ Fechar
        </button>
      </Modal>

      {/* Modal Edição */}
      <Modal
        isOpen={modalEdicaoAberto}
        onRequestClose={() => setModalEdicaoAberto(false)}
        className="bg-white dark:bg-gray-800 max-w-lg mx-auto mt-24 p-6 rounded-xl shadow-lg outline-none"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
      >
        <h2 className="text-xl font-bold mb-4 text-black dark:text-white">✏️ Editar instrutor</h2>
        <input
          type="text"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="w-full mb-4 px-4 py-2 border rounded dark:bg-gray-700 dark:text-white"
          placeholder="Nome"
        />
        <input
          type="email"
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          className="w-full mb-4 px-4 py-2 border rounded dark:bg-gray-700 dark:text-white"
          placeholder="Email"
        />
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setModalEdicaoAberto(false)}
            className="px-4 py-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white font-medium shadow transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={salvarEdicao}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow transition-all"
          >
            💾 Salvar
          </button>
        </div>
      </Modal>
    </main>
  );
}
