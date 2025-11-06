// 📁 src/pages/AdminSubmissoes.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Filter,
  ClipboardList,
  Award,
  Search,
  Users,
  Paperclip,
  Download,
  Mic,
} from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";
import RankingModal from "../components/RankingModal";
import RankingOralModal from "../components/RankingOralModal";
import ModalAvaliadores from "../components/ModalAvaliadores";

// ⬇️ novos modais externos
import ModalDetalhesSubmissao from "../components/ModalDetalhesSubmissao";
import ModalAtribuirAvaliadores from "../components/ModalAtribuirAvaliadores";

/* ————————————————— Utils ————————————————— */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 2) => Number(v ?? 0).toFixed(d);
const fmtNota = (v) => (v === 0 || v ? fmtNum(v, 2) : "—");

function fmtDateTimeBR(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return "—";
  }
}

const fmtMonthBR = (yyyyMm) => {
  const m = String(yyyyMm || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return fmt(yyyyMm);
  const [y, mo] = m.split("-");
  return `${mo}/${y}`;
};

const linhaKeyFromSub = (s) =>
  String(
    s?.linha_tematica_id ??
      s?.linhaTematicaId ??
      s?.linha_tematica_nome ??
      s?.linha_tematica_codigo ??
      ""
  );

/* ——— Aprovações parciais (alinhado com RankingModal e com o banco novo) ——— */
const hasAprovExposicao = (s) => {
  const escritaLower = String(s?.status_escrita || "").toLowerCase();
  const stLower = String(s?.status || "").toLowerCase();
  return (
    escritaLower === "aprovado" ||
    stLower === "aprovado_exposicao" ||
    stLower === "aprovado_escrita" ||
    Boolean(s?._exposicao_aprovada)
  );
};

const hasAprovOral = (s) => {
  const oralLower = String(s?.status_oral || "").toLowerCase();
  const stLower = String(s?.status || "").toLowerCase();
  return (
    oralLower === "aprovado" ||
    stLower === "aprovado_oral" ||
    Boolean(s?._oral_aprovada)
  );
};

// ————————————————— Anexos helpers —————————————————
const truthy = (v) => {
  if (v == null) return false;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t.length > 0 && t !== "0" && t !== "false" && t !== "none" && t !== "null";
  }
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) return v.length > 0;
  return !!v;
};

const hasAnexoRaw = (s) => {
  const c = [
    s?.poster_nome, s?.posterNome, s?.poster_arquivo_nome, s?.nome_poster, s?.poster,
    s?.banner_nome, s?.bannerNome, s?.banner_arquivo_nome, s?.nome_banner, s?.banner,
    s?.has_poster, s?.tem_poster, s?.poster_enviado, s?.possui_poster,
    s?.has_banner, s?.tem_banner, s?.banner_enviado, s?.possui_banner,
    s?.has_anexo, s?.tem_anexo, s?.possui_anexo, s?.anexos, s?.arquivos,
  ];
  return c.some(truthy);
};

const hasAnexo = (s) => truthy(s?._hasAnexo) || hasAnexoRaw(s);

/* ————————————————— Status + chips de aprovação ————————————————— */
function normalizarStatusPrincipal(raw) {
  const st = String(raw || "").toLowerCase();
  if (st === "rascunho") return "rascunho";
  if (st === "submetido") return "submetido";
  if (st === "em_avaliacao") return "em avaliação";
  if (["aprovado", "aprovado_exposicao", "aprovado_oral", "aprovado_escrita"].includes(st)) return "aprovado";
  if (st === "reprovado") return "reprovado";
  return st || "—";
}

function StatusBadge({ status }) {
  const label = normalizarStatusPrincipal(status);
  const base =
    "px-2 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 justify-center whitespace-nowrap";
  switch (label) {
    case "rascunho":
      return <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>Rascunho</span>;
    case "submetido":
      return <span className={`${base} bg-blue-100 text-blue-700`}>Submetido</span>;
    case "em avaliação":
      return <span className={`${base} bg-amber-100 text-amber-700`}>Em avaliação</span>;
    case "aprovado":
      return <span className={`${base} bg-emerald-100 text-emerald-700`}>Aprovado</span>;
    case "reprovado":
      return <span className={`${base} bg-rose-100 text-rose-700`}>Reprovado</span>;
    default:
      return <span className={`${base} bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}>{label}</span>;
  }
}

function StatusAndApprovals({ s }) {
  const principal = normalizarStatusPrincipal(s?.status);
  const expoOk =
    String(s?.status_escrita || "").toLowerCase() === "aprovado" ||
    Boolean(s?._exposicao_aprovada);
  const oralOk =
    String(s?.status_oral || "").toLowerCase() === "aprovado" ||
    Boolean(s?._oral_aprovada);
  const mostrarModalidades = principal === "aprovado" && (expoOk || oralOk);

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <StatusBadge status={s.status} />
      {mostrarModalidades && (
        <div className="inline-flex flex-wrap justify-center gap-1.5">
          {expoOk && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Exposição</span>}
          {oralOk && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Apresentação oral</span>}
        </div>
      )}
    </div>
  );
}

/* ————————————————— CSV export ————————————————— */
const handleExportCSV = (items = []) => {
  const SEP = ";";
  const BOM = "\uFEFF";
  const safe = (v) => {
    const s = (v ?? "").toString().replace(/\r?\n/g, " ").trim();
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = [
    "Título","Autor","E-mail","Chamada","Linha temática","Submetido em",
    "Status (principal)","Exposição","Apresentação oral",
    "Nota (escrita)","Nota (oral)","Nota (final)","Anexo",
  ].join(SEP);

  const rows = items.map((s) => {
    const dt =
      String(s.status || "").toLowerCase() === "rascunho"
        ? "—"
        : fmtDateTimeBR(s.submetido_em || s.criado_em); // ⬅️ fallback robusto

    const st = String(s.status || "").toLowerCase();
    const statusPrincipal =
      st.startsWith("aprovado_") ? "Aprovado" :
      st === "submetido" ? "Submetido" :
      st === "em_avaliacao" ? "Em avaliação" :
      st === "reprovado" ? "Reprovado" :
      st === "rascunho" ? "Rascunho" : s.status || "—";

    const escritaTxt = hasAprovExposicao(s) ? "Aprovada" : "Pendente";
    const oralTxt = hasAprovOral(s) ? "Aprovada" : "Pendente";
    const anexoTxt = hasAnexo(s) ? "Sim" : "Não";

    return [
      safe(s.titulo),
      safe(s.autor_nome),
      safe(s.autor_email),
      safe(s.chamada_titulo),
      safe(s.linha_tematica_nome || s.linhaTematicaNome || ""),
      safe(dt),
      safe(statusPrincipal),
      safe(escritaTxt),
      safe(oralTxt),
      safe(fmtNota(s.nota_escrita)),
      safe(fmtNota(s.nota_oral)),
      safe(fmtNota(s.nota_final)),
      safe(anexoTxt),
    ].join(SEP);
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const ts = new Date();
  const stamp =
    `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-` +
    `${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}`;
  const filename = `submissoes_admin_${stamp}.csv`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/* ————————————————— Página principal ————————————————— */
export default function AdminSubmissoes() {
  const [submissoes, setSubmissoes] = useState([]);
  const [oralOpen, setOralOpen] = useState(false);
  const [filtroChamada, setFiltroChamada] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [busca, setBusca] = useState("");
  const [debouncedBusca, setDebouncedBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [chamadas, setChamadas] = useState([]);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [avaliadoresOpen, setAvaliadoresOpen] = useState(false);

  // ⬇️ novo estado para o modal de inclusão de avaliadores
  const [atribOpen, setAtribOpen] = useState(false);
  const [subIdAtrib, setSubIdAtrib] = useState(null);

  const unwrap = (r) => (Array.isArray(r) ? r : r?.data ?? []);

  useOnceEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const [subs, ch] = await Promise.all([
          api.get("/admin/submissoes", { signal: ac.signal }),
          api.get("/chamadas/ativas", { signal: ac.signal }),
        ]);

        const base = unwrap(subs).map((it) => ({ ...it, _hasAnexo: hasAnexoRaw(it) }));
        setSubmissoes(base);
        setChamadas(unwrap(ch));

        // checagem preguiçosa de anexos
        const idsParaChecar = base.filter((s) => !s._hasAnexo).map((s) => s.id);
        const conc = 6;
        let idx = 0;
        const axiosOk = (s) => (s >= 200 && s < 300) || s === 404;
        const run = async (id) => {
          const tryPublic = await api.get(`/submissoes/${id}`, { signal: ac.signal, validateStatus: axiosOk });
          if (tryPublic?.status !== 404) {
            const sub = Array.isArray(tryPublic?.data) ? tryPublic.data[0] : tryPublic?.data ?? tryPublic;
            return { id, ok: hasAnexoRaw(sub) };
          }
          const tryAdmin = await api.get(`/admin/submissoes/${id}`, { signal: ac.signal, validateStatus: axiosOk });
          if (tryAdmin?.status !== 404) {
            const sub = Array.isArray(tryAdmin?.data) ? tryAdmin.data[0] : tryAdmin?.data ?? tryAdmin;
            return { id, ok: hasAnexoRaw(sub) };
          }
          return { id, ok: false };
        };
        const workers = Array.from({ length: conc }, async () => {
          while (idx < idsParaChecar.length) {
            const id = idsParaChecar[idx++];
            const res = await run(id);
            if (res.ok) {
              setSubmissoes((prev) => prev.map((it) => (it.id === id ? { ...it, _hasAnexo: true } : it)));
            }
          }
        });
        Promise.allSettled(workers);
      } catch (err) {
        if (err?.name !== "AbortError") console.error("Erro ao carregar:", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusca(busca), 200);
    return () => clearTimeout(t);
  }, [busca]);

  const linhasTematicas = useMemo(() => {
    const map = new Map();
    for (const s of submissoes) {
      const key = linhaKeyFromSub(s);
      const nome = s?.linha_tematica_nome ?? s?.linhaTematicaNome ?? null;
      const codigo = s?.linha_tematica_codigo ?? s?.linha_tematicaCodigo ?? null;
      if (!key || !nome) continue;
      if (!map.has(key)) map.set(key, { id: key, nome: String(nome), codigo: codigo ? String(codigo) : null });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
    );
  }, [submissoes]);

  const filtradas = useMemo(() => {
    const termo = debouncedBusca.trim().toLowerCase();
    return submissoes.filter((s) => {
      const matchChamada = !filtroChamada || Number(s.chamada_id) === Number(filtroChamada);
      const matchStatus = !filtroStatus
        ? true
        : (filtroStatus === "aprovado_escrita" && hasAprovExposicao(s)) ||
          (filtroStatus === "aprovado_oral" && hasAprovOral(s)) ||
          ((filtroStatus !== "aprovado_escrita" && filtroStatus !== "aprovado_oral") && s.status === filtroStatus);
      const matchLinha = !filtroLinha || linhaKeyFromSub(s) === String(filtroLinha);
      const matchBusca =
        !termo ||
        [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.area_tematica, s.eixo, s.linha_tematica_nome, s.linha_tematica_codigo]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .some((t) => t.includes(termo));
      return matchChamada && matchStatus && matchLinha && matchBusca;
    });
  }, [submissoes, filtroChamada, filtroStatus, filtroLinha, debouncedBusca]);

  const stats = useMemo(() => {
    const total = submissoes.length;
    const aprovadas = submissoes.filter((s) =>
      ["aprovado_oral", "aprovado_exposicao", "aprovado_escrita"].includes(String(s.status || "").toLowerCase())
    ).length;
    const reprovadas = submissoes.filter((s) => String(s.status || "").toLowerCase() === "reprovado").length;
    const emAvaliacao = submissoes.filter((s) => String(s.status || "").toLowerCase() === "em_avaliacao").length;
    return { total, aprovadas, reprovadas, emAvaliacao };
  }, [submissoes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 to-yellow-100">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gelo dark:bg-zinc-950">
      <HeaderHero stats={stats} />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 2xl:px-10 py-10 mx-auto w-full space-y-10
                       xl:max-w-[1680px] 2xl:max-w-[1920px]">
        {/* Toolbar de ações (separada dos filtros) */}
<section
  className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-5 border dark:border-zinc-800 space-y-4"
  aria-label="Ações e filtros"
>
  {/* Ações / botões */}
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
    <div className="flex items-center gap-2">
      <Filter className="w-5 h-5 text-amber-600" aria-hidden="true" />
      <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Painel</h2>
    </div>

    <div className="flex flex-1 flex-wrap gap-2 sm:justify-end">
      <button
        type="button"
        onClick={() => setRankingOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
        title="Abrir ranking"
      >
        <Award className="w-4 h-4" />
        Ranking Escrita
      </button>

      <button
  onClick={() => setOralOpen(true)}
  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
>
  <Mic className="w-4 h-4" />
  Ranking Oral
</button>

      <button
        type="button"
        onClick={() => setAvaliadoresOpen(true)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
        title="Ver avaliadores com encaminhamentos"
      >
        <Users className="w-4 h-4" />
        Avaliadores
      </button>

      <button
        type="button"
        onClick={() => handleExportCSV(filtradas)}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-700"
        title="Exportar resumo (CSV)"
      >
        <Download className="w-4 h-4" />
        Exportar CSV
      </button>
    </div>
  </div>

  {/* Filtros amplos */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <select
      value={filtroChamada}
      onChange={(e) => setFiltroChamada(e.target.value)}
      className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
      aria-label="Filtrar por chamada"
    >
      <option value="">Todas as chamadas</option>
      {chamadas.map((c) => (
        <option key={c.id} value={c.id}>{c.titulo}</option>
      ))}
    </select>

    <select
      value={filtroStatus}
      onChange={(e) => setFiltroStatus(e.target.value)}
      className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
      aria-label="Filtrar por status"
    >
      <option value="">Todos os status</option>
      <option value="submetido">Submetido</option>
      <option value="em_avaliacao">Em avaliação</option>
      <option value="aprovado_exposicao">Aprovado (Exposição)</option>
      <option value="aprovado_oral">Aprovado (Oral)</option>
      <option value="aprovado_escrita">Aprovado (Escrita)</option>
      <option value="reprovado">Reprovado</option>
    </select>

    <select
      value={filtroLinha}
      onChange={(e) => setFiltroLinha(e.target.value)}
      className="border rounded-md px-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
      aria-label="Filtrar por linha temática"
    >
      <option value="">Todas as linhas</option>
      {linhasTematicas.map((l) => (
        <option key={l.id} value={l.id}>{l.nome}</option>
      ))}
    </select>

    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="border rounded-md pl-9 pr-3 py-2 text-sm w-full dark:border-zinc-700 dark:bg-zinc-800"
        placeholder="Buscar por título, autor, linha, eixo…"
        aria-label="Buscar"
      />
    </div>
  </div>
</section>

        {/* Tabela (desktop) */}
        <section className="hidden md:block overflow-x-auto 2xl:overflow-x-visible bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800" aria-label="Tabela de submissões">
         <table className="w-full table-auto text-sm">
            <caption className="sr-only">Lista de submissões filtradas</caption>
            <thead className="bg-amber-600 text-white">
              <tr>
              <th scope="col" className="p-3 text-left w-[28%] min-w-[360px]">Título</th>
                <th scope="col" className="p-3 text-left w-[16%] min-w-[220px]">Autor</th>
                <th scope="col" className="p-3 text-left w-[16%] min-w-[220px]">Chamada</th>
                <th scope="col" className="p-3 text-left w-[16%] min-w-[220px]">Linha temática</th>
                <th scope="col" className="p-3 text-center w-[10%] min-w-[140px]">Submetido em</th>
                <th scope="col" className="p-3 text-center w-[10%] min-w-[140px]">Status</th>
                <th scope="col" className="p-3 text-center w-[6%]  min-w-[90px]">Nota (escrita)</th>
                <th scope="col" className="p-3 text-center w-[6%]  min-w-[90px]">Nota (oral)</th>
                <th scope="col" className="p-3 text-center w-[6%]  min-w-[90px]">Nota (final)</th>
                <th scope="col" className="p-3 text-center w-[12%] min-w-[180px]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-zinc-600">Nenhuma submissão encontrada.</td>
                </tr>
              )}

              {filtradas.map((s) => (
                <tr
                  key={s.id}
                  className={
                    "border-b dark:border-zinc-800 hover:bg-amber-50/60 dark:hover:bg-zinc-800/40 transition " +
                    (hasAnexo(s) ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-zinc-300 dark:border-l-zinc-700")
                  }
                >
                  <td className="p-3 align-top" title={s.titulo}>
                    <div className="flex items-start gap-2">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100 whitespace-normal break-words">{s.titulo}</span>
                      <span
                        className={
                          "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium " +
                          (hasAnexo(s) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")
                        }
                        title={hasAnexo(s) ? "Este trabalho possui anexo (pôster ou banner)" : "Nenhum anexo enviado"}
                      >
                        <Paperclip className="h-3 w-3" />
                        {hasAnexo(s) ? "Anexo" : "Sem anexo"}
                      </span>
                    </div>
                  </td>

                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100 whitespace-normal break-words">{s.autor_nome}</span>
                      <span className="text-xs text-zinc-500 whitespace-normal break-words">{s.autor_email}</span>
                    </div>
                  </td>

                  <td className="p-3 text-zinc-700 dark:text-zinc-300 whitespace-normal break-words">
                    {s.chamada_titulo}
                  </td>

                  <td className="p-3 text-zinc-700 dark:text-zinc-300 whitespace-normal break-words">
                    {s.linha_tematica_nome || s.linhaTematicaNome || "—"}
                  </td>

                  <td className="p-3 text-center">
                    {String(s.status || "").toLowerCase() === "rascunho" ? "—" : fmtDateTimeBR(s.submetido_em || s.criado_em)}
                  </td>

                  <td className="p-3 text-center">
                    <StatusAndApprovals s={s} />
                  </td>

                  <td className="p-3 text-center font-semibold text-zinc-800 dark:text-zinc-100">
                    {fmtNota(s.nota_escrita)}
                  </td>
                  <td className="p-3 text-center font-semibold text-zinc-800 dark:text-zinc-100">
                    {fmtNota(s.nota_oral)}
                  </td>
                  <td className="p-3 text-center font-semibold text-zinc-800 dark:text-zinc-100">
                    {fmtNota(s.nota_final)}
                  </td>

                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setSelecionada(s); setDetalheOpen(true); }}
                        className="px-3 py-1.5 rounded-full bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                        aria-label={`Abrir detalhes de ${s.titulo}`}
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => { setSubIdAtrib(s.id); setAtribOpen(true); }}
                        className="px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                        aria-label={`Incluir avaliadores para ${s.titulo}`}
                      >
                        Incluir avaliadores
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Cards (mobile) */}
        <section className="md:hidden grid grid-cols-1 gap-3" aria-label="Cards de submissões">
          {filtradas.length === 0 && (
            <div className="text-center py-6 text-zinc-600 bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800">
              Nenhuma submissão encontrada.
            </div>
          )}

          {filtradas.map((s) => (
            <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-2xl shadow border dark:border-zinc-800 p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-start gap-2">
                    <p className="font-semibold text-zinc-800 dark:text-zinc-100 whitespace-normal break-words">{s.titulo}</p>
                    <span
                      className={
                        "shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium " +
                        (hasAnexo(s) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300")
                      }
                    >
                      <Paperclip className="h-3 w-3" />
                      {hasAnexo(s) ? "Anexo" : "Sem anexo"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 whitespace-normal break-words">{s.chamada_titulo}</p>
                  <p className="text-xs text-zinc-500 whitespace-normal break-words">
                    {s.linha_tematica_nome || s.linhaTematicaNome || "—"}
                  </p>
                </div>
                <StatusAndApprovals s={s} />
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-normal break-words">
                <span className="font-medium">{s.autor_nome}</span>
                <span className="text-zinc-500"> · {s.autor_email}</span>
              </p>

              {String(s.status || "").toLowerCase() !== "rascunho" && (
                <p className="text-xs text-zinc-500">
                  Submetido em: {fmtDateTimeBR(s.submetido_em || s.criado_em)}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
                  <p className="text-[10px] text-zinc-500">Escrita</p>
                  <p className="text-sm font-semibold">{fmtNota(s.nota_escrita)}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
                  <p className="text-[10px] text-zinc-500">Oral</p>
                  <p className="text-sm font-semibold">{fmtNota(s.nota_oral)}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2">
                  <p className="text-[10px] text-zinc-500">Final</p>
                  <p className="text-sm font-semibold">{fmtNota(s.nota_final)}</p>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2 gap-2">
                <button
                  onClick={() => { setSelecionada(s); setDetalheOpen(true); }}
                  className="px-3 py-1.5 rounded-full bg-amber-700 text-white"
                  aria-label={`Abrir detalhes de ${s.titulo}`}
                >
                  Ver
                </button>
                <button
                  onClick={() => { setSubIdAtrib(s.id); setAtribOpen(true); }}
                  className="px-3 py-1.5 rounded-full bg-emerald-600 text-white"
                  aria-label={`Incluir avaliadores para ${s.titulo}`}
                >
                  Avaliadores
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>

      <Footer />

      <AnimatePresence>
        {detalheOpen && (
          <ModalDetalhesSubmissao
            open={detalheOpen}
            onClose={() => setDetalheOpen(false)}
            submissao={selecionada}
            onDetectAnexo={(id, has) => {
              if (!has) return;
              setSubmissoes((prev) => prev.map((it) => (it.id === id ? { ...it, _hasAnexo: true } : it)));
            }}
          />
        )}

        {atribOpen && (
          <ModalAtribuirAvaliadores
            isOpen={atribOpen}
            submissaoId={subIdAtrib}
            onClose={() => setAtribOpen(false)}
            onChanged={() => {}}
          />
        )}

        {rankingOpen && (
          <RankingModal
            key="ranking-modal"
            open={rankingOpen}
            onClose={() => setRankingOpen(false)}
            itens={filtradas}
            onStatusChange={(id, patch) => {
              setSubmissoes((prev) =>
                prev.map((it) => {
                  if (it.id !== id) return it;
                  const p = typeof patch === "string" ? { status: patch } : patch || {};
                  const stLower = String(p.status || it.status || "").toLowerCase();
                  const escritaLower = String(p.status_escrita || it.status_escrita || "").toLowerCase();
                  const oralLower = String(p.status_oral || it.status_oral || "").toLowerCase();

                  const aprovExpoAgora =
                    p._exposicao_aprovada === true ||
                    stLower === "aprovado_exposicao" ||
                    stLower === "aprovado_escrita" ||
                    escritaLower === "aprovado";

                  const aprovOralAgora =
                    p._oral_aprovada === true ||
                    stLower === "aprovado_oral" ||
                    oralLower === "aprovado";

                  const aprovExpoAntes = it._exposicao_aprovada === true;
                  const aprovOralAntes = it._oral_aprovada === true;

                  const novaExpo = aprovExpoAntes || aprovExpoAgora;
                  const novaOral = aprovOralAntes || aprovOralAgora;

                  let statusFinal = it.status;
                  if (stLower === "reprovado") statusFinal = "reprovado";
                  else if (novaExpo || novaOral) statusFinal = "aprovado";
                  else if (p.status) statusFinal = p.status;

                  return {
                    ...it,
                    status: statusFinal,
                    _exposicao_aprovada: novaExpo,
                    _oral_aprovada: novaOral,
                    status_escrita: p.status_escrita || it.status_escrita,
                    status_oral: p.status_oral || it.status_oral,
                  };
                })
              );
            }}
          />
        )}

<RankingOralModal
  open={oralOpen}
  onClose={() => setOralOpen(false)}
  itens={filtradas}
/>

        {avaliadoresOpen && (
          <ModalAvaliadores
            key="avaliadores-modal"
            isOpen={avaliadoresOpen}
            onClose={() => setAvaliadoresOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ————————————————— HeaderHero (mantém degradê 3 cores) ————————————————— */
function StatPill({ label, value, tone = "amber" }) {
  const tones =
    {
      amber: { text: "text-amber-50", bg: "bg-amber-500/20", border: "border-amber-300/40" },
      green: { text: "text-emerald-50", bg: "bg-emerald-500/20", border: "border-emerald-300/40" },
      blue: { text: "text-blue-50", bg: "bg-blue-500/20", border: "border-blue-300/40" },
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

function HeaderHero({ stats }) {
  const { total, aprovadas, emAvaliacao, reprovadas } = stats || {};
  return (
    <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="w-full text-white">
      <div className="bg-gradient-to-br from-amber-700 via-orange-600 to-yellow-600">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10
                 xl:max-w-[1680px] 2xl:max-w-[1920px] py-10 sm:py-12 text-center">
          <div className="flex items-center justify-center gap-3">
            <ClipboardList className="h-9 w-9" aria-hidden="true" />
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight text-center">Submissão de Trabalhos — Administração</h1>
          </div>
          <p className="mt-2 text-center text-sm sm:text-base opacity-90">Acompanhe, filtre e audite todos os trabalhos submetidos às chamadas.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total" value={fmt(total, "—")} tone="amber" />
            <StatPill label="Aprovadas" value={fmt(aprovadas, "—")} tone="green" />
            <StatPill label="Em avaliação" value={fmt(emAvaliacao, "—")} tone="blue" />
            <StatPill label="Reprovadas" value={fmt(reprovadas, "—")} tone="red" />
          </div>
        </div>
      </div>
    </motion.header>
  );
}
