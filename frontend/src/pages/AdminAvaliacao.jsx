// ✅ src/pages/AdminAvaliacao.jsx — Premium, responsivo, com filtros/ordenação e exportação CSV
/* Página de Avaliações (Admin) — layout e UX premium,
   com paleta exclusiva desta tela, seletor de evento, KPIs,
   grelha de barras, comentários qualitativos e utilidades. */
   import { useEffect, useMemo, useRef, useState, useCallback } from "react";
   import Skeleton from "react-loading-skeleton";
   import { motion } from "framer-motion";
   import { toast } from "react-toastify";
   import {
     BarChart3,
     ClipboardList,
     Download,
     Filter,
     MessageSquare,
     School,
     RefreshCw,
     Users,
     Search,
     ArrowUp01,
     ArrowDown01,
     Info,
   } from "lucide-react";
   
   import Footer from "../components/Footer";
   import NadaEncontrado from "../components/NadaEncontrado";
   import { apiGet } from "../services/api";
   import { formatarDataBrasileira } from "../utils/dateTime";
   import BotaoPrimario from "../components/BotaoPrimario";
   
   /* ----------------------- Campos e Regras ----------------------- */
   // ⚠️ Conforme diretriz de 2025-07-31: apenas estes entram na MÉDIA OFICIAL do evento
   const CAMPOS_OFICIAIS_MEDIA = [
     "divulgacao_evento",
     "recepcao",
     "credenciamento",
     "material_apoio",
     "pontualidade",
     "sinalizacao_local",
     "conteudo_temas",
     "estrutura_local",
     "acessibilidade",
     "limpeza",
     "inscricao_online",
   ];
   
   // Campos objetivos visíveis (inclui opcionais, que podem ser ocultados via filtro)
   const CAMPOS_OBJETIVOS = [
     ...CAMPOS_OFICIAIS_MEDIA,
     "desempenho_instrutor", // exibimos, mas não compõe a média do EVENTO
     "exposicao_trabalhos",
     "apresentacao_oral_mostra",
     "apresentacao_tcrs",
     "oficinas",
   ];
   
   const CAMPOS_TEXTOS = ["gostou_mais", "sugestoes_melhoria", "comentarios_finais"];
   
   /* ── Helpers de nota ─────────────────────────── */
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
   
   /* ── Agregação local (fallback ou enrich) ─────────────────────────── */
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
       textos[c] = (respostas || [])
         .map((r) => (r[c] ?? r[c]?.texto ?? r[c]?.comentario))
         .filter((s) => typeof s === "string" && s.trim().length > 0)
         .map((s) => s.trim());
     }
     return { total, dist, medias, textos };
   }
   
   /* ------------------------- Header/Hero ------------------------- */
   /* Paleta exclusiva desta página (degradê petróleo → violeta → magenta) */
   function HeaderHero({ onRefresh, carregando }) {
     const gradient = "from-slate-900 via-violet-800 to-fuchsia-700";
     return (
       <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
         <a
           href="#conteudo"
           className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
         >
           Ir para o conteúdo
         </a>
         <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-4">
           <div className="inline-flex items-center gap-2">
             <BarChart3 className="w-6 h-6" aria-hidden="true" />
             <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
               Avaliações — Administração
             </h1>
           </div>
           <p className="text-sm sm:text-base text-white/90">
             Selecione um evento e explore médias por critério, distribuição de notas, comentários e turmas.
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
   export default function AdminAvaliacao() {
     const [carregando, setCarregando] = useState(true);
     const [erro, setErro] = useState("");
     const [eventos, setEventos] = useState([]); // [{id,titulo,di,df,total_respostas}]
     const [eventoId, setEventoId] = useState("");
     const [payload, setPayload] = useState(null); // {respostas, agregados, turmas}
     const [somenteOficiais, setSomenteOficiais] = useState(true);
     const [ordenar, setOrdenar] = useState("desc"); // "desc" (maiores primeiro) | "asc"
     const [buscaComentario, setBuscaComentario] = useState("");
     const liveRef = useRef(null);
   
     useEffect(() => {
       document.title = "Avaliações (Admin) | Escola da Saúde";
       carregarEventos();
       // eslint-disable-next-line react-hooks/exhaustive-deps
     }, []);
   
     async function carregarEventos() {
       try {
         setCarregando(true);
         setErro("");
         setPayload(null);
         if (liveRef.current) liveRef.current.textContent = "Carregando eventos com avaliações…";
   
         const lista = await apiGet("/api/admin/avaliacao/eventos", { on401: "silent", on403: "silent" });
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
   
         // 1) Preferencial: endpoint admin já agregador
         const resp = await apiGet(`/api/admin/avaliacao/evento/${evento_id}`, { on401: "silent", on403: "silent" });
   
         if (resp?.agregados?.total > 0) {
           setPayload(resp);
           return;
         }
   
         // 2) Fallback — agrega cliente pelas turmas
         const turmas = Array.isArray(resp?.turmas) ? resp.turmas : [];
         if (turmas.length > 0) {
           const respostas = [];
           await Promise.all(
             turmas.map(async (t) => {
               try {
                 const r = await apiGet(`/api/avaliacao/turma/${t.id}`, { on401: "silent", on403: "silent" });
                 const lista =
                   Array.isArray(r) ? r :
                   Array.isArray(r?.avaliacao) ? r.avaliacao :
                   Array.isArray(r?.itens) ? r.itens :
                   Array.isArray(r?.comentarios) ? r.comentarios : [];
                 if (lista.length) {
                   respostas.push(...lista.map((it) => ({ ...it, __turmaId: t.id, __turmaNome: t.nome })));
                 }
               } catch {
                 /* ignora erro individual */
               }
             })
           );
   
           const agregados = agregarRespostas(respostas);
           const payloadComFallback = {
             respostas,
             agregados: {
               ...agregados,
               mediaOficial: resp?.agregados?.mediaOficial ?? null,
             },
             turmas: turmas.map((t) => ({
               ...t,
               total_respostas: respostas.filter((r) => String(r.__turmaId) === String(t.id)).length,
             })),
           };
           setPayload(payloadComFallback);
           if (liveRef.current) liveRef.current.textContent = "Avaliações agregadas.";
           return;
         }
   
         // 3) Sem dados
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
   
     const eventoAtual = useMemo(
       () => eventos.find((e) => String(e.id) === String(eventoId)),
       [eventos, eventoId]
     );
   
     /* ---------------------------- Dados derivados ---------------------------- */
     const camposVisiveis = useMemo(
       () => (somenteOficiais ? CAMPOS_OFICIAIS_MEDIA : CAMPOS_OBJETIVOS),
       [somenteOficiais]
     );
   
     const mediasOrdenadas = useMemo(() => {
       const m = payload?.agregados?.medias || {};
       const list = camposVisiveis
         .map((c) => ({ campo: c, nome: labelDoCampo(c), media: m[c], dist: payload?.agregados?.dist?.[c] }))
         .filter((x) => x.media != null);
       return list.sort((a, b) => (ordenar === "desc" ? b.media - a.media : a.media - b.media));
     }, [payload, camposVisiveis, ordenar]);
   
     const textosFiltrados = useMemo(() => {
       const filtro = buscaComentario.trim().toLowerCase();
       const pegue = (nome) => {
         const arr = payload?.agregados?.textos?.[nome] || [];
         if (!filtro) return arr;
         return arr.filter((t) => t.toLowerCase().includes(filtro));
       };
       return {
         gostou_mais: pegue("gostou_mais"),
         sugestoes_melhoria: pegue("sugestoes_melhoria"),
         comentarios_finais: pegue("comentarios_finais"),
       };
     }, [payload, buscaComentario]);
   
     /* ---------------------------- Exportação CSV ---------------------------- */
     const exportarCSV = useCallback(() => {
       if (!payload) return;
       try {
         const linhas = [];
         // cabeçalho
         linhas.push(["Campo", "Média", "Qtd★1", "Qtd★2", "Qtd★3", "Qtd★4", "Qtd★5"].join(";"));
         // métricas
         (camposVisiveis || []).forEach((c) => {
           const d = payload?.agregados?.dist?.[c] || {};
           const m = payload?.agregados?.medias?.[c];
           linhas.push([labelDoCampo(c), m ?? "", d[1] ?? 0, d[2] ?? 0, d[3] ?? 0, d[4] ?? 0, d[5] ?? 0].join(";"));
         });
         // separador
         linhas.push("");
         linhas.push("Textos - O que mais gostaram;");
         (payload?.agregados?.textos?.gostou_mais || []).forEach((t) => linhas.push(`"${t.replace(/"/g, '""')}"`));
         linhas.push("");
         linhas.push("Textos - Sugestões de melhoria;");
         (payload?.agregados?.textos?.sugestoes_melhoria || []).forEach((t) => linhas.push(`"${t.replace(/"/g, '""')}"`));
         linhas.push("");
         linhas.push("Textos - Comentários finais;");
         (payload?.agregados?.textos?.comentarios_finais || []).forEach((t) => linhas.push(`"${t.replace(/"/g, '""')}"`));
   
         const csv = "\uFEFF" + linhas.join("\n");
         const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
         const url = URL.createObjectURL(blob);
         const a = document.createElement("a");
         const titulo = (eventoAtual?.titulo || "evento").replace(/[^\p{L}\p{N}\-_ ]/gu, "").replace(/\s+/g, "_");
         a.href = url;
         a.download = `avaliacao_${titulo}.csv`;
         a.click();
         URL.revokeObjectURL(url);
       } catch {
         toast.error("❌ Falha ao exportar CSV.");
       }
     }, [payload, camposVisiveis, eventoAtual]);
   
     /* ---------------------------- Render ---------------------------- */
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
   
           {/* Seletor + Ações */}
           <section className="mb-5">
             <div className="grid gap-3 md:grid-cols-[1fr,auto,auto,auto] items-end">
               <div>
                 <label htmlFor="sel-evento" className="block text-sm mb-1 text-slate-700 dark:text-slate-200">
                   Selecione o evento
                 </label>
                 <select
                   id="sel-evento"
                   value={eventoId}
                   onChange={(e) => setEventoId(e.target.value)}
                   className="p-2 rounded border dark:bg-zinc-800 dark:text-white w-full"
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
               </div>
   
               <div className="flex gap-2">
                 <button
                   type="button"
                   onClick={() => setSomenteOficiais((v) => !v)}
                   className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:bg-zinc-800"
                   title="Alternar: mostrar apenas critérios oficiais (média do evento)"
                 >
                   <Filter className="w-4 h-4" />
                   {somenteOficiais ? "Só oficiais" : "Todos os critérios"}
                 </button>
   
                 <button
                   type="button"
                   onClick={() => setOrdenar((v) => (v === "desc" ? "asc" : "desc"))}
                   className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:bg-zinc-800"
                   title="Ordenar por média"
                 >
                   {ordenar === "desc" ? <ArrowDown01 className="w-4 h-4" /> : <ArrowUp01 className="w-4 h-4" />}
                   {ordenar === "desc" ? "Maiores primeiro" : "Menores primeiro"}
                 </button>
   
                 <button
                   type="button"
                   onClick={exportarCSV}
                   className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm dark:bg-zinc-800"
                   title="Exportar CSV (médias + distribuição + comentários)"
                 >
                   <Download className="w-4 h-4" />
                   Exportar CSV
                 </button>
               </div>
             </div>
   
             {eventoAtual && (
               <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                 <Users className="inline w-4 h-4 mr-1" aria-hidden="true" />
                 {typeof eventoAtual.total_respostas === "number" ? `${eventoAtual.total_respostas} resposta(s) somadas` : "—"}
               </p>
             )}
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
                       ? `${Number(payload.agregados.mediaOficial).toFixed(2)} / 5`
                       : "—"
                   }
                   icon={BarChart3}
                   hint="Calculada apenas com os critérios oficiais definidos institucionalmente."
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
   
               {/* Chips de turmas */}
               <section aria-label="Turmas do evento" className="mt-2">
                 {payload.turmas?.length ? (
                   <ul className="flex flex-wrap gap-2">
                     {payload.turmas.map((t) => (
                       <li
                         key={t.id}
                         className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-full px-3 py-1.5 shadow text-sm"
                         title={`${t.nome} — ${t.total_respostas ?? 0} respostas`}
                       >
                         <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full bg-fuchsia-600 text-white">
                           {t.total_respostas ?? 0}
                         </span>
                         <span className="flex-1 text-left">{t.nome}</span>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <span className="text-sm text-gray-500">Sem turmas.</span>
                 )}
               </section>
   
               {/* Objetivos: grelha com barras simples */}
               <section>
                 <div className="flex items-center justify-between mb-3">
                   <h2 className="text-base font-semibold">Médias por critério (1–5)</h2>
                   <span className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                     <Info className="w-4 h-4" /> Critérios <strong>oficiais</strong> compõem a média do evento.
                   </span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {/* primeiro os que têm média (ordenados), depois os sem dados */}
                   {mediasOrdenadas.map(({ campo, nome, media, dist }) => (
                     <CampoBarra
                       key={campo}
                       nome={nome}
                       media={media}
                       dist={dist}
                       oficial={CAMPOS_OFICIAIS_MEDIA.includes(campo)}
                     />
                   ))}
                   {/* sem média conhecida */}
                   {camposVisiveis
                     .filter((c) => payload?.agregados?.medias?.[c] == null)
                     .map((c) => (
                       <CampoBarra
                         key={c}
                         nome={labelDoCampo(c)}
                         media={null}
                         dist={payload?.agregados?.dist?.[c]}
                         oficial={CAMPOS_OFICIAIS_MEDIA.includes(c)}
                       />
                     ))}
                 </div>
               </section>
   
               {/* Textos qualitativos + busca */}
               <section className="space-y-3">
                 <div className="flex items-center gap-2">
                   <div className="relative flex-1">
                     <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                     <input
                       type="search"
                       className="w-full rounded-lg border bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm"
                       placeholder="Buscar nos comentários (ex.: organização, coffee, som)..."
                       value={buscaComentario}
                       onChange={(e) => setBuscaComentario(e.target.value)}
                       aria-label="Buscar nos comentários"
                     />
                   </div>
                 </div>
   
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                   <QuadroComentarios titulo="O que mais gostaram" itens={textosFiltrados.gostou_mais} />
                   <QuadroComentarios titulo="Sugestões de melhoria" itens={textosFiltrados.sugestoes_melhoria} />
                   <QuadroComentarios titulo="Comentários finais" itens={textosFiltrados.comentarios_finais} />
                 </div>
               </section>
             </motion.div>
           )}
         </main>
   
         <Footer />
       </div>
     );
   }
   
   /* --------------------------- UI helpers --------------------------- */
   function KPI({ titulo, valor, icon: Icon, hint }) {
     return (
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
         <div className="flex items-start justify-between">
           <p className="text-sm text-gray-600 dark:text-gray-300">{titulo}</p>
           {hint ? (
             <span className="text-[10px] text-gray-500 dark:text-gray-400">{hint}</span>
           ) : null}
         </div>
         <p className="mt-1 text-2xl font-bold text-lousa dark:text-white inline-flex items-center gap-2">
           {Icon && <Icon className="w-5 h-5" aria-hidden="true" />} {valor}
         </p>
       </div>
     );
   }
   
   function CampoBarra({ nome, media, dist, oficial = false }) {
     const pct = media != null ? (media / 5) * 100 : 0;
     const linha = dist || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
   
     return (
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-3">
         <div className="flex items-center justify-between mb-2">
           <p className="text-sm font-medium">
             {nome}{" "}
             {oficial && (
               <span className="ml-2 align-middle text-[10px] rounded-full px-2 py-[2px] bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200">
                 Oficial
               </span>
             )}
           </p>
           <p className="text-sm font-semibold">{media != null ? media.toFixed(2) : "—"} / 5</p>
         </div>
         <div
           className="w-full h-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden"
           role="img"
           aria-label={`Média ${nome}: ${media != null ? media.toFixed(2) : "não disponível"} de 5`}
         >
           <div
             className="h-2 bg-fuchsia-600 dark:bg-fuchsia-500"
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
   