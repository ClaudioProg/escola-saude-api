/* eslint-disable no-console */
const jwt = require("jsonwebtoken");

// 🔐 Import resiliente do DB: aceita tanto `module.exports = db` quanto `module.exports = { db }`
let db;
try {
  const dbModule = require("../db");
  db = dbModule?.db ?? dbModule ?? null;
} catch {
  db = null;
}

let warned = false; // avisa 1x em dev sobre req.usuario

/**
 * Middleware base: valida JWT e injeta req.user
 */
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
    };

    req.db = req.db ?? db;
    req.user = user;
    req.usuario = user; // compatibilidade temporária

    if (process.env.NODE_ENV !== "production" && !warned) {
      warned = true;
      console.warn(
        "[authMiddleware] Aviso: `req.usuario` está DEPRECIADO. Use `req.user`. Fornecendo ambos por compatibilidade temporária."
      );
    }

    return next();
  } catch (e) {
    console.error("🔴 JWT inválido:", e.message);
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

/**
 * Wrapper: permite apenas usuários autenticados (qualquer papel)
 */
function authAny(req, res, next) {
  return authMiddleware(req, res, next);
}

/**
 * Wrapper: exige perfil de administrador
 */
function authAdmin(req, res, next) {
  return authMiddleware(req, res, (err) => {
    if (err) return next(err);
    const perfis = req.user?.perfil ?? [];
    if (!perfis.includes("administrador")) {
      return res.status(403).json({ erro: "Acesso restrito a administradores." });
    }
    next();
  });
}

/* ───────────────── Exports resilientes ─────────────────
   - default: a própria função middleware (permite router.use(require(...)))
   - nomeados: authMiddleware, authAny, authAdmin (permite destructuring)
*/
module.exports = authMiddleware;           // default CJS
module.exports.default = authMiddleware;   // compat
module.exports.authMiddleware = authMiddleware;
module.exports.authAny = authAny;
module.exports.authAdmin = authAdmin;
