// 📁 src/components/EditarUsuario.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiPut } from "../services/api"; // ✅ serviço centralizado

/* ============================ Helpers ============================ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePerfil(p) {
  if (Array.isArray(p)) return p.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  if (typeof p === "string")
    return p.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return [];
}
const isChanged = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

export default function EditarUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const [usuario, setUsuario] = useState(null);
  const [original, setOriginal] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});
  const [liveMsg, setLiveMsg] = useState("");

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);

  const announce = (msg) => {
    setLiveMsg(msg);
    requestAnimationFrame(() => {
      setLiveMsg("");
      requestAnimationFrame(() => setLiveMsg(msg));
    });
  };

  /* ============================ Load ============================ */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/usuarios/${id}`);
      const perfil = normalizePerfil(data?.perfil);
      const cleaned = {
        ...data,
        perfil,
        email: (data?.email || "").trim(),
      };
      setUsuario(cleaned);
      setOriginal(cleaned);
    } catch {
      setErroGeral("Erro ao carregar dados do usuário.");
      setUsuario(null);
      setOriginal(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /* ============================ Form ============================ */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setUsuario((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "email"
          ? value.trim()
          : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const handlePerfilChange = useCallback((e) => {
    const value = Array.from(e.target.selectedOptions, (o) => o.value);
    setUsuario((prev) => ({ ...prev, perfil: normalizePerfil(value) }));
    setErrors((prev) => ({ ...prev, perfil: "" }));
  }, []);

  function validar(form) {
    const msgs = {};
    if (!form?.nome?.trim()) msgs.nome = "Informe o nome.";
    if (!form?.email?.trim()) msgs.email = "Informe o e-mail.";
    else if (!EMAIL_RE.test(form.email)) msgs.email = "E-mail inválido.";
    if (!Array.isArray(form?.perfil) || form.perfil.length === 0)
      msgs.perfil = "Selecione pelo menos um perfil.";
    return msgs;
  }

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!usuario || salvando) return;

      const msgs = validar(usuario);
      setErrors(msgs);
      if (Object.keys(msgs).length) {
        toast.warn("⚠️ Corrija os campos destacados.");
        return;
      }

      // snapshot para comparar mudanças
      const snapshotAtual = {
        nome: usuario.nome?.trim() || "",
        email: (usuario.email || "").trim().toLowerCase(),
        perfil: normalizePerfil(usuario.perfil),
        ativo: !!usuario.ativo,
      };
      const snapshotOriginal = {
        nome: original?.nome?.trim() || "",
        email: (original?.email || "").trim().toLowerCase(),
        perfil: normalizePerfil(original?.perfil),
        ativo: !!original?.ativo,
      };

      if (!isChanged(snapshotAtual, snapshotOriginal)) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

      setSalvando(true);
      setErroGeral("");
      try {
        await apiPut(`/api/usuarios/${id}`, {
          ...usuario,
          nome: snapshotAtual.nome,
          email: snapshotAtual.email,
          perfil: snapshotAtual.perfil, // mantém array; se necessário, usar .join(',')
          ativo: snapshotAtual.ativo,
        });
        toast.success("✅ Usuário atualizado com sucesso!");
        navigate("/administrador", { replace: true });
      } catch {
        toast.error("❌ Erro ao atualizar usuário.");
        setErroGeral("Erro ao atualizar usuário.");
      } finally {
        setSalvando(false);
      }
    },
    [usuario, salvando, id, navigate, original]
  );

  const descartarAlteracoes = useCallback(() => {
    if (!original) return;
    setUsuario(original);
    setErrors({});
    announce("Alterações descartadas.");
    toast.info("Alterações descartadas.");
  }, [original]);

  /* ============================ UI states ============================ */
  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Usuário" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!usuario && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Usuário" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)} variant="outline">← Voltar</BotaoSecundario>
        </div>
      </main>
    );
  }

  const houveMudancas =
    original &&
    usuario &&
    isChanged(
      {
        nome: usuario?.nome?.trim() || "",
        email: (usuario?.email || "").trim().toLowerCase(),
        perfil: normalizePerfil(usuario?.perfil),
        ativo: !!usuario?.ativo,
      },
      {
        nome: original?.nome?.trim() || "",
        email: (original?.email || "").trim().toLowerCase(),
        perfil: normalizePerfil(original?.perfil),
        ativo: !!original?.ativo,
      }
    );

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel
        tituloOverride="Editar Usuário"
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
        aria-labelledby="editar-usuario-titulo"
        aria-describedby={erroGeral ? `${liveId}-status` : undefined}
      >
        <h1
          id="editar-usuario-titulo"
          className="text-2xl font-bold text-green-900 dark:text-green-200 mb-6 text-center"
        >
          ✏️ Editar Usuário
        </h1>

        {/* aria-live discreto para mensagens de acessibilidade (descartar, etc.) */}
        <p id={`${liveId}-live`} role="status" aria-live="polite" className="sr-only">{liveMsg}</p>

        {erroGeral && (
          <p id={`${liveId}-status`} className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
            {erroGeral}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label="Formulário de edição de usuário">
          <fieldset disabled={salvando} aria-busy={salvando}>
            {/* Nome */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                type="text"
                value={usuario?.nome || ""}
                onChange={handleChange}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.nome ? "border border-red-400 dark:border-red-500" : "border border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                required
                aria-required="true"
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "erro-nome" : undefined}
                autoComplete="name"
                placeholder="Digite o nome completo"
              />
              {errors.nome && (
                <p id="erro-nome" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nome}</p>
              )}
            </div>

            {/* E-mail */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={usuario?.email || ""}
                onChange={handleChange}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.email ? "border border-red-400 dark:border-red-500" : "border border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                required
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "erro-email" : undefined}
                autoComplete="email"
                inputMode="email"
                placeholder="nome.sobrenome@dominio.gov.br"
              />
              {errors.email && (
                <p id="erro-email" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
              )}
            </div>

            {/* CPF (somente leitura) */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="cpf">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                value={usuario?.cpf || ""}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-zinc-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-zinc-600"
              />
            </div>

            {/* Perfil (múltipla seleção) */}
            <div>
              <label className="block font-semibold mb-1" htmlFor="perfil">
                Perfil
              </label>
              <select
                id="perfil"
                multiple
                name="perfil"
                value={usuario?.perfil || []}
                onChange={handlePerfilChange}
                className={[
                  "w-full px-3 py-2 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-600",
                  errors.perfil ? "border border-red-400 dark:border-red-500" : "border border-gray-300 dark:border-zinc-600",
                ].join(" ")}
                aria-describedby={errors.perfil ? "erro-perfil perfil-hint" : "perfil-hint"}
              >
                <option value="administrador">administrador</option>
                <option value="instrutor">instrutor</option>
                <option value="usuario">usuario</option>
              </select>
              <p id="perfil-hint" className="text-xs text-gray-500 mt-1">
                Segure Ctrl (ou Cmd) para selecionar mais de um.
              </p>
              {errors.perfil && (
                <p id="erro-perfil" className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.perfil}</p>
              )}
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2">
              <input
                id="ativo"
                type="checkbox"
                name="ativo"
                checked={!!usuario?.ativo}
                onChange={handleChange}
                className="h-4 w-4 accent-green-700"
              />
              <label htmlFor="ativo" className="text-sm">Usuário ativo</label>
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
