// ✅ src/routes/certificadosAvulsosRoute.js
const express = require("express");
const router = express.Router();

const controller = require("../controllers/certificadosAvulsosController");
const authMiddleware = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

// Todas as rotas protegidas (ajuste os perfis conforme sua política)
router.use(authMiddleware, authorizeRoles("administrador"));

// Cadastrar certificado avulso
router.post("/", controller.criarCertificadoAvulso);

// Listar todos (para a tabela do frontend)
router.get("/", controller.listarCertificadosAvulsos);

// Gerar PDF (suporta ?palestrante=1|true e ?assinatura2_id=123)
router.get("/:id/pdf", controller.gerarPdfCertificado);

// Enviar por e-mail
router.post("/:id/enviar", controller.enviarPorEmail);

module.exports = router;
