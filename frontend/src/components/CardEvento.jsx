/* eslint-disable no-console */
// 📁 src/components/CardEvento.jsx — PREMIUM (tech + discreto + sem "verde chapado")
import PropTypes from "prop-types";
import { useEffect, useMemo, useCallback, useState } from "react";
import {
  CalendarDays,
  Users,
  Star,
  BarChart,
  Image as ImageIcon,
  Tag,
  Target,
  CheckCircle2,
  CircleDashed,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
} from "lucide-react";
import CardTurma from "./CardTurma";
import { resolveAssetUrl } from "../utils/assets";

/* =========================
   Helpers de Data (fuso local)
========================= */
function isYmdPrefix(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}/.test(str);
}

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  // ✅ Regra PREMIUM: se tem prefixo YYYY-MM-DD (mesmo com hora/Z), usa só o YMD
  if (typeof input === "string" && isYmdPrefix(input)) {
    const ymd = input.slice(0, 10);
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  return new Date(input);
}

function formatarDataLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime?.())) return "";
  return dt.toLocaleDateString("pt-BR");
}

/* =========================
   Lógica de notas
========================= */
const CAMPOS_NOTA_EVENTO = [
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

function notaEnumParaNumero(valor) {
  const n = String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  switch (n) {
    case "otimo":
      return 5;
    case "bom":
      return 4;
    case "regular":
      return 3;
    case "ruim":
      return 2;
    case "pessimo":
      return 1;
    default:
      return null;
  }
}

function calcularMediaEventoViaLista(avaliacao) {
  if (!Array.isArray(avaliacao) || avaliacao.length === 0) return "—";
  const medias = avaliacao
    .map((av) => {
      let soma = 0,
        qtd = 0;
      for (const campo of CAMPOS_NOTA_EVENTO) {
        const v = notaEnumParaNumero(av?.[campo]);
        if (v != null) {
          soma += v;
          qtd += 1;
        }
      }
      return qtd ? soma / qtd : null;
    })
    .filter((v) => v != null);

  if (!medias.length) return "—";
  const m = medias.reduce((a, v) => a + v, 0) / medias.length;
  return m.toFixed(1);
}

/* =========================
   Datas do evento (sem UTC shift)
========================= */
function getPeriodoEvento(evento, turmas) {
  const diAgg = evento?.data_inicio_geral;
  const dfAgg = evento?.data_fim_geral;

  const formatarPeriodo = (ini, fim) => {
    if (!ini || !fim) return "Período não informado";
    const a = toLocalDate(ini);
    const b = toLocalDate(fim);
    if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) return "Período não informado";

    const sameDay =
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    return sameDay ? formatarDataLocal(a) : `${formatarDataLocal(a)} até ${formatarDataLocal(b)}`;
  };

  if (diAgg && dfAgg) return formatarPeriodo(diAgg, dfAgg);

  if (Array.isArray(turmas) && turmas.length > 0) {
    const inicioMin = turmas.reduce((min, t) => {
      const dt = toLocalDate(t?.data_inicio);
      return !min || (dt && dt < min) ? dt : min;
    }, null);

    const fimMax = turmas.reduce((max, t) => {
      const dt = toLocalDate(t?.data_fim);
      return !max || (dt && dt > max) ? dt : max;
    }, null);

    return formatarPeriodo(inicioMin, fimMax);
  }

  return "Período não informado";
}

/* =========================
   UI: Chip discreto (tipo/público)
========================= */
function Chip({ icon, children }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1 rounded-full border",
        "text-[12px] font-extrabold",
        "bg-white/70 dark:bg-zinc-900/30",
        "border-slate-200/80 dark:border-zinc-700/70",
        "text-slate-800 dark:text-zinc-200",
        "backdrop-blur",
      ].join(" ")}
    >
      <span className="opacity-80" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}
Chip.propTypes = { icon: PropTypes.node, children: PropTypes.node };

/* =========================
   UI: Badge inscrição (discreto e fácil)
========================= */
function InscricaoBadge({ jaInscrito }) {
  const ok = Boolean(jaInscrito);
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5",
        "px-2.5 py-1 rounded-full border",
        "text-[12px] font-extrabold",
        ok
          ? "bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-200/70 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-200"
          : "bg-slate-50/80 dark:bg-zinc-900/20 border-slate-200/70 dark:border-zinc-700/70 text-slate-700 dark:text-zinc-200",
      ].join(" ")}
      title={ok ? "Você já está inscrito em alguma turma deste evento." : "Você ainda não está inscrito neste evento."}
    >
      {ok ? (
        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
      ) : (
        <CircleDashed className="w-4 h-4" aria-hidden="true" />
      )}
      {ok ? "Inscrito" : "Não inscrito"}
    </span>
  );
}
InscricaoBadge.propTypes = { jaInscrito: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]) };

/* =========================
   UI: Botão uniforme (tech/discreto — sem verde chapado)
   - “filled” é um preenchimento contido (índigo escuro), não neon
========================= */
function TechButton({ as = "button", href, onClick, children, title, ariaLabel, variant = "ghost", disabled }) {
  const base = [
    "inline-flex items-center justify-center gap-2",
    "rounded-2xl px-4 py-2.5",
    "text-[13px] font-extrabold",
    "border transition select-none",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900",
    "shadow-sm hover:shadow",
  ].join(" ");

  const styles = {
    ghost: [
      "bg-white/70 dark:bg-zinc-900/30",
      "text-slate-800 dark:text-zinc-100",
      "border-slate-200/80 dark:border-zinc-700/70",
      "hover:bg-slate-50 dark:hover:bg-zinc-800/40",
    ].join(" "),
    filled: [
      "bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950",
      "text-white",
      "border-white/10 dark:border-white/10",
      "hover:brightness-[1.05]",
    ].join(" "),
    soft: [
      "bg-indigo-50/80 dark:bg-indigo-900/20",
      "text-indigo-900 dark:text-indigo-200",
      "border-indigo-200/70 dark:border-indigo-800/60",
      "hover:bg-indigo-50 dark:hover:bg-indigo-900/25",
    ].join(" "),
  };

  const cls = [
    base,
    styles[variant] || styles.ghost,
    disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : "",
  ].join(" ");

  if (as === "a") {
    return (
      <a className={cls} href={href} onClick={onClick} title={title} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick} title={title} aria-label={ariaLabel} disabled={disabled}>
      {children}
    </button>
  );
}

TechButton.propTypes = {
  as: PropTypes.oneOf(["button", "a"]),
  href: PropTypes.string,
  onClick: PropTypes.func,
  children: PropTypes.node,
  title: PropTypes.string,
  ariaLabel: PropTypes.string,
  variant: PropTypes.oneOf(["ghost", "filled", "soft"]),
  disabled: PropTypes.bool,
};

/* =========================
   UI: Cartão de estatística (ministat)
========================= */
function StatCard({ icon, label, value, title, accent = "emerald" }) {
  const accents = {
    emerald:
      "from-emerald-50 via-emerald-100 to-transparent border-emerald-200 dark:from-emerald-900/20 dark:via-emerald-900/10 dark:to-transparent dark:border-emerald-800/60",
    teal:
      "from-teal-50 via-teal-100 to-transparent border-teal-200 dark:from-teal-900/20 dark:via-teal-900/10 dark:to-transparent dark:border-teal-800/60",
    cyan:
      "from-cyan-50 via-cyan-100 to-transparent border-cyan-200 dark:from-cyan-900/20 dark:via-cyan-900/10 dark:to-transparent dark:border-cyan-800/60",
    amber:
      "from-amber-50 via-amber-100 to-transparent border-amber-200 dark:from-amber-900/20 dark:via-amber-900/10 dark:to-transparent dark:border-amber-800/60",
    violet:
      "from-violet-50 via-violet-100 to-transparent border-violet-200 dark:from-violet-900/20 dark:via-violet-900/10 dark:to-transparent dark:border-violet-800/60",
    slate:
      "from-slate-50 via-slate-100 to-transparent border-slate-200 dark:from-zinc-900/25 dark:via-zinc-900/10 dark:to-transparent dark:border-zinc-700/70",
    indigo:
      "from-indigo-50 via-indigo-100 to-transparent border-indigo-200 dark:from-indigo-900/25 dark:via-indigo-900/10 dark:to-transparent dark:border-indigo-800/60",
  };
  const grad = accents[accent] || accents.slate;

  return (
    <div
      className={["rounded-2xl p-4 shadow border", "bg-gradient-to-br", grad, "flex flex-col items-start"].join(" ")}
      title={title || label}
      role="group"
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-200 mb-1">
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 select-none">{value ?? "—"}</div>
    </div>
  );
}
StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
  accent: PropTypes.oneOf(["emerald", "teal", "cyan", "amber", "violet", "slate", "indigo"]),
};

/* =========================
   Componente
========================= */
export default function CardEvento({
  evento,
  expandido,
  toggleExpandir,
  turmas,
  carregarInscritos,
  inscritosPorTurma,
  carregarAvaliacao,
  avaliacaoPorTurma,
  presencasPorTurma,
  carregarPresencas,
  gerarRelatorioPDF,
}) {
  const normalizaArr = useCallback((v) => (Array.isArray(v) ? v : Array.isArray(v?.lista) ? v.lista : []), []);

  const stats = useMemo(() => {
    if (!expandido || !Array.isArray(turmas) || !turmas.length) {
      return { totalInscritos: 0, totalPresentes: 0, presencaMedia: "0", totalAvaliacao: 0, notaMedia: "—" };
    }
    let totalInscritos = 0;
    let totalPresentes = 0;
    let totalAvaliacao = 0;
    const mediasDiretas = [];
    const todasAvaliacao = [];

    for (const t of turmas) {
      const inscritos = normalizaArr(inscritosPorTurma?.[t.id]);
      totalInscritos += inscritos.length;

      const presencas = normalizaArr(presencasPorTurma?.[t.id]);
      totalPresentes += presencas.filter((p) => p?.presente === true).length;

      const blocoAval = avaliacaoPorTurma?.[t.id] || {};
      const avalArr = Array.isArray(blocoAval.avaliacao) ? blocoAval.avaliacao : normalizaArr(blocoAval);
      const qtd = Number(blocoAval.total_avaliacao);
      totalAvaliacao += Number.isFinite(qtd) ? qtd : avalArr.length;

      if (blocoAval.media_evento != null && blocoAval.media_evento !== "—") {
        const m = Number(blocoAval.media_evento);
        if (!Number.isNaN(m)) mediasDiretas.push(m);
      } else {
        todasAvaliacao.push(...avalArr);
      }
    }

    const presencaMedia = totalInscritos ? ((totalPresentes / totalInscritos) * 100).toFixed(0) : "0";

    let notaMedia = "—";
    if (mediasDiretas.length) {
      const m = mediasDiretas.reduce((a, v) => a + v, 0) / mediasDiretas.length;
      notaMedia = m.toFixed(1);
    } else if (todasAvaliacao.length) {
      notaMedia = calcularMediaEventoViaLista(todasAvaliacao);
    }

    return { totalInscritos, totalPresentes, presencaMedia, totalAvaliacao, notaMedia };
  }, [expandido, turmas, inscritosPorTurma, presencasPorTurma, avaliacaoPorTurma, normalizaArr]);

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos(turma.id);
      if (!avaliacaoPorTurma?.[turma.id]) carregarAvaliacao(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas(turma.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, turmas]);

  const periodoTexto = useMemo(() => getPeriodoEvento(evento, turmas), [evento, turmas]);
  const turmasId = `evento-${evento.id}-turmas`;
  const tituloId = `evento-${evento.id}-titulo`;
  const periodoId = `evento-${evento.id}-periodo`;

  const folderUrl = useMemo(
    () => resolveAssetUrl(evento?.folder_blob_url || evento?.folder_url),
    [evento?.folder_blob_url, evento?.folder_url]
  );
  const [imgOk, setImgOk] = useState(true);

  const tipo = String(evento?.tipo || "").trim();
  const publico = String(evento?.publico_alvo || "").trim();
  const jaInscrito = Boolean(evento?.ja_inscrito);

  // ✅ Programação PDF (se existir)
  const programacaoUrl = useMemo(() => resolveAssetUrl(evento?.programacao_pdf_url), [evento?.programacao_pdf_url]);
  const temProgramacao = Boolean(programacaoUrl);

  return (
    <section
      className={[
        "relative",
        "bg-white dark:bg-zinc-800",
        "p-6 rounded-2xl shadow-lg mb-6",
        "border border-slate-200/80 dark:border-zinc-700/70",
        "transition hover:shadow-2xl",
      ].join(" ")}
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      {/* cabeçalho */}
      <div className="flex items-start gap-4">
        {/* thumbnail */}
        <div className="hidden sm:block shrink-0">
          <div className="w-40 h-28 rounded-xl overflow-hidden border border-slate-200/80 dark:border-zinc-700/70 bg-slate-50 dark:bg-zinc-700 flex items-center justify-center">
            {folderUrl && imgOk ? (
              <img
                src={folderUrl}
                alt={`Imagem de divulgação do evento “${evento?.titulo ?? ""}”`}
                loading="lazy"
                className="w-full h-full object-cover"
                draggable={false}
                referrerPolicy="no-referrer"
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400">
                <ImageIcon className="w-8 h-8" aria-hidden="true" />
                <span className="text-[11px] mt-1">{folderUrl ? "Imagem indisponível" : "Sem imagem"}</span>
              </div>
            )}
          </div>
        </div>

        {/* título + meta */}
        <div className="min-w-0 flex-1">
          <h3
            id={tituloId}
            className="text-2xl font-black text-slate-900 dark:text-zinc-50 text-left truncate"
            title={evento.titulo}
            aria-live="polite"
          >
            {evento.titulo}
          </h3>

          {/* descrição (se existir) — mantém discreto */}
          {evento?.descricao ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300 line-clamp-2">{evento.descricao}</p>
          ) : null}

          <p id={periodoId} className="text-sm text-slate-600 dark:text-zinc-300 flex items-center gap-2 mt-2">
            <CalendarDays size={16} aria-hidden="true" />
            {periodoTexto}
          </p>

          {(tipo || publico) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {tipo ? <Chip icon={<Tag className="w-4 h-4" aria-hidden="true" />}>{tipo}</Chip> : null}
              {publico ? <Chip icon={<Target className="w-4 h-4" aria-hidden="true" />}>{publico}</Chip> : null}
            </div>
          )}

          {/* ações secundárias (PDF) — mesmo padrão, sem verde chamativo */}
          {temProgramacao && (
            <div className="mt-4 flex flex-wrap gap-2">
              <TechButton
                as="a"
                href={programacaoUrl}
                title="Baixar programação em PDF"
                ariaLabel="Baixar programação em PDF"
                variant="soft"
              >
                <FileText className="w-4 h-4" aria-hidden="true" />
                Baixar programação (PDF)
                <Download className="w-4 h-4 opacity-90" aria-hidden="true" />
              </TechButton>
            </div>
          )}
        </div>

        {/* direita: badge inscrição + ver turmas */}
        <div className="shrink-0 flex flex-col items-end gap-3">
          <InscricaoBadge jaInscrito={jaInscrito} />

          <TechButton
            onClick={() => toggleExpandir(evento.id)}
            ariaLabel={expandido ? "Recolher detalhes do evento" : "Ver detalhes do evento"}
            title={expandido ? "Recolher" : "Ver turmas"}
            variant={expandido ? "filled" : "ghost"}
          >
            {expandido ? (
              <>
                Ocultar turmas <ChevronUp className="w-4 h-4" aria-hidden="true" />
              </>
            ) : (
              <>
                Ver turmas <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </>
            )}
          </TechButton>
        </div>
      </div>

      {/* stats + turmas */}
      {expandido && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            <StatCard
              icon={jaInscrito ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
              label="Minha inscrição"
              value={jaInscrito ? "Inscrito" : "Não inscrito"}
              accent={jaInscrito ? "indigo" : "slate"}
              title={jaInscrito ? "Você já possui inscrição neste evento." : "Você ainda não se inscreveu neste evento."}
            />
            <StatCard icon={<Users aria-hidden="true" />} label="Inscritos" value={stats.totalInscritos} accent="emerald" />
            <StatCard icon={<Users aria-hidden="true" />} label="Presentes" value={stats.totalPresentes} accent="teal" />
            <StatCard icon={<BarChart aria-hidden="true" />} label="Presença Média" value={`${stats.presencaMedia}%`} accent="cyan" />
            <StatCard icon={<Star aria-hidden="true" />} label="Avaliações" value={stats.totalAvaliacao} accent="amber" />
            <StatCard icon={<Star aria-hidden="true" />} label="Nota Média" value={stats.notaMedia} accent="violet" />
          </div>
        </>
      )}

      {expandido && Array.isArray(turmas) && turmas.length > 0 && (
        <div id={turmasId} className="mt-6 space-y-4">
          {turmas.map((turma) => (
  <CardTurma
    key={turma.id}
    turma={{
      ...turma,
      // ✅ garante que exista 'instrutores' (mesmo se vier como 'instrutor')
      instrutores: Array.isArray(turma?.instrutores)
        ? turma.instrutores
        : Array.isArray(turma?.instrutor)
        ? turma.instrutor
        : [],
    }}
    eventoId={eventoId}
    hoje={hoje}
    inscrever={inscrever}
    inscrevendo={inscrevendo}
    inscricaoConfirmadas={inscricaoConfirmadas}
  />
))}

        </div>
      )}

      {expandido && Array.isArray(turmas) && turmas.length === 0 && (
        <div className="text-slate-600 dark:text-zinc-300 mt-4">Nenhuma turma cadastrada.</div>
      )}
    </section>
  );
}

CardEvento.propTypes = {
  evento: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    titulo: PropTypes.string.isRequired,
    descricao: PropTypes.string,
    folder_url: PropTypes.string,
    folder_blob_url: PropTypes.string,
    programacao_pdf_url: PropTypes.string,

    data_inicio_geral: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim_geral: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),

    tipo: PropTypes.string,
    publico_alvo: PropTypes.string,
    ja_inscrito: PropTypes.oneOfType([PropTypes.bool, PropTypes.number]),
  }).isRequired,

  expandido: PropTypes.bool,
  toggleExpandir: PropTypes.func.isRequired,
  turmas: PropTypes.array,
  carregarInscritos: PropTypes.func.isRequired,
  inscritosPorTurma: PropTypes.object,
  carregarAvaliacao: PropTypes.func.isRequired,
  avaliacaoPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  carregarPresencas: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func,
};
