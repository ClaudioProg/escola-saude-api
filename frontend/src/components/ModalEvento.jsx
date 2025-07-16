import { useEffect, useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import {
  MapPin,
  FileText,
  Layers3,
  PlusCircle,
} from "lucide-react";
import ModalTurma from "./ModalTurma";
import { formatarDataBrasileira } from "../utils/data";

export default function ModalEvento({ isOpen, onClose, onSalvar, evento }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [instrutor, setinstrutor] = useState([]);
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [turmas, setTurmas] = useState([]);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo || "");
      setDescricao(evento.descricao || "");
      setLocal(evento.local || "");
      setTipo(evento.tipo || "");
      setUnidadeId(evento.unidade_id || "");
      setPublicoAlvo(evento.publico_alvo || "");
      setinstrutor(
        Array.isArray(evento.instrutor)
          ? evento.instrutor.map((p) => String(p.id))
          : []
      );
      // Garantia de nomes de campos para turmas antigas
      setTurmas(
        (evento.turmas || []).map((t) => ({
          ...t,
          horario_inicio: t.horario_inicio || t.hora_inicio || "",
          horario_fim: t.horario_fim || t.hora_fim || "",
        }))
      );
    }
  }, [evento]);

  useEffect(() => {
    const carregarUnidades = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:3000/api/unidades", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUnidades(data);
      } catch {
        toast.error("Erro ao carregar unidades.");
      }
    };
    carregarUnidades();
  }, []);

  useEffect(() => {
    const carregarUsuarios = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:3000/api/usuarios", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUsuarios(data);
      } catch {
        toast.error("Erro ao carregar usuários.");
      }
    };
    carregarUsuarios();
  }, []);

  const opcoesinstrutorFiltradas = (indiceAtual) => {
    return usuarios.filter((usuario) => {
      const perfil = (usuario.perfil || "").split(",").map((p) => p.trim().toLowerCase());
      const permitido = perfil.includes("instrutor") || perfil.includes("administrador");
      const jaSelecionado = instrutor.includes(String(usuario.id)) && instrutor[indiceAtual] !== String(usuario.id);
      return permitido && !jaSelecionado;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!titulo || !tipo || !unidadeId) {
      toast.warning("Preencha os campos obrigatórios.");
      return;
    }
    if (!turmas.length) {
      toast.warning("Adicione pelo menos uma turma antes de salvar.");
      return;
    }

    // Validação dos campos obrigatórios da turma
    for (let t of turmas) {
      if (
        !t.nome ||
        !t.data_inicio ||
        !t.data_fim ||
        !t.horario_inicio ||
        !t.horario_fim ||
        !t.vagas_total ||
        !t.carga_horaria
      ) {
        toast.error("Preencha todos os campos obrigatórios das turmas!");
        return;
      }
    }

    // Enviar sempre campos que o backend espera
const turmasCompletas = turmas.map((turma) => ({
  nome: turma.nome,
  data_inicio: turma.data_inicio,
  data_fim: turma.data_fim,
  horario_inicio: turma.horario_inicio,
  horario_fim: turma.horario_fim,
  instrutor_id: turma.instrutor_id ?? null,
  vagas_total: turma.vagas_total,
  carga_horaria: turma.carga_horaria,
}));

// Pega os campos obrigatórios da primeira turma
const turmaPrincipal = turmas[0] || {};

onSalvar({
  id: evento?.id,
  titulo,
  descricao,
  local,
  tipo,
  unidade_id: Number(unidadeId),
  publico_alvo: publicoAlvo,
  instrutor: instrutor.filter((id) => id && !isNaN(id)).map(Number),
  turmas: turmasCompletas,
  // ➕ Adiciona estes campos:
  data_inicio: turmaPrincipal.data_inicio,
  data_fim: turmaPrincipal.data_fim,
  hora_inicio: turmaPrincipal.horario_inicio,
  hora_fim: turmaPrincipal.horario_fim,
  vagas_total: turmaPrincipal.vagas_total,
  carga_horaria: turmaPrincipal.carga_horaria,
});

onClose();
  }

  const adicionarinstrutor = () => setinstrutor((prev) => [...prev, ""]);

  const podeAdicionarMais =
    usuarios.filter((u) => {
      const perfil = (u.perfil || "").split(",").map((p) => p.trim().toLowerCase());
      return perfil.includes("instrutor") || perfil.includes("administrador");
    }).length > instrutor.length;

  const abrirModalTurma = () => setModalTurmaAberto(true);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <PlusCircle className="text-purple-600" size={20} /> Criar Evento
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">

  {/* TÍTULO */}
  <div className="relative">
    <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
    <input
      value={titulo}
      onChange={(e) => setTitulo(e.target.value)}
      placeholder="Título"
      className="w-full pl-10 py-2 border rounded-md shadow-sm"
      required
    />
  </div>

  {/* DESCRIÇÃO */}
  <div className="relative">
    <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
    <textarea
      value={descricao}
      onChange={(e) => setDescricao(e.target.value)}
      placeholder="Descrição"
      className="w-full pl-10 py-2 h-24 border rounded-md shadow-sm"
    />
  </div>

  {/* PÚBLICO-ALVO */}
  <div className="relative">
    <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
    <input
      value={publicoAlvo}
      onChange={(e) => setPublicoAlvo(e.target.value)}
      placeholder="Público-alvo"
      className="w-full pl-10 py-2 border rounded-md shadow-sm"
    />
  </div>

  {/* instrutor */}
  {instrutor.map((id, index) => (
    <div key={index} className="mb-2">
      <select
        className="w-full border rounded px-2 py-1"
        value={id}
        onChange={(e) => {
          const novaLista = [...instrutor];
          novaLista[index] = e.target.value;
          setinstrutor(novaLista);
        }}
      >
        <option value="">Selecione o instrutor</option>
        {opcoesinstrutorFiltradas(index).map((usuario) => (
          <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>
        ))}
      </select>
    </div>
  ))}

  <div className="flex justify-center">
    <button
      type="button"
      onClick={adicionarinstrutor}
      disabled={!podeAdicionarMais}
      className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition"
    >
      <PlusCircle size={16} />
      Adicionar instrutor
    </button>
  </div>

  {/* LOCAL */}
  <div className="relative">
    <MapPin className="absolute left-3 top-3 text-gray-500" size={18} />
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder="Local"
      className="w-full pl-10 py-2 border rounded-md shadow-sm"
      required
    />
  </div>

  {/* TIPO */}
  <div className="relative">
    <Layers3 className="absolute left-3 top-3 text-gray-500" size={18} />
    <select
      value={tipo}
      onChange={(e) => setTipo(e.target.value)}
      className="w-full pl-10 py-2 border rounded-md shadow-sm"
      required
    >
      <option value="">Selecione o tipo</option>
      <option value="Congresso">Congresso</option>
      <option value="Curso">Curso</option>
      <option value="Oficina">Oficina</option>
      <option value="Palestra">Palestra</option>
      <option value="Seminario">Seminário</option>
      <option value="Simpósio">Simpósio</option>
    </select>
  </div>

  {/* UNIDADE */}
  <div className="relative">
    <Layers3 className="absolute left-3 top-3 text-gray-500" size={18} />
    <select
      value={unidadeId}
      onChange={(e) => setUnidadeId(e.target.value)}
      className="w-full pl-10 py-2 border rounded-md shadow-sm"
      required
    >
      <option value="">Selecione a unidade</option>
      {unidades.map((u) => (
        <option key={u.id} value={u.id}>{u.nome}</option>
      ))}
    </select>
  </div>

  {/* TURMAS */}
  <div>
    <h3 className="text-md font-semibold mt-4 flex items-center gap-2 text-lousa dark:text-white">
      <Layers3 size={16} /> Turmas Cadastradas
    </h3>
    {turmas.length === 0 ? (
      <p className="text-sm text-gray-500 mt-1">Nenhuma turma cadastrada.</p>
    ) : (
      <div className="mt-2 space-y-2">
        {turmas.map((t, i) => (
          <div
            key={i}
            className="bg-gray-100 dark:bg-zinc-800 rounded-md p-3 text-sm shadow-sm"
          >
            <p className="font-bold">{t.nome}</p>
            <p>
              📅 {formatarDataBrasileira(t.data_inicio)} • 🕒 {t.horario_inicio} às {t.horario_fim}
            </p>
            <p>👥 {t.vagas_total} vagas • ⏱ {t.carga_horaria}h</p>
          </div>
        ))}
      </div>
    )}
    <div className="flex justify-center mt-3">
      <button
        type="button"
        onClick={abrirModalTurma}
        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition focus-visible:ring-2 focus-visible:ring-teal-400"
        aria-label="Adicionar nova turma"
        tabIndex={0}
      >
        <PlusCircle size={16} />
        Adicionar Turma
      </button>
    </div>
  </div>

  {/* BOTÕES */}
  <div className="flex justify-end gap-2 pt-4">
    <button
      type="button"
      onClick={onClose}
      className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
    >
      Cancelar
    </button>
    <button
      type="submit"
      className="bg-lousa hover:bg-green-800 text-white px-4 py-2 rounded-md font-semibold"
    >
      Salvar
    </button>
  </div>
</form>


      <ModalTurma
        isOpen={modalTurmaAberto}
        onClose={() => setModalTurmaAberto(false)}
        onSalvar={(turma) => {
          setTurmas((prev) => [
            ...prev,
            {
              ...turma,
              horario_inicio: turma.horario_inicio || turma.hora_inicio,
              horario_fim: turma.horario_fim || turma.hora_fim,
            },
          ]);
          setModalTurmaAberto(false);
        }}
      />
    </Modal>
  );
}
