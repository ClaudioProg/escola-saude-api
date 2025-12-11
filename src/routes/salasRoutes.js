// 📁 src/routes/salasRoutes.js
const express = require("express");
const router = express.Router();
const salasController = require("../controllers/salasController");
const auth = require("../auth/authMiddleware");

// Helper: usa o handler do controller se existir; senão, 501.
function safeHandler(fnName) {
  const fn = salasController?.[fnName];
  if (typeof fn === "function") return fn;
  return (_req, res) =>
    res.status(501).json({
      erro: `Handler '${fnName}' não implementado em salasController.`,
    });
}

// =================== Agenda ===================
router.get("/agenda-admin", auth, safeHandler("listarAgendaAdmin"));
router.get("/agenda-usuario", auth, safeHandler("listarAgendaUsuario"));

// =================== Usuário ===================
// Solicitar nova reserva
router.post("/solicitar", auth, safeHandler("solicitarReserva"));

// Editar a PRÓPRIA solicitação (apenas se status = 'pendente')
router.put("/minhas/:id", auth, safeHandler("atualizarReservaUsuario"));

// Excluir a PRÓPRIA solicitação (apenas se status = 'pendente')
router.delete("/minhas/:id", auth, safeHandler("excluirReservaUsuario"));

// =================== Admin ===================
router.post("/admin/reservas", auth, safeHandler("criarReservaAdmin"));
router.put("/admin/reservas/:id", auth, safeHandler("atualizarReservaAdmin"));
router.delete("/admin/reservas/:id", auth, safeHandler("excluirReservaAdmin"));

// ===== PDFs (Admin) =====
// Relatório mensal (todas as salas) — query: ?ano=YYYY&mes=1-12
router.get("/admin/relatorio-mensal", auth, safeHandler("pdfRelatorioMensal"));

// Cartaz do evento (paisagem) com título em até 3 linhas
router.get("/admin/cartaz/:id.pdf", auth, safeHandler("pdfCartazEvento"));

module.exports = router;
