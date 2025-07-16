const express = require('express');
const router = express.Router();

// 📁 Importações organizadas (ordem alfabética para facilitar manutenção)
const administradorTurmasRoute            = require('./administradorTurmasRoute');
const agendaRoute                 = require('./agendaRoute');
const authGoogleRoute             = require('./authGoogleRoute');
const avaliacoesRoute             = require('./avaliacoesRoute');
const certificadosRoute           = require('./certificadosRoute');
const certificadosHistoricoRoute  = require('./certificadosHistoricoRoute');
const dashboardAnaliticoRoute     = require('./dashboardAnaliticoRoute');
const eventosRoute                = require('./eventosRoute');
const inscricoesRoute             = require('./inscricoesRoute');
const loginRoute                  = require('./loginRoute');
const instrutorRoute           = require('./instrutorRoute');
const presencasRoute              = require('./presencasRoute');
const relatorioPresencasRoute     = require('./relatorioPresencasRoute');
const relatoriosRoute             = require('./relatoriosRoute');
const turmasRoute                 = require('./turmasRoute');
const usuariosRoute               = require('./usuariosRoute');
const notificacoesRoute           = require('./notificacoesRoute');

// 📌 Definições de rota base
router.use('/administrador/turmas', administradorTurmasRoute);
router.use('/agenda', agendaRoute);
router.use('/auth', authGoogleRoute);
router.use('/avaliacoes', avaliacoesRoute);
router.use('/certificados', certificadosRoute);
router.use('/certificados-historico', certificadosHistoricoRoute);
router.use('/dashboard-analitico', dashboardAnaliticoRoute);
router.use('/eventos', eventosRoute);
router.use('/inscricoes', inscricoesRoute);
router.use('/login', loginRoute);
router.use('/instrutor', instrutorRoute);
router.use('/presencas', presencasRoute);
router.use('/relatorio-presencas', relatorioPresencasRoute);
router.use('/relatorios', relatoriosRoute);
router.use('/turmas', turmasRoute);
router.use('/usuarios', usuariosRoute);
router.use('/notificacoes', notificacoesRoute);

module.exports = router;
