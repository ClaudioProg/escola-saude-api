/* eslint-disable no-console */
"use strict";

// ✅ src/routes/presencaRoute.js — PREMIUM V2 (robusto, seguro, sem duplicações, compatível)
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default ||
      _auth?.authMiddleware ||
      _auth?.protect ||
      _auth?.auth ||
      _auth?.requireAuth;

if (typeof requireAuth !== "function") {
  console.error("[presencasRoute] authMiddleware inválido:", _auth);
  throw new Error(
    "authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)"
  );
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
const perfilUtils = require("../utils/perfil");
const extrairPerfis =
  perfilUtils?.extrairPerfis ||
  ((ctx = {}) => {
    const raw =
      ctx?.usuario?.perfil ??
      ctx?.usuario?.perfis ??
      ctx?.user?.perfil ??
      ctx?.user?.perfis ??
      [];
    if (Array.isArray(raw)) {
      return raw.map((p) => String(p || "").trim().toLowerCase()).filter(Boolean);
    }
    return String(raw || "")
      .split(",")
      .map((p) => String(p || "").trim().toLowerCase())
      .filter(Boolean);
  });

const permitirPerfis =
  perfilUtils?.permitirPerfis ||
  ((...roles) => {
    const wanted = roles.map((r) => String(r || "").trim().toLowerCase()).filter(Boolean);
    return (req, res, next) => {
      const perfis = extrairPerfis({
        usuario: req.usuario ?? req.user,
        user: req.user ?? req.usuario,
      });

      const ok = wanted.some((role) => perfis.includes(role));
      if (!ok) {
        return res.status(403).json({ erro: "Acesso negado." });
      }
      return next();
    };
  });

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
  "listarMinhasPresencas",
  "listarTurmasDoInstrutor",
];

for (const fn of required) {
  if (typeof ctrl?.[fn] !== "function") {
    console.error("[presencasRoute] presencaController inválido:", fn, presencasCtrl);
    throw new Error(`presencaController inválido (função ausente: ${fn})`);
  }
}

/* ───────────────── Helpers premium ───────────────── */
const routeTag = (tag) => (req, res, next) => {
  try {
    res.set("X-Route-Handler", tag);
  } catch {}
  return next();
};

const noStore = (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
  } catch {}
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
  const id = Number(u.id ?? u.usuario_id ?? req.userId ?? null);
  const perfis = extrairPerfis({ usuario: u, user: u }).map((p) =>
    String(p).toLowerCase()
  );

  return {
    id,
    perfis,
    isAdmin: perfis.includes("administrador"),
    isInstr: perfis.includes("instrutor"),
    isAluno: perfis.includes("usuario"),
  };
}

function getTurmaIdFromReq(req) {
  return (
    req.params?.turma_id ||
    req.params?.id ||
    req.body?.turma_id ||
    req.body?.turmaId ||
    req.query?.turma_id ||
    req.query?.turmaId ||
    null
  );
}

function asPositiveInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

/* ───────────────────────────────
   Autorização contextual
─────────────────────────────── */

/** 🔐 Permite admin/instrutor OU o próprio aluno vinculado à turma */
async function ensureTurmaViewer(req, res, next) {
  try {
    const { id: userId, isAdmin, isInstr } = getUser(req);
    const turmaId = asPositiveInt(getTurmaIdFromReq(req));

    if (!turmaId) {
      return res.status(400).json({ erro: "turma_id inválido." });
    }

    if (isAdmin) return next();

    if (isInstr) {
      const ok = await query(
        `
        SELECT 1
        FROM turma_instrutor ti
        WHERE ti.turma_id = $1
          AND ti.instrutor_id = $2
        LIMIT 1
        `,
        [turmaId, userId]
      );

      if ((ok?.rowCount ?? ok?.rows?.length ?? 0) > 0) return next();

      return res.status(403).json({
        erro: "Acesso negado à turma (sem vínculo de instrutor).",
      });
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    const vinculos = await query(
      `
      SELECT 1
        FROM presencas p
       WHERE p.turma_id = $1
         AND p.usuario_id = $2
      UNION ALL
      SELECT 1
        FROM inscricoes i
       WHERE i.turma_id = $1
         AND i.usuario_id = $2
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
    const turmaId = asPositiveInt(req.params.turma_id);

    if (!turmaId) {
      return res.status(400).json({ erro: "turma_id inválido." });
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(401).json({ erro: "Não autenticado." });
    }

    const result = await query(
      `
      SELECT
        to_char(p.data_presenca::date,'YYYY-MM-DD') AS data,
        p.presente AS presente
      FROM presencas p
      WHERE p.turma_id = $1
        AND p.usuario_id = $2
      ORDER BY p.data_presenca ASC
      `,
      [turmaId, userId]
    );

    return res.json({
      turma_id: turmaId,
      minhas_presencas: result?.rows || [],
    });
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
        return res.status(400).json({
          presente: false,
          erro: "Parâmetros ausentes/ inválidos.",
        });
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
      return res.status(500).json({
        presente: false,
        erro: "Erro ao validar presença.",
      });
    }
  })
);

router.head(
  "/validar",
  routeTag("presencasRoute:HEAD /validar@public"),
  (_req, res) => res.sendStatus(204)
);

/* ───────────────────────────────
   Rotas AUTENTICADAS
─────────────────────────────── */

router.use(requireAuth, noStore);

// 👤 Minhas presenças (lista completa de turmas)
router.get(
  "/minhas",
  routeTag("presencasRoute:GET /minhas"),
  handle(ctrl.listarMinhasPresencas)
);

router.get(
  "/me",
  routeTag("presencasRoute:GET /me"),
  handle(ctrl.listarMinhasPresencas)
);

router.head(
  "/minhas",
  routeTag("presencasRoute:HEAD /minhas"),
  (_req, res) => res.sendStatus(204)
);

router.head(
  "/me",
  routeTag("presencasRoute:HEAD /me"),
  (_req, res) => res.sendStatus(204)
);

// ✅ Instrutor: minhas turmas como instrutor (por turma_instrutor)
router.get(
  "/instrutor/turmas",
  routeTag("presencasRoute:GET /instrutor/turmas"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.listarTurmasDoInstrutor)
);

// aliases
router.get(
  "/turmas-instrutor",
  routeTag("presencasRoute:GET /turmas-instrutor"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.listarTurmasDoInstrutor)
);

// 📊 Resumo (cards simples)
router.get(
  "/minhas/resumo",
  routeTag("presencasRoute:GET /minhas/resumo"),
  handle(ctrl.obterMinhasPresencas)
);

router.get(
  "/me/resumo",
  routeTag("presencasRoute:GET /me/resumo"),
  handle(ctrl.obterMinhasPresencas)
);

// Registro de presença
router.post(
  "/",
  routeTag("presencasRoute:POST /"),
  handle(ctrl.registrarPresenca)
);

// 🔁 Detalhes da turma (modo seguro)
router.get(
  "/turma/:turma_id/detalhes",
  routeTag("presencasRoute:GET /turma/:turma_id/detalhes"),
  handle(ensureTurmaViewer),
  handle(async (req, res, next) => {
    const { isAdmin, isInstr } = getUser(req);
    if (isAdmin || isInstr) {
      return ctrl.relatorioPresencasPorTurma(req, res, next);
    }
    return detalhesTurmaSelf(req, res);
  })
);

// Resumo de frequências (instrutor/admin)
router.get(
  "/turma/:turma_id/frequencias",
  routeTag("presencasRoute:GET /turma/:turma_id/frequencias"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.listaPresencasTurma)
);

// Exportar PDF (instrutor/admin)
router.get(
  "/turma/:turma_id/pdf",
  routeTag("presencasRoute:GET /turma/:turma_id/pdf"),
  permitirPerfis("instrutor", "administrador"),
  handle(ctrl.exportarPresencasPDF)
);

/* ====== Fluxo do QR Code ======
   Mantemos TODOS os aliases por compatibilidade, centralizando no mesmo handler.
*/
const qrHandler = handle(ctrl.confirmarPresencaViaQR);

router.post(
  "/confirmarPresencaViaQR",
  routeTag("presencasRoute:POST /confirmarPresencaViaQR"),
  qrHandler
);

router.post(
  "/confirmar-presenca-qr",
  routeTag("presencasRoute:POST /confirmar-presenca-qr"),
  qrHandler
);

router.post(
  "/confirmarPresencaViaQr",
  routeTag("presencasRoute:POST /confirmarPresencaViaQr"),
  qrHandler
);

router.post(
  "/confirmar-via-token",
  routeTag("presencasRoute:POST /confirmar-via-token"),
  handle(ctrl.confirmarViaToken)
);

router.post(
  "/confirmar-qr/:turma_id",
  routeTag("presencasRoute:POST /confirmar-qr/:turma_id"),
  qrHandler
);

router.get(
  "/confirmar-qr/:turma_id",
  routeTag("presencasRoute:GET /confirmar-qr/:turma_id"),
  qrHandler
);

// compat: /confirmar-qr?turma_id=...
router.get(
  "/confirmar-qr",
  routeTag("presencasRoute:GET /confirmar-qr?turma_id="),
  handle((req, res, next) => {
    const id = req.query.turma_id || req.query.turmaId || req.query.id;
    if (id) req.params.turma_id = String(id);
    return ctrl.confirmarPresencaViaQR(req, res, next);
  })
);

router.get(
  "/confirmar/:turma_id",
  routeTag("presencasRoute:GET /confirmar/:turma_id"),
  qrHandler
);

/* ====== Demais operações ====== */
router.post(
  "/confirmar-simples",
  routeTag("presencasRoute:POST /confirmar-simples"),
  handle(ctrl.confirmarPresencaSimples)
);

router.post(
  "/registrar",
  routeTag("presencasRoute:POST /registrar"),
  permitirPerfis("administrador", "instrutor"),
  handle(ctrl.registrarManual)
);

router.post(
  "/manual-confirmacao",
  routeTag("presencasRoute:POST /manual-confirmacao"),
  permitirPerfis("administrador"),
  handle(ctrl.confirmarHojeManual)
);

router.put(
  "/validar",
  routeTag("presencasRoute:PUT /validar"),
  permitirPerfis("administrador", "instrutor"),
  handle(ctrl.validarPresenca)
);

/* ====== Confirmação pelo INSTRUTOR (aliases) ====== */
const instrHandler = handle(ctrl.confirmarPresencaInstrutor);

router.post(
  "/confirmar-instrutor",
  routeTag("presencasRoute:POST /confirmar-instrutor"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

router.post(
  "/confirmarPresencaInstrutor",
  routeTag("presencasRoute:POST /confirmarPresencaInstrutor"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

router.post(
  "/confirmar",
  routeTag("presencasRoute:POST /confirmar"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

router.post(
  "/confirmar-manual",
  routeTag("presencasRoute:POST /confirmar-manual"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

router.post(
  "/confirmar_presenca",
  routeTag("presencasRoute:POST /confirmar_presenca"),
  permitirPerfis("instrutor", "administrador"),
  instrHandler
);

/* ====== Admin: listar tudo ====== */
router.get(
  "/admin/listar-tudo",
  routeTag("presencasRoute:GET /admin/listar-tudo"),
  permitirPerfis("administrador"),
  handle(ctrl.listarTodasPresencasParaAdmin)
);

module.exports = router;