// ✅ src/components/ModalInscreverTrabalho.jsx (Premium + A11y + UX + sem TZ shift)
import { useEffect, useMemo, useRef, useState, useId } from "react";
import { motion } from "framer-motion";
import {
  X,
  FilePlus2,
  Loader2,
  CheckCircle2,
  Upload,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";
import api, { apiHead, apiUpload, apiGetFile, downloadBlob } from "../services/api";

/* Utils */
const unwrap = (r) => (r?.data ?? r);

const toMonthValue = (val) => {
  if (!val) return "";
  const s = String(val);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return "";
};

const sanitizeCPF = (s) => String(s || "").replace(/\D/g, "").slice(0, 11);
const trimStr = (s) => String(s || "").trim();

/* ───────────────────────── Helpers de DATA/HORA (sem TZ) ───────────────────────── */

// "2025-10-25" -> "25/10/2025"
function toBrDateOnly(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, yy, mm, dd] = m;
  return `${dd}/${mm}/${yy}`;
}

// "22:15" ou "22:15:00" -> "22:15"
function toBrTimeOnly(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  const [, hh, mi] = m;
  return `${hh}:${mi}`;
}

// "DD/MM/YYYY às HH:mm"
function toBrPretty(date, time) {
  const d = toBrDateOnly(date);
  const t = toBrTimeOnly(time);
  if (d && t) return `${d} às ${t}`;
  if (d) return d;
  return "";
}

// Aceita: "YYYY-MM-DDTHH:mm", "YYYY-MM-DDTHH:mm:ss", "YYYY-MM-DDTHH:mm:ss.SSS",
// com sufixo "Z" ou offset "+HH:MM"/"-HH:MM" (ignorado, sem shift)
function toBrPrettyFromIsoLike(isoLike) {
  if (typeof isoLike !== "string") return "";
  const s = isoLike.trim();
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?$/
  );
  if (m) {
    const [, yy, mm, dd, hh, mi] = m;
    return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
  }
  const onlyDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (onlyDate) {
    const [, yy, mm, dd] = onlyDate;
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

/** valida campos essenciais antes de enviar */
function validarForm(form, limites = {}, dentroPrazo = true) {
  const errs = [];
  if (!trimStr(form.titulo)) errs.push("Informe o título do trabalho.");
  if (!toMonthValue(form.inicio_experiencia)) errs.push("Selecione o mês/ano de início da experiência.");
  if (!form.linha_tematica_id) errs.push("Selecione a linha temática.");

  const longos = ["introducao", "objetivos", "metodo", "resultados", "consideracao", "bibliografia"];
  longos.forEach((k) => {
    const max = Number(limites[k]) || 2000;
    if ((form[k] || "").length > max) errs.push(`Campo "${k}" ultrapassa o limite de ${max} caracteres.`);
  });

  const maxCo = Number(form._maxCoautores || 10);
  if ((form.coautores?.length || 0) > maxCo) errs.push(`Máximo de ${maxCo} coautores.`);

  if (!dentroPrazo) errs.push("Prazo encerrado: não é possível salvar/enviar esta submissão.");

  return { ok: errs.length === 0, erros: errs };
}

export default function ModalInscreverTrabalho({
  chamadaId: propChamadaId,
  submissaoId: propSubId,
  onClose,
  onSucesso,
}) {
  const modalUid = useId();
  const dialogTitleId = `modal-submissao-title-${modalUid}`;
  const dialogDescId = `modal-submissao-desc-${modalUid}`;
  const inputTituloId = `submissao-titulo-${modalUid}`;
  const inputInicioId = `submissao-inicio-${modalUid}`;
  const inputLinhaId = `submissao-linha-${modalUid}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [chamada, setChamada] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [limites, setLimites] = useState({});
  const [maxCoautores, setMaxCoautores] = useState(10);
  const [modeloDisponivel, setModeloDisponivel] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);

  // id da submissão (rascunho/edição)
  const [submissaoId, setSubmissaoId] = useState(propSubId || null);

  // pôster
  const [posterState, setPosterState] = useState("idle"); // idle | uploading | done | error
  const [posterProgress, setPosterProgress] = useState(0);
  const [posterExistente, setPosterExistente] = useState("");

  const posterInputRef = useRef(null);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const [msgA11y, setMsgA11y] = useState("");

  const [form, setForm] = useState({
    titulo: "",
    inicio_experiencia: "",
    linha_tematica_id: "",
    introducao: "",
    objetivos: "",
    metodo: "",
    resultados: "",
    consideracao: "",
    bibliografia: "",
    coautores: [],
    poster: null,
    _maxCoautores: 10, // só validação local
  });

  // ✅ prazo legível e SEM timezone
  const prazoFmt = useMemo(() => {
    const v = chamada?.prazo_final_br ?? chamada?.prazo_final ?? chamada?.prazoFinal ?? null;
    if (!v) return "—";

    // Preferir campos separados, se existirem
    if (chamada?.prazo_final_date && chamada?.prazo_final_time) {
      return toBrPretty(chamada.prazo_final_date, chamada.prazo_final_time);
    }

    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(s)) return toBrPrettyFromIsoLike(s);
    return s;
  }, [chamada]);

  // ✅ aceita snake_case ou camelCase vindo do backend
  const dentroPrazo = !!(chamada?.dentro_prazo ?? chamada?.dentroPrazo);

  const bloqueado = saving || sending; // trava fechar enquanto processa

  async function checarModelo(chId) {
    if (!chId) {
      setModeloDisponivel(false);
      return;
    }
    try {
      const ok = await apiHead(`/chamadas/${chId}/modelo-banner`, {
        auth: true,
        on401: "silent",
        on403: "silent",
      });
      setModeloDisponivel(!!ok);
    } catch {
      setModeloDisponivel(false);
    }
  }

  async function baixarModeloBanner(chId) {
    if (!chId) return;
    try {
      setBaixandoModelo(true);
      const { blob, filename } = await apiGetFile(`/chamadas/${chId}/modelo-banner`);
      downloadBlob(filename || "modelo-poster.pptx", blob);
    } catch (e) {
      toast.error(e?.message || "Falha ao baixar o modelo de pôster.");
    } finally {
      setBaixandoModelo(false);
    }
  }

  // Escape para fechar + focus no primeiro campo
  useEffect(() => {
    if (loading) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        if (bloqueado) return;
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);

    // foca no primeiro campo após abrir
    const t = setTimeout(() => firstFieldRef.current?.focus(), 80);

    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bloqueado]);

  // Carrega:
  // - edição: submissão + chamada da submissão
  // - nova: chamada pelo propChamadaId
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setMsgA11y("Carregando dados da submissão...");

        if (propSubId) {
          const s = unwrap(await api.get(`/submissao/${propSubId}`));
          if (!alive) return;

          setSubmissaoId(s.id);

          setForm((f) => ({
            ...f,
            titulo: s.titulo || "",
            inicio_experiencia: toMonthValue(s.inicio_experiencia || s.inicioExperiencia),
            linha_tematica_id: s.linha_tematica_id || s.linhaTematicaId || "",
            introducao: s.introducao || "",
            objetivos: s.objetivos || "",
            metodo: s.metodo || "",
            resultados: s.resultados || "",
            consideracao: s.consideracoes || "",
            bibliografia: s.bibliografia || "",
            coautores: Array.isArray(s.coautores)
              ? s.coautores.map((c) => ({
                  nome: trimStr(c.nome),
                  cpf: sanitizeCPF(c.cpf),
                  email: trimStr(c.email),
                  vinculo: trimStr(c.vinculo),
                }))
              : [],
            _maxCoautores: Number(s.max_coautores ?? 10),
          }));

          // pôster existente
          if (s.poster_nome || s.posterNome) {
            setPosterExistente(s.poster_nome || s.posterNome);
            setPosterState("done");
          } else {
            setPosterExistente("");
            setPosterState("idle");
          }

          const chResp = unwrap(await api.get(`/chamadas/${s.chamada_id || s.chamadaId}`));
          const ch = chResp?.chamada || chResp;

          setChamada(ch || null);
          setLinhas(chResp?.linhas || []);
          setLimites(chResp?.limites || ch?.limites || {});

          const max = Number(ch?.max_coautores ?? 10);
          setMaxCoautores(max);
          setForm((f) => ({ ...f, _maxCoautores: max }));

          await checarModelo(ch?.id || s.chamada_id || s.chamadaId);
        } else {
          const r = unwrap(await api.get(`/chamadas/${propChamadaId}`));
          const ch = r?.chamada || r;

          setChamada(ch || null);
          setLinhas(r?.linhas || []);
          setLimites(r?.limites || ch?.limites || {});

          const max = Number(ch?.max_coautores ?? 10);
          setMaxCoautores(max);
          setForm((f) => ({ ...f, _maxCoautores: max }));

          await checarModelo(ch?.id || propChamadaId);
        }

        setMsgA11y("Dados carregados.");
      } catch (err) {
        console.error("Erro ao carregar modal:", err);
        toast.error("Falha ao carregar dados da submissão.");
        setMsgA11y("Falha ao carregar dados.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [propChamadaId, propSubId]);

  // Handlers
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const limparPosterSelecionado = () => {
    setForm((f) => ({ ...f, poster: null }));
    setPosterState(posterExistente ? "done" : "idle");
    setPosterProgress(0);
    if (posterInputRef.current) posterInputRef.current.value = "";
  };

  const onPosterChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPosterState("idle");
    setPosterProgress(0);

    if (file) {
      const type = String(file.type || "");
      const name = String(file.name || "").toLowerCase();

      const sizeOk = file.size <= 50 * 1024 * 1024;
      const typeOk =
        name.endsWith(".ppt") ||
        name.endsWith(".pptx") ||
        type === "application/vnd.ms-powerpoint" ||
        type === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

      if (!sizeOk) {
        toast.error("Arquivo muito grande (máximo 50MB).");
        limparPosterSelecionado();
        return;
      }
      if (!typeOk) {
        toast.error("Formato inválido. Use .ppt ou .pptx.");
        limparPosterSelecionado();
        return;
      }
    }

    setForm((f) => ({ ...f, poster: file }));
  };

  const addCoautor = () => {
    setForm((f) => {
      const lim = Number(f._maxCoautores || maxCoautores || 10);
      if ((f.coautores?.length || 0) >= lim) {
        toast.info(`Limite atingido: máximo de ${lim} coautor(es).`);
        return f;
      }
      return { ...f, coautores: [...(f.coautores || []), { nome: "", cpf: "", email: "", vinculo: "" }] };
    });
  };

  const remCoautor = (idx) => {
    setForm((f) => ({ ...f, coautores: (f.coautores || []).filter((_, i) => i !== idx) }));
  };

  const setCoautor = (idx, key, val) => {
    setForm((f) => {
      const arr = [...(f.coautores || [])];
      const i = Number(idx);
      arr[i] = { ...arr[i], [key]: key === "cpf" ? sanitizeCPF(val) : val };
      return { ...f, coautores: arr };
    });
  };

  async function criarOuAtualizar(statusAlvo) {
    const payload = {
      ...form,
      status: statusAlvo, // "rascunho" | "submetido"
      inicio_experiencia: toMonthValue(form.inicio_experiencia),
      linha_tematica_id: form.linha_tematica_id || null,
      coautores: (form.coautores || []).map((c) => ({
        nome: trimStr(c.nome),
        cpf: sanitizeCPF(c.cpf),
        email: trimStr(c.email),
        vinculo: trimStr(c.vinculo),
      })),
      poster: undefined, // upload separado
    };

    if (!submissaoId) {
      const r = await api.post(`/chamadas/${chamada?.id || propChamadaId}/submissao`, payload);
      const id = r?.data?.id ?? r?.id;
      if (id) setSubmissaoId(id);
      return id;
    } else {
      await api.put(`/submissao/${submissaoId}`, payload);
      return submissaoId;
    }
  }

  async function uploadPosterIfAny(id) {
    if (!form.poster || !id) return { ok: true };
    if (posterState === "uploading") return { ok: false, error: "Upload em andamento." };

    const f = form.poster;
    const rawName = trimStr(f.name);
    const rawType = trimStr(f.type);

    const isPptxMime = rawType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const isPptMime = rawType === "application/vnd.ms-powerpoint";

    let ext = rawName.toLowerCase().endsWith(".pptx") ? ".pptx" : rawName.toLowerCase().endsWith(".ppt") ? ".ppt" : "";
    if (!ext && (isPptxMime || isPptMime)) ext = isPptxMime ? ".pptx" : ".ppt";
    if (!ext) ext = ".pptx";

    const fixedType =
      ext === ".ppt" ? "application/vnd.ms-powerpoint" : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    const fixedName = rawName.toLowerCase().endsWith(ext) ? rawName : `${rawName}${ext}`;
    const fileToSend = new File([f], fixedName, { type: fixedType });

    const fd = new FormData();
    fd.append("poster", fileToSend, fileToSend.name);

    setPosterState("uploading");
    setPosterProgress(0);
    setMsgA11y("Enviando pôster...");

    const attempt = async () =>
      apiUpload(`/submissao/${id}/poster`, fd, {
        onUploadProgress: (evt) => {
          if (!evt?.total) return;
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setPosterProgress(pct);
        },
      });

    try {
      try {
        await attempt();
      } catch (e) {
        const status = e?.status || e?.response?.status;
        if (status === 429) {
          await new Promise((r) => setTimeout(r, 3200));
          await attempt();
        } else {
          throw e;
        }
      }

      setPosterProgress(100);
      setPosterState("done");
      setPosterExistente(fileToSend.name);
      setMsgA11y("Pôster enviado.");
      return { ok: true };
    } catch (e) {
      const msgBackend = e?.data?.erro || e?.response?.data?.erro;
      const status = e?.status || e?.response?.status;

      let msg = msgBackend || e?.message || "Falha ao enviar o pôster.";
      if (status === 413) msg = "Arquivo muito grande (máximo 50MB).";
      if (status === 400 && !msgBackend) msg = "Apenas arquivos .ppt ou .pptx.";

      console.error("Falha no upload do pôster:", e);
      setPosterState("error");
      setMsgA11y("Falha ao enviar pôster.");
      return { ok: false, error: msg };
    }
  }

  const onSalvar = async () => {
    const v = validarForm(form, limites, dentroPrazo);
    if (!v.ok) {
      toast.warning("Corrija os campos antes de salvar.");
      v.erros.slice(0, 4).forEach((m) => toast.info(m));
      return;
    }

    setSaving(true);
    setMsgA11y("Salvando rascunho...");
    try {
      const id = await criarOuAtualizar("rascunho");
      const up = await uploadPosterIfAny(id);
      if (!up.ok) toast.warning(`Rascunho salvo, mas o pôster não foi anexado: ${up.error}`);
      toast.success("✅ Rascunho salvo.");
      onSucesso?.();
      await checarModelo(chamada?.id || propChamadaId);
      setMsgA11y("Rascunho salvo.");
    } catch (e) {
      toast.error(e?.message || "Falha ao salvar rascunho.");
      setMsgA11y("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const onEnviar = async () => {
    const v = validarForm(form, limites, dentroPrazo);
    if (!v.ok) {
      toast.warning("Corrija os campos antes de enviar.");
      v.erros.slice(0, 4).forEach((m) => toast.info(m));
      return;
    }

    setSending(true);
    setMsgA11y("Enviando submissão...");
    try {
      const id = await criarOuAtualizar("submetido");
      const up = await uploadPosterIfAny(id);

      if (!up.ok) {
        toast.info("Submissão enviada (sem pôster). Você pode anexar depois em “Minhas submissões”.");
      } else {
        toast.success("✅ Submissão enviada!");
      }

      setSucesso(true);
      setTimeout(() => {
        onSucesso?.();
        onClose?.();
      }, 1200);
      setMsgA11y("Submissão enviada.");
    } catch (e) {
      toast.error(e?.message || "Falha ao enviar a submissão.");
      setMsgA11y("Falha ao enviar.");
    } finally {
      setSending(false);
    }
  };

  const atingiuMaxCoautores =
    (form.coautores?.length || 0) >= (Number(form._maxCoautores) || maxCoautores || 10);

  // Overlay de loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Erro: chamada não encontrada
  if (!chamada) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 px-6 py-5 shadow-2xl border border-black/10 dark:border-white/10 max-w-md w-full">
          <p className="text-zinc-700 dark:text-zinc-200 font-semibold">Chamada não encontrada.</p>
          <div className="mt-4 text-right">
            <button
              onClick={onClose}
              className="rounded-xl bg-zinc-900 dark:bg-zinc-200 px-4 py-2 text-white dark:text-zinc-900 font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="presentation"
      onMouseDown={(e) => {
        if (bloqueado) return;
        // fecha ao clicar fora do card
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div aria-live="polite" className="sr-only">
        {msgA11y}
      </div>

      <motion.div
        ref={dialogRef}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-black/10 dark:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescId}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-violet-700 via-indigo-600 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <h2 id={dialogTitleId} className="flex items-center gap-2 text-lg sm:text-xl font-extrabold tracking-tight">
              <FilePlus2 className="w-5 h-5" />
              {submissaoId ? "Editar submissão" : "Submeter trabalho"}
            </h2>

            <button
              onClick={bloqueado ? undefined : onClose}
              disabled={bloqueado}
              className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-60"
              aria-label="Fechar"
              title={bloqueado ? "Aguarde concluir a operação." : "Fechar"}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <p id={dialogDescId} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="opacity-90">{chamada?.titulo}</span>
            <span className={dentroPrazo ? "text-emerald-200" : "text-rose-200"}>
              Prazo: <strong className="tracking-tight">{prazoFmt}</strong>{" "}
              <span className="text-white/70">(horário local)</span>
            </span>
          </p>

          {!dentroPrazo && (
            <div className="mt-2 text-xs bg-rose-500/20 border border-rose-200/30 rounded-xl px-3 py-2">
              ⛔ Prazo encerrado. Visualização apenas (não é possível salvar/enviar).
            </div>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[76vh] overflow-y-auto p-5">
          {/* Título */}
          <div className="mb-4">
            <label htmlFor={inputTituloId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Título do trabalho
            </label>
            <input
              ref={firstFieldRef}
              id={inputTituloId}
              name="titulo"
              value={form.titulo}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={Number(limites.titulo) || 200}
              required
              disabled={!dentroPrazo}
            />
            <div className="mt-1 text-right text-xs text-zinc-500">
              {(form.titulo || "").length}/{Number(limites.titulo) || 200}
            </div>
          </div>

          {/* Início + Linha */}
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label htmlFor={inputInicioId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Início da experiência
              </label>
              <input
                id={inputInicioId}
                type="month"
                name="inicio_experiencia"
                value={toMonthValue(form.inicio_experiencia)}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={!dentroPrazo}
              />
            </div>
            <div>
              <label htmlFor={inputLinhaId} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Linha temática
              </label>
              <select
                id={inputLinhaId}
                name="linha_tematica_id"
                value={form.linha_tematica_id}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={!dentroPrazo}
              >
                <option value="">Selecione</option>
                {linhas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Campos longos */}
          {["introducao", "objetivos", "metodo", "resultados", "consideracao", "bibliografia"].map((field) => {
            const max = Number(limites[field]) || 2000;
            const label = field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ");
            return (
              <div key={field} className="mb-4">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</label>
                <textarea
                  name={field}
                  value={form[field]}
                  onChange={onChange}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={max}
                  disabled={!dentroPrazo}
                />
                <div className="mt-1 text-right text-xs text-zinc-500">
                  {(form[field] || "").length}/{max}
                </div>
              </div>
            );
          })}

          {/* Coautores */}
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-zinc-800 dark:text-white">
              Coautores <span className="text-zinc-500 font-semibold">(máx. {maxCoautores})</span>
            </h3>
            <button
              type="button"
              onClick={addCoautor}
              disabled={!dentroPrazo || atingiuMaxCoautores}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>

          {(form.coautores || []).map((c, i) => (
            <div key={i} className="mb-3 grid gap-2 sm:grid-cols-4">
              <input
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2"
                placeholder="Nome completo"
                value={c.nome}
                onChange={(e) => setCoautor(i, "nome", e.target.value)}
                disabled={!dentroPrazo}
              />
              <input
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2"
                placeholder="CPF (apenas números)"
                value={c.cpf}
                onChange={(e) => setCoautor(i, "cpf", e.target.value)}
                disabled={!dentroPrazo}
                inputMode="numeric"
              />
              <input
                className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2"
                placeholder="E-mail"
                type="email"
                value={c.email}
                onChange={(e) => setCoautor(i, "email", e.target.value)}
                disabled={!dentroPrazo}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950/40 px-3 py-2"
                  placeholder="Vínculo"
                  value={c.vinculo}
                  onChange={(e) => setCoautor(i, "vinculo", e.target.value)}
                  disabled={!dentroPrazo}
                />
                <button
                  type="button"
                  onClick={() => remCoautor(i)}
                  disabled={!dentroPrazo}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                  title="Remover"
                  aria-label="Remover coautor"
                >
                  <Trash2 className="w-4 h-4 text-zinc-600 dark:text-zinc-200" />
                </button>
              </div>
            </div>
          ))}

          {/* Pôster + modelo */}
          <div className="mt-6">
            <h3 className="mb-1 text-center text-sm font-extrabold text-zinc-800 dark:text-white">Pôster</h3>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <label
                className={[
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-white cursor-pointer",
                  posterState === "uploading" ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-700",
                  !dentroPrazo ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {posterState === "uploading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {posterState === "uploading"
                  ? `Enviando… ${posterProgress}%`
                  : posterState === "done"
                  ? "Enviado ✓"
                  : "Anexar pôster"}
                <input
                  ref={posterInputRef}
                  type="file"
                  accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={onPosterChange}
                  disabled={!dentroPrazo}
                />
              </label>

              {form.poster && (
                <button
                  type="button"
                  onClick={limparPosterSelecionado}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  title="Remover arquivo selecionado"
                >
                  <Trash2 className="w-4 h-4" />
                  Remover
                </button>
              )}

              <span className="text-zinc-500 dark:text-zinc-300">Formatos: .ppt / .pptx (até 50MB).</span>

              {modeloDisponivel ? (
                <button
                  type="button"
                  onClick={() => baixarModeloBanner(chamada?.id || propChamadaId)}
                  className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 hover:underline disabled:opacity-60"
                  disabled={baixandoModelo}
                  title="Baixar modelo de pôster"
                >
                  {baixandoModelo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Baixar modelo
                </button>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">(modelo indisponível)</span>
              )}
            </div>

            {(form.poster || posterExistente) && (
              <p className="mt-2 text-center text-xs text-zinc-600 dark:text-zinc-300">
                {form.poster ? (
                  <>
                    Selecionado: <strong>{form.poster.name}</strong>
                  </>
                ) : posterExistente ? (
                  <>
                    Já enviado: <strong>{posterExistente}</strong>
                  </>
                ) : null}
              </p>
            )}
          </div>
        </div>

        {/* Footer ações */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 px-4 py-3">
          <button
            type="button"
            onClick={onSalvar}
            disabled={saving || sending || !dentroPrazo}
            className="inline-flex items-center gap-2 rounded-xl bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-extrabold text-zinc-800 dark:text-zinc-100 ring-1 ring-zinc-300 dark:ring-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60"
            aria-busy={saving ? "true" : "false"}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar rascunho
          </button>

          <button
            type="button"
            onClick={onEnviar}
            disabled={saving || sending || !dentroPrazo}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-orange-700 disabled:opacity-60"
            aria-busy={sending ? "true" : "false"}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submissaoId ? "Salvar e enviar" : "Enviar"}
          </button>
        </div>

        {/* Sucesso overlay */}
        {sucesso && (
          <div className="absolute inset-0 bg-white/90 dark:bg-zinc-900/90 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mb-2" />
            <p className="text-emerald-700 dark:text-emerald-300 font-extrabold">Submissão enviada com sucesso!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
