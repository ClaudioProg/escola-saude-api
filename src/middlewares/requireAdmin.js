// 📁 src/middlewares/requireAdmin.js
module.exports = function requireAdmin(req, res, next) {
    const perfis = req.user?.perfil || [];
    if (Array.isArray(perfis) && perfis.includes("administrador")) return next();
    return res.status(403).json({ erro: "Somente administrador." });
  };