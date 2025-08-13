import { useState } from "react";
import Modal from "react-modal";
import { CalendarDays, Clock, Hash, Type } from "lucide-react";
import { toast } from "react-toastify";

export default function ModalTurma({ isOpen, onClose, onSalvar }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [vagas_total, setVagasTotal] = useState("");
  const [nome, setNome] = useState("");

  // helper: converte "yyyy-mm-dd" para Date local fixando 12:00
  const toLocalNoon = (ymd) => new Date(`${ymd}T12:00:00`);

  const handleSalvar = () => {
    // valida campos obrigatórios básicos
    if (
      !dataInicio ||
      !horarioInicio ||
      !horarioFim ||
      !nome.trim() ||
      !vagas_total ||
      Number(vagas_total) <= 0
    ) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    // normaliza ISO (já vem yyyy-mm-dd do input type=date)
    const dataInicioISO = dataInicio; // ✅ já é yyyy-mm-dd
    const dataFimISO = dataFim || dataInicioISO; // se vazio, assume 1 dia

    // valida ordem das datas (com T12:00:00 para evitar off-by-one)
    const inicio = toLocalNoon(dataInicioISO);
    const fim = toLocalNoon(dataFimISO);
    if (fim < inicio) {
      toast.error("A data de término não pode ser anterior à data de início.");
      return;
    }

    // valida horários
    const [hiHoras = 0, hiMin = 0] = (horarioInicio || "").split(":").map(Number);
    const [hfHoras = 0, hfMin = 0] = (horarioFim || "").split(":").map(Number);
    const inicioHoras = hiHoras + (hiMin || 0) / 60;
    const fimHoras = hfHoras + (hfMin || 0) / 60;

    if (Number.isNaN(inicioHoras) || Number.isNaN(fimHoras)) {
      toast.error("Informe horários válidos (HH:MM).");
      return;
    }
    if (fimHoras <= inicioHoras) {
      toast.error("O horário de término deve ser posterior ao horário de início.");
      return;
    }

    // dias de duração (inclui ambas as pontas)
    const MS_DIA = 24 * 60 * 60 * 1000;
    const dias = Math.max(1, Math.floor((fim - inicio) / MS_DIA) + 1);

    // horas por dia, com pausa de 1h se >= 8h/dia
    let horasPorDia = fimHoras - inicioHoras;
    if (horasPorDia >= 8) horasPorDia -= 1; // almoço

    // evita negativo por segurança
    horasPorDia = Math.max(0, horasPorDia);

    const cargaHoraria = Math.round(horasPorDia * dias);

    const turmaFinal = {
      nome: nome.trim(),
      data_inicio: dataInicioISO,
      data_fim: dataFimISO,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      vagas_total: Number(vagas_total),
      carga_horaria: cargaHoraria,
    };

    onSalvar(turmaFinal);

    // limpa os campos
    setDataInicio("");
    setDataFim("");
    setHorarioInicio("");
    setHorarioFim("");
    setVagasTotal("");
    setNome("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <h2 className="text-xl font-bold mb-4 text-lousa">Nova Turma</h2>

      <div className="relative mb-3">
        <Type className="absolute left-3 top-3 text-gray-500" size={18} />
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome da turma"
          className="w-full pl-10 py-2 border rounded-md shadow-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md shadow-sm"
            required
          />
        </div>
        <div className="relative">
          <CalendarDays className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md shadow-sm"
          />
        </div>

        <div className="relative">
          <Clock className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="time"
            value={horarioInicio}
            onChange={(e) => setHorarioInicio(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md shadow-sm"
            required
          />
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-3 text-gray-500" size={18} />
          <input
            type="time"
            value={horarioFim}
            onChange={(e) => setHorarioFim(e.target.value)}
            className="w-full pl-10 py-2 border rounded-md shadow-sm"
            required
          />
        </div>
      </div>

      <div className="relative mb-4">
        <Hash className="absolute left-3 top-3 text-gray-500" size={18} />
        <input
          type="number"
          value={vagas_total}
          onChange={(e) => setVagasTotal(e.target.value)}
          placeholder="Quantidade de vagas"
          className="w-full pl-10 py-2 border rounded-md shadow-sm"
          min={1}
          required
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          Salvar Turma
        </button>
      </div>
    </Modal>
  );
}
