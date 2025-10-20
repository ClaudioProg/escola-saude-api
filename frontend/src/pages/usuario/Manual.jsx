// ✅ src/pages/usuario/Manual.jsx — fullscreen + responsivo
import { useEffect, useState } from "react";
import { BookOpen, Printer, FileText, CalendarClock } from "lucide-react";
import Footer from "../../components/Footer";
import BotaoPrimario from "../../components/BotaoPrimario";

/* ───────────────────────────── Header Hero ───────────────────────────── */
function HeaderHero({ onPrint }) {
  return (
    <header
      role="banner"
      className="bg-gradient-to-br from-violet-900 via-violet-700 to-fuchsia-700 text-white"
    >
      {/* 👇 Full width, sem max-w */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center gap-2">
          <BookOpen className="w-6 h-6" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Manual do Usuário
          </h1>
        </div>

        <p className="text-sm text-white/90 max-w-none">
          Orientações sobre acesso, inscrições, presenças, avaliações e certificados.
        </p>

        {/* mini stats no topo (grid fluida) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 w-full max-w-none">
          <StatCard icon={<FileText className="w-4 h-4" />} label="Seções" value="12" />
          <StatCard
            icon={<CalendarClock className="w-4 h-4" />}
            label="Última atualização"
            value="Outubro/2025"
            tone="warning"
          />
          <StatCard
            icon={<Printer className="w-4 h-4" />}
            label="Versão"
            value="1.0"
            tone="success"
          />
          <StatCard icon={<BookOpen className="w-4 h-4" />} label="Páginas" value="1" />
        </div>

        <BotaoPrimario
          onClick={onPrint}
          variante="secundario"
          icone={<Printer className="w-4 h-4" aria-hidden="true" />}
          aria-label="Imprimir manual"
        >
          Imprimir
        </BotaoPrimario>
      </div>
    </header>
  );
}

/* Mini Card de Estatísticas */
function StatCard({ icon, label, value, tone = "default" }) {
  const tones = {
    default: "border-white/20 bg-white/10",
    success: "border-emerald-400/50 bg-white/10",
    warning: "border-amber-400/50 bg-white/10",
  };
  return (
    <div
      className={`rounded-2xl border ${tones[tone]} px-3 py-3 text-left backdrop-blur-sm w-full`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-white/80">{label}</span>
        <span className="opacity-90">{icon}</span>
      </div>
      <div className="mt-1 font-bold text-lg">{value}</div>
    </div>
  );
}

/* ───────────────────────────── Página Manual ───────────────────────────── */
export default function Manual() {
  useEffect(() => {
    document.title = "Manual do Usuário | Escola da Saúde";
  }, []);

  const [printed, setPrinted] = useState(false);

  const handlePrint = () => {
    window.print();
    setPrinted(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 💜 Hero com degradê violeta */}
      <HeaderHero onPrint={handlePrint} />

      <main
        role="main"
        // 👇 Full width + respiro lateral; removidos max-w e mx-auto
        className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 text-gray-700 dark:text-gray-300"
      >
        <p className="mb-6 font-semibold">
          <strong>Escola da Saúde – Secretaria Municipal de Saúde de Santos</strong>
        </p>

        {/* Conteúdo acessível e responsivo */}
        <article
          className="
            prose dark:prose-invert max-w-none
            prose-headings:text-lousa dark:prose-headings:text-white
            prose-a:text-violet-700 dark:prose-a:text-violet-400
            prose-ul:list-none prose-ol:list-none
            prose-li:pl-0 prose-li:marker:content-['']
            [&_ul]:ml-0 [&_ol]:ml-0 [&_li]:ml-0
            [&_ul>li]:mb-1 [&_ol>li]:mb-1
            leading-relaxed text-justify
          "
        >
          <p>
            A <strong>Plataforma de Certificados</strong> é o sistema oficial da Escola da Saúde
            para gerenciamento de eventos, inscrições, presenças, avaliações e certificados digitais.
            Este manual orienta o usuário em todas as etapas de utilização do sistema.
          </p>

          <h2>1. 👤 Acesso à Plataforma</h2>
          <ul>
            <li>
              Acesse:{" "}
              <a href="https://escoladasaude.vercel.app" target="_blank" rel="noopener noreferrer">
                https://escoladasaude.vercel.app
              </a>
            </li>
            <li>Realize login com CPF e senha cadastrados;</li>
            <li>Use “Esqueci minha senha” se precisar redefinir;</li>
            <li>Login via conta Google pode estar disponível.</li>
          </ul>

          <h2>2. 🆕 Cadastro de Novo Usuário</h2>
          <ol>
            <li>Na tela inicial, clique em “Criar Conta”;</li>
            <li>Preencha todos os campos obrigatórios;</li>
            <li>Verifique o CPF e e-mail antes de salvar;</li>
            <li>Clique em “Cadastrar”.</li>
          </ol>
          <p className="italic">
            Exemplo de nome correto: <strong>José Raimundo da Silva</strong> (não use maiúsculas).
          </p>

          <h2>3. 🏠 Painel do Usuário</h2>
          <p>Após login, o painel apresenta indicadores de desempenho:</p>
          <ul>
            <li>Eventos Concluídos;</li>
            <li>Eventos como Instrutor;</li>
            <li>Inscrições Ativas;</li>
            <li>Próximos Eventos;</li>
            <li>Certificados Emitidos;</li>
            <li>Média de Avaliação Recebida.</li>
          </ul>
          <p>📊 Gráficos de desempenho e frequência estão disponíveis no painel.</p>

          <h2>4. 📝 Atualização de Cadastro</h2>
          <ol>
            <li>Abra o menu de perfil → “Atualizar Cadastro”;</li>
            <li>Edite os dados desejados e salve;</li>
            <li>Cadastre ou atualize sua assinatura digital (para instrutores).</li>
          </ol>

          <h2>5. 🔔 Notificações</h2>
          <ul>
            <li>Inscrições confirmadas;</li>
            <li>Liberação de avaliações;</li>
            <li>Certificados disponíveis;</li>
            <li>Alterações em eventos ou turmas.</li>
          </ul>

          <h2>6. ❓ Ajuda / FAQ</h2>
          <ul>
            <li>Menu de perfil → Ajuda / FAQ;</li>
            <li>Perguntas frequentes sobre acesso, inscrições e certificados;</li>
            <li>Contato de suporte institucional disponível no FAQ.</li>
          </ul>

          <h2>7. 📋 Inscrições em Eventos</h2>
          <ol>
            <li>Menu Usuário → <strong>Eventos</strong>;</li>
            <li>Escolha o evento → “Ver Turmas” → “Inscrever-se”;</li>
            <li>O evento aparecerá em <strong>Meus Cursos</strong>.</li>
          </ol>
          <p>📌 Cada usuário pode se inscrever apenas uma vez por turma.</p>

          <h2>8. 🕒 Acompanhamento de Inscrições</h2>
          <ul>
            <li>Acesse Usuário → Meus Cursos;</li>
            <li>
              Status exibidos:
              <ul>
                <li>Programado – evento futuro;</li>
                <li>Em andamento – curso em execução;</li>
                <li>Encerrado – evento finalizado.</li>
              </ul>
            </li>
            <li>Adicione à Google Agenda via botão correspondente.</li>
          </ul>

          <h2>9. 📝 Avaliação do Evento</h2>
          <ol>
            <li>Após 75% de presença, receba notificação;</li>
            <li>Acesse Usuário → Avaliações Pendentes;</li>
            <li>Envie a avaliação para liberar o certificado.</li>
          </ol>

          <h2>10. 🎓 Emissão de Certificados</h2>
          <ul>
            <li>Frequência ≥ 75% e avaliação concluída;</li>
            <li>Usuário → Meus Certificados → “Gerar Certificado”;</li>
            <li>Baixe o PDF com QR Code de autenticação.</li>
          </ul>
          <p>📌 Instrutores recebem certificado com assinatura digital e destaque especial.</p>

          <h2>11. ✅ Presença via QR Code</h2>
          <ol>
            <li>Menu Usuário → <strong>Escanear</strong>;</li>
            <li>Leia o QR Code da sala;</li>
            <li>A presença é registrada automaticamente.</li>
          </ol>

          <h2>12. 🔒 Segurança e Validação</h2>
          <ul>
            <li>Certificados possuem QR Code único e verificável;</li>
            <li>Assinaturas digitais garantem autenticidade;</li>
            <li>O sistema segue a LGPD e protege dados pessoais.</li>
          </ul>
        </article>
      </main>

      <Footer />
    </div>
  );
}
