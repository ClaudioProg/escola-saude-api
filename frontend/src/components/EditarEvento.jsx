// 📁 src/components/EditarEvento.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiPut, apiDelete } from "../services/api";

/* Helpers */
function toLocalYMD(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function EditarEvento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);
  const [evento, setEvento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/eventos/${id}`);
      setEvento(data || {});
    } catch {
      setErroGeral("Erro ao carregar evento.");
      setEvento(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setEvento((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  function validar(form) {
    const msgs = {};
    if (!form?.nome?.trim()) msgs.nome = "Informe o título do evento.";
    const di = toLocalYMD(form?.data_inicio);
    const df = toLocalYMD(form?.data_fim);
    if (!di) msgs.data_inicio = "Informe a data de início.";
    if (!df) msgs.data_fim = "Informe a data de fim.";
    if (di && df && di > df) {
      msgs.data_fim = "A data de fim não pode ser anterior à data de início.";
    }
    return msgs;
  }

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!evento || salvando || excluindo) return;

    const msgs = validar(evento);
    setErrors(msgs);
    if (Object.keys(msgs).length) {
      toast.warn("⚠️ Corrija os campos destacados.");
      return;
    }

    setSalvando(true);
    setErroGeral("");
    try {
      await apiPut(`/api/eventos/${id}`, evento);
      toast.success("✅ Evento atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      toast.error("❌ Não foi possível atualizar o evento.");
      setErroGeral("Não foi possível atualizar o evento.");
    } finally {
      setSalvando(false);
    }
  }, [evento, salvando, excluindo, id, navigate]);

  const handleExcluir = useCallback(async () => {
    if (excluindo || salvando) return;
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
  }, [excluindo, salvando, id, navigate]);

  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Evento" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!evento && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Evento" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)} variant="outline">← Voltar</BotaoSecundario>
        </div>
      </main>
    );
  }

  const nome = evento?.nome || "";
  const data_inicio = toLocalYMD(evento?.data_inicio);
  const data_fim = toLocalYMD(evento?.data_fim);

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel tituloOverride="Editar Evento" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
        role="region"
        aria-labelledby="editar-evento-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h1 id="editar-evento-titulo" className="text-2xl font-bold text-green-900 dark:text-green-200 mb-2">
          ✏️ Editar Evento
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Seja bem-vindo(a), <strong>{nomeUsuario || "usuário(a)"}</strong>.
        </p>

        {erroGeral && (
          <p id={`${liveId}-status`} className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erroGeral}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" aria-label="Formulário de edição de evento" noValidate>
          <fieldset disabled={salvando || excluindo} aria-busy={salvando || excluindo} className="space-y-4">
            {/* Título */}
            <div>
              <label htmlFor="titulo" className="block font-semibold mb-1">
                Título <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="titulo"
                type="text"
                name="nome"
                value={nome}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "erro-nome" : undefined}
                placeholder="Digite o título do evento"
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.nome ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.nome && <p id="erro-nome" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nome}</p>}
            </div>

            {/* Data de Início */}
            <div>
              <label htmlFor="data_inicio" className="block font-semibold mb-1">
                Data de Início <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="data_inicio"
                type="date"
                name="data_inicio"
                value={data_inicio}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.data_inicio}
                aria-describedby={errors.data_inicio ? "erro-data_inicio" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.data_inicio ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.data_inicio && (
                <p id="erro-data_inicio" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.data_inicio}</p>
              )}
            </div>

            {/* Data de Fim */}
            <div>
              <label htmlFor="data_fim" className="block font-semibold mb-1">
                Data de Fim <span className="sr-only">(obrigatório)</span>
              </label>
              <input
                id="data_fim"
                type="date"
                name="data_fim"
                value={data_fim}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.data_fim}
                aria-describedby={errors.data_fim ? "erro-data_fim" : undefined}
                min={data_inicio || undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.data_fim ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.data_fim && (
                <p id="erro-data_fim" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.data_fim}</p>
              )}
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center gap-2">
              <BotaoPrimario type="submit" disabled={salvando || excluindo}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>
              <BotaoSecundario onClick={() => navigate(-1)} variant="outline">
                Cancelar
              </BotaoSecundario>
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
