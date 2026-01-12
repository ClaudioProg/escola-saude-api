// 📁 src/components/TurmaItem.jsx
import PropTypes from "prop-types";
import { CalendarDays, Clock } from "lucide-react";
import { useMemo, useCallback } from "react";
import { formatarDataBrasileira } from "../utils/data";

/* ───────────────── helpers ───────────────── */

const toHHMM = (raw, fb = "") => {
  if (!raw && raw !== 0) return fb;
  const s = String(raw).trim();
  if (!s) return fb;

  // "800" | "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const pad = s.length === 3 ? "0" + s : s;
    const H = Math.min(23, parseInt(pad.slice(0, 2), 10));
    const M = Math.min(59, parseInt(pad.slice(2, 4), 10));
    return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
  }

  // "8" | "8:0" | "08:00" | "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?/);
  if (!m) return fb;
  const H = Math.min(23, parseInt(m[1] || "0", 10));
  const M = Math.min(59, parseInt(m[2] || "0", 10));
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};

const diaISO = (v) => (typeof v === "string" ? v.slice(0, 10) : "");

/** Agora em formato comparável lexicograficamente: YYYY-MM-DD HH:MM */
function agoraYMDHM() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** Extrai range coerente:
 *  1) data_inicio/data_fim (+ horários)
 *  2) encontros (data/inicio/fim)
 *  3) datas (data/horario_inicio/horario_fim)
 */
function derivarRangeTurma(t) {
  const hi = toHHMM(t?.horario_inicio, "00:00");
  const hf = toHHMM(t?.horario_fim, "23:59");
  const di = diaISO(t?.data_inicio);
  const df = diaISO(t?.data_fim);

  if (di && df) {
    return { data_inicio: di, data_fim: df, horario_inicio: hi, horario_fim: hf, fonte: "campos" };
  }

  if (Array.isArray(t?.encontros) && t.encontros.length) {
    const ordenados = t.encontros
      .map((e) => ({
        d: diaISO(e?.data || e),
        hi: toHHMM(e?.inicio, hi),
        hf: toHHMM(e?.fim, hf),
      }))
      .filter((x) => x.d)
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

    if (ordenados.length) {
      const last = ordenados[ordenados.length - 1];
      return {
        data_inicio: ordenados[0].d,
        data_fim: last.d,
        horario_inicio: ordenados[0].hi || hi,
        horario_fim: ordenados[0].hf || hf,
        fonte: "encontros",
      };
    }
  }

  if (Array.isArray(t?.datas) && t.datas.length) {
    const ordenados = t.datas
      .map((d) => ({
        d: diaISO(d?.data || d),
        hi: toHHMM(d?.horario_inicio, hi),
        hf: toHHMM(d?.horario_fim, hf),
      }))
      .filter((x) => x.d)
      .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));

    if (ordenados.length) {
      const last = ordenados[ordenados.length - 1];
      return {
        data_inicio: ordenados[0].d,
        data_fim: last.d,
        horario_inicio: ordenados[0].hi || hi,
        horario_fim: ordenados[0].hf || hf,
        fonte: "datas",
      };
    }
  }

  return { data_inicio: "", data_fim: "", horario_inicio: "", horario_fim: "", fonte: "indefinido" };
}

function compStatus(turma) {
  const range = derivarRangeTurma(turma);

  if (!range.data_inicio || !range.data_fim) {
    return {
      key: "indefinido",
      texto: "—",
      badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
      bar: "from-zinc-400 via-zinc-500 to-zinc-600",
    };
  }

  const start = `${range.data_inicio} ${toHHMM(range.horario_inicio, "00:00")}`;
  const end = `${range.data_fim} ${toHHMM(range.horario_fim, "23:59")}`;
  const now = agoraYMDHM();

  if (now < start) {
    // ✅ Programado → verde
    return {
      key: "programado",
      texto: "Programado",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-600/25 dark:text-emerald-200",
      bar: "from-emerald-600 via-emerald-500 to-teal-500",
    };
  }

  if (now > end) {
    // ✅ Encerrado → vermelho/rose
    return {
      key: "encerrado",
      texto: "Encerrado",
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-700/25 dark:text-rose-200",
      bar: "from-rose-600 via-fuchsia-600 to-indigo-600",
    };
  }

  // ✅ Em andamento → amarelo
  return {
    key: "andamento",
    texto: "Em andamento",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-600/25 dark:text-amber-200",
    bar: "from-amber-600 via-orange-600 to-yellow-500",
  };
}

/* ───────────────── componente ───────────────── */

export default function TurmaItem({ turma, onClick, className = "", ctaLabel = "Selecionar" }) {
  const clickable = typeof onClick === "function";

  const { status, range, ini, fim, titulo } = useMemo(() => {
    const status = compStatus(turma);
    const range = derivarRangeTurma(turma);

    // linha de horário: prioriza campos da turma; fallback range
    const ini = toHHMM(turma?.horario_inicio || range.horario_inicio || "", "—:—");
    const fim = toHHMM(turma?.horario_fim || range.horario_fim || "", "—:—");
    const titulo = turma?.nome || `Turma ${turma?.id}`;

    return { status, range, ini, fim, titulo };
  }, [turma]);

  const handleSelect = useCallback(() => {
    if (clickable) onClick(turma);
  }, [clickable, onClick, turma]);

  return (
    <article
      className={[
        "relative overflow-hidden rounded-2xl border shadow-sm transition",
        "bg-white dark:bg-zinc-900/50",
        "border-slate-200 dark:border-white/10",
        clickable ? "hover:shadow-md hover:-translate-y-[1px] cursor-pointer" : "",
        "focus-within:shadow-md",
        className,
      ].join(" ")}
      aria-label={`Turma ${titulo}`}
      role={clickable ? "button" : "article"}
      tabIndex={clickable ? 0 : -1}
      onClick={clickable ? handleSelect : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelect();
              }
            }
          : undefined
      }
    >
      {/* barra superior por status (padrão premium) */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${status.bar}`} aria-hidden="true" />

      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* linha 1: título + status */}
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-extrabold text-slate-900 dark:text-white truncate">
              {titulo}
            </h4>

            <span
              className={[
                "text-[11px] px-2 py-0.5 rounded-full font-extrabold",
                "border border-black/5 dark:border-white/10",
                status.badge,
              ].join(" ")}
              aria-live="polite"
              role="status"
              title={status.texto}
            >
              {status.texto}
            </span>

            {/* fonte (debug-friendly mas discreta) */}
            {range?.fonte && range.fonte !== "campos" && range.fonte !== "indefinido" && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300 font-bold"
                title={`Derivado de: ${range.fonte}`}
              >
                {range.fonte}
              </span>
            )}
          </div>

          {/* linha 2: datas */}
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
            <CalendarDays size={16} aria-hidden="true" className="shrink-0 opacity-80" />
            <span className="truncate">
              {range.data_inicio ? formatarDataBrasileira(range.data_inicio) : "—"} –{" "}
              {range.data_fim ? formatarDataBrasileira(range.data_fim) : "—"}
            </span>
          </div>

          {/* linha 3: horário */}
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
            <Clock size={16} aria-hidden="true" className="shrink-0 opacity-80" />
            <span className="truncate">
              {ini} às {fim}
            </span>
          </div>
        </div>

        {/* CTA (mantém, mas card já é clicável) */}
        {clickable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSelect();
            }}
            className={[
              "shrink-0 inline-flex items-center justify-center",
              "rounded-xl px-3 py-2 text-sm font-extrabold text-white",
              "bg-emerald-600 hover:bg-emerald-700",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/60",
            ].join(" ")}
            aria-label={`Selecionar ${titulo}`}
            title="Selecionar"
            type="button"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </article>
  );
}

TurmaItem.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    data_inicio: PropTypes.string, // "YYYY-MM-DD"
    data_fim: PropTypes.string, // "YYYY-MM-DD"
    horario_inicio: PropTypes.string, // "HH:MM"
    horario_fim: PropTypes.string, // "HH:MM"
    encontros: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.string,
        inicio: PropTypes.string,
        fim: PropTypes.string,
      })
    ),
    datas: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.string,
        horario_inicio: PropTypes.string,
        horario_fim: PropTypes.string,
      })
    ),
  }).isRequired,
  onClick: PropTypes.func,
  className: PropTypes.string,
  ctaLabel: PropTypes.string,
};
