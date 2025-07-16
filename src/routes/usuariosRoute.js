const express = require('express');
const router = express.Router();

const usuarioAdministradorController = require('../controllers/usuarioAdministradorController');
const usuarioPublicoController = require('../controllers/usuarioPublicoController');
const authMiddleware = require('../auth/authMiddleware');
const authorizeRoles = require('../auth/authorizeRoles');

// 🔓 📥 Cadastro público (sem autenticação)
router.post('/cadastro', usuarioPublicoController.cadastrarUsuario);

// 🔒 👤 Listar todos os usuários (administrador)
router.get(
  '/',
  authMiddleware,
  authorizeRoles('administrador'),
  usuarioAdministradorController.listarUsuarios
);

// 🔒 👨‍🏫 Listar apenas instrutor (administrador)
router.get(
  '/instrutor',
  authMiddleware,
  authorizeRoles('administrador'),
  usuarioAdministradorController.listarinstrutor
);

// 🔒 ✏️ Atualizar perfil (administrador apenas)
router.put(
  '/:id/perfil',
  authMiddleware,
  authorizeRoles('administrador'),
  usuarioAdministradorController.atualizarPerfil
);

// 🔒 🔍 Buscar dados do usuário (administrador ou o próprio)
router.get(
  '/:id',
  authMiddleware,
  usuarioPublicoController.obterUsuarioPorId
);

// 🔒 ✏️ Atualizar dados do usuário (administrador ou o próprio)
router.patch(
  '/:id',
  authMiddleware,
  usuarioPublicoController.atualizarUsuario
);

// 🔒 ✍️ Obter assinatura do usuário autenticado
router.get(
  '/assinatura',
  authMiddleware,
  usuarioPublicoController.obterAssinatura
);

// 🔒 🗑️ Excluir usuário (administrador apenas)
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('administrador'),
  usuarioAdministradorController.excluirUsuario
);

module.exports = router;
