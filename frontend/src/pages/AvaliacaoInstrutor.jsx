// ✅ src/pages/AvaliacaoInstrutor.jsx — premium++ (ministats, export CSV, a11y, cache leve)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Skeleton from "react-loading-skeleton";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { BarChart3, ClipboardList, MessageSquare, School, RefreshCw, CalendarRange, Download } from "lucide-react";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api";
import { formatarDataBrasileira } from "../utils/data";
import BotaoPrimario from "../components/BotaoPrimario";

/* ---------------------- Debug helpers (logs) ---------------------- */
const DEBUG = false;
const log = {
  info: (...a) => DEBUG && console.info("[AvalInstrutor]", ...a),
  warn: (...a) => DEBUG && console.warn("[AvalInstrutor]", ...a),
  error: (...a) => DEBUG && console.error("[AvalInstrutor]", ...a),
  table: (data, ...a) => DEBUG && console.table?.(data, ...a),
  group(title) {
    if (!DEBUG) return { end: () => {} };
    console.groupCollapsed(`📊 ${title}`);
    return { end: () => console.groupEnd() };
  },
  time(label) {
    if (!DEBUG) return { end: () => {} };
    console.time(label);
    return { end: () => console.timeEnd(label) };
  },
};

/* ----------------------- Config dos campos ----------------------- */
const CAMPOS_OBJETIVOS = [
  "divulgacao_evento",
  "recepcao",
  "credenciamento",
  "material_apoio",
  "pontualidade",
  "sinalizacao_local",
  "conteudo_temas",
  "desempenho_instrutor",
  "estrutura_local",
  "acessibilidade",
  "limpeza",
  "inscricao_online",
  "exposicao_trabalhos",
  "apresentacao_oral_mostra",
  "apresentacao_tcrs",
  "oficinas",
];
const CAMPOS_TEXTOS = ["gostou_mais", "sugestoes_melhoria", "comentarios_finais"];

// mapeia respostas textuais → nota 1..5
function toScore(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  const num = Number(s.replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;
  const map = {
    "ótimo": 5, otimo: 5, excelente: 5, "muito bom": 5,
    bom: 4,
    regular: 3, médio: 3, medio: 3,
    ruim: 2,
    "péssimo": 1, pessimo: 1, "muito ruim": 1,
  };
  if (map[s] != null) return map[s];
  return null;
}
function media(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Number(m.toFixed(2));
}

/* ------------------------- Header/Hero ------------------------- */
function HeaderHero({ onRefresh, carregando, nome = "" }) {
  const gradient = "from-indigo-900 via-violet-800 to-fuchsia-700"; // 3 cores fixas desta página
  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2">
        Ir para o conteúdo
      </a>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <BarChart3 className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Avaliação do Instrutor</h1>
        </div>
        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}Veja, por evento, médias, distribuição e comentários recebidos.
        </p>
        <BotaoPrimario
          onClick={onRefresh}
          disabled={carregando}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" />}
          aria-label="Atualizar avaliações do instrutor"
        >
          {carregando ? "Atualizando…" : "Atualizar"}
        </BotaoPrimario>
      </div>
    </header>
  );
}

/* --------------------------- Página --------------------------- */
export default function AvaliacaoInstrutor() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState([]);          // [{id,titulo,turmas[],di,df}]
  const [eventoId, setEventoId] = useState("");
  const [cacheAval, setCacheAval] = useState({});      // eventoId -> {respostas, agregados}
  const liveRef = useRef(null);

  const usuario = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; }
  }, []);
  const nome = usuario?.nome || "";

  // atalhos de teclado
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const editing = ["input","textarea","select"].includes(tag);
      if (!editing && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (eventoId) {
          setCacheAval((p) => {
            const cp = { ...p };
            delete cp[String(eventoId)];
            return cp;
          });
          carregarAvaliacoesDoEvento(eventoId);
        } else {
          carregarEventos();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  useEffect(() => {
    document.title = "Avaliação do Instrutor | Escola da Saúde";
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  async function carregarEventos() {
    const g = log.group("Carregar eventos/turmas do instrutor");
    const t = log.time("⏱ eventos");
    try {
      setCarregando(true);
      setErro("");
      setLive("Carregando seus eventos…");

      const turmas = await apiGet("/api/instrutor/minhas/turmas", { on401: "silent", on403: "silent" });
      const arr = Array.isArray(turmas) ? turmas : [];

      // agrupa por evento
      const byEvento = new Map();
      for (const turma of arr) {
        const e = turma?.evento || { id: turma?.evento_id, nome: turma?.evento_nome || turma?.evento_titulo };
        if (!e?.id) continue;
        const k = String(e.id);
        if (!byEvento.has(k)) {
          byEvento.set(k, {
            id: e.id,
            titulo: e.nome || e.titulo || "Evento",
            turmas: [],
            di: turma.data_inicio,
            df: turma.data_fim,
          });
        }
        const slot = byEvento.get(k);
        slot.turmas.push({
          id: turma.id,
          nome: turma.nome,
          data_inicio: turma.data_inicio,
          data_fim: turma.data_fim,
        });
        // strings ISO: comparar sem criar Date (evita fuso)
        if (!slot.di || (turma.data_inicio && String(turma.data_inicio) < String(slot.di))) slot.di = turma.data_inicio;
        if (!slot.df || (turma.data_fim    && String(turma.data_fim)    > String(slot.df))) slot.df = turma.data_fim;
      }

      // ordena por início desc sem Date()
      const lista = Array.from(byEvento.values())
        .sort((a, b) => String(b.di || "") .localeCompare(String(a.di || "")));

      setEventos(lista);
      if (!lista.length) {
        setErro("Você não possui eventos vinculados como instrutor.");
      } else {
        setEventoId(String(lista[0].id));
      }
      setLive("Eventos atualizados.");
    } catch (e) {
      log.error("Erro ao carregar eventos:", e);
      setErro("Erro ao carregar seus eventos.");
      toast.error("❌ Erro ao carregar eventos do instrutor.");
    } finally {
      t.end(); g.end(); setCarregando(false);
    }
  }

  // carrega avaliações de todas as turmas do evento selecionado
  const carregarAvaliacoesDoEvento = useCallback(async (id) => {
    const ev = eventos.find((x) => String(x.id) === String(id));
    if (!ev) {
      log.warn("Evento não encontrado no estado:", id);
      return { respostas: [] };
    }

    const g = log.group(`Carregar avaliações do evento ${ev.titulo} (#${ev.id})`);
    const t = log.time("⏱ avaliações");
    try {
      setCarregando(true);
      setLive("Carregando avaliações…");

      const respostas = [];
      await Promise.all(
        (ev.turmas || []).map(async (t) => {
          try {
            const resp = await apiGet(`/api/avaliacoes/turma/${t.id}`, { on401: "silent", on403: "silent" });
            const lista =
              Array.isArray(resp) ? resp :
              Array.isArray(resp?.avaliacoes) ? resp.avaliacoes :
              Array.isArray(resp?.itens) ? resp.itens :
              Array.isArray(resp?.comentarios) ? resp.comentarios : [];
            if (lista.length) respostas.push(...lista.map((item) => ({ ...item, __turmaId: t.id, __turmaNome: t.nome })));
          } catch (e) {
            log.warn(`Falha ao buscar turma #${t.id} (${t.nome})`, e);
          }
        })
      );

      const agregados = agregarRespostas(respostas);
      const payload = { respostas, agregados };
      setCacheAval((prev) => ({ ...prev, [String(id)]: payload }));
      setLive("Avaliações carregadas.");
      return payload;
    } finally {
      t.end(); g.end(); setCarregando(false);
    }
  }, [eventos]);

  // agrega campos objetivos e textos
  function agregarRespostas(respostas) {
    const dist = {}; // campo -> {1: n,2:n,...,5:n}
    const medias = {}; // campo -> média 1..5
    const total = respostas.length;

    CAMPOS_OBJETIVOS.forEach((c) => { dist[c] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }; });

    for (const r of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const s = toScore(r[campo]);
        if (s != null) {
          const k = String(Math.round(s));
          dist[campo][k] = (dist[campo][k] || 0) + 1;
        }
      }
    }

    for (const campo of CAMPOS_OBJETIVOS) {
      const linha = dist[campo];
      const expanded = [
        ...Array(linha[1]).fill(1),
        ...Array(linha[2]).fill(2),
        ...Array(linha[3]).fill(3),
        ...Array(linha[4]).fill(4),
        ...Array(linha[5]).fill(5),
      ];
      medias[campo] = media(expanded);
    }

    const textos = {};
    for (const c of CAMPOS_TEXTOS) {
      textos[c] = respostas
        .map((r) => (r[c] ?? r[c]?.texto ?? r[c]?.comentario))
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim());
    }

    const estrelaMedia = medias.desempenho_instrutor ?? null;
    return { total, dist, medias, textos, estrelaMedia };
  }

  // derivado: dados do evento atual + avaliações (com cache)
  const eventoAtual = useMemo(() => eventos.find((e) => String(e.id) === String(eventoId)), [eventos, eventoId]);
  const avalAtual = cacheAval[String(eventoId)];

  useEffect(() => {
    if (!eventoId) return;
    if (cacheAval[String(eventoId)]) {
      log.info("Cache HIT para evento", eventoId);
      return;
    }
    log.info("Evento selecionado:", eventoId, "→ carregando avaliações…");
    carregarAvaliacoesDoEvento(eventoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  /* --------------------------- Export CSV --------------------------- */
  function exportarCSV() {
    if (!eventoAtual || !avalAtual) return;
    const { agregados, respostas } = avalAtual;

    const linhas = [];
    // cabeçalho
    linhas.push(["Evento", "Período", "Total respostas"].join(";"));
    const periodo = (eventoAtual.di || eventoAtual.df)
      ? `${formatarDataBrasileira(eventoAtual.di)} — ${formatarDataBrasileira(eventoAtual.df)}`
      : "—";
    linhas.push([limparCSV(eventoAtual.titulo), limparCSV(periodo), agregados?.total ?? 0].join(";"));
    linhas.push("");

    // Médias
    linhas.push(["Médias por critério"].join(";"));
    linhas.push(["Critério","Média (1..5)","★1","★2","★3","★4","★5"].join(";"));
    for (const c of CAMPOS_OBJETIVOS) {
      const nome = labelDoCampo(c);
      const m = agregados?.medias?.[c] ?? "";
      const d = agregados?.dist?.[c] || {1:0,2:0,3:0,4:0,5:0};
      linhas.push([limparCSV(nome), m, d[1]||0, d[2]||0, d[3]||0, d[4]||0, d[5]||0].join(";"));
    }
    linhas.push("");

    // Comentários
    linhas.push(["Comentários qualitativos"].join(";"));
    for (const campo of CAMPOS_TEXTOS) {
      const nome = labelDoCampo(campo);
      linhas.push([limparCSV(nome)].join(";"));
      const lista = agregados?.textos?.[campo] || [];
      if (!lista.length) {
        linhas.push(["(Sem comentários)"].join(";"));
      } else {
        for (const t of lista) {
          linhas.push([limparCSV(t)].join(";"));
        }
      }
      linhas.push("");
    }

    // Respostas (cruas) por turma — opcional: mostra turma_id se existir
    if (Array.isArray(respostas) && respostas.length) {
      const cols = ["__turmaId","__turmaNome", ...CAMPOS_OBJETIVOS, ...CAMPOS_TEXTOS];
      linhas.push(["Dados brutos (por resposta)"].join(";"));
      linhas.push(cols.join(";"));
      for (const r of respostas) {
        linhas.push(cols.map((k) => limparCSV(r[k] ?? "")).join(";"));
      }
    }

    const csv = linhas.join("\r\n");
    baixarArquivo(`avaliacoes_evento_${eventoAtual.id}.csv`, csv, "text/csv;charset=utf-8");
    toast.success("CSV gerado com sucesso.");
  }
  const limparCSV = (s) => String(s).replaceAll(/[\r\n]+/g, " ").replaceAll(/;/g, ",");
  function baixarArquivo(nome, conteudo, mime) {
    const blob = new Blob([conteudo], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero
        onRefresh={() => {
          log.info("Atualizar manual → invalidando cache do evento", eventoId);
          setCacheAval((p) => {
            const cp = { ...p };
            delete cp[String(eventoId)];
            return cp;
          });
          if (eventoId) carregarAvaliacoesDoEvento(eventoId);
          else carregarEventos();
        }}
        carregando={carregando}
        nome={nome}
      />

      <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Seletor de evento + ações */}
        <section className="mb-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <label htmlFor="sel-evento" className="block text-sm mb-1 text-slate-700 dark:text-slate-200">
                Selecione o evento
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="sel-evento"
                  value={eventoId}
                  onChange={(e) => setEventoId(e.target.value)}
                  className="p-2 rounded-xl border border-slate-300 bg-white dark:bg-zinc-800 dark:text-white min-w-[260px] focus:outline-none focus:ring-2 focus:ring-violet-500/70"
                  aria-label="Selecionar evento"
                >
                  {eventos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.titulo} {e.di ? `• ${formatarDataBrasileira(e.di)}` : ""}{e.df ? ` a ${formatarDataBrasileira(e.df)}` : ""}
                    </option>
                  ))}
                  {!eventos.length && <option value="">Nenhum evento encontrado</option>}
                </select>
                {eventoAtual && (
                  <span className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1">
                    <School className="inline w-4 h-4" aria-hidden="true" /> {eventoAtual.turmas?.length || 0} turma(s)
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <BotaoPrimario
                onClick={exportarCSV}
                disabled={!eventoAtual || !avalAtual}
                variante="secundario"
                icone={<Download className="w-4 h-4" />}
                aria-label="Exportar CSV do evento"
              >
                Exportar CSV
              </BotaoPrimario>
            </div>
          </div>
        </section>

        {/* Estado geral */}
        {carregando ? (
          <div className="space-y-4">
            <Skeleton height={90} />
            <Skeleton height={180} count={2} />
          </div>
        ) : erro ? (
          <NadaEncontrado mensagem={erro} />
        ) : !eventoAtual ? (
          <NadaEncontrado mensagem="Nenhum evento encontrado." />
        ) : !avalAtual ? (
          <NadaEncontrado mensagem="Sem avaliações para este evento (ainda)." />
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-8">
            {/* Ministats */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI titulo="Total de Respostas" valor={avalAtual.agregados?.total || 0} icon={ClipboardList} />
              <KPI
                titulo="Desempenho do Instrutor"
                valor={avalAtual.agregados?.estrelaMedia != null ? `${avalAtual.agregados.estrelaMedia.toFixed(2)} / 5 ⭐` : "—"}
                icon={BarChart3}
              />
              <KPI
                titulo="Período"
                valor={
                  eventoAtual.di || eventoAtual.df
                    ? `${formatarDataBrasileira(eventoAtual.di)} — ${formatarDataBrasileira(eventoAtual.df)}`
                    : "—"
                }
                icon={CalendarRange}
              />
              <KPI
                titulo="Turmas avaliadas"
                valor={eventoAtual.turmas?.length || 0}
                icon={School}
              />
            </section>

            {/* Objetivos: grelha com barras simples */}
            <section>
              <h2 className="text-base font-semibold mb-3">Médias por critério (1–5)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CAMPOS_OBJETIVOS.map((c) => (
                  <CampoBarra
                    key={c}
                    nome={labelDoCampo(c)}
                    media={avalAtual.agregados?.medias?.[c]}
                    dist={avalAtual.agregados?.dist?.[c]}
                  />
                ))}
              </div>
            </section>

            {/* Textos qualitativos */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <QuadroComentarios titulo="O que mais gostou" itens={avalAtual.agregados?.textos?.gostou_mais} />
              <QuadroComentarios titulo="Sugestões de melhoria" itens={avalAtual.agregados?.textos?.sugestoes_melhoria} />
              <QuadroComentarios titulo="Comentários finais" itens={avalAtual.agregados?.textos?.comentarios_finais} />
            </section>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/* --------------------------- UI helpers --------------------------- */
function KPI({ titulo, valor, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 text-center border border-slate-100 dark:border-zinc-700">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white inline-flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5" aria-hidden="true" />} {valor}
      </p>
    </div>
  );
}

function CampoBarra({ nome, media, dist }) {
  const pct = media != null ? (media / 5) * 100 : 0;
  const linha = dist || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border border-slate-100 dark:border-zinc-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{nome}</p>
        <p className="text-sm font-semibold">{media != null ? media.toFixed(2) : "—"} / 5</p>
      </div>
      <div
        className="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden"
        role="img"
        aria-label={`Média ${nome}: ${media != null ? media.toFixed(2) : "não disponível"} de 5`}
      >
        <div className="h-2 bg-emerald-600 dark:bg-emerald-500" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
        5★ {linha[5] ?? 0} • 4★ {linha[4] ?? 0} • 3★ {linha[3] ?? 0} • 2★ {linha[2] ?? 0} • 1★ {linha[1] ?? 0}
      </p>
    </div>
  );
}

function QuadroComentarios({ titulo, itens }) {
  const lista = Array.isArray(itens) ? itens : [];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border border-slate-100 dark:border-zinc-700">
      <h3 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
        <MessageSquare className="w-4 h-4" aria-hidden="true" /> {titulo}
      </h3>
      {lista.length ? (
        <ul className="space-y-2 text-sm">
          {lista.map((t, i) => (
            <li key={i} className="bg-gray-50 dark:bg-gray-700/40 rounded p-2">
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sem comentários.</p>
      )}
    </div>
  );
}

function labelDoCampo(c) {
  return (
    {
      divulgacao_evento: "Divulgação do evento",
      recepcao: "Recepção",
      credenciamento: "Credenciamento",
      material_apoio: "Material de apoio",
      pontualidade: "Pontualidade",
      sinalizacao_local: "Sinalização do local",
      conteudo_temas: "Conteúdo/temas",
      desempenho_instrutor: "Desempenho do instrutor",
      estrutura_local: "Estrutura do local",
      acessibilidade: "Acessibilidade",
      limpeza: "Limpeza",
      inscricao_online: "Inscrição on-line",
      exposicao_trabalhos: "Exposição de trabalhos",
      apresentacao_oral_mostra: "Apresentação oral/mostra",
      apresentacao_tcrs: "Apresentação TCRs",
      oficinas: "Oficinas",
      gostou_mais: "O que mais gostou",
      sugestoes_melhoria: "Sugestões de melhoria",
      comentarios_finais: "Comentários finais",
    }[c] || c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}
