// ✅ src/components/CardTurmaAdministrador.jsx — UNIFICADO (date-only safe + status por data/hora + assinante + ocupação)
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { CalendarDays, Clock } from "lucide-react";

import BadgeStatus from "./BadgeStatus";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { formatarDataBrasileira } from "../utils/dateTime";

/* ================================ Helpers ================================ */

function isISODateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function pickYMD(isoLike) {
  if (!isoLike) return null;
  const s = String(isoLike);
  const ymd = s.includes("T") ? s.split("T")[0] : s;
  return isISODateOnly(ymd) ? ymd : null;
}

// "hoje" em YYYY-MM-DD (local) — evita timezone shift
function toLocalYMD(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sanitizeHHmm(v, fallback = null) {
  if (!v) return fallback;
  const s = String(v).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(s) ? s : fallback;
}

function toDateLocal(dateISO, timeHHmm = "00:00") {
  if (!dateISO) return null;
  const t = sanitizeHHmm(timeHHmm, "00:00");
  // "YYYY-MM-DDTHH:mm:SS" (sem timezone) → interpretada no fuso local
  return new Date(`${dateISO}T${t}:00`);
}

function isInvalidDate(d) {
  return !(d instanceof Date) || Number.isNaN(d.getTime());
}

function getStatusKey({
  inicioISO,
  fimISO,
  hIni,
  hFim,
  hojeISO,
}) {
  // Se tiver horário, calcula por DateTime (mais correto)
  if (hIni || hFim) {
    const start = toDateLocal(inicioISO, hIni || "00:00");
    const end = toDateLocal(fimISO, hFim || "23:59");
    if (isInvalidDate(start) || isInvalidDate(end)) return "desconhecido";

    const now = hojeISO
      ? new Date(`${hojeISO}T${new Date().toTimeString().slice(0, 8)}`)
      : new Date();

    if (now < start) return "programado";
    if (now > end) return "encerrado";
    return "em_andamento";
  }

  // Fallback date-only (lexicográfico funciona pra YYYY-MM-DD)
  const hojeYMD = hojeISO || toLocalYMD();
  if (!inicioISO || !fimISO) return "desconhecido";
  if (fimISO < inicioISO) return "desconhecido";
  if (hojeYMD < inicioISO) return "programado";
  if (hojeYMD > fimISO) return "encerrado";
  return "em_andamento";
}

function periodoTexto(inicioISO, fimISO) {
  if (inicioISO && fimISO) {
    return `${formatarDataBrasileira(inicioISO)} a ${formatarDataBrasileira(fimISO)}`;
  }
  if (inicioISO) return formatarDataBrasileira(inicioISO);
  return "Datas a definir";
}

function clamp(n, mi, ma) {
  const v = Number(n);
  if (!Number.isFinite(v)) return mi;
  return Math.max(mi, Math.min(ma, v));
}

function resolveAssinanteNome(turma) {
  if (!turma) return null;

  // 0) Backend já trouxe o objeto
  if (turma?.instrutor_assinante?.nome) return turma.instrutor_assinante.nome;

  // 1) Compat legado
  if (turma?.assinante_nome) return turma.assinante_nome;

  // 2) Campo id
  const assinanteId = Number(turma?.instrutor_assinante_id ?? turma?.assinante_id);
  if (!Number.isFinite(assinanteId)) return null;

  // 3) Procurar entre instrutores da turma
  const arr = Array.isArray(turma?.instrutores) ? turma.instrutores : [];
  for (const it of arr) {
    const id = Number(typeof it === "object" ? it.id : it);
    const nome = typeof it === "object" ? it?.nome : null;
    if (id === assinanteId) return nome || null;
  }
  return null;
}

/* ================================ Componente ================================ */

export default function CardTurmaAdmin({
  turma,
  inscritos = [],
  hojeISO,
  estaExpandida = false,
  modoAdminPresencas = false,
  carregarInscritos,
  carregarAvaliacao,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
  somenteInfo = false,
}) {
  if (!turma) return null;

  const inicioISO = pickYMD(turma?.data_inicio) ?? null;
  const fimISO = pickYMD(turma?.data_fim) ?? (inicioISO ?? null);

  const hIni = sanitizeHHmm(turma?.horario_inicio || null, null);
  const hFim = sanitizeHHmm(turma?.horario_fim || null, null);

  const statusKey = getStatusKey({ inicioISO, fimISO, hIni, hFim, hojeISO });
  const eventoJaIniciado = statusKey === "em_andamento" || statusKey === "encerrado";
  const dentroDoPeriodo = statusKey === "em_andamento";

  const ir = (path) => typeof navigate === "function" && path && navigate(path);

  // Ocupação (se houver)
  const vagasTotais = clamp(
    turma?.vagas_total ?? turma?.vagas_totais ?? turma?.vagas ?? turma?.capacidade ?? 0,
    0,
    10 ** 9
  );
  const qtdInscritos = Array.isArray(inscritos) ? inscritos.length : 0;
  const pct = vagasTotais > 0 ? clamp(Math.round((qtdInscritos / vagasTotais) * 100), 0, 100) : 0;

  const badgePct =
    pct >= 100
      ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800/60"
      : pct >= 75
      ? "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60"
      : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60";

  const barPct = pct >= 100 ? "bg-red-600" : pct >= 75 ? "bg-orange-500" : "bg-green-600";

  // Carga horária (opcional)
  const cargaDia = turma?.carga_horaria_dia ?? turma?.carga_horaria_diaria ?? turma?.carga_diaria ?? null;
  const cargaTotal = turma?.carga_horaria_total ?? turma?.carga_total ?? turma?.carga_horaria ?? null;

  const assinanteNome = resolveAssinanteNome(turma);

  const tituloId = `turma-${turma?.id}-titulo`;
  const periodoId = `turma-${turma?.id}-periodo`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="border border-gray-100 dark:border-gray-800 p-5 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col"
      role="region"
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4
            id={tituloId}
            className="text-[1.05rem] leading-6 font-semibold text-green-900 dark:text-green-200 truncate"
            title={turma?.nome || "Turma"}
            aria-live="polite"
          >
            {turma?.nome || "Turma"}
          </h4>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span id={periodoId} className="inline-flex items-center gap-1.5">
              <CalendarDays size={16} aria-hidden="true" />
              {periodoTexto(inicioISO, fimISO)}
            </span>

            {(hIni || hFim) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={16} aria-hidden="true" />
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

          {/* Assinante */}
          <div className="mt-1 text-[13px]">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200 mr-1.5">
              Assinante:
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800"
              title={assinanteNome || "—"}
            >
              {assinanteNome || "—"}
            </span>
          </div>
        </div>

        <BadgeStatus status={statusKey} variant="soft" size="sm" title="Status por data/horário" />
      </div>

      {/* Ocupação */}
      {vagasTotais > 0 && (
        <div className="mt-2" aria-label="Progresso de ocupação de vagas">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
            <span>
              {qtdInscritos} de {vagasTotais} vagas preenchidas
            </span>
            <span className={`px-2 py-0.5 rounded-full border ${badgePct}`}>{pct}%</span>
          </div>

          <div
            className="h-2 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct}% das vagas preenchidas`}
          >
            <div className={`h-full ${barPct}`} style={{ width: `${pct}%` }} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Ações */}
      {!somenteInfo && (
        !modoAdminPresencas ? (
          <div className="flex flex-wrap gap-2 mt-3">
            <BotaoSecundario
              onClick={() => carregarInscritos?.(turma?.id)}
              aria-label="Abrir lista de inscritos"
              title="Inscritos"
              variant="outline"
              cor="verde"
            >
              👥 Inscritos
            </BotaoSecundario>

            <BotaoSecundario
              onClick={() => carregarAvaliacao?.(turma?.id)}
              aria-label="Abrir avaliações da turma"
              title="Avaliações"
              variant="outline"
              cor="azulPetroleo"
            >
              ⭐ Avaliações
            </BotaoSecundario>

            {dentroDoPeriodo && (
              <BotaoPrimario
                onClick={() => ir("/scanner")}
                aria-label="Abrir leitor de QR Code para presença"
                title="Registro de presença por QR Code"
                cor="verde"
              >
                📷 QR Code
              </BotaoPrimario>
            )}

            {eventoJaIniciado && (
              <BotaoSecundario
                onClick={() => gerarRelatorioPDF?.(turma?.id)}
                aria-label="Gerar PDF desta turma"
                title="Gerar relatório em PDF"
                variant="outline"
                cor="laranjaQueimado"
              >
                📄 PDF
              </BotaoSecundario>
            )}

            <BotaoSecundario
              onClick={() => ir(`/turmas/editar/${turma?.id}`)}
              aria-label="Editar turma"
              title="Editar turma"
              variant="outline"
              cor="amareloOuro"
            >
              ✏️ Editar
            </BotaoSecundario>

            <BotaoSecundario
              onClick={() => ir(`/turmas/presencas/${turma?.id}`)}
              aria-label="Ver presenças da turma"
              title="Presenças"
              variant="outline"
              cor="vermelhoCoral"
            >
              📋 Ver Presenças
            </BotaoSecundario>
          </div>
        ) : (
          <div className="flex justify-end mt-3">
            <BotaoPrimario
              onClick={() => {
                if (!turma?.id) return;
                onExpandirOuRecolher?.(turma.id);
                if (!estaExpandida) {
                  carregarInscritos?.(turma.id);
                  carregarAvaliacao?.(turma.id);
                  carregarPresencas?.(turma.id);
                }
              }}
              aria-label={estaExpandida ? "Recolher detalhes da turma" : "Ver detalhes da turma"}
              rightIcon={<span aria-hidden>{estaExpandida ? "▴" : "▾"}</span>}
              cor="azulPetroleo"
            >
              {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
            </BotaoPrimario>
          </div>
        )
      )}
    </motion.div>
  );
}

CardTurmaAdmin.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nome: PropTypes.string,
    data_inicio: PropTypes.string,
    data_fim: PropTypes.string,
    horario_inicio: PropTypes.string,
    horario_fim: PropTypes.string,
    vagas_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    instrutor_assinante_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assinante_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assinante_nome: PropTypes.string,
    instrutor_assinante: PropTypes.shape({ nome: PropTypes.string }),
    instrutores: PropTypes.array,
    carga_horaria: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    carga_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    carga_horaria_total: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    carga_diaria: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    carga_horaria_dia: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,

  inscritos: PropTypes.array,
  hojeISO: PropTypes.string, // YYYY-MM-DD
  estaExpandida: PropTypes.bool,
  modoAdminPresencas: PropTypes.bool,

  carregarInscritos: PropTypes.func,
  carregarAvaliacao: PropTypes.func,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  onExpandirOuRecolher: PropTypes.func,

  somenteInfo: PropTypes.bool,
};
