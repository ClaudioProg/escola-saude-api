// 📁 src/pages/GestaoInformacoes.jsx
// Atualizado em: 29/05/2026
//
// Plataforma Escola da Saúde — v2.1
//
// Página:
// - Gestão administrativa de informações institucionais/publicações.
//
// Contratos oficiais:
// - GET    /api/informacoes
// - POST   /api/informacoes
// - PUT    /api/informacoes/:id
// - PATCH  /api/informacoes/:id/ativo
// - DELETE /api/informacoes/:id
//
// Upload:
// - multipart/form-data
// - campo oficial: imagem
//
// Diretrizes v2.0:
// - sem toast direto;
// - sem fetch manual;
// - sem authToken;
// - sem resposta { mensagem } como contrato;
// - sem window.confirm;
// - sem Footer antigo;
// - sem bg-gelo;
// - resposta padrão ok/data/message/code/meta;
// - date-only em YYYY-MM-DD;
// - UX/UI premium real;
// - mobile-first;
// - acessível.

"use strict";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Info,
  Italic,
  LayoutGrid,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Megaphone,
  Newspaper,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Underline,
  X,
} from "lucide-react";

import api from "../services/api";
import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Modal from "../components/ui/Modal";
import NadaEncontrado from "../components/ui/NadaEncontrado";

/* =========================================================================
   Constantes
=========================================================================== */

const TIPOS_EXIBICAO = [
  { value: "destaque", label: "Destaque" },
  { value: "comunicado", label: "Comunicado" },
];

const FILTROS_STATUS = [
  ["todos", "Todas"],
  ["ativa", "Ativas"],
  ["agendada", "Agendadas"],
  ["expirada", "Expiradas"],
  ["inativa", "Inativas"],
];

const MAX_IMAGEM_MB = 2;
const MAX_IMAGEM_BYTES = MAX_IMAGEM_MB * 1024 * 1024;

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function hojeISO() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function isYMD(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function fmtData(value) {
  const v = String(value || "").slice(0, 10);

  if (!isYMD(v)) return "—";

  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function stripHtml(html = "") {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStatus(item) {
  const hoje = hojeISO();

  if (!item?.ativo) return "inativa";
  if (item?.data_inicio_exibicao && hoje < item.data_inicio_exibicao) return "agendada";
  if (item?.data_fim_exibicao && hoje > item.data_fim_exibicao) return "expirada";

  return "ativa";
}

function getStatusLabel(status) {
  const map = {
    ativa: "Ativa",
    agendada: "Agendada",
    expirada: "Expirada",
    inativa: "Inativa",
  };

  return map[status] || "Inativa";
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function unwrapData(response) {
  if (response?.data && typeof response.data === "object" && "ok" in response.data) {
    return response.data.data;
  }

  if (response && typeof response === "object" && "ok" in response) {
    return response.data;
  }

  return response?.data || response;
}

function emptyForm() {
  const hoje = hojeISO();

  return {
    id: null,
    titulo: "",
    subtitulo: "",
    badge: "",
    resumo: "",
    tipo_exibicao: "destaque",
    ativo: true,
    ordem: 0,
    data_inicio_exibicao: hoje,
    data_fim_exibicao: hoje,
    conteudo_html: "<p></p>",
    imagemFile: null,
    imagemPreview: "",
    imagemAtualUrl: "",
    imagemNomeOriginal: "",
  };
}

function normalizarTipoExibicao(value) {
  const tipo = String(value || "").trim();

  return tipo === "comunicado" ? "comunicado" : "destaque";
}

function validarImagem(file) {
  if (!file) return null;

  const mime = String(file.type || "").toLowerCase();
  const mimesPermitidos = new Set(["image/png", "image/jpeg", "image/webp"]);

  if (!mimesPermitidos.has(mime)) {
    return "Imagem inválida. Envie arquivo PNG, JPG ou WEBP.";
  }

  if (file.size > MAX_IMAGEM_BYTES) {
    return `Imagem muito grande. Envie arquivo de até ${MAX_IMAGEM_MB} MB.`;
  }

  return null;
}

/* =========================================================================
   UI local
=========================================================================== */

function AlertBox({ type = "info", title, message, onClose }) {
  const config = {
    info: {
      icon: Info,
      className:
        "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100",
    },
    success: {
      icon: CheckCircle2,
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
    },
    warning: {
      icon: AlertTriangle,
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
    },
    error: {
      icon: AlertCircle,
      className:
        "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
    },
  };

  const item = config[type] || config.info;
  const Icon = item.icon;

  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm", item.className)}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {title ? <p className="font-black">{title}</p> : null}
          <p className={title ? "mt-1" : ""}>{message}</p>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 transition hover:bg-white/40 dark:hover:bg-white/10"
            aria-label="Fechar mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SoftButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {children}
    </button>
  );
}

function Chip({ tone = "zinc", children }) {
  const map = {
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-900/40 dark:text-zinc-200 dark:border-zinc-800",
    emerald:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-200 dark:border-emerald-900/40",
    amber:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/25 dark:text-amber-200 dark:border-amber-900/40",
    rose: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/25 dark:text-rose-200 dark:border-rose-900/40",
    indigo:
      "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/25 dark:text-indigo-200 dark:border-indigo-900/40",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        map[tone] || map.zinc
      )}
    >
      {children}
    </span>
  );
}

function StatPill({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: {
      wrap: "bg-zinc-100 dark:bg-white/5",
      icon: "text-zinc-700 dark:text-zinc-200",
    },
    emerald: {
      wrap: "bg-emerald-100/80 dark:bg-emerald-950/30",
      icon: "text-emerald-700 dark:text-emerald-200",
    },
    amber: {
      wrap: "bg-amber-100/80 dark:bg-amber-950/30",
      icon: "text-amber-700 dark:text-amber-200",
    },
    rose: {
      wrap: "bg-rose-100/80 dark:bg-rose-950/30",
      icon: "text-rose-700 dark:text-rose-200",
    },
    indigo: {
      wrap: "bg-indigo-100/80 dark:bg-indigo-950/30",
      icon: "text-indigo-700 dark:text-indigo-200",
    },
  };

  const t = tones[tone] || tones.zinc;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <span
          className={cx(
            "inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            t.wrap
          )}
        >
          <Icon className={cx("h-5 w-5", t.icon)} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function BarraAcoesPagina({ onCriar, onAtualizar, loading, hint }) {
  return (
    <section
      aria-label="Ações da gestão de informações"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 dark:text-white">
            Publicações institucionais
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
            {hint}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SoftButton
            type="button"
            onClick={onAtualizar}
            disabled={loading}
            className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <RefreshCcw className={cx("h-4 w-4", loading ? "animate-spin" : "")} />
            {loading ? "Atualizando..." : "Atualizar"}
          </SoftButton>

          <SoftButton
            type="button"
            onClick={onCriar}
            className="border border-fuchsia-600 bg-fuchsia-600 text-white shadow-sm hover:bg-fuchsia-700"
          >
            <Plus className="h-4 w-4" />
            Nova publicação
          </SoftButton>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   Editor rico leve
=========================================================================== */

function ToolbarButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function RichTextEditorLite({ value, onChange }) {
  const editorRef = useRef(null);
  const colorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "<p></p>";
    }
  }, [value]);

  function exec(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "<p></p>");
  }

  function onLink() {
    const url = window.prompt("Cole o link:");

    if (!url) return;

    exec("createLink", url);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <ToolbarButton icon={Bold} label="Negrito" onClick={() => exec("bold")} />
        <ToolbarButton icon={Italic} label="Itálico" onClick={() => exec("italic")} />
        <ToolbarButton
          icon={Underline}
          label="Sublinhado"
          onClick={() => exec("underline")}
        />
        <ToolbarButton
          icon={List}
          label="Lista"
          onClick={() => exec("insertUnorderedList")}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Lista numerada"
          onClick={() => exec("insertOrderedList")}
        />
        <ToolbarButton
          icon={AlignLeft}
          label="Alinhar à esquerda"
          onClick={() => exec("justifyLeft")}
        />
        <ToolbarButton
          icon={AlignCenter}
          label="Centralizar"
          onClick={() => exec("justifyCenter")}
        />
        <ToolbarButton
          icon={AlignRight}
          label="Alinhar à direita"
          onClick={() => exec("justifyRight")}
        />
        <ToolbarButton icon={LinkIcon} label="Inserir link" onClick={onLink} />

        <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          <Palette className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Escolher cor do texto</span>
          <input
            ref={colorRef}
            type="color"
            className="sr-only"
            onChange={(event) => exec("foreColor", event.target.value)}
          />
        </label>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="prose prose-sm min-h-[220px] max-w-none p-4 text-sm text-zinc-800 outline-none dark:prose-invert dark:text-zinc-100"
        onInput={() => onChange(editorRef.current?.innerHTML || "<p></p>")}
        role="textbox"
        aria-multiline="true"
        aria-label="Conteúdo formatado da publicação"
      />
    </div>
  );
}

/* =========================================================================
   Modal confirmação de exclusão
=========================================================================== */

function ConfirmDeleteModal({ open, item, loading, onClose, onConfirm }) {
  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[1200]">
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="absolute inset-0 grid place-items-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmar-exclusao-informacao-title"
          className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="confirmar-exclusao-informacao-title"
                  className="text-lg font-black text-slate-900 dark:text-white"
                >
                  Excluir publicação?
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Esta ação removerá a publicação institucional da plataforma.
                </p>
              </div>

              <button
                type="button"
                onClick={loading ? undefined : onClose}
                disabled={loading}
                className="rounded-full border border-slate-200 p-2 transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900/60 dark:bg-rose-950/20">
              <p className="text-rose-800 dark:text-rose-200">
                <span className="font-black">Título:</span> {item.titulo || "—"}
              </p>
              <p className="mt-1 text-rose-700 dark:text-rose-300">
                <span className="font-semibold">Status:</span>{" "}
                {getStatusLabel(getStatus(item))}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
              Confirme apenas se esta publicação não deve mais ficar disponível na gestão institucional.
            </p>
          </div>

          <footer className="flex justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={loading ? undefined : onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Voltar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {loading ? "Excluindo..." : "Excluir publicação"}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Modal formulário
=========================================================================== */

function ModalInformacao({
  open,
  onClose,
  onSalvar,
  salvando,
  form,
  setForm,
  isEditing,
  mensagem,
  setMensagem,
}) {
  const previewSrc = form.imagemPreview || form.imagemAtualUrl || "";

  useEffect(() => {
    return () => {
      if (form.imagemPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(form.imagemPreview);
      }
    };
  }, [form.imagemPreview]);

  function onSelectImage(file) {
    if (!file) return;

    const erro = validarImagem(file);

    if (erro) {
      setMensagem({
        type: "warning",
        title: "Imagem inválida",
        message: erro,
      });
      return;
    }

    const preview = URL.createObjectURL(file);

    setForm((prev) => {
      if (prev.imagemPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.imagemPreview);
      }

      return {
        ...prev,
        imagemFile: file,
        imagemPreview: preview,
      };
    });
  }

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={salvando ? undefined : onClose}
      labelledBy="gestao-informacoes-modal-title"
      describedBy="gestao-informacoes-modal-desc"
      className="w-[96%] max-w-6xl overflow-hidden p-0"
    >
      <header className="bg-gradient-to-br from-slate-950 via-fuchsia-800 to-rose-700 px-4 py-4 text-white sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="gestao-informacoes-modal-title"
              className="text-xl font-black tracking-tight sm:text-2xl"
            >
              {isEditing ? "Editar publicação" : "Nova publicação"}
            </h2>
            <p id="gestao-informacoes-modal-desc" className="mt-1 text-sm text-white/85">
              Configure conteúdo, período, imagem e exibição no painel do usuário.
            </p>
          </div>

          <button
            type="button"
            onClick={salvando ? undefined : onClose}
            disabled={salvando}
            className="rounded-xl p-2 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:opacity-60"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="max-h-[calc(92vh-86px)] overflow-y-auto bg-slate-50 p-4 dark:bg-zinc-950 sm:p-5">
        {mensagem ? (
          <div className="mb-4">
            <AlertBox
              type={mensagem.type}
              title={mensagem.title}
              message={mensagem.message}
              onClose={() => setMensagem(null)}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-4 font-extrabold text-zinc-900 dark:text-white">
                Conteúdo da publicação
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                    Título <span className="text-rose-500">*</span>
                  </span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.titulo}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, titulo: event.target.value }))
                    }
                    maxLength={180}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                    Badge
                  </span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                    value={form.badge}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, badge: event.target.value }))
                    }
                    placeholder="Ex.: Mensagem da Escola da Saúde"
                    maxLength={80}
                  />
                </label>
              </div>

              <label className="mt-4 block">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                  Subtítulo
                </span>
                <input
                  className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.subtitulo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, subtitulo: event.target.value }))
                  }
                  maxLength={220}
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                  Resumo
                </span>
                <textarea
                  rows={3}
                  className="mt-1 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                  value={form.resumo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, resumo: event.target.value }))
                  }
                  placeholder="Opcional. Se deixar vazio, o backend gera automaticamente a partir do conteúdo."
                  maxLength={500}
                />
              </label>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                Conteúdo formatado <span className="text-rose-500">*</span>
              </span>

              <div className="mt-2">
                <RichTextEditorLite
                  value={form.conteudo_html}
                  onChange={(html) =>
                    setForm((prev) => ({ ...prev, conteudo_html: html }))
                  }
                />
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-extrabold text-zinc-900 dark:text-white">
                Configuração da publicação
              </h3>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      Tipo
                    </span>
                    <select
                      className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                      value={form.tipo_exibicao}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          tipo_exibicao: normalizarTipoExibicao(event.target.value),
                        }))
                      }
                    >
                      {TIPOS_EXIBICAO.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      Ordem
                    </span>
                    <input
                      type="number"
                      min="0"
                      className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                      value={form.ordem}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, ordem: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      Início
                    </span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                      value={form.data_inicio_exibicao}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          data_inicio_exibicao: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
                      Fim
                    </span>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                      value={form.data_fim_exibicao}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          data_fim_exibicao: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                  <input
                    type="checkbox"
                    checked={Boolean(form.ativo)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, ativo: event.target.checked }))
                    }
                  />
                  <div>
                    <div className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                      Publicação ativa
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Quando desativada, não aparece no painel mesmo estando no período.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-extrabold text-zinc-900 dark:text-white">
                Imagem associada
              </h3>

              <div className="mt-4 space-y-3">
                <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-4 text-sm font-bold hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  Selecionar imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => onSelectImage(event.target.files?.[0])}
                  />
                </label>

                <div className="grid min-h-[180px] place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt="Prévia da publicação"
                      className="h-[220px] w-full object-cover"
                    />
                  ) : (
                    <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                      <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
                      Nenhuma imagem selecionada
                    </div>
                  )}
                </div>

                {form.imagemNomeOriginal ? (
                  <p className="break-all text-xs text-zinc-500 dark:text-zinc-400">
                    Arquivo atual: {form.imagemNomeOriginal}
                  </p>
                ) : null}

                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Formatos permitidos: PNG, JPG ou WEBP. Tamanho máximo: {MAX_IMAGEM_MB} MB.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:flex-row sm:items-center sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={salvando ? undefined : onClose}
          disabled={salvando}
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={onSalvar}
          disabled={salvando}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-fuchsia-600 bg-fuchsia-600 px-4 py-2 text-sm font-black text-white shadow-md transition hover:bg-fuchsia-700 disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {salvando ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar publicação"}
        </button>
      </footer>
    </Modal>
  );
}

/* =========================================================================
   Card
=========================================================================== */

function CardInformacao({ item, onEdit, onDelete, onToggleAtivo, loadingAction }) {
  const status = getStatus(item);
  const imageSrc = item?.imagem_url || "";

  const statusTone =
    status === "ativa"
      ? "emerald"
      : status === "agendada"
        ? "amber"
        : status === "expirada"
          ? "rose"
          : "zinc";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/70 to-rose-500/70" />

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {imageSrc ? (
          <div className="h-[180px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
            <img
              src={imageSrc}
              alt={item.titulo}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-[180px] w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            <div className="text-center">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
              Sem imagem
            </div>
          </div>
        )}

        <div className="min-w-0">
          <h3 className="break-words text-base font-extrabold text-zinc-900 dark:text-white sm:text-lg">
            {item.titulo}
          </h3>

          {item.subtitulo ? (
            <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">
              {item.subtitulo}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={statusTone}>
              <Clock3 className="h-3.5 w-3.5" />
              {getStatusLabel(status)}
            </Chip>

            <Chip tone={item.tipo_exibicao === "destaque" ? "indigo" : "zinc"}>
              <Sparkles className="h-3.5 w-3.5" />
              {item.tipo_exibicao === "destaque" ? "Destaque" : "Comunicado"}
            </Chip>

            {item.badge ? <Chip tone="amber">{item.badge}</Chip> : null}
          </div>

          <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="inline-flex items-center gap-1">
              <CalendarDays className="h-4 w-4 opacity-70" />
              {fmtData(item.data_inicio_exibicao)} até {fmtData(item.data_fim_exibicao)}
            </div>

            <div>
              Ordem: <span className="font-semibold">{item.ordem ?? 0}</span>
            </div>

            <p className="break-words">
              {item.resumo || stripHtml(item.conteudo_html || "").slice(0, 180)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <SoftButton
            type="button"
            onClick={() => onToggleAtivo(item)}
            disabled={loadingAction}
            className={cx(
              "border bg-white dark:bg-zinc-950",
              item.ativo
                ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900/40 dark:text-indigo-200 dark:hover:bg-indigo-950/25"
                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-200 dark:hover:bg-emerald-950/25"
            )}
          >
            {item.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {item.ativo ? "Desativar" : "Ativar"}
          </SoftButton>

          <SoftButton
            type="button"
            onClick={() => onEdit(item)}
            disabled={loadingAction}
            className="border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-900/40 dark:bg-zinc-950 dark:text-sky-200 dark:hover:bg-sky-950/25"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </SoftButton>

          <SoftButton
            type="button"
            onClick={() => onDelete(item)}
            disabled={loadingAction}
            className="border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-zinc-950 dark:text-rose-200 dark:hover:bg-rose-950/25"
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </SoftButton>
        </div>
      </div>
    </motion.article>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function GestaoInformacoes() {
  const reduceMotion = useReducedMotion();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);

  const [deleteState, setDeleteState] = useState({
    open: false,
    item: null,
  });

  const liveRef = useRef(null);

  function setLive(msg) {
    if (liveRef.current) {
      liveRef.current.textContent = msg;
    }
  }

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      setMensagem(null);
      setLive("Carregando publicações.");

      const response = await api.get("/informacoes");
      const data = unwrapData(response);
      const lista = Array.isArray(data) ? data : [];

      setItems(lista);
      setLive(`Publicações carregadas: ${lista.length}.`);
    } catch (error) {
      const message = getErrorMessage(error, "Erro ao carregar publicações.");

      setErro(message);
      setItems([]);
      setMensagem({
        type: "error",
        title: "Falha ao carregar publicações",
        message,
      });
      setLive("Falha ao carregar publicações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Gestão de Informações | Escola da Saúde";
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirCriacao() {
    setForm(emptyForm());
    setMensagem(null);
    setModalOpen(true);
  }

  function abrirEdicao(item) {
    setForm({
      id: item.id,
      titulo: item.titulo || "",
      subtitulo: item.subtitulo || "",
      badge: item.badge || "",
      resumo: item.resumo || "",
      tipo_exibicao: normalizarTipoExibicao(item.tipo_exibicao),
      ativo: Boolean(item.ativo),
      ordem: item.ordem ?? 0,
      data_inicio_exibicao: String(item.data_inicio_exibicao || "").slice(0, 10),
      data_fim_exibicao: String(item.data_fim_exibicao || "").slice(0, 10),
      conteudo_html: item.conteudo_html || "<p></p>",
      imagemFile: null,
      imagemPreview: "",
      imagemAtualUrl: item.imagem_url || "",
      imagemNomeOriginal: item.imagem_nome_original || "",
    });

    setMensagem(null);
    setModalOpen(true);
  }

  function fecharModal() {
    if (salvando) return;

    setModalOpen(false);
    setForm(emptyForm());
  }

  function validarForm() {
    if (!String(form.titulo || "").trim()) {
      return "Informe o título.";
    }

    if (!form.data_inicio_exibicao || !form.data_fim_exibicao) {
      return "Informe o período de publicação.";
    }

    if (!isYMD(form.data_inicio_exibicao) || !isYMD(form.data_fim_exibicao)) {
      return "Informe datas válidas no formato YYYY-MM-DD.";
    }

    if (form.data_fim_exibicao < form.data_inicio_exibicao) {
      return "A data final não pode ser menor que a data inicial.";
    }

    if (!stripHtml(form.conteudo_html || "").trim()) {
      return "Informe o conteúdo da publicação.";
    }

    return null;
  }

  async function salvar() {
    try {
      const erroValidacao = validarForm();

      if (erroValidacao) {
        setMensagem({
          type: "warning",
          title: "Revise os dados",
          message: erroValidacao,
        });
        return;
      }

      setSalvando(true);
      setMensagem(null);
      setLive("Salvando publicação.");

      const fd = new FormData();
      fd.append("titulo", form.titulo.trim());
      fd.append("subtitulo", form.subtitulo || "");
      fd.append("badge", form.badge || "");
      fd.append("resumo", form.resumo || "");
      fd.append("tipo_exibicao", normalizarTipoExibicao(form.tipo_exibicao));
      fd.append("ativo", String(Boolean(form.ativo)));
      fd.append("ordem", String(form.ordem ?? 0));
      fd.append("data_inicio_exibicao", form.data_inicio_exibicao);
      fd.append("data_fim_exibicao", form.data_fim_exibicao);
      fd.append("conteudo_html", form.conteudo_html || "<p></p>");

      if (form.imagemFile instanceof File) {
        fd.append("imagem", form.imagemFile);
      }

      const isEdit = Boolean(form.id);

      if (isEdit) {
        await api.put(`/informacoes/${form.id}`, fd);
      } else {
        await api.post("/informacoes", fd);
      }

      setMensagem({
        type: "success",
        title: isEdit ? "Publicação atualizada" : "Publicação criada",
        message: isEdit
          ? "A publicação foi atualizada com sucesso."
          : "A publicação foi criada com sucesso.",
      });

      setModalOpen(false);
      setForm(emptyForm());
      await carregar();
    } catch (error) {
      setMensagem({
        type: "error",
        title: "Falha ao salvar publicação",
        message: getErrorMessage(error, "Falha ao salvar publicação."),
      });
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(item) {
    try {
      setLoadingAction(true);
      setMensagem(null);

      await api.patch(`/informacoes/${item.id}/ativo`, {
        ativo: !item.ativo,
      });

      setMensagem({
        type: "success",
        title: "Status atualizado",
        message: item.ativo
          ? "A publicação foi desativada com sucesso."
          : "A publicação foi ativada com sucesso.",
      });

      await carregar();
    } catch (error) {
      setMensagem({
        type: "error",
        title: "Falha ao alterar status",
        message: getErrorMessage(error, "Falha ao alterar status da publicação."),
      });
    } finally {
      setLoadingAction(false);
    }
  }

  function solicitarExclusao(item) {
    setDeleteState({
      open: true,
      item,
    });
  }

  function fecharExclusao() {
    if (loadingAction) return;

    setDeleteState({
      open: false,
      item: null,
    });
  }

  async function confirmarExclusao() {
    const item = deleteState.item;

    if (!item?.id) {
      fecharExclusao();
      return;
    }

    try {
      setLoadingAction(true);
      setMensagem(null);

      await api.delete(`/informacoes/${item.id}`);

      setMensagem({
        type: "success",
        title: "Publicação excluída",
        message: "A publicação foi excluída com sucesso.",
      });

      setDeleteState({
        open: false,
        item: null,
      });

      await carregar();
    } catch (error) {
      setMensagem({
        type: "error",
        title: "Falha ao excluir publicação",
        message: getErrorMessage(error, "Falha ao excluir publicação."),
      });
    } finally {
      setLoadingAction(false);
    }
  }

  const stats = useMemo(() => {
    let ativas = 0;
    let agendadas = 0;
    let expiradas = 0;
    let inativas = 0;

    for (const item of items) {
      const status = getStatus(item);

      if (status === "ativa") ativas += 1;
      else if (status === "agendada") agendadas += 1;
      else if (status === "expirada") expiradas += 1;
      else inativas += 1;
    }

    return {
      total: items.length,
      ativas,
      agendadas,
      expiradas,
      inativas,
    };
  }, [items]);

  const itemsFiltrados = useMemo(() => {
    const termo = String(busca || "").trim().toLowerCase();

    return items.filter((item) => {
      const status = getStatus(item);

      if (filtro !== "todos" && status !== filtro) return false;

      if (!termo) return true;

      const haystack = [
        item.titulo,
        item.subtitulo,
        item.badge,
        item.resumo,
        stripHtml(item.conteudo_html || ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(termo);
    });
  }, [items, filtro, busca]);

  const hint = useMemo(() => {
    if (loading) return "Carregando...";
    return `${items.length} publicação(ões) cadastrada(s)`;
  }, [loading, items.length]);

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-white">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <div className="mx-auto w-full max-w-6xl px-3 pt-4 sm:px-4">
  <HeaderHero
    titulo="Gestão de Informações"
    subtitulo="Crie comunicados, campanhas e destaques institucionais com período de publicação, imagem e conteúdo rico."
    icone={Megaphone}
    tamanho="md"
    raio="xl"
  />
</div>

      {loading ? (
        <div
          className="sticky left-0 top-0 z-40 h-1 w-full bg-fuchsia-100 dark:bg-fuchsia-950/30"
          role="progressbar"
          aria-label="Carregando dados"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-fuchsia-600",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <section id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4">
  {mensagem ? (
    <div className="mb-4">
      <AlertBox
        type={mensagem.type}
        title={mensagem.title}
        message={mensagem.message}
        onClose={() => setMensagem(null)}
      />
    </div>
  ) : null}

<BarraAcoesPagina
  onCriar={abrirCriacao}
  onAtualizar={carregar}
  loading={loading}
  hint={hint}
/>

{!loading ? (
  <section aria-label="Métricas das publicações" className="mb-4 mt-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
              <StatPill icon={LayoutGrid} label="Total" value={stats.total} tone="zinc" />
              <StatPill icon={Newspaper} label="Ativas" value={stats.ativas} tone="emerald" />
              <StatPill icon={Clock3} label="Agendadas" value={stats.agendadas} tone="amber" />
              <StatPill
                icon={AlertTriangle}
                label="Expiradas"
                value={stats.expiradas}
                tone="rose"
              />
              <StatPill icon={EyeOff} label="Inativas" value={stats.inativas} tone="indigo" />
            </div>
          </section>
        ) : null}

        {!loading && items.length > 0 ? (
          <section
            aria-label="Filtros e busca de publicações"
            className="mb-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTROS_STATUS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFiltro(key)}
                    className={cx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-extrabold transition",
                      filtro === key
                        ? "border-fuchsia-600 bg-fuchsia-600 text-white shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900/40"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="relative block w-full lg:max-w-xs">
                <span className="sr-only">Buscar publicação</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:ring-2 focus:ring-fuchsia-500 dark:border-zinc-800 dark:bg-zinc-950"
                  placeholder="Buscar por título, badge, resumo..."
                />
              </label>
            </div>
          </section>
        ) : null}

        {erro && !loading ? (
          <div
            className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/25"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600 dark:text-rose-300" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-rose-800 dark:text-rose-200">
                  Falha ao carregar publicações
                </p>
                <p className="mt-1 break-words text-sm text-rose-800/90 dark:text-rose-200/90">
                  {erro}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? null : itemsFiltrados.length === 0 ? (
          <NadaEncontrado mensagem="Nenhuma publicação encontrada para este filtro." />
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
            {itemsFiltrados.map((item) => (
              <CardInformacao
                key={item.id}
                item={item}
                onEdit={abrirEdicao}
                onDelete={solicitarExclusao}
                onToggleAtivo={toggleAtivo}
                loadingAction={loadingAction}
              />
            ))}
          </section>
        )}
      </section>

      <ModalInformacao
        open={modalOpen}
        onClose={fecharModal}
        onSalvar={salvar}
        salvando={salvando}
        form={form}
        setForm={setForm}
        isEditing={Boolean(form.id)}
        mensagem={mensagem}
        setMensagem={setMensagem}
      />

      <ConfirmDeleteModal
        open={deleteState.open}
        item={deleteState.item}
        loading={loadingAction}
        onClose={fecharExclusao}
        onConfirm={confirmarExclusao}
      />

      <Footer />
    </main>
  );
}