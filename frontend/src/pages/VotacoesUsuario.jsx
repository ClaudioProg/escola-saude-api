// ✅ src/pages/VotacoesUsuario.jsx — premium (mobile-first / a11y / ministats / geo UX)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listarVotacoesElegiveis, votar } from "../services/votacoes";
import { toast } from "react-toastify";
import {
  CheckCircle2,
  Send,
  MapPin,
  RefreshCcw,
  Vote,
  AlertCircle,
  Loader2,
} from "lucide-react";
import Footer from "../components/Footer";

/* ---------------- HeaderHero (paleta exclusiva) ---------------- */
function HeaderHero({ onRefresh, loading }) {
  const gradient = "from-emerald-900 via-teal-800 to-cyan-700";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 min-h-[160px] flex items-center">
        <div className="w-full flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur">
              <Vote className="w-4 h-4" aria-hidden="true" />
              <span className="text-xs font-semibold">Votações</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Votações disponíveis
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/90 max-w-2xl">
              Selecione sua(s) opção(ões) e envie seu voto. Em algumas votações, a
              localização pode ser necessária.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
              ${loading ? "opacity-70 cursor-not-allowed bg-white/15" : "bg-white/15 hover:bg-white/25"}`}
            aria-label="Atualizar votações"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------------- UI primitives ---------------- */
function Card({ children, className = "", ...rest }) {
  return (
    <section
      className={
        "rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm " +
        className
      }
      {...rest}
    >
      {children}
    </section>
  );
}

function MiniStat({ label, value, hint }) {
  return (
    <div className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm">
      <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
      <div className="text-2xl font-semibold leading-tight">{value ?? "—"}</div>
      {hint ? <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div> : null}
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    bad: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    info: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone] ?? tones.default}`}>
      {children}
    </span>
  );
}

/* ---------------- Helpers ---------------- */
function isGeoRequired(v) {
  return Boolean(v?.geo_lat && v?.geo_lng && v?.geo_raio_m);
}

function clampArrayToggle({ current = [], id, tipo = "unica", max = 1 }) {
  const set = new Set(current);

  if (tipo === "unica") {
    return [id];
  }

  if (set.has(id)) {
    set.delete(id);
    return [...set];
  }

  if (set.size >= Number(max || 1)) {
    return current; // mantém (não estoura o max)
  }

  set.add(id);
  return [...set];
}

export default function VotacoesUsuario() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // escolhas: { [votacaoId]: opcaoId[] }
  const [escolhas, setEscolhas] = useState({});

  // envio por votação (não trava a página)
  const [sending, setSending] = useState({}); // { [vId]: true/false }

  // geolocalização
  const [coords, setCoords] = useState(null); // { lat, lng, acc? }
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | getting | ok | error
  const [geoMsg, setGeoMsg] = useState("");

  // a11y live region
  const liveRef = useRef(null);
  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const data = await listarVotacoesElegiveis();
      setLista(Array.isArray(data) ? data : data?.data || []);
      setLive("Votações carregadas.");
    } catch (e) {
      console.error(e);
      setErro("Falha ao carregar votações.");
      toast.error("Falha ao carregar votações.");
      setLive("Falha ao carregar votações.");
    } finally {
      setLoading(false);
    }
  }, [setLive]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const toggle = useCallback((vId, oId, tipo, max) => {
    setEscolhas((prev) => {
      const nextArr = clampArrayToggle({
        current: prev[vId] || [],
        id: oId,
        tipo,
        max,
      });
      return { ...prev, [vId]: nextArr };
    });
  }, []);

  const pedirLocal = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Seu navegador não suporta geolocalização.");
      setGeoStatus("error");
      setGeoMsg("Geolocalização indisponível.");
      return;
    }

    setGeoStatus("getting");
    setGeoMsg("Obtendo sua localização…");
    setLive("Obtendo sua localização…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        };
        setCoords(c);
        setGeoStatus("ok");
        setGeoMsg(`Localização ok (precisão ~${Math.round(pos.coords.accuracy)}m).`);
        setLive("Localização obtida.");
        toast.success("Localização obtida.");
      },
      (err) => {
        console.warn(err);
        setGeoStatus("error");
        setGeoMsg("Não foi possível obter sua localização.");
        setLive("Não foi possível obter sua localização.");
        toast.error("Não foi possível obter sua localização.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [setLive]);

  const enviar = useCallback(
    async (v) => {
      const selected = escolhas[v.id] || [];
      if (!selected.length) return toast.warn("Selecione ao menos uma opção.");

      const precisaLocal = isGeoRequired(v);
      if (precisaLocal && !coords) {
        toast.info("Esta votação exige localização. Toque em “Usar minha localização”.");
        return;
      }

      const payload = { opcoes: selected };
      if (coords) Object.assign(payload, { cliLat: coords.lat, cliLng: coords.lng });

      try {
        setSending((m) => ({ ...m, [v.id]: true }));
        setLive("Enviando voto…");
        await votar(v.id, payload);

        toast.success("Voto registrado!");
        setLive("Voto registrado.");
        // remove da lista
        setLista((prev) => prev.filter((x) => x.id !== v.id));
        // limpa seleção daquela votação
        setEscolhas((prev) => {
          const cp = { ...prev };
          delete cp[v.id];
          return cp;
        });
      } catch (e) {
        console.error(e);
        toast.error(e?.response?.data?.erro || e?.data?.erro || "Falha ao enviar voto.");
        setLive("Falha ao enviar voto.");
      } finally {
        setSending((m) => ({ ...m, [v.id]: false }));
      }
    },
    [coords, escolhas, setLive]
  );

  const totals = useMemo(() => {
    const totalVotacoes = lista.length;
    const totalOpcoes = lista.reduce((acc, v) => acc + (v?.opcoes?.length || 0), 0);
    const totalSelecionadas = Object.values(escolhas).reduce((acc, arr) => acc + (arr?.length || 0), 0);
    return { totalVotacoes, totalOpcoes, totalSelecionadas };
  }, [lista, escolhas]);

  // Empty / Loading
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
        <HeaderHero onRefresh={carregar} loading />
        <main id="conteudo" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 p-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm text-slate-600 dark:text-slate-300">Carregando votações…</span>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!lista.length) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
        <HeaderHero onRefresh={carregar} loading={false} />
        <main id="conteudo" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-10">
          <p ref={liveRef} className="sr-only" aria-live="polite" />
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Nenhuma votação disponível para você agora.
              </span>
            </div>
            <div className="mt-4">
              <button
                onClick={carregar}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                <RefreshCcw className="w-4 h-4" />
                Atualizar
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregar} loading={loading} />

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* erro leve */}
        {erro && (
          <div className="mb-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-3 flex items-start gap-2 text-sm text-rose-800 dark:text-rose-100">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">Ops…</p>
              <p className="text-xs mt-1">{erro}</p>
            </div>
          </div>
        )}

        {/* ministats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <MiniStat label="Votações" value={totals.totalVotacoes} hint="Disponíveis agora" />
          <MiniStat label="Opções" value={totals.totalOpcoes} hint="Somatório de alternativas" />
          <MiniStat label="Selecionadas" value={totals.totalSelecionadas} hint="Antes de enviar" />
        </section>

        {/* geolocalização status (global) */}
        <section className="mb-6">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  <h2 className="text-sm font-bold">Localização</h2>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Só é usada quando a votação exigir validação por raio (geofence).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={pedirLocal}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 hover:bg-black/5 dark:hover:bg-white/5 text-sm font-semibold"
                  disabled={geoStatus === "getting"}
                >
                  {geoStatus === "getting" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                  {coords ? "Atualizar localização" : "Usar minha localização"}
                </button>

                {coords && (
                  <Chip tone="ok">
                    ok • {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </Chip>
                )}
              </div>
            </div>

            {geoMsg && (
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                {geoStatus === "error" ? "⚠️ " : ""}{geoMsg}
              </p>
            )}
          </Card>
        </section>

        {/* lista */}
        <section className="space-y-4">
          {lista.map((v) => {
            const selected = escolhas[v.id] || [];
            const precisaLocal = isGeoRequired(v);

            const tipo = v.tipo_selecao || "unica";
            const max = Number(v.max_escolhas || 1);
            const limiteAtingido = tipo !== "unica" && selected.length >= max;

            return (
              <Card key={v.id} className="p-4 sm:p-5">
                <header className="mb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight">{v.titulo}</h2>
                      {v.descricao ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{v.descricao}</p> : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {tipo === "unica" ? <Chip tone="info">Seleção única</Chip> : <Chip tone="info">Até {max}</Chip>}
                      {precisaLocal ? <Chip tone="warn">Exige localização</Chip> : <Chip tone="ok">Sem localização</Chip>}
                      <Chip tone={selected.length ? "ok" : "default"}>{selected.length} selecionada(s)</Chip>
                    </div>
                  </div>
                </header>

                <ul className="space-y-2">
                  {(v.opcoes || []).map((o) => {
                    const active = selected.includes(o.id);

                    // desabilita opções extras quando limite atingido (mantém clicável apenas as já marcadas)
                    const disabled = !active && limiteAtingido;

                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => !disabled && toggle(v.id, o.id, tipo, max)}
                          className={[
                            "w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                            active ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-900/10" : "border-zinc-200 dark:border-zinc-700",
                            disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5",
                          ].join(" ")}
                          aria-pressed={active}
                          aria-disabled={disabled}
                        >
                          <span className="text-sm sm:text-base">{o.titulo}</span>
                          {active ? <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {/* dica / limite */}
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  {tipo === "unica" ? (
                    "Escolha 1 opção."
                  ) : (
                    <>
                      Escolha até <strong>{max}</strong> opção(ões).
                      {limiteAtingido ? " Limite atingido — desmarque uma para escolher outra." : ""}
                    </>
                  )}
                </p>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  {precisaLocal && !coords && (
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      Esta votação exige localização. Clique em <strong>“Usar minha localização”</strong>.
                    </div>
                  )}

                  <button
                    onClick={() => enviar(v)}
                    disabled={sending[v.id] || !selected.length || (precisaLocal && !coords)}
                    className={[
                      "sm:ml-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500",
                      sending[v.id] || !selected.length || (precisaLocal && !coords)
                        ? "bg-emerald-600/70 cursor-not-allowed"
                        : "bg-emerald-700 hover:bg-emerald-600",
                    ].join(" ")}
                    aria-busy={sending[v.id] ? "true" : "false"}
                    aria-label="Enviar voto"
                  >
                    {sending[v.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending[v.id] ? "Enviando…" : "Enviar voto"}
                  </button>
                </div>
              </Card>
            );
          })}
        </section>

        {/* ação rápida no final */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-semibold"
          >
            <Home className="w-4 h-4" />
            Início da página
          </button>

          <button
            onClick={carregar}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
          >
            <RefreshCcw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
