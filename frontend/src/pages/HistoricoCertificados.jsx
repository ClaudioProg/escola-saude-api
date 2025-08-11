// 📁 src/pages/HistoricoCertificados.jsx
import { useEffect, useState } from "react";
import TabelaCertificados from "../components/TabelaCertificados";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";
import { apiGet, apiPost } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
    } catch (err) {
      toast.error("❌ Erro ao carregar histórico de certificados.");
      setErro("Erro ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }

  // ✅ download com token (sem depender de window.open sem header)
  const baixar = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/certificados/${id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) throw new Error("Falha no download");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      // tenta inferir um nome bacana, fallback genérico
      const nomeArquivo =
        res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ||
        `certificado_${id}.pdf`;
      a.href = url;
      a.download = nomeArquivo;
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
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Meus Certificados" }]} />
      <CabecalhoPainel titulo="📜 Histórico de Certificados" />

      <h1 className="text-2xl font-bold mb-6 text-center text-lousa dark:text-white">
        📜 Histórico de Certificados
      </h1>

      {carregando ? (
        <CarregandoSkeleton linhas={4} />
      ) : erro ? (
        <p className="text-red-500 text-center">{erro}</p>
      ) : dados.length === 0 ? (
        <NadaEncontrado mensagem="Nenhum certificado encontrado." />
      ) : (
        <TabelaCertificados dados={dados} onDownload={baixar} onRevalidar={revalidar} />
      )}
    </main>
  );
}
