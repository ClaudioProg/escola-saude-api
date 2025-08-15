// src/pages/DashboardInstrutor.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import TurmasInstrutor from "../components/TurmasInstrutor";
import Breadcrumbs from "../components/Breadcrumbs";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import ErroCarregamento from "../components/ErroCarregamento";
import ModalAssinatura from "../components/ModalAssinatura";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeCanvas } from "qrcode.react";
import { formatarCPF, formatarDataBrasileira } from "../utils/data";
import { apiGet } from "../services/api";

// ---------- helpers anti-fuso ----------
const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const toLocalNoon = (ymdStr) => (ymdStr ? new Date(`${ymdStr}T12:00:00`) : null);
const todayYMD = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const rangeDiasYMD = (iniYMD, fimYMD) => {
  const out = [];
  const d0 = toLocalNoon(iniYMD);
  const d1 = toLocalNoon(fimYMD || iniYMD);
  if (!d0 || !d1) return out;
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
};
// ---------------------------------------

// 🔎 logger condicional (ligue com: window.DEBUG_DASH_INSTRUTOR = true)
const dbg = (...args) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR) {
    // eslint-disable-next-line no-console
    console.log("[DashInstrutor]", ...args);
  }
};
const warn = (...args) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR) {
    // eslint-disable-next-line no-console
    console.warn("[DashInstrutor]", ...args);
  }
};
const groupC = (label, fn) => {
  if (typeof window !== "undefined" && window.DEBUG_DASH_INSTRUTOR && console.groupCollapsed) {
    console.groupCollapsed(label);
    try { fn?.(); } finally { console.groupEnd(); }
  } else {
    fn?.();
  }
};

export default function DashboardInstrutor() {
  const navigate = useNavigate();

  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (e) {
    warn("Falha ao ler usuario do localStorage:", e);
  }
  const nome = usuario?.nome || "";

  const [turmas, setTurmas] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("programados");
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [turmaExpandidaInscritos, setTurmaExpandidaInscritos] = useState(null);
  const [turmaExpandidaAvaliacoes, setTurmaExpandidaAvaliacoes] = useState(null);
  const [modalAssinaturaAberto, setModalAssinaturaAberto] = useState(false);
  const [assinatura, setAssinatura] = useState(null);
  const [presencasPorTurma, setPresencasPorTurma] = useState({});

  // 🔧 contexto/ambiente (aparece uma vez)
  useEffect(() => {
    groupC("🧭 Contexto DashboardInstrutor", () => {
      const token = (() => { try { return localStorage.getItem("token"); } catch { return ""; } })();
      const shortToken = token ? `${token.slice(0, 12)}…${token.slice(-6)}` : "(sem token)";
      dbg("origin:", window.location.origin);
      dbg("VITE_API_BASE_URL:", import.meta.env?.VITE_API_BASE_URL || "(vazio)");
      dbg("ENV:", import.meta.env?.DEV ? "dev" : "prod");
      dbg("usuario?.perfil:", usuario?.perfil);
      dbg("token (curto):", shortToken);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔄 Presenças (rota correta + compat legada)
  const carregarPresencas = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) return;

    groupC(`📦 carregarPresencas(turmaId=${turmaId})`, async () => {
      try {
        console.time(`[time GET] /api/presencas/turma/${turmaId}/detalhes`);
        const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
        console.timeEnd(`[time GET] /api/presencas/turma/${turmaId}/detalhes`);

        const datas = Array.isArray(data?.datas) ? data.datas : [];
        const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
        const totalDias = datas.length || 0;

        dbg("payload bruta:", data);
        dbg("datas.length:", datas.length, "usuarios.length:", usuarios.length);

        // ✅ lista “legada”
        const lista = usuarios.map((u) => {
          const pres = Array.isArray(u.presencas) ? u.presencas : [];
          const presentes = pres.filter((p) => p?.presente === true).length;
          const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
          return {
            usuario_id: u.id,
            nome: u.nome,
            cpf: u.cpf,
            presente: freq >= 75,
            frequencia: `${freq}%`,
          };
        });

        setPresencasPorTurma((prev) => ({
          ...prev,
          [turmaId]: {
            detalhado: { datas, usuarios },
            lista,
          },
        }));

        dbg("📋 detalhado:", { datas, usuarios });
        dbg("📋 lista compat:", lista);
      } catch (err) {
        // detalha erro conhecido do nosso ApiError
        const info = {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        };
        console.error("Falha ao carregar presenças:", info);
        toast.error("Erro ao carregar presenças da turma.");
        setPresencasPorTurma((prev) => ({
          ...prev,
          [turmaId]: { detalhado: { datas: [], usuarios: [] }, lista: [] },
        }));
      }
    });
  };

  useEffect(() => {
    (async () => {
      groupC("🚀 useEffect inicial (carregar turmas/assinatura)", async () => {
        try {
          console.time("[time GET] /api/agenda/instrutor");
          const data = await apiGet("/api/agenda/instrutor", { on403: "silent" });
          console.timeEnd("[time GET] /api/agenda/instrutor");

          const arr = Array.isArray(data) ? data : [];
          dbg("turmas recebidas:", arr.length);

          // ordena por data_inicio (meio-dia local) desc
          const ordenadas = arr.slice().sort((a, b) => {
            const ad = toLocalNoon(ymd(a.data_inicio));
            const bd = toLocalNoon(ymd(b.data_inicio));
            if (!ad && !bd) return 0;
            if (!ad) return 1;
            if (!bd) return -1;
            return bd - ad;
          });
          setTurmas(ordenadas);
          setErro("");

          // carrega presenças por turma (em paralelo, mas com logs por turma)
          ordenadas.forEach((turma) => {
            if (turma?.id) carregarPresencas(turma.id);
          });
        } catch (err) {
          const info = {
            name: err?.name,
            message: err?.message,
            status: err?.status,
            url: err?.url,
            data: err?.data,
          };
          console.error("Erro ao carregar turmas:", info);
          setErro(err?.message || "Erro ao carregar suas turmas.");
          toast.error(`❌ ${err?.message || "Erro ao carregar suas turmas."}`);
        } finally {
          setCarregando(false);
        }

        try {
          console.time("[time GET] /api/assinatura");
          const a = await apiGet("/api/assinatura", { on403: "silent" });
          console.timeEnd("[time GET] /api/assinatura");
          setAssinatura(a?.assinatura || null);
          dbg("assinatura presente?", !!a?.assinatura);
        } catch (e) {
          warn("Não foi possível carregar assinatura:", e?.message || e);
          setAssinatura(null);
        }
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarInscritos = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }
    groupC(`👥 carregarInscritos(turmaId=${turmaId})`, async () => {
      try {
        console.time(`[time GET] /api/inscricoes/turma/${turmaId}`);
        const data = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
        console.timeEnd(`[time GET] /api/inscricoes/turma/${turmaId}`);
        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
        dbg("inscritos:", Array.isArray(data) ? data.length : 0);
      } catch (err) {
        const info = {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        };
        console.error("Erro ao carregar inscritos:", info);
        toast.error("Erro ao carregar inscritos.");
      }
    });
  };

  const carregarAvaliacoes = async (turmaIdRaw) => {
    const turmaId = parseInt(turmaIdRaw);
    if (!turmaId || isNaN(turmaId)) {
      toast.error("Erro: Turma inválida.");
      return;
    }
    if (avaliacoesPorTurma[turmaId]) return;
    groupC(`📝 carregarAvaliacoes(turmaId=${turmaId})`, async () => {
      try {
        console.time(`[time GET] /api/avaliacoes/turma/${turmaId}`);
        const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`, { on403: "silent" });
        console.timeEnd(`[time GET] /api/avaliacoes/turma/${turmaId}`);
        setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
        dbg("avaliacoes:", Array.isArray(data) ? data.length : 0);
      } catch (err) {
        const info = {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        };
        console.error("Erro ao carregar avaliações:", info);
        toast.error("Erro ao carregar avaliações.");
      }
    });
  };

  // 🔎 Filtro por status (comparação por yyyy-mm-dd)
  const hoje = todayYMD();
  const turmasFiltradas = turmas.filter((t) => {
    const di = ymd(t.data_inicio);
    const df = ymd(t.data_fim);
    if (!di || !df) return filtro === "todos";

    if (filtro === "programados") return di > hoje;
    if (filtro === "emAndamento") return di <= hoje && df >= hoje;
    if (filtro === "realizados") return df < hoje;
    return true; // todos
  });

  // 📄 Relatórios
  const gerarRelatorioPDF = async (turmaId) => {
    groupC(`📑 gerarRelatorioPDF(turmaId=${turmaId})`, async () => {
      try {
        console.time(`[time GET] /api/presencas/turma/${turmaId}/detalhes (pdf)`);
        const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
        console.timeEnd(`[time GET] /api/presencas/turma/${turmaId}/detalhes (pdf)`);

        const datas = Array.isArray(data?.datas) ? data.datas : [];
        const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
        const totalDias = datas.length || 0;

        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text("Relatório de Presenças por Turma (Resumo)", 14, 20);

        const linhas = usuarios.map((u) => {
          const presentes = (u.presencas || []).filter((p) => p?.presente === true).length;
          const freq = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;
          const atingiu = freq >= 75 ? "✔️" : "❌";
          return [u.nome, formatarCPF(u.cpf), `${freq}%`, atingiu];
        });

        autoTable(doc, {
          startY: 30,
          head: [["Nome", "CPF", "Frequência", "≥ 75%"]],
          body: linhas,
        });

        doc.save(`relatorio_turma_${turmaId}.pdf`);
        toast.success("✅ PDF de presença gerado!");
      } catch (err) {
        const info = {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        };
        console.error("Erro ao gerar PDF de presença:", info);
        toast.error("Erro ao gerar relatório em PDF.");
      }
    });
  };

  const gerarListaAssinaturaPDF = async (turmaId) => {
    groupC(`🖊️ gerarListaAssinaturaPDF(turmaId=${turmaId})`, async () => {
      const turma = turmas.find((t) => t.id === turmaId);
      let alunos = inscritosPorTurma[turmaId];

      if (!alunos) {
        try {
          console.time(`[time GET] /api/inscricoes/turma/${turmaId} (lista assinatura)`);
          alunos = await apiGet(`/api/inscricoes/turma/${turmaId}`, { on403: "silent" });
          console.timeEnd(`[time GET] /api/inscricoes/turma/${turmaId} (lista assinatura)`);
        } catch (err) {
          const info = {
            name: err?.name,
            message: err?.message,
            status: err?.status,
            url: err?.url,
            data: err?.data,
          };
          console.error("Erro ao carregar inscritos (lista assinatura):", info);
          toast.error("❌ Erro ao carregar inscritos.");
          return;
        }
      }

      if (!turma || !alunos?.length) {
        warn("Sem turma ou sem alunos para gerar lista.");
        toast.warning("⚠️ Nenhum inscrito encontrado para esta turma.");
        return;
      }

      const di = ymd(turma.data_inicio);
      const df = ymd(turma.data_fim);
      const datasYMD = rangeDiasYMD(di, df);

      const doc = new jsPDF();

      datasYMD.forEach((diaYMD, index) => {
        if (index > 0) doc.addPage();
        const dataFormatada = formatarDataBrasileira(diaYMD);
        const horaInicio = turma.horario_inicio?.slice(0, 5) || "";
        const horaFim = turma.horario_fim?.slice(0, 5) || "";

        doc.setFontSize(14);
        doc.text(`Lista de Assinatura - ${turma.evento?.nome || ""} - ${turma.nome || ""}`, 14, 20);
        doc.text(`Data: ${dataFormatada} | Horário: ${horaInicio} às ${horaFim}`, 14, 28);

        autoTable(doc, {
          startY: 30,
          head: [["Nome", "CPF", "Assinatura"]],
          body: alunos.map((a) => [a.nome, formatarCPF(a.cpf), "______________________"]),
        });
      });

      doc.save(`lista_assinatura_turma_${turmaId}.pdf`);
      toast.success("📄 Lista de assinatura gerada!");
    });
  };

  const gerarQrCodePresencaPDF = async (turmaId, nomeEvento = "Evento") => {
    groupC(`🔳 gerarQrCodePresencaPDF(turmaId=${turmaId})`, async () => {
      try {
        const turma = turmas.find((t) => t.id === turmaId);
        if (!turma) {
          toast.error("Turma não encontrada.");
          return;
        }
        const url = `https://escoladesaude.santos.br/presenca/${turmaId}`;

        const canvasContainer = document.createElement("div");
        const qrCodeElement = (<QRCodeCanvas value={url} size={300} />);
        const ReactDOM = await import("react-dom");
        ReactDOM.render(qrCodeElement, canvasContainer);

        setTimeout(() => {
          const canvas = canvasContainer.querySelector("canvas");
          const dataUrl = canvas?.toDataURL("image/png");
          if (!dataUrl) {
            console.error("QR: canvas sem dataUrl");
            toast.error("Erro ao gerar imagem do QR Code.");
            return;
          }

          const doc = new jsPDF({ orientation: "landscape" });
          doc.setFontSize(24);
          doc.setFont("helvetica", "bold");
          doc.text(nomeEvento, 148, 30, { align: "center" });

          const nomeInstrutor = usuario?.nome || "Instrutor";
          doc.setFontSize(16);
          doc.setFont("helvetica", "normal");
          doc.text(`Instrutor: ${nomeInstrutor}`, 148, 40, { align: "center" });

          doc.addImage(dataUrl, "PNG", 98, 50, 100, 100);
          doc.setFontSize(12);
          doc.setTextColor(60);
          doc.text("Escaneie este QR Code para confirmar sua presença", 148, 160, { align: "center" });

          doc.save(`qr_presenca_turma_${turmaId}.pdf`);
          toast.success("🔳 QR Code gerado!");
        }, 500);
      } catch (err) {
        const info = {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          url: err?.url,
          data: err?.data,
        };
        console.error("Erro ao gerar QR Code:", info);
        toast.error("Erro ao gerar QR Code.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <div className="flex justify-between items-center bg-lousa text-white px-4 py-2 rounded-xl shadow mb-6">
        <span>Seja bem-vindo(a), <strong>{nome}</strong></span>
        <span className="font-semibold">Painel do Instrutor</span>
      </div>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4 text-black dark:text-white text-center">
          📢 Painel do instrutor
        </h2>

        {erro && <ErroCarregamento mensagem={erro} />}

        {!assinatura && (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setModalAssinaturaAberto(true)}
              className="bg-lousa text-white px-4 py-2 rounded-xl shadow hover:bg-green-800"
            >
              ✍️ Cadastrar/Alterar Assinatura
            </button>
          </div>
        )}

        <div className="flex justify-center gap-4 mb-6 flex-wrap">
          {[
            ["todos", "Todos"],
            ["programados", "Programados"],
            ["emAndamento", "Em andamento"],
            ["realizados", "Realizados"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className={`px-4 py-1 rounded-full text-sm font-medium ${
                filtro === key ? "bg-[#1b4332] text-white" : "bg-gray-200 dark:bg-gray-700 dark:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <TurmasInstrutor
          turmas={turmasFiltradas}
          inscritosPorTurma={inscritosPorTurma}
          avaliacoesPorTurma={avaliacoesPorTurma}
          presencasPorTurma={presencasPorTurma}
          onVerInscritos={carregarInscritos}
          onVerAvaliacoes={carregarAvaliacoes}
          carregarPresencas={carregarPresencas}
          onExportarListaAssinaturaPDF={gerarListaAssinaturaPDF}
          onExportarQrCodePDF={gerarQrCodePresencaPDF}
          carregando={carregando}
          turmaExpandidaInscritos={turmaExpandidaInscritos}
          setTurmaExpandidaInscritos={setTurmaExpandidaInscritos}
          turmaExpandidaAvaliacoes={turmaExpandidaAvaliacoes}
          setTurmaExpandidaAvaliacoes={setTurmaExpandidaAvaliacoes}
        />

        <ModalAssinatura
          isOpen={modalAssinaturaAberto}
          onClose={() => setModalAssinaturaAberto(false)}
        />
      </div>
    </div>
  );
}
