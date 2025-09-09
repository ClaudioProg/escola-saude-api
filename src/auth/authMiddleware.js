// 📁 src/auth/authMiddleware.js
const jwt = require("jsonwebtoken");
const db = require("../db");

let warned = false; // avisa 1x em dev sobre req.usuario

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return res.status(401).json({ erro: "Não autenticado." });
  }

  const token = m[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // aceita sub (padrão JWT) ou id
    const userId = decoded.sub ?? decoded.id;
    if (!userId) {
      return res.status(403).json({ erro: "Token inválido: id ausente." });
    }

    // normaliza perfil -> array
    const perfil = Array.isArray(decoded.perfil)
      ? decoded.perfil
      : typeof decoded.perfil === "string"
        ? decoded.perfil.split(",").map((p) => p.trim()).filter(Boolean)
        : [];

    const user = {
      id: String(userId),
      cpf: decoded.cpf ?? null,
      nome: decoded.nome ?? null,
      perfil,
      // anexar outros campos do token, se quiser:
      // email: decoded.email ?? null,
    };

    // disponibiliza a conexão do banco
    req.db = db;

    // novo nome (padrão)
    req.user = user;

    // compatibilidade: antigo nome
    req.usuario = req.user; // aponta para o MESMO objeto

    if (process.env.NODE_ENV !== "production" && !warned) {
      warned = true;
      console.warn(
        "[authMiddleware] Aviso: `req.usuario` está DEPRECIADO. Use `req.user`. " +
        "Fornecendo ambos por compatibilidade temporária."
      );
    }

    return next();
  } catch (e) {
    console.error("🔴 JWT inválido:", e.message);
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

module.exports = authMiddleware;
