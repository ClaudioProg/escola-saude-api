// frontend/src/components/ListaTurmasEvento.jsx
/* eslint-disable no-console */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { CalendarDays, Clock3 } from "lucide-react";

/* ========================== Helpers ========================== */

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

const toPct = (num, den) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  return d <= 0 ? 0 : clamp(Math.round((n / d) * 100));
};

const pad = (s) => (typeof s === "string" ? s.padStart(2, "0") : s);

// "0800" → "08:00"; "8:0" → "08:00"; "08:00:00" → "08:00"
const parseHora = (val) => {
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s) return null;

  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const H = raw.slice(0, 2);
    const M = raw.slice(2, 4);
    const hh = String(Math.min(23, Math.max(0, parseInt(H || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(M || "0", 10)))).padStart(2, "0");
    return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
  }

  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return null;
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  const hh = String(H).padStart(2, "0");
  const mm = String(M).padStart(2, "0");
  return hh === "00" && mm === "00" ? null : `${hh}:${mm}`;
};

// YYYY-MM-DD (LOCAL) a partir de Date/ISO/"YYYY-MM-DD"/obj {data}
const ymdLocal = (d) => {
  if (!(d instanceof Date)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const isoDiaLocal = (v) => {
  if (!v) return "";
  if (typeof v === "object" && v.data) {
    if (v.data instanceof Date) return ymdLocal(v.data);
    if (typeof v.data === "string") return v.data.slice(0, 10);
  }
  if (v instanceof Date) return ymdLocal(v);
  if (typeof v === "string") return v.slice(0, 10);
  const dt = new Date(v);
  return Number.isNaN(+dt) ? "" : ymdLocal(dt);
};

const br = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Se todos os encontros tiverem o mesmo hi/hf, retorna; senão null
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

const toDateLocal = (dateOnly, hhmm = "00:00") => {
  if (!dateOnly) return null;
  const [h, m] = (hhmm || "00:00").split(":").map((x) => parseInt(x || "0", 10));
  const [Y, M, D] = dateOnly.split("-").map((x) => parseInt(x, 10));
  return new Date(Y, (M || 1) - 1, D || 1, Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
};

const getStatusPorJanela = ({ di, df, hi, hf, agora = new Date() }) => {
  const start = toDateLocal(di, hi || "00:00");
  const end = toDateLocal(df, hf || "23:59");
  if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) return "Programado";
  if (agora < start) return "Programado";
  if (agora > end) return "Encerrado";
  return "Em andamento";
};

/* ======================== Componente ======================== */

export default function ListaTurmasEvento({
  turmas = [],
  eventoId,
  eventoTipo = "",
  hoje = new Date(),
  inscricoesConfirmadas = [],
  inscrever,
  inscrevendo,
  jaInscritoNoEvento = false,
  jaInstrutorDoEvento = false,
  mostrarStatusTurma = true,
}) {
  const isCongresso = (eventoTipo || "").toLowerCase() === "congresso";
  const jaInscritoTurma = (tid) => inscricoesConfirmadas.includes(Number(tid));

  // (mantido pra futura expansão se quiser abrir/fechar blocos)
  const [expand, setExpand] = useState({});
  const toggleExpand = (id) => setExpand((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div id={`turmas-${eventoId}`} className="mt-4 space-y-4">
      {(turmas || []).map((t) => {
        const jaInscrito = jaInscritoTurma(t.id);

        // bloquear outras turmas se não for congresso
        const bloquearOutras = !isCongresso && jaInscritoNoEvento && !jaInscrito;

        // preenchidas → vários fallbacks
        const preenchidas = Number(t?.vagas_preenchidas ?? t?.inscritos_confirmados ?? t?.inscritos) || 0;
        const inscritos = jaInscrito && preenchidas === 0 ? 1 : preenchidas;

        const vagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
        const perc = toPct(inscritos, vagas);

        const di = (t.data_inicio || "").slice(0, 10);
        const df = (t.data_fim || "").slice(0, 10);

        // Encontros: aceita vários formatos
        const encontrosInline =
          (Array.isArray(t.encontros) && t.encontros.length ? t.encontros : null) ||
          (Array.isArray(t.datas) && t.datas.length ? t.datas : null) ||
          (Array.isArray(t._datas) && t._datas.length ? t._datas : null);

        const encontros = (encontrosInline || []).map((d) => isoDiaLocal(d)).filter(Boolean);
        const encontrosOrdenados = [...encontros].sort(); // YYYY-MM-DD ordena lexicograficamente
        const qtdEncontros = encontrosOrdenados.length;

        // Horários reais (turma > encontros consistentes > indefinido)
        const { hi: hiEncontros, hf: hfEncontros } = extrairHorasDeEncontros(encontrosInline);
        const hi = parseHora(t.horario_inicio) || hiEncontros || null;
        const hf = parseHora(t.horario_fim) || hfEncontros || null;

        const lotada = vagas > 0 && inscritos >= vagas;
        const carregando = Number(inscrevendo) === Number(t.id);

        const statusTurma = getStatusPorJanela({ di, df, hi, hf, agora: hoje });

        const bloqueadoPorInstrutor = Boolean(jaInstrutorDoEvento);
        const disabled = bloqueadoPorInstrutor || carregando || jaInscrito || lotada || bloquearOutras;

        const motivo =
          (bloqueadoPorInstrutor && "Você é instrutor deste evento") ||
          (jaInscrito && "Você já está inscrito nesta turma") ||
          (bloquearOutras && "Você já está inscrito em uma turma deste evento") ||
          (lotada && "Turma lotada") ||
          "";

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
                    {hi && hf ? <>Horário: {hi} às {hf}</> : <>Horário: a definir</>}
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

              {/* Chip: Lotada tem prioridade; senão, mostra status real quando permitido */}
              {(lotada || mostrarStatusTurma) && (
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    lotada
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800"
                      : statusTurma === "Em andamento"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
                      : statusTurma === "Encerrado"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800"
                      : "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700"
                  }`}
                >
                  {lotada ? "Lotada" : statusTurma}
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
              <div className="h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
                <div className="h-2 bg-emerald-500 dark:bg-emerald-600" style={{ width: `${perc}%` }} />
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
                aria-disabled={disabled}
                title={motivo}
                className={[
                  "w-full sm:w-auto px-5 py-2 rounded-lg font-semibold transition",
                  "min-w-[180px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500",
                  disabled
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                    : "bg-lousa text-white hover:opacity-90",
                ].join(" ")}
                aria-label={
                  jaInstrutorDoEvento
                    ? "Você é instrutor do evento"
                    : jaInscrito
                    ? "Inscrito nesta turma"
                    : lotada
                    ? "Turma sem vagas"
                    : bloquearOutras
                    ? "Inscrição indisponível (já inscrito em outra turma do evento)"
                    : "Inscrever-se na turma"
                }
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

/* ======================== PropTypes ======================== */
ListaTurmasEvento.propTypes = {
  turmas: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    nome: PropTypes.string,
    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,
    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,
    vagas_total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    vagas_preenchidas: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    inscritos_confirmados: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    inscritos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    encontros: PropTypes.array, // strings "YYYY-MM-DD" ou objetos {data,inicio/fim}
    datas: PropTypes.array,
    _datas: PropTypes.array,
  })),
  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  eventoTipo: PropTypes.string,
  hoje: PropTypes.instanceOf(Date),
  inscricoesConfirmadas: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  inscrever: PropTypes.func,
  inscrevendo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  jaInscritoNoEvento: PropTypes.bool,
  jaInstrutorDoEvento: PropTypes.bool,
  mostrarStatusTurma: PropTypes.bool,
};
