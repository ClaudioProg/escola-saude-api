// 📁 src/components/ModalAvaliacao.jsx
import PropTypes from "prop-types";
import Modal from "./Modal";
import { Star, Gauge, CalendarDays, Info, UserStar } from "lucide-react";

/* ====================== Campos ====================== */
/** ✅ Campos que entram no cálculo da média (regra do projeto) */
const CAMPOS_MEDIA = [
  { chave: "divulgacao_evento", rotulo: "Divulgação do evento" },
  { chave: "recepcao", rotulo: "Recepção" },
  { chave: "credenciamento", rotulo: "Credenciamento" },
  { chave: "material_apoio", rotulo: "Material de apoio" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "sinalizacao_local", rotulo: "Sinalização do local" },
  { chave: "conteudo_temas", rotulo: "Conteúdo / Temas" },
  { chave: "estrutura_local", rotulo: "Estrutura do local" },
  { chave: "acessibilidade", rotulo: "Acessibilidade" },
  { chave: "limpeza", rotulo: "Limpeza" },
  { chave: "inscricao_online", rotulo: "Inscrição online" },
];

/** ✅ Mostramos também (mas não entra na média) */
const CAMPO_DESEMPENHO = { chave: "desempenho_instrutor", rotulo: "Desempenho do instrutor" };

/** Extras (só mostram se vier valor) */
const CAMPOS_EXTRAS = [
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

const CAMPOS_TEXTO = [
  { chave: "gostou_mais", rotulo: "O que mais gostou" },
  { chave: "sugestoes_melhoria", rotulo: "Sugestões de melhoria" },
  { chave: "comentarios_finais", rotulo: "Comentários finais" },
];

/* ====================== Helpers ====================== */
const labelToNota = (valor) => {
  const v = (valor || "").toString().toLowerCase();
  if (v.includes("ótimo") || v.includes("otimo")) return 5;
  if (v.includes("bom")) return 4;
  if (v.includes("regular")) return 3;
  if (v.includes("ruim")) return 2;
  if (v.includes("péssimo") || v.includes("pessimo")) return 1;
  return null;
};

const corNota = (valor) => {
  const v = (valor || "").toString().toLowerCase();
  if (v.includes("ótimo") || v.includes("otimo"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800";
  if (v.includes("bom"))
    return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/25 dark:text-sky-200 dark:border-sky-800";
  if (v.includes("regular"))
    return "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800";
  if (v.includes("ruim"))
    return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800";
  if (v.includes("péssimo") || v.includes("pessimo"))
    return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/25 dark:text-purple-200 dark:border-purple-800";
  return "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/35 dark:text-zinc-200 dark:border-zinc-800";
};

const calcMedia = (avaliacao) => {
  if (!avaliacao) return null;
  const valores = CAMPOS_MEDIA
    .map(({ chave }) => labelToNota(avaliacao[chave]))
    .filter((n) => typeof n === "number");

  if (!valores.length) return null;
  const soma = valores.reduce((a, b) => a + b, 0);
  return (soma / valores.length).toFixed(1);
};

// 🔒 BR date safe (sem timezone / sem new Date)
function formatIsoToBR(input) {
  if (!input) return "—";
  const s = String(input).trim();
  const dt = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  if (dt) return `${dt[3]}/${dt[2]}/${dt[1]} ${dt[4]}:${dt[5]}`;
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  return s;
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

function MiniCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5" aria-hidden="true" />
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ====================== Componente ====================== */
export default function ModalAvaliacao({ isOpen, onClose, avaliacao }) {
  if (!avaliacao) return null;

  const dataAval =
    avaliacao.data_avaliacao || avaliacao.criado_em || avaliacao.atualizado_em || null;

  const notasPrincipais = CAMPOS_MEDIA.filter(({ chave }) => !!avaliacao[chave]);
  const desempenhoValor = avaliacao?.[CAMPO_DESEMPENHO.chave] || "";
  const extrasVisiveis = CAMPOS_EXTRAS.filter(({ chave }) => !!avaliacao[chave]);

  const textosVisiveis = CAMPOS_TEXTO.filter(({ chave }) => {
    const v = avaliacao?.[chave];
    return typeof v === "string" ? v.trim().length > 0 : !!v;
  });

  const media = calcMedia(avaliacao);

  // cobertura só do núcleo (11)
  const totalCrit = CAMPOS_MEDIA.length;
  const totalPreenchidos = notasPrincipais.length;
  const pctPreenchidos = Math.round((totalPreenchidos / totalCrit) * 100) || 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-avaliacao-visualizacao"
      describedBy="descricao-avaliacao-visualizacao"
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Header */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700"
        role="group"
        aria-label="Cabeçalho da avaliação"
      >
        <h2
          id="titulo-avaliacao-visualizacao"
          className="text-xl sm:text-2xl font-extrabold tracking-tight"
        >
          📋 Avaliação do Evento
        </h2>
        <p id="descricao-avaliacao-visualizacao" className="text-white/90 text-sm mt-1">
          Visualização das notas e comentários enviados.
        </p>

        {dataAval && (
          <div className="mt-2 flex items-center gap-2 text-white/90 text-sm">
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            <span>
              Data da avaliação: <strong>{formatIsoToBR(dataAval)}</strong>
            </span>
          </div>
        )}
      </header>

      {/* Corpo rolável */}
      <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-24">
        {/* Ministats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniCard icon={Star} title="Média (critérios do evento)">
            <div className="text-2xl font-extrabold">{media ? `${media} / 5` : "— / 5"}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Média calculada apenas com os 11 critérios oficiais do evento.
            </div>
          </MiniCard>

          <MiniCard icon={Gauge} title="Cobertura (núcleo)">
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {totalPreenchidos}/{totalCrit} critérios preenchidos
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pctPreenchidos}%` }} />
            </div>

            {extrasVisiveis.length > 0 && (
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                Extras preenchidos: <strong>{extrasVisiveis.length}</strong>
              </div>
            )}
          </MiniCard>

          <MiniCard icon={Info} title="Observações">
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Campos extras aparecem somente quando informados.
            </div>
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              “Desempenho do instrutor” é exibido à parte e não entra na média.
            </div>
          </MiniCard>
        </section>

        {/* Live region A11y */}
        <div aria-live="polite" className="sr-only">
          {media ? `Média geral ${media} de 5.` : "Sem média calculada."}
        </div>

        {/* Notas principais */}
        <section className="pt-5">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
            Notas principais
          </h3>

          {notasPrincipais.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAMPOS_MEDIA.map(({ chave, rotulo }) => {
                const valor = avaliacao[chave];
                const notaNum = labelToNota(valor);
                const vazio = !valor;

                return (
                  <div
                    key={chave}
                    className={cls(
                      "p-3 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-700",
                      vazio && "opacity-70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {rotulo}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {typeof notaNum === "number" ? `${notaNum}/5` : "—/5"}
                      </div>
                    </div>

                    <span
                      className={cls(
                        "inline-block text-xs font-extrabold px-2 py-1 rounded-full border",
                        corNota(valor)
                      )}
                      aria-label={`Nota: ${valor || "Não informado"}`}
                    >
                      {valor || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">(Sem notas registradas)</p>
          )}
        </section>

        {/* Desempenho do instrutor (se existir) */}
        {desempenhoValor ? (
          <section className="pt-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <UserStar className="w-4 h-4" aria-hidden="true" />
              Desempenho do instrutor
            </h3>

            <div className="p-3 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cls(
                    "inline-block text-xs font-extrabold px-2 py-1 rounded-full border",
                    corNota(desempenhoValor)
                  )}
                >
                  {desempenhoValor}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {(() => {
                    const n = labelToNota(desempenhoValor);
                    return typeof n === "number" ? `${n}/5` : "—/5";
                  })()}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {/* Extras */}
        {extrasVisiveis.length > 0 ? (
          <section className="pt-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
              Extras
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {extrasVisiveis.map(({ chave, rotulo }) => {
                const valor = avaliacao[chave];
                const notaNum = labelToNota(valor);
                return (
                  <div
                    key={chave}
                    className="p-3 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {rotulo}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {typeof notaNum === "number" ? `${notaNum}/5` : "—/5"}
                      </div>
                    </div>

                    <span
                      className={cls(
                        "inline-block text-xs font-extrabold px-2 py-1 rounded-full border",
                        corNota(valor)
                      )}
                      aria-label={`Nota: ${valor}`}
                    >
                      {valor}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Textos (somente se houver conteúdo) */}
        {textosVisiveis.length > 0 ? (
          <section className="pt-5 space-y-3">
            {textosVisiveis.map(({ chave, rotulo }) => (
              <div key={chave}>
                <strong className="block text-slate-800 dark:text-slate-100 mb-1">
                  {rotulo}:
                </strong>
                <p className="bg-white dark:bg-slate-900 border dark:border-slate-700 p-3 rounded-2xl text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                  {avaliacao[chave]}
                </p>
              </div>
            ))}
          </section>
        ) : (
          <section className="pt-5">
            <p className="text-sm text-slate-500 italic">(Sem comentários textuais)</p>
          </section>
        )}
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-2xl font-extrabold bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

ModalAvaliacao.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  avaliacao: PropTypes.object, // estrutura flexível
};
