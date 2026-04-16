/* eslint-disable no-console */
"use strict";

// 📁 src/server.js — PREMIUM++
// - CSP robusta DEV/PROD com nonce
// - uploads estáticos corretos
// - CORS resiliente
// - logs com request id
// - rate limit antes das rotas
// - fallback SPA seguro
// - pronto para produção

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");
const crypto = require("crypto");
const morgan = require("morgan");

// ✅ dotenv só fora de produção
if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line global-require
  require("dotenv").config();
}

/* ───────── DB (adapter resiliente) ───────── */
const rawDb = require("./db");
const db = rawDb?.db ?? rawDb;

/* ───────── Paths ───────── */
const {
  DATA_ROOT,
  UPLOADS_DIR,
  MODELOS_CHAMADAS_DIR,
  CERT_DIR,
  ensureDir,
} = require("./paths");

/* ───────── Rotas (fonte única) ───────── */
const apiRoutes = require("./routes");

const IS_DEV = process.env.NODE_ENV !== "production";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
app.disable("x-powered-by");

/* ───────── Hardening / perf ───────── */
app.set("trust proxy", 1);
app.set("etag", "strong");

/* ───────── Helpers ───────── */
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

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    erro: message,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
  });
}

function sendOk(res, data = {}, extra = {}) {
  return res.status(200).json({
    ok: true,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
    ...data,
  });
}

/* ───────── Request ID + response header ───────── */
app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const rid =
    (typeof incoming === "string" && incoming.trim().slice(0, 128)) ||
    (crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex"));

  req.requestId = rid;
  res.setHeader("X-Request-Id", rid);
  next();
});

/* ───────── Normalização de auth (ajuda logs/debug) ───────── */
app.use((req, _res, next) => {
  const u = req.user || req.usuario || req.auth || null;

  const userId =
    u?.id ??
    u?.usuario_id ??
    u?.userId ??
    req.userId ??
    req.usuario_id ??
    null;

  const perfilId =
    u?.perfil_id ??
    u?.perfilId ??
    req.perfil_id ??
    null;

  if (userId != null) req.userId = userId;
  if (perfilId != null) req.perfilId = perfilId;

  next();
});

/* ───────── CSP nonce por requisição ───────── */
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

/* ───────── Helmet + CSP ───────── */
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

  const fontSrc = ["'self'", "data:", "https://fonts.gstatic.com"];
  const imgSrc = ["'self'", "data:", "https:", "blob:"];
  const frameSrc = ["https://accounts.google.com"];
  const workerSrc = IS_DEV ? ["'self'", "blob:"] : ["'self'"];
  const scriptSrcAttr = IS_DEV ? ["'unsafe-inline'"] : ["'none'"];

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
        "font-src": fontSrc,
        "img-src": imgSrc,
        "object-src": ["'none'"],
        "frame-src": frameSrc,
        "style-src": styleSrc,
        "script-src": scriptSrc,
        "script-src-elem": scriptSrc,
        "script-src-attr": scriptSrcAttr,
        "connect-src": connectSrc,
        "manifest-src": ["'self'"],
        "worker-src": workerSrc,
      },
    },
  })(req, res, next);
});

/* ───────── Compression ───────── */
app.use(compression());

/* ───────── CORS (GLOBAL) ───────── */
const fromEnv = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const defaultAllowed = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://escola-saude-api-frontend.vercel.app",
  "https://escoladasaude.vercel.app",
];

const allowedOrigins = [...defaultAllowed, ...fromEnv];
const vercelRegex = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) {
      return cb(null, true);
    }

    const err = new Error("CORS bloqueado.");
    err.status = 403;
    err.code = "CORS_BLOCKED";
    return cb(err);
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

/* ✅ Vary: Origin */
app.use((req, res, next) => {
  const prev = res.getHeader("Vary");
  const list = String(prev || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!list.includes("Origin")) list.push("Origin");
  res.setHeader("Vary", list.join(", "));
  next();
});

/* ✅ Preflight */
app.options(/.*/, cors(corsOptions), (_req, res) => res.sendStatus(204));

/* ───────── Parsers ───────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ───────── Diretórios ───────── */
ensureDir(DATA_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(MODELOS_CHAMADAS_DIR);
ensureDir(CERT_DIR);

ensureDir(path.join(UPLOADS_DIR, "eventos"));
ensureDir(path.join(UPLOADS_DIR, "posters"));
ensureDir(path.join(UPLOADS_DIR, "modelos"));
ensureDir(path.join(UPLOADS_DIR, "informacoes"));

if (process.env.NODE_ENV !== "test") {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
  console.log("[FILES] CERT_DIR:", CERT_DIR);
  console.log("[FILES] UPLOADS/eventos:", path.join(UPLOADS_DIR, "eventos"));
  console.log("[FILES] UPLOADS/informacoes:", path.join(UPLOADS_DIR, "informacoes"));
}

/* ───────── Static uploads ───────── */
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

/* ───────── Static (SPA) ───────── */
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

/* ───────── DB global em req.db ───────── */
app.use((req, _res, next) => {
  if (!req.db) req.db = db;
  next();
});

/* ───────── Logger ───────── */
morgan.token("rid", (req) => req.requestId || "-");
morgan.token("ip", (req) => getClientIp(req));
morgan.token("uid", (req) => (req.userId != null ? String(req.userId) : "-"));

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
      hasCookie: Boolean(req.headers.cookie),
      userId: req.userId ?? null,
    });
    next();
  });
}

/* ───────── Rate limiters (ANTES das rotas) ───────── */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas, tente novamente em alguns minutos." },
});

const recuperarSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas solicitações, aguarde antes de tentar novamente." },
});

app.use("/api/login", loginLimiter);
app.use("/api/auth/esqueci-senha", recuperarSenhaLimiter);
app.use("/api/auth/recuperar-senha", recuperarSenhaLimiter);
app.use("/api/auth/resetar-senha", recuperarSenhaLimiter);
app.use("/api/auth/redefinir-senha", recuperarSenhaLimiter);

/* ───────── Rotas de diagnóstico ───────── */
app.get(
  "/__version",
  asyncHandler(async (req, res) => {
    return res.json({
      service: process.env.RENDER_SERVICE_NAME || "escola-saude-api",
      commit: process.env.RENDER_GIT_COMMIT || "local",
      node: process.version,
      env: process.env.NODE_ENV || "dev",
      uptime_s: Math.round(process.uptime()),
      now: new Date().toISOString(),
      requestId: req.requestId,
    });
  })
);

app.head("/__version", (_req, res) => res.sendStatus(204));

app.get(
  "/__ping",
  asyncHandler(async (req, res) => {
    if (IS_DEV) {
      console.log("[PING]", { rid: req.requestId, ip: getClientIp(req) });
    }
    return sendOk(res);
  })
);

app.head("/__ping", (_req, res) => res.sendStatus(204));

/* ───────── API (fonte única) ───────── */
app.use("/api", apiRoutes);

/* ───────── SPA fallback ───────── */
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
  } catch (e) {
    next(e);
    return true;
  }
}

app.get("/", (_req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return res.send("🟢 API da Escola da Saúde rodando!");
});

// ✅ SPA fallback NÃO deve capturar api/uploads
app.get(/^\/(?!api\/|uploads\/).+/, (_req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return next();
});

/* ───────── 404 / Errors ───────── */
app.use((req, res) => {
  if (req.url.startsWith("/uploads/") && req.method === "GET") {
    return res.status(404).end();
  }

  if (req.url.startsWith("/uploads/") && req.method === "HEAD") {
    return res.sendStatus(404);
  }

  return sendError(res, 404, "Rota não encontrada");
});

app.use((err, req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return sendError(res, 400, "Arquivo muito grande (máx. 15MB).");
  }

  if (err?.code === "CORS_BLOCKED") {
    return sendError(res, 403, "Origem não autorizada.", {
      code: "CORS_BLOCKED",
    });
  }

  if (err?.name === "UnauthorizedError" || err?.code === "UNAUTHORIZED") {
    return sendError(res, 401, "Não autenticado.");
  }

  const status = err?.status || err?.statusCode || 500;

  console.error("[ERROR]", {
    rid: req?.requestId,
    status,
    method: req?.method,
    url: req?.originalUrl || req?.url,
    userId: req?.userId ?? null,
    message: err?.message,
    code: err?.code,
    stack: IS_DEV ? err?.stack : undefined,
  });

  const message = IS_DEV
    ? err?.message || "Erro interno do servidor"
    : "Erro interno do servidor";

  return sendError(
    res,
    status,
    message,
    IS_DEV ? { details: err?.details } : undefined
  );
});

/* ───────── Start / Shutdown ───────── */
const server = app.listen(PORT, () => {
  console.log(`🟢🚀 Servidor rodando na porta ${PORT} 🟢`);
});

async function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);

  server.close(async () => {
    console.log("✅ HTTP fechado.");

    try {
      if (db?.shutdown) {
        await db.shutdown();
      }
    } catch (e) {
      console.warn("⚠️ Falha ao fechar DB:", e?.message || e);
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.warn("⏱️ Forçando shutdown.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT_EXCEPTION]", err);
});