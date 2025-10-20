// 📁 src/pages/SolicitacaoCurso.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
import {
  GraduationCap, Plus, X, Info, CheckCircle2, TimerReset, ClipboardList,
  BarChart3, Upload, FileText, CalendarCheck2, Loader2
} from "lucide-react";
import { apiGet, apiPost } from "../services/api";

/* =========================================================================
   HeaderHero padronizado (mesmo tamanho/typo em TODAS as páginas)
   - 3 cores por gradiente
   - Título centralizado com ícone ao lado (mobile-safe)
   ========================================================================= */
function HeaderHero({ variant = "petroleo", title, subtitle, Icon = GraduationCap }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
    orange: "from-orange-900 via-orange-800 to-orange-700",
    petroleo: "from-slate-900 via-teal-900 to-slate-800",       // 💠 identidade desta página
    amarelo: "from-yellow-900 via-amber-800 to-yellow-700",
    vermelho: "from-red-900 via-red-800 to-red-700",
    salmon: "from-rose-800 via-orange-700 to-amber-600",
    marrom: "from-stone-900 via-stone-800 to-amber-900",
    preto: "from-neutral-950 via-neutral-900 to-neutral-800",
    verde: "from-emerald-900 via-emerald-800 to-emerald-700",
    azul: "from-blue-900 via-blue-800 to-blue-700",
    rosa: "from-pink-900 via-rose-800 to-pink-700",
  };
  const grad = variants[variant] ?? variants.petroleo;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      {/* Altura padronizada + tipografia uniforme entre páginas */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 min-h-[180px] flex items-center justify-center">
        <div className="w-full text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-balance break-words">
              {title}
            </h1>
          </div>
          {subtitle && (
            <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl mx-auto text-balance">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   UI auxiliares (cards, badges, ministats)
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

function MiniStat({ icon: Icon, label, value, hint, loading = false }) {
  return (
    <div
      className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg p-2 bg-slate-100 dark:bg-zinc-800">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="w-5 h-5" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-xs text-slate-600 dark:text-slate-300">{label}</div>
        <div className="text-xl font-semibold leading-tight">{loading ? "—" : value}</div>
        {hint && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

/* =========================================================================
   Modal Acessível (sem libs externas)
   - ESC fecha
   - Overlay fecha
   - Focus inicial no título
   ========================================================================= */
function Modal({ open, title, onClose, children, labelledById = "modal-title" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && dialogRef.current) {
      const h = dialogRef.current.querySelector("h2");
      if (h) h.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledById}
    >
      <button
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fechar modal"
        onClick={onClose}
      />
      <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div
          ref={dialogRef}
          className="w-full sm:max-w-2xl outline-none"
        >
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2
                id={labelledById}
                tabIndex={-1}
                className="text-lg sm:text-xl font-bold tracking-tight"
              >
                {title}
              </h2>
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
   Formulário Nova Solicitação (mobile-first + a11y)
   ========================================================================= */
function FormNovaSolicitacao({ onSubmit, submitting }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("curso");
  const [carga, setCarga] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [local, setLocal] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({
      titulo,
      tipo,
      carga_horaria: carga,
      data_inicio: dataInicio,
      data_fim: dataFim,
      local,
      descricao,
      // arquivo opcional (use FormData no onSubmit real)
      arquivo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="titulo" className="text-sm font-medium">Título do curso/evento</label>
        <input
          id="titulo"
          type="text"
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder='Ex.: "Atendimento Humanizado em Saúde Mental"'
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="tipo" className="text-sm font-medium">Tipo</label>
        <select
          id="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
        >
          <option value="curso">Curso</option>
          <option value="simpósio">Simpósio</option>
          <option value="congresso">Congresso</option>
          <option value="oficina">Oficina</option>
          <option value="palestra">Palestra</option>
        </select>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="grid gap-2">
          <label htmlFor="carga" className="text-sm font-medium">Carga horária (h)</label>
          <input
            id="carga"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
            placeholder="Ex.: 12"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="inicio" className="text-sm font-medium">Início</label>
          <input
            id="inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor="fim" className="text-sm font-medium">Fim</label>
          <input
            id="fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="local" className="text-sm font-medium">Local</label>
        <input
          id="local"
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder="Ex.: Auditório da Escola da Saúde"
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="desc" className="text-sm font-medium">Descrição</label>
        <textarea
          id="desc"
          rows={4}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder="Resumo do objetivo e público-alvo…"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Anexos (opcional)</label>
        <label className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 bg-white dark:bg-zinc-900 border-dashed border-black/20 dark:border-white/20 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition">
          <Upload className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Enviar arquivo (PDF, DOCX, PPTX)</span>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.ppt,.pptx"
          />
        </label>
        {arquivo && (
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <FileText className="w-4 h-4" aria-hidden="true" />
            {arquivo.name}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Enviar solicitação
        </button>
      </div>
    </form>
  );
}

/* =========================================================================
   Página
   ========================================================================= */
export default function SolicitacaoCurso() {
  // ======= Estado de métricas (ministats) =======
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    emAnalise: 0,
    aprovadas: 0,
    rejeitadas: 0,
    tempoMedioDias: 0,
  });

  // ======= Modal / Form =======
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ======= Buscar métricas =======
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      // TODO: alinhar com teu backend (ex.: GET /api/solicitacoes/metricas)
      const resp = await apiGet?.("/api/solicitacoes/metricas");
      if (resp?.ok && resp?.data) {
        const d = resp.data;
        setStats({
          emAnalise: d.emAnalise ?? 0,
          aprovadas: d.aprovadas ?? 0,
          rejeitadas: d.rejeitadas ?? 0,
          tempoMedioDias: d.tempoMedioDias ?? 0,
        });
      } else {
        // demo mode
        setStats({ emAnalise: 3, aprovadas: 18, rejeitadas: 2, tempoMedioDias: 7 });
      }
    } catch {
      // demo mode silencioso
      setStats({ emAnalise: 3, aprovadas: 18, rejeitadas: 2, tempoMedioDias: 7 });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ======= Submit Nova Solicitação =======
  const handleSubmitSolicitacao = async (payload) => {
    setSubmitting(true);
    try {
      // Se houver arquivo, mandar via FormData
      let body = payload;
      let config = {};
      if (payload.arquivo) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (k === "arquivo" && v) fd.append("arquivo", v);
          else if (v != null) fd.append(k, v);
        });
        body = fd;
        config = { headers: { "Content-Type": "multipart/form-data" } };
      }

      // TODO: alinhar com teu backend (ex.: POST /api/solicitacoes)
      const resp = await apiPost?.("/api/solicitacoes", body, config);

      if (resp?.ok) {
        toast.success("Solicitação enviada com sucesso! 🎉");
        setOpenModal(false);
        fetchStats(); // atualiza ministats
      } else {
        toast.info("Ambiente de demonstração: solicitação simulada.");
        setOpenModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero
        variant="petroleo"
        title="Solicitação de Curso / Evento"
        subtitle="Proponha cursos, simpósios, congressos ou oficinas. A Escola analisará e validará a proposta."
        Icon={GraduationCap}
      />

      <main id="conteudo" role="main" className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* ===================== Ministats ===================== */}
          <section aria-labelledby="metricas" className="mb-6 sm:mb-8">
            <h2 id="metricas" className="sr-only">Métricas de solicitações</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MiniStat
                icon={ClipboardList}
                label="Em análise"
                value={stats.emAnalise}
                loading={loadingStats}
                hint="Aguardando avaliação"
              />
              <MiniStat
                icon={CheckCircle2}
                label="Aprovadas"
                value={stats.aprovadas}
                loading={loadingStats}
                hint="Prontas para programação"
              />
              <MiniStat
                icon={X}
                label="Rejeitadas"
                value={stats.rejeitadas}
                loading={loadingStats}
                hint="Não aderentes"
              />
              <MiniStat
                icon={TimerReset}
                label="Tempo médio"
                value={`${stats.tempoMedioDias} dias`}
                loading={loadingStats}
                hint="Do envio à decisão"
              />
            </div>
          </section>

          {/* ===================== Conteúdo principal ===================== */}
          <section className="grid gap-4 sm:gap-6 md:grid-cols-5">
            <Card className="md:col-span-3 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" aria-hidden="true" />
                <h3 className="text-base sm:text-lg font-bold">Solicitar novo curso/evento</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Clique no botão abaixo para preencher os dados essenciais da proposta.
              </p>

              <div className="mt-4">
                <button
                  onClick={() => setOpenModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Nova solicitação
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl p-4 bg-slate-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2 font-medium">
                    <CalendarCheck2 className="w-4 h-4" aria-hidden="true" />
                    Prazos sugeridos
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Envie com antecedência mínima de <strong>30 dias</strong> para agenda e divulgação adequada.
                  </p>
                </div>
                <div className="rounded-xl p-4 bg-slate-50 dark:bg-zinc-800/60 border border-black/5 dark:border-white/10">
                  <div className="flex items-center gap-2 font-medium">
                    <Info className="w-4 h-4" aria-hidden="true" />
                    Documentos
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Anexe plano de curso, ementa ou ofício (PDF/DOCX/PPTX) para agilizar a análise.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="md:col-span-2 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" aria-hidden="true" />
                <h3 className="text-base sm:text-lg font-bold">Como funciona a análise</h3>
              </div>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white text-xs">1</span>
                  <div>
                    <div className="font-medium">Envio</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Você registra a proposta com os dados essenciais do evento.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white text-xs">2</span>
                  <div>
                    <div className="font-medium">Avaliação técnica</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      A Escola verifica aderência, viabilidade, cronograma e equipe.
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white text-xs">3</span>
                  <div>
                    <div className="font-medium">Decisão</div>
                    <div className="text-slate-600 dark:text-slate-300">
                      A proposta é <strong>aprovada</strong>, <strong>ajustada</strong> ou <strong>indeferida</strong>.
                    </div>
                  </div>
                </li>
              </ol>
            </Card>
          </section>
        </div>
      </main>

      <Footer />

      {/* ===================== Modal Nova Solicitação ===================== */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Nova solicitação de curso/evento"
        labelledById="modal-nova-solicitacao-title"
      >
        <FormNovaSolicitacao onSubmit={handleSubmitSolicitacao} submitting={submitting} />
      </Modal>
    </div>
  );
}
