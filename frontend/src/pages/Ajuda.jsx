// ✅ frontend/src/pages/Ajuda.jsx — v2.3
// Atualizado em: 26/05/2026
//
// Plataforma Escola da Saúde
// Central única de ajuda ao usuário.
// Suporte.jsx foi descontinuado: dúvidas específicas devem ir para Mensagens.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  HelpCircle,
  Info,
  Keyboard,
  MailQuestion,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

import Footer from "../components/layout/Footer";

const CHIPS_BUSCA = [
  "certificado",
  "presença",
  "avaliação",
  "login",
  "inscrição",
  "turma",
  "senha",
  "dados",
  "reserva",
  "curso",
];

const FAQ_ITEMS = [
  {
    pergunta: "Como faço login na plataforma?",
    resposta:
      "Acesse a tela inicial, informe seu CPF e senha cadastrados e clique em entrar. Caso tenha esquecido a senha, utilize a opção de recuperação disponível na tela de login.",
    tags: ["login", "senha", "acesso"],
  },
  {
    pergunta: "Esqueci minha senha. O que devo fazer?",
    resposta:
      "Clique em “Esqueci minha senha”, informe os dados solicitados e siga as orientações para redefinição. Use um e-mail válido e confira sua caixa de entrada e spam.",
    tags: ["senha", "login", "acesso"],
  },
  {
    pergunta: "Como atualizo meus dados cadastrais?",
    resposta:
      "Acesse seu perfil ou área de cadastro, revise nome, e-mail, telefone, unidade, cargo/função e demais dados solicitados. Salve as alterações antes de realizar inscrições ou emitir certificados.",
    tags: ["dados", "cadastro", "perfil"],
  },
  {
    pergunta: "Por que meus dados precisam estar corretos?",
    resposta:
      "Os dados cadastrais podem ser usados em inscrições, listas de presença, relatórios institucionais e certificados. Nome, CPF e e-mail incorretos podem prejudicar a emissão ou validação de documentos.",
    tags: ["dados", "cadastro", "certificado"],
  },
  {
    pergunta: "Como faço inscrição em um evento?",
    resposta:
      "Acesse a área de eventos, escolha o evento desejado, confira turma, data, horário, local, público-alvo e vagas disponíveis. Depois clique em inscrever-se, quando a opção estiver liberada.",
    tags: ["inscrição", "evento", "turma"],
  },
  {
    pergunta: "Não consigo me inscrever em uma turma. Por quê?",
    resposta:
      "A inscrição pode estar bloqueada por lotação, encerramento do prazo, conflito de horário, público-alvo restrito ou regra específica do evento. Confira as informações da turma antes de tentar novamente.",
    tags: ["inscrição", "turma", "evento"],
  },
  {
    pergunta: "Como cancelo uma inscrição?",
    resposta:
      "Quando permitido, o cancelamento aparece na área do evento ou nas suas inscrições. Caso o prazo tenha encerrado ou a opção não esteja disponível, envie uma dúvida pela área de Mensagens.",
    tags: ["inscrição", "cancelamento", "evento"],
  },
  {
    pergunta: "Como confirmo minha presença?",
    resposta:
      "A presença pode ser registrada por QR Code, confirmação do organizador/instrutor ou validação administrativa, conforme a regra do evento. Siga a orientação dada no dia da turma.",
    tags: ["presença", "qr", "turma"],
  },
  {
    pergunta: "O QR Code de presença não funcionou. O que fazer?",
    resposta:
      "Verifique se a câmera foi autorizada, se o QR Code é da turma correta e se a leitura está sendo feita no período permitido. Persistindo o problema, avise o responsável pela turma.",
    tags: ["presença", "qr", "erro"],
  },
  {
    pergunta: "Participei do curso, mas minha presença não aparece.",
    resposta:
      "A presença pode depender de processamento ou validação do responsável. Confira a turma correta e aguarde a atualização. Se persistir, envie mensagem informando evento, turma e data.",
    tags: ["presença", "turma", "evento"],
  },
  {
    pergunta: "Quando a avaliação fica disponível?",
    resposta:
      "A avaliação normalmente é liberada após o encerramento da turma, conforme a configuração do evento. Em alguns casos, ela pode ser requisito para liberação do certificado.",
    tags: ["avaliação", "evento", "certificado"],
  },
  {
    pergunta: "Preciso responder avaliação para receber certificado?",
    resposta:
      "Em muitos eventos, sim. O certificado pode depender de presença mínima, avaliação concluída, questionário respondido ou outras regras definidas pela Escola da Saúde.",
    tags: ["avaliação", "certificado", "questionário"],
  },
  {
    pergunta: "Como acesso meus certificados?",
    resposta:
      "Acesse a área de certificados ou “Meus certificados”. Ali você verá certificados liberados, pendências e informações como número, código de validação e download do PDF.",
    tags: ["certificado", "pdf", "download"],
  },
  {
    pergunta: "Meu certificado não aparece. O que pode ser?",
    resposta:
      "Verifique se cumpriu presença mínima, avaliação, questionário e demais critérios do evento. Também confira se a turma já foi encerrada e processada pela administração.",
    tags: ["certificado", "presença", "avaliação"],
  },
  {
    pergunta: "Como validar um certificado?",
    resposta:
      "Use o código de validação ou QR Code presente no certificado. A validação pública confirma a autenticidade do documento emitido pela plataforma.",
    tags: ["certificado", "validação", "qr"],
  },
  {
    pergunta: "Meus dados saíram errados no certificado.",
    resposta:
      "Atualize seu cadastro e envie uma mensagem para a administração informando o problema, o evento, a turma e, se houver, o número ou código de validação do certificado.",
    tags: ["certificado", "dados", "cadastro"],
  },
  {
    pergunta: "Como faço reserva de sala ou auditório?",
    resposta:
      "Acesse a área de reserva, escolha espaço, data, período, finalidade e quantidade estimada de pessoas. A solicitação dependerá de análise administrativa.",
    tags: ["reserva", "sala", "auditório"],
  },
  {
    pergunta: "Preciso confirmar a reserva?",
    resposta:
      "Sim. Entre 7 dias e 48 horas antes da data reservada, o usuário deve confirmar se realmente utilizará o espaço. A falta de confirmação pode gerar cancelamento.",
    tags: ["reserva", "confirmação", "sala"],
  },
  {
    pergunta: "Onde vejo cursos online?",
    resposta:
      "Acesse a área de cursos online no menu. Ela reúne links, vídeos e materiais oficiais ou autorizados pela Escola da Saúde.",
    tags: ["curso", "online", "material"],
  },
  {
    pergunta: "Como envio uma dúvida específica?",
    resposta:
      "Use a área de Mensagens. Informe o assunto com clareza e inclua evento, turma, data, certificado ou print quando isso ajudar a administração a entender o caso.",
    tags: ["mensagem", "dúvida", "suporte"],
  },
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizarBusca(value) {
  return String(value || "").trim().slice(0, 80);
}

function normalizarTexto(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function criarSearchUrl(pathname, search, q) {
  const params = new URLSearchParams(search || "");
  const termo = normalizarBusca(q);

  if (termo) params.set("q", termo);
  else params.delete("q");

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function Card({ children, className = "" }) {
  return (
    <section
      className={cx(
        "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70 sm:p-6",
        className
      )}
    >
      {children}
    </section>
  );
}

function InfoCard({ icon: Icon, title, children, tone = "amber" }) {
  const tones = {
    amber:
      "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    cyan:
      "border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900/60 dark:bg-cyan-950/25 dark:text-cyan-100",
  };

  return (
    <div className={cx("rounded-2xl border p-4", tones[tone])}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-black">{title}</p>
          <div className="mt-1 text-sm leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ item }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition open:bg-white dark:border-white/10 dark:bg-zinc-950/70 dark:open:bg-zinc-950">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span className="text-sm font-black text-slate-950 dark:text-white">
          {item.pergunta}
        </span>

        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180 dark:text-zinc-400" />
      </summary>

      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-zinc-300">
        {item.resposta}
      </p>
    </details>
  );
}

export default function Ajuda() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const liveRef = useRef(null);

  const initialQ = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("q") || "";
  }, [location.search]);

  const [q, setQ] = useState(initialQ);

  const termoBusca = useMemo(() => normalizarBusca(q), [q]);

  const perguntasFiltradas = useMemo(() => {
    const termo = normalizarTexto(termoBusca);

    if (!termo) return FAQ_ITEMS;

    return FAQ_ITEMS.filter((item) => {
      const conteudo = normalizarTexto(
        `${item.pergunta} ${item.resposta} ${(item.tags || []).join(" ")}`
      );

      return conteudo.includes(termo);
    });
  }, [termoBusca]);

  useEffect(() => {
    document.title = "Ajuda | Escola da Saúde";
  }, []);

  useEffect(() => {
    const atual = `${location.pathname}${location.search || ""}`;
    const nova = criarSearchUrl(location.pathname, location.search, termoBusca);

    if (nova !== atual) navigate(nova, { replace: true });
  }, [termoBusca, navigate, location.pathname, location.search]);

  useEffect(() => {
    const handler = (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const digitando = ["input", "textarea", "select"].includes(tag);

      if (event.key === "/" && !digitando) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!liveRef.current) return;

    if (!termoBusca) {
      liveRef.current.textContent = "Busca limpa.";
      return;
    }

    liveRef.current.textContent = `${perguntasFiltradas.length} pergunta(s) encontrada(s) para ${termoBusca}.`;
  }, [termoBusca, perguntasFiltradas.length]);

  const dicaBusca = useMemo(() => {
    if (!termoBusca) {
      return "Pesquise por certificado, presença, avaliação, login, inscrição, senha ou turma.";
    }

    if (perguntasFiltradas.length === 0) {
      return `Nenhuma pergunta encontrada para “${termoBusca}”. Tente outra palavra-chave.`;
    }

    return `${perguntasFiltradas.length} pergunta(s) encontrada(s) para “${termoBusca}”.`;
  }, [termoBusca, perguntasFiltradas.length]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-amber-200 bg-gradient-to-r from-yellow-200 via-amber-200 to-orange-200 p-8 shadow-sm dark:border-amber-900/60 dark:from-amber-950 dark:via-zinc-900 dark:to-emerald-950">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/45 ring-1 ring-white/70">
              <HelpCircle className="h-7 w-7 text-slate-950 dark:text-white" />
            </span>

            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/35 px-3 py-1 text-xs font-black text-slate-800 ring-1 ring-white/60 dark:text-zinc-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Central oficial
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Ajuda
              </h1>

              <p className="mt-2 max-w-3xl text-base font-medium text-slate-800 dark:text-zinc-200">
                Consulte respostas rápidas, orientações de uso e caminhos seguros
                para resolver dúvidas na Plataforma Escola da Saúde.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/manual"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-emerald-800"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Ver manual
          </Link>

          <Link
            to="/mensagem"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
          >
            <MailQuestion className="h-4 w-4" aria-hidden="true" />
            Enviar dúvida
          </Link>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                ref={inputRef}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar dúvida, tema ou palavra-chave..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-20 text-sm font-semibold outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 dark:border-white/10 dark:bg-zinc-950 dark:text-white dark:focus:ring-amber-950/40"
                autoComplete="off"
                inputMode="search"
                aria-describedby="ajuda-dica"
              />

              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Limpar
                </button>
              ) : null}
            </label>

            <div className="flex max-w-full gap-2 overflow-x-auto">
              {CHIPS_BUSCA.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setQ(chip)}
                  className={cx(
                    "whitespace-nowrap rounded-full border px-3 py-2 text-xs font-black transition",
                    normalizarTexto(termoBusca) === normalizarTexto(chip)
                      ? "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            <span id="ajuda-dica">
              {dicaBusca} Pressione{" "}
              <kbd className="rounded border border-slate-300 px-1 dark:border-zinc-700">
                /
              </kbd>{" "}
              para focar a busca.
            </span>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <aside className="space-y-5">
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </span>

                <div>
                  <h2 className="text-lg font-black">Como usar esta página</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    Primeiro pesquise no FAQ. Se precisar de orientação completa,
                    acesse o Manual. Para dúvida específica, use a caixa de
                    mensagens.
                  </p>
                </div>
              </div>
            </Card>

            <InfoCard icon={BookOpen} title="Manual do Usuário" tone="amber">
              O manual reúne o passo a passo da plataforma: login, cadastro,
              eventos, inscrições, presença, avaliações, certificados, reservas
              e cursos online.
            </InfoCard>

            <InfoCard icon={MailQuestion} title="Dúvida específica" tone="cyan">
              A antiga página de suporte foi removida. Use a área de Mensagens
              para enviar dúvidas e acompanhar respostas.
            </InfoCard>

            <InfoCard icon={ShieldCheck} title="Segurança" tone="emerald">
              Nunca compartilhe senha, QR Code de presença ou acesso de outro
              usuário. Certificados e presenças são registros institucionais.
            </InfoCard>
          </aside>

          <Card className="shadow-xl">
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
              </span>

              <div>
                <h2 className="text-xl font-black">Perguntas frequentes</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
                  Respostas rápidas para os principais fluxos da Plataforma
                  Escola da Saúde.
                </p>
              </div>
            </div>

            {perguntasFiltradas.length > 0 ? (
              <div className="space-y-3">
                {perguntasFiltradas.map((item) => (
                  <FaqItem key={item.pergunta} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-zinc-950/60">
                <p className="font-black text-slate-900 dark:text-white">
                  Nada encontrado para “{termoBusca}”.
                </p>
                <p className="mt-1 text-slate-600 dark:text-zinc-300">
                  Tente termos como certificado, presença, inscrição, login,
                  senha ou avaliação.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Footer className="print:hidden" />
    </main>
  );
}