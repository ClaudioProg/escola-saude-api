// ✅ frontend/src/pages/organizadorPresenca.jsx — v2.0
// Atualizado em: 15/05/2026
// Plataforma Escola da Saúde

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Filter,
  PenLine,
  Presentation,
  RefreshCw,
  XCircle,
} from "lucide-react";

import Footer from "../components/layout/Footer";
import HeaderHero from "../components/layout/HeaderHero";
import Turmasorganizador from "../components/organizadores/TurmasOrganizador";
import ModalAssinatura from "../components/usuarios/ModalAssinatura";
import CarregandoSkeleton from "../components/ui/CarregandoSkeleton";
import ErroCarregamento from "../components/ui/ErroCarregamento";
import NadaEncontrado from "../components/ui/NadaEncontrado";
import { notifyError, notifySuccess, notifyWarning } from "../components/ui/AppToast";
import { api } from "../services/api";
import { formatDateBr } from "../utils/dateTime";

/* ─────────────────────────────────────────────
 * Contratos oficiais esperados no api.js
 * ─────────────────────────────────────────────
 *
 * api.organizador.minhasTurmas({ filtro })
 * api.presenca.detalhesTurma(turma_id)
 * api.inscricao.porTurma(turma_id)
 * api.avaliacao.porTurma(turma_id)
 * api.turma.datasAuto(turma_id)
 * api.assinatura.minha()
 *
 * Rotas backend oficiais envolvidas:
 * GET /api/organizador/minhas/turmas?filtro=ativos|encerrados|todos
 * GET /api/presenca/turma/:turma_id/detalhes
 * GET /api/inscricao/turma/:turma_id
 * GET /api/avaliacao/turma/:turma_id
 * GET /api/turma/:turma_id/datas
 * GET /api/assinatura
 */

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function extrairData(response) {
  return response?.data ?? response ?? null;
}

function obterMensagemErro(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.data?.message ||
    error?.message ||
    fallback
  );
}

function validarFacade(nome, fn) {
  if (typeof fn !== "function") {
    throw new Error(`Facade ausente no api.js: ${nome}.`);
  }
}

function toPositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function ymd(value) {
  if (!value) return "";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function todayYMD() {
  const date = new Date();
  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function hhmm(value, fallback = "") {
  const text = String(value || "");

  return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : fallback;
}

function formatarDocumento(value) {
  const digits = String(value || "").replace(/\D+/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  return value || "—";
}

function getUsuarioLogado() {
  try {
    const raw = localStorage.getItem("usuario");
    const parsed = raw ? JSON.parse(raw) : null;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizarTurma(turma) {
  const id = toPositiveInt(turma?.id);
  const eventoId = toPositiveInt(turma?.evento?.id || turma?.evento_id);

  if (!id || !eventoId) return null;

  return {
    ...turma,
    id,
    evento_id: eventoId,
    nome: turma?.nome || `Turma #${id}`,
    data_inicio: ymd(turma?.data_inicio),
    data_fim: ymd(turma?.data_fim || turma?.data_inicio),
    horario_inicio: hhmm(turma?.horario_inicio),
    horario_fim: hhmm(turma?.horario_fim),
    status: turma?.status || "programado",
    evento: {
      id: eventoId,
      nome: turma?.evento?.nome || turma?.evento_nome || "Evento",
      local: turma?.evento?.local || turma?.evento_local || "",
    },
    datas: safeArray(turma?.datas),
  };
}

function ordenarTurmasPorDataDesc(turmas) {
  return safeArray(turmas)
    .slice()
    .sort((a, b) => {
      const dataA = ymd(a?.data_inicio);
      const dataB = ymd(b?.data_inicio);

      return dataB.localeCompare(dataA);
    });
}

function statusFiltroTurma(turma, hoje) {
  const fim = ymd(turma?.data_fim);

  if (!fim) return "ativos";

  return fim < hoje ? "encerrados" : "ativos";
}

function normalizarDataItem(item, turma) {
  const data = ymd(item?.data || item);

  if (!data) return null;

  return {
    data,
    horario_inicio: hhmm(item?.horario_inicio, turma?.horario_inicio || ""),
    horario_fim: hhmm(item?.horario_fim, turma?.horario_fim || ""),
  };
}

function calcularFrequenciaResumo(detalhes) {
  const datas = safeArray(detalhes?.datas);
  const usuarios = safeArray(detalhes?.usuarios);
  const totalDias = datas.length;

  return usuarios.map((usuario) => {
    const presencas = safeArray(usuario?.presencas);
    const presentes = presencas.filter((presenca) => presenca?.presente === true).length;
    const frequencia = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;

    return {
      usuario_id: usuario?.id,
      nome: usuario?.nome,
      cpf: usuario?.cpf,
      presente: frequencia >= 75,
      frequencia: `${frequencia}%`,
    };
  });
}

/* ─────────────────────────────────────────────
 * Componentes locais
 * ───────────────────────────────────────────── */

function MiniStat({ icon: Icon, label, value, description, tone = "cyan" }) {
  const tones = {
    cyan: "bg-cyan-50 text-cyan-900 ring-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-900",
    emerald: "bg-emerald-50 text-emerald-900 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900",
    amber: "bg-amber-50 text-amber-900 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900",
    violet: "bg-violet-50 text-violet-900 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-900",
  };

  return (
    <div className={cx("rounded-[1.5rem] p-4 ring-1 shadow-sm", tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide opacity-75">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{Number(value) || 0}</p>
          {description ? (
            <p className="mt-1 text-xs opacity-75">{description}</p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function ChipFiltro({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        active
          ? "bg-violet-800 text-white"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-700"
      )}
    >
      <span>{label}</span>

      <span
        className={cx(
          "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[11px]",
          active
            ? "bg-white/20 text-white"
            : "bg-white text-slate-700 dark:bg-white/10 dark:text-zinc-200"
        )}
      >
        {Number(count) || 0}
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────
 * Página principal
 * ───────────────────────────────────────────── */

export default function organizadorPresenca() {
  const usuario = useMemo(() => getUsuarioLogado(), []);
  const nome = usuario?.nome || "";

  const liveRef = useRef(null);
  const mountedRef = useRef(true);

  const [turmas, setTurmas] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  const [filtro, setFiltro] = useState("ativos");

  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacaoPorTurma, setAvaliacaoPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [datasPorTurma, setDatasPorTurma] = useState({});

  const [turmaExpandidaInscritos, setTurmaExpandidaInscritos] = useState(null);
  const [turmaExpandidaAvaliacao, setTurmaExpandidaAvaliacao] = useState(null);

  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinatura, setAssinatura] = useState(null);

  const setLive = useCallback((message) => {
    if (liveRef.current) liveRef.current.textContent = message;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    document.title = "Presenças do organizador | Escola da Saúde";

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const carregarPresencas = useCallback(
    async (turmaIdRaw, { silent = false } = {}) => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) return;

      try {
        validarFacade("api.presenca.detalhesTurma", api?.presenca?.detalhesTurma);

        const response = await api.presenca.detalhesTurma(turmaId);
        const data = extrairData(response) || {};
        const datas = safeArray(data?.datas);
        const usuarios = safeArray(data?.usuarios);

        const lista = calcularFrequenciaResumo({
          datas,
          usuarios,
        });

        if (!mountedRef.current) return;

        setPresencasPorTurma((prev) => ({
          ...prev,
          [turmaId]: {
            detalhado: {
              datas,
              usuarios,
            },
            lista,
          },
        }));
      } catch (error) {
        if (!silent) {
          notifyError(
            obterMensagemErro(error, "Erro ao carregar presenças da turma.")
          );
        }

        if (!mountedRef.current) return;

        setPresencasPorTurma((prev) => ({
          ...prev,
          [turmaId]: {
            detalhado: {
              datas: [],
              usuarios: [],
            },
            lista: [],
          },
        }));
      }
    },
    []
  );

  const carregarAssinatura = useCallback(async () => {
    try {
      validarFacade("api.assinatura.minha", api?.assinatura?.minha);

      const response = await api.assinatura.minha();
      const data = extrairData(response);

      if (!mountedRef.current) return;

      setAssinatura(data?.assinatura || data || null);
    } catch {
      if (!mountedRef.current) return;
      setAssinatura(null);
    }
  }, []);

  const carregarTurmas = useCallback(
    async () => {
      try {
        validarFacade("api.organizador.minhasTurmas", api?.organizador?.minhasTurmas);

        setCarregando(true);
        setErro("");
        setLive("Carregando suas turmas.");

        const response = await api.organizador.minhasTurmas({ filtro: "todos" });
        const data = extrairData(response);
        const lista = safeArray(data)
          .map(normalizarTurma)
          .filter(Boolean);

        const ordenadas = ordenarTurmasPorDataDesc(lista);

        if (!mountedRef.current) return;

        setTurmas(ordenadas);
        setLive(`${ordenadas.length} turma(s) carregada(s).`);

        Promise.allSettled(
          ordenadas.map((turma) =>
            carregarPresencas(turma.id, {
              silent: true,
            })
          )
        );

        await carregarAssinatura();
      } catch (error) {
        console.error("[organizadorPresenca] erro ao carregar turmas:", error);

        if (!mountedRef.current) return;

        const message = obterMensagemErro(
          error,
          "Erro ao carregar suas turmas."
        );

        setErro(message);
        setTurmas([]);
        notifyError(message);
        setLive("Erro ao carregar suas turmas.");
      } finally {
        if (mountedRef.current) setCarregando(false);
      }
    },
    [carregarAssinatura, carregarPresencas, setLive]
  );

  useEffect(() => {
    carregarTurmas();
  }, [carregarTurmas]);

  const carregarInscritos = useCallback(async (turmaIdRaw) => {
    const turmaId = toPositiveInt(turmaIdRaw);

    if (!turmaId) {
      notifyError("Turma inválida para consulta de inscritos.");
      return;
    }

    try {
      validarFacade("api.inscricao.porTurma", api?.inscricao?.porTurma);

      const response = await api.inscricao.porTurma(turmaId);
      const data = extrairData(response);

      setInscritosPorTurma((prev) => ({
        ...prev,
        [turmaId]: safeArray(data),
      }));
    } catch (error) {
      notifyError(obterMensagemErro(error, "Erro ao carregar inscritos."));
    }
  }, []);

  const carregarAvaliacao = useCallback(
    async (turmaIdRaw) => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) {
        notifyError("Turma inválida para consulta de avaliações.");
        return;
      }

      if (avaliacaoPorTurma[turmaId]) return;

      try {
        validarFacade("api.avaliacao.porTurma", api?.avaliacao?.porTurma);

        const response = await api.avaliacao.porTurma(turmaId);
        const data = extrairData(response);

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turmaId]: safeArray(data),
        }));
      } catch (error) {
        notifyError(obterMensagemErro(error, "Erro ao carregar avaliações."));

        setAvaliacaoPorTurma((prev) => ({
          ...prev,
          [turmaId]: [],
        }));
      }
    },
    [avaliacaoPorTurma]
  );

  const carregarDatasPorTurma = useCallback(
    async (turmaIdRaw) => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) return;

      try {
        validarFacade("api.turma.datasAuto", api?.turma?.datasAuto);

        const turma = turmas.find((item) => Number(item.id) === turmaId);
        const response = await api.turma.datasAuto(turmaId);
        const data = extrairData(response);

        const normalizadas = safeArray(data)
          .map((item) => normalizarDataItem(item, turma))
          .filter(Boolean);

        const viaPresencas = safeArray(presencasPorTurma[turmaId]?.detalhado?.datas)
          .map((item) => normalizarDataItem(item, turma))
          .filter(Boolean);

        setDatasPorTurma((prev) => ({
          ...prev,
          [turmaId]: normalizadas.length ? normalizadas : viaPresencas,
        }));
      } catch {
        setDatasPorTurma((prev) => ({
          ...prev,
          [turmaId]: [],
        }));
      }
    },
    [presencasPorTurma, turmas]
  );

  const obterDatasReais = useCallback(
    async (turma) => {
      const turmaId = toPositiveInt(turma?.id);

      if (!turmaId) return [];

      const emEstado = datasPorTurma[turmaId];

      if (Array.isArray(emEstado) && emEstado.length) {
        return emEstado
          .map((item) => normalizarDataItem(item, turma))
          .filter(Boolean);
      }

      try {
        validarFacade("api.turma.datasAuto", api?.turma?.datasAuto);

        const response = await api.turma.datasAuto(turmaId);
        const data = extrairData(response);

        const normalizadas = safeArray(data)
          .map((item) => normalizarDataItem(item, turma))
          .filter(Boolean);

        if (normalizadas.length) return normalizadas;
      } catch {
        // usa fontes locais abaixo
      }

      const viaPresencas = safeArray(presencasPorTurma[turmaId]?.detalhado?.datas)
        .map((item) => normalizarDataItem(item, turma))
        .filter(Boolean);

      if (viaPresencas.length) return viaPresencas;

      return safeArray(turma?.datas)
        .map((item) => normalizarDataItem(item, turma))
        .filter(Boolean);
    },
    [datasPorTurma, presencasPorTurma]
  );

  const gerarRelatorioPDF = useCallback(
    async (turmaIdRaw) => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) {
        notifyError("Turma inválida para relatório.");
        return;
      }

      try {
        const [{ default: jsPDF }, auto] = await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
        ]);

        const autoTable = auto.default;

        validarFacade("api.presenca.detalhesTurma", api?.presenca?.detalhesTurma);

        const response = await api.presenca.detalhesTurma(turmaId);
        const data = extrairData(response) || {};
        const datas = safeArray(data?.datas);
        const usuarios = safeArray(data?.usuarios);
        const totalDias = datas.length;

        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("Relatório de Presenças por Turma", 14, 20);

        const linhas = usuarios.map((usuario) => {
          const presencas = safeArray(usuario?.presencas);
          const presentes = presencas.filter((presenca) => presenca?.presente === true).length;
          const frequencia = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;

          return [
            usuario?.nome || "—",
            formatarDocumento(usuario?.cpf),
            `${frequencia}%`,
            frequencia >= 75 ? "Sim" : "Não",
          ];
        });

        autoTable(doc, {
          startY: 30,
          head: [["Nome", "Documento", "Frequência", "≥ 75%"]],
          body: linhas,
        });

        doc.save(`relatorio_turma_${turmaId}.pdf`);
        notifySuccess("PDF de presença gerado.");
      } catch (error) {
        console.error("[organizadorPresenca] erro ao gerar relatório:", error);
        notifyError("Erro ao gerar relatório em PDF.");
      }
    },
    []
  );

  const gerarListaAssinaturaPDF = useCallback(
    async (turmaIdRaw) => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) {
        notifyError("Turma inválida para lista de assinatura.");
        return;
      }

      try {
        const [{ default: jsPDF }, auto] = await Promise.all([
          import("jspdf"),
          import("jspdf-autotable"),
        ]);

        const autoTable = auto.default;
        const turma = turmas.find((item) => Number(item.id) === turmaId);

        if (!turma) {
          notifyError("Turma não encontrada.");
          return;
        }

        let alunos = inscritosPorTurma[turmaId];

        if (!alunos) {
          validarFacade("api.inscricao.porTurma", api?.inscricao?.porTurma);

          const response = await api.inscricao.porTurma(turmaId);
          alunos = safeArray(extrairData(response));
        }

        if (!alunos?.length) {
          notifyWarning("Nenhum inscrito encontrado para esta turma.");
          return;
        }

        const datasReais = await obterDatasReais(turma);

        if (!datasReais.length) {
          notifyWarning("Nenhuma data encontrada para gerar lista de assinatura.");
          return;
        }

        const doc = new jsPDF();

        datasReais.forEach((item, index) => {
          if (index > 0) doc.addPage();

          const dataFormatada = formatDateBr(item.data);
          const horaInicio = item.horario_inicio || turma.horario_inicio || "";
          const horaFim = item.horario_fim || turma.horario_fim || "";

          doc.setFontSize(14);
          doc.text(
            `Lista de Assinatura - ${turma.evento?.nome || "Evento"} - ${turma.nome || ""}`,
            14,
            20
          );

          doc.setFontSize(11);
          doc.text(`Data: ${dataFormatada} | Horário: ${horaInicio} às ${horaFim}`, 14, 28);

          autoTable(doc, {
            startY: 34,
            head: [["Nome", "Documento", "Assinatura"]],
            body: alunos.map((aluno) => [
              aluno?.nome || "—",
              formatarDocumento(aluno?.cpf),
              "______________________",
            ]),
          });
        });

        doc.save(`lista_assinatura_turma_${turmaId}.pdf`);
        notifySuccess("Lista de assinatura gerada.");
      } catch (error) {
        console.error("[organizadorPresenca] erro ao gerar lista:", error);
        notifyError("Erro ao gerar lista de assinatura.");
      }
    },
    [inscritosPorTurma, obterDatasReais, turmas]
  );

  const gerarQrCodePresencaPDF = useCallback(
    async (turmaIdRaw, nomeEvento = "Evento") => {
      const turmaId = toPositiveInt(turmaIdRaw);

      if (!turmaId) {
        notifyError("Turma inválida para QR Code.");
        return;
      }

      try {
        const [{ default: jsPDF }, { QRCodeCanvas }] = await Promise.all([
          import("jspdf"),
          import("qrcode.react"),
        ]);

        const { createRoot } = await import("react-dom/client");
        const turma = turmas.find((item) => Number(item.id) === turmaId);

        if (!turma) {
          notifyError("Turma não encontrada.");
          return;
        }

        const base =
          typeof window !== "undefined" && window.location?.origin
            ? window.location.origin
            : "https://escoladasaude.vercel.app";

        const url = `${base.replace(/\/+$/, "")}/presenca?turma=${encodeURIComponent(turmaId)}`;

        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-99999px";

        document.body.appendChild(container);

        const root = createRoot(container);

        root.render(<QRCodeCanvas value={url} size={300} includeMargin />);

        await new Promise((resolve) => window.setTimeout(resolve, 80));

        const canvas = container.querySelector("canvas");
        const dataUrl = canvas?.toDataURL?.("image/png");

        root.unmount();
        container.remove();

        if (!dataUrl) {
          notifyError("Erro ao gerar imagem do QR Code.");
          return;
        }

        const doc = new jsPDF({
          orientation: "landscape",
        });

        const pageW = doc.internal.pageSize.getWidth();
        const centerX = pageW / 2;

        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.text(String(nomeEvento || turma?.evento?.nome || "Evento"), centerX, 30, {
          align: "center",
        });

        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        doc.text(`organizador: ${nome || "organizador"}`, centerX, 42, {
          align: "center",
        });

        const qrW = 110;

        doc.addImage(dataUrl, "PNG", centerX - qrW / 2, 54, qrW, qrW);

        doc.setFontSize(12);
        doc.setTextColor(60);
        doc.text(
          "Faça login na plataforma e escaneie este QR Code para confirmar presença.",
          centerX,
          54 + qrW + 14,
          {
            align: "center",
          }
        );

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(url, centerX, 54 + qrW + 22, {
          align: "center",
        });

        doc.save(`qr_presenca_turma_${turmaId}.pdf`);
        notifySuccess("QR Code gerado.");
      } catch (error) {
        console.error("[organizadorPresenca] erro ao gerar QR Code:", error);
        notifyError("Erro ao gerar QR Code.");
      }
    },
    [nome, turmas]
  );

  const hoje = useMemo(() => todayYMD(), []);

  const turmasComStatus = useMemo(() => {
    return safeArray(turmas).map((turma) => ({
      ...turma,
      _statusUI: statusFiltroTurma(turma, hoje),
    }));
  }, [turmas, hoje]);

  const turmasFiltradas = useMemo(() => {
    return turmasComStatus.filter((turma) => turma?._statusUI === filtro);
  }, [turmasComStatus, filtro]);

  const kpis = useMemo(() => {
    let programadas = 0;
    let andamento = 0;
    let realizadas = 0;

    for (const turma of safeArray(turmas)) {
      const inicio = ymd(turma?.data_inicio);
      const fim = ymd(turma?.data_fim);

      if (!inicio || !fim) continue;

      if (inicio > hoje) {
        programadas += 1;
      } else if (inicio <= hoje && fim >= hoje) {
        andamento += 1;
      } else if (fim < hoje) {
        realizadas += 1;
      }
    }

    return {
      total: turmas.length,
      programadas,
      andamento,
      realizadas,
    };
  }, [turmas, hoje]);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-white">
      <HeaderHero
  titulo="Presenças do organizador"
  subtitulo="Gerencie suas turmas, listas de presença, relatórios, assinaturas e QR Codes."
  icon={Presentation}
/>

      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {carregando ? (
        <div
          className="sticky top-0 z-50 h-1 w-full bg-violet-100 dark:bg-violet-950"
          role="progressbar"
          aria-label="Carregando turmas do organizador"
        >
          <div className="h-full w-1/3 animate-pulse bg-violet-700" />
        </div>
      ) : null}

      <main
        id="conteudo"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6"
      >
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
  <div className="rounded-[1.5rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-zinc-900 dark:ring-zinc-800">
    <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
      Status da assinatura
    </p>

    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {!assinatura ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800 ring-1 ring-amber-200">
          <XCircle className="h-4 w-4" />
          Sem assinatura cadastrada
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Assinatura cadastrada
        </span>
      )}

      <button
        type="button"
        onClick={() => setModalAssinaturaAberto(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
      >
        <PenLine className="h-4 w-4" />
        Gerenciar assinatura
      </button>
    </div>
  </div>

  <button
    type="button"
    onClick={carregarTurmas}
    disabled={carregando}
    className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-white px-5 py-4 text-sm font-black text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-white dark:ring-zinc-800 dark:hover:bg-zinc-800"
  >
    <RefreshCw className={cx("h-4 w-4", carregando && "animate-spin")} />
    {carregando ? "Atualizando..." : "Atualizar turmas"}
  </button>
</section>

<section
  aria-label="Resumo das turmas do organizador"
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
>
  <MiniStat
    icon={CalendarDays}
    label="Total"
    value={kpis.total}
    description="Turmas vinculadas"
    tone="violet"
  />

  <MiniStat
    icon={CalendarClock}
    label="Programadas"
    value={kpis.programadas}
    description="Aguardando início"
    tone="cyan"
  />

  <MiniStat
    icon={CheckCircle2}
    label="Em andamento"
    value={kpis.andamento}
    description="Turmas ativas hoje"
    tone="emerald"
  />

  <MiniStat
    icon={CalendarCheck2}
    label="Realizadas"
    value={kpis.realizadas}
    description="Turmas encerradas"
    tone="amber"
  />
</section>

        <section
          aria-label="Filtros de turmas"
          className="sticky top-2 z-30 rounded-[1.5rem] bg-white/85 p-3 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-zinc-900/85 dark:ring-zinc-800"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />

              <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Filtrar
              </span>

              <ChipFiltro
                active={filtro === "ativos"}
                onClick={() => setFiltro("ativos")}
                label="Ativos"
                count={(kpis.programadas || 0) + (kpis.andamento || 0)}
              />

              <ChipFiltro
                active={filtro === "encerrados"}
                onClick={() => setFiltro("encerrados")}
                label="Encerrados"
                count={kpis.realizadas || 0}
              />
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Exibindo <strong>{turmasFiltradas.length}</strong> turma(s)
            </div>
          </div>
        </section>

        {erro ? <ErroCarregamento mensagem={erro} onRetry={carregarTurmas} /> : null}

        {carregando && turmasFiltradas.length === 0 ? (
          <section aria-label="Carregando turmas" className="grid gap-4">
            <CarregandoSkeleton height={150} />
            <CarregandoSkeleton height={150} />
            <CarregandoSkeleton height={150} />
          </section>
        ) : turmas.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhuma turma encontrada"
            descricao="Quando houver turmas vinculadas ao seu perfil de organizador, elas aparecerão aqui."
          />
        ) : turmasFiltradas.length === 0 ? (
          <NadaEncontrado
            titulo="Nenhuma turma neste filtro"
            descricao="Altere o filtro para visualizar outras turmas."
          />
        ) : (
          <Turmasorganizador
            turmas={turmasFiltradas}
            inscritosPorTurma={inscritosPorTurma}
            avaliacaoPorTurma={avaliacaoPorTurma}
            presencasPorTurma={presencasPorTurma}
            onVerInscritos={carregarInscritos}
            onVerAvaliacao={carregarAvaliacao}
            carregarPresencas={carregarPresencas}
            gerarRelatorioPDF={gerarRelatorioPDF}
            onExportarListaAssinaturaPDF={gerarListaAssinaturaPDF}
            onExportarQrCodePDF={gerarQrCodePresencaPDF}
            carregando={carregando}
            turmaExpandidaInscritos={turmaExpandidaInscritos}
            setTurmaExpandidaInscritos={setTurmaExpandidaInscritos}
            turmaExpandidaAvaliacao={turmaExpandidaAvaliacao}
            setTurmaExpandidaAvaliacao={setTurmaExpandidaAvaliacao}
            datasPorTurma={datasPorTurma}
            carregarDatasPorTurma={carregarDatasPorTurma}
          />
        )}
      </main>

      <ModalAssinatura
        isOpen={modalAssinaturaAberto}
        onClose={() => {
          setModalAssinaturaAberto(false);
          carregarAssinatura();
        }}
      />

      <Footer />
    </div>
  );
}