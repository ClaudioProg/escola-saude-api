// 📁 src/components/ModalTurma.jsx
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Hash, Type, PlusCircle, Trash2 } from "lucide-react";
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
    const hh = String(Math.min(23, Math.max(0, parseInt(H || "0", 10)))).padStart(2, "0");
    const mm = String(Math.min(59, Math.max(0, parseInt(M || "0", 10)))).padStart(2, "0");
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

  return arr.length ? arr : null;
};

const encontrosDoInitial = (t) => {
  if (!t) return [{ data: "", inicio: "", fim: "" }];

  // 1) encontros explícitos
  if (Array.isArray(t.encontros) && t.encontros.length) {
    const baseHi = hhmm(t?.horario_inicio, "08:00");
    const baseHf = hhmm(t?.horario_fim, "17:00");
    return t.encontros
      .map((e) => ({
        data: isoDay(e?.data || e),
        inicio: hhmm(e?.inicio, baseHi),
        fim: hhmm(e?.fim, baseHf),
      }))
      .filter((x) => x.data);
  }

  // 2) converte datas -> encontros
  const conv = datasParaEncontros(t);
  if (conv) return conv;

  // 3) fallback vazio
  return [{ data: "", inicio: "", fim: "" }];
};

/* ===================== Componente ===================== */

export default function ModalTurma({ isOpen, onClose, onSalvar, initialTurma = null, onExcluir }) {
  const [nome, setNome] = useState(initialTurma?.nome || "");
  const [vagasTotal, setVagasTotal] = useState(
    initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : ""
  );
  // cada encontro no estado: { data:'YYYY-MM-DD', inicio:'HH:MM', fim:'HH:MM' }
  const [encontros, setEncontros] = useState(encontrosDoInitial(initialTurma));

  // Reidrata quando abrir/editar
  useEffect(() => {
    if (!isOpen) return;
    setNome(initialTurma?.nome || "");
    setVagasTotal(initialTurma?.vagas_total != null ? String(initialTurma.vagas_total) : "");
    setEncontros(encontrosDoInitial(initialTurma));
  }, [isOpen, initialTurma]);

  // Ordenados/normalizados
  const encontrosOrdenados = useMemo(
    () =>
      [...(encontros || [])]
        .map((e) => ({ ...e, data: isoDay(e.data), inicio: hhmm(e.inicio, ""), fim: hhmm(e.fim, "") }))
        .filter((e) => e.data)
        .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)),
    [encontros]
  );

  const data_inicio = encontrosOrdenados[0]?.data || null;
  const data_fim = encontrosOrdenados.at(-1)?.data || null;
  const carga_horaria_preview = calcularCargaHorariaTotal(
    encontrosOrdenados.filter((e) => e.data && e.inicio && e.fim)
  );

  /* ===================== CRUD encontros ===================== */
  const addEncontro = () => {
    const last = encontros[encontros.length - 1] || {};
    setEncontros((prev) => [
      ...prev,
      { data: "", inicio: hhmm(last.inicio, ""), fim: hhmm(last.fim, "") },
    ]);
  };

  const removeEncontro = (idx) =>
    setEncontros((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const updateEncontro = (idx, field, value) =>
    setEncontros((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));

  /* ===================== validação e salvar ===================== */
  const validar = () => {
    if (!nome.trim()) {
      toast.warning("Informe o nome da turma.");
      return false;
    }
    if (vagasTotal === "" || Number(vagasTotal) <= 0 || !Number.isFinite(Number(vagasTotal))) {
      toast.warning("Quantidade de vagas deve ser um número maior ou igual a 1.");
      return false;
    }
    if (!encontrosOrdenados.length) {
      toast.warning("Inclua pelo menos uma data de encontro.");
      return false;
    }
    for (let i = 0; i < encontrosOrdenados.length; i++) {
      const e = encontrosOrdenados[i];
      if (!e.data || !e.inicio || !e.fim) {
        toast.error(`Preencha data e horários do encontro #${i + 1}.`);
        return false;
      }
      const [h1, m1] = hhmm(e.inicio, "00:00").split(":").map(Number);
      const [h2, m2] = hhmm(e.fim, "00:00").split(":").map(Number);
      if (h2 * 60 + (m2 || 0) <= h1 * 60 + (m1 || 0)) {
        toast.error(`Horários inválidos no encontro #${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  const handleSalvar = () => {
    if (!validar()) return;

    const carga_horaria = calcularCargaHorariaTotal(encontrosOrdenados);
    const horario_inicio = hhmm(encontrosOrdenados[0]?.inicio, "00:00");
    const horario_fim = hhmm(encontrosOrdenados[0]?.fim, "00:00");

    // Retornamos 'encontros' (preferido pelo backend) e também 'datas' (compatibilidade)
    const encontrosPayload = encontrosOrdenados.map((e) => ({
      data: e.data,
      inicio: hhmm(e.inicio, horario_inicio),
      fim: hhmm(e.fim, horario_fim),
    }));

    const datasPayload = encontrosOrdenados.map((e) => ({
      data: e.data,
      horario_inicio: hhmm(e.inicio, horario_inicio),
      horario_fim: hhmm(e.fim, horario_fim),
    }));

    const payload = {
      ...(initialTurma?.id ? { id: initialTurma.id } : {}),
      nome: nome.trim(),
      vagas_total: Number(vagasTotal),
      carga_horaria,
      data_inicio,
      data_fim,
      horario_inicio,
      horario_fim,
      encontros: encontrosPayload,
      datas: datasPayload,
    };

    onSalvar?.(payload);

    // Limpa somente se for criação (em edição o controle é do pai)
    if (!initialTurma) {
      setNome("");
      setVagasTotal("");
      setEncontros([{ data: "", inicio: "", fim: "" }]);
    }
  };

  /* ===================== render ===================== */
  return (
    <ModalBase isOpen={isOpen} onClose={onClose} level={1} maxWidth="max-w-2xl">
      {/* Grid: header / body / footer */}
      <div className="grid grid-rows-[auto,1fr,auto] max-h-[85vh] rounded-2xl overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <h2 className="text-xl font-bold text-lousa dark:text-white">
            {initialTurma ? "Editar Turma" : "Nova Turma"}
          </h2>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
            {data_inicio && data_fim ? (
              <>
                {encontrosOrdenados.length} encontro(s) • {data_inicio.split("-").reverse().join("/")}
                {" a "}
                {data_fim.split("-").reverse().join("/")} • Carga estimada:{" "}
                <strong>{carga_horaria_preview}h</strong>
              </>
            ) : (
              <>Defina as datas para ver a carga horária estimada</>
            )}
          </div>
        </div>
  
        {/* BODY */}
        <div className="p-5 overflow-y-auto bg-white dark:bg-zinc-900">
          {/* Nome */}
          <div className="relative mb-4">
            <Type className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da turma"
              className="w-full pl-10 py-2 border rounded-md shadow-sm dark:bg-zinc-800 dark:text-white"
            />
          </div>
  
          {/* Encontros */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-lousa dark:text-white">Encontros</div>
            {encontros.map((e, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-3 items-end">
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3 text-gray-500" size={18} />
                  <input
                    type="date"
                    value={isoDay(e.data)}
                    onChange={(ev) => updateEncontro(idx, "data", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-md shadow-sm dark:bg-zinc-800 dark:text-white"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-gray-500" size={18} />
                  <input
                    type="time"
                    value={hhmm(e.inicio, "")}
                    onChange={(ev) => updateEncontro(idx, "inicio", ev.target.value)}
                    className="w-full pl-10 py-2 border rounded-md shadow-sm dark:bg-zinc-800 dark:text-white"
                    required
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 text-gray-500" size={18} />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={hhmm(e.fim, "")}
                      onChange={(ev) => updateEncontro(idx, "fim", ev.target.value)}
                      className="w-full pl-10 py-2 border rounded-md shadow-sm dark:bg-zinc-800 dark:text-white"
                      required
                    />
                    {encontros.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEncontro(idx)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                        title="Remover este encontro"
                      >
                        ❌
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
                className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition"
              >
                <PlusCircle size={16} />
                Adicionar data
              </button>
            </div>
          </div>
  
          {/* Vagas */}
          <div className="relative mt-5">
            <Hash className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              type="number"
              value={vagasTotal}
              onChange={(e) => setVagasTotal(e.target.value)}
              placeholder="Quantidade de vagas"
              className="w-full pl-10 py-2 border rounded-md shadow-sm dark:bg-zinc-800 dark:text-white"
              min={1}
              required
            />
          </div>
        </div>
  
        {/* FOOTER */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800 rounded-b-2xl">
          <div className="flex justify-between gap-3">
            {initialTurma?.id && onExcluir ? (
              <button
                type="button"
                className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded-md hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300"
                onClick={onExcluir}
                title="Excluir turma"
              >
                <Trash2 size={16} />
                Excluir turma
              </button>
            ) : (
              <span />
            )}
  
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-white"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                type="button"
              >
                Salvar Turma
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}