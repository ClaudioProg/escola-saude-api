// 📁 src/pages/GerenciarEventos.jsx
/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { Pencil, Trash2, PlusCircle } from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import ModalEvento from "../components/ModalEvento";
import Breadcrumbs from "../components/Breadcrumbs";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
import BotaoPrimario from "../components/BotaoPrimario";
import CabecalhoPainel from "../components/CabecalhoPainel";

/* =============================
   Helpers básicos
   ============================= */
const clean = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(
      ([, v]) =>
        v !== undefined &&
        v !== null &&
        !(typeof v === "string" && v.trim() === "")
    )
  );

// aceita "YYYY-MM-DD" ou Date → "YYYY-MM-DD"
const ymd = (s) => {
  if (!s) return "";
  if (typeof s === "string") return s.slice(0, 10);
  if (s instanceof Date && !isNaN(s)) {
    const y = s.getFullYear();
    const m = String(s.getMonth() + 1).padStart(2, "0");
    const d = String(s.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return "";
};

// normaliza "HH:mm[:ss]" → "HH:mm"
const hhmm = (s) => {
  if (typeof s !== "string") return "";
  const v = s.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
  return v ? v.slice(0, 5) : "";
};

// adiciona segundos se precisar → "HH:mm:ss"
const addSecs = (h) => {
  const base = (typeof h === "string" ? h.trim() : "") || "";
  if (/^\d{2}:\d{2}:\d{2}$/.test(base)) return base;
  if (/^\d{2}:\d{2}$/.test(base)) return `${base}:00`;
  return base ? `${base.slice(0, 5)}:00` : "";
};

// instrutor pode vir como [{id, nome}] ou [id]
const extractInstrutorIds = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((i) => (typeof i === "object" ? i?.id : i))
    .filter((x) => Number.isFinite(Number(x)))
    .map((x) => Number(x));
};

/* ======== Helpers p/ encontros/datas ======== */
const iso = (s) => (typeof s === "string" ? s.slice(0, 10) : "");
const toEncontroObj = (e, hiFallback = "08:00", hfFallback = "17:00") => {
  // aceita:
  //  - string "YYYY-MM-DD"
  //  - { data, horario_inicio/horario_fim }
  //  - { data, inicio, fim }
  if (!e) return null;
  if (typeof e === "string") {
    const d = iso(e);
    return d ? { data: d, inicio: hiFallback, fim: hfFallback } : null;
  }
  const data = iso(e.data);
  const inicio = hhmm(e.inicio || e.horario_inicio || hiFallback);
  const fim = hhmm(e.fim || e.horario_fim || hfFallback);
  if (!data) return null;
  return { data, inicio, fim };
};

const sortByData = (arr) =>
  [...arr].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

const cargaHorariaFromEncontros = (encs) => {
  // soma horas de cada encontro; se >=8h em um dia, desconta 1h (almoço)
  let total = 0;
  for (const e of encs) {
    const [h1, m1] = (e.inicio || "00:00").split(":").map(Number);
    const [h2, m2] = (e.fim || "00:00").split(":").map(Number);
    const diffH = Math.max(
      0,
      (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60
    );
    total += diffH >= 8 ? diffH - 1 : diffH;
  }
  return Math.round(total);
};

/**
 * Normaliza turmas para o payload:
 *  - inclui `encontros: [{data,inicio,fim}]`
 *  - se faltar data_inicio/data_fim, deriva do 1º/último encontro
 *  - se faltar horários, usa do 1º encontro
 *  - se faltar carga_horaria, calcula a partir dos encontros
 *  - compatível com formatos antigos: `datas` (array) ou `encontros` como strings
 */
function normalizeTurmas(turmas = []) {
  console.log("🧩 normalizeTurmas: in →", turmas);
  const out = (turmas || []).map((t) => {
    const nome = (t.nome || "Turma Única").trim();

    // base de horários da turma (fallback p/ encontros)
    const hiBase = hhmm(t.horario_inicio || "08:00");
    const hfBase = hhmm(t.horario_fim || "17:00");

    // Converte encontros/datas para o formato alvo
    const fonte =
      (Array.isArray(t.encontros) && t.encontros.length
        ? t.encontros
        : Array.isArray(t.datas) && t.datas.length
        ? t.datas
        : []) || [];

    const encontros = sortByData(
      (fonte || []).map((e) => toEncontroObj(e, hiBase, hfBase)).filter(Boolean)
    );

    // Deriva datas/horários quando necessário
    const di = ymd(t.data_inicio) || encontros[0]?.data || "";
    const df = ymd(t.data_fim) || encontros.at(-1)?.data || "";
    const hi = hhmm(t.horario_inicio || encontros[0]?.inicio || "08:00");
    const hf = hhmm(t.horario_fim || encontros[0]?.fim || "17:00");

    const vagas = Number.isFinite(Number(t.vagas_total))
      ? Number(t.vagas_total)
      : Number(t.vagas);
    const vagasOk = Number.isFinite(vagas) && vagas > 0 ? vagas : 1;

    let ch = Number.isFinite(Number(t.carga_horaria))
      ? Number(t.carga_horaria)
      : 0;
    if (ch <= 0 && encontros.length) ch = cargaHorariaFromEncontros(encontros);
    if (ch <= 0) ch = 1;

    return clean({
      nome,
      data_inicio: di,
      data_fim: df,
      horario_inicio: hi,
      horario_fim: hf,
      vagas_total: vagasOk,
      carga_horaria: ch,
      encontros, // 👈 agora vai no payload
    });
  });
  console.log("🧩 normalizeTurmas: out →", out);
  return out;
}

/* =============================
   Fetch auxiliares
   ============================= */
async function fetchTurmasDoEvento(eventoId) {
  console.log(`🔎 fetchTurmasDoEvento id=${eventoId}`);
  const urls = [
    `/api/turmas/por-evento/${eventoId}`,
    `/api/turmas/evento/${eventoId}`,
    `/api/eventos/${eventoId}`, // pode vir embutido
  ];
  for (const url of urls) {
    try {
      console.log("→ tentando:", url);
      const resp = await apiGet(url);
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp?.turmas)) return resp.turmas;
      if (Array.isArray(resp?.lista)) return resp.lista;
    } catch (e) {
      console.log("✖️ falhou:", url, e?.message);
    }
  }
  return [];
}

async function fetchEventoCompleto(eventoId) {
  try {
    const resp = await apiGet(`/api/eventos/${eventoId}`);
    const ev = resp?.evento || resp;
    if (ev?.id) {
      console.log("🧴 fetchEventoCompleto OK:", ev);
      return ev;
    }
    console.log("🧴 fetchEventoCompleto shape inesperado:", resp);
  } catch (e) {
    console.log("🧴 fetchEventoCompleto erro:", e?.message);
  }
  return null;
}

/* =============================
   Modo “espelho” para PUT (merge com servidor)
   ============================= */
function buildUpdateBody(baseServidor, dadosDoModal) {
  // 1) Começa do zero e envia SÓ o que o backend aceita no PUT
  const body = {};

  // 2) Campos simples do evento (whitelist)
  body.titulo = (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim();
  body.descricao = (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim();
  body.local = (dadosDoModal?.local ?? baseServidor?.local ?? "").trim();
  body.tipo = (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim();
  body.unidade_id = Number(dadosDoModal?.unidade_id ?? baseServidor?.unidade_id);
  body.publico_alvo = (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim();

  // 3) Instrutor: garantir array de IDs
  const instrutoresFromModal = extractInstrutorIds(dadosDoModal?.instrutor);
  const instrutoresFromServer = extractInstrutorIds(baseServidor?.instrutor);
  body.instrutor = instrutoresFromModal.length ? instrutoresFromModal : instrutoresFromServer;

  // 4) Datas/horas gerais (apenas fallback — turmas usam encontros)
  const di = ymd(
    dadosDoModal?.data_inicio_geral ??
      dadosDoModal?.data_inicio ??
      baseServidor?.data_inicio_geral ??
      baseServidor?.data_inicio
  );
  const df = ymd(
    dadosDoModal?.data_fim_geral ??
      dadosDoModal?.data_fim ??
      baseServidor?.data_fim_geral ??
      baseServidor?.data_fim
  );
  const hi = hhmm(
    dadosDoModal?.horario_inicio_geral ??
      dadosDoModal?.horario_inicio ??
      baseServidor?.horario_inicio_geral ??
      baseServidor?.horario_inicio ??
      "08:00"
  );
  const hf = hhmm(
    dadosDoModal?.horario_fim_geral ??
      dadosDoModal?.horario_fim ??
      baseServidor?.horario_fim_geral ??
      baseServidor?.horario_fim ??
      "17:00"
  );

  // 5) Turmas (obrigatórias no PUT) — aceita datas OU encontros
  let turmasFonte = [];
  if (Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length > 0) {
    turmasFonte = dadosDoModal.turmas;
  } else if (Array.isArray(baseServidor?.turmas) && baseServidor.turmas.length > 0) {
    turmasFonte = baseServidor.turmas;
  } else {
    // cria 1 turma padrão (sem encontros), evita validação quebrar
    turmasFonte = [
      {
        nome: body.titulo || "Turma Única",
        data_inicio: di,
        data_fim: df,
        horario_inicio: hi,
        horario_fim: hf,
        vagas_total: 1,
        carga_horaria: 1,
        encontros: [], // vazio
      },
    ];
  }
  body.turmas = normalizeTurmas(turmasFonte);

  const final = clean(body);
  console.log("🪞 buildUpdateBody (espelho) →", final);
  return final;
}

/* =============================
   Página
   ============================= */
export default function GerenciarEventos() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  // 🔁 Centraliza o carregamento para reaproveitar
  async function recarregarEventos() {
    try {
      setErro("");
      console.log("📡 GET /api/eventos");
      const data = await apiGet("/api/eventos");
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data?.lista)
        ? data.lista
        : [];
      console.log("→ recebidos:", lista.length, "exemplo[0]:", lista[0]);
      setEventos(lista);
    } catch (err) {
      const msg = err?.message || "Erro ao carregar eventos";
      console.error("❌ /api/eventos:", msg);
      setErro(msg);
      setEventos([]);
      toast.error(`❌ ${msg}`);
    }
  }

  // 🔄 Carregar eventos ao montar
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await recarregarEventos();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const abrirModalCriar = () => {
    console.log("➕ abrirModalCriar");
    setEventoSelecionado(null);
    setModalAberto(true);
  };

  // garantir turmas ao editar
  const abrirModalEditar = async (evento) => {
    console.log("✏️ abrirModalEditar", evento);
    let turmas = Array.isArray(evento.turmas) ? evento.turmas : [];
    if (turmas.length === 0 && evento?.id) {
      turmas = await fetchTurmasDoEvento(evento.id);
    }
    setEventoSelecionado({ ...evento, turmas });
    setModalAberto(true);
  };

  const excluirEvento = async (eventoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
    console.log("🗑️ DELETE evento id=", eventoId);
    try {
      await apiDelete(`/api/eventos/${eventoId}`);
      // remove localmente para resposta visual imediata
      setEventos((prev) => prev.filter((ev) => ev.id !== eventoId));
      toast.success("✅ Evento excluído.");
      // e sincroniza com o backend (opcional)
      await recarregarEventos();
    } catch (err) {
      console.error("❌ delete evento:", err?.message);
      toast.error(`❌ ${err?.message || "Erro ao excluir evento."}`);
    }
  };

  // Recebe os dados do ModalEvento (criar/editar)
  const salvarEvento = async (dadosDoModal) => {
    console.log("💾 salvarEvento: dadosDoModal:", dadosDoModal);
    console.log("💾 salvarEvento: eventoSelecionado:", eventoSelecionado);

    try {
      const isEdicao = Boolean(eventoSelecionado?.id);

      if (isEdicao) {
        // 1) pega o modelo completo do servidor
        const baseServidor = await fetchEventoCompleto(eventoSelecionado.id);
        if (!baseServidor) {
          toast.error("Não foi possível carregar o evento completo para atualizar.");
          return;
        }

        // 2) monta o body espelho (merge + normalizações mínimas)
        const body = buildUpdateBody(baseServidor, dadosDoModal);

        // validações mínimas antes do PUT
        if (!Array.isArray(body.instrutor) || body.instrutor.length === 0) {
          toast.error("Selecione ao menos um instrutor.");
          return;
        }
        if (!Array.isArray(body.turmas) || body.turmas.length === 0) {
          toast.error("Inclua ao menos uma turma com campos obrigatórios.");
          return;
        }

        // 3) PUT
        console.log("➡️ PUT /api/eventos/:id BODY →", body);
        const resp = await apiPut(`/api/eventos/${eventoSelecionado.id}`, body);
        console.log("📬 resposta bruta:", resp);
      } else {
        // criação
        const base = {
          titulo: (dadosDoModal?.titulo || "").trim(),
          tipo: (dadosDoModal?.tipo || "").trim(),
          unidade_id: dadosDoModal?.unidade_id,
          descricao: (dadosDoModal?.descricao || "").trim(),
          local: (dadosDoModal?.local || "").trim(),
          publico_alvo: (dadosDoModal?.publico_alvo || "").trim(),
        };

        // instrutor IDs
        const instrutores = extractInstrutorIds(dadosDoModal?.instrutor);
        if (!instrutores.length) {
          toast.error("Selecione ao menos um instrutor.");
          return;
        }

        // datas/horas gerais (fallback)
        const di =
          ymd(dadosDoModal?.data_inicio_geral ?? dadosDoModal?.data_inicio);
        const df = ymd(dadosDoModal?.data_fim_geral ?? dadosDoModal?.data_fim);
        const hi = hhmm(
          dadosDoModal?.horario_inicio_geral ??
            dadosDoModal?.horario_inicio ??
            "08:00"
        );
        const hf = hhmm(
          dadosDoModal?.horario_fim_geral ??
            dadosDoModal?.horario_fim ??
            "17:00"
        );

        // turmas (com encontros)
        const turmas = normalizeTurmas(
          dadosDoModal?.turmas?.length
            ? dadosDoModal.turmas
            : [
                {
                  nome: base.titulo || "Turma Única",
                  data_inicio: di,
                  data_fim: df,
                  horario_inicio: hi,
                  horario_fim: hf,
                  vagas_total: 1,
                  carga_horaria: 1,
                  encontros: [], // vazio na criação rápida
                },
              ]
        );

        const bodyCreate = clean({
          ...base,
          instrutor: instrutores,
          turmas,
        });

        console.log("➡️ POST /api/eventos BODY →", bodyCreate);
        const resp = await apiPost("/api/eventos", bodyCreate);
        console.log("📬 resposta bruta:", resp);
      }

      // sincroniza com o backend e fecha modal
      await recarregarEventos();
      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
    } catch (err) {
      console.error("❌ salvar evento:", err?.message, err);
      if (err?.data) console.log("err.data:", err.data);
      toast.error(err?.message || "Erro ao salvar o evento.");
    }
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-8 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Eventos" }]} />
      <CabecalhoPainel titulo="🛠️ Gerenciar Eventos" />

      <div className="flex justify-end mb-6">
        <BotaoPrimario onClick={abrirModalCriar} className="flex items-center gap-2">
          <PlusCircle size={18} /> Criar Evento
        </BotaoPrimario>
      </div>

      {!!erro && !loading && <p className="text-red-500 text-center mb-4">{erro}</p>}

      {loading ? (
        <SkeletonEvento />
      ) : eventos.length === 0 ? (
        <NenhumDado mensagem="Nenhum evento cadastrado." />
      ) : (
        <ul className="space-y-6">
          {eventos.map((ev) => (
            <motion.li
              key={ev.id || ev.titulo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-800 p-5 rounded-xl shadow flex justify-between items-center border border-gray-200 dark:border-zinc-700"
            >
              <span className="font-semibold text-lg text-lousa dark:text-white">{ev.titulo}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => abrirModalEditar(ev)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                >
                  <Pencil size={16} /> Editar
                </button>
                <button
                  onClick={() => excluirEvento(ev.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
                >
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      <ModalEvento
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSalvar={salvarEvento}
        evento={eventoSelecionado}
        // 👇 permite que o Modal também informe quando uma turma foi removida
        onTurmaRemovida={() => recarregarEventos()}
      />
    </main>
  );
}
