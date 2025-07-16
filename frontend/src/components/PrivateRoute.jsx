import { Navigate } from "react-router-dom";

/**
 * Rota protegida que verifica autenticação e autorização por perfil.
 * @param {ReactNode} children - Componente filho renderizado se autorizado
 * @param {string[]} permitido - Perfis permitidos (opcional)
 */
export default function PrivateRoute({ children, permitido = [] }) {
  const token = localStorage.getItem("token");
  const perfilArmazenado = localStorage.getItem("perfil");

  // 🔐 Se não estiver autenticado, redireciona para login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  let perfilUsuario = [];

  try {
    const parsed = JSON.parse(perfilArmazenado);

    if (Array.isArray(parsed)) {
      perfilUsuario = parsed.map((p) => p.toLowerCase());
    } else if (typeof parsed === "string") {
      perfilUsuario = [parsed.toLowerCase()];
    }
  } catch {
    // Caso o perfil seja uma string simples e não JSON
    if (typeof perfilArmazenado === "string") {
      perfilUsuario = [perfilArmazenado.toLowerCase()];
    }
  }

  // 👥 Se há restrição de perfil, verifica autorização
  if (permitido.length > 0) {
    const permitidoNormalizado = permitido.map((p) => p.toLowerCase());
    const autorizado = perfilUsuario.some((p) =>
      permitidoNormalizado.includes(p)
    );

    if (!autorizado) {
      return <Navigate to="/eventos" replace />;
    }
  }

  // ✅ Usuário autenticado e autorizado
  return children;
}
