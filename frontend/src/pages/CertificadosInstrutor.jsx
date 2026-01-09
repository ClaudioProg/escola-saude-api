// ✅ src/pages/CertificadosInstrutor.jsx (premium + mobile/a11y + ministats + filtros locais)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import {
  Award,
  RefreshCw,
  Search,
  Filter,
  Download,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiPost, makeApiUrl } from "../services/api";
import { useReducedMotion } from "framer-motion";

/* ───────────────── Hero (instrutor) — paleta única (3 cores) ───────────────── */
function HeaderHero({ onRefresh, nome = "", carregando }) {
  const gradient = "from-amber-950 via-orange-800 to-yellow-600";

  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <div className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Award className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  Certificados de Instrutor
                </h1>
                <p className="text-sm text-white/90 mt-0.5">
                  {nome ? `Bem-vindo(a), ${nome}. ` : ""}
                  Gere e baixe seus certificados como <strong>instrutor/palestrante</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-2">
            <BotaoPrimario
              onClick={onRefresh}
              variante="secundario"
              icone={<RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />}
              aria-label="Atualizar certificados de instrutor"
              disabled={carregando}
            >
              Atualizar
            </BotaoPrimario>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-white/10 ring-1 ring-white/15 p-3 text-xs sm:text-sm flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-white/90" aria-hidden="true" />
          <p className="text-white/90 leading-relaxed">
            A assinatura no certificado é <strong>opcional</strong> e será usada apenas se estiver cadastrada no seu perfil
            (imagem base64).
          </p>
        </div>
      </div>
    </header>
  );
}

/* ───────────────── Util: período seguro (date-only) ───────────────── */
function periodoSeguro(cert) {
  const iniRaw = cert?.data_inicio ?? cert?.di ?? cert?.inicio;
  const fimRaw = cert?.data_fim ?? cert?.df ?? cert?.fim;
  const iniISO = formatarParaISO(iniRaw);
  const fimISO = formatarParaISO(fimRaw);
  const ini = iniISO ? formatarDataBrasileira(iniISO) : "—";
  const fim = fimISO ? formatarDataBrasileira(fimISO) : "—";
  return `${ini} até ${fim}`;
}

/* ───────────────── Util: normalizações ───────────────── */
function normalizarTexto(v) {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function CertificadosInstrutor() {
  const reduceMotion = useReducedMotion();

  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [gerandoKey, setGerandoKey] = useState(null);
  const [busy, setBusy] = useState(false);

  // filtros/UX local (não muda regra de negócio; só UI)
  const [q, setQ] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);

  const liveRef = useRef(null);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  /* ───────────────── Usuário + assinatura opcional ───────────────── */
  const usuario = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("usuario") || "{}") || {};
      const assinatura =
        typeof parsed?.imagem_base64 === "string" && parsed.imagem_base64.startsWith("data:image/")
          ? parsed.imagem_base64
          : null;
      return { ...parsed, imagem_base64: assinatura };
    } catch {
      return {};
    }
  }, []);

  const nome = usuario?.nome || "";

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.();
    };
  }, []);

  const keyDoCert = useCallback((cert) => {
    const tipo = cert?.tipo ?? "instrutor";
    return `${tipo}-${cert?.evento_id}-${cert?.turma_id}`;
  }, []);

  const isGerado = useCallback((cert) => {
    return Boolean(cert?.ja_gerado || cert?.certificado_id);
  }, []);

  /* ───────────────── Carregar ───────────────── */
  const carregarCertificados = useCallback(async () => {
    try {
      abortRef.current?.abort?.();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setCarregando(true);
      setErro("");
      setLive("Carregando certificados…");

      // ✅ endpoint elegíveis (instrutor)
      const dadosInstrutor = await apiGet("certificados/elegiveis-instrutor", {
        signal: ctrl.signal,
      });

      const listaBruta = Array.isArray(dadosInstrutor) ? dadosInstrutor : [];

      // somente tipo 'instrutor'
      const apenasInstrutor = listaBruta.filter((c) => (c?.tipo ?? "instrutor") === "instrutor");

      // remove duplicatas por (tipo, evento_id, turma_id)
      const seen = new Set();
      const unicos = [];
      for (const item of apenasInstrutor) {
        const k = `instrutor-${item?.evento_id}-${item?.turma_id}`;
        if (seen.has(k)) continue;
        seen.add(k);
        unicos.push(item);
      }

      if (!mountedRef.current) return;

      setCertificados(unicos);

      setLive(
        unicos.length
          ? `Foram encontrados ${unicos.length} certificado(s) elegível(is) como instrutor.`
          : "Nenhum certificado de instrutor elegível encontrado."
      );
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.error(e);
      if (!mountedRef.current) return;

      const msg = "Erro ao carregar certificados de instrutor.";
      setErro(msg);
      setCertificados([]);
      setLive("Falha ao carregar certificados.");
      toast.error(`❌ ${msg}`);
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [setLive]);

  useEffect(() => {
    document.title = "Certificados do Instrutor | Escola da Saúde";
    carregarCertificados();
  }, [carregarCertificados]);

  /* ───────────────── Gerar ───────────────── */
  const gerarCertificado = useCallback(
    async (cert) => {
      if (busy) return;

      const key = keyDoCert(cert);
      setBusy(true);
      setGerandoKey(key);

      try {
        if (!usuario?.id) {
          toast.error("❌ Usuário não identificado. Faça login novamente.");
          return;
        }

        const body = {
          usuario_id: usuario.id,
          evento_id: cert.evento_id,
          turma_id: cert.turma_id,
          tipo: "instrutor",
        };

        // assinatura opcional do instrutor
        if (usuario.imagem_base64) {
          body.assinaturaBase64 = usuario.imagem_base64;
        }

        const resultado = await apiPost("certificados/gerar", body);

        // normaliza retornos possíveis (mantém compatibilidade)
        const certificadoId =
          resultado?.certificado_id ?? resultado?.id ?? resultado?.certificado?.id ?? null;

        const arquivoPdf =
          resultado?.arquivo_pdf ?? resultado?.arquivo ?? resultado?.certificado?.arquivo_pdf ?? null;

        const arquivoPng = resultado?.arquivo_png ?? resultado?.certificado?.arquivo_png ?? null;

        toast.success("🎉 Certificado de instrutor gerado com sucesso!");

        // Recarrega do servidor (autoridade)
        await carregarCertificados();

        // Sinalização otimista local (mantida)
        setCertificados((prev) =>
          prev.map((c) =>
            c.evento_id === cert.evento_id && c.turma_id === cert.turma_id
              ? {
                  ...c,
                  ja_gerado: true,
                  certificado_id: c.certificado_id ?? certificadoId ?? c.certificado_id,
                  arquivo_pdf: c.arquivo_pdf ?? arquivoPdf ?? c.arquivo_pdf,
                  arquivo_png: c.arquivo_png ?? arquivoPng ?? c.arquivo_png,
                }
              : c
          )
        );

        setLive("Certificado gerado com sucesso.");
      } catch (err) {
        console.error(err);
        setLive("Falha ao gerar o certificado.");
        toast.error("❌ Erro ao gerar certificado de instrutor.");
      } finally {
        setGerandoKey(null);
        setBusy(false);
      }
    },
    [busy, keyDoCert, usuario, carregarCertificados, setLive]
  );

  /* ───────────────── Dados derivados ───────────────── */
  const certificadosFiltrados = useMemo(() => {
    const nq = normalizarTexto(q);
    return (certificados || [])
      .filter((c) => (somentePendentes ? !isGerado(c) : true))
      .filter((c) => {
        if (!nq) return true;
        const titulo = c?.evento || c?.evento_titulo || c?.nome_evento || "";
        const turma = c?.nome_turma || c?.turma_nome || (c?.turma_id ? `#${c.turma_id}` : "");
        return (
          normalizarTexto(titulo).includes(nq) ||
          normalizarTexto(turma).includes(nq) ||
          normalizarTexto(String(c?.turma_id ?? "")).includes(nq)
        );
      });
  }, [certificados, q, somentePendentes, isGerado]);

  const stats = useMemo(() => {
    const total = certificados.length;
    const gerados = certificados.filter((c) => isGerado(c)).length;
    const pendentes = total - gerados;
    return { total, gerados, pendentes };
  }, [certificados, isGerado]);

  /* ───────────────── Cartão ───────────────── */
  const CartaoCertificado = useCallback(
    function CartaoCertificadoInner({ cert }) {
      const key = keyDoCert(cert);
      const gerando = gerandoKey === key;

      // Link de download resiliente (PDF > PNG > absoluto)
      let hrefDownload = null;
      if (cert?.certificado_id) {
        hrefDownload = makeApiUrl(`certificados/${cert.certificado_id}/download`);
      } else if (cert?.arquivo_pdf) {
        hrefDownload = String(cert.arquivo_pdf).startsWith("http")
          ? cert.arquivo_pdf
          : makeApiUrl(String(cert.arquivo_pdf).replace(/^\//, ""));
      } else if (cert?.arquivo_png) {
        hrefDownload = String(cert.arquivo_png).startsWith("http")
          ? cert.arquivo_png
          : makeApiUrl(String(cert.arquivo_png).replace(/^\//, ""));
      }

      const prontoParaDownload = Boolean(hrefDownload) && (cert?.ja_gerado || cert?.certificado_id);

      // título/infos
      const titulo = cert?.evento || cert?.evento_titulo || cert?.nome_evento || "Evento";
      const turma =
        cert?.nome_turma ||
        cert?.turma_nome ||
        (cert?.turma_id ? `#${cert.turma_id}` : "Turma");

      return (
        <motion.li
          key={key}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="group rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
          aria-busy={gerando ? "true" : "false"}
        >
          {/* Top bar (padrão “premium”) */}
          <div className="h-1.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500" />

          <div className="p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                  {titulo}
                </h3>
                <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
                  <p className="truncate">
                    <span className="font-semibold">Turma:</span> {turma}
                  </p>
                  <p className="truncate">
                    <span className="font-semibold">Período:</span> {periodoSeguro(cert)}
                  </p>
                </div>
              </div>

              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold
                               bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200
                               dark:bg-yellow-900/30 dark:text-yellow-100 dark:ring-yellow-800">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Instrutor
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                {prontoParaDownload ? (
                  <span className="inline-flex items-center gap-1">
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Disponível para download
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    Ainda não gerado
                  </span>
                )}
              </div>

              <div className="flex gap-2 justify-stretch sm:justify-end">
                {prontoParaDownload ? (
                  <a
                    href={hrefDownload}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                               rounded-xl px-4 py-2 text-sm font-bold
                               bg-emerald-700 hover:bg-emerald-800 text-white
                               focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700"
                    aria-label="Baixar certificado de instrutor"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Baixar
                  </a>
                ) : (
                  <button
                    onClick={() => gerarCertificado(cert)}
                    disabled={gerando || busy}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2
                               rounded-xl px-4 py-2 text-sm font-bold
                               text-zinc-900 bg-yellow-400 hover:bg-yellow-500
                               disabled:opacity-60 disabled:cursor-not-allowed
                               focus:outline-none focus:ring-2 focus:ring-yellow-200 dark:focus:ring-yellow-700"
                    aria-label="Gerar certificado de instrutor"
                  >
                    <Award className={`w-4 h-4 ${gerando ? "animate-pulse" : ""}`} aria-hidden="true" />
                    {gerando ? "Gerando..." : "Gerar Certificado"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.li>
      );
    },
    [busy, gerandoKey, gerarCertificado, keyDoCert, reduceMotion]
  );

  /* ───────────────── Render ───────────────── */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregarCertificados} nome={nome} carregando={carregando} />

      <main role="main" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Ministats + Filtros */}
        <section className="mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Total elegíveis</div>
              <div className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                {carregando ? "—" : stats.total}
              </div>
            </div>
            <div className="rounded-2xl border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Gerados</div>
              <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                {carregando ? "—" : stats.gerados}
              </div>
            </div>
            <div className="rounded-2xl border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 p-4">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">Pendentes</div>
              <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
                {carregando ? "—" : stats.pendentes}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <label htmlFor="buscaCertInstrutor" className="sr-only">
                  Buscar certificados
                </label>
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="buscaCertInstrutor"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por evento, turma ou ID…"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950
                             pl-9 pr-3 py-2 text-sm outline-none
                             focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800"
                  inputMode="search"
                  autoComplete="off"
                />
              </div>

              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSomentePendentes((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold border
                              ${
                                somentePendentes
                                  ? "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100"
                                  : "bg-white border-zinc-200 text-zinc-800 dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                              }
                              focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800`}
                  aria-pressed={somentePendentes ? "true" : "false"}
                  aria-label="Alternar filtro: mostrar apenas pendentes"
                >
                  <Filter className="w-4 h-4" aria-hidden="true" />
                  {somentePendentes ? "Só pendentes" : "Todos"}
                </button>

                <BotaoSecundario
                  onClick={() => carregarCertificados()}
                  icone={<RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />}
                  aria-label="Recarregar lista"
                  disabled={carregando}
                >
                  Recarregar
                </BotaoSecundario>
              </div>
            </div>
          </div>
        </section>

        {carregando ? (
          <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={140} className="rounded-2xl" />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 dark:text-red-300 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-bold text-red-800 dark:text-red-200">Não foi possível carregar.</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {erro || "Erro ao buscar certificados de instrutor."}
                </p>
                <div className="mt-3">
                  <BotaoPrimario
                    onClick={carregarCertificados}
                    icone={<RefreshCw className="w-4 h-4" />}
                    aria-label="Tentar novamente"
                  >
                    Tentar novamente
                  </BotaoPrimario>
                </div>
              </div>
            </div>
          </div>
        ) : certificados.length === 0 ? (
          <NadaEncontrado mensagem="Você ainda não possui certificados de instrutor disponíveis." />
        ) : certificadosFiltrados.length === 0 ? (
          <NadaEncontrado mensagem="Nenhum certificado encontrado com os filtros atuais." />
        ) : (
          <section aria-labelledby="sec-instrutor">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="sec-instrutor"
                className="text-base font-extrabold text-zinc-800 dark:text-zinc-100"
              >
                Como instrutor
              </h2>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                Exibindo <span className="font-bold">{certificadosFiltrados.length}</span> item(ns)
              </div>
            </div>

            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificadosFiltrados.map((c) => (
                <CartaoCertificado key={keyDoCert(c)} cert={c} />
              ))}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
