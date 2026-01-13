// ✅ src/pages/Eventos.jsx — Página ÚNICA (Eventos + Minhas inscrições) — PREMIUM
// - Lista Programados/Em andamento (ASC por início)
// - Card full width com banner (folder_url) + botão de programação (programacao_pdf_url)
// - Após inscrição: Cancelar e Google Agenda
// - Regras & Dicas em modal
//
// ✅ Fixes aplicados (mantidos):
// 1) Banner /uploads -> resolve para VITE_API_URL (backend)
// 2) PDF abre via window.open (não navega no SPA, não “reinicia”)
// 3) Remove botão “pasta do evento”
// 4) “Baixar programação (PDF)” + “Ver turmas” na mesma linha (responsivo)
// 5) Premium UI: header + ministats + cards mais elegantes + estados de erro melhores
//
// ✅ Premium extra (sem mudar regras):
// - AbortController + mountedRef (evita race conditions ao atualizar rápido)
// - Reduced-motion (respeita acessibilidade)
// - Progressbar sticky durante carregamentos
// - Stats de “andamento” usando status real/fallback
//
// ✅ Alteração solicitada:

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  RefreshCw,
  MapPin,
  Info,
  BookOpen,
  Clock,
  XCircle,
  X,
  CalendarPlus,
  Download,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import ListaTurmasEvento from "../components/ListaTurmasEvento";
import ModalConfirmacao from "../components/ModalConfirmacao";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";

/* ───────────────── Helpers globais ───────────────── */
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/* ───────────────── URL helpers (resolve /uploads do backend) ───────────── */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "";

function withBackendBase(u) {
  if (!u) return null;
  const s = String(u);

  // já é absoluta
  if (/^https?:\/\//i.test(s)) return s;

  // caminho do backend (/uploads/...)
  if (s.startsWith("/")) {
    const base = String(API_BASE || "").replace(/\/+$/g, "");
    return base ? `${base}${s}` : s;
  }

  return null;
}

function safeHref(u) {
  return withBackendBase(u) || null;
}

function openExternal(href) {
  if (!href) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

/* ───────────────── Status ───────────────── */
function statusText(dataInicioISO, dataFimISO, horarioInicio, horarioFim) {
  const fimISO = dataFimISO || dataInicioISO;
  const di = String(dataInicioISO || "").slice(0, 10);
  const df = String(fimISO || "").slice(0, 10);
  const hi = String(horarioInicio || "00:00").slice(0, 5);
  const hf = String(horarioFim || "23:59").slice(0, 5);

  const inicio = di ? new Date(`${di}T${hi}:00`) : null;
  const fim = df ? new Date(`${df}T${hf}:59`) : null;
  const now = new Date();

  if (inicio && fim && isValidDate(inicio) && isValidDate(fim)) {
    if (now < inicio) return { status: "Programado", tone: "success" };
    if (now > fim) return { status: "Encerrado", tone: "danger" };
    return { status: "Em andamento", tone: "warning" };
  }
  return { status: "Programado", tone: "success" };
}

function badgeClasses(status) {
  if (status === "Programado") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/50";
  }
  if (status === "Em andamento") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/50";
  }
  return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-200/70 dark:border-rose-800/50";
}

/* ------------------------------------------------------------------ */
/*  Helpers de data/formatadores                                      */
/* ------------------------------------------------------------------ */
const MESES_ABREV_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");

function formatarDataCurtaSeguro(iso) {
  if (!iso) return "";
  const [data] = String(iso).split("T");
  const partes = data.split("-");
  if (partes.length !== 3) return "";
  const [ano, mes, dia] = partes;
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));
  return `${String(dia).padStart(2, "0")} de ${MESES_ABREV_PT[idx]} de ${ano}`;
}

const HOJE_ISO = (() => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

const inRange = (di, df, dia) => !!di && !!df && di <= dia && dia <= df;

function rangeDaTurma(t) {
  let di = null;
  let df = null;
  const push = (x) => {
    const d = ymd(typeof x === "string" ? x : x?.data);
    if (!d) return;
    if (!di || d < di) di = d;
    if (!df || d > df) df = d;
  };

  if (Array.isArray(t?.encontros) && t.encontros.length) t.encontros.forEach(push);
  else if (Array.isArray(t?.datas) && t.datas.length) t.datas.forEach(push);
  else if (Array.isArray(t?._datas) && t._datas.length) t._datas.forEach(push);
  else {
    push(t?.data_inicio);
    push(t?.data_fim);
  }
  return { di, df };
}

/* ------------------------------------------------------------------ */
/*  UI: Hero + Ministats                                              */
/* ------------------------------------------------------------------ */
function EventosHero({ onRefresh, stats }) {
  return (
    <header className="text-white relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-900 via-fuchsia-800 to-indigo-800" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.10),transparent_42%),radial-gradient(circle_at_85%_35%,rgba(255,255,255,0.08),transparent_45%)]" />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">
            🎓
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow">
            Eventos disponíveis
          </h1>
        </div>

        <p className="mt-2 text-sm sm:text-base text-white/90">
          Inscreva-se em turmas abertas ou acompanhe suas inscrições ativas.
        </p>

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <BotaoPrimario
            onClick={onRefresh}
            variante="secundario"
            icone={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
            aria-label="Atualizar lista de eventos"
          >
            Atualizar
          </BotaoPrimario>
          <RegrasDicasButton />
        </div>

        {/* ministats */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniStat
            icon={<Sparkles className="w-4 h-4" />}
            label="Eventos disponíveis"
            value={stats?.eventosDisponiveis ?? 0}
          />
          <MiniStat
            icon={<BookOpen className="w-4 h-4" />}
            label="Minhas inscrições ativas"
            value={stats?.inscricoesAtivas ?? 0}
          />
          <MiniStat
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Eventos em andamento"
            value={stats?.eventosAndamento ?? 0}
          />
        </div>
      </div>
    </header>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3 text-left shadow-sm">
      <div className="flex items-center gap-2 text-white/90">
        <span className="inline-flex w-8 h-8 rounded-xl bg-white/10 items-center justify-center">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs text-white/80">{label}</div>
          <div className="text-xl font-extrabold tracking-tight">{Number(value) || 0}</div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Regras & Dicas (modal) ───────────────── */
function RegrasDicasButton() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  return (
    <>
      <BotaoSecundario
        onClick={() => setOpen(true)}
        icone={<Info className="w-4 h-4" aria-hidden="true" />}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Regras & Dicas
      </BotaoSecundario>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <motion.div
              initial={reduceMotion ? false : { y: 30, opacity: 0 }}
              animate={reduceMotion ? {} : { y: 0, opacity: 1 }}
              exit={reduceMotion ? {} : { y: 20, opacity: 0 }}
              className="relative w-full max-w-2xl rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500" />

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
                    <Info className="w-5 h-5 text-rose-600" /> Regras & Dicas
                  </h2>
                  <button
                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <Tip num="1" titulo="Como se inscrever">
                    Abra o evento, clique em <strong>Ver turmas</strong>, escolha a turma e confirme em{" "}
                    <strong>Inscrever-se</strong>. Se houver pré-requisito/registro, ajuste no seu{" "}
                    <strong>Perfil</strong>.
                  </Tip>
                  <Tip num="2" titulo="Como cancelar">
                    Após a inscrição, surgem os botões <strong>Cancelar inscrição</strong> e{" "}
                    <strong>Google Agenda</strong> (quando permitido).
                  </Tip>
                  <Tip num="3" titulo="Após o término do curso">
                    Preencha a <strong>avaliação</strong> em <em>Avaliações Pendentes</em> para liberar seu{" "}
                    <strong>certificado</strong> em <em>Meus Certificados</em>.
                  </Tip>
                  <Tip num="4" titulo="Evite choque de horários">
                    O sistema alerta sobre conflito entre turmas do mesmo horário.
                  </Tip>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Tip({ num, titulo, children }) {
  return (
    <div className="rounded-2xl p-4 border border-rose-200/60 dark:border-rose-800/40 bg-gradient-to-br from-rose-50 via-rose-50 to-rose-100 dark:from-rose-950/40 dark:via-rose-900/40 dark:to-rose-900/30">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-7 h-7 rounded-full bg-rose-600 text-white grid place-items-center text-sm font-bold">
          {num}
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-rose-900 dark:text-rose-200">{titulo}</h4>
          <div className="mt-1.5 text-sm text-rose-950/90 dark:text-rose-100/90 leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Componentes de mídia/ações do card                                */
/* ------------------------------------------------------------------ */
function BannerEvento({ titulo, src }) {
  const href = safeHref(src);
  const [ok, setOk] = useState(true);

  return (
    <div className="relative w-full h-44 sm:h-52 bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 overflow-hidden">
      {href && ok ? (
        <img
          src={href}
          alt={`Banner do evento: ${titulo}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon className="w-4 h-4" />
            <span>Sem imagem do evento</span>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
    </div>
  );
}

function BotaoProgramacao({ programacaoPdfUrl }) {
  const pdfHref = safeHref(programacaoPdfUrl);
  if (!pdfHref) return null;

  return (
    <BotaoSecundario
      type="button"
      onClick={() => openExternal(pdfHref)}
      icone={<Download className="w-4 h-4" />}
      aria-label="Baixar programação (PDF)"
      title="Baixar programação (PDF)"
      className="whitespace-nowrap"
    >
      Baixar programação (PDF)
    </BotaoSecundario>
  );
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */
export default function Eventos() {
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [turmasVisiveis, setTurmasVisiveis] = useState({});
  const [inscricoes, setInscricoes] = useState([]);
  const [inscricoesTurmaIds, setInscricoesTurmaIds] = useState([]);
  const [erro, setErro] = useState("");
  const [inscrevendo, setInscrevendo] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [carregandoTurmas, setCarregandoTurmas] = useState(null);
  const [carregandoEventos, setCarregandoEventos] = useState(true);

  // ✅ Modal premium 
  const [confirmCancel, setConfirmCancel] = useState({
    open: false,
    turmaId: null,
    inscricaoId: null,
    turmaNome: "",
  });

  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const abortEventosRef = useRef(null);
  const abortInscricoesRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortEventosRef.current?.abort?.("unmount");
      abortInscricoesRef.current?.abort?.("unmount");
    };
  }, []);

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {}
  const usuarioId = Number(usuario?.id) || null;

  /* -------------------- util de eventos -------------------- */
  const extrairListaEventos = useCallback((res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.eventos)) return res.eventos;
    if (Array.isArray(res?.data?.eventos)) return res.data.eventos;
    return [];
  }, []);

  const filtrarVisiveis = useCallback(async (lista) => {
    const checks = (lista || []).map(async (e) => {
      try {
        const r = await apiGet(`/api/eventos/${e.id}/visivel`);
        return r?.ok ? e : null;
      } catch {
        return null;
      }
    });
    const arr = await Promise.all(checks);
    return arr.filter(Boolean);
  }, []);

  const turmasDoEvento = useCallback(
    (evento) => {
      const carregadas = turmasPorEvento[evento.id];
      if (Array.isArray(carregadas) && carregadas.length) return carregadas;
      if (Array.isArray(evento?.turmas) && evento.turmas.length) return evento.turmas;
      return [];
    },
    [turmasPorEvento]
  );

  const statusDoEvento = useCallback(
    (evento, turmasCarregadas) => {
      const ts =
        Array.isArray(turmasCarregadas) && turmasCarregadas.length
          ? turmasCarregadas
          : turmasDoEvento(evento);

      if (ts.length) {
        let andamento = false;
        let futuro = false;
        let todosPassados = true;

        for (const t of ts) {
          const { di, df } = rangeDaTurma(t);
          if (inRange(di, df, HOJE_ISO)) andamento = true;
          if (di && di > HOJE_ISO) futuro = true;
          if (!(df && df < HOJE_ISO)) todosPassados = false;
        }

        if (andamento) return "andamento";
        if (futuro && !todosPassados) return "programado";
        if (todosPassados) return "encerrado";
        return "programado";
      }

      const diG = ymd(evento?.data_inicio_geral);
      const dfG = ymd(evento?.data_fim_geral);
      if (inRange(diG, dfG, HOJE_ISO)) return "andamento";
      if (diG && diG > HOJE_ISO) return "programado";
      if (dfG && dfG < HOJE_ISO) return "encerrado";
      return "programado";
    },
    [turmasDoEvento]
  );

  const statusBackendOuFallback = useCallback(
    (evento, turmasCarregadas) => {
      if (typeof evento?.status === "string" && evento.status) return evento.status;
      return statusDoEvento(evento, turmasCarregadas);
    },
    [statusDoEvento]
  );

  const keyInicio = useCallback((evento, mapaTurmas) => {
    const ts = mapaTurmas[evento.id] || evento?.turmas || [];
    let di = null;

    if (Array.isArray(ts) && ts.length) {
      for (const t of ts) {
        const r = rangeDaTurma(t);
        if (r.di && (!di || r.di < di)) di = r.di;
      }
    }

    if (!di) di = ymd(evento?.data_inicio_geral) || "9999-12-31";

    const h =
      (typeof evento?.horario_inicio_geral === "string" &&
        evento.horario_inicio_geral.slice(0, 5)) ||
      "00:00";

    return new Date(`${di}T${h}:00`).getTime();
  }, []);

  /* -------------------- carregamentos -------------------- */
  const carregarInscricoes = useCallback(async () => {
    try {
      abortInscricoesRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortInscricoesRef.current = ctrl;

      const data = await apiGet("/api/inscricoes/minhas", { signal: ctrl.signal }).catch(() => []);
      const arr = Array.isArray(data) ? data : [];

      const ativas = arr.filter((it) => {
        const { status } = statusText(it.data_inicio, it.data_fim, it.horario_inicio, it.horario_fim);
        const fimISO = (it.data_fim || it.data_inicio || "").slice(0, 10);
        const hojeISO = new Date().toISOString().slice(0, 10);
        const encerrado = fimISO && fimISO < hojeISO;
        return (status === "Programado" || status === "Em andamento") && !encerrado;
      });

      if (!mountedRef.current) return;
      setInscricoes(ativas);
      setInscricoesTurmaIds(ativas.map((i) => Number(i?.turma_id)).filter((n) => Number.isFinite(n)));
    } catch {
      toast.error("Erro ao carregar suas inscrições ativas.");
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    setLive("Carregando eventos…");
    setErro("");

    try {
      abortEventosRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortEventosRef.current = ctrl;

      const res1 = await apiGet("/api/eventos/para-mim/lista", { signal: ctrl.signal }).catch(() => []);
      const lista1 = extrairListaEventos(res1);

      let lista =
        Array.isArray(lista1) && lista1.length
          ? lista1
          : await filtrarVisiveis(extrairListaEventos(await apiGet("/api/eventos", { signal: ctrl.signal })));

      const elegiveis = lista.filter((e) => {
        const st = statusBackendOuFallback(e, turmasPorEvento[e.id]);
        return st === "programado" || st === "andamento";
      });

      elegiveis.sort((a, b) => keyInicio(a, turmasPorEvento) - keyInicio(b, turmasPorEvento));

      if (!mountedRef.current) return;
      setEventos(elegiveis);
      setErro("");
      setLive("Eventos atualizados.");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setErro("Erro ao carregar eventos");
      toast.error("❌ Erro ao carregar eventos");
      setLive("Falha ao carregar eventos.");
    } finally {
      if (mountedRef.current) setCarregandoEventos(false);
    }
  }, [extrairListaEventos, filtrarVisiveis, statusBackendOuFallback, turmasPorEvento, keyInicio]);

  useEffect(() => {
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarInscricoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const eventosDisponiveis = Array.isArray(eventos) ? eventos.length : 0;
    const inscricoesAtivas = Array.isArray(inscricoesTurmaIds) ? inscricoesTurmaIds.length : 0;

    // premium: “andamento” usando o mesmo status real/fallback
    const eventosAndamento = (eventos || []).filter((e) => {
      const st = statusBackendOuFallback(e, turmasPorEvento[e.id]);
      return st === "andamento";
    }).length;

    return { eventosDisponiveis, inscricoesAtivas, eventosAndamento };
  }, [eventos, inscricoesTurmaIds, statusBackendOuFallback, turmasPorEvento]);

  /* -------------------- carregar turmas de um evento -------------------- */
  const carregarTurmas = useCallback(
    async (eventoId) => {
      // toggle rápido (sem refetch)
      if (turmasVisiveis[eventoId]) {
        setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: false }));
        return;
      }
      setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: true }));

      // se já tem turmas, não refaz chamada
      if (turmasPorEvento[eventoId] || carregandoTurmas) return;

      setCarregandoTurmas(eventoId);
      try {
        let turmas = await apiGet(`/api/eventos/${eventoId}/turmas-simples`).catch(() => []);
        if (!Array.isArray(turmas)) turmas = [];

        // fallback para endpoint full (mantém sua lógica)
        if (!turmas.length) {
          try {
            const full = await apiGet(`/api/eventos/${eventoId}/turmas`).catch(() => []);
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
          } catch {
            turmas = [];
          }
        }

        if (!mountedRef.current) return;

        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: turmas }));

        // reordena lista após carregar turmas (para ajustar “início” real)
        setEventos((prev) =>
          [...prev].sort(
            (a, b) =>
              keyInicio(a, { ...turmasPorEvento, [eventoId]: turmas }) -
              keyInicio(b, { ...turmasPorEvento, [eventoId]: turmas })
          )
        );
      } catch {
        toast.error("Erro ao carregar turmas");
      } finally {
        if (mountedRef.current) setCarregandoTurmas(null);
      }
    },
    [turmasVisiveis, turmasPorEvento, carregandoTurmas, keyInicio]
  );

  /* -------------------- Google Agenda (robusto) -------------------- */
  const buildAgendaHref = useCallback(
    ({ titulo, data_inicio, data_fim, horario_inicio, horario_fim, turma_nome, local }) => {
      try {
        return gerarLinkGoogleAgenda({
          titulo: turma_nome ? `${titulo} — ${turma_nome}` : titulo,
          data_inicio,
          data_fim,
          horario_inicio,
          horario_fim,
          local,
        });
      } catch {
        return null;
      }
    },
    []
  );

  /* -------------------- inscrever / cancelar -------------------- */
  const inscrever = useCallback(
    async (turmaId, eventoId) => {
      if (inscrevendo) return;

      const eventoRef = eventos.find((e) => Number(e.id) === Number(eventoId));
      const ehInstrutor =
        Boolean(eventoRef?.ja_instrutor) ||
        (Array.isArray(eventoRef?.instrutor) &&
          usuarioId &&
          eventoRef.instrutor.some((i) => Number(i.id) === Number(usuarioId)));

      if (ehInstrutor) {
        toast.warn("Você é instrutor deste evento e não pode se inscrever como participante.");
        return;
      }

      setInscrevendo(turmaId);
      try {
        await apiPost("/api/inscricoes", { turma_id: turmaId });
        toast.success("✅ Inscrição realizada com sucesso!");
        await carregarInscricoes();

        // atualiza turmas do evento (para refletir vagas/inscrito)
        try {
          const turmasAtualizadas = await apiGet(`/api/eventos/${eventoId}/turmas-simples`).catch(() => []);
          setTurmasPorEvento((prev) => ({
            ...prev,
            [eventoId]: Array.isArray(turmasAtualizadas) ? turmasAtualizadas : [],
          }));
        } catch {}
      } catch (err) {
        const status = err?.status ?? err?.response?.status ?? err?.data?.status ?? err?.response?.data?.status;
        const serverMsg =
          err?.data?.erro ??
          err?.response?.erro ??
          err?.response?.data?.erro ??
          err?.data?.message ??
          err?.response?.data?.message;

        const msg = serverMsg || err?.message || "Erro ao se inscrever.";
        if (status === 409) toast.warn(msg);
        else if (status === 400) toast.error(msg);
        else if (status === 403 && err?.response?.data?.motivo) {
          const motivo = err.response.data.motivo;
          if (motivo === "SEM_REGISTRO") toast.error("Inscrição bloqueada: informe seu Registro no perfil.");
          else if (motivo === "REGISTRO_NAO_AUTORIZADO")
            toast.error("Inscrição bloqueada: seu Registro não está autorizado para este curso.");
          else toast.error("Acesso negado para este curso.");
        } else {
          console.error("❌ Erro inesperado:", err);
          toast.error("❌ Erro ao se inscrever.");
        }
      } finally {
        setInscrevendo(null);
      }
    },
    [inscrevendo, eventos, usuarioId, carregarInscricoes]
  );

  const getInscricaoPorTurmaId = useCallback(
    (turmaId) => inscricoes.find((i) => Number(i?.turma_id) === Number(turmaId)) || null,
    [inscricoes]
  );

  // ✅ agora só abre ModalConfirmacao 
  const cancelarInscricaoByTurmaId = useCallback(
    async (turmaId, turmaNome = "") => {
      const reg = getInscricaoPorTurmaId(turmaId);
      const inscricaoId = reg?.inscricao_id || reg?.id;

      if (!inscricaoId) {
        toast.info("Não foi possível localizar a inscrição para cancelar.");
        return;
      }

      setConfirmCancel({
        open: true,
        turmaId: Number(turmaId),
        inscricaoId: Number(inscricaoId),
        turmaNome: String(turmaNome || reg?.turma_nome || reg?.turma || "").trim(),
      });
    },
    [getInscricaoPorTurmaId]
  );

  // ✅ executa cancelamento após confirmar no modal
  const executarCancelamento = useCallback(async () => {
    const inscricaoId = confirmCancel?.inscricaoId;

    if (!inscricaoId) {
      setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
      return;
    }

    setCancelandoId(inscricaoId);

    try {
      await apiDelete(`/api/inscricoes/${inscricaoId}`);
      toast.success("✅ Inscrição cancelada com sucesso.");
      await carregarInscricoes();
    } catch (err) {
      const status = err?.status || err?.response?.status || 0;
      const data = err?.data || err?.response?.data || {};
      const msg = data?.mensagem || data?.message || err?.message || "Sem conexão";
      toast.error(`❌ Erro ao cancelar inscrição${status ? ` (${status})` : ""}. ${msg}`);
    } finally {
      setCancelandoId(null);
      setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
    }
  }, [confirmCancel?.inscricaoId, carregarInscricoes]);

  const isCancelModalLoading = cancelandoId && cancelandoId === confirmCancel?.inscricaoId;

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <EventosHero
        stats={stats}
        onRefresh={async () => {
          await carregarEventos();
          await carregarInscricoes();
        }}
      />

      {/* progress bar sticky (premium) */}
      {carregandoEventos && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-fuchsia-100 dark:bg-fuchsia-950/30 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando eventos"
        >
          <div className={`h-full bg-fuchsia-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <main id="conteudo" className="px-2 sm:px-4 py-6 max-w-6xl mx-auto">
        {carregandoEventos ? (
          <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-live="polite">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={320} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-4 text-center ring-1 ring-rose-200/50 dark:ring-rose-900/30">
            <div className="inline-flex items-center gap-2 text-rose-800 dark:text-rose-200 font-extrabold">
              <AlertTriangle className="w-4 h-4" /> {erro}
            </div>
            <div className="mt-3 flex justify-center">
              <BotaoPrimario
                onClick={async () => {
                  await carregarEventos();
                  await carregarInscricoes();
                }}
                icone={<RefreshCw className="w-4 h-4" />}
              >
                Tentar novamente
              </BotaoPrimario>
            </div>
          </div>
        ) : eventos.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum evento programado ou em andamento."
            sugestao="Novas turmas serão abertas em breve."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {eventos.map((evento, idx) => {
              const localEvento =
                evento.local || evento.localizacao || evento.endereco || evento.localidade || null;
              const statusEvt = statusBackendOuFallback(evento, turmasPorEvento[evento.id]);
              const ehInstrutor = Boolean(evento.ja_instrutor);

              // schema atual (banco): folder_url e programacao_pdf_url
              const programacaoPdfUrl =
                evento.programacao_pdf_url ||
                evento.programacao_pdf ||
                evento.programacao_url ||
                null;
              const folderUrl = evento.folder_url || evento.folder || null;

              return (
                <motion.article
                  key={evento.id ?? idx}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="group rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-neutral-900 shadow-md hover:shadow-xl transition-shadow"
                  aria-labelledby={`evt-${evento.id}-titulo`}
                >
                  {/* Banner */}
                  <BannerEvento titulo={evento.titulo} src={folderUrl} />

                  {/* faixa destaque */}
                  <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500" />

                  <div className="p-5">
                    {/* Título + status */}
                    <div className="flex items-start justify-between gap-3">
                      <h3
                        id={`evt-${evento.id}-titulo`}
                        className="text-xl font-extrabold text-zinc-900 dark:text-white"
                      >
                        {evento.titulo}
                      </h3>

                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          statusEvt === "andamento"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        }`}
                        role="status"
                      >
                        {statusEvt === "andamento" ? "Em andamento" : "Programado"}
                      </span>
                    </div>

                    {evento.descricao && (
                      <p className="mt-1.5 text-[15px] text-zinc-700 dark:text-zinc-300">
                        {evento.descricao}
                      </p>
                    )}

                    {/* Local */}
                    <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />
                      <span>{localEvento || "Local a definir"}</span>
                    </div>

                    {/* Datas gerais */}
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {evento.data_inicio_geral && evento.data_fim_geral
                          ? `${formatarDataCurtaSeguro(evento.data_inicio_geral)} até ${formatarDataCurtaSeguro(
                              evento.data_fim_geral
                            )}`
                          : "Datas a definir"}
                      </span>
                    </div>

                    {ehInstrutor && (
                      <div className="mt-2 text-xs font-extrabold inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                        Você é instrutor deste evento
                      </div>
                    )}

                    {/* Ações principais (mesma linha) */}
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <BotaoProgramacao programacaoPdfUrl={programacaoPdfUrl} />
                      </div>

                      <BotaoPrimario
                        onClick={() => carregarTurmas(evento.id)}
                        disabled={carregandoTurmas === evento.id}
                        aria-expanded={!!turmasVisiveis[evento.id]}
                        aria-controls={`turmas-${evento.id}`}
                        className="sm:min-w-[160px]"
                      >
                        {carregandoTurmas === evento.id
                          ? "Carregando..."
                          : turmasVisiveis[evento.id]
                          ? "Ocultar turmas"
                          : "Ver turmas"}
                      </BotaoPrimario>
                    </div>

                    {/* Lista de turmas */}
                    {turmasVisiveis[evento.id] && turmasPorEvento[evento.id] && (
                      <div id={`turmas-${evento.id}`} className="mt-4">
                        <ListaTurmasEvento
                          turmas={turmasPorEvento[evento.id]}
                          eventoId={evento.id}
                          eventoTipo={evento.tipo}
                          hoje={new Date()}
                          inscricoesConfirmadas={inscricoesTurmaIds}
                          inscrever={(tid) => inscrever(tid, evento.id)}
                          inscrevendo={inscrevendo}
                          jaInscritoNoEvento={(() => {
                            const ids = new Set(inscricoesTurmaIds);
                            return (turmasPorEvento[evento.id] || []).some((t) => ids.has(Number(t.id)));
                          })()}
                          jaInstrutorDoEvento={!!evento.ja_instrutor}
                          carregarInscritos={() => {}}
                          carregarAvaliacoes={() => {}}
                          gerarRelatorioPDF={() => {}}
                          mostrarStatusTurma={false}
                          exibirRealizadosTotal
                          turmasEmConflito={[]}
                        />
                      </div>
                    )}

                    {/* AÇÕES RÁPIDAS APÓS INSCRIÇÃO */}
                    {turmasVisiveis[evento.id] && (
                      <InscricoesAcoesRapidas
                        evento={evento}
                        turmas={turmasPorEvento[evento.id] || []}
                        inscricoes={inscricoes}
                        cancelarInscricaoByTurmaId={cancelarInscricaoByTurmaId}
                        buildAgendaHref={buildAgendaHref}
                        cancelandoId={cancelandoId}
                      />
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      {/* ✅ ModalConfirmacao */}
      <ModalConfirmacao
        /* compat: alguns projetos usam 'open/titulo/descricao/confirmarTexto/cancelarTexto/onConfirmar/onCancelar' */
        isOpen={!!confirmCancel.open}
        open={!!confirmCancel.open}

       title="Cancelar inscrição?"
        titulo="Cancelar inscrição?"

        description={
          confirmCancel?.turmaNome
            ? `Tem certeza que deseja cancelar sua inscrição na turma:\n\n“${confirmCancel.turmaNome}”?`
            : "Tem certeza que deseja cancelar sua inscrição nesta turma?"
       }
        descricao={
          confirmCancel?.turmaNome
            ? `Tem certeza que deseja cancelar sua inscrição na turma:\n\n“${confirmCancel.turmaNome}”?`
            : "Tem certeza que deseja cancelar sua inscrição nesta turma?"
        }

        confirmText="Sim, cancelar"
       confirmarTexto="Sim, cancelar"
        cancelText="Não"
        cancelarTexto="Não"
        danger
        loading={!!isCancelModalLoading}

        onClose={() => {
         if (cancelandoId) return; // evita fechar durante requisição
          setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
        }}
        onCancelar={() => {
          if (cancelandoId) return;
          setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
        }}

        onConfirm={executarCancelamento}
        onConfirmar={executarCancelamento}
      />
    </div>
  );
}

/* ────────────────────────────── Bloco de ações por turma inscrita ────────────────────────────── */
function InscricoesAcoesRapidas({
  evento,
  turmas,
  inscricoes,
  cancelarInscricaoByTurmaId,
  buildAgendaHref,
  cancelandoId,
}) {
  if (!Array.isArray(turmas) || turmas.length === 0) return null;

  const porTurma = new Map();
  for (const i of inscricoes) {
    const tId = Number(i?.turma_id);
    if (!Number.isFinite(tId)) continue;
    if (turmas.some((t) => Number(t.id) === tId)) porTurma.set(tId, i);
  }

  const minhasTurmas = turmas.filter((t) => porTurma.has(Number(t.id)));
  if (!minhasTurmas.length) return null;

  return (
    <div className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-4">
      <h4 className="text-sm font-extrabold flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4" /> Minhas inscrições neste evento
      </h4>

      <ul className="space-y-3">
        {minhasTurmas.map((t) => {
          const reg = porTurma.get(Number(t.id));
          const agendaHref = buildAgendaHref({
            titulo: evento.titulo,
            data_inicio: t.data_inicio,
            data_fim: t.data_fim,
            horario_inicio: t.horario_inicio,
            horario_fim: t.horario_fim,
            turma_nome: t.nome,
            local: evento.local || evento.localizacao || evento.endereco || evento.localidade,
          });

          const status = statusText(t.data_inicio, t.data_fim, t.horario_inicio, t.horario_fim).status;

          return (
            <li
              key={t.id}
              className="rounded-2xl bg-white dark:bg-neutral-900 border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> {t.nome || "Turma"}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${badgeClasses(status)}`}>
                      {status}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {t.horario_inicio && t.horario_fim
                        ? `${String(t.horario_inicio).slice(0, 5)} às ${String(t.horario_fim).slice(0, 5)}`
                        : "Horário a definir"}
                    </span>

                    {t.data_inicio && (
                      <span>
                        {formatarDataCurtaSeguro(t.data_inicio)}
                        {t.data_fim ? ` — ${formatarDataCurtaSeguro(t.data_fim)}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <BotaoSecundario
                    as="a"
                    href={agendaHref || "#"}
                    onClick={(e) => {
                      if (!agendaHref) {
                        e.preventDefault();
                        toast.info("Não foi possível gerar o link do Google Agenda.");
                      }
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sm:min-w-[180px]"
                    icone={<CalendarPlus className="w-4 h-4" />}
                    aria-label="Adicionar turma ao Google Agenda"
                    title={agendaHref ? "Adicionar ao Google Agenda" : "Datas insuficientes para agendar"}
                  >
                    Google Agenda
                  </BotaoSecundario>

                  <BotaoPrimario
                    className="sm:min-w-[180px]"
                    aria-label="Cancelar inscrição nesta turma"
                    onClick={() => cancelarInscricaoByTurmaId(t.id, t.nome)}
                    disabled={status !== "Programado" || cancelandoId === (reg?.inscricao_id || reg?.id)}
                    icone={<XCircle className="w-4 h-4" />}
                  >
                    {cancelandoId === (reg?.inscricao_id || reg?.id) ? "Cancelando..." : "Cancelar inscrição"}
                  </BotaoPrimario>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
