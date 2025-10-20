const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/solicitacoesCursoController");

router.get("/metricas", ctrl.getMetricas);

module.exports = router;
