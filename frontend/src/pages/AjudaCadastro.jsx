// ✅ src/pages/AjudaCadastro.jsx
import Footer from "../components/Footer";
import { HelpCircle } from "lucide-react";

/* ───────────────── HeaderHero (paleta fixa desta página) ─────────────────
   Regras aplicadas:
   • Ícone e título na MESMA linha
   • Paleta exclusiva (3 cores) para a página de ajuda
   • Skip-link para acessibilidade
   • Nada de repetir o título grande no conteúdo
--------------------------------------------------------------------------- */
function HeaderHero() {
  // Paleta fixa (3 cores) para Ajuda → amarelos/ambar
  const gradient = "from-amber-900 via-amber-700 to-yellow-600";

  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      {/* Skip-link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <HelpCircle className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Central de Ajuda — Cadastro de Novo Usuário
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Passo a passo para criar sua conta na Plataforma Escola da Saúde.
        </p>
      </div>
    </header>
  );
}

export default function AjudaCadastro() {
  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero />

      <main
        id="conteudo"
        role="main"
        className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1"
      >
        <article className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6 md:p-8">
          {/* Mantemos estrutura sem repetir o título grande do cabeçalho */}
          <h2 className="sr-only">Instruções de cadastro</h2>

          <p className="text-zinc-700 dark:text-zinc-300">
            Siga as orientações abaixo para criar sua conta.
          </p>

          <ol className="list-decimal pl-5 mt-6 space-y-3 text-zinc-800 dark:text-zinc-200">
            <li>
              Na <strong>tela inicial</strong>, clique em <strong>“Criar Conta”</strong>.
            </li>
            <li>
              <strong>Preencha todos os campos obrigatórios</strong>:
              <ul className="list-none pl-0 mt-2 space-y-1">
                <li>Nome completo</li>
                <li>CPF</li>
                <li>E-mail</li>
                <li>Senha (com maiúsculas/minúsculas, números e símbolo)</li>
                <li>Unidade de vínculo</li>
                <li>Outras informações solicitadas (data de nascimento, gênero, cargo, escolaridade etc.)</li>
              </ul>
            </li>
            <li>
              <strong>Confira seus dados</strong> antes de enviar — principalmente{" "}
              <strong>CPF</strong> e <strong>e-mail</strong>, pois serão usados para login e
              recuperação de senha.
            </li>
            <li>
              Clique em <strong>Cadastrar</strong> para finalizar.
            </li>
          </ol>

          <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Observação importante</p>
            <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
              Digite o nome completo com apenas a primeira letra de cada palavra em maiúsculo.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-300/60 bg-white dark:bg-zinc-900 px-3 py-2">
                ✅ Exemplo correto: <span className="font-medium">José Raimundo da Silva</span>
              </div>
              <div className="rounded-lg border border-red-300/60 bg-white dark:bg-zinc-900 px-3 py-2 space-y-1">
                <div>❌ Não use tudo em maiúsculas: <span className="font-medium">JOSÉ RAIMUNDO DA SILVA</span></div>
                <div>❌ Não use tudo em minúsculas: <span className="font-medium">josé raimundo da silva</span></div>
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Perguntas frequentes
            </h3>

            <details className="mt-4 rounded-lg border border-gray-200 dark:border-zinc-700">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Não recebi o e-mail de confirmação. O que faço?
              </summary>
              <div className="px-4 pb-4 pt-2 text-zinc-700 dark:text-zinc-300">
                Verifique a pasta de spam/lixo eletrônico. Se não encontrar, tente reenviar a confirmação
                pela tela de login. Confirme se digitou o e-mail corretamente.
              </div>
            </details>

            <details className="mt-3 rounded-lg border border-gray-200 dark:border-zinc-700">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Erro com CPF já cadastrado
              </summary>
              <div className="px-4 pb-4 pt-2 text-zinc-700 dark:text-zinc-300">
                Se o sistema informar CPF já cadastrado e você não lembra a senha, use{" "}
                <strong>“Esqueci minha senha”</strong>.
              </div>
            </details>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 border border-amber-700 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:border-amber-400"
            >
              Voltar para a página inicial
            </a>
            <a
              href="/cadastro"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-amber-700 text-white hover:bg-amber-800"
            >
              Ir para o cadastro
            </a>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
