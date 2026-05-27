// 📁 src/components/agendaSalas/ModalReservaAdmin.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal administrativo de reserva/agendamento de salas.
//
// Contratos oficiais usados:
// - POST   /api/sala/admin/reservas
// - PUT    /api/sala/admin/reservas/:id
// - DELETE /api/sala/admin/reservas/:id
// - GET    /api/sala/admin/reservas/:id/termo-pdf
//
// Status oficiais atuais:
// - pendente
// - aprovado
// - rejeitado
// - cancelado
// - bloqueado
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem Modal antigo;
// - sem ModalConfirmacao antigo;
// - sem "excluir" como conceito operacional principal;
// - DELETE administrativo = cancelamento lógico no backend;
// - sem status "confirmado" enquanto não existir no banco;
// - sem aliases de status;
// - sem abrir PDF direto sem autenticação;
// - usa apiGetFile para termo assinado;
// - resposta padrão ok/data/message/code/meta;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - anti-fuso: date-only em YYYY-MM-DD.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  ExternalLink,
  FileSignature,
  FileText,
  Info,
  Loader2,
  Repeat,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import api, { apiGetFile } from "../../services/api";
import Modal from "../ui/Modal";

/* =========================================================================
   Constantes
=========================================================================== */

const STATUS_OFICIAL = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "cancelado", label: "Cancelado" },
  { value: "bloqueado", label: "Bloqueado" },
];

const STATUS_SET = new Set(STATUS_OFICIAL.map((item) => item.value));

const PERIODOS = {
  manha: "Período da manhã",
  tarde: "Período da tarde",
};

const DIAS_SEMANA_LABEL_COMPLETO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toBrDateFromISO(dateISO) {
  const iso = String(dateISO || "").slice(0, 10);

  if (!isYMD(iso)) return iso || "—";

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function toBrDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} às ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function dateFromYMD(dateISO) {
  const iso = String(dateISO || "").slice(0, 10);

  if (!isYMD(iso)) return null;

  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function trimmedOrNull(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizarStatus(value) {
  const status = String(value || "").trim().toLowerCase();

  return STATUS_SET.has(status) ? status : "aprovado";
}

function normalizarPeriodo(value) {
  const periodo = String(value || "").trim();

  return periodo === "manha" || periodo === "tarde" ? periodo : "manha";
}

function normalizarSala(value) {
  const sala = String(value || "").trim();

  return sala === "auditorio" || sala === "sala_reuniao" ? sala : "sala_reuniao";
}

function salaLabel(value) {
  if (value === "auditorio") return "Auditório";
  if (value === "sala_reuniao") return "Sala de Reunião";
  return "Sala";
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapData(response) {
  if (response?.data && typeof response.data === "object" && "ok" in response.data) {
    return response.data.data || {};
  }

  if (response && typeof response === "object" && "ok" in response) {
    return response.data || {};
  }

  return response?.data || response || {};
}

function prioridadeStatus(status) {
  const normalized = normalizarStatus(status);

  if (normalized === "pendente") return 5;
  if (normalized === "aprovado") return 4;
  if (normalized === "bloqueado") return 3;
  if (normalized === "rejeitado") return 2;
  if (normalized === "cancelado") return 1;

  return 0;
}

function statusBadgeClass(status) {
  const normalized = normalizarStatus(status);

  const map = {
    pendente:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
    aprovado:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
    rejeitado:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
    cancelado:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
    bloqueado:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
  };

  return map[normalized] || map.aprovado;
}

function statusLabel(status) {
  return STATUS_OFICIAL.find((item) => item.value === normalizarStatus(status))?.label || "Aprovado";
}

/* =========================================================================
   UI local
=========================================================================== */

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    warning: {
      icon: AlertTriangle,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MiniCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
        <span className="text-xs font-black uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 break-words text-base font-black text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function Section({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">
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

function ConfirmCancelModal({ open, loading, reserva, onClose, onConfirm }) {
  if (!open || !reserva) return null;

  return (
    <div className="fixed inset-0 z-[1300]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancelar-reserva-admin-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="cancelar-reserva-admin-title"
                  className="text-lg font-black text-slate-900 dark:text-white"
                >
                  Cancelar reserva?
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  O backend v2.0 preserva o histórico e altera o status para cancelado.
                </p>
              </div>

              <button
                type="button"
                onClick={loading ? undefined : onClose}
                disabled={loading}
                className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900/60 dark:bg-rose-950/20">
              <p className="text-rose-800 dark:text-rose-200">
                <span className="font-black">Finalidade:</span>{" "}
                {reserva.finalidade || "Sem finalidade informada"}
              </p>
              <p className="mt-1 text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Solicitante:</span>{" "}
                {reserva.solicitante_nome || reserva.solicitante_id || "—"}
              </p>
              <p className="mt-1 text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Status atual:</span>{" "}
                {statusLabel(reserva.status)}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              O horário será liberado para novas solicitações, mas o registro continuará disponível para rastreabilidade.
            </p>
          </div>

          <footer className="flex justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={loading ? undefined : onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {loading ? "Cancelando..." : "Cancelar reserva"}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

ConfirmCancelModal.propTypes = {
  open: PropTypes.bool,
  loading: PropTypes.bool,
  reserva: PropTypes.object,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
};

/* =========================================================================
   Componente principal
=========================================================================== */

export default function ModalReservaAdmin({
  isOpen = true,
  onClose,
  slot,
  reserva,
  sala,
  capacidadeSala,
  recarregar,
}) {
  const uid = useId();
  const titleId = `modal-reserva-admin-title-${uid}`;
  const descId = `modal-reserva-admin-desc-${uid}`;
  const firstFocusRef = useRef(null);

  const isEdicao = Boolean(reserva?.id);

  const dataISO = String(slot?.dataISO || reserva?.data || "").slice(0, 10);
  const periodo = normalizarPeriodo(slot?.periodo || reserva?.periodo || "manha");
  const salaKey = normalizarSala(sala || slot?.sala || reserva?.sala || "sala_reuniao");

  const safeCap = capacidadeSala || {
    conforto: salaKey === "auditorio" ? 50 : 25,
    max: salaKey === "auditorio" ? 60 : 30,
  };

  const max = Number(safeCap.max ?? 999);

  const dataBase = useMemo(() => dateFromYMD(dataISO), [dataISO]);
  const diaMesBase = dataBase?.getDate?.() ?? null;
  const mesBaseIndex = dataBase?.getMonth?.() ?? 0;
  const diaSemanaBaseIndex = dataBase?.getDay?.() ?? 0;
  const diaSemanaBaseLabel =
    DIAS_SEMANA_LABEL_COMPLETO[diaSemanaBaseIndex] || "dia da semana";

  const { ordemSemanaBase, ehUltimaSemana } = useMemo(() => {
    if (!dataBase) return { ordemSemanaBase: 1, ehUltimaSemana: false };

    const dia = dataBase.getDate();
    const ordem = Math.floor((dia - 1) / 7) + 1;
    const maisSete = new Date(dataBase);

    maisSete.setDate(dia + 7);

    return {
      ordemSemanaBase: ordem,
      ehUltimaSemana: maisSete.getMonth() !== dataBase.getMonth(),
    };
  }, [dataBase]);

  const solicitanteNome =
    reserva?.solicitante_nome ||
    (reserva?.solicitante_id ? `ID ${reserva.solicitante_id}` : "");

  const solicitanteUnidade =
    reserva?.solicitante_unidade || reserva?.unidade_nome || "";

  const aprovadorNome = reserva?.aprovador_nome || "";

  const assinaturaEm = reserva?.termo_assinado_em || "";
  const assinaturaNomeCompleto = reserva?.assinatura_nome_completo || solicitanteNome || "";

  const termoAssinadoDisponivel = Boolean(
    reserva?.id &&
      reserva?.termo_aceito &&
      reserva?.termo_assinado_em &&
      reserva?.assinatura_id
  );

  const [qtdPessoas, setQtdPessoas] = useState(
    reserva?.qtd_pessoas != null ? String(reserva.qtd_pessoas) : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(Boolean(reserva?.coffee_break));
  const [status, setStatus] = useState(normalizarStatus(reserva?.status || "aprovado"));
  const [observacao, setObservacao] = useState(reserva?.observacao || "");
  const [finalidade, setFinalidade] = useState(reserva?.finalidade || "");

  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [msgA11y, setMsgA11y] = useState("");

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [usarRecorrencia, setUsarRecorrencia] = useState(false);
  const [tipoRecorrencia, setTipoRecorrencia] = useState("semanal");
  const [qtdRepeticao, setQtdRepeticao] = useState(4);
  const [limiteMesesSempre, setLimiteMesesSempre] = useState(24);
  const [intervaloSemanas, setIntervaloSemanas] = useState(1);
  const [diasSemanaRecorrencia, setDiasSemanaRecorrencia] = useState(() => [
    diaSemanaBaseIndex,
  ]);
  const [mensalModo, setMensalModo] = useState("dia_mes");
  const [anualModo, setAnualModo] = useState("dia_mes");
  const [mesesAnual, setMesesAnual] = useState([mesBaseIndex]);

  function showMessage(payload) {
    setMensagem(payload);
    setMsgA11y(`${payload.title || ""} ${payload.message || ""}`.trim());
  }

  useEffect(() => {
    if (!isOpen) return;

    setQtdPessoas(reserva?.qtd_pessoas != null ? String(reserva.qtd_pessoas) : "");
    setCoffeeBreak(Boolean(reserva?.coffee_break));
    setStatus(normalizarStatus(reserva?.status || "aprovado"));
    setObservacao(reserva?.observacao || "");
    setFinalidade(reserva?.finalidade || "");
    setLoading(false);
    setMensagem(null);
    setMsgA11y("");

    setUsarRecorrencia(false);
    setTipoRecorrencia("semanal");
    setQtdRepeticao(4);
    setLimiteMesesSempre(24);
    setIntervaloSemanas(1);
    setDiasSemanaRecorrencia([diaSemanaBaseIndex]);
    setMensalModo("dia_mes");
    setAnualModo("dia_mes");
    setMesesAnual([mesBaseIndex]);
    setConfirmCancelOpen(false);

    const timer = window.setTimeout(() => {
      firstFocusRef.current?.focus?.();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [
    isOpen,
    reserva?.id,
    reserva?.qtd_pessoas,
    reserva?.coffee_break,
    reserva?.status,
    reserva?.observacao,
    reserva?.finalidade,
    diaSemanaBaseIndex,
    mesBaseIndex,
  ]);

  const minis = useMemo(
    () => ({
      data: toBrDateFromISO(dataISO),
      sala: salaLabel(salaKey),
      periodo: periodo === "manha" ? "Manhã" : "Tarde",
      pessoas: Number(qtdPessoas) > 0 ? Number(qtdPessoas) : "—",
      cap: max,
    }),
    [dataISO, salaKey, periodo, qtdPessoas, max]
  );

  const tituloModal = isEdicao ? "Editar reserva / solicitação" : "Criar reserva / bloqueio";

  function toggleDiaSemanaRecorrencia(index) {
    setDiasSemanaRecorrencia((current) => {
      if (current.includes(index)) {
        const next = current.filter((item) => item !== index);
        return next.length ? next : [index];
      }

      return [...current, index].sort((a, b) => a - b);
    });
  }

  function toggleMesAnual(index) {
    setMesesAnual((current) => {
      if (current.includes(index)) {
        const next = current.filter((item) => item !== index);
        return next.length ? next : [index];
      }

      return [...current, index].sort((a, b) => a - b);
    });
  }

  function construirRecorrenciaPayload() {
    if (!usarRecorrencia || isEdicao) return null;

    if (tipoRecorrencia === "sempre") {
      const limite = Math.max(1, Math.min(120, Number(limiteMesesSempre) || 24));
      return { tipo: "sempre", limiteMeses: limite };
    }

    const repeticao = Math.max(0, Number(qtdRepeticao) || 0);

    if (repeticao <= 0) {
      return {
        erro: "Informe a quantidade de repetições.",
      };
    }

    if (tipoRecorrencia === "semanal") {
      const intervalo = Math.max(1, Math.min(52, Number(intervaloSemanas) || 1));

      if (!diasSemanaRecorrencia.length) {
        return {
          erro: "Selecione ao menos um dia da semana.",
        };
      }

      return {
        tipo: "semanal",
        repeticao,
        semanal: {
          intervaloSemanas: intervalo,
          diasSemana: diasSemanaRecorrencia,
        },
      };
    }

    if (tipoRecorrencia === "mensal") {
      if (!diaMesBase) {
        return {
          erro: "Data base inválida para recorrência mensal.",
        };
      }

      if (mensalModo === "ordem_semana") {
        return {
          tipo: "mensal",
          repeticao,
          mensal: {
            modo: "ordem_semana",
            diaSemanaBaseIndex,
            ordemSemanaBase,
            ehUltimaSemana,
          },
        };
      }

      return {
        tipo: "mensal",
        repeticao,
        mensal: {
          modo: "dia_mes",
          diaMesBase,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
        },
      };
    }

    if (tipoRecorrencia === "anual") {
      if (!diaMesBase) {
        return {
          erro: "Data base inválida para recorrência anual.",
        };
      }

      if (!mesesAnual.length) {
        return {
          erro: "Selecione ao menos um mês para a recorrência anual.",
        };
      }

      return {
        tipo: "anual",
        repeticao,
        anual: {
          modo: anualModo,
          diaMesBase,
          mesBaseIndex,
          diaSemanaBaseIndex,
          ordemSemanaBase,
          ehUltimaSemana,
          meses: mesesAnual,
        },
      };
    }

    return null;
  }

  function validarFormulario() {
    const qtd = Number(qtdPessoas);

    if (!Number.isInteger(qtd) || qtd <= 0) {
      return "Informe a quantidade de pessoas.";
    }

    if (qtd > max) {
      return `A capacidade máxima desta sala é de ${max} pessoas.`;
    }

    if (!isYMD(dataISO)) {
      return "Data inválida para a reserva.";
    }

    if (!STATUS_SET.has(status)) {
      return "Status inválido para reserva de sala.";
    }

    if (status === "bloqueado" && !trimmedOrNull(finalidade)) {
      return "Para bloqueio interno, informe a finalidade/motivo.";
    }

    return null;
  }

  async function abrirTermoPdf() {
    if (!termoAssinadoDisponivel) {
      showMessage({
        type: "info",
        title: "Termo indisponível",
        message: "Esta solicitação ainda não possui termo assinado disponível.",
      });
      return;
    }

    try {
      const { blob, filename } = await apiGetFile(
        `/salas/admin/reservas/${reserva.id}/termo-pdf`
      );

      if (!blob || typeof blob.size !== "number" || blob.size <= 0) {
        throw new Error("Resposta inválida ao carregar o PDF do termo.");
      }

      const blobUrl = URL.createObjectURL(blob);
      const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");

      if (!opened) {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = filename || `termo-reserva-${reserva.id}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (error) {
      showMessage({
        type: "error",
        title: "Erro ao abrir termo",
        message: getErrorMessage(
          error,
          "Não foi possível abrir o PDF do termo assinado."
        ),
      });
    }
  }

  async function salvar() {
    if (loading) return;

    setMensagem(null);
    setLoading(true);
    setMsgA11y(isEdicao ? "Salvando alterações." : "Criando reserva.");

    try {
      const erro = validarFormulario();

      if (erro) {
        showMessage({
          type: "warning",
          title: "Revise os dados",
          message: erro,
        });
        return;
      }

      const qtd = Number(qtdPessoas);

      const payloadBase = {
        sala: salaKey,
        data: dataISO,
        periodo,
        qtd_pessoas: qtd,
        coffee_break: Boolean(coffeeBreak),
        status,
        observacao: trimmedOrNull(observacao),
        finalidade: trimmedOrNull(finalidade),
      };

      if (isEdicao) {
        await api.put(`/salas/admin/reservas/${reserva.id}`, payloadBase);

        showMessage({
          type: "success",
          title: "Reserva atualizada",
          message: "A reserva foi atualizada com sucesso.",
        });
      } else {
        let recorrencia = null;

        if (usarRecorrencia) {
          recorrencia = construirRecorrenciaPayload();

          if (recorrencia?.erro) {
            showMessage({
              type: "warning",
              title: "Revise a recorrência",
              message: recorrencia.erro,
            });
            return;
          }
        }

        const response = await api.post("/salas/admin/reservas", {
          ...payloadBase,
          recorrencia,
        });

        const data = unwrapData(response);
        const inseridas = Array.isArray(data.inseridas) ? data.inseridas : [];
        const conflitos = Array.isArray(data.conflitos) ? data.conflitos : [];

        if (inseridas.length > 0 && conflitos.length > 0) {
          showMessage({
            type: "warning",
            title: "Reservas criadas com conflitos",
            message: `${inseridas.length} reserva(s) criada(s). ${conflitos.length} data(s) foram ignoradas por conflito.`,
          });
        } else if (inseridas.length > 0) {
          showMessage({
            type: "success",
            title: "Reserva criada",
            message:
              inseridas.length === 1
                ? "Reserva criada com sucesso."
                : `${inseridas.length} reservas criadas com sucesso.`,
          });
        } else {
          showMessage({
            type: "info",
            title: "Nenhuma reserva criada",
            message: "Nenhuma reserva foi criada. Verifique se houve conflito de agenda.",
          });
        }
      }

      await recarregar?.();
      onClose?.();
    } catch (error) {
      showMessage({
        type: "error",
        title: isEdicao ? "Erro ao salvar reserva" : "Erro ao criar reserva",
        message: getErrorMessage(error, "Erro ao salvar a reserva da sala."),
      });
    } finally {
      setLoading(false);
    }
  }

  function abrirCancelamento() {
    if (!isEdicao || loading) return;
    setConfirmCancelOpen(true);
  }

  async function executarCancelamento() {
    if (!isEdicao || loading) return;

    setLoading(true);
    setMensagem(null);
    setMsgA11y("Cancelando reserva.");

    try {
      await api.delete(`/salas/admin/reservas/${reserva.id}`);

      showMessage({
        type: "success",
        title: "Reserva cancelada",
        message:
          "A reserva foi cancelada com sucesso e o histórico operacional foi preservado.",
      });

      await recarregar?.();
      onClose?.();
    } catch (error) {
      showMessage({
        type: "error",
        title: "Erro ao cancelar reserva",
        message: getErrorMessage(error, "Não foi possível cancelar a reserva."),
      });
    } finally {
      setLoading(false);
      setConfirmCancelOpen(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <Modal
        open={isOpen}
        onClose={loading ? undefined : onClose}
        labelledBy={titleId}
        describedBy={descId}
        className="w-[96%] max-w-4xl overflow-hidden p-0"
      >
        <header className="bg-gradient-to-br from-slate-950 via-emerald-900 to-teal-700 px-4 py-4 text-white sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                Agenda de salas
              </div>

              <h2
                id={titleId}
                className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
              >
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                {tituloModal}
              </h2>

              <p id={descId} className="mt-1 text-sm text-white/85">
                {minis.data} • {minis.periodo} • {minis.sala}
              </p>
            </div>

            <button
              type="button"
              onClick={loading ? undefined : onClose}
              disabled={loading}
              className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:opacity-60"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <div className="max-h-[calc(92vh-86px)] overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-zinc-950 sm:px-6">
          {mensagem ? (
            <div className="mb-4">
              <AlertBox
                type={mensagem.type}
                title={mensagem.title}
                message={mensagem.message}
                onClose={() => setMensagem(null)}
              />
            </div>
          ) : null}

          <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniCard icon={Building2} label="Sala" value={minis.sala} />
            <MiniCard icon={Clock} label="Período" value={minis.periodo} />
            <MiniCard icon={Users} label="Pessoas" value={minis.pessoas} />
            <MiniCard icon={CalendarDays} label="Capacidade" value={minis.cap} />
          </section>

          <div className="space-y-4">
            {isEdicao ? (
              <Section
                title="Dados da solicitação"
                description="Informações do solicitante, aprovação e termo assinado quando disponível."
                icon={UserCheck}
              >
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-black">Solicitante:</span>{" "}
                        {solicitanteNome || "—"}
                        {solicitanteUnidade ? (
                          <span className="text-slate-500 dark:text-slate-400">
                            {" "}
                            • {solicitanteUnidade}
                          </span>
                        ) : null}
                      </p>

                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-black">Finalidade original:</span>{" "}
                        {reserva?.finalidade || "—"}
                      </p>
                    </div>

                    <span
                      className={cx(
                        "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-black",
                        statusBadgeClass(reserva?.status)
                      )}
                    >
                      Status atual: {statusLabel(reserva?.status)}
                    </span>
                  </div>

                  {(aprovadorNome || termoAssinadoDisponivel) ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1 text-sm text-emerald-900 dark:text-emerald-100">
                          <p>
                            <span className="font-black">Aprovado por:</span>{" "}
                            {aprovadorNome || "Ainda não informado"}
                          </p>

                          <p>
                            <span className="font-black">Assinante do termo:</span>{" "}
                            {assinaturaNomeCompleto || "—"}
                          </p>

                          <p>
                            <span className="font-black">Assinado em:</span>{" "}
                            {assinaturaEm ? toBrDateTime(assinaturaEm) : "—"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={abrirTermoPdf}
                          disabled={!termoAssinadoDisponivel || loading}
                          className={cx(
                            "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition disabled:opacity-60",
                            termoAssinadoDisponivel
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : "cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                          )}
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver termo assinado
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}

            <Section
              title="Dados administrativos"
              description="Defina quantidade, status, finalidade e observações internas."
              icon={ShieldCheck}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Quantidade de pessoas
                  </label>
                  <input
                    ref={firstFocusRef}
                    type="number"
                    min={1}
                    max={max}
                    value={qtdPessoas}
                    onChange={(event) => setQtdPessoas(event.target.value)}
                    disabled={loading}
                    className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    placeholder={`Até ${max} pessoas`}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Capacidade máxima: <strong>{max}</strong> pessoas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    disabled={loading}
                    className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  >
                    {STATUS_OFICIAL.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  {status === "bloqueado" ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      Para bloqueio interno, informe a finalidade/motivo.
                    </p>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:col-span-2">
                  <Coffee className="h-4 w-4 text-slate-500" />
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={coffeeBreak}
                    onChange={(event) => setCoffeeBreak(event.target.checked)}
                    disabled={loading}
                  />
                  Haverá coffee break?
                </label>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Finalidade / evento {status === "bloqueado" ? <span className="text-rose-500">*</span> : null}
                  </label>
                  <textarea
                    rows={3}
                    value={finalidade}
                    onChange={(event) => setFinalidade(event.target.value)}
                    disabled={loading}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Ex.: reunião da equipe, aula do curso, oficina, bloqueio técnico..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Observações internas
                  </label>
                  <textarea
                    rows={3}
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    disabled={loading}
                    className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Observações para a equipe administrativa."
                  />
                </div>
              </div>
            </Section>

            {!isEdicao ? (
              <Section
                title="Recorrência"
                description="A recorrência é aplicada apenas na criação e pode gerar várias reservas seguindo a mesma configuração."
                icon={Repeat}
              >
                <div className="space-y-4">
                  <label className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <span>
                      <span className="block text-sm font-black text-emerald-900 dark:text-emerald-100">
                        Aplicar recorrência
                      </span>
                      <span className="block text-xs text-emerald-800/80 dark:text-emerald-100/75">
                        Datas em finais de semana, feriados e bloqueios podem ser ignoradas pelo backend.
                      </span>
                    </span>

                    <input
                      type="checkbox"
                      checked={usarRecorrencia}
                      onChange={(event) => setUsarRecorrencia(event.target.checked)}
                      disabled={loading}
                      className="h-5 w-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>

                  {usarRecorrencia ? (
                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Tipo de recorrência
                          </label>
                          <div className="relative mt-1">
                            <select
                              value={tipoRecorrencia}
                              onChange={(event) => setTipoRecorrencia(event.target.value)}
                              disabled={loading}
                              className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                            >
                              <option value="semanal">Semanal</option>
                              <option value="mensal">Mensal</option>
                              <option value="anual">Anual</option>
                              <option value="sempre">Sempre mensal</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
                          </div>
                        </div>

                        {tipoRecorrencia !== "sempre" ? (
                          <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Quantidade de repetições
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={qtdRepeticao}
                              onChange={(event) => setQtdRepeticao(event.target.value)}
                              disabled={loading}
                              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Limite em meses
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={limiteMesesSempre}
                              onChange={(event) => setLimiteMesesSempre(event.target.value)}
                              disabled={loading}
                              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        )}
                      </div>

                      {tipoRecorrencia === "semanal" ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Intervalo em semanas
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={52}
                              value={intervaloSemanas}
                              onChange={(event) => setIntervaloSemanas(event.target.value)}
                              disabled={loading}
                              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 sm:w-48"
                            />
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Dias da semana
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {DIAS_SEMANA_CURTO.map((label, index) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => toggleDiaSemanaRecorrencia(index)}
                                  disabled={loading}
                                  className={cx(
                                    "rounded-full border px-3 py-1.5 text-xs font-black transition",
                                    diasSemanaRecorrencia.includes(index)
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {tipoRecorrencia === "mensal" ? (
                        <div className="space-y-3">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Modo mensal
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <label
                              className={cx(
                                "rounded-2xl border p-3 text-sm transition",
                                mensalModo === "dia_mes"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              )}
                            >
                              <input
                                type="radio"
                                name="mensalModo"
                                value="dia_mes"
                                checked={mensalModo === "dia_mes"}
                                onChange={(event) => setMensalModo(event.target.value)}
                                disabled={loading}
                                className="mr-2"
                              />
                              Todo dia {diaMesBase || "—"} do mês
                            </label>

                            <label
                              className={cx(
                                "rounded-2xl border p-3 text-sm transition",
                                mensalModo === "ordem_semana"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              )}
                            >
                              <input
                                type="radio"
                                name="mensalModo"
                                value="ordem_semana"
                                checked={mensalModo === "ordem_semana"}
                                onChange={(event) => setMensalModo(event.target.value)}
                                disabled={loading}
                                className="mr-2"
                              />
                              {ehUltimaSemana
                                ? `Última ${diaSemanaBaseLabel} do mês`
                                : `${ordemSemanaBase}ª ${diaSemanaBaseLabel} do mês`}
                            </label>
                          </div>
                        </div>
                      ) : null}

                      {tipoRecorrencia === "anual" ? (
                        <div className="space-y-3">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Modo anual
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <label
                              className={cx(
                                "rounded-2xl border p-3 text-sm transition",
                                anualModo === "dia_mes"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              )}
                            >
                              <input
                                type="radio"
                                name="anualModo"
                                value="dia_mes"
                                checked={anualModo === "dia_mes"}
                                onChange={(event) => setAnualModo(event.target.value)}
                                disabled={loading}
                                className="mr-2"
                              />
                              Mesmo dia do mês
                            </label>

                            <label
                              className={cx(
                                "rounded-2xl border p-3 text-sm transition",
                                anualModo === "ordem_semana"
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
                                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              )}
                            >
                              <input
                                type="radio"
                                name="anualModo"
                                value="ordem_semana"
                                checked={anualModo === "ordem_semana"}
                                onChange={(event) => setAnualModo(event.target.value)}
                                disabled={loading}
                                className="mr-2"
                              />
                              Mesma ordem semanal
                            </label>
                          </div>

                          <div>
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Meses
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {MESES.map((label, index) => (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => toggleMesAnual(index)}
                                  disabled={loading}
                                  className={cx(
                                    "rounded-full border px-3 py-1.5 text-xs font-black transition",
                                    mesesAnual.includes(index)
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Section>
            ) : null}

            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Info className="mt-0.5 h-4 w-4 flex-none text-emerald-600 dark:text-emerald-300" />
              <p>
                Use esta tela para aprovar, rejeitar, cancelar, bloquear ou criar reservas internas.
                A recorrência é aplicada somente na criação. Cancelamentos preservam histórico e liberam o horário.
              </p>
            </div>
          </div>
        </div>

        <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-zinc-950/90 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            {isEdicao && termoAssinadoDisponivel ? (
              <button
                type="button"
                onClick={abrirTermoPdf}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
              >
                <FileSignature className="h-4 w-4" />
                Termo assinado
              </button>
            ) : null}

            {isEdicao ? (
              <button
                type="button"
                onClick={abrirCancelamento}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20"
              >
                <Trash2 className="h-4 w-4" />
                Cancelar reserva
              </button>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={loading ? undefined : onClose}
              disabled={loading}
              className="rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition hover:bg-slate-300 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={salvar}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
              aria-busy={loading ? "true" : "false"}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading
                ? isEdicao
                  ? "Salvando..."
                  : "Criando..."
                : isEdicao
                  ? "Salvar alterações"
                  : "Criar reserva"}
            </button>
          </div>
        </footer>
      </Modal>

      <ConfirmCancelModal
        open={confirmCancelOpen}
        loading={loading}
        reserva={reserva}
        onClose={() => {
          if (loading) return;
          setConfirmCancelOpen(false);
        }}
        onConfirm={executarCancelamento}
      />
    </>
  );
}

ModalReservaAdmin.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  slot: PropTypes.shape({
    dataISO: PropTypes.string,
    periodo: PropTypes.string,
    sala: PropTypes.string,
  }),
  reserva: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sala: PropTypes.string,
    data: PropTypes.string,
    periodo: PropTypes.string,
    qtd_pessoas: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    coffee_break: PropTypes.bool,
    status: PropTypes.string,
    observacao: PropTypes.string,
    finalidade: PropTypes.string,
    solicitante_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    solicitante_nome: PropTypes.string,
    solicitante_unidade: PropTypes.string,
    aprovador_nome: PropTypes.string,
    termo_aceito: PropTypes.bool,
    termo_assinado_em: PropTypes.string,
    assinatura_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    assinatura_nome_completo: PropTypes.string,
  }),
  sala: PropTypes.string,
  capacidadeSala: PropTypes.shape({
    conforto: PropTypes.number,
    max: PropTypes.number,
  }),
  recarregar: PropTypes.func,
};