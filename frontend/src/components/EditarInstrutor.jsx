// 📁 src/components/EditarInstrutor.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarInstrutor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const [instrutor, setInstrutor] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/usuarios/${id}`);
      setInstrutor(data || {});
    } catch {
      setInstrutor(null);
      setErroGeral("Erro ao carregar dados do instrutor.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setInstrutor((prev) => ({
      ...prev,
      [name]: name === "email" ? value.trim() : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  function validar(form) {
    const msgs = {};
    if (!form?.nome?.trim()) msgs.nome = "Informe o nome completo.";
    if (!form?.email?.trim()) {
      msgs.email = "Informe o e-mail.";
    } else {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      if (!ok) msgs.email = "E-mail inválido.";
    }
    return msgs;
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!instrutor || salvando) return;

    const msgs = validar(instrutor);
    setErrors(msgs);
    if (Object.keys(msgs).length) {
      toast.warn("⚠️ Corrija os campos destacados.");
      return;
    }

    setSalvando(true);
    setErroGeral("");
    try {
      await apiPut(`/api/usuarios/${id}`, {
        ...instrutor,
        email: instrutor.email?.toLowerCase(), // normaliza
      });
      toast.success("✅ Instrutor atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      setErroGeral("Erro ao salvar alterações.");
      toast.error("❌ Erro ao atualizar instrutor.");
    } finally {
      setSalvando(false);
    }
  }, [instrutor, salvando, id, navigate]);

  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Instrutor" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!instrutor && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Instrutor" />
        <p className="text-center text-red-600 dark:text-red-400 my-10" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)} variant="outline">← Voltar</BotaoSecundario>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel tituloOverride="Editar Instrutor" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow"
        role="region"
        aria-labelledby="editar-instrutor-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h2 id="editar-instrutor-titulo" className="text-2xl font-bold mb-2 text-green-900 dark:text-green-200">
          ✏️ Editar Instrutor
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Seja bem-vindo(a), <strong>{nomeUsuario || "usuário(a)"}</strong>.
        </p>

        {erroGeral && (
          <p id={`${liveId}-status`} className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erroGeral}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-label="Formulário de edição de instrutor">
          <fieldset disabled={salvando} aria-busy={salvando} className="space-y-4">
            {/* Nome */}
            <div>
              <label htmlFor="nome" className="block font-semibold mb-1">Nome Completo</label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={instrutor?.nome || ""}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "erro-nome" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.nome ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                placeholder="Digite o nome completo"
                autoComplete="name"
              />
              {errors.nome && <p id="erro-nome" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nome}</p>}
            </div>

            {/* E-mail */}
            <div>
              <label htmlFor="email" className="block font-semibold mb-1">E-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                value={instrutor?.email || ""}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "erro-email" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.email ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                placeholder="nome.sobrenome@dominio.gov.br"
                autoComplete="email"
                inputMode="email"
              />
              {errors.email && <p id="erro-email" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center gap-2">
              <BotaoPrimario type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>
              <BotaoSecundario onClick={() => navigate(-1)} variant="outline">
                Cancelar
              </BotaoSecundario>
            </div>
          </fieldset>
        </form>
      </motion.div>
    </main>
  );
}
