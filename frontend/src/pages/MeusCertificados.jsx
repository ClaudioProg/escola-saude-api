// ✅ src/pages/MeusCertificados.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { Award, RefreshCw } from "lucide-react";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import { apiGet, apiPost, makeApiUrl } from "../services/api";

/* ───────────────── Hero padronizado (igual ao MinhasPresencas) ───────────────── */
function HeaderHero({ onRefresh, variant = "teal", nome = "" }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
  };
  const grad = variants[variant] ?? variants.teal;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <Award className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Meus Certificados
          </h1>
        </div>
        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Gere e baixe seus certificados como participante e como instrutor.
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
  const iniRaw = cert.data_inicio ?? cert.di ?? cert.inicio;
  const fimRaw = cert.data_fim ?? cert.df ?? cert.fim;
  const iniISO = formatarParaISO(iniRaw);
  const fimISO = formatarParaISO(fimRaw);
  const ini = iniISO ? formatarDataBrasileira(iniISO) : "—";
  const fim = fimISO ? formatarDataBrasileira(fimISO) : "—";
  return `${ini} até ${fim}`;
}

/* ───────────────── Página ───────────────── */
export default function MeusCertificados() {
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [gerandoKey, setGerandoKey] = useState(null);
  const liveRef = useRef(null);

  // usuário do localStorage, com imagem_base64 validada (para assinatura de instrutor)
  const usuario = useMemo(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("usuario") || "{}");
      return {
        ...parsed,
        imagem_base64:
          typeof parsed?.imagem_base64 === "string" &&
          parsed.imagem_base64.startsWith("data:image/")
            ? parsed.imagem_base64
            : null,
      };
    } catch {
      return {};
    }
  }, []);
  const nome = usuario?.nome || "";

  useEffect(() => {
    document.title = "Certificados | Escola da Saúde";
    carregarCertificados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarCertificados() {
    try {
      setCarregando(true);
      setErro("");
      if (liveRef.current) liveRef.current.textContent = "Carregando certificados…";

      // elegíveis como PARTICIPANTE
      const dadosUsuario = await apiGet("certificados/elegiveis");
      // elegíveis como INSTRUTOR
      const dadosInstrutor = await apiGet("certificados/elegiveis-instrutor");

      const comTipo = [
        ...(Array.isArray(dadosUsuario) ? dadosUsuario.map((c) => ({ ...c, tipo: "usuario" })) : []),
        ...(Array.isArray(dadosInstrutor) ? dadosInstrutor.map((c) => ({ ...c, tipo: "instrutor" })) : []),
      ];

      // remove duplicatas por (evento_id, turma_id, tipo)
      const unicos = comTipo.filter(
        (item, idx, arr) =>
          idx ===
          arr.findIndex(
            (c) =>
              String(c.evento_id) === String(item.evento_id) &&
              String(c.turma_id) === String(item.turma_id) &&
              c.tipo === item.tipo
          )
      );

      setCertificados(unicos);
      if (liveRef.current) {
        liveRef.current.textContent = unicos.length
          ? `Foram encontrados ${unicos.length} certificado(s) elegível(is).`
          : "Nenhum certificado elegível encontrado.";
      }
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar certificados");
      toast.error("❌ Erro ao carregar certificados.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar certificados.";
    } finally {
      setCarregando(false);
    }
  }

  function keyDoCert(cert) {
    return `${cert.evento_id}-${cert.turma_id}-${cert.tipo}`;
  }

  async function gerarCertificado(cert) {
    const key = keyDoCert(cert);
    setGerandoKey(key);

    try {
      const body = {
        usuario_id: usuario.id,
        evento_id: cert.evento_id,
        turma_id: cert.turma_id,
        tipo: cert.tipo, // "usuario" | "instrutor"
      };

      // normalmente quem assina é o instrutor/adm
      if (cert.tipo === "instrutor" && usuario.imagem_base64) {
        body.assinaturaBase64 = usuario.imagem_base64;
      }

      const resultado = await apiPost("certificados/gerar", body);

      toast.success("🎉 Certificado gerado com sucesso!");

      setCertificados((prev) =>
        prev.map((c) =>
          c.evento_id === cert.evento_id &&
          c.turma_id === cert.turma_id &&
          c.tipo === cert.tipo
            ? {
                ...c,
                ja_gerado: true,
                arquivo_pdf: resultado?.arquivo,
                certificado_id: resultado?.certificado_id ?? c.certificado_id ?? Date.now(),
              }
            : c
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao gerar certificado.");
    } finally {
      setGerandoKey(null);
    }
  }

  // Particiona por tipo
  const certificadosUsuario = useMemo(
    () => certificados.filter((c) => c.tipo === "usuario"),
    [certificados]
  );
  const certificadosInstrutor = useMemo(
    () => certificados.filter((c) => c.tipo === "instrutor"),
    [certificados]
  );

  // Cartões
  function CartaoCertificado({ cert }) {
    const eInstrutor = cert.tipo === "instrutor";
    const key = keyDoCert(cert);
    const gerando = gerandoKey === key;

    return (
      <motion.li
        key={key}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`rounded-2xl border shadow-sm p-4 flex flex-col justify-between transition
          ${eInstrutor
            ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800"
            : "bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-700"}`}
      >
        <div>
          <h3
            className={`text-lg font-bold mb-1 ${
              eInstrutor ? "text-yellow-900 dark:text-yellow-200" : "text-lousa dark:text-green-100"
            }`}
          >
            {cert.evento || cert.evento_titulo || cert.nome_evento || "Evento"}
          </h3>

          <p className="text-sm text-gray-700 dark:text-gray-300">
            Turma: {cert.nome_turma || cert.turma_nome || `#${cert.turma_id}`}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Período: {periodoSeguro(cert)}
          </p>

          {eInstrutor && (
            <span className="inline-block mt-2 px-2 py-1 bg-yellow-400 text-[11px] font-semibold text-yellow-900 rounded">
              📣 Instrutor
            </span>
          )}
        </div>

        <div className="mt-4 flex justify-center">
          {cert.ja_gerado && cert.certificado_id ? (
            <a
              href={makeApiUrl(`certificados/${cert.certificado_id}/download`)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-700 hover:bg-green-800 text-white text-sm font-medium py-2 px-4 rounded text-center"
            >
              Baixar Certificado
            </a>
          ) : (
            <button
              onClick={() => gerarCertificado(cert)}
              disabled={gerando}
              className={`text-white text-sm font-medium py-2 px-4 rounded text-center disabled:opacity-60
                ${eInstrutor ? "bg-yellow-500 hover:bg-yellow-600" : "bg-blue-700 hover:bg-blue-800"}`}
              aria-label={eInstrutor ? "Gerar certificado de instrutor" : "Gerar certificado de participante"}
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
      <HeaderHero onRefresh={carregarCertificados} variant="teal" nome={nome} />

      <main role="main" className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* feedback acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {carregando ? (
          <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={110} className="rounded-xl" />
            ))}
          </div>
        ) : erro ? (
          <NadaEncontrado mensagem="Não foi possível carregar os certificados." />
        ) : certificados.length === 0 ? (
          <NadaEncontrado mensagem="Você ainda não possui certificados disponíveis." />
        ) : (
          <div className="space-y-8">
            {/* Seção: Participante */}
            {certificadosUsuario.length > 0 && (
              <section aria-labelledby="sec-participante">
                <h2
                  id="sec-participante"
                  className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3"
                >
                  Como participante
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certificadosUsuario.map((c) => (
                    <CartaoCertificado key={keyDoCert(c)} cert={c} />
                  ))}
                </ul>
              </section>
            )}

            {/* Seção: Instrutor */}
            {certificadosInstrutor.length > 0 && (
              <section aria-labelledby="sec-instrutor">
                <h2
                  id="sec-instrutor"
                  className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-3"
                >
                  Como instrutor
                </h2>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certificadosInstrutor.map((c) => (
                    <CartaoCertificado key={keyDoCert(c)} cert={c} />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
