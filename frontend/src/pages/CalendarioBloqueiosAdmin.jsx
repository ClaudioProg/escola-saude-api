// 📁 src/pages/CalendarioBloqueiosAdmin.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import api from "../services/api";
import { toast } from "react-toastify";

const TIPOS = [
  { value: "feriado_nacional", label: "Feriado Nacional" },
  { value: "feriado_municipal", label: "Feriado Municipal" },
  { value: "ponto_facultativo", label: "Ponto Facultativo" },
  { value: "bloqueio_interno", label: "Bloqueio Interno" },
];

export default function CalendarioBloqueiosAdmin() {
  const [lista, setLista] = useState([]);
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState("feriado_nacional");
  const [descricao, setDescricao] = useState("");
  const [editando, setEditando] = useState(null);

  async function carregar() {
    try {
      const resp = await api.get("/calendario");
      setLista(resp.data);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar datas.");
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvarNovo() {
    try {
      if (!data) return toast.warn("Informe a data.");
      const resp = await api.post("/calendario", { data, tipo, descricao });
      toast.success("Data cadastrada!");
      setData("");
      setDescricao("");
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.erro || "Erro ao salvar.");
    }
  }

  async function salvarEdicao(item) {
    try {
      await api.put(`/calendario/${item.id}`, {
        tipo: item.tipo,
        descricao: item.descricao,
      });
      toast.success("Atualizado!");
      setEditando(null);
      await carregar();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar.");
    }
  }

  async function excluir(id) {
    if (!window.confirm("Excluir esta data?")) return;
    try {
      await api.delete(`/calendario/${id}`);
      toast.success("Removido.");
      await carregar();
    } catch (e) {
      toast.error("Erro ao remover.");
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">

      {/* HeaderHero */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-400 p-6 shadow-lg text-white">
        <h1 className="text-xl font-bold">Gerenciar Feriados e Datas Bloqueadas</h1>
        <p className="text-sm opacity-90">
          As datas cadastradas aqui bloqueiam automaticamente a reserva de salas.
        </p>
      </div>

      {/* Formulário de cadastro */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-700">
          <Plus className="w-5 h-5 text-emerald-600" />
          Adicionar data bloqueada
        </h2>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-slate-600">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
              className="w-full mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={salvarNovo}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm"
        >
          Salvar
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-700">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Datas cadastradas
        </h2>

        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma data cadastrada.</p>
        ) : (
          <div className="space-y-3">
            {lista.map((item) => {
              const isEdit = editando === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Data */}
                  <div className="font-medium text-slate-700">
                    {item.data}
                  </div>

                  {/* Tipo + descrição */}
                  <div className="flex-1">
                    {isEdit ? (
                      <>
                        <select
                          value={item.tipo}
                          onChange={(e) =>
                            setLista((prev) =>
                              prev.map((x) =>
                                x.id === item.id
                                  ? { ...x, tipo: e.target.value }
                                  : x
                              )
                            )
                          }
                          className="rounded-xl border px-2 py-1 text-sm mb-1"
                        >
                          {TIPOS.map((t) => (
                            <option value={t.value} key={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={item.descricao || ""}
                          onChange={(e) =>
                            setLista((prev) =>
                              prev.map((x) =>
                                x.id === item.id
                                  ? { ...x, descricao: e.target.value }
                                  : x
                              )
                            )
                          }
                          className="w-full rounded-xl border px-2 py-1 text-sm"
                        />
                      </>
                    ) : (
                      <div className="text-sm text-slate-600">
                        <strong>
                          {TIPOS.find((t) => t.value === item.tipo)?.label}
                        </strong>
                        {item.descricao ? ` — ${item.descricao}` : ""}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2">
                    {isEdit ? (
                      <>
                        <button
                          onClick={() => salvarEdicao(item)}
                          className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditando(null)}
                          className="p-2 bg-slate-200 text-slate-700 rounded-xl"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditando(item.id)}
                          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => excluir(item.id)}
                          className="p-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
