// ✅ src/components/presencas/ResumoPresencasSimples.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Resumo simples de presenças por turma.
//
// Contratos aplicados:
// - Sem apiGet direto;
// - Sem /api manual no frontend;
// - Sem /api/relatorio-presencas/turma/:id;
// - Usa api.presenca.turmaFrequencia(turma_id);
// - Mantém dataOverride para uso quando o componente receber dados externos;
// - Mantém autoRefreshMs com controle anti-overlap;
// - CarregandoSkeleton v2.0 em src/components/ui;
// - Date/data-safe, sem new Date("YYYY-MM-DD");
// - Mobile-first, dark mode, acessível e com aria-live.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
} from "lucide-react";

import { api } from "../../services/api";
import CarregandoSkeleton from "../ui/CarregandoSkeleton";

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return min;

  return Math.min(Math.max(number, min), max);
}

function toPositiveInt(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
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

function getErrorMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapData(response) {
  return response?.data !== undefined ? response.data : response;
}

function contarArrayPresencas(lista) {
  const arr = Array.isArray(lista) ? lista : [];

  return {
    total: arr.length,
    presentes: arr.filter((item) => item?.presente === true).length,
  };
}

function normalizarResumo(raw) {
  const data = unwrapData(raw);

  if (Array.isArray(data)) {
    return contarArrayPresencas(data);
  }

  if (!data || typeof data !== "object") {
    return {
      total: 0,
      presentes: 0,
    };
  }

  if (Array.isArray(data.presencas)) {
    return contarArrayPresencas(data.presencas);
  }

  if (Array.isArray(data.usuarios)) {
    let total = 0;
    let presentes = 0;

    for (const usuario of data.usuarios) {
      const presencas = Array.isArray(usuario?.presencas)
        ? usuario.presencas
        : [];

      for (const presenca of presencas) {
        total += 1;

        if (presenca?.presente === true) {
          presentes += 1;
        }
      }
    }

    return {
      total,
      presentes,
    };
  }

  const total =
    data.total ??
    data.total_inscritos ??
    data.inscritos ??
    data.quantidade_total ??
    data.resumo?.total ??
    0;

  const presentes =
    data.presentes ??
    data.total_presentes ??
    data.presencas_confirmadas ??
    data.quantidade_presentes ??
    data.resumo?.presentes ??
    0;

  return {
    total: Number(total || 0),
    presentes: Number(presentes || 0),
  };
}

function faixaPorPercentual(percentual, thresholdOk) {
  if (percentual >= thresholdOk) return "ok";

  if (percentual >= Math.max(1, Math.round(thresholdOk * 0.66))) {
    return "medio";
  }

  return "baixo";
}

/* ─────────────────────────────────────────────────────────────
 * Componente
 * ───────────────────────────────────────────────────────────── */

export default function ResumoPresencasSimples({
  turmaId,
  dataOverride,
  autoRefreshMs = 0,
  className = "",
  "data-testid": testId,
  thresholdOk = 75,
  label = "Presenças",
  showRefresh = true,
}) {
  const reduceMotion = useReducedMotion();

  const turma_id = useMemo(() => toPositiveInt(turmaId), [turmaId]);

  const [total, setTotal] = useState(0);
  const [presentes, setPresentes] = useState(0);
  const [carregando, setCarregando] = useState(!dataOverride);
  const [erro, setErro] = useState("");

  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      try {
        abortRef.current?.abort?.("unmount");
      } catch {
        // noop
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const aplicarDados = useCallback((raw) => {
    const resumo = normalizarResumo(raw);

    const totalSeguro = clamp(resumo.total, 0, Number.MAX_SAFE_INTEGER);
    const presentesSeguro = clamp(resumo.presentes, 0, totalSeguro);

    if (!mountedRef.current) return;

    setTotal(totalSeguro);
    setPresentes(presentesSeguro);
  }, []);

  const fetchDados = useCallback(async () => {
    if (!turma_id) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;

    try {
      abortRef.current?.abort?.("new-request");
    } catch {
      // noop
    }

    const controller = new AbortController();
    abortRef.current = controller;

    if (mountedRef.current) {
      setErro("");
      setCarregando(true);
    }

    try {
      const response = await api.presenca.turmaFrequencia(turma_id, {
        signal: controller.signal,
        on401: "silent",
        on403: "silent",
      });

      aplicarDados(response);
    } catch (error) {
      if (isAbortLike(error)) return;

      if (mountedRef.current) {
        setErro(
          getErrorMessage(error, "Não foi possível carregar as presenças.")
        );
        setTotal(0);
        setPresentes(0);
      }
    } finally {
      fetchingRef.current = false;

      if (mountedRef.current) {
        setCarregando(false);
      }
    }
  }, [aplicarDados, turma_id]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (dataOverride) {
      aplicarDados(dataOverride);

      if (mountedRef.current) {
        setCarregando(false);
        setErro("");
      }

      return undefined;
    }

    fetchDados();

    const intervalo = Number(autoRefreshMs);

    if (Number.isFinite(intervalo) && intervalo > 0) {
      const tick = () => {
        timerRef.current = window.setTimeout(async () => {
          await fetchDados();
          tick();
        }, Math.max(1000, intervalo));
      };

      tick();
    }

    return () => {
      try {
        abortRef.current?.abort?.("effect-cleanup");
      } catch {
        // noop
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [aplicarDados, autoRefreshMs, dataOverride, fetchDados]);

  const percentual = useMemo(() => {
    if (!total) return 0;

    return Math.round((presentes / total) * 100);
  }, [presentes, total]);

  const thresholdSeguro = useMemo(
    () => clamp(thresholdOk, 0, 100),
    [thresholdOk]
  );

  const faixa = useMemo(
    () => faixaPorPercentual(percentual, thresholdSeguro),
    [percentual, thresholdSeguro]
  );

  const barClass =
    faixa === "ok"
      ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700"
      : faixa === "medio"
        ? "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700"
        : "bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700";

  const chipClass =
    faixa === "ok"
      ? "bg-emerald-500/15 text-emerald-800 ring-emerald-700/20 dark:text-emerald-200"
      : faixa === "medio"
        ? "bg-amber-500/15 text-amber-900 ring-amber-700/20 dark:text-amber-200"
        : "bg-rose-500/15 text-rose-900 ring-rose-700/20 dark:text-rose-200";

  const chipLabel =
    faixa === "ok" ? "OK" : faixa === "medio" ? "Atenção" : "Baixo";

  if (carregando) {
    return (
      <div
        className={classNames("mt-3", className)}
        role="status"
        aria-busy="true"
        aria-live="polite"
        data-testid={testId}
      >
        <CarregandoSkeleton linhas={2} compacto texto="Carregando presenças..." />
      </div>
    );
  }

  if (erro) {
    return (
      <div className={classNames("mt-3", className)} data-testid={testId}>
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p aria-live="polite">{erro}</p>

            <button
              type="button"
              onClick={fetchDados}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-black text-rose-800 ring-1 ring-rose-800/10 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:bg-white/10 dark:text-rose-100 dark:ring-white/10 dark:hover:bg-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className={classNames("mt-3", className)} data-testid={testId}>
        <p
          className="text-sm italic text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          Nenhum inscrito nesta turma.
        </p>
      </div>
    );
  }

  if (presentes === 0) {
    return (
      <div className={classNames("mt-3", className)} data-testid={testId}>
        <p
          className="text-sm italic text-rose-700 dark:text-rose-300"
          aria-live="polite"
        >
          Nenhuma presença registrada ainda nesta turma.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className={classNames("mt-3", className)}
      aria-label="Resumo de presenças"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
      transition={reduceMotion ? undefined : { duration: 0.28 }}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
            <CheckCircle2
              className="h-4 w-4 text-emerald-600 dark:text-emerald-300"
              aria-hidden="true"
            />

            <span aria-live="polite">
              {label}: {presentes} de {total} ({percentual}%)
            </span>
          </p>

          <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            Meta recomendada: {thresholdSeguro}%
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={classNames(
              "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black ring-1",
              chipClass
            )}
            title={
              faixa === "ok"
                ? "Dentro do recomendado"
                : faixa === "medio"
                  ? "Atenção"
                  : "Baixo"
            }
          >
            {chipLabel}
          </span>

          {showRefresh && !dataOverride && (
            <button
              type="button"
              onClick={fetchDados}
              className="inline-flex items-center justify-center rounded-xl bg-slate-100 p-2 text-slate-800 ring-1 ring-black/5 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/15"
              title="Atualizar"
              aria-label="Atualizar resumo de presenças"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div
        className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner dark:bg-white/10"
        title={`${percentual}%`}
      >
        <div
          className="absolute bottom-0 top-0 w-[2px] bg-black/20 dark:bg-white/25"
          style={{ left: `${thresholdSeguro}%` }}
          aria-hidden="true"
        />

        <motion.div
          className={classNames("h-3 rounded-full", barClass)}
          style={{ width: `${percentual}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentual}
          aria-label="Progresso de presença"
          initial={reduceMotion ? false : { width: 0 }}
          animate={reduceMotion ? {} : { width: `${percentual}%` }}
          transition={reduceMotion ? undefined : { duration: 0.5 }}
        />

        <div className="absolute inset-0 flex items-center">
          <span className="ml-2 select-none text-[10px] text-white/90 drop-shadow-sm">
            {percentual}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * PropTypes
 * ───────────────────────────────────────────────────────────── */

ResumoPresencasSimples.propTypes = {
  turmaId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  dataOverride: PropTypes.oneOfType([
    PropTypes.shape({
      total: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      presentes: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
    PropTypes.array,
  ]),
  autoRefreshMs: PropTypes.number,
  className: PropTypes.string,
  "data-testid": PropTypes.string,
  thresholdOk: PropTypes.number,
  label: PropTypes.string,
  showRefresh: PropTypes.bool,
};