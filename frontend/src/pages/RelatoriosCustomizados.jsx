// ✅ src/pages/RelatoriosCustomizados.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { saveAs } from "file-saver";
import { BarChart3, RefreshCcw } from "lucide-react";

import { apiGet, apiPostFile } from "../services/api";
import Select from "../components/Select";
import DateRangePicker from "../components/DateRangePicker";
import RelatoriosTabela from "../components/RelatoriosTabela";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";

/* ---------------- HeaderHero (novo) ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header className="bg-gradient-to-br from-amber-900 via-amber-700 to-yellow-600 text-white" role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Relatórios Customizados
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Gere listagens e exporte em PDF/Excel filtrando por evento, instrutor, unidade e período.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
            ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
          aria-label="Atualizar opções e dados"
        >
          <RefreshCcw className="w-4 h-4" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

/* =======================
   Helpers de data (anti-UTC)
   ======================= */

// parse "YYYY-MM-DD" em Date local (sem fuso)
function parseLocalYMD(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(NaN);
  const y = +m[1], mo = +m[2], d = +m[3];
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

// formata Date -> "YYYY-MM-DDTHH:mm:ss" (sem Z)
function toLocalNaiveISO(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

function startOfDayLocalISO(dateLike) {
  const dt = dateLike instanceof Date ? new Date(dateLike) : parseLocalYMD(dateLike);
  dt.setHours(0, 0, 0, 0);
  return toLocalNaiveISO(dt);
}

function endOfDayLocalISO(dateLike) {
  const dt = dateLike instanceof Date ? new Date(dateLike) : parseLocalYMD(dateLike);
  dt.setHours(23, 59, 59, 999);
  dt.setMilliseconds(0); // arredonda pra segundo cheio
  return toLocalNaiveISO(dt);
}

export default function RelatoriosCustomizados() {
  const perfilRaw = (localStorage.getItem("perfil") || "").toLowerCase();
  const usuarioObj = (() => {
    try { return JSON.parse(localStorage.getItem("usuario") || "{}"); }
    catch { return {}; }
  })();
  const usuarioId = usuarioObj?.id ?? null;

  const [filtros, setFiltros] = useState({
    eventoId: "",
    instrutorId: "",
    unidadeId: "",
    periodo: ["", ""], // [inicio(YYYY-MM-DD), fim(YYYY-MM-DD)]
  });

  const [opcoes, setOpcoes] = useState({ eventos: [], instrutor: [], unidades: [] });
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);

  // live region para leitores de tela
  const liveRef = useRef(null);
  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  const podeAutoFiltrarInstrutor = useMemo(
    () => perfilRaw.includes("instrutor") || perfilRaw.includes("administrador"),
    [perfilRaw]
  );

  // Carrega opções (eventos/instrutor/unidades)
  async function carregarOpcoes() {
    try {
      setErroCarregamento(false);
      setLive("Carregando filtros de relatório…");
      const data = await apiGet("/api/relatorios/opcoes", { on403: "silent" });

      setOpcoes({
        eventos: (data?.eventos || []).map((e) => ({ value: String(e.id), label: e.titulo || e.nome || "Sem título" })),
        instrutor: (data?.instrutor || []).map((i) => ({ value: String(i.id), label: i.nome })),
        unidades: (data?.unidades || []).map((u) => ({ value: String(u.id), label: u.nome })),
      });

      if (podeAutoFiltrarInstrutor && usuarioId) {
        setFiltros((f) => ({ ...f, instrutorId: String(usuarioId) }));
      }
      setLive("Filtros atualizados.");
    } catch {
      setErroCarregamento(true);
      setLive("Falha ao carregar filtros de relatório.");
      toast.error("Erro ao carregar filtros.");
    }
  }

  useEffect(() => {
    carregarOpcoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeAutoFiltrarInstrutor, usuarioId]);

  const validarPeriodo = () => {
    const [ini, fim] = filtros.periodo || [];
    if ((ini && !fim) || (!ini && fim)) {
      toast.warning("Informe as duas datas do período.");
      return false;
    }
    if (ini && fim) {
      const dIni = parseLocalYMD(ini);
      const dFim = parseLocalYMD(fim);
      if (Number.isNaN(dIni.getTime()) || Number.isNaN(dFim.getTime())) {
        toast.warning("Período inválido.");
        return false;
      }
      if (dIni > dFim) {
        toast.warning("Data inicial não pode ser maior que a final.");
        return false;
      }
    }
    return true;
  };

  const buscar = async () => {
    if (!validarPeriodo()) return;

    const qs = new URLSearchParams();
    if (filtros.eventoId) qs.append("evento", filtros.eventoId);
    if (filtros.instrutorId) qs.append("instrutor", filtros.instrutorId);
    if (filtros.unidadeId) qs.append("unidade", filtros.unidadeId);

    const [ini, fim] = filtros.periodo;
    if (ini && fim) {
      qs.append("from", startOfDayLocalISO(ini));
      qs.append("to", endOfDayLocalISO(fim));
    }

    setCarregando(true);
    setLive("Buscando dados do relatório…");
    try {
      const res = await apiGet(`/api/relatorios?${qs.toString()}`, { on403: "silent" });
      setDados(Array.isArray(res) ? res : []);
      setLive(`Busca concluída. ${Array.isArray(res) ? res.length : 0} registro(s).`);
    } catch {
      toast.error("❌ Não foi possível gerar relatório.");
      setDados([]);
      setLive("Falha ao gerar relatório.");
    } finally {
      setCarregando(false);
    }
  };

  const exportar = async (tipo) => {
    if (!dados.length) return toast.info("Sem dados para exportar.");
    if (!["pdf", "excel"].includes(tipo)) return toast.error("Formato inválido.");
    if (!validarPeriodo()) return;

    const payload = {
      filtros: {
        eventoId: filtros.eventoId || null,
        instrutorId: filtros.instrutorId || null,
        unidadeId: filtros.unidadeId || null,
        periodo:
          filtros.periodo[0] && filtros.periodo[1]
            ? [startOfDayLocalISO(filtros.periodo[0]), endOfDayLocalISO(filtros.periodo[1])]
            : null,
      },
      formato: tipo,
    };

    try {
      setLive(`Exportando ${tipo === "pdf" ? "PDF" : "Excel"}…`);
      const { blob, filename } = await apiPostFile("/api/relatorios/exportar", payload, { on403: "silent" });
      const ext = tipo === "pdf" ? "pdf" : "xlsx";
      saveAs(blob, filename || `relatorio_custom.${ext}`);
      setLive("Exportação concluída.");
    } catch {
      toast.error("Falha no download.");
      setLive("Falha ao exportar.");
    }
  };

  const limparFiltros = () => {
    setFiltros({
      eventoId: "",
      instrutorId: podeAutoFiltrarInstrutor && usuarioId ? String(usuarioId) : "",
      unidadeId: "",
      periodo: ["", ""],
    });
    setDados([]);
    setLive("Filtros limpos.");
  };

  const totalRegistros = dados?.length || 0;

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟨 HeaderHero para Relatórios */}
      <HeaderHero onRefresh={carregarOpcoes} carregando={carregando} />

      {/* barra de progresso fina no topo */}
      {carregando && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-amber-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando relatório"
        >
          <div className="h-full bg-amber-700 animate-pulse w-1/3" />
        </div>
      )}

      <main role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-6xl mx-auto">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {erroCarregamento ? (
          <ErroCarregamento mensagem="Falha ao carregar os filtros disponíveis." />
        ) : (
          <>
            {/* 🔎 Filtros */}
            <section aria-labelledby="filtros-heading" className="mt-1">
              <h2 id="filtros-heading" className="sr-only">Filtros do relatório</h2>

              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select
                    label="Evento"
                    options={opcoes.eventos}
                    value={filtros.eventoId}
                    onChange={(v) => setFiltros((f) => ({ ...f, eventoId: v }))}
                    placeholder="Selecione..."
                  />
                  <Select
                    label="Instrutor"
                    options={opcoes.instrutor}
                    value={filtros.instrutorId}
                    onChange={(v) => setFiltros((f) => ({ ...f, instrutorId: v }))}
                    placeholder="Selecione..."
                  />
                  <Select
                    label="Unidade"
                    options={opcoes.unidades}
                    value={filtros.unidadeId}
                    onChange={(v) => setFiltros((f) => ({ ...f, unidadeId: v }))}
                    placeholder="Selecione..."
                  />
                  <DateRangePicker
                    label="Período"
                    value={filtros.periodo}
                    onChange={(r) => setFiltros((f) => ({ ...f, periodo: r }))}
                  />
                </div>

                <div className="flex flex-wrap gap-3 mt-4 items-center">
                  <button
                    onClick={buscar}
                    disabled={carregando}
                    aria-busy={carregando ? "true" : "false"}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 transition ${
                      carregando ? "opacity-80 cursor-not-allowed" : ""
                    }`}
                    aria-label="Buscar relatórios"
                  >
                    🔎 {carregando ? "Buscando..." : "Buscar"}
                  </button>

                  <button
                    onClick={() => exportar("pdf")}
                    disabled={!dados.length || carregando}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold border border-amber-700 text-amber-800 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 transition ${
                      !dados.length || carregando ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    aria-label="Exportar relatório em PDF"
                  >
                    📄 Exportar PDF
                  </button>

                  <button
                    onClick={() => exportar("excel")}
                    disabled={!dados.length || carregando}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold border border-amber-700 text-amber-800 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700 transition ${
                      !dados.length || carregando ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    aria-label="Exportar relatório em Excel"
                  >
                    📊 Exportar Excel
                  </button>

                  <button
                    onClick={limparFiltros}
                    disabled={carregando}
                    className="ml-auto inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 transition"
                    aria-label="Limpar filtros"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            </section>

            {/* KPIs rápidos */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">Registros</p>
                <p className="text-2xl font-bold">{totalRegistros}</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">Evento</p>
                <p className="text-sm font-semibold truncate">
                  {opcoes.eventos.find((o) => o.value === filtros.eventoId)?.label || "—"}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">Período</p>
                <p className="text-sm font-semibold">
                  {filtros.periodo?.[0] && filtros.periodo?.[1]
                    ? `${filtros.periodo[0]} — ${filtros.periodo[1]}`
                    : "—"}
                </p>
              </div>
            </section>

            {/* 📈 Resultado */}
            <section aria-labelledby="resultado-heading" className="mt-2">
              <h2 id="resultado-heading" className="sr-only">Resultados do relatório</h2>

              {carregando ? (
                <CarregandoSkeleton height="220px" />
              ) : (
                <>
                  {dados?.length ? (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2" aria-live="polite">
                      {dados.length} registro{dados.length > 1 ? "s" : ""} encontrado{dados.length > 1 ? "s" : ""}.
                    </p>
                  ) : null}

                  <RelatoriosTabela
                    data={dados}
                    hiddenKeys={[
                      "evento_id", "eventoId",
                      "instrutor_id", "instrutorId",
                      "turma_id", "turmaId",
                    ]}
                  />
                </>
              )}
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
