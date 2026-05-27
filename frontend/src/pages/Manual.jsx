// ✅ frontend/src/pages/Manual.jsx — v2.1
// Atualizado em: 26/05/2026

import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  HelpCircle,
  Info,
  LockKeyhole,
  Mail,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Footer from "../components/layout/Footer";

const SECTIONS = [
  ["acesso", "Acesso"],
  ["cadastro", "Cadastro"],
  ["painel", "Painel"],
  ["evento", "Eventos"],
  ["inscricao", "Inscrições"],
  ["presenca", "Presença"],
  ["avaliacao", "Avaliações"],
  ["certificado", "Certificados"],
  ["mensagem", "Mensagens"],
  ["reserva", "Reservas"],
  ["curso", "Cursos online"],
  ["seguranca", "Segurança"],
  ["faq", "FAQ"],
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
      {children}
    </span>
  );
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100",
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100",
  };

  return (
    <div className={cx("rounded-3xl border p-4", tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-75">
          {label}
        </p>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
        <ChevronRight className="h-5 w-5 text-emerald-600" />
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

function Callout({ icon: Icon = Info, title, children, tone = "info" }) {
  const tones = {
    info: "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100",
  };

  return (
    <div className={cx("rounded-2xl border p-4", tones[tone])}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">{title}</p>
          <div className="mt-1 text-sm leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Manual() {
  const [busca, setBusca] = useState("");

  useEffect(() => {
    document.title = "Manual do Usuário | Escola da Saúde";
  }, []);

  const sections = SECTIONS.filter(([, label]) =>
    label.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-amber-200 bg-gradient-to-r from-yellow-200 via-amber-200 to-orange-200 p-8 shadow-sm dark:border-amber-900/60 dark:from-amber-950 dark:via-zinc-900 dark:to-emerald-950">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/45 ring-1 ring-white/70">
                <BookOpen className="h-7 w-7 text-slate-950 dark:text-white" />
              </span>
              <div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  Manual do Usuário
                </h1>
                <p className="mt-2 text-base font-medium text-slate-800 dark:text-zinc-200">
                  Guia completo para utilizar a Plataforma Escola da Saúde.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-800 print:hidden"
            >
              <Printer className="h-4 w-4" />
              Imprimir manual
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex flex-wrap gap-2">
            <Badge>Versão 2.1</Badge>
            <Badge>Atualizado em maio/2026</Badge>
            <Badge>Usuário</Badge>
            <Badge>Web e impressão</Badge>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={BookOpen} label="Seções" value="13" tone="violet" />
            <Stat icon={CheckCircle2} label="Fluxos" value="12" tone="emerald" />
            <Stat icon={ShieldCheck} label="Segurança" value="LGPD" tone="cyan" />
            <Stat icon={FileCheck2} label="Formato" value="PDF" tone="amber" />
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 print:hidden">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar seção do manual..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:border-white/10 dark:bg-zinc-950 dark:text-white"
              />
            </label>

            <nav className="flex max-w-full gap-2 overflow-x-auto" aria-label="Seções do manual">
              {sections.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-emerald-950/30"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </section>

        <div className="mt-6 space-y-5">
          <Section id="acesso" title="1. Acesso à Plataforma">
            <p>
              A Plataforma Escola da Saúde é acessada pelo navegador. O usuário deve utilizar CPF e senha cadastrados ou,
              quando disponível, autenticação por conta Google institucional.
            </p>
            <ul className="list-disc pl-5">
              <li>Abra o endereço oficial da plataforma.</li>
              <li>Informe CPF e senha.</li>
              <li>Confira se o acesso foi realizado no seu próprio perfil.</li>
              <li>Ao finalizar, use a opção de sair da conta.</li>
            </ul>
            <Callout icon={LockKeyhole} title="Atenção ao acesso" tone="warning">
              Não compartilhe senha. A conta é pessoal e pode registrar inscrições, presenças, avaliações e certificados.
            </Callout>
          </Section>

          <Section id="cadastro" title="2. Cadastro e atualização de dados">
            <p>
              O cadastro deve conter dados corretos, pois eles podem ser usados em inscrições, certificados, listas de
              presença, relatórios institucionais e comunicação oficial.
            </p>
            <ul className="list-disc pl-5">
              <li>Preencha nome completo, CPF, e-mail, telefone e dados institucionais.</li>
              <li>Use e-mail válido, pois avisos e confirmações podem ser enviados por ele.</li>
              <li>Revise o nome antes de salvar, evitando abreviações indevidas ou letras trocadas.</li>
              <li>Mantenha unidade, cargo/função e vínculo atualizados quando solicitados.</li>
            </ul>
            <Callout icon={UserRound} title="Certificado depende dos dados" tone="info">
              Dados incorretos podem aparecer em documentos, listas ou certificados. Corrija antes de concluir inscrições.
            </Callout>
          </Section>

          <Section id="painel" title="3. Painel inicial">
            <p>
              O painel reúne atalhos e avisos importantes. Ele pode exibir eventos disponíveis, inscrições, notificações,
              certificados, pesquisas abertas, cursos online, pendências e comunicações institucionais.
            </p>
            <ul className="list-disc pl-5">
              <li>Verifique cards de próximos eventos.</li>
              <li>Acompanhe pendências pós-curso.</li>
              <li>Confira notificações recentes.</li>
              <li>Acesse pesquisas abertas quando aparecerem no painel.</li>
            </ul>
          </Section>

          <Section id="evento" title="4. Eventos, turmas e informações do curso">
            <p>
              Cada evento pode ter uma ou mais turmas. Antes de se inscrever, confira título, descrição, público-alvo,
              local, datas, horários, carga horária e regras específicas.
            </p>
            <ul className="list-disc pl-5">
              <li>Leia a descrição completa do evento.</li>
              <li>Confira se a turma corresponde à data desejada.</li>
              <li>Observe se há limite de vagas.</li>
              <li>Verifique se o evento exige presença mínima, avaliação ou questionário.</li>
            </ul>
          </Section>

          <Section id="inscricao" title="5. Inscrição e cancelamento">
            <p>
              A inscrição confirma o interesse do usuário em participar de uma turma. Quando houver conflito de data,
              lotação ou regra de público-alvo, a plataforma poderá impedir a inscrição.
            </p>
            <ul className="list-disc pl-5">
              <li>Acesse a página de eventos.</li>
              <li>Escolha a turma correta.</li>
              <li>Clique em inscrever-se.</li>
              <li>Acompanhe o status da inscrição no painel ou na área de eventos.</li>
              <li>Se não puder comparecer, cancele dentro do prazo disponível.</li>
            </ul>
            <Callout icon={Info} title="Responsabilidade do usuário" tone="warning">
              Inscrever-se e não comparecer pode prejudicar a ocupação das vagas e o planejamento da Escola da Saúde.
            </Callout>
          </Section>

          <Section id="presenca" title="6. Registro de presença">
            <p>
              A presença pode ser registrada por QR Code, por confirmação do instrutor/organizador ou por validação
              administrativa, conforme regra do evento.
            </p>
            <ul className="list-disc pl-5">
              <li>Quando houver QR Code, leia o código no horário e local indicados.</li>
              <li>Permita o uso da câmera no navegador.</li>
              <li>Aguarde a confirmação na tela.</li>
              <li>Em caso de dificuldade, procure o responsável pela turma.</li>
            </ul>
            <Callout icon={QrCode} title="QR Code" tone="info">
              O QR Code é vinculado à turma. Não utilize prints antigos nem códigos enviados fora do contexto do evento.
            </Callout>
          </Section>

          <Section id="avaliacao" title="7. Avaliações e questionários">
            <p>
              Após o evento, a plataforma pode liberar avaliação de reação, questionário, quiz ou outra etapa obrigatória.
              Essas etapas podem ser requisito para liberação do certificado.
            </p>
            <ul className="list-disc pl-5">
              <li>Verifique pendências no painel ou em “Meus certificados”.</li>
              <li>Responda dentro do prazo informado.</li>
              <li>Leia as perguntas com atenção antes de enviar.</li>
              <li>Após enviar, confira se a pendência foi concluída.</li>
            </ul>
          </Section>

          <Section id="certificado" title="8. Certificados">
            <p>
              O certificado pode ser liberado quando o usuário cumprir as regras do evento: presença mínima, avaliação
              concluída, questionário respondido e demais critérios definidos.
            </p>
            <ul className="list-disc pl-5">
              <li>Acesse a área “Meus certificados”.</li>
              <li>Verifique certificados disponíveis e pendências.</li>
              <li>Use o botão de download para baixar o PDF.</li>
              <li>Confira número do certificado e código de validação.</li>
            </ul>
            <Callout icon={FileCheck2} title="Validação pública" tone="success">
              Certificados podem conter QR Code e código de validação para conferência de autenticidade.
            </Callout>
          </Section>

          <Section id="mensagem" title="9. Mensagens institucionais">
            <p>
              A caixa de mensagens permite enviar dúvidas, sugestões ou solicitações para a equipe administrativa. As
              respostas podem ser acompanhadas dentro da própria plataforma.
            </p>
            <ul className="list-disc pl-5">
              <li>Escolha um assunto objetivo.</li>
              <li>Descreva a dúvida com clareza.</li>
              <li>Informe evento, turma ou certificado quando o assunto depender disso.</li>
              <li>Acompanhe a resposta na área de mensagens.</li>
            </ul>
            <Callout icon={Mail} title="Boa prática" tone="info">
              Quanto mais completo o relato, mais rápido a equipe consegue analisar e responder.
            </Callout>
          </Section>

          <Section id="reserva" title="10. Reserva de espaços">
            <p>
              Quando disponível, o usuário pode solicitar reserva de auditório ou sala de reunião. A reserva depende de
              análise administrativa e respeito às regras de uso.
            </p>
            <ul className="list-disc pl-5">
              <li>Escolha sala, data, período e finalidade.</li>
              <li>Informe quantidade estimada de pessoas.</li>
              <li>Aceite o termo de uso quando solicitado.</li>
              <li>Acompanhe se a solicitação foi aprovada, rejeitada ou cancelada.</li>
            </ul>
            <Callout icon={CalendarDays} title="Confirmação obrigatória" tone="warning">
              Entre 7 dias e 48 horas antes da data reservada, o usuário deve confirmar se realmente utilizará o espaço.
              A ausência de confirmação pode gerar cancelamento da reserva.
            </Callout>
          </Section>

          <Section id="curso" title="11. Cursos online">
            <p>
              A área de cursos online reúne links, vídeos e materiais digitais disponibilizados pela Escola da Saúde.
              Esses conteúdos podem complementar capacitações presenciais ou divulgar atividades permanentes.
            </p>
            <ul className="list-disc pl-5">
              <li>Acesse “Cursos online” no menu.</li>
              <li>Escolha o conteúdo desejado.</li>
              <li>Abra o link oficial indicado.</li>
              <li>Observe se há orientação adicional ou material complementar.</li>
            </ul>
          </Section>

          <Section id="seguranca" title="12. Segurança, privacidade e uso responsável">
            <p>
              A plataforma trabalha com dados pessoais e registros institucionais. Por isso, o usuário deve agir com
              cuidado e manter seus dados protegidos.
            </p>
            <ul className="list-disc pl-5">
              <li>Não compartilhe senha.</li>
              <li>Não utilize conta de outra pessoa.</li>
              <li>Confira seus dados antes de emitir documentos.</li>
              <li>Não divulgue QR Codes de presença fora do evento.</li>
              <li>Em computador compartilhado, sempre saia da conta.</li>
            </ul>
            <Callout icon={ShieldCheck} title="Proteção de dados" tone="success">
              Dados pessoais devem ser tratados com responsabilidade, finalidade institucional e respeito à privacidade.
            </Callout>
          </Section>

          <Section id="faq" title="13. Perguntas frequentes">
            <p className="font-black">Não consigo acessar. O que fazer?</p>
            <p>Confira CPF e senha. Se necessário, use “Esqueci minha senha”.</p>

            <p className="font-black">Minha inscrição não aparece.</p>
            <p>Atualize a página e confira se você está no perfil correto. Se persistir, envie mensagem à administração.</p>

            <p className="font-black">Participei do curso, mas não vejo certificado.</p>
            <p>Verifique presença, avaliação e demais pendências. O certificado só aparece quando as regras forem cumpridas.</p>

            <p className="font-black">O QR Code não funcionou.</p>
            <p>Confirme se a câmera foi autorizada, se o QR Code é da turma correta e se está dentro do período permitido.</p>

            <p className="font-black">Meus dados estão errados no certificado.</p>
            <p>Atualize o cadastro e entre em contato com a administração para análise do caso.</p>

            <Callout icon={HelpCircle} title="Ainda precisa de ajuda?" tone="info">
              Use a caixa de mensagens ou procure a equipe da Escola da Saúde com o máximo de informações possível.
            </Callout>
          </Section>
        </div>
      </main>

      <Footer className="print:hidden" />
    </div>
  );
}