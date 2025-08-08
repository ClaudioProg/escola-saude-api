// src/pages/Eventos.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import { CalendarDays } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import FiltrosEventos from "../components/FiltrosEventos";
import ListaTurmasEvento from "../components/ListaTurmasEvento";

export default function Eventos() {
  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [turmasVisiveis, setTurmasVisiveis] = useState({});
  const [inscricoesConfirmadas, setInscricoesConfirmadas] = useState([]);
  const [erro, setErro] = useState("");
  const [inscrevendo, setInscrevendo] = useState(null);
  const [carregandoTurmas, setCarregandoTurmas] = useState(null);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [filtro, setFiltro] = useState("programado");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario"));
  const nome = usuario?.nome || "";

  const formatarData = (iso) =>
    new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  useEffect(() => {
    async function carregarEventos() {
      setCarregandoEventos(true);
      try {
        const res = await fetch("http://escola-saude-api.onrender.com/api/eventos", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setEventos(data);
        setErro("");
      } catch {
        setErro("Erro ao carregar eventos");
        toast.error("❌ Erro ao carregar eventos");
      } finally {
        setCarregandoEventos(false);
      }
    }
    carregarEventos();
  }, [token]);

  useEffect(() => {
    async function carregarInscricoes() {
      try {
        const res = await fetch("http://escola-saude-api.onrender.com/api/inscricoes/minhas", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const inscricoes = await res.json();
        const idsTurmas = inscricoes.map((i) => i.turma_id);
        setInscricoesConfirmadas(idsTurmas);
      } catch {
        toast.error("Erro ao carregar inscrições do usuário.");
      }
    }
    carregarInscricoes();
  }, [token]);

  async function atualizarEventos() {
    try {
      const res = await fetch("http://escola-saude-api.onrender.com/api/eventos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao atualizar eventos");
      const data = await res.json();
      setEventos(data);
    } catch (e) {
      console.error("Erro em atualizarEventos():", e);
      toast.warning("⚠️ Eventos não puderam ser atualizados.");
    }
  }

  async function carregarTurmas(eventoId) {
    setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: !prev[eventoId] }));
    if (!turmasPorEvento[eventoId] && !carregandoTurmas) {
      setCarregandoTurmas(eventoId);
      try {
        const res = await fetch(`http://escola-saude-api.onrender.com/api/turmas/evento/${eventoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const turmas = await res.json();
        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: turmas }));
      } catch {
        toast.error("Erro ao carregar turmas");
      } finally {
        setCarregandoTurmas(null);
      }
    }
  }

  async function inscrever(turmaId) {
    if (inscrevendo) return;
    setInscrevendo(turmaId);
  
    try {
      const res = await fetch("http://escola-saude-api.onrender.com/api/inscricoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ turma_id: turmaId }),
      });
  
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
  
      if (!res.ok) {
        toast.error(data.erro || `Erro: status ${res.status}`);
        setInscrevendo(null); // ✅ IMPORTANTE: desbloqueia o botão mesmo em erro
        return;
      }
  
      toast.success("✅ Inscrição realizada com sucesso!");
  
      // Atualiza inscrições confirmadas
      const res2 = await fetch("http://escola-saude-api.onrender.com/api/inscricoes/minhas", {
        headers: { Authorization: `Bearer ${token}` },
      });
  
      if (res2.ok) {
        const inscricoesUsuario = await res2.json();
        const novasInscricoes = inscricoesUsuario.map((i) => i.turma_id);
        setInscricoesConfirmadas(novasInscricoes);
      } else {
        toast.warning("⚠️ Não foi possível atualizar inscrições confirmadas.");
      }
  
      // Atualiza eventos para refletir evento.ja_inscrito = true
      await atualizarEventos();
  
      // 🔄 Recarrega as turmas atualizadas do evento
const eventoId = Object.keys(turmasPorEvento).find((id) =>
  turmasPorEvento[id].some((t) => Number(t.id) === Number(turmaId))
);

if (eventoId) {
  try {
    const resTurmas = await fetch(`http://escola-saude-api.onrender.com/api/turmas/evento/${eventoId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resTurmas.ok) throw new Error("Erro ao recarregar turmas");
    const turmasAtualizadas = await resTurmas.json();

    setTurmasPorEvento((prev) => ({
      ...prev,
      [eventoId]: turmasAtualizadas,
    }));
  } catch (e) {
    console.warn("⚠️ Não foi possível recarregar turmas do evento após inscrição");
  }
}
  
    } catch (err) {
      console.error("❌ Erro inesperado:", err);
      toast.error("❌ Erro ao se inscrever.");
    } finally {
      setInscrevendo(null); // ✅ SEMPRE desbloqueia, mesmo com erro
    }
  }
  
  const eventosFiltrados = eventos.filter((evento) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // zera hora para evitar erro de fuso
  
    const inicio = evento.data_inicio_geral ? new Date(evento.data_inicio_geral) : null;
    const fim = evento.data_fim_geral ? new Date(evento.data_fim_geral) : null;
  
    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(0, 0, 0, 0);
  
    if (filtro === "todos") return true;
  
    if (filtro === "programado") return inicio && inicio > hoje;
    if (filtro === "em andamento") return inicio && fim && inicio <= hoje && fim >= hoje;
    if (filtro === "encerrado") {
      const inscritoEmAlgumaTurma = evento.turmas?.some((turma) =>
        inscricoesConfirmadas.includes(turma.id)
      );
      return fim && fim < hoje && inscritoEmAlgumaTurma;
    }
  
    return true;
  });
  

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem‑vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do Usuário</span>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-center text-black dark:text-white">
        🎓 Eventos disponíveis
      </h1>

      <FiltrosEventos filtroAtivo={filtro} onFiltroChange={setFiltro} />

      {carregandoEventos ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={200} className="rounded-xl" />
          ))}
        </div>
      ) : erro ? (
        <p className="text-red-500 text-center">{erro}</p>
      ) : eventosFiltrados.length === 0 ? (
        <NadaEncontrado
          mensagem="Nenhum evento encontrado para esse filtro."
          sugestao="Experimente outra opção acima ou aguarde novas turmas."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...eventosFiltrados]
  .sort((a, b) => {
    const dataA = new Date(`${a.data_fim_geral}T${a.horario_fim_geral || "00:00"}`);
    const dataB = new Date(`${b.data_fim_geral}T${b.horario_fim_geral || "00:00"}`);
    return dataB - dataA; // mais futuros primeiro
  })
  .map((evento) => (
            <div
              key={evento.id}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-xl font-semibold text-lousa dark:text-white mb-1">{evento.titulo}</h3>
              {evento.descricao && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{evento.descricao}</p>
              )}
              <p className="text-sm italic text-gray-600 mt-1">
  Instrutor(es):{" "}
  <span className="text-gray-800 dark:text-white">
    {evento.instrutor?.length
      ? evento.instrutor.map((i) => i.nome).join(", ")
      : "A definir"}
  </span>
</p>
{evento.publico_alvo && (
  <p className="text-sm italic text-gray-600 mt-1">
    Público-alvo:{" "}
    <span className="text-gray-800 dark:text-white">
      {evento.publico_alvo}
    </span>
  </p>
)}

              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4" />
                <span>
  {evento.data_inicio_geral && evento.data_fim_geral
    ? `${formatarData(evento.data_inicio_geral)} até ${formatarData(evento.data_fim_geral)}`
    : "Datas a definir"}
</span>
              </div>

              <BotaoPrimario
                onClick={() => carregarTurmas(evento.id)}
                disabled={carregandoTurmas === evento.id}
                aria-expanded={turmasVisiveis[evento.id]}
                aria-controls={`turmas-${evento.id}`}
              >
                {carregandoTurmas === evento.id
                  ? "Carregando..."
                  : turmasVisiveis[evento.id]
                  ? "Ocultar turmas"
                  : "Ver turmas"}
              </BotaoPrimario>

              {turmasVisiveis[evento.id] && turmasPorEvento[evento.id] && (
                <ListaTurmasEvento
                turmas={turmasPorEvento[evento.id]}
                eventoId={evento.id}
                hoje={new Date()}
                inscricoesConfirmadas={inscricoesConfirmadas}
                inscrever={inscrever}
                inscrevendo={inscrevendo}
                jaInscritoNoEvento={evento.ja_inscrito} // ✅ aqui
                carregarInscritos={() => {}}
                carregarAvaliacoes={() => {}}
                gerarRelatorioPDF={() => {}}
              />
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
