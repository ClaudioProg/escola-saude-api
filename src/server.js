// 📁 server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");
const crypto = require("crypto");
const morgan = require("morgan"); // ⬅️ logger

// ⚙️ .env
dotenv.config();

/* ───────── DB (adapter) ───────── */
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
const publicLookupsRoutes = require("./routes/publicLookupsRoutes");
const usuariosRoute = require("./routes/usuariosRoute");
const metricasRoutes = require("./routes/metricasRoutes");
const solicitacoesCursoRoute = require("./routes/solicitacoesCursoRoute");
const adminAvaliacoesRoutes = require("./routes/adminAvaliacoesRoutes");
const chamadasRoutes = require("./routes/chamadasRoutes");
const trabalhosRoutes = require("./routes/trabalhosRoutes");
const chamadasModeloRoutes = require("./routes/chamadasModeloRoutes");
const usuariosEstatisticasRoute = require("./routes/usuariosEstatisticasRoute");
const submissoesAdminRoutes = require("./routes/submissoesAdminRoutes");
const unidadesRoute = require("./routes/unidadesRoute");

const IS_DEV = process.env.NODE_ENV !== "production";
const app = express();
app.disable("x-powered-by");

/* ───────── Hardening / perf ───────── */
app.set("trust proxy", 1);

// Nonce por requisição (CSP)
app.use((_, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});

// Helmet + CSP
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: IS_DEV ? false : undefined,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:", "https:", "blob:"],
        "object-src": ["'none'"],
        "script-src": [
          "'self'",
          "https://accounts.google.com",
          "https://www.gstatic.com",
          (_, res) => `'nonce-${res.locals.cspNonce}'`,
          "'strict-dynamic'",
          ...(IS_DEV ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://accounts.google.com/gsi/style",
        ],
        "connect-src": [
          "'self'",
          "https://escola-saude-api.onrender.com",
          "https://accounts.google.com",
          "https://www.googleapis.com",
          ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
          ...(IS_DEV ? ["ws:", "http://localhost:5173", "http://127.0.0.1:5173"] : []),
        ],
        "frame-src": ["https://accounts.google.com"],
      },
    },
  })
);

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
    const err = new Error("CORS bloqueado: " + origin);
    err.status = 403;
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
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use((_, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});
app.options("*", cors(corsOptions), (_req, res) => res.sendStatus(204));

/* ───────── Parsers ───────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ───────── Diretórios ───────── */
ensureDir(DATA_ROOT);
ensureDir(UPLOADS_DIR);
ensureDir(MODELOS_CHAMADAS_DIR);
ensureDir(CERT_DIR);
console.log("[FILES] DATA_ROOT:", DATA_ROOT);
console.log("[FILES] UPLOADS_DIR:", UPLOADS_DIR);
console.log("[FILES] MODELOS_CHAMADAS_DIR:", MODELOS_CHAMADAS_DIR);
console.log("[FILES] CERT_DIR:", CERT_DIR);

app.use(
  "/uploads",
  cors(corsOptions),
  express.static(UPLOADS_DIR, {
    maxAge: "1h",
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=3600");
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
app.use(morgan(':date[iso] :method :url :status :res[content-length] - :response-time ms'));
if (IS_DEV) {
  app.use((req, _res, next) => {
    console.log("[DEV-REQ]", { method: req.method, url: req.url });
    next();
  });
}

/* ───────── Rate limiters ───────── */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { erro: "Muitas tentativas, tente novamente em alguns minutos." },
});
const recuperarSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { erro: "Muitas solicitações, aguarde antes de tentar novamente." },
});

/* ───────── Rotas de diagnóstico ───────── */
app.get("/__version", (req, res) => {
  res.json({
    service: process.env.RENDER_SERVICE_NAME || "escola-saude-api",
    commit: process.env.RENDER_GIT_COMMIT || "local",
    node: process.version,
    now: new Date().toISOString(),
  });
});
app.get("/__ping", (req, res) => {
  console.log("[PING]", {
    ip: req.headers["x-forwarded-for"] || req.ip,
    ua: req.headers["user-agent"],
  });
  res.json({ ok: true });
});

/* ───────── Rotas ───────── */
app.use("/api", publicLookupsRoutes);
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
app.use("/api/solicitacoes", solicitacoesCursoRoute);
app.use("/api", chamadasModeloRoutes);
app.use("/api", submissoesAdminRoutes);
app.use("/api/admin/avaliacoes", adminAvaliacoesRoutes);
app.use("/api", chamadasRoutes);
app.use("/api", trabalhosRoutes);
app.use("/api/unidades", unidadesRoute);


/* ───────── Recuperação de senha ───────── */
app.post("/api/usuarios/recuperar-senha", recuperarSenhaLimiter, usuarioPublicoController.recuperarSenha);

/* ───────── Health & SPA fallback ───────── */
app.get("/api/health", (_req, res) =>
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "dev" })
);

app.get("/", (req, res, next) => {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    try {
      const html = fs
        .readFileSync(indexPath, "utf8")
        .replaceAll("{{CSP_NONCE}}", res.locals.cspNonce);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(html);
    } catch (e) {
      return next(e);
    }
  }
  return res.send("🟢 API da Escola da Saúde rodando!");
});

app.get(/^\/(?!api\/|uploads\/).+/, (req, res, next) => {
  const indexPath = path.join(PUBLIC_DIR, "index.html");
  if (!fs.existsSync(indexPath)) return next();
  try {
    const html = fs
      .readFileSync(indexPath, "utf8")
      .replaceAll("{{CSP_NONCE}}", res.locals.cspNonce);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (e) {
    return next(e);
  }
});

/* ───────── 404 / Errors ───────── */
app.use((req, res) => {
  if (req.url.startsWith("/uploads/") && req.method === "GET") return res.status(404).end();
  return res.status(404).json({ erro: "Rota não encontrada" });
});

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ erro: "Arquivo muito grande (máx. 50MB)." });
  console.error("Erro inesperado:", err.stack || err.message || err);
  res.status(err.status || 500).json({ erro: err.message || "Erro interno do servidor" });
});

/* ───────── Start / Shutdown ───────── */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🟢🚀 Servidor rodando na porta ${PORT} 🟢`);
});

function shutdown(signal) {
  console.log(`\n${signal} recebido. Encerrando servidor...`);
  server.close(() => {
    console.log("✅ HTTP fechado.");
    process.exit(0);
  });
  setTimeout(() => {
    console.warn("⏱️ Forçando shutdown.");
    process.exit(1);
  }, 10_000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
