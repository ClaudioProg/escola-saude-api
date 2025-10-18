// ✅ src/pages/PresencasPorTurma.jsx (refactor com hero, ministats, busca e a11y)
import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { differenceInMinutes, isBefore } from "date-fns";

import { apiGet, apiPost } from "../services/api";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";
import Footer from "../components/Footer";
import { CheckSquare, RefreshCw, Search } from "lucide-react";

/* ───────────────── helpers anti-UTC ───────────────── */
const ymd = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
const hms = (s, fb = "00:00") => {
  const [hh, mm] = String(s || fb).split(":").map((n) => parseInt(n, 10) || 0);
  return { hh, mm };
};
const makeLocalDate = (ymdStr, hhmm = "00:00") => {
  const d = ymd(ymdStr);
  const t = hms(hhmm);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0) : new Date(NaN);
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
function HeaderHero({ turmaId, onRefresh }) {
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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Presenças por Turma</h1>
        </div>
        <p className="text-sm sm:text-base text-white/90">
          Consulte e, quando aplicável, confirme presenças manualmente até 48h após o término.
        </p>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm">
            <span className="font-semibold">Turma</span> #{turmaId || "—"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 hover:bg-white/25 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Atualizar lista de presenças"
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

export default function PresencasPorTurma() {
  const { turmaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [busca, setBusca] = useState("");
  const liveRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // gate de sessão coerente (preserva retorno)
  useEffect(() => {
    if (!getValidToken()) {
      const redirect = `${location.pathname}${location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregar = async () => {
    if (!turmaId || Number.isNaN(Number(turmaId))) {
      setErro("ID da turma inválido.");
      setCarregando(false);
      return;
    }
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando presenças…");
      const data = await apiGet(`/api/relatorio-presencas/turma/${turmaId}`);
      const lista = Array.isArray(data?.lista) ? data.lista : Array.isArray(data) ? data : [];
      setDados(lista);
      setLive("Presenças carregadas.");
    } catch (e) {
      setErro("Erro ao carregar presenças da turma.");
      toast.error("❌ Erro ao carregar presenças da turma.");
      setDados([]);
      setLive("Falha ao carregar presenças.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaId]);

  // filtro local (nome/CPF)
  const normaliza = (s) =>
    String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const filtrados = useMemo(() => {
    const q = normaliza(busca);
    if (!q) return dados;
    return dados.filter((p) => {
      const nome = normaliza(p.nome);
      const cpf = String(p.cpf || "").replace(/\D/g, "");
      const qdigits = q.replace(/\D/g, "");
      return nome.includes(q) || (qdigits && cpf.includes(qdigits));
    });
  }, [dados, busca]);

  // ministats
  const stats = useMemo(() => {
    const agora = new Date();
    let presentes = 0;
    let aguardando = 0;
    let faltas = 0;

    filtrados.forEach((p) => {
      const inicio = makeLocalDate(p.data_referencia, p.horario_inicio || "00:00");
      const fim = makeLocalDate(p.data_referencia, p.horario_fim || "23:59");
      const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
      const passou60 = differenceInMinutes(agora, inicio) > 60;

      if (p.data_presenca || p.presente) {
        presentes += 1;
      } else if (!passou60) {
        aguardando += 1;
      } else if (isBefore(agora, expiracao)) {
        faltas += 1;
      } else {
        faltas += 1; // expirado também conta como falta
      }
    });

    return {
      total: filtrados.length,
      presentes,
      aguardando,
      faltas,
    };
  }, [filtrados]);

  async function confirmarPresencaManual(usuario_id, turma_id, data_referencia) {
    try {
      setConfirmandoId(`${usuario_id}-${data_referencia}`);
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: Number(turma_id),
        usuario_id,
        data: data_referencia, // unificado
      });

      toast.success("✅ Presença confirmada!");
      setLive("Presença confirmada.");

      // update otimista
      setDados((prev) =>
        prev.map((item) =>
          item.usuario_id === usuario_id &&
          item.turma_id === turma_id &&
          item.data_referencia === data_referencia
            ? { ...item, data_presenca: data_referencia, presente: true }
            : item
        )
      );
    } catch {
      toast.error("❌ Erro ao confirmar presença.");
      setLive("Falha ao confirmar presença.");
    } finally {
      setConfirmandoId(null);
    }
  }

  function renderStatus(p) {
    const agora = new Date();
    const inicio = makeLocalDate(p.data_referencia, p.horario_inicio || "00:00");
    const fim = makeLocalDate(p.data_referencia, p.horario_fim || "23:59");
    const expiracao = new Date(fim.getTime() + 48 * 60 * 60 * 1000);
    const passou60min = differenceInMinutes(agora, inicio) > 60;

    if (p.data_presenca || p.presente) {
      return (
        <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-semibold text-xs">
          ✅ Presente
        </span>
      );
    }

    if (!passou60min) {
      return (
        <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-semibold text-xs">
          🟡 Aguardando confirmação
        </span>
      );
    }

    if (isBefore(agora, expiracao)) {
      const btnId = `${p.usuario_id}-${p.data_referencia}`;
      const loading = confirmandoId === btnId;

      return (
        <div className="flex items-center gap-2">
          <span className="bg-rose-100 text-rose-800 px-2 py-1 rounded font-semibold text-xs">
            🟥 Faltou
          </span>
          <button
            onClick={() => confirmarPresencaManual(p.usuario_id, p.turma_id, p.data_referencia)}
            className="text-xs bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700"
            disabled={loading}
            aria-label={`Confirmar presença de ${p.nome} em ${formatarDataBrasileira(
              p.data_referencia
            )}`}
          >
            {loading ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      );
    }

    return (
      <span className="bg-rose-200 text-rose-900 px-2 py-1 rounded font-semibold text-xs">
        🟥 Faltou (Expirado)
      </span>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero turmaId={turmaId} onRefresh={carregar} />

      <main role="main" className="flex-1 px-3 sm:px-4 py-6">
        {/* live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        <section className="max-w-5xl mx-auto">
          {/* busca + mini-stats */}
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
                onClick={carregar}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                aria-label="Atualizar presenças"
                title="Atualizar"
              >
                <RefreshCw className="w-4 h-4" /> Atualizar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-3 text-center">
                <div className="text-[11px] text-slate-500 dark:text-slate-300">Total</div>
                <div className="text-lg font-semibold">{stats.total}</div>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800 p-3 text-center">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Presentes</div>
                <div className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                  {stats.presentes}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800 p-3 text-center">
                <div className="text-[11px] text-amber-700 dark:text-amber-300">Aguardando</div>
                <div className="text-lg font-semibold text-amber-800 dark:text-amber-200">
                  {stats.aguardando}
                </div>
              </div>
              {/* opcionalmente trocar a terceira pelo card de faltas em telas pequenas */}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="sm:col-start-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200/60 dark:border-rose-800 p-3 text-center">
                <div className="text-[11px] text-rose-700 dark:text-rose-300">Faltas</div>
                <div className="text-lg font-semibold text-rose-800 dark:text-rose-200">
                  {stats.faltas}
                </div>
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="mt-5">
            {carregando ? (
              <CarregandoSkeleton texto="Carregando presenças..." linhas={6} />
            ) : erro ? (
              <ErroCarregamento mensagem={erro} />
            ) : (
              <section
                className="space-y-3"
                aria-label={`Lista de presenças da turma ${turmaId || ""}`}
              >
                {filtrados.map((p) => (
                  <article
                    key={`${p.usuario_id}-${p.data_referencia}`}
                    className="border border-slate-200 dark:border-zinc-700 p-4 rounded-lg bg-white dark:bg-zinc-800 shadow-sm"
                    aria-label={`Registro de ${p.nome}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-lousa dark:text-white font-semibold truncate">{p.nome}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          CPF: {formatarCPF(p.cpf)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Data: {formatarDataBrasileira(p.data_referencia)} – {p.horario_inicio} às {p.horario_fim}
                        </p>
                      </div>
                      <div className="shrink-0 mt-1 sm:mt-0">{renderStatus(p)}</div>
                    </div>
                  </article>
                ))}

                {!filtrados?.length && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 text-center py-6">
                    {busca ? "Nenhum registro corresponde à busca." : "Nenhum registro encontrado."}
                  </p>
                )}
              </section>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
