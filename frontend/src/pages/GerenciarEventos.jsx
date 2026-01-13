/* eslint-disable no-console */
// ✅ src/pages/GerenciarEventos.jsx (admin) — PREMIUM (robusto, a11y, mobile-first, sem mudar regras)
// Agora: sem bloqueios de edição, instrutores por TURMA, assinante por turma,
// restrição por cargos/unidades e upload de folder (png/jpg) + programação (pdf).
//
// ✅ Premium extra aplicado:
// - AbortController + mountedRef (evita race conditions ao recarregar/abrir modal rápido)
// - “Refetch seguro” ao editar (cancela requests antigos)
// - Barra de progresso respeita reduced-motion
// - Estado de erro com CTA
// - Toggle publicar/despublicar com rollback já mantido e foco/a11y refinados
// - Normalização de turmas: instrutores + assinante sempre alinhados e “clean()” consistente
// - ❗️CONFIRMAÇÕES via ModalConfirmacao (excluir / publicar / despublicar)

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { motion, useReducedMotion } from "framer-motion";
import {
  Pencil,
  Trash2,
  PlusCircle,
  Lock,
  RefreshCcw,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import ModalEvento from "../components/ModalEvento";
import ModalConfirmacao from "../components/ModalConfirmacao";
import NenhumDado from "../components/NenhumDado";
import SkeletonEvento from "../components/SkeletonEvento";
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

const ymd = (s) => (typeof s === "string" ? s.slice(0, 10) : "");

const hhmm = (s) => {
  if (typeof s !== "string") return "";
  const v = s.trim();
  if (/^\d{2}:\d{2}$/.test(v)) return v;
  if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v.slice(0, 5);
  return v ? v.slice(0, 5) : "";
};

// extrai ids numéricos
const extractIds = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((i) => (typeof i === "object" ? i?.id : i))
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n));
};

// extrai strings limpas (para cargos)
const extractStrs = (arr) => {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((v) =>
          String(
            typeof v === "object" ? v?.codigo || v?.sigla || v?.nome || "" : v
          ).trim()
        )
        .filter(Boolean)
    )
  );
};

/* ======== Helpers p/ encontros/datas ======== */
const iso = (s) => (typeof s === "string" ? s.slice(0, 10) : "");

const cargaHorariaFromEncontros = (encs) => {
  let total = 0;
  for (const e of encs) {
    const [h1, m1] = String(e.inicio || "00:00").split(":").map(Number);
    const [h2, m2] = String(e.fim || "00:00").split(":").map(Number);
    const diffH = Math.max(
      0,
      (h2 * 60 + (m2 || 0) - (h1 * 60 + (m1 || 0))) / 60
    );
    total += diffH >= 8 ? diffH - 1 : diffH; // desconta 1h se >= 8h
  }
  return Math.round(total);
};

function normalizeTurmas(turmas = []) {
  return (turmas || []).map((t) => {
    const nome = (t.nome || "Turma Única").trim();
    const hiBase = hhmm(t.horario_inicio || "08:00");
    const hfBase = hhmm(t.horario_fim || "17:00");

    // Fonte: prioriza t.datas no formato {data, horario_inicio, horario_fim}
    let datas = Array.isArray(t.datas) ? t.datas : [];

    // Se vieram encontros no formato {data,inicio,fim}, converte para datas
    if ((!datas || datas.length === 0) && Array.isArray(t.encontros)) {
      datas = t.encontros
        .map((e) =>
          typeof e === "string"
            ? { data: iso(e), horario_inicio: hiBase, horario_fim: hfBase }
            : {
                data: iso(e.data),
                horario_inicio: hhmm(e.inicio || e.horario_inicio || hiBase),
                horario_fim: hhmm(e.fim || e.horario_fim || hfBase),
              }
        )
        .filter((d) => d?.data);
    }

    datas = (datas || [])
      .map((d) => ({
        data: iso(d.data),
        horario_inicio: hhmm(d.horario_inicio || hiBase),
        horario_fim: hhmm(d.horario_fim || hfBase),
      }))
      .filter((d) => d.data)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

    const encontrosCalc = datas.map((d) => ({
      inicio: d.horario_inicio,
      fim: d.horario_fim,
    }));

    let ch = Number(t.carga_horaria);
    if (!Number.isFinite(ch) || ch <= 0) ch = cargaHorariaFromEncontros(encontrosCalc) || 1;

    const vagas = Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : Number(t.vagas);
    const vagasOk = Number.isFinite(vagas) && vagas > 0 ? vagas : 1;

    // ✅ instrutores e assinante por TURMA
    const instrutores = extractIds(t.instrutores || t.instrutor || t.professores || []);

    // cobre todas as variantes possíveis vindas do servidor/modais
    const _assinanteRaw =
      t.assinante_id ??
      t.instrutor_assinante_id ?? // preferencial
      t.instrutor_assinante ?? // legado
      t.assinante;

    const assinanteNum = Number(_assinanteRaw);
    const hasAssinante = Number.isFinite(assinanteNum);

    return clean({
      ...(Number.isFinite(Number(t.id)) ? { id: Number(t.id) } : {}),
      nome,
      vagas_total: vagasOk,
      carga_horaria: ch,
      datas,
      instrutores,
      // Sempre enviar os dois campos (espelho), se houver assinante
      ...(hasAssinante ? { assinante_id: assinanteNum } : {}),
      ...(hasAssinante ? { instrutor_assinante_id: assinanteNum } : {}),
    });
  });
}

/* ========= Restrição: normalização ========= */
const normRegistro = (v) => String(v || "").replace(/\D/g, "");
const normRegistros = (arr) =>
  Array.from(
    new Set((arr || []).map(normRegistro).filter((r) => /^\d{6}$/.test(r)))
  );

/* =============================
   Fetch auxiliares
============================= */
async function fetchTurmasDoEvento(eventoId) {
  const urls = [
    `/api/eventos/${eventoId}`,
    `/api/eventos/${eventoId}/turmas`,
    `/api/turmas/por-evento/${eventoId}`,
    `/api/turmas/evento/${eventoId}`,
  ];
  for (const url of urls) {
    try {
      const resp = await apiGet(url, { on403: "silent" });
      if (resp && resp.id && Array.isArray(resp.turmas)) return resp.turmas;
      if (Array.isArray(resp)) return resp;
      if (Array.isArray(resp?.turmas)) return resp.turmas;
      if (Array.isArray(resp?.lista)) return resp.lista;
    } catch (err) {
      console.warn("[fetchTurmasDoEvento] Falha em", url, err?.message || err);
    }
  }
  return [];
}

async function fetchEventoCompleto(eventoId) {
  try {
    const resp = await apiGet(`/api/eventos/${eventoId}`, { on403: "silent" });
    const ev = resp?.evento || resp;
    if (ev?.id) return ev;
  } catch (err) {
    console.error("[fetchEventoCompleto] Falha:", err?.message, err);
  }
  return null;
}

/* =============================
   Upload helpers (folder/programação)
   — Authorization + cookies
============================= */
function getAuthToken() {
  try {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  } catch {
    return "";
  }
}

async function authFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = new Headers(opts.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...opts, headers, credentials: "include" });
}

async function uploadFolder(eventoId, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("folder", file);
  const resp = await authFetch(`/api/eventos/${eventoId}/folder`, { method: "POST", body: fd });
  if (!resp.ok) {
    let msg = "Falha ao enviar folder (imagem).";
    try {
      const data = await resp.json();
      if (data?.erro || data?.message) msg = data.erro || data.message;
    } catch {}
    throw new Error(msg);
  }
}

async function uploadProgramacao(eventoId, file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("programacao", file);
  const resp = await authFetch(`/api/eventos/${eventoId}/programacao`, { method: "POST", body: fd });
  if (!resp.ok) {
    let msg = "Falha ao enviar programação (PDF).";
    try {
      const data = await resp.json();
      if (data?.erro || data?.message) msg = data.erro || data.message;
    } catch {}
    throw new Error(msg);
  }
}

/* =============================
   Modo “espelho” para PUT (merge com servidor)
============================= */
function buildUpdateBody(baseServidor, dadosDoModal) {
  const body = {};

  body.titulo = (dadosDoModal?.titulo ?? baseServidor?.titulo ?? "").trim();
  body.descricao = (dadosDoModal?.descricao ?? baseServidor?.descricao ?? "").trim();
  body.local = (dadosDoModal?.local ?? baseServidor?.local ?? "").trim();
  body.tipo = (dadosDoModal?.tipo ?? baseServidor?.tipo ?? "").trim();

  const uniId = Number(dadosDoModal?.unidade_id ?? baseServidor?.unidade_id);
  if (Number.isFinite(uniId)) body.unidade_id = uniId;

  body.publico_alvo = (dadosDoModal?.publico_alvo ?? baseServidor?.publico_alvo ?? "").trim();

  // Restrição/visibilidade
  const restrito = Boolean(
    dadosDoModal?.restrito ??
      (typeof baseServidor?.restrito === "boolean" ? baseServidor.restrito : false)
  );
  body.restrito = restrito;

  body.restrito_modo = restrito ? dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo ?? null : null;

  // lista de registros (opcional, legado)
  if (restrito && body.restrito_modo === "lista_registros") {
    const fonteModal =
      (Array.isArray(dadosDoModal?.registros_permitidos) && dadosDoModal.registros_permitidos) ||
      (Array.isArray(dadosDoModal?.registros) && dadosDoModal.registros) ||
      [];
    const fonteServer = Array.isArray(baseServidor?.registros_permitidos) ? baseServidor.registros_permitidos : [];
    const regs = normRegistros(fonteModal.length ? fonteModal : fonteServer);
    if (regs.length) body.registros_permitidos = regs;
  }

  // ✅ filtros por cargos/unidades
  const cargosModal = extractStrs(dadosDoModal?.cargos_permitidos);
  const cargosServer = extractStrs(baseServidor?.cargos_permitidos);
  if (restrito && cargosModal.length) body.cargos_permitidos = cargosModal;
  else if (restrito && cargosServer.length) body.cargos_permitidos = cargosServer;

  const unidsModal = extractIds(dadosDoModal?.unidades_permitidas);
  const unidsServer = extractIds(baseServidor?.unidades_permitidas);
  if (restrito && unidsModal.length) body.unidades_permitidas = unidsModal;
  else if (restrito && unidsServer.length) body.unidades_permitidas = unidsServer;

  // Turmas (agora carregam instrutores e assinante)
  let turmasFonte = [];
  if (Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length > 0) turmasFonte = dadosDoModal.turmas;
  else if (Array.isArray(baseServidor?.turmas) && baseServidor.turmas.length > 0) turmasFonte = baseServidor.turmas;

  const turmasPayload = normalizeTurmas(turmasFonte);
  if (turmasPayload.length > 0) body.turmas = turmasPayload;

  return clean(body);
}

/* ---------------- HeaderHero ---------------- */
function HeaderHero({ onCriar, onAtualizar, atualizando }) {
  return (
    <header className="relative isolate overflow-hidden bg-indigo-700 text-white" role="banner">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 md:py-9 min-h-[140px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gerenciar Eventos</h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">Crie, publique e edite seus eventos e turmas.</p>

          <div className="mt-2.5 sm:mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAtualizar}
              disabled={atualizando}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition
                ${atualizando ? "opacity-60 cursor-not-allowed bg-white/20" : "bg-white/15 hover:bg-white/25"} text-white`}
              aria-label="Atualizar lista de eventos"
              aria-busy={atualizando ? "true" : "false"}
            >
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>

            <button
              type="button"
              onClick={onCriar}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold bg-amber-400 text-slate-900 hover:bg-amber-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-400"
              aria-label="Criar novo evento"
            >
              <PlusCircle className="w-5 h-5" aria-hidden="true" />
              Criar Evento
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/25" aria-hidden="true" />
    </header>
  );
}

/* ========= Status do evento + cores de barra ========= */
function deduzStatus(ev) {
  const raw = String(ev?.status || "").toLowerCase();
  if (raw === "andamento") return "em_andamento";
  if (raw === "programado") return "programado";
  if (raw === "encerrado") return "encerrado";
  return "programado";
}
function statusBarClasses(status) {
  if (status === "programado") return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500";
  if (status === "em_andamento") return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  if (status === "encerrado") return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  return "bg-gradient-to-r from-slate-400 to-slate-300";
}

/* =============================
   Página
============================= */
export default function GerenciarEventos() {
  const reduceMotion = useReducedMotion();

  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // ── estados de confirmação via ModalConfirmacao
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, titulo }
  const [confirmPublish, setConfirmPublish] = useState(null); // { id, titulo, publicadoAtual }

  const liveRef = useRef(null);
  const abortListRef = useRef(null);
  const abortEditRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortListRef.current?.abort?.("unmount");
      abortEditRef.current?.abort?.("unmount");
    };
  }, []);

  const setLive = (msg) => {
    if (liveRef.current) liveRef.current.textContent = msg;
  };

  const recarregarEventos = useCallback(async () => {
    try {
      setErro("");
      setLoading(true);
      setLive("Carregando eventos…");

      abortListRef.current?.abort?.("new-request");
      const ctrl = new AbortController();
      abortListRef.current = ctrl;

      const data = await apiGet("/api/eventos", { on403: "silent", signal: ctrl.signal });

      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.eventos)
        ? data.eventos
        : Array.isArray(data?.lista)
        ? data.lista
        : [];

      if (!mountedRef.current) return;
      setEventos(lista);
      setLive(`Eventos carregados: ${lista.length}.`);
    } catch (err) {
      if (err?.name === "AbortError") return;
      const msg = err?.message || "Erro ao carregar eventos";
      console.error("/api/eventos erro:", err);
      if (!mountedRef.current) return;
      setErro(msg);
      setEventos([]);
      toast.error(`❌ ${msg}`);
      setLive("Falha ao carregar eventos.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    recarregarEventos();
  }, [recarregarEventos]);

  const abrirModalCriar = () => {
    setEventoSelecionado(null);
    setModalAberto(true);
  };

  const abrirModalEditar = useCallback(async (evento) => {
    setEventoSelecionado(evento);
    setModalAberto(true);

    // refina com dados completos (cancelável)
    abortEditRef.current?.abort?.("new-edit");
    const ctrl = new AbortController();
    abortEditRef.current = ctrl;

    try {
      let turmas = Array.isArray(evento.turmas) ? evento.turmas : [];
      if ((!turmas || turmas.length === 0) && evento?.id) {
        turmas = await fetchTurmasDoEvento(evento.id);
      }
      const base = (await fetchEventoCompleto(evento.id)) || evento;
      const combinado = { ...evento, ...base, turmas };
      if (!mountedRef.current || ctrl.signal.aborted) return;
      setEventoSelecionado(combinado);
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.warn("[abrirModalEditar] falha ao refinar:", e);
    }
  }, []);

  /* -------- EXCLUIR (com ModalConfirmacao) -------- */
  const pedirExclusao = (ev) => {
    if (!ev?.id) return;
    setConfirmDelete({ id: Number(ev.id), titulo: ev.titulo || "Evento" });
  };

  const confirmarExclusao = async () => {
    const alvo = confirmDelete;
    setConfirmDelete(null);
    if (!alvo?.id) return;

    try {
      await apiDelete(`/api/eventos/${alvo.id}`);
      toast.success("✅ Evento excluído.");
      await recarregarEventos();
    } catch (err) {
      console.error("delete evento erro:", err);
      toast.error(`❌ ${err?.message || "Erro ao excluir evento."}`);
    }
  };

  /* -------- publicar / despublicar (admin) com ModalConfirmacao -------- */
  const pedirTogglePublicacao = (ev) => {
    if (!ev?.id) return;
    setConfirmPublish({
      id: Number(ev.id),
      titulo: ev.titulo || "Evento",
      publicadoAtual: !!ev.publicado,
    });
  };

  const confirmarTogglePublicacao = async () => {
    const alvo = confirmPublish;
    setConfirmPublish(null);
    if (!alvo?.id) return;

    const id = alvo.id;
    const publicado = alvo.publicadoAtual;
    const acao = publicado ? "despublicar" : "publicar";

    setPublishingId(id);

    // otimista
    setEventos((prev) => prev.map((e) => (Number(e.id) === id ? { ...e, publicado: !publicado } : e)));

    try {
      await apiPost(`/api/eventos/${id}/${acao}`, {});
      toast.success(publicado ? "Evento despublicado." : "Evento publicado.");
    } catch (e) {
      // rollback
      setEventos((prev) => prev.map((ev) => (Number(ev.id) === id ? { ...ev, publicado } : ev)));
      toast.error(`❌ ${e?.message || "Falha ao alterar publicação."}`);
    } finally {
      setPublishingId(null);
    }
  };

  // valida as turmas: se houver assinante, ele deve estar na lista de instrutores
  function validarTurmasComInstrutores(turmasNorm) {
    for (const t of turmasNorm) {
      const instrs = Array.isArray(t.instrutores) ? t.instrutores : [];
      const assinante = Number.isFinite(Number(t.assinante_id))
        ? Number(t.assinante_id)
        : Number(t.instrutor_assinante_id);

      if (Number.isFinite(assinante) && !instrs.includes(assinante)) {
        return `O assinante selecionado na turma "${t.nome}" precisa estar entre os instrutores da turma.`;
      }
    }
    return null;
  }

  const salvarEvento = async (dadosDoModal) => {
    try {
      setSalvando(true);
      const isEdicao = Boolean(eventoSelecionado?.id);

      // ====== EDIÇÃO ======
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
            restrito: Boolean(eventoSelecionado?.restrito),
            restrito_modo: eventoSelecionado?.restrito_modo || null,
            cargos_permitidos: eventoSelecionado?.cargos_permitidos || [],
            unidades_permitidas: eventoSelecionado?.unidades_permitidas || [],
          };
        }

        const body = buildUpdateBody(baseServidor, dadosDoModal);

        // ✅ incluir sinalizações de remoção vindas do Modal
        if (dadosDoModal?.remover_folder === true) body.remover_folder = true;
        if (dadosDoModal?.remover_programacao === true) body.remover_programacao = true;

        // validação soft
        if (Array.isArray(body.turmas) && body.turmas.length > 0) {
          const msg = validarTurmasComInstrutores(body.turmas);
          if (msg) {
            toast.error(msg);
            return;
          }
        }

        await apiPut(`/api/eventos/${eventoSelecionado.id}`, body);

        // Uploads (folder/programação) se enviados
        if (dadosDoModal?.folderFile instanceof File) await uploadFolder(eventoSelecionado.id, dadosDoModal.folderFile);
        if (dadosDoModal?.programacaoFile instanceof File)
          await uploadProgramacao(eventoSelecionado.id, dadosDoModal.programacaoFile);

        await recarregarEventos();
        toast.success("✅ Evento salvo com sucesso.");

        const atualizado = await fetchEventoCompleto(eventoSelecionado.id);
        const turmasNovas = await fetchTurmasDoEvento(eventoSelecionado.id);
        setEventoSelecionado({ ...atualizado, turmas: turmasNovas });
        setModalAberto(false);
        return;
      }

      // ====== CRIAÇÃO ======
      const base = {
        titulo: (dadosDoModal?.titulo || "").trim(),
        tipo: (dadosDoModal?.tipo || "").trim(),
        unidade_id: dadosDoModal?.unidade_id,
        descricao: (dadosDoModal?.descricao || "").trim(),
        local: (dadosDoModal?.local || "").trim(),
        publico_alvo: (dadosDoModal?.publico_alvo || "").trim(),
      };

      // turmas (com instrutores e assinante)
      const turmas =
        Array.isArray(dadosDoModal?.turmas) && dadosDoModal.turmas.length
          ? normalizeTurmas(dadosDoModal.turmas)
          : normalizeTurmas([
              {
                nome: base.titulo || "Turma Única",
                data_inicio: ymd(dadosDoModal?.data_inicio),
                data_fim: ymd(dadosDoModal?.data_fim),
                horario_inicio: hhmm(dadosDoModal?.horario_inicio || "08:00"),
                horario_fim: hhmm(dadosDoModal?.horario_fim || "17:00"),
                vagas_total: 1,
                carga_horaria: 1,
                instrutores: extractIds(dadosDoModal?.instrutores) || [],
                assinante_id: Number(dadosDoModal?.instrutor_assinante_id ?? dadosDoModal?.assinante_id),
                instrutor_assinante_id: Number(dadosDoModal?.instrutor_assinante_id ?? dadosDoModal?.assinante_id),
              },
            ]);

      const msgTurma = validarTurmasComInstrutores(turmas);
      if (msgTurma) {
        toast.error(msgTurma);
        return;
      }

      const restrito = Boolean(dadosDoModal?.restrito);
      const restrito_modo = restrito ? dadosDoModal?.restrito_modo || "todos_servidores" : null;

      const regsFonte =
        (Array.isArray(dadosDoModal?.registros_permitidos) && dadosDoModal.registros_permitidos) ||
        (Array.isArray(dadosDoModal?.registros) && dadosDoModal.registros) ||
        [];

      const registros = restrito && restrito_modo === "lista_registros" ? normRegistros(regsFonte) : undefined;

      const cargos_permitidos =
        restrito && Array.isArray(dadosDoModal?.cargos_permitidos)
          ? extractStrs(dadosDoModal.cargos_permitidos)
          : undefined;

      const unidades_permitidas =
        restrito && Array.isArray(dadosDoModal?.unidades_permitidas)
          ? extractIds(dadosDoModal.unidades_permitidas)
          : undefined;

      const bodyCreate = clean({
        ...base,
        turmas,
        restrito,
        restrito_modo,
        registros_permitidos: registros,
        cargos_permitidos,
        unidades_permitidas,
      });

      const criado = await apiPost("/api/eventos", bodyCreate);

      // id do evento recém criado
      const novoId = Number(criado?.id) || Number(criado?.evento?.id) || Number(criado?.dados?.id);

      // Uploads após criar
      if (novoId && dadosDoModal?.folderFile instanceof File) await uploadFolder(novoId, dadosDoModal.folderFile);
      if (novoId && dadosDoModal?.programacaoFile instanceof File)
        await uploadProgramacao(novoId, dadosDoModal.programacaoFile);

      await recarregarEventos();
      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
    } catch (err) {
      console.error("salvarEvento erro:", err?.message, err);
      if (err?.data) console.log("err.data:", err.data);
      toast.error(err?.message || "Erro ao salvar o evento.");
    } finally {
      setSalvando(false);
    }
  };

  const anyLoading = loading;

  const headerHint = useMemo(() => {
    if (anyLoading) return "Carregando…";
    return `${eventos.length} evento(s)`;
  }, [anyLoading, eventos.length]);

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" aria-atomic="true" />

      {/* ── Modais de confirmação ── */}
      <ModalConfirmacao
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmarExclusao}
        titulo="Excluir evento"
        confirmarTexto="Excluir"
        cancelarTexto="Cancelar"
        danger
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Tem certeza que deseja excluir{" "}
          <span className="font-semibold">{confirmDelete?.titulo}</span>? Essa ação não pode ser desfeita.
        </p>
      </ModalConfirmacao>

      <ModalConfirmacao
        open={!!confirmPublish}
        onClose={() => setConfirmPublish(null)}
        onConfirm={confirmarTogglePublicacao}
        titulo={confirmPublish?.publicadoAtual ? "Despublicar evento" : "Publicar evento"}
        confirmarTexto={confirmPublish?.publicadoAtual ? "Despublicar" : "Publicar"}
        cancelarTexto="Cancelar"
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          {confirmPublish?.publicadoAtual
            ? <>Despublicar <span className="font-semibold">{confirmPublish?.titulo}</span>? Ele deixará de aparecer para os usuários.</>
            : <>Publicar <span className="font-semibold">{confirmPublish?.titulo}</span>? Ele ficará visível para os usuários.</>}
        </p>
      </ModalConfirmacao>

      {/* Header hero */}
      <HeaderHero onCriar={abrirModalCriar} onAtualizar={recarregarEventos} atualizando={anyLoading} />

      {/* barra de carregamento fina no topo */}
      {anyLoading && (
        <div
          className="sticky top-0 left-0 w-full h-1 bg-indigo-100 dark:bg-indigo-950/30 z-40"
          role="progressbar"
          aria-label="Carregando dados"
        >
          <div className={`h-full bg-indigo-700 ${reduceMotion ? "" : "animate-pulse"} w-1/3`} />
        </div>
      )}

      <div id="conteudo" className="px-2 sm:px-4 py-6 max-w-6xl mx-auto w-full min-w-0">
        {/* mini hint */}
        <div className="mb-3 text-xs text-zinc-500 dark:text-zinc-300 text-center">{headerHint}</div>

        {!!erro && !loading && (
          <div
            className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/25 p-4 mb-4"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 mt-0.5 text-rose-600 dark:text-rose-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-rose-800 dark:text-rose-200">Falha ao carregar eventos</p>
                <p className="text-sm text-rose-800/90 dark:text-rose-200/90 mt-1 break-words">{erro}</p>

                <button
                  type="button"
                  onClick={recarregarEventos}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonEvento />
        ) : eventos.length === 0 ? (
          <NenhumDado mensagem="Nenhum evento cadastrado." />
        ) : (
          <ul className="space-y-4 sm:space-y-6">
            {eventos.map((ev) => {
              const publicado = !!ev.publicado;
              const status = deduzStatus(ev);
              const bar = statusBarClasses(status);

              return (
                <motion.li
                  key={ev.id || ev.titulo}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  className="relative bg-white dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden min-w-0"
                >
                  {/* Barra colorida superior (gradiente por status) */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${bar}`} aria-hidden="true" />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                    {/* Título + badges */}
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="font-extrabold text-lg text-lousa dark:text-white break-words">
                        {ev.titulo}
                      </span>

                      {/* Badge de publicação */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border
                          ${
                            publicado
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800"
                              : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                          }`}
                        title={publicado ? "Visível aos usuários" : "Oculto aos usuários"}
                      >
                        {publicado ? "Publicado" : "Rascunho"}
                      </span>

                      {/* Status textual */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-zinc-900/40 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700"
                        title="Status calculado por data/horário"
                      >
                        {status === "programado" ? "Programado" : status === "em_andamento" ? "Em andamento" : "Encerrado"}
                      </span>

                      {/* Badge de restrição */}
                      {ev?.restrito && (
                        <span
                          title={
                            ev.restrito_modo === "lista_registros"
                              ? "Restrito a uma lista de registros"
                              : ev.restrito_modo === "cargos"
                              ? "Restrito por cargos"
                              : ev.restrito_modo === "unidades"
                              ? "Restrito por unidades"
                              : "Visível a todos os servidores"
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                        >
                          <Lock size={12} aria-hidden="true" />
                          {ev.restrito_modo === "lista_registros"
                            ? "Lista"
                            : ev.restrito_modo === "cargos"
                            ? "Cargos"
                            : ev.restrito_modo === "unidades"
                            ? "Unidades"
                            : "Servidores"}
                        </span>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => pedirTogglePublicacao(ev)}
                        disabled={publishingId === Number(ev.id)}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-1 border text-sm font-extrabold
                          ${
                            publicado
                              ? "border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-900/30"
                              : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          } disabled:opacity-60`}
                        aria-label={publicado ? `Despublicar evento ${ev.titulo}` : `Publicar evento ${ev.titulo}`}
                        aria-pressed={publicado ? "true" : "false"}
                      >
                        {publishingId === Number(ev.id) ? (
                          <span className="animate-pulse">…</span>
                        ) : publicado ? (
                          <>
                            <EyeOff size={16} aria-hidden="true" /> Despublicar
                          </>
                        ) : (
                          <>
                            <Eye size={16} aria-hidden="true" /> Publicar
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirModalEditar(ev)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 font-extrabold text-sm"
                        aria-label={`Editar evento ${ev.titulo}`}
                      >
                        <Pencil size={16} aria-hidden="true" /> Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => pedirExclusao(ev)}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 font-extrabold text-sm"
                        aria-label={`Excluir evento ${ev.titulo}`}
                      >
                        <Trash2 size={16} aria-hidden="true" /> Excluir
                      </button>
                    </div>
                  </div>

                  {(ev?.publico_alvo || ev?.tipo || ev?.local) && (
                    <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 break-words">
                      {ev?.tipo && (
                        <span className="mr-3">
                          Tipo: <span className="font-medium">{ev.tipo}</span>
                        </span>
                      )}
                      {ev?.local && (
                        <span className="mr-3">
                          Local: <span className="font-medium">{ev.local}</span>
                        </span>
                      )}
                      {ev?.publico_alvo && (
                        <span>
                          Público-alvo: <span className="font-medium">{ev.publico_alvo}</span>
                        </span>
                      )}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <ModalEvento
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSalvar={salvarEvento}
        evento={eventoSelecionado}
        salvando={salvando}
        onTurmaRemovida={() => recarregarEventos()}
      />

      <Footer />
    </main>
  );
}
