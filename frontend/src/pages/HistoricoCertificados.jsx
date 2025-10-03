//src/pages/historico

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Award, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import TabelaCertificados from "../components/TabelaCertificados";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
// ⛳ HeaderHero embutido nesta página (cores independentes por tela)
import Footer from "../components/Footer"; // ⬅️ rodapé institucional

import { apiGet, apiPost, apiGetFile } from "../services/api";


// HeaderHero local — evita dependência externa e permite cor única por página
function HeaderHero({ title, subtitle, icon: Icon, accent = "violet", actions = [] }) {
  // Mapa de classes fixas para evitar problemas com purge do Tailwind (sem classes dinâmicas)
  const accents = {
    violet: "bg-violet-600 dark:bg-violet-700",
    teal: "bg-teal-600 dark:bg-teal-700",
    emerald: "bg-emerald-600 dark:bg-emerald-700",
    sky: "bg-sky-600 dark:bg-sky-700",
    amber: "bg-amber-600 dark:bg-amber-700",
    rose: "bg-rose-600 dark:bg-rose-700",
    indigo: "bg-indigo-600 dark:bg-indigo-700",
  };
  const bar = accents[accent] || accents.violet;

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`w-full ${bar} text-white`}
    >
      <div className="mx-auto max-w-screen-xl px-4 py-6 text-center sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3">
          {Icon ? <Icon className="h-10 w-10" aria-hidden="true" /> : null}
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm leading-5 opacity-90 sm:text-base">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {actions && actions.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/80"
                aria-label={a["aria-label"] || a.label}
                type="button"
              >
                {a.icon ? <a.icon className="h-4 w-4" aria-hidden="true" /> : null}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.header>
  );
}

export default function HistoricoCertificados() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [revalidandoId, setRevalidandoId] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    carregarHistorico();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function carregarHistorico() {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setCarregando(true);
      setErro("");

      const json = await apiGet("/api/certificados/historico", {
        signal: abortRef.current.signal,
      });

      setDados(Array.isArray(json) ? json : []);
    } catch (e) {
      if (e?.name === "CanceledError" || e?.name === "AbortError") return; // navegação rápida
      toast.error("❌ Erro ao carregar histórico de certificados.");
      setErro("Erro ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }

  // ✅ download seguro via serviço centralizado
  const baixar = async (id) => {
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados/${id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `certificado_${id}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("❌ Não foi possível baixar o certificado.");
    }
  };

  const revalidar = async (id) => {
    // Acessível: confirmação simples (pode ser trocada por modal nativo do app)
    const confirmar = window.confirm("Deseja revalidar este certificado?");
    if (!confirmar) return;

    try {
      setRevalidandoId(id);
      await apiPost(`/api/certificados/${id}/revalidar`);
      toast.success("✅ Certificado revalidado com sucesso!");
      await carregarHistorico();
    } catch {
      toast.error("❌ Erro ao revalidar certificado.");
    } finally {
      setRevalidandoId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gelo text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* 🟣 Header Hero com ação de atualizar */}
      <HeaderHero
        title="Histórico de Certificados"
        subtitle="Acompanhe todos os certificados já emitidos e suas ações."
        icon={Award}
        accent="violet" // segue paleta ousada e acessível
        actions={[
          {
            label: "Atualizar",
            icon: RefreshCw,
            onClick: carregarHistorico,
            "aria-label": "Recarregar histórico",
          },
        ]}
      />

      <main
        role="main"
        className="mx-auto w-full max-w-screen-xl flex-1 px-3 py-6 sm:px-6 lg:px-8"
        aria-busy={carregando ? "true" : "false"}
        aria-live="polite"
      >
        {/* Estado: Carregando */}
        {carregando && (
          <div className="space-y-3" aria-label="Carregando histórico">
            <CarregandoSkeleton linhas={4} />
          </div>
        )}

        {/* Estado: Erro */}
        {!carregando && erro && (
          <div
            role="alert"
            className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-200"
          >
            <p className="font-medium">Ocorreu um problema</p>
            <p className="text-sm opacity-90">{erro}</p>
          </div>
        )}

        {/* Estado: Vazio */}
        {!carregando && !erro && dados.length === 0 && (
          <NadaEncontrado mensagem="Nenhum certificado encontrado." />
        )}

        {/* Estado: Dados */}
        {!carregando && !erro && dados.length > 0 && (
          <section aria-label="Tabela de certificados emitidos" className="mt-2">
            <TabelaCertificados
              dados={dados}
              onDownload={baixar}
              onRevalidar={revalidar}
              revalidandoId={revalidandoId}
            />
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
