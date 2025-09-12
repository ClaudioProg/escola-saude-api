// ✅ src/pages/Avaliacao.jsx
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { formatarDataBrasileira, formatarParaISO } from "../utils/data";
import ModalAvaliacaoFormulario from "../components/ModalAvaliacaoFormulario";
import { apiGet } from "../services/api";

export default function Avaliacao() {
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] = useState(null);
  const liveRef = useRef(null);

  // nome p/ boas-vindas no header
  let usuario = {};
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch {}
  const nome = usuario?.nome || "";

  useEffect(() => {
    carregarAvaliacoes();
  }, []);

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
        liveRef.current.textContent =
          arr.length ? `Encontradas ${arr.length} avaliação(ões) pendente(s).` : "Nenhuma avaliação pendente.";
      }
    } catch (err) {
      console.error(err);
      toast.error("❌ Erro ao carregar avaliações pendentes.");
      if (liveRef.current) liveRef.current.textContent = "Falha ao carregar avaliações.";
    } finally {
      setCarregando(false);
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

  // 🔒 Formata data de forma segura
  function fmtSeguro(valor) {
    const iso = formatarParaISO(valor);
    return iso ? formatarDataBrasileira(iso) : "Data não informada";
  }

  return (
    <>
      {/* Header moderno e acessível */}
      <PageHeader
        title="📋 Avaliações Pendentes"
        subtitle="Painel de Avaliações"
        leftPill={`Seja bem-vindo(a), ${nome || "usuário(a)"}`}
        actions={
          <button
            type="button"
            onClick={carregarAvaliacoes}
            disabled={carregando}
            className={`px-3 py-1.5 text-sm rounded-md border transition
              ${carregando
                ? "opacity-60 cursor-not-allowed bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                : "bg-lousa text-white hover:bg-green-800"}`}
            aria-label="Atualizar lista de avaliações"
          >
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto p-6 mt-4 bg-white dark:bg-gray-900 rounded-xl shadow-md"
      >
        {/* feedback acessível */}
        <p ref={liveRef} className="sr-only" aria-live="polite" />

        {carregando ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : avaliacoesPendentes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300 italic">
            Nenhuma avaliação pendente no momento.
          </p>
        ) : (
          <ul className="space-y-4">
            {avaliacoesPendentes.map((a, idx) => {
              const di = a.data_inicio ?? a.di ?? a.inicio;
              const df = a.data_fim ?? a.df ?? a.fim;

              return (
                <li
                  key={idx}
                  className="border border-gray-300 dark:border-gray-700 p-4 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center md:justify-between bg-gray-50 dark:bg-gray-800"
                >
                  <div>
                    <p className="font-semibold text-lousa dark:text-green-100">
                      {a.nome_evento || a.titulo || a.nome}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Turma #{a.turma_id} — Início:{" "}
                      <span className="font-medium">{fmtSeguro(di)}</span>{" "}
                      - Fim:{" "}
                      <span className="font-medium">{fmtSeguro(df)}</span>
                    </p>
                  </div>
                  <button
                    className="mt-3 md:mt-0 bg-lousa dark:bg-green-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-green-700 transition"
                    onClick={() => abrirModal(a)}
                    aria-label={`Avaliar evento ${a.nome_evento || a.titulo || a.nome}, turma ${a.turma_id}`}
                  >
                    📋 Avaliar
                  </button>
                </li>
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
      </motion.div>

      <Footer />
    </>
  );
}
