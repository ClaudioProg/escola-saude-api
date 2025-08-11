// src/pages/Perfil.jsx
import { useEffect, useState, useMemo } from "react";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import ModalAssinatura from "../components/ModalAssinatura";
import { apiPatch } from "../services/api";

export default function Perfil() {
  const [usuario, setUsuario] = useState(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);

  const token = useMemo(() => localStorage.getItem("token"), []);

  useEffect(() => {
    try {
      const dadosString = localStorage.getItem("usuario");
      if (!dadosString) return;

      const dados = JSON.parse(dadosString);
      // perfil pode vir como array; padroniza para string (primeiro perfil)
      const perfilString = Array.isArray(dados.perfil) ? dados.perfil[0] : dados.perfil;

      const usuarioCorrigido = { ...dados, perfil: perfilString };
      setUsuario(usuarioCorrigido);
      setNome(usuarioCorrigido.nome || "");
      setEmail(usuarioCorrigido.email || "");
    } catch (erro) {
      console.error("Erro ao carregar dados do localStorage:", erro);
      toast.error("Erro ao carregar dados do perfil.");
    }
  }, []);

  const validarEmail = (v) =>
    !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const salvarAlteracoes = async () => {
    if (!usuario?.id) return;

    if (!nome.trim()) {
      toast.warn("Informe seu nome.");
      return;
    }
    if (!validarEmail(email)) {
      toast.warn("Informe um e-mail válido.");
      return;
    }
    if (senha && senha.length < 8) {
      toast.warn("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      email: email.trim(),
      ...(senha ? { senha } : {}), // só envia se o usuário digitou
    };

    try {
      setSalvando(true);
      const atualizado = await apiPatch(`/api/usuarios/${usuario.id}`, payload, { auth: true });

      // perfil pode voltar como array; normaliza
      const perfilString = Array.isArray(atualizado?.perfil)
        ? atualizado.perfil[0]
        : atualizado?.perfil;

      const atualizadoCorrigido = { ...atualizado, perfil: perfilString };

      // atualiza localStorage
      localStorage.setItem("usuario", JSON.stringify(atualizadoCorrigido));
      localStorage.setItem("nome", atualizadoCorrigido.nome || nome);

      setUsuario(atualizadoCorrigido);
      setSenha(""); // limpa campo de senha

      toast.success("✅ Dados atualizados com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuario) {
    return (
      <div className="p-4 text-center text-gray-600 dark:text-gray-300">
        🔄 Carregando dados do perfil...
      </div>
    );
  }

  const podeGerenciarAssinatura =
    usuario.perfil === "instrutor" || usuario.perfil === "administrador";

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 min-h-screen bg-gelo dark:bg-zinc-900">
      <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Perfil" }]} />

      <h1 className="text-2xl font-bold mb-6 text-lousa dark:text-white text-center">
        👤 Meu Perfil
      </h1>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow space-y-4">
        <div>
          <label
            htmlFor="nome"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
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
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
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
          <label
            htmlFor="senha"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          >
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
          {senha && senha.length < 8 && (
            <p className="text-xs text-red-500 mt-1">
              A nova senha deve ter pelo menos 8 caracteres.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6">
          <button
            onClick={salvarAlteracoes}
            disabled={salvando}
            className={`${
              salvando ? "bg-green-900 cursor-not-allowed" : "bg-lousa hover:bg-green-800"
            } text-white px-5 py-2 rounded-md shadow focus:outline-none focus:ring-2 focus:ring-lousa`}
            aria-label="Salvar alterações no perfil"
          >
            {salvando ? "Salvando..." : "💾 Salvar Alterações"}
          </button>

          {podeGerenciarAssinatura && (
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

      <ModalAssinatura isOpen={modalAberto} onClose={() => setModalAberto(false)} />
    </main>
  );
}
