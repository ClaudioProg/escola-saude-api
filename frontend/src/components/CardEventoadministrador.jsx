// 📁 src/components/CardEventoadministrador.jsx
import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import { CalendarDays, Users, Star, BarChart, FileDown } from "lucide-react";
import BadgeStatus from "./BadgeStatus";
import CardTurmaadministrador from "./CardTurmaadministrador";

/* =========================
   Helpers de Data (fuso local)
   ========================= */
const isDateOnly = (str) => typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);

function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (typeof input === "string") {
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(input);
  }
  return new Date(input);
}
function formatarDataLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
}
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const toLocalDateFromYMD = (ymdStr, hhmm = "12:00") =>
  ymdStr ? new Date(`${ymdStr}T${(hhmm || "12:00").slice(0, 5)}:00`) : null;

const formatarCPF = (v) =>
  (String(v ?? "")
    .replace(/\D/g, "")
    .slice(0, 11)
    .padStart(11, "0") || ""
  ).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

/* =========================
   Período do evento (corrigido anti-fuso)
   ========================= */
function getPeriodoEvento(evento, turmas) {
  // Sempre reduz para YYYY-MM-DD e cria data local ao meio-dia
  const diAggY = ymd(evento?.data_inicio_geral);
  const dfAggY = ymd(evento?.data_fim_geral);

  const formatarPeriodo = (iniYMD, fimYMD) => {
    if (!iniYMD || !fimYMD) return "Período não informado";
    const a = toLocalDateFromYMD(iniYMD, "12:00");
    const b = toLocalDateFromYMD(fimYMD, "12:00");
    if (!a || !b || isNaN(a) || isNaN(b)) return "Período não informado";
    const sameDay =
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    return sameDay ? formatarDataLocal(a) : `${formatarDataLocal(a)} até ${formatarDataLocal(b)}`;
  };

  if (diAggY && dfAggY) return formatarPeriodo(diAggY, dfAggY);

  // Agrega pelas turmas se não houver datas agregadas
  if (Array.isArray(turmas) && turmas.length > 0) {
    const starts = turmas
      .map((t) => ymd(t?.data_inicio))
      .filter(Boolean)
      .map((d) => toLocalDateFromYMD(d, "12:00")?.getTime())
      .filter(Boolean);
    const ends = turmas
      .map((t) => ymd(t?.data_fim))
      .filter(Boolean)
      .map((d) => toLocalDateFromYMD(d, "12:00")?.getTime())
      .filter(Boolean);

    if (starts.length && ends.length) {
      const a = new Date(Math.min(...starts));
      const b = new Date(Math.max(...ends));
      const aY = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(
        a.getDate()
      ).padStart(2, "0")}`;
      const bY = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(
        b.getDate()
      ).padStart(2, "0")}`;
      return formatarPeriodo(aY, bY);
    }
  }
  return "Período não informado";
}

/* =========================
   Status por data + horário
   ========================= */
function getStatusEvento({ evento, turmas }) {
  const agora = new Date();
  const diAgg = ymd(evento?.data_inicio_geral);
  const dfAgg = ymd(evento?.data_fim_geral);
  const hiAgg = (evento?.horario_inicio_geral || "00:00").slice(0, 5);
  const hfAgg = (evento?.horario_fim_geral || "23:59").slice(0, 5);

  let inicioDT = diAgg ? toLocalDateFromYMD(diAgg, hiAgg) : null;
  let fimDT = dfAgg ? toLocalDateFromYMD(dfAgg, hfAgg) : null;

  if (!inicioDT || !fimDT) {
    const starts = [];
    const ends = [];
    (turmas || []).forEach((t) => {
      const di = ymd(t.data_inicio);
      const df = ymd(t.data_fim);
      const hi = (t.horario_inicio || "00:00").slice(0, 5);
      const hf = (t.horario_fim || "23:59").slice(0, 5);
      const s = di ? toLocalDateFromYMD(di, hi) : null;
      const e = df ? toLocalDateFromYMD(df, hf) : null;
      if (s) starts.push(s.getTime());
      if (e) ends.push(e.getTime());
    });
    if (starts.length) inicioDT = new Date(Math.min(...starts));
    if (ends.length) fimDT = new Date(Math.max(...ends));
  }

  if (!inicioDT || !fimDT) return "desconhecido";
  if (agora < inicioDT) return "programado";
  if (agora > fimDT) return "encerrado";
  return "andamento"; // 🔧 retorna 'andamento' para casar com BadgeStatus
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
   Componente
   ========================= */
export default function CardEventoadministrador({
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
  gerarPdfInscritosTurma, // 👈 novo
}) {
  const normalizaArr = (v) => (Array.isArray(v) ? v : Array.isArray(v?.lista) ? v.lista : []);

  // Estatísticas (só quando expandido)
  const stats = useMemo(() => {
    if (!expandido || !Array.isArray(turmas)) {
      return {
        totalInscritos: 0,
        totalPresentes: 0,
        presencaMedia: "0",
        totalAvaliacoes: 0,
        notaMedia: "—",
      };
    }
    let totalInscritos = 0,
      totalPresentes = 0,
      totalAvaliacoes = 0;
    const mediasDiretas = [],
      todasAvaliacoes = [];

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
  }, [expandido, turmas, inscritosPorTurma, presencasPorTurma, avaliacoesPorTurma]);

  // Precarrega blocos ao expandir
  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    for (const turma of turmas) {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos?.(turma.id);
      if (!avaliacoesPorTurma?.[turma.id]) carregarAvaliacoes?.(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas?.(turma.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, turmas]);

  const nomeinstrutor = useMemo(() => {
    if (Array.isArray(evento.instrutor)) {
      return evento.instrutor.map((i) => i?.nome).filter(Boolean).join(", ") || "—";
    }
    if (typeof evento.instrutor === "object" && evento.instrutor?.nome) {
      return evento.instrutor.nome;
    }
    return "—";
  }, [evento]);

  const statusEvento = getStatusEvento({ evento, turmas });

  return (
    <section
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg mb-6 border border-gray-200 dark:border-zinc-700 transition hover:shadow-2xl"
      aria-labelledby={`evento-${evento.id}-titulo`}
    >
      {/* TOPO */}
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h3
            id={`evento-${evento.id}-titulo`}
            className="text-2xl font-bold text-green-900 dark:text-green-200 truncate"
            title={evento.titulo}
          >
            {evento.titulo}
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2 mt-1 mb-1">
            <span className="font-semibold">Instrutor:</span>
            <span className="truncate" title={nomeinstrutor}>
              {nomeinstrutor}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
            <CalendarDays size={16} aria-hidden="true" />
            {getPeriodoEvento(evento, turmas)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <BadgeStatus status={statusEvento} size="sm" variant="soft" />
          <button
            onClick={() => toggleExpandir(evento.id)}
            aria-label={expandido ? "Recolher detalhes do evento" : "Ver detalhes do evento"}
            aria-expanded={expandido}
            aria-controls={`evento-${evento.id}-turmas`}
            className="text-sm px-4 py-1 bg-green-900 text-white rounded-full hover:bg-green-900/90 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60"
          >
            {expandido ? "Recolher" : "Ver Turmas"}
          </button>
        </div>
      </div>

      {/* STATS + TURMAS */}
      {expandido && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            <StatCard icon={<Users aria-hidden="true" />} label="Inscritos" value={stats.totalInscritos} />
            <StatCard icon={<Users aria-hidden="true" />} label="Presentes" value={stats.totalPresentes} />
            <StatCard
              icon={<BarChart aria-hidden="true" />}
              label="Presença Média"
              value={`${stats.presencaMedia}%`}
              title="Presença média nas turmas"
            />
            <StatCard icon={<Star aria-hidden="true" />} label="Avaliações" value={stats.totalAvaliacoes} />
            <StatCard
              icon={<Star aria-hidden="true" />}
              label="Nota Média"
              value={stats.notaMedia}
              title="Nota média atribuída ao evento (escala 1–5)"
            />
          </div>

          {Array.isArray(turmas) && turmas.length > 0 ? (
            <div id={`evento-${evento.id}-turmas`} className="mt-6 space-y-6">
              {turmas.map((turma) => {
                const lista = inscritosPorTurma?.[turma.id] || [];
                return (
                  <div key={turma.id} className="space-y-3">
                    <CardTurmaadministrador
                      turma={turma}
                      inscritos={lista}
                      carregarInscritos={carregarInscritos}
                      carregarAvaliacoes={carregarAvaliacoes}
                      carregarPresencas={carregarPresencas}
                      gerarRelatorioPDF={gerarRelatorioPDF}
                      somenteInfo
                    />

                    {/* Lista de inscritos (nome + CPF) + botão PDF */}
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                          Inscritos da turma
                        </p>
                        <button
                          onClick={() => gerarPdfInscritosTurma?.(turma.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-900 text-white hover:bg-green-900/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-900/60"
                        >
                          <FileDown size={16} /> Gerar PDF (curso + inscritos)
                        </button>
                      </div>

                      {lista.length === 0 ? (
                        <p className="text-xs text-zinc-500 mt-2">Nenhum inscrito.</p>
                      ) : (
                        <ul className="mt-3 grid sm:grid-cols-2 gap-y-1 text-sm">
                          {lista.map((i) => (
                            <li key={i.id || i.usuario_id || i.cpf}>
                              {i?.nome || "—"} —{" "}
                              <span className="text-zinc-500">{formatarCPF(i?.cpf)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-gray-600 dark:text-gray-300 mt-4">Nenhuma turma cadastrada.</div>
          )}
        </>
      )}
    </section>
  );
}

/* =========================
   UI: Cartão de estatística
   ========================= */
function StatCard({ icon, label, value, title }) {
  return (
    <div
      className="bg-white dark:bg-zinc-700 rounded-xl p-4 flex flex-col items-start shadow border border-gray-200 dark:border-zinc-600"
      title={title || label}
    >
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-1">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-xl font-bold text-green-900 dark:text-green-200">{value}</div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
};

CardEventoadministrador.propTypes = {
  evento: PropTypes.object.isRequired,
  expandido: PropTypes.bool,
  toggleExpandir: PropTypes.func.isRequired,
  turmas: PropTypes.array,
  carregarInscritos: PropTypes.func,
  inscritosPorTurma: PropTypes.object,
  carregarAvaliacoes: PropTypes.func,
  avaliacoesPorTurma: PropTypes.object,
  presencasPorTurma: PropTypes.object,
  carregarPresencas: PropTypes.func,
  gerarRelatorioPDF: PropTypes.func,
  gerarPdfInscritosTurma: PropTypes.func, // 👈 novo
};
