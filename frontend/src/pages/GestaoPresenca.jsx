// 📁 src/pages/GestaoPresenca.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import { apiGet } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import Spinner from "../components/Spinner";
import ListaTurmasAdministrador from "../components/ListaTurmasAdministrador";
// ⚠️ IMPORTANTE: proteja a rota desta página com <PrivateRoute permitido={["administrador"]} />
// Aqui dentro não bloqueamos de novo, para não dar tela branca se o hook atrasar.

export default function PaginaGestaoPresencas() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erro, setErro] = useState("");

  // 🔄 Carrega eventos ao montar
  useEffect(() => {
    (async () => {
      try {
        setCarregandoEventos(true);
        setErro("");
        console.log("🔄 [GestaoPresenca] GET /api/presencas/admin/listar-tudo ...");

        const data = await apiGet("/api/presencas/admin/listar-tudo");

        // aceita diferentes formatos de resposta
        const listaEventos = Array.isArray(data?.eventos)
          ? data.eventos
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.lista)
          ? data.lista
          : [];

        console.log("✅ eventos para presenças:", listaEventos);
        setEventos(listaEventos);
      } catch (err) {
        console.error("❌ Erro ao carregar eventos:", err);
        const msg = err?.message || "Erro ao carregar eventos.";
        setErro(msg);
        toast.error(msg);
        setEventos([]);
      } finally {
        setCarregandoEventos(false);
      }
    })();
  }, []);

  async function carregarInscritos(turmaId) {
    try {
      console.log(`📥 Carregando inscritos da turma ${turmaId}...`);
      const data = await apiGet(`/api/inscricoes/turma/${turmaId}`);
      const lista = Array.isArray(data) ? data : data?.lista;

      if (!Array.isArray(lista)) {
        console.warn(`⚠️ Sem lista válida para a turma ${turmaId}`);
        toast.warn("Nenhum inscrito retornado pela API.");
        setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: [] }));
        return;
      }
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: lista }));
    } catch (err) {
      console.error("❌ Erro ao carregar inscritos:", err);
      toast.error("Erro ao carregar inscritos.");
    }
  }

  async function carregarAvaliacoes(turmaId) {
    try {
      console.log(`📥 Carregando avaliações da turma ${turmaId}...`);
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`);
      setAvaliacoesPorTurma((prev) => ({
        ...prev,
        [turmaId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      console.error("❌ Erro ao carregar avaliações:", err);
      toast.error("Erro ao carregar avaliações.");
    }
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-4 py-6 max-w-screen-lg mx-auto">
      <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de presenças" }]} />
      <CabecalhoPainel titulo="📋 Gestão de presenças" />

      {erro && <p className="text-center text-red-600 dark:text-red-400 mb-4">{erro}</p>}

      {carregandoEventos ? (
        <Spinner label="Carregando eventos..." />
      ) : (
        <ListaTurmasAdministrador
          eventos={eventos}
          hoje={new Date()}
          carregarInscritos={carregarInscritos}
          carregarAvaliacoes={carregarAvaliacoes}
          gerarRelatorioPDF={() => {}}
          inscritosPorTurma={inscritosPorTurma}
          avaliacoesPorTurma={avaliacoesPorTurma}
          navigate={navigate}
          modoadministradorPresencas
        />
      )}
    </main>
  );
}
