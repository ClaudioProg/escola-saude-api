// 📁 src/components/EditarTurma.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

export default function EditarTurma() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [turma, setTurma] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setCarregando(true);
        const data = await apiGet(`/api/turmas/${id}`);
        if (ativo) {
          setTurma(data);
          setErro("");
        }
      } catch {
        if (ativo) {
          setErro("Erro ao carregar dados da turma.");
          setTurma(null);
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setTurma((prev) => ({ ...prev, [name]: value }));
  }

  function validar(form) {
    const msgs = [];
    if (!form?.nome?.trim()) msgs.push("Informe o nome da turma.");
    const di = form?.data_inicio?.slice(0, 10);
    const df = form?.data_fim?.slice(0, 10);
    if (!di) msgs.push("Informe a data de início.");
    if (!df) msgs.push("Informe a data de fim.");
    if (di && df && di > df) msgs.push("A data de fim não pode ser anterior à data de início.");
    const vagas = Number(form?.vagas_total ?? form?.vagas_totais ?? form?.vagas ?? "");
    if (!Number.isFinite(vagas) || vagas < 0) msgs.push("Total de vagas deve ser um número maior ou igual a zero.");
    return msgs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!turma) return;
    const msgs = validar(turma);
    if (msgs.length) {
      toast.warn(msgs.join(" "));
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      // normaliza campo de vagas para número
      const payload = {
        ...turma,
        vagas_total: turma?.vagas_total ?? turma?.vagas_totais ?? turma?.vagas ?? turma?.capacidade ?? 0,
      };
      payload.vagas_total = Number(payload.vagas_total);

      await apiPut(`/api/turmas/${id}`, payload);
      toast.success("✅ Turma atualizada com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      toast.error("❌ Erro ao atualizar turma.");
      setErro("Erro ao atualizar turma.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <div className="max-w-xl mx-auto p-8">
        <div className="animate-pulse h-8 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!turma) {
    return (
      <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
        {erro || "Erro ao carregar turma."}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs trilha={[{ label: "Painel do Administrador", href: "/administrador" }, { label: "Editar Turma" }]} />

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
        aria-label="Edição de turma"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-green-900 dark:text-green-200">
          ✏️ Editar Turma
        </h2>

        {erro && (
          <p className="text-red-600 dark:text-red-400 mb-4 text-center" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" aria-label="Formulário de edição de turma" noValidate>
          <fieldset disabled={salvando} aria-busy={salvando}>
            <div>
              <label htmlFor="nome" className="block font-semibold mb-1">Nome da Turma</label>
              <input
                id="nome"
                type="text"
                name="nome"
                value={turma.nome ?? ""}
                onChange={handleChange}
                placeholder="Nome da Turma"
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Nome da turma"
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="data_inicio" className="block font-semibold mb-1">Data de Início</label>
              <input
                id="data_inicio"
                type="date"
                name="data_inicio"
                value={turma.data_inicio?.slice(0, 10) ?? ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Data de início"
              />
            </div>

            <div>
              <label htmlFor="data_fim" className="block font-semibold mb-1">Data de Fim</label>
              <input
                id="data_fim"
                type="date"
                name="data_fim"
                value={turma.data_fim?.slice(0, 10) ?? ""}
                onChange={handleChange}
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Data de fim"
                min={turma.data_inicio?.slice(0, 10) || undefined}
              />
            </div>

            <div>
              <label htmlFor="vagas_total" className="block font-semibold mb-1">Total de Vagas</label>
              <input
                id="vagas_total"
                type="number"
                name="vagas_total"
                value={
                  turma.vagas_total ??
                  turma.vagas_totais ??
                  turma.vagas ??
                  turma.capacidade ??
                  ""
                }
                onChange={handleChange}
                placeholder="Total de Vagas"
                min="0"
                step="1"
                inputMode="numeric"
                className="w-full border border-gray-300 dark:border-zinc-600 px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600"
                required
                aria-required="true"
                aria-label="Total de vagas"
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
