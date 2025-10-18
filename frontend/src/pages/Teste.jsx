// 📁 src/pages/Teste.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
import {
  ClipboardCheck, X, Loader2, CheckCircle2, Clock3, BookOpenCheck,
  BarChart3, Play, FileQuestion, Award, ShieldCheck, AlertCircle
} from "lucide-react";
import { apiGet, apiPost } from "../services/api";

/* =========================================================================
   HeaderHero padronizado (mesma altura/tipografia em todas as páginas)
   - Gradiente exclusivo desta página (3 cores): indigo → indigo → indigo
   ========================================================================= */
function HeaderHero() {
  const gradient = "from-indigo-900 via-indigo-800 to-indigo-700";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      {/* Skip-link para navegação por teclado/leitores de tela */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      {/* Altura/tipografia padronizadas */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 min-h-[180px] flex items-center">
        <div className="w-full text-center sm:text-left">
          <div className="inline-flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Teste do Curso</h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl">
            Responda avaliações dos cursos que possuem testes habilitados.
          </p>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   Primitivos de UI
   ========================================================================= */
function Card({ children, className = "", ...rest }) {
  return (
    <div
      className={
        "rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur border border-black/5 dark:border-white/10 shadow-sm " +
        className
      }
      {...rest}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200",
    verde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",  // aprovado/concluído
    amarelo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",    // pendente/em andamento
    vermelho: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",               // bloqueado/expirado
    azul: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",               // disponível
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tones[tone] ?? tones.default}`}>
      {children}
    </span>
  );
}

function MiniStat({ icon: Icon, label, value, hint, loading = false }) {
  return (
    <div
      className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg p-2 bg-indigo-100 dark:bg-indigo-900/40">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Icon className="w-5 h-5" aria-hidden="true" />}
      </div>
      <div className="flex-1">
        <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
        <div className="text-xl font-semibold leading-tight">{loading ? "—" : value}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

/* Modal acessível (ESC/overlay fecham, foco no título) */
function Modal({ open, title, onClose, children, labelledById = "modal-title" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const h = dialogRef.current.querySelector("h2");
      if (h) h.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledById}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Fechar modal" onClick={onClose} />
      <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div ref={dialogRef} className="w-full sm:max-w-2xl outline-none">
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id={labelledById} tabIndex={-1} className="text-lg sm:text-xl font-bold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   Linha de progresso acessível
   ========================================================================= */
function Progress({ value = 0, label = "Progresso" }) {
  return (
    <div role="group" aria-label={label}>
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${value}%` }} />
      </div>
      <div className="sr-only" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} />
    </div>
  );
}

/* =========================================================================
   Tabela/lista de testes (responsive)
   ========================================================================= */
function ListaTestes({ testes, onStart }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-black/10 dark:border-white/10">
            <th className="py-3 pr-3 font-semibold">Curso / Turma</th>
            <th className="py-3 pr-3 font-semibold">Disponibilidade</th>
            <th className="py-3 pr-3 font-semibold">Status</th>
            <th className="py-3 pr-3 font-semibold">Nota</th>
            <th className="py-3 pr-3 font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody>
          {testes.map((t) => (
            <tr key={t.id} className="border-b last:border-b-0 border-black/5 dark:border-white/5">
              <td className="py-3 pr-3">
                <div className="font-medium">{t.curso}</div>
                <div className="text-xs text-slate-600 dark:text-slate-300">{t.turma}</div>
              </td>
              <td className="py-3 pr-3 whitespace-nowrap">
                <div className="text-xs text-slate-600 dark:text-slate-300">{t.inicio} — {t.fim}</div>
              </td>
              <td className="py-3 pr-3">
                {t.status === "disponivel" && <Chip tone="azul">Disponível</Chip>}
                {t.status === "andamento" && <Chip tone="amarelo">Em andamento</Chip>}
                {t.status === "concluido" && <Chip tone="verde">Concluído</Chip>}
                {t.status === "bloqueado" && <Chip tone="vermelho">Bloqueado</Chip>}
              </td>
              <td className="py-3 pr-3">
                {t.status === "concluido" ? <span className="font-medium">{t.nota?.toFixed?.(1) ?? t.nota} / 10</span> : "—"}
              </td>
              <td className="py-3 pr-3">
                <div className="flex items-center gap-2">
                  {(t.status === "disponivel" || t.status === "andamento") && (
                    <button
                      onClick={() => onStart?.(t)}
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <Play className="w-4 h-4" aria-hidden="true" />
                      Iniciar
                    </button>
                  )}
                  {t.status === "concluido" && (
                    <Chip tone="verde">Finalizado</Chip>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Versão compacta para telas muito pequenas (opcional) */}
      {testes.length === 0 && (
        <div className="rounded-xl p-4 mt-3 bg-indigo-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/10 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Nenhum teste disponível no momento.</span>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Página
   ========================================================================= */
export default function Teste() {
  // ======= Ministats =======
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    disponiveis: 0,
    emAndamento: 0,
    concluidos: 0,
    notaMedia: 0, // /10
  });

  // ======= Listas =======
  const [testes, setTestes] = useState([]);

  // ======= Modal Iniciar Teste =======
  const [openModal, setOpenModal] = useState(false);
  const [testeSelecionado, setTesteSelecionado] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ======= Fetch (demo mode se API indisponível) =======
  const fetchTudo = useCallback(async () => {
    setLoadingStats(true);
    try {
      // TODO: alinhar com teu backend
      // const m = await apiGet("/api/testes/metricas");
      // const l = await apiGet("/api/testes/disponiveis");
      const m = { ok: true, data: { disponiveis: 3, emAndamento: 1, concluidos: 5, notaMedia: 8.7 } };
      const l = {
        ok: true, data: [
          { id: "t1", curso: "Acolhimento na APS", turma: "Turma 2025.2", inicio: "2025-10-18 08:00", fim: "2025-10-25 23:59", status: "disponivel" },
          { id: "t2", curso: "Urgência e Emergência", turma: "Turma 2025.3", inicio: "2025-10-10 08:00", fim: "2025-10-20 18:00", status: "andamento" },
          { id: "t3", curso: "Saúde Mental na Rede", turma: "Turma 2025.1", inicio: "2025-09-01 08:00", fim: "2025-09-10 18:00", status: "concluido", nota: 9.3 },
        ]
      };

      if (m?.ok && m?.data) setStats(m.data);
      else setStats({ disponiveis: 0, emAndamento: 0, concluidos: 0, notaMedia: 0 });

      if (l?.ok && l?.data) setTestes(l.data);
      else setTestes([]);
    } catch {
      // Fallback demo
      setStats({ disponiveis: 2, emAndamento: 0, concluidos: 0, notaMedia: 0 });
      setTestes([]);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchTudo();
  }, [fetchTudo]);

  // ======= Iniciar teste =======
  const abrirModalTeste = (t) => {
    setTesteSelecionado(t);
    setOpenModal(true);
  };

  const confirmarInicioTeste = async () => {
    if (!testeSelecionado) return;
    setSubmitting(true);
    try {
      // TODO endpoint real: POST /api/testes/iniciar
      const resp = await apiPost?.("/api/testes/iniciar", { teste_id: testeSelecionado.id });
      if (resp?.ok) {
        toast.success("Teste iniciado! Boa prova. ✨");
        setOpenModal(false);
        // redirecionar para página do teste se existir rota dedicada, ex.: navigate(`/teste/${id}`)
        fetchTudo();
      } else {
        toast.info("Ambiente de demonstração: início de teste simulado.");
        setOpenModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível iniciar o teste.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero />

      <main id="conteudo" role="main" className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* ===================== Ministats ===================== */}
          <section aria-labelledby="metricas" className="mb-6 sm:mb-8">
            <h2 id="metricas" className="sr-only">Métricas dos Testes</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MiniStat
                icon={FileQuestion}
                label="Disponíveis"
                value={stats.disponiveis}
                loading={loadingStats}
                hint="Prontos para iniciar"
              />
              <MiniStat
                icon={Clock3}
                label="Em andamento"
                value={stats.emAndamento}
                loading={loadingStats}
                hint="Ainda não finalizados"
              />
              <MiniStat
                icon={Award}
                label="Concluídos"
                value={stats.concluidos}
                loading={loadingStats}
                hint="Histórico recente"
              />
              <MiniStat
                icon={ShieldCheck}
                label="Nota média"
                value={`${stats.notaMedia?.toFixed?.(1) ?? stats.notaMedia} / 10`}
                loading={loadingStats}
                hint="Últimos testes concluídos"
              />
            </div>
          </section>

          {/* ===================== Conteúdo principal ===================== */}
          <section className="grid gap-4 sm:gap-6 md:grid-cols-5">
            {/* Lista de testes */}
            <Card className="md:col-span-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" aria-hidden="true" />
                  <h3 className="text-base sm:text-lg font-bold">Testes disponíveis / em andamento</h3>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Selecione um teste disponível para iniciar. Testes concluídos exibem a nota final.
              </p>

              <div className="mt-4">
                <ListaTestes testes={testes} onStart={abrirModalTeste} />
              </div>
            </Card>

            {/* Dicas & Regras */}
            <Card className="md:col-span-2 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="w-5 h-5" aria-hidden="true" />
                <h3 className="text-base sm:text-lg font-bold">Regras & Dicas</h3>
              </div>
              <ul className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white text-xs">1</span>
                  <div>
                    <div className="font-medium">Tempo e tentativas</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      O teste pode ter limite de tempo e/ou tentativas. Leia as instruções antes de iniciar.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white text-xs">2</span>
                  <div>
                    <div className="font-medium">Conexão</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Garanta conexão estável. Evite atualizar/fechar a página durante o teste.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white text-xs">3</span>
                  <div>
                    <div className="font-medium">Aprovação</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Alguns cursos podem exigir nota mínima para emissão de certificado.
                    </div>
                  </div>
                </li>
              </ul>

              {/* Exemplo de progresso geral (mock) */}
              <div className="mt-5">
                <Progress value={Math.min(100, Math.round((stats.concluidos / Math.max(1, stats.concluidos + stats.emAndamento + stats.disponiveis)) * 100))} label="Progresso geral" />
              </div>
            </Card>
          </section>
        </div>
      </main>

      <Footer />

      {/* ===================== Modal: Iniciar Teste ===================== */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Iniciar teste"
        labelledById="modal-iniciar-teste-title"
      >
        {testeSelecionado ? (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-indigo-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/10">
              <div className="font-medium">{testeSelecionado.curso}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">{testeSelecionado.turma}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Disponível: {testeSelecionado.inicio} — {testeSelecionado.fim}
              </div>
            </div>

            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
              <li className="flex gap-2">
                <Clock3 className="w-4 h-4 mt-0.5" aria-hidden="true" />
                O cronômetro pode iniciar ao clicar em <strong>Iniciar</strong>.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5" aria-hidden="true" />
                Não feche/atualize a página durante a tentativa.
              </li>
            </ul>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setOpenModal(false)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarInicioTeste}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Iniciar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">Selecione um teste para iniciar.</p>
        )}
      </Modal>
    </div>
  );
}
