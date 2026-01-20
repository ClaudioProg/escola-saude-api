// 📁 src/components/ModalCertificadoPreview.jsx
import PropTypes from "prop-types";
import { useMemo, useState, useCallback, useRef } from "react";
import {
  Download,
  Link as LinkIcon,
  QrCode,
  Copy,
  CheckCheck,
  CalendarDays,
  Clock3,
  ShieldCheck,
  ShieldAlert,
  FileWarning,
} from "lucide-react";
import Modal from "./Modal";
import { formatarCPF } from "../utils/dateTime";

/* ====================== Helpers (sem timezone shift) ====================== */
// date-only: YYYY-MM-DD -> DD/MM/YYYY
function isoDateToBR(iso) {
  if (!iso) return "";
  const s = String(iso).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// datetime: YYYY-MM-DDTHH:mm(:ss)? OR "YYYY-MM-DD HH:mm" -> DD/MM/YYYY HH:mm
function isoDateTimeToBR(input) {
  if (!input) return "";
  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

function safeText(v) {
  return (v == null ? "" : String(v)).trim();
}

async function copyText(text) {
  const t = safeText(text);
  if (!t) return false;

  // 1) Clipboard API
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // continua
  }

  // 2) Fallback: textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  } catch {
    return false;
  }
}

function cls(...p) {
  return p.filter(Boolean).join(" ");
}

/* ====================== Component ====================== */
export default function ModalCertificadoPreview({ isOpen, onClose, certificado }) {
  if (!certificado) return null;

  const {
    nome,
    cpf,
    titulo_evento,
    carga_horaria,
    qr_code_url,
    pdf_url,
    codigo,
    gerado_em,
    link_validacao,
  } = certificado || {};

  const [copiado, setCopiado] = useState(false);
  const [copiadoLink, setCopiadoLink] = useState(""); // "codigo" | "pdf" | "validacao" | ""

  const timerRef = useRef(null);

  const dataEmissao = useMemo(() => {
    // prioriza datetime se vier
    const dt = isoDateTimeToBR(gerado_em);
    if (dt) return dt;
    // fallback date-only
    const d = isoDateToBR(safeText(gerado_em).slice(0, 10));
    return d || null;
  }, [gerado_em]);

  const cargaTexto = Number.isFinite(Number(carga_horaria)) ? `${Number(carga_horaria)} horas` : "—";
  const statusValidacao = link_validacao ? "disponivel" : "indisponivel";

  const flashCopiado = useCallback((type = "codigo") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopiado(true);
    setCopiadoLink(type);
    timerRef.current = setTimeout(() => {
      setCopiado(false);
      setCopiadoLink("");
    }, 1200);
  }, []);

  const handleCopyCodigo = useCallback(async () => {
    if (!codigo) return;
    const ok = await copyText(codigo);
    if (ok) flashCopiado("codigo");
  }, [codigo, flashCopiado]);

  const handleCopyUrl = useCallback(
    async (type, url) => {
      if (!url) return;
      const ok = await copyText(url);
      if (ok) flashCopiado(type);
    },
    [flashCopiado]
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-cert-preview"
      describedBy="descricao-cert-preview"
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Header com degradê exclusivo */}
      <header
        className="px-4 sm:px-6 py-4 text-white bg-gradient-to-br from-cyan-900 via-sky-800 to-blue-700"
        role="group"
        aria-label="Cabeçalho da prévia do certificado"
      >
        <h2 id="titulo-cert-preview" className="text-xl sm:text-2xl font-extrabold tracking-tight">
          🎓 Prévia do Certificado
        </h2>
        <p id="descricao-cert-preview" className="text-white/90 text-sm mt-1">
          Dados principais, QR Code e ações de validação/baixa.
        </p>
      </header>

      {/* Live region (copiado) */}
      <div aria-live="polite" className="sr-only">
        {copiado ? "Copiado para a área de transferência." : ""}
      </div>

      {/* Ministats */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-cyan-100 dark:border-cyan-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Emissão</span>
          </div>
          <div className="text-lg font-extrabold">{dataEmissao || "—"}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Data/hora de emissão</div>
        </div>

        <div className="rounded-2xl border border-cyan-100 dark:border-cyan-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Clock3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Carga horária</span>
          </div>
          <div className="text-lg font-extrabold">{cargaTexto}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Total do evento</div>
        </div>

        <div className="rounded-2xl border border-cyan-100 dark:border-cyan-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            {statusValidacao === "disponivel" ? (
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            )}
            <span className="font-semibold">Validação</span>
          </div>

          <div
            className={cls(
              "inline-flex items-center gap-2 text-xs font-extrabold px-2 py-1 rounded-full border",
              statusValidacao === "disponivel"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800"
            )}
          >
            {statusValidacao === "disponivel" ? "Link disponível" : "Link indisponível"}
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            {statusValidacao === "disponivel"
              ? "Verificação pública habilitada."
              : "O link de validação não foi informado."}
          </div>
        </div>
      </section>

      {/* Corpo */}
      <section className="px-4 sm:px-6 pt-4 pb-24 space-y-4">
        {/* Dados principais */}
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700 p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-300">Nome</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-semibold">{nome || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-300">CPF</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-semibold">
                {cpf ? formatarCPF(cpf) : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500 dark:text-slate-300">Evento</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-semibold">{titulo_evento || "—"}</dd>
            </div>
          </dl>

          {/* Código copiável */}
          <div className="mt-4">
            <span className="block text-slate-500 dark:text-slate-300 text-sm mb-1">
              Código do certificado
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-xl border text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 break-all">
                {codigo || "—"}
              </span>

              {codigo ? (
                <button
                  type="button"
                  onClick={handleCopyCodigo}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-extrabold
                             bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700
                             text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                  aria-label="Copiar código do certificado"
                  title="Copiar código"
                >
                  {copiado && copiadoLink === "codigo" ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado && copiadoLink === "codigo" ? "Copiado" : "Copiar"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Links (PDF / validação) */}
        {(pdf_url || link_validacao) && (
          <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3">
              Links
            </h3>

            <div className="space-y-3">
              {pdf_url && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">PDF</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">
                      {pdf_url}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:ml-auto">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl("pdf", pdf_url)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-extrabold
                                 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700
                                 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                      aria-label="Copiar link do PDF"
                    >
                      {copiado && copiadoLink === "pdf" ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado && copiadoLink === "pdf" ? "Copiado" : "Copiar"}
                    </button>
                    <a
                      href={pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition"
                      aria-label="Abrir PDF em nova aba"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      Abrir
                    </a>
                  </div>
                </div>
              )}

              {link_validacao && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">Validação</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-200 truncate">
                      {link_validacao}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:ml-auto">
                    <button
                      type="button"
                      onClick={() => handleCopyUrl("validacao", link_validacao)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-extrabold
                                 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700
                                 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                      aria-label="Copiar link de validação"
                    >
                      {copiado && copiadoLink === "validacao" ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado && copiadoLink === "validacao" ? "Copiado" : "Copiar"}
                    </button>
                    <a
                      href={link_validacao}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                      aria-label="Abrir validação em nova aba"
                    >
                      <LinkIcon className="w-4 h-4" aria-hidden="true" />
                      Abrir
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Code */}
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4" aria-hidden="true" />
            Verificação por QR Code
          </h3>

          {qr_code_url ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={qr_code_url}
                alt={`QR Code do certificado${codigo ? ` ${codigo}` : ""}`}
                className="w-36 h-36 border p-2 rounded-2xl bg-white"
              />
              <p className="text-xs text-slate-600 dark:text-slate-300 text-center">
                Aponte a câmera do celular para validar rapidamente.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <FileWarning className="w-4 h-4" aria-hidden="true" />
              QR Code não disponível.
            </div>
          )}
        </div>
      </section>

      {/* Ações sticky (mobile-first) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        {pdf_url && (
          <a
            href={pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-2xl
                       bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition"
            aria-label="Baixar certificado em PDF"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Baixar PDF
          </a>
        )}

        {link_validacao && (
          <a
            href={link_validacao}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-2xl
                       bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold
                       hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            aria-label="Abrir página de validação do certificado"
          >
            <LinkIcon className="w-4 h-4" aria-hidden="true" />
            Validar certificado
          </a>
        )}

        <button
          type="button"
          onClick={onClose}
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 rounded-2xl
                     bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold
                     hover:bg-slate-300 dark:hover:bg-slate-700 transition"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
}

ModalCertificadoPreview.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  certificado: PropTypes.shape({
    nome: PropTypes.string,
    cpf: PropTypes.string,
    titulo_evento: PropTypes.string,
    carga_horaria: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    qr_code_url: PropTypes.string,
    pdf_url: PropTypes.string,
    codigo: PropTypes.string,
    gerado_em: PropTypes.string,
    link_validacao: PropTypes.string,
  }),
};
