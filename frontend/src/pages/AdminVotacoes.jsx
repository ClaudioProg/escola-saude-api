// src/pages/AdminVotacoes.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  adminListar, adminCriar, adminAtualizar, adminObter,
  adminCriarOpcao, adminAtualizarOpcao, adminStatus, adminRanking
} from "../services/votacoes";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Plus, Save, BarChart3, Play, Pause, StopCircle, Copy, Download, QrCode,
  Search, RotateCcw, MapPin, Shield, Link2, Sparkles, ChevronLeft, ChevronRight
} from "lucide-react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import ModalConfirmacao from "../components/ModalConfirmacao";

/* ──────────────────────────── Helpers ──────────────────────────── */
const fmt = (v, alt = "—") => (v === 0 || v ? String(v) : alt);
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n || 0)));
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
};

function useQueryState() {
  const location = useLocation();
  const navigate = useNavigate();
  const get = useCallback(() => {
    const sp = new URLSearchParams(location.search);
    return {
      id: sp.get("id") || "",
      q: sp.get("q") || "",
      page: Number(sp.get("page") || 1),
      per: Number(sp.get("per") || 20),
    };
  }, [location.search]);
  const set = useCallback((patch) => {
    const cur = get();
    const next = { ...cur, ...patch };
    const sp = new URLSearchParams();
    if (next.id) sp.set("id", next.id);
    if (next.q) sp.set("q", next.q);
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    if (next.per && next.per !== 20) sp.set("per", String(next.per));
    navigate({ search: `?${sp.toString()}` }, { replace: true });
  }, [get, navigate]);
  return { get, set };
}

function StatusChip({ status }) {
  const st = String(status || "").toLowerCase();
  const base = "px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1";
  if (st === "ativa")
    return <span className={`${base} bg-emerald-100 text-emerald-700`}>Ativa</span>;
  if (st === "encerrada")
    return <span className={`${base} bg-rose-100 text-rose-700`}>Encerrada</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>Rascunho</span>;
}

/* ──────────────────────────── Página ──────────────────────────── */
export default function AdminVotacoes() {
  const { get, set } = useQueryState();
  const url = get();

  const [lista, setLista] = useState([]);
  const [busca, setBusca] = useState(url.q);
  const [debQ, setDebQ] = useState(url.q);
  const [page, setPage] = useState(url.page || 1);
  const [perPage, setPerPage] = useState(url.per || 20);

  const [sel, setSel] = useState(null);
  const [ranking, setRanking] = useState([]);

  const [loading, setLoading] = useState(false);

  // ✅ confirmação premium p/ status
  const [confirmStatus, setConfirmStatus] = useState({
    open: false,
    nextStatus: "",
    label: "",
  });
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => { const t = setTimeout(() => setDebQ(busca), 250); return () => clearTimeout(t); }, [busca]);
  useEffect(() => { set({ q: debQ, page, per: perPage, id: sel?.id || url.id }); /* eslint-disable-next-line */}, [debQ, page, perPage, sel?.id]);

  useEffect(() => { recarregar(); }, []);
  useEffect(() => {
    // deep-link ?id= abre direto
    if (url.id) abrir(url.id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista.length]);

  async function recarregar() {
    try {
      setLoading(true);
      const data = await adminListar();
      setLista(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Falha ao listar.");
    } finally {
      setLoading(false);
    }
  }

  async function abrir(id) {
    const v = await adminObter(id);
    setSel({
      ...v,
      endereco: v.endereco ?? "",
      raio_m: clamp(v.raio_m ?? 200, 1, 200),
      opcoes: Array.isArray(v.opcoes) ? v.opcoes : [],
    });
    set({ id: String(id) });
    await carregaRanking(id);
  }

  function novo() {
    setSel({
      titulo: "",
      tipo_selecao: "unica",
      max_escolhas: 1,
      status: "rascunho",
      escopo: "global",
      regra_elegibilidade: "logado",
      endereco: "",
      raio_m: 200,
      evento_id: null,
      turma_id: null,
      opcoes: [],
    });
    setRanking([]);
    set({ id: "" });
  }

  async function salvar() {
    try {
      if (!sel?.titulo?.trim()) return toast.info("Informe o título.");
      const payload = {
        ...sel,
        descricao: undefined,
        unidade_id: undefined,
        geo_lat: undefined,
        geo_lng: undefined,
        geo_raio_m: undefined,
        inicio: undefined,
        fim: undefined,
        max_escolhas: sel.tipo_selecao === "multipla" ? toInt(sel.max_escolhas, 1) : 1,
        raio_m: clamp(sel.raio_m ?? 200, 1, 200),
      };
      if (payload.tipo_selecao !== "multipla") delete payload.max_escolhas;

      if (sel.id) {
        const upd = await adminAtualizar(sel.id, payload);
        setSel({ ...sel, ...upd, opcoes: Array.isArray(upd?.opcoes) ? upd.opcoes : (sel.opcoes || []) });
      } else {
        const criado = await adminCriar(payload);
        setSel({ ...criado, opcoes: Array.isArray(criado?.opcoes) ? criado.opcoes : [] });
        set({ id: String(criado.id) });
      }
      toast.success("Salvo!");
      recarregar();
    } catch (e) {
      toast.error(e?.response?.data?.erro || "Erro ao salvar.");
    }
  }

  async function addOpcao() {
    if (!sel?.id) return toast.info("Salve a votação primeiro.");
    const ordem = (sel.opcoes?.length || 0) + 1;
    const o = await adminCriarOpcao(sel.id, { titulo: "Nova opção", ordem });
    setSel((prev) => ({ ...prev, opcoes: [...(prev?.opcoes || []), o] }));
  }

  async function salvarOpcao(idOpcao) {
    if (!sel?.id) return;
    const o = (sel.opcoes || []).find(x => x.id === idOpcao);
    if (!o) return;

    const payload = {
      ...o,
      ordem: toInt(o.ordem, 0),
      titulo: (o.titulo || "").trim(),
    };

    const upd = await adminAtualizarOpcao(sel.id, o.id, payload);
    setSel((prev) => ({
      ...prev,
      opcoes: (prev?.opcoes || []).map(x => x.id === o.id ? upd : x),
    }));
  }

  // ✅ update imutável da opção (sem mutar `o`)
  const patchOpcao = useCallback((idOpcao, patch) => {
    setSel((prev) => {
      if (!prev) return prev;
      const opcoes = (prev.opcoes || []).map((o) => (o.id === idOpcao ? { ...o, ...patch } : o));
      return { ...prev, opcoes };
    });
  }, []);

  // ✅ abre modal confirmação (status)
  function solicitarMudarStatus(next) {
    if (!sel?.id) return;

    const label =
      next === "ativa" ? "Ativar" :
      next === "encerrada" ? "Encerrar" : "Mover para rascunho";

    setConfirmStatus({ open: true, nextStatus: next, label });
  }

  // ✅ executa status (com loading)
  async function executarMudarStatus() {
    if (!sel?.id || !confirmStatus?.nextStatus) {
      setConfirmStatus({ open: false, nextStatus: "", label: "" });
      return;
    }

    const next = confirmStatus.nextStatus;

    try {
      setStatusLoading(true);
      const v = await adminStatus(sel.id, next);
      setSel((prev) => ({ ...prev, status: v.status }));
      toast.success(`Status: ${v.status}`);
      recarregar();
      if (v.status === "encerrada") carregaRanking(sel.id).catch(() => {});
    } catch (e) {
      toast.error(e?.response?.data?.erro || "Erro ao alterar status.");
    } finally {
      setStatusLoading(false);
      setConfirmStatus({ open: false, nextStatus: "", label: "" });
    }
  }

  async function carregaRanking(id) {
    try {
      const r = await adminRanking(id);
      setRanking(Array.isArray(r) ? r : []);
    } catch {
      setRanking([]);
    }
  }

  const voteUrl = useMemo(() => {
    if (!sel?.id) return "";
    return `${window.location.origin}/votacoes/${sel.id}`;
  }, [sel?.id]);

  function copiarLink() {
    if (!voteUrl) return;
    navigator.clipboard.writeText(voteUrl).then(() => toast.success("Link copiado!"));
  }

  // QR: baixar PNG (Canvas)
  function baixarQrPng() {
    try {
      const canvas = document.getElementById("qr-votacao-canvas");
      if (!canvas) return;
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `votacao_${sel.id}.png`;
      a.click();
    } catch {
      toast.error("Não foi possível baixar a imagem do QR (PNG).");
    }
  }
  // QR: baixar SVG
  function baixarQrSvg() {
    try {
      const el = document.getElementById("qr-votacao-svg");
      if (!el) return;
      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(el);
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `votacao_${sel.id}.svg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Não foi possível baixar a imagem do QR (SVG).");
    }
  }

  function exportarRankingCSV() {
    if (!ranking?.length) return toast.info("Sem dados para exportar.");
    const SEP = ";";
    const BOM = "\uFEFF";
    const safe = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = ["opcao_id","opcao_titulo","votos"].join(SEP);
    const rows = ranking.map(r => [safe(r.opcao_id), safe(r.opcao_titulo), r.votos].join(SEP));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ranking_votacao_${sel?.id || "sem_id"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  // Lista filtrada + paginação
  const filtrada = useMemo(() => {
    const q = (debQ || "").trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(v =>
      [v.titulo, v.status, v.tipo_selecao].map(x => (x || "").toLowerCase()).some(t => t.includes(q))
    );
  }, [lista, debQ]);

  const total = filtrada.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const itens = useMemo(() => {
    const start = (pageClamped - 1) * perPage;
    return filtrada.slice(start, start + perPage);
  }, [filtrada, pageClamped, perPage]);

  const ministats = useMemo(() => {
    const t = lista.length;
    const ativas = lista.filter(v => v.status === "ativa").length;
    const rasc = lista.filter(v => v.status === "rascunho").length;
    const enc = lista.filter(v => v.status === "encerrada").length;
    return { t, ativas, rasc, enc };
  }, [lista]);

  const statusDisabled = loading || statusLoading || !sel?.id;

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-950">
      {/* Header hero com ministats */}
      <header className="text-white bg-gradient-to-br from-amber-700 via-orange-600 to-yellow-600">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 xl:max-w-[1680px] 2xl:max-w-[1920px]">
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold">Votações — Administração</h1>
          </div>
          <p className="mt-1 opacity-90 text-sm">Crie enquetes, controle regras de elegibilidade e acompanhe os resultados em tempo real.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Total" value={fmt(ministats.t, "—")} tone="amber" />
            <MiniStat label="Ativas" value={fmt(ministats.ativas, "—")} tone="green" />
            <MiniStat label="Rascunhos" value={fmt(ministats.rasc, "—")} tone="slate" />
            <MiniStat label="Encerradas" value={fmt(ministats.enc, "—")} tone="red" />
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10 py-8 grid lg:grid-cols-2 gap-6 xl:max-w-[1680px] 2xl:max-w-[1920px]">
        {/* LISTA */}
        <section className="space-y-3">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800 p-4 shadow">
            <header className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <h2 className="text-lg font-semibold">Votações</h2>
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setPage(1); }}
                  placeholder="Buscar por título, status…"
                  className="input pl-9"
                  aria-label="Buscar votações"
                />
                {busca && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => { setBusca(""); setDebQ(""); setPage(1); }}
                    aria-label="Limpar busca"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={novo} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-600 text-white">
                <Plus className="w-4 h-4" /> Nova
              </button>
            </header>

            <ul className="mt-3 space-y-2">
              {itens.map(v => (
                <li key={v.id}>
                  <button
                    onClick={() => abrir(v.id)}
                    className="w-full text-left rounded-xl border dark:border-zinc-800 hover:bg-amber-50/60 dark:hover:bg-zinc-800/40 transition p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 break-words">{v.titulo}</div>
                        <div className="text-xs opacity-70 flex items-center gap-2">
                          <StatusChip status={v.status} />
                          <span>{v.tipo_selecao}{v.tipo_selecao === "multipla" ? ` (máx ${v.max_escolhas})` : ""}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}

              {itens.length === 0 && (
                <li className="text-sm opacity-60 p-3">Nenhuma votação encontrada.</li>
              )}
            </ul>

            {/* paginação */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600 dark:text-zinc-300">
              <span>Exibindo <strong>{itens.length}</strong> de <strong>{total}</strong> resultados.</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">
                  por página
                  <select
                    value={perPage}
                    onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                    className="ml-1 border rounded px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <div className="inline-flex items-center gap-1">
                  <button
                    className="p-1 rounded border dark:border-zinc-700 disabled:opacity-50"
                    disabled={pageClamped <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-1">Página <strong>{pageClamped}</strong> / {totalPages}</span>
                  <button
                    className="p-1 rounded border dark:border-zinc-700 disabled:opacity-50"
                    disabled={pageClamped >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    aria-label="Próxima página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FORM + OPÇÕES + RANKING */}
        <section className="space-y-4">
          {!sel ? (
            <div className="opacity-70 text-sm p-4 bg-white dark:bg-zinc-900 rounded-2xl border dark:border-zinc-800">
              Selecione ou crie uma votação.
            </div>
          ) : (
            <>
              {/* DADOS BÁSICOS */}
              <div className="rounded-2xl border dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 shadow">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold">Configurações</h3>
                  <div className="ml-auto flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                    <StatusChip status={sel.status} />
                    {sel?.id && (
                      <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> ID {sel.id}</span>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs">Título</span>
                    <input className="input" value={sel.titulo} onChange={e => setSel({ ...sel, titulo: e.target.value })} />
                  </label>

                  <label className="block">
                    <span className="text-xs">Tipo de seleção</span>
                    <select className="input" value={sel.tipo_selecao} onChange={e => setSel({ ...sel, tipo_selecao: e.target.value })}>
                      <option value="unica">Apenas 1 opção</option>
                      <option value="multipla">Múltiplas opções</option>
                    </select>
                  </label>

                  {sel.tipo_selecao === "multipla" && (
                    <label className="block">
                      <span className="text-xs">Máximo de escolhas</span>
                      <input
                        type="number" min={1}
                        className="input"
                        value={sel.max_escolhas}
                        onChange={e => setSel({ ...sel, max_escolhas: toInt(e.target.value, 1) || 1 })}
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="text-xs">Regra de elegibilidade</span>
                    <select className="input" value={sel.regra_elegibilidade} onChange={e => setSel({ ...sel, regra_elegibilidade: e.target.value })}>
                      <option value="logado">Apenas logados</option>
                      <option value="inscrito">Inscrito (evento/turma)</option>
                      <option value="presente_hoje">Presente hoje</option>
                      <option value="presenca_minima">Presença ≥ 75%</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs">Escopo</span>
                    <select className="input" value={sel.escopo} onChange={e => setSel({ ...sel, escopo: e.target.value })}>
                      <option value="global">Global</option>
                      <option value="evento">Evento</option>
                      <option value="turma">Turma</option>
                    </select>
                  </label>

                  {sel.escopo === "evento" && (
                    <label className="block">
                      <span className="text-xs">Evento ID</span>
                      <input className="input" value={sel.evento_id || ""} onChange={e => setSel({ ...sel, evento_id: e.target.value })} />
                    </label>
                  )}
                  {sel.escopo === "turma" && (
                    <label className="block">
                      <span className="text-xs">Turma ID</span>
                      <input className="input" value={sel.turma_id || ""} onChange={e => setSel({ ...sel, turma_id: e.target.value })} />
                    </label>
                  )}

                  {/* Geofence */}
                  <label className="block md:col-span-2">
                    <span className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Endereço (limitar votação no local)</span>
                    <input
                      className="input"
                      placeholder="Ex.: Av. Dr. Cláudio Luís da Costa, 123 – Santos/SP"
                      value={sel.endereco || ""}
                      onChange={e => setSel({ ...sel, endereco: e.target.value })}
                    />
                    <p className="text-[11px] mt-1 text-zinc-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Geofence opcional com raio máximo de 200 m.
                    </p>
                  </label>

                  <div className="md:col-span-2 grid sm:grid-cols-2 gap-3 items-center">
                    <label className="block">
                      <span className="text-xs">Raio (metros, máx. 200)</span>
                      <input
                        type="number"
                        className="input"
                        min={1}
                        max={200}
                        value={sel.raio_m ?? 200}
                        onChange={e => setSel({ ...sel, raio_m: clamp(e.target.value, 1, 200) })}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs opacity-70">Ajuste rápido</span>
                      <input
                        type="range"
                        min={50}
                        max={200}
                        step={10}
                        value={sel.raio_m ?? 200}
                        onChange={e => setSel({ ...sel, raio_m: clamp(e.target.value, 1, 200) })}
                        className="w-full"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={salvar} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-600 text-white">
                    <Save className="w-4 h-4" /> Salvar
                  </button>

                  <button
                    onClick={() => solicitarMudarStatus("ativa")}
                    disabled={statusDisabled || sel.status === "ativa"}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> Ativar
                  </button>

                  <button
                    onClick={() => solicitarMudarStatus("rascunho")}
                    disabled={statusDisabled || sel.status === "rascunho"}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" /> Rascunho
                  </button>

                  <button
                    onClick={() => solicitarMudarStatus("encerrada")}
                    disabled={statusDisabled || sel.status === "encerrada"}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border disabled:opacity-50"
                  >
                    <StopCircle className="w-4 h-4" /> Encerrar
                  </button>
                </div>
              </div>

              {/* QR CODE */}
              {sel?.id && (
                <div className="rounded-2xl border dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 shadow">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <QrCode className="w-4 h-4" /> QR Code da votação
                    </h3>
                    <div className="ml-auto flex gap-2">
                      <button onClick={copiarLink} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                        <Copy className="w-4 h-4" /> Copiar link
                      </button>
                      <button onClick={baixarQrPng} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                        <Download className="w-4 h-4" /> Baixar PNG
                      </button>
                      <button onClick={baixarQrSvg} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                        <Download className="w-4 h-4" /> Baixar SVG
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="rounded-xl p-3 border dark:border-zinc-700">
                      <QRCodeCanvas id="qr-votacao-canvas" value={voteUrl} size={192} level="H" includeMargin />
                    </div>
                    <div className="rounded-xl p-3 border dark:border-zinc-700 hidden sm:block">
                      <QRCodeSVG id="qr-votacao-svg" value={voteUrl} size={192} level="H" includeMargin />
                    </div>
                    <div className="text-xs opacity-80 break-all sm:max-w-[50ch]">{voteUrl}</div>
                  </div>
                </div>
              )}

              {/* OPÇÕES */}
              <div className="rounded-2xl border dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 shadow">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Opções</h3>
                  <button onClick={addOpcao} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                </div>

                <ul className="space-y-2">
                  {(sel.opcoes || []).map(o => (
                    <li key={o.id} className="grid md:grid-cols-4 gap-2 items-center">
                      <input
                        className="input md:col-span-2"
                        value={o.titulo || ""}
                        onChange={e => patchOpcao(o.id, { titulo: e.target.value })}
                        onBlur={() => salvarOpcao(o.id)}
                        placeholder="Título da opção"
                      />
                      <input
                        className="input"
                        type="number"
                        value={toInt(o.ordem, 0)}
                        onChange={e => patchOpcao(o.id, { ordem: toInt(e.target.value, 0) })}
                        onBlur={() => salvarOpcao(o.id)}
                        placeholder="Ordem"
                      />
                      <select
                        className="input"
                        value={o.ativo ? "1" : "0"}
                        onChange={e => {
                          patchOpcao(o.id, { ativo: e.target.value === "1" });
                          salvarOpcao(o.id);
                        }}
                      >
                        <option value="1">Ativa</option>
                        <option value="0">Inativa</option>
                      </select>
                    </li>
                  ))}
                  {(!sel.opcoes || sel.opcoes.length === 0) && (
                    <li className="text-sm opacity-60">Nenhuma opção criada.</li>
                  )}
                </ul>
              </div>

              {/* RANKING */}
              <div className="rounded-2xl border dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 shadow">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Ranking</h3>
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => sel?.id && carregaRanking(sel.id)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                      <BarChart3 className="w-4 h-4" /> Atualizar
                    </button>
                    <button onClick={exportarRankingCSV} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                      <Download className="w-4 h-4" /> Exportar CSV
                    </button>
                  </div>
                </div>

                {!ranking.length ? (
                  <div className="text-sm opacity-60">Sem votos ainda.</div>
                ) : (
                  <ul className="space-y-1">
                    {ranking.map(r => (
                      <li key={r.opcao_id} className="flex justify-between">
                        <span className="break-words">{r.opcao_titulo}</span>
                        <span className="font-medium">{r.votos}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ✅ ModalConfirmacao: mudar status */}
      <ModalConfirmacao
        isOpen={!!confirmStatus.open}
        title={`${confirmStatus.label} votação?`}
        description={sel?.titulo ? `${confirmStatus.label} a votação "${sel.titulo}"?` : "Confirmar alteração de status?"}
        confirmText={confirmStatus.label}
        cancelText="Cancelar"
        danger={confirmStatus.nextStatus === "encerrada"}
        loading={statusLoading}
        onClose={() => {
          if (statusLoading) return;
          setConfirmStatus({ open: false, nextStatus: "", label: "" });
        }}
        onConfirm={executarMudarStatus}
      />
    </main>
  );
}

/* ──────────────────────────── Subcomponentes ──────────────────────────── */
function MiniStat({ label, value, tone = "amber" }) {
  const tones =
    {
      amber: { text: "text-amber-50", bg: "bg-amber-500/20", border: "border-amber-300/40" },
      green: { text: "text-emerald-50", bg: "bg-emerald-500/20", border: "border-emerald-300/40" },
      red: { text: "text-rose-50", bg: "bg-rose-500/20", border: "border-rose-300/40" },
      slate: { text: "text-slate-50", bg: "bg-slate-500/20", border: "border-slate-300/40" },
    }[tone] || { text: "text-slate-50", bg: "bg-slate-500/20", border: "border-slate-300/40" };

  return (
    <div className={`rounded-2xl border ${tones.border} ${tones.bg} backdrop-blur px-3 py-3 text-left`}>
      <p className="text-xs uppercase tracking-wide text-white/85">{label}</p>
      <p className={`mt-1 font-bold text-lg sm:text-2xl ${tones.text}`}>{value}</p>
    </div>
  );
}
