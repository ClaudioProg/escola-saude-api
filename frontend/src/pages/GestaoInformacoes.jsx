/* eslint-disable no-console */
"use strict";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  RefreshCcw,
  Newspaper,
  CalendarDays,
  Clock3,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Megaphone,
  LayoutGrid,
  AlertTriangle,
  Link as LinkIcon,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
} from "lucide-react";

import Footer from "../components/Footer";
import NenhumDado from "../components/NenhumDado";

/* =============================
   Logs DEV
============================= */
const IS_DEV = import.meta?.env?.MODE !== "production";
const logDev = (...a) => IS_DEV && console.log("[GestaoInformacoes]", ...a);
const errDev = (...a) => IS_DEV && console.error("[GestaoInformacoes]", ...a);

/* =============================
   Helpers
============================= */
function getAuthToken() {
  try {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  } catch {
    return "";
  }
}

async function authFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = new Headers(opts.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...opts, headers, credentials: "include" });
}

async function fetchJson(url, opts = {}) {
  const resp = await authFetch(url, opts);
  const data = await resp
    .json()
    .catch(() => ({ ok: false, mensagem: "Resposta inválida do servidor." }));

  if (!resp.ok || data?.ok === false) {
    throw new Error(data?.mensagem || data?.erro || "Falha na operação.");
  }

  return data;
}

function fmtData(value) {
  const v = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "—";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}

function getStatus(item) {
  const hoje = new Date().toISOString().slice(0, 10);

  if (!item?.ativo) return "inativa";
  if (item?.data_inicio_exibicao && hoje < item.data_inicio_exibicao) return "agendada";
  if (item?.data_fim_exibicao && hoje > item.data_fim_exibicao) return "expirada";
  return "ativa";
}

function stripHtml(html = "") {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractImageSrc(item) {
  if (!item?.imagem_url) return "";
  return item.imagem_url;
}

function emptyForm() {
  const hoje = new Date().toISOString().slice(0, 10);
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

/* =============================
   UI atoms
============================= */
function SoftButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-extrabold transition
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500
      disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${map[tone]}`}>
      {children}
    </span>
  );
}

function StatPill({ icon: Icon, label, value, tone = "zinc" }) {
  const tones = {
    zinc: { wrap: "bg-zinc-100 dark:bg-white/5", icon: "text-zinc-700 dark:text-zinc-200" },
    emerald: { wrap: "bg-emerald-100/80 dark:bg-emerald-950/30", icon: "text-emerald-700 dark:text-emerald-200" },
    amber: { wrap: "bg-amber-100/80 dark:bg-amber-950/30", icon: "text-amber-700 dark:text-amber-200" },
    rose: { wrap: "bg-rose-100/80 dark:bg-rose-950/30", icon: "text-rose-700 dark:text-rose-200" },
    indigo: { wrap: "bg-indigo-100/80 dark:bg-indigo-950/30", icon: "text-indigo-700 dark:text-indigo-200" },
  };

  const t = tones[tone] || tones.zinc;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-2xl ${t.wrap}`}>
          <Icon className={`w-5 h-5 ${t.icon}`} />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
          <div className="text-lg font-extrabold text-zinc-900 dark:text-white">{value}</div>
        </div>
      </div>
    </div>
  );
}

function HeaderHero({ onCriar, onAtualizar, loading, hint }) {
  return (
    <header className="relative isolate overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-rose-700" aria-hidden="true" />
      <div className="absolute -top-28 -left-28 w-80 h-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-black/10 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-9 md:py-10">
        <div className="flex flex-col items-center text-center gap-2.5">
          <div className="inline-flex items-center justify-center gap-2 text-white">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/15 backdrop-blur">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gestão de Informações</h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Crie comunicados, campanhas e destaques institucionais com período de publicação, imagem e conteúdo rico.
          </p>

          <div className="text-[12px] sm:text-xs text-white/80">{hint}</div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <SoftButton
              type="button"
              onClick={onAtualizar}
              disabled={loading}
              className="text-white bg-white/15 hover:bg-white/20 backdrop-blur border border-white/20"
            >
              <RefreshCcw className="w-4 h-4" />
              {loading ? "Atualizando…" : "Atualizar"}
            </SoftButton>

            <SoftButton
              type="button"
              onClick={onCriar}
              className="bg-white text-zinc-900 hover:bg-white/90 border border-white/40 shadow-md"
            >
              <Plus className="w-4.5 h-4.5" />
              Nova publicação
            </SoftButton>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* =============================
   Editor rico leve
============================= */
function ToolbarButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition"
      title={label}
      aria-label={label}
    >
      <Icon className="w-4 h-4" />
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

  const exec = (command, commandValue = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "<p></p>");
  };

  const onLink = () => {
    const url = window.prompt("Cole o link:");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      <div className="flex flex-wrap gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
        <ToolbarButton icon={Bold} label="Negrito" onClick={() => exec("bold")} />
        <ToolbarButton icon={Italic} label="Itálico" onClick={() => exec("italic")} />
        <ToolbarButton icon={Underline} label="Sublinhado" onClick={() => exec("underline")} />
        <ToolbarButton icon={List} label="Lista" onClick={() => exec("insertUnorderedList")} />
        <ToolbarButton icon={ListOrdered} label="Lista numerada" onClick={() => exec("insertOrderedList")} />
        <ToolbarButton icon={AlignLeft} label="Alinhar à esquerda" onClick={() => exec("justifyLeft")} />
        <ToolbarButton icon={AlignCenter} label="Centralizar" onClick={() => exec("justifyCenter")} />
        <ToolbarButton icon={AlignRight} label="Alinhar à direita" onClick={() => exec("justifyRight")} />
        <ToolbarButton icon={LinkIcon} label="Inserir link" onClick={onLink} />

        <label className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition cursor-pointer">
          <Palette className="w-4 h-4" />
          <input
            ref={colorRef}
            type="color"
            className="sr-only"
            onChange={(e) => exec("foreColor", e.target.value)}
          />
        </label>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[220px] p-4 text-sm text-zinc-800 dark:text-zinc-100 outline-none prose prose-sm max-w-none dark:prose-invert"
        onInput={() => onChange(editorRef.current?.innerHTML || "<p></p>")}
      />
    </div>
  );
}

/* =============================
   Modal formulário
============================= */
function ModalInformacao({
  open,
  onClose,
  onSalvar,
  salvando,
  form,
  setForm,
  isEditing,
}) {
  const onSelectImage = (file) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);

    setForm((prev) => ({
      ...prev,
      imagemFile: file,
      imagemPreview: preview,
    }));
  };

  if (!open) return null;

  const previewSrc = form.imagemPreview || form.imagemAtualUrl || "";

  return (
    <div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="rounded-[28px] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-rose-500" />

          <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-zinc-900 dark:text-white">
                {isEditing ? "Editar publicação" : "Nova publicação"}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Configure o conteúdo, período, imagem e exibição no painel do usuário.
              </p>
            </div>

            <SoftButton
              type="button"
              onClick={onClose}
              className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Fechar
            </SoftButton>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Título</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                    value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Badge</span>
                  <input
                    className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                    value={form.badge}
                    onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                    placeholder="Ex.: Mensagem da Escola da Saúde"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Subtítulo</span>
                <input
                  className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                  value={form.subtitulo}
                  onChange={(e) => setForm((p) => ({ ...p, subtitulo: e.target.value }))}
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Resumo</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm resize-y"
                  value={form.resumo}
                  onChange={(e) => setForm((p) => ({ ...p, resumo: e.target.value }))}
                  placeholder="Opcional. Se deixar vazio, o backend gera automaticamente a partir do conteúdo."
                />
              </label>

              <div>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Conteúdo formatado</span>
                <div className="mt-1">
                  <RichTextEditorLite
                    value={form.conteudo_html}
                    onChange={(html) => setForm((p) => ({ ...p, conteudo_html: html }))}
                  />
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 p-4">
                <h3 className="font-extrabold text-zinc-900 dark:text-white">Configuração da publicação</h3>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Tipo</span>
                      <select
                        className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                        value={form.tipo_exibicao}
                        onChange={(e) => setForm((p) => ({ ...p, tipo_exibicao: e.target.value }))}
                      >
                        <option value="destaque">Destaque</option>
                        <option value="comunicado">Comunicado</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Ordem</span>
                      <input
                        type="number"
                        min="0"
                        className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                        value={form.ordem}
                        onChange={(e) => setForm((p) => ({ ...p, ordem: e.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Início</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                        value={form.data_inicio_exibicao}
                        onChange={(e) => setForm((p) => ({ ...p, data_inicio_exibicao: e.target.value }))}
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Fim</span>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-sm"
                        value={form.data_fim_exibicao}
                        onChange={(e) => setForm((p) => ({ ...p, data_fim_exibicao: e.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.ativo}
                      onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
                    />
                    <div>
                      <div className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Publicação ativa</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Quando desativada, não aparece no painel mesmo estando no período.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/30 p-4">
                <h3 className="font-extrabold text-zinc-900 dark:text-white">Imagem associada</h3>

                <div className="mt-4 space-y-3">
                  <label className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-4 text-sm font-bold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <ImageIcon className="w-4 h-4" />
                    Selecionar imagem
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(e) => onSelectImage(e.target.files?.[0])}
                    />
                  </label>

                  <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-[180px] grid place-items-center">
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt="Prévia da publicação"
                        className="w-full h-[220px] object-cover"
                      />
                    ) : (
                      <div className="text-center text-zinc-500 dark:text-zinc-400 px-4 py-8">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-70" />
                        Nenhuma imagem selecionada
                      </div>
                    )}
                  </div>

                  {form.imagemNomeOriginal ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 break-all">
                      Arquivo atual: {form.imagemNomeOriginal}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <SoftButton
                  type="button"
                  onClick={onClose}
                  className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  Cancelar
                </SoftButton>

                <SoftButton
                  type="button"
                  onClick={onSalvar}
                  disabled={salvando}
                  className="bg-fuchsia-600 text-white hover:bg-fuchsia-700 border border-fuchsia-600 shadow-md"
                >
                  {salvando ? "Salvando…" : isEditing ? "Salvar alterações" : "Criar publicação"}
                </SoftButton>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================
   Card
============================= */
function CardInformacao({ item, onEdit, onDelete, onToggleAtivo }) {
  const status = getStatus(item);
  const imageSrc = extractImageSrc(item);

  const statusTone =
    status === "ativa"
      ? "emerald"
      : status === "agendada"
      ? "amber"
      : status === "expirada"
      ? "rose"
      : "zinc";

  const statusLabel =
    status === "ativa"
      ? "Ativa"
      : status === "agendada"
      ? "Agendada"
      : status === "expirada"
      ? "Expirada"
      : "Inativa";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/70 to-rose-500/70" />

      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {imageSrc ? (
          <div className="w-full h-[180px] rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
            <img src={imageSrc} alt={item.titulo} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="w-full h-[180px] rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
            <div className="text-center">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-70" />
              Sem imagem
            </div>
          </div>
        )}

        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-extrabold text-zinc-900 dark:text-white break-words">
            {item.titulo}
          </h3>

          {item.subtitulo ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300 break-words">{item.subtitulo}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone={statusTone}>
              <Clock3 className="w-3.5 h-3.5" />
              {statusLabel}
            </Chip>

            <Chip tone={item.tipo_exibicao === "destaque" ? "indigo" : "zinc"}>
              <Sparkles className="w-3.5 h-3.5" />
              {item.tipo_exibicao === "destaque" ? "Destaque" : "Comunicado"}
            </Chip>

            {item.badge ? <Chip tone="amber">{item.badge}</Chip> : null}
          </div>

          <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
            <div className="inline-flex items-center gap-1">
              <CalendarDays className="w-4 h-4 opacity-70" />
              {fmtData(item.data_inicio_exibicao)} até {fmtData(item.data_fim_exibicao)}
            </div>

            <div>
              Ordem: <span className="font-semibold">{item.ordem ?? 0}</span>
            </div>

            <p className="break-words">{item.resumo || stripHtml(item.conteudo_html || "").slice(0, 180)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <SoftButton
            type="button"
            onClick={() => onToggleAtivo(item)}
            className={`border ${
              item.ativo
                ? "border-indigo-200 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-200 bg-white dark:bg-zinc-950 hover:bg-indigo-50 dark:hover:bg-indigo-950/25"
                : "border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-200 bg-white dark:bg-zinc-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/25"
            }`}
          >
            {item.ativo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {item.ativo ? "Desativar" : "Ativar"}
          </SoftButton>

          <SoftButton
            type="button"
            onClick={() => onEdit(item)}
            className="border border-sky-200 dark:border-sky-900/40 text-sky-700 dark:text-sky-200 bg-white dark:bg-zinc-950 hover:bg-sky-50 dark:hover:bg-sky-950/25"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </SoftButton>

          <SoftButton
            type="button"
            onClick={() => onDelete(item)}
            className="border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-200 bg-white dark:bg-zinc-950 hover:bg-rose-50 dark:hover:bg-rose-950/25"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </SoftButton>
        </div>
      </div>
    </motion.article>
  );
}

/* =============================
   Página
============================= */
export default function GestaoInformacoes() {
  const reduceMotion = useReducedMotion();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [filtro, setFiltro] = useState("todos");

  const liveRef = useRef(null);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      setLive("Carregando publicações…");

      const data = await fetchJson("/api/informacoes");
      const lista = Array.isArray(data?.itens) ? data.itens : [];

      setItems(lista);
      setLive(`Publicações carregadas: ${lista.length}.`);
      logDev("Itens carregados:", lista.length);
    } catch (e) {
      errDev("Falha ao carregar:", e);
      setErro(e?.message || "Erro ao carregar publicações.");
      setItems([]);
      toast.error(`❌ ${e?.message || "Erro ao carregar publicações."}`);
      setLive("Falha ao carregar publicações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirCriacao = () => {
    setForm(emptyForm());
    setModalOpen(true);
  };

  const abrirEdicao = async (item) => {
    setForm({
      id: item.id,
      titulo: item.titulo || "",
      subtitulo: item.subtitulo || "",
      badge: item.badge || "",
      resumo: item.resumo || "",
      tipo_exibicao: item.tipo_exibicao || "destaque",
      ativo: !!item.ativo,
      ordem: item.ordem ?? 0,
      data_inicio_exibicao: String(item.data_inicio_exibicao || "").slice(0, 10),
      data_fim_exibicao: String(item.data_fim_exibicao || "").slice(0, 10),
      conteudo_html: item.conteudo_html || "<p></p>",
      imagemFile: null,
      imagemPreview: "",
      imagemAtualUrl: item.imagem_url || "",
      imagemNomeOriginal: item.imagem_nome_original || "",
    });

    setModalOpen(true);
  };

  const salvar = async () => {
    try {
      if (!form.titulo.trim()) {
        toast.error("Informe o título.");
        return;
      }

      if (!form.data_inicio_exibicao || !form.data_fim_exibicao) {
        toast.error("Informe o período de publicação.");
        return;
      }

      setSalvando(true);

      const fd = new FormData();
      fd.append("titulo", form.titulo);
      fd.append("subtitulo", form.subtitulo);
      fd.append("badge", form.badge);
      fd.append("resumo", form.resumo);
      fd.append("tipo_exibicao", form.tipo_exibicao);
      fd.append("ativo", String(!!form.ativo));
      fd.append("ordem", String(form.ordem ?? 0));
      fd.append("data_inicio_exibicao", form.data_inicio_exibicao);
      fd.append("data_fim_exibicao", form.data_fim_exibicao);
      fd.append("conteudo_html", form.conteudo_html || "<p></p>");

      if (form.imagemFile instanceof File) {
        fd.append("imagem", form.imagemFile);
      }

      const isEdit = !!form.id;
      const resp = await authFetch(isEdit ? `/api/informacoes/${form.id}` : "/api/informacoes", {
        method: isEdit ? "PUT" : "POST",
        body: fd,
      });

      const data = await resp.json().catch(() => ({ ok: false, mensagem: "Resposta inválida." }));

      if (!resp.ok || data?.ok === false) {
        throw new Error(data?.mensagem || data?.erro || "Falha ao salvar.");
      }

      toast.success(isEdit ? "✅ Publicação atualizada." : "✅ Publicação criada.");
      setModalOpen(false);
      setForm(emptyForm());
      await carregar();
    } catch (e) {
      errDev("Erro ao salvar:", e);
      toast.error(`❌ ${e?.message || "Falha ao salvar."}`);
    } finally {
      setSalvando(false);
    }
  };

  const toggleAtivo = async (item) => {
    try {
      const data = await fetchJson(`/api/informacoes/${item.id}/ativo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !item.ativo }),
      });

      toast.success(data?.mensagem || "Status atualizado.");
      await carregar();
    } catch (e) {
      toast.error(`❌ ${e?.message || "Falha ao alterar status."}`);
    }
  };

  const excluir = async (item) => {
    const ok = window.confirm(`Excluir a publicação "${item.titulo}"?`);
    if (!ok) return;

    try {
      const data = await fetchJson(`/api/informacoes/${item.id}`, { method: "DELETE" });
      toast.success(data?.mensagem || "Publicação excluída.");
      await carregar();
    } catch (e) {
      toast.error(`❌ ${e?.message || "Falha ao excluir."}`);
    }
  };

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
    if (filtro === "todos") return items;
    return items.filter((item) => getStatus(item) === filtro);
  }, [items, filtro]);

  const hint = useMemo(() => {
    if (loading) return "Carregando…";
    return `${items.length} publicação(ões) cadastrada(s)`;
  }, [loading, items.length]);

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden">
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      <HeaderHero onCriar={abrirCriacao} onAtualizar={carregar} loading={loading} hint={hint} />

      {loading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-fuchsia-100 dark:bg-fuchsia-950/30 z-40"
          role="progressbar"
          aria-label="Carregando dados"
        >
          <div className={`h-full bg-fuchsia-600 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <div className="px-3 sm:px-4 py-6 max-w-6xl mx-auto w-full min-w-0">
        {!loading && (
          <section aria-label="Métricas das publicações" className="mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              <StatPill icon={LayoutGrid} label="Total" value={stats.total} tone="zinc" />
              <StatPill icon={Newspaper} label="Ativas" value={stats.ativas} tone="emerald" />
              <StatPill icon={Clock3} label="Agendadas" value={stats.agendadas} tone="amber" />
              <StatPill icon={AlertTriangle} label="Expiradas" value={stats.expiradas} tone="rose" />
              <StatPill icon={EyeOff} label="Inativas" value={stats.inativas} tone="indigo" />
            </div>
          </section>
        )}

        {!loading && items.length > 0 && (
          <section aria-label="Filtros de publicações" className="mb-4">
            <div className="flex flex-wrap gap-2">
              {[
                ["todos", "Todas"],
                ["ativa", "Ativas"],
                ["agendada", "Agendadas"],
                ["expirada", "Expiradas"],
                ["inativa", "Inativas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltro(key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold border transition ${
                    filtro === key
                      ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-sm"
                      : "bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {!!erro && !loading && (
          <div
            className="rounded-3xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 mb-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-rose-800 dark:text-rose-200">Falha ao carregar publicações</p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 mt-1 break-words">{erro}</p>
              </div>
            </div>
          </div>
        )}

        {loading ? null : itemsFiltrados.length === 0 ? (
          <NenhumDado mensagem="Nenhuma publicação encontrada para este filtro." />
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
            {itemsFiltrados.map((item) => (
              <CardInformacao
                key={item.id}
                item={item}
                onEdit={abrirEdicao}
                onDelete={excluir}
                onToggleAtivo={toggleAtivo}
              />
            ))}
          </section>
        )}
      </div>

      <ModalInformacao
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSalvar={salvar}
        salvando={salvando}
        form={form}
        setForm={setForm}
        isEditing={!!form.id}
      />

      <Footer />
    </main>
  );
}