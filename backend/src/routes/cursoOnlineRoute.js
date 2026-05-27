"use strict";

/**
 * ✅ backend/src/routes/cursoOnlineRoute.js — v2.0
 * Atualizado em: 18/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do módulo Cursos Online.
 *
 * Mount oficial:
 * - app.use("/api/curso-online", cursoOnlineRoute);
 *
 * Contratos oficiais:
 * - GET    /api/curso-online/publicado
 * - GET    /api/curso-online/:id
 * - GET    /api/curso-online/admin
 * - POST   /api/curso-online/admin
 * - PUT    /api/curso-online/admin/:id
 * - PATCH  /api/curso-online/admin/:id/status
 * - DELETE /api/curso-online/admin/:id
 *
 * Diretrizes v2.0:
 * - autenticação obrigatória em todas as rotas;
 * - administração restrita no controller;
 * - sem aliases;
 * - sem rotas legadas;
 * - sem rota plural paralela;
 * - sem resposta { erro };
 * - sem fallback silencioso;
 * - validação estrutural de imports no boot;
 * - cache no-store por se tratar de conteúdo institucional administrável.
 */

const express = require("express");

const authMiddleware = require("../auth/authMiddleware");
const cursoOnlineController = require("../controllers/cursoOnlineController");

const router = express.Router();

const {
  listarPublicados,
  obterPublicadoPorId,
  listarAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,
} = cursoOnlineController;

/* =========================================================================
   Validação estrutural de imports
=========================================================================== */

if (typeof authMiddleware !== "function") {
  throw new Error(
    "[cursoOnlineRoute] authMiddleware inválido. O export oficial de ../auth/authMiddleware deve ser uma função."
  );
}

for (const [nome, handler] of Object.entries({
  listarPublicados,
  obterPublicadoPorId,
  listarAdmin,
  criarAdmin,
  atualizarAdmin,
  alterarStatusAdmin,
  excluirAdmin,
})) {
  if (typeof handler !== "function") {
    throw new Error(
      `[cursoOnlineRoute] Controller inválido. Função ausente: ${nome}.`
    );
  }
}

/* =========================================================================
   Helpers
=========================================================================== */

function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function gerarRequestId() {
  return `curso-online-route-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function validarIdParam(req, res, next) {
  const requestId = gerarRequestId();
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "ID inválido.",
      code: "ID_INVALIDO",
      adminHint: "O parâmetro :id deve ser um número inteiro positivo.",
      details: {
        param: "id",
        value: req.params.id,
      },
      requestId,
    });
  }

  req.params.id = String(id);
  return next();
}

function validarStatusBody(req, res, next) {
  const requestId = gerarRequestId();
  const status = String(req.body?.status || "").trim();

  const statusOficiais = new Set(["rascunho", "publicado", "arquivado"]);

  if (!statusOficiais.has(status)) {
    return res.status(400).json({
      ok: false,
      data: null,
      message: "Status inválido para curso online.",
      code: "STATUS_INVALIDO",
      adminHint: "Status oficiais: rascunho, publicado ou arquivado.",
      details: {
        status: req.body?.status,
      },
      requestId,
    });
  }

  return next();
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

/* =========================================================================
   Middlewares globais
=========================================================================== */

router.use(authMiddleware);
router.use(noStore);

/* =========================================================================
   Rotas administrativas
   IMPORTANTE: precisam vir antes de /:id
=========================================================================== */

router.get("/admin", wrap(listarAdmin));
router.post("/admin", wrap(criarAdmin));
router.put("/admin/:id", validarIdParam, wrap(atualizarAdmin));
router.patch(
  "/admin/:id/status",
  validarIdParam,
  validarStatusBody,
  wrap(alterarStatusAdmin)
);
router.delete("/admin/:id", validarIdParam, wrap(excluirAdmin));

/* =========================================================================
   Rotas de usuário autenticado
=========================================================================== */

router.get("/publicado", wrap(listarPublicados));
router.get("/:id", validarIdParam, wrap(obterPublicadoPorId));

module.exports = router;