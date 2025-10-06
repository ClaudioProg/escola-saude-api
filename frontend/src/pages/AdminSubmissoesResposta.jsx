// frontend/src/pages/AdminSubmissoesResposta.jsx
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Filter, SortAsc, SortDesc, RefreshCw, Settings } from "lucide-react";
import Footer from "../components/Footer";
import { fmtDataHora } from "../utils/data";

const API_BASE = "/api";

/* ───────────────── HTTP helpers ───────────────── */
const apiGet = async (url, opts = {}) => {
  const r = await fetch(`${API_BASE}${url}`, { credentials: "include", ...opts });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};
const apiJson = async (url, method, body) => {
  const r = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

/* ───────────────── UI helpers ──────────────── */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 ${className}`}>{children}</div>
);

const Field = ({ label, hint, error, children }) => (
  <div className="mb-3">
    {label && <label className="mb-1 block text-sm font-medium text-zinc-800 dark:text-zinc-100">{label}</label>}
    {children}
    {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
  </div>
);

const Pill = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    blue: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    orange: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${tones[tone] || tones.gray}`}>{children}</span>
  );
};

/* ─────────────── HeaderHero local ─────────────── */
function HeaderHero({ title, subtitle, accent = "amber" }) {
  const accents = {
    amber: "bg-amber-600 dark:bg-amber-700",
    indigo: "bg-indigo-600 dark:bg-indigo-700",
    violet: "bg-violet-600 dark:bg-violet-700",
    emerald: "bg-emerald-600 dark:bg-emerald-700",
    sky: "bg-sky-600 dark:bg-sky-700",
    rose: "bg-rose-600 dark:bg-rose-700",
  };
  const bar = accents[accent] || accents.amber;
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`w-full ${bar} text-white`}
    >
      <div className="mx-auto max-w-screen-xl px-4 py-6 text-center sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          <Settings className="h-10 w-10" aria-hidden="true" />
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm leading-5 opacity-90 sm:text-base">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}

/* ───────────────── Página ───────────────── */
import { useParams } from "react-router-dom";
export default function AdminSubmissoesResposta() {
const params = useParams();            // <- pegue o id se estiver na URL
const chamadaIdURL = params?.id || params?.chamadaId || null;
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  // chamadas (lista) + seleção
  const [chamadas, setChamadas] = useState([]);
  const [selChamadaId, setSelChamadaId] = useState("ALL"); // "ALL" | id

  // detalhes da chamada selecionada (para header)
  const chamadaSelecionada = useMemo(
    () => (selChamadaId === "ALL" ? null : chamadas.find((c) => String(c.id) === String(selChamadaId)) || null),
    [selChamadaId, chamadas]
  );

  // metadados da chamada (linhas/criterios) quando uma específica estiver selecionada
  const [linhas, setLinhas] = useState([]);
  const [criterios, setCriterios] = useState([]);
  const [criteriosOral, setCriteriosOral] = useState([]);

  const [rows, setRows] = useState([]);
  const [filtro, setFiltro] = useState({ busca: "", linha: "ALL", status: "ALL", chamada: "ALL" });
  const [ordenarPor, setOrdenarPor] = useState("total_geral");
  const [ordAsc, setOrdAsc] = useState(false);

  // modal de avaliação
  const [avaliando, setAvaliando] = useState(null);
  const [itensEsc, setItensEsc] = useState([]);
  const [itensOral, setItensOral] = useState([]);
  const [salvandoAv, setSalvandoAv] = useState(false);
  const [errAv, setErrAv] = useState("");

  // popover de status final
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [novoStatus, setNovoStatus] = useState("aprovado_exposicao");
  const statusOpts = [
    { v: "reprovado", rot: "Reprovado" },
    { v: "aprovado_exposicao", rot: "Aprovado (Exposição)" },
    { v: "aprovado_oral", rot: "Aprovado (Apresentação Oral)" },
  ];

  /* 1) Carregar lista de chamadas (admin) */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErro("");

        const list = await apiGet(`/admin/chamadas`);
        setChamadas(Array.isArray(list) ? list : []);

        // default: ALL
        setSelChamadaId(chamadaIdURL ? String(chamadaIdURL) : "ALL");
      } catch {
        setErro("Falha ao carregar chamadas.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* 2) Carregar submissões conforme seleção (ALL ou 1 chamada) */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErro("");
        setOk("");

        if (selChamadaId === "ALL") {
             const lst = await apiGet(`/admin/submissoes`);
             setRows(Array.isArray(lst) ? lst : []);
             setLinhas([]); setCriterios([]); setCriteriosOral([]);
             setFiltro((f) => ({ ...f, linha: "ALL", chamada: "ALL" }));
           } else {
          // uma chamada específica
          const id = selChamadaId;
          const det = await apiGet(`/chamadas/${id}`);
          setLinhas(det.linhas || []);
          setCriterios(det.criterios || []);
          setCriteriosOral(det.criterios_orais || []);

          const lst = await apiGet(`/admin/chamadas/${id}/submissoes`);
          const ch = chamadas.find((c) => String(c.id) === String(id));
          setRows((Array.isArray(lst) ? lst : []).map((s) => ({ ...s, chamada_id: Number(id), chamada_titulo: ch?.titulo || "" })));
          setFiltro((f) => ({ ...f, chamada: String(id) }));
        }
      } catch {
        setErro("Falha ao carregar submissões.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selChamadaId, JSON.stringify(chamadas)]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtradas = useMemo(() => {
    let out = [...rows];

    if (filtro.busca.trim().length) {
      const q = filtro.busca.toLowerCase();
      out = out.filter(
        (r) =>
          r.titulo?.toLowerCase().includes(q) ||
          r.autor_nome?.toLowerCase().includes(q) ||
          r.autor_email?.toLowerCase().includes(q) ||
          r.chamada_titulo?.toLowerCase().includes(q)
      );
    }
    if (filtro.chamada !== "ALL") {
      out = out.filter((r) => String(r.chamada_id) === String(filtro.chamada));
    }
    if (filtro.linha !== "ALL") {
      out = out.filter((r) => r.linha_tematica_codigo === filtro.linha);
    }
    if (filtro.status !== "ALL") {
      out = out.filter((r) => r.status === filtro.status);
    }

    out.sort((a, b) => {
      const dir = ordAsc ? 1 : -1;
      if (ordenarPor === "inicio_experiencia") {
        return (a.inicio_experiencia || "").localeCompare(b.inicio_experiencia || "") * (ordAsc ? 1 : -1);
      }
      const va = Number(a[ordenarPor] || 0);
      const vb = Number(b[ordenarPor] || 0);
      if (va === vb) return a.id - b.id;
      return va > vb ? dir : -dir;
    });
    return out;
  }, [rows, filtro, ordenarPor, ordAsc]);

  // avaliação
  const abrirAvaliacao = (sub) => {
    setAvaliando(sub);
    setItensEsc((criterios || []).map((c) => ({ criterio_id: c.id, nota: c.escala_min, comentarios: "" })));
    setItensOral((criteriosOral || []).map((c) => ({ criterio_oral_id: c.id, nota: c.escala_min, comentarios: "" })));
    setErrAv("");
  };

  const validarItens = () => {
    for (const it of itensEsc) {
      const ref = (criterios || []).find((c) => c.id === it.criterio_id);
      if (!ref) return "Critério inválido.";
      const n = parseInt(it.nota, 10);
      if (!Number.isInteger(n) || n < ref.escala_min || n > ref.escala_max) {
        return `Nota inválida para "${ref.titulo}" (permitido ${ref.escala_min}-${ref.escala_max}).`;
      }
    }
    for (const it of itensOral) {
      const ref = (criteriosOral || []).find((c) => c.id === it.criterio_oral_id);
      if (!ref) return "Critério oral inválido.";
      const n = parseInt(it.nota, 10);
      if (!Number.isInteger(n) || n < ref.escala_min || n > ref.escala_max) {
        return `Nota inválida para "${ref.titulo}" (permitido ${ref.escala_min}-${ref.escala_max}).`;
      }
    }
    return "";
  };

  const recarregarSubmissoesSelecionadas = async () => {
    if (selChamadaId === "ALL") {
      setSelChamadaId(chamadaIdURL ? String(chamadaIdURL) : "ALL");
    } else {
      const lst = await apiGet(`/admin/chamadas/${selChamadaId}/submissoes`);
      const ch = chamadas.find((c) => String(c.id) === String(selChamadaId));
      setRows((Array.isArray(lst) ? lst : []).map((s) => ({ ...s, chamada_id: Number(selChamadaId), chamada_titulo: ch?.titulo || "" })));
    }
  };

  const salvarAvaliacao = async () => {
    setErrAv("");
    setOk("");
    const er = validarItens();
    if (er) {
      setErrAv(er);
      return;
    }
    setSalvandoAv(true);
    try {
      if (itensEsc.length) {
        await apiJson(`/admin/submissoes/${avaliando.id}/avaliar`, "POST", { itens: itensEsc });
      }
      if (itensOral.length) {
        await apiJson(`/admin/submissoes/${avaliando.id}/avaliar-oral`, "POST", { itens: itensOral });
      }
      setOk("Avaliação registrada com sucesso.");
      setAvaliando(null);
      await recarregarSubmissoesSelecionadas();
    } catch (e) {
      setErrAv("Falha ao salvar avaliação.");
    } finally {
      setSalvandoAv(false);
    }
  };

  const consolidar = async () => {
    if (selChamadaId === "ALL") return; // proteção
    setErro("");
    setOk("");
    try {
      await apiJson(`/admin/chamadas/${selChamadaId}/classificar`, "POST", {});
      setOk("Classificação consolidada (Top 40 + Top 6 por linha).");
      await recarregarSubmissoesSelecionadas();
    } catch {
      setErro("Falha ao consolidar classificação.");
    }
  };

  const abrirStatus = (sub) => {
    setEditingStatusId(sub.id);
    setNovoStatus(sub.status || "aprovado_exposicao");
  };
  const salvarStatus = async () => {
    const id = editingStatusId;
    if (!id) return;
    setErro("");
    setOk("");
    try {
      await apiJson(`/admin/submissoes/${id}/status`, "POST", { status: novoStatus });
      setEditingStatusId(null);
      setOk("Status atualizado.");
      await recarregarSubmissoesSelecionadas();
    } catch {
      setErro("Falha ao atualizar status.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
        Carregando…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <HeaderHero
        title="Admin · Submissões"
        subtitle={
          selChamadaId === "ALL"
            ? "Todas as chamadas"
            : chamadaSelecionada
              ? `${chamadaSelecionada.titulo} · Prazo: ${fmtDataHora(chamadaSelecionada.prazo_final_br)}`
              : "Selecione uma chamada"
        }
        accent="amber"
      />

      <main className="mx-auto grid w-full max-w-screen-xl gap-6 p-4 sm:px-6 lg:px-8">
        {/* Filtros e ações */}
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px]">
              <Field label="Chamada">
                <select
                  className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                  value={selChamadaId}
                  onChange={(e) => setSelChamadaId(e.target.value)}
                >
                  <option value="ALL">Todas</option>
                  {chamadas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="min-w-[220px] flex-1">
              <Field label="Busca (título/autor/email/chamada)">
                <input
                  className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Digite para filtrar…"
                  value={filtro.busca}
                  onChange={(e) => setFiltro((f) => ({ ...f, busca: e.target.value }))}
                />
              </Field>
            </div>

            <div>
              <Field label="Linha temática">
                <select
                  className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                  value={filtro.linha}
                  onChange={(e) => setFiltro((f) => ({ ...f, linha: e.target.value }))}
                  disabled={selChamadaId === "ALL"}
                  title={selChamadaId === "ALL" ? "Selecione uma chamada para filtrar por linha" : undefined}
                >
                  <option value="ALL">Todas</option>
                  {(linhas || []).map((l) => (
                    <option key={l.id} value={l.codigo}>
                      {l.codigo}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div>
              <Field label="Status">
                <select
                  className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                  value={filtro.status}
                  onChange={(e) => setFiltro((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="ALL">Todos</option>
                  <option value="submetido">Submetido</option>
                  <option value="em_avaliacao">Em avaliação</option>
                  <option value="aprovado_exposicao">Aprovado (Exposição)</option>
                  <option value="aprovado_oral">Aprovado (Oral)</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </Field>
            </div>

            <div className="flex-1" />
            <div className="flex items-end gap-2">
              <Field label="Ordenar por">
                <select
                  className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                  value={ordenarPor}
                  onChange={(e) => setOrdenarPor(e.target.value)}
                >
                  <option value="total_geral">Total geral</option>
                  <option value="total_escrita">Total escrita</option>
                  <option value="total_oral">Total oral</option>
                  <option value="inicio_experiencia">Início da experiência</option>
                </select>
              </Field>
              <button
                onClick={() => setOrdAsc((v) => !v)}
                className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                title="Alternar ordem"
                aria-label="Alternar ordem"
                type="button"
              >
                {ordAsc ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />} {ordAsc ? "Asc" : "Desc"}
              </button>
              <button
                onClick={consolidar}
                disabled={selChamadaId === "ALL"}
                className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                title={selChamadaId === "ALL" ? "Selecione uma chamada" : "Top 40 + Top 6 por linha"}
                type="button"
              >
                <RefreshCw className="h-4 w-4" /> Consolidar Classificação
              </button>
            </div>
          </div>

          {(ok || erro) && (
            <div className="mt-2">
              {ok && <div className="text-sm text-emerald-700 dark:text-emerald-300">{ok}</div>}
              {erro && <div className="text-sm text-rose-600">{erro}</div>}
            </div>
          )}
        </Card>

        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-600 dark:text-zinc-300">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Título</th>
                <th className="py-2 pr-4">Autor</th>
                <th className="py-2 pr-4">Chamada</th>
                <th className="py-2 pr-4">Linha</th>
                <th className="py-2 pr-4">Início</th>
                <th className="py-2 pr-4">Escrita</th>
                <th className="py-2 pr-4">Oral</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={`${s.chamada_id}-${s.id}`} className="border-t align-top dark:border-zinc-800">
                  <td className="py-2 pr-4">{s.id}</td>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{s.titulo}</div>
                    <div className="text-xs text-zinc-500">{s.autor_email}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <div>{s.autor_nome}</div>
                    <div className="text-xs text-zinc-500">UID: {s.usuario_id}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <div className="max-w-[280px] truncate" title={s.chamada_titulo}>{s.chamada_titulo || `Chamada ${s.chamada_id}`}</div>
                  </td>
                  <td className="py-2 pr-4">{s.linha_tematica_codigo}</td>
                  <td className="py-2 pr-4">{s.inicio_experiencia}</td>
                  <td className="py-2 pr-4">{Number(s.total_escrita || 0).toFixed(2)}</td>
                  <td className="py-2 pr-4">{Number(s.total_oral || 0).toFixed(2)}</td>
                  <td className="py-2 pr-4 font-semibold">{Number(s.total_geral || 0).toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    <Pill tone={s.status === "reprovado" ? "red" : s.status?.includes("oral") ? "green" : s.status?.includes("exposicao") ? "blue" : "gray"}>
                      {s.status || "—"}
                    </Pill>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => abrirAvaliacao(s)}
                        disabled={selChamadaId === "ALL"}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        title={selChamadaId === "ALL" ? "Escolha uma chamada para avaliar" : undefined}
                      >
                        Avaliar
                      </button>
                      <button
                        onClick={() => abrirStatus(s)}
                        className="rounded-xl border bg-white px-3 py-1.5 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        type="button"
                      >
                        Status final
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-zinc-500">
                    Nenhuma submissão encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>

      {/* MODAL: Avaliação */}
      {avaliando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-avaliacao">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-900 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div id="titulo-modal-avaliacao" className="text-lg font-semibold">Avaliar submissão #{avaliando.id}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">{avaliando.titulo}</div>
              </div>
              <button onClick={() => setAvaliando(null)} className="rounded-xl border bg-white px-3 py-1.5 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                Fechar
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Escrita */}
              <Card>
                <div className="mb-2 font-semibold">Avaliação escrita</div>
                <div className="grid gap-3">
                  {criterios.map((c, i) => (
                    <div key={c.id} className="rounded-xl border p-2 dark:border-zinc-800">
                      <div className="mb-1 text-sm font-medium">{c.titulo}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-24 rounded-xl border px-2 py-1 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                          min={c.escala_min}
                          max={c.escala_max}
                          value={itensEsc[i]?.nota ?? c.escala_min}
                          onChange={(e) => {
                            const arr = [...itensEsc];
                            arr[i] = { ...(arr[i] || { criterio_id: c.id }), criterio_id: c.id, nota: e.target.value };
                            setItensEsc(arr);
                          }}
                          aria-label={`Nota para ${c.titulo}`}
                        />
                        <span className="text-xs text-zinc-500">({c.escala_min} a {c.escala_max}) · peso {c.peso}</span>
                      </div>
                      <textarea
                        className="mt-2 w-full rounded-xl border px-2 py-1 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                        placeholder="Comentários (opcional)"
                        value={itensEsc[i]?.comentarios || ""}
                        onChange={(e) => {
                          const arr = [...itensEsc];
                          arr[i] = { ...(arr[i] || { criterio_id: c.id }), criterio_id: c.id, comentarios: e.target.value, nota: arr[i]?.nota ?? c.escala_min };
                          setItensEsc(arr);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Oral */}
              <Card>
                <div className="mb-2 font-semibold">Avaliação oral</div>
                <div className="grid gap-3">
                  {criteriosOral.map((c, i) => (
                    <div key={c.id} className="rounded-xl border p-2 dark:border-zinc-800">
                      <div className="mb-1 text-sm font-medium">{c.titulo}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-24 rounded-xl border px-2 py-1 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                          min={c.escala_min}
                          max={c.escala_max}
                          value={itensOral[i]?.nota ?? c.escala_min}
                          onChange={(e) => {
                            const arr = [...itensOral];
                            arr[i] = { ...(arr[i] || { criterio_oral_id: c.id }), criterio_oral_id: c.id, nota: e.target.value };
                            setItensOral(arr);
                          }}
                          aria-label={`Nota oral para ${c.titulo}`}
                        />
                        <span className="text-xs text-zinc-500">({c.escala_min} a {c.escala_max}) · peso {c.peso}</span>
                      </div>
                      <textarea
                        className="mt-2 w-full rounded-xl border px-2 py-1 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                        placeholder="Comentários (opcional)"
                        value={itensOral[i]?.comentarios || ""}
                        onChange={(e) => {
                          const arr = [...itensOral];
                          arr[i] = { ...(arr[i] || { criterio_oral_id: c.id }), criterio_oral_id: c.id, comentarios: e.target.value, nota: arr[i]?.nota ?? c.escala_min };
                          setItensOral(arr);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {errAv && <div className="mt-3 text-sm text-rose-600">{errAv}</div>}

            <div className="mt-4 flex items-center gap-2">
              <button onClick={salvarAvaliacao} disabled={salvandoAv || selChamadaId === "ALL"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:disabled:bg-zinc-700" type="button">
                {salvandoAv ? "Salvando…" : "Salvar avaliação"}
              </button>
              <button onClick={() => setAvaliando(null)} className="rounded-xl border bg-white px-4 py-2 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPOVER: Status final */}
      {editingStatusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-popover-status">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-900 sm:p-6">
            <div id="titulo-popover-status" className="mb-3 text-lg font-semibold">Definir status final</div>
            <Field label="Status">
              <select
                className="w-full rounded-xl border px-3 py-2 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-amber-500 dark:border-zinc-700 dark:bg-zinc-800"
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
              >
                {statusOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.rot}
                  </option>
                ))}
              </select>
            </Field>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={salvarStatus} className="rounded-xl bg-amber-600 px-4 py-2 text-white transition hover:bg-amber-700" type="button">
                Salvar
              </button>
              <button onClick={() => setEditingStatusId(null)} className="rounded-xl border bg-white px-4 py-2 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800" type="button">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
