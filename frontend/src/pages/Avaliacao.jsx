// ✅ src/pages/Avaliacao.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  ClipboardList,
  RefreshCw,
} from "lucide-react";

import Footer from "../components/Footer";
import ModalAvaliacaoFormulario from "../components/ModalAvaliacaoFormulario";
import { apiGet } from "../services/api";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import BotaoPrimario from "../components/BotaoPrimario";

/* ───────────────── Header hero (mesmo padrão do MinhasPresencas) ───────────────── */
function HeaderHero({ onRefresh, variant = "violet", nome = "" }) {
  const variants = {
    sky: "from-sky-900 via-sky-800 to-sky-700",
    violet: "from-violet-900 via-violet-800 to-violet-700",
    amber: "from-amber-900 via-amber-800 to-amber-700",
    rose: "from-rose-900 via-rose-800 to-rose-700",
    teal: "from-teal-900 via-teal-800 to-teal-700",
    indigo: "from-indigo-900 via-indigo-800 to-indigo-700",
  };
  const grad = variants[variant] ?? variants.violet;

  return (
    <header className={`bg-gradient-to-br ${grad} text-white`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col items-center text-center gap-3">
        <div className="inline-flex items-center gap-2">
          <ClipboardList className="w-5 h-5" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Avaliações Pendentes
          </h1>
        </div>

        <p className="text-sm text-white/90">
          {nome ? `Bem-vindo(a), ${nome}. ` : ""}
          Responda as avaliações dos cursos que você concluiu.
        </p>

        {/* Botão no mesmo padrão (usa BotaoPrimario) */}
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

/* ───────────────── Página ───────────────── */
export default function Avaliacao() {
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);

  const liveRef = useRef(null);
  const atualizarBtnRef = useRef(null); // mantém para focar ao fim do refresh

  // nome do usuário para o hero
  let usuario = {};
  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {}
  const nome = usuario?.nome || "";

  useEffect(() => {
    document.title = "Avaliações | Escola da Saúde";
    carregarAvaliacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPendentes = useMemo(() => avaliacoesPendentes?.length || 0, [avaliacoesPendentes]);

  async function carregarAvaliacoes() {
    try {
      setCarregando(true);
      if (liveRef.current) liveRef.current.textContent = "Carregando avaliações…";

      const u = JSON.parse(localStorage.getItem("usuario") || "{}");
      if (!u?.id) {
        toast.error("Usuário não identificado.");
        return;
      }

      const data = await apiGet(`/api/avaliacoes/disponiveis/${u.id}`);
      const arr = Array.isArray(data) ? data : [];
      setAvaliacoesPendentes(arr);

      if (liveRef.current) {
        liveRef.current.textContent = arr.length
          ? `Encontradas ${arr.length} avaliação(ões) pendente(s).`
          : "Nenhuma avaliação pendente.";
      }
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao carregar avaliações pendentes.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar avaliações.";
    } finally {
      setCarregando(false);
      // devolve foco (se o BotaoPrimario encaminhar ref, mantém; caso contrário ignora)
      if (atualizarBtnRef.current) atualizarBtnRef.current.focus?.();
    }
  }

  function abrirModal(avaliacao) {
    setAvaliacaoSelecionada(avaliacao);
    setModalAberto(true);
  }

  function fecharModal() {
    setModalAberto(false);
    setAvaliacaoSelecionada(null);
  }

  // 🔒 date-only → pt-BR
  function fmtSeguro(valor) {
    const iso = formatarParaISO(valor);
    return iso ? formatarDataBrasileira(iso) : "Data não informada";
  }

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900">
      {/* 💜 esta página usa 'violet'; as demais mantêm sua própria cor */}
      <HeaderHero onRefresh={carregarAvaliacoes} variant="violet" nome={nome} />

      <main role="main" className="flex-1 px-4 py-6 max-w-6xl mx-auto">
        {/* feedback acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {carregando ? (
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : totalPendentes === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-center">
            <p className="text-gray-700 dark:text-gray-300">
              Nenhuma avaliação pendente no momento.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:gap-5 md:grid-cols-2">
            {avaliacoesPendentes.map((a, idx) => {
              const di = a.data_inicio ?? a.di ?? a.inicio;
              const df = a.data_fim ?? a.df ?? a.fim;

              return (
                <motion.li
                  key={a.turma_id ?? idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.03 }}
                  className="group border border-gray-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-lousa dark:text-green-100 line-clamp-2">
                      {a.nome_evento || a.titulo || a.nome}
                    </h3>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">Turma</span>
                        <span>#{a.turma_id}</span>
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        Início: <span className="font-medium">{fmtSeguro(di)}</span>
                      </span>
                      <span className="mx-2">—</span>
                      <span>
                        Fim: <span className="font-medium">{fmtSeguro(df)}</span>
                      </span>
                    </div>

                    <div className="mt-3">
                      <button
                        className="w-full sm:w-auto bg-lousa dark:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500/70 transition"
                        onClick={() => abrirModal(a)}
                        aria-label={`Avaliar ${a.nome_evento || a.titulo || a.nome}, turma ${a.turma_id}`}
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
          recarregar={carregarAvaliacoes}
        />
      </main>

      <Footer />
    </div>
  );
}
