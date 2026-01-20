// ✅ src/pages/TermosDeUso.jsx — premium (kit base Escola) + ajustes SPA/a11y/UX
// Melhorias aplicadas:
// - ✅ Voltar usando <Link> (evita reload da SPA)
// - ✅ Tipografia/legibilidade: espaçamento, largura de leitura, listas, “prose-like” sem plugin
// - ✅ Seção “Contato / Suporte” no final (padrão institucional)
// - ✅ Blocos com “cards” e destaque de alertas/pontos-chave
// - ✅ A11y: skip-link ok, headings coerentes, contrastes no dark
// - ✅ Mantém o ThemeTogglePills (glass) e gradiente exclusivo da página

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  FileSignature,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Gavel,
  ArrowLeft,
  Sparkles,
  Mail,
} from "lucide-react";
import Footer from "../components/Footer";

import useEscolaTheme from "../hooks/useEscolaTheme";
import ThemeTogglePills from "../components/ThemeTogglePills";

/* ───────── HeaderHero premium ───────── */
function HeaderHero({ theme, setTheme, isDark }) {
  return (
    <header className="relative overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-800" />
      {isDark && <div className="absolute inset-0 bg-black/35" />}

      {/* blobs */}
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
      <div className="absolute -bottom-28 -right-28 h-80 w-80 rounded-full bg-white/15 blur-3xl" />

      {/* skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50
                   rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow"
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
            <span>Portal oficial • regras de uso da plataforma</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Termos de Uso
          </h1>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Condições para utilização da plataforma da Escola Municipal de Saúde de Santos.
          </p>

          <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs">
            <FileSignature className="w-4 h-4" aria-hidden="true" />
            <span>Vigente a partir de 10/2025</span>
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
      className={[
        "rounded-2xl border p-5 transition-all",
        isDark
          ? "bg-zinc-900/50 border-white/10 hover:bg-white/5"
          : "bg-white border-zinc-200 shadow-sm hover:shadow-md",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "shrink-0 rounded-xl p-2",
            isDark ? "bg-indigo-900/30 text-indigo-300" : "bg-indigo-50 text-indigo-700",
          ].join(" ")}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold">{title}</p>
          <p className={["text-sm mt-0.5", isDark ? "text-zinc-300" : "text-zinc-600"].join(" ")}>
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Bloco de destaque ───────── */
function Callout({ icon: Icon, title, children, tone = "warn", isDark }) {
  const tones = {
    warn: isDark
      ? "bg-amber-900/20 border-amber-400/20 text-amber-100"
      : "bg-amber-50 border-amber-200 text-amber-900",
    info: isDark
      ? "bg-indigo-900/25 border-indigo-400/20 text-indigo-100"
      : "bg-indigo-50 border-indigo-200 text-indigo-900",
  };

  return (
    <div className={["rounded-2xl border p-4 sm:p-5", tones[tone] || tones.info].join(" ")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-extrabold">{title}</p>
          <div className={["mt-1 text-sm leading-6", isDark ? "text-zinc-100/90" : "text-amber-950"].join(" ")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Página ───────── */
export default function TermosDeUso() {
  const { theme, setTheme, isDark } = useEscolaTheme();

  const textCls = isDark ? "text-zinc-200" : "text-zinc-800";
  const mutedCls = isDark ? "text-zinc-300" : "text-zinc-700";

  return (
    <main
      className={[
        "min-h-screen flex flex-col transition-colors",
        isDark ? "bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100" : "bg-slate-50 text-slate-900",
      ].join(" ")}
    >
      <HeaderHero theme={theme} setTheme={setTheme} isDark={isDark} />

      <section
        id="conteudo"
        role="main"
        className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
      >
        {/* Mini-stats */}
        <section
          aria-labelledby="regras"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6"
        >
          <h2 id="regras" className="sr-only">
            Princípios de uso
          </h2>

          <MiniStat
            icon={UserCheck}
            title="Uso responsável"
            desc="A plataforma deve ser utilizada apenas para fins institucionais."
            isDark={isDark}
          />
          <MiniStat
            icon={ShieldCheck}
            title="Segurança"
            desc="O usuário é responsável pela confidencialidade de suas credenciais."
            isDark={isDark}
          />
          <MiniStat
            icon={Gavel}
            title="Base legal"
            desc="Uso regido pela legislação vigente e normas administrativas."
            isDark={isDark}
          />
        </section>

        {/* Conteúdo */}
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={[
            "rounded-3xl border p-6 md:p-8",
            isDark ? "bg-zinc-900/55 border-white/10" : "bg-white border-zinc-200 shadow-sm",
          ].join(" ")}
          aria-labelledby="titulo-termos"
        >
          <h2
            id="titulo-termos"
            className="text-xl sm:text-2xl md:text-3xl font-extrabold text-indigo-800 dark:text-indigo-200"
          >
            Termos e Condições de Uso
          </h2>

          <p className={["mt-3 text-sm sm:text-base leading-7", mutedCls].join(" ")}>
            Ao acessar e utilizar a plataforma da Escola Municipal de Saúde de Santos, o usuário declara
            estar de acordo com os termos e condições descritos a seguir.
          </p>

          <div className="mt-6 grid gap-3">
            <Callout icon={AlertTriangle} title="Importante" tone="warn" isDark={isDark}>
              Não compartilhe login e senha. Qualquer uso realizado com suas credenciais é de sua
              responsabilidade. Em caso de suspeita de acesso indevido, altere sua senha imediatamente.
            </Callout>
          </div>

          <section className={["mt-6 space-y-6", textCls].join(" ")}>
            <div>
              <h3 className="text-lg font-extrabold">1. Finalidade da plataforma</h3>
              <p className={["mt-2 leading-7", mutedCls].join(" ")}>
                A plataforma tem como finalidade o gerenciamento de cursos, eventos, inscrições, presenças,
                avaliações e emissão de certificados no âmbito das ações educacionais promovidas pela Escola
                Municipal de Saúde de Santos.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">2. Cadastro e responsabilidades</h3>
              <ul className={["list-disc pl-5 mt-2 space-y-2 leading-7", mutedCls].join(" ")}>
                <li>O usuário é responsável pela veracidade das informações fornecidas.</li>
                <li>É vedado o compartilhamento de login e senha.</li>
                <li>O uso indevido poderá resultar em bloqueio ou exclusão do acesso, conforme normas aplicáveis.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">3. Uso adequado</h3>
              <ul className={["list-disc pl-5 mt-2 space-y-2 leading-7", mutedCls].join(" ")}>
                <li>É proibido utilizar a plataforma para fins ilícitos ou não autorizados.</li>
                <li>Não é permitido inserir conteúdos falsos, ofensivos ou incompatíveis com a finalidade institucional.</li>
                <li>É proibida qualquer tentativa de violar a segurança, integridade ou disponibilidade do sistema.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">4. Disponibilidade do serviço</h3>
              <p className={["mt-2 leading-7", mutedCls].join(" ")}>
                A Escola Municipal de Saúde poderá realizar manutenções técnicas, suspensões temporárias ou
                atualizações sem aviso prévio, visando a melhoria contínua do serviço e a segurança da informação.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">5. Penalidades</h3>
              <p className={["mt-2 leading-7", mutedCls].join(" ")}>
                O descumprimento destes Termos poderá acarretar medidas administrativas, incluindo suspensão
                ou cancelamento do acesso, sem prejuízo das medidas legais cabíveis.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">6. Alterações dos termos</h3>
              <p className={["mt-2 leading-7", mutedCls].join(" ")}>
                Estes Termos de Uso poderão ser atualizados a qualquer tempo. Recomenda-se a leitura periódica
                desta página para ciência das eventuais alterações.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-extrabold">7. Contato</h3>
              <p className={["mt-2 leading-7", mutedCls].join(" ")}>
                Em caso de dúvidas sobre estes Termos, utilize a Central de Suporte ou entre em contato pelo e-mail{" "}
                <span className="inline-flex items-center gap-2 font-semibold text-indigo-800 dark:text-indigo-200">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  escoladasaude@santos.sp.gov.br
                </span>
                .
              </p>
            </div>
          </section>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Link
              to="/"
              className={[
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border font-extrabold",
                isDark
                  ? "border-indigo-400/40 text-indigo-200 hover:bg-indigo-400/10"
                  : "border-indigo-700 text-indigo-800 hover:bg-indigo-50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
              ].join(" ")}
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para a página inicial
            </Link>

            {/* CTA opcional para Suporte (se existir rota) */}
            <Link
              to="/suporte"
              className={[
                "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 font-extrabold",
                isDark
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "bg-indigo-700 hover:bg-indigo-800 text-white",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60",
              ].join(" ")}
              aria-label="Ir para a Central de Suporte"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Central de Suporte
            </Link>
          </div>
        </motion.article>
      </section>

      <Footer />
    </main>
  );
}
