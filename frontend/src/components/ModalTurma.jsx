/* eslint-disable no-console */
// 📁 src/components/ModalTurma.jsx — PREMIUM++ (A11y + ministats + fallback de lista + mobile-first)
// - Visual no padrão "plataforma top": HeaderHero gradiente + cards + chips + ministats
// - A11y: labelledBy/describedBy, SR-only, foco, esc/backdrop via Modal base
// - Compat: aceita isOpen OU open
// - Listas resilientes: usa `usuarios` do pai, mas faz fallback `/api/usuarios` se vier vazio
// - Filtro instrutores robusto (perfil string/array/obj) + fallback se filtro zerar
// - Datas SEM pulo de fuso: mantém YYYY-MM-DD como string

import { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import { CalendarDays, Clock, Hash, Type, PlusCircle, Trash2, Users, BadgeCheck, Sparkles, X, Copy } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiGet } from "../services/api";

/* ===================== Logger (DEV only, cirúrgico) ===================== */
const IS_DEV = (typeof import.meta !== "undefined" && import.meta?.env?.DEV) ? true : false;
const LOG_TAG = "[ModalTurma]";
const stamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const log = (msg, data) => {
  if (!IS_DEV) return;
  if (data !== undefined) console.log(`${stamp()} ${LOG_TAG} ${msg}`, data);
  else console.log(`${stamp()} ${LOG_TAG} ${msg}`);
};
const warn = (msg, data) => {
  if (!IS_DEV) return;
  if (data !== undefined) console.warn(`${stamp()} ${LOG_TAG} ${msg}`, data);
  else console.warn(`${stamp()} ${LOG_TAG} ${msg}`);
};

/* ===================== Helpers ===================== */
const NOME_TURMA_MAX = 200;

// ✅ normaliza resposta do apiGet para array (se vier {data: [...]}, {rows: [...]}, etc.)
function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;

  // formatos diretos
  if (Array.isArray(v.data)) return v.data;
  if (Array.isArray(v.rows)) return v.rows;
  if (Array.isArray(v.items)) return v.items;
  if (Array.isArray(v.results)) return v.results;
  if (Array.isArray(v.result)) return v.result;
  if (Array.isArray(v.usuarios)) return v.usuarios;

  // formatos aninhados (bem comuns)
  if (v.data && Array.isArray(v.data.rows)) return v.data.rows;
  if (v.data && Array.isArray(v.data.items)) return v.data.items;
  if (v.data && Array.isArray(v.data.results)) return v.data.results;
  if (v.result && Array.isArray(v.result.rows)) return v.result.rows;

  return [];
}

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

const parseHora = (val) => {
  if (typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";

  // "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const hh = String(Math.min(23, Math.max(0, parseInt(raw.slice(0, 2) || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(raw.slice(2, 4) || "0", 10)))).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // "8:0", "08:00", "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return "";
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};
const hhmm = (s, fb = "") => parseHora(s) || fb;

/** ✅ Mantém “YYYY-MM-DD” SEM deslocar fuso. */
const isoDay = (v) => {
  if (!v) return "";
  if (typeof v === "string") {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : "";
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
};

const brDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "—");

const calcularCargaHorariaTotal = (arr) => {
  let horas = 0;
  for (const e of arr) {
    const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
    const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
    const diffH = Math.max(0, (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60);
    horas += diffH >= 8 ? diffH - 1 : diffH; // almoço
  }
  return Math.round(horas);
};

const pickDatasArray = (t) => {
  if (!t) return null;
  const candidatos = [t.datas, t.encontros, t.datas_turma, t.datasReais].filter(Array.isArray);
  return candidatos.length ? candidatos[0] : null;
};

const datasParaEncontros = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");

  const arrDatas = pickDatasArray(t);
  if (!arrDatas) return null;

  const arr = arrDatas
    .map((d) => ({
      data: isoDay(d?.data || d),
      inicio: hhmm(d?.inicio ?? d?.horario_inicio, baseHi),
      fim: hhmm(d?.fim ?? d?.horario_fim, baseHf),
    }))
    .filter((x) => x.data);

  return arr.length ? arr : null;
};

const encontrosDoInitial = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");

  const conv = datasParaEncontros(t);
  if (conv) return conv;

  const di = isoDay(t?.data_inicio);
  const df = isoDay(t?.data_fim);

  if (di && df) {
    if (di === df) return [{ data: di, inicio: baseHi, fim: baseHf }];
    return [
      { data: di, inicio: baseHi, fim: baseHf },
      { data: df, inicio: baseHi, fim: baseHf },
    ];
  }
  if (di) return [{ data: di, inicio: baseHi, fim: baseHf }];
  return [{ data: "", inicio: "", fim: "" }];
};

const extractIds = (arr) =>
  Array.isArray(arr) ? arr.map((v) => Number(v?.id ?? v)).filter((n) => Number.isFinite(n)) : [];

// ✅ filtro ULTRA robusto: só instrutor/admin (string/array/obj + campos alternativos + flags)
function isInstrutorLike(u) {
  if (!u) return false;

  // 1) flags comuns (se existirem no seu backend)
  const boolTrue = (v) => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";
  if (boolTrue(u.is_admin) || boolTrue(u.admin) || boolTrue(u.administrador)) return true;
  if (boolTrue(u.is_instrutor) || boolTrue(u.instrutor)) return true;

  // 2) junta possíveis fontes de "perfil/role"
  const fontes = [
    u.perfil,
    u.perfis,
    u.roles,
    u.role,
    u.tipo,
    u.tipo_usuario,
    u.categoria,
    u.grupo,
    u.grupos,
    u.perfil_nome,
    u.perfilName,
  ];

  const flattenToText = (v) => {
    if (!v) return [];
    if (typeof v === "string") return [v];
    if (typeof v === "number") return [String(v)];
    if (Array.isArray(v)) return v.flatMap(flattenToText);
    if (typeof v === "object") {
      return [v.nome, v.name, v.tipo, v.value, v.label, v.codigo, v.sigla].filter(Boolean).map(String);
    }
    return [String(v)];
  };

  const texto = fontes.flatMap(flattenToText).join(" | ").toLowerCase();

  return (
    texto.includes("instrutor") ||
    texto.includes("palestrante") || // legado tolerante
    texto.includes("administrador") ||
    texto.includes("admin")
  );
}

/* ===================== Cache local (fallback) ===================== */
let cacheUsuariosFallback = null;

/* ===================== UI helpers ===================== */
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
    violet:
      "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800",
  };
  return (
    <span
      title={title}
      className={cx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border", map[tone] || map.zinc)}
    >
      {children}
    </span>
  );
}

function StatMini({ icon: Icon, label, value, tone = "zinc" }) {
  const map = {
    zinc: "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800",
    indigo: "bg-indigo-50/90 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/40",
    violet: "bg-violet-50/90 dark:bg-violet-950/20 border-violet-200/70 dark:border-violet-900/40",
    emerald: "bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40",
  };
  return (
    <div className={cx("rounded-2xl border p-3 shadow-sm", map[tone] || map.zinc)}>
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
    success: "bg-emerald-700 hover:bg-emerald-600 text-white focus:ring-emerald-500/60",
    info: "bg-indigo-700 hover:bg-indigo-600 text-white focus:ring-indigo-500/60",
    warning: "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-400/60",
    danger: "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-400/60",
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
      className={cx(
        "inline-flex items-center justify-center gap-2 font-extrabold shadow-sm",
        "transition active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        toneMap[tone] || toneMap.neutral,
        sizeMap[size] || sizeMap.md,
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ===================== Componente ===================== */
export default function ModalTurma({
  isOpen,
  open, // ✅ compat
  onClose,
  onSalvar,
  initialTurma = null,
  onExcluir,
  usuarios = [],
}) {
  const effectiveOpen = Boolean(open ?? isOpen);

  const uid = useId();
  const titleId = `modal-turma-title-${uid}`;
  const descId = `modal-turma-desc-${uid}`;

  // Estados do form
  const [nome, setNome] = useState("");
  const [vagasTotal, setVagasTotal] = useState("");
  const [encontros, setEncontros] = useState([{ data: "", inicio: "", fim: "" }]);

  const [instrutoresSel, setInstrutoresSel] = useState([""]);
  const [assinanteId, setAssinanteId] = useState("");

  // Lista resiliente
  const [usuariosLocal, setUsuariosLocal] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);

  // ✅ Rehidrata quando abre OU quando muda a turma mesmo aberto
  const lastHydratedKeyRef = useRef(null);
  const initialKey = String(initialTurma?.id ?? "new");

  // auto-resize do nome
  const refNome = useRef(null);
  const autosizeNome = useCallback(() => {
    const el = refNome.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  useEffect(() => {
    if (!effectiveOpen) {
      lastHydratedKeyRef.current = null;
      return;
    }
    if (lastHydratedKeyRef.current === initialKey) return;

    log("Hidratação do ModalTurma", { initialKey, initialTurma });

    setNome(initialTurma?.nome || "");
    setVagasTotal(initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : "");

    const encontrosInit = encontrosDoInitial(initialTurma);
    setEncontros(encontrosInit);

    const ids = extractIds(initialTurma?.instrutores);
    setInstrutoresSel(ids.length ? ids.map(String) : [""]);

    const assinante =
      Number.isFinite(Number(initialTurma?.assinante_id))
        ? String(initialTurma.assinante_id)
        : Number.isFinite(Number(initialTurma?.instrutor_assinante_id))
        ? String(initialTurma.instrutor_assinante_id)
        : "";
    setAssinanteId(assinante);

    lastHydratedKeyRef.current = initialKey;
    setTimeout(() => autosizeNome(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOpen, initialKey]);

  // ✅ fallback de usuários se vier vazio do pai
  useEffect(() => {
    let alive = true;
    if (!effectiveOpen) return;
  
    // ✅ se a lista do pai vier (mesmo vazia), não “gruda” em cache antigo
    if (Array.isArray(usuarios) && usuarios.length === 0) {
      cacheUsuariosFallback = null; // limpa cache ruim de sessão
    }

    // 1) prioridade: usuarios do pai
    if (Array.isArray(usuarios) && usuarios.length > 0) {
      setUsuariosLocal(usuarios);
      setUsuariosLoading(false);
      return;
    }

    // 2) cache local (boa UX)
    if (Array.isArray(cacheUsuariosFallback) && cacheUsuariosFallback.length > 0) {
      setUsuariosLocal(cacheUsuariosFallback);
      setUsuariosLoading(false);
      return;
    }

        // 3) fallback PREMIUM: lista já filtrada no backend (instrutor/admin)
        setUsuariosLoading(true);
    (async () => {
      try {
        // ✅ apiGet já roda com base "/api" no seu services/api
        const res = await apiGet("/eventos/instrutores/disponiveis");
        const arr = asArray(res);
            const sorted = arr
              .filter(Boolean)
              .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
    
            cacheUsuariosFallback = sorted;
            if (!alive) return;
    
            setUsuariosLocal(sorted);
            log("Fallback /api/eventos/instrutores/disponiveis ok", { total: sorted.length });
          } catch (e) {
            if (!alive) return;
    
            // ✅ último recurso (não travar UI): tenta /api/usuarios e filtra no front
            warn("Fallback instrutores falhou; tentando /api/usuarios como último recurso", e);
            try {
              // ✅ idem: sem "/api" aqui
              const res2 = await apiGet("/usuarios");
              const arr2 = asArray(res2);
              const sorted2 = arr2
                .filter(Boolean)
                // ✅ não filtra aqui — é último recurso pra não travar a UI
                .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
    
              cacheUsuariosFallback = sorted2;
              if (!alive) return;
    
              setUsuariosLocal(sorted2);
              log("Fallback último recurso /api/usuarios ok (filtrado)", { total: sorted2.length });
            } catch (e2) {
              if (!alive) return;
              warn("Fallback /api/usuarios (último recurso) falhou", e2);
              setUsuariosLocal([]);
            }
          } finally {
            if (alive) setUsuariosLoading(false);
          }
        })();
    

    return () => {
      alive = false;
    };
  }, [effectiveOpen, usuarios]);

  // se assinante sair da lista de instrutores, limpar
  useEffect(() => {
    const setIds = new Set(instrutoresSel.filter(Boolean).map(String));
    if (assinanteId && !setIds.has(String(assinanteId))) setAssinanteId("");
  }, [instrutoresSel, assinanteId]);

  useEffect(() => {
    autosizeNome();
  }, [nome, autosizeNome]);

  // Encontros (normalizados e ordenados)
  const encontrosOrdenados = useMemo(() => {
    return [...(encontros || [])]
      .map((e) => ({
        ...e,
        data: isoDay(e.data),
        inicio: hhmm(e.inicio, ""),
        fim: hhmm(e.fim, ""),
      }))
      .filter((e) => e.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  }, [encontros]);

  const data_inicio = encontrosOrdenados[0]?.data || null;
  const data_fim = encontrosOrdenados.at(-1)?.data || null;

  const cargaPreview = useMemo(
    () => calcularCargaHorariaTotal(encontrosOrdenados.filter((e) => e.data && e.inicio && e.fim)),
    [encontrosOrdenados]
  );

  /* ======= CRUD encontros ======= */
  const addEncontro = () => {
    const last = encontros[encontros.length - 1] || {};
    const novo = { data: "", inicio: hhmm(last.inicio, ""), fim: hhmm(last.fim, "") };
    setEncontros((prev) => [...prev, novo]);
  };

  const clonarUltimoHorario = () => {
    const last = encontros[encontros.length - 1] || {};
    setEncontros((prev) => [...prev, { data: "", inicio: hhmm(last.inicio, ""), fim: hhmm(last.fim, "") }]);
  };

  const removeEncontro = (idx) => {
    setEncontros((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const updateEncontro = (idx, field, value) => {
    setEncontros((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  /* ======= Instrutores / Assinante ======= */
  const instrutoresOpcao = useMemo(() => {
    const base = Array.isArray(usuariosLocal) ? usuariosLocal : [];
  
    // ✅ filtra instrutor/admin de forma robusta
    const filtrados = base.filter((u) => u && isInstrutorLike(u));
  
    // ✅ dedupe por id (evita “Alessandra” duplicada)
    const byId = new Map();
    for (const u of filtrados) {
      const idNum = Number(u?.id);
      if (!Number.isFinite(idNum)) continue;
      if (!byId.has(idNum)) byId.set(idNum, u);
    }
  
    return [...byId.values()].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [usuariosLocal]);

  const filtroZerou = useMemo(() => {
    const base = Array.isArray(usuariosLocal) ? usuariosLocal : [];
    // agora o backend já entrega filtrado; "zerou" = lista vazia
    return !usuariosLoading && base.length === 0;
  }, [usuariosLocal, usuariosLoading]);

  const getInstrutorDisponivel = (index) => {
    const selecionados = instrutoresSel.map(String);
    const atual = selecionados[index];
    return instrutoresOpcao.filter((i) => !selecionados.includes(String(i.id)) || String(i.id) === String(atual));
  };

  const handleSelecionarInstrutor = (index, valor) => {
    setInstrutoresSel((prev) => {
      const nova = [...prev];
      nova[index] = valor;
      return nova;
    });
  };

  const adicionarInstrutor = () => setInstrutoresSel((l) => [...l, ""]);

  const removerInstrutor = (index) => {
    setInstrutoresSel((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [""]; // mantém 1 slot
    });
  };

  const assinanteOpcao = useMemo(() => {
    const ids = new Set(instrutoresSel.filter(Boolean).map((x) => Number(x)));
    return instrutoresOpcao.filter((u) => ids.has(Number(u.id)));
  }, [instrutoresSel, instrutoresOpcao]);

  /* ======= validação/salvar ======= */
  const validar = () => {
    if (!nome.trim()) {
      toast.warning("Informe o nome da turma.");
      return false;
    }
    if (nome.length > NOME_TURMA_MAX) {
      toast.error(`O nome não pode exceder ${NOME_TURMA_MAX} caracteres.`);
      return false;
    }

    if (vagasTotal === "" || !Number.isFinite(Number(vagasTotal)) || Number(vagasTotal) <= 0) {
      toast.warning("Quantidade de vagas deve ser número ≥ 1.");
      return false;
    }

    if (!encontrosOrdenados.length) {
      toast.warning("Inclua pelo menos uma data de encontro.");
      return false;
    }

    for (let i = 0; i < encontrosOrdenados.length; i++) {
      const e = encontrosOrdenados[i];
      if (!e.data || !e.inicio || !e.fim) {
        toast.error(`Preencha data e horários do encontro #${i + 1}.`);
        return false;
      }
      const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
      const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
      if (h2 * 60 + (m2 || 0) <= h1 * 60 + (m1 || 0)) {
        toast.error(`Horários inválidos no encontro #${i + 1}.`);
        return false;
      }
    }

    const instrSel = instrutoresSel.map((v) => Number(String(v).trim())).filter((id) => Number.isFinite(id));
    if (instrSel.length === 0) {
      toast.error("Selecione ao menos um instrutor para a turma.");
      return false;
    }

    if (!assinanteId) {
      toast.error("Selecione o assinante da turma.");
      return false;
    }
    if (!instrSel.includes(Number(assinanteId))) {
      toast.error("O assinante precisa estar entre os instrutores selecionados.");
      return false;
    }

    return true;
  };

  const montarPayload = () => {
    const horario_inicio_base = hhmm(encontrosOrdenados[0]?.inicio, "08:00");
    const horario_fim_base = hhmm(encontrosOrdenados[0]?.fim, "17:00");

    const instrSel = instrutoresSel.map((v) => Number(String(v).trim())).filter((id) => Number.isFinite(id));

    return {
      ...(initialTurma?.id ? { id: initialTurma.id } : {}),
      nome: nome.trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria: calcularCargaHorariaTotal(encontrosOrdenados),
      data_inicio,
      data_fim,
      horario_inicio: horario_inicio_base,
      horario_fim: horario_fim_base,

      encontros: encontrosOrdenados.map((e) => ({
        data: e.data,
        inicio: hhmm(e.inicio, horario_inicio_base),
        fim: hhmm(e.fim, horario_fim_base),
      })),
      datas: encontrosOrdenados.map((e) => ({
        data: e.data,
        horario_inicio: hhmm(e.inicio, horario_inicio_base),
        horario_fim: hhmm(e.fim, horario_fim_base),
      })),

      instrutores: instrSel,
      assinante_id: Number(assinanteId),
      instrutor_assinante_id: Number(assinanteId),
    };
  };

  const handleSalvar = () => {
    if (!validar()) return;
    const payload = montarPayload();
    onSalvar?.(payload);
  };

  /* ===================== Render ===================== */
  return (
    <Modal
      isOpen={effectiveOpen}
      open={effectiveOpen} // ✅ compat extra
      onClose={() => onClose?.()}
      level={1}
      maxWidth="max-w-4xl"
      labelledBy={titleId}
      describedBy={descId}
      className="p-0 overflow-hidden"
    >
      <div className="grid grid-rows-[auto,1fr,auto] max-h-[92vh] rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl">
        {/* top bar */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />

        {/* HEADER HERO */}
        <div className="relative p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 -left-24 w-56 h-56 rounded-full bg-indigo-500/12 blur-2xl" />
            <div className="absolute -bottom-20 -right-24 w-64 h-64 rounded-full bg-fuchsia-500/12 blur-2xl" />
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                  <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                </span>
                <span className="truncate">{initialTurma?.id ? "Editar Turma" : "Nova Turma"}</span>
              </h2>

              <p id={descId} className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Defina nome, instrutores, encontros e vagas. A carga horária é estimada automaticamente.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Chip tone="indigo" title="Período">
                  <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> {brDate(data_inicio)} — {brDate(data_fim)}
                </Chip>

                <Chip tone="violet" title="Encontros">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {encontrosOrdenados.length || 0} encontro(s)
                </Chip>

                <Chip tone="emerald" title="Carga estimada">
                  <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" /> {cargaPreview ? `${cargaPreview}h` : "—"}
                </Chip>

                {usuariosLoading ? (
                  <Chip tone="amber" title="Carregando lista">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" /> Carregando lista…
                  </Chip>
                ) : filtroZerou ? (
                  <Chip tone="amber" title="Não foi possível identificar perfis; usando lista geral">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" /> Lista geral
                  </Chip>
                ) : (
                  <Chip tone="zinc" title="Instrutores filtrados">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" /> Instrutores
                  </Chip>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex items-center justify-center rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label="Fechar"
              title="Fechar"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Ministats */}
          <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatMini icon={CalendarDays} label="Início" value={brDate(data_inicio)} tone="indigo" />
            <StatMini icon={CalendarDays} label="Fim" value={brDate(data_fim)} tone="violet" />
            <StatMini icon={Clock} label="Encontros" value={encontrosOrdenados.length || 0} tone="zinc" />
            <StatMini icon={BadgeCheck} label="Carga" value={cargaPreview ? `${cargaPreview}h` : "—"} tone="emerald" />
          </div>
        </div>

        {/* BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSalvar();
            }}
            className="space-y-5"
            aria-labelledby={titleId}
            noValidate
          >
            {/* NOME */}
            <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                  <Type className="w-5 h-5 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                </span>
                <h3 className="text-base sm:text-lg font-extrabold">Nome da turma</h3>
              </div>

              <div className="relative">
                <textarea
                  ref={refNome}
                  data-initial-focus
                  value={nome}
                  onChange={(e) => setNome(e.target.value.slice(0, NOME_TURMA_MAX))}
                  placeholder="Ex.: Turma A — Urgência e Emergência"
                  maxLength={NOME_TURMA_MAX}
                  rows={2}
                  className="w-full px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  autoComplete="off"
                  aria-describedby={`nome-turma-help-${uid} nome-turma-count-${uid}`}
                />
                <div
                  id={`nome-turma-count-${uid}`}
                  className={cx(
                    "absolute right-3 top-3 text-xs",
                    nome.length >= NOME_TURMA_MAX * 0.9 ? "text-amber-600" : "text-zinc-500 dark:text-zinc-300"
                  )}
                >
                  {nome.length}/{NOME_TURMA_MAX}
                </div>
              </div>

              <p id={`nome-turma-help-${uid}`} className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                Máximo de {NOME_TURMA_MAX} caracteres.
              </p>
            </section>

            {/* INSTRUTORES */}
            <section className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                  <Users className="w-5 h-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold">Instrutores e assinante</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">O assinante precisa estar entre os instrutores selecionados.</p>
                </div>
              </div>

              {usuariosLoading ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/30 p-4 text-sm text-zinc-600 dark:text-zinc-300">
                  Carregando lista de usuários…
                </div>
              ) : instrutoresOpcao.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/30 p-4 text-sm text-zinc-600 dark:text-zinc-300">
                  Nenhum usuário encontrado para seleção.
                </div>
              ) : (
                <div className="space-y-3">
                  {instrutoresSel.map((valor, index) => (
                    <div key={`instrutor-${index}`} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <select
                        value={String(valor ?? "")}
                        onChange={(e) => handleSelecionarInstrutor(index, e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        required={index === 0}
                        aria-label={index === 0 ? "Instrutor principal" : `Instrutor adicional ${index}`}
                      >
                        <option value="">Selecione o instrutor</option>
                        {getInstrutorDisponivel(index).map((i) => (
                          <option key={i.id} value={String(i.id)}>
                            {i.nome}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        {index === 0 ? (
                          <ActionButton type="button" onClick={adicionarInstrutor} tone="info" size="sm">
                            <PlusCircle className="w-4 h-4" aria-hidden="true" />
                            Incluir outro
                          </ActionButton>
                        ) : (
                          <ActionButton type="button" onClick={() => removerInstrutor(index)} tone="danger" size="sm">
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Remover
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="mt-2">
                    <label className="text-sm font-extrabold">
                      Assinante do certificado <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={String(assinanteId || "")}
                      onChange={(e) => setAssinanteId(e.target.value)}
                      className="w-full mt-2 px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    >
                      <option value="">Selecione o assinante</option>
                      {assinanteOpcao.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.nome}
                        </option>
                      ))}
                    </select>

                    {instrutoresSel.filter(Boolean).length > 0 && assinanteOpcao.length === 0 && (
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                        Selecione ao menos um instrutor para liberar a lista de assinantes.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ENCONTROS */}
            <section className="space-y-3">
              <div className="flex items-start sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white">Encontros</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Informe <strong>data</strong> e <strong>horários</strong> de cada encontro.
                  </div>
                </div>

                <div className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  {encontrosOrdenados.length || 0} encontro(s)
                </div>
              </div>

              <div className="space-y-3">
                {encontros.map((e, idx) => {
                  const isFirst = idx === 0;
                  const canRemove = encontros.length > 1;

                  return (
                    <div
                      key={idx}
                      className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-sm overflow-hidden"
                    >
                      <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-violet-600" />

                      <div className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                              Encontro #{idx + 1}
                              {isFirst ? " • base" : ""}
                            </div>
                            <div className="text-[13px] text-slate-700 dark:text-slate-200">
                              {isoDay(e.data) ? brDate(isoDay(e.data)) : "Data não informada"}
                            </div>
                          </div>

                          {canRemove ? (
                            <button
                              type="button"
                              onClick={() => removeEncontro(idx)}
                              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-extrabold
                                         border border-rose-200 dark:border-rose-900/40
                                         bg-rose-50/80 dark:bg-rose-900/20
                                         text-rose-700 dark:text-rose-200
                                         hover:bg-rose-100 dark:hover:bg-rose-900/30
                                         focus:outline-none focus:ring-2 focus:ring-rose-500"
                              title="Remover este encontro"
                            >
                              <Trash2 size={16} aria-hidden="true" />
                              Remover
                              <span className="sr-only">encontro {idx + 1}</span>
                            </button>
                          ) : (
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-300">(mínimo 1)</div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          {/* Data */}
                          <div className="md:col-span-4">
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                              Data <span className="text-rose-600">*</span>
                            </label>
                            <div className="relative">
                              <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                              <input
                                type="date"
                                value={isoDay(e.data)}
                                onChange={(ev) => updateEncontro(idx, "data", ev.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10
                                           bg-white dark:bg-zinc-900 shadow-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                                aria-label={`Data do encontro ${idx + 1}`}
                              />
                            </div>
                          </div>

                          {/* Início */}
                          <div className="md:col-span-4">
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                              Início <span className="text-rose-600">*</span>
                            </label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                              <input
                                type="time"
                                value={hhmm(e.inicio, "")}
                                onChange={(ev) => updateEncontro(idx, "inicio", ev.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10
                                           bg-white dark:bg-zinc-900 shadow-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                                aria-label={`Horário de início do encontro ${idx + 1}`}
                              />
                            </div>
                          </div>

                          {/* Fim */}
                          <div className="md:col-span-4">
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                              Fim <span className="text-rose-600">*</span>
                            </label>
                            <div className="relative">
                              <Clock className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                              <input
                                type="time"
                                value={hhmm(e.fim, "")}
                                onChange={(ev) => updateEncontro(idx, "fim", ev.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10
                                           bg-white dark:bg-zinc-900 shadow-sm
                                           focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                                aria-label={`Horário de fim do encontro ${idx + 1}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-3 text-xs text-slate-700 dark:text-slate-200">
                          <strong>Dica:</strong> Para eventos longos, use “Adicionar data” e ajuste apenas o que mudar.
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={addEncontro}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5
                             bg-indigo-700 hover:bg-indigo-600 text-white font-extrabold shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusCircle size={16} aria-hidden="true" />
                  Adicionar data
                </button>

                <button
                  type="button"
                  onClick={clonarUltimoHorario}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5
                             bg-white/80 dark:bg-zinc-900/40 border border-black/10 dark:border-white/10
                             text-slate-900 dark:text-white font-extrabold shadow-sm
                             hover:bg-black/5 dark:hover:bg-white/5
                             focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  title="Clonar encontro (horários)"
                >
                  <Copy size={16} aria-hidden="true" />
                  Clonar (horários)
                </button>
              </div>
            </section>

            {/* VAGAS */}
            <section className="mt-1 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-3 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">Vagas</div>
                <div className="text-xs text-slate-600 dark:text-slate-300">mínimo: 1</div>
              </div>

              <div className="relative">
                <Hash className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                <input
                  type="number"
                  value={vagasTotal}
                  onChange={(e) => setVagasTotal(e.target.value)}
                  placeholder="Quantidade de vagas"
                  className="w-full pl-10 pr-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10
                             bg-white dark:bg-zinc-900 shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  min={1}
                  required
                  inputMode="numeric"
                  aria-label="Quantidade de vagas da turma"
                />
              </div>

              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">Esta informação é usada para controle de inscrições.</div>
            </section>
          </form>
        </div>

        {/* FOOTER STICKY */}
        <div className="mt-auto sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-black/10 dark:border-white/10 px-5 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-[1.5rem]">
              {initialTurma?.id && onExcluir ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5
                             bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-rose-500"
                  onClick={() => {
                    log("Clique em Excluir turma.", { turmaId: initialTurma?.id });
                    onExcluir();
                  }}
                  title="Excluir turma"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Excluir turma
                </button>
              ) : null}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <ActionButton type="button" onClick={() => onClose?.()} tone="neutral" size="md" aria-label="Cancelar">
                Cancelar
              </ActionButton>

              <ActionButton type="button" onClick={handleSalvar} tone="success" size="md" aria-label="Salvar turma">
                Salvar Turma
              </ActionButton>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-300">
            Campos obrigatórios: <strong>nome</strong>, <strong>instrutor(es)</strong>, <strong>assinante</strong>,{" "}
            <strong>encontros</strong> e <strong>vagas</strong>.
          </div>
        </div>
      </div>
    </Modal>
  );
}
