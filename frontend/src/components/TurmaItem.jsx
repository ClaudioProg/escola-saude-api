// 📁 src/components/TurmaItem.jsx
import PropTypes from "prop-types";
import { CalendarDays, Clock } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data"; // use sempre seu utilitário

/* ───────────────── helpers ───────────────── */

const toHHMM = (raw, fb = "") => {
  if (!raw && raw !== 0) return fb;
  const s = String(raw).trim();
  if (!s) return fb;

  // "800" | "08:00" | "8:0" | "08:00:00"
  if (/^\d{3,4}$/.test(s)) {
    const pad = s.length === 3 ? "0" + s : s;
    const H = Math.min(23, +pad.slice(0, 2));
    const M = Math.min(59, +pad.slice(2, 4));
    return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
  }
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?/);
  if (!m) return fb;
  const H = Math.min(23, parseInt(m[1] || "0", 10));
  const M = Math.min(59, parseInt(m[2] || "0", 10));
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};

const diaISO = (v) => (typeof v === "string" ? v.slice(0, 10) : "");

function agoraYMDHM() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** Extrai um range coerente da turma:
 *  - 1º tenta data_inicio/data_fim + horários
 *  - 2º tenta encontros (data/inicio/fim)
 *  - 3º tenta datas (data/horario_inicio/horario_fim)
 */
function derivarRangeTurma(t) {
  const hi = toHHMM(t?.horario_inicio, "00:00");
  const hf = toHHMM(t?.horario_fim, "23:59");
  const di = diaISO(t?.data_inicio);
  const df = diaISO(t?.data_fim);

  if (di && df) {
    return {
      data_inicio: di,
      data_fim: df,
      horario_inicio: hi,
      horario_fim: hf,
      fonte: "campos",
    };
  }

  // tenta encontros
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
      return {
        data_inicio: ordenados[0].d,
        data_fim: ordenados.at(-1).d,
        horario_inicio: ordenados[0].hi || hi,
        horario_fim: ordenados[0].hf || hf,
        fonte: "encontros",
      };
    }
  }

  // tenta datas
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
      return {
        data_inicio: ordenados[0].d,
        data_fim: ordenados.at(-1).d,
        horario_inicio: ordenados[0].hi || hi,
        horario_fim: ordenados[0].hf || hf,
        fonte: "datas",
      };
    }
  }

  return {
    data_inicio: "",
    data_fim: "",
    horario_inicio: "",
    horario_fim: "",
    fonte: "indefinido",
  };
}

function compStatus(turma) {
  const range = derivarRangeTurma(turma);
  const start = `${range.data_inicio || ""} ${toHHMM(range.horario_inicio, "00:00")}`;
  const end = `${range.data_fim || ""} ${toHHMM(range.horario_fim, "23:59")}`;
  const now = agoraYMDHM();

  if (!range.data_inicio || !range.data_fim) {
    return {
      texto: "—",
      cls: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200",
    };
  }

  if (now < start) {
    // Programado → VERDE (preferência do Cláudio)
    return {
      texto: "Programado",
      cls: "bg-green-100 text-green-800 dark:bg-green-600/30 dark:text-green-300",
    };
  }
  if (now > end) {
    // Encerrado → VERMELHO
    return {
      texto: "Encerrado",
      cls: "bg-red-100 text-red-700 dark:bg-red-700/30 dark:text-red-300",
    };
  }
  // Em andamento → AMARELO
  return {
    texto: "Em andamento",
    cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-600/30 dark:text-yellow-200",
  };
}

/* ───────────────── componente ───────────────── */

export default function TurmaItem({ turma, onClick, className = "" }) {
  const { texto: statusTxt, cls: statusCls } = compStatus(turma);

  // o que mostrar na linha de horário (prioriza campos da turma; cai para 1º encontro/datas)
  const range = derivarRangeTurma(turma);
  const ini = toHHMM(turma?.horario_inicio || range.horario_inicio || "", "—:—");
  const fim = toHHMM(turma?.horario_fim || range.horario_fim || "", "—:—");

  const titulo = turma.nome || `Turma ${turma.id}`;

  return (
    <div
      className={`flex items-center justify-between bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg p-3 mb-2 shadow-sm hover:shadow transition ${className}`}
      aria-label={`Turma ${titulo}`}
      role="article"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-lousa dark:text-white truncate">{titulo}</h4>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${statusCls}`}
            aria-live="polite"
            role="status"
          >
            {statusTxt}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1">
          <CalendarDays size={16} aria-hidden="true" />
          <span className="truncate">
            {range.data_inicio ? formatarDataBrasileira(range.data_inicio) : "—"} –{" "}
            {range.data_fim ? formatarDataBrasileira(range.data_fim) : "—"}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
          <Clock size={16} aria-hidden="true" />
          <span className="truncate">
            {ini} às {fim}
          </span>
        </div>
      </div>

      {onClick && (
        <button
          onClick={() => onClick(turma)}
          className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition focus:outline-none focus:ring-2 focus:ring-green-700/40 ml-3 shrink-0"
          aria-label={`Selecionar ${titulo}`}
          title="Selecionar"
          type="button"
        >
          Selecionar
        </button>
      )}
    </div>
  );
}

TurmaItem.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    nome: PropTypes.string,
    data_inicio: PropTypes.string,     // "YYYY-MM-DD"
    data_fim: PropTypes.string,        // "YYYY-MM-DD"
    horario_inicio: PropTypes.string,  // "HH:MM"
    horario_fim: PropTypes.string,     // "HH:MM"
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
  onClick: PropTypes.func, // recebe a turma
  className: PropTypes.string,
};
