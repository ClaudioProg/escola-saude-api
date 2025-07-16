import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "react-loading-skeleton";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { Shield } from "lucide-react";
import { formatarDataBrasileira } from "../utils/data";

import Breadcrumbs from "../components/Breadcrumbs";
import CabecalhoPainel from "../components/CabecalhoPainel";
import NadaEncontrado from "../components/NadaEncontrado";
import BotaoPrimario from "../components/BotaoPrimario";

export default function MeusCertificados() {
  const [nome, setNome] = useState("");
  const [certificados, setCertificados] = useState([]);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    if (usuario?.nome) setNome(usuario.nome);
  }, []);

  useEffect(() => {
    setCarregando(true);
    fetch("http://localhost:3000/api/certificados/usuario", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao buscar certificados");
        return res.json();
      })
      .then((data) => {
        setCertificados(data);
        setErro("");
      })
      .catch(() => {
        setErro("Erro ao carregar certificados");
        toast.error("Erro ao carregar certificados");
      })
      .finally(() => setCarregando(false));
  }, [token]);

  const certificadosFiltrados = certificados
    .filter((cert) => {
      const isinstrutor = cert.arquivo_pdf.startsWith("certificado_instrutor");
      if (filtro === "todos") return true;
      if (filtro === "usuario") return !isinstrutor;
      if (filtro === "instrutor") return isinstrutor;
      return true;
    })
    .filter((cert) => cert.titulo.toLowerCase().includes(busca.toLowerCase()));

  return (
    <main className="min-h-screen bg-gelo dark:bg-zinc-900 px-2 sm:px-4 py-6">
      <Breadcrumbs />
      <CabecalhoPainel nome={nome} perfil="Painel do Usuário" />

      <h1 className="text-2xl font-bold mb-6 text-black dark:text-white text-center">
        🧾 Meus Certificados
      </h1>

      {/* Filtro e busca */}
      <section
        className="mb-6 flex flex-col md:flex-row items-center justify-center gap-4"
        aria-label="Filtro e busca de certificados"
      >
        <div className="text-sm flex items-center">
          <label
            htmlFor="filtro-certificado"
            className="mr-2 font-medium text-lousa dark:text-white flex items-center gap-1"
          >
            <Shield size={16} /> Filtrar por:
          </label>
          <select
            id="filtro-certificado"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="px-3 py-1 border rounded focus:ring-2 focus:ring-lousa dark:bg-gray-900 dark:text-white"
            aria-label="Filtrar certificados por tipo"
          >
            <option value="todos">Todos</option>
            <option value="usuario">Somente usuario</option>
            <option value="instrutor">Somente instrutor</option>
          </select>
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar por título..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="px-3 py-1 border rounded text-sm w-full md:w-80 focus:ring-2 focus:ring-lousa dark:bg-gray-900 dark:text-white"
          aria-label="Buscar certificado por título"
        />
      </section>

      {/* Lista de certificados */}
      <section>
        {carregando ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton
                key={i}
                height={92}
                className="rounded-xl"
                baseColor="#cbd5e1"
                highlightColor="#e2e8f0"
              />
            ))}
          </div>
        ) : erro ? (
          <p className="text-red-500 text-center mb-6">{erro}</p>
        ) : certificadosFiltrados.length === 0 ? (
          <NadaEncontrado
            mensagem="Nenhum certificado encontrado para o filtro ou busca."
            sugestao="Verifique os filtros ou tente outra busca."
          />
        ) : (
          <ul className="space-y-4">
            <AnimatePresence>
              {certificadosFiltrados.map((cert) => {
                const dataInicio = new Date(cert.data_inicio);
                const dataFim = new Date(cert.data_fim);
                const isinstrutor = cert.arquivo_pdf.startsWith("certificado_instrutor");

                return (
                  <motion.li
                    key={cert.certificado_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    tabIndex={0}
                    className={`border p-4 rounded-xl shadow focus:outline-none focus:ring-2 focus:ring-lousa transition
                      ${isinstrutor ? "bg-yellow-100 border-yellow-400" : "bg-white dark:bg-gray-800"}`}
                    aria-label={
                      isinstrutor
                        ? `Certificado de instrutor: ${cert.titulo}`
                        : `Certificado de usuario: ${cert.titulo}`
                    }
                  >
                    <h3
                      className={`text-lg font-semibold ${
                        isinstrutor ? "text-yellow-900" : "text-lousa dark:text-white"
                      }`}
                    >
                      {cert.titulo}
                    </h3>
                    <p className="text-gray-600 text-sm dark:text-gray-200">
                      Turma: {cert.nome_turma}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
  Período: {formatarDataBrasileira(cert.data_inicio)} até {formatarDataBrasileira(cert.data_fim)}
</p>
                    {isinstrutor && (
                      <span className="inline-block mt-2 px-2 py-1 bg-yellow-400 text-xs font-semibold text-yellow-900 rounded">
                        📣 instrutor
                      </span>
                    )}
                    <BotaoPrimario
                      as="a"
                      href={`http://localhost:3000/api/certificados/${cert.certificado_id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3"
                      aria-label={`Baixar certificado ${cert.titulo}`}
                      title={`Clique para baixar o certificado de ${cert.titulo}`}
                    >
                      Baixar Certificado
                    </BotaoPrimario>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </main>
  );
}
