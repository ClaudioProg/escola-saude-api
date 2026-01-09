// ✅ src/components/ModalSolicitacaoCurso.jsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  CalendarDays,
  Users,
  MapPin,
  Type,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Clock,
  School,
  BadgeCheck,
  FileText,
  Building2,
} from "lucide-react";
import api from "../services/api";
import Modal from "./Modal";

const STATUS_OPCOES = [
  { value: "planejado", label: "Planejado" },
  { value: "em_analise", label: "Em análise" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
];

const MODALIDADE_OPCOES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "On-line" },
  { value: "hibrido", label: "Híbrido" },
];

function criarLinhaDataVazia() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, data: "", horario_inicio: "", horario_fim: "" };
}

/* ========= helpers (date-only safe + time) ========= */
const pad2 = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD" -> "DD/MM/YYYY" sem shift (usa T12:00)
function brDate(iso) {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(+d)) return s;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function isHHMM(s) {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s.trim());
}

function minutesFromHHMM(hhmm) {
  if (!isHHMM(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function diffHours(inicio, fim) {
  const a = minutesFromHHMM(inicio);
  const b = minutesFromHHMM(fim);
  if (a == null || b == null) return 0;
  const diffMin = Math.max(0, b - a);
  return diffMin / 60;
}

function trimmedOrNull(v) {
  const t = String(v ?? "").trim();
  return t.length ? t : null;
}

function normName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export default function ModalSolicitacaoCurso({
  aberto,
  onClose,
  onSaved,
  solicitacao, // objeto da API ou null para novo
  unidades = [],
  podeEditarStatus = false, // 🔒 só admin depois liga isso
}) {
  const isEdicao = !!solicitacao?.id;

  const uid = useId();
  const titleId = `msc-title-${uid}`;
  const descId = `msc-desc-${uid}`;
  const firstFocusRef = useRef(null);

  const [salvando, setSalvando] = useState(false);
  const [msgA11y, setMsgA11y] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    publico_alvo: "",
    local: "",
    tipo: "",
    unidade_id: "",
    modalidade: "",
    restrito: false,
    restricao_descricao: "",
    carga_horaria_total: "",
    gera_certificado: false,
    status: "planejado",
  });

  const [datas, setDatas] = useState([criarLinhaDataVazia()]);

  // palestrantes: lista de nomes (strings)
  const [palestrantes, setPalestrantes] = useState([]);
  const [novoPalestrante, setNovoPalestrante] = useState("");

  // rehidrata ao abrir
  useEffect(() => {
    if (!aberto) return;

    if (isEdicao) {
      setForm({
        titulo: solicitacao?.titulo || "",
        descricao: solicitacao?.descricao || "",
        publico_alvo: solicitacao?.publico_alvo || "",
        local: solicitacao?.local || "",
        tipo: solicitacao?.tipo || "",
        unidade_id: solicitacao?.unidade_id != null ? String(solicitacao.unidade_id) : "",
        modalidade: solicitacao?.modalidade || "",
        restrito: !!solicitacao?.restrito,
        restricao_descricao: solicitacao?.restricao_descricao || "",
        carga_horaria_total:
          solicitacao?.carga_horaria_total != null ? String(solicitacao.carga_horaria_total) : "",
        gera_certificado: !!solicitacao?.gera_certificado,
        status: solicitacao?.status || "planejado",
      });

      setDatas(
        Array.isArray(solicitacao?.datas) && solicitacao.datas.length
          ? solicitacao.datas.map((d) => ({
              id: d.id || `${d.data}-${d.horario_inicio || ""}-${Math.random().toString(36).slice(2, 6)}`,
              data: String(d.data || "").slice(0, 10),
              horario_inicio: (d.horario_inicio || "").slice(0, 5),
              horario_fim: (d.horario_fim || "").slice(0, 5),
            }))
          : [criarLinhaDataVazia()]
      );

      // aceita array de strings ou objetos
      const pals =
        Array.isArray(solicitacao?.palestrantes)
          ? solicitacao.palestrantes
              .map((p) => (typeof p === "string" ? p : p.nome || p.nome_externo || ""))
              .map(normName)
              .filter(Boolean)
          : [];
      setPalestrantes([...new Set(pals)]);
    } else {
      setForm({
        titulo: "",
        descricao: "",
        publico_alvo: "",
        local: "",
        tipo: "",
        unidade_id: "",
        modalidade: "",
        restrito: false,
        restricao_descricao: "",
        carga_horaria_total: "",
        gera_certificado: false,
        status: "planejado",
      });
      setDatas([criarLinhaDataVazia()]);
      setPalestrantes([]);
    }

    setNovoPalestrante("");
    setMsgA11y("");
    setSalvando(false);

    const t = setTimeout(() => firstFocusRef.current?.focus?.(), 60);
    return () => clearTimeout(t);
  }, [aberto, isEdicao, solicitacao]);

  function handleChangeField(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function handleChangeDataLinha(id, campo, valor) {
    setDatas((prev) => prev.map((d) => (d.id === id ? { ...d, [campo]: valor } : d)));
  }

  function handleAdicionarData() {
    setDatas((prev) => [...prev, criarLinhaDataVazia()]);
  }

  function handleRemoverData(id) {
    setDatas((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((d) => d.id !== id);
    });
  }

  function handleAdicionarPalestranteNome() {
    const nome = normName(novoPalestrante);
    if (!nome) {
      toast.warn("Informe o nome completo do palestrante.");
      return;
    }
    setPalestrantes((prev) => {
      const ja = new Set(prev.map((p) => p.toLowerCase()));
      if (ja.has(nome.toLowerCase())) return prev;
      return [...prev, nome];
    });
    setNovoPalestrante("");
  }

  function handleRemoverPalestrante(idx) {
    setPalestrantes((prev) => prev.filter((_, i) => i !== idx));
  }

  // normaliza datas válidas para payload
  const payloadDatas = useMemo(() => {
    const validas = (datas || [])
      .map((d) => ({
        data: String(d.data || "").slice(0, 10),
        horario_inicio: d.horario_inicio ? String(d.horario_inicio).slice(0, 5) : "",
        horario_fim: d.horario_fim ? String(d.horario_fim).slice(0, 5) : "",
      }))
      .filter((d) => !!d.data);

    // remove duplicadas por data+hora
    const seen = new Set();
    const out = [];
    for (const d of validas) {
      const key = `${d.data}-${d.horario_inicio}-${d.horario_fim}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          data: d.data,
          horario_inicio: d.horario_inicio || null,
          horario_fim: d.horario_fim || null,
        });
      }
    }

    out.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    return out;
  }, [datas]);

  // ministats (datas / periodo / carga)
  const minis = useMemo(() => {
    const qtd = payloadDatas.length;

    const inicio = qtd ? brDate(payloadDatas[0].data) : "—";
    const fim = qtd ? brDate(payloadDatas[qtd - 1].data) : "—";

    // soma horas de cada encontro se tiver início/fim
    const somaHoras = payloadDatas.reduce((acc, d) => {
      const hi = d.horario_inicio || "";
      const hf = d.horario_fim || "";
      return acc + diffHours(hi, hf);
    }, 0);

    const cargaInformada = Number(form.carga_horaria_total);
    const carga = Number.isFinite(cargaInformada) && cargaInformada >= 0
      ? cargaInformada
      : somaHoras;

    const unidadeNome =
      unidades.find((u) => String(u.id) === String(form.unidade_id))?.nome || "—";

    return {
      qtd,
      inicio,
      fim,
      unidadeNome,
      carga: carga ? `${Math.round(carga * 10) / 10}h` : "—",
    };
  }, [payloadDatas, form.carga_horaria_total, form.unidade_id, unidades]);

  function validarAntesDeEnviar() {
    if (!String(form.titulo || "").trim()) return "Informe o título do curso.";
    if (payloadDatas.length === 0) return "Informe ao menos uma data para a solicitação.";

    // se preencher horário, exige HH:MM e fim > início
    for (const d of payloadDatas) {
      const hi = d.horario_inicio || "";
      const hf = d.horario_fim || "";
      if (hi && !isHHMM(hi)) return "Horário de início inválido (use HH:MM).";
      if (hf && !isHHMM(hf)) return "Horário de fim inválido (use HH:MM).";
      if (hi && hf) {
        const a = minutesFromHHMM(hi);
        const b = minutesFromHHMM(hf);
        if (a != null && b != null && b <= a) return "Horário de fim deve ser maior que o horário de início.";
      }
    }

    if (form.carga_horaria_total) {
      const n = Number(form.carga_horaria_total);
      if (!Number.isFinite(n) || n < 0) return "Carga horária total deve ser um número válido.";
    }

    if (form.restrito && !String(form.restricao_descricao || "").trim()) {
      return "Descreva a restrição de acesso (obrigatório quando 'restrito' estiver marcado).";
    }

    return null;
  }

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (salvando) return;

    const erro = validarAntesDeEnviar();
    if (erro) {
      toast.warn(erro);
      setMsgA11y(erro);
      return;
    }

    const payload = {
      titulo: String(form.titulo).trim(),
      descricao: trimmedOrNull(form.descricao),
      publico_alvo: trimmedOrNull(form.publico_alvo),
      local: trimmedOrNull(form.local),
      tipo: trimmedOrNull(form.tipo),
      unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
      modalidade: trimmedOrNull(form.modalidade),
      restrito: !!form.restrito,
      restricao_descricao: form.restrito ? trimmedOrNull(form.restricao_descricao) : null,
      carga_horaria_total: form.carga_horaria_total ? Number(form.carga_horaria_total) : null,
      gera_certificado: !!form.gera_certificado,
      datas: payloadDatas,
      palestrantes: (palestrantes || []).map((nome) => ({
        usuario_id: null,
        nome_externo: nome,
        nome,
      })),
    };

    // status só se for edição e permitido
    if (isEdicao && podeEditarStatus) payload.status = form.status || "planejado";

    try {
      setSalvando(true);
      setMsgA11y(isEdicao ? "Salvando alterações..." : "Cadastrando solicitação...");

      if (isEdicao) {
        await api.put(`/api/solicitacoes-curso/${solicitacao.id}`, payload);
        toast.success("Solicitação atualizada com sucesso.");
      } else {
        await api.post("/api/solicitacoes-curso", payload);
        toast.success("Solicitação criada com sucesso.");
      }

      onSaved?.();
      onClose?.(); // ✅ fecha após salvar (comportamento premium padrão)
    } catch (err) {
      // tenta puxar msg do backend
      const msg =
        err?.response?.data?.erro ||
        err?.response?.data?.mensagem ||
        err?.data?.erro ||
        "Erro ao salvar a solicitação de curso.";
      console.error(err);
      toast.error(msg);
      setMsgA11y(msg);
    } finally {
      setSalvando(false);
    }
  }

  function handleFechar() {
    if (salvando) return;
    onClose?.();
  }

  if (!aberto) return null;

  return (
    <Modal
      open={aberto}
      onClose={salvando ? undefined : handleFechar}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Header hero (tema exclusivo) */}
      <header className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-emerald-900 via-emerald-700 to-teal-600">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold tracking-tight">
              <CalendarDays className="h-5 w-5 text-emerald-200" />
              {isEdicao ? "Editar solicitação de curso" : "Nova solicitação de curso"}
            </h2>
            <p id={descId} className="mt-1 text-sm text-white/85">
              Preencha os campos para registrar a proposta no calendário.
            </p>
          </div>

          <button
            type="button"
            onClick={handleFechar}
            disabled={salvando}
            className="rounded-xl p-2 text-white/90 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-60"
            aria-label="Fechar"
          >
            <span className="sr-only">Fechar</span>
            ✕
          </button>
        </div>
      </header>

      {/* Live region */}
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <CalendarDays className="w-5 h-5" />, label: "Datas", value: minis.qtd ? `${minis.qtd}` : "—" },
          { icon: <Clock className="w-5 h-5" />, label: "Período", value: minis.inicio !== "—" ? `${minis.inicio} → ${minis.fim}` : "—" },
          { icon: <Building2 className="w-5 h-5" />, label: "Unidade", value: minis.unidadeNome },
          { icon: <FileText className="w-5 h-5" />, label: "Carga", value: minis.carga },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              {m.icon}
              <span className="text-sm font-semibold">{m.label}</span>
            </div>
            <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white break-words">
              {m.value}
            </div>
          </div>
        ))}
      </section>

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-4 sm:px-6 pt-4 pb-24 space-y-5 max-h-[74vh] overflow-y-auto">
        {/* Dados gerais */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            Dados gerais
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Título */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <Type className="h-3.5 w-3.5" />
                Título do curso <span className="text-rose-500">*</span>
              </label>
              <input
                ref={firstFocusRef}
                type="text"
                value={form.titulo}
                onChange={(e) => handleChangeField("titulo", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: Atualização em cuidados paliativos na APS"
                maxLength={200}
                disabled={salvando}
              />
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Tipo de curso
              </label>
              <input
                type="text"
                value={form.tipo}
                onChange={(e) => handleChangeField("tipo", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Curso, oficina, encontro..."
                disabled={salvando}
              />
            </div>

            {/* Unidade */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Unidade responsável
              </label>
              <select
                value={form.unidade_id}
                onChange={(e) => handleChangeField("unidade_id", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={salvando}
              >
                <option value="">Selecione</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Modalidade */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Modalidade
              </label>
              <select
                value={form.modalidade}
                onChange={(e) => handleChangeField("modalidade", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={salvando}
              >
                <option value="">Selecione</option>
                {MODALIDADE_OPCOES.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Local */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <MapPin className="h-3.5 w-3.5" />
                Local
              </label>
              <input
                type="text"
                value={form.local}
                onChange={(e) => handleChangeField("local", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: Auditório da Escola da Saúde, remoto via Teams..."
                disabled={salvando}
              />
            </div>

            {/* Descrição */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Descrição
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) => handleChangeField("descricao", e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Objetivos, conteúdo e observações."
                disabled={salvando}
              />
            </div>

            {/* Público-alvo */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Público-alvo
              </label>
              <textarea
                value={form.publico_alvo}
                onChange={(e) => handleChangeField("publico_alvo", e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: enfermeiros da APS, residentes..."
                disabled={salvando}
              />
            </div>

            {/* Carga */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Carga horária total (horas)
              </label>
              <input
                type="number"
                min="0"
                value={form.carga_horaria_total}
                onChange={(e) => handleChangeField("carga_horaria_total", e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: 8"
                disabled={salvando}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Se vazio, calculamos uma estimativa pelos horários informados.
              </p>
            </div>

            {/* Certificado + status */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.gera_certificado}
                  onChange={(e) => handleChangeField("gera_certificado", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  disabled={salvando}
                />
                Este curso gera certificado
              </label>

              {isEdicao && podeEditarStatus && (
                <div className="flex flex-col gap-1 sm:w-56">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    Status da solicitação
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => handleChangeField("status", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={salvando}
                  >
                    {STATUS_OPCOES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Datas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
              <Clock className="h-4 w-4 text-emerald-600" />
              Datas e horários <span className="text-rose-500 text-xs">*</span>
            </h3>

            <button
              type="button"
              onClick={handleAdicionarData}
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Adicionar data
            </button>
          </div>

          <div className="space-y-2">
            {datas.map((linha) => (
              <div
                key={linha.id}
                className="grid gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-3 sm:grid-cols-[1.2fr,1fr,1fr,auto]"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Data
                  </label>
                  <input
                    type="date"
                    value={linha.data}
                    onChange={(e) => handleChangeDataLinha(linha.id, "data", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Início
                  </label>
                  <input
                    type="time"
                    value={linha.horario_inicio || ""}
                    onChange={(e) => handleChangeDataLinha(linha.id, "horario_inicio", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Fim
                  </label>
                  <input
                    type="time"
                    value={linha.horario_fim || ""}
                    onChange={(e) => handleChangeDataLinha(linha.id, "horario_fim", e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={salvando}
                  />
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoverData(linha.id)}
                    disabled={salvando || datas.length === 1}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200"
                    title="Remover data"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Palestrantes */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
            <School className="h-4 w-4 text-emerald-600" />
            Palestrantes
          </h3>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              Nome completo
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={novoPalestrante}
                onChange={(e) => setNovoPalestrante(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionarPalestranteNome();
                  }
                }}
                placeholder="Digite o nome completo e pressione Enter"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={salvando}
              />

              <button
                type="button"
                onClick={handleAdicionarPalestranteNome}
                disabled={salvando}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                <Plus className="mr-1 h-4 w-4" />
                Adicionar
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Evitamos duplicados por nome (case-insensitive).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3">
            {palestrantes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum palestrante adicionado.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {palestrantes.map((nome, idx) => (
                  <li
                    key={`${nome}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700"
                  >
                    <Users className="h-4 w-4 text-emerald-600" />
                    <span className="max-w-[220px] truncate">{nome}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoverPalestrante(idx)}
                      disabled={salvando}
                      className="text-slate-400 hover:text-rose-500 disabled:opacity-60"
                      aria-label={`Remover palestrante ${nome}`}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Restrição */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[13px] font-extrabold text-slate-800 dark:text-slate-100">
            <Lock className="h-4 w-4 text-emerald-600" />
            Controle de acesso
          </h3>

          <label className="inline-flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.restrito}
              onChange={(e) => handleChangeField("restrito", e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              disabled={salvando}
            />
            <span>
              Este curso possui acesso <strong>restrito</strong> (por categoria, unidade, etc.).
            </span>
          </label>

          {form.restrito && (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <Unlock className="h-4 w-4" />
                Descreva a restrição <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={form.restricao_descricao}
                onChange={(e) => handleChangeField("restricao_descricao", e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ex.: Restrito a enfermeiros da APS, residentes, profissionais da UPA Central..."
                disabled={salvando}
              />
            </div>
          )}
        </section>
      </form>

      {/* Footer sticky */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Campos com <span className="text-rose-500">*</span> são obrigatórios.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFechar}
            disabled={salvando}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => {
              const formEl = document.querySelector(`[aria-labelledby="${titleId}"] form`);
              // fallback caso não encontre: dispara submit direto
              if (formEl?.requestSubmit) formEl.requestSubmit();
              else {
                // eslint-disable-next-line no-undef
                const evt = new Event("submit", { cancelable: true, bubbles: true });
                formEl?.dispatchEvent?.(evt);
              }
            }}
            disabled={salvando}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition disabled:opacity-60"
            aria-busy={salvando ? "true" : "false"}
          >
            {salvando ? (isEdicao ? "Salvando..." : "Cadastrando...") : isEdicao ? "Salvar alterações" : "Cadastrar solicitação"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
