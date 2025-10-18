// 📁 src/components/EditarCertificado.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CabecalhoPainel from "../components/CabecalhoPainel";
import { apiGet, apiPut } from "../services/api";

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

export default function EditarCertificado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);
  const liveId = useId();

  const [certificado, setCertificado] = useState(null);
  const [erroGeral, setErroGeral] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [errors, setErrors] = useState({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/certificados/${id}`);
      setCertificado(data || {});
    } catch {
      setErroGeral("Erro ao carregar dados do certificado.");
      setCertificado(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setCertificado((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // limpa erro do campo editado
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  function validar(form) {
    const msgs = {};
    if (!form.gerado_em) msgs.gerado_em = "Informe a data de emissão.";
    const ch = Number(form.carga_horaria);
    if (!Number.isFinite(ch) || ch < 0) msgs.carga_horaria = "Carga horária deve ser um número ≥ 0.";
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

      setSalvando(true);
      setErroGeral("");

      try {
        await apiPut(`/api/certificados/${id}`, certificado);
        toast.success("✅ Certificado atualizado com sucesso!");
        navigate("/administrador", { replace: true });
      } catch (err) {
        toast.error("❌ Erro ao atualizar certificado.");
        setErroGeral("Erro ao atualizar certificado.");
      } finally {
        setSalvando(false);
      }
    },
    [salvando, certificado, id, navigate]
  );

  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Certificado" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!certificado && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Certificado" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)}>← Voltar</BotaoSecundario>
        </div>
      </main>
    );
  }

  // Deriva valores seguros
  const geradoEm = toLocalYMD(certificado?.gerado_em);
  const cargaHoraria = certificado?.carga_horaria ?? "";

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel tituloOverride="Editar Certificado" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg"
        role="region"
        aria-labelledby="editar-certificado-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h1 id="editar-certificado-titulo" className="text-2xl font-bold text-green-900 dark:text-green-200 mb-4">
          ✏️ Editar Certificado
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Seja bem-vindo(a), <strong>{nomeUsuario || "usuário(a)"}</strong>.
        </p>

        {/* Erro geral (não bloqueia campos) */}
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
                  errors.gerado_em
                    ? "border-red-400 dark:border-red-500"
                    : "border-gray-300 dark:border-zinc-600",
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
                value={cargaHoraria}
                onChange={handleChange}
                required
                aria-invalid={!!errors.carga_horaria}
                aria-describedby={errors.carga_horaria ? "erro-carga_horaria" : undefined}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.carga_horaria
                    ? "border-red-400 dark:border-red-500"
                    : "border-gray-300 dark:border-zinc-600",
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

            {/* Emitido */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="emitido"
                id="emitido"
                checked={!!certificado?.emitido}
                onChange={handleChange}
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
            </div>
          </fieldset>
        </form>
      </motion.div>
    </main>
  );
}
