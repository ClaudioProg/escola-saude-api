import { useEffect, useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { MapPin, FileText, Layers3, PlusCircle } from "lucide-react";
import ModalTurma from "./ModalTurma";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet } from "../services/api"; // ✅ serviço centralizado

export default function ModalEvento({ isOpen, onClose, onSalvar, evento }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [turmas, setTurmas] = useState([]);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState([""]);

  const opcoesInstrutor = usuarios.filter((usuario) => {
    const perfil = (Array.isArray(usuario.perfil)
      ? usuario.perfil.join(",")
      : String(usuario.perfil || "")
    ).toLowerCase();
    return perfil.includes("instrutor") || perfil.includes("administrador");
  });

  function handleSelecionarInstrutor(index, valor) {
    const nova = [...instrutorSelecionado];
    nova[index] = valor;
    setInstrutorSelecionado(nova);
  }
  function adicionarInstrutor() { setInstrutorSelecionado((l) => [...l, ""]); }
  function removerInstrutor(index) {
    const nova = instrutorSelecionado.filter((_, i) => i !== index);
    setInstrutorSelecionado(nova.length ? nova : [""]);
  }
  function getInstrutorDisponivel(index) {
    return opcoesInstrutor.filter(
      (i) =>
        !instrutorSelecionado.includes(String(i.id)) ||
        instrutorSelecionado[index] === String(i.id)
    );
  }

  // Preenche dados ao abrir/editar
  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo || "");
      setDescricao(evento.descricao || "");
      setLocal(evento.local || "");
      setTipo(evento.tipo || "");
      setUnidadeId(evento.unidade_id || "");
      setPublicoAlvo(evento.publico_alvo || "");
      setInstrutorSelecionado(
        Array.isArray(evento.instrutor)
          ? evento.instrutor.map((i) => String(i.id))
          : []
      );
      setTurmas(
        (evento.turmas || []).map((t) => ({
          ...t,
          horario_inicio: t.horario_inicio || t.hora_inicio || "",
          horario_fim: t.horario_fim || t.hora_fim || "",
          carga_horaria: t.carga_horaria ?? 0,
        }))
      );
    } else {
      // reset ao criar novo
      setTitulo(""); setDescricao(""); setLocal("");
      setTipo(""); setUnidadeId(""); setPublicoAlvo("");
      setInstrutorSelecionado([""]); setTurmas([]);
    }
  }, [evento, isOpen]);

  // Carrega unidades
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/api/unidades");
        setUnidades(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erro ao carregar unidades.");
      }
    })();
  }, []);

  // Carrega usuários
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/api/usuarios");
        setUsuarios(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erro ao carregar usuários.");
      }
    })();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    const tiposValidos = ["Congresso","Curso","Oficina","Palestra","Seminário","Simpósio","Outros"];
    if (!titulo || !tipo || !unidadeId) {
      toast.warning("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }
    if (!tiposValidos.includes(tipo)) {
      toast.error("❌ Tipo de evento inválido."); return;
    }
    if (!turmas.length) {
      toast.warning("⚠️ Adicione pelo menos uma turma."); return;
    }
    for (let t of turmas) {
      if (!t.nome || !t.data_inicio || !t.data_fim || !t.horario_inicio || !t.horario_fim || !t.vagas_total || !t.carga_horaria) {
        toast.error("❌ Preencha todos os campos obrigatórios das turmas."); return;
      }
    }

    const instrutorValidado = instrutorSelecionado.map(Number).filter((id) => !Number.isNaN(id));

    const turmasCompletas = turmas.map((t) => ({
      nome: t.nome,
      data_inicio: t.data_inicio,
      data_fim: t.data_fim,
      horario_inicio: t.horario_inicio,
      horario_fim: t.horario_fim,
      vagas_total: Number(t.vagas_total),
      carga_horaria: Number(t.carga_horaria),
    }));

    const turmaPrincipal = turmas[0] || {};
    const payload = {
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,
      instrutor: instrutorValidado,
      turmas: turmasCompletas,
      data_inicio: turmaPrincipal.data_inicio,
      data_fim: turmaPrincipal.data_fim,
      hora_inicio: turmaPrincipal.horario_inicio,
      hora_fim: turmaPrincipal.horario_fim,
      vagas_total: Number(turmaPrincipal.vagas_total),
      carga_horaria: Number(turmaPrincipal.carga_horaria),
      ...(evento?.id ? { id: evento.id } : {}),
    };

    onSalvar(payload);
    onClose();
  };

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
      <div className="flex flex-col max-h-[90vh]">
        <form
          id="form-evento"
          onSubmit={handleSubmit}
          className="overflow-y-auto pr-2 space-y-4"
          style={{ maxHeight: "calc(90vh - 64px)" }}
        >
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

          {/* INSTRUTOR(ES) */}
          {instrutorSelecionado.map((valor, index) => (
            <div key={index} className="mb-2 relative pr-10">
              <label className="text-sm font-medium text-gray-700 dark:text-white">
                {index === 0 ? "Selecione o instrutor" : `Instrutor adicional`}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={valor}
                  onChange={(e) => handleSelecionarInstrutor(index, e.target.value)}
                  className="w-full pl-3 py-2 border rounded-md shadow-sm"
                  required={index === 0}
                >
                  <option value="">Selecione o instrutor</option>
                  {getInstrutorDisponivel(index).map((i) => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removerInstrutor(index)}
                    className="text-red-500 hover:text-red-700 font-bold text-lg"
                    title="Remover este instrutor"
                  >
                    ❌
                  </button>
                )}
              </div>

              {valor && index === instrutorSelecionado.length - 1 && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={adicionarInstrutor}
                    className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition focus-visible:ring-2 focus-visible:ring-teal-400"
                  >
                    <PlusCircle size={16} />
                    Incluir outro instrutor
                  </button>
                </div>
              )}
            </div>
          ))}

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
              <option value="Seminário">Seminário</option>
              <option value="Simpósio">Simpósio</option>
              <option value="Outros">Outros</option>
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
                  <div key={i} className="bg-gray-100 dark:bg-zinc-800 rounded-md p-3 text-sm shadow-sm">
                    <p className="font-bold">{t.nome}</p>
                    <p>📅 {formatarDataBrasileira(t.data_inicio)} • 🕒 {t.horario_inicio} às {t.horario_fim}</p>
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
        </form>

        {/* Rodapé do modal */}
        <div className="flex justify-end gap-2 border-t mt-4 pt-4 bg-white dark:bg-zinc-900 px-4 py-2 shadow-inner">
          <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md">
            Cancelar
          </button>
          <button type="submit" form="form-evento" className="bg-lousa hover:bg-green-800 text-white px-4 py-2 rounded-md font-semibold">
            Salvar
          </button>
        </div>
      </div>

      {/* MODAL TURMA */}
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
              carga_horaria: turma.carga_horaria,
            },
          ]);
          setModalTurmaAberto(false);
        }}
      />
    </Modal>
  );
}
