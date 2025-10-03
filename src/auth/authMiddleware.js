// 📁 src/auth/authMiddleware.js
/* eslint-disable no-console */
const jwt = require("jsonwebtoken");

// 🔐 Import resiliente do DB: aceita tanto `module.exports = db` quanto `module.exports = { db }`
let db;
try {
  const dbModule = require("../db");
  db = dbModule?.db ?? dbModule ?? null;
} catch (e) {
  db = null;
}

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
      // email: decoded.email ?? null, // opcional
    };

    // ✅ injeta a instância do banco
    req.db = db;
    req.user = user;
    req.usuario = req.user; // compat

    // ───────────── Logs estratégicos (somente fora de produção) ─────────────
    if (process.env.NODE_ENV !== "production") {
      if (!warned) {
        warned = true;
        console.warn(
          "[authMiddleware] Aviso: `req.usuario` está DEPRECIADO. Use `req.user`. Fornecendo ambos por compatibilidade temporária."
        );
      }

      const caps = req.db
        ? {
            hasTx: typeof req.db.tx === "function",
            hasQuery: typeof req.db.query === "function",
            hasAny: typeof req.db.any === "function",
            hasOne: typeof req.db.one === "function",
            hasNone: typeof req.db.none === "function",
            type: req.db?.constructor?.name || typeof req.db,
            keys: Object.keys(req.db).slice(0, 12),
          }
        : { db: "null/undefined" };
        }

    return next();
  } catch (e) {
    console.error("🔴 JWT inválido:", e.message);
    return res.status(403).json({ erro: "Token inválido ou expirado." });
  }
}

module.exports = authMiddleware;
