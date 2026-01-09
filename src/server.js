// 📁 server.js
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

/* ───────── DB (adapter) ───────── */
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
const submissoesAdminRoutes = require("./routes/submissoesAdminRoutes");
const votacoesRoutes = require("./routes/votacoesRoute");
const salasRoutes = require("./routes/salasRoutes");
const calendarioRoutes = require("./routes/calendarioRoutes");

const IS_DEV = process.env.NODE_ENV !== "production";
const app = express();
app.disable("x-powered-by");

/* ───────── Hardening / perf ───────── */
app.set("trust proxy", 1);
app.set("etag", "strong");

/* ───────── PREMIUM: Request ID + response header ───────── */
function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"]?.toString().split(",")[0] || "").trim() ||
    req.ip ||
    "unknown"
  );
}

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

/* ───────── CSP nonce por requisição ───────── */
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

/* ───────── Helmet + CSP (premium) ─────────
   ✅ Agora o nonce entra direto no Helmet via função (sem replace string do header)
*/
app.use((req, res, next) => {
  const nonce = res.locals.cspNonce;

  const frontendFromEnv = (process.env.FRONTEND_URL || "").trim();
  const connectSrc = [
    "'self'",
    "https://escola-saude-api.onrender.com",
    "https://accounts.google.com",
    "https://www.googleapis.com",
    ...(frontendFromEnv ? [frontendFromEnv] : []),
    ...(IS_DEV ? ["ws:", "http://localhost:5173", "http://127.0.0.1:5173"] : []),
  ];

  const scriptSrc = [
    "'self'",
    "https://accounts.google.com",
    "https://www.gstatic.com",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(IS_DEV ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
  ];

  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: IS_DEV ? false : undefined,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // PREMIUM: Permissions-Policy (antes “Feature-Policy”)
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
        "frame-ancestors": ["'self'"],

        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "object-src": ["'none'"],
        "frame-src": ["https://accounts.google.com"],

        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://accounts.google.com/gsi/style",
        ],

        "script-src": scriptSrc,

        "connect-src": connectSrc,
      },
    },
  })(req, res, next);
});

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
  exposedHeaders: ["Content-Disposition", "Content-Length", "Last-Modified", "ETag", "X-Perfil-Incompleto", "X-Request-Id"],
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

/* ───────── Logger ─────────
   PREMIUM: inclui requestId
*/
morgan.token("rid", (req) => req.requestId || "-");
morgan.token("ip", (req) => getClientIp(req));

app.use(
  morgan(":date[iso] :ip :rid :method :url :status :res[content-length] - :response-time ms", {
    skip: () => process.env.LOG_HTTP === "false",
  })
);

if (IS_DEV) {
  app.use((req, _res, next) => {
    console.log("[DEV-REQ]", { rid: req.requestId, method: req.method, url: req.url });
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

/* ───────── Rotas de diagnóstico ───────── */
app.get("/__version", (req, res) => {
  res.json({
    service: process.env.RENDER_SERVICE_NAME || "escola-saude-api",
    commit: process.env.RENDER_GIT_COMMIT || "local",
    node: process.version,
    env: process.env.NODE_ENV || "dev",
    uptime_s: Math.round(process.uptime()),
    now: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.get("/__ping", (req, res) => {
  if (IS_DEV) {
    console.log("[PING]", {
      rid: req.requestId,
      ip: getClientIp(req),
      ua: req.headers["user-agent"],
    });
  }
  res.json({ ok: true, requestId: req.requestId });
});

/* ───────── Rotas ───────── */
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
app.use("/api", chamadasModeloRoutes);
app.use("/api", submissoesAdminRoutes);
app.use("/api/admin/avaliacoes", adminAvaliacoesRoutes);
app.use("/api", chamadasRoutes);
app.use("/api/trabalhos", trabalhosRoutes);
app.use("/api/votacoes", votacoesRoutes);
app.use("/api", lookupsPublicRoutes);
app.use("/api/salas", salasRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/questionarios", require("./routes/questionariosRoute"));

/* ───────── Recuperação de senha ───────── */
app.post("/api/usuarios/recuperar-senha", recuperarSenhaLimiter, usuarioPublicoController.recuperarSenha);

/* ───────── Health & SPA fallback ───────── */
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, env: process.env.NODE_ENV || "dev" }));

function renderSpaIndex(res, next) {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return false;

  try {
    const html = fs.readFileSync(indexPath, "utf8").replaceAll("{{CSP_NONCE}}", res.locals.cspNonce);
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
  // Multer / upload
  if (err?.code === "LIMIT_FILE_SIZE") return sendError(res, 400, "Arquivo muito grande (máx. 50MB).");

  // CORS
  if (err?.code === "CORS_BLOCKED") {
    // não vaza origem em prod
    return sendError(res, 403, "Origem não autorizada.", { code: "CORS_BLOCKED" });
  }

  const status = err?.status || 500;

  // PREMIUM: Log consistente com requestId
  console.error("[ERROR]", {
    rid: req?.requestId,
    status,
    message: err?.message,
    stack: IS_DEV ? err?.stack : undefined,
  });

  // PREMIUM: em prod, mensagem genérica
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

    // fecha pool do DB se existir
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
