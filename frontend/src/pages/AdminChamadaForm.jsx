// 📁 src/pages/AdminChamadaForm.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página administrativa exclusiva de CHAMADAS DE TRABALHOS.
//
// Contratos oficiais:
// - GET    /api/chamada/admin
// - POST   /api/chamada/admin
// - GET    /api/chamada/:id
// - PUT    /api/chamada/admin/:id
// - PATCH  /api/chamada/admin/:id/publicacao
// - DELETE /api/chamada/admin/:id
// - GET    /api/chamada/admin/:id/modelo-banner/meta
// - GET    /api/chamada/admin/:id/modelo-banner/download
// - POST   /api/chamada/admin/:id/modelo-banner        campo multipart: arquivo
// - GET    /api/chamada/admin/:id/modelo-oral/meta
// - GET    /api/chamada/admin/:id/modelo-oral/download
// - POST   /api/chamada/admin/:id/modelo-oral          campo multipart: arquivo
//
// Diretrizes aplicadas:
// - contrato único;
// - sem rotas legadas plural/singular;
// - sem fieldName "file";
// - sem "admin/chamadas";
// - anti-fuso: datetime-local convertido para "YYYY-MM-DD HH:mm:ss";
// - UX/UI premium real;
// - mobile-first;
// - acessibilidade;
// - estados vazios úteis;
// - mensagens orientativas;
// - dark mode.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import * as apiSvc from "../services/api";

/* =========================================================================
   API local — centraliza contrato da página
=========================================================================== */

const apiGet = apiSvc.apiGet;
const apiPost = apiSvc.apiPost;
const apiPut = apiSvc.apiPut;
const apiDelete = apiSvc.apiDelete;
const apiUpload = apiSvc.apiUpload;
const apiGetFile = apiSvc.apiGetFile;
const downloadBlob = apiSvc.downloadBlob;

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  ""
);

function getToken() {
  return localStorage.getItem("token") || "";
}

async function apiPatchLocal(path, payload) {
  if (typeof apiSvc.apiPatch === "function") {
    return apiSvc.apiPatch(path, payload);
  }

  if (apiSvc.api?.request) {
    return apiSvc.api.request(path, {
      method: "PATCH",
      body: payload,
    });
  }

  const url = `${API_BASE_URL}/${String(path).replace(/^\/+/, "")}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: JSON.stringify(payload || {}),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err = new Error(json?.message || json?.erro || "Falha na requisição.");
    err.status = response.status;
    err.data = json;
    throw err;
  }

  return json;
}

function unwrap(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data;
  }

  return response ?? fallback;
}

function unwrapArray(response) {
  const data = unwrap(response, response);
  return Array.isArray(data) ? data : [];
}

const chamadaApi = {
  listarAdmin: async () => unwrapArray(await apiGet("chamada/admin")),

  obter: async (id) => unwrap(await apiGet(`chamada/${id}`), null),

  criar: async (payload) => unwrap(await apiPost("chamada/admin", payload), null),

  atualizar: async (id, payload) =>
    unwrap(await apiPut(`chamada/admin/${id}`, payload), null),

  publicar: async (id, publicado) =>
    unwrap(
      await apiPatchLocal(`chamada/admin/${id}/publicacao`, {
        publicado: Boolean(publicado),
      }),
      null
    ),

  remover: async (id) => apiDelete(`chamada/admin/${id}`),

  modeloBannerMeta: async (id) =>
    unwrap(await apiGet(`chamada/admin/${id}/modelo-banner/meta`), null),

  modeloOralMeta: async (id) =>
    unwrap(await apiGet(`chamada/admin/${id}/modelo-oral/meta`), null),

  importarModeloBanner: async (id, file) =>
    apiUpload(`chamada/admin/${id}/modelo-banner`, file, {
      fieldName: "arquivo",
    }),

  importarModeloOral: async (id, file) =>
    apiUpload(`chamada/admin/${id}/modelo-oral`, file, {
      fieldName: "arquivo",
    }),

  baixarModeloBanner: async (id) =>
    apiGetFile(`chamada/admin/${id}/modelo-banner/download`),

  baixarModeloOral: async (id) =>
    apiGetFile(`chamada/admin/${id}/modelo-oral/download`),
};

/* =========================================================================
   Helpers
=========================================================================== */

const LIMIT_MIN = 1;
const LIMIT_MAX = 5000;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function nowDatetimeLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

function wallToDatetimeLocal(value) {
  const text = String(value || "").trim();

  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?/.exec(text);
  if (match) return `${match[1]}T${match[2]}`;

  if (/[zZ]$|[+\-]\d{2}:\d{2}$/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);

      return parts.replace(" ", "T");
    }
  }

  return nowDatetimeLocal();
}

function datetimeLocalToWall(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    return "";
  }

  return `${text.replace("T", " ")}:00`;
}

function fmtPrazo(value) {
  const text = String(value || "").trim();
  if (!text) return "—";

  const wall = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text);
  if (wall) {
    return `${wall[3]}/${wall[2]}/${wall[1]} às ${wall[4]}:${wall[5]}`;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  return text;
}

function fmtYYYYMM(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) return "—";

  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

  return `${meses[Number(match[2]) - 1]}/${match[1]}`;
}

function toCodigo(value) {
  return (
    String(value || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "LINHA"
  );
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);

  return `${(n / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function clampLimit(value) {
  const n = Number(value);
  if (!Number.isInteger(n)) return LIMIT_MIN;
  return Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, n));
}

function parseYYYYMM(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
  return match ? { y: Number(match[1]), m: Number(match[2]) } : null;
}

function compareYYYYMM(a, b) {
  return String(a || "").localeCompare(String(b || ""));
}

function getMessage(error, fallback) {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

/* =========================================================================
   UI primitives
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950 dark:bg-slate-950">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute right-[-10%] top-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="min-h-screen bg-slate-50/95 dark:bg-slate-950/80 dark:text-slate-50">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

function Field({ label, hint, error, children, htmlFor, required = false }) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {label}
          {required ? <span className="text-rose-500">*</span> : null}
        </label>
      ) : null}

      {children}

      {hint ? <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function Button({
  children,
  tone = "slate",
  size = "md",
  className = "",
  loading = false,
  icon: Icon,
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-cyan-600 via-violet-600 to-emerald-600 text-white shadow-lg shadow-cyan-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    success:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    warning:
      "bg-amber-500 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-600",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        sizes[size],
        tones[tone],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function LiveRegion({ message, type = "polite" }) {
  if (!message) return null;
  return (
    <div aria-live={type} className="sr-only">
      {message}
    </div>
  );
}

function Counter({ value, max }) {
  const len = String(value || "").length;
  const over = max && len > max;

  return (
    <span className={cx("text-xs", over ? "text-rose-600" : "text-slate-400")}>
      {len}
      {max ? `/${max}` : ""}
    </span>
  );
}

/* =========================================================================
   Modal
=========================================================================== */

function Modal({ open, onClose, title, subtitle, children, footer, size = "max-w-6xl" }) {
  const dialogRef = useRef(null);
  const lastFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    lastFocusRef.current = document.activeElement;
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
      dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.();
    }, 0);

    return () => {
      document.body.style.overflow = "";
      lastFocusRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function onBackdrop(event) {
    if (event.target === event.currentTarget) onClose?.();
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onMouseDown={onBackdrop}
        >
          <motion.div
            ref={dialogRef}
            className={cx(
              "flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950",
              size
            )}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(139,92,246,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,.22),transparent_35%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Gestão institucional v2.0
                  </div>
                  <h2 id="modal-title" className="text-xl font-black tracking-tight sm:text-2xl">
                    {title}
                  </h2>
                  {subtitle ? (
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/70">
                      {subtitle}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  data-autofocus
                  className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
              {children}
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              {footer}
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ConfirmDialog({ open, title, description, onCancel, onConfirm, busy }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={description}
      size="max-w-lg"
      footer={
        <>
          <Button tone="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button tone="danger" icon={Trash2} loading={busy} onClick={onConfirm}>
            Excluir
          </Button>
        </>
      }
    >
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm leading-relaxed text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
        Esta ação só deve ser usada para chamadas sem submissões vinculadas. Se houver histórico, o backend bloqueará a exclusão para preservar rastreabilidade institucional.
      </div>
    </Modal>
  );
}

/* =========================================================================
   Month picker
=========================================================================== */

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function MonthYearPicker({ value, onChange, min, max, label }) {
  const minParsed = parseYYYYMM(min);
  const maxParsed = parseYYYYMM(max);
  const current = parseYYYYMM(value) || {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
  };

  const yearStart = minParsed?.y ?? current.y - 6;
  const yearEnd = maxParsed?.y ?? current.y + 6;

  const years = [];
  for (let y = yearStart; y <= yearEnd; y += 1) years.push(y);

  const monthMin = minParsed && current.y === minParsed.y ? minParsed.m : 1;
  const monthMax = maxParsed && current.y === maxParsed.y ? maxParsed.m : 12;
  const months = [];
  for (let m = monthMin; m <= monthMax; m += 1) months.push(m);

  function emit(next) {
    let y = next.y;
    let m = next.m;

    if (minParsed && y * 100 + m < minParsed.y * 100 + minParsed.m) {
      y = minParsed.y;
      m = minParsed.m;
    }

    if (maxParsed && y * 100 + m > maxParsed.y * 100 + maxParsed.m) {
      y = maxParsed.y;
      m = maxParsed.m;
    }

    onChange?.(`${y}-${pad2(m)}`);
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label={label}>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
        value={current.y}
        onChange={(event) => emit({ y: Number(event.target.value), m: current.m })}
        aria-label={`${label} — ano`}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
        value={current.m}
        onChange={(event) => emit({ y: current.y, m: Number(event.target.value) })}
        aria-label={`${label} — mês`}
      >
        {months.map((month) => (
          <option key={month} value={month}>
            {pad2(month)} — {MONTHS_PT[month - 1]}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =========================================================================
   Header
=========================================================================== */

function Hero({ counts, onNova }) {
  return (
    <header className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(34,211,238,.30),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,.28),transparent_30%),radial-gradient(circle_at_55%_90%,rgba(16,185,129,.25),transparent_28%)]" />
      <div className="relative mx-auto max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Chamadas de trabalhos — administração v2.0
            </div>

            <h1 className="max-w-4xl text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              Gestão premium de chamadas, critérios e modelos institucionais.
            </h1>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/72 sm:text-base">
              Crie chamadas, controle prazos, linhas temáticas, limites de submissão,
              critérios de avaliação escrita e oral, publicação e modelos oficiais de banner/apresentação.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button tone="primary" icon={Plus} onClick={onNova} size="lg">
                Nova chamada
              </Button>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Sem rotas legadas. Sem compatibilidade paralela.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Chamadas" value={counts.total} icon={ClipboardList} />
            <Metric label="Abertas" value={counts.abertas} icon={Eye} tone="emerald" />
            <Metric label="Encerradas" value={counts.encerradas} icon={EyeOff} tone="amber" />
            <Metric label="Publicadas" value={counts.publicadas} icon={CheckCircle2} tone="cyan" />
          </div>
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value, icon: Icon, tone = "violet" }) {
  const tones = {
    violet: "from-violet-400/25 to-white/5",
    emerald: "from-emerald-400/25 to-white/5",
    amber: "from-amber-400/25 to-white/5",
    cyan: "from-cyan-400/25 to-white/5",
  };

  return (
    <div className={cx("rounded-3xl border border-white/15 bg-gradient-to-br p-4 backdrop-blur", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/65">
          {label}
        </span>
        <Icon className="h-4 w-4 text-white/70" />
      </div>
      <div className="mt-2 text-3xl font-black">{value ?? "—"}</div>
    </div>
  );
}

/* =========================================================================
   Cards/listagem
=========================================================================== */

function statusChamada(chamada) {
  if (chamada.dentro_prazo === false) {
    return { label: "Encerrada", tone: "rose", icon: EyeOff };
  }

  if (chamada.publicado) {
    return { label: "Aberta", tone: "emerald", icon: Eye };
  }

  return { label: "Rascunho", tone: "slate", icon: XCircle };
}

function ChamadaCard({ chamada, onEditar, onPublicar, onExcluir, busy }) {
  const status = statusChamada(chamada);

  return (
    <motion.article
      layout
      className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/20"
    >
      <div
        className={cx(
          "h-1.5 bg-gradient-to-r",
          chamada.dentro_prazo === false
            ? "from-rose-500 via-orange-400 to-amber-400"
            : chamada.publicado
              ? "from-emerald-500 via-cyan-400 to-sky-500"
              : "from-slate-400 via-violet-400 to-cyan-400"
        )}
      />

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} icon={status.icon}>
                {status.label}
              </Badge>
              <Badge tone={chamada.publicado ? "emerald" : "slate"} icon={chamada.publicado ? CheckCircle2 : XCircle}>
                {chamada.publicado ? "Publicada" : "Não publicada"}
              </Badge>
            </div>

            <h3 className="line-clamp-2 text-lg font-black text-slate-900 dark:text-white">
              {chamada.titulo || "Chamada sem título"}
            </h3>

            <div className="mt-3 grid gap-2 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-3">
              <InfoPill icon={CalendarClock} label="Prazo" value={fmtPrazo(chamada.prazo_final_br)} />
              <InfoPill
                icon={Archive}
                label="Experiência"
                value={`${fmtYYYYMM(chamada.periodo_experiencia_inicio)} — ${fmtYYYYMM(
                  chamada.periodo_experiencia_fim
                )}`}
              />
              <InfoPill icon={Users} label="Coautores" value={`${chamada.max_coautores ?? 0}`} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button tone="slate" size="sm" icon={Pencil} onClick={() => onEditar(chamada.id)}>
              Editar
            </Button>

            <Button
              tone={chamada.publicado ? "warning" : "success"}
              size="sm"
              icon={chamada.publicado ? EyeOff : Eye}
              loading={busy}
              onClick={() => onPublicar(chamada.id, !chamada.publicado)}
            >
              {chamada.publicado ? "Despublicar" : "Publicar"}
            </Button>

            <Button tone="danger" size="sm" icon={Trash2} loading={busy} onClick={() => onExcluir(chamada.id)}>
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function InfoPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
        {value || "—"}
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-40 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="h-1.5 rounded-t-[1.75rem] bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
              <div className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   Painel principal
=========================================================================== */

function ChamadasPainel({ onNova, onEditar, refreshSignal, onCountsChange }) {
  const reduceMotion = useReducedMotion();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ativas");
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const carregar = useCallback(async () => {
    setErro("");
    setLoading(true);

    try {
      const rows = await chamadaApi.listarAdmin();
      setLista(rows);
    } catch (error) {
      setErro(
        getMessage(
          error,
          "Não foi possível carregar as chamadas. Verifique sua conexão ou tente novamente."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, refreshSignal]);

  const counts = useMemo(() => {
    const total = lista.length;
    const abertas = lista.filter((item) => item.dentro_prazo === true).length;
    const encerradas = lista.filter((item) => item.dentro_prazo === false).length;
    const publicadas = lista.filter((item) => item.publicado === true).length;

    return { total, abertas, encerradas, publicadas };
  }, [lista]);

  useEffect(() => {
    onCountsChange?.(counts);
  }, [counts, onCountsChange]);

  const filtradas = useMemo(() => {
    const term = busca.trim().toLowerCase();

    return lista.filter((item) => {
      const matchesBusca =
        !term ||
        String(item.titulo || "").toLowerCase().includes(term) ||
        String(item.descricao_markdown || "").toLowerCase().includes(term);

      const matchesFiltro =
        filtro === "todas"
          ? true
          : filtro === "publicadas"
            ? item.publicado === true
            : filtro === "rascunho"
              ? item.publicado !== true
              : filtro === "encerradas"
                ? item.dentro_prazo === false
                : item.dentro_prazo === true;

      return matchesBusca && matchesFiltro;
    });
  }, [lista, busca, filtro]);

  async function alterarPublicacao(id, publicado) {
    setBusyId(id);
    setErro("");

    try {
      const atualizado = await chamadaApi.publicar(id, publicado);

      setLista((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(atualizado || {}),
                publicado: Boolean(publicado),
              }
            : item
        )
      );
    } catch (error) {
      setErro(
        getMessage(
          error,
          publicado
            ? "Não foi possível publicar a chamada. Confira se há linha temática e critério escrito cadastrados."
            : "Não foi possível despublicar a chamada."
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function excluirConfirmado() {
    const id = confirmId;
    if (!id) return;

    setBusyId(id);
    setErro("");

    try {
      await chamadaApi.remover(id);
      setLista((items) => items.filter((item) => item.id !== id));
      setConfirmId(null);
    } catch (error) {
      setErro(
        getMessage(
          error,
          "Não foi possível excluir a chamada. Se houver submissões vinculadas, a exclusão é bloqueada para preservar o histórico."
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <GlassCard className="p-4 sm:p-5">
          {loading ? (
            <div className="mb-4 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cx(
                  "h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500",
                  reduceMotion ? "" : "animate-pulse"
                )}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-white">
                <Layers3 className="h-5 w-5 text-cyan-600" />
                Chamadas cadastradas
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Filtre, publique e edite chamadas com contrato único da v2.0.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button tone="slate" icon={RefreshCw} onClick={carregar} loading={loading}>
                Recarregar
              </Button>
              <Button tone="primary" icon={Plus} onClick={onNova}>
                Nova chamada
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950"
                placeholder="Buscar por título ou descrição..."
              />
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
              {[
                ["ativas", "Ativas"],
                ["publicadas", "Publicadas"],
                ["rascunho", "Rascunhos"],
                ["encerradas", "Encerradas"],
                ["todas", "Todas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltro(key)}
                  className={cx(
                    "rounded-xl px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-500",
                    filtro === key
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-900"
                  )}
                  aria-pressed={filtro === key}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <LiveRegion message={erro} type="assertive" />
          {erro ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <p>{erro}</p>
              </div>
            </div>
          ) : null}
        </GlassCard>

        {loading ? (
          <SkeletonList />
        ) : filtradas.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800">
              <Filter className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
              Nenhuma chamada encontrada
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
              Ajuste os filtros ou crie uma nova chamada institucional para iniciar o fluxo de submissão.
            </p>
            <div className="mt-5">
              <Button tone="primary" icon={Plus} onClick={onNova}>
                Criar chamada
              </Button>
            </div>
          </GlassCard>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence initial={false}>
              {filtradas.map((chamada) => (
                <ChamadaCard
                  key={chamada.id}
                  chamada={chamada}
                  busy={busyId === chamada.id}
                  onEditar={onEditar}
                  onPublicar={alterarPublicacao}
                  onExcluir={setConfirmId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <GlassCard className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white">Contrato v2.0</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chamada, trabalho e submissão agora são módulos separados.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <ChecklistItem ok>Esta tela usa apenas `/api/chamada`.</ChecklistItem>
            <ChecklistItem ok>Modelos usam campo multipart `arquivo`.</ChecklistItem>
            <ChecklistItem ok>Publicação usa endpoint de publicação.</ChecklistItem>
            <ChecklistItem ok>Submissões e avaliações ficam fora desta página.</ChecklistItem>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
            <FileText className="h-5 w-5 text-violet-500" />
            Antes de publicar
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            A chamada precisa ter, no mínimo, uma linha temática e um critério de avaliação escrita.
            O backend v2.0 bloqueia publicação incompleta.
          </p>
        </GlassCard>
      </aside>

      <ConfirmDialog
        open={confirmId != null}
        title="Excluir chamada?"
        description="A exclusão física só é permitida quando não há submissões vinculadas."
        busy={busyId === confirmId}
        onCancel={() => setConfirmId(null)}
        onConfirm={excluirConfirmado}
      />
    </div>
  );
}

function ChecklistItem({ children, ok = false }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-500" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
      )}
      <span>{children}</span>
    </div>
  );
}

/* =========================================================================
   Formulário modal
=========================================================================== */

const DEFAULT_FORM = {
  titulo: "",
  descricao_markdown: "",
  periodo_experiencia_inicio: "2026-01",
  periodo_experiencia_fim: "2026-12",
  prazo_final_br: nowDatetimeLocal(),
  aceita_poster: true,
  link_modelo_poster: "",
  max_coautores: 10,
  publicado: false,
  linhas: [],
  criterios: [],
  criterios_orais: [],
  limites: {
    titulo: 100,
    introducao: 2000,
    objetivos: 1000,
    metodo: 1500,
    resultados: 1500,
    consideracao: 1000,
  },
  criterios_outros: "",
  oral_outros: "",
  premiacao_texto: "",
  disposicao_finais_texto: "",
};

function ChamadaModal({ open, onClose, chamadaId, onSaved }) {
  const isEdit = Boolean(chamadaId);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [bannerMeta, setBannerMeta] = useState(null);
  const [oralMeta, setOralMeta] = useState(null);
  const [modeloBusy, setModeloBusy] = useState("");
  const [modeloMsg, setModeloMsg] = useState("");

  const inputBase =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900";

  const textAreaBase =
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900";

  const setValue = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const setLimit = useCallback((key, value) => {
    setForm((current) => ({
      ...current,
      limites: {
        ...current.limites,
        [key]: clampLimit(value),
      },
    }));
  }, []);

  async function carregarMetaModelos(id) {
    const [banner, oral] = await Promise.allSettled([
      chamadaApi.modeloBannerMeta(id),
      chamadaApi.modeloOralMeta(id),
    ]);

    setBannerMeta(banner.status === "fulfilled" ? banner.value : null);
    setOralMeta(oral.status === "fulfilled" ? oral.value : null);
  }

  const carregar = useCallback(async () => {
    if (!open) return;

    setErro("");
    setSucesso("");
    setModeloMsg("");
    setBannerMeta(null);
    setOralMeta(null);

    if (!isEdit) {
      setForm({
        ...DEFAULT_FORM,
        prazo_final_br: nowDatetimeLocal(),
      });
      return;
    }

    setLoading(true);

    try {
      const response = await chamadaApi.obter(chamadaId);
      const chamada = response?.chamada || response || {};

      setForm({
        titulo: chamada.titulo || "",
        descricao_markdown: chamada.descricao_markdown || "",
        periodo_experiencia_inicio:
          chamada.periodo_experiencia_inicio || DEFAULT_FORM.periodo_experiencia_inicio,
        periodo_experiencia_fim:
          chamada.periodo_experiencia_fim || DEFAULT_FORM.periodo_experiencia_fim,
        prazo_final_br: wallToDatetimeLocal(chamada.prazo_final_br),
        aceita_poster: Boolean(chamada.aceita_poster),
        link_modelo_poster: chamada.link_modelo_poster || "",
        max_coautores: Number(chamada.max_coautores || 10),
        publicado: Boolean(chamada.publicado),
        linhas: Array.isArray(response?.linhas)
          ? response.linhas.map((item) => ({
              nome: item.nome || "",
              descricao: item.descricao || "",
            }))
          : [],
        criterios: Array.isArray(response?.criterios) ? response.criterios : [],
        criterios_orais: Array.isArray(response?.criterios_orais)
          ? response.criterios_orais
          : [],
        limites: {
          titulo: Number(response?.limites?.titulo ?? 100),
          introducao: Number(response?.limites?.introducao ?? 2000),
          objetivos: Number(response?.limites?.objetivos ?? 1000),
          metodo: Number(response?.limites?.metodo ?? 1500),
          resultados: Number(response?.limites?.resultados ?? 1500),
          consideracao: Number(response?.limites?.consideracao ?? 1000),
        },
        criterios_outros: response?.criterios_outros || "",
        oral_outros: response?.oral_outros || "",
        premiacao_texto: response?.premiacao_texto || "",
        disposicao_finais_texto: response?.disposicao_finais_texto || "",
      });

      await carregarMetaModelos(chamadaId);
    } catch (error) {
      setErro(getMessage(error, "Falha ao carregar a chamada para edição."));
    } finally {
      setLoading(false);
    }
  }, [open, isEdit, chamadaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function validar() {
    if (!form.titulo.trim()) return "Informe o título da chamada.";
    if (!form.descricao_markdown.trim()) return "Informe a descrição/normas da chamada.";
    if (!parseYYYYMM(form.periodo_experiencia_inicio)) return "Período inicial inválido.";
    if (!parseYYYYMM(form.periodo_experiencia_fim)) return "Período final inválido.";

    if (compareYYYYMM(form.periodo_experiencia_inicio, form.periodo_experiencia_fim) > 0) {
      return "O período inicial não pode ser maior que o período final.";
    }

    if (!datetimeLocalToWall(form.prazo_final_br)) {
      return "Informe o prazo final corretamente.";
    }

    if (!Array.isArray(form.linhas) || form.linhas.filter((l) => l.nome?.trim()).length === 0) {
      return "Inclua pelo menos uma linha temática.";
    }

    if (!Array.isArray(form.criterios) || form.criterios.filter((c) => c.titulo?.trim()).length === 0) {
      return "Inclua pelo menos um critério de avaliação escrita.";
    }

    return "";
  }

  function payload() {
    return {
      titulo: form.titulo.trim(),
      descricao_markdown: form.descricao_markdown.trim(),
      periodo_experiencia_inicio: form.periodo_experiencia_inicio,
      periodo_experiencia_fim: form.periodo_experiencia_fim,
      prazo_final_br: datetimeLocalToWall(form.prazo_final_br),
      aceita_poster: Boolean(form.aceita_poster),
      link_modelo_poster: form.link_modelo_poster?.trim() || null,
      max_coautores: Number(form.max_coautores || 0),
      publicado: Boolean(form.publicado),
      linhas: form.linhas
        .filter((linha) => linha.nome?.trim())
        .map((linha) => ({
          codigo: toCodigo(linha.nome),
          nome: linha.nome.trim(),
          descricao: linha.descricao?.trim() || null,
        })),
      criterios: form.criterios
        .filter((criterio) => criterio.titulo?.trim())
        .map((criterio, index) => ({
          ordem: index + 1,
          titulo: criterio.titulo.trim(),
          escala_min: Number(criterio.escala_min || 1),
          escala_max: Number(criterio.escala_max || 5),
          peso: Number(criterio.peso || 1),
        })),
      criterios_orais: form.criterios_orais
        .filter((criterio) => criterio.titulo?.trim())
        .map((criterio, index) => ({
          ordem: index + 1,
          titulo: criterio.titulo.trim(),
          escala_min: Number(criterio.escala_min || 1),
          escala_max: Number(criterio.escala_max || 3),
          peso: Number(criterio.peso || 1),
        })),
      limites: {
        titulo: clampLimit(form.limites.titulo),
        introducao: clampLimit(form.limites.introducao),
        objetivos: clampLimit(form.limites.objetivos),
        metodo: clampLimit(form.limites.metodo),
        resultados: clampLimit(form.limites.resultados),
        consideracao: clampLimit(form.limites.consideracao),
      },
      criterios_outros: form.criterios_outros?.trim() || null,
      oral_outros: form.oral_outros?.trim() || null,
      premiacao_texto: form.premiacao_texto?.trim() || null,
      disposicao_finais_texto: form.disposicao_finais_texto?.trim() || null,
    };
  }

  async function salvar() {
    setErro("");
    setSucesso("");

    const invalid = validar();
    if (invalid) {
      setErro(invalid);
      return;
    }

    setSaving(true);

    try {
      const data = isEdit
        ? await chamadaApi.atualizar(chamadaId, payload())
        : await chamadaApi.criar(payload());

      const savedId = data?.id || chamadaId;

      setSucesso(isEdit ? "Chamada atualizada com sucesso." : "Chamada criada com sucesso.");
      onSaved?.(savedId);

      if (savedId) {
        await carregarMetaModelos(savedId);
      }

      if (isEdit) {
        onClose?.();
      }
    } catch (error) {
      setErro(
        getMessage(
          error,
          "Não foi possível salvar a chamada. Revise os campos e tente novamente."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function importarModelo(tipo, file) {
    if (!file) return;

    setErro("");
    setModeloMsg("");

    if (!isEdit) {
      setErro("Salve a chamada antes de importar modelos oficiais.");
      return;
    }

    if (!/\.pptx?$/i.test(file.name)) {
      setErro("Envie um arquivo .ppt ou .pptx.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErro("O modelo excede 50MB.");
      return;
    }

    setModeloBusy(tipo);

    try {
      if (tipo === "banner") {
        await chamadaApi.importarModeloBanner(chamadaId, file);
      } else {
        await chamadaApi.importarModeloOral(chamadaId, file);
      }

      await carregarMetaModelos(chamadaId);
      setModeloMsg(tipo === "banner" ? "Modelo de banner importado." : "Modelo oral importado.");
    } catch (error) {
      setErro(
        getMessage(
          error,
          tipo === "banner"
            ? "Não foi possível importar o modelo de banner."
            : "Não foi possível importar o modelo oral."
        )
      );
    } finally {
      setModeloBusy("");
    }
  }

  async function baixarModelo(tipo) {
    setErro("");
    setModeloMsg("");

    try {
      const result =
        tipo === "banner"
          ? await chamadaApi.baixarModeloBanner(chamadaId)
          : await chamadaApi.baixarModeloOral(chamadaId);

      downloadBlob(
        result.filename ||
          (tipo === "banner"
            ? `modelo-banner-chamada-${chamadaId}.pptx`
            : `modelo-oral-chamada-${chamadaId}.pptx`),
        result.blob
      );

      setModeloMsg("Download iniciado.");
    } catch (error) {
      setErro(
        getMessage(
          error,
          tipo === "banner"
            ? "Não foi possível baixar o modelo de banner."
            : "Não foi possível baixar o modelo oral."
        )
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar chamada" : "Nova chamada"}
      subtitle="Defina normas, prazos, linhas temáticas, critérios e modelos oficiais de apresentação."
      footer={
        <>
          <div className="mr-auto min-w-0 text-sm">
            {erro ? <span className="font-medium text-rose-600">{erro}</span> : null}
            {!erro && sucesso ? <span className="font-medium text-emerald-600">{sucesso}</span> : null}
            {!erro && !sucesso && modeloMsg ? (
              <span className="font-medium text-cyan-600">{modeloMsg}</span>
            ) : null}
          </div>

          <Button tone="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button tone="primary" icon={Save} loading={saving} onClick={salvar}>
            {saving ? "Salvando..." : "Salvar chamada"}
          </Button>
        </>
      }
    >
      <LiveRegion message={erro || sucesso || modeloMsg} type={erro ? "assertive" : "polite"} />

      {loading ? (
        <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando dados da chamada...
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <FormSection title="Informações gerais" icon={Settings2}>
              <Field label={<span>Título <Counter value={form.titulo} max={200} /></span>} required>
                <input
                  className={cx(inputBase, "h-12 text-base font-semibold")}
                  value={form.titulo}
                  onChange={(event) => setValue("titulo", event.target.value)}
                  maxLength={200}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Período da experiência — início" required>
                  <MonthYearPicker
                    label="Período inicial"
                    value={form.periodo_experiencia_inicio}
                    max={form.periodo_experiencia_fim}
                    onChange={(value) => setValue("periodo_experiencia_inicio", value)}
                  />
                </Field>

                <Field label="Período da experiência — fim" required>
                  <MonthYearPicker
                    label="Período final"
                    value={form.periodo_experiencia_fim}
                    min={form.periodo_experiencia_inicio}
                    onChange={(value) => setValue("periodo_experiencia_fim", value)}
                  />
                </Field>
              </div>

              <Field
                label="Prazo final para submissão"
                hint="Horário de parede em Brasília. Será enviado como YYYY-MM-DD HH:mm:ss."
                required
              >
                <input
                  type="datetime-local"
                  className={inputBase}
                  value={form.prazo_final_br}
                  onChange={(event) => setValue("prazo_final_br", event.target.value)}
                />
              </Field>

              <Field label="Descrição / normas da chamada" required>
                <textarea
                  className={cx(textAreaBase, "min-h-[180px]")}
                  value={form.descricao_markdown}
                  onChange={(event) => setValue("descricao_markdown", event.target.value)}
                  placeholder="Descreva regras, público-alvo, formato de submissão, etapas e critérios gerais."
                />
              </Field>
            </FormSection>

            <FormSection title="Linhas temáticas" icon={Layers3}>
              <DynamicList
                items={form.linhas}
                addLabel="Adicionar linha"
                emptyText="Nenhuma linha temática cadastrada."
                onAdd={() => setValue("linhas", [...form.linhas, { nome: "", descricao: "" }])}
                onRemove={(index) =>
                  setValue(
                    "linhas",
                    form.linhas.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                render={(item, index) => (
                  <div className="grid gap-3">
                    <input
                      className={inputBase}
                      value={item.nome}
                      placeholder="Nome da linha temática"
                      onChange={(event) => {
                        const next = [...form.linhas];
                        next[index] = { ...next[index], nome: event.target.value };
                        setValue("linhas", next);
                      }}
                    />
                    <textarea
                      className={cx(textAreaBase, "min-h-[90px]")}
                      value={item.descricao || ""}
                      placeholder="Descrição da linha temática"
                      onChange={(event) => {
                        const next = [...form.linhas];
                        next[index] = { ...next[index], descricao: event.target.value };
                        setValue("linhas", next);
                      }}
                    />
                  </div>
                )}
              />
            </FormSection>

            <FormSection title="Limites do formulário de submissão" icon={ClipboardList}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["titulo", "Título"],
                  ["introducao", "Introdução"],
                  ["objetivos", "Objetivos"],
                  ["metodo", "Método/descrição"],
                  ["resultados", "Resultados"],
                  ["consideracao", "Considerações finais"],
                ].map(([key, label]) => (
                  <Field key={key} label={label} hint={`Entre ${LIMIT_MIN} e ${LIMIT_MAX} caracteres.`}>
                    <input
                      type="number"
                      min={LIMIT_MIN}
                      max={LIMIT_MAX}
                      className={inputBase}
                      value={form.limites[key]}
                      onChange={(event) => setLimit(key, event.target.value)}
                    />
                  </Field>
                ))}
              </div>
            </FormSection>

            <FormSection title="Critérios de avaliação escrita" icon={CheckCircle2}>
              <CriteriaEditor
                criterios={form.criterios}
                defaultMax={5}
                onChange={(value) => setValue("criterios", value)}
              />

              <Field label="Complementos da avaliação escrita">
                <textarea
                  className={cx(textAreaBase, "min-h-[110px]")}
                  value={form.criterios_outros}
                  onChange={(event) => setValue("criterios_outros", event.target.value)}
                />
              </Field>
            </FormSection>

            <FormSection title="Critérios da apresentação oral" icon={FileText}>
              <CriteriaEditor
                criterios={form.criterios_orais}
                defaultMax={3}
                onChange={(value) => setValue("criterios_orais", value)}
              />

              <Field label="Complementos da avaliação oral">
                <textarea
                  className={cx(textAreaBase, "min-h-[110px]")}
                  value={form.oral_outros}
                  onChange={(event) => setValue("oral_outros", event.target.value)}
                />
              </Field>
            </FormSection>

            <FormSection title="Premiação e disposições finais" icon={Sparkles}>
              <Field label="Texto da premiação">
                <textarea
                  className={cx(textAreaBase, "min-h-[110px]")}
                  value={form.premiacao_texto}
                  onChange={(event) => setValue("premiacao_texto", event.target.value)}
                />
              </Field>

              <Field label="Disposições finais">
                <textarea
                  className={cx(textAreaBase, "min-h-[110px]")}
                  value={form.disposicao_finais_texto}
                  onChange={(event) => setValue("disposicao_finais_texto", event.target.value)}
                />
              </Field>
            </FormSection>
          </div>

          <aside className="space-y-4">
            <GlassCard className="sticky top-4 p-5">
              <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                <Settings2 className="h-5 w-5 text-cyan-500" />
                Configurações rápidas
              </h3>

              <div className="mt-4 space-y-4">
                <Field label="Máximo de coautores">
                  <input
                    type="number"
                    min={0}
                    className={inputBase}
                    value={form.max_coautores}
                    onChange={(event) => setValue("max_coautores", event.target.value)}
                  />
                </Field>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
                  <span>Aceita envio de pôster</span>
                  <input
                    type="checkbox"
                    checked={form.aceita_poster}
                    onChange={(event) => setValue("aceita_poster", event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
                  <span>Publicar ao salvar</span>
                  <input
                    type="checkbox"
                    checked={form.publicado}
                    onChange={(event) => setValue("publicado", event.target.checked)}
                    className="h-5 w-5 rounded border-slate-300"
                  />
                </label>
              </div>
            </GlassCard>

            <ModeloBox
              title="Modelo de banner"
              description="Arquivo oficial usado como base para pôster da chamada."
              meta={bannerMeta}
              disabled={!isEdit}
              busy={modeloBusy === "banner"}
              onUpload={(file) => importarModelo("banner", file)}
              onDownload={() => baixarModelo("banner")}
            />

            <ModeloBox
              title="Modelo oral"
              description="Arquivo oficial usado para apresentações orais da chamada."
              meta={oralMeta}
              disabled={!isEdit}
              busy={modeloBusy === "oral"}
              onUpload={(file) => importarModelo("oral", file)}
              onDownload={() => baixarModelo("oral")}
            />
          </aside>
        </div>
      )}
    </Modal>
  );
}

function FormSection({ title, icon: Icon, children }) {
  return (
    <GlassCard className="p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </GlassCard>
  );
}

function DynamicList({ items, onAdd, onRemove, render, addLabel, emptyText }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button tone="primary" size="sm" icon={Plus} onClick={onAdd}>
          {addLabel}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                  Item {index + 1}
                </span>
                <Button tone="ghost" size="sm" icon={Trash2} onClick={() => onRemove(index)}>
                  Remover
                </Button>
              </div>
              {render(item, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CriteriaEditor({ criterios, defaultMax, onChange }) {
  function update(index, patch) {
    const next = [...criterios];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <DynamicList
      items={criterios}
      addLabel="Adicionar critério"
      emptyText="Nenhum critério cadastrado."
      onAdd={() =>
        onChange([
          ...criterios,
          {
            titulo: "",
            escala_min: 1,
            escala_max: defaultMax,
            peso: 1,
          },
        ])
      }
      onRemove={(index) => onChange(criterios.filter((_, itemIndex) => itemIndex !== index))}
      render={(criterio, index) => (
        <div className="grid gap-3 lg:grid-cols-[1fr_110px_110px_110px]">
          <Field label="Critério">
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
              value={criterio.titulo || ""}
              onChange={(event) => update(index, { titulo: event.target.value })}
              placeholder="Título do critério"
            />
          </Field>

          <Field label="Mín.">
            <input
              type="number"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
              value={criterio.escala_min ?? 1}
              onChange={(event) => update(index, { escala_min: Number(event.target.value) || 1 })}
            />
          </Field>

          <Field label="Máx.">
            <input
              type="number"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
              value={criterio.escala_max ?? defaultMax}
              onChange={(event) => update(index, { escala_max: Number(event.target.value) || defaultMax })}
            />
          </Field>

          <Field label="Peso">
            <input
              type="number"
              step="0.1"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900"
              value={criterio.peso ?? 1}
              onChange={(event) => update(index, { peso: Number(event.target.value) || 1 })}
            />
          </Field>
        </div>
      )}
    />
  );
}

function ModeloBox({ title, description, meta, disabled, busy, onUpload, onDownload }) {
  const inputRef = useRef(null);
  const exists = Boolean(meta?.exists);

  return (
    <GlassCard className="p-5">
      <h3 className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
        <Upload className="h-5 w-5 text-emerald-500" />
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {description}
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
        {disabled ? (
          <span>Salve a chamada antes de importar modelos.</span>
        ) : exists ? (
          <div className="space-y-1">
            <div className="font-bold text-emerald-600">Modelo disponível</div>
            <div>{meta.filename || "Arquivo sem nome"}</div>
            <div>{formatBytes(meta.size)}</div>
          </div>
        ) : (
          <span>Nenhum modelo importado.</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          event.target.value = "";
          onUpload(file);
        }}
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          tone="slate"
          icon={Upload}
          loading={busy}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Importar
        </Button>
        <Button tone="slate" icon={Download} disabled={disabled || !exists} onClick={onDownload}>
          Baixar
        </Button>
      </div>
    </GlassCard>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function AdminChamadaForm() {
  const params = useParams();
  const routeId = params?.chamadaId || null;

  const [counts, setCounts] = useState({
    total: "—",
    abertas: "—",
    encerradas: "—",
    publicadas: "—",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    if (routeId) {
      setEditingId(routeId);
      setModalOpen(true);
    }
  }, [routeId]);

  function abrirNova() {
    setEditingId(null);
    setModalOpen(true);
  }

  function abrirEdicao(id) {
    setEditingId(id);
    setModalOpen(true);
  }

  function handleSaved(savedId) {
    setRefreshSignal((current) => current + 1);
    if (savedId) setEditingId(savedId);
  }

  return (
    <PageShell>
      <Hero counts={counts} onNova={abrirNova} />

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <ChamadasPainel
          onNova={abrirNova}
          onEditar={abrirEdicao}
          refreshSignal={refreshSignal}
          onCountsChange={setCounts}
        />
      </main>

      <Footer />

      <ChamadaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        chamadaId={editingId}
        onSaved={handleSaved}
      />
    </PageShell>
  );
}