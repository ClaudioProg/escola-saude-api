// 📁 src/components/EditarTurma.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarTurma() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const [turma, setTurma] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/turmas/${id}`);
      setTurma(data || {});
    } catch {
      setTurma(null);
      setErroGeral("Erro ao carregar dados da turma.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setTurma((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  // Normaliza e valida
  function validar(form) {
    const msgs = {};
    const nome = form?.nome?.trim();
    const di = form?.data_inicio?.slice(0, 10);
    const df = form?.data_fim?.slice(0, 10);

    let vagas =
      form?.vagas_total ?? form?.vagas_totais ?? form?.vagas ?? form?.capacidade;
    vagas = vagas === "" || vagas == null ? "" : Number(vagas);

    if (!nome) msgs.nome = "Informe o nome da turma.";
    if (!di) msgs.data_inicio = "Informe a data de início.";
    if (!df) msgs.data_fim = "Informe a data de fim.";
    if (di && df && di > df) msgs.data_fim = "A data de fim não pode ser anterior à de início.";

    if (vagas === "") msgs.vagas_total = "Informe o total de vagas.";
    else if (!Number.isFinite(vagas) || vagas < 0)
      msgs.vagas_total = "Total de vagas deve ser um número ≥ 0.";

    return msgs;
  }

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!turma || salvando) return;

      const msgs = validar(turma);
      setErrors(msgs);
      if (Object.keys(msgs).length) {
        toast.warn("⚠️ Corrija os campos destacados.");
        return;
      }

      // payload normalizado
      const payload = {
        ...turma,
        nome: turma.nome?.trim(),
        data_inicio: turma.data_inicio?.slice(0, 10),
        data_fim: turma.data_fim?.slice(0, 10),
        vagas_total:
          Number(
            turma?.vagas_total ??
              turma?.vagas_totais ??
              turma?.vagas ??
              turma?.capacidade ??
              0
          ) || 0,
      };

      setSalvando(true);
      setErroGeral("");
      try {
        await apiPut(`/api/turmas/${id}`, payload);
        toast.success("✅ Turma atualizada com sucesso!");
        navigate("/administrador", { replace: true });
      } catch {
        setErroGeral("Erro ao atualizar turma.");
        toast.error("❌ Erro ao atualizar turma.");
      } finally {
        setSalvando(false);
      }
    },
    [turma, salvando, id, navigate]
  );

  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Turma" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!turma && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Turma" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
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
      <CabecalhoPainel
        tituloOverride="Editar Turma"
        actions={
          <span className="text-sm opacity-90 hidden sm:block">
            Seja bem-vindo(a), <strong>{nomeUsuario || "usuário(a)"}</strong>
          </span>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
        role="region"
        aria-labelledby="editar-turma-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h2 id="editar-turma-titulo" className="text-2xl font-bold mb-4 text-green-900 dark:text-green-200 text-center">
          ✏️ Editar Turma
        </h2>

        {erroGeral && (
          <p id={`${liveId}-status`} className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erroGeral}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label="Formulário de edição de turma">
          <fieldset disabled={salvando} aria-busy={salvando}>
            {/* Nome */}
            <div>
              <label htmlFor="nome" className="block font-semibold mb-1">Nome da Turma</label>
              <input
                id="nome"
                type="text"
                name="nome"
                value={turma?.nome ?? ""}
                onChange={handleChange}
                placeholder="Nome da Turma"
                required
                aria-required="true"
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "erro-nome" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.nome ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                autoComplete="off"
              />
              {errors.nome && <p id="erro-nome" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nome}</p>}
            </div>

            {/* Data início */}
            <div>
              <label htmlFor="data_inicio" className="block font-semibold mb-1">Data de Início</label>
              <input
                id="data_inicio"
                type="date"
                name="data_inicio"
                value={turma?.data_inicio?.slice(0, 10) ?? ""}
                onChange={handleChange}
                required
                aria-required="true"
                aria-invalid={!!errors.data_inicio}
                aria-describedby={errors.data_inicio ? "erro-di" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.data_inicio ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.data_inicio && <p id="erro-di" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.data_inicio}</p>}
            </div>

            {/* Data fim */}
            <div>
              <label htmlFor="data_fim" className="block font-semibold mb-1">Data de Fim</label>
              <input
                id="data_fim"
                type="date"
                name="data_fim"
                value={turma?.data_fim?.slice(0, 10) ?? ""}
                onChange={handleChange}
                min={turma?.data_inicio?.slice(0, 10) || undefined}
                required
                aria-required="true"
                aria-invalid={!!errors.data_fim}
                aria-describedby={errors.data_fim ? "erro-df" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.data_fim ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.data_fim && <p id="erro-df" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.data_fim}</p>}
            </div>

            {/* Vagas */}
            <div>
              <label htmlFor="vagas_total" className="block font-semibold mb-1">Total de Vagas</label>
              <input
                id="vagas_total"
                type="number"
                name="vagas_total"
                value={
                  turma?.vagas_total ??
                  turma?.vagas_totais ??
                  turma?.vagas ??
                  turma?.capacidade ??
                  ""
                }
                onChange={handleChange}
                placeholder="Total de Vagas"
                min="0"
                step="1"
                inputMode="numeric"
                required
                aria-required="true"
                aria-invalid={!!errors.vagas_total}
                aria-describedby={errors.vagas_total ? "erro-vagas" : undefined}
                className={[
                  "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.vagas_total ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.vagas_total && <p id="erro-vagas" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.vagas_total}</p>}
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
