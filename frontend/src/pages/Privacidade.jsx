// ✅ src/pages/Privacidade.jsx — premium (kit base Escola) + a11y + motion safe + chips + “Sumário” + cards com ícones
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  LockKeyhole,
  Ban,
  Database,
  FileText,
  ArrowLeft,
  Sparkles,
  ClipboardList,
  UserRound,
  Share2,
  Clock,
  Mail,
  ChevronRight,
} from "lucide-react";
import Footer from "../components/Footer";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── helpers ───────── */
const cx = (...c) => c.filter(Boolean).join(" ");

function Badge({ icon: Icon, children, tone = "glass" }) {
  const tones = {
    glass: "bg-white/15 text-white",
    ok: "bg-emerald-500/15 text-emerald-50",
  };
  return (
    <span className={cx("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold", tones[tone])}>
      {Icon ? <Icon className="w-4 h-4" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ───────── HeaderHero premium ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner" aria-label="Cabeçalho da Política de Privacidade">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-700" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
      >
        Pular para o conteúdo
      </a>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* toggle */}
        <div className="lg:absolute lg:right-4 lg:top-6 flex justify-end">
          <ThemeTogglePills variant="glass" />
        </div>

        {/* conteúdo central */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="inline-flex items-center gap-2 text-white/90 text-xs font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Portal oficial • transparência e proteção de dados</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Política de Privacidade
          </h1>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Como cuidamos dos seus dados e garantimos segurança, transparência e responsabilidade.
          </p>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Badge icon={FileText}>Atualizado em 10/2025</Badge>
            <Badge icon={ShieldCheck} tone="ok">
              LGPD • boas práticas
            </Badge>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ───────── MiniStat ───────── */
function MiniStat({ icon: Icon, title, desc, isDark }) {
  return (
    <div
      className={cx(
        "rounded-2xl border p-5 transition-all",
        isDark ? "bg-zinc-900/50 border-white/10 hover:bg-white/5" : "bg-white border-zinc-200 shadow-sm hover:shadow-md"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cx(
            "shrink-0 rounded-xl p-2",
            isDark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-50 text-emerald-700"
          )}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-extrabold">{title}</p>
          <p className={cx("text-sm mt-0.5", isDark ? "text-zinc-300" : "text-zinc-600")}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Link do sumário ───────── */
function TocLink({ href, label, isDark }) {
  return (
    <a
      href={href}
      className={cx(
        "group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition-all",
        isDark
          ? "border-white/10 bg-zinc-900/45 hover:bg-white/5"
          : "border-zinc-200 bg-white hover:bg-slate-50 shadow-sm"
      )}
    >
      <span className={cx("flex items-center gap-2", isDark ? "text-zinc-100" : "text-slate-900")}>
        <ChevronRight className={cx("w-4 h-4 transition-transform group-hover:translate-x-0.5", isDark ? "text-emerald-300" : "text-emerald-700")} />
        {label}
      </span>
      <span className={cx("text-xs", isDark ? "text-zinc-400" : "text-slate-500")}>Ver</span>
    </a>
  );
}

/* ───────── Página ───────── */
export default function Privacidade() {
  const { theme, setTheme, isDark } = useEscolaTheme();
  const reduceMotion = useReducedMotion();

  const anim = useMemo(
    () => ({
      initial: reduceMotion ? false : { opacity: 0, y: 10 },
      animate: reduceMotion ? {} : { opacity: 1, y: 0 },
      transition: { duration: 0.35 },
    }),
    [reduceMotion]
  );

  return (
    <main
      className={cx(
        "min-h-screen flex flex-col transition-colors",
        isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900"
      )}
    >
      <HeaderHero theme={theme} setTheme={setTheme} isDark={isDark} />

      <section
        id="conteudo"
        role="main"
        className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
        aria-label="Conteúdo da Política de Privacidade"
      >
        {/* Mini-stats */}
        <section aria-labelledby="confianca" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <h2 id="confianca" className="sr-only">
            Compromissos de privacidade
          </h2>

          <MiniStat
            icon={Database}
            title="Coleta mínima"
            desc="Somente dados necessários para inscrições, presença e certificação."
            isDark={isDark}
          />
          <MiniStat
            icon={LockKeyhole}
            title="Acesso restrito"
            desc="Controles técnicos e administrativos para proteger seus dados."
            isDark={isDark}
          />
          <MiniStat
            icon={Ban}
            title="Sem venda de dados"
            desc="Nunca comercializamos suas informações pessoais."
            isDark={isDark}
          />
        </section>

        {/* Sumário */}
        <motion.section {...anim} className="mb-6">
          <div
            className={cx(
              "rounded-3xl border p-5 md:p-6",
              isDark ? "bg-zinc-900/55 border-white/10" : "bg-white border-zinc-200 shadow-sm"
            )}
            aria-label="Sumário"
          >
            <div className="flex items-start gap-3">
              <div className={cx("rounded-2xl p-2", isDark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-50 text-emerald-700")}>
                <ClipboardList className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h2 className="text-base sm:text-lg font-extrabold">Sumário</h2>
                <p className={cx("text-sm mt-0.5", isDark ? "text-zinc-300" : "text-zinc-600")}>
                  Acesse rapidamente os tópicos principais.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <TocLink href="#coleta" label="Coleta e uso de dados" isDark={isDark} />
                  <TocLink href="#seguranca" label="Armazenamento e segurança" isDark={isDark} />
                  <TocLink href="#compartilhamento" label="Compartilhamento" isDark={isDark} />
                  <TocLink href="#direitos" label="Direitos do usuário" isDark={isDark} />
                  <TocLink href="#retencao" label="Retenção e prazos" isDark={isDark} />
                  <TocLink href="#contato" label="Contato" isDark={isDark} />
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Conteúdo principal */}
        <motion.article
          {...anim}
          className={cx(
            "rounded-3xl border p-6 md:p-8",
            isDark ? "bg-zinc-900/55 border-white/10" : "bg-white border-zinc-200 shadow-sm"
          )}
          aria-labelledby="titulo-privacidade"
        >
          <div className="flex items-start gap-3">
            <div className={cx("rounded-2xl p-2", isDark ? "bg-emerald-900/30 text-emerald-300" : "bg-emerald-50 text-emerald-700")}>
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </div>

            <div className="flex-1">
              <h2
                id="titulo-privacidade"
                className="text-xl sm:text-2xl md:text-3xl font-extrabold text-emerald-800 dark:text-emerald-200"
              >
                Política de Privacidade
              </h2>

              <p className="mt-2 text-sm sm:text-base text-zinc-700 dark:text-zinc-300">
                A Escola Municipal de Saúde de Santos respeita sua privacidade e está comprometida em proteger seus dados pessoais,
                observando a legislação aplicável e boas práticas de segurança.
              </p>
            </div>
          </div>

          {/* Seções */}
          <section className="mt-6 space-y-6 text-zinc-800 dark:text-zinc-200">
            <div id="coleta" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <UserRound className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Coleta e uso de dados</h3>
              </div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm sm:text-base">
                <li>Coletamos apenas o necessário para o funcionamento da plataforma (ex.: nome, CPF, e-mail, unidade, presenças, certificados).</li>
                <li>Usamos seus dados para gerenciar inscrições, presenças, emitir certificados e enviar comunicações institucionais.</li>
                <li>Podemos utilizar registros técnicos (ex.: logs) para auditoria, segurança e melhoria contínua do serviço.</li>
              </ul>
            </div>

            <div id="seguranca" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <LockKeyhole className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Armazenamento e segurança</h3>
              </div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm sm:text-base">
                <li>Dados armazenados em ambiente seguro, com acesso controlado e segregação por perfis.</li>
                <li>Medidas técnicas e administrativas para prevenir acesso não autorizado, perda, vazamento ou alteração indevida.</li>
                <li>Práticas de proteção incluem monitoramento, backups e controles de autenticação e autorização.</li>
              </ul>
            </div>

            <div id="compartilhamento" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <Share2 className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Compartilhamento</h3>
              </div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm sm:text-base">
                <li>Não vendemos dados nem compartilhamos para fins comerciais.</li>
                <li>Poderemos fornecer dados quando exigido por lei, ordem judicial ou obrigação legal.</li>
                <li>Quando aplicável, o compartilhamento ocorre pelo mínimo necessário e com finalidade legítima.</li>
              </ul>
            </div>

            <div id="direitos" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <ShieldCheck className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Direitos do usuário</h3>
              </div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm sm:text-base">
                <li>Acessar, corrigir ou atualizar seus dados pessoais, quando aplicável.</li>
                <li>Solicitar informações sobre tratamento dos dados, observadas as limitações legais.</li>
                <li>Solicitar exclusão da conta (observadas obrigações legais de guarda e registros administrativos).</li>
              </ul>
            </div>

            <div id="retencao" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <Clock className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Retenção e prazos</h3>
              </div>
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm sm:text-base">
                <li>Manteremos dados pelo tempo necessário ao cumprimento de finalidades institucionais e obrigações legais.</li>
                <li>Registros ligados a certificados e presenças podem ser preservados para fins de auditoria e comprovação.</li>
              </ul>
            </div>

            <div id="contato" className="scroll-mt-24">
              <div className="flex items-center gap-2">
                <Mail className={cx("w-4 h-4", isDark ? "text-emerald-300" : "text-emerald-700")} aria-hidden="true" />
                <h3 className="text-lg font-extrabold">Contato</h3>
              </div>
              <p className="mt-2 text-sm sm:text-base">
                Em caso de dúvidas, entre em contato pelo e-mail{" "}
                <strong>escoladasaude@santos.sp.gov.br</strong>.
              </p>
            </div>
          </section>

          {/* CTA */}
          <div className="mt-8 flex flex-col sm:flex-row gap-2">
            <a
              href="/"
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border font-extrabold transition-all",
                isDark
                  ? "border-emerald-400/40 text-emerald-300 hover:bg-emerald-400/10"
                  : "border-emerald-700 text-emerald-800 hover:bg-emerald-50"
              )}
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar para a página inicial
            </a>

            <a
              href="#conteudo"
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-semibold transition-all",
                isDark ? "text-zinc-200 hover:bg-white/5" : "text-slate-700 hover:bg-slate-100"
              )}
              aria-label="Voltar ao topo do conteúdo"
            >
              <span>Ir para o topo</span>
              <ChevronRight className="w-4 h-4 rotate-[-90deg]" aria-hidden="true" />
            </a>
          </div>

          {/* rodapé pequeno */}
          <div className={cx("mt-6 text-xs", isDark ? "text-zinc-400" : "text-slate-500")}>
            <p>
              Esta página tem finalidade informativa. Ajustes podem ocorrer para refletir atualizações institucionais e legais.
            </p>
          </div>
        </motion.article>
      </section>

      <Footer />
    </main>
  );
}
