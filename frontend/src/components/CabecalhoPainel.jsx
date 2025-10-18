// 📁 src/components/CabecalhoPainel.jsx
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";

/* =========================
   Título por rota (fallback)
   ========================= */
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

/* =========================
   Variante (cor) por rota
   — todas com gradiente 3 cores
   ========================= */
const VARIANT_POR_CAMINHO = {
  "/administrador": "lousa",
  "/instrutor": "violet",
  "/avaliacao": "amber",
  "/dashboard-analitico": "petroleo",
  "/minhas-inscricoes": "teal",
  "/certificados": "indigo",
  "/eventos": "emerald",
  "/scanner": "orange",
  "/perfil": "sky",
  "/notificacoes": "rose",
  "/gestor": "cyan",
};

/* =========================
   Gradientes (3 cores) + texto
   ========================= */
const GRADIENTES = {
  lousa:   { bg: "from-[#0f2c1f] via-[#114b2d] to-[#166534]", text: "text-white" },
  emerald: { bg: "from-emerald-900 via-emerald-700 to-emerald-600", text: "text-white" },
  violet:  { bg: "from-violet-900 via-violet-700 to-violet-600", text: "text-white" },
  amber:   { bg: "from-amber-900 via-amber-700 to-amber-600", text: "text-black" },
  rose:    { bg: "from-rose-900 via-rose-700 to-rose-600", text: "text-white" },
  teal:    { bg: "from-teal-900 via-teal-700 to-teal-600", text: "text-white" },
  indigo:  { bg: "from-indigo-900 via-indigo-800 to-indigo-700", text: "text-white" },
  petroleo:{ bg: "from-slate-900 via-teal-900 to-slate-800", text: "text-white" },
  orange:  { bg: "from-orange-900 via-orange-800 to-orange-700", text: "text-white" },
  sky:     { bg: "from-sky-900 via-sky-700 to-sky-600", text: "text-white" },
  cyan:    { bg: "from-cyan-900 via-cyan-800 to-cyan-700", text: "text-white" },
};

function saudacaoPorHora(h) {
  // 05–11 manhã, 12–17 tarde, 18–04 noite
  if (h >= 5 && h <= 11) return "Bom dia";
  if (h >= 12 && h <= 17) return "Boa tarde";
  return "Boa noite";
}

export default function CabecalhoPainel({
  tituloOverride,
  subtitulo,              // opcional: linha abaixo do título
  saudacaoHabilitada = true,
  actions = null,
  icone = null,          // opcional: ícone/emoji à esquerda do título
  variantOverride,       // força uma cor (ex.: "amber")
  className = "",
}) {
  const location = useLocation();
  const [nome, setNome] = useState("");

  useEffect(() => {
    // Busca nome salvo (fallback p/ vazio)
    const nomeSalvo = localStorage.getItem("nome") || "";
    setNome(nomeSalvo);
  }, []);

  const caminhoBase = "/" + (location.pathname.split("/")[1] || "");
  const tituloCalc = TITULO_POR_CAMINHO[caminhoBase] || "Painel";
  const titulo = tituloOverride || tituloCalc;

  const variantKey = variantOverride || VARIANT_POR_CAMINHO[caminhoBase] || "lousa";
  const theme = GRADIENTES[variantKey] || GRADIENTES.lousa;

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
        "rounded-2xl mb-6 shadow",
        "bg-gradient-to-br", theme.bg, theme.text,
        // 🧱 tamanhos padronizados para todos os headerheros
        "px-4 md:px-6 py-5 md:py-6",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {saudacaoHabilitada && (
            <p className="text-sm/5 opacity-90 whitespace-pre-line">
              {cumprimento}
            </p>
          )}

          <div className="flex items-center gap-2">
            {icone && <span className="text-xl md:text-2xl" aria-hidden>{icone}</span>}
            <h1
              className="text-2xl md:text-3xl font-bold truncate"
              aria-live="polite"
            >
              {titulo}
            </h1>
          </div>

          {subtitulo && (
            <p className="mt-1 text-xs md:text-sm opacity-90">
              {subtitulo}
            </p>
          )}
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
  /** Linha auxiliar abaixo do título */
  subtitulo: PropTypes.node,
  /** Mostra “Bom dia/tarde/noite, Nome” (pego do localStorage.nome) */
  saudacaoHabilitada: PropTypes.bool,
  /** Espaço para botões/ações à direita (ex.: filtros, atalhos) */
  actions: PropTypes.node,
  /** Ícone opcional ao lado do título (emoji ou ReactNode) */
  icone: PropTypes.node,
  /** Força a cor/tema do header (ex.: "amber", "petroleo", "indigo"...) */
  variantOverride: PropTypes.oneOf(Object.keys(GRADIENTES)),
  className: PropTypes.string,
};
