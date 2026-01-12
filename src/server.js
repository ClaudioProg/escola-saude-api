// 📁 server.js — PREMIUM (CSP robusta p/ Vite DEV + PROD com nonce, sem loop de reload)
// Fix principal:
// - Em DEV: libera Vite HMR + inline/eval (necessário), e também vercel.live (feedback script) se aparecer.
// - Em PROD: usa nonce no <script> do index.html (substitui {{CSP_NONCE}}) + allowlist enxuta.
// - Evita CSP bloquear scripts e causar “carrega / aparece / carrega...”.
//
// Importante:
// - Mantive sua estrutura inteira (rotas, logs, CORS, etc.)
// - Ajustei CSP para incluir script-src-elem e connect-src completos.
// - Ajustei frame-ancestors para 'none' (API não precisa ser embeddada). Se você EMBEDA em iframe, troque.

"use strict";
/* eslint-disable no-console */
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
const { DATA_ROOT, UPLOADS_DIR, MODELOS_CHAMADAS_DIR, CERT_DIR, ensureDir } = require("./paths");

/* ───────── Rotas ───────── */
const assinaturaRoutes = require("./routes/assinaturaRoutes");
const turmasRouteAdministrador = require("./routes/turmasRouteAdministrador");
const agendaRoute = require("./routes/agendaRoute");
const avaliacoesRoute = require("./routes/avaliacoesRoute");
const certificadosRoute = require("./routes/certificadosRoute");
const certificadosAdminRoutes = require("./routes/certificadosAdminRoutes");
const certificadosAvulsosRoutes = require("./routes/certificadosAvulsosRoutes");
const eventosRoute = require("./routes/eventosRoute");
const inscricoesRoute = require("./routes/inscricoesRoute");
const loginRoute = require("./routes/loginRoute");
const presencasRoute = require("./routes/presencasRoute");
const relatorioPresencasRoute = require("./routes/relatorioPresencasRoute");
const turmasRoute = require("./routes/turmasRoute");
const instrutorRoute = require("./routes/instrutorRoutes");
const relatoriosRoute = require("./routes/relatoriosRoutes");
const dashboardAnaliticoRoutes = require("./routes/dashboardAnaliticoRoutes");
const dashboardUsuarioRoute = require("./routes/dashboardUsuarioRoute");
const notificacoesRoute = require("./routes/notificacoesRoute");
const authGoogleRoute = require("./auth/authGoogle");
const unidadesRoutes = require("./routes/unidadesRoutes");
const usuarioPublicoController = require("./controllers/usuarioPublicoController");
const datasEventoRoute = require("./routes/datasEventoRoute");
const perfilRoutes = require("./routes/perfilRoutes");
const lookupsPublicRoutes = require("./routes/lookupsPublicRoutes");
const usuariosRoute = require("./routes/usuariosRoute");
const metricasRoutes = require("./routes/metricasRoutes");
const solicitacoesCursoRoute = require("./routes/solicitacoesCursoRoute");
const adminAvaliacoesRoutes = require("./routes/adminAvaliacoesRoutes");
const chamadasRoutes = require("./routes/chamadasRoutes");
const trabalhosRoutes = require("./routes/trabalhosRoutes");
const chamadasModeloRoutes = require("./routes/chamadasModeloRoutes");
const usuariosEstatisticasRoute = require("./routes/usuariosEstatisticasRoute");

const votacoesRoutes = require("./routes/votacoesRoute");
const salasRoutes = require("./routes/salasRoutes");
const calendarioRoutes = require("./routes/calendarioRoutes");
const questionariosRoute = require("./routes/questionariosRoute");

// 🔹 Submissões (separadas)
const submissoesAdminRoutes = require("./routes/submissoesAdminRoutes");
const submissoesUsuarioRoutes = require("./routes/submissoesUsuarioRoutes");
const submissoesAvaliadorRoutes = require("./routes/submissoesAvaliadorRoutes");
const submissoesBridgeRoutes = require("./routes/submissoesBridgeRoutes");

const IS_DEV = process.env.NODE_ENV !== "production";
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

// ✅ Wrapper para rotas async (evita crash silencioso / 500 sem log)
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/* ───────── PREMIUM: Request ID + response header ───────── */
app.use((req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const rid =
    (typeof incoming === "string" && incoming.trim().slice(0, 128)) ||
    crypto.randomUUID?.() ||
    crypto.randomBytes(16).toString("hex");

  req.requestId = rid;
  res.setHeader("X-Request-Id", rid);
  next();
});

/* ───────── Normalização de auth (não quebra nada; só ajuda debug) ───────── */
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

/* ───────── Helmet + CSP (PREMIUM) ─────────
   - DEV: precisa liberar Vite (unsafe-eval/inline + ws + localhost:5173)
   - PROD: nonce + allowlist (sem unsafe-inline)
   - Inclui vercel.live porque seu erro mostrou feedback.js sendo bloqueado
*/
app.use((req, res, next) => {
  const nonce = res.locals.cspNonce;

  const frontendFromEnv = (process.env.FRONTEND_URL || "").trim();

  // allowlists úteis
  const devConnect = IS_DEV
    ? ["ws:", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]
    : [];

  const connectSrc = [
    "'self'",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    // se seu front consome a API em outro domínio
    ...(frontendFromEnv ? [frontendFromEnv] : []),
    ...devConnect,
  ];

  // Scripts (GSI + Vercel live)
  const scriptSrcBase = [
    "'self'",
    "https://accounts.google.com",
    "https://www.gstatic.com",
    "https://vercel.live",
    `'nonce-${nonce}'`,
  ];

  // PROD: strict-dynamic (se você usa nonce no index)
  const scriptSrcProd = [...scriptSrcBase, "'strict-dynamic'"];

  // DEV: precisa liberar inline/eval por causa do Vite/HMR e ferramentas
  const scriptSrcDev = [...scriptSrcBase, "'unsafe-inline'", "'unsafe-eval'"];

  const scriptSrc = IS_DEV ? scriptSrcDev : scriptSrcProd;

  // styles: Vite injeta style tags; manter unsafe-inline (ok para CSS)
  const styleSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://accounts.google.com/gsi/style",
  ];

  // font/img
  const fontSrc = ["'self'", "data:", "https://fonts.gstatic.com"];
  const imgSrc = ["'self'", "data:", "https:", "blob:"];
  const frameSrc = ["https://accounts.google.com"];

  // HMR pode usar blob: para workers em algumas configs; manter em DEV no worker-src
  const workerSrc = IS_DEV ? ["'self'", "blob:"] : ["'self'"];

  // ⚠️ Importante: script-src-elem e script-src-attr (para evitar fallback do script-src)
  // - script-src-elem: permite <script src="...">
  // - script-src-attr: controla on* inline (vamos bloquear em PROD)
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

        // opcional mas ajuda: evita bloqueio de preloads/scripts importados
        "manifest-src": ["'self'"],
        "worker-src": workerSrc,
      },
    },
  })(req, res, next);
});

/* ───────── Compression ───────── */
app.use(compression());

/* ───────── CORS (GLOBAL) ───────── */
const fromEnv = (process.env.CORS_ORIGINS || "")
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
    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) return cb(null, true);
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

// ✅ Vary: Origin
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

// Preflight
app.options("*", cors(corsOptions), (_req, res) => res.sendStatus(204));

/* ───────── Parsers ───────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ───────── Diretórios ───────── */
ensureDir(DATA_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(MODELOS_CHAMADAS_DIR);
ensureDir(CERT_DIR);

if (process.env.NODE_ENV !== "test") {
  console.log("[FILES] DATA_ROOT:", DATA_ROOT);
  console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
  console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
  console.log("[FILES] CERT_DIR:", CERT_DIR);
}

/* ───────── Static uploads ───────── */
app.use(
  "/uploads",
  cors(corsOptions),
  express.static(UPLOADS_DIR, {
    maxAge: IS_DEV ? 0 : "1h",
    setHeaders(res) {
      res.setHeader("Cache-Control", IS_DEV ? "no-store" : "public, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

/* ───────── Static (SPA) ───────── */
const PUBLIC_DIR = path.join(__dirname, "public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      maxAge: IS_DEV ? 0 : "1h",
      setHeaders(res) {
        if (!IS_DEV) res.setHeader("Cache-Control", "public, max-age=3600");
      },
    })
  );
}

/* ───────── DB global ───────── */
app.use((req, _res, next) => {
  if (!req.db) req.db = db;
  next();
});

/* ───────── Logger ───────── */
morgan.token("rid", (req) => req.requestId || "-");
morgan.token("ip", (req) => getClientIp(req));
morgan.token("uid", (req) => (req.userId != null ? String(req.userId) : "-"));

app.use(
  morgan(":date[iso] :ip :rid :uid :method :url :status :res[content-length] - :response-time ms", {
    skip: () => process.env.LOG_HTTP === "false",
  })
);

if (IS_DEV) {
  app.use((req, _res, next) => {
    const hasAuth = Boolean(req.headers.authorization);
    const hasCookie = Boolean(req.headers.cookie);
    console.log("[DEV-REQ]", {
      rid: req.requestId,
      method: req.method,
      url: req.url,
      hasAuth,
      hasCookie,
      userId: req.userId ?? null,
    });
    next();
  });
}

/* ───────── Rate limiters ───────── */
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

/* ───────── Helpers de resposta (premium) ───────── */
function sendError(res, status, message, extra = {}) {
  const payload = {
    ok: false,
    erro: message,
    requestId: res.getHeader("X-Request-Id"),
    ...extra,
  };
  return res.status(status).json(payload);
}

function sendOk(res, data = {}, extra = {}) {
  return res.status(200).json({ ok: true, requestId: res.getHeader("X-Request-Id"), ...extra, ...data });
}

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

app.get(
  "/__ping",
  asyncHandler(async (req, res) => {
    if (IS_DEV) {
      console.log("[PING]", {
        rid: req.requestId,
        ip: getClientIp(req),
        ua: req.headers["user-agent"],
      });
    }
    return sendOk(res);
  })
);

/* ───────── Rotas principais ───────── */
app.use("/api/login", loginLimiter, loginRoute);
app.use("/api/administrador/turmas", turmasRouteAdministrador);
app.use("/api/agenda", agendaRoute);
app.use("/api/avaliacoes", avaliacoesRoute);
app.use("/api/certificados", certificadosRoute);
app.use("/api/certificados-admin", certificadosAdminRoutes);
app.use("/api/certificados-avulsos", certificadosAvulsosRoutes);
app.use("/api/eventos", eventosRoute);
app.use("/api/inscricoes", inscricoesRoute);
app.use("/api/presencas", presencasRoute);
app.use("/api/relatorio-presencas", relatorioPresencasRoute);
app.use("/api/turmas", turmasRoute);
app.use("/api/metricas", metricasRoutes);
app.use("/api", usuariosEstatisticasRoute);
app.use("/api/usuarios", usuariosRoute);
app.use("/api/instrutor", instrutorRoute);
app.use("/api/relatorios", relatoriosRoute);
app.use("/api/dashboard-analitico", dashboardAnaliticoRoutes);
app.use("/api/dashboard-usuario", dashboardUsuarioRoute);
app.use("/api/notificacoes", notificacoesRoute);
app.use("/api/auth", authGoogleRoute);
app.use("/api/unidades", unidadesRoutes);
app.use("/api/assinatura", assinaturaRoutes);
app.use("/api/datas", datasEventoRoute);
app.use("/api/perfil", perfilRoutes);
app.use("/api/solicitacoes-curso", solicitacoesCursoRoute);
app.use("/api/admin/avaliacoes", adminAvaliacoesRoutes);
app.use("/api", chamadasModeloRoutes);
app.use("/api", chamadasRoutes);
app.use("/api/trabalhos", trabalhosRoutes);
app.use("/api/votacoes", votacoesRoutes);
app.use("/api", lookupsPublicRoutes);
app.use("/api/salas", salasRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/questionarios", questionariosRoute);
app.use("/api/admin", submissoesAdminRoutes);
app.use("/api/avaliador", submissoesAvaliadorRoutes);
app.use("/api", submissoesUsuarioRoutes);
app.use("/api", submissoesBridgeRoutes);

/* ───────── Recuperação de senha ───────── */
app.post(
  "/api/usuarios/recuperar-senha",
  recuperarSenhaLimiter,
  asyncHandler(usuarioPublicoController.recuperarSenha)
);

/* ───────── Health & SPA fallback ───────── */
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, env: process.env.NODE_ENV || "dev" }));

function renderSpaIndex(res, next) {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return false;

  try {
    // ✅ injeta nonce em qualquer <script ... nonce="{{CSP_NONCE}}">
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

app.get("/", (req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return res.send("🟢 API da Escola da Saúde rodando!");
});

app.get(/^\/(?!api\/|uploads\/).+/, (req, res, next) => {
  if (renderSpaIndex(res, next)) return;
  return next();
});

/* ───────── 404 / Errors ───────── */
app.use((req, res) => {
  if (req.url.startsWith("/uploads/") && req.method === "GET") return res.status(404).end();
  return sendError(res, 404, "Rota não encontrada");
});

app.use((err, req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return sendError(res, 400, "Arquivo muito grande (máx. 50MB).");

  if (err?.code === "CORS_BLOCKED") {
    return sendError(res, 403, "Origem não autorizada.", { code: "CORS_BLOCKED" });
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

  const message = IS_DEV ? err?.message || "Erro interno do servidor" : "Erro interno do servidor";
  return sendError(res, status, message, IS_DEV ? { details: err?.details } : undefined);
});

/* ───────── Start / Shutdown ───────── */
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🟢🚀 Servidor rodando na porta ${PORT} 🟢`);
});

async function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);

  server.close(async () => {
    console.log("✅ HTTP fechado.");

    try {
      if (db?.shutdown) await db.shutdown();
    } catch (e) {
      console.warn("⚠️ Falha ao fechar DB:", e?.message || e);
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.warn("⏱️ Forçando shutdown.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED_REJECTION]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT_EXCEPTION]", err);
});
