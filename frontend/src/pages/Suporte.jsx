// 📁 src/pages/Suporte.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import Footer from "../components/Footer";
import {
  HelpCircle, MessageSquarePlus, X, Loader2, CheckCircle2, Clock3,
  Mail, Phone, Globe, ShieldCheck, AlertCircle
} from "lucide-react";
import { apiGet, apiPost } from "../services/api";

/* =========================================================================
   HeaderHero padronizado (mesma altura/typo entre páginas)
   - Gradiente exclusivo desta página (3 cores, violeta → fúcsia → índigo)
   ========================================================================= */
function HeaderHero() {
  const gradient = "from-violet-900 via-fuchsia-800 to-indigo-800";
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      {/* Skip-link para navegação por teclado/leitores de tela */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      {/* Altura padronizada + tipografia uniforme */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12 min-h-[180px] flex items-center">
        <div className="w-full text-center sm:text-left">
          <div className="inline-flex items-center gap-3">
            <HelpCircle className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Central de Suporte
            </h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-white/90 max-w-3xl">
            Tire dúvidas, reporte problemas e acompanhe orientações oficiais da Escola da Saúde.
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

function MiniStat({ icon: Icon, label, value, hint, loading = false }) {
  return (
    <div
      className="rounded-xl p-4 bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-sm flex items-start gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg p-2 bg-violet-100 dark:bg-violet-900/40">
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
   Modal acessível (ESC/overlay fecham, foco no título)
   ========================================================================= */
function Modal({ open, title, onClose, children, labelledById = "modal-title" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => e.key === "Escape" && onClose?.();
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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledById}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Fechar modal" onClick={onClose} />
      <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div ref={dialogRef} className="w-full sm:max-w-2xl outline-none">
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id={labelledById} tabIndex={-1} className="text-lg sm:text-xl font-bold tracking-tight">
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
   Formulário: Abrir Chamado (mobile-first + a11y)
   ========================================================================= */
function FormAbrirChamado({ onSubmit, submitting }) {
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("certificados");
  const [mensagem, setMensagem] = useState("");
  const [arquivo, setArquivo] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ assunto, categoria, mensagem, arquivo });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="assunto" className="text-sm font-medium">Assunto</label>
        <input
          id="assunto"
          type="text"
          required
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder='Ex.: "Erro ao baixar certificado"'
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="categoria" className="text-sm font-medium">Categoria</label>
        <select
          id="categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
        >
          <option value="certificados">Certificados</option>
          <option value="inscricoes">Inscrições</option>
          <option value="presencas">Presenças</option>
          <option value="avaliacoes">Avaliações</option>
          <option value="outros">Outros</option>
        </select>
      </div>

      <div className="grid gap-2">
        <label htmlFor="mensagem" className="text-sm font-medium">Descrição</label>
        <textarea
          id="mensagem"
          rows={4}
          required
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 bg-white dark:bg-zinc-900 border-black/10 dark:border-white/10"
          placeholder="Explique o que aconteceu, passos para reproduzir, prints, etc."
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Anexo (opcional)</label>
        <label className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 bg-white dark:bg-zinc-900 border-dashed border-black/20 dark:border-white/20 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition">
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
          <span className="text-sm">Enviar arquivo (PDF, DOCX, PNG, JPG)</span>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          />
        </label>
        {arquivo && (
          <div className="text-xs text-slate-600 dark:text-slate-300">{arquivo.name}</div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Enviar chamado
        </button>
      </div>
    </form>
  );
}

/* =========================================================================
   Página
   ========================================================================= */
export default function Suporte() {
  // ======= Estado: ministats =======
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    abertos: 0,
    resolvidos: 0,
    tempoMedioHoras: 0,
    incidentesHoje: 0,
  });

  // ======= Modal =======
  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ======= Buscar métricas =======
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      // TODO: alinhar com teu backend (ex.: GET /api/suporte/metricas)
      const resp = await apiGet?.("/api/suporte/metricas");
      if (resp?.ok && resp?.data) {
        const d = resp.data;
        setStats({
          abertos: d.abertos ?? 0,
          resolvidos: d.resolvidos ?? 0,
          tempoMedioHoras: d.tempoMedioHoras ?? 0,
          incidentesHoje: d.incidentesHoje ?? 0,
        });
      } else {
        // Demo mode
        setStats({ abertos: 4, resolvidos: 128, tempoMedioHoras: 6, incidentesHoje: 1 });
      }
    } catch {
      // Demo mode silencioso
      setStats({ abertos: 4, resolvidos: 128, tempoMedioHoras: 6, incidentesHoje: 1 });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ======= Submit chamado =======
  const handleSubmitChamado = async ({ assunto, categoria, mensagem, arquivo }) => {
    setSubmitting(true);
    try {
      let body = { assunto, categoria, mensagem };
      let config = {};
      if (arquivo) {
        const fd = new FormData();
        fd.append("assunto", assunto);
        fd.append("categoria", categoria);
        fd.append("mensagem", mensagem);
        fd.append("arquivo", arquivo);
        body = fd;
        config = { headers: { "Content-Type": "multipart/form-data" } };
      }
      // TODO: alinhar com teu backend (ex.: POST /api/suporte/chamados)
      const resp = await apiPost?.("/api/suporte/chamados", body, config);
      if (resp?.ok) {
        toast.success("Chamado enviado! Nossa equipe entrará em contato. 📬");
        setOpenModal(false);
        fetchStats();
      } else {
        toast.info("Ambiente de demonstração: chamado simulado.");
        setOpenModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar o chamado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-neutral-900 text-black dark:text-white">
      <HeaderHero />

      <main id="conteudo" role="main" className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* ===================== CTA + Ministats ===================== */}
          <section aria-labelledby="metricas" className="mb-6 sm:mb-8">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 id="metricas" className="text-base sm:text-lg font-bold">Status do Suporte</h2>
              <button
                onClick={() => setOpenModal(true)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-violet-700 hover:bg-violet-600 text-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
              >
                <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
                Abrir chamado
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <MiniStat
                icon={AlertCircle}
                label="Abertos"
                value={stats.abertos}
                loading={loadingStats}
                hint="Chamados em andamento"
              />
              <MiniStat
                icon={ShieldCheck}
                label="Resolvidos"
                value={stats.resolvidos}
                loading={loadingStats}
                hint="Desde o início do sistema"
              />
              <MiniStat
                icon={Clock3}
                label="Tempo médio"
                value={`${stats.tempoMedioHoras} h`}
                loading={loadingStats}
                hint="Da abertura à solução"
              />
              <MiniStat
                icon={HelpCircle}
                label="Incidentes (hoje)"
                value={stats.incidentesHoje}
                loading={loadingStats}
                hint="Ocorrências registradas"
              />
            </div>
          </section>

          {/* ===================== FAQ ===================== */}
          <section className="mb-8 sm:mb-10" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-base sm:text-lg font-bold">❓ Perguntas Frequentes (FAQ)</h2>
            <div className="mt-3 space-y-3">
              <details className="bg-white dark:bg-zinc-800 rounded-xl shadow border border-black/5 dark:border-white/10 p-4">
                <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                  Como recebo meu certificado?
                </summary>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Acesse a aba <strong>“Certificados”</strong> no seu painel e faça o download em PDF após atingir
                  <strong> 75% de presença</strong> no evento.
                </p>
              </details>

              <details className="bg-white dark:bg-zinc-800 rounded-xl shadow border border-black/5 dark:border.White/10 p-4">
                <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                  O QR Code do certificado é válido?
                </summary>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Sim. O QR Code aponta para a página oficial de validação da Escola da Saúde. Qualquer pessoa pode verificar a autenticidade.
                </p>
              </details>

              <details className="bg-white dark:bg-zinc-800 rounded-xl shadow border border-black/5 dark:border-white/10 p-4">
                <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                  Posso alterar minha assinatura depois de salvar?
                </summary>
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Sim. No seu painel de instrutor, clique em <strong>“Cadastrar/Alterar Assinatura”</strong> para modificar sua assinatura digital.
                </p>
              </details>
            </div>
          </section>

          {/* ===================== Orientações ===================== */}
          <section className="mb-8 sm:mb-10" aria-labelledby="orientacoes-heading">
            <h2 id="orientacoes-heading" className="text-base sm:text-lg font-bold">📜 Orientações sobre Certificados</h2>
            <ul className="mt-3 list-disc list-inside text-sm space-y-2 text-gray-700 dark:text-gray-300">
              <li>Certificados são emitidos apenas com 75% ou mais de presença.</li>
              <li>Verifique seu e-mail e CPF antes de se inscrever em eventos.</li>
              <li>O nome do certificado é o mesmo cadastrado no seu perfil — mantenha-o atualizado.</li>
              <li>Certificados digitais possuem QR Code para validação pública.</li>
            </ul>
          </section>

          {/* ===================== Contatos ===================== */}
          <section aria-labelledby="contatos-heading">
            <h2 id="contatos-heading" className="text-base sm:text-lg font-bold">📞 Contatos Úteis</h2>
            <Card className="mt-3 p-5 sm:p-6">
              <ul className="grid sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span><strong>Email:</strong> escoladasaude@santos.sp.gov.br</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                  <span><strong>Telefone:</strong> (13) 3213-5000 – R. 5331</span>
                </li>
                <li className="flex items-center gap-2">
                  <Globe className="w-4 h-4" aria-hidden="true" />
                  <span>
                    <strong>Site:</strong>{" "}
                    <a
                      href="https://escoladasaude.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-700 dark:text-violet-300 underline hover:no-underline"
                    >
                      escoladasaude.vercel.app
                    </a>
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" aria-hidden="true" />
                  <span><strong>Atendimento:</strong> Seg–Sex, 9h às 17h</span>
                </li>
              </ul>

              <div className="mt-5">
                <button
                  onClick={() => setOpenModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-violet-700 hover:bg-violet-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                >
                  <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
                  Abrir chamado agora
                </button>
              </div>
            </Card>
          </section>
        </div>
      </main>

      <Footer />

      {/* ===================== Modal: Abrir Chamado ===================== */}
      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Abrir chamado ao Suporte"
        labelledById="modal-abrir-chamado-title"
      >
        <FormAbrirChamado onSubmit={handleSubmitChamado} submitting={submitting} />
      </Modal>
    </div>
  );
}
