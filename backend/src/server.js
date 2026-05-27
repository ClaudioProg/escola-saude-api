/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/server.js — v2.0
 * Atualizado em: 18/05/2026
 *
 * Plataforma Escola da Saúde
 *
 * Servidor principal da API.
 *
 * Padrões v2.0:
 * - Backend como API.
 * - Frontend oficial servido pela Vercel.
 * - Sem aliases legados de autenticação.
 * - Sem normalização de req.usuario / req.auth.
 * - Auth oficial via authMiddleware:
 *   - req.user.id
 *   - req.user.perfil
 * - Warmup oficial: /__ping.
 * - Diagnóstico oficial: /__version.
 * - Contrato único para recuperação de senha:
 *   - /api/auth/esqueci-senha
 *   - /api/auth/redefinir-senha
 * - CORS com lista explícita.
 * - Respostas de erro em envelope v2.0:
 *   - ok
 *   - data
 *   - message
 *   - code
 *   - adminHint
 *   - details
 *   - requestId
 *
 * Observação importante:
 * - As rotas específicas não são montadas aqui.
 * - Este arquivo monta o agregador:
 *   app.use("/api", apiRoutes);
 * - A troca de /api/solicitacao-curso para /api/calendario-eps
 *   deve ser feita em backend/src/routes/index.js.
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");
const crypto = require("crypto");
const morgan = require("morgan");

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line global-require
  require("dotenv").config();
}

/* ─────────────────────────────────────────────────────────────
   DB
────────────────────────────────────────────────────────────── */

const db = require("./db");

/* ─────────────────────────────────────────────────────────────
   Paths
────────────────────────────────────────────────────────────── */

const {
  DATA_ROOT,
  UPLOADS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  ensureDir,
} = require("./paths");

/* ─────────────────────────────────────────────────────────────
   Rotas
────────────────────────────────────────────────────────────── */

const apiRoutes = require("./routes");

/* ─────────────────────────────────────────────────────────────
   Jobs
────────────────────────────────────────────────────────────── */

const {
  iniciarLembreteEventoJob,
  pararLembreteEventoJob,
} = require("./jobs/lembreteEventoJob");

const {
  iniciarConfirmacaoUsoSalaJob,
  pararConfirmacaoUsoSalaJob,
} = require("./jobs/confirmacaoUsoSalaJob");

/* ─────────────────────────────────────────────────────────────
   Config
────────────────────────────────────────────────────────────── */

const IS_DEV = process.env.NODE_ENV !== "production";
const IS_TEST = process.env.NODE_ENV === "test";
const PORT = Number(process.env.PORT || 3000);

/**
 * Fallback SPA secundário.
 * O frontend oficial é Vercel, mas este fallback continua seguro caso exista
 * build estático publicado junto do backend.
 */
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.set("etag", "strong");

/* ─────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"]?.toString().split(",")[0] || "").trim() ||
    req.ip ||
    "unknown"
  );
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function safeBooleanEnv(name, fallback = false) {
  const raw = process.env[name];

  if (raw == null) return fallback;

  return ["1", "true", "yes", "on", "sim"].includes(
    String(raw).trim().toLowerCase()
  );
}

function splitEnvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRequestIdFromResponse(res) {
  return String(res.getHeader("X-Request-Id") || "");
}

function sendEnvelopeError(
  res,
  {
    status = 500,
    message = "Erro interno do servidor.",
    code = "ERRO_INTERNO",
    adminHint = null,
    details = null,
  } = {}
) {
  return res.status(status).json({
    ok: false,
    data: null,
    message,
    code,
    adminHint,
    details,
    requestId: getRequestIdFromResponse(res),
  });
}

function sendEnvelopeOk(
  res,
  {
    status = 200,
    data = null,
    message = "OK",
    code = "OK",
    meta = null,
  } = {}
) {
  return res.status(status).json({
    ok: true,
    data,
    message,
    code,
    ...(meta ? { meta } : {}),
    requestId: getRequestIdFromResponse(res),
  });
}

function isValidOrigin(origin) {
  if (!origin) return true;

  return allowedOrigins.has(origin);
}

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

/* ─────────────────────────────────────────────────────────────
   Request ID
────────────────────────────────────────────────────────────── */

app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];

  const requestId =
    (typeof incoming === "string" && incoming.trim().slice(0, 128)) ||
    (crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex"));

  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
});

/* ─────────────────────────────────────────────────────────────
   CSP nonce
────────────────────────────────────────────────────────────── */

app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

/* ─────────────────────────────────────────────────────────────
   Helmet / CSP
────────────────────────────────────────────────────────────── */

app.use((req, res, next) => {
  const nonce = res.locals.cspNonce;

  const frontendFromEnv = String(process.env.FRONTEND_URL || "").trim();

  const devConnect = IS_DEV
    ? [
        "ws:",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ]
    : [];

  const connectSrc = [
    "'self'",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    ...(frontendFromEnv ? [frontendFromEnv] : []),
    ...devConnect,
  ];

  const scriptSrcBase = [
    "'self'",
    "https://accounts.google.com",
    "https://www.gstatic.com",
    "https://vercel.live",
    `'nonce-${nonce}'`,
  ];

  const scriptSrc = IS_DEV
    ? [...scriptSrcBase, "'unsafe-inline'", "'unsafe-eval'"]
    : [...scriptSrcBase, "'strict-dynamic'"];

  const styleSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com/gsi/style",
  ];

  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: IS_DEV ? false : undefined,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permissionsPolicy: {
      features: {
        geolocation: [],
        microphone: [],
        camera: [],
        payment: [],
        usb: [],
        interestCohort: [],
      },
    },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "object-src": ["'none'"],
        "frame-src": ["https://accounts.google.com"],
        "style-src": styleSrc,
        "script-src": scriptSrc,
        "script-src-elem": scriptSrc,
        "script-src-attr": IS_DEV ? ["'unsafe-inline'"] : ["'none'"],
        "connect-src": connectSrc,
        "manifest-src": ["'self'"],
        "worker-src": IS_DEV ? ["'self'", "blob:"] : ["'self'"],
      },
    },
  })(req, res, next);
});

/* ─────────────────────────────────────────────────────────────
   Compression
────────────────────────────────────────────────────────────── */

app.use(compression());

/* ─────────────────────────────────────────────────────────────
   CORS
────────────────────────────────────────────────────────────── */

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://escoladasaude.vercel.app",
  ...splitEnvList(process.env.CORS_ORIGINS),
]);

const corsOptions = {
  origin(origin, callback) {
    if (isValidOrigin(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origem não autorizada.");
    error.status = 403;
    error.code = "CORS_BLOCKED";
    return callback(error);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  exposedHeaders: [
    "Content-Disposition",
    "Content-Length",
    "Last-Modified",
    "ETag",
    "X-Perfil-Incompleto",
    "X-Request-Id",
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.use((req, res, next) => {
  const prev = res.getHeader("Vary");

  const list = String(prev || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!list.includes("Origin")) list.push("Origin");

  res.setHeader("Vary", list.join(", "));
  next();
});

app.options(/.*/, cors(corsOptions), (_req, res) => res.sendStatus(204));

/* ─────────────────────────────────────────────────────────────
   Parsers
────────────────────────────────────────────────────────────── */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ─────────────────────────────────────────────────────────────
   Diretórios
────────────────────────────────────────────────────────────── */

ensureDir(DATA_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(MODELOS_CHAMADAS_DIR);
ensureDir(CERT_DIR);

ensureDir(path.join(UPLOADS_DIR, "eventos"));
ensureDir(path.join(UPLOADS_DIR, "posters"));
ensureDir(path.join(UPLOADS_DIR, "modelos"));
ensureDir(path.join(UPLOADS_DIR, "informacoes"));

if (!IS_TEST) {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
  console.log("[FILES] CERT_DIR:", CERT_DIR);
  console.log("[FILES] UPLOADS/eventos:", path.join(UPLOADS_DIR, "eventos"));
  console.log(
    "[FILES] UPLOADS/informacoes:",
    path.join(UPLOADS_DIR, "informacoes")
  );
}

/* ─────────────────────────────────────────────────────────────
   Uploads estáticos
────────────────────────────────────────────────────────────── */

function setUploadHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", IS_DEV ? "no-store" : "public, max-age=3600");
}

app.use(
  "/uploads/eventos",
  cors(corsOptions),
  express.static(path.join(UPLOADS_DIR, "eventos"), {
    fallthrough: false,
    maxAge: IS_DEV ? 0 : "1h",
    setHeaders: setUploadHeaders,
  })
);

app.use(
  "/uploads/informacoes",
  cors(corsOptions),
  express.static(path.join(UPLOADS_DIR, "informacoes"), {
    fallthrough: false,
    maxAge: IS_DEV ? 0 : "1h",
    setHeaders: setUploadHeaders,
  })
);

app.use(
  "/uploads",
  cors(corsOptions),
  express.static(UPLOADS_DIR, {
    fallthrough: true,
    maxAge: IS_DEV ? 0 : "1h",
    setHeaders: setUploadHeaders,
  })
);

/* ─────────────────────────────────────────────────────────────
   Static SPA secundário
────────────────────────────────────────────────────────────── */

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      maxAge: IS_DEV ? 0 : "1h",
      setHeaders(res) {
        if (!IS_DEV) {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
      },
    })
  );
}

/* ─────────────────────────────────────────────────────────────
   DB em req.db
────────────────────────────────────────────────────────────── */

app.use((req, _res, next) => {
  if (!req.db) req.db = db;
  next();
});

/* ─────────────────────────────────────────────────────────────
   Logger
────────────────────────────────────────────────────────────── */

morgan.token("rid", (req) => req.requestId || "-");
morgan.token("ip", (req) => getClientIp(req));
morgan.token("uid", (req) => {
  const id = req?.user?.id;
  return id != null ? String(id) : "-";
});

app.use(
  morgan(
    ":date[iso] :ip :rid :uid :method :url :status :res[content-length] - :response-time ms",
    {
      skip: () => process.env.LOG_HTTP === "false",
    }
  )
);

if (IS_DEV && safeBooleanEnv("DEBUG_REQUESTS", true)) {
  app.use((req, _res, next) => {
    console.log("[DEV-REQ]", {
      rid: req.requestId,
      method: req.method,
      url: req.url,
      hasAuth: Boolean(req.headers.authorization),
      userId: req?.user?.id ?? null,
      perfil: req?.user?.perfil ?? null,
    });
    next();
  });
}

/* ─────────────────────────────────────────────────────────────
   Rate limiters
────────────────────────────────────────────────────────────── */

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    data: null,
    message: "Muitas tentativas. Tente novamente em alguns minutos.",
    code: "MUITAS_TENTATIVAS_LOGIN",
    adminHint:
      "Rate limit aplicado em /api/login para reduzir tentativas sucessivas.",
    details: null,
  },
});

const esqueciSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    data: null,
    message: "Muitas solicitações. Aguarde antes de tentar novamente.",
    code: "MUITAS_SOLICITACOES_RECUPERACAO_SENHA",
    adminHint:
      "Rate limit aplicado em /api/auth/esqueci-senha para proteção contra abuso.",
    details: null,
  },
});

const redefinirSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    data: null,
    message: "Muitas tentativas. Aguarde antes de tentar novamente.",
    code: "MUITAS_TENTATIVAS_REDEFINIR_SENHA",
    adminHint:
      "Rate limit aplicado em /api/auth/redefinir-senha para proteção contra abuso.",
    details: null,
  },
});

app.use("/api/login", loginLimiter);
app.use("/api/auth/esqueci-senha", esqueciSenhaLimiter);
app.use("/api/auth/redefinir-senha", redefinirSenhaLimiter);

/* ─────────────────────────────────────────────────────────────
   Diagnóstico
────────────────────────────────────────────────────────────── */

app.get(
  "/__version",
  asyncHandler(async (req, res) => {
    setNoStoreHeaders(res);

    return sendEnvelopeOk(res, {
      data: {
        service: process.env.RENDER_SERVICE_NAME || "escola-saude-api",
        commit: process.env.RENDER_GIT_COMMIT || "local",
        node: process.version,
        env: process.env.NODE_ENV || "dev",
        uptime_s: Math.round(process.uptime()),
        now: new Date().toISOString(),
      },
      message: "Versão da API carregada com sucesso.",
      code: "VERSION_OK",
    });
  })
);

app.head("/__version", (_req, res) => res.sendStatus(204));

app.get(
  "/__ping",
  asyncHandler(async (req, res) => {
    setNoStoreHeaders(res);

    if (IS_DEV) {
      console.log("[PING]", {
        rid: req.requestId,
        ip: getClientIp(req),
      });
    }

    return sendEnvelopeOk(res, {
      data: {
        alive: true,
      },
      message: "API ativa.",
      code: "PING_OK",
    });
  })
);

app.head("/__ping", (_req, res) => res.sendStatus(204));

/* ─────────────────────────────────────────────────────────────
   API
────────────────────────────────────────────────────────────── */

app.use("/api", apiRoutes);

/* ─────────────────────────────────────────────────────────────
   SPA fallback secundário
────────────────────────────────────────────────────────────── */

function renderSpaIndex(res, next) {
  const indexPath = path.join(PUBLIC_DIR, "index.html");

  if (!fs.existsSync(indexPath)) return false;

  try {
    const html = fs
      .readFileSync(indexPath, "utf8")
      .replaceAll("{{CSP_NONCE}}", res.locals.cspNonce);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
    return true;
  } catch (error) {
    next(error);
    return true;
  }
}

app.get("/", (_req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return res.send("API da Escola da Saúde rodando.");
});

app.get(/^\/(?!api\/|uploads\/|__ping$|__version$).+/, (_req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return next();
});

/* ─────────────────────────────────────────────────────────────
   404 / Error handler
────────────────────────────────────────────────────────────── */

app.use((req, res) => {
  if (req.url.startsWith("/uploads/") && req.method === "GET") {
    return res.status(404).end();
  }

  if (req.url.startsWith("/uploads/") && req.method === "HEAD") {
    return res.sendStatus(404);
  }

  return sendEnvelopeError(res, {
    status: 404,
    message: "Rota não encontrada.",
    code: "ROTA_NAO_ENCONTRADA",
    adminHint:
      "Verifique se a rota foi montada em backend/src/routes/index.js e se o prefixo chamado no frontend corresponde ao contrato oficial.",
    details: {
      method: req.method,
      url: req.originalUrl || req.url,
    },
  });
});

app.use((err, req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return sendEnvelopeError(res, {
      status: 400,
      message: "Arquivo muito grande. O tamanho máximo permitido é 15MB.",
      code: "ARQUIVO_MUITO_GRANDE",
      adminHint:
        "Ajuste o limite do middleware de upload apenas se houver decisão técnica para aceitar arquivos maiores.",
      details: {
        limit: "15MB",
      },
    });
  }

  if (err?.code === "CORS_BLOCKED") {
    return sendEnvelopeError(res, {
      status: 403,
      message: "Origem não autorizada.",
      code: "CORS_BLOCKED",
      adminHint:
        "Adicione a origem em CORS_ORIGINS apenas se ela for oficialmente autorizada.",
      details: {
        origin: req.headers.origin || null,
      },
    });
  }

  if (err?.name === "UnauthorizedError" || err?.code === "UNAUTHORIZED") {
    return sendEnvelopeError(res, {
      status: 401,
      message: "Usuário não autenticado.",
      code: "NAO_AUTENTICADO",
      adminHint:
        "Verifique token JWT, header Authorization e authMiddleware oficial.",
      details: null,
    });
  }

  const status = err?.status || err?.statusCode || 500;

  console.error("[ERROR]", {
    rid: req?.requestId,
    status,
    method: req?.method,
    url: req?.originalUrl || req?.url,
    userId: req?.user?.id ?? null,
    perfil: req?.user?.perfil ?? null,
    message: err?.message,
    code: err?.code,
    stack: IS_DEV ? err?.stack : undefined,
  });

  const message = IS_DEV
    ? err?.message || "Erro interno do servidor."
    : "Erro interno do servidor.";

  return sendEnvelopeError(res, {
    status,
    message,
    code: err?.code || "ERRO_INTERNO",
    adminHint:
      status >= 500
        ? "Verifique logs do servidor, requestId, stack em ambiente de desenvolvimento e integração da rota/controller."
        : null,
    details: IS_DEV
      ? {
          details: err?.details,
          stack: err?.stack,
        }
      : null,
  });
});

/* ─────────────────────────────────────────────────────────────
   Start / Shutdown
────────────────────────────────────────────────────────────── */

const server = app.listen(PORT, () => {
  console.log(`Servidor da Escola da Saúde rodando na porta ${PORT}.`);

  iniciarLembreteEventoJob();
  iniciarConfirmacaoUsoSalaJob();
});

async function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);

  pararLembreteEventoJob();
  pararConfirmacaoUsoSalaJob();

  server.close(async () => {
    console.log("HTTP fechado.");

    try {
      if (db?.shutdown) {
        await db.shutdown();
      }
    } catch (error) {
      console.warn("Falha ao fechar DB:", error?.message || error);
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.warn("Forçando shutdown.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT_EXCEPTION]", error);
});