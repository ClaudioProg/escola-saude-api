import { useEffect, useState } from "react";

/**
 * Hook para verificar se o usuário logado possui pelo menos um dos perfis permitidos.
 * @param {string[]} perfilPermitidos - Lista de perfis permitidos (ex: ['administrador', 'instrutor'])
 * @returns {object} - { temAcesso: boolean, carregando: boolean }
 */
export default function usePerfilPermitidos(perfilPermitidos = []) {
  const [temAcesso, setTemAcesso] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const perfilLocal = localStorage.getItem("perfil");

    if (perfilLocal) {
      // Garante que o perfil seja sempre tratado como array em lowercase
      const perfilUsuario = perfilLocal
        .split(",")
        .map((p) => p.trim().toLowerCase());

      // Compara os perfis permitidos (também convertidos para lowercase)
      const acesso = perfilPermitidos.some((p) =>
        perfilUsuario.includes(p.toLowerCase())
      );

      setTemAcesso(acesso);
    } else {
      setTemAcesso(false);
    }

    setCarregando(false);
  }, [perfilPermitidos]);

  return { temAcesso, carregando };
}
