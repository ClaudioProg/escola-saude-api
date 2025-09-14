// 📁 src/components/EditarCertificado.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarCertificado() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [certificado, setCertificado] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet(`/api/certificados/${id}`);
        setCertificado(data);
        setErro("");
      } catch (e) {
        setErro("Erro ao carregar dados do certificado.");
        setCertificado(null);
      }
    })();
  }, [id]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setCertificado((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function validar(form) {
    const msgs = [];
    // data obrigatória
    if (!form.gerado_em) msgs.push("Informe a data de emissão.");
    // carga horária >= 0 (aceita decimais)
    const ch = Number(form.carga_horaria);
    if (!Number.isFinite(ch) || ch < 0) msgs.push("Carga horária deve ser um número maior ou igual a zero.");
    return msgs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!certificado) return;

    const msgs = validar(certificado);
    if (msgs.length) {
      toast.warn(msgs.join(" "));
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      await apiPut(`/api/certificados/${id}`, certificado);
      toast.success("✅ Certificado atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch (err) {
      toast.error("❌ Erro ao atualizar certificado.");
      setErro("Erro ao atualizar certificado.");
    } finally {
      setSalvando(false);
    }
  }

  if (!certificado && !erro) {
    return (
      <p className="p-4 text-center text-gray-600 dark:text-gray-300">
        Carregando…
      </p>
    );
  }

  if (!certificado && erro) {
    return (
      <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
        {erro}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs trilha={[{ label: "Painel do Administrador", href: "/administrador" }, { label: "Editar Certificado" }]} />

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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
      >
        <h1 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-6">
          ✏️ Editar Certificado
        </h1>

        {/* Erro de submissão (não bloqueia formulário) */}
        {erro && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset disabled={salvando} aria-busy={salvando}>
            <div>
              <label className="block font-semibold mb-1">Nome do usuário</label>
              <input
                type="text"
                value={certificado.nome || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Evento</label>
              <input
                type="text"
                value={certificado.evento || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1" htmlFor="gerado_em">Data de Emissão</label>
              <input
                id="gerado_em"
                type="date"
                name="gerado_em"
                value={certificado.gerado_em?.slice(0, 10) || ""}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1" htmlFor="carga_horaria">Carga Horária</label>
              <input
                id="carga_horaria"
                type="number"
                name="carga_horaria"
                min="0"
                step="0.5"
                inputMode="decimal"
                value={certificado.carga_horaria ?? ""}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-zinc-600 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Código do Certificado</label>
              <input
                type="text"
                value={certificado.codigo || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Link de Validação</label>
              <input
                type="text"
                value={certificado.link_validacao || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emitido"
                id="emitido"
                checked={!!certificado.emitido}
                onChange={handleChange}
                className="h-4 w-4 accent-green-700"
              />
              <label htmlFor="emitido" className="text-sm">Certificado Emitido</label>
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
