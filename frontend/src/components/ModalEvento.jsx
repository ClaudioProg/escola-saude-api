// 📁 src/components/ModalEvento.jsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  MapPin,
  FileText,
  Layers3,
  PlusCircle,
  Trash2,
  Lock,
  Unlock,
  X,
} from "lucide-react";
import ModalBase from "./ModalBase";
import ModalTurma from "./ModalTurma";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet, apiDelete } from "../services/api";

/* ========================= Constantes / Utils ========================= */
const TIPOS_EVENTO = [
  "Congresso",
  "Curso",
  "Oficina",
  "Palestra",
  "Seminário",
  "Simpósio",
  "Outros",
];

const minDate = (arr) => arr.map((d) => d.data).sort()[0];
const maxDate = (arr) => arr.map((d) => d.data).sort().slice(-1)[0];
const hh = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const normReg = (s) => String(s || "").replace(/\D/g, "");
const parseRegsBulk = (txt) => {
  const runs = String(txt || "").match(/\d+/g) || [];
  const out = [];
  for (const run of runs) {
    const clean = normReg(run);
    if (clean.length >= 6) {
      for (let i = 0; i + 6 <= clean.length; i++) out.push(clean.slice(i, i + 6));
    }
  }
  return Array.from(new Set(out.filter((r) => /^\d{6}$/.test(r))));
};

// Badge
const Badge = ({ children, title, ariaLabel }) => (
  <span
    title={title}
    aria-label={ariaLabel || title}
    className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
  >
    {children}
  </span>
);

/* Normalização de turmas/datas */
function encontrosParaDatas(turma) {
  const baseHi = hh(turma.horario_inicio || turma.hora_inicio || "08:00");
  const baseHf = hh(turma.horario_fim || turma.hora_fim || "17:00");
  const enc = Array.isArray(turma?.encontros) ? turma.encontros : [];

  const fromEnc = enc
    .map((e) => {
      if (typeof e === "string") {
        const data = e.slice(0, 10);
        return data ? { data, horario_inicio: baseHi, horario_fim: baseHf } : null;
      }
      if (e && typeof e === "object") {
        const data = e.data?.slice(0, 10);
        const horario_inicio = hh(e.inicio || e.horario_inicio || baseHi);
        const horario_fim = hh(e.fim || e.horario_fim || baseHf);
        return data ? { data, horario_inicio, horario_fim } : null;
      }
      return null;
    })
    .filter(Boolean);

  if (Array.isArray(turma?.datas) && turma.datas.length) return turma.datas;
  return fromEnc;
}

function normalizarDatasTurma(t, hiBase = "08:00", hfBase = "17:00") {
  const hi = hh(t.horario_inicio || t.hora_inicio || hiBase);
  const hf = hh(t.horario_fim || t.hora_fim || hfBase);

  const datasRaw =
    (Array.isArray(t.datas) && t.datas.length && t.datas) || encontrosParaDatas(t) || [];

  const datas = (datasRaw || [])
    .map((d) => {
      const data = (d?.data || d || "").slice(0, 10);
      const horario_inicio = hh(d?.horario_inicio || d?.inicio || hi);
      const horario_fim = hh(d?.horario_fim || d?.fim || hf);
      return data && horario_inicio && horario_fim
        ? { data, horario_inicio, horario_fim }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));

  return {
    datas,
    data_inicio: datas[0]?.data || t.data_inicio,
    data_fim: datas.at(-1)?.data || t.data_fim,
    horario_inicio: datas[0]?.horario_inicio || hi,
    horario_fim: datas[0]?.horario_fim || hf,
  };
}

/* Aceita evento.instrutor ou evento.instrutores */
const getInstrutoresIds = (ev) => {
  const arr = Array.isArray(ev?.instrutores)
    ? ev.instrutores
    : Array.isArray(ev?.instrutor)
    ? ev.instrutor
    : [];
  return arr.map((i) => Number(i?.id ?? i)).filter((x) => Number.isFinite(x));
};

/* ========================= Componente ========================= */
export default function ModalEvento({
  isOpen,
  onClose,
  onSalvar,
  evento,
  onTurmaRemovida,
  salvando = false,
}) {
  // ================= States =================
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [turmas, setTurmas] = useState([]);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState([""]);
  const [removendoId, setRemovendoId] = useState(null);

  // 🔒 restrições
  const [restrito, setRestrito] = useState(false);
  const [restritoModo, setRestritoModo] = useState(""); // 'todos_servidores' | 'lista_registros'
  const [registroInput, setRegistroInput] = useState("");
  const [registros, setRegistros] = useState([]); // strings (6 dígitos)

  // ================= Derivados =================
  const opcoesInstrutor = useMemo(
    () =>
      usuarios.filter((usuario) => {
        const perfil = (Array.isArray(usuario.perfil)
          ? usuario.perfil.join(",")
          : String(usuario.perfil || "")
        ).toLowerCase();
        return perfil.includes("instrutor") || perfil.includes("administrador");
      }),
    [usuarios]
  );

  function handleSelecionarInstrutor(index, valor) {
    const nova = [...instrutorSelecionado];
    nova[index] = valor;
    setInstrutorSelecionado(nova);
  }
  function adicionarInstrutor() {
    setInstrutorSelecionado((l) => [...l, ""]);
  }
  function removerInstrutor(index) {
    const nova = instrutorSelecionado.filter((_, i) => i !== index);
    setInstrutorSelecionado(nova.length ? nova : [""]);
  }
  function getInstrutorDisponivel(index) {
    return opcoesInstrutor.filter(
      (i) =>
        !instrutorSelecionado.includes(String(i.id)) ||
        instrutorSelecionado[index] === String(i.id)
    );
  }

  // ================= Effects =================
  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo || "");
      setDescricao(evento.descricao || "");
      setLocal(evento.local || "");
      setTipo(evento.tipo || "");
      setUnidadeId(evento.unidade_id || "");
      setPublicoAlvo(evento.publico_alvo || "");

      // instrutores
      setInstrutorSelecionado(
        getInstrutoresIds(evento).map(String).filter(Boolean).length
          ? getInstrutoresIds(evento).map(String)
          : [""]
      );

      // turmas (normalizadas)
      setTurmas(
        (evento.turmas || []).map((t) => {
          const n = normalizarDatasTurma(t);
          return {
            ...t,
            datas: n.datas,
            data_inicio: n.data_inicio,
            data_fim: n.data_fim,
            horario_inicio: n.horario_inicio,
            horario_fim: n.horario_fim,
            carga_horaria: Number.isFinite(Number(t.carga_horaria))
              ? Number(t.carga_horaria)
              : 0,
            vagas_total: Number.isFinite(Number(t.vagas_total))
              ? Number(t.vagas_total)
              : 0,
          };
        })
      );

      const restr = !!evento.restrito;
      setRestrito(restr);

      const modoFromVis =
        evento.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
      const modo = evento.restrito_modo || (restr ? modoFromVis : "");
      setRestritoModo(modo);

      const lista =
        (Array.isArray(evento.registros_permitidos)
          ? evento.registros_permitidos
          : null) ?? (Array.isArray(evento.registros) ? evento.registros : []);
      const onlySix = (lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r));
      setRegistros(Array.from(new Set(onlySix)));
      setRegistroInput("");
    } else {
      setTitulo("");
      setDescricao("");
      setLocal("");
      setTipo("");
      setUnidadeId("");
      setPublicoAlvo("");
      setInstrutorSelecionado([""]);
      setTurmas([]);
      setRestrito(false);
      setRestritoModo("");
      setRegistros([]);
      setRegistroInput("");
    }
  }, [evento, isOpen]);

  useEffect(() => {
    if (!isOpen || !evento?.id) return;
    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);
        if (typeof det.restrito === "boolean") setRestrito(!!det.restrito);
        if (det.restrito_modo || det.vis_reg_tipo) {
          setRestritoModo(
            det.restrito_modo ||
              (det.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores")
          );
        }
        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];
        const parsed = (lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r));
        setRegistros([...new Set(parsed)]);
      } catch {
        /* silencioso */
      }
    })();
  }, [isOpen, evento?.id]);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/api/unidades");
        setUnidades(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erro ao carregar unidades.");
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet("/api/usuarios");
        setUsuarios(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Erro ao carregar usuários.");
      }
    })();
  }, []);

  // ================= Handlers de Registro =================
  const addRegistro = () => {
    const novos = parseRegsBulk(registroInput);
    if (!novos.length) {
      toast.info("Informe/cole ao menos uma sequência de 6 dígitos.");
      return;
    }
    setRegistros((prev) => Array.from(new Set([...prev, ...novos])));
    setRegistroInput("");
  };
  const addRegistrosBulk = (txt) => {
    const novos = parseRegsBulk(txt);
    if (!novos.length) {
      toast.info("Nenhuma sequência de 6 dígitos encontrada.");
      return;
    }
    setRegistros((prev) => Array.from(new Set([...prev, ...novos])));
    setRegistroInput("");
  };
  const removeRegistro = (r) => setRegistros((prev) => prev.filter((x) => x !== r));

  // ================= Submit =================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!titulo || !tipo || !unidadeId) {
      toast.warning("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }
    if (!TIPOS_EVENTO.includes(tipo)) {
      toast.error("❌ Tipo de evento inválido.");
      return;
    }
    if (!turmas.length) {
      toast.warning("⚠️ Adicione pelo menos uma turma.");
      return;
    }

    for (const t of turmas) {
      if (!t.nome || !Number(t.vagas_total) || !Number.isFinite(Number(t.carga_horaria))) {
        toast.error("❌ Preencha nome, vagas e carga horária de cada turma.");
        return;
      }
      if (!Array.isArray(t.datas) || t.datas.length === 0) {
        toast.error("❌ Cada turma precisa ter ao menos uma data.");
        return;
      }
      for (const d of t.datas) {
        if (!d?.data || !d?.horario_inicio || !d?.horario_fim) {
          toast.error("❌ Preencha data, início e fim em todos os encontros.");
          return;
        }
      }
    }

    if (restrito) {
      if (!["todos_servidores", "lista_registros"].includes(restritoModo)) {
        toast.error("Defina o modo de restrição do evento.");
        return;
      }
      if (restritoModo === "lista_registros" && registros.length === 0) {
        toast.error("Inclua pelo menos um registro (6 dígitos) para este evento.");
        return;
      }
    }

    const instrutorValidado = instrutorSelecionado.map(Number).filter((id) => !Number.isNaN(id));

    const turmasCompletas = turmas.map((t) => {
      const n = normalizarDatasTurma(t);
      return {
        nome: t.nome,
        data_inicio: n.data_inicio,
        data_fim: n.data_fim,
        horario_inicio: n.horario_inicio,
        horario_fim: n.horario_fim,
        vagas_total: Number(t.vagas_total) || 0,
        carga_horaria: Number(t.carga_horaria) || 0,
        encontros: n.datas.map((d) => ({
          data: d.data,
          inicio: d.horario_inicio,
          fim: d.horario_fim,
        })),
      };
    });

    const turmaPrincipal = turmasCompletas[0] || {};
    const regs6 = Array.from(new Set(registros.filter((r) => /^\d{6}$/.test(r))));
    const vis_reg_tipo = restrito
      ? restritoModo === "lista_registros"
        ? "lista"
        : "todos"
      : "todos";

    const payload = {
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,

      instrutor: instrutorValidado,
      instrutores: instrutorValidado,

      turmas: turmasCompletas,

      data_inicio: turmaPrincipal.data_inicio,
      data_fim: turmaPrincipal.data_fim,
      horario_inicio: turmaPrincipal.horario_inicio,
      horario_fim: turmaPrincipal.horario_fim,
      hora_inicio: turmaPrincipal.horario_inicio,
      hora_fim: turmaPrincipal.horario_fim,

      vagas_total: Number(turmaPrincipal.vagas_total) || 0,
      carga_horaria: Number(turmaPrincipal.carga_horaria) || 0,

      ...(evento?.id ? { id: evento.id } : {}),

      restrito: !!restrito,
      restrito_modo: restrito ? restritoModo || "todos_servidores" : "",
      vis_reg_tipo,
      ...(restrito && vis_reg_tipo === "lista" && regs6.length > 0
        ? { registros_permitidos: regs6 }
        : {}),
    };

    console.log("[PUT evento] payload:", payload);
    onSalvar(payload);
    onClose();
  };

  async function removerTurma(turma, idx) {
    const nome = turma?.nome || `Turma ${idx + 1}`;
    const ok = window.confirm(
      `Remover a turma "${nome}"?\n\nEsta ação não pode ser desfeita.\nSe houver presenças ou certificados, a exclusão será bloqueada.`
    );
    if (!ok) return;

    if (!turma?.id) {
      setTurmas((prev) => prev.filter((_, i) => i !== idx));
      toast.info("Turma removida (rascunho).");
      return;
    }

    try {
      setRemovendoId(turma.id);
      await apiDelete(`/api/turmas/${turma.id}`);
      setTurmas((prev) => prev.filter((t) => t.id !== turma.id));
      toast.success("Turma removida com sucesso.");
      onTurmaRemovida?.(turma.id);
    } catch (err) {
      const code = err?.data?.erro;
      if (err?.status === 409 || code === "TURMA_COM_REGISTROS") {
        const c = err?.data?.contagens || {};
        toast.error(
          `Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`
        );
      } else if (err?.status === 404) {
        toast.warn("Turma não encontrada. Atualize a página.");
      } else {
        toast.error("Erro ao remover turma.");
      }
      console.error("[removerTurma(modal)]", err);
    } finally {
      setRemovendoId(null);
    }
  }

  const regCount =
    Array.isArray(registros) && registros.length > 0
      ? registros.length
      : Number(evento?.count_registros_permitidos ?? 0);

  /* ========================= Render ========================= */
  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={onClose}
        level={0}
        maxWidth="max-w-3xl"
        labelledBy="modal-evento-titulo"
        describedBy="modal-evento-desc"
      >
        {/* card com cantos arredondados e body rolável */}
        <div className="grid grid-rows-[auto,1fr,auto] max-h-[90vh] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-xl">
          {/* HEADER */}
          <div className="p-5 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 id="modal-evento-titulo" className="text-lg sm:text-xl font-bold tracking-tight">
                {evento?.id ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {/* descrição fixa para ARIA (estrutura estável) */}
            <p id="modal-evento-desc" className="sr-only">
              Formulário para criação ou edição de evento, incluindo turmas e restrições de acesso.
            </p>
          </div>

          {/* BODY */}
          <div className="p-5 overflow-y-auto">
            <form
              id="form-evento"
              onSubmit={handleSubmit}
              className="space-y-4"
              aria-labelledby="modal-evento-titulo"
              role="form"
            >
              {/* TÍTULO */}
              <div className="grid gap-1">
                <label htmlFor="evento-titulo" className="text-sm font-medium">Título *</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="evento-titulo"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ex.: Curso de Atualização em Urgência"
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* DESCRIÇÃO */}
              <div className="grid gap-1">
                <label htmlFor="evento-descricao" className="text-sm font-medium">Descrição</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <textarea
                    id="evento-descricao"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Contexto, objetivos e observações do evento."
                    className="w-full pl-10 pr-3 py-2 h-24 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                  />
                </div>
              </div>

              {/* PÚBLICO-ALVO */}
              <div className="grid gap-1">
                <label htmlFor="evento-publico" className="text-sm font-medium">Público-alvo</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="evento-publico"
                    value={publicoAlvo}
                    onChange={(e) => setPublicoAlvo(e.target.value)}
                    placeholder="Ex.: Profissionais da APS, enfermeiros, médicos"
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                  />
                </div>
              </div>

              {/* INSTRUTOR(ES) */}
              <div className="grid gap-2">
                <span className="text-sm font-medium">Instrutor(es)</span>
                {instrutorSelecionado.map((valor, index) => (
                  <div key={`instrutor-${index}`} className="relative">
                    <div className="flex items-center gap-2">
                      <select
                        value={valor}
                        onChange={(e) => handleSelecionarInstrutor(index, e.target.value)}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                        required={index === 0}
                        aria-label={index === 0 ? "Instrutor principal" : `Instrutor adicional ${index}`}
                      >
                        <option value="">Selecione o instrutor</option>
                        {getInstrutorDisponivel(index).map((i) => (
                          <option key={i.id} value={i.id}>{i.nome}</option>
                        ))}
                      </select>

                      {index > 0 ? (
                        <button
                          type="button"
                          onClick={() => removerInstrutor(index)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remover este instrutor"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remover
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={adicionarInstrutor}
                          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                        >
                          <PlusCircle className="w-4 h-4" />
                          Incluir outro
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* LOCAL */}
              <div className="grid gap-1">
                <label htmlFor="evento-local" className="text-sm font-medium">Local *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <input
                    id="evento-local"
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    placeholder="Ex.: Auditório da Escola da Saúde"
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* TIPO */}
              <div className="grid gap-1">
                <label htmlFor="evento-tipo" className="text-sm font-medium">Tipo *</label>
                <div className="relative">
                  <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <select
                    id="evento-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    {TIPOS_EVENTO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* UNIDADE */}
              <div className="grid gap-1">
                <label htmlFor="evento-unidade" className="text-sm font-medium">Unidade *</label>
                <div className="relative">
                  <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                  <select
                    id="evento-unidade"
                    value={unidadeId}
                    onChange={(e) => setUnidadeId(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  >
                    <option value="">Selecione a unidade</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 🔒 RESTRIÇÃO DE ACESSO */}
              <fieldset className="border rounded-xl p-4 mt-2 border-black/10 dark:border-white/10">
                <legend className="px-1 font-semibold flex items-center gap-2">
                  {restrito ? <Lock size={16} /> : <Unlock size={16} />} Visibilidade do evento
                  {restrito && restritoModo === "lista_registros" && regCount > 0 && (
                    <Badge title="Total de registros deste evento" ariaLabel={`Total de registros: ${regCount}`}>
                      {regCount}
                    </Badge>
                  )}
                </legend>

                <label className="inline-flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={restrito}
                    onChange={(e) => {
                      setRestrito(e.target.checked);
                      if (!e.target.checked) setRestritoModo("");
                      else if (!restritoModo) setRestritoModo("todos_servidores");
                    }}
                  />
                  <span>Evento restrito</span>
                </label>

                {restrito && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="restrito_modo"
                        value="todos_servidores"
                        checked={restritoModo === "todos_servidores"}
                        onChange={() => setRestritoModo("todos_servidores")}
                      />
                      <span>
                        Todos os servidores (somente quem possui <strong>registro</strong> cadastrado)
                      </span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="restrito_modo"
                        value="lista_registros"
                        checked={restritoModo === "lista_registros"}
                        onChange={() => setRestritoModo("lista_registros")}
                      />
                      <span className="inline-flex items-center">
                        Apenas a lista específica de registros
                        {regCount > 0 && (
                          <Badge title="Quantidade de registros na lista" ariaLabel={`Quantidade de registros na lista: ${regCount}`}>
                            {regCount}
                          </Badge>
                        )}
                      </span>
                    </label>

                    {restritoModo === "lista_registros" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={registroInput}
                            onChange={(e) => setRegistroInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); addRegistro(); }
                            }}
                            onPaste={(e) => {
                              const txt = e.clipboardData?.getData("text") || "";
                              if (!txt) return;
                              e.preventDefault();
                              addRegistrosBulk(txt);
                            }}
                            placeholder="Digite/cole registros (qualquer texto — extrairemos todos os blocos de 6 dígitos) e Enter"
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                            aria-describedby="ajuda-registros"
                          />
                          <button
                            type="button"
                            onClick={addRegistro}
                            className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                          >
                            Adicionar
                          </button>
                        </div>

                        {/* Wrapper fixo mantém o mesmo tipo de nó */}
                        <div className="mt-1">
                          {regCount > 0 ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <div id="ajuda-registros" className="text-xs text-slate-600 dark:text-slate-300">
                                  {regCount} registro(s) na lista
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setRegistros([])}
                                  className="text-xs underline text-red-700 dark:text-red-300"
                                  title="Limpar todos os registros"
                                >
                                  Limpar todos
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {registros.map((r) => (
                                  <span
                                    key={r}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
                                  >
                                    {r}
                                    <button
                                      type="button"
                                      className="ml-1 text-red-600 dark:text-red-400"
                                      title="Remover"
                                      onClick={() => removeRegistro(r)}
                                      aria-label={`Remover registro ${r}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p id="ajuda-registros" className="text-xs text-slate-600 dark:text-slate-300">
                              Pode colar CSV/planilha/texto — extraímos todas as sequências de 6 dígitos.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </fieldset>

              {/* TURMAS */}
              <div>
                <h3 className="text-sm sm:text-base font-semibold mt-4 flex items-center gap-2">
                  <Layers3 className="w-4 h-4" aria-hidden="true" /> Turmas Cadastradas
                </h3>

                {turmas.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Nenhuma turma cadastrada.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {turmas.map((t, i) => {
                      const qtd = Array.isArray(t.datas) ? t.datas.length : 0;
                      const di = qtd ? minDate(t.datas) : t.data_inicio;
                      const df = qtd ? maxDate(t.datas) : t.data_fim;
                      const first = qtd ? t.datas[0] : null;
                      const hi = first ? hh(first.horario_inicio) : hh(t.horario_inicio);
                      const hf = first ? hh(first.horario_fim) : hh(t.horario_fim);
                      return (
                        <div
                          key={t.id ?? `temp-${i}`}
                          className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 p-3 text-sm shadow-sm relative"
                        >
                          <button
                            type="button"
                            onClick={() => removerTurma(t, i)}
                            disabled={removendoId === t.id}
                            title="Remover turma"
                            className="absolute right-2 top-2 inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/40 px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                            {removendoId === t.id ? "Removendo..." : "Remover"}
                          </button>

                          <p className="font-bold pr-28">{t.nome}</p>

                          {/* Wrapper fixo para manter o mesmo tipo no slot */}
                          <div className="mt-1">
                            {qtd > 0 ? (
                              <div>
                                <p>
                                  📅 {qtd} encontro(s) • {formatarDataBrasileira(di)} a {formatarDataBrasileira(df)}
                                </p>
                                <ul className="mt-1 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                                  {t.datas.map((d, idx) => (
                                    <li key={`${t.id ?? i}-d-${idx}`}>
                                      {formatarDataBrasileira(d.data)} — {hh(d.horario_inicio)} às {hh(d.horario_fim)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              <p>
                                📅 {formatarDataBrasileira(t.data_inicio)} a {formatarDataBrasileira(t.data_fim)}
                              </p>
                            )}
                          </div>

                          {hi && hf && <p>🕒 {hi} às {hf}</p>}
                          <p>👥 {t.vagas_total} vagas • ⏱ {t.carga_horaria}h</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => setModalTurmaAberto(true)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                    aria-label="Adicionar nova turma"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Adicionar Turma
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* FOOTER */}
          <div className="p-4 border-t border-black/5 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-evento"
                disabled={salvando}
                className={`rounded-xl px-4 py-2 font-semibold text-white ${
                  salvando
                    ? "bg-emerald-900 cursor-not-allowed"
                    : "bg-emerald-700 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                }`}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </ModalBase>

      {/* ⬇️ Fora do ModalBase para não variar os children do modal */}
      <ModalTurma
        isOpen={modalTurmaAberto}
        onClose={() => setModalTurmaAberto(false)}
        onSalvar={(turma) => {
          const n = normalizarDatasTurma(turma);
          setTurmas((prev) => [
            ...prev,
            {
              ...turma,
              datas: n.datas,
              data_inicio: n.data_inicio,
              data_fim: n.data_fim,
              horario_inicio: n.horario_inicio,
              horario_fim: n.horario_fim,
              carga_horaria: Number(turma.carga_horaria) || 0,
              vagas_total: Number(turma.vagas_total) || 0,
            },
          ]);
          setModalTurmaAberto(false);
        }}
      />
    </>
  );
}
