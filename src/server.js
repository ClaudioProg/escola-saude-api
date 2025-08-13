// 📁 server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

// Rotas
const assinaturaRoutes = require("./routes/assinaturaRoutes");
const administradorTurmasRoute   = require("./routes/administradorTurmasRoute");
const agendaRoute                = require("./routes/agendaRoute");
const avaliacoesRoute            = require("./routes/avaliacoesRoute");
const certificadosRoute          = require("./routes/certificadosRoute");
const certificadosHistoricoRoute = require("./routes/certificadosHistoricoRoutes");
const certificadosAvulsosRoutes  = require("./routes/certificadosAvulsosRoutes");
const eventosRoute               = require("./routes/eventosRoute");
const inscricoesRoute            = require("./routes/inscricoesRoute");
const loginRoute                 = require("./routes/loginRoute");
const presencasRoute             = require("./routes/presencasRoute");
const relatorioPresencasRoute    = require("./routes/relatorioPresencasRoute");
const turmasRoute                = require("./routes/turmasRoute");
const instrutorRoute             = require("./routes/instrutorRoutes");
const relatoriosRoute            = require("./routes/relatoriosRoutes");
const dashboardAnaliticoRoutes   = require("./routes/dashboardAnaliticoRoutes");
const dashboardUsuarioRoute      = require("./routes/dashboardUsuarioRoute");
const notificacoesRoute          = require("./routes/notificacoesRoute");
const authGoogleRoute            = require("./auth/authGoogle");
const unidadesRoutes             = require("./routes/unidadesRoutes");
const usuarioPublicoController   = require("./controllers/usuarioPublicoController");
const datasEventoRoute           = require("./routes/datasEventoRoute");
const usuariosRoute              = require("./routes/usuariosRoute");

dotenv.config();

// 🔐 valida env essencial em produção
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
    console.error("❌ JWT_SECRET ou GOOGLE_CLIENT_ID não definido.");
    process.exit(1);
  }
}

const app = express();

// 🔧 Render fica atrás de proxy
app.set("trust proxy", 1);

// 📦 compactação
app.use(compression());

// 🗂 temp
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// 🔌 DB (garante conexão/tentativa inicial)
require("./db");

// 🌐 CORS
// Permite lista do .env (CORS_ORIGINS="https://site1.com,https://site2.com")
// + localhost em dev + subdomínios vercel (*.vercel.app)
const fromEnv =
  (process.env.CORS_ORIGINS || "")
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

// Regex para *.vercel.app
const vercelRegex = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(
  cors({
    origin(origin, cb) {
      // Sem origin: permitir (ex: curl, health, SSR)
      if (!origin) return cb(null, true);
      if (
        allowedOrigins.includes(origin) ||
        vercelRegex.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error("CORS bloqueado: " + origin));
    },
    credentials: true,
  })
);

// JSON
app.use(express.json({ limit: "10mb" }));

// Static
app.use(express.static(path.join(__dirname, "public")));

// ❌ Removido COOP/COEP: quebram recursos cross-origin em Vercel

// 📝 Logger em dev
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// 🧪 Preflight helper (evita 404 em OPTIONS)
app.options("*", cors());

// 🧯 Rate limiters
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

// 🔐 login
app.use("/api/login", loginLimiter, loginRoute);

// 📌 Rotas
app.use("/api/administrador/turmas", administradorTurmasRoute);
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

// recuperação de senha (com limiter)
app.post(
  "/api/usuarios/recuperar-senha",
  recuperarSenhaLimiter,
  usuarioPublicoController.recuperarSenha
);

// 🔎 Health
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, env: process.env.NODE_ENV || "dev" });
});

// 🏠 root
app.get("/", (req, res) => {
  res.send("🟢 API da Escola da Saúde rodando!");
});

// 404
app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

// erro global
app.use((err, req, res, next) => {
  console.error("Erro inesperado:", err.stack || err.message || err);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

// 🚀 start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
