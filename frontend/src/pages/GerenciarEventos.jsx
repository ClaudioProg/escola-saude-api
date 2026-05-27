// ✅ src/pages/GerenciarEventos.jsx — v2.0
// Plataforma Escola da Saúde
//
// Página administrativa de eventos.
//
// Revisão premium:
// - usa EventoService como contrato oficial do domínio;
// - sem chamadas diretas para /api;
// - sem authFetch manual;
// - sem authToken/access_token;
// - sem rotas antigas de turma;
// - sem upload separado por fallback;
// - folder/programação enviados via campos oficiais: folder e programacao;
// - página interna do EscolaAppShell;
// - sem Footer próprio;
// - sem fundo duplicado de tela;
// - interface premium, institucional, mobile-first e acessível;
// - estados claros: loading, erro, vazio, salvando, publicando;
// - publicação/despublicação com rollback visual;
// - exclusão protegida pelo backend e comunicada claramente;
// - ModalEvento só monta quando aberto;
// - imagens carregam progressivamente.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  CalendarCheck2,
  CalendarDays,
  Eye,
  EyeOff,
  FileText,
  LayoutGrid,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import ModalEvento from "../components/eventos/ModalEvento";
import SkeletonEvento from "../components/eventos/SkeletonEvento";
import ModalConfirmacao from "../components/ui/ModalConfirmacao";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import {
  notifyApiError,
  notifyError,
  notifySuccess,
  notifyWarning,
} from "../components/ui/AppToast";

import EventoService, {
  deduzStatusEvento,
  getEventStartDate,
  getEventYear,
  getEventoFolderUrl,
  getEventoProgramacaoUrl,
  isAbortLike,
  normalizeTitleSort,
  sortEventosAdmin,
} from "../services/eventoService";

/* ─────────────────────────────────────────────────────────────
   Ambiente / logs
────────────────────────────────────────────────────────────── */

const IS_DEV =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

function logDev(...args) {
  if (IS_DEV) console.log("[GerenciarEventos]", ...args);
}

function warnDev(...args) {
  if (IS_DEV) console.warn("[GerenciarEventos]", ...args);
}

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getListaEventos(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.data?.erro ||
    error?.message ||
    fallback
  );
}

function statusUi(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();

  if (status === "andamento") {
    return {
      key: "andamento",
      label: "Em andamento",
      dot: "bg-amber-500",
      chip:
        "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-900/40",
    };
  }

  if (status === "encerrado") {
    return {
      key: "encerrado",
      label: "Encerrado",
      dot: "bg-rose-500",
      chip:
        "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/25 dark:text-rose-200 dark:border-rose-900/40",
    };
  }

  if (status === "sem_datas") {
    return {
      key: "sem_datas",
      label: "Sem datas",
      dot: "bg-zinc-400",
      chip:
        "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-800",
    };
  }

  return {
    key: "programado",
    label: "Programado",
    dot: "bg-emerald-500",
    chip:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-200 dark:border-emerald-900/40",
  };
}

function formatYmdBr(value) {
  const ymd = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";

  const [ano, mes, dia] = ymd.split("-");
  return `${dia}/${mes}/${ano}`;
}

function getPeriodoEvento(evento) {
  const inicio =
    evento?.data_inicio_geral ||
    evento?.data_inicio ||
    getEventStartDate(evento);

  const fim = evento?.data_fim_geral || evento?.data_fim || inicio;

  const inicioBr = formatYmdBr(inicio);
  const fimBr = formatYmdBr(fim);

  if (!inicioBr) return "Datas não informadas";
  if (!fimBr || fimBr === inicioBr) return inicioBr;

  return `${inicioBr} a ${fimBr}`;
}

function eventMatchesSearch(evento, termo) {
  const q = normalizeTitleSort(termo);

  if (!q) return true;

  const haystack = [
    evento?.titulo,
    evento?.tipo,
    evento?.local,
    evento?.publico_alvo,
    evento?.descricao,
  ]
    .map(normalizeTitleSort)
    .join(" ");

  return haystack.includes(q);
}

/* ─────────────────────────────────────────────────────────────
   Componentes locais
────────────────────────────────────────────────────────────── */

function SoftButton({ children, className = "", disabled = false, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={classNames(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-extrabold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children, className = "", title }) {
  return (
    <span
      title={title}
      className={classNames(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active ? "true" : "false"}
      className={classNames(
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-extrabold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500",
        "focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        active
          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
      )}
    >
      <span>{label}</span>

      <span
        className={classNames(
          "rounded-full px-2 py-0.5 text-[11px]",
          active
            ? "bg-white/20 text-white"
            : "bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-200"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StatPill({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: {
      wrap: "bg-zinc-100 dark:bg-white/5",
      icon: "text-zinc-700 dark:text-zinc-200",
    },
    emerald: {
      wrap: "bg-emerald-100/80 dark:bg-emerald-950/30",
      icon: "text-emerald-700 dark:text-emerald-200",
    },
    indigo: {
      wrap: "bg-indigo-100/80 dark:bg-indigo-950/30",
      icon: "text-indigo-700 dark:text-indigo-200",
    },
    amber: {
      wrap: "bg-amber-100/80 dark:bg-amber-950/30",
      icon: "text-amber-700 dark:text-amber-200",
    },
    rose: {
      wrap: "bg-rose-100/80 dark:bg-rose-950/30",
      icon: "text-rose-700 dark:text-rose-200",
    },
    sky: {
      wrap: "bg-sky-100/80 dark:bg-sky-950/30",
      icon: "text-sky-700 dark:text-sky-200",
    },
  };

  const t = tones[tone] || tones.zinc;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
      <div className="flex items-center gap-2">
        <span
          className={classNames(
            "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            t.wrap
          )}
        >
          <Icon className={classNames("h-5 w-5", t.icon)} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </div>

          <div className="text-lg font-extrabold text-zinc-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderHero({ onCriar, onAtualizar, atualizando, hint }) {
  return (
    <header
      className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_24px_80px_-58px_rgba(15,23,42,.65)]"
      role="banner"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-700 to-indigo-800"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-black/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 px-4 py-8 text-center sm:px-6 sm:py-10">
        <div className="flex flex-col items-center gap-2.5">
          <div className="inline-flex items-center justify-center gap-2 text-white">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </span>

            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Gerenciar eventos
            </h1>
          </div>

          <p className="max-w-2xl text-sm text-white/90 sm:text-base">
            Cadastre, publique e acompanhe eventos, turmas, folders e
            programações em um fluxo administrativo centralizado.
          </p>

          <div className="text-xs text-white/80">{hint}</div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SoftButton
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className="border border-white/20 bg-white/15 text-white backdrop-blur hover:bg-white/20"
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw
                className={classNames("h-4 w-4", atualizando && "animate-spin")}
                aria-hidden="true"
              />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </SoftButton>

            <SoftButton
              type="button"
              onClick={onCriar}
              className="border border-white/40 bg-white text-zinc-900 shadow-md hover:bg-white/90"
              aria-label="Criar novo evento"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar evento
            </SoftButton>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

function PosterThumb({ evento, shouldLoad }) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (!shouldLoad) return "";
    return getEventoFolderUrl(evento);
  }, [evento, shouldLoad]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const title = evento?.titulo || "evento";

  if (!src || failed) {
    return (
      <div
        className="flex h-[128px] w-[96px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-2 text-center text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400 sm:h-[176px] sm:w-[132px] md:h-[196px] md:w-[148px]"
        aria-label={`Folder indisponível para ${title}`}
      >
        <CalendarDays className="h-5 w-5 opacity-70" aria-hidden="true" />
        {shouldLoad ? "Sem folder" : "Aguardando folder..."}
      </div>
    );
  }

  return (
    <div
      className="grid h-[128px] w-[96px] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-100 shadow-sm dark:bg-zinc-900 sm:h-[176px] sm:w-[132px] md:h-[196px] md:w-[148px]"
      aria-label={`Folder do evento ${title}`}
    >
      <img
        src={src}
        alt={`Folder do evento ${title}`}
        className="h-full w-full object-contain"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function SearchBox({ value, onChange }) {
  return (
    <label className="relative block w-full sm:max-w-md">
      <span className="sr-only">Buscar evento</span>

      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        aria-hidden="true"
      />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por título, tipo, local ou público..."
        className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      />
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────────── */

export default function GerenciarEventos() {
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [publicandoId, setPublicandoId] = useState(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(null);

  const [filtroStatus, setFiltroStatus] = useState("ativos");
  const [busca, setBusca] = useState("");
  const [imageLoadBudget, setImageLoadBudget] = useState(0);

  const liveRef = useRef(null);
  const abortListRef = useRef(null);
  const abortEditRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortListRef.current?.abort?.("unmount");
      abortEditRef.current?.abort?.("unmount");
    };
  }, []);

  const recarregarEventos = useCallback(async () => {
    abortListRef.current?.abort?.("new-request");

    const controller = new AbortController();
    abortListRef.current = controller;

    try {
      setErro("");
      setLoading(true);
      setImageLoadBudget(0);
      setLive("Carregando eventos…");

      const response = await EventoService.admin.listar({
        signal: controller.signal,
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      const lista = getListaEventos(response);
      const ordenada = [...lista].sort(sortEventosAdmin);

      setEventos(ordenada);
      setLive(`Eventos carregados: ${ordenada.length}.`);
    } catch (error) {
      if (isAbortLike(error)) {
        logDev("Listagem de eventos abortada.", error);
        return;
      }

      const message = getErrorMessage(error, "Erro ao carregar eventos.");

      if (!mountedRef.current) return;

      setErro(message);
      setEventos([]);
      setLive("Falha ao carregar eventos.");

      notifyApiError(error, {
        titulo: "Não foi possível carregar os eventos.",
        acao: "Tente atualizar a lista. Se o erro persistir, acione o suporte.",
      });
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [setLive]);

  useEffect(() => {
    recarregarEventos();
  }, [recarregarEventos]);

  const abrirModalCriar = useCallback(() => {
    setEventoSelecionado(null);
    setModalAberto(true);
  }, []);

  const abrirModalEditar = useCallback(async (evento) => {
    if (!evento?.id) return;

    abortEditRef.current?.abort?.("new-edit");

    const controller = new AbortController();
    abortEditRef.current = controller;

    setEventoSelecionado(evento);
    setModalAberto(true);

    try {
      const completo = await EventoService.admin.buscarCompleto(evento.id, {
        signal: controller.signal,
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      if (completo?.id) {
        setEventoSelecionado({
          ...evento,
          ...completo,
          turmas: Array.isArray(completo?.turmas) ? completo.turmas : [],
        });
      }
    } catch (error) {
      if (isAbortLike(error)) return;

      warnDev("Falha ao refinar evento para edição:", error?.message || error);

      notifyWarning(
        "Não foi possível carregar todos os detalhes agora. O evento será aberto com os dados disponíveis."
      );
    }
  }, []);

  const fecharModal = useCallback(() => {
    setModalAberto(false);
  }, []);

  const pedirExclusao = useCallback((evento) => {
    if (!evento?.id) return;

    setConfirmDelete({
      id: Number(evento.id),
      titulo: evento.titulo || "Evento",
    });
  }, []);

  const confirmarExclusao = useCallback(async () => {
    const alvo = confirmDelete;
    setConfirmDelete(null);

    if (!alvo?.id) return;

    try {
      await EventoService.admin.excluir(alvo.id);

      notifySuccess("Evento excluído com sucesso.");
      await recarregarEventos();
    } catch (error) {
      notifyApiError(error, {
        titulo: "Não foi possível excluir o evento.",
        acao:
          "Se ele possui inscrições, presenças ou certificados, despublique o evento em vez de excluir, para preservar o histórico.",
      });
    }
  }, [confirmDelete, recarregarEventos]);

  const pedirTogglePublicacao = useCallback((evento) => {
    if (!evento?.id) return;

    setConfirmPublish({
      id: Number(evento.id),
      titulo: evento.titulo || "Evento",
      publicado: Boolean(evento.publicado),
    });
  }, []);

  const confirmarTogglePublicacao = useCallback(async () => {
    const alvo = confirmPublish;
    setConfirmPublish(null);

    if (!alvo?.id) return;

    const id = Number(alvo.id);
    const publicadoAnterior = Boolean(alvo.publicado);

    setPublicandoId(id);

    setEventos((prev) =>
      prev.map((evento) =>
        Number(evento.id) === id
          ? {
              ...evento,
              publicado: !publicadoAnterior,
            }
          : evento
      )
    );

    try {
      await EventoService.admin.alternarPublicacao({
        id,
        publicado: publicadoAnterior,
      });

      notifySuccess(
        publicadoAnterior
          ? "Evento despublicado com sucesso."
          : "Evento publicado com sucesso."
      );
    } catch (error) {
      setEventos((prev) =>
        prev.map((evento) =>
          Number(evento.id) === id
            ? {
                ...evento,
                publicado: publicadoAnterior,
              }
            : evento
        )
      );

      notifyApiError(error, {
        titulo: "Não foi possível alterar a publicação do evento.",
        acao:
          "Verifique se o evento possui dados mínimos, turmas e datas antes de publicar.",
      });
    } finally {
      setPublicandoId(null);
    }
  }, [confirmPublish]);

  const salvarEvento = useCallback(
    async (dadosDoModal) => {
      try {
        setSalvando(true);

        const isEdicao = Boolean(eventoSelecionado?.id);

        const arquivos = {
          folder: dadosDoModal?.folder || null,
          programacao: dadosDoModal?.programacao || null,
        };

        if (isEdicao) {
          const baseServidor = eventoSelecionado?.id
            ? await EventoService.admin
                .buscarCompleto(eventoSelecionado.id)
                .catch(() => eventoSelecionado)
            : eventoSelecionado;

          await EventoService.admin.atualizar(
            eventoSelecionado.id,
            {
              ...dadosDoModal,
              baseServidor,
            },
            arquivos
          );

          notifySuccess("Evento atualizado com sucesso.");

          const atualizado = await EventoService.admin
            .buscarCompleto(eventoSelecionado.id)
            .catch(() => null);

          if (atualizado?.id && mountedRef.current) {
            setEventoSelecionado(atualizado);
          }
        } else {
          await EventoService.admin.criar(dadosDoModal, arquivos);
          notifySuccess("Evento criado com sucesso.");
        }

        await recarregarEventos();

        if (mountedRef.current) {
          setModalAberto(false);
          setEventoSelecionado(null);
        }
      } catch (error) {
        notifyApiError(error, {
          titulo: "Não foi possível salvar o evento.",
          acao:
            "Revise os campos obrigatórios, datas, turmas e arquivos enviados. Se o erro persistir, acione o suporte.",
        });
      } finally {
        if (mountedRef.current) {
          setSalvando(false);
        }
      }
    },
    [eventoSelecionado, recarregarEventos]
  );

  const headerHint = useMemo(() => {
    if (loading) return "Carregando eventos…";

    return `${eventos.length} evento(s) cadastrado(s)`;
  }, [eventos.length, loading]);

  const stats = useMemo(() => {
    const anoAtual = new Date().getFullYear();

    let publicados = 0;
    let rascunhos = 0;
    let andamento = 0;
    let encerrados = 0;
    let eventosAnoAtual = 0;
    let comProgramacao = 0;

    for (const evento of eventos) {
      if (evento?.publicado) publicados += 1;
      else rascunhos += 1;

      const status = deduzStatusEvento(evento);

      if (status === "andamento") andamento += 1;
      if (status === "encerrado") encerrados += 1;

      const year = getEventYear(evento);
      if (year === anoAtual) eventosAnoAtual += 1;

      if (evento?.programacao_kind === "blob" || evento?.programacao_pdf_size) {
        comProgramacao += 1;
      }
    }

    return {
      total: eventos.length,
      publicados,
      rascunhos,
      andamento,
      encerrados,
      anoAtual,
      eventosAnoAtual,
      comProgramacao,
    };
  }, [eventos]);

  const countsByChip = useMemo(() => {
    let ativos = 0;
    let encerrados = 0;
    let rascunhos = 0;

    for (const evento of eventos) {
      const status = deduzStatusEvento(evento);

      if (status === "encerrado") encerrados += 1;
      else ativos += 1;

      if (!evento?.publicado) rascunhos += 1;
    }

    return {
      ativos,
      encerrados,
      rascunhos,
      todos: eventos.length,
    };
  }, [eventos]);

  const eventosFiltrados = useMemo(() => {
    let lista = [...eventos];

    if (filtroStatus === "ativos") {
      lista = lista.filter(
        (evento) => deduzStatusEvento(evento) !== "encerrado"
      );
    } else if (filtroStatus === "encerrados") {
      lista = lista.filter(
        (evento) => deduzStatusEvento(evento) === "encerrado"
      );
    } else if (filtroStatus === "rascunhos") {
      lista = lista.filter((evento) => !evento?.publicado);
    }

    lista = lista.filter((evento) => eventMatchesSearch(evento, busca));

    return lista.sort(sortEventosAdmin);
  }, [busca, eventos, filtroStatus]);

  useEffect(() => {
    if (loading) return undefined;
    if (!eventosFiltrados.length) return undefined;

    let cancelled = false;
    let timeoutA = null;
    let timeoutB = null;
    let timeoutC = null;
    let idleId = null;

    const liberar = () => {
      if (cancelled) return;

      setImageLoadBudget(Math.min(2, eventosFiltrados.length));

      timeoutA = window.setTimeout(() => {
        if (cancelled) return;
        setImageLoadBudget((prev) =>
          Math.min(Math.max(prev, 4), eventosFiltrados.length)
        );
      }, 250);

      timeoutB = window.setTimeout(() => {
        if (cancelled) return;
        setImageLoadBudget((prev) =>
          Math.min(Math.max(prev, 8), eventosFiltrados.length)
        );
      }, 700);

      timeoutC = window.setTimeout(() => {
        if (cancelled) return;
        setImageLoadBudget(eventosFiltrados.length);
      }, 1400);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(() => liberar(), { timeout: 500 });
    } else {
      timeoutA = window.setTimeout(() => liberar(), 120);
    }

    return () => {
      cancelled = true;

      if (idleId && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }

      if (timeoutA) window.clearTimeout(timeoutA);
      if (timeoutB) window.clearTimeout(timeoutB);
      if (timeoutC) window.clearTimeout(timeoutC);
    };
  }, [eventosFiltrados, loading]);

  return (
    <section className="space-y-6 text-slate-950 dark:text-white">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <ModalConfirmacao
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir evento"
        description={
          confirmDelete?.titulo
            ? `Tem certeza que deseja excluir "${confirmDelete.titulo}"?\n\nSe o evento possuir inscrições, presenças ou certificados, o backend bloqueará a exclusão física para preservar o histórico.`
            : "Tem certeza que deseja excluir este evento?"
        }
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        variant="danger"
      />

      <ModalConfirmacao
        open={Boolean(confirmPublish)}
        onClose={() => setConfirmPublish(null)}
        onConfirm={confirmarTogglePublicacao}
        titulo={confirmPublish?.publicado ? "Despublicar evento" : "Publicar evento"}
        description={
          confirmPublish?.publicado
            ? `Despublicar "${confirmPublish?.titulo}"?\n\nEle deixará de aparecer para os usuários.`
            : `Publicar "${confirmPublish?.titulo}"?\n\nAntes de publicar, o sistema validará se o evento possui dados mínimos, turmas e datas.`
        }
        confirmarTexto={confirmPublish?.publicado ? "Despublicar" : "Publicar"}
        cancelarTexto="Cancelar"
        variant={confirmPublish?.publicado ? "warning" : "primary"}
      />

      <HeaderHero
        onCriar={abrirModalCriar}
        onAtualizar={recarregarEventos}
        atualizando={loading}
        hint={headerHint}
      />

      {loading && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/30"
          role="progressbar"
          aria-label="Carregando eventos"
        >
          <div
            className={classNames(
              "h-full w-1/3 rounded-full bg-emerald-600",
              !reduceMotion && "animate-pulse"
            )}
          />
        </div>
      )}

      <div id="conteudo" className="space-y-4">
        {!loading && (
          <section aria-label="Resumo dos eventos">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
              <StatPill
                icon={CalendarCheck2}
                label="Total"
                value={stats.total}
                tone="zinc"
              />
              <StatPill
                icon={BadgeCheck}
                label="Publicados"
                value={stats.publicados}
                tone="indigo"
              />
              <StatPill
                icon={BadgeX}
                label="Rascunhos"
                value={stats.rascunhos}
                tone="zinc"
              />
              <StatPill
                icon={Sparkles}
                label="Andamento"
                value={stats.andamento}
                tone="amber"
              />
              <StatPill
                icon={CalendarDays}
                label={`Eventos ${stats.anoAtual}`}
                value={stats.eventosAnoAtual}
                tone="emerald"
              />
              <StatPill
                icon={FileText}
                label="Com PDF"
                value={stats.comProgramacao}
                tone="sky"
              />
            </div>
          </section>
        )}

        {!loading && eventos.length > 0 && (
          <section aria-label="Filtros e busca de eventos">
            <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={filtroStatus === "ativos"}
                    onClick={() => setFiltroStatus("ativos")}
                    label="Ativos"
                    count={countsByChip.ativos}
                  />

                  <FilterChip
                    active={filtroStatus === "encerrados"}
                    onClick={() => setFiltroStatus("encerrados")}
                    label="Encerrados"
                    count={countsByChip.encerrados}
                  />

                  <FilterChip
                    active={filtroStatus === "rascunhos"}
                    onClick={() => setFiltroStatus("rascunhos")}
                    label="Rascunhos"
                    count={countsByChip.rascunhos}
                  />

                  <FilterChip
                    active={filtroStatus === "todos"}
                    onClick={() => setFiltroStatus("todos")}
                    label="Todos"
                    count={countsByChip.todos}
                  />
                </div>

                <SearchBox value={busca} onChange={setBusca} />
              </div>

              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Mostrando{" "}
                <span className="font-semibold">
                  {eventosFiltrados.length}
                </span>{" "}
                de <span className="font-semibold">{eventos.length}</span>{" "}
                evento(s).
              </div>
            </div>
          </section>
        )}

        {!!erro && !loading && (
          <div
            className="rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/25"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300"
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-rose-800 dark:text-rose-200">
                  Falha ao carregar eventos
                </p>

                <p className="mt-1 break-words text-sm text-rose-800/90 dark:text-rose-200/90">
                  {erro}
                </p>

                <SoftButton
                  type="button"
                  onClick={recarregarEventos}
                  className="mt-3 border border-rose-200 bg-white/80 text-rose-800 hover:bg-white dark:border-rose-900/40 dark:bg-rose-950/10 dark:text-rose-200"
                >
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </SoftButton>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonEvento />
        ) : eventosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem={
              busca
                ? "Nenhum evento encontrado para a busca informada."
                : filtroStatus === "encerrados"
                  ? "Nenhum evento encerrado."
                  : filtroStatus === "rascunhos"
                    ? "Nenhum rascunho encontrado."
                    : "Nenhum evento ativo."
            }
          />
        ) : (
          <ul className="space-y-4 sm:space-y-5">
            {eventosFiltrados.map((evento, index) => {
              const publicado = Boolean(evento.publicado);
              const status = statusUi(deduzStatusEvento(evento));
              const shouldLoadPoster = index < imageLoadBudget;
              const programacaoUrl = getEventoProgramacaoUrl(evento);
              const periodo = getPeriodoEvento(evento);

              return (
                <motion.li
                  key={evento.id || evento.titulo}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm [contain-intrinsic-size:260px] [content-visibility:auto] dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div
                    className="h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/70 to-indigo-500/70"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="shrink-0">
                          <PosterThumb
                            evento={evento}
                            shouldLoad={shouldLoadPoster}
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="break-words text-base font-extrabold text-zinc-900 dark:text-white sm:text-lg">
                            {evento.titulo}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Chip
                              title={
                                publicado
                                  ? "Visível aos usuários"
                                  : "Oculto aos usuários"
                              }
                              className={
                                publicado
                                  ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-200 dark:border-indigo-900/40"
                                  : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-800"
                              }
                            >
                              {publicado ? (
                                <Eye
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <EyeOff
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              {publicado ? "Publicado" : "Rascunho"}
                            </Chip>

                            <Chip title="Status calculado" className={status.chip}>
                              <span
                                className={classNames(
                                  "h-2 w-2 rounded-full",
                                  status.dot
                                )}
                                aria-hidden="true"
                              />
                              {status.label}
                            </Chip>

                            {evento?.restrito && (
                              <Chip
                                title="Evento com inscrição restrita"
                                className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-900/40"
                              >
                                <Lock
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Restrito
                              </Chip>
                            )}

                            {(evento?.programacao_kind === "blob" ||
                              evento?.programacao_pdf_size) && (
                              <Chip
                                title="Programação PDF cadastrada"
                                className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/25 dark:text-sky-200 dark:border-sky-900/40"
                              >
                                <FileText
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                Programação
                              </Chip>
                            )}
                          </div>

                          <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays
                                  className="h-4 w-4 opacity-70"
                                  aria-hidden="true"
                                />
                                <span>
                                  Período:{" "}
                                  <span className="font-medium">{periodo}</span>
                                </span>
                              </span>

                              {evento?.tipo && (
                                <span className="inline-flex items-center gap-1">
                                  <Sparkles
                                    className="h-4 w-4 opacity-70"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    Tipo:{" "}
                                    <span className="font-medium">
                                      {evento.tipo}
                                    </span>
                                  </span>
                                </span>
                              )}

                              {evento?.local && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin
                                    className="h-4 w-4 opacity-70"
                                    aria-hidden="true"
                                  />
                                  <span className="break-words">
                                    Local:{" "}
                                    <span className="font-medium">
                                      {evento.local}
                                    </span>
                                  </span>
                                </span>
                              )}
                            </div>

                            {evento?.publico_alvo && (
                              <div className="break-words">
                                Público-alvo:{" "}
                                <span className="font-medium">
                                  {evento.publico_alvo}
                                </span>
                              </div>
                            )}
                          </div>

                          {(evento?.programacao_kind === "blob" ||
                            evento?.programacao_pdf_size) && (
                            <a
                              href={programacaoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-extrabold text-sky-800 transition hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-200 dark:hover:bg-sky-950/40"
                            >
                              <FileText
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              Abrir programação
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 flex flex-wrap justify-end gap-2">
                        <SoftButton
                          type="button"
                          onClick={() => pedirTogglePublicacao(evento)}
                          disabled={publicandoId === Number(evento.id)}
                          className={classNames(
                            "border bg-white dark:bg-zinc-950",
                            publicado
                              ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-950/25"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-950/25"
                          )}
                          aria-label={
                            publicado
                              ? `Despublicar evento ${evento.titulo}`
                              : `Publicar evento ${evento.titulo}`
                          }
                          aria-pressed={publicado ? "true" : "false"}
                        >
                          {publicandoId === Number(evento.id) ? (
                            <>
                              <RefreshCcw
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                              />
                              Processando
                            </>
                          ) : publicado ? (
                            <>
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                              Despublicar
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              Publicar
                            </>
                          )}
                        </SoftButton>

                        <SoftButton
                          type="button"
                          onClick={() => abrirModalEditar(evento)}
                          className="border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-zinc-950 dark:text-sky-200 dark:hover:bg-sky-950/25"
                          aria-label={`Editar evento ${evento.titulo}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Editar
                        </SoftButton>

                        <SoftButton
                          type="button"
                          onClick={() => pedirExclusao(evento)}
                          className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-zinc-950 dark:text-rose-200 dark:hover:bg-rose-950/25"
                          aria-label={`Excluir evento ${evento.titulo}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Excluir
                        </SoftButton>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {modalAberto && (
        <ModalEvento
          open={modalAberto}
          onClose={fecharModal}
          onSalvar={salvarEvento}
          evento={eventoSelecionado}
          salvando={salvando}
          onTurmaRemovida={recarregarEventos}
        />
      )}
    </section>
  );
}