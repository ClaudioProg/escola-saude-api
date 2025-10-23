// ✅ src/pages/Eventos.jsx (revisado — sem publicar/despublicar)
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { motion, useReducedMotion } from "framer-motion";

import { CalendarDays, RefreshCw } from "lucide-react";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import FiltrosEventos from "../components/FiltrosEventos";
import ListaTurmasEvento from "../components/ListaTurmasEvento";
import { apiGet, apiPost } from "../services/api";

/* ───────────────── Hero centralizado (sem breadcrumbs) ───────────────── */
function EventosHero({ onRefresh }) {
  return (
    <header
      className="bg-gradient-to-br from-indigo-900 via-violet-800 to-indigo-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🎓</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Eventos disponíveis
          </h1>
        </div>
        <p className="text-sm sm:text-base text-white/90">
          Inscreva-se em turmas abertas ou consulte detalhes dos eventos.
        </p>
        <BotaoPrimario
          onClick={onRefresh}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
          aria-label="Atualizar lista de eventos"
        >
          Atualizar
        </BotaoPrimario>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers de data/formatadores                                      */
/* ------------------------------------------------------------------ */
const MESES_ABREV_PT = ["jan.","fev.","mar.","abr.","mai.","jun.","jul.","ago.","set.","out.","nov.","dez."];
function formatarDataCurtaSeguro(iso) {
  if (!iso) return "";
  const [data] = String(iso).split("T");
  const partes = data.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));
  return `${String(dia).padStart(2, "0")} de ${MESES_ABREV_PT[idx]} de ${ano}`;
}
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const HOJE_ISO = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const inRange = (di, df, dia) => !!di && !!df && di <= dia && dia <= df;
function rangeDaTurma(t) {
  let di = null, df = null;
  const push = (x) => {
    const d = ymd(typeof x === "string" ? x : x?.data);
    if (!d) return;
    if (!di || d < di) di = d;
    if (!df || d > df) df = d;
  };
  if (Array.isArray(t?.encontros) && t.encontros.length) t.encontros.forEach(push);
  else if (Array.isArray(t?.datas) && t.datas.length) t.datas.forEach(push);
  else if (Array.isArray(t?._datas) && t._datas.length) t._datas.forEach(push);
  else { push(t?.data_inicio); push(t?.data_fim); }
  return { di, df };
}

// Prioriza o status vindo do backend; se não vier, usa o cálculo local atual
function statusBackendOuFallback(evento) {
  if (typeof evento?.status === "string" && evento.status) return evento.status;
  return statusDoEvento(evento);
}

/* ------------------------------------------------------------------ */
/*  Helpers para buscar apenas eventos visíveis                       */
/* ------------------------------------------------------------------ */
function extrairListaEventos(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.eventos)) return res.eventos;
  if (Array.isArray(res?.data?.eventos)) return res.data.eventos;
  return [];
}
async function filtrarEventosVisiveisClientSide(lista) {
  const checks = (lista || []).map(async (e) => {
    try {
      const r = await apiGet(`/api/eventos/${e.id}/visivel`);
      return r?.ok ? e : null;
    } catch { return null; }
  });
  const arr = await Promise.all(checks);
  return arr.filter(Boolean);
}

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
  const reduceMotion = useReducedMotion();

  let usuario = {};
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}
  const usuarioId = Number(usuario?.id) || null;

  /* -------------------- carregamentos -------------------- */
  useEffect(() => {
    async function carregarEventos() {
      setCarregandoEventos(true);
      try {
        let lista = extrairListaEventos(await apiGet("/api/eventos/para-mim/lista"));
        if (!Array.isArray(lista) || lista.length === 0) {
          const todos = extrairListaEventos(await apiGet("/api/eventos"));
          lista = await filtrarEventosVisiveisClientSide(todos);
        }
        setEventos(Array.isArray(lista) ? lista : []);
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
      let lista = extrairListaEventos(await apiGet("/api/eventos/para-mim/lista"));
      if (!Array.isArray(lista) || lista.length === 0) {
        const todos = extrairListaEventos(await apiGet("/api/eventos"));
        lista = await filtrarEventosVisiveisClientSide(todos);
      }
      setEventos(Array.isArray(lista) ? lista : []);
    } catch (e) {
      console.error("Erro em atualizarEventos():", e);
      toast.warn("⚠️ Eventos não puderam ser atualizados.");
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

  function findEventoIdByTurmaIdLocal(turmaId) {
    for (const [evtId, turmas] of Object.entries(turmasPorEvento)) {
      if ((turmas || []).some((t) => Number(t.id) === Number(turmaId))) return Number(evtId);
    }
    return null;
  }

  async function inscrever(turmaId) {
    if (inscrevendo) return;

    const eventoIdLocal = findEventoIdByTurmaIdLocal(turmaId);
    const eventoReferente =
      (eventoIdLocal && eventos.find((e) => Number(e.id) === Number(eventoIdLocal))) || null;

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

      try {
        const inscricoesUsuario = await apiGet("/api/inscricoes/minhas");
        const novasInscricoes = (Array.isArray(inscricoesUsuario) ? inscricoesUsuario : [])
          .map((i) => Number(i?.turma_id))
          .filter((n) => Number.isFinite(n));
        setInscricoesConfirmadas(novasInscricoes);
      } catch { toast.warn("⚠️ Não foi possível atualizar inscrições confirmadas."); }

      await atualizarEventos();

      const eventoId =
        eventoIdLocal ||
        Object.keys(turmasPorEvento).find((id) =>
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
      const status = err?.status ?? err?.response?.status ?? err?.data?.status ?? err?.response?.data?.status;
      const serverMsg =
        err?.data?.erro ?? err?.response?.erro ?? err?.response?.data?.erro ??
        err?.data?.message ?? err?.response?.data?.message;
      const msg = serverMsg || err?.message || "Erro ao se inscrever.";

      if (status === 409) toast.warn(msg);
      else if (status === 400) toast.error(msg);
      else if (status === 403 && err?.response?.data?.motivo) {
        const motivo = err.response.data.motivo;
        if (motivo === "SEM_REGISTRO") toast.error("Inscrição bloqueada: informe seu Registro no perfil.");
        else if (motivo === "REGISTRO_NAO_AUTORIZADO") toast.error("Inscrição bloqueada: seu Registro não está autorizado para este curso.");
        else toast.error("Acesso negado para este curso.");
      } else {
        console.error("❌ Erro inesperado:", err);
        toast.error("❌ Erro ao se inscrever.");
      }
    } finally {
      setInscrevendo(null);
    }
  }

  function turmasDoEvento(evento) {
    const carregadas = turmasPorEvento[evento.id];
    if (Array.isArray(carregadas) && carregadas.length) return carregadas;
    if (Array.isArray(evento?.turmas) && evento.turmas.length) return evento.turmas;
    return [];
  }

  function jaInscritoNoEvento(evento) {
    const ts = turmasDoEvento(evento);
    if (!ts.length) return false;
    const setTurmaIds = new Set(inscricoesConfirmadas);
    return ts.some((t) => setTurmaIds.has(Number(t.id)));
  }

  function statusDoEvento(evento) {
    const ts = turmasDoEvento(evento);
    if (ts.length) {
      let algumAndamento = false, algumFuturo = false, todosPassados = true;
      for (const t of ts) {
        const { di, df } = rangeDaTurma(t);
        if (inRange(di, df, HOJE_ISO)) algumAndamento = true;
        if (di && di > HOJE_ISO) algumFuturo = true;
        if (!(df && df < HOJE_ISO)) todosPassados = false;
      }
      if (algumAndamento) return "andamento";
      if (algumFuturo && !todosPassados) return "programado";
      if (todosPassados) return "encerrado";
      return "programado";
    }
    const diG = ymd(evento?.data_inicio_geral);
    const dfG = ymd(evento?.data_fim_geral);
    if (inRange(diG, dfG, HOJE_ISO)) return "andamento";
    if (diG && diG > HOJE_ISO) return "programado";
    if (dfG && dfG < HOJE_ISO) return "encerrado";
    return "programado";
  }

  // Chips sólidos legíveis (sem degradê)
  const chip = {
    programado: { text: "Programado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800" },
    andamento:  { text: "Em andamento", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800" },
    encerrado:  { text: "Encerrado", cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200 border border-rose-200 dark:border-rose-800" },
  };

  const setFiltroNormalizado = (valor) => {
    const v = String(valor || "").toLowerCase().replace(/\s+/g, "_");
    if (v === "todos") return setFiltro("todos");
    if (v === "programados" || v === "programado") return setFiltro("programado");
    if (v === "andamento" || v === "em_andamento" || v === "em-andamento") return setFiltro("andamento");
    if (["encerrado", "encerrados", "finalizado", "concluido", "concluído"].includes(v)) return setFiltro("encerrado");
    setFiltro("programado");
  };

  // 🔎 regra: nunca mostrar encerrados sem inscrição prévia
  const eventosFiltrados = eventos.filter((evento) => {
    const st = statusBackendOuFallback(evento);   // ✅ usa backend primeiro
    const inscrito = jaInscritoNoEvento(evento);
    if (st === "encerrado" && !inscrito) return false;
    if (filtro === "todos") return true;
    if (filtro === "programado") return st === "programado";
    if (filtro === "andamento") return st === "andamento";
    if (filtro === "encerrado") return st === "encerrado" && inscrito;
    return true;
  });

  function keyFim(evento) {
    const ts = turmasDoEvento(evento);
    let df = null;
    if (ts.length) {
      for (const t of ts) {
        const r = rangeDaTurma(t);
        if (r.df && (!df || r.df > df)) df = r.df;
      }
    }
    if (!df) df = ymd(evento?.data_fim_geral) || "0000-00-00";
    const h = (typeof evento?.horario_fim_geral === "string" && evento.horario_fim_geral.slice(0, 5)) || "23:59";
    return `${df}T${h}`;
  }

  /* --------------------------------- UI --------------------------------- */
  return (
    <main id="conteudo" className="min-h-screen bg-gelo dark:bg-zinc-900">
      <EventosHero onRefresh={atualizarEventos} />

      <div className="px-2 sm:px-4 py-6 max-w-6xl mx-auto">
        {/* Filtros */}
        <section aria-label="Filtros de eventos" className="mb-5">
          <FiltrosEventos
            filtroSelecionado={filtro}
            onFiltroChange={setFiltroNormalizado}
          />
        </section>

        {carregandoEventos ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-live="polite">
            {[...Array(6)].map((_, i) => (<Skeleton key={i} height={200} className="rounded-2xl" />))}
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
              .sort((a, b) => (keyFim(b) > keyFim(a) ? 1 : keyFim(b) < keyFim(a) ? -1 : 0))
              .map((evento, idx) => {
                const ehInstrutor = Boolean(evento.ja_instrutor);
                const st = statusBackendOuFallback(evento);     // ✅ usa backend primeiro
const chipCfg = chip[st];

                return (
                  <motion.article
                    key={evento.id ?? idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.35 }}
                    className="bg-white dark:bg-neutral-900 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700"
                    aria-labelledby={`evt-${evento.id}-titulo`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 id={`evt-${evento.id}-titulo`} className="text-xl font-semibold text-lousa dark:text-white mb-1">
                        {evento.titulo}
                      </h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${chipCfg.cls}`} role="status">
                        {chipCfg.text}
                      </span>
                    </div>

                    {evento.descricao && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{evento.descricao}</p>
                    )}

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
                      <CalendarDays className="w-4 h-4" aria-hidden="true" />
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
                      <div id={`turmas-${evento.id}`} className="mt-3">
                        <ListaTurmasEvento
                          turmas={turmasPorEvento[evento.id]}
                          eventoId={evento.id}
                          eventoTipo={evento.tipo}
                          hoje={new Date()}
                          inscricoesConfirmadas={inscricoesConfirmadas}
                          inscrever={inscrever}
                          inscrevendo={inscrevendo}
                          jaInscritoNoEvento={jaInscritoNoEvento(evento)}
                          jaInstrutorDoEvento={!!evento.ja_instrutor}
                          carregarInscritos={() => {}}
                          carregarAvaliacoes={() => {}}
                          gerarRelatorioPDF={() => {}}
                          mostrarStatusTurma={false}
                          exibirRealizadosTotal
                        />
                      </div>
                    )}
                  </motion.article>
                );
              })}
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
