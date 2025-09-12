import { useEffect, useState } from "react";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { MapPin, FileText, Layers3, PlusCircle, Trash2, Lock, Unlock } from "lucide-react";
import ModalTurma from "./ModalTurma";
import { formatarDataBrasileira } from "../utils/data";
import { apiGet, apiDelete } from "../services/api";

/* utils locais */
const minDate = (arr) => arr.map((d) => d.data).sort()[0];
const maxDate = (arr) => arr.map((d) => d.data).sort().slice(-1)[0];
const hh = (s) => (typeof s === "string" ? s.slice(0, 5) : "");

// normaliza um registro: só dígitos
const normReg = (s) => String(s || "").replace(/\D/g, "");
// parseia entrada solta/colada (csv, linhas, etc.) em uma lista de registros normalizados
const parseRegsBulk = (txt) => {
  const tokens = String(txt || "")
    .split(/[\s,;|\n\r\t]+/)
    .map(normReg)
    .filter(Boolean);
  return Array.from(new Set(tokens));
};

// badge simples
const Badge = ({ children, title }) => (
  <span
    title={title}
    className="ml-2 inline-flex items-center justify-center text-[11px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700"
  >
    {children}
  </span>
);

export default function ModalEvento({ isOpen, onClose, onSalvar, evento, onTurmaRemovida }) {
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

  // 🔒 restrição
  const [restrito, setRestrito] = useState(false);
  const [restritoModo, setRestritoModo] = useState(""); // 'todos_servidores' | 'lista_registros'
  const [registroInput, setRegistroInput] = useState("");
  const [registros, setRegistros] = useState([]); // strings (só dígitos)

  // opções de instrutor
  const opcoesInstrutor = usuarios.filter((usuario) => {
    const perfil = (Array.isArray(usuario.perfil) ? usuario.perfil.join(",") : String(usuario.perfil || "")).toLowerCase();
    return perfil.includes("instrutor") || perfil.includes("administrador");
  });

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
      (i) => !instrutorSelecionado.includes(String(i.id)) || instrutorSelecionado[index] === String(i.id)
    );
  }

  // Converte encontros vindos do backend para o formato "datas" esperado pelo modal
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

    // Se já veio "datas", mantém.
    if (Array.isArray(turma?.datas) && turma.datas.length) return turma.datas;

    return fromEnc;
  }

  // Preenche dados ao abrir/editar (objeto base)
  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo || "");
      setDescricao(evento.descricao || "");
      setLocal(evento.local || "");
      setTipo(evento.tipo || "");
      setUnidadeId(evento.unidade_id || "");
      setPublicoAlvo(evento.publico_alvo || "");
      setInstrutorSelecionado(Array.isArray(evento.instrutor) ? evento.instrutor.map((i) => String(i.id)) : []);

      setTurmas(
        (evento.turmas || []).map((t) => {
          const datas = encontrosParaDatas(t);
          return {
            ...t,
            datas,
            horario_inicio: t.horario_inicio || t.hora_inicio || (datas[0]?.horario_inicio || ""),
            horario_fim: t.horario_fim || t.hora_fim || (datas[0]?.horario_fim || ""),
            carga_horaria: t.carga_horaria ?? 0,
          };
        })
      );

      const restr = !!evento.restrito;
      setRestrito(restr);
      const modo = evento.restrito_modo || (restr ? "todos_servidores" : "");
      setRestritoModo(modo);

      const lista =
        (Array.isArray(evento.registros_permitidos) ? evento.registros_permitidos : null) ??
        (Array.isArray(evento.registros) ? evento.registros : []);
      setRegistros(Array.from(new Set((lista || []).map(normReg).filter(Boolean))));
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

  // ✅ Ao editar, busca o DETALHE para garantir a lista e contar
  useEffect(() => {
    if (!isOpen || !evento?.id) return;
    (async () => {
      try {
        const det = await apiGet(`/api/eventos/${evento.id}`);
        if (typeof det.restrito === "boolean") setRestrito(!!det.restrito);
        if (det.restrito_modo) setRestritoModo(det.restrito_modo);
        const lista = Array.isArray(det.registros_permitidos)
          ? det.registros_permitidos
          : Array.isArray(det.registros)
          ? det.registros
          : [];
        setRegistros([...new Set(lista.map(normReg).filter(Boolean))]);
      } catch {
        // silencioso: mantém o que veio do objeto base
      }
    })();
  }, [isOpen, evento?.id]);

  // Carrega unidades
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

  // Carrega usuários
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

  const addRegistro = () => {
    const r = normReg(registroInput);
    if (!r) return;
    setRegistros((prev) => (prev.includes(r) ? prev : [...prev, r]));
    setRegistroInput("");
  };
  const addRegistrosBulk = (txt) => {
    const novos = parseRegsBulk(txt);
    if (!novos.length) return;
    setRegistros((prev) => Array.from(new Set([...prev, ...novos])));
    setRegistroInput("");
  };
  const removeRegistro = (r) => setRegistros((prev) => prev.filter((x) => x !== r));

  const handleSubmit = (e) => {
    e.preventDefault();

    const tiposValidos = ["Congresso", "Curso", "Oficina", "Palestra", "Seminário", "Simpósio", "Outros"];
    if (!titulo || !tipo || !unidadeId) {
      toast.warning("⚠️ Preencha todos os campos obrigatórios.");
      return;
    }
    if (!tiposValidos.includes(tipo)) {
      toast.error("❌ Tipo de evento inválido.");
      return;
    }
    if (!turmas.length) {
      toast.warning("⚠️ Adicione pelo menos uma turma.");
      return;
    }

    // validação de turmas + datas
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

    // 🔒 validação de restrição
    if (restrito) {
      if (!["todos_servidores", "lista_registros"].includes(restritoModo)) {
        toast.error("Defina o modo de restrição do evento.");
        return;
      }
      if (restritoModo === "lista_registros" && registros.length === 0) {
        toast.error("Inclua pelo menos um registro autorizado para este evento.");
        return;
      }
    }

    const instrutorValidado = instrutorSelecionado.map(Number).filter((id) => !Number.isNaN(id));

    // monta turmas para o payload
    const turmasCompletas = turmas.map((t) => {
      const qtd = Array.isArray(t.datas) ? t.datas.length : 0;
      const di = qtd ? minDate(t.datas) : t.data_inicio;
      const df = qtd ? maxDate(t.datas) : t.data_fim;
      const first = qtd ? t.datas[0] : {};
      return {
        nome: t.nome,
        data_inicio: di,
        data_fim: df,
        horario_inicio: hh(first.horario_inicio || t.horario_inicio),
        horario_fim: hh(first.horario_fim || t.horario_fim),
        vagas_total: Number(t.vagas_total),
        carga_horaria: Number(t.carga_horaria),
        encontros: t.datas.map((d) => ({
          data: d.data,
          inicio: hh(d.horario_inicio),
          fim: hh(d.horario_fim),
        })),
      };
    });

    const turmaPrincipal = turmasCompletas[0] || {};
    const payload = {
      titulo,
      descricao,
      local,
      tipo,
      unidade_id: Number(unidadeId),
      publico_alvo: publicoAlvo,
      instrutor: instrutorValidado,
      turmas: turmasCompletas,

      // “espelho”
      data_inicio: turmaPrincipal.data_inicio,
      data_fim: turmaPrincipal.data_fim,
      hora_inicio: turmaPrincipal.horario_inicio,
      hora_fim: turmaPrincipal.horario_fim,
      vagas_total: Number(turmaPrincipal.vagas_total),
      carga_horaria: Number(turmaPrincipal.carga_horaria),

      ...(evento?.id ? { id: evento.id } : {}),

      // 🔒 restrição
      restrito: !!restrito,
      ...(restrito
        ? {
            restrito_modo: restritoModo,
            ...(restritoModo === "lista_registros" ? { registros_permitidos: registros } : {}),
          }
        : {}),
    };

    onSalvar(payload);
    onClose();
  };

  const abrirModalTurma = () => setModalTurmaAberto(true);

  // 🔥 Remover turma
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
      console.error("[removerTurma(modal)]", err);
    } finally {
      setRemovendoId(null);
    }
  }

  // 🔢 contador para o badge (usa estado se houver; senão, o count do backend)
  const regCount =
    Array.isArray(registros) && registros.length > 0
      ? registros.length
      : Number(evento?.count_registros_permitidos ?? 0);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      shouldCloseOnOverlayClick={false}
      ariaHideApp={false}
      className="modal"
      overlayClassName="overlay"
    >
      <div className="flex flex-col max-h-[90vh]">
        <form
          id="form-evento"
          onSubmit={handleSubmit}
          className="overflow-y-auto pr-2 space-y-4"
          style={{ maxHeight: "calc(90vh - 64px)" }}
        >
          {/* TÍTULO */}
          <div className="relative">
            <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
              className="w-full pl-10 py-2 border rounded-md shadow-sm"
              required
            />
          </div>

          {/* DESCRIÇÃO */}
          <div className="relative">
            <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição"
              className="w-full pl-10 py-2 h-24 border rounded-md shadow-sm"
            />
          </div>

          {/* PÚBLICO-ALVO */}
          <div className="relative">
            <FileText className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              value={publicoAlvo}
              onChange={(e) => setPublicoAlvo(e.target.value)}
              placeholder="Público-alvo"
              className="w-full pl-10 py-2 border rounded-md shadow-sm"
            />
          </div>

          {/* INSTRUTOR(ES) */}
          {instrutorSelecionado.map((valor, index) => (
            <div key={index} className="mb-2 relative pr-10">
              <label className="text-sm font-medium text-gray-700 dark:text-white">
                {index === 0 ? "Selecione o instrutor" : `Instrutor adicional`}
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={valor}
                  onChange={(e) => handleSelecionarInstrutor(index, e.target.value)}
                  className="w-full pl-3 py-2 border rounded-md shadow-sm"
                  required={index === 0}
                >
                  <option value="">Selecione o instrutor</option>
                  {getInstrutorDisponivel(index).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removerInstrutor(index)}
                    className="text-red-500 hover:text-red-700 font-bold text-lg"
                    title="Remover este instrutor"
                  >
                    ❌
                  </button>
                )}
              </div>

              {valor && index === instrutorSelecionado.length - 1 && (
                <div className="flex justify-center mt-3">
                  <button
                    type="button"
                    onClick={adicionarInstrutor}
                    className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition focus-visible:ring-2 focus-visible:ring-teal-400"
                  >
                    <PlusCircle size={16} />
                    Incluir outro instrutor
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* LOCAL */}
          <div className="relative">
            <MapPin className="absolute left-3 top-3 text-gray-500" size={18} />
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Local"
              className="w-full pl-10 py-2 border rounded-md shadow-sm"
              required
            />
          </div>

          {/* TIPO */}
          <div className="relative">
            <Layers3 className="absolute left-3 top-3 text-gray-500" size={18} />
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full pl-10 py-2 border rounded-md shadow-sm"
              required
            >
              <option value="">Selecione o tipo</option>
              <option value="Congresso">Congresso</option>
              <option value="Curso">Curso</option>
              <option value="Oficina">Oficina</option>
              <option value="Palestra">Palestra</option>
              <option value="Seminário">Seminário</option>
              <option value="Simpósio">Simpósio</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          {/* UNIDADE */}
          <div className="relative">
            <Layers3 className="absolute left-3 top-3 text-gray-500" size={18} />
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="w-full pl-10 py-2 border rounded-md shadow-sm"
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

          {/* 🔒 RESTRIÇÃO DE ACESSO */}
          <fieldset className="border rounded-md p-3">
            <legend className="px-1 font-semibold flex items-center gap-2">
              {restrito ? <Lock size={16} /> : <Unlock size={16} />} Visibilidade do evento
              {restrito && restritoModo === "lista_registros" && regCount > 0 && (
                <Badge title="Total de registros deste evento">{regCount}</Badge>
              )}
            </legend>

            <label className="inline-flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={restrito}
                onChange={(e) => {
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
                    {regCount > 0 && <Badge title="Quantidade de registros na lista">{regCount}</Badge>}
                  </span>
                </label>

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
                          const txt = e.clipboardData?.getData("text");
                          if (txt && /[\s,;|\n\r\t]/.test(txt)) {
                            e.preventDefault();
                            addRegistrosBulk(txt);
                          }
                        }}
                        placeholder="Digite o registro (só números) e Enter"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                      <button
                        type="button"
                        onClick={addRegistro}
                        className="px-3 py-2 rounded-md bg-teal-700 hover:bg-teal-800 text-white"
                      >
                        Adicionar
                      </button>
                    </div>

                    {regCount > 0 ? (
                      <>
                        <div className="text-xs text-gray-600">{regCount} registro(s) na lista</div>
                        <div className="flex flex-wrap gap-2">
                          {registros.map((r) => (
                            <span
                              key={r}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-200 text-gray-800 text-xs"
                            >
                              {r}
                              <button
                                type="button"
                                className="ml-1 text-red-600"
                                title="Remover"
                                onClick={() => removeRegistro(r)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-600">
                        Você também pode colar uma lista (CSV/planilha). Só os números serão considerados.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          {/* TURMAS */}
          <div>
            <h3 className="text-md font-semibold mt-4 flex items-center gap-2 text-lousa dark:text-white">
              <Layers3 size={16} /> Turmas Cadastradas
            </h3>
            {turmas.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">Nenhuma turma cadastrada.</p>
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
                      className="bg-gray-100 dark:bg-zinc-800 rounded-md p-3 text-sm shadow-sm relative"
                    >
                      {/* Botão Remover */}
                      <button
                        type="button"
                        onClick={() => removerTurma(t, i)}
                        disabled={removendoId === t.id}
                        title="Remover turma"
                        className="absolute right-2 top-2 inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs
                                   hover:bg-red-50 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                        {removendoId === t.id ? "Removendo..." : "Remover"}
                      </button>

                      <p className="font-bold pr-28">{t.nome}</p>
                      {qtd > 0 ? (
                        <>
                          <p>
                            📅 {qtd} encontro(s) • {formatarDataBrasileira(di)} a {formatarDataBrasileira(df)}
                          </p>
                          <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300 list-disc list-inside">
                            {t.datas.map((d, idx) => (
                              <li key={idx}>
                                {formatarDataBrasileira(d.data)} — {hh(d.horario_inicio)} às {hh(d.horario_fim)}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p>
                          📅 {formatarDataBrasileira(t.data_inicio)} a {formatarDataBrasileira(t.data_fim)}
                        </p>
                      )}
                      {hi && hf && (
                        <p>🕒 {hi} às {hf}</p>
                      )}
                      <p>👥 {t.vagas_total} vagas • ⏱ {t.carga_horaria}h</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={abrirModalTurma}
                className="flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-semibold px-4 py-2 rounded-full transition focus-visible:ring-2 focus-visible:ring-teal-400"
                aria-label="Adicionar nova turma"
                tabIndex={0}
              >
                <PlusCircle size={16} />
                Adicionar Turma
              </button>
            </div>
          </div>
        </form>

        {/* Rodapé do modal */}
        <div className="flex justify-end gap-2 border-t mt-4 pt-4 bg-white dark:bg-zinc-900 px-4 py-2 shadow-inner">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-md"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-evento"
            className="bg-lousa hover:bg-green-800 text-white px-4 py-2 rounded-md font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>

      {/* MODAL TURMA */}
      <ModalTurma
        isOpen={modalTurmaAberto}
        onClose={() => setModalTurmaAberto(false)}
        onSalvar={(turma) => {
          const datas = Array.isArray(turma.datas) ? turma.datas : [];
          setTurmas((prev) => [
            ...prev,
            {
              ...turma,
              datas,
              // espelhos para exibição
              data_inicio: datas.length ? minDate(datas) : turma.data_inicio,
              data_fim: datas.length ? maxDate(datas) : turma.data_fim,
              horario_inicio: datas.length ? hh(datas[0]?.horario_inicio) : hh(turma.horario_inicio || turma.hora_inicio),
              horario_fim: datas.length ? hh(datas[0]?.horario_fim) : hh(turma.horario_fim || turma.hora_fim),
              carga_horaria: Number(turma.carga_horaria),
              vagas_total: Number(turma.vagas_total),
            },
          ]);
          setModalTurmaAberto(false);
        }}
      />
    </Modal>
  );
}
