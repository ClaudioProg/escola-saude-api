// 📁 src/components/EventoDetalheModal.jsx
import PropTypes from "prop-types";
import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarDays, MapPin, Info, Users } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Modal de detalhes do evento (acessível + focus trap + portal).
 */
export default function EventoDetalheModal({
  evento,
  visivel,
  aoFechar,
  fechaNoBackdrop = true,
  fechaNoEsc = true,
  showCloseButton = true,
  footer = null, // ex.: <div><Botao .../>...</div>
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  /* =========================
     Ações de fechar
     ========================= */
  const close = useCallback(() => aoFechar?.(), [aoFechar]);

  // ESC
  useEffect(() => {
    if (!visivel || !fechaNoEsc) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visivel, fechaNoEsc, close]);

  // Bloqueio scroll + foco
  useEffect(() => {
    if (!visivel) return;
    previouslyFocusedRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = overflow;
      clearTimeout(t);
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [visivel]);

  // Focus trap (Tab/Shift+Tab cicla dentro do modal)
  const trapFocus = useCallback((e) => {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;

    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const arr = Array.from(focusables);
    if (arr.length === 0) return;

    const first = arr[0];
    const last = arr[arr.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !root.contains(active)) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (active === last) {
        first.focus();
        e.preventDefault();
      }
    }
  }, []);

  if (typeof document === "undefined") return null;

  // Helpers seguros
  const titulo = evento?.titulo || evento?.nome || "Evento";
  const dataIni = evento?.data_inicio ? formatarDataBrasileira(evento.data_inicio) : "—";
  const dataFim = evento?.data_fim ? formatarDataBrasileira(evento.data_fim) : "—";
  const hIni =
    typeof evento?.horario_inicio === "string" ? evento.horario_inicio.slice(0, 5) : null;
  const hFim =
    typeof evento?.horario_fim === "string" ? evento.horario_fim.slice(0, 5) : null;
  const localLabel = evento?.local?.nome || evento?.local || "Local a definir";
  const instrutores =
    Array.isArray(evento?.instrutores)
      ? evento.instrutores.map((i) => i?.nome).filter(Boolean)
      : typeof evento?.instrutores === "string"
      ? [evento.instrutores]
      : [];

  const content = (
    <AnimatePresence>
      {visivel && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (!fechaNoBackdrop) return;
            // fecha só se o clique for no backdrop, não dentro do card
            if (e.target === overlayRef.current) close();
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="evento-modal-titulo"
          aria-describedby="evento-modal-descricao"
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative text-left outline-none"
            initial={reduceMotion ? { opacity: 0 } : { scale: 0.96, y: 8, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0.96, y: 8, opacity: 0 }}
            transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 24 }}
            onKeyDown={trapFocus}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
              <h2
                id="evento-modal-titulo"
                className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-green-900 dark:text-green-200"
              >
                📌 {titulo}
              </h2>
              {showCloseButton && (
                <button
                  className="inline-flex items-center justify-center p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={close}
                  aria-label="Fechar detalhes do evento"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4 sm:py-5 space-y-3 sm:space-y-4">
              {/* Datas e horários */}
              <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                <CalendarDays className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Data</div>
                  <div className="text-sm">
                    {dataIni} a {dataFim}
                  </div>
                  {hIni && hFim && (
                    <div className="text-sm mt-0.5">
                      <span className="font-semibold">Horário:</span> {hIni} às {hFim}
                    </div>
                  )}
                </div>
              </div>

              {/* Local */}
              <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Local</div>
                  <div className="text-sm">{localLabel}</div>
                </div>
              </div>

              {/* Instrutores */}
              {instrutores.length > 0 && (
                <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-semibold">Instrutores</div>
                    <div className="text-sm">{instrutores.join(", ")}</div>
                  </div>
                </div>
              )}

              {/* Descrição */}
              {evento?.descricao && (
                <div
                  id="evento-modal-descricao"
                  className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400"
                >
                  <Info className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm leading-relaxed">{evento.descricao}</p>
                </div>
              )}
            </div>

            {/* Footer opcional */}
            {footer && (
              <div className="px-5 py-3 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Usa portal para evitar conflitos de layout/stacking
  return createPortal(content, document.body);
}

EventoDetalheModal.propTypes = {
  evento: PropTypes.object.isRequired,
  visivel: PropTypes.bool.isRequired,
  aoFechar: PropTypes.func.isRequired,
  fechaNoBackdrop: PropTypes.bool,
  fechaNoEsc: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  footer: PropTypes.node,
};
