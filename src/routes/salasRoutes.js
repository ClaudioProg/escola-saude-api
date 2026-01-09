// 📁 src/routes/salasRoutes.js
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

const salasController = require("../controllers/salasController");

// 🔐 Auth (compatível com exports diferentes)
let auth = require("../auth/authMiddleware");
auth =
  typeof auth === "function"
    ? auth
    : auth.protect || auth.auth || auth.default || auth.middleware;

/* ────────────────────────────────────────────────────────────────
   Utils
─────────────────────────────────────────────────────────────── */
const IS_PROD = process.env.NODE_ENV === "production";
const log = (...a) => !IS_PROD && console.log("[salasRoutes]", ...a);

function requestId() {
  return `rid=${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const wrapAsync =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

// Helper: usa o handler do controller se existir; senão, 501 (premium)
function safeHandler(fnName) {
  const fn = salasController?.[fnName];

  if (typeof fn === "function") {
    return wrapAsync(fn);
  }

  return (_req, res) => {
    const rid = requestId();
    if (!IS_PROD) log(rid, `handler ausente: ${fnName}`);
    return res.status(501).json({
      ok: false,
      erro: `Handler '${fnName}' não implementado em salasController.`,
      requestId: rid,
    });
  };
}

// ✅ Valida ID numérico sem quebrar compatibilidade
function ensureIdParam(param = "id") {
  return (req, res, next) => {
    const rid = requestId();
    const raw = req.params?.[param];
    const id = Number.parseInt(String(raw), 10);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        erro: `Parâmetro '${param}' inválido.`,
        requestId: rid,
      });
    }

    // deixa disponível normalizado (opcional p/ controllers)
    req.params[param] = String(id);
    return next();
  };
}

/* ────────────────────────────────────────────────────────────────
   Rotas
─────────────────────────────────────────────────────────────── */

// =================== Agenda ===================
// Admin (visão ampla)
router.get("/agenda-admin", auth, safeHandler("listarAgendaAdmin"));
// Usuário (visão pessoal)
router.get("/agenda-usuario", auth, safeHandler("listarAgendaUsuario"));

// =================== Usuário ===================
// Solicitar nova reserva
router.post("/solicitar", auth, safeHandler("solicitarReserva"));

// Editar a PRÓPRIA solicitação (apenas se status = 'pendente')
router.put(
  "/minhas/:id",
  auth,
  ensureIdParam("id"),
  safeHandler("atualizarReservaUsuario")
);

// Excluir a PRÓPRIA solicitação (apenas se status = 'pendente')
router.delete(
  "/minhas/:id",
  auth,
  ensureIdParam("id"),
  safeHandler("excluirReservaUsuario")
);

// =================== Admin ===================
// CRUD admin de reservas
router.post("/admin/reservas", auth, safeHandler("criarReservaAdmin"));
router.put(
  "/admin/reservas/:id",
  auth,
  ensureIdParam("id"),
  safeHandler("atualizarReservaAdmin")
);
router.delete(
  "/admin/reservas/:id",
  auth,
  ensureIdParam("id"),
  safeHandler("excluirReservaAdmin")
);

// ===== PDFs (Admin) =====
// Relatório mensal (todas as salas) — query: ?ano=YYYY&mes=1-12
router.get("/admin/relatorio-mensal", auth, safeHandler("pdfRelatorioMensal"));

// Cartaz do evento (paisagem) com título em até 3 linhas
router.get("/admin/cartaz/:id.pdf", auth, ensureIdParam("id"), safeHandler("pdfCartazEvento"));

module.exports = router;
