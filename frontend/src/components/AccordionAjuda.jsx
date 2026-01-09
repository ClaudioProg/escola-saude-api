// 📁 src/components/ui/AccordionAjuda.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const escapeRegExp = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toId(text) {
  return normalize(text).replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
}

function highlight(text, query) {
  if (!query) return text;
  const q = normalize(query);
  const safe = escapeRegExp(query);
  const parts = String(text).split(new RegExp(`(${safe})`, "gi"));
  return parts.map((p, i) =>
    normalize(p) === q ? (
      <mark key={i} className="rounded bg-yellow-200 dark:bg-yellow-600/50 px-0.5">{p}</mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/* ───────────────── Componente ───────────────── */
export default function AccordionAjuda({
  perguntas = PERGUNTAS_BASE,
  accent = "lousa",
  compact = false,
  emptyMessage = "Nenhuma pergunta encontrada.",
  onToggle,         // (id, isOpen) => void
  onCopyLink,       // (id) => void
}) {
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [versionKey, setVersionKey] = useState(0); // força remount dos Disclosures
  const firstHashOpen = useRef(false);

  const accents = {
    lousa: {
      ring: "focus-visible:ring-emerald-600/60",
      btn: "bg-verde-900 text-white hover:bg-verde-900/90",
      outline: "border-verde-900 text-verde-900 hover:bg-emerald-50 dark:text-emerald-200 dark:border-emerald-700",
    },
    emerald: {
      ring: "focus-visible:ring-emerald-600/60",
      btn: "bg-emerald-700 text-white hover:bg-emerald-800",
      outline: "border-emerald-700 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700",
    },
    violet: {
      ring: "focus-visible:ring-violet-600/60",
      btn: "bg-violet-700 text-white hover:bg-violet-800",
      outline: "border-violet-700 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:border-violet-700",
    },
    amber: {
      ring: "focus-visible:ring-amber-600/60",
      btn: "bg-amber-600 text-black hover:bg-amber-700",
      outline: "border-amber-600 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-600",
    },
    sky: {
      ring: "focus-visible:ring-sky-600/60",
      btn: "bg-sky-700 text-white hover:bg-sky-800",
      outline: "border-sky-700 text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:border-sky-700",
    },
  };

  const theme = accents[accent] ?? accents.lousa;

  const lista = useMemo(
    () => perguntas.map((p) => ({ ...p, id: p.id || toId(p.pergunta) })),
    [perguntas]
  );

  const filtradas = useMemo(() => {
    const q = normalize(query);
    if (!q) return lista;
    return lista.filter(
      (i) => normalize(i.pergunta).includes(q) || normalize(i.resposta).includes(q)
    );
  }, [lista, query]);

  // Deep-link: abre o item do hash na primeira montagem/alteração de hash
  useEffect(() => {
    const tryOpenHash = () => {
      const hash = window.location.hash?.replace("#", "");
      if (!hash) return;
      // se a pergunta existe, marca como aberta
      const exists = lista.some((i) => i.id === hash);
      if (exists) {
        setOpenIds((prev) => new Set(prev).add(hash));
        setVersionKey((v) => v + 1); // remount para aplicar defaultOpen
        // rola de leve até o item
        setTimeout(() => {
          const el = document.getElementById(hash);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
    };
    if (!firstHashOpen.current) {
      firstHashOpen.current = true;
      tryOpenHash();
    }
    const onHash = () => tryOpenHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [lista]);

  useEffect(() => {
    if (!copiedId) return;
    const t = setTimeout(() => setCopiedId(null), 1500);
    return () => clearTimeout(t);
  }, [copiedId]);

  const toggleAll = (open) => {
    const next = open ? new Set(filtradas.map((i) => i.id)) : new Set();
    setOpenIds(next);
    setVersionKey((v) => v + 1); // força remount dos Disclosures (defaultOpen reavaliado)
  };

  const toggleItem = (id, open) => {
    setOpenIds((prev) => {
      const s = new Set(prev);
      open ? s.add(id) : s.delete(id);
      return s;
    });
    onToggle?.(id, open);
  };

  const copyLink = async (id) => {
    const url = `${location.origin}${location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      onCopyLink?.(id);
    } catch {
      /* no-op */
    }
  };

  const pad = compact ? "px-3 py-2.5" : "px-4 py-3";
  const containerPad = compact ? "px-3 py-5" : "px-4 py-6";

  return (
    <section className="max-w-4xl mx-auto px-4" aria-label="Perguntas frequentes">
      {/* Busca */}
      <div className="mb-4">
        <label htmlFor="faq-search" className="sr-only">Buscar dúvidas</label>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" aria-hidden />
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no FAQ…"
            className={`w-full pl-9 pr-4 py-2.5 rounded-2xl border bg-white dark:bg-zinc-800 border-gray-300 dark:border-gray-700 focus-visible:ring-2 ${theme.ring}`}
            aria-describedby="faq-count"
          />
        </div>
        <p id="faq-count" className="mt-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {filtradas.length > 0 ? `${filtradas.length} resultado(s)` : "Nenhum resultado"}
        </p>
      </div>

      {/* Ações */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm ${theme.btn}`}
          aria-label="Expandir todas as perguntas"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Expandir tudo
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm ${theme.outline}`}
          aria-label="Recolher todas as perguntas"
        >
          <Minus className="h-4 w-4" aria-hidden />
          Recolher tudo
        </button>
      </div>

      {/* Lista */}
      <ul className="space-y-2">
        {filtradas.map((item) => {
          const willOpen = openIds.has(item.id);
          return (
            <li key={`${item.id}-${versionKey}`} id={item.id}>
              <Disclosure defaultOpen={willOpen}>
                {({ open }) => (
                  <div className="rounded-xl border bg-white dark:bg-zinc-800 border-gray-200 dark:border-gray-700">
                    <Disclosure.Button
                      onClick={() => toggleItem(item.id, !open)}
                      className={`w-full flex justify-between items-center ${pad} text-left rounded-xl focus-visible:ring-2 ${theme.ring}`}
                      aria-controls={`${item.id}-panel`}
                    >
                      <span className="font-medium">{highlight(item.pergunta, query)}</span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLink(item.id);
                          }}
                          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label="Copiar link da pergunta"
                          title="Copiar link"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-4 w-4 text-emerald-500" aria-hidden />
                          ) : (
                            <LinkIcon className="h-4 w-4 text-gray-500" aria-hidden />
                          )}
                        </button>
                        <ChevronUp
                          className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </div>
                    </Disclosure.Button>

                    <Disclosure.Panel
                      id={`${item.id}-panel`}
                      className={`${compact ? "px-3 pb-3" : "px-4 pb-4"} text-sm text-gray-700 dark:text-gray-300`}
                    >
                      {highlight(item.resposta, query)}
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>
            </li>
          );
        })}

        {filtradas.length === 0 && (
          <li className={`text-center text-sm text-gray-500 dark:text-gray-400 ${containerPad}`}>
            {emptyMessage}
            {query && <> para <strong>“{query}”</strong>.</>}
          </li>
        )}
      </ul>
    </section>
  );
}

AccordionAjuda.propTypes = {
  perguntas: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    pergunta: PropTypes.string.isRequired,
    resposta: PropTypes.string.isRequired,
  })),
  accent: PropTypes.oneOf(["lousa", "emerald", "violet", "amber", "sky"]),
  compact: PropTypes.bool,
  emptyMessage: PropTypes.string,
  onToggle: PropTypes.func,
  onCopyLink: PropTypes.func,
};
