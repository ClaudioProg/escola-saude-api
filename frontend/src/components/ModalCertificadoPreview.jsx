// 📁 src/components/ModalCertificadoPreview.jsx
import PropTypes from "prop-types";
import { useMemo, useState } from "react";
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
import Modal from "./Modal"; // ✅ wrapper padrão
import { formatarCPF } from "../utils/data";

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

  const dataEmissao = useMemo(() => {
    if (typeof gerado_em === "string" && gerado_em.length >= 10) {
      return gerado_em.slice(0, 10).split("-").reverse().join("/");
    }
    return null;
  }, [gerado_em]);

  const [copiado, setCopiado] = useState(false);

  const handleCopyCodigo = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // silencioso: fallback opcional poderia abrir um input selecionável
    }
  };

  const cargaTexto = Number.isFinite(Number(carga_horaria))
    ? `${carga_horaria} horas`
    : "—";

  const statusValidacao = link_validacao ? "disponivel" : "indisponivel";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="titulo-cert-preview"
      describedBy="descricao-cert-preview"
      className="w-[96%] max-w-3xl p-0 overflow-hidden"
    >
      {/* Header com degradê exclusivo (3 cores) */}
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

      {/* Ministats — emissão, carga horária, status */}
      <section className="px-4 sm:px-6 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-cyan-100 dark:border-cyan-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Emissão</span>
          </div>
          <div className="text-lg font-bold">{dataEmissao || "—"}</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Data de emissão</div>
        </div>

        <div className="rounded-2xl border border-cyan-100 dark:border-cyan-900 p-3 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-1">
            <Clock3 className="w-5 h-5" aria-hidden="true" />
            <span className="font-semibold">Carga horária</span>
          </div>
          <div className="text-lg font-bold">{cargaTexto}</div>
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
            className={`inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full border ${
              statusValidacao === "disponivel"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200"
            }`}
          >
            {statusValidacao === "disponivel" ? "Link disponível" : "Link indisponível"}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Verificação pública do certificado
          </div>
        </div>
      </section>

      {/* Live region para leitores de tela */}
      <div aria-live="polite" className="sr-only">
        {statusValidacao === "disponivel" ? "Validação disponível." : "Validação indisponível."}
      </div>

      {/* Corpo principal */}
      <section className="px-4 sm:px-6 pt-4 pb-24 space-y-4">
        {/* Dados principais */}
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700 p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-300">Nome</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-medium">{nome || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-300">CPF</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-medium">
                {cpf ? formatarCPF(cpf) : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500 dark:text-slate-300">Evento</dt>
              <dd className="text-slate-900 dark:text-slate-100 font-medium">{titulo_evento || "—"}</dd>
            </div>
          </dl>

          {/* Código do certificado (copiável) */}
          <div className="mt-4">
            <span className="block text-slate-500 dark:text-slate-300 text-sm mb-1">
              Código do certificado
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md border text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 break-all">
                {codigo || "—"}
              </span>
              {codigo ? (
                <button
                  type="button"
                  onClick={handleCopyCodigo}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
                  aria-label="Copiar código do certificado"
                >
                  {copiado ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
            <QrCode className="w-4 h-4" aria-hidden="true" />
            Verificação por QR Code
          </h3>
          {qr_code_url ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={qr_code_url}
                alt={`QR Code do certificado${codigo ? ` ${codigo}` : ""}`}
                className="w-36 h-36 border p-2 rounded-md bg-white"
              />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Aponte a câmera do celular para validar rapidamente.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
              <FileWarning className="w-4 h-4" />
              QR Code não disponível.
            </div>
          )}
        </div>
      </section>

      {/* Barra de ações sticky (mobile-first) */}
      <div className="sticky bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-end gap-2">
        {pdf_url && (
          <a
            href={pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
            aria-label="Abrir página de validação do certificado"
          >
            <LinkIcon className="w-4 h-4" aria-hidden="true" />
            Validar certificado
          </a>
        )}

        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
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
