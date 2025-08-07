import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const TITULO_POR_CAMINHO = {
  "/administrador": "Painel do Administrador",
  "/instrutor": "Painel do Instrutor",
  "/avaliacao": "Painel de Avaliações",
  "/dashboard-analitico": "Painel Analítico",
  "/minhas-inscricoes": "Painel de Cursos",
  "/certificados": "Painel de Certificados",
  "/eventos": "Painel de Eventos",
  "/scanner": "Registro de Presença",
  "/perfil": "Perfil do Usuário",
  "/notificacoes": "Notificações",
  "/gestor": "Painel do Gestor", // ✅ NOVO
};

export default function CabecalhoPainel() {
  const [nome, setNome] = useState("");
  const location = useLocation();

  useEffect(() => {
    const nomeSalvo = localStorage.getItem("nome") || "";
    setNome(nomeSalvo);
  }, []);

  // Extrai o primeiro segmento do pathname para casos como /avaliar/:id
  const caminhoBase = "/" + location.pathname.split("/")[1];

  const titulo = TITULO_POR_CAMINHO[caminhoBase] || "Painel";

  return (
    <div
      className="bg-lousa text-white py-3 px-4 rounded-2xl mb-6 flex justify-between items-center"
      role="region"
      aria-label={`Cabeçalho do ${titulo}`}
    >
      <p className="font-medium">
        Seja bem-vindo(a), <span className="font-bold">{nome}</span>
      </p>
      <span className="font-bold">{titulo}</span>
    </div>
  );
}
