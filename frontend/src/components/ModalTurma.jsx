// 📁 src/components/ModalTurma.jsx
import { useState } from "react";
import Modal from "react-modal";
import { CalendarDays, Clock, Hash, Type } from "lucide-react";
import { toast } from "react-toastify";

// Utilitário para converter Date para ISO (caso precise no futuro)
// import { converterParaISO } from "../utils/data";

export default function ModalTurma({ isOpen, onClose, onSalvar }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horarioInicio, setHorarioInicio] = useState("");
  const [horarioFim, setHorarioFim] = useState("");
  const [vagas, setVagas] = useState("");
  const [nome, setNome] = useState("");

  const handleSalvar = () => {
    if (!dataInicio || !horarioInicio || !horarioFim || !nome || !vagas) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    // Garante datas no formato ISO (yyyy-mm-dd)
    const dataInicioISO = dataInicio;
    const dataFimISO = dataFim || dataInicioISO;

    // Cálculo de quantidade de dias
    const inicio = new Date(dataInicioISO);
    const fim = new Date(dataFimISO);
    const dias = Math.max(
      1,
      (fim - inicio) / (1000 * 60 * 60 * 24) + 1
    );

    // Cálculo de carga horária
    const [hiHoras, hiMin] = horarioInicio.split(":").map(Number);
    const [hfHoras, hfMin] = horarioFim.split(":").map(Number);
    let horasPorDia = (hfHoras + hfMin / 60) - (hiHoras + hiMin / 60);

    // Desconta 1h de almoço em jornadas >= 8h
    if (horasPorDia >= 8) horasPorDia -= 1;

    const cargaHoraria = Math.round(horasPorDia * dias);

    onSalvar({
      nome,
      data_inicio: dataInicioISO,
      data_fim: dataFimISO,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      vagas_total: Number(vagas),
      carga_horaria: cargaHoraria,
      instrutor_id: null,
    });

    // Reseta o formulário ao fechar
    setDataInicio("");
    setDataFim("");
    setHorarioInicio("");
    setHorarioFim("");
    setVagas("");
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
          value={vagas}
          onChange={(e) => setVagas(e.target.value)}
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
