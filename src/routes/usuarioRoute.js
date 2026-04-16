// ✅ src/routes/usuarioRoute.js — PREMIUM/UNIFICADO (singular + compat, sem auth público duplicado)
/* eslint-disable no-console */
"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const router = express.Router();

/* ───────────────── Controllers ───────────────── */
const usuarioController = require("../controllers/usuarioController");

/* ───────────────── Auth resiliente ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function"
    ? _auth
    : _auth?.default || _auth?.authMiddleware || _auth?.protect || _auth?.auth;

if (typeof requireAuth !== "function") {
  console.error("[usuarioRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

/* ───────────────── Helpers premium ───────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  return next();
}

function toPerfisArray(value) {
  if (!value) return [];

  const arr = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [...new Set(arr.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
}

function buildRouteLog(req, extra = {}) {
  return {
    metodo: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    userId: req.user?.id ?? null,
    perfilUsuarioLogado: req.user?.perfil ?? null,
    ...extra,
  };
}

function buildEtag(data) {
  const digest = crypto
    .createHash("sha1")
    .update(JSON.stringify(data))
    .digest("base64");

  return `"usr-${digest}"`;
}

function validarId(req, res, next) {
  const { id } = req.params;

  if (!/^\d+$/.test(String(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  req.params.id = String(n);
  return next();
}

function registerIf(fn, registrar, rotaDescrita) {
  if (typeof fn === "function") {
    registrar();
    return;
  }

  console.warn(`⚠️ [usuarioRoute] rota não registrada (${rotaDescrita}): handler ausente.`);
}

function requireAdmin(req, res, next) {
  const perfis = toPerfisArray(req.user?.perfil);
  const isAdmin = perfis.includes("administrador") || perfis.includes("admin");

  if (!isAdmin) {
    console.warn(
      "[usuarioRoute.requireAdmin] acesso negado",
      buildRouteLog(req, {
        perfilBruto: req.user?.perfil ?? null,
        perfisNormalizados: perfis,
      })
    );

    return res.status(403).json({ erro: "Acesso negado." });
  }

  return next();
}

function etagResponse(handler) {
  return asyncHandler(async (req, res) => {
    const data = await handler(req, res, { internal: true, preview: false });
    if (!data || res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    return res.status(200).json({
      ok: true,
      gerado_em: new Date().toISOString(),
      data,
    });
  });
}

function etagHeadResponse(handler) {
  return asyncHandler(async (req, res) => {
    const preview = await handler(req, res, { internal: true, preview: true });
    if (!preview || res.headersSent) {
      return res.status(204).end();
    }

    const etag = buildEtag(preview);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");

    return res.status(200).end();
  });
}

/* ─────────────────────────────────────────────────────────────
   🔒 Tudo aqui exige autenticação
   Obs.: login/cadastro/recuperação saíram deste router
────────────────────────────────────────────────────────────── */
router.use(requireAuth, authLimiter, noStore);

/* ─────────────────────────────────────────────────────────────
   SELF / SHARED
────────────────────────────────────────────────────────────── */

// 👤 Assinatura do usuário autenticado
registerIf(
  usuarioController?.obterAssinatura,
  function registrarRotaAssinatura() {
    router.get(
      "/assinatura",
      routeTag("usuarioRoute:GET /assinatura"),
      asyncHandler(usuarioController.obterAssinatura)
    );
  },
  "GET /usuario/assinatura"
);

// 🔎 Busca/autocomplete
registerIf(
  usuarioController?.buscar,
  function registrarRotaBuscar() {
    router.get(
      "/buscar",
      routeTag("usuarioRoute:GET /buscar"),
      asyncHandler(usuarioController.buscar)
    );
  },
  "GET /usuario/buscar"
);

// 👤 Obter usuário por ID (admin ou próprio, regra no controller)
registerIf(
  usuarioController?.obterPorId,
  function registrarRotaObterPorId() {
    router.get(
      "/:id(\\d+)",
      routeTag("usuarioRoute:GET /:id"),
      validarId,
      asyncHandler(usuarioController.obterPorId)
    );
  },
  "GET /usuario/:id"
);

// 🔄 Atualização básica/admin por ID
registerIf(
  usuarioController?.atualizar,
  function registrarRotaAtualizar() {
    router.patch(
      "/:id(\\d+)",
      routeTag("usuarioRoute:PATCH /:id"),
      validarId,
      asyncHandler(usuarioController.atualizar)
    );

    router.put(
      "/:id(\\d+)",
      routeTag("usuarioRoute:PUT /:id"),
      validarId,
      asyncHandler(usuarioController.atualizar)
    );
  },
  "PATCH/PUT /usuario/:id"
);

// 🧩 Atualização de perfil completo do próprio usuário
registerIf(
  usuarioController?.atualizarPerfilCompleto,
  function registrarRotaAtualizarPerfilCompleto() {
    router.put(
      "/:id(\\d+)/perfil-completo",
      routeTag("usuarioRoute:PUT /:id/perfil-completo"),
      validarId,
      asyncHandler(usuarioController.atualizarPerfilCompleto)
    );

    router.patch(
      "/:id(\\d+)/perfil-completo",
      routeTag("usuarioRoute:PATCH /:id/perfil-completo"),
      validarId,
      asyncHandler(usuarioController.atualizarPerfilCompleto)
    );
  },
  "PATCH/PUT /usuario/:id/perfil-completo"
);

// 📝 Atualização básica pública/self
registerIf(
  usuarioController?.atualizarBasico,
  function registrarRotaAtualizarBasico() {
    router.put(
      "/:id(\\d+)/basico",
      routeTag("usuarioRoute:PUT /:id/basico"),
      validarId,
      asyncHandler(usuarioController.atualizarBasico)
    );

    router.patch(
      "/:id(\\d+)/basico",
      routeTag("usuarioRoute:PATCH /:id/basico"),
      validarId,
      asyncHandler(usuarioController.atualizarBasico)
    );
  },
  "PATCH/PUT /usuario/:id/basico"
);

/* ─────────────────────────────────────────────────────────────
   🔐 ADMIN
────────────────────────────────────────────────────────────── */

// 👥 Listar todos os usuários
registerIf(
  usuarioController?.listar,
  function registrarRotaListar() {
    router.get(
      "/",
      routeTag("usuarioRoute:GET /"),
      requireAdmin,
      adminLimiter,
      asyncHandler(usuarioController.listar)
    );
  },
  "GET /usuario"
);

// 👨‍🏫 Listar instrutores
const listarInstrutoresHandler =
  usuarioController?.listarInstrutor || usuarioController?.listarInstrutores;

registerIf(
  listarInstrutoresHandler,
  function registrarRotaInstrutores() {
    router.get(
      "/instrutor",
      routeTag("usuarioRoute:GET /instrutor"),
      requireAdmin,
      adminLimiter,
      asyncHandler(listarInstrutoresHandler)
    );

    router.get(
      "/instrutores",
      routeTag("usuarioRoute:GET /instrutores"),
      requireAdmin,
      adminLimiter,
      asyncHandler(listarInstrutoresHandler)
    );
  },
  "GET /usuario/instrutor"
);

// 👨‍⚖️ Listar avaliadores elegíveis
const listarAvaliadoresHandler =
  usuarioController?.listarAvaliador || usuarioController?.listarAvaliadoresElegiveis;

registerIf(
  listarAvaliadoresHandler,
  function registrarRotaAvaliadores() {
    router.get(
      "/avaliador",
      routeTag("usuarioRoute:GET /avaliador"),
      requireAdmin,
      adminLimiter,
      asyncHandler(listarAvaliadoresHandler)
    );

    router.get(
      "/avaliadores",
      routeTag("usuarioRoute:GET /avaliadores"),
      requireAdmin,
      adminLimiter,
      asyncHandler(listarAvaliadoresHandler)
    );
  },
  "GET /usuario/avaliador"
);

// 📊 Resumo do usuário
registerIf(
  usuarioController?.obterResumo,
  function registrarRotaResumo() {
    router.get(
      "/:id(\\d+)/resumo",
      routeTag("usuarioRoute:GET /:id/resumo"),
      requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(usuarioController.obterResumo)
    );
  },
  "GET /usuario/:id/resumo"
);

// 📝 Atualizar perfil por admin
const atualizarPerfilHandler =
  usuarioController?.atualizarPerfil || usuarioController?.atualizarPerfilUsuario;

registerIf(
  atualizarPerfilHandler,
  function registrarRotaAtualizarPerfil() {
    router.patch(
      "/:id(\\d+)/perfil",
      routeTag("usuarioRoute:PATCH /:id/perfil"),
      requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(atualizarPerfilHandler)
    );

    router.put(
      "/:id(\\d+)/perfil",
      routeTag("usuarioRoute:PUT /:id/perfil"),
      requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(atualizarPerfilHandler)
    );
  },
  "PATCH/PUT /usuario/:id/perfil"
);

// ❌ Excluir usuário
registerIf(
  usuarioController?.excluir,
  function registrarRotaExcluir() {
    router.delete(
      "/:id(\\d+)",
      routeTag("usuarioRoute:DELETE /:id"),
      requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(usuarioController.excluir)
    );
  },
  "DELETE /usuario/:id"
);

/* ─────────────────────────────────────────────────────────────
   📈 Estatísticas
────────────────────────────────────────────────────────────── */
registerIf(
  usuarioController?.obterEstatistica,
  function registrarRotaEstatisticas() {
    router.get(
      "/estatisticas",
      routeTag("usuarioRoute:GET /estatisticas"),
      requireAdmin,
      statsLimiter,
      etagResponse(usuarioController.obterEstatistica)
    );

    router.head(
      "/estatisticas",
      routeTag("usuarioRoute:HEAD /estatisticas"),
      requireAdmin,
      statsLimiter,
      etagHeadResponse(usuarioController.obterEstatistica)
    );
  },
  "GET/HEAD /usuario/estatisticas"
);

registerIf(
  usuarioController?.obterEstatisticaDetalhada,
  function registrarRotaEstatisticasDetalhadas() {
    router.get(
      "/estatisticas/detalhes",
      routeTag("usuarioRoute:GET /estatisticas/detalhes"),
      requireAdmin,
      statsLimiter,
      asyncHandler(async (req, res) => {
        const data = await usuarioController.obterEstatisticaDetalhada(req, res);
        if (!data || res.headersSent) return;

        const etag = buildEtag(data);
        res.setHeader("ETag", etag);
        res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");

        if (req.headers["if-none-match"] === etag) {
          return res.status(304).end();
        }

        return res.status(200).json({
          ok: true,
          gerado_em: new Date().toISOString(),
          data,
        });
      })
    );
  },
  "GET /usuario/estatisticas/detalhes"
);

/* ─────────────────────────────────────────────────────────────
   ♻️ Aliases retrocompatíveis úteis
────────────────────────────────────────────────────────────── */

// aliases de estatística
registerIf(
  usuarioController?.obterEstatistica,
  function registrarAliasEstatisticas() {
    router.get(
      "/usuarios/estatisticas",
      routeTag("usuarioRoute:GET /usuarios/estatisticas"),
      requireAdmin,
      statsLimiter,
      etagResponse(usuarioController.obterEstatistica)
    );

    router.head(
      "/usuarios/estatisticas",
      routeTag("usuarioRoute:HEAD /usuarios/estatisticas"),
      requireAdmin,
      statsLimiter,
      etagHeadResponse(usuarioController.obterEstatistica)
    );
  },
  "GET/HEAD /usuario/usuarios/estatisticas"
);

// alias de detalhe
registerIf(
  usuarioController?.obter,
  function registrarAliasObter() {
    router.get(
      "/buscar/:id(\\d+)",
      routeTag("usuarioRoute:GET /buscar/:id"),
      validarId,
      asyncHandler(usuarioController.obter)
    );
  },
  "GET /usuario/buscar/:id"
);

// alias de atualização
registerIf(
  usuarioController?.atualizar,
  function registrarAliasAtualizar() {
    router.patch(
      "/atualizar/:id(\\d+)",
      routeTag("usuarioRoute:PATCH /atualizar/:id"),
      validarId,
      asyncHandler(usuarioController.atualizar)
    );
  },
  "PATCH /usuario/atualizar/:id"
);

// alias de log útil em dev
router.use((req, _res, next) => {
  console.log("[usuarioRoute]", buildRouteLog(req));
  return next();
});

module.exports = router;