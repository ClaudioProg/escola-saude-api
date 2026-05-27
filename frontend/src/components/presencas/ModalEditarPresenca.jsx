// ✅ src/components/presencas/ModalEditarPresenca.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Modal para edição pontual de presença.
//
// Contratos aplicados:
// - Componente específico do domínio presenças;
// - Sem import de Modal em caminho incerto;
// - Sem toast direto;
// - Sem chamada de API direta;
// - Salvar delegado para onSalvar(payload);
// - Status oficial local: presente | faltou;
// - Justificativa obrigatória quando status = faltou;
// - Botao v2.0 em src/components/ui;
// - Acessível com role="dialog", aria-modal, labelledBy, describedBy;
// - Fecha por Escape e backdrop, exceto durante salvamento;
// - Foco inicial controlado;
// - Scroll lock enquanto aberto;
// - Mobile-first, dark mode e teclado.

import PropTypes from "prop-types";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  ClipboardSignature,
  Loader2,
  X,
} from "lucide-react";

import Botao from "../ui/Botao";

/* ─────────────────────────────────────────────────────────────
 * Constantes
 * ───────────────────────────────────────────────────────────── */

const STATUS_OPCAO = Object.freeze(["presente", "faltou"]);

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  return STATUS_OPCAO.includes(status) ? status : "faltou";
}

function getErrorMessage(error, fallback = "Falha ao salvar presença.") {
  return (
    error?.data?.mensagem ||
    error?.data?.message ||
    error?.response?.data?.mensagem ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function isInteractiveElement(element) {
  if (!element) return false;

  const selector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return element.matches?.(selector);
}

function getFocusableElements(container) {
  if (!container) return [];

  const selector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(container.querySelectorAll(selector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true"
  );
}

/* ─────────────────────────────────────────────────────────────
 * Componente
 * ───────────────────────────────────────────────────────────── */

export default function ModalEditarPresenca({
  isOpen,
  onClose,
  onSalvar,
  inscrito,
  minJustLen = 3,
}) {
  const rawId = useId().replace(/:/g, "");
  const titleId = `titulo-editar-presenca-${rawId}`;
  const descId = `descricao-editar-presenca-${rawId}`;
  const liveId = `live-editar-presenca-${rawId}`;
  const justId = `justificativa-falta-${rawId}`;
  const justHelpId = `ajuda-justificativa-${rawId}`;
  const justCountId = `contagem-justificativa-${rawId}`;

  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const chipRefs = useRef([]);
  const previousFocusRef = useRef(null);

  const statusInicial = useMemo(
    () => normalizarStatus(inscrito?.status),
    [inscrito?.status]
  );

  const [status, setStatus] = useState(statusInicial);
  const [justificativa, setJustificativa] = useState(
    inscrito?.justificativa || ""
  );
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  const justificativaTrim = justificativa.trim();
  const contar = justificativaTrim.length;
  const justificativaObrigatoria = status === "faltou";
  const faltaInvalida = justificativaObrigatoria && contar < minJustLen;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    setStatus(statusInicial);
    setJustificativa(inscrito?.justificativa || "");
    setErro("");
    setMsgA11y("");
    setSalvando(false);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      const selectedIndex = statusInicial === "faltou" ? 1 : 0;
      chipRefs.current[selectedIndex]?.focus?.() ||
        closeButtonRef.current?.focus?.();
    }, 30);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = originalOverflow;

      if (isInteractiveElement(previousFocusRef.current)) {
        previousFocusRef.current.focus?.();
      }
    };
  }, [isOpen, inscrito?.justificativa, statusInicial]);

  useEffect(() => {
    if (status === "presente" && justificativa) {
      setJustificativa("");
    }

    setErro("");
  }, [justificativa, status]);

  const handleClose = useCallback(() => {
    if (salvando) return;
    onClose?.();
  }, [onClose, salvando]);

  const handleKeyDownDialog = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialogRef.current);

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [handleClose]
  );

  const handleChipsKeyDown = useCallback(
    (event) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];

      if (!keys.includes(event.key)) return;

      const current = STATUS_OPCAO.indexOf(status);
      let next = current;

      if (event.key === "ArrowRight") {
        next = (current + 1) % STATUS_OPCAO.length;
      }

      if (event.key === "ArrowLeft") {
        next = (current - 1 + STATUS_OPCAO.length) % STATUS_OPCAO.length;
      }

      if (event.key === "Home") {
        next = 0;
      }

      if (event.key === "End") {
        next = STATUS_OPCAO.length - 1;
      }

      event.preventDefault();

      const nextStatus = STATUS_OPCAO[next];

      setStatus(nextStatus);
      requestAnimationFrame(() => chipRefs.current[next]?.focus?.());
    },
    [status]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault?.();

      setErro("");

      if (faltaInvalida) {
        const message = `Informe uma justificativa com pelo menos ${minJustLen} caracteres.`;

        setErro(message);
        setMsgA11y(message);
        return;
      }

      try {
        setSalvando(true);
        setMsgA11y("Salvando presença...");

        const payload = {
          ...inscrito,
          status,
          justificativa: status === "faltou" ? justificativaTrim : "",
        };

        await Promise.resolve(onSalvar?.(payload));

        setMsgA11y("Presença salva com sucesso.");
        onClose?.();
      } catch (error) {
        const message = getErrorMessage(error);

        setErro(message);
        setMsgA11y(`Erro ao salvar presença: ${message}`);
      } finally {
        setSalvando(false);
      }
    },
    [
      faltaInvalida,
      inscrito,
      justificativaTrim,
      minJustLen,
      onClose,
      onSalvar,
      status,
    ]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={handleKeyDownDialog}
        className="max-h-[94dvh] w-full overflow-hidden rounded-t-[2rem] bg-white shadow-2xl outline-none dark:bg-slate-950 sm:max-w-lg sm:rounded-[2rem]"
      >
        <header className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-cyan-800 to-emerald-700 px-4 py-4 text-white sm:px-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/15 blur-3xl"
          />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
                <ClipboardSignature className="h-3.5 w-3.5" aria-hidden="true" />
                Presença
              </div>

              <h2
                id={titleId}
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                Editar presença
              </h2>

              <p id={descId} className="mt-1 text-sm text-white/90">
                Ajuste o status e registre justificativa quando necessário.
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              disabled={salvando}
              className="rounded-2xl bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div id={liveId} aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="max-h-[calc(94dvh-170px)] overflow-y-auto px-4 pb-5 pt-4 sm:px-5">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200">
              <div className="flex items-start gap-2">
                <ClipboardSignature
                  className="mt-0.5 h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300"
                  aria-hidden="true"
                />

                <p className="min-w-0 break-words">
                  Participante:{" "}
                  <strong className="font-black">
                    {inscrito?.nome || "—"}
                  </strong>
                </p>
              </div>
            </div>

            <fieldset
              className="mb-4"
              role="radiogroup"
              aria-label="Status da presença"
              onKeyDown={handleChipsKeyDown}
            >
              <legend className="mb-2 text-sm font-black text-slate-800 dark:text-slate-100">
                Status
              </legend>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: "presente",
                    label: "Presente",
                    icon: Check,
                    selectedClass:
                      "border-emerald-400 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
                  },
                  {
                    value: "faltou",
                    label: "Faltou",
                    icon: X,
                    selectedClass:
                      "border-rose-400 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
                  },
                ].map((option, index) => {
                  const selected = status === option.value;
                  const Icon = option.icon;

                  return (
                    <label
                      key={option.value}
                      ref={(element) => {
                        chipRefs.current[index] = element;
                      }}
                      tabIndex={selected ? 0 : -1}
                      role="radio"
                      aria-checked={selected}
                      className={classNames(
                        "relative flex cursor-pointer select-none items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black outline-none transition",
                        "focus-visible:ring-2 focus-visible:ring-teal-500",
                        selected
                          ? option.selectedClass
                          : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
                        salvando && "cursor-not-allowed opacity-70"
                      )}
                    >
                      <input
                        type="radio"
                        name="presenca"
                        value={option.value}
                        checked={selected}
                        onChange={() => setStatus(option.value)}
                        className="sr-only"
                        disabled={salvando}
                      />

                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {status === "faltou" && (
              <div className="mb-2">
                <label
                  htmlFor={justId}
                  className="mb-1 block text-sm font-black text-slate-800 dark:text-slate-100"
                >
                  Justificativa da falta
                </label>

                <textarea
                  id={justId}
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  placeholder="Descreva a justificativa..."
                  className={classNames(
                    "min-h-28 w-full resize-y rounded-2xl border bg-white p-3 text-sm text-slate-950 outline-none transition dark:bg-slate-900 dark:text-white",
                    faltaInvalida
                      ? "border-rose-400 focus:ring-4 focus:ring-rose-500/15"
                      : "border-slate-300 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/15 dark:border-slate-700"
                  )}
                  rows={4}
                  disabled={salvando}
                  aria-invalid={faltaInvalida ? "true" : "false"}
                  aria-describedby={`${justHelpId} ${justCountId}`}
                />

                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span
                    id={justHelpId}
                    className="text-slate-500 dark:text-slate-400"
                  >
                    Mínimo de {minJustLen} caracteres
                  </span>

                  <span
                    id={justCountId}
                    className={classNames(
                      contar < minJustLen
                        ? "text-rose-600 dark:text-rose-300"
                        : "text-slate-400"
                    )}
                  >
                    {contar} caractere{contar === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            )}

            {erro && (
              <div
                className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                role="alert"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />

                <span>{erro}</span>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 sm:px-5">
            <Botao
              type="button"
              variant="secundario"
              onClick={handleClose}
              disabled={salvando}
              className="rounded-2xl"
            >
              Cancelar
            </Botao>

            <Botao
              type="submit"
              variant="primario"
              disabled={salvando || faltaInvalida}
              loading={salvando}
              aria-busy={salvando ? "true" : "false"}
              className="rounded-2xl"
            >
              {salvando ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Salvando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Salvar
                </span>
              )}
            </Botao>
          </footer>
        </form>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PropTypes
 * ───────────────────────────────────────────────────────────── */

ModalEditarPresenca.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSalvar: PropTypes.func.isRequired,
  inscrito: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    usuario_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string,
    status: PropTypes.oneOf(["presente", "faltou"]),
    justificativa: PropTypes.string,
  }),
  minJustLen: PropTypes.number,
};