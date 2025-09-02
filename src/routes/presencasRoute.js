// ✅ src/routes/presencasRoute.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const db = require("../db");

// Handlers do controller
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
} = require("../controllers/presencasController");

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

/* -----------------------------
 * Rotas públicas (sem auth)
 * -----------------------------
 * Usado por /validar-certificado.html:
 * GET /api/presencas/validar?evento=ID&usuario=ID
 * -> { presente: true/false }
 */
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

/* -----------------------------
 * Rotas AUTENTICADAS
 * ----------------------------- */

// 1) Registro de presença (usuário; requer data válida do evento)
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

// 1.3) PDF de presenças
router.get(
  "/turma/:turma_id/pdf",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  exportarPresencasPDF
);

/* ====== Fluxo do QR Code ====== */

// POST com body { turma_id } — usado pela página /presenca/:turma_id
router.post("/confirmarPresencaViaQR", authMiddleware, confirmarPresencaViaQR);

// Fluxo seguro por token assinado (opcional)
router.post("/confirmar-via-token", authMiddleware, confirmarViaToken);

// Aliases de compatibilidade (legado por params)
router.post("/confirmar-qr/:turma_id", authMiddleware, confirmarPresencaViaQR);
router.get("/confirmar-qr/:turma_id", authMiddleware, confirmarPresencaViaQR); // legado GET
router.get("/confirmar/:turma_id", authMiddleware, confirmarPresencaViaQR);    // legado GET

/* ====== Demais operações ====== */

// 3) Confirmação simples (sem QR; aceita aaaa-mm-dd ou dd/mm/aaaa)
router.post("/confirmar-simples", authMiddleware, confirmarPresencaSimples);

// 4) Registro manual (admin/instrutor)
router.post(
  "/registrar",
  authMiddleware,
  permitirPerfis("administrador", "instrutor"),
  registrarManual
);

// 5) Confirmar manualmente presença no dia atual (admin)
router.post(
  "/manual-confirmacao",
  authMiddleware,
  permitirPerfis("administrador"),
  confirmarHojeManual
);

// 6) Validar presença (admin/instrutor)
router.put(
  "/validar",
  authMiddleware,
  permitirPerfis("administrador", "instrutor"),
  validarPresenca
);

/* ====== Confirmação pelo INSTRUTOR ======
 * 👉 Esta é a rota que o front está chamando primeiro.
 * Mantemos a tua rota original "confirmar-instrutor"
 * e adicionamos aliases compatíveis com camelCase.
 */

// Rota original (hífens)
router.post(
  "/confirmar-instrutor",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);

// Alias camelCase pedido pelo front: /api/presencas/confirmarPresencaInstrutor
router.post(
  "/confirmarPresencaInstrutor",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  confirmarPresencaInstrutor
);

// (Opcional) Outros aliases usados pelo fallback do front:
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

module.exports = router;
