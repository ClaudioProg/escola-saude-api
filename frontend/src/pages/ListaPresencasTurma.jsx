// ✅ src/pages/ListaPresencasTurma.jsx (premium + mobile-first + a11y + cards no mobile + regras admin 15 dias)
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  UsersRound,
  CalendarDays,
  Clock,
  ShieldCheck,
} from "lucide-react";

import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira, formatarCPF } from "../utils/data";
import { apiPost } from "../services/api";
import ModalConfirmacao from "../components/ModalConfirmacao";

/* ───────────────────────────────
   Helpers anti-fuso (datas locais)
   ─────────────────────────────── */
const ymdParts = (s) => {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
};
const hmsParts = (s, fb = "00:00") => {
  const [hh, mm] = String(s || fb)
    .split(":")
    .map((n) => parseInt(n, 10) || 0);
  return { hh, mm };
};
const makeLocalDate = (yyyy_mm_dd, hhmm = "00:00") => {
  const d = ymdParts(yyyy_mm_dd);
  const t = hmsParts(hhmm);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0) : new Date(NaN);
};
const isoDia = (d) => {
  if (!d) return "";
  if (d instanceof Date && !Number.isNaN(+d)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(d);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const nd = new Date(s);
  if (!Number.isNaN(+nd)) {
    const y = nd.getFullYear();
    const mo = String(nd.getMonth() + 1).padStart(2, "0");
    const da = String(nd.getDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return "";
};

const addDaysMs = (ms, days) => ms + days * 24 * 60 * 60 * 1000;

/* ───────────────────────────────
   UI helpers (status/cores)
   ─────────────────────────────── */
function statusBarClass(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "programado" || s === "agendada" || s === "agendado") {
    return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-400";
  }
  if (s === "andamento" || s === "em andamento") {
    return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  }
  if (s === "encerrado" || s === "realizado" || s === "finalizado") {
    return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  }
  return "bg-gradient-to-r from-slate-600 via-slate-500 to-slate-400";
}

function Badge({ tone = "zinc", children, className = "" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700",
    emerald:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/50",
    amber:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50",
    rose:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border border-rose-200 dark:border-rose-800/50",
    sky:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200 border border-sky-200 dark:border-sky-800/50",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.zinc} ${className}`}
    >
      {children}
    </span>
  );
}

function Collapser({ id, open, onToggle, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1 text-left ${className}`}
      aria-expanded={open}
      aria-controls={id}
    >
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default function ListaPresencasTurma({
  turmas = [],
  hoje = new Date(),
  inscritosPorTurma = {},
  carregarInscritos,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [inscritosState, setInscritosState] = useState(inscritosPorTurma);
  const [loading, setLoading] = useState(null); // {turmaId, usuarioId, data}

  // 🔔 modal de confirmação (confirmar presença)
  const [confirmar, setConfirmar] = useState(null); // { turmaId, usuarioId, diaISO, nome }
  const [executandoConfirmacao, setExecutandoConfirmacao] = useState(false);

  // live region opcional
  const liveRef = useRef(null);
  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  // mantém estado de inscritos sincronizado com prop
  useEffect(() => {
    setInscritosState(inscritosPorTurma);
  }, [inscritosPorTurma]);

  // ordena turmas por data_inicio (mais recentes primeiro)
  const turmasOrdenadas = useMemo(() => {
    const key = (t) => isoDia(t?.data_inicio) || "";
    return [...(Array.isArray(turmas) ? turmas : [])].sort((a, b) =>
      key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0
    );
  }, [turmas]);

  // ao expandir: carrega inscritos se não houver
  useEffect(() => {
    if (!turmaExpandidaId || !carregarInscritos) return;
    const lista = inscritosState?.[turmaExpandidaId];
    if (!Array.isArray(lista) || lista.length === 0) {
      carregarInscritos(turmaExpandidaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turmaExpandidaId]);

  const executarConfirmarPresenca = useCallback(
    async ({ turmaId, usuarioId, diaISO }) => {
      setLoading({ turmaId, usuarioId, data: diaISO });
      try {
        setLive(`Confirmando presença de ${usuarioId} em ${formatarDataBrasileira(diaISO)}…`);
        await apiPost("/api/presencas/confirmar-simples", {
          turma_id: turmaId,
          usuario_id: usuarioId,
          data: diaISO,
        });

        toast.success("✅ Presença confirmada com sucesso.", { ariaLive: "polite" });

        // atualização otimista
        setInscritosState((prev) => {
          const next = { ...prev };
          const lista = Array.isArray(next[turmaId]) ? next[turmaId] : [];
          next[turmaId] = lista.map((p) => {
            const idNorm = p.usuario_id ?? p.id;
            if (String(idNorm) !== String(usuarioId)) return p;

            // suporta dois formatos: array de presenças ou mapa { 'YYYY-MM-DD': true }
            if (Array.isArray(p.presencas)) {
              const jaExiste = p.presencas.some((pp) => isoDia(pp.data_presenca) === diaISO);
              return jaExiste
                ? p
                : { ...p, presencas: [...p.presencas, { data_presenca: diaISO, presente: true }] };
            }
            return { ...p, presencas: { ...(p.presencas || {}), [diaISO]: true } };
          });
          return next;
        });

        // sincroniza do servidor
        if (carregarInscritos) await carregarInscritos(turmaId);
        setLive("Presença confirmada.");
      } catch (err) {
        toast.error("❌ " + (err?.message || "Erro ao confirmar presença"), { ariaLive: "assertive" });
        setLive("Falha ao confirmar presença.");
      } finally {
        setLoading(null);
      }
    },
    [carregarInscritos]
  );

  const abrirModalConfirmar = (turmaId, usuarioId, diaISO, nome) => {
    setConfirmar({ turmaId, usuarioId, diaISO, nome: nome || null });
  };

  const onConfirmarModal = async () => {
    if (!confirmar?.turmaId || !confirmar?.usuarioId || !confirmar?.diaISO) {
      setConfirmar(null);
      return;
    }
    try {
      setExecutandoConfirmacao(true);
      await executarConfirmarPresenca({
        turmaId: confirmar.turmaId,
        usuarioId: confirmar.usuarioId,
        diaISO: confirmar.diaISO,
      });
    } finally {
      setExecutandoConfirmacao(false);
      setConfirmar(null);
    }
  };

  /* ─────────────── render vazio ─────────────── */
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
        <PageHeader title="Presenças por Turma" icon={ClipboardList} variant="esmeralda" />
        <main className="flex-1 px-2 sm:px-4 py-6">
          <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Presenças por Turma" }]} />
          <NadaEncontrado mensagem="Nenhuma turma encontrada." sugestao="Verifique os filtros ou cadastre uma nova turma." />
        </main>
        <Footer />
      </div>
    );
  }

  const hojeISO = isoDia(hoje);

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region a11y */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {/* ModalConfirmacao (confirmar presença) */}
      <ModalConfirmacao
        open={!!confirmar}
        onClose={() => setConfirmar(null)}
        onConfirm={onConfirmarModal}
        titulo="Confirmar presença"
        confirmarTexto="Confirmar"
        cancelarTexto="Cancelar"
        danger={false}
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Deseja realmente confirmar a presença
          {confirmar?.nome ? (
            <> de <span className="font-semibold">{confirmar.nome}</span></>
          ) : null}{" "}
          no dia <strong>{confirmar?.diaISO ? formatarDataBrasileira(confirmar.diaISO) : "—"}</strong>?
        </p>
        {executandoConfirmacao && (
          <p className="mt-2 text-xs text-zinc-500" aria-live="polite">
            Executando confirmação…
          </p>
        )}
      </ModalConfirmacao>

      <PageHeader title="Presenças por Turma" icon={ClipboardList} variant="esmeralda" />

      <main className="flex-1 px-2 sm:px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Presenças por Turma" }]} />

        {/* ministats rápidos */}
        <section aria-label="Resumo" className="max-w-6xl mx-auto mt-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
              <CalendarDays className="w-4 h-4" /> Turmas
            </div>
            <div className="mt-1 text-3xl font-extrabold text-lousa dark:text-white">
              {turmasOrdenadas.length}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
              <UsersRound className="w-4 h-4" /> Inscritos carregados
            </div>
            <div className="mt-1 text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {Object.values(inscritosState || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0)}
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-zinc-500">
              <ShieldCheck className="w-4 h-4" /> Janela de confirmação
            </div>
            <div className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {modoadministradorPresencas ? "Admin: 1h após início até 15 dias após o fim" : "Somente leitura"}
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto space-y-5">
          {turmasOrdenadas.map((turma) => {
            const inicioDia = isoDia(turma.data_inicio);
            const fimDia = isoDia(turma.data_fim);

            const aberto = turmaExpandidaId === turma.id;
            const secId = `detalhes-turma-${turma.id}`;

            const statusLabel = turma.status || "Agendada";
            const bar = statusBarClass(statusLabel);

            const inscritos = inscritosState?.[turma.id];
            const inscritosCount = Array.isArray(inscritos) ? inscritos.length : 0;

            return (
              <section
                key={turma.id}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
                aria-labelledby={`turma-${turma.id}-titulo`}
              >
                {/* barra superior (padrão CardEventoAdministrador) */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${bar}`} aria-hidden="true" />

                {/* cabeçalho */}
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2
                        id={`turma-${turma.id}-titulo`}
                        className="font-extrabold text-lg sm:text-xl text-lousa dark:text-emerald-200 break-words"
                      >
                        {turma.nome}
                      </h2>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-4 h-4" />
                          {inicioDia ? formatarDataBrasileira(inicioDia) : "—"} até{" "}
                          {fimDia ? formatarDataBrasileira(fimDia) : "—"}
                        </span>

                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {turma.horario_inicio?.slice?.(0, 5) || "—"} às {turma.horario_fim?.slice?.(0, 5) || "—"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone="zinc">{statusLabel}</Badge>
                        <Badge tone="sky">
                          Inscritos: <strong className="ml-1">{inscritosCount}</strong>
                        </Badge>
                        {modoadministradorPresencas && (
                          <Badge tone="amber">Admin</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      <Collapser
                        id={secId}
                        open={aberto}
                        onToggle={() => setTurmaExpandidaId(aberto ? null : turma.id)}
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-white/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                      >
                        {aberto ? "Recolher" : "Ver detalhes"}
                      </Collapser>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {aberto && (
                    <motion.div
                      id={secId}
                      className="border-t border-zinc-200 dark:border-zinc-800 p-4 sm:p-5"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-extrabold text-zinc-800 dark:text-zinc-100">
                          Inscritos
                        </h3>
                        <span className="text-xs text-zinc-500">
                          {inscritosCount} pessoa(s)
                        </span>
                      </div>

                      {!Array.isArray(inscritos) ? (
                        <div className="text-sm text-zinc-500">
                          Carregando inscritos…
                        </div>
                      ) : inscritos.length === 0 ? (
                        <div className="text-sm text-zinc-500">
                          Nenhum inscrito encontrado para esta turma.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {inscritos.map((pessoa) => {
                            const usuarioIdNorm = pessoa.usuario_id ?? pessoa.id;
                            const datas = Array.isArray(pessoa.datas) ? pessoa.datas : [];

                            return (
                              <article
                                key={usuarioIdNorm}
                                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/25 p-3 sm:p-4"
                                aria-label={`Inscrito: ${pessoa.nome}`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="font-extrabold text-zinc-900 dark:text-white break-words">
                                      {pessoa.nome}
                                    </div>
                                    <div className="text-xs text-zinc-600 dark:text-zinc-300 break-words">
                                      {pessoa.email || "—"}
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                                      CPF: {pessoa.cpf ? formatarCPF(pessoa.cpf) : "Não informado"}
                                    </div>
                                  </div>

                                  {/* microbadge de “tem datas?” */}
                                  <div className="shrink-0">
                                    {datas.length ? (
                                      <Badge tone="sky">Datas: {datas.length}</Badge>
                                    ) : (
                                      <Badge tone="zinc">Sem datas</Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-3">
                                  {datas.length === 0 ? (
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                      Nenhuma data cadastrada para esta pessoa.
                                    </p>
                                  ) : (
                                    <>
                                      {/* TABLE (>= sm) */}
                                      <div className="hidden sm:block overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                          <thead>
                                            <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                              <th className="py-2 pr-4">📅 Data</th>
                                              <th className="py-2 pr-4">📌 Situação</th>
                                              <th className="py-2 pr-4">✔️ Ações</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {datas.map((data) => {
                                              const dia = isoDia(data);

                                              // presença suportando ambos formatos
                                              let presente = false;
                                              if (Array.isArray(pessoa.presencas)) {
                                                presente = pessoa.presencas.some(
                                                  (pp) => isoDia(pp.data_presenca) === dia && pp.presente === true
                                                );
                                              } else if (pessoa.presencas && typeof pessoa.presencas === "object") {
                                                presente = pessoa.presencas[dia] === true;
                                              }

                                              const inicioLocal = makeLocalDate(dia, turma.horario_inicio || "08:00");
                                              const fimLocal = makeLocalDate(dia, turma.horario_fim || "17:00");

                                              const passou60 =
                                                Number.isFinite(+inicioLocal) &&
                                                Date.now() >= inicioLocal.getTime() + 60 * 60 * 1000;

                                              const deadlineAdmin =
                                                Number.isFinite(+fimLocal) ? addDaysMs(fimLocal.getTime(), 15) : NaN;

                                              const dentroJanelaAdmin =
                                                Number.isFinite(deadlineAdmin) && Date.now() <= deadlineAdmin;

                                              const podeConfirmar =
                                                modoadministradorPresencas && passou60 && dentroJanelaAdmin;

                                              const isLoading =
                                                loading &&
                                                loading.turmaId === turma.id &&
                                                loading.usuarioId === usuarioIdNorm &&
                                                loading.data === dia;

                                              let status = "Aguardando";
                                              let tone = "amber";
                                              let icon = null;

                                              if (presente) {
                                                status = "Presente";
                                                tone = "emerald";
                                                icon = <CheckCircle size={14} aria-hidden="true" />;
                                              } else if (passou60) {
                                                status = "Faltou";
                                                tone = "rose";
                                                icon = <XCircle size={14} aria-hidden="true" />;
                                              }

                                              return (
                                                <tr key={`${usuarioIdNorm}-${dia}`} className="border-t dark:border-zinc-800">
                                                  <td className="py-2 pr-4">{formatarDataBrasileira(dia)}</td>
                                                  <td className="py-2 pr-4">
                                                    <Badge tone={tone}>
                                                      {icon} {status}
                                                    </Badge>
                                                  </td>
                                                  <td className="py-2 pr-4">
                                                    {!presente ? (
                                                      <button
                                                        disabled={!podeConfirmar || isLoading}
                                                        onClick={() => abrirModalConfirmar(turma.id, usuarioIdNorm, dia, pessoa.nome)}
                                                        className={[
                                                          "inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-xs font-extrabold transition",
                                                          podeConfirmar
                                                            ? "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-300"
                                                            : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-not-allowed",
                                                          isLoading ? "opacity-60" : "",
                                                        ].join(" ")}
                                                        aria-label={`Confirmar presença de ${pessoa.nome} em ${formatarDataBrasileira(dia)}`}
                                                        title={
                                                          podeConfirmar
                                                            ? "Confirmar presença"
                                                            : modoadministradorPresencas
                                                            ? !passou60
                                                              ? "Disponível 1h após o início"
                                                              : "Fora do prazo (15 dias após o fim)"
                                                            : "Ação indisponível"
                                                        }
                                                      >
                                                        {isLoading ? "Confirmando…" : "Confirmar"}
                                                      </button>
                                                    ) : (
                                                      <span className="text-zinc-400">—</span>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* CARDS (mobile < sm) */}
                                      <ul className="sm:hidden space-y-2">
                                        {datas.map((data) => {
                                          const dia = isoDia(data);

                                          let presente = false;
                                          if (Array.isArray(pessoa.presencas)) {
                                            presente = pessoa.presencas.some(
                                              (pp) => isoDia(pp.data_presenca) === dia && pp.presente === true
                                            );
                                          } else if (pessoa.presencas && typeof pessoa.presencas === "object") {
                                            presente = pessoa.presencas[dia] === true;
                                          }

                                          const inicioLocal = makeLocalDate(dia, turma.horario_inicio || "08:00");
                                          const fimLocal = makeLocalDate(dia, turma.horario_fim || "17:00");

                                          const passou60 =
                                            Number.isFinite(+inicioLocal) &&
                                            Date.now() >= inicioLocal.getTime() + 60 * 60 * 1000;

                                          const deadlineAdmin =
                                            Number.isFinite(+fimLocal) ? addDaysMs(fimLocal.getTime(), 15) : NaN;

                                          const dentroJanelaAdmin =
                                            Number.isFinite(deadlineAdmin) && Date.now() <= deadlineAdmin;

                                          const podeConfirmar =
                                            modoadministradorPresencas && passou60 && dentroJanelaAdmin;

                                          const isLoading =
                                            loading &&
                                            loading.turmaId === turma.id &&
                                            loading.usuarioId === usuarioIdNorm &&
                                            loading.data === dia;

                                          let status = "Aguardando";
                                          let tone = "amber";
                                          if (presente) {
                                            status = "Presente";
                                            tone = "emerald";
                                          } else if (passou60) {
                                            status = "Faltou";
                                            tone = "rose";
                                          }

                                          return (
                                            <li
                                              key={`${usuarioIdNorm}-${dia}-m`}
                                              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 p-3"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                  <div className="text-sm font-extrabold text-zinc-900 dark:text-white">
                                                    {formatarDataBrasileira(dia)}
                                                  </div>
                                                  <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                                                    {turma.horario_inicio?.slice?.(0, 5) || "—"} às{" "}
                                                    {turma.horario_fim?.slice?.(0, 5) || "—"}
                                                  </div>
                                                </div>
                                                <Badge tone={tone}>{status}</Badge>
                                              </div>

                                              <div className="mt-2">
                                                {!presente ? (
                                                  <button
                                                    disabled={!podeConfirmar || isLoading}
                                                    onClick={() => abrirModalConfirmar(turma.id, usuarioIdNorm, dia, pessoa.nome)}
                                                    className={[
                                                      "w-full inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-extrabold transition",
                                                      podeConfirmar
                                                        ? "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-300"
                                                        : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-not-allowed",
                                                      isLoading ? "opacity-60" : "",
                                                    ].join(" ")}
                                                    aria-label={`Confirmar presença de ${pessoa.nome} em ${formatarDataBrasileira(dia)}`}
                                                    title={
                                                      podeConfirmar
                                                        ? "Confirmar presença"
                                                        : modoadministradorPresencas
                                                        ? !passou60
                                                          ? "Disponível 1h após o início"
                                                          : "Fora do prazo (15 dias após o fim)"
                                                        : "Ação indisponível"
                                                    }
                                                  >
                                                    {isLoading ? "Confirmando…" : "Confirmar presença"}
                                                  </button>
                                                ) : (
                                                  <div className="text-sm text-zinc-400">—</div>
                                                )}
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>

                                      {/* dica discreta */}
                                      {modoadministradorPresencas && (
                                        <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                                          Janela admin: confirmação liberada <strong>1h após o início</strong> e até{" "}
                                          <strong>15 dias</strong> após o fim da aula.
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}

                      {/* rodapé do bloco */}
                      <div className="mt-4 text-[12px] text-zinc-500 dark:text-zinc-400">
                        Hoje: <strong>{hojeISO ? formatarDataBrasileira(hojeISO) : "—"}</strong>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
