// ✅ src/routes/presencaRoute.js — PREMIUM (robusto, seguro, sem duplicações, compatível)
/* eslint-disable no-console */
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.protect || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[presencasRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── DB compat ───────────────── */
const dbMod = require("../db");
const pool = dbMod.pool || dbMod.Pool || dbMod.pool?.pool || dbMod;
const query =
  dbMod.query ||
  (typeof dbMod === "function" ? dbMod : null) ||
  (pool?.query ? pool.query.bind(pool) : null);

if (typeof query !== "function") {
  console.error("[presencasRoute] DB inválido:", Object.keys(dbMod || {}));
  throw new Error("DB inválido em presencasRoute.js (query ausente)");
}

/* ───────────────── Utils/perfis ───────────────── */
const { extrairPerfis, permitirPerfis } = require("../utils/perfil");

/* ───────────────── Controllers (validação defensiva) ───────────────── */
const presencasCtrl = require("../controllers/presencaController");
const ctrl = presencasCtrl?.default || presencasCtrl;

const required = [
  "registrarPresenca",
  "confirmarPresencaViaQR",
  "confirmarViaToken",
  "confirmarPresencaSimples",
  "registrarManual",
  "confirmarHojeManual",
  "validarPresenca",
  "confirmarPresencaInstrutor",
  "listarTodasPresencasParaAdmin",
  "relatorioPresencasPorTurma",
  "listaPresencasTurma",
  "exportarPresencasPDF",
  "obterMinhasPresencas",
];
for (const fn of required) {
  if (typeof ctrl?.[fn] !== "function") {
    console.error("[presencasRoute] presencaController inválido:", fn, presencasCtrl);
    throw new Error(`presencaController inválido (função ausente: ${fn})`);
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  res.set("X-Route-Handler", tag);
  return next();
};

const handle =
  (fn) =>
  (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (err) {
      next(err);
    }
  };

function getUser(req) {
  const u = req.usuario ?? req.user ?? {};
  const id = Number(u.id);
  const perfis = extrairPerfis({ usuario: u, user: u }).map((p) => String(p).toLowerCase());
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

    if (!Number.isFinite(turmaId) || turmaId <= 0) {
      return res.status(400).json({ erro: "turma_id inválido." });
    }

    if (isAdmin || isInstr) return next();
    if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ erro: "Não autenticado." });

    const vinculos = await query(
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

    if ((vinculos?.rowCount ?? vinculos?.rows?.length ?? 0) > 0) return next();
    return res.status(403).json({ erro: "Acesso negado à turma." });
  } catch (e) {
    console.error("[ensureTurmaViewer]", e?.message || e);
    return res.status(500).json({ erro: "Erro de autorização." });
  }
}

/** 🔎 Handler “self”: retorna só as presenças do próprio aluno */
async function detalhesTurmaSelf(req, res) {
  try {
    const { id: userId } = getUser(req);
    const turmaId = Number(req.params.turma_id);

    if (!Number.isFinite(turmaId) || turmaId <= 0) return res.status(400).json({ erro: "turma_id inválido." });
    if (!Number.isFinite(userId) || userId <= 0) return res.status(401).json({ erro: "Não autenticado." });

    // date-only safe: retorna YYYY-MM-DD do banco (sem Date())
    const result = await query(
      `
      SELECT
        to_char(p.data_presenca::date,'YYYY-MM-DD') AS data,
        p.presente AS presente
      FROM presencas p
      WHERE p.turma_id = $1 AND p.usuario_id = $2
      ORDER BY p.data_presenca ASC
      `,
      [turmaId, userId]
    );

    return res.json({ turma_id: turmaId, minhas_presencas: result?.rows || [] });
  } catch (e) {
    console.error("[detalhesTurmaSelf]", e?.message || e);
    return res.status(500).json({ erro: "Erro ao obter presenças." });
  }
}

/* ───────────────────────────────
   Rotas públicas
─────────────────────────────── */

// ✅ Validação simples por evento/usuario (pública)
router.get(
  "/validar",
  routeTag("presencasRoute:GET /validar@public"),
  handle(async (req, res) => {
    try {
      const evento = req.query.evento || req.query.evento_id;
      const usuario = req.query.usuario || req.query.usuario_id;

      const eventoId = Number(evento);
      const usuarioId = Number(usuario);

      if (!Number.isFinite(eventoId) || !Number.isFinite(usuarioId)) {
        return res.status(400).json({ presente: false, erro: "Parâmetros ausentes/ inválidos." });
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
      const r = await query(sql, [usuarioId, eventoId]);
      const ok = (r?.rowCount ?? (r?.rows?.length || 0)) > 0;
      return res.json({ presente: ok });
    } catch (err) {
      console.error("❌ Erro em GET /api/presencas/validar:", err?.message || err);
      return res.status(500).json({ presente: false, erro: "Erro ao validar presença." });
    }
  })
);

/* ───────────────────────────────
   Rotas AUTENTICADAS
─────────────────────────────── */

// 👤 Minhas presenças (todas as turmas)
router.get(
  "/minhas",
  requireAuth,
  routeTag("presencasRoute:GET /minhas"),
  handle(ctrl.obterMinhasPresencas)
);
router.get(
  "/me",
  requireAuth,
  routeTag("presencasRoute:GET /me"),
  handle(ctrl.obterMinhasPresencas)
);

// Registro de presença (aluno/monitor)
router.post(
  "/",
  requireAuth,
  routeTag("presencasRoute:POST /"),
  handle(ctrl.registrarPresenca)
);

// 🔁 Detalhes da turma (modo seguro)
router.get(
  "/turma/:turma_id/detalhes",
  requireAuth,
  routeTag("presencasRoute:GET /turma/:turma_id/detalhes"),
  handle(ensureTurmaViewer),
  handle(async (req, res, next) => {
    const { isAdmin, isInstr } = getUser(req);
    if (isAdmin || isInstr) return ctrl.relatorioPresencasPorTurma(req, res, next);
    return detalhesTurmaSelf(req, res);
  })
);

// Resumo de frequências (instrutor/admin)
router.get(
  "/turma/:turma_id/frequencias",
  requireAuth,
  routeTag("presencasRoute:GET /turma/:turma_id/frequencias"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.listaPresencasTurma)
);

// Exportar PDF (instrutor/admin)
router.get(
  "/turma/:turma_id/pdf",
  requireAuth,
  routeTag("presencasRoute:GET /turma/:turma_id/pdf"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.exportarPresencasPDF)
);

/* ====== Fluxo do QR Code ======
   Mantemos TODOS os aliases por compatibilidade, mas centralizamos no mesmo handler.
*/
const qrHandler = handle(ctrl.confirmarPresencaViaQR);

router.post("/confirmarPresencaViaQR", requireAuth, routeTag("presencasRoute:POST /confirmarPresencaViaQR"), qrHandler);
router.post("/confirmar-presenca-qr", requireAuth, routeTag("presencasRoute:POST /confirmar-presenca-qr"), qrHandler);
router.post("/confirmarPresencaViaQr", requireAuth, routeTag("presencasRoute:POST /confirmarPresencaViaQr"), qrHandler);

router.post(
  "/confirmar-via-token",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar-via-token"),
  handle(ctrl.confirmarViaToken)
);

router.post("/confirmar-qr/:turma_id", requireAuth, routeTag("presencasRoute:POST /confirmar-qr/:turma_id"), qrHandler);
router.get("/confirmar-qr/:turma_id", requireAuth, routeTag("presencasRoute:GET /confirmar-qr/:turma_id"), qrHandler);

// compat: /confirmar-qr?turma_id=...
router.get(
  "/confirmar-qr",
  requireAuth,
  routeTag("presencasRoute:GET /confirmar-qr?turma_id="),
  handle((req, res, next) => {
    const id = req.query.turma_id || req.query.turmaId || req.query.id;
    if (id) req.params.turma_id = id;
    return ctrl.confirmarPresencaViaQR(req, res, next);
  })
);

router.get("/confirmar/:turma_id", requireAuth, routeTag("presencasRoute:GET /confirmar/:turma_id"), qrHandler);

/* ====== Demais operações ====== */
router.post(
  "/confirmar-simples",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar-simples"),
  handle(ctrl.confirmarPresencaSimples)
);

router.post(
  "/registrar",
  requireAuth,
  routeTag("presencasRoute:POST /registrar"),
  permitirPerfis("administrador", "instrutor"),
  handle(ctrl.registrarManual)
);

router.post(
  "/manual-confirmacao",
  requireAuth,
  routeTag("presencasRoute:POST /manual-confirmacao"),
  permitirPerfis("administrador"),
  handle(ctrl.confirmarHojeManual)
);

router.put(
  "/validar",
  requireAuth,
  routeTag("presencasRoute:PUT /validar"),
  permitirPerfis("administrador", "instrutor"),
  handle(ctrl.validarPresenca)
);

/* ====== Confirmação pelo INSTRUTOR (aliases) ====== */
const instrHandler = handle(ctrl.confirmarPresencaInstrutor);

router.post(
  "/confirmar-instrutor",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar-instrutor"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);
router.post(
  "/confirmarPresencaInstrutor",
  requireAuth,
  routeTag("presencasRoute:POST /confirmarPresencaInstrutor"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);
router.post(
  "/confirmar",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);
router.post(
  "/confirmar-manual",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar-manual"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);
router.post(
  "/confirmar_presenca",
  requireAuth,
  routeTag("presencasRoute:POST /confirmar_presenca"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

/* ====== Admin: listar tudo ====== */
router.get(
  "/admin/listar-tudo",
  requireAuth,
  routeTag("presencasRoute:GET /admin/listar-tudo"),
  permitirPerfis("administrador"),
  handle(ctrl.listarTodasPresencasParaAdmin)
);

module.exports = router;
