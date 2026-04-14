// ✅ src/pages/CertificadosAvulsos.jsx — PREMIUM (layout moderno + mobile-first + diagnóstico forte)
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  RefreshCcw,
  Plus,
  Search,
  X,
  Mail,
  FileText,
  Award,
  Send,
  UserSquare2,
  CalendarDays,
  GraduationCap,
  PenSquare,
  ShieldCheck,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";

import Footer from "../components/Footer";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost, apiGetFile } from "../services/api";

/* ===================== Logs ===================== */
const IS_DEV =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

function debugLog(scope, payload) {
  if (!IS_DEV) return;
  try {
    console.log(`[CERT_AVULSO_FRONT][${scope}]`, payload);
  } catch {
    // noop
  }
}

/* ===================== HeaderHero ===================== */
function HeaderHero({
  onRefresh,
  onSubmitClick,
  carregando,
  onFocusBusca,
  total,
  enviados,
  naoEnviados,
}) {
  useEffect(() => {
  const onKey = (e) => {
    const mac = /(Mac|iPhone|iPad)/i.test(navigator.userAgent);
    const key = typeof e?.key === "string" ? e.key.toLowerCase() : "";

    if (!key) return;

    if ((mac && e.metaKey && key === "k") || (!mac && e.ctrlKey && key === "k")) {
      e.preventDefault();
      onFocusBusca?.();
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [onFocusBusca]);

  return (
    <header
      className="relative overflow-hidden bg-gradient-to-br from-amber-950 via-orange-800 to-rose-700 text-white"
      role="banner"
    >
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-12 -right-10 h-44 w-44 rounded-full bg-yellow-300 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-rose-300 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-7 sm:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] sm:text-xs font-bold uppercase tracking-wide">
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              Gestão administrativa
            </div>

            <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              Certificados Avulsos
            </h1>

            <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/90 leading-6">
              Cadastre certificados fora do fluxo automático, gere o PDF com mais segurança
              e envie por e-mail com apoio a segunda assinatura.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[360px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-3 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Total</p>
              <p className="mt-1 text-xl sm:text-2xl font-black">{total}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-3 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Enviados</p>
              <p className="mt-1 text-xl sm:text-2xl font-black">{enviados}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-3 py-3 text-center">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Pendentes</p>
              <p className="mt-1 text-xl sm:text-2xl font-black">{naoEnviados}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <BotaoSecundario
            variant="outline"
            cor="azulPetroleo"
            leftIcon={<RefreshCcw className="w-4 h-4" aria-hidden="true" />}
            onClick={onRefresh}
            disabled={carregando}
            aria-label="Atualizar lista de certificados"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </BotaoSecundario>

          <BotaoPrimario
            cor="amareloOuro"
            leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
            type="button"
            onClick={onSubmitClick}
            aria-label="Cadastrar novo certificado"
          >
            Cadastrar certificado
          </BotaoPrimario>
        </div>
      </div>
    </header>
  );
}

/* ===================== Helpers ===================== */
function ymdToBR(ymd) {
  if (!ymd) return "";
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(ymd);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function validYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const validarEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");

const clampLen = (s, n = 200) => String(s ?? "").slice(0, n);

function formatPeriodo(item) {
  const di = item?.data_inicio?.slice?.(0, 10) || "";
  const df = item?.data_fim?.slice?.(0, 10) || "";

  if (!di) return "—";
  if (df && df !== di) return `${ymdToBR(di)} a ${ymdToBR(df)}`;
  return ymdToBR(di);
}

function formatCarga(item) {
  return item?.carga_horaria && Number(item.carga_horaria) > 0
    ? `${item.carga_horaria}h`
    : "—";
}

/* ===================== Modalidades ===================== */
const MODALIDADES = [
  "participante",
  "instrutor",
  "banca_avaliadora",
  "oficineiro",
  "mediador",
  "banca_tcr_medica",
  "banca_tcr_multi",
  "residente_medica",
  "residente_multi",
  "mostra_banner",
  "mostra_oral",
  "comissao_organizadora",
];

const rotuloModalidade = {
  participante: "Participante",
  instrutor: "Instrutor(a) / Palestrante",
  banca_avaliadora: "Banca Avaliadora",
  oficineiro: "Oficineiro(a)",
  mediador: "Mediador(a)",
  banca_tcr_medica: "Banca TCR Médica (MFC)",
  banca_tcr_multi: "Banca TCR Multi",
  residente_medica: "Residente Médica (MFC)",
  residente_multi: "Residente Multiprofissional",
  mostra_banner: "Mostra Banner",
  mostra_oral: "Mostra Oral",
  comissao_organizadora: "Comissão Organizadora",
};

function modalidadeExigeTitulo(modalidade) {
  return (
    modalidade === "residente_medica" ||
    modalidade === "residente_multi" ||
    modalidade === "mostra_banner" ||
    modalidade === "mostra_oral" ||
    modalidade === "oficineiro"
  );
}

function modalidadeSemCarga(modalidade) {
  return modalidade === "banca_avaliadora" || modalidade === "comissao_organizadora";
}

/* ===================== Constantes ===================== */
const KEY_ASSIN2_ENABLED = "cert:assin2:enabled";
const KEY_ASSIN2_ID = "cert:assin2:id";
const KEY_FILTRO = "cert:filtro";
const KEY_BUSCA = "cert:busca";

/* ===================== Card de estatística ===================== */
function MiniStat({ icon, label, value, tone = "default" }) {
  const tones = {
    default:
      "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white",
    success:
      "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-100",
    warning:
      "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-100",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-2xl p-2 bg-black/5 dark:bg-white/5">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
          <p className="text-2xl font-black">{value}</p>
        </div>
      </div>
    </div>
  );
}

/* ===================== Página ===================== */
export default function CertificadosAvulsos() {
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    curso: "",
    carga_horaria: "",
    data_inicio: "",
    data_fim: "",
    modalidade: "participante",
    titulo_trabalho: "",
  });

  const [usarAssinatura2, setUsarAssinatura2] = useState(
    () => localStorage.getItem(KEY_ASSIN2_ENABLED) === "1"
  );
  const [assinatura2Id, setAssinatura2Id] = useState(
    () => localStorage.getItem(KEY_ASSIN2_ID) || ""
  );
  const [assinaturas, setAssinaturas] = useState([]);
  const [assinaturasCarregando, setAssinaturasCarregando] = useState(true);

  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [filtro, setFiltro] = useState(
    () => localStorage.getItem(KEY_FILTRO) || "todos"
  );
  const [busca, setBusca] = useState(
    () => localStorage.getItem(KEY_BUSCA) || ""
  );
  const [buscaDebounced, setBuscaDebounced] = useState(busca);

  const [acaoLoading, setAcaoLoading] = useState({ id: null, tipo: null });

  const liveRef = useRef(null);
  const erroRef = useRef(null);
  const buscaRef = useRef(null);
  const formRef = useRef(null);

  const setLive = useCallback((msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  }, []);

  /* ===================== Carregamentos ===================== */
  const carregarCertificados = useCallback(async () => {
    try {
      setCarregando(true);
      setLive("Carregando certificados…");

      debugLog("LISTA_START", {
        endpoint: "certificados-avulsos",
      });

      const data = await apiGet("certificados-avulsos", { on403: "silent" });
      const arr = Array.isArray(data) ? data : [];

      setLista(arr);

      debugLog("LISTA_OK", {
        total: arr.length,
      });

      setLive(
        arr.length
          ? `Foram carregados ${arr.length} certificado(s).`
          : "Nenhum certificado encontrado."
      );
    } catch (erro) {
      debugLog("LISTA_ERRO", {
        message: erro?.message || String(erro),
        response: erro?.response?.data || null,
        status: erro?.response?.status || null,
      });

      toast.error("❌ Erro ao carregar certificados.");
      setLista([]);
      setLive("Falha ao carregar certificados.");
      setTimeout(() => erroRef.current?.focus(), 0);
    } finally {
      setCarregando(false);
    }
  }, [setLive]);

  const carregarAssinaturas = useCallback(async () => {
    try {
      setAssinaturasCarregando(true);

      debugLog("ASSINATURAS_START", {
        endpoint: "assinatura/lista",
      });

      const data = await apiGet("assinatura/lista", { on403: "silent" });

      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data?.lista)
        ? data.lista
        : [];

      const filtradas = arr
        .filter(
          (a) =>
            (a?.tem_assinatura ??
              a?.possui_assinatura ??
              !!a?.assinatura ??
              !!a?.arquivo_assinatura) === true
        )
        .map((a) => ({
          id: a.id ?? a.usuario_id ?? a.pessoa_id,
          nome: a.nome || a.titulo || "—",
        }))
        .filter((a) => a.id && a.nome);

      setAssinaturas(filtradas);

      debugLog("ASSINATURAS_OK", {
        totalRecebido: arr.length,
        totalFiltrado: filtradas.length,
      });
    } catch (erro) {
      debugLog("ASSINATURAS_ERRO", {
        message: erro?.message || String(erro),
        response: erro?.response?.data || null,
        status: erro?.response?.status || null,
      });

      setAssinaturas([]);
    } finally {
      setAssinaturasCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarCertificados();
    carregarAssinaturas();
  }, [carregarCertificados, carregarAssinaturas]);

  /* ===================== Persistências ===================== */
  useEffect(() => {
    localStorage.setItem(KEY_FILTRO, filtro);
  }, [filtro]);

  useEffect(() => {
    localStorage.setItem(KEY_BUSCA, busca);
    const t = setTimeout(() => setBuscaDebounced(busca.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    localStorage.setItem(KEY_ASSIN2_ENABLED, usarAssinatura2 ? "1" : "0");
  }, [usarAssinatura2]);

  useEffect(() => {
    if (assinatura2Id) localStorage.setItem(KEY_ASSIN2_ID, assinatura2Id);
    else localStorage.removeItem(KEY_ASSIN2_ID);
  }, [assinatura2Id]);

  /* ===================== Form ===================== */
  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "cpf") {
      const dig = onlyDigits(value).slice(0, 14);
      setForm((prev) => ({ ...prev, cpf: dig }));
      return;
    }

    if (name === "email") {
      setForm((prev) => ({
        ...prev,
        email: clampLen(value, 120).toLowerCase(),
      }));
      return;
    }

    if (name === "carga_horaria") {
      const v = value.replace(/[^\d]/g, "");
      setForm((prev) => ({ ...prev, carga_horaria: v }));
      return;
    }

    if (name === "modalidade") {
      const exigeTitulo = modalidadeExigeTitulo(value);
      const semCarga = modalidadeSemCarga(value);

      setForm((prev) => ({
        ...prev,
        modalidade: value,
        titulo_trabalho: exigeTitulo ? prev.titulo_trabalho : "",
        carga_horaria: semCarga ? "" : prev.carga_horaria,
      }));
      return;
    }

    const maxMap = {
      nome: 150,
      curso: 160,
      titulo_trabalho: 255,
    };

    const v = maxMap[name] ? clampLen(value, maxMap[name]) : value;
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  function handlePasteCPF(e) {
    const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    const dig = onlyDigits(text).slice(0, 14);
    e.preventDefault();
    setForm((prev) => ({ ...prev, cpf: dig }));
  }

  useEffect(() => {
    const onKey = (e) => {
      const mac = /(Mac|iPhone|iPad)/i.test(navigator.userAgent);
      const isSubmit =
        (mac && e.metaKey && e.key === "Enter") ||
        (!mac && e.ctrlKey && e.key === "Enter");

      if (isSubmit) {
        const f = document.getElementById("form-cert-avulso");
        if (f?.requestSubmit) f.requestSubmit();
        else f?.submit();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cadastrarCertificado = useCallback(
    async (e) => {
      e.preventDefault();
      if (salvando) return;

      const modalidade = form.modalidade || "participante";
      const exigeTitulo = modalidadeExigeTitulo(modalidade);

      const payload = {
        nome: clampLen(form.nome.replace(/\s+/g, " ").trim(), 150),
        cpf: onlyDigits(form.cpf),
        email: clampLen(form.email.trim(), 120).toLowerCase(),
        curso: clampLen(form.curso.replace(/\s+/g, " ").trim(), 160),
        carga_horaria: form.carga_horaria,
        data_inicio: form.data_inicio || "",
        data_fim: form.data_fim || form.data_inicio || "",
        modalidade,
        titulo_trabalho: exigeTitulo
          ? clampLen((form.titulo_trabalho || "").replace(/\s+/g, " ").trim(), 255)
          : "",
      };

      if (!payload.nome || !payload.email || !payload.curso) {
        toast.warning("Preencha nome, e-mail e curso.");
        setLive("Preencha os campos obrigatórios.");
        return;
      }

      if (!validarEmail(payload.email)) {
        toast.warning("Informe um e-mail válido.");
        setLive("E-mail inválido.");
        return;
      }

      const cargaStr = String(form.carga_horaria || "").trim();
      if (cargaStr) {
        const n = Number(cargaStr);
        if (!Number.isFinite(n) || n <= 0) {
          toast.warning("Informe uma carga horária válida (> 0) ou deixe em branco.");
          setLive("Carga horária inválida.");
          return;
        }
      }

      if (exigeTitulo && !payload.titulo_trabalho) {
        toast.warning("Informe o título do trabalho/oficina para a modalidade selecionada.");
        setLive("Título do trabalho é obrigatório.");
        return;
      }

      if (payload.data_inicio && !validYMD(payload.data_inicio)) {
        toast.warning("Data de início inválida.");
        setLive("Data de início inválida.");
        return;
      }

      if (payload.data_fim && !validYMD(payload.data_fim)) {
        toast.warning("Data de término inválida.");
        setLive("Data de término inválida.");
        return;
      }

      if (payload.data_inicio && payload.data_fim && payload.data_fim < payload.data_inicio) {
        toast.warning("A data de término não pode ser anterior à data de início.");
        setLive("A data de término não pode ser anterior à data de início.");
        return;
      }

      setSalvando(true);

      try {
        debugLog("CADASTRO_START", payload);

        const novo = await apiPost("certificados-avulsos", payload);

        debugLog("CADASTRO_OK", {
          id: novo?.id || null,
        });

        setLista((prev) => [novo, ...prev]);
        setFiltro("todos");
        setBusca("");

        setForm({
          nome: "",
          cpf: "",
          email: "",
          curso: "",
          carga_horaria: "",
          data_inicio: "",
          data_fim: "",
          modalidade: "participante",
          titulo_trabalho: "",
        });

        toast.success("✅ Certificado cadastrado.");
        setLive("Certificado cadastrado com sucesso.");
      } catch (erro) {
        debugLog("CADASTRO_ERRO", {
          message: erro?.message || String(erro),
          response: erro?.response?.data || null,
          status: erro?.response?.status || null,
          payload,
        });

        const msg =
          erro?.response?.data?.erro ||
          "Erro ao cadastrar certificado.";

        toast.error(`❌ ${msg}`);
        setLive("Erro ao cadastrar certificado.");
        setTimeout(() => erroRef.current?.focus(), 0);
      } finally {
        setSalvando(false);
      }
    },
    [form, salvando, setLive]
  );

  const enviarPorEmail = useCallback(
    async (id) => {
      if (acaoLoading.id) return;

      if (usarAssinatura2 && !assinatura2Id) {
        toast.info("Selecione a 2ª assinatura antes de enviar o e-mail.");
        return;
      }

      setAcaoLoading({ id, tipo: "email" });

      try {
        const params = new URLSearchParams();
        if (usarAssinatura2 && assinatura2Id) {
          params.set("assinatura2_id", String(assinatura2Id));
        }

        const url = params.toString()
          ? `certificados-avulsos/${id}/enviar?${params.toString()}`
          : `certificados-avulsos/${id}/enviar`;

        debugLog("EMAIL_START", { id, url });

        toast.info("📤 Enviando…");
        await apiPost(url);

        debugLog("EMAIL_OK", { id });

        toast.success("✅ E-mail enviado!");
        setLista((prev) =>
          prev.map((item) => (item.id === id ? { ...item, enviado: true } : item))
        );
      } catch (erro) {
        debugLog("EMAIL_ERRO", {
          id,
          message: erro?.message || String(erro),
          response: erro?.response?.data || null,
          status: erro?.response?.status || null,
        });

        const msg =
          erro?.response?.data?.erro ||
          "Erro ao enviar e-mail.";

        toast.error(`❌ ${msg}`);
      } finally {
        setAcaoLoading({ id: null, tipo: null });
      }
    },
    [acaoLoading.id, usarAssinatura2, assinatura2Id]
  );

  const gerarPDF = useCallback(
    async (id) => {
      if (acaoLoading.id) return;

      if (usarAssinatura2 && !assinatura2Id) {
        toast.info("Selecione a 2ª assinatura antes de gerar o PDF.");
        return;
      }

      setAcaoLoading({ id, tipo: "pdf" });

      let href = "";

      try {
        const params = new URLSearchParams();
        if (usarAssinatura2 && assinatura2Id) {
          params.set("assinatura2_id", String(assinatura2Id));
        }

        const url = params.toString()
          ? `certificados-avulsos/${id}/pdf?${params.toString()}`
          : `certificados-avulsos/${id}/pdf`;

        debugLog("PDF_START", { id, url });

        const { blob, filename } = await apiGetFile(url);

        debugLog("PDF_OK", {
          id,
          filename: filename || null,
          size: blob?.size || null,
        });

        href = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = href;
        a.download = filename || `certificado_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (erro) {
        debugLog("PDF_ERRO", {
          id,
          message: erro?.message || String(erro),
          response: erro?.response?.data || null,
          status: erro?.response?.status || null,
        });

        const msg =
          erro?.response?.data?.erro ||
          "Erro ao gerar PDF.";

        toast.error(`❌ ${msg}`);
      } finally {
        if (href) window.URL.revokeObjectURL(href);
        setAcaoLoading({ id: null, tipo: null });
      }
    },
    [usarAssinatura2, assinatura2Id, acaoLoading.id]
  );

  /* ===================== Derivados ===================== */
  const enviados = useMemo(
    () => (lista || []).filter((i) => i.enviado === true).length,
    [lista]
  );

  const naoEnviados = useMemo(
    () => (lista || []).filter((i) => i.enviado === false || i.enviado == null).length,
    [lista]
  );

  const listaFiltrada = useMemo(() => {
    const term = buscaDebounced;

    return (lista || []).filter((item) => {
      if (filtro === "enviados" && item.enviado !== true) return false;
      if (filtro === "nao-enviados" && item.enviado === true) return false;

      if (!term) return true;

      const alvo = `${item.nome} ${item.email} ${item.curso} ${item.modalidade || ""} ${
        item.titulo_trabalho || ""
      }`.toLowerCase();

      return alvo.includes(term);
    });
  }, [lista, filtro, buscaDebounced]);

  const assinatura2Nome = useMemo(() => {
    const achada = assinaturas.find((a) => String(a.id) === String(assinatura2Id));
    return achada?.nome || "";
  }, [assinaturas, assinatura2Id]);

  /* ===================== Render ===================== */
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero
        onRefresh={carregarCertificados}
        onSubmitClick={() => {
          if (formRef.current?.requestSubmit) formRef.current.requestSubmit();
          else formRef.current?.submit?.();
        }}
        carregando={carregando}
        onFocusBusca={() => buscaRef.current?.focus()}
        total={lista.length}
        enviados={enviados}
        naoEnviados={naoEnviados}
      />

      {carregando && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-amber-100 z-40"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Carregando dados"
          aria-busy="true"
        >
          <div
            className={`h-full bg-rose-600 w-1/3 ${
              reduceMotion ? "" : "animate-pulse"
            }`}
          />
        </div>
      )}

      <main id="conteudo" className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-4 lg:px-6 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" role="status" />
        <div ref={erroRef} tabIndex={-1} className="sr-only" />

        {/* Top stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <MiniStat
            icon={<Award className="w-5 h-5" aria-hidden="true" />}
            label="Total"
            value={lista.length}
            tone="default"
          />
          <MiniStat
            icon={<Mail className="w-5 h-5" aria-hidden="true" />}
            label="Enviados"
            value={enviados}
            tone="success"
          />
          <MiniStat
            icon={<Send className="w-5 h-5" aria-hidden="true" />}
            label="Pendentes"
            value={naoEnviados}
            tone="warning"
          />
        </section>

        {/* Layout principal */}
        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          {/* Coluna esquerda: cadastro */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
              <div className="border-b border-zinc-100 dark:border-zinc-700 px-4 sm:px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl p-2 bg-rose-100 dark:bg-rose-900/30">
                    <PenSquare className="w-5 h-5 text-rose-700 dark:text-rose-300" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                      Novo certificado
                    </h2>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      Cadastro manual com suporte a modalidade específica e segunda assinatura.
                    </p>
                  </div>
                </div>
              </div>

              <form
                ref={formRef}
                id="form-cert-avulso"
                onSubmit={cadastrarCertificado}
                className="p-4 sm:p-5 space-y-4"
                aria-label="Cadastro de certificado avulso"
                aria-busy={salvando}
              >
                <div>
                  <label htmlFor="nome" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Nome completo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="nome"
                    name="nome"
                    type="text"
                    value={form.nome}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    disabled={salvando}
                    className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cpf" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      CPF / Registro
                    </label>
                    <input
                      id="cpf"
                      name="cpf"
                      type="text"
                      value={form.cpf}
                      onChange={handleChange}
                      onPaste={handlePasteCPF}
                      disabled={salvando}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      placeholder="Apenas números"
                      aria-describedby="cpf-help"
                    />
                    <p id="cpf-help" className="text-[11px] text-zinc-500 mt-1">
                      Aceita somente números; a formatação será aplicada no PDF.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      E-mail <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                      disabled={salvando}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="curso" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Evento / Curso <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="curso"
                    name="curso"
                    type="text"
                    value={form.curso}
                    onChange={handleChange}
                    required
                    disabled={salvando}
                    className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label htmlFor="modalidade" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Modalidade / Participação
                  </label>
                  <select
                    id="modalidade"
                    name="modalidade"
                    value={form.modalidade}
                    onChange={handleChange}
                    disabled={salvando}
                    className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m} value={m}>
                        {rotuloModalidade[m] || m}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Defina se a pessoa foi participante, instrutor(a), banca, residente, mostra ou comissão.
                  </p>
                </div>

                {modalidadeExigeTitulo(form.modalidade) && (
                  <div>
                    <label
                      htmlFor="titulo_trabalho"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Título do trabalho / oficina <span className="text-rose-600">*</span>
                    </label>
                    <input
                      id="titulo_trabalho"
                      name="titulo_trabalho"
                      type="text"
                      value={form.titulo_trabalho}
                      onChange={handleChange}
                      disabled={salvando}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      placeholder="Título do TCR, trabalho ou oficina apresentada"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="carga_horaria"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Carga horária
                    </label>
                    <input
                      id="carga_horaria"
                      name="carga_horaria"
                      type="number"
                      min={1}
                      step="1"
                      value={form.carga_horaria}
                      onChange={handleChange}
                      disabled={salvando || modalidadeSemCarga(form.modalidade)}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {modalidadeSemCarga(form.modalidade)
                        ? "Não se aplica à modalidade escolhida."
                        : "Opcional. Se vazio, não aparece no texto."}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="data_inicio"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Data de início
                    </label>
                    <input
                      id="data_inicio"
                      name="data_inicio"
                      type="date"
                      value={form.data_inicio}
                      onChange={handleChange}
                      disabled={salvando}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="data_fim"
                      className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      Data de término
                    </label>
                    <input
                      id="data_fim"
                      name="data_fim"
                      type="date"
                      value={form.data_fim}
                      onChange={handleChange}
                      disabled={salvando}
                      className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Segunda assinatura */}
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl p-2 bg-emerald-100 dark:bg-emerald-900/30">
                      <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                        Assinatura adicional
                      </h3>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                        Use uma segunda assinatura quando o certificado exigir coassinatura.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={usarAssinatura2}
                        onChange={(e) => {
                          setUsarAssinatura2(e.target.checked);
                          if (!e.target.checked) setAssinatura2Id("");
                        }}
                      />
                      <span className="text-sm font-medium">Adicionar 2ª assinatura</span>
                    </label>

                    <div className={`${usarAssinatura2 ? "" : "opacity-50 pointer-events-none"}`}>
                      <label
                        htmlFor="assinatura2"
                        className="block text-sm font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Selecionar assinatura
                      </label>
                      <select
                        id="assinatura2"
                        value={assinatura2Id}
                        onChange={(e) => setAssinatura2Id(e.target.value)}
                        disabled={!usarAssinatura2 || assinaturasCarregando || assinaturas.length === 0}
                        aria-disabled={!usarAssinatura2 || assinaturas.length === 0}
                        className="mt-1 w-full border border-zinc-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">
                          {assinaturasCarregando ? "Carregando…" : "— Selecione —"}
                        </option>
                        {assinaturas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>

                      <p className="text-xs text-zinc-500 mt-1">
                        {assinaturasCarregando
                          ? "Buscando assinaturas disponíveis…"
                          : assinaturas.length
                          ? "Mostrando apenas pessoas com assinatura cadastrada."
                          : "Nenhuma assinatura cadastrada encontrada."}
                      </p>

                      {usarAssinatura2 && assinatura2Nome ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Assinatura selecionada: {assinatura2Nome}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <BotaoPrimario type="submit" disabled={salvando} aria-busy={salvando}>
                    {salvando ? "Cadastrando..." : "Cadastrar certificado"}
                  </BotaoPrimario>
                </div>
              </form>
            </div>
          </section>

          {/* Coluna direita: listagem */}
          <section className="space-y-4">
            {/* Filtros */}
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl p-2 bg-amber-100 dark:bg-amber-900/30">
                  <Search className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                    Localizar certificados
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    Busque por nome, e-mail, curso, modalidade ou título do trabalho.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="busca"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Buscar
                  </label>

                  <div className="relative">
                    <Search
                      className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      aria-hidden="true"
                    />
                    <input
                      ref={buscaRef}
                      id="busca"
                      type="search"
                      inputMode="search"
                      placeholder="Nome, e-mail, curso, modalidade…"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className="pl-9 pr-10 py-2.5 w-full rounded-xl border border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    {busca && (
                      <button
                        type="button"
                        onClick={() => setBusca("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        aria-label="Limpar busca"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:w-64">
                  <label
                    htmlFor="filtro"
                    className="block text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-1"
                  >
                    Situação de envio
                  </label>
                  <select
                    id="filtro"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="w-full border border-gray-300 dark:border-zinc-700 p-2.5 rounded-xl dark:bg-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="enviados">Enviados</option>
                    <option value="nao-enviados">Não enviados</option>
                  </select>
                </div>

                {(busca || filtro !== "todos") && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setBusca("");
                        setFiltro("todos");
                      }}
                      className="px-4 py-2.5 text-sm rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
                {listaFiltrada.length} registro{listaFiltrada.length !== 1 ? "s" : ""} encontrado
                {listaFiltrada.length !== 1 ? "s" : ""}.
              </p>
            </div>

            {/* Lista / tabela */}
            {carregando ? (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm p-4">
                <CarregandoSkeleton linhas={5} />
              </div>
            ) : listaFiltrada.length === 0 ? (
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm p-6">
                <NadaEncontrado mensagem="Nenhum certificado cadastrado." />
              </div>
            ) : (
              <div
  className="grid grid-cols-1 gap-4"
  role="region"
  aria-live="off"
  aria-busy={acaoLoading.id != null}
>
                {listaFiltrada.map((item) => {
                  const isEmailLoading =
                    acaoLoading.id === item.id && acaoLoading.tipo === "email";
                  const isPdfLoading =
                    acaoLoading.id === item.id && acaoLoading.tipo === "pdf";
                  const mod = item.modalidade || "participante";

                  return (
                    <article
                      key={item.id}
                      className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 shadow-sm hover:shadow-md transition"
                      role="group"
                      aria-label={`Certificado de ${item.nome}`}
                    >
                      <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600" />

                      <div className="p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl p-2 bg-rose-100 dark:bg-rose-900/30 shrink-0">
                            <UserSquare2 className="w-5 h-5 text-rose-700 dark:text-rose-300" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start gap-2 justify-between">
                              <h3 className="font-black text-base leading-5 text-zinc-900 dark:text-white">
                                {item.nome}
                              </h3>

                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                                  item.enviado
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                }`}
                              >
                                {item.enviado ? "Enviado" : "Pendente"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 leading-5">
                              {item.curso}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-1 text-[11px] font-semibold">
                                {rotuloModalidade[mod] || mod}
                              </span>

                              {item.cpf ? (
                                <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-200">
                                  CPF/Registro: {item.cpf}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                              E-mail
                            </p>
                            <p className="break-all font-medium text-zinc-800 dark:text-zinc-100">
                              {item.email}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                                Carga
                              </p>
                              <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                {formatCarga(item)}
                              </p>
                            </div>

                            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                                Período
                              </p>
                              <p className="font-medium text-zinc-800 dark:text-zinc-100">
                                {formatPeriodo(item)}
                              </p>
                            </div>
                          </div>

                          {item.titulo_trabalho ? (
                            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                                Título do trabalho / oficina
                              </p>
                              <p className="font-medium text-zinc-800 dark:text-zinc-100 leading-5">
                                {item.titulo_trabalho}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => gerarPDF(item.id)}
                            disabled={isPdfLoading}
                            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                              isPdfLoading
                                ? "bg-blue-100 text-blue-700 opacity-70 cursor-not-allowed dark:bg-blue-900/20 dark:text-blue-300"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                            aria-label={`Baixar PDF do certificado de ${item.nome}`}
                            title={`Baixar PDF${
                              usarAssinatura2 && assinatura2Id
                                ? " com 2 assinaturas"
                                : ""
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            {isPdfLoading ? "Gerando…" : "PDF"}
                          </button>

                          <button
                            type="button"
                            onClick={() => enviarPorEmail(item.id)}
                            disabled={isEmailLoading}
                            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                              isEmailLoading
                                ? "bg-emerald-100 text-emerald-700 opacity-70 cursor-not-allowed dark:bg-emerald-900/20 dark:text-emerald-300"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                            aria-label={`Enviar certificado de ${item.nome} por e-mail`}
                            title={item.enviado ? "Reenviar e-mail" : "Enviar e-mail"}
                          >
                            <Mail className="w-4 h-4" />
                            {isEmailLoading
                              ? "Enviando…"
                              : item.enviado
                              ? "Reenviar"
                              : "Enviar"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}