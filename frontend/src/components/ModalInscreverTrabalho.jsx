// 📁 src/components/ModalInscreverTrabalho.jsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  X, FilePlus2, Loader2, CheckCircle2, Upload, Plus, Trash2, ExternalLink,
} from "lucide-react";
import api, { apiHead, apiUpload } from "../services/api";

export default function ModalInscreverTrabalho({
  chamadaId: propChamadaId,
  submissaoId: propSubId,
  onClose,
  onSucesso,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [chamada, setChamada] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [limites, setLimites] = useState({});
  const [maxCoautores, setMaxCoautores] = useState(10);
  const [modeloDisponivel, setModeloDisponivel] = useState(false);

  // id da submissão (rascunho/edição)
  const [submissaoId, setSubmissaoId] = useState(propSubId || null);

  // pôster
  const [posterState, setPosterState] = useState("idle"); // idle | uploading | done | error
  const [posterProgress, setPosterProgress] = useState(0);
  const [posterExistente, setPosterExistente] = useState(""); // nome do arquivo já enviado

  const [form, setForm] = useState({
    titulo: "",
    inicio_experiencia: "",
    linha_tematica_id: "",
    introducao: "",
    objetivos: "",
    metodo: "",
    resultados: "",
    consideracoes: "",
    bibliografia: "",
    coautores: [],
    poster: null,
  });

  const prazoFmt = useMemo(() => {
    const v = chamada?.prazo_final_br;
    const d = v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleString("pt-BR") : "—";
  }, [chamada]);

  // Carrega:
  // - edição: submissão + chamada da submissão
  // - nova: chamada pelo propChamadaId
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (propSubId) {
          // Submissão
          const s = await api.get(`/submissoes/${propSubId}`);
          const sub = s?.data ?? s;
          if (!alive) return;

          setSubmissaoId(sub.id);
          setForm((f) => ({
            ...f,
            titulo: sub.titulo || "",
            inicio_experiencia: sub.inicio_experiencia || "",
            linha_tematica_id: sub.linha_tematica_id || "",
            introducao: sub.introducao || "",
            objetivos: sub.objetivos || "",
            metodo: sub.metodo || "",
            resultados: sub.resultados || "",
            consideracoes: sub.consideracoes || "",
            bibliografia: sub.bibliografia || "",
            coautores: Array.isArray(sub.coautores)
              ? sub.coautores.map((c) => ({
                  nome: c.nome || "",
                  cpf: c.cpf || "",
                  email: c.email || "",
                  vinculo: c.vinculo || "",
                }))
              : [],
          }));

          // se já tem pôster, exibimos como "enviado"
          if (sub.poster_nome) {
            setPosterExistente(sub.poster_nome);
            setPosterState("done");
          } else {
            setPosterExistente("");
            setPosterState("idle");
          }

          // Chamada da submissão
          const ch = await api.get(`/chamadas/${sub.chamada_id}`);
          const payload = ch?.data ?? ch;
          const chamadaFound = payload?.chamada || payload;

          setChamada(chamadaFound || null);
          setLinhas(payload?.linhas || []);
          setLimites(payload?.limites || chamadaFound?.limites || {});
          setMaxCoautores(Number(chamadaFound?.max_coautores ?? 10));

          try {
            const ok = await apiHead(`/chamadas/${sub.chamada_id}/modelo-banner`, {
              auth: true,
              on401: "silent",
              on403: "silent",
            });
            setModeloDisponivel(!!ok);
          } catch {
            setModeloDisponivel(false);
          }
        } else {
          // Nova submissão
          const r = await api.get(`/chamadas/${propChamadaId}`);
          const payload = r?.data ?? r;
          const ch = payload?.chamada || payload;

          setChamada(ch || null);
          setLinhas(payload?.linhas || []);
          setLimites(payload?.limites || ch?.limites || {});
          setMaxCoautores(Number(ch?.max_coautores ?? 10));

          try {
            const ok = await apiHead(`/chamadas/${propChamadaId}/modelo-banner`, {
              auth: true,
              on401: "silent",
              on403: "silent",
            });
            setModeloDisponivel(!!ok);
          } catch {
            setModeloDisponivel(false);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar modal:", err);
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

  const onPosterChange = (e) => {
    const file = e.target.files?.[0] || null;
    setPosterState("idle");
    setPosterProgress(0);
    setForm((f) => ({ ...f, poster: file }));
  };

  const addCoautor = () => {
    setForm((f) => {
      const lim = maxCoautores || 10;
      if ((f.coautores?.length || 0) >= lim) return f;
      return {
        ...f,
        coautores: [...(f.coautores || []), { nome: "", cpf: "", email: "", vinculo: "" }],
      };
    });
  };

  const remCoautor = (idx) => {
    setForm((f) => ({ ...f, coautores: (f.coautores || []).filter((_, i) => i !== idx) }));
  };

  const setCoautor = (idx, key, val) => {
    setForm((f) => {
      const arr = [...(f.coautores || [])];
      arr[idx] = { ...arr[idx], [key]: val };
      return { ...f, coautores: arr };
    });
  };

  async function criarOuAtualizar(statusAlvo) {
    const payload = {
      ...form,
      status: statusAlvo, // "rascunho" | "submetido"
      linha_tematica_id: form.linha_tematica_id || null,
      coautores: (form.coautores || []).map((c) => ({
        nome: c.nome?.trim() || "",
        cpf: (c.cpf || "").replace(/\D/g, ""),
        email: c.email?.trim() || "",
        vinculo: c.vinculo?.trim() || "",
      })),
      poster: undefined,
    };

    if (!submissaoId) {
      const r = await api.post(`/chamadas/${chamada?.id || propChamadaId}/submissoes`, payload);
      const id = r?.data?.id ?? r?.id;
      if (id) setSubmissaoId(id);
      return id;
    } else {
      await api.put(`/submissoes/${submissaoId}`, payload);
      return submissaoId;
    }
  }

  async function uploadPosterIfAny(id) {
    if (!form.poster || !id) return { ok: true };
    if (posterState === "uploading") return { ok: false, error: "Upload em andamento." };
  
    // ── Normalização de nome e MIME (.ppt / .pptx)
    const f = form.poster;
    const rawName = (f.name || "").trim();
    const rawType = (f.type || "").trim();
  
    const isPptxMime = rawType === "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const isPptMime  = rawType === "application/vnd.ms-powerpoint";
  
    let ext = rawName.toLowerCase().endsWith(".pptx") ? ".pptx"
            : rawName.toLowerCase().endsWith(".ppt")  ? ".ppt"
            : "";
  
    // Se MIME indicar pptx/ppt mas o nome não tiver extensão, adiciona
    if (!ext && (isPptxMime || isPptMime)) {
      ext = isPptxMime ? ".pptx" : ".ppt";
    }
  
    // Se ainda sem extensão, assume .pptx por padrão
    if (!ext) ext = ".pptx";
  
    // Define MIME coerente com a extensão final
    const fixedType = ext === ".ppt"
      ? "application/vnd.ms-powerpoint"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  
    const fixedName = rawName.toLowerCase().endsWith(ext) ? rawName : `${rawName}${ext}`;
  
    const fileToSend = new File([f], fixedName, { type: fixedType });
  
    // ── Monta FormData com APENAS o campo esperado pelo backend
    const fd = new FormData();
    fd.append("poster", fileToSend, fileToSend.name);
  
    setPosterState("uploading");
    setPosterProgress(0);
  
    const attempt = async () => {
      // apiUpload já detecta FormData e não seta Content-Type manualmente
      return apiUpload(`/submissoes/${id}/poster`, fd);
    };
  
    try {
      try {
        await attempt();
      } catch (e) {
        const status = e?.status || e?.response?.status;
        // Respeita o rate-limit simples da rota (3s na sua API)
        if (status === 429) {
          await new Promise((r) => setTimeout(r, 3200));
          await attempt();
        } else {
          throw e;
        }
      }
  
      setPosterProgress(100);
      setPosterState("done");
      return { ok: true };
    } catch (e) {
      // Erro do backend (mensagem amigável já vem como {erro: "..."} nas suas rotas)
      const msgBackend = e?.data?.erro || e?.response?.data?.erro;
      const status = e?.status || e?.response?.status;
  
      let msg = msgBackend || e?.message || "Falha ao enviar o pôster.";
      if (status === 413) msg = "Arquivo muito grande (máximo 50MB).";
      if (status === 400 && !msgBackend) msg = "Apenas arquivos .ppt ou .pptx.";
  
      console.error("Falha no upload do pôster:", e);
      setPosterState("error");
      return { ok: false, error: msg };
    }
  }
  
  const onSalvar = async () => {
    setSaving(true);
    try {
      const id = await criarOuAtualizar("rascunho");
      const up = await uploadPosterIfAny(id);
      if (!up.ok) alert(`Rascunho salvo, mas o pôster não foi anexado.\nMotivo: ${up.error}`);
      onSucesso?.();
    } catch (e) {
      alert(e?.message || "Falha ao salvar rascunho.");
    } finally {
      setSaving(false);
    }
  };

  const onEnviar = async () => {
    setSending(true);
    try {
      const id = await criarOuAtualizar("submetido");
      const up = await uploadPosterIfAny(id);
      if (!up.ok) {
        alert("Submissão enviada (sem pôster). Você pode anexar o pôster depois em “Minhas submissões”.");
      }
      setSucesso(true);
      setTimeout(() => {
        onSucesso?.();
        onClose?.();
      }, 1200);
    } catch (e) {
      alert(e?.message || "Falha ao enviar a submissão.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }
  if (!chamada) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
        <div className="rounded-xl bg-white px-6 py-4 shadow">
          <p className="text-zinc-700">Chamada não encontrada.</p>
          <div className="mt-3 text-right">
            <button onClick={onClose} className="rounded-md bg-zinc-800 px-3 py-1.5 text-white">
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dentroPrazo = !!chamada.dentro_prazo;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-violet-700 via-indigo-600 to-blue-500 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl font-semibold">
              <FilePlus2 className="w-5 h-5" />
              {submissaoId ? "Editar submissão" : "Submeter trabalho"}
            </h2>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Fechar">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="opacity-90">{chamada?.titulo}</p>
            <p className={dentroPrazo ? "text-emerald-200" : "text-rose-200"}>Prazo: {prazoFmt}</p>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[76vh] overflow-y-auto p-5">
          {/* Título */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700">Título do trabalho</label>
            <input
              name="titulo"
              value={form.titulo}
              onChange={onChange}
              className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="block text-sm font-medium text-zinc-700">Início da experiência</label>
              <input
                type="month"
                name="inicio_experiencia"
                value={form.inicio_experiencia}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={!dentroPrazo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Linha temática</label>
              <select
                name="linha_tematica_id"
                value={form.linha_tematica_id}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          {["introducao", "objetivos", "metodo", "resultados", "consideracoes", "bibliografia"].map(
            (field) => (
              <div key={field} className="mb-4">
                <label className="block text-sm font-medium text-zinc-700">
                  {field.charAt(0).toUpperCase() + field.slice(1).replace("_", " ")}
                </label>
                <textarea
                  name={field}
                  value={form[field]}
                  onChange={onChange}
                  rows={4}
                  className="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={Number(limites[field]) || 2000}
                  disabled={!dentroPrazo}
                />
                <div className="mt-1 text-right text-xs text-zinc-500">
                  {(form[field] || "").length}/{Number(limites[field]) || 2000}
                </div>
              </div>
            )
          )}

          {/* Coautores */}
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-800">
              Coautores (máx. {maxCoautores})
            </h3>
            <button
              type="button"
              onClick={addCoautor}
              disabled={!dentroPrazo}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Adicionar coautor
            </button>
          </div>
          {(form.coautores || []).map((c, i) => (
            <div key={i} className="mb-3 grid gap-2 sm:grid-cols-4">
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="Nome completo"
                value={c.nome}
                onChange={(e) => setCoautor(i, "nome", e.target.value)}
                disabled={!dentroPrazo}
              />
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="CPF (apenas números)"
                value={c.cpf}
                onChange={(e) => setCoautor(i, "cpf", e.target.value.replace(/\D/g, ""))}
                disabled={!dentroPrazo}
              />
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="E-mail"
                type="email"
                value={c.email}
                onChange={(e) => setCoautor(i, "email", e.target.value)}
                disabled={!dentroPrazo}
              />
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border px-3 py-2"
                  placeholder="Vínculo empregatício"
                  value={c.vinculo}
                  onChange={(e) => setCoautor(i, "vinculo", e.target.value)}
                  disabled={!dentroPrazo}
                />
                <button
                  type="button"
                  onClick={() => remCoautor(i)}
                  disabled={!dentroPrazo}
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-100 px-3 hover:bg-zinc-200 disabled:opacity-50"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4 text-zinc-600" />
                </button>
              </div>
            </div>
          ))}

          {/* Pôster + modelo */}
          <div className="mt-6">
            <h3 className="mb-1 text-center text-sm font-semibold text-zinc-800">Pôster</h3>

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <label
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium text-white cursor-pointer ${
                  posterState === "uploading" ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-700"
                } ${!dentroPrazo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {posterState === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {posterState === "uploading"
                  ? `Enviando… ${posterProgress}%`
                  : posterState === "done"
                  ? "Enviado ✓"
                  : "Anexar pôster"}
                <input
                  type="file"
                  accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={onPosterChange}
                  disabled={!dentroPrazo}
                />
              </label>

              <span className="text-zinc-500">Formatos: .ppt / .pptx (até 50MB).</span>

              {modeloDisponivel && (
                <a
                  href={`/api/chamadas/${chamada.id}/modelo-banner`}
                  className="inline-flex items-center gap-1 text-indigo-700 hover:underline"
                >
                  Baixar modelo <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {(form.poster || posterExistente) && (
              <p className="mt-2 text-center text-xs text-zinc-600">
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
        <div className="flex items-center justify-end gap-3 border-t bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onSalvar}
            disabled={saving || sending || !dentroPrazo}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-800 ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </button>
          <button
            type="button"
            onClick={onEnviar}
            disabled={saving || sending || !dentroPrazo}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submissaoId ? "Salvar e enviar" : "Enviar"}
          </button>
        </div>

        {/* Sucesso overlay */}
        {sucesso && (
          <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mb-2" />
            <p className="text-emerald-700 font-semibold">Submissão enviada com sucesso!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
