// ✅ frontend/src/pages/CertificadoUsuario.jsx — v2.0
// Atualizado em: 22/05/2026
// Plataforma Escola da Saúde
//
// Página do usuário para acompanhamento pós-curso.
//
// Diretrizes aplicadas:
// - HeaderHero oficial do layout.
// - Sem hero local.
// - Sem chip "Central pós-curso".
// - Atualizar e indicadores fora do HeaderHero.
// - Questionários, avaliações e certificados em cards verticais.
// - Sem abas.
// - Estados independentes por módulo.
// - Tratamento controlado para endpoint ainda indisponível.
// - Sem variant="secondary" no Botao.
// - Download por downloadBlob oficial.
// - Date-only via extractYmd/formatDateBr.
// - Mobile-first, acessível, dark mode e UX premium.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Award,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileCheck2,
  FilePlus2,
  Filter,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import ModalAvaliacaoFormulario from "../components/avaliacoes/ModalAvaliacaoFormulario";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import {
  notifyError,
  notifySuccess,
  notifyWarning,
} from "../components/ui/AppToast";
import { api } from "../services/api";
import { downloadBlob } from "../utils/downloadArquivo";
import { extractYmd, formatDateBr } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
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

function is404(error) {
  return Number(error?.status || error?.response?.status) === 404;
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("abort") ||
    message.includes("aborted") ||
    message.includes("canceled") ||
    message.includes("cancelled")
  );
}

function getEnvelopeCode(response) {
  return response?.code || response?.data?.code || "";
}

function getUsuarioLogado() {
  try {
    const raw = localStorage.getItem("usuario");
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") return null;

    const id = Number(parsed.id);

    return {
      ...parsed,
      id: Number.isInteger(id) && id > 0 ? id : null,
      nome: parsed.nome || "",
    };
  } catch {
    return null;
  }
}

function dataBR(value) {
  const iso = extractYmd(value);

  return iso ? formatDateBr(iso) : "—";
}

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(value) {
  const nome = String(value || "certificado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return nome || "certificado";
}

function obterTitulo(item) {
  return (
    item?.evento ||
    item?.evento_titulo ||
    item?.nome_evento ||
    item?.titulo ||
    item?.nome ||
    "Evento"
  );
}

function obterTurmaNome(item) {
  return item?.nome_turma || item?.turma_nome || `Turma #${item?.turma_id || "—"}`;
}

function obterPeriodo(item) {
  const inicio = item?.data_inicio || item?.inicio || item?.di;
  const fim = item?.data_fim || item?.fim || item?.df;

  if (!inicio && !fim) return "Período não informado";

  const inicioLabel = dataBR(inicio);
  const fimLabel = dataBR(fim || inicio);

  return inicioLabel === fimLabel ? inicioLabel : `${inicioLabel} até ${fimLabel}`;
}

function isStatusCertificadoValido(status) {
  return status === "emitido" || status === "enviado";
}

function getNumeroCertificado(certificado) {
  return certificado?.numero_certificado || certificado?.numero || "";
}

function getNumeroCertificadoLabel(certificado) {
  return getNumeroCertificado(certificado) || "Número gerado na emissão";
}

function getCertificadoId(cert) {
  if (cert?.certificado_id) return cert.certificado_id;
  if (cert?.id_certificado) return cert.id_certificado;
  if (cert?.certificado?.id) return cert.certificado.id;

  if (
    cert?.arquivo_pdf ||
    cert?.hash_pdf ||
    cert?.codigo_validacao ||
    cert?.numero_certificado
  ) {
    return cert?.id || null;
  }

  return null;
}

function getCertificadoState(cert) {
  const certificadoId = getCertificadoId(cert);
  const status = String(cert?.status || "").trim();
  const statusCertificado = String(cert?.status_certificado || "").trim();

  if (certificadoId && isStatusCertificadoValido(status || "emitido")) {
    return {
      estado: "pronto",
      label: "Emitido",
      motivo: "",
    };
  }

  if (
    statusCertificado === "disponivel_para_gerar" ||
    cert?.pode_gerar_certificado === true ||
    cert?.pode_gerar === true
  ) {
    return {
      estado: "geravel",
      label: "Disponível para emissão",
      motivo: "",
    };
  }

  if (status && !isStatusCertificadoValido(status)) {
    return {
      estado: "bloqueado",
      label: "Indisponível",
      motivo: `Certificado com status ${status}.`,
    };
  }

  if (cert?.pode_gerar === false || cert?.pode_gerar_certificado === false) {
    return {
      estado: "pendente",
      label: "Pendente",
      motivo: cert?.motivo_bloqueio || cert?.motivo || "Ainda não liberado.",
    };
  }

  return {
    estado: "pendente",
    label: "Pendente",
    motivo: "Ainda não liberado.",
  };
}

function keyCertificadoFromItem(certificado) {
  return `cert-${certificado?.evento_id || "evento"}-${certificado?.turma_id || "turma"}`;
}

function filtrarPorBusca(lista, buscaNormalizada, extraText = () => "") {
  const base = Array.isArray(lista) ? lista : [];

  if (!buscaNormalizada) return base;

  return base.filter((item) => {
    const texto = normalizarBusca(
      [
        obterTitulo(item),
        obterTurmaNome(item),
        item?.questionario_titulo,
        item?.numero_certificado,
        item?.codigo_validacao,
        extraText(item),
      ].join(" ")
    );

    return texto.includes(buscaNormalizada);
  });
}

function normalizarCertificadoEmitido(item) {
  return {
    ...item,
    origem_lista: "emitido",
    status_certificado: item?.status || "emitido",
    pode_gerar_certificado: false,
  };
}

function normalizarCertificadoDisponivel(item) {
  return {
    ...item,
    origem_lista: "disponivel",
    status: "",
    status_certificado: "disponivel_para_gerar",
    pode_gerar: true,
    pode_gerar_certificado: true,
    certificado_id: null,
    id_certificado: null,
    numero_certificado: "",
    codigo_validacao: "",
  };
}

function deduplicarCertificados(lista = []) {
  const mapa = new Map();

  for (const item of lista) {
    const key = `${Number(item?.evento_id || 0)}:${Number(item?.turma_id || 0)}:${item?.tipo || "usuario"}`;
    const atual = mapa.get(key);

    if (!atual) {
      mapa.set(key, item);
      continue;
    }

    const atualState = getCertificadoState(atual);
    const novoState = getCertificadoState(item);

    if (novoState.estado === "pronto" && atualState.estado !== "pronto") {
      mapa.set(key, item);
    }
  }

  return Array.from(mapa.values());
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function Badge({ tone = "slate", children }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    emerald:
      "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    amber:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    rose:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    cyan:
      "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/60",
    violet:
      "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/60",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function Card({ children, tone = "emerald", busy = false }) {
  const tones = {
    emerald: "from-emerald-700 via-teal-600 to-cyan-600",
    amber: "from-amber-700 via-orange-500 to-rose-500",
    violet: "from-violet-700 via-indigo-600 to-cyan-600",
    slate: "from-slate-700 via-slate-600 to-slate-500",
    rose: "from-rose-700 via-pink-600 to-orange-500",
    cyan: "from-cyan-700 via-sky-600 to-emerald-500",
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      aria-busy={busy ? "true" : "false"}
    >
      <div className={cx("h-1.5 bg-gradient-to-r", tones[tone])} aria-hidden="true" />
      <div className="p-4">{children}</div>
    </motion.article>
  );
}

function MiniStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "emerald",
}) {
  const tones = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    violet:
      "border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-100",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-100",
  };

  return (
    <article
      className={cx(
        "rounded-[1.75rem] border p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-lg dark:ring-white/10",
        tones[tone] || tones.emerald
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] opacity-70">
            {label}
          </p>

          <p className="mt-1 text-3xl font-black leading-none tracking-tight">
            {value}
          </p>

          <p className="mt-1 text-xs font-semibold opacity-70">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}

function ResumoPremium({ kpis }) {
  return (
    <section className="mx-auto mt-4 grid w-full max-w-6xl grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
      <MiniStatCard
        icon={BookOpenCheck}
        label="Questionários"
        value={kpis.questionarios}
        description="pendentes ou disponíveis"
        tone="violet"
      />

      <MiniStatCard
        icon={ClipboardList}
        label="Avaliações"
        value={kpis.avaliacoes}
        description="a responder"
        tone="amber"
      />

      <MiniStatCard
        icon={Award}
        label="Certificados"
        value={kpis.certificados}
        description="emitidos ou liberáveis"
        tone="emerald"
      />

      <MiniStatCard
        icon={Sparkles}
        label="Pendências"
        value={kpis.pendencias}
        description="etapas a concluir"
        tone="cyan"
      />
    </section>
  );
}

function BarraContextual({ refreshing, onRefresh }) {
  return (
    <section className="mx-auto mt-4 flex w-full max-w-6xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-base font-black text-slate-950 dark:text-white">
          Acompanhe suas etapas pós-curso
        </h2>

        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
          Responda pendências, acompanhe certificados e atualize os dados quando necessário.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Botao
          type="button"
          variant="sucesso"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCw
              className={cx("h-4 w-4", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            {refreshing ? "Atualizando..." : "Atualizar tudo"}
          </span>
        </Botao>
      </div>
    </section>
  );
}

function BuscaEFiltros({
  busca,
  setBusca,
  filtroCertificado,
  setFiltroCertificado,
  ordemCertificado,
  setOrdemCertificado,
  limparBusca,
}) {
  return (
    <section
      aria-label="Busca e filtros de certificados"
      className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por evento, turma, número de certificado ou código..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-emerald-950"
            aria-label="Buscar em questionários, avaliações e certificados"
          />

          {busca ? (
            <button
              type="button"
              onClick={limparBusca}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Certificados:
          </span>

          <select
            value={filtroCertificado}
            onChange={(event) => setFiltroCertificado(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-emerald-950"
            aria-label="Filtrar certificados"
          >
            <option value="todos">Todos</option>
            <option value="prontos">Emitidos</option>
            <option value="disponiveis">Disponíveis para emissão</option>
            <option value="pendentes">Pendentes</option>
          </select>

          <select
            value={ordemCertificado}
            onChange={(event) => setOrdemCertificado(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-emerald-950"
            aria-label="Ordenar certificados"
          >
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="titulo">Título A-Z</option>
          </select>
        </div>
      </div>
    </section>
  );
}

function AvisoEndpoint({ modulo }) {
  return (
    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
      O endpoint de {modulo} ainda não está disponível no backend. Quando a rota
      oficial for criada, os dados aparecerão aqui automaticamente.
    </div>
  );
}

function SecaoModulo({
  id,
  title,
  description,
  icon: Icon,
  tone,
  loading,
  error,
  endpointAusente,
  emptyTitle,
  emptyDescription,
  children,
}) {
  const toneMap = {
    violet:
      "from-violet-700 via-indigo-600 to-cyan-600 bg-violet-50 text-violet-900 dark:bg-violet-950/20 dark:text-violet-100",
    amber:
      "from-amber-700 via-orange-500 to-rose-500 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-100",
    emerald:
      "from-emerald-700 via-teal-600 to-cyan-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100",
  };

  return (
    <section
      id={id}
      className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      aria-labelledby={`${id}-titulo`}
    >
      <div className={cx("h-1.5 bg-gradient-to-r", toneMap[tone]?.split(" ")[0], toneMap[tone]?.split(" ")[1], toneMap[tone]?.split(" ")[2])} aria-hidden="true" />

      <div className="p-4 sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span
              className={cx(
                "grid h-12 w-12 shrink-0 place-items-center rounded-2xl ring-1",
                tone === "violet" &&
                  "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/60",
                tone === "amber" &&
                  "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
                tone === "emerald" &&
                  "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60"
              )}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <h2
                id={`${id}-titulo`}
                className="text-xl font-black tracking-tight text-slate-950 dark:text-white"
              >
                {title}
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                {description}
              </p>
            </div>
          </div>

          {endpointAusente ? (
            <Badge tone="amber">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Backend pendente
            </Badge>
          ) : error ? (
            <Badge tone="rose">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Erro
            </Badge>
          ) : loading ? (
            <Badge tone="cyan">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Carregando
            </Badge>
          ) : (
            <Badge tone="emerald">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Atualizado
            </Badge>
          )}
        </header>

        <div className="mt-4">
          {endpointAusente ? (
            <AvisoEndpoint modulo={title.toLowerCase()} />
          ) : error ? (
            <ErroCarregamento mensagem={error} />
          ) : loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <CarregandoSkeleton height={150} />
              <CarregandoSkeleton height={150} />
            </div>
          ) : children ? (
            children
          ) : (
            <NadaEncontrado titulo={emptyTitle} descricao={emptyDescription} />
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────
 * Modal de questionário
 * ───────────────────────────────────────────── */

function ModalQuestionario({ open, item, onClose, onSubmitted }) {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [questionario, setQuestionario] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const liveRef = useRef(null);

  const questionarioId = item?.questionario_id;
  const turmaId = item?.turma_id;

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const questoes = useMemo(() => {
    return Array.isArray(questionario?.questoes) ? questionario.questoes : [];
  }, [questionario]);

  const respondidas = useMemo(() => {
    return questoes.filter((questao) => {
      const resposta = respostas[questao.id];

      if (!resposta) return false;

      if (questao.tipo === "multipla_escolha") {
        return Number.isInteger(Number(resposta.alternativa_id));
      }

      return String(resposta.resposta_texto || "").trim().length > 0;
    }).length;
  }, [questoes, respostas]);

  const progresso = questoes.length
    ? Math.round((respondidas / questoes.length) * 100)
    : 0;

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      if (!open || !questionarioId || !turmaId) return;

      try {
        setLoading(true);
        setResultado(null);
        setRespostas({});
        setLive("Carregando questionário.");

        if (
          typeof api?.questionario?.iniciar !== "function" ||
          typeof api?.questionario?.responder !== "function"
        ) {
          throw new Error("Facade de questionário indisponível no api.js.");
        }

        await api.questionario.iniciar({
          questionario_id: questionarioId,
          turma_id: turmaId,
        });

        const response = await api.questionario.responder({
          questionario_id: questionarioId,
          turma_id: turmaId,
        });

        if (!ativo) return;

        setQuestionario(extrairData(response));
        setLive("Questionário carregado.");
      } catch (error) {
        console.error("[CertificadoUsuario] erro ao carregar questionário:", error);

        if (!ativo) return;

        setQuestionario(null);
        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível carregar o questionário. Tente novamente."
          )
        );
        setLive("Erro ao carregar questionário.");
      } finally {
        if (ativo) setLoading(false);
      }
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [open, questionarioId, turmaId, setLive]);

  useEffect(() => {
    if (!open) {
      setQuestionario(null);
      setRespostas({});
      setResultado(null);
      setLoading(false);
      setSending(false);
    }
  }, [open]);

  const marcarAlternativa = useCallback((questaoId, alternativaId) => {
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: {
        questao_id: questaoId,
        alternativa_id: alternativaId,
      },
    }));
  }, []);

  const responderTexto = useCallback((questaoId, texto) => {
    setRespostas((prev) => ({
      ...prev,
      [questaoId]: {
        questao_id: questaoId,
        resposta_texto: texto,
      },
    }));
  }, []);

  const enviar = useCallback(async () => {
    if (!questionarioId || !turmaId || sending) return;

    const payload = questoes
      .map((questao) => {
        const resposta = respostas[questao.id];

        if (!resposta) return null;

        if (questao.tipo === "multipla_escolha" && resposta.alternativa_id) {
          return {
            questao_id: questao.id,
            alternativa_id: resposta.alternativa_id,
          };
        }

        const texto = String(resposta.resposta_texto || "").trim();

        if (texto) {
          return {
            questao_id: questao.id,
            resposta_texto: texto,
          };
        }

        return null;
      })
      .filter(Boolean);

    if (!payload.length) {
      notifyWarning("Responda pelo menos uma questão antes de enviar.");
      return;
    }

    try {
      setSending(true);
      setLive("Enviando questionário.");

      if (typeof api?.questionario?.enviar !== "function") {
        throw new Error("Facade api.questionario.enviar indisponível.");
      }

      const response = await api.questionario.enviar({
        questionario_id: questionarioId,
        turma_id: turmaId,
        respostas: payload,
      });

      const data = extrairData(response);

      setResultado(data || { ok: true });
      notifySuccess("Questionário enviado com sucesso.");
      setLive("Questionário enviado.");
      onSubmitted?.();
    } catch (error) {
      console.error("[CertificadoUsuario] erro ao enviar questionário:", error);

      notifyError(
        obterMensagemErro(
          error,
          "Não foi possível enviar o questionário. Tente novamente."
        )
      );
      setLive("Erro ao enviar questionário.");
    } finally {
      setSending(false);
    }
  }, [questionarioId, turmaId, sending, questoes, respostas, onSubmitted, setLive]);

  if (!open) return null;

  const titulo = questionario?.titulo || item?.questionario_titulo || "Questionário";
  const eventoTitulo = obterTitulo(item);
  const turmaNome = obterTurmaNome(item);

  return (
    <div className="fixed inset-0 z-[80]">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={() => {
          if (!sending) onClose?.();
        }}
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 p-3 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="max-h-[92dvh] w-full overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800 sm:max-w-4xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-questionario-titulo"
        >
          <p ref={liveRef} className="sr-only" aria-live="polite" />

          <header className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-violet-950 to-cyan-900 p-5 text-white dark:border-zinc-800">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20">
                  <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                  Questionário pós-curso
                </div>

                <h2
                  id="modal-questionario-titulo"
                  className="mt-3 text-xl font-black tracking-tight sm:text-2xl"
                >
                  {titulo}
                </h2>

                <p className="mt-1 text-sm text-white/80">
                  {eventoTitulo} • {turmaNome}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!sending) onClose?.();
                }}
                className="rounded-full bg-white/10 p-2 ring-1 ring-white/15 transition hover:bg-white/15"
                aria-label="Fechar questionário"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="violet">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {respondidas}/{questoes.length} respondidas
              </Badge>

              <Badge tone="cyan">
                <ShieldCheck className="h-3.5 w-3.5" />
                Progresso {progresso}%
              </Badge>

              {resultado?.nota != null ? (
                <Badge tone={resultado?.aprovado ? "emerald" : "amber"}>
                  Nota: {resultado.nota}
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-white"
                style={{ width: `${progresso}%` }}
                aria-hidden="true"
              />
            </div>
          </header>

          <div className="max-h-[58dvh] overflow-y-auto bg-slate-50 p-4 dark:bg-zinc-950 sm:p-5">
            {loading ? (
              <div className="space-y-3">
                <CarregandoSkeleton height={88} />
                <CarregandoSkeleton height={88} />
                <CarregandoSkeleton height={88} />
              </div>
            ) : !questionario ? (
              <ErroCarregamento
                mensagem="Não foi possível carregar o questionário."
                onRetry={() => window.location.reload()}
              />
            ) : questoes.length === 0 ? (
              <NadaEncontrado
                titulo="Questionário sem questões"
                descricao="Este questionário ainda não possui questões cadastradas."
              />
            ) : (
              <div className="space-y-4">
                {questionario?.descricao ? (
                  <div className="rounded-3xl bg-white p-4 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
                    {questionario.descricao}
                  </div>
                ) : null}

                {questoes.map((questao, index) => {
                  const resposta = respostas[questao.id] || {};
                  const alternativas = Array.isArray(questao.alternativas)
                    ? questao.alternativas
                    : [];

                  return (
                    <section
                      key={questao.id}
                      className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                            Questão {index + 1}
                          </p>
                          <h3 className="mt-1 text-base font-black text-slate-950 dark:text-white">
                            {questao.enunciado}
                          </h3>
                        </div>

                        <Badge tone={questao.tipo === "multipla_escolha" ? "cyan" : "slate"}>
                          {questao.tipo === "multipla_escolha"
                            ? "Múltipla escolha"
                            : "Dissertativa"}
                        </Badge>
                      </div>

                      {questao.tipo === "multipla_escolha" ? (
                        <div className="mt-4 space-y-2">
                          {alternativas.map((alternativa) => {
                            const selected =
                              Number(resposta.alternativa_id) === Number(alternativa.id);

                            return (
                              <button
                                key={alternativa.id}
                                type="button"
                                onClick={() =>
                                  marcarAlternativa(questao.id, alternativa.id)
                                }
                                className={cx(
                                  "w-full rounded-2xl border px-3 py-2 text-left text-sm transition",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                                  selected
                                    ? "border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-100"
                                    : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                                )}
                                aria-pressed={selected}
                              >
                                {alternativa.texto}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          value={resposta.resposta_texto || ""}
                          onChange={(event) =>
                            responderTexto(questao.id, event.target.value)
                          }
                          rows={4}
                          className="mt-4 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-950 outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-violet-950"
                          placeholder="Digite sua resposta..."
                        />
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="flex flex-col gap-2 border-t border-slate-200 bg-white/90 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Responda com atenção antes de enviar.
            </p>

            <div className="flex gap-2">
              <Botao
                type="button"
                variant="contorno"
                onClick={onClose}
                disabled={sending}
              >
                Fechar
              </Botao>

              <Botao
                type="button"
                variant="sucesso"
                onClick={enviar}
                disabled={sending || loading || !questionario}
              >
                <span className="inline-flex items-center gap-2">
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden="true" />
                  )}
                  {sending ? "Enviando..." : "Enviar"}
                </span>
              </Botao>
            </div>
          </footer>
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function CertificadoUsuario() {
  const reduceMotion = useReducedMotion();
  const usuario = useMemo(() => getUsuarioLogado(), []);

  const [busca, setBusca] = useState("");
  const [filtroCertificado, setFiltroCertificado] = useState("todos");
  const [ordemCertificado, setOrdemCertificado] = useState("recentes");

  const [questionarios, setQuestionarios] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [certificados, setCertificados] = useState([]);

  const [loadingQuestionarios, setLoadingQuestionarios] = useState(true);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(true);
  const [loadingCertificados, setLoadingCertificados] = useState(true);

  const [erroQuestionarios, setErroQuestionarios] = useState("");
  const [erroAvaliacoes, setErroAvaliacoes] = useState("");
  const [erroCertificados, setErroCertificados] = useState("");

  const [endpointQuestionarioAusente, setEndpointQuestionarioAusente] =
    useState(false);
  const [endpointAvaliacaoAusente, setEndpointAvaliacaoAusente] = useState(false);
  const [endpointCertificadoAusente, setEndpointCertificadoAusente] =
    useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [modalAvaliacaoOpen, setModalAvaliacaoOpen] = useState(false);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);

  const [modalQuestionarioOpen, setModalQuestionarioOpen] = useState(false);
  const [questionarioSelecionado, setQuestionarioSelecionado] = useState(null);

  const [busyCertificado, setBusyCertificado] = useState(false);
  const [busyDownloadId, setBusyDownloadId] = useState(null);
  const [gerandoKey, setGerandoKey] = useState(null);

  const liveRef = useRef(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const buscaNormalizada = useMemo(() => normalizarBusca(busca), [busca]);

  const loadingInicial =
    loadingQuestionarios || loadingAvaliacoes || loadingCertificados;

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const keyCertificado = useCallback((certificado) => {
    return keyCertificadoFromItem(certificado);
  }, []);

  const carregarQuestionarios = useCallback(async () => {
    if (typeof api?.questionario?.disponiveis !== "function") {
      setEndpointQuestionarioAusente(true);
      return [];
    }

    const response = await api.questionario.disponiveis();
    const data = extrairData(response);

    return Array.isArray(data) ? data : [];
  }, []);

  const carregarAvaliacoes = useCallback(async () => {
    if (typeof api?.avaliacao?.disponiveis !== "function") {
      setEndpointAvaliacaoAusente(true);
      return [];
    }

    const response = await api.avaliacao.disponiveis();
    const data = extrairData(response);

    return Array.isArray(data) ? data : [];
  }, []);

  const carregarCertificados = useCallback(async () => {
  if (
    typeof api?.certificado?.meus !== "function" ||
    typeof api?.certificado?.disponiveis !== "function"
  ) {
    setEndpointCertificadoAusente(true);
    return [];
  }

  const [responseEmitidos, responseDisponiveis] = await Promise.all([
    api.certificado.meus(),
    api.certificado.disponiveis(),
  ]);

  const emitidos = extrairData(responseEmitidos);
  const disponiveis = extrairData(responseDisponiveis);

  const listaEmitidos = Array.isArray(emitidos)
    ? emitidos.map(normalizarCertificadoEmitido)
    : [];

  const listaDisponiveis = Array.isArray(disponiveis)
    ? disponiveis.map(normalizarCertificadoDisponivel)
    : [];

  return deduplicarCertificados([...listaEmitidos, ...listaDisponiveis]);
}, []);

  const carregarModulo = useCallback(
    async ({
      nome,
      carregar,
      setDados,
      setErro,
      setLoading,
      setEndpointAusente,
    }) => {
      setLoading(true);
      setErro("");
      setEndpointAusente(false);

      try {
        const dados = await carregar();

        if (!mountedRef.current) return;

        setDados(dados);
      } catch (error) {
        if (isAbortLike(error) || !mountedRef.current) return;

        if (is404(error)) {
          setEndpointAusente(true);
          setDados([]);
          return;
        }

        const message = obterMensagemErro(
          error,
          `Não foi possível carregar ${nome}.`
        );

        setErro(message);
        setDados([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    []
  );

  const carregarTudo = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!usuario?.id) {
      setErroQuestionarios("Usuário não identificado. Faça login novamente.");
      setErroAvaliacoes("Usuário não identificado. Faça login novamente.");
      setErroCertificados("Usuário não identificado. Faça login novamente.");
      notifyError("Usuário não identificado. Faça login novamente.");
      setLoadingQuestionarios(false);
      setLoadingAvaliacoes(false);
      setLoadingCertificados(false);
      return;
    }

    try {
      setRefreshing(true);
      setLive("Atualizando dados pós-curso.");

      await Promise.all([
        carregarModulo({
          nome: "questionários",
          carregar: carregarQuestionarios,
          setDados: setQuestionarios,
          setErro: setErroQuestionarios,
          setLoading: setLoadingQuestionarios,
          setEndpointAusente: setEndpointQuestionarioAusente,
        }),
        carregarModulo({
          nome: "avaliações",
          carregar: carregarAvaliacoes,
          setDados: setAvaliacoes,
          setErro: setErroAvaliacoes,
          setLoading: setLoadingAvaliacoes,
          setEndpointAusente: setEndpointAvaliacaoAusente,
        }),
        carregarModulo({
          nome: "certificados",
          carregar: carregarCertificados,
          setDados: setCertificados,
          setErro: setErroCertificados,
          setLoading: setLoadingCertificados,
          setEndpointAusente: setEndpointCertificadoAusente,
        }),
      ]);

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      setLive("Dados pós-curso atualizados.");
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  }, [
    usuario?.id,
    carregarModulo,
    carregarQuestionarios,
    carregarAvaliacoes,
    carregarCertificados,
    setLive,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Meus certificados | Escola da Saúde";

    carregarTudo();

    const onKey = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag);

      if (typing) return;

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        carregarTudo();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [carregarTudo]);

  const questionariosFiltrados = useMemo(() => {
    return filtrarPorBusca(questionarios, buscaNormalizada).slice().sort((a, b) => {
      const da = String(a?.data_fim || "");
      const db = String(b?.data_fim || "");

      return db.localeCompare(da);
    });
  }, [questionarios, buscaNormalizada]);

  const avaliacoesFiltradas = useMemo(() => {
    return filtrarPorBusca(avaliacoes, buscaNormalizada).slice().sort((a, b) => {
      const da = String(a?.data_fim || "");
      const db = String(b?.data_fim || "");

      return db.localeCompare(da);
    });
  }, [avaliacoes, buscaNormalizada]);

  const certificadosFiltrados = useMemo(() => {
    const lista = Array.isArray(certificados) ? certificados : [];

    const porStatus = lista.filter((certificado) => {
      const state = getCertificadoState(certificado);

      if (filtroCertificado === "prontos") return state.estado === "pronto";
      if (filtroCertificado === "disponiveis") return state.estado === "geravel";
      if (filtroCertificado === "pendentes") return state.estado === "pendente";

      return true;
    });

    const porBusca = filtrarPorBusca(porStatus, buscaNormalizada);

    return porBusca.slice().sort((a, b) => {
      if (ordemCertificado === "titulo") {
        return obterTitulo(a).localeCompare(obterTitulo(b), "pt-BR");
      }

      const da = String(a?.data_fim || a?.gerado_em || "");
      const db = String(b?.data_fim || b?.gerado_em || "");

      return ordemCertificado === "antigos"
        ? da.localeCompare(db)
        : db.localeCompare(da);
    });
  }, [certificados, buscaNormalizada, filtroCertificado, ordemCertificado]);

  const kpis = useMemo(() => {
    const pendencias =
      questionariosFiltrados.length +
      avaliacoesFiltradas.length +
      certificadosFiltrados.filter((item) => {
        const state = getCertificadoState(item);
        return state.estado !== "pronto";
      }).length;

    return {
      questionarios: questionarios.length,
      avaliacoes: avaliacoes.length,
      certificados: certificados.length,
      pendencias,
    };
  }, [
    questionarios.length,
    avaliacoes.length,
    certificados.length,
    questionariosFiltrados.length,
    avaliacoesFiltradas.length,
    certificadosFiltrados,
  ]);

  const abrirAvaliacao = useCallback((avaliacao) => {
    setAvaliacaoSelecionada(avaliacao);
    setModalAvaliacaoOpen(true);
  }, []);

  const fecharAvaliacao = useCallback(() => {
    setModalAvaliacaoOpen(false);
    setAvaliacaoSelecionada(null);
  }, []);

  const abrirQuestionario = useCallback((questionario) => {
    if (questionario?.bloqueado_por_tentativas) {
      notifyWarning("Limite de tentativas atingido para este questionário.");
      return;
    }

    setQuestionarioSelecionado(questionario);
    setModalQuestionarioOpen(true);
  }, []);

  const fecharQuestionario = useCallback(() => {
    setModalQuestionarioOpen(false);
    setQuestionarioSelecionado(null);
  }, []);

  const gerarCertificado = useCallback(
    async (certificado) => {
      if (busyCertificado) return;

      const state = getCertificadoState(certificado);

      if (state.estado === "pendente" || state.estado === "bloqueado") {
        notifyWarning(state.motivo || "Certificado ainda não liberado.");
        return;
      }

      if (!usuario?.id) {
        notifyError("Usuário não identificado. Faça login novamente.");
        return;
      }

      if (typeof api?.certificado?.gerar !== "function") {
        notifyError("Emissão de certificado ainda não está disponível.");
        return;
      }

      const eventoId = Number(certificado?.evento_id);
      const turmaId = Number(certificado?.turma_id);

      if (
        !Number.isInteger(eventoId) ||
        eventoId <= 0 ||
        !Number.isInteger(turmaId) ||
        turmaId <= 0
      ) {
        notifyError("Dados do certificado inválidos para emissão.");
        return;
      }

      try {
        const key = keyCertificado(certificado);

        setBusyCertificado(true);
        setGerandoKey(key);
        setLive("Emitindo certificado.");

        const response = await api.certificado.gerar({
          usuario_id: Number(usuario.id),
          evento_id: eventoId,
          turma_id: turmaId,
          tipo: "usuario",
        });

        const data = extrairData(response);
        const code = getEnvelopeCode(response);

        console.warn("[CertificadoUsuario] retorno gerar certificado", {
  response,
  data,
});

        notifySuccess(
          code === "CERTIFICADO_JA_EMITIDO"
            ? "Certificado já estava emitido. O documento existente foi preservado."
            : "Certificado emitido com sucesso."
        );

        setCertificados((prev) =>
          prev.map((item) => {
            if (
              Number(item.evento_id) === eventoId &&
              Number(item.turma_id) === turmaId
            ) {
              return {
                ...item,
                certificado_id: data?.certificado_id || data?.id || item.certificado_id,
id_certificado: data?.certificado_id || data?.id || item.id_certificado,
                numero_certificado:
                  data?.numero_certificado || item.numero_certificado,
                codigo_validacao: data?.codigo_validacao || item.codigo_validacao,
                arquivo_pdf: data?.arquivo_pdf || item.arquivo_pdf,
                status: data?.status || "emitido",
              };
            }

            return item;
          })
        );

        await carregarTudo();
      } catch (error) {
        console.error("[CertificadoUsuario] erro ao emitir certificado:", error);

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível emitir o certificado. Verifique as pendências e tente novamente."
          )
        );
      } finally {
        setBusyCertificado(false);
        setGerandoKey(null);
        setLive("Emissão finalizada.");
      }
    },
    [busyCertificado, usuario?.id, keyCertificado, carregarTudo, setLive]
  );

  const baixarCertificado = useCallback(
    async (certificado) => {
      const certificadoId = Number(getCertificadoId(certificado) || 0);

if (!Number.isInteger(certificadoId) || certificadoId <= 0) {
  console.warn("[CertificadoUsuario] certificado sem certificado_id", {
    certificado,
    id: certificado?.id,
    certificado_id: certificado?.certificado_id,
    id_certificado: certificado?.id_certificado,
    turma_id: certificado?.turma_id,
    evento_id: certificado?.evento_id,
  });

  notifyError(
    "Este item ainda não possui certificado emitido para download. Tente emitir o certificado antes de baixar."
  );

  return;
}

      if (!Number.isInteger(certificadoId) || certificadoId <= 0) {
        notifyError("Certificado sem ID para download.");
        return;
      }

      if (typeof api?.certificado?.download !== "function") {
        notifyError("Download de certificado ainda não está disponível.");
        return;
      }

      try {
        setBusyDownloadId(certificadoId);
        setLive("Baixando certificado.");

        const result = await api.certificado.download(certificadoId);

        const blob = result?.blob || result?.data || result;
        const filename =
          result?.filename ||
          `${nomeArquivoSeguro(
            getNumeroCertificado(certificado) ||
              `certificado_${obterTitulo(certificado)}_turma_${
                certificado?.turma_id || certificadoId
              }`
          )}.pdf`;

        downloadBlob(filename, blob);
        notifySuccess("Download iniciado.");
      } catch (error) {
        console.error("[CertificadoUsuario] erro ao baixar certificado:", error);

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível baixar o certificado. Tente novamente."
          )
        );
      } finally {
        setBusyDownloadId(null);
        setLive("Download finalizado.");
      }
    },
    [setLive]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6">
        <HeaderHero
          titulo="Meus certificados"
          subtitulo="Acompanhe questionários, avaliações e certificados liberados após seus cursos."
          icone={Award}
          tamanho="lg"
          raio="xl"
        />
      </div>

      <BarraContextual refreshing={refreshing} onRefresh={carregarTudo} />

      <ResumoPremium kpis={kpis} />

      {(loadingInicial || refreshing) && (
        <div
          className="sticky top-0 z-50 mt-4 h-1 w-full bg-emerald-100 dark:bg-emerald-950"
          role="progressbar"
          aria-label="Carregando informações"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-emerald-700",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      )}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <BuscaEFiltros
          busca={busca}
          setBusca={setBusca}
          filtroCertificado={filtroCertificado}
          setFiltroCertificado={setFiltroCertificado}
          ordemCertificado={ordemCertificado}
          setOrdemCertificado={setOrdemCertificado}
          limparBusca={() => setBusca("")}
        />

        <div className="rounded-[1.5rem] bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-100 dark:ring-emerald-800/50">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black">Como funciona?</p>
              <p className="mt-1">
                Primeiro conclua questionários e avaliações obrigatórias, quando
                houver. Depois, acompanhe a liberação do certificado conforme as
                regras da turma: encerramento, frequência mínima, avaliação,
                questionário obrigatório e emissão documental.
              </p>
            </div>
          </div>
        </div>

          <SecaoModulo
            id="questionarios"
            title="Questionários"
            description="Responda questionários pós-curso vinculados às turmas em que você participou."
            icon={BookOpenCheck}
            tone="violet"
            loading={loadingQuestionarios}
            error={erroQuestionarios}
            endpointAusente={endpointQuestionarioAusente}
            emptyTitle="Nenhum questionário disponível"
            emptyDescription="Quando houver questionário pós-curso liberado, ele aparecerá aqui."
          >
            {questionariosFiltrados.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {questionariosFiltrados.map((item) => {
                  const bloqueado = Boolean(item?.bloqueado_por_tentativas);

                  return (
                    <Card
                      key={`questionario-${item.questionario_id}-${item.turma_id}`}
                      tone={bloqueado ? "amber" : "violet"}
                    >
                      <div className="flex flex-col gap-4">
                        <div>
                          <h3 className="text-lg font-black text-slate-950 dark:text-white">
                            {obterTitulo(item)}
                          </h3>

                          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                            {obterTurmaNome(item)} • {obterPeriodo(item)}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone={bloqueado ? "amber" : "violet"}>
                              {bloqueado ? (
                                <AlertCircle className="h-3.5 w-3.5" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              {bloqueado ? "Bloqueado" : "Disponível"}
                            </Badge>

                            {item?.tentativas_enviadas != null ? (
                              <Badge tone="cyan">
                                Tentativas: {item.tentativas_enviadas}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <Botao
                          type="button"
                          variant="sucesso"
                          onClick={() => abrirQuestionario(item)}
                          disabled={bloqueado}
                        >
                          <span className="inline-flex items-center gap-2">
                            Responder
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </span>
                        </Botao>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}
          </SecaoModulo>

          <SecaoModulo
            id="avaliacoes"
            title="Avaliações"
            description="Avalie os eventos concluídos quando a avaliação estiver liberada."
            icon={ClipboardList}
            tone="amber"
            loading={loadingAvaliacoes}
            error={erroAvaliacoes}
            endpointAusente={endpointAvaliacaoAusente}
            emptyTitle="Nenhuma avaliação pendente"
            emptyDescription="Quando houver avaliação pós-curso liberada, ela aparecerá aqui."
          >
            {avaliacoesFiltradas.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {avaliacoesFiltradas.map((item) => (
                  <Card
                    key={`avaliacao-${item.turma_id}-${item.evento_id || obterTitulo(item)}`}
                    tone="amber"
                  >
                    <div className="flex flex-col gap-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">
                          {obterTitulo(item)}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                          {obterTurmaNome(item)} • {obterPeriodo(item)}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge tone="amber">
                            <ClipboardList className="h-3.5 w-3.5" />
                            Avaliação pendente
                          </Badge>
                        </div>
                      </div>

                      <Botao
                        type="button"
                        variant="sucesso"
                        onClick={() => abrirAvaliacao(item)}
                      >
                        <span className="inline-flex items-center gap-2">
                          Avaliar agora
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </Botao>
                    </div>
                  </Card>
                ))}
              </div>
            ) : null}
          </SecaoModulo>

          <SecaoModulo
            id="certificados"
            title="Certificados"
            description="Emita ou baixe certificados com número oficial, validação pública e QR Code."
            icon={Award}
            tone="emerald"
            loading={loadingCertificados}
            error={erroCertificados}
            endpointAusente={endpointCertificadoAusente}
            emptyTitle="Nenhum certificado encontrado"
            emptyDescription="Certificados aparecem aqui quando o curso encerra e as regras de liberação são cumpridas."
          >
            {certificadosFiltrados.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {certificadosFiltrados.map((certificado) => {
                  const state = getCertificadoState(certificado);
                  const key = keyCertificado(certificado);
                  const gerando = gerandoKey === key;
                  const certificadoId = Number(
                    certificado?.certificado_id || certificado?.id || 0
                  );
                  const baixando = busyDownloadId === certificadoId;
                  const numeroCertificado = getNumeroCertificado(certificado);

                  const tone =
                    state.estado === "pronto"
                      ? "emerald"
                      : state.estado === "pendente" || state.estado === "bloqueado"
                        ? "amber"
                        : "slate";

                  return (
                    <Card key={key} tone={tone} busy={gerando || baixando}>
                      <div className="flex flex-col gap-4">
                        <div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                                {obterTitulo(certificado)}
                              </h3>

                              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                                {obterTurmaNome(certificado)} •{" "}
                                {obterPeriodo(certificado)}
                              </p>
                            </div>

                            <Badge
                              tone={
                                state.estado === "pronto"
                                  ? "emerald"
                                  : state.estado === "geravel"
                                    ? "cyan"
                                    : "amber"
                              }
                            >
                              {state.estado === "pronto" ? (
                                <FileCheck2 className="h-3.5 w-3.5" />
                              ) : state.estado === "geravel" ? (
                                <FilePlus2 className="h-3.5 w-3.5" />
                              ) : (
                                <HelpCircle className="h-3.5 w-3.5" />
                              )}
                              {state.label}
                            </Badge>
                          </div>

                          <div className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/60">
                            Certificado nº:{" "}
                            <span className="font-black">
                              {numeroCertificado || getNumeroCertificadoLabel(certificado)}
                            </span>
                          </div>

                          {certificado?.codigo_validacao ? (
                            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
                              Código de validação:{" "}
                              <span className="font-black">
                                {certificado.codigo_validacao}
                              </span>
                            </p>
                          ) : null}

                          {state.motivo ? (
                            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
                              {state.motivo}
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-4 w-4" aria-hidden="true" />
                              {obterPeriodo(certificado)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          {state.estado === "pronto" ? (
                            <Botao
                              type="button"
                              variant="sucesso"
                              onClick={() => baixarCertificado(certificado)}
                              disabled={baixando}
                            >
                              <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                                {baixando ? (
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Download className="h-4 w-4" aria-hidden="true" />
                                )}
                                {baixando ? "Baixando..." : "Baixar"}
                              </span>
                            </Botao>
                          ) : (
                            <Botao
                              type="button"
                              variant="sucesso"
                              onClick={() => gerarCertificado(certificado)}
                              disabled={
                                gerando ||
                                busyCertificado ||
                                state.estado === "pendente" ||
                                state.estado === "bloqueado"
                              }
                            >
                              <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                                {gerando ? (
                                  <Loader2
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                                )}
                                {gerando ? "Emitindo..." : "Emitir certificado"}
                              </span>
                            </Botao>
                          )}

                          <Botao
                            type="button"
                            variant="contorno"
                            onClick={carregarTudo}
                            disabled={refreshing}
                          >
                            <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
                              <RefreshCw
                                className={cx(
                                  "h-4 w-4",
                                  refreshing && "animate-spin"
                                )}
                                aria-hidden="true"
                              />
                              Recarregar
                            </span>
                          </Botao>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {!loadingCertificados && !endpointCertificadoAusente ? (
              <div className="mt-6 rounded-[1.5rem] bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
                <p className="font-black text-slate-950 dark:text-white">
                  Como o certificado é liberado?
                </p>
                <p className="mt-1">
                  O certificado eletrônico fica disponível após o encerramento da
                  turma e conforme as regras aplicáveis: frequência mínima,
                  avaliação do evento e questionário obrigatório, quando houver.
                  Após emitido, o documento recebe número oficial, código de
                  validação e QR Code, sendo preservado como documento eletrônico.
                </p>
              </div>
            ) : null}
          </SecaoModulo>
      </main>

      <ModalAvaliacaoFormulario
        isOpen={modalAvaliacaoOpen}
        onClose={fecharAvaliacao}
        evento={avaliacaoSelecionada}
        turma_id={avaliacaoSelecionada?.turma_id || null}
        recarregar={carregarTudo}
      />

      <ModalQuestionario
        open={modalQuestionarioOpen}
        item={questionarioSelecionado}
        onClose={fecharQuestionario}
        onSubmitted={carregarTudo}
      />

      <Footer />
    </div>
  );
}
