/* eslint-disable no-console */
// ✅ frontend/src/components/usuarios/EditarUsuario.jsx — v2.0
// Plataforma Escola da Saúde
// Edição administrativa de usuário com contrato único, perfil string, sem aliases e UX premium.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  IdCard,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

import Footer from "../layout/Footer";
import ThemeTogglePills from "../layout/ThemeTogglePills";

import useEscolaTheme from "../../hooks/useEscolaTheme";
import {
  apiUsuarioAtualizarBasico,
  apiUsuarioAtualizarPerfil,
  apiUsuarioObter,
} from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Contrato oficial
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = ["usuario", "organizador", "administrador"];

const PERFIL_LABEL = {
  usuario: "Usuário",
  organizador: "organizador",
  administrador: "Administrador",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function unwrap(response) {
  return response?.data ?? response;
}

function perfilOficial(value) {
  const perfil = String(value || "").trim();

  return PERFIS_OFICIAIS.includes(perfil) ? perfil : "";
}

function normText(value) {
  return String(value || "").trim();
}

function normEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validarEmail(value) {
  return EMAIL_RE.test(normEmail(value));
}

function aplicarMascaraCPF(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) return String(value || "");

  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

function maskCpf(value, revealed = false) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) return "—";

  if (revealed) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }

  return digits.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
}

function montarSnapshot(usuario = {}) {
  return {
    nome: normText(usuario.nome),
    email: normEmail(usuario.email),
    perfil: perfilOficial(usuario.perfil),
  };
}

function getFieldErrors(error) {
  const data = error?.response?.data || error?.data || {};

  return data?.fieldErrors || data?.fields || {};
}

function getErrorMessage(error, fallback) {
  const data = error?.response?.data || error?.data || {};

  return data?.message || data?.erro || error?.message || fallback;
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SpinnerLocal() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
      aria-hidden="true"
    />
  );
}

function BotaoLocal({
  children,
  variant = "primary",
  className = "",
  leftIcon = null,
  loading = false,
  disabled = false,
  type = "button",
  ...props
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 focus-visible:ring-emerald-500/70",
    secondary:
      "border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-white/5",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500/60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50",
    light:
      "border border-white/20 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70",
  };

  return (
    <button
      type={type}
      className={cx(base, variants[variant] || variants.primary, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <SpinnerLocal /> : leftIcon}
      {children}
    </button>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;

  return (
    <p id={id} className="mt-1 text-xs text-rose-600 dark:text-rose-300" role="alert">
      {children}
    </p>
  );
}

function FieldHint({ id, children, isDark }) {
  if (!children) return null;

  return (
    <p
      id={id}
      className={cx("mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500")}
    >
      {children}
    </p>
  );
}

function HeaderHero({ isDark, onRefresh, carregando, salvando, dirty }) {
  return (
    <header className="relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-950" />
      {isDark ? <div className="absolute inset-0 bg-black/35" /> : null}

      <div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-12">
        <div className="flex justify-end gap-2 lg:absolute lg:right-4 lg:top-6">
          <BotaoLocal
            variant="light"
            onClick={onRefresh}
            disabled={carregando || salvando}
            loading={carregando}
            className="hidden min-h-[38px] px-3 py-2 text-xs sm:inline-flex"
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </BotaoLocal>

          <ThemeTogglePills variant="glass" />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/90">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Administração • usuários • perfil de acesso</span>
          </div>

          <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            <User className="h-6 w-6" aria-hidden="true" />
            Editar Usuário
          </h1>

          <p className="max-w-2xl text-sm text-white/90">
            Atualize dados básicos e perfil de acesso com segurança e contrato
            único.
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              Perfil único
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              Sem aliases
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              {dirty ? "Há alterações" : "Sem alterações"}
            </span>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/20"
        aria-hidden="true"
      />
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página/componente
────────────────────────────────────────────────────────────── */

export default function EditarUsuario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useEscolaTheme();

  const [usuario, setUsuario] = useState(null);
  const [original, setOriginal] = useState(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState("");
  const [cpf, setCpf] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});
  const [liveMsg, setLiveMsg] = useState("");
  const [cpfRevelado, setCpfRevelado] = useState(false);

  const rNome = useRef(null);
  const rEmail = useRef(null);
  const rPerfil = useRef(null);
  const erroRef = useRef(null);

  const usuarioId = useMemo(() => {
    const number = Number(id);

    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }, [id]);

  const snapshotAtual = useMemo(
    () => ({
      nome: normText(nome),
      email: normEmail(email),
      perfil: perfilOficial(perfil),
    }),
    [email, nome, perfil]
  );

  const snapshotOriginal = useMemo(() => montarSnapshot(original || {}), [original]);

  const dirty = useMemo(() => {
    if (!original) return false;

    return Object.keys(snapshotAtual).some(
      (key) => String(snapshotAtual[key] || "") !== String(snapshotOriginal[key] || "")
    );
  }, [original, snapshotAtual, snapshotOriginal]);

  const inputCls = useCallback(
    (hasError) =>
      cx(
        "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
        "focus:ring-2 focus:ring-emerald-500/70",
        isDark
          ? "border-white/10 bg-zinc-950/30 text-zinc-100 placeholder:text-zinc-500"
          : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400",
        hasError ? "border-red-500/60 ring-2 ring-red-500/60" : ""
      ),
    [isDark]
  );

  const selectCls = useCallback(
    (hasError) => cx(inputCls(hasError), "appearance-none"),
    [inputCls]
  );

  const readonlyCls = cx(
    "w-full rounded-2xl border px-4 py-3 text-sm",
    isDark
      ? "border-white/10 bg-zinc-950/30 text-zinc-400"
      : "border-slate-200 bg-slate-100 text-slate-600"
  );

  function announce(message) {
    setLiveMsg("");
    window.requestAnimationFrame(() => setLiveMsg(message));
  }

  function focarPrimeiroErro(fields = {}) {
    const ordem = [
      ["nome", rNome],
      ["email", rEmail],
      ["perfil", rPerfil],
    ];

    const item = ordem.find(([field]) => fields[field]);

    if (item?.[1]?.current) {
      item[1].current.scrollIntoView({ behavior: "smooth", block: "center" });
      item[1].current.focus();
    }
  }

  function preencherFormulario(data) {
    const usuarioData = data || {};
    const perfilSeguro = perfilOficial(usuarioData.perfil);

    setUsuario(usuarioData);
    setOriginal({
      nome: usuarioData.nome || "",
      email: usuarioData.email || "",
      perfil: perfilSeguro,
    });

    setNome(usuarioData.nome || "");
    setEmail(usuarioData.email || "");
    setPerfil(perfilSeguro);
    setCpf(usuarioData.cpf || "");
  }

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setErroGeral("ID de usuário inválido.");
      setUsuario(null);
      setOriginal(null);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErroGeral("");
    setErrors({});
    announce("Carregando dados do usuário.");

    try {
      const response = await apiUsuarioObter(usuarioId);
      const data = unwrap(response);

      if (!data?.id) {
        throw new Error("Usuário não encontrado.");
      }

      preencherFormulario(data);
      announce("Dados do usuário carregados.");
    } catch (error) {
      console.error("[EditarUsuario] erro ao carregar usuário", {
        usuarioId,
        message: error?.message,
      });

      const message = getErrorMessage(
        error,
        "Erro ao carregar dados do usuário."
      );

      setErroGeral(message);
      setUsuario(null);
      setOriginal(null);
      announce("Erro ao carregar usuário.");

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      setCarregando(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    document.title = "Editar Usuário — Escola da Saúde";
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function validarFormulario() {
    const fields = {};

    if (!snapshotAtual.nome) {
      fields.nome = "Informe o nome.";
    }

    if (!snapshotAtual.email) {
      fields.email = "Informe o e-mail.";
    } else if (!validarEmail(snapshotAtual.email)) {
      fields.email = "E-mail inválido.";
    }

    if (!snapshotAtual.perfil) {
      fields.perfil = "Selecione um perfil oficial.";
    }

    return fields;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!usuario?.id || salvando) return;

    setErrors({});
    setErroGeral("");

    const fields = validarFormulario();

    if (Object.keys(fields).length) {
      setErrors(fields);
      focarPrimeiroErro(fields);
      toast.warn("Corrija os campos destacados.");
      return;
    }

    if (!dirty) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    const changedBasic =
      snapshotAtual.nome !== snapshotOriginal.nome ||
      snapshotAtual.email !== snapshotOriginal.email;

    const changedPerfil = snapshotAtual.perfil !== snapshotOriginal.perfil;

    try {
      setSalvando(true);
      announce("Salvando alterações do usuário.");

      if (changedBasic) {
        await apiUsuarioAtualizarBasico(usuario.id, {
          nome: snapshotAtual.nome,
          email: snapshotAtual.email,
        });
      }

      if (changedPerfil) {
        await apiUsuarioAtualizarPerfil(usuario.id, {
          perfil: snapshotAtual.perfil,
        });
      }

      toast.success("Usuário atualizado com sucesso.");
      await carregar();
    } catch (error) {
      console.error("[EditarUsuario] erro ao salvar usuário", {
        usuarioId: usuario?.id,
        message: error?.message,
      });

      const fieldsServidor = getFieldErrors(error);
      const message = getErrorMessage(
        error,
        "Erro ao atualizar usuário. Verifique os dados e tente novamente."
      );

      if (Object.keys(fieldsServidor).length) {
        setErrors(fieldsServidor);
        focarPrimeiroErro(fieldsServidor);
      }

      setErroGeral(message);
      toast.error(message);
      announce("Erro ao salvar usuário.");

      window.setTimeout(() => erroRef.current?.focus?.(), 0);
    } finally {
      setSalvando(false);
    }
  }

  function descartarAlteracao() {
    if (!original) return;

    setNome(original.nome || "");
    setEmail(original.email || "");
    setPerfil(perfilOficial(original.perfil));
    setErrors({});
    setErroGeral("");

    announce("Alterações descartadas.");
    toast.info("Alterações descartadas.");
  }

  if (carregando && !usuario) {
    return (
      <main
        className={cx(
          "flex min-h-screen flex-col",
          isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
        )}
      >
        <HeaderHero
          isDark={isDark}
          onRefresh={carregar}
          carregando
          salvando={false}
          dirty={false}
        />

        <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <div
            className={cx(
              "rounded-3xl border p-6 text-center shadow-sm md:p-8",
              isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white"
            )}
          >
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <SpinnerLocal />
              Carregando dados do usuário...
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  if (!usuario && erroGeral) {
    return (
      <main
        className={cx(
          "flex min-h-screen flex-col",
          isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
        )}
      >
        <HeaderHero
          isDark={isDark}
          onRefresh={carregar}
          carregando={false}
          salvando={false}
          dirty={false}
        />

        <section className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <div
            ref={erroRef}
            tabIndex={-1}
            className={cx(
              "rounded-3xl border p-6 text-center shadow-sm outline-none md:p-8",
              isDark
                ? "border-rose-900/40 bg-rose-950/25 text-rose-200"
                : "border-rose-200 bg-rose-50 text-rose-800"
            )}
            role="alert"
            aria-live="assertive"
          >
            <AlertTriangle className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
            <p className="text-sm font-semibold">{erroGeral}</p>

            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <BotaoLocal
                variant="secondary"
                onClick={() => navigate(-1)}
                leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
              >
                Voltar
              </BotaoLocal>

              <BotaoLocal
                onClick={carregar}
                leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
              >
                Tentar novamente
              </BotaoLocal>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  return (
    <main
      className={cx(
        "flex min-h-screen flex-col transition-colors",
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMsg}
      </p>

      <HeaderHero
        isDark={isDark}
        onRefresh={carregar}
        carregando={carregando}
        salvando={salvando}
        dirty={dirty}
      />

      <div className="sticky top-0 z-30 border-b border-white/10 backdrop-blur lg:hidden">
        <div className={cx("px-4 py-3", isDark ? "bg-zinc-950/75" : "bg-white/80")}>
          <div className="flex gap-2">
            <BotaoLocal
              variant="secondary"
              onClick={() => navigate(-1)}
              disabled={salvando}
              className="flex-1"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              Voltar
            </BotaoLocal>

            <BotaoLocal
              onClick={handleSubmit}
              disabled={salvando || !dirty}
              loading={salvando}
              className="flex-1"
              leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
            >
              {salvando ? "Salvando..." : dirty ? "Salvar" : "Sem alterações"}
            </BotaoLocal>
          </div>
        </div>
      </div>

      <section id="conteudo" className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 md:py-12">
          {erroGeral ? (
            <div
              ref={erroRef}
              tabIndex={-1}
              className={cx(
                "rounded-2xl border px-4 py-3 text-sm outline-none",
                isDark
                  ? "border-rose-900/40 bg-rose-950/25 text-rose-200"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              )}
              role="alert"
              aria-live="assertive"
            >
              <div className="flex gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>{erroGeral}</p>
              </div>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className={cx(
              "rounded-3xl border p-5 shadow-sm md:p-7",
              isDark ? "border-white/10 bg-zinc-900/50" : "border-slate-200 bg-white"
            )}
            noValidate
            aria-label="Formulário de edição de usuário"
            aria-busy={salvando ? "true" : "false"}
          >
            <div className="mb-5 flex items-start gap-3">
              <div
                className={cx(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                  isDark
                    ? "border-white/10 bg-white/5 text-emerald-300"
                    : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-lg font-extrabold">Dados do usuário</h2>
                <p
                  className={cx(
                    "mt-0.5 text-sm",
                    isDark ? "text-zinc-400" : "text-slate-500"
                  )}
                >
                  Edite somente campos administrativos confirmados no contrato atual.
                </p>
              </div>
            </div>

            <fieldset disabled={salvando} className="space-y-4">
              <div>
                <label htmlFor="nome" className="block text-sm font-semibold">
                  Nome <span className="text-rose-600">*</span>
                </label>

                <div className="relative mt-1">
                  <User
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      isDark ? "text-zinc-400" : "text-slate-500"
                    )}
                    aria-hidden="true"
                  />

                  <input
                    id="nome"
                    ref={rNome}
                    type="text"
                    value={nome}
                    onChange={(event) => {
                      setNome(event.target.value);
                      setErrors((old) => ({ ...old, nome: "" }));
                    }}
                    className={cx(inputCls(!!errors.nome), "pl-10")}
                    required
                    aria-required="true"
                    aria-invalid={!!errors.nome}
                    aria-describedby={errors.nome ? "erro-nome" : undefined}
                    autoComplete="name"
                    placeholder="Nome completo"
                  />
                </div>

                <FieldError id="erro-nome">{errors.nome}</FieldError>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold">
                  E-mail <span className="text-rose-600">*</span>
                </label>

                <div className="relative mt-1">
                  <Mail
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      isDark ? "text-zinc-400" : "text-slate-500"
                    )}
                    aria-hidden="true"
                  />

                  <input
                    id="email"
                    ref={rEmail}
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrors((old) => ({ ...old, email: "" }));
                    }}
                    className={cx(inputCls(!!errors.email), "pl-10")}
                    required
                    aria-required="true"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "erro-email" : "dica-email"}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="nome.sobrenome@dominio.gov.br"
                  />
                </div>

                {errors.email ? (
                  <FieldError id="erro-email">{errors.email}</FieldError>
                ) : (
                  <FieldHint id="dica-email" isDark={isDark}>
                    O e-mail deve ser único na plataforma.
                  </FieldHint>
                )}
              </div>

              <div>
                <label htmlFor="cpf" className="block text-sm font-semibold">
                  CPF
                </label>

                <div className="relative mt-1">
                  <IdCard
                    className={cx(
                      "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2",
                      isDark ? "text-zinc-400" : "text-slate-500"
                    )}
                    aria-hidden="true"
                  />

                  <input
                    id="cpf"
                    type="text"
                    value={cpfRevelado ? aplicarMascaraCPF(cpf) : maskCpf(cpf)}
                    readOnly
                    aria-readonly="true"
                    className={cx(readonlyCls, "pl-10")}
                  />
                </div>

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <FieldHint id="dica-cpf" isDark={isDark}>
                    Somente leitura. Revele apenas quando houver necessidade
                    administrativa real.
                  </FieldHint>

                  <button
                    type="button"
                    onClick={() => setCpfRevelado((value) => !value)}
                    className={cx(
                      "rounded-xl px-2 py-1 text-[11px] font-bold underline-offset-2 hover:underline",
                      isDark ? "text-emerald-300" : "text-emerald-700"
                    )}
                  >
                    {cpfRevelado ? "Ocultar CPF" : "Revelar CPF"}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="perfil" className="block text-sm font-semibold">
                  Perfil <span className="text-rose-600">*</span>
                </label>

                <select
                  id="perfil"
                  ref={rPerfil}
                  value={perfil}
                  onChange={(event) => {
                    setPerfil(event.target.value);
                    setErrors((old) => ({ ...old, perfil: "" }));
                  }}
                  className={selectCls(!!errors.perfil)}
                  aria-invalid={!!errors.perfil}
                  aria-describedby={errors.perfil ? "erro-perfil" : "dica-perfil"}
                >
                  <option value="">Selecione…</option>
                  {PERFIS_OFICIAIS.map((item) => (
                    <option key={item} value={item}>
                      {PERFIL_LABEL[item]}
                    </option>
                  ))}
                </select>

                {errors.perfil ? (
                  <FieldError id="erro-perfil">{errors.perfil}</FieldError>
                ) : (
                  <FieldHint id="dica-perfil" isDark={isDark}>
                    Contrato oficial: um único perfil por usuário.
                  </FieldHint>
                )}
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
                <div className="flex gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    A alteração de perfil impacta permissões de acesso. Confirme
                    antes de salvar. A desativação de usuário não foi incluída
                    neste arquivo porque ainda não há contrato oficial revisado
                    para esse fluxo.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <BotaoLocal
                  type="submit"
                  disabled={salvando || !dirty}
                  loading={salvando}
                  className="w-full"
                  leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
                >
                  {salvando ? "Salvando..." : dirty ? "Salvar alterações" : "Sem alterações"}
                </BotaoLocal>

                <BotaoLocal
                  variant="secondary"
                  onClick={() => navigate(-1)}
                  disabled={salvando}
                  className="w-full"
                  leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                >
                  Voltar
                </BotaoLocal>

                {dirty ? (
                  <BotaoLocal
                    variant="danger"
                    onClick={descartarAlteracao}
                    disabled={salvando}
                    className="w-full"
                  >
                    Descartar
                  </BotaoLocal>
                ) : null}
              </div>

              {dirty ? (
                <div className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Há alterações não salvas.</span>
                </div>
              ) : null}
            </fieldset>
          </form>
        </div>
      </section>

      <Footer />
    </main>
  );
}