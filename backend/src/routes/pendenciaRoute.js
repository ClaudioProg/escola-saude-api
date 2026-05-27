"use strict";

/**
 * ✅ backend/src/routes/pendenciaRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais do Painel de Pendências Administrativas.
 *
 * Mount oficial futuro:
 * - /api/pendencia
 *
 * Responsabilidades:
 * - Expor listagem de pendências administrativas.
 * - Expor resumo consolidado de pendências.
 * - Permitir consulta de pendência específica por pendencia_id.
 *
 * Contratos aplicados:
 * - Controller oficial: pendenciaController
 * - View oficial: v_pendencias_administrativas
 * - Perfil obrigatório: administrador
 * - Sem aliases
 * - Sem legado
 * - Sem rotas paralelas
 *
 * Observação:
 * - O mount em backend/src/routes/index.js será feito no fechamento consolidado.
 */

const express = require("express");

const pendenciaController = require("../controllers/pendenciaController");
const authMiddleware = require("../auth/authMiddleware");

const router = express.Router();

/**
 * Todas as rotas de pendências exigem autenticação.
 *
 * A validação específica de perfil administrador é feita no service,
 * para manter resposta padronizada e diagnóstico controlado.
 */
router.use(authMiddleware);

/**
 * GET /api/pendencia/resumo
 *
 * Retorna resumo consolidado das pendências administrativas.
 *
 * Query params opcionais:
 * - modulo
 * - tipo
 * - severidade
 * - prioridade
 * - status
 * - entidade
 * - entidade_id
 * - origem
 * - usuario_id
 * - busca
 * - data_inicio
 * - data_fim
 */
router.get("/resumo", pendenciaController.resumo);

/**
 * GET /api/pendencia
 *
 * Lista pendências administrativas derivadas da view oficial.
 *
 * Query params opcionais:
 * - modulo
 * - tipo
 * - severidade
 * - prioridade
 * - status
 * - entidade
 * - entidade_id
 * - origem
 * - usuario_id
 * - busca
 * - data_inicio
 * - data_fim
 * - pagina
 * - limite
 */
router.get("/", pendenciaController.listar);

/**
 * GET /api/pendencia/:pendencia_id
 *
 * Consulta uma pendência administrativa específica.
 *
 * Observação:
 * - pendencia_id é textual, porque a view consolida pendências derivadas
 *   de múltiplas fontes.
 */
router.get("/:pendencia_id", pendenciaController.obterPorId);

module.exports = router;