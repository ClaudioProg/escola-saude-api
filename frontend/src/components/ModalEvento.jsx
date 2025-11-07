/* eslint-disable no-console */
// 📁 src/components/ModalEvento.jsx
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
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

const hh = (s) => (typeof s === "string" ? s.slice(0, 5) : "");
const minDate = (arr) => arr.map((d) => d.data).sort()[0];
const maxDate = (arr) => arr.map((d) => d.data).sort().slice(-1)[0];

function calcularCargaHorariaDatas(datas = []) {
  let total = 0;
  for (const d of datas) {
    const ini = hh(d.horario_inicio || "00:00");
    const fim = hh(d.horario_fim || "00:00");
    const [h1, m1] = ini.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    if (Number.isFinite(h1) && Number.isFinite(h2)) {
      const start = h1 * 60 + (Number.isFinite(m1) ? m1 : 0);
      const end = h2 * 60 + (Number.isFinite(m2) ? m2 : 0);
      const diff = Math.max(0, (end - start) / 60);
      total += diff >= 8 ? diff - 1 : diff; // pausa almoço
    }
  }
  return Math.round(total);
}

const normReg = (s) => String(s || "").replace(/\D/g, "");
const parseRegsBulk = (txt) => {
  const runs = String(txt || "").match(/\d+/g) || [];
  const out = [];
  for (const run of runs) {
    const clean = normReg(run);
    if (clean.length >= 6) {
      for (let i = 0; i + 6 <= clean.length; i++) {
        const slice = clean.slice(i, i + 6);
        if (/^\d{6}$/.test(slice)) out.push(slice);
      }
    }
  }
  return [...new Set(out)];
};

function encontrosParaDatas(turma) {
  const baseHi = hh(turma.horario_inicio || turma.hora_inicio || "08:00");
  const baseHf = hh(turma.horario_fim || turma.hora_fim || "17:00");

  if (Array.isArray(turma?.datas) && turma.datas.length) return turma.datas;

  const enc = Array.isArray(turma?.encontros) ? turma.encontros : [];
  return enc
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
}

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

  return {
    datas,
    data_inicio: datas[0]?.data || t.data_inicio,
    data_fim: datas.at(-1)?.data || t.data_fim,
    horario_inicio: datas[0]?.horario_inicio || hi,
    horario_fim: datas[0]?.horario_fim || hf,
  };
}

const getInstrutoresIds = (ev) => {
  const arr = Array.isArray(ev?.instrutores)
    ? ev.instrutores
    : Array.isArray(ev?.instrutor)
    ? ev.instrutor
    : [];
  return arr.map((i) => Number(i?.id ?? i)).filter((x) => Number.isFinite(x));
};

const extractIds = (arr) =>
  Array.isArray(arr)
    ? arr
        .map((v) => Number(v?.id ?? v))
        .filter((n) => Number.isFinite(n))
    : [];

    function normalizarCargo(v) {
      const s = String(v || "").trim();
      if (!s) return "";
      // Título: primeira letra maiúscula como você prefere
      return s
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, (m) => m.toUpperCase());
    }
    
    function extrairCargoUsuario(u) {
      if (!u) return "";
      // tenta várias chaves comuns
      const candidatosBrutos = [
        u.cargo,
        u.cargo_nome,
        u.funcao,
        u.funcao_nome,
        u.ocupacao,
        u.profissao,
        u.role,
        u.cargoSigla,
        u.cargo_sigla,
        u?.cargo?.nome,
        u?.cargo?.descricao,
      ];
    
      // se algum vier como array/obj, pega string interna
      const candidatos = candidatosBrutos.flatMap((c) => {
        if (!c) return [];
        if (Array.isArray(c)) return c.map((x) => String(x || ""));
        if (typeof c === "object") {
          return [String(c.nome || c.descricao || c.titulo || "")];
        }
        return [String(c)];
      });
    
      for (const c of candidatos) {
        const limpo = normalizarCargo(c);
        if (limpo) return limpo;
      }
      return "";
    }

/* ========================= Cache simples em memória ========================= */
let cacheUnidades = null;
let cacheUsuarios = null;

/* ========================= Componente ========================= */
export default function ModalEvento({
  isOpen,
  onClose,
  onSalvar,
  evento,
  onTurmaRemovida,
  salvando = false,
}) {
  // Campos do evento
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  // Dados auxiliares
  const [unidades, setUnidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  // Turmas
  const [turmas, setTurmas] = useState([]);
  const [editandoTurmaIndex, setEditandoTurmaIndex] = useState(null);
  const [modalTurmaAberto, setModalTurmaAberto] = useState(false);
  const [removendoId, setRemovendoId] = useState(null);

  // Restrição
  const [restrito, setRestrito] = useState(false);
  const [restritoModo, setRestritoModo] = useState("");
  const [registroInput, setRegistroInput] = useState("");
  const [registros, setRegistros] = useState([]);

  // Novos filtros de visibilidade
  const [cargosPermitidos, setCargosPermitidos] = useState([]);
  const [cargoAdd, setCargoAdd] = useState("");
  const [fallbackCargos, setFallbackCargos] = useState([]);

const [unidadesPermitidas, setUnidadesPermitidas] = useState([]);
  const [unidadeAddId, setUnidadeAddId] = useState("");

  // Uploads
  const [folderFile, setFolderFile] = useState(null); // png/jpg
  const [programacaoFile, setProgramacaoFile] = useState(null); // pdf
  const [folderPreview, setFolderPreview] = useState(null);

  // Controle de rehidratação e transição
  const prevEventoKeyRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  /* ========= Carregamento paralelo + cache ========= */
  useEffect(() => {
    let mounted = true;

    if (cacheUnidades) setUnidades(cacheUnidades);
    if (cacheUsuarios) setUsuarios(cacheUsuarios);

    if (cacheUnidades && cacheUsuarios) return;

    (async () => {
      const [uRes, usrRes] = await Promise.allSettled([
        apiGet("/api/unidades"),
        apiGet("/api/usuarios"),
      ]);
      if (!mounted) return;

      if (uRes.status === "fulfilled") {
        const arr = (Array.isArray(uRes.value) ? uRes.value : []).sort((a, b) =>
          String(a.nome || "").localeCompare(String(b.nome || ""))
        );
        setUnidades(arr);
        cacheUnidades = arr;
      }
      if (usrRes.status === "fulfilled") {
        const arr = Array.isArray(usrRes.value) ? usrRes.value : [];
        setUsuarios(arr);
        cacheUsuarios = arr;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ========= Reidratar ao abrir ou trocar id ========= */
  useEffect(() => {
    if (!isOpen) return;

    const curKey = evento?.id != null ? Number(evento.id) : "NEW";
    if (prevEventoKeyRef.current === curKey) return;

    startTransition(() => {
      if (!evento) {
        // novo
        setTitulo("");
        setDescricao("");
        setLocal("");
        setTipo("");
        setUnidadeId("");
        setPublicoAlvo("");
        setTurmas([]);
        setRestrito(false);
        setRestritoModo("");
        setRegistros([]);
        setCargosPermitidos([]);
        setUnidadesPermitidas([]);
        setFolderFile(null);
        setProgramacaoFile(null);
        setFolderPreview(null);
      } else {
        // existente
        setTitulo(evento.titulo || "");
        setDescricao(evento.descricao || "");
        setLocal(evento.local || "");
        setTipo(evento.tipo || "");
        setUnidadeId(evento.unidade_id ? String(evento.unidade_id) : "");
        setPublicoAlvo(evento.publico_alvo || "");

        /* ========= TURMAS — sempre buscar via rota leve ========= */
        (async () => {
          try {
            const resp = await apiGet(`/api/eventos/${evento.id}/turmas-simples`);
            const turmasBack = Array.isArray(resp) ? resp : [];

            const turmasNormalizadas = turmasBack.map((t) => {
              const n = normalizarDatasTurma(t);
              const cargaCalc = Number.isFinite(Number(t.carga_horaria))
                ? Number(t.carga_horaria)
                : calcularCargaHorariaDatas(n.datas);
              return {
                ...t,
                datas: n.datas,
                data_inicio: n.data_inicio,
                data_fim: n.data_fim,
                horario_inicio: n.horario_inicio,
                horario_fim: n.horario_fim,
                carga_horaria: Number.isFinite(cargaCalc) ? cargaCalc : 0,
                vagas_total: Number.isFinite(Number(t.vagas_total))
                  ? Number(t.vagas_total)
                  : 0,
              };
            });

            setTurmas(turmasNormalizadas);
          } catch (err) {
            console.warn("Falha ao carregar turmas-simples:", err);
            setTurmas(evento.turmas || []);
          }
        })();

        // restrição
        const restr = !!evento.restrito;
        setRestrito(restr);
        let modo = evento.restrito_modo;
        if (!modo && restr) {
          modo = evento.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        }
        setRestritoModo(restr ? (modo || "todos_servidores") : "");

        const lista =
          (Array.isArray(evento.registros_permitidos) ? evento.registros_permitidos : null) ??
          (Array.isArray(evento.registros) ? evento.registros : []);
        setRegistros(
          [...new Set((lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r)))]
        );

        // novos filtros
        setCargosPermitidos(
          Array.isArray(evento.cargos_permitidos)
            ? [...new Set(evento.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]
            : []
        );

        setUnidadesPermitidas(
          Array.isArray(evento.unidades_permitidas)
            ? extractIds(evento.unidades_permitidas)
            : []
        );

        // previews (se backend devolve urls, você pode exibir aqui; mantive local somente)
        setFolderFile(null);
        setProgramacaoFile(null);
        setFolderPreview(null);
      }
    });

    prevEventoKeyRef.current = curKey;
  }, [isOpen, evento]);

  /* ========= GET fresh da restrição, apenas quando necessário ========= */
  useEffect(() => {
    if (!isOpen || !evento?.id) return;
    if (registros.length > 0 && cargosPermitidos.length > 0 && unidadesPermitidas.length > 0) return;
    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);
        if (typeof det.restrito === "boolean") setRestrito(!!det.restrito);

        let modo = det.restrito_modo;
        if (!modo && det.restrito) {
          modo = det.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        }
        setRestritoModo(det.restrito ? (modo || "todos_servidores") : "");

        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];
        const parsed = (lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r));
        if (parsed.length && registros.length === 0) setRegistros([...new Set(parsed)]);

        if (Array.isArray(det.cargos_permitidos) && cargosPermitidos.length === 0) {
          setCargosPermitidos(
            [...new Set(det.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]
          );
        }
        if (Array.isArray(det.unidades_permitidas) && unidadesPermitidas.length === 0) {
          setUnidadesPermitidas(extractIds(det.unidades_permitidas));
        }
      } catch {
        // silencioso
      }
    })();
  }, [isOpen, evento?.id]); // estados checados dentro

    /* ========= Opções de instrutor (para exibir nomes nas turmas) ========= */
    const cargosSugestoes = useMemo(() => {
      const dosUsuarios = (usuarios || [])
        .map((u) => extrairCargoUsuario(u))
        .filter(Boolean);
    
      // junta extraídos dos usuários + fallback do backend
      const todos = [...dosUsuarios, ...fallbackCargos]
        .map(normalizarCargo)
        .filter(Boolean);
    
      const setUnicos = new Set(todos);
      const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
    
      return [...setUnicos]
        .filter((c) => !jaUsados.has(c.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
    }, [usuarios, fallbackCargos, cargosPermitidos]);
    

/* ========= Opções de instrutor (para exibir nomes nas turmas) ========= */
const opcoesInstrutor = useMemo(() => {
  return (usuarios || [])
    .filter((usuario) => {
      const perfil = (
        Array.isArray(usuario.perfil)
          ? usuario.perfil.join(",")
          : String(usuario.perfil || "")
      ).toLowerCase();
      return perfil.includes("instrutor") || perfil.includes("administrador");
    })
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
}, [usuarios]);


  const nomePorId = (id) => {
    const u = (usuarios || []).find((x) => Number(x.id) === Number(id));
    return u?.nome || String(id);
    };

  /* ================= Handlers de registros (restrição) ================= */
  const addRegistro = () => {
    const novos = parseRegsBulk(registroInput);
    if (!novos.length) return toast.info("Informe/cole ao menos uma sequência de 6 dígitos.");
    setRegistros((prev) => Array.from(new Set([...prev, ...novos])));
    setRegistroInput("");
  };
  const addRegistrosBulk = (txt) => {
    const novos = parseRegsBulk(txt);
    if (!novos.length) return toast.info("Nenhuma sequência de 6 dígitos encontrada.");
    setRegistros((prev) => Array.from(new Set([...prev, ...novos])));
    setRegistroInput("");
  };
  const removeRegistro = (r) => setRegistros((prev) => prev.filter((x) => x !== r));

  /* ================= Filtros: Cargos e Unidades ================= */
  const addCargo = () => {
    const v = String(cargoAdd || "").trim();
    if (!v) return;
    setCargosPermitidos(prev => {
      const exists = prev.some(x => x.toLowerCase() === v.toLowerCase());
      return exists ? prev : [...prev, v];
    });
    setCargoAdd("");
  };
  const removeCargo = (v) =>
    setCargosPermitidos((prev) => prev.filter((x) => x !== v));

  const addUnidade = () => {
    const id = Number(unidadeAddId);
    if (!Number.isFinite(id) || id <= 0) return;
    setUnidadesPermitidas((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUnidadeAddId("");
  };
  const removeUnidade = (id) =>
    setUnidadesPermitidas((prev) => prev.filter((x) => x !== id));

  /* ================= Uploads ================= */
  const onChangeFolder = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      toast.error("Envie uma imagem PNG ou JPG.");
      return;
    }
    setFolderFile(f);
    const reader = new FileReader();
    reader.onload = () => setFolderPreview(reader.result);
    reader.readAsDataURL(f);
  };
  const onChangeProgramacao = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Envie um PDF válido.");
      return;
    }
    setProgramacaoFile(f);
  };
  const limparFolder = () => {
    setFolderFile(null);
    setFolderPreview(null);
  };
  const limparProgramacao = () => setProgramacaoFile(null);

  /* ================= Turma: criar / editar / remover ================= */
  function abrirCriarTurma() {
    setEditandoTurmaIndex(null);
    setModalTurmaAberto(true);
  }
  function abrirEditarTurma(idx) {
    setEditandoTurmaIndex(idx);
    setModalTurmaAberto(true);
  }
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
    } finally {
      setRemovendoId(null);
    }
  }

  /* ================= Submit do formulário ================= */
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
      // valida assinante ∈ instrutores (se assinante existir)
      if (t.assinante_id != null) {
        const instrs = extractIds(t.instrutores || []);
        if (!instrs.includes(Number(t.assinante_id))) {
          toast.error(`O assinante da turma "${t.nome}" precisa estar entre os instrutores dessa turma.`);
          return;
        }
      }
    }
    if (restrito) {
      const modosValidos = ["todos_servidores", "lista_registros", "cargos", "unidades"];
      if (!modosValidos.includes(restritoModo)) {
        toast.error("Defina o modo de restrição do evento.");
        return;
      }
      if (restritoModo === "lista_registros" && registros.length === 0) {
        toast.error("Inclua pelo menos um registro (6 dígitos) para este evento.");
        return;
      }
      if (restritoModo === "cargos" && cargosPermitidos.length === 0) {
        toast.error("Inclua ao menos um cargo permitido.");
        return;
      }
      if (restritoModo === "unidades" && unidadesPermitidas.length === 0) {
        toast.error("Inclua ao menos uma unidade permitida.");
        return;
      }
    }

    const turmasCompletas = turmas.map((t) => {
      const n = normalizarDatasTurma(t);
      return {
        ...(Number.isFinite(Number(t.id)) ? { id: Number(t.id) } : {}),
        nome: t.nome,
        vagas_total: Number(t.vagas_total) || 0,
        carga_horaria: Number(t.carga_horaria) || 0,
        datas: (n.datas || []).map((d) => ({
          data: d.data,
          horario_inicio: d.horario_inicio,
          horario_fim: d.horario_fim,
        })),
        // novos campos por turma (se o ModalTurma já enviar, preservamos)
        ...(Array.isArray(t.instrutores) ? { instrutores: extractIds(t.instrutores) } : {}),
        ...(Number.isFinite(Number(t.assinante_id))
          ? { assinante_id: Number(t.assinante_id) }
          : {}),
      };
    });

    const regs6 = Array.from(new Set(registros.filter((r) => /^\d{6}$/.test(r))));

    const payload = {
      id: evento?.id,
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,
      turmas: turmasCompletas,
      restrito: !!restrito,
      restrito_modo: restrito ? restritoModo || "todos_servidores" : null,
      ...(restrito && restritoModo === "lista_registros" && regs6.length > 0
        ? { registros_permitidos: regs6 }
        : {}),
      ...(restrito && restritoModo === "cargos" && cargosPermitidos.length > 0
        ? { cargos_permitidos: cargosPermitidos }
        : {}),
      ...(restrito && restritoModo === "unidades" && unidadesPermitidas.length > 0
        ? { unidades_permitidas: unidadesPermitidas }
        : {}),
      // uploads seguem para o container pai salvar após o POST/PUT
      ...(folderFile ? { folderFile } : {}),
      ...(programacaoFile ? { programacaoFile } : {}),
    };

    onSalvar(payload);
  };

  const regCount =
    Array.isArray(registros) && registros.length > 0
      ? registros.length
      : Number(evento?.count_registros_permitidos ?? 0);

  /* ========================= Render Turmas (memo) ========================= */
  const turmasRender = useMemo(() => {
    return (turmas || []).map((t, i) => {
      const qtd = Array.isArray(t.datas) ? t.datas.length : 0;
      const di = qtd ? minDate(t.datas) : t.data_inicio;
      const df = qtd ? maxDate(t.datas) : t.data_fim;
      const first = qtd ? t.datas[0] : null;
      const hi = first ? hh(first.horario_inicio) : hh(t.horario_inicio);
      const hf = first ? hh(first.horario_fim) : hh(t.horario_fim);

      const instrs = extractIds(t.instrutores || []);
      const assinante = Number.isFinite(Number(t.assinante_id)) ? Number(t.assinante_id) : null;

      return (
        <div
          key={t.id ?? `temp-${i}`}
          className="rounded-xl border border-black/10 dark:border-white/10 bg-zinc-50/70 dark:bg-zinc-800/60 p-3 text-sm shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <p className="font-bold text-slate-900 dark:text-white break-words">
              {t.nome}
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => abrirEditarTurma(i)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-xs font-medium px-3 py-1.5 hover:bg-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200"
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
                Editar
              </button>

              <button
                type="button"
                onClick={() => removerTurma(t, i)}
                disabled={removendoId === t.id}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-100 text-rose-700 border border-rose-300 text-xs font-medium px-3 py-1.5 hover:bg-rose-200 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                {removendoId === t.id ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>

          <div className="mt-2 text-[13px] text-slate-700 dark:text-slate-200 space-y-1">
            <div className="flex flex-wrap gap-1 items-start">
              <CalendarDays size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
              <span className="font-medium">{qtd} encontro(s)</span>
              <span>•</span>
              <span>
                {formatarDataBrasileira(di)} a {formatarDataBrasileira(df)}
              </span>
            </div>

            {qtd > 0 && (
              <ul className="text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
                {t.datas.map((d, idx) => (
                  <li key={`${t.id ?? i}-d-${idx}`} className="break-words">
                    {formatarDataBrasileira(d.data)} — {hh(d.horario_inicio)} às {hh(d.horario_fim)}
                  </li>
                ))}
              </ul>
            )}

            {hi && hf && (
              <div className="flex flex-wrap gap-1 items-start">
                <Clock size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
                <span>
                  {hi} às {hf}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-start">
              <span className="flex items-start gap-1">
                <Users size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
                <span>{Number(t.vagas_total) || 0} vagas</span>
              </span>

              <span className="flex items-start gap-1">
                <Clock size={14} className="text-indigo-700 dark:text-indigo-300 mt-[2px]" />
                <span>{Number(t.carga_horaria) || 0}h</span>
              </span>
            </div>

            {/* Resumo instrutores/assinante */}
            <div className="flex flex-wrap gap-2 items-center pt-1">
              {instrs.length > 0 && (
                <div className="text-xs">
                  <span className="font-semibold">Instrutores: </span>
                  <span>
                    {instrs.map((id, idx) => (
                      <span key={id}>
                        {nomePorId(id)}
                        {idx < instrs.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              {Number.isFinite(assinante) && (
                <div className="text-xs">
                  <span className="font-semibold">Assinante: </span>
                  <span>{nomePorId(assinante)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }, [turmas, removendoId, usuarios]);

  useEffect(() => {
    (async () => {
      if (restritoModo !== "cargos") return;
      if ((cargosSugestoes || []).length > 0) return;
  
      try {
        const lista = await apiGet("/api/eventos/cargos/sugerir?limit=50");
        const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
        const norm = (Array.isArray(lista) ? lista : [])
          .map(normalizarCargo)
          .filter((s) => s && !jaUsados.has(s.toLowerCase()));
  
        setFallbackCargos(norm); // ← agora popula o fallback
      } catch {
        // silencioso
      }
    })();
  }, [restritoModo, cargosSugestoes, cargosPermitidos]);
  
  

  /* ========================= Render ========================= */
  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={() => onClose()}
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
                onClick={() => onClose()}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p id="modal-evento-desc" className="sr-only">
              Formulário para criação ou edição de evento, incluindo turmas e restrições de acesso.
            </p>
          </div>

          {/* BODY */}
          <div className="p-5 overflow-y-auto">
            {isPending ? (
              <p className="text-center text-sm text-slate-500">Carregando…</p>
            ) : (
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
                  <label htmlFor="evento-descricao" className="text-sm font-medium">
                    Descrição
                  </label>
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
                  <label htmlFor="evento-publico" className="text-sm font-medium">
                    Público-alvo
                  </label>
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

                {/* LOCAL */}
                <div className="grid gap-1">
                  <label htmlFor="evento-local" className="text-sm font-medium">
                    Local *
                  </label>
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
                  <label htmlFor="evento-tipo" className="text-sm font-medium">
                    Tipo *
                  </label>
                  <div className="relative">
                    <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <select
                      id="evento-tipo"
                      value={String(tipo ?? "")}
                      onChange={(e) => setTipo(String(e.target.value))}
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
                  <label htmlFor="evento-unidade" className="text-sm font-medium">
                    Unidade *
                  </label>
                  <div className="relative">
                    <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <select
                      id="evento-unidade"
                      value={String(unidadeId ?? "")}
                      onChange={(e) => setUnidadeId(String(e.target.value))}
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm"
                      required
                    >
                      <option value="">Selecione a unidade</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 🔒 RESTRIÇÃO */}
                <fieldset className="border rounded-xl p-4 mt-2 border-black/10 dark:border-white/10">
                  <legend className="px-1 font-semibold flex items-center gap-2">
                    {restrito ? <Lock size={16} /> : <Unlock size={16} />}{" "}
                    Visibilidade do evento
                    {restrito && restritoModo === "lista_registros" && regCount > 0 && (
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
                        const checked = e.target.checked;
                        setRestrito(checked);
                        if (!checked) setRestritoModo("");
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
                            <span className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                              {regCount}
                            </span>
                          )}
                        </span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="restrito_modo"
                          value="cargos"
                          checked={restritoModo === "cargos"}
                          onChange={() => setRestritoModo("cargos")}
                        />
                        <span>Restringir por cargos</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="restrito_modo"
                          value="unidades"
                          checked={restritoModo === "unidades"}
                          onChange={() => setRestritoModo("unidades")}
                        />
                        <span>Restringir por unidades</span>
                      </label>

                      {/* Sub-seções */}
                      {restritoModo === "lista_registros" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={registroInput}
                              onChange={(e) => setRegistroInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addRegistro();
                                }
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
                              <p
                                id="ajuda-registros"
                                className="text-xs text-slate-600 dark:text-slate-300"
                              >
                                Pode colar CSV/planilha/texto — extraímos todas as sequências de 6 dígitos.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

{restritoModo === "cargos" && (
  <div className="mt-2 space-y-2">
    <div className="flex gap-2">
      <select
        value={String(cargoAdd || "")}
        onChange={(e) => setCargoAdd(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
      >
        <option value="">Selecione o cargo</option>
        {cargosSugestoes.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={addCargo}
        className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
      >
        Adicionar
      </button>
    </div>

    <div className="flex flex-wrap gap-2">
      {cargosPermitidos.map((c) => (
        <span
          key={c}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
        >
          {c}
          <button
            type="button"
            className="ml-1 text-red-600 dark:text-red-400"
            title="Remover"
            onClick={() => removeCargo(c)}
            aria-label={`Remover cargo ${c}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>

    {cargosSugestoes.length === 0 && (
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Sem sugestões no momento.
      </p>
    )}
  </div>
)}
                      {restritoModo === "unidades" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={String(unidadeAddId || "")}
                              onChange={(e) => setUnidadeAddId(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900"
                            >
                              <option value="">Selecione a unidade</option>
                              {unidades
                                .filter((u) => !unidadesPermitidas.includes(Number(u.id)))
                                .map((u) => (
                                  <option key={u.id} value={String(u.id)}>
                                    {u.nome}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={addUnidade}
                              className="px-3 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                            >
                              Adicionar
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {unidadesPermitidas.map((id) => {
                              const u = unidades.find((x) => Number(x.id) === Number(id));
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 text-xs"
                                >
                                  {u?.nome || `Unidade ${id}`}
                                  <button
                                    type="button"
                                    className="ml-1 text-red-600 dark:text-red-400"
                                    title="Remover"
                                    onClick={() => removeUnidade(id)}
                                    aria-label={`Remover unidade ${id}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </fieldset>

                {/* UPLOADS */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Folder (PNG/JPG) */}
                  <div className="grid gap-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon size={16} /> Folder do evento (PNG/JPG)
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer">
                      <Paperclip size={16} />
                      <span className="text-sm">
                        {folderFile ? folderFile.name : "Selecionar imagem…"}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={onChangeFolder}
                      />
                    </label>
                    {folderPreview && (
                      <div className="mt-2">
                        <img
                          src={folderPreview}
                          alt="Pré-visualização do folder"
                          className="max-h-40 rounded-lg border border-black/10 dark:border-white/10"
                        />
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={limparFolder}
                            className="text-xs underline text-red-700 dark:text-red-300"
                          >
                            Remover imagem
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Programação (PDF) */}
                  <div className="grid gap-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileIcon size={16} /> Programação (PDF)
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer">
                      <Paperclip size={16} />
                      <span className="text-sm">
                        {programacaoFile ? programacaoFile.name : "Selecionar PDF…"}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={onChangeProgramacao}
                      />
                    </label>
                    {programacaoFile && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={limparProgramacao}
                          className="text-xs underline text-red-700 dark:text-red-300"
                        >
                          Remover PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TURMAS */}
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mt-4 flex items-center gap-2">
                    <Layers3 className="w-4 h-4" aria-hidden="true" /> Turmas Cadastradas
                  </h3>

                  {turmas.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Nenhuma turma cadastrada.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-3">{turmasRender}</div>
                  )}

                  <div className="flex justify-center mt-3">
                    <button
                      type="button"
                      onClick={abrirCriarTurma}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-teal-700 hover:bg-teal-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
                      aria-label="Adicionar nova turma"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Adicionar Turma
                    </button>
                  </div>
                </div>
              </form>
            )}
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

      {/* MODAL TURMA */}
      <ModalTurma
        isOpen={modalTurmaAberto}
        onClose={() => setModalTurmaAberto(false)}
        initialTurma={editandoTurmaIndex != null ? turmas[editandoTurmaIndex] : null}
        usuarios={opcoesInstrutor}        
        onSalvar={(turmaPayload) => {
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

          setTurmas((prev) => {
            if (editandoTurmaIndex != null) {
              const copia = [...prev];
              copia[editandoTurmaIndex] = turmaFinal;
              return copia;
            }
            return [...prev, turmaFinal];
          });

          setModalTurmaAberto(false);
          setEditandoTurmaIndex(null);
        }}
      />
    </>
  );
}
