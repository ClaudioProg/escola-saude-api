// 📁 src/components/TurmaDatasFieldset.jsx
import { useId, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { Plus, Trash2, Copy } from "lucide-react";

/**
 * TurmaDatasFieldset (premium)
 * - Mantém compatibilidade: props value/onChange
 * - Mais resiliente: aceita value null/undefined
 * - Validação: horário (fim < início), campos incompletos, datas duplicadas
 * - UX: duplicar última linha, ordenação por data, mensagens por linha
 */
export default function TurmaDatasFieldset({
  value,
  onChange,
  className = "",
  confirmOnRemove = false, // opcional: confirma remoção
}) {
  const idBase = useId();

  /* ─────────────── helpers ─────────────── */

  // Normaliza "H", "HH", "H:MM", "HHMM", "8:0" etc → "HH:MM"
  const toHHMM = useCallback((raw) => {
    if (typeof raw !== "string") return "";
    const s = raw.trim();
    if (!s) return "";

    // "800" | "0800" etc
    if (/^\d{3,4}$/.test(s)) {
      const pad = s.length === 3 ? `0${s}` : s;
      const H = Math.min(23, parseInt(pad.slice(0, 2), 10));
      const M = Math.min(59, parseInt(pad.slice(2, 4), 10));
      return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
    }

    // "8" | "08" | "8:0" | "08:00" | "08:00:00"
    const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?\d{1,2})?$/);
    if (!m) return "";
    const H = Math.min(23, parseInt(m[1] || "0", 10));
    const M = Math.min(59, parseInt(m[2] || "0", 10));
    return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
  }, []);

  const toMinutes = useCallback((hhmm) => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ""));
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }, []);

  const isHorarioInvalido = useCallback(
    (ini, fim) => {
      const a = toMinutes(toHHMM(ini));
      const b = toMinutes(toHHMM(fim));
      return Number.isFinite(a) && Number.isFinite(b) && b < a; // fim deve ser ≥ ini
    },
    [toHHMM, toMinutes]
  );

  const normData = useCallback((v) => String(v || "").slice(0, 10), []);

  const setRows = useCallback(
    (next) => {
      const arr = Array.isArray(next) ? next : [];

      // normaliza campos e filtra lixo
      const normalized = arr.map((r) => ({
        data: normData(r?.data),
        horario_inicio: toHHMM(r?.horario_inicio || ""),
        horario_fim: toHHMM(r?.horario_fim || ""),
      }));

      // mantém pelo menos 1 linha
      const safe = normalized.length ? normalized : [{ data: "", horario_inicio: "", horario_fim: "" }];

      // ordena por data (estável o suficiente para UX)
      const sorted = [...safe].sort((a, b) => {
        const da = a.data || "9999-99-99";
        const db = b.data || "9999-99-99";
        return da.localeCompare(db);
      });

      onChange?.(sorted);
    },
    [normData, onChange, toHHMM]
  );

  /* ─────────────── rows (sempre pelo menos 1) ─────────────── */
  const rows = useMemo(() => {
    if (Array.isArray(value) && value.length > 0) return value;
    return [{ data: "", horario_inicio: "", horario_fim: "" }];
  }, [value]);

  /* ─────────────── duplicates map ─────────────── */
  const dupDates = useMemo(() => {
    const count = new Map();
    for (const r of rows) {
      const d = normData(r?.data);
      if (!d) continue;
      count.set(d, (count.get(d) || 0) + 1);
    }
    return count; // date -> qty
  }, [rows, normData]);

  /* ─────────────── mutations ─────────────── */

  const addRow = useCallback(() => {
    const base = Array.isArray(rows) ? rows : [];
    const last = base[base.length - 1] || {};
    setRows([
      ...base,
      {
        data: "",
        horario_inicio: toHHMM(last?.horario_inicio || ""),
        horario_fim: toHHMM(last?.horario_fim || ""),
      },
    ]);
  }, [rows, setRows, toHHMM]);

  const duplicateLast = useCallback(() => {
    const base = Array.isArray(rows) ? rows : [];
    const last = base[base.length - 1] || {};
    setRows([
      ...base,
      {
        data: "", // proposital: força escolher uma nova data (evita duplicação acidental)
        horario_inicio: toHHMM(last?.horario_inicio || ""),
        horario_fim: toHHMM(last?.horario_fim || ""),
      },
    ]);
  }, [rows, setRows, toHHMM]);

  const removeRow = useCallback(
    (idx) => {
      if (rows.length <= 1) return;

      if (confirmOnRemove) {
        const ok = window.confirm("Remover esta data da turma?");
        if (!ok) return;
      }

      const arr = [...rows];
      arr.splice(idx, 1);
      setRows(arr);
    },
    [rows, setRows, confirmOnRemove]
  );

  const updateRow = useCallback(
    (idx, field, v) => {
      const arr = [...rows];
      const nextVal =
        field === "horario_inicio" || field === "horario_fim"
          ? toHHMM(v)
          : normData(v);

      arr[idx] = { ...arr[idx], [field]: nextVal };
      setRows(arr);
    },
    [rows, setRows, toHHMM, normData]
  );

  const podeRemover = rows.length > 1;

  return (
    <fieldset className={`space-y-3 ${className}`}>
      <legend className="sr-only">Datas da turma</legend>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="font-extrabold text-sm text-gray-800 dark:text-gray-100">
            Datas da turma
            <span className="ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              ({rows.length} {rows.length > 1 ? "linhas" : "linha"})
            </span>
          </div>
          <div className="text-[12px] text-gray-500 dark:text-gray-400">
            Cadastre as datas e horários. Evite datas duplicadas (o sistema alerta).
          </div>
        </div>

        <div className="flex items-center gap-2 justify-start sm:justify-end">
          <button
            type="button"
            onClick={duplicateLast}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-zinc-900/35 dark:text-zinc-200 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            title="Duplicar último horário (data em branco)"
          >
            <Copy size={16} />
            Duplicar horário
          </button>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            title="Adicionar nova data"
          >
            <Plus size={16} />
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const dataId = `${idBase}-data-${i}`;
          const iniId = `${idBase}-ini-${i}`;
          const fimId = `${idBase}-fim-${i}`;
          const msgId = `${idBase}-msg-${i}`;

          const dataVal = normData(row?.data);
          const iniVal = toHHMM(row?.horario_inicio || "");
          const fimVal = toHHMM(row?.horario_fim || "");

          const invalidHora = isHorarioInvalido(iniVal, fimVal);
          const incomplete =
            (!!dataVal && (!iniVal || !fimVal)) || (!!iniVal || !!fimVal) && !dataVal;

          const dup = dataVal && (dupDates.get(dataVal) || 0) > 1;

          // mensagem prioriza o erro mais grave
          const msg =
            invalidHora
              ? "O término deve ser maior ou igual ao início."
              : incomplete
              ? "Preencha data, início e fim."
              : dup
              ? "Data duplicada: verifique se não repetiu o dia."
              : "";

          const isInvalid = !!msg;

          return (
            <div
              key={`${idBase}-${i}`}
              className={[
                "rounded-2xl border p-3 sm:p-4",
                "bg-white dark:bg-zinc-900/40",
                isInvalid
                  ? "border-rose-300/70 dark:border-rose-500/30"
                  : "border-gray-200 dark:border-zinc-700",
              ].join(" ")}
            >
              <div className="grid grid-cols-12 gap-2 items-end">
                {/* Data */}
                <div className="col-span-12 sm:col-span-4">
                  <label htmlFor={dataId} className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Data
                  </label>
                  <input
                    id={dataId}
                    type="date"
                    className={[
                      "w-full rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white",
                      "border focus:outline-none focus:ring-2",
                      isInvalid ? "border-rose-300 focus:ring-rose-500/30" : "border-gray-300 dark:border-zinc-600 focus:ring-emerald-500/40",
                    ].join(" ")}
                    value={dataVal}
                    onChange={(e) => updateRow(i, "data", e.target.value)}
                    required
                    aria-invalid={isInvalid}
                    aria-describedby={isInvalid ? msgId : undefined}
                  />
                </div>

                {/* Início */}
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor={iniId} className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Início
                  </label>
                  <input
                    id={iniId}
                    type="time"
                    step={300}
                    className={[
                      "w-full rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white",
                      "border focus:outline-none focus:ring-2",
                      isInvalid ? "border-rose-300 focus:ring-rose-500/30" : "border-gray-300 dark:border-zinc-600 focus:ring-emerald-500/40",
                    ].join(" ")}
                    value={iniVal}
                    onChange={(e) => updateRow(i, "horario_inicio", e.target.value)}
                    required
                    aria-invalid={isInvalid}
                    aria-describedby={isInvalid ? msgId : undefined}
                  />
                </div>

                {/* Fim */}
                <div className="col-span-6 sm:col-span-3">
                  <label htmlFor={fimId} className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Fim
                  </label>
                  <input
                    id={fimId}
                    type="time"
                    step={300}
                    className={[
                      "w-full rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white",
                      "border focus:outline-none focus:ring-2",
                      isInvalid ? "border-rose-300 focus:ring-rose-500/30" : "border-gray-300 dark:border-zinc-600 focus:ring-emerald-500/40",
                    ].join(" ")}
                    value={fimVal}
                    onChange={(e) => updateRow(i, "horario_fim", e.target.value)}
                    required
                    aria-invalid={isInvalid}
                    aria-describedby={isInvalid ? msgId : undefined}
                  />
                </div>

                {/* Remover */}
                <div className="col-span-12 sm:col-span-2 flex">
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className={[
                      "ml-auto inline-flex items-center justify-center gap-2",
                      "px-3 py-2 rounded-xl border text-sm font-bold",
                      "border-rose-300 text-rose-700 hover:bg-rose-50",
                      "dark:border-rose-500/30 dark:text-rose-200 dark:hover:bg-rose-500/10",
                      "focus:outline-none focus:ring-2 focus:ring-rose-500/30",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    ].join(" ")}
                    disabled={!podeRemover}
                    title={podeRemover ? "Remover esta data" : "Mantenha ao menos uma data"}
                    aria-disabled={!podeRemover}
                  >
                    <Trash2 size={16} />
                    Remover
                  </button>
                </div>

                {/* Mensagem */}
                {isInvalid && (
                  <p
                    id={msgId}
                    className="col-span-12 text-xs font-semibold text-rose-600 dark:text-rose-300 mt-1"
                    aria-live="polite"
                  >
                    {msg}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

TurmaDatasFieldset.propTypes = {
  value: PropTypes.arrayOf(
    PropTypes.shape({
      data: PropTypes.string, // "YYYY-MM-DD"
      horario_inicio: PropTypes.string, // "HH:MM"
      horario_fim: PropTypes.string, // "HH:MM"
    })
  ),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  confirmOnRemove: PropTypes.bool,
};
