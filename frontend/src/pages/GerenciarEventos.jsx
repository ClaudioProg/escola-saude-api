/* eslint-disable no-console */
// 📁 src/pages/GerenciarEventos.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { Pencil, Trash2, PlusCircle, Lock, RefreshCcw, Wrench } from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import ModalEvento from "../components/ModalEvento";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
import BotaoPrimario from "../components/BotaoPrimario";
import Footer from "../components/Footer";

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
    `/api/eventos/${eventoId}/turmas`,
    `/api/turmas/por-evento/${eventoId}`,
    `/api/turmas/evento/${eventoId}`,
    `/api/eventos/${eventoId}`,
  ];
  for (const url of urls) {
    try {
      const resp = await apiGet(url, { on403: "silent" });
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp?.turmas)) return resp.turmas;
      if (Array.isArray(resp?.lista)) return resp.lista;
    } catch {}
  }
  return [];
}

async function fetchEventoCompleto(eventoId) {
  try {
    const resp = await apiGet(`/api/eventos/${eventoId}`, { on403: "silent" });
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

  // campos simples
  body.titulo = (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim();
  body.descricao = (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim();
  body.local = (dadosDoModal?.local ?? baseServidor?.local ?? "").trim();
  body.tipo = (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim();
  body.unidade_id = Number(dadosDoModal?.unidade_id ?? baseServidor?.unidade_id);
  body.publico_alvo = (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim();

  // instrutor
  const instrutoresFromModal = extractInstrutorIds(dadosDoModal?.instrutor);
  const instrutoresFromServer = extractInstrutorIds(baseServidor?.instrutor);
  body.instrutor = instrutoresFromModal.length ? instrutoresFromModal : instrutoresFromServer;

  // restrição
  const restrito = Boolean(
    dadosDoModal?.restrito ??
      (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
  );
  body.restrito = restrito;

  const modo = restrito
    ? (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo ?? null)
    : null;
  body.restrito_modo = modo;

  if (restrito && modo === "lista_registros") {
    const fonteModal =
      Array.isArray(dadosDoModal?.registros_permitidos) ? dadosDoModal.registros_permitidos :
      Array.isArray(dadosDoModal?.registros)            ? dadosDoModal.registros            :
      undefined;

    const fonte = (Array.isArray(fonteModal) && fonteModal.length > 0)
      ? fonteModal
      : (Array.isArray(baseServidor?.registros_permitidos) ? baseServidor.registros_permitidos : []);

    const regs = normRegistros(fonte);
    if (regs.length) body.registros_permitidos = regs; // nome canônico
  }

  // turmas (com fallback)
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

/* ---------------- HeaderHero (azul, título central e altura média) ---------------- */
function HeaderHero({ onCriar, onAtualizar, atualizando }) {
  return (
    <header
      className="relative isolate overflow-hidden bg-gradient-to-br from-sky-900 via-blue-800 to-indigo-700 text-white"
      role="banner"
    >
      {/* glow sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0) 60%)",
        }}
        aria-hidden="true"
      />

      {/* ⬇️ altura “média” */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 md:py-9 min-h-[140px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <Wrench className="w-6 h-6" />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gerenciar Eventos
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Crie, edite e restrinja a visibilidade dos seus eventos e turmas.
          </p>

          <div className="mt-2.5 sm:mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition
                ${atualizando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>

            <button
              type="button"
              onClick={onCriar}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-400"
              aria-label="Criar novo evento"
            >
              <PlusCircle className="w-5 h-5" />
              Criar Evento
            </button>
          </div>
        </div>
      </div>

      {/* linha sutil de separação na base */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
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
  const liveRef = useRef(null); // aria-live

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  async function recarregarEventos() {
    try {
      setErro("");
      setLive("Carregando eventos…");
      const data = await apiGet("/api/eventos", { on403: "silent" });
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data?.lista)
        ? data.lista
        : [];
      setEventos(lista);
      setLive(`Eventos carregados: ${lista.length}.`);
    } catch (err) {
      const msg = err?.message || "Erro ao carregar eventos";
      console.error("❌ /api/eventos:", msg);
      setErro(msg);
      setEventos([]);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar eventos.");
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
    const base = (await fetchEventoCompleto(evento.id)) || evento;

    setEventoSelecionado({
      ...evento,
      ...base,
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

        try {
          await apiPut(`/api/eventos/${eventoSelecionado.id}`, body);
        } catch (err) {
          if (err?.status === 409 && err?.data?.erro === "TURMA_COM_INSCRITOS") {
            toast.warn(
              "Este evento tem turmas com inscritos. Vou salvar apenas os dados gerais e a regra de restrição."
            );

            const fonteRegsModal =
              Array.isArray(dadosDoModal?.registros_permitidos) ? dadosDoModal.registros_permitidos :
              Array.isArray(dadosDoModal?.registros)            ? dadosDoModal.registros            :
              undefined;

            const regsEventOnly = (Array.isArray(fonteRegsModal) && fonteRegsModal.length > 0)
              ? normRegistros(fonteRegsModal)
              : normRegistros(baseServidor?.registros_permitidos || []);

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
              restrito: Boolean(
                dadosDoModal?.restrito ??
                  (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
              ),
              restrito_modo:
                (dadosDoModal?.restrito ?? baseServidor?.restrito)
                  ? (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo ?? null)
                  : null,
              registros_permitidos:
                (dadosDoModal?.restrito ?? baseServidor?.restrito) &&
                (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo) === "lista_registros"
                  ? regsEventOnly
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
        // criação
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

        const restrito = Boolean(dadosDoModal?.restrito);
        const restrito_modo = restrito
          ? (dadosDoModal?.restrito_modo || "todos_servidores")
          : null;

        const regsFonte =
          Array.isArray(dadosDoModal?.registros_permitidos) ? dadosDoModal.registros_permitidos :
          Array.isArray(dadosDoModal?.registros)            ? dadosDoModal.registros            :
          undefined;

        const registros = restrito && restrito_modo === "lista_registros"
          ? normRegistros(regsFonte || [])
          : undefined;

        const bodyCreate = clean({
          ...base,
          instrutor: instrutores,
          turmas,
          restrito,
          restrito_modo,
          registros_permitidos: registros, // canônico
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

  const anyLoading = loading;

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header hero (título central e ações) */}
      <HeaderHero
        onCriar={abrirModalCriar}
        onAtualizar={recarregarEventos}
        atualizando={anyLoading}
      />

      {/* barra de carregamento fina no topo */}
      {anyLoading && (
        <div className="sticky top-0 left-0 w-full h-1 bg-blue-100 z-40" role="progressbar" aria-label="Carregando dados">
          <div className="h-full bg-blue-700 animate-pulse w-1/3" />
        </div>
      )}

      <div className="px-2 sm:px-4 py-6 max-w-6xl mx-auto w-full">
        {!!erro && !loading && (
          <p className="text-red-500 text-center mb-4" role="alert">
            {erro}
          </p>
        )}

        {loading ? (
          <SkeletonEvento />
        ) : eventos.length === 0 ? (
          <NenhumDado mensagem="Nenhum evento cadastrado." />
        ) : (
          <ul className="space-y-4 sm:space-y-6">
            {eventos.map((ev) => (
              <motion.li
                key={ev.id || ev.titulo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-xl shadow border border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
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
                      <Lock size={12} aria-hidden="true" />
                      {ev.restrito_modo === "lista_registros" ? "Lista" : "Servidores"}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => abrirModalEditar(ev)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1"
                    aria-label={`Editar evento ${ev.titulo}`}
                  >
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </button>
                  <button
                    onClick={() => excluirEvento(ev.id)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1"
                    aria-label={`Excluir evento ${ev.titulo}`}
                  >
                    <Trash2 size={16} aria-hidden="true" /> Excluir
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>

      <ModalEvento
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSalvar={salvarEvento}
        evento={eventoSelecionado}
        onTurmaRemovida={() => recarregarEventos()}
      />

      <Footer />
    </main>
  );
}
