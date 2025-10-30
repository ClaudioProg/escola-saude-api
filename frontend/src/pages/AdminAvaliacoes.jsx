// ✅ src/pages/AdminAvaliacoes.jsx
/* Página de Avaliações (Admin) — layout e UX espelhados no AvaliacaoInstrutor.jsx,
   com paleta exclusiva desta tela, seletor de evento, KPIs, grelha de barras e
   comentários qualitativos. */
   import { useEffect, useMemo, useRef, useState } from "react";
   import Skeleton from "react-loading-skeleton";
   import { motion } from "framer-motion";
   import { toast } from "react-toastify";
   import {
     BarChart3,
     ClipboardList,
     MessageSquare,
     School,
     RefreshCw,
     Users,
   } from "lucide-react";
   
   import Footer from "../components/Footer";
   import NadaEncontrado from "../components/NadaEncontrado";
   import { apiGet } from "../services/api";
   import { formatarDataBrasileira } from "../utils/data";
   import BotaoPrimario from "../components/BotaoPrimario";
   
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
   
   /* ── Helpers iguais aos do Instrutor ─────────────────────────── */
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
   function agregarRespostas(respostas) {
     const dist = {};
     const medias = {};
     const total = respostas.length;
   
     CAMPOS_OBJETIVOS.forEach((c) => (dist[c] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }));
   
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
     return { total, dist, medias, textos };
   }
   
   /* ------------------------- Header/Hero ------------------------- */
   /* Regra visual: 3 cores fixas (exclusivas desta tela) + ícone/título na mesma linha */
   function HeaderHero({ onRefresh, carregando }) {
     const gradient = "from-emerald-900 via-teal-800 to-sky-700"; // paleta desta página
   
     return (
       <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
         <a
           href="#conteudo"
           className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
         >
           Ir para o conteúdo
         </a>
         <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
           <div className="inline-flex items-center gap-2">
             <BarChart3 className="w-5 h-5" aria-hidden="true" />
             <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Avaliações — Administração</h1>
           </div>
           <p className="text-sm text-white/90">
             Selecione um evento para ver médias por critério, distribuição de notas, comentários e turmas.
           </p>
           <BotaoPrimario
             onClick={onRefresh}
             disabled={carregando}
             variante="secundario"
             icone={<RefreshCw className="w-4 h-4" />}
             aria-label="Atualizar dados de avaliações (admin)"
           >
             {carregando ? "Atualizando…" : "Atualizar"}
           </BotaoPrimario>
         </div>
       </header>
     );
   }
   
   /* --------------------------- Página --------------------------- */
   export default function AdminAvaliacoes() {
     const [carregando, setCarregando] = useState(true);
     const [erro, setErro] = useState("");
     const [eventos, setEventos] = useState([]); // [{id,titulo,di,df,total_respostas}]
     const [eventoId, setEventoId] = useState("");
     const [payload, setPayload] = useState(null); // {respostas, agregados, turmas}
     const liveRef = useRef(null);
   
     useEffect(() => {
       document.title = "Avaliações (Admin) | Escola da Saúde";
       carregarEventos();
     }, []);
   
     async function carregarEventos() {
       try {
         setCarregando(true);
         setErro("");
         setPayload(null);
         if (liveRef.current) liveRef.current.textContent = "Carregando eventos com avaliações…";
   
         const lista = await apiGet("/api/admin/avaliacoes/eventos", { on401: "silent", on403: "silent" });
         const arr = Array.isArray(lista) ? lista : [];
         setEventos(arr);
         if (!arr.length) {
           setErro("Não há eventos com avaliações registradas.");
         } else {
           setEventoId(String(arr[0].id));
         }
       } catch (e) {
         setErro("Erro ao carregar eventos.");
         toast.error("❌ Erro ao carregar eventos com avaliações.");
       } finally {
         setCarregando(false);
         if (liveRef.current) liveRef.current.textContent = "Eventos atualizados.";
       }
     }
   
     // Detalhe + Fallback para turmas (agregação no cliente)
     async function carregarEvento(evento_id) {
       if (!evento_id) return;
       try {
         setCarregando(true);
         setErro("");
         if (liveRef.current) liveRef.current.textContent = "Carregando avaliações do evento…";
   
         // 1) tenta o endpoint do ADMIN (fonte preferencial)
         const resp = await apiGet(`/api/admin/avaliacoes/evento/${evento_id}`, { on401: "silent", on403: "silent" });
   
         // Se já vier com total > 0, usa direto
         if (resp?.agregados?.total > 0) {
           setPayload(resp);
           return;
         }
   
         // 2) Fallback: se veio sem respostas, mas há turmas, agrega via /api/avaliacoes/turma/:id
         const turmas = Array.isArray(resp?.turmas) ? resp.turmas : [];
         if (turmas.length > 0) {
           const respostas = [];
           await Promise.all(
             turmas.map(async (t) => {
               try {
                 const r = await apiGet(`/api/avaliacoes/turma/${t.id}`, { on401: "silent", on403: "silent" });
                 const lista =
                   Array.isArray(r) ? r :
                   Array.isArray(r?.avaliacoes) ? r.avaliacoes :
                   Array.isArray(r?.itens) ? r.itens :
                   Array.isArray(r?.comentarios) ? r.comentarios : [];
                 if (lista.length) {
                   respostas.push(...lista.map((it) => ({ ...it, __turmaId: t.id, __turmaNome: t.nome })));
                 }
               } catch {
                 /* ignora erro individual de turma */
               }
             })
           );
   
           const agregados = agregarRespostas(respostas);
           const payloadComFallback = {
             respostas,
             agregados: {
               ...agregados,
               // mantém a média oficial vinda do backend se ele já calcular isso
               mediaOficial: resp?.agregados?.mediaOficial ?? null,
             },
             turmas: turmas.map((t) => ({
               ...t,
               total_respostas:
                 respostas.filter((r) => String(r.__turmaId) === String(t.id)).length,
             })),
           };
           setPayload(payloadComFallback);
           if (liveRef.current) liveRef.current.textContent = "Avaliações agregadas.";
           return;
         }
   
         // 3) Sem turmas ou sem dados mesmo
         setPayload(resp || { respostas: [], agregados: { total: 0, dist: {}, medias: {}, textos: {} }, turmas: [] });
         if (liveRef.current) liveRef.current.textContent = "Nenhuma resposta.";
       } catch (e) {
         setErro("Erro ao carregar avaliações do evento.");
         toast.error("❌ Erro ao carregar avaliações do evento.");
       } finally {
         setCarregando(false);
       }
     }
   
     // carregar o evento sempre que mudar o id
     useEffect(() => {
       if (!eventoId) return;
       carregarEvento(eventoId);
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, [eventoId]);
   
     const eventoAtual = useMemo(() => eventos.find((e) => String(e.id) === String(eventoId)), [eventos, eventoId]);
   
     return (
       <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
         <HeaderHero
           carregando={carregando}
           onRefresh={() => {
             if (eventoId) carregarEvento(eventoId);
             else carregarEventos();
           }}
         />
   
         <main id="conteudo" className="flex-1 max-w-6xl mx-auto px-3 sm:px-4 py-6">
           <p ref={liveRef} className="sr-only" aria-live="polite" />
   
           {/* Seletor de evento */}
           <section className="mb-4">
             <label htmlFor="sel-evento" className="block text-sm mb-1 text-slate-700 dark:text-slate-200">
               Selecione o evento
             </label>
             <div className="flex flex-wrap items-center gap-2">
               <select
                 id="sel-evento"
                 value={eventoId}
                 onChange={(e) => setEventoId(e.target.value)}
                 className="p-2 rounded border dark:bg-zinc-800 dark:text-white min-w-[260px]"
                 aria-label="Selecionar evento"
               >
                 {eventos.map((e) => (
                   <option key={e.id} value={e.id}>
                     {e.titulo} {e.di ? `• ${formatarDataBrasileira(e.di)}` : ""}{e.df ? ` a ${formatarDataBrasileira(e.df)}` : ""}
                     {typeof e.total_respostas === "number" ? ` • ${e.total_respostas} resp.` : ""}
                   </option>
                 ))}
                 {!eventos.length && <option value="">Nenhum evento encontrado</option>}
               </select>
   
               {eventoAtual && (
                 <span className="text-xs text-gray-600 dark:text-gray-300">
                   <Users className="inline w-4 h-4 mr-1" aria-hidden="true" />
                   {typeof eventoAtual.total_respostas === "number" ? `${eventoAtual.total_respostas} resposta(s) somadas` : "—"}
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
           ) : !payload ? (
             <NadaEncontrado mensagem="Sem avaliações para este evento (ainda)." />
           ) : (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-8">
               {/* KPIs */}
               <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <KPI titulo="Total de Respostas" valor={payload.agregados?.total ?? 0} icon={ClipboardList} />
                 <KPI
                   titulo="Média Oficial (1–5)"
                   valor={
                     payload.agregados?.mediaOficial != null
                       ? `${payload.agregados.mediaOficial.toFixed(2)} / 5`
                       : "—"
                   }
                   icon={BarChart3}
                 />
                 <KPI
                   titulo="Período do Evento"
                   valor={
                     eventoAtual?.di || eventoAtual?.df
                       ? `${formatarDataBrasileira(eventoAtual.di)} — ${formatarDataBrasileira(eventoAtual.df)}`
                       : "—"
                   }
                   icon={School}
                 />
                 <KPI
                   titulo="Turmas no Evento"
                   valor={Array.isArray(payload.turmas) ? payload.turmas.length : 0}
                   icon={Users}
                 />
               </section>
   
               {/* Chips de turmas com contagem */}
               <section aria-label="Turmas do evento" className="flex flex-wrap gap-2">
                 {(payload.turmas || []).map((t) => (
                   <span
                     key={t.id}
                     className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow text-sm"
                   >
                     {t.nome}
                     <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                       {t.total_respostas ?? 0}
                     </span>
                   </span>
                 ))}
                 {!payload.turmas?.length && <span className="text-sm text-gray-500">Sem turmas.</span>}
               </section>
   
               {/* Objetivos: grelha com barras simples */}
               <section>
                 <h2 className="text-base font-semibold mb-3">Médias por critério (1–5)</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {CAMPOS_OBJETIVOS.map((c) => (
                     <CampoBarra
                       key={c}
                       nome={labelDoCampo(c)}
                       media={payload.agregados?.medias?.[c]}
                       dist={payload.agregados?.dist?.[c]}
                     />
                   ))}
                 </div>
               </section>
   
               {/* Textos qualitativos */}
               <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                 <QuadroComentarios titulo="O que mais gostaram" itens={payload.agregados?.textos?.gostou_mais} />
                 <QuadroComentarios titulo="Sugestões de melhoria" itens={payload.agregados?.textos?.sugestoes_melhoria} />
                 <QuadroComentarios titulo="Comentários finais" itens={payload.agregados?.textos?.comentarios_finais} />
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
           {Icon && <Icon className="w-5 h-5" aria-hidden="true" />} {valor}
         </p>
       </div>
     );
   }
   
   function CampoBarra({ nome, media, dist }) {
     const pct = media != null ? (media / 5) * 100 : 0;
     const linha = dist || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   
     return (
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3">
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
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
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
       }[c] || c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
     );
   }
   