"use strict";

/**
 * ✅ backend/src/routes/mensagemRoute.js — v2.1
 * Atualizado em: 29/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais da Caixa de Mensagens Institucional.
 *
 * Mount oficial:
 * - /api/mensagem
 *
 * Regra estrutural:
 * - rotas fixas/específicas sempre antes de rotas dinâmicas;
 * - /admin precisa vir antes de /:id;
 * - sem aliases;
 * - sem legado;
 * - sem rotas paralelas.
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
 * Administração
 * IMPORTANTE:
 * Estas rotas precisam vir antes de /:id.
 * Caso contrário, "admin" será interpretado como id de conversa.
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
 * GET /api/mensagem/admin/:id
 *
 * Consulta uma conversa específica pela visão administrativa.
 *
 * Regras:
 * - exige autenticação;
 * - permissão administrativa validada no controller/service;
 * - retorna conversa e histórico completo.
 */
router.get("/admin/:id", mensagemController.obterConversa);

/**
 * POST /api/mensagem/admin/:id/resposta
 *
 * Responde uma conversa pela visão administrativa.
 */
router.post("/admin/:id/resposta", mensagemController.responderConversa);

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

/* ─────────────────────────────────────────────────────────────
 * Usuário autenticado
 * ───────────────────────────────────────────────────────────── */

/**
 * POST /api/mensagem
 *
 * Abre uma nova conversa institucional.
 */
router.post("/", mensagemController.abrirConversa);

/**
 * GET /api/mensagem/minhas
 *
 * Lista as conversas do próprio usuário autenticado.
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

module.exports = router;