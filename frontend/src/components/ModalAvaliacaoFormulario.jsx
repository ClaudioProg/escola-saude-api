// 📁 src/components/ModalAvaliacaoFormulario.jsx
import { useMemo, useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiPost } from "../services/api";
import {
  Gauge,
  Star,
  CheckCircle2,
  AlertTriangle,
  SendHorizonal,
  Loader2,
} from "lucide-react";

/* ===================== Opções e utilidades ===================== */
const OPCOES = [
  { label: "Ótimo", value: "Ótimo", nota: 5 },
  { label: "Bom", value: "Bom", nota: 4 },
  { label: "Regular", value: "Regular", nota: 3 },
  { label: "Ruim", value: "Ruim", nota: 2 },
  { label: "Péssimo", value: "Péssimo", nota: 1 },
];
const LABELS_VALIDAS = new Set(OPCOES.map((o) => o.value));
const NORM = (s) =>
  (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/* ===================== Campos ===================== */
const CAMPOS_BASE = [
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
];

const COND_SIMPOSIO_OU_CONGRESSO = [{ chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" }];
const COND_CONGRESSO = [
  { chave: "apresentacao_oral_mostra", rotulo: "Apresentação oral na mostra" },
  { chave: "apresentacao_tcrs", rotulo: "Apresentação dos TCRs" },
  { chave: "oficinas", rotulo: "Oficinas" },
];

const OBRIGATORIOS = new Set([
  "desempenho_instrutor",
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
]); // ⚠️ sem 'exposicao_trabalhos'

/* ===================== Componente ===================== */
export default function ModalAvaliacaoFormulario({ isOpen, onClose, evento, turma_id, recarregar }) {
  const [comentarios_finais, setComentariosFinais] = useState("");
  const [gostou_mais, setGostouMais] = useState("");
  const [sugestoes_melhoria, setSugestoesMelhoria] = useState("");
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");
  const primeiroCampoRef = useRef(null);

  const tipoNorm = NORM(evento?.tipo);
  const isCongresso = tipoNorm === "congresso";
  const isSimposio = tipoNorm === "simposio" || tipoNorm === "simpósio";

  const camposNotas = useMemo(() => {
    const extras = [];
    if (isCongresso || isSimposio) extras.push(...COND_SIMPOSIO_OU_CONGRESSO);
    if (isCongresso) extras.push(...COND_CONGRESSO);
    return [...CAMPOS_BASE, ...extras];
  }, [isCongresso, isSimposio]);

  const totalObrig = OBRIGATORIOS.size;
  const preenchidosObrig = useMemo(
    () => [...OBRIGATORIOS].filter((c) => notas[c] && LABELS_VALIDAS.has(notas[c])).length,
    [notas]
  );
  const pctObrig = Math.round((preenchidosObrig / totalObrig) * 100) || 0;

  const mediaPrevia = useMemo(() => {
    const labels = [...OBRIGATORIOS].map((c) => notas[c]).filter((v) => LABELS_VALIDAS.has(v));
    if (!labels.length) return null;
    const soma = labels.reduce((acc, lab) => {
      const item = OPCOES.find((o) => o.value === lab);
      return acc + (item?.nota ?? 0);
    }, 0);
    return (soma / labels.length).toFixed(1);
  }, [notas]);

  useEffect(() => {
    if (isOpen) {
      setNotas({});
      setGostouMais("");
      setSugestoesMelhoria("");
      setComentariosFinais("");
      setMsgA11y("");
      setTimeout(() => primeiroCampoRef.current?.focus(), 30);
    }
  }, [isOpen, evento?.id, turma_id]);

  if (!isOpen || !evento) return null;

  const handleNotaChange = (campo, valorLabel) => setNotas((prev) => ({ ...prev, [campo]: valorLabel }));

  async function enviarAvaliacao() {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (!usuario?.id) {
      setMsgA11y("Usuário não identificado.");
      toast.error("Usuário não identificado.");
      return;
    }

    const faltando = [...OBRIGATORIOS].filter((c) => !notas[c] || !LABELS_VALIDAS.has(String(notas[c])));
    if (faltando.length) {
      const msg = `Preencha todas as notas obrigatórias (${faltando.length} pendente${faltando.length > 1 ? "s" : ""}).`;
      setMsgA11y(msg);
      toast.warning(msg);
      return;
    }

    try {
      setEnviando(true);

      const payload = {
        evento_id: Number(evento.evento_id ?? evento.id),
        turma_id: Number(turma_id),
        gostou_mais,
        sugestoes_melhoria,
        comentarios_finais,
      };

      for (const { chave } of [...CAMPOS_BASE, ...COND_SIMPOSIO_OU_CONGRESSO, ...COND_CONGRESSO]) {
        if (notas[chave]) payload[chave] = String(notas[chave]);
      }

      await apiPost("/api/avaliacoes", payload);

      setMsgA11y("Avaliação enviada com sucesso.");
      toast.success("✅ Avaliação enviada com sucesso!");
      onClose?.();
      recarregar?.();
    } catch (err) {
      console.error(err);
      setMsgA11y("Erro ao enviar avaliação.");
      toast.error("❌ Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  /* ===================== UI ===================== */
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-avaliacao"
      describedBy="descricao-avaliacao"
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Cabeçalho */}
      <div
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600"
        role="group"
        aria-label="Cabeçalho do formulário de avaliação"
      >
        <h2 id="titulo-avaliacao" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          ✍️ Avaliar: {evento?.nome || evento?.titulo || "Evento"}
        </h2>
        <p id="descricao-avaliacao" className="text-white/90 text-sm mt-1">
          Selecione uma opção para cada critério e, se desejar, deixe comentários.
        </p>
      </div>

      {/* ===== Corpo rolável ÚNICO (evita scroll-duplo) ===== */}
      <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-28">
        {/* Ministats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="w-5 h-5" aria-hidden="true" />
              <span className="font-semibold">Progresso</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {preenchidosObrig}/{totalObrig} obrigatórios
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctObrig}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-5 h-5" aria-hidden="true" />
              <span className="font-semibold">Média prévia</span>
            </div>
            <div className="text-2xl font-bold">{mediaPrevia ? `${mediaPrevia} / 5` : "— / 5"}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Calculada só com campos obrigatórios preenchidos
            </div>
          </div>

          <div
            className={`rounded-2xl border p-3 shadow-sm bg-white dark:bg-slate-900 ${
              preenchidosObrig === totalObrig ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {preenchidosObrig === totalObrig ? (
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              )}
              <span className="font-semibold">Status</span>
            </div>
            <div className="text-sm">
              {preenchidosObrig === totalObrig ? "Tudo pronto para enviar" : "Há campos obrigatórios pendentes"}
            </div>
          </div>
        </div>

        {/* Live region para leitores de tela */}
        <div aria-live="polite" className="sr-only">{msgA11y}</div>

        {/* Campos de notas */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {camposNotas.map(({ chave, rotulo }, idx) => {
            const obrig = OBRIGATORIOS.has(chave);
            const invalido = obrig && (!notas[chave] || !LABELS_VALIDAS.has(String(notas[chave])));
            const fieldName = `nota-${chave}`;

            return (
              <fieldset
                key={chave}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"
                aria-required={obrig ? "true" : "false"}
                aria-invalid={invalido ? "true" : "false"}
              >
                <legend className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {rotulo} {obrig && <span className="text-red-600" title="Obrigatório" aria-label="Obrigatório">*</span>}
                </legend>

                <div className="mt-2 flex flex-wrap gap-2">
                  {OPCOES.map(({ label, value, nota }) => (
                    <label
                      key={value}
                      className={`inline-flex items-center gap-2 text-sm rounded-full px-3 py-1 border cursor-pointer select-none transition ${
                        String(notas[chave]) === value
                          ? "bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                          : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-emerald-300"
                      }`}
                    >
                      <input
                        ref={idx === 0 && value === "Ótimo" ? primeiroCampoRef : undefined}
                        type="radio"
                        name={fieldName}
                        value={value}
                        checked={String(notas[chave]) === value}
                        onChange={(e) => handleNotaChange(chave, e.target.value)}
                        className="accent-emerald-600"
                      />
                      <span>
                        {label} <span className="text-xs text-slate-500">({nota})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Textos livres */}
        <div className="mt-4 space-y-4">
          <div>
            <label className="block font-medium text-slate-800 dark:text-slate-100 mb-1">O que você mais gostou?</label>
            <textarea
              className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={gostou_mais}
              onChange={(e) => setGostouMais(e.target.value)}
              aria-label="O que você mais gostou"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-800 dark:text-slate-100 mb-1">Sugestões de melhoria</label>
            <textarea
              className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={sugestoes_melhoria}
              onChange={(e) => setSugestoesMelhoria(e.target.value)}
              aria-label="Sugestões de melhoria"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-800 dark:text-slate-100 mb-1">Comentários finais</label>
            <textarea
              className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
              value={comentarios_finais}
              onChange={(e) => setComentariosFinais(e.target.value)}
              aria-label="Comentários finais"
            />
          </div>
        </div>
      </div>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
          disabled={enviando}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={enviarAvaliacao}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition disabled:opacity-60"
          disabled={enviando}
          aria-disabled={enviando ? "true" : "false"}
        >
          {enviando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Enviando...
            </>
          ) : (
            <>
              <SendHorizonal className="w-4 h-4" aria-hidden="true" />
              Enviar Avaliação
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
