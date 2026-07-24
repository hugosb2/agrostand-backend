/**
 * @file authRoutes.js
 * @description Rotas de autenticação e gerenciamento de credenciais (Cadastro, Login, Recuperação de Senha).
 * Estes endpoints lidam com fluxo de credenciais sensíveis e, por boas práticas de segurança,
 * utilizam requisições HTTP POST para transmitir informações protegidas no corpo da mensagem (request body).
 */

// Importa o framework Express para gerenciar o roteamento.
const express = require('express');

// Importa o AutenticacaoController que implementa as regras de negócio para registro, login e redefinição de senha.
const AutenticacaoController = require('../controllers/AutenticacaoController');

// Cria uma nova instância de roteador do Express.
const router = express.Router();

/**
 * Rota: POST /register
 * Descrição: Registra um novo usuário no sistema. Recebe dados como nome, email, senha e CPF/CNPJ.
 * Mapeamento: AutenticacaoController.register
 */
router.post('/register', AutenticacaoController.register);

/**
 * Rota: POST /login
 * Descrição: Autentica um usuário existente com email e senha, retornando um token JWT caso as credenciais estejam corretas.
 * Mapeamento: AutenticacaoController.login
 */
router.post('/login', AutenticacaoController.login);

/**
 * Rota: POST /forgot-password
 * Descrição: Solicita um link/token de recuperação de senha por e-mail para um usuário que esqueceu seus dados.
 * Mapeamento: AutenticacaoController.forgotPassword
 */
router.post('/forgot-password', AutenticacaoController.forgotPassword);

/**
 * Rota: POST /reset-password
 * Descrição: Realiza a redefinição de senha efetiva, recebendo a nova senha e o token de validação enviado no fluxo anterior.
 * Mapeamento: AutenticacaoController.resetPassword
 */
router.post('/reset-password', AutenticacaoController.resetPassword);

// Exporta o roteador configurado para ser integrado ao ponto central de rotas.
module.exports = router;

