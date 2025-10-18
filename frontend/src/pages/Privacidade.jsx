// ✅ src/pages/Privacidade.jsx (refactor com HeaderHero 3 cores, mini-stats e a11y)
import { motion } from "framer-motion";
import {
  ShieldCheck,
  LockKeyhole,
  Ban,
  Database,
  FileText,
  Mail,
  ArrowLeft,
} from "lucide-react";
import Footer from "../components/Footer";

function HeaderHero() {
  return (
    <header className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-700 text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(52% 60% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 md:py-12 min-h-[150px] sm:min-h-[180px] text-center flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Política de Privacidade
          </h1>
        </div>
        <p className="text-sm sm:text-base text-white/90">
          Como cuidamos dos seus dados e garantimos sua segurança e transparência.
        </p>
        <div className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-xs sm:text-sm">
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Atualizado em 10/2025</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

function MiniStat({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-0.5">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mini-stats de confiança */}
        <section
          aria-labelledby="confianca"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6"
        >
          <h2 id="confianca" className="sr-only">Compromissos de privacidade</h2>
          <MiniStat
            icon={Database}
            title="Coleta mínima"
            desc="Somente dados necessários para inscrições, presença e certificação."
          />
          <MiniStat
            icon={LockKeyhole}
            title="Acesso restrito"
            desc="Controles técnicos e administrativos para proteger seus dados."
          />
          <MiniStat
            icon={Ban}
            title="Sem venda de dados"
            desc="Nunca comercializamos suas informações pessoais."
          />
        </section>

        {/* Conteúdo principal */}
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 md:p-8"
          aria-labelledby="titulo-privacidade"
        >
          <h2
            id="titulo-privacidade"
            className="text-xl sm:text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-200"
          >
            Política de Privacidade
          </h2>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            A Escola Municipal de Saúde de Santos respeita sua privacidade e está comprometida em
            proteger seus dados pessoais.
          </p>

          <section className="mt-6 space-y-6 text-zinc-800 dark:text-zinc-200">
            <div>
              <h3 className="text-lg font-semibold">Coleta e uso de dados</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  Coletamos apenas o necessário para o funcionamento da plataforma
                  (ex.: nome, CPF, e-mail, unidade, presenças, certificados).
                </li>
                <li>
                  Usamos seus dados para gerenciar inscrições/presenças, emitir certificados e enviar
                  comunicações institucionais.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Armazenamento e segurança</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Dados armazenados em ambiente seguro, com acesso controlado.</li>
                <li>
                  Medidas técnicas e administrativas para prevenir acesso não autorizado, perda ou
                  alteração de dados.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Compartilhamento</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Não vendemos dados nem compartilhamos para fins comerciais.</li>
                <li>Podemos fornecer dados quando exigido por lei ou obrigação legal.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Direitos do usuário</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Acessar, corrigir ou atualizar seus dados pessoais.</li>
                <li>
                  Solicitar exclusão da conta (observadas obrigações de guarda previstas em lei).
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold">Contato</h3>
              <p className="mt-2">
                Em caso de dúvidas, fale com a equipe pelo e-mail{" "}
                <a
                  href="mailto:escoladasaude@santos.sp.gov.br"
                  className="underline decoration-emerald-600 decoration-2 underline-offset-2 hover:opacity-90"
                >
                  escoladasaude@santos.sp.gov.br
                </a>.
              </p>
            </div>
          </section>

          <div className="mt-8 flex flex-wrap gap-2">
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-400"
              aria-label="Voltar para a página inicial"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para a página inicial
            </a>
            <a
              href="mailto:escoladasaude@santos.sp.gov.br"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white"
              aria-label="Entrar em contato por e-mail"
            >
              <Mail className="w-4 h-4" />
              Entrar em contato
            </a>
          </div>
        </motion.article>
      </main>

      <Footer />
    </div>
  );
}
