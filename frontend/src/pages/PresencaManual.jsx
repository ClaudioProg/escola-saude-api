// ✅ src/pages/PresencaManual.jsx (refactor com hero, ministats, busca e a11y)
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { CheckSquare, RefreshCw, Search } from "lucide-react";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";
import { formatarCPF } from "../utils/data";

/* ───────────────── helpers anti-UTC ───────────────── */
const hojeLocalISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/* ───────────────── sessão: valida token com JWT URL-safe ───────────────── */
function getValidToken() {
  try {
    const raw = localStorage.getItem("token");
    if (!raw) return null;
    const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : raw;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(b64 + pad));
    const now = Date.now() / 1000;
    if (payload?.nbf && now < payload.nbf) return null;
    if (payload?.exp && now >= payload.exp) return null;
    return token;
  } catch {
    return null;
  }
}

/* ───────────────── HeaderHero padronizado (degradê 3 cores) ───────────────── */
function HeaderHero({ turmaId, hojeISO, onRefresh }) {
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-amber-900 via-orange-800 to-rose-700 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px] text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <CheckSquare className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Presença Manual</h1>
        </div>
        <p className="text-sm sm:text-base text-white/90">
          Marque presenças do dia na turma selecionada. A operação é idempotente e registrada.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Turma</span> #{turmaId || "—"}
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Data</span> {hojeISO}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/25 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Atualizar lista de inscritos"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

export default function PresencaManual() {
  const [params] = useSearchParams();
  const turmaId = params.get("turma");
  const navigate = useNavigate();
  const location = useLocation();

  // estado
  const [inscritos, setInscritos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [marcando, setMarcando] = useState(null); // usuario_id em processamento
  const liveRef = useRef(null);

  const hojeISO = useMemo(() => hojeLocalISO(), []);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // gate de sessão: redireciona de forma consistente (usa ?redirect=)
  useEffect(() => {
    if (!getValidToken()) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // carregar inscritos
  const carregarInscritos = async () => {
    if (!turmaId || Number.isNaN(Number(turmaId))) {
      setErro("Turma inválida.");
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando inscritos…");
      const data = await apiGet(`/api/turmas/${turmaId}/inscritos`);
      setInscritos(Array.isArray(data) ? data : []);
      setLive("Inscritos carregados.");
    } catch (e) {
      console.error(e);
      toast.error("❌ Erro ao carregar inscritos.");
      setErro("Erro ao carregar inscritos.");
      setInscritos([]);
      setLive("Falha ao carregar inscritos.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarInscritos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  // filtro local por nome/CPF
  const normaliza = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const filtrados = useMemo(() => {
    const q = normaliza(busca);
    if (!q) return inscritos;
    return inscritos.filter((i) => {
      const nome = normaliza(i.nome);
      const cpf = String(i.cpf || "");
      return nome.includes(q) || cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
    });
  }, [inscritos, busca]);

  // mini-stats (do dia)
  const stats = useMemo(() => {
    const total = filtrados.length;
    let presentes = 0;
    filtrados.forEach((i) => {
      const presencas = Array.isArray(i.data_presenca) ? i.data_presenca : [];
      if (presencas.includes(hojeISO)) presentes += 1;
    });
    return {
      total,
      presentes,
      ausentes: Math.max(0, total - presentes),
    };
  }, [filtrados, hojeISO]);

  // ação: registrar presença
  const registrarPresenca = async (usuario_id) => {
    setMarcando(usuario_id);
    try {
      await apiPost(`/api/presencas/confirmar-simples`, {
        turma_id: Number(turmaId),
        usuario_id,
        data: hojeISO, // backend espera 'data' (sem fuso)
      });

      toast.success("✅ Presença registrada.");

      // atualização otimista
      setInscritos((prev) =>
        prev.map((i) => {
          if (i.usuario_id !== usuario_id) return i;
          const lista = Array.isArray(i.data_presenca) ? i.data_presenca : [];
          if (lista.includes(hojeISO)) return i;
          return { ...i, data_presenca: [...lista, hojeISO] };
        })
      );
      setLive("Presença registrada.");
    } catch (e) {
      console.error(e);
      toast.warning("⚠️ Presença já registrada ou erro no servidor.");
      setLive("Falha ao registrar presença.");
    } finally {
      setMarcando(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero turmaId={turmaId} hojeISO={hojeISO} onRefresh={carregarInscritos} />

      <main role="main" className="flex-1 px-3 sm:px-4 py-6">
        {/* live region de feedback */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="max-w-4xl mx-auto">
          {/* busca + mini-stats (responsivo) */}
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou CPF…"
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  aria-label="Buscar por nome ou CPF"
                />
              </div>

              <button
                type="button"
                onClick={carregarInscritos}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                aria-label="Atualizar lista de inscritos"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" /> Atualizar
              </button>
            </div>

            {/* ministats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 text-center">
                <div className="text-[11px] text-slate-500 dark:text-slate-300">Total</div>
                <div className="text-lg font-semibold">{stats.total}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800 p-3 text-center">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Presentes hoje</div>
                <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                  {stats.presentes}
                </div>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/60 dark:border-rose-800 p-3 text-center">
                <div className="text-[11px] text-rose-700 dark:text-rose-300">Ausentes hoje</div>
                <div className="text-lg font-semibold text-rose-800 dark:text-rose-200">
                  {stats.ausentes}
                </div>
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="mt-5">
            {carregando ? (
              <CarregandoSkeleton linhas={5} />
            ) : erro ? (
              <ErroCarregamento mensagem={erro} />
            ) : (
              <section aria-label={`Lista de inscritos da turma ${turmaId || ""}`}>
                <ul className="space-y-2">
                  {filtrados.map((inscrito) => {
                    const presencas = Array.isArray(inscrito.data_presenca)
                      ? inscrito.data_presenca
                      : [];
                    const presenteHoje = presencas.includes(hojeISO);

                    return (
                      <li
                        key={inscrito.usuario_id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border p-3 rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {inscrito.nome}{" "}
                            {inscrito.cpf ? `(${formatarCPF(inscrito.cpf)})` : ""}
                          </p>
                          <p
                            className={`text-sm ${
                              presenteHoje
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            {presenteHoje ? "✅ Presente hoje" : "❌ Ausente hoje"}
                          </p>
                        </div>

                        <div className="shrink-0">
                          <button
                            onClick={() => registrarPresenca(inscrito.usuario_id)}
                            className={`text-sm px-3 py-1.5 rounded transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 ${
                              presenteHoje
                                ? "bg-slate-300 text-slate-700 dark:bg-zinc-700 dark:text-white cursor-not-allowed"
                                : "bg-amber-700 hover:bg-amber-800 text-white"
                            }`}
                            aria-label={`Marcar presença para ${inscrito.nome}`}
                            disabled={presenteHoje || marcando === inscrito.usuario_id}
                          >
                            {marcando === inscrito.usuario_id
                              ? "Registrando…"
                              : presenteHoje
                              ? "✔️ Registrado"
                              : "Marcar Presença"}
                          </button>
                        </div>
                      </li>
                    );
                  })}

                  {!filtrados.length && (
                    <li className="text-sm text-slate-600 dark:text-slate-300 text-center py-6">
                      {busca
                        ? "Nenhum inscrito corresponde à busca."
                        : "Nenhum inscrito encontrado."}
                    </li>
                  )}
                </ul>
              </section>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
