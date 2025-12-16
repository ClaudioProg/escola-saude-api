function ModalChecklistEmail({ open, onClose, onResend, cooldown, isDark }) {
    const refFirst = useRef(null);
  
    useEffect(() => {
      if (open) setTimeout(() => refFirst.current?.focus(), 60);
    }, [open]);
  
    if (!open) return null;
  
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-checklist"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        {/* backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
  
        {/* modal */}
        <div
          className={[
            "relative w-full max-w-md rounded-3xl border p-6 shadow-2xl",
            isDark
              ? "bg-zinc-900/80 border-white/10 text-zinc-100"
              : "bg-white border-slate-200 text-slate-900",
          ].join(" ")}
        >
          <h3 id="titulo-checklist" className="text-lg font-extrabold text-center mb-2">
            Não recebeu o e-mail?
          </h3>
  
          <p className={["text-sm text-center mb-4", isDark ? "text-zinc-300" : "text-slate-600"].join(" ")}>
            Antes de reenviar, confira rapidamente:
          </p>
  
          <ul className={["text-sm space-y-2", isDark ? "text-zinc-300" : "text-slate-700"].join(" ")}>
            <li>• Verifique <strong>Spam</strong> e <strong>Lixeira</strong></li>
            <li>• Aguarde até <strong>5 minutos</strong> (pode haver atraso)</li>
            <li>• Confirme se digitou o e-mail corretamente</li>
            <li>• Domínios institucionais podem filtrar mensagens</li>
          </ul>
  
          <div className="mt-5 flex flex-col gap-2">
            <BotaoPrimario
              ref={refFirst}
              type="button"
              onClick={onResend}
              disabled={cooldown > 0}
              className="w-full"
            >
              {cooldown > 0 ? `Aguarde ${cooldown}s` : "Reenviar e-mail"}
            </BotaoPrimario>
  
            <BotaoSecundario
              type="button"
              onClick={onClose}
              className={[
                "w-full rounded-2xl border py-3 font-extrabold",
                isDark
                  ? "border-white/10 bg-zinc-900/40 text-zinc-200 hover:bg-white/5"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
              ].join(" ")}
            >
              Fechar
            </BotaoSecundario>
          </div>
        </div>
      </div>
    );
  }
  