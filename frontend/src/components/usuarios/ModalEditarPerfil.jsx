/* eslint-disable no-console */
// ✅ frontend/src/components/usuarios/ModalEditarPerfil.jsx — v2.0
// Plataforma Escola da Saúde
// Modal premium para alteração administrativa de perfil, com contrato único e sem aliases.

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Contrato oficial
────────────────────────────────────────────────────────────── */

const PERFIS_OFICIAIS = [
  {
    label: "Usuário",
    value: "usuario",
    description: "Acesso padrão aos recursos disponíveis para participantes.",
  },
  {
    label: "organizador",
    value: "organizador",
    description: "Acesso a recursos vinculados à atuação como organizador.",
  },
  {
    label: "Administrador",
    value: "administrador",
    description: "Acesso administrativo aos módulos de gestão.",
  },
];

const PERFIS_VALIDOS = new Set(PERFIS_OFICIAIS.map((perfil) => perfil.value));

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function perfilOficial(value) {
  const perfil = String(value || "").trim();

  return PERFIS_VALIDOS.has(perfil) ? perfil : "";
}

function labelPerfil(value) {
  return PERFIS_OFICIAIS.find((perfil) => perfil.value === value)?.label || "—";
}

function iconByPerfil(value) {
  if (value === "administrador") return ShieldCheck;
  if (value === "organizador") return GraduationCap;
  return Users;
}

function getErrorMessage(error) {
  const data = error?.response?.data || error?.data || {};

  return (
    data?.message ||
    data?.erro ||
    error?.message ||
    "Não foi possível atualizar o perfil."
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function ModalEditarPerfil({
  isOpen = false,
  usuario,
  onFechar,
  onSalvar,
}) {
  const uid = useId();

  const titleId = `modal-editar-perfil-title-${uid}`;
  const descId = `modal-editar-perfil-desc-${uid}`;
  const helpId = `modal-editar-perfil-help-${uid}`;
  const liveId = `modal-editar-perfil-live-${uid}`;
  const errorId = `modal-editar-perfil-error-${uid}`;

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const saveButtonRef = useRef(null);
  const chipRefs = useRef([]);

  const perfilInicial = useMemo(
    () => perfilOficial(usuario?.perfil),
    [usuario?.perfil]
  );

  const [perfilSelecionado, setPerfilSelecionado] = useState(perfilInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [msgA11y, setMsgA11y] = useState("");

  const mudou = perfilSelecionado !== perfilInicial;
  const perfilValido = PERFIS_VALIDOS.has(perfilSelecionado);
  const podeSalvar =
    Boolean(usuario?.id) && mudou && perfilValido && typeof onSalvar === "function" && !salvando;

  const IconSelecionado = iconByPerfil(perfilSelecionado);

  useEffect(() => {
    if (!isOpen) return;

    setPerfilSelecionado(perfilInicial);
    setErro("");
    setMsgA11y("");
  }, [isOpen, perfilInicial, usuario?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;

    const timer = window.setTimeout(() => {
      const selectedIndex = PERFIS_OFICIAIS.findIndex(
        (perfil) => perfil.value === perfilSelecionado
      );

      const focusIndex = selectedIndex >= 0 ? selectedIndex : 0;

      chipRefs.current[focusIndex]?.focus?.();
    }, 60);

    return () => {
      window.clearTimeout(timer);
      previousActiveElement?.focus?.();
    };
  }, [isOpen, perfilSelecionado]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!salvando) onFechar?.();
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
  }, [isOpen, onFechar, salvando]);

  const selecionarPerfil = useCallback((perfil) => {
    const value = perfilOficial(perfil);

    if (!value) return;

    setPerfilSelecionado(value);
    setErro("");
    setMsgA11y(`Perfil selecionado: ${labelPerfil(value)}.`);
  }, []);

  const onChipsKeyDown = useCallback(
    (event) => {
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        return;
      }

      event.preventDefault();

      const values = PERFIS_OFICIAIS.map((perfil) => perfil.value);
      const currentIndex = values.indexOf(perfilSelecionado);
      const safeCurrent = currentIndex >= 0 ? currentIndex : 0;

      let nextIndex = safeCurrent;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (safeCurrent + 1) % values.length;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (safeCurrent - 1 + values.length) % values.length;
      }

      if (event.key === "Home") {
        nextIndex = 0;
      }

      if (event.key === "End") {
        nextIndex = values.length - 1;
      }

      const nextValue = values[nextIndex];

      selecionarPerfil(nextValue);

      window.requestAnimationFrame(() => {
        chipRefs.current[nextIndex]?.focus?.();
      });
    },
    [perfilSelecionado, selecionarPerfil]
  );

  async function salvar() {
    if (!podeSalvar) return;

    try {
      setSalvando(true);
      setErro("");
      setMsgA11y("Salvando alteração de perfil...");

      await onSalvar(usuario.id, perfilSelecionado);

      setMsgA11y("Perfil atualizado com sucesso.");
      onFechar?.();
    } catch (error) {
      const message = getErrorMessage(error);

      console.error("[ModalEditarPerfil] erro ao salvar perfil", {
        usuarioId: usuario?.id,
        message,
      });

      setErro(message);
      setMsgA11y(`Erro ao atualizar perfil: ${message}`);

      window.setTimeout(() => {
        saveButtonRef.current?.focus?.();
      }, 0);
    } finally {
      setSalvando(false);
    }
  }

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
          if (!salvando) onFechar?.();
        }}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={erro ? `${descId} ${helpId} ${errorId}` : `${descId} ${helpId}`}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-900 shadow-2xl dark:bg-zinc-950 dark:text-zinc-100"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-slate-900 px-5 py-5 text-white sm:px-6">
          <div
            className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl"
            aria-hidden="true"
          />

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="absolute right-3 top-3 rounded-2xl p-2 text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Fechar modal de edição de perfil"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="relative pr-10">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white">
              <UserCog className="h-4 w-4" aria-hidden="true" />
              Permissão de acesso
            </div>

            <h2 id={titleId} className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Editar perfil
            </h2>

            <p id={descId} className="mt-1 text-sm leading-relaxed text-white/90">
              Selecione o perfil oficial de{" "}
              <strong>{usuario?.nome || "usuário"}</strong>. A alteração impacta
              permissões na plataforma.
            </p>
          </div>
        </header>

        <div id={liveId} aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {erro ? (
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
                <p>{erro}</p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="mb-1 flex items-center gap-2 text-slate-700 dark:text-zinc-200">
                <UserCog className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  Perfil atual
                </span>
              </div>
              <div className="text-sm font-extrabold">
                {labelPerfil(perfilInicial)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-zinc-900/60">
              <div className="mb-1 flex items-center gap-2 text-slate-700 dark:text-zinc-200">
                <IconSelecionado className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-extrabold uppercase tracking-wide">
                  Selecionado
                </span>
              </div>
              <div className="text-sm font-extrabold">
                {labelPerfil(perfilSelecionado)}
              </div>
            </div>
          </div>

          <fieldset className="mt-5 space-y-3" aria-describedby={helpId}>
            <legend className="text-sm font-extrabold">
              Perfil oficial
            </legend>

            <p
              id={helpId}
              className="text-xs text-slate-500 dark:text-zinc-400"
            >
              Use Tab para entrar no grupo e as setas para alternar entre os
              perfis. O sistema aceita apenas um perfil por usuário.
            </p>

            <div
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Perfis disponíveis"
              onKeyDown={onChipsKeyDown}
            >
              {PERFIS_OFICIAIS.map((perfil, index) => {
                const selected = perfilSelecionado === perfil.value;
                const Icon = iconByPerfil(perfil.value);

                return (
                  <button
                    key={perfil.value}
                    ref={(element) => {
                      chipRefs.current[index] = element;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected ? "true" : "false"}
                    disabled={salvando}
                    onClick={() => selecionarPerfil(perfil.value)}
                    className={cx(
                      "flex min-h-[96px] flex-col items-start justify-between rounded-2xl border px-3 py-3 text-left text-sm transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                      selected
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"
                        : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700",
                      salvando ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span
                        className={cx(
                          "inline-flex h-9 w-9 items-center justify-center rounded-2xl border",
                          selected
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        )}
                        aria-hidden="true"
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      {selected ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-700 dark:text-emerald-300"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>

                    <span className="mt-3 font-extrabold">{perfil.label}</span>
                    <span className="mt-1 text-[11px] leading-snug opacity-80">
                      {perfil.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {perfilSelecionado === "administrador" && perfilInicial !== "administrador" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  Você está concedendo acesso administrativo. Confirme se essa
                  alteração é necessária e autorizada.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-zinc-950/90 sm:flex-row sm:justify-end sm:px-6">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-extrabold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-white/5"
          >
            Cancelar
          </button>

          <button
            ref={saveButtonRef}
            type="button"
            onClick={salvar}
            disabled={!podeSalvar}
            className={cx(
              "inline-flex min-h-[44px] items-center justify-center rounded-2xl px-4 py-2 text-sm font-extrabold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-60",
              podeSalvar
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-emerald-900"
            )}
            aria-busy={salvando ? "true" : "false"}
          >
            {salvando ? "Salvando..." : mudou ? "Salvar alteração" : "Sem alteração"}
          </button>
        </footer>
      </section>
    </div>
  );
}

ModalEditarPerfil.propTypes = {
  isOpen: PropTypes.bool,
  usuario: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    perfil: PropTypes.string,
  }).isRequired,
  onFechar: PropTypes.func.isRequired,
  onSalvar: PropTypes.func.isRequired,
};