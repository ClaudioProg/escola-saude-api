// 📁 src/components/CardEvento.jsx
import { CalendarDays, Users, Star, BarChart } from "lucide-react";
import PropTypes from "prop-types";
import { useEffect } from "react";
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
    // "YYYY-MM-DD" → cria Date local (00:00 no fuso local)
    if (isDateOnly(input)) {
      const [y, m, d] = input.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    // Strings com hora:
    // - Se já tiver timezone (Z ou ±HH:MM), respeita
    // - Se não tiver, o JS interpreta como local (bom pra nós)
    return new Date(input);
  }

  return new Date(input);
}

function formatarDataLocal(d) {
  const dt = toLocalDate(d);
  if (!dt || Number.isNaN(dt.getTime())) return "";
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
  const n = (valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  switch (n) {
    case "otimo": return 5;
    case "bom": return 4;
    case "regular": return 3;
    case "ruim": return 2;
    case "pessimo": return 1;
    default: return null;
  }
}

function calcularMediaEventoViaLista(avaliacoes) {
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) return "—";
  const medias = avaliacoes
    .map((av) => {
      let soma = 0, qtd = 0;
      CAMPOS_NOTA_EVENTO.forEach((campo) => {
        const v = notaEnumParaNumero(av[campo]);
        if (v !== null) { soma += v; qtd++; }
      });
      return qtd ? soma / qtd : null;
    })
    .filter((v) => v != null);
  if (medias.length === 0) return "—";
  const m = medias.reduce((a, v) => a + v, 0) / medias.length;
  return m.toFixed(1);
}

/* =========================
   Datas do evento (sem UTC shift)
   ========================= */

   function getPeriodoEvento(evento, turmas) {
    // 1) Preferir os agregados vindos da API
    const diAgg = evento?.data_inicio_geral;
    const dfAgg = evento?.data_fim_geral;
  
    const formatarPeriodo = (ini, fim) => {
      if (!ini || !fim) return "Período não informado";
      const a = toLocalDate(ini);
      const b = toLocalDate(fim);
      if (!a || !b || isNaN(a) || isNaN(b)) return "Período não informado";
  
      const sameDay =
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
  
      // mesmo dia → só uma data
      if (sameDay) return formatarDataLocal(a);
      return `${formatarDataLocal(a)} até ${formatarDataLocal(b)}`;
    };
  
    if (diAgg && dfAgg) return formatarPeriodo(diAgg, dfAgg);
  
    // 2) Fallback: calcular pelas turmas recebidas no componente
    if (Array.isArray(turmas) && turmas.length > 0) {
      const inicioMin = turmas.reduce((min, t) => {
        const dt = toLocalDate(t?.data_inicio);
        return (!min || (dt && dt < min)) ? dt : min;
      }, null);
  
      const fimMax = turmas.reduce((max, t) => {
        const dt = toLocalDate(t?.data_fim);
        return (!max || (dt && dt > max)) ? dt : max;
      }, null);
  
      return formatarPeriodo(inicioMin, fimMax);
    }
  
    return "Período não informado";
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
  presencasPorTurma,
  carregarPresencas,
  gerarRelatorioPDF,
}) {
  const normalizaArr = (v) =>
    Array.isArray(v) ? v : (Array.isArray(v?.lista) ? v.lista : []);

  const calcularEstatisticas = () => {
    if (!Array.isArray(turmas)) {
      return { totalInscritos: 0, totalPresentes: 0, presencaMedia: "0", totalAvaliacoes: 0, notaMedia: "—" };
    }
    let totalInscritos = 0;
    let totalPresentes = 0;
    let totalAvaliacoes = 0;

    const mediasDiretas = [];
    const todasAvaliacoes = [];

    turmas.forEach((t) => {
      const inscritos = normalizaArr(inscritosPorTurma?.[t.id]);
      totalInscritos += inscritos.length;

      const presencas = normalizaArr(presencasPorTurma?.[t.id]);
      totalPresentes += presencas.filter((p) => p?.presente === true).length;

      const blocoAval = avaliacoesPorTurma?.[t.id] || {};
      const avalArr = Array.isArray(blocoAval.avaliacoes)
        ? blocoAval.avaliacoes
        : normalizaArr(blocoAval);

      const qtd = Number(blocoAval.total_avaliacoes);
      totalAvaliacoes += Number.isFinite(qtd) ? qtd : avalArr.length;

      if (blocoAval.media_evento != null && blocoAval.media_evento !== "—") {
        const m = Number(blocoAval.media_evento);
        if (!Number.isNaN(m)) mediasDiretas.push(m);
      } else {
        todasAvaliacoes.push(...avalArr);
      }
    });

    const presencaMedia = totalInscritos
      ? ((totalPresentes / totalInscritos) * 100).toFixed(0)
      : "0";

    let notaMedia = "—";
    if (mediasDiretas.length > 0) {
      const m = mediasDiretas.reduce((a, v) => a + v, 0) / mediasDiretas.length;
      notaMedia = m.toFixed(1);
    } else if (todasAvaliacoes.length > 0) {
      notaMedia = calcularMediaEventoViaLista(todasAvaliacoes);
    }

    return { totalInscritos, totalPresentes, presencaMedia, totalAvaliacoes, notaMedia };
  };

  const stats = expandido ? calcularEstatisticas() : null;

  useEffect(() => {
    if (!expandido || !Array.isArray(turmas)) return;
    turmas.forEach((turma) => {
      if (!inscritosPorTurma?.[turma.id]) carregarInscritos(turma.id);
      if (!avaliacoesPorTurma?.[turma.id]) carregarAvaliacoes(turma.id);
      if (!presencasPorTurma?.[turma.id]) carregarPresencas(turma.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, turmas]);

  const nomeinstrutor = Array.isArray(evento.instrutor)
    ? evento.instrutor.map((i) => i?.nome).filter(Boolean).join(", ")
    : typeof evento.instrutor === "object" && evento.instrutor?.nome
    ? evento.instrutor.nome
    : "—";

  return (
    <section
      className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-lg mb-6 border border-gray-200 dark:border-zinc-700 transition hover:shadow-2xl"
      aria-labelledby={`evento-${evento.id}-titulo`}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 id={`evento-${evento.id}-titulo`} className="text-2xl font-bold text-[#1b4332] dark:text-white text-left">
            {evento.titulo}
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2 mt-1 mb-1">
            <span className="font-semibold">instrutor:</span>
            <span>{nomeinstrutor}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
            <CalendarDays size={16} aria-hidden="true" />
            {getPeriodoEvento(evento, turmas)}
          </p>
        </div>

        <button
          onClick={() => toggleExpandir(evento.id)}
          aria-label={expandido ? "Recolher detalhes do evento" : "Ver detalhes do evento"}
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
            <StatCard icon={<Users aria-hidden="true" />} label="Inscritos" value={stats.totalInscritos} />
            <StatCard icon={<Users aria-hidden="true" />} label="Presentes" value={stats.totalPresentes} />
            <StatCard icon={<BarChart aria-hidden="true" />} label="Presença Média" value={`${stats.presencaMedia}%`} title="Presença média nas turmas" />
            <StatCard icon={<Star aria-hidden="true" />} label="Avaliações" value={stats.totalAvaliacoes} />
            <StatCard icon={<Star aria-hidden="true" />} label="Nota Média" value={stats.notaMedia} title="Nota média atribuída ao evento" />
          </div>
        </>
      )}

      {expandido && Array.isArray(turmas) && turmas.length > 0 && (
        <div id={`evento-${evento.id}-turmas`} className="mt-6 space-y-4">
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
      <div className="text-xl font-bold text-[#1b4332] dark:text-white">{value}</div>
    </div>
  );
}

StatCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  title: PropTypes.string,
};
