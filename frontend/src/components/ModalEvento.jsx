/* eslint-disable no-console */
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
  Pencil,
  Users,
  Clock,
  CalendarDays,
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

// helpers de datas e horários
const minDate = (arr) => arr.map((d) => d.data).sort()[0];
const maxDate = (arr) => arr.map((d) => d.data).sort().slice(-1)[0];
const hh = (s) => (typeof s === "string" ? s.slice(0, 5) : "");

// 🔢 calcula carga horária estimada com base nas datas/horários
// mesma lógica do ModalTurma: soma horas de cada encontro;
// se um encontro >=8h, desconta 1h (almoço)
function calcularCargaHorariaDatas(datas = []) {
  let total = 0;

  for (const d of datas) {
    const ini = hh(d.horario_inicio || "00:00");
    const fim = hh(d.horario_fim || "00:00");

    const [h1, m1] = ini.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);

    if (
      Number.isFinite(h1) &&
      Number.isFinite(m1) &&
      Number.isFinite(h2) &&
      Number.isFinite(m2)
    ) {
      const startMin = h1 * 60 + m1;
      const endMin = h2 * 60 + m2;
      const diffH = Math.max(0, (endMin - startMin) / 60);

      total += diffH >= 8 ? diffH - 1 : diffH;
    }
  }

  return Math.round(total);
}

// normalização de registro (para restrição)
const normReg = (s) => String(s || "").replace(/\D/g, "");
const parseRegsBulk = (txt) => {
  const runs = String(txt || "").match(/\d+/g) || [];
  const out = [];
  for (const run of runs) {
    const clean = normReg(run);
    if (clean.length >= 6) {
      for (let i = 0; i + 6 <= clean.length; i++) {
        out.push(clean.slice(i, i + 6));
      }
    }
  }
  const final = Array.from(new Set(out.filter((r) => /^\d{6}$/.test(r))));
  console.log(
    "[parseRegsBulk] texto bruto:",
    txt,
    "→ registros extraídos:",
    final
  );
  return final;
};

// monta lista de encontros da turma
function encontrosParaDatas(turma) {
  const baseHi = hh(turma.horario_inicio || turma.hora_inicio || "08:00");
  const baseHf = hh(turma.horario_fim || turma.hora_fim || "17:00");
  const enc = Array.isArray(turma?.encontros) ? turma.encontros : [];

  const fromEnc = enc
    .map((e) => {
      if (typeof e === "string") {
        const data = e.slice(0, 10);
        return data
          ? { data, horario_inicio: baseHi, horario_fim: baseHf }
          : null;
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

  if (Array.isArray(turma?.datas) && turma.datas.length) {
    console.log(
      "[encontrosParaDatas] usando turma.datas direto:",
      turma.datas
    );
    return turma.datas;
  }

  console.log(
    "[encontrosParaDatas] derivado de encontros:",
    fromEnc,
    "para turma:",
    turma
  );
  return fromEnc;
}

// normaliza horários/datas de uma turma para garantir consistência no estado
function normalizarDatasTurma(t, hiBase = "08:00", hfBase = "17:00") {
  const hi = hh(t.horario_inicio || t.hora_inicio || hiBase);
  const hf = hh(t.horario_fim || t.hora_fim || hfBase);

  const datasRaw =
    (Array.isArray(t.datas) && t.datas.length && t.datas) ||
    encontrosParaDatas(t) ||
    [];

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

  const out = {
    datas,
    data_inicio: datas[0]?.data || t.data_inicio,
    data_fim: datas.at(-1)?.data || t.data_fim,
    horario_inicio: datas[0]?.horario_inicio || hi,
    horario_fim: datas[0]?.horario_fim || hf,
  };

  console.log("[normalizarDatasTurma] entrada:", t, "→ saída:", out);
  return out;
}

/* Aceita evento.instrutor (array de objetos/ids) ou evento.instrutores */
const getInstrutoresIds = (ev) => {
  const arr = Array.isArray(ev?.instrutores)
    ? ev.instrutores
    : Array.isArray(ev?.instrutor)
    ? ev.instrutor
    : [];
  const ids = arr
    .map((i) => Number(i?.id ?? i))
    .filter((x) => Number.isFinite(x));
  console.log("[getInstrutoresIds] evento:", ev, "→ ids:", ids);
  return ids;
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
  // ================= State =================
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  const [turmas, setTurmas] = useState([]);

  const [editandoTurmaIndex, setEditandoTurmaIndex] = useState(null);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);

  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [instrutorSelecionado, setInstrutorSelecionado] = useState([""]);

  const [removendoId, setRemovendoId] = useState(null);

  // 🔒 restrições
  const [restrito, setRestrito] = useState(false);
  const [restritoModo, setRestritoModo] = useState("");
  const [registroInput, setRegistroInput] = useState("");
  const [registros, setRegistros] = useState([]);

  // ================= Derivados =================
  const opcoesInstrutor = useMemo(() => {
    const filtrado = usuarios.filter((usuario) => {
      const perfil = (
        Array.isArray(usuario.perfil)
          ? usuario.perfil.join(",")
          : String(usuario.perfil || "")
      ).toLowerCase();
      return (
        perfil.includes("instrutor") || perfil.includes("administrador")
      );
    });

    console.log("[opcoesInstrutor] usuarios brutos:", usuarios);
    console.log("[opcoesInstrutor] filtrado p/ papel instrutor/admin:", filtrado);

    return filtrado;
  }, [usuarios]);

  function handleSelecionarInstrutor(index, valor) {
    console.log(
      "[handleSelecionarInstrutor] index:",
      index,
      "novo valor:",
      valor
    );
    const nova = [...instrutorSelecionado];
    nova[index] = valor;
    console.log(
      "[handleSelecionarInstrutor] estado antigo:",
      instrutorSelecionado,
      "→ novo estado:",
      nova
    );
    setInstrutorSelecionado(nova);
  }

  function adicionarInstrutor() {
    console.log("[adicionarInstrutor] anterior:", instrutorSelecionado);
    setInstrutorSelecionado((l) => {
      const novo = [...l, ""];
      console.log("[adicionarInstrutor] novo:", novo);
      return novo;
    });
  }

  function removerInstrutor(index) {
    console.log("[removerInstrutor] index:", index);
    const nova = instrutorSelecionado.filter((_, i) => i !== index);
    console.log(
      "[removerInstrutor] antes:",
      instrutorSelecionado,
      "depois:",
      nova
    );
    setInstrutorSelecionado(nova.length ? nova : [""]);
  }

  function getInstrutorDisponivel(index) {
    const result = opcoesInstrutor.filter(
      (i) =>
        !instrutorSelecionado.includes(String(i.id)) ||
        instrutorSelecionado[index] === String(i.id)
    );
    console.log(
      "[getInstrutorDisponivel] index:",
      index,
      "instrutorSelecionado:",
      instrutorSelecionado,
      "→ opções possíveis:",
      result
    );
    return result;
  }

  // ================= Effects =================
  // carrega dados iniciais do evento no formulário
  useEffect(() => {
    console.group("[ModalEvento useEffect evento/isOpen]");
    console.log("isOpen:", isOpen, "evento:", evento);

    if (evento) {
      console.log("➡️ Modo edição, populando estados com evento existente...");

      setTitulo(evento.titulo || "");
      setDescricao(evento.descricao || "");
      setLocal(evento.local || "");
      setTipo(evento.tipo || "");
      setUnidadeId(evento.unidade_id || "");
      setPublicoAlvo(evento.publico_alvo || "");

      // instrutores que já vieram no evento
      const instrutoresIds = getInstrutoresIds(evento).map(String).filter(Boolean);
      console.log("[init] instrutoresIds:", instrutoresIds);

      setInstrutorSelecionado(
        instrutoresIds.length ? instrutoresIds : [""]
      );

      // turmas vindas do backend normalizadas
      const turmasNormalizadas = (evento.turmas || []).map((t) => {
        const n = normalizarDatasTurma(t);

        // tenta usar carga_horaria vinda do backend
        let cargaCalc = Number.isFinite(Number(t.carga_horaria))
          ? Number(t.carga_horaria)
          : null;

        // se backend não mandou carga válida (ou mandou 0), recalcula
        if (cargaCalc == null || Number.isNaN(cargaCalc) || cargaCalc === 0) {
          cargaCalc = calcularCargaHorariaDatas(n.datas);
        }

        const out = {
          ...t,
          datas: n.datas,
          data_inicio: n.data_inicio,
          data_fim: n.data_fim,
          horario_inicio: n.horario_inicio,
          horario_fim: n.horario_fim,
          carga_horaria: cargaCalc || 0,
          vagas_total: Number.isFinite(Number(t.vagas_total))
            ? Number(t.vagas_total)
            : 0,
        };
        console.log("[init turmas] turma original:", t, "→ turmaNormalizada:", out);
        return out;
      });
      setTurmas(turmasNormalizadas);

      // restrição inicial
      const restr = !!evento.restrito;
      setRestrito(restr);

      // tenta pegar direto do backend
      let modo = evento.restrito_modo;

      // fallback legado (vis_reg_tipo) se vier vazio
      if (!modo && restr) {
        modo =
          evento.vis_reg_tipo === "lista"
            ? "lista_registros"
            : "todos_servidores";
      }

      // se não for restrito, não deixa modo poluído
      const modoFinal = restr ? (modo || "todos_servidores") : "";
      console.log(
        "[init restrição] restrito:",
        restr,
        "restrito_modo bruto:",
        evento.restrito_modo,
        "vis_reg_tipo:",
        evento.vis_reg_tipo,
        "→ modoFinal:",
        modoFinal
      );
      setRestritoModo(modoFinal);

      // registros permitidos
      const lista =
        (Array.isArray(evento.registros_permitidos)
          ? evento.registros_permitidos
          : null) ??
        (Array.isArray(evento.registros) ? evento.registros : []);

      const onlySix = (lista || [])
        .map(normReg)
        .filter((r) => /^\d{6}$/.test(r));

      const uniq = Array.from(new Set(onlySix));
      console.log("[init registros] lista bruta:", lista, "→ uniq:", uniq);

      setRegistros(uniq);
      setRegistroInput("");
    } else {
      console.log("➡️ Modo criação, limpando estados...");

      // reset se for "novo evento"
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

    console.groupEnd();
  }, [evento, isOpen]);

  // quando abre modal de edição, faz GET fresh do evento p/ garantir restrição
  useEffect(() => {
    if (!isOpen || !evento?.id) return;

    console.group("[ModalEvento useEffect GET fresh restrição]");
    console.log("Buscando detalhes fresh do evento id:", evento.id);

    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);
        console.log("✅ GET /api/eventos/:id resposta:", det);

        if (typeof det.restrito === "boolean") {
          console.log("Atualizando restrito ->", !!det.restrito);
          setRestrito(!!det.restrito);
        }

        let modo = det.restrito_modo;
        if (!modo && det.restrito) {
          modo =
            det.vis_reg_tipo === "lista"
              ? "lista_registros"
              : "todos_servidores";
        }
        console.log("Atualizando restrito_modo ->", modo);
        setRestritoModo(det.restrito ? (modo || "todos_servidores") : "");

        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];
        const parsed = (lista || [])
          .map(normReg)
          .filter((r) => /^\d{6}$/.test(r));
        console.log("Atualizando registros ->", parsed);
        setRegistros([...new Set(parsed)]);
      } catch (err) {
        console.warn(
          "⚠️ Falha ao atualizar restrição fresh do evento:",
          err?.message,
          err
        );
        // silencioso
      } finally {
        console.groupEnd();
      }
    })();
  }, [isOpen, evento?.id]);

  // carrega unidades
  useEffect(() => {
    console.group("[ModalEvento useEffect /api/unidades]");
    (async () => {
      try {
        console.log("➡️ GET /api/unidades ...");
        const data = await apiGet("/api/unidades");
        console.log("✅ /api/unidades resposta:", data);
        setUnidades(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Erro ao carregar unidades:", err);
        toast.error("Erro ao carregar unidades.");
      } finally {
        console.groupEnd();
      }
    })();
  }, []);

  // carrega usuários
  useEffect(() => {
    console.group("[ModalEvento useEffect /api/usuarios]");
    (async () => {
      try {
        console.log("➡️ GET /api/usuarios ...");
        const data = await apiGet("/api/usuarios");
        console.log("✅ /api/usuarios resposta:", data);
        setUsuarios(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Erro ao carregar usuários:", err);
        toast.error("Erro ao carregar usuários.");
      } finally {
        console.groupEnd();
      }
    })();
  }, []);

  // ================= Handlers de registros (restrição) =================
  const addRegistro = () => {
    console.group("[addRegistro]");
    console.log("registroInput atual:", registroInput);
    const novos = parseRegsBulk(registroInput);
    console.log("novos extraídos:", novos);

    if (!novos.length) {
      toast.info("Informe/cole ao menos uma sequência de 6 dígitos.");
      console.groupEnd();
      return;
    }
    setRegistros((prev) => {
      const merged = Array.from(new Set([...prev, ...novos]));
      console.log("registros antes:", prev, "depois:", merged);
      return merged;
    });
    setRegistroInput("");
    console.groupEnd();
  };

  const addRegistrosBulk = (txt) => {
    console.group("[addRegistrosBulk]");
    console.log("texto colado:", txt);
    const novos = parseRegsBulk(txt);
    console.log("novos extraídos:", novos);

    if (!novos.length) {
      toast.info("Nenhuma sequência de 6 dígitos encontrada.");
      console.groupEnd();
      return;
    }
    setRegistros((prev) => {
      const merged = Array.from(new Set([...prev, ...novos]));
      console.log("registros antes:", prev, "depois:", merged);
      return merged;
    });
    setRegistroInput("");
    console.groupEnd();
  };

  const removeRegistro = (r) => {
    console.log("[removeRegistro] removendo:", r);
    setRegistros((prev) => prev.filter((x) => x !== r));
  };

  // ================= Turma: criar / editar / remover =================
  function abrirCriarTurma() {
    console.log("[abrirCriarTurma] nova turma");
    setEditandoTurmaIndex(null);
    setModalTurmaAberto(true);
  }

  function abrirEditarTurma(idx) {
    console.log("[abrirEditarTurma] idx:", idx, "turma:", turmas[idx]);
    setEditandoTurmaIndex(idx);
    setModalTurmaAberto(true);
  }

  async function removerTurma(turma, idx) {
    console.group("[removerTurma]");
    console.log("tentando remover turma:", turma, "idx:", idx);

    const nome = turma?.nome || `Turma ${idx + 1}`;
    const ok = window.confirm(
      `Remover a turma "${nome}"?\n\nEsta ação não pode ser desfeita.\nSe houver presenças ou certificados, a exclusão será bloqueada.`
    );
    if (!ok) {
      console.log("remoção cancelada pelo usuário");
      console.groupEnd();
      return;
    }

    // turma ainda não salva (sem id) → só tira do estado
    if (!turma?.id) {
      console.log("turma sem id → remoção local apenas");
      setTurmas((prev) => prev.filter((_, i) => i !== idx));
      toast.info("Turma removida (rascunho).");
      console.groupEnd();
      return;
    }

    // turma existente → tenta DELETE backend
    try {
      console.log("➡️ DELETE /api/turmas/" + turma.id);
      setRemovendoId(turma.id);
      await apiDelete(`/api/turmas/${turma.id}`);
      console.log("✅ turma removida do backend");

      // se deu certo, tira do estado local tb
      setTurmas((prev) => prev.filter((t) => t.id !== turma.id));
      toast.success("Turma removida com sucesso.");
      onTurmaRemovida?.(turma.id);
    } catch (err) {
      console.error("❌ erro ao remover turma:", err);

      const code = err?.data?.erro;
      if (err?.status === 409 || code === "TURMA_COM_REGISTROS") {
        const c = err?.data?.contagens || {};
        toast.error(
          `Não é possível excluir: ${c.presencas || 0} presenças / ${
            c.certificados || 0
          } certificados.`
        );
      } else if (err?.status === 404) {
        toast.warn("Turma não encontrada. Atualize a página.");
      } else {
        toast.error("Erro ao remover turma.");
      }
    } finally {
      setRemovendoId(null);
      console.groupEnd();
    }
  }

  // ================= Submit do formulário =================
  const handleSubmit = (e) => {
    e.preventDefault();
    console.group("[handleSubmit Evento]");
    console.log("estado atual do form:", {
      titulo,
      descricao,
      local,
      tipo,
      unidadeId,
      publicoAlvo,
      instrutorSelecionado,
      turmas,
      restrito,
      restritoModo,
      registros,
    });

    // valida campos básicos
    if (!titulo || !tipo || !unidadeId) {
      toast.warning("⚠️ Preencha todos os campos obrigatórios.");
      console.warn("❌ Campos obrigatórios faltando (titulo/tipo/unidade)");
      console.groupEnd();
      return;
    }

    if (!TIPOS_EVENTO.includes(tipo)) {
      toast.error("❌ Tipo de evento inválido.");
      console.warn("❌ Tipo inválido:", tipo);
      console.groupEnd();
      return;
    }

    if (!turmas.length) {
      toast.warning("⚠️ Adicione pelo menos uma turma.");
      console.warn("❌ Nenhuma turma cadastrada.");
      console.groupEnd();
      return;
    }

    // valida cada turma
    for (const t of turmas) {
      if (
        !t.nome ||
        !Number(t.vagas_total) ||
        !Number.isFinite(Number(t.carga_horaria))
      ) {
        toast.error("❌ Preencha nome, vagas e carga horária de cada turma.");
        console.warn("❌ Turma inválida:", t);
        console.groupEnd();
        return;
      }
      if (!Array.isArray(t.datas) || t.datas.length === 0) {
        toast.error("❌ Cada turma precisa ter ao menos uma data.");
        console.warn("❌ Turma sem datas:", t);
        console.groupEnd();
        return;
      }
      for (const d of t.datas) {
        if (!d?.data || !d?.horario_inicio || !d?.horario_fim) {
          toast.error(
            "❌ Preencha data, início e fim em todos os encontros."
          );
          console.warn("❌ Encontro inválido dentro da turma:", t, d);
          console.groupEnd();
          return;
        }
      }
    }

    // valida restrição
    if (restrito) {
      if (!["todos_servidores", "lista_registros"].includes(restritoModo)) {
        toast.error("Defina o modo de restrição do evento.");
        console.warn("❌ restrito=true mas restritoModo inválido:", restritoModo);
        console.groupEnd();
        return;
      }
      if (restritoModo === "lista_registros" && registros.length === 0) {
        toast.error(
          "Inclua pelo menos um registro (6 dígitos) para este evento."
        );
        console.warn(
          "❌ restritoModo=lista_registros mas lista de registros está vazia"
        );
        console.groupEnd();
        return;
      }
    }

    // instrutores final (ids numéricos válidos)
    const instrutorValidado = instrutorSelecionado
      .map(Number)
      .filter((id) => !Number.isNaN(id));
    console.log("instrutorValidado:", instrutorValidado);

    // prepara turmas pra API
    const turmasCompletas = turmas.map((t) => {
      const n = normalizarDatasTurma(t);
      const datasPayload = (n.datas || []).map((d) => ({
        data: d.data,
        horario_inicio: d.horario_inicio,
        horario_fim: d.horario_fim,
      }));

      const out = {
        ...(Number.isFinite(Number(t.id)) ? { id: Number(t.id) } : {}),
        nome: t.nome,
        vagas_total: Number(t.vagas_total) || 0,
        carga_horaria: Number(t.carga_horaria) || 0,
        datas: datasPayload,
      };
      console.log("[turmasCompletas] turma final p/ payload:", out);
      return out;
    });

    // registros restritos (se usar lista_registros)
    const regs6 = Array.from(
      new Set(registros.filter((r) => /^\d{6}$/.test(r)))
    );
    console.log("regs6 finais:", regs6);

    // monta payload final
    const payload = {
      id: evento?.id,
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,

      instrutor: instrutorValidado,
      turmas: turmasCompletas,

      restrito: !!restrito,
      restrito_modo: restrito
        ? restritoModo || "todos_servidores"
        : null,

      ...(restrito &&
      restritoModo === "lista_registros" &&
      regs6.length > 0
        ? { registros_permitidos: regs6 }
        : {}),
    };

    console.log("🧾 [handleSubmit] payload final enviado pro onSalvar:", payload);
    console.groupEnd();

    onSalvar(payload);
  };

  // badge de quantidade de registros restritos
  const regCount =
    Array.isArray(registros) && registros.length > 0
      ? registros.length
      : Number(evento?.count_registros_permitidos ?? 0);

  /* ========================= Render ========================= */
  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={() => {
          console.log("[ModalEvento] Fechar modal evento");
          onClose();
        }}
        level={0}
        maxWidth="max-w-3xl"
        labelledBy="modal-evento-titulo"
        describedBy="modal-evento-desc"
      >
        <div className="grid grid-rows-[auto,1fr,auto] max-h-[90vh] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-xl">
          {/* HEADER */}
          <div className="p-5 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2
                id="modal-evento-titulo"
                className="text-lg sm:text-xl font-bold tracking-tight"
              >
                {evento?.id ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button
                onClick={() => {
                  console.log("[ModalEvento] clique no X fechar");
                  onClose();
                }}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p id="modal-evento-desc" className="sr-only">
              Formulário para criação ou edição de evento, incluindo turmas e
              restrições de acesso.
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
                <label htmlFor="evento-titulo" className="text-sm font-medium">
                  Título *
                </label>
                <div className="relative">
                  <FileText
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="evento-titulo"
                    value={titulo}
                    onChange={(e) => {
                      console.log("[input titulo] ->", e.target.value);
                      setTitulo(e.target.value);
                    }}
                    placeholder="Ex.: Curso de Atualização em Urgência"
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* DESCRIÇÃO */}
              <div className="grid gap-1">
                <label
                  htmlFor="evento-descricao"
                  className="text-sm font-medium"
                >
                  Descrição
                </label>
                <div className="relative">
                  <FileText
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <textarea
                    id="evento-descricao"
                    value={descricao}
                    onChange={(e) => {
                      console.log("[input descricao] ->", e.target.value);
                      setDescricao(e.target.value);
                    }}
                    placeholder="Contexto, objetivos e observações do evento."
                    className="w-full pl-10 pr-3 py-2 h-24 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                  />
                </div>
              </div>

              {/* PÚBLICO-ALVO */}
              <div className="grid gap-1">
                <label
                  htmlFor="evento-publico"
                  className="text-sm font-medium"
                >
                  Público-alvo
                </label>
                <div className="relative">
                  <FileText
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="evento-publico"
                    value={publicoAlvo}
                    onChange={(e) => {
                      console.log("[input publicoAlvo] ->", e.target.value);
                      setPublicoAlvo(e.target.value);
                    }}
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
                        onChange={(e) =>
                          handleSelecionarInstrutor(index, e.target.value)
                        }
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                        required={index === 0}
                        aria-label={
                          index === 0
                            ? "Instrutor principal"
                            : `Instrutor adicional ${index}`
                        }
                      >
                        <option value="">Selecione o instrutor</option>
                        {getInstrutorDisponivel(index).map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.nome}
                          </option>
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
                <label htmlFor="evento-local" className="text-sm font-medium">
                  Local *
                </label>
                <div className="relative">
                  <MapPin
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <input
                    id="evento-local"
                    value={local}
                    onChange={(e) => {
                      console.log("[input local] ->", e.target.value);
                      setLocal(e.target.value);
                    }}
                    placeholder="Ex.: Auditório da Escola da Saúde"
                    className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  />
                </div>
              </div>

              {/* TIPO */}
              <div className="grid gap-1">
                <label htmlFor="evento-tipo" className="text-sm font-medium">
                  Tipo *
                </label>
                <div className="relative">
                  <Layers3
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <select
                    id="evento-tipo"
                    value={tipo}
                    onChange={(e) => {
                      console.log("[input tipo] ->", e.target.value);
                      setTipo(e.target.value);
                    }}
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    {TIPOS_EVENTO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* UNIDADE */}
              <div className="grid gap-1">
                <label
                  htmlFor="evento-unidade"
                  className="text-sm font-medium"
                >
                  Unidade *
                </label>
                <div className="relative">
                  <Layers3
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={18}
                    aria-hidden="true"
                  />
                  <select
                    id="evento-unidade"
                    value={unidadeId}
                    onChange={(e) => {
                      console.log("[input unidadeId] ->", e.target.value);
                      setUnidadeId(e.target.value);
                    }}
                    className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                    required
                  >
                    <option value="">Selecione a unidade</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 🔒 RESTRIÇÃO DE ACESSO */}
              <fieldset className="border rounded-xl p-4 mt-2 border-black/10 dark:border-white/10">
                <legend className="px-1 font-semibold flex items-center gap-2">
                  {restrito ? <Lock size={16} /> : <Unlock size={16} />}{" "}
                  Visibilidade do evento
                  {restrito &&
                    restritoModo === "lista_registros" &&
                    regCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {regCount}
                      </span>
                    )}
                </legend>

                <label className="inline-flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={restrito}
                    onChange={(e) => {
                      console.log("[restrito checkbox] ->", e.target.checked);
                      setRestrito(e.target.checked);
                      if (!e.target.checked) {
                        setRestritoModo("");
                      } else if (!restritoModo) {
                        setRestritoModo("todos_servidores");
                      }
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
                        onChange={() => {
                          console.log(
                            "[restrito_modo radio] -> todos_servidores"
                          );
                          setRestritoModo("todos_servidores");
                        }}
                      />
                      <span>
                        Todos os servidores (somente quem possui{" "}
                        <strong>registro</strong> cadastrado)
                      </span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="restrito_modo"
                        value="lista_registros"
                        checked={restritoModo === "lista_registros"}
                        onChange={() => {
                          console.log(
                            "[restrito_modo radio] -> lista_registros"
                          );
                          setRestritoModo("lista_registros");
                        }}
                      />
                      <span className="inline-flex items-center">
                        Apenas a lista específica de registros
                        {regCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {regCount}
                          </span>
                        )}
                      </span>
                    </label>

                    {restritoModo === "lista_registros" && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={registroInput}
                            onChange={(e) => {
                              console.log(
                                "[registroInput onChange] ->",
                                e.target.value
                              );
                              setRegistroInput(e.target.value);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addRegistro();
                              }
                            }}
                            onPaste={(e) => {
                              const txt =
                                e.clipboardData?.getData("text") || "";
                              console.log("[registroInput onPaste] txt:", txt);
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

                        <div className="mt-1">
                          {regCount > 0 ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <div
                                  id="ajuda-registros"
                                  className="text-xs text-slate-600 dark:text-slate-300"
                                >
                                  {regCount} registro(s) na lista
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    console.log(
                                      "[Limpar todos registros clicado]"
                                    );
                                    setRegistros([]);
                                  }}
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
                            <p
                              id="ajuda-registros"
                              className="text-xs text-slate-600 dark:text-slate-300"
                            >
                              Pode colar CSV/planilha/texto — extraímos todas as
                              sequências de 6 dígitos.
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
                  <Layers3 className="w-4 h-4" aria-hidden="true" /> Turmas
                  Cadastradas
                </h3>

                {turmas.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Nenhuma turma cadastrada.
                  </p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {turmas.map((t, i) => {
                      const qtd = Array.isArray(t.datas) ? t.datas.length : 0;
                      const di = qtd ? minDate(t.datas) : t.data_inicio;
                      const df = qtd ? maxDate(t.datas) : t.data_fim;
                      const first = qtd ? t.datas[0] : null;
                      const hi = first
                        ? hh(first.horario_inicio)
                        : hh(t.horario_inicio);
                      const hf = first
                        ? hh(first.horario_fim)
                        : hh(t.horario_fim);

                      return (
                        <div
                          key={t.id ?? `temp-${i}`}
                          className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 p-3 text-sm shadow-sm"
                        >
                          {/* header da turma com ações */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <p className="font-bold text-slate-900 dark:text-white break-words">
                              {t.nome}
                            </p>

                            {/* ações da turma */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  console.log(
                                    "[Editar turma clicado] idx:",
                                    i,
                                    "turma:",
                                    t
                                  );
                                  abrirEditarTurma(i);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium px-3 py-1.5 hover:bg-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200"
                              >
                                <Pencil
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  console.log(
                                    "[Remover turma clicado] idx:",
                                    i,
                                    "turma:",
                                    t
                                  );
                                  removerTurma(t, i);
                                }}
                                disabled={removendoId === t.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 text-xs font-medium px-3 py-1.5 hover:bg-rose-200 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Trash2
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                {removendoId === t.id
                                  ? "Removendo..."
                                  : "Remover"}
                              </button>
                            </div>
                          </div>

                          {/* conteúdo da turma */}
                          <div className="mt-2 text-[13px] text-slate-700 dark:text-slate-200 space-y-1">
                            {/* período + num. encontros */}
                            <div className="flex flex-wrap gap-1 items-start">
                              <CalendarDays
                                size={14}
                                className="text-indigo-700 dark:text-indigo-300 mt-[2px]"
                              />
                              <span className="font-medium">
                                {qtd} encontro(s)
                              </span>
                              <span>•</span>
                              <span>
                                {formatarDataBrasileira(di)} a{" "}
                                {formatarDataBrasileira(df)}
                              </span>
                            </div>

                            {/* lista de encontros */}
                            {qtd > 0 && (
                              <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                                {t.datas.map((d, idx) => (
                                  <li
                                    key={`${t.id ?? i}-d-${idx}`}
                                    className="break-words"
                                  >
                                    {formatarDataBrasileira(d.data)} —{" "}
                                    {hh(d.horario_inicio)} às{" "}
                                    {hh(d.horario_fim)}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* horário típico */}
                            {hi && hf && (
                              <div className="flex flex-wrap gap-1 items-start">
                                <Clock
                                  size={14}
                                  className="text-indigo-700 dark:text-indigo-300 mt-[2px]"
                                />
                                <span>
                                  {hi} às {hf}
                                </span>
                              </div>
                            )}

                            {/* vagas / carga horária */}
                            <div className="flex flex-wrap gap-3 items-start">
                              <span className="flex items-start gap-1">
                                <Users
                                  size={14}
                                  className="text-indigo-700 dark:text-indigo-300 mt-[2px]"
                                />
                                <span>
                                  {Number(t.vagas_total) || 0} vagas
                                </span>
                              </span>

                              <span className="flex items-start gap-1">
                                <Clock
                                  size={14}
                                  className="text-indigo-700 dark:text-indigo-300 mt-[2px]"
                                />
                                <span>
                                  {Number(t.carga_horaria) || 0}h
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log("[Adicionar Turma clicado]");
                      abrirCriarTurma();
                    }}
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
                onClick={() => {
                  console.log("[ModalEvento] Botão Cancelar clicado");
                  onClose();
                }}
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

      {/* MODAL TURMA */}
      <ModalTurma
        isOpen={modalTurmaAberto}
        onClose={() => {
          console.log("[ModalTurma child] fechar chamado");
          setModalTurmaAberto(false);
        }}
        initialTurma={
          editandoTurmaIndex != null ? turmas[editandoTurmaIndex] : null
        }
        onSalvar={(turmaPayload) => {
          // turmaPayload: { id?, nome, vagas_total, carga_horaria, datas... }
          console.group("[ModalTurma onSalvar]");
          console.log("turmaPayload recebido:", turmaPayload);

          const normalizada = normalizarDatasTurma(turmaPayload);
          const turmaFinal = {
            ...turmaPayload,
            datas: normalizada.datas,
            data_inicio: normalizada.data_inicio,
            data_fim: normalizada.data_fim,
            horario_inicio: normalizada.horario_inicio,
            horario_fim: normalizada.horario_fim,
            vagas_total: Number(turmaPayload.vagas_total) || 0,
            carga_horaria: Number(turmaPayload.carga_horaria) || 0,
          };

          console.log("turmaFinal normalizada:", turmaFinal);

          setTurmas((prev) => {
            if (editandoTurmaIndex != null) {
              // edição de turma existente no array
              const copia = [...prev];
              copia[editandoTurmaIndex] = turmaFinal;
              console.log(
                "Turma editada. Estado turmas antes:",
                prev,
                "depois:",
                copia
              );
              return copia;
            }
            // criação de nova turma
            const novo = [...prev, turmaFinal];
            console.log(
              "Turma nova. Estado turmas antes:",
              prev,
              "depois:",
              novo
            );
            return novo;
          });

          setModalTurmaAberto(false);
          setEditandoTurmaIndex(null);
          console.groupEnd();
        }}
      />
    </>
  );
}
