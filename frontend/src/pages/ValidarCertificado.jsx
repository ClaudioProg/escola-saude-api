// 📁 src/pages/ValidarCertificado.jsx
import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import BotaoPrimario from "../components/BotaoPrimario";
import NadaEncontrado from "../components/NadaEncontrado";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { formatarDataHoraBrasileira } from "../utils/data";
import { apiGet } from "../services/api";

// 🧩 faixa compacta (padronizada) + rodapé
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

// Ícones
import { Award, CheckCircle2, XCircle, Clock, Copy, Printer } from "lucide-react";

/* Utils locais */
function maskCPF(cpf) {
  if (!cpf) return "—";
  const s = String(cpf).replace(/\D/g, "");
  if (s.length !== 11) return cpf;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`.replace(/\d(?=\d{4})/g, "•");
}

function useQueryParams() {
  const [sp] = useSearchParams();

  // helper: lê param por vários nomes
  const getAny = useCallback(
    (...keys) => {
      for (const k of keys) {
        const v = (sp.get(k) || "").trim();
        if (v) return v;
      }
      return "";
    },
    [sp]
  );

  let usuario = getAny("usuario", "usuario_id", "user_id", "u");
  let evento = getAny("evento", "evento_id", "event_id", "e");

  // Se veio ?codigo=<url codificada>, extrai de lá
  if (!usuario || !evento) {
    const codigo = sp.get("codigo") || sp.get("c") || "";
    if (codigo) {
      try {
        const raw = decodeURIComponent(codigo);
        const u = new URL(raw);
        usuario =
          usuario ||
          u.searchParams.get("usuario") ||
          u.searchParams.get("usuario_id") ||
          u.searchParams.get("u") ||
          "";
        evento =
          evento ||
          u.searchParams.get("evento") ||
          u.searchParams.get("evento_id") ||
          u.searchParams.get("e") ||
          "";
      } catch {
        /* ignora */
      }
    }
  }

  const isDebug = (sp.get("debug") || "") === "1";
  return { usuario, evento, isDebug, sp };
}

export default function ValidarCertificado() {
  const { usuario, evento, isDebug, sp } = useQueryParams();

  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState("loading"); // loading | sucesso | pendente | erro
  const [dataHora, setDataHora] = useState("");
  const [meta, setMeta] = useState(null); // { nome, cpf, evento_titulo, carga_horaria, periodo, hash, ... }

  // link atual (para copiar)
  const linkValidacao = useMemo(() => {
    const url = new URL(window.location.href);
    // Normaliza para os params canônicos ?usuario= & ?evento=
    if (usuario) url.searchParams.set("usuario", usuario);
    if (evento) url.searchParams.set("evento", evento);
    return url.toString();
  }, [usuario, evento]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);
      setDetalhe("Link copiado para a área de transferência.");
    } catch {
      // fallback simples
      prompt("Copie o link de validação:", linkValidacao);
    }
  };

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

        // Tenta extrair metadados opcionais
        const metaData = {
          nome: data?.nome ?? data?.aluno ?? data?.participante ?? "",
          cpf: data?.cpf ?? data?.documento ?? "",
          evento_titulo: data?.evento_titulo ?? data?.evento ?? "",
          carga_horaria: data?.carga_horaria ?? data?.cargaHoraria ?? "",
          periodo: data?.periodo ?? data?.data ?? "",
          hash: data?.hash ?? data?.codigo ?? sp.get("codigo") ?? sp.get("c") ?? "",
        };
        setMeta(metaData);

        const presente =
          data?.presente ??
          data?.ok ??
          (typeof data?.status === "string" && data.status.toLowerCase() === "ok");

        if (presente) {
          setMensagem("✅ Certificado validado com sucesso!");
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

  const tone = {
    sucesso: "text-green-700 dark:text-green-400",
    erro: "text-red-600 dark:text-red-400",
    pendente: "text-yellow-700 dark:text-yellow-400",
    loading: "text-gray-700 dark:text-gray-300",
  }[status];

  const badge = {
    sucesso: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Validado
      </span>
    ),
    pendente: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <Clock className="w-4 h-4" /> Pendente
      </span>
    ),
    erro: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <XCircle className="w-4 h-4" /> Inválido
      </span>
    ),
    loading: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
        Verificando…
      </span>
    ),
  }[status];

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      {/* 🟨 Faixa de título (certificados = dourado) */}
      <PageHeader title="Validar Certificado" icon={Award} variant="dourado" />

      <main id="conteudo" role="main" className="flex-1">
        <section
          aria-label="Validação de Certificado"
          aria-live="polite"
          aria-atomic="true"
          className="min-h-[60vh] flex items-center justify-center px-4 py-10 print:p-0 print:min-h-0"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 shadow-lg rounded-2xl p-6 sm:p-8 print:shadow-none print:bg-white"
          >
            {/* Mensagem principal */}
            <p
              className={`text-lg sm:text-xl font-semibold mb-4 text-center transition-colors ${tone} ${
                status === "sucesso" ? "animate-pulse" : ""
              }`}
              role={status === "erro" ? "alert" : "status"}
            >
              {mensagem}
            </p>

            {/* Badge de status */}
            <div className="flex justify-center mb-6">{badge}</div>

            {/* Debug */}
            {isDebug && detalhe && (
              <p className="text-xs sm:text-sm text-slate-500 mb-4 break-words">{detalhe}</p>
            )}

            {/* Estados de erro/pendente */}
            {(status === "pendente" || status === "erro") && (
              <div className="mt-2">
                <NadaEncontrado
                  mensagem={mensagem}
                  sugestao="Verifique os dados do certificado ou tente novamente mais tarde."
                />
              </div>
            )}

            {/* Skeleton enquanto carrega */}
            {status === "loading" && <CarregandoSkeleton height="120px" />}

            {/* Cartão de detalhes quando sucesso (renderiza só o que existir) */}
            {status === "sucesso" && (
              <div className="rounded-xl border border-black/5 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 p-4 sm:p-5">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {meta?.nome ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Participante</dt>
                      <dd className="font-medium">{meta.nome}</dd>
                    </div>
                  ) : null}
                  {meta?.cpf ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">CPF</dt>
                      <dd className="font-medium">{maskCPF(meta.cpf)}</dd>
                    </div>
                  ) : null}
                  {meta?.evento_titulo ? (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500 dark:text-slate-400">Evento</dt>
                      <dd className="font-medium">{meta.evento_titulo}</dd>
                    </div>
                  ) : null}
                  {meta?.periodo ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Período</dt>
                      <dd className="font-medium">{meta.periodo}</dd>
                    </div>
                  ) : null}
                  {meta?.carga_horaria ? (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Carga horária</dt>
                      <dd className="font-medium">{meta.carga_horaria} h</dd>
                    </div>
                  ) : null}
                  {meta?.hash ? (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500 dark:text-slate-400">Cód. verificação</dt>
                      <dd className="font-mono text-xs sm:text-sm mt-0.5">{meta.hash}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            )}

            {/* Ações (print/copy) */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
              <BotaoPrimario onClick={() => window.print()} aria-label="Imprimir esta página">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir esta página
              </BotaoPrimario>

              {(usuario && evento) && (
                <button
                  onClick={copiarLink}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  aria-label="Copiar link de validação"
                >
                  <Copy className="w-4 h-4" />
                  Copiar link
                </button>
              )}
            </div>

            {/* Rodapé da verificação */}
            {dataHora && (
              <footer className="mt-8 text-xs sm:text-sm text-slate-500 text-center print:mt-14 print:text-black w-full">
                Verificação realizada em: <strong>{dataHora}</strong>
              </footer>
            )}
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
