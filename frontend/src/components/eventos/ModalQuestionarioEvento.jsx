// ✅ frontend/src/components/eventos/ModalQuestionarioEvento.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Componente oficial de configuração do teste/questionário do evento.
//
// Revisão premium:
// - contrato oficial único para questionário de evento;
// - rota oficial alvo: /questionario;
// - sem /api/questionarios no frontend;
// - sem toast direto;
// - sem prop duplicada open/isOpen;
// - sem nota_minima_10 como chave paralela;
// - sem fallback legado para tempo_minutos;
// - CRUD completo de questões e alternativas;
// - validação de peso total igual a 10;
// - validação de alternativa correta única por questão objetiva;
// - publicação segura do teste;
// - diagnóstico controlado somente em DEV;
// - acessibilidade, mobile-first, estados claros e UX administrativa premium;
// - preservação de todas as funções reais do arquivo anterior.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileQuestion,
  ListChecks,
  Loader2,
  Plus,
  Repeat,
  Save,
  Target,
  Timer,
  Trash2,
  X,
} from "lucide-react";

import Modal from "../ui/Modal";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
  notifyWarning,
} from "../ui/AppToast";
import { apiDelete, apiGet, apiPost, apiPut } from "../../services/api";

/* ─────────────────────────────────────────────────────────────
   Contratos oficiais
────────────────────────────────────────────────────────────── */

const QUESTIONARIO_BASE = "/questionario";

const QUESTIONARIO_PADRAO = Object.freeze({
  titulo: "Questionário de Aprendizagem",
  descricao: "Verificação de absorção do conteúdo antes da avaliação institucional.",
  obrigatorio: true,
  minNota10: 7,
  tentativasMax: 1,
  tempoMinutos: 30,
});

const TIPOS_QUESTAO = Object.freeze([
  { value: "multipla_escolha", label: "Múltipla escolha" },
  { value: "dissertativa", label: "Dissertativa" },
]);

/* ─────────────────────────────────────────────────────────────
   Helpers gerais
────────────────────────────────────────────────────────────── */

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function devLog(contexto, erro) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(contexto, erro);
  }
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return name === "AbortError" || message.includes("abort");
}

function unwrapData(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }

  return response;
}

function unwrapObject(response) {
  const data = unwrapData(response);

  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function unwrapArray(response) {
  const data = unwrapData(response);

  return Array.isArray(data) ? data : [];
}

function toPositiveId(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function encodeId(value) {
  return encodeURIComponent(String(value));
}

function questionarioEventoPath(eventoId) {
  return `${QUESTIONARIO_BASE}/evento/${encodeId(eventoId)}`;
}

function questionarioRascunhoPath(eventoId) {
  return `${QUESTIONARIO_BASE}/evento/${encodeId(eventoId)}/rascunho`;
}

function questionarioPath(questionarioId) {
  return `${QUESTIONARIO_BASE}/${encodeId(questionarioId)}`;
}

function questionarioPublicarPath(questionarioId) {
  return `${QUESTIONARIO_BASE}/${encodeId(questionarioId)}/publicar`;
}

function questaoCollectionPath(questionarioId) {
  return `${QUESTIONARIO_BASE}/${encodeId(questionarioId)}/questao`;
}

function questaoPath(questionarioId, questaoId) {
  return `${QUESTIONARIO_BASE}/${encodeId(questionarioId)}/questao/${encodeId(
    questaoId
  )}`;
}

function alternativaCollectionPath(questaoId) {
  return `${QUESTIONARIO_BASE}/questao/${encodeId(questaoId)}/alternativa`;
}

function alternativaPath(alternativaId) {
  return `${QUESTIONARIO_BASE}/alternativa/${encodeId(alternativaId)}`;
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));

  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function somarPesos(questoes = []) {
  return round2(
    (Array.isArray(questoes) ? questoes : []).reduce(
      (total, questao) => total + (Number(questao?.peso) || 0),
      0
    )
  );
}

function normalizarTexto(value) {
  return String(value ?? "").trim();
}

function normalizarTipoQuestao(value) {
  const tipo = String(value || "").trim();

  return TIPOS_QUESTAO.some((item) => item.value === tipo)
    ? tipo
    : "multipla_escolha";
}

function normalizarQuestao(questao, index = 0) {
  return {
    ...questao,
    id: questao?.id,
    tipo: normalizarTipoQuestao(questao?.tipo),
    enunciado: normalizarTexto(questao?.enunciado),
    ordem: Number(questao?.ordem) || index + 1,
    peso: clamp(Number(questao?.peso) || 1, 0.1, 10),
    alternativas: Array.isArray(questao?.alternativas)
      ? questao.alternativas
          .map((alternativa, altIndex) => ({
            ...alternativa,
            id: alternativa?.id,
            texto: normalizarTexto(alternativa?.texto),
            correta: Boolean(alternativa?.correta),
            ordem: Number(alternativa?.ordem) || altIndex + 1,
          }))
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      : [],
  };
}

function normalizarQuestoes(questoes) {
  return (Array.isArray(questoes) ? questoes : [])
    .map(normalizarQuestao)
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0));
}

function minNota10ToBackend(value) {
  const minNota10 = clamp(Number(value) || 0, 0, 10);

  return clamp(Math.round(minNota10 * 10), 0, 100);
}

function minNotaBackendTo10(value) {
  const backend = Number(value);

  if (!Number.isFinite(backend)) {
    return QUESTIONARIO_PADRAO.minNota10;
  }

  return clamp(backend / 10, 0, 10);
}

function buildConfigPayloadFromState({
  questionario,
  titulo,
  descricao,
  obrigatorio,
  minNota10,
  tentativasMax,
  tempoMinutos,
  questoes,
}) {
  return {
    questionario_id: questionario?.id ?? null,
    titulo: normalizarTexto(titulo),
    descricao: normalizarTexto(descricao),
    obrigatorio: Boolean(obrigatorio),
    min_nota: minNota10ToBackend(minNota10),
    tentativas_max: clamp(Number(tentativasMax) || 1, 1, 50),
    tempo_minutos: clamp(Number(tempoMinutos) || 30, 5, 240),
    questoes_count: Array.isArray(questoes) ? questoes.length : 0,
    peso_total: somarPesos(questoes),
    publicado: Boolean(questionario?.publicado),
  };
}

function validarMetadados({ titulo, minNota10, tentativasMax, tempoMinutos }) {
  const errors = {};

  if (!normalizarTexto(titulo)) {
    errors.titulo = "Informe um título para o teste.";
  }

  const nota = Number(minNota10);
  if (!Number.isFinite(nota) || nota < 0 || nota > 10) {
    errors.minNota10 = "Informe uma nota mínima entre 0 e 10.";
  }

  const tentativas = Number(tentativasMax);
  if (!Number.isFinite(tentativas) || tentativas < 1 || tentativas > 50) {
    errors.tentativasMax = "Informe tentativas entre 1 e 50.";
  }

  const tempo = Number(tempoMinutos);
  if (!Number.isFinite(tempo) || tempo < 5 || tempo > 240) {
    errors.tempoMinutos = "Informe um tempo entre 5 e 240 minutos.";
  }

  return errors;
}

function validarPublicacao(questoes, pesoTotal) {
  if (!Array.isArray(questoes) || questoes.length === 0) {
    return "Adicione ao menos uma questão antes de publicar o teste.";
  }

  if (round2(pesoTotal) !== 10) {
    const diferenca = round2(10 - pesoTotal);

    return `A soma dos pesos deve fechar 10. Atualmente está em ${pesoTotal}. Diferença: ${diferenca}.`;
  }

  for (const questao of questoes) {
    if (!normalizarTexto(questao?.enunciado)) {
      return "Todas as questões precisam ter enunciado.";
    }

    if (questao?.tipo !== "multipla_escolha") {
      continue;
    }

    const alternativas = Array.isArray(questao?.alternativas)
      ? questao.alternativas
      : [];

    if (alternativas.length < 2) {
      return `A questão "${String(questao?.enunciado || "").slice(
        0,
        48
      )}..." precisa de pelo menos 2 alternativas.`;
    }

    const corretas = alternativas.filter((alternativa) =>
      Boolean(alternativa?.correta)
    ).length;

    if (corretas !== 1) {
      return `A questão "${String(questao?.enunciado || "").slice(
        0,
        48
      )}..." precisa ter exatamente 1 alternativa correta.`;
    }
  }

  return "";
}

/* ─────────────────────────────────────────────────────────────
   Componente principal
────────────────────────────────────────────────────────────── */

export default function ModalQuestionarioEvento({
  open,
  onClose,
  eventoId,
  onlyAdmin = false,
  onConfigSaved,
}) {
  const mountedRef = useRef(false);
  const firstInputRef = useRef(null);
  const abortRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [questionario, setQuestionario] = useState(null);
  const [questoes, setQuestoes] = useState([]);

  const [titulo, setTitulo] = useState(QUESTIONARIO_PADRAO.titulo);
  const [descricao, setDescricao] = useState(QUESTIONARIO_PADRAO.descricao);
  const [obrigatorio, setObrigatorio] = useState(QUESTIONARIO_PADRAO.obrigatorio);
  const [minNota10, setMinNota10] = useState(QUESTIONARIO_PADRAO.minNota10);
  const [tentativasMax, setTentativasMax] = useState(
    QUESTIONARIO_PADRAO.tentativasMax
  );
  const [tempoMinutos, setTempoMinutos] = useState(
    QUESTIONARIO_PADRAO.tempoMinutos
  );

  const [novoTipo, setNovoTipo] = useState("multipla_escolha");
  const [novoEnunciado, setNovoEnunciado] = useState("");
  const [novoPeso, setNovoPeso] = useState(1);

  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [liveMessage, setLiveMessage] = useState("");

  const [altModal, setAltModal] = useState({
    open: false,
    questaoId: null,
    texto: "",
  });

  const eventoIdValido = toPositiveId(eventoId);

  const pesoTotal = useMemo(() => somarPesos(questoes), [questoes]);
  const faltaPara10 = useMemo(() => round2(10 - pesoTotal), [pesoTotal]);

  const publicacaoBloqueio = useMemo(
    () => validarPublicacao(questoes, pesoTotal),
    [questoes, pesoTotal]
  );

  const metadadosInvalidos = useMemo(
    () =>
      validarMetadados({
        titulo,
        minNota10,
        tentativasMax,
        tempoMinutos,
      }),
    [titulo, minNota10, tentativasMax, tempoMinutos]
  );

  const podeSalvarMetadados = Object.keys(metadadosInvalidos).length === 0;
  const podePublicar = !publicacaoBloqueio && podeSalvarMetadados && !saving;

  const emitirConfig = useCallback(
    (overrides = {}) => {
      const payload = buildConfigPayloadFromState({
        questionario,
        titulo,
        descricao,
        obrigatorio,
        minNota10,
        tentativasMax,
        tempoMinutos,
        questoes,
      });

      onConfigSaved?.({
        evento_id: eventoIdValido,
        ...payload,
        ...overrides,
      });
    },
    [
      descricao,
      eventoIdValido,
      minNota10,
      obrigatorio,
      onConfigSaved,
      questionario,
      questoes,
      tempoMinutos,
      tentativasMax,
      titulo,
    ]
  );

  const announce = useCallback((message) => {
    setLiveMessage("");

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => setLiveMessage(message));
      return;
    }

    setLiveMessage(message);
  }, []);

  const hydrateQuestionario = useCallback(
    (q) => {
      const questoesNormalizadas = normalizarQuestoes(q?.questoes);

      const tituloSeguro = q?.titulo || QUESTIONARIO_PADRAO.titulo;
      const descricaoSegura = q?.descricao || QUESTIONARIO_PADRAO.descricao;
      const obrigatorioSeguro =
        typeof q?.obrigatorio === "boolean"
          ? q.obrigatorio
          : QUESTIONARIO_PADRAO.obrigatorio;

      const minNotaBackend =
        q?.min_nota == null ? minNota10ToBackend(QUESTIONARIO_PADRAO.minNota10) : Number(q.min_nota);

      const tentativasSeguras =
        q?.tentativas_max == null
          ? QUESTIONARIO_PADRAO.tentativasMax
          : clamp(Number(q.tentativas_max), 1, 50);

      const tempoSeguro =
        q?.tempo_minutos == null
          ? QUESTIONARIO_PADRAO.tempoMinutos
          : clamp(Number(q.tempo_minutos), 5, 240);

      setQuestionario(q || null);
      setTitulo(tituloSeguro);
      setDescricao(descricaoSegura);
      setObrigatorio(obrigatorioSeguro);
      setMinNota10(minNotaBackendTo10(minNotaBackend));
      setTentativasMax(tentativasSeguras);
      setTempoMinutos(tempoSeguro);
      setQuestoes(questoesNormalizadas);

      onConfigSaved?.({
        evento_id: eventoIdValido,
        questionario_id: q?.id ?? null,
        titulo: tituloSeguro,
        descricao: descricaoSegura,
        obrigatorio: obrigatorioSeguro,
        min_nota: Number.isFinite(minNotaBackend)
          ? minNotaBackend
          : minNota10ToBackend(QUESTIONARIO_PADRAO.minNota10),
        tentativas_max: tentativasSeguras,
        tempo_minutos: tempoSeguro,
        questoes_count: questoesNormalizadas.length,
        peso_total: somarPesos(questoesNormalizadas),
        publicado: Boolean(q?.publicado),
        carregado: true,
      });
    },
    [eventoIdValido, onConfigSaved]
  );

  const carregar = useCallback(
    async ({ signal } = {}) => {
      if (!eventoIdValido) {
        notifyWarning("Evento inválido para configurar questionário.");
        return;
      }

      setLoading(true);
      setErrors({});

      try {
        await apiPost(questionarioRascunhoPath(eventoIdValido), {}, { signal });

        const response = await apiGet(questionarioEventoPath(eventoIdValido), {
          signal,
          auth: true,
          on401: "redirect",
          on403: "silent",
        });

        if (!mountedRef.current || signal?.aborted) {
          return;
        }

        const q = unwrapObject(response);

        hydrateQuestionario(q);
        announce("Questionário carregado.");
      } catch (error) {
        if (isAbortLike(error)) return;

        devLog("Erro ao carregar/gerar questionário:", error);
        notifyError("Erro ao carregar ou gerar questionário.");
        announce("Erro ao carregar o questionário.");
      } finally {
        if (mountedRef.current && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [announce, eventoIdValido, hydrateQuestionario]
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort?.();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort?.();
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    carregar({ signal: controller.signal });

    const timer = window.setTimeout(() => {
      firstInputRef.current?.focus();
    }, 80);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [carregar, open]);

  const salvarMetadados = useCallback(
    async ({ silent = false } = {}) => {
      if (!questionario?.id || saving) {
        return null;
      }

      const validation = validarMetadados({
        titulo,
        minNota10,
        tentativasMax,
        tempoMinutos,
      });

      setErrors(validation);

      if (Object.keys(validation).length > 0) {
        if (!silent) {
          notifyWarning("Corrija as configurações destacadas.");
        }

        return null;
      }

      const payload = {
        titulo: normalizarTexto(titulo),
        descricao: normalizarTexto(descricao),
        obrigatorio: Boolean(obrigatorio),
        min_nota: minNota10ToBackend(minNota10),
        tentativas_max: clamp(Number(tentativasMax) || 1, 1, 50),
        tempo_minutos: clamp(Number(tempoMinutos) || 30, 5, 240),
      };

      setSaving(true);

      try {
        const response = await apiPut(questionarioPath(questionario.id), payload, {
          auth: true,
          on401: "redirect",
          on403: "silent",
        });

        const atualizado = unwrapObject(response) || {};

        if (!mountedRef.current) {
          return null;
        }

        setQuestionario((prev) => ({
          ...(prev || {}),
          ...atualizado,
          ...payload,
        }));

        if (!silent) {
          notifySuccess("Configurações do teste salvas.");
        }

        emitirConfig({
          ...payload,
          salvo_em: Date.now(),
        });

        announce("Configurações do teste salvas.");
        return atualizado;
      } catch (error) {
        devLog("Erro ao salvar configurações do questionário:", error);

        if (!silent) {
          notifyError("Erro ao salvar configurações do teste.");
        }

        announce("Erro ao salvar configurações do teste.");
        throw error;
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [
      announce,
      descricao,
      emitirConfig,
      minNota10,
      obrigatorio,
      questionario?.id,
      saving,
      tempoMinutos,
      tentativasMax,
      titulo,
    ]
  );

  const adicionarQuestao = useCallback(async () => {
    if (!questionario?.id || saving) {
      return;
    }

    const enunciado = normalizarTexto(novoEnunciado);

    if (enunciado.length < 5) {
      notifyInfo("Digite um enunciado com pelo menos 5 caracteres.");
      return;
    }

    const peso = clamp(Number(novoPeso) || 1, 0.1, 10);

    setSaving(true);

    try {
      const response = await apiPost(
        questaoCollectionPath(questionario.id),
        {
          tipo: normalizarTipoQuestao(novoTipo),
          enunciado,
          ordem: questoes.length + 1,
          peso,
        },
        {
          auth: true,
          on401: "redirect",
          on403: "silent",
        }
      );

      const inserida = unwrapObject(response);

      if (!mountedRef.current || !inserida) {
        return;
      }

      const novaQuestao = normalizarQuestao(
        {
          ...inserida,
          alternativas: unwrapArray(inserida.alternativas),
        },
        questoes.length
      );

      const nextQuestoes = [...questoes, novaQuestao];

      setQuestoes(nextQuestoes);
      setNovoEnunciado("");
      setNovoPeso(1);

      notifySuccess("Questão adicionada.");
      announce("Questão adicionada.");
      emitirConfig({
        questoes_count: nextQuestoes.length,
        peso_total: somarPesos(nextQuestoes),
      });
    } catch (error) {
      devLog("Erro ao adicionar questão:", error);
      notifyError("Erro ao adicionar questão.");
      announce("Erro ao adicionar questão.");
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    announce,
    emitirConfig,
    novoEnunciado,
    novoPeso,
    novoTipo,
    questionario?.id,
    questoes,
    saving,
  ]);

  const atualizarQuestao = useCallback(
    async (questao) => {
      if (!questionario?.id || !questao?.id || saving) {
        return;
      }

      const enunciado = normalizarTexto(questao.enunciado);

      if (enunciado.length < 5) {
        notifyInfo("O enunciado deve ter pelo menos 5 caracteres.");
        return;
      }

      const peso = clamp(Number(questao.peso) || 1, 0.1, 10);

      setSaving(true);

      try {
        const response = await apiPut(
          questaoPath(questionario.id, questao.id),
          {
            enunciado,
            peso,
            ordem: Number(questao.ordem) || 1,
            tipo: normalizarTipoQuestao(questao.tipo),
          },
          {
            auth: true,
            on401: "redirect",
            on403: "silent",
          }
        );

        const atualizada = unwrapObject(response) || {};

        if (!mountedRef.current) {
          return;
        }

        const nextQuestoes = questoes.map((item) =>
          item.id === questao.id
            ? normalizarQuestao({
                ...item,
                ...atualizada,
                enunciado,
                peso,
              })
            : item
        );

        setQuestoes(nextQuestoes);
        setEditId(null);

        notifySuccess("Questão atualizada.");
        announce("Questão atualizada.");
        emitirConfig({
          questoes_count: nextQuestoes.length,
          peso_total: somarPesos(nextQuestoes),
        });
      } catch (error) {
        devLog("Erro ao atualizar questão:", error);
        notifyError("Erro ao atualizar questão.");
        announce("Erro ao atualizar questão.");
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [announce, emitirConfig, questionario?.id, questoes, saving]
  );

  const removerQuestao = useCallback(
    async (questaoId) => {
      if (!questionario?.id || !questaoId || saving) {
        return;
      }

      setSaving(true);

      try {
        await apiDelete(questaoPath(questionario.id, questaoId), {
          auth: true,
          on401: "redirect",
          on403: "silent",
        });

        if (!mountedRef.current) {
          return;
        }

        const nextQuestoes = questoes
          .filter((item) => item.id !== questaoId)
          .map((item, index) => ({
            ...item,
            ordem: index + 1,
          }));

        setQuestoes(nextQuestoes);

        notifyInfo("Questão removida.");
        announce("Questão removida.");
        emitirConfig({
          questoes_count: nextQuestoes.length,
          peso_total: somarPesos(nextQuestoes),
        });
      } catch (error) {
        devLog("Erro ao remover questão:", error);
        notifyError("Erro ao remover questão.");
        announce("Erro ao remover questão.");
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [announce, emitirConfig, questionario?.id, questoes, saving]
  );

  const abrirModalAlternativa = useCallback((questaoId) => {
    setAltModal({
      open: true,
      questaoId,
      texto: "",
    });
  }, []);

  const fecharModalAlternativa = useCallback(() => {
    setAltModal({
      open: false,
      questaoId: null,
      texto: "",
    });
  }, []);

  const confirmarAdicionarAlternativa = useCallback(async () => {
    if (!altModal.questaoId || saving) {
      return;
    }

    const texto = normalizarTexto(altModal.texto);

    if (!texto) {
      notifyError("Informe o texto da alternativa.");
      return;
    }

    const questao = questoes.find((item) => item.id === altModal.questaoId);
    const alternativas = Array.isArray(questao?.alternativas)
      ? questao.alternativas
      : [];

    setSaving(true);

    try {
      const response = await apiPost(
        alternativaCollectionPath(altModal.questaoId),
        {
          texto,
          correta: false,
          ordem: alternativas.length + 1,
        },
        {
          auth: true,
          on401: "redirect",
          on403: "silent",
        }
      );

      const inserida = unwrapObject(response);

      if (!mountedRef.current || !inserida) {
        return;
      }

      const nextQuestoes = questoes.map((item) => {
        if (item.id !== altModal.questaoId) {
          return item;
        }

        return normalizarQuestao({
          ...item,
          alternativas: [
            ...(Array.isArray(item.alternativas) ? item.alternativas : []),
            inserida,
          ],
        });
      });

      setQuestoes(nextQuestoes);
      fecharModalAlternativa();

      notifySuccess("Alternativa adicionada.");
      announce("Alternativa adicionada.");
      emitirConfig({
        questoes_count: nextQuestoes.length,
        peso_total: somarPesos(nextQuestoes),
      });
    } catch (error) {
      devLog("Erro ao adicionar alternativa:", error);
      notifyError("Erro ao adicionar alternativa.");
      announce("Erro ao adicionar alternativa.");
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    altModal.questaoId,
    altModal.texto,
    announce,
    emitirConfig,
    fecharModalAlternativa,
    questoes,
    saving,
  ]);

  const marcarCorreta = useCallback(
    async (questaoId, alternativaId) => {
      if (!questaoId || !alternativaId || saving) {
        return;
      }

      const questao = questoes.find((item) => item.id === questaoId);
      const alternativas = Array.isArray(questao?.alternativas)
        ? questao.alternativas
        : [];

      if (!alternativas.length) {
        return;
      }

      const snapshot = questoes;

      const nextQuestoes = questoes.map((item) => {
        if (item.id !== questaoId) {
          return item;
        }

        return {
          ...item,
          alternativas: item.alternativas.map((alternativa) => ({
            ...alternativa,
            correta: alternativa.id === alternativaId,
          })),
        };
      });

      setQuestoes(nextQuestoes);
      setSaving(true);

      try {
        await Promise.all(
          alternativas
            .filter((alternativa) => alternativa?.id)
            .map((alternativa) =>
              apiPut(
                alternativaPath(alternativa.id),
                {
                  correta: alternativa.id === alternativaId,
                },
                {
                  auth: true,
                  on401: "redirect",
                  on403: "silent",
                }
              )
            )
        );

        notifySuccess("Alternativa correta definida.");
        announce("Alternativa correta definida.");
        emitirConfig({
          questoes_count: nextQuestoes.length,
          peso_total: somarPesos(nextQuestoes),
        });
      } catch (error) {
        setQuestoes(snapshot);
        devLog("Erro ao marcar alternativa correta:", error);
        notifyError("Erro ao marcar alternativa correta.");
        announce("Erro ao marcar alternativa correta.");
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [announce, emitirConfig, questoes, saving]
  );

  const removerAlternativa = useCallback(
    async (alternativaId, questaoId) => {
      if (!alternativaId || !questaoId || saving) {
        return;
      }

      setSaving(true);

      try {
        await apiDelete(alternativaPath(alternativaId), {
          auth: true,
          on401: "redirect",
          on403: "silent",
        });

        if (!mountedRef.current) {
          return;
        }

        const nextQuestoes = questoes.map((questao) => {
          if (questao.id !== questaoId) {
            return questao;
          }

          return normalizarQuestao({
            ...questao,
            alternativas: questao.alternativas.filter(
              (alternativa) => alternativa.id !== alternativaId
            ),
          });
        });

        setQuestoes(nextQuestoes);

        notifyInfo("Alternativa removida.");
        announce("Alternativa removida.");
        emitirConfig({
          questoes_count: nextQuestoes.length,
          peso_total: somarPesos(nextQuestoes),
        });
      } catch (error) {
        devLog("Erro ao remover alternativa:", error);
        notifyError("Erro ao remover alternativa.");
        announce("Erro ao remover alternativa.");
      } finally {
        if (mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [announce, emitirConfig, questoes, saving]
  );

  const publicar = useCallback(async () => {
    if (!questionario?.id || saving) {
      return;
    }

    const erroMetadados = validarMetadados({
      titulo,
      minNota10,
      tentativasMax,
      tempoMinutos,
    });

    setErrors(erroMetadados);

    if (Object.keys(erroMetadados).length > 0) {
      notifyWarning("Corrija as configurações antes de publicar.");
      return;
    }

    const erroPublicacao = validarPublicacao(questoes, pesoTotal);

    if (erroPublicacao) {
      notifyError(erroPublicacao);
      return;
    }

    fecharModalAlternativa();

    try {
      await salvarMetadados({ silent: true });

      setSaving(true);

      const response = await apiPost(
        questionarioPublicarPath(questionario.id),
        {},
        {
          auth: true,
          on401: "redirect",
          on403: "silent",
        }
      );

      const publicado = unwrapObject(response) || {};

      if (!mountedRef.current) {
        return;
      }

      setQuestionario((prev) => ({
        ...(prev || {}),
        ...publicado,
        publicado: true,
      }));

      emitirConfig({
        publicado: true,
        publicado_em: Date.now(),
      });

      notifySuccess("Teste publicado com sucesso.");
      announce("Teste publicado com sucesso.");
      onClose?.();
    } catch (error) {
      devLog("Erro ao publicar teste:", error);
      notifyError(error?.data?.message || "Erro ao publicar o teste.");
      announce("Erro ao publicar o teste.");
    } finally {
      if (mountedRef.current) {
        setSaving(false);
      }
    }
  }, [
    announce,
    emitirConfig,
    fecharModalAlternativa,
    minNota10,
    onClose,
    pesoTotal,
    questionario?.id,
    questoes,
    salvarMetadados,
    saving,
    tempoMinutos,
    tentativasMax,
    titulo,
  ]);

  if (!open) {
    return null;
  }

  return (
    <>
      <Modal
        open={open}
        onClose={saving ? undefined : onClose}
        size="lg"
        align="center"
        padding={false}
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        labelledBy="questionario-evento-title"
        describedBy="questionario-evento-desc"
        zIndex={1400}
      >
        <section className="max-h-[92dvh] overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-slate-100">
          <header className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 px-5 py-5 text-white sm:px-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-lime-300/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Teste do evento
                  {onlyAdmin ? " • Admin" : ""}
                </div>

                <h3
                  id="questionario-evento-title"
                  className="mt-3 text-xl font-black tracking-tight sm:text-2xl"
                >
                  Configurar teste/questionário
                </h3>

                <p
                  id="questionario-evento-desc"
                  className="mt-1 max-w-3xl text-sm text-emerald-50/90"
                >
                  Configure regras, questões e alternativas. Para publicar, o peso
                  total precisa fechar 10 e cada questão objetiva precisa ter
                  exatamente uma alternativa correta.
                </p>
              </div>

              <button
                type="button"
                onClick={saving ? undefined : onClose}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Fechar configuração do teste"
                disabled={saving}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="max-h-[calc(92dvh-132px)] overflow-y-auto px-5 py-5 sm:px-6">
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveMessage}
            </p>

            {loading ? (
              <LoadingState />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    icon={ListChecks}
                    label="Questões"
                    value={String(questoes.length)}
                    hint="Itens cadastrados"
                  />

                  <MetricCard
                    icon={Target}
                    label="Peso total"
                    value={`${pesoTotal} / 10`}
                    hint={
                      round2(pesoTotal) === 10
                        ? "Fechado corretamente"
                        : faltaPara10 > 0
                          ? `Faltam ${faltaPara10}`
                          : `Excedeu ${Math.abs(faltaPara10)}`
                    }
                    tone={round2(pesoTotal) === 10 ? "success" : "danger"}
                  />

                  <MetricCard
                    icon={Repeat}
                    label="Tentativas"
                    value={String(tentativasMax)}
                    hint="Por participante"
                  />

                  <MetricCard
                    icon={Timer}
                    label="Tempo"
                    value={`${tempoMinutos} min`}
                    hint="Duração do teste"
                  />
                </div>

                <ConfigSection
                  titulo={titulo}
                  setTitulo={setTitulo}
                  descricao={descricao}
                  setDescricao={setDescricao}
                  obrigatorio={obrigatorio}
                  setObrigatorio={setObrigatorio}
                  minNota10={minNota10}
                  setMinNota10={setMinNota10}
                  tentativasMax={tentativasMax}
                  setTentativasMax={setTentativasMax}
                  tempoMinutos={tempoMinutos}
                  setTempoMinutos={setTempoMinutos}
                  errors={errors}
                  saving={saving}
                  firstInputRef={firstInputRef}
                  onSalvar={() => salvarMetadados()}
                />

                <QuestionCreateSection
                  novoTipo={novoTipo}
                  setNovoTipo={setNovoTipo}
                  novoEnunciado={novoEnunciado}
                  setNovoEnunciado={setNovoEnunciado}
                  novoPeso={novoPeso}
                  setNovoPeso={setNovoPeso}
                  saving={saving}
                  onAdicionar={adicionarQuestao}
                />

                <QuestionsSection
                  questoes={questoes}
                  setQuestoes={setQuestoes}
                  editId={editId}
                  setEditId={setEditId}
                  saving={saving}
                  onAtualizarQuestao={atualizarQuestao}
                  onRemoverQuestao={removerQuestao}
                  onAbrirAlternativa={abrirModalAlternativa}
                  onMarcarCorreta={marcarCorreta}
                  onRemoverAlternativa={removerAlternativa}
                />

                <FooterActions
                  saving={saving}
                  podePublicar={podePublicar}
                  publicacaoBloqueio={publicacaoBloqueio}
                  onPublicar={publicar}
                />
              </div>
            )}
          </div>
        </section>
      </Modal>

      <Modal
        open={altModal.open}
        onClose={saving ? undefined : fecharModalAlternativa}
        size="sm"
        align="center"
        padding={false}
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
        labelledBy="alternativa-title"
        describedBy="alternativa-desc"
        zIndex={1600}
      >
        <section className="overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-slate-100">
          <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h3 id="alternativa-title" className="text-lg font-black">
                Adicionar alternativa
              </h3>

              <p
                id="alternativa-desc"
                className="mt-1 text-sm text-slate-500 dark:text-slate-400"
              >
                Digite o texto da alternativa para esta questão.
              </p>
            </div>

            <button
              type="button"
              onClick={saving ? undefined : fecharModalAlternativa}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              aria-label="Fechar modal de alternativa"
              disabled={saving}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 px-5 py-5">
            <label className="block">
              <span className="text-sm font-black">Texto da alternativa</span>

              <input
                value={altModal.texto}
                onChange={(event) =>
                  setAltModal((prev) => ({ ...prev, texto: event.target.value }))
                }
                placeholder="Ex.: Comunicar-se de forma clara e respeitosa"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-900"
                autoFocus
                disabled={saving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmarAdicionarAlternativa();
                  }

                  if (event.key === "Escape" && !saving) {
                    event.preventDefault();
                    fecharModalAlternativa();
                  }
                }}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="neutral"
                onClick={fecharModalAlternativa}
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="primary"
                icon={Save}
                onClick={confirmarAdicionarAlternativa}
                loading={saving}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </section>
      </Modal>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Subcomponentes
────────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Carregando questionário...
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800"
          />
        ))}
      </div>

      <div className="h-56 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone = "neutral" }) {
  const toneClass = {
    neutral:
      "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
    danger:
      "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
  };

  return (
    <article
      className={classNames(
        "rounded-3xl border p-4 shadow-sm",
        toneClass[tone] || toneClass.neutral
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/60 ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide opacity-70">
            {label}
          </p>
          <p className="mt-1 text-xl font-black">{value}</p>
          <p className="mt-0.5 text-xs font-semibold opacity-70">{hint}</p>
        </div>
      </div>
    </article>
  );
}

function ConfigSection({
  titulo,
  setTitulo,
  descricao,
  setDescricao,
  obrigatorio,
  setObrigatorio,
  minNota10,
  setMinNota10,
  tentativasMax,
  setTentativasMax,
  tempoMinutos,
  setTempoMinutos,
  errors,
  saving,
  firstInputRef,
  onSalvar,
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-black text-slate-950 dark:text-white">
            Configurações do teste
          </h4>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Defina regras de nota, tentativas e tempo antes de publicar.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          icon={Save}
          onClick={onSalvar}
          disabled={saving}
          loading={saving}
        >
          Salvar configurações
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-black">Título</span>

          <input
            ref={firstInputRef}
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            className={inputClass(errors?.titulo)}
            aria-invalid={Boolean(errors?.titulo)}
            disabled={saving}
          />

          {errors?.titulo && <FieldError>{errors.titulo}</FieldError>}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-black">Descrição</span>

          <textarea
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            className={classNames(inputClass(false), "min-h-24 resize-y")}
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className="text-sm font-black">Nota mínima (0 a 10)</span>

          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={minNota10}
            onChange={(event) =>
              setMinNota10(clamp(toNumber(event.target.value) ?? 0, 0, 10))
            }
            className={inputClass(errors?.minNota10)}
            aria-invalid={Boolean(errors?.minNota10)}
            disabled={saving}
          />

          {errors?.minNota10 && <FieldError>{errors.minNota10}</FieldError>}
        </label>

        <label className="block">
          <span className="text-sm font-black">Tentativas (1 a 50)</span>

          <input
            type="number"
            min={1}
            max={50}
            step={1}
            value={tentativasMax}
            onChange={(event) =>
              setTentativasMax(clamp(toNumber(event.target.value) ?? 1, 1, 50))
            }
            className={inputClass(errors?.tentativasMax)}
            aria-invalid={Boolean(errors?.tentativasMax)}
            disabled={saving}
          />

          {errors?.tentativasMax && <FieldError>{errors.tentativasMax}</FieldError>}
        </label>

        <label className="block">
          <span className="text-sm font-black">Tempo do teste (min)</span>

          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={tempoMinutos}
            onChange={(event) =>
              setTempoMinutos(clamp(toNumber(event.target.value) ?? 30, 5, 240))
            }
            className={inputClass(errors?.tempoMinutos)}
            aria-invalid={Boolean(errors?.tempoMinutos)}
            disabled={saving}
          />

          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Contrato oficial: campo enviado como tempo_minutos.
          </p>

          {errors?.tempoMinutos && <FieldError>{errors.tempoMinutos}</FieldError>}
        </label>

        <label className="flex min-h-[76px] cursor-pointer items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
          <input
            type="checkbox"
            checked={obrigatorio}
            onChange={(event) => setObrigatorio(event.target.checked)}
            className="h-5 w-5 accent-emerald-700"
            disabled={saving}
          />

          <span>
            <span className="block text-sm font-black">Obrigatório</span>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              Se ativo, o aluno precisa concluir o teste antes da próxima etapa.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

function QuestionCreateSection({
  novoTipo,
  setNovoTipo,
  novoEnunciado,
  setNovoEnunciado,
  novoPeso,
  setNovoPeso,
  saving,
  onAdicionar,
}) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h4 className="text-base font-black text-slate-950 dark:text-white">
          Adicionar questão
        </h4>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Monte o teste com pesos que somem exatamente 10.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_1fr_120px_auto] lg:items-end">
        <label className="block">
          <span className="text-sm font-black">Tipo</span>

          <select
            value={novoTipo}
            onChange={(event) => setNovoTipo(event.target.value)}
            className={inputClass(false)}
            disabled={saving}
          >
            {TIPOS_QUESTAO.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-black">Enunciado</span>

          <input
            value={novoEnunciado}
            onChange={(event) => setNovoEnunciado(event.target.value)}
            placeholder="Digite a pergunta..."
            className={inputClass(false)}
            disabled={saving}
          />
        </label>

        <label className="block">
          <span className="text-sm font-black">Peso</span>

          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={novoPeso}
            onChange={(event) =>
              setNovoPeso(clamp(toNumber(event.target.value) ?? 1, 0.1, 10))
            }
            className={inputClass(false)}
            disabled={saving}
          />
        </label>

        <Button
          type="button"
          variant="secondary"
          icon={Plus}
          onClick={onAdicionar}
          disabled={saving}
        >
          Adicionar
        </Button>
      </div>
    </section>
  );
}

function QuestionsSection({
  questoes,
  setQuestoes,
  editId,
  setEditId,
  saving,
  onAtualizarQuestao,
  onRemoverQuestao,
  onAbrirAlternativa,
  onMarcarCorreta,
  onRemoverAlternativa,
}) {
  if (!questoes.length) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <FileQuestion
          className="mx-auto h-10 w-10 text-slate-400"
          aria-hidden="true"
        />

        <h4 className="mt-3 text-base font-black text-slate-950 dark:text-white">
          Nenhuma questão cadastrada
        </h4>

        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Adicione questões para montar o teste. Para publicar, a soma dos pesos
          deve ser exatamente 10.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Questões cadastradas">
      {questoes.map((questao, index) => {
        const isEditing = editId === questao.id;
        const alternativas = Array.isArray(questao.alternativas)
          ? questao.alternativas
          : [];

        return (
          <article
            key={questao.id}
            className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Questão #{index + 1}</span>
                  <span>•</span>
                  <span>
                    {questao.tipo === "multipla_escolha"
                      ? "Múltipla escolha"
                      : "Dissertativa"}
                  </span>
                  <span>•</span>
                  <span>Peso {Number(questao.peso) || 0}</span>
                </div>

                {isEditing ? (
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="text-sm font-black">Enunciado</span>

                      <input
                        value={questao.enunciado || ""}
                        onChange={(event) =>
                          setQuestoes((prev) =>
                            prev.map((item) =>
                              item.id === questao.id
                                ? { ...item, enunciado: event.target.value }
                                : item
                            )
                          )
                        }
                        className={inputClass(false)}
                        disabled={saving}
                      />
                    </label>

                    <label className="block max-w-40">
                      <span className="text-sm font-black">Peso</span>

                      <input
                        type="number"
                        min={0.1}
                        max={10}
                        step={0.1}
                        value={questao.peso ?? 1}
                        onChange={(event) =>
                          setQuestoes((prev) =>
                            prev.map((item) =>
                              item.id === questao.id
                                ? {
                                    ...item,
                                    peso: clamp(
                                      toNumber(event.target.value) ?? 1,
                                      0.1,
                                      10
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        className={inputClass(false)}
                        disabled={saving}
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => onAtualizarQuestao(questao)}
                        disabled={saving}
                      >
                        Salvar questão
                      </Button>

                      <Button
                        type="button"
                        variant="neutral"
                        onClick={() => setEditId(null)}
                        disabled={saving}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 break-words text-base font-black text-slate-950 dark:text-white">
                    {questao.enunciado}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!isEditing && (
                  <Button
                    type="button"
                    variant="neutral"
                    icon={Edit3}
                    onClick={() => setEditId(questao.id)}
                    disabled={saving}
                  >
                    Editar
                  </Button>
                )}

                <Button
                  type="button"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => onRemoverQuestao(questao.id)}
                  disabled={saving}
                >
                  Remover
                </Button>
              </div>
            </div>

            {questao.tipo === "multipla_escolha" && (
              <AlternativasSection
                questao={questao}
                alternativas={alternativas}
                saving={saving}
                onAbrirAlternativa={onAbrirAlternativa}
                onMarcarCorreta={onMarcarCorreta}
                onRemoverAlternativa={onRemoverAlternativa}
              />
            )}
          </article>
        );
      })}
    </section>
  );
}

function AlternativasSection({
  questao,
  alternativas,
  saving,
  onAbrirAlternativa,
  onMarcarCorreta,
  onRemoverAlternativa,
}) {
  return (
    <section className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="text-sm font-black text-slate-950 dark:text-white">
            Alternativas ({alternativas.length})
          </h5>

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Regra: mínimo de 2 alternativas e exatamente 1 correta.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          icon={Plus}
          onClick={() => onAbrirAlternativa(questao.id)}
          disabled={saving}
        >
          Alternativa
        </Button>
      </div>

      {alternativas.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Nenhuma alternativa cadastrada.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {alternativas.map((alternativa) => (
            <div
              key={alternativa.id}
              className={classNames(
                "flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-start sm:justify-between",
                alternativa.correta
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              )}
            >
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name={`correta-${questao.id}`}
                  checked={Boolean(alternativa.correta)}
                  onChange={() => onMarcarCorreta(questao.id, alternativa.id)}
                  disabled={saving}
                  className="mt-1 h-4 w-4 accent-emerald-700"
                />

                <span className="break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {alternativa.texto}
                </span>
              </label>

              <button
                type="button"
                onClick={() => onRemoverAlternativa(alternativa.id, questao.id)}
                disabled={saving}
                className="self-start rounded-xl px-3 py-1.5 text-xs font-black text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-60 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FooterActions({ saving, podePublicar, publicacaoBloqueio, onPublicar }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={classNames(
              "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
              publicacaoBloqueio
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            )}
          >
            {publicacaoBloqueio ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            )}
          </span>

          <div>
            <h4 className="text-sm font-black text-slate-950 dark:text-white">
              {publicacaoBloqueio
                ? "Pendências para publicação"
                : "Pronto para publicação"}
            </h4>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {publicacaoBloqueio ||
                "O teste atende às regras mínimas e pode ser publicado."}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          icon={CheckCircle2}
          onClick={onPublicar}
          disabled={!podePublicar}
          loading={saving}
        >
          Publicar teste
        </Button>
      </div>
    </section>
  );
}

function Button({
  children,
  icon: Icon,
  variant = "neutral",
  loading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const variants = {
    neutral:
      "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    primary:
      "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-700",
    secondary:
      "border-indigo-700 bg-indigo-700 text-white hover:bg-indigo-800 dark:border-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-700",
    danger:
      "border-rose-600 bg-rose-600 text-white hover:bg-rose-700 dark:border-rose-500 dark:bg-rose-600 dark:hover:bg-rose-700",
  };

  const RenderIcon = loading ? Loader2 : Icon;

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={classNames(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant] || variants.neutral,
        className
      )}
    >
      {RenderIcon && (
        <RenderIcon
          className={classNames("h-4 w-4", loading && "animate-spin")}
          aria-hidden="true"
        />
      )}

      {children}
    </button>
  );
}

function inputClass(hasError) {
  return classNames(
    "mt-1 w-full rounded-2xl border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition dark:bg-slate-950 dark:text-slate-100",
    hasError
      ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15 dark:border-rose-700"
      : "border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800"
  );
}

function FieldError({ children }) {
  return (
    <p className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
      {children}
    </p>
  );
}

/* ─────────────────────────────────────────────────────────────
   PropTypes
────────────────────────────────────────────────────────────── */

ModalQuestionarioEvento.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  eventoId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onlyAdmin: PropTypes.bool,
  onConfigSaved: PropTypes.func,
};

MetricCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  hint: PropTypes.string,
  tone: PropTypes.oneOf(["neutral", "success", "danger"]),
};

ConfigSection.propTypes = {
  titulo: PropTypes.string.isRequired,
  setTitulo: PropTypes.func.isRequired,
  descricao: PropTypes.string.isRequired,
  setDescricao: PropTypes.func.isRequired,
  obrigatorio: PropTypes.bool.isRequired,
  setObrigatorio: PropTypes.func.isRequired,
  minNota10: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  setMinNota10: PropTypes.func.isRequired,
  tentativasMax: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  setTentativasMax: PropTypes.func.isRequired,
  tempoMinutos: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  setTempoMinutos: PropTypes.func.isRequired,
  errors: PropTypes.object,
  saving: PropTypes.bool.isRequired,
  firstInputRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  onSalvar: PropTypes.func.isRequired,
};

QuestionCreateSection.propTypes = {
  novoTipo: PropTypes.string.isRequired,
  setNovoTipo: PropTypes.func.isRequired,
  novoEnunciado: PropTypes.string.isRequired,
  setNovoEnunciado: PropTypes.func.isRequired,
  novoPeso: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  setNovoPeso: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  onAdicionar: PropTypes.func.isRequired,
};

QuestionsSection.propTypes = {
  questoes: PropTypes.array.isRequired,
  setQuestoes: PropTypes.func.isRequired,
  editId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  setEditId: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  onAtualizarQuestao: PropTypes.func.isRequired,
  onRemoverQuestao: PropTypes.func.isRequired,
  onAbrirAlternativa: PropTypes.func.isRequired,
  onMarcarCorreta: PropTypes.func.isRequired,
  onRemoverAlternativa: PropTypes.func.isRequired,
};

AlternativasSection.propTypes = {
  questao: PropTypes.object.isRequired,
  alternativas: PropTypes.array.isRequired,
  saving: PropTypes.bool.isRequired,
  onAbrirAlternativa: PropTypes.func.isRequired,
  onMarcarCorreta: PropTypes.func.isRequired,
  onRemoverAlternativa: PropTypes.func.isRequired,
};

FooterActions.propTypes = {
  saving: PropTypes.bool.isRequired,
  podePublicar: PropTypes.bool.isRequired,
  publicacaoBloqueio: PropTypes.string,
  onPublicar: PropTypes.func.isRequired,
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType,
  variant: PropTypes.oneOf(["neutral", "primary", "secondary", "danger"]),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

FieldError.propTypes = {
  children: PropTypes.node.isRequired,
};