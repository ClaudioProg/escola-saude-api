// 📁 src/components/ModalBase.jsx
import { useEffect } from "react";
import { createPortal } from "react-dom";

const modalRoot = document.getElementById("modal-root") || document.body;

/**
 * props:
 * - isOpen: boolean
 * - onClose: () => void
 * - level: 0 (evento), 1 (turma), 2... (modais aninhados)
 * - children
 * - maxWidth: string tailwind (ex. "max-w-3xl")
 */
export default function ModalBase({
  isOpen,
  onClose,
  level = 0,
  children,
  maxWidth = "max-w-2xl",
}) {
  if (!isOpen) return null;

  const BASE_Z = 1000 + level * 20; // overlay e conteúdo sobem de 20 em 20

  useEffect(() => {
    // trava scroll do body enquanto o modal está aberto
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdrop}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: BASE_Z }}
    >
      {/* overlay (sempre abaixo do conteúdo) */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        style={{ zIndex: BASE_Z }}
      />
      {/* conteúdo */}
      <div
        className={`relative w-full ${maxWidth} bg-white dark:bg-zinc-900 rounded-2xl shadow-xl`}
        style={{ zIndex: BASE_Z + 1 }}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(node, modalRoot);
}
