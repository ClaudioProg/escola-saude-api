// ✅ src/pages/Privacidade.jsx
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";

export default function Privacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-900">
      <PageHeader titulo="Política de Privacidade" subtitulo="Como cuidamos dos seus dados" />

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-700 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-emerald-900 dark:text-emerald-200">
            Política de Privacidade
          </h1>
          <p className="mt-3 text-zinc-700 dark:text-zinc-300">
            A Escola Municipal de Saúde de Santos respeita sua privacidade e está comprometida em proteger seus dados pessoais.
          </p>

          <section className="mt-6 space-y-6 text-zinc-800 dark:text-zinc-200">
            <div>
              <h2 className="text-xl font-semibold">Coleta e uso de dados</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Coletamos apenas informações necessárias para o funcionamento da plataforma (ex.: nome, CPF, e-mail, unidade, presenças, certificados).</li>
                <li>Usamos seus dados para gerenciar inscrições/presenças, emitir certificados e enviar comunicações institucionais.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold">Armazenamento e segurança</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Os dados são armazenados em ambiente seguro, com acesso restrito.</li>
                <li>Adotamos medidas técnicas e administrativas para prevenir acessos não autorizados, perdas ou alterações.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold">Compartilhamento</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Não vendemos nem compartilhamos dados com terceiros para fins comerciais.</li>
                <li>Dados podem ser fornecidos quando exigido por lei ou para cumprir obrigações legais.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold">Direitos do usuário</h2>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Acessar, corrigir ou atualizar seus dados pessoais.</li>
                <li>Solicitar exclusão da conta (salvo guarda obrigatória por lei/regulação).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold">Contato</h2>
              <p className="mt-2">
                Em caso de dúvidas sobre privacidade ou tratamento de dados, entre em contato pelo e-mail institucional da Escola da Saúde.
              </p>
            </div>
          </section>

          <div className="mt-8">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-400"
            >
              Voltar para a página inicial
            </a>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
