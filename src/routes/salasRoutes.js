// 📁 src/routes/salasRoutes.js
const express = require("express");
const router = express.Router();
const salasController = require("../controllers/salasController");
const auth = require("../auth/authMiddleware");

// =================== Agenda ===================
router.get("/agenda-admin", auth, salasController.listarAgendaAdmin);
router.get("/agenda-usuario", auth, salasController.listarAgendaUsuario);

// =================== Usuário ===================
// Solicitar nova reserva
router.post("/solicitar", auth, salasController.solicitarReserva);

// Editar a PRÓPRIA solicitação (apenas se status = 'pendente')
router.put(
  "/minhas/:id",
  auth,
  salasController.atualizarReservaUsuario
);

// Excluir a PRÓPRIA solicitação (apenas se status = 'pendente')
router.delete(
  "/minhas/:id",
  auth,
  salasController.excluirReservaUsuario
);

// =================== Admin ===================
router.post("/admin/reservas", auth, salasController.criarReservaAdmin);
router.put("/admin/reservas/:id", auth, salasController.atualizarReservaAdmin);
router.delete("/admin/reservas/:id", auth, salasController.excluirReservaAdmin);

module.exports = router;
