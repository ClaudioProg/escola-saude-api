// ✅ frontend/src/components/avaliacoes/AvaliacoesEventoFormulario.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Eraser,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import Botao from "../ui/Botao";
import CarregandoSkeleton from "../ui/CarregandoSkeleton";
import ErroCarregamento from "../ui/ErroCarregamento";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../ui/AppToast";
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
  "desempenho_organizador",
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
];

const CAMPOS_CONDICIONAIS = {
  ambos: ["exposicao_trabalhos"],
  congresso: ["apresentacao_oral_mostra", "apresentacao_tcrs", "oficinas"],
};

const LABELS = {
  desempenho_organizador: "Desempenho do organizador",
  divulgacao_evento: "Divulgação do evento",
  recepcao: "Recepção",
  credenciamento: "Credenciamento",
  material_apoio: "Material de apoio",
  pontualidade: "Pontualidade",
  sinalizacao_local: "Sinalização do local",
  conteudo_temas: "Conteúdo e temas",
  estrutura_local: "Estrutura do local",
  acessibilidade: "Acessibilidade",
  limpeza: "Limpeza",
  inscricao_online: "Inscrição on-line",
  exposicao_trabalhos: "Exposição de trabalhos",
  apresentacao_oral_mostra: "Apresentação oral/mostra",
  apresentacao_tcrs: "Apresentação de TCRs",
  oficinas: "Oficinas",
};

const TEXTOS = [
  {
    name: "gostou_mais",
    label: "O que mais gostou",
    placeholder: "Conte brevemente o ponto alto da experiência...",
    rows: 3,
  },
  {
    name: "sugestoes_melhoria",
    label: "Sugestões de melhoria",
    placeholder: "Deixe sugestões objetivas para evoluirmos o evento...",
    rows: 3,
  },
  {
    name: "comentarios_finais",
    label: "Comentários finais",
    placeholder: "Espaço livre para observações adicionais...",
    rows: 4,
  },
];

function draftKey(turmaId) {
  return `avaliacao-evento:${turmaId}`;
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

function extrairData(response) {
  return response?.data ?? response ?? null;
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

function HeaderFormulario({ progresso, tituloEvento, nomeTurma, tipoEvento }) {
  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-amber-900 to-orange-800 p-5 text-white shadow-sm ring-1 ring-white/10 sm:p-7">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-400 blur-3xl" />
        <div className="absolute right-0 top-10 h-64 w-64 rounded-full bg-orange-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-emerald-400 blur-3xl" />
      </div>

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/20 backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Avaliação institucional
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Avaliação do Evento
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-white/85 sm:text-base">
              Sua opinião é essencial para qualificar os próximos eventos da
              Escola da Saúde.
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white/85">
              {tituloEvento ? (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  Evento: {tituloEvento}
                </span>
              ) : null}

              {nomeTurma ? (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  Turma: {nomeTurma}
                </span>
              ) : null}

              {tipoEvento ? (
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">
                  Tipo: {tipoEvento}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-xl lg:min-w-72">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-white/70">
                  Progresso obrigatório
                </p>
                <p className="mt-1 text-3xl font-black">
                  {progresso.pct}%
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-white transition-[width] duration-300"
                style={{ width: `${progresso.pct}%` }}
                aria-hidden="true"
              />
            </div>

            <p className="mt-2 text-xs text-white/75">
              {progresso.filled}/{progresso.total} campos obrigatórios preenchidos.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function CampoNota({ campo, value, obrigatorio, erro, onChange, setCampoRef }) {
  return (
    <div
      className={`rounded-3xl p-4 ring-1 transition ${
        erro
          ? "bg-rose-50 ring-rose-200 dark:bg-rose-950/30 dark:ring-rose-800/70"
          : "bg-white ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      }`}
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-sm font-black text-slate-950 dark:text-white">
          {LABELS[campo] || campo}
          {obrigatorio ? (
            <span className="ml-1 text-rose-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>

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

      <div
        ref={setCampoRef(campo)}
        role="radiogroup"
        aria-label={LABELS[campo] || campo}
        aria-required={obrigatorio || undefined}
        aria-invalid={erro || undefined}
        className="grid grid-cols-1 gap-2 sm:grid-cols-5"
      >
        {NOTA_ENUM_OFICIAL.map((opcao) => {
          const checked = value === opcao;
          const optionId = `${campo}-${opcao}`;

          return (
            <label
              key={opcao}
              htmlFor={optionId}
              className={`cursor-pointer rounded-2xl border px-3 py-3 text-center text-xs font-black ring-1 transition focus-within:ring-4 ${
                checked
                  ? NOTA_STYLE[opcao]
                  : `${NOTA_STYLE_INATIVA} focus-within:ring-violet-100 dark:focus-within:ring-violet-950`
              }`}
            >
              <input
                id={optionId}
                type="radio"
                name={campo}
                value={opcao}
                className="sr-only"
                checked={checked}
                onChange={() => onChange(campo, opcao)}
              />

              <span>{opcao}</span>
              <span className="mt-1 block text-[10px] opacity-70">
                {NOTA_PONTUACAO[opcao]}/10
              </span>
            </label>
          );
        })}
      </div>

      {erro ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Campo obrigatório.
        </p>
      ) : null}
    </div>
  );
}

function CampoTexto({ name, label, value, placeholder, rows, onChange }) {
  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <label
        htmlFor={name}
        className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white"
      >
        <MessageSquare className="h-4 w-4 text-amber-600" aria-hidden="true" />
        {label}
        <span className="text-xs font-semibold text-slate-400">
          opcional
        </span>
      </label>

      <textarea
        id={name}
        rows={rows}
        value={value}
        onChange={onChange}
        maxLength={4000}
        placeholder={placeholder}
        className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
      />

      <p className="mt-1 text-right text-[11px] font-semibold text-slate-400">
        {String(value || "").length}/4000
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Componente principal
 * ───────────────────────────────────────────── */

export default function AvaliacoesEventoFormulario() {
  const { turma_id } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({});
  const [textos, setTextos] = useState({
    gostou_mais: "",
    sugestoes_melhoria: "",
    comentarios_finais: "",
  });
  const [carregandoMeta, setCarregandoMeta] = useState(true);
  const [erroMeta, setErroMeta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [meta, setMeta] = useState({
    evento_id: null,
    tipo_evento: "",
    titulo_evento: "",
    nome_turma: "",
  });

  const refsCampo = useRef({});
  const sujo = useRef(false);
  const autosaveTimer = useRef(null);

  const setCampoRef = useCallback((nome) => (element) => {
    if (element) refsCampo.current[nome] = element;
  }, []);

  const camposVisiveis = useMemo(() => {
    const campos = [...CAMPOS_BASE];

    if (tipoEventoPermiteExposicao(meta.tipo_evento)) {
      campos.push(...CAMPOS_CONDICIONAIS.ambos);
    }

    if (tipoEventoPermiteCongresso(meta.tipo_evento)) {
      campos.push(...CAMPOS_CONDICIONAIS.congresso);
    }

    return campos;
  }, [meta.tipo_evento]);

  const progresso = useMemo(() => {
    const filled = CAMPOS_OBRIGATORIOS.filter((campo) =>
      isNotaOficial(form[campo])
    ).length;

    const total = CAMPOS_OBRIGATORIOS.length;
    const pct = Math.round((filled / total) * 100);

    return { filled, total, pct };
  }, [form]);

  const camposObrigatoriosInvalidos = useMemo(() => {
    return CAMPOS_OBRIGATORIOS.filter((campo) => !isNotaOficial(form[campo]));
  }, [form]);

  useEffect(() => {
    let ativo = true;

    async function carregarMeta() {
      setCarregandoMeta(true);
      setErroMeta("");

      try {
        if (typeof api?.turma?.detalhe !== "function") {
          throw new Error(
            "Facade api.turma.detalhe não encontrada em frontend/src/services/api.js."
          );
        }

        const response = await api.turma.detalhe(turma_id);
        const turma = extrairData(response);

        if (!ativo) return;

        const tipo = String(
          turma?.evento?.tipo || turma?.tipo_evento || ""
        ).toLowerCase();

        setMeta({
          evento_id: turma?.evento_id ?? turma?.evento?.id ?? null,
          tipo_evento: tipo,
          titulo_evento:
            turma?.evento?.titulo || turma?.evento_titulo || "",
          nome_turma: turma?.nome || "",
        });

        const raw = localStorage.getItem(draftKey(turma_id));

        if (raw) {
          try {
            const draft = JSON.parse(raw);

            setForm(draft.form || {});
            setTextos({
              gostou_mais: draft.textos?.gostou_mais || "",
              sugestoes_melhoria: draft.textos?.sugestoes_melhoria || "",
              comentarios_finais: draft.textos?.comentarios_finais || "",
            });
          } catch {
            localStorage.removeItem(draftKey(turma_id));
          }
        }
      } catch (error) {
        console.error("[AvaliacoesEventoFormulario] erro meta:", error);

        if (!ativo) return;

        setErroMeta("Não foi possível carregar as informações da turma.");
        notifyError(
          "Não foi possível carregar as informações da turma. Tente novamente ou acione o suporte se o problema continuar."
        );
      } finally {
        if (ativo) {
          setCarregandoMeta(false);
        }
      }
    }

    carregarMeta();

    return () => {
      ativo = false;
    };
  }, [turma_id]);

  useEffect(() => {
    if (carregandoMeta) return undefined;

    clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(turma_id),
          JSON.stringify({
            form,
            textos,
          })
        );
      } catch {
        // rascunho local não deve bloquear preenchimento
      }
    }, 350);

    return () => clearTimeout(autosaveTimer.current);
  }, [form, textos, turma_id, carregandoMeta]);

  useEffect(() => {
    const handler = (event) => {
      if (sujo.current && !enviando) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [enviando]);

  const handleSelect = useCallback((campo, valor) => {
    sujo.current = true;
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }, []);

  const handleTexto = useCallback((nome) => (event) => {
    sujo.current = true;
    setTextos((prev) => ({
      ...prev,
      [nome]: event.target.value,
    }));
  }, []);

  const validarObrigatorios = useCallback(() => {
    const faltando = CAMPOS_OBRIGATORIOS.filter(
      (campo) => !isNotaOficial(form[campo])
    );

    if (!faltando.length) return true;

    const primeiro = faltando[0];

    notifyWarning("Preencha todos os campos obrigatórios antes de enviar.");

    const element = refsCampo.current[primeiro];

    element?.focus?.();
    element?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });

    return false;
  }, [form]);

  const limparRascunho = useCallback(() => {
    localStorage.removeItem(draftKey(turma_id));
    setForm({});
    setTextos({
      gostou_mais: "",
      sugestoes_melhoria: "",
      comentarios_finais: "",
    });
    sujo.current = false;
    setTentouEnviar(false);

    notifyInfo("Rascunho limpo.");
  }, [turma_id]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (enviando) return;

      setTentouEnviar(true);

      if (!validarObrigatorios()) return;

      const corpo = {
        turma_id: Number(turma_id),
        evento_id: meta.evento_id ?? undefined,
        ...Object.fromEntries(
          Object.entries(form).filter(([, value]) => isNotaOficial(value))
        ),
        gostou_mais: normalizarTexto(textos.gostou_mais),
        sugestoes_melhoria: normalizarTexto(textos.sugestoes_melhoria),
        comentarios_finais: normalizarTexto(textos.comentarios_finais),
      };

      try {
        setEnviando(true);

        if (typeof api?.avaliacao?.enviar !== "function") {
          throw new Error(
            "Facade api.avaliacao.enviar não encontrada em frontend/src/services/api.js."
          );
        }

        await api.avaliacao.enviar(corpo);

        notifySuccess(
          "Avaliação enviada com sucesso. Se elegível, seu certificado será liberado."
        );

        sujo.current = false;
        localStorage.removeItem(draftKey(turma_id));

        navigate("/painel");
      } catch (error) {
        console.error("[AvaliacoesEventoFormulario] erro envio:", error);

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível enviar a avaliação. Verifique os dados e tente novamente."
          )
        );
      } finally {
        setEnviando(false);
      }
    },
    [
      enviando,
      validarObrigatorios,
      turma_id,
      meta.evento_id,
      form,
      textos,
      navigate,
    ]
  );

  if (carregandoMeta) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl space-y-5">
          <CarregandoSkeleton height={220} />
          <CarregandoSkeleton height={420} />
        </div>
      </main>
    );
  }

  if (erroMeta) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl">
          <ErroCarregamento
            mensagem={erroMeta}
            onRetry={() => window.location.reload()}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <HeaderFormulario
          progresso={progresso}
          tituloEvento={meta.titulo_evento}
          nomeTurma={meta.nome_turma}
          tipoEvento={meta.tipo_evento}
        />

        <motion.form
          onSubmit={handleSubmit}
          noValidate
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-6 space-y-6"
        >
          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Notas oficiais
                </div>

                <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
                  Critérios de avaliação
                </h2>

                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Use apenas a escala oficial. Os campos obrigatórios estão
                  marcados com asterisco.
                </p>
              </div>

              <span className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
                Ótimo 10 • Bom 8 • Regular 6 • Ruim 4 • Péssimo 2
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {camposVisiveis.map((campo) => {
                const obrigatorio = CAMPOS_OBRIGATORIOS.includes(campo);
                const erro =
                  tentouEnviar &&
                  obrigatorio &&
                  !isNotaOficial(form[campo]);

                return (
                  <CampoNota
                    key={campo}
                    campo={campo}
                    value={form[campo]}
                    obrigatorio={obrigatorio}
                    erro={erro}
                    onChange={handleSelect}
                    setCampoRef={setCampoRef}
                  />
                );
              })}
            </div>

            {tentouEnviar && camposObrigatoriosInvalidos.length ? (
              <div
                className="mt-5 rounded-3xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-800/70"
                role="alert"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                  <div>
                    <p className="font-black">
                      Existem campos obrigatórios pendentes.
                    </p>
                    <p className="mt-1">
                      Preencha:{" "}
                      {camposObrigatoriosInvalidos
                        .map((campo) => LABELS[campo] || campo)
                        .join(", ")}
                      .
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:p-6">
            <div className="mb-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 ring-1 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                Comentários opcionais
              </div>

              <h2 className="mt-3 text-xl font-black text-slate-950 dark:text-white">
                Conte um pouco mais
              </h2>

              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Os comentários ajudam a entender melhor a experiência dos
                participantes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {TEXTOS.map((item) => (
                <CampoTexto
                  key={item.name}
                  name={item.name}
                  label={item.label}
                  value={textos[item.name]}
                  placeholder={item.placeholder}
                  rows={item.rows}
                  onChange={handleTexto(item.name)}
                />
              ))}
            </div>
          </section>

          <div className="hidden flex-wrap items-center gap-3 sm:flex">
            <Botao
              type="submit"
              variant="primary"
              disabled={enviando}
            >
              <span className="inline-flex items-center gap-2">
                {enviando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {enviando ? "Enviando..." : "Enviar avaliação"}
              </span>
            </Botao>

            <Botao
              type="button"
              variant="secondary"
              onClick={limparRascunho}
              disabled={enviando}
              title="Apagar rascunho salvo localmente"
            >
              <span className="inline-flex items-center gap-2">
                <Eraser className="h-4 w-4" aria-hidden="true" />
                Limpar rascunho
              </span>
            </Botao>
          </div>

          <div className="h-20 sm:hidden" aria-hidden="true" />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:hidden">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2">
              <Botao
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={limparRascunho}
                disabled={enviando}
                title="Apagar rascunho salvo localmente"
              >
                Limpar
              </Botao>

              <Botao
                type="submit"
                variant="primary"
                className="flex-[2]"
                disabled={enviando}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {enviando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  {enviando ? "Enviando..." : "Enviar"}
                </span>
              </Botao>
            </div>
          </div>
        </motion.form>
      </div>
    </main>
  );
}