// ✅ src/routes/questionarioRoute.js — PREMIUM (robusto, seguro, sem conflito de rotas)
const express = require("express");
const router = express.Router();

/* ───────────────── Auth resiliente (compat exports) ───────────────── */
const _auth = require("../auth/authMiddleware");
const requireAuth =
  typeof _auth === "function" ? _auth : _auth?.default || _auth?.authMiddleware || _auth?.protect;

if (typeof requireAuth !== "function") {
  // falha cedo: melhor que crash em runtime
  // eslint-disable-next-line no-console
  console.error("[questionariosRoute] authMiddleware inválido:", _auth);
  throw new Error("authMiddleware não é função (verifique exports em src/auth/authMiddleware.js)");
}

const _roles = require("../middlewares/authorize");
const authorizeRoles =
  typeof _roles === "function" ? _roles : _roles?.default || _roles?.authorizeRoles;

if (typeof authorizeRoles !== "function") {
  // eslint-disable-next-line no-console
  console.error("[questionariosRoute] authorizeRoles inválido:", _roles);
  throw new Error("authorizeRoles não é função (verifique exports em src/middlewares/authorize.js)");
}

/* ───────────────── Controllers ───────────────── */
const {
  criarOuObterRascunhoPorEvento,
  obterQuestionarioPorEvento,
  atualizarQuestionario,
  adicionarQuestao,
  atualizarQuestao,
  removerQuestao,
  adicionarAlternativa,
  atualizarAlternativa,
  removerAlternativa,
  publicarQuestionario,

  listarDisponiveisParaUsuario,
  obterQuestionarioParaResponder,
  iniciarTentativa,
  enviarTentativa,
  obterMinhaTentativaPorTurma,
} = require("../controllers/questionarioController");

/* ───────────────── Helpers ───────────────── */
const IS_DEV = process.env.NODE_ENV !== "production";

/** valida params numéricos e mantém req.params como string (Express padrão) */
function ensureNumericParam(paramName) {
  return (req, res, next) => {
    const raw = req.params?.[paramName];
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return res.status(400).json({ erro: `${paramName} inválido.` });
    }
    req.params[paramName] = String(n);
    return next();
  };
}

/** wrapper async (elimina try/catch repetido e deixa o error handler do app agir) */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ───────────────── Middleware ───────────────── */
// Todas as rotas exigem auth
router.use(requireAuth);

/* ───────────────────────────────────────────────────────────────
   🧪 Rota de diagnóstico (DEV) — opcional
   ─────────────────────────────────────────────────────────────── */
if (IS_DEV) {
  router.get("/_ping", (req, res) => {
    res.set("X-Route-Handler", "questionariosRoute:/_ping@dev");
    return res.json({
      ok: true,
      usuario: { id: req.user?.id ?? null, perfis: req.user?.perfil ?? req.user?.perfis ?? null },
    });
  });
}

/* ───────────────────────────────────────────────────────────────
   👩‍🏫 Instrutor/Admin/Coordenador — gestão do questionário
   ─────────────────────────────────────────────────────────────── */

// cria/obtém rascunho do evento
router.post(
  "/evento/:evento_id/rascunho",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("evento_id"),
  wrap(criarOuObterRascunhoPorEvento)
);

// obtém questionário do evento
router.get(
  "/evento/:evento_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("evento_id"),
  wrap(obterQuestionarioPorEvento)
);

// atualiza metadados do questionário
router.put(
  "/:questionario_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  wrap(atualizarQuestionario)
);

// adiciona questão
router.post(
  "/:questionario_id/questoes",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  wrap(adicionarQuestao)
);

// atualiza questão
router.put(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  wrap(atualizarQuestao)
);

// remove questão
router.delete(
  "/:questionario_id/questoes/:questao_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("questao_id"),
  wrap(removerQuestao)
);

// adiciona alternativa a uma questão
router.post(
  "/questoes/:questao_id/alternativas",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questao_id"),
  wrap(adicionarAlternativa)
);

// atualiza alternativa
router.put(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("alt_id"),
  wrap(atualizarAlternativa)
);

// remove alternativa
router.delete(
  "/alternativas/:alt_id",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("alt_id"),
  wrap(removerAlternativa)
);

// publica questionário
router.post(
  "/:questionario_id/publicar",
  authorizeRoles("administrador", "instrutor", "coordenador"),
  ensureNumericParam("questionario_id"),
  wrap(publicarQuestionario)
);

/* ───────────────────────────────────────────────────────────────
   👤 Usuário (aluno) — responder
   ⚠️ IMPORTANTE: rotas específicas ANTES de "/:questionario_id"
   ─────────────────────────────────────────────────────────────── */

// lista questionários disponíveis para um usuário
router.get(
  "/disponiveis/usuario/:usuario_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("usuario_id"),
  wrap(listarDisponiveisParaUsuario)
);

// obter questionário para responder (por turma)
router.get(
  "/:questionario_id/responder/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  wrap(obterQuestionarioParaResponder)
);

// iniciar tentativa
router.post(
  "/:questionario_id/iniciar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  wrap(iniciarTentativa)
);

// enviar tentativa
router.post(
  "/:questionario_id/enviar/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  wrap(enviarTentativa)
);

// obter minha tentativa por turma
router.get(
  "/:questionario_id/minha-tentativa/turma/:turma_id",
  authorizeRoles("administrador", "instrutor", "coordenador", "usuario"),
  ensureNumericParam("questionario_id"),
  ensureNumericParam("turma_id"),
  wrap(obterMinhaTentativaPorTurma)
);

module.exports = router;
