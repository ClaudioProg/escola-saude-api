// 📁 src/components/EditarInstrutor.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "./Breadcrumbs";
import BotaoPrimario from "./BotaoPrimario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarInstrutor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [instrutor, setInstrutor] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/usuarios/${id}`);
        if (ativo) {
          setInstrutor(data);
          setErro("");
        }
      } catch {
        if (ativo) {
          setErro("Erro ao carregar dados do instrutor.");
          setInstrutor(null);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setInstrutor((prev) => ({
      ...prev,
      [name]: name === "email" ? value.trim() : value,
    }));
  }

  function validar(form) {
    const msgs = [];
    if (!form?.nome?.trim()) msgs.push("Informe o nome completo.");
    if (!form?.email?.trim()) {
      msgs.push("Informe o e-mail.");
    } else {
      // validação simples de e-mail
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      if (!ok) msgs.push("E-mail inválido.");
    }
    return msgs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!instrutor) return;

    const msgs = validar(instrutor);
    if (msgs.length) {
      toast.warn(msgs.join(" "));
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      await apiPut(`/api/usuarios/${id}`, {
        ...instrutor,
        email: instrutor.email?.toLowerCase(), // normaliza
      });
      toast.success("✅ Instrutor atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      setErro("Erro ao salvar alterações.");
      toast.error("❌ Erro ao atualizar instrutor.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!instrutor) {
    return (
      <p className="text-center text-red-600 dark:text-red-400 my-10" role="alert" aria-live="assertive">
        {erro || "Não foi possível carregar o instrutor."}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs trilha={[{ label: "Painel do Administrador", href: "/administrador" }, { label: "Editar Instrutor" }]} />

      {/* Cabeçalho padrão (verde-900) */}
      <div
        className="flex justify-between items-center bg-green-900 text-white px-4 py-2 rounded-xl shadow mb-6"
        role="region"
        aria-label="Cabeçalho do painel do administrador"
      >
        <span>Seja bem-vindo(a), <strong>{nomeUsuario}</strong></span>
        <span className="font-semibold">Painel do Administrador</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow"
        role="form"
        aria-label="Edição de instrutor"
      >
        <h2 className="text-2xl font-bold mb-6 text-green-900 dark:text-green-200 text-center">
          ✏️ Editar Instrutor
        </h2>

        {erro && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <fieldset disabled={salvando} aria-busy={salvando}>
            <div>
              <label htmlFor="nome" className="block font-semibold mb-1">Nome Completo</label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={instrutor.nome || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Nome do instrutor"
                placeholder="Digite o nome completo"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block font-semibold mb-1">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                value={instrutor.email || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="E-mail do instrutor"
                placeholder="nome.sobrenome@dominio.gov.br"
                autoComplete="email"
                inputMode="email"
              />
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
