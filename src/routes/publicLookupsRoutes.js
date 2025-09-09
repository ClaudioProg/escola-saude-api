// 📁 src/routes/publicLookupsRoutes.js
const express = require("express");
const ctrl = require("../controllers/lookupsPublicController");

const router = express.Router();

// Importante: nenhuma dessas rotas deve passar por middleware de auth
router.get("/cargos", ctrl.listCargos);
router.get("/unidades", ctrl.listUnidades);
router.get("/generos", ctrl.listGeneros);
router.get("/orientacoes-sexuais", ctrl.listOrientacoesSexuais);
router.get("/cores-racas", ctrl.listCoresRacas);
router.get("/escolaridades", ctrl.listEscolaridades);
router.get("/deficiencias", ctrl.listDeficiencias);

module.exports = router;
