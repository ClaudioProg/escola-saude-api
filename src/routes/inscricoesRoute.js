// 📁 src/routes/inscricoesRoute.js
const express = require("express");
const router = express.Router();

const auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");
const inscricoesController = require("../controllers/inscricoesController");

// serviços/DB para validar acesso por registro
const db = require("../db");
const { podeVerEvento } = require('../services/eventoAcessoRegistroService');

/**
 * 🛡️ Middleware: valida se o usuário pode se inscrever na turma informada
 * (regra de visibilidade por REGISTRO do evento da turma).
 */
async function checarAcessoPorRegistroNaTurma(req, res, next) {
  try {
    const turmaId =
      req.body?.turma_id ||
      req.body?.turmaId ||
      req.params?.turma_id ||
      req.query?.turma_id;

    if (!turmaId) {
      return res.status(400).json({ ok: false, erro: "TURMA_ID_OBRIGATORIO" });
    }

    const { rows } = await db.query(
      "SELECT id, evento_id FROM turmas WHERE id = $1",
      [turmaId]
    );
    const turma = rows[0];
    if (!turma) {
      return res.status(400).json({ ok: false, erro: "TURMA_INVALIDA" });
    }

    const acesso = await podeVerEvento({
      usuarioId: req.user?.id || req.user?.id, // compat
      eventoId: turma.evento_id,
    });

    if (!acesso.ok) {
      // Motivos esperados: 'SEM_REGISTRO' | 'REGISTRO_NAO_AUTORIZADO' | ...
      return res.status(403).json({ ok: false, motivo: acesso.motivo });
    }

    return next();
  } catch (e) {
    console.error("ERRO checarAcessoPorRegistroNaTurma:", e);
    return res.status(500).json({ ok: false, erro: "ERRO_INTERNO" });
  }
}

/* ──────────────────────────────────────────────────────────
   📌 Inscrições
   ────────────────────────────────────────────────────────── */

// ➕ Inscrever (usuario/instrutor/administrador)
router.post(
  "/",
  auth,
  authorizeRoles("administrador", "instrutor", "usuario"),
  checarAcessoPorRegistroNaTurma,
  inscricoesController.inscreverEmTurma
);

// ❌ Cancelar minha inscrição (usuário autenticado)
router.delete(
  "/minha/:turmaId",
  auth,
  inscricoesController.cancelarMinhaInscricao
);

// ❌ Cancelar inscrição (ADMIN) de qualquer usuário
router.delete(
  "/:turmaId/usuario/:usuarioId",
  auth,
  authorizeRoles("administrador"),
  inscricoesController.cancelarInscricaoAdmin
);

// 👤 Minhas inscrições
router.get("/minhas", auth, inscricoesController.obterMinhasInscricoes);

// 📋 Listar inscritos da turma (instrutor/admin)
router.get(
  "/turma/:turma_id",
  auth,
  authorizeRoles("administrador", "instrutor"),
  inscricoesController.listarInscritosPorTurma
);

/* ──────────────────────────────────────────────────────────
   🧯 LEGADO: DELETE /inscricoes/:id
   Tenta tratar :id como inscricao_id; se não achar, tenta como turma_id
   para cancelar a própria inscrição. Mantém compatibilidade com frontend antigo.
   ────────────────────────────────────────────────────────── */
router.delete("/:id", auth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ erro: "ID inválido." });

  try {
    // 1) Tentar como inscrição_id
    const ins = await db.query(
      "SELECT usuario_id, turma_id FROM inscricoes WHERE id = $1",
      [id]
    );
    if (ins.rowCount) {
      const { usuario_id, turma_id } = ins.rows[0] || {};
      // se próprio usuário OU admin, permitir via controller admin (reuso)
      const isAdmin =
        (req.user?.perfil || req.user?.perfil || []).includes(
          "administrador"
        );
      const isSelf = Number(usuario_id) === Number(req.user?.id || req.user?.id);
      if (!isAdmin && !isSelf) {
        return res.status(403).json({ erro: "Sem permissão para cancelar esta inscrição." });
      }
      req.params.turmaId = turma_id;
      req.params.usuarioId = usuario_id;
      return inscricoesController.cancelarInscricaoAdmin(req, res);
    }

    // 2) Caso contrário, tratar :id como turmaId para "minha"
    req.params.turmaId = id;
    return inscricoesController.cancelarMinhaInscricao(req, res);
  } catch (e) {
    console.error("LEGADO DELETE /inscricoes/:id erro:", e);
    return res.status(500).json({ erro: "Erro ao cancelar inscrição." });
  }
});

module.exports = router;
