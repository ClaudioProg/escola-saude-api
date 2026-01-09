// 📁 src/components/EditarInstrutor.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { apiGet, apiPut } from "../services/api";

/* ============================ Helpers ============================ */
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const isChanged = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

export default function EditarInstrutor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const [instrutor, setInstrutor] = useState(null);
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
      const data = await apiGet(`/api/usuarios/${id}`);
      const normalizado = {
        ...data,
        email: String(data?.email || "").trim(),
      };
      setInstrutor(normalizado || {});
      setOriginal(normalizado || {});
    } catch {
      setInstrutor(null);
      setOriginal(null);
      setErroGeral("Erro ao carregar dados do instrutor.");
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
    const { name, value, type, checked } = e.target;

    setInstrutor((prev) => {
      let v = value;
      if (name === "email") v = String(value).trim();
      if (type === "checkbox") v = !!checked;

      return { ...prev, [name]: v };
    });

    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  function validar(form) {
    const msgs = {};
    if (!form?.nome?.trim()) msgs.nome = "Informe o nome completo.";

    if (!form?.email?.trim()) {
      msgs.email = "Informe o e-mail.";
    } else if (!emailOk(form.email)) {
      msgs.email = "E-mail inválido.";
    }

    // Se aparecer telefone_celular no payload, validação simples (opcional)
    if ("telefone_celular" in (form || {})) {
      const fone = String(form.telefone_celular || "").trim();
      if (fone && fone.replace(/\D/g, "").length < 10) {
        msgs.telefone_celular = "Telefone incompleto (mín. DDD + número).";
      }
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
      // Monta payload preservando apenas campos exibidos/editados
      const payload = {
        nome: instrutor.nome?.trim(),
        email: instrutor.email?.trim().toLowerCase(),
      };

      // Inclui opcionais somente se existem no objeto (evita quebrar API)
      if ("telefone_celular" in instrutor)
        payload.telefone_celular = String(instrutor.telefone_celular || "").trim();
      if ("cargo_funcao" in instrutor)
        payload.cargo_funcao = String(instrutor.cargo_funcao || "").trim();
      if ("ativo" in instrutor)
        payload.ativo = !!instrutor.ativo;

      // Sem alterações?
      if (original && !isChanged(payload, {
        nome: original.nome?.trim(),
        email: original.email?.trim().toLowerCase(),
        ...( "telefone_celular" in original ? { telefone_celular: String(original.telefone_celular || "").trim() } : {} ),
        ...( "cargo_funcao" in original ? { cargo_funcao: String(original.cargo_funcao || "").trim() } : {} ),
        ...( "ativo" in original ? { ativo: !!original.ativo } : {} ),
      })) {
        toast.info("Nenhuma alteração para salvar.");
        setSalvando(false);
        return;
      }

      await apiPut(`/api/usuarios/${id}`, payload);
      toast.success("✅ Instrutor atualizado com sucesso!");
      navigate("/administrador", { replace: true });
    } catch {
      setErroGeral("Erro ao salvar alterações.");
      toast.error("❌ Erro ao atualizar instrutor.");
    } finally {
      setSalvando(false);
    }
  }, [instrutor, salvando, id, navigate, original]);

  /* ============================ UI states ============================ */
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

  const temTelefone = "telefone_celular" in (instrutor || {});
  const temCargo = "cargo_funcao" in (instrutor || {});
  const temAtivo = "ativo" in (instrutor || {});

  const houveMudancas =
    original &&
    instrutor &&
    isChanged(
      {
        nome: instrutor.nome?.trim(),
        email: instrutor.email?.trim().toLowerCase(),
        ...(temTelefone ? { telefone_celular: String(instrutor.telefone_celular || "").trim() } : {}),
        ...(temCargo ? { cargo_funcao: String(instrutor.cargo_funcao || "").trim() } : {}),
        ...(temAtivo ? { ativo: !!instrutor.ativo } : {}),
      },
      {
        nome: original.nome?.trim(),
        email: original.email?.trim().toLowerCase(),
        ...(temTelefone ? { telefone_celular: String(original.telefone_celular || "").trim() } : {}),
        ...(temCargo ? { cargo_funcao: String(original.cargo_funcao || "").trim() } : {}),
        ...(temAtivo ? { ativo: !!original.ativo } : {}),
      }
    );

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

        {/* aria-live discreto para mensagens de acessibilidade */}
        <p id={`${liveId}-live`} role="status" aria-live="polite" className="sr-only">{liveMsg}</p>

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

            {/* Telefone (opcional, exibido apenas se vier do backend) */}
            {temTelefone && (
              <div>
                <label htmlFor="telefone_celular" className="block font-semibold mb-1">Telefone (celular)</label>
                <input
                  id="telefone_celular"
                  name="telefone_celular"
                  type="tel"
                  value={instrutor?.telefone_celular || ""}
                  onChange={handleChange}
                  aria-invalid={!!errors.telefone_celular}
                  aria-describedby={errors.telefone_celular ? "erro-telefone" : undefined}
                  className={[
                    "w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                    errors.telefone_celular ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
                  ].join(" ")}
                  placeholder="(13) 9XXXX-XXXX"
                  inputMode="tel"
                  pattern="[\d\s()+-]{10,}" // simples e flexível
                />
                {errors.telefone_celular && (
                  <p id="erro-telefone" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.telefone_celular}</p>
                )}
              </div>
            )}

            {/* Cargo/Função (opcional) */}
            {temCargo && (
              <div>
                <label htmlFor="cargo_funcao" className="block font-semibold mb-1">Cargo/Função</label>
                <input
                  id="cargo_funcao"
                  name="cargo_funcao"
                  type="text"
                  value={instrutor?.cargo_funcao || ""}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="Ex.: Enfermeiro, Docente, Coordenador…"
                  autoComplete="organization-title"
                />
              </div>
            )}

            {/* Ativo (opcional) */}
            {temAtivo && (
              <div className="flex items-center gap-2">
                <input
                  id="ativo"
                  name="ativo"
                  type="checkbox"
                  checked={!!instrutor?.ativo}
                  onChange={handleChange}
                  className="h-4 w-4 accent-green-700"
                />
                <label htmlFor="ativo" className="text-sm">Instrutor ativo</label>
              </div>
            )}

            {/* Ações */}
            <div className="pt-2 flex items-center gap-2">
              <BotaoPrimario type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "💾 Salvar Alterações"}
              </BotaoPrimario>

              <BotaoSecundario onClick={() => navigate(-1)} variant="outline">
                Cancelar
              </BotaoSecundario>

              {houveMudancas && (
                <BotaoSecundario
                  onClick={() => {
                    setInstrutor(original);
                    setErrors({});
                    announce("Alterações descartadas.");
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
