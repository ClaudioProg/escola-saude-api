// ✅ src/components/layout/Topbar.jsx — v2.2
// Atualizado em: 21/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HeartPulse,
  Info,
  LogOut,
  Menu as MenuIcon,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  apiNotificacaoListar,
  apiNotificacaoResumo,
  apiNotificacaoMarcarLida,
  apiNotificacaoMarcarTodasLidas,
  clearAuthSession,
} from "../../services/api";
import {
  notifyApiError,
  notifyError,
  notifySuccess,
} from "../ui/AppToast";
import { getCampanhaSaudeVisual } from "../../utils/campanhaSaudeVisual";
import ThemeToggleButton from "./ThemeToggleButton";

const STORAGE_TOKEN_KEY = "token";
const STORAGE_PERFIL_KEY = "perfil";

const NOTIFICACAO_TIPO = {
  sistema: {
    label: "Sistema",
    icon: Bell,
    iconClass:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  },
  aviso: {
    label: "Aviso",
    icon: Info,
    iconClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/35 dark:text-amber-200",
  },
  evento: {
    label: "Evento",
    icon: CalendarDays,
    iconClass:
      "bg-sky-100 text-sky-800 dark:bg-sky-950/35 dark:text-sky-200",
  },
  certificado: {
    label: "Certificado",
    icon: CheckCircle2,
    iconClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
  },
  avaliacao: {
    label: "Avaliação",
    icon: Star,
    iconClass:
      "bg-violet-100 text-violet-800 dark:bg-violet-950/35 dark:text-violet-200",
  },
  reserva_aprovada: {
    label: "Reserva aprovada",
    icon: CheckCircle2,
    iconClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-200",
  },
  reserva_rejeitada: {
    label: "Reserva não aprovada",
    icon: Info,
    iconClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/35 dark:text-rose-200",
  },
  submissao: {
    label: "Submissão",
    icon: Info,
    iconClass:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/35 dark:text-indigo-200",
  },
};

const ROTA_LABEL = {
  "/painel": "Painel",
  "/evento": "Eventos",
  "/certificado": "Certificados",
  "/avaliacao": "Avaliações",
  "/notificacao": "Notificações",
  "/perfil": "Perfil",
  "/relatorio": "Relatórios",
  "/reserva": "Reservas",
  "/usuario": "Usuários",
  "/organizador": "Organizadores",
  "/trabalho": "Trabalhos",
  "/solicitacao": "Solicitações",
};

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function getStoredToken() {
  if (!isBrowser()) return null;

  try {
    return localStorage.getItem(STORAGE_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function getStoredPerfil() {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(STORAGE_PERFIL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function limparSessao() {
  if (!isBrowser()) return;

  try {
    clearAuthSession();
  } catch {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_PERFIL_KEY);
    window.dispatchEvent(new CustomEvent("auth:changed"));
  }
}

function getIniciais(nome, email) {
  const nomeFinal = String(nome || "").trim();

  if (nomeFinal) {
    const partes = nomeFinal.split(/\s+/).filter(Boolean);

    if (partes.length >= 2) {
      return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
    }

    return partes[0].slice(0, 2).toUpperCase();
  }

  const emailFinal = String(email || "").trim();

  if (emailFinal) return emailFinal.split("@")[0].slice(0, 2).toUpperCase();

  return "?";
}

function getLabelRota(pathname) {
  const path = String(pathname || "");

  const match = Object.entries(ROTA_LABEL).find(([prefixo]) =>
    path.startsWith(prefixo)
  );

  return match?.[1] || "";
}

function formatarDataNotificacao(value) {
  if (!value) return "";

  const texto = String(value).trim();

  const somenteData = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (somenteData) {
    return `${somenteData[3]}/${somenteData[2]}/${somenteData[1]}`;
  }

  const dataHora = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s]?(\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (dataHora) {
    const [, ano, mes, dia, hora, minuto] = dataHora;
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  }

  return texto;
}

function getNotificacaoTipo(tipo) {
  const tipoFinal = String(tipo || "").trim();

  return (
    NOTIFICACAO_TIPO[tipoFinal] || {
      label: "Notificação",
      icon: Bell,
      iconClass:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    }
  );
}

function getResponseData(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function getResponseMeta(response) {
  if (response?.meta && typeof response.meta === "object") return response.meta;
  return {};
}

function getResumoData(response) {
  if (response?.data && typeof response.data === "object") return response.data;
  if (response && typeof response === "object") return response;
  return {};
}

function NotificationIcon({ tipo }) {
  const item = getNotificacaoTipo(tipo);
  const Icon = item.icon;

  return (
    <span
      className={classNames(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
        item.iconClass
      )}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/60"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/10" />

            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
              <div className="h-3 w-3/4 animate-pulse rounded-xl bg-slate-100 dark:bg-white/10" />
            </div>
          </div>
        </div>
      ))}

      <span className="sr-only">Carregando notificações.</span>
    </div>
  );
}

function NotificationEmpty() {
  return (
    <div
      className="flex min-h-[24rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]"
      role="status"
      aria-live="polite"
    >
      <div className="grid h-16 w-16 place-items-center rounded-[1.75rem] bg-white text-violet-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-violet-300 dark:ring-white/10">
        <Sparkles className="h-7 w-7" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
        Tudo em dia
      </h3>

      <p className="mt-2 max-w-sm text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
        Você não tem notificações não lidas no momento.
      </p>
    </div>
  );
}

function NotificationDrawer({
  aberto,
  aoFechar,
  notificacaoLista,
  totalNaoLida,
  carregando,
  aoMarcarUma,
  aoMarcarTodas,
  aoAbrirCentral,
  marcandoId,
  marcandoTodas,
}) {
  const reducedMotion = useReducedMotion();
  const closeButtonRef = useRef(null);
  const campanha = getCampanhaSaudeVisual();

  useEffect(() => {
    if (!aberto) return undefined;

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus?.();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        aoFechar();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [aberto, aoFechar]);

  const overlayMotion = reducedMotion
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.18 },
      };

  const drawerMotion = reducedMotion
    ? {
        initial: { x: 0 },
        animate: { x: 0 },
        exit: { x: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
        transition: { type: "spring", stiffness: 360, damping: 36 },
      };

  return (
    <AnimatePresence>
      {aberto && (
        <>
          <motion.button
            type="button"
            aria-label="Fechar painel de notificações"
            className="fixed inset-0 z-[79] cursor-default bg-slate-950/55 backdrop-blur-[3px]"
            onClick={aoFechar}
            {...overlayMotion}
          />

          <motion.aside
            className="fixed right-0 top-0 z-[80] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
            role="dialog"
            aria-modal="true"
            aria-label="Painel de notificações"
            {...drawerMotion}
          >
            <header className="relative overflow-hidden border-b border-slate-200 px-4 py-4 dark:border-white/10">
              <div
                className={classNames(
                  "absolute inset-0 bg-gradient-to-br",
                  campanha.gradienteHero
                )}
                aria-hidden="true"
              />

              <div
                className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]"
                aria-hidden="true"
              />

              <div className="relative flex items-start justify-between gap-3 text-white">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-black">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    Notificações
                  </div>

                  <p className="mt-1 text-sm font-medium text-white/85">
                    {totalNaoLida} não lida{totalNaoLida === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={aoFechar}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="Fechar painel de notificações"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="relative mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={aoMarcarTodas}
                  disabled={marcandoTodas || totalNaoLida === 0}
                  className={classNames(
                    "inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition",
                    marcandoTodas || totalNaoLida === 0
                      ? "cursor-not-allowed bg-white/10 text-white/60"
                      : "bg-white/15 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  )}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {marcandoTodas ? "Marcando..." : "Marcar todas"}
                </button>

                <button
                  type="button"
                  onClick={aoAbrirCentral}
                  className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-900 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Ver todas
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {carregando ? (
                <NotificationSkeleton />
              ) : notificacaoLista.length === 0 ? (
                <NotificationEmpty />
              ) : (
                <div className="space-y-3">
                  {notificacaoLista.map((notificacao) => {
                    const tipo = getNotificacaoTipo(notificacao.tipo);

                    return (
                      <article
                        key={notificacao.id}
                        className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm transition dark:border-amber-900/40 dark:bg-amber-950/15"
                      >
                        <div className="flex items-start gap-3">
                          <NotificationIcon tipo={notificacao.tipo} />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                                {notificacao.titulo || "Notificação"}
                              </h3>

                              <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-black text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                                {tipo.label}
                              </span>

                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/30 dark:text-amber-200">
                                não lida
                              </span>
                            </div>

                            {notificacao.mensagem && (
                              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                                {String(notificacao.mensagem)}
                              </p>
                            )}

                            {notificacao.criado_em && (
                              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {formatarDataNotificacao(notificacao.criado_em)}
                              </p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => aoMarcarUma(notificacao)}
                                disabled={marcandoId === notificacao.id}
                                className={classNames(
                                  "inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition",
                                  marcandoId === notificacao.id
                                    ? "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    : "bg-slate-950 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                                )}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" />
                                {marcandoId === notificacao.id
                                  ? "Salvando..."
                                  : "Marcar como lida"}
                              </button>

                              {notificacao.link && (
                                <button
                                  type="button"
                                  onClick={() => aoMarcarUma(notificacao, true)}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
                                >
                                  <ExternalLink
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Abrir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Topbar({
  titulo = "Plataforma Escola da Saúde",
  aoAbrirMenu,
  abrirMenuRef,
  drawerId = "menu-lateral-mobile",
  logoSrc = "/logo-escola-saude.png",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const campanha = getCampanhaSaudeVisual();

  const [token, setToken] = useState(() => getStoredToken());
  const [perfil, setPerfil] = useState(() => getStoredPerfil());
  const [logoFalhou, setLogoFalhou] = useState(false);

  const [totalNaoLida, setTotalNaoLida] = useState(0);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [carregandoNotificacao, setCarregandoNotificacao] = useState(false);
  const [notificacaoLista, setNotificacaoLista] = useState([]);
  const [marcandoId, setMarcandoId] = useState(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const abortContadorRef = useRef(null);
  const abortDrawerRef = useRef(null);

  const nomeUsuario = perfil?.nome || "Usuário";
  const emailUsuario = perfil?.email || "";

  const iniciais = useMemo(
    () => getIniciais(nomeUsuario, emailUsuario),
    [emailUsuario, nomeUsuario]
  );

  const rotaLabel = useMemo(
    () => getLabelRota(location.pathname),
    [location.pathname]
  );

  const claro = campanha.textoContraste === "escuro";
  const focoClass = campanha.foco || "focus-visible:ring-emerald-500";

  const atualizarSessaoLocal = useCallback(() => {
    setToken(getStoredToken());
    setPerfil(getStoredPerfil());
  }, []);

  const atualizarContadorNotificacao = useCallback(async () => {
    const tokenAtual = getStoredToken();

    if (!tokenAtual || document.hidden) return;

    abortContadorRef.current?.abort?.();

    const controller = new AbortController();
    abortContadorRef.current = controller;

    try {
      const response = await apiNotificacaoResumo({
        on401: "silent",
        on403: "silent",
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = getResumoData(response);
      setTotalNaoLida(Number(data.nao_lida || 0));
    } catch (error) {
      if (error?.name !== "AbortError") {
        notifyApiError(error, {
          titulo: "Não foi possível atualizar as notificações.",
          acao: "As demais funções continuam disponíveis. Tente novamente em instantes.",
          options: { toastId: "topbar-notificacao-contador-erro" },
        });
      }
    }
  }, []);

  const carregarNotificacaoDrawer = useCallback(async () => {
    const tokenAtual = getStoredToken();

    if (!tokenAtual) {
      setNotificacaoLista([]);
      setTotalNaoLida(0);
      return;
    }

    abortDrawerRef.current?.abort?.();

    const controller = new AbortController();
    abortDrawerRef.current = controller;

    try {
      setCarregandoNotificacao(true);

      const [listaResponse, resumoResponse] = await Promise.all([
        apiNotificacaoListar(
          { apenas_nao_lida: true, limite: 8, deslocamento: 0 },
          { on401: "silent", on403: "silent", signal: controller.signal }
        ),
        apiNotificacaoResumo({
          on401: "silent",
          on403: "silent",
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) return;

      const lista = getResponseData(listaResponse);
      const meta = getResponseMeta(listaResponse);
      const resumo = getResumoData(resumoResponse);

      setNotificacaoLista(lista);
      setTotalNaoLida(
        Number(resumo.nao_lida ?? meta.total ?? lista.length ?? 0) || 0
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        setNotificacaoLista([]);

        notifyApiError(error, {
          titulo: "Não foi possível carregar suas notificações.",
          acao: "Tente abrir o painel novamente. Se o problema continuar, acione o suporte.",
          options: { toastId: "topbar-notificacao-lista-erro" },
        });
      }
    } finally {
      if (!controller.signal.aborted) setCarregandoNotificacao(false);
    }
  }, []);

  const abrirDrawerNotificacao = useCallback(async () => {
    setDrawerAberto(true);
    await carregarNotificacaoDrawer();
  }, [carregarNotificacaoDrawer]);

  const fecharDrawerNotificacao = useCallback(() => {
    setDrawerAberto(false);
  }, []);

  const marcarNotificacaoComoLida = useCallback(
    async (notificacao, navegarApos = false) => {
      if (!notificacao?.id) {
        notifyError("Não foi possível identificar a notificação selecionada.");
        return;
      }

      try {
        setMarcandoId(notificacao.id);

        await apiNotificacaoMarcarLida(notificacao.id, {
          on401: "silent",
          on403: "silent",
        });

        setNotificacaoLista((atual) =>
          atual.filter((item) => item.id !== notificacao.id)
        );

        setTotalNaoLida((atual) => Math.max(0, Number(atual || 0) - 1));

        if (navegarApos && notificacao.link) {
          fecharDrawerNotificacao();
          navigate(notificacao.link);
        }
      } catch (error) {
        notifyApiError(error, {
          titulo: "Não foi possível marcar a notificação como lida.",
          acao: "Tente novamente. Se o problema continuar, acione o suporte.",
          options: { toastId: `topbar-notificacao-marcar-${notificacao.id}` },
        });
      } finally {
        setMarcandoId(null);
      }
    },
    [fecharDrawerNotificacao, navigate]
  );

  const marcarTodasComoLidas = useCallback(async () => {
    if (!totalNaoLida) return;

    try {
      setMarcandoTodas(true);

      await apiNotificacaoMarcarTodasLidas({
        on401: "silent",
        on403: "silent",
      });

      setNotificacaoLista([]);
      setTotalNaoLida(0);

      notifySuccess("Todas as notificações foram marcadas como lidas.");
    } catch (error) {
      notifyApiError(error, {
        titulo: "Não foi possível marcar todas as notificações como lidas.",
        acao: "Tente novamente. Se o problema persistir, acione o suporte.",
        options: { toastId: "topbar-notificacao-marcar-todas" },
      });
    } finally {
      setMarcandoTodas(false);
    }
  }, [totalNaoLida]);

  const sair = useCallback(() => {
    limparSessao();
    atualizarSessaoLocal();
    navigate("/login", { replace: true });
  }, [atualizarSessaoLocal, navigate]);

  const abrirMenu = useCallback(() => {
    if (typeof aoAbrirMenu === "function") {
      aoAbrirMenu();
      return;
    }

    notifyError("Não foi possível abrir o menu lateral.");
  }, [aoAbrirMenu]);

  useEffect(() => {
    atualizarSessaoLocal();
  }, [atualizarSessaoLocal, location.pathname]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === STORAGE_TOKEN_KEY || event.key === STORAGE_PERFIL_KEY) {
        atualizarSessaoLocal();
      }
    }

    function handleAuthChanged() {
      atualizarSessaoLocal();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth:changed", handleAuthChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth:changed", handleAuthChanged);
    };
  }, [atualizarSessaoLocal]);

  useEffect(() => {
    if (!token) return undefined;

    atualizarContadorNotificacao();

    const intervalId = window.setInterval(atualizarContadorNotificacao, 30000);

    function handleVisibility() {
      if (!document.hidden) atualizarContadorNotificacao();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      abortContadorRef.current?.abort?.();
      abortDrawerRef.current?.abort?.();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [atualizarContadorNotificacao, token]);

  return (
    <>
      <header className="sticky top-0 z-50 px-2 py-2 sm:px-4">
        <div
          className={classNames(
            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r blur-3xl opacity-80 dark:opacity-35",
            campanha.topbarGlow
          )}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="relative isolate overflow-hidden rounded-[1.75rem] border border-slate-200/75 bg-white/86 shadow-[0_18px_55px_-38px_rgba(15,23,42,.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/96 dark:shadow-[0_22px_70px_-42px_rgba(0,0,0,.9)]">
            <div
              className="pointer-events-none absolute inset-0 hidden bg-slate-950/72 dark:block"
              aria-hidden="true"
            />

            <div
              className={classNames(
                "absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r",
                campanha.topbar
              )}
              aria-hidden="true"
            />

            <div className="relative flex min-h-[4.75rem] items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  ref={abrirMenuRef}
                  type="button"
                  onClick={abrirMenu}
                  className={classNames(
                    "inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10 md:hidden",
                    focoClass
                  )}
                  aria-label="Abrir menu lateral"
                  aria-controls={drawerId}
                  aria-haspopup="dialog"
                >
                  <MenuIcon className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="hidden h-10 w-px bg-slate-200 dark:bg-white/10 sm:block" />

                <button
                  type="button"
                  onClick={() => navigate("/painel")}
                  className={classNames(
                    "group flex min-w-0 items-center gap-3 rounded-3xl px-1 text-left focus-visible:outline-none focus-visible:ring-2",
                    focoClass
                  )}
                  aria-label="Ir para o painel"
                  title={titulo}
                >
                  <span
                    className={classNames(
                      "grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-sm transition group-hover:scale-[1.02]",
                      claro
                        ? "border-white/70 bg-white/70 text-slate-900 dark:border-white/10 dark:bg-slate-900 dark:text-white"
                        : "border-white/20 bg-white/15 text-white dark:border-white/10 dark:bg-slate-900"
                    )}
                  >
                    {logoSrc && !logoFalhou ? (
                      <img
                        src={logoSrc}
                        alt=""
                        className="h-9 w-9 object-contain"
                        onError={() => setLogoFalhou(true)}
                      />
                    ) : (
                      <HeartPulse className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
                    )}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black tracking-tight text-slate-950 dark:text-white sm:text-lg">
                      {titulo}
                    </span>

                    <span className="hidden truncate text-xs font-semibold text-slate-500 dark:text-slate-400 sm:block">
                      Escola Municipal de Saúde Pública
                    </span>
                  </span>
                </button>

                {rotaLabel && (
                  <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 lg:inline-flex">
                    <ChevronRight
                      className="h-3.5 w-3.5 opacity-70"
                      aria-hidden="true"
                    />
                    <span className="max-w-[220px] truncate">{rotaLabel}</span>
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggleButton showText={false} />

                <button
                  type="button"
                  onClick={abrirDrawerNotificacao}
                  className={classNames(
                    "relative inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10",
                    focoClass
                  )}
                  aria-label={
                    totalNaoLida
                      ? `Abrir notificações, ${totalNaoLida} não lidas`
                      : "Abrir notificações"
                  }
                  title="Notificações"
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />

                  {totalNaoLida > 0 && (
                    <span
                      className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-950"
                      aria-hidden="true"
                    >
                      {totalNaoLida > 99 ? "99+" : totalNaoLida}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/perfil")}
                  className={classNames(
                    "hidden min-h-12 items-center gap-3 rounded-3xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10 md:inline-flex",
                    focoClass
                  )}
                  title={nomeUsuario}
                >
                  <span
                    className={classNames(
                      "grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br text-xs font-black shadow-sm",
                      campanha.topbar,
                      claro ? "text-slate-950 dark:text-slate-950" : "text-white"
                    )}
                  >
                    {iniciais}
                  </span>

                  <span className="hidden min-w-0 text-left lg:block">
                    <span className="block max-w-[13rem] truncate">
                      {nomeUsuario}
                    </span>

                    <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Usuário
                    </span>
                  </span>

                  <UserRound
                    className="h-4 w-4 opacity-70 lg:hidden"
                    aria-hidden="true"
                  />

                  <ChevronDown
                    className="hidden h-4 w-4 opacity-70 lg:block"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={sair}
                  className={classNames(
                    "inline-flex min-h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-white/10",
                    focoClass
                  )}
                  aria-label="Sair da plataforma"
                  title="Sair"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <NotificationDrawer
        aberto={drawerAberto}
        aoFechar={fecharDrawerNotificacao}
        notificacaoLista={notificacaoLista}
        totalNaoLida={totalNaoLida}
        carregando={carregandoNotificacao}
        aoMarcarUma={marcarNotificacaoComoLida}
        aoMarcarTodas={marcarTodasComoLidas}
        aoAbrirCentral={() => {
          fecharDrawerNotificacao();
          navigate("/notificacao");
        }}
        marcandoId={marcandoId}
        marcandoTodas={marcandoTodas}
      />
    </>
  );
}

NotificationIcon.propTypes = {
  tipo: PropTypes.string,
};

NotificationDrawer.propTypes = {
  aberto: PropTypes.bool.isRequired,
  aoFechar: PropTypes.func.isRequired,
  notificacaoLista: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      tipo: PropTypes.string,
      titulo: PropTypes.string,
      mensagem: PropTypes.string,
      criado_em: PropTypes.string,
      link: PropTypes.string,
    })
  ).isRequired,
  totalNaoLida: PropTypes.number.isRequired,
  carregando: PropTypes.bool.isRequired,
  aoMarcarUma: PropTypes.func.isRequired,
  aoMarcarTodas: PropTypes.func.isRequired,
  aoAbrirCentral: PropTypes.func.isRequired,
  marcandoId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  marcandoTodas: PropTypes.bool.isRequired,
};

Topbar.propTypes = {
  titulo: PropTypes.string,
  aoAbrirMenu: PropTypes.func,
  abrirMenuRef: PropTypes.shape({
    current: PropTypes.instanceOf(Element),
  }),
  drawerId: PropTypes.string,
  logoSrc: PropTypes.string,
};