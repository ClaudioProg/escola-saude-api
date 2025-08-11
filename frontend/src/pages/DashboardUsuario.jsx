// 📁 src/pages/DashboardUsuario.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Breadcrumbs from "../components/Breadcrumbs";
import { CalendarDays, BookOpen, FileText, Presentation } from "lucide-react";
import NadaEncontrado from "../components/NadaEncontrado";
import GraficoEventos from "../components/GraficoEventos";
import GraficoAvaliacoes from "../components/GraficoAvaliacoes";
import { apiGet } from "../services/api"; // ✅ usar serviço centralizado
import { formatarDataBrasileira } from "../utils/data"; // opcional p/ datas de notificações

export default function DashboardUsuario() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        console.log("🔑 Token (automático via apiGet). Buscando dashboard…");
        const data = await apiGet("/api/dashboard-usuario");
        console.log("📊 Dados recebidos do dashboard:", data);
        setDados(data);
      } catch (err) {
        console.error("❌ Erro ao buscar dados do dashboard:", err);
        setErro(true);
      }
    }
    carregar();
  }, []);

  if (erro) return <NadaEncontrado mensagem="Erro ao carregar o painel." />;
  if (!dados) return <NadaEncontrado mensagem="Carregando dados do painel..." />;

  return (
    <motion.div
      className="max-w-6xl mx-auto p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Breadcrumbs caminho={["Início", "Dashboard"]} />
      <h1 className="text-2xl font-bold mb-4 text-black dark:text-white">📊 Painel do Usuário</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardInfo icon={BookOpen} titulo="Eventos Concluídos" valor={dados.cursosRealizados} />
        <CardInfo icon={Presentation} titulo="Eventos como Instrutor" valor={dados.eventosinstrutor} />
        <CardInfo icon={CalendarDays} titulo="Inscrições em Andamento" valor={dados.inscricoesAtuais} />
        <CardInfo icon={CalendarDays} titulo="Próximos eventos" valor={dados.proximosEventos} />
        <CardInfo icon={FileText} titulo="Certificados Emitidos" valor={dados.certificadosEmitidos} />
        <CardInfo icon={FileText} titulo="Média de Avaliação Recebida" valor={dados.mediaAvaliacao} />
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-lousa dark:text-white mb-2">📈 Desempenho Visual</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-800 rounded-md p-4">
            <h3 className="text-center font-bold mb-2">Gráfico de Eventos</h3>
            <GraficoEventos dados={dados.graficoEventos} />
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-md p-4">
            <h3 className="text-center font-bold mb-2">Avaliações Recebidas</h3>
            <GraficoAvaliacoes dados={dados.graficoAvaliacoes} />
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-lousa dark:text-white mb-2">✨ Últimas Notificações</h2>
        {Array.isArray(dados.ultimasNotificacoes) && dados.ultimasNotificacoes.length > 0 ? (
          <ul className="space-y-2">
            {dados.ultimasNotificacoes.map((n, i) => (
              <li key={i} className="bg-white dark:bg-zinc-800 rounded-md shadow px-4 py-2 text-sm">
                <p className="font-medium">{String(n.mensagem)}</p>
                {n.data && <p className="text-gray-500 text-xs mt-1">{formatarDataBrasileira(n.data)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">Nenhuma notificação recente.</p>
        )}
      </div>
    </motion.div>
  );
}

function CardInfo({ icon: Icon, titulo, valor }) {
  return (
    <motion.div
      className="bg-white dark:bg-zinc-800 rounded-xl shadow p-4 flex flex-col items-center justify-center gap-2 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Icon className="w-8 h-8 text-lousa dark:text-white" />
      <p className="text-sm text-gray-500 dark:text-gray-300">{titulo}</p>
      <p className="text-2xl font-bold text-lousa dark:text-white">{valor}</p>
    </motion.div>
  );
}
