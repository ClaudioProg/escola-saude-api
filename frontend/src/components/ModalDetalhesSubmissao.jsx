// ✅ src/components/ModalDetalhesSubmissao.jsx (Premium + ModalBase + date-safe)
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Eye,
  EyeOff,
  Download,
  Paperclip,
  BadgeCheck,
  ShieldAlert,
  Star,
  FileText,
  UserRound,
} from "lucide-react";
import { toast } from "react-toastify";
import ModalBase from "./ModalBase";
import api, { apiGetFile, downloadBlob } from "../services/api";

/* ========================= Helpers (seguros) ========================= */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 2) => Number(v ?? 0).toFixed(d);

/** Date safe:
 * - "YYYY-MM-DD" => dd/mm/yyyy
 * - "YYYY-MM-DDTHH:mm" ou "YYYY-MM-DD HH:mm" => dd/mm/yyyy HH:mm
 * - outros => tenta Date normal
 */
function fmtDateTimeBR(input) {
  if (!input) return "—";
  const s = String(input).trim();

  // date+time (ISO ou "YYYY-MM-DD HH:mm")
  const dt = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  if (dt) return `${dt[3]}/${dt[2]}/${dt[1]} ${dt[4]}:${dt[5]}`;

  // date-only
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[3]}/${d[2]}/${d[1]}`;

  // fallback Date (para timestamps completos)
  const dd = new Date(s);
  if (Number.isNaN(dd.getTime())) return "—";
  const p2 = (n) => String(n).padStart(2, "0");
  return `${p2(dd.getDate())}/${p2(dd.getMonth() + 1)}/${dd.getFullYear()} ${p2(dd.getHours())}:${p2(dd.getMinutes())}`;
}

const hasAnexoRaw = (s) => {
  const c = [
    s?.poster_nome, s?.posterNome, s?.poster_arquivo_nome, s?.nome_poster, s?.poster,
    s?.banner_nome, s?.bannerNome, s?.banner_arquivo_nome, s?.nome_banner, s?.banner,
    s?.has_poster, s?.tem_poster, s?.poster_enviado, s?.possui_poster,
    s?.has_banner, s?.tem_banner, s?.banner_enviado, s?.possui_banner,
    s?.has_anexo, s?.tem_anexo, s?.possui_anexo, s?.anexos, s?.arquivos,
  ];
  return c.some((v) => !!v && String(v).trim() !== "" && String(v).toLowerCase() !== "false" && String(v) !== "0");
};

/* ========================= UI bits ========================= */
function cls(...p) { return p.filter(Boolean).join(" "); }

function StatusBadge({ status }) {
  const st = String(status || "").toLowerCase();
  const base = "px-2.5 py-1 rounded-full text-[11px] font-semibold inline-flex items-center gap-2 justify-center border";

  if (st === "rascunho") return <span className={`${base} bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700`}>Rascunho</span>;
  if (st === "submetido") return <span className={`${base} bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800`}>Submetido</span>;
  if (st === "em_avaliacao") return <span className={`${base} bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/25 dark:text-amber-200 dark:border-amber-800`}>Em avaliação</span>;
  if (["aprovado", "aprovado_exposicao", "aprovado_oral", "aprovado_escrita"].includes(st))
    return <span className={`${base} bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800`}>Aprovado</span>;
  if (st === "reprovado") return <span className={`${base} bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800`}>Reprovado</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700`}>{status ?? "—"}</span>;
}

function MiniStat({ icon: Icon, label, value, tone = "zinc" }) {
  const toneMap = {
    zinc:  "border-zinc-200 dark:border-zinc-800",
    amber: "border-amber-200 dark:border-amber-900/40",
    sky:   "border-sky-200 dark:border-sky-900/40",
    emerald:"border-emerald-200 dark:border-emerald-900/40",
    violet:"border-violet-200 dark:border-violet-900/40",
  };

  return (
    <div className={cls(
      "rounded-2xl border bg-white dark:bg-zinc-900/40 shadow-sm p-3",
      toneMap[tone] || toneMap.zinc
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200">
          <Icon className="w-4.5 h-4.5" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
      </div>
      <div className="text-lg font-extrabold text-zinc-900 dark:text-white">{value}</div>
    </div>
  );
}

/* ========================= Componente ========================= */
export default function ModalDetalhesSubmissao({ open, onClose, submissao, onDetectAnexo }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);

  const [avaliacoes, setAvaliacoes] = useState([]);
  const [notaVisivel, setNotaVisivel] = useState(false);
  const [totalGeral, setTotalGeral] = useState(0);
  const [notaDivididaPor4, setNotaDivididaPor4] = useState(0);

  const [baixandoPoster, setBaixandoPoster] = useState(false);
  const [baixandoBanner, setBaixandoBanner] = useState(false);
  const [togglingNota, setTogglingNota] = useState(false);

  const firstBtnRef = useRef(null);

  const data = useMemo(() => ({ ...(submissao || {}), ...(full || {}) }), [submissao, full]);

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
          if (e?.status === 404 || e?.response?.status === 404) {
            const r2 = await api.get(`/admin/submissoes/${submissao.id}`, { signal: ac.signal });
            sub = Array.isArray(r2) ? r2[0] : r2?.data ?? r2;
          } else {
            throw e;
          }
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
            const notasArr = Array.isArray(it.notas)
              ? it.notas
              : [it.criterio1, it.criterio2, it.criterio3, it.criterio4].map((n) => Number(n || 0));
            const total = Number.isFinite(it.total_do_avaliador)
              ? it.total_do_avaliador
              : notasArr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);

            return { nome, notas: notasArr, total };
          });

          setAvaliacoes(normalizados);
          setNotaVisivel(!!payload.nota_visivel);
          setTotalGeral(Number(payload.total_geral || 0));
          setNotaDivididaPor4(Number(payload.nota_dividida_por_4 || 0));
        } catch {
          // sem notas: ok
          setAvaliacoes([]);
          setNotaVisivel(false);
          setTotalGeral(0);
          setNotaDivididaPor4(0);
        }
      } catch (err) {
        console.error("❌ ModalDetalhesSubmissao:", err);
        toast.error("❌ Não foi possível carregar os detalhes da submissão.");
        setFull(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [open, submissao?.id, onDetectAnexo]);

  const totalObtido = useMemo(
    () => totalGeral || (avaliacoes || []).reduce((a, b) => a + Number(b.total || 0), 0),
    [avaliacoes, totalGeral]
  );

  const mediaFinal = useMemo(
    () => (notaDivididaPor4 > 0 ? notaDivididaPor4 : totalObtido / 4),
    [notaDivididaPor4, totalObtido]
  );

  const posterNome = data.poster_nome || data.posterNome || "";
  const bannerNome = data.banner_nome || data.bannerNome || "";

  const temPoster = !!posterNome;
  const temBanner = !!bannerNome;
  const temAnexo = temPoster || temBanner || hasAnexoRaw(data);

  const handleBaixarPoster = useCallback(async () => {
    if (!data?.id || baixandoPoster) return;
    setBaixandoPoster(true);
    try {
      const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/poster`);
      downloadBlob(filename || posterNome || `poster_${data.id}.pptx`, blob);
      toast.success("✅ Pôster baixado.");
    } catch (e) {
      console.error(e);
      toast.error("❌ Não foi possível baixar o pôster.");
    } finally {
      setBaixandoPoster(false);
    }
  }, [data?.id, posterNome, baixandoPoster]);

  const handleBaixarBanner = useCallback(async () => {
    if (!data?.id || baixandoBanner) return;
    setBaixandoBanner(true);
    try {
      const { blob, filename } = await apiGetFile(`/submissoes/${data.id}/banner`);
      downloadBlob(filename || bannerNome || `banner_${data.id}`, blob);
      toast.success("✅ Anexo baixado.");
    } catch (e) {
      console.error(e);
      toast.error("❌ Não foi possível baixar o anexo.");
    } finally {
      setBaixandoBanner(false);
    }
  }, [data?.id, bannerNome, baixandoBanner]);

  const toggleVisibilidadeNota = useCallback(async () => {
    if (!data?.id || togglingNota) return;
    setTogglingNota(true);
    try {
      const novo = !notaVisivel;
      await api.post(`/admin/submissoes/${data.id}/nota-visivel`, { visivel: novo });
      setNotaVisivel(novo);
      toast.success(novo ? "✅ Nota liberada ao autor." : "✅ Nota ocultada do autor.");
    } catch (e) {
      console.error(e);
      toast.error("❌ Não foi possível alterar a visibilidade da nota.");
    } finally {
      setTogglingNota(false);
    }
  }, [data?.id, notaVisivel, togglingNota]);

  if (!open) return null;

  return (
    <ModalBase
      isOpen={open}
      onClose={onClose}
      maxWidth="max-w-4xl"
      labelledBy="titulo-detalhes-submissao"
      describedBy="desc-detalhes-submissao"
      initialFocusRef={firstBtnRef}
      className="p-0 overflow-hidden"
      level={5}
    >
      {/* Header hero (gradiente exclusivo 3 cores) */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-violet-900 via-fuchsia-800 to-rose-700"
        role="group"
        aria-label="Cabeçalho dos detalhes da submissão"
      >
        <h3 id="titulo-detalhes-submissao" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          🧾 {fmt(data.titulo)}
        </h3>
        <p id="desc-detalhes-submissao" className="text-white/90 text-sm mt-1">
          ID #{fmt(data.id)} • {fmt(data.chamada_titulo || data.chamada)} • Atualizado em {fmtDateTimeBR(data.atualizado_em || data.updated_at || data.criado_em || data.created_at)}
        </p>
      </header>

      {loading ? (
        <div className="px-4 sm:px-6 py-6 text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {/* Corpo rolável único */}
          <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-6 pt-4 pb-28 space-y-6">
            {/* Ministats */}
            <section className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <MiniStat
                icon={BadgeCheck}
                label="Status"
                value={<StatusBadge status={data.status} />}
                tone="sky"
              />
              <MiniStat
                icon={Star}
                label="Nota (média)"
                value={`${fmtNum(mediaFinal, 1)} / 10`}
                tone="amber"
              />
              <MiniStat
                icon={UserRound}
                label="Avaliadores"
                value={avaliacoes?.length ? `${avaliacoes.length}` : "—"}
                tone="violet"
              />
              <MiniStat
                icon={Paperclip}
                label="Anexos"
                value={temAnexo ? "Sim" : "Não"}
                tone={temAnexo ? "emerald" : "zinc"}
              />
            </section>

            {/* Bloco nota/visibilidade */}
            <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-extrabold text-zinc-900 dark:text-white">Nota do trabalho</h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">
                    Média final: <strong>{fmtNum(mediaFinal, 1)}</strong> / 10
                    {avaliacoes?.length > 0 ? (
                      <span className="ml-2 opacity-70">
                        (Soma avaliadores: <strong>{totalObtido}</strong> / 40)
                      </span>
                    ) : null}
                  </p>
                </div>

                {avaliacoes?.length > 0 && (
                  <button
                    ref={firstBtnRef}
                    onClick={toggleVisibilidadeNota}
                    disabled={togglingNota}
                    className={cls(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-extrabold text-white",
                      notaVisivel ? "bg-zinc-700 hover:bg-zinc-800" : "bg-amber-700 hover:bg-amber-800",
                      "disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    )}
                    aria-label={notaVisivel ? "Ocultar nota do autor" : "Liberar nota ao autor"}
                    title={notaVisivel ? "Ocultar do autor" : "Liberar ao autor"}
                  >
                    {togglingNota ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : notaVisivel ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {notaVisivel ? "Ocultar do autor" : "Liberar ao autor"}
                  </button>
                )}
              </div>
            </section>

            {/* Anexos */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
                <h4 className="font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Paperclip className="w-4 h-4" aria-hidden="true" />
                  Pôster (PPT/PPTX)
                </h4>

                {posterNome ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate" title={posterNome}>
                        {posterNome}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Arquivo enviado</p>
                    </div>
                    <button
                      onClick={handleBaixarPoster}
                      disabled={baixandoPoster}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 text-sm font-extrabold disabled:opacity-60"
                    >
                      {baixandoPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Baixar
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">—</p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
                <h4 className="font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  Banner / outros
                </h4>

                {bannerNome ? (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white truncate" title={bannerNome}>
                        {bannerNome}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Arquivo enviado</p>
                    </div>
                    <button
                      onClick={handleBaixarBanner}
                      disabled={baixandoBanner}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 text-sm font-extrabold disabled:opacity-60"
                    >
                      {baixandoBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Baixar
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-2">—</p>
                )}
              </div>
            </section>

            {/* Texto (seções) */}
            {["introducao", "objetivos", "metodo", "resultados", "consideracoes", "bibliografia"].some((k) => !!data?.[k]) && (
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
                <h4 className="font-extrabold text-zinc-900 dark:text-white">Texto do trabalho</h4>
                <div className="mt-3 space-y-4">
                  {["introducao", "objetivos", "metodo", "resultados", "consideracoes", "bibliografia"].map((k) =>
                    data?.[k] ? (
                      <div key={k}>
                        <div className="text-sm font-extrabold text-zinc-900 dark:text-white capitalize">{k}</div>
                        <p className="text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-200 mt-1">
                          {fmt(data[k])}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>
              </section>
            )}

            {/* Notas por avaliador */}
            {avaliacoes?.length > 0 && (
              <section className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-zinc-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-extrabold text-zinc-900 dark:text-white">Notas dos avaliadores</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                      C1–C4 + total por avaliador (soma geral: <strong>{totalObtido}</strong> / 40)
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    {notaVisivel ? (
                      <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-200 dark:border-emerald-800">
                        <BadgeCheck className="w-4 h-4" /> Visível ao autor
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/25 dark:text-rose-200 dark:border-rose-800">
                        <ShieldAlert className="w-4 h-4" /> Oculta ao autor
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile: cards */}
                <div className="mt-4 grid gap-2 md:hidden">
                  {avaliacoes.map((a, i) => {
                    const [c1 = 0, c2 = 0, c3 = 0, c4 = 0] = a.notas || [];
                    const tot = Number.isFinite(a.total) ? a.total : c1 + c2 + c3 + c4;

                    return (
                      <div
                        key={`${a.nome}-${i}`}
                        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/20 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-zinc-900 dark:text-white truncate" title={a.nome}>
                              {a.nome}
                            </div>
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                              C1 {c1} • C2 {c2} • C3 {c3} • C4 {c4}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total</div>
                            <div className="text-lg font-extrabold text-zinc-900 dark:text-white">{tot}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: tabela */}
                <div className="hidden md:block overflow-x-auto mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-full text-sm text-center">
                    <thead className="bg-amber-100 dark:bg-zinc-800">
                      <tr className="text-zinc-700 dark:text-zinc-100">
                        <th className="p-2 text-left">Avaliador</th>
                        <th className="p-2">C1</th>
                        <th className="p-2">C2</th>
                        <th className="p-2">C3</th>
                        <th className="p-2">C4</th>
                        <th className="p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-transparent">
                      {avaliacoes.map((a, i) => {
                        const [c1 = 0, c2 = 0, c3 = 0, c4 = 0] = a.notas || [];
                        const tot = Number.isFinite(a.total) ? a.total : c1 + c2 + c3 + c4;
                        return (
                          <tr key={`${a.nome}-${i}`} className="hover:bg-amber-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                            <td className="p-2 text-left font-semibold text-zinc-900 dark:text-white">{a.nome}</td>
                            <td className="p-2">{c1}</td>
                            <td className="p-2">{c2}</td>
                            <td className="p-2">{c3}</td>
                            <td className="p-2">{c4}</td>
                            <td className="p-2 font-extrabold">{tot}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Footer sticky */}
          <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </ModalBase>
  );
}
