// ✅ src/components/ModalSolicitacaoCurso.jsx
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import {
  X,
  CalendarDays,
  Users,
  MapPin,
  Type,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Clock,
  School,
  BadgeCheck,
} from "lucide-react";
import api from "../services/api";

const STATUS_OPCOES = [
  { value: "planejado", label: "Planejado" },
  { value: "em_analise", label: "Em análise" },
  { value: "confirmado", label: "Confirmado" },
  { value: "cancelado", label: "Cancelado" },
];

const MODALIDADE_OPCOES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "On-line" },
  { value: "hibrido", label: "Híbrido" },
];

function criarLinhaDataVazia() {
  return { id: Date.now(), data: "", horario_inicio: "", horario_fim: "" };
}

export default function ModalSolicitacaoCurso({
  aberto,
  onClose,
  onSaved,
  solicitacao, // objeto da API ou null para novo
  unidades = [],
  podeEditarStatus = false, // 🔒 só admin depois liga isso
}) {
  const isEdicao = !!solicitacao?.id;

  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    publico_alvo: "",
    local: "",
    tipo: "",
    unidade_id: "",
    modalidade: "",
    restrito: false,
    restricao_descricao: "",
    carga_horaria_total: "",
    gera_certificado: false,
    status: "planejado",
  });

  const [datas, setDatas] = useState([criarLinhaDataVazia()]);

  // 🔹 Agora palestrantes são apenas uma lista de nomes (strings)
  const [palestrantes, setPalestrantes] = useState([]);
  const [novoPalestrante, setNovoPalestrante] = useState("");

  useEffect(() => {
    if (!aberto) return;

    if (isEdicao) {
      setForm({
        titulo: solicitacao?.titulo || "",
        descricao: solicitacao?.descricao || "",
        publico_alvo: solicitacao?.publico_alvo || "",
        local: solicitacao?.local || "",
        tipo: solicitacao?.tipo || "",
        unidade_id: solicitacao?.unidade_id || "",
        modalidade: solicitacao?.modalidade || "",
        restrito: !!solicitacao?.restrito,
        restricao_descricao: solicitacao?.restricao_descricao || "",
        carga_horaria_total:
          solicitacao?.carga_horaria_total != null
            ? String(solicitacao.carga_horaria_total)
            : "",
        gera_certificado: !!solicitacao?.gera_certificado,
        status: solicitacao?.status || "planejado",
      });

      setDatas(
        Array.isArray(solicitacao?.datas) && solicitacao.datas.length
          ? solicitacao.datas.map((d) => ({
              id: d.id || `${d.data}-${d.horario_inicio || ""}`,
              data: d.data || "",
              horario_inicio: d.horario_inicio || "",
              horario_fim: d.horario_fim || "",
            }))
          : [criarLinhaDataVazia()]
      );

      // Aceita tanto array de objetos {nome, nome_externo} quanto array de strings
      setPalestrantes(
        Array.isArray(solicitacao?.palestrantes)
          ? solicitacao.palestrantes
              .map((p) =>
                typeof p === "string"
                  ? p
                  : p.nome || p.nome_externo || ""
              )
              .filter(Boolean)
          : []
      );
    } else {
      setForm((prev) => ({
        ...prev,
        titulo: "",
        descricao: "",
        publico_alvo: "",
        local: "",
        tipo: "",
        unidade_id: "",
        modalidade: "",
        restrito: false,
        restricao_descricao: "",
        carga_horaria_total: "",
        gera_certificado: false,
        status: "planejado",
      }));
      setDatas([criarLinhaDataVazia()]);
      setPalestrantes([]);
    }

    setNovoPalestrante("");
  }, [aberto, isEdicao, solicitacao]);

  function handleChangeField(campo, valor) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  }

  function handleChangeDataLinha(id, campo, valor) {
    setDatas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [campo]: valor } : d))
    );
  }

  function handleAdicionarData() {
    setDatas((prev) => [...prev, criarLinhaDataVazia()]);
  }

  function handleRemoverData(id) {
    setDatas((prev) => {
      if (prev.length === 1) return prev; // sempre manter ao menos 1
      return prev.filter((d) => d.id !== id);
    });
  }

  function handleAdicionarPalestranteNome() {
    const nome = novoPalestrante.trim();
    if (!nome) {
      toast.warn("Informe o nome completo do palestrante.");
      return;
    }
    // evita duplicados simples por nome
    setPalestrantes((prev) =>
      prev.includes(nome) ? prev : [...prev, nome]
    );
    setNovoPalestrante("");
  }

  function handleRemoverPalestrante(idx) {
    setPalestrantes((prev) => prev.filter((_, i) => i !== idx));
  }

  const payloadDatas = useMemo(
    () =>
      datas
        .map((d) => ({
          data: d.data || "",
          horario_inicio: d.horario_inicio || null,
          horario_fim: d.horario_fim || null,
        }))
        .filter((d) => d.data),
    [datas]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (salvando) return;

    if (!form.titulo.trim()) {
      toast.warn("Informe o título do curso.");
      return;
    }

    if (payloadDatas.length === 0) {
      toast.warn("Informe ao menos uma data para a solicitação.");
      return;
    }

    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      publico_alvo: form.publico_alvo || null,
      local: form.local || null,
      tipo: form.tipo || null,
      unidade_id: form.unidade_id ? Number(form.unidade_id) : null,
      modalidade: form.modalidade || null,
      restrito: !!form.restrito,
      restricao_descricao: form.restrito
        ? form.restricao_descricao || null
        : null,
      carga_horaria_total: form.carga_horaria_total
        ? Number(form.carga_horaria_total)
        : null,
      gera_certificado: !!form.gera_certificado,
      datas: payloadDatas,
      // 🔹 Agora sempre mandamos uma lista de objetos com nome
      palestrantes: (palestrantes || []).map((nome) => ({
        usuario_id: null,
        nome_externo: nome,
        nome,
      })),
    };

    // status só vai se for edição e se for permitido (admin)
    if (isEdicao && podeEditarStatus) {
      payload.status = form.status || "planejado";
    }

    try {
      setSalvando(true);
      if (isEdicao) {
        // 🔧 rota corrigida para edição
        await api.put(`/api/solicitacoes-curso/${solicitacao.id}`, payload);
        toast.success("Solicitação atualizada com sucesso.");
      } else {
        await api.post("/api/solicitacoes-curso", payload);
        toast.success("Solicitação criada com sucesso.");
      }

      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar a solicitação de curso.");
    } finally {
      setSalvando(false);
    }
  }

  function handleFechar() {
    if (salvando) return;
    onClose?.();
  }

  if (!aberto) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
        aria-modal="true"
        role="dialog"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ duration: 0.18 }}
          className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        >
          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 px-4 py-3 text-white">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CalendarDays className="h-5 w-5" />
                {isEdicao ? "Editar solicitação de curso" : "Nova solicitação de curso"}
              </h2>
              <p className="mt-1 text-xs text-emerald-100">
                Preencha os campos abaixo para registrar a proposta de curso no calendário.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFechar}
              className="rounded-full p-1 text-emerald-50 hover:bg-emerald-800/60"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Formulário */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 text-xs sm:px-5 sm:py-5"
          >
            {/* Dados gerais */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                Dados gerais
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                    <Type className="h-3.5 w-3.5" />
                    Título do curso <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.titulo}
                    onChange={(e) => handleChangeField("titulo", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ex.: Atualização em cuidados paliativos na APS"
                    maxLength={200}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">
                    Tipo de curso
                  </label>
                  <input
                    type="text"
                    value={form.tipo}
                    onChange={(e) => handleChangeField("tipo", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Curso, oficina, encontro..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">
                    Unidade responsável
                  </label>
                  <select
                    value={form.unidade_id}
                    onChange={(e) => handleChangeField("unidade_id", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecione</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">
                    Modalidade
                  </label>
                  <select
                    value={form.modalidade}
                    onChange={(e) => handleChangeField("modalidade", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Selecione</option>
                    {MODALIDADE_OPCOES.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className="text-[11px] font-medium text-slate-700">
                    Descrição
                  </label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => handleChangeField("descricao", e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Descreva brevemente os objetivos, conteúdo e formato do curso."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">
                    Público-alvo
                  </label>
                  <textarea
                    value={form.publico_alvo}
                    onChange={(e) => handleChangeField("publico_alvo", e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ex.: enfermeiros da APS, equipes NASF, residentes..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                    <MapPin className="h-3.5 w-3.5" />
                    Local
                  </label>
                  <input
                    type="text"
                    value={form.local}
                    onChange={(e) => handleChangeField("local", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ex.: Auditório da Escola da Saúde, remoto via Teams..."
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">
                    Carga horária total (horas)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.carga_horaria_total}
                    onChange={(e) =>
                      handleChangeField("carga_horaria_total", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Ex.: 8"
                  />
                </div>

                <div className="flex flex-col justify-end gap-2 sm:col-span-2 sm:flex-row sm:items-center">
                  <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.gera_certificado}
                      onChange={(e) =>
                        handleChangeField("gera_certificado", e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Este curso gera certificado para participantes/instrutores
                  </label>

                  {isEdicao && podeEditarStatus && (
                    <div className="flex flex-col gap-1 sm:w-48">
                      <label className="text-[11px] font-medium text-slate-700">
                        Status da solicitação
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => handleChangeField("status", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {STATUS_OPCOES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Seção: Datas */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <Clock className="h-4 w-4 text-emerald-600" />
                Datas e horários <span className="text-rose-500 text-xs">*</span>
              </h3>

              <div className="space-y-2">
                {datas.map((linha) => (
                  <div
                    key={linha.id}
                    className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2 sm:grid-cols-[1.4fr,1fr,1fr,auto]"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-slate-600">
                        Data (YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={linha.data}
                        onChange={(e) =>
                          handleChangeDataLinha(linha.id, "data", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-slate-600">
                        Horário início
                      </label>
                      <input
                        type="time"
                        value={linha.horario_inicio || ""}
                        onChange={(e) =>
                          handleChangeDataLinha(
                            linha.id,
                            "horario_inicio",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-medium text-slate-600">
                        Horário fim
                      </label>
                      <input
                        type="time"
                        value={linha.horario_fim || ""}
                        onChange={(e) =>
                          handleChangeDataLinha(linha.id, "horario_fim", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoverData(linha.id)}
                        disabled={datas.length === 1}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 disabled:opacity-40"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAdicionarData}
                  className="inline-flex items-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/40 px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar outra data
                </button>
              </div>
            </section>

            {/* Seção: Palestrantes */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <School className="h-4 w-4 text-emerald-600" />
                Palestrantes
              </h3>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">
                  Nome completo do palestrante
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={novoPalestrante}
                    onChange={(e) => setNovoPalestrante(e.target.value)}
                    placeholder="Digite o nome completo e clique em Adicionar"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAdicionarPalestranteNome}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-medium text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Adicionar
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Você pode adicionar quantos palestrantes forem necessários.
                </p>
              </div>

              {/* Lista de palestrantes adicionados */}
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                {palestrantes.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Nenhum palestrante adicionado até o momento.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {palestrantes.map((nome, idx) => (
                      <li
                        key={`${nome}-${idx}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] text-slate-700 shadow-sm"
                      >
                        <Users className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="max-w-[180px] truncate">{nome}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoverPalestrante(idx)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Seção: Restrição */}
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <Lock className="h-4 w-4 text-emerald-600" />
                Controle de acesso
              </h3>

              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.restrito}
                    onChange={(e) => handleChangeField("restrito", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Este curso possui acesso <strong>restrito</strong> (ex.: apenas
                  determinada categoria/unidade).
                </label>

                {form.restrito && (
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                      <Unlock className="h-3.5 w-3.5" />
                      Descreva a restrição
                    </label>
                    <textarea
                      value={form.restricao_descricao}
                      onChange={(e) =>
                        handleChangeField("restricao_descricao", e.target.value)
                      }
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Ex.: Restrito a enfermeiros da Rede Básica, residentes de Medicina de Família, profissionais da UPA Central..."
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Rodapé do formulário */}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500">
                Campos marcados com <span className="text-rose-500">*</span> são
                obrigatórios.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleFechar}
                  disabled={salvando}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {salvando
                    ? isEdicao
                      ? "Salvando..."
                      : "Cadastrando..."
                    : isEdicao
                    ? "Salvar alterações"
                    : "Cadastrar solicitação"}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
