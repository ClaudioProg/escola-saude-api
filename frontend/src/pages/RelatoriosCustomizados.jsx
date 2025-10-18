// ✅ src/pages/RelatoriosCustomizados.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { saveAs } from "file-saver";
import {
  BarChart3,
  RefreshCcw,
  Download,
  FileSpreadsheet,
  Search,
  X,
  Info,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";

import { apiGet, apiPostFile } from "../services/api";
import Select from "../components/Select";
import DateRangePicker from "../components/DateRangePicker";
import RelatoriosTabela from "../components/RelatoriosTabela";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import Footer from "../components/Footer";

/* ---------------- HeaderHero (paleta exclusiva) ---------------- */
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header
      className="bg-gradient-to-br from-slate-900 via-purple-800 to-pink-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <BarChart3 className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Relatórios Customizados
          </h1>
        </div>
        <p className="text-sm text-white/90 max-w-3xl">
          Explore relatórios de participação, frequência, avaliações, certificados, rankings e
          indicadores por curso/instrutor/unidade. Exporte para PDF/Excel.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={carregando}
          className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 w-full sm:w-auto
            ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
          aria-label="Atualizar opções e dados"
        >
          <RefreshCcw className="w-4 h-4" aria-hidden="true" />
          {carregando ? "Atualizando…" : "Atualizar filtros"}
        </button>
      </div>
    </header>
  );
}

/* ======================= Helpers de data (anti-UTC) ======================= */
function parseLocalYMD(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(NaN);
  const y = +m[1], mo = +m[2], d = +m[3];
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}
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
  dt.setMilliseconds(0);
  return toLocalNaiveISO(dt);
}

/* ======================= Metadata dos relatórios ======================= */
const REPORTS = [
  { key: "participacoes_usuario", label: "Cursos por usuário", hint: "Lista os cursos que cada usuário participou, com presenças/faltas e status de avaliação/certificado." },
  { key: "frequencia_detalhada", label: "Frequência detalhada", hint: "Mostra presenças e faltas por encontro, por turma/curso." },
  { key: "avaliacoes", label: "Avaliações", hint: "Verifica se já avaliaram, notas médias por usuário e por curso." },
  { key: "certificados", label: "Certificados", hint: "Certificados gerados, pendentes e datas de emissão." },
  { key: "por_curso", label: "Inscritos e presentes (curso)", hint: "Seleciona um curso/turma e vê inscritos vs participantes, presenças e certificados." },
  { key: "ranking_presencas", label: "Ranking: mais presentes", hint: "Usuários com maior participação em eventos." },
  { key: "ranking_faltas", label: "Ranking: mais faltas", hint: "Usuários com maior índice de faltas." },
  { key: "notas_instrutores", label: "Notas por instrutor", hint: "Média de avaliação por instrutor, NPS/nota e contagem." },
];

/* ======================= Página ======================= */
export default function RelatoriosCustomizados() {
  const reduceMotion = useReducedMotion();

  // contexto do usuário
  const perfilRaw = (localStorage.getItem("perfil") || "").toLowerCase();
  const usuarioObj = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  })();
  const usuarioId = usuarioObj?.id ?? null;

  // filtros persistidos
  const loadPersisted = () => {
    try {
      const raw = localStorage.getItem("relatorios:filtros");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const persisted = loadPersisted();

  const [reportKey, setReportKey] = useState(
    persisted?.reportKey && REPORTS.some((r) => r.key === persisted.reportKey)
      ? persisted.reportKey
      : REPORTS[0].key
  );

  const [filtros, setFiltros] = useState({
    eventoId: persisted?.eventoId || "",
    instrutorId:
      persisted?.instrutorId ||
      ((perfilRaw.includes("instrutor") || perfilRaw.includes("administrador")) && usuarioId
        ? String(usuarioId)
        : ""),
    unidadeId: persisted?.unidadeId || "",
    turmaId: persisted?.turmaId || "",
    periodo: persisted?.periodo || ["", ""], // [YYYY-MM-DD, YYYY-MM-DD]
    busca: persisted?.busca || "",
  });

  const [buscaValue, setBuscaValue] = useState(filtros.busca || "");
  const [buscaDebounced, setBuscaDebounced] = useState(filtros.busca || "");

  const [opcoes, setOpcoes] = useState({
    eventos: [],
    turmas: [],
    instrutor: [],
    unidades: [],
  });

  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroCarregamento, setErroCarregamento] = useState(false);
  const [exportando, setExportando] = useState(false);

  // paginação simples (client-side)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // a11y
  const liveRef = useRef(null);
  const searchRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // persistência leve
  useEffect(() => {
    const toSave = { ...filtros, reportKey };
    try {
      localStorage.setItem("relatorios:filtros", JSON.stringify(toSave));
    } catch {}
  }, [filtros, reportKey]);

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaDebounced(buscaValue.trim().toLowerCase());
      setFiltros((f) => ({ ...f, busca: buscaValue.trim() }));
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [buscaValue]);

  /* --------- Carregar opções (eventos, turmas, instrutor, unidades) --------- */
  const carregarOpcoes = useCallback(async () => {
    try {
      setErroCarregamento(false);
      setLive("Carregando filtros de relatório…");
      const data = await apiGet("relatorios/opcoes", { on403: "silent" });

      const eventos = (data?.eventos || []).map((e) => ({
        value: String(e.id),
        label: e.titulo || e.nome || "Sem título",
      }));
      const instrutor = (data?.instrutor || []).map((i) => ({
        value: String(i.id),
        label: i.nome,
      }));
      const unidades = (data?.unidades || []).map((u) => ({
        value: String(u.id),
        label: u.nome,
      }));

      // turmas podem depender do evento selecionado
      let turmas = [];
      if (filtros.eventoId) {
        try {
          const ts = await apiGet(`turmas/evento/${filtros.eventoId}`, { on403: "silent" });
          turmas = (Array.isArray(ts) ? ts : []).map((t) => ({
            value: String(t.id),
            label: t.nome || `Turma #${t.id}`,
          }));
        } catch {
          turmas = [];
        }
      }

      setOpcoes({ eventos, instrutor, unidades, turmas });

      setLive("Filtros atualizados.");
    } catch {
      setErroCarregamento(true);
      setLive("Falha ao carregar filtros de relatório.");
      toast.error("Erro ao carregar filtros.");
    }
  }, [filtros.eventoId]);

  useEffect(() => {
    carregarOpcoes();
  }, [carregarOpcoes]);

  // recarrega turmas ao mudar evento
  useEffect(() => {
    (async () => {
      if (!filtros.eventoId) {
        setOpcoes((o) => ({ ...o, turmas: [] }));
        setFiltros((f) => ({ ...f, turmaId: "" }));
        return;
      }
      try {
        const ts = await apiGet(`turmas/evento/${filtros.eventoId}`, { on403: "silent" });
        const turmas = (Array.isArray(ts) ? ts : []).map((t) => ({
          value: String(t.id),
          label: t.nome || `Turma #${t.id}`,
        }));
        setOpcoes((o) => ({ ...o, turmas }));
        // preserve turmaId se existir na nova lista; senão limpa
        if (!turmas.some((t) => t.value === filtros.turmaId)) {
          setFiltros((f) => ({ ...f, turmaId: "" }));
        }
      } catch {
        setOpcoes((o) => ({ ...o, turmas: [] }));
        setFiltros((f) => ({ ...f, turmaId: "" }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.eventoId]);

  /* -------------------- Valida período -------------------- */
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

  /* -------------------- Buscar dados -------------------- */
  const buscar = async () => {
    if (!validarPeriodo()) return;
    setPage(1);

    const qs = new URLSearchParams();
    qs.append("tipo", reportKey);
    if (filtros.eventoId) qs.append("evento", filtros.eventoId);
    if (filtros.turmaId) qs.append("turma", filtros.turmaId);
    if (filtros.instrutorId) qs.append("instrutor", filtros.instrutorId);
    if (filtros.unidadeId) qs.append("unidade", filtros.unidadeId);
    if (filtros.busca) qs.append("q", filtros.busca);

    const [ini, fim] = filtros.periodo;
    if (ini && fim) {
      qs.append("from", startOfDayLocalISO(ini));
      qs.append("to", endOfDayLocalISO(fim));
    }

    setCarregando(true);
    setLive("Buscando dados do relatório…");
    try {
      const res = await apiGet(`relatorios/custom?${qs.toString()}`, { on403: "silent" });
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

  /* -------------------- Exportações -------------------- */
  const exportar = async (tipo) => {
    if (!dados.length) return toast.info("Sem dados para exportar.");
    if (!["pdf", "excel"].includes(tipo)) return toast.error("Formato inválido.");
    if (!validarPeriodo()) return;

    const payload = {
      tipo: reportKey,
      filtros: {
        eventoId: filtros.eventoId || null,
        turmaId: filtros.turmaId || null,
        instrutorId: filtros.instrutorId || null,
        unidadeId: filtros.unidadeId || null,
        q: filtros.busca || null,
        periodo:
          filtros.periodo[0] && filtros.periodo[1]
            ? [startOfDayLocalISO(filtros.periodo[0]), endOfDayLocalISO(filtros.periodo[1])]
            : null,
      },
      formato: tipo,
    };

    try {
      setExportando(true);
      setLive(`Exportando ${tipo === "pdf" ? "PDF" : "Excel"}…`);
      const { blob, filename } = await apiPostFile("relatorios/exportar", payload, {
        on403: "silent",
      });

      const stamp = new Date();
      const stampStr = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(
        stamp.getDate()
      ).padStart(2, "0")}`;
      const ext = tipo === "pdf" ? "pdf" : "xlsx";
      const fallbackName = `relatorio_${reportKey}_${stampStr}.${ext}`;

      saveAs(blob, filename || fallbackName);
      setLive("Exportação concluída.");
    } catch {
      toast.error("Falha no download.");
      setLive("Falha ao exportar.");
    } finally {
      setExportando(false);
    }
  };

  /* -------------------- Filtros & UI helpers -------------------- */
  const limparFiltros = () => {
    setFiltros({
      eventoId: "",
      turmaId: "",
      instrutorId:
        (perfilRaw.includes("instrutor") || perfilRaw.includes("administrador")) && usuarioId
          ? String(usuarioId)
          : "",
      unidadeId: "",
      periodo: ["", ""],
      busca: "",
    });
    setBuscaValue("");
    setDados([]);
    setPage(1);
    setLive("Filtros limpos.");
    // move o foco de volta para a busca para acelerar a próxima ação
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  // limpar dados ao trocar o tipo de relatório (evita confusão visual)
  useEffect(() => {
    setDados([]);
    setPage(1);
  }, [reportKey]);

  // filtro de busca client-side adicional (segurança/UX)
  const dadosFiltrados = useMemo(() => {
    if (!buscaDebounced) return dados;
    const q = buscaDebounced;
    return dados.filter((row) =>
      Object.values(row || {}).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [dados, buscaDebounced]);

  // paginação
  const totalPages = Math.max(1, Math.ceil(dadosFiltrados.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageSlice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return dadosFiltrados.slice(start, start + pageSize);
  }, [dadosFiltrados, pageSafe, pageSize]);

  // KPIs contextuais simples (exemplos genéricos)
  const kpis = useMemo(() => {
    const base = { a: 0, b: 0, c: 0, aLabel: "", bLabel: "", cLabel: "" };
    if (!dadosFiltrados.length) return base;

    switch (reportKey) {
      case "participacoes_usuario": {
        const cursosUnicos = new Set(dadosFiltrados.map((r) => r.curso_id || r.cursoId || r.curso));
        const usuariosUnicos = new Set(dadosFiltrados.map((r) => r.usuario_id || r.usuarioId || r.usuario));
        const certificados = dadosFiltrados.filter((r) => r.certificado_gerado || r.certificado === true).length;
        return { a: usuariosUnicos.size, b: cursosUnicos.size, c: certificados, aLabel: "Usuários", bLabel: "Cursos", cLabel: "Certificados" };
      }
      case "ranking_presencas":
      case "ranking_faltas": {
        const usuarios = new Set(dadosFiltrados.map((r) => r.usuario_id || r.usuarioId || r.usuario));
        return { a: usuarios.size, b: dadosFiltrados.length, c: 0, aLabel: "Usuários no ranking", bLabel: "Entradas", cLabel: "" };
      }
      case "notas_instrutores": {
        const instrutores = new Set(dadosFiltrados.map((r) => r.instrutor_id || r.instrutorId || r.instrutor));
        const media = (() => {
          const vals = dadosFiltrados.map((r) => Number(r.nota_media || r.nota || 0)).filter((n) => Number.isFinite(n));
          return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "0.0";
        })();
        return { a: instrutores.size, b: Number(media), c: dadosFiltrados.length, aLabel: "Instrutores", bLabel: "Média", cLabel: "Avaliações" };
      }
      default:
        return { a: dadosFiltrados.length, b: pageSafe, c: totalPages, aLabel: "Registros", bLabel: "Página", cLabel: "Páginas" };
    }
  }, [dadosFiltrados, reportKey, pageSafe, totalPages]);

  const reportHint = useMemo(() => REPORTS.find((r) => r.key === reportKey)?.hint || "", [reportKey]);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregarOpcoes} carregando={carregando || exportando} />

      {/* barra de progresso fina no topo */}
      {(carregando || exportando) && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-purple-200 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Processando"
          aria-busy="true"
        >
          <div
            className={`h-full bg-pink-600 w-1/3 ${reduceMotion ? "" : "animate-pulse"}`}
          />
        </div>
      )}

      <main id="conteudo" role="main" className="flex-1 px-3 sm:px-4 py-6 max-w-7xl mx-auto">
        {/* Live region acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" role="status" />

        {erroCarregamento ? (
          <div className="space-y-3">
            <ErroCarregamento mensagem="Falha ao carregar os filtros disponíveis." />
            <div className="text-center">
              <button
                onClick={carregarOpcoes}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-pink-600 text-pink-700 hover:bg-pink-50 dark:text-pink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-600 transition"
              >
                <RefreshCcw className="w-4 h-4" />
                Tentar novamente
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Abas/Chips de relatórios (scroll horizontal no mobile) */}
            <section
              aria-label="Tipo de relatório"
              className="-mx-3 px-3 mb-4 overflow-x-auto scrollbar-thin scrollbar-thumb-purple-300 dark:scrollbar-thumb-purple-700"
            >
              <div className="flex gap-2 sm:gap-3 min-w-fit">
                {REPORTS.map((r) => {
                  const active = reportKey === r.key;
                  return (
                    <button
                      key={r.key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setReportKey(r.key);
                        setPage(1);
                        setLive(`Relatório: ${r.label}`);
                      }}
                      className={`px-3 py-2 rounded-full text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500
                        ${
                          active
                            ? "bg-pink-600 text-white"
                            : "bg-white text-gray-900 hover:bg-gray-100 dark:bg-zinc-800 dark:text-white"
                        }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
              {reportHint && (
                <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5" aria-hidden="true" />
                  {reportHint}
                </p>
              )}
            </section>

            {/* Filtros */}
            <section aria-labelledby="filtros-heading" className="mt-1">
              <h2 id="filtros-heading" className="sr-only">
                Filtros do relatório
              </h2>

              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Select
                    label="Evento"
                    options={opcoes.eventos}
                    value={filtros.eventoId}
                    onChange={(v) => setFiltros((f) => ({ ...f, eventoId: v }))}
                    placeholder="Selecione..."
                  />
                  <Select
                    label="Turma"
                    options={opcoes.turmas}
                    value={filtros.turmaId}
                    onChange={(v) => setFiltros((f) => ({ ...f, turmaId: v }))}
                    placeholder="—"
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

                {/* Busca livre */}
                <div className="mt-4">
                  <label htmlFor="busca" className="sr-only">
                    Buscar nos resultados
                  </label>
                  <div className="relative">
                    <Search
                      className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-300"
                      aria-hidden="true"
                    />
                    <input
                      id="busca"
                      ref={searchRef}
                      type="search"
                      inputMode="search"
                      value={buscaValue}
                      onChange={(e) => setBuscaValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          buscar();
                        }
                      }}
                      placeholder="Buscar por nome, curso, e-mail…"
                      className="pl-8 pr-8 py-2 w-full rounded-md border border-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                      aria-label="Buscar nos resultados"
                    />
                    {!!buscaValue && (
                      <button
                        type="button"
                        onClick={() => setBuscaValue("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        aria-label="Limpar busca"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-3 mt-4 items-center">
                  <button
                    onClick={buscar}
                    disabled={carregando}
                    aria-busy={carregando ? "true" : "false"}
                    className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-600 transition ${
                      carregando ? "opacity-80 cursor-not-allowed" : ""
                    }`}
                    aria-label="Buscar relatórios"
                  >
                    🔎 {carregando ? "Buscando..." : "Buscar"}
                  </button>

                  <button
                    onClick={() => exportar("pdf")}
                    disabled={!dados.length || exportando}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-pink-600 text-pink-700 hover:bg-pink-50 dark:text-pink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-600 transition ${
                      !dados.length || exportando ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    aria-label="Exportar relatório em PDF"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>

                  <button
                    onClick={() => exportar("excel")}
                    disabled={!dados.length || exportando}
                    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-pink-600 text-pink-700 hover:bg-pink-50 dark:text-pink-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-pink-600 transition ${
                      !dados.length || exportando ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    aria-label="Exportar relatório em Excel"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Excel
                  </button>

                  <button
                    onClick={limparFiltros}
                    className="ml-auto inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-zinc-700 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 transition"
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
                <p className="text-xs text-gray-600 dark:text-gray-300">{kpis.aLabel || "A"}</p>
                <p className="text-2xl font-bold">{kpis.a}</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">{kpis.bLabel || "B"}</p>
                <p className="text-2xl font-bold">{kpis.b}</p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-300">{kpis.cLabel || "C"}</p>
                <p className="text-2xl font-bold">{kpis.c}</p>
              </div>
            </section>

            {/* Resultado */}
            <section aria-labelledby="resultado-heading" className="mt-2">
              <h2 id="resultado-heading" className="sr-only">
                Resultados do relatório
              </h2>

              {carregando ? (
                <CarregandoSkeleton height="260px" />
              ) : (
                <>
                  {/* paginação header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <p
                      className="text-sm text-gray-600 dark:text-gray-300"
                      aria-live="polite"
                    >
                      {dadosFiltrados.length} registro{dadosFiltrados.length !== 1 ? "s" : ""} •
                      mostrando {(pageSafe - 1) * pageSize + 1}–
                      {Math.min(pageSafe * pageSize, dadosFiltrados.length)}
                    </p>

                    <div className="flex items-center gap-2">
                      <label htmlFor="pageSize" className="text-xs">
                        por página:
                      </label>
                      <select
                        id="pageSize"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value) || 20);
                          setPage(1);
                        }}
                        className="border p-1 rounded dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                      >
                        {[10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={pageSafe <= 1}
                          className="px-2 py-1 rounded border text-sm dark:border-zinc-700 disabled:opacity-60"
                          aria-label="Página anterior"
                        >
                          ‹
                        </button>
                        <span className="text-sm tabular-nums">
                          {pageSafe}/{totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={pageSafe >= totalPages}
                          className="px-2 py-1 rounded border text-sm dark:border-zinc-700 disabled:opacity-60"
                          aria-label="Próxima página"
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>

                  {dadosFiltrados.length ? (
                    <RelatoriosTabela
                      data={pageSlice}
                      hiddenKeys={[
                        // ids técnicos comuns
                        "evento_id",
                        "eventoId",
                        "turma_id",
                        "turmaId",
                        "usuario_id",
                        "usuarioId",
                        "instrutor_id",
                        "instrutorId",
                        "unidade_id",
                        "unidadeId",
                      ]}
                    />
                  ) : (
                    <div className="bg-white dark:bg-zinc-800 rounded-xl shadow p-6 text-center text-sm text-gray-600 dark:text-gray-300">
                      Nenhum resultado para os filtros atuais.
                    </div>
                  )}
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

