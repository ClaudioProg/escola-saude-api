/* eslint-disable no-console */
// ✅ src/components/ModalEvento.jsx (Premium + A11y + Upload flags seguras + Logger sem spam)
import { useEffect, useMemo, useRef, useState, useTransition, useId, useCallback } from "react";
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
  ShieldCheck,
  Info,
} from "lucide-react";
import ModalBase from "./ModalBase";
import ModalTurma from "./ModalTurma";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet, apiDelete } from "../services/api";

/* ========================= Backend base ========================= */
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) || "";

function withBackendBase(u) {
  if (!u) return null;
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) {
    const base = String(API_BASE || "").replace(/\/+$/g, "");
    return base ? `${base}${s}` : s;
  }
  return null;
}

/* ========================= Logger (DEV only) ========================= */
const IS_DEV =
  (typeof import.meta !== "undefined" && import.meta?.env?.MODE !== "production") ||
  (typeof process !== "undefined" && process?.env?.NODE_ENV !== "production");

function makeLogger(scope = "ModalEvento") {
  const tag = `[${scope}]`;
  const log = (...a) => IS_DEV && console.log(tag, ...a);
  const info = (...a) => IS_DEV && console.info(tag, ...a);
  const warn = (...a) => IS_DEV && console.warn(tag, ...a);
  const error = (...a) => IS_DEV && console.error(tag, ...a);
  const group = (label) => IS_DEV && console.groupCollapsed(`${tag} ${label}`);
  const groupEnd = () => IS_DEV && console.groupEnd();
  const time = (label) => IS_DEV && console.time(`${tag} ${label}`);
  const timeEnd = (label) => IS_DEV && console.timeEnd(`${tag} ${label}`);
  return { log, info, warn, error, group, groupEnd, time, timeEnd };
}
const L = makeLogger("ModalEvento");

/* ========================= Constantes / Utils ========================= */
const TIPOS_EVENTO = ["Congresso", "Curso", "Oficina", "Palestra", "Seminário", "Simpósio", "Outros"];

const MAX_IMG_MB = 5;
const MAX_PDF_MB = 10;

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
    (Array.isArray(t.datas) && t.datas.length && t.datas) || encontrosParaDatas(t) || [];

  const datas = (datasRaw || [])
    .map((d) => {
      const data = (d?.data || d || "").slice(0, 10);
      const horario_inicio = hh(d?.horario_inicio || d?.inicio || hi);
      const horario_fim = hh(d?.horario_fim || d?.fim || hf);
      return data && horario_inicio && horario_fim ? { data, horario_inicio, horario_fim } : null;
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

const extractIds = (arr) =>
  Array.isArray(arr) ? arr.map((v) => Number(v?.id ?? v)).filter((n) => Number.isFinite(n)) : [];

function normalizarCargo(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function extrairCargoUsuario(u) {
  if (!u) return "";
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
  const candidatos = candidatosBrutos.flatMap((c) => {
    if (!c) return [];
    if (Array.isArray(c)) return c.map((x) => String(x || ""));
    if (typeof c === "object") return [String(c.nome || c.descricao || c.titulo || "")];
    return [String(c)];
  });

  for (const c of candidatos) {
    const limpo = normalizarCargo(c);
    if (limpo) return limpo;
  }
  return "";
}

/* ========================= Cache simples ========================= */
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
  const uid = useId();
  const titleId = `modal-evento-titulo-${uid}`;
  const descId = `modal-evento-desc-${uid}`;

  const dbgId = useRef(Math.random().toString(36).slice(2, 7)).current;
  const closeBlocked = salvando; // bloqueia fechar durante salvamento

  // ✅ logger de mount real
  useEffect(() => {
    L.info("MOUNT", { dbgId, eventoId: evento?.id ?? null });
    return () => L.info("UNMOUNT", { dbgId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Campos do evento
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState("");
  const [unidadeId, setUnidadeId] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  // Auxiliares
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

  // Filtros
  const [cargosPermitidos, setCargosPermitidos] = useState([]);
  const [cargoAdd, setCargoAdd] = useState("");
  const [fallbackCargos, setFallbackCargos] = useState([]);

  const [unidadesPermitidas, setUnidadesPermitidas] = useState([]);
  const [unidadeAddId, setUnidadeAddId] = useState("");

  // Uploads
  const [folderFile, setFolderFile] = useState(null);
  const [programacaoFile, setProgramacaoFile] = useState(null);
  const [folderPreview, setFolderPreview] = useState(null);

  // ✅ URLs existentes + flags de remoção (sem ambiguidade com "novo evento")
  const [folderUrlExistente, setFolderUrlExistente] = useState(undefined); // string | undefined
  const [programacaoUrlExistente, setProgramacaoUrlExistente] = useState(undefined);
  const [programacaoNomeExistente, setProgramacaoNomeExistente] = useState(undefined);

  const [removerFolderExistente, setRemoverFolderExistente] = useState(false);
  const [removerProgramacaoExistente, setRemoverProgramacaoExistente] = useState(false);

  // refs pra limpar input file
  const folderInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Controle
  const prevEventoKeyRef = useRef(null);
  const [isPending, startTransition] = useTransition();

  /* ========= Carregamento paralelo + cache ========= */
  useEffect(() => {
    let mounted = true;

    if (cacheUnidades) setUnidades(cacheUnidades);
    if (cacheUsuarios) setUsuarios(cacheUsuarios);
    if (cacheUnidades && cacheUsuarios) return () => {};

    (async () => {
      try {
        const [uRes, usrRes] = await Promise.allSettled([apiGet("/api/unidades"), apiGet("/api/usuarios")]);
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
      } catch (e) {
        L.warn("bootstrap error", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ========= Reidratar ao abrir/trocar id ========= */
  useEffect(() => {
    if (!isOpen) return;

    const curKey = evento?.id != null ? Number(evento.id) : "NEW";
    if (prevEventoKeyRef.current === curKey) return;

    startTransition(() => {
      // reset “sempre”
      setRegistroInput("");
      setCargoAdd("");
      setUnidadeAddId("");

      // uploads
      setFolderFile(null);
      setProgramacaoFile(null);
      setFolderPreview(null);
      setRemoverFolderExistente(false);
      setRemoverProgramacaoExistente(false);
      if (folderInputRef.current) folderInputRef.current.value = "";
      if (pdfInputRef.current) pdfInputRef.current.value = "";

      if (!evento) {
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

        // ✅ novo evento: sem “existentes”
        setFolderUrlExistente(undefined);
        setProgramacaoUrlExistente(undefined);
        setProgramacaoNomeExistente(undefined);
      } else {
        setTitulo(evento.titulo || "");
        setDescricao(evento.descricao || "");
        setLocal(evento.local || "");
        setTipo(evento.tipo || "");
        setUnidadeId(evento.unidade_id ? String(evento.unidade_id) : "");
        setPublicoAlvo(evento.publico_alvo || "");

        // existentes vindos do backend
        setFolderUrlExistente(evento.folder_url || evento.folder || undefined);
        setProgramacaoUrlExistente(evento.programacao_url || evento.programacao_pdf || undefined);
        setProgramacaoNomeExistente(evento.programacao_nome || undefined);

        // turmas (rota leve)
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
                vagas_total: Number.isFinite(Number(t.vagas_total)) ? Number(t.vagas_total) : 0,
              };
            });
            setTurmas(turmasNormalizadas);
          } catch (err) {
            L.warn("Falha ao carregar turmas-simples", err);
            setTurmas(evento.turmas || []);
          }
        })();

        // restrição
        const restr = !!evento.restrito;
        setRestrito(restr);

        let modo = evento.restrito_modo;
        if (!modo && restr) modo = evento.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        setRestritoModo(restr ? (modo || "todos_servidores") : "");

        const lista =
          (Array.isArray(evento.registros_permitidos) ? evento.registros_permitidos : null) ??
          (Array.isArray(evento.registros) ? evento.registros : []);
        const regs = [...new Set((lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r)))];
        setRegistros(regs);

        setCargosPermitidos(
          Array.isArray(evento.cargos_permitidos)
            ? [...new Set(evento.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]
            : []
        );

        setUnidadesPermitidas(Array.isArray(evento.unidades_permitidas) ? extractIds(evento.unidades_permitidas) : []);
      }
    });

    prevEventoKeyRef.current = curKey;
  }, [isOpen, evento]);

  /* ========= GET fresh detalhe (sob demanda) ========= */
  useEffect(() => {
    if (!isOpen || !evento?.id) return;
    if (registros.length > 0 && cargosPermitidos.length > 0 && unidadesPermitidas.length > 0) return;

    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);
        if (typeof det.restrito === "boolean") setRestrito(!!det.restrito);

        let modo = det.restrito_modo;
        if (!modo && det.restrito) modo = det.vis_reg_tipo === "lista" ? "lista_registros" : "todos_servidores";
        setRestritoModo(det.restrito ? (modo || "todos_servidores") : "");

        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];

        const parsed = (lista || []).map(normReg).filter((r) => /^\d{6}$/.test(r));
        if (parsed.length && registros.length === 0) setRegistros([...new Set(parsed)]);

        if (Array.isArray(det.cargos_permitidos) && cargosPermitidos.length === 0) {
          setCargosPermitidos([...new Set(det.cargos_permitidos.map((s) => String(s || "").trim()).filter(Boolean))]);
        }
        if (Array.isArray(det.unidades_permitidas) && unidadesPermitidas.length === 0) {
          setUnidadesPermitidas(extractIds(det.unidades_permitidas));
        }
      } catch (e) {
        // silencioso
      }
    })();
  }, [isOpen, evento?.id, registros.length, cargosPermitidos.length, unidadesPermitidas.length]);

  /* ========= Sugestões de cargos (on demand) ========= */
  useEffect(() => {
    (async () => {
      if (restritoModo !== "cargos") return;
      if ((fallbackCargos || []).length > 0) return;

      try {
        const lista = await apiGet("/api/eventos/cargos/sugerir?limit=50");
        const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
        const norm = (Array.isArray(lista) ? lista : [])
          .map(normalizarCargo)
          .filter((s) => s && !jaUsados.has(s.toLowerCase()));
        setFallbackCargos(norm);
      } catch {
        // silencioso
      }
    })();
  }, [restritoModo, fallbackCargos, cargosPermitidos]);

  /* ========= Opções (memo) ========= */
  const cargosSugestoes = useMemo(() => {
    const dosUsuarios = (usuarios || []).map((u) => extrairCargoUsuario(u)).filter(Boolean);
    const todos = [...dosUsuarios, ...fallbackCargos].map(normalizarCargo).filter(Boolean);
    const setUnicos = new Set(todos);
    const jaUsados = new Set(cargosPermitidos.map((c) => c.toLowerCase()));
    return [...setUnicos].filter((c) => !jaUsados.has(c.toLowerCase())).sort((a, b) => a.localeCompare(b));
  }, [usuarios, fallbackCargos, cargosPermitidos]);

  const opcoesInstrutor = useMemo(() => {
    return (usuarios || [])
      .filter((usuario) => {
        const perfil = (Array.isArray(usuario.perfil) ? usuario.perfil.join(",") : String(usuario.perfil || "")).toLowerCase();
        return perfil.includes("instrutor") || perfil.includes("administrador");
      })
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [usuarios]);

  const nomePorId = useCallback(
    (id) => {
      const u = (usuarios || []).find((x) => Number(x.id) === Number(id));
      return u?.nome || String(id);
    },
    [usuarios]
  );

  /* ================= Handlers de registros ================= */
  const addRegistro = () => {
    const novos = parseRegsBulk(registroInput);
    if (!novos.length) return toast.info("Informe/cole ao menos uma sequência de 6 dígitos.");
    setRegistros((prev) => Array.from(new Set([...(prev || []), ...novos])));
    setRegistroInput("");
  };

  const addRegistrosBulk = (txt) => {
    const novos = parseRegsBulk(txt);
    if (!novos.length) return toast.info("Nenhuma sequência de 6 dígitos encontrada.");
    setRegistros((prev) => Array.from(new Set([...(prev || []), ...novos])));
    setRegistroInput("");
  };

  const removeRegistro = (r) => setRegistros((prev) => prev.filter((x) => x !== r));

  /* ================= Filtros: Cargos e Unidades ================= */
  const addCargo = () => {
    const v = String(cargoAdd || "").trim();
    if (!v) return;
    setCargosPermitidos((prev) => (prev.some((x) => x.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
    setCargoAdd("");
  };
  const removeCargo = (v) => setCargosPermitidos((prev) => prev.filter((x) => x !== v));

  const addUnidade = () => {
    const id = Number(unidadeAddId);
    if (!Number.isFinite(id) || id <= 0) return;
    setUnidadesPermitidas((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUnidadeAddId("");
  };
  const removeUnidade = (id) => setUnidadesPermitidas((prev) => prev.filter((x) => x !== id));

  /* ================= Uploads ================= */
  const validaTamanho = (file, maxMb) => file.size / (1024 * 1024) <= maxMb;

  const onChangeFolder = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return toast.error("Envie uma imagem PNG ou JPG.");
    if (!validaTamanho(f, MAX_IMG_MB)) return toast.error(`Imagem muito grande. Máx. ${MAX_IMG_MB} MB.`);

    setFolderFile(f);
    setRemoverFolderExistente(false); // ✅ se selecionou novo, não remove “existente” sozinho
    const reader = new FileReader();
    reader.onload = () => setFolderPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const onChangeProgramacao = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") return toast.error("Envie um PDF válido.");
    if (!validaTamanho(f, MAX_PDF_MB)) return toast.error(`PDF muito grande. Máx. ${MAX_PDF_MB} MB.`);

    setProgramacaoFile(f);
    setRemoverProgramacaoExistente(false);
  };

  const limparFolder = () => {
    setFolderFile(null);
    setFolderPreview(null);
    if (folderInputRef.current) folderInputRef.current.value = "";
    // ✅ só marca remoção se houver existente
    if (folderUrlExistente) setRemoverFolderExistente(true);
  };

  const limparProgramacao = () => {
    setProgramacaoFile(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (programacaoUrlExistente) setRemoverProgramacaoExistente(true);
  };

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
        toast.error(`Não é possível excluir: ${c.presencas || 0} presenças / ${c.certificados || 0} certificados.`);
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
    if (salvando) return;

    // Validações de topo
    if (!titulo || !tipo || !unidadeId || !local) {
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

    // Validações por turma
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
      const assinanteId = Number(t.instrutor_assinante_id ?? t.assinante_id);
      if (Number.isFinite(assinanteId)) {
        const instrs = extractIds(t.instrutores || []);
        if (!instrs.includes(assinanteId)) {
          toast.error(`O assinante da turma "${t.nome}" precisa estar entre os instrutores dessa turma.`);
          return;
        }
      }
    }

    // Validações de restrição
    if (restrito) {
      const modosValidos = ["todos_servidores", "lista_registros", "cargos", "unidades"];
      if (!modosValidos.includes(restritoModo)) return toast.error("Defina o modo de restrição do evento.");
      if (restritoModo === "lista_registros" && registros.length === 0)
        return toast.error("Inclua pelo menos um registro (6 dígitos) para este evento.");
      if (restritoModo === "cargos" && cargosPermitidos.length === 0)
        return toast.error("Inclua ao menos um cargo permitido.");
      if (restritoModo === "unidades" && unidadesPermitidas.length === 0)
        return toast.error("Inclua ao menos uma unidade permitida.");
    }

    // Montagem turmas
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
        ...(Array.isArray(t.instrutores) ? { instrutores: extractIds(t.instrutores) } : {}),
        ...(Number.isFinite(Number(t.instrutor_assinante_id))
          ? { instrutor_assinante_id: Number(t.instrutor_assinante_id) }
          : Number.isFinite(Number(t.assinante_id))
          ? { instrutor_assinante_id: Number(t.assinante_id) }
          : {}),
      };
    });

    const regs6 = Array.from(new Set(registros.filter((r) => /^\d{6}$/.test(r))));

    const payloadJson = {
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
      ...(restrito && restritoModo === "lista_registros" && regs6.length > 0 ? { registros_permitidos: regs6 } : {}),
      ...(restrito && restritoModo === "cargos" && cargosPermitidos.length > 0 ? { cargos_permitidos: cargosPermitidos } : {}),
      ...(restrito && restritoModo === "unidades" && unidadesPermitidas.length > 0 ? { unidades_permitidas: unidadesPermitidas } : {}),
      ...(removerFolderExistente ? { remover_folder: true } : {}),
      ...(removerProgramacaoExistente ? { remover_programacao: true } : {}),
    };

    const payload = {
      ...payloadJson,
      folderFile: folderFile instanceof File ? folderFile : undefined,
      programacaoFile: programacaoFile instanceof File ? programacaoFile : undefined,
    };

    onSalvar(payload);
  };

  const regCount = registros.length;

  /* ========================= Render Turmas (memo) ========================= */
  const turmasRender = useMemo(() => {
    return (turmas || []).map((t, i) => {
      const baseDatas = Array.isArray(t.datas) && t.datas.length ? t.datas : encontrosParaDatas(t);
      const qtd = Array.isArray(baseDatas) ? baseDatas.length : 0;
      const di = qtd ? minDate(baseDatas) : t.data_inicio;
      const df = qtd ? maxDate(baseDatas) : t.data_fim;
      const first = qtd ? baseDatas[0] : null;
      const hi = first ? hh(first.horario_inicio) : hh(t.horario_inicio);
      const hf = first ? hh(first.horario_fim) : hh(t.horario_fim);

      const instrs = extractIds(t.instrutores || []);
      const assinante = Number(t.instrutor_assinante_id ?? t.assinante_id);

      return (
        <div
          key={t.id ?? `temp-${i}`}
          className="rounded-xl border border-black/10 dark:border-white/10 bg-gradient-to-b from-zinc-50/90 to-white dark:from-zinc-800/70 dark:to-zinc-900/50 p-3 text-sm shadow-sm hover:shadow transition-shadow"
        >
          <div className="h-1 rounded-t-md bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 mb-2" />

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <p className="font-bold text-slate-900 dark:text-white break-words leading-tight">{t.nome}</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => abrirEditarTurma(i)}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-medium px-3 py-1.5 hover:bg-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-200"
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
                {baseDatas.map((d, idx) => (
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
  }, [turmas, removendoId, nomePorId]);

  /* ========================= Render ========================= */
  return (
    <>
      <ModalBase
        isOpen={isOpen}
        onClose={closeBlocked ? undefined : onClose}
        level={0}
        maxWidth="max-w-3xl"
        labelledBy={titleId}
        describedBy={descId}
        closeOnBackdrop={!closeBlocked}
        closeOnEsc={!closeBlocked}
      >
        <div className="grid grid-rows-[auto,1fr,auto] max-h-[90vh] rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-black/5 dark:border-white/10 shadow-2xl">
          <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />

          {/* HEADER */}
          <div className="p-5 border-b border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-lg sm:text-xl font-extrabold tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                {evento?.id ? "Editar Evento" : "Novo Evento"}
              </h2>
              <button
                type="button"
                onClick={closeBlocked ? undefined : onClose}
                disabled={closeBlocked}
                className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p id={descId} className="sr-only">
              Formulário para criação ou edição de evento, incluindo turmas, anexos e restrições de acesso.
            </p>
          </div>

          {/* BODY */}
          <div className="p-5 overflow-y-auto">
            {isPending ? (
              <p className="text-center text-sm text-slate-500" role="status" aria-live="polite">
                Carregando…
              </p>
            ) : (
              <form id="form-evento" onSubmit={handleSubmit} className="space-y-4" aria-labelledby={titleId} noValidate>
                {/* TÍTULO */}
                <div className="grid gap-1">
                  <label htmlFor="evento-titulo" className="text-sm font-medium">
                    Título <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <input
                      id="evento-titulo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex.: Curso de Atualização em Urgência"
                      className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      className="w-full pl-10 pr-3 py-2 h-24 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* PÚBLICO-ALVO */}
                <div className="grid gap-1">
                  <label htmlFor="evento-publico" className="text-sm font-medium">Público-alvo</label>
                  <div className="relative">
                    <Info className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <input
                      id="evento-publico"
                      value={publicoAlvo}
                      onChange={(e) => setPublicoAlvo(e.target.value)}
                      placeholder="Ex.: Profissionais da APS, enfermeiros, médicos"
                      className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* LOCAL */}
                <div className="grid gap-1">
                  <label htmlFor="evento-local" className="text-sm font-medium">
                    Local <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <input
                      id="evento-local"
                      value={local}
                      onChange={(e) => setLocal(e.target.value)}
                      placeholder="Ex.: Auditório da Escola da Saúde"
                      className="w-full pl-10 pr-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                {/* TIPO */}
                <div className="grid gap-1">
                  <label htmlFor="evento-tipo" className="text-sm font-medium">
                    Tipo <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <select
                      id="evento-tipo"
                      value={String(tipo ?? "")}
                      onChange={(e) => setTipo(String(e.target.value))}
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  <label htmlFor="evento-unidade" className="text-sm font-medium">
                    Unidade <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Layers3 className="absolute left-3 top-2.5 text-slate-400" size={18} aria-hidden="true" />
                    <select
                      id="evento-unidade"
                      value={String(unidadeId ?? "")}
                      onChange={(e) => setUnidadeId(String(e.target.value))}
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    >
                      <option value="">Selecione a unidade</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={String(u.id)}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 🔒 RESTRIÇÃO */}
                <fieldset className="border rounded-xl p-4 mt-2 border-black/10 dark:border-white/10 bg-white/50 dark:bg-zinc-900/40">
                  <legend className="px-1 font-semibold flex items-center gap-2">
                    {restrito ? <Lock size={16} /> : <Unlock size={16} />} Visibilidade do evento
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
                          name={`restrito_modo_${uid}`}
                          value="todos_servidores"
                          checked={restritoModo === "todos_servidores"}
                          onChange={() => setRestritoModo("todos_servidores")}
                        />
                        <span>Todos os servidores (somente quem possui <strong>registro</strong> cadastrado)</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
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
                          name={`restrito_modo_${uid}`}
                          value="cargos"
                          checked={restritoModo === "cargos"}
                          onChange={() => setRestritoModo("cargos")}
                        />
                        <span>Restringir por cargos</span>
                      </label>

                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`restrito_modo_${uid}`}
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
                              placeholder="Cole registros (extraímos blocos de 6 dígitos) e Enter"
                              className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={addRegistro}
                              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                            >
                              Adicionar
                            </button>
                          </div>

                          <div className="mt-1 flex items-center justify-between">
                            <div className="text-xs text-slate-600 dark:text-slate-300">
                              {regCount} registro(s) na lista
                            </div>
                            {regCount > 0 && (
                              <button
                                type="button"
                                onClick={() => setRegistros([])}
                                className="text-xs underline text-red-700 dark:text-red-300"
                                title="Limpar todos os registros"
                              >
                                Limpar todos
                              </button>
                            )}
                          </div>

                          {regCount > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
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
                          )}
                        </div>
                      )}

                      {restritoModo === "cargos" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={String(cargoAdd || "")}
                              onChange={(e) => setCargoAdd(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Selecione o cargo</option>
                              {cargosSugestoes.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={addCargo}
                              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
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
                            <p className="text-xs text-slate-600 dark:text-slate-300">Sem sugestões no momento.</p>
                          )}
                        </div>
                      )}

                      {restritoModo === "unidades" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={String(unidadeAddId || "")}
                              onChange={(e) => setUnidadeAddId(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              <option value="">Selecione a unidade</option>
                              {unidades
                                .filter((u) => !unidadesPermitidas.includes(Number(u.id)))
                                .map((u) => (
                                  <option key={u.id} value={String(u.id)}>{u.nome}</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={addUnidade}
                              className="px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
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
                  {/* Folder */}
                  <div className="grid gap-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon size={16} /> Folder do evento (PNG/JPG)
                    </label>

                    {!folderFile && !!folderUrlExistente && !removerFolderExistente && (
                      <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                        <img
                          src={withBackendBase(folderUrlExistente)}
                          alt="Folder atual do evento"
                          className="max-h-40 rounded-md"
                        />
                        <div className="mt-2 flex items-center gap-3">
                          <a
                            href={withBackendBase(folderUrlExistente)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline text-emerald-700 dark:text-emerald-300"
                          >
                            Abrir imagem em nova aba
                          </a>
                          <button
                            type="button"
                            onClick={limparFolder}
                            className="text-xs underline text-red-700 dark:text-red-300"
                            title="Remover imagem existente"
                          >
                            Remover imagem
                          </button>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer hover:border-emerald-400/60 transition-colors">
                      <Paperclip size={16} />
                      <span className="text-sm">
                        {folderFile ? folderFile.name : `Selecionar imagem… (máx. ${MAX_IMG_MB}MB)`}
                      </span>
                      <input
                        ref={folderInputRef}
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={onChangeFolder}
                        aria-label="Selecionar folder do evento"
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

                    {removerFolderExistente && (
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        ✅ A imagem existente será removida ao salvar.
                      </p>
                    )}
                  </div>

                  {/* Programação */}
                  <div className="grid gap-1">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FileIcon size={16} /> Programação (PDF)
                    </label>

                    {!programacaoFile && !!programacaoUrlExistente && !removerProgramacaoExistente && (
                      <div className="rounded-lg border border-black/10 dark:border-white/10 p-2 flex items-center justify-between">
                        <a
                          href={withBackendBase(programacaoUrlExistente)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline text-emerald-700 dark:text-emerald-300"
                        >
                          {programacaoNomeExistente || "Baixar programação (PDF)"}
                        </a>
                        <button
                          type="button"
                          onClick={limparProgramacao}
                          className="text-xs underline text-red-700 dark:text-red-300"
                          title="Remover PDF existente"
                        >
                          Remover PDF
                        </button>
                      </div>
                    )}

                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 cursor-pointer hover:border-emerald-400/60 transition-colors">
                      <Paperclip size={16} />
                      <span className="text-sm">
                        {programacaoFile ? programacaoFile.name : `Selecionar PDF… (máx. ${MAX_PDF_MB}MB)`}
                      </span>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={onChangeProgramacao}
                        aria-label="Selecionar PDF de programação"
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

                    {removerProgramacaoExistente && (
                      <p className="text-xs text-rose-700 dark:text-rose-300">
                        ✅ O PDF existente será removido ao salvar.
                      </p>
                    )}
                  </div>
                </div>

                {/* TURMAS */}
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mt-4 flex items-center gap-2">
                    <Layers3 className="w-4 h-4" aria-hidden="true" /> Turmas Cadastradas
                  </h3>

                  {turmas.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Nenhuma turma cadastrada.</p>
                  ) : (
                    <div className="mt-2 space-y-3">{turmasRender}</div>
                  )}

                  <div className="flex justify-center mt-3">
                    <button
                      type="button"
                      onClick={abrirCriarTurma}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
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
                onClick={closeBlocked ? undefined : onClose}
                disabled={closeBlocked}
                className="rounded-xl px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
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
