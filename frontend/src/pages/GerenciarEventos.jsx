// 📁 src/pages/GerenciarEventos.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { Pencil, Trash2, PlusCircle } from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import ModalEvento from "../components/ModalEvento";
import Breadcrumbs from "../components/Breadcrumbs";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
import BotaoPrimario from "../components/BotaoPrimario";
import CabecalhoPainel from "../components/CabecalhoPainel";
// ⚠️ IMPORTANTE: a rota dessa página deve estar protegida por <PrivateRoute permitido={["administrador"]} />
// aqui dentro não vamos bloquear por permissão (evita tela branca se o hook atrasar)

export default function GerenciarEventos() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  // 🔄 Carregar eventos ao montar
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErro("");
        console.log("📡 [GerenciarEventos] GET /api/eventos ...");
        const data = await apiGet("/api/eventos");

        // aceita vários formatos de payload
        const lista = Array.isArray(data)
          ? data
          : Array.isArray(data?.eventos)
          ? data.eventos
          : Array.isArray(data?.lista)
          ? data.lista
          : [];

        console.log("✅ eventos recebidos:", lista);
        setEventos(lista);
      } catch (err) {
        const msg = err?.message || "Erro ao carregar eventos";
        console.error("❌ /api/eventos:", err);
        setErro(msg);
        setEventos([]);
        toast.error(`❌ ${msg}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const abrirModalCriar = () => {
    setEventoSelecionado(null);
    setModalAberto(true);
  };

  const abrirModalEditar = (evento) => {
    setEventoSelecionado(evento);
    setModalAberto(true);
  };

  const excluirEvento = async (eventoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
    try {
      await apiDelete(`/api/eventos/${eventoId}`);
      setEventos((prev) => prev.filter((ev) => ev.id !== eventoId));
      toast.success("✅ Evento excluído.");
    } catch (err) {
      console.error("❌ delete evento:", err);
      toast.error(`❌ ${err?.message || "Erro ao excluir evento."}`);
    }
  };

  const salvarEvento = async (eventoSalvo) => {
    try {
      // ✅ validações básicas
      const turmaInvalida = (eventoSalvo.turmas || []).some(
        (t) =>
          !t?.nome ||
          !t?.data_inicio ||
          !t?.data_fim ||
          !t?.horario_inicio ||
          !t?.horario_fim ||
          !t?.vagas_total ||
          !t?.carga_horaria
      );
      if (turmaInvalida) {
        toast.error("❌ Há turmas com campos obrigatórios não preenchidos.");
        return;
      }
      if (!eventoSalvo.titulo || !eventoSalvo.tipo || !eventoSalvo.unidade_id) {
        toast.warning("⚠️ Preencha todos os campos obrigatórios.");
        return;
      }

      // 🧹 normalização de turmas
      const eventoFinal = {
        ...eventoSalvo,
        turmas: (eventoSalvo.turmas || []).map((t) => ({
          nome: t.nome?.trim() || "",
          data_inicio: t.data_inicio,
          data_fim: t.data_fim,
          horario_inicio: t.horario_inicio,
          horario_fim: t.horario_fim,
          vagas_total: Number(t.vagas_total || 0),
          carga_horaria: Number(t.carga_horaria || 0),
        })),
      };

      const isEdicao = Boolean(eventoSelecionado?.id);
      const endpoint = isEdicao ? `/api/eventos/${eventoSelecionado.id}` : "/api/eventos";

      const resposta = isEdicao
        ? await apiPut(endpoint, eventoFinal)
        : await apiPost(endpoint, eventoFinal);

      const eventoRetornado = resposta?.evento || resposta;

      setEventos((prev) =>
        isEdicao
          ? prev.map((ev) => (ev.id === eventoRetornado.id ? eventoRetornado : ev))
          : [...prev, eventoRetornado]
      );

      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
    } catch (err) {
      console.error("❌ salvar evento:", err);
      toast.error(`❌ ${err?.message || "Erro ao salvar o evento."}`);
    }
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-8 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Eventos" }]} />
      <CabecalhoPainel titulo="🛠️ Gerenciar Eventos" />

      <div className="flex justify-end mb-6">
        <BotaoPrimario onClick={abrirModalCriar} className="flex items-center gap-2">
          <PlusCircle size={18} /> Criar Evento
        </BotaoPrimario>
      </div>

      {!!erro && !loading && <p className="text-red-500 text-center mb-4">{erro}</p>}

      {loading ? (
        <SkeletonEvento />
      ) : eventos.length === 0 ? (
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
              <span className="font-semibold text-lg text-lousa dark:text-white">
                {ev.titulo}
              </span>
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
