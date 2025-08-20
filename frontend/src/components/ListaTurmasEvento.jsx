// ✅ src/components/ListaTurmasEvento.jsx
/* eslint-disable no-console */
import React from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import BotaoPrimario from "./BotaoPrimario";

// Helpers simples
const toPct = (num, den) => {
  const n = Number(num) || 0;
  const d = Number(den) || 0;
  if (d <= 0) return 0;
  const v = Math.round((n / d) * 100);
  return Math.max(0, Math.min(100, v));
};

const pad = (s) => (typeof s === "string" ? s.padStart(2, "0") : s);
const hhmm = (s) => (typeof s === "string" ? s.slice(0, 5) : "");

export default function ListaTurmasEvento({
  turmas = [],
  eventoId,
  hoje = new Date(),
  inscricoesConfirmadas = [],
  inscrever,
  inscrevendo,
  jaInscritoNoEvento = false,
  jaInstrutorDoEvento = false,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
}) {
  const jaInscritoTurma = (tid) => inscricoesConfirmadas.includes(Number(tid));

  return (
    <div id={`turmas-${eventoId}`} className="mt-4 space-y-4">
      {(turmas || []).map((t) => {
        // ⚠️ calcule primeiro se o usuário já está inscrito nesta turma
        const jaInscrito = jaInscritoTurma(t.id);

        // ✅ normaliza contador vindo do backend + fallback local (exibe pelo menos 1)
        const inscritosBrutos = t?.inscritos ?? t?.qtd_inscritos ?? t?.total_inscritos;
        let inscritos = Number.isFinite(Number(inscritosBrutos)) ? Number(inscritosBrutos) : 0;
        if (jaInscrito && inscritos === 0) inscritos = 1;

        const vagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0;
        const perc = toPct(inscritos, vagas);

        const di = (t.data_inicio || "").slice(0, 10);
        const df = (t.data_fim || "").slice(0, 10);

        const hi = hhmm(t.horario_inicio || "00:00");
        const hf = hhmm(t.horario_fim || "23:59");

        const lotada = vagas > 0 && inscritos >= vagas;
        const carregando = Number(inscrevendo) === Number(t.id);

        // 🔒 Regra principal: instrutor não pode inscrever-se
        const bloqueadoPorInstrutor = Boolean(jaInstrutorDoEvento);

        // Outros bloqueios de UX
        const disabled = bloqueadoPorInstrutor || carregando || jaInscrito || lotada;

        // Mensagem de tooltip
        const motivo =
          (bloqueadoPorInstrutor && "Você é instrutor deste evento") ||
          (jaInscrito && "Você já está inscrito nesta turma") ||
          (lotada && "Turma lotada") ||
          "";

        return (
          <div
            key={t.id || `${t.nome}-${di}-${hi}`}
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
                    Horário: {hi} às {hf}
                  </span>
                </div>

                {Number.isFinite(Number(t.carga_horaria)) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Carga horária: {Number(t.carga_horaria)}h
                  </p>
                )}
              </div>

              <span
                className={`text-xs px-2 py-1 rounded-full border ${
                  lotada
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
                }`}
              >
                {lotada ? "Lotada" : "Programado"}
              </span>
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
                  if (bloqueadoPorInstrutor) return;
                  inscrever?.(t.id);
                }}
                disabled={disabled}
                title={motivo}
                className={[
                  "w-full sm:w-auto px-5 py-2 rounded-lg font-semibold transition",
                  "min-w-[180px]", // estabilidade visual
                  disabled
                    ? "bg-gray-300 text-gray-600 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                    : "bg-lousa text-white hover:opacity-90",
                ].join(" ")}
              >
                {carregando
                  ? "Processando..."
                  : bloqueadoPorInstrutor
                  ? "Instrutor do evento"
                  : jaInscrito
                  ? "Inscrito"
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
