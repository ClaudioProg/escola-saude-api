// ✅ src/pages/ListaPresencasTurma.jsx
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, ClipboardList } from "lucide-react";

import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import { formatarDataBrasileira } from "../utils/data";
import { apiPost } from "../services/api";

export default function ListaPresencasTurma({
  turmas = [],
  hoje = new Date(),
  inscritosPorTurma = {},
  carregarInscritos,
  modoadministradorPresencas = false,
}) {
  const [turmaExpandidaId, setTurmaExpandidaId] = useState(null);
  const [inscritosState, setInscritosState] = useState(inscritosPorTurma);
  const [loading, setLoading] = useState(null); // {turmaId, usuarioId, data}

  useEffect(() => {
    const atual = JSON.stringify(inscritosState);
    const novo = JSON.stringify(inscritosPorTurma);
    if (atual !== novo) setInscritosState(inscritosPorTurma);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inscritosPorTurma]);

  /* ───────────────────────────────
     Helpers anti-fuso (datas locais)
     ─────────────────────────────── */
  const ymd = (s) => {
    const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
  };
  const hms = (s, fb = "00:00") => {
    const [hh, mm] = String(s || fb).split(":").map((n) => parseInt(n, 10) || 0);
    return { hh, mm };
  };
  const makeLocalDate = (yyyy_mm_dd, hhmm = "00:00") => {
    const d = ymd(yyyy_mm_dd);
    const t = hms(hhmm);
    return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, 0, 0) : new Date(NaN);
  };
  const isoDia = (d) => {
    if (!d) return "";
    if (d instanceof Date && !isNaN(+d)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    const s = String(d);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const nd = new Date(s);
    if (!isNaN(+nd)) {
      const y = nd.getFullYear();
      const mo = String(nd.getMonth() + 1).padStart(2, "0");
      const da = String(nd.getDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }
    return "";
  };

  async function confirmarPresenca(turmaId, usuarioId, dataISO) {
    const confirmar = window.confirm("Deseja realmente confirmar presença deste usuário?");
    if (!confirmar) return;

    setLoading({ turmaId, usuarioId, data: dataISO });

    try {
      // padronizado com o restante do app
      await apiPost("/api/presencas/confirmar-simples", {
        turma_id: turmaId,
        usuario_id: usuarioId,
        data: dataISO, // backend espera 'data'
      });

      toast.success("✅ Presença confirmada com sucesso.", { ariaLive: "polite" });

      // atualização otimista
      setInscritosState((prev) => {
        const next = { ...prev };
        const lista = Array.isArray(next[turmaId]) ? next[turmaId] : [];
        next[turmaId] = lista.map((p) => {
          const idNorm = p.usuario_id ?? p.id;
          if (String(idNorm) !== String(usuarioId)) return p;

          // suporta dois formatos: array de presenças ou mapa { 'YYYY-MM-DD': true }
          if (Array.isArray(p.presencas)) {
            const jaExiste = p.presencas.some((pp) => isoDia(pp.data_presenca) === dataISO);
            return jaExiste
              ? p
              : { ...p, presencas: [...p.presencas, { data_presenca: dataISO, presente: true }] };
          }
          return { ...p, presencas: { ...(p.presencas || {}), [dataISO]: true } };
        });
        return next;
      });

      // sincroniza do servidor (opcional)
      if (carregarInscritos) await carregarInscritos(turmaId);
    } catch (err) {
      toast.error("❌ " + (err?.message || "Erro ao confirmar presença"), { ariaLive: "assertive" });
    } finally {
      setLoading(null);
    }
  }

  /* ─────────────── render vazio ─────────────── */
  if (!Array.isArray(turmas) || turmas.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
        <PageHeader title="Presenças por Turma" icon={ClipboardList} variant="esmeralda" />
        <main className="flex-1 px-2 sm:px-4 py-6">
          <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Presenças por Turma" }]} />
          <NadaEncontrado
            mensagem="Nenhuma turma encontrada."
            sugestao="Verifique os filtros ou cadastre uma nova turma."
          />
        </main>
        <Footer />
      </div>
    );
  }

  /* ─────────────── render normal ─────────────── */
  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* Faixa de título (verde/esmeralda) */}
      <PageHeader title="Presenças por Turma" icon={ClipboardList} variant="esmeralda" />

      <main className="flex-1 px-2 sm:px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Painel" }, { label: "Presenças por Turma" }]} />

        <div className="space-y-6">
          {turmas.map((turma) => {
            const inicioDia = isoDia(turma.data_inicio);
            const fimDia = isoDia(turma.data_fim);

            return (
              <section
                key={turma.id}
                className="border rounded-xl bg-white dark:bg-gray-800 shadow p-4"
                aria-labelledby={`turma-${turma.id}-titulo`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2
                      id={`turma-${turma.id}-titulo`}
                      className="font-bold text-lg text-lousa dark:text-green-200"
                    >
                      {turma.nome}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                      {formatarDataBrasileira(inicioDia)} até {formatarDataBrasileira(fimDia)}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 dark:text-white rounded-full"
                    aria-label={`Status: ${turma.status || "Agendada"}`}
                  >
                    {turma.status || "Agendada"}
                  </span>
                </div>

                <div className="mt-4">
                  <button
                    className="bg-lousa text-white px-4 py-2 rounded hover:bg-green-900 transition focus:outline-none focus:ring-2 focus:ring-lousa"
                    onClick={() =>
                      setTurmaExpandidaId(turmaExpandidaId === turma.id ? null : turma.id)
                    }
                    aria-expanded={turmaExpandidaId === turma.id}
                    aria-controls={`detalhes-turma-${turma.id}`}
                  >
                    {turmaExpandidaId === turma.id ? "Recolher Detalhes" : "Ver Detalhes"}
                  </button>
                </div>

                <AnimatePresence>
                  {turmaExpandidaId === turma.id && (
                    <motion.div
                      id={`detalhes-turma-${turma.id}`}
                      className="mt-6 space-y-4"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div>
                        <h3 className="font-semibold text-gray-700 dark:text-white mb-2">Inscritos:</h3>

                        {(inscritosState?.[turma.id] || []).map((pessoa) => {
                          const usuarioIdNorm = pessoa.usuario_id ?? pessoa.id;
                          const datas = Array.isArray(pessoa.datas) ? pessoa.datas : [];

                          return (
                            <div
                              key={usuarioIdNorm}
                              className="flex flex-wrap justify-between items-center p-2 border rounded bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                            >
                              <div className="text-sm text-gray-800 dark:text-gray-200">
                                <strong>{pessoa.nome}</strong> – {pessoa.email}
                                <br />
                                CPF: {pessoa.cpf || "Não informado"}
                              </div>

                              <div className="w-full mt-3">
                                {datas.length === 0 ? (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Nenhuma data cadastrada para esta pessoa.
                                  </p>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-gray-600 dark:text-gray-300">
                                        <th className="text-left">📅 Data</th>
                                        <th className="text-left">📌 Situação</th>
                                        <th className="text-left">✔️ Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {datas.map((data) => {
                                        const dia = isoDia(data);

                                        // presença suportando ambos formatos
                                        let presente = false;
                                        if (Array.isArray(pessoa.presencas)) {
                                          presente = pessoa.presencas.some(
                                            (pp) =>
                                              isoDia(pp.data_presenca) === dia &&
                                              pp.presente === true
                                          );
                                        } else if (pessoa.presencas && typeof pessoa.presencas === "object") {
                                          presente = pessoa.presencas[dia] === true;
                                        }

                                        // status visual com base em hora local
                                        const inicioLocal = makeLocalDate(
                                          dia,
                                          turma.horario_inicio || "08:00"
                                        );
                                        const fimLocal = makeLocalDate(
                                          dia,
                                          turma.horario_fim || "17:00"
                                        );

                                        const passou60 = Date.now() >= inicioLocal.getTime() + 60 * 60 * 1000;

                                        let status = "Aguardando";
                                        let style = "bg-yellow-300 text-yellow-900";
                                        let icon = null;
                                        if (presente) {
                                          status = "Presente";
                                          style = "bg-green-500 text-white";
                                          icon = <CheckCircle size={14} />;
                                        } else if (passou60) {
                                          status = "Faltou";
                                          style = "bg-red-500 text-white";
                                          icon = <XCircle size={14} />;
                                        }

                                        // pode confirmar até 48h após o término (local)
                                        const podeConfirmar =
                                          modoadministradorPresencas &&
                                          Date.now() <= fimLocal.getTime() + 48 * 60 * 60 * 1000;

                                        const isLoading =
                                          loading &&
                                          loading.turmaId === turma.id &&
                                          loading.usuarioId === usuarioIdNorm &&
                                          loading.data === dia;

                                        return (
                                          <tr key={`${usuarioIdNorm}-${dia}`}>
                                            <td className="py-1">{formatarDataBrasileira(dia)}</td>
                                            <td>
                                              <span
                                                className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${style}`}
                                                aria-label={`Situação em ${formatarDataBrasileira(
                                                  dia
                                                )}: ${status}`}
                                              >
                                                {icon}
                                                {status}
                                              </span>
                                            </td>
                                            <td>
                                              {!presente && podeConfirmar && (
                                                <button
                                                  disabled={isLoading}
                                                  onClick={() =>
                                                    confirmarPresenca(turma.id, usuarioIdNorm, dia)
                                                  }
                                                  className={`bg-blue-700 text-white text-xs px-3 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                                    isLoading
                                                      ? "opacity-50 cursor-not-allowed"
                                                      : "hover:bg-blue-800"
                                                  }`}
                                                  aria-label={`Confirmar presença de ${pessoa.nome} em ${formatarDataBrasileira(
                                                    dia
                                                  )}`}
                                                >
                                                  {isLoading ? "Confirmando..." : "Confirmar"}
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
