// ✅ src/pages/CalendarioBloqueiosAdmin.jsx — PREMIUM (ALINHADO AO BANCO, sem mexer em schema)
// Banco/Backend aceitam APENAS:
// - feriado_nacional | feriado_municipal | ponto_facultativo | bloqueio_interno
//
// O que mudou vs versão que você colou:
// - ✅ Remove mapeamento UI -> backend (não existe mais toBackendTipo / meta na descrição)
// - ✅ Submit envia tipo = formData.tipo (normalizado)
// - ✅ Editar registro usa tipo direto do banco (normalizado) e mostra descrição como está
// - ✅ Anti-duplicidade por (data + tipo) (compatível com seu schema)
// - ✅ Mini-stats agora contam pelos 4 tipos reais
// - ✅ A11y/UX mantidos (aria-live, atalhos não atrapalham inputs, foco ao clicar no dia)

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Info,
  CalendarDays as TodayIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";
import ModalConfirmacao from "../components/ModalConfirmacao";

/* ──────────────────────────────────────────────────────────
   Constantes de UI
────────────────────────────────────────────────────────── */
const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ✅ TIPOS REAIS (iguais ao CHECK do Postgres + backend)
const TIPOS_OPcao = [
  { value: "feriado_nacional",  label: "Feriado nacional" },
  { value: "feriado_municipal", label: "Feriado municipal" },
  { value: "ponto_facultativo", label: "Ponto facultativo" },
  { value: "bloqueio_interno",  label: "Bloqueio interno (administrativo)" },
];

const TIPO_LABEL = TIPOS_OPcao.reduce((acc, t) => ((acc[t.value] = t.label), acc), {});

const TIPO_STYLE = {
  feriado_nacional:  {
    ring: "ring-rose-300",
    border: "border-rose-200",
    bg: "bg-rose-50",
    text: "text-rose-800",
    hover: "hover:bg-rose-100",
    dot: "bg-rose-500",
  },
  feriado_municipal: {
    ring: "ring-amber-300",
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-800",
    hover: "hover:bg-amber-100",
    dot: "bg-amber-500",
  },
  ponto_facultativo: {
    ring: "ring-sky-300",
    border: "border-sky-200",
    bg: "bg-sky-50",
    text: "text-sky-800",
    hover: "hover:bg-sky-100",
    dot: "bg-sky-500",
  },
  bloqueio_interno:  {
    ring: "ring-emerald-300",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    hover: "hover:bg-emerald-100",
    dot: "bg-emerald-500",
  },
};

function cls(...a){ return a.filter(Boolean).join(" "); }

/* ──────────────────────────────────────────────────────────
   Datas-only helpers (sem timezone shift)
────────────────────────────────────────────────────────── */
function toISO(dateStr) { return (dateStr || "").slice(0, 10); }
function hojeISOString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* monta matriz de semanas do mês (uso apenas para UI) */
function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia   = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay(); // 0..6
  const diasNoMes = ultimoDia.getDate();

  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let i = 0; i < primeiroDiaSemana; i++) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i++) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i++) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }
  return semanas;
}

/* ──────────────────────────────────────────────────────────
   Normalizações (compat)
────────────────────────────────────────────────────────── */
function normTipo(v) {
  return String(v ?? "").trim().toLowerCase();
}
function tipoValido(v) {
  const t = normTipo(v);
  return ["feriado_nacional","feriado_municipal","ponto_facultativo","bloqueio_interno"].includes(t);
}
function normDescricao(v) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, 2000) : null;
}

/* ──────────────────────────────────────────────────────────
   Página
────────────────────────────────────────────────────────── */
export default function CalendarioBloqueiosAdmin() {
  const navigate = useNavigate();

  const hojeISO = useRef(hojeISOString()).current;
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());

  const [loading, setLoading] = useState(false);
  const [calendario, setCalendario] = useState([]); // [{id,data,tipo,descricao}, ...]

  const [formData, setFormData] = useState({
    id: null,
    data: "",
    tipo: "feriado_nacional",
    descricao: "",
  });
  const [salvando, setSalvando] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState({ open: false, item: null });
  const [deletingId, setDeletingId] = useState(null);

  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

  const tipoRef = useRef(null);
  const liveRef = useRef(null);

  /* Carregar dados ao abrir a página */
  useEffect(() => {
    const ac = new AbortController();
    carregar(ac.signal);
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e?.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      if (e.key === "ArrowLeft") mudarMes(-1);
      if (e.key === "ArrowRight") mudarMes(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano, mesIndex]);

  async function carregar(signal) {
    try {
      setLoading(true);
      const resp = await api.get("/calendario", { signal });
      const lista = resp?.data ?? resp ?? [];
      setCalendario((lista || []).map((item) => ({
        ...item,
        data: toISO(item.data),
        tipo: normTipo(item.tipo),
      })));
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") return;
      console.error("[CalendarioBloqueiosAdmin] erro ao carregar:", err);
      toast.error("Erro ao carregar calendário de bloqueios.");
    } finally {
      setLoading(false);
    }
  }

  function mudarMes(delta) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    else if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMesIndex(novoMes);
    setAno(novoAno);
  }

  function irParaHoje() {
    const d = new Date();
    setAno(d.getFullYear());
    setMesIndex(d.getMonth());
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((old) => ({ ...old, [name]: value }));
  }

  function editarRegistro(reg) {
    const tipo = normTipo(reg.tipo);

    setFormData({
      id: reg.id,
      data: toISO(reg.data),
      tipo: tipoValido(tipo) ? tipo : "bloqueio_interno",
      descricao: reg.descricao || "",
    });

    queueMicrotask(() => {
      try { tipoRef.current?.focus(); } catch {}
    });
  }

  function limparForm() {
    setFormData({ id: null, data: "", tipo: "feriado_nacional", descricao: "" });
  }

  // ✅ Anti-duplicidade compatível: (data + tipo)
  const existeDataTipo = useCallback((dataISO, tipo, ignoreId = null) => {
    const t = normTipo(tipo);
    return calendario.some((c) => c.data === dataISO && normTipo(c.tipo) === t && c.id !== ignoreId);
  }, [calendario]);

  async function onSubmit(e) {
    e.preventDefault();

    const payload = {
      data: toISO(formData.data),
      tipo: normTipo(formData.tipo),
      descricao: normDescricao(formData.descricao),
    };

    if (!payload.data || !payload.tipo) {
      toast.warn("Preencha data e tipo.");
      return;
    }

    if (!tipoValido(payload.tipo)) {
      toast.error("Tipo inválido. Selecione uma opção da lista.");
      return;
    }

    if (existeDataTipo(payload.data, payload.tipo, formData.id)) {
      toast.info("Já existe um registro com essa data e tipo.");
      return;
    }

    try {
      setSalvando(true);

      if (process.env.NODE_ENV !== "production") {
        console.log("[CalendarioBloqueiosAdmin] submit payload:", payload);
      }

      if (formData.id) {
        await api.put(`/calendario/${formData.id}`, payload);
        toast.success("Data atualizada com sucesso.");
      } else {
        await api.post("/calendario", payload);
        toast.success("Data cadastrada com sucesso.");
      }

      await carregar();
      limparForm();
      if (liveRef.current) liveRef.current.textContent = "Calendário atualizado.";
    } catch (err) {
      console.error("[CalendarioBloqueiosAdmin] erro ao salvar:", err);
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.message ||
        "Erro ao salvar data.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  function solicitarExcluirRegistro(ev) {
    if (!ev?.id) return;
    if (deletingId) return;
    setConfirmDelete({ open: true, item: ev });
  }

  async function executarExcluirRegistro() {
    const ev = confirmDelete?.item;
    if (!ev?.id) {
      setConfirmDelete({ open: false, item: null });
      return;
    }

    try {
      setDeletingId(ev.id);
      await api.delete(`/calendario/${ev.id}`);
      toast.success("Data removida com sucesso.");
      await carregar();
      if (liveRef.current) liveRef.current.textContent = "Registro removido.";
    } catch (err) {
      console.error("[CalendarioBloqueiosAdmin] erro ao excluir:", err);
      const msg = err?.response?.data?.erro || "Erro ao excluir data.";
      toast.error(msg);
    } finally {
      setDeletingId(null);
      setConfirmDelete({ open: false, item: null });
    }
  }

  const calendarioPorData = useMemo(() => {
    const map = {};
    for (const item of calendario) {
      const key = toISO(item.data);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => (a.tipo || "").localeCompare(b.tipo || ""));
    });
    return map;
  }, [calendario]);

  const anosDisponiveis = useMemo(() => {
    const y = new Date().getFullYear();
    const size = 7;
    return Array.from({ length: size }, (_, i) => y - 3 + i);
  }, []);

  function prefillDia(dateISO) {
    setFormData((f) => ({ ...f, data: dateISO }));
    queueMicrotask(() => {
      try { tipoRef.current?.focus(); } catch {}
    });
  }

  const statsMes = useMemo(() => {
    const m = String(mesIndex + 1).padStart(2, "0");
    const prefix = `${ano}-${m}-`;
    const itens = calendario.filter((c) => String(c.data || "").startsWith(prefix));

    const byTipo = {
      feriado_nacional: 0,
      feriado_municipal: 0,
      ponto_facultativo: 0,
      bloqueio_interno: 0,
    };

    for (const it of itens) {
      const t = normTipo(it.tipo);
      if (byTipo[t] != null) byTipo[t] += 1;
    }

    return { total: itens.length, ...byTipo };
  }, [calendario, ano, mesIndex]);

  function labelEv(ev) {
    const t = normTipo(ev?.tipo);
    return TIPO_LABEL[t] || t || "—";
  }

  function styleEv(ev) {
    const t = normTipo(ev?.tipo);
    return TIPO_STYLE[t] || TIPO_STYLE["bloqueio_interno"];
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950">
      <div className="sr-only" aria-live="polite" ref={liveRef} />

      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">
                  Calendário de Feriados e Bloqueios
                </h1>
                <p className="text-sm sm:text-base text-emerald-50">
                  Gerencie feriados nacionais, municipais, pontos facultativos e bloqueios internos que deixam as salas indisponíveis.
                </p>
              </div>
            </div>
          </div>

          {/* mini-stats (topo) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
              <p className="text-[11px] text-emerald-50">Total no mês</p>
              <p className="text-lg font-semibold">{statsMes.total}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
              <p className="text-[11px] text-emerald-50">Feriado nacional</p>
              <p className="text-lg font-semibold">{statsMes.feriado_nacional}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
              <p className="text-[11px] text-emerald-50">Feriado municipal</p>
              <p className="text-lg font-semibold">{statsMes.feriado_municipal}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-3">
              <p className="text-[11px] text-emerald-50">Ponto/Bloqueio</p>
              <p className="text-lg font-semibold">{statsMes.ponto_facultativo + statsMes.bloqueio_interno}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* Barra superior */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-full bg-white dark:bg-zinc-900 shadow hover:bg-slate-50 dark:hover:bg-zinc-800"
              onClick={() => mudarMes(-1)}
              title="Mês anterior (←)"
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <p className="text-sm text-slate-500 dark:text-zinc-400">Mês</p>
              <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-zinc-100">
                {NOMES_MESES[mesIndex]} {ano}
              </p>
            </div>

            <button
              className="p-2 rounded-full bg-white dark:bg-zinc-900 shadow hover:bg-slate-50 dark:hover:bg-zinc-800"
              onClick={() => mudarMes(1)}
              title="Próximo mês (→)"
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={irParaHoje}
              className="ml-2 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 shadow text-xs sm:text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
              title="Ir para hoje"
            >
              <TodayIcon className="w-4 h-4" />
              Hoje
            </button>
          </div>

          {/* seleção rápida mês/ano + voltar */}
          <div className="flex items-center gap-2">
            <select
              aria-label="Selecionar mês"
              className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-slate-700 dark:text-zinc-200"
              value={mesIndex}
              onChange={(e) => setMesIndex(Number(e.target.value))}
            >
              {NOMES_MESES.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select
              aria-label="Selecionar ano"
              className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm text-slate-700 dark:text-zinc-200"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            >
              {anosDisponiveis.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => navigate("/admin/agenda-salas")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 shadow text-xs sm:text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
              title="Voltar para Agenda de Salas"
            >
              Voltar
            </button>
          </div>
        </div>

        {/* Info + legenda */}
        <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900 px-3 py-2 text-[11px] sm:text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-300" />
          <p>
            Todas as datas cadastradas aqui são consideradas <strong>indisponíveis</strong> na Agenda de Salas (Auditório e Sala de Reunião), para todos os períodos.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
          {TIPOS_OPcao.map((t) => (
            <span
              key={t.value}
              className={cls(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1",
                TIPO_STYLE[t.value]?.border,
                "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200"
              )}
              title={t.label}
            >
              <span className={cls("h-2 w-2 rounded-full", TIPO_STYLE[t.value]?.dot)} />
              {t.label}
            </span>
          ))}
        </div>

        {/* Formulário */}
        <section
          aria-label="Formulário de cadastro e edição"
          className="mb-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 p-4 sm:p-5"
        >
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-zinc-100 mb-3">
            {formData.id ? "Editar data do calendário" : "Cadastrar nova data"}
          </h2>

          <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-[150px,1fr,auto] gap-3 sm:items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">Data</label>
              <input
                type="date"
                name="data"
                value={formData.data}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm text-slate-900 dark:text-zinc-100"
                required
                aria-required="true"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">Tipo</label>
              <select
                ref={tipoRef}
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm text-slate-900 dark:text-zinc-100"
                required
                aria-required="true"
              >
                {TIPOS_OPcao.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-1">Descrição (opcional)</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Ex.: Véspera de Natal, Recesso administrativo…"
                  className="flex-1 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1.5 text-sm text-slate-900 dark:text-zinc-100"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                    aria-busy={salvando ? "true" : "false"}
                  >
                    {salvando ? "Salvando..." : formData.id ? "Atualizar" : "Cadastrar"}
                  </button>
                  <button
                    type="button"
                    onClick={limparForm}
                    className="px-3 py-2 rounded-xl border border-slate-300 dark:border-zinc-700 text-xs sm:text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    title="Limpar formulário"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>

        {/* Calendário */}
        <section
          aria-label="Calendário com marcações"
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-800 overflow-hidden mb-6"
        >
          <div className="grid grid-cols-7 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-100 dark:border-zinc-800 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="py-2 text-center font-medium text-slate-600 dark:text-zinc-300 uppercase">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton height={120} count={3} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {semanas.map((semana, idxSemana) => (
                <div key={idxSemana} className="grid grid-cols-7">
                  {semana.map((dia, idxDia) => {
                    if (!dia) {
                      return (
                        <div
                          key={idxDia}
                          className="min-h-[100px] border-r border-slate-100 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/30"
                        />
                      );
                    }

                    const m = String(mesIndex + 1).padStart(2, "0");
                    const d = String(dia).padStart(2, "0");
                    const dataISO = `${ano}-${m}-${d}`;
                    const eventosDia = calendarioPorData[dataISO] || [];
                    const eHoje = dataISO === hojeISO;

                    return (
                      <div
                        key={idxDia}
                        className={cls(
                          "min-h-[110px] border-r border-slate-100 dark:border-zinc-800 p-1.5 sm:p-2 flex flex-col",
                          "focus-within:ring-2 focus-within:ring-emerald-500/60"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <button
                            type="button"
                            onClick={() => prefillDia(dataISO)}
                            className={cls(
                              "text-left text-xs sm:text-sm font-semibold rounded px-1 py-0.5",
                              eHoje
                                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20"
                                : "text-slate-700 dark:text-zinc-200"
                            )}
                            title="Preencher data no formulário"
                          >
                            {dia}
                          </button>

                          {eventosDia.length > 0 && (
                            <span
                              className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-slate-100 dark:bg-zinc-800 text-[11px] text-slate-700 dark:text-zinc-200 px-1.5"
                              title={`${eventosDia.length} registro(s) neste dia`}
                            >
                              {eventosDia.length}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-col gap-1">
                          {eventosDia.map((ev) => {
                            const sty = styleEv(ev);
                            const disabledDelete = deletingId === ev.id;

                            return (
                              <div
                                key={ev.id}
                                className={cls(
                                  "group rounded-lg border px-2 py-1.5 text-[11px] sm:text-xs flex flex-col gap-1",
                                  sty.border, sty.bg, "dark:bg-opacity-60"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => editarRegistro(ev)}
                                    className={cls("font-semibold", sty.text, "text-left")}
                                    title="Editar registro"
                                  >
                                    {labelEv(ev)}
                                  </button>

                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                      type="button"
                                      onClick={() => editarRegistro(ev)}
                                      className={cls("p-0.5 rounded", sty.hover)}
                                      title="Editar"
                                    >
                                      <Edit2 className={cls("w-3 h-3", sty.text)} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => solicitarExcluirRegistro(ev)}
                                      disabled={disabledDelete}
                                      className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                                    </button>
                                  </div>
                                </div>

                                {ev.descricao && (
                                  <p className={cls("text-[10px]", sty.text)}>{String(ev.descricao)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      <ModalConfirmacao
        isOpen={!!confirmDelete.open}
        title="Excluir data?"
        description={
          confirmDelete?.item
            ? `Tem certeza que deseja excluir esta data do calendário?\n\n${toISO(confirmDelete.item.data)} • ${labelEv(confirmDelete.item)}${confirmDelete.item.descricao ? `\n${String(confirmDelete.item.descricao).trim()}` : ""}`
            : "Tem certeza que deseja excluir esta data?"
        }
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        danger
        loading={!!deletingId}
        onClose={() => {
          if (deletingId) return;
          setConfirmDelete({ open: false, item: null });
        }}
        onConfirm={executarExcluirRegistro}
      />
    </div>
  );
}
