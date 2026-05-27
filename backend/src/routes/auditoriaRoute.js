"use strict";

/**
 * ✅ backend/src/routes/auditoriaRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais da Auditoria Premium Centralizada.
 *
 * Mount oficial:
 * - /api/auditoria
 *
 * Responsabilidades:
 * - Expor consultas administrativas da auditoria centralizada.
 * - Permitir consulta por ID.
 * - Permitir resumo administrativo.
 * - Permitir registro manual/técnico restrito a administrador.
 *
 * Contratos aplicados:
 * - Controller oficial: auditoriaController
 * - Tabela oficial: auditoria_eventos
 * - Perfil obrigatório: administrador
 * - Sem aliases
 * - Sem legado
 * - Sem rotas paralelas
 */

const express = require("express");

const auditoriaController = require("../controllers/auditoriaController");
const authMiddleware = require("../auth/authMiddleware");

const router = express.Router();

/**
 * Todas as rotas de auditoria exigem autenticação.
 *
 * A validação específica de perfil administrador é feita também no controller,
 * para manter diagnóstico controlado e resposta padronizada.
 */
router.use(authMiddleware);

/**
 * GET /api/auditoria/resumo
 *
 * Lista resumo consolidado da auditoria:
 * - total geral
 * - total por sucesso/falha
 * - total por severidade
 * - ranking por módulo
 * - ranking por ação
 *
 * Query params opcionais:
 * - data_inicio
 * - data_fim
 */
router.get("/resumo", auditoriaController.resumo);

/**
 * GET /api/auditoria
 *
 * Lista eventos de auditoria com filtros administrativos.
 *
 * Query params opcionais:
 * - usuario_id
 * - modulo
 * - acao
 * - entidade
 * - entidade_id
 * - sucesso
 * - severidade
 * - request_id
 * - data_inicio
 * - data_fim
 * - limite
 * - pagina
 */
router.get("/", auditoriaController.listar);

/**
 * GET /api/auditoria/:id
 *
 * Consulta um evento de auditoria específico.
 */
router.get("/:id", auditoriaController.obterPorId);

/**
 * POST /api/auditoria
 *
 * Registra evento manual/técnico de auditoria.
 *
 * Uso restrito:
 * - administrador
 *
 * Body oficial:
 * {
 *   "acao": "diagnostico_manual",
 *   "modulo": "saude_plataforma",
 *   "entidade": "verificacao",
 *   "entidade_id": "opcional",
 *   "sucesso": true,
 *   "severidade": "info",
 *   "dados_anteriores": null,
 *   "dados_novos": null,
 *   "detalhes": {},
 *   "mensagem": "Mensagem institucional",
 *   "admin_hint": "Diagnóstico técnico controlado"
 * }
 */
router.post("/", auditoriaController.registrarManual);

module.exports = router;