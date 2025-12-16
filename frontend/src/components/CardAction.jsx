// ✅ src/components/CardAction.jsx
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CardAction({
  icon: Icon,
  title,
  description,
  to,
  onClick,
  isDark,
  accent = "emerald", // "emerald" | "violet" | "sky" | "amber" | ...
}) {
  const accentRing =
    accent === "violet" ? "hover:border-violet-500" :
    accent === "sky" ? "hover:border-sky-500" :
    accent === "amber" ? "hover:border-amber-500" :
    "hover:border-emerald-500";

  const accentText =
    accent === "violet" ? "group-hover:text-violet-600 dark:group-hover:text-violet-300" :
    accent === "sky" ? "group-hover:text-sky-700 dark:group-hover:text-sky-300" :
    accent === "amber" ? "group-hover:text-amber-700 dark:group-hover:text-amber-300" :
    "group-hover:text-emerald-700 dark:group-hover:text-emerald-300";

  const Comp = to ? "a" : "button";
  const props = to ? { href: to } : { type: "button", onClick };

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
      <Comp
        {...props}
        className={[
          "group w-full text-left rounded-3xl border p-5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
          isDark ? "bg-zinc-900/60 border-white/10 hover:bg-white/5" : "bg-white border-slate-200 hover:bg-slate-50",
          accentRing,
        ].join(" ")}
      >
        <div className="flex items-start gap-4">
          <div className={["rounded-2xl p-3 border", isDark ? "border-white/10 bg-zinc-950/30" : "border-slate-200 bg-slate-50"].join(" ")}>
            <Icon className={["h-6 w-6 transition", isDark ? "text-zinc-200" : "text-slate-700", accentText].join(" ")} />
          </div>

          <div className="min-w-0 flex-1">
            <div className={["text-sm font-extrabold", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
              {title}
            </div>
            {description ? (
              <div className={["mt-1 text-xs leading-relaxed", isDark ? "text-zinc-400" : "text-slate-600"].join(" ")}>
                {description}
              </div>
            ) : null}

            <div className={["mt-3 inline-flex items-center gap-2 text-xs font-extrabold transition", isDark ? "text-zinc-300" : "text-slate-700", accentText].join(" ")}>
              Acessar <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Comp>
    </motion.div>
  );
}
