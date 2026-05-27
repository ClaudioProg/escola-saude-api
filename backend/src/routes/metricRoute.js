/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/metricRoute.js — v2.0
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas oficiais de métricas simples da plataforma.
 *
 * Mount oficial:
 * - /api/metrica
 *
 * Rotas oficiais:
 * - GET  /api/metrica
 * - HEAD /api/metrica
 * - GET  /api/metrica/acesso-app
 * - HEAD /api/metrica/acesso-app
 * - POST /api/metrica/acesso-app
 * - GET  /api/metrica/:chave
 * - HEAD /api/metrica/:chave
 * - POST /api/metrica/:chave/incremento
 * - PUT  /api/metrica/:chave
 * - POST /api/metrica/:chave/timing
 *
 * Contrato:
 * - Sem aliases.
 * - Sem /inc.
 * - Sem /timing solto.
 * - Sem wrapper resiliente.
 * - Sem service como middleware/router.
 * - Respostas ok/code/message/data.
 *
 * Observação de segurança:
 * - Se essas métricas forem internas/admin, aplicar authMiddleware +
 *   authorize("administrador") no mount ou nesta rota.
 */

const express = require("express");
const rateLimit = require("express-rate-limit");

const metricService = require("../services/metricService");

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   Contratos obrigatórios
────────────────────────────────────────────────────────────── */

function assertHandler(name, handler) {
  if (typeof handler !== "function") {
    throw new Error(
      `[metricRoute] Handler obrigatório ausente: metricService.${name}`
    );
  }
}

assertHandler("incrementarMetrica", metricService.incrementarMetrica);
assertHandler("definirMetrica", metricService.definirMetrica);
assertHandler("obterMetrica", metricService.obterMetrica);
assertHandler("listarMetricas", metricService.listarMetricas);
assertHandler("registrarTimingMetrica", metricService.registrarTimingMetrica);
assertHandler("registrarAcessoApp", metricService.registrarAcessoApp);
assertHandler("obterAcessosApp", metricService.obterAcessosApp);

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const asyncHandler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function routeTag(tag) {
  return (_req, res, next) => {
    res.setHeader("X-Route-Handler", tag);
    return next();
  };
}

function noStore(_req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  return next();
}

function respostaOk(res, status, data = {}, extra = {}) {
  return res.status(status).json({
    ok: true,
    data,
    ...extra,
  });
}

function respostaErro(res, status, code, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extra,
  });
}

function toFiniteNumber(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
}

function getErrorStatus(error) {
  const code = String(error?.code || "");

  if (code.includes("-400-")) return 400;

  return 500;
}

function getMetricErrorCode(error, fallback) {
  return String(error?.code || fallback);
}

function getMetricErrorMessage(error, fallback) {
  return String(error?.message || fallback);
}

/* ─────────────────────────────────────────────────────────────
   Rate limit
────────────────────────────────────────────────────────────── */

const metricLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    code: "METRICA-429-LIMITE",
    message: "Muitas requisições de métricas. Aguarde antes de tentar novamente.",
  },
});

/* ─────────────────────────────────────────────────────────────
   Middlewares globais
────────────────────────────────────────────────────────────── */

router.use(metricLimiter);
router.use(noStore);

/* ─────────────────────────────────────────────────────────────
   GET /api/metrica
────────────────────────────────────────────────────────────── */

router.get(
  "/",
  routeTag("metricRoute:v2.0:GET /"),
  asyncHandler(async (req, res) => {
    const prefixo = String(req.query?.prefixo || "").trim();

    try {
      const metricas = await metricService.listarMetricas(prefixo);

      return respostaOk(res, 200, {
        metricas,
        total: metricas.length,
        prefixo: prefixo || null,
      });
    } catch (error) {
      console.error("[metricRoute.listar] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        prefixo,
      });

      return respostaErro(
        res,
        getErrorStatus(error),
        getMetricErrorCode(error, "METRICA-500-LISTAR"),
        getMetricErrorMessage(error, "Erro ao listar métricas.")
      );
    }
  })
);

router.head(
  "/",
  routeTag("metricRoute:v2.0:HEAD /"),
  (_req, res) => res.sendStatus(204)
);

/* ─────────────────────────────────────────────────────────────
   Métrica oficial de acesso ao app
────────────────────────────────────────────────────────────── */

router.get(
  "/acesso-app",
  routeTag("metricRoute:v2.0:GET /acesso-app"),
  asyncHandler(async (_req, res) => {
    try {
      const metrica = await metricService.obterAcessosApp();

      return respostaOk(res, 200, {
        metrica,
      });
    } catch (error) {
      console.error("[metricRoute.obterAcessosApp] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });

      return respostaErro(
        res,
        500,
        "METRICA-500-ACESSO-APP-OBTER",
        "Erro ao obter métrica de acessos do app."
      );
    }
  })
);

router.head(
  "/acesso-app",
  routeTag("metricRoute:v2.0:HEAD /acesso-app"),
  asyncHandler(async (_req, res) => {
    try {
      await metricService.obterAcessosApp();
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(500);
    }
  })
);

router.post(
  "/acesso-app",
  routeTag("metricRoute:v2.0:POST /acesso-app"),
  asyncHandler(async (_req, res) => {
    try {
      await metricService.registrarAcessoApp();
      const metrica = await metricService.obterAcessosApp();

      return respostaOk(
        res,
        200,
        {
          metrica,
        },
        {
          message: "Acesso ao app registrado com sucesso.",
        }
      );
    } catch (error) {
      console.error("[metricRoute.registrarAcessoApp] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
      });

      return respostaErro(
        res,
        500,
        "METRICA-500-ACESSO-APP-REGISTRAR",
        "Erro ao registrar acesso ao app."
      );
    }
  })
);

/* ─────────────────────────────────────────────────────────────
   GET /api/metrica/:chave
────────────────────────────────────────────────────────────── */

router.get(
  "/:chave",
  routeTag("metricRoute:v2.0:GET /:chave"),
  asyncHandler(async (req, res) => {
    const chave = req.params.chave;

    try {
      const metrica = await metricService.obterMetrica(chave);

      if (!metrica) {
        return respostaErro(
          res,
          404,
          "METRICA-404-NAO-ENCONTRADA",
          "Métrica não encontrada."
        );
      }

      return respostaOk(res, 200, {
        metrica,
      });
    } catch (error) {
      console.error("[metricRoute.obter] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        chave,
      });

      return respostaErro(
        res,
        getErrorStatus(error),
        getMetricErrorCode(error, "METRICA-500-OBTER"),
        getMetricErrorMessage(error, "Erro ao obter métrica.")
      );
    }
  })
);

router.head(
  "/:chave",
  routeTag("metricRoute:v2.0:HEAD /:chave"),
  asyncHandler(async (req, res) => {
    try {
      const metrica = await metricService.obterMetrica(req.params.chave);

      return res.sendStatus(metrica ? 204 : 404);
    } catch (error) {
      const status = getErrorStatus(error);
      return res.sendStatus(status);
    }
  })
);

/* ─────────────────────────────────────────────────────────────
   POST /api/metrica/:chave/incremento
────────────────────────────────────────────────────────────── */

router.post(
  "/:chave/incremento",
  routeTag("metricRoute:v2.0:POST /:chave/incremento"),
  asyncHandler(async (req, res) => {
    const chave = req.params.chave;
    const valor = toFiniteNumber(req.body?.valor, 1);

    if (!Number.isFinite(valor)) {
      return respostaErro(
        res,
        400,
        "METRICA-400-INCREMENTO-INVALIDO",
        "Valor de incremento inválido."
      );
    }

    try {
      await metricService.incrementarMetrica(chave, valor);
      const metrica = await metricService.obterMetrica(chave);

      return respostaOk(
        res,
        200,
        {
          metrica,
        },
        {
          message: "Métrica incrementada com sucesso.",
        }
      );
    } catch (error) {
      console.error("[metricRoute.incrementar] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        chave,
        valor,
      });

      return respostaErro(
        res,
        getErrorStatus(error),
        getMetricErrorCode(error, "METRICA-500-INCREMENTAR"),
        getMetricErrorMessage(error, "Erro ao incrementar métrica.")
      );
    }
  })
);

/* ─────────────────────────────────────────────────────────────
   PUT /api/metrica/:chave
────────────────────────────────────────────────────────────── */

router.put(
  "/:chave",
  routeTag("metricRoute:v2.0:PUT /:chave"),
  asyncHandler(async (req, res) => {
    const chave = req.params.chave;
    const valor = toFiniteNumber(req.body?.valor, null);

    if (!Number.isFinite(valor)) {
      return respostaErro(
        res,
        400,
        "METRICA-400-VALOR-INVALIDO",
        "Valor da métrica inválido."
      );
    }

    try {
      await metricService.definirMetrica(chave, valor);
      const metrica = await metricService.obterMetrica(chave);

      return respostaOk(
        res,
        200,
        {
          metrica,
        },
        {
          message: "Métrica definida com sucesso.",
        }
      );
    } catch (error) {
      console.error("[metricRoute.definir] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        chave,
        valor,
      });

      return respostaErro(
        res,
        getErrorStatus(error),
        getMetricErrorCode(error, "METRICA-500-DEFINIR"),
        getMetricErrorMessage(error, "Erro ao definir métrica.")
      );
    }
  })
);

/* ─────────────────────────────────────────────────────────────
   POST /api/metrica/:chave/timing
────────────────────────────────────────────────────────────── */

router.post(
  "/:chave/timing",
  routeTag("metricRoute:v2.0:POST /:chave/timing"),
  asyncHandler(async (req, res) => {
    const chave = req.params.chave;
    const ms = toFiniteNumber(req.body?.ms, null);

    if (!Number.isFinite(ms) || ms < 0) {
      return respostaErro(
        res,
        400,
        "METRICA-400-TIMING-INVALIDO",
        "Valor de timing inválido."
      );
    }

    try {
      await metricService.registrarTimingMetrica(chave, ms);

      const [last, count, sum] = await Promise.all([
        metricService.obterMetrica(`${chave}:last_ms`),
        metricService.obterMetrica(`${chave}:count`),
        metricService.obterMetrica(`${chave}:sum_ms`),
      ]);

      return respostaOk(
        res,
        200,
        {
          timing: {
            chave,
            last_ms: last?.valor_numeric ?? 0,
            count: count?.valor_numeric ?? 0,
            sum_ms: sum?.valor_numeric ?? 0,
          },
        },
        {
          message: "Timing registrado com sucesso.",
        }
      );
    } catch (error) {
      console.error("[metricRoute.timing] ERRO", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack,
        chave,
        ms,
      });

      return respostaErro(
        res,
        getErrorStatus(error),
        getMetricErrorCode(error, "METRICA-500-TIMING"),
        getMetricErrorMessage(error, "Erro ao registrar timing da métrica.")
      );
    }
  })
);

module.exports = router;