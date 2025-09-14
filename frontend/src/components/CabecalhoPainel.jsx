// 📁 src/components/CabecalhoPainel.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
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
  "/gestor": "Painel do Gestor",
};

function saudacaoPorHora(h) {
  // 05–11 manhã, 12–17 tarde, 18–04 noite
  if (h >= 5 && h <= 11) return "Bom dia";
  if (h >= 12 && h <= 17) return "Boa tarde";
  return "Boa noite";
}

export default function CabecalhoPainel({
  tituloOverride,
  saudacaoHabilitada = true,
  actions = null,
  className = "",
}) {
  const location = useLocation();
  const [nome, setNome] = useState("");

  useEffect(() => {
    // Busca nome salvo (fallback para vazio)
    const nomeSalvo = localStorage.getItem("nome") || "";
    setNome(nomeSalvo);
  }, []);

  const caminhoBase = "/" + (location.pathname.split("/")[1] || "");
  const tituloCalc = TITULO_POR_CAMINHO[caminhoBase] || "Painel";
  const titulo = tituloOverride || tituloCalc;

  const cumprimento = useMemo(() => {
    if (!saudacaoHabilitada) return null;
    const h = new Date().getHours();
    const s = saudacaoPorHora(h);
    const primeiroNome = (nome || "").trim().split(" ")[0] || "usuário(a)";
    return `${s}, ${primeiroNome}`;
  }, [nome, saudacaoHabilitada]);

  return (
    <header
      role="region"
      aria-label={`Cabeçalho do ${titulo}`}
      className={[
        "rounded-2xl mb-6",
        "bg-green-900 text-white dark:bg-green-900/90",
        "px-4 py-3 md:px-6 md:py-4 shadow",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {saudacaoHabilitada && (
            <p className="text-sm opacity-90 whitespace-pre-line">
              {cumprimento}
            </p>
          )}
          <h1
            className="text-lg md:text-xl font-bold truncate"
            aria-live="polite"
          >
            {titulo}
          </h1>
        </div>

        {actions && (
          <div className="mt-2 sm:mt-0 flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

CabecalhoPainel.propTypes = {
  /** Substitui o título detectado pela URL */
  tituloOverride: PropTypes.string,
  /** Mostra “Bom dia/tarde/noite, Nome” (pego do localStorage.nome) */
  saudacaoHabilitada: PropTypes.bool,
  /** Espaço para botões/ações à direita (ex.: filtros, atalhos) */
  actions: PropTypes.node,
  className: PropTypes.string,
};
