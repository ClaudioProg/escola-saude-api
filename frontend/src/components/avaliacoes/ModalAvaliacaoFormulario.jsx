// ✅ frontend/src/components/avaliacoes/ModalAvaliacaoFormulario.jsx — v2.2
// Atualizado em: 29/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eraser,
  Gauge,
  Loader2,
  MessageSquare,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import Modal from "../ui/Modal";
import Botao from "../ui/Botao";
import { notifyError, notifySuccess, notifyWarning } from "../ui/AppToast";
import { api } from "../../services/api";

/* ─────────────────────────────────────────────
 * Contrato oficial de avaliação
 * ───────────────────────────────────────────── */

const NOTA_ENUM_OFICIAL = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"];

const NOTA_PONTUACAO = {
  Ótimo: 10,
  Bom: 8,
  Regular: 6,
  Ruim: 4,
  Péssimo: 2,
};

const NOTA_STYLE = {
  Ótimo:
    "border-emerald-300 bg-emerald-50 text-emerald-900 ring-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900",
  Bom:
    "border-lime-300 bg-lime-50 text-lime-900 ring-lime-100 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-100 dark:ring-lime-900",
  Regular:
    "border-amber-300 bg-amber-50 text-amber-900 ring-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900",
  Ruim:
    "border-orange-300 bg-orange-50 text-orange-900 ring-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-900",
  Péssimo:
    "border-rose-300 bg-rose-50 text-rose-900 ring-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900",
};

const NOTA_STYLE_INATIVA =
  "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

const CAMPOS_OBRIGATORIOS = [
  "divulgacao_evento",
  "pontualidade",
  "conteudo_temas",
  "desempenho_organizador",
  "inscricao_online",
];

const CAMPOS_BASE = [
  { chave: "desempenho_organizador", rotulo: "Desempenho do organizador" },
  { chave: "divulgacao_evento", rotulo: "Divulgação do evento" },
  { chave: "recepcao", rotulo: "Recepção" },
  { chave: "credenciamento", rotulo: "Credenciamento" },
  { chave: "material_apoio", rotulo: "Material de apoio" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "sinalizacao_local", rotulo: "Sinalização do local" },
  { chave: "conteudo_temas", rotulo: "Conteúdo e temas" },
  { chave: "estrutura_local", rotulo: "Estrutura do local" },
  { chave: "acessibilidade", rotulo: "Acessibilidade" },
  { chave: "limpeza", rotulo: "Limpeza" },
  { chave: "inscricao_online", rotulo: "Inscrição on-line" },
];

const CAMPOS_EXPOSICAO = [
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
];

const CAMPOS_CONGRESSO = [
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral/mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

const TEXTOS = [
  {
    chave: "gostou_mais",
    rotulo: "O que você mais gostou?",
    placeholder: "Conte brevemente o ponto alto da experiência...",
    rows: 2,
  },
  {
    chave: "sugestoes_melhoria",
    rotulo: "Sugestões de melhoria",
    placeholder: "Deixe sugestões objetivas para evoluirmos o evento...",
    rows: 2,
  },
  {
    chave: "comentarios_finais",
    rotulo: "Comentários finais",
    placeholder: "Espaço livre para observações adicionais...",
    rows: 3,
  },
];

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isNotaOficial(value) {
  return NOTA_ENUM_OFICIAL.includes(value);
}

function tipoEventoPermiteExposicao(tipoEvento) {
  const tipo = String(tipoEvento || "").trim().toLowerCase();
  return tipo === "congresso" || tipo === "simpósio" || tipo === "simposio";
}

function tipoEventoPermiteCongresso(tipoEvento) {
  return String(tipoEvento || "").trim().toLowerCase() === "congresso";
}

function normalizarTexto(value, max = 4000) {
  const texto = String(value || "").trim();
  return texto ? texto.slice(0, max) : undefined;
}

function obterTituloEvento(evento) {
  return evento?.titulo || evento?.nome || "Evento";
}

function obterTipoEvento(evento) {
  return evento?.tipo_evento || evento?.tipo || evento?.evento_tipo || "";
}

function obterEventoId(evento) {
  const id = Number(evento?.evento_id ?? evento?.id);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function obterMensagemErro(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function MiniCard({ icon: Icon, title, children, tone = "violet" }) {
  const tones = {
    violet:
      "border-violet-100 bg-white dark:border-violet-900 dark:bg-zinc-900",
    amber:
      "border-amber-200 bg-white dark:border-amber-900 dark:bg-zinc-900",
    emerald:
      "border-emerald-100 bg-white dark:border-emerald-900 dark:bg-zinc-900",
    rose: "border-rose-200 bg-white dark:border-rose-900 dark:bg-zinc-900",
  };

  return (
    <div className={cls("rounded-3xl border p-4 shadow-sm", tones[tone])}>
      <div className="mb-2 flex items-center gap-2">
        {Icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-900">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        ) : null}

        <span className="text-sm font-black text-slate-950 dark:text-white">
          {title}
        </span>
      </div>

      {children}
    </div>
  );
}

MiniCard.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  tone: PropTypes.oneOf(["violet", "amber", "emerald", "rose"]),
};

function RatingField({
  rotulo,
  chave,
  obrigatorio,
  value,
  onChange,
  invalid,
  hintId,
  setFieldRef,
}) {
  return (
    <fieldset
      className={cls(
        "rounded-3xl p-4 ring-1 transition",
        invalid
          ? "bg-rose-50 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-800/70"
          : "bg-white ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      )}
      aria-required={obrigatorio ? "true" : "false"}
      aria-invalid={invalid ? "true" : "false"}
      aria-describedby={hintId}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <legend className="text-sm font-black text-slate-950 dark:text-white">
          {rotulo}
          {obrigatorio ? (
            <span className="ml-1 text-rose-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </legend>

        {value ? (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {value} · {NOTA_PONTUACAO[value]}/10
          </span>
        ) : (
          <span className="inline-flex w-fit rounded-full bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-100 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
            Não respondido
          </span>
        )}
      </div>

      <p
        id={hintId}
        className={cls(
          "mb-3 text-xs font-semibold",
          invalid
            ? "text-rose-700 dark:text-rose-300"
            : "text-slate-500 dark:text-zinc-400"
        )}
      >
        {invalid ? "Selecione uma nota para continuar." : "Escolha uma opção."}
      </p>

      <div
        ref={(element) => setFieldRef(chave, element)}
        role="radiogroup"
        aria-label={rotulo}
        className="grid grid-cols-1 gap-2 sm:grid-cols-5"
      >
        {NOTA_ENUM_OFICIAL.map((opcao) => {
          const checked = value === opcao;

          return (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={checked ? "true" : "false"}
              onClick={() => onChange(chave, opcao)}
              className={cls(
                "rounded-2xl border px-3 py-3 text-center text-xs font-black ring-1 transition focus:outline-none focus:ring-4",
                checked
                  ? NOTA_STYLE[opcao]
                  : `${NOTA_STYLE_INATIVA} focus:ring-violet-100 dark:focus:ring-violet-950`
              )}
            >
              <span>{opcao}</span>
              <span className="mt-1 block text-[10px] opacity-70">
                {NOTA_PONTUACAO[opcao]}/10
              </span>
            </button>
          );
        })}
      </div>

      {invalid ? (
        <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Campo obrigatório.
        </p>
      ) : null}
    </fieldset>
  );
}

RatingField.propTypes = {
  rotulo: PropTypes.string.isRequired,
  chave: PropTypes.string.isRequired,
  obrigatorio: PropTypes.bool,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  invalid: PropTypes.bool,
  hintId: PropTypes.string.isRequired,
  setFieldRef: PropTypes.func.isRequired,
};

function CampoTexto({ item, value, onChange }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <label
        htmlFor={item.chave}
        className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"
      >
        <MessageSquare className="h-4 w-4 text-violet-600" aria-hidden="true" />
        {item.rotulo}
        <span className="text-xs font-semibold text-slate-400">opcional</span>
      </label>

      <textarea
        id={item.chave}
        rows={item.rows}
        value={value}
        onChange={onChange}
        maxLength={4000}
        placeholder={item.placeholder}
        className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-950 outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-violet-950"
      />

      <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
        {String(value || "").length}/4000
      </p>
    </div>
  );
}

CampoTexto.propTypes = {
  item: PropTypes.shape({
    chave: PropTypes.string.isRequired,
    rotulo: PropTypes.string.isRequired,
    placeholder: PropTypes.string,
    rows: PropTypes.number,
  }).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function ModalAvaliacaoFormulario({
  isOpen,
  onClose,
  evento,
  turma_id,
  recarregar,
}) {
  const [textos, setTextos] = useState({
    gostou_mais: "",
    sugestoes_melhoria: "",
    comentarios_finais: "",
  });
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const fieldRefs = useRef({});

  const titulo = obterTituloEvento(evento);
  const tipoEvento = obterTipoEvento(evento);
  const eventoId = obterEventoId(evento);

  const camposExtras = useMemo(() => {
    const extras = [];

    if (tipoEventoPermiteExposicao(tipoEvento)) {
      extras.push(...CAMPOS_EXPOSICAO);
    }

    if (tipoEventoPermiteCongresso(tipoEvento)) {
      extras.push(...CAMPOS_CONGRESSO);
    }

    return extras;
  }, [tipoEvento]);

  const totalObrigatorios = CAMPOS_OBRIGATORIOS.length;

  const preenchidosObrigatorios = useMemo(() => {
    return CAMPOS_OBRIGATORIOS.filter((campo) => isNotaOficial(notas[campo]))
      .length;
  }, [notas]);

  const percentualObrigatorios = Math.round(
    (preenchidosObrigatorios / totalObrigatorios) * 100
  );

  const faltandoObrigatorios = useMemo(() => {
    return CAMPOS_OBRIGATORIOS.filter((campo) => !isNotaOficial(notas[campo]));
  }, [notas]);

  const mediaPrevia = useMemo(() => {
    const valores = CAMPOS_OBRIGATORIOS.map((campo) => notas[campo])
      .filter(isNotaOficial)
      .map((nota) => NOTA_PONTUACAO[nota]);

    if (!valores.length) return null;

    return Number(
      (valores.reduce((acc, value) => acc + value, 0) / valores.length).toFixed(
        2
      )
    );
  }, [notas]);

  const statusPronto = preenchidosObrigatorios === totalObrigatorios;

  const setFieldRef = useCallback((campo, element) => {
    if (element) {
      fieldRefs.current[campo] = element;
    }
  }, []);

  const focusPrimeiroPendente = useCallback(() => {
    const primeiro = faltandoObrigatorios[0];

    if (!primeiro) return;

    window.requestAnimationFrame(() => {
      fieldRefs.current[primeiro]?.focus?.();
      fieldRefs.current[primeiro]?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [faltandoObrigatorios]);

  useEffect(() => {
    if (!isOpen) return;

    setNotas({});
    setTextos({
      gostou_mais: "",
      sugestoes_melhoria: "",
      comentarios_finais: "",
    });
    setMsgA11y("");
    setShowExtras(false);
    setTentouEnviar(false);
    setEnviando(false);
    fieldRefs.current = {};
  }, [isOpen, evento?.id, turma_id]);

  const handleNotaChange = useCallback((campo, valor) => {
    setNotas((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }, []);

  const handleTextoChange = useCallback((campo) => (event) => {
    setTextos((prev) => ({
      ...prev,
      [campo]: event.target.value,
    }));
  }, []);

  async function enviarAvaliacao() {
    setTentouEnviar(true);

    if (faltandoObrigatorios.length) {
      const message = `Preencha todas as notas obrigatórias (${faltandoObrigatorios.length} pendente${
        faltandoObrigatorios.length > 1 ? "s" : ""
      }).`;

      setMsgA11y(message);
      notifyWarning(message);
      focusPrimeiroPendente();
      return;
    }

    const turmaId = Number(turma_id);

    if (!Number.isInteger(turmaId) || turmaId <= 0) {
      const message = "Turma inválida para envio da avaliação.";
      setMsgA11y(message);
      notifyError(message);
      return;
    }

    try {
      setEnviando(true);
      setMsgA11y("Enviando avaliação.");

      if (typeof api?.avaliacao?.enviar !== "function") {
        throw new Error(
          "Facade api.avaliacao.enviar não encontrada em frontend/src/services/api.js."
        );
      }

      const payload = {
        turma_id: turmaId,
        evento_id: eventoId,
        ...Object.fromEntries(
          Object.entries(notas).filter(([, value]) => isNotaOficial(value))
        ),
        gostou_mais: normalizarTexto(textos.gostou_mais),
        sugestoes_melhoria: normalizarTexto(textos.sugestoes_melhoria),
        comentarios_finais: normalizarTexto(textos.comentarios_finais),
      };

      await api.avaliacao.enviar(payload);

      setMsgA11y("Avaliação enviada com sucesso.");
      notifySuccess(
        "Avaliação enviada com sucesso. Se elegível, seu certificado será liberado."
      );

      onClose?.();
      recarregar?.();
    } catch (error) {
      console.error("[ModalAvaliacaoFormulario] erro ao enviar:", error);

      const message = obterMensagemErro(
        error,
        "Não foi possível enviar a avaliação. Verifique os dados e tente novamente."
      );

      setMsgA11y(message);
      notifyError(message);
    } finally {
      setEnviando(false);
    }
  }

  if (!isOpen || !evento) return null;

  return (
    <Modal
      open={isOpen}
      onClose={enviando ? undefined : onClose}
      labelledBy="modal-avaliacao-titulo"
      describedBy="modal-avaliacao-descricao"
      padding={false}
      scroll="content"
      showCloseButton={false}
      className="grid h-[92dvh] w-[96%] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0"
    >
      <header className="relative row-start-1 overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-4 py-5 text-white sm:px-6">
        <div className="absolute inset-0 opacity-30" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-fuchsia-500 blur-3xl" />
          <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-indigo-500 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400 blur-3xl" />
        </div>

        <div className="relative pr-11">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/20 backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Avaliação institucional
          </div>

          <h2
            id="modal-avaliacao-titulo"
            className="mt-3 text-xl font-black tracking-tight sm:text-2xl"
          >
            Avaliar: {titulo}
          </h2>

          <p
            id="modal-avaliacao-descricao"
            className="mt-1 max-w-2xl text-sm text-white/85"
          >
            Selecione uma nota para cada critério obrigatório. Os campos extras
            aparecem conforme o tipo do evento.
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white/80">
            {tipoEvento ? (
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                Tipo: {tipoEvento}
              </span>
            ) : null}

            {turma_id ? (
              <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                Turma: {turma_id}
              </span>
            ) : null}

            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
              Ótimo 10 • Bom 8 • Regular 6 • Ruim 4 • Péssimo 2
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={enviando}
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Fechar avaliação"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="row-start-2 min-h-0 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-zinc-950 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MiniCard icon={Gauge} title="Progresso" tone="violet">
            <div className="mb-2 text-sm text-slate-600 dark:text-zinc-300">
              {preenchidosObrigatorios}/{totalObrigatorios} obrigatórios
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 transition-all"
                style={{ width: `${percentualObrigatorios}%` }}
                aria-hidden="true"
              />
            </div>
          </MiniCard>

          <MiniCard icon={Sparkles} title="Média prévia" tone="violet">
            <div className="text-2xl font-black text-slate-950 dark:text-white">
              {mediaPrevia != null
                ? `${mediaPrevia.toFixed(2)} / 10`
                : "— / 10"}
            </div>

            <div className="text-xs text-slate-600 dark:text-zinc-300">
              Apenas campos obrigatórios preenchidos.
            </div>
          </MiniCard>

          <MiniCard
            icon={statusPronto ? CheckCircle2 : AlertTriangle}
            title="Status"
            tone={statusPronto ? "emerald" : "amber"}
          >
            <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              {statusPronto
                ? "Tudo pronto para enviar."
                : `${faltandoObrigatorios.length} obrigatório(s) pendente(s).`}
            </div>

            {!statusPronto ? (
              <button
                type="button"
                onClick={focusPrimeiroPendente}
                className="mt-2 text-xs font-black text-amber-700 underline underline-offset-2 dark:text-amber-300"
              >
                Ir para o primeiro pendente
              </button>
            ) : null}
          </MiniCard>
        </div>

        <div aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        <section className="pt-5">
          <h3 className="mb-3 text-sm font-black text-slate-950 dark:text-white">
            Critérios de avaliação
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAMPOS_BASE.map(({ chave, rotulo }) => {
              const obrigatorio = CAMPOS_OBRIGATORIOS.includes(chave);
              const invalid =
                tentouEnviar && obrigatorio && !isNotaOficial(notas[chave]);

              return (
                <RatingField
                  key={chave}
                  rotulo={rotulo}
                  chave={chave}
                  obrigatorio={obrigatorio}
                  value={notas[chave]}
                  onChange={handleNotaChange}
                  invalid={invalid}
                  hintId={`hint-${chave}`}
                  setFieldRef={setFieldRef}
                />
              );
            })}
          </div>
        </section>

        {camposExtras.length > 0 ? (
          <section className="mt-6">
            <button
              type="button"
              onClick={() => setShowExtras((value) => !value)}
              className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3 transition hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-800"
              aria-expanded={showExtras ? "true" : "false"}
            >
              <div className="text-left">
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  Extras opcionais
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Critérios condicionais para congresso/simpósio.
                </p>
              </div>

              <ChevronDown
                className={cls(
                  "h-5 w-5 text-slate-500 transition-transform",
                  showExtras ? "rotate-180" : ""
                )}
                aria-hidden="true"
              />
            </button>

            {showExtras ? (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {camposExtras.map(({ chave, rotulo }) => (
                  <RatingField
                    key={chave}
                    rotulo={rotulo}
                    chave={chave}
                    obrigatorio={false}
                    value={notas[chave]}
                    onChange={handleNotaChange}
                    invalid={false}
                    hintId={`hint-${chave}`}
                    setFieldRef={setFieldRef}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 space-y-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Comentários opcionais
            </div>

            <div className="grid grid-cols-1 gap-4">
              {TEXTOS.map((item) => (
                <CampoTexto
                  key={item.chave}
                  item={item}
                  value={textos[item.chave]}
                  onChange={handleTextoChange(item.chave)}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="row-start-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            Campos obrigatórios: {preenchidosObrigatorios}/{totalObrigatorios}.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Botao
              type="button"
              variant="contorno"
              onClick={onClose}
              disabled={enviando}
            >
              Cancelar
            </Botao>

            <Botao
              type="button"
              variant="contorno"
              onClick={() => {
                setNotas({});
                setTextos({
                  gostou_mais: "",
                  sugestoes_melhoria: "",
                  comentarios_finais: "",
                });
                setTentouEnviar(false);
                setMsgA11y("Formulário limpo.");
              }}
              disabled={enviando}
            >
              <span className="inline-flex items-center gap-2">
                <Eraser className="h-4 w-4" aria-hidden="true" />
                Limpar
              </span>
            </Botao>

            <Botao
              type="button"
              variant="sucesso"
              onClick={enviarAvaliacao}
              disabled={enviando}
            >
              <span className="inline-flex items-center gap-2">
                {enviando ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <SendHorizontal className="h-4 w-4" aria-hidden="true" />
                )}
                {enviando ? "Enviando..." : "Enviar avaliação"}
              </span>
            </Botao>
          </div>
        </div>
      </footer>
    </Modal>
  );
}

ModalAvaliacaoFormulario.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  evento: PropTypes.object,
  turma_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  recarregar: PropTypes.func,
};