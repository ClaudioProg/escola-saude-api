// 📁 src/pages/PresencasPorTurma.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "react-toastify";
import { RefreshCw, CalendarDays, Users, CalendarClock } from "lucide-react";

import ListaTurmasPresenca from "../components/ListaTurmasPresenca";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import PainelComTitulo from "../components/PainelComTitulo";
import { apiGet } from "../services/api";

/* ──────────────────────────────────────────────────────────────
   Helpers de data (SAFE: sem new Date('YYYY-MM-DD') para não "pular" 1 dia)
────────────────────────────────────────────────────────────── */
function isoDayOnly(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  // strings: "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss..."
  if (typeof v === "string") return v.slice(0, 10);

  // objetos {data: 'YYYY-MM-DD'} ou similares
  if (typeof v === "object") {
    const maybe = v?.data || v?.date || v?.dia;
    if (typeof maybe === "string") return maybe.slice(0, 10);
  }

  return "";
}

function turmaTemEncontroNoDia(turma, isoDate) {
  if (!turma || !isoDate) return false;

  const encontros = Array.isArray(turma?.encontros) ? turma.encontros : [];
  const datas = Array.isArray(turma?.datas) ? turma.datas : [];

  // encontros pode vir como string ou objeto {data}
  const temEmEncontros = encontros.some((e) => isoDayOnly(e?.data ?? e) === isoDate);
  const temEmDatas = datas.some((d) => isoDayOnly(d?.data ?? d) === isoDate);

  // fallback: se houver data_inicio/data_fim e quiser considerar “dentro do período”,
  // NÃO fazemos aqui por padrão para não alterar regra; apenas encontros/datas como antes.
  return temEmEncontros || temEmDatas;
}

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [a11yMsg, setA11yMsg] = useState("");

  // Ref para cancelar fetch ao desmontar/atualizar
  const abortRef = useRef(null);

  // “hoje” é fixo na sessão desta tela (evita re-render por relógio)
  const hoje = useMemo(() => new Date(), []);
  const hojeIso = useMemo(() => isoDayOnly(hoje), [hoje]);

  /* ───────────── carregamentos ───────────── */
  const carregarEventosETurmas = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRefreshing(true);

      // cancela requisição anterior, se houver
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      // Endpoint deve devolver um array de eventos, cada um com suas turmas
      const data = await apiGet("/api/administrador/turmas", {
        signal: abortRef.current.signal,
        on401: "silent",
        on403: "silent",
      });

      const arr = Array.isArray(data) ? data : [];
      setEventos(arr);
      setA11yMsg(`Lista atualizada. ${arr.length} evento(s).`);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Erro ao carregar turmas:", err);
        toast.error("❌ Erro ao carregar turmas.");
        setEventos([]);
        setA11yMsg("Erro ao carregar turmas.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarEventosETurmas();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [carregarEventosETurmas]);

  const carregarInscritos = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`, {
        on401: "silent",
        on403: "silent",
      });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar inscritos:", err);
      toast.error("❌ Erro ao carregar inscritos.");
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  }, []);

  const carregarAvaliacoes = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, {
        on401: "silent",
        on403: "silent",
      });
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
      toast.error("❌ Erro ao carregar avaliações.");
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  }, []);

  const handleTurmaRemovida = useCallback(async () => {
    await carregarEventosETurmas();
  }, [carregarEventosETurmas]);

  /* ───────────── derivadas p/ ministats ───────────── */
  const totalEventos = eventos.length;

  const totalTurmas = useMemo(() => {
    let acc = 0;
    for (const ev of eventos) {
      const turmas = Array.isArray(ev?.turmas) ? ev.turmas : [];
      acc += turmas.length;
    }
    return acc;
  }, [eventos]);

  const turmasHoje = useMemo(() => {
    let count = 0;
    for (const ev of eventos) {
      const turmas = Array.isArray(ev?.turmas) ? ev.turmas : [];
      for (const t of turmas) {
        if (turmaTemEncontroNoDia(t, hojeIso)) count++;
      }
    }
    return count;
  }, [eventos, hojeIso]);

  /* ───────────── UI / header ───────────── */
  const actions = (
    <button
      type="button"
      onClick={carregarEventosETurmas}
      disabled={isRefreshing}
      className={[
        "inline-flex items-center gap-2 px-3 py-2 rounded-2xl",
        "bg-white/15 hover:bg-white/25 text-white",
        "ring-1 ring-white/15",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      ].join(" ")}
      title="Atualizar lista"
      aria-label="Atualizar lista de eventos e turmas"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
      {isRefreshing ? "Atualizando…" : "Atualizar"}
    </button>
  );

  const minis = (
    <>
      <MiniStat
        label="Eventos"
        value={totalEventos}
        icon={CalendarDays}
      />
      <MiniStat
        label="Turmas"
        value={totalTurmas}
        icon={Users}
      />
      <MiniStat
        label="Turmas hoje"
        value={turmasHoje}
        icon={CalendarClock}
      />
      <MiniStat
        label="Data"
        value={hoje.toLocaleDateString("pt-BR")}
        icon={CalendarDays}
        valueClassName="text-[13px] sm:text-sm"
      />
    </>
  );

  return (
    <main className="pb-10">
      {/* região live discreta para leitores de tela */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {a11yMsg}
      </span>

      <PainelComTitulo
        titulo="Registro Manual de Presenças"
        subtitulo="Gerencie presenças por turma e visualize avaliações rapidamente."
        icon={CalendarDays}
        headerHero
        heroVariant="emerald" // cor exclusiva para Presenças
        heroSize="md"
        actions={actions}
        minis={minis}
        card={false}
        padded={false}
        stickyHeader
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-2">
          {isLoading ? (
            <CarregandoSkeleton />
          ) : eventos.length === 0 ? (
            <NadaEncontrado
              mensagem="Nenhuma turma encontrada."
              sugestao="Verifique se há eventos e turmas cadastrados."
              variant="emerald"
              actions={[{ label: "Atualizar", onClick: carregarEventosETurmas, variant: "primary" }]}
            />
          ) : (
            <ListaTurmasPresenca
              eventos={eventos}
              hoje={hoje}
              inscritosPorTurma={inscritosPorTurma}
              avaliacoesPorTurma={avaliacoesPorTurma}
              carregarInscritos={carregarInscritos}
              carregarAvaliacoes={carregarAvaliacoes}
              modoadministradorPresencas={true}
              onTurmaRemovida={handleTurmaRemovida}
              mostrarBotaoRemover={true}
            />
          )}
        </div>
      </PainelComTitulo>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────
   MiniStat (visual premium, consistente com o hero)
────────────────────────────────────────────────────────────── */
function MiniStat({ label, value, icon: Icon, valueClassName = "" }) {
  return (
    <div
      className={[
        "rounded-2xl bg-white/10 p-3",
        "ring-1 ring-white/15",
        "shadow-[0_10px_30px_-25px_rgba(0,0,0,0.5)]",
        "text-white/90",
      ].join(" ")}
    >
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        {Icon ? <Icon className="w-4 h-4 opacity-90" aria-hidden="true" /> : null}
        <div className={["text-sm font-extrabold", valueClassName].filter(Boolean).join(" ")}>
          {value}
        </div>
      </div>
    </div>
  );
}

MiniStat.propTypes = {
  label: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  icon: PropTypes.elementType,
  valueClassName: PropTypes.string,
};

// Evita adicionar novo import no topo do arquivo caso você prefira manter enxuto.
// Se você já usa PropTypes globalmente, pode remover este bloco e importar no topo.
import PropTypes from "prop-types";
