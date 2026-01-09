// ✅ src/components/ModalChecklistEmail.jsx
import { useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { Mail, ShieldAlert, Trash2, Clock3, AtSign, Building2 } from "lucide-react";

import Modal from "./Modal";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";

export default function ModalChecklistEmail({
  open,
  onClose,
  onResend,
  cooldown = 0,
  isDark, // compat (opcional). ideal: remover e usar só dark:
}) {
  const refFirst = useRef(null);

  useEffect(() => {
    if (!open) return;
    // Modal já foca o primeiro elemento; isso garante foco no botão principal.
    setTimeout(() => refFirst.current?.focus?.(), 30);
  }, [open]);

  const disabled = Number(cooldown) > 0;

  const tituloBotao = useMemo(() => {
    if (disabled) return `Aguarde ${cooldown}s`;
    return "Reenviar e-mail";
  }, [disabled, cooldown]);

  const items = useMemo(
    () => [
      {
        icon: ShieldAlert,
        title: "Spam",
        desc: "Verifique Spam e Promoções (Gmail) ou Junk (Outlook).",
      },
      {
        icon: Trash2,
        title: "Lixeira",
        desc: "Às vezes o provedor move para Lixeira automaticamente.",
      },
      {
        icon: Clock3,
        title: "Aguarde um pouco",
        desc: "Pode levar até 5 minutos para chegar (fila de e-mails).",
      },
      {
        icon: AtSign,
        title: "E-mail correto",
        desc: "Confirme se digitou o endereço corretamente.",
      },
      {
        icon: Building2,
        title: "Domínio institucional",
        desc: "Domínios .gov/.edu podem filtrar mensagens automaticamente.",
      },
    ],
    []
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="titulo-checklist-email"
      describedBy="desc-checklist-email"
      className={[
        "w-[96%] max-w-md p-0 overflow-hidden",
        // compat: se algum lugar ainda passa isDark e você quer forçar visual,
        // mantém; mas o ideal é deixar o tema por dark:
        isDark ? "dark" : "",
      ].join(" ")}
      initialFocusRef={refFirst}
    >
      {/* Header premium */}
      <header className="px-5 py-4 text-white bg-gradient-to-br from-fuchsia-900 via-violet-800 to-indigo-700">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white/15 border border-white/20">
            <Mail className="w-5 h-5" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h3 id="titulo-checklist-email" className="text-lg font-extrabold tracking-tight">
              Não recebeu o e-mail?
            </h3>
            <p id="desc-checklist-email" className="text-white/90 text-sm mt-1">
              Antes de reenviar, confira rapidamente estes pontos.
            </p>
          </div>
        </div>
      </header>

      {/* corpo */}
      <div className="px-5 pt-4 pb-24">
        {/* status cooldown */}
        <div
          className={[
            "rounded-2xl border p-3 mb-4",
            disabled
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200",
          ].join(" ")}
          aria-live="polite"
        >
          <div className="text-xs font-extrabold uppercase tracking-wide opacity-80">
            Status
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            {disabled ? `Reenvio liberado em ${cooldown}s` : "Você já pode reenviar agora."}
          </div>
        </div>

        {/* checklist */}
        <ul className="space-y-3" aria-label="Checklist de verificação do e-mail">
          {items.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3
                         dark:border-slate-800 dark:bg-slate-950/40"
            >
              <div className="flex items-start gap-3">
                <span className="grid place-items-center w-9 h-9 rounded-2xl bg-slate-100 border border-slate-200
                                 dark:bg-slate-900 dark:border-slate-800">
                  <Icon className="w-4 h-4 text-slate-700 dark:text-slate-200" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {desc}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-slate-950/80 backdrop-blur
                      border-t border-slate-200 dark:border-slate-800 px-5 py-3">
        <div className="flex flex-col gap-2">
          <BotaoPrimario
            ref={refFirst}
            type="button"
            onClick={onResend}
            disabled={disabled}
            className="w-full"
            aria-disabled={disabled ? "true" : "false"}
            title={disabled ? "Aguarde o tempo de segurança para reenviar." : "Reenviar e-mail"}
          >
            {tituloBotao}
          </BotaoPrimario>

          <BotaoSecundario type="button" onClick={onClose} className="w-full">
            Fechar
          </BotaoSecundario>
        </div>
      </div>
    </Modal>
  );
}

ModalChecklistEmail.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onResend: PropTypes.func,
  cooldown: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isDark: PropTypes.bool, // compat
};
