// ✅ frontend/src/components/calendarioAnual/ModalCalendarioAnualEPS.jsx — v2.0
// Atualizado em: 18/05/2026
//
// Plataforma Escola da Saúde
//
// Modal de criação/edição de programação do Calendário Anual de EPS.
//
// Importante:
// - Este módulo NÃO é a nova página de cursos online.
// - Trata programações internas de Educação Permanente em Saúde.
// - O departamento responsável é obrigatório.
// - O departamento não é digitado livremente: vem de lista suspensa oficial.
//
// Contratos oficiais usados:
// - POST /api/calendario-eps
// - PUT  /api/calendario-eps/:id
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem Modal antigo;
// - sem /api duplicado dentro do api service;
// - sem rota antiga /solicitacao-curso;
// - sem status "confirmado";
// - status oficial:
//   planejado | solicitado | em_analise | aprovado | rejeitado | cancelado | convertido_em_evento
// - anti-fuso: date-only em YYYY-MM-DD, sem new Date("YYYY-MM-DD");
// - horário em HH:mm;
// - respostas/mensagens internas acessíveis;
// - UX/UI premium real;
// - mobile-first;
// - dark mode;
// - acessível.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Save,
  School,
  ShieldCheck,
  Sparkles,
  Trash2,
  Type,
  Unlock,
  Users,
  X,
} from "lucide-react";

import api from "../../services/api";

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_OFICIAL = [
  { value: "planejado", label: "Planejado" },
  { value: "solicitado", label: "Solicitado" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "convertido_em_evento", label: "Convertido em evento" },
];

const MODALIDADE_OFICIAL = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "On-line" },
  { value: "hibrido", label: "Híbrido" },
];

const DEPARTAMENTOS_FALLBACK = [
  {
    value: "GAB-SMS",
    label: "GAB-SMS",
    cor: "#7c3aed",
  },
  {
    value: "DESMEN",
    label: "DESMEN",
    cor: "#2563eb",
  },
  {
    value: "DEAPS",
    label: "DEAPS",
    cor: "#16a34a",
  },
  {
    value: "DEMAC",
    label: "DEMAC",
    cor: "#ea580c",
  },
  {
    value: "DEVIG",
    label: "DEVIG",
    cor: "#dc2626",
  },
  {
    value: "DEREG",
    label: "DEREG",
    cor: "#0891b2",
  },
  {
    value: "DEAFIN-SMS",
    label: "DEAFIN-SMS",
    cor: "#9333ea",
  },
];

const DEPARTAMENTOS_OFICIAIS = new Set(
  DEPARTAMENTOS_FALLBACK.map((item) => item.value)
);

const FORM_INICIAL = {
  titulo: "",
  descricao: "",
  publico_alvo: "",
  local: "",
  tipo: "",
  unidade_id: "",
  modalidade: "",
  departamento: "",
  restrito: false,
  restricao_descricao: "",
  carga_horaria_total: "",
  gera_certificado: false,
  status: "planejado",
};

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function criarLinhaDataVazia() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    data: "",
    horario_inicio: "",
    horario_fim: "",
  };
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function trimOrNull(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizarNome(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizarDepartamentoItem(item) {
  const value = String(item?.value || item?.departamento || "").trim();
  const label = String(
    item?.label || item?.departamento_label || item?.value || item?.departamento || ""
  ).trim();

  return {
    value,
    label: label || value,
    cor: item?.cor || item?.departamento_cor || "#64748b",
  };
}

function normalizarDepartamentos(lista = []) {
  const base = Array.isArray(lista) && lista.length > 0 ? lista : DEPARTAMENTOS_FALLBACK;

  return base
    .map(normalizarDepartamentoItem)
    .filter((item) => item.value && item.label);
}

function departamentoValido(value, departamentos = []) {
  const departamento = String(value || "").trim();

  if (!departamento) return false;

  const oficiais = new Set(
    normalizarDepartamentos(departamentos).map((item) => item.value)
  );

  return oficiais.has(departamento) || DEPARTAMENTOS_OFICIAIS.has(departamento);
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isHHMM(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim());
}

function formatarDataBR(ymd) {
  const text = String(ymd || "").slice(0, 10);

  if (!isYMD(text)) return text || "—";

  const [ano, mes, dia] = text.split("-");
  return `${dia}/${mes}/${ano}`;
}

function minutosHHMM(hhmm) {
  if (!isHHMM(hhmm)) return null;

  const [hora, minuto] = hhmm.split(":").map(Number);

  if (
    !Number.isInteger(hora) ||
    !Number.isInteger(minuto) ||
    hora < 0 ||
    hora > 23 ||
    minuto < 0 ||
    minuto > 59
  ) {
    return null;
  }

  return hora * 60 + minuto;
}

function diferencaHoras(inicio, fim) {
  const a = minutosHHMM(inicio);
  const b = minutosHHMM(fim);

  if (a == null || b == null || b <= a) return 0;

  return (b - a) / 60;
}

function numeroInteiroOuNull(value) {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isInteger(number) ? number : Number.NaN;
}

function statusValido(status) {
  return STATUS_OFICIAL.some((item) => item.value === status);
}

function modalidadeValida(modalidade) {
  if (!modalidade) return true;
  return MODALIDADE_OFICIAL.some((item) => item.value === modalidade);
}

function extrairPalestranteNome(palestrante) {
  if (typeof palestrante === "string") return normalizarNome(palestrante);

  return normalizarNome(
    palestrante?.nome ||
      palestrante?.nome_externo ||
      palestrante?.palestrante_nome ||
      ""
  );
}

/* =========================================================================
   UI
=========================================================================== */

function Button({
  children,
  icon: Icon,
  tone = "slate",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white shadow-lg shadow-emerald-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    emerald:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    rose:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
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

function Field({ label, required, icon: Icon, hint, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        {label}
        {required ? <span className="text-rose-500">*</span> : null}
      </span>

      {children}

      {hint ? (
        <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        <span className="text-xs font-black uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-black text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function Section({ title, icon: Icon, description, children }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {title}
          </h3>

          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

/* =========================================================================
   Component
=========================================================================== */

export default function ModalCalendarioAnualEPS({
  aberto,
  onClose,
  onSaved,
  solicitacao,
  programacao,
  unidades = [],
  departamentos = [],
  podeEditarStatus = false,
}) {
  const registro = programacao || solicitacao || null;
  const isEdicao = Boolean(registro?.id);

  const uid = useId();
  const titleId = `modal-calendario-eps-title-${uid}`;
  const descId = `modal-calendario-eps-desc-${uid}`;

  const firstFocusRef = useRef(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [a11y, setA11y] = useState("");

  const [form, setForm] = useState(FORM_INICIAL);
  const [datas, setDatas] = useState([criarLinhaDataVazia()]);
  const [palestrantes, setPalestrantes] = useState([]);
  const [novoPalestrante, setNovoPalestrante] = useState("");

  const departamentosNormalizados = useMemo(
    () => normalizarDepartamentos(departamentos),
    [departamentos]
  );

  const inputBase =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";

  const textareaBase =
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";

  useEffect(() => {
    if (!aberto) return undefined;

    if (isEdicao) {
      setForm({
        titulo: registro?.titulo || "",
        descricao: registro?.descricao || "",
        publico_alvo: registro?.publico_alvo || "",
        local: registro?.local || "",
        tipo: registro?.tipo || "",
        unidade_id:
          registro?.unidade_id != null ? String(registro.unidade_id) : "",
        modalidade: registro?.modalidade || "",
        departamento: registro?.departamento || "",
        restrito: Boolean(registro?.restrito),
        restricao_descricao: registro?.restricao_descricao || "",
        carga_horaria_total:
          registro?.carga_horaria_total != null
            ? String(registro.carga_horaria_total)
            : "",
        gera_certificado: Boolean(registro?.gera_certificado),
        status: statusValido(registro?.status) ? registro.status : "planejado",
      });

      setDatas(
        Array.isArray(registro?.datas) && registro.datas.length > 0
          ? registro.datas.map((item) => ({
              id:
                item.id ||
                `${item.data || "data"}-${item.horario_inicio || ""}-${Math.random()
                  .toString(36)
                  .slice(2, 6)}`,
              data: String(item.data || "").slice(0, 10),
              horario_inicio: item.horario_inicio
                ? String(item.horario_inicio).slice(0, 5)
                : "",
              horario_fim: item.horario_fim
                ? String(item.horario_fim).slice(0, 5)
                : "",
            }))
          : [criarLinhaDataVazia()]
      );

      const nomes = Array.isArray(registro?.palestrantes)
        ? registro.palestrantes.map(extrairPalestranteNome).filter(Boolean)
        : [];

      const unicos = [];
      const vistos = new Set();

      for (const nome of nomes) {
        const key = nome.toLowerCase();
        if (vistos.has(key)) continue;
        vistos.add(key);
        unicos.push(nome);
      }

      setPalestrantes(unicos);
    } else {
      setForm(FORM_INICIAL);
      setDatas([criarLinhaDataVazia()]);
      setPalestrantes([]);
    }

    setNovoPalestrante("");
    setErro("");
    setMensagem("");
    setA11y("");
    setSalvando(false);

    const focusTimer = window.setTimeout(() => {
      firstFocusRef.current?.focus?.();
    }, 80);

    function onKeyDown(event) {
      if (event.key === "Escape" && !salvando) {
        onClose?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [aberto, isEdicao, registro, onClose, salvando]);

  function setCampo(campo, valor) {
    setForm((current) => ({
      ...current,
      [campo]: valor,
    }));
  }

  function setLinhaData(id, campo, valor) {
    setDatas((current) =>
      current.map((item) => (item.id === id ? { ...item, [campo]: valor } : item))
    );
  }

  function adicionarData() {
    setDatas((current) => [...current, criarLinhaDataVazia()]);
  }

  function removerData(id) {
    setDatas((current) => {
      if (current.length <= 1) return current;
      return current.filter((item) => item.id !== id);
    });
  }

  function adicionarPalestrante() {
    const nome = normalizarNome(novoPalestrante);

    if (!nome) {
      setErro("Informe o nome completo do palestrante antes de adicionar.");
      setA11y("Informe o nome completo do palestrante antes de adicionar.");
      return;
    }

    setPalestrantes((current) => {
      const existe = current.some(
        (item) => item.toLowerCase() === nome.toLowerCase()
      );

      if (existe) {
        setErro("Este palestrante já foi adicionado.");
        setA11y("Este palestrante já foi adicionado.");
        return current;
      }

      setErro("");
      setA11y("Palestrante adicionado.");

      return [...current, nome];
    });

    setNovoPalestrante("");
  }

  function removerPalestrante(index) {
    setPalestrantes((current) =>
      current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  const payloadDatas = useMemo(() => {
    const normalizadas = (datas || [])
      .map((item) => ({
        data: String(item.data || "").slice(0, 10),
        horario_inicio: item.horario_inicio
          ? String(item.horario_inicio).slice(0, 5)
          : "",
        horario_fim: item.horario_fim
          ? String(item.horario_fim).slice(0, 5)
          : "",
      }))
      .filter((item) => isYMD(item.data))
      .map((item) => ({
        data: item.data,
        horario_inicio: isHHMM(item.horario_inicio) ? item.horario_inicio : null,
        horario_fim: isHHMM(item.horario_fim) ? item.horario_fim : null,
      }));

    const vistos = new Set();
    const unicas = [];

    for (const item of normalizadas) {
      const key = `${item.data}|${item.horario_inicio || ""}|${
        item.horario_fim || ""
      }`;

      if (vistos.has(key)) continue;

      vistos.add(key);
      unicas.push(item);
    }

    unicas.sort((a, b) => {
      const aa = `${a.data} ${a.horario_inicio || "00:00"}`;
      const bb = `${b.data} ${b.horario_inicio || "00:00"}`;
      return aa.localeCompare(bb);
    });

    return unicas;
  }, [datas]);

  const minis = useMemo(() => {
    const qtd = payloadDatas.length;
    const inicio = qtd ? formatarDataBR(payloadDatas[0].data) : "—";
    const fim = qtd ? formatarDataBR(payloadDatas[qtd - 1].data) : "—";

    const somaHoras = payloadDatas.reduce((sum, item) => {
      return sum + diferencaHoras(item.horario_inicio || "", item.horario_fim || "");
    }, 0);

    const cargaInformada = Number(form.carga_horaria_total);
    const carga =
      Number.isFinite(cargaInformada) && cargaInformada >= 0
        ? cargaInformada
        : somaHoras;

    const unidadeNome =
      unidades.find((item) => String(item.id) === String(form.unidade_id))?.nome ||
      "—";

    const departamentoNome =
      departamentosNormalizados.find(
        (item) => String(item.value) === String(form.departamento)
      )?.label || "—";

    return {
      qtd,
      periodo: qtd ? `${inicio} → ${fim}` : "—",
      unidadeNome,
      departamentoNome,
      carga: carga ? `${Math.round(carga * 10) / 10}h` : "—",
    };
  }, [
    payloadDatas,
    form.carga_horaria_total,
    form.unidade_id,
    form.departamento,
    unidades,
    departamentosNormalizados,
  ]);

  function validarFormulario() {
    const titulo = String(form.titulo || "").trim();

    if (!titulo) {
      return "Informe o título da programação.";
    }

    if (!departamentoValido(form.departamento, departamentosNormalizados)) {
      return "Selecione o departamento responsável pela programação.";
    }

    if (payloadDatas.length === 0) {
      return "Informe ao menos uma data válida para a programação.";
    }

    for (const item of payloadDatas) {
      const inicio = item.horario_inicio || "";
      const fim = item.horario_fim || "";

      if (inicio && !isHHMM(inicio)) {
        return "Horário de início inválido. Use o formato HH:mm.";
      }

      if (fim && !isHHMM(fim)) {
        return "Horário de fim inválido. Use o formato HH:mm.";
      }

      if (inicio && fim) {
        const a = minutosHHMM(inicio);
        const b = minutosHHMM(fim);

        if (a != null && b != null && b <= a) {
          return "Horário de fim deve ser maior que o horário de início.";
        }
      }
    }

    if (form.carga_horaria_total) {
      const carga = Number(form.carga_horaria_total);

      if (!Number.isFinite(carga) || carga < 0) {
        return "Carga horária total inválida.";
      }
    }

    if (form.modalidade && !modalidadeValida(form.modalidade)) {
      return "Modalidade inválida.";
    }

    if (form.restrito && !String(form.restricao_descricao || "").trim()) {
      return "Descreva a restrição de acesso.";
    }

    if (isEdicao && podeEditarStatus && !statusValido(form.status)) {
      return "Status inválido.";
    }

    return null;
  }

  function montarPayload() {
    const cargaHoraria = numeroInteiroOuNull(form.carga_horaria_total);

    return {
      titulo: String(form.titulo || "").trim(),
      descricao: trimOrNull(form.descricao),
      publico_alvo: trimOrNull(form.publico_alvo),
      local: trimOrNull(form.local),
      tipo: trimOrNull(form.tipo),
      unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
      modalidade: trimOrNull(form.modalidade),
      departamento: String(form.departamento || "").trim(),
      restrito: Boolean(form.restrito),
      restricao_descricao: form.restrito
        ? trimOrNull(form.restricao_descricao)
        : null,
      carga_horaria_total: Number.isNaN(cargaHoraria) ? null : cargaHoraria,
      gera_certificado: Boolean(form.gera_certificado),
      datas: payloadDatas,
      palestrantes: palestrantes.map((nome) => ({
        palestrante_id: null,
        nome_externo: nome,
      })),
      ...(isEdicao && podeEditarStatus ? { status: form.status } : {}),
    };
  }

  async function salvar(event) {
    event?.preventDefault?.();

    if (salvando) return;

    setErro("");
    setMensagem("");

    const erroValidacao = validarFormulario();

    if (erroValidacao) {
      setErro(erroValidacao);
      setA11y(erroValidacao);
      return;
    }

    setSalvando(true);
    setA11y(isEdicao ? "Salvando alterações." : "Cadastrando programação.");

    try {
      const payload = montarPayload();

      if (isEdicao) {
        await api.calendarioEPS.atualizar(registro.id, payload);
        setMensagem("Programação atualizada com sucesso.");
        setA11y("Programação atualizada com sucesso.");
      } else {
        await api.calendarioEPS.criar(payload);
        setMensagem("Programação criada com sucesso.");
        setA11y("Programação criada com sucesso.");
      }

      await onSaved?.();
      onClose?.();
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Erro ao salvar a programação do Calendário Anual de EPS."
      );

      setErro(message);
      setA11y(message);
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    if (salvando) return;
    onClose?.();
  }

  if (!aberto) return null;

  return (
    <AnimatePresence>
      <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
        role="presentation"
        onMouseDown={(event) => {
          if (salvando) return;
          if (event.target === event.currentTarget) fechar();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl dark:bg-slate-950"          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(20,184,166,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(6,182,212,.22),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />
                  Calendário Anual de EPS
                </div>

                <h2
                  id={titleId}
                  className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
                >
                  <CalendarDays className="h-5 w-5" />
                  {isEdicao
                    ? "Editar programação de EPS"
                    : "Nova programação de EPS"}
                </h2>

                <p
                  id={descId}
                  className="mt-2 max-w-3xl text-sm leading-relaxed text-white/75"
                >
                  Preencha os dados da programação para registro no calendário
                  institucional de Educação Permanente em Saúde.
                </p>
              </div>

              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div aria-live="polite" className="sr-only">
            {a11y}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            {erro ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{erro}</span>
                </div>
              </div>
            ) : null}

            {mensagem ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{mensagem}</span>
                </div>
              </div>
            ) : null}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat icon={CalendarDays} label="Datas" value={minis.qtd || "—"} />
              <MiniStat icon={Clock} label="Período" value={minis.periodo} />
              <MiniStat
                icon={Building2}
                label="Departamento"
                value={minis.departamentoNome}
              />
              <MiniStat icon={FileText} label="Carga" value={minis.carga} />
            </div>

            <form
              id={`form-calendario-eps-${uid}`}
              onSubmit={salvar}
              className="space-y-6"
            >
              <Section
                title="Dados gerais"
                icon={BadgeCheck}
                description="Informe a identificação principal da programação."
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Field label="Título da programação" required icon={Type}>
                      <input
                        ref={firstFocusRef}
                        type="text"
                        value={form.titulo}
                        onChange={(event) => setCampo("titulo", event.target.value)}
                        className={inputBase}
                        placeholder="Ex.: Atualização em cuidados paliativos na APS"
                        maxLength={200}
                        disabled={salvando}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Departamento responsável"
                    required
                    icon={Building2}
                    hint="Selecione o departamento oficial responsável pela programação."
                  >
                    <select
                      value={form.departamento}
                      onChange={(event) =>
                        setCampo("departamento", event.target.value)
                      }
                      className={inputBase}
                      disabled={salvando}
                      required
                    >
                      <option value="">Selecione o departamento</option>
                      {departamentosNormalizados.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Tipo de programação">
                    <input
                      type="text"
                      value={form.tipo}
                      onChange={(event) => setCampo("tipo", event.target.value)}
                      className={inputBase}
                      placeholder="Curso, oficina, encontro..."
                      disabled={salvando}
                    />
                  </Field>

                  <Field label="Unidade responsável">
                    <select
                      value={form.unidade_id}
                      onChange={(event) => setCampo("unidade_id", event.target.value)}
                      className={inputBase}
                      disabled={salvando}
                    >
                      <option value="">Selecione</option>
                      {unidades.map((unidade) => (
                        <option key={unidade.id} value={unidade.id}>
                          {unidade.nome}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Modalidade">
                    <select
                      value={form.modalidade}
                      onChange={(event) => setCampo("modalidade", event.target.value)}
                      className={inputBase}
                      disabled={salvando}
                    >
                      <option value="">Selecione</option>
                      {MODALIDADE_OFICIAL.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Local" icon={MapPin}>
                    <input
                      type="text"
                      value={form.local}
                      onChange={(event) => setCampo("local", event.target.value)}
                      className={inputBase}
                      placeholder="Ex.: Auditório da Escola da Saúde, remoto via Teams..."
                      disabled={salvando}
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Descrição">
                      <textarea
                        value={form.descricao}
                        onChange={(event) => setCampo("descricao", event.target.value)}
                        rows={4}
                        className={textareaBase}
                        placeholder="Objetivos, conteúdo e observações."
                        disabled={salvando}
                      />
                    </Field>
                  </div>

                  <Field label="Público-alvo">
                    <textarea
                      value={form.publico_alvo}
                      onChange={(event) =>
                        setCampo("publico_alvo", event.target.value)
                      }
                      rows={3}
                      className={textareaBase}
                      placeholder="Ex.: enfermeiros da APS, residentes..."
                      disabled={salvando}
                    />
                  </Field>

                  <Field
                    label="Carga horária total"
                    hint="Se vazio, a carga estimada aparece com base nos horários informados."
                  >
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.carga_horaria_total}
                      onChange={(event) =>
                        setCampo("carga_horaria_total", event.target.value)
                      }
                      className={inputBase}
                      placeholder="Ex.: 8"
                      disabled={salvando}
                    />
                  </Field>

                  <div className="md:col-span-2 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={form.gera_certificado}
                        onChange={(event) =>
                          setCampo("gera_certificado", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        disabled={salvando}
                      />
                      Esta programação gera certificado
                    </label>

                    {isEdicao && podeEditarStatus ? (
                      <div className="w-full sm:w-64">
                        <Field label="Status da programação">
                          <select
                            value={form.status}
                            onChange={(event) =>
                              setCampo("status", event.target.value)
                            }
                            className={inputBase}
                            disabled={salvando}
                          >
                            {STATUS_OFICIAL.map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Section>

              <Section
                title="Datas e horários"
                icon={Clock}
                description="Informe pelo menos uma data válida. Horários são opcionais, mas devem respeitar início antes do fim."
              >
                <div className="mb-4 flex justify-end">
                  <Button
                    icon={Plus}
                    tone="emerald"
                    disabled={salvando}
                    onClick={adicionarData}
                  >
                    Adicionar data
                  </Button>
                </div>

                <div className="space-y-3">
                  {datas.map((linha) => (
                    <div
                      key={linha.id}
                      className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:grid-cols-[1.2fr_1fr_1fr_auto]"
                    >
                      <Field label="Data" required>
                        <input
                          type="date"
                          value={linha.data}
                          onChange={(event) =>
                            setLinhaData(linha.id, "data", event.target.value)
                          }
                          className={inputBase}
                          disabled={salvando}
                        />
                      </Field>

                      <Field label="Início">
                        <input
                          type="time"
                          value={linha.horario_inicio || ""}
                          onChange={(event) =>
                            setLinhaData(
                              linha.id,
                              "horario_inicio",
                              event.target.value
                            )
                          }
                          className={inputBase}
                          disabled={salvando}
                        />
                      </Field>

                      <Field label="Fim">
                        <input
                          type="time"
                          value={linha.horario_fim || ""}
                          onChange={(event) =>
                            setLinhaData(
                              linha.id,
                              "horario_fim",
                              event.target.value
                            )
                          }
                          className={inputBase}
                          disabled={salvando}
                        />
                      </Field>

                      <div className="flex items-end justify-end">
                        <Button
                          icon={Trash2}
                          tone="rose"
                          disabled={salvando || datas.length === 1}
                          onClick={() => removerData(linha.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Palestrantes"
                icon={School}
                description="Adicione os nomes dos palestrantes externos ou ainda não cadastrados."
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={novoPalestrante}
                    onChange={(event) => setNovoPalestrante(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        adicionarPalestrante();
                      }
                    }}
                    placeholder="Digite o nome completo e pressione Enter"
                    className={cx(inputBase, "flex-1")}
                    disabled={salvando}
                  />

                  <Button
                    icon={Plus}
                    tone="emerald"
                    disabled={salvando}
                    onClick={adicionarPalestrante}
                    className="shrink-0"
                  >
                    Adicionar
                  </Button>
                </div>

                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  {palestrantes.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhum palestrante adicionado.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {palestrantes.map((nome, index) => (
                        <li
                          key={`${nome}-${index}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <Users className="h-4 w-4 flex-none text-emerald-600" />
                          <span className="max-w-[220px] truncate">{nome}</span>

                          <button
                            type="button"
                            onClick={() => removerPalestrante(index)}
                            disabled={salvando}
                            className="text-slate-400 transition hover:text-rose-500 disabled:opacity-60"
                            aria-label={`Remover palestrante ${nome}`}
                            title="Remover"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>

              <Section
                title="Controle de acesso"
                icon={Lock}
                description="Use restrição apenas quando houver critério real de público, categoria, unidade ou perfil."
              >
                <label className="inline-flex items-start gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={form.restrito}
                    onChange={(event) => setCampo("restrito", event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                  <span>
                    Esta programação possui acesso <strong>restrito</strong>.
                  </span>
                </label>

                {form.restrito ? (
                  <div className="mt-4">
                    <Field label="Descreva a restrição" required icon={Unlock}>
                      <textarea
                        value={form.restricao_descricao}
                        onChange={(event) =>
                          setCampo("restricao_descricao", event.target.value)
                        }
                        rows={3}
                        className={textareaBase}
                        placeholder="Ex.: Restrito a enfermeiros da APS, residentes, profissionais da UPA Central..."
                        disabled={salvando}
                      />
                    </Field>
                  </div>
                ) : null}
              </Section>
            </form>
          </div>

<footer className="shrink-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Campos com <span className="font-bold text-rose-500">*</span> são
              obrigatórios.
            </p>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button tone="slate" onClick={fechar} disabled={salvando}>
                Cancelar
              </Button>

              <Button
                type="submit"
                form={`form-calendario-eps-${uid}`}
                tone="primary"
                icon={Save}
                loading={salvando}
                onClick={() => {}}
              >
                {salvando
                  ? isEdicao
                    ? "Salvando..."
                    : "Cadastrando..."
                  : isEdicao
                    ? "Salvar alterações"
                    : "Cadastrar programação"}
              </Button>
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}