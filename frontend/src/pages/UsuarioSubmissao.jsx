// ✅ src/pages/UsuarioSubmissao.jsx — premium/robusto (rotas públicas p/ modelos + ModalConfirmacao)
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  FileText,
  PlusCircle,
  BookOpen,
  Loader2,
  Pencil,
  Download,
  ExternalLink,
  Trash2,
  Award, // Exposição
  CheckCircle, // Apresentação oral
  Search,
  RefreshCcw,
} from "lucide-react";

import api, { apiGetFile, downloadBlob, apiHead } from "../services/api";
import ModalVerEdital from "../components/ModalVerEdital";
import ModalInscreverTrabalho from "../components/ModalInscreverTrabalho";
import ModalConfirmacao from "../components/ModalConfirmacao";
import Footer from "../components/Footer";

/* ───────────────── Helpers de data ───────────────── */
function toBrDateTimeSafe(input) {
  if (!input) return "—";
  const s = String(input).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s; // já BR

  const mDT = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (mDT) {
    const [, yy, mm, dd, hh, mi] = mDT;
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }
  const mD = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mD) {
    const [, yy, mm, dd] = mD;
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

/* ───────────────── Helpers de status/aprovação ───────────────── */
const okEscrita = (s) => {
  const escritaLower = String(s?.status_escrita || "").toLowerCase();
  const stLower = String(s?.status || "").toLowerCase();
  return (
    escritaLower === "aprovado" ||
    stLower === "aprovado_exposicao" ||
    stLower === "aprovado_escrita" ||
    Boolean(s?._exposicao_aprovada)
  );
};

const okOral = (s) => {
  const oralLower = String(s?.status_oral || "").toLowerCase();
  const stLower = String(s?.status || "").toLowerCase();
  return oralLower === "aprovado" || stLower === "aprovado_oral" || Boolean(s?._oral_aprovada);
};

const isFinalizado = (s) =>
  Boolean(
    s?._finalizado ||
      s?.finalizado ||
      s?.avaliacao_finalizada ||
      s?.avaliacaoFinalizada ||
      s?.fechado ||
      s?.encerrado
  );

/* ───────────────── Primitivos ───────────────── */
function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={
        "rounded-2xl bg-white/90 dark:bg-zinc-900/80 backdrop-blur border border-black/5 dark:border-white/10 shadow-sm " +
        className
      }
      {...rest}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = "default", title }) {
  const tones = {
    default: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
    verde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    amarelo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    vermelho: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    azul: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    roxo: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone] ?? tones.default}`}
      title={title}
    >
      {children}
    </span>
  );
}

/* ───────────────── Status/Aprovações ───────────────── */
function StatusChip({ status }) {
  const st = String(status ?? "").toLowerCase();
  let tone = "default";
  let label = st || "—";

  if (st === "rascunho") {
    tone = "default";
    label = "rascunho";
  } else if (st === "submetido") {
    tone = "azul";
    label = "submetido";
  } else if (st === "em_avaliacao") {
    tone = "amarelo";
    label = "em avaliação";
  } else if (st === "aprovado_exposicao" || st === "aprovado_oral" || st === "aprovado_escrita" || st === "aprovado") {
    tone = "verde";
    label = "aprovado";
  } else if (st === "reprovado") {
    tone = "vermelho";
    label = "reprovado";
  }

  return (
    <Chip tone={tone} title={label}>
      {label}
    </Chip>
  );
}

function AprovacaoSection({ subm }) {
  const st = String(subm?.status || "").toLowerCase();
  const expoOk = okEscrita(subm);
  const oralOk = okOral(subm);

  const isAprovado =
    st === "aprovado_exposicao" ||
    st === "aprovado_escrita" ||
    st === "aprovado_oral" ||
    st === "aprovado" ||
    expoOk ||
    oralOk;

  const extraChips = [];
  if (isAprovado && expoOk) {
    extraChips.push(
      <Chip key="expo" tone="verde" title="Exposição aprovada">
        <Award className="w-3.5 h-3.5 mr-1" />
        Exposição
      </Chip>
    );
  }
  if (isAprovado && oralOk) {
    extraChips.push(
      <Chip key="oral" tone="verde" title="Apresentação oral aprovada">
        <CheckCircle className="w-3.5 h-3.5 mr-1" />
        Apresentação oral
      </Chip>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <StatusChip status={st} />
      {extraChips}
    </div>
  );
}

/* ───────────────── HeaderHero ───────────────── */
function HeaderHero({ onRefresh, refreshing }) {
  const gradient = "from-violet-800 via-fuchsia-600 to-indigo-600";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-[136px] flex items-center justify-center">
        <div className="w-full text-center">
          <div className="inline-flex items-center gap-3">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Submissão de Trabalhos</h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl mx-auto">
            Acompanhe suas submissões, edite rascunhos e inscreva novos trabalhos.
          </p>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold bg-white/15 hover:bg-white/25 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                refreshing ? "opacity-70 cursor-not-allowed" : ""
              }`}
              aria-label="Atualizar dados"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {refreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── Download do pôster ───────────────── */
function PosterCell({ id, nome }) {
  const [downloading, setDownloading] = useState(false);
  const safeNome = nome || "poster.pptx";

  const baixar = async () => {
    try {
      setDownloading(true);
      const { blob, filename } = await apiGetFile(`/submissao/${id}/poster`);
      downloadBlob(filename || safeNome, blob);
      toast.success("Download iniciado.");
    } catch (e) {
      toast.error(e?.message || "Falha ao baixar o pôster.");
    } finally {
      setDownloading(false);
    }
  };

  if (!nome) {
    return <span className="text-gray-400 dark:text-gray-600 italic text-sm">—</span>;
  }

  return (
    <button
      type="button"
      onClick={baixar}
      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60 text-sm"
      title="Baixar pôster"
      disabled={downloading}
    >
      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {nome}
    </button>
  );
}

/* ───────────────── Card individual de submissão ───────────────── */
function SubmissionCard({
  subm,
  podeEditar,
  podeExcluir,
  onEditar,
  onExcluir,
  excluindo,
  onBaixarModeloOral,
  hasModeloOral,
  baixandoModeloOral = false,
}) {
  const gradientBar = "from-violet-600 via-fuchsia-500 to-indigo-500";
  const oralAprovada = okOral(subm);

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden">
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradientBar}`} />

      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 break-words leading-snug">
                {subm.titulo || "—"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words leading-snug">
                {subm.chamada_titulo || "—"}
              </p>
            </div>
          </div>
        </div>

        <AprovacaoSection subm={subm} />

        {oralAprovada && (
          <div className="text-sm">
            <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium mb-1">
              Apresentação oral — modelo de slides
            </p>

            {hasModeloOral ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60"
                onClick={onBaixarModeloOral}
                disabled={baixandoModeloOral}
                title="Baixar modelo de slides (oral)"
              >
                {baixandoModeloOral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Baixar modelo (oral)
              </button>
            ) : (
              <span className="text-gray-400 dark:text-gray-600 italic">Modelo indisponível para esta chamada.</span>
            )}
          </div>
        )}

        <div className="text-sm">
          <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium mb-1">Pôster</p>
          <PosterCell id={subm.id} nome={subm.poster_nome || subm.posterNome} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          {podeEditar ? (
            <button
              type="button"
              onClick={onEditar}
              className="inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-sm font-medium"
              title="Editar submissão"
              aria-label="Editar submissão"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-xs leading-tight">Edição indisponível</span>
          )}

          {podeExcluir && (
            <button
              type="button"
              onClick={onExcluir}
              disabled={excluindo}
              className="inline-flex items-center gap-1 bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-70 text-sm font-medium"
              title="Excluir submissão"
              aria-label="Excluir submissão"
            >
              {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Regras & Dicas ───────────────── */
function NumberBullet({ n }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-fuchsia-600 text-white text-xs font-bold shadow-sm select-none shrink-0">
      {n}
    </span>
  );
}

function RegrasEDicasCardCol({ itens = [], start = 1 }) {
  return (
    <div className="rounded-2xl bg-[#fde6ef]/90 dark:bg-zinc-900/80 backdrop-blur border border-fuchsia-200/40 dark:border-white/10 shadow-sm p-5 transition-all duration-300 hover:shadow-md hover:border-fuchsia-300">
      <ol className="space-y-5 list-none pl-0 [&>li]:list-none [&>li]:marker:hidden [&>li]:before:hidden" start={start}>
        {itens.map((it, i) => {
          const n = start + i;
          return (
            <li key={n} className="flex gap-3 list-none marker:hidden before:hidden">
              <NumberBullet n={n} />
              <div className="text-sm leading-6">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">{it.titulo}</p>
                <div className="[text-align:justify] text-zinc-700 dark:text-zinc-300">{it.conteudo}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RegrasEDicasSection() {
  const itens = [
    {
      titulo: "Conteúdo do anexo",
      conteudo: (
        <p>
          Prezados(as) autores(as), no <strong>anexo (Apresentação oral — modelo de slides)</strong> deve ser inserido o{" "}
          <strong>texto da apresentação da experiência</strong>, observando o modelo indicado no edital.
        </p>
      ),
    },
    {
      titulo: "Critérios de avaliação da apresentação",
      conteudo: (
        <>
          <p>
            A banca avaliadora atribuirá pontuação <strong>de 1 a 5</strong> para cada critério abaixo. A{" "}
            <strong>nota da banca</strong> corresponderá à <strong>média aritmética</strong> das notas dos avaliadores.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Clareza e objetividade</strong> na apresentação (oral e visual).
            </li>
            <li>
              <strong>caoão</strong> da apresentação com o trabalho escrito submetido.
            </li>
            <li>
              <strong>Aproveitamento e respeito ao tempo</strong> de apresentação.
            </li>
          </ul>
        </>
      ),
    },
    {
      titulo: "Tempo de apresentação",
      conteudo: (
        <p>
          O tempo destinado a cada apresentação é de <strong>10 (dez) minutos</strong>. O{" "}
          <strong>descumprimento do tempo</strong> configura critério para perdas de pontos.
        </p>
      ),
    },
  ];

  const metade = Math.ceil(itens.length / 2);
  const col1 = itens.slice(0, metade);
  const col2 = itens.slice(metade);

  return (
    <section className="w-full max-w-6xl mx-auto mb-10 px-4">
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-5 h-5 text-violet-600 dark:text-violet-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50">Regras &amp; Dicas</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RegrasEDicasCardCol itens={col1} start={1} />
        <RegrasEDicasCardCol itens={col2} start={metade + 1} />
      </div>
    </section>
  );
}

/* ───────────────── Constantes internas ───────────────── */
const BLOQUEADOS = new Set(["em_avaliacao", "aprovado_exposicao", "aprovado_oral", "aprovado_escrita", "reprovado"]);

/* ───────────────── Página principal ───────────────── */
export default function UsuarioSubmissao() {
  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [chamadas, setChamadas] = useState([]);
  const [minhas, setMinhas] = useState([]);

  const [modalEdital, setModalEdital] = useState(null);
  const [modalInscricao, setModalInscricao] = useState(null);

  // modelos por chamada
  const [modeloMap, setModeloMap] = useState({}); // banner
  const [baixandoMap, setBaixandoMap] = useState({});
  const [modeloOralMap, setModeloOralMap] = useState({}); // oral
  const [baixandoOralMap, setBaixandoOralMap] = useState({});

  const [excluindoId, setExcluindoId] = useState(null);

  // confirmação com modal
  const [confirmacao, setConfirmacao] = useState(null); // { id, titulo }

  // filtro local (minhas)
  const [q, setQ] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((fn) => {
    if (mountedRef.current) fn();
  }, []);

  const unwrap = (resp) => (Array.isArray(resp) ? resp : resp?.data || []);

  /* ───── helpers de HEAD (200/204) ───── */
  function headExists(resp) {
    if (resp === true || resp === 200 || resp === 204) return true;
    const st = resp?.status ?? resp?.data?.status;
    return st === 200 || st === 204;
  }

  /* ───── baixar modelo banner ───── */
  async function baixarModeloBanner(chId) {
    if (!chId) return;
    try {
      setBaixandoMap((m) => ({ ...m, [chId]: true }));
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-banner`);
      downloadBlob(filename || "modelo-banner.pptx", blob);
      toast.success("Modelo de pôster baixado.");
    } catch (e) {
      toast.error(e?.message || "Falha ao baixar o modelo de pôster.");
    } finally {
      setBaixandoMap((m) => ({ ...m, [chId]: false }));
    }
  }

  /* ───── baixar modelo oral (público) ───── */
  async function baixarModeloOral(chId) {
    if (!chId) return;
    try {
      setBaixandoOralMap((m) => ({ ...m, [chId]: true }));
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-oral`);
      downloadBlob(filename || `modelo-oral-${chId}.pptx`, blob);
      toast.success("Modelo oral baixado.");
    } catch (e) {
      toast.error(e?.message || "Falha ao baixar o modelo de slides (oral).");
    } finally {
      setBaixandoOralMap((m) => ({ ...m, [chId]: false }));
    }
  }

  /* ───── HEAD checks (banner/oral) — público ───── */
  const checkModeloBanner = useCallback(async (chId) => {
    try {
      const resp = await apiHead(`/chamadas/${chId}/modelo-banner`, {
        auth: false,
        on401: "silent",
        on403: "silent",
      });
      return headExists(resp);
    } catch {
      return false;
    }
  }, []);

  const checkModeloOral = useCallback(async (chId) => {
    try {
      const resp = await apiHead(`/chamadas/${chId}/modelo-oral`, {
        auth: false,
        on401: "silent",
        on403: "silent",
      });
      return headExists(resp);
    } catch {
      return false;
    }
  }, []);

  /* ───── carregar tudo ───── */
  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const [c, s] = await Promise.all([api.get("/chamadas/ativas"), api.get("/submissao/minhas")]);

        const chamadasArr = unwrap(c);
        const minhasArr = unwrap(s);

        safeSet(() => {
          setChamadas(chamadasArr);
          const sorted = [...minhasArr].sort((a, b) => {
            const da = new Date(a.atualizado_em || a.updated_at || a.criado_em || a.created_at || 0).getTime();
            const db = new Date(b.atualizado_em || b.updated_at || b.criado_em || b.created_at || 0).getTime();
            return (db || 0) - (da || 0);
          });
          setMinhas(sorted);
        });

        // checks (banner/oral) em paralelo
        const ids = chamadasArr.map((ch) => ch.id).filter(Boolean);
        const bannerSettled = await Promise.allSettled(ids.map((id) => checkModeloBanner(id)));
        const oralSettled = await Promise.allSettled(ids.map((id) => checkModeloOral(id)));

        const bannerMap = {};
        const oralMap = {};
        ids.forEach((id, i) => {
          bannerMap[id] = bannerSettled[i].status === "fulfilled" ? !!bannerSettled[i].value : false;
          oralMap[id] = oralSettled[i].status === "fulfilled" ? !!oralSettled[i].value : false;
        });

        safeSet(() => {
          setModeloMap(bannerMap);
          setModeloOralMap(oralMap);
        });
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        toast.error("Não foi possível carregar as submissões agora.");
      } finally {
        if (!silent) safeSet(() => setLoading(false));
      }
    },
    [safeSet, checkModeloBanner, checkModeloOral]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData({ silent: true });
    setRefreshing(false);
  }, [loadData]);

  /* ───── recarregar submissões após salvar/editar ───── */
  const handleSucesso = useCallback(async () => {
    try {
      const s = await api.get("/submissao/minhas");
      const minhasArr = unwrap(s);
      safeSet(() => setMinhas(minhasArr));
    } catch {
      toast.error("Não foi possível atualizar suas submissões.");
    }
  }, [safeSet]);

  /* ───── regras edição/exclusão ───── */
  const isDentroPrazo = (row) => !!(row?.dentro_prazo ?? row?.dentroPrazo);

  const canEdit = (row) => {
    const st = String(row?.status || "").toLowerCase();
    return isDentroPrazo(row) && !BLOQUEADOS.has(st);
  };

  const canDelete = (row) => {
    const st = String(row?.status || "").toLowerCase();
    return st === "rascunho" || st === "submetido";
  };

  /* ───── contadores por status ───── */
  const countByStatus = useMemo(() => {
    const c = { submetido: 0, em_avaliacao: 0, aprovado: 0, reprovado: 0 };
    for (const m of minhas) {
      const st = String(m.status || "").toLowerCase();
      const expo = okEscrita(m);
      const oral = okOral(m);

      if (st === "submetido") c.submetido++;
      else if (st === "em_avaliacao") c.em_avaliacao++;
      else if (st === "aprovado_exposicao" || st === "aprovado_oral" || st === "aprovado_escrita" || st === "aprovado" || expo || oral)
        c.aprovado++;
      else if (st === "reprovado") c.reprovado++;
    }
    return c;
  }, [minhas]);

  /* ───── fluxo de exclusão (ModalConfirmacao) ───── */
  const pedirExclusao = (row) => {
    setConfirmacao({ id: row?.id, titulo: row?.titulo || "submissão" });
  };

  const confirmarExclusao = async () => {
    if (!confirmacao?.id) return;
    try {
      setExcluindoId(confirmacao.id);
      if (typeof api.delete === "function") await api.delete(`/submissao/${confirmacao.id}`);
      else await api({ method: "DELETE", url: `/submissao/${confirmacao.id}` });
      await handleSucesso();
      toast.success("Submissão excluída com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível excluir a submissão.");
    } finally {
      setExcluindoId(null);
      setConfirmacao(null);
    }
  };

  /* ───── filtros ───── */
  const minhasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return minhas;

    return minhas.filter((m) => {
      const hay = [m.titulo, m.chamada_titulo, m.status, m.linha_tematica_nome, m.linha_tematica_codigo]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();

      return hay.includes(term);
    });
  }, [minhas, q]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-indigo-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-600 dark:text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      {/* Modal de confirmação */}
      <ModalConfirmacao
        open={!!confirmacao}
        onClose={() => setConfirmacao(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir submissão"
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Tem certeza que deseja <strong>excluir</strong> a submissão
          {confirmacao?.titulo ? <> <em className="font-semibold">“{confirmacao.titulo}”</em></> : null}? Essa ação não pode ser desfeita.
        </p>
      </ModalConfirmacao>

      <HeaderHero onRefresh={refresh} refreshing={refreshing} />

      <main id="conteudo" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
          {/* ───── Mini Stats ───── */}
          <section aria-labelledby="metricas">
            <h2 id="metricas" className="sr-only">
              Métricas de Submissões
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">Submetido</p>
                <p className="text-2xl font-semibold leading-tight text-center text-zinc-900 dark:text-zinc-50">
                  {countByStatus.submetido}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="azul">Submetido</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">Em avaliação</p>
                <p className="text-2xl font-semibold leading-tight text-center text-zinc-900 dark:text-zinc-50">
                  {countByStatus.em_avaliacao}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="amarelo">Em avaliação</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">Aprovado</p>
                <p className="text-2xl font-semibold leading-tight text-center text-emerald-600 dark:text-emerald-400">
                  {countByStatus.aprovado}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="verde">Aprovado</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">Reprovado</p>
                <p className="text-2xl font-semibold leading-tight text-center text-rose-600 dark:text-rose-400">
                  {countByStatus.reprovado}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="vermelho">Reprovado</Chip>
                </div>
              </Card>
            </div>
          </section>

          {/* ───── Regras & Dicas ───── */}
          <section aria-labelledby="regras-dicas">
            <h2 id="regras-dicas" className="sr-only">
              Regras e Dicas
            </h2>
            <RegrasEDicasSection />
          </section>

          {/* ───── Chamadas abertas ───── */}
          <section aria-labelledby="chamadas-abertas">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BookOpen className="w-5 h-5 text-violet-600 dark:text-violet-400" aria-hidden="true" />
              <h2 id="chamadas-abertas" className="text-base sm:text-lg font-bold text-center text-zinc-900 dark:text-zinc-50">
                Chamadas abertas
              </h2>
            </div>

            {chamadas.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300 italic text-center">Nenhuma chamada disponível no momento.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {chamadas.map((ch) => {
                  const temModelo = !!modeloMap[ch.id];
                  const temOral = !!modeloOralMap[ch.id];
                  const prazoStr = ch.prazo_final_br || ch.prazo_final || ch.prazoFinal || ch.prazo || null;
                  const prazoFmt = toBrDateTimeSafe(prazoStr);
                  const carregando = !!baixandoMap[ch.id];
                  const carregandoOral = !!baixandoOralMap[ch.id];
                  const dentro = !!(ch?.dentro_prazo ?? ch?.dentroPrazo);

                  return (
                    <motion.div key={ch.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="group">
                      <Card className="p-5 h-full transition-shadow group-hover:shadow-md">
                        <div className="flex flex-col justify-between h-full">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center break-words">
                              {ch.titulo}
                            </h3>

                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-3 text-center sm:text-left whitespace-pre-line">
                              {ch.descricao_markdown?.slice(0, 200) ?? "—"}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                              {dentro ? (
                                <Chip tone="verde" title="Dentro do prazo">
                                  Dentro do prazo
                                </Chip>
                              ) : (
                                <Chip tone="vermelho" title="Fora do prazo">
                                  Fora do prazo
                                </Chip>
                              )}
                              <span className="text-slate-600 dark:text-slate-300">
                                Prazo final (data e horário): <strong>{prazoFmt}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 items-center justify-center sm:justify-start">
                            <button
                              type="button"
                              onClick={() => setModalEdital(ch.id)}
                              className="flex items-center gap-2 text-sm bg-violet-700 text-white px-3 py-2 rounded-md hover:bg-violet-800 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                              aria-label="Ver edital"
                            >
                              <FileText className="w-4 h-4" />
                              Ver edital
                            </button>

                            {dentro && (
                              <button
                                type="button"
                                onClick={() => setModalInscricao({ chamadaId: ch.id })}
                                className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                aria-label="Submeter trabalho"
                              >
                                <PlusCircle className="w-4 h-4" />
                                Submeter trabalho
                              </button>
                            )}

                            {/* modelos (banner/oral) — opcionais */}
                            <div className="sm:ml-auto flex flex-wrap items-center gap-3">
                              {temModelo && (
                                <button
                                  type="button"
                                  onClick={() => baixarModeloBanner(ch.id)}
                                  className="inline-flex items-center gap-1 text-sm text-indigo-700 dark:text-indigo-400 hover:underline disabled:opacity-60"
                                  disabled={carregando}
                                  title="Baixar modelo de pôster"
                                >
                                  {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                  Modelo de pôster
                                </button>
                              )}

                              {temOral && (
                                <button
                                  type="button"
                                  onClick={() => baixarModeloOral(ch.id)}
                                  className="inline-flex items-center gap-1 text-sm text-indigo-700 dark:text-indigo-400 hover:underline disabled:opacity-60"
                                  disabled={carregandoOral}
                                  title="Baixar modelo de apresentação oral"
                                >
                                  {carregandoOral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                  Modelo oral
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ───── Minhas submissões ───── */}
          <section aria-labelledby="minhas-submissao">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <h2 id="minhas-submissao" className="text-base sm:text-lg font-bold text-center text-zinc-900 dark:text-zinc-50">
                Minhas submissões
              </h2>
            </div>

            {/* Busca local */}
            <div className="max-w-2xl mx-auto mb-4">
              <label htmlFor="busca-minhas" className="sr-only">
                Buscar nas minhas submissões
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  id="busca-minhas"
                  type="search"
                  inputMode="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por título, chamada ou status…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {minhas.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300 italic text-center">Você ainda não submeteu nenhum trabalho.</p>
            ) : minhasFiltradas.length === 0 ? (
              <Card className="p-6 text-center text-sm text-slate-600 dark:text-slate-300">
                Nenhuma submissão encontrada para o termo informado.
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {minhasFiltradas.map((m) => {
                  const podeEditar = canEdit(m);
                  const podeExcluir = canDelete(m);

                  const chId = m.chamada_id ?? m.chamadaId ?? m.chamada?.id;
                  const hasModeloOral = !!modeloOralMap[chId];
                  const baixandoOral = !!baixandoOralMap[chId];

                  return (
                    <SubmissionCard
                      key={m.id}
                      subm={m}
                      podeEditar={podeEditar}
                      podeExcluir={podeExcluir}
                      excluindo={excluindoId === m.id}
                      onEditar={() => setModalInscricao({ submissaoId: m.id })}
                      onExcluir={() => pedirExclusao(m)}
                      hasModeloOral={hasModeloOral}
                      baixandoModeloOral={baixandoOral}
                      onBaixarModeloOral={() => baixarModeloOral(chId)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />

      {/* Modais */}
      {modalEdital && <ModalVerEdital chamadaId={modalEdital} onClose={() => setModalEdital(null)} />}

      {modalInscricao && (
        <ModalInscreverTrabalho
          chamadaId={modalInscricao.chamadaId || null}
          submissaoId={modalInscricao.submissaoId || null}
          onClose={() => setModalInscricao(null)}
          onSucesso={handleSucesso}
        />
      )}
    </div>
  );
}
