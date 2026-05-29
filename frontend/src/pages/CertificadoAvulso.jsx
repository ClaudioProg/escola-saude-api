// ✅ frontend/src/pages/CertificadoAvulso.jsx — v2.1
// Atualizado em: 29/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Loader2,
  Mail,
  PenSquare,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserSquare2,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../components/ui/AppToast";
import { api } from "../services/api";
import { downloadBlob } from "../utils/downloadArquivo";
import { formatDateBr, extractYmd } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.certificadoAvulso.listar()
 * api.certificadoAvulso.criar(payload)
 * api.certificadoAvulso.pdf(id, params?)
 * api.certificadoAvulso.enviar(id, params?)
 *
 * api.assinatura.listar()
 */

/* ─────────────────────────────────────────────
 * Constantes oficiais
 * ───────────────────────────────────────────── */

const MODALIDADES = [
  "participante",
  "organizador",
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

const ROTULO_MODALIDADE = {
  participante: "Participante",
  organizador: "organizador(a) / Palestrante",
  banca_avaliadora: "Banca Avaliadora",
  oficineiro: "Oficineiro(a)",
  mediador: "Mediador(a)",
  banca_tcr_medica: "Banca TCR Médica (MFC)",
  banca_tcr_multi: "Banca TCR Multiprofissional",
  residente_medica: "Residente Médica (MFC)",
  residente_multi: "Residente Multiprofissional",
  mostra_banner: "Mostra Banner",
  mostra_oral: "Mostra Oral",
  comissao_organizadora: "Comissão Organizadora",
};

const MODALIDADES_EXIGEM_TITULO = [
  "residente_medica",
  "residente_multi",
  "mostra_banner",
  "mostra_oral",
  "oficineiro",
];

const MODALIDADES_SEM_CARGA = ["banca_avaliadora", "comissao_organizadora"];

const STATUS_VALIDOS_DOWNLOAD = ["emitido", "enviado"];

const RAFAELLA_PITOL_ID = 17;
const FABIO_LOPEZ_ID = 2474;

const KEY_ASSINATURA_ADICIONAL_ENABLED =
  "certificado_avulso_assinatura_adicional_enabled";
const KEY_ASSINATURA_ADICIONAL_ID =
  "certificado_avulso_assinatura_adicional_id";
const KEY_ASSINATURA_SECRETARIO_ENABLED =
  "certificado_avulso_assinatura_secretario_enabled";

const KEY_FILTRO_ENVIO = "certificado_avulso_filtro_envio";
const KEY_FILTRO_STATUS = "certificado_avulso_filtro_status";
const KEY_BUSCA = "certificado_avulso_busca";

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

function safeText(value, max = 5000) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function onlyDigits(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

function validarEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function isYmd(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dataBR(value) {
  const iso = extractYmd(value);

  return iso ? formatDateBr(iso) : "—";
}

function formatarPeriodo(item) {
  const inicio = item?.data_inicio || "";
  const fim = item?.data_fim || inicio;

  if (!inicio && !fim) return "—";

  const di = dataBR(inicio);
  const df = dataBR(fim);

  if (di === df) return di;

  return `${di} a ${df}`;
}

function formatarCarga(item) {
  const carga = Number(item?.carga_horaria || 0);
  return Number.isFinite(carga) && carga > 0 ? `${carga}h` : "—";
}

function modalidadeExigeTitulo(modalidade) {
  return MODALIDADES_EXIGEM_TITULO.includes(modalidade);
}

function modalidadeSemCarga(modalidade) {
  return MODALIDADES_SEM_CARGA.includes(modalidade);
}

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nomeArquivoSeguro(value) {
  const nome = String(value || "certificado_avulso")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return nome || "certificado_avulso";
}

function statusTone(status) {
  if (status === "emitido" || status === "enviado") return "emerald";
  if (status === "cancelado" || status === "anulado") return "rose";
  if (status === "substituido") return "violet";
  if (status === "erro_emissao") return "amber";
  return "slate";
}

function statusLabel(status) {
  if (status === "emitido") return "Emitido";
  if (status === "enviado") return "Enviado";
  if (status === "cancelado") return "Cancelado";
  if (status === "anulado") return "Anulado";
  if (status === "substituido") return "Substituído";
  if (status === "erro_emissao") return "Erro de emissão";
  return "Sem status";
}

function getIdentificadorLabel(item) {
  if (item?.identificador_tipo === "cpf") {
    return item?.identificador_mascarado || "CPF informado";
  }

  if (item?.identificador_tipo === "registro_funcional") {
    return item?.identificador_mascarado || "Registro funcional informado";
  }

  return item?.identificador_mascarado || "Identificador informado";
}

function certificadoPodeGerarPdf(item) {
  return STATUS_VALIDOS_DOWNLOAD.includes(item?.status || "emitido");
}

function certificadoPdfConsolidado(item) {
  return Boolean(item?.arquivo_pdf && item?.hash_pdf);
}

function getNumeroCertificadoLabel(item) {
  return item?.numero_certificado || "Número ainda não informado";
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

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
    violet:
      "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/60",
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

function MiniStat({ icon: Icon, label, value, tone = "slate" }) {
  const tones = {
    slate: {
      card: "bg-white text-slate-900 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
      icon: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
    },
    emerald: {
      card: "bg-white text-slate-900 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
      icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
    },
    amber: {
      card: "bg-white text-slate-900 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
      icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    },
    rose: {
      card: "bg-white text-slate-900 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
      icon: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200",
    },
    cyan: {
      card: "bg-white text-slate-900 ring-slate-200 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800",
      icon: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200",
    },
  };

  const t = tones[tone] || tones.slate;

  return (
    <div className={cx("rounded-3xl p-4 shadow-sm ring-1", t.card)}>
      <div className="flex items-center gap-3">
        <div className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", t.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="text-2xl font-black leading-none">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BarraAcoesPagina({ carregando, onRefresh, onCadastrar, onFocusBusca }) {
  useEffect(() => {
    const onKey = (event) => {
      const key = typeof event?.key === "string" ? event.key.toLowerCase() : "";
      const mac = /(Mac|iPhone|iPad)/i.test(navigator.userAgent);

      if (!key) return;

      if ((mac && event.metaKey && key === "k") || (!mac && event.ctrlKey && key === "k")) {
        event.preventDefault();
        onFocusBusca?.();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onFocusBusca]);

  return (
    <section
      aria-label="Ações de certificados avulsos"
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950 dark:text-white">
            Cadastro e emissão manual
          </p>

          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-zinc-400">
            Cadastre certificados fora do fluxo automático, consolide o PDF oficial e envie por e-mail quando necessário.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Botao
            type="button"
            variant="contorno"
            onClick={onRefresh}
            disabled={carregando}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCcw
                className={cx("h-4 w-4", carregando && "animate-spin")}
                aria-hidden="true"
              />
              {carregando ? "Atualizando..." : "Atualizar"}
            </span>
          </Botao>

          <Botao type="button" variant="mensal" onClick={onCadastrar}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Cadastrar
            </span>
          </Botao>
        </div>
      </div>
    </section>
  );
}

function AvisoIdentificadorSeguro() {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          O identificador pode ser CPF ou registro funcional. Na visualização
          pública, a plataforma usa apenas identificador mascarado, código de
          validação e metadados seguros do certificado.
        </p>
      </div>
    </section>
  );
}

function Toolbar({
  busca,
  setBusca,
  filtroEnvio,
  setFiltroEnvio,
  filtroStatus,
  setFiltroStatus,
  buscaRef,
  onLimpar,
}) {
  return (
    <section
      aria-label="Filtros de certificados avulsos"
      className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome, e-mail, curso, modalidade ou código..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            aria-label="Buscar certificados avulsos"
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
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-zinc-400">
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros:
          </span>

          <select
            value={filtroEnvio}
            onChange={(event) => setFiltroEnvio(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-amber-950"
            aria-label="Filtrar por envio"
          >
            <option value="todos">Todos</option>
            <option value="enviados">Enviados</option>
            <option value="nao_enviados">Não enviados</option>
          </select>

          <select
            value={filtroStatus}
            onChange={(event) => setFiltroStatus(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-amber-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-amber-950"
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            <option value="emitido">Emitidos</option>
            <option value="enviado">Enviados</option>
            <option value="cancelado">Cancelados</option>
            <option value="anulado">Anulados</option>
            <option value="substituido">Substituídos</option>
            <option value="erro_emissao">Erro de emissão</option>
          </select>

          <Botao type="button" variant="contorno" onClick={onLimpar}>
            Limpar filtros
          </Botao>
        </div>
      </div>
    </section>
  );
}

function Campo({ label, htmlFor, required = false, hint, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-black text-slate-700 dark:text-zinc-200"
      >
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>

      <div className="mt-1">{children}</div>

      {hint ? (
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function FormularioCertificado({
  form,
  setForm,
  salvando,
  onSubmit,
  formRef,
  usarAssinaturaAdicional,
  setUsarAssinaturaAdicional,
  assinaturaAdicionalId,
  setAssinaturaAdicionalId,
  usarAssinaturaSecretario,
  setUsarAssinaturaSecretario,
  assinaturas,
  assinaturasCarregando,
  assinaturaAdicionalNome,
}) {
  const modalidade = form.modalidade || "participante";
  const exigeTitulo = modalidadeExigeTitulo(modalidade);
  const semCarga = modalidadeSemCarga(modalidade);

  const handleChange = useCallback(
    (event) => {
      const { name, value } = event.target;

      if (name === "identificador") {
        setForm((prev) => ({
          ...prev,
          identificador: safeText(value, 80),
        }));
        return;
      }

      if (name === "email") {
        setForm((prev) => ({
          ...prev,
          email: safeText(value, 160).toLowerCase(),
        }));
        return;
      }

      if (name === "carga_horaria") {
        setForm((prev) => ({
          ...prev,
          carga_horaria: value.replace(/[^\d]/g, "").slice(0, 4),
        }));
        return;
      }

      if (name === "modalidade") {
        const novaModalidade = value;

        setForm((prev) => ({
          ...prev,
          modalidade: novaModalidade,
          titulo_trabalho: modalidadeExigeTitulo(novaModalidade)
            ? prev.titulo_trabalho
            : "",
          carga_horaria: modalidadeSemCarga(novaModalidade)
            ? ""
            : prev.carga_horaria,
        }));
        return;
      }

      const maxMap = {
        nome: 180,
        curso: 300,
        titulo_trabalho: 500,
        texto_personalizado: 5000,
      };

      setForm((prev) => ({
        ...prev,
        [name]: safeText(value, maxMap[name] || 300),
      }));
    },
    [setForm]
  );

  return (
    <section className="rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <header className="border-b border-slate-200 p-4 dark:border-zinc-800 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-rose-50 p-2 ring-1 ring-rose-100 dark:bg-rose-950/30 dark:ring-rose-800/60">
            <PenSquare className="h-5 w-5 text-rose-700 dark:text-rose-200" aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-950 dark:text-white">
              Novo certificado
            </h2>

            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
  Cadastro manual com modalidade oficial, identificador seguro e
  assinatura institucional obrigatória.
</p>
          </div>
        </div>
      </header>

      <form
        ref={formRef}
        id="form-certificado-avulso"
        onSubmit={onSubmit}
        className="space-y-4 p-4 sm:p-5"
        aria-label="Cadastro de certificado avulso"
        aria-busy={salvando ? "true" : "false"}
      >
        <Campo label="Nome completo" htmlFor="nome" required>
          <input
            id="nome"
            name="nome"
            type="text"
            value={form.nome}
            onChange={handleChange}
            required
            autoComplete="name"
            disabled={salvando}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
          />
        </Campo>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            label="Identificador"
            htmlFor="identificador"
            required
            hint="Aceita CPF ou registro funcional. CPF será mascarado na validação pública."
          >
            <input
              id="identificador"
              name="identificador"
              type="text"
              value={form.identificador}
              onChange={handleChange}
              required
              disabled={salvando}
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>

          <Campo label="E-mail" htmlFor="email" required>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={salvando}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>
        </div>

        <Campo label="Evento / curso" htmlFor="curso" required>
          <input
            id="curso"
            name="curso"
            type="text"
            value={form.curso}
            onChange={handleChange}
            required
            disabled={salvando}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
          />
        </Campo>

        <Campo label="Modalidade / participação" htmlFor="modalidade">
          <select
            id="modalidade"
            name="modalidade"
            value={form.modalidade}
            onChange={handleChange}
            disabled={salvando}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
          >
            {MODALIDADES.map((modalidadeOption) => (
              <option key={modalidadeOption} value={modalidadeOption}>
                {ROTULO_MODALIDADE[modalidadeOption] || modalidadeOption}
              </option>
            ))}
          </select>
        </Campo>

        {exigeTitulo ? (
          <Campo label="Título do trabalho / oficina" htmlFor="titulo_trabalho" required>
            <input
              id="titulo_trabalho"
              name="titulo_trabalho"
              type="text"
              value={form.titulo_trabalho}
              onChange={handleChange}
              required={exigeTitulo}
              disabled={salvando}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo
            label="Carga horária"
            htmlFor="carga_horaria"
            hint={
              semCarga
                ? "Não se aplica à modalidade escolhida."
                : "Obrigatória nas modalidades em que houver carga horária."
            }
          >
            <input
              id="carga_horaria"
              name="carga_horaria"
              type="number"
              min={1}
              step={1}
              value={form.carga_horaria}
              onChange={handleChange}
              disabled={salvando || semCarga}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>

          <Campo label="Data de início" htmlFor="data_inicio">
            <input
              id="data_inicio"
              name="data_inicio"
              type="date"
              value={form.data_inicio}
              onChange={handleChange}
              disabled={salvando}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>

          <Campo label="Data de término" htmlFor="data_fim">
            <input
              id="data_fim"
              name="data_fim"
              type="date"
              value={form.data_fim}
              onChange={handleChange}
              disabled={salvando}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            />
          </Campo>
        </div>

        <Campo
          label="Texto personalizado"
          htmlFor="texto_personalizado"
          hint="Opcional. Quando preenchido, substitui o texto automático do certificado."
        >
          <textarea
            id="texto_personalizado"
            name="texto_personalizado"
            rows={4}
            value={form.texto_personalizado}
            onChange={handleChange}
            disabled={salvando}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
            placeholder="Ex.: Participou como..."
          />
        </Campo>

        <section className="rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
  <div className="flex items-start gap-3">
    <div className="rounded-2xl bg-emerald-50 p-2 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-800/60">
      <ShieldCheck
        className="h-5 w-5 text-emerald-700 dark:text-emerald-200"
        aria-hidden="true"
      />
    </div>

    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-black text-slate-950 dark:text-white">
        Assinaturas do certificado
      </h3>

      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        A assinatura institucional da Rafaella Pitol Corrêa é obrigatória e será
        incluída automaticamente no PDF.
      </p>
    </div>
  </div>

  <div className="mt-4 space-y-3">
    <div className="rounded-2xl border border-emerald-200 bg-white p-3 dark:border-emerald-900/50 dark:bg-zinc-900">
      <p className="text-sm font-black text-emerald-800 dark:text-emerald-100">
        Rafaella Pitol Corrêa — assinatura obrigatória
      </p>

      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        ID {RAFAELLA_PITOL_ID}. Será posicionada automaticamente como última
        assinatura à direita, exceto quando houver assinatura do Secretário.
      </p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={usarAssinaturaAdicional}
          onChange={(event) => {
            setUsarAssinaturaAdicional(event.target.checked);
            if (!event.target.checked) setAssinaturaAdicionalId("");
          }}
        />
        Adicionar assinatura complementar
      </label>

      <div
        className={cx(
          "mt-3",
          usarAssinaturaAdicional ? "" : "pointer-events-none opacity-50"
        )}
      >
        <label
          htmlFor="assinatura_adicional"
          className="block text-sm font-black text-slate-700 dark:text-zinc-200"
        >
          Selecionar assinatura complementar
        </label>

        <select
          id="assinatura_adicional"
          value={assinaturaAdicionalId}
          onChange={(event) => setAssinaturaAdicionalId(event.target.value)}
          disabled={
            !usarAssinaturaAdicional ||
            assinaturasCarregando ||
            assinaturas.length === 0
          }
          className="mt-1 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-amber-700 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950"
        >
          <option value="">
            {assinaturasCarregando ? "Carregando..." : "— Selecione —"}
          </option>

          {assinaturas
            .filter((assinatura) => {
              const id = Number(assinatura.id);
              return id !== RAFAELLA_PITOL_ID && id !== FABIO_LOPEZ_ID;
            })
            .map((assinatura) => (
              <option key={assinatura.id} value={assinatura.id}>
                {assinatura.nome}
              </option>
            ))}
        </select>

        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
          Esta assinatura, quando usada, aparece antes da assinatura
          institucional obrigatória.
        </p>

        {usarAssinaturaAdicional && assinaturaAdicionalNome ? (
          <p className="mt-2 text-xs font-black text-emerald-700 dark:text-emerald-200">
            Selecionada: {assinaturaAdicionalNome}
          </p>
        ) : null}
      </div>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-bold text-slate-700 dark:text-zinc-200">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={usarAssinaturaSecretario}
          onChange={(event) => setUsarAssinaturaSecretario(event.target.checked)}
        />
        Incluir assinatura do Secretário de Saúde
      </label>

      <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Fábio Lopez — ID {FABIO_LOPEZ_ID}. Quando selecionado, será a última
        assinatura à direita, com Rafaella Pitol Corrêa imediatamente antes.
      </p>
    </div>
  </div>
</section>

        <div className="flex justify-end">
          <Botao type="submit" variant="mensal" disabled={salvando}>
            <span className="inline-flex items-center gap-2">
              {salvando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              {salvando ? "Cadastrando..." : "Cadastrar certificado"}
            </span>
          </Botao>
        </div>
      </form>
    </section>
  );
}

function CertificadoAvulsoCard({
  item,
  onGerarPdf,
  onEnviarEmail,
  acaoLoading,
  usarAssinaturaAdicional,
  assinaturaAdicionalId,
  usarAssinaturaSecretario,
}) {
  const isEmailLoading = acaoLoading.id === item.id && acaoLoading.tipo === "email";
  const isPdfLoading = acaoLoading.id === item.id && acaoLoading.tipo === "pdf";
  const mod = item?.modalidade || "participante";
  const status = item?.status || "emitido";
  const podeGerar = certificadoPodeGerarPdf(item);
  const pdfConsolidado = certificadoPdfConsolidado(item);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:shadow-md dark:bg-zinc-900 dark:ring-zinc-800"
      aria-label={`Certificado de ${item?.nome || "participante"}`}
      aria-busy={isEmailLoading || isPdfLoading ? "true" : "false"}
    >
      <div className="h-1.5 bg-gradient-to-r from-amber-700 via-orange-500 to-rose-600" />

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-rose-50 p-2 ring-1 ring-rose-100 dark:bg-rose-950/30 dark:ring-rose-800/60">
              <UserSquare2
                className="h-7 w-7 text-rose-700 dark:text-rose-200"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <h3 className="break-words text-base font-black leading-5 text-slate-950 dark:text-white">
                {item?.nome || "Sem nome"}
              </h3>

              <p className="mt-2 break-words text-sm font-semibold text-slate-700 dark:text-zinc-200">
                {item?.curso || "Curso não informado"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={item?.enviado ? "emerald" : "amber"}>
                  {item?.enviado ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {item?.enviado ? "Enviado" : "Pendente de envio"}
                </Badge>

                <Badge tone={statusTone(status)}>
                  {statusLabel(status)}
                </Badge>

                <Badge tone={pdfConsolidado ? "emerald" : "cyan"}>
                  {pdfConsolidado ? "PDF consolidado" : "PDF pendente"}
                </Badge>

                <Badge tone="cyan">{ROTULO_MODALIDADE[mod] || mod}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
          <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-800/60">
            <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
              Certificado nº
            </p>
            <p className="mt-1 break-all font-black text-emerald-900 dark:text-emerald-100">
              {getNumeroCertificadoLabel(item)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              E-mail
            </p>
            <p className="mt-1 break-all font-semibold text-slate-800 dark:text-zinc-100">
              {item?.email || "—"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Identificador
              </p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-zinc-100">
                {getIdentificadorLabel(item)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Carga
              </p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-zinc-100">
                {formatarCarga(item)}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Período
              </p>
              <p className="mt-1 font-semibold text-slate-800 dark:text-zinc-100">
                {formatarPeriodo(item)}
              </p>
            </div>
          </div>

          {item?.titulo_trabalho ? (
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Título do trabalho / oficina
              </p>
              <p className="mt-1 break-words font-semibold text-slate-800 dark:text-zinc-100">
                {item.titulo_trabalho}
              </p>
            </div>
          ) : null}

          {item?.codigo_validacao ? (
            <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-zinc-950 dark:ring-zinc-800">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Código de validação
              </p>
              <p className="mt-1 break-all font-black text-slate-800 dark:text-zinc-100">
                {item.codigo_validacao}
              </p>
            </div>
          ) : null}

          {!podeGerar ? (
            <div className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 ring-1 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-800/60">
              Este certificado não está disponível para download porque está
              com status {statusLabel(status).toLowerCase()}.
            </div>
          ) : null}

          {pdfConsolidado &&
(usarAssinaturaSecretario ||
  (usarAssinaturaAdicional && assinaturaAdicionalId)) ? (
  <div className="rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60">
    Este PDF já foi consolidado. Alterações nas assinaturas só valem antes da
    primeira consolidação; depois disso, correções exigem substituição formal do
    certificado.
  </div>
) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Botao
            type="button"
            variant="contorno"
            onClick={() => onGerarPdf(item)}
            disabled={isPdfLoading || !podeGerar}
            title={
  pdfConsolidado
    ? "Baixar PDF oficial"
    : usarAssinaturaSecretario ||
        (usarAssinaturaAdicional && assinaturaAdicionalId)
      ? "Consolidar PDF com assinaturas selecionadas"
      : "Consolidar PDF oficial com assinatura institucional"
}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isPdfLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileText className="h-4 w-4" aria-hidden="true" />
              )}
              {isPdfLoading
                ? pdfConsolidado
                  ? "Baixando..."
                  : "Consolidando..."
                : pdfConsolidado
                  ? "Baixar PDF"
                  : "Consolidar PDF"}
            </span>
          </Botao>

          <Botao
            type="button"
            variant="mensal"
            onClick={() => onEnviarEmail(item.id)}
            disabled={isEmailLoading || !podeGerar}
            title={item?.enviado ? "Reenviar e-mail" : "Enviar e-mail"}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {isEmailLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : item?.enviado ? (
                <Mail className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              {isEmailLoading
                ? "Enviando..."
                : item?.enviado
                  ? "Reenviar"
                  : "Enviar"}
            </span>
          </Botao>
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function CertificadoAvulso() {
  const reduceMotion = useReducedMotion();

  const [form, setForm] = useState({
    nome: "",
    identificador: "",
    email: "",
    curso: "",
    carga_horaria: "",
    data_inicio: "",
    data_fim: "",
    modalidade: "participante",
    titulo_trabalho: "",
    texto_personalizado: "",
  });

  const [usarAssinaturaAdicional, setUsarAssinaturaAdicional] = useState(
  () => localStorage.getItem(KEY_ASSINATURA_ADICIONAL_ENABLED) === "1"
);

const [assinaturaAdicionalId, setAssinaturaAdicionalId] = useState(
  () => localStorage.getItem(KEY_ASSINATURA_ADICIONAL_ID) || ""
);

const [usarAssinaturaSecretario, setUsarAssinaturaSecretario] = useState(
  () => localStorage.getItem(KEY_ASSINATURA_SECRETARIO_ENABLED) === "1"
);
  const [assinaturas, setAssinaturas] = useState([]);
  const [assinaturasCarregando, setAssinaturasCarregando] = useState(true);

  const [lista, setLista] = useState([]);
  const [pagina, setPagina] = useState(1);
const [paginacao, setPaginacao] = useState({
  pagina: 1,
  limite: 25,
  total: 0,
  total_paginas: 1,
  tem_anterior: false,
  tem_proxima: false,
});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [filtroEnvio, setFiltroEnvio] = useState(
    () => localStorage.getItem(KEY_FILTRO_ENVIO) || "todos"
  );
  const [filtroStatus, setFiltroStatus] = useState(
    () => localStorage.getItem(KEY_FILTRO_STATUS) || "todos"
  );
  const [busca, setBusca] = useState(() => localStorage.getItem(KEY_BUSCA) || "");
  const [buscaDebounced, setBuscaDebounced] = useState(busca);

  const [acaoLoading, setAcaoLoading] = useState({ id: null, tipo: null });

  const liveRef = useRef(null);
  const buscaRef = useRef(null);
  const formRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

const carregarCertificados = useCallback(
  async (paginaAlvo = pagina) => {
    try {
      validarFacade(
        "api.certificadoAvulso.listar",
        api?.certificadoAvulso?.listar
      );

      setCarregando(true);
      setErro("");
      setLive("Carregando certificados avulsos.");

      const response = await api.certificadoAvulso.listar({
        pagina: paginaAlvo,
        limite: 25,
      });

      const payload = extrairData(response);

      const arr = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.lista)
          ? payload.lista
          : [];

      const meta = payload?.paginacao || {
        pagina: paginaAlvo,
        limite: 25,
        total: arr.length,
        total_paginas: 1,
        tem_anterior: false,
        tem_proxima: false,
      };

      if (!mountedRef.current) return;

      setLista(arr);
      setPaginacao(meta);

      setLive(
        arr.length
          ? `${arr.length} certificado(s) avulso(s) carregado(s) na página ${meta.pagina}.`
          : "Nenhum certificado avulso encontrado."
      );
    } catch (error) {
      console.error("[CertificadoAvulso] erro ao carregar:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Não foi possível carregar certificados avulsos."
      );

      setErro(message);
      setLista([]);
      notifyError(message);
      setLive("Erro ao carregar certificados avulsos.");
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  },
  [pagina, setLive]
);

  const carregarAssinaturas = useCallback(async () => {
    try {
      validarFacade("api.assinatura.listar", api?.assinatura?.listar);

      setAssinaturasCarregando(true);

      const response = await api.assinatura.listar();
      const payload = extrairData(response);

      const arr = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.lista)
          ? payload.lista
          : [];

      const filtradas = arr
        .filter((assinatura) => {
          return Boolean(
            assinatura?.tem_assinatura ??
              assinatura?.possui_assinatura ??
              assinatura?.imagem_base64 ??
              assinatura?.assinatura ??
              assinatura?.arquivo_assinatura
          );
        })
        .map((assinatura) => ({
          id: assinatura.id ?? assinatura.usuario_id ?? assinatura.pessoa_id,
          nome: assinatura.nome || assinatura.titulo || "—",
        }))
        .filter((assinatura) => assinatura.id && assinatura.nome);

      if (!mountedRef.current) return;

      setAssinaturas(filtradas);
    } catch (error) {
      console.error("[CertificadoAvulso] erro ao carregar assinaturas:", error);

      if (!mountedRef.current) return;

      setAssinaturas([]);
    } finally {
      if (mountedRef.current) setAssinaturasCarregando(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Certificados Avulsos | Escola da Saúde";

    carregarCertificados();
    carregarAssinaturas();

    return () => {
      mountedRef.current = false;
    };
  }, [carregarCertificados, carregarAssinaturas]);

  useEffect(() => {
    localStorage.setItem(KEY_FILTRO_ENVIO, filtroEnvio);
  }, [filtroEnvio]);

  useEffect(() => {
    localStorage.setItem(KEY_FILTRO_STATUS, filtroStatus);
  }, [filtroStatus]);

  useEffect(() => {
    localStorage.setItem(KEY_BUSCA, busca);

    const timer = window.setTimeout(() => {
      setBuscaDebounced(normalizarBusca(busca));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [busca]);

 useEffect(() => {
  localStorage.setItem(
    KEY_ASSINATURA_ADICIONAL_ENABLED,
    usarAssinaturaAdicional ? "1" : "0"
  );
}, [usarAssinaturaAdicional]);

useEffect(() => {
  if (assinaturaAdicionalId) {
    localStorage.setItem(KEY_ASSINATURA_ADICIONAL_ID, assinaturaAdicionalId);
  } else {
    localStorage.removeItem(KEY_ASSINATURA_ADICIONAL_ID);
  }
}, [assinaturaAdicionalId]);

useEffect(() => {
  localStorage.setItem(
    KEY_ASSINATURA_SECRETARIO_ENABLED,
    usarAssinaturaSecretario ? "1" : "0"
  );
}, [usarAssinaturaSecretario]);

  useEffect(() => {
    const onKey = (event) => {
      const key = event.key;
      const mac = /(Mac|iPhone|iPad)/i.test(navigator.userAgent);
      const typing = ["input", "textarea", "select"].includes(
        document.activeElement?.tagName?.toLowerCase()
      );

      if (typing) return;

      const isSubmit =
        (mac && event.metaKey && key === "Enter") ||
        (!mac && event.ctrlKey && key === "Enter");

      if (isSubmit) {
        event.preventDefault();
        formRef.current?.requestSubmit?.();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

const assinaturaAdicionalNome = useMemo(() => {
  const achada = assinaturas.find(
    (assinatura) => String(assinatura.id) === String(assinaturaAdicionalId)
  );

  return achada?.nome || "";
}, [assinaturas, assinaturaAdicionalId]);

  const kpis = useMemo(() => {
    const total = lista.length;
    const enviados = lista.filter((item) => item?.enviado === true).length;
    const pendentes = lista.filter((item) => item?.enviado !== true).length;
    const validos = lista.filter((item) =>
      STATUS_VALIDOS_DOWNLOAD.includes(item?.status || "emitido")
    ).length;

    return {
      total,
      enviados,
      pendentes,
      validos,
    };
  }, [lista]);

  const listaFiltrada = useMemo(() => {
    return lista
      .filter((item) => {
        if (filtroEnvio === "enviados" && item?.enviado !== true) return false;
        if (filtroEnvio === "nao_enviados" && item?.enviado === true) return false;

        if (filtroStatus !== "todos" && (item?.status || "emitido") !== filtroStatus) {
          return false;
        }

        if (!buscaDebounced) return true;

        const texto = normalizarBusca(
  [
    item?.nome,
    item?.email,
    item?.curso,
    item?.modalidade,
    ROTULO_MODALIDADE[item?.modalidade],
    item?.titulo_trabalho,
    item?.numero_certificado,
    item?.codigo_validacao,
    item?.identificador_mascarado,
  ].join(" ")
);

        return texto.includes(buscaDebounced);
      })
      .sort((a, b) => {
        const da = String(a?.emitido_em || a?.id || "");
        const db = String(b?.emitido_em || b?.id || "");

        return db.localeCompare(da);
      });
  }, [lista, filtroEnvio, filtroStatus, buscaDebounced]);

  const limparFiltros = useCallback(() => {
    setBusca("");
    setFiltroEnvio("todos");
    setFiltroStatus("todos");
  }, []);

  const cadastrarCertificado = useCallback(
    async (event) => {
      event.preventDefault();

      if (salvando) return;

      const modalidade = form.modalidade || "participante";
      const exigeTitulo = modalidadeExigeTitulo(modalidade);
      const semCarga = modalidadeSemCarga(modalidade);

      const payload = {
        nome: safeText(form.nome, 180),
        cpf: safeText(form.identificador, 80),
        email: safeText(form.email, 160).toLowerCase(),
        curso: safeText(form.curso, 300),
        carga_horaria: semCarga
          ? null
          : form.carga_horaria
            ? Number(form.carga_horaria)
            : null,
        data_inicio: form.data_inicio || null,
        data_fim: form.data_fim || form.data_inicio || null,
        modalidade,
        titulo_trabalho: exigeTitulo ? safeText(form.titulo_trabalho, 500) : null,
        texto_personalizado: safeText(form.texto_personalizado, 5000),
      };

      if (!payload.nome || !payload.cpf || !payload.email || !payload.curso) {
        notifyWarning("Preencha nome, identificador, e-mail e curso.");
        setLive("Campos obrigatórios ausentes.");
        return;
      }

      if (!validarEmail(payload.email)) {
        notifyWarning("Informe um e-mail válido.");
        setLive("E-mail inválido.");
        return;
      }

      if (!MODALIDADES.includes(payload.modalidade)) {
        notifyWarning("Modalidade inválida.");
        setLive("Modalidade inválida.");
        return;
      }

      if (!semCarga && payload.carga_horaria !== null) {
        if (!Number.isFinite(payload.carga_horaria) || payload.carga_horaria <= 0) {
          notifyWarning("Informe uma carga horária válida ou deixe em branco.");
          setLive("Carga horária inválida.");
          return;
        }
      }

      if (exigeTitulo && !payload.titulo_trabalho) {
        notifyWarning("Informe o título do trabalho/oficina.");
        setLive("Título obrigatório ausente.");
        return;
      }

      if (payload.data_inicio && !isYmd(payload.data_inicio)) {
        notifyWarning("Data de início inválida.");
        setLive("Data de início inválida.");
        return;
      }

      if (payload.data_fim && !isYmd(payload.data_fim)) {
        notifyWarning("Data de término inválida.");
        setLive("Data de término inválida.");
        return;
      }

      if (payload.data_inicio && payload.data_fim && payload.data_fim < payload.data_inicio) {
        notifyWarning("A data de término não pode ser anterior à data de início.");
        setLive("Período inválido.");
        return;
      }

      try {
        validarFacade("api.certificadoAvulso.criar", api?.certificadoAvulso?.criar);

        setSalvando(true);
        setLive("Cadastrando certificado avulso.");

await api.certificadoAvulso.criar(payload);

      setPagina(1);
await carregarCertificados(1);
        setFiltroEnvio("todos");
        setFiltroStatus("todos");
        setBusca("");

        setForm({
          nome: "",
          identificador: "",
          email: "",
          curso: "",
          carga_horaria: "",
          data_inicio: "",
          data_fim: "",
          modalidade: "participante",
          titulo_trabalho: "",
          texto_personalizado: "",
        });

        notifySuccess("Certificado avulso cadastrado com sucesso.");
        setLive("Certificado avulso cadastrado.");
      } catch (error) {
        console.error("[CertificadoAvulso] erro ao cadastrar:", error);

        notifyError(
          obterMensagemErro(error, "Não foi possível cadastrar o certificado.")
        );
        setLive("Erro ao cadastrar certificado avulso.");
      } finally {
        setSalvando(false);
      }
    },
    [form, salvando, setLive, carregarCertificados]
  );

const getAssinaturaParams = useCallback(() => {
  const assinantes = [];

  if (usarAssinaturaAdicional) {
    if (!assinaturaAdicionalId) {
      notifyInfo("Selecione a assinatura complementar antes de continuar.");
      return false;
    }

    const adicionalId = Number(assinaturaAdicionalId);

    if (
      !Number.isInteger(adicionalId) ||
      adicionalId <= 0 ||
      adicionalId === RAFAELLA_PITOL_ID ||
      adicionalId === FABIO_LOPEZ_ID
    ) {
      notifyWarning("Selecione uma assinatura complementar válida.");
      return false;
    }

    assinantes.push(adicionalId);
  }

  if (usarAssinaturaSecretario) {
    assinantes.push(FABIO_LOPEZ_ID);
  }

  return {
    assinantes_ids: assinantes.join(","),
  };
}, [
  usarAssinaturaAdicional,
  assinaturaAdicionalId,
  usarAssinaturaSecretario,
]);

  const gerarPdf = useCallback(
  async (item) => {
    if (acaoLoading.id) return;

    const id = Number(item?.id);

    if (!Number.isInteger(id) || id <= 0) {
      notifyWarning("Certificado inválido para PDF.");
      return;
    }

    const pdfConsolidado = certificadoPdfConsolidado(item);
    const params = getAssinaturaParams();

    if (params === false) return;

    try {
      validarFacade("api.certificadoAvulso.pdf", api?.certificadoAvulso?.pdf);

      setAcaoLoading({ id, tipo: "pdf" });
      setLive(
        pdfConsolidado
          ? "Baixando PDF do certificado avulso."
          : "Consolidando PDF do certificado avulso."
      );

      const result = await api.certificadoAvulso.pdf(id, params);
      const blob = result?.blob || result?.data || result;

      const filename =
        result?.filename ||
        `${nomeArquivoSeguro(item?.numero_certificado || `certificado_avulso_${id}`)}.pdf`;

      downloadBlob(filename, blob);

      notifySuccess(
        pdfConsolidado
          ? "Download iniciado."
          : "PDF consolidado e download iniciado."
      );

      setLive(
        pdfConsolidado
          ? "Download do PDF iniciado."
          : "PDF consolidado e download iniciado."
      );

      await carregarCertificados();
    } catch (error) {
      console.error("[CertificadoAvulso] erro ao consolidar/baixar PDF:", error);

      notifyError(
        obterMensagemErro(
          error,
          pdfConsolidado
            ? "Não foi possível baixar o PDF."
            : "Não foi possível consolidar o PDF."
        )
      );

      setLive("Erro ao consolidar ou baixar PDF.");
    } finally {
      setAcaoLoading({ id: null, tipo: null });
    }
  },
  [acaoLoading.id, getAssinaturaParams, carregarCertificados, setLive]
);

  const enviarPorEmail = useCallback(
    async (id) => {
      if (acaoLoading.id) return;

      const params = getAssinaturaParams();

      if (params === false) return;

      try {
        validarFacade(
          "api.certificadoAvulso.enviar",
          api?.certificadoAvulso?.enviar
        );

        setAcaoLoading({ id, tipo: "email" });
        setLive("Enviando certificado avulso por e-mail.");

        const response = await api.certificadoAvulso.enviar(id, params);
        const atualizado = extrairData(response);

        setLista((prev) =>
          prev.map((item) =>
            Number(item.id) === Number(id)
              ? {
                  ...item,
                  ...atualizado,
                  enviado: true,
                  status: atualizado?.status || "enviado",
                }
              : item
          )
        );

        notifySuccess("E-mail enviado com sucesso.");
        setLive("Certificado avulso enviado por e-mail.");
      } catch (error) {
        console.error("[CertificadoAvulso] erro ao enviar e-mail:", error);

        notifyError(
          obterMensagemErro(error, "Não foi possível enviar o certificado por e-mail.")
        );
        setLive("Erro ao enviar e-mail.");
      } finally {
        setAcaoLoading({ id: null, tipo: null });
      }
    },
    [acaoLoading.id, getAssinaturaParams, setLive]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
  <HeaderHero
    titulo="Certificados avulsos"
    subtitulo="Cadastre certificados fora do fluxo automático, consolide o PDF eletrônico oficial e envie por e-mail quando necessário."
    icone={Award}
    tamanho="md"
    raio="xl"
  />
</div>

<section className="mx-auto w-full max-w-7xl space-y-4 px-4 pt-6 sm:px-6">
  <BarraAcoesPagina
    carregando={carregando}
    onRefresh={carregarCertificados}
    onCadastrar={() => formRef.current?.requestSubmit?.()}
    onFocusBusca={() => buscaRef.current?.focus()}
  />

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
    <MiniStat icon={Award} label="Total" value={paginacao.total} tone="cyan" />
    <MiniStat icon={Mail} label="Enviados" value={kpis.enviados} tone="emerald" />
    <MiniStat icon={Send} label="Pendentes" value={kpis.pendentes} tone="amber" />
    <MiniStat icon={ShieldCheck} label="Válidos" value={kpis.validos} tone="rose" />
  </div>

  <AvisoIdentificadorSeguro />
</section>

      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {carregando ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-amber-100 dark:bg-amber-950"
          role="progressbar"
          aria-label="Carregando certificados avulsos"
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
        className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[430px_minmax(0,1fr)]"
      >
        <div>
          <FormularioCertificado
  form={form}
  setForm={setForm}
  salvando={salvando}
  onSubmit={cadastrarCertificado}
  formRef={formRef}
  usarAssinaturaAdicional={usarAssinaturaAdicional}
  setUsarAssinaturaAdicional={setUsarAssinaturaAdicional}
  assinaturaAdicionalId={assinaturaAdicionalId}
  setAssinaturaAdicionalId={setAssinaturaAdicionalId}
  usarAssinaturaSecretario={usarAssinaturaSecretario}
  setUsarAssinaturaSecretario={setUsarAssinaturaSecretario}
  assinaturas={assinaturas}
  assinaturasCarregando={assinaturasCarregando}
  assinaturaAdicionalNome={assinaturaAdicionalNome}
/>
        </div>

        <section className="flex min-w-0 flex-col gap-4">
          <Toolbar
            busca={busca}
            setBusca={setBusca}
            filtroEnvio={filtroEnvio}
            setFiltroEnvio={setFiltroEnvio}
            filtroStatus={filtroStatus}
            setFiltroStatus={setFiltroStatus}
            buscaRef={buscaRef}
            onLimpar={limparFiltros}
          />

          {carregando ? (
            <section className="grid gap-4" aria-label="Carregando certificados">
              <CarregandoSkeleton height={180} />
              <CarregandoSkeleton height={180} />
              <CarregandoSkeleton height={180} />
            </section>
          ) : erro ? (
            <ErroCarregamento mensagem={erro} onRetry={carregarCertificados} />
          ) : lista.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhum certificado avulso cadastrado"
              descricao="Cadastre o primeiro certificado no formulário ao lado."
            />
          ) : listaFiltrada.length === 0 ? (
            <NadaEncontrado
              titulo="Nenhum resultado encontrado"
              descricao="Altere os filtros ou limpe a busca para visualizar mais certificados."
            />
          ) : (
            <section aria-labelledby="titulo-lista-certificados-avulsos">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    id="titulo-lista-certificados-avulsos"
                    className="text-lg font-black text-slate-950 dark:text-white"
                  >
                    Certificados cadastrados
                  </h2>

                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    Exibindo {listaFiltrada.length} de {paginacao.total} registro(s).
                  </p>
                </div>

                <Badge tone="amber">
                  <Sparkles className="h-3.5 w-3.5" />
                  Certificado eletrônico v2.0
                </Badge>
              </div>
<div className="grid grid-cols-1 gap-4">
  {listaFiltrada.map((item) => (
    <CertificadoAvulsoCard
      key={item.id}
      item={item}
      onGerarPdf={gerarPdf}
      onEnviarEmail={enviarPorEmail}
      acaoLoading={acaoLoading}
      usarAssinaturaAdicional={usarAssinaturaAdicional}
      assinaturaAdicionalId={assinaturaAdicionalId}
      usarAssinaturaSecretario={usarAssinaturaSecretario}
    />
  ))}
</div>

<div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800 sm:flex-row sm:items-center sm:justify-between">
  <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
    Página {paginacao.pagina} de {paginacao.total_paginas} —{" "}
    {paginacao.total} certificado(s)
  </p>

  <div className="flex items-center gap-2">
    <Botao
      type="button"
      variant="contorno"
      disabled={!paginacao.tem_anterior || carregando}
      onClick={() => setPagina((prev) => Math.max(prev - 1, 1))}
    >
      Anterior
    </Botao>

    <Botao
      type="button"
      variant="contorno"
      disabled={!paginacao.tem_proxima || carregando}
      onClick={() => setPagina((prev) => prev + 1)}
    >
      Próxima
    </Botao>
  </div>
</div>

            </section>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}