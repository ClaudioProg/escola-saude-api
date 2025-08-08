// src/pages/GerenciarEventos.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { Pencil, Trash2, PlusCircle } from "lucide-react";

import ModalEvento from "../components/ModalEvento";
import usePerfilPermitidos from "../hooks/usePerfilPermitidos";
import Breadcrumbs from "../components/Breadcrumbs";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
import BotaoPrimario from "../components/BotaoPrimario";
import CabecalhoPainel from "../components/CabecalhoPainel";

export default function GerenciarEventos() {
  const token = localStorage.getItem("token") || "";
  const { temAcesso, carregando: carregandoPermissao } = usePerfilPermitidos(["administrador"]);

  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    if (!temAcesso) return;
    const carregarEventos = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://escola-saude-api.onrender.com/api/eventos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setEventos(data);
      } catch (err) {
        setErro(err.message);
        toast.error(`❌ ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    carregarEventos();
  }, [temAcesso, token]);

  const abrirModalCriar = () => {
    setEventoSelecionado(null);
    setModalAberto(true);
  };

  const abrirModalEditar = (evento) => {
    setEventoSelecionado(evento);
    setModalAberto(true);
  };

  const excluirEvento = async (eventoId) => {
    try {
      const res = await fetch(`http://escola-saude-api.onrender.com/api/eventos/${eventoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao excluir evento.");
      toast.success("✅ Evento excluído.");
      setEventos(eventos.filter((ev) => ev.id !== eventoId));
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const salvarEvento = async (eventoSalvo) => {
    try {
      const turmaInvalida = eventoSalvo.turmas.some(t =>
        !t.nome || !t.data_inicio || !t.data_fim || !t.horario_inicio || !t.horario_fim || !t.vagas_total || !t.carga_horaria
      );

      if (turmaInvalida) {
        toast.error("❌ Há turmas com campos obrigatórios não preenchidos.");
        return;
      }

      if (!eventoSalvo.titulo || !eventoSalvo.tipo || !eventoSalvo.unidade_id) {
        toast.warning("⚠️ Preencha todos os campos obrigatórios.");
        return;
      }

      if (eventoSelecionado) {
        eventoSalvo.id = eventoSelecionado.id;
      }

      const eventoFinal = {
        ...eventoSalvo,
        turmas: eventoSalvo.turmas.map((t) => ({
          nome: t.nome?.trim() || "",
          data_inicio: t.data_inicio,
          data_fim: t.data_fim,
          horario_inicio: t.horario_inicio,
          horario_fim: t.horario_fim,
          vagas_total: Number(t.vagas_total || 0),
          carga_horaria: t.carga_horaria || 0,
        })),
      };

      const metodo = eventoSelecionado ? "PUT" : "POST";
      const url = eventoSelecionado
        ? `http://escola-saude-api.onrender.com/api/eventos/${eventoSelecionado.id}`
        : `http://escola-saude-api.onrender.com/api/eventos`;

      const res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventoFinal),
      });

      if (!res.ok) {
        const erroAPI = await res.json();
        throw new Error(erroAPI?.erro || "Erro ao salvar o evento.");
      }

      const resposta = await res.json();
      const eventoRetornado = resposta.evento || resposta;

      if (eventoSelecionado) {
        setEventos(eventos.map((ev) => (ev.id === eventoRetornado.id ? eventoRetornado : ev)));
      } else {
        setEventos([...eventos, eventoRetornado]);
      }

      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
    } catch (err) {
      toast.error(`❌ ${err.message}`);
    }
  };

  if (carregandoPermissao || loading) return <SkeletonEvento />;
  if (!temAcesso) return <NenhumDado mensagem="Acesso não autorizado." />;

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-8 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Eventos" }]} />
      <CabecalhoPainel titulo="🛠️ Gerenciar Eventos" />

      <div className="flex justify-end mb-6">
        <BotaoPrimario onClick={abrirModalCriar} className="flex items-center gap-2">
          <PlusCircle size={18} /> Criar Evento
        </BotaoPrimario>
      </div>

      {erro && <p className="text-red-500 text-center mb-4">{erro}</p>}

      {eventos.length === 0 ? (
        <NenhumDado mensagem="Nenhum evento cadastrado." />
      ) : (
        <ul className="space-y-6">
          {eventos.map((ev) => (
            <motion.li
              key={ev.id || ev.titulo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow flex justify-between items-center border border-gray-200 dark:border-zinc-700"
            >
              <span className="font-semibold text-lg text-lousa dark:text-white">{ev.titulo}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModalEditar(ev)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                >
                  <Pencil size={16} /> Editar
                </button>
                <button
                  onClick={() => excluirEvento(ev.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <ModalEvento
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSalvar={salvarEvento}
        evento={eventoSelecionado}
      />
    </main>
  );
}
