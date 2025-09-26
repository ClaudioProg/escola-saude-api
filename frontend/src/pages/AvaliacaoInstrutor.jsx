// ✅ src/pages/AvaliacaoInstrutor.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  BarChart3, ClipboardList, MessageSquare, School, RefreshCw,
} from "lucide-react";

import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet } from "../services/api";
import { formatarDataBrasileira } from "../utils/data";

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

const CAMPOS_TEXTOS = [
  "gostou_mais",
  "sugestoes_melhoria",
  "comentarios_finais",
];

// mapeia respostas textuais → nota 1..5
function toScore(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  // números diretos
  const num = Number(s.replace(",", "."));
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;

  // textos comuns
  const map = {
    "ótimo": 5, "otimo": 5, "excelente": 5, "muito bom": 5,
    "bom": 4,
    "regular": 3, "médio": 3, "medio": 3,
    "ruim": 2,
    "péssimo": 1, "pessimo": 1, "muito ruim": 1,
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
function HeaderHero({ onRefresh, carregando }) {
  return (
    <header className="bg-gradient-to-br from-indigo-900 via-violet-800 to-fuchsia-700 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Avaliação do Instrutor
          </h1>
        </div>
        <p className="text-sm text-white/90">
          Veja, por evento, as avaliações recebidas (médias, distribuição e comentários).
        </p>
        <button
          onClick={onRefresh}
          disabled={carregando}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition
            ${carregando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
        >
          <RefreshCw className="w-4 h-4" />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
    </header>
  );
}

/* --------------------------- Página --------------------------- */
export default function AvaliacaoInstrutor() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [eventos, setEventos] = useState([]); // [{evento:{id,titulo}, turmas:[...] , periodo}]
  const [eventoId, setEventoId] = useState("");
  const [cacheAval, setCacheAval] = useState({}); // eventoId -> {respostas, agregados}
  const liveRef = useRef(null);

  const usuario = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("usuario") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    document.title = "Avaliação do Instrutor | Escola da Saúde";
    carregarEventos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarEventos() {
    try {
      setCarregando(true);
      setErro("");
      if (liveRef.current) liveRef.current.textContent = "Carregando seus eventos…";

      // suas turmas com evento
      const turmas = await apiGet("/api/instrutor/minhas/turmas");
      const arr = Array.isArray(turmas) ? turmas : [];

      // agrupa por evento
      const byEvento = new Map();
      for (const t of arr) {
        const e = t?.evento || { id: t?.evento_id, nome: t?.evento_nome || t?.evento_titulo };
        if (!e?.id) continue;
        const k = String(e.id);
        if (!byEvento.has(k)) {
          byEvento.set(k, {
            id: e.id,
            titulo: e.nome || e.titulo || "Evento",
            turmas: [],
            di: t.data_inicio, df: t.data_fim,
          });
        }
        const slot = byEvento.get(k);
        slot.turmas.push({
          id: t.id, nome: t.nome,
          data_inicio: t.data_inicio, data_fim: t.data_fim,
        });
        // período agreg.
        slot.di = !slot.di || (t.data_inicio && t.data_inicio < slot.di) ? t.data_inicio : slot.di;
        slot.df = !slot.df || (t.data_fim && t.data_fim > slot.df) ? t.data_fim : slot.df;
      }

      const lista = Array.from(byEvento.values()).sort(
        (a, b) => new Date(b.di || 0) - new Date(a.di || 0)
      );

      setEventos(lista);
      if (!lista.length) {
        setErro("Você não possui eventos vinculados como instrutor.");
      } else {
        setEventoId(String(lista[0].id));
      }
      if (liveRef.current) liveRef.current.textContent = "Eventos atualizados.";
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar seus eventos.");
      toast.error("❌ Erro ao carregar eventos do instrutor.");
    } finally {
      setCarregando(false);
    }
  }

  // carrega avaliações de todas as turmas do evento selecionado
  async function carregarAvaliacoesDoEvento(id) {
    const ev = eventos.find((x) => String(x.id) === String(id));
    if (!ev) return { respostas: [] };

    try {
      setCarregando(true);
      if (liveRef.current) liveRef.current.textContent = "Carregando avaliações…";

      const respostas = [];
      // busca paralela das turmas
      await Promise.all(
        (ev.turmas || []).map(async (t) => {
          try {
            const r = await apiGet(`/avaliacoes/turma/${t.id}`, { on403: "silent" });
            const lista =
              Array.isArray(r) ? r :
              Array.isArray(r?.avaliacoes) ? r.avaliacoes :
              Array.isArray(r?.itens) ? r.itens :
              Array.isArray(r?.comentarios) ? r.comentarios : [];
            // anexa metadados da turma
            lista.forEach((item) => respostas.push({ ...item, __turmaId: t.id, __turmaNome: t.nome }));
          } catch {
            // ignora turma sem avaliações
          }
        })
      );

      const agregados = agregarRespostas(respostas);
      const payload = { respostas, agregados };
      setCacheAval((prev) => ({ ...prev, [String(id)]: payload }));
      if (liveRef.current) liveRef.current.textContent = "Avaliações carregadas.";
      return payload;
    } finally {
      setCarregando(false);
    }
  }

  // agrega campos objetivos e textos
  function agregarRespostas(respostas) {
    const dist = {};  // campo -> {1: n,2:n,...,5:n}
    const medias = {}; // campo -> média 1..5
    const total = respostas.length;

    CAMPOS_OBJETIVOS.forEach((c) => { dist[c] = { 1:0, 2:0, 3:0, 4:0, 5:0 }; });

    for (const r of respostas) {
      for (const campo of CAMPOS_OBJETIVOS) {
        const v = r[campo];
        const s = toScore(v);
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

    // métrica destaque (desempenho_instrutor)
    const estrelaMedia = medias.desempenho_instrutor ?? null;

    return { total, dist, medias, textos, estrelaMedia };
  }

  // derivado: dados do evento atual + avaliações (com cache)
  const eventoAtual = useMemo(
    () => eventos.find((e) => String(e.id) === String(eventoId)),
    [eventos, eventoId]
  );
  const avalAtual = cacheAval[String(eventoId)];

  useEffect(() => {
    if (!eventoId) return;
    if (cacheAval[String(eventoId)]) return;
    carregarAvaliacoesDoEvento(eventoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  /* ----------------------------- UI ----------------------------- */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      <HeaderHero onRefresh={() => {
        setCacheAval((p) => {
          const cp = { ...p }; delete cp[String(eventoId)]; return cp;
        });
        if (eventoId) carregarAvaliacoesDoEvento(eventoId);
      }} carregando={carregando} />

      <main className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* Seletor de evento */}
        <section className="mb-4">
          <label htmlFor="sel-evento" className="block text-sm mb-1 text-slate-700 dark:text-slate-200">
            Selecione o evento
          </label>
          <div className="flex items-center gap-2">
            <select
              id="sel-evento"
              value={eventoId}
              onChange={(e) => setEventoId(e.target.value)}
              className="p-2 rounded border dark:bg-zinc-800 dark:text-white min-w-[260px]"
            >
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo} {e.di ? `• ${formatarDataBrasileira(e.di)}` : ""}{e.df ? ` a ${formatarDataBrasileira(e.df)}` : ""}
                </option>
              ))}
            </select>
            {eventoAtual && (
              <span className="text-xs text-gray-600 dark:text-gray-300">
                <School className="inline w-4 h-4 mr-1" /> {eventoAtual.turmas?.length || 0} turma(s)
              </span>
            )}
          </div>
        </section>

        {/* Conteúdo */}
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-8"
          >
            {/* KPIs */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI titulo="Total de Respostas" valor={avalAtual.total || 0} icon={ClipboardList} />
              <KPI
                titulo="Desempenho do Instrutor (média)"
                valor={avalAtual.estrelaMedia != null ? `${avalAtual.estrelaMedia.toFixed(2)} / 5 ⭐` : "—"}
                icon={BarChart3}
              />
              <KPI
                titulo="Período"
                valor={
                  eventoAtual.di || eventoAtual.df
                    ? `${formatarDataBrasileira(eventoAtual.di)} — ${formatarDataBrasileira(eventoAtual.df)}`
                    : "—"
                }
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
                    media={avalAtual.medias?.[c]}
                    dist={avalAtual.dist?.[c]}
                  />
                ))}
              </div>
            </section>

            {/* Textos qualitativos */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <QuadroComentarios titulo="O que mais gostou" itens={avalAtual.textos?.gostou_mais} />
              <QuadroComentarios titulo="Sugestões de melhoria" itens={avalAtual.textos?.sugestoes_melhoria} />
              <QuadroComentarios titulo="Comentários finais" itens={avalAtual.textos?.comentarios_finais} />
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 text-center">
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white inline-flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5" />} {valor}
      </p>
    </div>
  );
}

function CampoBarra({ nome, media, dist }) {
  const pct = media != null ? (media / 5) * 100 : 0;
  const linha = dist || { 1:0,2:0,3:0,4:0,5:0 };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium">{nome}</p>
        <p className="text-sm font-semibold">{media != null ? media.toFixed(2) : "—"} / 5</p>
      </div>
      <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-2 bg-emerald-600 dark:bg-emerald-500"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <h3 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
        <MessageSquare className="w-4 h-4" /> {titulo}
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
  return {
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
  }[c] || c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
