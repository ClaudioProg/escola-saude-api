import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BotaoPrimario from "../components/BotaoPrimario";
import CabecalhoPainel from "../components/CabecalhoPainel";

export default function InscritosTurma() {
  const { id } = useParams(); // ID da turma
  const token = localStorage.getItem("token");
  const [inscritos, setInscritos] = useState([]);
  const [turma, setTurma] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      setErro("ID da turma inválido.");
      toast.error("⚠️ ID da turma é inválido.");
      setCarregando(false);
      return;
    }

    async function fetchInscritos() {
      setCarregando(true);
      try {
        const [turmaRes, inscritosRes] = await Promise.all([
          fetch(`http://escola-saude-api.onrender.com/api/turmas/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`http://escola-saude-api.onrender.com/api/inscricoes/turma/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!turmaRes.ok || !inscritosRes.ok) {
          throw new Error("Erro ao buscar dados.");
        }

        const turmaData = await turmaRes.json();
        const inscritosData = await inscritosRes.json();

        setTurma(turmaData);
        setInscritos(inscritosData);
      } catch (err) {
        console.error("❌ Erro ao buscar dados da turma:", err);
        setErro("Erro ao carregar inscritos ou turma.");
        toast.error("❌ Erro ao carregar dados.");
      } finally {
        setCarregando(false);
      }
    }

    fetchInscritos();
  }, [id, token]);

  const formatarCPF = (cpf) =>
    cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

  const exportarPDF = () => {
    if (!turma) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Lista de Inscritos – ${turma.nome}`, 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Nome", "CPF", "E-mail"]],
      body: inscritos.map((i) => [
        i.nome,
        formatarCPF(i.cpf),
        i.email,
      ]),
    });

    doc.save(`inscritos_turma_${turma.id}.pdf`);
    toast.success("✅ PDF gerado com sucesso!");
  };

  if (carregando) {
    return (
      <div className="max-w-3xl mx-auto mt-12 p-6">
        <div className="animate-pulse h-8 bg-gray-200 rounded mb-6" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-200 rounded mb-3" />
        ))}
      </div>
    );
  }

  if (erro) {
    return <p className="text-center text-red-600 mt-10">{erro}</p>;
  }

  return (
    <main className="min-h-screen bg-gelo dark:bg-gray-900 px-2 py-8">
      <Breadcrumbs />
      <CabecalhoPainel perfil="administrador" saudacao={`Visualização da turma: ${turma?.nome}`} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg"
        aria-label="Lista de Inscritos da Turma"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-[#1b4332] dark:text-white">👥 Inscritos</h2>
          <BotaoPrimario onClick={exportarPDF} aria-label="Exportar lista em PDF">
            📄 Exportar PDF
          </BotaoPrimario>
        </div>

        {inscritos.length === 0 ? (
          <div className="flex flex-col items-center py-16" aria-live="polite">
            <span className="text-5xl mb-2">🗒️</span>
            <p className="text-gray-500 dark:text-gray-300 font-semibold">
              Nenhum inscrito encontrado para esta turma.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {inscritos.map((inscrito) => (
              <li
                key={inscrito.usuario_id}
                className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-2"
                tabIndex={0}
                aria-label={`Inscrito: ${inscrito.nome}`}
              >
                <span className="font-semibold text-gray-700 dark:text-white">
                  {inscrito.nome}
                </span>
                <span className="text-gray-500 dark:text-gray-300">
                  {formatarCPF(inscrito.cpf)}
                </span>
                <span className="text-gray-400 dark:text-gray-400">
                  {inscrito.email}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </main>
  );
}
