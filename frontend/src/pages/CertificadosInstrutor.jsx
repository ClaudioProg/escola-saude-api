// ✅ src/pages/CertificadosInstrutor.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { Award, RefreshCw } from "lucide-react";

import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPost, makeApiUrl } from "../services/api";

/* ───────────────── Hero (instrutor) — paleta única (3 cores) ───────────────── */
function HeaderHero({ onRefresh, nome = "" }) {
  const gradient = "from-amber-900 via-orange-800 to-yellow-700";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Award className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Certificados de Instrutor
          </h1>
        </div>
        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Gere e baixe seus certificados como <strong>instrutor/palestrante</strong>.
        </p>
        <BotaoPrimario
          onClick={onRefresh}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" />}
          aria-label="Atualizar certificados"
        >
          Atualizar
        </BotaoPrimario>
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

export default function CertificadosInstrutor() {
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerandoKey, setGerandoKey] = useState(null);
  const [busy, setBusy] = useState(false);

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

  // usuário + assinatura opcional
  const usuario = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("usuario") || "{}") || {};
      const assinatura =
        typeof parsed?.imagem_base64 === "string" &&
        parsed.imagem_base64.startsWith("data:image/")
          ? parsed.imagem_base64
          : null;
      return { ...parsed, imagem_base64: assinatura };
    } catch {
      return {};
    }
  }, []);
  const nome = usuario?.nome || "";

  useEffect(() => {
    document.title = "Certificados do Instrutor | Escola da Saúde";
    carregarCertificados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const keyDoCert = useCallback((cert) => {
    const tipo = cert?.tipo ?? "instrutor";
    return `${tipo}-${cert?.evento_id}-${cert?.turma_id}`;
  }, []);

  async function carregarCertificados() {
    try {
      // abort anterior
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
      const apenasInstrutor = listaBruta.filter(
        (c) => (c?.tipo ?? "instrutor") === "instrutor"
      );

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
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar certificados.");
      setCertificados([]);
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }

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

      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo: "instrutor",
      };

      // assinatura opcional do instrutor (igual à lógica do participante)
      if (usuario.imagem_base64) {
        body.assinaturaBase64 = usuario.imagem_base64;
      }

      const resultado = await apiPost("certificados/gerar", body);

      // normaliza retornos possíveis
      const certificadoId =
        resultado?.certificado_id ??
        resultado?.id ??
        resultado?.certificado?.id ??
        null;

      const arquivoPdf =
        resultado?.arquivo_pdf ??
        resultado?.arquivo ??
        resultado?.certificado?.arquivo_pdf ??
        null;

      const arquivoPng =
        resultado?.arquivo_png ??
        resultado?.certificado?.arquivo_png ??
        null;

      toast.success("🎉 Certificado de instrutor gerado com sucesso!");

      // Recarrega do servidor (autoridade)
      await carregarCertificados();

      // Sinalização otimista local
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
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao gerar certificado de instrutor.");
    } finally {
      setGerandoKey(null);
      setBusy(false);
    }
  }

  /* Cartão de certificado (instrutor) */
  function CartaoCertificado({ cert }) {
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

    const prontoParaDownload =
      Boolean(hrefDownload) && (cert.ja_gerado || cert.certificado_id);

    // título/infos
    const titulo =
      cert?.evento || cert?.evento_titulo || cert?.nome_evento || "Evento";
    const turma =
      cert?.nome_turma || cert?.turma_nome || (cert?.turma_id ? `#${cert.turma_id}` : "Turma");

    return (
      <motion.li
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between transition
                   bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
        aria-busy={gerando ? "true" : "false"}
      >
        <div>
          <h3 className="text-lg font-bold mb-1 text-yellow-900 dark:text-yellow-200">
            {titulo}
          </h3>

          <p className="text-sm text-gray-800 dark:text-gray-200">Turma: {turma}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Período: {periodoSeguro(cert)}
          </p>

          <span className="inline-block mt-2 px-2 py-1 bg-yellow-400 text-[11px] font-semibold text-yellow-900 rounded">
            📣 Instrutor
          </span>
        </div>

        <div className="mt-4 flex justify-center">
          {prontoParaDownload ? (
            <a
              href={hrefDownload}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded text-center"
            >
              Baixar Certificado
            </a>
          ) : (
            <button
              onClick={() => gerarCertificado(cert)}
              disabled={gerando || busy}
              className="text-white text-sm font-medium py-2 px-4 rounded text-center disabled:opacity-60 bg-yellow-500 hover:bg-yellow-600"
              aria-label="Gerar certificado de instrutor"
            >
              {gerando ? "Gerando..." : "Gerar Certificado"}
            </button>
          )}
        </div>
      </motion.li>
    );
  }

  /* ─────────────── Render ─────────────── */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={carregarCertificados} nome={nome} />

      <main role="main" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />
        {carregando ? (
          <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={110} className="rounded-xl" />
            ))}
          </div>
        ) : erro ? (
          <NadaEncontrado mensagem="Não foi possível carregar os certificados de instrutor." />
        ) : certificados.length === 0 ? (
          <NadaEncontrado mensagem="Você ainda não possui certificados de instrutor disponíveis." />
        ) : (
          <section aria-labelledby="sec-instrutor">
            <h2
              id="sec-instrutor"
              className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3"
            >
              Como instrutor
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificados.map((c) => (
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
