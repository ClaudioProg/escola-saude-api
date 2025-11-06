// src/components/ModalDetalhesSubmissao.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, Upload, Paperclip } from "lucide-react";
import api, { apiGetFile, downloadBlob } from "../services/api";

/* helpers locais (iguais aos da página) */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 2) => Number(v ?? 0).toFixed(d);
function fmtDateTimeBR(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
const hasAnexoRaw = (s) => {
  const c = [
    s?.poster_nome,s?.posterNome,s?.poster_arquivo_nome,s?.nome_poster,s?.poster,
    s?.banner_nome,s?.bannerNome,s?.banner_arquivo_nome,s?.nome_banner,s?.banner,
    s?.has_poster,s?.tem_poster,s?.poster_enviado,s?.possui_poster,
    s?.has_banner,s?.tem_banner,s?.banner_enviado,s?.possui_banner,
    s?.has_anexo,s?.tem_anexo,s?.possui_anexo,s?.anexos,s?.arquivos,
  ];
  return c.some((v)=> !!v && String(v).trim() !== "" && String(v).toLowerCase()!=="false" && String(v)!=="0");
};

/* badge simples */
function StatusBadge({ status }) {
  const st = String(status || "").toLowerCase();
  const base = "px-2 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 justify-center";
  if (st === "rascunho") return <span className={`${base} bg-zinc-100 text-zinc-700`}>Rascunho</span>;
  if (st === "submetido") return <span className={`${base} bg-blue-100 text-blue-700`}>Submetido</span>;
  if (st === "em_avaliacao") return <span className={`${base} bg-amber-100 text-amber-700`}>Em avaliação</span>;
  if (["aprovado","aprovado_exposicao","aprovado_oral","aprovado_escrita"].includes(st))
    return <span className={`${base} bg-emerald-100 text-emerald-700`}>Aprovado</span>;
  if (st === "reprovado") return <span className={`${base} bg-rose-100 text-rose-700`}>Reprovado</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-700`}>{status ?? "—"}</span>;
}

export default function ModalDetalhesSubmissao({ open, onClose, submissao, onDetectAnexo }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [notaVisivel, setNotaVisivel] = useState(false);
  const [totalGeral, setTotalGeral] = useState(0);
  const [notaDivididaPor4, setNotaDivididaPor4] = useState(0);
  const dialogRef = useRef(null);
  const data = { ...(submissao || {}), ...(full || {}) };

  useEffect(() => {
    if (!open || !submissao?.id) return;
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        // submissão completa (tenta pública, cai no admin se 404)
        let sub;
        try {
          const r = await api.get(`/submissoes/${submissao.id}`, { signal: ac.signal });
          sub = Array.isArray(r) ? r[0] : r?.data ?? r;
        } catch (e) {
          if (e?.status === 404) {
            const r2 = await api.get(`/admin/submissoes/${submissao.id}`, { signal: ac.signal });
            sub = Array.isArray(r2) ? r2[0] : r2?.data ?? r2;
          } else throw e;
        }
        setFull(sub || {});
        if (hasAnexoRaw(sub)) onDetectAnexo?.(submissao.id, true);

        // notas
        try {
          const nr = await api.get(`/admin/submissoes/${submissao.id}/avaliacoes`, { signal: ac.signal });
          const payload = nr?.data || {};
          const itens = Array.isArray(payload.itens) ? payload.itens : [];
          const normalizados = itens.map((it) => {
            const nome = it.avaliador_nome ?? it.nome ?? `#${it.avaliador_id ?? ""}`;
            const notas = Array.isArray(it.notas)
              ? it.notas
              : [it.criterio1, it.criterio2, it.criterio3, it.criterio4].map((n) => Number(n || 0));
            const total = Number.isFinite(it.total_do_avaliador)
              ? it.total_do_avaliador
              : notas.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
            return { nome, notas, total };
          });
          setAvaliacoes(normalizados);
          setNotaVisivel(!!payload.nota_visivel);
          setTotalGeral(Number(payload.total_geral || 0));
          setNotaDivididaPor4(Number(payload.nota_dividida_por_4 || 0));
        } catch {/* sem notas ok */}
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, submissao?.id]);

  const totalObtido = useMemo(() => totalGeral || (avaliacoes || []).reduce((a,b)=>a + Number(b.total||0), 0), [avaliacoes, totalGeral]);
  const mediaFinal = useMemo(() => (notaDivididaPor4 > 0 ? notaDivididaPor4 : totalObtido / 4), [notaDivididaPor4, totalObtido]);

  if (!open) return null;

  const posterNome = data.poster_nome || data.posterNome || "";
  const bannerNome = data.banner_nome || data.bannerNome || "";

  const handleBaixarPoster = async () => {
    if (!data?.id) return;
    const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/poster`);
    downloadBlob(filename || posterNome || `poster_${data.id}.pptx`, blob);
  };
  const handleBaixarBanner = async () => {
    if (!data?.id) return;
    const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/banner`);
    downloadBlob(filename || bannerNome || `banner_${data.id}`, blob);
  };
  const toggleVisibilidadeNota = async () => {
    try {
      const novo = !notaVisivel;
      await api.post(`/admin/submissoes/${data.id}/nota-visivel`, { visivel: novo });
      setNotaVisivel(novo);
    } catch {
      alert("Não foi possível alterar a visibilidade da nota.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={dialogRef}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <h3 className="text-lg sm:text-xl font-bold">{fmt(data.titulo)}</h3>
          <p className="text-sm text-zinc-600">ID #{fmt(data.id)} · {fmt(data.chamada_titulo || data.chamada)}</p>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-zinc-600 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            <section className="grid sm:grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Status</p>
                <div className="mt-1"><StatusBadge status={data.status} /></div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Nota (média)</p>
                <p className="text-lg font-semibold">{fmtNum(mediaFinal,1)} / 10</p>
                {avaliacoes?.length > 0 && (
                  <p className="text-xs text-zinc-500 mt-1">Soma dos avaliadores: {totalObtido} / 40</p>
                )}
                {avaliacoes?.length > 0 && (
                  <button onClick={toggleVisibilidadeNota} className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-700 text-white">
                    {notaVisivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {notaVisivel ? "Ocultar do autor" : "Liberar ao autor"}
                  </button>
                )}
              </div>
            </section>

            <section className="grid sm:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">Pôster (PPT/PPTX)</h4>
                {posterNome ? (
                  <p className="text-sm mt-1">
                    <Paperclip className="inline h-4 w-4 mr-1" />
                    <strong>{posterNome}</strong>
                    <button onClick={handleBaixarPoster} className="ml-3 inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-white">
                      <Upload className="h-4 w-4" /> baixar
                    </button>
                  </p>
                ) : <p className="text-sm text-zinc-600 mt-1">—</p>}
              </div>
              <div>
                <h4 className="font-semibold">Banner / outros</h4>
                {bannerNome ? (
                  <p className="text-sm mt-1">
                    <Paperclip className="inline h-4 w-4 mr-1" />
                    <strong>{bannerNome}</strong>
                    <button onClick={handleBaixarBanner} className="ml-3 inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1.5 text-white">
                      <Upload className="h-4 w-4" /> baixar
                    </button>
                  </p>
                ) : <p className="text-sm text-zinc-600 mt-1">—</p>}
              </div>
            </section>

            {/* texto resumido */}
            {["introducao","objetivos","metodo","resultados","consideracoes","bibliografia"].map((k)=>(
              data?.[k] ? (
                <section key={k}>
                  <h4 className="font-semibold capitalize">{k}</h4>
                  <p className="text-sm whitespace-pre-wrap">{fmt(data[k])}</p>
                </section>
              ) : null
            ))}

            {/* notas por avaliador (tabela simples) */}
            {avaliacoes?.length > 0 && (
              <section className="rounded-xl p-4 bg-amber-50/40 dark:bg-zinc-800/50">
                <h4 className="font-semibold">Notas dos avaliadores</h4>
                <div className="overflow-x-auto mt-3">
                  <table className="min-w-full text-sm text-center border border-zinc-200 dark:border-zinc-700">
                    <thead className="bg-amber-100 dark:bg-zinc-700">
                      <tr><th className="p-2">Avaliador</th><th className="p-2">C1</th><th className="p-2">C2</th><th className="p-2">C3</th><th className="p-2">C4</th><th className="p-2">Total</th></tr>
                    </thead>
                    <tbody>
                      {avaliacoes.map((a,i)=>{
                        const [c1=0,c2=0,c3=0,c4=0] = a.notas || [];
                        const tot = Number.isFinite(a.total)? a.total : c1+c2+c3+c4;
                        return (<tr key={i} className="border-t dark:border-zinc-700">
                          <td className="p-2 font-medium">{a.nome}</td>
                          <td className="p-2">{c1}</td><td className="p-2">{c2}</td><td className="p-2">{c3}</td><td className="p-2">{c4}</td>
                          <td className="p-2 font-semibold">{tot}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        )}

        <div className="p-4 sm:p-5 border-t dark:border-zinc-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-amber-700 text-white">Fechar</button>
        </div>
      </motion.div>
    </div>
  );
}
