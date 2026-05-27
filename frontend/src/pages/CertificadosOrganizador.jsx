// ✅ frontend/src/pages/Certificadosorganizador.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  FilePlus2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";
import { api } from "../services/api";
import { downloadBlob } from "../utils/downloadArquivo";
import { formatDateBr, extractYmd } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.certificado.elegivelorganizador(params?)
 * api.certificado.gerar({ usuario_id, evento_id, turma_id, tipo })
 * api.certificado.download(certificado_id)
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

function getUsuarioLogado() {
  try {
    const raw = localStorage.getItem("usuario");
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") return null;

    const id = Number(parsed.id);

    return {
      ...parsed,
      id: Number.isInteger(id) && id > 0 ? id : null,
      nome: parsed.nome || "",
      perfil: parsed.perfil || "",
      perfis: parsed.perfis || [],
    };
  } catch {
    return null;
  }
}

function getPerfisUsuario(usuario) {
  const raw = usuario?.perfis ?? usuario?.perfil ?? [];

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  return String(raw)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function usuarioAdministrador(usuario) {
  return getPerfisUsuario(usuario).includes("administrador");
}

function dataBR(value) {
  const iso = extractYmd(value);

  return iso ? formatDateBr(iso) : "—";
}

function periodoCertificado(certificado) {
  const inicio =
    certificado?.data_inicio || certificado?.inicio || certificado?.di || null;
  const fim =
    certificado?.data_fim || certificado?.fim || certificado?.df || inicio;

  if (!inicio && !fim) return "Período não informado";

  return `${dataBR(inicio)} até ${dataBR(fim)}`;
}

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(value) {
  const nome = String(value || "certificado_organizador")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return nome || "certificado_organizador";
}

function obterTitulo(certificado) {
  return (
    certificado?.evento ||
    certificado?.evento_titulo ||
    certificado?.nome_evento ||
    certificado?.titulo ||
    "Evento"
  );
}

function obterTurma(certificado) {
  return (
    certificado?.nome_turma ||
    certificado?.turma_nome ||
    (certificado?.turma_id ? `Turma #${certificado.turma_id}` : "Turma")
  );
}

function isStatusCertificadoValido(status) {
  return status === "emitido" || status === "enviado";
}

function getNumeroCertificado(certificado) {
  return certificado?.numero_certificado || certificado?.numero || "";
}

function getNumeroCertificadoLabel(certificado) {
  return getNumeroCertificado(certificado) || "Número gerado na emissão";
}

function getCertificadoState(certificado) {
  const certificadoId = certificado?.certificado_id || certificado?.id;
  const status = certificado?.status || "";

  if (certificadoId && isStatusCertificadoValido(status || "emitido")) {
    return {
      estado: "pronto",
      label: "Emitido",
      motivo: "",
    };
  }

  if (status && !isStatusCertificadoValido(status)) {
    return {
      estado: "bloqueado",
      label: "Indisponível",
      motivo: `Certificado com status ${status}.`,
    };
  }

  if (certificado?.pode_gerar === false) {
    return {
      estado: "pendente",
      label: "Pendente",
      motivo:
        certificado?.motivo_bloqueio ||
        certificado?.motivo ||
        "Ainda não liberado.",
    };
  }

  return {
    estado: "geravel",
    label: "Disponível",
    motivo: "",
  };
}

function deduplicarCertificadosorganizador(lista) {
  const seen = new Set();
  const out = [];

  for (const item of Array.isArray(lista) ? lista : []) {
    const tipo = item?.tipo || "organizador";
    const eventoId = Number(item?.evento_id || 0) || null;
    const turmaId = Number(item?.turma_id || 0) || null;

    if (tipo !== "organizador") continue;
    if (!eventoId || !turmaId) continue;

    const key = `organizador-${eventoId}-${turmaId}`;

    if (seen.has(key)) continue;

    seen.add(key);

    out.push({
      ...item,
      tipo,
      evento_id: eventoId,
      turma_id: turmaId,
      certificado_id: item?.certificado_id || item?.id || null,
      numero_certificado: item?.numero_certificado || "",
      codigo_validacao: item?.codigo_validacao || "",
      ja_gerado: Boolean(item?.ja_gerado || item?.certificado_id || item?.id),
    });
  }

  return out;
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function MiniStat({ icon: Icon, label, value, description, tone = "amber" }) {
  const tones = {
    amber:
      "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900",
    emerald:
      "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900",
    orange:
      "bg-orange-50 text-orange-900 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-100 dark:ring-orange-900",
  };

  return (
    <div className={cx("rounded-[1.5rem] p-4 ring-1 shadow-sm", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-75">
            {label}
          </p>

          <p className="mt-2 text-3xl font-black">{Number(value) || 0}</p>

          {description ? (
            <p className="mt-1 text-xs opacity-75">{description}</p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
      
function Badge({ tone = "slate", children }) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
    emerald:
      "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800/60",
    amber:
      "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/60",
    rose:
      "bg-rose-50 text-rose-800 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-800/60",
    cyan:
      "bg-cyan-50 text-cyan-800 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/60",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function Toolbar({
  busca,
  setBusca,
  somentePendentes,
  setSomentePendentes,
  carregando,
  onRefresh,
}) {
  return (
    <section
      aria-label="Filtros de certificados de organizador"
      className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por evento, turma, número ou código..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            aria-label="Buscar certificado de organizador"
          />

          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSomentePendentes((value) => !value)}
            className={cx(
              "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black ring-1 transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
              somentePendentes
                ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800"
                : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900"
            )}
            aria-pressed={somentePendentes}
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
            {somentePendentes ? "Só a emitir" : "Todos"}
          </button>

          <Botao
  type="button"
  variant="contorno"
  onClick={onRefresh}
  disabled={carregando}
>
            <span className="inline-flex items-center gap-2">
              <RefreshCw
                className={cx("h-4 w-4", carregando && "animate-spin")}
                aria-hidden="true"
              />
              Recarregar
            </span>
          </Botao>
        </div>
      </div>
    </section>
  );
}

function CertificadoCard({
  certificado,
  reduceMotion,
  gerando,
  baixando,
  busyGerar,
  busyBaixar,
  onGerar,
  onBaixar,
}) {
  const state = getCertificadoState(certificado);
  const titulo = obterTitulo(certificado);
  const turma = obterTurma(certificado);
  const periodo = periodoCertificado(certificado);
  const numeroCertificado = getNumeroCertificado(certificado);

  const tone =
    state.estado === "pronto"
      ? "from-emerald-700 via-emerald-500 to-emerald-400"
      : state.estado === "geravel"
        ? "from-amber-700 via-orange-500 to-yellow-400"
        : "from-slate-700 via-slate-600 to-slate-500";

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
      aria-busy={gerando || baixando ? "true" : "false"}
    >
      <div className={cx("h-1.5 bg-gradient-to-r", tone)} aria-hidden="true" />

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              {titulo}
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
              {turma}
            </p>

            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {periodo}
            </p>
          </div>

          <Badge
            tone={
              state.estado === "pronto"
                ? "emerald"
                : state.estado === "geravel"
                  ? "amber"
                  : "slate"
            }
          >
            {state.estado === "pronto" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : state.estado === "geravel" ? (
              <FilePlus2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {state.label}
          </Badge>
        </div>

        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/60">
          Certificado nº:{" "}
          <span className="font-black">
            {numeroCertificado || getNumeroCertificadoLabel(certificado)}
          </span>
        </div>

        {certificado?.codigo_validacao ? (
          <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
            Código de validação:{" "}
            <span className="font-black">{certificado.codigo_validacao}</span>
          </p>
        ) : null}

        {state.motivo ? (
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
            {state.motivo}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          {state.estado === "pronto" ? (
            <Botao
  type="button"
  variant="contraste"
  onClick={() => onBaixar(certificado)}
  disabled={baixando || busyBaixar}
>
              <span className="inline-flex items-center gap-2">
                {baixando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {baixando ? "Baixando..." : "Baixar"}
              </span>
            </Botao>
          ) : (
            <Botao
  type="button"
  variant="sucesso"
  onClick={() => onGerar(certificado)}
              disabled={
                gerando ||
                busyGerar ||
                state.estado === "pendente" ||
                state.estado === "bloqueado"
              }
            >
              <span className="inline-flex items-center gap-2">
                {gerando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                )}
                {gerando ? "Emitindo..." : "Emitir certificado"}
              </span>
            </Botao>
          )}
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function Certificadosorganizador() {
  const reduceMotion = useReducedMotion();
  const usuario = useMemo(() => getUsuarioLogado(), []);

  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);

  const [gerandoKey, setGerandoKey] = useState(null);
  const [baixandoKey, setBaixandoKey] = useState(null);
  const [busyGerar, setBusyGerar] = useState(false);
  const [busyBaixar, setBusyBaixar] = useState(false);

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const keyCertificado = useCallback((certificado) => {
    return `organizador-${certificado?.evento_id || "evento"}-${certificado?.turma_id || "turma"}`;
  }, []);

  const carregarCertificados = useCallback(async () => {
    try {
      validarFacade("api.certificado.elegivel", api?.certificado?.elegivel);

      setCarregando(true);
      setErro("");
      setLive("Carregando certificados de organizador.");

      const params = new URLSearchParams(window.location.search);
      const usuarioIdUrl = Number(params.get("usuario_id"));
      const deveEnviarUsuarioId =
        usuarioAdministrador(usuario) &&
        Number.isInteger(usuarioIdUrl) &&
        usuarioIdUrl > 0;

      const response = await api.certificado.elegivel(
  deveEnviarUsuarioId ? { usuario_id: usuarioIdUrl } : undefined
);

      const data = extrairData(response);
      const lista = Array.isArray(data) ? data : [];

      const certificadosNormalizados = deduplicarCertificadosorganizador(lista);

      if (!mountedRef.current) return;

      setCertificados(certificadosNormalizados);

      setLive(
        certificadosNormalizados.length
          ? `${certificadosNormalizados.length} certificado(s) de organizador encontrado(s).`
          : "Nenhum certificado de organizador encontrado."
      );
    } catch (error) {
      console.error("[Certificadosorganizador] erro ao carregar:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Erro ao carregar certificados de organizador."
      );

      setErro(message);
      setCertificados([]);
      notifyError(message);
      setLive("Erro ao carregar certificados de organizador.");
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [usuario, setLive]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Certificados do organizador | Escola da Saúde";
    carregarCertificados();

    return () => {
      mountedRef.current = false;
    };
  }, [carregarCertificados]);

  const gerarCertificado = useCallback(
    async (certificado) => {
      if (busyGerar) return;

      if (!usuario?.id) {
        notifyError("Usuário não identificado. Faça login novamente.");
        return;
      }

      const eventoId = Number(certificado?.evento_id);
      const turmaId = Number(certificado?.turma_id);

      if (
        !Number.isInteger(eventoId) ||
        eventoId <= 0 ||
        !Number.isInteger(turmaId) ||
        turmaId <= 0
      ) {
        notifyError("Dados do certificado inválidos para emissão.");
        return;
      }

      try {
        validarFacade("api.certificado.gerar", api?.certificado?.gerar);

        const key = keyCertificado(certificado);

        setBusyGerar(true);
        setGerandoKey(key);
        setLive("Emitindo certificado de organizador.");

        const response = await api.certificado.gerar({
          usuario_id: Number(usuario.id),
          evento_id: eventoId,
          turma_id: turmaId,
          tipo: "organizador",
        });

        const envelope = response || {};
        const data = extrairData(response);

        notifySuccess(
          envelope?.code === "CERTIFICADO_JA_EMITIDO"
            ? "Certificado já estava emitido. O documento existente foi preservado."
            : "Certificado de organizador emitido com sucesso."
        );

        setCertificados((prev) =>
          prev.map((item) => {
            if (
              Number(item.evento_id) === eventoId &&
              Number(item.turma_id) === turmaId
            ) {
              return {
                ...item,
                certificado_id: data?.id || data?.certificado_id || item.certificado_id,
                numero_certificado:
                  data?.numero_certificado || item.numero_certificado,
                codigo_validacao:
                  data?.codigo_validacao || item.codigo_validacao,
                arquivo_pdf: data?.arquivo_pdf || item.arquivo_pdf,
                status: data?.status || "emitido",
                ja_gerado: true,
              };
            }

            return item;
          })
        );

        await carregarCertificados();
      } catch (error) {
        console.error("[Certificadosorganizador] erro ao emitir:", error);

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível emitir o certificado de organizador."
          )
        );
        setLive("Erro ao emitir certificado de organizador.");
      } finally {
        setGerandoKey(null);
        setBusyGerar(false);
      }
    },
    [busyGerar, usuario?.id, keyCertificado, carregarCertificados, setLive]
  );

  const baixarCertificado = useCallback(
    async (certificado) => {
      if (busyBaixar) return;

      const certificadoId = Number(certificado?.certificado_id || certificado?.id);

      if (!Number.isInteger(certificadoId) || certificadoId <= 0) {
        notifyWarning("Certificado sem ID para download.");
        return;
      }

      try {
        validarFacade("api.certificado.download", api?.certificado?.download);

        const key = keyCertificado(certificado);

        setBusyBaixar(true);
        setBaixandoKey(key);
        setLive("Baixando certificado de organizador.");

        const result = await api.certificado.download(certificadoId);

        const blob = result?.blob || result?.data || result;
        const filename =
          result?.filename ||
          `${nomeArquivoSeguro(
            getNumeroCertificado(certificado) ||
              `certificado_organizador_${obterTitulo(certificado)}_turma_${
                certificado?.turma_id || certificadoId
              }`
          )}.pdf`;

        downloadBlob(filename, blob);
        notifySuccess("Download iniciado.");
      } catch (error) {
        console.error("[Certificadosorganizador] erro ao baixar:", error);

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível baixar o certificado de organizador."
          )
        );
        setLive("Erro ao baixar certificado de organizador.");
      } finally {
        setBaixandoKey(null);
        setBusyBaixar(false);
      }
    },
    [busyBaixar, keyCertificado, setLive]
  );

  const certificadosFiltrados = useMemo(() => {
    const buscaNorm = normalizarBusca(busca);

    return certificados
      .filter((certificado) => {
        const state = getCertificadoState(certificado);

        if (somentePendentes) {
          return state.estado !== "pronto";
        }

        return true;
      })
      .filter((certificado) => {
        if (!buscaNorm) return true;

        const texto = normalizarBusca(
          [
            obterTitulo(certificado),
            obterTurma(certificado),
            certificado?.numero_certificado,
            certificado?.codigo_validacao,
          ].join(" ")
        );

        return texto.includes(buscaNorm);
      })
      .sort((a, b) => {
        const da = String(a?.data_fim || a?.gerado_em || "");
        const db = String(b?.data_fim || b?.gerado_em || "");

        return db.localeCompare(da);
      });
  }, [certificados, busca, somentePendentes]);

  const kpis = useMemo(() => {
    const total = certificados.length;
    const emitidos = certificados.filter((item) => {
      const state = getCertificadoState(item);
      return state.estado === "pronto";
    }).length;

    return {
      total,
      emitidos,
      pendentes: Math.max(0, total - emitidos),
    };
  }, [certificados]);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <HeaderHero
  titulo="Certificados de organizador"
  subtitulo="Emita, acompanhe e baixe seus certificados eletrônicos como organizador, palestrante ou responsável por atividade formativa."
  icon={Award}
/>

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {carregando ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-amber-100 dark:bg-amber-950"
          role="progressbar"
          aria-label="Carregando certificados de organizador"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-amber-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
  <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
          Certificação v2.0
        </p>

        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
          Certificados com número oficial, código único de validação, QR Code e rastreabilidade documental.
        </p>
      </div>
    </div>
  </div>

  <button
    type="button"
    onClick={carregarCertificados}
    disabled={carregando}
    className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800 dark:hover:bg-zinc-800"
  >
    <RefreshCw className={cx("h-4 w-4", carregando && "animate-spin")} />
    {carregando ? "Atualizando..." : "Atualizar certificados"}
  </button>
</section>

<section
  aria-label="Resumo dos certificados de organizador"
  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
>
  <MiniStat
    icon={Award}
    label="Elegíveis"
    value={kpis.total}
    description="Certificados disponíveis"
    tone="amber"
  />

  <MiniStat
    icon={CheckCircle2}
    label="Emitidos"
    value={kpis.emitidos}
    description="Documentos já gerados"
    tone="emerald"
  />

  <MiniStat
    icon={FilePlus2}
    label="A emitir"
    value={kpis.pendentes}
    description="Pendentes de emissão"
    tone="orange"
  />
</section>
        <Toolbar
          busca={busca}
          setBusca={setBusca}
          somentePendentes={somentePendentes}
          setSomentePendentes={setSomentePendentes}
          carregando={carregando}
          onRefresh={carregarCertificados}
        />

        {carregando ? (
          <section
            className="grid gap-4 md:grid-cols-2"
            aria-label="Carregando certificados"
          >
            <CarregandoSkeleton height={170} />
            <CarregandoSkeleton height={170} />
            <CarregandoSkeleton height={170} />
            <CarregandoSkeleton height={170} />
          </section>
        ) : erro ? (
          <ErroCarregamento mensagem={erro} onRetry={carregarCertificados} />
        ) : certificados.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum certificado de organizador disponível"
            descricao="Quando houver turma encerrada vinculada ao seu perfil de organizador, ela aparecerá aqui."
          />
        ) : certificadosFiltrados.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum resultado encontrado"
            descricao="Altere os filtros ou limpe a busca para visualizar mais certificados."
          />
        ) : (
          <section aria-labelledby="titulo-certificados-organizador">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="titulo-certificados-organizador"
                  className="text-lg font-black text-slate-950 dark:text-white"
                >
                  Certificados como organizador
                </h2>

                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Exibindo {certificadosFiltrados.length} de{" "}
                  {certificados.length} item(ns).
                </p>
              </div>

              <Badge tone="amber">
                <Sparkles className="h-3.5 w-3.5" />
                Documento eletrônico v2.0
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {certificadosFiltrados.map((certificado) => {
                const key = keyCertificado(certificado);

                return (
                  <CertificadoCard
                    key={key}
                    certificado={certificado}
                    reduceMotion={reduceMotion}
                    gerando={gerandoKey === key}
                    baixando={baixandoKey === key}
                    busyGerar={busyGerar}
                    busyBaixar={busyBaixar}
                    onGerar={gerarCertificado}
                    onBaixar={baixarCertificado}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}