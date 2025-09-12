// 📁 frontend/src/hooks/usePerfilPermitidos.js
import { useEffect, useState } from "react";

/**
 * Hook para verificar se o usuário logado possui
 * pelo menos um dos perfis permitidos.
 *
 * @param {string[]} perfilPermitidos - Lista de perfis permitidos (ex.: ['administrador', 'instrutor'])
 * @returns {{ temAcesso: boolean, carregando: boolean }}
 */
export default function usePerfilPermitidos(perfilPermitidos = []) {
  const [temAcesso, setTemAcesso] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    try {
      const perfilLocal = localStorage.getItem("perfil");

      if (perfilLocal) {
        // Garante que sempre seja tratado como array em lowercase
        const perfilUsuario = perfilLocal
          .split(",")
          .map((p) => p.trim().toLowerCase());

        const acesso = perfilPermitidos.some((p) =>
          perfilUsuario.includes(p.toLowerCase())
        );

        setTemAcesso(acesso);
      } else {
        setTemAcesso(false);
      }
    } catch (error) {
      console.error(
        "%c[usePerfilPermitidos]%c Falha ao ler perfil no localStorage:",
        "color: green; font-weight: bold;",
        "color: inherit;",
        error
      );
      setTemAcesso(false);
    } finally {
      setCarregando(false);
    }
  }, [perfilPermitidos]);

  return { temAcesso, carregando };
}
