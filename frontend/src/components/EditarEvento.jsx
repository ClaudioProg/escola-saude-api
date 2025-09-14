// 📁 src/components/EditarEvento.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut, apiDelete } from "../services/api"; // ✅ serviço centralizado

export default function EditarEvento() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [evento, setEvento] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/eventos/${id}`);
        if (ativo) {
          setEvento(data);
          setErro("");
        }
      } catch {
        if (ativo) {
          setErro("Erro ao carregar evento.");
          setEvento(null);
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
    setEvento((prev) => ({ ...prev, [name]: value }));
  }

  function validar(form) {
    const msgs = [];
    if (!form?.nome?.trim()) msgs.push("Informe o título do evento.");
    const di = form?.data_inicio?.slice(0, 10);
    const df = form?.data_fim?.slice(0, 10);
    if (!di) msgs.push("Informe a data de início.");
    if (!df) msgs.push("Informe a data de fim.");
    if (di && df && di > df) msgs.push("A data de fim não pode ser anterior à data de início.");
    return msgs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!evento) return;
    const msgs = validar(evento);
    if (msgs.length) {
      toast.warn(msgs.join(" "));
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await apiPut(`/api/eventos/${id}`, evento);
      toast.success("✅ Evento atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      toast.error("❌ Não foi possível atualizar o evento.");
      setErro("Não foi possível atualizar o evento.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!window.confirm("Tem certeza que deseja excluir este evento? Esta ação não poderá ser desfeita.")) return;
    setExcluindo(true);
    try {
      await apiDelete(`/api/eventos/${id}`);
      toast.success("🗑️ Evento excluído com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      toast.error("❌ Erro ao excluir evento.");
    } finally {
      setExcluindo(false);
    }
  }

  if (carregando) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (erro && !evento) {
    return (
      <p className="text-red-600 dark:text-red-400 text-center my-10" role="alert" aria-live="assertive">
        {erro}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs trilha={[{ label: "Painel do Administrador", href: "/administrador" }, { label: "Editar Evento" }]} />

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
        role="main"
        aria-label="Edição de evento"
      >
        <h1 className="text-2xl font-bold text-green-900 dark:text-green-200 mb-6">
          ✏️ Editar Evento
        </h1>

        {erro && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulário de edição de evento" noValidate>
          <fieldset disabled={salvando || excluindo} aria-busy={salvando || excluindo}>
            <div>
              <label htmlFor="titulo" className="block font-semibold mb-1">
                Título <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="titulo"
                type="text"
                name="nome"
                value={evento?.nome || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Título do evento"
                placeholder="Digite o título do evento"
              />
            </div>

            <div>
              <label htmlFor="data_inicio" className="block font-semibold mb-1">
                Data de Início <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="data_inicio"
                type="date"
                name="data_inicio"
                value={evento?.data_inicio?.slice(0, 10) || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Data de início"
              />
            </div>

            <div>
              <label htmlFor="data_fim" className="block font-semibold mb-1">
                Data de Fim <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="data_fim"
                type="date"
                name="data_fim"
                value={evento?.data_fim?.slice(0, 10) || ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Data de fim"
                min={evento?.data_inicio?.slice(0, 10) || undefined}
              />
            </div>

            <div className="pt-2">
              <BotaoPrimario type="submit" disabled={salvando || excluindo}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>
            </div>
          </fieldset>
        </form>

        <hr className="my-6 border-gray-300 dark:border-gray-600" />

        <button
          type="button"
          onClick={handleExcluir}
          disabled={excluindo || salvando}
          className="text-sm text-red-600 hover:underline mt-2 disabled:opacity-60"
          aria-disabled={excluindo || salvando}
        >
          {excluindo ? "Excluindo..." : "🗑️ Excluir Evento"}
        </button>
      </motion.div>
    </main>
  );
}
