/* eslint-disable no-console */
"use strict";

// ✅ src/routes/usuarioRoute.js — PREMIUM/UNIFICADO (singular + compat)
const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const router = express.Router();

/* ───────────────── Controllers (IMPORT ÚNICO) ───────────────── */
const usuarioController = require("../controllers/usuarioController");

/* ───────────────── Auth / Authorization ───────────────── */
const requireAuth = require("../auth/authMiddleware");

/* ─────────────────────────────────────────────────────────────
   Helpers “premium”
────────────────────────────────────────────────────────────── */
const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

function toPerfisArray(value) {
  if (!value) return [];

  const arr = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [...new Set(arr.map((p) => String(p).trim().toLowerCase()).filter(Boolean))];
}

/** ID numérico positivo (defensivo contra overflow e NaN) */
function validarId(req, res, next) {
  const { id } = req.params;

  if (!/^\d+$/.test(String(id))) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) {
    return res.status(400).json({ erro: "ID inválido." });
  }

  return next();
}

/** Registro condicional de rotas (log amigável quando faltar handler) */
function registerIf(fn, registrar, rotaDescrita) {
  if (typeof fn === "function") {
    registrar();
    return;
  }

  console.warn(
    `⚠️  Rota '${rotaDescrita || "rota"}' não registrada: handler ausente no controller.`
  );
}

/* =========================
   Estatísticas (ETag)
========================= */
function buildEtag(data) {
  const digest = crypto
    .createHash("sha1")
    .update(JSON.stringify(data))
    .digest("base64");

  return `"stats-${digest}"`;
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

const requireAdmin = [
  requireAuth,
  (req, res, next) => {
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
  },
];

function logPerfilRoute(req, _res, next) {
  console.log(
    `[usuarioRoute] ${req.method} perfil`,
    buildRouteLog(req, {
      body: req.body,
    })
  );
  return next();
}

/* ─────────────────────────────────────────────────────────────
   🔓 Rotas públicas (sem autenticação)
   Base: /api/usuario  (e alias /api/usuarios)
────────────────────────────────────────────────────────────── */
registerIf(
  usuarioController?.cadastrarUsuario,
  function cadastroPublicoRoute() {
    router.post(
      "/cadastro",
      authLimiter,
      asyncHandler(usuarioController.cadastrarUsuario)
    );
  },
  "POST /usuarios/cadastro"
);

registerIf(
  usuarioController?.loginUsuario,
  function loginPublicoRoute() {
    router.post(
      "/login",
      authLimiter,
      asyncHandler(usuarioController.loginUsuario)
    );
  },
  "POST /usuarios/login"
);

registerIf(
  usuarioController?.recuperarSenha,
  function recuperarSenhaRoute() {
    router.post(
      "/recuperar-senha",
      authLimiter,
      asyncHandler(usuarioController.recuperarSenha)
    );
  },
  "POST /usuarios/recuperar-senha"
);

registerIf(
  usuarioController?.redefinirSenha,
  function redefinirSenhaRoute() {
    router.post(
      "/redefinir-senha",
      authLimiter,
      asyncHandler(usuarioController.redefinirSenha)
    );
  },
  "POST /usuarios/redefinir-senha"
);

/* ─────────────────────────────────────────────────────────────
   🔒 Rotas protegidas (exigem token válido)
────────────────────────────────────────────────────────────── */

// ✅ Tudo abaixo exige auth
router.use(requireAuth);

/* -------------------------
   Rotas “fixas” (antes de /:id)
-------------------------- */

// ✍️ Assinatura do usuário autenticado
registerIf(
  usuarioController?.obterAssinatura,
  function obterAssinaturaRoute() {
    router.get(
      "/assinatura",
      authLimiter,
      asyncHandler(usuarioController.obterAssinatura)
    );
  },
  "GET /usuarios/assinatura"
);

/* ─────────────────────────────────────────────────────────────
   🔐 Admin-only (fixas)
────────────────────────────────────────────────────────────── */

// 👥 Listar todos
registerIf(
  usuarioController?.listarUsuarios,
  function listarUsuariosRoute() {
    router.get(
      "/",
      ...requireAdmin,
      adminLimiter,
      asyncHandler(usuarioController.listarUsuarios)
    );
  },
  "GET /usuarios"
);

// 👨‍🏫 Listar instrutores
const listarInstrutoresHandler =
  usuarioController?.listarInstrutores ||
  usuarioController?.listarinstrutor ||
  usuarioController?.listarInstrutor;

registerIf(
  listarInstrutoresHandler,
  function listarInstrutoresRoute() {
    router.get(
      "/instrutor",
      ...requireAdmin,
      adminLimiter,
      asyncHandler(listarInstrutoresHandler)
    );

    router.get(
      "/instrutores",
      ...requireAdmin,
      adminLimiter,
      asyncHandler(listarInstrutoresHandler)
    );
  },
  "GET /usuarios/instrutores"
);

// 👨‍⚖️ Listar avaliadores elegíveis
registerIf(
  usuarioController?.listarAvaliadoresElegiveis,
  function listarAvaliadoresElegiveisRoute() {
    router.get(
      "/avaliador",
      ...requireAdmin,
      adminLimiter,
      asyncHandler(usuarioController.listarAvaliadoresElegiveis)
    );

    router.get(
      "/avaliadores",
      ...requireAdmin,
      adminLimiter,
      asyncHandler(usuarioController.listarAvaliadoresElegiveis)
    );
  },
  "GET /usuarios/avaliadores"
);

/* ─────────────────────────────────────────────────────────────
   📈 Estatísticas de usuários (ADMIN) — ETag + HEAD + cache
   Mantém o contrato antigo:
   GET/HEAD /usuarios/estatisticas
   GET      /usuarios/estatisticas/detalhes
────────────────────────────────────────────────────────────── */
registerIf(
  usuarioController?.getEstatisticasUsuarios,
  function estatisticasRoute() {
    router.get(
      "/estatisticas",
      ...requireAdmin,
      statsLimiter,
      asyncHandler(async (req, res) => {
        const data = await usuarioController.getEstatisticasUsuarios(req, res, {
          internal: true,
        });

        if (!data || res.headersSent) return;

        const etag = buildEtag(data);
        res.setHeader("ETag", etag);
        res.setHeader(
          "Cache-Control",
          "public, max-age=120, stale-while-revalidate=600"
        );

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

    router.head(
      "/estatisticas",
      ...requireAdmin,
      statsLimiter,
      asyncHandler(async (req, res) => {
        const preview = await usuarioController.getEstatisticasUsuarios(req, res, {
          preview: true,
        });

        if (!preview) return res.status(204).end();

        const etag = buildEtag(preview);
        res.setHeader("ETag", etag);
        res.setHeader(
          "Cache-Control",
          "public, max-age=120, stale-while-revalidate=600"
        );

        return res.status(200).end();
      })
    );
  },
  "GET/HEAD /usuarios/estatisticas"
);

registerIf(
  usuarioController?.getEstatisticasUsuariosDetalhadas,
  function estatisticasDetalhesRoute() {
    router.get(
      "/estatisticas/detalhes",
      ...requireAdmin,
      statsLimiter,
      asyncHandler(async (req, res) => {
        const data = await usuarioController.getEstatisticasUsuariosDetalhadas(req, res);
        if (!data) return res.status(204).end();

        const etag = buildEtag(data);
        res.setHeader("ETag", etag);
        res.setHeader(
          "Cache-Control",
          "public, max-age=120, stale-while-revalidate=600"
        );

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
  "GET /usuarios/estatisticas/detalhes"
);

/* ─────────────────────────────────────────────────────────────
   🔒 Rotas protegidas com :id (colocar por último)
────────────────────────────────────────────────────────────── */

// 👤 Obter usuário por ID (admin ou o próprio — a regra está no controller)
registerIf(
  usuarioController?.obterUsuarioPorId,
  function obterUsuarioPorIdRoute() {
    router.get(
      "/:id(\\d+)",
      authLimiter,
      validarId,
      asyncHandler(usuarioController.obterUsuarioPorId)
    );
  },
  "GET /usuarios/:id"
);

// 🔄 Atualizar dados básicos do usuário por ID
registerIf(
  usuarioController?.atualizarUsuario,
  function atualizarUsuarioRoute() {
    router.patch(
      "/:id(\\d+)",
      authLimiter,
      validarId,
      asyncHandler(usuarioController.atualizarUsuario)
    );
  },
  "PATCH /usuarios/:id"
);

// 📊 Resumo do usuário (admin)
registerIf(
  usuarioController?.getResumoUsuario,
  function getResumoUsuarioRoute() {
    router.get(
      "/:id(\\d+)/resumo",
      ...requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(usuarioController.getResumoUsuario)
    );
  },
  "GET /usuarios/:id/resumo"
);

// 📝 Atualizar perfil (admin)
const atualizarPerfilHandler =
  usuarioController?.atualizarPerfil ||
  usuarioController?.atualizarPerfilUsuario ||
  usuarioController?.updatePerfil;

registerIf(
  atualizarPerfilHandler,
  function atualizarPerfilRoute() {
    const perfilMiddlewares = [
      ...requireAdmin,
      adminLimiter,
      validarId,
      logPerfilRoute,
      asyncHandler(atualizarPerfilHandler),
    ];

    router.patch("/:id(\\d+)/perfil", ...perfilMiddlewares);
    router.put("/:id(\\d+)/perfil", ...perfilMiddlewares);
  },
  "PATCH/PUT /usuarios/:id/perfil"
);

// ❌ Excluir usuário
registerIf(
  usuarioController?.excluirUsuario,
  function excluirUsuarioRoute() {
    router.delete(
      "/:id(\\d+)",
      ...requireAdmin,
      adminLimiter,
      validarId,
      asyncHandler(usuarioController.excluirUsuario)
    );
  },
  "DELETE /usuarios/:id"
);

/* ─────────────────────────────────────────────────────────────
   ♻️ Aliases retrocompat
   (se algum front chamava /usuarios/estatisticas como subpath)
────────────────────────────────────────────────────────────── */
router.get(
  "/usuarios/estatisticas",
  ...requireAdmin,
  statsLimiter,
  asyncHandler(async (req, res) => {
    if (typeof usuarioController.getEstatisticasUsuarios !== "function") {
      return res.status(501).json({
        erro: "Handler não implementado: usuarioController.getEstatisticasUsuarios",
      });
    }

    const data = await usuarioController.getEstatisticasUsuarios(req, res, {
      internal: true,
    });

    if (!data || res.headersSent) return;

    const etag = buildEtag(data);
    res.setHeader("ETag", etag);
    res.setHeader(
      "Cache-Control",
      "public, max-age=120, stale-while-revalidate=600"
    );

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

module.exports = router;