// 📁 src/components/CardEvento.jsx
import { CalendarDays, Users, Star, BarChart, Image as ImageIcon } from "lucide-react";
import PropTypes from "prop-types";
import { useEffect, useMemo, useCallback } from "react";
import CardTurma from "./CardTurma";

/* =========================
   Helpers de Data (fuso local)
   ========================= */
function isDateOnly(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;

  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      // constrói data local sem deslocamento UTC
      return new Date(y, m - 1, d);
    }
    return new Date(input); // se tiver timezone, respeita; senão, assume local
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

function calcularMediaEventoViaLista(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) return "—";
  const medias = avaliacoes
    .map((av) => {
      let soma = 0, qtd = 0;
      for (const campo of CAMPOS_NOTA_EVENTO) {
        const v = notaEnumParaNumero(av?.[campo]);
        if (v != null) { soma += v; qtd += 1; }
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
   URL helper p/ folder/programação
   ========================= */
function absUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = import.meta.env?.VITE_API_BASE_URL || "";
  return base ? `${base}${u}` : u;
}

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
  carregarAvaliacoes,
  avaliacoesPorTurma,
  presencasPorTurma,
  carregarPresencas,
  gerarRelatorioPDF,
}) {
  const normalizaArr = useCallback(
    (v) => (Array.isArray(v) ? v : Array.isArray(v?.lista) ? v.lista : []),
    []
  );

  const stats = useMemo(() => {
    if (!expandido || !Array.isArray(turmas) || !turmas.length) {
      return { totalInscritos: 0, totalPresentes: 0, presencaMedia: "0", totalAvaliacoes: 0, notaMedia: "—" };
    }
    let totalInscritos = 0;
    let totalPresentes = 0;
    let totalAvaliacoes = 0;
    const mediasDiretas = [];
    const todasAvaliacoes = [];

    for (const t of turmas) {
      const inscritos = normalizaArr(inscritosPorTurma?.[t.id]);
      totalInscritos += inscritos.length;

      const presencas = normalizaArr(presencasPorTurma?.[t.id]);
      totalPresentes += presencas.filter((p) => p?.presente === true).length;

      const blocoAval = avaliacoesPorTurma?.[t.id] || {};
      const avalArr = Array.isArray(blocoAval.avaliacoes) ? blocoAval.avaliacoes : normalizaArr(blocoAval);
      const qtd = Number(blocoAval.total_avaliacoes);
      totalAvaliacoes += Number.isFinite(qtd) ? qtd : avalArr.length;

      if (blocoAval.media_evento != null && blocoAval.media_evento !== "—") {
        const m = Number(blocoAval.media_evento);
        if (!Number.isNaN(m)) mediasDiretas.push(m);
      } else {
        todasAvaliacoes.push(...avalArr);
      }
    }

    const presencaMedia = totalInscritos ? ((totalPresentes / totalInscritos) * 100).toFixed(0) : "0";

    let notaMedia = "—";
    if (mediasDiretas.length) {
      const m = mediasDiretas.reduce((a, v) => a + v, 0) / mediasDiretas.length;
      notaMedia = m.toFixed(1);
    } else if (todasAvaliacoes.length) {
      notaMedia = calcularMediaEventoViaLista(todasAvaliacoes);
    }

    return { totalInscritos, totalPresentes, presencaMedia, totalAvaliacoes, notaMedia };
  }, [expandido, turmas, inscritosPorTurma, presencasPorTurma, avaliacoesPorTurma, normalizaArr]);

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos(turma.id);
      if (!avaliacoesPorTurma?.[turma.id]) carregarAvaliacoes(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas(turma.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, turmas]);

  // 🔄 Instrutor em nível de evento foi removido. Agora cada CardTurma mostra seus instrutores.

  const periodoTexto = useMemo(() => getPeriodoEvento(evento, turmas), [evento, turmas]);
  const turmasId = `evento-${evento.id}-turmas`;
  const tituloId = `evento-${evento.id}-titulo`;
  const periodoId = `evento-${evento.id}-periodo`;

  const folderUrl = absUrl(evento?.folder_url);

  return (
    <section
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg mb-6 border border-gray-200 dark:border-zinc-700 transition hover:shadow-2xl"
      aria-labelledby={tituloId}
      aria-describedby={periodoId}
    >
      {/* Cabeçalho com coluna de imagem à esquerda */}
      <div className="flex items-start gap-4">
        {/* Coluna da imagem (folder) — esconde em xs para dar prioridade ao título */}
        <div className="hidden sm:block shrink-0">
          <div className="w-40 h-28 rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-700 flex items-center justify-center">
            {folderUrl ? (
              <img
                src={folderUrl}
                alt={`Imagem de divulgação do evento “${evento?.titulo ?? ""}”`}
                loading="lazy"
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-8 h-8" aria-hidden="true" />
                <span className="text-[11px] mt-1">Sem imagem</span>
              </div>
            )}
          </div>
        </div>

        {/* Coluna central (título e período) */}
        <div className="min-w-0 flex-1">
          <h3
            id={tituloId}
            className="text-2xl font-bold text-green-900 dark:text-green-200 text-left truncate"
            title={evento.titulo}
            aria-live="polite"
          >
            {evento.titulo}
          </h3>

          {/* 🔎 Instrutor removido do nível do evento */}

          <p
            id={periodoId}
            className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-1"
          >
            <CalendarDays size={16} aria-hidden="true" />
            {periodoTexto}
          </p>
        </div>

        {/* Botão abre/fecha */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => toggleExpandir(evento.id)}
            aria-label={expandido ? "Recolher detalhes do evento" : "Ver detalhes do evento"}
            aria-expanded={expandido}
            aria-controls={turmasId}
            className="text-sm px-4 py-1 rounded-full transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500/60 bg-gradient-to-br from-[#0f2c1f] via-[#114b2d] to-[#166534] text-white hover:brightness-[1.05]"
            title={expandido ? "Recolher" : "Ver Turmas"}
          >
            {expandido ? "Recolher" : "Ver Turmas"}
          </button>
        </div>
      </div>

      {expandido && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>

          {/* Ministats com micro-gradiente e alto contraste */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            <StatCard
              icon={<Users aria-hidden="true" />}
              label="Inscritos"
              value={stats.totalInscritos}
              accent="emerald"
            />
            <StatCard
              icon={<Users aria-hidden="true" />}
              label="Presentes"
              value={stats.totalPresentes}
              accent="teal"
            />
            <StatCard
              icon={<BarChart aria-hidden="true" />}
              label="Presença Média"
              value={`${stats.presencaMedia}%`}
              title="Presença média nas turmas"
              accent="cyan"
            />
            <StatCard
              icon={<Star aria-hidden="true" />}
              label="Avaliações"
              value={stats.totalAvaliacoes}
              accent="amber"
            />
            <StatCard
              icon={<Star aria-hidden="true" />}
              label="Nota Média"
              value={stats.notaMedia}
              title="Nota média atribuída ao evento (escala 1–5)"
              accent="violet"
            />
          </div>
        </>
      )}

      {expandido && Array.isArray(turmas) && turmas.length > 0 && (
        <div id={turmasId} className="mt-6 space-y-4">
          {turmas.map((turma) => (
            <CardTurma
              key={turma.id}
              eventoId={evento.id}
              inscrever={() => {}}
              turma={turma}
              hoje={new Date()} // ok usar "agora" aqui
              inscritos={inscritosPorTurma?.[turma.id]}
              avaliacoes={avaliacoesPorTurma?.[turma.id]}
              carregarInscritos={carregarInscritos}
              carregarAvaliacoes={carregarAvaliacoes}
              gerarRelatorioPDF={gerarRelatorioPDF}
              inscricoesConfirmadas={[]}
            />
          ))}
        </div>
      )}

      {expandido && Array.isArray(turmas) && turmas.length === 0 && (
        <div className="text-gray-600 dark:text-gray-300 mt-4">Nenhuma turma cadastrada.</div>
      )}
    </section>
  );
}

CardEvento.propTypes = {
  evento: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    titulo: PropTypes.string.isRequired,
    folder_url: PropTypes.string, // caminho/URL do folder (opcional)
    data_inicio_geral: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    data_fim_geral: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  }).isRequired,
  expandido: PropTypes.bool,
  toggleExpandir: PropTypes.func.isRequired,
  turmas: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      data_inicio: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      data_fim: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    })
  ),
  carregarInscritos: PropTypes.func.isRequired,
  inscritosPorTurma: PropTypes.object,
  carregarAvaliacoes: PropTypes.func.isRequired,
  avaliacoesPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  carregarPresencas: PropTypes.func.isRequired,
  gerarRelatorioPDF: PropTypes.func,
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
  };
  const grad = accents[accent] || accents.emerald;

  return (
    <div
      className={[
        "rounded-2xl p-4 shadow border",
        "bg-gradient-to-br",
        grad,
        "flex flex-col items-start",
      ].join(" ")}
      title={title || label}
      role="group"
      aria-label={`${label}: ${value ?? "—"}`}
    >
      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 mb-1">
        <span aria-hidden="true">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-green-900 dark:text-green-200 select-none">
        {value ?? "—"}
      </div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
  accent: PropTypes.oneOf(["emerald", "teal", "cyan", "amber", "violet"]),
};
