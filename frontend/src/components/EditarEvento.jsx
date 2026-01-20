// 📁 src/components/EditarEvento.jsx
import { useEffect, useMemo, useState, useCallback, useId } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  Save,
  Trash2,
  Undo2,
  ArrowLeft,
  PencilLine,
} from "lucide-react";

import CabecalhoPainel from "../components/CabecalhoPainel";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import BadgeStatus from "../components/BadgeStatus";
import MiniStat from "../components/MiniStat";
import ModalConfirmacao from "../components/ModalConfirmacao";

import { apiGet, apiPut, apiDelete } from "../services/api";

/* =========================== Helpers (date-only SAFE) =========================== */
// ✅ aceita "YYYY-MM-DD" ou ISO; retorna "YYYY-MM-DD" (sem usar Date para date-only)
function normalizeYMD(input) {
  if (!input) return "";
  const s = String(input).trim();

  // date-only puro
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;

  // datetime ISO ou "YYYY-MM-DD HH:mm"
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  return "";
}

function hhmm(v, fallback = "") {
  const s = String(v || "").trim();
  return /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5).padStart(5, "0") : fallback;
}

// ✅ cria Date local via componentes (sem TZ parse)
function toDateLocal(ymd, hh = "00:00") {
  const d = normalizeYMD(ymd);
  if (!d) return null;
  const [Y, M, D] = d.split("-").map((x) => parseInt(x, 10));
  const [h, m] = hhmm(hh, "00:00").split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(Y) || !Number.isFinite(M) || !Number.isFinite(D)) return null;
  return new Date(Y, (M || 1) - 1, D || 1, Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
}

function getStatusByDateTime({ di, df, hi, hf, agora = new Date() }) {
  const start = toDateLocal(di || null, hi || "00:00");
  const end = toDateLocal(df || null, hf || "23:59");
  if (!start || !end || Number.isNaN(+start) || Number.isNaN(+end)) return "desconhecido";
  if (agora < start) return "programado";
  if (agora > end) return "encerrado";
  return "andamento";
}

// YYYY-MM-DD -> DD/MM/YYYY
function ymdToBR(ymd) {
  const d = normalizeYMD(ymd);
  if (!d) return "—";
  const [Y, M, D] = d.split("-");
  return `${D}/${M}/${Y}`;
}

function isAfterYMD(a, b) {
  if (!a || !b) return false;
  return String(a) > String(b); // lexical ok p/ YYYY-MM-DD
}

function pickPayload(form) {
  // 🔒 manda só o necessário (evita enviar lixo ou campos que o backend não espera)
  return {
    nome: (form?.nome || "").trim(),
    data_inicio: normalizeYMD(form?.data_inicio) || null,
    data_fim: normalizeYMD(form?.data_fim) || null,
    horario_inicio_geral: hhmm(form?.horario_inicio_geral, "") || null,
    horario_fim_geral: hhmm(form?.horario_fim_geral, "") || null,
    // se existirem outros campos reais no teu evento, você pode incluir aqui
    // ex: local, tipo, descricao, unidade_id...
  };
}

function shallowEqual(a, b) {
  const ka = Object.keys(a || {});
  const kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/* ================================ Componente ================================ */
export default function EditarEvento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveId = useId();

  const nomeUsuario = useMemo(() => localStorage.getItem("nome") || "", []);
  const [evento, setEvento] = useState(null);
  const [original, setOriginal] = useState(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroGeral, setErroGeral] = useState("");
  const [errors, setErrors] = useState({});
  const [liveMsg, setLiveMsg] = useState("");

  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);

  /* ============================== Carregar ============================== */
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroGeral("");
    try {
      const data = await apiGet(`/api/eventos/${id}`);

      const normalizado = {
        ...data,
        nome: data?.nome ?? data?.titulo ?? "",
        data_inicio: normalizeYMD(data?.data_inicio),
        data_fim: normalizeYMD(data?.data_fim),
        horario_inicio_geral: hhmm(data?.horario_inicio_geral, hhmm(data?.horario_inicio, "")),
        horario_fim_geral: hhmm(data?.horario_fim_geral, hhmm(data?.horario_fim, "")),
      };

      const basePayload = pickPayload(normalizado);
      setEvento({ ...normalizado, ...basePayload });
      setOriginal({ ...normalizado, ...basePayload });
    } catch {
      setErroGeral("Erro ao carregar evento.");
      setEvento(null);
      setOriginal(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /* ============================== A11y announce ============================== */
  const announce = (msg) => {
    setLiveMsg(msg);
    requestAnimationFrame(() => {
      setLiveMsg("");
      requestAnimationFrame(() => setLiveMsg(msg));
    });
  };

  /* ============================== Form ============================== */
  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      setEvento((prev) => {
        if (!prev) return prev;
        let next = { ...prev, [name]: value };

        // Auto-caoão do período (date-only)
        if (name === "data_inicio") {
          const di = normalizeYMD(value);
          const df = normalizeYMD(prev?.data_fim);
          if (di && df && isAfterYMD(di, df)) {
            next.data_fim = di;
            announce("Ajustei a data de fim para manter o período válido.");
          }
        }

        if (name === "data_fim") {
          const df = normalizeYMD(value);
          const di = normalizeYMD(prev?.data_inicio);
          if (di && df && isAfterYMD(di, df)) {
            next.data_inicio = df;
            announce("Ajustei a data de início para manter o período válido.");
          }
        }

        return next;
      });

      setErrors((prev) => ({ ...prev, [name]: "" }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function validar(form) {
    const msgs = {};
    if (!form?.nome?.trim()) msgs.nome = "Informe o título do evento.";

    const di = normalizeYMD(form?.data_inicio);
    const df = normalizeYMD(form?.data_fim);
    if (!di) msgs.data_inicio = "Informe a data de início.";
    if (!df) msgs.data_fim = "Informe a data de fim.";
    if (di && df && di > df) msgs.data_fim = "A data de fim não pode ser anterior à data de início.";

    const hi = hhmm(form?.horario_inicio_geral, "");
    const hf = hhmm(form?.horario_fim_geral, "");
    if ((hi && !hf) || (!hi && hf)) {
      msgs.horario_fim_geral = "Preencha horário de início e fim (ou deixe ambos em branco).";
    }

    return msgs;
  }

  const dirty = useMemo(() => {
    if (!evento || !original) return false;
    return !shallowEqual(pickPayload(evento), pickPayload(original));
  }, [evento, original]);

  const statusKey = useMemo(() => {
    if (!evento) return "desconhecido";
    const di = normalizeYMD(evento?.data_inicio);
    const df = normalizeYMD(evento?.data_fim);
    const hi = hhmm(evento?.horario_inicio_geral, "00:00");
    const hf = hhmm(evento?.horario_fim_geral, "23:59");
    if (!di || !df) return "desconhecido";
    return getStatusByDateTime({ di, df, hi, hf });
  }, [evento]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!evento || salvando || excluindo) return;

      const msgs = validar(evento);
      setErrors(msgs);
      if (Object.keys(msgs).length) {
        toast.warn("⚠️ Corrija os campos destacados.");
        return;
      }

      const payload = pickPayload(evento);

      if (original && shallowEqual(payload, pickPayload(original))) {
        toast.info("Nenhuma alteração para salvar.");
        return;
      }

      setSalvando(true);
      setErroGeral("");

      try {
        await apiPut(`/api/eventos/${id}`, payload);
        toast.success("✅ Evento atualizado com sucesso!");
        setOriginal((prev) => ({ ...(prev || {}), ...payload }));
        navigate("/administrador", { replace: true });
      } catch {
        toast.error("❌ Não foi possível atualizar o evento.");
        setErroGeral("Não foi possível atualizar o evento.");
      } finally {
        setSalvando(false);
      }
    },
    [evento, salvando, excluindo, id, navigate, original]
  );

  const confirmarExcluir = useCallback(async () => {
    if (excluindo || salvando) return false;
    setExcluindo(true);
    try {
      await apiDelete(`/api/eventos/${id}`);
      toast.success("🗑️ Evento excluído com sucesso!");
      navigate("/administrador", { replace: true });
      return true;
    } catch {
      toast.error("❌ Erro ao excluir evento.");
      return false;
    } finally {
      setExcluindo(false);
    }
  }, [excluindo, salvando, id, navigate]);

  /* ============================== UI states ============================== */
  if (carregando && !erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Evento" variantOverride="teal" />
        <p className="p-4 text-center text-gray-600 dark:text-gray-300" role="status" aria-live="polite">
          Carregando…
        </p>
      </main>
    );
  }

  if (!evento && erroGeral) {
    return (
      <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
        <CabecalhoPainel tituloOverride="Editar Evento" variantOverride="teal" />
        <p className="p-4 text-center text-red-600 dark:text-red-400" role="alert" aria-live="assertive">
          {erroGeral}
        </p>
        <div className="mt-2 flex justify-center">
          <BotaoSecundario onClick={() => navigate(-1)} variant="outline">
            ← Voltar
          </BotaoSecundario>
        </div>
      </main>
    );
  }

  const nome = evento?.nome || "";
  const di = normalizeYMD(evento?.data_inicio);
  const df = normalizeYMD(evento?.data_fim);
  const hiGeral = hhmm(evento?.horario_inicio_geral, "");
  const hfGeral = hhmm(evento?.horario_fim_geral, "");

  const periodoLabel = di && df ? `${ymdToBR(di)} → ${ymdToBR(df)}` : "Período não definido";
  const horarioLabel = hiGeral && hfGeral ? `${hiGeral}–${hfGeral}` : "Horário geral não definido";

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-6">
      <CabecalhoPainel tituloOverride="Editar Evento" variantOverride="teal" />

      {/* Header Hero premium (identidade própria da página) */}
      <div className="max-w-2xl mx-auto mb-4">
        <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="px-5 py-4 text-white bg-gradient-to-br from-teal-900 via-emerald-700 to-cyan-600">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-white/90 text-xs font-extrabold uppercase tracking-wide">
                  <PencilLine className="w-4 h-4" aria-hidden="true" />
                  Editor de evento
                </div>
                <h1 className="mt-1 text-xl sm:text-2xl font-extrabold tracking-tight break-words">
                  {nome || "Editar Evento"}
                </h1>
                <p className="mt-1 text-white/90 text-sm">
                  Logado como <strong>{nomeUsuario || "usuário(a)"}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {statusKey !== "desconhecido" && (
                  <BadgeStatus status={statusKey} size="sm" variant="soft" />
                )}
              </div>
            </div>
          </div>

          {/* Ministats */}
          <div className="px-5 py-4 bg-white dark:bg-slate-950/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniStat
                title="Período"
                value={periodoLabel}
                hint={di && df ? "Datas (date-only)" : "Preencha início e fim"}
                isDark={false}
              />
              <MiniStat
                title="Horário geral"
                value={horarioLabel}
                hint="Opcional (recomendado)"
                isDark={false}
              />
              <MiniStat
                title="Alterações"
                value={dirty ? "Pendentes" : "Sem alterações"}
                hint={dirty ? "Não esqueça de salvar" : "Tudo em dia"}
                isDark={false}
              />
            </div>

            {/* A11y live */}
            <p id={`${liveId}-live`} role="status" aria-live="polite" className="sr-only">
              {liveMsg}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
        role="region"
        aria-labelledby="editar-evento-titulo"
      >
        <div className="rounded-3xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 id="editar-evento-titulo" className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                ✏️ Editar informações
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Ajuste os campos e salve no final.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900
                         text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Voltar
            </button>
          </div>

          {erroGeral && (
            <div className="px-5 pt-4">
              <p className="text-sm text-rose-700 dark:text-rose-300" role="alert" aria-live="assertive">
                {erroGeral}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5" aria-label="Formulário de edição de evento" noValidate>
            <fieldset disabled={salvando || excluindo} aria-busy={salvando || excluindo} className="space-y-4">
              {/* Título */}
              <div>
                <label htmlFor="titulo" className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                  Título <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="titulo"
                  type="text"
                  name="nome"
                  value={nome}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  aria-invalid={!!errors.nome}
                  aria-describedby={errors.nome ? "erro-nome" : undefined}
                  placeholder="Digite o título do evento"
                  className={[
                    "w-full rounded-2xl px-4 py-3 border bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                    errors.nome ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700",
                  ].join(" ")}
                />
                {errors.nome && (
                  <p id="erro-nome" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                    {errors.nome}
                  </p>
                )}
              </div>

              {/* Período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="data_inicio" className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                    Data de Início <span className="text-rose-600" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="data_inicio"
                      type="date"
                      name="data_inicio"
                      value={di}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      aria-invalid={!!errors.data_inicio}
                      aria-describedby={errors.data_inicio ? "erro-data_inicio" : undefined}
                      className={[
                        "w-full pl-9 rounded-2xl px-4 py-3 border bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        errors.data_inicio ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700",
                      ].join(" ")}
                    />
                  </div>
                  {errors.data_inicio && (
                    <p id="erro-data_inicio" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                      {errors.data_inicio}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="data_fim" className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                    Data de Fim <span className="text-rose-600" aria-hidden="true">*</span>
                  </label>
                  <div className="relative">
                    <CalendarDays className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="data_fim"
                      type="date"
                      name="data_fim"
                      value={df}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      aria-invalid={!!errors.data_fim}
                      aria-describedby={errors.data_fim ? "erro-data_fim" : undefined}
                      min={di || undefined}
                      className={[
                        "w-full pl-9 rounded-2xl px-4 py-3 border bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        errors.data_fim ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700",
                      ].join(" ")}
                    />
                  </div>
                  {errors.data_fim && (
                    <p id="erro-data_fim" className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                      {errors.data_fim}
                    </p>
                  )}
                </div>
              </div>

              {/* Horário geral */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="horario_inicio_geral" className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                    Horário de Início (geral)
                  </label>
                  <div className="relative">
                    <Clock3 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="horario_inicio_geral"
                      type="time"
                      name="horario_inicio_geral"
                      value={hiGeral}
                      onChange={handleChange}
                      className="w-full pl-9 rounded-2xl px-4 py-3 border bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="horario_fim_geral" className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                    Horário de Fim (geral)
                  </label>
                  <div className="relative">
                    <Clock3 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                      id="horario_fim_geral"
                      type="time"
                      name="horario_fim_geral"
                      value={hfGeral}
                      onChange={handleChange}
                      aria-invalid={!!errors.horario_fim_geral}
                      className={[
                        "w-full pl-9 rounded-2xl px-4 py-3 border bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white",
                        "focus:outline-none focus:ring-2 focus:ring-emerald-500",
                        errors.horario_fim_geral ? "border-rose-400 dark:border-rose-500" : "border-slate-200 dark:border-slate-700",
                      ].join(" ")}
                    />
                  </div>
                  {errors.horario_fim_geral && (
                    <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                      {errors.horario_fim_geral}
                    </p>
                  )}
                </div>
              </div>

              {/* Hint status */}
              {statusKey !== "desconhecido" && (
                <div
                  className={[
                    "rounded-2xl border p-3",
                    statusKey === "programado"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                      : statusKey === "andamento"
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                      : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    {statusKey === "programado" ? (
                      <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    ) : statusKey === "andamento" ? (
                      <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold">
                        Prévia do status: <span className="uppercase">{statusKey}</span>
                      </div>
                      <div className="text-xs opacity-90">
                        Calculado por <strong>data + horário geral</strong> (quando informado).
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </fieldset>

            {/* Footer sticky actions */}
            <div className="sticky bottom-0 -mx-5 px-5 py-3 mt-2 bg-white/85 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <BotaoPrimario type="submit" disabled={salvando || excluindo || !dirty} className="w-full sm:w-auto">
                    <span className="inline-flex items-center gap-2">
                      <Save className="w-4 h-4" aria-hidden="true" />
                      {salvando ? "Salvando..." : "Salvar alterações"}
                    </span>
                  </BotaoPrimario>

                  <BotaoSecundario
                    type="button"
                    onClick={() => navigate(-1)}
                    variant="outline"
                    disabled={salvando || excluindo}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </BotaoSecundario>

                  <BotaoSecundario
                    type="button"
                    onClick={() => {
                      if (!original) return;
                      setEvento((prev) => ({ ...(prev || {}), ...pickPayload(original) }));
                      setErrors({});
                      toast.info("Alterações descartadas.");
                    }}
                    variant="outline"
                    disabled={!dirty || salvando || excluindo}
                    className="w-full sm:w-auto"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Undo2 className="w-4 h-4" aria-hidden="true" />
                      Descartar
                    </span>
                  </BotaoSecundario>
                </div>

                <button
                  type="button"
                  onClick={() => setModalExcluirOpen(true)}
                  disabled={salvando || excluindo}
                  className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-2xl
                             bg-rose-50 text-rose-700 border border-rose-200
                             hover:bg-rose-100 transition font-extrabold
                             dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-900/40
                             disabled:opacity-60"
                  aria-disabled={salvando || excluindo}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {excluindo ? "Excluindo..." : "Excluir evento"}
                </button>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {dirty ? "Você tem alterações pendentes." : "Nenhuma alteração pendente."}
              </div>
            </div>
          </form>
        </div>
      </motion.div>

      {/* ✅ ModalConfirmacao premium */}
      <ModalConfirmacao
        isOpen={modalExcluirOpen}
        onClose={() => setModalExcluirOpen(false)}
        onConfirmar={async () => {
          const ok = await confirmarExcluir();
          return ok; // false mantém aberto (se falhar)
        }}
        titulo="Excluir evento"
        mensagem={
          <div className="space-y-2">
            <p>
              Você está prestes a excluir o evento <strong>{nome || "—"}</strong>.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Esta ação pode ser bloqueada se houver turmas, presenças ou certificados vinculados.
            </p>
          </div>
        }
        textoBotaoConfirmar={excluindo ? "Excluindo..." : "Sim, excluir"}
        textoBotaoCancelar="Cancelar"
        variant="danger"
        level={2}
      />
    </main>
  );
}
