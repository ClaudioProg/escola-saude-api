/* eslint-disable no-console */
"use strict";

/**
 * ✅ backend/src/routes/notificacaoProgramadaRoute.js — v2.0
 * Atualizado em: 15/05/2026
 * Plataforma Escola da Saúde
 *
 * Função:
 * - Rotas administrativas de notificações programadas.
 *
 * Mount oficial:
 * - app.use("/api/notificacao-programada", notificacaoProgramadaRoute);
 *
 * Endpoints oficiais:
 * - GET  /diagnostico/lembrete-evento
 * - POST /executar/lembrete-evento
 *
 * Segurança:
 * - Requer autenticação.
 * - Controller valida perfil oficial: administrador.
 *
 * Sem:
 * - plural paralelo;
 * - rota antiga;
 * - alias;
 * - fallback;
 * - auth resiliente.
 */

const express = require("express");

const requireAuth = require("../auth/authMiddleware");

const {
  diagnosticarLembreteEvento,
  executarLembreteEvento,
} = require("../controllers/notificacaoProgramadaController");

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   Lembrete de início de evento/curso
────────────────────────────────────────────────────────────── */

router.get(
  "/diagnostico/lembrete-evento",
  requireAuth,
  diagnosticarLembreteEvento
);

router.post(
  "/executar/lembrete-evento",
  requireAuth,
  executarLembreteEvento
);

module.exports = router;