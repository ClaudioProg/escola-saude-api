const express = require("express");
const router = express.Router();
const controller = require("../controllers/certificadosAvulsosController");

// Cadastrar certificado avulso
router.post("/", controller.criarCertificadoAvulso);

// Listar todos os certificados avulsos (para o frontend exibir na tabela)
router.get("/", controller.listarCertificadosAvulsos);

// Gerar PDF
router.get("/:id/pdf", controller.gerarPdfCertificado);

// Enviar por e-mail
router.post("/:id/enviar", controller.enviarPorEmail);

module.exports = router;
