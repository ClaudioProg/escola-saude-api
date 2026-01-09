// 📁 src/components/EditarTurma.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

/* ============================ Helpers ============================ */
const toYMD = (v) => (v ? String(v).slice(0, 10) : "");
const clampInt = (n, mi = 0, ma = 10 ** 9) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return mi;
  return Math.max(mi, Math.min(ma, Math.trunc(v)));
};
const isChanged = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
const hhmmOk = (s) => /^\d{2}:\d{2}$/.test(String(s || ""));

/* comparação HH:mm (assume strings válidas) */
const hhmmToMin = (s) => {
  const [h, m] = String(s).split(":").map(Number);
  return h * 60 + m;
};

export default function EditarTurma() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const [turma, setTurma] = useState(null);
  const [original, setOriginal] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});
  const [liveMsg, setLiveMsg] = useState("");

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  /* ============================ Load ============================ */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/turmas/${id}`);
      setTurma(data || {});
      setOriginal(data || {});
    } catch {
      setTurma(null);
      setOriginal(null);
      setErroGeral("Erro ao carregar dados da turma.");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /* ============================ Form ============================ */
  const announce = (msg) => {
    setLiveMsg(msg);
    requestAnimationFrame(() => {
      setLiveMsg("");
      requestAnimationFrame(() => setLiveMsg(msg));
    });
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setTurma((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  // Normaliza e valida
  function validar(form) {
    const msgs = {};

    const nome = form?.nome?.trim();
    const di = toYMD(form?.data_inicio);
    const df = toYMD(form?.data_fim);

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

    // Se backend expõe horários, validamos coerência
    if ("horario_inicio" in (form || {}) || "horario_fim" in (form || {})) {
      const hi = form?.horario_inicio || "";
      const hf = form?.horario_fim || "";
      if (hi && !hhmmOk(hi)) msgs.horario_inicio = "Formato inválido (use HH:MM).";
      if (hf && !hhmmOk(hf)) msgs.horario_fim = "Formato inválido (use HH:MM).";
      if (hhmmOk(hi) && hhmmOk(hf) && hhmmToMin(hf) <= hhmmToMin(hi)) {
        msgs.horario_fim = "Horário final deve ser maior que o inicial.";
      }
    }

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

      // payload normalizado (preserva compat dos campos)
      const nome = turma.nome?.trim();
      const data_inicio = toYMD(turma.data_inicio);
      const data_fim = toYMD(turma.data_fim);

      const vagas_total =
        clampInt(
          turma?.vagas_total ??
            turma?.vagas_totais ??
            turma?.vagas ??
            turma?.capacidade ??
            0,
          0
        );

      const payload = {
        ...turma,
        nome,
        data_inicio,
        data_fim,
        vagas_total,
      };

      // Se o backend já usa horários, mantemos; se não, não incluímos nada
      if ("horario_inicio" in turma) {
        payload.horario_inicio = turma.horario_inicio || "";
      }
      if ("horario_fim" in turma) {
        payload.horario_fim = turma.horario_fim || "";
      }

      // Evita PUT inútil quando nada mudou (comparação seletiva)
      const snapshotAtual = {
        nome,
        data_inicio,
        data_fim,
        vagas_total,
        ...("horario_inicio" in payload ? { horario_inicio: payload.horario_inicio } : {}),
        ...("horario_fim" in payload ? { horario_fim: payload.horario_fim } : {}),
      };

      const snapshotOriginal = {
        nome: original?.nome?.trim() || "",
        data_inicio: toYMD(original?.data_inicio),
        data_fim: toYMD(original?.data_fim),
        vagas_total: clampInt(
          original?.vagas_total ??
            original?.vagas_totais ??
            original?.vagas ??
            original?.capacidade ??
            0,
          0
        ),
        ...("horario_inicio" in (original || {}) ? { horario_inicio: original.horario_inicio || "" } : {}),
        ...("horario_fim" in (original || {}) ? { horario_fim: original.horario_fim || "" } : {}),
      };

      if (!isChanged(snapshotAtual, snapshotOriginal)) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

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
    [turma, salvando, id, navigate, original]
  );

  const descartarAlteracoes = useCallback(() => {
    if (!original) return;
    setTurma(original);
    setErrors({});
    announce("Alterações descartadas.");
    toast.info("Alterações descartadas.");
  }, [original]);

  /* ============================ UI states ============================ */
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

  // Flags condicionais (não quebram API)
  const temHorarioInicio = "horario_inicio" in (turma || {});
  const temHorarioFim = "horario_fim" in (turma || {});

  const houveMudancas = original && turma && isChanged(
    {
      nome: turma?.nome?.trim() || "",
      data_inicio: toYMD(turma?.data_inicio),
      data_fim: toYMD(turma?.data_fim),
      vagas_total: clampInt(
        turma?.vagas_total ?? turma?.vagas_totais ?? turma?.vagas ?? turma?.capacidade ?? 0
      ),
      ...(temHorarioInicio ? { horario_inicio: turma.horario_inicio || "" } : {}),
      ...(temHorarioFim ? { horario_fim: turma.horario_fim || "" } : {}),
    },
    {
      nome: original?.nome?.trim() || "",
      data_inicio: toYMD(original?.data_inicio),
      data_fim: toYMD(original?.data_fim),
      vagas_total: clampInt(
        original?.vagas_total ?? original?.vagas_totais ?? original?.vagas ?? original?.capacidade ?? 0
      ),
      ...(temHorarioInicio ? { horario_inicio: original?.horario_inicio || "" } : {}),
      ...(temHorarioFim ? { horario_fim: original?.horario_fim || "" } : {}),
    }
  );

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

        {/* aria-live discreto para mensagens de acessibilidade */}
        <p id={`${liveId}-live`} role="status" aria-live="polite" className="sr-only">{liveMsg}</p>

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
                value={toYMD(turma?.data_inicio)}
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
                value={toYMD(turma?.data_fim)}
                onChange={handleChange}
                min={toYMD(turma?.data_inicio) || undefined}
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

            {/* Horários (opcionais: exibidos apenas se existirem no objeto) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {temHorarioInicio && (
                <div>
                  <label htmlFor="horario_inicio" className="block font-semibold mb-1">Horário de Início</label>
                  <input
                    id="horario_inicio"
                    type="time"
                    name="horario_inicio"
                    value={turma?.horario_inicio || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.horario_inicio}
                    aria-describedby={errors.horario_inicio ? "erro-hi" : undefined}
                    className={[
                      "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                      errors.horario_inicio ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                    ].join(" ")}
                  />
                  {errors.horario_inicio && (
                    <p id="erro-hi" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.horario_inicio}</p>
                  )}
                </div>
              )}

              {temHorarioFim && (
                <div>
                  <label htmlFor="horario_fim" className="block font-semibold mb-1">Horário de Fim</label>
                  <input
                    id="horario_fim"
                    type="time"
                    name="horario_fim"
                    value={turma?.horario_fim || ""}
                    onChange={handleChange}
                    aria-invalid={!!errors.horario_fim}
                    aria-describedby={errors.horario_fim ? "erro-hf" : undefined}
                    className={[
                      "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                      errors.horario_fim ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                    ].join(" ")}
                  />
                  {errors.horario_fim && (
                    <p id="erro-hf" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.horario_fim}</p>
                  )}
                </div>
              )}
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

              {houveMudancas && (
                <BotaoSecundario onClick={descartarAlteracoes} variant="outline">
                  Descartar
                </BotaoSecundario>
              )}
            </div>
          </fieldset>
        </form>
      </motion.div>
    </main>
  );
}
