// 📁 server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");

// Rotas
const assinaturaRoutes            = require("./routes/assinaturaRoutes");
const turmasRouteAdministrador    = require("./routes/turmasRouteAdministrador");
const agendaRoute                 = require("./routes/agendaRoute");
const avaliacoesRoute            = require("./routes/avaliacoesRoute"); // ✅ plural
const certificadosRoute           = require("./routes/certificadosRoute");
const certificadosHistoricoRoute  = require("./routes/certificadosHistoricoRoutes");
const certificadosAvulsosRoutes   = require("./routes/certificadosAvulsosRoutes");
const eventosRoute                = require("./routes/eventosRoute");

// 🔁 CORRIGIDO: nome do arquivo no plural
const inscricoesRoute             = require("./routes/inscricoesRoute");

const loginRoute                  = require("./routes/loginRoute");
const presencasRoute              = require("./routes/presencasRoute");
const relatorioPresencasRoute     = require("./routes/relatorioPresencasRoute");
const turmasRoute                 = require("./routes/turmasRoute");
const instrutorRoute              = require("./routes/instrutorRoutes");   // ✅ confere com arquivo
const relatoriosRoute             = require("./routes/relatoriosRoutes");
const dashboardAnaliticoRoutes    = require("./routes/dashboardAnaliticoRoutes");
const dashboardUsuarioRoute       = require("./routes/dashboardUsuarioRoute");
const notificacoesRoute           = require("./routes/notificacoesRoute");
const authGoogleRoute             = require("./auth/authGoogle");
const unidadesRoutes              = require("./routes/unidadesRoutes");
const usuarioPublicoController    = require("./controllers/usuarioPublicoController");
const datasEventoRoute            = require("./routes/datasEventoRoute");

// 🆕 Perfil (opções/leitura/atualização do cadastro)
const perfilRoutes                = require("./routes/perfilRoutes");

// 🆕➕ Lookups públicos (sem auth)
const publicLookupsRoutes         = require("./routes/publicLookupsRoutes");

// 🧑‍💼 Usuários (público/admin)
const usuariosRoute               = require("./routes/usuariosRoute");

dotenv.config();

// 🔐 valida env essencial em produção
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
    console.error("❌ JWT_SECRET ou GOOGLE_CLIENT_ID não definido.");
    process.exit(1);
  }
}

const app = express();

// 🔧 Render / Vercel podem ficar atrás de proxy
app.set("trust proxy", 1);

// 🛡️ Segurança sem quebrar embeds/iframes de outras origens
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: process.env.NODE_ENV === "production" ? undefined : false,
  })
);

// 📦 compactação
app.use(compression());

// 🗂 temp
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// 🔌 DB (garante conexão/tentativa inicial)
require("./db");

/* 🌐 CORS — DEVE vir antes de qualquer rota ou auth */
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
    if (!origin) return cb(null, true); // curl/SSR/health
    if (allowedOrigins.includes(origin) || vercelRegex.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error("CORS bloqueado: " + origin));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition", "X-Perfil-Incompleto"],
  credentials: true,
  maxAge: 60 * 60,
};

// aplica CORS globalmente
app.use(cors(corsOptions));
// ajuda caches/CDNs a variarem por Origin
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});
// responde a TODOS os preflights com os headers CORS já aplicados
app.options("*", cors(corsOptions), (req, res) => res.sendStatus(204));

// 📨 body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ➕ Endpoints PÚBLICOS de lookups (sem token) — REGISTRAR ANTES das outras rotas
app.use("/api", publicLookupsRoutes);

// 🗃️ Static
app.use(express.static(path.join(__dirname, "public")));

// 📝 Logger em dev
if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

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

/* 📌 Rotas da API (CORS já está aplicado acima) */
app.use("/api/administrador/turmas", turmasRouteAdministrador);
app.use("/api/agenda", agendaRoute);

// ✅ Avaliações (inclui rota do instrutor `/turma/:id` e admin `/turma/:id/all`)
app.use("/api/avaliacoes", avaliacoesRoute);

app.use("/api/certificados", certificadosRoute);
app.use("/api/certificados-historico", certificadosHistoricoRoute);
app.use("/api/certificados-avulsos", certificadosAvulsosRoutes);
app.use("/api/eventos", eventosRoute);

// 🔗 Inscrições (inclui DELETE /inscricoes/minha/:turmaId e admin)
app.use("/api/inscricoes", inscricoesRoute);

app.use("/api/presencas", presencasRoute);
app.use("/api/relatorio-presencas", relatorioPresencasRoute);
app.use("/api/turmas", turmasRoute);

// 👤 Usuários (público/admin) — mantém caminho clássico
app.use("/api/usuarios", usuariosRoute);

// 👨‍🏫 Instrutor (minhas turmas + admin endpoints)
app.use("/api/instrutor", instrutorRoute);

app.use("/api/relatorios", relatoriosRoute);
app.use("/api/dashboard-analitico", dashboardAnaliticoRoutes);
app.use("/api/dashboard-usuario", dashboardUsuarioRoute);
app.use("/api/notificacoes", notificacoesRoute);
app.use("/api/auth", authGoogleRoute);
app.use("/api/unidades", unidadesRoutes);
app.use("/api/assinatura", assinaturaRoutes);
app.use("/api/datas", datasEventoRoute);

// 🆕 Rotas de Perfil (opções/me/update)
app.use("/api/perfil", perfilRoutes);
// alias adicional para compatibilidade com chamadas em /api/usuarios/perfil/*
app.use("/api/usuarios/perfil", perfilRoutes);

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

// erro global (mantém headers CORS, pois CORS já foi aplicado acima)
app.use((err, req, res, _next) => {
  console.error("Erro inesperado:", err.stack || err.message || err);
  const status = err.status || 500;
  res.status(status).json({ erro: err.message || "Erro interno do servidor" });
});

// 🚀 start + graceful shutdown
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
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
