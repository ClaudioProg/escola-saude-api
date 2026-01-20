// ✅ src/components/EventoDetalheModal.jsx
import PropTypes from "prop-types";
import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, CalendarDays, MapPin, Info, Users } from "lucide-react";
import { formatarDataBrasileira } from "../utils/dateTime";

/* ====================== prefers-reduced-motion (SSR safe) ====================== */
const prefersReduced =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ============================ Helpers de normalização ============================ */
const hhmm = (v) =>
  typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;

function normalizarDatas(evento) {
  const di = evento?.data_inicio_geral || evento?.data_inicio || evento?.inicio || null;
  const df = evento?.data_fim_geral    || evento?.data_fim    || evento?.fim    || null;

  const hi =
    hhmm(evento?.horario_inicio_geral) ||
    hhmm(evento?.horario_inicio) ||
    hhmm(evento?.inicio_horario) ||
    null;

  const hf =
    hhmm(evento?.horario_fim_geral) ||
    hhmm(evento?.horario_fim) ||
    hhmm(evento?.fim_horario) ||
    null;

  return { di, df, hi, hf };
}

function normalizarInstrutores(evt) {
  if (Array.isArray(evt?.instrutor)) return evt.instrutor.map((i) => i?.nome).filter(Boolean);
  if (Array.isArray(evt?.instrutores)) return evt.instrutores.map((i) => (typeof i === "string" ? i : i?.nome)).filter(Boolean);
  if (typeof evt?.instrutores === "string") return [evt.instrutores];
  if (typeof evt?.instrutor === "string") return [evt.instrutor];
  return [];
}

function normalizarLocal(evt) {
  if (typeof evt?.local === "string") return evt.local;
  if (evt?.local?.nome) return evt.local.nome;
  if (evt?.endereco) return evt.endereco;
  return "Local a definir";
}

/**
 * Modal de detalhes de evento (acessível, focus trap, portal).
 * - Trava scroll do body sem flicker (useLayoutEffect).
 * - Isola o app com `inert` e `aria-hidden` (opcional, via appRootSelector).
 * - Focus trap com sentinelas + fallback em keydown.
 */
export default function EventoDetalheModal({
  evento,
  visivel,
  aoFechar,
  fechaNoBackdrop = true,
  fechaNoEsc = true,
  showCloseButton = true,
  footer = null,
  appRootSelector = null,  // ex.: "#root" para aplicar inert/aria-hidden fora do modal
  portalSelector = "#modal-root", // usa #modal-root se existir; senão cai no body
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const bodyOriginalOverflowRef = useRef("");

  const close = useCallback(() => aoFechar?.(), [aoFechar]);

  // ESC para fechar
  useEffect(() => {
    if (!visivel || !fechaNoEsc) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [visivel, fechaNoEsc, close]);

  // Bloqueio de scroll + gestão de foco (layout effect previne “salto”)
  useLayoutEffect(() => {
    if (!visivel) return;
    previouslyFocusedRef.current = document.activeElement;
    // evita “body shift”: guarda overflow e seta hidden
    bodyOriginalOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // isola app raiz (opcional)
    let rootNode = null;
    if (appRootSelector) {
      rootNode = document.querySelector(appRootSelector);
      if (rootNode) {
        rootNode.setAttribute("aria-hidden", "true");
        // inert tem amplo suporte moderno; se indisponível, é ignorado
        rootNode.setAttribute("inert", "");
      }
    }

    const t = setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = bodyOriginalOverflowRef.current;
      clearTimeout(t);
      if (rootNode) {
        rootNode.removeAttribute("aria-hidden");
        rootNode.removeAttribute("inert");
      }
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [visivel, appRootSelector]);

  // Focus trap: sentinelas antes/depois + fallback em keydown (robusto)
  const onTrapKeyDown = useCallback((e) => {
    if (e.key !== "Tab") return;
    const root = dialogRef.current;
    if (!root) return;

    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const arr = Array.from(focusables);
    if (arr.length === 0) {
      // Se não houver foco possível, mantém o próprio dialog
      dialogRef.current?.focus();
      e.preventDefault();
      return;
    }

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

  // Sentinelas: quando recebem foco, redirecionam para o começo/fim
  const focusFirst = useCallback(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    (focusables[0] || dialogRef.current).focus();
  }, []);
  const focusLast = useCallback(() => {
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    (focusables[focusables.length - 1] || dialogRef.current).focus();
  }, []);

  if (typeof document === "undefined") return null;

  /* ============================ Dados normalizados ============================ */
  const titulo = evento?.titulo || evento?.nome || "Evento";
  const { di, df, hi, hf } = useMemo(() => normalizarDatas(evento), [evento]);

  const dataIniFmt = di ? formatarDataBrasileira(di) : "—";
  const dataFimFmt = df ? formatarDataBrasileira(df) : "—";

  const localLabel = normalizarLocal(evento);
  const instrutores = normalizarInstrutores(evento);

  // Seleciona o container do portal
  const portalTarget =
    (portalSelector && document.querySelector(portalSelector)) || document.body;

  /* ============================ Conteúdo ============================ */
  const content = (
    <AnimatePresence>
      {visivel && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // fecha ao clicar no fundo, sem capturar cliques no conteúdo
          onMouseDown={(e) => {
            if (!fechaNoBackdrop) return;
            if (e.target === overlayRef.current) close();
          }}
          aria-modal="true"
          role="dialog"
          aria-labelledby="evento-modal-titulo"
          aria-describedby={evento?.descricao ? "evento-modal-descricao" : undefined}
        >
          {/* sentinel inicial para trap */}
          <button className="sr-only" onFocus={focusLast} aria-hidden tabIndex={0} />

          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto relative text-left outline-none"
            initial={prefersReduced ? { opacity: 0 } : { scale: 0.96, y: 8, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { scale: 1, y: 0, opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { scale: 0.96, y: 8, opacity: 0 }}
            transition={prefersReduced ? { duration: 0.15 } : { type: "spring", stiffness: 260, damping: 24 }}
            onKeyDown={onTrapKeyDown}
            onMouseDown={(e) => e.stopPropagation()} // evita backdrop close ao arrastar dentro
          >
            {/* Header com faixa/gradiente (padrão visual) */}
            <div className="sticky top-0 z-10 border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-lime-600 rounded-t-2xl" />
              <div className="flex items-center justify-between px-5 py-4">
                <h2
                  id="evento-modal-titulo"
                  className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-green-900 dark:text-green-200"
                >
                  📌 {titulo}
                </h2>
                {showCloseButton && (
                  <button
                    className="inline-flex items-center justify-center p-1.5 rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-600"
                    onClick={close}
                    aria-label="Fechar detalhes do evento"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 sm:py-5 space-y-3 sm:space-y-4">
              {/* Datas e horários */}
              <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                <CalendarDays className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Data</div>
                  <div className="text-sm">
                    {dataIniFmt} a {dataFimFmt}
                  </div>
                  {hi && hf && (
                    <div className="text-sm mt-0.5">
                      <span className="font-semibold">Horário:</span> {hi} às {hf}
                    </div>
                  )}
                </div>
              </div>

              {/* Local */}
              <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">Local</div>
                  <div className="text-sm">{normalizarLocal(evento)}</div>
                </div>
              </div>

              {/* Instrutores */}
              {normalizarInstrutores(evento).length > 0 && (
                <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                  <Users className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-semibold">Instrutores</div>
                    <div className="text-sm">{normalizarInstrutores(evento).join(", ")}</div>
                  </div>
                </div>
              )}

              {/* Descrição */}
              {evento?.descricao && (
                <div id="evento-modal-descricao" className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
                  <Info className="w-5 h-5 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <p className="text-sm leading-relaxed">{evento.descricao}</p>
                </div>
              )}
            </div>

            {/* Footer opcional (CTA) */}
            {footer && (
              <div className="px-5 py-3 border-t border-zinc-200/70 dark:border-zinc-800/80 flex items-center justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>

          {/* sentinel final para trap */}
          <button className="sr-only" onFocus={focusFirst} aria-hidden tabIndex={0} />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, portalTarget);
}

EventoDetalheModal.propTypes = {
  evento: PropTypes.object.isRequired,
  visivel: PropTypes.bool.isRequired,
  aoFechar: PropTypes.func.isRequired,
  fechaNoBackdrop: PropTypes.bool,
  fechaNoEsc: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  footer: PropTypes.node,
  /** Se informado, aplica aria-hidden/inert ao nó raiz do app enquanto o modal estiver aberto (ex.: "#root") */
  appRootSelector: PropTypes.string,
  /** Se existir um container de portal (ex.: <div id="modal-root" />), ele será usado; caso contrário, cai no body */
  portalSelector: PropTypes.string,
};
