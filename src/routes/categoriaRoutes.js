/**
 * @file categoryRoutes.js
 * @description Rotas para listagem de categorias de produtos do marketplace Agrostand.
 * Categoria é um recurso tipicamente de leitura pública, permitindo que usuários não autenticados
 * visualizem as divisões do catálogo de anúncios (ex: grãos, sementes, maquinário).
 */

// Importa o framework Express para gerenciamento de rotas.
const express = require('express');

// Importa o CategoriaController que gerencia as operações referentes às categorias.
const CategoriaController = require('../controllers/CategoriaController');

// Cria uma nova instância de roteador do Express.
const router = express.Router();

/**
 * Rota: GET /
 * Descrição: Retorna uma lista de todas as categorias cadastradas no sistema.
 * Acesso: Público (qualquer visitante pode consultar).
 * Mapeamento: CategoriaController.list
 */
router.get('/', CategoriaController.list);

// Exporta o roteador configurado.
module.exports = router;

