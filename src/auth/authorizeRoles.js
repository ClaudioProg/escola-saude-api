// src/auth/authorizeRoles.js

/**
 * 🔐 Middleware para controle de acesso baseado em perfil (papéis/roles)
 * @param  {...string} rolesPermitidos - Lista de perfis autorizados (ex: 'administrador', 'instrutor')
 * @returns Middleware Express que bloqueia ou permite o acesso
 */
function authorizeRoles(...rolesPermitidos) {
  return (req, res, next) => {

    if (!req.user || !req.user.perfil) {
      return res.status(401).json({ erro: 'Usuário não autenticado ou sem perfil' });
    }

    const perfilUsuario = Array.isArray(req.user.perfil)
      ? req.user.perfil
      : typeof req.user.perfil === 'string'
        ? req.user.perfil.split(',').map(p => p.trim())
        : [];


    const temPermissao = rolesPermitidos.some(papel => perfilUsuario.includes(papel));

    if (!temPermissao) {
      return res.status(403).json({ erro: 'Acesso negado: permissão insuficiente' });
    }

    next();
  };
}

module.exports = authorizeRoles;
