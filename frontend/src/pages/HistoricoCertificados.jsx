// src/pages/HistoricoCertificados.jsx
import { useEffect, useState } from "react";
import TabelaCertificados from "../components/TabelaCertificados";
import { toast } from "react-toastify";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoUsuario from "../components/CabecalhoUsuario";
import CarregandoSkeleton from "../components/CarregandoSkeleton";
import NadaEncontrado from "../components/NadaEncontrado";

export default function HistoricoCertificados() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function fetchDados() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/certificados/historico", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Erro ao buscar dados");

        const json = await res.json();
        setDados(json);
        setErro("");
      } catch (err) {
        toast.error("❌ Erro ao carregar histórico de certificados.");
        setErro("Erro ao carregar dados.");
      } finally {
        setCarregando(false);
      }
    }

    fetchDados();
  }, []);

  const baixar = (id) => {
    window.open(`/api/certificados/${id}/download`, "_blank");
  };

  const revalidar = async (id) => {
    const confirmar = window.confirm("Deseja revalidar este certificado?");
    if (!confirmar) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/certificados/${id}/revalidar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro na revalidação.");

      toast.success("✅ Certificado revalidado com sucesso!");
      // Atualiza a lista
      const atualizados = await fetch("/api/certificados/historico", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await atualizados.json();
      setDados(json);
    } catch (err) {
      toast.error("❌ Erro ao revalidar certificado.");
    }
  };

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Meus Certificados" }]} />
      <CabecalhoUsuario titulo="📜 Histórico de Certificados" />

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
        <TabelaCertificados
          dados={dados}
          onDownload={baixar}
          onRevalidar={revalidar}
        />
      )}
    </main>
  );
}
