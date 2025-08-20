// 📁 src/components/CardTurmaadministrador.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { CalendarDays, Clock } from "lucide-react";

import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import BadgeStatus from "./BadgeStatus";
import { formatarDataBrasileira } from "../utils/data";

/* ================================ Helpers ================================ */
function toDate(dateISO, timeHHmm = "00:00") {
  if (!dateISO) return null;
  const t = /^\d{2}:\d{2}$/.test(timeHHmm) ? timeHHmm : "00:00";
  return new Date(`${dateISO}T${t}:00`);
}
function getStatusByDateTime({ inicioISO, fimISO, hIni, hFim, agora }) {
  const start = toDate(inicioISO, hIni || "00:00");
  const end = toDate(fimISO, hFim || "23:59");
  if (!start || !end) return "desconhecido";
  const now = agora ?? new Date();
  if (now < start) return "programado";
  if (now > end) return "encerrado";
  return "em andamento";
}
function clamp(n, mi, ma) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(mi, Math.min(ma, n));
}

/* ================================ Componente ================================ */
export default function CardTurmaadministrador({
  turma,
  inscritos = [],
  hojeISO,
  estaExpandida,
  modoadministradorPresencas,
  carregarInscritos,
  carregarAvaliacoes,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
  somenteInfo = false,               // 👈 NOVO
}) {
  if (!turma) return null;

  // Datas em ISO — pegamos só AAAA-MM-DD
  const inicioISO = turma.data_inicio?.split("T")[0] || turma.data_inicio || null;
  const fimISO    = turma.data_fim?.split("T")[0]    || turma.data_fim    || null;

  const hIni = turma.horario_inicio;
  const hFim = turma.horario_fim;

  const agora =
    hojeISO
      ? new Date(`${hojeISO}T${new Date().toTimeString().slice(0, 8)}`)
      : new Date();

  const statusKey = getStatusByDateTime({ inicioISO, fimISO, hIni, hFim, agora });
  const eventoJaIniciado = ["em andamento", "encerrado"].includes(statusKey);
  const dentroDoPeriodo  = statusKey === "em andamento";

  // Ocupação
  const vagasTotais   = Number(turma.vagas_totais ?? turma.vagas_total ?? turma.vagas ?? turma.capacidade ?? 0);
  const qtdInscritos  = Array.isArray(inscritos) ? inscritos.length : 0;
  const pct           = vagasTotais > 0 ? clamp(Math.round((qtdInscritos / vagasTotais) * 100), 0, 100) : 0;

  // Carga horária (opcional)
  const cargaDia   = turma.carga_horaria_dia    ?? turma.carga_horaria_diaria ?? turma.carga_diaria ?? null;
  const cargaTotal = turma.carga_horaria_total  ?? turma.carga_total          ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border border-gray-100 dark:border-gray-800 p-5 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col"
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="text-[1.05rem] leading-6 font-semibold text-[#1b4332] dark:text-green-200 truncate">
            {turma.nome || "Turma"}
          </h4>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={16} />
              {inicioISO && fimISO
                ? `${formatarDataBrasileira(inicioISO)} a ${formatarDataBrasileira(fimISO)}`
                : "Datas a definir"}
            </span>

            {(hIni || hFim) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} />
                {hIni || "--:--"} às {hFim || "--:--"}
              </span>
            )}
          </div>

          {(cargaDia || cargaTotal) && (
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {cargaDia ? `Carga horária: ${cargaDia}h/dia` : null}
              {cargaDia && cargaTotal ? " • " : null}
              {cargaTotal ? `Total: ${cargaTotal}h` : null}
            </div>
          )}
        </div>

        <BadgeStatus status={statusKey} variant="soft" size="sm" title="Status por data/horário" />
      </div>

      {/* Ocupação */}
      {vagasTotais > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
            <span>{qtdInscritos} de {vagasTotais} vagas preenchidas</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
            <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Ações — escondidas quando somenteInfo=true */}
      {!somenteInfo && (
        !modoadministradorPresencas ? (
          <div className="flex flex-wrap gap-2 mt-3">
            <BotaoSecundario onClick={() => carregarInscritos?.(turma.id)}>👥 Inscritos</BotaoSecundario>
            <BotaoSecundario onClick={() => carregarAvaliacoes?.(turma.id)}>⭐ Avaliações</BotaoSecundario>
            {dentroDoPeriodo && (
              <BotaoPrimario onClick={() => navigate?.("/scanner")}>📷 QR Code</BotaoPrimario>
            )}
            {eventoJaIniciado && (
              <BotaoSecundario onClick={() => gerarRelatorioPDF?.(turma.id)}>📄 PDF</BotaoSecundario>
            )}
            <BotaoSecundario onClick={() => navigate?.(`/turmas/editar/${turma.id}`)}>✏️ Editar</BotaoSecundario>
            <BotaoSecundario onClick={() => navigate?.(`/turmas/presencas/${turma.id}`)}>📋 Ver Presenças</BotaoSecundario>
          </div>
        ) : (
          <div className="flex justify-end mt-3">
            <BotaoPrimario
              onClick={() => {
                if (!turma?.id) return;
                onExpandirOuRecolher?.(turma.id);
                if (!estaExpandida) {
                  carregarInscritos?.(turma.id);
                  carregarAvaliacoes?.(turma.id);
                  carregarPresencas?.(turma.id);
                }
              }}
            >
              {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
            </BotaoPrimario>
          </div>
        )
      )}
    </motion.div>
  );
}

CardTurmaadministrador.propTypes = {
  turma: PropTypes.object.isRequired,
  inscritos: PropTypes.array,
  hojeISO: PropTypes.string,
  estaExpandida: PropTypes.bool,
  modoadministradorPresencas: PropTypes.bool,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  onExpandirOuRecolher: PropTypes.func,
  somenteInfo: PropTypes.bool,        // 👈 NOVO
};
