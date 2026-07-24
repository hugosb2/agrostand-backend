/**
 * @file userRoutes.js
 * @description Rotas de gerenciamento de perfil e conta de usuário.
 * Todos os endpoints declarados neste roteador requerem autenticação por token JWT.
 * Inclui também o endpoint de exclusão de conta, projetado em conformidade com as leis de privacidade (LGPD).
 */

// Importa o framework Express para habilitar os recursos de roteamento.
const express = require('express');

// Importa o UsuarioController que lida com o gerenciamento dos dados cadastrais do próprio usuário.
const UsuarioController = require('../controllers/UsuarioController');

// Importa o middleware de autenticação.
const authMiddleware = require('../middlewares/authMiddleware');

// Cria uma nova instância de roteador do Express.
const router = express.Router();

// Aplica o middleware de autenticação de forma global para este roteador.
// Todas as rotas abaixo exigem obrigatoriamente que o cliente envie um token JWT válido.
router.use(authMiddleware); // Todas as rotas de perfil do usuário exigem autenticação

/**
 * Rota: GET /profile
 * Descrição: Obtém as informações detalhadas do perfil do usuário autenticado.
 * Mapeamento: UsuarioController.getProfile
 */
router.get('/profile', UsuarioController.getProfile);

/**
 * Rota: PUT /profile
 * Descrição: Atualiza as informações de perfil do usuário autenticado (como nome, telefone, etc.).
 * Mapeamento: UsuarioController.updateProfile
 */
router.put('/profile', UsuarioController.updateProfile);

/**
 * Rota: PUT /password
 * Descrição: Altera a senha do usuário autenticado, exigindo geralmente a senha atual por questões de segurança.
 * Mapeamento: UsuarioController.updatePassword
 */
router.put('/password', UsuarioController.updatePassword);

/**
 * Rota: DELETE /account
 * Descrição: Exclui permanentemente ou realiza a exclusão lógica da conta do usuário autenticado.
 * Nota de Conformidade (LGPD): Este endpoint é de extrema importância para atender ao direito de
 * eliminação de dados previstos pela Lei Geral de Proteção de Dados (LGPD).
 * Mapeamento: UsuarioController.deleteAccount
 */
router.delete('/account', UsuarioController.deleteAccount); // LGPD

// Exporta o roteador para que possa ser montado no arquivo de rotas centrais (index.js).
module.exports = router;

