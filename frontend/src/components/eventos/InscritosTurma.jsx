// ✅ frontend/src/pages/eventos/InscritosTurma.jsx — v2.0
// Atualizado em: 14/05/2026
// Plataforma Escola da Saúde
//
// Página administrativa de inscritos por turma.
//
// Contratos aplicados:
// - Rota oficial de turma: /turma/:id
// - Rota oficial de inscritos da turma: /inscricao/turma/:turma_id
// - Sem /api/turmas
// - Sem /turma/:id/inscrito
// - Sem /api/inscricao/turma manual com prefixo /api no frontend
// - Sem aliases camelCase: usuarioId, inscricaoId
// - Sem toast direto
// - Resposta oficial esperada: ok/data/message
// - CPF protegido por padrão
// - Exportação com CPF completo somente mediante ação explícita na tela
// - Busca por nome, CPF e e-mail
// - Exportação CSV, XLSX e PDF
// - Mobile-first, acessível e com aria-live
// - Sem new Date("YYYY-MM-DD")

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowLeft,
  ArrowUpAZ,
  Clipboard,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  FileText,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  TableProperties,
  UserRound,
  Users,
} from "lucide-react";

import { apiGet } from "../../services/api";
import {
  notifyError,
  notifyInfo,
  notifySuccess,
} from "../../components/ui/AppToast";

/* =====================================================================================
 * Helpers seguros
 * ===================================================================================== */

const somenteDigitos = (valor = "") => String(valor ?? "").replace(/\D/g, "");

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function isAbortLike(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "").toLowerCase();

  return name === "AbortError" || message.includes("abort");
}

function unwrapData(response) {
  if (response && typeof response === "object" && "data" in response) {
    return response.data;
  }

  return response;
}

function unwrapDataArray(response) {
  const data = unwrapData(response);

  return Array.isArray(data) ? data : [];
}

function unwrapDataObject(response) {
  const data = unwrapData(response);

  return data && typeof data === "object" && !Array.isArray(data) ? data : null;
}

function formatarCPF(cpf, { completo = false } = {}) {
  const digitos = somenteDigitos(cpf);

  if (digitos.length !== 11) {
    return cpf ? String(cpf) : "—";
  }

  const formatado = `${digitos.slice(0, 3)}.${digitos.slice(
    3,
    6
  )}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;

  if (completo) {
    return formatado;
  }

  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.***-**`;
}

function cpfParaExportacao(cpf, incluirCompleto) {
  const digitos = somenteDigitos(cpf);

  if (digitos.length !== 11) {
    return cpf ? String(cpf) : "";
  }

  return incluirCompleto ? digitos : formatarCPF(digitos, { completo: false });
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function validarIdNumerico(valor) {
  const numero = Number(valor);

  return Number.isInteger(numero) && numero > 0;
}

function nomeArquivoSeguro(valor) {
  return String(valor || "turma")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 70)
    .toLowerCase();
}

function chaveInscrito(inscrito, index) {
  const inscricao_id = inscrito?.inscricao_id ?? null;
  const usuario_id = inscrito?.usuario_id ?? null;
  const cpf = somenteDigitos(inscrito?.cpf);
  const email = String(inscrito?.email || "").trim().toLowerCase();

  return (
    (inscricao_id != null && `inscricao:${inscricao_id}`) ||
    (usuario_id != null && `usuario:${usuario_id}`) ||
    (cpf && `cpf:${cpf}`) ||
    (email && `email:${email}`) ||
    `linha:${index}`
  );
}

function deduplicarInscritos(lista) {
  const vistos = new Set();

  return (Array.isArray(lista) ? lista : []).filter((inscrito, index) => {
    const chave = chaveInscrito(inscrito, index);

    if (vistos.has(chave)) {
      return false;
    }

    vistos.add(chave);
    return true;
  });
}

function montarLinhasExportacao(lista, incluirCpfCompleto) {
  return [
    ["Nome", "CPF", "E-mail"],
    ...lista.map((inscrito) => [
      inscrito?.nome || "",
      cpfParaExportacao(inscrito?.cpf, incluirCpfCompleto),
      inscrito?.email || "",
    ]),
  ];
}

function gerarCSV(linhas) {
  return linhas
    .map((linha) =>
      linha
        .map((celula) => `"${String(celula ?? "").replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");
}

function baixarBlob({ blob, nomeArquivo }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

async function copiarTexto(texto) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error("Clipboard API indisponível.");
  }

  await navigator.clipboard.writeText(texto);
}

function registrarErroDev(contexto, erro) {
  if (import.meta?.env?.DEV) {
    // eslint-disable-next-line no-console
    console.error(contexto, erro);
  }
}

/* =====================================================================================
 * Página
 * ===================================================================================== */

export default function InscritosTurma() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [turma, setTurma] = useState(null);
  const [inscritos, setInscritos] = useState([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [busca, setBusca] = useState("");
  const buscaDiferida = useDeferredValue(busca);

  const [ordenacao, setOrdenacao] = useState("az");
  const [mostrarCpfCompleto, setMostrarCpfCompleto] = useState(false);
  const [somenteComEmail, setSomenteComEmail] = useState(false);
  const [
    incluirCpfCompletoNasExportacoes,
    setIncluirCpfCompletoNasExportacoes,
  ] = useState(false);

  const liveRef = useRef(null);
  const buscaRef = useRef(null);

  const turmaIdValido = validarIdNumerico(id);

  const carregarDados = useCallback(
    async ({ signal } = {}) => {
      if (!turmaIdValido) {
        setErro("ID da turma inválido.");
        setCarregando(false);
        setTurma(null);
        setInscritos([]);
        return;
      }

      setCarregando(true);
      setErro("");

      try {
        const turma_id = encodeURIComponent(id);

        const [turmaResponse, inscritosResponse] = await Promise.all([
          apiGet(`/turma/${turma_id}`, {
            auth: true,
            on401: "redirect",
            on403: "silent",
            signal,
          }),
          apiGet(`/inscricao/turma/${turma_id}`, {
            auth: true,
            on401: "redirect",
            on403: "silent",
            signal,
          }),
        ]);

        if (signal?.aborted) return;

        setTurma(unwrapDataObject(turmaResponse));
        setInscritos(deduplicarInscritos(unwrapDataArray(inscritosResponse)));
      } catch (error) {
        if (isAbortLike(error)) return;

        registrarErroDev("Erro ao carregar inscritos da turma:", error);

        setTurma(null);
        setInscritos([]);
        setErro("Não foi possível carregar os inscritos desta turma.");
        notifyError("Não foi possível carregar os inscritos.");
      } finally {
        if (!signal?.aborted) {
          setCarregando(false);
        }
      }
    },
    [id, turmaIdValido]
  );

  useEffect(() => {
    const controller = new AbortController();

    carregarDados({ signal: controller.signal });

    return () => controller.abort();
  }, [carregarDados]);

  const inscritosFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaDiferida);
    const termoDigitos = somenteDigitos(buscaDiferida);

    const filtrados = inscritos.filter((inscrito) => {
      if (somenteComEmail && !String(inscrito?.email || "").trim()) {
        return false;
      }

      if (!termo && !termoDigitos) {
        return true;
      }

      const nome = normalizarTexto(inscrito?.nome);
      const email = normalizarTexto(inscrito?.email);
      const cpfDigitos = somenteDigitos(inscrito?.cpf);
      const cpfFormatado = normalizarTexto(
        formatarCPF(inscrito?.cpf, { completo: true })
      );

      return (
        nome.includes(termo) ||
        email.includes(termo) ||
        cpfFormatado.includes(termo) ||
        (termoDigitos && cpfDigitos.includes(termoDigitos))
      );
    });

    const ordenados = [...filtrados].sort((a, b) =>
      String(a?.nome || "").localeCompare(String(b?.nome || ""), "pt-BR", {
        sensitivity: "base",
        ignorePunctuation: true,
      })
    );

    return ordenacao === "az" ? ordenados : ordenados.reverse();
  }, [buscaDiferida, inscritos, ordenacao, somenteComEmail]);

  const totalInscritos = inscritos.length;
  const totalFiltrado = inscritosFiltrados.length;

  const totalComEmail = useMemo(
    () =>
      inscritos.filter((inscrito) => String(inscrito?.email || "").trim())
        .length,
    [inscritos]
  );

  const totalFiltradoComEmail = useMemo(
    () =>
      inscritosFiltrados.filter((inscrito) =>
        String(inscrito?.email || "").trim()
      ).length,
    [inscritosFiltrados]
  );

  const nomeTurma = turma?.nome || `Turma ${id || ""}`.trim();
  const nomeBaseArquivo = `inscritos_${nomeArquivoSeguro(nomeTurma)}_${
    id || "turma"
  }`;

  useEffect(() => {
    if (!liveRef.current) return;

    liveRef.current.textContent = `${totalFiltrado} de ${totalInscritos} inscrito${
      totalInscritos === 1 ? "" : "s"
    } exibido${totalFiltrado === 1 ? "" : "s"}.`;
  }, [totalFiltrado, totalInscritos]);

  const exportarCSV = useCallback(() => {
    try {
      const linhas = montarLinhasExportacao(
        inscritosFiltrados,
        incluirCpfCompletoNasExportacoes
      );

      const csv = gerarCSV(linhas);

      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });

      baixarBlob({
        blob,
        nomeArquivo: `${nomeBaseArquivo}.csv`,
      });

      notifySuccess("CSV exportado com sucesso.");
    } catch (error) {
      registrarErroDev("Falha ao exportar CSV:", error);
      notifyError("Falha ao exportar CSV.");
    }
  }, [
    incluirCpfCompletoNasExportacoes,
    inscritosFiltrados,
    nomeBaseArquivo,
  ]);

  const exportarXLSX = useCallback(async () => {
    try {
      const ExcelJSModule = await import("exceljs");
      const ExcelJS = ExcelJSModule.default || ExcelJSModule;

      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Plataforma Escola da Saúde";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Inscritos");

      worksheet.columns = [
        { header: "Nome", key: "nome", width: 42 },
        { header: "CPF", key: "cpf", width: 20 },
        { header: "E-mail", key: "email", width: 42 },
      ];

      worksheet.getRow(1).font = { bold: true };

      inscritosFiltrados.forEach((inscrito) => {
        worksheet.addRow({
          nome: inscrito?.nome || "",
          cpf: cpfParaExportacao(
            inscrito?.cpf,
            incluirCpfCompletoNasExportacoes
          ),
          email: inscrito?.email || "",
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();

      baixarBlob({
        blob: new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        nomeArquivo: `${nomeBaseArquivo}.xlsx`,
      });

      notifySuccess("XLSX exportado com sucesso.");
    } catch (error) {
      registrarErroDev("Falha ao exportar XLSX:", error);
      notifyError("Falha ao exportar XLSX.");
    }
  }, [
    incluirCpfCompletoNasExportacoes,
    inscritosFiltrados,
    nomeBaseArquivo,
  ]);

  const exportarPDF = useCallback(async () => {
    try {
      const jsPDFModule = await import("jspdf");
      const autoTableModule = await import("jspdf-autotable");

      const { jsPDF } = jsPDFModule;
      const autoTable = autoTableModule.default;

      const documento = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      documento.setFontSize(15);
      documento.text("Lista de Inscritos", 14, 18);

      documento.setFontSize(10);
      documento.text(`Turma: ${nomeTurma}`, 14, 25);
      documento.text(
        `Total exibido: ${totalFiltrado} de ${totalInscritos}`,
        14,
        31
      );

      autoTable(documento, {
        startY: 38,
        head: [["Nome", "CPF", "E-mail"]],
        body: inscritosFiltrados.map((inscrito) => [
          inscrito?.nome || "—",
          cpfParaExportacao(
            inscrito?.cpf,
            incluirCpfCompletoNasExportacoes
          ) || "—",
          inscrito?.email || "—",
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [6, 95, 70],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        didDrawPage: () => {
          const alturaPagina = documento.internal.pageSize.getHeight();

          documento.setFontSize(8);
          documento.text(
            "Documento gerado pela Plataforma Escola da Saúde.",
            14,
            alturaPagina - 8
          );
        },
      });

      documento.save(`${nomeBaseArquivo}.pdf`);
      notifySuccess("PDF gerado com sucesso.");
    } catch (error) {
      registrarErroDev("Falha ao gerar PDF:", error);
      notifyError("Falha ao gerar PDF.");
    }
  }, [
    incluirCpfCompletoNasExportacoes,
    inscritosFiltrados,
    nomeBaseArquivo,
    nomeTurma,
    totalFiltrado,
    totalInscritos,
  ]);

  const copiarEmails = useCallback(async () => {
    try {
      const emails = inscritosFiltrados
        .map((inscrito) => String(inscrito?.email || "").trim())
        .filter(Boolean);

      if (emails.length === 0) {
        notifyInfo("Nenhum e-mail disponível na lista filtrada.");
        return;
      }

      await copiarTexto(emails.join("; "));
      notifySuccess("E-mails copiados.");
    } catch (error) {
      registrarErroDev("Falha ao copiar e-mails:", error);
      notifyError("Não foi possível copiar os e-mails.");
    }
  }, [inscritosFiltrados]);

  const copiarCSV = useCallback(async () => {
    try {
      const linhas = montarLinhasExportacao(
        inscritosFiltrados,
        incluirCpfCompletoNasExportacoes
      );

      const csv = gerarCSV(linhas);

      await copiarTexto(csv);
      notifySuccess("CSV copiado para a área de transferência.");
    } catch (error) {
      registrarErroDev("Falha ao copiar CSV:", error);
      notifyError("Não foi possível copiar o CSV.");
    }
  }, [incluirCpfCompletoNasExportacoes, inscritosFiltrados]);

  const limparFiltros = useCallback(() => {
    setBusca("");
    setOrdenacao("az");
    setSomenteComEmail(false);
    buscaRef.current?.focus();
  }, []);

  if (carregando) {
    return (
      <main
        className="min-h-dvh bg-slate-50 px-4 py-6 dark:bg-slate-950"
        aria-busy="true"
      >
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-36 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="h-96 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </main>
    );
  }

  if (!turmaIdValido || erro) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </button>

          <section
            className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="mt-0.5 h-6 w-6 shrink-0"
                aria-hidden="true"
              />

              <div>
                <h1 className="text-lg font-black">
                  Não foi possível abrir a lista
                </h1>

                <p className="mt-1 text-sm">
                  {erro || "ID da turma inválido."}
                </p>

                <button
                  type="button"
                  onClick={() => carregarDados()}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-rose-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <p
        ref={liveRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      <div className="mx-auto max-w-7xl space-y-5">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-emerald-900/10 bg-white shadow-sm dark:border-emerald-400/10 dark:bg-slate-900"
        >
          <div className="relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 px-5 py-6 text-white sm:px-7">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Voltar
                </button>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-white/15">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Inscritos da turma
                </div>

                <h1 className="mt-3 max-w-4xl text-2xl font-black tracking-tight sm:text-3xl">
                  {nomeTurma}
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-emerald-50/90">
                  Visualização administrativa dos inscritos, com busca,
                  exportação e controles de privacidade para dados pessoais.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:min-w-[430px]">
                <ResumoCard
                  icon={Users}
                  label="Inscritos"
                  value={String(totalInscritos)}
                  hint="Total da turma"
                />

                <ResumoCard
                  icon={Search}
                  label="Exibidos"
                  value={String(totalFiltrado)}
                  hint="Após filtros"
                />

                <ResumoCard
                  icon={Mail}
                  label="Com e-mail"
                  value={String(totalComEmail)}
                  hint="Disponíveis para cópia"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-7">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <label className="relative block">
                <span className="sr-only">
                  Buscar inscrito por nome, CPF ou e-mail
                </span>

                <Search
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />

                <input
                  ref={buscaRef}
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar por nome, CPF ou e-mail..."
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  type="button"
                  onClick={() =>
                    setOrdenacao((valor) => (valor === "az" ? "za" : "az"))
                  }
                  icon={ordenacao === "az" ? ArrowDownAZ : ArrowUpAZ}
                  variant="neutral"
                  ariaPressed={ordenacao === "az"}
                >
                  {ordenacao === "az" ? "A-Z" : "Z-A"}
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={() => setMostrarCpfCompleto((valor) => !valor)}
                  icon={mostrarCpfCompleto ? Eye : EyeOff}
                  variant={mostrarCpfCompleto ? "warning" : "neutral"}
                  ariaPressed={mostrarCpfCompleto}
                >
                  {mostrarCpfCompleto ? "CPF completo" : "CPF protegido"}
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={limparFiltros}
                  icon={RefreshCw}
                  variant="neutral"
                  disabled={!busca && ordenacao === "az" && !somenteComEmail}
                >
                  Limpar
                </ActionButton>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <TogglePill
                  checked={somenteComEmail}
                  onChange={setSomenteComEmail}
                  label="Somente com e-mail"
                />

                <TogglePill
                  checked={incluirCpfCompletoNasExportacoes}
                  onChange={setIncluirCpfCompletoNasExportacoes}
                  label="Exportar CPF completo"
                  danger
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  type="button"
                  onClick={copiarEmails}
                  icon={Copy}
                  variant="neutral"
                  disabled={totalFiltrado === 0 || totalFiltradoComEmail === 0}
                >
                  E-mails
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={copiarCSV}
                  icon={Clipboard}
                  variant="neutral"
                  disabled={totalFiltrado === 0}
                >
                  Copiar CSV
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={exportarCSV}
                  icon={FileDown}
                  variant="neutral"
                  disabled={totalFiltrado === 0}
                >
                  CSV
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={exportarXLSX}
                  icon={FileSpreadsheet}
                  variant="neutral"
                  disabled={totalFiltrado === 0}
                >
                  XLSX
                </ActionButton>

                <ActionButton
                  type="button"
                  onClick={exportarPDF}
                  icon={FileText}
                  variant="primary"
                  disabled={totalFiltrado === 0}
                >
                  PDF
                </ActionButton>
              </div>
            </div>

            {incluirCpfCompletoNasExportacoes && (
              <div
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
                role="status"
              >
                <div className="flex items-start gap-2">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />

                  <p>
                    A exportação com CPF completo está ativada. Use somente
                    quando necessário para finalidade administrativa legítima.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          aria-label="Lista de inscritos"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                <TableProperties className="h-4 w-4" aria-hidden="true" />
                Resultado
              </div>

              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {totalFiltrado} inscrito{totalFiltrado === 1 ? "" : "s"}
              </h2>
            </div>

            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {buscaDiferida || somenteComEmail
                ? `Filtro aplicado sobre ${totalInscritos} registro${
                    totalInscritos === 1 ? "" : "s"
                  }.`
                : "Exibindo todos os registros disponíveis."}
            </div>
          </div>

          {inscritosFiltrados.length === 0 ? (
            <EmptyState
              hasSearch={Boolean(buscaDiferida || somenteComEmail)}
              onClear={limparFiltros}
            />
          ) : (
            <>
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 lg:hidden">
                {inscritosFiltrados.map((inscrito, index) => (
                  <InscritoCard
                    key={chaveInscrito(inscrito, index)}
                    inscrito={inscrito}
                    mostrarCpfCompleto={mostrarCpfCompleto}
                  />
                ))}
              </ul>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                  <thead className="bg-slate-50 dark:bg-slate-950/60">
                    <tr>
                      <Th>Nome</Th>
                      <Th>CPF</Th>
                      <Th>E-mail</Th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {inscritosFiltrados.map((inscrito, index) => (
                      <tr
                        key={chaveInscrito(inscrito, index)}
                        className="transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                      >
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar nome={inscrito?.nome} />

                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {inscrito?.nome || "—"}
                              </div>
                            </div>
                          </div>
                        </Td>

                        <Td>
                          <span className="font-mono text-sm">
                            {formatarCPF(inscrito?.cpf, {
                              completo: mostrarCpfCompleto,
                            })}
                          </span>
                        </Td>

                        <Td>
                          {inscrito?.email ? (
                            <a
                              href={`mailto:${inscrito.email}`}
                              className="break-all text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                            >
                              {inscrito.email}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.section>
      </div>
    </main>
  );
}

/* =====================================================================================
 * Subcomponentes
 * ===================================================================================== */

function ResumoCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-3xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="text-xs font-bold text-emerald-50/80">{label}</div>
          <div className="text-2xl font-black leading-tight">{value}</div>
          <div className="text-[11px] font-medium text-emerald-50/70">
            {hint}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  icon: Icon,
  variant = "neutral",
  disabled = false,
  ariaPressed,
  ...props
}) {
  const styles = {
    neutral:
      "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    primary:
      "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-700",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
  };

  return (
    <button
      {...props}
      disabled={disabled}
      aria-pressed={ariaPressed}
      className={classNames(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant] || styles.neutral
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function TogglePill({ checked, onChange, label, danger = false }) {
  return (
    <label
      className={classNames(
        "inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-bold transition",
        checked
          ? danger
            ? "border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-100"
            : "border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-100"
          : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-emerald-700"
      />
      {label}
    </label>
  );
}

function InscritoCard({ inscrito, mostrarCpfCompleto }) {
  return (
    <li className="p-4">
      <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-start gap-3">
          <Avatar nome={inscrito?.nome} />

          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-black text-slate-900 dark:text-white">
              {inscrito?.nome || "—"}
            </h3>

            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden="true"
                />

                <span className="font-mono">
                  {formatarCPF(inscrito?.cpf, {
                    completo: mostrarCpfCompleto,
                  })}
                </span>
              </div>

              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <Mail
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300"
                  aria-hidden="true"
                />

                {inscrito?.email ? (
                  <a
                    href={`mailto:${inscrito.email}`}
                    className="break-all font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                  >
                    {inscrito.email}
                  </a>
                ) : (
                  <span>—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function Avatar({ nome }) {
  const inicial = String(nome || "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-sm font-black text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900">
      {inicial}
    </span>
  );
}

function Th({ children }) {
  return (
    <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </th>
  );
}

function Td({ children }) {
  return (
    <td className="px-5 py-4 align-middle text-sm text-slate-700 dark:text-slate-200">
      {children}
    </td>
  );
}

function EmptyState({ hasSearch, onClear }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-[1.5rem] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <UserRound className="h-8 w-8" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-lg font-black text-slate-900 dark:text-white">
        Nenhum inscrito encontrado
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {hasSearch
          ? "Não encontramos inscritos com os filtros atuais."
          : "Esta turma ainda não possui inscritos retornados pelo sistema."}
      </p>

      {hasSearch && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}

/* =====================================================================================
 * PropTypes
 * ===================================================================================== */

ResumoCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  hint: PropTypes.string,
};

ActionButton.propTypes = {
  children: PropTypes.node.isRequired,
  icon: PropTypes.elementType.isRequired,
  variant: PropTypes.oneOf(["neutral", "primary", "warning"]),
  disabled: PropTypes.bool,
  ariaPressed: PropTypes.bool,
};

TogglePill.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  danger: PropTypes.bool,
};

InscritoCard.propTypes = {
  inscrito: PropTypes.shape({
    nome: PropTypes.string,
    cpf: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    email: PropTypes.string,
  }).isRequired,
  mostrarCpfCompleto: PropTypes.bool.isRequired,
};

Avatar.propTypes = {
  nome: PropTypes.string,
};

Th.propTypes = {
  children: PropTypes.node.isRequired,
};

Td.propTypes = {
  children: PropTypes.node.isRequired,
};

EmptyState.propTypes = {
  hasSearch: PropTypes.bool.isRequired,
  onClear: PropTypes.func.isRequired,
};