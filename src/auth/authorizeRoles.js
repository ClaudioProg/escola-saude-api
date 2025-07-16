// src/auth/authorizeRoles.js

/**
 * 🔐 Middleware para controle de acesso baseado em perfil (papéis/roles)
 * @param  {...string} rolesPermitidos - Lista de perfis autorizados (ex: 'administrador', 'instrutor')
 * @returns Middleware Express que bloqueia ou permite o acesso
 */
function authorizeRoles(...rolesPermitidos) {
  return (req, res, next) => {
    // 🚫 Verifica se há usuário autenticado com perfil
    if (!req.usuario || !req.usuario.perfil) {
      return res.status(401).json({ erro: 'Usuário não autenticado ou sem perfil' });
    }

    // 🔄 Garante que o perfil seja um array
    const perfilUsuario = Array.isArray(req.usuario.perfil)
      ? req.usuario.perfil
      : typeof req.usuario.perfil === 'string'
        ? req.usuario.perfil.split(',').map(p => p.trim())
        : [];

    // ✅ Verifica se o usuário tem pelo menos um dos papéis permitidos
    const temPermissao = rolesPermitidos.some(papel => perfilUsuario.includes(papel));

    if (!temPermissao) {
      return res.status(403).json({ erro: 'Acesso negado: permissão insuficiente' });
    }

    next(); // 🟢 Libera acesso à próxima função
  };
}

module.exports = authorizeRoles;
