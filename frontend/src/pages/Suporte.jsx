// src/pages/Suporte.jsx
import Breadcrumbs from "../components/Breadcrumbs";

export default function Suporte() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <Breadcrumbs trilha={[{ label: "Início" }, { label: "Suporte" }]} />

      <h1 className="text-3xl font-bold mb-6 text-lousa dark:text-white text-center">
        🛠️ Central de Suporte
      </h1>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">❓ Perguntas Frequentes (FAQ)</h2>
        <div className="space-y-3">
          <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
            <summary className="cursor-pointer font-medium">Como recebo meu certificado?</summary>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Você pode acessar a aba <strong>“Certificados”</strong> no seu painel e fazer o download em PDF após atingir 75% de presença no evento.
            </p>
          </details>

          <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
            <summary className="cursor-pointer font-medium">O QR Code do certificado é válido?</summary>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Sim. O QR Code aponta para a página oficial de validação da Escola da Saúde. Qualquer pessoa pode verificar a autenticidade.
            </p>
          </details>

          <details className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
            <summary className="cursor-pointer font-medium">Posso alterar minha assinatura depois de salvar?</summary>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Sim. No seu painel, clique em <strong>“Cadastrar/Alterar Assinatura”</strong> para modificar sua assinatura digital.
            </p>
          </details>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">📜 Orientações sobre Certificados</h2>
        <ul className="list-disc list-inside text-sm space-y-2 text-gray-700 dark:text-gray-300">
          <li>Certificados são emitidos apenas com 75% ou mais de presença.</li>
          <li>Verifique seu e-mail e CPF antes de se inscrever em eventos.</li>
          <li>O nome no certificado é o mesmo cadastrado no seu perfil. Mantenha-o atualizado.</li>
          <li>Certificados digitais possuem QR Code para validação pública.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">📞 Contatos Úteis</h2>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>
            💌 <strong>Email:</strong> escoladesaude@santos.sp.gov.br
          </li>
          <li>
            ☎️ <strong>Telefone:</strong> (13) 3213-5000 - R. 5331
          </li>
          <li>
            🌐 <strong>Site:</strong>{" "}
            <a
              href="https://escoladesaude.santos.br"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 dark:text-blue-400 underline"
            >
              escoladesaude.santos.br
            </a>
          </li>
          <li>
            🕐 <strong>Horário de atendimento:</strong> Segunda a sexta, das 9h às 17h
          </li>
        </ul>
      </section>
    </main>
  );
}
