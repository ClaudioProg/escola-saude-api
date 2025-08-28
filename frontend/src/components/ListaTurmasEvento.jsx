// frontend/src/components/ListaTurmasEvento.jsx
/* eslint-disable no-console */
import React, { useState, useMemo } from "react";
import { CalendarDays, Clock3 } from "lucide-react";

// Helpers simples
const toPct = (num, den) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  if (d <= 0) return 0;
  const v = Math.round((n / d) * 100);
  return Math.max(0, Math.min(100, v));
};

const pad = (s) => (typeof s === "string" ? s.padStart(2, "0") : s);

// Retorna "HH:MM" válida OU null (sem fallback!)
const parseHora = (val) => {
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;

  // "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const H = raw.slice(0, 2);
    const M = raw.slice(2, 4);
    const hh = String(Math.min(23, Math.max(0, parseInt(H || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(M || "0", 10)))).padStart(2, "0");
    return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
  }

  // "08:00", "8:0", "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return null;
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  const hh = String(H).padStart(2, "0");
  const mm = String(M).padStart(2, "0");
  return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
};

// Datas: aceita Date, ISO, "YYYY-MM-DD" ou objeto {data, inicio, fim, horario_inicio, horario_fim}
const isoDia = (v) => {
  if (!v) return "";
  if (typeof v === "object" && v.data) {
    if (v.data instanceof Date) return v.data.toISOString().slice(0, 10);
    if (typeof v.data === "string") return v.data.slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  try { return new Date(v).toISOString().slice(0, 10); } catch { return ""; }
};

const br = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Se todos os encontros tiverem o mesmo hi e/ou hf, retorna esses valores; caso contrário, null
const extrairHorasDeEncontros = (encontrosInline) => {
  const his = new Set();
  const hfs = new Set();

  (encontrosInline || []).forEach((e) => {
    const hi = parseHora(
      (typeof e === "object" && (e.inicio || e.horario_inicio)) || (typeof e === "string" ? null : undefined)
    );
    const hf = parseHora(
      (typeof e === "object" && (e.fim || e.horario_fim)) || (typeof e === "string" ? null : undefined)
    );
    if (hi) his.add(hi);
    if (hf) hfs.add(hf);
  });

  return {
    hi: his.size === 1 ? [...his][0] : null,
    hf: hfs.size === 1 ? [...hfs][0] : null,
  };
};

export default function ListaTurmasEvento({
  turmas = [],
  eventoId,
  eventoTipo = "",               // 👈 novo: precisamos saber se é congresso
  hoje = new Date(),
  inscricoesConfirmadas = [],    // array de ids de turmas em que o usuário está inscrito
  inscrever,
  inscrevendo,
  jaInscritoNoEvento = false,    // 👈 já tem inscrição em alguma turma deste evento?
  jaInstrutorDoEvento = false,   // 👈 não pode inscrever-se como participante
  /** 👇 quando false, esconde o chip interno de status da turma */
  mostrarStatusTurma = true,
}) {
  const isCongresso = (eventoTipo || "").toLowerCase() === "congresso";
  const jaInscritoTurma = (tid) => inscricoesConfirmadas.includes(Number(tid));

  const [expand, setExpand] = useState({});
  const toggleExpand = (id) => setExpand((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div id={`turmas-${eventoId}`} className="mt-4 space-y-4">
      {(turmas || []).map((t) => {
        const jaInscrito = jaInscritoTurma(t.id);

        // quando não for congresso e o usuário já tem inscrição em outra turma do evento,
        // bloquear as demais (exceto a própria onde ele já está inscrito)
        const bloquearOutras = !isCongresso && jaInscritoNoEvento && !jaInscrito;

        // usa o fallback completo
const preenchidas = Number(
  t?.vagas_preenchidas ?? t?.inscritos_confirmados ?? t?.inscritos
) || 0;

// se o usuário já está inscrito mas o backend ainda não marcou, força pelo menos 1
const inscritos = jaInscrito && preenchidas === 0 ? 1 : preenchidas;

const vagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
const perc = toPct(inscritos, vagas);

        const di = (t.data_inicio || "").slice(0, 10);
        const df = (t.data_fim || "").slice(0, 10);

        // Encontros vindos do backend (diversos formatos)
        const encontrosInline =
          (Array.isArray(t.encontros) && t.encontros.length ? t.encontros : null) ||
          (Array.isArray(t.datas) && t.datas.length ? t.datas : null) ||
          (Array.isArray(t._datas) && t._datas.length ? t._datas : null);

        const encontros = (encontrosInline || []).map((d) => isoDia(d)).filter(Boolean);
        const qtdEncontros = encontros.length;

        const { hi: hiEncontros, hf: hfEncontros } = extrairHorasDeEncontros(encontrosInline);

        // Horas reais (turma > encontros consistentes > indefinido)
        const hi = parseHora(t.horario_inicio) || hiEncontros || null;
        const hf = parseHora(t.horario_fim)   || hfEncontros || null;

        const lotada = vagas > 0 && inscritos >= vagas;
        const carregando = Number(inscrevendo) === Number(t.id);

        const bloqueadoPorInstrutor = Boolean(jaInstrutorDoEvento);
        const disabled =
          bloqueadoPorInstrutor || carregando || jaInscrito || lotada || bloquearOutras;

        const motivo =
          (bloqueadoPorInstrutor && "Você é instrutor deste evento") ||
          (jaInscrito && "Você já está inscrito nesta turma") ||
          (bloquearOutras && "Você já está inscrito em uma turma deste evento") ||
          (lotada && "Turma lotada") ||
          "";

        const encontrosOrdenados = useMemo(
          () => [...encontros].filter(Boolean).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
          // eslint-disable-next-line react-hooks/exhaustive-deps
          [JSON.stringify(encontros)]
        );

        return (
          <div
            key={t.id || `${t.nome || "Turma"}-${di}-${hi || "??"}`}
            className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-neutral-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold text-lousa dark:text-white mb-1">
                  {t.nome || "Turma"}
                </h4>

                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {di && df ? (
                      <>
                        {di.split("-").reverse().map(pad).join("/")} a{" "}
                        {df.split("-").reverse().map(pad).join("/")}
                      </>
                    ) : (
                      "Data a definir"
                    )}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>
                    {hi && hf ? (
                      <>Horário: {hi} às {hf}</>
                    ) : (
                      <>Horário: a definir</>
                    )}
                  </span>
                </div>

                {Number.isFinite(Number(t.carga_horaria)) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Carga horária: {Number(t.carga_horaria)}h
                  </p>
                )}

                {/* Encontros (datas_turma) */}
                <div className="mt-2 text-center">
                  {qtdEncontros > 0 ? (
                    <>
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        {qtdEncontros} encontro{qtdEncontros > 1 ? "s" : ""}:
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {encontrosOrdenados.map((d, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs rounded-full 
                                       bg-indigo-50 text-indigo-700 border border-indigo-200
                                       dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-700"
                          >
                            {br(d)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <span className="opacity-70 text-xs">
                      Cronograma por encontros ainda não definido
                    </span>
                  )}
                </div>
              </div>

              {/* Chip interno de status da TURMA */}
              {(lotada || mostrarStatusTurma) && (
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    lotada
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  {lotada ? "Lotada" : "Programado"}
                </span>
              )}
            </div>

            {/* Barra de vagas */}
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>
                  {inscritos} de {vagas || 0} vagas preenchidas
                </span>
                <span>{perc}%</span>
              </div>
              <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-2 bg-emerald-500 dark:bg-emerald-600"
                  style={{ width: `${perc}%` }}
                />
              </div>
            </div>

            {/* CTA centralizado */}
            <div className="mt-4 flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  if (disabled) return;
                  if (jaInstrutorDoEvento) return;
                  inscrever?.(t.id);
                }}
                disabled={disabled}
                title={motivo}
                className={[
                  "w-full sm:w-auto px-5 py-2 rounded-lg font-semibold transition",
                  "min-w-[180px]",
                  disabled
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                    : "bg-lousa text-white hover:opacity-90",
                ].join(" ")}
              >
                {carregando
                  ? "Processando..."
                  : jaInstrutorDoEvento
                  ? "Instrutor do evento"
                  : jaInscrito
                  ? "Inscrito"
                  : bloquearOutras
                  ? "Indisponível"
                  : lotada
                  ? "Sem vagas"
                  : "Inscrever-se"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
