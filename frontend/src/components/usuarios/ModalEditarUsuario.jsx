/* eslint-disable no-console */
// ✅ frontend/src/components/usuarios/ModalEditarUsuario.jsx — v2.0
// Plataforma Escola da Saúde
// Modal premium para edição administrativa de dados básicos do usuário.
// Contrato oficial: nome, email e celular via apiUsuarioAtualizarBasico.
// CPF é somente leitura até existir contrato oficial revisado para alteração.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import PropTypes from "prop-types";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  BadgeCheck,
  IdCard,
  Mail,
  Phone,
  Save,
  User,
  X,
} from "lucide-react";

import { apiUsuarioAtualizarBasico } from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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

function mascararCPF(value) {
  const digits = onlyDigits(value);

  if (digits.length !== 11) return "—";

  return digits.replace(/^(\d{3})\d{3}(\d{3})\d{2}$/, "$1.***.$2-**");
}

function aplicarMascaraCelular(value) {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validarCelularOpcional(value) {
  const digits = onlyDigits(value);

  if (!digits) return true;

  return /^\d{10,11}$/.test(digits);
}

function montarSnapshot({ nome, email, celular }) {
  return {
    nome: normText(nome),
    email: normEmail(email),
    celular: onlyDigits(celular),
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

function FieldError({ id, children }) {
  if (!children) return null;

  return (
    <p id={id} className="mt-1 text-xs text-rose-600 dark:text-rose-300" role="alert">
      {children}
    </p>
  );
}

function FieldHint({ id, children }) {
  if (!children) return null;

  return (
    <p id={id} className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
      {children}
    </p>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function ModalEditarUsuario({
  isOpen,
  onClose,
  usuario,
  onAtualizar,
}) {
  const uid = useId();

  const titleId = `modal-editar-usuario-title-${uid}`;
  const descId = `modal-editar-usuario-desc-${uid}`;
  const liveId = `modal-editar-usuario-live-${uid}`;
  const errorId = `modal-editar-usuario-error-${uid}`;

  const dialogRef = useRef(null);
  const refNome = useRef(null);
  const refEmail = useRef(null);
  const refCelular = useRef(null);
  const refSalvar = useRef(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [errors, setErrors] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [msgA11y, setMsgA11y] = useState("");
  const [cpfRevelado, setCpfRevelado] = useState(false);
  const [baseline, setBaseline] = useState(null);

  const cpfOriginal = usuario?.cpf || "";

  useEffect(() => {
    if (!isOpen) return;

    const nomeInicial = usuario?.nome || "";
    const emailInicial = usuario?.email || "";
    const celularInicial = usuario?.celular || "";

    setNome(nomeInicial);
    setEmail(emailInicial);
    setCelular(aplicarMascaraCelular(celularInicial));

    setBaseline(
      montarSnapshot({
        nome: nomeInicial,
        email: emailInicial,
        celular: celularInicial,
      })
    );

    setErrors({});
    setErroGeral("");
    setMsgA11y("");
    setCpfRevelado(false);
    setSalvando(false);
  }, [isOpen, usuario]);

  const snapshotAtual = useMemo(
    () =>
      montarSnapshot({
        nome,
        email,
        celular,
      }),
    [celular, email, nome]
  );

  const dirty = useMemo(() => {
    if (!baseline) return false;

    return Object.keys(snapshotAtual).some(
      (key) => String(snapshotAtual[key] ?? "") !== String(baseline[key] ?? "")
    );
  }, [baseline, snapshotAtual]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActive = document.activeElement;

    const timer = window.setTimeout(() => {
      refNome.current?.focus?.();
    }, 60);

    return () => {
      window.clearTimeout(timer);
      previousActive?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!salvando) onClose?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll(
        [
          "button:not([disabled])",
          "[href]",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "[tabindex]:not([tabindex='-1'])",
        ].join(",")
      );

      const elements = Array.from(focusable || []).filter(
        (element) => !element.hasAttribute("aria-hidden")
      );

      if (!elements.length) return;

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, salvando]);

  function focarPrimeiroErro(fields = {}) {
    const ordem = [
      ["nome", refNome],
      ["email", refEmail],
      ["celular", refCelular],
    ];

    const item = ordem.find(([field]) => fields[field]);

    if (item?.[1]?.current) {
      item[1].current.scrollIntoView({ behavior: "smooth", block: "center" });
      item[1].current.focus();
    }
  }

  function validarFormulario() {
    const fields = {};

    if (!snapshotAtual.nome) {
      fields.nome = "Informe o nome completo.";
    }

    if (!snapshotAtual.email) {
      fields.email = "Informe o e-mail.";
    } else if (!validarEmail(snapshotAtual.email)) {
      fields.email = "Informe um e-mail válido.";
    }

    if (!validarCelularOpcional(celular)) {
      fields.celular = "Celular inválido. Informe DDD + número.";
    }

    return fields;
  }

  const handleSalvar = useCallback(async () => {
    if (!usuario?.id || salvando) return;

    setErrors({});
    setErroGeral("");

    const fields = validarFormulario();

    if (Object.keys(fields).length) {
      setErrors(fields);
      focarPrimeiroErro(fields);
      setMsgA11y("Revise os campos destacados.");
      toast.warn("Revise os campos destacados.");
      return;
    }

    if (!dirty) {
      setMsgA11y("Nenhuma alteração para salvar.");
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    try {
      setSalvando(true);
      setMsgA11y("Salvando alterações do usuário...");

      await apiUsuarioAtualizarBasico(usuario.id, {
        nome: snapshotAtual.nome,
        email: snapshotAtual.email,
        celular: snapshotAtual.celular,
      });

      toast.success("Usuário atualizado com sucesso.");
      setMsgA11y("Usuário atualizado com sucesso.");

      await onAtualizar?.();
      onClose?.();
    } catch (error) {
      console.error("[ModalEditarUsuario] erro ao salvar usuário", {
        usuarioId: usuario?.id,
        message: error?.message,
      });

      const fieldsServidor = getFieldErrors(error);
      const message = getErrorMessage(
        error,
        "Erro ao atualizar o usuário. Verifique os dados e tente novamente."
      );

      if (Object.keys(fieldsServidor).length) {
        setErrors(fieldsServidor);
        focarPrimeiroErro(fieldsServidor);
      }

      setErroGeral(message);
      setMsgA11y(`Erro ao atualizar usuário: ${message}`);
      toast.error(message);

      window.setTimeout(() => refSalvar.current?.focus?.(), 0);
    } finally {
      setSalvando(false);
    }
  }, [dirty, salvando, snapshotAtual, usuario?.id, onAtualizar, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (!salvando) onClose?.();
        }}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          erroGeral ? `${descId} ${errorId}` : descId
        }
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-100"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-teal-900 to-emerald-900 px-5 py-5 text-white sm:px-6">
          <div
            className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-3xl"
            aria-hidden="true"
          />

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="absolute right-3 top-3 rounded-2xl p-2 text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Fechar edição de usuário"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="relative pr-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Dados básicos
            </div>

            <h2 id={titleId} className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Editar usuário
            </h2>

            <p id={descId} className="mt-1 text-sm leading-relaxed text-white/90">
              Atualize nome, e-mail e celular de{" "}
              <strong>{usuario?.nome || "usuário"}</strong>.
            </p>
          </div>
        </header>

        <div id={liveId} aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSalvar();
          }}
          noValidate
          className="overflow-y-auto px-5 py-5 sm:px-6"
          aria-label="Formulário de edição de usuário"
          aria-busy={salvando ? "true" : "false"}
        >
          {erroGeral ? (
            <div
              id={errorId}
              className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200"
              role="alert"
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

          <div className="space-y-4">
            <div>
              <label
                htmlFor={`edt-nome-${uid}`}
                className="block text-sm font-semibold"
              >
                Nome completo <span className="text-rose-600">*</span>
              </label>

              <div className="relative mt-1">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                  aria-hidden="true"
                />

                <input
                  ref={refNome}
                  id={`edt-nome-${uid}`}
                  type="text"
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(event) => {
                    setNome(event.target.value);
                    setErrors((old) => ({ ...old, nome: "" }));
                  }}
                  disabled={salvando}
                  aria-invalid={!!errors.nome}
                  aria-describedby={errors.nome ? `erro-nome-${uid}` : undefined}
                  autoComplete="name"
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 pl-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/70",
                    "bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                    errors.nome
                      ? "border-rose-400 ring-2 ring-rose-500/60"
                      : "border-slate-300"
                  )}
                />
              </div>

              <FieldError id={`erro-nome-${uid}`}>{errors.nome}</FieldError>
            </div>

            <div>
              <label
                htmlFor={`edt-email-${uid}`}
                className="block text-sm font-semibold"
              >
                E-mail <span className="text-rose-600">*</span>
              </label>

              <div className="relative mt-1">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                  aria-hidden="true"
                />

                <input
                  ref={refEmail}
                  id={`edt-email-${uid}`}
                  type="email"
                  placeholder="nome.sobrenome@dominio.gov.br"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((old) => ({ ...old, email: "" }));
                  }}
                  disabled={salvando}
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? `erro-email-${uid}` : `dica-email-${uid}`
                  }
                  autoComplete="email"
                  inputMode="email"
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 pl-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/70",
                    "bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                    errors.email
                      ? "border-rose-400 ring-2 ring-rose-500/60"
                      : "border-slate-300"
                  )}
                />
              </div>

              {errors.email ? (
                <FieldError id={`erro-email-${uid}`}>{errors.email}</FieldError>
              ) : (
                <FieldHint id={`dica-email-${uid}`}>
                  O e-mail deve ser único na plataforma.
                </FieldHint>
              )}
            </div>

            <div>
              <label
                htmlFor={`edt-celular-${uid}`}
                className="block text-sm font-semibold"
              >
                Celular
              </label>

              <div className="relative mt-1">
                <Phone
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                  aria-hidden="true"
                />

                <input
                  ref={refCelular}
                  id={`edt-celular-${uid}`}
                  type="tel"
                  inputMode="numeric"
                  placeholder="(13) 99999-9999"
                  value={celular}
                  onChange={(event) => {
                    setCelular(aplicarMascaraCelular(event.target.value));
                    setErrors((old) => ({ ...old, celular: "" }));
                  }}
                  disabled={salvando}
                  aria-invalid={!!errors.celular}
                  aria-describedby={
                    errors.celular
                      ? `erro-celular-${uid}`
                      : `dica-celular-${uid}`
                  }
                  autoComplete="tel"
                  maxLength={15}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 pl-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500/70",
                    "bg-white text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-zinc-950/30 dark:text-zinc-100 dark:placeholder:text-zinc-500",
                    errors.celular
                      ? "border-rose-400 ring-2 ring-rose-500/60"
                      : "border-slate-300"
                  )}
                />
              </div>

              {errors.celular ? (
                <FieldError id={`erro-celular-${uid}`}>
                  {errors.celular}
                </FieldError>
              ) : (
                <FieldHint id={`dica-celular-${uid}`}>
                  Informe DDD + número. Campo opcional.
                </FieldHint>
              )}
            </div>

            <div>
              <label
                htmlFor={`edt-cpf-${uid}`}
                className="block text-sm font-semibold"
              >
                CPF
              </label>

              <div className="relative mt-1">
                <IdCard
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400"
                  aria-hidden="true"
                />

                <input
                  id={`edt-cpf-${uid}`}
                  type="text"
                  value={cpfRevelado ? aplicarMascaraCPF(cpfOriginal) : mascararCPF(cpfOriginal)}
                  readOnly
                  aria-readonly="true"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 pl-10 text-sm text-slate-600 dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-400"
                />
              </div>

              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <FieldHint id={`dica-cpf-${uid}`}>
                  Somente leitura. Alteração de CPF ainda não possui contrato
                  oficial revisado.
                </FieldHint>

                <button
                  type="button"
                  onClick={() => setCpfRevelado((value) => !value)}
                  disabled={salvando}
                  className="rounded-xl px-2 py-1 text-[11px] font-bold text-emerald-700 underline-offset-2 hover:underline disabled:opacity-60 dark:text-emerald-300"
                >
                  {cpfRevelado ? "Ocultar CPF" : "Revelar CPF"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  Este modal atualiza apenas dados básicos confirmados no
                  contrato atual. Perfil, CPF e dados institucionais pertencem a
                  fluxos próprios.
                </p>
              </div>
            </div>
          </div>
        </form>

        <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/5"
          >
            Cancelar
          </button>

          <button
            ref={refSalvar}
            type="button"
            onClick={handleSalvar}
            disabled={salvando || !dirty}
            className={cx(
              "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60",
              dirty ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-900"
            )}
            aria-busy={salvando ? "true" : "false"}
          >
            {salvando ? (
              <>
                <SpinnerLocal />
                Salvando...
              </>
            ) : dirty ? (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                Salvar alterações
              </>
            ) : (
              "Sem alterações"
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}

ModalEditarUsuario.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    email: PropTypes.string,
    celular: PropTypes.string,
    cpf: PropTypes.string,
  }).isRequired,
  onAtualizar: PropTypes.func,
};