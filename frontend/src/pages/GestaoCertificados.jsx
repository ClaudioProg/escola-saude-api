// 📁 frontend/src/pages/GestaoCertificados.jsx
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../services/api";
import { fmtDataHora } from "../utils/data";
import { ChevronDown, ChevronRight, RefreshCcw, Trash2, Download } from "lucide-react";

function Collapser({ open, onToggle, children, className = "" }) {
  return (
    <button type="button" onClick={onToggle}
      className={`inline-flex items-center gap-1 text-left ${className}`}>
      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default function AdminCertificadosArvore() {
  const [data, setData] = useState([]); // [{evento_id, evento_titulo, turmas:[...]}]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openEventos, setOpenEventos] = useState({});
  const [openTurmas, setOpenTurmas] = useState({}); // key `${evento_id}:${turma_id}`

  const fetchData = async () => {
    try {
      setLoading(true);
      setErr("");
      const rows = await apiGet(`/certificados-admin/arvore`);
      setData(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErr(e?.message || "Falha ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totaisGeral = useMemo(() => {
    let presentes = 0, emitidos = 0, pendentes = 0;
    for (const ev of data) {
      for (const t of ev.turmas) {
        presentes += t.totais.presentes;
        emitidos  += t.totais.emitidos;
        pendentes += t.totais.pendentes;
      }
    }
    return { presentes, emitidos, pendentes };
  }, [data]);

  const doResetTurma = async (turmaId) => {
    if (!confirm(`Resetar certificados dos participantes da turma #${turmaId}?`)) return;
    try {
      await apiPost(`/certificados-admin/turmas/${turmaId}/reset`, {});
      await fetchData();
      alert("Reset concluído.");
    } catch (e) {
      alert(e?.message || "Falha ao resetar.");
    }
  };

  return (
    <div className="mx-auto max-w-screen-xl p-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Certificados — visão por Evento/Turma</h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className="rounded-xl bg-zinc-100 px-3 py-2 text-sm hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <span className="inline-flex items-center gap-2">
            <RefreshCcw className="h-4 w-4" /> {loading ? "Atualizando…" : "Atualizar"}
          </span>
        </button>
      </div>

      <div className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
        Total presentes: <strong>{totaisGeral.presentes}</strong> ·
        Emitidos: <strong className="text-emerald-600">{totaisGeral.emitidos}</strong> ·
        Pendentes: <strong className="text-amber-600">{totaisGeral.pendentes}</strong>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Carregando…</div>
      ) : err ? (
        <div className="text-sm text-rose-600">{err}</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-zinc-500">Nenhum evento encontrado.</div>
      ) : (
        <div className="grid gap-3">
          {data.map(ev => {
            const evOpen = !!openEventos[ev.evento_id];
            return (
              <div key={ev.evento_id} className="rounded-2xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
                {/* Evento */}
                <div className="flex items-center justify-between p-3">
                  <Collapser
                    open={evOpen}
                    onToggle={() => setOpenEventos(s => ({ ...s, [ev.evento_id]: !evOpen }))}
                    className="text-base font-medium"
                  >
                    {ev.evento_titulo}
                  </Collapser>
                  <div className="text-xs text-zinc-500">
                    {ev.turmas.length} turma(s)
                  </div>
                </div>

                {evOpen && (
                  <div className="border-t dark:border-zinc-800">
                    {ev.turmas.map(t => {
                      const key = `${ev.evento_id}:${t.turma_id}`;
                      const tOpen = !!openTurmas[key];
                      return (
                        <div key={t.turma_id} className="border-b last:border-b-0 dark:border-zinc-800">
                          {/* Turma header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                            <div className="min-w-0">
                              <Collapser
                                open={tOpen}
                                onToggle={() => setOpenTurmas(s => ({ ...s, [key]: !tOpen }))}
                                className="font-medium"
                              >
                                Turma #{t.turma_id} — {t.turma_nome || "Sem título"}
                              </Collapser>
                              <div className="text-xs text-zinc-500">
                                {t.data_inicio ? fmtDataHora(t.data_inicio) : "—"} → {t.data_fim ? fmtDataHora(t.data_fim) : "—"}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                                Presentes: <strong>{t.totais.presentes}</strong>
                              </span>
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                Emitidos: <strong>{t.totais.emitidos}</strong>
                              </span>
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                Pendentes: <strong>{t.totais.pendentes}</strong>
                              </span>

                              <button
                                onClick={() => doResetTurma(t.turma_id)}
                                className="ml-2 inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-white hover:bg-rose-700"
                                title="Resetar certificados desta turma"
                              >
                                <Trash2 className="h-4 w-4" /> Resetar turma
                              </button>
                            </div>
                          </div>

                          {/* Participantes */}
                          {tOpen && (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-zinc-600 dark:text-zinc-300">
                                    <th className="py-2 pl-3 pr-4">Usuário</th>
                                    <th className="py-2 pr-4">Email</th>
                                    <th className="py-2 pr-4">Status</th>
                                    <th className="py-2 pr-4">Ações</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.participantes.map(p => {
                                    const has = p.emitido && p.certificado_id;
                                    const href = has ? `/api/certificados/${p.certificado_id}/download` : null;
                                    return (
                                      <tr key={p.usuario_id} className="border-t dark:border-zinc-800">
                                        <td className="py-2 pl-3 pr-4">{p.nome}</td>
                                        <td className="py-2 pr-4">{p.email}</td>
                                        <td className="py-2 pr-4">
                                          {has ? (
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                              Emitido
                                            </span>
                                          ) : (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                              Pendente
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 pr-4">
                                          {has ? (
                                            <a
                                              href={href}
                                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-700"
                                            >
                                              <Download className="h-4 w-4" /> Baixar
                                            </a>
                                          ) : (
                                            <span className="text-zinc-400">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {t.participantes.length === 0 && (
                                    <tr>
                                      <td className="py-3 pl-3 text-zinc-500" colSpan={4}>Sem participantes presentes.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
