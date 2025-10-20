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
  { pergunta: "Esqueci minha senha. O que devo fazer?", resposta: 'Clique em “Recuperar Senha” na tela de login e siga as instruções enviadas para seu e-mail institucional.' },
  { pergunta: "Como atualizo meus dados pessoais?", resposta: 'No menu “Perfil”, você pode atualizar nome, e-mail, senha e — se for instrutor — a assinatura digital (imagem).' },
  { pergunta: "O certificado não apareceu. O que pode ter acontecido?", resposta: "Verifique se a turma foi encerrada e se você atingiu pelo menos 75% de presença. Certificados só são liberados após a avaliação (quando exigida) e quando todos os critérios forem cumpridos." },
  { pergunta: "Como confirmar minha presença em um evento?", resposta: "Abra o QR Code do evento/turma e faça a leitura com a câmera pelo app/página de presença. A confirmação manual (quando aplicável) respeita as janelas definidas nas regras do sistema." },
  { pergunta: "Consigo cancelar minha inscrição em um evento?", resposta: "Sim, se ainda estiver dentro do prazo do evento. Acesse “Minhas Inscrições” e clique em “Cancelar inscrição”." },
  { pergunta: "O que é a “Assinatura Digital” no sistema?", resposta: "É a imagem da sua assinatura usada automaticamente nos certificados de instrutor. O cadastro é opcional e pode ser feito no menu “Perfil”." },
  { pergunta: "O QR Code do certificado não funciona. O que faço?", resposta: "Confira a conexão com a internet e tente novamente. Se persistir, valide o certificado diretamente na página “Validar Certificado” informando o código/ID." },
  { pergunta: "Quando recebo a notificação para realizar a avaliação?", resposta: "Assim que a turma encerrar e sua presença geral atingir pelo menos 75%, o sistema verifica sua elegibilidade e envia uma notificação para responder à avaliação." },
  { pergunta: "A avaliação influencia a emissão do certificado?", resposta: "Sim. Em turmas que exigem avaliação, a emissão do certificado ocorre após o envio da avaliação e a validação dos critérios de presença/carga horária." },
  { pergunta: "O que significa ver dois certificados do mesmo evento?", resposta: "Quando você participa como aluno e também como instrutor, verá dois certificados distintos: um do tipo “usuario” e outro do tipo “instrutor”, cada um com layout e regras próprias." },
  { pergunta: "Quais são os prazos para confirmação manual de presença?", resposta: "A confirmação manual só é permitida a partir de 60 minutos após o início da aula. Em telas de usuário/instrutor pode haver limite curto (ex.: até 48h). No painel do administrador, o limite pode chegar a 15 dias após o término da turma." },
  { pergunta: "Como validar a autenticidade de um certificado?", resposta: "Use o QR Code impresso no documento ou acesse a página “Validar Certificado” e informe o código/ID do certificado para checagem online." },
  { pergunta: "O que significam as cores dos eventos na agenda?", resposta: "Verde = Programado, Amarelo = Em andamento, Vermelho = Encerrado. Esse padrão é aplicado em toda a plataforma." },
  { pergunta: "Qual é a diferença entre evento e turma?", resposta: "O evento é o tema/guarda-chuva; as turmas são instâncias com período e horários específicos. Você se inscreve em turmas de um evento." },
  { pergunta: "Meu CPF foi informado errado. Consigo corrigir?", resposta: "Sim. Faça login e acesse o menu “Perfil”. Se o CPF estiver bloqueado por validação, você será direcionado para a atualização de cadastro ao acessar o sistema." },
  { pergunta: "Sou instrutor. Preciso sempre enviar assinatura digital?", resposta: "Não. A assinatura digital é opcional e aplicada ao certificado de instrutor quando cadastrada." },
];

/** Slug estável para id das perguntas (links diretos) */
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

/** Realça todas as ocorrências de query em text usando <mark>. */
function highlight(text, query) {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  // Escapa regex
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${esc})`, "gi");
  const parts = String(text).split(re);
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/50 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function AccordionAjuda({
  perguntas = PERGUNTAS_BASE,
  accent = "lousa", // emerald|violet|amber|rose|teal|indigo|petroleo|orange|sky|lousa
}) {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [openVersion, setOpenVersion] = useState(0); // força remount dos items quando expandir/recolher tudo
  const [copiedId, setCopiedId] = useState(null);    // feedback acessível de cópia de link

  const accents = {
    emerald: {
      ring: "focus-visible:ring-emerald-500/60",
      btn: "bg-emerald-900 text-white hover:bg-emerald-800",
      btnOutline: "border-emerald-900 text-emerald-900 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-700 dark:hover:bg-emerald-950/30",
    },
    violet: {
      ring: "focus-visible:ring-violet-500/60",
      btn: "bg-violet-900 text-white hover:bg-violet-800",
      btnOutline: "border-violet-900 text-violet-900 hover:bg-violet-50 dark:text-violet-200 dark:border-violet-700 dark:hover:bg-violet-950/30",
    },
    amber: {
      ring: "focus-visible:ring-amber-500/60",
      btn: "bg-amber-700 text-black hover:bg-amber-600",
      btnOutline: "border-amber-700 text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:border-amber-700 dark:hover:bg-amber-950/30",
    },
    rose: {
      ring: "focus-visible:ring-rose-500/60",
      btn: "bg-rose-900 text-white hover:bg-rose-800",
      btnOutline: "border-rose-900 text-rose-900 hover:bg-rose-50 dark:text-rose-200 dark:border-rose-700 dark:hover:bg-rose-950/30",
    },
    teal: {
      ring: "focus-visible:ring-teal-500/60",
      btn: "bg-teal-900 text-white hover:bg-teal-800",
      btnOutline: "border-teal-900 text-teal-900 hover:bg-teal-50 dark:text-teal-200 dark:border-teal-700 dark:hover:bg-teal-950/30",
    },
    indigo: {
      ring: "focus-visible:ring-indigo-500/60",
      btn: "bg-indigo-900 text-white hover:bg-indigo-800",
      btnOutline: "border-indigo-900 text-indigo-900 hover:bg-indigo-50 dark:text-indigo-200 dark:border-indigo-700 dark:hover:bg-indigo-950/30",
    },
    petroleo: {
      ring: "focus-visible:ring-teal-600/60",
      btn: "bg-slate-900 text-white hover:bg-slate-800",
      btnOutline: "border-slate-900 text-slate-900 hover:bg-slate-50 dark:text-teal-200 dark:border-teal-800 dark:hover:bg-slate-800/40",
    },
    orange: {
      ring: "focus-visible:ring-orange-500/60",
      btn: "bg-orange-700 text-black hover:bg-orange-600",
      btnOutline: "border-orange-700 text-orange-800 hover:bg-orange-50 dark:text-orange-200 dark:border-orange-700 dark:hover:bg-orange-950/30",
    },
    sky: {
      ring: "focus-visible:ring-sky-500/60",
      btn: "bg-sky-800 text-white hover:bg-sky-700",
      btnOutline: "border-sky-800 text-sky-900 hover:bg-sky-50 dark:text-sky-200 dark:border-sky-700 dark:hover:bg-sky-950/30",
    },
    lousa: {
      ring: "focus-visible:ring-emerald-600/60",
      btn: "bg-verde-900 text-white hover:bg-verde-900/90",
      btnOutline: "border-verde-900 text-verde-900 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-700 dark:hover:bg-emerald-950/30",
    },
  };
  const theme = accents[accent] ?? accents.lousa;

  // Lista com id estável p/ cada pergunta
  const lista = useMemo(
    () => perguntas.map((p) => ({ ...p, id: toId(p.pergunta) })),
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
      const novo = new Set([alvo.id]);
      setOpenIds(novo);
      setOpenVersion((v) => v + 1);
      // rolar suavemente
      const el = document.getElementById(alvo.id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  const isOpen = useCallback((id) => openIds.has(id), [openIds]);

  const onChangeItem = useCallback((id, novoEstado) => {
    setOpenIds((prev) => {
      const s = new Set(prev);
      if (novoEstado) s.add(id);
      else s.delete(id);
      return s;
    });
  }, []);

  const toggleAll = useCallback(
    (expandir) => {
      setOpenIds(() => (expandir ? new Set(filtradas.map((i) => i.id)) : new Set()));
      setOpenVersion((v) => v + 1); // força remount p/ respeitar defaultOpen
    },
    [filtradas]
  );

  const handleCopyLink = useCallback((id) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard?.writeText(url).then(
      () => setCopiedId(id),
      () => setCopiedId(null)
    );
  }, []);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-6" aria-label="Perguntas frequentes">
      {/* Barra de busca */}
      <div className="mb-4">
        <label htmlFor="faq-search" className="sr-only">Buscar dúvidas</label>
        <div className="relative">
          <input
            id="faq-search"
            type="search"
            placeholder="Buscar por palavra-chave (ex.: certificado, avaliação, presença)…"
            className={`w-full rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 pl-10 pr-4 py-2 outline-none focus-visible:ring-2 ${theme.ring}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-500 dark:text-gray-400 pointer-events-none" />
        </div>
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"}
        </div>
      </div>

      {/* Ações: expandir/recolher */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium ${theme.btn} focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.ring}`}
          disabled={filtradas.length === 0}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Expandir tudo
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className={`inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-sm font-medium border ${theme.btnOutline} focus-visible:ring-2 focus-visible:ring-offset-2 ${theme.ring}`}
          disabled={openIds.size === 0}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
          Recolher tudo
        </button>
      </div>

      {/* Live region para feedback de cópia */}
      <p className="sr-only" aria-live="polite">
        {copiedId ? `Link da pergunta ${copiedId} copiado para a área de transferência` : ""}
      </p>

      {/* Lista de perguntas */}
      <ul className="space-y-2">
        {filtradas.map((item) => {
          const open = isOpen(item.id);
          const panelId = `${item.id}-panel`;
          const btnId = `${item.id}-button`;

          return (
            <li key={`${item.id}-${openVersion}-${open ? "o" : "c"}`} id={item.id}>
              <Disclosure defaultOpen={open} as="div" className="rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-gray-700">
                {({ open: nowOpen }) => (
                  <>
                    <Disclosure.Button
                      id={btnId}
                      aria-controls={panelId}
                      aria-expanded={nowOpen}
                      onClick={() => onChangeItem(item.id, !nowOpen)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 ${theme.ring}`}
                    >
                      <span className="text-sm md:text-base font-medium text-verde-900 dark:text-gray-100">
                        {highlight(item.pergunta, query)}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* ⬇️ AQUI trocamos o <button> por um elemento não-button com acessibilidade */}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyLink(item.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCopyLink(item.id);
                            }
                          }}
                          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/30"
                          aria-label="Copiar link desta pergunta"
                          title="Copiar link desta pergunta"
                        >
                          <LinkIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                        </span>
                        <ChevronUp
                          className={`${nowOpen ? "rotate-180" : ""} h-5 w-5 text-gray-600 dark:text-gray-300 transition-transform`}
                          aria-hidden="true"
                        />
                      </div>
                    </Disclosure.Button>
                    <Disclosure.Panel
                      id={panelId}
                      aria-labelledby={btnId}
                      className="px-4 pt-2 pb-4 text-sm md:text-base text-gray-700 dark:text-gray-300"
                    >
                      {highlight(item.resposta, query)}
                    </Disclosure.Panel>
                  </>
                )}
              </Disclosure>
            </li>
          );
        })}

        {filtradas.length === 0 && (
          <li>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-700 dark:text-gray-300">
              Nenhuma pergunta encontrada para <span className="font-semibold">“{query}”</span>.{" "}
              Tente outros termos (ex.: <em>certificado</em>, <em>avaliação</em>, <em>presença</em>).
            </div>
          </li>
        )}
      </ul>
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
  /** Tema/acento de cor (para foco/botões) */
  accent: PropTypes.oneOf([
    "emerald",
    "violet",
    "amber",
    "rose",
    "teal",
    "indigo",
    "petroleo",
    "orange",
    "sky",
    "lousa",
  ]),
};
