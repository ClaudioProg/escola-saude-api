// ✅ src/pages/usuario/Manual.jsx — fullscreen + responsivo + premium
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Printer,
  FileText,
  CalendarClock,
  Sparkles,
  ShieldCheck,
  ScanLine,
  GraduationCap,
  Info,
} from "lucide-react";
import Footer from "../../components/Footer";
import BotaoPrimario from "../../components/BotaoPrimario";

/* ───────────────────────────── Header Hero (gradiente exclusivo da página) ───────────────────────────── */
function HeaderHero({ onPrint }) {
  return (
    <header
      role="banner"
      className="relative bg-gradient-to-br from-sky-900 via-cyan-800 to-emerald-700 text-white print:hidden"
    >
      {/* Glow suave */}
      <div className="pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(60%_60%_at_50%_20%,black,transparent)]" />

      <div className="w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center text-center gap-5">
        <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wide">Guia Oficial</span>
        </div>

        <div className="inline-flex items-center gap-3">
          <BookOpen className="w-8 h-8" aria-hidden="true" />
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Manual do Usuário
          </h1>
        </div>

        <p className="text-sm sm:text-base text-white/90">
          Orientações sobre acesso, inscrições, presenças, avaliações e certificados digitais.
        </p>

        {/* Ministats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
          <StatCard icon={<FileText className="w-4 h-4" />} label="Seções" value="12" />
          <StatCard
            icon={<CalendarClock className="w-4 h-4" />}
            label="Última atualização"
            value="Jan/2026"
            tone="warning"
          />
          <StatCard
            icon={<Printer className="w-4 h-4" />}
            label="Versão"
            value="1.1"
            tone="success"
          />
          <StatCard icon={<BookOpen className="w-4 h-4" />} label="Páginas" value="1" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <BotaoPrimario
            onClick={onPrint}
            variante="secundario"
            icone={<Printer className="w-4 h-4" aria-hidden="true" />}
            aria-label="Imprimir manual"
          >
            Imprimir
          </BotaoPrimario>
        </div>
      </div>

      {/* Barra de navegação por chips (sticky) */}
      <nav
        aria-label="Seções do manual"
        className="sticky top-0 z-20 bg-gradient-to-r from-sky-950/90 via-cyan-900/90 to-emerald-900/90 backdrop-blur px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto print:hidden"
      >
        <TocChips />
      </nav>
    </header>
  );
}

/* Mini Card de Estatísticas */
function StatCard({ icon, label, value, tone = "default" }) {
  const tones = {
    default: "border-white/20 bg-white/10",
    success: "border-emerald-400/40 bg-white/10",
    warning: "border-amber-400/40 bg-white/10",
  };
  return (
    <div
      className={`rounded-2xl border ${tones[tone]} px-3 py-3 text-left backdrop-blur-sm w-full`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/80">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-1 font-bold text-lg">{value}</div>
    </div>
  );
}

/* Chips de navegação (TOC) */
const SECTIONS = [
  { id: "acesso", label: "Acesso" },
  { id: "cadastro", label: "Cadastro" },
  { id: "painel", label: "Painel" },
  { id: "cadastro-atualizacao", label: "Atualizar cadastro" },
  { id: "notificacoes", label: "Notificações" },
  { id: "faq", label: "Ajuda/FAQ" },
  { id: "inscricoes", label: "Inscrições" },
  { id: "acompanhamento", label: "Acompanhamento" },
  { id: "avaliacao", label: "Avaliação" },
  { id: "certificados", label: "Certificados" },
  { id: "qr", label: "Presença via QR" },
  { id: "seguranca", label: "Segurança" },
];

function TocChips() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex gap-2 whitespace-nowrap">
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all",
              isActive
                ? "bg-white text-cyan-900 ring-white"
                : "bg-white/10 text-white/90 ring-white/20 hover:bg-white/15",
            ].join(" ")}
          >
            <span>{s.label}</span>
          </a>
        );
      })}
    </div>
  );
}

/* Callout elegante */
function Callout({ icon, title, children, tone = "info" }) {
  const map = {
    info: "bg-sky-50 text-sky-900 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800",
    success:
      "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800",
    warning:
      "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800",
  };
  return (
    <div
      className={[
        "not-prose mt-4 rounded-2xl ring-1 p-4 flex items-start gap-3",
        map[tone],
      ].join(" ")}
    >
      <div className="mt-1">{icon}</div>
      <div>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Página Manual ───────────────────────────── */
export default function Manual() {
  useEffect(() => {
    document.title = "Manual do Usuário | Escola da Saúde";
  }, []);

  const [printed, setPrinted] = useState(false);

  const handlePrint = () => {
    window.print();
    setPrinted(true);
  };

  // Botão flutuante de impressão (mobile/desktop)
  const FloatPrint = useMemo(
    () => (
      <button
        onClick={handlePrint}
        className="print:hidden fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-3 shadow-lg ring-1 ring-white/10 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-white/60"
        aria-label="Imprimir manual"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">Imprimir</span>
      </button>
    ),
    []
  );

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Skip link para acessibilidade */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-40 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:ring-2"
      >
        Ir para o conteúdo
      </a>

      <HeaderHero onPrint={handlePrint} />

      {/* Conteúdo */}
      <main
        id="conteudo"
        role="main"
        className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 text-gray-700 dark:text-gray-300"
      >
        <p className="mb-6 font-semibold">
          <strong>Escola da Saúde – Secretaria Municipal de Saúde de Santos</strong>
        </p>

        <article
          className="
            prose dark:prose-invert max-w-none
            prose-headings:text-slate-900 dark:prose-headings:text-white
            prose-a:text-emerald-700 dark:prose-a:text-emerald-400
            leading-relaxed
            [--tw-prose-bullets:theme(colors.slate.400)]
          "
        >
          <section id="acesso" aria-labelledby="acesso_h">
            <h2 id="acesso_h" className="scroll-mt-24">1. 👤 Acesso à Plataforma</h2>
            <ul>
              <li>
                Acesse:{" "}
                <a
                  href="https://escoladasaude.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://escoladasaude.vercel.app
                </a>
              </li>
              <li>Realize login com CPF e senha cadastrados;</li>
              <li>Use “Esqueci minha senha” se precisar redefinir;</li>
              <li>Login via conta Google pode estar disponível.</li>
            </ul>
            <Callout
              icon={<ShieldCheck className="w-4 h-4" />}
              title="Dica de segurança"
              tone="info"
            >
              Evite usar computadores públicos. Ative a verificação por e-mail sempre que possível.
            </Callout>
          </section>

          <section id="cadastro" aria-labelledby="cadastro_h">
            <h2 id="cadastro_h" className="scroll-mt-24">2. 🆕 Cadastro de Novo Usuário</h2>
            <ol>
              <li>Na tela inicial, clique em “Criar Conta”;</li>
              <li>Preencha todos os campos obrigatórios;</li>
              <li>Verifique o CPF e e-mail antes de salvar;</li>
              <li>Clique em “Cadastrar”.</li>
            </ol>
            <p className="italic">
              Exemplo de nome correto: <strong>José Raimundo da Silva</strong> (não use caixa alta).
            </p>
          </section>

          <section id="painel" aria-labelledby="painel_h">
            <h2 id="painel_h" className="scroll-mt-24">3. 🏠 Painel do Usuário</h2>
            <p>Após login, o painel apresenta indicadores de desempenho:</p>
            <ul>
              <li>Eventos Concluídos;</li>
              <li>Eventos como Instrutor;</li>
              <li>Inscrições Ativas;</li>
              <li>Próximos Eventos;</li>
              <li>Certificados Emitidos;</li>
              <li>Média de Avaliação Recebida.</li>
            </ul>
            <p>📊 Gráficos de desempenho e frequência estão disponíveis no painel.</p>
          </section>

          <section id="cadastro-atualizacao" aria-labelledby="cadastro_atualizacao_h">
            <h2 id="cadastro_atualizacao_h" className="scroll-mt-24">4. 📝 Atualização de Cadastro</h2>
            <ol>
              <li>Abra o menu de perfil → “Atualizar Cadastro”;</li>
              <li>Edite os dados desejados e salve;</li>
              <li>Cadastre ou atualize sua assinatura digital (para instrutores).</li>
            </ol>
          </section>

          <section id="notificacoes" aria-labelledby="notificacoes_h">
            <h2 id="notificacoes_h" className="scroll-mt-24">5. 🔔 Notificações</h2>
            <ul>
              <li>Inscrições confirmadas;</li>
              <li>Liberação de avaliações;</li>
              <li>Certificados disponíveis;</li>
              <li>Alterações em eventos ou turmas.</li>
            </ul>
          </section>

          <section id="faq" aria-labelledby="faq_h">
            <h2 id="faq_h" className="scroll-mt-24">6. ❓ Ajuda / FAQ</h2>
            <ul>
              <li>Menu de perfil → Ajuda / FAQ;</li>
              <li>Perguntas frequentes sobre acesso, inscrições e certificados;</li>
              <li>Contato de suporte institucional disponível no FAQ.</li>
            </ul>
          </section>

          <section id="inscricoes" aria-labelledby="inscricoes_h">
            <h2 id="inscricoes_h" className="scroll-mt-24">7. 📋 Inscrições em Eventos</h2>
            <ol>
              <li>Menu Usuário → <strong>Eventos</strong>;</li>
              <li>Escolha o evento → “Ver Turmas” → “Inscrever-se”;</li>
              <li>O evento aparecerá em <strong>Meus Cursos</strong>.</li>
            </ol>
            <Callout
              icon={<Info className="w-4 h-4" />}
              title="Importante"
              tone="warning"
            >
              Cada usuário pode se inscrever apenas uma vez por turma.
            </Callout>
          </section>

          <section id="acompanhamento" aria-labelledby="acompanhamento_h">
            <h2 id="acompanhamento_h" className="scroll-mt-24">8. 🕒 Acompanhamento de Inscrições</h2>
            <ul>
              <li>Acesse Usuário → Meus Cursos;</li>
              <li>
                Status exibidos:
                <ul>
                  <li>Programado – evento futuro;</li>
                  <li>Em andamento – curso em execução;</li>
                  <li>Encerrado – evento finalizado.</li>
                </ul>
              </li>
              <li>Adicione à Google Agenda via botão correspondente.</li>
            </ul>
          </section>

          <section id="avaliacao" aria-labelledby="avaliacao_h">
            <h2 id="avaliacao_h" className="scroll-mt-24">9. 📝 Avaliação do Evento</h2>
            <ol>
              <li>Após 75% de presença, receba notificação;</li>
              <li>Acesse Usuário → Avaliações Pendentes;</li>
              <li>Envie a avaliação para liberar o certificado.</li>
            </ol>
          </section>

          <section id="certificados" aria-labelledby="certificados_h">
            <h2 id="certificados_h" className="scroll-mt-24">10. 🎓 Emissão de Certificados</h2>
            <ul>
              <li>Frequência ≥ 75% e avaliação concluída;</li>
              <li>Usuário → Meus Certificados → “Gerar Certificado”;</li>
              <li>Baixe o PDF com QR Code de autenticação.</li>
            </ul>
            <p>📌 Instrutores recebem certificado com assinatura digital e destaque especial.</p>
          </section>

          <section id="qr" aria-labelledby="qr_h">
            <h2 id="qr_h" className="scroll-mt-24">11. ✅ Presença via QR Code</h2>
            <ol>
              <li>
                Menu Usuário → <strong>Escanear</strong>{" "}
                <ScanLine className="inline-block w-4 h-4 align-text-top" />
              </li>
              <li>Leia o QR Code da sala;</li>
              <li>A presença é registrada automaticamente.</li>
            </ol>
          </section>

          <section id="seguranca" aria-labelledby="seguranca_h">
            <h2 id="seguranca_h" className="scroll-mt-24">12. 🔒 Segurança e Validação</h2>
            <ul>
              <li>Certificados possuem QR Code único e verificável;</li>
              <li>Assinaturas digitais garantem autenticidade;</li>
              <li>O sistema segue a LGPD e protege dados pessoais.</li>
            </ul>
          </section>
        </article>
      </main>

      <Footer className="print:hidden" />

      {/* Botão flutuante */}
      {FloatPrint}

      {/* Estilos de impressão (utilizando utilitários Tailwind) */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: white !important; }
          a { color: black !important; text-decoration: underline; }
          /* remove cores de fundo pesadas no papel */
          .prose a { text-decoration: underline; }
        }
      `}</style>
    </div>
  );
}
