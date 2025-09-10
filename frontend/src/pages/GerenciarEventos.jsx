/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { Pencil, Trash2, PlusCircle, Lock } from "lucide-react";

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
  // aceita string "YYYY-MM-DD" ou objetos com {data,inicio,fim}/{data,horario_inicio,horario_fim}
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
  // soma horas; se >=8h em um dia, desconta 1h (almoço)
  let total = 0;
  for (const e of encs) {
    const [h1, m1] = (e.inicio || "00:00").split(":").map(Number);
    const [h2, m2] = (e.fim || "00:00").split(":").map(Number);
    const diffH = Math.max(0, (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60);
    total += diffH >= 8 ? diffH - 1 : diffH;
  }
  return Math.round(total);
};

/**
 * Normaliza turmas para o payload:
 *  - inclui `encontros: [{data,inicio,fim}]`
 *  - inclui também `datas` (compat atual do backend)
 *  - preenche faltantes (di/df/hi/hf/carga_horaria)
 */
function normalizeTurmas(turmas = []) {
  const out = (turmas || []).map((t) => {
    const nome = (t.nome || "Turma Única").trim();

    const hiBase = hhmm(t.horario_inicio || "08:00");
    const hfBase = hhmm(t.horario_fim || "17:00");

    const fonte =
      (Array.isArray(t.encontros) && t.encontros.length
        ? t.encontros
        : Array.isArray(t.datas) && t.datas.length
        ? t.datas
        : []) || [];

    const encontros = sortByData(
      (fonte || []).map((e) => toEncontroObj(e, hiBase, hfBase)).filter(Boolean)
    );

    const di = ymd(t.data_inicio) || encontros[0]?.data || "";
    const df = ymd(t.data_fim) || encontros.at(-1)?.data || "";
    const hi = hhmm(t.horario_inicio || encontros[0]?.inicio || "08:00");
    const hf = hhmm(t.horario_fim || encontros[0]?.fim || "17:00");

    const vagas = Number.isFinite(Number(t.vagas_total))
      ? Number(t.vagas_total)
      : Number(t.vagas);
    const vagasOk = Number.isFinite(vagas) && vagas > 0 ? vagas : 1;

    let ch = Number.isFinite(Number(t.carga_horaria)) ? Number(t.carga_horaria) : 0;
    if (ch <= 0 && encontros.length) ch = cargaHorariaFromEncontros(encontros);
    if (ch <= 0) ch = 1;

    const datas = encontros.map((e) => ({
      data: e.data,
      horario_inicio: e.inicio,
      horario_fim: e.fim,
    }));

    return clean({
      nome,
      data_inicio: di,
      data_fim: df,
      horario_inicio: hi,
      horario_fim: hf,
      vagas_total: vagasOk,
      carga_horaria: ch,
      encontros,
      datas,
    });
  });
  return out;
}

/* ========= Restrição: normalização de registros ========= */
const normRegistro = (v) => String(v || "").replace(/\D/g, "").slice(0, 20);
const normRegistros = (arr) =>
  Array.from(new Set((arr || []).map(normRegistro).filter(Boolean)));

/* =============================
   Fetch auxiliares
   ============================= */
async function fetchTurmasDoEvento(eventoId) {
  const urls = [
    `/api/eventos/${eventoId}/turmas`,      // rota preferencial
    `/api/turmas/por-evento/${eventoId}`,   // legadas
    `/api/turmas/evento/${eventoId}`,
    `/api/eventos/${eventoId}`,             // pode vir embutido
  ];
  for (const url of urls) {
    try {
      const resp = await apiGet(url);
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp?.turmas)) return resp.turmas;
      if (Array.isArray(resp?.lista)) return resp.lista;
    } catch {}
  }
  return [];
}

async function fetchEventoCompleto(eventoId) {
  try {
    const resp = await apiGet(`/api/eventos/${eventoId}`);
    const ev = resp?.evento || resp;
    if (ev?.id) return ev;
  } catch {}
  return null;
}

/* =============================
   Modo “espelho” para PUT (merge com servidor)
   ============================= */
function buildUpdateBody(baseServidor, dadosDoModal) {
  const body = {};

  // — campos simples
  body.titulo = (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim();
  body.descricao = (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim();
  body.local = (dadosDoModal?.local ?? baseServidor?.local ?? "").trim();
  body.tipo = (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim();
  body.unidade_id = Number(dadosDoModal?.unidade_id ?? baseServidor?.unidade_id);
  body.publico_alvo = (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim();

  // — instrutor
  const instrutoresFromModal = extractInstrutorIds(dadosDoModal?.instrutor);
  const instrutoresFromServer = extractInstrutorIds(baseServidor?.instrutor);
  body.instrutor = instrutoresFromModal.length ? instrutoresFromModal : instrutoresFromServer;

  // — restrição
  const restrito = Boolean(
    dadosDoModal?.restrito ??
      (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
  );
  body.restrito = restrito;

  const modo =
    restrito
      ? (dadosDoModal?.restrito_modo ??
          baseServidor?.restrito_modo ??
          null)
      : null;
  body.restrito_modo = modo;

  if (restrito && modo === "lista_registros") {
    const regs = normRegistros(dadosDoModal?.registros);
    if (regs.length) body.registros = regs; // se não vier nada, backend mantém a lista atual
  }

  // — turmas
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

  let turmasFonte = [];
  if (Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length > 0) {
    turmasFonte = dadosDoModal.turmas;
  } else if (Array.isArray(baseServidor?.turmas) && baseServidor.turmas.length > 0) {
    turmasFonte = baseServidor.turmas;
  } else {
    turmasFonte = [
      {
        nome: body.titulo || "Turma Única",
        data_inicio: di,
        data_fim: df,
        horario_inicio: hi,
        horario_fim: hf,
        vagas_total: 1,
        carga_horaria: 1,
        encontros: [],
      },
    ];
  }
  body.turmas = normalizeTurmas(turmasFonte);

  return clean(body);
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

  async function recarregarEventos() {
    try {
      setErro("");
      const data = await apiGet("/api/eventos");
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data?.lista)
        ? data.lista
        : [];
      setEventos(lista);
    } catch (err) {
      const msg = err?.message || "Erro ao carregar eventos";
      console.error("❌ /api/eventos:", msg);
      setErro(msg);
      setEventos([]);
      toast.error(`❌ ${msg}`);
    }
  }

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
    setEventoSelecionado(null);
    setModalAberto(true);
  };

  const abrirModalEditar = async (evento) => {
    let turmas = Array.isArray(evento.turmas) ? evento.turmas : [];
    if (turmas.length === 0 && evento?.id) {
      turmas = await fetchTurmasDoEvento(evento.id);
    }

    // preserva flags de restrição que vierem do backend
    const base = (await fetchEventoCompleto(evento.id)) || evento;

    setEventoSelecionado({
      ...evento,
      ...base, // assegura restrito/restrito_modo (e possivelmente registros, se backend enviar)
      turmas,
    });
    setModalAberto(true);
  };

  const excluirEvento = async (eventoId) => {
    if (!window.confirm("Tem certeza que deseja excluir este evento?")) return;
    try {
      await apiDelete(`/api/eventos/${eventoId}`);
      setEventos((prev) => prev.filter((ev) => ev.id !== eventoId));
      toast.success("✅ Evento excluído.");
      await recarregarEventos();
    } catch (err) {
      console.error("❌ delete evento:", err?.message);
      toast.error(`❌ ${err?.message || "Erro ao excluir evento."}`);
    }
  };

  const salvarEvento = async (dadosDoModal) => {
    try {
      const isEdicao = Boolean(eventoSelecionado?.id);

      if (isEdicao) {
        // 1) base completa do servidor (ou fallback)
        let baseServidor = await fetchEventoCompleto(eventoSelecionado.id);
        if (!baseServidor) {
          const turmasDoEvento =
            Array.isArray(eventoSelecionado?.turmas) && eventoSelecionado.turmas.length
              ? eventoSelecionado.turmas
              : await fetchTurmasDoEvento(eventoSelecionado.id);
          baseServidor = {
            ...eventoSelecionado,
            turmas: turmasDoEvento,
            titulo: eventoSelecionado?.titulo || "",
            descricao: eventoSelecionado?.descricao || "",
            local: eventoSelecionado?.local || "",
            tipo: eventoSelecionado?.tipo || "",
            unidade_id: eventoSelecionado?.unidade_id,
            publico_alvo: eventoSelecionado?.publico_alvo || "",
            instrutor: extractInstrutorIds(eventoSelecionado?.instrutor),
            restrito: Boolean(eventoSelecionado?.restrito),
            restrito_modo: eventoSelecionado?.restrito_modo || null,
          };
        }

        // 2) body espelho (inclui regra de restrição)
        const body = buildUpdateBody(baseServidor, dadosDoModal);

        // validações rápidas
        if (!Array.isArray(body.instrutor) || body.instrutor.length === 0) {
          toast.error("Selecione ao menos um instrutor.");
          return;
        }
        if (!Array.isArray(body.turmas) || body.turmas.length === 0) {
          toast.error("Inclua ao menos uma turma com campos obrigatórios.");
          return;
        }

        // 3) PUT principal
        try {
          await apiPut(`/api/eventos/${eventoSelecionado.id}`, body);
        } catch (err) {
          // turmas com inscritos → salva apenas metadados + regra de restrição
          if (err?.status === 409 && err?.data?.erro === "TURMA_COM_INSCRITOS") {
            toast.warn(
              "Este evento tem turmas com inscritos. Vou salvar apenas os dados gerais e a regra de restrição."
            );

            const bodyEventOnly = clean({
              titulo: (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim(),
              descricao: (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim(),
              local: (dadosDoModal?.local ?? baseServidor?.local ?? "").trim(),
              tipo: (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim(),
              unidade_id: dadosDoModal?.unidade_id ?? baseServidor?.unidade_id,
              publico_alvo: (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim(),
              instrutor: extractInstrutorIds(
                (Array.isArray(dadosDoModal?.instrutor) && dadosDoModal.instrutor.length
                  ? dadosDoModal.instrutor
                  : baseServidor?.instrutor) || []
              ),
              // 👇 ainda podemos alterar a regra de restrição
              restrito: Boolean(
                dadosDoModal?.restrito ??
                  (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
              ),
              restrito_modo:
                (dadosDoModal?.restrito ?? baseServidor?.restrito)
                  ? (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo ?? null)
                  : null,
              registros:
                (dadosDoModal?.restrito ?? baseServidor?.restrito) &&
                (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo) === "lista_registros"
                  ? normRegistros(dadosDoModal?.registros)
                  : undefined,
            });

            await apiPut(`/api/eventos/${eventoSelecionado.id}`, bodyEventOnly);

            await recarregarEventos();
            toast.success("✅ Dados gerais e restrição atualizados. As turmas não foram alteradas.");
            setModalAberto(false);
            return;
          }
          throw err;
        }
      } else {
        // ======= CRIAÇÃO =======
        const base = {
          titulo: (dadosDoModal?.titulo || "").trim(),
          tipo: (dadosDoModal?.tipo || "").trim(),
          unidade_id: dadosDoModal?.unidade_id,
          descricao: (dadosDoModal?.descricao || "").trim(),
          local: (dadosDoModal?.local || "").trim(),
          publico_alvo: (dadosDoModal?.publico_alvo || "").trim(),
        };

        const instrutores = extractInstrutorIds(dadosDoModal?.instrutor);
        if (!instrutores.length) {
          toast.error("Selecione ao menos um instrutor.");
          return;
        }

        const di = ymd(dadosDoModal?.data_inicio_geral ?? dadosDoModal?.data_inicio);
        const df = ymd(dadosDoModal?.data_fim_geral ?? dadosDoModal?.data_fim);
        const hi = hhmm(dadosDoModal?.horario_inicio_geral ?? dadosDoModal?.horario_inicio ?? "08:00");
        const hf = hhmm(dadosDoModal?.horario_fim_geral ?? dadosDoModal?.horario_fim ?? "17:00");

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
                  encontros: [],
                },
              ]
        );

        // ——— regra de restrição na criação
        const restrito = Boolean(dadosDoModal?.restrito);
        const restrito_modo = restrito
          ? (dadosDoModal?.restrito_modo || "todos_servidores")
          : null;
        const registros =
          restrito && restrito_modo === "lista_registros"
            ? normRegistros(dadosDoModal?.registros)
            : undefined;

        const bodyCreate = clean({
          ...base,
          instrutor: instrutores,
          turmas,
          restrito,
          restrito_modo,
          registros,
        });

        await apiPost("/api/eventos", bodyCreate);
      }

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
              <div className="flex items-center gap-3">
                <span className="font-semibold text-lg text-lousa dark:text-white">
                  {ev.titulo}
                </span>

                {/* Badge de restrição */}
                {ev?.restrito && (
                  <span
                    title={
                      ev.restrito_modo === "lista_registros"
                        ? "Restrito a uma lista de registros"
                        : "Visível a todos os servidores (com registro cadastrado)"
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 border border-amber-300"
                  >
                    <Lock size={12} />
                    {ev.restrito_modo === "lista_registros" ? "Lista" : "Servidores"}
                  </span>
                )}
              </div>

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
        // quando o Modal excluir/alterar turmas, podemos recarregar aqui
        onTurmaRemovida={() => recarregarEventos()}
      />
    </main>
  );
}
