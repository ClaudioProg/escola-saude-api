/* eslint-disable no-console */
// ✅ src/pages/GerenciarEventos.jsx (admin) — publicar/despublicar + UI moderna + barra colorida no topo
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  PlusCircle,
  Lock,
  RefreshCcw,
  Eye,
  EyeOff,
} from "lucide-react";

import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";
import ModalEvento from "../components/ModalEvento";
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
      // 1️⃣ primeiro pega a rota administrativa completa
      `/api/eventos/${eventoId}`,
  
      // 2️⃣ depois tenta rotas alternativas / de fallback
      `/api/eventos/${eventoId}/turmas`,
      `/api/turmas/por-evento/${eventoId}`,
      `/api/turmas/evento/${eventoId}`,
    ];
  
    for (const url of urls) {
      try {
        const resp = await apiGet(url, { on403: "silent" });
  
        // se a resposta JÁ É um evento inteiro
        if (resp && resp.id && Array.isArray(resp.turmas)) {
          return resp.turmas;
        }
  
        // se a resposta é um array direto de turmas
        if (Array.isArray(resp)) {
          return resp;
        }
  
        // se a resposta veio embrulhada
        if (Array.isArray(resp?.turmas)) {
          return resp.turmas;
        }
        if (Array.isArray(resp?.lista)) {
          return resp.lista;
        }
      } catch {
        // tenta próxima URL
      }
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

/* ---------------- HeaderHero (cor sólida; sem degradês) ---------------- */
function HeaderHero({ onCriar, onAtualizar, atualizando }) {
  return (
    <header className="relative isolate overflow-hidden bg-indigo-700 text-white" role="banner">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2">
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-8 md:py-9 min-h-[140px] sm:min-h-[170px]">
        <div className="flex flex-col items-center text-center gap-2.5 sm:gap-3">
          <div className="inline-flex items-center justify-center gap-2">
            <svg width="0" height="0" aria-hidden="true" />{/* evita layout shift de ícone */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gerenciar Eventos
            </h1>
          </div>

          <p className="text-sm sm:text-base text-white/90 max-w-2xl">
            Crie, publique e edite seus eventos e turmas.
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
              <RefreshCcw className="w-4 h-4" aria-hidden="true" />
              {atualizando ? "Atualizando…" : "Atualizar"}
            </button>

            <button
              type="button"
              onClick={onCriar}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-400"
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
const toLocalDate = (ymdStr, hh = "00", mm = "00") =>
  ymdStr ? new Date(`${ymdStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`) : null;

function deduzStatus(ev) {
  const agora = new Date();

  const di = ymd(ev.data_inicio_geral || ev.data_inicio || ev.data);
  const df = ymd(ev.data_fim_geral || ev.data_fim || ev.data);
  const hi = hhmm(ev.horario_inicio_geral || ev.horario_inicio || "00:00");
  const hf = hhmm(ev.horario_fim_geral || ev.horario_fim || "23:59");

  const [hiH, hiM] = (hi || "00:00").split(":");
  const [hfH, hfM] = (hf || "23:59").split(":");

  let inicioDT = toLocalDate(di, hiH, hiM);
  let fimDT = toLocalDate(df, hfH, hfM);

  // se tiver ranges inconsistentes, tenta só data
  if (!inicioDT && di) inicioDT = toLocalDate(di, "00", "00");
  if (!fimDT && df) fimDT = toLocalDate(df, "23", "59");

  if (!inicioDT || !fimDT) return "programado"; // fallback amigável visualmente

  if (inicioDT > agora) return "programado";
  if (inicioDT <= agora && fimDT >= agora) return "em_andamento";
  return "encerrado";
}

function statusBarClasses(status) {
  // padrão do Cláudio:
  // programado → verde, em andamento → amarelo, encerrado → vermelho (gradiente)
  if (status === "programado") return "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500";
  if (status === "em_andamento") return "bg-gradient-to-r from-amber-700 via-amber-600 to-amber-400";
  if (status === "encerrado") return "bg-gradient-to-r from-rose-800 via-rose-700 to-rose-500";
  return "bg-gradient-to-r from-slate-400 to-slate-300";
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
  const [publishingId, setPublishingId] = useState(null); // 🔁 loading por item (publicar/despublicar)
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
        // ====== MODO EDIÇÃO ======
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
              Array.isArray(dadosDoModal?.registros_permitidos)
                ? dadosDoModal.registros_permitidos
                : Array.isArray(dadosDoModal?.registros)
                ? dadosDoModal.registros
                : undefined;
  
            const regsEventOnly =
              Array.isArray(fonteRegsModal) && fonteRegsModal.length > 0
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
                  (typeof baseServidor?.restrito === "boolean"
                    ? baseServidor.restrito
                    : false)
              ),
              restrito_modo:
                (dadosDoModal?.restrito ?? baseServidor?.restrito)
                  ? (dadosDoModal?.restrito_modo ??
                      baseServidor?.restrito_modo ??
                      null)
                  : null,
              registros_permitidos:
                (dadosDoModal?.restrito ?? baseServidor?.restrito) &&
                (dadosDoModal?.restrito_modo ?? baseServidor?.restrito_modo) ===
                  "lista_registros"
                  ? regsEventOnly
                  : undefined,
            });
  
            await apiPut(`/api/eventos/${eventoSelecionado.id}`, bodyEventOnly);
  
            await recarregarEventos();
            toast.success(
              "✅ Dados gerais e restrição atualizados. As turmas não foram alteradas."
            );
            setModalAberto(false);
            return;
          }
          throw err;
        }
  
        // chegou aqui = PUT normal deu certo
        await recarregarEventos();
        toast.success("✅ Evento salvo com sucesso.");
  
        // traz estado oficial do servidor pra manter o modal coerente
        const atualizado = await fetchEventoCompleto(eventoSelecionado.id);
        const turmasNovas = await fetchTurmasDoEvento(eventoSelecionado.id);
  
        setEventoSelecionado({
          ...atualizado,
          turmas: turmasNovas,
        });
  
        setModalAberto(false);
        return;
      }
  
      // ====== MODO CRIAÇÃO ======
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
  
      const di = ymd(
        dadosDoModal?.data_inicio_geral ?? dadosDoModal?.data_inicio
      );
      const df = ymd(
        dadosDoModal?.data_fim_geral ?? dadosDoModal?.data_fim
      );
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
        ? dadosDoModal?.restrito_modo || "todos_servidores"
        : null;
  
      const regsFonte = Array.isArray(dadosDoModal?.registros_permitidos)
        ? dadosDoModal.registros_permitidos
        : Array.isArray(dadosDoModal?.registros)
        ? dadosDoModal.registros
        : undefined;
  
      const registros =
        restrito && restrito_modo === "lista_registros"
          ? normRegistros(regsFonte || [])
          : undefined;
  
      const bodyCreate = clean({
        ...base,
        instrutor: instrutores,
        turmas,
        restrito,
        restrito_modo,
        registros_permitidos: registros,
      });
  
      await apiPost("/api/eventos", bodyCreate);
  
      await recarregarEventos();
      toast.success("✅ Evento salvo com sucesso.");
      setModalAberto(false);
      return;
    } catch (err) {
      console.error("❌ salvar evento:", err?.message, err);
      if (err?.data) console.log("err.data:", err.data);
      toast.error(err?.message || "Erro ao salvar o evento.");
    }
  };
  /* -------- publicar / despublicar (admin) -------- */
  const togglePublicacao = async (evento) => {
    if (!evento?.id) return;
    const id = Number(evento.id);
    const publicado = !!evento.publicado;
    const acao = publicado ? "despublicar" : "publicar";

    const conf = window.confirm(
      publicado
        ? `Despublicar "${evento.titulo}"? Ele deixará de aparecer para os usuários.`
        : `Publicar "${evento.titulo}"? Ele ficará visível para os usuários.`
    );
    if (!conf) return;

    setPublishingId(id);
    // estado otimista
    setEventos((prev) =>
      prev.map((e) => (Number(e.id) === id ? { ...e, publicado: !publicado } : e))
    );

    try {
      await apiPost(`/api/eventos/${id}/${acao}`, {});
      toast.success(publicado ? "Evento despublicado." : "Evento publicado.");
    } catch (e) {
      // rollback se falhar
      setEventos((prev) =>
        prev.map((e) => (Number(e.id) === id ? { ...e, publicado } : e))
      );
      const msg = e?.message || "Falha ao alterar publicação.";
      toast.error(`❌ ${msg}`);
      console.error("togglePublicacao error:", e);
    } finally {
      setPublishingId(null);
    }
  };

  const anyLoading = loading;

  return (
    <main className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white overflow-x-hidden">
      {/* live region acessível */}
      <p ref={liveRef} className="sr-only" aria-live="polite" />

      {/* Header hero (cor sólida) */}
      <HeaderHero
        onCriar={abrirModalCriar}
        onAtualizar={recarregarEventos}
        atualizando={anyLoading}
      />

      {/* barra de carregamento fina no topo */}
      {anyLoading && (
        <div className="sticky top-0 left-0 w-full h-1 bg-indigo-100 z-40" role="progressbar" aria-label="Carregando dados">
          <div className="h-full bg-indigo-700 animate-pulse w-1/3" />
        </div>
      )}

      <div id="conteudo" className="px-2 sm:px-4 py-6 max-w-6xl mx-auto w-full min-w-0">
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
            {eventos.map((ev) => {
              const publicado = !!ev.publicado;
              const status = deduzStatus(ev);
              const bar = statusBarClasses(status);

              return (
                <motion.li
                  key={ev.id || ev.titulo}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-white dark:bg-zinc-800 p-4 sm:p-5 rounded-2xl shadow border border-gray-200 dark:border-zinc-700 overflow-hidden min-w-0"
                >
                  {/* 🔶 Barra colorida superior (gradiente por status) */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${bar}`} aria-hidden="true" />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                    {/* Título + badges */}
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="font-semibold text-lg text-lousa dark:text-white break-words">
                        {ev.titulo}
                      </span>

                      {/* Badge de publicação (sólida) */}
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

                      {/* Status textual (opcional) */}
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800 dark:bg-zinc-900/40 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700"
                        title="Status calculado por data/horário"
                      >
                        {status === "programado" ? "Programado" : status === "em_andamento" ? "Em andamento" : "Encerrado"}
                      </span>

                      {/* Badge de restrição (sólida) */}
                      {ev?.restrito && (
                        <span
                          title={
                            ev.restrito_modo === "lista_registros"
                              ? "Restrito a uma lista de registros"
                              : "Visível a todos os servidores (com registro cadastrado)"
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                        >
                          <Lock size={12} aria-hidden="true" />
                          {ev.restrito_modo === "lista_registros" ? "Lista" : "Servidores"}
                        </span>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => togglePublicacao(ev)}
                        disabled={publishingId === Number(ev.id)}
                        className={`px-3 py-1.5 rounded flex items-center gap-1 border text-sm font-medium
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
                        onClick={() => abrirModalEditar(ev)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                        aria-label={`Editar evento ${ev.titulo}`}
                      >
                        <Pencil size={16} aria-hidden="true" /> Editar
                      </button>

                      <button
                        onClick={() => excluirEvento(ev.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        aria-label={`Excluir evento ${ev.titulo}`}
                      >
                        <Trash2 size={16} aria-hidden="true" /> Excluir
                      </button>
                    </div>
                  </div>

                  {/* Subinfo opcional */}
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
        onTurmaRemovida={() => recarregarEventos()}
      />

      <Footer />
    </main>
  );
}
