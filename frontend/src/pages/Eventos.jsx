// ✅ src/pages/Eventos.jsx (revamp com Regras&Dicas + banho visual + 2 colunas + local)
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { motion, useReducedMotion } from "framer-motion";

import { CalendarDays, RefreshCw, MapPin, Info } from "lucide-react";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import FiltrosEventos from "../components/FiltrosEventos";
import ListaTurmasEvento from "../components/ListaTurmasEvento";
import { apiGet, apiPost } from "../services/api";

/* ───────────────── Hero ───────────────── */
function EventosHero({ onRefresh }) {
  return (
    <header className="text-white relative overflow-hidden" role="banner">
      {/* banho visual no topo */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-fuchsia-800 to-indigo-800" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_45%)]" />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">🎓</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow">
            Eventos disponíveis
          </h1>
        </div>
        <p className="mt-2 text-sm sm:text-base text-white/90">
          Inscreva-se em turmas abertas ou consulte detalhes dos eventos.
        </p>
        <div className="mt-4">
          <BotaoPrimario
            onClick={onRefresh}
            variante="secundario"
            icone={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            aria-label="Atualizar lista de eventos"
          >
            Atualizar
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── Regras & Dicas (vermelho, sem progresso) ───────────────── */
function RegrasEDicas() {
  const Card = ({ num, titulo, children }) => (
    <div className="rounded-2xl p-5 sm:p-6 shadow-md border border-rose-200/60 dark:border-rose-800/40 bg-gradient-to-br from-rose-50 via-rose-50 to-rose-100 dark:from-rose-950/40 dark:via-rose-900/40 dark:to-rose-900/30">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-rose-600 text-white grid place-items-center text-sm font-bold">
          {num}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-rose-900 dark:text-rose-200">{titulo}</h4>
          <div className="mt-2 text-sm text-rose-950/90 dark:text-rose-100/90 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );

  return (
    <section aria-labelledby="regras-title" className="my-6">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-5 h-5 text-rose-700 dark:text-rose-300" />
        <h2 id="regras-title" className="text-lg font-bold text-rose-900 dark:text-rose-200">
          Regras & Dicas
        </h2>
      </div>

      {/* máximo 2 colunas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card num="1" titulo="Como se inscrever">
          <p>
            Abra o evento, clique em <strong>Ver turmas</strong>, escolha a turma desejada e confirme em
            <strong> Inscrever-se</strong>. Se a turma exigir pré-requisitos ou registro profissional,
            verifique seu <strong>Perfil</strong> antes.
          </p>
        </Card>

        <Card num="2" titulo="Como cancelar">
          <p>
            Você pode cancelar sua inscrição pela página <strong>Meus cursos</strong> enquanto a turma ainda não começou
            ou de acordo com as regras do edital do evento.
          </p>
        </Card>

        <Card num="3" titulo="Após o término do evento">
          <p>
            Ao finalizar, acesse <strong>Avaliações Pendentes</strong> e preencha a
            <strong> avaliação</strong>. Após o envio da avaliação, o <strong>certificado</strong> fica disponível na página <strong>Meus Certificados</strong>, 
            para download.
          </p>
        </Card>

        <Card num="4" titulo="Dica rápida">
          <p>
            Evite conflitos de horário: ao se inscrever, o sistema alerta se houver choque com outra turma
            em que você já está inscrito.
          </p>
        </Card>
      </div>
    </section>
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

// Horários "mais prováveis"
const HHMM = (s, fb = null) =>
  typeof s === "string" && /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : fb;

function horarioMaisProvavel(t) {
  const conta = new Map();
  const add = (hi, hf) => {
    const a = HHMM(hi, null), b = HHMM(hf, null);
    if (!a || !b) return;
    const k = `${a}-${b}`;
    conta.set(k, (conta.get(k) || 0) + 1);
  };

  if (Array.isArray(t?.encontros)) {
    for (const e of t.encontros) add(e?.inicio || e?.horario_inicio, e?.fim || e?.horario_fim);
  } else if (Array.isArray(t?.datas)) {
    for (const e of t.datas) add(e?.horario_inicio, e?.horario_fim);
  } else if (Array.isArray(t?._datas)) {
    for (const e of t._datas) add(e?.horario_inicio, e?.horario_fim);
  }

  if (conta.size) {
    let best = null, bc = -1;
    for (const [k, c] of conta.entries()) {
      if (c > bc) { best = k; bc = c; }
    }
    const [hi, hf] = best.split("-");
    return { hi, hf };
  }
  const hi = HHMM(t?.horario_inicio, null);
  const hf = HHMM(t?.horario_fim, null);
  if (hi && hf) return { hi, hf };
  return { hi: null, hf: null };
}

const horariosSobrepoem = (ai, af, bi, bf) => {
  if (!ai || !af || !bi || !bf) return false;
  return ai < bf && bi < af;
};
const datasIntersectam = (aIni, aFim, bIni, bFim) => {
  if (!aIni || !aFim || !bIni || !bFim) return false;
  return aIni <= bFim && bIni <= aFim;
};

/** Calcula IDs de turmas em conflito dentro de um evento (só para congresso) */
function calcularConflitosNoEvento(turmas, inscricoesIds) {
  const minhas = new Set(inscricoesIds.map(Number));
  const jaInscritas = turmas.filter((t) => minhas.has(Number(t.id)));
  if (!jaInscritas.length) return new Set();

  // pré-calcula resumos
  const resumo = new Map(
    turmas.map((t) => {
      const r = rangeDaTurma(t);
      const h = horarioMaisProvavel(t);
      return [Number(t.id), { di: r.di, df: r.df, hi: h.hi, hf: h.hf }];
    })
  );

  const conflitos = new Set();
  for (const t of turmas) {
    const A = resumo.get(Number(t.id));
    if (!A) continue;
    for (const m of jaInscritas) {
      if (Number(m.id) === Number(t.id)) continue;
      const B = resumo.get(Number(m.id));
      if (!B) continue;
      const datasOk = A.di && A.df && B.di && B.df && A.di <= B.df && B.di <= A.df;
      if (!datasOk) continue;
      if (horariosSobrepoem(A.hi, A.hf, B.hi, B.hf)) {
        conflitos.add(Number(t.id));
        break;
      }
    }
  }
  return conflitos;
}
function statusBackendOuFallback(evento) {
  if (typeof evento?.status === "string" && evento.status) return evento.status;
  return statusDoEvento(evento);
}

/* ------------------------------------------------------------------ */
/*  Helpers para buscar eventos visíveis                              */
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
  const [inscricoesConfirmadas, setInscricoesConfirmadas] = useState([]);     // [turma_id]
  const [inscricoesDetalhes, setInscricoesDetalhes] = useState([]);           // objetos
  const [conflitosPorEvento, setConflitosPorEvento] = useState({});           // { [eventoId]: Set<number> }
  const [conflitosGlobais, setConflitosGlobais] = useState(new Set());        // Set<turma_id>
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
        const detalhadas = await Promise.all(
          inscricoes.map(async (i) => {
            try {
              const datas = await apiGet(`/api/turmas/${i.turma_id}/datas`);
              return { ...i, _datas: datas };
            } catch { return i; }
          })
        );
        setInscricoesDetalhes(detalhadas);
        const arr = Array.isArray(detalhadas) ? detalhadas : [];
        const idsTurmas = arr.map((i) => Number(i?.turma_id)).filter((n) => Number.isFinite(n));
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
    if (turmasVisiveis[eventoId]) {
      setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: false }));
      return;
    }
    setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: true }));
    if (!turmasPorEvento[eventoId] && !carregandoTurmas) {
      setCarregandoTurmas(eventoId);
      try {
        let turmas = await apiGet(`/api/eventos/${eventoId}/turmas-simples`);
        if (!Array.isArray(turmas)) {
          try {
            const full = await apiGet(`/api/eventos/${eventoId}/turmas`);
            turmas = Array.isArray(full)
              ? full.map((t) => ({
                  id: t.id,
                  evento_id: t.evento_id,
                  nome: t.nome,
                  vagas_total: t.vagas_total,
                  carga_horaria: t.carga_horaria,
                  data_inicio: t.data_inicio?.slice(0, 10) || null,
                  data_fim: t.data_fim?.slice(0, 10) || null,
                  horario_inicio: t.horario_inicio?.slice(0, 5) || null,
                  horario_fim: t.horario_fim?.slice(0, 5) || null,
                  _datas: Array.isArray(t.datas)
                    ? t.datas.map((d) => ({
                        data: d.data,
                        horario_inicio: d.horario_inicio,
                        horario_fim: d.horario_fim,
                      }))
                    : [],
                }))
              : [];
          } catch { turmas = []; }
        }

        const precisaEnriquecer = Array.isArray(turmas) && turmas.some((t) =>
          !t?.horario_inicio && !t?.horario_fim &&
          !(Array.isArray(t?.encontros) && t.encontros.length) &&
          !(Array.isArray(t?.datas) && t.datas.length) &&
          !(Array.isArray(t?._datas) && t._datas.length)
        );
        if (precisaEnriquecer) {
          try {
            const full = await apiGet(`/api/eventos/${eventoId}/turmas`);
            const porId = new Map((Array.isArray(full) ? full : []).map((t) => [Number(t.id), t]));
            turmas = turmas.map((t) => {
              const f = porId.get(Number(t.id));
              if (!f) return t;
              let hi = f.horario_inicio?.slice?.(0, 5) || null;
              let hf = f.horario_fim?.slice?.(0, 5) || null;
              const datasArr = Array.isArray(f.datas) ? f.datas : [];
              if ((!hi || !hf) && datasArr.length) {
                const conta = new Map();
                for (const d of datasArr) {
                  const a = (d?.horario_inicio || "").slice(0, 5);
                  const b = (d?.horario_fim || "").slice(0, 5);
                  if (/^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b)) {
                    const k = `${a}-${b}`;
                    conta.set(k, (conta.get(k) || 0) + 1);
                  }
                }
                if (conta.size) {
                  let best = null, bc = -1;
                  for (const [k, c] of conta.entries()) if (c > bc) { best = k; bc = c; }
                  if (best) [hi, hf] = best.split("-");
                }
              }
              const di = t.data_inicio || f.data_inicio?.slice?.(0, 10) || null;
              const df = t.data_fim || f.data_fim?.slice?.(0, 10) || null;
              return {
                ...t,
                data_inicio: di,
                data_fim: df,
                horario_inicio: t.horario_inicio || hi || null,
                horario_fim: t.horario_fim || hf || null,
                _datas: t._datas || (Array.isArray(f.datas)
                  ? f.datas.map((d) => ({
                      data: d.data,
                      horario_inicio: d.horario_inicio,
                      horario_fim: d.horario_fim,
                    }))
                  : []),
              };
            });
          } catch {}
        }

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

  useEffect(() => {
    const novo = {};
    for (const evt of eventos) {
      const evtId = Number(evt.id);
      const turmas = turmasPorEvento[evtId] || [];
      if (!turmas.length) continue;
      const tipo = String(evt?.tipo || "").toLowerCase();
      if (tipo !== "congresso") continue;
      const conflitos = calcularConflitosNoEvento(turmas, inscricoesConfirmadas);
      if (conflitos.size) novo[evtId] = conflitos;
    }
    setConflitosPorEvento(novo);
  }, [eventos, turmasPorEvento, inscricoesConfirmadas]);

  useEffect(() => {
    const globais = new Set();
    const todasTurmas = [];
    for (const turmas of Object.values(turmasPorEvento)) {
      if (Array.isArray(turmas)) todasTurmas.push(...turmas);
    }
    const resumoTurma = (t) => {
      const { di, df } = rangeDaTurma(t);
      const { hi, hf } = horarioMaisProvavel(t);
      return { di, df, hi, hf };
    };
    for (const t of todasTurmas) {
      const rA = resumoTurma(t);
      if (!rA.di || !rA.df || !rA.hi || !rA.hf) continue;
      for (const i of inscricoesDetalhes) {
        if (Number(i?.turma_id) === Number(t.id)) continue;
        let diB = ymd(i?.data_inicio);
        let dfB = ymd(i?.data_fim);
        let hiB = HHMM(i?.horario_inicio, null);
        let hfB = HHMM(i?.horario_fim, null);
        if (Array.isArray(i?._datas) && i._datas.length) {
          const datasValidas = i._datas.map(d => ({
            data: ymd(d.data),
            hi: HHMM(d.horario_inicio, null),
            hf: HHMM(d.horario_fim, null),
          }));
          for (const d of datasValidas) {
            if (!d.data || !d.hi || !d.hf) continue;
            if (d.data === rA.di && horariosSobrepoem(rA.hi, rA.hf, d.hi, d.hf)) {
              globais.add(Number(t.id));
              break;
            }
          }
          continue;
        }
        if (!diB || !dfB || !hiB || !hfB) continue;
        if (datasIntersectam(rA.di, rA.df, diB, dfB) && horariosSobrepoem(rA.hi, rA.hf, hiB, hfB)) {
          globais.add(Number(t.id));
          break;
        }
      }
    }
    setConflitosGlobais(globais);
  }, [turmasPorEvento, inscricoesDetalhes]);

  const temConflitoGlobalComMinhasInscricoes = (turma) => {
    const { di, df } = rangeDaTurma(turma);
    const { hi, hf } = horarioMaisProvavel(turma);
    if (!di || !df || !hi || !hf) return false;
    for (const i of inscricoesDetalhes) {
      if (Number(i?.turma_id) === Number(turma?.id)) continue;
      if (Array.isArray(i?._datas) && i._datas.length) {
        for (const d of i._datas) {
          const dataB = ymd(d?.data);
          const hiB = HHMM(d?.horario_inicio, null);
          const hfB = HHMM(d?.horario_fim, null);
          if (!dataB || !hiB || !hfB) continue;
          if (dataB === di && horariosSobrepoem(hi, hf, hiB, hfB)) return true;
        }
        continue;
      }
      const diB = ymd(i?.data_inicio);
      const dfB = ymd(i?.data_fim);
      const hiB = HHMM(i?.horario_inicio, null);
      const hfB = HHMM(i?.horario_fim, null);
      if (!diB || !dfB || !hiB || !hfB) continue;
      if (datasIntersectam(di, df, diB, dfB) && horariosSobrepoem(hi, hf, hiB, hfB)) return true;
    }
    return false;
  };

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
    const turmaObj =
      (eventoIdLocal && (turmasPorEvento[eventoIdLocal] || []).find(t => Number(t.id) === Number(turmaId))) ||
      null;

    const tipoEvento = String(eventoReferente?.tipo || "").toLowerCase();
    if (tipoEvento === "congresso") {
      const setConf = conflitosPorEvento[eventoIdLocal];
      if (setConf && setConf.has(Number(turmaId))) {
        toast.warn("Conflito de horário com outra inscrição deste evento.");
        return;
      }
      if (!setConf && turmaObj) {
        const turmas = turmasPorEvento[eventoIdLocal] || [];
        const setCalc = calcularConflitosNoEvento(turmas, inscricoesConfirmadas);
        if (setCalc.has(Number(turmaId))) {
          toast.warn("Conflito de horário com outra inscrição deste evento.");
          return;
        }
      }
    }
    if (conflitosGlobais.has(Number(turmaId))) {
      toast.warn("Conflito de horário com outra turma já inscrita.");
      return;
    }
    if (!conflitosGlobais.has(Number(turmaId)) && turmaObj && temConflitoGlobalComMinhasInscricoes(turmaObj)) {
      toast.warn("Conflito de horário com outra turma já inscrita.");
      return;
    }

    setInscrevendo(turmaId);
    try {
      await apiPost("/api/inscricoes", { turma_id: turmaId });
      toast.success("✅ Inscrição realizada com sucesso!");
      try {
        const inscricoesUsuario = await apiGet("/api/inscricoes/minhas");
        const arr = Array.isArray(inscricoesUsuario) ? inscricoesUsuario : [];
        const novasInscricoes = arr.map((i) => Number(i?.turma_id)).filter((n) => Number.isFinite(n));
        setInscricoesConfirmadas(novasInscricoes);
        setInscricoesDetalhes(arr);
      } catch { toast.warn("⚠️ Não foi possível atualizar inscrições confirmadas."); }
      await atualizarEventos();

      const eventoId =
        eventoIdLocal ||
        Object.keys(turmasPorEvento).find((id) =>
          (turmasPorEvento[id] || []).some((t) => Number(t.id) === Number(turmaId))
        );
      if (eventoId) {
        try {
          const turmasAtualizadas = await apiGet(`/api/eventos/${eventoId}/turmas-simples`);
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

  // Chips sólidos
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

  // nunca mostrar encerrados sem inscrição prévia
  const eventosFiltrados = eventos.filter((evento) => {
    const st = statusBackendOuFallback(evento);
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
        {/* Regras & Dicas em vermelho, no topo da lista */}
        <RegrasEDicas />

        {/* Filtros */}
        <section aria-label="Filtros de eventos" className="mb-5">
          <FiltrosEventos
            filtroSelecionado={filtro}
            onFiltroChange={setFiltroNormalizado}
          />
        </section>

        {carregandoEventos ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-live="polite">
            {[...Array(6)].map((_, i) => (<Skeleton key={i} height={220} className="rounded-2xl" />))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center">{erro}</p>
        ) : eventosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum evento encontrado para esse filtro."
            sugestao="Experimente outra opção acima ou aguarde novas turmas."
          />
        ) : (
          // 🔥 Máximo 2 colunas
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...eventosFiltrados]
              .sort((a, b) => (keyFim(b) > keyFim(a) ? 1 : keyFim(b) < keyFim(a) ? -1 : 0))
              .map((evento, idx) => {
                const ehInstrutor = Boolean(evento.ja_instrutor);
                const st = statusBackendOuFallback(evento);
                const chipCfg = chip[st];

                const turmasEvento = turmasDoEvento(evento);
                const conflitosGlobaisDoEvento = new Set(
                  turmasEvento.filter((t) => conflitosGlobais.has(Number(t.id))).map((t) => Number(t.id))
                );
                const conflitosInternos = conflitosPorEvento[evento.id] || new Set();
                const conflitosSet = new Set([
                  ...Array.from(conflitosInternos),
                  ...Array.from(conflitosGlobaisDoEvento),
                ]);

                const localEvento =
                  evento.local ||
                  evento.localizacao ||
                  evento.endereco ||
                  evento.localidade ||
                  null;

                return (
                  <motion.article
                    key={evento.id ?? idx}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.35 }}
                    className="group rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-neutral-900 shadow-md hover:shadow-xl transition-shadow"
                    aria-labelledby={`evt-${evento.id}-titulo`}
                  >
                    {/* faixa destaque */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500" />

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 id={`evt-${evento.id}-titulo`} className="text-xl font-extrabold text-zinc-900 dark:text-white">
                          {evento.titulo}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${chipCfg.cls}`} role="status">
                          {chipCfg.text}
                        </span>
                      </div>

                      {evento.descricao && (
                        <p className="mt-1.5 text-[15px] text-zinc-700 dark:text-zinc-300">
                          {evento.descricao}
                        </p>
                      )}

                      {/* Local do curso */}
                      <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />
                        <span>{localEvento || "Local a definir"}</span>
                      </div>

                      {/* Datas gerais */}
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {evento.data_inicio_geral && evento.data_fim_geral
                            ? `${formatarDataCurtaSeguro(evento.data_inicio_geral)} até ${formatarDataCurtaSeguro(evento.data_fim_geral)}`
                            : "Datas a definir"}
                        </span>
                      </div>

                      {ehInstrutor && (
                        <div className="mt-2 text-xs font-semibold inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                          Você é instrutor deste evento
                        </div>
                      )}

                      {/* Instrutores / Público */}
                      <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
                        <p className="text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">Instrutor(es): </span>
                          <span className="text-zinc-800 dark:text-white">
                            {Array.isArray(evento.instrutor) && evento.instrutor.length
                              ? evento.instrutor.map((i) => i.nome).join(", ")
                              : "A definir"}
                          </span>
                        </p>
                        {evento.publico_alvo && (
                          <p className="text-zinc-600 dark:text-zinc-400">
                            <span className="font-medium text-zinc-800 dark:text-zinc-200">Público-alvo: </span>
                            <span className="text-zinc-800 dark:text-white">{evento.publico_alvo}</span>
                          </p>
                        )}
                      </div>

                      <div className="mt-4">
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
                      </div>

                      {turmasVisiveis[evento.id] && turmasPorEvento[evento.id] && (
                        <div id={`turmas-${evento.id}`} className="mt-4">
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
                            turmasEmConflito={[...conflitosSet]}
                          />
                        </div>
                      )}
                    </div>
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
