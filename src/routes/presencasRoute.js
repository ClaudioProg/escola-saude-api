// ✅ src/routes/presencasRoute.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../auth/authMiddleware");
const db = require("../db");
const { extrairPerfis, permitirPerfis } = require("../utils/perfil");

// Controllers
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
  obterMinhasPresencas,
} = require("../controllers/presencasController");

/* ───────────────────────────────
   Helpers: info de usuário/perfil
─────────────────────────────── */
function getUser(req) {
  const u = req.usuario ?? req.user ?? {};
  const id = Number(u.id);
  const perfis = extrairPerfis({ usuario: u, user: u });
  return {
    id,
    perfis,
    isAdmin: perfis.includes("administrador"),
    isInstr: perfis.includes("instrutor"),
    isAluno: perfis.includes("usuario"),
  };
}

/* ───────────────────────────────
   Autorização contextual
─────────────────────────────── */

/** 🔐 Permite admin/instrutor OU o próprio aluno vinculado à turma */
async function ensureTurmaViewer(req, res, next) {
  try {
    const { id: userId, isAdmin, isInstr } = getUser(req);
    const turmaId = Number(req.params.turma_id || req.params.id);
    if (!turmaId) return res.status(400).json({ erro: "turma_id inválido." });

    if (isAdmin || isInstr) return next();
    if (!userId) return res.status(401).json({ erro: "Não autenticado." });

    const vinculos = await db.query(
      `
      SELECT 1
      FROM presencas p
      WHERE p.turma_id = $1 AND p.usuario_id = $2
      UNION ALL
      SELECT 1
      FROM inscricoes i
      WHERE i.turma_id = $1 AND i.usuario_id = $2
      LIMIT 1
      `,
      [turmaId, userId]
    );

    if (vinculos.rowCount > 0) return next();
    return res.status(403).json({ erro: "Acesso negado à turma." });
  } catch (e) {
    console.error("[ensureTurmaViewer]", e);
    return res.status(500).json({ erro: "Erro de autorização." });
  }
}

/** 🔎 Handler “self”: retorna só as presenças do próprio aluno */
async function detalhesTurmaSelf(req, res) {
  try {
    const { id: userId } = getUser(req);
    const turmaId = Number(req.params.turma_id);
    if (!turmaId) return res.status(400).json({ erro: "turma_id inválido." });

    const { rows } = await db.query(
      `SELECT
         p.data_presenca::date AS data,
         p.presente AS presente
       FROM presencas p
       WHERE p.turma_id = $1 AND p.usuario_id = $2
       ORDER BY p.data_presenca ASC`,
      [turmaId, userId]
    );

    return res.json({ turma_id: turmaId, minhas_presencas: rows });
  } catch (e) {
    console.error("[detalhesTurmaSelf]", e);
    return res.status(500).json({ erro: "Erro ao obter presenças." });
  }
}

/* ───────────────────────────────
   Rotas públicas
─────────────────────────────── */

// ✅ Validação simples por evento/usuario (pública)
router.get("/validar", async (req, res) => {
  try {
    const evento = req.query.evento || req.query.evento_id;
    const usuario = req.query.usuario || req.query.usuario_id;

    if (!evento || !usuario) {
      return res
        .status(400)
        .json({ presente: false, erro: "Parâmetros ausentes." });
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
    return res
      .status(500)
      .json({ presente: false, erro: "Erro ao validar presença." });
  }
});

/* ───────────────────────────────
   Rotas AUTENTICADAS
─────────────────────────────── */

// 👤 Minhas presenças (todas as turmas)
router.get("/minhas", authMiddleware, obterMinhasPresencas);
router.get("/me", authMiddleware, obterMinhasPresencas);

// Registro de presença (aluno/monitor)
router.post("/", authMiddleware, registrarPresenca);

// 🔁 Detalhes da turma (modo seguro)
router.get(
  "/turma/:turma_id/detalhes",
  authMiddleware,
  ensureTurmaViewer,
  async (req, res, next) => {
    const { isAdmin, isInstr } = getUser(req);
    if (isAdmin || isInstr) return relatorioPresencasPorTurma(req, res, next);
    return detalhesTurmaSelf(req, res);
  }
);

// Resumo de frequências (instrutor/admin)
router.get(
  "/turma/:turma_id/frequencias",
  authMiddleware,
  permitirPerfis("instrutor", "administrador"),
  listaPresencasTurma
);

// Exportar PDF (instrutor/admin)
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

module.exports = router;
