/* eslint-disable no-console */
// ✅ src/components/eventos/ModalTurma.jsx — v2.1
// Atualizado em: 18/05/2026
// Plataforma Escola da Saúde
//
// Modal premium oficial de criação/edição de turma de evento.
//
// Contratos oficiais:
// - Pasta do domínio: src/components/eventos/
// - Modal base em src/components/ui/Modal
// - Prop oficial de abertura: open
// - Prop oficial de turma: turma
// - Prop oficial de organizadores recebidos do pai: organizadores
// - Sem isOpen como alias
// - Sem initialTurma como alias
// - Sem /eventos/organizadores/disponiveis
// - Endpoint oficial: /evento/organizador/disponivel
// - Sem roles/perfis/admin aliases no frontend
// - Sem exclusão direta de turma no modal
// - Remoção de turma é responsabilidade do ModalEvento/payload geral
// - Date-only trafega como YYYY-MM-DD
// - Horário de parede trafega como HH:mm
// - Sem fallback legado para assinante único
// - Sem fallback legado para encontros/datas_turma
// - Payload oficial:
//   {
//     id?,
//     nome,
//     vagas_total,
//     carga_horaria,
//     datas: [{ data, horario_inicio, horario_fim }],
//     organizadores: [id],
//     palestrantes: [{ nome, usuario_id? }],
//     assinantes: [id]
//   }
// - Organizador é obrigatório.
// - Palestrante é opcional e pode ser externo por nome.
// - Rafaella Pitol, ID 17, é assinante obrigatória.
// - Fábio Lopez, ID 2474, é assinante opcional e fica por último quando selecionado.
// - O backend normaliza a ordem final das assinaturas.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  ListChecks,
  Loader2,
  PlusCircle,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  UserCheck,
  Users,
  X,
  Mic2,
  PenLine,
  Signature,
} from "lucide-react";

import Modal from "../ui/Modal";
import { notifyError, notifyInfo, notifyWarning } from "../ui/AppToast";
import { apiGet } from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */

const IS_DEV = Boolean(import.meta?.env?.DEV);
const NOME_TURMA_MAX = 200;

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;
const MAX_ASSINANTES = 3;

const ASSINANTES_INSTITUCIONAIS = [
  {
    id: RAFAELLA_PITOL_ID,
    nome: "Rafaella Pitol Correa",
    email: "rafaellacorrea@santos.sp.gov.br",
    obrigatoria: true,
  },
  {
    id: FABIO_LOPEZ_ID,
    nome: "Fábio Lopez",
    email: "fabiolopez@santos.sp.gov.br",
    obrigatoria: false,
  },
];

let organizadoresCache = null;

/* ─────────────────────────────────────────────────────────────
   Logger
────────────────────────────────────────────────────────────── */

function logDev(...args) {
  if (IS_DEV) console.log("[ModalTurma]", ...args);
}

function warnDev(...args) {
  if (IS_DEV) console.warn("[ModalTurma]", ...args);
}

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function toPositiveIntOrNull(value) {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

function normalizeOrganizador(item) {
  const id = toPositiveIntOrNull(item?.id ?? item);

  if (!id) return null;

  return {
    id,
    nome: String(item?.nome || `Organizador ${id}`).trim(),
    email: item?.email || null,
  };
}

function uniqueOrganizadores(lista = []) {
  const map = new Map();

  for (const item of lista) {
    const normalized = normalizeOrganizador(item);
    if (!normalized) continue;

    if (!map.has(normalized.id)) {
      map.set(normalized.id, normalized);
    }
  }

  return [...map.values()].sort((a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
  );
}

function normalizeTime(value, fallback = "") {
  if (typeof value !== "string") return fallback;

  const raw = value.trim();

  if (!raw) return fallback;
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  return fallback;
}

function normalizeDateOnly(value) {
  if (!value) return "";

  if (typeof value === "string") {
    const s = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : "";
  }

  return "";
}

function formatDateBr(value) {
  const date = normalizeDateOnly(value);

  if (!date) return "—";

  const [ano, mes, dia] = date.split("-");
  return `${dia}/${mes}/${ano}`;
}

function extractIds(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            return item.usuario_id || item.id;
          }

          return item;
        })
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
}

function normalizarPalestrantesFrontend(value = []) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          nome: item.trim(),
          usuario_id: null,
        };
      }

      return {
        nome: String(item?.nome || "").trim(),
        usuario_id: toPositiveIntOrNull(item?.usuario_id || item?.id),
      };
    })
    .filter((item) => item.nome || item.usuario_id);
}

function normalizarAssinantesFrontend(value = []) {
  const ids = extractIds(value);
  const pediuFabio = ids.includes(FABIO_LOPEZ_ID);

  const extras = ids.filter(
    (id) => id !== RAFAELLA_PITOL_ID && id !== FABIO_LOPEZ_ID
  );

  const base = extras.slice(0, pediuFabio ? 1 : 2);

  if (pediuFabio) {
    return [...base, RAFAELLA_PITOL_ID, FABIO_LOPEZ_ID];
  }

  return [...base, RAFAELLA_PITOL_ID];
}

function montarOpcoesAssinantes({
  organizadoresSelecionadosIds = [],
  organizadoresLista = [],
}) {
  const map = new Map();

  for (const organizador of organizadoresLista || []) {
    const id = toPositiveIntOrNull(organizador?.id);

    if (!id) continue;

    if (organizadoresSelecionadosIds.includes(id)) {
      map.set(id, {
        id,
        nome: organizador.nome,
        email: organizador.email || null,
        origem: "organizador",
      });
    }
  }

  for (const institucional of ASSINANTES_INSTITUCIONAIS) {
    map.set(institucional.id, {
      ...institucional,
      origem: "institucional",
    });
  }

  return [...map.values()].sort((a, b) => {
    if (a.id === RAFAELLA_PITOL_ID) return 1;
    if (b.id === RAFAELLA_PITOL_ID) return -1;
    if (a.id === FABIO_LOPEZ_ID) return 1;
    if (b.id === FABIO_LOPEZ_ID) return -1;

    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

function labelAssinanteRegra(assinantesIds = []) {
  const ids = extractIds(assinantesIds);
  const temFabio = ids.includes(FABIO_LOPEZ_ID);

  if (temFabio) {
    return "Fábio Lopez ficará como última assinatura. Rafaella Pitol ficará imediatamente antes dele.";
  }

  return "Rafaella Pitol é obrigatória e ficará como última assinatura.";
}

function normalizeDatasFromTurma(turma = {}) {
  const baseInicio = normalizeTime(turma?.horario_inicio || "08:00", "08:00");
  const baseFim = normalizeTime(turma?.horario_fim || "17:00", "17:00");
  const datasArray = Array.isArray(turma?.datas) ? turma.datas : [];

  if (datasArray.length) {
    return datasArray
      .map((item) => ({
        data: normalizeDateOnly(item?.data),
        horario_inicio: normalizeTime(item?.horario_inicio || baseInicio, baseInicio),
        horario_fim: normalizeTime(item?.horario_fim || baseFim, baseFim),
      }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }

  return [
    {
      data: "",
      horario_inicio: "",
      horario_fim: "",
    },
  ];
}

function calcularCargaHoraria(datas = []) {
  let total = 0;

  for (const item of datas || []) {
    const inicio = normalizeTime(item?.horario_inicio || "00:00", "00:00");
    const fim = normalizeTime(item?.horario_fim || "00:00", "00:00");

    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);

    const minutosInicio = h1 * 60 + (Number.isFinite(m1) ? m1 : 0);
    const minutosFim = h2 * 60 + (Number.isFinite(m2) ? m2 : 0);

    const horas = Math.max(0, (minutosFim - minutosInicio) / 60);

    total += horas >= 8 ? horas - 1 : horas;
  }

  return Math.max(0, Math.round(total));
}

function getRangeDatas(datas = []) {
  const validas = (datas || [])
    .map((item) => normalizeDateOnly(item?.data))
    .filter(Boolean)
    .sort();

  return {
    data_inicio: validas[0] || null,
    data_fim: validas.at(-1) || null,
  };
}

function normalizeInitialTurma(turma = {}) {
  const datas = normalizeDatasFromTurma(turma);
  const organizadores = extractIds(turma?.organizadores || []);

  const palestrantes = Array.isArray(turma?.palestrantes)
    ? turma.palestrantes
        .map((item) => ({
          nome: String(item?.nome || "").trim(),
          usuario_id: toPositiveIntOrNull(item?.usuario_id),
        }))
        .filter((item) => item.nome || item.usuario_id)
    : [];

  const assinantes = extractIds(turma?.assinantes || []);
  const assinantesNormalizados = normalizarAssinantesFrontend(assinantes);

  const vagasRaw = Number(turma?.vagas_total);
  const vagasTotal =
    Number.isInteger(vagasRaw) && vagasRaw > 0 ? String(vagasRaw) : "";

  return {
    id: toPositiveIntOrNull(turma?.id),
    nome: String(turma?.nome || "").slice(0, NOME_TURMA_MAX),
    vagas_total: vagasTotal,
    datas,
    organizadores,
    palestrantes: palestrantes.length
      ? palestrantes
      : [{ nome: "", usuario_id: null }],
    assinantes: assinantesNormalizados.length
      ? assinantesNormalizados
      : [RAFAELLA_PITOL_ID],
  };
}

function buildPendencias({
  nome,
  vagasTotal,
  datasOrdenadasValidas,
  organizadoresSelecionadosIds,
  assinantesSelecionadosIds,
}) {
  const pendencias = [];

  if (!String(nome || "").trim()) pendencias.push("nome");

  if (!Number.isInteger(Number(vagasTotal)) || Number(vagasTotal) <= 0) {
    pendencias.push("vagas");
  }

  if (!datasOrdenadasValidas.length) {
    pendencias.push("datas");
  } else {
    const dataIncompleta = datasOrdenadasValidas.some(
      (item) => !item.data || !item.horario_inicio || !item.horario_fim
    );

    if (dataIncompleta) pendencias.push("datas incompletas");
  }

  if (!organizadoresSelecionadosIds.length) {
    pendencias.push("organizador obrigatório");
  }

  const assinantes = normalizarAssinantesFrontend(assinantesSelecionadosIds);

  if (!assinantes.includes(RAFAELLA_PITOL_ID)) {
    pendencias.push("assinatura obrigatória da Rafaella");
  }

  if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES) {
    pendencias.push("assinantes entre 1 e 3");
  }

  return pendencias;
}

/* ─────────────────────────────────────────────────────────────
   UI
────────────────────────────────────────────────────────────── */

function Chip({ tone = "zinc", children, title }) {
  const tones = {
    zinc:
      "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-700",
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
    sky:
      "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  };

  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black",
        tones[tone] || tones.zinc
      )}
    >
      {children}
    </span>
  );
}

function MetricTile({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc:
      "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100",
    sky:
      "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
  };

  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${tones[tone] || tones.zinc}`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-white/5">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide opacity-65">
            {label}
          </div>
          <div className="truncate text-sm font-black leading-tight">
            {value || "—"}
          </div>
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
  tone = "neutral",
  size = "md",
  ...props
}) {
  const toneMap = {
    neutral:
      "bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 focus:ring-slate-400/60",
    success:
      "bg-emerald-700 hover:bg-emerald-600 text-white focus:ring-emerald-500/60",
    info: "bg-indigo-700 hover:bg-indigo-600 text-white focus:ring-indigo-500/60",
    danger: "bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-400/60",
    ghost:
      "bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-800 focus:ring-zinc-400/60",
  };

  const sizeMap = {
    xs: "rounded-xl px-3 py-2 text-xs",
    sm: "rounded-2xl px-3.5 py-2 text-sm",
    md: "rounded-2xl px-4 py-2.5 text-sm",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-extrabold shadow-sm transition active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        toneMap[tone] || toneMap.neutral,
        sizeMap[size] || sizeMap.md,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black/5 dark:bg-white/5">
        <Icon
          className="h-5 w-5 text-indigo-700 dark:text-indigo-300"
          aria-hidden="true"
        />
      </span>

      <div className="min-w-0">
        <h3 className="text-base font-black leading-tight text-zinc-950 dark:text-white">
          {title}
        </h3>

        {subtitle && (
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Componente
────────────────────────────────────────────────────────────── */

export default function ModalTurma({
  open,
  onClose,
  onSalvar,
  turma = null,
  organizadores = [],
}) {
  const uid = useId();
  const titleId = `modal-turma-title-${uid}`;
  const descId = `modal-turma-desc-${uid}`;
  const formId = `modal-turma-form-${uid}`;

  const nomeRef = useRef(null);
  const lastHydratedKeyRef = useRef(null);

  const [nome, setNome] = useState("");
  const [vagasTotal, setVagasTotal] = useState("");
  const [datas, setDatas] = useState([
    {
      data: "",
      horario_inicio: "",
      horario_fim: "",
    },
  ]);

  const [organizadoresSel, setOrganizadoresSel] = useState([""]);
  const [palestrantes, setPalestrantes] = useState([
    {
      nome: "",
      usuario_id: null,
    },
  ]);
  const [assinantesSel, setAssinantesSel] = useState([RAFAELLA_PITOL_ID]);

  const [organizadoresLista, setOrganizadoresLista] = useState([]);
  const [loadingOrganizadores, setLoadingOrganizadores] = useState(false);

  const turmaKey = String(turma?.id ?? "nova");

  const autosizeNome = useCallback(() => {
    const el = nomeRef.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    if (!open) {
      lastHydratedKeyRef.current = null;
      return;
    }

    if (lastHydratedKeyRef.current === turmaKey) return;

    const normalized = normalizeInitialTurma(turma || {});

    setNome(normalized.nome);
    setVagasTotal(normalized.vagas_total);
    setDatas(normalized.datas);
    setOrganizadoresSel(
      normalized.organizadores.length ? normalized.organizadores.map(String) : [""]
    );
    setPalestrantes(
      normalized.palestrantes.length
        ? normalized.palestrantes
        : [{ nome: "", usuario_id: null }]
    );
    setAssinantesSel(
      normalized.assinantes.length ? normalized.assinantes : [RAFAELLA_PITOL_ID]
    );

    lastHydratedKeyRef.current = turmaKey;

    window.setTimeout(() => autosizeNome(), 0);

    logDev("ModalTurma hidratado.", {
      turmaKey,
      turma: normalized,
    });
  }, [autosizeNome, open, turma, turmaKey]);

  useEffect(() => {
    autosizeNome();
  }, [autosizeNome, nome]);

  useEffect(() => {
    if (!open) return undefined;

    let alive = true;

    async function carregarOrganizadores() {
      const listaDoPai = uniqueOrganizadores(
        Array.isArray(organizadores) ? organizadores : []
      );

      if (listaDoPai.length) {
        setOrganizadoresLista(listaDoPai);
        return;
      }

      if (organizadoresCache?.length) {
        setOrganizadoresLista(organizadoresCache);
        return;
      }

      try {
        setLoadingOrganizadores(true);

        const response = await apiGet("/evento/organizador/disponivel", {
          auth: true,
          on401: "redirect",
          on403: "silent",
        });

        const lista = uniqueOrganizadores(asArray(response));

        organizadoresCache = lista;

        if (!alive) return;

        setOrganizadoresLista(lista);

        logDev("Organizadores carregados pelo endpoint oficial.", {
          total: lista.length,
        });
      } catch (error) {
        warnDev("Falha ao carregar organizadores disponíveis.", error);

        if (!alive) return;

        setOrganizadoresLista([]);
        notifyWarning("Não foi possível carregar os organizadores disponíveis.");
      } finally {
        if (alive) {
          setLoadingOrganizadores(false);
        }
      }
    }

    carregarOrganizadores();

    return () => {
      alive = false;
    };
  }, [open, organizadores]);

  const datasOrdenadasValidas = useMemo(() => {
    return (datas || [])
      .map((item) => ({
        data: normalizeDateOnly(item?.data),
        horario_inicio: normalizeTime(item?.horario_inicio || "", ""),
        horario_fim: normalizeTime(item?.horario_fim || "", ""),
      }))
      .filter((item) => item.data)
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [datas]);

  const range = useMemo(
    () => getRangeDatas(datasOrdenadasValidas),
    [datasOrdenadasValidas]
  );

  const cargaPreview = useMemo(
    () =>
      calcularCargaHoraria(
        datasOrdenadasValidas.filter(
          (item) => item.data && item.horario_inicio && item.horario_fim
        )
      ),
    [datasOrdenadasValidas]
  );

  const organizadoresSelecionadosIds = useMemo(
    () =>
      [
        ...new Set(
          organizadoresSel
            .map((value) => Number(String(value).trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
        ),
      ],
    [organizadoresSel]
  );

  const assinanteOpcoes = useMemo(
    () =>
      montarOpcoesAssinantes({
        organizadoresSelecionadosIds,
        organizadoresLista,
      }),
    [organizadoresLista, organizadoresSelecionadosIds]
  );

  const assinantesSelecionadosIds = useMemo(
    () => normalizarAssinantesFrontend(assinantesSel),
    [assinantesSel]
  );

  const pendencias = useMemo(
    () =>
      buildPendencias({
        nome,
        vagasTotal,
        datasOrdenadasValidas,
        organizadoresSelecionadosIds,
        assinantesSelecionadosIds,
      }),
    [
      assinantesSelecionadosIds,
      datasOrdenadasValidas,
      organizadoresSelecionadosIds,
      nome,
      vagasTotal,
    ]
  );

  const turmaPronta = pendencias.length === 0;

  const statusOperacional = turmaPronta
    ? {
        tone: "emerald",
        icon: CheckCircle2,
        label: "Turma pronta para salvar",
      }
    : {
        tone: "amber",
        icon: AlertTriangle,
        label: `${pendencias.length} pendência(s)`,
      };

  const StatusIcon = statusOperacional.icon;

  const getOrganizadoresDisponiveisParaLinha = useCallback(
    (index) => {
      const selecionados = organizadoresSel.map(String).filter(Boolean);
      const atual = String(organizadoresSel[index] || "");

      return organizadoresLista.filter((item) => {
        const id = String(item.id);
        return !selecionados.includes(id) || id === atual;
      });
    },
    [organizadoresLista, organizadoresSel]
  );

  const getAssinantesDisponiveisParaLinha = useCallback(
    (index) => {
      const atual = assinantesSelecionadosIds[index];

      return assinanteOpcoes.filter((item) => {
        if (item.id === RAFAELLA_PITOL_ID) return item.id === atual;
        return !assinantesSelecionadosIds.includes(item.id) || item.id === atual;
      });
    },
    [assinanteOpcoes, assinantesSelecionadosIds]
  );

  const updateData = useCallback((index, field, value) => {
    setDatas((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }, []);

  const addData = useCallback(() => {
    const last = datas[datas.length - 1] || {};

    setDatas((prev) => [
      ...prev,
      {
        data: "",
        horario_inicio: normalizeTime(last.horario_inicio || "", ""),
        horario_fim: normalizeTime(last.horario_fim || "", ""),
      },
    ]);
  }, [datas]);

  const clonarHorario = useCallback(() => {
    const last = datas[datas.length - 1] || {};

    if (!last?.horario_inicio || !last?.horario_fim) {
      notifyInfo("Preencha os horários da última data antes de clonar.");
      return;
    }

    setDatas((prev) => [
      ...prev,
      {
        data: "",
        horario_inicio: normalizeTime(last.horario_inicio || "", ""),
        horario_fim: normalizeTime(last.horario_fim || "", ""),
      },
    ]);
  }, [datas]);

  const removeData = useCallback((index) => {
    setDatas((prev) => {
      if (prev.length <= 1) return prev;

      return prev.filter((_, idx) => idx !== index);
    });
  }, []);

  const selecionarOrganizador = useCallback((index, value) => {
    setOrganizadoresSel((prev) =>
      prev.map((item, idx) => (idx === index ? value : item))
    );
  }, []);

  const adicionarOrganizador = useCallback(() => {
    setOrganizadoresSel((prev) => [...prev, ""]);
  }, []);

  const removerOrganizador = useCallback((index) => {
    setOrganizadoresSel((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [""];
    });
  }, []);

  const atualizarPalestrante = useCallback((index, field, value) => {
    setPalestrantes((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }, []);

  const adicionarPalestrante = useCallback(() => {
    setPalestrantes((prev) => [
      ...prev,
      {
        nome: "",
        usuario_id: null,
      },
    ]);
  }, []);

  const removerPalestrante = useCallback((index) => {
    setPalestrantes((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [{ nome: "", usuario_id: null }];
    });
  }, []);

  const atualizarAssinante = useCallback((index, value) => {
    const id = toPositiveIntOrNull(value);

    setAssinantesSel((prev) => {
      const atual = normalizarAssinantesFrontend(prev);
      const next = [...atual];

      if (!id) {
        next.splice(index, 1);
      } else {
        next[index] = id;
      }

      return normalizarAssinantesFrontend(next);
    });
  }, []);

  const adicionarAssinante = useCallback(() => {
    setAssinantesSel((prev) => {
      const atual = normalizarAssinantesFrontend(prev);

      if (atual.length >= MAX_ASSINANTES) {
        notifyInfo("O limite é de até 3 assinantes.");
        return atual;
      }

      const candidatos = assinanteOpcoes
        .map((item) => item.id)
        .filter((id) => id !== RAFAELLA_PITOL_ID && !atual.includes(id));

      const proximo = candidatos[0] || RAFAELLA_PITOL_ID;

      return normalizarAssinantesFrontend([...atual, proximo]);
    });
  }, [assinanteOpcoes]);

  const removerAssinante = useCallback((index) => {
    setAssinantesSel((prev) => {
      const atual = normalizarAssinantesFrontend(prev);
      const id = atual[index];

      if (id === RAFAELLA_PITOL_ID) {
        notifyWarning("A assinatura da Rafaella Pitol é obrigatória.");
        return atual;
      }

      const next = atual.filter((_, idx) => idx !== index);

      return normalizarAssinantesFrontend(next);
    });
  }, []);

  const validar = useCallback(() => {
    const nomeTrim = String(nome || "").trim();

    if (!nomeTrim) {
      notifyWarning("Informe o nome da turma.");
      return false;
    }

    if (nomeTrim.length > NOME_TURMA_MAX) {
      notifyError(`O nome não pode exceder ${NOME_TURMA_MAX} caracteres.`);
      return false;
    }

    const vagas = Number(vagasTotal);

    if (!Number.isInteger(vagas) || vagas <= 0) {
      notifyWarning("Quantidade de vagas deve ser número inteiro maior ou igual a 1.");
      return false;
    }

    if (!datasOrdenadasValidas.length) {
      notifyWarning("Inclua pelo menos uma data.");
      return false;
    }

    for (let i = 0; i < datasOrdenadasValidas.length; i += 1) {
      const item = datasOrdenadasValidas[i];

      if (!item.data || !item.horario_inicio || !item.horario_fim) {
        notifyError(`Preencha data e horários da data ${i + 1}.`);
        return false;
      }

      const [h1, m1] = item.horario_inicio.split(":").map(Number);
      const [h2, m2] = item.horario_fim.split(":").map(Number);

      const ini = h1 * 60 + (Number.isFinite(m1) ? m1 : 0);
      const fim = h2 * 60 + (Number.isFinite(m2) ? m2 : 0);

      if (fim <= ini) {
        notifyError(`Horários inválidos na data ${i + 1}.`);
        return false;
      }
    }

    if (!organizadoresSelecionadosIds.length) {
      notifyError("Selecione ao menos um organizador para a turma.");
      return false;
    }

    const assinantes = normalizarAssinantesFrontend(assinantesSel);

    if (!assinantes.includes(RAFAELLA_PITOL_ID)) {
      notifyError("A assinatura da Rafaella Pitol é obrigatória.");
      return false;
    }

    if (assinantes.length < 1 || assinantes.length > MAX_ASSINANTES) {
      notifyError("Selecione de 1 a 3 assinantes.");
      return false;
    }

    return true;
  }, [
    assinantesSel,
    datasOrdenadasValidas,
    organizadoresSelecionadosIds,
    nome,
    vagasTotal,
  ]);

  const montarPayload = useCallback(() => {
    const id = toPositiveIntOrNull(turma?.id);

    return {
      ...(id ? { id } : {}),

      nome: String(nome || "").trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria: calcularCargaHoraria(datasOrdenadasValidas),

      datas: datasOrdenadasValidas.map((item) => ({
        data: item.data,
        horario_inicio: item.horario_inicio,
        horario_fim: item.horario_fim,
      })),

      organizadores: organizadoresSelecionadosIds,
      palestrantes: normalizarPalestrantesFrontend(palestrantes),
      assinantes: normalizarAssinantesFrontend(assinantesSel),
    };
  }, [
    assinantesSel,
    datasOrdenadasValidas,
    organizadoresSelecionadosIds,
    nome,
    palestrantes,
    turma?.id,
    vagasTotal,
  ]);

  const handleSalvar = useCallback(() => {
    if (!validar()) return;

    const payload = montarPayload();

    logDev("Payload oficial da turma.", payload);

    onSalvar?.(payload);
  }, [montarPayload, onSalvar, validar]);

  return (
    <Modal
      open={open}
      onClose={() => onClose?.()}
      size="full"
      labelledBy={titleId}
      describedBy={descId}
      className="overflow-hidden p-0"
      padding={false}
    >
      <div
        className={[
          "grid grid-rows-[auto,1fr,auto] overflow-hidden border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950",
          "h-[100dvh] max-h-[100dvh] w-[100vw] rounded-none",
          "sm:h-auto sm:max-h-[92vh] sm:w-auto sm:rounded-[2rem]",
        ].join(" ")}
      >
        <div
          className={cx(
            "h-1.5 bg-gradient-to-r",
            turmaPronta
              ? "from-emerald-500 via-teal-500 to-cyan-500"
              : "from-amber-500 via-orange-500 to-rose-500"
          )}
        />

        <header className="relative border-b border-zinc-200 bg-white/90 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:p-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/40 dark:text-indigo-300">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="break-words text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl"
                  >
                    {turma?.id ? "Editar turma" : "Nova turma"}
                  </h2>

                  <p
                    id={descId}
                    className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
                  >
                    Monte a turma com datas, organizadores, palestrantes
                    opcionais, assinantes e vagas. A carga horária é calculada
                    automaticamente.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Chip tone={statusOperacional.tone}>
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {statusOperacional.label}
                </Chip>

                <Chip tone="indigo" title="Período">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDateBr(range.data_inicio)} — {formatDateBr(range.data_fim)}
                </Chip>

                <Chip tone="violet" title="Datas">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {datasOrdenadasValidas.length || 0} data(s)
                </Chip>

                <Chip tone="emerald" title="Carga estimada">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {cargaPreview ? `${cargaPreview}h` : "—"}
                </Chip>

                <Chip tone={loadingOrganizadores ? "amber" : "zinc"} title="Organizadores disponíveis">
                  {loadingOrganizadores ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {loadingOrganizadores
                    ? "Carregando organizadores"
                    : `${organizadoresLista.length} organizador(es)`}
                </Chip>

                <Chip tone="sky" title="Assinantes">
                  <Signature className="h-3.5 w-3.5" aria-hidden="true" />
                  {assinantesSelecionadosIds.length} assinatura(s)
                </Chip>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onClose?.()}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl p-2 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:hover:bg-white/10"
              aria-label="Fechar"
              title="Fechar"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto bg-zinc-50/70 p-4 dark:bg-zinc-950/70 sm:p-6">
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              handleSalvar();
            }}
            className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]"
            aria-labelledby={titleId}
            noValidate
          >
            <main className="space-y-5">
              <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
                <SectionTitle
                  icon={CalendarDays}
                  title="Cronograma da turma"
                  subtitle="Cadastre as datas em formato date-only seguro, com horários de parede."
                />

                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricTile
                    icon={CalendarDays}
                    label="Início"
                    value={formatDateBr(range.data_inicio)}
                    tone="violet"
                  />
                  <MetricTile
                    icon={CalendarDays}
                    label="Fim"
                    value={formatDateBr(range.data_fim)}
                    tone="sky"
                  />
                  <MetricTile
                    icon={ListChecks}
                    label="Datas"
                    value={datasOrdenadasValidas.length || "—"}
                    tone="zinc"
                  />
                  <MetricTile
                    icon={ShieldCheck}
                    label="Carga"
                    value={cargaPreview ? `${cargaPreview}h` : "—"}
                    tone="emerald"
                  />
                </div>

                <div className="space-y-3">
                  {datas.map((item, index) => {
                    const canRemove = datas.length > 1;
                    const itemData = normalizeDateOnly(item.data);
                    const itemInicio = normalizeTime(item.horario_inicio || "", "");
                    const itemFim = normalizeTime(item.horario_fim || "", "");
                    const completo = Boolean(itemData && itemInicio && itemFim);

                    return (
                      <article
                        key={`data-${index}`}
                        className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/45"
                      >
                        <div
                          className={cx(
                            "h-1 bg-gradient-to-r",
                            completo
                              ? "from-emerald-500 via-teal-500 to-cyan-500"
                              : "from-amber-500 via-orange-500 to-rose-500"
                          )}
                        />

                        <div className="p-3 sm:p-4">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-black text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                                  Data {index + 1}
                                </span>

                                <Chip tone={completo ? "emerald" : "amber"}>
                                  {completo ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  ) : (
                                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                  )}
                                  {completo ? "Completa" : "Pendente"}
                                </Chip>
                              </div>

                              <p className="mt-2 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                                {itemData ? formatDateBr(itemData) : "Data não informada"}
                                {itemInicio && itemFim ? ` · ${itemInicio} às ${itemFim}` : ""}
                              </p>
                            </div>

                            {canRemove ? (
                              <ActionButton
                                type="button"
                                tone="danger"
                                size="xs"
                                onClick={() => removeData(index)}
                                title="Remover esta data"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Remover
                              </ActionButton>
                            ) : (
                              <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                                mínimo 1 data
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                            <div className="md:col-span-4">
                              <label className="mb-1 block text-xs font-black text-zinc-700 dark:text-zinc-200">
                                Data <span className="text-rose-600">*</span>
                              </label>

                              <div className="relative">
                                <CalendarDays
                                  className="absolute left-3 top-2.5 text-zinc-400"
                                  size={18}
                                  aria-hidden="true"
                                />

                                <input
                                  type="date"
                                  value={itemData}
                                  onChange={(event) =>
                                    updateData(index, "data", event.target.value)
                                  }
                                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                                  required
                                  aria-label={`Data ${index + 1}`}
                                />
                              </div>
                            </div>

                            <div className="md:col-span-4">
                              <label className="mb-1 block text-xs font-black text-zinc-700 dark:text-zinc-200">
                                Início <span className="text-rose-600">*</span>
                              </label>

                              <div className="relative">
                                <Clock
                                  className="absolute left-3 top-2.5 text-zinc-400"
                                  size={18}
                                  aria-hidden="true"
                                />

                                <input
                                  type="time"
                                  value={itemInicio}
                                  onChange={(event) =>
                                    updateData(index, "horario_inicio", event.target.value)
                                  }
                                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                                  required
                                  aria-label={`Horário de início da data ${index + 1}`}
                                />
                              </div>
                            </div>

                            <div className="md:col-span-4">
                              <label className="mb-1 block text-xs font-black text-zinc-700 dark:text-zinc-200">
                                Fim <span className="text-rose-600">*</span>
                              </label>

                              <div className="relative">
                                <Clock
                                  className="absolute left-3 top-2.5 text-zinc-400"
                                  size={18}
                                  aria-hidden="true"
                                />

                                <input
                                  type="time"
                                  value={itemFim}
                                  onChange={(event) =>
                                    updateData(index, "horario_fim", event.target.value)
                                  }
                                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                                  required
                                  aria-label={`Horário de fim da data ${index + 1}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <ActionButton type="button" onClick={addData} tone="info">
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Adicionar data
                  </ActionButton>

                  <ActionButton type="button" onClick={clonarHorario} tone="ghost">
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Clonar horários
                  </ActionButton>
                </div>
              </section>
            </main>

            <aside className="space-y-5 xl:sticky xl:top-0 xl:self-start">
              <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
                <SectionTitle
                  icon={Type}
                  title="Identificação"
                  subtitle="Nome e vagas da turma."
                />

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-black text-zinc-800 dark:text-zinc-100">
                      Nome da turma <span className="text-rose-600">*</span>
                    </label>

                    <div className="relative">
                      <textarea
                        ref={nomeRef}
                        data-initial-focus
                        value={nome}
                        onChange={(event) =>
                          setNome(event.target.value.slice(0, NOME_TURMA_MAX))
                        }
                        placeholder="Ex.: Turma A — Manhã"
                        maxLength={NOME_TURMA_MAX}
                        rows={2}
                        className="w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-16 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                        autoComplete="off"
                        aria-describedby={`nome-turma-help-${uid} nome-turma-count-${uid}`}
                        required
                      />

                      <div
                        id={`nome-turma-count-${uid}`}
                        className={cx(
                          "absolute right-3 top-3 text-xs",
                          nome.length >= NOME_TURMA_MAX * 0.9
                            ? "text-amber-600"
                            : "text-zinc-500 dark:text-zinc-300"
                        )}
                      >
                        {nome.length}/{NOME_TURMA_MAX}
                      </div>
                    </div>

                    <p
                      id={`nome-turma-help-${uid}`}
                      className="mt-1 text-xs text-zinc-500 dark:text-zinc-400"
                    >
                      Use um nome curto e reconhecível para o participante.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-black text-zinc-800 dark:text-zinc-100">
                      Vagas <span className="text-rose-600">*</span>
                    </label>

                    <div className="relative">
                      <Hash
                        className="absolute left-3 top-2.5 text-zinc-400"
                        size={18}
                        aria-hidden="true"
                      />

                      <input
                        type="number"
                        value={vagasTotal}
                        onChange={(event) => setVagasTotal(event.target.value)}
                        placeholder="Quantidade de vagas"
                        className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-950"
                        min={1}
                        required
                        inputMode="numeric"
                        aria-label="Quantidade de vagas da turma"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
                <SectionTitle
                  icon={Users}
                  title="Equipe da turma"
                  subtitle="Defina o organizador obrigatório, palestrantes opcionais e assinaturas do certificado."
                />

                {loadingOrganizadores ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Carregando organizadores disponíveis…
                    </span>
                  </div>
                ) : organizadoresLista.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                    Nenhum organizador disponível no endpoint oficial.
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                            Organizadores
                          </h4>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Pelo menos um organizador é obrigatório.
                          </p>
                        </div>

                        <ActionButton
                          type="button"
                          onClick={adicionarOrganizador}
                          tone="info"
                          size="xs"
                          className="shrink-0"
                        >
                          <PlusCircle className="h-4 w-4" aria-hidden="true" />
                          Incluir
                        </ActionButton>
                      </div>

                      {organizadoresSel.map((value, index) => (
                        <div key={`organizador-${index}`} className="space-y-2">
                          <label className="block text-xs font-black text-zinc-700 dark:text-zinc-200">
                            {index === 0
                              ? "Organizador principal"
                              : `Organizador adicional ${index}`}
                          </label>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <select
                              value={String(value || "")}
                              onChange={(event) =>
                                selecionarOrganizador(index, event.target.value)
                              }
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                              required={index === 0}
                              aria-label={
                                index === 0
                                  ? "Organizador principal"
                                  : `Organizador adicional ${index}`
                              }
                            >
                              <option value="">Selecione o organizador</option>

                              {getOrganizadoresDisponiveisParaLinha(index).map(
                                (organizador) => (
                                  <option
                                    key={organizador.id}
                                    value={String(organizador.id)}
                                  >
                                    {organizador.nome}
                                  </option>
                                )
                              )}
                            </select>

                            {index > 0 ? (
                              <ActionButton
                                type="button"
                                onClick={() => removerOrganizador(index)}
                                tone="danger"
                                size="sm"
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                Remover
                              </ActionButton>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-black text-sky-950 dark:text-sky-100">
                            <Mic2 className="h-4 w-4" aria-hidden="true" />
                            Palestrantes
                          </h4>
                          <p className="text-xs text-sky-800 dark:text-sky-200">
                            Campo opcional. Pode ser preenchido com nome externo.
                          </p>
                        </div>

                        <ActionButton
                          type="button"
                          onClick={adicionarPalestrante}
                          tone="ghost"
                          size="xs"
                          className="shrink-0"
                        >
                          <PlusCircle className="h-4 w-4" aria-hidden="true" />
                          Incluir
                        </ActionButton>
                      </div>

                      {palestrantes.map((item, index) => (
                        <div key={`palestrante-${index}`} className="flex flex-col gap-2 sm:flex-row">
                          <div className="relative w-full">
                            <PenLine
                              className="absolute left-3 top-2.5 text-zinc-400"
                              size={18}
                              aria-hidden="true"
                            />

                            <input
                              type="text"
                              value={String(item?.nome || "")}
                              onChange={(event) =>
                                atualizarPalestrante(index, "nome", event.target.value)
                              }
                              placeholder="Nome do palestrante"
                              className="w-full rounded-2xl border border-sky-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-sky-500 dark:border-sky-900/50 dark:bg-zinc-950"
                              aria-label={`Nome do palestrante ${index + 1}`}
                            />
                          </div>

                          {palestrantes.length > 1 ? (
                            <ActionButton
                              type="button"
                              onClick={() => removerPalestrante(index)}
                              tone="danger"
                              size="sm"
                              className="shrink-0"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Remover
                            </ActionButton>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="flex items-center gap-2 text-sm font-black text-emerald-950 dark:text-emerald-100">
                            <Signature className="h-4 w-4" aria-hidden="true" />
                            Assinantes do certificado
                          </h4>
                          <p className="text-xs text-emerald-800 dark:text-emerald-200">
                            De 1 a 3 assinantes. Rafaella Pitol é obrigatória.
                          </p>
                        </div>

                        <ActionButton
                          type="button"
                          onClick={adicionarAssinante}
                          tone="success"
                          size="xs"
                          className="shrink-0"
                          disabled={assinantesSelecionadosIds.length >= MAX_ASSINANTES}
                        >
                          <PlusCircle className="h-4 w-4" aria-hidden="true" />
                          Incluir
                        </ActionButton>
                      </div>

                      <div className="rounded-2xl border border-emerald-200 bg-white/75 p-3 text-xs font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-zinc-950/40 dark:text-emerald-100">
                        {labelAssinanteRegra(assinantesSelecionadosIds)}
                      </div>

                      {assinantesSelecionadosIds.map((assinanteId, index) => {
                        const bloqueado = assinanteId === RAFAELLA_PITOL_ID;
                        const opcoes = getAssinantesDisponiveisParaLinha(index);

                        return (
                          <div key={`assinante-${index}`} className="space-y-2">
                            <label className="block text-xs font-black text-emerald-950 dark:text-emerald-100">
                              Assinante {index + 1}
                              {bloqueado ? " — obrigatório" : ""}
                            </label>

                            <div className="flex flex-col gap-2 sm:flex-row">
                              <select
                                value={String(assinanteId || "")}
                                onChange={(event) =>
                                  atualizarAssinante(index, event.target.value)
                                }
                                disabled={bloqueado}
                                className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-100 disabled:font-bold dark:border-emerald-900/50 dark:bg-zinc-950 dark:disabled:bg-emerald-950/40"
                                required
                              >
                                <option value="">Selecione o assinante</option>

                                {opcoes.map((assinante) => (
                                  <option
                                    key={assinante.id}
                                    value={String(assinante.id)}
                                  >
                                    {assinante.nome}
                                    {assinante.id === RAFAELLA_PITOL_ID
                                      ? " — obrigatória"
                                      : assinante.id === FABIO_LOPEZ_ID
                                        ? " — Secretário"
                                        : ""}
                                  </option>
                                ))}
                              </select>

                              {!bloqueado ? (
                                <ActionButton
                                  type="button"
                                  onClick={() => removerAssinante(index)}
                                  tone="danger"
                                  size="sm"
                                  className="shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  Remover
                                </ActionButton>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
                <SectionTitle
                  icon={UserCheck}
                  title="Diagnóstico"
                  subtitle="Verificação rápida antes de salvar."
                />

                {turmaPronta ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Turma pronta para salvar.
                    </span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    <div className="font-black">Pendências:</div>
                    <ul className="mt-2 list-inside list-disc text-xs">
                      {pendencias.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </aside>
          </form>
        </div>

        <footer className="border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {turmaPronta ? (
                <span className="inline-flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Tudo certo para salvar esta turma.
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Ainda há pendências: {pendencias.join(", ")}.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <ActionButton
                type="button"
                onClick={() => onClose?.()}
                tone="neutral"
                aria-label="Cancelar"
              >
                Cancelar
              </ActionButton>

              <ActionButton
                type="submit"
                form={formId}
                tone="success"
                aria-label="Salvar turma"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Salvar turma
              </ActionButton>
            </div>
          </div>
        </footer>
      </div>
    </Modal>
  );
}