/* eslint-disable no-console */
// ✅ src/components/ModalEvento.jsx — PREMIUM++ (A11y + ministats + pós-curso (questionário/teste) + uploads seguros + compat open/isOpen)
// - Visual premium (header gradiente + cards + chips + ministats)
// - A11y: labelledBy/describedBy, SR-only, foco/esc
// - Compat: aceita `open` OU `isOpen` (resolve casos onde a página passa open)
// - Upload flags seguras: remover_folder / remover_programacao só quando existe algo a remover
// - Logger DEV only (sem spam)
// - ModalConfirmacao compat (open/isOpen)

import { useEffect, useMemo, useRef, useState, useTransition, useId, useCallback } from "react";
import { toast } from "react-toastify";
import {
  MapPin,
  FileText,
  Layers3,
  PlusCircle,
  Trash2,
  Lock,
  Unlock,
  X,
  Pencil,
  Users,
  Clock,
  CalendarDays,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  ShieldCheck,
  Info,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  HelpCircle,
  Building2,
  Save, // ✅ ação rápida "Salvar"
} from "lucide-react";

import Modal from "./Modal";
import ModalTurma from "./ModalTurma";
import ModalConfirmacao from "./ModalConfirmacao";
import { formatarDataBrasileira } from "../utils/dateTime";
import { apiGet, apiDelete } from "../services/api";
import { resolveAssetUrl, openAsset } from "../utils/assets";

/* ========================= Logger (DEV only) ========================= */
const IS_DEV =
  (typeof import.meta !== "undefined" && import.meta?.env?.MODE !== "production") ||
  (typeof process !== "undefined" && process?.env?.NODE_ENV !== "production");

function makeLogger(scope = "ModalEvento") {
  const tag = `[${scope}]`;
  const log = (...a) => IS_DEV && console.log(tag, ...a);
  const info = (...a) => IS_DEV && console.info(tag, ...a);
  const warn = (...a) => IS_DEV && console.warn(tag, ...a);
  const error = (...a) => IS_DEV && console.error(tag, ...a);
  const group = (label) => IS_DEV && console.groupCollapsed(`${tag} ${label}`);
  const groupEnd = () => IS_DEV && console.groupEnd();
  const time = (label) => IS_DEV && console.time(`${tag} ${label}`);
  const timeEnd = (label) => IS_DEV && console.timeEnd(`${tag} ${label}`);
  return { log, info, warn, error, group, groupEnd, time, timeEnd };
}
const L = makeLogger("ModalEvento");

/* ========================= Constantes / Utils ========================= */
const TIPOS_EVENTO = ["Congresso", "Curso", "Oficina", "Palestra", "Seminário", "Simpósio", "Outros"];

const MAX_IMG_MB = 5;
const MAX_PDF_MB = 10;

/* ========================= Pós-curso (novo) ========================= */
// ✅ Feedback do curso é SEMPRE obrigatório no sistema.
// Aqui o admin decide somente se haverá TESTE para liberar certificado.
const TESTE_DEFAULT = {
  titulo: "",
  descricao: "",
  nota_minima: 7, // 0..10
  tentativas: 1, // 1..10
  perguntas: [], // opcional (você pode evoluir depois)
};

const hh = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const minDate = (arr) => arr.map((d) => d.data).sort()[0];
const maxDate = (arr) => arr.map((d) => d.data).sort().slice(-1)[0];

function calcularCargaHorariaDatas(datas = []) {
  let total = 0;
  for (const d of datas) {
    const ini = hh(d.horario_inicio || "00:00");
    const fim = hh(d.horario_fim || "00:00");
    const [h1, m1] = ini.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    if (Number.isFinite(h1) && Number.isFinite(h2)) {
      const start = h1 * 60 + (Number.isFinite(m1) ? m1 : 0);
      const end = h2 * 60 + (Number.isFinite(m2) ? m2 : 0);
      const diff = Math.max(0, (end - start) / 60);
      total += diff >= 8 ? diff - 1 : diff; // pausa almoço
    }
  }
  return Math.round(total);
}

const normReg = (s) => String(s || "").replace(/\D/g, "");
const parseRegsBulk = (txt) => {
  const runs = String(txt || "").match(/\d+/g) || [];
  const out = [];
  for (const run of runs) {
    const clean = normReg(run);
    if (clean.length >= 6) {
      for (let i = 0; i + 6 <= clean.length; i++) {
        const slice = clean.slice(i, i + 6);
        if (/^\d{6}$/.test(slice)) out.push(slice);
      }
    }
  }
  return [...new Set(out)];
};

/* ========================= API helpers (normalização) ========================= */
function asArray(x) {
  // aceita: [] | {data: []} | {rows: []} | {items: []} | {result: []}
  if (Array.isArray(x)) return x;
  if (!x || typeof x !== "object") return [];
  const candidates = [x.data, x.rows, x.items, x.result, x.results, x.unidades, x.usuarios];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function encontrosParaDatas(turma) {
  const baseHi = hh(turma.horario_inicio || turma.hora_inicio || "08:00");
  const baseHf = hh(turma.horario_fim || turma.hora_fim || "17:00");
  if (Array.isArray(turma?.datas) && turma.datas.length) return turma.datas;

  const enc = Array.isArray(turma?.encontros) ? turma.encontros : [];
  return enc
    .map((e) => {
      if (typeof e === "string") {
        const data = e.slice(0, 10);
        return data ? { data, horario_inicio: baseHi, horario_fim: baseHf } : null;
      }
      if (e && typeof e === "object") {
        const data = e.data?.slice(0, 10);
        const horario_inicio = hh(e.inicio || e.horario_inicio || baseHi);
        const horario_fim = hh(e.fim || e.horario_fim || baseHf);
        return data ? { data, horario_inicio, horario_fim } : null;
      }
      return null;
    })
    .filter(Boolean);
}

function normalizarDatasTurma(t, hiBase = "08:00", hfBase = "17:00") {
  const hi = hh(t.horario_inicio || t.hora_inicio || hiBase);
  const hf = hh(t.horario_fim || t.hora_fim || hfBase);

  const datasRaw = (Array.isArray(t.datas) && t.datas.length && t.datas) || encontrosParaDatas(t) || [];

  const datas = (datasRaw || [])
    .map((d) => {
      const data = (d?.data || d || "").slice(0, 10);
      const horario_inicio = hh(d?.horario_inicio || d?.inicio || hi);
      const horario_fim = hh(d?.horario_fim || d?.fim || hf);
      return data && horario_inicio && horario_fim ? { data, horario_inicio, horario_fim } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));

  return {
    datas,
    data_inicio: datas[0]?.data || t.data_inicio,
    data_fim: datas.at(-1)?.data || t.data_fim,
    horario_inicio: datas[0]?.horario_inicio || hi,
    horario_fim: datas[0]?.horario_fim || hf,
  };
}

const extractIds = (arr) =>
  Array.isArray(arr) ? arr.map((v) => Number(v?.id ?? v)).filter((n) => Number.isFinite(n)) : [];

function normalizarCargo(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function extrairCargoUsuario(u) {
  if (!u) return "";
  const candidatosBrutos = [
    u.cargo,
    u.cargo_nome,
    u.funcao,
    u.funcao_nome,
    u.ocupacao,
    u.profissao,
    u.role,
    u.cargoSigla,
    u.cargo_sigla,
    u?.cargo?.nome,
    u?.cargo?.descricao,
  ];
  const candidatos = candidatosBrutos.flatMap((c) => {
    if (!c) return [];
    if (Array.isArray(c)) return c.map((x) => String(x || ""));
    if (typeof c === "object") return [String(c.nome || c.descricao || c.titulo || "")];
    return [String(c)];
  });

  for (const c of candidatos) {
    const limpo = normalizarCargo(c);
    if (limpo) return limpo;
  }
  return "";
}

/* ========================= Cache simples ========================= */
let cacheUnidades = null;
let cacheUsuarios = null;

/* ========================= UI helpers ========================= */
function Chip({ tone = "zinc", children, title }) {
  const map = {
    zinc: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700",
    emerald:
      "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
    indigo:
      "bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:border-indigo-800",
    amber:
      "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
    rose:
      "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
  };
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${map[tone] || map.zinc}`}
    >
      {children}
    </span>
  );
}

function StatMini({ icon: Icon, label, value, tone = "zinc" }) {
  const map = {
    zinc: "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
    emerald: "bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40",
    indigo: "bg-indigo-50/90 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/40",
    amber: "bg-amber-50/90 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40",
    rose: "bg-rose-50/90 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40",
    violet: "bg-violet-50/90 dark:bg-violet-950/20 border-violet-200/70 dark:border-violet-900/40",
    sky: "bg-sky-50/90 dark:bg-sky-950/20 border-sky-200/70 dark:border-sky-900/40",
  };
  return (
    <div className={`rounded-2xl border ${map[tone] || map.zinc} p-3 shadow-sm`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{label}</div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

/* ========================= ActionButton (compat) ========================= */
// ✅ Suporta exatamente como você usa no arquivo: tone, size, children, disabled, aria-label etc.
function ActionButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  tone = "neutral", // neutral | success | info | danger | warning
  size = "md", // xs | sm | md
  ...rest
}) {
  const toneMap = {
    neutral:
      "bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 focus:ring-slate-400/60",
    success:
      "bg-emerald-700 hover:bg-emerald-600 text-white focus:ring-emerald-500/60",
    info:
      "bg-indigo-700 hover:bg-indigo-600 text-white focus:ring-indigo-500/60",
    warning:
      "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-400/60",
    danger:
      "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-400/60",
  };

  const sizeMap = {
    xs: "px-3 py-2 text-xs rounded-2xl",
    sm: "px-3.5 py-2 text-sm rounded-2xl",
    md: "px-4 py-2.5 text-sm rounded-2xl",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 font-extrabold shadow-sm",
        "transition active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        toneMap[tone] || toneMap.neutral,
        sizeMap[size] || sizeMap.md,
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

function ModalConfigTeste({ open, onClose, value, onSave }) {
  const [draft, setDraft] = useState(value || TESTE_DEFAULT);

  useEffect(() => {
    if (open) setDraft(value || TESTE_DEFAULT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setNum = (key, min, max) => (e) => {
    const n = Number(String(e.target.value || "").replace(",", "."));
    const safe = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
    setDraft((p) => ({ ...p, [key]: safe }));
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      align="center"
      padding
      labelledBy="cfg-teste-title"
      describedBy="cfg-teste-desc"
      closeOnBackdrop
      closeOnEscape
      zIndex={1300}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="cfg-teste-title" className="text-lg font-extrabold tracking-tight">
              Configurar teste obrigatório
            </h3>
            <p id="cfg-teste-desc" className="text-sm text-zinc-600 dark:text-zinc-300">
              O participante só libera certificado após: <strong>frequência ≥ 75%</strong> +{" "}
              <strong>avaliação (feedback)</strong> + <strong>teste aprovado</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10
                       bg-white/70 dark:bg-zinc-900/60 hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Fechar"
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              ×
            </span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 sm:col-span-2">
            <label className="text-sm font-extrabold">Título do teste</label>
            <input
              value={draft.titulo}
              onChange={(e) => setDraft((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex.: Avaliação de conhecimentos"
              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid gap-1 sm:col-span-2">
            <label className="text-sm font-extrabold">Descrição (opcional)</label>
            <textarea
              value={draft.descricao}
              onChange={(e) => setDraft((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Regras e observações do teste"
              className="w-full px-3 py-2.5 h-24 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-extrabold">Nota mínima</label>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={draft.nota_minima}
              onChange={setNum("nota_minima", 0, 10)}
              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Escala 0 a 10 (aceita decimal).</p>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-extrabold">Tentativas</label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={draft.tentativas}
              onChange={setNum("tentativas", 1, 10)}
              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Recomendado: 1 a 3.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-3">
          <div className="text-xs text-zinc-700 dark:text-zinc-200">
            <strong>Próximo passo:</strong> (quando você quiser) adicionamos editor de perguntas com
            múltipla escolha / V-F / dissertativa.
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700
                       text-slate-900 dark:text-slate-100 font-extrabold"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onSave?.(draft)}
            className="rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            Salvar configuração
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ========================= Componente ========================= */
export default function ModalEvento({
  isOpen,
  open, // ✅ compat
  onClose,
  onSalvar,
  evento,
  onTurmaRemovida,
  salvando = false,
}) {
  const effectiveOpen = Boolean(open ?? isOpen);

  const uid = useId();
  const titleId = `modal-evento-titulo-${uid}`;
  const descId = `modal-evento-desc-${uid}`;

  const dbgId = useRef(Math.random().toString(36).slice(2, 7)).current;
  const closeBlocked = salvando; // bloqueia fechar durante salvamento

  // ✅ logger de mount real
  useEffect(() => {
    L.info("MOUNT", { dbgId, eventoId: evento?.id ?? null });
    return () => L.info("UNMOUNT", { dbgId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Campos do evento
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  // ✅ TESTE (admin decide) — feedback do curso é sempre obrigatório e NÃO entra aqui
const [testeObrigatorio, setTesteObrigatorio] = useState(false);
const [testeConfig, setTesteConfig] = useState(TESTE_DEFAULT);
const [modalTesteAberto, setModalTesteAberto] = useState(false);

  // Auxiliares
  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Turmas
  const [turmas, setTurmas] = useState([]);
  const [editandoTurmaIndex, setEditandoTurmaIndex] = useState(null);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [removendoId, setRemovendoId] = useState(null);

  // ✅ Confirmação Premium
  const [confirm, setConfirm] = useState({
    open: false,
    turma: null,
    idx: null,
    title: "",
    description: "",
  });

  // Restrição
  const [restrito, setRestrito] = useState(false);
  const [restritoModo, setRestritoModo] = useState("");
  const [registroInput, setRegistroInput] = useState("");
  const [registros, setRegistros] = useState([]);

  // Filtros
  const [cargosPermitidos, setCargosPermitidos] = useState([]);
  const [cargoAdd, setCargoAdd] = useState("");
  const [fallbackCargos, setFallbackCargos] = useState([]);

  const [unidadesPermitidas, setUnidadesPermitidas] = useState([]);
  const [unidadeAddId, setUnidadeAddId] = useState("");

  // Uploads
  const [folderFile, setFolderFile] = useState(null);
  const [programacaoFile, setProgramacaoFile] = useState(null);
  const [folderPreview, setFolderPreview] = useState(null);

  // ✅ URLs existentes + flags de remoção (sem ambiguidade com "novo evento")
  const [folderUrlExistente, setFolderUrlExistente] = useState(undefined); // string | undefined
  const [programacaoUrlExistente, setProgramacaoUrlExistente] = useState(undefined);
  const [programacaoNomeExistente, setProgramacaoNomeExistente] = useState(undefined);

  const [removerFolderExistente, setRemoverFolderExistente] = useState(false);
  const [removerProgramacaoExistente, setRemoverProgramacaoExistente] = useState(false);

  // refs pra limpar input file
  const folderInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Controle
  const prevEventoKeyRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  /* ========= Carregamento paralelo + cache ========= */
useEffect(() => {
  let mounted = true;

  if (cacheUnidades) setUnidades(cacheUnidades);
  if (cacheUsuarios) setUsuarios(cacheUsuarios);
  if (cacheUnidades && cacheUsuarios) return () => {};

  (async () => {
    try {
      const [uRes, usrRes] = await Promise.allSettled([
        apiGet("/api/unidades"),
        apiGet("/api/usuarios"),
      ]);
      if (!mounted) return;

      if (uRes.status === "fulfilled") {
        const raw = asArray(uRes.value);
        const arr = raw
          .filter(Boolean)
          .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
        setUnidades(arr);
        cacheUnidades = arr;
        L.info("Unidades carregadas", { total: arr.length });
      } else {
        L.warn("Falha ao carregar unidades", uRes.reason);
      }

      if (usrRes.status === "fulfilled") {
        const raw = asArray(usrRes.value);
        const arr = raw.filter(Boolean);
        setUsuarios(arr);
        cacheUsuarios = arr;
        L.info("Usuários carregados", { total: arr.length });
      } else {
        L.warn("Falha ao carregar usuários", usrRes.reason);
      }
    } catch (e) {
      L.warn("bootstrap error", e);
    }
  })();

  return () => {
    mounted = false;
  };
}, []);

  /* ========= Reidratar ao abrir/trocar id ========= */
  useEffect(() => {
    if (!effectiveOpen) return;

    const curKey = evento?.id != null ? Number(evento.id) : "NEW";
    if (prevEventoKeyRef.current === curKey) return;

    startTransition(() => {
      // reset “sempre”
      setRegistroInput("");
      setCargoAdd("");
      setUnidadeAddId("");

      // uploads
      setFolderFile(null);
      setProgramacaoFile(null);
      setFolderPreview(null);
      setRemoverFolderExistente(false);
      setRemoverProgramacaoExistente(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (pdfInputRef.current) pdfInputRef.current.value = "";

      // confirmações pendentes: fecha ao trocar evento
      setConfirm((c) => ({ ...c, open: false, turma: null, idx: null }));

      if (!evento) {
        setTitulo("");
        setDescricao("");
        setLocal("");
        setTipo("");
        setUnidadeId("");
        setPublicoAlvo("");
        setTurmas([]);

        setRestrito(false);
        setRestritoModo("");
        setRegistros([]);
        setCargosPermitidos([]);
        setUnidadesPermitidas([]);

        setTesteObrigatorio(false);
setTesteConfig(TESTE_DEFAULT);
setModalTesteAberto(false);

        // ✅ novo evento: sem “existentes”
        setFolderUrlExistente(undefined);
        setProgramacaoUrlExistente(undefined);
        setProgramacaoNomeExistente(undefined);
      } else {
        setTitulo(evento.titulo || "");
        setDescricao(evento.descricao || "");
        setLocal(evento.local || "");
        setTipo(evento.tipo || "");
        setUnidadeId(evento.unidade_id ? String(evento.unidade_id) : "");
        setPublicoAlvo(evento.publico_alvo || "");

        // ✅ teste obrigatório (se backend mandar "teste", ativa; qualquer outro vira false)
const pc = String(evento.pos_curso_tipo || evento.posCursoTipo || "nenhum").toLowerCase();
setTesteObrigatorio(pc === "teste");

// opcional: se backend já mandar config do teste
if (evento?.teste_config && typeof evento.teste_config === "object") {
  setTesteConfig((prev) => ({ ...prev, ...evento.teste_config }));
} else {
  setTesteConfig(TESTE_DEFAULT);
}

        // ✅ existentes vindos do backend
setFolderUrlExistente(evento.folder_url || evento.folder || undefined);

// ✅ (NOVO) — linha anterior incluída acima
setProgramacaoUrlExistente(
  evento.programacao_pdf_url ||
  evento.programacao_url ||
  evento.programacao_pdf ||
  undefined
);

setProgramacaoNomeExistente(
  evento.programacao_nome || evento.programacao_pdf_nome || undefined
);

        // turmas (rota leve)
        (async () => {
          try {
            const resp = await apiGet(`/api/eventos/${evento.id}/turmas-simples`);
            const turmasBack = Array.isArray(resp) ? resp : [];
            const turmasNormalizadas = turmasBack.map((t) => {
              const n = normalizarDatasTurma(t);
              const cargaCalc = Number.isFinite(Number(t.carga_horaria))
                ? Number(t.carga_horaria)
                : calcularCargaHorariaDatas(n.datas);

              return {
                ...t,
                datas: n.datas,
                data_inicio: n.data_inicio,
                data_fim: n.data_fim,
                horario_inicio: n.horario_inicio,
                horario_fim: n.horario_fim,
                carga_horaria: Number.isFinite(cargaCalc) ? cargaCalc : 0,
                vagas_total: Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0,
              };
            });
            setTurmas(turmasNormalizadas);
          } catch (err) {
            L.warn("Falha ao carregar turmas-simples", err);
            setTurmas(evento.turmas || []);
          }
        })();

        // restrição
        const restr = !!evento.restrito;
        setRestrito(restr);

        let modo = evento.restrito_modo;
        if (!modo && restr) modo = evento.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        setRestritoModo(restr ? (modo || "todos_servidores") : "");

        const lista =
          (Array.isArray(evento.registros_permitidos) ? evento.registros_permitidos : null) ??
          (Array.isArray(evento.registros) ? evento.registros : []);
        const regs = [...new Set((lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r)))];
        setRegistros(regs);

        setCargosPermitidos(
          Array.isArray(evento.cargos_permitidos)
            ? [...new Set(evento.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]
            : []
        );

        setUnidadesPermitidas(Array.isArray(evento.unidades_permitidas) ? extractIds(evento.unidades_permitidas) : []);
      }
    });

    prevEventoKeyRef.current = curKey;
  }, [effectiveOpen, evento]);

  /* ========= GET fresh detalhe (sob demanda) ========= */
  useEffect(() => {
    if (!effectiveOpen || !evento?.id) return;
    if (registros.length > 0 && cargosPermitidos.length > 0 && unidadesPermitidas.length > 0) return;

    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);

        // ✅ teste obrigatório
const pc = String(det?.pos_curso_tipo || det?.posCursoTipo || "nenhum").toLowerCase();
setTesteObrigatorio(pc === "teste");

// opcional: config
if (det?.teste_config && typeof det.teste_config === "object") {
  setTesteConfig((prev) => ({ ...prev, ...det.teste_config }));
}


        if (typeof det.restrito === "boolean") setRestrito(!!det.restrito);

        let modo = det.restrito_modo;
        if (!modo && det.restrito) modo = det.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        setRestritoModo(det.restrito ? (modo || "todos_servidores") : "");

        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];

        const parsed = (lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r));
        if (parsed.length && registros.length === 0) setRegistros([...new Set(parsed)]);

        if (Array.isArray(det.cargos_permitidos) && cargosPermitidos.length === 0) {
          setCargosPermitidos([...new Set(det.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]);
        }
        if (Array.isArray(det.unidades_permitidas) && unidadesPermitidas.length === 0) {
          setUnidadesPermitidas(extractIds(det.unidades_permitidas));
        }
      } catch {
        // silencioso
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOpen, evento?.id, registros.length, cargosPermitidos.length, unidadesPermitidas.length]);

  /* ========= Sugestões de cargos (on demand) ========= */
  useEffect(() => {
    (async () => {
      if (restritoModo !== "cargos") return;
      if ((fallbackCargos || []).length > 0) return;

      try {
        const lista = await apiGet("/api/eventos/cargos/sugerir?limit=50");
        const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
        const norm = (Array.isArray(lista) ? lista : []).map(normalizarCargo).filter((s) => s && !jaUsados.has(s.toLowerCase()));
        setFallbackCargos(norm);
      } catch {
        // silencioso
      }
    })();
  }, [restritoModo, fallbackCargos, cargosPermitidos]);

  /* ========= Opções (memo) ========= */
  const cargosSugestoes = useMemo(() => {
    const dosUsuarios = (usuarios || []).map((u) => extrairCargoUsuario(u)).filter(Boolean);
    const todos = [...dosUsuarios, ...fallbackCargos].map(normalizarCargo).filter(Boolean);
    const setUnicos = new Set(todos);
    const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
    return [...setUnicos].filter((c) => !jaUsados.has(c.toLowerCase())).sort((a, b) => a.localeCompare(b));
  }, [usuarios, fallbackCargos, cargosPermitidos]);

  const opcaoInstrutor = useMemo(() => {
    return (usuarios || [])
      .filter((usuario) => {
        const perfil = (Array.isArray(usuario.perfil) ? usuario.perfil.join(",") : String(usuario.perfil || "")).toLowerCase();
        return perfil.includes("instrutor") || perfil.includes("administrador");
      })
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [usuarios]);

  const nomePorId = useCallback(
    (id) => {
      const u = (usuarios || []).find((x) => Number(x.id) === Number(id));
      return u?.nome || String(id);
    },
    [usuarios]
  );

  const unidadeNome = useMemo(() => {
    const u = unidades.find((x) => String(x.id) === String(unidadeId));
    return u?.nome || "";
  }, [unidades, unidadeId]);

  /* ================= Handlers de registros ================= */
  const addRegistro = () => {
    const novos = parseRegsBulk(registroInput);
    if (!novos.length) return toast.info("Informe/cole ao menos uma sequência de 6 dígitos.");
    setRegistros((prev) => Array.from(new Set([...(prev || []), ...novos])));
    setRegistroInput("");
  };

  const addRegistrosBulk = (txt) => {
    const novos = parseRegsBulk(txt);
    if (!novos.length) return toast.info("Nenhuma sequência de 6 dígitos encontrada.");
    setRegistros((prev) => Array.from(new Set([...(prev || []), ...novos])));
    setRegistroInput("");
  };

  const removeRegistro = (r) => setRegistros((prev) => prev.filter((x) => x !== r));

  /* ================= Filtros: Cargos e Unidades ================= */
  const addCargo = () => {
    const v = String(cargoAdd || "").trim();
    if (!v) return;
    setCargosPermitidos((prev) => (prev.some((x) => x.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
    setCargoAdd("");
  };
  const removeCargo = (v) => setCargosPermitidos((prev) => prev.filter((x) => x !== v));

  const addUnidade = () => {
    const id = Number(unidadeAddId);
    if (!Number.isFinite(id) || id <= 0) return;
    setUnidadesPermitidas((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUnidadeAddId("");
  };
  const removeUnidade = (id) => setUnidadesPermitidas((prev) => prev.filter((x) => x !== id));

  /* ================= Uploads ================= */
  const validaTamanho = (file, maxMb) => file.size / (1024 * 1024) <= maxMb;

  const onChangeFolder = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return toast.error("Envie uma imagem PNG ou JPG.");
    if (!validaTamanho(f, MAX_IMG_MB)) return toast.error(`Imagem muito grande. Máx. ${MAX_IMG_MB} MB.`);

    setFolderFile(f);
    setRemoverFolderExistente(false); // ✅ se selecionou novo, não remove “existente” sozinho
    const reader = new FileReader();
    reader.onload = () => setFolderPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const onChangeProgramacao = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") return toast.error("Envie um PDF válido.");
    if (!validaTamanho(f, MAX_PDF_MB)) return toast.error(`PDF muito grande. Máx. ${MAX_PDF_MB} MB.`);

    setProgramacaoFile(f);
    setRemoverProgramacaoExistente(false);
  };

  const limparFolder = () => {
    setFolderFile(null);
    setFolderPreview(null);
    if (folderInputRef.current) folderInputRef.current.value = "";
    // ✅ só marca remoção se houver existente
    if (folderUrlExistente) setRemoverFolderExistente(true);
  };

  const limparProgramacao = () => {
    setProgramacaoFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (programacaoUrlExistente) setRemoverProgramacaoExistente(true);
  };

  /* ================= Turma: criar / editar / remover ================= */
  function abrirCriarTurma() {
    setEditandoTurmaIndex(null);
    setModalTurmaAberto(true);
  }
  function abrirEditarTurma(idx) {
    setEditandoTurmaIndex(idx);
    setModalTurmaAberto(true);
  }

  async function executarRemocaoTurma(turma, idx) {
    const nome = turma?.nome || `Turma ${idx + 1}`;

    if (!turma?.id) {
      setTurmas((prev) => prev.filter((_, i) => i !== idx));
      toast.info("Turma removida (rascunho).");
      return;
    }

    try {
      setRemovendoId(turma.id);
      await apiDelete(`/api/turmas/${turma.id}`);
      setTurmas((prev) => prev.filter((t) => t.id !== turma.id));
      toast.success(`Turma "${nome}" removida com sucesso.`);
      onTurmaRemovida?.(turma.id);
    } catch (err) {
      const code = err?.data?.erro;
      if (err?.status === 409 || code === "TURMA_COM_REGISTROS") {
        const c = err?.data?.contagens || {};
        toast.error(`Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`);
      } else if (err?.status === 404) {
        toast.warn("Turma não encontrada. Atualize a página.");
      } else {
        toast.error("Erro ao remover turma.");
      }
    } finally {
      setRemovendoId(null);
    }
  }

  function solicitarConfirmacaoRemoverTurma(turma, idx) {
    const nome = turma?.nome || `Turma ${idx + 1}`;

    setConfirm({
      open: true,
      turma,
      idx,
      title: `Remover a turma "${nome}"?`,
      description:
        "Esta ação não pode ser desfeita.\n\nSe houver presenças ou certificados vinculados, a exclusão será bloqueada automaticamente.",
    });
  }

  /* ================= Ministats (evento) ================= */
  const stats = useMemo(() => {
    const ts = Array.isArray(turmas) ? turmas : [];
    let encontros = 0;
    let carga = 0;

    for (const t of ts) {
      const baseDatas = Array.isArray(t.datas) && t.datas.length ? t.datas : encontrosParaDatas(t);
      encontros += Array.isArray(baseDatas) ? baseDatas.length : 0;

      const n = normalizarDatasTurma(t);
      const ch = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : calcularCargaHorariaDatas(n.datas);
      carga += Number.isFinite(ch) ? ch : 0;
    }

    const temFolder = Boolean(folderFile || folderPreview || (folderUrlExistente && !removerFolderExistente));
    const temPdf = Boolean(programacaoFile || (programacaoUrlExistente && !removerProgramacaoExistente));

    return {
      turmas: ts.length,
      encontros,
      cargaTotal: carga,
      restrito: Boolean(restrito),
      anexos: `${temFolder ? 1 : 0} img • ${temPdf ? 1 : 0} pdf`,
    };
  }, [
    turmas,
    restrito,
    folderFile,
    folderPreview,
    folderUrlExistente,
    removerFolderExistente,
    programacaoFile,
    programacaoUrlExistente,
    removerProgramacaoExistente,
  ]);

  /* ================= Submit do formulário ================= */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (salvando) return;

    // Validações de topo
    if (!titulo || !tipo || !unidadeId || !local) {
      toast.warning("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }
    if (!TIPOS_EVENTO.includes(tipo)) {
      toast.error("❌ Tipo de evento inválido.");
      return;
    }
    if (!turmas.length) {
      toast.warning("⚠️ Adicione pelo menos uma turma.");
      return;
    }

    // ✅ (NOVO) teste obrigatório precisa de config mínima
    if (testeObrigatorio) {
      const nm = Number(testeConfig?.nota_minima);
      const tt = Number(testeConfig?.tentativas);
      if (!testeConfig?.titulo?.trim()) {
        toast.error("❌ Configure o teste: informe um título.");
        return;
      }
      if (!Number.isFinite(nm) || nm < 0 || nm > 10) {
        toast.error("❌ Configure o teste: nota mínima inválida (0 a 10).");
        return;
      }
      if (!Number.isFinite(tt) || tt < 1 || tt > 10) {
        toast.error("❌ Configure o teste: tentativas inválidas (1 a 10).");
        return;
      }
    }

    // Validações por turma
    for (const t of turmas) {
      if (!t.nome || !Number(t.vagas_total) || !Number.isFinite(Number(t.carga_horaria))) {
        toast.error("❌ Preencha nome, vagas e carga horária de cada turma.");
        return;
      }
      if (!Array.isArray(t.datas) || t.datas.length === 0) {
        toast.error("❌ Cada turma precisa ter ao menos uma data.");
        return;
      }
      for (const d of t.datas) {
        if (!d?.data || !d?.horario_inicio || !d?.horario_fim) {
          toast.error("❌ Preencha data, início e fim em todos os encontros.");
          return;
        }
      }
      const assinanteId = Number(t.instrutor_assinante_id ?? t.assinante_id);
      if (Number.isFinite(assinanteId)) {
        const instrs = extractIds(t.instrutores || []);
        if (!instrs.includes(assinanteId)) {
          toast.error(`O assinante da turma "${t.nome}" precisa estar entre os instrutores dessa turma.`);
          return;
        }
      }
    }

    // Validações de restrição
    if (restrito) {
      const modosValidos = ["todos_servidores", "lista_registros", "cargos", "unidades"];
      if (!modosValidos.includes(restritoModo)) return toast.error("Defina o modo de restrição do evento.");
      if (restritoModo === "lista_registros" && registros.length === 0)
        return toast.error("Inclua pelo menos um registro (6 dígitos) para este evento.");
      if (restritoModo === "cargos" && cargosPermitidos.length === 0) return toast.error("Inclua ao menos um cargo permitido.");
      if (restritoModo === "unidades" && unidadesPermitidas.length === 0) return toast.error("Inclua ao menos uma unidade permitida.");
    }

    // Montagem turmas
    const turmasCompletas = turmas.map((t) => {
      const n = normalizarDatasTurma(t);
      return {
        ...(Number.isFinite(Number(t.id)) ? { id: Number(t.id) } : {}),
        nome: t.nome,
        vagas_total: Number(t.vagas_total) || 0,
        carga_horaria: Number(t.carga_horaria) || 0,
        datas: (n.datas || []).map((d) => ({
          data: d.data,
          horario_inicio: d.horario_inicio,
          horario_fim: d.horario_fim,
        })),
        ...(Array.isArray(t.instrutores) ? { instrutores: extractIds(t.instrutores) } : {}),
        ...(Number.isFinite(Number(t.instrutor_assinante_id))
          ? { instrutor_assinante_id: Number(t.instrutor_assinante_id) }
          : Number.isFinite(Number(t.assinante_id))
          ? { instrutor_assinante_id: Number(t.assinante_id) }
          : {}),
      };
    });

    const regs6 = Array.from(new Set(registros.filter((r) => /^\d{6}$/.test(r))));

    const payloadJson = {
      id: evento?.id,
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,

      // ✅ pós-curso
      pos_curso_tipo: testeObrigatorio ? "teste" : "nenhum",

      // ✅ (NOVO) só envia config se o teste estiver ativo
      ...(testeObrigatorio ? { teste_config: testeConfig } : {}),

      turmas: turmasCompletas,
      restrito: !!restrito,
      restrito_modo: restrito ? restritoModo || "todos_servidores" : null,
      ...(restrito && restritoModo === "lista_registros" && regs6.length > 0 ? { registros_permitidos: regs6 } : {}),
      ...(restrito && restritoModo === "cargos" && cargosPermitidos.length > 0 ? { cargos_permitidos: cargosPermitidos } : {}),
      ...(restrito && restritoModo === "unidades" && unidadesPermitidas.length > 0 ? { unidades_permitidas: unidadesPermitidas } : {}),
      ...(removerFolderExistente ? { remover_folder: true } : {}),
      ...(removerProgramacaoExistente ? { remover_programacao: true } : {}),
    };

    const payload = {
      ...payloadJson,
      folderFile: folderFile instanceof File ? folderFile : undefined,
      programacaoFile: programacaoFile instanceof File ? programacaoFile : undefined,
    };

    onSalvar(payload);
  };

  const regCount = registros.length;

  /* ========================= Navegação por seções ========================= */
  const scrollToSection = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    // funciona bem dentro do container com overflow-y
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const SECOES = useMemo(
    () => [
      { id: `sec-dados-${uid}`, label: "Dados" },
      { id: `sec-pos-${uid}`, label: "Pós-curso" },
      { id: `sec-vis-${uid}`, label: "Visibilidade" },
      { id: `sec-anexos-${uid}`, label: "Anexos" },
      { id: `sec-turmas-${uid}`, label: "Turmas" },
    ],
    [uid]
  );

  /* ========================= Render Turmas (memo) ========================= */
  const turmasRender = useMemo(() => {
    return (turmas || []).map((t, i) => {
      const baseDatas = Array.isArray(t.datas) && t.datas.length ? t.datas : encontrosParaDatas(t);
      const qtd = Array.isArray(baseDatas) ? baseDatas.length : 0;
      const di = qtd ? minDate(baseDatas) : t.data_inicio;
      const df = qtd ? maxDate(baseDatas) : t.data_fim;
      const first = qtd ? baseDatas[0] : null;
      const hi = first ? hh(first.horario_inicio) : hh(t.horario_inicio);
      const hf = first ? hh(first.horario_fim) : hh(t.horario_fim);

      const instrs = extractIds(t.instrutores || []);
      const assinante = Number(t.instrutor_assinante_id ?? t.assinante_id);

      return (
        <div
          key={t.id ?? `temp-${i}`}
          className="rounded-2xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-zinc-50/90 to-white dark:from-zinc-800/70 dark:to-zinc-900/50 p-3 sm:p-4 text-sm shadow-sm hover:shadow transition-shadow"
        >
          <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 mb-3" />

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="font-extrabold text-slate-900 dark:text-white break-words leading-tight text-[15px] sm:text-base">
                {t.nome}
              </p>

              <div className="mt-1.5 flex flex-wrap gap-2">
                <Chip tone="zinc" title="Encontros">{qtd} encontro(s)</Chip>
                <Chip tone="indigo" title="Vagas">{Number(t.vagas_total) || 0} vagas</Chip>
                <Chip tone="emerald" title="Carga horária">{Number(t.carga_horaria) || 0}h</Chip>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
  <ActionButton
    type="button"
    onClick={() => abrirEditarTurma(i)}
    tone="info"
    size="xs"
    aria-label={`Editar turma ${t.nome}`}
  >
                <Pencil className="w-4 h-4" aria-hidden="true" />
                Editar
              </ActionButton>

              <ActionButton
                type="button"
                onClick={() => solicitarConfirmacaoRemoverTurma(t, i)}
                disabled={removendoId === t.id}
                tone="danger"
                size="xs"
                aria-label={`Remover turma ${t.nome}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {removendoId === t.id ? "Removendo…" : "Remover"}
              </ActionButton>
            </div>
          </div>

          <div className="mt-3 text-[13px] text-slate-700 dark:text-slate-200 space-y-2">
            <div className="flex flex-wrap gap-1 items-start">
              <CalendarDays size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
              <span>
                {formatarDataBrasileira(di)} a {formatarDataBrasileira(df)}
              </span>
            </div>

            {hi && hf && (
              <div className="flex flex-wrap gap-1 items-start">
                <Clock size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
                <span>
                  {hi} às {hf}
                </span>
              </div>
            )}

            {qtd > 0 && (
              <details className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-2">
                <summary className="cursor-pointer text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  Ver encontros
                </summary>
                <ul className="mt-2 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                  {baseDatas.map((d, idx) => (
                    <li key={`${t.id ?? i}-d-${idx}`} className="break-words">
                      {formatarDataBrasileira(d.data)} — {hh(d.horario_inicio)} às {hh(d.horario_fim)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {(instrs.length > 0 || Number.isFinite(assinante)) && (
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-2">
                {instrs.length > 0 && (
                  <div className="text-xs">
                    <span className="font-extrabold">Instrutores: </span>
                    <span>
                      {instrs.map((id, idx) => (
                        <span key={id}>
                          {nomePorId(id)}
                          {idx < instrs.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {Number.isFinite(assinante) && (
                  <div className="text-xs mt-1">
                    <span className="font-extrabold">Assinante: </span>
                    <span>{nomePorId(assinante)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    });
  }, [turmas, removendoId, nomePorId]);

  /* ========================= Render ========================= */
  return (
    <>
      <Modal
        isOpen={effectiveOpen}
        onClose={closeBlocked ? undefined : onClose}
        level={0}
        maxWidth="max-w-4xl"
        labelledBy={titleId}
        describedBy={descId}
        closeOnBackdrop={!closeBlocked}
        closeOnEsc={!closeBlocked}
      >
        <div className="grid grid-rows-[auto,1fr,auto] max-h-[92vh] rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl">
          {/* Top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-indigo-600 to-fuchsia-600" />

          {/* HEADER */}
          <div className="relative p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
          <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-16 -left-24 w-56 h-56 rounded-full bg-emerald-500/12 blur-2xl" />
              <div className="absolute -bottom-20 -right-24 w-64 h-64 rounded-full bg-teal-500/12 blur-2xl" />
            </div>

            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-lg sm:text-2xl font-extrabold tracking-tight flex items-center gap-2"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <span className="truncate">{evento?.id ? "Editar Evento" : "Novo Evento"}</span>
                </h2>

                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Configure dados, turmas, anexos e a avaliação pós-curso.
                </p>

                <p id={descId} className="sr-only">
                  Formulário para criação ou edição de evento, incluindo turmas, anexos e restrições de acesso.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {tipo ? (
                    <Chip tone="indigo" title="Tipo do evento">
                      <Layers3 className="w-3.5 h-3.5" aria-hidden="true" /> {tipo}
                    </Chip>
                  ) : (
                    <Chip tone="zinc" title="Tipo pendente">
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> Tipo pendente
                    </Chip>
                  )}

                  {unidadeNome ? (
                    <Chip tone="emerald" title="Unidade">
                      <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> {unidadeNome}
                    </Chip>
                  ) : (
                    <Chip tone="zinc" title="Unidade pendente">
                      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" /> Unidade pendente
                    </Chip>
                  )}

                  <Chip
                    tone={restrito ? "amber" : "zinc"}
                    title={restrito ? "Evento restrito" : "Evento público interno"}
                  >
                    {restrito ? <Lock className="w-3.5 h-3.5" aria-hidden="true" /> : <Unlock className="w-3.5 h-3.5" aria-hidden="true" />}
                    {restrito ? "Restrito" : "Padrão"}
                  </Chip>

                  <Chip tone="violet" title="Teste obrigatório">
  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
  {testeObrigatorio ? "Teste obrigatório" : "Sem teste"}
</Chip>
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end">
                {/* ✅ ações rápidas no topo (ótimo no mobile) */}
                <button
                  type="button"
                  onClick={closeBlocked ? undefined : onClose}
                  disabled={closeBlocked}
                  className="hidden sm:inline-flex rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  form={`form-evento-${uid}`}
                  disabled={salvando}
                  className={`hidden sm:inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-extrabold text-white ${
                    salvando
                      ? "bg-emerald-900 cursor-not-allowed"
                      : "bg-emerald-700 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  }`}
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  {salvando ? "Salvando..." : "Salvar"}
                </button>

                <button
                  type="button"
                  onClick={closeBlocked ? undefined : onClose}
                  disabled={closeBlocked}
                  className="inline-flex items-center justify-center rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  aria-label="Fechar"
                  title={closeBlocked ? "Aguarde o salvamento" : "Fechar"}
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Ministats */}
            <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2">
              <StatMini icon={Layers3} label="Turmas" value={stats.turmas} tone="zinc" />
              <StatMini icon={CalendarDays} label="Encontros" value={stats.encontros} tone="indigo" />
              <StatMini icon={Clock} label="Carga total" value={`${stats.cargaTotal}h`} tone="emerald" />
              <StatMini icon={Lock} label="Restrição" value={stats.restrito ? "Sim" : "Não"} tone={stats.restrito ? "amber" : "sky"} />
              <StatMini icon={Paperclip} label="Anexos" value={stats.anexos} tone="violet" />
            </div>

            {/* ✅ atalhos por seção (mobile-friendly, horizontal scroll) */}
            <div className="relative mt-4 flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
              {SECOES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>


          {/* BODY */}
          <div className="p-5 sm:p-6 overflow-y-auto">
            {isPending ? (
              <p className="text-center text-sm text-slate-500" role="status" aria-live="polite">
                Carregando…
              </p>
            ) : (
              <form
                id={`form-evento-${uid}`}
                onSubmit={handleSubmit}
                className="space-y-5"
                aria-labelledby={titleId}
                noValidate
              >
                {/* Bloco principal */}
                <section
                  id={`sec-dados-${uid}`}
                  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm scroll-mt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                      <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                    </span>
                    <h3 className="text-base sm:text-lg font-extrabold">Dados do Evento</h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* TÍTULO */}
                    <div className="grid gap-1 sm:col-span-2">
                      <label htmlFor={`evento-titulo-${uid}`} className="text-sm font-medium">
                        Título <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <input
                          id={`evento-titulo-${uid}`}
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                          placeholder="Ex.: Curso de Atualização em Urgência"
                          className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    {/* DESCRIÇÃO */}
                    <div className="grid gap-1 sm:col-span-2">
                      <label htmlFor={`evento-descricao-${uid}`} className="text-sm font-medium">
                        Descrição
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <textarea
                          id={`evento-descricao-${uid}`}
                          value={descricao}
                          onChange={(e) => setDescricao(e.target.value)}
                          placeholder="Contexto, objetivos e observações do evento."
                          className="w-full pl-10 pr-3 py-2.5 h-24 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* PÚBLICO-ALVO */}
                    <div className="grid gap-1 sm:col-span-2">
                      <label htmlFor={`evento-publico-${uid}`} className="text-sm font-medium">
                        Público-alvo
                      </label>
                      <div className="relative">
                        <Info className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <input
                          id={`evento-publico-${uid}`}
                          value={publicoAlvo}
                          onChange={(e) => setPublicoAlvo(e.target.value)}
                          placeholder="Ex.: Profissionais da APS, enfermeiros, médicos"
                          className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* LOCAL */}
                    <div className="grid gap-1">
                      <label htmlFor={`evento-local-${uid}`} className="text-sm font-medium">
                        Local <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <input
                          id={`evento-local-${uid}`}
                          value={local}
                          onChange={(e) => setLocal(e.target.value)}
                          placeholder="Ex.: Auditório da Escola da Saúde"
                          className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    {/* TIPO */}
                    <div className="grid gap-1">
                      <label htmlFor={`evento-tipo-${uid}`} className="text-sm font-medium">
                        Tipo <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <select
                          id={`evento-tipo-${uid}`}
                          value={String(tipo ?? "")}
                          onChange={(e) => setTipo(String(e.target.value))}
                          className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        >
                          <option value="">Selecione o tipo</option>
                          {TIPOS_EVENTO.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* UNIDADE */}
                    <div className="grid gap-1 sm:col-span-2">
                      <label htmlFor={`evento-unidade-${uid}`} className="text-sm font-medium">
                        Unidade <span className="text-rose-600">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                        <select
                          id={`evento-unidade-${uid}`}
                          value={String(unidadeId ?? "")}
                          onChange={(e) => setUnidadeId(String(e.target.value))}
                          className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          required
                        >
                          <option value="">Selecione a unidade</option>
                          {unidades.map((u) => (
                            <option key={u.id} value={String(u.id)}>
                              {u.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </section>

                {/* TESTE obrigatório */}
<section
  id={`sec-pos-${uid}`}
  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm scroll-mt-3"
>
  <div className="flex items-center gap-2 mb-3">
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
      <CheckCircle2 className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <h3 className="text-base sm:text-lg font-extrabold">Teste obrigatório</h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-300">
        A <strong>avaliação (feedback)</strong> do curso já é obrigatória em todos os eventos.
        Aqui você define apenas se haverá <strong>teste</strong> para liberar o certificado.
      </p>
    </div>
  </div>

  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/40 p-3">
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={testeObrigatorio}
        onChange={(e) => setTesteObrigatorio(e.target.checked)}
      />
      <div className="min-w-0">
        <div className="font-extrabold">Exigir teste para gerar certificado</div>
        <div className="text-xs text-zinc-600 dark:text-zinc-300">
          Quando ativado, o participante só libera o certificado após:
          <strong> frequência ≥ 75%</strong> + <strong>avaliação (feedback)</strong> +{" "}
          <strong>teste aprovado</strong>.
        </div>
      </div>
    </label>

    {testeObrigatorio && (
      <>
        {/* linha anterior ao trecho novo (acréscimo) */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-zinc-700 dark:text-zinc-200">
            <strong>Configuração:</strong>{" "}
            {testeConfig?.titulo ? (
              <>
                {testeConfig.titulo} • nota mín. {Number(testeConfig.nota_minima ?? 0)} •{" "}
                {Number(testeConfig.tentativas ?? 1)} tentativa(s)
              </>
            ) : (
              <>nenhum teste configurado ainda</>
            )}
          </div>

          <ActionButton
            type="button"
            onClick={() => setModalTesteAberto(true)}
            tone="info"
            size="sm"
            aria-label="Configurar teste obrigatório"
          >
            <ClipboardList className="w-4 h-4" aria-hidden="true" />
            Configurar teste
          </ActionButton>
        </div>

        <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-3 text-xs text-zinc-700 dark:text-zinc-200">
          <strong>Dica:</strong> Você pode configurar nota mínima e tentativas. (Editor de perguntas entra no próximo upgrade.)
        </div>
      </>
    )}
  </div>
</section>

                {/* 🔒 RESTRIÇÃO */}
                <section
                  id={`sec-vis-${uid}`}
                  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm scroll-mt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                      <Lock className="w-5 h-5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold">Visibilidade do evento</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        Controle quem pode ver/inscrever-se no evento (por registros, cargos ou unidades).
                      </p>
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={restrito}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRestrito(checked);
                        if (!checked) setRestritoModo("");
                        else if (!restritoModo) setRestritoModo("todos_servidores");
                      }}
                    />
                    <span className="font-medium">{restrito ? "Evento restrito" : "Evento padrão"}</span>
                  </label>

                  {restrito && (
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
                          value="todos_servidores"
                          checked={restritoModo === "todos_servidores"}
                          onChange={() => setRestritoModo("todos_servidores")}
                        />
                        <span>Todos os servidores (somente quem possui <strong>registro</strong> cadastrado)</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
                          value="lista_registros"
                          checked={restritoModo === "lista_registros"}
                          onChange={() => setRestritoModo("lista_registros")}
                        />
                        <span className="inline-flex items-center">
                          Apenas a lista específica de registros
                          {regCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                              {regCount}
                            </span>
                          )}
                        </span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
                          value="cargos"
                          checked={restritoModo === "cargos"}
                          onChange={() => setRestritoModo("cargos")}
                        />
                        <span>Restringir por cargos</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
                          value="unidades"
                          checked={restritoModo === "unidades"}
                          onChange={() => setRestritoModo("unidades")}
                        />
                        <span>Restringir por unidades</span>
                      </label>

                      {/* Sub-seções */}
                      {restritoModo === "lista_registros" && (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={registroInput}
                              onChange={(e) => setRegistroInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addRegistro();
                                }
                              }}
                              onPaste={(e) => {
                                const txt = e.clipboardData?.getData("text") || "";
                                if (!txt) return;
                                e.preventDefault();
                                addRegistrosBulk(txt);
                              }}
                              placeholder="Cole registros (extraímos blocos de 6 dígitos) e Enter"
                              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <ActionButton
  type="button"
  onClick={addRegistro}
  tone="success"
  aria-label="Adicionar registros à lista"
>
  <PlusCircle className="w-4 h-4" aria-hidden="true" />
  Adicionar
</ActionButton>
                          </div>

                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-xs text-slate-600 dark:text-slate-300">{regCount} registro(s) na lista</div>
                            {regCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setRegistros([])}
                                className="text-xs underline text-red-700 dark:text-red-300"
                                title="Limpar todos os registros"
                              >
                                Limpar todos
                              </button>
                            )}
                          </div>

                          {regCount > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {registros.map((r) => (
                                <span
                                  key={r}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
                                >
                                  {r}
                                  <button
                                    type="button"
                                    className="ml-1 text-red-600 dark:text-red-400"
                                    title="Remover"
                                    onClick={() => removeRegistro(r)}
                                    aria-label={`Remover registro ${r}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {restritoModo === "cargos" && (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={String(cargoAdd || "")}
                              onChange={(e) => setCargoAdd(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Selecione o cargo</option>
                              {cargosSugestoes.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={addCargo}
                              className="px-3 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                            >
                              Adicionar
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {cargosPermitidos.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
                              >
                                {c}
                                <button
                                  type="button"
                                  className="ml-1 text-red-600 dark:text-red-400"
                                  title="Remover"
                                  onClick={() => removeCargo(c)}
                                  aria-label={`Remover cargo ${c}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>

                          {cargosSugestoes.length === 0 && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">Sem sugestões no momento.</p>
                          )}
                        </div>
                      )}

                      {restritoModo === "unidades" && (
                        <div className="mt-3 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={String(unidadeAddId || "")}
                              onChange={(e) => setUnidadeAddId(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Selecione a unidade</option>
                              {unidades
                                .filter((u) => !unidadesPermitidas.includes(Number(u.id)))
                                .map((u) => (
                                  <option key={u.id} value={String(u.id)}>
                                    {u.nome}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={addUnidade}
                              className="px-3 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                            >
                              Adicionar
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {unidadesPermitidas.map((id) => {
                              const u = unidades.find((x) => Number(x.id) === Number(id));
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
                                >
                                  {u?.nome || `Unidade ${id}`}
                                  <button
                                    type="button"
                                    className="ml-1 text-red-600 dark:text-red-400"
                                    title="Remover"
                                    onClick={() => removeUnidade(id)}
                                    aria-label={`Remover unidade ${id}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {/* UPLOADS */}
                <section
                  id={`sec-anexos-${uid}`}
                  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm scroll-mt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                      <Paperclip className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold">Anexos</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">Folder (imagem) e Programação (PDF).</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Folder */}
                    <div className="grid gap-2">
                      <label className="text-sm font-extrabold flex items-center gap-2">
                        <ImageIcon size={16} /> Folder do evento (PNG/JPG)
                      </label>

                      {!folderFile && !!folderUrlExistente && !removerFolderExistente && (
  <div className="rounded-2xl border border-black/10 dark:border-white/10 p-2 bg-white/80 dark:bg-zinc-900/40">
    <img
      src={resolveAssetUrl(folderUrlExistente)}
      alt="Folder atual do evento"
      className="max-h-44 w-full object-cover rounded-xl border border-black/10 dark:border-white/10"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.src = "";
        e.currentTarget.alt = "Imagem indisponível";
      }}
    />

    <div className="mt-2 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => openAsset(folderUrlExistente)}
        className="text-xs underline text-emerald-700 dark:text-emerald-300"
      >
        Abrir imagem
      </button>

      <button
        type="button"
        onClick={limparFolder}
        className="text-xs underline text-red-700 dark:text-red-300"
        title="Remover imagem existente"
      >
        Remover
      </button>
    </div>
  </div>
)}

                      <label className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer hover:border-emerald-400/60 transition-colors">
                        <span className="inline-flex items-center gap-2">
                          <Paperclip size={16} />
                          <span className="text-sm">{folderFile ? folderFile.name : `Selecionar imagem… (máx. ${MAX_IMG_MB}MB)`}</span>
                        </span>
                        <Chip tone="zinc">PNG/JPG</Chip>
                        <input
                          ref={folderInputRef}
                          type="file"
                          accept="image/png,image/jpeg"
                          className="hidden"
                          onChange={onChangeFolder}
                          aria-label="Selecionar folder do evento"
                        />
                      </label>

                      {folderPreview && (
                        <div className="rounded-2xl border border-black/10 dark:border-white/10 p-2 bg-white/80 dark:bg-zinc-900/40">
                          <img
                            src={folderPreview}
                            alt="Pré-visualização do folder"
                            className="max-h-44 w-full object-cover rounded-xl border border-black/10 dark:border-white/10"
                          />
                          <div className="mt-2">
                            <button type="button" onClick={limparFolder} className="text-xs underline text-red-700 dark:text-red-300">
                              Remover imagem
                            </button>
                          </div>
                        </div>
                      )}

                      {removerFolderExistente && (
                        <p className="text-xs text-rose-700 dark:text-rose-300">✅ A imagem existente será removida ao salvar.</p>
                      )}
                    </div>

                    {/* Programação */}
                    <div className="grid gap-2">
                      <label className="text-sm font-extrabold flex items-center gap-2">
                        <FileIcon size={16} /> Programação (PDF)
                      </label>

                      {!programacaoFile && !!programacaoUrlExistente && !removerProgramacaoExistente && (
                        <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 bg-white/80 dark:bg-zinc-900/40 flex items-center justify-between gap-3">
                          <button
  type="button"
  onClick={() => openAsset(programacaoUrlExistente)}
  className="text-sm underline text-emerald-700 dark:text-emerald-300 break-words text-left"
>
  {programacaoNomeExistente || "Baixar programação (PDF)"}
</button>
                          <button
                            type="button"
                            onClick={limparProgramacao}
                            className="text-xs underline text-red-700 dark:text-red-300 whitespace-nowrap"
                            title="Remover PDF existente"
                          >
                            Remover
                          </button>
                        </div>
                      )}

                      <label className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer hover:border-emerald-400/60 transition-colors">
                        <span className="inline-flex items-center gap-2">
                          <Paperclip size={16} />
                          <span className="text-sm">{programacaoFile ? programacaoFile.name : `Selecionar PDF… (máx. ${MAX_PDF_MB}MB)`}</span>
                        </span>
                        <Chip tone="zinc">PDF</Chip>
                        <input
                          ref={pdfInputRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={onChangeProgramacao}
                          aria-label="Selecionar PDF de programação"
                        />
                      </label>

                      {programacaoFile && (
                        <div className="mt-1">
                          <button type="button" onClick={limparProgramacao} className="text-xs underline text-red-700 dark:text-red-300">
                            Remover PDF
                          </button>
                        </div>
                      )}

                      {removerProgramacaoExistente && (
                        <p className="text-xs text-rose-700 dark:text-rose-300">✅ O PDF existente será removido ao salvar.</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* TURMAS */}
                <section
                  id={`sec-turmas-${uid}`}
                  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm scroll-mt-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                      <Users className="w-5 h-5 text-sky-600 dark:text-sky-300" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold">Turmas</h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-300">
                        Turmas com encontros, instrutores e assinante por turma.
                      </p>
                    </div>
                  </div>

                  {turmas.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/30 p-4 text-sm text-zinc-600 dark:text-zinc-300">
                      Nenhuma turma cadastrada ainda.
                    </div>
                  ) : (
                    <div className="space-y-3">{turmasRender}</div>
                  )}

                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={abrirCriarTurma}
                      className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                      aria-label="Adicionar nova turma"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Adicionar Turma
                    </button>
                  </div>
                </section>
              </form>
            )}
          </div>

          {/* FOOTER */}
          <div className="p-4 sm:p-5 border-t border-black/5 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Campos obrigatórios: <strong>Título</strong>, <strong>Local</strong>, <strong>Tipo</strong>, <strong>Unidade</strong> e ao menos <strong>1 turma</strong>.
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeBlocked ? undefined : onClose}
                  disabled={closeBlocked}
                  className="rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  form={`form-evento-${uid}`}
                  disabled={salvando}
                  className={`rounded-2xl px-4 py-2.5 font-extrabold text-white ${
                    salvando
                      ? "bg-emerald-900 cursor-not-allowed"
                      : "bg-emerald-700 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  }`}
                >
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ✅ MODAL CONFIRMAÇÃO (compat open/isOpen) */}
      <ModalConfirmacao
        isOpen={!!confirm.open}
        open={!!confirm.open}
        title={confirm.title}
        description={confirm.description}
        confirmText="Sim, remover"
        cancelText="Cancelar"
        danger
        loading={Number.isFinite(Number(confirm?.turma?.id)) && removendoId === confirm?.turma?.id}
        onClose={() => {
          const emRemocao = Number.isFinite(Number(confirm?.turma?.id)) && removendoId === confirm?.turma?.id;
          if (emRemocao) return;
          setConfirm((c) => ({ ...c, open: false, turma: null, idx: null }));
        }}
        onConfirm={async () => {
          const turma = confirm.turma;
          const idx = confirm.idx;

          setConfirm((c) => ({ ...c, open: false }));

          if (!turma || idx == null) return;

          await executarRemocaoTurma(turma, idx);
          setConfirm((c) => ({ ...c, turma: null, idx: null }));
        }}
      />

      {/* MODAL TURMA */}
      <ModalTurma
        isOpen={modalTurmaAberto}
        open={modalTurmaAberto}
        onClose={() => setModalTurmaAberto(false)}
        initialTurma={editandoTurmaIndex != null ? turmas[editandoTurmaIndex] : null}
        usuarios={opcaoInstrutor}
        onSalvar={(turmaPayload) => {
          const normalizada = normalizarDatasTurma(turmaPayload);
          const turmaFinal = {
            ...turmaPayload,
            datas: normalizada.datas,
            data_inicio: normalizada.data_inicio,
            data_fim: normalizada.data_fim,
            horario_inicio: normalizada.horario_inicio,
            horario_fim: normalizada.horario_fim,
            vagas_total: Number(turmaPayload.vagas_total) || 0,
            carga_horaria: Number(turmaPayload.carga_horaria) || 0,
          };

          setTurmas((prev) => {
            if (editandoTurmaIndex != null) {
              const copia = [...prev];
              copia[editandoTurmaIndex] = turmaFinal;
              return copia;
            }
            return [...prev, turmaFinal];
          });

          setModalTurmaAberto(false);
          setEditandoTurmaIndex(null);
        }}
      />
    </>
  );
}
