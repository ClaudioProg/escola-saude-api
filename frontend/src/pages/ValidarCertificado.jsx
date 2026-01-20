// ✅ src/pages/ValidarCertificado.jsx — premium/robusto
import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

import BotaoPrimario from "../components/BotaoPrimario";
import NadaEncontrado from "../components/NadaEncontrado";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import { formatarDataHoraBrasileira } from "../utils/dateTime";
import { apiGet } from "../services/api";

import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

import { Award, CheckCircle2, XCircle, Clock, Copy, Printer } from "lucide-react";

/* Utils locais */
function maskCPF(cpf) {
  if (!cpf) return "—";
  const s = String(cpf).replace(/\D/g, "");
  if (s.length !== 11) return cpf;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`.replace(
    /\d(?=\d{4})/g,
    "•"
  );
}

function safeUnwrapApi(res) {
  // aceita tanto objeto direto quanto { data }
  if (res && typeof res === "object" && "data" in res) return res.data;
  return res;
}

function useQueryParams() {
  const [sp] = useSearchParams();

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
  const mountedRef = useRef(true);

  const [mensagem, setMensagem] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState("loading"); // loading | sucesso | pendente | erro
  const [dataHora, setDataHora] = useState("");
  const [meta, setMeta] = useState(null); // { nome, cpf, evento_titulo, carga_horaria, periodo, hash, ... }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = (fn) => {
    if (mountedRef.current) fn();
  };

  // link atual (para copiar)
  const linkValidacao = useMemo(() => {
    const url = new URL(window.location.href);
    if (usuario) url.searchParams.set("usuario", usuario);
    if (evento) url.searchParams.set("evento", evento);
    return url.toString();
  }, [usuario, evento]);

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);
      toast.success("Link copiado ✅");
      setDetalhe("Link copiado para a área de transferência.");
    } catch {
      // fallback menos invasivo
      toast.info("Copie manualmente o link exibido no endereço do navegador.");
      setDetalhe("Não foi possível copiar automaticamente (permissão do navegador).");
    }
  };

  useEffect(() => {
    safeSet(() => setDataHora(formatarDataHoraBrasileira(new Date())));

    if (!usuario || !evento) {
      safeSet(() => {
        setMensagem("❌ Link inválido. Parâmetros ausentes.");
        setStatus("erro");
      });
      return;
    }

    safeSet(() => {
      setStatus("loading");
      setMensagem("Verificando…");
      setDetalhe("");
    });

    (async () => {
      try {
        if (isDebug) console.log("[ValidarCertificado] /presencas/validar", { evento, usuario });

        const res = await apiGet("presencas/validar", {
          on403: "silent",
          query: { evento, usuario },
        });

        const data = safeUnwrapApi(res);

        const metaData = {
          nome: data?.nome ?? data?.aluno ?? data?.participante ?? "",
          cpf: data?.cpf ?? data?.documento ?? "",
          evento_titulo: data?.evento_titulo ?? data?.evento ?? "",
          carga_horaria: data?.carga_horaria ?? data?.cargaHoraria ?? "",
          periodo: data?.periodo ?? data?.data ?? "",
          hash: data?.hash ?? data?.codigo ?? sp.get("codigo") ?? sp.get("c") ?? "",
        };

        safeSet(() => setMeta(metaData));

        const presente =
          data?.presente ??
          data?.ok ??
          (typeof data?.status === "string" && data.status.toLowerCase() === "ok");

        if (presente) {
          safeSet(() => {
            setMensagem("✅ Certificado validado com sucesso!");
            setStatus("sucesso");
          });
        } else {
          safeSet(() => {
            setMensagem("⚠️ Certificado encontrado, mas presença ainda não registrada para este evento.");
            setStatus("pendente");
          });
        }
      } catch (e) {
        if (isDebug) {
          console.error("[ValidarCertificado] erro:", e);
          safeSet(() =>
            setDetalhe(
              (e?.data?.erro || e?.message || String(e)) +
                " — verifique conexão, CORS e disponibilidade do endpoint."
            )
          );
        }

        safeSet(() => {
          setMensagem("❌ Erro ao validar. Tente novamente mais tarde.");
          setStatus("erro");
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, evento, isDebug]);

  const tone = {
    sucesso: "text-green-700 dark:text-green-400",
    erro: "text-red-600 dark:text-red-400",
    pendente: "text-yellow-700 dark:text-yellow-400",
    loading: "text-gray-800 dark:text-gray-200",
  }[status];

  const badge = {
    sucesso: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" /> Validado
      </span>
    ),
    pendente: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <Clock className="w-4 h-4" /> Pendente
      </span>
    ),
    erro: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <XCircle className="w-4 h-4" /> Inválido
      </span>
    ),
    loading: (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200">
        Verificando…
      </span>
    ),
  }[status];

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
  };

  const renderMetaBox = (mode = "normal") => {
    if (!meta) return null;

    const showHash = !!meta?.hash;
    const showAny =
      meta?.nome || meta?.cpf || meta?.evento_titulo || meta?.periodo || meta?.carga_horaria || showHash;

    if (!showAny) return null;

    return (
      <div
        className={[
          "rounded-xl border border-black/5 dark:border-white/10 p-4 sm:p-5",
          mode === "print"
            ? "bg-white"
            : "bg-zinc-50/70 dark:bg-zinc-800/60",
        ].join(" ")}
      >
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

          {showHash ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500 dark:text-slate-400">Cód. verificação</dt>
              <dd className="font-mono text-xs sm:text-sm mt-0.5 break-all">{meta.hash}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    );
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
            <p
              className={`text-lg sm:text-xl font-semibold mb-4 text-center transition-colors ${tone}`}
              role={status === "erro" ? "alert" : "status"}
            >
              {mensagem}
            </p>

            <div className="flex justify-center mb-6">{badge}</div>

            {isDebug && detalhe && (
              <p className="text-xs sm:text-sm text-slate-500 mb-4 break-words">{detalhe}</p>
            )}

            {status === "loading" && <CarregandoSkeleton height="120px" />}

            {/* Meta sempre que possível (sucesso E pendente) */}
            {(status === "sucesso" || status === "pendente") && (
              <div className="mt-1">{renderMetaBox()}</div>
            )}

            {(status === "pendente" || status === "erro") && (
              <div className="mt-4">
                <NadaEncontrado
                  mensagem={mensagem}
                  sugestao="Verifique os dados do certificado ou tente novamente mais tarde."
                />
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 print:hidden">
              <BotaoPrimario type="button" onClick={() => window.print()} aria-label="Imprimir esta página">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </BotaoPrimario>

              {usuario && evento && (
                <button
                  type="button"
                  onClick={copiarLink}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                  aria-label="Copiar link de validação"
                >
                  <Copy className="w-4 h-4" />
                  Copiar link
                </button>
              )}
            </div>

            {/* Selo para impressão (fica bonito e oficial) */}
            <div className="hidden print:block mt-10">
              <div className="border-t pt-6">
                <p className="text-sm font-semibold">Validação pública — Escola Municipal de Saúde de Santos</p>
                <p className="text-xs mt-1">Link de validação: {linkValidacao}</p>
                {renderMetaBox("print")}
              </div>
            </div>

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
