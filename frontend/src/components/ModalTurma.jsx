/* eslint-disable no-console */
// 📁 src/components/ModalTurma.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, Hash, Type, PlusCircle, Trash2, Users } from "lucide-react";
import { toast } from "react-toastify";
import Modal from "./Modal";

/* ===================== Logger cirúrgico ===================== */
// ✅ Vite/ESM-safe
const IS_DEV = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) ? true : false;

const LOG_TAG = "[ModalTurma]";
const stamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const log = (msg, data) => {
  if (!IS_DEV) return;
  if (data !== undefined) console.log(`${stamp()} ${LOG_TAG} ${msg}`, data);
  else console.log(`${stamp()} ${LOG_TAG} ${msg}`);
};
const group = (title) => IS_DEV && console.groupCollapsed(`${stamp()} ${LOG_TAG} ${title}`);
const groupEnd = () => IS_DEV && console.groupEnd();
const time = (id) => IS_DEV && console.time(`${LOG_TAG} ${id}`);
const timeEnd = (id) => IS_DEV && console.timeEnd(`${LOG_TAG} ${id}`);

/* ===================== Helpers ===================== */
const NOME_TURMA_MAX = 200;

const parseHora = (val) => {
  if (typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";

  // "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const hh = String(Math.min(23, Math.max(0, parseInt(raw.slice(0, 2) || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(raw.slice(2, 4) || "0", 10)))).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // "8:0", "08:00", "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return "";
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`;
};
const hhmm = (s, fb = "") => parseHora(s) || fb;

/**
 * ✅ Mantém “YYYY-MM-DD” SEM deslocar fuso.
 * - Se vier string, extrai os 10 primeiros do padrão.
 * - Se vier Date, usa getters locais (não UTC).
 * - Se vier number/object estranho, retorna "" (não inventa).
 */
const isoDay = (v) => {
  if (!v) return "";
  if (typeof v === "string") {
    const m = v.match(/^\d{4}-\d{2}-\d{2}/);
    return m ? m[0] : "";
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
};

const calcularCargaHorariaTotal = (arr) => {
  let horas = 0;
  for (const e of arr) {
    const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
    const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
    const diffH = Math.max(0, (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60);
    horas += diffH >= 8 ? diffH - 1 : diffH; // regra do almoço
  }
  return Math.round(horas);
};

/** Tenta extrair um array de datas/encontros de diferentes formatos */
const pickDatasArray = (t) => {
  if (!t) return null;
  const candidatos = [t.datas, t.encontros, t.datas_turma, t.datasReais].filter(Array.isArray);
  return candidatos.length ? candidatos[0] : null;
};

const datasParaEncontros = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");

  const arrDatas = pickDatasArray(t);
  if (!arrDatas) return null;

  const arr = arrDatas
    .map((d) => ({
      data: isoDay(d?.data || d),
      inicio: hhmm(d?.inicio ?? d?.horario_inicio, baseHi),
      fim: hhmm(d?.fim ?? d?.horario_fim, baseHf),
    }))
    .filter((x) => x.data);

  return arr.length ? arr : null;
};

/**
 * Aceita encontros tanto com {inicio,fim} quanto {horario_inicio,horario_fim}.
 * Fallback: se não houver array, tenta montar com data_inicio/data_fim.
 */
const encontrosDoInitial = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");

  const conv = datasParaEncontros(t);
  if (conv) return conv;

  const di = isoDay(t?.data_inicio);
  const df = isoDay(t?.data_fim);

  if (di && df) {
    if (di === df) return [{ data: di, inicio: baseHi, fim: baseHf }];
    return [
      { data: di, inicio: baseHi, fim: baseHf },
      { data: df, inicio: baseHi, fim: baseHf },
    ];
  }
  if (di) return [{ data: di, inicio: baseHi, fim: baseHf }];

  return [{ data: "", inicio: "", fim: "" }];
};

const extractIds = (arr) =>
  Array.isArray(arr) ? arr.map((v) => Number(v?.id ?? v)).filter((n) => Number.isFinite(n)) : [];

/* ===================== Componente ===================== */
export default function ModalTurma({
  isOpen,
  onClose,
  onSalvar,
  initialTurma = null,
  onExcluir,
  usuarios = [],
}) {
  const [nome, setNome] = useState("");
  const [vagasTotal, setVagasTotal] = useState("");
  const [encontros, setEncontros] = useState([{ data: "", inicio: "", fim: "" }]);

  const [instrutoresSel, setInstrutoresSel] = useState([""]);
  const [assinanteId, setAssinanteId] = useState("");

  // ✅ Rehidrata quando abre OU quando muda a turma mesmo aberto
  const lastHydratedKeyRef = useRef(null);
  const initialKey = String(initialTurma?.id ?? "new");

  useEffect(() => {
    if (!isOpen) {
      if (lastHydratedKeyRef.current != null) {
        log("Fechando modal — limpando lastHydratedKeyRef.");
      }
      lastHydratedKeyRef.current = null;
      return;
    }

    if (lastHydratedKeyRef.current === initialKey) return;

    group("Abertura/Troca de Turma • Hidratação");
    time("hydrate");

    log("isOpen=true | initialTurma recebido:", initialTurma);

    setNome(initialTurma?.nome || "");
    setVagasTotal(initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : "");

    const encontrosInit = encontrosDoInitial(initialTurma);
    log("Encontros parseados a partir do initialTurma:", encontrosInit);
    setEncontros(encontrosInit);

    const ids = extractIds(initialTurma?.instrutores);
    const arrInstr = ids.length ? ids.map(String) : [""];
    log("Instrutores (ids) hidratados:", arrInstr);
    setInstrutoresSel(arrInstr);

    const assinante =
      Number.isFinite(Number(initialTurma?.assinante_id))
        ? String(initialTurma.assinante_id)
        : Number.isFinite(Number(initialTurma?.instrutor_assinante_id))
        ? String(initialTurma.instrutor_assinante_id)
        : "";
    log("Assinante hidratado:", assinante);
    setAssinanteId(assinante);

    lastHydratedKeyRef.current = initialKey;

    setTimeout(() => {
      autosizeNome();
      timeEnd("hydrate");
      groupEnd();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialKey]);

  // se assinante sair da lista de instrutores, limpar
  useEffect(() => {
    const setIds = new Set(instrutoresSel.filter(Boolean).map(String));
    if (assinanteId && !setIds.has(String(assinanteId))) {
      log("Assinante não está mais na lista; limpando.", { assinanteIdAntes: assinanteId, instrutoresSel });
      setAssinanteId("");
    }
  }, [instrutoresSel, assinanteId]);

  // auto-resize do título
  const refNome = useRef(null);
  const autosizeNome = () => {
    const el = refNome.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const encontrosOrdenados = useMemo(() => {
    const norm = [...(encontros || [])]
      .map((e) => ({
        ...e,
        data: isoDay(e.data),
        inicio: hhmm(e.inicio, ""),
        fim: hhmm(e.fim, ""),
      }))
      .filter((e) => e.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    return norm;
  }, [encontros]);

  const data_inicio = encontrosOrdenados[0]?.data || null;
  const data_fim = encontrosOrdenados.at(-1)?.data || null;

  const carga_horaria_preview = useMemo(
    () => calcularCargaHorariaTotal(encontrosOrdenados.filter((e) => e.data && e.inicio && e.fim)),
    [encontrosOrdenados]
  );

  /* CRUD encontros */
  const addEncontro = () => {
    const last = encontros[encontros.length - 1] || {};
    const novo = { data: "", inicio: hhmm(last.inicio, ""), fim: hhmm(last.fim, "") };
    log("Adicionar encontro (preview):", novo);
    setEncontros((prev) => {
      const next = [...prev, novo];
      log("Encontros após adicionar:", next);
      return next;
    });
  };

  const removeEncontro = (idx) => {
    log("Remover encontro:", { index: idx, totalAtual: encontros.length });
    setEncontros((prev) => {
      if (prev.length <= 1) {
        log("Remoção ignorada: precisa manter ao menos um encontro.");
        return prev;
      }
      const next = prev.filter((_, i) => i !== idx);
      log("Encontros após remoção:", next);
      return next;
    });
  };

  const updateEncontro = (idx, field, value) => {
    // não “quebra” o input time/date, mas normaliza leve
    const v = field === "data" ? value : value;
    log("Atualizar encontro:", { index: idx, field, value: v });
    setEncontros((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: v } : e)));
  };

  /* ======= Instrutores / Assinante ======= */
  const instrutoresOpcoes = useMemo(() => {
    const list = (usuarios || [])
      .filter((u) => {
        const perfil = Array.isArray(u.perfil) ? u.perfil.join(",") : String(u.perfil || "");
        const p = perfil.toLowerCase();
        return p.includes("instrutor") || p.includes("administrador");
      })
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
    return list;
  }, [usuarios]);

  const getInstrutorDisponivel = (index) => {
    const selecionados = instrutoresSel.map(String);
    const atual = selecionados[index];
    return instrutoresOpcoes.filter(
      (i) => !selecionados.includes(String(i.id)) || String(i.id) === String(atual)
    );
  };

  const handleSelecionarInstrutor = (index, valor) => {
    log("Selecionar/alterar instrutor:", { index, valor });
    setInstrutoresSel((prev) => {
      const nova = [...prev];
      nova[index] = valor;
      return nova;
    });
  };

  const adicionarInstrutor = () => {
    log("Adicionar slot de instrutor.");
    setInstrutoresSel((l) => [...l, ""]);
  };

  const removerInstrutor = (index) => {
    log("Remover instrutor na posição:", index);
    setInstrutoresSel((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [""];
    });
  };

  const assinanteOpcoes = useMemo(() => {
    const ids = new Set(instrutoresSel.filter(Boolean).map((x) => Number(x)));
    return instrutoresOpcoes.filter((u) => ids.has(Number(u.id)));
  }, [instrutoresSel, instrutoresOpcoes]);

  /* validação/salvar */
  const validar = () => {
    time("validar");

    if (!nome.trim()) {
      toast.warning("Informe o nome da turma.");
      log("Validação falhou: nome vazio.");
      timeEnd("validar");
      return false;
    }
    if (nome.length > NOME_TURMA_MAX) {
      toast.error(`O nome não pode exceder ${NOME_TURMA_MAX} caracteres.`);
      log("Validação falhou: nome longo.", { len: nome.length });
      timeEnd("validar");
      return false;
    }
    if (vagasTotal === "" || !Number.isFinite(Number(vagasTotal)) || Number(vagasTotal) <= 0) {
      toast.warning("Quantidade de vagas deve ser número ≥ 1.");
      log("Validação falhou: vagas inválidas.", { vagasTotal });
      timeEnd("validar");
      return false;
    }
    if (!encontrosOrdenados.length) {
      toast.warning("Inclua pelo menos uma data de encontro.");
      log("Validação falhou: sem encontros válidos.");
      timeEnd("validar");
      return false;
    }

    for (let i = 0; i < encontrosOrdenados.length; i++) {
      const e = encontrosOrdenados[i];
      if (!e.data || !e.inicio || !e.fim) {
        toast.error(`Preencha data e horários do encontro #${i + 1}.`);
        log("Validação falhou: campo vazio em encontro.", { index: i, e });
        timeEnd("validar");
        return false;
      }
      const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
      const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
      if (h2 * 60 + (m2 || 0) <= h1 * 60 + (m1 || 0)) {
        toast.error(`Horários inválidos no encontro #${i + 1}.`);
        log("Validação falhou: fim <= início.", { index: i, e });
        timeEnd("validar");
        return false;
      }
    }

    const instrSel = instrutoresSel
      .map((v) => Number(String(v).trim()))
      .filter((id) => Number.isFinite(id));

    if (instrSel.length === 0) {
      toast.error("Selecione ao menos um instrutor para a turma.");
      log("Validação falhou: nenhum instrutor selecionado.");
      timeEnd("validar");
      return false;
    }

    if (!assinanteId) {
      toast.error("Selecione o assinante da turma.");
      log("Validação falhou: assinante vazio.");
      timeEnd("validar");
      return false;
    }

    if (!instrSel.includes(Number(assinanteId))) {
      toast.error("O assinante precisa estar entre os instrutores selecionados.");
      log("Validação falhou: assinante fora da lista.", { instrSel, assinanteId });
      timeEnd("validar");
      return false;
    }

    log("Validação OK.", {
      nome,
      vagasTotal: Number(vagasTotal),
      encontrosValidos: encontrosOrdenados.length,
      instrutoresSel,
      assinanteId,
    });

    timeEnd("validar");
    return true;
  };

  const montarPayload = () => {
    time("montarPayload");

    const horario_inicio_base = hhmm(encontrosOrdenados[0]?.inicio, "08:00");
    const horario_fim_base = hhmm(encontrosOrdenados[0]?.fim, "17:00");

    const instrSel = instrutoresSel
      .map((v) => Number(String(v).trim()))
      .filter((id) => Number.isFinite(id));

    const payload = {
      ...(initialTurma?.id ? { id: initialTurma.id } : {}),
      nome: nome.trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria: calcularCargaHorariaTotal(encontrosOrdenados),
      data_inicio,
      data_fim,
      horario_inicio: horario_inicio_base,
      horario_fim: horario_fim_base,

      // compat: backend antigo/novo
      encontros: encontrosOrdenados.map((e) => ({
        data: e.data,
        inicio: hhmm(e.inicio, horario_inicio_base),
        fim: hhmm(e.fim, horario_fim_base),
      })),
      datas: encontrosOrdenados.map((e) => ({
        data: e.data,
        horario_inicio: hhmm(e.inicio, horario_inicio_base),
        horario_fim: hhmm(e.fim, horario_fim_base),
      })),

      instrutores: instrSel,
      assinante_id: Number(assinanteId),
      instrutor_assinante_id: Number(assinanteId),
    };

    log("Payload montado:", payload);
    timeEnd("montarPayload");
    return payload;
  };

  const handleSalvar = () => {
    group("Salvar Turma • submit");
    if (!validar()) {
      groupEnd();
      return;
    }

    const payload = montarPayload();

    try {
      log("Disparando onSalvar(payload).");
      onSalvar?.(payload);
      log("onSalvar chamado.");

      // reset apenas para criação (novo)
      if (!initialTurma?.id) {
        log("Resetando formulário (nova turma).");
        setNome("");
        setVagasTotal("");
        setEncontros([{ data: "", inicio: "", fim: "" }]);
        setInstrutoresSel([""]);
        setAssinanteId("");
        setTimeout(autosizeNome, 0);
      }
    } catch (err) {
      console.error(`${stamp()} ${LOG_TAG} Erro no onSalvar:`, err);
    } finally {
      groupEnd();
    }
  };

  const titleId = "modal-turma-title";
  const descId = "modal-turma-desc";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        log("Fechar/Cancelar no ModalTurma.");
        onClose?.();
      }}
      level={1}
      maxWidth="max-w-2xl"
      labelledBy={titleId}
      describedBy={descId}
      className="p-0 overflow-hidden"
    >
      <div className="flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900">
        <header
          className="px-5 py-4 text-white bg-gradient-to-br from-teal-900 via-indigo-800 to-violet-700"
          role="group"
          aria-label="Edição de turma"
        >
          <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {initialTurma?.id ? "Editar Turma" : "Nova Turma"}
          </h2>
          <p id={descId} className="text-white/90 text-sm mt-1">
            Defina nome, instrutores, encontros e vagas. A carga horária é estimada automaticamente.
          </p>
        </header>

        {/* Ministats */}
        <section className="px-5 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Período</div>
            <div className="text-sm font-semibold">
              {data_inicio ? data_inicio.split("-").reverse().join("/") : "—"}
              {data_fim && data_fim !== data_inicio ? ` — ${data_fim.split("-").reverse().join("/")}` : ""}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Encontros</div>
            <div className="text-sm font-semibold">{encontrosOrdenados.length || "—"}</div>
          </div>

          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Carga estimada</div>
            <div className="text-sm font-semibold">{carga_horaria_preview ? `${carga_horaria_preview}h` : "—"}</div>
          </div>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSalvar();
          }}
          className="px-5 pt-4 pb-24 overflow-y-auto max-h-[60vh] bg-white dark:bg-zinc-900"
        >
          {/* Nome */}
          <div className="relative mb-4">
            <Type className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <textarea
              ref={refNome}
              data-initial-focus
              value={nome}
              onChange={(e) => {
                const v = e.target.value.slice(0, NOME_TURMA_MAX);
                setNome(v);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              placeholder="Nome da turma"
              maxLength={NOME_TURMA_MAX}
              rows={2}
              className="w-full pl-10 pr-14 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[56px] max-h-[200px] overflow-y-auto resize-none"
              autoComplete="off"
              aria-describedby="nome-turma-help nome-turma-count"
            />
            <div
              id="nome-turma-count"
              className={`absolute right-3 top-2 text-xs ${
                nome.length >= NOME_TURMA_MAX * 0.9 ? "text-amber-600" : "text-slate-500"
              }`}
            >
              {nome.length}/{NOME_TURMA_MAX}
            </div>
            <p id="nome-turma-help" className="mt-1 text-xs text-slate-500">
              Máximo de {NOME_TURMA_MAX} caracteres.
            </p>
          </div>

          {/* Instrutores e Assinante */}
          <div className="mb-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Users size={16} /> Instrutores da turma
            </div>

            {instrutoresSel.map((valor, index) => (
              <div key={`instrutor-${index}`} className="flex gap-2 items-center">
                <select
                  value={String(valor ?? "")}
                  onChange={(e) => handleSelecionarInstrutor(index, e.target.value)}
                  className="w-full pl-3 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                  required={index === 0}
                  aria-label={index === 0 ? "Instrutor principal" : `Instrutor adicional ${index}`}
                >
                  <option value="">Selecione o instrutor</option>
                  {getInstrutorDisponivel(index).map((i) => (
                    <option key={i.id} value={String(i.id)}>
                      {i.nome}
                    </option>
                  ))}
                </select>

                {index > 0 ? (
                  <button
                    type="button"
                    onClick={() => removerInstrutor(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    title="Remover este instrutor"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={adicionarInstrutor}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Incluir outro
                  </button>
                )}
              </div>
            ))}

            <div className="mt-3">
              <label className="text-sm font-medium">Assinante do certificado *</label>
              <select
                value={String(assinanteId || "")}
                onChange={(e) => {
                  log("Alterar assinante:", { de: assinanteId, para: e.target.value });
                  setAssinanteId(e.target.value);
                }}
                className="w-full mt-1 pl-3 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                required
              >
                <option value="">Selecione o assinante</option>
                {assinanteOpcoes.map((u) => (
                  <option key={u.id} value={String(u.id)}>
                    {u.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                O assinante precisa estar entre os instrutores selecionados desta turma.
              </p>
            </div>
          </div>

          {/* Encontros */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">Encontros</div>

            {encontros.map((e, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <input
                    type="date"
                    value={isoDay(e.data)}
                    onChange={(ev) => updateEncontro(idx, "data", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <input
                    type="time"
                    value={hhmm(e.inicio, "")}
                    onChange={(ev) => updateEncontro(idx, "inicio", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={hhmm(e.fim, "")}
                      onChange={(ev) => updateEncontro(idx, "fim", ev.target.value)}
                      className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />

                    {encontros.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEncontro(idx)}
                        className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
                        title="Remover este encontro"
                      >
                        <Trash2 size={16} aria-hidden />
                        <span className="sr-only">Remover encontro {idx + 1}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={addEncontro}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-full transition"
              >
                <PlusCircle size={16} />
                Adicionar data
              </button>
            </div>
          </div>

          {/* Vagas */}
          <div className="relative mt-5">
            <Hash className="absolute left-3 top-3 text-slate-500" size={18} aria-hidden />
            <input
              type="number"
              value={vagasTotal}
              onChange={(e) => setVagasTotal(e.target.value)}
              placeholder="Quantidade de vagas"
              className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min={1}
              required
              inputMode="numeric"
            />
          </div>
        </form>

        {/* Footer sticky */}
        <div className="mt-auto sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex justify-between gap-3">
          <div className="min-w-[1.5rem]">
            {initialTurma?.id && onExcluir ? (
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
                onClick={() => {
                  log("Clique em Excluir turma.", { turmaId: initialTurma?.id });
                  onExcluir();
                }}
                title="Excluir turma"
              >
                <Trash2 size={16} />
                Excluir turma
              </button>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                log("Clique em Cancelar no rodapé.");
                onClose?.();
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
              type="button"
            >
              Cancelar
            </button>

            <button
              onClick={handleSalvar}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
              type="button"
            >
              Salvar Turma
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
