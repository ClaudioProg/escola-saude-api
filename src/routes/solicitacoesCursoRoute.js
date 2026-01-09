// ✅ src/routes/solicitacoesCursoRoute.js
const express = require("express");
const router = express.Router();

let auth = require("../auth/authMiddleware");
const authorizeRoles = require("../auth/authorizeRoles");

const {
  listarSolicitacoes,
  listarTipos,
  criarSolicitacao,
  atualizarSolicitacao,
  excluirSolicitacao,
} = require("../controllers/solicitacoesCursoController");

/* ------------------------------------------------------------------
   🔐 Regras
   - Todas as rotas exigem autenticação
   - Permissão de editar/excluir: criador OU administrador
     (validação feita no controller)
------------------------------------------------------------------- */

/* ------------------------------------------------------------------
   Compat auth (alguns projetos exportam { protect } / default)
------------------------------------------------------------------- */
auth =
  typeof auth === "function"
    ? auth
    : auth?.protect || auth?.auth || auth?.default;

if (typeof auth !== "function") {
  throw new Error(
    "[solicitacoesCursoRoute] authMiddleware inválido (não é função). Verifique ../auth/authMiddleware"
  );
}

/* ------------------------------------------------------------------
   Wrapper async (evita try/catch em cada rota)
------------------------------------------------------------------- */
const wrap =
  (fn) =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      next(err);
    }
  };

/* ------------------------------------------------------------------
   Middlewares globais da rota
------------------------------------------------------------------- */
router.use(auth);

/* ─────────────────────────── ROTAS ─────────────────────────── */

// ✅ Listar solicitações visíveis ao usuário logado
router.get("/", wrap(listarSolicitacoes));

// ✅ Tipos cadastrados para o select do frontend
router.get("/tipos", wrap(listarTipos));

// ➕ Criar nova solicitação
router.post("/", wrap(criarSolicitacao));

// ✏️ Atualizar solicitação existente
router.put("/:id", wrap(atualizarSolicitacao));
router.patch("/:id", wrap(atualizarSolicitacao)); // bônus: PATCH também (sem quebrar nada)

// 🗑️ Excluir solicitação
router.delete("/:id", wrap(excluirSolicitacao));

module.exports = router;
