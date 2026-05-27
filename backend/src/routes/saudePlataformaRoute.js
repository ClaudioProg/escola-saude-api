"use strict";

/**
 * ✅ backend/src/routes/saudePlataformaRoute.js — v2.0
 * Atualizado em: 19/05/2026
 * Plataforma Escola da Saúde
 *
 * Rotas oficiais da Saúde da Plataforma.
 *
 * Mount oficial futuro:
 * - /api/saude-plataforma
 *
 * Responsabilidades:
 * - Expor indicadores consolidados da Saúde da Plataforma.
 * - Expor resumo executivo.
 * - Expor diagnóstico executivo com críticos e alertas.
 * - Permitir consulta de indicador específico por indicador_id.
 *
 * Contratos aplicados:
 * - Controller oficial: saudePlataformaController
 * - View oficial: v_saude_plataforma
 * - Status oficiais:
 *   - saudavel
 *   - alerta
 *   - critico
 * - Severidades oficiais:
 *   - info
 *   - aviso
 *   - erro
 *   - critico
 * - Perfil obrigatório: administrador
 * - Sem aliases
 * - Sem legado
 * - Sem rotas paralelas
 *
 * Observação:
 * - O mount em backend/src/routes/index.js será feito no fechamento consolidado.
 */

const express = require("express");

const saudePlataformaController = require("../controllers/saudePlataformaController");
const authMiddleware = require("../auth/authMiddleware");

const router = express.Router();

/**
 * Todas as rotas da Saúde da Plataforma exigem autenticação.
 *
 * A validação específica de perfil administrador é feita no service,
 * para manter resposta padronizada e diagnóstico controlado.
 */
router.use(authMiddleware);

/**
 * GET /api/saude-plataforma/resumo
 *
 * Retorna resumo consolidado da saúde operacional:
 * - classificação geral
 * - totais por status
 * - totais por severidade
 * - agrupamento por módulo
 * - destaques principais
 *
 * Query params opcionais:
 * - indicador_id
 * - modulo
 * - status
 * - severidade
 * - janela
 * - busca
 */
router.get("/resumo", saudePlataformaController.resumo);

/**
 * GET /api/saude-plataforma/diagnostico
 *
 * Retorna diagnóstico executivo:
 * - resumo completo
 * - indicadores críticos
 * - indicadores em alerta
 */
router.get("/diagnostico", saudePlataformaController.diagnosticoExecutivo);

/**
 * GET /api/saude-plataforma
 *
 * Lista indicadores da Saúde da Plataforma.
 *
 * Query params opcionais:
 * - indicador_id
 * - modulo
 * - status
 * - severidade
 * - janela
 * - busca
 * - pagina
 * - limite
 */
router.get("/", saudePlataformaController.listar);

/**
 * GET /api/saude-plataforma/:indicador_id
 *
 * Consulta um indicador específico.
 *
 * Observação:
 * - indicador_id é textual porque vem de uma view diagnóstica consolidada.
 */
router.get("/:indicador_id", saudePlataformaController.obterPorId);

module.exports = router;