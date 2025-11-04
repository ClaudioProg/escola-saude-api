// 📁 src/pages/AdminChamadaForm.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Settings2, Save, Plus, Trash2, Pencil, Eye, EyeOff,
  CheckCircle2, XCircle, X, Loader2, FileText, AlertCircle, Upload, Download
} from "lucide-react";
import Footer from "../components/Footer";
import {
  datetimeLocalToBrWall, wallToDatetimeLocal, isIsoWithTz, isWallDateTime,
  isoToDatetimeLocalInZone, fmtWallDateTime, fmtDataHora
} from "../utils/data";
import {
  apiGet, apiPost, apiPut, apiDelete, apiUpload as apiUploadSvc,
  apiGetFile, downloadBlob
} from "../services/api";
import { useParams } from "react-router-dom";

/* ─── utils ─── */
const pad2 = (n) => String(n).padStart(2, "0");
const nowLocalDatetimeLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const toCodigo = (s) =>
  (s || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")
    .slice(0, 30) || "LINHA";

/** Formata bytes em KB/MB/GB legível */
const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
};

/* 🔢 Limites globais (UI) e compat backend */
const LIMIT_MIN = 1;
const LIMIT_MAX = 5000;
const BACKEND_MIN = 50;
const BACKEND_MAX = 20000;
const clampUi = (n) => Math.max(LIMIT_MIN, Math.min(LIMIT_MAX, Number(n) || LIMIT_MIN));
const enforceBackend = (n) => Math.max(BACKEND_MIN, Math.min(BACKEND_MAX, Number(n) || BACKEND_MIN));

/* ─── UI helpers ─── */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 ${className}`}>{children}</div>
);
const Field = ({ label, hint, error, children, htmlFor }) => (
  <div className="mb-4">
    {label && <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</label>}
    {children}
    {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    {error && <div role="alert" className="mt-1 text-xs text-red-600">{error}</div>}
  </div>
);
const Badge = ({ children, tone = "indigo" }) => {
  const tones = {
    indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
};
const Counter = ({ value, max }) => {
  const len = (value || "").length;
  const over = max ? len > max : false;
  return <span className={`text-xs ${over ? "text-red-600" : "text-zinc-500"}`}>{len}{max ? `/${max}` : ""}</span>;
};

/* Mini-stat card */
const StatCard = ({ label, value, icon, tone = "default" }) => {
  const tones = {
    default: "border-white/20",
    success: "border-emerald-400/50",
    warning: "border-amber-400/50",
    info: "border-cyan-400/50",
  };
  return (
    <div className={`rounded-2xl border ${tones[tone]} bg-white/10 px-3 py-3 text-left backdrop-blur-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/80">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-1 font-bold text-lg sm:text-2xl text-white">{value}</div>
    </div>
  );
};

/* ─── A11y: Live regions ─── */
function LiveRegion({ message, type = "polite" }) {
  if (!message) return null;
  return (
    <div aria-live={type} className="sr-only">
      {message}
    </div>
  );
}

/* ─── Confirm Dialog ─── */
function ConfirmDialog({ open, title = "Confirmar", description, onConfirm, onCancel }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button type="button" onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-white hover:bg-rose-700">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
          </button>
        </>
      }
    >
      <div className="text-sm text-zinc-700 dark:text-zinc-200">{description}</div>
    </Modal>
  );
}

/* ─── Modal ─── */
function Modal({ open, onClose, title, children, footer, size = "lg", labelledById, describedById }) {
  const dialogRef = useRef(null);
  const lastFocusRef = useRef(null);

  // Focus trap + restore + scroll lock
  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      setTimeout(() => dialogRef.current?.querySelector?.("[data-autofocus]")?.focus?.(), 0);
    } else {
      document.body.style.overflow = "";
      lastFocusRef.current?.focus?.();
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sizes = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl" };

  // Close on backdrop click (but not on content)
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          aria-modal="true" role="dialog"
          aria-labelledby={labelledById} aria-describedby={describedById}
          onMouseDown={onBackdrop}
        >
          <motion.div
            ref={dialogRef}
            initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            className={`relative w-full ${sizes[size]} overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900`}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-cyan-700 via-violet-700 to-emerald-700 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" aria-hidden="true" />
                <h3 id={labelledById} className="text-lg font-semibold">{title}</h3>
                <Badge tone="emerald">Admin</Badge>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/10" aria-label="Fechar" data-autofocus>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6">{children}</div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              {footer}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Header (gradiente exclusivo desta página) ─── */
function HeaderHero({ counts = { total: "—", abertas: "—", encerradas: "—", publicadas: "—" } }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
      className="w-full text-white"
    >
      <div className="bg-gradient-to-br from-cyan-900 via-violet-800 to-emerald-700">
        <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Título + ícone na MESMA LINHA */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-3">
              <Settings2 className="h-8 w-8 sm:h-9 sm:w-9" aria-hidden="true" />
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
                Submissão de Trabalhos — Administração
              </h1>
            </div>
            <p className="mt-0.5 text-sm opacity-90 sm:text-base">
              Gerencie chamadas: criar/editar, publicar/despublicar e excluir. Edição em modal com visual limpo e acessível.
            </p>

            {/* Mini-stats: aparecem SOMENTE no header */}
            <div className="grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 mt-2">
              <StatCard label="Chamadas"   value={counts.total}      icon={<FileText className="w-4 h-4" />} tone="info" />
              <StatCard label="Abertas"    value={counts.abertas}    icon={<Eye className="w-4 h-4" />} tone="success" />
              <StatCard label="Encerradas" value={counts.encerradas} icon={<EyeOff className="w-4 h-4" />} tone="warning" />
              <StatCard label="Publicadas" value={counts.publicadas} icon={<CheckCircle2 className="w-4 h-4" />} tone="success" />
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}


/* ─── Skeleton Item ─── */
function ChamadaSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border p-3 dark:border-zinc-800">
      <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400" />
      <div className="animate-pulse">
        <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}

/* ─── Painel ─── */
function ChamadasPainel({ onEditar, onNova, refreshSignal, onCountsChange }) {
  const reduceMotion = useReducedMotion();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [filtro, setFiltro] = useState("abertas");
  const [mutatingId, setMutatingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    setErr(""); setLoading(true);
    try {
      const rows = await apiGet("admin/chamadas");
      setLista(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar chamadas.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (refreshSignal !== undefined) load(); }, [refreshSignal, load]);

  // Contadores para mini-stats
  const counts = useMemo(() => {
    const total = lista.length;
    const abertas = lista.filter((c) => c.dentro_prazo === true).length;
    const encerradas = lista.filter((c) => c.dentro_prazo === false).length;
    const publicadas = lista.filter((c) => c.publicado === true).length;
    return { total, abertas, encerradas, publicadas };
  }, [lista]);

  // Avisa o topo quando os contadores mudarem
  useEffect(() => { onCountsChange?.(counts); }, [counts, onCountsChange]);

  const visiveis = useMemo(() => {
    if (filtro === "todas") return lista;
    if (filtro === "encerradas") return lista.filter((c) => c.dentro_prazo === false);
    return lista.filter((c) => c.dentro_prazo === true);
  }, [lista, filtro]);

  const publicar = async (id, valor) => {
    setMutatingId(id);
    try {
      await apiPut(`admin/chamadas/${id}/publicar`, { publicado: !!valor });
      setLista((xs) => xs.map((c) => (c.id === id ? { ...c, publicado: !!valor } : c)));
    } catch (e) {
      setErr(e?.message || "Erro ao alterar publicação.");
    } finally { setMutatingId(null); }
  };
  const excluir = async (id) => {
    setMutatingId(id);
    try {
      await apiDelete(`admin/chamadas/${id}`);
      setLista((xs) => xs.filter((c) => c.id !== id));
    } catch (e) {
      setErr(e?.message || "Erro ao excluir chamada.");
    } finally { setMutatingId(null); }
  };

  const renderPrazo = (valor) => {
    if (!valor) return "—";
    if (isWallDateTime(valor)) return fmtWallDateTime(valor);
    if (isIsoWithTz(valor)) return fmtDataHora(valor, "America/Sao_Paulo");
    return String(valor);
  };

  // cor da barrinha no topo do card
  const barColor = (c) => {
    if (c.dentro_prazo === false) return "from-rose-600 via-rose-500 to-rose-400";
    if (c.publicado) return "from-emerald-600 via-emerald-500 to-emerald-400";
    return "from-indigo-600 via-violet-500 to-cyan-500";
  };

  return (
    <Card>
      {/* barra fina global durante carregamento */}
      {loading && (
        <div
          className="sticky top-0 left-0 -mx-4 sm:-mx-6 mb-3 h-1 bg-indigo-100"
          role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Carregando chamadas"
        >
          <div className={`h-full bg-indigo-600 w-1/3 ${reduceMotion ? "" : "animate-pulse"}`} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Filtro como toggle group acessível */}
        <div role="group" aria-label="Filtro de chamadas" className="flex items-center gap-2">
          {["abertas", "encerradas", "todas"].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              aria-pressed={filtro === key}
              className={`rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500
                ${filtro === key ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"}`}
            >
              {key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={load}
            className="rounded-xl border px-3 py-1.5 text-sm hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-zinc-800">
            Recarregar
          </button>
          <button type="button" onClick={onNova}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nova chamada
          </button>
        </div>
      </div>

      {/* Live error */}
      <LiveRegion message={err} type="assertive" />
      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => <ChamadaSkeleton key={i} />)}
        </div>
      ) : visiveis.length === 0 ? (
        <div className="text-sm text-zinc-600">Nenhuma chamada no filtro atual.</div>
      ) : (
        <div className="grid gap-2">
          {visiveis.map((c) => (
            <div
              key={c.id}
              className="relative overflow-hidden rounded-xl border p-3 text-sm dark:border-zinc-800 md:flex md:items-center md:justify-between"
            >
              {/* 🔹 Barrinha no topo do card (status) */}
              <div className={`pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r ${barColor(c)}`} />

              <div className="min-w-0 pr-1">
                <div className="truncate font-medium">{c.titulo}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  {c.publicado ? (
                    <Badge tone="emerald"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />Publicado</Badge>
                  ) : (
                    <Badge tone="zinc"><XCircle className="mr-1 h-3 w-3" aria-hidden="true" />Rascunho</Badge>
                  )}
                  {c.dentro_prazo ? (
                    <Badge tone="indigo">Aberta</Badge>
                  ) : (
                    <Badge tone="rose">Encerrada</Badge>
                  )}
                  <span>Prazo: {renderPrazo(c.prazo_final_br)}</span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-zinc-800"
                  onClick={() => onEditar?.(c.id)} title="Editar" aria-label={`Editar chamada ${c.titulo}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
                </button>

                {c.publicado ? (
                  <button
                    type="button"
                    disabled={mutatingId === c.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1.5 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    onClick={() => publicar(c.id, false)} title="Despublicar" aria-label={`Despublicar chamada ${c.titulo}`}
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" /> Despublicar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={mutatingId === c.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={() => publicar(c.id, true)} title="Publicar" aria-label={`Publicar chamada ${c.titulo}`}
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" /> Publicar
                  </button>
                )}

                <button
                  type="button"
                  disabled={mutatingId === c.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  onClick={() => setConfirmId(c.id)} title="Excluir" aria-label={`Excluir chamada ${c.titulo}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmId != null}
        title="Excluir chamada"
        description="Confirma excluir esta chamada? Esta ação não pode ser desfeita."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { const id = confirmId; setConfirmId(null); excluir(id); }}
      />
    </Card>
  );
}

/* ───────── Month/Year Picker ───────── */
const MONTHS_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function parseYYYYMM(s) {
  const m = String(s || "").match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return m ? { y: +m[1], m: +m[2] } : null;
}
function clampYearMonth(v, min, max) {
  if (!v) return null;
  const n = v.y * 100 + v.m;
  const nMin = min ? min.y * 100 + min.m : null;
  const nMax = max ? max.y * 100 + max.m : null;
  if (nMin !== null && n < nMin) return min;
  if (nMax !== null && n > nMax) return max;
  return v;
}
function MonthYearPicker({
  value, onChange, min, max, className = "", selectClass = "",
  ariaLabelAno = "Ano", ariaLabelMes = "Mês", yearPad = 7,
}) {
  const minP = parseYYYYMM(min);
  const maxP = parseYYYYMM(max);
  const now = new Date();
  const cur = parseYYYYMM(value) || minP || { y: now.getFullYear(), m: now.getMonth() + 1 };

  const yearStart = minP ? minP.y : cur.y - yearPad;
  const yearEnd   = maxP ? maxP.y : cur.y + yearPad;
  const years = []; for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  const months = [];
  const minMonth = (minP && cur.y === minP.y) ? minP.m : 1;
  const maxMonth = (maxP && cur.y === maxP.y) ? maxP.m : 12;
  for (let m = minMonth; m <= maxMonth; m++) months.push(m);

  const baseSel = selectClass || "w-full rounded-xl border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800";

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`} role="group" aria-label="Seletor de mês e ano">
      <select
        className={baseSel}
        aria-label={ariaLabelAno}
        value={cur.y}
        onChange={(e) => {
          const next = clampYearMonth({ y: +e.target.value, m: cur.m }, minP, maxP);
          onChange?.(`${next.y}-${String(next.m).padStart(2,"0")}`);
        }}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        className={baseSel}
        aria-label={ariaLabelMes}
        value={cur.m}
        onChange={(e) => {
          const next = clampYearMonth({ y: cur.y, m: +e.target.value }, minP, maxP);
          onChange?.(`${next.y}-${String(next.m).padStart(2,"0")}`);
        }}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2,"0")} — {MONTHS_PT[m-1]}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Modal Criar/Editar ─── */
function AddEditChamadaModal({ open, onClose, chamadaId, onSaved }) {
  const isEdit = !!chamadaId;
  const [form, setForm] = useState({
    titulo: "",
    descricao_markdown: "",
    periodo_experiencia_inicio: "2023-01",
    periodo_experiencia_fim: "2025-07",
    prazo_final_br: nowLocalDatetimeLocal(),
    aceita_poster: true,
    link_modelo_poster: "",
    max_coautores: 10,
    publicado: false,
    linhas: [],
    criterios: [],
    criterios_orais: [],
    limites: { titulo: 100, introducao: 2000, objetivos: 1000, metodo: 1500, resultados: 1500, consideracoes: 1000 },
    criterios_outros: "",
    oral_outros: "",
    premiacao_texto: "",
    disposicoes_finais_texto: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [infoOk, setInfoOk] = useState("");
  const abortRef = useRef(null);

// modelo de banner (POR CHAMADA)
const [modeloMeta, setModeloMeta] = useState(null);
const [modeloBusy, setModeloBusy] = useState(false);
const [modeloErr, setModeloErr] = useState("");
const [modeloOk, setModeloOk] = useState("");
const [modeloDownloading, setModeloDownloading] = useState(false);
const hadUploadCorsRef = useRef(false); // marca se houve CORS/401/403 no upload

// 🔶 modelo de slides (apresentação oral) — (novo)
const [oralMeta, setOralMeta] = useState(null);
const [oralBusy, setOralBusy] = useState(false);
const [oralErr, setOralErr] = useState("");
const [oralOk, setOralOk] = useState("");
const hadUploadCorsOralRef = useRef(false);

  const inputBase =
    "w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800";

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const updateLim = (k, v) => setForm((f) => ({ ...f, limites: { ...f.limites, [k]: Number(v) || 0 } }));

  const validar = () => {
    const { periodo_experiencia_inicio: ini, periodo_experiencia_fim: fim, limites } = form;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ini) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(fim)) return "Períodos devem estar no formato AAAA-MM.";
    if (ini > fim) return "Período inicial não pode ser maior que o final.";
    for (const [k, v] of Object.entries(limites)) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < LIMIT_MIN || n > LIMIT_MAX) return `Limite inválido para ${k}: ${LIMIT_MIN} a ${LIMIT_MAX}.`;
    }
    return "";
  };

// 📤 importar modelo de slides (apresentação oral) — (novo)
const onImportModeloOral = async (file) => {
  if (!file) return;
  setOralErr(""); setOralOk(""); setInfoOk(""); setOralBusy(true);
  try {
    if (!isEdit) throw new Error("Salve a chamada para habilitar o upload do modelo.");
    if (!/\.(pptx?|PPTX?)$/.test(file.name)) throw new Error("Envie arquivo .ppt ou .pptx");
    if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo muito grande (máx 50MB).");

    const tryOnce = async () => {
      await apiUploadSvc(`chamadas/${chamadaId}/modelo-oral`, file, { fieldName: "file" });
      const meta = await apiGet(`admin/chamadas/${chamadaId}/modelo-oral`);
      setOralMeta(meta || null);
    };

    const attempts = [0, 400, 1000];
    let lastErr = null;
    hadUploadCorsOralRef.current = false;

    for (let i = 0; i < attempts.length; i++) {
      try {
        if (i > 0) setInfoOk(`Conexão instável, tentando novamente (${i + 1}/${attempts.length})…`);
        await tryOnce();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        const msg = String(e?.message || "");
        const status = e?.status || e?.response?.status;
        if (status === 401 || status === 403 || /Failed to fetch|CORS/i.test(msg)) {
          hadUploadCorsOralRef.current = true;
          try { await apiGet("perfil/me"); } catch {}
          await sleep(attempts[i]);
          continue;
        }
        break;
      }
    }
    if (lastErr) throw lastErr;

    setOralOk("Modelo de slides (oral) importado com sucesso.");
    setInfoOk("");
  } catch (e) {
    setOralErr(e?.message || "Falha ao importar o modelo de slides (oral).");
  } finally {
    setOralBusy(false);
  }
};

// 📥 baixar modelo de slides (oral)
const handleDownloadOral = useCallback(async () => {
  try {
    const { blob, filename } = await apiGetFile(`admin/chamadas/${chamadaId}/modelo-oral/download`);
    downloadBlob(filename || `modelo-oral-chamada-${chamadaId}.pptx`, blob);
    setOralOk("Download iniciado.");
  } catch (e) {
    console.error("Erro ao baixar modelo oral:", e);
    setOralErr(e?.message || "Falha ao baixar o modelo de slides (oral).");
  }
}, [chamadaId]);

 // carrega para edição + meta do modelo da CHAMADA
  useEffect(() => {
    if (!open) return;
    setErr(""); setInfoOk(""); setModeloErr(""); setModeloOk("");
    if (!isEdit) { /* limpa form ... */ setModeloMeta(null); setOralMeta(null); } // (ajuste)
  
    (async () => {
      try {
        if (isEdit) {
          setLoading(true);
          abortRef.current?.abort?.();
          abortRef.current = new AbortController();
          const r = await apiGet(`chamadas/${chamadaId}`, { signal: abortRef.current.signal });
          const c = r?.chamada || {};
          const prazoInput =
            wallToDatetimeLocal(c.prazo_final_br || "") ||
            (isIsoWithTz(c.prazo_final_br) ? isoToDatetimeLocalInZone(c.prazo_final_br, "America/Sao_Paulo") : "") ||
            nowLocalDatetimeLocal();
          setForm({
            titulo: c.titulo || "",
            descricao_markdown: c.descricao_markdown || "",
            periodo_experiencia_inicio: c.periodo_experiencia_inicio || "2023-01",
            periodo_experiencia_fim: c.periodo_experiencia_fim || "2025-07",
            prazo_final_br: prazoInput,
            aceita_poster: !!c.aceita_poster,
            link_modelo_poster: c.link_modelo_poster || "",
            max_coautores: Number(c.max_coautores) || 10,
            publicado: !!c.publicado,
            linhas: (r?.linhas || []).map((l) => ({ nome: l.nome || "", descricao: l.descricao || "" })),
            criterios: r?.criterios || [],
            criterios_orais: r?.criterios_orais || [],
            limites: {
              titulo: Number(r?.limites?.titulo ?? 100),
              introducao: Number(r?.limites?.introducao ?? 2000),
              objetivos: Number(r?.limites?.objetivos ?? 1000),
              metodo: Number(r?.limites?.metodo ?? 1500),
              resultados: Number(r?.limites?.resultados ?? 1500),
              consideracoes: Number(r?.limites?.consideracoes ?? 1000),
            },
            criterios_outros: r?.criterios_outros || "",
            oral_outros: r?.oral_outros || "",
            premiacao_texto: r?.premiacao_texto || "",
            disposicoes_finais_texto: r?.disposicoes_finais_texto || "",
          });

          try {
            const metaBanner = await apiGet(`admin/chamadas/${chamadaId}/modelo-banner`);
            setModeloMeta(metaBanner || null);
          } catch {
            setModeloMeta(null);
          }
  
          // 🔶 modelo-oral — (novo)
          try {
            const metaOral = await apiGet(`admin/chamadas/${chamadaId}/modelo-oral`);
            setOralMeta(metaOral || null);
          } catch {
            setOralMeta(null);
          }
        }
      } catch (e) {
        setErr(e?.message || "Falha ao carregar a chamada para edição.");
      } finally { setLoading(false); }
    })();
  }, [open, isEdit, chamadaId]);

  /* ===== util ===== */
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // 📥 baixar modelo (.ppt/.pptx)
  const onDownloadModelo = async () => {
    if (!isEdit) return;
    if (!modeloMeta?.exists) return;
    setModeloErr(""); setModeloOk(""); setModeloDownloading(true);
    try {
      const { blob, filename } = await apiGetFile(`admin/chamadas/${chamadaId}/modelo-banner/download`);
      const name =
        filename ||
        modeloMeta?.filename ||
        `modelo-banner-chamada-${chamadaId}${/\.pptx?$/i.test(modeloMeta?.filename || "") ? "" : ".pptx"}`;
      downloadBlob(name, blob);
      setModeloOk("Download iniciado.");
    } catch (e) {
      setModeloErr(e?.message || "Falha ao baixar o modelo.");
    } finally { setModeloDownloading(false); }
  };

  // 📤 importar modelo de banner (.pptx) com retry anti-CORS/401
  const onImportModelo = async (file) => {
    if (!file) return;
    setModeloErr(""); setModeloOk(""); setInfoOk(""); setModeloBusy(true);
    try {
      if (!isEdit) throw new Error("Salve a chamada para habilitar o upload do modelo.");
      if (!/\.(pptx?|PPTX?)$/.test(file.name)) throw new Error("Envie arquivo .ppt ou .pptx");
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo muito grande (máx 50MB).");

      const tryOnce = async () => {
        await apiUploadSvc(`chamadas/${chamadaId}/modelo-banner`, file, { fieldName: "file" });
        const meta = await apiGet(`admin/chamadas/${chamadaId}/modelo-banner`);
        setModeloMeta(meta || null);
      };

      const attempts = [0, 400, 1000];
      let lastErr = null;
      hadUploadCorsRef.current = false;

      for (let i = 0; i < attempts.length; i++) {
        try {
          if (i > 0) setInfoOk(`Conexão instável, tentando novamente (${i + 1}/${attempts.length})…`);
          await tryOnce();
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || "");
          const status = e?.status || e?.response?.status;
          if (status === 401 || status === 403 || /Failed to fetch|CORS/i.test(msg)) {
            hadUploadCorsRef.current = true;
            try { await apiGet("perfil/me"); } catch {}
            await sleep(attempts[i]);
            continue;
          }
          break;
        }
      }
      if (lastErr) throw lastErr;

      setModeloOk("Modelo importado com sucesso.");
      setInfoOk("");
    } catch (e) {
      setModeloErr(e?.message || "Falha ao importar o modelo.");
    } finally {
      setModeloBusy(false);
    }
  };

  const onSave = async () => {
    setErr(""); setInfoOk("");
  
    if (hadUploadCorsRef.current) { /* ... */ }
  
    if (modeloBusy) {
      setErr("Aguarde terminar o envio do modelo de banner antes de salvar.");
      return;
    }
    // 🔶 checagem do oral — (novo)
    if (oralBusy) {
      setErr("Aguarde terminar o envio do modelo de slides (oral) antes de salvar.");
      return;
    }
  
    const ver = validar();
    if (ver) { setErr(ver); return; }
    setSaving(true);
    try {
      const criteriosNorm = (form.criterios || []).map((c) => ({
        titulo: c.titulo,
        escala_min: Number(c.escala_min) || 1,
        escala_max: Number(c.escala_max) || 5,
        peso: Number(c.peso) || 1,
      }));
      const criteriosOraisNorm = (form.criterios_orais || []).map((c) => ({
        titulo: c.titulo,
        escala_min: Number(c.escala_min) || 1,
        escala_max: Number(c.escala_max) || 3,
        peso: Number(c.peso) || 1,
      }));

      const payload = {
        titulo: form.titulo,
        descricao_markdown: form.descricao_markdown,
        periodo_experiencia_inicio: form.periodo_experiencia_inicio,
        periodo_experiencia_fim: form.periodo_experiencia_fim,
        prazo_final_br: datetimeLocalToBrWall(form.prazo_final_br),
        aceita_poster: !!form.aceita_poster,
        link_modelo_poster: form.link_modelo_poster,
        max_coautores: Number(form.max_coautores) || 0,
        publicado: !!form.publicado,
        linhas: (form.linhas || []).map((l) => ({ codigo: toCodigo(l.nome), nome: l.nome || "", descricao: l.descricao || "" })),
        criterios: criteriosNorm,
        criterios_orais: criteriosOraisNorm,
        limites: {
          titulo: enforceBackend(clampUi(form.limites.titulo)),
          introducao: enforceBackend(clampUi(form.limites.introducao)),
          objetivos: enforceBackend(clampUi(form.limites.objetivos)),
          metodo: enforceBackend(clampUi(form.limites.metodo)),
          resultados: enforceBackend(clampUi(form.limites.resultados)),
          consideracoes: enforceBackend(clampUi(form.limites.consideracoes)),
        },
        criterios_outros: form.criterios_outros || "",
        oral_outros: form.oral_outros || "",
        premiacao_texto: form.premiacao_texto || "",
        disposicoes_finais_texto: form.disposicoes_finais_texto || "",
      };

      let savedId = chamadaId || null;
      if (isEdit) {
        await apiPut(`admin/chamadas/${chamadaId}`, payload);
        setInfoOk("Alterações salvas.");
        onSaved?.(savedId);
        onClose?.();
      } else {
        const r = await apiPost("admin/chamadas", payload);
        if (r?.id) savedId = r.id;
        setInfoOk("Chamada criada. Agora você já pode importar o modelo (.pptx) desta chamada.");
        onSaved?.(savedId);
        try { await apiGet(`admin/chamadas/${savedId}/modelo-banner`); } catch {}
        try { await apiGet("perfil/me"); } catch {}
      }
    } catch (e) {
      const msg = e?.message || e?.response?.data?.error || "Erro ao salvar a chamada. Revise os campos.";
      setErr(msg);
      console.error("Salvar chamada — erro:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar chamada" : "Nova chamada"}
      labelledById="dlg-title"
      describedById="dlg-desc"
      footer={
        <>
           {(err || infoOk) && (
            <span className={`mr-auto text-sm ${err ? "text-red-600" : "text-emerald-600"}`}>
              {err || infoOk}
            </span>
          )}
          {/* Botões auxiliares de modelo (se já existir) */}
          {isEdit && modeloMeta?.exists && (
            <button
              type="button"
              onClick={onDownloadModelo}
              disabled={modeloDownloading}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Baixar modelo de banner (.pptx)"
            >
              {modeloDownloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {modeloDownloading ? "Baixando…" : "Baixar modelo"}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button
  type="button"
  onClick={onSave}
  disabled={saving || modeloBusy || oralBusy}
  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-white ..."
>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} {saving ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <LiveRegion message={err || infoOk} type={err ? "assertive" : "polite"} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {/* Descrição acessível do conteúdo do modal (para aria-describedby) */}
          <div id="dlg-desc" className="sr-only">
            Formulário para criar ou editar chamada. Preencha informações gerais, prazos, normas,
            limites de caracteres e critérios de avaliação. Ao final, salve para habilitar upload
            do modelo de banner (.pptx) específico desta chamada.
          </div>
          {/* 1) Gerais */}
          <section id="s1" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <h2 className="sm:col-span-3 mb-2 text-base font-semibold">Informações gerais</h2>
            <div className="sm:col-span-3">
              <Field label={<span>Título da chamada <Counter value={form.titulo} max={200} /></span>} htmlFor="titulo">
                <input id="titulo" className={`${inputBase} text-lg sm:text-xl`} value={form.titulo}
                  onChange={(e) => update("titulo", e.target.value)} maxLength={200} required aria-required="true" />
              </Field>
            </div>

            <Field label="Período da experiência — início (AAAA-MM)">
              <MonthYearPicker
                value={form.periodo_experiencia_inicio}
                max={form.periodo_experiencia_fim || undefined}
                selectClass={inputBase}
                className="sm:max-w-xs"
                onChange={(v) => update("periodo_experiencia_inicio", v)}
              />
            </Field>

            <Field label="Período da experiência — fim (AAAA-MM)">
              <MonthYearPicker
                value={form.periodo_experiencia_fim}
                min={form.periodo_experiencia_inicio || undefined}
                selectClass={inputBase}
                className="sm:max-w-xs"
                onChange={(v) => update("periodo_experiencia_fim", v)}
              />
            </Field>
          </section>

          {/* 2) Prazo */}
          <section id="s2" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h2 className="sm:col-span-2 mb-2 text-base font-semibold">Prazo para submissão</h2>
            <Field label="Prazo final (Brasília)" htmlFor="prazo">
              <input id="prazo" type="datetime-local" className={inputBase} value={form.prazo_final_br}
                onChange={(e) => update("prazo_final_br", e.target.value)} required aria-required="true" />
            </Field>
          </section>

          {/* 3) Normas / Linhas / Limites */}
          <section id="s3" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Normas para submissão dos trabalhos</h2>

            {/* Linhas */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Linhas temáticas</h3>
                <button
                  type="button"
                  onClick={() => update("linhas", [...form.linhas, { nome: "", descricao: "" }])}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> adicionar linha
                </button>
              </div>
              <div className="grid gap-3">
                {form.linhas.map((l, i) => (
                  <div key={i} className="grid gap-2">
                    <input className={inputBase} placeholder="Nome da linha temática" value={l.nome}
                      onChange={(e) => { const arr = [...form.linhas]; arr[i] = { ...arr[i], nome: e.target.value }; update("linhas", arr); }}
                      aria-label="Nome da linha temática" />
                    <div className="flex gap-2">
                      <textarea className={`${inputBase} flex-1 min-h-[110px] rounded-2xl`} placeholder="Descrição (opcional)" value={l.descricao || ""}
                        onChange={(e) => { const arr = [...form.linhas]; arr[i] = { ...arr[i], descricao: e.target.value }; update("linhas", arr); }}
                        aria-label="Descrição da linha temática" />
                      <button type="button"
                        onClick={() => update("linhas", form.linhas.filter((_, j) => j !== i))}
                        className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        aria-label={`Remover linha temática ${i + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" /> Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Limites */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Limites de caracteres da submissão</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["titulo", "Título da experiência"],
                  ["introducao", "Introdução com justificativa"],
                  ["objetivos", "Objetivos"],
                  ["metodo", "Método/Descrição da prática"],
                  ["resultados", "Resultados/Impactos"],
                  ["consideracoes", "Considerações finais"],
                ].map(([key, rot]) => (
                  <Field
                    key={key}
                    label={rot}
                    hint={`(mín. ${LIMIT_MIN} • máx. ${LIMIT_MAX}) — valores abaixo de 50 serão salvos como 50 (regra temporária)`}
                  >
                    <input
                      type="number"
                      min={LIMIT_MIN}
                      max={LIMIT_MAX}
                      className={inputBase}
                      value={form.limites[key]}
                      onChange={(e) => updateLim(key, e.target.value)}
                      aria-label={`Limite de caracteres para ${rot}`}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {/* Markdown normas */}
            <Field label="Descrição/Normas (Markdown)" htmlFor="desc">
              <textarea id="desc" className={`${inputBase} min-h-[180px] rounded-2xl`}
                value={form.descricao_markdown}
                onChange={(e) => update("descricao_markdown", e.target.value)}
                required aria-required="true" />
            </Field>
          </section>

          {/* 4) Autores */}
          <section id="s4" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <h2 className="sm:col-span-2 mb-2 text-base font-semibold">Limite de autores e coautores</h2>
            <Field label="Máximo de coautores" htmlFor="coaut">
              <input id="coaut" type="number" min={0} className={inputBase}
                value={form.max_coautores}
                onChange={(e) => update("max_coautores", e.target.value)} />
            </Field>
          </section>

          {/* 5) Critérios escrita */}
          <section id="s5" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Critérios de avaliação — escrita</h2>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Critérios</h3>
                <button
                  type="button"
                  onClick={() => update("criterios", [...form.criterios, { titulo: "", escala_min: 1, escala_max: 5, peso: 1 }])}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> adicionar critério
                </button>
              </div>
              <div className="grid gap-3">
                {form.criterios.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <input className={inputBase} placeholder="Título do critério" value={c.titulo}
                      onChange={(e) => { const arr = [...form.criterios]; arr[i] = { ...arr[i], titulo: e.target.value }; update("criterios", arr); }}
                      aria-label="Título do critério (escrita)" />
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Mín.">
                        <input className={inputBase} type="number" value={c.escala_min ?? 1}
                          onChange={(e) => { const arr = [...form.criterios]; arr[i] = { ...arr[i], escala_min: Number(e.target.value) || 1 }; update("criterios", arr); }} />
                      </Field>
                      <Field label="Máx.">
                        <input className={inputBase} type="number" value={c.escala_max ?? 5}
                          onChange={(e) => { const arr = [...form.criterios]; arr[i] = { ...arr[i], escala_max: Number(e.target.value) || 5 }; update("criterios", arr); }} />
                      </Field>
                      <Field label="Peso">
                        <input className={inputBase} type="number" step="0.1" value={c.peso ?? 1}
                          onChange={(e) => { const arr = [...form.criterios]; arr[i] = { ...arr[i], peso: Number(e.target.value) || 1 }; update("criterios", arr); }} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Outros critérios (escrita)">
              <textarea className={`${inputBase} min-h-[100px] rounded-2xl`} value={form.criterios_outros}
                onChange={(e) => update("criterios_outros", e.target.value)} placeholder="Complementos da avaliação escrita..." />
            </Field>
          </section>

          {/* 6) Critérios oral */}
          <section id="s6" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Apresentação oral</h2>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium">Critérios — apresentação oral</h3>
                <button
                  type="button"
                  onClick={() => update("criterios_orais", [...form.criterios_orais, { titulo: "", escala_min: 1, escala_max: 3, peso: 1 }])}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> adicionar critério
                </button>
              </div>
              <div className="grid gap-3">
                {form.criterios_orais.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <input className={inputBase} placeholder="Título do critério" value={c.titulo}
                      onChange={(e) => { const arr = [...form.criterios_orais]; arr[i] = { ...arr[i], titulo: e.target.value }; update("criterios_orais", arr); }}
                      aria-label="Título do critério (oral)" />
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Mín.">
                        <input className={inputBase} type="number" value={c.escala_min ?? 1}
                          onChange={(e) => { const arr = [...form.criterios_orais]; arr[i] = { ...arr[i], escala_min: Number(e.target.value) || 1 }; update("criterios_orais", arr); }} />
                      </Field>
                      <Field label="Máx.">
                        <input className={inputBase} type="number" value={c.escala_max ?? 3}
                          onChange={(e) => { const arr = [...form.criterios_orais]; arr[i] = { ...arr[i], escala_max: Number(e.target.value) || 3 }; update("criterios_orais", arr); }} />
                      </Field>
                      <Field label="Peso">
                        <input className={inputBase} type="number" step="0.1" value={c.peso ?? 1}
                          onChange={(e) => { const arr = [...form.criterios_orais]; arr[i] = { ...arr[i], peso: Number(e.target.value) || 1 }; update("criterios_orais", arr); }} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Field label="Outros critérios (oral)">
              <textarea className={`${inputBase} min-h-[100px] rounded-2xl`} value={form.oral_outros}
                onChange={(e) => update("oral_outros", e.target.value)} placeholder="Complementos da avaliação oral..." />
            </Field>
          </section>

          {/* 7) Premiação */}
          <section id="s7" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Premiação</h2>
            <Field label="Texto da premiação">
              <textarea className={`${inputBase} min-h-[120px] rounded-2xl`} value={form.premiacao_texto}
                onChange={(e) => update("premiacao_texto", e.target.value)} placeholder="Descreva regras e formato da premiação..." />
            </Field>
          </section>

          {/* 8) Formulário eletrônico para submissão */}
          <section id="s8" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Formulário eletrônico para submissão</h2>

            <Field label="Aceita pôster (.ppt/.pptx)">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="rounded border-zinc-300"
                  checked={form.aceita_poster}
                  onChange={(e) => update("aceita_poster", e.target.checked)}
                />
                Aceitar envio de pôster no ato da submissão
              </label>
            </Field>

            {/* Importar modelo POR CHAMADA */}
            <Field label="Modelo de banner">
              {!isEdit && (
                <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
                    <div>
                      <strong>Salve a chamada</strong> para habilitar o envio do modelo (.pptx). Após salvar, o botão de upload ficará disponível nesta mesma tela.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white ${
                      isEdit && !modeloBusy ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer" : "bg-zinc-400 cursor-not-allowed"
                    }`}
                    title={isEdit ? "Importar modelo (.pptx)" : "Salve a chamada para habilitar o upload"}
                  >
                    <input
                      type="file"
                      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      className="hidden"
                      disabled={!isEdit || modeloBusy}
                      onChange={(e) => onImportModelo(e.target.files?.[0] || null)}
                    />
                    {modeloBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                    {modeloBusy ? "Enviando…" : "Importar modelo (.pptx)"}
                  </label>
                </div>

                <div className="mt-1 text-center text-xs text-zinc-500">
                  Esse arquivo será usado por outras telas para gerar/exportar o banner da <strong>chamada atual</strong>.
                  {modeloMeta?.exists === true && (
                    <>
                      {" "}<strong>Modelo disponível</strong>
                      {modeloMeta.filename ? ` — ${modeloMeta.filename}` : ""}
                      {Number.isFinite(modeloMeta?.size) ? ` (${formatBytes(modeloMeta.size)})` : ""}
                      {modeloMeta.mtime ? ` — atualizado em ${new Date(modeloMeta.mtime).toLocaleString()}` : ""}
                    </>
                  )}
                  {modeloMeta?.exists === false && (<span className="text-rose-600"> Nenhum modelo importado ainda para esta chamada.</span>)}
                </div>

                {modeloOk && <div className="text-center text-xs text-emerald-600">{modeloOk}</div>}
                {modeloErr && <div className="text-center text-xs text-rose-600">{modeloErr}</div>}
                {infoOk && !modeloOk && !modeloErr && <div className="text-center text-xs text-emerald-600">{infoOk}</div>}
              </div>
            </Field>

             {/* 🔶 INSERIR AQUI: Modelo de slides (apresentação oral) — (novo) */}
  {/* 🔻 COLE O BLOCO A PARTIR DA LINHA ABAIXO */}
  <Field label="Modelo de slides (apresentação oral)">
  {!isEdit && (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="flex items-start gap-2 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <div><strong>Salve a chamada</strong> para habilitar o envio do modelo de slides (.pptx).</div>
      </div>
    </div>
  )}

  <div className="flex flex-col items-center justify-center gap-3">
    <div className="flex flex-wrap items-center justify-center gap-2">
      {/* Upload do modelo (oral) */}
      <label
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white ${
          isEdit && !oralBusy ? "bg-amber-600 hover:bg-amber-700 cursor-pointer" : "bg-zinc-400 cursor-not-allowed"
        }`}
        title={isEdit ? "Importar modelo de slides (.pptx)" : "Salve a chamada para habilitar o upload"}
      >
        <input
          type="file"
          accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          disabled={!isEdit || oralBusy}
          onChange={(e) => onImportModeloOral(e.target.files?.[0] || null)}
        />
        {oralBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        {oralBusy ? "Enviando…" : "Importar modelo (oral .pptx)"}
      </label>
      </div>

    <div className="mt-1 text-center text-xs text-zinc-500">
      Esse arquivo será usado para as <strong>apresentações orais</strong> desta chamada.
      {oralMeta?.exists === true && (
        <>
          {" "}<strong>Modelo disponível</strong>
          {oralMeta.filename ? ` — ${oralMeta.filename}` : ""}
          {Number.isFinite(oralMeta?.size) ? ` (${formatBytes(oralMeta.size)})` : ""}
          {oralMeta.mtime ? ` — atualizado em ${new Date(oralMeta.mtime).toLocaleString()}` : ""}
        </>
      )}
      {oralMeta?.exists === false && (<span className="text-rose-600"> Nenhum modelo importado ainda para apresentação oral.</span>)}
    </div>

    {oralOk &&  <div className="text-center text-xs text-emerald-600">{oralOk}</div>}
    {oralErr && <div className="text-center text-xs text-rose-600">{oralErr}</div>}
  </div>
</Field>
         </section>

          {/* 9) Disposições finais */}
          <section id="s9" className="grid grid-cols-1 gap-4">
            <h2 className="mb-2 text-base font-semibold">Disposições finais</h2>
            <Field label="Texto das disposições finais">
              <textarea className={`${inputBase} min-h-[120px] rounded-2xl`} value={form.disposicoes_finais_texto}
                onChange={(e) => update("disposicoes_finais_texto", e.target.value)} placeholder="Informe as disposições finais..." />
            </Field>
          </section>
        </div>
      )}
    </Modal>
  );
}

/* ─── Página principal ─── */
export default function AdminChamadaForm() {
  const params = useParams();
  const routeId = params?.chamadaId;
  const [counts, setCounts] = useState({
    total: "—",
    abertas: "—",
    encerradas: "—",
    publicadas: "—",
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => { if (routeId) { setEditingId(routeId); setModalOpen(true); } }, [routeId]);

  const openNovo = () => { setEditingId(null); setModalOpen(true); };
  const openEditar = (id) => { setEditingId(id); setModalOpen(true); };
  const onSaved = (savedId) => {
    setRefreshSignal((x) => x + 1);
    if (savedId) setEditingId(savedId); // ativa modo edição p/ importar modelo
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <HeaderHero counts={counts} />
      <main className="mx-auto w-full max-w-screen-xl p-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <ChamadasPainel
            onEditar={openEditar}
            onNova={openNovo}
            refreshSignal={refreshSignal}
            onCountsChange={setCounts}
          />
        </div>
      </main>
      <Footer />

      <AddEditChamadaModal open={modalOpen} onClose={() => setModalOpen(false)} chamadaId={editingId} onSaved={onSaved} />
    </div>
  );
}
