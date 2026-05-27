// 📁 src/pages/UsuarioSubmissao.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página do USUÁRIO/AUTOR para chamadas e submissões de trabalhos.
//
// Contratos oficiais usados:
// - GET    /api/chamada/ativa
// - GET    /api/chamada/:id/modelo-banner
// - GET    /api/chamada/:id/modelo-oral
// - GET    /api/submissao/minhas
// - GET    /api/submissao/:id/poster
// - DELETE /api/trabalho/:id
//
// Diretrizes v2.0:
// - sem /api/chamadas;
// - sem /api/chamadas/ativas;
// - sem /api/chamadas/:id/modelo-banner;
// - sem /api/chamadas/:id/modelo-oral;
// - sem exclusão por /api/submissao/:id;
// - sem status legado "submetido", "aprovado_exposicao", "aprovado_oral", "reprovado";
// - Footer em components/layout/Footer;
// - layout premium real;
// - mobile-first;
// - acessibilidade;
// - anti-fuso sem new Date("YYYY-MM-DD").
// 
// Observação:
// ModalVerEdital, ModalInscreverTrabalho e ModalConfirmacao devem ser revisados
// em seguida para garantir contrato v2.0 completo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import api, { apiGetFile, downloadBlob } from "../services/api";
import ModalVerEdital from "../components/trabalhos/ModalVerEdital";
import ModalInscreverTrabalho from "../components/trabalhos/ModalInscreverTrabalho";
import ModalConfirmacao from "../components/ui/ModalConfirmacao";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrapArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function toBrDateTimeSafe(input) {
  if (!input) return "—";

  const text = String(input).trim();

  if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) return text;

  const dateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (dateTime) {
    const [, year, month, day, hour, minute] = dateTime;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${day}/${month}/${year}`;
  }

  return text;
}

function parseSortableTimestamp(input) {
  if (!input) return 0;

  const text = String(input).trim();

  const dateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (dateTime) {
    const [, year, month, day, hour, minute, second = "00"] = dateTime;
    return Number(`${year}${month}${day}${hour}${minute}${second}`);
  }

  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return Number(`${year}${month}${day}120000`);
  }

  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortSubmissoesRecentes(list = []) {
  return [...list].sort((a, b) => {
    const aDate = parseSortableTimestamp(
      a?.atualizado_em || a?.updated_at || a?.criado_em || a?.created_at || 0
    );

    const bDate = parseSortableTimestamp(
      b?.atualizado_em || b?.updated_at || b?.criado_em || b?.created_at || 0
    );

    return bDate - aDate;
  });
}

function normalizarStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value === "rascunho") return "rascunho";
  if (value === "submetida") return "submetida";
  if (value === "em_avaliacao") return "em_avaliacao";
  if (value === "aprovada_exposicao") return "aprovada_exposicao";
  if (value === "aprovada_oral") return "aprovada_oral";
  if (value === "aprovada") return "aprovada";
  if (value === "reprovada") return "reprovada";
  if (value === "cancelada") return "cancelada";

  return value || "indefinido";
}

function statusLabel(status) {
  const value = normalizarStatus(status);

  const labels = {
    rascunho: "Rascunho",
    submetida: "Submetida",
    em_avaliacao: "Em avaliação",
    aprovada_exposicao: "Aprovada para exposição",
    aprovada_oral: "Aprovada para oral",
    aprovada: "Aprovada",
    reprovada: "Reprovada",
    cancelada: "Cancelada",
    indefinido: "Indefinido",
  };

  return labels[value] || value;
}

function okEscrita(submissao) {
  const escrita = String(submissao?.status_escrita || "").toLowerCase();
  const status = normalizarStatus(submissao?.status);

  return (
    escrita === "aprovado" ||
    status === "aprovada_exposicao" ||
    status === "aprovada" ||
    Boolean(submissao?._exposicao_aprovada)
  );
}

function okOral(submissao) {
  const oral = String(submissao?.status_oral || "").toLowerCase();
  const status = normalizarStatus(submissao?.status);

  return (
    oral === "aprovado" ||
    status === "aprovada_oral" ||
    status === "aprovada" ||
    Boolean(submissao?._oral_aprovada)
  );
}

const STATUS_BLOQUEADOS_EDICAO = new Set([
  "em_avaliacao",
  "aprovada_exposicao",
  "aprovada_oral",
  "aprovada",
  "reprovada",
  "cancelada",
]);

function isDentroPrazo(row) {
  return Boolean(row?.dentro_prazo ?? row?.dentroPrazo);
}

function canEdit(row) {
  const status = normalizarStatus(row?.status);
  return isDentroPrazo(row) && !STATUS_BLOQUEADOS_EDICAO.has(status);
}

function canDelete(row) {
  const status = normalizarStatus(row?.status);
  return status === "rascunho" || status === "submetida";
}

function matchSearch(row, term) {
  const needle = String(term || "").trim().toLowerCase();

  if (!needle) return true;

  return [
    row?.titulo,
    row?.chamada_titulo,
    row?.status,
    row?.linha_tematica_nome,
    row?.linha_tematica_codigo,
  ]
    .filter(Boolean)
    .join(" • ")
    .toLowerCase()
    .includes(needle);
}

/* =========================================================================
   UI primitives
=========================================================================== */

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-950 dark:bg-slate-950">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute right-[-12%] top-24 h-96 w-96 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute bottom-[-15%] left-[25%] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      </div>

      <div className="min-h-screen bg-slate-50/95 dark:bg-slate-950/85 dark:text-slate-50">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={cx(
        "rounded-[1.75rem] border border-white/70 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur-xl",
        "dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  icon: Icon,
  tone = "slate",
  size = "md",
  loading = false,
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-violet-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    success:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    danger:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        sizes[size],
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

function Badge({ children, tone = "slate", icon: Icon }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    blue:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    fuchsia:
      "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/40 dark:text-fuchsia-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const value = normalizarStatus(status);

  const config = {
    rascunho: { tone: "slate", label: "Rascunho" },
    submetida: { tone: "blue", label: "Submetida" },
    em_avaliacao: { tone: "amber", label: "Em avaliação" },
    aprovada_exposicao: { tone: "emerald", label: "Exposição" },
    aprovada_oral: { tone: "emerald", label: "Oral" },
    aprovada: { tone: "emerald", label: "Aprovada" },
    reprovada: { tone: "rose", label: "Reprovada" },
    cancelada: { tone: "rose", label: "Cancelada" },
    indefinido: { tone: "slate", label: "Indefinido" },
  };

  const item = config[value] || config.indefinido;

  return <Badge tone={item.tone}>{item.label}</Badge>;
}

/* =========================================================================
   API helpers
=========================================================================== */

async function baixarModeloBanner(chamadaId) {
  const { blob, filename } = await apiGetFile(`/chamada/${chamadaId}/modelo-banner`);
  downloadBlob(filename || `modelo-banner-${chamadaId}.pptx`, blob);
}

async function baixarModeloOral(chamadaId) {
  const { blob, filename } = await apiGetFile(`/chamada/${chamadaId}/modelo-oral`);
  downloadBlob(filename || `modelo-oral-${chamadaId}.pptx`, blob);
}

async function modeloExiste(chamadaId, tipo) {
  try {
    const endpoint =
      tipo === "oral"
        ? `/chamada/${chamadaId}/modelo-oral`
        : `/chamada/${chamadaId}/modelo-banner`;

    const { blob } = await apiGetFile(endpoint);

    return Boolean(blob);
  } catch {
    return false;
  }
}

async function baixarPosterSubmissao(submissaoId, filenameFallback) {
  const { blob, filename } = await apiGetFile(`/submissao/${submissaoId}/poster`);
  downloadBlob(filename || filenameFallback || `poster-submissao-${submissaoId}`, blob);
}

/* =========================================================================
   Regras
=========================================================================== */

function RegrasEDicasSection() {
  const itens = [
    {
      titulo: "Submissão e arquivo principal",
      texto:
        "Preencha o trabalho com atenção e envie o arquivo principal quando o edital solicitar. O envio deve respeitar o prazo da chamada.",
    },
    {
      titulo: "Avaliação escrita",
      texto:
        "A avaliação considera os critérios definidos na chamada. Após entrada em avaliação, a edição pelo autor fica bloqueada para preservar a rastreabilidade.",
    },
    {
      titulo: "Apresentação oral",
      texto:
        "Quando aprovado para apresentação oral, baixe o modelo oficial de slides, se disponível, e siga as orientações institucionais.",
    },
  ];

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-600" />
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          Regras & Dicas
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {itens.map((item, index) => (
          <div
            key={item.titulo}
            className="rounded-3xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/20"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-sm font-black text-white">
              {index + 1}
            </div>
            <h3 className="font-black text-slate-900 dark:text-white">{item.titulo}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {item.texto}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* =========================================================================
   Cards
=========================================================================== */

function ChamadaCard({
  chamada,
  modeloBannerDisponivel,
  modeloOralDisponivel,
  baixandoBanner,
  baixandoOral,
  onVerEdital,
  onSubmeter,
  onBaixarBanner,
  onBaixarOral,
}) {
  const dentro = Boolean(chamada?.dentro_prazo ?? chamada?.dentroPrazo);
  const prazo = chamada?.prazo_final_br || chamada?.prazo_final || chamada?.prazo || null;

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/20"
    >
      <div className="h-1.5 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500" />

      <div className="flex h-full flex-col p-5">
        <div className="flex-1">
          <div className="mb-3 flex flex-wrap gap-2">
            {dentro ? (
              <Badge tone="emerald" icon={Clock}>Dentro do prazo</Badge>
            ) : (
              <Badge tone="rose" icon={Clock}>Prazo encerrado</Badge>
            )}
          </div>

          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {chamada.titulo || "Chamada sem título"}
          </h3>

          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {chamada.descricao_markdown || "Sem descrição disponível."}
          </p>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Prazo final: <strong>{toBrDateTimeSafe(prazo)}</strong>
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button tone="slate" size="sm" icon={FileText} onClick={onVerEdital}>
            Ver edital
          </Button>

          {dentro ? (
            <Button tone="primary" size="sm" icon={PlusCircle} onClick={onSubmeter}>
              Submeter
            </Button>
          ) : null}

          {modeloBannerDisponivel ? (
            <Button
              tone="ghost"
              size="sm"
              icon={Download}
              loading={baixandoBanner}
              onClick={onBaixarBanner}
            >
              Modelo pôster
            </Button>
          ) : null}

          {modeloOralDisponivel ? (
            <Button
              tone="ghost"
              size="sm"
              icon={Download}
              loading={baixandoOral}
              onClick={onBaixarOral}
            >
              Modelo oral
            </Button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function AprovacaoSection({ submissao }) {
  const escrita = okEscrita(submissao);
  const oral = okOral(submissao);

  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status={submissao?.status} />

      {escrita ? (
        <Badge tone="emerald" icon={Award}>Exposição</Badge>
      ) : null}

      {oral ? (
        <Badge tone="emerald" icon={CheckCircle2}>Apresentação oral</Badge>
      ) : null}
    </div>
  );
}

function PosterCell({ id, nome }) {
  const [downloading, setDownloading] = useState(false);

  if (!nome) {
    return <span className="text-sm italic text-slate-400">—</span>;
  }

  async function baixar() {
    setDownloading(true);

    try {
      await baixarPosterSubmissao(id, nome || `poster-submissao-${id}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={baixar}
      disabled={downloading}
      className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 transition hover:underline disabled:opacity-60 dark:text-violet-300"
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {nome}
    </button>
  );
}

function SubmissionCard({
  submissao,
  podeEditar,
  podeExcluir,
  excluindo,
  onEditar,
  onExcluir,
  onBaixarModeloOral,
  modeloOralDisponivel,
  baixandoModeloOral,
}) {
  const oralAprovada = okOral(submissao);

  return (
    <motion.article
      layout
      className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/20"
    >
      <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500" />

      <div className="flex h-full flex-col gap-4 p-5">
        <div>
          <h3 className="line-clamp-3 text-base font-black text-slate-900 dark:text-white">
            {submissao.titulo || "Trabalho sem título"}
          </h3>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {submissao.chamada_titulo || "Chamada não informada"}
          </p>
        </div>

        <AprovacaoSection submissao={submissao} />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Pôster / arquivo principal
          </p>
          <PosterCell id={submissao.id} nome={submissao.poster_nome || submissao.banner_nome} />
        </div>

        {oralAprovada ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Apresentação oral
            </p>

            {modeloOralDisponivel ? (
              <Button
                tone="ghost"
                size="sm"
                icon={Download}
                loading={baixandoModeloOral}
                onClick={onBaixarModeloOral}
              >
                Baixar modelo oral
              </Button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Modelo oral indisponível para esta chamada.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2">
          {podeEditar ? (
            <Button tone="primary" size="sm" icon={Pencil} onClick={onEditar}>
              Editar
            </Button>
          ) : (
            <Badge tone="slate">Edição indisponível</Badge>
          )}

          {podeExcluir ? (
            <Button
              tone="danger"
              size="sm"
              icon={Trash2}
              loading={excluindo}
              onClick={onExcluir}
            >
              Excluir
            </Button>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

/* =========================================================================
   Página principal
=========================================================================== */

export default function UsuarioSubmissao() {
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [erro, setErro] = useState("");
  const [chamadas, setChamadas] = useState([]);
  const [minhas, setMinhas] = useState([]);

  const [modeloBannerMap, setModeloBannerMap] = useState({});
  const [modeloOralMap, setModeloOralMap] = useState({});
  const [baixandoBannerMap, setBaixandoBannerMap] = useState({});
  const [baixandoOralMap, setBaixandoOralMap] = useState({});

  const [modalEdital, setModalEdital] = useState(null);
  const [modalInscricao, setModalInscricao] = useState(null);
  const [confirmacao, setConfirmacao] = useState(null);
  const [excluindoId, setExcluindoId] = useState(null);

  const [q, setQ] = useState("");

  async function carregarModelos(chamadasArr) {
    const ids = chamadasArr.map((item) => item.id).filter(Boolean);

    if (ids.length === 0) {
      setModeloBannerMap({});
      setModeloOralMap({});
      return;
    }

    const [bannerSettled, oralSettled] = await Promise.all([
      Promise.allSettled(ids.map((id) => modeloExiste(id, "banner"))),
      Promise.allSettled(ids.map((id) => modeloExiste(id, "oral"))),
    ]);

    const bannerMap = {};
    const oralMap = {};

    ids.forEach((id, index) => {
      bannerMap[id] =
        bannerSettled[index]?.status === "fulfilled"
          ? Boolean(bannerSettled[index].value)
          : false;

      oralMap[id] =
        oralSettled[index]?.status === "fulfilled"
          ? Boolean(oralSettled[index].value)
          : false;
    });

    setModeloBannerMap(bannerMap);
    setModeloOralMap(oralMap);
  }

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    setErro("");

    try {
      const [chamadasResponse, minhasResponse] = await Promise.all([
        api.get("/chamada/ativa"),
        api.get("/submissao/minhas"),
      ]);

      const chamadasArr = unwrapArray(chamadasResponse);
      const minhasArr = unwrapArray(minhasResponse);

      setChamadas(chamadasArr);
      setMinhas(sortSubmissoesRecentes(minhasArr));

      await carregarModelos(chamadasArr);
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível carregar suas chamadas e submissões agora."
        )
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Submissão de Trabalhos | Escola da Saúde";
    loadData();
  }, [loadData]);

  async function refresh() {
    setRefreshing(true);

    try {
      await loadData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSucesso() {
    try {
      const response = await api.get("/submissao/minhas");
      setMinhas(sortSubmissoesRecentes(unwrapArray(response)));
    } catch {
      setErro("Não foi possível atualizar suas submissões após salvar.");
    }
  }

  async function handleBaixarModeloBanner(chamadaId) {
    setBaixandoBannerMap((current) => ({ ...current, [chamadaId]: true }));

    try {
      await baixarModeloBanner(chamadaId);
    } finally {
      setBaixandoBannerMap((current) => ({ ...current, [chamadaId]: false }));
    }
  }

  async function handleBaixarModeloOral(chamadaId) {
    setBaixandoOralMap((current) => ({ ...current, [chamadaId]: true }));

    try {
      await baixarModeloOral(chamadaId);
    } finally {
      setBaixandoOralMap((current) => ({ ...current, [chamadaId]: false }));
    }
  }

  function pedirExclusao(row) {
    setConfirmacao({
      id: row?.id,
      titulo: row?.titulo || "submissão",
    });
  }

  async function confirmarExclusao() {
    if (!confirmacao?.id) return;

    setExcluindoId(confirmacao.id);

    try {
      await api.delete(`/trabalho/${confirmacao.id}`);
      await handleSucesso();
      setConfirmacao(null);
    } catch (error) {
      setErro(
        getErrorMessage(
          error,
          "Não foi possível excluir a submissão. Ela pode estar fora do prazo ou já em avaliação."
        )
      );
    } finally {
      setExcluindoId(null);
    }
  }

  const minhasFiltradas = useMemo(
    () => minhas.filter((item) => matchSearch(item, q)),
    [minhas, q]
  );

  const countByStatus = useMemo(() => {
    const count = {
      submetida: 0,
      em_avaliacao: 0,
      aprovada: 0,
      reprovada: 0,
    };

    for (const item of minhas) {
      const status = normalizarStatus(item.status);

      if (status === "submetida") {
        count.submetida += 1;
      } else if (status === "em_avaliacao") {
        count.em_avaliacao += 1;
      } else if (
        status === "aprovada_exposicao" ||
        status === "aprovada_oral" ||
        status === "aprovada" ||
        okEscrita(item) ||
        okOral(item)
      ) {
        count.aprovada += 1;
      } else if (status === "reprovada") {
        count.reprovada += 1;
      }
    }

    return count;
  }, [minhas]);

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900/90">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
            <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Carregando chamadas e submissões...
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ModalConfirmacao
        open={Boolean(confirmacao)}
        onClose={() => setConfirmacao(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir submissão"
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Tem certeza que deseja excluir a submissão{" "}
          {confirmacao?.titulo ? (
            <em className="font-semibold">“{confirmacao.titulo}”</em>
          ) : null}
          ? Essa ação não pode ser desfeita.
        </p>
      </ModalConfirmacao>

      <HeaderHero
  icone={FileText}
  etiqueta="Submissão de trabalhos"
  titulo="Submissão de Trabalhos"
  subtitulo="Acompanhe suas submissões, edite rascunhos, baixe modelos oficiais e envie novos trabalhos dentro do prazo da chamada."
/>

      <main id="conteudo" className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
       <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h2 className="text-xl font-black text-slate-900 dark:text-white">
      Acompanhe suas chamadas e submissões
    </h2>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
      Consulte chamadas abertas, modelos oficiais e o andamento dos seus trabalhos.
    </p>
  </div>

  <Button
    tone="success"
    icon={RefreshCcw}
    loading={refreshing}
    onClick={refresh}
  >
    {refreshing ? "Atualizando..." : "Atualizar dados"}
  </Button>
</section>
 {erro ? (
          <GlassCard className="p-4">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <div>
                <p className="font-black">Atenção</p>
                <p className="mt-1">{erro}</p>
              </div>
            </div>
          </GlassCard>
        ) : null}

        <section aria-labelledby="metricas">
          <h2 id="metricas" className="sr-only">
            Métricas de submissões
          </h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <GlassCard className="p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Submetidas
              </p>
              <p className="mt-2 text-3xl font-black text-blue-600">
                {countByStatus.submetida}
              </p>
              <div className="mt-2 flex justify-center">
                <Badge tone="blue">Submetida</Badge>
              </div>
            </GlassCard>

            <GlassCard className="p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Em avaliação
              </p>
              <p className="mt-2 text-3xl font-black text-amber-600">
                {countByStatus.em_avaliacao}
              </p>
              <div className="mt-2 flex justify-center">
                <Badge tone="amber">Em avaliação</Badge>
              </div>
            </GlassCard>

            <GlassCard className="p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Aprovadas
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-600">
                {countByStatus.aprovada}
              </p>
              <div className="mt-2 flex justify-center">
                <Badge tone="emerald">Aprovada</Badge>
              </div>
            </GlassCard>

            <GlassCard className="p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Reprovadas
              </p>
              <p className="mt-2 text-3xl font-black text-rose-600">
                {countByStatus.reprovada}
              </p>
              <div className="mt-2 flex justify-center">
                <Badge tone="rose">Reprovada</Badge>
              </div>
            </GlassCard>
          </div>
        </section>

        <RegrasEDicasSection />

        <section aria-labelledby="chamadas-abertas" className="space-y-4">
          <div className="flex flex-col gap-2 text-center">
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="h-5 w-5 text-violet-600" />
              <h2 id="chamadas-abertas" className="text-xl font-black text-slate-900 dark:text-white">
                Chamadas abertas
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escolha uma chamada dentro do prazo para submeter seu trabalho.
            </p>
          </div>

          {chamadas.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma chamada disponível no momento.
              </p>
            </GlassCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence initial={false}>
                {chamadas.map((chamada) => (
                  <ChamadaCard
                    key={chamada.id}
                    chamada={chamada}
                    modeloBannerDisponivel={Boolean(modeloBannerMap[chamada.id])}
                    modeloOralDisponivel={Boolean(modeloOralMap[chamada.id])}
                    baixandoBanner={Boolean(baixandoBannerMap[chamada.id])}
                    baixandoOral={Boolean(baixandoOralMap[chamada.id])}
                    onVerEdital={() => setModalEdital(chamada.id)}
                    onSubmeter={() => setModalInscricao({ chamadaId: chamada.id })}
                    onBaixarBanner={() => handleBaixarModeloBanner(chamada.id)}
                    onBaixarOral={() => handleBaixarModeloOral(chamada.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <section aria-labelledby="minhas-submissoes" className="space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 id="minhas-submissoes" className="text-xl font-black text-slate-900 dark:text-white">
                Minhas submissões
              </h2>
            </div>

            <div className="relative w-full max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                inputMode="search"
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar por título, chamada ou status..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-950"
                aria-label="Buscar nas minhas submissões"
              />
            </div>
          </div>

          {minhas.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Você ainda não submeteu nenhum trabalho.
              </p>
            </GlassCard>
          ) : minhasFiltradas.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <Filter className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Nenhuma submissão encontrada para o termo informado.
              </p>
            </GlassCard>
          ) : (
            <motion.div
              layout={!reduceMotion}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {minhasFiltradas.map((submissao) => {
                const chamadaId =
                  submissao.chamada_id ?? submissao.chamadaId ?? submissao.chamada?.id;

                return (
                  <SubmissionCard
                    key={submissao.id}
                    submissao={submissao}
                    podeEditar={canEdit(submissao)}
                    podeExcluir={canDelete(submissao)}
                    excluindo={excluindoId === submissao.id}
                    onEditar={() => setModalInscricao({ submissaoId: submissao.id })}
                    onExcluir={() => pedirExclusao(submissao)}
                    modeloOralDisponivel={Boolean(modeloOralMap[chamadaId])}
                    baixandoModeloOral={Boolean(baixandoOralMap[chamadaId])}
                    onBaixarModeloOral={() => handleBaixarModeloOral(chamadaId)}
                  />
                );
              })}
            </motion.div>
          )}
        </section>
      </main>

      <Footer />

      {modalEdital ? (
        <ModalVerEdital
          chamadaId={modalEdital}
          onClose={() => setModalEdital(null)}
        />
      ) : null}

      {modalInscricao ? (
        <ModalInscreverTrabalho
          chamadaId={modalInscricao.chamadaId || null}
          submissaoId={modalInscricao.submissaoId || null}
          onClose={() => setModalInscricao(null)}
          onSucesso={handleSucesso}
        />
      ) : null}
    </PageShell>
  );
}