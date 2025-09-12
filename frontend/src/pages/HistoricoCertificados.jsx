// ✅ src/pages/HistoricoCertificados.jsx
import { useEffect, useState } from "react";
import TabelaCertificados from "../components/TabelaCertificados";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";

// 🧩 novo cabeçalho compacto + rodapé institucional
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import { Award } from "lucide-react";

import { apiGet, apiPost, apiGetFile } from "../services/api"; // ⬅️ usa helpers

export default function HistoricoCertificados() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    carregarHistorico();
  }, []);

  async function carregarHistorico() {
    try {
      setCarregando(true);
      const json = await apiGet("/api/certificados/historico");
      setDados(Array.isArray(json) ? json : []);
      setErro("");
    } catch {
      toast.error("❌ Erro ao carregar histórico de certificados.");
      setErro("Erro ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }

  // ✅ download com token, CORS e HTTPS via serviço centralizado
  const baixar = async (id) => {
    try {
      const { blob, filename } = await apiGetFile(`/api/certificados/${id}/download`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `certificado_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("❌ Não foi possível baixar o certificado.");
    }
  };

  const revalidar = async (id) => {
    const confirmar = window.confirm("Deseja revalidar este certificado?");
    if (!confirmar) return;

    try {
      await apiPost(`/api/certificados/${id}/revalidar`);
      toast.success("✅ Certificado revalidado com sucesso!");
      await carregarHistorico();
    } catch {
      toast.error("❌ Erro ao revalidar certificado.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gelo dark:bg-zinc-900 text-black dark:text-white">
      {/* 🟣 Faixa de título para Certificados */}
      <PageHeader title="Histórico de Certificados" icon={Award} variant="roxo" />

      <main role="main" className="flex-1 px-4 py-6 max-w-screen-lg mx-auto">
        <Breadcrumbs trilha={[{ label: "Meus Certificados" }, { label: "Histórico" }]} />

        {carregando ? (
          <CarregandoSkeleton linhas={4} />
        ) : erro ? (
          <p className="text-red-500 text-center" aria-live="polite">
            {erro}
          </p>
        ) : dados.length === 0 ? (
          <NadaEncontrado mensagem="Nenhum certificado encontrado." />
        ) : (
          <section aria-label="Tabela de certificados emitidos">
            <TabelaCertificados dados={dados} onDownload={baixar} onRevalidar={revalidar} />
          </section>
        )}
      </main>

      {/* Rodapé institucional */}
      <Footer />
    </div>
  );
}
