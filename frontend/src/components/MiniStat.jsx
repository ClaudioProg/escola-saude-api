// ✅ src/components/MiniStat.jsx
import { motion } from "framer-motion";

export default function MiniStat({ title, value, hint, isDark }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={[
        "rounded-2xl border px-4 py-3 transition-colors",
        isDark ? "border-white/10 bg-zinc-950/35" : "border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div className={["text-[11px] font-bold", isDark ? "text-zinc-300" : "text-slate-500"].join(" ")}>
        {title}
      </div>
      <div className={["mt-1 text-sm font-extrabold", isDark ? "text-zinc-100" : "text-slate-900"].join(" ")}>
        {value}
      </div>
      {hint ? (
        <div className={["mt-1 text-[11px]", isDark ? "text-zinc-400" : "text-slate-500"].join(" ")}>
          {hint}
        </div>
      ) : null}
    </motion.div>
  );
}
