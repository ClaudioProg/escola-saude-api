import { CalendarDays, Users, Star, BarChart } from "lucide-react";
import PropTypes from "prop-types";
import { useEffect } from "react";
import CardTurma from "./CardTurma";

// Campos de nota do evento (EXCETO desempenho_instrutor)
const CAMPOS_NOTA_EVENTO = [
  "divulgacao_evento", "recepcao", "credenciamento", "material_apoio", "pontualidade",
  "sinalizacao_local", "conteudo_temas", "estrutura_local", "acessibilidade", "limpeza",
  "inscricao_online", "exposicao_trabalhos", "apresentacao_oral_mostra",
  "apresentacao_tcrs", "oficinas"
];

// Converte nota_enum (string) em número
function notaEnumParaNumero(valor) {
  switch ((valor || "").toLowerCase()) {
    case "ótimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "péssimo": return 1;
    default: return null;
  }
}

// Calcula a média de todas as notas do evento (por avaliação)
function calcularMediaEvento(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) return "—";

  // Para cada avaliação, tira a média dos campos do evento (exceto desempenho_instrutor)
  const mediasPorAvaliacao = avaliacoes.map(av => {
    let soma = 0, qtd = 0;
    CAMPOS_NOTA_EVENTO.forEach(campo => {
      const valor = notaEnumParaNumero(av[campo]);
      if (valor !== null) {
        soma += valor;
        qtd++;
      }
    });
    return qtd ? soma / qtd : null;
  }).filter(v => v != null);

  if (mediasPorAvaliacao.length === 0) return "—";

  const mediaGeral = mediasPorAvaliacao.reduce((acc, v) => acc + v, 0) / mediasPorAvaliacao.length;
  return mediaGeral.toFixed(1);
}

// Utilitário para pegar o período do evento
function getPeriodoEvento(evento, turmas) {
  if (evento.data_inicio && evento.data_fim) {
    return `${formatarData(evento.data_inicio)} até ${formatarData(evento.data_fim)}`;
  }
  if (Array.isArray(turmas) && turmas.length > 0) {
    const inicioMin = turmas.reduce(
      (min, t) =>
        !min || (t.data_inicio && new Date(t.data_inicio) < new Date(min))
          ? t.data_inicio
          : min,
      null
    );
    const fimMax = turmas.reduce(
      (max, t) =>
        !max || (t.data_fim && new Date(t.data_fim) > new Date(max))
          ? t.data_fim
          : max,
      null
    );
    if (inicioMin && fimMax) {
      return `${formatarData(inicioMin)} até ${formatarData(fimMax)}`;
    }
  }
  return "Período não informado";
}

function formatarData(dataISO) {
  if (!dataISO) return "";
  try {
    const date =
      typeof dataISO === "string" || typeof dataISO === "number"
        ? new Date(dataISO)
        : dataISO;
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export default function CardEvento({
  evento,
  expandido,
  toggleExpandir,
  turmas,
  carregarInscritos,
  inscritosPorTurma,
  carregarAvaliacoes,
  avaliacoesPorTurma,
  gerarRelatorioPDF,
}) {
  const calcularEstatisticas = () => {
    let totalInscritos = 0;
    let totalPresentes = 0;
    let totalAvaliacoes = 0;
  
    if (!Array.isArray(turmas)) return null;
  
    turmas.forEach((turma) => {
      const inscritos = inscritosPorTurma?.[turma.id] || [];
      const avaliacoes = Array.isArray(avaliacoesPorTurma?.[turma.id])
        ? avaliacoesPorTurma[turma.id]
        : [];
  
      totalInscritos += inscritos.length;
      totalPresentes += inscritos.filter((i) => i.presente).length;
      totalAvaliacoes += avaliacoes.length;
      // NÃO soma notas aqui, pois a média agora considera vários campos!
    });
  
    const presencaMedia = totalInscritos
      ? ((totalPresentes / totalInscritos) * 100).toFixed(0)
      : "0";
    const notaMedia = totalAvaliacoes
      ? calcularMediaEvento(
          turmas.flatMap(turma => avaliacoesPorTurma?.[turma.id] || [])
        )
      : "—";
  
    return {
      totalInscritos,
      totalPresentes,
      presencaMedia,
      totalAvaliacoes,
      notaMedia,
    };
  };
  

  const stats = expandido ? calcularEstatisticas() : null;

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    turmas.forEach((turma) => {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos(turma.id);
      if (!avaliacoesPorTurma?.[turma.id]) carregarAvaliacoes(turma.id);
    });
    // eslint-disable-next-line
  }, [expandido, turmas]);

  // Nome dos instrutor
  const nomeinstrutor =
    Array.isArray(evento.instrutor) && evento.instrutor.length
      ? evento.instrutor
          .filter((p) => !!p && !!p.nome)
          .map((p) => p.nome)
          .join(", ")
      : evento.instrutor_nome || "—";

  return (
    <section
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg mb-6 border border-gray-200 dark:border-zinc-700 transition hover:shadow-2xl"
      aria-labelledby={`evento-${evento.id}-titulo`}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3
            id={`evento-${evento.id}-titulo`}
            className="text-2xl font-bold text-[#1b4332] dark:text-white"
          >
            {evento.titulo}
          </h3>

          {/* Nome do instrutor */}
          <div className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2 mt-1 mb-1">
            <span className="font-semibold">instrutor:</span>
            <span>{nomeinstrutor}</span>
          </div>

          {/* Período */}
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
            <CalendarDays size={16} aria-hidden="true" />
            {getPeriodoEvento(evento, turmas)}
          </p>
        </div>

        <button
          onClick={() => toggleExpandir(evento.id)}
          aria-label={
            expandido ? "Recolher detalhes do evento" : "Ver detalhes do evento"
          }
          aria-expanded={expandido}
          aria-controls={`evento-${evento.id}-turmas`}
          className="text-sm px-4 py-1 bg-[#1b4332] text-white rounded-full hover:bg-[#14532d] transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#14532d]"
        >
          {expandido ? "Recolher" : "Ver Turmas"}
        </button>
      </div>

      {expandido && stats && (
        <>
          <h4 className="sr-only">Estatísticas do evento</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
            <StatCard
              icon={<Users aria-hidden="true" />}
              label="Inscritos"
              value={stats.totalInscritos}
            />
            <StatCard
              icon={<Users aria-hidden="true" />}
              label="Presentes"
              value={stats.totalPresentes}
            />
            <StatCard
              icon={<BarChart aria-hidden="true" />}
              label="Presença Média"
              value={`${stats.presencaMedia}%`}
              title="Presença média nas turmas"
            />
            <StatCard
              icon={<Star aria-hidden="true" />}
              label="Avaliações"
              value={stats.totalAvaliacoes}
            />
            <StatCard
              icon={<Star aria-hidden="true" />}
              label="Nota Média"
              value={stats.notaMedia}
              title="Nota média atribuída ao evento"
            />
          </div>
        </>
      )}

      {expandido && Array.isArray(turmas) && turmas.length > 0 && (
        <div id={`evento-${evento.id}-turmas`} className="mt-6 space-y-4">
          {turmas.map((turma) => (
            <CardTurma
              key={turma.id}
              turma={turma}
              inscritos={inscritosPorTurma?.[turma.id]}
              avaliacoes={avaliacoesPorTurma?.[turma.id]}
              onGerarRelatorio={() => {
                carregarInscritos(turma.id);
                carregarAvaliacoes(turma.id);
                gerarRelatorioPDF(turma.id);
              }}
            />
          ))}
        </div>
      )}

      {expandido && Array.isArray(turmas) && turmas.length === 0 && (
        <div className="text-gray-500 mt-4">Nenhuma turma cadastrada.</div>
      )}
    </section>
  );
}

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
      <div className="text-xl font-bold text-[#1b4332] dark:text-white">
        {value}
      </div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
};
