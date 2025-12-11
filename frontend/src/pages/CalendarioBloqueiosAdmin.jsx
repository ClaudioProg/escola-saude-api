// ✅ src/pages/CalendarioBloqueiosAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, Edit2, Info } from "lucide-react";
import { toast } from "react-toastify";
import Skeleton from "react-loading-skeleton";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Footer from "../components/Footer";

const NOMES_MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const TIPOS_OPCOES = [
  { value: "feriado_nacional",  label: "Feriado nacional" },
  { value: "feriado_municipal", label: "Feriado municipal" },
  { value: "ponto_facultativo", label: "Ponto facultativo" },
  { value: "bloqueio_interno",  label: "Bloqueio interno (administrativo)" },
];

const TIPO_LABEL = TIPOS_OPCOES.reduce((acc, t) => {
  acc[t.value] = t.label;
  return acc;
}, {});

function criarMatrixMes(ano, mesIndex) {
  const primeiroDia = new Date(ano, mesIndex, 1);
  const ultimoDia   = new Date(ano, mesIndex + 1, 0);
  const primeiroDiaSemana = primeiroDia.getDay();
  const diasNoMes = ultimoDia.getDate();

  const semanas = [];
  let semanaAtual = new Array(7).fill(null);
  let dia = 1;

  for (let i = 0; i < primeiroDiaSemana; i++) semanaAtual[i] = null;
  for (let i = primeiroDiaSemana; i < 7; i++) semanaAtual[i] = dia++;
  semanas.push(semanaAtual);

  while (dia <= diasNoMes) {
    const novaSemana = new Array(7).fill(null);
    for (let i = 0; i < 7 && dia <= diasNoMes; i++) novaSemana[i] = dia++;
    semanas.push(novaSemana);
  }
  return semanas;
}

function toISO(dateStr) {
  // input de <input type="date" /> já vem como YYYY-MM-DD
  return (dateStr || "").slice(0, 10);
}

export default function CalendarioBloqueiosAdmin() {
  const hoje = new Date();
  const hojeISO = hoje.toISOString().slice(0, 10);

  const [ano, setAno] = useState(hoje.getFullYear());
  const [mesIndex, setMesIndex] = useState(hoje.getMonth());
  const [loading, setLoading] = useState(false);
  const [calendario, setCalendario] = useState([]); // [{id,data,tipo,descricao}, ...]

  const [formData, setFormData] = useState({
    id: null,
    data: "",
    tipo: "feriado_nacional",
    descricao: "",
  });
  const [salvando, setSalvando] = useState(false);

  const navigate = useNavigate();
  const semanas = useMemo(() => criarMatrixMes(ano, mesIndex), [ano, mesIndex]);

  /* Carregar dados ao abrir a página */
  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      setLoading(true);
      const resp = await api.get("/calendario");
      const lista = resp?.data ?? resp ?? [];
      setCalendario(lista.map((item) => ({
        ...item,
        data: toISO(item.data),
      })));
    } catch (err) {
      console.error("[CalendarioBloqueiosAdmin] erro ao carregar:", err);
      toast.error("Erro ao carregar calendário de bloqueios.");
    } finally {
      setLoading(false);
    }
  }

  function mudarMes(delta) {
    let novoMes = mesIndex + delta;
    let novoAno = ano;
    if (novoMes < 0) { novoMes = 11; novoAno--; }
    else if (novoMes > 11) { novoMes = 0; novoAno++; }
    setMesIndex(novoMes);
    setAno(novoAno);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((old) => ({ ...old, [name]: value }));
  }

  function editarRegistro(reg) {
    setFormData({
      id: reg.id,
      data: reg.data,
      tipo: reg.tipo,
      descricao: reg.descricao || "",
    });
  }

  function limparForm() {
    setFormData({
      id: null,
      data: "",
      tipo: "feriado_nacional",
      descricao: "",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      setSalvando(true);
      const payload = {
        data: toISO(formData.data),
        tipo: formData.tipo,      // ⬅️ envia exatamente o value aceito pelo banco
        descricao: formData.descricao || null,
      };

      if (!payload.data || !payload.tipo) {
        toast.warn("Preencha data e tipo.");
        return;
      }

      if (formData.id) {
        await api.put(`/calendario/${formData.id}`, payload);
        toast.success("Data atualizada com sucesso.");
      } else {
        await api.post("/calendario", payload);
        toast.success("Data cadastrada com sucesso.");
      }

      await carregar();
      limparForm();
    } catch (err) {
      console.error("[CalendarioBloqueiosAdmin] erro ao criar:", err);
      const msg = err?.response?.data?.erro || "Erro ao salvar data.";
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirRegistro(id) {
    if (!window.confirm("Tem certeza que deseja excluir esta data?")) return;
    try {
      await api.delete(`/calendario/${id}`);
      toast.success("Data removida com sucesso.");
      await carregar();
    } catch (err) {
      console.error("[CalendarioBloqueiosAdmin] erro ao excluir:", err);
      toast.error("Erro ao excluir data.");
    }
  }

  const calendarioPorData = useMemo(() => {
    const map = {};
    for (const item of calendario) {
      const key = toISO(item.data);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [calendario]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-white/10 rounded-2xl">
                <CalendarDays className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold">
                  Calendário de Feriados e Bloqueios
                </h1>
                <p className="text-sm sm:text-base text-emerald-50">
                  Gerencie feriados nacionais, municipais, pontos facultativos
                  e bloqueios internos que deixam as salas indisponíveis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* Barra superior */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-full bg-white shadow hover:bg-slate-50"
              onClick={() => mudarMes(-1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm text-slate-500">Mês</p>
              <p className="text-base sm:text-lg font-semibold text-slate-800">
                {NOMES_MESES[mesIndex]} {ano}
              </p>
            </div>
            <button
              className="p-2 rounded-full bg-white shadow hover:bg-slate-50"
              onClick={() => mudarMes(1)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate("/admin/agenda-salas")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm text-xs sm:text-sm text-slate-700 hover:bg-slate-50"
          >
            Voltar para Agenda de Salas
          </button>
        </div>

        {/* Info */}
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] sm:text-xs text-emerald-900 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-emerald-700" />
          <p>
            Todas as datas cadastradas aqui são consideradas{" "}
            <strong>indisponíveis</strong> na Agenda de Salas (Auditório e Sala
            de Reunião), para todos os períodos.
          </p>
        </div>

        {/* Formulário de cadastro/edição */}
        <section className="mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5">
          <h2 className="text-sm sm:text-base font-semibold text-slate-800 mb-3">
            {formData.id ? "Editar data do calendário" : "Cadastrar nova data"}
          </h2>

          <form
            onSubmit={onSubmit}
            className="grid grid-cols-1 sm:grid-cols-[150px,1fr,auto] gap-3 sm:items-end"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data
              </label>
              <input
                type="date"
                name="data"
                value={formData.data}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tipo
              </label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                required
              >
                {TIPOS_OPCOES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Descrição (opcional)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Ex.: Véspera de Natal, Recesso administrativo…"
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {salvando
                      ? "Salvando..."
                      : formData.id
                      ? "Atualizar"
                      : "Cadastrar"}
                  </button>
                  {formData.id && (
                    <button
                      type="button"
                      onClick={limparForm}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </section>

        {/* Calendário com marcação das datas bloqueadas */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100 text-xs sm:text-sm">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="py-2 text-center font-medium text-slate-600 uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="p-4">
              <Skeleton height={120} count={3} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {semanas.map((semana, idxSemana) => (
                <div key={idxSemana} className="grid grid-cols-7">
                  {semana.map((dia, idxDia) => {
                    if (!dia) {
                      return (
                        <div
                          key={idxDia}
                          className="min-h-[100px] border-r border-slate-100 bg-slate-50/40"
                        />
                      );
                    }

                    const m = String(mesIndex + 1).padStart(2, "0");
                    const d = String(dia).padStart(2, "0");
                    const dataISO = `${ano}-${m}-${d}`;
                    const eventosDia = calendarioPorData[dataISO] || [];
                    const eHoje = dataISO === hojeISO;

                    return (
                      <div
                        key={idxDia}
                        className="min-h-[110px] border-r border-slate-100 p-1.5 sm:p-2 flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-xs sm:text-sm font-medium ${
                              eHoje ? "text-emerald-600" : "text-slate-700"
                            }`}
                          >
                            {dia}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-col gap-1">
                          {eventosDia.map((ev) => (
                            <div
                              key={ev.id}
                              className="group rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] sm:text-xs flex flex-col gap-1"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-emerald-800">
                                  {TIPO_LABEL[ev.tipo] || ev.tipo}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    type="button"
                                    onClick={() => editarRegistro(ev)}
                                    className="p-0.5 rounded hover:bg-emerald-100"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3 h-3 text-emerald-800" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => excluirRegistro(ev.id)}
                                    className="p-0.5 rounded hover:bg-red-100"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3 h-3 text-red-600" />
                                  </button>
                                </div>
                              </div>
                              {ev.descricao && (
                                <p className="text-[10px] text-emerald-900">
                                  {ev.descricao}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
