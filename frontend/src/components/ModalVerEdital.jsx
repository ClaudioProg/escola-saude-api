// 📁 src/components/ModalVerEdital.jsx
import { useState, useEffect, useMemo, useId } from "react";
import PropTypes from "prop-types";
import {
  X, FileText, CalendarDays, Download, Loader2,
  CheckCircle2, ListChecks, ScrollText, Award, Info, Layers
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

  // data + hora
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,6})?)?)?(?:Z|[+-]\d{2}:\d{2})?$/i
  );
  if (!m) return s;

  const [, yy, mm, dd, hh, mi] = m;
  if (hh && mi) return `${dd}/${mm}/${yy} às ${hh}:${mi}`;
  // só data
  return `${dd}/${mm}/${yy}`;
}

// Monta o texto do prazo final (amigável) a partir dos campos possíveis
function buildPrazoFinalPretty(ch) {
  // Preferência: campos separados → ISO-like em qualquer key → texto já BR
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

export default function ModalVerEdital({ isOpen = true, chamadaId, onClose }) {
  const titleId = useId();
  const descId = useId();

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

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

  // Derivados seguros (antes de usar)
  const chamada = dados?.chamada || {};
  const linhas = dados?.linhas || [];
  const criterios = dados?.criterios || [];
  const criterios_orais = dados?.criterios_orais || [];
  const limites = dados?.limites || null;
  const modelo_meta = dados?.modelo_meta || null;

  // Prazo final (amigável, sem fuso)
  const prazoFinalTxt = useMemo(() => buildPrazoFinalPretty(chamada), [chamada]);

  // Ministats
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      className="w-[96%] max-w-4xl p-0 overflow-hidden"
      closeOnBackdrop
    >
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
              <h2
                id={titleId}
                className="text-xl sm:text-2xl font-extrabold tracking-tight truncate"
              >
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
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Loading / Erro */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" aria-label="Carregando edital" />
        </div>
      ) : erro ? (
        <div className="px-4 sm:px-6 py-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
            {erro}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300"
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
            {chamada?.descricao_markdown && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                  <ScrollText className="w-5 h-5" /> Normas e Descrição
                </h3>
                <div className="prose prose-sm sm:prose-base max-w-none text-slate-800 dark:text-slate-200">
                  <ReactMarkdown>{normalizeDatesInsideText(chamada.descricao_markdown)}</ReactMarkdown>
                </div>
              </section>
            )}

            {/* Período */}
            {(chamada?.periodo_experiencia_inicio || chamada?.periodo_experiencia_fim) && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                  <CalendarDays className="w-5 h-5" /> Período da Experiência
                </h3>
                <p className="text-sm">
                  <strong>Início:</strong> {toBrYearMonth(chamada?.periodo_experiencia_inicio) || "—"} <br />
                  <strong>Fim:</strong> {toBrYearMonth(chamada?.periodo_experiencia_fim) || "—"}
                </p>
              </section>
            )}

            {/* Linhas temáticas */}
            {linhas.length > 0 && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                  <Layers className="w-5 h-5" /> Linhas Temáticas
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  {linhas.map((l, i) => (
                    <li key={i}>
                      <strong>{l?.nome}</strong>
                      {l?.descricao ? <span> — {l.descricao}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Limites */}
            {limites && Object.keys(limites).length > 0 && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-semibold text-lg mb-2">
                  <ListChecks className="w-5 h-5" /> Limites de Caracteres
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  {Object.entries(limites).map(([k, v]) => (
                    <div key={k} className="border rounded-xl p-2 bg-white dark:bg-slate-900 dark:border-slate-700">
                      <strong className="block truncate">{k}</strong>
                      <p className="text-slate-600 dark:text-slate-300">{v} caracteres</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Critérios de escrita */}
            {criterios.length > 0 && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-lg mb-2">
                  <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Escrita
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  {criterios.map((c, i) => (
                    <li key={i}>
                      {c?.titulo} (Escala: {c?.escala_min}–{c?.escala_max}, Peso: {c?.peso})
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Critérios orais */}
            {criterios_orais.length > 0 && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-lg mb-2">
                  <CheckCircle2 className="w-5 h-5" /> Critérios de Avaliação — Apresentação Oral
                </h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  {criterios_orais.map((c, i) => (
                    <li key={i}>
                      {c?.titulo} (Escala: {c?.escala_min}–{c?.escala_max}, Peso: {c?.peso})
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Regras gerais */}
            <section className="mb-6">
              <h3 className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold text-lg mb-2">
                <Info className="w-5 h-5" /> Regras Gerais
              </h3>
              <p className="text-sm">
                <strong>Aceita pôster:</strong>{" "}
                <span
                  className={`font-semibold ${
                    minis.aceitaPoster ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
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
            {chamada?.premiacao_texto && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold text-lg mb-2">
                  <Award className="w-5 h-5" /> Premiação
                </h3>
                <div className="prose prose-sm sm:prose-base max-w-none text-slate-800 dark:text-slate-200">
                  <ReactMarkdown>{normalizeDatesInsideText(chamada.premiacao_texto)}</ReactMarkdown>
                </div>
              </section>
            )}

            {/* Disposições finais */}
            {chamada?.disposicoes_finais_texto && (
              <section className="mb-6">
                <h3 className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold text-lg mb-2">
                  <FileText className="w-5 h-5" /> Disposições Finais
                </h3>
                <div className="prose prose-sm sm:prose-base max-w-none text-slate-800 dark:text-slate-200">
                  <ReactMarkdown>{normalizeDatesInsideText(chamada.disposicoes_finais_texto)}</ReactMarkdown>
                </div>
              </section>
            )}
          </div>

          {/* Rodapé sticky (downloads/ações) */}
          <div className="sticky bottom-0 left-0 right-0 bg-white/85 dark:bg-zinc-950/85 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
            {chamada?.arquivo_edital_url && (
              <a
                href={chamada.arquivo_edital_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-700 text-white hover:bg-violet-800 transition"
              >
                <Download className="w-4 h-4" />
                Baixar edital
              </a>
            )}
            {modelo_meta?.exists && (
              <a
                href={`/api/chamadas/${chamadaId}/modelo-banner`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <Download className="w-4 h-4" />
                Modelo de pôster
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

ModalVerEdital.propTypes = {
  isOpen: PropTypes.bool,
  chamadaId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onClose: PropTypes.func.isRequired,
};
