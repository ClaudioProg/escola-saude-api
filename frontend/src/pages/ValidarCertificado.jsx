// 📁 src/pages/ValidarCertificado.jsx
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BotaoPrimario from "../components/BotaoPrimario";
import NadaEncontrado from "../components/NadaEncontrado";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { formatarDataHoraBrasileira } from "../utils/data";
import { apiGet } from "../services/api";

export default function ValidarCertificado() {
  const [searchParams] = useSearchParams();
  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState("loading"); // loading | sucesso | pendente | erro
  const [dataHora, setDataHora] = useState("");

  // parâmetros
  const evento = (searchParams.get("evento") || "").trim();
  const usuario = (searchParams.get("usuario") || "").trim();
  const isDebug = (searchParams.get("debug") || "").trim() === "1";

  useEffect(() => {
    setDataHora(formatarDataHoraBrasileira(new Date()));

    if (!evento || !usuario) {
      setMensagem("❌ Link inválido. Parâmetros ausentes.");
      setStatus("erro");
      return;
    }

    (async () => {
      try {
        if (isDebug) console.log("[ValidarCertificado] GET /presencas/validar", { evento, usuario });

        const data = await apiGet("presencas/validar", {
          on403: "silent",
          query: { evento, usuario },
        });

        const presente =
          data?.presente ??
          data?.ok ??
          (typeof data?.status === "string" && data.status.toLowerCase() === "ok");

        if (presente) {
          setMensagem("✅ Presença confirmada! Você pode emitir seu certificado.");
          setStatus("sucesso");
        } else {
          setMensagem("❌ Presença ainda não registrada para este evento.");
          setStatus("pendente");
        }
      } catch (e) {
        if (isDebug) {
          console.error("[ValidarCertificado] erro:", e);
          setDetalhe(
            (e?.data?.erro || e?.message || String(e)) +
              " — verifique conexão, CORS e disponibilidade do endpoint."
          );
        }
        setMensagem("❌ Erro ao validar presença. Tente novamente mais tarde.");
        setStatus("erro");
      }
    })();
  }, [evento, usuario, isDebug]);

  const corMensagem =
    status === "sucesso"
      ? "text-green-700 dark:text-green-400"
      : status === "erro"
      ? "text-red-600 dark:text-red-400"
      : status === "pendente"
      ? "text-yellow-700 dark:text-yellow-400"
      : "text-gray-700 dark:text-gray-300";

  const cardVariants = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 print:p-0 print:min-h-0"
      role="main"
    >
      <motion.section
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 print:shadow-none print:bg-white"
        aria-label="Validação de Presença"
      >
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-8" role="banner">
          <img
            src="/LogoEscola.png"
            alt="Logotipo da Escola da Saúde de Santos"
            className="h-24 mb-4 drop-shadow print:hidden"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <h1 className="text-3xl font-bold text-blue-700 dark:text-white print:text-black">
            Escola da Saúde - Santos
          </h1>
          <p className="text-gray-600 dark:text-gray-300 print:text-black">
            Validação de Presença em Evento
          </p>
        </div>

        {status === "loading" ? (
          <CarregandoSkeleton height="120px" />
        ) : (
          <>
            <p
              className={`text-xl font-semibold mb-6 text-center transition-colors duration-200 ${corMensagem} ${
                status === "sucesso" ? "animate-pulse" : ""
              }`}
              aria-live="polite"
            >
              {mensagem}
            </p>

            {isDebug && detalhe && (
              <p className="text-sm text-gray-500 mb-4 break-words">{detalhe}</p>
            )}

            {status === "pendente" || status === "erro" ? (
              <NadaEncontrado
                mensagem={mensagem}
                sugestao="Verifique os dados do certificado ou tente novamente mais tarde."
              />
            ) : null}

            {status === "sucesso" && (
              <div className="flex justify-center print:hidden">
                <BotaoPrimario onClick={() => window.print()} aria-label="Imprimir esta página">
                  🖨️ Imprimir esta página
                </BotaoPrimario>
              </div>
            )}

            {dataHora && (
              <footer className="mt-10 text-sm text-gray-500 text-center print:mt-20 print:text-black print:text-xs w-full">
                Verificação realizada em: <strong>{dataHora}</strong>
              </footer>
            )}
          </>
        )}
      </motion.section>
    </main>
  );
}
