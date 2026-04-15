/* eslint-disable no-console */
// ✅ src/components/ModalSolicitarReserva.jsx — PREMIUM++ (termo + assinatura digital)
// - Fluxo premium de solicitação
// - Sala/data/período travados conforme slot escolhido
// - Termo de uso obrigatório para criação
// - Usa o fluxo REAL de assinatura da plataforma:
//   • GET  /assinatura
//   • POST /assinatura
// - Se já existir assinatura, reutiliza automaticamente
// - Se não existir, abre modal de criação
// - Bloqueia envio enquanto o termo não estiver assinado
// - Mobile-first + dark mode + a11y
// - Anti-fuso: sem new Date("YYYY-MM-DD")

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import {
  Users,
  Coffee,
  FileText,
  Info,
  CalendarDays,
  Clock3,
  Building2,
  FileSignature,
  CheckCircle2,
  ShieldCheck,
  X,
  PenTool,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../services/api";
import Modal from "./Modal";

/* ───────────────────────── Helpers base ───────────────────────── */
function capacidadePorSala(sala) {
  return sala === "auditorio"
    ? { conforto: 50, max: 60 }
    : { conforto: 25, max: 30 };
}

const PERIODOS = [
  { value: "manha", label: "Período da manhã" },
  { value: "tarde", label: "Período da tarde" },
];

const pad2 = (n) => String(n).padStart(2, "0");

function brDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

function brDateTimeFromIsoString(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(+d)) return String(value);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} às ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

function salaLabel(value) {
  return value === "auditorio" ? "Auditório" : "Sala de Reunião";
}

function trimmedOrNull(v) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function dataUrlFromBase64(rawBase64, mime = "image/png") {
  if (!rawBase64) return null;
  if (String(rawBase64).startsWith("data:")) return rawBase64;
  return `data:${mime};base64,${rawBase64}`;
}

function extractBase64Only(dataUrl) {
  if (!dataUrl) return null;
  const parts = String(dataUrl).split(",");
  return parts.length > 1 ? parts[1] : dataUrl;
}

function assinaturaToPreview(assinatura) {
  if (!assinatura) return null;

  if (typeof assinatura === "string") {
    return dataUrlFromBase64(assinatura, "image/png");
  }

  const raw =
    assinatura?.imagem_base64 ||
    assinatura?.assinatura_base64 ||
    assinatura?.base64 ||
    assinatura?.imagem ||
    assinatura?.arquivo_base64 ||
    assinatura?.assinatura ||
    null;

  const mime =
    assinatura?.mime ||
    assinatura?.arquivo_mime ||
    assinatura?.content_type ||
    "image/png";

  return dataUrlFromBase64(raw, mime);
}

/* ───────────────────────── Signature Canvas ───────────────────────── */
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

    const prev = canvas.toDataURL("image/png");

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

    if (prev && prev !== "data:,") {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        onChange?.(canvas.toDataURL("image/png"));
      };
      img.src = prev;
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
        className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className={cls("block w-full touch-none", disabled ? "opacity-70" : "")}
          onMouseDown={(e) => start(e.clientX, e.clientY)}
          onMouseMove={(e) => move(e.clientX, e.clientY)}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (!t) return;
            start(t.clientX, t.clientY);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (!t) return;
            move(t.clientX, t.clientY);
          }}
          onTouchEnd={end}
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled}
          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
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

/* ───────────────────────── Modal do Termo ───────────────────────── */
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
      className="w-[96%] max-w-4xl p-0 overflow-hidden"
    >
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-slate-950 via-slate-800 to-sky-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="titulo-termo-uso-salas"
              className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5 text-sky-300" />
              Termo de Uso das Salas
            </h2>
            <p id="descricao-termo-uso-salas" className="text-white/90 text-sm mt-1">
              Escola da Saúde / Secretaria Municipal de Saúde de Santos
            </p>
          </div>

          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-4 max-h-[75vh] overflow-y-auto space-y-4 bg-white dark:bg-zinc-950">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-900/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">
                Nome do evento
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white break-words">
                {finalidade || "—"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">
                Data
              </p>
              <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                {brDate(dataISO)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <div className="text-center">
            <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              TERMO DE USO DAS SALAS
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Escola da Saúde / SMS
            </p>
          </div>

          <div className="space-y-4 text-sm leading-7 text-slate-700 dark:text-slate-300">
            <p>
              Este Termo tem por objetivo regulamentar o uso do <strong>Auditório</strong> e da{" "}
              <strong>Sala de Reuniões</strong> da Escola da Saúde da Secretaria Municipal de Saúde de Santos (SMS),
              estabelecendo as responsabilidades e condições para sua utilização.
            </p>

            <section>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                1. Finalidade de Uso
              </h4>
              <p className="mt-2">
                As salas destinam-se, prioritariamente, às atividades de <strong>Educação Permanente em Saúde</strong>.
              </p>
            </section>

            <section>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                2. Responsabilidades do Responsável pelo Evento
              </h4>
              <ul className="mt-2 space-y-2 list-disc pl-5">
                <li>Chegar 30 minutos antes para preparar a sala, ligar equipamentos e organizar o espaço.</li>
                <li>
                  O notebook deve ser acessado com o SSHD do responsável. Em caso de visitante, utilizar o SSHD do servidor solicitante.
                </li>
                <li>
                  Coffee break:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Será autorizado somente se informado na reserva;</li>
                    <li>Deve ser montado apenas na sacada externa;</li>
                    <li>Os alimentos, descartáveis e a limpeza são de responsabilidade do solicitante;</li>
                    <li>O lixo deve ser descartado no contentor localizado ao final do corredor do mesmo andar.</li>
                  </ul>
                </li>
                <li>Não é permitido o consumo de alimentos no interior da sala.</li>
                <li>
                  Ao final do evento, devolver a sala às condições originais:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>Recolocar mesas e cadeiras;</li>
                    <li>Desligar equipamentos;</li>
                    <li>Avisar à equipe da Escola sobre o término do uso.</li>
                  </ul>
                </li>
                <li>A Escola dispõe de bebedouro, não disponibilizando copos descartáveis.</li>
                <li>Horário de funcionamento: 8h às 17h.</li>
              </ul>
            </section>

            <section>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                3. Disposições Finais
              </h4>
              <p className="mt-2">
                De acordo com a Ordem de Serviço Nº 007/2020 – GAB/SMS, a Escola da Saúde é responsável pelo gerenciamento,
                divulgação institucional, autorização e apoio às atividades de educação permanente em saúde no âmbito da SMS.
              </p>
              <p className="mt-2">
                Ao assinar este termo, o responsável declara estar ciente das normas acima e compromete-se a cumpri-las integralmente.
              </p>
            </section>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">
                  Nome do evento
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white break-words">
                  {finalidade || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">
                  Data
                </p>
                <p className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                  {brDate(dataISO)}
                </p>
              </div>
            </div>

            {assinaturaDisponivel && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/15 dark:border-emerald-900/40 p-4">
                <div className="flex items-start gap-3">
                  <FileSignature className="w-5 h-5 text-emerald-600 dark:text-emerald-300 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                      Assinatura cadastrada encontrada
                    </p>
                    <p className="mt-1 text-xs text-emerald-800/90 dark:text-emerald-100/85">
                      Esta assinatura será utilizada para o aceite digital do termo.
                    </p>

                    {assinaturaNome ? (
                      <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-100">
                        <span className="font-semibold">Assinante:</span> {assinaturaNome}
                      </p>
                    ) : null}

                    {assinaturaEm ? (
                      <p className="mt-1 text-xs text-emerald-900 dark:text-emerald-100">
                        <span className="font-semibold">Último registro:</span> {brDateTimeFromIsoString(assinaturaEm)}
                      </p>
                    ) : null}

                    {assinaturaPreview ? (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 inline-block">
                        <img
                          src={assinaturaPreview}
                          alt="Pré-visualização da assinatura"
                          className="h-20 w-auto object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          O envio da solicitação só será liberado após a concordância e assinatura do termo.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={onAssinarTermo}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold hover:bg-sky-700 transition disabled:opacity-60 inline-flex items-center gap-2"
          >
            <FileSignature className="w-4 h-4" />
            Concordar e assinar o termo
          </button>
        </div>
      </div>
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

/* ───────────────────────── Modal criação de assinatura ───────────────────────── */
function ModalCriarAssinatura({
  open,
  onClose,
  onSalvar,
  loading = false,
}) {
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setAssinaturaDataUrl("");
  }, [open]);

  if (!open) return null;

  async function salvar() {
    const base64 = extractBase64Only(assinaturaDataUrl);
    if (!base64 || base64.length < 100) {
      toast.warn("Desenhe sua assinatura antes de salvar.");
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
      className="w-[96%] max-w-2xl p-0 overflow-hidden"
    >
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-violet-900 via-fuchsia-800 to-sky-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="titulo-criar-assinatura"
              className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2"
            >
              <PenTool className="w-5 h-5 text-pink-300" />
              Criar assinatura digital
            </h2>
            <p id="descricao-criar-assinatura" className="text-white/90 text-sm mt-1">
              Desenhe sua assinatura para utilizar nos termos de uso.
            </p>
          </div>

          <button
            type="button"
            onClick={loading ? undefined : onClose}
            disabled={loading}
            className="p-2 rounded-xl hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 space-y-4 bg-white dark:bg-zinc-950">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Assine no quadro abaixo. Essa assinatura será salva de forma protegida e utilizada para formalizar o termo de uso das salas.
          </p>
        </div>

        <SignatureCanvas onChange={setAssinaturaDataUrl} disabled={loading} />
      </div>

      <div className="sticky bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={loading ? undefined : onClose}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={salvar}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white font-extrabold hover:bg-violet-700 transition disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar assinatura"}
        </button>
      </div>
    </Modal>
  );
}

ModalCriarAssinatura.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSalvar: PropTypes.func,
  loading: PropTypes.bool,
};

/* ───────────────────────── Componente principal ───────────────────────── */
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

  const salaInicial = (isEdicao ? reservaAtual?.sala : sala) || slot?.sala || "sala_reuniao";
  const dataInicial = (isEdicao ? (reservaAtual?.data || "").slice(0, 10) : slot?.dataISO) || "";
  const periodoInicial = (isEdicao ? reservaAtual?.periodo : slot?.periodo) || "manha";

  const [salaSelecionada, setSalaSelecionada] = useState(salaInicial);
  const [dataISO, setDataISO] = useState(dataInicial);
  const [periodo, setPeriodo] = useState(periodoInicial);

  const [qtdPessoas, setQtdPessoas] = useState(
    isEdicao ? String(reservaAtual?.qtd_pessoas ?? "") : ""
  );
  const [coffeeBreak, setCoffeeBreak] = useState(
    isEdicao ? !!reservaAtual?.coffee_break : false
  );
  const [finalidade, setFinalidade] = useState(
    isEdicao ? String(reservaAtual?.finalidade ?? "") : ""
  );
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

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

  useEffect(() => {
    if (isEdicao && reservaAtual) {
      setSalaSelecionada(reservaAtual.sala || "sala_reuniao");
      setDataISO((reservaAtual.data || "").slice(0, 10));
      setPeriodo(reservaAtual.periodo || "manha");
      setQtdPessoas(String(reservaAtual.qtd_pessoas ?? ""));
      setCoffeeBreak(!!reservaAtual.coffee_break);
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
    setLoading(false);
    setTermoModalOpen(false);
    setAssinaturaModalOpen(false);
    setLoadingAssinatura(false);
    setAssinaturaSalva(null);
    setAssinaturaPreview(null);

    if (isEdicao) {
      setTermoAceito(true);
      setTermoAssinadoEm(
        reservaAtual?.termo_assinado_em ||
          reservaAtual?.assinado_em ||
          ""
      );
    } else {
      setTermoAceito(false);
      setTermoAssinadoEm("");
    }

    const t = setTimeout(() => firstFocusRef.current?.focus?.(), 60);
    return () => clearTimeout(t);
  }, [
    modo,
    reservaAtual?.id,
    isEdicao,
    reservaAtual?.sala,
    reservaAtual?.data,
    reservaAtual?.periodo,
    reservaAtual?.qtd_pessoas,
    reservaAtual?.coffee_break,
    reservaAtual?.finalidade,
    reservaAtual?.termo_assinado_em,
    reservaAtual?.assinado_em,
    salaInicial,
    dataInicial,
    periodoInicial,
  ]);

  const carregarAssinaturaExistente = useCallback(async () => {
    if (isEdicao) return null;

    try {
      setLoadingAssinatura(true);
      console.log("[ModalSolicitarReserva] Buscando assinatura existente em /assinatura");

      const resp = await api.get("/assinatura");
      const data = resp?.data ?? resp ?? {};
      const assinaturaAtual = data?.assinatura || null;

      if (assinaturaAtual) {
        const assinaturaObj = {
          assinatura: assinaturaAtual,
          imagem_base64: assinaturaAtual,
          nome_assinante: "",
        };

        setAssinaturaSalva(assinaturaObj);
        setAssinaturaPreview(assinaturaToPreview(assinaturaAtual));
        console.log("[ModalSolicitarReserva] Assinatura existente carregada com sucesso.");
        return assinaturaAtual;
      }

      setAssinaturaSalva(null);
      setAssinaturaPreview(null);
      console.log("[ModalSolicitarReserva] Nenhuma assinatura encontrada em /assinatura.");
      return null;
    } catch (err) {
      console.error("[ModalSolicitarReserva] Erro ao buscar assinatura:", err);
      setAssinaturaSalva(null);
      setAssinaturaPreview(null);
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
    const pLabel = PERIODOS.find((p) => p.value === periodo)?.label || "—";
    const sLabel = salaLabel(salaSelecionada);
    const d = dataISO || slot?.dataISO || "—";
    return `${d} • ${pLabel} • ${sLabel}`;
  }, [periodo, salaSelecionada, dataISO, slot?.dataISO]);

  const minis = useMemo(() => {
    const pLabel = PERIODOS.find((p) => p.value === periodo)?.label || "—";
    const d = brDate(dataISO || slot?.dataISO);
    return {
      sala: salaLabel(salaSelecionada),
      data: d,
      periodo: pLabel,
      cap: `${cap.conforto} conf. / ${cap.max} máx.`,
    };
  }, [salaSelecionada, dataISO, periodo, cap.conforto, cap.max, slot?.dataISO]);

  function podeFechar() {
    return !loading && !loadingAssinatura;
  }

  async function handleSalvarAssinatura(dataUrl) {
    try {
      setLoadingAssinatura(true);

      const payload = {
        assinatura: dataUrl,
      };

      console.log("[ModalSolicitarReserva] Salvando assinatura em /assinatura");

      const resp = await api.post("/assinatura", payload);
      const data = resp?.data ?? resp ?? {};

      if (!data?.ok) {
        throw new Error(data?.erro || "Falha ao salvar assinatura.");
      }

      const assinaturaObj = {
        assinatura: dataUrl,
        imagem_base64: dataUrl,
        nome_assinante: "",
      };

      setAssinaturaSalva(assinaturaObj);
      setAssinaturaPreview(dataUrl);
      setAssinaturaModalOpen(false);
      setTermoAceito(true);

      const agora = new Date().toISOString();
      setTermoAssinadoEm(agora);

      toast.success("Assinatura salva e termo assinado com sucesso.");
    } catch (err) {
      console.error("[ModalSolicitarReserva] Erro ao salvar assinatura:", err);
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.mensagem ||
        err?.message ||
        "Não foi possível salvar sua assinatura.";
      toast.error(msg);
    } finally {
      setLoadingAssinatura(false);
    }
  }

  function handleAssinarTermo() {
    if (assinaturaPreview) {
      const agora = new Date().toISOString();
      setTermoAceito(true);
      setTermoAssinadoEm(agora);
      setTermoModalOpen(false);
      toast.success("Termo assinado com sucesso.");
      return;
    }

    setAssinaturaModalOpen(true);
  }

  async function enviar() {
    try {
      setLoading(true);
      setMsgA11y(isEdicao ? "Salvando alterações..." : "Enviando solicitação...");

      const qtd = Number(qtdPessoas);

      if (!qtd || qtd <= 0) {
        toast.warn("Informe a quantidade de pessoas.");
        setMsgA11y("Informe a quantidade de pessoas.");
        return;
      }

      if (qtd > cap.max) {
        toast.warn(`A capacidade máxima desta sala é de ${cap.max} pessoas.`);
        setMsgA11y(`A capacidade máxima desta sala é de ${cap.max} pessoas.`);
        return;
      }

      if (!dataISO) {
        toast.warn("Data inválida para a solicitação.");
        setMsgA11y("Data inválida para a solicitação.");
        return;
      }

      if (!finalidade?.trim()) {
        toast.warn("Informe a finalidade do uso da sala.");
        setMsgA11y("Informe a finalidade do uso da sala.");
        return;
      }

      if (!["manha", "tarde"].includes(periodo)) {
        toast.warn("Selecione um período válido.");
        setMsgA11y("Selecione um período válido.");
        return;
      }

      if (!isEdicao) {
        if (!termoAceito) {
          toast.warn("Você precisa ler, concordar e assinar o termo antes de enviar.");
          setMsgA11y("Assinatura do termo obrigatória.");
          return;
        }

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
          assinatura_base64: assinaturaPreview || null,
        };

        console.log("[ModalSolicitarReserva] Enviando solicitação com termo assinado.", {
          sala: payload.sala,
          data: payload.data,
          periodo: payload.periodo,
          termo_aceito: payload.termo_aceito,
          possuiAssinatura: !!payload.assinatura_base64,
        });

        await api.post("/salas/solicitar", payload);
        toast.success("Solicitação enviada com sucesso!");
        setMsgA11y("Solicitação enviada com sucesso!");
      } else {
        const payload = {
          sala: salaSelecionada,
          data: dataISO,
          periodo,
          qtd_pessoas: qtd,
          coffee_break: coffeeBreak,
          finalidade: finalidade.trim(),
        };

        await api.put(`/salas/minhas/${reservaAtual.id}`, payload);
        toast.success("Solicitação atualizada com sucesso!");
        setMsgA11y("Solicitação atualizada com sucesso!");
      }

      await recarregar?.();
      onClose?.();
    } catch (err) {
      console.error("[ModalSolicitarReserva] Erro:", err);
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.mensagem ||
        (isEdicao ? "Erro ao atualizar solicitação." : "Erro ao enviar solicitação.");

      toast.error(msg);
      setMsgA11y(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal
        open={true}
        onClose={podeFechar() ? onClose : undefined}
        labelledBy="titulo-solicitar-reserva"
        describedBy="descricao-solicitar-reserva"
        className="w-[96%] max-w-2xl p-0 overflow-hidden"
      >
        <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-sky-900 via-sky-700 to-cyan-600">
          <h2
            id="titulo-solicitar-reserva"
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
          >
            {titulo}
          </h2>
          <p id="descricao-solicitar-reserva" className="text-white/90 text-sm mt-1">
            {subtitulo}
          </p>
        </header>

        <div aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <section className="px-4 sm:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Building2 className="w-5 h-5" />, label: "Sala", value: minis.sala },
            { icon: <CalendarDays className="w-5 h-5" />, label: "Data", value: minis.data },
            { icon: <Clock3 className="w-5 h-5" />, label: "Período", value: minis.periodo },
            { icon: <Users className="w-5 h-5" />, label: "Capacidade", value: minis.cap },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
            >
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                {m.icon}
                <span className="text-sm font-semibold">{m.label}</span>
              </div>
              <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white break-words">
                {m.value}
              </div>
            </div>
          ))}
        </section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 sm:px-6 pt-4 pb-24 space-y-4 max-h-[72vh] overflow-y-auto"
        >
          <div className="flex items-start gap-2">
            <Building2 className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Sala
              </label>
              <input
                ref={firstFocusRef}
                type="text"
                value={salaLabel(salaSelecionada)}
                disabled
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm opacity-90"
              />
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Capacidade: {cap.conforto} conforto / {cap.max} máx.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Data
              </label>
              <input
                type="text"
                value={brDate(dataISO)}
                disabled
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm opacity-90"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock3 className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Período
              </label>
              <input
                type="text"
                value={PERIODOS.find((p) => p.value === periodo)?.label || "—"}
                disabled
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm opacity-90"
              />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Quantidade de pessoas
              </label>
              <input
                type="number"
                min={1}
                max={cap.max}
                value={qtdPessoas}
                onChange={(e) => setQtdPessoas(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                placeholder={`Até ${cap.max} pessoas`}
                inputMode="numeric"
              />
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Capacidade máxima desta sala: {cap.max} pessoas.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <Coffee className="w-4 h-4 text-slate-500" />
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={coffeeBreak}
              onChange={(e) => setCoffeeBreak(e.target.checked)}
              disabled={loading}
            />
            Haverá coffee break?
          </label>

          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-slate-500 mt-1" />
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Finalidade / evento <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                placeholder="Descreva brevemente a atividade"
              />
            </div>
          </div>

          {!isEdicao && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Observações adicionais (opcional)
              </label>
              <textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                placeholder="Informações úteis para a equipe"
              />
            </div>
          )}

          {!isEdicao && (
            <div className="rounded-3xl border border-sky-200 bg-sky-50/70 dark:bg-sky-950/15 dark:border-sky-900/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <FileSignature className="w-5 h-5 text-sky-600 dark:text-sky-300 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-sky-900 dark:text-sky-100">
                    Termo de compromisso para utilização da sala
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-sky-900/80 dark:text-sky-100/80">
                    Para concluir esta solicitação, você precisa ler, concordar e assinar digitalmente o termo de uso das salas.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/70 dark:border-sky-900/40 bg-white/80 dark:bg-zinc-900/50 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold">
                      Status do termo
                    </p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      {termoAceito ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4" />
                          Assinado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-extrabold text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-300">
                          <AlertTriangle className="w-4 h-4" />
                          Pendente
                        </span>
                      )}
                    </div>

                    {termoAceito && termoAssinadoEm ? (
                      <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                        Assinado digitalmente em {brDateTimeFromIsoString(termoAssinadoEm)}.
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => setTermoModalOpen(true)}
                    disabled={loading || loadingAssinatura}
                    className="px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold hover:bg-sky-700 transition disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <FileSignature className="w-4 h-4" />
                    {termoAceito ? "Ver termo assinado" : "Ler e assinar termo"}
                  </button>
                </div>

                {assinaturaPreview ? (
                  <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-bold mb-2">
                      Assinatura vinculada
                    </p>
                    <img
                      src={assinaturaPreview}
                      alt="Assinatura digital cadastrada"
                      className="h-20 w-auto object-contain"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 flex gap-2">
            <Info className="w-4 h-4 mt-0.5 text-sky-500" />
            <p>
              {!isEdicao
                ? "Sua solicitação será analisada pela equipe da Escola da Saúde. O envio só será concluído após a assinatura do termo de uso."
                : "Alterações só são permitidas enquanto a solicitação estiver pendente. Mudanças passam pela mesma validação de disponibilidade."}
            </p>
          </div>
        </motion.div>

        <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || loadingAssinatura}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={enviar}
            disabled={loading || loadingAssinatura || (!isEdicao && !termoAceito)}
            className="px-4 py-2 rounded-xl bg-sky-600 text-white font-extrabold hover:bg-sky-700 transition disabled:opacity-60"
            aria-busy={loading ? "true" : "false"}
          >
            {loading
              ? isEdicao
                ? "Salvando..."
                : "Enviando..."
              : isEdicao
                ? "Salvar alterações"
                : "Enviar solicitação"}
          </button>
        </div>
      </Modal>

      <ModalTermoUso
        open={termoModalOpen}
        onClose={() => {
          if (loadingAssinatura) return;
          setTermoModalOpen(false);
        }}
        finalidade={finalidade}
        dataISO={dataISO}
        assinaturaDisponivel={!!assinaturaPreview}
        assinaturaPreview={assinaturaPreview}
        assinaturaNome={
          assinaturaSalva?.nome_assinante ||
          assinaturaSalva?.nome ||
          assinaturaSalva?.usuario_nome ||
          ""
        }
        assinaturaEm={termoAssinadoEm || ""}
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
    assinado_em: PropTypes.string,
  }),
};