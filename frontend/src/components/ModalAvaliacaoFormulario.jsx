// 📁 src/components/ModalAvaliacaoFormulario.jsx
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import Modal from "./Modal";
import { apiPost } from "../services/api";
import {
  Gauge,
  Star,
  CheckCircle2,
  AlertTriangle,
  SendHorizontal,
  Loader2,
  ChevronDown,
} from "lucide-react";

/* ===================== Opções e utilidades ===================== */
const OPcao = [
  { label: "Ótimo", value: "Ótimo", nota: 5 },
  { label: "Bom", value: "Bom", nota: 4 },
  { label: "Regular", value: "Regular", nota: 3 },
  { label: "Ruim", value: "Ruim", nota: 2 },
  { label: "Péssimo", value: "Péssimo", nota: 1 },
];
const LABELS_VALIDAS = new Set(OPcao.map((o) => o.value));
const NORM = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const byChave = (arr) => {
  const m = new Map();
  for (const x of arr) m.set(x.chave, x);
  return m;
};

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

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

const COND_SIMPOSIO_OU_CONGRESSO = [
  { chave: "exposicao_trabalhos", rotulo: "Exposição de trabalhos" },
];
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

/* ===================== Mini components ===================== */
function MiniCard({ icon: Icon, title, children, tone = "emerald" }) {
  const tones = {
    emerald: "border-emerald-100 dark:border-emerald-900 bg-white dark:bg-slate-900",
    amber: "border-amber-200 dark:border-amber-900 bg-white dark:bg-slate-900",
    zinc: "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900",
  };
  return (
    <div className={cls("rounded-2xl border p-3 shadow-sm", tones[tone] || tones.zinc)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-5 h-5" aria-hidden="true" />
        <span className="font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function RatingField({
  rotulo,
  chave,
  obrig,
  value,
  onChange,
  focusRef,
  invalid,
  hintId,
}) {
  const fieldName = `nota-${chave}`;

  return (
    <fieldset
      className={cls(
        "rounded-2xl border p-3 transition",
        invalid
          ? "border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20"
          : "border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50"
      )}
      aria-required={obrig ? "true" : "false"}
      aria-invalid={invalid ? "true" : "false"}
      aria-describedby={hintId}
    >
      <legend className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
        {rotulo}{" "}
        {obrig && (
          <span className="text-rose-600" title="Obrigatório" aria-label="Obrigatório">
            *
          </span>
        )}
      </legend>

      {invalid ? (
        <p id={hintId} className="mt-1 text-[12px] text-rose-700 dark:text-rose-300 font-semibold">
          Selecione uma nota para continuar.
        </p>
      ) : (
        <p id={hintId} className="mt-1 text-[12px] text-slate-500 dark:text-slate-300">
          Escolha uma opção.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        {OPcao.map(({ label, value: v, nota }, idx) => {
          const checked = String(value) === v;

          return (
            <label
              key={v}
              className={cls(
                "inline-flex items-center gap-2 text-sm rounded-full px-3 py-1.5 border cursor-pointer select-none transition",
                "focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:ring-offset-2 focus-within:ring-offset-transparent",
                checked
                  ? "bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                  : "bg-white/80 dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:border-emerald-300"
              )}
            >
              <input
                ref={focusRef && idx === 0 ? focusRef : undefined}
                type="radio"
                name={fieldName}
                value={v}
                checked={checked}
                onChange={(e) => onChange(chave, e.target.value)}
                className="accent-emerald-600"
              />
              <span className="font-semibold">
                {label} <span className="text-xs text-slate-500">({nota})</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ===================== Componente ===================== */
export default function ModalAvaliacaoFormulario({
  isOpen,
  onClose,
  evento,
  turma_id,
  recarregar,
}) {
  const [comentarios_finais, setComentariosFinais] = useState("");
  const [gostou_mais, setGostouMais] = useState("");
  const [sugestoes_melhoria, setSugestoesMelhoria] = useState("");
  const [notas, setNotas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");
  const [showExtras, setShowExtras] = useState(false);

  const primeiroCampoRef = useRef(null);
  const fieldRefs = useRef({}); // { [chave]: HTMLInputElement }

  const tipoNorm = NORM(evento?.tipo);
  const isCongresso = tipoNorm === "congresso";
  const isSimposio = tipoNorm === "simposio"; // ✅ corrigido (já normalizado)

  const camposObrigatorios = useMemo(() => CAMPOS_BASE, []);
  const camposExtras = useMemo(() => {
    const extras = [];
    if (isCongresso || isSimposio) extras.push(...COND_SIMPOSIO_OU_CONGRESSO);
    if (isCongresso) extras.push(...COND_CONGRESSO);
    return extras;
  }, [isCongresso, isSimposio]);

  const camposNotas = useMemo(
    () => [...camposObrigatorios, ...camposExtras],
    [camposObrigatorios, camposExtras]
  );

  const totalObrig = OBRIGATORIOS.size;

  const preenchidosObrig = useMemo(
    () =>
      [...OBRIGATORIOS].filter(
        (c) => notas[c] && LABELS_VALIDAS.has(String(notas[c]))
      ).length,
    [notas]
  );

  const pctObrig = Math.round((preenchidosObrig / totalObrig) * 100) || 0;

  const mediaPrevia = useMemo(() => {
    const labels = [...OBRIGATORIOS]
      .map((c) => notas[c])
      .filter((v) => LABELS_VALIDAS.has(v));
    if (!labels.length) return null;

    const soma = labels.reduce((acc, lab) => {
      const item = OPcao.find((o) => o.value === lab);
      return acc + (item?.nota ?? 0);
    }, 0);

    return (soma / labels.length).toFixed(1);
  }, [notas]);

  const faltandoObrig = useMemo(
    () =>
      [...OBRIGATORIOS].filter(
        (c) => !notas[c] || !LABELS_VALIDAS.has(String(notas[c]))
      ),
    [notas]
  );

  const mapCampos = useMemo(() => byChave(camposNotas), [camposNotas]);

  useEffect(() => {
    if (!isOpen) return;

    setNotas({});
    setGostouMais("");
    setSugestoesMelhoria("");
    setComentariosFinais("");
    setMsgA11y("");
    setShowExtras(false);

    requestAnimationFrame(() => {
      primeiroCampoRef.current?.focus?.();
    });
  }, [isOpen, evento?.id, turma_id]);

  // ✅✅ CRÍTICO: hooks SEMPRE antes do return condicional
  const handleNotaChange = useCallback((campo, valorLabel) => {
    setNotas((prev) => ({ ...prev, [campo]: valorLabel }));
  }, []);

  const focusPrimeiroPendente = useCallback(() => {
    const first = faltandoObrig[0];
    if (!first) return;
    requestAnimationFrame(() => {
      fieldRefs.current[first]?.focus?.();
    });
  }, [faltandoObrig]);

  if (!isOpen || !evento) return null;

  async function enviarAvaliacao() {
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (!usuario?.id) {
      const m = "Usuário não identificado.";
      setMsgA11y(m);
      toast.error(m);
      return;
    }

    if (faltandoObrig.length) {
      const msg = `Preencha todas as notas obrigatórias (${faltandoObrig.length} pendente${
        faltandoObrig.length > 1 ? "s" : ""
      }).`;
      setMsgA11y(msg);
      toast.warning(msg);
      focusPrimeiroPendente();
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

      // envia todas as notas possíveis (inclui condicionais), mas só as preenchidas
      for (const { chave } of [...CAMPOS_BASE, ...COND_SIMPOSIO_OU_CONGRESSO, ...COND_CONGRESSO]) {
        if (notas[chave]) payload[chave] = String(notas[chave]);
      }

      await apiPost("/api/avaliacao", payload);

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
  const titulo = evento?.nome || evento?.titulo || "Evento";

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
          ✍️ Avaliar: {titulo}
        </h2>
        <p id="descricao-avaliacao" className="text-white/90 text-sm mt-1">
          Selecione uma opção para cada critério obrigatório. Os extras aparecem quando aplicável.
        </p>
      </div>

      {/* Corpo rolável único */}
      <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-28">
        {/* Ministats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniCard icon={Gauge} title="Progresso" tone="emerald">
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
              {preenchidosObrig}/{totalObrig} obrigatórios
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pctObrig}%` }} />
            </div>
          </MiniCard>

          <MiniCard icon={Star} title="Média prévia" tone="emerald">
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {mediaPrevia ? `${mediaPrevia} / 5` : "— / 5"}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Calculada só com campos obrigatórios preenchidos
            </div>
          </MiniCard>

          <MiniCard
            icon={preenchidosObrig === totalObrig ? CheckCircle2 : AlertTriangle}
            title="Status"
            tone={preenchidosObrig === totalObrig ? "emerald" : "amber"}
          >
            <div className="text-sm text-slate-800 dark:text-slate-100 font-semibold">
              {preenchidosObrig === totalObrig
                ? "Tudo pronto para enviar"
                : `Há ${faltandoObrig.length} obrigatório(s) pendente(s)`}
            </div>

            {faltandoObrig.length ? (
              <button
                type="button"
                onClick={focusPrimeiroPendente}
                className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2"
              >
                Ir para o primeiro pendente
              </button>
            ) : null}
          </MiniCard>
        </div>

        {/* Live region */}
        <div aria-live="polite" className="sr-only">
          {msgA11y}
        </div>

        {/* Obrigatórios */}
        <div className="pt-4">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-2">
            Notas obrigatórias
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CAMPOS_BASE.map(({ chave, rotulo }, idx) => {
              const obrig = OBRIGATORIOS.has(chave);
              const invalido =
                obrig && (!notas[chave] || !LABELS_VALIDAS.has(String(notas[chave])));

              return (
                <RatingField
                  key={chave}
                  rotulo={rotulo}
                  chave={chave}
                  obrig={obrig}
                  value={notas[chave]}
                  onChange={handleNotaChange}
                  invalid={invalido}
                  hintId={`hint-${chave}`}
                  focusRef={idx === 0 ? primeiroCampoRef : { current: null }}
                />
              );
            })}
          </div>
        </div>

        {/* Rebind refs (para foco no “pendente”) */}
        <RebindFirstRadios fieldRefs={fieldRefs} />

        {/* Extras (condicionais) */}
        {camposExtras.length > 0 && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowExtras((s) => !s)}
              className={cls(
                "w-full flex items-center justify-between rounded-2xl px-4 py-3",
                "border border-slate-200 dark:border-slate-700",
                "bg-white/70 dark:bg-slate-900/50",
                "hover:border-emerald-300 transition"
              )}
              aria-expanded={showExtras ? "true" : "false"}
            >
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                Extras (opcionais) — {isCongresso ? "Congresso" : "Simpósio/Congresso"}
              </div>
              <ChevronDown
                className={cls("w-5 h-5 transition-transform", showExtras ? "rotate-180" : "")}
                aria-hidden="true"
              />
            </button>

            {showExtras && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {camposExtras.map(({ chave, rotulo }) => (
                  <RatingField
                    key={chave}
                    rotulo={rotulo}
                    chave={chave}
                    obrig={false}
                    value={notas[chave]}
                    onChange={handleNotaChange}
                    invalid={false}
                    hintId={`hint-${chave}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Textos livres */}
        <div className="mt-6 space-y-4">
          <div>
            <label className="block font-extrabold text-slate-800 dark:text-slate-100 mb-1">
              O que você mais gostou?
            </label>
            <textarea
              className="w-full border rounded-2xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={gostou_mais}
              onChange={(e) => setGostouMais(e.target.value)}
              aria-label="O que você mais gostou"
            />
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 dark:text-slate-100 mb-1">
              Sugestões de melhoria
            </label>
            <textarea
              className="w-full border rounded-2xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={2}
              value={sugestoes_melhoria}
              onChange={(e) => setSugestoesMelhoria(e.target.value)}
              aria-label="Sugestões de melhoria"
            />
          </div>

          <div>
            <label className="block font-extrabold text-slate-800 dark:text-slate-100 mb-1">
              Comentários finais
            </label>
            <textarea
              className="w-full border rounded-2xl px-3 py-2 dark:bg-slate-900 dark:text-white border-slate-300 dark:border-slate-700
                         focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          className="px-4 py-2 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition font-extrabold"
          disabled={enviando}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={enviarAvaliacao}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
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
              <SendHorizontal className="w-4 h-4" aria-hidden="true" />
              Enviar Avaliação
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Helper: após render, captura o primeiro radio de cada grupo
 * e guarda no fieldRefs para focar no “primeiro pendente”.
 */
function RebindFirstRadios({ fieldRefs }) {
  useEffect(() => {
    try {
      const groups = document.querySelectorAll('fieldset [type="radio"]');
      const seen = new Set();
      for (const el of groups) {
        const name = el.getAttribute("name") || "";
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const chave = name.replace(/^nota-/, "");
        if (!fieldRefs.current[chave]) fieldRefs.current[chave] = el;
      }
    } catch {
      /* no-op */
    }
  }, [fieldRefs]);

  return null;
}
