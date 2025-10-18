// 📁 src/pages/PresencasPorTurma.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca";
import { toast } from "react-toastify";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import PainelComTitulo from "../components/PainelComTitulo";
import { RefreshCw, CalendarDays, Users } from "lucide-react";
import { apiGet } from "../services/api";

export default function PresencasPorTurma() {
  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [a11yMsg, setA11yMsg] = useState("");

  // Ref para cancelar fetch ao desmontar/atualizar
  const abortRef = useRef(null);

  const hoje = useMemo(() => new Date(), []);

  /* ───────────── helpers de data ───────────── */
  const isoDay = (v) => {
    if (!v) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "string") return v.slice(0, 10);
    try {
      return new Date(v).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };
  const hojeIso = isoDay(hoje);

  const turmaTemEncontroNoDia = (turma, isoDate) => {
    const encontros = Array.isArray(turma?.encontros) ? turma.encontros : [];
    const datas = Array.isArray(turma?.datas) ? turma.datas : [];
    const temEmEncontros = encontros.some((e) => isoDay(e?.data || e) === isoDate);
    const temEmDatas = datas.some((d) => isoDay(d?.data) === isoDate);
    return temEmEncontros || temEmDatas;
  };

  /* ───────────── carregamentos ───────────── */
  const carregarEventosETurmas = useCallback(async () => {
    try {
      setIsLoading(true);

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
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`, { on401: "silent", on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error("Erro ao carregar inscritos:", err);
      toast.error("❌ Erro ao carregar inscritos.");
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
    }
  }, []);

  const carregarAvaliacoes = useCallback(async (turmaId) => {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, { on401: "silent", on403: "silent" });
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
  const totalTurmas = useMemo(
    () => eventos.reduce((acc, ev) => acc + (Array.isArray(ev?.turmas) ? ev.turmas.length : 0), 0),
    [eventos]
  );
  const turmasHoje = useMemo(() => {
    let count = 0;
    for (const ev of eventos) {
      for (const t of ev?.turmas || []) {
        if (turmaTemEncontroNoDia(t, hojeIso)) count++;
      }
    }
    return count;
  }, [eventos, hojeIso]);

  /* ───────────── ações / header ───────────── */
  const actions = (
    <>
      <button
        onClick={carregarEventosETurmas}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white focus-visible:ring-2 focus-visible:ring-white/60"
        title="Atualizar lista"
      >
        <RefreshCw className="w-4 h-4" />
        Atualizar
      </button>
    </>
  );

  const minis = (
    <>
      <div className="rounded-xl bg-white/10 p-3 text-white/90">
        <div className="text-[11px] uppercase tracking-wide opacity-80">Eventos</div>
        <div className="text-sm font-bold flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> {totalEventos}
        </div>
      </div>
      <div className="rounded-xl bg-white/10 p-3 text-white/90">
        <div className="text-[11px] uppercase tracking-wide opacity-80">Turmas</div>
        <div className="text-sm font-bold flex items-center gap-2">
          <Users className="w-4 h-4" /> {totalTurmas}
        </div>
      </div>
      <div className="rounded-xl bg-white/10 p-3 text-white/90">
        <div className="text-[11px] uppercase tracking-wide opacity-80">Turmas hoje</div>
        <div className="text-sm font-bold">{turmasHoje}</div>
      </div>
      <div className="rounded-xl bg-white/10 p-3 text-white/90">
        <div className="text-[11px] uppercase tracking-wide opacity-80">Data</div>
        <div className="text-sm font-bold">{hoje.toLocaleDateString("pt-BR")}</div>
      </div>
    </>
  );

  return (
    <main className="pb-8">
      {/* região live discreta para leitores de tela */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {a11yMsg}
      </span>

      <PainelComTitulo
        titulo="Registro Manual de Presenças"
        subtitulo="Gerencie presenças por turma e visualize avaliações rapidamente."
        icon={CalendarDays}
        headerHero
        heroVariant="emerald"   // cor exclusiva para Presenças
        heroSize="md"           // todos headers com mesmo tamanho
        actions={actions}
        minis={minis}
        card={false}
        padded={false}
        stickyHeader
      >
        <div className="p-4 max-w-6xl mx-auto">
          {isLoading ? (
            <CarregandoSkeleton />
          ) : eventos.length === 0 ? (
            <NadaEncontrado
              mensagem="Nenhuma turma encontrada."
              sugestao="Verifique se há eventos e turmas cadastrados."
              variant="emerald"
              actions={[
                { label: "Atualizar", onClick: carregarEventosETurmas, variant: "primary" },
              ]}
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
