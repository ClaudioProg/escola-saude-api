// 📁 src/components/EditarCertificado.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CabecalhoPainel from "../components/CabecalhoPainel";
import { apiGet, apiPut } from "../services/api";

/* =========================== Helpers (anti-UTC) =========================== */
function toLocalYMD(v) {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayYMD() {
  const d = new Date();
  return toLocalYMD(d);
}
function isChanged(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}
function parseNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ================================ Componente ================================ */
export default function EditarCertificado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();
  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  const [certificado, setCertificado] = useState(null);
  const [original, setOriginal] = useState(null);
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [errors, setErrors] = useState({});

  /* ============================== Carregar dados ============================== */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/certificados/${id}`);
      const normalizado = {
        ...data,
        gerado_em: toLocalYMD(data?.gerado_em),
        carga_horaria: data?.carga_horaria ?? "",
        emitido: !!data?.emitido,
      };
      setCertificado(normalizado);
      setOriginal(normalizado);
    } catch {
      setErroGeral("Erro ao carregar dados do certificado.");
      setCertificado(null);
      setOriginal(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /* ============================== Form handlers ============================== */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;

    // Normalizações pontuais
    let next = value;
    if (type === "checkbox") next = checked;
    if (name === "carga_horaria") {
      // não bloquear digitação, só guarda string e valida depois
      next = value;
    }
    if (name === "gerado_em") {
      // Date input já entrega YYYY-MM-DD (mantém “date-only”)
      next = value;
    }

    setCertificado((prev) => ({ ...prev, [name]: next }));
    setErrors((prev) => ({ ...prev, [name]: "" })); // limpa erro do campo editado
  }, []);

  // Evita alterar number com scroll
  const avoidWheelChange = (e) => e?.target?.blur?.();

  function validar(form) {
    const msgs = {};
    if (!form.gerado_em) msgs.gerado_em = "Informe a data de emissão.";
    const ch = parseNumberOrNull(form.carga_horaria);
    if (ch == null || ch < 0) msgs.carga_horaria = "Carga horária deve ser um número ≥ 0.";
    return msgs;
  }

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (salvando || !certificado) return;

      const msgs = validar(certificado);
      setErrors(msgs);
      if (Object.keys(msgs).length) {
        toast.warn("⚠️ Corrija os campos destacados.");
        return;
      }

      // Se nada mudou, evita PUT desnecessário
      if (original && !isChanged(certificado, original)) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

      setSalvando(true);
      setErroGeral("");

      try {
        // Monta payload respeitando “date-only”
        const payload = {
          ...certificado,
          gerado_em: certificado.gerado_em || null, // "YYYY-MM-DD" ou null
          carga_horaria: parseNumberOrNull(certificado.carga_horaria),
          emitido: !!certificado.emitido,
        };

        await apiPut(`/api/certificados/${id}`, payload);
        toast.success("✅ Certificado atualizado com sucesso!");

        // Atualiza original para refletir o estado salvo
        setOriginal(payload);
        navigate("/administrador", { replace: true });
      } catch {
        toast.error("❌ Erro ao atualizar certificado.");
        setErroGeral("Erro ao atualizar certificado.");
      } finally {
        setSalvando(false);
      }
    },
    [salvando, certificado, id, navigate, original]
  );

  /* =============================== UI States =============================== */
  const geradoEm = toLocalYMD(certificado?.gerado_em);
  const cargaHoraria = certificado?.carga_horaria ?? "";

  const tipo = (certificado?.tipo || "").toLowerCase(); // "usuario" | "instrutor"
  const tipoValido = tipo === "usuario" || tipo === "instrutor" ? tipo : null;

  const arquivoPdf = certificado?.arquivo_pdf || certificado?.arquivo || null; // compat

  /* ============================== Marcar Emitido ============================== */
  const toggleEmitido = () => {
    setCertificado((prev) => {
      const nextEmitido = !prev?.emitido;
      const nextGerado = prev?.gerado_em || (nextEmitido ? todayYMD() : "");
      if (nextEmitido && !prev?.gerado_em) {
        // auto-preenche data quando marcar Emitido
        toast.info("Data de emissão definida para hoje.");
      }
      return { ...prev, emitido: nextEmitido, gerado_em: nextGerado };
    });
    setErrors((prev) => ({ ...prev, gerado_em: "" }));
  };

  /* =============================== Render =============================== */
  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Certificado" variantOverride="indigo" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!certificado && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Certificado" variantOverride="indigo" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)}>← Voltar</BotaoSecundario>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel tituloOverride="Editar Certificado" variantOverride="indigo" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
        role="region"
        aria-labelledby="editar-certificado-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h1 id="editar-certificado-titulo" className="text-2xl font-bold text-green-900 dark:text-green-200 mb-2">
          ✏️ Editar Certificado
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Seja bem-vindo(a), <strong>{nomeUsuario || "usuário(a)"}</strong>.
        </p>

        {/* Meta/topo: id, tipo, turma e botão de download quando houver PDF */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700">
            ID: {certificado?.id ?? "—"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full border
                           bg-emerald-50 text-emerald-700 border-emerald-200
                           dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800">
            Tipo: {tipoValido || "—"}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-200 dark:border-indigo-800">
            Turma: {certificado?.turma_id ?? "—"}
          </span>

          {arquivoPdf ? (
            <a
              href={arquivoPdf}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold
                         bg-green-900 text-white hover:bg-green-900/90"
              title="Abrir/baixar PDF do certificado"
            >
              ⬇️ Baixar PDF
            </a>
          ) : null}
        </div>

        {/* Erro geral */}
        {erroGeral && (
          <p id={`${liveId}-status`} className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erroGeral}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <fieldset disabled={salvando} aria-busy={salvando} className="space-y-4">
            {/* Nome do usuário */}
            <div>
              <label className="block font-semibold mb-1">Nome do usuário</label>
              <input
                type="text"
                value={certificado?.nome || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            {/* Evento */}
            <div>
              <label className="block font-semibold mb-1">Evento</label>
              <input
                type="text"
                value={certificado?.evento || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            {/* Data de Emissão */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="gerado_em">
                Data de Emissão
              </label>
              <input
                id="gerado_em"
                type="date"
                name="gerado_em"
                value={geradoEm}
                onChange={handleChange}
                required
                aria-invalid={!!errors.gerado_em}
                aria-describedby={errors.gerado_em ? "erro-gerado_em" : undefined}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.gerado_em ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.gerado_em && (
                <p id="erro-gerado_em" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.gerado_em}
                </p>
              )}
            </div>

            {/* Carga Horária */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="carga_horaria">
                Carga Horária
              </label>
              <input
                id="carga_horaria"
                type="number"
                name="carga_horaria"
                min="0"
                step="0.5"
                inputMode="decimal"
                onWheel={avoidWheelChange}
                value={cargaHoraria}
                onChange={handleChange}
                required
                aria-invalid={!!errors.carga_horaria}
                aria-describedby={errors.carga_horaria ? "erro-carga_horaria" : undefined}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.carga_horaria ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                ].join(" ")}
              />
              {errors.carga_horaria && (
                <p id="erro-carga_horaria" className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {errors.carga_horaria}
                </p>
              )}
            </div>

            {/* Código */}
            <div>
              <label className="block font-semibold mb-1">Código do Certificado</label>
              <input
                type="text"
                value={certificado?.codigo || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            {/* Link de validação */}
            <div>
              <label className="block font-semibold mb-1">Link de Validação</label>
              <input
                type="text"
                value={certificado?.link_validacao || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            {/* Emitido (auto-ajusta data quando ligar) */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emitido"
                id="emitido"
                checked={!!certificado?.emitido}
                onChange={toggleEmitido}
                className="h-4 w-4 accent-green-700"
              />
              <label htmlFor="emitido" className="text-sm">
                Certificado Emitido
              </label>
            </div>

            {/* Ações */}
            <div className="pt-2 flex items-center gap-2">
              <BotaoPrimario type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>

              <BotaoSecundario onClick={() => navigate(-1)} variant="outline">
                Cancelar
              </BotaoSecundario>

              {/* Botão “Descartar alterações” se houver dif */}
              {original && certificado && isChanged(certificado, original) && (
                <BotaoSecundario
                  onClick={() => {
                    setCertificado(original);
                    setErrors({});
                    toast.info("Alterações descartadas.");
                  }}
                  variant="outline"
                >
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
