/**
 * @file addressRoutes.js
 * @description Definição das rotas de gerenciamento de endereços dos usuários.
 * Este arquivo utiliza o Roteador do Express para agrupar endpoints relacionados a endereços,
 * aplicando proteção de autenticação em nível de roteador e mapeando requisições REST para o respectivo controlador.
 */

// Importa o framework Express para habilitar os recursos de roteamento.
const express = require('express');

// Importa o EnderecoController, que encapsula as regras de negócio e consultas ao banco para endereços.
const EnderecoController = require('../controllers/EnderecoController');

// Importa o middleware de autenticação para garantir que apenas usuários logados acessem e modifiquem endereços.
const authMiddleware = require('../middlewares/authMiddleware');

// Cria uma nova instância de Router. Um Router é um mini-aplicativo Express isolado
// que pode receber middlewares e tratar rotas específicas de forma modular.
const router = express.Router();

// Aplica o middleware de autenticação de forma global para este roteador.
// A partir desta linha, TODAS as rotas registradas abaixo exigirão obrigatoriamente um token JWT válido.
router.use(authMiddleware); // Todas as rotas de gerenciamento de endereço exigem autenticação

/**
 * Rota: GET /
 * Descrição: Retorna uma lista com os endereços cadastrados do usuário autenticado.
 * Mapeamento: EnderecoController.list
 */
router.get('/', EnderecoController.list);

/**
 * Rota: POST /
 * Descrição: Cria um novo endereço associado ao usuário autenticado.
 * Mapeamento: EnderecoController.create
 */
router.post('/', EnderecoController.create);

/**
 * Rota: PUT /:id
 * Descrição: Atualiza os dados de um endereço existente com base em seu ID de identificação única.
 * Parâmetros de rota: ':id' representa uma variável de caminho (path parameter) capturada em req.params.id.
 * Mapeamento: EnderecoController.update
 */
router.put('/:id', EnderecoController.update);

/**
 * Rota: DELETE /:id
 * Descrição: Remove um endereço cadastrado com base em seu ID.
 * Parâmetros de rota: ':id' representa o ID do endereço a ser excluído, obtido via req.params.id.
 * Mapeamento: EnderecoController.delete
 */
router.delete('/:id', EnderecoController.delete);

// Exporta o roteador configurado para ser plugado no roteador principal da aplicação em routes/index.js.
module.exports = router;

