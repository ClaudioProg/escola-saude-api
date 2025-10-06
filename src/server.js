// 📁 server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");

// ⚠️ .env
dotenv.config();

/* ───────── DB (adapter com any/oneOrNone/tx) ───────── */
const { db } = require("./db");

/* ───────── Rotas existentes ───────── */
const assinaturaRoutes            = require("./routes/assinaturaRoutes");
const turmasRouteAdministrador    = require("./routes/turmasRouteAdministrador");
const agendaRoute                 = require("./routes/agendaRoute");
const avaliacoesRoute             = require("./routes/avaliacoesRoute");
const certificadosRoute           = require("./routes/certificadosRoute");
const certificadosHistoricoRoute  = require("./routes/certificadosHistoricoRoutes");
const certificadosAvulsosRoutes   = require("./routes/certificadosAvulsosRoutes");
const eventosRoute                = require("./routes/eventosRoute");
const inscricoesRoute             = require("./routes/inscricoesRoute");
const loginRoute                  = require("./routes/loginRoute");
const presencasRoute              = require("./routes/presencasRoute");
const relatorioPresencasRoute     = require("./routes/relatorioPresencasRoute");
const turmasRoute                 = require("./routes/turmasRoute");
const instrutorRoute              = require("./routes/instrutorRoutes");
const relatoriosRoute             = require("./routes/relatoriosRoutes");
const dashboardAnaliticoRoutes    = require("./routes/dashboardAnaliticoRoutes");
const dashboardUsuarioRoute       = require("./routes/dashboardUsuarioRoute");
const notificacoesRoute           = require("./routes/notificacoesRoute");
const authGoogleRoute             = require("./auth/authGoogle");
const unidadesRoutes              = require("./routes/unidadesRoutes");
const usuarioPublicoController    = require("./controllers/usuarioPublicoController");
const datasEventoRoute            = require("./routes/datasEventoRoute");
const perfilRoutes                = require("./routes/perfilRoutes");
const publicLookupsRoutes         = require("./routes/publicLookupsRoutes");
const usuariosRoute               = require("./routes/usuariosRoute");

/* 🆕 Submissão de Trabalhos */
const chamadasRoutes              = require("./routes/chamadasRoutes");
const trabalhosRoutes             = require("./routes/trabalhosRoutes");

/* 🆕 Upload/Modelo de Banner (agora com rotas por chamada) */
const uploadRoutes                = require("./routes/uploadRoutes");

/* ───────── ENV obrigatórios em produção ───────── */
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
    console.error("❌ JWT_SECRET ou GOOGLE_CLIENT_ID não definido.");
    process.exit(1);
  }
}

const app = express();

/* ───────── Hardening / perf ───────── */
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? undefined : false,
  })
);
app.use(compression());

/* ───────── CORS (GLOBAL + preflight) ───────── */
const fromEnv = (process.env.CORS_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
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
    if (!origin) return cb(null, true); // curl/Postman etc.
    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) return cb(null, true);
    return cb(new Error("CORS bloqueado: " + origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Accept",
    "Accept-Language",
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Origin",
    "Referer",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["Content-Disposition", "X-Perfil-Incompleto"],
  maxAge: 86400, // cache do preflight (1 dia)
};
app.use(cors(corsOptions));
app.use((req, res, next) => { res.setHeader("Vary", "Origin"); next(); });
app.options("*", cors(corsOptions), (_req, res) => res.sendStatus(204));

/* ───────── Parsers ───────── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ───────── Temp & Uploads ───────── */
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
// ⚠️ aplica CORS nos estáticos também:
app.use("/uploads", cors(corsOptions), express.static(uploadsDir, { maxAge: "1h", fallthrough: true }));

/* 🆕 Modelos por chamada: /api/modelos/chamadas/:id/banner.pptx */
const modelosPorChamadaDir = path.join(process.cwd(), "uploads", "modelos", "chamadas");
if (!fs.existsSync(modelosPorChamadaDir)) fs.mkdirSync(modelosPorChamadaDir, { recursive: true });
app.use("/api/modelos/chamadas", cors(corsOptions), express.static(modelosPorChamadaDir, { maxAge: "1d", fallthrough: true }));

/* (legado) Diretório de modelos públicos (public/modelos) */
const modelosDir = path.join(__dirname, "public", "modelos");
if (!fs.existsSync(modelosDir)) fs.mkdirSync(modelosDir, { recursive: true });
// Serve /api/modelos/* diretamente do public/modelos
app.use("/api/modelos", cors(corsOptions), express.static(modelosDir, { maxAge: "1d", fallthrough: true }));

/* ───────── DB fallback global ───────── */
app.use((req, _res, next) => {
  if (!req.db) req.db = db;
  next();
});

/* ───────── Estáticos públicos ───────── */
app.use(express.static(path.join(__dirname, "public")));

/* ───────── Logger dev ───────── */
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

/* ───────── Rotas públicas ───────── */
app.use("/api", publicLookupsRoutes);
app.use("/api/login", loginLimiter, loginRoute);

/* ───────── Rotas API ───────── */
app.use("/api/administrador/turmas", turmasRouteAdministrador);
app.use("/api/agenda", agendaRoute);
app.use("/api/avaliacoes", avaliacoesRoute);
app.use("/api/certificados", certificadosRoute);
app.use("/api/certificados-historico", certificadosHistoricoRoute);
app.use("/api/certificados-avulsos", certificadosAvulsosRoutes);
app.use("/api/eventos", eventosRoute);
app.use("/api/inscricoes", inscricoesRoute);
app.use("/api/presencas", presencasRoute);
app.use("/api/relatorio-presencas", relatorioPresencasRoute);
app.use("/api/turmas", turmasRoute);
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
app.use("/api/usuarios/perfil", perfilRoutes);

/* 🆕 Submissões de Trabalhos */
app.use("/api", chamadasRoutes);
app.use("/api", trabalhosRoutes);

/* 🆕 Upload/Modelo de Banner (inclui rotas por chamada) */
app.use("/api", uploadRoutes);

/* ───────── Recuperação de senha ───────── */
app.post("/api/usuarios/recuperar-senha", recuperarSenhaLimiter, usuarioPublicoController.recuperarSenha);

/* ───────── Health & Root ───────── */
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, env: process.env.NODE_ENV || "dev" }));
app.get("/", (_req, res) => res.send("🟢 API da Escola da Saúde rodando!"));

/* ───────── 404 ───────── */
app.use((req, res, next) => {
  if (req.url.startsWith("/uploads/") && req.method === "GET") {
    return res.status(404).end();
  }
  return res.status(404).json({ erro: "Rota não encontrada" });
});

/* ───────── Error handler (inclui multer) ───────── */
app.use((err, _req, res, _next) => {
  if (err && (err.code === "LIMIT_FILE_SIZE" || err.field === "poster")) {
    return res.status(400).json({ erro: err.message || "Falha no upload." });
  }
  console.error("Erro inesperado:", err.stack || err.message || err);
  res.status(err.status || 500).json({ erro: err.message || "Erro interno do servidor" });
});

/* ───────── Start & Shutdown ───────── */
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`🟢🚀 Servidor rodando na porta ${PORT} 🟢`));

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
