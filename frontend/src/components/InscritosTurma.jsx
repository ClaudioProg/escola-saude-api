// 📁 src/components/InscritosTurma.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import CabecalhoPainel from "../components/CabecalhoPainel";
import { apiGet } from "../services/api"; // ✅ serviço centralizado
import { Search, FileText, FileDown, Copy, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function InscritosTurma() {
  const { id } = useParams(); // ID da turma
  const navigate = useNavigate();

  const [inscritos, setInscritos] = useState([]);
  const [turma, setTurma] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [ordenarAZ, setOrdenarAZ] = useState(true);
  const [mostrarCpf, setMostrarCpf] = useState(true);

  // ------- Utils -------
  const somenteDigitos = (v = "") => String(v).replace(/\D/g, "");

  /** Formata CPF; por padrão exibe conforme `mostrarCpf` */
  const formatarCPF = (cpf, opts = {}) => {
    const { exibirCompleto = mostrarCpf } = opts;
    const s = somenteDigitos(cpf);
    if (s.length !== 11) return cpf || "—";
    const fmt = `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
    if (exibirCompleto) return fmt;
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.***-**`;
  };

  // ------- Carregamento -------
  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      setErro("ID da turma inválido.");
      toast.error("⚠️ ID da turma é inválido.");
      setCarregando(false);
      return;
    }

    const ctrl = new AbortController();

    (async () => {
      setCarregando(true);
      try {
        const [turmaData, inscritosData] = await Promise.all([
          apiGet(`/api/turmas/${id}`, { signal: ctrl.signal }),
          apiGet(`/api/inscricoes/turma/${id}`, { signal: ctrl.signal }),
        ]);
        setTurma(turmaData);

        const lista = Array.isArray(inscritosData) ? inscritosData : [];
        // remove duplicados por usuario_id/cpf/email
        const seen = new Set();
        const dedup = lista.filter((i, idx) => {
          const key = i.usuario_id ?? somenteDigitos(i.cpf) ?? i.email ?? idx;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setInscritos(dedup);
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("❌ Erro ao buscar dados da turma:", err);
          setErro("Erro ao carregar inscritos ou turma.");
          toast.error("❌ Erro ao carregar dados.");
        }
      } finally {
        setCarregando(false);
      }
    })();

    return () => ctrl.abort();
  }, [id]);

  // ------- Derivados (filtro + ordenação) -------
  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = inscritos.filter((i) => {
      if (!q) return true;
      const nome = (i.nome || "").toLowerCase();
      const cpfDigits = somenteDigitos(i.cpf);
      const cpfFormatFull = formatarCPF(i.cpf, { exibirCompleto: true }).toLowerCase(); // sempre completo p/ busca
      const email = (i.email || "").toLowerCase();
      return nome.includes(q) || email.includes(q) || cpfDigits.includes(q) || cpfFormatFull.includes(q);
    });

    if (ordenarAZ) {
      base.sort((a, b) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
          sensitivity: "base",
          ignorePunctuation: true,
        })
      );
    }
    return base;
  }, [inscritos, busca, ordenarAZ]); // busca não depende de mostrarCpf mais

  const total = inscritos.length;
  const totalFiltrado = listaFiltrada.length;

  // ------- Exportações -------
  const exportarPDF = async () => {
    if (!turma) return;
    try {
      const jsPDFModule = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDFModule.jsPDF();

      doc.setFontSize(16);
      doc.text(`Lista de Inscritos – ${turma.nome || `Turma ${id}`}`, 14, 18);

      autoTable(doc, {
        startY: 28,
        head: [["Nome", "CPF", "E-mail"]],
        body: listaFiltrada.map((i) => [
          i.nome || "—",
          formatarCPF(i.cpf, { exibirCompleto: true }),
          i.email || "—",
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [6, 95, 70] }, // emerald-800
        alternateRowStyles: { fillColor: [245, 245, 245] },
        didDrawPage: (data) => {
          const str = `Gerado em ${new Date().toLocaleString("pt-BR")}`;
          doc.setFontSize(9);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 6);
        },
      });

      doc.save(`inscritos_turma_${turma.id || id}.pdf`);
      toast.success("✅ PDF gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("❌ Falha ao gerar PDF.");
    }
  };

  const exportarCSV = () => {
    try {
      const rows = [
        ["Nome", "CPF", "E-mail"],
        ...listaFiltrada.map((i) => [i.nome || "", somenteDigitos(i.cpf), i.email || ""]),
      ];
      const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inscritos_turma_${turma?.id || id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("✅ CSV exportado!");
    } catch {
      toast.error("❌ Falha ao exportar CSV.");
    }
  };

  const copiarEmails = async () => {
    try {
      const emails = listaFiltrada.map((i) => i.email).filter(Boolean);
      if (emails.length === 0) {
        toast.info("Nenhum e-mail para copiar.");
        return;
      }
      await navigator.clipboard.writeText(emails.join("; "));
      toast.success("📋 E-mails copiados!");
    } catch {
      toast.error("❌ Não foi possível copiar os e-mails.");
    }
  };

  // ------- UI -------
  if (carregando) {
    return (
      <div className="max-w-3xl mx-auto mt-12 p-6" aria-busy="true" aria-live="polite">
        <div className="animate-pulse h-8 bg-gray-200 rounded mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded mb-3" />
        ))}
      </div>
    );
  }

  if (erro) {
    return <p className="text-center text-red-600 mt-10" role="alert" aria-live="assertive">{erro}</p>;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs
        trilha={[
          { label: "Painel do Administrador", href: "/administrador" },
          { label: "Inscritos da Turma" },
        ]}
      />

      <CabecalhoPainel
        tituloOverride={`Inscritos – ${turma?.nome || "Turma"}`}
        // saudação padrão do componente permanece habilitada
        actions={
          <div className="flex flex-wrap gap-2">
            <BotaoSecundario onClick={() => navigate(-1)} leftIcon={<ArrowLeft size={16} />} cor="gray" aria-label="Voltar">
              Voltar
            </BotaoSecundario>
            <BotaoSecundario onClick={copiarEmails} leftIcon={<Copy size={16} />} aria-label="Copiar e-mails">
              Copiar e-mails
            </BotaoSecundario>
            <BotaoSecundario onClick={exportarCSV} leftIcon={<FileDown size={16} />} aria-label="Exportar CSV">
              CSV
            </BotaoSecundario>
            <BotaoPrimario onClick={exportarPDF} leftIcon={<FileText size={16} />} aria-label="Exportar lista em PDF">
              PDF
            </BotaoPrimario>
          </div>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg"
        aria-label="Lista de Inscritos da Turma"
      >
        {/* Filtros locais */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <label className="relative flex-1">
            <span className="sr-only">Buscar por nome, CPF ou e-mail</span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, CPF ou e-mail…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              aria-label="Buscar por nome, CPF ou e-mail"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </label>

          <button
            type="button"
            onClick={() => setOrdenarAZ((v) => !v)}
            className="px-3 py-2 rounded-lg text-sm border bg-white dark:bg-zinc-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-pressed={ordenarAZ}
            aria-label="Alternar ordenação alfabética"
            title="Ordenar A→Z"
          >
            {ordenarAZ ? "A→Z" : "—"}
          </button>

          <button
            type="button"
            onClick={() => setMostrarCpf((v) => !v)}
            className="px-3 py-2 rounded-lg text-sm border bg-white dark:bg-zinc-800 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-pressed={mostrarCpf}
            aria-label="Alternar exibição do CPF"
            title="Mostrar/ocultar CPF"
          >
            {mostrarCpf ? <Eye className="w-4 h-4 inline" /> : <EyeOff className="w-4 h-4 inline" />} CPF
          </button>
        </div>

        {/* Título / contagem */}
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xl font-bold text-emerald-900 dark:text-white">👥 Inscritos</h2>
          <span className="text-sm font-normal text-gray-500 dark:text-gray-300">
            {totalFiltrado}/{total}
          </span>
        </div>

        {/* Lista */}
        {listaFiltrada.length === 0 ? (
          <div className="flex flex-col items-center py-16" aria-live="polite">
            <span className="text-5xl mb-2">🗒️</span>
            <p className="text-gray-500 dark:text-gray-300 font-semibold">
              Nenhum inscrito encontrado{busca ? " para a busca." : " para esta turma."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {listaFiltrada.map((inscrito, idx) => {
              const key =
                inscrito.usuario_id ??
                somenteDigitos(inscrito.cpf) ??
                `${inscrito.email || "sem-email"}-${idx}`;

              return (
                <li
                  key={key}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 py-3"
                  tabIndex={0}
                  aria-label={`Inscrito: ${inscrito.nome || "—"}`}
                >
                  <span className="font-semibold text-gray-700 dark:text-white break-words">
                    {inscrito.nome || "—"}
                  </span>
                  <span className="text-gray-500 dark:text-gray-300">
                    {formatarCPF(inscrito.cpf)}
                  </span>
                  <span className="text-gray-400 dark:text-gray-300 break-all">
                    {inscrito.email || "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>
    </main>
  );
}
