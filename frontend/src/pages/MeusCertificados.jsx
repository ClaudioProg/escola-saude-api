/* eslint-disable no-console */
// ✅ src/pages/MeusCertificados.jsx (somente PARTICIPANTE — premium + mobile-first + a11y + anti-duplicação)
// - ✅ Mantém: apenas tipo "usuario" (participante)
// - ✅ Melhora: ministats, busca, ordenação, badges de status, UX de geração/download
// - ✅ Resiliente: lida com diferentes formatos do backend (flags/nomes de campos)
// - ✅ Seguro: abort/anticorrida, bloqueio de clique duplo, live region, fallback de download

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import {
  Award,
  RefreshCw,
  Search,
  Download,
  FilePlus2,
  ShieldCheck,
  CircleCheck,
  CircleAlert,
  CalendarDays,
  Filter,
  X,
} from "lucide-react";

import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPost, makeApiUrl } from "../services/api";

/* ───────────────── Hero ───────────────── */
function HeaderHero({ onRefresh, variant = "teal", nome = "", loading = false, kpis }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
  };
  const grad = variants[variant] ?? variants.teal;

  function MiniStat({ label, value, icon: Icon, tone = "white" }) {
    const tones = {
      white: "bg-white/10 text-white",
      emerald: "bg-emerald-500/15 text-emerald-50",
      amber: "bg-amber-500/15 text-amber-50",
      sky: "bg-sky-500/15 text-sky-50",
    };
    return (
      <div className={`rounded-2xl px-3 py-2 backdrop-blur border border-white/10 ${tones[tone] || tones.white}`}>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-white/10 p-2 border border-white/10">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">{label}</div>
            <div className="text-lg font-extrabold leading-tight">{value}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`} role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Award className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Meus Certificados</h1>
        </div>

        <p className="text-sm text-white/90 max-w-2xl">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Para visualizar certificados, é necessário concluir a <strong>avaliação</strong> quando aplicável.
          Aqui você gera e baixa seus certificados como <strong>participante</strong>.
        </p>

        {/* ministats */}
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full max-w-3xl">
          <MiniStat label="Total" value={kpis?.total ?? "—"} icon={ShieldCheck} />
          <MiniStat label="Prontos" value={kpis?.prontos ?? "—"} icon={CircleCheck} tone="emerald" />
          <MiniStat label="Pendentes" value={kpis?.pendentes ?? "—"} icon={CircleAlert} tone="amber" />
          <MiniStat label="Gerando" value={kpis?.gerando ?? "—"} icon={FilePlus2} tone="sky" />
        </div>

        <div className="mt-2">
          <BotaoPrimario
            onClick={onRefresh}
            variante="secundario"
            icone={<RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}
            aria-label="Atualizar certificados"
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </BotaoPrimario>
        </div>
      </div>

      <div className="h-px w-full bg-white/20" aria-hidden="true" />
    </header>
  );
}

/* ───────────────── Util: período (date-only) ───────────────── */
function periodoSeguro(cert) {
  const iniRaw = cert?.data_inicio ?? cert?.di ?? cert?.inicio ?? cert?.turma_data_inicio;
  const fimRaw = cert?.data_fim ?? cert?.df ?? cert?.fim ?? cert?.turma_data_fim;
  const iniISO = formatarParaISO(iniRaw);
  const fimISO = formatarParaISO(fimRaw);
  const ini = iniISO ? formatarDataBrasileira(iniISO) : "—";
  const fim = fimISO ? formatarDataBrasileira(fimISO) : "—";
  return `${ini} até ${fim}`;
}

function ymdOnly(s) {
  const v = typeof s === "string" ? s.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
}

/* ───────────────── Regras de estado (resilientes) ───────────────── */
function getCertState(cert) {
  // “emitido/gerado”
  const jaGerado = Boolean(cert?.ja_gerado || cert?.emitido || cert?.gerado);
  const certId = cert?.certificado_id ?? cert?.id_certificado ?? cert?.certId ?? null;

  // “pode gerar”
  const podeGerarExplicit =
    cert?.pode_gerar ??
    cert?.elegivel ??
    cert?.liberado ??
    cert?.disponivel ??
    undefined;

  // “avaliação”
  const avaliacaoOk =
    cert?.avaliacao_realizada ??
    cert?.avaliado ??
    cert?.avaliacao_feita ??
    cert?.avaliacao_ok ??
    undefined;

  // “frequência”
  const freqOk =
    cert?.frequencia_ok ??
    cert?.presenca_ok ??
    cert?.presenca_minima_ok ??
    undefined;

  // motivo
  const motivo = String(cert?.motivo_bloqueio || cert?.motivo || cert?.mensagem || "").trim();

  // decisão final:
  // 1) se já gerado ou tem certificado_id => pronto
  if (jaGerado || certId) return { status: "pronto", motivo: "" };

  // 2) se backend informou pode_gerar false => pendente
  if (podeGerarExplicit === false) return { status: "pendente", motivo: motivo || "Ainda não liberado." };

  // 3) heurística: se houver flag de avaliação/frequência e alguma for falsa => pendente
  if (avaliacaoOk === false) return { status: "pendente", motivo: motivo || "Avaliação pendente." };
  if (freqOk === false) return { status: "pendente", motivo: motivo || "Frequência mínima não atingida." };

  // 4) padrão: pendente (mas “possivelmente gerável” se nada indicar bloqueio)
  if (podeGerarExplicit === true) return { status: "geravel", motivo: "" };

  return { status: "geravel", motivo: "" };
}

/* ───────────────── Página ───────────────── */
export default function MeusCertificados() {
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false); // trava concorrência
  const [gerandoKey, setGerandoKey] = useState(null);

  // UI
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos"); // todos | prontos | pendentes
  const [ordenacao, setOrdenacao] = useState("recentes"); // recentes | antigos | titulo

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.();
    };
  }, []);

  const usuario = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}") || {};
    } catch {
      return {};
    }
  }, []);
  const nome = usuario?.nome || "";

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const keyDoCert = useCallback((cert) => {
    const tipo = cert?.tipo ?? "usuario";
    return `${tipo}-${cert?.evento_id}-${cert?.turma_id}`;
  }, []);

  const normalizarLista = useCallback((lista) => {
    // somente participante (tipo usuario)
    const apenasParticipante = (Array.isArray(lista) ? lista : []).filter(
      (c) => (c?.tipo ?? "usuario") === "usuario"
    );

    // remove duplicatas por (tipo, evento_id, turma_id)
    const seen = new Set();
    const unicos = [];
    for (const item of apenasParticipante) {
      const k = `usuario-${item?.evento_id}-${item?.turma_id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unicos.push(item);
    }
    return unicos;
  }, []);

  const carregarCertificados = useCallback(async () => {
    try {
      abortRef.current?.abort?.();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setCarregando(true);
      setErro("");
      setLive("Carregando certificados…");

      // ✅ Endpoint elegíveis do PARTICIPANTE
      const dados = await apiGet("/certificados/elegiveis", { signal: ctrl.signal });
      const listaBruta = Array.isArray(dados) ? dados : Array.isArray(dados?.lista) ? dados.lista : [];

      const unicos = normalizarLista(listaBruta);

      if (!mountedRef.current) return;
      setCertificados(unicos);

      setLive(
        unicos.length
          ? `Foram encontrados ${unicos.length} certificado(s) elegível(is).`
          : "Nenhum certificado elegível encontrado."
      );
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      if (!mountedRef.current) return;
      setErro("Erro ao carregar certificados");
      toast.error("❌ Erro ao carregar certificados.");
      setLive("Falha ao carregar certificados.");
      setCertificados([]);
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [normalizarLista]);

  useEffect(() => {
    document.title = "Certificados | Escola da Saúde";
    carregarCertificados();
  }, [carregarCertificados]);

  async function gerarCertificado(cert) {
    if (busy) return;

    const key = keyDoCert(cert);
    setBusy(true);
    setGerandoKey(key);

    try {
      if (!usuario?.id) {
        toast.error("❌ Usuário não identificado. Faça login novamente.");
        return;
      }

      // Se o backend sinaliza bloqueio, evita gerar (UX)
      const st = getCertState(cert);
      if (st.status === "pendente") {
        toast.warn(st.motivo || "Certificado ainda não está liberado.");
        return;
      }

      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo: "usuario", // ✅ somente participante
      };

      const resultado = await apiPost("/certificados/gerar", body);

      const certificadoId =
        resultado?.certificado_id ?? resultado?.id ?? resultado?.certificado?.id ?? null;
      const arquivoPdf =
        resultado?.arquivo_pdf ?? resultado?.arquivo ?? resultado?.certificado?.arquivo_pdf ?? null;

      toast.success("🎉 Certificado gerado com sucesso!");

      // reconciliação autoritativa
      await carregarCertificados();

      // reforço otimista (caso a lista demore a refletir)
      setCertificados((prev) =>
        prev.map((c) =>
          c.evento_id === cert.evento_id && c.turma_id === cert.turma_id
            ? {
                ...c,
                ja_gerado: true,
                certificado_id: c.certificado_id ?? certificadoId ?? c.certificado_id,
                arquivo_pdf: c.arquivo_pdf ?? arquivoPdf ?? c.arquivo_pdf,
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "❌ Erro ao gerar certificado.");
    } finally {
      setGerandoKey(null);
      setBusy(false);
    }
  }

  /* ───────────────── KPIs ───────────────── */
  const kpis = useMemo(() => {
    const total = certificados.length;
    let prontos = 0;
    let pendentes = 0;
    for (const c of certificados) {
      const st = getCertState(c);
      if (st.status === "pronto") prontos++;
      else if (st.status === "pendente") pendentes++;
    }
    return {
      total: String(total),
      prontos: String(prontos),
      pendentes: String(pendentes),
      gerando: gerandoKey ? "1" : "0",
    };
  }, [certificados, gerandoKey]);

  /* ───────────────── Filtro/Busca/Ordenação ───────────────── */
  const debouncedQ = useMemo(() => String(q || "").trim().toLowerCase(), [q]);

  const certificadosFiltrados = useMemo(() => {
    const base = certificados.filter((c) => {
      const st = getCertState(c);
      if (filtro === "prontos") return st.status === "pronto";
      if (filtro === "pendentes") return st.status === "pendente";
      return true;
    });

    const searched = !debouncedQ
      ? base
      : base.filter((c) => {
          const titulo = String(c?.evento || c?.evento_titulo || c?.nome_evento || "").toLowerCase();
          const turma = String(c?.nome_turma || c?.turma_nome || c?.turma_id || "").toLowerCase();
          const motivo = String(getCertState(c)?.motivo || "").toLowerCase();
          return titulo.includes(debouncedQ) || turma.includes(debouncedQ) || motivo.includes(debouncedQ);
        });

    const getDateKey = (c) => {
      const fim = ymdOnly(formatarParaISO(c?.data_fim ?? c?.df ?? c?.fim ?? c?.turma_data_fim)) || "0000-00-00";
      const ini = ymdOnly(formatarParaISO(c?.data_inicio ?? c?.di ?? c?.inicio ?? c?.turma_data_inicio)) || "0000-00-00";
      return `${fim}|${ini}`;
    };

    const sorted = searched.slice().sort((a, b) => {
      if (ordenacao === "titulo") {
        const A = String(a?.evento || a?.evento_titulo || a?.nome_evento || "").localeCompare(
          String(b?.evento || b?.evento_titulo || b?.nome_evento || ""),
          "pt-BR"
        );
        if (A !== 0) return A;
      }
      const ka = getDateKey(a);
      const kb = getDateKey(b);
      if (ordenacao === "antigos") return ka > kb ? 1 : ka < kb ? -1 : 0;
      // recentes (padrão)
      return ka < kb ? 1 : ka > kb ? -1 : 0;
    });

    return sorted;
  }, [certificados, filtro, debouncedQ, ordenacao]);

  /* ───────────────── Cartão ───────────────── */
  function Badge({ tone = "zinc", children }) {
    const tones = {
      zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700",
      emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
      amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-200 dark:border-amber-800",
      sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border-sky-200 dark:border-sky-800",
      rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border-rose-200 dark:border-rose-800",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border ${tones[tone] || tones.zinc}`}>
        {children}
      </span>
    );
  }

  function CartaoCertificado({ cert }) {
    const key = keyDoCert(cert);
    const gerando = gerandoKey === key;

    const st = getCertState(cert);

    // Link de download resiliente
    const hrefDownload = cert?.certificado_id
      ? makeApiUrl(`certificados/${cert.certificado_id}/download`)
      : cert?.arquivo_pdf
      ? cert.arquivo_pdf.startsWith("http")
        ? cert.arquivo_pdf
        : makeApiUrl(cert.arquivo_pdf.replace(/^\//, ""))
      : null;

    const prontoParaDownload = Boolean(hrefDownload) && (cert?.ja_gerado || cert?.certificado_id);

    const titulo = cert?.evento || cert?.evento_titulo || cert?.nome_evento || "Evento";
    const turmaTxt = cert?.nome_turma || cert?.turma_nome || (cert?.turma_id ? `#${cert.turma_id}` : "Turma");
    const periodo = periodoSeguro(cert);

    const barra =
      st.status === "pronto"
        ? "bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400"
        : st.status === "pendente"
        ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400"
        : "bg-gradient-to-r from-sky-700 via-sky-600 to-sky-500";

    return (
      <motion.li
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="relative rounded-2xl border shadow-sm overflow-hidden bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800"
        aria-busy={gerando ? "true" : "false"}
      >
        {/* barrinha superior */}
        <div className={`h-1.5 w-full ${barra}`} aria-hidden="true" />

        <div className="p-4">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-lousa dark:text-white break-words">
                  {titulo}
                </h3>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Turma: <span className="font-semibold">{turmaTxt}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {st.status === "pronto" && <Badge tone="emerald"><CircleCheck className="w-3.5 h-3.5" /> Pronto</Badge>}
                {st.status === "pendente" && <Badge tone="amber"><CircleAlert className="w-3.5 h-3.5" /> Pendente</Badge>}
                {st.status === "geravel" && <Badge tone="sky"><FilePlus2 className="w-3.5 h-3.5" /> Disponível</Badge>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
                {periodo}
              </span>
            </div>

            {st.motivo ? (
              <div className="text-xs text-amber-800 dark:text-amber-200 bg-amber-100/70 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                {st.motivo}
              </div>
            ) : null}

            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              {prontoParaDownload ? (
                <a
                  href={hrefDownload}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-extrabold px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  aria-label={`Baixar certificado de ${titulo}`}
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Baixar certificado
                </a>
              ) : (
                <button
                  onClick={() => gerarCertificado(cert)}
                  disabled={gerando || busy || st.status === "pendente"}
                  className={[
                    "inline-flex items-center justify-center gap-2 rounded-xl text-white text-sm font-extrabold px-4 py-2",
                    st.status === "pendente"
                      ? "bg-zinc-400 dark:bg-zinc-700 cursor-not-allowed"
                      : "bg-sky-700 hover:bg-sky-800",
                    "disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  ].join(" ")}
                  aria-label="Gerar certificado de participante"
                >
                  <FilePlus2 className="w-4 h-4" aria-hidden="true" />
                  {gerando ? "Gerando..." : "Gerar certificado"}
                </button>
              )}

              <button
                type="button"
                onClick={carregarCertificados}
                disabled={carregando}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-sm font-semibold px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                aria-label="Recarregar lista"
              >
                <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} aria-hidden="true" />
                Recarregar
              </button>
            </div>
          </div>
        </div>
      </motion.li>
    );
  }

  const limparBusca = () => setQ("");

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero
        onRefresh={carregarCertificados}
        variant="teal"
        nome={nome}
        loading={carregando}
        kpis={kpis}
      />

      {/* live region */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* barra fina */}
      {carregando && (
        <div className="sticky top-0 left-0 w-full h-1 bg-teal-100 dark:bg-teal-900/30 z-40" role="progressbar" aria-label="Carregando">
          <div className="h-full bg-teal-700 animate-pulse w-1/3" />
        </div>
      )}

      <main id="conteudo" role="main" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Toolbar sticky */}
        <section
          aria-label="Ferramentas"
          className="sticky top-1 z-30 mb-5 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/75"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Busca */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por evento, turma ou motivo…"
                className="w-full rounded-xl border px-9 py-2 text-sm ring-offset-2 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                aria-label="Buscar certificados"
              />
              {q ? (
                <button
                  type="button"
                  onClick={limparBusca}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  aria-label="Limpar busca"
                  title="Limpar"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {/* filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <Filter className="h-4 w-4" aria-hidden="true" /> Filtros:
              </span>

              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                aria-label="Filtrar por status"
                title="Filtrar por status"
              >
                <option value="todos">Todos</option>
                <option value="prontos">Somente prontos</option>
                <option value="pendentes">Somente pendentes</option>
              </select>

              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
                className="rounded-xl border px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700 dark:border-zinc-700 dark:bg-zinc-950/30"
                aria-label="Ordenação"
                title="Ordenação"
              >
                <option value="recentes">Mais recentes</option>
                <option value="antigos">Mais antigos</option>
                <option value="titulo">Título (A–Z)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Conteúdo */}
        {carregando ? (
          <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={150} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <NadaEncontrado mensagem="Não foi possível carregar os certificados." sugestao="Tente atualizar novamente em instantes." />
        ) : certificados.length === 0 ? (
          <NadaEncontrado
            mensagem="Você ainda não possui certificados disponíveis."
            sugestao="Conclua cursos e realize as avaliações quando solicitadas para liberar certificados."
          />
        ) : certificadosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum certificado corresponde aos filtros atuais."
            sugestao="Ajuste a busca ou selecione outro filtro."
          />
        ) : (
          <section aria-labelledby="sec-participante">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 id="sec-participante" className="text-base font-semibold text-slate-700 dark:text-slate-200">
                Como participante
              </h2>
              <div className="text-xs text-zinc-500">
                {certificadosFiltrados.length} item{certificadosFiltrados.length === 1 ? "" : "s"}
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label="Lista de certificados">
              <AnimatePresence>
                {certificadosFiltrados.map((c) => (
                  <CartaoCertificado key={keyDoCert(c)} cert={c} />
                ))}
              </AnimatePresence>
            </ul>

            {/* dica de UX */}
            <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-4 text-sm text-zinc-700 dark:text-zinc-300">
              <p className="font-extrabold text-zinc-900 dark:text-white mb-1">Dica</p>
              <p>
                Se o certificado aparecer como <strong>Pendente</strong>, geralmente falta concluir a <strong>avaliação</strong> ou atingir a
                frequência mínima (quando aplicável). Assim que estiver liberado, o botão de geração ficará disponível.
              </p>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
