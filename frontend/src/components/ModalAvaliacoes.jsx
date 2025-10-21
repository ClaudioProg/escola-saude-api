// 📁 src/components/ModalAvaliacoes.jsx
import PropTypes from "prop-types";
import Modal from "./Modal"; // ✅ usa o Modal padrão do projeto
import { Star, Gauge, CalendarDays, Info } from "lucide-react";

/* ====================== Campos ====================== */
const CAMPOS_NOTAS = [
  { chave: "divulgacao_evento", rotulo: "Divulgação do evento" },
  { chave: "recepcao", rotulo: "Recepção" },
  { chave: "credenciamento", rotulo: "Credenciamento" },
  { chave: "material_apoio", rotulo: "Material de apoio" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
  { chave: "sinalizacao_local", rotulo: "Sinalização do local" },
  { chave: "conteudo_temas", rotulo: "Conteúdo / Temas" },
  { chave: "desempenho_instrutor", rotulo: "Desempenho do instrutor" },
  { chave: "estrutura_local", rotulo: "Estrutura do local" },
  { chave: "acessibilidade", rotulo: "Acessibilidade" },
  { chave: "limpeza", rotulo: "Limpeza" },
  { chave: "inscricao_online", rotulo: "Inscrição online" },
  // extras (só mostramos se vier valor)
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
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v.includes("bom"))
    return "bg-sky-100 text-sky-800 border-sky-200";
  if (v.includes("regular"))
    return "bg-amber-100 text-amber-800 border-amber-200";
  if (v.includes("ruim"))
    return "bg-rose-100 text-rose-800 border-rose-200";
  if (v.includes("péssimo") || v.includes("pessimo"))
    return "bg-purple-100 text-purple-800 border-purple-200";
  return "bg-gray-100 text-gray-800 border-gray-200";
};

const calcMedia = (avaliacao) => {
  if (!avaliacao) return null;
  const valores = CAMPOS_NOTAS
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
  // date+time
  const dt = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  if (dt) return `${dt[3]}/${dt[2]}/${dt[1]} ${dt[4]}:${dt[5]}`;
  // date only
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;
  return s;
}

/* ====================== Componente ====================== */
export default function ModalAvaliacoes({ isOpen, onClose, avaliacao }) {
  if (!avaliacao) return null;

  const dataAval =
    avaliacao.data_avaliacao ||
    avaliacao.criado_em ||
    avaliacao.atualizado_em ||
    null;

  const notasVisiveis = CAMPOS_NOTAS.filter(({ chave }) => !!avaliacao[chave]);
  const textosVisiveis = CAMPOS_TEXTO.filter(({ chave }) => avaliacao[chave]);
  const media = calcMedia(avaliacao);
  const totalPreenchidos = notasVisiveis.length;
  const totalCrit = CAMPOS_NOTAS.length;
  const pctPreenchidos = Math.round((totalPreenchidos / totalCrit) * 100);

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

        {/* Linha de contexto (data) */}
        {dataAval && (
          <div className="mt-2 flex items-center gap-2 text-white/90 text-sm">
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            <span>
              Data da avaliação:{" "}
              <strong>{formatIsoToBR(dataAval)}</strong>
            </span>
          </div>
        )}
      </header>

      {/* ===== Corpo rolável (garante ver o final) ===== */}
      <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-24">
        {/* Ministats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5" aria-hidden="true" />
              <span className="font-semibold">Média</span>
            </div>
            <div className="text-2xl font-bold">{media ? `${media} / 5` : "— / 5"}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Conversão das labels (Ótimo=5 … Péssimo=1)
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-5 h-5" aria-hidden="true" />
              <span className="font-semibold">Cobertura</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {totalPreenchidos}/{totalCrit} critérios preenchidos
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pctPreenchidos}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-5 h-5" aria-hidden="true" />
              <span className="font-semibold">Notas</span>
            </div>
            <div className="text-sm">
              Itens extras (ex.: <em>Exposição</em>, <em>Oficinas</em>) aparecem
              somente quando informados.
            </div>
          </div>
        </section>

        {/* Live region A11y */}
        <div aria-live="polite" className="sr-only">
          {media ? `Média geral ${media} de 5.` : "Sem média calculada."}
        </div>

        {/* Conteúdo principal */}
        <section className="pt-4">
          {/* Bloco de notas */}
          {notasVisiveis.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notasVisiveis.map(({ chave, rotulo }) => {
                const valor = avaliacao[chave];
                const notaNum = labelToNota(valor);
                return (
                  <div
                    key={chave}
                    className="p-3 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700"
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
                      className={`inline-block text-xs font-bold px-2 py-1 rounded-full border ${corNota(valor)}`}
                      aria-label={`Nota: ${valor}`}
                    >
                      {valor}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">
              (Sem notas registradas)
            </p>
          )}

          {/* Campos textuais */}
          <div className="mt-4 space-y-3">
            {CAMPOS_TEXTO.map(({ chave, rotulo }) => (
              <div key={chave}>
                <strong className="block text-slate-800 dark:text-slate-100 mb-1">
                  {rotulo}:
                </strong>
                <p className="bg-white dark:bg-slate-900 border dark:border-slate-700 p-3 rounded-xl text-sm text-slate-800 dark:text-slate-100 min-h-[2.5rem]">
                  {avaliacao[chave] || "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

ModalAvaliacoes.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  avaliacao: PropTypes.object, // estrutura flexível
};
