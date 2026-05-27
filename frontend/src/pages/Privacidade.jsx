// 📁 src/pages/Privacidade.jsx
// Atualizado em: 15/05/2026
//
// Plataforma Escola da Saúde — v2.0
//
// Página:
// - Política de Privacidade.
//
// Função:
// - Informar usuários sobre coleta, uso, armazenamento, segurança,
//   compartilhamento, direitos, retenção e contato institucional.
//
// Diretrizes v2.0:
// - sem Footer antigo;
// - sem useEscolaTheme;
// - sem ThemeTogglePills;
// - sem controle local de tema;
// - tema global via escola_theme/boot-theme;
// - dark mode via classe global;
// - UX/UI premium real;
// - mobile-first;
// - acessível;
// - motion safe.

import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Ban,
  ChevronRight,
  ClipboardList,
  Clock,
  Database,
  FileText,
  LockKeyhole,
  Mail,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import Footer from "../components/layout/Footer";

/* =========================================================================
   Helpers
=========================================================================== */

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* =========================================================================
   UI local
=========================================================================== */

function Badge({ icon: Icon, children, tone = "glass" }) {
  const tones = {
    glass: "border-white/15 bg-white/10 text-white",
    ok: "border-emerald-200/30 bg-emerald-300/15 text-emerald-50",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur",
        tones[tone] || tones.glass
      )}
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function HeaderHero() {
  return (
    <header
      className="relative isolate overflow-hidden text-white"
      role="banner"
      aria-label="Cabeçalho da Política de Privacidade"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-800 to-cyan-700"
        aria-hidden="true"
      />
      <div
        className="absolute -left-28 -top-28 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.10] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.65)_1px,transparent_0)] [background-size:18px_18px]"
        aria-hidden="true"
      />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white/20 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-9 sm:px-6 md:py-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white/90 backdrop-blur">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Portal oficial • transparência e proteção de dados
          </div>

          <div className="mt-4 inline-flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 backdrop-blur">
              <ShieldCheck className="h-7 w-7 text-white" aria-hidden="true" />
            </span>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Política de Privacidade
            </h1>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/88 sm:text-base">
            Como cuidamos dos seus dados e garantimos segurança, transparência e responsabilidade no uso da Plataforma Escola da Saúde.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Badge icon={FileText}>Atualizado em 15/05/2026</Badge>
            <Badge icon={ShieldCheck} tone="ok">
              LGPD • boas práticas
            </Badge>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px bg-white/25"
        aria-hidden="true"
      />
    </header>
  );
}

function MiniStat({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/65">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-5 text-slate-950 dark:text-white">
            {title}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

function TocLink({ href, label }) {
  return (
    <a
      href={href}
      className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/65 dark:text-zinc-100 dark:hover:bg-white/5"
    >
      <span className="flex min-w-0 items-center gap-2">
        <ChevronRight className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:translate-x-0.5 dark:text-emerald-300" />
        <span className="truncate">{label}</span>
      </span>

      <span className="ml-3 text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Ver
      </span>
    </a>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      <h3 className="text-lg font-black text-slate-950 dark:text-white">
        {children}
      </h3>
    </div>
  );
}

/* =========================================================================
   Página
=========================================================================== */

export default function Privacidade() {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.title = "Política de Privacidade | Escola da Saúde";
  }, []);

  const anim = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.3 },
    }),
    [reduceMotion]
  );

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-white text-slate-950 transition-colors dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      <HeaderHero />

      <section
        id="conteudo"
        role="main"
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
        aria-label="Conteúdo da Política de Privacidade"
      >
        <section
          aria-labelledby="confianca"
          className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
        >
          <h2 id="confianca" className="sr-only">
            Compromissos de privacidade
          </h2>

          <MiniStat
            icon={Database}
            title="Coleta mínima"
            desc="Somente dados necessários para inscrições, presença, certificação e gestão institucional."
          />

          <MiniStat
            icon={LockKeyhole}
            title="Acesso restrito"
            desc="Controles técnicos e administrativos para proteger dados pessoais e registros da plataforma."
          />

          <MiniStat
            icon={Ban}
            title="Sem venda de dados"
            desc="Não comercializamos informações pessoais nem utilizamos dados para fins comerciais."
          />
        </section>

        <motion.section {...anim} className="mb-6">
          <div
            className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/65 md:p-6"
            aria-label="Sumário"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-slate-950 dark:text-white sm:text-lg">
                  Sumário
                </h2>

                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                  Acesse rapidamente os tópicos principais da política.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TocLink href="#coleta" label="Coleta e uso de dados" />
                  <TocLink href="#seguranca" label="Armazenamento e segurança" />
                  <TocLink href="#compartilhamento" label="Compartilhamento" />
                  <TocLink href="#direitos" label="Direitos do usuário" />
                  <TocLink href="#retencao" label="Retenção e prazos" />
                  <TocLink href="#contato" label="Contato" />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.article
          {...anim}
          className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/65 md:p-8"
          aria-labelledby="titulo-privacidade"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <h2
                id="titulo-privacidade"
                className="text-xl font-black text-emerald-800 dark:text-emerald-200 sm:text-2xl md:text-3xl"
              >
                Política de Privacidade
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-base">
                A Escola Municipal de Saúde Pública de Santos respeita sua privacidade e está comprometida em proteger seus dados pessoais, observando a legislação aplicável, a finalidade institucional da plataforma e boas práticas de segurança.
              </p>
            </div>
          </div>

          <section className="mt-7 space-y-7 text-zinc-800 dark:text-zinc-200">
            <div id="coleta" className="scroll-mt-28">
              <SectionTitle icon={UserRound}>Coleta e uso de dados</SectionTitle>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed sm:text-base">
                <li>
                  Coletamos apenas dados necessários ao funcionamento da plataforma, como nome, CPF, e-mail, celular, unidade, cargo, inscrições, presenças, avaliações e certificados.
                </li>
                <li>
                  Os dados são utilizados para gerenciar inscrições, registrar presenças, emitir certificados, enviar comunicações institucionais, organizar ações educacionais e apoiar a gestão administrativa.
                </li>
                <li>
                  Registros técnicos, como logs de acesso e ações administrativas, podem ser utilizados para segurança, auditoria, diagnóstico e melhoria contínua do serviço.
                </li>
              </ul>
            </div>

            <div id="seguranca" className="scroll-mt-28">
              <SectionTitle icon={LockKeyhole}>Armazenamento e segurança</SectionTitle>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed sm:text-base">
                <li>
                  Os dados são armazenados em ambiente controlado, com acesso restrito conforme perfil e necessidade institucional.
                </li>
                <li>
                  São adotadas medidas técnicas e administrativas para reduzir riscos de acesso não autorizado, perda, vazamento, alteração indevida ou uso inadequado.
                </li>
                <li>
                  A plataforma utiliza controles de autenticação, autorização, logs administrativos, rastreabilidade e boas práticas de proteção operacional.
                </li>
              </ul>
            </div>

            <div id="compartilhamento" className="scroll-mt-28">
              <SectionTitle icon={Share2}>Compartilhamento</SectionTitle>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed sm:text-base">
                <li>
                  Não vendemos dados pessoais nem compartilhamos informações para fins comerciais.
                </li>
                <li>
                  Dados podem ser compartilhados internamente com setores autorizados da Administração Pública, quando necessário para finalidade institucional legítima.
                </li>
                <li>
                  Poderemos fornecer dados quando houver obrigação legal, solicitação administrativa legítima, ordem judicial ou necessidade de auditoria.
                </li>
                <li>
                  Quando aplicável, o compartilhamento deve observar o mínimo necessário para a finalidade pretendida.
                </li>
              </ul>
            </div>

            <div id="direitos" className="scroll-mt-28">
              <SectionTitle icon={ShieldCheck}>Direitos do usuário</SectionTitle>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed sm:text-base">
                <li>
                  Acessar, corrigir ou atualizar seus dados pessoais, quando aplicável.
                </li>
                <li>
                  Solicitar informações sobre o tratamento dos dados, observadas as limitações legais e administrativas.
                </li>
                <li>
                  Solicitar exclusão ou revisão de dados, quando possível, considerando obrigações legais de guarda, histórico institucional, certificados, presenças e registros administrativos.
                </li>
              </ul>
            </div>

            <div id="retencao" className="scroll-mt-28">
              <SectionTitle icon={Clock}>Retenção e prazos</SectionTitle>

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed sm:text-base">
                <li>
                  Dados serão mantidos pelo tempo necessário ao cumprimento das finalidades institucionais, educacionais, administrativas e legais.
                </li>
                <li>
                  Registros ligados a certificados, presenças, avaliações, inscrições e auditoria podem ser preservados para fins de comprovação, validação pública, prestação de contas e rastreabilidade.
                </li>
              </ul>
            </div>

            <div id="contato" className="scroll-mt-28">
              <SectionTitle icon={Mail}>Contato</SectionTitle>

              <p className="mt-2 text-sm leading-relaxed sm:text-base">
                Em caso de dúvidas sobre esta Política de Privacidade ou sobre o uso dos seus dados na Plataforma Escola da Saúde, entre em contato pelo e-mail{" "}
                <strong className="font-black text-slate-950 dark:text-white">
                  escoladasaude@santos.sp.gov.br
                </strong>
                .
              </p>
            </div>
          </section>

          <div className="mt-8 flex flex-col gap-2 sm:flex-row">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-700 px-4 py-2 text-sm font-black text-emerald-800 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-500/50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar para a página inicial
            </a>

            <a
              href="#conteudo"
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-zinc-200 dark:hover:bg-white/5"
              aria-label="Voltar ao topo do conteúdo"
            >
              <span>Ir para o topo</span>
              <ChevronRight className="h-4 w-4 -rotate-90" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
            Esta página tem finalidade informativa. Ajustes podem ocorrer para refletir atualizações institucionais, técnicas, operacionais ou legais.
          </div>
        </motion.article>
      </section>

      <Footer />
    </main>
  );
}