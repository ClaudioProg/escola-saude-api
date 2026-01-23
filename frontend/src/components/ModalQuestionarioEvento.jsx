/* eslint-disable no-console */
// ✅ src/components/ModalQuestionarioEvento.jsx — PREMIUM++
// - A11y + CRUD + validação peso=10 + publicar
// - ✅ onConfigSaved (atualiza "configurado" no pai imediatamente)
// - ✅ Modal premium p/ adicionar alternativa (sem prompt feio)
// - ✅ Marcar correta otimizado (Promise.all) + UI otimista
// - ✅ tempo_minutos: envio "safe" (tenta; se backend não suportar, retenta sem)

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { ClipboardList, X, Plus, Trash2, Save, CheckCircle2, Timer, Repeat, Target, ListChecks } from "lucide-react";

import Modal from "./Modal";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function sumPesos(questoes = []) {
  return round2((questoes || []).reduce((acc, q) => acc + (Number(q?.peso) || 0), 0));
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

const TIPOS = [
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "dissertativa", label: "Dissertativa" },
];

export default function ModalQuestionarioEvento({
  open,
  onClose,
  eventoId,
  onlyAdmin = false,
  onConfigSaved, // ✅ novo
}) {
  const mounted = useRef(true);

  // ✅ snapshot ref — fonte única p/ notifyConfigSaved (evita stale + loops)
  const snapRef = useRef({
    questionarioId: null,
    titulo: "Questionário de Aprendizagem",
    descricao: "",
    obrigatorio: true,
    minNota10: 7,
    tentativasMax: 1,
    tempoMinutos: 30,
    questoesCount: 0,
    pesoTotal: 0,
    publicado: false,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // questionário
  const [questionario, setQuestionario] = useState(null);
  const [questoes, setQuestoes] = useState([]);

  // metadados
  const [titulo, setTitulo] = useState("Questionário de Aprendizagem");
  const [descricao, setDescricao] = useState("Verificação de absorção do conteúdo (antes da avaliação institucional).");
  const [obrigatorio, setObrigatorio] = useState(true);

  // regras do teste
  const [minNota10, setMinNota10] = useState(7); // UI 0..10
  const [tentativasMax, setTentativasMax] = useState(1);
  const [tempoMinutos, setTempoMinutos] = useState(30);

  // draft de nova questão
  const [novoTipo, setNovoTipo] = useState("multipla_escolha");
  const [novoEnunciado, setNovoEnunciado] = useState("");
  const [novoPeso, setNovoPeso] = useState(1);

  // controlar edição inline simples
  const [editId, setEditId] = useState(null);

  // ✅ modal premium de alternativa (substitui prompt)
  const [altModal, setAltModal] = useState({
    open: false,
    questaoId: null,
    texto: "",
  });

  const pesoTotal = useMemo(() => sumPesos(questoes), [questoes]);
  const faltaPara10 = useMemo(() => round2(10 - pesoTotal), [pesoTotal]);

  // ✅ mantém o snapshot sempre atualizado
  useEffect(() => {
    snapRef.current = {
      questionarioId: questionario?.id ?? null,
      titulo: String(titulo || "").trim(),
      descricao: String(descricao || "").trim(),
      obrigatorio: !!obrigatorio,
      minNota10: clamp(Number(minNota10) || 0, 0, 10),
      tentativasMax: clamp(Number(tentativasMax) || 1, 1, 50),
      tempoMinutos: clamp(Number(tempoMinutos) || 30, 5, 240),
      questoesCount: Array.isArray(questoes) ? questoes.length : 0,
      pesoTotal: Number(pesoTotal) || 0,
      publicado: !!questionario?.publicado,
    };
  }, [
    questionario?.id,
    questionario?.publicado,
    titulo,
    descricao,
    obrigatorio,
    minNota10,
    tentativasMax,
    tempoMinutos,
    questoes,
    pesoTotal,
  ]);

  const notifyConfigSaved = useCallback(
    (cfgOverride = {}) => {
      const s = snapRef.current;

      const minNota100 = clamp(Math.round((Number(s.minNota10) || 0) * 10), 0, 100);

      onConfigSaved?.({
        evento_id: eventoId,
        questionario_id: s.questionarioId,
        titulo: String(s.titulo || "").trim(),
        descricao: String(s.descricao || "").trim(),
        obrigatorio: !!s.obrigatorio,
        min_nota: minNota100,
        nota_minima_10: clamp(Number(s.minNota10) || 0, 0, 10),
        tentativas_max: clamp(Number(s.tentativasMax) || 1, 1, 50),
        tempo_minutos: clamp(Number(s.tempoMinutos) || 30, 5, 240),
        questoes_count: Number(s.questoesCount) || 0,
        peso_total: Number(s.pesoTotal) || 0,
        publicado: !!s.publicado,
        ...cfgOverride,
      });
    },
    [onConfigSaved, eventoId]
  );

  const carregar = useCallback(async () => {
    if (!eventoId) return;

    setLoading(true);
    try {
      // 1) garante rascunho
      await apiPost(`/api/questionarios/evento/${eventoId}/rascunho`, {});

      // 2) pega completo
      const q = await apiGet(`/api/questionarios/evento/${eventoId}`);

      if (!mounted.current) return;

      setQuestionario(q);

      setTitulo(q?.titulo || "Questionário de Aprendizagem");
      setDescricao(q?.descricao || "");
      setObrigatorio(typeof q?.obrigatorio === "boolean" ? q.obrigatorio : true);

      // min_nota: 0..100 no backend -> UI 0..10
      const mn = q?.min_nota == null ? 70 : Number(q.min_nota);
      const ui10 = Number.isFinite(mn) ? clamp(mn / 10, 0, 10) : 7;
      setMinNota10(ui10);

      setTentativasMax(q?.tentativas_max == null ? 1 : Number(q.tentativas_max));

      // tempo_minutos (se existir no backend)
      const tm = q?.tempo_minutos;
      setTempoMinutos(Number.isFinite(Number(tm)) ? clamp(Number(tm), 5, 240) : 30);

      setQuestoes(Array.isArray(q?.questoes) ? q.questoes : []);

      // ✅ se já existe, avisa o pai que agora tem algo carregado
      notifyConfigSaved({ carregado: true });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar/gerar questionário.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [eventoId, notifyConfigSaved]);

  useEffect(() => {
    mounted.current = true;
    if (open) carregar();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventoId]);

  // ✅ linha anterior ao trecho alterado: const salvarMetadados = useCallback(async () => {
  const salvarMetadados = useCallback(
    async ({ silent = false } = {}) => {
      if (!questionario?.id) return;

      const minNota100 = clamp(Math.round((Number(minNota10) || 0) * 10), 0, 100);

      // validações
      if (!String(titulo || "").trim()) {
        if (!silent) toast.warning("Informe um título para o teste.");
        return;
      }
      if (!Number.isFinite(minNota100) || minNota100 < 0 || minNota100 > 100) {
        if (!silent) toast.warning("Nota mínima inválida.");
        return;
      }
      const tent = Number(tentativasMax);
      if (!Number.isFinite(tent) || tent < 1 || tent > 50) {
        if (!silent) toast.warning("Tentativas inválidas (1..50).");
        return;
      }

      const payloadBase = {
        titulo: String(titulo).trim(),
        descricao: String(descricao || "").trim(),
        obrigatorio: !!obrigatorio,
        min_nota: minNota100,
        tentativas_max: tent,
      };

      const payloadComTempo = {
        ...payloadBase,
        tempo_minutos: clamp(Number(tempoMinutos) || 30, 5, 240),
      };

      setSaving(true);
      try {
        let upd;
        try {
          upd = await apiPut(`/api/questionarios/${questionario.id}`, payloadComTempo);
        } catch (e) {
          const msg = String(e?.data?.error || e?.message || "");
          const podeSerCampo = /tempo_minutos|column|unknown|invalid/i.test(msg);
          if (!podeSerCampo) throw e;
          upd = await apiPut(`/api/questionarios/${questionario.id}`, payloadBase);
        }

        if (!mounted.current) return;

        setQuestionario(upd);

        if (!silent) toast.success("Configurações do teste salvas.");

        notifyConfigSaved({ salvo_em: Date.now() });
        return upd; // ✅ útil pro fluxo de publicar
      } catch (err) {
        console.error(err);
        if (!silent) toast.error("Erro ao salvar configurações do teste.");
        throw err;
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [
      questionario?.id,
      titulo,
      descricao,
      obrigatorio,
      minNota10,
      tentativasMax,
      tempoMinutos,
      notifyConfigSaved,
    ]
  );

  const adicionarQuestao = useCallback(async () => {
    if (!questionario?.id) return;

    const en = String(novoEnunciado || "").trim();
    if (en.length < 5) {
      toast.info("Digite o enunciado da questão.");
      return;
    }

    const ps = clamp(Number(novoPeso) || 1, 0.1, 10);
    const tipo = novoTipo;

    setSaving(true);
    try {
      const ins = await apiPost(`/api/questionarios/${questionario.id}/questoes`, {
        tipo,
        enunciado: en,
        ordem: (questoes?.length || 0) + 1,
        peso: ps,
      });

      if (!mounted.current) return;

      setQuestoes((prev) => [...prev, { ...ins, alternativas: [] }]);
      setNovoEnunciado("");
      setNovoPeso(1);

      toast.success("Questão adicionada.");

      // ✅ atualiza ministats no pai
      notifyConfigSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar questão.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [questionario?.id, novoTipo, novoEnunciado, novoPeso, questoes?.length, notifyConfigSaved]);

  const atualizarQuestao = useCallback(
    async (q) => {
      if (!questionario?.id || !q?.id) return;

      const en = String(q.enunciado || "").trim();
      const ps = clamp(Number(q.peso) || 1, 0.1, 10);

      setSaving(true);
      try {
        const upd = await apiPut(`/api/questionarios/${questionario.id}/questoes/${q.id}`, {
          enunciado: en,
          peso: ps,
          ordem: Number(q.ordem) || 1,
          tipo: q.tipo,
        });

        if (!mounted.current) return;

        setQuestoes((prev) => prev.map((x) => (x.id === q.id ? { ...x, ...upd } : x)));
        toast.success("Questão atualizada.");
        setEditId(null);

        notifyConfigSaved();
      } catch (err) {
        console.error(err);
        toast.error("Erro ao atualizar questão.");
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [questionario?.id, notifyConfigSaved]
  );

  const removerQuestao = useCallback(
    async (qid) => {
      if (!questionario?.id || !qid) return;

      setSaving(true);
      try {
        await apiDelete(`/api/questionarios/${questionario.id}/questoes/${qid}`);

        if (!mounted.current) return;

        setQuestoes((prev) =>
          prev
            .filter((x) => x.id !== qid)
            .map((x, idx) => ({
              ...x,
              ordem: idx + 1,
            }))
        );
        toast.info("Questão removida.");

        notifyConfigSaved();
      } catch (err) {
        console.error(err);
        toast.error("Erro ao remover questão.");
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [questionario?.id, notifyConfigSaved]
  );

  const openAddAlternativa = useCallback((questaoId) => {
    setAltModal({ open: true, questaoId, texto: "" });
  }, []);

  const closeAddAlternativa = useCallback(() => {
    setAltModal({ open: false, questaoId: null, texto: "" });
  }, []);

  const confirmarAddAlternativa = useCallback(async () => {
    const questaoId = altModal?.questaoId;
    const texto = String(altModal?.texto || "").trim();
    if (!questaoId) return;

    if (texto.length < 1) {
      toast.error("Informe o texto da alternativa.");
      return;
    }

    const alvo = questoes.find((q) => q.id === questaoId);
    const alts = Array.isArray(alvo?.alternativas) ? alvo.alternativas : [];
    const ordem = (alts?.length || 0) + 1;

    setSaving(true);
    try {
      const ins = await apiPost(`/api/questionarios/questoes/${questaoId}/alternativas`, {
        texto,
        correta: false,
        ordem,
      });

      if (!mounted.current) return;

      setQuestoes((prev) =>
        prev.map((q) => {
          if (q.id !== questaoId) return q;
          const arr = Array.isArray(q.alternativas) ? q.alternativas : [];
          const next = [...arr, ins].map((a, idx) => ({ ...a, ordem: idx + 1 }));
          return { ...q, alternativas: next };
        })
      );

      toast.success("Alternativa adicionada.");
      closeAddAlternativa();

      notifyConfigSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar alternativa.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [altModal, questoes, closeAddAlternativa, notifyConfigSaved]);

  const marcarCorreta = useCallback(
    async (questaoId, altId) => {
      try {
        const alvo = questoes.find((q) => q.id === questaoId);
        const alts = Array.isArray(alvo?.alternativas) ? alvo.alternativas : [];

        // ✅ UI otimista (instantâneo)
        setQuestoes((prev) =>
          prev.map((q) => {
            if (q.id !== questaoId) return q;
            return {
              ...q,
              alternativas: (q.alternativas || []).map((a) => ({ ...a, correta: a.id === altId })),
            };
          })
        );

        // ✅ backend em paralelo
        await Promise.all(
          alts
            .filter((a) => a?.id)
            .map((a) => apiPut(`/api/questionarios/alternativas/${a.id}`, { correta: a.id === altId }))
        );

        toast.success("Alternativa correta definida.");
        notifyConfigSaved();
      } catch (err) {
        console.error(err);
        toast.error("Erro ao marcar alternativa correta.");
      }
    },
    [questoes, notifyConfigSaved]
  );

  const removerAlternativa = useCallback(
    async (altId, questaoId) => {
      try {
        await apiDelete(`/api/questionarios/alternativas/${altId}`);

        if (!mounted.current) return;

        setQuestoes((prev) =>
          prev.map((q) => {
            if (q.id !== questaoId) return q;
            const arr = (q.alternativas || [])
              .filter((a) => a.id !== altId)
              .map((a, idx) => ({ ...a, ordem: idx + 1 }));
            return { ...q, alternativas: arr };
          })
        );

        toast.info("Alternativa removida.");
        notifyConfigSaved();
      } catch (err) {
        console.error(err);
        toast.error("Erro ao remover alternativa.");
      }
    },
    [notifyConfigSaved]
  );

  const validarAntesDePublicar = useCallback(() => {
    if (round2(pesoTotal) !== 10) {
      toast.error(`A soma dos pesos deve fechar 10. Atualmente: ${pesoTotal} (faltam ${faltaPara10}).`);
      return false;
    }

    for (const q of questoes) {
      if (q.tipo !== "multipla_escolha") continue;

      const alts = Array.isArray(q.alternativas) ? q.alternativas : [];
      if (alts.length < 2) {
        toast.error(`Questão "${String(q.enunciado).slice(0, 40)}..." precisa de pelo menos 2 alternativas.`);
        return false;
      }
      const corretas = alts.filter((a) => !!a.correta).length;
      if (corretas !== 1) {
        toast.error(`Questão "${String(q.enunciado).slice(0, 40)}..." precisa de exatamente 1 alternativa correta.`);
        return false;
      }
    }

    return true;
  }, [pesoTotal, faltaPara10, questoes]);

  const publicar = useCallback(async () => {
    if (!questionario?.id) return;

    closeAddAlternativa();

    // ✅ valida primeiro
    if (!validarAntesDePublicar()) return;

    setSaving(true);
    try {
      // ✅ salva silencioso (sem toast)
      await salvarMetadados({ silent: true });

      const pub = await apiPost(`/api/questionarios/${questionario.id}/publicar`, {});
      if (!mounted.current) return;

      setQuestionario(pub);

      // ✅ notifica o pai
      notifyConfigSaved({
        publicado: true,
        publicado_em: Date.now(),
      });

      toast.success("✅ Teste publicado com sucesso!");
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.data?.error || "Erro ao publicar o teste.");
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [questionario?.id, salvarMetadados, validarAntesDePublicar, notifyConfigSaved, closeAddAlternativa, onClose]);

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        isOpen={open}
        onClose={saving ? undefined : onClose}
        size="lg"
        align="center"
        padding
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        labelledBy="qz-title"
        describedBy="qz-desc"
        zIndex={1400}
      >
        <div className="space-y-4">
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="qz-title" className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/5">
                  <ClipboardList className="w-5 h-5" aria-hidden="true" />
                </span>
                Configurar teste (questionário)
              </h3>
              <p id="qz-desc" className="text-sm text-zinc-600 dark:text-zinc-300">
                Regras: soma dos pesos deve fechar <strong>10</strong>. Questões/alternativas serão{" "}
                <strong>aleatórias</strong> para o aluno.
                {onlyAdmin ? " (Admin)" : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={saving ? undefined : onClose}
              className="h-10 w-10 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10
                         bg-white/70 dark:bg-zinc-900/60 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* loading */}
          {loading ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">Carregando questionário…</div>
          ) : (
            <>
              {/* ministats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-zinc-900/40">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                    <ListChecks className="w-4 h-4" /> Questões
                  </div>
                  <div className="text-lg font-extrabold">{questoes.length}</div>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-zinc-900/40">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                    <Target className="w-4 h-4" /> Peso total
                  </div>
                  <div
                    className={cx(
                      "text-lg font-extrabold",
                      round2(pesoTotal) === 10
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {pesoTotal} / 10
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-zinc-900/40">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                    <Repeat className="w-4 h-4" /> Tentativas
                  </div>
                  <div className="text-lg font-extrabold">{tentativasMax}</div>
                </div>

                <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 bg-white/70 dark:bg-zinc-900/40">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                    <Timer className="w-4 h-4" /> Tempo
                  </div>
                  <div className="text-lg font-extrabold">{tempoMinutos} min</div>
                </div>
              </div>

              {/* metadados */}
              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1 sm:col-span-2">
                    <label className="text-sm font-extrabold">Título</label>
                    <input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div className="grid gap-1 sm:col-span-2">
                    <label className="text-sm font-extrabold">Descrição</label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      className="w-full px-3 py-2.5 h-20 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-extrabold">Nota mínima (0..10)</label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={minNota10}
                      onChange={(e) => setMinNota10(clamp(toNum(e.target.value) ?? 0, 0, 10))}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-extrabold">Tentativas (1..50)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step={1}
                      value={tentativasMax}
                      onChange={(e) => setTentativasMax(clamp(toNum(e.target.value) ?? 1, 1, 50))}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-sm font-extrabold">Tempo do teste (min)</label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      value={tempoMinutos}
                      onChange={(e) => setTempoMinutos(clamp(toNum(e.target.value) ?? 30, 5, 240))}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">Recomendado: 20–60 min.</p>
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
                    <span className="text-sm font-extrabold">Obrigatório</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={salvarMetadados}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold disabled:opacity-60"
                  >
                    <Save className="w-4 h-4" />
                    Salvar configurações
                  </button>
                </div>
              </div>

              {/* adicionar questão */}
              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4 space-y-3">
                <div className="text-sm font-extrabold">Adicionar questão</div>
                <div className="grid gap-2 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-extrabold">Tipo</label>
                    <select
                      value={novoTipo}
                      onChange={(e) => setNovoTipo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    >
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-xs font-extrabold">Enunciado</label>
                    <input
                      value={novoEnunciado}
                      onChange={(e) => setNovoEnunciado(e.target.value)}
                      placeholder="Digite a pergunta…"
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="text-xs font-extrabold">Peso</label>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={novoPeso}
                      onChange={(e) => setNovoPeso(clamp(toNum(e.target.value) ?? 1, 0.1, 10))}
                      className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={adicionarQuestao}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-extrabold disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar questão
                  </button>
                </div>
              </div>

              {/* lista questões */}
              <div className="space-y-3">
                {questoes.map((q, idx) => {
                  const isEdit = editId === q.id;
                  const alts = Array.isArray(q.alternativas) ? q.alternativas : [];

                  return (
                    <div key={q.id} className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-600 dark:text-zinc-300">
                            #{idx + 1} • {q.tipo === "multipla_escolha" ? "Múltipla escolha" : "Dissertativa"} • peso{" "}
                            <strong>{Number(q.peso) || 0}</strong>
                          </div>

                          {isEdit ? (
                            <div className="mt-2 grid gap-2">
                              <input
                                value={q.enunciado || ""}
                                onChange={(e) =>
                                  setQuestoes((prev) =>
                                    prev.map((x) => (x.id === q.id ? { ...x, enunciado: e.target.value } : x))
                                  )
                                }
                                className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                              />

                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="number"
                                  min={0.1}
                                  max={10}
                                  step={0.1}
                                  value={q.peso ?? 1}
                                  onChange={(e) =>
                                    setQuestoes((prev) =>
                                      prev.map((x) =>
                                        x.id === q.id ? { ...x, peso: clamp(toNum(e.target.value) ?? 1, 0.1, 10) } : x
                                      )
                                    )
                                  }
                                  className="w-36 px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                                />

                                <button
                                  type="button"
                                  onClick={() => atualizarQuestao(q)}
                                  disabled={saving}
                                  className="rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold disabled:opacity-60"
                                >
                                  Salvar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setEditId(null)}
                                  disabled={saving}
                                  className="rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-extrabold disabled:opacity-60"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 font-extrabold text-slate-900 dark:text-white break-words">{q.enunciado}</div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {!isEdit ? (
                            <button
                              type="button"
                              onClick={() => setEditId(q.id)}
                              disabled={saving}
                              className="rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-extrabold disabled:opacity-60"
                            >
                              Editar
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => removerQuestao(q.id)}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold disabled:opacity-60"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remover
                          </button>
                        </div>
                      </div>

                      {/* alternativas para MCQ */}
                      {q.tipo === "multipla_escolha" && (
                        <div className="mt-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-extrabold">Alternativas ({alts.length})</div>
                            <button
                              type="button"
                              onClick={() => openAddAlternativa(q.id)}
                              disabled={saving}
                              className="rounded-2xl px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-extrabold disabled:opacity-60"
                            >
                              + Alternativa
                            </button>
                          </div>

                          {alts.length === 0 ? (
                            <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-2">
                              Adicione alternativas. Regra: mínimo 2 e exatamente 1 correta.
                            </div>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {alts.map((a) => (
                                <div
                                  key={a.id}
                                  className={cx(
                                    "flex items-start justify-between gap-2 rounded-2xl border p-2",
                                    a.correta
                                      ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                                      : "border-black/10 dark:border-white/10 bg-white/60 dark:bg-zinc-900/40"
                                  )}
                                >
                                  <label className="flex items-start gap-2 cursor-pointer min-w-0">
                                    <input
                                      type="radio"
                                      name={`correta-${q.id}`}
                                      checked={!!a.correta}
                                      onChange={() => marcarCorreta(q.id, a.id)}
                                      disabled={saving}
                                    />
                                    <span className="text-sm break-words">{a.texto}</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => removerAlternativa(a.id, q.id)}
                                    disabled={saving}
                                    className="text-xs underline text-rose-700 dark:text-rose-300 whitespace-nowrap disabled:opacity-60"
                                  >
                                    Remover
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* footer ações */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  Para publicar: peso total deve ser <strong>10</strong> e questões MCQ devem ter <strong>2+</strong>{" "}
                  alternativas com <strong>1 correta</strong>.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={publicar}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Publicar teste
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ✅ Modal premium: adicionar alternativa */}
      <Modal
        open={altModal.open}
        isOpen={altModal.open}
        onClose={saving ? undefined : closeAddAlternativa}
        size="sm"
        align="center"
        padding
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        labelledBy="alt-title"
        describedBy="alt-desc"
        zIndex={1600}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="alt-title" className="text-lg font-extrabold tracking-tight">
                Adicionar alternativa
              </h3>
              <p id="alt-desc" className="text-sm text-zinc-600 dark:text-zinc-300">
                Digite o texto da alternativa para esta questão.
              </p>
            </div>

            <button
              type="button"
              onClick={saving ? undefined : closeAddAlternativa}
              className="h-10 w-10 rounded-2xl grid place-items-center border border-black/10 dark:border-white/10
                         bg-white/70 dark:bg-zinc-900/60 hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-extrabold">Texto da alternativa</label>
            <input
              value={altModal.texto}
              onChange={(e) => setAltModal((p) => ({ ...p, texto: e.target.value }))}
              placeholder="Ex.: Comunicar-se de forma clara e respeitosa"
              className="w-full px-3 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900
                         shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!saving) confirmarAddAlternativa();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (!saving) closeAddAlternativa();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeAddAlternativa}
              disabled={saving}
              className="rounded-2xl px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700
                         text-slate-900 dark:text-slate-100 font-extrabold disabled:opacity-60"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={confirmarAddAlternativa}
              disabled={saving}
              className="rounded-2xl px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              <Save className="w-4 h-4 inline-block mr-2" aria-hidden="true" />
              Adicionar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
