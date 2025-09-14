// 📁 src/components/EditarUsuario.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const data = await apiGet(`/api/usuarios/${id}`);
        const perfil = Array.isArray(data.perfil)
          ? data.perfil
          : typeof data.perfil === "string"
          ? data.perfil.split(",").map((p) => p.trim()).filter(Boolean)
          : [];
        if (ativo) {
          setUsuario({ ...data, perfil });
          setErro("");
        }
      } catch {
        if (ativo) setErro("Erro ao carregar dados do usuário.");
      }
    })();
    return () => { ativo = false; };
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUsuario((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePerfilChange = (e) => {
    const value = Array.from(e.target.selectedOptions, (o) => o.value);
    setUsuario((prev) => ({ ...prev, perfil: value }));
  };

  function validar(form) {
    const msgs = [];
    if (!form?.nome?.trim()) msgs.push("Informe o nome.");
    if (!form?.email?.trim()) {
      msgs.push("Informe o e-mail.");
    } else {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      if (!ok) msgs.push("E-mail inválido.");
    }
    if (!Array.isArray(form?.perfil) || form.perfil.length === 0) {
      msgs.push("Selecione pelo menos um perfil.");
    }
    return msgs;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usuario) return;

    const msgs = validar(usuario);
    if (msgs.length) {
      toast.warn(msgs.join(" "));
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      await apiPut(`/api/usuarios/${id}`, {
        ...usuario,
        email: usuario.email.toLowerCase(),
        // Caso o backend aceite string, troque para: perfil: usuario.perfil.join(',')
        perfil: usuario.perfil,
      });
      toast.success("✅ Usuário atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      toast.error("❌ Erro ao atualizar usuário.");
      setErro("Erro ao atualizar usuário.");
    } finally {
      setSalvando(false);
    }
  };

  if (!usuario) {
    return (
      <p className="p-4 text-center text-gray-600 dark:text-gray-300">
        {erro || "Carregando…"}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs
        trilha={[
          { label: "Painel do Administrador", href: "/administrador" },
          { label: "Editar Usuário" },
        ]}
      />

      {/* Cabeçalho padrão (verde-900) */}
      <div
        className="flex justify-between items-center bg-green-900 text-white px-4 py-2 rounded-xl shadow mb-6"
        role="region"
        aria-label="Cabeçalho do painel do administrador"
      >
        <span>
          Seja bem-vindo(a), <strong>{nomeUsuario}</strong>
        </span>
        <span className="font-semibold">Painel do Administrador</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
      >
        <h1 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-6">
          ✏️ Editar Usuário
        </h1>

        {erro && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset disabled={salvando} aria-busy={salvando}>
            <div>
              <label className="block font-semibold mb-1" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={usuario.nome || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                autoComplete="name"
                placeholder="Digite o nome completo"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={usuario.email || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                autoComplete="email"
                inputMode="email"
                placeholder="nome.sobrenome@dominio.gov.br"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1" htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                value={usuario.cpf || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1" htmlFor="perfil">
                Perfil
              </label>
              <select
                id="perfil"
                multiple
                name="perfil"
                value={usuario.perfil || []}
                onChange={handlePerfilChange}
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                aria-describedby="perfil-hint"
              >
                <option value="administrador">administrador</option>
                <option value="instrutor">instrutor</option>
                <option value="usuario">usuario</option>
              </select>
              <p id="perfil-hint" className="text-xs text-gray-500 mt-1">
                Segure Ctrl (ou Cmd) para selecionar mais de um.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ativo"
                type="checkbox"
                name="ativo"
                checked={!!usuario.ativo}
                onChange={handleChange}
                className="h-4 w-4 accent-green-700"
              />
              <label htmlFor="ativo" className="text-sm">
                Usuário ativo
              </label>
            </div>

            <div className="pt-2">
              <BotaoPrimario type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>
            </div>
          </fieldset>
        </form>
      </motion.div>
    </main>
  );
}
