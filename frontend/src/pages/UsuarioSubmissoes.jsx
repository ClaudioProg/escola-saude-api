// 📁 frontend/src/pages/UsuarioSubmissoes.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Send,
  Upload as UploadIcon,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  BookOpen,
  ClipboardList,
  X,
  Save,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import Footer from "../components/Footer";
import { fmtDataHora } from "../utils/data";

// ✅ cliente
import api, { apiGet, apiDelete, apiPut, apiUpload as apiUploadSvc } from "../services/api";

/* ───────── helpers ───────── */
function wallToLocalDate(wall) {
  if (!wall || typeof wall !== "string") return null;
  const m = wall.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const hh = parseInt(m[4], 10);
  const mm = parseInt(m[5], 10);
  const ss = m[6] ? parseInt(m[6], 10) : 0;
  const dt = new Date(y, mo - 1, d, hh, mm, ss, 0);
  return isNaN(dt) ? null : dt;
}
function computeDentroPrazoFromWall(wall) {
  const dt = wallToLocalDate(wall);
  return !dt ? true : dt.getTime() >= Date.now();
}
const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cpfRx = /^\d{11}$/;

/* ───────── UI ───────── */
const Card = ({ children }) => (
  <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">{children}</div>
);
const Field = ({ label, hint, error, children, className = "" }) => (
  <div className={`mb-4 ${className}`}>
    {label && <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</label>}
    {children}
    {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
  </div>
);
const Counter = ({ value = "", max }) => {
  const len = String(value).length;
  const over = max ? len > max : false;
  return <span className={`text-xs ${over ? "text-red-600" : "text-zinc-500"}`}>{len}{max ? `/${max}` : ""}</span>;
};

function HeaderHero({ title, subtitle, accent = "emerald" }) {
  const accents = {
    emerald: "bg-emerald-600 dark:bg-emerald-700",
    teal: "bg-teal-600 dark:bg-teal-700",
    sky: "bg-sky-600 dark:bg-sky-700",
    violet: "bg-violet-600 dark:bg-violet-700",
    amber: "bg-amber-600 dark:bg-amber-700",
    indigo: "bg-indigo-600 dark:bg-indigo-700",
    rose: "bg-rose-600 dark:bg-rose-700",
  };
  const bar = accents[accent] || accents.emerald;
  return (
    <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className={`w-full ${bar} text-white`}>
      <div className="mx-auto max-w-screen-xl px-4 py-6 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <FileText className="h-10 w-10" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm leading-5 opacity-90 sm:text-base">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function Modal({ open, onClose, title, icon: Icon, children, footer, maxWidth = "max-w-4xl" }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" aria-modal="true" role="dialog">
          <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            className={`relative w-full ${maxWidth} rounded-2xl border bg-white p-0 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900`}>
            <div className="flex items-center justify-between border-b p-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {Icon ? <Icon className="h-5 w-5" /> : null}
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
              <button onClick={onClose} className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6">{children}</div>
            {footer ? <div className="flex items-center justify-end gap-3 border-t p-3 dark:border-zinc-800">{footer}</div> : null}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ───────── Limites ───────── */
const LIM_DEFAULT = {
  titulo: 100,
  introducao: 2000,
  objetivos: 1000,
  metodo: 1500,
  resultados: 1500,
  consideracoes: 1000,
  bibliografia: 8000,
};

export default function UsuarioSubmissoes() {
  const [ativas, setAtivas] = useState([]);
  const [loadingAtivas, setLoadingAtivas] = useState(true);
  const [modeloOk, setModeloOk] = useState({}); // { [chamadaId]: boolean }

  const [minhas, setMinhas] = useState([]);
  const [loadingMinhas, setLoadingMinhas] = useState(true);

  const [editalOpen, setEditalOpen] = useState(false);
  const [submeterOpen, setSubmeterOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const [editingId, setEditingId] = useState(null); // edição de submissão existente

  const [form, setForm] = useState({
    titulo: "",
    inicio_experiencia: "2025-01",
    linha_tematica_id: "",
    introducao: "",
    objetivos: "",
    metodo: "",
    resultados: "",
    consideracoes: "",
    bibliografia: "",
    coautores: [], // [{nome, cpf, email, vinculo}]
  });

  // upload no modal
  const [posterFile, setPosterFile] = useState(null);
  const [posterErr, setPosterErr] = useState("");
  const [posterBusy, setPosterBusy] = useState(false);

  const [errForm, setErrForm] = useState("");
  const [saving, setSaving] = useState(false);

  const inputBase =
    "w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800";

  const abortRef = useRef(null);

  // carregar listas
  useEffect(() => {
    (async () => {
      try {
        setLoadingAtivas(true);
        let rows = [];
        try { rows = await apiGet(`/chamadas/ativas`); } catch { rows = []; }
        if (!Array.isArray(rows) || rows.length === 0) {
          try { rows = await apiGet(`/chamadas/publicadas`); } catch { rows = []; }
        }
        const sane = (Array.isArray(rows) ? rows : []).map((c) => ({
          ...c,
          publicado: c.publicado ?? true,
          dentro_prazo: typeof c.dentro_prazo === "boolean" ? c.dentro_prazo : computeDentroPrazoFromWall(c.prazo_final_br),
        }));
        setAtivas(sane);

        // checa modelo disponível (HEAD) para cada chamada
        const updates = {};
        await Promise.all(
          sane.map(async (c) => {
            try {
              const url = `/api/chamadas/${c.id}/modelo-banner`;
              const res = await fetch(url, { method: "HEAD" });
              updates[c.id] = res.ok;
            } catch {
              updates[c.id] = false;
            }
          })
        );
        setModeloOk(updates);
      } catch {
        setAtivas([]);
      } finally {
        setLoadingAtivas(false);
      }
    })();

    (async () => {
      try {
        setLoadingMinhas(true);
        const mine = await apiGet(`/minhas-submissoes`);
        setMinhas(Array.isArray(mine) ? mine : []);
      } catch {
        setMinhas([]);
      } finally {
        setLoadingMinhas(false);
      }
    })();

    return () => abortRef.current?.abort?.();
  }, []);

  const abrirEdital = async (id) => {
    setEditalOpen(true);
    setSubmeterOpen(false);
    setLoadingDetalhe(true);
    setSelecionada(null);
    setEditingId(null);
    try {
      const data = await apiGet(`/chamadas/${id}`);
      setSelecionada(data);
    } catch {
      setSelecionada({ erro: "Não foi possível carregar o edital." });
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const abrirSubmeter = () => {
    if (!selecionada?.chamada) return;
    const inicio = selecionada.chamada.periodo_experiencia_inicio || "2025-01";
    setForm({
      titulo: "",
      inicio_experiencia: inicio,
      linha_tematica_id: "",
      introducao: "",
      objetivos: "",
      metodo: "",
      resultados: "",
      consideracoes: "",
      bibliografia: "",
      coautores: [],
    });
    setPosterFile(null);
    setPosterErr("");
    setErrForm("");
    setEditingId(null);
    setSubmeterOpen(true);
  };

  // Edição de submissão existente (abre o mesmo modal, preenchido)
  const abrirEditar = async (submissaoId) => {
    setErrForm("");
    setPosterFile(null);
    setPosterErr("");
    setEditingId(submissaoId);
    setSubmeterOpen(true);
    try {
      // ajuste de rota se necessário
      const s = await apiGet(`/submissoes/${submissaoId}`);
      // precisamos da chamada/linhas; se ainda não carregada, busca
      if (!selecionada?.chamada || selecionada?.chamada?.id !== s.chamada_id) {
        try {
          const data = await apiGet(`/chamadas/${s.chamada_id}`);
          setSelecionada(data);
        } catch {}
      }
      setForm({
        titulo: s.titulo || "",
        inicio_experiencia: s.inicio_experiencia || "2025-01",
        linha_tematica_id: String(s.linha_tematica_id || ""),
        introducao: s.introducao || "",
        objetivos: s.objetivos || "",
        metodo: s.metodo || "",
        resultados: s.resultados || "",
        consideracoes: s.consideracoes || "",
        bibliografia: s.bibliografia || "",
        coautores: Array.isArray(s.coautores) ? s.coautores.map((c) => ({
          nome: c.nome || c.nome_completo || "",
          cpf: (c.cpf || "").replace(/\D+/g, ""),
          email: c.email || "",
          vinculo: c.vinculo || c.vinculo_empregaticio || "",
        })) : [],
      });
    } catch (e) {
      setErrForm(e?.message || "Não foi possível carregar a submissão para edição.");
    }
  };

  const onExcluir = async (submissaoId) => {
    if (!submissaoId) return;
    if (!confirm("Confirma excluir esta submissão? Esta ação não pode ser desfeita.")) return;
    try {
      await apiDelete(`/submissoes/${submissaoId}`);
      setMinhas((xs) => xs.filter((x) => x.id !== submissaoId));
    } catch (e) {
      alert(e?.message || "Falha ao excluir.");
    }
  };

  const updateForm = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const limites = useMemo(
    () => ({
      ...LIM_DEFAULT,
      ...((selecionada && selecionada.limites) || {}),
    }),
    [selecionada]
  );

  const modeloBannerUrl = useMemo(() => {
    const id = selecionada?.chamada?.id;
    return id ? `/api/chamadas/${id}/modelo-banner` : null;
  }, [selecionada]);

  // até quando pode editar/excluir: usa prazo_final_br da submissão (preferível) ou da chamada
  const canAlterar = (s) => {
    const wall = s?.prazo_final_br || s?.chamada_prazo_final_br;
    if (!wall) return false; // prudente: sem prazo conhecido → bloqueia
    return computeDentroPrazoFromWall(wall);
  };

  const validarCoautores = (arr = []) => {
    for (let i = 0; i < arr.length; i++) {
      const c = arr[i];
      if (!c) continue;
      const nome = (c.nome || c.nome_completo || "").trim();
      const cpf = String(c.cpf || "").replace(/\D+/g, "");
      const email = (c.email || "").trim();
      const vinculo = (c.vinculo || c.vinculo_empregaticio || "").trim();
      if (!nome || !cpf || !email || !vinculo) return `Preencha todos os campos do coautor #${i + 1}.`;
      if (!cpfRx.test(cpf)) return `CPF inválido no coautor #${i + 1} (use só números).`;
      if (!emailRx.test(email)) return `E-mail inválido no coautor #${i + 1}.`;
    }
    return "";
  };

  const validar = (requireAll = true) => {
    if (!form.titulo || form.titulo.length > limites.titulo) return "Título é obrigatório e deve respeitar o limite.";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.inicio_experiencia)) return "Início da experiência deve estar no formato AAAA-MM.";
    if (!form.linha_tematica_id) return "Selecione a linha temática.";
    const checks = [
      ["introducao", limites.introducao],
      ["objetivos", limites.objetivos],
      ["metodo", limites.metodo],
      ["resultados", limites.resultados],
      ["consideracoes", limites.consideracoes],
    ];
    for (const [k, lim] of checks) {
      const val = (form[k] || "").trim();
      if (requireAll && !val) return "Preencha todos os campos obrigatórios.";
      if (val && val.length > lim) return `Campo muito longo: "${k}" excede ${lim} caracteres.`;
    }
    if (form.bibliografia && form.bibliografia.length > limites.bibliografia) return "Bibliografia muito longa.";

    const max = Number(selecionada?.chamada?.max_coautores || 0);
    if (max > 0 && form.coautores.length > max) {
      return `Número de coautores excede o limite (${max}).`;
    }
    const vCo = validarCoautores(form.coautores || []);
    if (vCo) return vCo;

    return "";
  };

  const validatePoster = (file) => {
    if (!file) return "";
    const okExt = /\.(pptx?|PPTX?)$/.test(file.name);
    if (!okExt) return "Envie arquivo .ppt ou .pptx";
    if (file.size > 50 * 1024 * 1024) return "Arquivo muito grande (máx 50MB).";
    return "";
  };

  const apiUpload = (url, fileOrFormData) =>
    apiUploadSvc(url, fileOrFormData, { fieldName: "poster" });

  // criar/atualizar
  const submeter = async (status) => {
    if (!selecionada?.chamada?.id && !editingId) return;
    setErrForm("");

    // se for enviar, valida tudo; se rascunho, valida leve
    const v = validar(status === "enviado");
    if (v && status === "enviado") { setErrForm(v); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        linha_tematica_id: Number(form.linha_tematica_id) || null,
        status, // "rascunho" | "enviado"
        coautores: (form.coautores || []).map((c) => ({
          nome: (c.nome || c.nome_completo || "").trim(),
          cpf: String(c.cpf || "").replace(/\D+/g, ""),
          email: (c.email || "").trim(),
          vinculo: (c.vinculo || c.vinculo_empregaticio || "").trim(),
        })),
      };

      let created = null;
      if (editingId) {
        // UPDATE
        await apiPut(`/submissoes/${editingId}`, payload);
        created = { id: editingId };
      } else {
        // CREATE
        created = await api.request({
          url: `/chamadas/${selecionada.chamada.id}/submissoes`,
          method: "POST",
          data: payload,
        });
      }

      // pôster (se aceito e anexado e temos id)
      if (selecionada?.chamada?.aceita_poster && posterFile && created?.id) {
        try {
          setPosterBusy(true);
          setPosterErr("");
          await apiUpload(`/submissoes/${created.id}/poster`, posterFile);
        } catch (e) {
          setPosterErr("Falha ao enviar pôster: " + (e?.message || "tente novamente."));
        } finally {
          setPosterBusy(false);
        }
      }

      // recarrega lista
      try {
        setLoadingMinhas(true);
        const mine = await apiGet(`/minhas-submissoes`);
        setMinhas(Array.isArray(mine) ? mine : []);
      } finally {
        setLoadingMinhas(false);
      }

      setSubmeterOpen(false);
      if (status === "enviado") setEditalOpen(false);
      setEditingId(null);
    } catch (e) {
      const msg =
        e?.data?.erro ||
        e?.data?.message ||
        e?.message ||
        "Falha ao salvar/enviar a submissão. Tente novamente.";
      setErrForm(String(msg));
    } finally {
      setSaving(false);
    }
  };

  /* ───────── render ───────── */
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <HeaderHero title="Submissão de Trabalhos" subtitle="Consulte o edital, inscreva seu trabalho e acompanhe o status." accent="emerald" />

      <main className="mx-auto grid w-full max-w-screen-xl gap-6 p-4 sm:px-6 lg:px-8">
        {/* Chamadas ativas */}
        <section>
          <h2 className="mb-2 text-base font-semibold sm:text-lg">Chamadas ativas</h2>
          <Card>
            {loadingAtivas ? (
              <div className="py-6 text-zinc-500" role="status" aria-live="polite">Carregando…</div>
            ) : ativas.length === 0 ? (
              <div className="py-6 text-zinc-500">Nenhuma chamada ativa no momento.</div>
            ) : (
              <div className="grid gap-3">
                {ativas.map((c) => {
                  const urlModelo = `/api/chamadas/${c.id}/modelo-banner`;
                  const hasModelo = !!modeloOk[c.id];
                  return (
                    <div key={c.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.titulo}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                          {c.dentro_prazo ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Aberta
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                              <XCircle className="h-3 w-3" /> Encerrada
                            </span>
                          )}
                          <span>Prazo: {fmtDataHora(c.prazo_final_br)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={hasModelo ? urlModelo : undefined}
                          onClick={(e) => { if (!hasModelo) e.preventDefault(); }}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                            hasModelo ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700" : "bg-zinc-200 text-zinc-500 cursor-not-allowed dark:bg-zinc-800/60"
                          }`}
                          title={hasModelo ? "Baixar modelo" : "Modelo não disponível"}
                        >
                          <Download className="h-4 w-4" /> Baixar modelo
                        </a>

                        <button
                          onClick={() => abrirEdital(c.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#005f73] px-3 py-2 text-sm font-medium text-white hover:bg-[#0a9396]"
                        >
                          <BookOpen className="h-4 w-4" /> Ver edital
                        </button>

                        <button
                          disabled={!c.dentro_prazo}
                          onClick={async () => { await abrirEdital(c.id); abrirSubmeter(); }}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white ${
                            c.dentro_prazo ? "bg-[#f77f00] hover:bg-[#e36414]" : "cursor-not-allowed bg-zinc-400 dark:bg-zinc-700"
                          }`}
                        >
                          <ClipboardList className="h-4 w-4" /> Inscrever
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {/* Minhas submissões */}
        <section id="lista-minhas">
          <h2 className="mb-2 text-base font-semibold sm:text-lg">Minhas submissões</h2>
          <Card>
            {loadingMinhas ? (
              <div className="py-6 text-zinc-500" role="status" aria-live="polite">Carregando…</div>
            ) : minhas.length === 0 ? (
              <div className="py-6 text-zinc-500">Você ainda não possui submissões.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      <th className="py-2 pr-4">Título</th>
                      <th className="py-2 pr-4">Chamada</th>
                      <th className="py-2 pr-4">Linha</th>
                      <th className="py-2 pr-4">Início</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Pôster</th>
                      <th className="py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minhas.map((s) => {
                      const podeAlterar = canAlterar(s);
                      return (
                        <tr key={s.id} className="border-t dark:border-zinc-800">
                          <td className="py-2 pr-4">{s.titulo}</td>
                          <td className="py-2 pr-4">{s.chamada_titulo}</td>
                          <td className="py-2 pr-4">{s.linha_tematica_codigo}</td>
                          <td className="py-2 pr-4">{s.inicio_experiencia}</td>
                          <td className="py-2 pr-4">
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2 pr-4">{s.poster_nome ? s.poster_nome : <span className="text-zinc-400">—</span>}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                disabled={!podeAlterar}
                                onClick={() => abrirEditar(s.id)}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${
                                  podeAlterar ? "bg-sky-600 text-white hover:bg-sky-700" : "cursor-not-allowed bg-zinc-300 text-white dark:bg-zinc-700"
                                }`}
                                title={podeAlterar ? "Editar submissão" : "Prazo encerrado"}
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </button>
                              <button
                                disabled={!podeAlterar}
                                onClick={() => onExcluir(s.id)}
                                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 ${
                                  podeAlterar ? "bg-rose-600 text-white hover:bg-rose-700" : "cursor-not-allowed bg-zinc-300 text-white dark:bg-zinc-700"
                                }`}
                                title={podeAlterar ? "Excluir submissão" : "Prazo encerrado"}
                              >
                                <Trash2 className="h-4 w-4" /> Excluir
                              </button>
                              <UploadPosterButton
                                submissaoId={s.id}
                                aceita={true}
                                onDone={async () => {
                                  setLoadingMinhas(true);
                                  try {
                                    const mine = await apiGet(`/minhas-submissoes`);
                                    setMinhas(Array.isArray(mine) ? mine : []);
                                  } catch {}
                                  finally { setLoadingMinhas(false); }
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      </main>

      <Footer />

      {/* Modal: Edital */}
      <Modal
        open={editalOpen}
        onClose={() => setEditalOpen(false)}
        title={selecionada?.chamada?.titulo ? `Edital — ${selecionada.chamada.titulo}` : "Edital"}
        icon={BookOpen}
        footer={
          selecionada?.chamada ? (
            <div className="flex items-center gap-2">
              {modeloBannerUrl ? (
                <a
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                  href={modeloBannerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" /> Baixar modelo
                </a>
              ) : null}
              <button
                onClick={abrirSubmeter}
                className="inline-flex items-center gap-2 rounded-xl bg-[#005f73] px-4 py-2 text-white hover:bg-[#0a9396]"
              >
                <ClipboardList className="h-4 w-4" /> Inscrever trabalho
              </button>
            </div>
          ) : null
        }
      >
        {loadingDetalhe ? (
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !selecionada?.chamada ? (
          <div className="text-sm text-zinc-500">{selecionada?.erro || "Não foi possível exibir o edital."}</div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* 1) Informações gerais */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">1) Informações gerais</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {selecionada.chamada.descricao_markdown || "—"}
              </div>
            </section>

            {/* 2) Período & Prazo */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">2) Período & prazo</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Período aceito: <strong>
                  {(selecionada.chamada.periodo_experiencia_inicio || "—")} a {(selecionada.chamada.periodo_experiencia_fim || "—")}
                </strong>
                {" · "}Prazo: <strong>{fmtDataHora(selecionada.chamada.prazo_final_br)}</strong>
              </div>
            </section>

            {/* 3) Linhas temáticas */}
            <section className="grid gap-2">
              <h4 className="text-sm font-semibold">3) Linhas temáticas</h4>
              <ul className="grid gap-2">
                {(selecionada.linhas || []).map((l) => (
                  <li key={l.id} className="rounded-xl border p-3 text-sm dark:border-zinc-800">
                    <div className="font-medium">{l.codigo} — {l.nome}</div>
                    {l.descricao ? <div className="mt-1 text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{l.descricao}</div> : null}
                  </li>
                ))}
              </ul>
            </section>

            {/* 4) Limites */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">4) Limites de caracteres</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Título {limites.titulo}, Introdução {limites.introducao}, Objetivos {limites.objetivos},
                Método {limites.metodo}, Resultados {limites.resultados}, Considerações {limites.consideracoes}.
              </div>
            </section>

            {/* 5) Critérios (escrita) */}
            <section className="grid gap-2">
              <h4 className="text-sm font-semibold">5) Critérios — escrita</h4>
              {(selecionada.criterios || []).length === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <ul className="grid gap-2">
                  {selecionada.criterios.map((c, i) => (
                    <li key={i} className="rounded-xl border p-3 text-sm dark:border-zinc-800">
                      <div className="font-medium">{c.titulo}</div>
                      <div className="text-xs text-zinc-500">Escala {c.escala_min}–{c.escala_max} · Peso {c.peso}</div>
                    </li>
                  ))}
                </ul>
              )}
              {selecionada.criterios_outros ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{selecionada.criterios_outros}</div>
              ) : null}
            </section>

            {/* 6) Critérios (oral) */}
            <section className="grid gap-2">
              <h4 className="text-sm font-semibold">6) Critérios — apresentação oral</h4>
              {(selecionada.criterios_orais || []).length === 0 ? (
                <div className="text-sm text-zinc-500">—</div>
              ) : (
                <ul className="grid gap-2">
                  {selecionada.criterios_orais.map((c, i) => (
                    <li key={i} className="rounded-xl border p-3 text-sm dark:border-zinc-800">
                      <div className="font-medium">{c.titulo}</div>
                      <div className="text-xs text-zinc-500">Escala {c.escala_min}–{c.escala_max} · Peso {c.peso}</div>
                    </li>
                  ))}
                </ul>
              )}
              {selecionada.oral_outros ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{selecionada.oral_outros}</div>
              ) : null}
            </section>

            {/* 7) Premiação */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">7) Premiação</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {selecionada.premiacao_texto || "—"}
              </div>
            </section>

            {/* 8) Formulário */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">8) Formulário eletrônico</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {selecionada.chamada.aceita_poster ? (
                  <>Aceita pôster (.ppt/.pptx).</>
                ) : (
                  <>Esta chamada não exige pôster.</>
                )}
              </div>
            </section>

            {/* 9) Disposições finais */}
            <section className="grid gap-1">
              <h4 className="text-sm font-semibold">9) Disposições finais</h4>
              <div className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                {selecionada.disposicoes_finais_texto || "—"}
              </div>
            </section>
          </div>
        )}
      </Modal>

      {/* Modal: Submeter / Editar */}
      <Modal
        open={submeterOpen}
        onClose={() => { setSubmeterOpen(false); setEditingId(null); }}
        title={editingId ? "Editar submissão" : "Inscrever trabalho"}
        icon={ClipboardList}
        maxWidth="max-w-5xl"
        footer={
          <>
            {errForm && <span className="mr-auto text-sm text-red-600">{String(errForm)}</span>}
            <button
              disabled={saving}
              onClick={() => submeter("rascunho")}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              disabled={saving}
              onClick={() => submeter("enviado")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#f77f00] px-4 py-2 text-sm text-white hover:bg-[#e36414] disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {saving ? "Enviando…" : "Enviar"}
            </button>
          </>
        }
      >
        {!selecionada?.chamada ? (
          <div className="text-sm text-zinc-500">Carregue o edital para inscrever.</div>
        ) : (
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 text-sm text-zinc-600 dark:text-zinc-300">
              Chamada: <strong>{selecionada.chamada.titulo}</strong> · Prazo: <strong>{fmtDataHora(selecionada.chamada.prazo_final_br)}</strong>
            </div>

            <Field label={<span>Título <Counter value={form.titulo} max={limites.titulo} /></span>}>
              <input className={inputBase} value={form.titulo} onChange={(e) => updateForm("titulo", e.target.value)} maxLength={limites.titulo} required aria-required="true" />
            </Field>

            <Field label="Início da experiência (AAAA-MM)">
              <input type="month" className={inputBase} value={form.inicio_experiencia} onChange={(e) => updateForm("inicio_experiencia", e.target.value)} required aria-required="true" />
            </Field>

            <Field className="sm:col-span-2" label="Linha temática" hint={selecionada?.linhas?.length ? `Total de opções: ${selecionada.linhas.length}` : ""}>
              <select
                className={`${inputBase} py-3`}
                value={form.linha_tematica_id}
                onChange={(e) => updateForm("linha_tematica_id", e.target.value)}
                required
                aria-required="true"
              >
                <option value="">Selecione…</option>
                {(selecionada.linhas || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.codigo} — {l.nome}</option>
                ))}
              </select>
            </Field>

            <div className="grid gap-4 sm:col-span-2">
              <Field label={<span>Introdução com justificativa <Counter value={form.introducao} max={limites.introducao} /></span>}>
                <textarea className={`${inputBase} min-h-[120px] rounded-2xl`} value={form.introducao} onChange={(e) => updateForm("introducao", e.target.value)} maxLength={limites.introducao} required aria-required="true" />
              </Field>

              <Field label={<span>Objetivos <Counter value={form.objetivos} max={limites.objetivos} /></span>}>
                <textarea className={`${inputBase} min-h-[100px] rounded-2xl`} value={form.objetivos} onChange={(e) => updateForm("objetivos", e.target.value)} maxLength={limites.objetivos} required aria-required="true" />
              </Field>

              <Field label={<span>Método/Descrição da prática <Counter value={form.metodo} max={limites.metodo} /></span>}>
                <textarea className={`${inputBase} min-h-[120px] rounded-2xl`} value={form.metodo} onChange={(e) => updateForm("metodo", e.target.value)} maxLength={limites.metodo} required aria-required="true" />
              </Field>

              <Field label={<span>Resultados/Impactos <Counter value={form.resultados} max={limites.resultados} /></span>}>
                <textarea className={`${inputBase} min-h-[120px] rounded-2xl`} value={form.resultados} onChange={(e) => updateForm("resultados", e.target.value)} maxLength={limites.resultados} required aria-required="true" />
              </Field>

              <Field label={<span>Considerações finais <Counter value={form.consideracoes} max={limites.consideracoes} /></span>}>
                <textarea className={`${inputBase} min-h-[100px] rounded-2xl`} value={form.consideracoes} onChange={(e) => updateForm("consideracoes", e.target.value)} maxLength={limites.consideracoes} required aria-required="true" />
              </Field>

              <Field label={<span>Bibliografia (opcional) <Counter value={form.bibliografia} max={limites.bibliografia} /></span>}>
                <textarea className={`${inputBase} min-h-[80px] rounded-2xl`} value={form.bibliografia} onChange={(e) => updateForm("bibliografia", e.target.value)} maxLength={limites.bibliografia} placeholder="Autores, títulos, links…" />
              </Field>
            </div>

            {/* Coautores */}
            <section className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Coautores {selecionada?.chamada?.max_coautores > 0 ? `(máx. ${selecionada.chamada.max_coautores})` : ""}
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const max = Number(selecionada?.chamada?.max_coautores || 0);
                    setForm((f) => {
                      const next = [...(f.coautores || [])];
                      if (max === 0 || next.length < max) next.push({ nome: "", cpf: "", email: "", vinculo: "" });
                      return { ...f, coautores: next };
                    });
                  }}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                >
                  Adicionar coautor
                </button>
              </div>
              <div className="grid gap-3">
                {(form.coautores || []).map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-12">
                    <input
                      className={`${inputBase} sm:col-span-3`}
                      placeholder="Nome completo"
                      value={c.nome || ""}
                      onChange={(e) => {
                        const arr = [...form.coautores]; arr[i] = { ...arr[i], nome: e.target.value }; updateForm("coautores", arr);
                      }}
                    />
                    <input
                      className={`${inputBase} sm:col-span-2`}
                      placeholder="CPF (apenas números)"
                      value={c.cpf || ""}
                      onChange={(e) => {
                        const arr = [...form.coautores]; arr[i] = { ...arr[i], cpf: e.target.value.replace(/\D+/g, "") }; updateForm("coautores", arr);
                      }}
                      maxLength={11}
                    />
                    <input
                      className={`${inputBase} sm:col-span-3`}
                      placeholder="E-mail"
                      value={c.email || ""}
                      onChange={(e) => {
                        const arr = [...form.coautores]; arr[i] = { ...arr[i], email: e.target.value }; updateForm("coautores", arr);
                      }}
                    />
                    <input
                      className={`${inputBase} sm:col-span-3`}
                      placeholder="Vínculo empregatício"
                      value={c.vinculo || ""}
                      onChange={(e) => {
                        const arr = [...form.coautores]; arr[i] = { ...arr[i], vinculo: e.target.value }; updateForm("coautores", arr);
                      }}
                    />
                    <div className="sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => updateForm("coautores", form.coautores.filter((_, j) => j !== i))}
                        className="h-full w-full rounded-xl bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                        aria-label={`Remover coautor ${i + 1}`}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Upload do pôster (sem “(opcional)”) */}
            {selecionada?.chamada?.aceita_poster && (
              <Field className="sm:col-span-2" label="Pôster">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ${posterBusy ? "bg-zinc-300 text-white dark:bg-zinc-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                    <UploadIcon className="h-4 w-4" />
                    <input
                      type="file"
                      accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      className="hidden"
                      disabled={posterBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        const err = validatePoster(f);
                        setPosterErr(err);
                        setPosterFile(err ? null : f);
                      }}
                      aria-disabled={posterBusy}
                    />
                    {posterBusy ? "Processando…" : (posterFile ? "Trocar arquivo" : "Anexar pôster")}
                  </label>

                  <div className="text-sm text-zinc-600 dark:text-zinc-300">
                    {posterFile ? <span className="font-medium">{posterFile.name}</span> : "Formatos: .ppt / .pptx (até 50MB)."}
                    {modeloBannerUrl && (
                      <>
                        {" "}|{" "}
                        <a className="inline-flex items-center gap-1 underline decoration-dotted" href={modeloBannerUrl} target="_blank" rel="noreferrer">
                          Baixar modelo <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    )}
                  </div>
                </div>
                {posterErr && <div className="mt-1 text-xs text-red-600">{posterErr}</div>}
              </Field>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ───────── Upload na lista ───────── */
function UploadPosterButton({ submissaoId, aceita = true, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const okExt = /\.(pptx?|PPTX?)$/.test(file.name);
      if (!okExt) throw new Error("Envie arquivo .ppt ou .pptx");
      if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo muito grande (máx 50MB).");
      await apiUploadSvc(`/submissoes/${submissaoId}/poster`, file, { fieldName: "poster" });
      onDone?.();
    } catch (e) {
      setErr("Falha no upload: " + (e?.message?.replace(/["{}]/g, "") || "verifique o arquivo."));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  if (!aceita) return <span className="text-xs text-zinc-400">pôster não aceito</span>;

  return (
    <div className="flex flex-col">
      <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm ${busy ? "bg-zinc-300 text-white dark:bg-zinc-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
        <UploadIcon className="h-4 w-4" />
        <input
          type="file"
          accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          disabled={busy}
          onChange={onChange}
          aria-disabled={busy}
        />
        {busy ? "Enviando…" : "Anexar pôster"}
      </label>
      {err && <span className="mt-1 text-xs text-red-600">{err}</span>}
    </div>
  );
}
