// ✅ src/pages/MinhasInscricoes.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { gerarLinkGoogleAgenda } from "../utils/gerarLinkGoogleAgenda";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";
import BotaoSecundario from "../components/BotaoSecundario";
import { apiGet, apiDelete } from "../services/api";

// ---- helpers anti-fuso: parse local yyyy-mm-dd e monta Date local com hora ----
function ymd(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null;
}
function hms(s, fallback = "00:00:00") {
  const [hh, mm, ss] = String(s || fallback).split(":").map((n) => parseInt(n, 10) || 0);
  return { hh, mm, ss };
}
function makeLocalDate(yyyy_mm_dd, time = "00:00:00") {
  const d = ymd(yyyy_mm_dd);
  const t = hms(time);
  return d ? new Date(d.y, d.mo - 1, d.d, t.hh, t.mm, t.ss, 0) : new Date(NaN);
}
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
function safeTs(dateIso, time) {
  const d = makeLocalDate(dateIso, time);
  return isValidDate(d) ? d.getTime() : 0;
}

// 🔗 Gera o link direto das STRINGS da API (mais robusto que converter pra Date antes)
function buildAgendaHref(item) {
  try {
    const inicioStr = `${item?.data_inicio ?? ""} ${item?.horario_inicio ?? "00:00"}`.trim();
    // dataFim é opcional; se vier vazia, a lib assume +90min
    const fimStr = item?.data_fim ? `${item.data_fim} ${item?.horario_fim ?? "23:59"}`.trim() : undefined;

    return gerarLinkGoogleAgenda({
      titulo: item?.titulo ?? "",
      dataInicio: inicioStr,     // passa como string — o util já converte corretamente
      dataFim: fimStr,           // opcional
      descricao: `Evento: ${item?.titulo ?? ""} organizado pela Escola da Saúde.`,
      local: item?.local || "Santos/SP",
    });
  } catch (e) {
    console.warn("[Agenda] Falha ao gerar link:", e?.message, item);
    return null;
  }
}
// -----------------------------------------------------------------------------

export default function MinhasInscricoes() {
  const [inscricoes, setInscricoes] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);

  const navigate = useNavigate();

  const usuario = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("usuario")) || {}; } catch { return {}; }
  }, []);
  const nome = usuario?.nome || "";

  useEffect(() => {
    buscarInscricoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarInscricoes() {
    setCarregando(true);
    try {
      const data = await apiGet("/api/inscricoes/minhas");
      const arr = Array.isArray(data) ? data : [];
      const ordenadas = [...arr].sort((a, b) => {
        const aEnd = safeTs(a.data_fim || a.data_inicio, a.horario_fim || a.horario_inicio || "23:59:59");
        const bEnd = safeTs(b.data_fim || b.data_inicio, b.horario_fim || b.horario_inicio || "23:59:59");
        return bEnd - aEnd;
      });
      setInscricoes(ordenadas);
      setErro("");
    } catch {
      setErro("Erro ao carregar inscrições");
      toast.error("❌ Erro ao carregar inscrições.");
    } finally {
      setCarregando(false);
    }
  }

  async function cancelarInscricao(id) {
    if (!window.confirm("Tem certeza que deseja cancelar sua inscrição?")) return;
  
    setCancelandoId(id);
    try {
      const res = await apiDelete(`/api/inscricoes/${id}`);
  
      // se seu apiDelete já lança em !ok, pode remover este if
      if (res?.ok === false) {
        const status = res.status ?? 0;
        const data = res.data ?? {};
        const msg = data?.mensagem || data?.message || res.statusText || "Falha desconhecida";
        toast.error(`❌ Erro ao cancelar inscrição (${status}). ${msg}`);
        if (status === 401) {
          toast.info("Sua sessão pode ter expirado. Abra no navegador padrão e refaça o login.");
        }
        return;
      }
  
      toast.success("✅ Inscrição cancelada com sucesso.");
      await buscarInscricoes();
    } catch (err) {
      // tenta extrair status/mensagem se vier de axios/fetch
      const status = err?.status || err?.response?.status || 0;
      const data = err?.data || err?.response?.data || {};
      const msg = data?.mensagem || data?.message || err?.message || "Sem conexão";
      toast.error(`❌ Erro ao cancelar inscrição${status ? ` (${status})` : ""}. ${msg}`);
  
      if (status === 401) {
        toast.info("Dica: ao abrir pelo WhatsApp, toque no menu ••• e escolha “Abrir no navegador”.");
      }
    } finally {
      setCancelandoId(null);
    }
  }
  

  function obterStatusEvento(dataInicioISO, dataFimISO, horarioInicio, horarioFim) {
    const inicio = makeLocalDate(dataInicioISO, horarioInicio || "00:00:00");
    const fim    = makeLocalDate(dataFimISO,    horarioFim    || "23:59:59");
    if (!isValidDate(inicio) || !isValidDate(fim)) return "Programado";
    const agora = new Date();
    if (agora < inicio) return "Programado";
    if (agora > fim)    return "Encerrado";
    return "Em andamento";
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟧 Faixa de título (família Cursos/Inscrições) */}
      <PageHeader title="Meus Cursos" icon={BookOpen} variant="laranja" />

      <main role="main" className="flex-1 px-2 sm:px-4 py-6">
        <Breadcrumbs trilha={[{ label: "Painel do Usuário" }, { label: "Meus Cursos" }]} />

               <section aria-labelledby="lista-inscricoes">
          <h3 id="lista-inscricoes" className="sr-only">Lista de inscrições do usuário</h3>

          {carregando ? (
            <div className="space-y-4 max-w-md mx-auto" role="status" aria-live="polite">
              {[...Array(4)].map((_, i) => (
                <Skeleton
                  key={i}
                  height={110}
                  className="rounded-xl"
                  baseColor="#cbd5e1"
                  highlightColor="#e2e8f0"
                />
              ))}
            </div>
          ) : erro ? (
            <p className="text-red-600 dark:text-red-400 text-center" aria-live="assertive">
              {erro}
            </p>
          ) : inscricoes.length === 0 ? (
            <NadaEncontrado
              mensagem="📭 Você ainda não está inscrito em nenhum evento."
              sugestao="Acesse a página de eventos para se inscrever."
            />
          ) : (
            <ul className="space-y-4 w-full sm:max-w-2xl mx-auto" role="list">
              <AnimatePresence>
                {inscricoes.map((item) => {
                  const status = obterStatusEvento(
                    item.data_inicio,
                    item.data_fim,
                    item.horario_inicio,
                    item.horario_fim
                  );

                  const agendaHref = buildAgendaHref(item);
                  const podeAgendar = Boolean(agendaHref);

                  const instrutores = Array.isArray(item.instrutor)
                    ? item.instrutor.map((i) => i?.nome || String(i)).filter(Boolean)
                    : String(item.instrutor || "")
                        .split(",")
                        .map((n) => n.trim())
                        .filter(Boolean);

                  const periodoFmt = [
                    formatarDataBrasileira(item.data_inicio),
                    formatarDataBrasileira(item.data_fim),
                  ]
                    .filter(Boolean)
                    .join(" até ");

                  return (
                    <motion.li
                      key={item.inscricao_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      tabIndex={0}
                      className="border p-4 rounded-xl shadow bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-lousa transition"
                      aria-label={`Inscrição em ${item.titulo}`}
                      role="listitem"
                    >
                      <h4 className="flex items-center gap-2 text-lg font-semibold text-lousa dark:text-white">
                        <BookOpen className="w-5 h-5" />
                        {item.titulo}
                      </h4>

                      <div className="text-sm italic text-gray-600 dark:text-gray-300 mt-1 flex items-center gap-1">
                        <User className="w-4 h-4" />
                        Instrutor(es):{" "}
                        {instrutores.length ? (
                          <ul className="list-disc list-inside">
                            {instrutores.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="italic text-gray-500">a definir</span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        <strong>Período:</strong><br />
                        {periodoFmt} {item.local ? `– ${item.local}` : ""}
                      </p>

                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Inscrição realizada em: {formatarDataBrasileira(item.data_inscricao)}
                      </p>

                      <p className="text-sm mt-1 font-semibold flex items-center gap-1">
                        {status === "Encerrado" && <XCircle className="w-4 h-4 text-red-600" />}
                        {status === "Programado" && <Clock className="w-4 h-4 text-yellow-700" />}
                        {status === "Em andamento" && <CheckCircle className="w-4 h-4 text-green-600" />}
                        <span
                          className={
                            status === "Encerrado"
                              ? "text-red-600"
                              : status === "Programado"
                              ? "text-yellow-700"
                              : "text-green-600"
                          }
                        >
                          Status: {status}
                        </span>
                      </p>

                      <div className="flex flex-wrap gap-3 mt-4">
                        <BotaoSecundario
                          as="a"
                          href={agendaHref || "#"}
                          onClick={(e) => {
                            if (!podeAgendar) {
                              e.preventDefault();
                              toast.info(
                                "Não foi possível gerar o link da Google Agenda para este curso."
                              );
                            }
                          }}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full sm:w-auto ${!podeAgendar ? "opacity-60" : ""}`}
                          aria-label="Adicionar curso à Google Agenda"
                          aria-disabled={!podeAgendar}
                          title={
                            podeAgendar
                              ? "Adicionar ao Google Agenda"
                              : "Datas insuficientes para agendar"
                          }
                        >
                          Adicionar ao Google Agenda
                        </BotaoSecundario>

                        <BotaoPrimario
                          className="w-full sm:w-auto"
                          aria-label="Cancelar inscrição no curso"
                          onClick={() => cancelarInscricao(item.inscricao_id)}
                          disabled={status !== "Programado" || cancelandoId === item.inscricao_id}
                        >
                          {cancelandoId === item.inscricao_id
                            ? "Cancelando..."
                            : "Cancelar Inscrição"}
                        </BotaoPrimario>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
