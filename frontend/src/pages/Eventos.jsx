// ✅ src/pages/Eventos.jsx
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
import { apiGet, apiPost } from "../services/api";

// ✅ helpers de data SEM fuso (parse local)
import { toLocalDate } from "../utils/data";

/* ------------------------------------------------------------------ */
/*  Formatadores 100% “sem Date” para evitar fuso                       */
/* ------------------------------------------------------------------ */
const MESES_ABREV_PT = [
  "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
  "jul.", "ago.", "set.", "out.", "nov.", "dez."
];

// Ex.: "2025-08-24" → "24 de ago. de 2025"
// Aceita "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss"
function formatarDataCurtaSeguro(iso) {
  if (!iso) return "";
  const [data] = String(iso).split("T");
  const partes = data.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));
  return `${String(dia).padStart(2, "0")} de ${MESES_ABREV_PT[idx]} de ${ano}`;
}

// Ex.: "2025-08-24" → "24/08/2025"
function formatarDataBRSemFuso(iso) {
  if (!iso) return "";
  const [data] = String(iso).split("T");
  const partes = data.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}
/* ------------------------------------------------------------------ */

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
  let usuario = {};
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}
  const nome = usuario?.nome || "";
  const usuarioId = Number(usuario?.id) || null;

  useEffect(() => {
    async function carregarEventos() {
      setCarregandoEventos(true);
      try {
        const data = await apiGet("/api/eventos");
        setEventos(Array.isArray(data) ? data : []);
        setErro("");
      } catch {
        setErro("Erro ao carregar eventos");
        toast.error("❌ Erro ao carregar eventos");
      } finally {
        setCarregandoEventos(false);
      }
    }
    carregarEventos();
  }, []);

  useEffect(() => {
    async function carregarInscricoes() {
      try {
        const inscricoes = await apiGet("/api/inscricoes/minhas");
        const idsTurmas = (Array.isArray(inscricoes) ? inscricoes : [])
          .map((i) => Number(i?.turma_id))
          .filter((n) => Number.isFinite(n));
        setInscricoesConfirmadas(idsTurmas);
      } catch {
        toast.error("Erro ao carregar inscrições do usuário.");
      }
    }
    carregarInscricoes();
  }, []);

  async function atualizarEventos() {
    try {
      const data = await apiGet("/api/eventos");
      setEventos(Array.isArray(data) ? data : []);
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
        const turmas = await apiGet(`/api/turmas/evento/${eventoId}`);
        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: Array.isArray(turmas) ? turmas : [] }));
      } catch {
        toast.error("Erro ao carregar turmas");
      } finally {
        setCarregandoTurmas(null);
      }
    }
  }

  // Helper: obter eventoId a partir de uma turmaId já carregada localmente
  function findEventoIdByTurmaIdLocal(turmaId) {
    for (const [evtId, turmas] of Object.entries(turmasPorEvento)) {
      if ((turmas || []).some((t) => Number(t.id) === Number(turmaId))) {
        return Number(evtId);
      }
    }
    return null;
  }

  async function inscrever(turmaId) {
    if (inscrevendo) return;

    // 🔒 Bloqueio client-side: se o usuário for instrutor do evento, não deixa prosseguir
    const eventoIdLocal = findEventoIdByTurmaIdLocal(turmaId);
    const eventoReferente =
      (eventoIdLocal && eventos.find((e) => Number(e.id) === Number(eventoIdLocal))) || null;

    // usa flag do backend se existir; fallback: confere lista de instrutores do evento
    const ehInstrutor =
      Boolean(eventoReferente?.ja_instrutor) ||
      (Array.isArray(eventoReferente?.instrutor) &&
        usuarioId &&
        eventoReferente.instrutor.some((i) => Number(i.id) === Number(usuarioId)));

    if (ehInstrutor) {
      toast.warn("Você é instrutor deste evento e não pode se inscrever como participante.");
      return;
    }

    setInscrevendo(turmaId);
    try {
      await apiPost("/api/inscricoes", { turma_id: turmaId });
      toast.success("✅ Inscrição realizada com sucesso!");

      // Atualiza inscrições confirmadas
      try {
        const inscricoesUsuario = await apiGet("/api/inscricoes/minhas");
        const novasInscricoes = (Array.isArray(inscricoesUsuario) ? inscricoesUsuario : [])
          .map((i) => Number(i?.turma_id))
          .filter((n) => Number.isFinite(n));
        setInscricoesConfirmadas(novasInscricoes);
      } catch {
        toast.warning("⚠️ Não foi possível atualizar inscrições confirmadas.");
      }

      // Atualiza eventos e recarrega as turmas do evento dessa turma
      await atualizarEventos();

      const eventoId = eventoIdLocal || Object.keys(turmasPorEvento).find((id) =>
        (turmasPorEvento[id] || []).some((t) => Number(t.id) === Number(turmaId))
      );

      if (eventoId) {
        try {
          const turmasAtualizadas = await apiGet(`/api/turmas/evento/${eventoId}`);
          setTurmasPorEvento((prev) => ({
            ...prev,
            [eventoId]: Array.isArray(turmasAtualizadas) ? turmasAtualizadas : [],
          }));
        } catch {
          console.warn("⚠️ Não foi possível recarregar turmas do evento após inscrição");
        }
      }
    } catch (err) {
      // Trata respostas do backend, especialmente 409 para instrutor e duplicidade
      const status = err?.status || err?.response?.status;
      const msg = err?.data?.erro || err?.message || "Erro ao se inscrever.";
      if (status === 409) {
        // Pode ser "instrutor não pode", ou "já inscrito"
        toast.warn(msg);
      } else if (status === 400) {
        toast.error(msg);
      } else {
        console.error("❌ Erro inesperado:", err);
        toast.error("❌ Erro ao se inscrever.");
      }
    } finally {
      setInscrevendo(null);
    }
  }

  // ✅ filtra usando datas locais (sem UTC)
  const eventosFiltrados = eventos.filter((evento) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const inicio = evento.data_inicio_geral ? toLocalDate(evento.data_inicio_geral) : null;
    const fim = evento.data_fim_geral ? toLocalDate(evento.data_fim_geral) : null;

    if (inicio) inicio.setHours(0, 0, 0, 0);
    if (fim) fim.setHours(0, 0, 0, 0);

    if (filtro === "todos") return true;
    if (filtro === "programado") return inicio && inicio > hoje;
    if (filtro === "em andamento") return inicio && fim && inicio <= hoje && fim >= hoje;
    if (filtro === "encerrado") {
      // mostra encerrados somente se o usuário participou de alguma turma do evento
      const inscritoEmAlgumaTurma = (evento.turmas || []).some((t) =>
        inscricoesConfirmadas.includes(Number(t.id))
      );
      return fim && fim < hoje && inscritoEmAlgumaTurma;
    }
    return true;
  });

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do Usuário</span>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-center text-black dark:text-white">
        🎓 Eventos disponíveis
      </h1>

      <FiltrosEventos
  filtroAtivo={filtro}
  onFiltroChange={setFiltro}
  filtroSelecionado={filtro}        // <- adiciona
  valorSelecionado={filtro}         // <- adiciona (se o filho repassa para FiltroToggleGroup)
  onChange={setFiltro}              // <- se o filho usa esta prop genérica
/>

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
            // ✅ ordena usando local date + horário geral (quando existir)
            .sort((a, b) => {
              const fimA = toLocalDate(
                `${a.data_fim_geral || ""}${a.horario_fim_geral ? `T${a.horario_fim_geral}` : ""}`
              );
              const fimB = toLocalDate(
                `${b.data_fim_geral || ""}${b.horario_fim_geral ? `T${b.horario_fim_geral}` : ""}`
              );
              return (fimB?.getTime?.() || 0) - (fimA?.getTime?.() || 0);
            })
            .map((evento) => {
              const ehInstrutor = Boolean(evento.ja_instrutor);
              return (
                <div
                  key={evento.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700"
                >
                  <h3 className="text-xl font-semibold text-lousa dark:text-white mb-1">
                    {evento.titulo}
                  </h3>

                  {evento.descricao && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      {evento.descricao}
                    </p>
                  )}

                  {/* Selo/aviso quando o usuário é instrutor do evento */}
                  {ehInstrutor && (
                    <div className="mb-2 text-xs font-medium inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                      Você é instrutor deste evento
                    </div>
                  )}

                  <p className="text-sm italic text-gray-600 mt-1">
                    Instrutor(es):{" "}
                    <span className="text-gray-800 dark:text-white">
                      {Array.isArray(evento.instrutor) && evento.instrutor.length
                        ? evento.instrutor.map((i) => i.nome).join(", ")
                        : "A definir"}
                    </span>
                  </p>

                  {evento.publico_alvo && (
                    <p className="text-sm italic text-gray-600 mt-1">
                      Público-alvo:{" "}
                      <span className="text-gray-800 dark:text-white">{evento.publico_alvo}</span>
                    </p>
                  )}

                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mb-3">
                    <CalendarDays className="w-4 h-4" />
                    <span>
                      {evento.data_inicio_geral && evento.data_fim_geral
                        ? `${formatarDataCurtaSeguro(evento.data_inicio_geral)} até ${formatarDataCurtaSeguro(evento.data_fim_geral)}`
                        : "Datas a definir"}
                    </span>
                  </div>

                  <BotaoPrimario
                    onClick={() => carregarTurmas(evento.id)}
                    disabled={carregandoTurmas === evento.id}
                    aria-expanded={!!turmasVisiveis[evento.id]}
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
                      hoje={new Date()} // ok usar "agora"; não é parse
                      inscricoesConfirmadas={inscricoesConfirmadas}
                      inscrever={inscrever}
                      inscrevendo={inscrevendo}
                      jaInscritoNoEvento={!!evento.ja_inscrito}
                      jaInstrutorDoEvento={!!evento.ja_instrutor}  // <- NOVO (se o componente usar, desabilita CTA)
                      carregarInscritos={() => {}}
                      carregarAvaliacoes={() => {}}
                      gerarRelatorioPDF={() => {}}
                    />
                  )}
                </div>
              );
            })}
        </div>
      )}
    </main>
  );
}
