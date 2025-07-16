import { useLocation, useNavigate } from "react-router-dom";

/**
 * Componente de Breadcrumbs com suporte à navegação por URL ou trilha manual.
 *
 * @param {Array} trilha - [{ label: string, href?: string }]
 */
export default function Breadcrumbs({ trilha = null }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Segmentos a ocultar automaticamente (em fallback por URL)
  const ocultar = ["turmas"];

  // Fallback: extrai caminho da URL atual
  const caminhos = location.pathname
    .split("/")
    .filter(Boolean)
    .filter((segmento) => !ocultar.includes(segmento?.toLowerCase()));

  const formatar = (texto) =>
    texto
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  // Decide qual fonte usar: trilha manual ou caminho da URL
  const lista = trilha
    ? trilha
    : caminhos.map((segmento, index) => ({
        label: formatar(segmento),
        href: "/" + caminhos.slice(0, index + 1).join("/"),
      }));

  return (
    <nav
      aria-label="Trilha de navegação"
      className="text-sm text-gray-600 dark:text-gray-300 mb-4"
      role="navigation"
    >
      <ol className="flex flex-wrap items-center gap-2" role="list">
        {/* Link fixo para o início */}
        <li
          onClick={() => navigate("/dashboard")}
          className="cursor-pointer hover:underline text-lousa dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-lousa"
          tabIndex={0}
          role="link"
          aria-label="Ir para o início"
          onKeyDown={(e) => {
            if (["Enter", " "].includes(e.key)) navigate("/dashboard");
          }}
        >
          Início
        </li>

        {/* Itens da trilha */}
        {lista.map((item, index) => (
          <li key={index} className="flex items-center gap-2" role="listitem">
            <span className="text-gray-400">/</span>
            {index === lista.length - 1 || !item.href ? (
              <span
                className="text-gray-700 dark:text-white font-semibold"
                aria-current="page"
              >
                {item.label}
              </span>
            ) : (
              <span
                onClick={() => navigate(item.href)}
                className="cursor-pointer hover:underline text-lousa dark:text-white outline-none focus-visible:ring-2 focus-visible:ring-lousa"
                tabIndex={0}
                role="link"
                aria-label={`Ir para ${item.label}`}
                onKeyDown={(e) => {
                  if (["Enter", " "].includes(e.key)) navigate(item.href);
                }}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
