/* eslint-disable no-console */
// ✅ src/pages/GerenciarEventos.jsx (admin) — PREMIUM++ (clean + institucional + discreto + poster + ministats + chips filtro)
// - Mantém TODAS as regras/fluxos (fetch, abort, editar refina, publicar com rollback, confirmações)
// - Visual alinhado ao "Painel do Usuário": cores discretas, botões suaves, hierarquia clara, cards limpos
// - Poster/folder aparece como thumbnail elegante (fallback premium)
// - Ministats: estilo clean (card branco) + ícone em círculo com cor suave
// - ✅ Chips: ATIVOS (programado + em andamento) | ENCERRADOS
// - ✅ Ministats: remove Restritos/Folder e adiciona Eventos 2025/2026
// - Botões: cor contida (texto/ícone + hover suave), sem chapado
// - A11y: live region, skip link, aria labels e estados

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createAsyncQueue } from "../utils/asyncQueue";
import { useInViewOnce } from "../hooks/useInViewOnce";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  Pencil,
  Trash2,
  Plus,
  Lock,
  RefreshCcw,
  Eye,
  EyeOff,
  AlertTriangle,
  LayoutGrid,
  CalendarCheck2,
  BadgeCheck,
  BadgeX,
  Sparkles,
  MapPin,
  CalendarDays,
} from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import { resolveAssetUrl, openAsset } from "../utils/assets";
import ModalEvento from "../components/ModalEvento";
import ModalConfirmacao from "../components/ModalConfirmacao";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
import Footer from "../components/Footer";

/* =============================
   Logs DEV (sem spam em prod)
============================= */
const IS_DEV = import.meta?.env?.MODE !== "production";
const logDev = (...a) => IS_DEV && console.log("[GerenciarEventos]", ...a);
const warnDev = (...a) => IS_DEV && console.warn("[GerenciarEventos]", ...a);
const errDev = (...a) => IS_DEV && console.error("[GerenciarEventos]", ...a);

function snapshotModalRoot() {
  try {
    const root = document.getElementById("modal-root");
    if (!root) return { exists: false };
    const cs = window.getComputedStyle(root);
    return {
      exists: true,
      children: root.childElementCount,
      display: cs.display,
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      zIndex: cs.zIndex,
    };
  } catch {
    return { exists: false };
  }
}

/* =============================
   Helpers básicos
============================= */
const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(
      ([, v]) => v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "")
    )
  );

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");

const hhmm = (s) => {
  if (typeof s !== "string") return "";
  const v = s.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
  return v ? v.slice(0, 5) : "";
};

const iso = (s) => (typeof s === "string" ? s.slice(0, 10) : "");

// extrai ids numéricos
const extractIds = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((i) => (typeof i === "object" ? i?.id : i))
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n));
};

// extrai strings limpas (para cargos)
const extractStrs = (arr) => {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((v) =>
          String(typeof v === "object" ? v?.codigo || v?.sigla || v?.nome || "" : v).trim()
        )
        .filter(Boolean)
    )
  );
};

function getPosterUrl(ev) {
  const raw =
    ev?.folder_url ??
    ev?.folderUrl ??
    ev?.folder ??
    ev?.poster_url ??
    ev?.posterUrl ??
    ev?.capa_url ??
    ev?.capaUrl ??
    ev?.imagem_url ??
    ev?.imagemUrl ??
    ev?.arquivo_folder ??
    ev?.arquivoFolder ??
    "";

  return raw ? resolveAssetUrl(raw) : "";
}

/* =============================
   ✅ Poster blob (novo) — cache + fetch com auth
   - Se NÃO existir folder_url, tenta /api/eventos/:id/folder via authFetch (blob)
   - Cacheia objectURL pra não refazer download
============================= */
const posterBlobCache = new Map(); // key: eventoId -> objectURL
const posterBlobPending = new Map(); // key: eventoId -> Promise<string>

// 🆕 fila de downloads (evita burst / 100 requests em paralelo)
const posterDownloadQueue = createAsyncQueue(4); // <= ajuste fino: 3..6

async function getPosterBlobUrl(eventoId) {
  const id = Number(eventoId);
  if (!Number.isFinite(id) || id <= 0) return "";

  if (posterBlobCache.has(id)) return posterBlobCache.get(id);

  if (posterBlobPending.has(id)) return posterBlobPending.get(id);

  const p = posterDownloadQueue(async () => {
    const apiPath = `/api/eventos/${id}/folder`;
    const resp = await authFetch(apiPath, { method: "GET", cache: "no-store" });
  
    // ✅ 404 = sem folder (silencioso)
    if (resp.status === 404) return "";
  
    // ✅ 401/403 = sem permissão (silencioso)
    if (resp.status === 401 || resp.status === 403) return "";
  
    // outros erros: também não quebra UI
    if (!resp.ok) return "";
  
    const blob = await resp.blob();
    if (!blob || !blob.size) return "";
  
    const objectUrl = URL.createObjectURL(blob);
    posterBlobCache.set(id, objectUrl);
    return objectUrl;
  })
    .catch(() => "")
    .finally(() => posterBlobPending.delete(id));

  posterBlobPending.set(id, p);
  return p;
}

/* =============================
   Ano do evento (para stats 2025/2026)
   - tenta achar a primeira data disponível sem criar Date()
============================= */
function yearFromYmd(s) {
  const v = String(s || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const y = Number(v.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function getEventYear(ev) {
  // 1) campos diretos
  const direct =
    yearFromYmd(ev?.data_inicio) ??
    yearFromYmd(ev?.data_fim) ??
    yearFromYmd(ev?.inicio) ??
    yearFromYmd(ev?.fim);

  if (direct) return direct;

  // 2) turmas: data_inicio/data_fim
  const turmas = Array.isArray(ev?.turmas) ? ev.turmas : [];
  for (const t of turmas) {
    const y1 = yearFromYmd(t?.data_inicio);
    if (y1) return y1;
    const y2 = yearFromYmd(t?.data_fim);
    if (y2) return y2;

    // 3) turmas.datas[]
    const datas = Array.isArray(t?.datas) ? t.datas : [];
    for (const d of datas) {
      const y = yearFromYmd(d?.data);
      if (y) return y;
    }
  }

  // 4) fallback comum (alguns backends mandam "criado_em"/"created_at")
  const created =
    yearFromYmd(ev?.criado_em) ??
    yearFromYmd(ev?.created_at) ??
    yearFromYmd(ev?.atualizado_em) ??
    yearFromYmd(ev?.updated_at);

  if (created) return created;

  return null;
}

/* =============================
   Carga horária (datas)
============================= */
const cargaHorariaFromEncontros = (encs) => {
  let total = 0;
  for (const e of encs) {
    const [h1, m1] = String(e.inicio || "00:00").split(":").map(Number);
    const [h2, m2] = String(e.fim || "00:00").split(":").map(Number);
    const diffH = Math.max(0, (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60);
    total += diffH >= 8 ? diffH - 1 : diffH;
  }
  return Math.round(total);
};

function normalizeTurmas(turmas = []) {
  return (turmas || []).map((t) => {
    const nome = (t.nome || "Turma Única").trim();
    const hiBase = hhmm(t.horario_inicio || "08:00");
    const hfBase = hhmm(t.horario_fim || "17:00");

    let datas = Array.isArray(t.datas) ? t.datas : [];

    if ((!datas || datas.length === 0) && Array.isArray(t.encontros)) {
      datas = t.encontros
        .map((e) =>
          typeof e === "string"
            ? { data: iso(e), horario_inicio: hiBase, horario_fim: hfBase }
            : {
                data: iso(e.data),
                horario_inicio: hhmm(e.inicio || e.horario_inicio || hiBase),
                horario_fim: hhmm(e.fim || e.horario_fim || hfBase),
              }
        )
        .filter((d) => d?.data);
    }

    datas = (datas || [])
      .map((d) => ({
        data: iso(d.data),
        horario_inicio: hhmm(d.horario_inicio || hiBase),
        horario_fim: hhmm(d.horario_fim || hfBase),
      }))
      .filter((d) => d.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

    const encontrosCalc = datas.map((d) => ({ inicio: d.horario_inicio, fim: d.horario_fim }));

    let ch = Number(t.carga_horaria);
    if (!Number.isFinite(ch) || ch <= 0) ch = cargaHorariaFromEncontros(encontrosCalc) || 1;

    const vagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : Number(t.vagas);
    const vagasOk = Number.isFinite(vagas) && vagas > 0 ? vagas : 1;

    const instrutores = extractIds(t.instrutores || t.instrutor || t.professores || []);

    const _assinanteRaw =
      t.assinante_id ?? t.instrutor_assinante_id ?? t.instrutor_assinante ?? t.assinante;

    const assinanteNum = Number(_assinanteRaw);
    const hasAssinante = Number.isFinite(assinanteNum);

    return clean({
      ...(Number.isFinite(Number(t.id)) ? { id: Number(t.id) } : {}),
      nome,
      vagas_total: vagasOk,
      carga_horaria: ch,
      datas,
      instrutores,
      ...(hasAssinante ? { assinante_id: assinanteNum } : {}),
      ...(hasAssinante ? { instrutor_assinante_id: assinanteNum } : {}),
    });
  });
}

/* ========= Restrição: normalização ========= */
const normRegistros = (arr) =>
  Array.from(new Set((arr || []).map((v) => String(v || "").replace(/\D/g, "")).filter((r) => /^\d{6}$/.test(r))));

/* =============================
   Fetch auxiliares
============================= */
async function fetchTurmasDoEvento(eventoId) {
  const urls = [
    `/api/eventos/${eventoId}`,
    `/api/eventos/${eventoId}/turmas`,
    `/api/turmas/por-evento/${eventoId}`,
    `/api/turmas/evento/${eventoId}`,
  ];
  for (const url of urls) {
    try {
      const resp = await apiGet(url, { on403: "silent" });
      if (resp && resp.id && Array.isArray(resp.turmas)) return resp.turmas;
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp?.turmas)) return resp.turmas;
      if (Array.isArray(resp?.lista)) return resp.lista;
    } catch (err) {
      console.warn("[fetchTurmasDoEvento] Falha em", url, err?.message || err);
    }
  }
  return [];
}

async function fetchEventoCompleto(eventoId) {
  try {
    const resp = await apiGet(`/api/eventos/${eventoId}`, { on403: "silent" });
    const ev = resp?.evento || resp;
    if (ev?.id) return ev;
  } catch (err) {
    console.error("[fetchEventoCompleto] Falha:", err?.message, err);
  }
  return null;
}

/* =============================
   Upload helpers (folder/programação)
============================= */
function getAuthToken() {
  try {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  } catch {
    return "";
  }
}

async function authFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = new Headers(opts.headers || {});
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...opts, headers, credentials: "include" });
}

async function uploadFolder(eventoId, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("folder", file);
  const resp = await authFetch(`/api/eventos/${eventoId}/folder`, { method: "POST", body: fd });
  if (!resp.ok) {
    let msg = "Falha ao enviar folder (imagem).";
    try {
      const data = await resp.json();
      if (data?.erro || data?.message) msg = data.erro || data.message;
    } catch {}
    throw new Error(msg);
  }
}

async function uploadProgramacao(eventoId, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("programacao", file);
  const resp = await authFetch(`/api/eventos/${eventoId}/programacao`, { method: "POST", body: fd });
  if (!resp.ok) {
    let msg = "Falha ao enviar programação (PDF).";
    try {
      const data = await resp.json();
      if (data?.erro || data?.message) msg = data.erro || data.message;
    } catch {}
    throw new Error(msg);
  }
}

/* =============================
   Modo “espelho” para PUT (merge com servidor)
============================= */
function buildUpdateBody(baseServidor, dadosDoModal) {
  const body = {};

  body.titulo = (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim();
  body.descricao = (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim();
  body.local = (dadosDoModal?.local ?? baseServidor?.local ?? "").trim();
  body.tipo = (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim();

  const uniId = Number(dadosDoModal?.unidade_id ?? baseServidor?.unidade_id);
  if (Number.isFinite(uniId)) body.unidade_id = uniId;

  body.publico_alvo = (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim();

  const restrito = Boolean(
    dadosDoModal?.restrito ??
      (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
  );
  body.restrito = restrito;
  body.restrito_modo = restrito
    ? dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo ?? null
    : null;

  if (restrito && body.restrito_modo === "lista_registros") {
    const fonteModal =
      (Array.isArray(dadosDoModal?.registros_permitidos) && dadosDoModal.registros_permitidos) ||
      (Array.isArray(dadosDoModal?.registros) && dadosDoModal.registros) ||
      [];
    const fonteServer = Array.isArray(baseServidor?.registros_permitidos)
      ? baseServidor.registros_permitidos
      : [];
    const regs = normRegistros(fonteModal.length ? fonteModal : fonteServer);
    if (regs.length) body.registros_permitidos = regs;
  }

  const cargosModal = extractStrs(dadosDoModal?.cargos_permitidos);
  const cargosServer = extractStrs(baseServidor?.cargos_permitidos);
  if (restrito && cargosModal.length) body.cargos_permitidos = cargosModal;
  else if (restrito && cargosServer.length) body.cargos_permitidos = cargosServer;

  const unidsModal = extractIds(dadosDoModal?.unidades_permitidas);
  const unidsServer = extractIds(baseServidor?.unidades_permitidas);
  if (restrito && unidsModal.length) body.unidades_permitidas = unidsModal;
  else if (restrito && unidsServer.length) body.unidades_permitidas = unidsServer;

  let turmasFonte = [];
  if (Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length > 0) turmasFonte = dadosDoModal.turmas;
  else if (Array.isArray(baseServidor?.turmas) && baseServidor.turmas.length > 0) turmasFonte = baseServidor.turmas;

  const turmasPayload = normalizeTurmas(turmasFonte);
  if (turmasPayload.length > 0) body.turmas = turmasPayload;

  // ✅ pós-curso (se veio do modal)
  if (dadosDoModal?.pos_curso_tipo) body.pos_curso_tipo = String(dadosDoModal.pos_curso_tipo);

  return clean(body);
}

/* =============================
   UI atoms (premium clean)
============================= */
function SoftButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500
      ${className}`}
    >
      {children}
    </button>
  );
}

function Chip({ tone = "zinc", children, title }) {
  const map = {
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-800",
    indigo:
      "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-200 dark:border-indigo-900/40",
    amber:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-900/40",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${map[tone]}`}
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
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold border transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500
        ${
          active
            ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
            : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
        }`}
      aria-pressed={active ? "true" : "false"}
    >
      <span>{label}</span>
      <span
        className={`text-[11px] px-2 py-0.5 rounded-full ${
          active ? "bg-white/20 text-white" : "bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-200"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* =============================
   Ministats (ícone colorido contido)
============================= */
function StatPill({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: {
      wrap: "bg-zinc-100 dark:bg-white/5",
      icon: "text-zinc-700 dark:text-zinc-200",
    },
    indigo: {
      wrap: "bg-indigo-100/80 dark:bg-indigo-950/30",
      icon: "text-indigo-700 dark:text-indigo-200",
    },
    emerald: {
      wrap: "bg-emerald-100/80 dark:bg-emerald-950/30",
      icon: "text-emerald-700 dark:text-emerald-200",
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
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl ${t.wrap}`}>
          <Icon className={`w-5 h-5 ${t.icon}`} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

/* =============================
   Header
============================= */
function HeaderHero({ onCriar, onAtualizar, atualizando, hint }) {
  return (
    <header className="relative isolate overflow-hidden" role="banner">
  <div
    className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-700 to-indigo-800 pointer-events-none"
    aria-hidden="true"
  />
  <div
    className="absolute -top-28 -left-28 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none"
    aria-hidden="true"
  />
  <div
    className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-black/10 blur-3xl pointer-events-none"
    aria-hidden="true"
  />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="relative z-10 pointer-events-auto max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-9 md:py-10">
        <div className="flex flex-col items-center text-center gap-2.5">
          <div className="inline-flex items-center justify-center gap-2 text-white">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 backdrop-blur">
              <LayoutGrid className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gerenciar Eventos</h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Crie, publique e edite eventos e turmas — com visual limpo e institucional.
          </p>

          <div className="text-[12px] sm:text-xs text-white/80">{hint}</div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SoftButton
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`text-white bg-white/15 hover:bg-white/20 backdrop-blur border border-white/20
              ${atualizando ? "opacity-60 cursor-not-allowed" : "hover:-translate-y-[1px]"}`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </SoftButton>

            <SoftButton
  type="button"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[CLICK] Criar evento", { onCriarType: typeof onCriar });
    onCriar?.();
  }}
  className="bg-white text-zinc-900 hover:bg-white/90 border border-white/40 shadow-md"
  aria-label="Criar novo evento"
>
              <Plus className="w-4.5 h-4.5" aria-hidden="true" />
              Criar evento
            </SoftButton>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ========= Status ========= */
function deduzStatus(ev) {
  const raw = String(ev?.status || "").toLowerCase();
  if (raw === "andamento") return "em_andamento";
  if (raw === "programado") return "programado";
  if (raw === "encerrado") return "encerrado";
  return "programado";
}
function statusDotClass(status) {
  if (status === "programado") return "bg-emerald-500";
  if (status === "em_andamento") return "bg-amber-500";
  if (status === "encerrado") return "bg-rose-500";
  return "bg-zinc-400";
}
function statusLabel(status) {
  if (status === "programado") return "Programado";
  if (status === "em_andamento") return "Em andamento";
  if (status === "encerrado") return "Encerrado";
  return "Programado";
}

/* =============================
   ✅ Poster Thumb (folder_url OU blob)
============================= */
function PosterThumb({ ev, title }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  // 🆕 só carrega blob quando estiver perto da tela
  const { ref: inViewRef, inView } = useInViewOnce({ rootMargin: "600px 0px", threshold: 0.01 });

  useEffect(() => {
    let alive = true;

    // 1) legado (url direta)
    const legacy = getPosterUrl(ev);
    if (legacy) {
      setSrc(legacy);
      setFailed(false);
      return () => { alive = false; };
    }

    // 2) blob (apenas quando entrar em view)
    if (!inView) return () => { alive = false; };

    (async () => {
      const blobUrl = await getPosterBlobUrl(ev?.id);
      if (!alive) return;

      if (blobUrl) {
        setSrc(blobUrl);
        setFailed(false);
      } else {
        setSrc("");
        setFailed(true);
      }
    })();

    return () => { alive = false; };
  }, [inView, ev?.id, ev?.folder_url, ev?.folderUrl, ev?.folder]);

  if (!src || failed) {
    return (
      <div
        ref={inViewRef}
        className="
          w-[96px] h-[128px]
          sm:w-[132px] sm:h-[176px]
          md:w-[148px] md:h-[196px]
          rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700
          bg-zinc-50 dark:bg-zinc-900/40
          flex flex-col items-center justify-center gap-1
          text-[11px] text-zinc-500 dark:text-zinc-400 px-2 text-center
        "
        aria-label={`Folder indisponível para ${title}`}
      >
        <CalendarDays className="w-5 h-5 opacity-70" />
        Sem folder
      </div>
    );
  }

  return (
    <div
      ref={inViewRef}
      className="
        w-[96px] h-[128px]
        sm:w-[132px] sm:h-[176px]
        md:w-[148px] md:h-[196px]
        rounded-2xl border border-white/10 shadow-sm
        bg-zinc-100 dark:bg-zinc-900
        overflow-hidden grid place-items-center
      "
      aria-label={`Folder do evento ${title}`}
    >
      <img
        src={src}
        alt={`Folder do evento ${title}`}
        className="w-full h-full object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
          setSrc("");
        }}
      />
    </div>
  );
}

/* =============================
   Página
============================= */
export default function GerenciarEventos() {

  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // ✅ filtros (chips)
  // "ativos" = programado + em_andamento | "encerrados" = encerrado
  const [filtroStatus, setFiltroStatus] = useState("ativos");

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPublish, setConfirmPublish] = useState(null);

  // ✅ DEBUG: estados principais (quando mudar)
  useEffect(() => {
    logDev("[STATE]", {
      modalAberto,
      eventoSelecionado: eventoSelecionado?.id ?? null,
      confirmDelete: !!confirmDelete,
      confirmPublish: !!confirmPublish,
      modalRoot: snapshotModalRoot(),
    });
  }, [modalAberto, eventoSelecionado, confirmDelete, confirmPublish]);

  const liveRef = useRef(null);
  const abortListRef = useRef(null);
  const abortEditRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortListRef.current?.abort?.("unmount");
      abortEditRef.current?.abort?.("unmount");
  
      // ✅ limpa objectURLs (evita leak)
      for (const [, url] of posterBlobCache.entries()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      posterBlobCache.clear();
      posterBlobPending.clear();
    };
  }, []);
  

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const recarregarEventos = useCallback(async () => {
    try {
      setErro("");
      setLoading(true);
      setLive("Carregando eventos…");

      abortListRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortListRef.current = ctrl;

      const data = await apiGet("/api/eventos", { on403: "silent", signal: ctrl.signal });

      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data?.lista)
        ? data.lista
        : [];

      if (!mountedRef.current) return;
      setEventos(lista);
      setLive(`Eventos carregados: ${lista.length}.`);
    } catch (err) {
      if (err?.name === "AbortError") return;
      const msg = err?.message || "Erro ao carregar eventos";
      console.error("/api/eventos erro:", err);
      if (!mountedRef.current) return;
      setErro(msg);
      setEventos([]);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar eventos.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    recarregarEventos();
  }, [recarregarEventos]);

  // ✅ DEBUG: quando modal estiver aberto, monitora ESC/clicks globais (captura)
  useEffect(() => {
    if (!modalAberto) return;

    const onKey = (e) => {
      if (e.key === "Escape") warnDev("[GLOBAL] Escape capturado com modalAberto=true");
    };
    const onPointer = (e) => {
      const t = e.target;
      warnDev("[GLOBAL] pointerdown (capture) com modalAberto=true", {
        tag: t?.tagName,
        id: t?.id,
        class: t?.className,
      });
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [modalAberto]);

  const abrirModalCriar = () => {
    logDev("[ACTION] abrirModalCriar()", { before: { modalAberto, eventoSelecionado: eventoSelecionado?.id ?? null } });
    setEventoSelecionado(null);
    setModalAberto(true);
    // dá 1 tick pra React aplicar e a gente ver se “desfaz”
    setTimeout(() => {
      logDev("[AFTER] abrirModalCriar tick", { modalAberto: true, modalRoot: snapshotModalRoot() });
    }, 0);
  };

  const abrirModalEditar = useCallback(async (evento) => {
    logDev("[ACTION] abrirModalEditar()", {
      incoming: { id: evento?.id ?? null, titulo: evento?.titulo },
      before: { modalAberto, eventoSelecionado: eventoSelecionado?.id ?? null },
    });

    setEventoSelecionado(evento);
    setModalAberto(true);

    setTimeout(() => {
      logDev("[AFTER] abrirModalEditar tick", { modalAberto: true, modalRoot: snapshotModalRoot() });
    }, 0);

    abortEditRef.current?.abort?.("new-edit");
    const ctrl = new AbortController();
    abortEditRef.current = ctrl;

    try {
      let turmas = Array.isArray(evento.turmas) ? evento.turmas : [];
      logDev("[EDIT] turmas iniciais", { len: turmas?.length ?? 0 });

      if ((!turmas || turmas.length === 0) && evento?.id) {
        logDev("[EDIT] buscando turmas do evento...", { id: evento.id });
        turmas = await fetchTurmasDoEvento(evento.id);
        logDev("[EDIT] turmas carregadas", { len: turmas?.length ?? 0 });
      }

      logDev("[EDIT] buscando evento completo...", { id: evento?.id });
      const base = (await fetchEventoCompleto(evento.id)) || evento;
      logDev("[EDIT] evento completo ok", { id: base?.id ?? null });

      const combinado = { ...evento, ...base, turmas };
      if (!mountedRef.current || ctrl.signal.aborted) {
        warnDev("[EDIT] abortado/unmounted", { aborted: ctrl.signal.aborted, mounted: mountedRef.current });
        return;
      }

      setEventoSelecionado(combinado);
      logDev("[EDIT] setEventoSelecionado(combinado)", { id: combinado?.id ?? null, turmas: combinado?.turmas?.length ?? 0 });
    } catch (e) {

      if (e?.name === "AbortError") return;
      warnDev("[abrirModalEditar] falha ao refinar:", e?.message || e);
    }
  }, []);

  /* -------- EXCLUIR -------- */
  const pedirExclusao = (ev) => {
    if (!ev?.id) return;
    setConfirmDelete({ id: Number(ev.id), titulo: ev.titulo || "Evento" });
  };

  const confirmarExclusao = async () => {
    const alvo = confirmDelete;
    setConfirmDelete(null);
    if (!alvo?.id) return;

    try {
      await apiDelete(`/api/eventos/${alvo.id}`);
      toast.success("✅ Evento excluído.");
      await recarregarEventos();
    } catch (err) {
      console.error("delete evento erro:", err);
      toast.error(`❌ ${err?.message || "Erro ao excluir evento."}`);
    }
  };

  /* -------- publicar/despublicar -------- */
  const pedirTogglePublicacao = (ev) => {
    if (!ev?.id) return;
    setConfirmPublish({
      id: Number(ev.id),
      titulo: ev.titulo || "Evento",
      publicadoAtual: !!ev.publicado,
    });
  };

  const confirmarTogglePublicacao = async () => {
    const alvo = confirmPublish;
    setConfirmPublish(null);
    if (!alvo?.id) return;

    const id = alvo.id;
    const publicado = alvo.publicadoAtual;
    const acao = publicado ? "despublicar" : "publicar";

    setPublishingId(id);
    setEventos((prev) => prev.map((e) => (Number(e.id) === id ? { ...e, publicado: !publicado } : e)));

    try {
      await apiPost(`/api/eventos/${id}/${acao}`, {});
      toast.success(publicado ? "Evento despublicado." : "Evento publicado.");
    } catch (e) {
      setEventos((prev) => prev.map((ev) => (Number(ev.id) === id ? { ...ev, publicado } : ev)));
      toast.error(`❌ ${e?.message || "Falha ao alterar publicação."}`);
    } finally {
      setPublishingId(null);
    }
  };

  function validarTurmasComInstrutores(turmasNorm) {
    for (const t of turmasNorm) {
      const instrs = Array.isArray(t.instrutores) ? t.instrutores : [];
      const assinante = Number.isFinite(Number(t.assinante_id))
        ? Number(t.assinante_id)
        : Number(t.instrutor_assinante_id);
      if (Number.isFinite(assinante) && !instrs.includes(assinante)) {
        return `O assinante selecionado na turma "${t.nome}" precisa estar entre os instrutores da turma.`;
      }
    }
    return null;
  }

  const salvarEvento = async (dadosDoModal) => {
    try {
      setSalvando(true);
      const isEdicao = Boolean(eventoSelecionado?.id);

      if (isEdicao) {
        let baseServidor = await fetchEventoCompleto(eventoSelecionado.id);

        if (!baseServidor) {
          const turmasDoEvento =
            Array.isArray(eventoSelecionado?.turmas) && eventoSelecionado.turmas.length
              ? eventoSelecionado.turmas
              : await fetchTurmasDoEvento(eventoSelecionado.id);

          baseServidor = {
            ...eventoSelecionado,
            turmas: turmasDoEvento,
            titulo: eventoSelecionado?.titulo || "",
            descricao: eventoSelecionado?.descricao || "",
            local: eventoSelecionado?.local || "",
            tipo: eventoSelecionado?.tipo || "",
            unidade_id: eventoSelecionado?.unidade_id,
            publico_alvo: eventoSelecionado?.publico_alvo || "",
            restrito: Boolean(eventoSelecionado?.restrito),
            restrito_modo: eventoSelecionado?.restrito_modo || null,
            cargos_permitidos: eventoSelecionado?.cargos_permitidos || [],
            unidades_permitidas: eventoSelecionado?.unidades_permitidas || [],
          };
        }

        const body = buildUpdateBody(baseServidor, dadosDoModal);

        if (dadosDoModal?.remover_folder === true) body.remover_folder = true;
        if (dadosDoModal?.remover_programacao === true) body.remover_programacao = true;

        if (Array.isArray(body.turmas) && body.turmas.length > 0) {
          const msg = validarTurmasComInstrutores(body.turmas);
          if (msg) {
            toast.error(msg);
            return;
          }
        }

        await apiPut(`/api/eventos/${eventoSelecionado.id}`, body);

        if (dadosDoModal?.folderFile instanceof File) {
          await uploadFolder(eventoSelecionado.id, dadosDoModal.folderFile);
        }
        if (dadosDoModal?.programacaoFile instanceof File) {
          await uploadProgramacao(eventoSelecionado.id, dadosDoModal.programacaoFile);
        }

        await recarregarEventos();
        toast.success("✅ Evento salvo com sucesso.");

        const atualizado = await fetchEventoCompleto(eventoSelecionado.id);
        const turmasNovas = await fetchTurmasDoEvento(eventoSelecionado.id);
        setEventoSelecionado({ ...atualizado, turmas: turmasNovas });
        setModalAberto(false);
        return;
      }

      const base = {
        titulo: (dadosDoModal?.titulo || "").trim(),
        tipo: (dadosDoModal?.tipo || "").trim(),
        unidade_id: dadosDoModal?.unidade_id,
        descricao: (dadosDoModal?.descricao || "").trim(),
        local: (dadosDoModal?.local || "").trim(),
        publico_alvo: (dadosDoModal?.publico_alvo || "").trim(),
        ...(dadosDoModal?.pos_curso_tipo ? { pos_curso_tipo: String(dadosDoModal.pos_curso_tipo) } : {}),
      };

      const turmas =
        Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length
          ? normalizeTurmas(dadosDoModal.turmas)
          : normalizeTurmas([
              {
                nome: base.titulo || "Turma Única",
                data_inicio: ymd(dadosDoModal?.data_inicio),
                data_fim: ymd(dadosDoModal?.data_fim),
                horario_inicio: hhmm(dadosDoModal?.horario_inicio || "08:00"),
                horario_fim: hhmm(dadosDoModal?.horario_fim || "17:00"),
                vagas_total: 1,
                carga_horaria: 1,
                instrutores: extractIds(dadosDoModal?.instrutores) || [],
                assinante_id: Number(dadosDoModal?.instrutor_assinante_id ?? dadosDoModal?.assinante_id),
                instrutor_assinante_id: Number(dadosDoModal?.instrutor_assinante_id ?? dadosDoModal?.assinante_id),
              },
            ]);

      const msgTurma = validarTurmasComInstrutores(turmas);
      if (msgTurma) {
        toast.error(msgTurma);
        return;
      }

      const restrito = Boolean(dadosDoModal?.restrito);
      const restrito_modo = restrito ? dadosDoModal?.restrito_modo || "todos_servidores" : null;

      const regsFonte =
        (Array.isArray(dadosDoModal?.registros_permitidos) && dadosDoModal.registros_permitidos) ||
        (Array.isArray(dadosDoModal?.registros) && dadosDoModal.registros) ||
        [];

      const registros = restrito && restrito_modo === "lista_registros" ? normRegistros(regsFonte) : undefined;

      const cargos_permitidos =
        restrito && Array.isArray(dadosDoModal?.cargos_permitidos)
          ? extractStrs(dadosDoModal.cargos_permitidos)
          : undefined;

      const unidades_permitidas =
        restrito && Array.isArray(dadosDoModal?.unidades_permitidas)
          ? extractIds(dadosDoModal.unidades_permitidas)
          : undefined;

      const bodyCreate = clean({
        ...base,
        turmas,
        restrito,
        restrito_modo,
        registros_permitidos: registros,
        cargos_permitidos,
        unidades_permitidas,
      });

      const criado = await apiPost("/api/eventos", bodyCreate);
      const novoId = Number(criado?.id) || Number(criado?.evento?.id) || Number(criado?.dados?.id);

      if (novoId && dadosDoModal?.folderFile instanceof File) await uploadFolder(novoId, dadosDoModal.folderFile);
      if (novoId && dadosDoModal?.programacaoFile instanceof File) await uploadProgramacao(novoId, dadosDoModal.programacaoFile);

      await recarregarEventos();
      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
    } catch (err) {
      console.error("salvarEvento erro:", err?.message, err);
      if (err?.data) console.log("err.data:", err.data);
      toast.error(err?.message || "Erro ao salvar o evento.");
    } finally {
      setSalvando(false);
    }
  };

  const headerHint = useMemo(() => {
    if (loading) return "Carregando…";
    return `${eventos.length} evento(s)`;
  }, [loading, eventos.length]);

  // ✅ ministats (agora: total, publicados, rascunhos, andamento, 2025, 2026)
  const stats = useMemo(() => {
    const total = eventos.length;
    let publicados = 0;
    let rascunhos = 0;
    let em_andamento = 0;
    let ano2025 = 0;
    let ano2026 = 0;

    for (const ev of eventos) {
      if (ev?.publicado) publicados += 1;
      else rascunhos += 1;

      const st = deduzStatus(ev);
      if (st === "em_andamento") em_andamento += 1;

      const y = getEventYear(ev);
      if (y === 2025) ano2025 += 1;
      if (y === 2026) ano2026 += 1;
    }

    return { total, publicados, rascunhos, em_andamento, ano2025, ano2026 };
  }, [eventos]);

  // ✅ contagens para chips
  const countsByChip = useMemo(() => {
    let ativos = 0;
    let encerrados = 0;

    for (const ev of eventos) {
      const st = deduzStatus(ev);
      if (st === "encerrado") encerrados += 1;
      else ativos += 1; // programado + em_andamento + fallback
    }
    return { ativos, encerrados };
  }, [eventos]);

  // ✅ eventos filtrados (chips)
  const eventosFiltrados = useMemo(() => {
    if (filtroStatus === "encerrados") {
      return eventos.filter((ev) => deduzStatus(ev) === "encerrado");
    }
    return eventos.filter((ev) => deduzStatus(ev) !== "encerrado");
  }, [eventos, filtroStatus]);

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <ModalConfirmacao
        open={!!confirmDelete}
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir evento"
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Tem certeza que deseja excluir <span className="font-semibold">{confirmDelete?.titulo}</span>? Essa ação não pode ser desfeita.
        </p>
      </ModalConfirmacao>

      <ModalConfirmacao
        open={!!confirmPublish}
        isOpen={!!confirmPublish}
        onClose={() => setConfirmPublish(null)}
        onConfirm={confirmarTogglePublicacao}
        titulo={confirmPublish?.publicadoAtual ? "Ocultar evento" : "Publicar evento"}
        confirmarTexto={confirmPublish?.publicadoAtual ? "Ocultar" : "Publicar"}
        cancelarTexto="Cancelar"
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {confirmPublish?.publicadoAtual ? (
            <>
              Ocultar <span className="font-semibold">{confirmPublish?.titulo}</span>? Ele deixará de aparecer para os usuários.
            </>
          ) : (
            <>
              Publicar <span className="font-semibold">{confirmPublish?.titulo}</span>? Ele ficará visível para os usuários.
            </>
          )}
        </p>
      </ModalConfirmacao>

      <HeaderHero onCriar={abrirModalCriar} onAtualizar={recarregarEventos} atualizando={loading} hint={headerHint} />

      {loading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 dark:bg-emerald-950/30 z-40"
          role="progressbar"
          aria-label="Carregando dados"
        >
          <div className={`h-full bg-emerald-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <div id="conteudo" className="px-3 sm:px-4 py-6 max-w-6xl mx-auto w-full min-w-0">
        {!loading && (
          <section aria-label="Métricas dos eventos" className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <StatPill icon={CalendarCheck2} label="Total" value={stats.total} tone="zinc" />
              <StatPill icon={BadgeCheck} label="Publicados" value={stats.publicados} tone="indigo" />
              <StatPill icon={BadgeX} label="Rascunhos" value={stats.rascunhos} tone="zinc" />
              <StatPill icon={Sparkles} label="Andamento" value={stats.em_andamento} tone="amber" />
              <StatPill icon={CalendarDays} label="Eventos 2025" value={stats.ano2025} tone="sky" />
              <StatPill icon={CalendarDays} label="Eventos 2026" value={stats.ano2026} tone="emerald" />
            </div>
          </section>
        )}

        {/* ✅ CHIPS FILTRO (Ativos x Encerrados) */}
        {!loading && eventos.length > 0 && (
          <section aria-label="Filtros por status" className="mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
              </div>

              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Mostrando <span className="font-semibold">{eventosFiltrados.length}</span> de{" "}
                <span className="font-semibold">{eventos.length}</span>
              </div>
            </div>
          </section>
        )}

        {!!erro && !loading && (
          <div
            className="rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 mb-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-rose-800 dark:text-rose-200">Falha ao carregar eventos</p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 mt-1 break-words">{erro}</p>

                <SoftButton
                  type="button"
                  onClick={recarregarEventos}
                  className="mt-3 bg-white/80 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 hover:bg-white"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </SoftButton>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonEvento />
        ) : eventosFiltrados.length === 0 ? (
          <NenhumDado mensagem={filtroStatus === "encerrados" ? "Nenhum evento encerrado." : "Nenhum evento ativo."} />
        ) : (
          <ul className="space-y-4 sm:space-y-5">
            {eventosFiltrados.map((ev) => {
              const publicado = !!ev.publicado;
              const status = deduzStatus(ev);
              
              return (
                <motion.li
                  key={ev.id || ev.titulo}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden pointer-events-auto"
                >
                  <div className="h-1 bg-gradient-to-r from-emerald-500/80 via-teal-500/70 to-indigo-500/70" aria-hidden="true" />

                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
                    <div className="flex gap-4 min-w-0">
  <div className="shrink-0">
    <PosterThumb ev={ev} title={ev.titulo} />
  </div>

  <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white break-words">
                            {ev.titulo}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Chip tone={publicado ? "indigo" : "zinc"} title={publicado ? "Visível aos usuários" : "Oculto aos usuários"}>
                              {publicado ? <Eye className="w-3.5 h-3.5" aria-hidden="true" /> : <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />}
                              {publicado ? "Publicado" : "Rascunho"}
                            </Chip>

                            <Chip tone="zinc" title="Status calculado">
                              <span className={`w-2 h-2 rounded-full ${statusDotClass(status)}`} aria-hidden="true" />
                              {statusLabel(status)}
                            </Chip>

                            {ev?.restrito && (
                              <Chip tone="amber" title="Evento restrito">
                                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                                Restrito
                              </Chip>
                            )}
                          </div>

                          <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 space-y-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              {ev?.tipo && (
                                <span className="inline-flex items-center gap-1">
                                  <Sparkles className="w-4 h-4 opacity-70" />
                                  <span>
                                    Tipo: <span className="font-medium">{ev.tipo}</span>
                                  </span>
                                </span>
                              )}
                              {ev?.local && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-4 h-4 opacity-70" />
                                  <span className="break-words">
                                    Local: <span className="font-medium">{ev.local}</span>
                                  </span>
                                </span>
                              )}
                            </div>

                            {ev?.publico_alvo && (
                              <div className="break-words">
                                Público-alvo: <span className="font-medium">{ev.publico_alvo}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ✅ Botões com cor contida (premium) */}
                      <div className="relative z-10 pointer-events-auto flex flex-wrap gap-2 justify-end">
                        {/* Publicar/Ocultar */}
                        <SoftButton
                          type="button"
                          onClick={() => pedirTogglePublicacao(ev)}
                          disabled={publishingId === Number(ev.id)}
                          className={`border disabled:opacity-60
                            ${
                              publicado
                                ? "border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-200 bg-white dark:bg-zinc-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/25"
                                : "border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-200 bg-white dark:bg-zinc-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/25"
                            }`}
                          aria-label={publicado ? `Ocultar evento ${ev.titulo}` : `Publicar evento ${ev.titulo}`}
                          aria-pressed={publicado ? "true" : "false"}
                        >
                          {publishingId === Number(ev.id) ? (
                            <span className="animate-pulse">…</span>
                          ) : publicado ? (
                            <>
                              <EyeOff className="w-4 h-4" aria-hidden="true" /> Ocultar
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" aria-hidden="true" /> Publicar
                            </>
                          )}
                        </SoftButton>

                        {/* Editar */}
                        <SoftButton
  type="button"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[CLICK] Editar", { id: ev?.id, titulo: ev?.titulo, fn: typeof abrirModalEditar });
    abrirModalEditar?.(ev);
  }}
                          className="border border-sky-200 dark:border-sky-900/40 text-sky-700 dark:text-sky-200 bg-white dark:bg-zinc-950 hover:bg-sky-50 dark:hover:bg-sky-950/25"
                          aria-label={`Editar evento ${ev.titulo}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          Editar
                        </SoftButton>

                        {/* Excluir (perigo só no hover) */}
                        <SoftButton
                          type="button"
                          onClick={() => pedirExclusao(ev)}
                          className="border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-200 bg-white dark:bg-zinc-950 hover:bg-rose-50 dark:hover:bg-rose-950/25"
                          aria-label={`Excluir evento ${ev.titulo}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
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

      <ModalEvento
              isOpen={modalAberto}
              open={modalAberto} // ✅ compat
              onClose={() => {
                warnDev("[ACTION] ModalEvento onClose()", {
                  before: { modalAberto, eventoSelecionado: eventoSelecionado?.id ?? null },
                  modalRoot: snapshotModalRoot(),
                  activeEl: document?.activeElement?.tagName || null,
                });
                setModalAberto(false);
              }}
      
        onSalvar={salvarEvento}
        evento={eventoSelecionado}
        salvando={salvando}
        onTurmaRemovida={() => recarregarEventos()}
      />

      <Footer />
    </main>
  );
}
