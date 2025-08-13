import PropTypes from "prop-types";
import { useState } from "react";
import { motion } from "framer-motion";
import { Users, CalendarDays } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

/* ===== Helpers de data no fuso local ===== */

function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d); // 00:00 local
    }
    return new Date(input); // já tem hora → deixa o JS interpretar
  }
  return new Date(input);
}

function startOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function endOfDayLocal(d) {
  const dt = toLocalDate(d);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 999);
}

/* ===== Badge de status ===== */

function getStatusBadge(inicio, fim, horarioFim = "23:59") {
  const agora = new Date();

  const dataInicio = startOfDayLocal(inicio);
  let dataFim = endOfDayLocal(fim);

  if (!dataInicio || !dataFim) return null;

  // aplica horário de fim real no último dia, se fornecido (ex.: 12:00)
  if (horarioFim) {
    const [h, m] = horarioFim.split(":").map(Number);
    dataFim.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 59, 999);
  }

  if (agora < dataInicio) {
    return (
      <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-400">
        Programado
      </span>
    );
  }

  if (agora > dataFim) {
    return (
      <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-400">
        Encerrado
      </span>
    );
  }

  return (
    <span className="ml-2 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-400">
      Em andamento
    </span>
  );
}

export default function CardTurma({
  turma,
  eventoId,
  hoje,
  carregarInscritos,
  carregarAvaliacoes,
  gerarRelatorioPDF,
  inscritos,
  avaliacoes,
  inscrever,
  inscrevendo,
  inscricoesConfirmadas,
  bloquearInscricao = false,
}) {
  const [exibeInscritos, setExibeInscritos] = useState(false);
  const [exibeAvaliacoes, setExibeAvaliacoes] = useState(false);

  const total = turma.vagas_total || 0;
  const ocupadas = Array.isArray(turma.inscritos) ? turma.inscritos.length : 0;
  const percentual = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

  // 🕒 Cálculo da carga horária diária
  let cargaHoraria = 0;
  if (turma.horario_inicio && turma.horario_fim) {
    try {
      const [h1, m1] = turma.horario_inicio.split(":").map(Number);
      const [h2, m2] = turma.horario_fim.split(":").map(Number);
      const inicioMin = h1 * 60 + m1;
      const fimMin = h2 * 60 + m2;
      let totalMin = fimMin - inicioMin;
      if (totalMin >= 360) totalMin -= 60; // desconta 1h de almoço
      cargaHoraria = totalMin > 0 ? totalMin / 60 : 0;
    } catch {
      cargaHoraria = 0;
    }
  }

  // Dias da turma (contagem de dias de calendário, inclusive início/fim)
  const ini = startOfDayLocal(turma.data_inicio);
  const fim = startOfDayLocal(turma.data_fim);
  const diasTurma =
    ini && fim
      ? Math.max(1, Math.floor((fim - ini) / 86400000) + 1)
      : 1;

  const cargaTotal = cargaHoraria * diasTurma;

  function bloquearInscricaoPorData() {
    const fimTurma = endOfDayLocal(turma.data_fim);
    return fimTurma ? fimTurma < new Date() : false;
  }

  const bloquear = bloquearInscricao || bloquearInscricaoPorData();

  const corBarra =
    percentual >= 100
      ? "bg-red-600"
      : percentual >= 75
      ? "bg-orange-400"
      : "bg-green-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
      className="border p-6 mb-5 rounded-2xl bg-white dark:bg-gray-900 shadow transition-all"
      aria-label={`Cartão da turma ${turma.nome}`}
      tabIndex={0}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div className="w-full">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-base font-bold text-lousa dark:text-white">
              {turma.nome}
            </h4>
            {getStatusBadge(turma.data_inicio, turma.data_fim, turma.horario_fim)}
          </div>

          {turma.evento_titulo && (
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
              <CalendarDays size={14} className="inline mr-1" /> Evento: {turma.evento_titulo}
            </span>
          )}

          <span className="text-xs text-gray-600 dark:text-gray-300 block mb-1">
            <CalendarDays size={14} className="inline mr-1" />
            {turma.data_inicio && turma.data_fim
              ? `${formatarDataBrasileira(turma.data_inicio)} a ${formatarDataBrasileira(turma.data_fim)}`
              : "Datas a definir"}
          </span>

          {turma.horario_inicio && turma.horario_fim && (
            <span className="text-xs text-gray-600 dark:text-gray-300 block mt-0.5">
              ⏰ Horário: {turma.horario_inicio.slice(0, 5)} às {turma.horario_fim.slice(0, 5)}
            </span>
          )}

          <span className="text-xs text-gray-600 dark:text-gray-300 block mt-0.5">
            Carga horária: {cargaHoraria.toFixed(1)}h/dia • Total: {cargaTotal.toFixed(1)}h
          </span>

          {/* Barra de Progresso */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
              <span>
                <Users size={14} className="inline mr-1" />
                {ocupadas} de {total} vagas preenchidas
              </span>
              <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">
                {percentual}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-300 rounded-full overflow-hidden">
              <div className={`h-full ${corBarra}`} style={{ width: `${percentual}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Botão de inscrição */}
      <div className="mt-4 flex justify-end">
        {inscrever && (
          inscricoesConfirmadas.includes(turma.id) ? (
            <button
              className="bg-green-100 text-green-800 font-semibold px-4 py-1 rounded-full border border-green-400 cursor-default"
              disabled
            >
              ✅ Inscrito
            </button>
          ) : bloquear ? (
            <button
              className="bg-gray-200 text-gray-500 font-semibold px-4 py-1 rounded-full border border-gray-300 cursor-not-allowed"
              disabled
            >
              Inscrição indisponível
            </button>
          ) : (
            <button
              className="bg-lousa hover:bg-green-800 text-white font-semibold px-4 py-1 rounded-full transition"
              onClick={() => inscrever(Number(turma.id))}
              disabled={inscrevendo === Number(turma.id)}
            >
              {inscrevendo === Number(turma.id) ? "Inscrevendo..." : "Inscrever-se"}
            </button>
          )
        )}
      </div>
    </motion.div>
  );
}

CardTurma.propTypes = {
  turma: PropTypes.object.isRequired,
  eventoId: PropTypes.number.isRequired,
  hoje: PropTypes.instanceOf(Date).isRequired,
  carregarInscritos: PropTypes.func.isRequired,
  carregarAvaliacoes: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func.isRequired,
  inscritos: PropTypes.array,
  avaliacoes: PropTypes.array,
  inscrever: PropTypes.func.isRequired,
  inscrevendo: PropTypes.number,
  inscricoesConfirmadas: PropTypes.array,
  bloquearInscricao: PropTypes.bool,
};

CardTurma.defaultProps = {
  inscritos: [],
  avaliacoes: [],
  inscrevendo: null,
  inscricoesConfirmadas: [],
  bloquearInscricao: false,
};
