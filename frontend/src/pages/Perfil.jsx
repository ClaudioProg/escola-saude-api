import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalAssinatura from "../components/ModalAssinatura";

export default function Perfil() {
  const [usuario, setUsuario] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    try {
      const dadosString = localStorage.getItem("usuario");
      if (!dadosString) return;

      const dados = JSON.parse(dadosString);

      // Garante que o perfil seja string
      const perfilString = Array.isArray(dados.perfil) ? dados.perfil[0] : dados.perfil;

      const usuarioCorrigido = {
        ...dados,
        perfil: perfilString
      };

      setUsuario(usuarioCorrigido);
      setNome(usuarioCorrigido.nome || "");
      setEmail(usuarioCorrigido.email || "");
    } catch (erro) {
      console.error("Erro ao carregar dados do localStorage:", erro);
      toast.error("Erro ao carregar dados do perfil.");
    }
  }, []);

  const salvarAlteracoes = async () => {
    if (!usuario?.id) return;

    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nome, email, senha }),
      });

      if (!res.ok) throw new Error("Erro ao salvar alterações.");

      const atualizado = await res.json();

      const perfilString = Array.isArray(atualizado.perfil)
        ? atualizado.perfil[0]
        : atualizado.perfil;

      const atualizadoCorrigido = {
        ...atualizado,
        perfil: perfilString,
      };

      localStorage.setItem("usuario", JSON.stringify(atualizadoCorrigido));
      setUsuario(atualizadoCorrigido);

      toast.success("✅ Dados atualizados com sucesso!");
    } catch (err) {
      toast.error("❌ Não foi possível salvar.");
    }
  };

  if (!usuario) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-300">
        🔄 Carregando dados do perfil...
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-screen bg-gelo dark:bg-zinc-900">
      <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Perfil" }]} />

      <h1 className="text-2xl font-bold mb-6 text-lousa dark:text-white text-center">
        👤 Meu Perfil
      </h1>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow space-y-4">
        <div>
          <label htmlFor="nome" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Nome completo
          </label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
            aria-label="Nome completo"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
            aria-label="E-mail"
          />
        </div>

        <div>
          <label htmlFor="senha" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Nova senha (opcional)
          </label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite para alterar a senha"
            className="mt-1 w-full px-4 py-2 border rounded-md bg-gray-50 dark:bg-zinc-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-lousa"
            aria-label="Nova senha"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
          <button
            onClick={salvarAlteracoes}
            className="bg-lousa text-white px-5 py-2 rounded-md hover:bg-green-800 shadow focus:outline-none focus:ring-2 focus:ring-lousa"
            aria-label="Salvar alterações no perfil"
          >
            💾 Salvar Alterações
          </button>

          {(usuario.perfil === "instrutor" || usuario.perfil === "administrador") && (
            <button
              onClick={() => setModalAberto(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400"
              aria-label="Gerenciar assinatura digital"
            >
              ✍️ Gerenciar Assinatura
            </button>
          )}
        </div>
      </div>

      <ModalAssinatura
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
      />
    </main>
  );
}
