// ✅ frontend/src/pages/Gestaoorganizador.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  GraduationCap,
  History,
  Loader2,
  Mail,
  PenLine,
  RefreshCcw,
  Search,
  ShieldCheck,
  SortAsc,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import Modal from "../components/ui/Modal";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess } from "../components/ui/AppToast";
import { api } from "../services/api";
import { formatDateBr, extractYmd } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.organizador.listar()
 * api.organizador.eventosAvaliacao(organizador_id)
 *
 * Rotas backend oficiais:
 * GET /api/organizador
 * GET /api/organizador/:id/eventos-avaliacao
 *
 * Diretrizes v2.0:
 * - Sem apiGet direto.
 * - Sem react-toastify direto.
 * - Sem react-modal.
 * - Sem react-loading-skeleton direto.
 * - Sem import antigo de Footer.
 * - Sem Tabelaorganizador em caminho incerto.
 * - Sem aliases de assinatura.
 * - Sem payload legado.
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

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function nomeArquivoSeguro(value) {
  const nome = String(value || "organizadores")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 120);

  return nome || "organizadores";
}

function hojeYMD() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dataBR(value) {
  const iso = extractYmd(value);

  return iso ? formatDateBr(iso) : "—";
}

function periodoEvento(item) {
  const inicio = item?.data_inicio;
  const fim = item?.data_fim || inicio;

  if (!inicio && !fim) return "Período não informado";

  return `${dataBR(inicio)} até ${dataBR(fim)}`;
}

function csvEscape(value) {
  const text = String(value ?? "");

  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, linhas) {
  const bom = "\uFEFF";
  const content = bom + linhas.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function getorganizadorId(organizador) {
  return toPositiveInt(organizador?.id || organizador?.organizador_id);
}

function getNomeorganizador(organizador) {
  return safeText(organizador?.nome || organizador?.usuario_nome || organizador?.nome_organizador);
}

function getEmailorganizador(organizador) {
  return safeText(organizador?.email || organizador?.email_organizador);
}

function possuiAssinaturaOficial(organizador) {
  return Boolean(organizador?.possui_assinatura || organizador?.possuiAssinatura);
}

function getEventosMinistrados(organizador) {
  return toSafeNumber(
    organizador?.eventos_ministrados ?? organizador?.eventosMinistrados
  );
}

function getTurmasVinculadas(organizador) {
  return toSafeNumber(
    organizador?.turmas_vinculadas ?? organizador?.turmasVinculadas
  );
}

function getTotalRespostas(organizador) {
  return toSafeNumber(organizador?.total_respostas ?? organizador?.totalRespostas);
}

function getMediaAvaliacao(organizador) {
  const value = organizador?.media_avaliacao ?? organizador?.mediaAvaliacao;

  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function formatarMedia(value) {
  if (value === null || value === undefined) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toFixed(1).replace(".", ",");
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

function MiniStat({ icon: Icon, label, value, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-400/15 text-violet-50 ring-violet-300/20",
    emerald: "bg-emerald-400/15 text-emerald-50 ring-emerald-300/20",
    amber: "bg-amber-400/15 text-amber-50 ring-amber-300/20",
    cyan: "bg-cyan-400/15 text-cyan-50 ring-cyan-300/20",
  };

  return (
    <div className={cx("rounded-3xl p-4 ring-1 backdrop-blur", tones[tone])}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-wide opacity-80">
            {label}
          </p>
          <p className="text-2xl font-black leading-none">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Hero({ kpis, carregando, busca, setBusca, onRefresh }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag);

      if (typing) return;

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-800 text-white">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-400 blur-3xl" />
        <div className="absolute right-0 top-8 h-72 w-72 rounded-full bg-fuchsia-500 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500 blur-3xl" />
      </div>

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-950"
      >
        Ir para o conteúdo
      </a>

      <div className="relative mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20 backdrop-blur">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Gestão administrativa
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Gestão de organizadores
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-white/85 sm:text-base">
              Pesquise organizadores, acompanhe vínculos com turmas, assinatura
              cadastrada, histórico de eventos e médias de avaliação.
            </p>
          </div>

          <div className="flex shrink-0">
            <Botao
              type="button"
              variant="secondary"
              onClick={onRefresh}
              disabled={carregando}
              className="bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw
                  className={cx("h-4 w-4", carregando && "animate-spin")}
                  aria-hidden="true"
                />
                {carregando ? "Atualizando..." : "Atualizar"}
              </span>
            </Botao>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat icon={UsersRound} label="Total" value={kpis.total} tone="violet" />
          <MiniStat
            icon={Search}
            label="Encontrados"
            value={kpis.encontrados}
            tone="cyan"
          />
          <MiniStat
            icon={PenLine}
            label="Com assinatura"
            value={kpis.comAssinatura}
            tone="emerald"
          />
          <MiniStat
            icon={AlertTriangle}
            label="Sem assinatura"
            value={kpis.semAssinatura}
            tone="amber"
          />
        </div>

        <div className="mt-5 rounded-3xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />

              <input
                ref={inputRef}
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome ou e-mail... (/)"
                className="w-full rounded-2xl border border-white/20 bg-white px-10 py-2.5 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-500 focus:ring-4 focus:ring-white/25"
                aria-label="Buscar organizador por nome ou e-mail"
              />

              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Limpar busca"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Toolbar({
  ordenarPor,
  setOrdenarPor,
  busca,
  setBusca,
  total,
  loading,
  onExportCsv,
  onRefresh,
}) {
  return (
    <section
      aria-label="Ferramentas da lista de organizadores"
      className="rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SortAsc className="h-4 w-4 text-slate-500" aria-hidden="true" />

          <label
            htmlFor="ordenar-organizadores"
            className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400"
          >
            Ordenar
          </label>

          <select
            id="ordenar-organizadores"
            value={ordenarPor}
            onChange={(event) => setOrdenarPor(event.target.value)}
            className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-violet-950"
          >
            <option value="nome_asc">Nome A-Z</option>
            <option value="nome_desc">Nome Z-A</option>
            <option value="email_asc">E-mail A-Z</option>
            <option value="avaliacao_desc">Melhor avaliação</option>
            <option value="turmas_desc">Mais turmas</option>
          </select>

          {busca ? (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-700"
            >
              Limpar busca
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Botao
            type="button"
            variant="secondary"
            onClick={onRefresh}
            disabled={loading}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCcw
                className={cx("h-4 w-4", loading && "animate-spin")}
                aria-hidden="true"
              />
              Recarregar
            </span>
          </Botao>

          <Botao
            type="button"
            variant="primary"
            onClick={onExportCsv}
            disabled={loading || total <= 0}
          >
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" aria-hidden="true" />
              Exportar CSV
            </span>
          </Botao>

          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {total} item(ns)
          </span>
        </div>
      </div>
    </section>
  );
}

function organizadorCard({ organizador, onVisualizar, reduceMotion }) {
  const id = getorganizadorId(organizador);
  const nome = getNomeorganizador(organizador);
  const email = getEmailorganizador(organizador);
  const eventos = getEventosMinistrados(organizador);
  const turmas = getTurmasVinculadas(organizador);
  const respostas = getTotalRespostas(organizador);
  const media = getMediaAvaliacao(organizador);
  const assinatura = possuiAssinaturaOficial(organizador);

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      <div className="h-1.5 bg-gradient-to-r from-violet-700 via-fuchsia-600 to-cyan-500" />

      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-black text-slate-950 dark:text-white">
              {nome}
            </h2>

            <p className="mt-1 inline-flex items-center gap-1 break-all text-sm font-semibold text-slate-600 dark:text-zinc-300">
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              {email}
            </p>
          </div>

          <Badge tone={assinatura ? "emerald" : "amber"}>
            {assinatura ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            {assinatura ? "Com assinatura" : "Sem assinatura"}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Eventos
            </p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {eventos}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Turmas
            </p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {turmas}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Respostas
            </p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {respostas}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Média
            </p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {formatarMedia(media)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Botao
            type="button"
            variant="primary"
            onClick={() => onVisualizar(organizador)}
            disabled={!id}
          >
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4" aria-hidden="true" />
              Ver histórico
            </span>
          </Botao>
        </div>
      </div>
    </motion.article>
  );
}

function Tabelaorganizadores({ organizadores, onVisualizar }) {
  return (
    <div className="hidden overflow-hidden rounded-[1.5rem] bg-white shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800 lg:block">
      <table className="min-w-full text-left text-sm" aria-label="Tabela de organizadores">
        <thead className="bg-slate-950 text-white">
          <tr>
            <th className="px-4 py-3 font-black">organizador</th>
            <th className="px-4 py-3 font-black">Assinatura</th>
            <th className="px-4 py-3 font-black">Eventos</th>
            <th className="px-4 py-3 font-black">Turmas</th>
            <th className="px-4 py-3 font-black">Respostas</th>
            <th className="px-4 py-3 font-black">Média</th>
            <th className="px-4 py-3 text-right font-black">Ações</th>
          </tr>
        </thead>

        <tbody>
          {organizadores.map((organizador) => {
            const id = getorganizadorId(organizador);
            const assinatura = possuiAssinaturaOficial(organizador);
            const media = getMediaAvaliacao(organizador);

            return (
              <tr
                key={id || `${getNomeorganizador(organizador)}-${getEmailorganizador(organizador)}`}
                className="border-t border-slate-200 transition hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-950"
              >
                <td className="px-4 py-3">
                  <p className="font-black text-slate-950 dark:text-white">
                    {getNomeorganizador(organizador)}
                  </p>
                  <p className="mt-0.5 break-all text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {getEmailorganizador(organizador)}
                  </p>
                </td>

                <td className="px-4 py-3">
                  <Badge tone={assinatura ? "emerald" : "amber"}>
                    {assinatura ? "Com assinatura" : "Sem assinatura"}
                  </Badge>
                </td>

                <td className="px-4 py-3 font-bold text-slate-700 dark:text-zinc-200">
                  {getEventosMinistrados(organizador)}
                </td>

                <td className="px-4 py-3 font-bold text-slate-700 dark:text-zinc-200">
                  {getTurmasVinculadas(organizador)}
                </td>

                <td className="px-4 py-3 font-bold text-slate-700 dark:text-zinc-200">
                  {getTotalRespostas(organizador)}
                </td>

                <td className="px-4 py-3 font-bold text-slate-700 dark:text-zinc-200">
                  {formatarMedia(media)}
                </td>

                <td className="px-4 py-3 text-right">
                  <Botao
                    type="button"
                    variant="secondary"
                    onClick={() => onVisualizar(organizador)}
                    disabled={!id}
                  >
                    <span className="inline-flex items-center gap-2">
                      <History className="h-4 w-4" aria-hidden="true" />
                      Histórico
                    </span>
                  </Botao>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoricoModal({
  open,
  organizador,
  historico,
  loading,
  onClose,
  onRecarregar,
}) {
  const titleId = "modal-historico-organizador-title";
  const descId = "modal-historico-organizador-desc";

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-3xl overflow-hidden p-0"
    >
      <header className="bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-800 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20">
              <History className="h-4 w-4" aria-hidden="true" />
              Histórico do organizador
            </div>

            <h2 id={titleId} className="mt-3 text-xl font-black tracking-tight">
              {getNomeorganizador(organizador)}
            </h2>

            <p id={descId} className="mt-1 break-all text-sm text-white/80">
              {getEmailorganizador(organizador)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 ring-1 ring-white/15 transition hover:bg-white/15"
            aria-label="Fechar histórico do organizador"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="max-h-[66dvh] overflow-y-auto bg-slate-50 p-4 dark:bg-zinc-950">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <CarregandoSkeleton height={96} />
            <CarregandoSkeleton height={96} />
            <CarregandoSkeleton height={96} />
          </div>
        ) : historico.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum evento encontrado"
            descricao="Se você esperava ver eventos aqui, confira os vínculos do organizador."
          />
        ) : (
          <ul className="space-y-3">
            {historico.map((evento) => (
              <li
                key={evento.id}
                className="rounded-3xl bg-white p-4 ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-base font-black text-slate-950 dark:text-white">
                      {evento.titulo}
                    </p>

                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-zinc-400">
                      <CalendarDays className="h-4 w-4" aria-hidden="true" />
                      {periodoEvento(evento)}
                    </p>
                  </div>

                  <Badge tone={evento.nota_media != null ? "amber" : "slate"}>
                    Média: {formatarMedia(evento.nota_media)}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Respostas
                    </p>
                    <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                      {evento.total_respostas}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                      Nota média
                    </p>
                    <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                      {formatarMedia(evento.nota_media)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex flex-col gap-2 border-t border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:flex-row sm:justify-end">
        <Botao
          type="button"
          variant="secondary"
          onClick={onRecarregar}
          disabled={loading || !getorganizadorId(organizador)}
        >
          <span className="inline-flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            )}
            Recarregar
          </span>
        </Botao>

        <Botao type="button" variant="primary" onClick={onClose}>
          Fechar
        </Botao>
      </footer>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function Gestaoorganizador() {
  const reduceMotion = useReducedMotion();

  const [organizadores, setorganizadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [ordenarPor, setOrdenarPor] = useState("nome_asc");

  const [modalOpen, setModalOpen] = useState(false);
  const [organizadorSelecionado, setorganizadorSelecionado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const carregarorganizadores = useCallback(async () => {
    try {
      validarFacade("api.organizador.listar", api?.organizador?.listar);

      setLoading(true);
      setErro("");
      setLive("Carregando organizadores.");

      const response = await api.organizador.listar();
      const data = extrairData(response);
      const lista = Array.isArray(data) ? data : [];

      if (!mountedRef.current) return;

      setorganizadores(lista);
      setLive(`${lista.length} organizador(es) carregado(s).`);
    } catch (error) {
      console.error("[Gestaoorganizador] erro ao carregar organizadores:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Não foi possível carregar organizadores."
      );

      setErro(message);
      setorganizadores([]);
      notifyError(message);
      setLive("Erro ao carregar organizadores.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [setLive]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Gestão de organizadores | Escola da Saúde";

    carregarorganizadores();

    return () => {
      mountedRef.current = false;
    };
  }, [carregarorganizadores]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(normalizarBusca(busca));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [busca]);

  const organizadoresFiltrados = useMemo(() => {
    const filtrados = organizadores.filter((organizador) => {
      if (!buscaAplicada) return true;

      const texto = normalizarBusca(
        [getNomeorganizador(organizador), getEmailorganizador(organizador)].join(" ")
      );

      return texto.includes(buscaAplicada);
    });

    return filtrados.slice().sort((a, b) => {
      const nomeA = normalizarBusca(getNomeorganizador(a));
      const nomeB = normalizarBusca(getNomeorganizador(b));
      const emailA = normalizarBusca(getEmailorganizador(a));
      const emailB = normalizarBusca(getEmailorganizador(b));
      const mediaA = getMediaAvaliacao(a) ?? -1;
      const mediaB = getMediaAvaliacao(b) ?? -1;
      const turmasA = getTurmasVinculadas(a);
      const turmasB = getTurmasVinculadas(b);

      if (ordenarPor === "nome_desc") return nomeB.localeCompare(nomeA);
      if (ordenarPor === "email_asc") return emailA.localeCompare(emailB);
      if (ordenarPor === "avaliacao_desc") return mediaB - mediaA;
      if (ordenarPor === "turmas_desc") return turmasB - turmasA;

      return nomeA.localeCompare(nomeB);
    });
  }, [organizadores, buscaAplicada, ordenarPor]);

  const kpis = useMemo(() => {
    const total = organizadores.length;
    const encontrados = organizadoresFiltrados.length;
    const comAssinatura = organizadoresFiltrados.filter(possuiAssinaturaOficial).length;

    return {
      total,
      encontrados,
      comAssinatura,
      semAssinatura: Math.max(0, encontrados - comAssinatura),
    };
  }, [organizadores, organizadoresFiltrados]);

  const carregarHistorico = useCallback(
    async (organizador) => {
      const organizadorId = getorganizadorId(organizador);

      if (!organizadorId) {
        notifyError("organizador inválido para consulta de histórico.");
        return;
      }

      try {
        validarFacade(
          "api.organizador.eventosAvaliacao",
          api?.organizador?.eventosAvaliacao
        );

        setLoadingHistorico(true);
        setLive("Carregando histórico do organizador.");

        const response = await api.organizador.eventosAvaliacao(organizadorId);
        const data = extrairData(response);
        const lista = Array.isArray(data) ? data : [];

        const eventos = lista.map((item) => ({
          id:
            item?.evento_id ||
            `${safeText(item?.evento, "evento")}-${safeText(item?.data_inicio, "")}`,
          evento_id: item?.evento_id || null,
          titulo: safeText(item?.evento || item?.titulo, "Evento"),
          data_inicio: item?.data_inicio || "",
          data_fim: item?.data_fim || "",
          nota_media:
            item?.nota_media !== null && item?.nota_media !== undefined
              ? Number(item.nota_media)
              : null,
          total_respostas: toSafeNumber(item?.total_respostas),
        }));

        if (!mountedRef.current) return;

        setHistorico(eventos);
        setLive("Histórico do organizador carregado.");
      } catch (error) {
        console.error("[Gestaoorganizador] erro ao carregar histórico:", error);

        if (!mountedRef.current) return;

        notifyError(
          obterMensagemErro(
            error,
            "Não foi possível carregar o histórico do organizador."
          )
        );

        setHistorico([]);
        setLive("Erro ao carregar histórico do organizador.");
      } finally {
        if (mountedRef.current) setLoadingHistorico(false);
      }
    },
    [setLive]
  );

  const abrirHistorico = useCallback(
    async (organizador) => {
      setorganizadorSelecionado(organizador);
      setHistorico([]);
      setModalOpen(true);
      await carregarHistorico(organizador);
    },
    [carregarHistorico]
  );

  const fecharHistorico = useCallback(() => {
    setModalOpen(false);
    setorganizadorSelecionado(null);
    setHistorico([]);
    setLoadingHistorico(false);
  }, []);

  const exportarCsv = useCallback(() => {
    const headers = [
      "id",
      "nome",
      "email",
      "eventos_ministrados",
      "turmas_vinculadas",
      "total_respostas",
      "media_avaliacao",
      "possui_assinatura",
    ];

    const rows = organizadoresFiltrados.map((organizador) => [
      getorganizadorId(organizador) || "",
      getNomeorganizador(organizador),
      getEmailorganizador(organizador),
      getEventosMinistrados(organizador),
      getTurmasVinculadas(organizador),
      getTotalRespostas(organizador),
      getMediaAvaliacao(organizador) ?? "",
      possuiAssinaturaOficial(organizador) ? "sim" : "nao",
    ]);

    downloadCsv(`organizadores_${hojeYMD()}.csv`, [headers, ...rows]);
    notifySuccess("CSV de organizadores exportado.");
  }, [organizadoresFiltrados]);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <Hero
        kpis={kpis}
        carregando={loading}
        busca={busca}
        setBusca={setBusca}
        onRefresh={carregarorganizadores}
      />

      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {loading ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-violet-100 dark:bg-violet-950"
          role="progressbar"
          aria-label="Carregando organizadores"
        >
          <div
            className={cx(
              "h-full w-1/3 bg-violet-700",
              reduceMotion ? "" : "animate-pulse"
            )}
          />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <Toolbar
          ordenarPor={ordenarPor}
          setOrdenarPor={setOrdenarPor}
          busca={busca}
          setBusca={setBusca}
          total={organizadoresFiltrados.length}
          loading={loading}
          onExportCsv={exportarCsv}
          onRefresh={carregarorganizadores}
        />

        {loading ? (
          <section className="grid gap-4" aria-label="Carregando organizadores">
            <CarregandoSkeleton height={140} />
            <CarregandoSkeleton height={140} />
            <CarregandoSkeleton height={140} />
          </section>
        ) : erro ? (
          <ErroCarregamento mensagem={erro} onRetry={carregarorganizadores} />
        ) : organizadores.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum organizador encontrado"
            descricao="Quando houver usuários com perfil oficial de organizador, eles aparecerão aqui."
          />
        ) : organizadoresFiltrados.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhum resultado encontrado"
            descricao="Altere a busca ou limpe os filtros para visualizar mais organizadores."
          />
        ) : (
          <section aria-labelledby="titulo-lista-organizadores">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="titulo-lista-organizadores"
                  className="text-lg font-black text-slate-950 dark:text-white"
                >
                  organizadores cadastrados
                </h2>

                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  Exibindo {organizadoresFiltrados.length} de {organizadores.length} organizador(es).
                </p>
              </div>

              <Badge tone="violet">
                <Sparkles className="h-3.5 w-3.5" />
                Gestão v2.0
              </Badge>
            </div>

            <Tabelaorganizadores
              organizadores={organizadoresFiltrados}
              onVisualizar={abrirHistorico}
            />

            <div className="grid gap-4 lg:hidden">
              {organizadoresFiltrados.map((organizador) => (
                <organizadorCard
                  key={
                    getorganizadorId(organizador) ||
                    `${getNomeorganizador(organizador)}-${getEmailorganizador(organizador)}`
                  }
                  organizador={organizador}
                  onVisualizar={abrirHistorico}
                  reduceMotion={reduceMotion}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {modalOpen ? (
          <HistoricoModal
            open={modalOpen}
            organizador={organizadorSelecionado}
            historico={historico}
            loading={loadingHistorico}
            onClose={fecharHistorico}
            onRecarregar={() => carregarHistorico(organizadorSelecionado)}
          />
        ) : null}
      </AnimatePresence>

      <Footer />
    </div>
  );
}