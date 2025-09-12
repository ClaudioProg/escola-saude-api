// 📁 src/pages/ValidarCertificado.jsx
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BotaoPrimario from "../components/BotaoPrimario";
import NadaEncontrado from "../components/NadaEncontrado";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { formatarDataHoraBrasileira } from "../utils/data";
import { apiGet } from "../services/api";

// 🧩 novos: faixa compacta + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

// Ícone para o cabeçalho
import { Award } from "lucide-react";

export default function ValidarCertificado() {
  const [sp] = useSearchParams();
  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState("loading"); // loading | sucesso | pendente | erro
  const [dataHora, setDataHora] = useState("");

  const isDebug = (sp.get("debug") || "") === "1";

  // 📦 helper: lê param por vários nomes
  const getAny = (...keys) => {
    for (const k of keys) {
      const v = (sp.get(k) || "").trim();
      if (v) return v;
    }
    return "";
  };

  // 1) tenta direto por query (?usuario, ?usuario_id, ?u / ?evento, ?evento_id, ?e)
  let usuario = getAny("usuario", "usuario_id", "user_id", "u");
  let evento  = getAny("evento", "evento_id", "event_id", "e");

  // 2) se veio um “link embrulhado” (?codigo=<url codificada>), extrai de lá
  if (!usuario || !evento) {
    const codigo = sp.get("codigo") || sp.get("c") || "";
    if (codigo) {
      try {
        const raw = decodeURIComponent(codigo);
        const u = new URL(raw);
        usuario = usuario || u.searchParams.get("usuario") || u.searchParams.get("usuario_id") || u.searchParams.get("u") || "";
        evento  = evento  || u.searchParams.get("evento")  || u.searchParams.get("evento_id")  || u.searchParams.get("e") || "";
      } catch { /* ignora */ }
    }
  }

  useEffect(() => {
    setDataHora(formatarDataHoraBrasileira(new Date()));

    if (!usuario || !evento) {
      setMensagem("❌ Link inválido. Parâmetros ausentes.");
      setStatus("erro");
      return;
    }

    (async () => {
      try {
        if (isDebug) console.log("[ValidarCertificado] /presencas/validar", { evento, usuario });

        // ✅ Endpoint único do backend (já existente)
        const data = await apiGet("presencas/validar", {
          on403: "silent",
          query: { evento, usuario },
        });

        const presente =
          data?.presente ??
          data?.ok ??
          (typeof data?.status === "string" && data.status.toLowerCase() === "ok");

        if (presente) {
          setMensagem("✅ Certificado validado com sucesso! Você pode imprimir esta certificação.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, evento, isDebug]);

  const corMensagem =
    status === "sucesso"
      ? "text-green-700 dark:text-green-400"
      : status === "erro"
      ? "text-red-600 dark:text-red-400"
      : status === "pendente"
      ? "text-yellow-700 dark:text-yellow-400"
      : "text-gray-700 dark:text-gray-300";

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* 🟨 Faixa de título (certificados = dourado) */}
      <PageHeader title="Validar Certificado" icon={Award} variant="dourado" />

      <main role="main" className="flex-1">
        <section
          aria-label="Validação de Certificado"
          aria-live="polite"
          aria-atomic="true"
          className="min-h-[60vh] flex items-center justify-center p-6 print:p-0 print:min-h-0"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-lg rounded-2xl p-8 print:shadow-none print:bg-white"
          >
            {/* 🔹 Removido o cabeçalho interno com logo/título para evitar redundância com PageHeader */}

            {status === "loading" ? (
              <CarregandoSkeleton height="120px" />
            ) : (
              <>
                <p
                  className={`text-xl font-semibold mb-6 text-center transition-colors duration-200 ${corMensagem} ${
                    status === "sucesso" ? "animate-pulse" : ""
                  }`}
                >
                  {mensagem}
                </p>

                {isDebug && detalhe && (
                  <p className="text-sm text-gray-500 mb-4 break-words">{detalhe}</p>
                )}

                {(status === "pendente" || status === "erro") && (
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
          </motion.div>
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
