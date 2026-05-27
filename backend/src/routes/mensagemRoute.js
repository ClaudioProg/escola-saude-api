"use strict";

/**
 * ✅ backend/src/routes/mensagemRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais da Caixa de Mensagens Institucional.
 *
 * Mount oficial futuro:
 * - /api/mensagem
 *
 * Responsabilidades:
 * - Expor rotas de mensagens do usuário.
 * - Expor rotas administrativas da caixa de mensagens.
 * - Permitir consulta e resposta em conversas institucionais.
 *
 * Contratos aplicados:
 * - Controller oficial: mensagemController
 * - Tabelas oficiais:
 *   - mensagem_conversas
 *   - mensagem_respostas
 * - Perfis oficiais:
 *   - usuario
 *   - organizador
 *   - administrador
 * - Sem aliases
 * - Sem legado
 * - Sem rotas paralelas
 *
 * Observação:
 * - O mount em backend/src/routes/index.js será feito no fechamento consolidado.
 */

const express = require("express");

const mensagemController = require("../controllers/mensagemController");
const authMiddleware = require("../auth/authMiddleware");

const router = express.Router();

/**
 * Todas as rotas da Caixa de Mensagens exigem autenticação.
 *
 * A validação de permissão administrativa é feita no service/controller,
 * para manter resposta padronizada e diagnóstico controlado.
 */
router.use(authMiddleware);

/* ─────────────────────────────────────────────────────────────
 * Usuário autenticado
 * ───────────────────────────────────────────────────────────── */

/**
 * POST /api/mensagem
 *
 * Abre uma nova conversa institucional.
 *
 * Body oficial:
 * {
 *   "assunto": "Dúvida sobre certificado",
 *   "categoria": "certificado",
 *   "prioridade": "normal",
 *   "mensagem": "Texto da dúvida ou solicitação."
 * }
 */
router.post("/", mensagemController.abrirConversa);

/**
 * GET /api/mensagem/minhas
 *
 * Lista as conversas do próprio usuário autenticado.
 *
 * Query params opcionais:
 * - status
 * - categoria
 * - pagina
 * - limite
 */
router.get("/minhas", mensagemController.listarMinhasConversas);

/**
 * GET /api/mensagem/:id
 *
 * Consulta uma conversa específica.
 *
 * Regras:
 * - usuário comum só acessa a própria conversa;
 * - administrador acessa qualquer conversa.
 */
router.get("/:id", mensagemController.obterConversa);

/**
 * POST /api/mensagem/:id/resposta
 *
 * Responde uma conversa.
 *
 * Body oficial:
 * {
 *   "mensagem": "Texto da resposta.",
 *   "visivel_usuario": true
 * }
 *
 * Observação:
 * - visivel_usuario só é respeitado para administrador.
 * - usuário comum sempre envia resposta visível.
 */
router.post("/:id/resposta", mensagemController.responderConversa);

/* ─────────────────────────────────────────────────────────────
 * Administração
 * ───────────────────────────────────────────────────────────── */

/**
 * GET /api/mensagem/admin/resumo
 *
 * Retorna resumo administrativo da caixa de mensagens.
 */
router.get("/admin/resumo", mensagemController.resumoMensagensAdmin);

/**
 * GET /api/mensagem/admin
 *
 * Lista todas as conversas para administradores.
 *
 * Query params opcionais:
 * - status
 * - categoria
 * - prioridade
 * - usuario_id
 * - atribuido_para
 * - busca
 * - data_inicio
 * - data_fim
 * - pagina
 * - limite
 */
router.get("/admin", mensagemController.listarConversasAdmin);

/**
 * PATCH /api/mensagem/admin/:id
 *
 * Atualiza dados administrativos da conversa:
 * - status
 * - prioridade
 * - atribuido_para
 * - motivo_encerramento
 *
 * Body oficial:
 * {
 *   "status": "em_atendimento",
 *   "prioridade": "alta",
 *   "atribuido_para": 17,
 *   "motivo_encerramento": null
 * }
 */
router.patch("/admin/:id", mensagemController.atualizarConversaAdmin);

module.exports = router;