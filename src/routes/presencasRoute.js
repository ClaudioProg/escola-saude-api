// ✅ src/routes/presencasRoute.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const db = require("../db");

const {
  registrarPresenca,
  confirmarPresencaViaQR,
  confirmarViaToken,
  confirmarPresencaSimples,
  registrarManual,
  confirmarHojeManual,
  validarPresenca,
  confirmarPresencaInstrutor,
  listarTodasPresencasParaAdmin,
  // leitura/relatórios
  relatorioPresencasPorTurma,
  listaPresencasTurma,
  exportarPresencasPDF,
  obterMinhasPresencas, // ← vamos usar este
} = require("../controllers/presencasController");

// ❌ REMOVIDO: não vamos usar um segundo controller para “minhas”
// const { listarMinhasPresencas } = require("../controllers/minhasPresencasController");

/** Middleware simples para restringir por perfil (case-insensitive, trim) */
function permitirPerfis(...perfisPermitidos) {
  const whitelist = perfisPermitidos.map((p) => String(p).trim().toLowerCase());
  return (req, res, next) => {
    const perfilRaw = req?.usuario?.perfil;
    const perfil = String(perfilRaw || "").trim().toLowerCase();
    if (!perfil || !whitelist.includes(perfil)) {
      return res.status(403).json({ erro: "Acesso negado." });
    }
    next();
  };
}

/* ----------------------------- *
 * Rotas públicas (sem auth)
 * ----------------------------- */
router.get("/validar", async (req, res) => {
  try {
    const evento = req.query.evento || req.query.evento_id;
    const usuario = req.query.usuario || req.query.usuario_id;

    if (!evento || !usuario) {
      return res.status(400).json({ presente: false, erro: "Parâmetros ausentes." });
    }

    const sql = `
      SELECT 1
      FROM presencas p
      JOIN turmas t ON t.id = p.turma_id
      WHERE p.usuario_id = $1
        AND t.evento_id = $2
        AND p.presente = TRUE
      LIMIT 1
    `;
    const { rowCount } = await db.query(sql, [usuario, evento]);
    return res.json({ presente: rowCount > 0 });
  } catch (err) {
    console.error("❌ Erro em GET /api/presencas/validar:", err);
    return res.status(500).json({ presente: false, erro: "Erro ao validar presença." });
  }
});

/* ----------------------------- *
 * Rotas AUTENTICADAS
 * ----------------------------- */

// 0) 👤 Minhas presenças
router.get("/minhas", authMiddleware, obterMinhasPresencas);
router.get("/me", authMiddleware, obterMinhasPresencas);

// 1) Registro de presença
router.post("/", authMiddleware, registrarPresenca);

// 1.1) Relatório detalhado (datas × usuários)
router.get(
  "/turma/:turma_id/detalhes",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  relatorioPresencasPorTurma
);

// 1.2) Frequências (resumo por usuário)
router.get(
  "/turma/:turma_id/frequencias",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  listaPresencasTurma
);

// 1.3) PDF
router.get(
  "/turma/:turma_id/pdf",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  exportarPresencasPDF
);

/* ====== Fluxo do QR Code ====== */

router.post("/confirmarPresencaViaQR", authMiddleware, confirmarPresencaViaQR);
router.post("/confirmar-presenca-qr", authMiddleware, confirmarPresencaViaQR);
router.post("/confirmarPresencaViaQr", authMiddleware, confirmarPresencaViaQR);
router.post("/confirmar-via-token", authMiddleware, confirmarViaToken);
router.post("/confirmar-qr/:turma_id", authMiddleware, confirmarPresencaViaQR);
router.get("/confirmar-qr/:turma_id", authMiddleware, confirmarPresencaViaQR);
router.get("/confirmar-qr", authMiddleware, (req, res, next) => {
  const id = req.query.turma_id || req.query.turmaId || req.query.id;
  if (id) req.params.turma_id = id;
  return confirmarPresencaViaQR(req, res, next);
});
router.get("/confirmar/:turma_id", authMiddleware, confirmarPresencaViaQR);

/* ====== Demais operações ====== */

router.post("/confirmar-simples", authMiddleware, confirmarPresencaSimples);

router.post(
  "/registrar",
  authMiddleware,
  permitirPerfis("administrador", "instrutor"),
  registrarManual
);

router.post(
  "/manual-confirmacao",
  authMiddleware,
  permitirPerfis("administrador"),
  confirmarHojeManual
);

router.put(
  "/validar",
  authMiddleware,
  permitirPerfis("administrador", "instrutor"),
  validarPresenca
);

/* ====== Confirmação pelo INSTRUTOR ====== */
router.post(
  "/confirmar-instrutor",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);
router.post(
  "/confirmarPresencaInstrutor",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);
router.post(
  "/confirmar",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);
router.post(
  "/confirmar-manual",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);
router.post(
  "/confirmar_presenca",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);

/* ====== Admin: listar tudo ====== */
router.get(
  "/admin/listar-tudo",
  authMiddleware,
  permitirPerfis("administrador"),
  listarTodasPresencasParaAdmin
);

// ❌ REMOVIDO (duplicado e inválido):
// router.get("/minhas", auth, ctrl.obterMinhasPresencas);

module.exports = router;
