// 📁 src/routes/metricasRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/metricasController");

/* ────────────────────────────────────────────────
   📊 Rotas públicas de métricas (somente APP)
──────────────────────────────────────────────── */
router.post("/contar-visita", ctrl.contarVisita);      // incrementa acessos_app
router.get("/publica", ctrl.getMetricasPublica);       // retorna acessos_app + atualizado_em

module.exports = router;