// 📁 src/components/CardTurmaadmin.jsx
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import BadgeStatus from "./BadgeStatus";
import BotaoPrimario from "./BotaoPrimario";
import BotaoSecundario from "./BotaoSecundario";
import { formatarDataBrasileira } from "../utils/data";

/* =========================
   Helpers
========================= */
function toLocalYMD(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converte datas ISO (YYYY-MM-DD) para chave de status do BadgeStatus */
function getStatusKey(inicioISO, fimISO, hojeISO) {
  if (!inicioISO || !fimISO || !hojeISO) return "desconhecido";
  if (fimISO < inicioISO) return "desconhecido"; // datas incoerentes
  if (hojeISO < inicioISO) return "programado";
  if (hojeISO > fimISO) return "encerrado";
  return "em_andamento"; // 🔁 compat com <BadgeStatus />
}

/** Texto de período robusto */
function periodoTexto(inicioISO, fimISO) {
  if (inicioISO && fimISO) {
    return `${formatarDataBrasileira(inicioISO)} a ${formatarDataBrasileira(fimISO)}`;
  }
  if (inicioISO) return formatarDataBrasileira(inicioISO);
  return "Datas a definir";
}

export default function CardTurmaadministrador({
  turma,
  hojeISO,
  estaExpandida = false,
  modoadministradorPresencas = false,
  carregarInscritos,
  carregarAvaliacoes,
  carregarPresencas,
  gerarRelatorioPDF,
  navigate,
  onExpandirOuRecolher,
}) {
  // Backend envia ISO completo; usamos só YYYY-MM-DD
  const inicioISO = turma?.data_inicio?.split("T")[0] || turma?.data_inicio || null;
  const fimISO = turma?.data_fim?.split("T")[0] || turma?.data_fim || null;

  const hojeYMD = hojeISO || toLocalYMD();

  const statusKey = getStatusKey(inicioISO, fimISO, hojeYMD);
  const dentroDoPeriodo =
    !!(inicioISO && fimISO && fimISO >= inicioISO && hojeYMD >= inicioISO && hojeYMD <= fimISO);
  const eventoJaIniciado = !!(inicioISO && hojeYMD >= inicioISO);

  const handleIr = (path) => {
    if (!path || typeof navigate !== "function") return;
    navigate(path);
  };

  const tituloId = `turma-${turma?.id}-titulo`;
  const periodoId = `turma-${turma?.id}-periodo`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="border p-5 rounded-2xl bg-white dark:bg-gray-900 shadow-sm flex flex-col border-gray-200 dark:border-gray-700"
      role="region"
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      <div className="flex justify-between items-start gap-3 mb-1">
        <h4
          id={tituloId}
          className="text-md md:text-lg font-semibold text-green-900 dark:text-green-200 truncate"
          title={turma?.nome}
          aria-live="polite"
        >
          {turma?.nome}
        </h4>
        <BadgeStatus status={statusKey} size="sm" variant="soft" />
      </div>

      <p id={periodoId} className="text-sm text-gray-600 dark:text-gray-300">
        {periodoTexto(inicioISO, fimISO)}
      </p>

      {/* Ações */}
      {!modoadministradorPresencas ? (
        <div className="flex flex-wrap gap-2 mt-3 mb-1">
          <BotaoSecundario
            onClick={() => carregarInscritos?.(turma.id)}
            aria-label="Abrir lista de inscritos"
            leftIcon={<span aria-hidden>👥</span>}
            variant="outline"
            cor="verde"
            title="Inscritos"
          >
            Inscritos
          </BotaoSecundario>

          <BotaoSecundario
            onClick={() => carregarAvaliacoes?.(turma.id)}
            aria-label="Abrir avaliações da turma"
            leftIcon={<span aria-hidden>⭐</span>}
            variant="outline"
            cor="azulPetroleo"
            title="Avaliações"
          >
            Avaliações
          </BotaoSecundario>

          {dentroDoPeriodo && (
            <BotaoPrimario
              onClick={() => handleIr("/scanner")}
              aria-label="Abrir leitor de QR Code para presença"
              leftIcon={<span aria-hidden>📷</span>}
              cor="verde"
              title="Registro de presença por QR Code"
            >
              QR Code
            </BotaoPrimario>
          )}

          {eventoJaIniciado && (
            <BotaoSecundario
              onClick={() => gerarRelatorioPDF?.(turma.id)}
              aria-label="Gerar PDF desta turma"
              leftIcon={<span aria-hidden>📄</span>}
              variant="outline"
              cor="laranjaQueimado"
              title="Gerar relatório em PDF"
            >
              PDF
            </BotaoSecundario>
          )}

          <BotaoSecundario
            onClick={() => handleIr(`/turmas/editar/${turma.id}`)}
            aria-label="Editar turma"
            leftIcon={<span aria-hidden>✏️</span>}
            variant="outline"
            cor="amareloOuro"
            title="Editar turma"
          >
            Editar
          </BotaoSecundario>

          <BotaoSecundario
            onClick={() => handleIr(`/turmas/presencas/${turma.id}`)}
            aria-label="Ver presenças da turma"
            leftIcon={<span aria-hidden>📋</span>}
            variant="outline"
            cor="vermelhoCoral"
            title="Presenças"
          >
            Ver Presenças
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
                carregarAvaliacoes?.(turma.id);
                carregarPresencas?.(turma.id);
              }
            }}
            aria-label={estaExpandida ? "Recolher detalhes da turma" : "Ver detalhes da turma"}
            rightIcon={<span aria-hidden>{estaExpandida ? "▴" : "▾"}</span>}
            cor="azulPetroleo"
            title={estaExpandida ? "Recolher detalhes" : "Ver detalhes"}
          >
            {estaExpandida ? "Recolher Detalhes" : "Ver Detalhes"}
          </BotaoPrimario>
        </div>
      )}
    </motion.div>
  );
}

CardTurmaadministrador.propTypes = {
  turma: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nome: PropTypes.string,
    data_inicio: PropTypes.string, // ISO
    data_fim: PropTypes.string, // ISO
  }).isRequired,
  hojeISO: PropTypes.string, // "YYYY-MM-DD" (opcional; cai para hoje local)
  estaExpandida: PropTypes.bool,
  modoadministradorPresencas: PropTypes.bool,
  carregarInscritos: PropTypes.func,
  carregarAvaliacoes: PropTypes.func,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  navigate: PropTypes.func,
  onExpandirOuRecolher: PropTypes.func,
};
