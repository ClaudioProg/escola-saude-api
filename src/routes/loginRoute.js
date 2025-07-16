const express = require('express');
const router = express.Router();
const usuarioPublicoController = require('../controllers/usuarioPublicoController');

// ✅ Verifica se a função existe para evitar erro de undefined
if (typeof usuarioPublicoController.loginUsuario !== 'function') {
  console.error('❌ Erro: loginUsuario não foi exportado de usuarioPublicoController');
  throw new Error('Função loginUsuario não encontrada no controller');
}

/**
 * @route POST /api/auth
 * @desc Autenticação de usuário (login)
 * @access Público
 */
router.post('/', usuarioPublicoController.loginUsuario);

module.exports = router;
