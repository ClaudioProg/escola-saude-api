const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const rateLimit = require('express-rate-limit');
const assinaturaRoutes = require("./routes/assinatura.routes");


// 🌎 Carrega variáveis de ambiente .env
dotenv.config();

// Criação automática da pasta temp
const fs = require('fs');
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 🔐 Valida presença de variáveis essenciais (parar app em produção se faltar)
if (!process.env.JWT_SECRET || !process.env.GOOGLE_CLIENT_ID) {
  console.error('❌ JWT_SECRET ou GOOGLE_CLIENT_ID não definido no .env');
  process.exit(1); // Encerra aplicação para evitar funcionamento inseguro
}

const app = express();

// 🔌 Conexão com o banco de dados (import garante conexão/tentativa inicial)
const db = require('./db');

// 🌐 Middlewares globais
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Defina FRONTEND_URL no .env para mais segurança
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Protege contra payloads gigantes
app.use(express.static(path.join(__dirname, 'public')));

// 🛡️ Cabeçalhos de segurança (COOP e COEP)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// 📝 Logger de requisições (opcional para desenvolvimento)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// 📦 Importação de rotas (ordem alfabética e nomes padronizados)
const administradorTurmasRoute         = require('./routes/administradorTurmasRoute');
const agendaRoute              = require('./routes/agendaRoute');
const avaliacoesRoute          = require('./routes/avaliacoesRoute');
const certificadosRoute        = require('./routes/certificadosRoute');
const eventosRoute             = require('./routes/eventosRoute');
const inscricoesRoute          = require('./routes/inscricoesRoute');
const loginRoute               = require('./routes/loginRoute');
const presencasRoute           = require('./routes/presencasRoute');
const relatorioPresencasRoute  = require('./routes/relatorioPresencasRoute');
const turmasRoute              = require('./routes/turmasRoute');
const usuariosRoute            = require('./routes/usuariosRoute');
const certificadosHistoricoRoute = require('./routes/certificadosHistoricoRoutes');
const instrutorRoute        = require('./routes/instrutorRoutes');
const relatoriosRoute          = require('./routes/relatoriosRoutes');
const dashboardAnaliticoRoutes = require("./routes/dashboardAnaliticoRoutes");
const dashboardUsuarioRoute    = require("./routes/dashboardUsuarioRoute");
const notificacoesRoute        = require("./routes/notificacoesRoute");
const authGoogleRoute          = require('./auth/authGoogle');
const unidadesRoutes           = require("./routes/unidadesRoutes");
const usuarioPublicoController = require('./controllers/usuarioPublicoController');
const certificadosAvulsosRoutes = require("./routes/certificadosAvulsosRoutes");

// Limite para login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { erro: 'Muitas tentativas, tente novamente em alguns minutos.' }
});

// Limite para recuperação de senha
const recuperarSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { erro: 'Muitas solicitações, aguarde antes de tentar novamente.' }
});

// Limite para login
app.use('/api/login', loginLimiter, loginRoute);

// 📌 Rotas da API (padronizadas como '/api/xxx')
app.use('/api/administrador/turmas', administradorTurmasRoute);
app.use('/api/agenda', agendaRoute);
app.use('/api/avaliacoes', avaliacoesRoute);
app.use('/api/certificados', certificadosRoute);
app.use('/api/eventos', eventosRoute);
app.use('/api/inscricoes', inscricoesRoute);
app.use('/api/presencas', presencasRoute);
app.use('/api/relatorio-presencas', relatorioPresencasRoute);
app.use('/api/turmas', turmasRoute);
app.use('/api/usuarios', usuariosRoute);
app.use('/api/auth', authGoogleRoute);
app.use('/api/dashboard-analitico', dashboardAnaliticoRoutes);
app.use('/api/dashboard-usuario', dashboardUsuarioRoute);
app.use('/api/certificados-historico', certificadosHistoricoRoute);
app.use('/api/instrutor', instrutorRoute);
app.use('/api/relatorios', relatoriosRoute);
app.use('/api/unidades', unidadesRoutes);
app.use('/api/assinatura', assinaturaRoutes);
app.use('/api/notificacoes', notificacoesRoute);
app.post('/api/usuarios/recuperar-senha', recuperarSenhaLimiter, usuarioPublicoController.recuperarSenha);
app.use("/api/certificados-avulsos", certificadosAvulsosRoutes);

// 🔎 Health check
app.get('/', (req, res) => {
  res.send('🟢 API da Escola da Saúde rodando!');
});

// 🛠️ 404 Handler
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// 💥 Erro global
app.use((err, req, res, next) => {
  console.error('Erro inesperado:', err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// 🚀 Inicialização
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

module.exports = {
  // outros métodos se necessário
};