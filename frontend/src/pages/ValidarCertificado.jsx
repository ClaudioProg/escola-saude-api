// 📁 src/pages/ValidarCertificado.jsx
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BotaoPrimario from "../components/BotaoPrimario";
import NadaEncontrado from "../components/NadaEncontrado";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { formatarDataHoraBrasileira } from "../utils/data";
import { apiGet } from "../services/api"; // ✅ cliente central

export default function ValidarCertificado() {
  const [searchParams] = useSearchParams();
  const [mensagem, setMensagem] = useState("");
  const [status, setStatus] = useState(""); // 'sucesso', 'erro', 'pendente'
  const [dataHora, setDataHora] = useState("");
  const [carregando, setCarregando] = useState(true);

  const evento = searchParams.get("evento");
  const usuario = searchParams.get("usuario");

  useEffect(() => {
    setDataHora(formatarDataHoraBrasileira(new Date()));

    if (!evento || !usuario) {
      setMensagem("❌ Link inválido. Parâmetros ausentes.");
      setStatus("erro");
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        const data = await apiGet("/api/presencas/validar", {
          query: { evento, usuario },
        });
        if (data?.presente) {
          setMensagem("✅ Presença confirmada! Você pode emitir seu certificado.");
          setStatus("sucesso");
        } else {
          setMensagem("❌ Presença ainda não registrada para este evento.");
          setStatus("pendente");
        }
      } catch {
        setMensagem("❌ Erro ao validar presença. Tente novamente mais tarde.");
        setStatus("erro");
      } finally {
        setCarregando(false);
      }
    })();
  }, [evento, usuario]);

  const corMensagem =
    status === "sucesso"
      ? "text-green-700 dark:text-green-400"
      : status === "erro"
      ? "text-red-600 dark:text-red-400"
      : "text-yellow-700 dark:text-yellow-400";

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-6 print:p-0 print:min-h-0 relative"
      role="main"
    >
      <motion.section
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 print:shadow-none print:bg-white"
        aria-label="Validação de Presença"
        aria-busy={carregando}
      >
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-8" role="banner">
          <img
            src="/LogoEscola.png"
            alt="Logotipo da Escola da Saúde de Santos"
            className="h-24 mb-4 drop-shadow print:hidden"
          />
          <h1 className="text-3xl font-bold text-blue-700 dark:text-white print:text-black">
            Escola da Saúde - Santos
          </h1>
          <p className="text-gray-600 dark:text-gray-300 print:text-black">
            Validação de Presença em Evento
          </p>
        </div>

        {carregando ? (
          <CarregandoSkeleton height="120px" />
        ) : (
          <>
            <p
              className={`text-xl font-semibold mb-6 text-center transition-colors duration-200 ${
                status === "sucesso" ? "animate-pulse" : ""
              } ${corMensagem}`}
              aria-live="polite"
            >
              {mensagem}
            </p>

            {(status === "erro" || status === "pendente") && (
              <NadaEncontrado
                mensagem={mensagem}
                sugestao="Verifique os dados do certificado ou tente novamente mais tarde."
              />
            )}

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
