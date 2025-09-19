// ✅ src/pages/AjudaCadastro.jsx
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

export default function AjudaCadastro() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900">
      <PageHeader titulo="Central de Ajuda" subtitulo="Cadastro de Novo Usuário" />

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-200">
            Cadastro de Novo Usuário
          </h1>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            Siga as orientações abaixo para criar sua conta na Plataforma Escola da Saúde.
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
              <strong>Confira seus dados</strong> antes de enviar — principalmente <strong>CPF</strong> e
              <strong> e-mail</strong>, pois serão usados para login e recuperação de senha.
            </li>
            <li>
              Clique em <strong>Cadastrar</strong> para finalizar.
            </li>
          </ol>

          <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
            <p className="font-semibold text-emerald-900 dark:text-emerald-200">Observação importante</p>
            <p className="mt-1 text-emerald-900/90 dark:text-emerald-200/90">
              Digite o nome completo com apenas a primeira letra de cada palavra em maiúsculo.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-300/60 bg-white dark:bg-zinc-900 px-3 py-2">
                ✅ Exemplo correto: <span className="font-medium">José Raimundo da Silva</span>
              </div>
              <div className="rounded-lg border border-red-300/60 bg-white dark:bg-zinc-900 px-3 py-2">
                ❌ Não use tudo em maiúsculas: <span className="font-medium">JOSÉ RAIMUNDO DA SILVA</span>
                ❌ Não use tudo em minúsculas: <span className="font-medium">josé raimundo da silva</span>
              </div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-200">Perguntas frequentes</h2>
            <details className="mt-4 rounded-lg border border-gray-200 dark:border-zinc-700">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Não recebi o e-mail de confirmação. O que faço?
              </summary>
              <div className="px-4 pb-4 pt-2 text-zinc-700 dark:text-zinc-300">
                Verifique a pasta de spam/lixo eletrônico. Se não encontrar, tente reenviar a confirmação pela tela de login.
                Confirme se digitou o e-mail corretamente.
              </div>
            </details>
            <details className="mt-3 rounded-lg border border-gray-200 dark:border-zinc-700">
              <summary className="cursor-pointer px-4 py-3 font-medium">
                Erro com CPF já cadastrado
              </summary>
              <div className="px-4 pb-4 pt-2 text-zinc-700 dark:text-zinc-300">
                Se o sistema informar CPF já cadastrado e você não lembra a senha, use <strong>“Esqueci minha senha”</strong>.
              </div>
            </details>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-400"
            >
              Voltar para a página inicial
            </a>
            <a
              href="/cadastro"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 bg-emerald-700 text-white hover:bg-emerald-800"
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
