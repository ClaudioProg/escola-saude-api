/* eslint-disable no-console */
// 📁 src/components/ModalTurma.jsx
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Hash,
  Type,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import ModalBase from "./ModalBase"; // ⬅️ portal + z-index empilhável

/**
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSalvar: (turmaPayload) => void
 *  - initialTurma?: {
 *      id?, nome, vagas_total, carga_horaria?, horario_inicio?, horario_fim?,
 *      encontros?: [{ data:'YYYY-MM-DD', inicio:'HH:MM', fim:'HH:MM' }],
 *      datas?: [{ data:'YYYY-MM-DD', horario_inicio:'HH:MM', horario_fim:'HH:MM' }]
 *    }
 *  - onExcluir?: () => void
 */

/* ===================== Helpers ===================== */

// Retorna "HH:MM" válida OU "" (sem fallback!)
const parseHora = (val) => {
  if (typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";

  // "0800" -> "08:00"
  if (/^\d{3,4}$/.test(s)) {
    const raw = s.length === 3 ? "0" + s : s;
    const H = raw.slice(0, 2);
    const M = raw.slice(2, 4);
    const hh = String(
      Math.min(23, Math.max(0, parseInt(H || "0", 10)))
    ).padStart(2, "0");
    const mm = String(
      Math.min(59, Math.max(0, parseInt(M || "0", 10)))
    ).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // "8:0", "08:00", "08:00:00"
  const m = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?$/);
  if (!m) return "";
  const H = Math.min(23, Math.max(0, parseInt(m[1] || "0", 10)));
  const M = Math.min(59, Math.max(0, parseInt(m[2] || "0", 10)));
  const hh = String(H).padStart(2, "0");
  const mm = String(M).padStart(2, "0");
  return `${hh}:${mm}`;
};

const hhmm = (s, fallback = "") => parseHora(s) || fallback;

const isoDay = (v) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

// soma horas de cada encontro; se >= 8h no dia, desconta 1h (pausa almoço)
const calcularCargaHorariaTotal = (arr) => {
  let horas = 0;
  for (const e of arr) {
    const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
    const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
    const ini = h1 * 60 + (m1 || 0);
    const fim = h2 * 60 + (m2 || 0);
    const diffH = Math.max(0, (fim - ini) / 60);
    horas += diffH >= 8 ? diffH - 1 : diffH;
  }
  return Math.round(horas);
};

// Converte initialTurma.datas -> encontros (para edição)
const datasParaEncontros = (t) => {
  const baseHi = hhmm(t?.horario_inicio, "08:00");
  const baseHf = hhmm(t?.horario_fim, "17:00");

  if (!Array.isArray(t?.datas)) return null;

  const arr = t.datas
    .map((d) => ({
      data: isoDay(d?.data),
      inicio: hhmm(d?.horario_inicio, baseHi),
      fim: hhmm(d?.horario_fim, baseHf),
    }))
    .filter((x) => x.data);

  console.log("[datasParaEncontros] t.datas → encontros:", arr);
  return arr.length ? arr : null;
};

const encontrosDoInitial = (t) => {
  console.group("[encontrosDoInitial]");
  console.log("initialTurma recebido:", t);

  if (!t) {
    console.log("→ fallback encontro vazio");
    console.groupEnd();
    return [{ data: "", inicio: "", fim: "" }];
  }

  // 1) encontros explícitos
  if (Array.isArray(t.encontros) && t.encontros.length) {
    console.log("usando t.encontros");
    const baseHi = hhmm(t?.horario_inicio, "08:00");
    const baseHf = hhmm(t?.horario_fim, "17:00");
    const arr = t.encontros
      .map((e) => ({
        data: isoDay(e?.data || e),
        inicio: hhmm(e?.inicio, baseHi),
        fim: hhmm(e?.fim, baseHf),
      }))
      .filter((x) => x.data);
    console.log("→ encontros normalizados:", arr);
    console.groupEnd();
    return arr;
  }

  // 2) converte datas -> encontros
  console.log("tentando converter datas → encontros");
  const conv = datasParaEncontros(t);
  if (conv) {
    console.log("→ conversão bem sucedida:", conv);
    console.groupEnd();
    return conv;
  }

  // 3) fallback vazio
  console.log("→ fallback encontro vazio");
  console.groupEnd();
  return [{ data: "", inicio: "", fim: "" }];
};

/* ===================== Componente ===================== */

export default function ModalTurma({
  isOpen,
  onClose,
  onSalvar,
  initialTurma = null,
  onExcluir,
}) {
  console.log("[ModalTurma render] isOpen:", isOpen, "initialTurma:", initialTurma);

  const [nome, setNome] = useState(initialTurma?.nome || "");
  const [vagasTotal, setVagasTotal] = useState(
    initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : ""
  );
  // cada encontro no estado: { data:'YYYY-MM-DD', inicio:'HH:MM', fim:'HH:MM' }
  const [encontros, setEncontros] = useState(encontrosDoInitial(initialTurma));

  // Reidrata quando abrir/editar
  useEffect(() => {
    if (!isOpen) return;
    console.group("[ModalTurma useEffect isOpen/initialTurma]");
    console.log("isOpen:", isOpen, "initialTurma:", initialTurma);

    setNome(initialTurma?.nome || "");
    setVagasTotal(
      initialTurma?.vagas_total != null
        ? String(initialTurma.vagas_total)
        : ""
    );

    const enc = encontrosDoInitial(initialTurma);
    console.log("→ encontros reidratados:", enc);
    setEncontros(enc);

    console.groupEnd();
  }, [isOpen, initialTurma]);

  // Ordenados/normalizados
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

    console.log("[encontrosOrdenados useMemo] base encontros:", encontros);
    console.log("[encontrosOrdenados useMemo] normalizado/ordenado:", norm);

    return norm;
  }, [encontros]);

  const data_inicio = encontrosOrdenados[0]?.data || null;
  const data_fim = encontrosOrdenados.at(-1)?.data || null;
  const carga_horaria_preview = calcularCargaHorariaTotal(
    encontrosOrdenados.filter((e) => e.data && e.inicio && e.fim)
  );

  console.log("[MiniStats preview]", {
    data_inicio,
    data_fim,
    qtd_encontros: encontrosOrdenados.length,
    carga_horaria_preview,
  });

  /* ===================== CRUD encontros ===================== */
  const addEncontro = () => {
    console.group("[addEncontro]");
    const last = encontros[encontros.length - 1] || {};
    console.log("encontros antes:", encontros, "last:", last);

    setEncontros((prev) => {
      const novo = [
        ...prev,
        {
          data: "",
          inicio: hhmm(last.inicio, ""),
          fim: hhmm(last.fim, ""),
        },
      ];
      console.log("encontros depois:", novo);
      console.groupEnd();
      return novo;
    });
  };

  const removeEncontro = (idx) => {
    console.group("[removeEncontro]");
    console.log("idx:", idx, "encontros atuais:", encontros);

    setEncontros((prev) => {
      if (prev.length <= 1) {
        console.warn(
          "Tentou remover último encontro, bloqueando para manter pelo menos 1"
        );
        console.groupEnd();
        return prev;
      }
      const novo = prev.filter((_, i) => i !== idx);
      console.log("encontros depois:", novo);
      console.groupEnd();
      return novo;
    });
  };

  const updateEncontro = (idx, field, value) => {
    console.group("[updateEncontro]");
    console.log("idx:", idx, "field:", field, "value:", value);
    console.log("antes:", encontros);

    setEncontros((prev) => {
      const novo = prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e));
      console.log("depois:", novo);
      console.groupEnd();
      return novo;
    });
  };

  /* ===================== validação e salvar ===================== */
  const validar = () => {
    console.group("[validar turma]");
    console.log("estado atual:", {
      nome,
      vagasTotal,
      encontrosOrdenados,
    });

    if (!nome.trim()) {
      console.warn("❌ Falta nome");
      toast.warning("Informe o nome da turma.");
      console.groupEnd();
      return false;
    }
    if (
      vagasTotal === "" ||
      Number(vagasTotal) <= 0 ||
      !Number.isFinite(Number(vagasTotal))
    ) {
      console.warn("❌ Vagas inválidas:", vagasTotal);
      toast.warning(
        "Quantidade de vagas deve ser um número maior ou igual a 1."
      );
      console.groupEnd();
      return false;
    }
    if (!encontrosOrdenados.length) {
      console.warn("❌ Nenhum encontro informado");
      toast.warning("Inclua pelo menos uma data de encontro.");
      console.groupEnd();
      return false;
    }
    for (let i = 0; i < encontrosOrdenados.length; i++) {
      const e = encontrosOrdenados[i];
      if (!e.data || !e.inicio || !e.fim) {
        console.warn("❌ Encontro incompleto:", i, e);
        toast.error(`Preencha data e horários do encontro #${i + 1}.`);
        console.groupEnd();
        return false;
      }
      const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
      const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
      if (h2 * 60 + (m2 || 0) <= h1 * 60 + (m1 || 0)) {
        console.warn("❌ Horários inválidos no encontro:", i, e);
        toast.error(`Horários inválidos no encontro #${i + 1}.`);
        console.groupEnd();
        return false;
      }
    }

    console.log("✅ validação OK");
    console.groupEnd();
    return true;
  };

  const montarPayload = () => {
    console.group("[montarPayload Turma]");
    const carga_horaria = calcularCargaHorariaTotal(encontrosOrdenados);

    // usa defaults amigáveis iguais ao backend (08:00 / 17:00)
    const horario_inicio_base = hhmm(encontrosOrdenados[0]?.inicio, "08:00");
    const horario_fim_base = hhmm(encontrosOrdenados[0]?.fim, "17:00");

    const encontrosPayload = encontrosOrdenados.map((e) => ({
      data: e.data,
      inicio: hhmm(e.inicio, horario_inicio_base),
      fim: hhmm(e.fim, horario_fim_base),
    }));

    const datasPayload = encontrosOrdenados.map((e) => ({
      data: e.data,
      horario_inicio: hhmm(e.inicio, horario_inicio_base),
      horario_fim: hhmm(e.fim, horario_fim_base),
    }));

    const payload = {
      ...(initialTurma?.id ? { id: initialTurma.id } : {}),
      nome: nome.trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria,
      data_inicio,
      data_fim,
      horario_inicio: horario_inicio_base,
      horario_fim: horario_fim_base,
      encontros: encontrosPayload,
      datas: datasPayload,
    };

    console.log("payload final (turma):", payload);
    console.groupEnd();
    return payload;
  };

  const handleSalvar = () => {
    console.group("[handleSalvar Turma]");
    if (!validar()) {
      console.groupEnd();
      return;
    }

    const payload = montarPayload();
    console.log("➡️ Chamando onSalvar(payload):", payload);
    onSalvar?.(payload);

    // Limpa somente se for criação (em edição o controle é do pai)
    if (!initialTurma) {
      console.log("🧹 resetando estado pois é nova turma");
      setNome("");
      setVagasTotal("");
      setEncontros([{ data: "", inicio: "", fim: "" }]);
    }
    console.groupEnd();
  };

  /* ===================== render ===================== */
  const titleId = "modal-turma-title";
  const descId = "modal-turma-desc";

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={() => {
        console.log("[ModalTurma] fechar modal turma");
        onClose();
      }}
      level={1}
      maxWidth="max-w-2xl"
      labelledBy={titleId}
      describedBy={descId}
      className="p-0 overflow-hidden"
    >
      {/* ⬇️  TUDO dentro de UM ÚNICO WRAPPER  ⬇️ */}
      <div className="flex flex-col max-h-[90vh] bg-white dark:bg-zinc-900">
        {/* HeaderHero */}
        <header
          className="px-5 py-4 text-white bg-gradient-to-br from-teal-900 via-indigo-800 to-violet-700"
          role="group"
          aria-label="Edição de turma"
        >
          <h2
            id={titleId}
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
          >
            {initialTurma ? "Editar Turma" : "Nova Turma"}
          </h2>
          <p id={descId} className="text-white/90 text-sm mt-1">
            Defina nome, encontros e vagas. A carga horária é estimada
            automaticamente.
          </p>
        </header>

        {/* Ministats */}
        <section className="px-5 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">
              Período
            </div>
            <div className="text-sm font-semibold">
              {data_inicio && data_fim
                ? `${data_inicio
                    .split("-")
                    .reverse()
                    .join("/")} — ${data_fim
                    .split("-")
                    .reverse()
                    .join("/")}`
                : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">
              Encontros
            </div>
            <div className="text-sm font-semibold">
              {encontrosOrdenados.length || "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">
              Carga estimada
            </div>
            <div className="text-sm font-semibold">
              {carga_horaria_preview ? `${carga_horaria_preview}h` : "—"}
            </div>
          </div>
        </section>

        {/* Conteúdo (rolável) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSalvar();
          }}
          className="px-5 pt-4 pb-24 overflow-y-auto max-h-[60vh] bg-white dark:bg-zinc-900"
        >
          {/* Nome */}
          <div className="relative mb-4">
            <Type
              className="absolute left-3 top-3 text-slate-500"
              size={18}
              aria-hidden
            />
            <input
              type="text"
              value={nome}
              onChange={(e) => {
                console.log("[ModalTurma] nome ->", e.target.value);
                setNome(e.target.value);
              }}
              placeholder="Nome da turma"
              className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoComplete="off"
            />
          </div>

          {/* Encontros */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              Encontros
            </div>
            {encontros.map((e, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
              >
                <div className="relative">
                  <CalendarDays
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                    aria-hidden
                  />
                  <input
                    type="date"
                    value={isoDay(e.data)}
                    onChange={(ev) => {
                      console.log(
                        "[ModalTurma] encontro change data idx:",
                        idx,
                        "->",
                        ev.target.value
                      );
                      updateEncontro(idx, "data", ev.target.value);
                    }}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                    aria-hidden
                  />
                  <input
                    type="time"
                    value={hhmm(e.inicio, "")}
                    onChange={(ev) => {
                      console.log(
                        "[ModalTurma] encontro change inicio idx:",
                        idx,
                        "->",
                        ev.target.value
                      );
                      updateEncontro(idx, "inicio", ev.target.value);
                    }}
                    className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock
                    className="absolute left-3 top-3 text-slate-500"
                    size={18}
                    aria-hidden
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={hhmm(e.fim, "")}
                      onChange={(ev) => {
                        console.log(
                          "[ModalTurma] encontro change fim idx:",
                          idx,
                          "->",
                          ev.target.value
                        );
                        updateEncontro(idx, "fim", ev.target.value);
                      }}
                      className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    {encontros.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          console.log(
                            "[ModalTurma] remover encontro idx:",
                            idx
                          );
                          removeEncontro(idx);
                        }}
                        className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
                        title="Remover este encontro"
                      >
                        <Trash2 size={16} aria-hidden />
                        <span className="sr-only">
                          Remover encontro {idx + 1}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  console.log("[ModalTurma] adicionar novo encontro");
                  addEncontro();
                }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-full transition"
              >
                <PlusCircle size={16} />
                Adicionar data
              </button>
            </div>
          </div>

          {/* Vagas */}
          <div className="relative mt-5">
            <Hash
              className="absolute left-3 top-3 text-slate-500"
              size={18}
              aria-hidden
            />
            <input
              type="number"
              value={vagasTotal}
              onChange={(e) => {
                console.log("[ModalTurma] vagasTotal ->", e.target.value);
                setVagasTotal(e.target.value);
              }}
              placeholder="Quantidade de vagas"
              className="w-full pl-10 py-2 border rounded-xl shadow-sm dark:bg-zinc-900 dark:text-white border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min={1}
              required
              inputMode="numeric"
            />
          </div>
        </form>

        {/* Rodapé sticky */}
        <div className="mt-auto sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex justify-between gap-3">
          {/* manter tipo estável: sempre um <div> contendo algo */}
          <div className="min-w-[1.5rem]">
            {initialTurma?.id && onExcluir ? (
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition"
                onClick={() => {
                  console.log(
                    "[ModalTurma] clique em Excluir turma id:",
                    initialTurma?.id
                  );
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
                console.log("[ModalTurma] clique Cancelar");
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
              type="button"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                console.log("[ModalTurma] clique Salvar Turma");
                handleSalvar();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
              type="button"
            >
              Salvar Turma
            </button>
          </div>
        </div>
      </div>
      {/* ⬆️  FIM do wrapper único  ⬆️ */}
    </ModalBase>
  );
}
