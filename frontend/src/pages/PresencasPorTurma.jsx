// ✅ frontend/src/pages/PresencasPorTurma.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página de presenças por turma.
//
// Contratos aplicados:
// - Parâmetro oficial da rota: turma_id
// - Consulta oficial: api.presenca.turmaDetalhe(turma_id)
// - Confirmação oficial pelo organizador/admin:
//   api.presenca.confirmarorganizador({ usuario_id, turma_id, data_presenca })
// - Sem /api manual no frontend
// - Sem /api/relatorio-presencas/turma/:id
// - Sem /api/presencas/confirmar-simples
// - Sem apiGet/apiPost direto
// - Sem toast direto
// - Sem Footer antigo
// - Sem CarregandoSkeleton/ErroCarregamento/NadaEncontrado em caminho antigo
// - Sem bg-gelo
// - Sem date-fns
// - Sem style inline
// - Date-only seguro em YYYY-MM-DD
// - Visual v2.0 real, mobile-first, dark mode, acessível e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Hourglass,
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
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import Footer from "../components/layout/Footer";
import {
  notifyError,
  notifySuccess,
} from "../components/ui/AppToast";

/* ─────────────────────────────────────────────────────────────
 * Helpers base
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function ymd(value) {
  const safe = String(value || "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe;
  if (/^\d{4}-\d{2}-\d{2}T/.test(safe)) return safe.slice(0, 10);

  return "";
}

function hhmm(value, fallback = "00:00") {
  const safe = String(value || "").trim();

  if (/^\d{2}:\d{2}$/.test(safe)) return safe;
  if (/^\d{2}:\d{2}:\d{2}$/.test(safe)) return safe.slice(0, 5);

  return fallback;
}

function makeLocalDate(dateOnly, time = "00:00") {
  const data = ymd(dateOnly);
  const hora = hhmm(time, "00:00");

  if (!data || !hora) return null;

  const [year, month, day] = data.split("-").map(Number);
  const [hour, minute] = hora.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatarDataBR(value) {
  const data = ymd(value);

  if (!data) return "—";

  const [year, month, day] = data.split("-");
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

function unwrapData(response) {
  return response?.data !== undefined ? response.data : response;
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

/* ─────────────────────────────────────────────────────────────
 * Normalização do retorno oficial
 * ───────────────────────────────────────────────────────────── */

function normalizarLinhasPresenca(payload) {
  const data = unwrapData(payload);

  if (!data || typeof data !== "object") {
    return [];
  }

  const datas = Array.isArray(data?.datas) ? data.datas.map(ymd).filter(Boolean) : [];
  const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];

  const linhas = [];

  for (const usuario of usuarios) {
    const usuario_id = toPositiveInt(usuario?.usuario_id || usuario?.id);

    if (!usuario_id) continue;

    const mapaPresencas = new Map();

    if (Array.isArray(usuario?.presencas)) {
      for (const item of usuario.presencas) {
        const dataPresenca = ymd(item?.data || item?.data_presenca);

        if (!dataPresenca) continue;

        mapaPresencas.set(dataPresenca, {
          presente: item?.presente === true,
          confirmado_em: item?.confirmado_em || null,
        });
      }
    }

    const datasBase = datas.length
      ? datas
      : Array.from(mapaPresencas.keys()).sort();

    for (const data_referencia of datasBase) {
      const registro = mapaPresencas.get(data_referencia);
      const presente = registro?.presente === true;

      linhas.push({
        usuario_id,
        turma_id: toPositiveInt(data?.turma_id),
        evento_id: toPositiveInt(data?.evento_id),
        nome: usuario?.nome || "Participante sem nome",
        cpf: usuario?.cpf || usuario?.cpf_protegido || "",
        email: usuario?.email || "",
        data_referencia,
        data_presenca: presente ? data_referencia : null,
        presente,
        confirmado_em: registro?.confirmado_em || null,
      });
    }
  }

  return linhas;
}

function getStatusFlags(registro, agora = new Date()) {
  const dataReferencia = ymd(registro?.data_referencia);
  const horarioInicio = hhmm(registro?.horario_inicio || "00:00");
  const horarioFim = hhmm(registro?.horario_fim || "23:59");

  const inicio = makeLocalDate(dataReferencia, horarioInicio);
  const fim = makeLocalDate(dataReferencia, horarioFim);

  const presente = Boolean(registro?.data_presenca) || registro?.presente === true;

  if (!inicio || !fim) {
    return {
      presente,
      aguardando: false,
      dentroJanelaConfirmacao: false,
      expirado: !presente,
    };
  }

  const umHoraDepoisInicio = new Date(inicio.getTime() + 60 * 60 * 1000);
  const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);

  const aguardando = !presente && agora < umHoraDepoisInicio;
  const dentroJanelaConfirmacao =
    !presente && agora >= umHoraDepoisInicio && agora <= expiracao;
  const expirado = !presente && agora > expiracao;

  return {
    presente,
    aguardando,
    dentroJanelaConfirmacao,
    expirado,
    expiracao,
  };
}

/* ─────────────────────────────────────────────────────────────
 * Componentes locais v2.0
 * ───────────────────────────────────────────────────────────── */

function HeaderHero({ turma_id, onRefresh, carregando }) {
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
              Presenças por turma v2.0
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Presenças por turma
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
              Consulte registros por participante e confirme presenças pendentes
              dentro da janela administrativa permitida.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-black ring-1 ring-white/15">
                Turma #{turma_id || "—"}
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
                aria-label="Atualizar lista de presenças"
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

          <div className="hidden rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-sm backdrop-blur lg:block lg:w-[360px]">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>

              <div>
                <p className="text-sm font-black">Regra operacional</p>
                <p className="mt-1 text-xs leading-relaxed text-white/75">
                  A confirmação manual segue validação de permissão, turma,
                  data e prazo diretamente no backend.
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

function MiniStat({ icon: Icon, label, value, tone = "neutral" }) {
  const tones = {
    neutral:
      "border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-white",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    warn: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
    bad: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100",
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

function StatusRegistro({ registro, loading, onConfirmar }) {
  const flags = getStatusFlags(registro);

  if (flags.presente) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Presente
      </span>
    );
  }

  if (flags.aguardando) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
        Aguardando
      </span>
    );
  }

  if (flags.dentroJanelaConfirmacao) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
          Pendente
        </span>

        <button
          type="button"
          onClick={onConfirmar}
          disabled={loading}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-1.5 text-xs font-black text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Confirmar presença de ${registro?.nome || "participante"} em ${formatarDataBR(registro?.data_referencia)}`}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Confirmando...
            </>
          ) : (
            <>
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Confirmar
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-rose-200 px-2.5 py-1 text-xs font-black text-rose-900 dark:bg-rose-950/60 dark:text-rose-100">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Expirado
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Página
 * ───────────────────────────────────────────────────────────── */

export default function PresencasPorTurma() {
  const reduceMotion = useReducedMotion();

  const { turma_id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const turmaIdSeguro = useMemo(() => toPositiveInt(turma_id), [turma_id]);
  const turmaValida = Boolean(turmaIdSeguro);

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [busca, setBusca] = useState("");

  const liveRef = useRef(null);
  const inputBuscaRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

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

  const carregar = useCallback(async () => {
    if (!turmaValida) {
      setErro("turma_id ausente ou inválido.");
      setCarregando(false);
      setDados([]);
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
      setLive("Carregando presenças da turma.");

      const response = await api.presenca.turmaDetalhe(turmaIdSeguro, {
        signal: controller.signal,
      });

      const lista = normalizarLinhasPresenca(response);

      if (!mountedRef.current) return;

      setDados(lista);
      setLive(`Presenças carregadas. Total: ${lista.length}.`);
    } catch (error) {
      if (isAbortLike(error)) return;

      const message = getErrorMessage(
        error,
        "Erro ao carregar presenças da turma."
      );

      if (!mountedRef.current) return;

      setErro(message);
      setDados([]);
      notifyError(message);
      setLive("Falha ao carregar presenças.");
    } finally {
      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [setLive, turmaIdSeguro, turmaValida]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = normalizarTexto(busca);
    const qDigits = somenteDigitos(busca);

    if (!q && !qDigits) return dados;

    return dados.filter((registro) => {
      const nome = normalizarTexto(registro?.nome);
      const email = normalizarTexto(registro?.email);
      const cpf = somenteDigitos(registro?.cpf);

      return (
        nome.includes(q) ||
        email.includes(q) ||
        (qDigits && cpf.includes(qDigits))
      );
    });
  }, [busca, dados]);

  const stats = useMemo(() => {
    const agora = new Date();

    let presentes = 0;
    let aguardando = 0;
    let faltas = 0;

    for (const registro of filtrados) {
      const flags = getStatusFlags(registro, agora);

      if (flags.presente) {
        presentes += 1;
      } else if (flags.aguardando) {
        aguardando += 1;
      } else {
        faltas += 1;
      }
    }

    return {
      total: filtrados.length,
      presentes,
      aguardando,
      faltas,
    };
  }, [filtrados]);

  const confirmarPresencaManual = useCallback(
    async (registro) => {
      const usuario_id = toPositiveInt(registro?.usuario_id);
      const data_presenca = ymd(registro?.data_referencia);

      if (!usuario_id || !turmaIdSeguro || !data_presenca) {
        notifyError("Dados insuficientes para confirmar presença.");
        return;
      }

      const btnId = `${usuario_id}-${data_presenca}`;

      try {
        setConfirmandoId(btnId);
        setLive(`Confirmando presença de ${registro?.nome || "participante"}.`);

        await api.presenca.confirmarorganizador({
          usuario_id,
          turma_id: turmaIdSeguro,
          data_presenca,
        });

        setDados((prev) =>
          prev.map((item) => {
            if (
              toPositiveInt(item?.usuario_id) === usuario_id &&
              ymd(item?.data_referencia) === data_presenca
            ) {
              return {
                ...item,
                data_presenca,
                presente: true,
              };
            }

            return item;
          })
        );

        notifySuccess("Presença confirmada com sucesso.");
        setLive("Presença confirmada.");
      } catch (error) {
        notifyError(
          getErrorMessage(error, "Não foi possível confirmar presença.")
        );
        setLive("Falha ao confirmar presença.");
      } finally {
        setConfirmandoId(null);
      }
    },
    [setLive, turmaIdSeguro]
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
        onRefresh={carregar}
        carregando={carregando}
      />

      {carregando && (
        <div
          className="sticky top-0 z-40 h-1 w-full bg-amber-100 dark:bg-amber-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando presenças"
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
            onRefresh={carregar}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <MiniStat
              icon={Users}
              label="Total filtrado"
              value={stats.total}
              tone="neutral"
            />
            <MiniStat
              icon={UserCheck}
              label="Presentes"
              value={stats.presentes}
              tone="ok"
            />
            <MiniStat
              icon={Hourglass}
              label="Aguardando"
              value={stats.aguardando}
              tone="warn"
            />
            <MiniStat
              icon={UserX}
              label="Faltas"
              value={stats.faltas}
              tone="bad"
            />
          </div>

          <AnimatePresence mode="wait">
            {carregando ? (
              <motion.div key="loading" {...motionConfig}>
                <CarregandoSkeleton texto="Carregando presenças..." linhas={6} />
              </motion.div>
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
                    <ErroCarregamento mensagem={erro} />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={carregar}
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
                        Voltar
                      </button>
                    </div>
                  </div>
                </div>
              </motion.section>
            ) : !turmaValida ? (
              <motion.div key="invalid" {...motionConfig}>
                <NadaEncontrado
                  titulo="Turma inválida"
                  subtitulo="A rota deve informar o parâmetro oficial turma_id."
                />
              </motion.div>
            ) : filtrados.length > 0 ? (
              <motion.section
                key="content"
                {...motionConfig}
                aria-label={`Lista de presenças da turma ${turma_id || ""}`}
                className="space-y-3"
              >
                {filtrados.map((registro) => {
                  const btnId = `${registro.usuario_id}-${registro.data_referencia}`;
                  const loading = confirmandoId === btnId;

                  return (
                    <article
                      key={btnId}
                      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                      aria-label={`Registro de ${registro.nome}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="break-words text-base font-black tracking-tight text-slate-950 dark:text-white">
                            {registro.nome}
                          </h2>

                          <div className="mt-2 flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                            <p>CPF: {cpfProtegido(registro.cpf)}</p>
                            <p>
                              Data: {formatarDataBR(registro.data_referencia)}
                            </p>
                            {registro.email ? <p>E-mail: {registro.email}</p> : null}
                          </div>
                        </div>

                        <div className="shrink-0 sm:mt-1">
                          <StatusRegistro
                            registro={registro}
                            loading={loading}
                            onConfirmar={() => confirmarPresencaManual(registro)}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </motion.section>
            ) : (
              <motion.div key="empty" {...motionConfig}>
                <NadaEncontrado
                  titulo={
                    busca
                      ? "Nenhum registro corresponde à busca"
                      : "Nenhum registro encontrado"
                  }
                  subtitulo={
                    busca
                      ? "Tente outro termo ou limpe a busca."
                      : "Esta turma ainda não possui registros retornados pelo sistema."
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <Footer />
    </div>
  );
}