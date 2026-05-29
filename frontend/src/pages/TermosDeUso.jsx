// 📁 src/components/agendaSalas/ModalSolicitarReserva.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal de criação/edição de solicitação de reserva de sala.
//
// Contratos oficiais usados:
// - POST /api/sala/solicitar
// - PUT  /api/sala/minhas/:id
// - api.assinatura.minha()
// - api.assinatura.salvar(payload)
//
// Status oficiais atuais do backend:
// - pendente
// - aprovado
// - rejeitado
// - cancelado
// - bloqueado
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem Modal antigo;
// - sem aliases de status;
// - sem resposta { erro } como contrato;
// - criação exige termo aceito e assinatura;
// - edição não reabre termo;
// - anti-fuso: date-only em YYYY-MM-DD;
// - período oficial: manha | tarde;
// - sala oficial: auditorio | sala_reuniao;
// - termo com ciência obrigatória de confirmação entre 7 dias e 48 horas antes;
// - UX/UI premium real;
// - mobile-first;
// - acessível.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  FileSignature,
  Info,
  Loader2,
  PenTool,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import api from "../../services/api";
import Modal from "../ui/Modal";

/* =========================================================================
   Constantes
=========================================================================== */

const SALAS_OFICIAIS = new Set(["auditorio", "sala_reuniao"]);
const PERIODOS_OFICIAIS = new Set(["manha", "tarde"]);

const PERIODOS = [
  { value: "manha", label: "Período da manhã" },
  { value: "tarde", label: "Período da tarde" },
];

const ASSINATURA_MIN_LENGTH = 100;

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

function brDate(value) {
  const iso = String(value || "").slice(0, 10);

  if (!isYMD(iso)) return iso || "—";

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function brDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return `${pad2(date.getDate())}/${pad2(
    date.getMonth() + 1
  )}/${date.getFullYear()} às ${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}`;
}

function capacidadePorSala(sala) {
  if (sala === "auditorio") {
    return { conforto: 50, max: 60 };
  }

  return { conforto: 25, max: 30 };
}

function salaLabel(value) {
  if (value === "auditorio") return "Auditório";
  if (value === "sala_reuniao") return "Sala de Reunião";
  return "Sala";
}

function periodoLabel(value) {
  return PERIODOS.find((periodo) => periodo.value === value)?.label || "—";
}

function trimmedOrNull(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function normalizarSala(value) {
  const sala = String(value || "").trim();
  return SALAS_OFICIAIS.has(sala) ? sala : "sala_reuniao";
}

function normalizarPeriodo(value) {
  const periodo = String(value || "").trim();
  return PERIODOS_OFICIAIS.has(periodo) ? periodo : "manha";
}

function dataUrlFromBase64(rawBase64, mime = "image/png") {
  if (!rawBase64) return null;

  const raw = String(rawBase64).trim();

  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;

  return `data:${mime};base64,${raw}`;
}

function extractBase64Only(dataUrl) {
  if (!dataUrl) return null;

  const raw = String(dataUrl).trim();

  if (!raw) return null;

  const parts = raw.split(",");
  return parts.length > 1 ? parts[1] : raw;
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapAssinatura(response) {
  const payload =
    response?.data && typeof response.data === "object" && "ok" in response.data
      ? response.data.data
      : response?.data || response || null;

  if (!payload) return null;

  return (
    payload.assinatura ||
    payload.data?.assinatura ||
    payload.registro ||
    payload.item ||
    payload
  );
}

function assinaturaToPreview(assinatura) {
  if (!assinatura) return null;

  if (typeof assinatura === "string") {
    return dataUrlFromBase64(assinatura, "image/png");
  }

  const raw =
    assinatura.imagem_base64 ||
    assinatura.assinatura_base64 ||
    assinatura.base64 ||
    assinatura.imagem ||
    assinatura.arquivo_base64 ||
    assinatura.assinatura ||
    null;

  const mime =
    assinatura.mime ||
    assinatura.arquivo_mime ||
    assinatura.content_type ||
    "image/png";

  return dataUrlFromBase64(raw, mime);
}

function assinaturaId(assinatura) {
  if (!assinatura || typeof assinatura === "string") return null;

  return assinatura.id || assinatura.assinatura_id || null;
}

function getNomeAssinante(assinatura) {
  if (!assinatura || typeof assinatura === "string") return "";

  return (
    assinatura.nome_usuario ||
    assinatura.usuario_nome ||
    assinatura.nome_completo ||
    assinatura.nome_assinante ||
    assinatura.nome ||
    ""
  );
}

function getDataAssinatura(assinatura) {
  if (!assinatura || typeof assinatura === "string") return "";

  return (
    assinatura.assinado_em ||
    assinatura.atualizado_em ||
    assinatura.criado_em ||
    assinatura.data_assinatura ||
    assinatura.created_at ||
    ""
  );
}

function getNomeUsuarioLocal() {
  try {
    const raw = localStorage.getItem("usuario");
    const usuario = raw ? JSON.parse(raw) : null;

    return (
      usuario?.nome_completo ||
      usuario?.nome ||
      usuario?.usuario_nome ||
      usuario?.name ||
      ""
    );
  } catch {
    return "";
  }
}

function textoDocumentoAssinado(nome, dataHora) {
  const nomeSeguro = String(nome || getNomeUsuarioLocal() || "")
    .trim()
    .toUpperCase();

  const dataSegura = brDateTime(dataHora || new Date().toISOString());

  if (!nomeSeguro) {
    return `DOCUMENTO ASSINADO DIGITALMENTE EM ${dataSegura}.`;
  }

  return `DOCUMENTO ASSINADO DIGITALMENTE POR ${nomeSeguro}, EM ${dataSegura}.`;
}

/* =========================================================================
   Componentes locais
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
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

AlertBox.propTypes = {
  type: PropTypes.oneOf(["info", "success", "warning", "error"]),
  title: PropTypes.string,
  message: PropTypes.string,
  onClose: PropTypes.func,
};

function MiniInfo({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <Icon className="h-4 w-4 text-sky-600 dark:text-sky-300" />
        <span className="text-xs font-black uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="mt-2 break-words text-sm font-black text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

MiniInfo.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

/* =========================================================================
   Signature Canvas
=========================================================================== */

function SignatureCanvas({ onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = Math.max(280, Math.floor(rect.width));
    const height = 180;

    const previousData =
      canvas.width && canvas.height ? canvas.toDataURL("image/png") : null;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";

    if (previousData && previousData !== "data:,") {
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        onChange?.(canvas.toDataURL("image/png"));
      };

      img.src = previousData;
    } else {
      onChange?.(canvas.toDataURL("image/png"));
    }
  }, [onChange]);

  useEffect(() => {
    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  function getPoint(clientX, clientY) {
    const canvas = canvasRef.current;

    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function start(clientX, clientY) {
    if (disabled) return;

    drawingRef.current = true;
    lastPointRef.current = getPoint(clientX, clientY);
  }

  function move(clientX, clientY) {
    if (disabled || !drawingRef.current) return;

    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const next = getPoint(clientX, clientY);
    const last = lastPointRef.current;

    if (!next || !last) return;

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();

    lastPointRef.current = next;
    onChange?.(canvas.toDataURL("image/png"));
  }

  function end() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    onChange?.(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="w-full overflow-hidden rounded-2xl border border-slate-300 bg-white dark:border-slate-700"
      >
        <canvas
          ref={canvasRef}
          className={cx("block w-full touch-none", disabled ? "opacity-70" : "")}
          onMouseDown={(event) => start(event.clientX, event.clientY)}
          onMouseMove={(event) => move(event.clientX, event.clientY)}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            start(touch.clientX, touch.clientY);
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (!touch) return;
            move(touch.clientX, touch.clientY);
          }}
          onTouchEnd={end}
          aria-label="Área para desenhar assinatura"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Limpar assinatura
        </button>
      </div>
    </div>
  );
}

SignatureCanvas.propTypes = {
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
};

/* =========================================================================
   Modal do Termo
=========================================================================== */

function ModalTermoUso({
  open,
  onClose,
  finalidade,
  dataISO,
  assinaturaDisponivel,
  assinaturaPreview,
  assinaturaNome,
  assinaturaEm,
  onAssinarTermo,
  loading = false,
}) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      labelledBy="titulo-termo-uso-salas"
      describedBy="descricao-termo-uso-salas"
      className="w-[96%] max-w-4xl overflow-hidden p-0"
    >
      <header className="bg-gradient-to-br from-slate-950 via-slate-800 to-sky-800 px-4 py-4 text-white sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="titulo-termo-uso-salas"
              className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
            >
              <ShieldCheck className="h-5 w-5 text-sky-300" />
              Termo de Uso das Salas
            </h2>

            <p id="descricao-termo-uso-salas" className="mt-1 text-sm text-white/85">
              Escola da Saúde / Secretaria Municipal de Saúde de Santos
            </p>
          </div>

          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            aria-label="Fechar termo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="max-h-[75vh] space-y-4 overflow-y-auto bg-white px-4 py-4 dark:bg-zinc-950 sm:px-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Nome do evento/atividade
              </p>
              <p className="mt-1 break-words text-sm font-black text-slate-900 dark:text-white">
                {finalidade || "—"}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Data reservada
              </p>
              <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                {brDate(dataISO)}
              </p>
            </div>
          </div>
        </div>

        <article className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="text-center">
            <h3 className="text-lg font-black text-slate-900 dark:text-white sm:text-2xl">
              TERMO DE USO DAS SALAS
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Escola da Saúde / SMS
            </p>
          </div>

          <div className="space-y-4 text-sm leading-7 text-slate-700 dark:text-slate-300">
            <p>
              Este Termo tem por objetivo regulamentar o uso do{" "}
              <strong>Auditório</strong> e da <strong>Sala de Reuniões</strong>{" "}
              da Escola da Saúde da Secretaria Municipal de Saúde de Santos,
              estabelecendo responsabilidades, condições de utilização e regras
              de confirmação do agendamento.
            </p>

            <section>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                1. Finalidade de uso
              </h4>
              <p className="mt-2">
                As salas destinam-se, prioritariamente, às atividades de{" "}
                <strong>Educação Permanente em Saúde</strong>, reuniões técnicas,
                formações, oficinas, capacitações e demais ações institucionais
                autorizadas pela Escola da Saúde.
              </p>
            </section>

            <section>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                2. Responsabilidades do responsável pelo evento
              </h4>

              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li>
                  Chegar com antecedência mínima de 30 minutos para preparar a
                  sala, organizar o espaço e verificar os recursos necessários.
                </li>
                <li>
                  O notebook deve ser acessado com o SSHD do responsável. Em caso
                  de visitante, utilizar o SSHD do servidor solicitante.
                </li>
                <li>
                  Coffee break será autorizado somente se informado na
                  solicitação, devendo ser montado apenas na área permitida.
                  Alimentos, descartáveis e limpeza são de responsabilidade do
                  solicitante.
                </li>
                <li>Não é permitido o consumo de alimentos no interior das salas.</li>
                <li>
                  Ao final do evento, devolver a sala às condições originais,
                  recolocar mesas e cadeiras, desligar equipamentos e avisar a
                  equipe da Escola da Saúde.
                </li>
                <li>
                  A Escola da Saúde dispõe de bebedouro, não disponibilizando
                  copos descartáveis.
                </li>
                <li>
                  O horário regular de funcionamento da Escola da Saúde é das 8h
                  às 17h.
                </li>
              </ul>
            </section>

            <section>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                3. Confirmação obrigatória de uso do espaço
              </h4>

              <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                <p>
                  O responsável declara estar ciente de que deverá confirmar,
                  pela plataforma da Escola da Saúde, se de fato utilizará o
                  espaço reservado no período compreendido entre{" "}
                  <strong>7 dias</strong> e <strong>48 horas</strong> antes da
                  data agendada.
                </p>

                <p className="mt-3">
                  Caso a confirmação não seja realizada dentro desse prazo, o
                  agendamento poderá ser{" "}
                  <strong>cancelado pela Escola da Saúde</strong>, com liberação
                  do espaço para outras atividades institucionais.
                </p>

                <p className="mt-3">
                  Essa regra tem como objetivo evitar o bloqueio indevido da
                  agenda, reduzir ausências sem comunicação prévia e permitir
                  melhor organização dos espaços físicos da Escola da Saúde.
                </p>
              </div>
            </section>

            <section>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                4. Cancelamento e não utilização
              </h4>

              <p className="mt-2">
                Caso o responsável identifique que não utilizará mais a sala,
                deverá comunicar ou cancelar a solicitação com antecedência,
                sempre que possível, para que o espaço possa ser disponibilizado
                a outras atividades.
              </p>

              <p className="mt-2">
                A ausência de confirmação dentro do prazo estabelecido neste
                termo poderá ser interpretada como desistência tácita do uso do
                espaço, autorizando o cancelamento administrativo do agendamento.
              </p>
            </section>

            <section>
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                5. Disposições finais
              </h4>

              <p className="mt-2">
                Ao assinar este termo, o responsável declara estar ciente das
                normas acima e compromete-se a cumpri-las integralmente, incluindo
                a obrigação de confirmar o uso do espaço entre 7 dias e 48 horas
                antes da data reservada.
              </p>
            </section>
          </div>

          {assinaturaDisponivel ? (
  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/15">
    <div className="flex items-start gap-3">
      <FileSignature className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-300" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
          Assinatura cadastrada encontrada
        </p>

        <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-100/85">
          Esta assinatura real será utilizada para o aceite digital do termo.
        </p>

        {assinaturaPreview ? (
          <div className="mt-3 inline-block rounded-xl border border-emerald-200 bg-white p-3">
            <img
              src={assinaturaPreview}
              alt="Pré-visualização da assinatura digital cadastrada"
              className="h-20 w-auto object-contain"
            />
          </div>
        ) : null}

        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-emerald-950 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-50 dark:ring-emerald-800/60">
          {textoDocumentoAssinado(assinaturaNome, assinaturaEm)}
        </p>
      </div>
    </div>
  </div>
) : (
  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/15">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-amber-950 dark:text-amber-100">
          Nenhuma assinatura cadastrada
        </p>

        <p className="mt-1 text-xs leading-5 text-amber-900 dark:text-amber-100/85">
          Para assinar este termo, é necessário cadastrar uma assinatura digital
          real. O sistema não criará assinatura automática com nome e sobrenome.
        </p>
      </div>
    </div>
  </div>
)}
        </article>
      </div>

      <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-zinc-950/90 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
          <span>
            O envio da solicitação só será liberado após a concordância e
            assinatura do termo, incluindo a ciência sobre a confirmação
            obrigatória entre 7 dias e 48 horas antes da data reservada.
          </span>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
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
  onClick={onAssinarTermo}
  disabled={loading}
  className={cx(
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-black text-white transition disabled:opacity-60",
    assinaturaDisponivel
      ? "bg-sky-600 hover:bg-sky-700"
      : "bg-amber-600 hover:bg-amber-700"
  )}
>
  {loading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : assinaturaDisponivel ? (
    <FileSignature className="h-4 w-4" />
  ) : (
    <PenTool className="h-4 w-4" />
  )}

  {assinaturaDisponivel ? "Concordar e assinar" : "Criar assinatura"}
</button>
        </div>
      </footer>
    </Modal>
  );
}

ModalTermoUso.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  finalidade: PropTypes.string,
  dataISO: PropTypes.string,
  assinaturaDisponivel: PropTypes.bool,
  assinaturaPreview: PropTypes.string,
  assinaturaNome: PropTypes.string,
  assinaturaEm: PropTypes.string,
  onAssinarTermo: PropTypes.func,
  loading: PropTypes.bool,
};

/* =========================================================================
   Modal de criação de assinatura
=========================================================================== */

function ModalCriarAssinatura({ open, onClose, onSalvar, loading = false, onMessage }) {
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setAssinaturaDataUrl("");
  }, [open]);

  if (!open) return null;

  async function salvar() {
    const base64 = extractBase64Only(assinaturaDataUrl);

    if (!base64 || base64.length < ASSINATURA_MIN_LENGTH) {
      onMessage?.({
        type: "warning",
        title: "Assinatura obrigatória",
        message: "Desenhe sua assinatura antes de salvar.",
      });
      return;
    }

    await onSalvar?.(assinaturaDataUrl);
  }

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      labelledBy="titulo-criar-assinatura"
      describedBy="descricao-criar-assinatura"
      className="w-[96%] max-w-2xl overflow-hidden p-0"
    >
      <header className="bg-gradient-to-br from-violet-900 via-fuchsia-800 to-sky-700 px-4 py-4 text-white sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="titulo-criar-assinatura"
              className="flex items-center gap-2 text-xl font-black tracking-tight sm:text-2xl"
            >
              <PenTool className="h-5 w-5 text-pink-300" />
              Criar assinatura digital
            </h2>
            <p id="descricao-criar-assinatura" className="mt-1 text-sm text-white/85">
              Desenhe sua assinatura para utilizar nos termos de uso.
            </p>
          </div>

          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60"
            aria-label="Fechar assinatura"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="space-y-4 bg-white px-4 py-5 dark:bg-zinc-950 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Assine no quadro abaixo. Essa assinatura será salva e utilizada para
            formalizar o termo de uso das salas.
          </p>
        </div>

        <SignatureCanvas onChange={setAssinaturaDataUrl} disabled={loading} />
      </div>

      <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-zinc-950/90 sm:px-6">
        <button
          type="button"
          onClick={loading ? undefined : onClose}
          disabled={loading}
          className="rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition hover:bg-slate-300 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={salvar}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 font-black text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {loading ? "Salvando..." : "Salvar assinatura"}
        </button>
      </footer>
    </Modal>
  );
}

ModalCriarAssinatura.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSalvar: PropTypes.func,
  loading: PropTypes.bool,
  onMessage: PropTypes.func,
};

/* =========================================================================
   Componente principal
=========================================================================== */

export default function ModalSolicitarReserva({
  onClose,
  slot,
  sala,
  capacidadeSala,
  recarregar,
  modo = "criar",
  reservaAtual = null,
}) {
  const isEdicao = modo === "editar";

  const salaInicial = normalizarSala(
    (isEdicao ? reservaAtual?.sala : sala) || slot?.sala || "sala_reuniao"
  );
  const dataInicial =
    (isEdicao ? String(reservaAtual?.data || "").slice(0, 10) : slot?.dataISO) ||
    "";
  const periodoInicial = normalizarPeriodo(
    (isEdicao ? reservaAtual?.periodo : slot?.periodo) || "manha"
  );

  const [salaSelecionada, setSalaSelecionada] = useState(salaInicial);
  const [dataISO, setDataISO] = useState(dataInicial);
  const [periodo, setPeriodo] = useState(periodoInicial);

  const [qtdPessoas, setQtdPessoas] = useState(
    isEdicao ? String(reservaAtual?.qtd_pessoas ?? "") : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    isEdicao ? Boolean(reservaAtual?.coffee_break) : false
  );
  const [finalidade, setFinalidade] = useState(
    isEdicao ? String(reservaAtual?.finalidade ?? "") : ""
  );
  const [observacao, setObservacao] = useState("");

  const [loading, setLoading] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");
  const [mensagem, setMensagem] = useState(null);

  const [termoModalOpen, setTermoModalOpen] = useState(false);
  const [assinaturaModalOpen, setAssinaturaModalOpen] = useState(false);
  const [loadingAssinatura, setLoadingAssinatura] = useState(false);

  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [assinaturaPreview, setAssinaturaPreview] = useState(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [termoAssinadoEm, setTermoAssinadoEm] = useState("");

  const firstFocusRef = useRef(null);

  const cap = useMemo(() => {
    if (salaSelecionada === sala && capacidadeSala) return capacidadeSala;
    return capacidadePorSala(salaSelecionada);
  }, [salaSelecionada, sala, capacidadeSala]);

  function showMessage(payload) {
    setMensagem(payload);
    setMsgA11y(`${payload.title || ""} ${payload.message || ""}`.trim());
  }

  useEffect(() => {
    if (isEdicao && reservaAtual) {
      setSalaSelecionada(normalizarSala(reservaAtual.sala || "sala_reuniao"));
      setDataISO(String(reservaAtual.data || "").slice(0, 10));
      setPeriodo(normalizarPeriodo(reservaAtual.periodo || "manha"));
      setQtdPessoas(String(reservaAtual.qtd_pessoas ?? ""));
      setCoffeeBreak(Boolean(reservaAtual.coffee_break));
      setFinalidade(String(reservaAtual.finalidade ?? ""));
      setObservacao("");
    } else {
      setSalaSelecionada(salaInicial);
      setDataISO(dataInicial);
      setPeriodo(periodoInicial);
      setQtdPessoas("");
      setCoffeeBreak(false);
      setFinalidade("");
      setObservacao("");
    }

    setMsgA11y("");
    setMensagem(null);
    setLoading(false);
    setTermoModalOpen(false);
    setAssinaturaModalOpen(false);
    setLoadingAssinatura(false);
    setAssinaturaSalva(null);
    setAssinaturaPreview(null);

    if (isEdicao) {
      setTermoAceito(true);
      setTermoAssinadoEm(reservaAtual?.termo_assinado_em || "");
    } else {
      setTermoAceito(false);
      setTermoAssinadoEm("");
    }

    const timer = window.setTimeout(() => firstFocusRef.current?.focus?.(), 60);

    return () => window.clearTimeout(timer);
  }, [
    modo,
    reservaAtual,
    isEdicao,
    salaInicial,
    dataInicial,
    periodoInicial,
  ]);

  const carregarAssinaturaExistente = useCallback(async () => {
    if (isEdicao) return null;

    setLoadingAssinatura(true);

    try {
      const response = await api.assinatura.minha();
      const assinaturaAtual = unwrapAssinatura(response);
      const preview = assinaturaToPreview(assinaturaAtual);

      if (assinaturaAtual && preview) {
        setAssinaturaSalva(assinaturaAtual);
        setAssinaturaPreview(preview);
        return assinaturaAtual;
      }

      setAssinaturaSalva(null);
      setAssinaturaPreview(null);
      return null;
    } catch {
      setAssinaturaSalva(null);
      setAssinaturaPreview(null);

      showMessage({
        type: "warning",
        title: "Assinatura não localizada",
        message:
          "Não foi possível localizar uma assinatura cadastrada. Você poderá criar uma assinatura ao ler o termo.",
      });

      return null;
    } finally {
      setLoadingAssinatura(false);
    }
  }, [isEdicao]);

  useEffect(() => {
    if (isEdicao) return;
    carregarAssinaturaExistente();
  }, [isEdicao, carregarAssinaturaExistente]);

  const titulo = isEdicao ? "Editar solicitação" : "Solicitar reserva";

  const subtitulo = useMemo(() => {
    return `${brDate(dataISO)} • ${periodoLabel(periodo)} • ${salaLabel(
      salaSelecionada
    )}`;
  }, [periodo, salaSelecionada, dataISO]);

  const minis = useMemo(
    () => ({
      sala: salaLabel(salaSelecionada),
      data: brDate(dataISO),
      periodo: periodoLabel(periodo),
      cap: `${cap.conforto} conf. / ${cap.max} máx.`,
    }),
    [salaSelecionada, dataISO, periodo, cap.conforto, cap.max]
  );

  function podeFechar() {
    return !loading && !loadingAssinatura;
  }

  async function handleSalvarAssinatura(dataUrl) {
    setLoadingAssinatura(true);

    try {
      const base64 = extractBase64Only(dataUrl);

      if (!base64 || base64.length < ASSINATURA_MIN_LENGTH) {
        showMessage({
          type: "warning",
          title: "Assinatura obrigatória",
          message: "Desenhe sua assinatura antes de salvar.",
        });
        return;
      }

      const response = await api.assinatura.salvar({
        assinatura: dataUrl,
      });

      const assinaturaAtual = unwrapAssinatura(response) || {
        imagem_base64: dataUrl,
      };

      const preview = assinaturaToPreview(assinaturaAtual) || dataUrl;

      setAssinaturaSalva(assinaturaAtual);
      setAssinaturaPreview(preview);
      setAssinaturaModalOpen(false);
      setTermoAceito(true);

      const agora = new Date().toISOString();
      setTermoAssinadoEm(agora);

      showMessage({
        type: "success",
        title: "Termo assinado",
        message:
          "Assinatura salva e termo assinado com sucesso. A solicitação já pode ser enviada.",
      });
    } catch (error) {
      showMessage({
        type: "error",
        title: "Erro ao salvar assinatura",
        message: getErrorMessage(error, "Não foi possível salvar sua assinatura."),
      });
    } finally {
      setLoadingAssinatura(false);
    }
  }

 function handleAssinarTermo() {
  if (loading || loadingAssinatura) return;

  if (!assinaturaSalva || !assinaturaPreview) {
    setTermoAceito(false);
    setTermoAssinadoEm("");
    setTermoModalOpen(false);
    setAssinaturaModalOpen(true);

    showMessage({
      type: "warning",
      title: "Assinatura necessária",
      message:
        "Cadastre sua assinatura digital real antes de concordar com o termo. O sistema não criará assinatura automática.",
    });

    return;
  }

  const agora = new Date().toISOString();

  setTermoAceito(true);
  setTermoAssinadoEm(agora);
  setTermoModalOpen(false);

  showMessage({
    type: "success",
    title: "Termo assinado",
    message:
      "Termo assinado digitalmente com a assinatura cadastrada. A solicitação já pode ser enviada.",
  });
}

  function validarFormulario() {
    const qtd = Number(qtdPessoas);

    if (!Number.isInteger(qtd) || qtd <= 0) {
      return "Informe a quantidade de pessoas.";
    }

    if (qtd > cap.max) {
      return `A capacidade máxima desta sala é de ${cap.max} pessoas.`;
    }

    if (!isYMD(dataISO)) {
      return "Data inválida para a solicitação.";
    }

    if (!trimmedOrNull(finalidade)) {
      return "Informe a finalidade do uso da sala.";
    }

    if (!PERIODOS_OFICIAIS.has(periodo)) {
      return "Selecione um período válido.";
    }

    if (!SALAS_OFICIAIS.has(salaSelecionada)) {
      return "Sala inválida para solicitação.";
    }

    if (!isEdicao && !termoAceito) {
      return "Você precisa ler, concordar e assinar o termo antes de enviar.";
    }

    return null;
  }

  async function enviar() {
    if (loading || loadingAssinatura) return;

    setMensagem(null);
    setLoading(true);
    setMsgA11y(isEdicao ? "Salvando alterações." : "Enviando solicitação.");

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

      if (!isEdicao) {
        const payload = {
          sala: salaSelecionada,
          data: dataISO,
          periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
          observacao: trimmedOrNull(observacao),
          termo_aceito: true,
          termo_assinado_em: termoAssinadoEm || new Date().toISOString(),
          assinatura_id: assinaturaId(assinaturaSalva),
          assinatura_base64: assinaturaPreview || null,
        };

        await api.post("/sala/solicitar", payload);

        showMessage({
          type: "success",
          title: "Solicitação enviada",
          message:
            "Sua solicitação foi enviada com sucesso para análise da Escola da Saúde.",
        });
      } else {
        const payload = {
          sala: salaSelecionada,
          data: dataISO,
          periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
        };

        await api.put(`/sala/minhas/${reservaAtual.id}`, payload);

        showMessage({
          type: "success",
          title: "Solicitação atualizada",
          message: "Sua solicitação foi atualizada com sucesso.",
        });
      }

      await recarregar?.();
      onClose?.();
    } catch (error) {
      showMessage({
        type: "error",
        title: isEdicao
          ? "Erro ao atualizar solicitação"
          : "Erro ao enviar solicitação",
        message: getErrorMessage(
          error,
          isEdicao
            ? "Erro ao atualizar solicitação."
            : "Erro ao enviar solicitação."
        ),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal
        open
        onClose={podeFechar() ? onClose : undefined}
        labelledBy="titulo-solicitar-reserva"
        describedBy="descricao-solicitar-reserva"
        className="w-[96%] max-w-2xl overflow-hidden p-0"
      >
        <header className="bg-gradient-to-br from-sky-900 via-sky-700 to-cyan-600 px-4 py-4 text-white sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                Agendamento de sala
              </div>

              <h2
                id="titulo-solicitar-reserva"
                className="text-xl font-black tracking-tight sm:text-2xl"
              >
                {titulo}
              </h2>

              <p
                id="descricao-solicitar-reserva"
                className="mt-1 text-sm text-white/85"
              >
                {subtitulo}
              </p>
            </div>

            <button
              type="button"
              onClick={podeFechar() ? onClose : undefined}
              disabled={!podeFechar()}
              className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-60"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <div className="bg-slate-50 px-4 pt-4 dark:bg-zinc-950 sm:px-6">
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

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniInfo icon={Building2} label="Sala" value={minis.sala} />
            <MiniInfo icon={CalendarDays} label="Data" value={minis.data} />
            <MiniInfo icon={Clock3} label="Período" value={minis.periodo} />
            <MiniInfo icon={Users} label="Capacidade" value={minis.cap} />
          </section>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-h-[72vh] space-y-4 overflow-y-auto bg-slate-50 px-4 pb-24 pt-4 dark:bg-zinc-950 sm:px-6"
        >
          <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Dados da reserva
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Sala
                </label>
                <input
                  ref={firstFocusRef}
                  type="text"
                  value={salaLabel(salaSelecionada)}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm opacity-90 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Data
                </label>
                <input
                  type="text"
                  value={brDate(dataISO)}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm opacity-90 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Período
                </label>
                <input
                  type="text"
                  value={periodoLabel(periodo)}
                  disabled
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm opacity-90 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Quantidade de pessoas
                </label>
                <input
                  type="number"
                  min={1}
                  max={cap.max}
                  value={qtdPessoas}
                  onChange={(event) => setQtdPessoas(event.target.value)}
                  disabled={loading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  placeholder={`Até ${cap.max} pessoas`}
                  inputMode="numeric"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Capacidade máxima desta sala: {cap.max} pessoas.
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
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

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                  Finalidade / evento <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={finalidade}
                  onChange={(event) => setFinalidade(event.target.value)}
                  disabled={loading}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  placeholder="Descreva brevemente a atividade"
                />
              </div>

              {!isEdicao ? (
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                    Observações adicionais
                  </label>
                  <textarea
                    rows={2}
                    value={observacao}
                    onChange={(event) => setObservacao(event.target.value)}
                    disabled={loading}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-sky-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                    placeholder="Informações úteis para a equipe"
                  />
                </div>
              ) : null}
            </div>
          </div>

          {!isEdicao ? (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900/40 dark:bg-sky-950/15">
              <div className="flex items-start gap-3">
                <FileSignature className="mt-0.5 h-5 w-5 text-sky-600 dark:text-sky-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-sky-900 dark:text-sky-100">
                    Termo de compromisso para utilização da sala
                  </p>
                  <p className="mt-1 text-xs text-sky-900/80 dark:text-sky-100/80 sm:text-sm">
                    Para concluir esta solicitação, você precisa ler, concordar
                    e assinar digitalmente o termo de uso das salas. O termo
                    inclui a ciência de que o uso do espaço deverá ser confirmado
                    entre 7 dias e 48 horas antes da data reservada, sob risco de
                    cancelamento administrativo do agendamento.
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 p-3 dark:border-sky-900/40 dark:bg-zinc-900/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Status do termo
                    </p>

                    <div className="mt-1">
                      {termoAceito ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Assinado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4" />
                          Pendente
                        </span>
                      )}
                    </div>

                    {termoAceito && termoAssinadoEm ? (
  <p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-600 dark:text-slate-400">
    {textoDocumentoAssinado(getNomeAssinante(assinaturaSalva), termoAssinadoEm)}
  </p>
) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTermoModalOpen(true)}
                    disabled={loading || loadingAssinatura}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
                  >
                    <FileSignature className="h-4 w-4" />
                    {termoAceito ? "Ver termo assinado" : "Ler e assinar termo"}
                  </button>
                </div>

                {assinaturaPreview ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Assinatura vinculada
                    </p>
                    <img
                      src={assinaturaPreview}
                      alt="Assinatura digital cadastrada"
                      className="h-20 w-auto object-contain"
                    />
                    {termoAceito && termoAssinadoEm ? (
  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
    {textoDocumentoAssinado(getNomeAssinante(assinaturaSalva), termoAssinadoEm)}
  </p>
) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Info className="mt-0.5 h-4 w-4 flex-none text-sky-500" />
            <p>
              {!isEdicao
                ? "Sua solicitação será analisada pela equipe da Escola da Saúde. O envio só será concluído após a assinatura do termo de uso."
                : "Alterações só são permitidas enquanto a solicitação estiver pendente. Mudanças passam pela mesma validação de disponibilidade."}
            </p>
          </div>
        </motion.div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/85 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-zinc-950/85 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || loadingAssinatura}
            className="rounded-xl bg-slate-200 px-4 py-2 text-slate-900 transition hover:bg-slate-300 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={enviar}
            disabled={loading || loadingAssinatura || (!isEdicao && !termoAceito)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 font-black text-white transition hover:bg-sky-700 disabled:opacity-60"
            aria-busy={loading ? "true" : "false"}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading
              ? isEdicao
                ? "Salvando..."
                : "Enviando..."
              : isEdicao
                ? "Salvar alterações"
                : "Enviar solicitação"}
          </button>
        </footer>
      </Modal>

      <ModalTermoUso
        open={termoModalOpen}
        onClose={() => {
          if (loadingAssinatura) return;
          setTermoModalOpen(false);
        }}
        finalidade={finalidade}
        dataISO={dataISO}
        assinaturaDisponivel={Boolean(assinaturaPreview)}
        assinaturaPreview={assinaturaPreview}
        assinaturaNome={getNomeAssinante(assinaturaSalva) || getNomeUsuarioLocal()}
        assinaturaEm={termoAssinadoEm || getDataAssinatura(assinaturaSalva)}
        onAssinarTermo={handleAssinarTermo}
        loading={loadingAssinatura}
      />

      <ModalCriarAssinatura
        open={assinaturaModalOpen}
        onClose={() => {
          if (loadingAssinatura) return;
          setAssinaturaModalOpen(false);
        }}
        onSalvar={handleSalvarAssinatura}
        loading={loadingAssinatura}
        onMessage={showMessage}
      />
    </>
  );
}

ModalSolicitarReserva.propTypes = {
  onClose: PropTypes.func,
  slot: PropTypes.shape({
    dataISO: PropTypes.string,
    periodo: PropTypes.string,
    sala: PropTypes.string,
  }),
  sala: PropTypes.string,
  capacidadeSala: PropTypes.shape({
    conforto: PropTypes.number,
    max: PropTypes.number,
  }),
  recarregar: PropTypes.func,
  modo: PropTypes.oneOf(["criar", "editar"]),
  reservaAtual: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sala: PropTypes.string,
    data: PropTypes.string,
    periodo: PropTypes.string,
    qtd_pessoas: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    coffee_break: PropTypes.bool,
    finalidade: PropTypes.string,
    termo_assinado_em: PropTypes.string,
  }),
};