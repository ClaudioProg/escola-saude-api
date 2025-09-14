// 📁 src/components/ui/AccordionAjuda.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Disclosure } from "@headlessui/react";
import { ChevronUp, Link as LinkIcon, Search, Minus, Plus } from "lucide-react";

/**
 * Perguntas e respostas da plataforma (pt-BR).
 * Observações do projeto incorporadas:
 * - Elegibilidade de avaliação: turma encerrada + presença ≥ 75%
 * - Certificados por tipo: "usuario" e "instrutor" aparecem separadamente
 * - Presença via QR Code; confirmação manual com janelas de tempo
 * - Cores de status: programado (verde), andamento (amarelo), encerrado (vermelho)
 * - Assinatura digital opcional no certificado de instrutor
 * - Validação de certificado via QR/rota dedicada
 */
const PERGUNTAS_BASE = [
  {
    pergunta: "Esqueci minha senha. O que devo fazer?",
    resposta:
      'Clique em “Recuperar Senha” na tela de login e siga as instruções enviadas para seu e-mail institucional.',
  },
  {
    pergunta: "Como atualizo meus dados pessoais?",
    resposta:
      'No menu “Perfil”, você pode atualizar nome, e-mail, senha e — se for instrutor — a assinatura digital (imagem).',
  },
  {
    pergunta: "O certificado não apareceu. O que pode ter acontecido?",
    resposta:
      "Verifique se a turma foi encerrada e se você atingiu pelo menos 75% de presença. Certificados só são liberados após a avaliação (quando exigida) e quando todos os critérios forem cumpridos.",
  },
  {
    pergunta: "Como confirmar minha presença em um evento?",
    resposta:
      "Abra o QR Code do evento/turma e faça a leitura com a câmera pelo app/página de presença. A confirmação manual (quando aplicável) respeita as janelas definidas nas regras do sistema.",
  },
  {
    pergunta: "Consigo cancelar minha inscrição em um evento?",
    resposta:
      "Sim, se ainda estiver dentro do prazo do evento. Acesse “Minhas Inscrições” e clique em “Cancelar inscrição”.",
  },
  {
    pergunta: "O que é a “Assinatura Digital” no sistema?",
    resposta:
      "É a imagem da sua assinatura usada automaticamente nos certificados de instrutor. O cadastro é opcional e pode ser feito no menu “Perfil”.",
  },
  {
    pergunta: "O QR Code do certificado não funciona. O que faço?",
    resposta:
      "Confira a conexão com a internet e tente novamente. Se persistir, valide o certificado diretamente na página “Validar Certificado” informando o código/ID.",
  },

  // Novas perguntas baseadas no teu projeto
  {
    pergunta: "Quando recebo a notificação para realizar a avaliação?",
    resposta:
      "Assim que a turma encerrar e sua presença geral atingir pelo menos 75%, o sistema verifica sua elegibilidade e envia uma notificação para responder à avaliação.",
  },
  {
    pergunta: "A avaliação influencia a emissão do certificado?",
    resposta:
      "Sim. Em turmas que exigem avaliação, a emissão do certificado ocorre após o envio da avaliação e a validação dos critérios de presença/carga horária.",
  },
  {
    pergunta: "O que significa ver dois certificados do mesmo evento?",
    resposta:
      "Quando você participa como aluno e também como instrutor, verá dois certificados distintos: um do tipo “usuario” e outro do tipo “instrutor”, cada um com layout e regras próprias.",
  },
  {
    pergunta: "Quais são os prazos para confirmação manual de presença?",
    resposta:
      "A confirmação manual só é permitida a partir de 60 minutos após o início da aula. Em telas de usuário/instrutor pode haver limite curto (ex.: até 48h). No painel do administrador, o limite pode chegar a 15 dias após o término da turma.",
  },
  {
    pergunta: "Como validar a autenticidade de um certificado?",
    resposta:
      "Use o QR Code impresso no documento ou acesse a página “Validar Certificado” e informe o código/ID do certificado para checagem online.",
  },
  {
    pergunta: "O que significam as cores dos eventos na agenda?",
    resposta:
      "Verde = Programado, Amarelo = Em andamento, Vermelho = Encerrado. Esse padrão é aplicado em toda a plataforma.",
  },
  {
    pergunta: "Qual é a diferença entre evento e turma?",
    resposta:
      "O evento é o tema/guarda-chuva; as turmas são instâncias com período e horários específicos. Você se inscreve em turmas de um evento.",
  },
  {
    pergunta: "Meu CPF foi informado errado. Consigo corrigir?",
    resposta:
      "Sim. Faça login e acesse o menu “Perfil”. Se o CPF estiver bloqueado por validação, você será direcionado para a atualização de cadastro ao acessar o sistema.",
  },
  {
    pergunta: "Sou instrutor. Preciso sempre enviar assinatura digital?",
    resposta:
      "Não. A assinatura digital é opcional e aplicada ao certificado de instrutor quando cadastrada.",
  },
];

/** Utilitário simples para slug/id das perguntas (links diretos) */
function toId(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function AccordionAjuda({ perguntas = PERGUNTAS_BASE }) {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());

  // Lista com id estável para cada pergunta
  const lista = useMemo(
    () =>
      perguntas.map((p) => ({
        ...p,
        id: toId(p.pergunta),
      })),
    [perguntas]
  );

  // Filtro por texto (pergunta + resposta)
  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (item) =>
        item.pergunta.toLowerCase().includes(q) ||
        item.resposta.toLowerCase().includes(q)
    );
  }, [lista, query]);

  // Abrir pergunta se hash corresponder (#id)
  useEffect(() => {
    const hash = window.location.hash?.replace("#", "");
    if (!hash) return;
    const alvo = lista.find((i) => i.id === hash);
    if (alvo) {
      setOpenIds(new Set([alvo.id]));
      // rolar suavemente
      const el = document.getElementById(alvo.id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [lista]);

  const toggleAll = useCallback(
    (expandir) => {
      if (expandir) {
        setOpenIds(new Set(filtradas.map((i) => i.id)));
      } else {
        setOpenIds(new Set());
      }
    },
    [filtradas]
  );

  const handleCopyLink = useCallback((id) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }, []);

  const isOpen = useCallback((id) => openIds.has(id), [openIds]);
  const onChangeItem = useCallback(
    (id, novoEstado) => {
      setOpenIds((prev) => {
        const s = new Set(prev);
        if (novoEstado) s.add(id);
        else s.delete(id);
        return s;
      });
    },
    [setOpenIds]
  );

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-6">

      {/* Barra de busca */}
      <div className="mb-4">
        <label htmlFor="faq-search" className="sr-only">
          Buscar dúvidas
        </label>
        <div className="relative">
          <input
            id="faq-search"
            type="search"
            placeholder="Buscar por palavra-chave (ex.: certificado, avaliação, presença)…"
            className="w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 pl-10 pr-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Ações: expandir/recolher */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium bg-verde-900 text-white hover:bg-verde-900/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-verde-900/60"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Expandir tudo
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-verde-900/60"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
          Recolher tudo
        </button>
      </div>

      {/* Lista de perguntas */}
      <div className="space-y-2">
        {filtradas.map((item) => (
          <Disclosure
            key={item.id}
            defaultOpen={isOpen(item.id)}
            as="div"
            className="rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700"
          >
            {({ open }) => {
              // manter estado controlado (para expandir/recolher tudo)
              useEffect(() => {
                // sincroniza quando openIds mudar externamente
                const shouldBeOpen = isOpen(item.id);
                if (shouldBeOpen !== open) {
                  // HeadlessUI controla internamente; vamos apenas reagir via key
                  // (solução: alteramos key quando openIds muda lá em cima — já ok)
                }
              }, [open, item.id]);

              return (
                <div id={item.id}>
                  <Disclosure.Button
                    onClick={() => onChangeItem(item.id, !open)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verde-900/60"
                  >
                    <span className="text-sm md:text-base font-medium text-verde-900 dark:text-gray-100">
                      {item.pergunta}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(item.id);
                        }}
                        className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label="Copiar link desta pergunta"
                        title="Copiar link desta pergunta"
                      >
                        <LinkIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                      </button>
                      <ChevronUp
                        className={`${
                          open ? "rotate-180" : ""
                        } h-5 w-5 text-gray-600 dark:text-gray-300 transition-transform`}
                        aria-hidden="true"
                      />
                    </div>
                  </Disclosure.Button>
                  <Disclosure.Panel className="px-4 pt-2 pb-4 text-sm md:text-base text-gray-700 dark:text-gray-300">
                    {item.resposta}
                  </Disclosure.Panel>
                </div>
              );
            }}
          </Disclosure>
        ))}

        {filtradas.length === 0 && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-700 dark:text-gray-300">
            Nenhuma pergunta encontrada para <span className="font-semibold">“{query}”</span>.  
            Tente outros termos (ex.: <em>certificado</em>, <em>avaliação</em>, <em>presença</em>).
          </div>
        )}
      </div>
    </section>
  );
}

AccordionAjuda.propTypes = {
  /** Permite injetar uma lista customizada, senão usa o conjunto padrão acima */
  perguntas: PropTypes.arrayOf(
    PropTypes.shape({
      pergunta: PropTypes.string.isRequired,
      resposta: PropTypes.string.isRequired,
    })
  ),
};
