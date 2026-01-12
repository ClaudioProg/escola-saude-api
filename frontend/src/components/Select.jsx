// 📁 src/components/Select.jsx
import { useId, useMemo } from "react";
import PropTypes from "prop-types";
import { ChevronDown, Loader2, X } from "lucide-react";

const SIZE_CLS = {
  sm: { pad: "py-1.5 pl-3 pr-10", text: "text-sm", clear: "px-2 py-1 text-xs" },
  md: { pad: "py-2 pl-3 pr-10",   text: "text-sm", clear: "px-2.5 py-1.5 text-xs" },
  lg: { pad: "py-3 pl-3.5 pr-11", text: "text-base", clear: "px-3 py-1.5 text-sm" },
};

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function isNumericString(v) {
  // aceita inteiros/decimais com sinal, sem espaços
  // "01" fica como string, por segurança (evita coerção inesperada)
  const s = String(v);
  if (!/^-?\d+(\.\d+)?$/.test(s)) return false;
  if (/^0\d+/.test(s)) return false;
  return true;
}

export default function Select({
  label = "Selecionar",
  options = [],
  value,
  onChange,
  placeholder = "Todos",
  disabled = false,
  required = false,
  error = "",
  helpText = "",
  isLoading = false,
  className = "",
  name,
  size = "md",
  clearable = false,
  onClear,
  nullable = true, // se false, não mostra placeholder como opção
  coerceNumber = false,
  autoFocus = false,
  onBlur,
  onFocus,
  "data-testid": testId = "select",

  // extras premium (opcionais)
  leadingIcon,         // ReactNode
  floatingLabel = false,
  rounded = "2xl",     // "md" | "xl" | "2xl"
}) {
  const uid = useId();
  const sz = SIZE_CLS[size] || SIZE_CLS.md;

  const selectId = `select-${uid}`;
  const descId = `select-desc-${uid}`;

  // Normaliza opções:
  // - aceita strings, numbers
  // - aceita objetos { id/value, nome/label/descricao, key, disabled }
  // - aceita grupos: { group: "Nome do grupo", options: [...] }
  const normOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];

    const normalizeItem = (opt, idx) => {
      if (opt == null) return { key: `null-${idx}`, value: "", label: "—" };

      if (typeof opt === "string" || typeof opt === "number") {
        return { key: `${String(opt)}-${idx}`, value: opt, label: String(opt) };
      }

      if (opt.group && Array.isArray(opt.options)) {
        return {
          group: String(opt.group),
          options: opt.options.map((o, j) => normalizeItem(o, j)),
        };
      }

      const rawVal = opt.id ?? opt.value ?? "";
      const lab =
        opt.nome ?? opt.label ?? opt.descricao ?? String(rawVal || "Sem descrição");
      const key = opt.key ?? rawVal ?? `opt-${idx}`;

      return {
        key,
        value: rawVal,
        label: lab,
        disabled: !!opt.disabled,
      };
    };

    return options.map(normalizeItem);
  }, [options]);

  const hasOptions = normOptions.length > 0;
  const isDisabled = disabled || isLoading || !hasOptions;

  const showPlaceholderOption = nullable !== false;

  const hasGroups = normOptions.some((o) => o?.group && Array.isArray(o.options));

  const coerce = (v) => {
    if (!coerceNumber) return v;
    if (v === "" || v === null || v === undefined) return "";
    return isNumericString(v) ? Number(v) : v;
  };

  const handleChange = (e) => onChange?.(coerce(e.target.value));

  const showClear = clearable && (value ?? "") !== "" && !isDisabled;

  const radius =
    rounded === "md" ? "rounded-md" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  const describedBy = helpText || error ? descId : undefined;

  return (
    <div
      className={cx("flex flex-col w-full", className)}
      role="group"
      aria-label={`Campo de seleção: ${label}`}
      data-testid={testId}
    >
      {/* Label normal (quando não flutuante) */}
      {label && !floatingLabel && (
        <label htmlFor={selectId} className="mb-1 text-sm font-extrabold text-zinc-900 dark:text-white">
          {label}
          {required ? <span className="text-rose-600 dark:text-rose-300"> *</span> : null}
        </label>
      )}

      <div className="flex items-stretch gap-2">
        <div className="relative w-full">
          {/* leading icon */}
          {leadingIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-300 pointer-events-none">
              {leadingIcon}
            </div>
          )}

          {/* floating label */}
          {label && floatingLabel && (
            <label
              htmlFor={selectId}
              className={cx(
                "absolute left-3 z-10 px-1",
                "text-[11px] font-extrabold",
                "bg-white/90 dark:bg-zinc-900/70",
                "text-zinc-600 dark:text-zinc-300",
                "top-0 -translate-y-1/2",
                leadingIcon ? "ml-7" : ""
              )}
            >
              {label}
              {required ? <span className="text-rose-600 dark:text-rose-300"> *</span> : null}
            </label>
          )}

          <select
            id={selectId}
            name={name}
            value={value ?? ""}
            onChange={handleChange}
            onBlur={onBlur}
            onFocus={onFocus}
            disabled={isDisabled}
            required={required}
            autoFocus={autoFocus}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-busy={isLoading ? "true" : undefined}
            className={cx(
              "w-full appearance-none transition",
              radius,
              "border bg-white/90 dark:bg-zinc-900/60 dark:text-white",
              "shadow-[0_14px_45px_-40px_rgba(0,0,0,0.55)]",
              "ring-1 ring-black/5 dark:ring-white/10",
              sz.pad,
              sz.text,
              leadingIcon ? "pl-10" : "",
              isDisabled
                ? "border-zinc-200 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                : "border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
              error ? "border-rose-500 focus:ring-rose-500/40" : ""
            )}
          >
            {showPlaceholderOption && (
              <option value="">
                {isLoading ? "Carregando..." : placeholder}
              </option>
            )}

            {!hasGroups ? (
              hasOptions ? (
                normOptions.map((opt) =>
                  "group" in opt ? null : (
                    <option key={opt.key} value={String(opt.value)} disabled={opt.disabled}>
                      {opt.label}
                    </option>
                  )
                )
              ) : (
                !isLoading && <option disabled>Nenhuma opção disponível</option>
              )
            ) : (
              normOptions.map((groupOrOpt, gi) =>
                groupOrOpt?.group ? (
                  <optgroup key={`g-${gi}`} label={groupOrOpt.group}>
                    {groupOrOpt.options.map((opt, oi) => (
                      <option
                        key={opt.key ?? `g-${gi}-o-${oi}`}
                        value={String(opt.value)}
                        disabled={opt.disabled}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ) : (
                  <option
                    key={groupOrOpt.key ?? `o-${gi}`}
                    value={String(groupOrOpt.value)}
                    disabled={groupOrOpt.disabled}
                  >
                    {groupOrOpt.label}
                  </option>
                )
              )
            )}
          </select>

          {/* right icon: spinner or chevron */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 dark:text-zinc-300">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </div>
        </div>

        {/* clear button */}
        {showClear && (
          <button
            type="button"
            onClick={() => {
              onChange?.(coerce(""));
              onClear?.();
            }}
            className={cx(
              radius,
              "shrink-0 inline-flex items-center gap-1.5",
              "border border-zinc-300 dark:border-white/10",
              "bg-white/90 hover:bg-zinc-50 dark:bg-zinc-900/60 dark:hover:bg-white/10",
              "text-zinc-800 dark:text-zinc-100",
              "font-extrabold",
              "shadow-sm",
              sz.clear
            )}
            title="Limpar seleção"
            aria-label="Limpar seleção"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {(helpText || error) && (
        <p
          id={descId}
          className={cx(
            "mt-1 text-[12px]",
            error ? "text-rose-700 dark:text-rose-300" : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          {error || helpText}
        </p>
      )}
    </div>
  );
}

Select.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        nome: PropTypes.string,
        label: PropTypes.string,
        descricao: PropTypes.string,
        key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        disabled: PropTypes.bool,
      }),
      PropTypes.shape({
        group: PropTypes.string.isRequired,
        options: PropTypes.array.isRequired,
      }),
      PropTypes.string,
      PropTypes.number,
    ])
  ),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
  error: PropTypes.string,
  helpText: PropTypes.string,
  isLoading: PropTypes.bool,
  className: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  clearable: PropTypes.bool,
  onClear: PropTypes.func,
  nullable: PropTypes.bool,
  coerceNumber: PropTypes.bool,
  autoFocus: PropTypes.bool,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  "data-testid": PropTypes.string,

  leadingIcon: PropTypes.node,
  floatingLabel: PropTypes.bool,
  rounded: PropTypes.oneOf(["md", "xl", "2xl"]),
};
