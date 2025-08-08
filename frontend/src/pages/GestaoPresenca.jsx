//GestaoPresenca
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Navigate } from "react-router-dom";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import Spinner from "../components/Spinner";
import usePerfilPermitidos from "../hooks/usePerfilPermitidos";
import ListaTurmasAdministrador from "../components/ListaTurmasAdministrador";

export default function PaginaGestaoPresencas() {
  const { temAcesso, carregando } = usePerfilPermitidos(["administrador"]);

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});

  useEffect(() => {
    async function carregarEventos() {
      try {
        console.log("🔄 Carregando eventos agrupados...");
        const token = localStorage.getItem("token");
        const res = await fetch("/api/presencas/admin/listar-tudo", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        console.log("✅ Eventos carregados:", data?.eventos);
        setEventos(data?.eventos || []);
      } catch (err) {
        console.error("❌ Erro ao carregar eventos:", err);
        toast.error("Erro ao carregar eventos.");
      }
    }

    carregarEventos();
  }, []);

  async function carregarInscritos(turmaId) {
    try {
      console.log(`📥 Carregando inscritos da turma ${turmaId}...`);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/inscricoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log(`✅ Dados brutos recebidos da turma ${turmaId}:`, data);
  
      const lista = Array.isArray(data) ? data : data.lista;
  
      if (!Array.isArray(lista)) {
        console.warn(`⚠️ Nenhuma lista válida encontrada na resposta da turma ${turmaId}`);
        toast.warn("Nenhum inscrito retornado pela API.");
        setInscritosPorTurma((prev) => ({
          ...prev,
          [turmaId]: [],
        }));
      } else {
        console.log(`✅ Inscritos da turma ${turmaId}:`, lista);
        setInscritosPorTurma((prev) => ({
          ...prev,
          [turmaId]: lista,
        }));
      }
    } catch (err) {
      console.error("❌ Erro ao carregar inscritos:", err);
      toast.error("Erro ao carregar inscritos.");
    }
  }

  async function carregarAvaliacoes(turmaId) {
    try {
      console.log(`📥 Carregando avaliações da turma ${turmaId}...`);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/avaliacoes/turma/${turmaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      console.log(`✅ Avaliações da turma ${turmaId}:`, data);
      setAvaliacoesPorTurma((prev) => ({
        ...prev,
        [turmaId]: data || [],
      }));
    } catch (err) {
      console.error("❌ Erro ao carregar avaliações:", err);
      toast.error("Erro ao carregar avaliações.");
    }
  }

  if (carregando) return <Spinner label="Carregando permissões..." />;
  if (!temAcesso) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de presenças" }]} />
      <CabecalhoPainel titulo="📋 Gestão de presenças" />

      <ListaTurmasAdministrador
        eventos={eventos}
        hoje={new Date()}
        carregarInscritos={carregarInscritos}
        carregarAvaliacoes={carregarAvaliacoes}
        gerarRelatorioPDF={() => {}}
        inscritosPorTurma={inscritosPorTurma}
        avaliacoesPorTurma={avaliacoesPorTurma}
        navigate={() => {}}
        modoadministradorPresencas={true}
      />
    </main>
  );
}
