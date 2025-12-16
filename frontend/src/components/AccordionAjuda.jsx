import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Disclosure } from "@headlessui/react";
import { ChevronUp, Link as LinkIcon, Search, Minus, Plus, Check } from "lucide-react";

/* ───────────────── Conteúdo base (FAQ) ───────────────── */
const PERGUNTAS_BASE = [
  { pergunta: "Esqueci minha senha. O que devo fazer?", resposta: "Clique em “Recuperar Senha” na tela de login e siga as instruções enviadas para seu e-mail institucional." },
  { pergunta: "Como atualizo meus dados pessoais?", resposta: "No menu “Perfil”, você pode atualizar nome, e-mail, senha e — se for instrutor — a assinatura digital (imagem)." },
  { pergunta: "O certificado não apareceu. O que pode ter acontecido?", resposta: "Verifique se a turma foi encerrada e se você atingiu pelo menos 75% de presença. Certificados só são liberados após a avaliação (quando exigida)." },
  { pergunta: "Como confirmar minha presença em um evento?", resposta: "A presença pode ser registrada via QR Code. A confirmação manual segue as janelas definidas nas regras do sistema." },
  { pergunta: "Consigo cancelar minha inscrição em um evento?", resposta: "Sim. Se ainda estiver dentro do prazo do evento, acesse “Minhas Inscrições” e cancele." },
  { pergunta: "O que é a assinatura digital?", resposta: "É a imagem usada automaticamente nos certificados de instrutor. O cadastro é opcional." },
  { pergunta: "Quando recebo a notificação de avaliação?", resposta: "Após o encerramento da turma e presença ≥ 75%, o sistema envia a notificação." },
];

/* ───────────────── Utils ───────────────── */
const normalize = (s = "") =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function toId(text) {
  return normalize(text).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

function highlight(text, query) {
  if (!query) return text;
  const q = normalize(query);
  const parts = String(text).split(new RegExp(`(${query})`, "gi"));
  return parts.map((p, i) =>
    normalize(p) === q ? (
      <mark
        key={i}
        className="rounded bg-yellow-200 dark:bg-yellow-600/50 px-0.5"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/* ───────────────── Componente ───────────────── */
export default function AccordionAjuda({
  perguntas = PERGUNTAS_BASE,
  accent = "lousa",
}) {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const accents = {
    lousa: {
      ring: "focus-visible:ring-emerald-600/60",
      btn: "bg-verde-900 text-white hover:bg-verde-900/90",
      outline:
        "border-verde-900 text-verde-900 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-700",
    },
  };

  const theme = accents[accent] ?? accents.lousa;

  const lista = useMemo(
    () => perguntas.map((p) => ({ ...p, id: toId(p.pergunta) })),
    [perguntas]
  );

  const filtradas = useMemo(() => {
    const q = normalize(query);
    if (!q) return lista;
    return lista.filter(
      (i) =>
        normalize(i.pergunta).includes(q) ||
        normalize(i.resposta).includes(q)
    );
  }, [lista, query]);

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedId]);

  const toggleAll = (open) =>
    setOpenIds(open ? new Set(filtradas.map((i) => i.id)) : new Set());

  const toggleItem = (id, open) =>
    setOpenIds((prev) => {
      const s = new Set(prev);
      open ? s.add(id) : s.delete(id);
      return s;
    });

  const copyLink = async (id) => {
    const url = `${location.origin}${location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
    } catch {}
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-6" aria-label="Perguntas frequentes">
      {/* Busca */}
      <div className="mb-4">
        <label htmlFor="faq-search" className="sr-only">
          Buscar dúvidas
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no FAQ…"
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl border bg-white dark:bg-zinc-800 border-gray-300 dark:border-gray-700 focus-visible:ring-2 ${theme.ring}`}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {filtradas.length} resultado(s)
        </p>
      </div>

      {/* Ações */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => toggleAll(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm ${theme.btn}`}
        >
          <Plus className="h-4 w-4" />
          Expandir tudo
        </button>
        <button
          onClick={() => toggleAll(false)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${theme.outline}`}
        >
          <Minus className="h-4 w-4" />
          Recolher tudo
        </button>
      </div>

      {/* Lista */}
      <ul className="space-y-2">
        {filtradas.map((item) => {
          const open = openIds.has(item.id);

          return (
            <li key={item.id} id={item.id}>
              <Disclosure defaultOpen={open}>
                {({ open: nowOpen }) => (
                  <div className="rounded-xl border bg-white dark:bg-zinc-800 border-gray-200 dark:border-gray-700">
                    <Disclosure.Button
                      onClick={() => toggleItem(item.id, !nowOpen)}
                      className={`w-full flex justify-between items-center px-4 py-3 text-left rounded-xl focus-visible:ring-2 ${theme.ring}`}
                    >
                      <span className="font-medium">
                        {highlight(item.pergunta, query)}
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(item.id);
                          }}
                          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label="Copiar link da pergunta"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <LinkIcon className="h-4 w-4 text-gray-500" />
                          )}
                        </span>
                        <ChevronUp
                          className={`h-5 w-5 transition-transform ${
                            nowOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel className="px-4 pb-4 text-sm text-gray-700 dark:text-gray-300">
                      {highlight(item.resposta, query)}
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>
            </li>
          );
        })}

        {filtradas.length === 0 && (
          <li className="text-center text-sm text-gray-500 dark:text-gray-400 p-6">
            Nenhuma pergunta encontrada para <strong>“{query}”</strong>.
          </li>
        )}
      </ul>
    </section>
  );
}

AccordionAjuda.propTypes = {
  perguntas: PropTypes.array,
  accent: PropTypes.string,
};
