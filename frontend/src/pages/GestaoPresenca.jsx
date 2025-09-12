// 📁 src/pages/GestaoPresenca.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import { apiGet } from "../services/api";
import Breadcrumbs from "../components/Breadcrumbs";
import PageHeader from "../components/PageHeader";
import Footer from "../components/Footer";
import Spinner from "../components/Spinner";
import ListaTurmasPresenca from "../components/ListaTurmasPresenca";

export default function PaginaGestaoPresencas() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [inscritosPorTurma, setInscritosPorTurma] = useState({});
  const [avaliacoesPorTurma, setAvaliacoesPorTurma] = useState({});
  const [presencasPorTurma, setPresencasPorTurma] = useState({});
  const [carregandoEventos, setCarregandoEventos] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setCarregandoEventos(true);
        setErro("");
        const data = await apiGet("/api/presencas/admin/listar-tudo");
        const listaEventos = Array.isArray(data?.eventos)
          ? data.eventos
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.lista)
          ? data.lista
          : [];
        setEventos(listaEventos);
      } catch (err) {
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
      const data = await apiGet(`/api/inscricoes/turma/${turmaId}`);
      const lista = Array.isArray(data) ? data : data?.lista;
      setInscritosPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(lista) ? lista : [] }));
    } catch (err) {
      toast.error("Erro ao carregar inscritos.");
    }
  }

  async function carregarAvaliacoes(turmaId) {
    try {
      const data = await apiGet(`/api/avaliacoes/turma/${turmaId}`);
      setAvaliacoesPorTurma((prev) => ({ ...prev, [turmaId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      toast.error("Erro ao carregar avaliações.");
    }
  }

  // usa /detalhes e guarda {datas, usuarios}
  async function carregarPresencas(turmaId) {
    try {
      const data = await apiGet(`/api/presencas/turma/${turmaId}/detalhes`, { on403: "silent" });
      const datas = Array.isArray(data?.datas) ? data.datas : [];
      const usuarios = Array.isArray(data?.usuarios) ? data.usuarios : [];
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas, usuarios } }));
    } catch (err) {
      toast.error("Erro ao carregar presenças.");
      setPresencasPorTurma((prev) => ({ ...prev, [turmaId]: { datas: [], usuarios: [] } }));
    }
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900">
      <div className="px-2 sm:px-4 py-6 max-w-6xl mx-auto">
        <Breadcrumbs trilha={[{ label: "Painel administrador" }, { label: "Gestão de presenças" }]} />

        {/* Page header com respiro consistente */}
        <PageHeader
          title="📋 Gestão de presenças"
          subtitle="Visualize turmas, consulte inscritos e acompanhe presenças com segurança."
          className="mb-5 sm:mb-6"
        />

        {erro && (
          <p className="text-center text-red-600 dark:text-red-400 mb-4" role="alert" aria-live="assertive">
            {erro}
          </p>
        )}

        {carregandoEventos ? (
          <div className="flex justify-center py-10" aria-busy="true" aria-live="polite">
            <Spinner label="Carregando eventos..." />
          </div>
        ) : (
          <ListaTurmasPresenca
            eventos={eventos}
            hoje={new Date()}
            carregarInscritos={carregarInscritos}
            carregarAvaliacoes={carregarAvaliacoes}
            carregarPresencas={carregarPresencas}
            presencasPorTurma={presencasPorTurma}
            gerarRelatorioPDF={() => {}}
            inscritosPorTurma={inscritosPorTurma}
            avaliacoesPorTurma={avaliacoesPorTurma}
            navigate={navigate}
            modoadministradorPresencas
          />
        )}
      </div>

      <Footer />
    </main>
  );
}
