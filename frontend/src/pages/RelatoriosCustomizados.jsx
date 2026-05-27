// ✅ frontend/src/pages/RelatoriosCustomizados.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  FileBadge2,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  HeartPulse,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import Botao from "../components/ui/Botao";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import RelatoriosTabela from "../components/relatorios/RelatoriosTabela";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../components/ui/AppToast";
import { api } from "../services/api";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.relatorio.resumoGeral(params?)
 * api.relatorio.eventos(params?)
 * api.relatorio.presencas(params?)
 * api.relatorio.avaliacoes(params?)
 * api.relatorio.organizadores(params?)
 * api.relatorio.certificados(params?)
 * api.relatorio.certificadosPendencias(params?)
 * api.relatorio.usuarios(params?)
 * api.relatorio.salas(params?)
 * api.relatorio.notificacoes(params?)
 * api.relatorio.saudePlataforma(params?)
 * api.relatorio.exportarXlsx(tipo, params?)
 *
 * Rotas backend oficiais:
 * GET /api/relatorio/resumo-geral
 * GET /api/relatorio/eventos
 * GET /api/relatorio/presencas
 * GET /api/relatorio/avaliacoes
 * GET /api/relatorio/organizadores
 * GET /api/relatorio/certificados
 * GET /api/relatorio/certificados/pendencias
 * GET /api/relatorio/usuarios
 * GET /api/relatorio/salas
 * GET /api/relatorio/notificacoes
 * GET /api/relatorio/saude-plataforma
 * GET /api/relatorio/exportar/:tipo.xlsx
 *
 * Diretrizes v2.0:
 * - Sem apiGet/apiPostFile direto.
 * - Sem react-toastify direto.
 * - Sem file-saver.
 * - Sem endpoints antigos relatorios/opcao, relatorios/custom, relatorios/exportar.
 * - Sem aliases de filtro.
 * - Date-only como YYYY-MM-DD.
 */

/* ─────────────────────────────────────────────
 * Configuração dos relatórios oficiais
 * ───────────────────────────────────────────── */

const RELATORIOS = [
  {
    key: "resumo-geral",
    exportKey: null,
    label: "Visão geral",
    description: "Indicadores consolidados da plataforma.",
    icon: BarChart3,
    tone: "violet",
  },
  {
    key: "eventos",
    exportKey: "eventos",
    label: "Eventos",
    description: "Eventos, turmas, vagas, inscritos, presenças, certificados e avaliação.",
    icon: CalendarDays,
    tone: "cyan",
  },
  {
    key: "presencas",
    exportKey: "presencas",
    label: "Presenças",
    description: "Frequência por usuário, turma e evento.",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    key: "avaliacoes",
    exportKey: "avaliacoes",
    label: "Avaliações",
    description: "Médias e respostas das avaliações oficiais.",
    icon: ClipboardList,
    tone: "amber",
  },
  {
    key: "organizadores",
    exportKey: "organizadores",
    label: "organizadores",
    description: "Atuação, avaliações e assinatura dos organizadores.",
    icon: GraduationCap,
    tone: "violet",
  },
  {
    key: "certificados",
    exportKey: "certificados",
    label: "Certificados",
    description: "Relatório documental de certificados regulares e avulsos.",
    icon: FileBadge2,
    tone: "emerald",
  },
  {
    key: "certificados-pendencias",
    exportKey: null,
    label: "Pendências de certificado",
    description: "Diagnóstico de bloqueios e pendências de emissão/envio.",
    icon: AlertTriangle,
    tone: "rose",
  },
  {
    key: "usuarios",
    exportKey: "usuarios",
    label: "Usuários",
    description: "Completude cadastral e institucional dos usuários.",
    icon: UsersRound,
    tone: "cyan",
  },
  {
    key: "salas",
    exportKey: null,
    label: "Salas",
    description: "Reservas, confirmação e uso das salas.",
    icon: Activity,
    tone: "amber",
  },
  {
    key: "notificacoes",
    exportKey: "notificacoes",
    label: "Notificações",
    description: "Notificações enviadas, lidas e pendentes.",
    icon: Mail,
    tone: "violet",
  },
  {
    key: "saude-plataforma",
    exportKey: "saude-plataforma",
    label: "Saúde da plataforma",
    description: "Diagnósticos administrativos e inconsistências críticas.",
    icon: HeartPulse,
    tone: "rose",
  },
];

const RELATORIOS_MAP = new Map(RELATORIOS.map((item) => [item.key, item]));

const EXPORTAVEIS = new Set([
  "eventos",
  "presencas",
  "avaliacoes",
  "organizadores",
  "certificados",
  "usuarios",
  "notificacoes",
  "saude-plataforma",
]);

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function extrairData(response) {
  return response?.data ?? response ?? null;
}

function extrairMeta(response) {
  return response?.meta || response?.data?.meta || {};
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

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function hojeYMD() {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function primeiroDiaAnoYMD() {
  const ano = new Date().getFullYear();

  return `${ano}-01-01`;
}

function normalizarBusca(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toPositiveIntOrEmpty(value) {
  const text = String(value || "").trim();

  if (!text) return "";

  const number = Number(text);

  return Number.isInteger(number) && number > 0 ? String(number) : "";
}

function getRelatorioAtual(key) {
  return RELATORIOS_MAP.get(key) || RELATORIOS[0];
}

function getRowsFromData(data) {
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    return [data];
  }

  return [];
}

function getTotalRows(data) {
  return getRowsFromData(data).length;
}

function formatarNumero(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("pt-BR").format(number);
}

function formatarPercentual(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1).replace(".", ",")}%`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

function inferirNomeArquivo(result, fallback) {
  return result?.filename || result?.nome_arquivo || fallback;
}

function filtrarClientSide(rows, busca) {
  const q = normalizarBusca(busca);

  if (!q) return rows;

  return rows.filter((row) => {
    return Object.values(row || {}).some((value) => {
      return normalizarBusca(value).includes(q);
    });
  });
}

function getStatusSaude(row) {
  const severidade = String(row?.severidade || "").toLowerCase();

  if (severidade === "critico") return "critico";
  if (severidade === "alerta") return "alerta";
  if (severidade === "info") return "info";

  return "ok";
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

function MiniStatHero({ icon: Icon, label, value, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-400/15 text-violet-50 ring-violet-300/20",
    emerald: "bg-emerald-400/15 text-emerald-50 ring-emerald-300/20",
    amber: "bg-amber-400/15 text-amber-50 ring-amber-300/20",
    rose: "bg-rose-400/15 text-rose-50 ring-rose-300/20",
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

function Hero({ kpis, carregando, exportando, onRefresh }) {
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

      <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black ring-1 ring-white/20 backdrop-blur">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              Relatórios institucionais
            </div>

            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              Painel de relatórios da Escola da Saúde
            </h1>

            <p className="mt-3 max-w-3xl text-sm text-white/85 sm:text-base">
              Acompanhe eventos, presenças, avaliações, certificados, usuários,
              salas, notificações e saúde da plataforma com filtros oficiais e
              exportação institucional.
            </p>
          </div>

          <div className="flex shrink-0">
            <Botao
              type="button"
              variant="secondary"
              onClick={onRefresh}
              disabled={carregando || exportando}
              className="bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCcw
                  className={cx(
                    "h-4 w-4",
                    (carregando || exportando) && "animate-spin"
                  )}
                  aria-hidden="true"
                />
                {carregando ? "Atualizando..." : "Atualizar"}
              </span>
            </Botao>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStatHero
            icon={CalendarDays}
            label="Eventos"
            value={formatarNumero(kpis.eventos)}
            tone="cyan"
          />
          <MiniStatHero
            icon={UsersRound}
            label="Inscrições"
            value={formatarNumero(kpis.inscricoes)}
            tone="violet"
          />
          <MiniStatHero
            icon={FileBadge2}
            label="Certificados"
            value={formatarNumero(kpis.certificados)}
            tone="emerald"
          />
          <MiniStatHero
            icon={HeartPulse}
            label="Alertas"
            value={formatarNumero(kpis.alertas)}
            tone={kpis.alertas > 0 ? "rose" : "emerald"}
          />
        </div>

        <div className="mt-5 rounded-3xl bg-white/10 p-4 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              Os relatórios v2.0 usam contratos oficiais, filtros padronizados e
              dados rastreáveis para suporte, auditoria e tomada de decisão.
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}

function RelatorioTabs({ value, onChange, counts }) {
  return (
    <section
      aria-label="Categorias de relatório"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex min-w-fit gap-2 py-1">
        {RELATORIOS.map((item) => {
          const Icon = item.icon;
          const active = value === item.key;
          const count = counts[item.key];

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.key)}
              className={cx(
                "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ring-1 transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                active
                  ? "bg-slate-950 text-white ring-slate-950 dark:bg-white dark:text-slate-950 dark:ring-white"
                  : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-800"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
              {Number.isFinite(count) ? (
                <span
                  className={cx(
                    "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px]",
                    active
                      ? "bg-white/15 text-white dark:bg-slate-950/10 dark:text-slate-950"
                      : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Filtros({
  filtros,
  setFiltros,
  busca,
  setBusca,
  onBuscar,
  onLimpar,
  carregando,
  exportando,
  relatorioAtual,
  onExportar,
}) {
  const exportavel = Boolean(relatorioAtual.exportKey);

  return (
    <section
      aria-label="Filtros do relatório"
      className="rounded-[1.5rem] bg-white/85 p-4 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
    >
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h2 className="text-sm font-black text-slate-950 dark:text-white">
          Filtros oficiais
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <CampoData
          label="Data início"
          value={filtros.data_inicio}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, data_inicio: value }))
          }
        />

        <CampoData
          label="Data fim"
          value={filtros.data_fim}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, data_fim: value }))
          }
        />

        <CampoTextoNumerico
          label="Evento ID"
          value={filtros.evento_id}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, evento_id: value }))
          }
        />

        <CampoTextoNumerico
          label="Turma ID"
          value={filtros.turma_id}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, turma_id: value }))
          }
        />

        <CampoTextoNumerico
          label="organizador ID"
          value={filtros.organizador_id}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, organizador_id: value }))
          }
        />

        <CampoTextoNumerico
          label="Usuário ID"
          value={filtros.usuario_id}
          onChange={(value) =>
            setFiltros((prev) => ({ ...prev, usuario_id: value }))
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar nos resultados carregados..."
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-950 outline-none transition focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:ring-violet-950"
            aria-label="Buscar nos resultados"
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

        <select
          value={filtros.status}
          onChange={(event) =>
            setFiltros((prev) => ({ ...prev, status: event.target.value }))
          }
          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-violet-950"
          aria-label="Filtrar por status"
        >
          <option value="">Status: todos</option>
          <option value="programado">programado</option>
          <option value="andamento">andamento</option>
          <option value="encerrado">encerrado</option>
          <option value="emitido">emitido</option>
          <option value="enviado">enviado</option>
          <option value="cancelado">cancelado</option>
          <option value="anulado">anulado</option>
          <option value="substituido">substituido</option>
          <option value="erro_emissao">erro_emissao</option>
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Botao
          type="button"
          variant="primary"
          onClick={onBuscar}
          disabled={carregando || exportando}
        >
          <span className="inline-flex items-center gap-2">
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            {carregando ? "Buscando..." : "Buscar relatório"}
          </span>
        </Botao>

        <Botao
          type="button"
          variant="secondary"
          onClick={onExportar}
          disabled={!exportavel || carregando || exportando}
          title={
            exportavel
              ? "Exportar relatório atual em XLSX."
              : "Este relatório ainda não possui exportação XLSX direta."
          }
        >
          <span className="inline-flex items-center gap-2">
            {exportando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            )}
            {exportando ? "Exportando..." : "Exportar XLSX"}
          </span>
        </Botao>

        <Botao
          type="button"
          variant="secondary"
          onClick={onLimpar}
          disabled={carregando || exportando}
        >
          <span className="inline-flex items-center gap-2">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Limpar
          </span>
        </Botao>
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Filtros enviados ao backend somente com nomes oficiais:{" "}
        <code>data_inicio</code>, <code>data_fim</code>, <code>evento_id</code>,{" "}
        <code>turma_id</code>, <code>organizador_id</code>, <code>usuario_id</code>,{" "}
        <code>status</code>.
      </p>
    </section>
  );
}

function CampoData({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-violet-950"
      />
    </label>
  );
}

function CampoTextoNumerico({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Opcional"
        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-violet-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:ring-violet-950"
      />
    </label>
  );
}

function RelatorioDescricao({ relatorio, total, meta }) {
  const Icon = relatorio.icon;

  return (
    <section className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Badge tone={relatorio.tone}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {relatorio.label}
          </Badge>

          <h2 className="mt-3 text-lg font-black text-slate-950 dark:text-white">
            {relatorio.label}
          </h2>

          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
            {relatorio.description}
          </p>
        </div>

        <div className="grid min-w-[180px] grid-cols-2 gap-2">
          <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Registros
            </p>
            <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              {formatarNumero(total)}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-200 dark:bg-zinc-950 dark:ring-zinc-800">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
              Fonte
            </p>
            <p className="mt-1 text-xs font-black text-slate-950 dark:text-white">
              v2.0
            </p>
          </div>
        </div>
      </div>

      {meta?.filtros ? (
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-zinc-800">
          Filtros aplicados: {JSON.stringify(meta.filtros)}
        </p>
      ) : null}
    </section>
  );
}

function ResumoGeralCards({ data }) {
  const item = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  const cards = [
    ["Eventos", item.total_eventos, CalendarDays, "cyan"],
    ["Turmas", item.total_turmas, Activity, "violet"],
    ["Inscrições", item.total_inscricoes, UsersRound, "amber"],
    ["Presenças", item.total_presencas, CheckCircle2, "emerald"],
    ["Avaliações", item.total_avaliacoes, ClipboardList, "violet"],
    ["Certificados", item.total_certificados, FileBadge2, "emerald"],
    ["Avulsos", item.total_certificados_avulsos, FileBadge2, "cyan"],
    ["Usuários", item.total_usuarios, UsersRound, "amber"],
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value, Icon, tone]) => (
        <div
          key={label}
          className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800"
        >
          <div className="flex items-center gap-3">
            <span
              className={cx(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                tone === "emerald" &&
                  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                tone === "cyan" &&
                  "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
                tone === "amber" &&
                  "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                tone === "violet" &&
                  "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>

            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                {formatarNumero(value)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function SaudeCards({ rows }) {
  const counts = rows.reduce(
    (acc, row) => {
      const status = getStatusSaude(row);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    { ok: 0, info: 0, alerta: 0, critico: 0 }
  );

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatusCard label="OK" value={counts.ok} tone="emerald" />
      <StatusCard label="Info" value={counts.info} tone="cyan" />
      <StatusCard label="Alertas" value={counts.alerta} tone="amber" />
      <StatusCard label="Críticos" value={counts.critico} tone="rose" />
    </section>
  );
}

function StatusCard({ label, value, tone }) {
  const classes = {
    emerald:
      "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-100 dark:ring-emerald-800/60",
    cyan:
      "bg-cyan-50 text-cyan-900 ring-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-100 dark:ring-cyan-800/60",
    amber:
      "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/60",
    rose:
      "bg-rose-50 text-rose-900 ring-rose-100 dark:bg-rose-950/30 dark:text-rose-100 dark:ring-rose-800/60",
  };

  return (
    <div className={cx("rounded-[1.5rem] p-4 shadow-sm ring-1", classes[tone])}>
      <p className="text-[11px] font-black uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black">{Number(value) || 0}</p>
    </div>
  );
}

function Resultado({
  relatorioKey,
  relatorio,
  data,
  rows,
  rowsFiltradas,
  meta,
  carregando,
  erro,
  onRetry,
  busca,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [relatorioKey, busca, pageSize]);

  const totalPages = Math.max(1, Math.ceil(rowsFiltradas.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);

  const slice = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return rowsFiltradas.slice(start, start + pageSize);
  }, [rowsFiltradas, pageSafe, pageSize]);

  if (carregando) {
    return (
      <section className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="space-y-3">
          <CarregandoSkeleton height={72} />
          <CarregandoSkeleton height={260} />
        </div>
      </section>
    );
  }

  if (erro) {
    return <ErroCarregamento mensagem={erro} onRetry={onRetry} />;
  }

  if (relatorioKey === "resumo-geral") {
    return (
      <div className="space-y-4">
        <ResumoGeralCards data={data} />
        <RelatorioDescricao relatorio={relatorio} total={getTotalRows(data)} meta={meta} />
        <RelatoriosTabela data={rows} />
      </div>
    );
  }

  if (relatorioKey === "saude-plataforma") {
    return (
      <div className="space-y-4">
        <SaudeCards rows={rows} />
        <RelatorioDescricao relatorio={relatorio} total={rowsFiltradas.length} meta={meta} />
        <TabelaResultado
          rows={slice}
          total={rowsFiltradas.length}
          pageSafe={pageSafe}
          totalPages={totalPages}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RelatorioDescricao
        relatorio={relatorio}
        total={rowsFiltradas.length}
        meta={meta}
      />

      <TabelaResultado
        rows={slice}
        total={rowsFiltradas.length}
        pageSafe={pageSafe}
        totalPages={totalPages}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={setPageSize}
      />
    </div>
  );
}

function TabelaResultado({
  rows,
  total,
  pageSafe,
  totalPages,
  pageSize,
  setPage,
  setPageSize,
}) {
  return (
    <section className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
          {formatarNumero(total)} registro(s)
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-zinc-400">
            Por página
          </label>

          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) || 25);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm font-bold text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            {[10, 25, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={pageSafe <= 1}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-black disabled:opacity-50 dark:border-zinc-700"
            aria-label="Página anterior"
          >
            ‹
          </button>

          <span className="text-sm font-black text-slate-700 dark:text-zinc-200">
            {pageSafe}/{totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={pageSafe >= totalPages}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-black disabled:opacity-50 dark:border-zinc-700"
            aria-label="Próxima página"
          >
            ›
          </button>
        </div>
      </div>

      {rows.length > 0 ? (
        <RelatoriosTabela data={rows} />
      ) : (
        <NadaEncontrado
          titulo="Nenhum resultado encontrado"
          descricao="Ajuste os filtros e clique em Buscar relatório."
        />
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function RelatoriosCustomizados() {
  const reduceMotion = useReducedMotion();

  const [relatorioKey, setRelatorioKey] = useState("resumo-geral");
  const [filtros, setFiltros] = useState(() => ({
    data_inicio: primeiroDiaAnoYMD(),
    data_fim: hojeYMD(),
    evento_id: "",
    turma_id: "",
    organizador_id: "",
    usuario_id: "",
    status: "",
  }));

  const [busca, setBusca] = useState("");
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const relatorioAtual = getRelatorioAtual(relatorioKey);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  const paramsOficiais = useMemo(() => {
    const params = {};

    if (isYMD(filtros.data_inicio)) params.data_inicio = filtros.data_inicio;
    if (isYMD(filtros.data_fim)) params.data_fim = filtros.data_fim;

    const eventoId = toPositiveIntOrEmpty(filtros.evento_id);
    const turmaId = toPositiveIntOrEmpty(filtros.turma_id);
    const organizadorId = toPositiveIntOrEmpty(filtros.organizador_id);
    const usuarioId = toPositiveIntOrEmpty(filtros.usuario_id);

    if (eventoId) params.evento_id = eventoId;
    if (turmaId) params.turma_id = turmaId;
    if (organizadorId) params.organizador_id = organizadorId;
    if (usuarioId) params.usuario_id = usuarioId;

    if (filtros.status) params.status = filtros.status;

    return params;
  }, [filtros]);

  const validarFiltros = useCallback(() => {
    if (filtros.data_inicio && !isYMD(filtros.data_inicio)) {
      notifyWarning("Data inicial inválida. Use uma data válida.");
      return false;
    }

    if (filtros.data_fim && !isYMD(filtros.data_fim)) {
      notifyWarning("Data final inválida. Use uma data válida.");
      return false;
    }

    if (
      filtros.data_inicio &&
      filtros.data_fim &&
      filtros.data_inicio > filtros.data_fim
    ) {
      notifyWarning("A data inicial não pode ser maior que a data final.");
      return false;
    }

    return true;
  }, [filtros]);

  const chamarRelatorio = useCallback(
    async (key, params) => {
      switch (key) {
        case "resumo-geral":
          validarFacade("api.relatorio.resumoGeral", api?.relatorio?.resumoGeral);
          return api.relatorio.resumoGeral(params);

        case "eventos":
          validarFacade("api.relatorio.eventos", api?.relatorio?.eventos);
          return api.relatorio.eventos(params);

        case "presencas":
          validarFacade("api.relatorio.presencas", api?.relatorio?.presencas);
          return api.relatorio.presencas(params);

        case "avaliacoes":
          validarFacade("api.relatorio.avaliacoes", api?.relatorio?.avaliacoes);
          return api.relatorio.avaliacoes(params);

        case "organizadores":
          validarFacade("api.relatorio.organizadores", api?.relatorio?.organizadores);
          return api.relatorio.organizadores(params);

        case "certificados":
          validarFacade("api.relatorio.certificados", api?.relatorio?.certificados);
          return api.relatorio.certificados(params);

        case "certificados-pendencias":
          validarFacade(
            "api.relatorio.certificadosPendencias",
            api?.relatorio?.certificadosPendencias
          );
          return api.relatorio.certificadosPendencias(params);

        case "usuarios":
          validarFacade("api.relatorio.usuarios", api?.relatorio?.usuarios);
          return api.relatorio.usuarios(params);

        case "salas":
          validarFacade("api.relatorio.salas", api?.relatorio?.salas);
          return api.relatorio.salas(params);

        case "notificacoes":
          validarFacade("api.relatorio.notificacoes", api?.relatorio?.notificacoes);
          return api.relatorio.notificacoes(params);

        case "saude-plataforma":
          validarFacade(
            "api.relatorio.saudePlataforma",
            api?.relatorio?.saudePlataforma
          );
          return api.relatorio.saudePlataforma(params);

        default:
          throw new Error("Relatório inválido.");
      }
    },
    []
  );

  const buscarRelatorio = useCallback(async () => {
    if (!validarFiltros()) return;

    try {
      setCarregando(true);
      setErro("");
      setLive(`Carregando relatório: ${relatorioAtual.label}.`);

      const response = await chamarRelatorio(relatorioKey, paramsOficiais);
      const payload = extrairData(response);
      const responseMeta = extrairMeta(response);

      if (!mountedRef.current) return;

      setData(payload);
      setMeta(responseMeta || {});
      setLive("Relatório carregado com sucesso.");
    } catch (error) {
      console.error("[RelatoriosCustomizados] erro:", error);

      if (!mountedRef.current) return;

      const message = obterMensagemErro(
        error,
        "Não foi possível carregar o relatório."
      );

      setErro(message);
      setData(null);
      setMeta({});
      notifyError(message);
      setLive("Erro ao carregar relatório.");
    } finally {
      if (mountedRef.current) setCarregando(false);
    }
  }, [
    chamarRelatorio,
    paramsOficiais,
    relatorioAtual.label,
    relatorioKey,
    setLive,
    validarFiltros,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Relatórios Institucionais | Escola da Saúde";

    buscarRelatorio();

    return () => {
      mountedRef.current = false;
    };
  }, [buscarRelatorio]);

  const limparFiltros = useCallback(() => {
    setFiltros({
      data_inicio: primeiroDiaAnoYMD(),
      data_fim: hojeYMD(),
      evento_id: "",
      turma_id: "",
      organizador_id: "",
      usuario_id: "",
      status: "",
    });

    setBusca("");
    setLive("Filtros limpos.");
  }, [setLive]);

  const exportarAtual = useCallback(async () => {
    const exportKey = relatorioAtual.exportKey;

    if (!exportKey || !EXPORTAVEIS.has(exportKey)) {
      notifyInfo("Este relatório ainda não possui exportação XLSX direta.");
      return;
    }

    if (!validarFiltros()) return;

    try {
      validarFacade("api.relatorio.exportarXlsx", api?.relatorio?.exportarXlsx);

      setExportando(true);
      setLive("Exportando relatório XLSX.");

      const result = await api.relatorio.exportarXlsx(exportKey, paramsOficiais);
      const blob = result?.blob || result?.data || result;
      const filename = inferirNomeArquivo(
        result,
        `relatorio_${exportKey}_${hojeYMD()}.xlsx`
      );

      downloadBlob(filename, blob);
      notifySuccess("Exportação iniciada.");
      setLive("Exportação iniciada.");
    } catch (error) {
      console.error("[RelatoriosCustomizados] erro ao exportar:", error);

      notifyError(
        obterMensagemErro(error, "Não foi possível exportar o relatório.")
      );
      setLive("Erro ao exportar relatório.");
    } finally {
      setExportando(false);
    }
  }, [paramsOficiais, relatorioAtual.exportKey, setLive, validarFiltros]);

  const rows = useMemo(() => getRowsFromData(data), [data]);
  const rowsFiltradas = useMemo(() => filtrarClientSide(rows, busca), [rows, busca]);

  const counts = useMemo(() => {
    const base = {};

    if (relatorioKey) {
      base[relatorioKey] = rows.length;
    }

    return base;
  }, [relatorioKey, rows.length]);

  const kpis = useMemo(() => {
    const resumo = data && typeof data === "object" && !Array.isArray(data) ? data : {};

    if (relatorioKey === "resumo-geral") {
      return {
        eventos: Number(resumo.total_eventos || 0),
        inscricoes: Number(resumo.total_inscricoes || 0),
        certificados:
          Number(resumo.total_certificados || 0) +
          Number(resumo.total_certificados_avulsos || 0),
        alertas:
          Number(resumo.certificados_erro || 0) +
          Number(resumo.certificados_avulsos_erro || 0),
      };
    }

    if (relatorioKey === "saude-plataforma") {
      const criticos = rows.filter((row) => getStatusSaude(row) === "critico").length;
      const alertas = rows.filter((row) => getStatusSaude(row) === "alerta").length;

      return {
        eventos: rows.length,
        inscricoes: 0,
        certificados: 0,
        alertas: criticos + alertas,
      };
    }

    return {
      eventos: relatorioKey === "eventos" ? rows.length : 0,
      inscricoes: relatorioKey === "presencas" ? rows.length : 0,
      certificados: relatorioKey === "certificados" ? rows.length : 0,
      alertas: relatorioKey === "certificados-pendencias" ? rows.length : 0,
    };
  }, [data, relatorioKey, rows]);

  const motionProps = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 8 },
      animate: reduceMotion ? undefined : { opacity: 1, y: 0 },
      exit: reduceMotion ? undefined : { opacity: 0, y: 8 },
      transition: { duration: 0.18 },
    }),
    [reduceMotion]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <Hero
        kpis={kpis}
        carregando={carregando}
        exportando={exportando}
        onRefresh={buscarRelatorio}
      />

      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {(carregando || exportando) ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-violet-100 dark:bg-violet-950"
          role="progressbar"
          aria-label="Processando relatório"
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
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <RelatorioTabs
          value={relatorioKey}
          onChange={(key) => {
            setRelatorioKey(key);
            setBusca("");
            setErro("");
            setData(null);
            setMeta({});
          }}
          counts={counts}
        />

        <AnimatePresence mode="wait">
          <motion.div key={relatorioKey} {...motionProps} className="space-y-5">
            <Filtros
              filtros={filtros}
              setFiltros={setFiltros}
              busca={busca}
              setBusca={setBusca}
              onBuscar={buscarRelatorio}
              onLimpar={limparFiltros}
              carregando={carregando}
              exportando={exportando}
              relatorioAtual={relatorioAtual}
              onExportar={exportarAtual}
            />

            <Resultado
              relatorioKey={relatorioKey}
              relatorio={relatorioAtual}
              data={data}
              rows={rows}
              rowsFiltradas={rowsFiltradas}
              meta={meta}
              carregando={carregando}
              erro={erro}
              onRetry={buscarRelatorio}
              busca={busca}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}