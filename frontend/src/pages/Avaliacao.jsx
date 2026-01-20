// ✅ src/pages/Avaliacao.jsx — premium++ (ministats, a11y, atalhos, dark mode)
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { ClipboardList, RefreshCw, Award, Clock3 } from "lucide-react";

import Footer from "../components/Footer";
import ModalAvaliacaoFormulario from "../components/ModalAvaliacaoFormulario";
import { apiGet } from "../services/api";
import { formatarDataBrasileira, formatarParaISO } from "../utils/dateTime";
import BotaoPrimario from "../components/BotaoPrimario";

/* ───────────────── HeaderHero (paleta exclusiva desta página) ─────────────────
   Regras:
   • Ícone e título na MESMA linha
   • Paleta fixa (3 cores) só desta página
   • Skip-link para acessibilidade
------------------------------------------------------------------------------- */
function HeaderHero({ onRefresh, nome = "" }) {
  const gradient = "from-violet-900 via-violet-800 to-indigo-700"; // 3 cores fixas desta página

  return (
    <header className={`bg-gradient-to-br ${gradient} text-white`} role="banner">
      {/* Skip-link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:block focus:bg-white/20 focus:text-white text-sm px-3 py-2"
      >
        Ir para o conteúdo
      </a>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <ClipboardList className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Avaliações Pendentes
          </h1>
        </div>

        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}Responda as avaliações dos cursos concluídos.
        </p>

        <BotaoPrimario
          onClick={onRefresh}
          variante="secundario"
          icone={<RefreshCw className="w-4 h-4" />}
          aria-label="Atualizar lista de avaliações"
        >
          Atualizar
        </BotaoPrimario>
      </div>
    </header>
  );
}

/* ───────────────── MiniStat ───────────────── */
function MiniStat({ icon: Icon, label, value, desc, bg = "bg-white", border = "border-slate-200" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl ${bg} dark:bg-zinc-900 border ${border} dark:border-zinc-800 p-4 shadow-sm`}
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{label}</span>
        {Icon ? <Icon className="w-4 h-4 text-slate-600 dark:text-zinc-300" /> : null}
      </div>
      <p className="mt-1 text-2xl font-extrabold text-lousa dark:text-white leading-tight">{value}</p>
      {desc ? <p className="text-[11px] mt-1 text-slate-600 dark:text-zinc-300">{desc}</p> : null}
    </motion.div>
  );
}

/* ───────────────── Util ───────────────── */
function seguroUsuario() {
  try { return JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { return {}; }
}
function fmtSeguroData(valor) {
  const iso = formatarParaISO(valor);
  return iso ? formatarDataBrasileira(iso) : "Data não informada";
}

/* ───────────────── Página ───────────────── */
export default function Avaliacao() {
  const [avaliacaoPendentes, setAvaliacaoPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);
  const [erro, setErro] = useState("");

  const liveRef = useRef(null);

  const usuario = seguroUsuario();
  const nome = usuario?.nome || "";

  useEffect(() => {
    document.title = "Avaliações | Escola da Saúde";
    carregarAvaliacao();
    // atalho de teclado: R para atualizar (fora de inputs)
    const keyHandler = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = ["input", "textarea", "select"].includes(tag);
      if (!isTyping && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        carregarAvaliacao();
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPendentes = useMemo(
    () => (Array.isArray(avaliacaoPendentes) ? avaliacaoPendentes.length : 0),
    [avaliacaoPendentes]
  );

  // ordena por data_fim desc (mais recente primeiro)
  const listaOrdenada = useMemo(() => {
    const arr = Array.isArray(avaliacaoPendentes) ? [...avaliacaoPendentes] : [];
    return arr.sort((a, b) => {
      const da = formatarParaISO(a.data_fim ?? a.df ?? a.fim) || "";
      const db = formatarParaISO(b.data_fim ?? b.df ?? b.fim) || "";
      return (db > da) ? 1 : (db < da) ? -1 : 0;
    });
  }, [avaliacaoPendentes]);

  const ultimoEncerrado = useMemo(() => {
    const first = listaOrdenada[0];
    if (!first) return null;
    return {
      titulo: first.nome_evento || first.titulo || first.nome || "Curso",
      data: first.data_fim ?? first.df ?? first.fim,
    };
  }, [listaOrdenada]);

  const qtdElegiveis = useMemo(() => {
    // se backend já envia uma flag `elegivel_certificado`, aproveitamos
    const arr = Array.isArray(avaliacaoPendentes) ? avaliacaoPendentes : [];
    const n = arr.filter((x) => x.elegivel_certificado === true).length;
    return n > 0 ? n : null; // oculta o card se null
  }, [avaliacaoPendentes]);

  const setLive = (msg) => { if (liveRef.current) liveRef.current.textContent = msg; };

  const carregarAvaliacao = useCallback(async () => {
    try {
      setErro("");
      setCarregando(true);
      setLive("Carregando avaliações…");

      const u = seguroUsuario();
      if (!u?.id) {
        toast.error("Usuário não identificado.");
        setAvaliacaoPendentes([]);
        setLive("Usuário não identificado.");
        return;
      }

      const data = await apiGet(`/api/avaliacao/disponiveis/${u.id}`, { on401: "silent", on403: "silent" });
      const arr = Array.isArray(data) ? data : [];
      setAvaliacaoPendentes(arr);

      setLive(arr.length
        ? `Encontradas ${arr.length} avaliação(ões) pendente(s).`
        : "Nenhuma avaliação pendente.");
    } catch (err) {
      console.error(err);
      setErro("Não foi possível carregar as avaliações.");
      toast.error("❌ Erro ao carregar avaliações pendentes.");
      setAvaliacaoPendentes([]);
      setLive("Falha ao carregar avaliações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  function abrirModal(avaliacao) {
    setAvaliacaoSelecionada(avaliacao);
    setModalAberto(true);
  }
  function fecharModal() {
    setModalAberto(false);
    setAvaliacaoSelecionada(null);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      <HeaderHero onRefresh={carregarAvaliacao} nome={nome} />

      <main id="conteudo" role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
        {/* feedback acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {/* ministats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <MiniStat
            icon={ClipboardList}
            label="Pendentes"
            value={carregando ? "…" : totalPendentes}
            desc="Avaliações aguardando resposta"
            bg="bg-white"
            border="border-slate-200"
          />
          <MiniStat
            icon={Clock3}
            label="Último curso encerrado"
            value={
              carregando
                ? "—"
                : (ultimoEncerrado ? fmtSeguroData(ultimoEncerrado.data) : "—")
            }
            desc={ultimoEncerrado ? (ultimoEncerrado.titulo || "Curso") : "Sem registros"}
            bg="bg-white"
            border="border-slate-200"
          />
          {qtdElegiveis !== null && (
            <MiniStat
              icon={Award}
              label="Elegíveis a certificado*"
              value={carregando ? "—" : qtdElegiveis}
              desc="*após envio da avaliação"
              bg="bg-white"
              border="border-slate-200"
            />
          )}
        </section>

        {/* conteúdo */}
        {carregando ? (
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-gray-200/70 dark:bg-gray-700/60 animate-pulse"
              />
            ))}
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-5">
            <p className="text-red-800 dark:text-red-200 text-sm">{erro}</p>
            <div className="mt-3">
              <BotaoPrimario
                onClick={carregarAvaliacao}
                icone={<RefreshCw className="w-4 h-4" />}
                aria-label="Tentar novamente"
              >
                Tentar novamente
              </BotaoPrimario>
            </div>
          </div>
        ) : totalPendentes === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-gray-700 dark:text-gray-300">Nenhuma avaliação pendente no momento.</p>
            <div className="mt-4 flex items-center justify-center">
              <BotaoPrimario
                onClick={carregarAvaliacao}
                variante="secundario"
                icone={<RefreshCw className="w-4 h-4" />}
              >
                Verificar novamente
              </BotaoPrimario>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {listaOrdenada.map((a, idx) => {
              const di = a.data_inicio ?? a.di ?? a.inicio;
              const df = a.data_fim ?? a.df ?? a.fim;
              const titulo = a.nome_evento || a.titulo || a.nome || "Curso";
              const turmaId = a.turma_id ?? a.turma ?? "—";

              return (
                <motion.li
                  key={`${turmaId}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                  className="group border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold text-lousa dark:text-green-100 line-clamp-2">
                      {titulo}
                    </h2>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">Turma</span>
                        <span>#{turmaId}</span>
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        Início: <span className="font-medium">{fmtSeguroData(di)}</span>
                      </span>
                      <span className="mx-2">—</span>
                      <span>
                        Fim: <span className="font-medium">{fmtSeguroData(df)}</span>
                      </span>
                    </p>

                    <div className="mt-3">
                      <button
                        className="w-full sm:w-auto bg-lousa dark:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/70 transition"
                        onClick={() => abrirModal(a)}
                        aria-label={`Avaliar ${titulo}, turma ${turmaId}`}
                      >
                        Avaliar agora
                      </button>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}

        <ModalAvaliacaoFormulario
          isOpen={modalAberto}
          onClose={fecharModal}
          evento={avaliacaoSelecionada}
          turma_id={avaliacaoSelecionada?.turma_id ?? null}
          recarregar={carregarAvaliacao}
        />
      </main>

      <Footer />
    </div>
  );
}
