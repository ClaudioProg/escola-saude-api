// ✅ frontend/src/pages/PresencaManual.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página administrativa/organizador para confirmação manual de presença do dia.
//
// Contratos aplicados:
// - Query oficial: turma_id
// - Lista de inscritos: api.inscricao.listarPorTurma(turma_id)
// - Confirmação manual de hoje: api.presenca.confirmarManualHoje({ usuario_id, turma_id })
// - Sem query antiga "turma"
// - Sem /api manual no frontend
// - Sem /api/turmas/:id/inscritos
// - Sem /api/presencas/confirmar-simples
// - Sem apiGet/apiPost direto
// - Sem toast direto
// - Sem Footer antigo
// - Sem CarregandoSkeleton antigo
// - Sem ErroCarregamento antigo
// - Sem NadaEncontrado antigo
// - Sem bg-gelo
// - Sem formatarCPF externo
// - Date-only seguro em YYYY-MM-DD
// - Visual v2.0 real, mobile-first, dark mode, acessível e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Home,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  X,
  XCircle,
} from "lucide-react";

import { api } from "../services/api";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
} from "../components/ui/AppToast";

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function hojeLocalISO() {
  const data = new Date();
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatarDataBR(dateOnly) {
  const safe = String(dateOnly || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
    return "—";
  }

  const [year, month, day] = safe.split("-");
  return `${day}/${month}/${year}`;
}

function somenteDigitos(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function cpfProtegido(value) {
  const digits = somenteDigitos(value);

  if (digits.length !== 11) {
    return value ? String(value) : "—";
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.***-**`;
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("abort") ||
    message.includes("aborted") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

function unwrapArray(response) {
  const data = response?.data !== undefined ? response.data : response;

  return Array.isArray(data) ? data : [];
}

function getRawToken() {
  try {
    const raw = localStorage.getItem("token");

    return raw ? raw.trim() : null;
  } catch {
    return null;
  }
}

function safeAtob(value) {
  try {
    return atob(value);
  } catch {
    const pad =
      value.length % 4 === 2 ? "==" : value.length % 4 === 3 ? "=" : "";

    try {
      return atob(value + pad);
    } catch {
      return "";
    }
  }
}

function getValidToken() {
  const raw = getRawToken();

  if (!raw) return null;

  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
  const parts = token.split(".");

  if (parts.length !== 3) return null;

  try {
    const payloadStr = safeAtob(
      parts[1].replace(/-/g, "+").replace(/_/g, "/")
    );

    const payload = JSON.parse(payloadStr || "{}");
    const now = Date.now() / 1000;

    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;

    return token;
  } catch {
    return null;
  }
}

function inscritoEstaPresenteHoje(inscrito, hojeISO) {
  if (inscrito?.presente_hoje === true) return true;
  if (inscrito?.presente === true && inscrito?.data_presenca === hojeISO) return true;

  const datasDiretas = [
    inscrito?.data_presenca,
    inscrito?.datas_presentes,
    inscrito?.presencas,
    inscrito?.datas?.presentes,
  ];

  for (const value of datasDiretas) {
    if (Array.isArray(value)) {
      if (value.map(String).some((item) => item.slice(0, 10) === hojeISO)) {
        return true;
      }
    }

    if (typeof value === "string" && value.slice(0, 10) === hojeISO) {
      return true;
    }
  }

  return false;
}

function getInscritoKey(inscrito, index) {
  return (
    toPositiveInt(inscrito?.usuario_id) ||
    toPositiveInt(inscrito?.id) ||
    somenteDigitos(inscrito?.cpf) ||
    String(inscrito?.email || "") ||
    `linha-${index}`
  );
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais v2.0
 * ───────────────────────────────────────────────────────────── */

function LoadingInline({ label = "Carregando..." }) {
  return (
    <div
      className="inline-flex items-center justify-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-300"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral:
      "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    bad: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
  };

  return (
    <article
      className={classNames(
        "rounded-3xl border p-3 text-center shadow-sm sm:p-4",
        tones[tone] || tones.neutral
      )}
    >
      <div className="inline-flex items-center justify-center gap-2 text-[11px] font-black uppercase tracking-wide opacity-80 sm:text-xs">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>

      <div className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
        {value}
      </div>
    </article>
  );
}

function HeaderHero({ turma_id, hojeISO, onRefresh, carregando }) {
  const dataBR = useMemo(() => formatarDataBR(hojeISO), [hojeISO]);

  return (
    <header className="relative isolate overflow-hidden text-white" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950 via-orange-800 to-rose-700" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_82%_28%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.20),transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[360px] w-[960px] max-w-[95vw] -translate-x-1/2 rounded-full bg-amber-300/20 blur-3xl"
      />

      <a
        href="#conteudo"
        className="relative sr-only px-3 py-2 text-sm focus:not-sr-only focus:block focus:bg-white/20 focus:text-white"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 md:py-12">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 text-center lg:text-left">
            <div className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              Presença manual v2.0
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Presença manual
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
              Confirme presenças do dia para os participantes da turma
              selecionada, com operação autenticada, rastreável e alinhada ao
              contrato oficial.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-black ring-1 ring-white/15">
                Turma #{turma_id || "—"}
              </span>

              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-black ring-1 ring-white/15">
                Data {dataBR}
              </span>

              <button
                type="button"
                onClick={onRefresh}
                disabled={carregando}
                className={classNames(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black text-white shadow-sm transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  carregando
                    ? "cursor-not-allowed bg-white/20 opacity-70"
                    : "bg-white/15 hover:bg-white/25"
                )}
                aria-label="Atualizar lista de inscritos"
                aria-busy={carregando ? "true" : "false"}
              >
                {carregando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
                Atualizar
              </button>
            </div>
          </div>

          <div className="hidden rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur lg:block lg:w-[340px]">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>

              <div>
                <p className="text-sm font-black">Registro controlado</p>
                <p className="mt-1 text-xs leading-relaxed text-white/75">
                  A regra final de prazo, turma e permissão permanece no
                  backend. A tela apenas organiza a operação.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-px w-full bg-white/25" aria-hidden="true" />
    </header>
  );
}

function ToolbarBusca({
  busca,
  setBusca,
  limparBusca,
  inputRef,
  carregando,
  onRefresh,
}) {
  return (
    <section
      aria-label="Busca e ações"
      className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Buscar por nome, CPF ou e-mail</span>

          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-24 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            autoComplete="off"
          />

          {busca ? (
            <button
              type="button"
              onClick={limparBusca}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              aria-label="Limpar busca"
            >
              Limpar
            </button>
          ) : null}
        </label>

        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-amber-700 px-4 text-sm font-black text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          Atualizar
        </button>
      </div>
    </section>
  );
}

function EmptyState({ icon: Icon = ClipboardCheck, title, description, actionLabel, onAction }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>

      <h2 className="text-lg font-black text-slate-950 dark:text-white">
        {title}
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-300">
        {description}
      </p>

      {actionLabel && typeof onAction === "function" && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </section>
  );
}

function ParticipanteCard({
  inscrito,
  hojeISO,
  presenteHoje,
  marcando,
  onRegistrar,
}) {
  const usuario_id = toPositiveInt(inscrito?.usuario_id || inscrito?.id);
  const bloqueado = presenteHoje || marcando === usuario_id;

  return (
    <li className="p-3 sm:p-4">
      <article className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span
              className={classNames(
                "grid h-11 w-11 shrink-0 place-items-center rounded-2xl",
                presenteHoje
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              )}
            >
              {presenteHoje ? (
                <UserCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <UserX className="h-5 w-5" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0">
              <h3 className="break-words text-base font-black text-slate-950 dark:text-white">
                {inscrito?.nome || "Participante sem nome"}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>CPF: {cpfProtegido(inscrito?.cpf)}</span>
                {inscrito?.email ? <span>• {inscrito.email}</span> : null}
                <span>• {formatarDataBR(hojeISO)}</span>
              </div>

              <p
                className={classNames(
                  "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black",
                  presenteHoje
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                )}
              >
                {presenteHoje ? "Presente hoje" : "Ausente hoje"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRegistrar(usuario_id, inscrito?.nome)}
          disabled={bloqueado || !usuario_id}
          className={classNames(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-70",
            presenteHoje
              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              : "bg-amber-700 text-white hover:bg-amber-800"
          )}
          aria-label={`Marcar presença para ${inscrito?.nome || "participante"}`}
        >
          {marcando === usuario_id ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Registrando...
            </>
          ) : presenteHoje ? (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Registrado
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              Marcar presença
            </>
          )}
        </button>
      </article>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function PresencaManual() {
  const reduceMotion = useReducedMotion();

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const turma_id = useMemo(() => params.get("turma_id") || "", [params]);
  const turmaIdSeguro = useMemo(() => toPositiveInt(turma_id), [turma_id]);
  const turmaValida = Boolean(turmaIdSeguro);

  const [inscritos, setInscritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [marcando, setMarcando] = useState(null);

  const liveRef = useRef(null);
  const inputBuscaRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  const hojeISO = useMemo(() => hojeLocalISO(), []);

  const setLive = useCallback((message) => {
    if (liveRef.current) {
      liveRef.current.textContent = message || "";
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      try {
        abortRef.current?.abort?.("unmount");
      } catch {
        // noop
      }
    };
  }, []);

  useEffect(() => {
    if (!getValidToken()) {
      const redirect = `${location.pathname}${location.search}`;

      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, {
        replace: true,
      });
    }
  }, [location.pathname, location.search, navigate]);

  const carregarInscritos = useCallback(async () => {
    if (!turmaValida) {
      setErro("turma_id ausente ou inválido.");
      setInscritos([]);
      setCarregando(false);
      setLive("turma_id inválido.");
      return;
    }

    try {
      abortRef.current?.abort?.("new-request");
    } catch {
      // noop
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando inscritos.");

      const response = await api.inscricao.listarPorTurma(turmaIdSeguro, {
        signal: controller.signal,
      });

      const lista = unwrapArray(response);

      if (!mountedRef.current) return;

      setInscritos(lista);
      setLive(`Inscritos carregados. Total: ${lista.length}.`);
    } catch (error) {
      if (isAbortLike(error)) return;

      const message = getErrorMessage(error, "Erro ao carregar inscritos.");

      if (!mountedRef.current) return;

      setErro(message);
      setInscritos([]);
      notifyError(message);
      setLive("Falha ao carregar inscritos.");
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [setLive, turmaIdSeguro, turmaValida]);

  useEffect(() => {
    carregarInscritos();
  }, [carregarInscritos]);

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busca);
    const qDigits = somenteDigitos(busca);

    if (!q && !qDigits) return inscritos;

    return inscritos.filter((inscrito) => {
      const nome = normalizarTexto(inscrito?.nome);
      const email = normalizarTexto(inscrito?.email);
      const cpf = somenteDigitos(inscrito?.cpf);

      return (
        nome.includes(q) ||
        email.includes(q) ||
        (qDigits && cpf.includes(qDigits))
      );
    });
  }, [busca, inscritos]);

  const stats = useMemo(() => {
    let presentes = 0;

    for (const inscrito of filtrados) {
      if (inscritoEstaPresenteHoje(inscrito, hojeISO)) {
        presentes += 1;
      }
    }

    return {
      total: filtrados.length,
      presentes,
      ausentes: Math.max(0, filtrados.length - presentes),
    };
  }, [filtrados, hojeISO]);

  const registrarPresenca = useCallback(
    async (usuario_id, nome) => {
      const usuarioIdSeguro = toPositiveInt(usuario_id);

      if (!turmaValida || !usuarioIdSeguro) return;

      setMarcando(usuarioIdSeguro);
      setLive(`Registrando presença para ${nome || "participante"}.`);

      try {
        await api.presenca.confirmarManualHoje({
          turma_id: turmaIdSeguro,
          usuario_id: usuarioIdSeguro,
        });

        setInscritos((prev) =>
          prev.map((item) => {
            const itemUsuarioId = toPositiveInt(item?.usuario_id || item?.id);

            if (itemUsuarioId !== usuarioIdSeguro) {
              return item;
            }

            const datas = Array.isArray(item?.data_presenca)
              ? item.data_presenca
              : [];

            return {
              ...item,
              usuario_id: itemUsuarioId,
              presente_hoje: true,
              data_presenca: datas.includes(hojeISO)
                ? datas
                : [...datas, hojeISO],
            };
          })
        );

        notifySuccess("Presença registrada com sucesso.");
        setLive(`Presença registrada para ${nome || "participante"}.`);
      } catch (error) {
        notifyError(
          getErrorMessage(error, "Não foi possível registrar presença.")
        );
        setLive("Falha ao registrar presença.");
      } finally {
        setMarcando(null);
      }
    },
    [hojeISO, setLive, turmaIdSeguro, turmaValida]
  );

  const limparBusca = useCallback(() => {
    setBusca("");
    setLive("Busca limpa.");
    inputBuscaRef.current?.focus?.();
  }, [setLive]);

  const motionConfig = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      exit: reduceMotion ? {} : { opacity: 0, y: 10 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <HeaderHero
        turma_id={turma_id}
        hojeISO={hojeISO}
        onRefresh={carregarInscritos}
        carregando={carregando}
      />

      {carregando && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-amber-100 dark:bg-amber-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando inscritos"
        >
          <div className="h-full w-1/3 animate-pulse bg-amber-700 dark:bg-amber-500" />
        </div>
      )}

      <main
        id="conteudo"
        role="main"
        className="flex-1 px-3 py-6 sm:px-4 lg:px-6"
        aria-busy={carregando ? "true" : "false"}
      >
        <p
          ref={liveRef}
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        />

        <section className="mx-auto max-w-5xl space-y-5">
          <ToolbarBusca
            busca={busca}
            setBusca={setBusca}
            limparBusca={limparBusca}
            inputRef={inputBuscaRef}
            carregando={carregando}
            onRefresh={carregarInscritos}
          />

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MiniStat
              icon={Users}
              label="Total filtrado"
              value={stats.total}
              tone="neutral"
            />
            <MiniStat
              icon={UserCheck}
              label="Presentes hoje"
              value={stats.presentes}
              tone="ok"
            />
            <MiniStat
              icon={UserX}
              label="Ausentes hoje"
              value={stats.ausentes}
              tone="bad"
            />
          </div>

          <AnimatePresence mode="wait">
            {carregando ? (
              <motion.section
                key="loading"
                {...motionConfig}
                className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <LoadingInline label="Carregando inscritos..." />
              </motion.section>
            ) : erro ? (
              <motion.section
                key="error"
                {...motionConfig}
                className="rounded-[2rem] border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30"
                role="alert"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-black text-rose-900 dark:text-rose-100">
                      Não foi possível carregar os inscritos
                    </h2>

                    <p className="mt-1 break-words text-sm text-rose-800/90 dark:text-rose-100/90">
                      {erro}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={carregarInscritos}
                        className="inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Tentar novamente
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-black text-rose-800 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900/50 dark:bg-slate-950 dark:text-rose-100 dark:hover:bg-rose-950/30"
                      >
                        <Home className="h-4 w-4" aria-hidden="true" />
                        Voltar
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            ) : !turmaValida ? (
              <motion.div key="invalid" {...motionConfig}>
                <EmptyState
                  icon={XCircle}
                  title="Turma inválida"
                  description="Informe a turma pelo parâmetro oficial turma_id na URL."
                />
              </motion.div>
            ) : filtrados.length === 0 ? (
              <motion.div key="empty" {...motionConfig}>
                <EmptyState
                  icon={Users}
                  title={
                    busca
                      ? "Nenhum participante corresponde à busca"
                      : "Nenhum inscrito encontrado"
                  }
                  description={
                    busca
                      ? "Tente ajustar o termo pesquisado ou limpe a busca para ver todos."
                      : "Esta turma ainda não possui inscritos retornados pelo sistema."
                  }
                  actionLabel={busca ? "Limpar busca" : "Atualizar"}
                  onAction={busca ? limparBusca : carregarInscritos}
                />
              </motion.div>
            ) : (
              <motion.section
                key="content"
                {...motionConfig}
                aria-label={`Lista de inscritos da turma ${turma_id || ""}`}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                        Inscritos
                      </h2>

                      <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                        Busque por nome, CPF ou e-mail e confirme a presença
                        individualmente.
                      </p>
                    </div>

                    <div className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      Exibindo {filtrados.length}
                    </div>
                  </div>
                </div>

                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtrados.map((inscrito, index) => {
                    const presenteHoje = inscritoEstaPresenteHoje(
                      inscrito,
                      hojeISO
                    );

                    return (
                      <ParticipanteCard
                        key={getInscritoKey(inscrito, index)}
                        inscrito={inscrito}
                        hojeISO={hojeISO}
                        presenteHoje={presenteHoje}
                        marcando={marcando}
                        onRegistrar={registrarPresenca}
                      />
                    );
                  })}
                </ul>
              </motion.section>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}