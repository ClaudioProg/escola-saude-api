// 📄 src/pages/CancelarInscricoesAdmin.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { apiGet, apiDelete } from "../services/api";
import Spinner from "../components/Spinner";
import Footer from "../components/Footer";
import {
  ChevronDown,
  ChevronRight,
  Users,
  XCircle,
  Building2,
  CalendarClock,
  Search,
  CheckSquare,
  Square,
  Filter,
} from "lucide-react";

/* ---------------- HeaderHero (padronizado) ---------------- */
function HeaderHero({ totalEventos, totalTurmas, onSearch, searchValue }) {
  const buscaRef = useRef(null);
  return (
    <header
      className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 text-white"
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ⬇️ centralizamos o conteúdo e o texto */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="inline-flex items-center justify-center gap-2">
            <XCircle className="w-5 h-5" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Cancelar Inscrições
            </h1>
          </div>
          <p className="text-sm text-white/90">
            Expanda um evento, selecione a turma e gerencie as inscrições dos participantes.
          </p>

          {/* Busca / KPIs rápidos */}
          <div className="mt-2 grid w-full grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label htmlFor="busca" className="sr-only">Buscar por evento ou local</label>
              <div className="relative">
                <input
                  id="busca"
                  ref={buscaRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Buscar por título do evento ou local…"
                  className="w-full px-4 py-2 pl-10 rounded-xl bg-white/95 text-lousa placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/60"
                />
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="inline-flex items-center gap-1 text-sm bg-white/10 px-3 py-2 rounded-xl">
                <Filter className="w-4 h-4" /> {totalEventos} eventos
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-sm bg-white/10 px-3 py-2 rounded-xl">
                {totalTurmas} turmas
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/* Pequeno Modal acessível (sem dependências) */
function ConfirmModal({ open, title, message, onCancel, onConfirm, confirmLabel = "Confirmar", danger }) {
  const ref = useRef(null);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      ref.current?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        ref={ref}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/5"
      >
        <div className="p-5">
          <h2 id="confirm-title" className="text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{message}</p>
        </div>
        <div className="px-5 pb-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 rounded-lg text-white ${danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-700 hover:bg-emerald-800"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CancelarInscricoesAdmin() {
  const [eventos, setEventos] = useState([]);
  const [loadingEventos, setLoadingEventos] = useState(true);

  // mapas de estado por id
  const [abertoEvento, setAbertoEvento] = useState({});
  const [turmasPorEvento, setTurmasPorEvento] = useState({});
  const [loadingTurmas, setLoadingTurmas] = useState({});

  const [abertaTurma, setAbertaTurma] = useState({});
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [loadingInscritos, setLoadingInscritos] = useState({});

  const [selecionados, setSelecionados] = useState({}); // { [turmaId]: Set(usuario_id) }

  const [busca, setBusca] = useState("");
  const liveRef = useRef(null); // aria-live

  const [modal, setModal] = useState({ open: false, turmaId: null, usuarioIds: [] });

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  // carregar eventos
  useEffect(() => {
    (async () => {
      try {
        setLoadingEventos(true);
        setLive("Carregando eventos…");
        let data = [];
        try { data = await apiGet(`/api/eventos?ordenar=recentes`, { on403: "silent" }); }
        catch { data = await apiGet(`/api/eventos`, { on403: "silent" }); }
        setEventos(Array.isArray(data) ? data : []);
        setLive(`Eventos carregados: ${Array.isArray(data) ? data.length : 0}.`);
      } catch (e) {
        const msg = e?.response?.data?.erro || e?.message || "Falha ao carregar eventos.";
        toast.error(msg);
        setLive("Falha ao carregar eventos.");
      } finally {
        setLoadingEventos(false);
      }
    })();
  }, []);

  // filtro de eventos por texto (título/local)
  const eventosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return eventos;
    return eventos.filter((ev) =>
      [ev.titulo, ev.local].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [eventos, busca]);

  async function toggleEvento(eventoId) {
    setAbertoEvento((prev) => ({ ...prev, [eventoId]: !prev[eventoId] }));
    const abriu = !abertoEvento[eventoId];
    if (abriu && !turmasPorEvento[eventoId]) {
      try {
        setLoadingTurmas((p) => ({ ...p, [eventoId]: true }));
        setLive(`Carregando turmas do evento ${eventoId}…`);
        let turmas = [];
        try { turmas = await apiGet(`/api/turmas?evento_id=${eventoId}`, { on403: "silent" }); }
        catch { turmas = await apiGet(`/api/turmas/evento/${eventoId}`, { on403: "silent" }); }
        if (!Array.isArray(turmas)) turmas = [];
        setTurmasPorEvento((prev) => ({ ...prev, [eventoId]: turmas }));
        setLive(`Turmas do evento ${eventoId} carregadas: ${turmas.length}.`);
      } catch (e) {
        const msg = e?.response?.data?.erro || e?.message || "Falha ao carregar turmas do evento.";
        toast.error(msg);
        setLive("Falha ao carregar turmas do evento.");
      } finally {
        setLoadingTurmas((p) => ({ ...p, [eventoId]: false }));
      }
    }
  }

  async function toggleTurma(turmaId) {
    setAbertaTurma((prev) => ({ ...prev, [turmaId]: !prev[turmaId] }));
    const abriu = !abertaTurma[turmaId];
    if (abriu && !inscritosPorTurma[turmaId]) {
      await carregarInscritos(turmaId);
    }
  }

  async function carregarInscritos(turmaId) {
    try {
      setLoadingInscritos((p) => ({ ...p, [turmaId]: true }));
      setLive(`Carregando inscritos da turma ${turmaId}…`);
      const inscritos = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(inscritos) ? inscritos : [] }));
      setSelecionados((prev) => ({ ...prev, [turmaId]: new Set() }));
      setLive(`Inscritos da turma ${turmaId} carregados: ${Array.isArray(inscritos) ? inscritos.length : 0}.`);
    } catch (e) {
      const msg = e?.response?.data?.erro || e?.message || "Falha ao buscar inscritos.";
      toast.error(msg);
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
      setLive("Falha ao carregar inscritos.");
    } finally {
      setLoadingInscritos((p) => ({ ...p, [turmaId]: false }));
    }
  }

  function toggleSelecionado(turmaId, usuarioId) {
    setSelecionados((prev) => {
      const atual = new Set(prev[turmaId] || []);
      if (atual.has(usuarioId)) atual.delete(usuarioId);
      else atual.add(usuarioId);
      return { ...prev, [turmaId]: atual };
    });
  }

  function selecionarTodos(turmaId) {
    const lista = inscritosPorTurma[turmaId] || [];
    setSelecionados((prev) => ({ ...prev, [turmaId]: new Set(lista.map((u) => u.usuario_id)) }));
  }
  function limparSelecao(turmaId) {
    setSelecionados((prev) => ({ ...prev, [turmaId]: new Set() }));
  }

  // cancelamento individual (abre modal)
  function confirmarCancelarIndividual(turmaId, usuarioId) {
    setModal({ open: true, turmaId, usuarioIds: [usuarioId] });
  }

  // cancelamento em lote (abre modal)
  function confirmarCancelarLote(turmaId) {
    const setSel = selecionados[turmaId] || new Set();
    if (setSel.size === 0) {
      toast.info("Selecione pelo menos um participante.");
      return;
    }
    setModal({ open: true, turmaId, usuarioIds: Array.from(setSel) });
  }

  async function efetivarCancelamento() {
    const { turmaId, usuarioIds } = modal;
    if (!turmaId || !usuarioIds.length) { setModal({ open: false, turmaId: null, usuarioIds: [] }); return; }

    // otimista
    setInscritosPorTurma((prev) => {
      const atuais = prev[turmaId] || [];
      const rest = atuais.filter((u) => !usuarioIds.includes(u.usuario_id));
      return { ...prev, [turmaId]: rest };
    });
    setSelecionados((prev) => ({ ...prev, [turmaId]: new Set() }));
    setModal({ open: false, turmaId: null, usuarioIds: [] });
    setLive(`Cancelando ${usuarioIds.length} inscrição(ões)…`);

    try {
      for (const uid of usuarioIds) {
        await apiDelete(`/api/inscricoes/${turmaId}/usuario/${uid}`);
      }
      toast.success(
        usuarioIds.length > 1 ? "Inscrições canceladas." : "Inscrição cancelada."
      );
      setLive("Cancelamento concluído.");
    } catch (e) {
      await carregarInscritos(turmaId); // rollback com recarregamento
      const msg = e?.response?.data?.erro || e?.message || "Erro ao cancelar inscrição.";
      toast.error(msg);
      setLive("Falha ao cancelar. Lista recarregada.");
    }
  }

  // contadores
  const totalEventos = eventosFiltrados.length;
  const totalTurmas = useMemo(
    () => Object.values(turmasPorEvento).reduce((acc, list) => acc + (list?.length || 0), 0),
    [turmasPorEvento]
  );

  const anyLoading =
    loadingEventos ||
    Object.values(loadingTurmas).some(Boolean) ||
    Object.values(loadingInscritos).some(Boolean);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* HeaderHero */}
      <HeaderHero
        totalEventos={totalEventos}
        totalTurmas={totalTurmas}
        onSearch={setBusca}
        searchValue={busca}
      />

      {/* barra de progresso fina */}
      {anyLoading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-emerald-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
        >
          <div className="h-full bg-emerald-700 animate-pulse w-1/3" />
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow ring-1 ring-black/5 overflow-hidden">
          {/* Lista de eventos */}
          {loadingEventos ? (
            <div className="p-6 flex items-center justify-center">
              <Spinner />
            </div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Nenhum evento encontrado {busca ? "para o filtro aplicado." : "no momento."}
              </p>
            </div>
          ) : (
            eventosFiltrados.map((ev) => {
              const aberto = !!abertoEvento[ev.id];
              const turmas = turmasPorEvento[ev.id] || [];
              const carregandoTurmas = !!loadingTurmas[ev.id];

              return (
                <div key={ev.id} className="border-b border-gray-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => toggleEvento(ev.id)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-emerald-50/60 dark:hover:bg-zinc-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    aria-expanded={aberto}
                    aria-controls={`evento-${ev.id}-conteudo`}
                  >
                    {aberto ? <ChevronDown className="mt-0.5" /> : <ChevronRight className="mt-0.5" />}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{ev.titulo || `Evento #${ev.id}`}</div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-900">
                          {turmas?.length || 0} turmas
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{ev.local || "Local a definir"}</span>
                        <span className="mx-1">•</span>
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Carga horária: {ev.carga_horaria_total ?? ev.carga_horaria ?? "—"}</span>
                      </div>
                    </div>
                  </button>

                  {/* Turmas */}
                  {aberto && (
                    <div id={`evento-${ev.id}-conteudo`} className="bg-gray-50/70 dark:bg-zinc-900/40">
                      {carregandoTurmas ? (
                        <div className="p-4 pl-10"><Spinner pequeno /></div>
                      ) : turmas.length === 0 ? (
                        <div className="p-4 pl-10 text-sm text-gray-600 dark:text-gray-300">Nenhuma turma para este evento.</div>
                      ) : (
                        turmas.map((t) => {
                          const aberta = !!abertaTurma[t.id];
                          const inscritos = inscritosPorTurma[t.id] || [];
                          const carregandoInscritos = !!loadingInscritos[t.id];
                          const setSel = selecionados[t.id] || new Set();
                          const allSelected = inscritos.length > 0 && setSel.size === inscritos.length;

                          return (
                            <div key={t.id} className="border-t border-gray-100 dark:border-zinc-800">
                              <button
                                type="button"
                                onClick={() => toggleTurma(t.id)}
                                className="w-full flex items-center gap-3 p-3 pl-10 text-left hover:bg-white dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                aria-expanded={aberta}
                                aria-controls={`turma-${t.id}-conteudo`}
                              >
                                {aberta ? <ChevronDown className="mt-0.5" /> : <ChevronRight className="mt-0.5" />}
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="font-medium">
                                      {t.nome || `Turma #${t.id}`}{" "}
                                      <span className="text-xs text-gray-500">({t.carga_horaria ?? "—"}h)</span>
                                    </div>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-zinc-700">
                                      {inscritos?.length || 0} inscritos
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-300">
                                    {t.data_inicio
                                      ? `Início: ${t.data_inicio} ${t.horario_inicio ? `às ${String(t.horario_inicio).slice(0,5)}` : ""}`
                                      : "Datas a definir"}
                                  </div>
                                </div>
                              </button>

                              {/* Toolbar da turma */}
                              {aberta && (
                                <div className="px-3 sm:px-4 pl-14 pb-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => (allSelected ? limparSelecao(t.id) : selecionarTodos(t.id))}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                    aria-label={allSelected ? "Limpar seleção" : "Selecionar todos os inscritos"}
                                  >
                                    {allSelected ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => confirmarCancelarLote(t.id)}
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                    disabled={setSel.size === 0}
                                    aria-disabled={setSel.size === 0}
                                  >
                                    <XCircle className="w-4 h-4" />
                                    Cancelar selecionados ({setSel.size})
                                  </button>
                                </div>
                              )}

                              {/* Inscritos */}
                              {aberta && (
                                <div id={`turma-${t.id}-conteudo`} className="p-3 sm:p-4 pl-14">
                                  {carregandoInscritos ? (
                                    <div className="p-3"><Spinner pequeno /></div>
                                  ) : inscritos.length === 0 ? (
                                    <div className="text-sm text-gray-600 dark:text-gray-300">Nenhum inscrito nesta turma.</div>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead className="bg-gray-100 dark:bg-zinc-800">
                                          <tr className="text-left">
                                            <th className="px-3 py-2 font-medium w-10">
                                              <span className="sr-only">Selecionar</span>
                                            </th>
                                            <th className="px-3 py-2 font-medium"><Users className="inline w-4 h-4 mr-1" /> Nome</th>
                                            <th className="px-3 py-2 font-medium">CPF</th>
                                            <th className="px-3 py-2 font-medium">Presente hoje</th>
                                            <th className="px-3 py-2 font-medium text-right">Ações</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {inscritos.map((u) => {
                                            const marcado = setSel.has(u.usuario_id);
                                            return (
                                              <tr key={u.usuario_id} className="border-t border-gray-200 dark:border-zinc-800">
                                                <td className="px-3 py-2 align-middle">
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleSelecionado(t.id, u.usuario_id)}
                                                    aria-pressed={marcado}
                                                    className="inline-flex items-center justify-center w-6 h-6 rounded border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                                    title={marcado ? "Remover da seleção" : "Selecionar para cancelamento"}
                                                  >
                                                    {marcado ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                                  </button>
                                                </td>
                                                <td className="px-3 py-2">{u.nome}</td>
                                                <td className="px-3 py-2">{u.cpf}</td>
                                                <td className="px-3 py-2">
                                                  {u.presente ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700">● Sim</span>
                                                  ) : (
                                                    <span className="inline-flex items-center gap-1 text-gray-500">○ Não</span>
                                                  )}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <div className="flex justify-end">
                                                    <button
                                                      type="button"
                                                      onClick={() => confirmarCancelarIndividual(t.id, u.usuario_id)}
                                                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white"
                                                      title="Cancelar inscrição"
                                                    >
                                                      <XCircle size={16} />
                                                      Cancelar
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>

      <ConfirmModal
        open={modal.open}
        title={modal.usuarioIds.length > 1 ? "Cancelar inscrições selecionadas" : "Cancelar inscrição"}
        message={
          modal.usuarioIds.length > 1
            ? `Você está prestes a cancelar ${modal.usuarioIds.length} inscrição(ões). Deseja continuar?`
            : "Você está prestes a cancelar esta inscrição. Deseja continuar?"
        }
        onCancel={() => setModal({ open: false, turmaId: null, usuarioIds: [] })}
        onConfirm={efetivarCancelamento}
        confirmLabel="Confirmar cancelamento"
        danger
      />

      <Footer />
    </div>
  );
}
