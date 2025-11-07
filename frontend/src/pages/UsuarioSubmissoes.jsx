// 📁 src/pages/UsuarioSubmissoes.jsx
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import api, { apiGetFile, downloadBlob, apiHead } from "../services/api";
import ModalVerEdital from "../components/ModalVerEdital";
import ModalInscreverTrabalho from "../components/ModalInscreverTrabalho";
import Footer from "../components/Footer";

/* ───────────────── Helpers de data ───────────────── */
function toBrDateTimeSafe(input) {
  if (!input) return "—";
  const s = String(input).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
  const mDT = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/
  );
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
  return (
    oralLower === "aprovado" ||
    stLower === "aprovado_oral" ||
    Boolean(s?._oral_aprovada)
  );
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
  } else if (
    st === "aprovado_exposicao" ||
    st === "aprovado_oral" ||
    st === "aprovado_escrita" ||
    st === "aprovado"
  ) {
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

function AprovacoesSection({ subm }) {
  const st = String(subm?.status || "").toLowerCase();

  const isRascunho = st === "rascunho";
  const isSubmetido = st === "submetido";
  const isEmAvaliacao = st === "em_avaliacao";
  const isReprovado = st === "reprovado";

  const expoOk = okEscrita(subm);
  const oralOk = okOral(subm);

  const isAprovado =
    st === "aprovado_exposicao" ||
    st === "aprovado_escrita" ||
    st === "aprovado_oral" ||
    st === "aprovado" ||
    expoOk ||
    oralOk;

  const statusChip = <StatusChip status={st} />;

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
      {statusChip}
      {extraChips}
    </div>
  );
}

/* ───────────────── HeaderHero ───────────────── */
function HeaderHero() {
  const gradient = "from-violet-800 via-fuchsia-600 to-indigo-600";
  return (
    <header
      className={`bg-gradient-to-br ${gradient} text-white`}
      role="banner"
    >
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
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Submissão de Trabalhos
            </h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl mx-auto">
            Acompanhe suas submissões, edite rascunhos e inscreva novos
            trabalhos.
          </p>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── Primitivos de UI ───────────────── */
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
    default:
      "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
    verde:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    amarelo:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    vermelho:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    azul: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    roxo:
      "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        tones[tone] ?? tones.default
      }`}
      title={title}
    >
      {children}
    </span>
  );
}

/* ───────────────── Download do pôster ───────────────── */
function PosterCell({ id, nome }) {
  const [downloading, setDownloading] = useState(false);
  const safeNome = nome || "poster.pptx";

  const baixar = async () => {
    try {
      setDownloading(true);
      const { blob, filename } = await apiGetFile(`/submissoes/${id}/poster`);
      downloadBlob(filename || safeNome, blob);
    } catch (e) {
      alert(e?.message || "Falha ao baixar o pôster.");
    } finally {
      setDownloading(false);
    }
  };

  if (!nome)
    return (
      <span className="text-gray-400 dark:text-gray-600 italic text-sm">
        —
      </span>
    );

  return (
    <button
      onClick={baixar}
      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60 text-sm"
      title="Baixar pôster"
      disabled={downloading}
    >
      {downloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
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
  onBaixarModeloOral,        // 🔹 novo: callback para baixar o modelo oral
  hasModeloOral,             // 🔹 novo: existe modelo oral?
  baixandoModeloOral = false // 🔹 novo: loading do download oral
}) {
  const gradientBar = "from-violet-600 via-fuchsia-500 to-indigo-500";

  const dentroPrazo = !!(subm?.dentro_prazo || subm?.dentroPrazo);
  const oralAprovada = okOral(subm);

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm flex flex-col overflow-hidden">
      {/* Barrinha topo */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradientBar}`} />

      <div className="p-4 flex flex-col gap-4 flex-1">
        {/* Título + status */}
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

        {/* Aprovações (chips Exposição / Oral, se houver) */}
        <AprovacoesSection subm={subm} />

        {/* Seção de modelo de slides (oral) — só se aprovado para oral */}
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
                {baixandoModeloOral ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar modelo (oral)
              </button>
            ) : (
              <span className="text-gray-400 dark:text-gray-600 italic">
                Modelo indisponível para esta chamada.
              </span>
            )}
          </div>
        )}

        {/* Pôster */}
        <div className="text-sm">
          <p className="text-[11px] uppercase text-zinc-500 dark:text-zinc-400 font-medium mb-1">
            Pôster
          </p>
          <PosterCell id={subm.id} nome={subm.poster_nome || subm.posterNome} />
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-3 text-sm">
          {podeEditar ? (
            <button
              onClick={onEditar}
              className="inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-sm font-medium"
              title="Editar submissão"
              aria-label="Editar submissão"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
          ) : (
            dentroPrazo && (
              <span className="text-gray-500 dark:text-gray-400 text-xs leading-tight">
                Edição indisponível
              </span>
            )
          )}

          {podeExcluir && (
            <button
              onClick={onExcluir}
              disabled={excluindo}
              className="inline-flex items-center gap-1 bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-70 text-sm font-medium"
              title="Excluir submissão"
              aria-label="Excluir submissão"
            >
              {excluindo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Constantes internas ───────────────── */
const BLOQUEADOS = new Set([
  "em_avaliacao",
  "aprovado_exposicao",
  "aprovado_oral",
  "aprovado_escrita",
  "reprovado",
]);

/* ───────────────── Regras & Dicas (2 colunas / 2 cards) ───────────────── */

function NumberBullet({ n }) {
  return (
    <span
      className="
        inline-flex items-center justify-center
        w-7 h-7 rounded-full
        bg-fuchsia-600 text-white text-xs font-bold
        shadow-sm select-none shrink-0
      "
    >
      {n}
    </span>
  );
}


function RegrasEDicasCardCol({ itens = [], start = 1 }) {
  return (
    <div
  className="
    rounded-2xl
    bg-[#fde6ef]/90 dark:bg-zinc-900/80
    backdrop-blur
    border border-fuchsia-200/40 dark:border-white/10
    shadow-sm
    p-5
    transition-all duration-300
    hover:shadow-md hover:border-fuchsia-300
  "
>

      <ol
        className="
          space-y-5
          list-none
          pl-0
          [&>li]:list-none
          [&>li]:marker:hidden
          [&>li]:before:hidden
        "
        start={start}
      >
        {itens.map((it, i) => {
          const n = start + i;
          return (
            <li key={n} className="flex gap-3 list-none marker:hidden before:hidden">
              <NumberBullet n={n} />

              <div className="text-sm leading-6">
                <p className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
                  {it.titulo}
                </p>
                <div className="[text-align:justify] text-zinc-700 dark:text-zinc-300">
                  {it.conteudo}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}


/** Seção completa (split 50/50 em 2 cards). */
function RegrasEDicasSection() {
  const itens = [
    {
      titulo: "Conteúdo do anexo",
      conteudo: (
        <p>
          Prezados(as) autores(as), no <strong>anexo (Apresentação oral — modelo de slides)</strong> deve ser inserido o
          <strong> texto da apresentação da experiência</strong>, observando o modelo indicado no edital.
          Utilize um único arquivo, conforme formatos aceitos pela chamada.
        </p>
      ),
    },
    {
      titulo: "Critérios de avaliação da apresentação",
      conteudo: (
        <>
          <p>
            A banca avaliadora atribuirá pontuação <strong>de 1 a 5</strong> para cada critério abaixo.
            A <strong>nota da banca</strong> corresponderá à <strong>média aritmética</strong> das notas dos avaliadores.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Clareza e objetividade</strong> na apresentação (oral e visual).</li>
            <li><strong>Coesão</strong> da apresentação com o trabalho escrito submetido.</li>
            <li><strong>Aproveitamento e respeito ao tempo</strong> de apresentação, observando o número de slides e o tempo de fala.</li>
          </ul>
        </>
      ),
    },
    {
      titulo: "Tempo de apresentação",
      conteudo: (
        <p>
          O tempo destinado a cada apresentação é de <strong>10 (dez) minutos</strong>, com controle realizado pela equipe da organização.
          O <strong>descumprimento do tempo</strong> estabelecido configura <strong>critério para perdas de pontos</strong> na Mostra, conforme regulamento.
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
        <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Regras &amp; Dicas
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RegrasEDicasCardCol itens={col1} start={1} />
        <RegrasEDicasCardCol itens={col2} start={metade + 1} />
      </div>
    </section>
  );
}

/* ───────────────── Página principal ───────────────── */
export default function UsuarioSubmissoes() {
  const [chamadas, setChamadas] = useState([]);
  const [minhas, setMinhas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalEdital, setModalEdital] = useState(null);
  const [modalInscricao, setModalInscricao] = useState(null);

  const [modeloMap, setModeloMap] = useState({});
  const [baixandoMap, setBaixandoMap] = useState({});
  const [excluindoId, setExcluindoId] = useState(null);

  // 🔶 novos mapas para o modelo de slides (apresentação oral)
  const [modeloOralMap, setModeloOralMap] = useState({});
  const [baixandoOralMap, setBaixandoOralMap] = useState({});

  /* ───── baixar modelo de pôster (chamada) ───── */
  async function baixarModeloBanner(chId) {
    if (!chId) return;
    try {
      setBaixandoMap((m) => ({ ...m, [chId]: true }));
      const { blob, filename } = await apiGetFile(
        `/chamadas/${chId}/modelo-banner`
      );
      downloadBlob(filename || "modelo-banner.pptx", blob);
    } catch (e) {
      alert(e?.message || "Falha ao baixar o modelo de pôster.");
    } finally {
      setBaixandoMap((m) => ({ ...m, [chId]: false }));
    }
  }

  /* ───── baixar modelo de slides (oral) por chamada ───── */
async function baixarModeloOral(chId) {
  if (!chId) return;
  try {
    setBaixandoOralMap((m) => ({ ...m, [chId]: true }));
    try {
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-oral`);
      downloadBlob(filename || `modelo-oral-${chId}.pptx`, blob);
    } catch (errBase) {
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-oral/download`);
      downloadBlob(filename || `modelo-oral-${chId}.pptx`, blob);
    }
  } catch (e) {
    alert(e?.message || "Falha ao baixar o modelo de slides (oral).");
  } finally {
    setBaixandoOralMap((m) => ({ ...m, [chId]: false }));
  }
}


  /* ───── carregar dados iniciais ───── */
  useEffect(() => {
    async function loadData() {
      try {
        const [c, s] = await Promise.all([
          api.get("/chamadas/ativas"),
          api.get("/submissoes/minhas"),
        ]);

        const chamadasArr = Array.isArray(c) ? c : c.data || [];
        setChamadas(chamadasArr);

        const minhasArr = Array.isArray(s) ? s : s.data || [];
        setMinhas(minhasArr);

        // checar se cada chamada tem modelo de banner disponível
        const checksBanner = await Promise.all(
          chamadasArr.map(async (ch) => {
            try {
              const ok = await apiHead(`/chamadas/${ch.id}/modelo-banner`, {
                auth: true,
                on401: "silent",
                on403: "silent",
              });
              return [ch.id, !!ok];
            } catch {
              return [ch.id, false];
            }
          })
        );
        setModeloMap(Object.fromEntries(checksBanner));

        // 🔶 checar se cada chamada tem modelo ORAL disponível
        const checksOral = await Promise.all(
          chamadasArr.map(async (ch) => {
            try {
              const ok = await apiHead(`/chamadas/${ch.id}/modelo-oral`, {
                auth: true,
                on401: "silent",
                on403: "silent",
              });
              return [ch.id, !!ok];
            } catch {
              return [ch.id, false];
            }
          })
        );
        setModeloOralMap(Object.fromEntries(checksOral));
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  /* ───── recarregar submissões após salvar/editar ───── */
  const handleSucesso = async () => {
    const s = await api.get("/submissoes/minhas");
    setMinhas(Array.isArray(s) ? s : s.data || []);
  };

  /* ───── helpers de prazo/edição ───── */
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
    const c = {
      submetido: 0,
      em_avaliacao: 0,
      aprovado: 0,
      reprovado: 0,
    };
    for (const m of minhas) {
      const st = String(m.status || "").toLowerCase();
      const expo = okEscrita(m);
      const oral = okOral(m);

      if (st === "submetido") {
        c.submetido++;
      } else if (st === "em_avaliacao") {
        c.em_avaliacao++;
      } else if (
        st === "aprovado_exposicao" ||
        st === "aprovado_oral" ||
        st === "aprovado_escrita" ||
        st === "aprovado" ||
        expo ||
        oral
      ) {
        c.aprovado++;
      } else if (st === "reprovado") {
        c.reprovado++;
      }
    }
    return c;
  }, [minhas]);

  /* ───── excluir submissão ───── */
  const handleExcluir = async (id) => {
    if (!id) return;
    const ok = window.confirm(
      "Tem certeza que deseja excluir esta submissão? Essa ação não pode ser desfeita."
    );
    if (!ok) return;
    try {
      setExcluindoId(id);
      await api.delete?.(`/submissoes/${id}`);
      if (!api.delete)
        await api({ method: "DELETE", url: `/submissoes/${id}` });
      await handleSucesso();
      alert("Submissão excluída com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Não foi possível excluir a submissão.");
    } finally {
      setExcluindoId(null);
    }
  };

  /* ───── loading inicial ───── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-indigo-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
        <Loader2 className="w-8 h-8 text-violet-600 dark:text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero />

      <main id="conteudo" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
          {/* ────── Mini Stats ────── */}
          <section aria-labelledby="metricas">
            <h2 id="metricas" className="sr-only">
              Métricas de Submissões
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                  Submetido
                </p>
                <p className="text-2xl font-semibold leading-tight text-center text-zinc-900 dark:text-zinc-50">
                  {countByStatus.submetido}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="azul">Submetido</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                  Em avaliação
                </p>
                <p className="text-2xl font-semibold leading-tight text-center text-zinc-900 dark:text-zinc-50">
                  {countByStatus.em_avaliacao}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="amarelo">Em avaliação</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                  Aprovado
                </p>
                <p className="text-2xl font-semibold leading-tight text-center text-emerald-600 dark:text-emerald-400">
                  {countByStatus.aprovado}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="verde">Aprovado</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                  Reprovado
                </p>
                <p className="text-2xl font-semibold leading-tight text-center text-rose-600 dark:text-rose-400">
                  {countByStatus.reprovado}
                </p>
                <div className="mt-2 flex justify-center">
                  <Chip tone="vermelho">Reprovado</Chip>
                </div>
              </Card>
            </div>
          </section>

          {/* ────── Regras & Dicas ────── */}
<section aria-labelledby="regras-dicas">
  <h2 id="regras-dicas" className="sr-only">Regras e Dicas</h2>
  <RegrasEDicasSection />
</section>

          {/* ────── Chamadas Abertas ────── */}
          <section aria-labelledby="chamadas-abertas">
            <div className="flex items-center justify-center gap-2 mb-2">
              <BookOpen
                className="w-5 h-5 text-violet-600 dark:text-violet-400"
                aria-hidden="true"
              />
              <h2
                id="chamadas-abertas"
                className="text-base sm:text-lg font-bold text-center text-zinc-900 dark:text-zinc-50"
              >
                Chamadas abertas
              </h2>
            </div>

            {chamadas.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300 italic text-center">
                Nenhuma chamada disponível no momento.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {chamadas.map((ch) => {
                  const temModelo = !!modeloMap[ch.id];
                  const prazoStr =
                    ch.prazo_final_br ||
                    ch.prazo_final ||
                    ch.prazoFinal ||
                    ch.prazo ||
                    null;
                  const prazoFmt = toBrDateTimeSafe(prazoStr);
                  const carregando = !!baixandoMap[ch.id];
                  const dentro = !!(ch?.dentro_prazo ?? ch?.dentroPrazo);

                  return (
                    <motion.div
                      key={ch.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="group"
                    >
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
                                Prazo final (data e horário):{" "}
                                <strong>{prazoFmt}</strong>
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3 items-center justify-center sm:justify-start">
                            <button
                              onClick={() => setModalEdital(ch.id)}
                              className="flex items-center gap-2 text-sm bg-violet-700 text-white px-3 py-2 rounded-md hover:bg-violet-800 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                              aria-label="Ver edital"
                            >
                              <FileText className="w-4 h-4" />
                              Ver edital
                            </button>

                            {dentro && (
                              <button
                                onClick={() =>
                                  setModalInscricao({
                                    chamadaId: ch.id,
                                  })
                                }
                                className="flex items-center gap-2 text-sm bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                aria-label="Submeter trabalho"
                              >
                                <PlusCircle className="w-4 h-4" />
                                Submeter trabalho
                              </button>
                            )}

                            {temModelo && (
                              <button
                                type="button"
                                onClick={() => baixarModeloBanner(ch.id)}
                                className="sm:ml-auto inline-flex items-center gap-1 text-sm text-indigo-700 dark:text-indigo-400 hover:underline disabled:opacity-60"
                                disabled={carregando}
                                title="Baixar modelo de pôster"
                              >
                                {carregando ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                )}
                                Modelo de pôster
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ────── Minhas Submissões ────── */}
          <section aria-labelledby="minhas-submissoes">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FileText
                className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
              <h2
                id="minhas-submissoes"
                className="text-base sm:text-lg font-bold text-center text-zinc-900 dark:text-zinc-50"
              >
                Minhas submissões
              </h2>
            </div>

            {minhas.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-300 italic text-center">
                Você ainda não submeteu nenhum trabalho.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {minhas.map((m) => {
                  const stLower = String(m.status ?? "").toLowerCase();
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
                      onExcluir={() => handleExcluir(m.id)}
                      // 🔶 props para o botão de modelo oral
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
      {modalEdital && (
        <ModalVerEdital
          chamadaId={modalEdital}
          onClose={() => setModalEdital(null)}
        />
      )}

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
