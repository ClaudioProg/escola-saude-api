// 📁 src/components/trabalhos/ModalInscreverTrabalho.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Modal autoral de criação/edição/envio de trabalho.
//
// Contratos oficiais usados:
// - GET  /api/chamada/:id
// - GET  /api/chamada/:id/modelo-banner
// - GET  /api/trabalho/:id
// - POST /api/trabalho/chamada/:chamadaId
// - PUT  /api/trabalho/:id
// - POST /api/trabalho/:id/banner       campo multipart: arquivo
//
// Diretrizes v2.0:
// - sem /api/chamadas;
// - sem /api/chamadas/:id/submissao;
// - sem PUT /api/submissao/:id;
// - sem POST /api/submissao/:id/poster;
// - sem fieldName "poster";
// - sem status "submetido";
// - status oficial autoral: rascunho | submetida;
// - campo textual oficial: consideracao;
// - upload oficial: arquivo;
// - anti-fuso sem new Date("YYYY-MM-DD");
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - sem toast direto.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  FilePlus2,
  FileText,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import api, { apiGetFile, apiUpload, downloadBlob } from "../../services/api";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function unwrap(response, fallback = null) {
  if (response && typeof response === "object" && "ok" in response && "data" in response) {
    return response.data ?? fallback;
  }

  if (
    response?.data &&
    typeof response.data === "object" &&
    "ok" in response.data &&
    "data" in response.data
  ) {
    return response.data.data ?? fallback;
  }

  return response?.data ?? response ?? fallback;
}

function getMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function trim(value) {
  return String(value || "").trim();
}

function digits(value, max = 20) {
  return String(value || "").replace(/\D/g, "").slice(0, max);
}

function toMonthValue(value) {
  if (!value) return "";

  const text = String(value).trim();

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;

  const match = /^(\d{4})-(0[1-9]|1[0-2])/.exec(text);
  if (match) return `${match[1]}-${match[2]}`;

  return "";
}

function formatYYYYMM(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ""));
  if (!match) return value || "—";

  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

  return `${meses[Number(match[2]) - 1]}/${match[1]}`;
}

function formatPrazo(value) {
  const text = String(value || "").trim();

  if (!text) return "—";

  const wall = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(text);
  if (wall) {
    return `${wall[3]}/${wall[2]}/${wall[1]} às ${wall[4]}:${wall[5]}`;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  return text;
}

function clampLimit(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function formatBytes(bytes) {
  const n = Number(bytes);

  if (!Number.isFinite(n) || n <= 0) return "—";

  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function fileIsAllowed(file) {
  if (!file) return { ok: true };

  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  const size = Number(file.size || 0);

  const allowedExt = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".ppt", ".pptx"];
  const allowedMime = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  const hasAllowedExt = allowedExt.some((ext) => name.endsWith(ext));
  const hasAllowedMime = allowedMime.includes(type) || type.startsWith("image/");

  if (!hasAllowedExt && !hasAllowedMime) {
    return {
      ok: false,
      message: "Arquivo inválido. Envie PNG, JPG, GIF, WEBP, PDF, PPT ou PPTX.",
    };
  }

  if (size <= 0 || size > 30 * 1024 * 1024) {
    return {
      ok: false,
      message: "Arquivo muito grande. O limite é 30MB.",
    };
  }

  return { ok: true };
}

function validateForm({ form, limites, status, dentroPrazo, maxCoautores }) {
  const errors = [];

  if (!dentroPrazo) {
    errors.push("Prazo encerrado: não é possível salvar ou enviar este trabalho.");
  }

  if (!trim(form.titulo)) {
    errors.push("Informe o título do trabalho.");
  }

  if (!toMonthValue(form.inicio_experiencia)) {
    errors.push("Informe o mês/ano de início da experiência.");
  }

  if (!form.linha_tematica_id) {
    errors.push("Selecione a linha temática.");
  }

  const requiredWhenSubmit = [
    ["introducao", "Introdução"],
    ["objetivos", "Objetivos"],
    ["metodo", "Método/descrição da prática"],
    ["resultados", "Resultados/impactos"],
    ["consideracao", "Considerações finais"],
  ];

  if (status === "submetida") {
    for (const [key, label] of requiredWhenSubmit) {
      if (!trim(form[key])) {
        errors.push(`Preencha o campo "${label}".`);
      }
    }
  }

  const fields = [
    ["titulo", "Título", clampLimit(limites.titulo, 100)],
    ["introducao", "Introdução", clampLimit(limites.introducao, 2000)],
    ["objetivos", "Objetivos", clampLimit(limites.objetivos, 1000)],
    ["metodo", "Método/descrição da prática", clampLimit(limites.metodo, 1500)],
    ["resultados", "Resultados/impactos", clampLimit(limites.resultados, 1500)],
    ["consideracao", "Considerações finais", clampLimit(limites.consideracao, 1000)],
    ["bibliografia", "Bibliografia", 8000],
  ];

  for (const [key, label, max] of fields) {
    if (String(form[key] || "").length > max) {
      errors.push(`O campo "${label}" ultrapassa o limite de ${max} caracteres.`);
    }
  }

  if ((form.coautores || []).length > maxCoautores) {
    errors.push(`O limite de ${maxCoautores} coautor(es) foi ultrapassado.`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

/* =========================================================================
   UI
=========================================================================== */

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    violet:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold",
        tones[tone] || tones.slate
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  icon: Icon,
  tone = "slate",
  loading = false,
  size = "md",
  className = "",
  ...props
}) {
  const tones = {
    primary:
      "bg-gradient-to-r from-violet-700 via-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-violet-900/20 hover:brightness-110",
    slate:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    success:
      "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-700",
    danger:
      "bg-rose-600 text-white shadow-lg shadow-rose-900/20 hover:bg-rose-700",
    ghost:
      "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  };

  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  };

  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition",
        "focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
        tones[tone],
        sizes[size],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="h-4 w-4" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

function Field({ label, required, hint, error, children, counter }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </label>

        {counter ? (
          <span
            className={cx(
              "text-xs",
              counter.over ? "font-bold text-rose-600" : "text-slate-400"
            )}
          >
            {counter.current}/{counter.max}
          </span>
        ) : null}
      </div>

      {children}

      {hint ? <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{hint}</p> : null}
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

function Section({ title, icon: Icon, children, description }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-2xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* =========================================================================
   Component
=========================================================================== */

const DEFAULT_FORM = {
  titulo: "",
  inicio_experiencia: "",
  linha_tematica_id: "",
  introducao: "",
  objetivos: "",
  metodo: "",
  resultados: "",
  consideracao: "",
  bibliografia: "",
  coautores: [],
  arquivo: null,
};

export default function ModalInscreverTrabalho({
  chamadaId: propChamadaId,
  submissaoId: propSubmissaoId,
  onClose,
  onSucesso,
}) {
  const uid = useId();

  const titleId = `modal-trabalho-title-${uid}`;
  const descId = `modal-trabalho-desc-${uid}`;

  const dialogRef = useRef(null);
  const titleInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [a11y, setA11y] = useState("");

  const [chamada, setChamada] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [limites, setLimites] = useState({});
  const [maxCoautores, setMaxCoautores] = useState(10);

  const [submissaoId, setSubmissaoId] = useState(propSubmissaoId || null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const [arquivoExistente, setArquivoExistente] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [modeloDisponivel, setModeloDisponivel] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);

  const isEdit = Boolean(propSubmissaoId || submissaoId);

  const inputBase =
    "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";

  const textareaBase =
    "w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:ring-2 focus:ring-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-900";

  const prazoFmt = useMemo(() => formatPrazo(chamada?.prazo_final_br), [chamada]);
  const dentroPrazo = Boolean(chamada?.dentro_prazo);
  const bloqueado = saving || uploading;

  const max = useMemo(
    () => ({
      titulo: clampLimit(limites.titulo, 100),
      introducao: clampLimit(limites.introducao, 2000),
      objetivos: clampLimit(limites.objetivos, 1000),
      metodo: clampLimit(limites.metodo, 1500),
      resultados: clampLimit(limites.resultados, 1500),
      consideracao: clampLimit(limites.consideracao, 1000),
      bibliografia: 8000,
    }),
    [limites]
  );

  const periodoLabel = useMemo(() => {
    if (!chamada?.periodo_experiencia_inicio && !chamada?.periodo_experiencia_fim) {
      return "—";
    }

    return `${formatYYYYMM(chamada?.periodo_experiencia_inicio)} — ${formatYYYYMM(
      chamada?.periodo_experiencia_fim
    )}`;
  }, [chamada]);

  const fileValidation = useMemo(() => fileIsAllowed(form.arquivo), [form.arquivo]);

  const setValue = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const addCoautor = useCallback(() => {
    setForm((current) => {
      if ((current.coautores || []).length >= maxCoautores) {
        setErro(`Limite atingido: máximo de ${maxCoautores} coautor(es).`);
        return current;
      }

      return {
        ...current,
        coautores: [
          ...(current.coautores || []),
          {
            nome: "",
            email: "",
            unidade: "",
            papel: "",
            cpf: "",
            vinculo: "",
          },
        ],
      };
    });
  }, [maxCoautores]);

  function removeCoautor(index) {
    setForm((current) => ({
      ...current,
      coautores: current.coautores.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateCoautor(index, key, value) {
    setForm((current) => {
      const next = [...current.coautores];
      next[index] = {
        ...next[index],
        [key]: key === "cpf" ? digits(value, 11) : value,
      };

      return {
        ...current,
        coautores: next,
      };
    });
  }

  async function checarModelo(chamadaId) {
    if (!chamadaId) {
      setModeloDisponivel(false);
      return;
    }

    try {
      await apiGetFile(`/chamada/${chamadaId}/modelo-banner`);
      setModeloDisponivel(true);
    } catch {
      setModeloDisponivel(false);
    }
  }

  async function baixarModelo() {
    const id = chamada?.id || propChamadaId;

    if (!id) return;

    setBaixandoModelo(true);
    setErro("");

    try {
      const { blob, filename } = await apiGetFile(`/chamada/${id}/modelo-banner`);
      downloadBlob(filename || `modelo-banner-chamada-${id}.pptx`, blob);
    } catch (error) {
      setErro(getMessage(error, "Não foi possível baixar o modelo de Pôster."));
    } finally {
      setBaixandoModelo(false);
    }
  }

  async function carregar() {
    setLoading(true);
    setErro("");
    setMensagem("");
    setA11y("Carregando dados do trabalho.");

    try {
      if (propSubmissaoId) {
        const trabalho = unwrap(await api.get(`/trabalho/${propSubmissaoId}`), null);

        if (!trabalho) {
          throw new Error("Trabalho não encontrado.");
        }

        const chamadaResponse = unwrap(await api.get(`/chamada/${trabalho.chamada_id}`), null);
        const chamadaData = chamadaResponse?.chamada || chamadaResponse || null;

        setSubmissaoId(trabalho.id);
        setChamada(chamadaData);
        setLinhas(Array.isArray(chamadaResponse?.linhas) ? chamadaResponse.linhas : []);
        setLimites(chamadaResponse?.limites || chamadaData?.limites || trabalho.limites || {});
        setMaxCoautores(Number(chamadaData?.max_coautores || trabalho.max_coautores || 10));

        setForm({
          titulo: trabalho.titulo || "",
          inicio_experiencia: toMonthValue(trabalho.inicio_experiencia),
          linha_tematica_id: trabalho.linha_tematica_id || "",
          introducao: trabalho.introducao || "",
          objetivos: trabalho.objetivos || "",
          metodo: trabalho.metodo || "",
          resultados: trabalho.resultados || "",
          consideracao: trabalho.consideracao || "",
          bibliografia: trabalho.bibliografia || "",
          coautores: Array.isArray(trabalho.coautores)
            ? trabalho.coautores.map((item) => ({
                nome: item.nome || "",
                email: item.email || "",
                unidade: item.unidade || "",
                papel: item.papel || "",
                cpf: digits(item.cpf, 11),
                vinculo: item.vinculo || "",
              }))
            : [],
          arquivo: null,
        });

        setArquivoExistente(trabalho.banner || null);

        await checarModelo(trabalho.chamada_id);
      } else {
        const response = unwrap(await api.get(`/chamada/${propChamadaId}`), null);
        const chamadaData = response?.chamada || response || null;

        setChamada(chamadaData);
        setLinhas(Array.isArray(response?.linhas) ? response.linhas : []);
        setLimites(response?.limites || chamadaData?.limites || {});
        setMaxCoautores(Number(chamadaData?.max_coautores || 10));

        setForm(DEFAULT_FORM);
        setArquivoExistente(null);

        await checarModelo(chamadaData?.id || propChamadaId);
      }

      setA11y("Dados carregados.");
    } catch (error) {
      setErro(getMessage(error, "Não foi possível carregar os dados do trabalho."));
      setA11y("Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propChamadaId, propSubmissaoId]);

  useEffect(() => {
    if (loading) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape" && !bloqueado) {
        onClose?.();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    window.setTimeout(() => titleInputRef.current?.focus?.(), 80);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loading, bloqueado, onClose]);

  function buildPayload(status) {
    return {
      status,
      titulo: trim(form.titulo),
      inicio_experiencia: toMonthValue(form.inicio_experiencia),
      linha_tematica_id: form.linha_tematica_id ? Number(form.linha_tematica_id) : null,
      introducao: trim(form.introducao),
      objetivos: trim(form.objetivos),
      metodo: trim(form.metodo),
      resultados: trim(form.resultados),
      consideracao: trim(form.consideracao),
      bibliografia: trim(form.bibliografia),
      coautores: (form.coautores || [])
        .filter((item) => trim(item.nome))
        .map((item) => ({
          nome: trim(item.nome),
          email: trim(item.email),
          unidade: trim(item.unidade),
          papel: trim(item.papel),
          cpf: digits(item.cpf, 11),
          vinculo: trim(item.vinculo),
        })),
    };
  }

  async function criarOuAtualizar(status) {
    const payload = buildPayload(status);

    if (submissaoId) {
      const response = await api.put(`/trabalho/${submissaoId}`, payload);
      return unwrap(response, null)?.id || submissaoId;
    }

    const id = chamada?.id || propChamadaId;
    const response = await api.post(`/trabalho/chamada/${id}`, payload);
    const data = unwrap(response, null);

    if (data?.id) {
      setSubmissaoId(data.id);
    }

    return data?.id;
  }

  async function uploadArquivo(id) {
    if (!form.arquivo || !id) return null;

    if (!fileValidation.ok) {
      throw new Error(fileValidation.message);
    }

    setUploading(true);
    setUploadProgress(0);
    setA11y("Enviando arquivo principal do trabalho.");

    try {
      const response = await apiUpload(`/trabalho/${id}/banner`, form.arquivo, {
        fieldName: "arquivo",
        onUploadProgress: (event) => {
          if (!event?.total) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });

      const data = unwrap(response, null);

      setArquivoExistente(data || null);
      setForm((current) => ({ ...current, arquivo: null }));

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setA11y("Arquivo enviado com sucesso.");
      return data;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function salvar(status) {
    setErro("");
    setMensagem("");

    const validation = validateForm({
      form,
      limites,
      status,
      dentroPrazo,
      maxCoautores,
    });

    if (!validation.ok) {
      setErro(validation.errors.slice(0, 4).join(" "));
      return;
    }

    if (!fileValidation.ok) {
      setErro(fileValidation.message);
      return;
    }

    setSaving(true);
    setA11y(status === "rascunho" ? "Salvando rascunho." : "Enviando trabalho.");

    try {
      const id = await criarOuAtualizar(status);

      if (form.arquivo) {
        await uploadArquivo(id);
      }

      setMensagem(
        status === "rascunho"
          ? "Rascunho salvo com sucesso."
          : "Trabalho enviado com sucesso."
      );

      setA11y(
        status === "rascunho"
          ? "Rascunho salvo com sucesso."
          : "Trabalho enviado com sucesso."
      );

      await onSucesso?.();

      if (status === "submetida") {
        window.setTimeout(() => {
          onClose?.();
        }, 700);
      }
    } catch (error) {
      setErro(
        getMessage(
          error,
          status === "rascunho"
            ? "Não foi possível salvar o rascunho."
            : "Não foi possível enviar o trabalho."
        )
      );
      setA11y("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function onFileChange(event) {
    const file = event.target.files?.[0] || null;
    const validation = fileIsAllowed(file);

    if (!validation.ok) {
      setErro(validation.message);
      event.target.value = "";
      setForm((current) => ({ ...current, arquivo: null }));
      return;
    }

    setErro("");
    setForm((current) => ({ ...current, arquivo: file }));
  }

  function clearFile() {
    setForm((current) => ({ ...current, arquivo: null }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-[2rem] border border-white/20 bg-white p-8 text-center shadow-2xl dark:bg-slate-950">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-600" />
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Carregando trabalho...
          </p>
        </div>
      </div>
    );
  }

  if (!chamada) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-[2rem] border border-white/20 bg-white p-6 shadow-2xl dark:bg-slate-950">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 text-rose-600" />
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Chamada não encontrada
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Não foi possível localizar a chamada vinculada a este trabalho.
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button tone="primary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (bloqueado) return;
          if (event.target === event.currentTarget) onClose?.();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div aria-live="polite" className="sr-only">
          {a11y}
        </div>

        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
className="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950 sm:h-[92dvh] sm:rounded-[2rem] sm:border sm:border-white/20"          initial={{ opacity: 0, y: 32, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 32, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <header className="relative overflow-hidden border-b border-white/10 bg-slate-950 p-5 text-white sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.30),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(217,70,239,.25),transparent_35%),radial-gradient(circle_at_70%_80%,rgba(99,102,241,.24),transparent_35%)]" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge tone={dentroPrazo ? "emerald" : "rose"}>
                    {dentroPrazo ? "Dentro do prazo" : "Prazo encerrado"}
                  </Badge>
                  <Badge tone="violet">
                    {isEdit ? "Edição de trabalho" : "Nova submissão"}
                  </Badge>
                </div>

                <h2
                  id={titleId}
                  className="text-xl font-black tracking-tight sm:text-2xl"
                >
                  <span className="inline-flex items-center gap-2">
                    <FilePlus2 className="h-5 w-5" />
                    {isEdit ? "Editar trabalho" : "Submeter trabalho"}
                  </span>
                </h2>

                <p id={descId} className="mt-2 max-w-4xl text-sm leading-relaxed text-white/72">
                  {chamada.titulo}
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/80">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Prazo: <strong>{prazoFmt}</strong>
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Período: <strong>{periodoLabel}</strong>
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">
                    Coautores: <strong>máx. {maxCoautores}</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={bloqueado}
                onClick={onClose}
                className="rounded-2xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
            {erro ? (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{erro}</span>
                </div>
              </div>
            ) : null}

            {mensagem ? (
              <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
                  <span>{mensagem}</span>
                </div>
              </div>
            ) : null}

            {!dentroPrazo ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                O prazo da chamada está encerrado. Este formulário fica disponível apenas para consulta.
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <Section
                  title="Identificação do trabalho"
                  icon={ClipboardList}
                  description="Informe os dados principais exatamente como devem ser avaliados."
                >
                  <Field
                    label="Título do trabalho"
                    required
                    counter={{
                      current: form.titulo.length,
                      max: max.titulo,
                      over: form.titulo.length > max.titulo,
                    }}
                  >
                    <input
                      ref={titleInputRef}
                      value={form.titulo}
                      onChange={(event) => setValue("titulo", event.target.value)}
                      maxLength={max.titulo}
                      disabled={!dentroPrazo}
                      className={cx(inputBase, "h-12 text-base font-semibold")}
                    />
                  </Field>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Início da experiência" required>
                      <input
                        type="month"
                        value={toMonthValue(form.inicio_experiencia)}
                        onChange={(event) =>
                          setValue("inicio_experiencia", event.target.value)
                        }
                        disabled={!dentroPrazo}
                        className={inputBase}
                      />
                    </Field>

                    <Field label="Linha temática" required>
                      <select
                        value={form.linha_tematica_id}
                        onChange={(event) =>
                          setValue("linha_tematica_id", event.target.value)
                        }
                        disabled={!dentroPrazo}
                        className={inputBase}
                      >
                        <option value="">Selecione</option>
                        {linhas.map((linha) => (
                          <option key={linha.id} value={linha.id}>
                            {linha.nome}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Texto da submissão"
                  icon={FileText}
                  description="Ao enviar definitivamente, todos os campos principais precisam estar preenchidos."
                >
                  {[
                    ["introducao", "Introdução"],
                    ["objetivos", "Objetivos"],
                    ["metodo", "Método/descrição da prática"],
                    ["resultados", "Resultados/impactos"],
                    ["consideracao", "Considerações finais"],
                    ["bibliografia", "Bibliografia"],
                  ].map(([key, label]) => (
                    <Field
                      key={key}
                      label={label}
                      required={key !== "bibliografia"}
                      counter={{
                        current: String(form[key] || "").length,
                        max: max[key],
                        over: String(form[key] || "").length > max[key],
                      }}
                    >
                      <textarea
                        rows={key === "bibliografia" ? 3 : 5}
                        value={form[key]}
                        onChange={(event) => setValue(key, event.target.value)}
                        maxLength={max[key]}
                        disabled={!dentroPrazo}
                        className={textareaBase}
                      />
                    </Field>
                  ))}
                </Section>

                <Section
                  title="Coautores"
                  icon={Users}
                  description="Informe somente coautores reais vinculados ao trabalho."
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {form.coautores.length}/{maxCoautores} coautor(es)
                    </div>

                    <Button
                      icon={Plus}
                      tone="success"
                      size="sm"
                      disabled={!dentroPrazo || form.coautores.length >= maxCoautores}
                      onClick={addCoautor}
                    >
                      Adicionar coautor
                    </Button>
                  </div>

                  {form.coautores.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum coautor informado.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {form.coautores.map((coautor, index) => (
                        <div
                          key={index}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <strong className="text-sm text-slate-800 dark:text-slate-100">
                              Coautor {index + 1}
                            </strong>

                            <Button
                              icon={Trash2}
                              tone="ghost"
                              size="sm"
                              disabled={!dentroPrazo}
                              onClick={() => removeCoautor(index)}
                            >
                              Remover
                            </Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              placeholder="Nome completo"
                              value={coautor.nome}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "nome", event.target.value)
                              }
                              className={inputBase}
                            />

                            <input
                              placeholder="E-mail"
                              type="email"
                              value={coautor.email}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "email", event.target.value)
                              }
                              className={inputBase}
                            />

                            <input
                              placeholder="Unidade"
                              value={coautor.unidade}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "unidade", event.target.value)
                              }
                              className={inputBase}
                            />

                            <input
                              placeholder="Papel/função no trabalho"
                              value={coautor.papel}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "papel", event.target.value)
                              }
                              className={inputBase}
                            />

                            <input
                              placeholder="CPF somente números"
                              inputMode="numeric"
                              value={coautor.cpf}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "cpf", event.target.value)
                              }
                              className={inputBase}
                            />

                            <input
                              placeholder="Vínculo"
                              value={coautor.vinculo}
                              disabled={!dentroPrazo}
                              onChange={(event) =>
                                updateCoautor(index, "vinculo", event.target.value)
                              }
                              className={inputBase}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              <aside className="space-y-4">
                <Section
                  title="Arquivo principal"
                  icon={ImageIcon}
                  description="Envie o banner, pôster, PDF ou apresentação vinculada ao trabalho."
                >
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
                    <div className="flex items-start gap-3">
                      <Upload className="mt-1 h-5 w-5 text-violet-600" />
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-white">
                          Upload oficial
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                          Formatos aceitos: PNG, JPG, GIF, WEBP, PDF, PPT ou PPTX.
                          Limite: 30MB.
                        </p>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.ppt,.pptx,image/png,image/jpeg,image/gif,image/webp,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      disabled={!dentroPrazo}
                      className="mt-4 block w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white dark:border-slate-700 dark:bg-slate-900"
                      onChange={onFileChange}
                    />

                    {form.arquivo ? (
                      <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                        <p className="font-bold">{form.arquivo.name}</p>
                        <p className="text-xs">{formatBytes(form.arquivo.size)}</p>
                        <button
                          type="button"
                          onClick={clearFile}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover arquivo selecionado
                        </button>
                      </div>
                    ) : arquivoExistente ? (
                      <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                        <p className="font-bold">Arquivo já enviado</p>
                        <p className="text-xs">
                          {arquivoExistente.nome_original || arquivoExistente.filename || "Arquivo disponível"}
                        </p>
                      </div>
                    ) : null}

                    {uploading ? (
                      <div className="mt-4">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Enviando arquivo: {uploadProgress}%
                        </p>
                      </div>
                    ) : null}
                  </div>
                </Section>

                <Section
                  title="Modelo oficial"
                  icon={Download}
                  description="Use o modelo da chamada quando houver arquivo institucional disponível."
                >
                  {modeloDisponivel ? (
                    <Button
                      tone="slate"
                      icon={Download}
                      loading={baixandoModelo}
                      onClick={baixarModelo}
                      className="w-full"
                    >
                      Baixar modelo de pôster
                    </Button>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Modelo não disponível para esta chamada.
                    </div>
                  )}
                </Section>

                <Section
                  title="Resumo antes do envio"
                  icon={Sparkles}
                  description="Use rascunho para salvar parcialmente. Use enviar quando o trabalho estiver completo."
                >
                  <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <ResumoLinha label="Título" ok={Boolean(trim(form.titulo))} />
                    <ResumoLinha label="Início da experiência" ok={Boolean(toMonthValue(form.inicio_experiencia))} />
                    <ResumoLinha label="Linha temática" ok={Boolean(form.linha_tematica_id)} />
                    <ResumoLinha label="Campos principais" ok={["introducao", "objetivos", "metodo", "resultados", "consideracao"].every((key) => Boolean(trim(form[key])))} />
                  </div>
                </Section>
              </aside>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-end">
            <Button tone="ghost" onClick={onClose} disabled={bloqueado}>
              Cancelar
            </Button>

            <Button
              tone="slate"
              icon={Save}
              loading={saving}
              disabled={!dentroPrazo || uploading}
              onClick={() => salvar("rascunho")}
            >
              Salvar rascunho
            </Button>

            <Button
              tone="primary"
              icon={Send}
              loading={saving}
              disabled={!dentroPrazo || uploading}
              onClick={() => salvar("submetida")}
            >
              Enviar trabalho
            </Button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ResumoLinha({ label, ok }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <ChevronDown className="h-4 w-4 text-slate-400" />
      )}
      <span className={ok ? "font-semibold text-slate-700 dark:text-slate-200" : ""}>
        {label}
      </span>
    </div>
  );
}