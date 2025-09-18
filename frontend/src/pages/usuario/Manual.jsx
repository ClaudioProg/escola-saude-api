// 📁 src/pages/usuario/Manual.jsx
import { BookOpen } from "lucide-react";
import Breadcrumbs from "../../components/Breadcrumbs";
import PageHeader from "../../components/PageHeader";
import Footer from "../../components/Footer";

export default function Manual() {
  return (
    <>
      {/* Header padrão da aplicação */}
      <PageHeader
        icon={BookOpen}
        title="Manual do Usuário"
        subtitle="Plataforma de Certificados"
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Breadcrumbs
          items={[
            { label: "Usuário", href: "/usuario" },
            { label: "Manual", href: "/usuario/manual" },
          ]}
        />

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          <strong>Escola da Saúde – Secretaria Municipal de Saúde de Santos</strong>
        </p>

        {/* 
          ⚙️ Tipografia:
          - Remove marcadores e recuos de <ul>/<ol>
          - Mantém o restante do estilo da classe `prose`
        */}
        <article
          className="
            prose dark:prose-invert max-w-none
            prose-headings:text-lousa dark:prose-headings:text-white
            prose-a:text-teal-700 dark:prose-a:text-teal-400
            prose-ul:list-none prose-ol:list-none
            prose-li:pl-0 prose-li:marker:content-['']
            [&_ul]:ml-0 [&_ol]:ml-0 [&_li]:ml-0
            [&_ul>li]:mb-1 [&_ol>li]:mb-1
          "
        >
          <p>
            A Plataforma de Certificados é um sistema oficial desenvolvido para gerenciar eventos,
            inscrições, presenças, avaliações e emissão de certificados digitais. Este manual tem como
            objetivo orientar o usuário em todas as etapas de utilização.
          </p>

          <h2>1. 👤 Acesso à Plataforma</h2>
          <ul>
            <li>
              Acesse pelo endereço:{" "}
              <a href="https://escoladasaude.vercel.app" target="_blank" rel="noopener noreferrer">
                https://escoladasaude.vercel.app
              </a>
            </li>
            <li>Realize login utilizando CPF e senha cadastrados;</li>
            <li>
              Em caso de esquecimento de senha, clique em “Esqueci minha senha” e siga as instruções
              enviadas ao seu e-mail cadastrado;
            </li>
            <li>O sistema também pode disponibilizar login com conta Google (quando habilitado).</li>
          </ul>

          <h2>2. 🆕 Cadastro de Novo Usuário</h2>
          <ol>
            <li>Na tela inicial, clique em “Criar Conta”;</li>
            <li>
              Preencha todos os campos obrigatórios (nome completo, CPF, e-mail, senha, telefone,
              unidade de vínculo, etc.);
            </li>
            <li>
              Certifique-se de inserir informações corretas, especialmente CPF e e-mail, pois serão
              utilizados para login e recuperação de acesso;
            </li>
            <li>Clique em “Cadastrar”.</li>
          </ol>
          <p className="italic">
            Observação: Nome Completo deve ser digitado assim:{" "}
            <strong>José Raimundo da Silva</strong>. E não:{" "}
            <strong>JOSÉ RAIMUNDO DA SILVA</strong>.
          </p>

          <h2>3. 🏠 Painel do Usuário</h2>
          <p>Após o login, será exibido o Painel do Usuário (Dashboard), contendo indicadores:</p>
          <ul>
            <li>Eventos Concluídos (em que participou com presença registrada);</li>
            <li>Eventos como Instrutor (caso atue como preceptor/palestrante);</li>
            <li>Inscrições em Andamento;</li>
            <li>Próximos Eventos;</li>
            <li>Certificados Emitidos;</li>
            <li>Média de Avaliação Recebida (para usuários que atuam como instrutores).</li>
          </ul>
          <p>📊 Também são exibidos gráficos visuais de desempenho, frequência e avaliações recebidas.</p>

          <h2>4. 📝 Atualização de Cadastro</h2>
          <ol>
            <li>Clique no ícone do perfil (canto superior direito);</li>
            <li>Selecione “Atualizar Cadastro”;</li>
            <li>Altere os dados desejados (nome, e-mail, senha, unidade);</li>
            <li>Clique em “Salvar Alterações”;</li>
            <li>
              Nesse mesmo campo é possível cadastrar ou atualizar sua assinatura digital, utilizada
              em certificados emitidos como instrutor.
            </li>
          </ol>

          <h2>5. 🔔 Notificações</h2>
          <ul>
            <li>Confirmação de inscrições;</li>
            <li>Liberação de avaliações pendentes;</li>
            <li>Certificados disponíveis;</li>
            <li>Alterações em eventos ou turmas.</li>
          </ul>
          <p>As notificações aparecem no sino do menu superior e também podem ser enviadas por e-mail.</p>

          <h2>6. ❓ Ajuda / FAQ</h2>
          <ul>
            <li>Acesse pelo menu de perfil → Ajuda / FAQ;</li>
            <li>
              Estão disponíveis respostas às perguntas mais frequentes sobre acesso, inscrições,
              presenças, avaliações e certificados;
            </li>
            <li>
              Em caso de dúvidas não solucionadas, entre em contato com o suporte institucional
              (informado no FAQ).
            </li>
          </ul>

          <h2>7. 📋 Inscrições em Eventos</h2>
          <ol>
            <li>
              No menu Usuário, clique em <strong>Eventos</strong>;
            </li>
            <li>Escolha o evento desejado e clique em “Ver Turmas”;</li>
            <li>Confira as turmas disponíveis e clique em “Inscrever-se”;</li>
            <li>
              A inscrição será confirmada, e o evento aparecerá em <strong>Meus Cursos</strong>.
            </li>
          </ol>
          <p>📌 Cada usuário pode se inscrever apenas uma vez por turma.</p>

          <h2>8. 🕒 Acompanhamento de Inscrições</h2>
          <ul>
            <li>Acesse Usuário → Meus Cursos;</li>
            <li>
              Visualize todas as turmas inscritas com os respectivos status:
              <ul>
                <li>Programado: evento ainda não iniciado;</li>
                <li>Em andamento: evento em curso;</li>
                <li>Encerrado: evento já finalizado.</li>
              </ul>
            </li>
            <li>É possível adicionar o evento diretamente ao Google Agenda pelo botão correspondente.</li>
          </ul>

          <h2>9. 📝 Avaliação do Evento</h2>
          <ol>
            <li>Após o término da turma, se atingir presença mínima de 75%, você receberá uma notificação;</li>
            <li>Acesse Usuário → Avaliações Pendentes;</li>
            <li>Preencha o formulário de avaliação;</li>
            <li>Somente após enviar a avaliação será liberada a emissão do certificado.</li>
          </ol>

          <h2>10. 🎓 Emissão de Certificados</h2>
          <p>Pré-requisitos para emissão:</p>
          <ul>
            <li>Frequência mínima de 75%;</li>
            <li>Avaliação do evento concluída.</li>
          </ul>
          <ol>
            <li>Acesse Usuário → Meus Certificados;</li>
            <li>Clique em “Gerar Certificado”;</li>
            <li>Após gerado, o botão mudará para “Baixar Certificado” (PDF);</li>
            <li>O certificado contém QR Code de autenticação para validação pública.</li>
          </ol>
          <p>📌 Instrutores recebem certificado específico, com destaque de sua função e assinatura digital.</p>

          <h2>11. ✅ Confirmação de Presença via QR Code</h2>
          <ol>
            <li>
              No menu Usuário, clique em <strong>Escanear</strong>;
            </li>
            <li>Aponte a câmera do celular para o QR Code fixado na sala;</li>
            <li>A leitura será automática e a presença registrada;</li>
            <li>
              Também é possível confirmar a presença manualmente (quando autorizado pelo
              administrador, em caso de falha técnica).
            </li>
          </ol>

          <h2>12. 🔒 Segurança e Validação</h2>
          <ul>
            <li>
              Todos os certificados possuem QR Code único que direciona para a página oficial de
              validação;
            </li>
            <li>
              A assinatura digital (quando cadastrada pelo instrutor) garante a autenticidade
              institucional;
            </li>
            <li>O sistema segue normas de LGPD, com proteção de dados pessoais.</li>
          </ul>
        </article>
      </main>

      {/* Footer padrão da aplicação */}
      <Footer />
    </>
  );
}
