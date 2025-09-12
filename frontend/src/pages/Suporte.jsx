// 📁 src/pages/Suporte.jsx
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { HelpCircle } from "lucide-react";

export default function Suporte() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 🟪 Faixa superior de título */}
      <PageHeader title="Central de Suporte" icon={HelpCircle} variant="violeta" />

      <main role="main" className="flex-1 max-w-3xl mx-auto px-4 py-8 bg-gelo dark:bg-zinc-900 text-black dark:text-white">
        <Breadcrumbs trilha={[{ label: "Início" }, { label: "Suporte" }]} />

        {/* FAQ */}
        <section className="mb-10" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-semibold mb-4">❓ Perguntas Frequentes (FAQ)</h2>
          <div className="space-y-3">
            <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
              <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                Como recebo meu certificado?
              </summary>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Você pode acessar a aba <strong>“Certificados”</strong> no seu painel e fazer o download em PDF após atingir 75% de presença no evento.
              </p>
            </details>

            <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
              <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                O QR Code do certificado é válido?
              </summary>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Sim. O QR Code aponta para a página oficial de validação da Escola da Saúde. Qualquer pessoa pode verificar a autenticidade.
              </p>
            </details>

            <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
              <summary className="cursor-pointer font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded">
                Posso alterar minha assinatura depois de salvar?
              </summary>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Sim. Para o instrutor, no seu painel, clique em <strong>“Cadastrar/Alterar Assinatura”</strong> para modificar sua assinatura digital.
              </p>
            </details>
          </div>
        </section>

        {/* Orientações */}
        <section className="mb-10" aria-labelledby="orientacoes-heading">
          <h2 id="orientacoes-heading" className="text-xl font-semibold mb-4">📜 Orientações sobre Certificados</h2>
          <ul className="list-disc list-inside text-sm space-y-2 text-gray-700 dark:text-gray-300">
            <li>Certificados são emitidos apenas com 75% ou mais de presença.</li>
            <li>Verifique seu e-mail e CPF antes de se inscrever em eventos.</li>
            <li>O nome no certificado é o mesmo cadastrado no seu perfil. Mantenha-o atualizado.</li>
            <li>Certificados digitais possuem QR Code para validação pública.</li>
          </ul>
        </section>

        {/* Contatos */}
        <section aria-labelledby="contatos-heading">
          <h2 id="contatos-heading" className="text-xl font-semibold mb-4">📞 Contatos Úteis</h2>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>💌 <strong>Email:</strong> escoladasaude@santos.sp.gov.br</li>
            <li>☎️ <strong>Telefone:</strong> (13) 3213-5000 - R. 5331</li>
            <li>
              🌐 <strong>Site:</strong>{" "}
              <a
                href="https://escoladasaude.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-400 underline hover:no-underline"
              >
                escoladasaude.vercel.app
              </a>
            </li>
            <li>🕐 <strong>Horário de atendimento:</strong> Segunda a sexta, das 9h às 17h</li>
          </ul>
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
