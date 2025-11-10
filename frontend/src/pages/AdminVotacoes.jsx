// src/pages/AdminVotacoes.jsx
import { useEffect, useMemo, useState } from "react";
import {
  adminListar, adminCriar, adminAtualizar, adminObter,
  adminCriarOpcao, adminAtualizarOpcao, adminStatus, adminRanking
} from "../services/votacoes";
import { toast } from "react-toastify";
import { Plus, Save, BarChart3, Play, Pause, StopCircle } from "lucide-react";

export default function AdminVotacoes() {
  const [lista, setLista] = useState([]);
  const [sel, setSel] = useState(null);
  const [ranking, setRanking] = useState([]);

  useEffect(() => { recarregar(); }, []);
  function recarregar() { adminListar().then(setLista).catch(() => toast.error("Falha ao listar.")); }

  async function abrir(id) {
    const v = await adminObter(id);
    setSel(v);
    carregaRanking(id);
  }

  function novo() {
    setSel({
      titulo: "", descricao: "",
      tipo_selecao: "unica", max_escolhas: 1,
      status: "rascunho",
      escopo: "global",
      regra_elegibilidade: "logado",
      unidade_id: null, geo_lat: null, geo_lng: null, geo_raio_m: null,
      evento_id: null, turma_id: null,
      opcoes: []
    });
    setRanking([]);
  }

  async function salvar() {
    try {
      if (sel.id) await adminAtualizar(sel.id, sel);
      else {
        const criado = await adminCriar(sel);
        setSel(criado);
      }
      toast.success("Salvo!");
      recarregar();
    } catch (e) {
      toast.error(e?.response?.data?.erro || "Erro ao salvar.");
    }
  }

  async function addOpcao() {
    if (!sel?.id) return toast.info("Salve a votação primeiro.");
    const o = await adminCriarOpcao(sel.id, { titulo: "Nova opção", ordem: (sel.opcoes?.length||0)+1 });
    setSel({ ...sel, opcoes: [...(sel.opcoes||[]), o] });
  }

  async function salvarOpcao(o) {
    const upd = await adminAtualizarOpcao(sel.id, o.id, o);
    setSel({
      ...sel,
      opcoes: (sel.opcoes||[]).map(x => x.id === o.id ? upd : x)
    });
  }

  async function mudarStatus(status) {
    const v = await adminStatus(sel.id, status);
    setSel({ ...sel, status: v.status });
    toast.success(`Status: ${v.status}`);
    recarregar();
  }

  async function carregaRanking(id) {
    const r = await adminRanking(id);
    setRanking(r);
  }

  return (
    <main className="p-4 grid lg:grid-cols-2 gap-4">
      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Votações</h2>
          <button onClick={novo} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </header>

        <ul className="space-y-2">
          {lista.map(v => (
            <li key={v.id}>
              <button onClick={() => abrir(v.id)} className="w-full text-left rounded-xl border p-3">
                <div className="font-medium">{v.titulo}</div>
                <div className="text-xs opacity-70">{v.status} • {v.tipo_selecao}{v.tipo_selecao==='multipla' ? ` (max ${v.max_escolhas})` : ""}</div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        {!sel ? (
          <div className="opacity-60 text-sm">Selecione ou crie uma votação.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border p-3">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs">Título</span>
                  <input className="input" value={sel.titulo} onChange={e => setSel({ ...sel, titulo: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-xs">Tipo de seleção</span>
                  <select className="input" value={sel.tipo_selecao} onChange={e => setSel({ ...sel, tipo_selecao: e.target.value })}>
                    <option value="unica">Apenas 1 opção</option>
                    <option value="multipla">Múltiplas opções</option>
                  </select>
                </label>
                {sel.tipo_selecao === "multipla" && (
                  <label className="block">
                    <span className="text-xs">Máximo de escolhas</span>
                    <input type="number" min={1} className="input" value={sel.max_escolhas}
                      onChange={e => setSel({ ...sel, max_escolhas: Number(e.target.value) || 1 })} />
                  </label>
                )}
                <label className="block md:col-span-2">
                  <span className="text-xs">Descrição</span>
                  <textarea className="input" rows={3} value={sel.descricao||""} onChange={e => setSel({ ...sel, descricao: e.target.value })} />
                </label>

                {/* Escopo e regra */}
                <label className="block">
                  <span className="text-xs">Escopo</span>
                  <select className="input" value={sel.escopo} onChange={e => setSel({ ...sel, escopo: e.target.value })}>
                    <option value="global">Global</option>
                    <option value="evento">Evento</option>
                    <option value="turma">Turma</option>
                  </select>
                </label>
                {sel.escopo === "evento" && (
                  <label className="block">
                    <span className="text-xs">Evento ID</span>
                    <input className="input" value={sel.evento_id||""} onChange={e => setSel({ ...sel, evento_id: e.target.value })} />
                  </label>
                )}
                {sel.escopo === "turma" && (
                  <label className="block">
                    <span className="text-xs">Turma ID</span>
                    <input className="input" value={sel.turma_id||""} onChange={e => setSel({ ...sel, turma_id: e.target.value })} />
                  </label>
                )}
                <label className="block">
                  <span className="text-xs">Regra de elegibilidade</span>
                  <select className="input" value={sel.regra_elegibilidade} onChange={e => setSel({ ...sel, regra_elegibilidade: e.target.value })}>
                    <option value="logado">Apenas logados</option>
                    <option value="inscrito">Inscrito (evento/turma)</option>
                    <option value="presente_hoje">Presente hoje</option>
                    <option value="presenca_minima">Presença ≥ 75%</option>
                  </select>
                </label>

                {/* Local (unidade e/ou geofence) */}
                <label className="block">
                  <span className="text-xs">Unidade (ID)</span>
                  <input className="input" value={sel.unidade_id||""} onChange={e => setSel({ ...sel, unidade_id: e.target.value||null })} />
                </label>
                <label className="block">
                  <span className="text-xs">Geofence lat</span>
                  <input className="input" value={sel.geo_lat||""} onChange={e => setSel({ ...sel, geo_lat: e.target.value||null })} />
                </label>
                <label className="block">
                  <span className="text-xs">Geofence lng</span>
                  <input className="input" value={sel.geo_lng||""} onChange={e => setSel({ ...sel, geo_lng: e.target.value||null })} />
                </label>
                <label className="block">
                  <span className="text-xs">Raio (m)</span>
                  <input className="input" value={sel.geo_raio_m||""} onChange={e => setSel({ ...sel, geo_raio_m: e.target.value||null })} />
                </label>

                {/* Janela */}
                <label className="block">
                  <span className="text-xs">Início</span>
                  <input type="datetime-local" className="input"
                    value={sel.inicio ? sel.inicio : ""} onChange={e => setSel({ ...sel, inicio: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-xs">Fim</span>
                  <input type="datetime-local" className="input"
                    value={sel.fim ? sel.fim : ""} onChange={e => setSel({ ...sel, fim: e.target.value })} />
                </label>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={salvar} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-emerald-600 text-white">
                  <Save className="w-4 h-4" /> Salvar
                </button>
                <button onClick={() => mudarStatus("ativa")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <Play className="w-4 h-4" /> Ativar
                </button>
                <button onClick={() => mudarStatus("rascunho")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <Pause className="w-4 h-4" /> Rascunho
                </button>
                <button onClick={() => mudarStatus("encerrada")} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <StopCircle className="w-4 h-4" /> Encerrar
                </button>
              </div>
            </div>

            <div className="rounded-2xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">Opções</h3>
                <button onClick={addOpcao} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
              <ul className="space-y-2">
                {(sel.opcoes||[]).map(o => (
                  <li key={o.id} className="grid md:grid-cols-4 gap-2 items-center">
                    <input className="input md:col-span-2" value={o.titulo} onChange={e => o.titulo=e.target.value} onBlur={() => salvarOpcao(o)} />
                    <input className="input" type="number" value={o.ordem} onChange={e => o.ordem=Number(e.target.value)||0} onBlur={() => salvarOpcao(o)} />
                    <select className="input" value={o.ativo ? "1":"0"} onChange={e => {o.ativo=e.target.value==="1"; salvarOpcao(o);}}>
                      <option value="1">Ativa</option>
                      <option value="0">Inativa</option>
                    </select>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-3">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">Ranking</h3>
                <button onClick={() => sel?.id && carregaRanking(sel.id)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border">
                  <BarChart3 className="w-4 h-4" /> Atualizar
                </button>
              </div>
              {!ranking.length ? (
                <div className="text-sm opacity-60">Sem votos ainda.</div>
              ) : (
                <ul className="space-y-1">
                  {ranking.map(r => (
                    <li key={r.opcao_id} className="flex justify-between">
                      <span>{r.opcao_titulo}</span>
                      <span className="font-medium">{r.votos}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
