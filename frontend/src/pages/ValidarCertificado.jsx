// ✅ frontend/src/pages/ValidarCertificado.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  Hash,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifyInfo, notifySuccess } from "../components/ui/AppToast";
import { api } from "../services/api";
import { formatDateTimeBr } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contrato oficial esperado no api.js
 * ─────────────────────────────────────────────
 *
 * api.certificado.validarPublico(codigo_validacao)
 *
 * Rota pública esperada:
 * GET /api/certificado/validar/:codigo_validacao
 *
 * Regra v2.0:
 * - Validação pública somente por codigo_validacao.
 * - Sem usuario_id/evento_id/turma_id na validação pública.
 * - Sem chamada para presença.
 * - Sem expor CPF integral.
 */

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function extrairData(response) {
  return response?.data ?? response ?? null;
}

function obterMensagemErro(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function validarFacade(nome, fn) {
  if (typeof fn !== "function") {
    throw new Error(`Facade ausente no api.js: ${nome}.`);
  }
}

function normalizarCodigo(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function codigoValidoFormato(value) {
  return /^[A-Z0-9-]{8,140}$/.test(String(value || ""));
}

function safeText(value, fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getCodigoFromPayload(payload) {
  return (
    payload?.codigo_validacao ||
    payload?.certificado?.codigo_validacao ||
    payload?.data?.codigo_validacao ||
    ""
  );
}

function getCertificado(payload) {
  if (!payload || typeof payload !== "object") return null;

  if (payload.certificado && typeof payload.certificado === "object") {
    return payload.certificado;
  }

  return payload;
}

function getStatusCertificado(certificado) {
  return String(certificado?.status || "").trim().toLowerCase();
}

function certificadoEstaValido(certificado, payload) {
  if (payload?.valido === true) return true;
  if (payload?.validado === true) return true;

  const status = getStatusCertificado(certificado);

  return status === "emitido" || status === "enviado";
}

function statusVisual(certificado, payload) {
  if (!certificado && payload?.ok === false) {
    return {
      estado: "invalido",
      label: "Não localizado",
      titulo: "Certificado não localizado",
      mensagem:
        payload?.message ||
        "Não encontramos certificado válido para o código informado.",
    };
  }

  const status = getStatusCertificado(certificado);

  if (certificadoEstaValido(certificado, payload)) {
    return {
      estado: "valido",
      label: "Válido",
      titulo: "Certificado validado com sucesso",
      mensagem:
        "Este certificado foi localizado na base oficial da Escola Municipal de Saúde Pública.",
    };
  }

  if (status === "cancelado") {
    return {
      estado: "cancelado",
      label: "Cancelado",
      titulo: "Certificado cancelado",
      mensagem:
        "Este certificado foi localizado, mas está cancelado administrativamente.",
    };
  }

  if (status === "anulado") {
    return {
      estado: "anulado",
      label: "Anulado",
      titulo: "Certificado anulado",
      mensagem:
        "Este certificado foi localizado, mas foi anulado administrativamente.",
    };
  }

  if (status === "substituido") {
    return {
      estado: "substituido",
      label: "Substituído",
      titulo: "Certificado substituído",
      mensagem:
        "Este certificado foi substituído por uma nova emissão documental.",
    };
  }

  if (status === "erro_emissao") {
    return {
      estado: "erro",
      label: "Erro técnico",
      titulo: "Certificado com erro de emissão",
      mensagem:
        "Este certificado possui registro de erro técnico e não deve ser usado como documento válido.",
    };
  }

  return {
    estado: "invalido",
    label: "Inválido",
    titulo: "Certificado inválido",
    mensagem:
      "O certificado não está em situação válida para autenticação pública.",
  };
}

function toneByEstado(estado) {
  if (estado === "valido") {
    return {
      icon: CheckCircle2,
      text: "text-emerald-700 dark:text-emerald-300",
      badge:
        "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
      panel:
        "bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-800/60",
      bar: "from-emerald-700 via-emerald-500 to-cyan-500",
    };
  }

  if (estado === "cancelado" || estado === "anulado" || estado === "substituido") {
    return {
      icon: AlertTriangle,
      text: "text-amber-700 dark:text-amber-300",
      badge:
        "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
      panel:
        "bg-amber-50 ring-amber-100 dark:bg-amber-950/30 dark:ring-amber-800/60",
      bar: "from-amber-700 via-orange-500 to-rose-500",
    };
  }

  return {
    icon: XCircle,
    text: "text-rose-700 dark:text-rose-300",
    badge:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    panel:
      "bg-rose-50 ring-rose-100 dark:bg-rose-950/30 dark:ring-rose-800/60",
    bar: "from-rose-800 via-rose-600 to-orange-500",
  };
}

function getCampo(certificado, ...keys) {
  for (const key of keys) {
    const value = certificado?.[key];

    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function formatarCarga(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);

  if (Number.isFinite(number) && number > 0) {
    return `${number} h`;
  }

  return String(value);
}

function getPeriodo(certificado) {
  const periodo = getCampo(certificado, "periodo");

  if (periodo) return periodo;

  const inicio = getCampo(certificado, "data_inicio");
  const fim = getCampo(certificado, "data_fim");

  if (inicio && fim) return `${inicio} a ${fim}`;
  if (inicio) return String(inicio);

  return "—";
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function Badge({ tone, children }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1",
        tone
      )}
    >
      {children}
    </span>
  );
}

function InfoItem({ label, value, mono = false, full = false }) {
  if (!value || value === "—") return null;

  return (
    <div
      className={cx(
        "rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800",
        full && "sm:col-span-2"
      )}
    >
      <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={cx(
          "mt-1 break-words text-sm font-bold text-slate-900 dark:text-zinc-100",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function HeroValidacao({ codigo }) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-cyan-900 text-white print:bg-white print:text-black">
      <div className="absolute inset-0 opacity-30 print:hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-400 blur-3xl" />
        <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-cyan-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-amber-500 blur-3xl" />
      </div>

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-950"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-9 print:px-0 print:py-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20 backdrop-blur print:bg-white print:text-black print:ring-slate-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Validação pública EMSP-SMS
        </div>

        <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
          Validar certificado
        </h1>

        <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base print:text-slate-700">
          Consulte a autenticidade de certificados eletrônicos emitidos pela
          Escola Municipal de Saúde Pública da Secretaria Municipal de Saúde.
        </p>

        {codigo ? (
          <div className="mt-5 rounded-3xl bg-white/10 p-4 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur print:bg-slate-50 print:text-slate-800 print:ring-slate-200">
            <div className="flex items-start gap-3">
              <Hash className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="break-all">
                Código consultado: <strong>{codigo}</strong>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function ResultadoValidacao({
  statusInfo,
  certificado,
  codigo,
  dataHora,
  linkValidacao,
  onCopiar,
  onRevalidar,
  loading,
}) {
  const visual = toneByEstado(statusInfo.estado);
  const Icon = visual.icon;

  const numero = getCampo(certificado, "numero_certificado", "numero");
  const codigoValidacao =
    getCodigoFromPayload(certificado) || getCampo(certificado, "codigo_validacao") || codigo;

  const nome = getCampo(certificado, "nome", "participante", "usuario_nome");
  const identificador = getCampo(
    certificado,
    "identificador_mascarado",
    "cpf_mascarado",
    "documento_mascarado"
  );
  const evento = getCampo(
    certificado,
    "evento_titulo",
    "evento",
    "curso",
    "titulo"
  );
  const turma = getCampo(certificado, "turma_nome", "nome_turma");
  const tipo = getCampo(certificado, "tipo", "modalidade");
  const carga = getCampo(certificado, "carga_horaria");
  const periodo = getPeriodo(certificado);
  const emitidoEm = getCampo(
    certificado,
    "gerado_em",
    "emitido_em",
    "data_emissao"
  );
  const hashPdf = getCampo(certificado, "hash_pdf");
  const hashDados = getCampo(certificado, "hash_dados");

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800 print:rounded-none print:shadow-none print:ring-slate-300"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className={cx("h-2 bg-gradient-to-r", visual.bar)} aria-hidden="true" />

      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Badge tone={visual.badge}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {statusInfo.label}
            </Badge>

            <h2 className={cx("mt-4 text-2xl font-black", visual.text)}>
              {statusInfo.titulo}
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-zinc-300">
              {statusInfo.mensagem}
            </p>
          </div>

          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-slate-50 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800 print:hidden">
            <QrCode className="h-7 w-7 text-slate-700 dark:text-zinc-200" />
          </div>
        </div>

        {certificado ? (
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoItem label="Certificado nº" value={numero || "—"} mono />
            <InfoItem label="Código de validação" value={codigoValidacao} mono />
            <InfoItem label="Participante" value={nome} />
            <InfoItem label="Identificador" value={identificador} />
            <InfoItem label="Evento/curso" value={evento} full />
            <InfoItem label="Turma" value={turma} />
            <InfoItem label="Tipo/modalidade" value={tipo} />
            <InfoItem label="Período" value={periodo} />
            <InfoItem label="Carga horária" value={formatarCarga(carga)} />
            <InfoItem label="Emitido em" value={emitidoEm} />
            <InfoItem label="Status documental" value={getStatusCertificado(certificado) || "—"} />
            <InfoItem label="Hash do PDF" value={hashPdf} mono full />
            <InfoItem label="Hash dos dados" value={hashDados} mono full />
          </dl>
        ) : (
          <div className={cx("mt-6 rounded-3xl p-4 ring-1", visual.panel)}>
            <NadaEncontrado
              titulo="Código não validado"
              descricao="Confira se o código de validação foi digitado exatamente como aparece no certificado."
            />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center print:hidden">
          <Botao type="button" variant="primary" onClick={() => window.print()}>
            <span className="inline-flex items-center gap-2">
              <Printer className="h-4 w-4" aria-hidden="true" />
              Imprimir
            </span>
          </Botao>

          <Botao type="button" variant="secondary" onClick={onCopiar}>
            <span className="inline-flex items-center gap-2">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar link
            </span>
          </Botao>

          <Botao type="button" variant="secondary" onClick={onRevalidar} disabled={loading}>
            <span className="inline-flex items-center gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              )}
              Validar novamente
            </span>
          </Botao>
        </div>

        <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800 print:bg-white">
          <p className="font-black text-slate-950 dark:text-white">
            Validação pública — Escola Municipal de Saúde Pública / SMS
          </p>
          <p className="mt-1 break-all">
            Link de validação:{" "}
            <a
              href={linkValidacao}
              className="font-bold text-emerald-700 underline underline-offset-2 dark:text-emerald-300"
            >
              {linkValidacao}
            </a>
          </p>
          {dataHora ? (
            <p className="mt-1">
              Verificação realizada em: <strong>{dataHora}</strong>
            </p>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function ValidarCertificado() {
  const reduceMotion = useReducedMotion();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const codigo = useMemo(() => {
    return normalizarCodigo(
      params?.codigo_validacao || searchParams.get("codigo_validacao") || ""
    );
  }, [params?.codigo_validacao, searchParams]);

  const [status, setStatus] = useState("idle");
  const [erro, setErro] = useState("");
  const [payload, setPayload] = useState(null);
  const [dataHora, setDataHora] = useState("");

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const linkValidacao = useMemo(() => {
    if (typeof window === "undefined") return "";

    if (!codigo) return window.location.href;

    return `${window.location.origin}/validar-certificado/${encodeURIComponent(codigo)}`;
  }, [codigo]);

  const certificado = useMemo(() => {
    return getCertificado(payload);
  }, [payload]);

  const statusInfo = useMemo(() => {
    return statusVisual(certificado, payload);
  }, [certificado, payload]);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const validarCertificado = useCallback(async () => {
    if (!codigo) {
      setStatus("erro");
      setErro("Código de validação não informado.");
      setPayload(null);
      setLive("Código de validação não informado.");
      return;
    }

    if (!codigoValidoFormato(codigo)) {
      setStatus("erro");
      setErro("Código de validação em formato inválido.");
      setPayload(null);
      setLive("Código de validação inválido.");
      return;
    }

    try {
      validarFacade("api.certificado.validarPublico", api?.certificado?.validarPublico);

      setStatus("loading");
      setErro("");
      setPayload(null);
      setDataHora(formatDateTimeBr(new Date()));
      setLive("Validando certificado.");

      const response = await api.certificado.validarPublico(codigo);
      const data = extrairData(response);

      if (!mountedRef.current) return;

      setPayload(data);
      setStatus("done");
      setLive("Validação concluída.");
    } catch (error) {
      console.error("[ValidarCertificado] erro:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Não foi possível validar o certificado. Confira o código e tente novamente."
      );

      setErro(message);
      setPayload(null);
      setStatus("erro");
      setDataHora(formatDateTimeBr(new Date()));
      setLive("Erro ao validar certificado.");
    }
  }, [codigo, setLive]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Validar Certificado | Escola da Saúde";

    validarCertificado();

    return () => {
      mountedRef.current = false;
    };
  }, [validarCertificado]);

  const copiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(linkValidacao);
      notifySuccess("Link de validação copiado.");
      setLive("Link de validação copiado.");
    } catch {
      notifyInfo("Copie manualmente o link exibido no navegador.");
      setLive("Não foi possível copiar automaticamente.");
    }
  }, [linkValidacao, setLive]);

  const loading = status === "loading";

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white print:bg-white print:text-black">
      <HeroValidacao codigo={codigo} />

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {loading ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-emerald-100 dark:bg-emerald-950 print:hidden"
          role="progressbar"
          aria-label="Validando certificado"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-emerald-700",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 print:px-0"
      >
        {loading ? (
          <section className="rounded-[1.75rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-zinc-300">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Validando certificado...
            </div>

            <div className="mt-5 space-y-3">
              <CarregandoSkeleton height={70} />
              <CarregandoSkeleton height={140} />
              <CarregandoSkeleton height={90} />
            </div>
          </section>
        ) : status === "erro" ? (
          <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
            <div className="h-2 bg-gradient-to-r from-rose-800 via-rose-600 to-orange-500" />

            <div className="p-5 sm:p-7">
              <Badge tone={toneByEstado("invalido").badge}>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Inválido
              </Badge>

              <h2 className="mt-4 text-2xl font-black text-rose-700 dark:text-rose-300">
                Não foi possível validar o certificado
              </h2>

              <ErroCarregamento
                mensagem={erro || "Código inválido ou certificado não localizado."}
                onRetry={validarCertificado}
              />

              <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
                <p className="font-black text-slate-950 dark:text-white">
                  Conferência necessária
                </p>
                <p className="mt-1">
                  Verifique se o código de validação foi informado exatamente
                  como aparece no certificado, incluindo hífens.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <ResultadoValidacao
            statusInfo={statusInfo}
            certificado={certificado}
            codigo={codigo}
            dataHora={dataHora}
            linkValidacao={linkValidacao}
            onCopiar={copiarLink}
            onRevalidar={validarCertificado}
            loading={loading}
          />
        )}

        <section className="rounded-[1.5rem] bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 print:hidden">
          <div className="flex items-start gap-3">
            <FileCheck2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300"
              aria-hidden="true"
            />

            <div>
              <p className="font-black text-slate-950 dark:text-white">
                Como funciona a validação?
              </p>
              <p className="mt-1">
                Cada certificado emitido possui número oficial, código único de
                validação, QR Code e hashes documentais. A consulta pública não
                exige login e não expõe CPF integral.
              </p>

              {codigo ? (
                <a
                  href={linkValidacao}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-700 underline underline-offset-2 dark:text-emerald-300"
                >
                  Abrir link público
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}