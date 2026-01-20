// 📁 src/components/ModalVerEdital.jsx
import { useState, useEffect, useMemo, useId, useCallback } from "react";
import PropTypes from "prop-types";
import {
  X,
  FileText,
  CalendarDays,
  Download,
  Loader2,
  CheckCircle2,
  ListChecks,
  ScrollText,
  Award,
  Info,
  Layers,
} from "lucide-react";
import api from "../services/api";
import ReactMarkdown from "react-markdown";
import Modal from "./Modal";

/* ───────────────────────── Helpers de DATA/HORA (sem TZ) ───────────────────────── */

// "2025-10-25" -> "25/10/2025"
function toBrDateOnly(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  const [, yy, mm, dd] = m;
  return `${dd}/${mm}/${yy}`;
}

// "22:15" ou "22:15:00" -> "22:15"
function toBrTimeOnly(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  const [, hh, mi] = m;
  return `${hh}:${mi}`;
}

// "YYYY-MM" -> "MM/YYYY"
function toBrYearMonth(s) {
  if (typeof s !== "string") return "";
  const m = s.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return s;
  const [, yy, mm] = m;
  return `${mm}/${yy}`;
}

// Normaliza datas ISO dentro de textos Markdown sem usar Date()
function normalizeDatesInsideText(text) {
  if (!text || typeof text !== "string") return text;
  let s = text;
  s = s.replace(
    /(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/g,
    (_, yy, mm, dd, hh, mi) => `${dd}/${mm}/${yy} ${hh}:${mi}`
  );
  s = s.replace(
    /(\d{4})-(\d{2})-(\d{2})(?![\d:])/g,
    (_, yy, mm, dd) => `${dd}/${mm}/${yy}`
  );
  return s;
}

// "DD/MM/YYYY às HH:mm"
function toBrPretty(date, time) {
  const d = toBrDateOnly(date);
  const t = toBrTimeOnly(time);
  if (d && t) return `${d} às ${t}`;
  if (d) return d;
  return "";
}

// Detecta se uma string parece ISO/ISO-like
function looksIsoLike(s) {
  if (typeof s !== "string") return false;
  return /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?)?(?:Z|[+-]\d{2}:\d{2})?$/i.test(
    s.trim()
  );
}

// "YYYY-MM-DD[ T]HH:mm[:ss][.SSS][Z|±HH:MM]" -> "DD/MM/YYYY às HH:mm" (sem fuso/shift)
function toBrPrettyFromIsoLike(isoLike) {
  if (typeof isoLike !== "string") return "";
  const s = isoLike.trim();

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?)?(?:Z|[+-]\d{2}:\d{2})?$/i
  );
  if (!m) return s;

  const [, yy, mm, dd, hh, mi] = m;
  if (hh && mi) return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
  return `${dd}/${mm}/${yy}`;
}

// Monta o texto do prazo final (amigável) a partir dos campos possíveis
function buildPrazoFinalPretty(ch) {
  if (ch?.prazo_final_date && ch?.prazo_final_time) {
    return toBrPretty(ch.prazo_final_date, ch.prazo_final_time);
  }

  const candidate =
    (typeof ch?.prazo_final === "string" && ch.prazo_final) ||
    (typeof ch?.prazo_final_br === "string" && ch.prazo_final_br) ||
    null;

  if (candidate && looksIsoLike(candidate)) {
    return toBrPrettyFromIsoLike(candidate);
  }

  if (typeof ch?.prazo_final_br === "string") {
    return ch.prazo_final_br;
  }

  return "—";
}

/* ───────────────────────── Backend base p/ URLs relativas ───────────────────────── */
const API_BASE = (api?.defaults?.baseURL || "").replace(/\/+$/g, "");

function withBackendBase(u) {
  if (!u) return null;
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return API_BASE ? `${API_BASE}${s}` : s;
  return null;
}

/* ───────────────────────── Download autenticado (blob) ───────────────────────── */
function inferFilenameFromHeaders(headers, fallback = "arquivo") {
  const cd = headers?.["content-disposition"] || headers?.get?.("content-disposition");
  if (typeof cd === "string") {
    const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (m?.[1]) return decodeURIComponent(m[1]);
  }
  return fallback;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ModalVerEdital({ isOpen = true, chamadaId, onClose }) {
  const titleId = useId();
  const descId = useId();

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [baixandoEdital, setBaixandoEdital] = useState(false);
  const [baixandoModelo, setBaixandoModelo] = useState(false);

  useEffect(() => {
    let alive = true;

    async function fetchData() {
      if (!chamadaId) return;
      setLoading(true);
      setErro("");
      try {
        const res = await api.get(`/chamadas/${chamadaId}`);
        const data = res?.data ?? res;
        if (alive) setDados(data);
      } catch (err) {
        console.error("Erro ao carregar edital:", err);
        if (alive) setErro("Não foi possível carregar o edital. Tente novamente.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (isOpen) fetchData();
    return () => {
      alive = false;
    };
  }, [isOpen, chamadaId]);

  // Derivados seguros
  const chamada = dados?.chamada || dados?.data?.chamada || dados?.data || dados?.chamada || {};
  const linhas = dados?.linhas || [];
  const criterios = dados?.criterios || [];
  const criterios_orais = dados?.criterios_orais || [];
  const limites = dados?.limites || null;
  const modelo_meta = dados?.modelo_meta || null;

  const prazoFinalTxt = useMemo(() => buildPrazoFinalPretty(chamada), [chamada]);

  const minis = useMemo(
    () => ({
      linhas: linhas.length,
      critEscrita: criterios.length,
      critOrais: criterios_orais.length,
      aceitaPoster: !!chamada?.aceita_poster,
      maxCoautores: chamada?.max_coautores ?? "—",
    }),
    [linhas, criterios, criterios_orais, chamada]
  );

  const headerGradient = "from-indigo-900 via-violet-800 to-blue-700";

  const handleBaixarEdital = useCallback(async () => {
    const url = withBackendBase(chamada?.arquivo_edital_url);
    if (!url) return;

    // Se for público e já tem URL completa, abrir em nova aba funciona.
    // Mas preferimos baixar (blob) p/ não quebrar auth / CORS.
    try {
      setBaixandoEdital(true);
      const resp = await api.get(url.replace(API_BASE, ""), { responseType: "blob" });
      const blob = resp?.data;
      const filename = inferFilenameFromHeaders(resp?.headers, "edital.pdf");
      downloadBlob(filename, blob);
    } catch (e) {
      console.error("[ModalVerEdital] Falha ao baixar edital:", e);
      // fallback: tenta abrir direto
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixandoEdital(false);
    }
  }, [chamada?.arquivo_edital_url]);

  const handleBaixarModelo = useCallback(async () => {
    if (!chamadaId) return;
    try {
      setBaixandoModelo(true);
      const resp = await api.get(`/chamadas/${chamadaId}/modelo-banner`, { responseType: "blob" });
      const blob = resp?.data;
      const filename = inferFilenameFromHeaders(resp?.headers, "modelo-poster.pptx");
      downloadBlob(filename, blob);
    } catch (e) {
      console.error("[ModalVerEdital] Falha ao baixar modelo:", e);
      // fallback: abre rota (se permissões permitirem)
      const url = withBackendBase(`/chamadas/${chamadaId}/modelo-banner`);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBaixandoModelo(false);
    }
  }, [chamadaId]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-4xl p-0 overflow-hidden"
      closeOnBackdrop
    >
      <div className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-100">
        {/* HeaderHero */}
        <header
          className={`px-4 sm:px-6 py-4 text-white bg-gradient-to-br ${headerGradient}`}
          role="group"
          aria-label="Edital da chamada"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 shrink-0" aria-hidden="true" />
                <h2 id={titleId} className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                  Edital da Chamada
                </h2>
              </div>

              <p id={descId} className="text-white/90 text-sm mt-1 line-clamp-2">
                {chamada?.titulo || "—"}
              </p>

              <p className="text-xs mt-1 flex items-center gap-2">
                <CalendarDays className="w-4 h-4" aria-hidden />
                <span>
                  Prazo final: <strong className="tracking-tight">{prazoFinalTxt}</strong>{" "}
                  <span className="text-white/70">(horário local)</span>
                </span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60"
              aria-label="Fechar"
              type="button"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Live regions */}
        <div aria-live="polite" className="sr-only">
          {loading ? "Carregando edital" : erro ? erro : "Edital carregado"}
        </div>

        {/* Loading / Erro / Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            <span className="sr-only">Carregando edital</span>
          </div>
        ) : erro ? (
          <div className="px-4 sm:px-6 py-6">
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-4 text-rose-800 dark:text-rose-200">
              {erro}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                type="button"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Ministats */}
            <section className="px-4 sm:px-6 pt-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Linhas temáticas</div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4" aria-hidden /> {minis.linhas}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Critérios (escrita)</div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" aria-hidden /> {minis.critEscrita}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Critérios (orais)</div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" aria-hidden /> {minis.critOrais}
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 p-3 shadow-sm bg-white dark:bg-slate-900">
                <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">Coautores máx.</div>
                <div className="text-sm font-semibold">{minis.maxCoautores}</div>
              </div>
            </section>

            {/* Corpo rolável */}
            <div className="px-4 sm:px-6 pt-4 pb-24 max-h-[70vh] overflow-y-auto text-slate-700 dark:text-slate-200">
              {/* Descrição Markdown */}
              {chamada?.descricao_markdown ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                    <ScrollText className="w-5 h-5" /> Normas e Descrição
                  </h3>
                  <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                    <ReactMarkdown>{normalizeDatesInsideText(chamada.descricao_markdown)}</ReactMarkdown>
                  </div>
                </section>
              ) : null}

              {/* Período */}
              {(chamada?.periodo_experiencia_inicio || chamada?.periodo_experiencia_fim) ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                    <CalendarDays className="w-5 h-5" /> Período da Experiência
                  </h3>
                  <p className="text-sm">
                    <strong>Início:</strong> {toBrYearMonth(chamada?.periodo_experiencia_inicio) || "—"} <br />
                    <strong>Fim:</strong> {toBrYearMonth(chamada?.periodo_experiencia_fim) || "—"}
                  </p>
                </section>
              ) : null}

              {/* Linhas temáticas */}
              {linhas.length > 0 ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                    <Layers className="w-5 h-5" /> Linhas Temáticas
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    {linhas.map((l, i) => (
                      <li key={l?.id ?? `${l?.nome ?? "linha"}-${i}`}>
                        <strong>{l?.nome}</strong>
                        {l?.descricao ? <span> — {l.descricao}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Limites */}
              {limites && Object.keys(limites).length > 0 ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                    <ListChecks className="w-5 h-5" /> Limites de Caracteres
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    {Object.entries(limites).map(([k, v]) => (
                      <div key={k} className="border dark:border-slate-700 rounded-xl p-2 bg-white dark:bg-slate-900">
                        <strong className="block truncate">{k}</strong>
                        <p className="text-slate-600 dark:text-slate-300">{v} caracteres</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Critérios de escrita */}
              {criterios.length > 0 ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-lg mb-2">
                    <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Escrita
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    {criterios.map((c, i) => (
                      <li key={c?.id ?? `${c?.titulo ?? "crit"}-${i}`}>
                        {c?.titulo} (Escala: {c?.escala_min}–{c?.escala_max}, Peso: {c?.peso})
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Critérios orais */}
              {criterios_orais.length > 0 ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-lg mb-2">
                    <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Apresentação Oral
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm">
                    {criterios_orais.map((c, i) => (
                      <li key={c?.id ?? `${c?.titulo ?? "oral"}-${i}`}>
                        {c?.titulo} (Escala: {c?.escala_min}–{c?.escala_max}, Peso: {c?.peso})
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Regras gerais */}
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-lg mb-2">
                  <Info className="w-5 h-5" /> Regras Gerais
                </h3>
                <p className="text-sm">
                  <strong>Aceita pôster:</strong>{" "}
                  <span
                    className={`font-semibold ${
                      minis.aceitaPoster
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300"
                    }`}
                  >
                    {minis.aceitaPoster ? "Sim" : "Não"}
                  </span>
                </p>
                <p className="text-sm">
                  <strong>Máximo de coautores:</strong> {minis.maxCoautores}
                </p>
              </section>

              {/* Premiação */}
              {chamada?.premiacao_texto ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold text-lg mb-2">
                    <Award className="w-5 h-5" /> Premiação
                  </h3>
                  <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                    <ReactMarkdown>{normalizeDatesInsideText(chamada.premiacao_texto)}</ReactMarkdown>
                  </div>
                </section>
              ) : null}

              {/* Disposições finais */}
              {chamada?.disposicao_finais_texto ? (
                <section className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-lg mb-2">
                    <FileText className="w-5 h-5" /> Disposições Finais
                  </h3>
                  <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                    <ReactMarkdown>{normalizeDatesInsideText(chamada.disposicao_finais_texto)}</ReactMarkdown>
                  </div>
                </section>
              ) : null}
            </div>

            {/* Rodapé sticky */}
            <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
              {chamada?.arquivo_edital_url ? (
                <button
                  type="button"
                  onClick={handleBaixarEdital}
                  disabled={baixandoEdital}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-700 text-white hover:bg-violet-800 transition disabled:opacity-60"
                  title="Baixar edital"
                >
                  {baixandoEdital ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar edital
                </button>
              ) : null}

              {modelo_meta?.exists ? (
                <button
                  type="button"
                  onClick={handleBaixarModelo}
                  disabled={baixandoModelo}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60"
                  title="Baixar modelo de pôster"
                >
                  {baixandoModelo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Modelo de pôster
                </button>
              ) : null}

              <button
                onClick={onClose}
                type="button"
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

ModalVerEdital.propTypes = {
  isOpen: PropTypes.bool,
  chamadaId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onClose: PropTypes.func.isRequired,
};
