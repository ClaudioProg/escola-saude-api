// ✅ src/pages/Eventos.jsx — Página ÚNICA (Eventos + Minhas inscrições) — PREMIUM
// - Todos os eventos aparecem de uma vez
// - Imagens (folders) carregam progressivamente
// - Ordem alfabética por título
// - Eventos restritos visíveis para todos; inscrição apenas para elegíveis
// - Mantém compatibilidade com backend atual e com backend novo
// - ✅ date-only safe (sem new Date("YYYY-MM-DD"))
// - ✅ poster por URL direta (sem blob/objectURL)
// - ✅ loading progressivo real das imagens
// - ✅ ações rápidas para inscrições ativas por turma
// - ✅ feedback visual claro de carregamento dos eventos
// - ✅ imagens começam depois dos dados, sem competir com o conteúdo inicial

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useInViewOnce } from "../hooks/useInViewOnce";
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
  Lock,
  Eye,
} from "lucide-react";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import ListaTurmasEvento from "../components/ListaTurmasEvento";
import ModalConfirmacao from "../components/ModalConfirmacao";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";
import { resolveAssetUrl, openAsset } from "../utils/assets";

/* ───────────────── Helpers globais ───────────────── */
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function tituloOrdenavel(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(value) {
  if (typeof value !== "string") return "";
  return value.slice(0, 10);
}

function hhmm(value, fb = "") {
  if (typeof value !== "string") return fb;
  const s = value.trim();
  if (!s) return fb;
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s.slice(0, 5) || fb;
}

function toLocalDateTime(dateOnly, timeOnly = "00:00") {
  const d = ymd(dateOnly);
  const t = hhmm(timeOnly, "00:00");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (!/^\d{2}:\d{2}$/.test(t)) return null;

  const [Y, M, D] = d.split("-").map(Number);
  const [h, m] = t.split(":").map(Number);

  const dt = new Date(Y, (M || 1) - 1, D || 1, h || 0, m || 0, 0, 0);
  return isValidDate(dt) ? dt : null;
}

function hojeIsoLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const HOJE_ISO = hojeIsoLocal();

/* ───────────────── Status ───────────────── */
function statusText(dataInicioISO, dataFimISO, horarioInicio, horarioFim) {
  const di = ymd(dataInicioISO);
  const df = ymd(dataFimISO || dataInicioISO);
  const hi = hhmm(horarioInicio, "00:00");
  const hf = hhmm(horarioFim, "23:59");

  const inicio = toLocalDateTime(di, hi);
  const fim = toLocalDateTime(df, hf);
  const now = new Date();

  if (inicio && fim) {
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

function formatarDataCurtaSeguro(isoValue) {
  const data = ymd(isoValue);
  if (!data) return "";

  const partes = data.split("-");
  if (partes.length !== 3) return "";

  const [ano, mes, dia] = partes;
  const idx = Math.max(0, Math.min(11, Number(mes) - 1));
  return `${String(dia).padStart(2, "0")} de ${MESES_ABREV_PT[idx]} de ${ano}`;
}

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
/*  URL do poster                                                     */
/* ------------------------------------------------------------------ */
function getPosterUrl(ev) {
  const raw =
    ev?.folder_blob_url ||
    ev?.folder_url ||
    ev?.folderUrl ||
    ev?.folder ||
    ev?.poster_url ||
    ev?.posterUrl ||
    ev?.capa_url ||
    ev?.capaUrl ||
    ev?.imagem_url ||
    ev?.imagemUrl ||
    ev?.arquivo_folder ||
    ev?.arquivoFolder ||
    (ev?.id ? `/api/eventos/${ev.id}/folder` : "");

  if (!raw) return "";

  const resolved = resolveAssetUrl(raw);
  const version =
    ev?.folder_updated_at ||
    ev?.updated_at ||
    ev?.atualizado_em ||
    ev?.criado_em ||
    "";

  if (!version) return resolved;
  return `${resolved}${resolved.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(version))}`;
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
          Veja todos os eventos disponíveis e inscreva-se nas turmas elegíveis ao seu perfil.
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

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniStat
            icon={<Sparkles className="w-4 h-4" />}
            label="Eventos visíveis"
            value={stats?.eventosDisponiveis ?? 0}
          />
          <MiniStat
            icon={<BookOpen className="w-4 h-4" />}
            label="Minhas inscrições ativas"
            value={stats?.inscricaoAtivas ?? 0}
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
                  <Tip num="1" titulo="Todos os eventos ficam visíveis">
                    Mesmo quando um evento possui público específico, ele continua aparecendo para todos
                    os usuários.
                  </Tip>
                  <Tip num="2" titulo="Inscrição com elegibilidade">
                    A visualização é ampla, mas a <strong>inscrição</strong> continua restrita ao público
                    autorizado pelo evento.
                  </Tip>
                  <Tip num="3" titulo="Como se inscrever">
                    Abra o evento, clique em <strong>Ver turmas</strong>, escolha a turma e confirme em{" "}
                    <strong>Inscrever-se</strong>.
                  </Tip>
                  <Tip num="4" titulo="Após o término do curso">
                    Preencha a <strong>avaliação</strong> em <em>Avaliações Pendentes</em> para liberar seu{" "}
                    <strong>certificado</strong>.
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
/*  Indicador de restrição                                            */
/* ------------------------------------------------------------------ */
function RestricaoChip({ evento }) {
  const restrito =
    Boolean(evento?.restrito) ||
    Boolean(evento?.restricao_inscricao) ||
    Boolean(evento?.publico_especifico) ||
    (Array.isArray(evento?.cargos_permitidos) && evento.cargos_permitidos.length > 0) ||
    Boolean(String(evento?.motivo_bloqueio || "").trim());

  if (!restrito) return null;

  const descricao =
    String(evento?.publico_alvo || "").trim() ||
    (Array.isArray(evento?.cargos_permitidos) && evento.cargos_permitidos.length
      ? evento.cargos_permitidos.join(", ")
      : "público específico");

  return (
    <span
      className="text-[11px] px-2 py-1 rounded-full font-extrabold
                 bg-amber-100 text-amber-900 border border-amber-200
                 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800/60
                 inline-flex items-center gap-1"
      title={`Evento com inscrição restrita para ${descricao}`}
    >
      <Lock className="w-3 h-3" />
      Exclusivo para {descricao}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Componentes de mídia/ações do card                                */
/* ------------------------------------------------------------------ */
function ThumbEvento({ ev, titulo, canStartLoading }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => getPosterUrl(ev), [ev]);
  const { ref: inViewRef, inView } = useInViewOnce({ rootMargin: "700px 0px", threshold: 0.01 });

  useEffect(() => {
    if (canStartLoading && inView) {
      setShouldLoad(true);
    }
  }, [canStartLoading, inView]);

  useEffect(() => {
    setFailed(false);
    setShouldLoad(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div ref={inViewRef} className="w-[120px] sm:w-[140px] md:w-[160px] shrink-0">
        <div className="aspect-[3/4] rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-col items-center justify-center gap-2 text-xs text-center px-2">
            <ImageIcon className="w-4 h-4" />
            <span>{canStartLoading ? "Sem folder" : "Folder aguardando"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={inViewRef} className="w-[120px] sm:w-[140px] md:w-[160px] shrink-0">
      <div className="aspect-[3/4] rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 overflow-hidden flex items-center justify-center">
        {shouldLoad ? (
          <img
            src={src}
            alt={`Folder do evento: ${titulo}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-xs text-center px-2 text-zinc-500 dark:text-zinc-400">
            <ImageIcon className="w-4 h-4" />
            <span>Carregando folder...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoProgramacao({ programacaoPdfUrl }) {
  const pdfHref = useMemo(() => resolveAssetUrl(programacaoPdfUrl), [programacaoPdfUrl]);
  if (!pdfHref) return null;

  return (
    <BotaoSecundario
      type="button"
      onClick={() => openAsset(programacaoPdfUrl)}
      icone={<Download className="w-4 h-4" />}
      aria-label="Baixar programação (PDF)"
      title="Baixar programação (PDF)"
      size="md"
      className="whitespace-nowrap min-w-[210px]"
    >
      Baixar programação (PDF)
    </BotaoSecundario>
  );
}

/* ------------------------------------------------------------------ */
/*  Sentinela para liberar imagens progressivamente                   */
/* ------------------------------------------------------------------ */
function ImageBatchSentinel({ onReach }) {
  const firedRef = useRef(false);
  const { ref, inView } = useInViewOnce({ rootMargin: "1200px 0px", threshold: 0.01 });

  useEffect(() => {
    if (inView && !firedRef.current) {
      firedRef.current = true;
      onReach?.();
    }
  }, [inView, onReach]);

  return <div ref={ref} className="h-1 w-full" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/*  Página                                                            */
/* ------------------------------------------------------------------ */
export default function Eventos() {
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [turmasVisiveis, setTurmasVisiveis] = useState({});
  const [inscricao, setInscricao] = useState([]);
  const [inscricaoTurmaIds, setInscricaoTurmaIds] = useState([]);
  const [erro, setErro] = useState("");
  const [inscrevendo, setInscrevendo] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [carregandoTurmas, setCarregandoTurmas] = useState(null);
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [imageLoadBudget, setImageLoadBudget] = useState(0);

  const [confirmCancel, setConfirmCancel] = useState({
    open: false,
    turmaId: null,
    inscricaoId: null,
    turmaNome: "",
  });

  const liveRef = useRef(null);
  const imageStartTimerRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const abortEventosRef = useRef(null);
  const abortInscricaoRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortEventosRef.current?.abort?.("unmount");
      abortInscricaoRef.current?.abort?.("unmount");
      if (imageStartTimerRef.current) clearTimeout(imageStartTimerRef.current);
    };
  }, []);

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {}
  const usuarioId = Number(usuario?.id) || null;

  const extrairListaEventos = useCallback((res) => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.eventos)) return res.eventos;
    if (Array.isArray(res?.data?.eventos)) return res.data.eventos;
    return [];
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
      if (typeof evento?.status === "string" && evento.status) {
        const raw = String(evento.status).toLowerCase();
        if (raw === "programado" || raw === "andamento" || raw === "encerrado") return raw;
      }
      return statusDoEvento(evento, turmasCarregadas);
    },
    [statusDoEvento]
  );

  function isAbortLike(err) {
    if (!err) return false;

    const name = String(err?.name || "");
    const msg = String(err?.message || "");
    const dataMsg = String(err?.data?.message || err?.data?.erro || "");
    const full = `${name} ${msg} ${dataMsg}`.toLowerCase();
    const st = Number(err?.status ?? err?.response?.status ?? 0);

    return (
      name === "AbortError" ||
      st === 0 ||
      full.includes("abort") ||
      full.includes("canceled") ||
      full.includes("cancelled") ||
      full.includes("failed to fetch") ||
      full.includes("falha de rede") ||
      full.includes("cors") ||
      full.includes("tempo de resposta excedido") ||
      full.includes("timeout")
    );
  }

  const carregarInscricao = useCallback(async () => {
    try {
      abortInscricaoRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortInscricaoRef.current = ctrl;

      const data = await apiGet("/api/inscricao/minhas", { signal: ctrl.signal }).catch(() => []);
      const arr = Array.isArray(data) ? data : [];

      const ativas = arr.filter((it) => {
        const { status } = statusText(it.data_inicio, it.data_fim, it.horario_inicio, it.horario_fim);
        const fimISO = ymd(it.data_fim || it.data_inicio || "");
        const encerrado = fimISO && fimISO < HOJE_ISO;
        return (status === "Programado" || status === "Em andamento") && !encerrado;
      });

      if (!mountedRef.current) return;
      setInscricao(ativas);
      setInscricaoTurmaIds(
        ativas.map((i) => Number(i?.turma_id)).filter((n) => Number.isFinite(n))
      );
    } catch (e) {
      if (isAbortLike(e)) return;
      toast.error("Erro ao carregar suas inscrições ativas.");
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    setCarregandoEventos(true);
    setLive("Carregando eventos…");
    setErro("");

    if (imageStartTimerRef.current) clearTimeout(imageStartTimerRef.current);
    setImageLoadBudget(0);

    try {
      abortEventosRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortEventosRef.current = ctrl;

      const res1 = await apiGet("/api/eventos/para-mim/lista", { signal: ctrl.signal }).catch(() => []);
      const lista1 = extrairListaEventos(res1);

      const lista =
        Array.isArray(lista1) && lista1.length
          ? lista1
          : extrairListaEventos(await apiGet("/api/eventos", { signal: ctrl.signal }).catch(() => []));

      const visiveis = (Array.isArray(lista) ? lista : []).filter((e) => {
  const st = statusBackendOuFallback(e, turmasPorEvento[e.id]);
  return st === "programado" || st === "andamento";
});

visiveis.sort((a, b) => {
  const da = ymd(a?.data_inicio_geral || a?.data_inicio || "");
  const db = ymd(b?.data_inicio_geral || b?.data_inicio || "");

  if (da && db && da !== db) return da.localeCompare(db);
  if (da && !db) return -1;
  if (!da && db) return 1;

  return tituloOrdenavel(a?.titulo).localeCompare(tituloOrdenavel(b?.titulo), "pt-BR");
});

      if (!mountedRef.current) return;

      setEventos(visiveis);
      setErro("");
      setLive("Eventos carregados. Imagens serão exibidas em seguida.");

      imageStartTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setImageLoadBudget(4);
      }, 450);
    } catch (e) {
      if (isAbortLike(e)) return;

      if (Array.isArray(eventos) && eventos.length > 0) {
        setErro("");
        toast.warn("⚠️ Não foi possível atualizar os eventos agora. Mantive a lista atual.");
        setLive("Falha ao atualizar eventos; mantendo lista atual.");
        return;
      }

      setErro("Erro ao carregar eventos");
      toast.error("❌ Erro ao carregar eventos");
      setLive("Falha ao carregar eventos.");
    } finally {
      if (mountedRef.current) setCarregandoEventos(false);
    }
  }, [extrairListaEventos, statusBackendOuFallback, turmasPorEvento, eventos]);

  useEffect(() => {
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarInscricao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const eventosDisponiveis = Array.isArray(eventos) ? eventos.length : 0;
    const inscricaoAtivas = Array.isArray(inscricaoTurmaIds) ? inscricaoTurmaIds.length : 0;

    const eventosAndamento = (eventos || []).filter((e) => {
      const st = statusBackendOuFallback(e, turmasPorEvento[e.id]);
      return st === "andamento";
    }).length;

    return { eventosDisponiveis, inscricaoAtivas, eventosAndamento };
  }, [eventos, inscricaoTurmaIds, statusBackendOuFallback, turmasPorEvento]);

  const carregarTurmas = useCallback(
    async (eventoId) => {
      if (turmasVisiveis[eventoId]) {
        setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: false }));
        return;
      }

      setTurmasVisiveis((prev) => ({ ...prev, [eventoId]: true }));

      if (turmasPorEvento[eventoId] || carregandoTurmas) return;

      setCarregandoTurmas(eventoId);
      try {
        let turmas = await apiGet(`/api/eventos/${eventoId}/turmas-simples`).catch(() => []);
        if (!Array.isArray(turmas)) turmas = [];

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
                  data_inicio: ymd(t.data_inicio) || null,
                  data_fim: ymd(t.data_fim) || null,
                  horario_inicio: hhmm(t.horario_inicio) || null,
                  horario_fim: hhmm(t.horario_fim) || null,
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
      } catch {
        toast.error("Erro ao carregar turmas");
      } finally {
        if (mountedRef.current) setCarregandoTurmas(null);
      }
    },
    [turmasVisiveis, turmasPorEvento, carregandoTurmas]
  );

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

  const getEventoElegibilidade = useCallback((evento) => {
    const pode =
      typeof evento?.pode_se_inscrever === "boolean" ? evento.pode_se_inscrever : true;

    const motivo =
      evento?.motivo_bloqueio ||
      evento?.mensagem_bloqueio ||
      evento?.motivo_restricao ||
      "";

    return {
      podeSeInscrever: pode,
      motivoBloqueio: String(motivo || "").trim(),
    };
  }, []);

  const inscrever = useCallback(
    async (turmaId, eventoId) => {
      if (inscrevendo) return;

      const eventoRef = eventos.find((e) => Number(e.id) === Number(eventoId));
      if (!eventoRef) return;

      const { podeSeInscrever, motivoBloqueio } = getEventoElegibilidade(eventoRef);
      if (!podeSeInscrever) {
        toast.warn(
          motivoBloqueio ||
            "Este evento está visível para você, mas a inscrição não está disponível para seu perfil."
        );
        return;
      }

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
        await apiPost("/api/inscricao", { turma_id: turmaId });
        toast.success("✅ Inscrição realizada com sucesso!");
        await carregarInscricao();

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
          if (motivo === "SEM_REGISTRO") {
            toast.error("Inscrição bloqueada: informe seu Registro no perfil.");
          } else if (motivo === "REGISTRO_NAO_AUTORIZADO") {
            toast.error("Inscrição bloqueada: seu Registro não está autorizado para este curso.");
          } else {
            toast.error("Acesso negado para este curso.");
          }
        } else {
          console.error("❌ [EVENTOS][INSCRICAO] Erro inesperado:", err);
          toast.error("❌ Erro ao se inscrever.");
        }
      } finally {
        setInscrevendo(null);
      }
    },
    [inscrevendo, eventos, usuarioId, carregarInscricao, getEventoElegibilidade]
  );

  const getInscricaoPorTurmaId = useCallback(
    (turmaId) => inscricao.find((i) => Number(i?.turma_id) === Number(turmaId)) || null,
    [inscricao]
  );

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

  const executarCancelamento = useCallback(async () => {
    const inscricaoId = confirmCancel?.inscricaoId;

    if (!inscricaoId) {
      setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
      return;
    }

    setCancelandoId(inscricaoId);

    try {
      await apiDelete(`/api/inscricao/${inscricaoId}`);
      toast.success("✅ Inscrição cancelada com sucesso.");
      await carregarInscricao();
    } catch (err) {
      const status = err?.status || err?.response?.status || 0;
      const data = err?.data || err?.response?.data || {};
      const msg = data?.mensagem || data?.message || err?.message || "Sem conexão";
      toast.error(`❌ Erro ao cancelar inscrição${status ? ` (${status})` : ""}. ${msg}`);
    } finally {
      setCancelandoId(null);
      setConfirmCancel({ open: false, turmaId: null, inscricaoId: null, turmaNome: "" });
    }
  }, [confirmCancel?.inscricaoId, carregarInscricao]);

  const isCancelModalLoading = cancelandoId && cancelandoId === confirmCancel?.inscricaoId;

  const liberarMaisImagens = useCallback(() => {
    setImageLoadBudget((prev) => prev + 4);
  }, []);

  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <EventosHero
        stats={stats}
        onRefresh={async () => {
          await carregarEventos();
          await carregarInscricao();
        }}
      />

      {carregandoEventos && (
        <>
          <div
            className="sticky top-0 left-0 w-full h-1 bg-fuchsia-100 dark:bg-fuchsia-950/30 z-40"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Carregando eventos"
          >
            <div className={`h-full bg-fuchsia-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
          </div>

          <div className="max-w-6xl mx-auto px-4 pt-4">
            <div className="rounded-2xl border border-fuchsia-200 dark:border-fuchsia-900/40 bg-fuchsia-50 dark:bg-fuchsia-950/20 px-4 py-3 text-sm text-fuchsia-900 dark:text-fuchsia-200">
              <span className="font-extrabold">Carregando eventos...</span>{" "}
              Aguarde um instante enquanto preparamos a lista.
            </div>
          </div>
        </>
      )}

      {!carregandoEventos && eventos.length > 0 && imageLoadBudget === 0 && (
        <div className="max-w-6xl mx-auto px-4 pt-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200">
            <span className="font-extrabold">Eventos carregados.</span> Os folders estão sendo exibidos em seguida.
          </div>
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
                  await carregarInscricao();
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

              const programacaoPdfUrl =
                evento.programacao_pdf_url ||
                evento.programacao_pdf ||
                evento.programacao_url ||
                null;

              const { podeSeInscrever, motivoBloqueio } = getEventoElegibilidade(evento);
              const mostrarAvisoRestricao = !podeSeInscrever && !!motivoBloqueio;

              return (
                <motion.article
                  key={evento.id ?? idx}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="group rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-neutral-900 shadow-md hover:shadow-xl transition-shadow [content-visibility:auto] [contain-intrinsic-size:420px]"
                  aria-labelledby={`evt-${evento.id}-titulo`}
                >
                  <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500" />

                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <ThumbEvento
                        ev={evento}
                        titulo={evento.titulo}
                        canStartLoading={idx < imageLoadBudget}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3
                                id={`evt-${evento.id}-titulo`}
                                className="text-xl font-extrabold text-zinc-900 dark:text-white"
                              >
                                {evento.titulo}
                              </h3>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {String(evento?.tipo || "").trim() && (
                                <span
                                  className="text-[11px] px-2 py-1 rounded-full font-extrabold
                                             bg-indigo-100 text-indigo-900 border border-indigo-200
                                             dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800/60"
                                  title="Tipo do evento"
                                >
                                  {evento.tipo}
                                </span>
                              )}

                              {String(evento?.publico_alvo || "").trim() && (
                                <span
                                  className="text-[11px] px-2 py-1 rounded-full font-extrabold
                                             bg-emerald-100 text-emerald-900 border border-emerald-200
                                             dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800/60"
                                  title="Público-alvo"
                                >
                                  {evento.publico_alvo}
                                </span>
                              )}

                              {!!evento.ja_inscrito && (
                                <span
                                  className="text-[11px] px-2 py-1 rounded-full font-extrabold
                                             bg-sky-100 text-sky-900 border border-sky-200
                                             dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800/60"
                                  title="Você já está inscrito em alguma turma deste evento."
                                >
                                  ✓ Inscrito
                                </span>
                              )}

                              <RestricaoChip evento={evento} />
                            </div>
                          </div>

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

                        {String(evento?.descricao || "").trim() && (
                          <p className="mt-2 text-[15px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                            {evento.descricao}
                          </p>
                        )}

                        {(() => {
                          const lista =
                            (Array.isArray(evento?.instrutores) && evento.instrutores) ||
                            (Array.isArray(evento?.instrutor) && evento.instrutor) ||
                            [];
                          if (!lista.length) return null;

                          return (
                            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                              <span className="font-extrabold">Instrutor{lista.length > 1 ? "es" : ""}:</span>{" "}
                              <span className="font-medium">
                                {lista.map((p) => p?.nome).filter(Boolean).join(", ")}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                          <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-300" aria-hidden="true" />
                          <span>{localEvento || "Local a definir"}</span>
                        </div>

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

                        {mostrarAvisoRestricao && (
                          <div className="mt-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                            <Eye className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>
                              Este evento está visível para você, mas a inscrição está restrita.{" "}
                              <strong>{motivoBloqueio}</strong>
                            </span>
                          </div>
                        )}

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
                      </div>
                    </div>

                    {turmasVisiveis[evento.id] && (
                      <div className="mt-5 w-full">
                        {turmasPorEvento[evento.id] && (
                          <div id={`turmas-${evento.id}`} className="w-full">
                            <ListaTurmasEvento
                              turmas={turmasPorEvento[evento.id]}
                              eventoId={evento.id}
                              eventoTipo={evento.tipo}
                              hoje={new Date()}
                              inscricaoConfirmadas={inscricaoTurmaIds}
                              inscrever={(tid) => inscrever(tid, evento.id)}
                              inscrevendo={inscrevendo}
                              jaInscritoNoEvento={(() => {
                                const ids = new Set(inscricaoTurmaIds);
                                return (turmasPorEvento[evento.id] || []).some((t) =>
                                  ids.has(Number(t.id))
                                );
                              })()}
                              jaInstrutorDoEvento={!!evento.ja_instrutor}
                              carregarInscritos={() => {}}
                              carregarAvaliacao={() => {}}
                              gerarRelatorioPDF={() => {}}
                              mostrarStatusTurma={false}
                              exibirRealizadosTotal
                              turmasEmConflito={[]}
                              podeSeInscreverNoEvento={podeSeInscrever}
                              motivoBloqueioEvento={motivoBloqueio}
                            />
                          </div>
                        )}

                        <InscricaoAcaoRapidas
                          evento={evento}
                          turmas={turmasPorEvento[evento.id] || []}
                          inscricao={inscricao}
                          cancelarInscricaoByTurmaId={cancelarInscricaoByTurmaId}
                          buildAgendaHref={buildAgendaHref}
                          cancelandoId={cancelandoId}
                        />
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}

            <ImageBatchSentinel onReach={liberarMaisImagens} />
          </div>
        )}
      </main>

      <Footer />

      <ModalConfirmacao
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
          if (cancelandoId) return;
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
function InscricaoAcaoRapidas({
  evento,
  turmas,
  inscricao,
  cancelarInscricaoByTurmaId,
  buildAgendaHref,
  cancelandoId,
}) {
  if (!Array.isArray(turmas) || turmas.length === 0) return null;

  const porTurma = new Map();
  for (const i of inscricao) {
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

          const status = statusText(
            t.data_inicio,
            t.data_fim,
            t.horario_inicio,
            t.horario_fim
          ).status;

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
                    {cancelandoId === (reg?.inscricao_id || reg?.id)
                      ? "Cancelando..."
                      : "Cancelar inscrição"}
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