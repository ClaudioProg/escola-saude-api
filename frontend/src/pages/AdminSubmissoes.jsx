// 📁 src/pages/AdminSubmissoes.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Filter,
  ClipboardList,
  Award,
  CheckCircle,
  XCircle,
  FileText,
  Search,
  ExternalLink,
  Link as LinkIcon,
  Paperclip,
  Users,
  Tag,
  GraduationCap,
  BookOpen,
  LayoutGrid,
  Hash,
  Clock,
} from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { useOnceEffect } from "../hooks/useOnceEffect";

/* Utils */
const fmt = (v, alt = "—") => (v === 0 || !!v ? String(v) : alt);
const fmtNum = (v, d = 2) => Number(v ?? 0).toFixed(d);
const fmtMonthBR = (yyyyMm) => {
  const m = String(yyyyMm || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return fmt(yyyyMm);
  const [y, mo] = m.split("-");
  return `${mo}/${y}`;
};

/* Badge de status */
function StatusBadge({ status }) {
  const base =
    "px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 justify-center";
  switch (status) {
    case "submetido":
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>
          <FileText className="w-3 h-3" /> Submetido
        </span>
      );
    case "em_avaliacao":
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          <ClipboardList className="w-3 h-3" /> Em avaliação
        </span>
      );
    case "aprovado_exposicao":
      return (
        <span className={`${base} bg-green-100 text-green-700`}>
          <Award className="w-3 h-3" /> Exposição
        </span>
      );
    case "aprovado_oral":
      return (
        <span className={`${base} bg-green-200 text-green-800`}>
          <CheckCircle className="w-3 h-3" /> Oral
        </span>
      );
    case "reprovado":
      return (
        <span className={`${base} bg-red-100 text-red-700`}>
          <XCircle className="w-3 h-3" /> Reprovado
        </span>
      );
    default:
      return (
        <span className={`${base} bg-gray-100 text-gray-700`}>
          {status || "—"}
        </span>
      );
  }
}

/* Drawer/Modal de detalhes — busca DETALHES ao abrir */
function DetalhesSubmissao({ open, onClose, s }) {
  const [full, setFull] = useState(null);
  const [loading, setLoading] = useState(true);

  // carrega /submissoes/:id ao abrir
  useEffect(() => {
    if (!open || !s?.id) return;
    const ac = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const r = await api.get(`/submissoes/${s.id}`, { signal: ac.signal });
        const sub = Array.isArray(r) ? r[0] : (r?.data ?? r);
        setFull(sub || {});
      } catch (e) {
        if (e?.name !== "AbortError") {
          console.error("[Admin] Falha ao obter detalhes da submissão:", e);
          setFull({});
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, s?.id]);

  if (!open || !s) return null;

  // mescla lista "light" com detalhes completos
  const data = { ...s, ...(full || {}) };

  // campos
  const titulo = data.titulo;
  const inicioExp = data.inicio_experiencia || data.inicioExperiencia;
  const linhaTemId = data.linha_tematica_id || data.linhaTematicaId;
  const linhaTemNome = data.linha_tematica_nome || data.linhaTematicaNome;

  const introducao = data.introducao;
  const objetivos = data.objetivos;
  const metodo = data.metodo;
  const resultados = data.resultados;
  const consideracoes = data.consideracoes;
  const bibliografia = data.bibliografia;

  const coautores = Array.isArray(data.coautores) ? data.coautores : [];

  const posterNome = data.poster_nome || data.posterNome || "";
  const posterUrl = data.id ? `/api/submissoes/${data.id}/poster` : null;

  const historico = Array.isArray(data.historico_status || data.historicoStatus)
    ? (data.historico_status || data.historicoStatus)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[85vh] overflow-y-auto"
      >
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b dark:border-zinc-800">
          <h3 className="text-lg sm:text-xl font-bold text-lousa dark:text-white">
            {fmt(titulo)}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            ID #{fmt(data.id)} · {fmt(data.chamada_titulo || data.chamada)}
          </p>
        </div>

        {/* Corpo */}
        {loading ? (
          <div className="p-6 text-sm text-zinc-600 dark:text-zinc-400">Carregando detalhes…</div>
        ) : (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Status e nota geral */}
            <section className="grid sm:grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Status</p>
                <div className="mt-1">
                  <StatusBadge status={data.status} />
                </div>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <p className="text-sm text-zinc-500">Total (Geral)</p>
                <p className="text-lg font-semibold">{fmtNum(data.total_geral)}</p>
              </div>
            </section>

            {/* Dados acadêmicos principais */}
            <section className="grid sm:grid-cols-2 gap-4">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Início da experiência
                </h5>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                  {fmtMonthBR(inicioExp)}
                </p>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4">
                <h5 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  Linha temática
                </h5>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                  {fmt(linhaTemNome || linhaTemId)}
                </p>
              </div>
            </section>

            {/* Coautores */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">
                Coautores
              </h4>
              {coautores.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {coautores.map((c, i) => (
                    <li
                      key={i}
                      className="text-sm bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3"
                    >
                      <p className="font-medium text-zinc-800 dark:text-zinc-100">
                        {fmt(c.nome)}
                      </p>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        CPF: {fmt(c.cpf)} ·{" "}
                        {fmt(c.email, "") ? (
                          <a
                            className="underline decoration-dotted"
                            href={`mailto:${c.email}`}
                          >
                            {c.email}
                          </a>
                        ) : (
                          "—"
                        )}{" "}
                        · {fmt(c.vinculo)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Texto científico (mesmos campos do formulário do usuário) */}
            {[
              ["Introdução", introducao],
              ["Objetivos", objetivos],
              ["Método", metodo],
              ["Resultados", resultados],
              ["Considerações finais", consideracoes],
              ["Bibliografia", bibliografia],
            ].map(([label, value]) => (
              <section key={label}>
                <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {label}
                </h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                  {fmt(value)}
                </p>
              </section>
            ))}

            {/* Pôster */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">
                Pôster
              </h4>
              {posterNome ? (
                <p className="text-sm mt-1">
                  Arquivo: <strong>{posterNome}</strong>{" "}
                  {posterUrl && (
                    <a
                      href={posterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-amber-700 underline decoration-dotted"
                    >
                      baixar
                    </a>
                  )}
                </p>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
              )}
            </section>

            {/* Histórico de status (se houver) */}
            <section>
              <h4 className="font-semibold text-zinc-800 dark:text-zinc-100">
                Histórico de status
              </h4>
              {historico.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {historico.map((h, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <StatusBadge status={h.status} />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {fmt(h.quem || h.usuario, "—")}
                      </span>
                      <span className="text-zinc-500 text-xs">
                        {fmt(h.em || h.data, "—")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AdminSubmissoes() {
  const [submissoes, setSubmissoes] = useState([]);
  const [filtroChamada, setFiltroChamada] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [chamadas, setChamadas] = useState([]);
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [selecionada, setSelecionada] = useState(null);

  // helper para aceitar ambos formatos (direto ou axios-like)
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
        setSubmissoes(unwrap(subs));
        setChamadas(unwrap(ch));
      } catch (err) {
        if (err?.name !== "AbortError") console.error("Erro ao carregar:", err);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return submissoes.filter((s) => {
      const matchChamada =
        !filtroChamada || Number(s.chamada_id) === Number(filtroChamada);
      const matchStatus = !filtroStatus || s.status === filtroStatus;
      const matchBusca =
        !termo ||
        [s.titulo, s.autor_nome, s.autor_email, s.chamada_titulo, s.area_tematica, s.eixo]
          .map((v) => (v ? String(v).toLowerCase() : ""))
          .some((t) => t.includes(termo));
      return matchChamada && matchStatus && matchBusca;
    });
  }, [submissoes, filtroChamada, filtroStatus, busca]);

  // Estatísticas
  const total = submissoes.length;
  const aprovadas = submissoes.filter((s) =>
    ["aprovado_oral", "aprovado_exposicao"].includes(s.status)
  ).length;
  const reprovadas = submissoes.filter((s) => s.status === "reprovado").length;
  const emAvaliacao = submissoes.filter((s) => s.status === "em_avaliacao").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-amber-50 to-yellow-100">
        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-white to-yellow-100">
      {/* HeaderHero inline (âmbar → laranja) */}
      <header
        className="relative isolate overflow-hidden bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-500 py-16 px-6 text-white text-center shadow"
        aria-labelledby="admin-submissoes-title"
      >
        <motion.h1
          id="admin-submissoes-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-bold mb-2"
        >
          Gestão de Submissões
        </motion.h1>
        <p className="text-yellow-100/95 max-w-2xl mx-auto text-sm sm:text-base">
          Acompanhe, filtre e audite todos os trabalhos submetidos às chamadas.
        </p>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-10 max-w-7xl mx-auto w-full space-y-10">
        {/* Mini Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-amber-600">
            <p className="text-sm text-gray-500">Total de submissões</p>
            <p className="text-2xl font-semibold text-amber-700">{total}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-green-600">
            <p className="text-sm text-gray-500">Aprovadas</p>
            <p className="text-2xl font-semibold text-green-700">{aprovadas}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-blue-600">
            <p className="text-sm text-gray-500">Em avaliação</p>
            <p className="text-2xl font-semibold text-blue-700">{emAvaliacao}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 border-t-4 border-red-600">
            <p className="text-sm text-gray-500">Reprovadas</p>
            <p className="text-2xl font-semibold text-red-700">{reprovadas}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow p-5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-800">Filtros</h2>
          </div>

          <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <select
              value={filtroChamada}
              onChange={(e) => setFiltroChamada(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full"
              aria-label="Filtrar por chamada"
            >
              <option value="">Todas as chamadas</option>
              {chamadas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>

            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full"
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="submetido">Submetido</option>
              <option value="em_avaliacao">Em avaliação</option>
              <option value="aprovado_exposicao">Aprovado (Exposição)</option>
              <option value="aprovado_oral">Aprovado (Oral)</option>
              <option value="reprovado">Reprovado</option>
            </select>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="border rounded-md pl-9 pr-3 py-2 text-sm w-full"
                placeholder="Buscar por título, autor, eixos..."
                aria-label="Buscar"
              />
            </div>
          </div>
        </div>

        {/* Tabela (desktop) */}
        <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-amber-600 text-white">
              <tr>
                <th className="p-3 text-left">Título</th>
                <th className="p-3 text-left">Autor</th>
                <th className="p-3 text-left">Chamada</th>
                <th className="p-3 text-left">Área / Eixo</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Total (Geral)</th>
                <th className="p-3 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    Nenhuma submissão encontrada.
                  </td>
                </tr>
              )}

              {filtradas.map((s) => (
                <tr
                  key={s.id}
                  className="border-b hover:bg-amber-50 transition"
                >
                  <td className="p-3 max-w-[28ch] truncate" title={s.titulo}>
                    {s.titulo}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-800">{s.autor_nome}</span>
                      <span className="text-xs text-gray-500">{s.autor_email}</span>
                    </div>
                  </td>
                  <td className="p-3 text-gray-700">{s.chamada_titulo}</td>
                  <td className="p-3 text-gray-700">
                    <span className="block">{fmt(s.area_tematica || s.area)}</span>
                    <span className="block text-xs text-gray-500">{fmt(s.eixo)}</span>
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="p-3 text-center font-semibold text-gray-800">
                    {fmtNum(s.total_geral)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => {
                        setSelecionada(s);
                        setDetalheOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-full bg-amber-700 text-white hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
                      aria-label={`Abrir detalhes de ${s.titulo}`}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cards (mobile) */}
        <div className="md:hidden grid grid-cols-1 gap-3">
          {filtradas.length === 0 && (
            <div className="text-center py-6 text-gray-500 bg-white rounded-xl shadow">
              Nenhuma submissão encontrada.
            </div>
          )}
          {filtradas.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-xl shadow border p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-800">{s.titulo}</p>
                  <p className="text-xs text-zinc-500">{s.chamada_titulo}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-sm text-zinc-700">
                <span className="font-medium">{s.autor_nome}</span>
                <span className="text-zinc-500"> · {s.autor_email}</span>
              </p>
              <p className="text-xs text-zinc-500">
                {fmt(s.area_tematica || s.area)} · {fmt(s.eixo)}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold">
                  Total: {fmtNum(s.total_geral)}
                </span>
                <button
                  onClick={() => {
                    setSelecionada(s);
                    setDetalheOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-amber-700 text-white"
                >
                  Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer />

      {/* Drawer/Modal */}
      <AnimatePresence>
        {detalheOpen && (
          <DetalhesSubmissao
            open={detalheOpen}
            onClose={() => setDetalheOpen(false)}
            s={selecionada}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
